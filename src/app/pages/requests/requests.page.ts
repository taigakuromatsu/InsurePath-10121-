import { AsyncPipe, DatePipe, NgIf } from '@angular/common';
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
import { ChangeRequest, ChangeRequestStatus, Employee } from '../../types';
import { RejectReasonDialogComponent } from './reject-reason-dialog.component';
import {
  getChangeRequestKindLabel,
  getChangeRequestStatusLabel,
  getDependentRelationshipLabel
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
    DatePipe
  ],
  template: `
    <section class="page">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>pending_actions</mat-icon>
          </div>
          <div class="header-text">
            <h1>変更申請一覧</h1>
            <p>従業員からのプロフィール変更申請を承認・却下できます。</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="card-header">
          <h2>申請一覧</h2>
          <mat-form-field appearance="outline" class="status-filter">
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
            <table mat-table [dataSource]="requests" class="requests-table">
              <ng-container matColumnDef="requestedAt">
                <th mat-header-cell *matHeaderCellDef>申請日時</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.requestedAt | date: 'yyyy-MM-dd HH:mm' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="employee">
                <th mat-header-cell *matHeaderCellDef>申請者</th>
                <td mat-cell *matCellDef="let row">{{ row.employeeName }}</td>
              </ng-container>

              <ng-container matColumnDef="kind">
                <th mat-header-cell *matHeaderCellDef>申請種別</th>
                <td mat-cell *matCellDef="let row">{{ getKindLabel(row.kind) }}</td>
              </ng-container>

              <ng-container matColumnDef="field">
                <th mat-header-cell *matHeaderCellDef>変更項目</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.kind === 'profile' ? getFieldLabel(row.field) : '-' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="target">
                <th mat-header-cell *matHeaderCellDef>対象被扶養者</th>
                <td mat-cell *matCellDef="let row">{{ getTargetDependentLabel(row) }}</td>
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
    </section>
  `,
  styles: [
    `
      .header-card {
        margin-bottom: 1rem;
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .header-icon {
        width: 56px;
        height: 56px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: #e0e7ff;
        color: #4338ca;
      }

      .header-text h1 {
        margin: 0;
        font-size: 1.5rem;
      }

      .header-text p {
        margin: 0;
        color: #4b5563;
      }

      .content-card {
        padding: 1.5rem;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .status-filter {
        width: 240px;
      }

      .table-container {
        border: 1px solid #e5e7eb;
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
      }

      .actions-header,
      .actions-cell {
        text-align: right;
      }

      .actions-cell button {
        margin-left: 0.5rem;
      }

      .empty-state {
        text-align: center;
        padding: 2rem 1rem;
        color: #6b7280;
      }

      .empty-state mat-icon {
        display: block;
        margin: 0 auto 0.5rem;
        color: #9ca3af;
      }

      .status-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
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

      @media (max-width: 768px) {
        .card-header {
          flex-direction: column;
          align-items: flex-start;
        }

        .status-filter {
          width: 100%;
        }

        .actions-cell {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
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
        status === 'all' ? undefined : status
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
        employeeName: employees.get(request.employeeId)?.name ?? '不明'
      }))
    )
  );

  getFieldLabel(field: ChangeRequest['field']): string {
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

  getTargetDependentLabel(request: ChangeRequest): string {
    if (request.kind === 'profile') {
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
    switch (request.field) {
      case 'postalCode':
        return { postalCode: request.requestedValue };
      case 'address':
        return { address: request.requestedValue };
      case 'phone':
        return { phone: request.requestedValue };
      case 'contactEmail':
      case 'email':
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

    const employee = await firstValueFrom(this.employeesService.get(officeId, request.employeeId));
    if (!employee) {
      throw new Error('従業員が見つかりませんでした');
    }

    const updateData = this.buildUpdateData(request);

    await this.employeesService.save(officeId, {
      ...employee,
      ...updateData,
      updatedByUserId: currentUserId
    });

    await this.changeRequestsService.approve(officeId, request.id, currentUserId);
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
