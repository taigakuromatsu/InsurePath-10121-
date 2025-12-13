import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

export interface ConfirmDialogData {
  title: string;
  message: string;
  warningMessage?: string; // 警告メッセージ（強調表示用）
  confirmLabel?: string;
  cancelLabel?: string;
}

@Component({
  selector: 'ip-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, CommonModule],
  template: `
    <h1 mat-dialog-title>{{ data.title }}</h1>
    <div mat-dialog-content>
      <p>{{ data.message }}</p>
      <div class="warning-message" *ngIf="data.warningMessage">
        <p>{{ data.warningMessage }}</p>
      </div>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button (click)="onCancel()">
        {{ data.cancelLabel || 'キャンセル' }}
      </button>
      <button mat-flat-button color="warn" (click)="onConfirm()">
        {{ data.confirmLabel || 'OK' }}
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
        overflow: visible; /* 短いテキストでの不要なスクロールバーを防止 */
        min-width: 360px; /* 極端に狭くならないように */
      }

      div[mat-dialog-content] p {
        margin: 0;
        line-height: 1.6;
        color: rgba(0, 0, 0, 0.87);
        font-size: 1rem;
      }

      .warning-message {
        margin-top: 16px;
        padding: 12px 16px;
        background-color: #fff3cd;
        border-left: 4px solid #ff9800;
        border-radius: 4px;
      }

      .warning-message p {
        margin: 0;
        line-height: 1.6;
        color: #856404;
        font-size: 0.95rem;
        font-weight: 500;
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
export class ConfirmDialogComponent {
  constructor(
    public readonly dialogRef: MatDialogRef<ConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: ConfirmDialogData
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
