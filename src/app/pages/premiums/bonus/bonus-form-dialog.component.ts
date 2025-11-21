import { AsyncPipe, DatePipe, DecimalPipe, NgForOf, NgIf } from '@angular/common';
import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Auth } from '@angular/fire/auth';

import { BonusPremium, Employee, Office } from '../../../types';
import { BonusPremiumsService } from '../../../services/bonus-premiums.service';
import { MastersService } from '../../../services/masters.service';
import {
  BonusPremiumCalculationResult,
  calculateBonusPremium,
  getFiscalYear
} from '../../../utils/bonus-calculator';

export interface BonusFormDialogData {
  office: Office;
  employees: Employee[];
  bonus?: BonusPremium;
}

@Component({
  selector: 'ip-bonus-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    AsyncPipe,
    NgIf,
    NgForOf,
    DatePipe,
    DecimalPipe
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon>{{ data.bonus ? 'edit' : 'note_add' }}</mat-icon>
      {{ data.bonus ? '賞与を編集' : '賞与を登録' }}
    </h1>

    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <div class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>従業員</mat-label>
          <mat-select formControlName="employeeId" required>
            <mat-option *ngFor="let emp of insuredEmployees" [value]="emp.id">
              {{ emp.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>支給日</mat-label>
          <input matInput type="date" formControlName="payDate" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>賞与支給額（税引前）</mat-label>
          <input matInput type="number" formControlName="grossAmount" required />
        </mat-form-field>
      </div>

      <mat-form-field appearance="outline" class="note-field">
        <mat-label>メモ（任意）</mat-label>
        <textarea matInput rows="3" formControlName="note"></textarea>
      </mat-form-field>

      <div class="preview" *ngIf="calculationResult() as result">
        <h3>
          <mat-icon>insights</mat-icon>
          計算結果プレビュー
        </h3>
        <div class="preview-grid">
          <div class="preview-item">
            <span class="label">標準賞与額</span>
            <span class="value">{{ result.standardBonusAmount | number }} 円</span>
          </div>
          <div class="preview-item">
            <span class="label">健康保険</span>
            <span class="value">
              本人 {{ result.healthEmployee | number }} 円 / 会社 {{ result.healthEmployer | number }} 円
            </span>
            <div class="note" *ngIf="result.healthExceededAmount > 0">
              上限超過額: {{ result.healthExceededAmount | number }} 円
            </div>
          </div>
          <div class="preview-item">
            <span class="label">厚生年金</span>
            <span class="value">
              本人 {{ result.pensionEmployee | number }} 円 / 会社 {{ result.pensionEmployer | number }} 円
            </span>
            <div class="note" *ngIf="result.pensionExceededAmount > 0">
              上限超過額: {{ result.pensionExceededAmount | number }} 円
            </div>
          </div>
          <div class="preview-item total">
            <span class="label">合計</span>
            <span class="value">
              本人 {{ result.totalEmployee | number }} 円 / 会社 {{ result.totalEmployer | number }} 円
            </span>
          </div>
        </div>
      </div>
    </form>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="close()" type="button">キャンセル</button>
      <button mat-raised-button color="primary" type="submit" [disabled]="loading()">
        <mat-icon>save</mat-icon>
        計算して保存
      </button>
    </div>
  `,
  styles: [
    `
      .dialog-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
      }

      .note-field {
        width: 100%;
      }

      .preview {
        margin-top: 1.5rem;
        padding: 1rem;
        border-radius: 8px;
        background: #f8f9ff;
        border: 1px solid #e0e7ff;
      }

      .preview h3 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0 0 0.75rem 0;
        color: #334155;
      }

      .preview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 0.75rem;
      }

      .preview-item {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 0.75rem;
      }

      .preview-item .label {
        display: block;
        color: #6b7280;
        font-size: 0.9rem;
        margin-bottom: 0.25rem;
      }

      .preview-item .value {
        font-weight: 600;
        color: #111827;
      }

      .preview-item .note {
        margin-top: 0.25rem;
        font-size: 0.85rem;
        color: #dc2626;
      }

      .preview-item.total {
        background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
      }

      [mat-dialog-actions] {
        padding: 1rem;
      }
    `
  ]
})
export class BonusFormDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<BonusFormDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly mastersService = inject(MastersService);
  private readonly bonusPremiumsService = inject(BonusPremiumsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(Auth);

  readonly calculationResult = signal<BonusPremiumCalculationResult | null>(null);
  readonly loading = signal(false);

  readonly insuredEmployees = (this.data.employees || []).filter((e) => e.isInsured);

  readonly form = this.fb.group({
    employeeId: [this.data.bonus?.employeeId ?? this.insuredEmployees[0]?.id ?? '', Validators.required],
    payDate: [this.data.bonus?.payDate ?? new Date().toISOString().substring(0, 10), Validators.required],
    grossAmount: [this.data.bonus?.grossAmount ?? null, [Validators.required, Validators.min(1)]],
    note: [this.data.bonus?.note ?? '']
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: BonusFormDialogData
  ) {}

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { employeeId, payDate, grossAmount, note } = this.form.value;
    const employee = this.insuredEmployees.find((e) => e.id === employeeId);

    if (!employee || !employee.isInsured) {
      this.snackBar.open('社会保険加入者を選択してください', '閉じる', { duration: 3000 });
      return;
    }

    if (!payDate || !grossAmount || grossAmount <= 0) {
      this.snackBar.open('支給日と賞与支給額を入力してください', '閉じる', { duration: 3000 });
      return;
    }

    try {
      this.loading.set(true);
      const yearMonth = String(payDate).substring(0, 7);
      const rates = await this.mastersService.getRatesForYearMonth(this.data.office, yearMonth);

      if (rates.healthRate == null || rates.pensionRate == null) {
        this.snackBar.open('保険料率が設定されていません。マスタを確認してください。', '閉じる', {
          duration: 4000
        });
        return;
      }

      const fiscalYear = String(getFiscalYear(payDate));
      const cumulative = await this.bonusPremiumsService.getHealthStandardBonusCumulative(
        this.data.office.id,
        employeeId as string,
        fiscalYear,
        this.data.bonus?.payDate
      );

      const result = calculateBonusPremium(
        this.data.office.id,
        employee,
        Number(grossAmount),
        payDate as string,
        cumulative,
        rates.healthRate,
        rates.pensionRate
      );

      if (!result) {
        this.snackBar.open('計算対象外です（未加入または金額が無効）', '閉じる', { duration: 3000 });
        return;
      }

      this.calculationResult.set(result);

      if (result.healthExceededAmount > 0 || result.pensionExceededAmount > 0) {
        this.snackBar.open('上限超過分は保険料計算から除外されます', '閉じる', { duration: 4000 });
      }

      const currentUser = this.auth.currentUser;

      const payload: Partial<BonusPremium> = {
        ...result,
        note: note ?? undefined,
        createdAt: this.data.bonus?.createdAt ?? new Date().toISOString(),
        createdByUserId: currentUser?.uid
      };

      await this.bonusPremiumsService.saveBonusPremium(this.data.office.id, payload as BonusPremium);
      this.snackBar.open('賞与情報を保存しました', '閉じる', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (error) {
      console.error('賞与計算に失敗しました', error);
      this.snackBar.open('賞与計算・保存に失敗しました', '閉じる', { duration: 4000 });
    } finally {
      this.loading.set(false);
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
