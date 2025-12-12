import { AsyncPipe, DatePipe, DecimalPipe, NgForOf, NgIf } from '@angular/common';
import { Component, Inject, inject, signal, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Auth } from '@angular/fire/auth';
import { debounceTime, Subscription } from 'rxjs';

import { BonusPremium, Employee, Office, YearMonthString, IsoDateString } from '../../../types';
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
    NgIf,
    NgForOf,
    DecimalPipe
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon>{{ data.bonus ? 'edit' : 'note_add' }}</mat-icon>
      {{ data.bonus ? '賞与を編集' : '賞与を登録' }}
    </h1>

    <!-- form で全体をラップする -->
    <form [formGroup]="form" (ngSubmit)="submit()">
      <div mat-dialog-content>
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
            <input matInput type="date" formControlName="payDate" required [readonly]="!!data.bonus" />
            <mat-hint *ngIf="data.bonus">
              登録済みの賞与は支給日を変更できません。変更が必要な場合は削除して再登録してください。
            </mat-hint>
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
            標準賞与額と上限チェック
          </h3>
          <div class="preview-grid">
            <!-- 1. 1000円未満切り捨て後の額 -->
            <div class="preview-item">
              <span class="label">1000円未満切り捨て後の額</span>
              <span class="value">{{ result.standardBonusAmount | number }} 円</span>
              <div class="note">
                入力した賞与支給額を 1,000 円未満切り捨てした金額です。
              </div>
            </div>

            <!-- 2. 健康保険の標準賞与額 -->
            <div class="preview-item">
              <span class="label">健康保険の標準賞与額</span>
              <span class="value">
                有効額 {{ result.healthEffectiveAmount | number }} 円
              </span>
              <div class="note" *ngIf="result.healthExceededAmount > 0">
                <span class="exceeded">上限超過額: {{ result.healthExceededAmount | number }} 円</span>
              </div>
            </div>

            <!-- 3. 厚生年金の標準賞与額 -->
            <div class="preview-item">
              <span class="label">厚生年金の標準賞与額</span>
              <span class="value">
                有効額 {{ result.pensionEffectiveAmount | number }} 円
              </span>
              <div class="note" *ngIf="result.pensionExceededAmount > 0">
                <span class="exceeded">上限超過額: {{ result.pensionExceededAmount | number }} 円</span>
              </div>
            </div>
          </div>

          <p class="preview-note">
            ※ 実際の保険料は同じ月の他の賞与も含めて一覧画面側で再計算されます。
            このプレビューは入力中の賞与単体の標準額と上限超過の目安です。
          </p>
        </div>

        <!-- 年4回制限の警告 -->
        <div class="bonus-limit-warning" *ngIf="bonusLimitWarning()">
          <mat-icon class="warning-icon">warning</mat-icon>
          <div class="warning-content">
            <strong>年4回制限の警告</strong>
            <p>{{ bonusLimitWarning() }}</p>
          </div>
        </div>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button (click)="close()" type="button">キャンセル</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="loading()">
          <mat-icon>save</mat-icon>
          保存
        </button>
      </div>
    </form>
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
        color: #6b7280;
      }

      .preview-item .note .exceeded {
        color: #dc2626;
        font-weight: 600;
      }

      .preview-note {
        margin: 0.75rem 0 0;
        font-size: 0.8rem;
        color: #6b7280;
      }

      .bonus-limit-warning {
        margin-top: 1rem;
        padding: 1rem;
        border-radius: 8px;
        background: #fff3cd;
        border: 1px solid #ffc107;
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .warning-icon {
        color: #ff9800;
        margin-top: 2px;
      }

      .warning-content {
        flex: 1;
      }

      .warning-content strong {
        display: block;
        margin-bottom: 0.5rem;
        color: #856404;
        font-size: 0.95rem;
      }

      .warning-content p {
        margin: 0;
        font-size: 0.9rem;
        color: #856404;
        line-height: 1.5;
      }

      [mat-dialog-actions] {
        padding: 1rem;
      }
    `
  ]
})
export class BonusFormDialogComponent implements OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<BonusFormDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly mastersService = inject(MastersService);
  private readonly bonusPremiumsService = inject(BonusPremiumsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(Auth);

  readonly calculationResult = signal<BonusPremiumCalculationResult | null>(null);
  readonly loading = signal(false);
  readonly bonusLimitWarning = signal<string | null>(null);
  private formSubscription?: Subscription;

  get insuredEmployees(): Employee[] {
    return (this.data.employees || []).filter((e) => e.isInsured);
  }

  readonly form = this.fb.group({
    employeeId: ['', Validators.required],
    payDate: [new Date().toISOString().substring(0, 10), Validators.required],
    grossAmount: [null as number | null, [Validators.required, Validators.min(1)]],
    note: ['']
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: BonusFormDialogData
  ) {
    // フォームの初期値を設定
    this.form.patchValue({
      employeeId: this.data.bonus?.employeeId ?? this.insuredEmployees[0]?.id ?? '',
      payDate: this.data.bonus?.payDate ?? new Date().toISOString().substring(0, 10),
      grossAmount: this.data.bonus?.grossAmount ?? null,
      note: this.data.bonus?.note ?? ''
    });

    // 社会保険加入者が0件の場合はダイアログを閉じる
    if (this.insuredEmployees.length === 0) {
      this.snackBar.open('社会保険加入者がいないため、賞与を登録できません。', '閉じる', {
        duration: 4000
      });
      this.dialogRef.close(false);
      return;
    }

    // フォーム変更時にプレビューを更新
    this.formSubscription = this.form.valueChanges
      .pipe(debounceTime(300))
      .subscribe(() => {
        this.refreshPreview();
      });

    // 初期プレビューを表示
    this.refreshPreview();
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
  }

  private async refreshPreview(): Promise<void> {
    const { employeeId, payDate, grossAmount } = this.form.value;

    // 入力が揃っていない場合はプレビューをクリア
    if (!employeeId || !payDate || grossAmount == null || grossAmount <= 0) {
      this.calculationResult.set(null);
      this.bonusLimitWarning.set(null);
      return;
    }

    const employee = this.insuredEmployees.find((e) => e.id === employeeId);
    if (!employee || !employee.isInsured) {
      this.calculationResult.set(null);
      this.bonusLimitWarning.set(null);
      return;
    }

    try {
      // 年4回制限のチェック（プレビュー段階で警告を表示）
      const bonusCount = await this.bonusPremiumsService.getBonusCountInPeriod(
        this.data.office.id,
        employeeId as string,
        payDate as IsoDateString,
        this.data.bonus?.payDate
      );

      if (bonusCount >= 3) {
        this.bonusLimitWarning.set(
          `この従業員は、7月1日から翌年6月30日までの期間に既に${bonusCount}回の賞与が登録されています。` +
          `4回目以降の支給は賞与として計算されず、標準報酬月額の算定に含まれます。` +
          `このまま登録することはできません。`
        );
      } else {
        this.bonusLimitWarning.set(null);
      }

      const yearMonth = String(payDate).substring(0, 7) as YearMonthString;
      const rates = await this.mastersService.getRatesForYearMonth(this.data.office, yearMonth);

      if (rates.healthRate == null || rates.pensionRate == null) {
        // 料率未設定の場合はプレビューをクリア（エラーは出さない）
        this.calculationResult.set(null);
        return;
      }

      // 健保: 年度内累計（既存処理）
      const fiscalYear = String(getFiscalYear(payDate));
      const healthCumulative = await this.bonusPremiumsService.getHealthStandardBonusCumulative(
        this.data.office.id,
        employeeId as string,
        fiscalYear,
        this.data.bonus?.payDate
      );

      // 厚生年金: 同一月の標準賞与額累計
      const pensionMonthlyCumulative =
        await this.bonusPremiumsService.getPensionStandardBonusMonthlyCumulative(
          this.data.office.id,
          employeeId as string,
          yearMonth,
        this.data.bonus?.payDate
      );

      const result = calculateBonusPremium(
        this.data.office.id,
        employee,
        Number(grossAmount),
        payDate as string,
        healthCumulative,
        pensionMonthlyCumulative,
        rates.healthRate ?? 0,
        rates.careRate,
        rates.pensionRate ?? 0
      );

      this.calculationResult.set(result);
    } catch (error) {
      // プレビュー更新中のエラーは無視（保存時にエラーを出す）
      console.error('プレビュー更新に失敗しました', error);
      this.calculationResult.set(null);
      this.bonusLimitWarning.set(null);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // プレビューが最新でない可能性があるので、一度更新
    await this.refreshPreview();

    const result = this.calculationResult();
      if (!result) {
      this.snackBar.open('計算対象外です（未加入、金額が無効、または保険料率が未設定）', '閉じる', {
        duration: 4000
      });
        return;
      }

    // 年4回制限のチェック（保存を完全にブロック）
    const { employeeId, payDate } = this.form.value;
    if (employeeId && payDate) {
      const bonusCount = await this.bonusPremiumsService.getBonusCountInPeriod(
        this.data.office.id,
        employeeId as string,
        payDate as IsoDateString,
        this.data.bonus?.payDate
      );

      if (bonusCount >= 3) {
        this.snackBar.open(
          `年4回以上の支給は賞与として計算されません。この従業員は既に${bonusCount}回の賞与が登録されています。`,
          '閉じる',
          { duration: 6000 }
        );
        return;
      }
    }

    try {
      this.loading.set(true);

      if (result.healthExceededAmount > 0 || result.pensionExceededAmount > 0) {
        this.snackBar.open('上限超過分は保険料計算から除外されます', '閉じる', { duration: 4000 });
      }

      const { note } = this.form.value;
      const currentUser = this.auth.currentUser;

      const payload: Partial<BonusPremium> = {
        ...result,
        note: note ?? undefined,
        createdAt: this.data.bonus?.createdAt ?? new Date().toISOString(),
        createdByUserId: currentUser?.uid
      };

      await this.bonusPremiumsService.saveBonusPremium(
        this.data.office.id,
        payload as BonusPremium,
        this.data.bonus?.id
      );

      // 保存後に「従業員 × 年月」の一括再計算を実行
      if (employeeId && payDate) {
        const targetEmployee = this.insuredEmployees.find((e) => e.id === employeeId);
        if (targetEmployee) {
          const yearMonth = String(payDate).substring(0, 7) as YearMonthString;
          try {
            await this.bonusPremiumsService.recalculateForEmployeeMonth(
              this.data.office,
              targetEmployee,
              yearMonth
            );
          } catch (e) {
            console.error('賞与の一括再計算に失敗しました', e);
            // ここでは致命的エラーにはしない（保存自体は完了している）
          }
        }
      }

      this.snackBar.open('賞与情報を保存しました', '閉じる', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (error) {
      console.error('賞与保存に失敗しました', error);
      this.snackBar.open('賞与保存に失敗しました', '閉じる', { duration: 4000 });
    } finally {
      this.loading.set(false);
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
