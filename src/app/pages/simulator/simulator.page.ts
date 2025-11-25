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
    <section class="page simulator">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>calculate</mat-icon>
          </div>
          <div class="header-text">
            <h1>保険料シミュレーター</h1>
            <p>
              報酬月額や等級を入力して、社会保険料を試算できます。
              実際の月次保険料計算と同じロジックを使用します。
            </p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="page-header">
          <div class="page-title-section">
            <h2>
              <mat-icon>input</mat-icon>
              入力項目
            </h2>
            <p>報酬月額や等級を入力して、シミュレーションを実行してください。</p>
          </div>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSimulate()" class="simulator-form">
          <div class="form-section">
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>対象年月</mat-label>
                <input matInput type="month" formControlName="yearMonth" required />
                <mat-error *ngIf="form.get('yearMonth')?.hasError('required')">
                  対象年月を選択してください
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>報酬月額（円）</mat-label>
                <input matInput type="number" formControlName="monthlyWage" required />
                <mat-error *ngIf="form.get('monthlyWage')?.hasError('required')">
                  報酬月額を入力してください
                </mat-error>
                <mat-error *ngIf="form.get('monthlyWage')?.hasError('min')">
                  1円以上の値を入力してください
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
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

              <mat-form-field appearance="outline">
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
              mat-raised-button
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
        <mat-card class="result-card">
          <div class="result-header">
            <h2>
              <mat-icon>assessment</mat-icon>
              計算結果
            </h2>
          </div>

          <div class="result-content">
            <div class="result-section">
              <h3>等級・標準報酬月額</h3>
              <div class="result-grid">
                <div class="result-item">
                  <span class="result-label">健康保険等級</span>
                  <span class="result-value">{{ result.healthGrade }}</span>
                </div>
                <div class="result-item">
                  <span class="result-label">健康保険標準報酬月額</span>
                  <span class="result-value">{{ result.healthStandardMonthly | number }}円</span>
                </div>
                <div class="result-item">
                  <span class="result-label">厚生年金等級</span>
                  <span class="result-value">{{ result.pensionGrade }}</span>
                </div>
                <div class="result-item">
                  <span class="result-label">厚生年金標準報酬月額</span>
                  <span class="result-value">{{ result.pensionStandardMonthly | number }}円</span>
                </div>
              </div>
            </div>

            <div class="result-section">
              <h3>健康保険</h3>
              <div class="result-grid">
                <div class="result-item">
                  <span class="result-label">本人負担額</span>
                  <span class="result-value employee">{{ result.amounts.healthEmployee | number }}円</span>
                </div>
                <div class="result-item">
                  <span class="result-label">会社負担額</span>
                  <span class="result-value employer">{{ result.amounts.healthEmployer | number }}円</span>
                </div>
                <div class="result-item">
                  <span class="result-label">合計</span>
                  <span class="result-value">{{ result.amounts.healthTotal | number }}円</span>
                </div>
              </div>
            </div>

            <div class="result-section" *ngIf="result.amounts.careTotal > 0">
              <h3>介護保険</h3>
              <div class="result-grid">
                <div class="result-item">
                  <span class="result-label">本人負担額</span>
                  <span class="result-value employee">{{ result.amounts.careEmployee | number }}円</span>
                </div>
                <div class="result-item">
                  <span class="result-label">会社負担額</span>
                  <span class="result-value employer">{{ result.amounts.careEmployer | number }}円</span>
                </div>
                <div class="result-item">
                  <span class="result-label">合計</span>
                  <span class="result-value">{{ result.amounts.careTotal | number }}円</span>
                </div>
              </div>
            </div>

            <div class="result-section">
              <h3>厚生年金</h3>
              <div class="result-grid">
                <div class="result-item">
                  <span class="result-label">本人負担額</span>
                  <span class="result-value employee">{{ result.amounts.pensionEmployee | number }}円</span>
                </div>
                <div class="result-item">
                  <span class="result-label">会社負担額</span>
                  <span class="result-value employer">{{ result.amounts.pensionEmployer | number }}円</span>
                </div>
                <div class="result-item">
                  <span class="result-label">合計</span>
                  <span class="result-value">{{ result.amounts.pensionTotal | number }}円</span>
                </div>
              </div>
            </div>

            <div class="result-section total-section">
              <h3>トータル</h3>
              <div class="result-grid">
                <div class="result-item">
                  <span class="result-label">本人負担合計</span>
                  <span class="result-value employee large">{{ result.amounts.totalEmployee | number }}円</span>
                </div>
                <div class="result-item">
                  <span class="result-label">会社負担合計</span>
                  <span class="result-value employer large">{{ result.amounts.totalEmployer | number }}円</span>
                </div>
                <div class="result-item">
                  <span class="result-label">合計額</span>
                  <span class="result-value large">
                    {{ (result.amounts.totalEmployee + result.amounts.totalEmployer) | number }}円
                  </span>
                </div>
              </div>
            </div>
          </div>
        </mat-card>
      </ng-container>

      <ng-template #noResult>
        <mat-card class="result-card placeholder">
          <div class="result-header">
            <h2>
              <mat-icon>assessment</mat-icon>
              計算結果
            </h2>
          </div>
          <div class="placeholder-content">
            <mat-icon>info</mat-icon>
            <p>
              まだ計算されていません。上記の入力項目を入力して「シミュレーション実行」ボタンを押してください。
            </p>
          </div>
        </mat-card>
      </ng-template>
    </section>
  `,
  styles: [
    `
      .header-card {
        margin-bottom: 1.5rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .header-card ::ng-deep .mat-mdc-card-content {
        padding: 0;
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem;
      }

      .header-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 12px;
      }

      .header-icon mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: white;
      }

      .header-text h1 {
        margin: 0 0 0.5rem 0;
        font-size: 1.75rem;
        font-weight: 600;
      }

      .header-text p {
        margin: 0;
        opacity: 0.9;
        font-size: 1rem;
      }

      .content-card {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        margin-bottom: 1.5rem;
      }

      .page-header {
        margin-bottom: 2rem;
        padding-bottom: 1.5rem;
        border-bottom: 2px solid #e0e0e0;
      }

      .page-title-section h2 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0 0 0.5rem 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #333;
      }

      .page-title-section h2 mat-icon {
        color: #667eea;
      }

      .page-title-section p {
        margin: 0;
        color: #666;
        font-size: 0.95rem;
      }

      .simulator-form {
        margin-top: 1rem;
      }

      .form-section {
        margin-bottom: 1.5rem;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
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

      button[mat-raised-button] {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      button[mat-raised-button]:hover:not(:disabled) {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
      }

      .result-card {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .result-header {
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid #e0e0e0;
      }

      .result-header h2 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #333;
      }

      .result-header h2 mat-icon {
        color: #667eea;
      }

      .result-content {
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }

      .result-section {
        padding: 1.5rem;
        background: #f5f5f5;
        border-radius: 8px;
      }

      .result-section h3 {
        margin: 0 0 1rem 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: #333;
      }

      .result-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      }

      .result-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .result-label {
        font-size: 0.875rem;
        color: #666;
        font-weight: 500;
      }

      .result-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: #333;
      }

      .result-value.employee {
        color: #1976d2;
      }

      .result-value.employer {
        color: #2e7d32;
      }

      .result-value.large {
        font-size: 1.5rem;
      }

      .total-section {
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      }

      .placeholder-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 3rem;
        color: #999;
        text-align: center;
      }

      .placeholder-content mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #ccc;
      }

      .placeholder-content p {
        margin: 0;
        font-size: 1rem;
      }

      @media (max-width: 768px) {
        .header-content {
          flex-direction: column;
          text-align: center;
        }

        .form-grid {
          grid-template-columns: 1fr;
        }

        .result-grid {
          grid-template-columns: 1fr;
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
        errorMessage += ' マスタ管理画面で設定してください。';
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
