import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { combineLatest, firstValueFrom, map, of, switchMap } from 'rxjs';

import { BonusPremiumsService } from '../../services/bonus-premiums.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { ChangeRequestsService } from '../../services/change-requests.service';
import { EmployeesService } from '../../services/employees.service';
import { MonthlyPremiumsService } from '../../services/monthly-premiums.service';
import {
  BonusPremium,
  ChangeRequest,
  ChangeRequestStatus,
  Dependent,
  MonthlyPremium
} from '../../types';
import { DependentsService } from '../../services/dependents.service';
import {
  getChangeRequestKindLabel,
  getChangeRequestStatusLabel,
  getDependentRelationshipLabel
} from '../../utils/label-utils';
import { ChangeRequestFormDialogComponent } from '../requests/change-request-form-dialog.component';

@Component({
  selector: 'ip-my-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatTableModule,
    AsyncPipe,
    NgIf,
    NgFor,
    DatePipe,
    DecimalPipe
  ],
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
            <mat-icon>family_restroom</mat-icon>
            扶養家族（閲覧のみ）
          </h2>
        </div>

        <ng-container *ngIf="dependents$ | async as dependents">
          <div class="dependents-empty" *ngIf="dependents.length === 0">
            <mat-icon>group_off</mat-icon>
            <p>扶養家族が登録されていません。</p>
          </div>

          <div class="dependents-grid" *ngIf="dependents.length > 0">
            <div class="dependent-card" *ngFor="let dependent of dependents">
              <div class="dependent-header">
                <div class="dependent-name">{{ dependent.name }}</div>
                <div class="dependent-relationship">
                  {{ getDependentRelationshipLabel(dependent.relationship) }}
                </div>
              </div>
              <div class="dependent-row">
                <span class="label">生年月日</span>
                <span class="value">{{ dependent.dateOfBirth }}</span>
              </div>
              <div class="dependent-row">
                <span class="label">資格取得日</span>
                <span class="value">{{ dependent.qualificationAcquiredDate || '-' }}</span>
              </div>
              <div class="dependent-row">
                <span class="label">資格喪失日</span>
                <span class="value">{{ dependent.qualificationLossDate || '-' }}</span>
              </div>
            </div>
          </div>
        </ng-container>
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
            <mat-icon>edit</mat-icon>
            申請・手続き
          </h2>
        </div>

        <div class="section-actions">
          <button
            mat-stroked-button
            color="primary"
            (click)="openChangeRequestDialog()"
            [disabled]="!(employee$ | async)"
          >
            <mat-icon>add</mat-icon>
            新しい申請を作成
          </button>
        </div>

        <ng-container *ngIf="myRequests$ | async as requests">
          <div class="table-container" *ngIf="requests.length > 0; else noChangeRequests">
            <table mat-table [dataSource]="requests" class="request-history-table">
              <ng-container matColumnDef="requestedAt">
                <th mat-header-cell *matHeaderCellDef>申請日時</th>
                <td mat-cell *matCellDef="let row">{{ row.requestedAt | date: 'yyyy-MM-dd HH:mm' }}</td>
              </ng-container>

              <ng-container matColumnDef="kind">
                <th mat-header-cell *matHeaderCellDef>申請種別</th>
                <td mat-cell *matCellDef="let row">{{ getKindLabel(row.kind) }}</td>
              </ng-container>

              <ng-container matColumnDef="field">
                <th mat-header-cell *matHeaderCellDef>変更項目</th>
                <td mat-cell *matCellDef="let row">{{ getFieldLabel(row.field) }}</td>
              </ng-container>

              <ng-container matColumnDef="currentValue">
                <th mat-header-cell *matHeaderCellDef>現在の値</th>
                <td mat-cell *matCellDef="let row">{{ row.currentValue || '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="requestedValue">
                <th mat-header-cell *matHeaderCellDef>申請する値</th>
                <td mat-cell *matCellDef="let row">{{ row.requestedValue }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>ステータス</th>
                <td mat-cell *matCellDef="let row">
                  <span [class]="'status-chip status-' + row.status">
                    {{ getStatusLabel(row.status) }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="rejectReason">
                <th mat-header-cell *matHeaderCellDef>却下理由</th>
                <td mat-cell *matCellDef="let row">
                  <span *ngIf="row.rejectReason; else noReason" class="reject-reason">
                    {{ row.rejectReason }}
                  </span>
                  <ng-template #noReason>-</ng-template>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let row">
                  <button
                    mat-stroked-button
                    color="warn"
                    *ngIf="row.status === 'pending'"
                    (click)="cancelRequest(row)"
                  >
                    取り下げ
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="requestHistoryColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: requestHistoryColumns"></tr>
            </table>
          </div>
        </ng-container>

        <ng-template #noChangeRequests>
          <div class="empty-state">
            <mat-icon>pending_actions</mat-icon>
            <p>申請履歴がありません。</p>
          </div>
        </ng-template>
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

      .dependents-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
      }

      .dependent-card {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 1rem;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }

      .dependent-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 0.5rem;
      }

      .dependent-name {
        font-weight: 700;
        color: #111827;
      }

      .dependent-relationship {
        color: #6b7280;
        font-size: 0.9rem;
      }

      .dependent-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.95rem;
        padding: 0.25rem 0;
      }

      .dependent-row .label {
        color: #6b7280;
      }

      .dependent-row .value {
        color: #111827;
        font-weight: 500;
      }

      .dependents-empty {
        text-align: center;
        padding: 1rem 0;
        color: #666;
      }

      .dependents-empty mat-icon {
        color: #9ca3af;
        display: block;
        margin: 0 auto 0.25rem;
      }

      .section-actions {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 1rem;
      }

      .request-history-table .status-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.85rem;
      }

      .status-pending {
        background: #fffbeb;
        color: #92400e;
      }

      .status-approved {
        background: #ecfdf3;
        color: #166534;
      }

      .status-rejected {
        background: #fef2f2;
        color: #991b1b;
      }

      .reject-reason {
        color: #991b1b;
        font-weight: 500;
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
  private readonly changeRequestsService = inject(ChangeRequestsService);
  private readonly employeesService = inject(EmployeesService);
  private readonly dependentsService = inject(DependentsService);
  private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
  private readonly bonusPremiumsService = inject(BonusPremiumsService);
  private readonly dialog = inject(MatDialog);

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

  readonly requestHistoryColumns = [
    'requestedAt',
    'kind',
    'field',
    'currentValue',
    'requestedValue',
    'status',
    'rejectReason',
    'actions'
  ];

  readonly employee$ = combineLatest([this.currentUser.profile$, this.currentOffice.officeId$]).pipe(
    switchMap(([profile, officeId]) => {
      if (!profile?.employeeId || !officeId) {
        return of(null);
      }

      return this.employeesService.get(officeId, profile.employeeId);
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

  readonly dependents$ = combineLatest([this.currentUser.profile$, this.currentOffice.officeId$]).pipe(
    switchMap(([profile, officeId]) => {
      if (!profile?.employeeId || !officeId) {
        return of([] as Dependent[]);
      }

      return this.dependentsService.list(officeId, profile.employeeId);
    })
  );

  readonly myRequests$ = combineLatest([this.currentOffice.officeId$, this.currentUser.profile$]).pipe(
    switchMap(([officeId, profile]) => {
      if (!officeId || !profile?.id) {
        return of([] as ChangeRequest[]);
      }

      return this.changeRequestsService.listForUser(officeId, profile.id);
    })
  );

  async openChangeRequestDialog(): Promise<void> {
    const [employee, officeId] = await Promise.all([
      firstValueFrom(this.employee$),
      firstValueFrom(this.currentOffice.officeId$)
    ]);

    if (!employee || !officeId) {
      return;
    }

    this.dialog.open(ChangeRequestFormDialogComponent, {
      width: '600px',
      data: { employee, officeId }
    });
  }

  getFieldLabel(field: ChangeRequest['field']): string {
    switch (field) {
      case 'address':
        return '住所';
      case 'phone':
        return '電話番号';
      case 'email':
        return 'メールアドレス';
      default:
        return field || '-';
    }
  }

  getKindLabel(kind: ChangeRequest['kind']): string {
    return getChangeRequestKindLabel(kind);
  }

  getStatusLabel(status: ChangeRequestStatus): string {
    return getChangeRequestStatusLabel(status);
  }

  async cancelRequest(request: ChangeRequest): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);

    if (!officeId || request.status !== 'pending') {
      return;
    }

    const confirmed = window.confirm('この申請を取り下げますか？');
    if (!confirmed) {
      return;
    }

    await this.changeRequestsService.cancel(officeId, request.id);
  }

  protected readonly getDependentRelationshipLabel = getDependentRelationshipLabel;
}
