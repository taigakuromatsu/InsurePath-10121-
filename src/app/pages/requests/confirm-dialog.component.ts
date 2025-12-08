import { Component, Inject, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'warn' | 'accent';
}

@Component({
  selector: 'ip-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h1 mat-dialog-title>
      <mat-icon class="mr-2">help_outline</mat-icon>
      {{ data.title || '確認' }}
    </h1>
    <div mat-dialog-content>
      <p>{{ data.message }}</p>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>{{ data.cancelText || 'キャンセル' }}</button>
      <button mat-flat-button [color]="data.confirmColor || 'primary'" (click)="confirm()">
        {{ data.confirmText || 'OK' }}
      </button>
    </div>
  `,
  styles: [
    `
      .mr-2 { margin-right: 8px; }
    `
  ]
})
export class ConfirmDialogComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  confirm(): void {
    this.dialogRef.close(true);
  }
}

