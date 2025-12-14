import {
  AsyncPipe,
  DatePipe,
  NgIf,
  NgSwitch,
  NgSwitchCase,
  NgSwitchDefault
} from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { BehaviorSubject, combineLatest, firstValueFrom, map, of, switchMap } from 'rxjs';

import { ChangeRequestsService } from '../../services/change-requests.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { EmployeesService } from '../../services/employees.service';
import { DependentsService } from '../../services/dependents.service';
import {
  ChangeRequest,
  ChangeRequestStatus,
  DependentAddPayload,
  DependentUpdatePayload,
  Employee,
  BankAccount,
  BankAccountChangePayload
} from '../../types';
import { RejectReasonDialogComponent } from './reject-reason-dialog.component';
import {
  getChangeRequestKindLabel,
  getChangeRequestStatusLabel,
  getDependentRelationshipLabel,
  getBankAccountTypeLabel
} from '../../utils/label-utils';

@Component({
  selector: 'ip-requests-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDialogModule,
    AsyncPipe,
    NgIf,
    NgSwitch,
    NgSwitchCase,
    NgSwitchDefault,
    DatePipe
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div>
            <h1>変更申請一覧</h1>
          <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">
            従業員からのプロフィール・口座情報・扶養家族変更申請を承認・却下できます。
          </p>
        </div>
      </header>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center mb-4 flex-wrap gap-2">
          <h2 class="mat-h2 mb-0 flex-row align-center gap-2">
            <mat-icon color="primary">pending_actions</mat-icon> 申請一覧
          </h2>
          <mat-form-field appearance="outline" class="status-filter dense-form-field">
            <mat-label>ステータス</mat-label>
            <mat-select
              [value]="selectedStatus$.value"
              (selectionChange)="selectedStatus$.next($event.value)"
            >
              <mat-option value="all">すべて</mat-option>
              <mat-option value="pending">承認待ち</mat-option>
              <mat-option value="approved">承認済み</mat-option>
              <mat-option value="rejected">却下済み</mat-option>
              <mat-option value="canceled">取り下げ</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div *ngIf="requestsWithEmployee$ | async as requests; else loading">
          <div class="table-container" *ngIf="requests.length > 0; else empty">
            <table mat-table [dataSource]="requests" class="admin-table">
              <ng-container matColumnDef="requestedAt">
                <th mat-header-cell *matHeaderCellDef>申請日時</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.requestedAt | date: 'yyyy-MM-dd HH:mm' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="employee">
                <th mat-header-cell *matHeaderCellDef class="nowrap">申請者</th>
                <td mat-cell *matCellDef="let row" class="nowrap">{{ row.employeeName }}</td>
              </ng-container>

              <ng-container matColumnDef="kind">
                <th mat-header-cell *matHeaderCellDef class="nowrap">申請種別</th>
                <td mat-cell *matCellDef="let row" class="nowrap">{{ getKindLabel(row.kind) }}</td>
              </ng-container>

              <ng-container matColumnDef="field">
                <th mat-header-cell *matHeaderCellDef class="nowrap">変更項目</th>
                <td mat-cell *matCellDef="let row" class="nowrap">
                  {{
                    row.kind === 'profile'
                      ? getFieldLabel(row.field)
                      : row.kind === 'bankAccount'
                        ? '口座情報'
                        : '-'
                  }}
                </td>
              </ng-container>

              <ng-container matColumnDef="target">
                <th mat-header-cell *matHeaderCellDef>対象被扶養者</th>
                <td mat-cell *matCellDef="let row">{{ getTargetDependentLabel(row) }}</td>
              </ng-container>

              <ng-container matColumnDef="currentValue">
                <th mat-header-cell *matHeaderCellDef>現在の値</th>
                <td mat-cell *matCellDef="let row">
                  <ng-container [ngSwitch]="row.kind">
                    <ng-container *ngSwitchCase="'bankAccount'">
                      <div class="bank-account-info" *ngIf="getCurrentBankAccount(row) as bankAccount; else noCurrent">
                        <div><strong>金融機関名:</strong> {{ bankAccount.bankName }}</div>
                        <div *ngIf="bankAccount.bankCode"><strong>金融機関コード:</strong> {{ bankAccount.bankCode }}</div>
                        <div><strong>支店名:</strong> {{ bankAccount.branchName }}</div>
                        <div *ngIf="bankAccount.branchCode"><strong>支店コード:</strong> {{ bankAccount.branchCode }}</div>
                        <div><strong>口座種別:</strong> {{ getBankAccountTypeLabel(bankAccount.accountType) }}</div>
                        <div><strong>口座番号:</strong> {{ bankAccount.accountNumber }}</div>
                        <div><strong>名義:</strong> {{ bankAccount.accountHolderName }}</div>
                        <div *ngIf="bankAccount.accountHolderKana"><strong>名義カナ:</strong> {{ bankAccount.accountHolderKana }}</div>
                      </div>
                      <ng-template #noCurrent>未登録</ng-template>
                    </ng-container>
                    <ng-container *ngSwitchDefault>
                      {{ row.currentValue || '-' }}
                    </ng-container>
                  </ng-container>
                </td>
              </ng-container>

              <ng-container matColumnDef="requestedValue">
                <th mat-header-cell *matHeaderCellDef>申請する値</th>
              <td mat-cell *matCellDef="let row">
                <ng-container [ngSwitch]="row.kind">
                  <ng-container *ngSwitchCase="'bankAccount'">
                    <div class="bank-account-info" *ngIf="getBankAccountPayload(row) as payload; else noPayload">
                      <div><strong>金融機関名:</strong> {{ payload.bankName }}</div>
                      <div *ngIf="payload.bankCode"><strong>金融機関コード:</strong> {{ payload.bankCode }}</div>
                      <div><strong>支店名:</strong> {{ payload.branchName }}</div>
                      <div *ngIf="payload.branchCode"><strong>支店コード:</strong> {{ payload.branchCode }}</div>
                      <div><strong>口座種別:</strong> {{ getBankAccountTypeLabel(payload.accountType) }}</div>
                      <div><strong>口座番号:</strong> {{ payload.accountNumber }}</div>
                      <div><strong>名義:</strong> {{ payload.accountHolderName }}</div>
                      <div *ngIf="payload.accountHolderKana"><strong>名義カナ:</strong> {{ payload.accountHolderKana }}</div>
                    </div>
                    <ng-template #noPayload>-</ng-template>
                  </ng-container>
                  <ng-container *ngSwitchDefault>
                    {{ row.requestedValue }}
                  </ng-container>
                </ng-container>
              </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef class="nowrap">ステータス</th>
                <td mat-cell *matCellDef="let row" class="nowrap">
                  <span [class]="'status-chip status-' + row.status">
                    {{ getStatusLabel(row.status) }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-header">アクション</th>
                <td mat-cell *matCellDef="let row" class="actions-cell">
                  <button
                    mat-stroked-button
                    color="primary"
                    (click)="approve(row)"
                    [disabled]="row.status !== 'pending'"
                  >
                    <mat-icon>check</mat-icon>
                    承認
                  </button>
                  <button
                    mat-stroked-button
                    color="warn"
                    (click)="reject(row)"
                    [disabled]="row.status !== 'pending'"
                  >
                    <mat-icon>close</mat-icon>
                    却下
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
          <ng-template #empty>
            <div class="empty-state">
              <mat-icon>inbox</mat-icon>
              <p>対象の申請はありません。</p>
            </div>
          </ng-template>
        </div>

        <ng-template #loading>
          <div class="empty-state">
            <mat-icon>hourglass_empty</mat-icon>
            <p>読み込み中...</p>
          </div>
        </ng-template>
      </mat-card>
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

      /* ユーティリティ */
      .mb-0 { margin-bottom: 0; }
      .mb-2 { margin-bottom: 8px; }
      .mb-3 { margin-bottom: 16px; }
      .mb-4 { margin-bottom: 24px; }
      .mr-2 { margin-right: 8px; }
      .gap-2 { gap: 8px; }
      .gap-3 { gap: 16px; }
      .flex-row { display: flex; flex-direction: row; }
      .align-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .flex-wrap { flex-wrap: wrap; }
      .dense-form-field { font-size: 14px; min-width: 200px; }

      .status-filter {
        min-width: 200px;
      }

      .nowrap { white-space: nowrap; }

      .table-container {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
        background: #fff;
      }

      .actions-header,
      .actions-cell {
        text-align: right;
      }

      .actions-cell button {
        margin-left: 8px;
      }

      .empty-state {
        text-align: center;
        padding: 48px 24px;
        color: #6b7280;
      }

      .empty-state mat-icon {
        display: block;
        margin: 0 auto 8px;
        color: #9ca3af;
        opacity: 0.5;
      }

      .status-chip {
        display: inline-flex;
        align-items: center;
        padding: 2px 10px;
        border-radius: 9999px;
        font-size: 0.875rem;
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

      .status-canceled {
        background: #f3f4f6;
        color: #4b5563;
      }

      .bank-account-info {
        font-size: 0.875rem;
        line-height: 1.6;
      }

      .bank-account-info div {
        margin-bottom: 4px;
      }

      .bank-account-info div:last-child {
        margin-bottom: 0;
      }

      .bank-account-info strong {
        color: #666;
        font-weight: 500;
        margin-right: 4px;
      }

      @media (max-width: 768px) {
        .actions-cell {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .actions-cell button {
          margin-left: 0;
        }
      }
    `
  ]
})
export class RequestsPage {
  private readonly changeRequestsService = inject(ChangeRequestsService);
  private readonly employeesService = inject(EmployeesService);
  private readonly dependentsService = inject(DependentsService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly dialog = inject(MatDialog);

  readonly displayedColumns = [
    'requestedAt',
    'employee',
    'kind',
    'field',
    'target',
    'currentValue',
    'requestedValue',
    'status',
    'actions'
  ];

  readonly selectedStatus$ = new BehaviorSubject<ChangeRequestStatus | 'all'>('pending');

  private readonly requests$ = combineLatest([
    this.currentOffice.officeId$,
    this.selectedStatus$
  ]).pipe(
    switchMap(([officeId, status]) => {
      if (!officeId) return of([] as ChangeRequest[]);
      return this.changeRequestsService.list(
        officeId,
        status === 'all' ? undefined : status,
        200 // 申請管理ページは200件まで表示
      );
    })
  );

  private readonly employeesMap$ = this.currentOffice.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) return of([] as Employee[]);
      return this.employeesService.list(officeId);
    }),
    map((employees) => new Map(employees.map((emp) => [emp.id, emp])))
  );

  readonly requestsWithEmployee$ = combineLatest([
    this.requests$,
    this.employeesMap$
  ]).pipe(
    map(([requests, employees]) =>
      requests.map((request) => ({
        ...request,
        employee: employees.get(request.employeeId),
        employeeName: employees.get(request.employeeId)?.name ?? '不明'
      }))
    )
  );

  getFieldLabel(field: ChangeRequest['field'] | undefined): string {
    switch (field) {
      case 'postalCode':
        return '郵便番号';
      case 'address':
        return '住所';
      case 'phone':
        return '電話番号';
      case 'contactEmail':
        return '連絡先メール';
      case 'kana':
        return 'カナ';
      case 'other':
        return 'その他';
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

  protected readonly getBankAccountTypeLabel = getBankAccountTypeLabel;

  getTargetDependentLabel(request: ChangeRequest): string {
    if (request.kind === 'profile' || request.kind === 'bankAccount') {
      return '-';
    }

    const payload = request.payload as
      | { name?: string; relationship?: string }
      | { dependentName?: string; relationship?: string }
      | undefined;

    const name = (payload as any)?.name ?? (payload as any)?.dependentName;
    const relationship = (payload as any)?.relationship;

    if (!name) {
      return '-';
    }

    const relationshipLabel = relationship
      ? `（${getDependentRelationshipLabel(relationship as any)}）`
      : '';

    return `${name}${relationshipLabel}`;
  }

  private buildUpdateData(request: ChangeRequest): Partial<Employee> {
    // 既存データとの互換性: 'email' を 'contactEmail' に正規化
    // request.field が 'email' の場合（レガシーデータ）も 'contactEmail' として扱う
    const field = (request.field as string) === 'email' ? 'contactEmail' : request.field;

    switch (field) {
      case 'postalCode':
        return { postalCode: request.requestedValue };
      case 'address':
        return { address: request.requestedValue };
      case 'phone':
        return { phone: request.requestedValue };
      case 'contactEmail':
        return { contactEmail: request.requestedValue };
      case 'kana':
        return { kana: request.requestedValue };
      default:
        return {};
    }
  }

  async approve(request: ChangeRequest): Promise<void> {
    const currentUserId = await firstValueFrom(
      this.currentUser.profile$.pipe(map((profile) => profile?.id ?? null))
    );

    if (!currentUserId) {
      throw new Error('ユーザーIDが取得できませんでした');
    }

    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    // プロフィール変更申請の場合
    if (request.kind === 'profile') {
      const employee = await firstValueFrom(
        this.employeesService.get(officeId, request.employeeId)
      );
      if (!employee) {
        throw new Error('従業員が見つかりませんでした');
      }

      const updateData = this.buildUpdateData(request);

      await this.employeesService.save(officeId, {
        ...employee,
        ...updateData,
        updatedByUserId: currentUserId
      });
    }
    // 扶養家族追加申請の場合
    else if (request.kind === 'dependent_add') {
      const payload = request.payload as DependentAddPayload;
      if (!payload) {
        throw new Error('申請データが見つかりませんでした');
      }

      // 注意: DependentAddPayload には isWorking が含まれるが、Dependent 型には存在しないため、
      // DependentsService.save() では isWorking は無視される（申請時に収集する情報として扱う）
      await this.dependentsService.save(officeId, request.employeeId, {
        name: payload.name,
        kana: payload.kana,
        relationship: payload.relationship,
        dateOfBirth: payload.dateOfBirth,
        sex: payload.sex,
        postalCode: payload.postalCode,
        address: payload.address,
        cohabitationFlag: payload.cohabitationFlag
        // isWorking は Dependent 型に存在しないため、ここでは含めない
      });
    }
    // 扶養家族変更申請の場合
    else if (request.kind === 'dependent_update') {
      const payload = request.payload as DependentUpdatePayload;
      if (!payload || !request.targetDependentId) {
        throw new Error('申請データが見つかりませんでした');
      }

      await this.dependentsService.save(officeId, request.employeeId, {
        id: request.targetDependentId,
        name: payload.name,
        kana: payload.kana,
        relationship: payload.relationship,
        dateOfBirth: payload.dateOfBirth,
        sex: payload.sex,
        postalCode: payload.postalCode,
        address: payload.address,
        cohabitationFlag: payload.cohabitationFlag
        // isWorking は Dependent 型に存在しないため、ここでは含めない
      });
    }
    // 扶養家族削除申請の場合
    else if (request.kind === 'dependent_remove') {
      if (!request.targetDependentId) {
        throw new Error('削除対象の被扶養者IDが見つかりませんでした');
      }

      // ハードデリートで実装
      await this.dependentsService.delete(officeId, request.employeeId, request.targetDependentId);
    }
    // 口座情報変更申請の場合
    else if (request.kind === 'bankAccount') {
      const payload = request.payload as BankAccountChangePayload | undefined;
      if (!payload) {
        throw new Error('申請データが見つかりませんでした');
      }

      const employee = await firstValueFrom(
        this.employeesService.get(officeId, request.employeeId)
      );
      if (!employee) {
        throw new Error('従業員が見つかりませんでした');
      }

      await this.employeesService.save(officeId, {
        ...employee,
        bankAccount: {
          ...payload,
          updatedAt: new Date().toISOString(),
          updatedByUserId: currentUserId
        },
        updatedByUserId: currentUserId
      });
    }

    // ChangeRequest の status を更新（既存の ChangeRequestsService.approve() を使用）
    await this.changeRequestsService.approve(officeId, request.id, currentUserId);
  }

  getBankAccountPayload(request: ChangeRequest): BankAccountChangePayload | null {
    if (request.kind !== 'bankAccount') return null;
    return (request.payload as BankAccountChangePayload) ?? null;
  }

  getCurrentBankAccount(request: ChangeRequest): BankAccount | null {
    if (request.kind !== 'bankAccount') return null;
    const employee = (request as any).employee as Employee | undefined;
    return employee?.bankAccount ?? null;
  }

  async reject(request: ChangeRequest): Promise<void> {
    const dialogRef = this.dialog.open(RejectReasonDialogComponent, {
      width: '500px',
      data: { request }
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) return;

    const currentUserId = await firstValueFrom(
      this.currentUser.profile$.pipe(map((profile) => profile?.id ?? null))
    );

    if (!currentUserId) {
      throw new Error('ユーザーIDが取得できませんでした');
    }

    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    await this.changeRequestsService.reject(officeId, request.id, currentUserId, result.reason);
  }
}
