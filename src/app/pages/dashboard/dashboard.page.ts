import { DecimalPipe, NgIf } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { firstValueFrom } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { EmployeesService } from '../../services/employees.service';
import { BonusPremiumsService } from '../../services/bonus-premiums.service';
import { MonthlyPremiumsService } from '../../services/monthly-premiums.service';
import { BonusPremium, Employee, MonthlyPremium } from '../../types';

Chart.register(...registerables);

@Component({
  selector: 'ip-dashboard-page',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatTableModule, NgChartsModule, DecimalPipe, NgIf],
  template: `
    <section class="page dashboard">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>dashboard</mat-icon>
          </div>
          <div class="header-text">
            <h1>ダッシュボード</h1>
            <p>事業所全体の社会保険料負担や直近トレンドを集約して可視化します。</p>
          </div>
        </div>
      </mat-card>

      <div class="dashboard-grid">
        <mat-card class="stat-card">
          <div class="stat-icon" style="background: #e3f2fd;">
            <mat-icon style="color: #1976d2;">people</mat-icon>
          </div>
          <div class="stat-content">
            <h3>従業員数</h3>
            <p class="stat-value">
              <ng-container *ngIf="insuredEmployeeCount() !== null; else allEmployees">
                {{ insuredEmployeeCount() }}人
              </ng-container>
              <ng-template #allEmployees>
                {{ employeeCount() ?? '-' }}
                <ng-container *ngIf="employeeCount() !== null">人</ng-container>
              </ng-template>
            </p>
            <p class="stat-label">
              <ng-container *ngIf="insuredEmployeeCount() !== null">社会保険加入者</ng-container>
              <ng-container *ngIf="insuredEmployeeCount() === null">登録済み従業員</ng-container>
            </p>
          </div>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-icon" style="background: #e8f5e9;">
            <mat-icon style="color: #2e7d32;">account_balance_wallet</mat-icon>
          </div>
          <div class="stat-content">
            <h3>月次保険料</h3>
            <p class="stat-value">
              <ng-container *ngIf="currentMonthTotalEmployer() !== null; else noData">
                ¥{{ currentMonthTotalEmployer() | number }}
              </ng-container>
              <ng-template #noData>-</ng-template>
            </p>
            <p class="stat-label">今月の会社負担額</p>
          </div>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-icon" style="background: #fff3e0;">
            <mat-icon style="color: #e65100;">trending_up</mat-icon>
          </div>
          <div class="stat-content">
            <h3>トレンド</h3>
            <p class="stat-value" [style.color]="trendColor()">
              {{ trendDisplay() }}
            </p>
            <p class="stat-label">前月比の変化</p>
          </div>
        </mat-card>

        <mat-card class="info-card">
          <h3>
            <mat-icon>insights</mat-icon>
            グラフとランキングで可視化
          </h3>
          <p>
            過去12ヶ月の推移・賞与を含めた当月比較・年度別合計をグラフ表示し、従業員別負担ランキングを併せて確認できます。
          </p>
        </mat-card>
      </div>

      <div class="charts-grid">
        <mat-card class="chart-card">
          <div class="chart-header">
            <h3>
              <mat-icon>show_chart</mat-icon>
              過去12ヶ月の月次保険料推移（会社負担額）
            </h3>
          </div>
          <div class="chart-container">
            <canvas baseChart [data]="monthlyTrendData()" [options]="lineChartOptions" type="line"></canvas>
          </div>
        </mat-card>

        <mat-card class="chart-card">
          <div class="chart-header">
            <h3>
              <mat-icon>bar_chart</mat-icon>
              今月の保険料負担（会社負担額）
            </h3>
          </div>
          <div class="chart-container">
            <canvas
              baseChart
              [data]="currentMonthComparisonData()"
              [options]="barChartOptions"
              type="bar"
            ></canvas>
          </div>
        </mat-card>

        <mat-card class="chart-card">
          <div class="chart-header">
            <h3>
              <mat-icon>assessment</mat-icon>
              年度別保険料負担（会社負担額）
            </h3>
          </div>
          <div class="chart-container">
            <canvas
              baseChart
              [data]="fiscalYearComparisonData()"
              [options]="barChartOptions"
              type="bar"
            ></canvas>
          </div>
        </mat-card>
      </div>

      <div class="ranking-section">
        <mat-card class="ranking-card">
          <div class="chart-header">
            <h3>
              <mat-icon>trending_up</mat-icon>
              会社負担額ランキング（トップ10）
            </h3>
          </div>
          <table mat-table [dataSource]="employerRanking()" class="ranking-table">
            <ng-container matColumnDef="rank">
              <th mat-header-cell *matHeaderCellDef>順位</th>
              <td mat-cell *matCellDef="let item">{{ item.rank }}</td>
            </ng-container>

            <ng-container matColumnDef="employeeName">
              <th mat-header-cell *matHeaderCellDef>従業員名</th>
              <td mat-cell *matCellDef="let item">{{ item.employeeName }}</td>
            </ng-container>

            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef>金額</th>
              <td mat-cell *matCellDef="let item">¥{{ item.amount | number }}</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="['rank', 'employeeName', 'amount']"></tr>
            <tr mat-row *matRowDef="let row; columns: ['rank', 'employeeName', 'amount']"></tr>

            <tr class="mat-row" *ngIf="employerRanking().length === 0">
              <td class="mat-cell" colspan="3">データなし</td>
            </tr>
          </table>
        </mat-card>

        <mat-card class="ranking-card">
          <div class="chart-header">
            <h3>
              <mat-icon>person</mat-icon>
              本人負担額ランキング（トップ10）
            </h3>
          </div>
          <table mat-table [dataSource]="employeeRanking()" class="ranking-table">
            <ng-container matColumnDef="rank">
              <th mat-header-cell *matHeaderCellDef>順位</th>
              <td mat-cell *matCellDef="let item">{{ item.rank }}</td>
            </ng-container>

            <ng-container matColumnDef="employeeName">
              <th mat-header-cell *matHeaderCellDef>従業員名</th>
              <td mat-cell *matCellDef="let item">{{ item.employeeName }}</td>
            </ng-container>

            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef>金額</th>
              <td mat-cell *matCellDef="let item">¥{{ item.amount | number }}</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="['rank', 'employeeName', 'amount']"></tr>
            <tr mat-row *matRowDef="let row; columns: ['rank', 'employeeName', 'amount']"></tr>

            <tr class="mat-row" *ngIf="employeeRanking().length === 0">
              <td class="mat-cell" colspan="3">データなし</td>
            </tr>
          </table>
        </mat-card>
      </div>
    </section>
  `,
  styles: [
    `
      .header-card {
        margin-bottom: 1.5rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .header-card ::ng-deep .mat-mdc-card-content {
        padding: 0;
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem;
      }

      .header-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 12px;
      }

      .header-icon mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: white;
      }

      .header-text h1 {
        margin: 0 0 0.5rem 0;
        font-size: 1.75rem;
        font-weight: 600;
      }

      .header-text p {
        margin: 0;
        opacity: 0.9;
        font-size: 1rem;
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
      }

      .stat-card {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 1.5rem;
        transition: all 0.2s ease;
      }

      .stat-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateY(-2px);
      }

      .stat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 12px;
        flex-shrink: 0;
      }

      .stat-icon mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }

      .stat-content {
        flex: 1;
      }

      .stat-content h3 {
        margin: 0 0 0.5rem 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .stat-value {
        margin: 0 0 0.25rem 0;
        font-size: 2rem;
        font-weight: 700;
        color: #333;
      }

      .stat-label {
        margin: 0;
        font-size: 0.875rem;
        color: #999;
      }

      .info-card {
        grid-column: 1 / -1;
        padding: 1.5rem;
      }

      .info-card h3 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0 0 1rem 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #333;
      }

      .info-card h3 mat-icon {
        color: #667eea;
      }

      .info-card p {
        margin: 0;
        color: #666;
        line-height: 1.6;
      }

      .charts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 1.5rem;
        margin-top: 1.5rem;
      }

      .chart-card {
        padding: 1.5rem;
      }

      .chart-header {
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid #e0e0e0;
      }

      .chart-header h3 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #333;
      }

      .chart-header h3 mat-icon {
        color: #667eea;
      }

      .chart-container {
        height: 300px;
        position: relative;
      }

      .ranking-section {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 1.5rem;
        margin: 1.5rem 0;
      }

      .ranking-card {
        padding: 1.5rem;
      }

      .ranking-table {
        width: 100%;
      }

      .ranking-table th {
        font-weight: 600;
        color: #666;
      }

      .ranking-table td {
        color: #333;
      }

      @media (max-width: 768px) {
        .header-content {
          flex-direction: column;
          text-align: center;
        }

        .dashboard-grid {
          grid-template-columns: 1fr;
        }

        .chart-container {
          height: 250px;
        }

        .ranking-section {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class DashboardPage implements OnInit {
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly employeesService = inject(EmployeesService);
  private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
  private readonly bonusPremiumsService = inject(BonusPremiumsService);

  readonly officeId$ = this.currentOffice.officeId$;

  readonly employeeCount = signal<number | null>(null);
  readonly insuredEmployeeCount = signal<number | null>(null);
  readonly currentMonthTotalEmployer = signal<number | null>(null);
  readonly previousMonthTotalEmployer = signal<number | null>(null);

  readonly monthlyTrendData = signal<ChartData<'line'>>({ labels: [], datasets: [] });
  readonly currentMonthComparisonData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  readonly fiscalYearComparisonData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  readonly employerRanking = signal<Array<{ employeeName: string; amount: number; rank: number }>>([]);
  readonly employeeRanking = signal<Array<{ employeeName: string; amount: number; rank: number }>>([]);

  readonly trendPercentage = computed(() => {
    const current = this.currentMonthTotalEmployer();
    const previous = this.previousMonthTotalEmployer();

    if (current === null || previous === null || previous === 0) {
      return null;
    }

    return ((current - previous) / previous) * 100;
  });

  readonly trendDisplay = computed(() => {
    const trend = this.trendPercentage();
    if (trend === null) {
      return '-';
    }

    const sign = trend >= 0 ? '+' : '';
    return `${sign}${trend.toFixed(1)}%`;
  });

  readonly trendColor = computed(() => {
    const trend = this.trendPercentage();
    if (trend === null) {
      return '#999';
    }
    return trend >= 0 ? '#2e7d32' : '#d32f2f';
  });

  readonly lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom'
      },
      tooltip: {
        callbacks: {
          label: (context) => `¥${context.parsed.y.toLocaleString()}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `¥${Number(value).toLocaleString()}`
        }
      }
    }
  };

  readonly barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom'
      },
      tooltip: {
        callbacks: {
          label: (context) => `¥${context.parsed.y.toLocaleString()}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `¥${Number(value).toLocaleString()}`
        }
      }
    }
  };

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private async loadDashboardData(): Promise<void> {
    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) {
      return;
    }

    try {
      await this.loadEmployeeCount(officeId);
      await this.loadMonthlyPremiumsTotals(officeId);
      await this.loadMonthlyTrendData(officeId);
      await this.loadCurrentMonthComparisonData(officeId);
      await this.loadFiscalYearComparisonData(officeId);
      await this.loadRankingData(officeId);
    } catch (error) {
      console.error('ダッシュボードデータの取得に失敗しました', error);
    }
  }

  private async loadEmployeeCount(officeId: string): Promise<void> {
    try {
      const employees: Employee[] = await firstValueFrom(this.employeesService.list(officeId));

      this.employeeCount.set(employees.length);

      const insuredCount = employees.filter((emp) => emp.isInsured === true).length;
      this.insuredEmployeeCount.set(insuredCount > 0 ? insuredCount : null);
    } catch (error) {
      console.error('従業員数の取得に失敗しました', error);
      this.employeeCount.set(null);
      this.insuredEmployeeCount.set(null);
    }
  }

  private async loadMonthlyPremiumsTotals(officeId: string): Promise<void> {
    try {
      const now = new Date();
      const currentYearMonth = now.toISOString().substring(0, 7);

      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousYearMonth = previousMonth.toISOString().substring(0, 7);

      const currentPremiums: MonthlyPremium[] = await firstValueFrom(
        this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, currentYearMonth)
      );
      const currentTotal = currentPremiums.reduce((sum, p) => sum + p.totalEmployer, 0);
      this.currentMonthTotalEmployer.set(currentTotal);

      const previousPremiums: MonthlyPremium[] = await firstValueFrom(
        this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, previousYearMonth)
      );
      const previousTotal = previousPremiums.reduce((sum, p) => sum + p.totalEmployer, 0);
      this.previousMonthTotalEmployer.set(previousTotal);
    } catch (error) {
      console.error('月次保険料の集計に失敗しました', error);
      this.currentMonthTotalEmployer.set(null);
      this.previousMonthTotalEmployer.set(null);
    }
  }

  private async loadMonthlyTrendData(officeId: string): Promise<void> {
    try {
      const now = new Date();
      const yearMonths: string[] = [];
      const totals: number[] = [];

      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yearMonth = date.toISOString().substring(0, 7);
        yearMonths.push(yearMonth);

        const premiums = await firstValueFrom(
          this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)
        );
        const total = premiums.reduce((sum, p) => sum + p.totalEmployer, 0);
        totals.push(total);
      }

      this.monthlyTrendData.set({
        labels: yearMonths,
        datasets: [
          {
            label: '月次保険料（会社負担額）',
            data: totals,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.1
          }
        ]
      });
    } catch (error) {
      console.error('過去12ヶ月の推移データの取得に失敗しました', error);
      this.monthlyTrendData.set({ labels: [], datasets: [] });
    }
  }

  private async loadCurrentMonthComparisonData(officeId: string): Promise<void> {
    try {
      const now = new Date();
      const currentYearMonth = now.toISOString().substring(0, 7);

      const monthlyPremiums = await firstValueFrom(
        this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, currentYearMonth)
      );
      const monthlyTotal = monthlyPremiums.reduce((sum, p) => sum + p.totalEmployer, 0);

      const bonusPremiums: BonusPremium[] = await firstValueFrom(
        this.bonusPremiumsService.listByOfficeAndEmployee(officeId)
      );
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const currentMonthBonuses = bonusPremiums.filter((b) => {
        const payDate = new Date(b.payDate);
        return payDate >= currentMonthStart && payDate < nextMonthStart;
      });
      const bonusTotal = currentMonthBonuses.reduce((sum, b) => sum + b.totalEmployer, 0);

      this.currentMonthComparisonData.set({
        labels: ['今月の保険料負担'],
        datasets: [
          {
            label: '月次保険料',
            data: [monthlyTotal],
            backgroundColor: 'rgba(54, 162, 235, 0.5)'
          },
          {
            label: '賞与保険料',
            data: [bonusTotal],
            backgroundColor: 'rgba(255, 99, 132, 0.5)'
          }
        ]
      });
    } catch (error) {
      console.error('当月の比較データの取得に失敗しました', error);
      this.currentMonthComparisonData.set({ labels: [], datasets: [] });
    }
  }

  private async loadFiscalYearComparisonData(officeId: string): Promise<void> {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentFiscalYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      const previousFiscalYear = currentFiscalYear - 1;

      const fiscalYears = [`${previousFiscalYear}年度`, `${currentFiscalYear}年度`];
      const monthlyTotals: number[] = [];
      const bonusTotals: number[] = [];

      const allBonusPremiums: BonusPremium[] = await firstValueFrom(
        this.bonusPremiumsService.listByOfficeAndEmployee(officeId)
      );

      for (const fiscalYear of [previousFiscalYear, currentFiscalYear]) {
        let monthlyTotal = 0;
        for (let i = 0; i < 12; i++) {
          const date = new Date(fiscalYear, 3 + i, 1);
          const yearMonth = date.toISOString().substring(0, 7);
          const premiums = await firstValueFrom(
            this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)
          );
          monthlyTotal += premiums.reduce((sum, p) => sum + p.totalEmployer, 0);
        }
        monthlyTotals.push(monthlyTotal);

        const fiscalYearStart = new Date(fiscalYear, 3, 1);
        const fiscalYearEnd = new Date(fiscalYear + 1, 3, 1);
        const fiscalYearBonuses = allBonusPremiums.filter((b) => {
          const payDate = new Date(b.payDate);
          return payDate >= fiscalYearStart && payDate < fiscalYearEnd;
        });
        const bonusTotal = fiscalYearBonuses.reduce((sum, b) => sum + b.totalEmployer, 0);
        bonusTotals.push(bonusTotal);
      }

      this.fiscalYearComparisonData.set({
        labels: fiscalYears,
        datasets: [
          {
            label: '月次保険料',
            data: monthlyTotals,
            backgroundColor: 'rgba(54, 162, 235, 0.5)'
          },
          {
            label: '賞与保険料',
            data: bonusTotals,
            backgroundColor: 'rgba(255, 99, 132, 0.5)'
          }
        ]
      });
    } catch (error) {
      console.error('年度別比較データの取得に失敗しました', error);
      this.fiscalYearComparisonData.set({ labels: [], datasets: [] });
    }
  }

  private async loadRankingData(officeId: string): Promise<void> {
    try {
      const now = new Date();
      const currentYearMonth = now.toISOString().substring(0, 7);

      const premiums = await firstValueFrom(
        this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, currentYearMonth)
      );

      const employees = await firstValueFrom(this.employeesService.list(officeId));
      const employeeMap = new Map(employees.map((e) => [e.id, e.name]));

      const employerRanking = premiums
        .map((p) => ({
          employeeId: p.employeeId,
          employeeName: employeeMap.get(p.employeeId) ?? '不明',
          amount: p.totalEmployer
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map((item, index) => ({
          ...item,
          rank: index + 1
        }));
      this.employerRanking.set(employerRanking);

      const employeeRanking = premiums
        .map((p) => ({
          employeeId: p.employeeId,
          employeeName: employeeMap.get(p.employeeId) ?? '不明',
          amount: p.totalEmployee
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map((item, index) => ({
          ...item,
          rank: index + 1
        }));
      this.employeeRanking.set(employeeRanking);
    } catch (error) {
      console.error('ランキングデータの取得に失敗しました', error);
      this.employerRanking.set([]);
      this.employeeRanking.set([]);
    }
  }
}
