import { AsyncPipe, DecimalPipe, NgIf } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { catchError, firstValueFrom, map, of, shareReplay, startWith, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';

import { CurrentOfficeService } from '../../services/current-office.service';
import { EmployeesService } from '../../services/employees.service';
import { BonusPremiumsService } from '../../services/bonus-premiums.service';
import { MonthlyPremiumsService } from '../../services/monthly-premiums.service';
import { PaymentsService } from '../../services/payments.service';
import { ProceduresService } from '../../services/procedures.service';
import { DataQualityService } from '../../services/data-quality.service';
import { MastersService } from '../../services/masters.service';
import { BonusPremium, Employee, MonthlyPremium, Office, PaymentStatus, SocialInsurancePayment, YearMonthString } from '../../types';
import { hasInsuranceInMonth, isCareInsuranceTarget, roundForEmployeeDeduction } from '../../utils/premium-calculator';

Chart.register(...registerables);

@Component({
  selector: 'ip-dashboard-page',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatTableModule, BaseChartDirective, DecimalPipe, NgIf, AsyncPipe],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div>
          <h1 class="m-0">ダッシュボード</h1>
          <p class="mat-body-2 mb-0" style="color: var(--app-text-sub);">
            事業所の社会保険料負担・納付状況・手続き期限を把握できます。
          </p>
        </div>
      </header>

      <mat-card class="content-card">
        <div class="dashboard-grid">
          <mat-card class="stat-card">
            <div class="stat-icon stat-icon-blue">
              <mat-icon>people</mat-icon>
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
            <div class="stat-icon stat-icon-green">
              <mat-icon>account_balance_wallet</mat-icon>
            </div>
            <div class="stat-content">
              <h3>今月の保険料合計</h3>
              <p class="stat-value">
                <ng-container *ngIf="currentMonthTotalEmployer() !== null; else noData">
                  ¥{{ currentMonthTotalEmployer() | number }}
                </ng-container>
                <ng-template #noData>-</ng-template>
              </p>
              <p class="stat-label">会社負担額（月次+賞与）</p>
            </div>
          </mat-card>

          <mat-card class="stat-card clickable-card" (click)="navigateToPayments()">
            <div class="stat-icon stat-icon-purple">
              <mat-icon>account_balance</mat-icon>
            </div>
            <div class="stat-content">
              <h3>今月納付予定の社会保険料</h3>
              <p class="stat-value">
                <ng-container *ngIf="currentPaymentVm$ | async as vm">
                  <ng-container *ngIf="!vm.loaded">-</ng-container>
                  <ng-container *ngIf="vm.loaded">
                    <ng-container *ngIf="vm.payment !== null; else notRegistered">
                      ¥{{ vm.payment.plannedTotalCompany | number }}
                    </ng-container>
                    <ng-template #notRegistered>
                      <span style="font-size: 0.9rem; font-weight: 600;">未登録（クリックで納付予定を作成）</span>
                    </ng-template>
                  </ng-container>
                </ng-container>
              </p>
              <p class="stat-label">会社負担額（予定）</p>
            </div>
          </mat-card>

          <mat-card
            class="stat-card"
            [class.warning]="thisWeekDeadlinesCount() > 0"
            (click)="navigateToProcedures('thisWeek')"
          >
            <div class="stat-icon stat-icon-warning">
              <mat-icon>assignment_turned_in</mat-icon>
            </div>
            <div class="stat-content">
              <h3>今週提出期限の手続き</h3>
              <p class="stat-value" [style.color]="thisWeekDeadlinesCount() > 0 ? '#ff9800' : '#333'">
                {{ thisWeekDeadlinesCount() }}件
              </p>
              <p class="stat-label">対応が必要</p>
            </div>
          </mat-card>

          <mat-card
            class="stat-card"
            [class.danger]="overdueDeadlinesCount() > 0"
            (click)="navigateToProcedures('overdue')"
          >
            <div class="stat-icon stat-icon-danger">
              <mat-icon>warning</mat-icon>
            </div>
            <div class="stat-content">
              <h3>期限超過の手続き</h3>
              <p class="stat-value" [style.color]="overdueDeadlinesCount() > 0 ? '#b91c1c' : '#333'">
                {{ overdueDeadlinesCount() }}件
              </p>
              <p class="stat-label">緊急対応が必要</p>
            </div>
          </mat-card>

          <mat-card
            class="stat-card"
            [class.warning]="dataQualityIssuesCount() > 0"
            (click)="navigateToDataQuality()"
          >
            <div class="stat-icon stat-icon-warning">
              <mat-icon>fact_check</mat-icon>
            </div>
            <div class="stat-content">
              <h3>要確認データ</h3>
              <p class="stat-value" [style.color]="dataQualityIssuesCount() > 0 ? '#f97316' : '#333'">
                {{ dataQualityIssuesCount() }}件
              </p>
              <p class="stat-label">社会保険情報の異常検知</p>
            </div>
          </mat-card>
        </div>
      </mat-card>

      <mat-card class="content-card">
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
                先月・今月の保険料負担（会社負担額）
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
      </mat-card>

      <mat-card class="content-card">
        <h3 class="mat-h3 flex-row align-center gap-2 mb-3">
          <mat-icon>account_balance</mat-icon>
          最近の納付状況（最大12件）
        </h3>
        <div class="payment-list" *ngIf="recentPayments$ | async as payments">
          <div *ngIf="payments.length === 0" class="empty-state">
            <mat-icon>inbox</mat-icon>
            <p>納付状況が登録されていません</p>
          </div>

          <table mat-table [dataSource]="payments" *ngIf="payments.length > 0">
            <ng-container matColumnDef="targetYearMonth">
              <th mat-header-cell *matHeaderCellDef>対象年月</th>
              <td mat-cell *matCellDef="let payment">{{ payment.targetYearMonth }}</td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>ステータス</th>
              <td mat-cell *matCellDef="let payment">
                <span [class]="getPaymentStatusClass(payment.paymentStatus)">
                  {{ getPaymentStatusLabel(payment.paymentStatus) }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="plannedTotalCompany">
              <th mat-header-cell *matHeaderCellDef>予定額</th>
              <td mat-cell *matCellDef="let payment">¥{{ payment.plannedTotalCompany | number }}</td>
            </ng-container>

            <ng-container matColumnDef="actualTotalCompany">
              <th mat-header-cell *matHeaderCellDef>納付額</th>
              <td mat-cell *matCellDef="let payment">
                <ng-container *ngIf="payment.actualTotalCompany != null; else notInput">
                  ¥{{ payment.actualTotalCompany | number }}
                </ng-container>
                <ng-template #notInput>未入力</ng-template>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="['targetYearMonth', 'status', 'plannedTotalCompany', 'actualTotalCompany']"></tr>
            <tr mat-row *matRowDef="let row; columns: ['targetYearMonth', 'status', 'plannedTotalCompany', 'actualTotalCompany']"></tr>
          </table>
        </div>
      </mat-card>

      <!-- ランキング表示（Phase3 では利用しないため一旦無効化）
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
      -->
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 1366px;
        margin: 0 auto;
        padding: 24px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .content-card {
        padding: 24px;
        border-radius: 8px;
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

      .stat-card.clickable-card {
        cursor: pointer;
      }

      .stat-card.clickable-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateY(-2px);
      }

      .stat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 12px;
        flex-shrink: 0;
        color: #fff;
      }

      .stat-icon mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      .stat-icon-blue { background: #1976d2; }
      .stat-icon-green { background: #2e7d32; }
      .stat-icon-orange { background: #fb8c00; }
      .stat-icon-purple { background: #5e35b1; }
      .stat-icon-warning { background: #ff9800; }
      .stat-icon-danger { background: #b91c1c; }

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

      .stat-value-text {
        font-size: 2rem;
        font-weight: 700;
        color: #333;
      }

      .stat-label {
        margin: 0;
        font-size: 0.875rem;
        color: #999;
      }

      .payment-list table {
        width: 100%;
      }

      .payment-list th {
        font-weight: 600;
        color: #666;
      }

      .payment-list td {
        color: #333;
      }

      .empty-state {
        display: grid;
        place-items: center;
        gap: 0.5rem;
        padding: 1.5rem 1rem;
        color: #666;
      }

      .empty-state mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }

      .status-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.85rem;
        font-weight: 600;
        color: white;
      }

      .status-unpaid {
        background: #ef4444;
      }

      .status-paid {
        background: #22c55e;
      }

      .status-partially_paid {
        background: #f59e0b;
      }

      .status-not_required {
        background: #9ca3af;
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

      /* Phase3-14: 手続きタスクカードの強調表示 */
      .stat-card.warning {
        border: 2px solid #ff9800;
      }

      .stat-card.danger {
        border: 2px solid #b91c1c;
      }

      .stat-card.warning:hover,
      .stat-card.danger:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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
  private readonly paymentsService = inject(PaymentsService);
  private readonly proceduresService = inject(ProceduresService);
  private readonly router = inject(Router);
  private readonly dataQualityService = inject(DataQualityService);
  private readonly mastersService = inject(MastersService);
  private readonly auth = inject(Auth);

  // 自動再計算用のハッシュ管理
  private readonly lastAutoCalcHashByYearMonth = new Map<YearMonthString, string>();
  private readonly autoCalcInProgressByYearMonth = new Map<YearMonthString, boolean>();
  private readonly lastAutoCalcHashByYearMonthForBonus = new Map<YearMonthString, string>();
  private readonly autoCalcInProgressByYearMonthForBonus = new Map<YearMonthString, boolean>();

  readonly officeId$ = this.currentOffice.officeId$;

  readonly employeeCount = signal<number | null>(null);
  readonly insuredEmployeeCount = signal<number | null>(null);
  readonly currentMonthTotalEmployer = signal<number | null>(null);

  readonly monthlyTrendData = signal<ChartData<'line'>>({ labels: [], datasets: [] });
  readonly currentMonthComparisonData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  readonly fiscalYearComparisonData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  readonly employerRanking = signal<Array<{ employeeName: string; amount: number; rank: number }>>([]);
  readonly employeeRanking = signal<Array<{ employeeName: string; amount: number; rank: number }>>([]);

  readonly currentPayment$ = this.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) {
        return of<SocialInsurancePayment | null>(null);
      }
      const now = new Date();
      const yearMonth = this.buildYearMonth(now);
      return this.paymentsService
        .get(officeId, yearMonth)
        .pipe(map((payment) => payment ?? null), catchError(() => of<SocialInsurancePayment | null>(null)));
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly currentPaymentVm$ = this.currentPayment$.pipe(
    map((payment) => ({ loaded: true, payment })),
    startWith({ loaded: false, payment: null as SocialInsurancePayment | null })
  );

  readonly recentPayments$ = this.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) {
        return of<SocialInsurancePayment[]>([]);
      }
      return this.paymentsService.listByOffice(officeId, 12);
    }),
    catchError(() => of<SocialInsurancePayment[]>([]))
  );

  // データ品質（Phase3-13）
  readonly dataQualityIssuesCount$ = this.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) return of(0);
      return this.dataQualityService.listIssues(officeId).pipe(map((issues) => issues.length));
    })
  );
  readonly dataQualityIssuesCount = toSignal(this.dataQualityIssuesCount$, { initialValue: 0 });

  // 手続きタスク件数（Phase3-14）
  readonly thisWeekDeadlinesCount$ = this.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) {
        return of(0);
      }
      return this.proceduresService.countThisWeekDeadlines(officeId);
    })
  );

  readonly overdueDeadlinesCount$ = this.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) {
        return of(0);
      }
      return this.proceduresService.countOverdueDeadlines(officeId);
    })
  );

  readonly thisWeekDeadlinesCount = toSignal(this.thisWeekDeadlinesCount$, { initialValue: 0 });
  readonly overdueDeadlinesCount = toSignal(this.overdueDeadlinesCount$, { initialValue: 0 });

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
          label: (context) => {
            const y = context.parsed.y;
            if (y == null) {
              return '';
            }
            return `¥${y.toLocaleString()}`;
          }
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
          label: (context) => {
            const y = context.parsed.y;
            return y == null ? '' : `¥${y.toLocaleString()}`;
          }
        }
      }
    },
    datasets: {
      bar: {
        categoryPercentage: 0.65,
        barPercentage: 0.65,
        maxBarThickness: 40
      }
    },
    scales: {
      x: {
        ticks: { autoSkip: false }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `¥${Number(value).toLocaleString()}`
        }
      }
    }
  };

  getPaymentStatusLabel(status: PaymentStatus): string {
    switch (status) {
      case 'paid':
        return '納付済';
      case 'partially_paid':
        return '一部納付';
      case 'not_required':
        return '納付不要';
      default:
        return '未納';
    }
  }

  getPaymentStatusClass(status: PaymentStatus): string {
    return `status-badge status-${status}`;
  }

  navigateToPayments(): void {
    this.router.navigate(['/payments']);
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private async loadDashboardData(): Promise<void> {
    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) {
      return;
    }

    try {
      // 共通データを一度だけ取得して共有（パフォーマンス改善）
      const [employees, office, bonusPremiums] = await Promise.all([
        firstValueFrom(this.employeesService.list(officeId)),
        firstValueFrom(this.currentOffice.office$),
        firstValueFrom(this.bonusPremiumsService.listByOfficeAndEmployee(officeId))
      ]);

      const employeeMap = new Map(employees.map((e) => [e.id, e]));

      // 並列処理で高速化
      await Promise.all([
        this.loadEmployeeCount(officeId, employees),
        this.loadMonthlyPremiumsTotals(officeId, employees, office, employeeMap, bonusPremiums),
        this.loadMonthlyTrendData(officeId, employees, office, employeeMap),
        this.loadCurrentMonthComparisonData(officeId, employees, office, employeeMap, bonusPremiums),
        this.loadFiscalYearComparisonData(officeId, employees, office, employeeMap, bonusPremiums)
      ]);
      // ランキング機能は今回のMVPでは使用しないため呼び出しを停止
      // await this.loadRankingData(officeId);
    } catch (error) {
      console.error('ダッシュボードデータの取得に失敗しました', error);
    }
  }

  private async loadEmployeeCount(officeId: string, employees: Employee[]): Promise<void> {
    try {
      this.employeeCount.set(employees.length);

      const insuredCount = employees.filter((emp) => emp.isInsured === true).length;
      this.insuredEmployeeCount.set(insuredCount);
    } catch (error) {
      console.error('従業員数の取得に失敗しました', error);
      this.employeeCount.set(null);
      this.insuredEmployeeCount.set(null);
    }
  }

  private async loadMonthlyPremiumsTotals(
    officeId: string,
    employees: Employee[],
    office: Office | null,
    employeeMap: Map<string, Employee>,
    bonusPremiums: BonusPremium[]
  ): Promise<void> {
    try {
      const now = new Date();
      const currentYearMonth = this.buildYearMonth(now);

      if (!office) {
        this.currentMonthTotalEmployer.set(null);
        return;
      }

      // 料率を取得
      const rates = await this.mastersService.getRatesForYearMonth(office, currentYearMonth);
      if (rates.healthRate == null || rates.pensionRate == null) {
        this.currentMonthTotalEmployer.set(null);
        return;
      }

      // 月次保険料を取得
      const premiums: MonthlyPremium[] = await firstValueFrom(
        this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, currentYearMonth)
      );

      // 削除された従業員の保険料を除外
      const validPremiums = premiums.filter((premium) => employeeMap.has(premium.employeeId));

      // 自動再計算の判定（月次保険料ページと同じロジック）
      const employeesHash = JSON.stringify(
        employees
          .map((e) => ({
            id: e.id,
            isInsured: e.isInsured ?? false,
            healthQualificationDate: e.healthQualificationDate ?? null,
            healthLossDate: e.healthLossDate ?? null,
            pensionQualificationDate: e.pensionQualificationDate ?? null,
            pensionLossDate: e.pensionLossDate ?? null,
            exemptionKindForYm:
              e.premiumExemptionMonths?.find((x) => x.yearMonth === currentYearMonth)?.kind ?? null,
            healthStandardMonthly: e.healthStandardMonthly ?? null,
            healthGrade: e.healthGrade ?? null,
            pensionStandardMonthly: e.pensionStandardMonthly ?? null,
            pensionGrade: e.pensionGrade ?? null,
            birthDate: e.birthDate ?? null
          }))
          .sort((a, b) => a.id.localeCompare(b.id))
      );
      const ratesHash = JSON.stringify({
        healthRate: rates.healthRate,
        careRate: rates.careRate,
        pensionRate: rates.pensionRate
      });
      const currentHash = `${employeesHash}|${ratesHash}`;

      const lastHash = this.lastAutoCalcHashByYearMonth.get(currentYearMonth);
      const isAutoCalcInProgress = this.autoCalcInProgressByYearMonth.get(currentYearMonth) ?? false;
      const needsAutoCalc =
        !isAutoCalcInProgress &&
        (validPremiums.length === 0 || lastHash !== currentHash);

      // 自動再計算が必要な場合は実行
      if (needsAutoCalc && employees.length > 0) {
        this.autoCalcInProgressByYearMonth.set(currentYearMonth, true);
        try {
          const currentUser = this.auth.currentUser;
          if (currentUser) {
            const calcDate = new Date().toISOString();
            await this.monthlyPremiumsService.saveForMonth({
              officeId,
              yearMonth: currentYearMonth,
              calcDate,
              employees: employees as Employee[],
              calculatedByUserId: currentUser.uid
            });

            // 保存後にハッシュを更新
            this.lastAutoCalcHashByYearMonth.set(currentYearMonth, currentHash);

            // 再計算後に再度取得
            const updatedPremiums: MonthlyPremium[] = await firstValueFrom(
              this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, currentYearMonth)
            );
            const updatedValidPremiums = updatedPremiums.filter((premium) =>
              employeeMap.has(premium.employeeId)
            );

            // 更新されたデータでサマリーを計算
            const healthCareEmployee = updatedValidPremiums.reduce(
              (sum, p) => sum + (p.healthCareEmployee ?? 0),
              0
            );
            const healthCareFull = updatedValidPremiums.reduce((sum, p) => sum + (p.healthCareFull ?? 0), 0);
            const healthCareFullRounded = Math.round(healthCareFull * 100) / 100;
            const healthCareFullRoundedDown = Math.floor(healthCareFullRounded);
            const healthCareEmployer = healthCareFullRoundedDown - healthCareEmployee;

            const pensionEmployee = updatedValidPremiums.reduce(
              (sum, p) => sum + (p.pensionEmployee ?? 0),
              0
            );
            const pensionFull = updatedValidPremiums.reduce((sum, p) => sum + (p.pensionFull ?? 0), 0);
            const pensionFullRounded = Math.round(pensionFull * 100) / 100;
            const pensionFullRoundedDown = Math.floor(pensionFullRounded);
            const pensionEmployer = pensionFullRoundedDown - pensionEmployee;

            const monthlyTotalEmployer = healthCareEmployer + pensionEmployer;

            // 今月の賞与保険料を計算
            const [year, month] = currentYearMonth.split('-').map(Number);
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 1);
            const monthBonuses = bonusPremiums.filter((b) => {
              const payDate = new Date(b.payDate);
              return payDate >= monthStart && payDate < monthEnd;
            });

            // 自動再計算の判定と実行（賞与保険料）
            await this.ensureBonusPremiumCalculated(officeId, currentYearMonth, employees, office, bonusPremiums);

            const bonusTotalEmployer = await this.calculateBonusPremiumEmployerTotal(
              monthBonuses,
              employeeMap,
              office,
              currentYearMonth
            );

            // 月次保険料と賞与保険料の合計
            const totalEmployer = monthlyTotalEmployer + bonusTotalEmployer;
            this.currentMonthTotalEmployer.set(totalEmployer);
          }
        } catch (error) {
          console.error('保険料の自動再計算に失敗しました', error);
          // エラー時は既存データで計算を続行
        } finally {
          this.autoCalcInProgressByYearMonth.set(currentYearMonth, false);
        }
      } else {
        // 自動再計算が不要な場合は既存データで計算
      const healthCareEmployee = validPremiums.reduce((sum, p) => sum + (p.healthCareEmployee ?? 0), 0);
      const healthCareFull = validPremiums.reduce((sum, p) => sum + (p.healthCareFull ?? 0), 0);
      const healthCareFullRounded = Math.round(healthCareFull * 100) / 100;
      const healthCareFullRoundedDown = Math.floor(healthCareFullRounded);
      const healthCareEmployer = healthCareFullRoundedDown - healthCareEmployee;

      const pensionEmployee = validPremiums.reduce((sum, p) => sum + (p.pensionEmployee ?? 0), 0);
      const pensionFull = validPremiums.reduce((sum, p) => sum + (p.pensionFull ?? 0), 0);
      const pensionFullRounded = Math.round(pensionFull * 100) / 100;
      const pensionFullRoundedDown = Math.floor(pensionFullRounded);
      const pensionEmployer = pensionFullRoundedDown - pensionEmployee;

      const monthlyTotalEmployer = healthCareEmployer + pensionEmployer;

      // 今月の賞与保険料を計算
      const [year, month] = currentYearMonth.split('-').map(Number);
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 1);
      const monthBonuses = bonusPremiums.filter((b) => {
        const payDate = new Date(b.payDate);
        return payDate >= monthStart && payDate < monthEnd;
      });

      // 自動再計算の判定と実行（賞与保険料）
      await this.ensureBonusPremiumCalculated(officeId, currentYearMonth, employees, office, bonusPremiums);

      const bonusTotalEmployer = await this.calculateBonusPremiumEmployerTotal(
        monthBonuses,
        employeeMap,
        office,
        currentYearMonth
      );

      // 月次保険料と賞与保険料の合計
      const totalEmployer = monthlyTotalEmployer + bonusTotalEmployer;
      this.currentMonthTotalEmployer.set(totalEmployer);
      }
    } catch (error) {
      console.error('保険料の集計に失敗しました', error);
      this.currentMonthTotalEmployer.set(null);
    }
  }

  /**
   * 月次保険料の会社負担額を計算（月次保険料ページと同じロジック）
   */
  private calculateMonthlyPremiumEmployerTotal(
    premiums: MonthlyPremium[],
    employeeMap: Map<string, Employee>
  ): number {
    // 削除された従業員の保険料を除外
    const validPremiums = premiums.filter((premium) => employeeMap.has(premium.employeeId));

    // 健康・介護保険の会社負担
    const healthCareEmployee = validPremiums.reduce((sum, p) => sum + (p.healthCareEmployee ?? 0), 0);
    const healthCareFull = validPremiums.reduce((sum, p) => sum + (p.healthCareFull ?? 0), 0);
    const healthCareFullRounded = Math.round(healthCareFull * 100) / 100;
    const healthCareFullRoundedDown = Math.floor(healthCareFullRounded);
    const healthCareEmployer = healthCareFullRoundedDown - healthCareEmployee;

    // 厚生年金の会社負担
    const pensionEmployee = validPremiums.reduce((sum, p) => sum + (p.pensionEmployee ?? 0), 0);
    const pensionFull = validPremiums.reduce((sum, p) => sum + (p.pensionFull ?? 0), 0);
    const pensionFullRounded = Math.round(pensionFull * 100) / 100;
    const pensionFullRoundedDown = Math.floor(pensionFullRounded);
    const pensionEmployer = pensionFullRoundedDown - pensionEmployee;

    // 総合計の会社負担額
    return healthCareEmployer + pensionEmployer;
  }

  /**
   * 賞与保険料の会社負担額を計算（賞与保険料ページと同じロジック）
   * 保険資格のチェックと料率を使った再計算を行う
   */
  private async calculateBonusPremiumEmployerTotal(
    bonuses: BonusPremium[],
    employeeMap: Map<string, Employee>,
    office: Office,
    yearMonth: YearMonthString
  ): Promise<number> {
    // 料率を取得
    const rates = await this.mastersService.getRatesForYearMonth(office, yearMonth);
    if (rates.healthRate == null || rates.pensionRate == null) {
      return 0;
    }

    // 賞与保険料ページと同じフィルタリングと計算ロジック
    const validBonuses = bonuses.filter((b) => {
      const employee = employeeMap.get(b.employeeId);
      if (!employee) return false;
      const hasHealth = hasInsuranceInMonth(employee, yearMonth, 'health');
      const hasPension = hasInsuranceInMonth(employee, yearMonth, 'pension');
      return (hasHealth && b.healthEffectiveAmount > 0) || (hasPension && b.pensionEffectiveAmount > 0);
    });

    let totalHealthCareFull = 0;
    let totalHealthCareEmployee = 0;
    let totalPensionFull = 0;
    let totalPensionEmployee = 0;

    for (const b of validBonuses) {
      const employee = employeeMap.get(b.employeeId);
      if (!employee) continue;

      const hasHealth = hasInsuranceInMonth(employee, yearMonth, 'health');
      const hasPension = hasInsuranceInMonth(employee, yearMonth, 'pension');

      // 健康保険＋介護保険の計算（賞与保険料ページと同じ）
      if (hasHealth && b.healthEffectiveAmount > 0) {
        const isCareTarget = isCareInsuranceTarget(employee.birthDate, yearMonth);
        const careRate = isCareTarget && rates.careRate ? rates.careRate : 0;
        const combinedRate = (rates.healthRate ?? 0) + careRate;
        const healthCareFull = b.healthEffectiveAmount * combinedRate;
        const healthCareEmployee = roundForEmployeeDeduction(healthCareFull / 2);
        totalHealthCareFull += healthCareFull;
        totalHealthCareEmployee += healthCareEmployee;
      }

      // 厚生年金の計算（賞与保険料ページと同じ）
      if (hasPension && b.pensionEffectiveAmount > 0) {
        const pensionFull = b.pensionEffectiveAmount * (rates.pensionRate ?? 0);
        const pensionEmployee = roundForEmployeeDeduction(pensionFull / 2);
        totalPensionFull += pensionFull;
        totalPensionEmployee += pensionEmployee;
      }
    }

    // 端数処理（賞与保険料ページのサマリー計算と同じ）
    const healthCareFullRounded = Math.round(totalHealthCareFull * 100) / 100;
    const healthCareFullRoundedDown = Math.floor(healthCareFullRounded);
    const healthCareEmployer = healthCareFullRoundedDown - totalHealthCareEmployee;

    const pensionFullRounded = Math.round(totalPensionFull * 100) / 100;
    const pensionFullRoundedDown = Math.floor(pensionFullRounded);
    const pensionEmployer = pensionFullRoundedDown - totalPensionEmployee;

    // 総合計の会社負担額
    return healthCareEmployer + pensionEmployer;
  }

  private async loadMonthlyTrendData(
    officeId: string,
    employees: Employee[],
    office: Office | null,
    employeeMap: Map<string, Employee>
  ): Promise<void> {
    try {
      const now = new Date();
      const yearMonths: string[] = [];
      const totals: number[] = [];

      if (!office) {
        this.monthlyTrendData.set({ labels: [], datasets: [] });
        return;
      }

      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yearMonth = this.buildYearMonth(date);
        yearMonths.push(yearMonth);

        // 自動再計算の判定と実行
        await this.ensureMonthlyPremiumCalculated(officeId, yearMonth, employees, office, employeeMap);

        const premiums = await firstValueFrom(
          this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)
        );
        const total = this.calculateMonthlyPremiumEmployerTotal(premiums, employeeMap);
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

  /**
   * 指定年月の賞与保険料が最新かどうかを確認し、必要に応じて自動再計算を実行
   */
  private async ensureBonusPremiumCalculated(
    officeId: string,
    yearMonth: YearMonthString,
    employees: Employee[],
    office: Office,
    bonusPremiums: BonusPremium[]
  ): Promise<void> {
    try {
      // 料率を取得
      const rates = await this.mastersService.getRatesForYearMonth(office, yearMonth);
      if (rates.healthRate == null || rates.pensionRate == null) {
        return;
      }

      // 対象年月に賞与がある従業員を抽出
      const employeesWithBonuses = new Set(
        bonusPremiums
          .filter((b) => b.payDate.substring(0, 7) === yearMonth)
          .map((b) => b.employeeId)
      );
      const targetEmployees = employees.filter((e) => employeesWithBonuses.has(e.id));

      if (targetEmployees.length === 0) {
        return;
      }

      // 自動再計算の判定（賞与保険料ページと同じロジック）
      const employeesHash = JSON.stringify(
        targetEmployees
          .map((e) => ({
            id: e.id,
            isInsured: e.isInsured ?? false,
            healthQualificationDate: e.healthQualificationDate ?? null,
            healthLossDate: e.healthLossDate ?? null,
            pensionQualificationDate: e.pensionQualificationDate ?? null,
            pensionLossDate: e.pensionLossDate ?? null,
            birthDate: e.birthDate ?? null
          }))
          .sort((a, b) => a.id.localeCompare(b.id))
      );
      const ratesHash = JSON.stringify({
        healthRate: rates.healthRate,
        careRate: rates.careRate,
        pensionRate: rates.pensionRate
      });
      const currentHash = `${employeesHash}|${ratesHash}`;

      const lastHash = this.lastAutoCalcHashByYearMonthForBonus.get(yearMonth);
      const isAutoCalcInProgress = this.autoCalcInProgressByYearMonthForBonus.get(yearMonth) ?? false;
      const needsAutoCalc = !isAutoCalcInProgress && lastHash !== currentHash;

      // 自動再計算が必要な場合は実行
      if (needsAutoCalc) {
        this.autoCalcInProgressByYearMonthForBonus.set(yearMonth, true);
        try {
          // 対象年月に賞与がある従業員のみ再計算
          for (const employee of targetEmployees) {
            await this.bonusPremiumsService.recalculateForEmployeeMonth(
              office,
              employee,
              yearMonth
            );
          }

          // 保存後にハッシュを更新
          this.lastAutoCalcHashByYearMonthForBonus.set(yearMonth, currentHash);
        } catch (error) {
          console.error(`賞与保険料自動再計算に失敗 (${yearMonth})`, error);
        } finally {
          this.autoCalcInProgressByYearMonthForBonus.set(yearMonth, false);
        }
      }
    } catch (error) {
      console.error(`賞与保険料自動再計算の確認に失敗 (${yearMonth})`, error);
    }
  }

  /**
   * 指定年月の月次保険料が最新かどうかを確認し、必要に応じて自動再計算を実行
   */
  private async ensureMonthlyPremiumCalculated(
    officeId: string,
    yearMonth: YearMonthString,
    employees: Employee[],
    office: Office,
    employeeMap: Map<string, Employee>
  ): Promise<void> {
    try {
      // 料率を取得
      const rates = await this.mastersService.getRatesForYearMonth(office, yearMonth);
      if (rates.healthRate == null || rates.pensionRate == null) {
        return;
      }

      // 月次保険料を取得
      const premiums: MonthlyPremium[] = await firstValueFrom(
        this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)
      );

      // 削除された従業員の保険料を除外
      const validPremiums = premiums.filter((premium) => employeeMap.has(premium.employeeId));

      // 自動再計算の判定（月次保険料ページと同じロジック）
      const employeesHash = JSON.stringify(
        employees
          .map((e) => ({
            id: e.id,
            isInsured: e.isInsured ?? false,
            healthQualificationDate: e.healthQualificationDate ?? null,
            healthLossDate: e.healthLossDate ?? null,
            pensionQualificationDate: e.pensionQualificationDate ?? null,
            pensionLossDate: e.pensionLossDate ?? null,
            exemptionKindForYm:
              e.premiumExemptionMonths?.find((x) => x.yearMonth === yearMonth)?.kind ?? null,
            healthStandardMonthly: e.healthStandardMonthly ?? null,
            healthGrade: e.healthGrade ?? null,
            pensionStandardMonthly: e.pensionStandardMonthly ?? null,
            pensionGrade: e.pensionGrade ?? null,
            birthDate: e.birthDate ?? null
          }))
          .sort((a, b) => a.id.localeCompare(b.id))
      );
      const ratesHash = JSON.stringify({
        healthRate: rates.healthRate,
        careRate: rates.careRate,
        pensionRate: rates.pensionRate
      });
      const currentHash = `${employeesHash}|${ratesHash}`;

      const lastHash = this.lastAutoCalcHashByYearMonth.get(yearMonth);
      const isAutoCalcInProgress = this.autoCalcInProgressByYearMonth.get(yearMonth) ?? false;
      const needsAutoCalc =
        !isAutoCalcInProgress &&
        (validPremiums.length === 0 || lastHash !== currentHash);

      // 自動再計算が必要な場合は実行
      if (needsAutoCalc && employees.length > 0) {
        this.autoCalcInProgressByYearMonth.set(yearMonth, true);
        try {
          const currentUser = this.auth.currentUser;
          if (currentUser) {
            const calcDate = new Date().toISOString();
            await this.monthlyPremiumsService.saveForMonth({
              officeId,
              yearMonth,
              calcDate,
              employees: employees as Employee[],
              calculatedByUserId: currentUser.uid
            });

            // 保存後にハッシュを更新
            this.lastAutoCalcHashByYearMonth.set(yearMonth, currentHash);
          }
        } catch (error) {
          console.error(`月次保険料の自動再計算に失敗しました (${yearMonth}):`, error);
        } finally {
          this.autoCalcInProgressByYearMonth.set(yearMonth, false);
        }
      }
    } catch (error) {
      console.error(`月次保険料の確認に失敗しました (${yearMonth}):`, error);
    }
  }

  /**
   * ローカル時刻で年月文字列を生成（UTC問題を回避）
   */
  private buildYearMonth(d = new Date()): YearMonthString {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` as YearMonthString;
  }

  private async loadCurrentMonthComparisonData(
    officeId: string,
    employees: Employee[],
    office: Office | null,
    employeeMap: Map<string, Employee>,
    bonusPremiums: BonusPremium[]
  ): Promise<void> {
    try {
      const now = new Date();
      const currentYearMonth = this.buildYearMonth(now);
      
      // 先月の年月を計算（ローカル時刻で計算）
      const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousYearMonth = this.buildYearMonth(previousMonthDate);

      if (!office) {
        this.currentMonthComparisonData.set({ labels: [], datasets: [] });
        return;
      }

      const monthlyTotals: number[] = [];
      const bonusTotals: number[] = [];

      // 先月と今月の両方を計算
      for (const yearMonth of [previousYearMonth, currentYearMonth]) {
        // 自動再計算の判定と実行（月次保険料）
        await this.ensureMonthlyPremiumCalculated(officeId, yearMonth, employees, office, employeeMap);

        // 月次保険料を取得
        const monthlyPremiums = await firstValueFrom(
          this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)
        );
        const monthlyTotal = this.calculateMonthlyPremiumEmployerTotal(monthlyPremiums, employeeMap);
        monthlyTotals.push(monthlyTotal);

        // 自動再計算の判定と実行（賞与保険料）
        await this.ensureBonusPremiumCalculated(officeId, yearMonth, employees, office, bonusPremiums);
        
        // 賞与保険料を取得（フィルタリング）
        const [year, month] = yearMonth.split('-').map(Number);
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 1);
        const monthBonuses = bonusPremiums.filter((b) => {
          const payDate = new Date(b.payDate);
          return payDate >= monthStart && payDate < monthEnd;
        });
        
        const bonusTotal = await this.calculateBonusPremiumEmployerTotal(
          monthBonuses,
          employeeMap,
          office,
          yearMonth
        );
        bonusTotals.push(bonusTotal);
      }

      this.currentMonthComparisonData.set({
        labels: ['先月', '今月'],
        datasets: [
          {
            label: '月次保険料',
            data: monthlyTotals,
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            categoryPercentage: 0.65,
            barPercentage: 0.65,
            maxBarThickness: 40
          },
          {
            label: '賞与保険料',
            data: bonusTotals,
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            categoryPercentage: 0.65,
            barPercentage: 0.65,
            maxBarThickness: 40
          }
        ]
      });
    } catch (error) {
      console.error('先月・今月の比較データの取得に失敗しました', error);
      this.currentMonthComparisonData.set({ labels: [], datasets: [] });
    }
  }

  private async loadFiscalYearComparisonData(
    officeId: string,
    employees: Employee[],
    office: Office | null,
    employeeMap: Map<string, Employee>,
    allBonusPremiums: BonusPremium[]
  ): Promise<void> {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentFiscalYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      const previousFiscalYear = currentFiscalYear - 1;

      const fiscalYears = [`${previousFiscalYear}年度`, `${currentFiscalYear}年度`];
      const monthlyTotals: number[] = [];
      const bonusTotals: number[] = [];

      if (!office) {
        this.fiscalYearComparisonData.set({ labels: [], datasets: [] });
        return;
      }

      const currentYearMonth = this.buildYearMonth(now);

      for (const fiscalYear of [previousFiscalYear, currentFiscalYear]) {
        let monthlyTotal = 0;
        for (let i = 0; i < 12; i++) {
          const date = new Date(fiscalYear, 3 + i, 1);
          const yearMonth = this.buildYearMonth(date);
          
          // 未来の月は計算しない（現在の年月まで）
          if (yearMonth > currentYearMonth) {
            break;
          }
          
          // 自動再計算の判定と実行
          await this.ensureMonthlyPremiumCalculated(officeId, yearMonth, employees, office, employeeMap);

          const premiums = await firstValueFrom(
            this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)
          );
          monthlyTotal += this.calculateMonthlyPremiumEmployerTotal(premiums, employeeMap);
        }
        monthlyTotals.push(monthlyTotal);

        const fiscalYearStart = new Date(fiscalYear, 3, 1);
        const fiscalYearEnd = new Date(fiscalYear + 1, 3, 1);
        const fiscalYearBonuses = allBonusPremiums.filter((b) => {
          const payDate = new Date(b.payDate);
          return payDate >= fiscalYearStart && payDate < fiscalYearEnd;
        });

        // 年度内の各月について賞与保険料を計算して合計
        let bonusTotal = 0;
        for (let i = 0; i < 12; i++) {
          const date = new Date(fiscalYear, 3 + i, 1);
          const yearMonth = this.buildYearMonth(date);
          
          // 未来の月は計算しない（現在の年月まで）
          if (yearMonth > currentYearMonth) {
            break;
          }
          
          // 自動再計算の判定と実行（賞与保険料）
          await this.ensureBonusPremiumCalculated(officeId, yearMonth, employees, office, allBonusPremiums);
          
          // 賞与保険料はリアルタイムリスナーで自動更新されるため、再取得は不要
          // フィルタリングのみ実行
          const monthBonuses = allBonusPremiums.filter((b) => {
            const payDateYearMonth = b.payDate.substring(0, 7) as YearMonthString;
            return payDateYearMonth === yearMonth;
          });
          bonusTotal += await this.calculateBonusPremiumEmployerTotal(
            monthBonuses,
            employeeMap,
            office,
            yearMonth
          );
        }
        bonusTotals.push(bonusTotal);
      }

      this.fiscalYearComparisonData.set({
        labels: fiscalYears,
        datasets: [
          {
            label: '月次保険料',
            data: monthlyTotals,
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            categoryPercentage: 0.65,
            barPercentage: 0.65,
            maxBarThickness: 40
          },
          {
            label: '賞与保険料',
            data: bonusTotals,
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            categoryPercentage: 0.65,
            barPercentage: 0.65,
            maxBarThickness: 40
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

  navigateToProcedures(deadline: 'thisWeek' | 'overdue' | 'nextWeek'): void {
    this.router.navigate(['/procedures'], { queryParams: { deadline } });
  }

  navigateToDataQuality(): void {
    this.router.navigate(['/data-quality']);
  }
}
