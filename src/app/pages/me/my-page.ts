import { AsyncPipe, DatePipe, DecimalPipe, NgForOf, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { combineLatest, map, of, switchMap } from 'rxjs';

import { BonusPremiumsService } from '../../services/bonus-premiums.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { EmployeesService } from '../../services/employees.service';
import { MonthlyPremiumsService } from '../../services/monthly-premiums.service';
import { BonusPremium, MonthlyPremium } from '../../types';

@Component({
  selector: 'ip-my-page',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatTableModule, AsyncPipe, NgIf, NgForOf, DatePipe, DecimalPipe],
  template: `
    <section class="page my-page">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>person</mat-icon>
          </div>
          <div class="header-text">
            <h1>マイページ</h1>
            <p>自分の社員情報と保険料明細を確認できます</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="page-header">
          <h2>
            <mat-icon>info</mat-icon>
            基本情報
          </h2>
        </div>

        <ng-container *ngIf="employee$ | async as employee; else noEmployee">
          <div class="info-grid">
            <div class="info-item">
              <span class="label">氏名</span>
              <span class="value">{{ employee.name }}</span>
            </div>
            <div class="info-item">
              <span class="label">所属部署</span>
              <span class="value">{{ employee.department || '未設定' }}</span>
            </div>
            <div class="info-item">
              <span class="label">入社日</span>
              <span class="value">{{ employee.hireDate | date: 'yyyy-MM-dd' }}</span>
            </div>
            <div class="info-item">
              <span class="label">健康保険 等級 / 標準報酬月額</span>
              <span class="value">
                {{ employee.healthGrade ? '等級 ' + employee.healthGrade : '未設定' }}
                <ng-container *ngIf="employee.healthStandardMonthly != null">/ {{ employee.healthStandardMonthly | number }} 円</ng-container>
              </span>
            </div>
            <div class="info-item">
              <span class="label">厚生年金 等級 / 標準報酬月額</span>
              <span class="value">
                {{ employee.pensionGrade ? '等級 ' + employee.pensionGrade : '未設定' }}
                <ng-container *ngIf="employee.pensionStandardMonthly != null">/ {{ employee.pensionStandardMonthly | number }} 円</ng-container>
              </span>
            </div>
            <div class="info-item">
              <span class="label">社会保険加入状況</span>
              <span class="value" [class.inactive]="!employee.isInsured">
                {{ employee.isInsured ? '加入中' : '未加入' }}
              </span>
            </div>
          </div>
        </ng-container>

        <ng-template #noEmployee>
          <div class="empty-state">
            <mat-icon>person_off</mat-icon>
            <p>従業員として登録されていないため、マイページ情報は表示されません。</p>
          </div>
        </ng-template>
      </mat-card>

      <mat-card class="content-card">
        <div class="page-header">
          <h2>
            <mat-icon>account_balance_wallet</mat-icon>
            月次保険料
          </h2>
        </div>

        <ng-container *ngIf="monthlyPremiums$ | async as premiums">
          <div class="table-container" *ngIf="premiums.length > 0; else noMonthlyPremiums">
            <table mat-table [dataSource]="premiums" class="premium-table">
              <ng-container matColumnDef="yearMonth">
                <th mat-header-cell *matHeaderCellDef>年月</th>
                <td mat-cell *matCellDef="let row">{{ row.yearMonth }}</td>
              </ng-container>

              <ng-container matColumnDef="healthEmployee">
                <th mat-header-cell *matHeaderCellDef>健康保険 本人</th>
                <td mat-cell *matCellDef="let row">{{ row.healthEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="healthEmployer">
                <th mat-header-cell *matHeaderCellDef>健康保険 会社</th>
                <td mat-cell *matCellDef="let row">{{ row.healthEmployer | number }}</td>
              </ng-container>

              <ng-container matColumnDef="careEmployee">
                <th mat-header-cell *matHeaderCellDef>介護保険 本人</th>
                <td mat-cell *matCellDef="let row">{{ row.careEmployee != null ? (row.careEmployee | number) : '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="careEmployer">
                <th mat-header-cell *matHeaderCellDef>介護保険 会社</th>
                <td mat-cell *matCellDef="let row">{{ row.careEmployer != null ? (row.careEmployer | number) : '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="pensionEmployee">
                <th mat-header-cell *matHeaderCellDef>厚生年金 本人</th>
                <td mat-cell *matCellDef="let row">{{ row.pensionEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="pensionEmployer">
                <th mat-header-cell *matHeaderCellDef>厚生年金 会社</th>
                <td mat-cell *matCellDef="let row">{{ row.pensionEmployer | number }}</td>
              </ng-container>

              <ng-container matColumnDef="totalEmployee">
                <th mat-header-cell *matHeaderCellDef>本人合計</th>
                <td mat-cell *matCellDef="let row">{{ row.totalEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="totalEmployer">
                <th mat-header-cell *matHeaderCellDef>会社合計</th>
                <td mat-cell *matCellDef="let row">{{ row.totalEmployer | number }}</td>
              </ng-container>

              <tr
                mat-header-row
                *matHeaderRowDef="premiumDisplayedColumns"
                class="table-header-row"
              ></tr>
              <tr mat-row *matRowDef="let row; columns: premiumDisplayedColumns" class="table-row"></tr>
            </table>
          </div>

          <ng-template #noMonthlyPremiums>
            <div class="empty-state">
              <mat-icon>pending_actions</mat-icon>
              <p>まだ計算された月次保険料はありません。</p>
            </div>
          </ng-template>
        </ng-container>
      </mat-card>

      <mat-card class="content-card">
        <div class="page-header">
          <h2>
            <mat-icon>workspace_premium</mat-icon>
            賞与保険料
          </h2>
        </div>

        <ng-container *ngIf="bonusPremiums$ | async as bonuses">
          <div class="table-container" *ngIf="bonuses.length > 0; else noBonusPremiums">
            <table mat-table [dataSource]="bonuses" class="bonus-table">
              <ng-container matColumnDef="payDate">
                <th mat-header-cell *matHeaderCellDef>支給日</th>
                <td mat-cell *matCellDef="let row">{{ row.payDate | date: 'yyyy-MM-dd' }}</td>
              </ng-container>

              <ng-container matColumnDef="grossAmount">
                <th mat-header-cell *matHeaderCellDef>賞与支給額</th>
                <td mat-cell *matCellDef="let row">{{ row.grossAmount | number }}</td>
              </ng-container>

              <ng-container matColumnDef="standardBonusAmount">
                <th mat-header-cell *matHeaderCellDef>標準賞与額</th>
                <td mat-cell *matCellDef="let row">{{ row.standardBonusAmount | number }}</td>
              </ng-container>

              <ng-container matColumnDef="healthEmployee">
                <th mat-header-cell *matHeaderCellDef>健康保険 本人</th>
                <td mat-cell *matCellDef="let row">{{ row.healthEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="healthEmployer">
                <th mat-header-cell *matHeaderCellDef>健康保険 会社</th>
                <td mat-cell *matCellDef="let row">{{ row.healthEmployer | number }}</td>
              </ng-container>

              <ng-container matColumnDef="pensionEmployee">
                <th mat-header-cell *matHeaderCellDef>厚生年金 本人</th>
                <td mat-cell *matCellDef="let row">{{ row.pensionEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="pensionEmployer">
                <th mat-header-cell *matHeaderCellDef>厚生年金 会社</th>
                <td mat-cell *matCellDef="let row">{{ row.pensionEmployer | number }}</td>
              </ng-container>

              <ng-container matColumnDef="totalEmployee">
                <th mat-header-cell *matHeaderCellDef>本人合計</th>
                <td mat-cell *matCellDef="let row">{{ row.totalEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="totalEmployer">
                <th mat-header-cell *matHeaderCellDef>会社合計</th>
                <td mat-cell *matCellDef="let row">{{ row.totalEmployer | number }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="bonusDisplayedColumns" class="table-header-row"></tr>
              <tr mat-row *matRowDef="let row; columns: bonusDisplayedColumns" class="table-row"></tr>
            </table>
          </div>

          <ng-template #noBonusPremiums>
            <div class="empty-state">
              <mat-icon>pending_actions</mat-icon>
              <p>まだ登録された賞与保険料はありません。</p>
            </div>
          </ng-template>
        </ng-container>
      </mat-card>

      <mat-card class="content-card">
        <div class="page-header">
          <h2>
            <mat-icon>description</mat-icon>
            申請状況
          </h2>
        </div>

        <div class="empty-state">
          <mat-icon>construction</mat-icon>
          <p>申請機能は今後実装予定です。</p>
        </div>
      </mat-card>
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
      }

      .content-card {
        margin-bottom: 1.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .page-header {
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid #e0e0e0;
      }

      .page-header h2 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #333;
      }

      .empty-state {
        text-align: center;
        padding: 2rem 1rem;
        color: #666;
      }

      .empty-state mat-icon {
        font-size: 48px;
        height: 48px;
        width: 48px;
        color: #9ca3af;
        margin-bottom: 0.5rem;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
      }

      .info-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .info-item .label {
        color: #6b7280;
        font-size: 0.9rem;
      }

      .info-item .value {
        font-weight: 600;
        color: #111827;
        font-size: 1.05rem;
      }

      .info-item .value.inactive {
        color: #ef4444;
      }

      .table-container {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
      }

      table {
        width: 100%;
      }

      th,
      td {
        padding: 12px 16px;
      }

      th {
        background: #f9fafb;
        color: #374151;
        font-weight: 700;
      }

      .table-row:hover {
        background: #f3f4f6;
      }

      @media (max-width: 768px) {
        .header-content {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `
  ]
})
export class MyPage {
  private readonly currentUser = inject(CurrentUserService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly employeesService = inject(EmployeesService);
  private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
  private readonly bonusPremiumsService = inject(BonusPremiumsService);

  readonly premiumDisplayedColumns = [
    'yearMonth',
    'healthEmployee',
    'healthEmployer',
    'careEmployee',
    'careEmployer',
    'pensionEmployee',
    'pensionEmployer',
    'totalEmployee',
    'totalEmployer'
  ];

  readonly bonusDisplayedColumns = [
    'payDate',
    'grossAmount',
    'standardBonusAmount',
    'healthEmployee',
    'healthEmployer',
    'pensionEmployee',
    'pensionEmployer',
    'totalEmployee',
    'totalEmployer'
  ];

  readonly employee$ = combineLatest([this.currentUser.profile$, this.currentOffice.officeId$]).pipe(
    switchMap(([profile, officeId]) => {
      if (!profile?.employeeId || !officeId) {
        return of(null);
      }

      return this.employeesService.list(officeId).pipe(
        map((employees) => employees.find((e) => e.id === profile.employeeId) ?? null)
      );
    })
  );

  readonly monthlyPremiums$ = combineLatest([this.currentUser.profile$, this.currentOffice.officeId$]).pipe(
    switchMap(([profile, officeId]) => {
      if (!profile?.employeeId || !officeId) {
        return of([] as MonthlyPremium[]);
      }

      return this.monthlyPremiumsService.listByOfficeAndEmployee(officeId, profile.employeeId);
    })
  );

  readonly bonusPremiums$ = combineLatest([this.currentUser.profile$, this.currentOffice.officeId$]).pipe(
    switchMap(([profile, officeId]) => {
      if (!profile?.employeeId || !officeId) {
        return of([] as BonusPremium[]);
      }

      return this.bonusPremiumsService.listByOfficeAndEmployee(officeId, profile.employeeId);
    })
  );
}
