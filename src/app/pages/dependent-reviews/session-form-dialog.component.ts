import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { DependentReviewSession } from '../../types';

export interface SessionFormDialogData {
  referenceDate?: string;
  session?: DependentReviewSession;
  canDelete?: boolean; // 削除可能かどうか（確認結果が紐づいていない場合のみtrue）
  reviewCount?: number; // 紐づく確認結果の数
}

@Component({
  selector: 'ip-session-form-dialog',
  standalone: true,
  imports: [
    NgIf,
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon>{{ data.session ? 'edit_calendar' : 'event_note' }}</mat-icon>
      {{ data.session ? '確認実施記録を編集' : '確認実施記録を作成' }}
    </h1>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <div mat-dialog-content class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>基準年月日</mat-label>
          <input matInput type="date" formControlName="referenceDate" min="1900-01-01" max="2100-12-31" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>実施日</mat-label>
          <input matInput type="date" formControlName="checkedAt" min="1900-01-01" max="2100-12-31" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>担当者</mat-label>
          <input matInput formControlName="checkedBy" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>備考</mat-label>
          <textarea matInput formControlName="note" rows="3" maxlength="500"></textarea>
        </mat-form-field>
      </div>

      <div mat-dialog-content *ngIf="data.session && data.reviewCount !== undefined && data.reviewCount > 0" class="delete-warning">
        <div class="warning-message">
          <mat-icon>warning</mat-icon>
          <div>
            <p class="warning-text">
              この確認実施記録には <strong>{{ data.reviewCount }}件</strong> の確認結果が紐づいています。
              確認結果が紐づいている確認実施記録は削除できません。
            </p>
          </div>
        </div>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>キャンセル</button>
        <button
          *ngIf="data.session"
          mat-stroked-button
          type="button"
          color="warn"
          [disabled]="!data.canDelete"
          (click)="deleteSession()"
        >
          <mat-icon>delete</mat-icon>
          削除
        </button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
          保存
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
      }

      .full-width {
        grid-column: 1 / -1;
      }

      .delete-warning {
        margin-top: 16px;
        padding: 0;
      }

      .warning-message {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 16px;
        background-color: #fff3cd;
        border-left: 4px solid #ffc107;
        border-radius: 4px;
        color: #856404;
      }

      .warning-message mat-icon {
        flex-shrink: 0;
        margin-top: 2px;
        color: #ffc107;
      }

      .warning-text {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
      }
    `
  ]
})
export class SessionFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<SessionFormDialogComponent>);

  readonly data = inject<SessionFormDialogData>(MAT_DIALOG_DATA);

  private readonly today = new Date().toISOString().substring(0, 10);

  form = this.fb.group({
    referenceDate: [
      this.data.session?.referenceDate || this.data.referenceDate || this.today,
      Validators.required
    ],
    checkedAt: [this.data.session?.checkedAt || this.today, Validators.required],
    checkedBy: [this.data.session?.checkedBy || ''],
    note: [this.data.session?.note || '']
  });

  submit(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.getRawValue());
  }

  deleteSession(): void {
    if (!this.data.canDelete) return;
    if (!confirm('この確認実施記録を削除しますか？\n\n削除後は元に戻せません。')) {
      return;
    }
    this.dialogRef.close({ delete: true });
  }
}
