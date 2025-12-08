import { Component, inject, signal } from '@angular/core';
import { DecimalPipe, NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { MastersService } from '../../services/masters.service';
import {
  calculateMonthlyPremiumForEmployee,
  MonthlyPremiumCalculationResult,
  PremiumRateContext
} from '../../utils/premium-calculator';
import { Employee } from '../../types';

@Component({
  selector: 'ip-simulator-page',
  standalone: true,
  imports: [
    MatCardModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    DecimalPipe,
    NgIf
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div>
            <h1>保険料シミュレーター</h1>
          <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">
            報酬月額や等級を入力して、社会保険料を試算できます。実際の月次保険料計算と同じロジックを使用します。
            </p>
        </div>
      </header>

      <mat-card class="content-card mb-4">
        <div class="flex-row justify-between align-center mb-4">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">input</mat-icon> 入力項目
            </h2>
            <p class="mat-body-2" style="color: #666">報酬月額や等級を入力して、シミュレーションを実行してください。</p>
          </div>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSimulate()" class="dense-form">
          <div class="form-section">
            <div class="form-row flex-row gap-3 flex-wrap mb-3">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>対象年月</mat-label>
                <input matInput type="month" formControlName="yearMonth" required />
                <mat-error *ngIf="form.get('yearMonth')?.hasError('required')">
                  対象年月を選択してください
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>報酬月額（円）</mat-label>
                <input matInput type="number" formControlName="monthlyWage" required />
                <mat-error *ngIf="form.get('monthlyWage')?.hasError('required')">
                  報酬月額を入力してください
                </mat-error>
                <mat-error *ngIf="form.get('monthlyWage')?.hasError('min')">
                  1円以上の値を入力してください
                </mat-error>
              </mat-form-field>
            </div>

            <div class="form-row flex-row gap-3 flex-wrap mb-3">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>健康保険等級</mat-label>
                <input matInput type="number" formControlName="healthGrade" required />
                <mat-error *ngIf="form.get('healthGrade')?.hasError('required')">
                  健康保険等級を入力してください
                </mat-error>
                <mat-error
                  *ngIf="
                    form.get('healthGrade')?.hasError('min') ||
                    form.get('healthGrade')?.hasError('max')
                  "
                >
                  1〜47の範囲で入力してください
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>厚生年金等級</mat-label>
                <input matInput type="number" formControlName="pensionGrade" required />
                <mat-error *ngIf="form.get('pensionGrade')?.hasError('required')">
                  厚生年金等級を入力してください
                </mat-error>
                <mat-error
                  *ngIf="
                    form.get('pensionGrade')?.hasError('min') ||
                    form.get('pensionGrade')?.hasError('max')
                  "
                >
                  1〜32の範囲で入力してください
                </mat-error>
              </mat-form-field>
            </div>

            <mat-checkbox formControlName="isCareInsuranceTarget">
              介護保険対象（40〜64歳）
            </mat-checkbox>
          </div>

          <div class="actions">
            <button
              mat-flat-button
              color="primary"
              type="submit"
              [disabled]="form.invalid || loading()"
            >
              <mat-spinner *ngIf="loading()" diameter="20" class="inline-spinner"></mat-spinner>
              <mat-icon *ngIf="!loading()">calculate</mat-icon>
              シミュレーション実行
            </button>
          </div>
        </form>
      </mat-card>

      <ng-container *ngIf="calculationResult() as result; else noResult">
        <mat-card class="content-card">
          <div class="flex-row justify-between align-center mb-4">
            <div>
              <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
                <mat-icon color="primary">assessment</mat-icon> 計算結果
            </h2>
            </div>
          </div>

          <div class="result-content">
            <div class="info-section">
              <div class="info-section-header">
                <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                  等級・標準報酬月額
                </h3>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">健康保険等級</span>
                  <span class="value">{{ result.healthGrade }}</span>
                </div>
                <div class="info-item">
                  <span class="label">健康保険標準報酬月額</span>
                  <span class="value">{{ result.healthStandardMonthly | number }}円</span>
                </div>
                <div class="info-item">
                  <span class="label">厚生年金等級</span>
                  <span class="value">{{ result.pensionGrade }}</span>
                </div>
                <div class="info-item">
                  <span class="label">厚生年金標準報酬月額</span>
                  <span class="value">{{ result.pensionStandardMonthly | number }}円</span>
                </div>
              </div>
            </div>

            <div class="info-section">
              <div class="info-section-header">
                <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                  健康保険
                </h3>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">本人負担額</span>
                  <span class="value employee">{{ result.amounts.healthEmployee | number }}円</span>
                </div>
                <div class="info-item">
                  <span class="label">会社負担額</span>
                  <span class="value employer">{{ result.amounts.healthEmployer | number }}円</span>
                </div>
                <div class="info-item">
                  <span class="label">合計</span>
                  <span class="value">{{ result.amounts.healthTotal | number }}円</span>
                </div>
              </div>
            </div>

            <div class="info-section" *ngIf="result.amounts.careTotal > 0">
              <div class="info-section-header">
                <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                  介護保険
                </h3>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">本人負担額</span>
                  <span class="value employee">{{ result.amounts.careEmployee | number }}円</span>
                </div>
                <div class="info-item">
                  <span class="label">会社負担額</span>
                  <span class="value employer">{{ result.amounts.careEmployer | number }}円</span>
                </div>
                <div class="info-item">
                  <span class="label">合計</span>
                  <span class="value">{{ result.amounts.careTotal | number }}円</span>
                </div>
              </div>
            </div>

            <div class="info-section">
              <div class="info-section-header">
                <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                  厚生年金
                </h3>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">本人負担額</span>
                  <span class="value employee">{{ result.amounts.pensionEmployee | number }}円</span>
                </div>
                <div class="info-item">
                  <span class="label">会社負担額</span>
                  <span class="value employer">{{ result.amounts.pensionEmployer | number }}円</span>
                </div>
                <div class="info-item">
                  <span class="label">合計</span>
                  <span class="value">{{ result.amounts.pensionTotal | number }}円</span>
                </div>
              </div>
            </div>

            <div class="info-section total-section">
              <div class="info-section-header">
                <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                  トータル
                </h3>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">本人負担合計</span>
                  <span class="value employee large">{{ result.amounts.totalEmployee | number }}円</span>
                </div>
                <div class="info-item">
                  <span class="label">会社負担合計</span>
                  <span class="value employer large">{{ result.amounts.totalEmployer | number }}円</span>
                </div>
                <div class="info-item">
                  <span class="label">合計額</span>
                  <span class="value large">
                    {{ (result.amounts.totalEmployee + result.amounts.totalEmployer) | number }}円
                  </span>
                </div>
              </div>
            </div>
          </div>
        </mat-card>
      </ng-container>

      <ng-template #noResult>
        <mat-card class="content-card placeholder-card">
          <div class="placeholder-content">
            <mat-icon>info</mat-icon>
            <p>
              まだ計算されていません。上記の入力項目を入力して「シミュレーション実行」ボタンを押してください。
            </p>
          </div>
        </mat-card>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 1366px;
        margin: 0 auto;
        padding: 24px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 24px;

        @media (max-width: 600px) {
          padding: 16px;
          gap: 16px;
        }
      }

      .content-card {
        padding: 24px;
        border-radius: 8px;
        /* box-shadowはAngular Materialのデフォルトを使用 */
      }

      .m-0 { margin: 0; }
      
      /* 共通ユーティリティ */
      .mb-0 { margin-bottom: 0; }
      .mb-2 { margin-bottom: 8px; }
      .mb-3 { margin-bottom: 16px; }
      .mb-4 { margin-bottom: 24px; }

      .flex-row { display: flex; flex-direction: row; }
      .align-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .gap-2 { gap: 8px; }
      .gap-3 { gap: 16px; }

      .flex-1 {
        flex: 1 1 200px;
        min-width: 0;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        padding-top: 1.5rem;
        border-top: 1px solid #e0e0e0;
      }

      .inline-spinner {
        margin-right: 8px;
      }

      /* 結果表示エリアのデザイン */
      .info-section {
        margin-bottom: 24px;
        padding: 24px;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        background-color: #fafafa;
      }

      .info-section:last-child {
        margin-bottom: 0;
      }

      .info-section-header {
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e0e0e0;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 24px;
      }

      .info-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .info-item .label {
        color: #6b7280;
        font-size: 0.85rem;
      }

      .info-item .value {
        font-weight: 500;
        color: #111827;
        font-size: 1.1rem;
      }

      .value.employee {
        color: #1976d2;
      }

      .value.employer {
        color: #2e7d32;
      }

      .value.large {
        font-size: 1.5rem;
        font-weight: 700;
      }

      .total-section {
        background-color: #f0f4f8; /* 少しトーンを変える */
        border-color: #d1d9e6;
      }

      .placeholder-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        color: #999;

        mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
          margin-bottom: 16px;
          opacity: 0.3;
      }

        p {
        margin: 0;
          font-size: 14px;
        }
      }
    `
  ]
})
export class SimulatorPage {
  private readonly fb = inject(FormBuilder);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly mastersService = inject(MastersService);
  private readonly snackBar = inject(MatSnackBar);

  readonly office$ = this.currentOffice.office$;

  readonly calculationResult = signal<MonthlyPremiumCalculationResult | null>(null);
  readonly loading = signal(false);

  readonly form = this.fb.group({
    yearMonth: [new Date().toISOString().substring(0, 7), Validators.required],
    monthlyWage: [null as number | null, [Validators.required, Validators.min(1)]],
    healthGrade: [null as number | null, [Validators.required, Validators.min(1), Validators.max(47)]],
    pensionGrade: [null as number | null, [Validators.required, Validators.min(1), Validators.max(32)]],
    isCareInsuranceTarget: [false]
  });

  async onSimulate(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    try {
      this.loading.set(true);

      const office = await firstValueFrom(this.office$);
      if (!office) {
        this.calculationResult.set(null);
        this.snackBar.open('事業所情報を取得できませんでした', '閉じる', { duration: 3000 });
        return;
      }

      const formValue = this.form.value;
      const yearMonth = formValue.yearMonth as string;
      const monthlyWage = Number(formValue.monthlyWage);
      const healthGrade = Number(formValue.healthGrade);
      const pensionGrade = Number(formValue.pensionGrade);
      const isCareInsuranceTarget = formValue.isCareInsuranceTarget === true;

      const rates = await this.mastersService.getRatesForYearMonth(office, yearMonth);

      if (rates.healthRate == null || rates.pensionRate == null) {
        this.calculationResult.set(null);
        let errorMessage = '対象年月の保険料率がマスタに設定されていません。';
        if (rates.healthRate == null) {
          errorMessage += ' 健康保険料率が未設定です。';
        }
        if (rates.pensionRate == null) {
          errorMessage += ' 厚生年金保険料率が未設定です。';
        }
        errorMessage += ' 保険料率管理画面で設定してください。';
        this.snackBar.open(errorMessage, '閉じる', { duration: 5000 });
        return;
      }

      const tempEmployee: Employee = {
        id: 'temp',
        officeId: office.id,
        name: 'シミュレーション用',
        birthDate: isCareInsuranceTarget ? '1980-01-01' : '2005-01-01',
        hireDate: '2000-01-01',
        employmentType: 'regular',
        monthlyWage,
        isInsured: true,
        healthGrade,
        healthStandardMonthly: monthlyWage,
        pensionGrade,
        pensionStandardMonthly: monthlyWage
      };

      const rateContext: PremiumRateContext = {
        yearMonth,
        calcDate: new Date().toISOString(),
        healthRate: rates.healthRate,
        careRate: rates.careRate,
        pensionRate: rates.pensionRate
      };

      const result = calculateMonthlyPremiumForEmployee(tempEmployee, rateContext);

      if (!result) {
        this.calculationResult.set(null);
        this.snackBar.open('保険料の計算に失敗しました。入力値を確認してください。', '閉じる', {
          duration: 3000
        });
        return;
      }

      this.calculationResult.set(result);
    } catch (error) {
      console.error('シミュレーション実行に失敗しました', error);
      this.calculationResult.set(null);
      this.snackBar.open('シミュレーション実行に失敗しました', '閉じる', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }
}
