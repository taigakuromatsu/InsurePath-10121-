import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule, DecimalPipe } from '@angular/common';
import { InsuranceKind, YearMonthString } from '../../types';

export interface StandardRewardHistoryAddConfirmDialogData {
  insuranceKind: InsuranceKind;
  appliedFromYearMonth: YearMonthString;
  grade: number | null;
  standardMonthlyReward: number;
}

@Component({
  selector: 'ip-standard-reward-history-add-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, CommonModule, DecimalPipe],
  template: `
    <h1 mat-dialog-title>標準報酬履歴に追加しますか？</h1>
    <div mat-dialog-content>
      <p class="description">
        追加した履歴が、保険料計算で使用されます。
      </p>
      <div class="preview-section">
        <h3 class="preview-title">追加内容</h3>
        <table class="preview-table">
          <tr>
            <th>保険種別</th>
            <td>{{ data.insuranceKind === 'health' ? '健康保険' : '厚生年金' }}</td>
          </tr>
          <tr>
            <th>適用開始年月</th>
            <td>{{ data.appliedFromYearMonth }}</td>
          </tr>
          <tr>
            <th>等級</th>
            <td>{{ data.grade ?? '-' }}</td>
          </tr>
          <tr>
            <th>標準報酬月額</th>
            <td class="amount">{{ data.standardMonthlyReward | number }} 円</td>
          </tr>
        </table>
      </div>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button (click)="onCancel()">キャンセル</button>
      <button mat-flat-button color="primary" (click)="onConfirm()">履歴に追加</button>
    </div>
  `,
  styles: [
    `
      h1[mat-dialog-title] {
        margin: 0;
        padding: 24px 24px 16px;
        font-size: 1.25rem;
        font-weight: 600;
        color: #333;
        line-height: 1.4;
      }

      div[mat-dialog-content] {
        margin: 0;
        padding: 0 24px 24px;
        overflow: visible;
        min-width: 400px;
      }

      .description {
        margin: 0 0 16px 0;
        line-height: 1.6;
        color: rgba(0, 0, 0, 0.87);
        font-size: 0.95rem;
      }

      .preview-section {
        margin-top: 16px;
        padding: 16px;
        background-color: #f5f5f5;
        border-radius: 4px;
      }

      .preview-title {
        margin: 0 0 12px 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #333;
      }

      .preview-table {
        width: 100%;
        border-collapse: collapse;
      }

      .preview-table th {
        text-align: left;
        padding: 8px 12px 8px 0;
        font-weight: 500;
        color: #666;
        font-size: 0.875rem;
        width: 140px;
      }

      .preview-table td {
        padding: 8px 0;
        color: #333;
        font-size: 0.95rem;
      }

      .preview-table .amount {
        font-weight: 600;
        color: #1976d2;
      }

      div[mat-dialog-actions] {
        padding: 8px 24px 24px;
        margin: 0;
        gap: 12px;
        min-height: auto;
      }
    `
  ]
})
export class StandardRewardHistoryAddConfirmDialogComponent {
  constructor(
    public readonly dialogRef: MatDialogRef<StandardRewardHistoryAddConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: StandardRewardHistoryAddConfirmDialogData
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}

