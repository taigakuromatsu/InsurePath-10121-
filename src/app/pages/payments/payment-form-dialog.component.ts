import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { CurrentUserService } from '../../services/current-user.service';
import { PaymentsService } from '../../services/payments.service';
import { PaymentMethod, PaymentStatus, SocialInsurancePayment } from '../../types';

export interface PaymentFormDialogData {
  officeId: string;
  payment?: SocialInsurancePayment;
}

@Component({
  selector: 'ip-payment-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    AsyncPipe,
    NgIf
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon>{{ data.payment ? 'edit' : 'post_add' }}</mat-icon>
      {{ data.payment ? '納付状況を編集' : '納付状況を登録' }}
    </h1>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <div mat-dialog-content class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>対象年月</mat-label>
          <input matInput type="month" formControlName="targetYearMonth" [readonly]="Boolean(data.payment)" />
        </mat-form-field>

        <div class="section-title">予定額（会社負担）</div>

        <mat-form-field appearance="outline">
          <mat-label>健康保険（会社負担）</mat-label>
          <input matInput type="number" formControlName="plannedHealthCompany" min="0" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>介護保険（会社負担）</mat-label>
          <input matInput type="number" formControlName="plannedCareCompany" min="0" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>厚生年金（会社負担）</mat-label>
          <input matInput type="number" formControlName="plannedPensionCompany" min="0" />
        </mat-form-field>

        <div class="total-line">
          <span>予定合計</span>
          <strong>¥{{ plannedTotalCompany | number }}</strong>
        </div>

        <button
          *ngIf="!data.payment"
          type="button"
          mat-stroked-button
          color="primary"
          (click)="autoCalculate()"
        >
          <mat-icon>calculate</mat-icon>
          予定額を自動計算
        </button>

        <div class="section-title">実績額（会社負担）</div>

        <mat-form-field appearance="outline">
          <mat-label>健康保険（会社負担）</mat-label>
          <input matInput type="number" formControlName="actualHealthCompany" min="0" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>介護保険（会社負担）</mat-label>
          <input matInput type="number" formControlName="actualCareCompany" min="0" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>厚生年金（会社負担）</mat-label>
          <input matInput type="number" formControlName="actualPensionCompany" min="0" />
        </mat-form-field>

        <div class="total-line">
          <span>実績合計</span>
          <strong>
            <ng-container *ngIf="actualTotalCompany != null; else actualEmpty">
              ¥{{ actualTotalCompany | number }}
            </ng-container>
            <ng-template #actualEmpty>未入力</ng-template>
          </strong>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>納付ステータス</mat-label>
          <mat-select formControlName="paymentStatus">
            <mat-option value="unpaid">未納</mat-option>
            <mat-option value="paid">納付済</mat-option>
            <mat-option value="partially_paid">一部納付</mat-option>
            <mat-option value="not_required">納付不要</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>納付方法</mat-label>
          <mat-select formControlName="paymentMethod">
            <mat-option [value]="null">未選択</mat-option>
            <mat-option value="bank_transfer">銀行振込</mat-option>
            <mat-option value="account_transfer">口座振替</mat-option>
            <mat-option value="cash">現金</mat-option>
            <mat-option value="other">その他</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>納付方法の詳細</mat-label>
          <textarea matInput formControlName="paymentMethodNote" rows="2"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>納付日</mat-label>
          <input matInput type="date" formControlName="paymentDate" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>備考</mat-label>
          <textarea matInput formControlName="memo" rows="3"></textarea>
        </mat-form-field>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button mat-dialog-close type="button">キャンセル</button>
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
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 1rem;
        align-items: end;
      }

      .section-title {
        grid-column: 1 / -1;
        font-weight: 700;
        color: #374151;
      }

      .total-line {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #f9fafb;
      }

      .full-width {
        grid-column: 1 / -1;
      }

      button[mat-stroked-button] {
        width: fit-content;
      }
    `
  ]
})
export class PaymentFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<PaymentFormDialogComponent>);
  private readonly paymentsService = inject(PaymentsService);
  private readonly currentUser = inject(CurrentUserService);

  readonly data = inject<PaymentFormDialogData>(MAT_DIALOG_DATA);

  form = this.fb.group({
    targetYearMonth: [
      { value: this.data.payment?.targetYearMonth ?? '', disabled: Boolean(this.data.payment) },
      Validators.required
    ],
    plannedHealthCompany: [this.data.payment?.plannedHealthCompany ?? 0, [Validators.required, Validators.min(0)]],
    plannedCareCompany: [this.data.payment?.plannedCareCompany ?? 0, [Validators.required, Validators.min(0)]],
    plannedPensionCompany: [
      this.data.payment?.plannedPensionCompany ?? 0,
      [Validators.required, Validators.min(0)]
    ],
    actualHealthCompany: [this.data.payment?.actualHealthCompany ?? null, [Validators.min(0)]],
    actualCareCompany: [this.data.payment?.actualCareCompany ?? null, [Validators.min(0)]],
    actualPensionCompany: [this.data.payment?.actualPensionCompany ?? null, [Validators.min(0)]],
    paymentStatus: [this.data.payment?.paymentStatus ?? 'unpaid', Validators.required],
    paymentMethod: [this.data.payment?.paymentMethod ?? null],
    paymentMethodNote: [this.data.payment?.paymentMethodNote ?? ''],
    paymentDate: [this.data.payment?.paymentDate ?? null],
    memo: [this.data.payment?.memo ?? '']
  });

  get plannedTotalCompany(): number {
    const raw = this.form.getRawValue();
    return (
      this.toNumber(raw.plannedHealthCompany) +
      this.toNumber(raw.plannedCareCompany) +
      this.toNumber(raw.plannedPensionCompany)
    );
  }

  get actualTotalCompany(): number | null {
    const raw = this.form.getRawValue();
    const actualHealth = this.toNullableNumber(raw.actualHealthCompany);
    const actualCare = this.toNullableNumber(raw.actualCareCompany);
    const actualPension = this.toNullableNumber(raw.actualPensionCompany);
    const hasActual = [actualHealth, actualCare, actualPension].some((v) => v != null);

    if (!hasActual) return null;

    return (actualHealth ?? 0) + (actualCare ?? 0) + (actualPension ?? 0);
  }

  private toNumber(value: number | string | null | undefined): number {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  }

  private toNullableNumber(value: number | string | null | undefined): number | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  async autoCalculate(): Promise<void> {
    if (this.form.get('targetYearMonth')?.invalid) {
      return;
    }
    const targetYearMonth = this.form.get('targetYearMonth')?.value as string;
    const amounts = await this.paymentsService.calculatePlannedAmounts(this.data.officeId, targetYearMonth);

    this.form.patchValue({
      plannedHealthCompany: amounts.plannedHealthCompany,
      plannedCareCompany: amounts.plannedCareCompany,
      plannedPensionCompany: amounts.plannedPensionCompany
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const targetYearMonth = raw.targetYearMonth || this.data.payment?.targetYearMonth;

    if (!targetYearMonth) {
      return;
    }

    const plannedHealthCompany = this.toNumber(raw.plannedHealthCompany);
    const plannedCareCompany = this.toNumber(raw.plannedCareCompany);
    const plannedPensionCompany = this.toNumber(raw.plannedPensionCompany);
    const plannedTotalCompany =
      plannedHealthCompany + plannedCareCompany + plannedPensionCompany;

    const actualHealthCompany = this.toNullableNumber(raw.actualHealthCompany);
    const actualCareCompany = this.toNullableNumber(raw.actualCareCompany);
    const actualPensionCompany = this.toNullableNumber(raw.actualPensionCompany);
    const hasActual = [actualHealthCompany, actualCareCompany, actualPensionCompany].some((v) => v != null);
    const actualTotalCompany = hasActual
      ? (actualHealthCompany ?? 0) + (actualCareCompany ?? 0) + (actualPensionCompany ?? 0)
      : null;

    const paymentStatus = raw.paymentStatus as PaymentStatus;
    const paymentMethod = (raw.paymentMethod as PaymentMethod | null) ?? null;
    const paymentMethodNote = raw.paymentMethodNote?.trim() || null;
    const paymentDate = raw.paymentDate || null;
    const memo = raw.memo?.trim() || null;

    if (paymentStatus === 'paid' && (paymentDate == null || actualTotalCompany == null)) {
      return;
    }

    const profile = await firstValueFrom(this.currentUser.profile$);
    if (!profile?.id) {
      return;
    }

    if (this.data.payment) {
      await this.paymentsService.update(
        this.data.officeId,
        this.data.payment.targetYearMonth,
        {
          plannedHealthCompany,
          plannedCareCompany,
          plannedPensionCompany,
          plannedTotalCompany,
          actualHealthCompany,
          actualCareCompany,
          actualPensionCompany,
          actualTotalCompany,
          paymentStatus,
          paymentMethod,
          paymentMethodNote,
          paymentDate,
          memo
        },
        profile.id
      );
    } else {
      await this.paymentsService.create(
        this.data.officeId,
        {
          targetYearMonth,
          plannedHealthCompany,
          plannedCareCompany,
          plannedPensionCompany,
          plannedTotalCompany,
          actualHealthCompany,
          actualCareCompany,
          actualPensionCompany,
          actualTotalCompany,
          paymentStatus,
          paymentMethod,
          paymentMethodNote,
          paymentDate,
          memo
        },
        profile.id
      );
    }

    this.dialogRef.close(true);
  }
}
