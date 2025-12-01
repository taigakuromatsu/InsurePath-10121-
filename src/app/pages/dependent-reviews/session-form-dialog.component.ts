import { Component, inject } from '@angular/core';
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
}

@Component({
  selector: 'ip-session-form-dialog',
  standalone: true,
  imports: [
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
      {{ data.session ? '扶養状況確認セッションを編集' : '扶養状況確認セッションを作成' }}
    </h1>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <div mat-dialog-content class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>基準年月日</mat-label>
          <input matInput type="date" formControlName="referenceDate" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>実施日</mat-label>
          <input matInput type="date" formControlName="checkedAt" />
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

      <div mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>キャンセル</button>
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
}
