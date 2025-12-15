import { Component, inject, signal, computed } from '@angular/core';
import { DecimalPipe, NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { firstValueFrom } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import {
  MonthlyPremiumCalculationResult,
  roundForEmployeeDeduction,
  isCareInsuranceTarget as checkIsCareInsuranceTarget
} from '../../utils/premium-calculator';
import { YearMonthString } from '../../types';

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
    MatRadioModule,
    MatSnackBarModule,
    MatTableModule,
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
            <!-- 計算モード選択 -->
            <div class="form-row mb-4">
              <div class="form-group">
                <label class="form-label">計算モード</label>
                <mat-radio-group formControlName="calculationMode" class="radio-group">
                  <mat-radio-button value="single">単月計算</mat-radio-button>
                  <mat-radio-button value="multiple">複数月計算</mat-radio-button>
                </mat-radio-group>
              </div>
            </div>

            <!-- 複数月計算の場合のみ、期間指定 -->
            <div class="form-row flex-row gap-3 flex-wrap mb-3" *ngIf="form.get('calculationMode')?.value === 'multiple'">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>開始年月</mat-label>
                <input matInput type="month" formControlName="startYearMonth" required />
                <mat-error *ngIf="form.get('startYearMonth')?.hasError('required')">
                  開始年月を選択してください
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>終了年月</mat-label>
                <input matInput type="month" formControlName="endYearMonth" required />
                <mat-error *ngIf="form.get('endYearMonth')?.hasError('required')">
                  終了年月を選択してください
                </mat-error>
                <mat-error *ngIf="form.get('endYearMonth')?.hasError('invalidRange')">
                  終了年月は開始年月以降を選択してください
                </mat-error>
              </mat-form-field>
            </div>

            <div class="form-row flex-row gap-3 flex-wrap mb-3">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>報酬月額（円）</mat-label>
                <input matInput type="number" formControlName="salary" />
                <mat-hint>参考用（等級・標準報酬は手動入力）</mat-hint>
                <mat-error *ngIf="form.get('salary')?.hasError('min')">
                  1円以上の値を入力してください
                </mat-error>
              </mat-form-field>
            </div>

            <div class="form-row flex-row gap-3 flex-wrap mb-3">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>健康保険等級</mat-label>
                <input matInput type="number" formControlName="healthGrade" />
                <mat-error
                  *ngIf="
                    form.get('healthGrade')?.hasError('min') ||
                    form.get('healthGrade')?.hasError('max')
                  "
                >
                  1以上の値を入力してください
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>健康保険 標準報酬月額</mat-label>
                <input matInput type="number" formControlName="healthStandardMonthly" />
                <mat-error *ngIf="form.get('healthStandardMonthly')?.hasError('min')">
                  1円以上の値を入力してください
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>厚生年金等級</mat-label>
                <input matInput type="number" formControlName="pensionGrade" />
                <mat-error
                  *ngIf="
                    form.get('pensionGrade')?.hasError('min') ||
                    form.get('pensionGrade')?.hasError('max')
                  "
                >
                  1以上の値を入力してください
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>厚生年金 標準報酬月額</mat-label>
                <input matInput type="number" formControlName="pensionStandardMonthly" />
                <mat-error *ngIf="form.get('pensionStandardMonthly')?.hasError('min')">
                  1円以上の値を入力してください
                </mat-error>
              </mat-form-field>
            </div>

            <mat-checkbox formControlName="isCareInsuranceTarget">
              介護保険対象（40〜64歳）
            </mat-checkbox>
          </div>

          <!-- 保険料率セクション -->
          <div class="form-section rate-section">
            <div class="section-header">
              <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                <mat-icon color="primary">percent</mat-icon>
                保険料率（%）
              </h3>
            </div>
            <div class="form-row flex-row gap-3 flex-wrap mb-3">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>健康保険料率（%）</mat-label>
                <input matInput type="number" formControlName="healthRate" step="0.0001" required />
                <span matSuffix>%</span>
                <mat-hint>例: 9.91（事業主＋被保険者合計）</mat-hint>
                <mat-error *ngIf="form.get('healthRate')?.hasError('required')">
                  健康保険料率を入力してください
                </mat-error>
                <mat-error *ngIf="form.get('healthRate')?.hasError('min')">
                  0以上の値を入力してください
                </mat-error>
                <mat-error *ngIf="form.get('healthRate')?.hasError('max')">
                  100以下の値を入力してください
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>介護保険料率（%）</mat-label>
                <input matInput type="number" formControlName="careRate" step="0.0001" />
                <span matSuffix>%</span>
                <mat-hint>例: 1.91（事業主＋被保険者合計）</mat-hint>
                <mat-error *ngIf="form.get('careRate')?.hasError('min')">
                  0以上の値を入力してください
                </mat-error>
                <mat-error *ngIf="form.get('careRate')?.hasError('max')">
                  100以下の値を入力してください
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>厚生年金保険料率（%）</mat-label>
                <input matInput type="number" formControlName="pensionRate" step="0.0001" required />
                <span matSuffix>%</span>
                <mat-hint>例: 18.3（事業主＋被保険者合計）</mat-hint>
                <mat-error *ngIf="form.get('pensionRate')?.hasError('required')">
                  厚生年金保険料率を入力してください
                </mat-error>
                <mat-error *ngIf="form.get('pensionRate')?.hasError('min')">
                  0以上の値を入力してください
                </mat-error>
                <mat-error *ngIf="form.get('pensionRate')?.hasError('max')">
                  100以下の値を入力してください
                </mat-error>
              </mat-form-field>
            </div>
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

      <ng-container *ngIf="calculationResult() || multipleMonthResults().length > 0; else noResult">
        <!-- 単月計算結果 -->
        <ng-container *ngIf="form.get('calculationMode')?.value === 'single' && calculationResult() as result">
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
                  健康保険・介護保険（合算）
                </h3>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">本人負担額</span>
                  <span class="value employee">{{ result.amounts.healthCareEmployee | number }}円</span>
                </div>
                <div class="info-item">
                  <span class="label">会社負担額（参考）</span>
                  <span class="value employer">{{ result.amounts.healthCareEmployer | number }}円</span>
                </div>
                <div class="info-item">
                  <span class="label">全額（端数処理前）</span>
                  <span class="value">{{ result.amounts.healthCareFull | number:'1.0-2' }}円</span>
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
                  <span class="label">会社負担額（参考）</span>
                  <span class="value employer">{{ result.amounts.pensionEmployer | number }}円</span>
                </div>
                <div class="info-item">
                  <span class="label">全額（端数処理前）</span>
                  <span class="value">{{ result.amounts.pensionFull | number:'1.0-2' }}円</span>
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
                  <span class="label">全額（端数処理前）</span>
                  <span class="value large">
                    {{ result.amounts.totalFull | number:'1.0-2' }}円
                  </span>
                </div>
              </div>
            </div>
          </div>
        </mat-card>
        </ng-container>

        <!-- 複数月計算結果 -->
        <ng-container *ngIf="form.get('calculationMode')?.value === 'multiple' && multipleMonthResults().length > 0">
          <mat-card class="content-card">
            <div class="flex-row justify-between align-center mb-4">
              <div>
                <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
                  <mat-icon color="primary">assessment</mat-icon> 計算結果（{{ multipleMonthResults().length }}ヶ月分）
                </h2>
              </div>
            </div>

            <div class="result-content">
              <div class="info-section">
                <div class="info-section-header">
                  <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                    月別計算結果
                  </h3>
                </div>
                <div class="table-container">
                  <table mat-table [dataSource]="multipleMonthResults()" class="results-table">
                    <ng-container matColumnDef="yearMonth">
                      <th mat-header-cell *matHeaderCellDef>対象年月</th>
                      <td mat-cell *matCellDef="let row">{{ row.yearMonth }}</td>
                    </ng-container>

                    <ng-container matColumnDef="healthCareEmployee">
                      <th mat-header-cell *matHeaderCellDef>健保・介護<br/>本人負担</th>
                      <td mat-cell *matCellDef="let row">{{ row.amounts.healthCareEmployee | number }}円</td>
                    </ng-container>

                    <ng-container matColumnDef="pensionEmployee">
                      <th mat-header-cell *matHeaderCellDef>厚生年金<br/>本人負担</th>
                      <td mat-cell *matCellDef="let row">{{ row.amounts.pensionEmployee | number }}円</td>
                    </ng-container>

                    <ng-container matColumnDef="totalEmployee">
                      <th mat-header-cell *matHeaderCellDef>本人負担<br/>合計</th>
                      <td mat-cell *matCellDef="let row" class="total-cell">
                        <strong>{{ row.amounts.totalEmployee | number }}円</strong>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="healthCareEmployer">
                      <th mat-header-cell *matHeaderCellDef>健保・介護<br/>会社負担</th>
                      <td mat-cell *matCellDef="let row">{{ row.amounts.healthCareEmployer | number }}円</td>
                    </ng-container>

                    <ng-container matColumnDef="pensionEmployer">
                      <th mat-header-cell *matHeaderCellDef>厚生年金<br/>会社負担</th>
                      <td mat-cell *matCellDef="let row">{{ row.amounts.pensionEmployer | number }}円</td>
                    </ng-container>

                    <ng-container matColumnDef="totalEmployer">
                      <th mat-header-cell *matHeaderCellDef>会社負担<br/>合計</th>
                      <td mat-cell *matCellDef="let row" class="total-cell">
                        <strong>{{ row.amounts.totalEmployer | number }}円</strong>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
                  </table>
                </div>
              </div>

              <div class="info-section total-section">
                <div class="info-section-header">
                  <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                    合計
                  </h3>
                </div>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="label">本人負担合計</span>
                    <span class="value employee large">{{ totalAmounts().totalEmployee | number }}円</span>
                  </div>
                  <div class="info-item">
                    <span class="label">会社負担合計</span>
                    <span class="value employer large">{{ totalAmounts().totalEmployer | number }}円</span>
                  </div>
                  <div class="info-item">
                    <span class="label">全額合計（端数処理前）</span>
                    <span class="value large">{{ totalAmounts().totalFull | number:'1.0-2' }}円</span>
                  </div>
                </div>
              </div>
            </div>
          </mat-card>
        </ng-container>
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
      }

        @media (max-width: 600px) {
        .page-container {
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

      .placeholder-card .placeholder-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        color: #999;
      }

      .placeholder-card .placeholder-content mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
          margin-bottom: 16px;
          opacity: 0.3;
      }

      .placeholder-card .placeholder-content p {
        margin: 0;
          font-size: 14px;
      }

      /* フォームセクション */
      .form-section {
        margin-bottom: 24px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .form-label {
        font-weight: 500;
        color: rgba(0, 0, 0, 0.87);
        font-size: 14px;
      }

      .radio-group {
        display: flex;
        gap: 16px;
      }

      .rate-section {
        padding: 16px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        background-color: #fafafa;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .reset-button {
        font-size: 12px;
      }

      /* テーブルスタイル */
      .table-container {
        overflow-x: auto;
      }

      .results-table {
        width: 100%;
      }

      .results-table th {
        font-weight: 500;
        background-color: #f5f5f5;
        white-space: nowrap;
      }

      .results-table td {
        text-align: right;
      }

      .results-table td.total-cell {
        font-weight: 600;
        color: #1976d2;
      }

      .results-table th:first-child,
      .results-table td:first-child {
        text-align: left;
      }
    `
  ]
})
export class SimulatorPage {
  private readonly fb = inject(FormBuilder);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly snackBar = inject(MatSnackBar);

  readonly office$ = this.currentOffice.office$;

  readonly calculationResult = signal<MonthlyPremiumCalculationResult | null>(null);
  readonly multipleMonthResults = signal<MonthlyPremiumCalculationResult[]>([]);
  readonly loading = signal(false);
  readonly displayedColumns = ['yearMonth', 'healthCareEmployee', 'pensionEmployee', 'totalEmployee', 'healthCareEmployer', 'pensionEmployer', 'totalEmployer'];

  readonly form = this.fb.group({
    calculationMode: ['single' as 'single' | 'multiple', Validators.required],
    startYearMonth: [null as string | null],
    endYearMonth: [null as string | null],
    salary: [null as number | null, [Validators.min(1)]],
    healthGrade: [null as number | null, [Validators.min(1), Validators.max(100)]],
    healthStandardMonthly: [null as number | null, [Validators.min(1)]],
    pensionGrade: [null as number | null, [Validators.min(1), Validators.max(100)]],
    pensionStandardMonthly: [null as number | null, [Validators.min(1)]],
    isCareInsuranceTarget: [false],
    healthRate: [null as number | null, [Validators.required, Validators.min(0), Validators.max(100)]],
    careRate: [null as number | null, [Validators.min(0), Validators.max(100)]],
    pensionRate: [null as number | null, [Validators.required, Validators.min(0), Validators.max(100)]]
  });

  readonly totalAmounts = computed(() => {
    const results = this.multipleMonthResults();
    if (results.length === 0) {
      return { totalEmployee: 0, totalEmployer: 0, totalFull: 0 };
    }
    return results.reduce(
      (acc, result) => ({
        totalEmployee: acc.totalEmployee + result.amounts.totalEmployee,
        totalEmployer: acc.totalEmployer + result.amounts.totalEmployer,
        totalFull: acc.totalFull + result.amounts.totalFull
      }),
      { totalEmployee: 0, totalEmployer: 0, totalFull: 0 }
    );
  });

  constructor() {
    // 計算モード変更時にバリデーションを更新
    this.form.get('calculationMode')?.valueChanges.subscribe((mode) => {
      const startYearMonthControl = this.form.get('startYearMonth');
      const endYearMonthControl = this.form.get('endYearMonth');
      if (mode === 'multiple') {
        startYearMonthControl?.setValidators([Validators.required]);
        endYearMonthControl?.setValidators([Validators.required, this.validateDateRange.bind(this)]);
      } else {
        startYearMonthControl?.clearValidators();
        endYearMonthControl?.clearValidators();
      }
      startYearMonthControl?.updateValueAndValidity();
      endYearMonthControl?.updateValueAndValidity();
    });
  }

  private validateDateRange(control: any): { [key: string]: any } | null {
    const startYearMonth = this.form.get('startYearMonth')?.value;
    const endYearMonth = control.value;
    if (!startYearMonth || !endYearMonth) {
      return null;
    }
    if (endYearMonth < startYearMonth) {
      return { invalidRange: true };
    }
    return null;
  }

  private generateYearMonthRange(start: string, end: string): YearMonthString[] {
    const months: YearMonthString[] = [];
    const startDate = new Date(start + '-01');
    const endDate = new Date(end + '-01');
    
    let current = new Date(startDate);
    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}` as YearMonthString);
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  }

  async onSimulate(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    try {
      this.loading.set(true);
      this.calculationResult.set(null);
      this.multipleMonthResults.set([]);

      const office = await firstValueFrom(this.office$);
      if (!office) {
        this.snackBar.open('事業所情報を取得できませんでした', '閉じる', { duration: 3000 });
        return;
      }

      const formValue = this.form.value;
      const calculationMode = formValue.calculationMode as 'single' | 'multiple';
      const healthGrade = formValue.healthGrade != null ? Number(formValue.healthGrade) : null;
      const pensionGrade = formValue.pensionGrade != null ? Number(formValue.pensionGrade) : null;
      const healthStandardMonthly =
        formValue.healthStandardMonthly != null ? Number(formValue.healthStandardMonthly) : null;
      const pensionStandardMonthly =
        formValue.pensionStandardMonthly != null ? Number(formValue.pensionStandardMonthly) : null;
      const isCareInsuranceTarget = formValue.isCareInsuranceTarget === true;

      // 等級・標準報酬のバリデーション
      const hasHealth =
        healthGrade != null && healthGrade > 0 && healthStandardMonthly != null && healthStandardMonthly > 0;
      const hasPension =
        pensionGrade != null &&
        pensionGrade > 0 &&
        pensionStandardMonthly != null &&
        pensionStandardMonthly > 0;

      if (!hasHealth && !hasPension) {
        this.snackBar.open(
          '健保または厚年の等級・標準報酬月額を入力してください。',
          '閉じる',
          { duration: 4000 }
        );
        return;
      }

      // 保険料率のバリデーション
      const healthRate = formValue.healthRate != null ? Number(formValue.healthRate) / 100 : null;
      const pensionRate = formValue.pensionRate != null ? Number(formValue.pensionRate) / 100 : null;

      if (healthRate == null || pensionRate == null) {
        this.snackBar.open('健康保険料率と厚生年金保険料率を入力してください。', '閉じる', { duration: 3000 });
        return;
      }

      // 計算対象年月のリストを生成
      const yearMonths: YearMonthString[] = [];
      if (calculationMode === 'single') {
        // 単月計算の場合、現在の年月を使用
        yearMonths.push(new Date().toISOString().substring(0, 7) as YearMonthString);
      } else {
        const startYearMonth = formValue.startYearMonth as string;
        const endYearMonth = formValue.endYearMonth as string;
        if (!startYearMonth || !endYearMonth) {
          this.snackBar.open('開始年月と終了年月を選択してください', '閉じる', { duration: 3000 });
          return;
        }
        yearMonths.push(...this.generateYearMonthRange(startYearMonth, endYearMonth));
      }

      // 介護保険対象判定用の生年月日
      const birthDate = isCareInsuranceTarget ? '1980-01-01' : '2005-01-01';

      // 保険料率を取得（フォームの値を使用）
      const careRate = formValue.careRate != null ? Number(formValue.careRate) / 100 : 0;

      const results: MonthlyPremiumCalculationResult[] = [];

      for (const yearMonth of yearMonths) {
        // シンプルな保険料計算（資格取得日などのチェックなし）
        const healthStandard = healthStandardMonthly ?? 0;
        const pensionStandard = pensionStandardMonthly ?? 0;

        // 介護保険対象判定
        const isCareTarget = checkIsCareInsuranceTarget(birthDate, yearMonth);
        const actualCareRate = isCareTarget && careRate > 0 ? careRate : 0;

        // 健康保険 + 介護保険（合算）
        const healthTotalRate = healthRate! + actualCareRate;
        const healthCareFull = hasHealth ? healthStandard * healthTotalRate : 0;
        const healthCareEmployee = roundForEmployeeDeduction(healthCareFull / 2);
        const healthCareEmployer = healthCareFull - healthCareEmployee;

        // 介護保険単体（参考値）
        const careFull = hasHealth ? healthStandard * actualCareRate : 0;
        const careEmployee = roundForEmployeeDeduction(careFull / 2);
        const careEmployer = careFull - careEmployee;

        // 厚生年金
        const pensionFull = hasPension ? pensionStandard * pensionRate! : 0;
        const pensionEmployee = roundForEmployeeDeduction(pensionFull / 2);
        const pensionEmployer = pensionFull - pensionEmployee;

        // 合計
        const totalFull = healthCareFull + pensionFull;
        const totalEmployee = healthCareEmployee + pensionEmployee;
        const totalEmployer = healthCareEmployer + pensionEmployer;

        const result: MonthlyPremiumCalculationResult = {
          employeeId: 'temp',
        officeId: office.id,
        yearMonth,
          healthGrade: hasHealth ? healthGrade! : 0,
          healthStandardMonthly: healthStandard,
          pensionGrade: hasPension ? pensionGrade! : 0,
          pensionStandardMonthly: pensionStandard,
          amounts: {
            healthCareFull,
            healthCareEmployee,
            healthCareEmployer,
            pensionFull,
            pensionEmployee,
            pensionEmployer,
            totalFull,
            totalEmployee,
            totalEmployer,
            // deprecated fields（後方互換）
            healthTotal: healthCareFull,
            healthEmployee: healthCareEmployee,
            healthEmployer: healthCareEmployer,
            careTotal: careFull,
            careEmployee,
            careEmployer,
            pensionTotal: pensionFull
          }
        };

        results.push(result);
      }

      if (calculationMode === 'single') {
        this.calculationResult.set(results[0]);
      } else {
        this.multipleMonthResults.set(results);
      }
    } catch (error) {
      console.error('シミュレーション実行に失敗しました', error);
      this.snackBar.open('シミュレーション実行に失敗しました', '閉じる', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }
}
