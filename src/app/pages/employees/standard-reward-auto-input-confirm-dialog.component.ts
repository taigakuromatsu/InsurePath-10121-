import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DecimalPipe, NgIf } from '@angular/common';

export interface StandardRewardAutoInputConfirmDialogData {
  salary: number;
  decisionYearMonth: string;
  healthGrade: number | null;
  healthStandardMonthly: number | null;
  pensionGrade: number | null;
  pensionStandardMonthly: number | null;
  healthError?: string | null;
  pensionError?: string | null;
}

export type StandardRewardAutoInputConfirmResult = 'add' | 'cancel';

@Component({
  selector: 'ip-standard-reward-auto-input-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, DecimalPipe, NgIf],
  template: `
    <h1 mat-dialog-title>標準報酬履歴の自動追加</h1>
    <div mat-dialog-content>
      <p class="message">
        報酬月額に基づいて、健康保険と厚生年金の標準報酬・等級をマスタから自動計算し、履歴に追加します。
      </p>

      <div class="info-section">
        <div class="info-row">
          <span class="label">報酬月額:</span>
          <span class="value">{{ data.salary | number }} 円</span>
        </div>
        <div class="info-row">
          <span class="label">適用開始年月:</span>
          <span class="value">{{ data.decisionYearMonth }}</span>
        </div>
      </div>

      <div class="result-section">
        <h3 class="section-title">履歴に追加される予定の値</h3>

        <div class="insurance-group">
          <h4 class="insurance-title">健康保険</h4>
          <ng-container *ngIf="data.healthError; else healthSuccess">
            <div class="error-message">
              <mat-icon>error</mat-icon>
              <span>{{ data.healthError }}</span>
            </div>
          </ng-container>
          <ng-template #healthSuccess>
            <div class="info-row" *ngIf="data.healthGrade != null && data.healthStandardMonthly != null">
              <span class="label">等級:</span>
              <span class="value">{{ data.healthGrade }}</span>
            </div>
            <div class="info-row" *ngIf="data.healthStandardMonthly != null">
              <span class="label">標準報酬月額:</span>
              <span class="value">{{ data.healthStandardMonthly | number }} 円</span>
            </div>
            <div class="info-row" *ngIf="data.healthGrade == null && data.healthStandardMonthly == null">
              <span class="value">履歴に追加できませんでした</span>
            </div>
          </ng-template>
        </div>

        <div class="insurance-group">
          <h4 class="insurance-title">厚生年金</h4>
          <ng-container *ngIf="data.pensionError; else pensionSuccess">
            <div class="error-message">
              <mat-icon>error</mat-icon>
              <span>{{ data.pensionError }}</span>
            </div>
          </ng-container>
          <ng-template #pensionSuccess>
            <div class="info-row" *ngIf="data.pensionGrade != null && data.pensionStandardMonthly != null">
              <span class="label">等級:</span>
              <span class="value">{{ data.pensionGrade }}</span>
            </div>
            <div class="info-row" *ngIf="data.pensionStandardMonthly != null">
              <span class="label">標準報酬月額:</span>
              <span class="value">{{ data.pensionStandardMonthly | number }} 円</span>
            </div>
            <div class="info-row" *ngIf="data.pensionGrade == null && data.pensionStandardMonthly == null">
              <span class="value">履歴に追加できませんでした</span>
            </div>
          </ng-template>
        </div>
      </div>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button (click)="onCancel()">キャンセル</button>
      <button
        mat-flat-button
        color="primary"
        (click)="onAdd()"
        [disabled]="!canAddHistory"
      >
        この内容で履歴を追加
      </button>
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
        min-width: 480px;
        max-width: 600px;
      }

      .message {
        margin: 0 0 20px 0;
        line-height: 1.6;
        color: rgba(0, 0, 0, 0.87);
        font-size: 1rem;
      }

      .info-section {
        background: #f5f5f5;
        border-radius: 4px;
        padding: 12px 16px;
        margin-bottom: 20px;
      }

      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .info-row:last-child {
        margin-bottom: 0;
      }

      .label {
        color: #666;
        font-weight: 500;
      }

      .value {
        color: #333;
        font-weight: 600;
      }

      .result-section {
        border-top: 1px solid #e0e0e0;
        padding-top: 16px;
      }

      .section-title {
        margin: 0 0 12px 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #333;
      }

      .insurance-group {
        background: #fafafa;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 12px 16px;
        margin-bottom: 12px;
      }

      .insurance-group:last-child {
        margin-bottom: 0;
      }

      .insurance-title {
        margin: 0 0 8px 0;
        font-size: 0.9rem;
        font-weight: 600;
        color: #1976d2;
      }

      .error-message {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #d32f2f;
        font-size: 0.9rem;
      }

      .error-message mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
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
export class StandardRewardAutoInputConfirmDialogComponent {
  constructor(
    public readonly dialogRef: MatDialogRef<
      StandardRewardAutoInputConfirmDialogComponent,
      StandardRewardAutoInputConfirmResult
    >,
    @Inject(MAT_DIALOG_DATA) public readonly data: StandardRewardAutoInputConfirmDialogData
  ) {}

  get canAddHistory(): boolean {
    // どちらか一方でもエラーがある場合は追加不可
    if (this.data.healthError || this.data.pensionError) {
      return false;
    }
    // どちらか一方でも値がある場合は追加可能
    return (
      (this.data.healthStandardMonthly != null && this.data.healthGrade != null) ||
      (this.data.pensionStandardMonthly != null && this.data.pensionGrade != null)
    );
  }

  onCancel(): void {
    this.dialogRef.close('cancel');
  }

  onAdd(): void {
    this.dialogRef.close('add');
  }
}

