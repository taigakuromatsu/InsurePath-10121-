import { DecimalPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
    MatSnackBarModule,
    NgIf,
    DecimalPipe
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon class="mr-2">{{ data.payment ? 'edit' : 'post_add' }}</mat-icon>
      {{ data.payment ? '納付状況を編集' : '納付状況を登録' }}
    </h1>

    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content class="dense-form">
      <div class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>対象年月</mat-label>
          <input matInput type="month" formControlName="targetYearMonth" [readonly]="!!data.payment" />
        </mat-form-field>

        <div class="section-title">予定額（会社負担）</div>
        <div class="field-help">
          給与・賞与から計算した、会社が負担する予定の保険料を入力してください。<br />
          月次保険料ページと賞与保険料ページのサマリーから値を参照できます。
        </div>

        <mat-form-field appearance="outline">
          <mat-label>健康・介護保険（会社負担）</mat-label>
          <input matInput type="number" formControlName="plannedHealthCareCompany" min="0" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>厚生年金（会社負担）</mat-label>
          <input matInput type="number" formControlName="plannedPensionCompany" min="0" />
        </mat-form-field>

        <div class="total-line">
          <span>予定合計</span>
          <strong>¥{{ plannedTotalCompany | number }}</strong>
        </div>

        <div class="section-title">納付額（会社負担）</div>
        <div class="field-help">
          実際に支払った会社負担分の保険料を入力してください。まだ納付していない場合は空欄で構いません。
        </div>

        <mat-form-field appearance="outline">
          <mat-label>健康・介護保険（会社負担）</mat-label>
          <input matInput type="number" formControlName="actualHealthCareCompany" min="0" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>厚生年金（会社負担）</mat-label>
          <input matInput type="number" formControlName="actualPensionCompany" min="0" />
        </mat-form-field>

        <div class="total-line">
          <span>納付額合計</span>
          <strong>
            <ng-container *ngIf="actualTotalCompany != null; else actualEmpty">
              ¥{{ actualTotalCompany | number }}
            </ng-container>
            <ng-template #actualEmpty>未入力</ng-template>
          </strong>
        </div>
        <div *ngIf="paidRequiresActualAndDateError && form.touched" class="error-message">
          <mat-icon>error_outline</mat-icon>
          <span>「納付済」を選択した場合は、納付額（会社負担）の入力が必須です。</span>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>納付ステータス</mat-label>
          <mat-select formControlName="paymentStatus">
            <mat-option value="unpaid">未納</mat-option>
            <mat-option value="paid">納付済</mat-option>
            <mat-option value="partially_paid">一部納付</mat-option>
            <mat-option value="not_required">納付不要</mat-option>
          </mat-select>
          <mat-hint>
            納付状況を選択してください。「納付済」を選んだ場合は、納付日と納付額（会社負担）の入力が必須になります。
          </mat-hint>
          <mat-error *ngIf="paidRequiresActualAndDateError && form.touched">
            「納付済」を選択した場合は、納付日と納付額（会社負担）の入力が必須です。
          </mat-error>
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
          <mat-hint>保険料を納付した方法を選択してください。</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>納付方法の詳細</mat-label>
          <textarea matInput formControlName="paymentMethodNote" rows="2"></textarea>
          <mat-hint>振込先や分割納付の内訳など、補足があれば記入してください。</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>納付日</mat-label>
          <input matInput type="date" formControlName="paymentDate" />
          <mat-hint>実際に保険料を納付した日を入力してください。</mat-hint>
          <mat-error *ngIf="paidRequiresActualAndDateError && form.touched">
            「納付済」を選択した場合は、納付日の入力が必須です。
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>備考</mat-label>
          <textarea matInput formControlName="memo" rows="3"></textarea>
          <mat-hint>社内で共有したいメモや、特記事項があれば自由に記入してください。</mat-hint>
        </mat-form-field>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-stroked-button mat-dialog-close type="button">キャンセル</button>
        <button
          mat-flat-button
          color="primary"
          type="submit"
          [disabled]="form.invalid || paidRequiresActualAndDateError"
        >
          保存
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .mr-2 { margin-right: 8px; }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
        align-items: end;
      }

      .section-title {
        grid-column: 1 / -1;
        font-weight: 700;
        color: #374151;
      }

      .field-help {
        grid-column: 1 / -1;
        font-size: 0.875rem;
        color: #6b7280;
        margin-bottom: 0.5rem;
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

      .error-message {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: #fee;
        border: 1px solid #fcc;
        border-radius: 4px;
        color: #c33;
        font-size: 0.875rem;
      }

      .error-message mat-icon {
        font-size: 1.25rem;
        width: 1.25rem;
        height: 1.25rem;
      }
    `
  ]
})
export class PaymentFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<PaymentFormDialogComponent>);
  private readonly paymentsService = inject(PaymentsService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly snackBar = inject(MatSnackBar);

  readonly data = inject<PaymentFormDialogData>(MAT_DIALOG_DATA);

  form = this.fb.group({
    targetYearMonth: [
      { value: this.data.payment?.targetYearMonth ?? '', disabled: Boolean(this.data.payment) },
      Validators.required
    ],
    plannedHealthCareCompany: [
      this.data.payment?.plannedHealthCareCompany ?? 
      (this.data.payment?.plannedHealthCompany != null && this.data.payment?.plannedCareCompany != null
        ? (this.data.payment.plannedHealthCompany + this.data.payment.plannedCareCompany)
        : 0),
      [Validators.required, Validators.min(0)]
    ],
    plannedPensionCompany: [
      this.data.payment?.plannedPensionCompany ?? 0,
      [Validators.required, Validators.min(0)]
    ],
    actualHealthCareCompany: [
      this.data.payment?.actualHealthCareCompany ?? 
      (this.data.payment?.actualHealthCompany != null && this.data.payment?.actualCareCompany != null
        ? (this.data.payment.actualHealthCompany + this.data.payment.actualCareCompany)
        : null),
      [Validators.min(0)]
    ],
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
      this.toNumber(raw.plannedHealthCareCompany) +
      this.toNumber(raw.plannedPensionCompany)
    );
  }

  get actualTotalCompany(): number | null {
    const raw = this.form.getRawValue();
    const actualHealthCare = this.toNullableNumber(raw.actualHealthCareCompany);
    const actualPension = this.toNullableNumber(raw.actualPensionCompany);
    const hasActual = [actualHealthCare, actualPension].some((v) => v != null);

    if (!hasActual) return null;

    return (actualHealthCare ?? 0) + (actualPension ?? 0);
  }

  get paidRequiresActualAndDateError(): boolean {
    const raw = this.form.getRawValue();
    const paymentStatus = raw.paymentStatus as PaymentStatus;
    const paymentDate = raw.paymentDate || null;

    // actualTotalCompany は既存 getter を利用
    const actualTotalCompany = this.actualTotalCompany;

    return paymentStatus === 'paid' && (paymentDate == null || actualTotalCompany == null);
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

  async submit(): Promise<void> {
    // 通常のバリデーション + カスタム条件をまとめてチェック
    if (this.form.invalid || this.paidRequiresActualAndDateError) {
      this.form.markAllAsTouched();

      if (this.paidRequiresActualAndDateError) {
        this.snackBar.open(
          '「納付済」を選択した場合は、納付日と納付額（会社負担）の入力が必須です。',
          '閉じる',
          { duration: 5000 }
        );
      }

      return;
    }

    const raw = this.form.getRawValue();
    const targetYearMonth = raw.targetYearMonth || this.data.payment?.targetYearMonth;

    if (!targetYearMonth) {
      return;
    }

    const plannedHealthCareCompany = this.toNumber(raw.plannedHealthCareCompany);
    const plannedPensionCompany = this.toNumber(raw.plannedPensionCompany);
    const plannedTotalCompany = plannedHealthCareCompany + plannedPensionCompany;

    const actualHealthCareCompany = this.toNullableNumber(raw.actualHealthCareCompany);
    const actualPensionCompany = this.toNullableNumber(raw.actualPensionCompany);
    const hasActual = [actualHealthCareCompany, actualPensionCompany].some((v) => v != null);
    const actualTotalCompany = hasActual
      ? (actualHealthCareCompany ?? 0) + (actualPensionCompany ?? 0)
      : null;

    const paymentStatus = raw.paymentStatus as PaymentStatus;
    const paymentMethod = (raw.paymentMethod as PaymentMethod | null) ?? null;
    const paymentMethodNote = raw.paymentMethodNote?.trim() || null;
    const paymentDate = raw.paymentDate || null;
    const memo = raw.memo?.trim() || null;

    const profile = await firstValueFrom(this.currentUser.profile$);
    if (!profile?.id) {
      return;
    }

    if (this.data.payment) {
      await this.paymentsService.update(
        this.data.officeId,
        this.data.payment.targetYearMonth,
        {
          plannedHealthCareCompany,
          plannedPensionCompany,
          plannedTotalCompany,
          actualHealthCareCompany,
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
          plannedHealthCareCompany,
          plannedPensionCompany,
          plannedTotalCompany,
          actualHealthCareCompany,
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
