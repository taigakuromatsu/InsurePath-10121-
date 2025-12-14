import { AsyncPipe, DecimalPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { firstValueFrom, of, switchMap } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { PaymentsService } from '../../services/payments.service';
import { PaymentMethod, PaymentStatus, SocialInsurancePayment } from '../../types';
import { PaymentFormDialogComponent } from './payment-form-dialog.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog.component';

@Component({
  selector: 'ip-payments-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    AsyncPipe,
    NgIf,
    DecimalPipe
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div>
            <h1>社会保険料納付状況管理</h1>
          <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">
            事業所ごと・対象年月ごとの社会保険料の納付状況を登録して管理できます。
          </p>
        </div>
      </header>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center mb-4 flex-wrap gap-2">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">account_balance</mat-icon> 納付状況一覧
            </h2>
            <p class="mat-body-2" style="color: #666">対象年月ごとの予定額・納付額・ステータスを確認できます。</p>
          </div>
          <button mat-flat-button color="primary" (click)="openCreateDialog()">
            <mat-icon>add</mat-icon>
            納付状況を登録
          </button>
        </div>

        <ng-container *ngIf="payments$ | async as payments; else loading">
          <div *ngIf="payments.length > 0; else empty" class="table-container">
            <table mat-table [dataSource]="payments" class="admin-table">
              <ng-container matColumnDef="targetYearMonth">
                <th mat-header-cell *matHeaderCellDef>対象年月</th>
                <td mat-cell *matCellDef="let row">{{ row.targetYearMonth }}</td>
              </ng-container>

              <ng-container matColumnDef="plannedTotalCompany">
                <th mat-header-cell *matHeaderCellDef>予定合計</th>
                <td mat-cell *matCellDef="let row">¥{{ row.plannedTotalCompany | number }}</td>
              </ng-container>

              <ng-container matColumnDef="actualTotalCompany">
                <th mat-header-cell *matHeaderCellDef>納付額合計</th>
                <td mat-cell *matCellDef="let row">
                  <ng-container *ngIf="row.actualTotalCompany != null; else notInput">
                    ¥{{ row.actualTotalCompany | number }}
                  </ng-container>
                  <ng-template #notInput>未入力</ng-template>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>ステータス</th>
                <td mat-cell *matCellDef="let row">
                  <span [class]="'status-badge status-' + row.paymentStatus">
                    {{ getPaymentStatusLabel(row.paymentStatus) }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="paymentDate">
                <th mat-header-cell *matHeaderCellDef>納付日</th>
                <td mat-cell *matCellDef="let row">{{ row.paymentDate || '未入力' }}</td>
              </ng-container>

              <ng-container matColumnDef="paymentMethod">
                <th mat-header-cell *matHeaderCellDef>納付方法</th>
                <td mat-cell *matCellDef="let row">
                  <ng-container *ngIf="row.paymentMethod; else noMethod">
                    {{ getPaymentMethodLabel(row.paymentMethod!) }}
                    <ng-container *ngIf="row.paymentMethod === 'other' && row.paymentMethodNote">
                      （{{ row.paymentMethodNote }}）
                    </ng-container>
                  </ng-container>
                  <ng-template #noMethod>未入力</ng-template>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-header">アクション</th>
                <td mat-cell *matCellDef="let row" class="actions-cell">
                  <button mat-stroked-button color="primary" (click)="openEditDialog(row)">
                    <mat-icon>edit</mat-icon>
                    編集
                  </button>
                  <button mat-stroked-button color="warn" (click)="deletePayment(row)">
                    <mat-icon>delete</mat-icon>
                    削除
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
              <p>納付状況が登録されていません</p>
            </div>
          </ng-template>
        </ng-container>

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

      .table-container {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
        background: #fff;
      }

      .actions-header,
      .actions-cell {
        text-align: center;
      }

      .actions-cell {
        display: flex;
        gap: 8px;
        justify-content: center;
      }

      .actions-cell button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .status-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.85rem;
        font-weight: 600;
        color: white;
        white-space: nowrap;
      }

      .status-unpaid { background: #ef4444; }
      .status-paid { background: #22c55e; }
      .status-partially_paid { background: #f59e0b; }
      .status-not_required { background: #9ca3af; }

      .empty-state {
        display: grid;
        place-items: center;
        gap: 8px;
        padding: 48px 24px;
        color: #666;
      }

      .empty-state mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        opacity: 0.5;
      }

      @media (max-width: 768px) {
        .actions-cell {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }
      }
    `
  ]
})
export class PaymentsPage {
  private readonly paymentsService = inject(PaymentsService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly dialog = inject(MatDialog);
  private readonly currentUser = inject(CurrentUserService);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = [
    'targetYearMonth',
    'plannedTotalCompany',
    'actualTotalCompany',
    'status',
    'paymentDate',
    'paymentMethod',
    'actions'
  ];

  readonly payments$ = this.currentOffice.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) {
        return of<SocialInsurancePayment[]>([]);
      }
      return this.paymentsService.listByOffice(officeId);
    })
  );

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

  getPaymentMethodLabel(method: PaymentMethod): string {
    switch (method) {
      case 'bank_transfer':
        return '銀行振込';
      case 'account_transfer':
        return '口座振替';
      case 'cash':
        return '現金';
      default:
        return 'その他';
    }
  }

  async openCreateDialog(): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    this.dialog.open(PaymentFormDialogComponent, {
      width: '720px',
      data: { officeId }
    });
  }

  async openEditDialog(payment: SocialInsurancePayment): Promise<void> {
    const profile = await firstValueFrom(this.currentUser.profile$);
    if (!profile?.officeId) return;

    const dialogRef = this.dialog.open(PaymentFormDialogComponent, {
      width: '720px',
      data: { officeId: profile.officeId, payment }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // 編集後に一覧を再読み込み（payments$は自動的に更新される）
      }
    });
  }

  async deletePayment(payment: SocialInsurancePayment): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: '納付状況を削除しますか？',
        message: `対象年月「${payment.targetYearMonth}」の納付状況を削除します。この操作は取り消せません。`,
        confirmLabel: '削除',
        cancelLabel: 'キャンセル'
      }
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

    try {
      await this.paymentsService.delete(officeId, payment.targetYearMonth);
      this.snackBar.open('納付状況を削除しました', undefined, { duration: 2500 });
      // payments$は自動的に更新される（Observableのため）
    } catch (error) {
      console.error('納付状況の削除に失敗しました', error);
      this.snackBar.open('削除に失敗しました。時間をおいて再度お試しください。', undefined, {
        duration: 3000
      });
    }
  }
}
