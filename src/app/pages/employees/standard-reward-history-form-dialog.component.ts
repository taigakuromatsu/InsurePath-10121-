import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgFor, NgIf } from '@angular/common';

import { InsuranceKind, StandardRewardDecisionKind, StandardRewardHistory } from '../../types';
import { getStandardRewardDecisionKindLabel } from '../../utils/label-utils';

export interface StandardRewardHistoryFormDialogData {
  officeId: string;
  employeeId: string;
  history?: StandardRewardHistory;
}

@Component({
  selector: 'ip-standard-reward-history-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    NgIf,
    NgFor
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">{{ data.history ? 'edit' : 'add' }}</mat-icon>
      {{ data.history ? '標準報酬履歴を編集' : '標準報酬履歴を追加' }}
    </h1>

    <form class="dense-form" [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>保険種別 *</mat-label>
        <mat-select formControlName="insuranceKind" required>
          <mat-option value="health">健康保険</mat-option>
          <mat-option value="pension">厚生年金</mat-option>
        </mat-select>
        <mat-error *ngIf="form.controls.insuranceKind.hasError('required')">
          保険種別を選択してください
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>適用開始年月 *</mat-label>
        <input
          matInput
          formControlName="appliedFromYearMonth"
          type="month"
          required
          placeholder="YYYY-MM"
        />
        <mat-error *ngIf="form.controls.appliedFromYearMonth.hasError('required')">
          適用開始年月を入力してください
        </mat-error>
        <mat-error *ngIf="form.controls.appliedFromYearMonth.hasError('pattern')">
          YYYY-MM 形式で入力してください
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>標準報酬月額 *</mat-label>
        <input matInput formControlName="standardMonthlyReward" type="number" required />
        <mat-error *ngIf="form.controls.standardMonthlyReward.hasError('required')">
          標準報酬月額を入力してください
        </mat-error>
        <mat-error *ngIf="form.controls.standardMonthlyReward.hasError('min')">
          0以上の数値を入力してください
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>決定区分 *</mat-label>
        <mat-select formControlName="decisionKind" required>
          <mat-option *ngFor="let kind of decisionKinds" [value]="kind">
            {{ getStandardRewardDecisionKindLabel(kind) }}
          </mat-option>
        </mat-select>
        <mat-error *ngIf="form.controls.decisionKind.hasError('required')">
          決定区分を選択してください
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>メモ（任意）</mat-label>
        <textarea matInput formControlName="note" rows="3"></textarea>
        <mat-hint align="end">
          {{ form.controls.note.value.length || 0 }}/1000
        </mat-hint>
      </mat-form-field>
    </form>

    <div mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
        キャンセル
      </button>
      <button mat-flat-button color="primary" (click)="submit()" [disabled]="form.invalid">
        <mat-icon>save</mat-icon>
        保存
      </button>
    </div>
  `,
  styles: [
    `
      .dialog-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 16px 16px 12px;
        border-bottom: 1px solid #e0e0e0;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px 16px;
      }

      .full-width {
        width: 100%;
      }

      .dialog-actions {
        padding: 12px 16px 16px;
        border-top: 1px solid #e0e0e0;
        background: #fafafa;
      }

      .dialog-actions button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
    `
  ]
})
export class StandardRewardHistoryFormDialogComponent {
  private readonly fb = inject(FormBuilder);

  protected readonly decisionKinds: StandardRewardDecisionKind[] = [
    'regular',
    'interim',
    'bonus',
    'qualification',
    'loss',
    'other'
  ];

  readonly form = this.fb.nonNullable.group({
    insuranceKind: ['health' as InsuranceKind, Validators.required],
    appliedFromYearMonth: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}$/)]],
    standardMonthlyReward: [0, [Validators.required, Validators.min(0)]],
    decisionKind: ['', Validators.required],
    note: ['', Validators.maxLength(1000)]
  });

  constructor(
    public readonly dialogRef: MatDialogRef<StandardRewardHistoryFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: StandardRewardHistoryFormDialogData
  ) {
    if (data.history) {
      this.form.patchValue({
        insuranceKind: data.history.insuranceKind,
        appliedFromYearMonth: data.history.appliedFromYearMonth,
        standardMonthlyReward: data.history.standardMonthlyReward,
        decisionKind: data.history.decisionKind,
        note: data.history.note ?? ''
      });
    }
  }

  protected readonly getStandardRewardDecisionKindLabel =
    getStandardRewardDecisionKindLabel;

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    const payload: Partial<StandardRewardHistory> & { id?: string } = {
      id: this.data.history?.id,
      insuranceKind: value.insuranceKind,
      appliedFromYearMonth: value.appliedFromYearMonth,
      standardMonthlyReward: Number(value.standardMonthlyReward),
      decisionKind: value.decisionKind as StandardRewardDecisionKind,
      note: value.note?.trim() || undefined,
      createdAt: this.data.history?.createdAt,
      createdByUserId: this.data.history?.createdByUserId
    };

    this.dialogRef.close(payload);
  }
}
