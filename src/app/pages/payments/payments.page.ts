import { AsyncPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { firstValueFrom, of, switchMap } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { PaymentsService } from '../../services/payments.service';
import { PaymentMethod, PaymentStatus, SocialInsurancePayment } from '../../types';
import { PaymentFormDialogComponent } from './payment-form-dialog.component';

@Component({
  selector: 'ip-payments-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    AsyncPipe,
    NgIf,
    NgFor,
    DecimalPipe
  ],
  template: `
    <section class="page">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>account_balance</mat-icon>
          </div>
          <div class="header-text">
            <h1>社会保険料納付状況</h1>
            <p>事業所ごと・対象年月ごとの社会保険料の納付状況を管理できます。</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="card-header">
          <div>
            <h2>納付状況一覧</h2>
            <p class="subtitle">対象年月ごとの予定額・実績額・ステータスを確認できます。</p>
          </div>
          <button mat-flat-button color="primary" (click)="openCreateDialog()">
            <mat-icon>add</mat-icon>
            納付状況を登録
          </button>
        </div>

        <ng-container *ngIf="payments$ | async as payments; else loading">
          <div *ngIf="payments.length > 0; else empty" class="table-container">
            <table mat-table [dataSource]="payments" class="payments-table">
              <ng-container matColumnDef="targetYearMonth">
                <th mat-header-cell *matHeaderCellDef>対象年月</th>
                <td mat-cell *matCellDef="let row">{{ row.targetYearMonth }}</td>
              </ng-container>

              <ng-container matColumnDef="plannedTotalCompany">
                <th mat-header-cell *matHeaderCellDef>予定合計</th>
                <td mat-cell *matCellDef="let row">¥{{ row.plannedTotalCompany | number }}</td>
              </ng-container>

              <ng-container matColumnDef="actualTotalCompany">
                <th mat-header-cell *matHeaderCellDef>実績合計</th>
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
    </section>
  `,
  styles: [
    `
      .header-card {
        margin-bottom: 1.5rem;
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
        background: #e0f7fa;
        color: #006064;
      }

      .header-text h1 {
        margin: 0;
        font-size: 1.6rem;
      }

      .header-text p {
        margin: 0;
        color: #555;
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

      .subtitle {
        margin: 0.25rem 0 0 0;
        color: #666;
      }

      .table-container {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }

      table {
        width: 100%;
      }

      th.mat-header-cell {
        background: #f9fafb;
        font-weight: 600;
      }

      .actions-header,
      .actions-cell {
        text-align: center;
      }

      .actions-cell button {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
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

      .empty-state {
        display: grid;
        place-items: center;
        gap: 0.5rem;
        padding: 2rem 1rem;
        color: #666;
      }

      .empty-state mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
      }

      @media (max-width: 768px) {
        .card-header {
          flex-direction: column;
          align-items: flex-start;
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

    this.dialog.open(PaymentFormDialogComponent, {
      width: '720px',
      data: { officeId: profile.officeId, payment }
    });
  }
}
