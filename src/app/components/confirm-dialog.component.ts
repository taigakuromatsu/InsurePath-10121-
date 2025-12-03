import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

@Component({
  selector: 'ip-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h1 mat-dialog-title>{{ data.title }}</h1>
    <div mat-dialog-content>
      <p>{{ data.message }}</p>
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
