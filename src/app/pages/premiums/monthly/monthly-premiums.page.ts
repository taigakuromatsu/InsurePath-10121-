import { AsyncPipe, DecimalPipe, NgIf, PercentPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

import { CurrentOfficeService } from '../../../services/current-office.service';
import { EmployeesService } from '../../../services/employees.service';
import { MastersService } from '../../../services/masters.service';
import { MonthlyPremiumsService } from '../../../services/monthly-premiums.service';
import { Employee, MonthlyPremium, Office } from '../../../types';

@Component({
  selector: 'ip-monthly-premiums-page',
  standalone: true,
  imports: [
    MatCardModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    AsyncPipe,
    DecimalPipe,
    NgIf,
    PercentPipe
  ],
  template: `
    <section class="page monthly-premiums">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>account_balance_wallet</mat-icon>
          </div>
          <div class="header-text">
        <h1>月次保険料 一覧・再計算</h1>
        <p>
          対象年月を指定し、マスタで定義された保険料率を用いて
          現在の事業所に所属する社会保険加入者の月次保険料を一括計算・保存します。
        </p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="page-header">
          <div class="page-title-section">
            <h2>
              <mat-icon>calculate</mat-icon>
              保険料計算
            </h2>
            <p>対象年月とマスタ設定に基づいて月次保険料を計算します。</p>
          </div>
        </div>

        <form [formGroup]="form" (ngSubmit)="onCalculateAndSave()" class="premium-form">
          <div class="form-section">
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>対象年月</mat-label>
              <input matInput type="month" formControlName="yearMonth" required />
            </mat-form-field>
          </div>

          <div class="rate-summary" *ngIf="rateSummary() as r">
              <h3 class="rate-summary-title">
                <mat-icon>info</mat-icon>
                適用される保険料率（{{ form.get('yearMonth')?.value }}）
              </h3>
              <div class="rate-list">
                <div class="rate-item">
                  <span class="rate-label">健康保険</span>
                  <span class="rate-value" [class.not-set]="r.healthRate == null">
                    {{ r.healthRate != null ? (r.healthRate | percent: '1.2-2') : '未設定' }}
                  </span>
                </div>
                <div class="rate-item">
                  <span class="rate-label">介護保険</span>
                  <span class="rate-value" [class.not-set]="r.careRate == null">
                    {{ r.careRate != null ? (r.careRate | percent: '1.2-2') : '-' }}
                  </span>
                </div>
                <div class="rate-item">
                  <span class="rate-label">厚生年金</span>
                  <span class="rate-value" [class.not-set]="r.pensionRate == null">
                    {{ r.pensionRate != null ? (r.pensionRate | percent: '1.2-2') : '未設定' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="actions">
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="form.invalid || !(officeId$ | async) || loading()"
            >
              <mat-spinner *ngIf="loading()" diameter="20" class="inline-spinner"></mat-spinner>
              <mat-icon *ngIf="!loading()">calculate</mat-icon>
              計算して保存
            </button>
          </div>
        </form>
      </mat-card>

      <mat-card *ngIf="results().length > 0" class="result-card">
        <div class="result-header">
          <h2>
            <mat-icon>list</mat-icon>
            計算結果一覧（{{ form.get('yearMonth')?.value }}）
          </h2>
        </div>

        <div class="table-container">
        <table mat-table [dataSource]="results()" class="premiums-table">
          <ng-container matColumnDef="employeeName">
            <th mat-header-cell *matHeaderCellDef>氏名</th>
            <td mat-cell *matCellDef="let row">{{ row.employeeName }}</td>
          </ng-container>

          <ng-container matColumnDef="healthStandardMonthly">
            <th mat-header-cell *matHeaderCellDef>標準報酬（健保）</th>
            <td mat-cell *matCellDef="let row">{{ row.healthStandardMonthly | number }}</td>
          </ng-container>

          <ng-container matColumnDef="healthEmployee">
            <th mat-header-cell *matHeaderCellDef>健康保険 本人</th>
            <td mat-cell *matCellDef="let row">{{ row.healthEmployee | number }}</td>
          </ng-container>

          <ng-container matColumnDef="healthEmployer">
            <th mat-header-cell *matHeaderCellDef>健康保険 会社</th>
            <td mat-cell *matCellDef="let row">{{ row.healthEmployer | number }}</td>
          </ng-container>

          <ng-container matColumnDef="careEmployee">
            <th mat-header-cell *matHeaderCellDef>介護保険 本人</th>
            <td mat-cell *matCellDef="let row">{{ row.careEmployee != null ? (row.careEmployee | number) : '-' }}</td>
          </ng-container>

          <ng-container matColumnDef="careEmployer">
            <th mat-header-cell *matHeaderCellDef>介護保険 会社</th>
            <td mat-cell *matCellDef="let row">{{ row.careEmployer != null ? (row.careEmployer | number) : '-' }}</td>
          </ng-container>

          <ng-container matColumnDef="pensionEmployee">
            <th mat-header-cell *matHeaderCellDef>厚生年金 本人</th>
            <td mat-cell *matCellDef="let row">{{ row.pensionEmployee | number }}</td>
          </ng-container>

          <ng-container matColumnDef="pensionEmployer">
            <th mat-header-cell *matHeaderCellDef>厚生年金 会社</th>
            <td mat-cell *matCellDef="let row">{{ row.pensionEmployer | number }}</td>
          </ng-container>

          <ng-container matColumnDef="totalEmployee">
            <th mat-header-cell *matHeaderCellDef>本人合計</th>
            <td mat-cell *matCellDef="let row">{{ row.totalEmployee | number }}</td>
          </ng-container>

          <ng-container matColumnDef="totalEmployer">
            <th mat-header-cell *matHeaderCellDef>会社合計</th>
            <td mat-cell *matCellDef="let row">{{ row.totalEmployer | number }}</td>
          </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns" class="table-header-row"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns" class="table-row"></tr>
        </table>
        </div>

        <div class="totals">
          <div class="total-item">
            <span class="total-label">事業所合計（本人負担）</span>
            <span class="total-value employee">{{ totalEmployee() | number }}円</span>
          </div>
          <div class="total-item">
            <span class="total-label">事業所合計（会社負担）</span>
            <span class="total-value employer">{{ totalEmployer() | number }}円</span>
          </div>
        </div>
      </mat-card>
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

      .premium-form {
        margin-top: 1rem;
      }

      .form-section {
        margin-bottom: 1.5rem;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .rate-summary {
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        padding: 1.5rem;
        border-radius: 8px;
        margin-top: 1rem;
      }

      .rate-summary-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0 0 1rem 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: #333;
      }

      .rate-summary-title mat-icon {
        color: #667eea;
      }

      .rate-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      }

      .rate-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
        background: white;
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      }

      .rate-label {
        font-size: 0.875rem;
        color: #666;
        font-weight: 500;
      }

      .rate-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: #1976d2;
      }

      .rate-value.not-set {
        color: #999;
        font-weight: 500;
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

      .table-container {
        position: relative;
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        margin-bottom: 1.5rem;
      }

      table.premiums-table {
        width: 100%;
        background: white;
      }

      .table-header-row {
        background: #f5f5f5;
      }

      table.premiums-table th {
        font-weight: 600;
        color: #555;
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 16px;
      }

      table.premiums-table td {
        padding: 16px;
        border-bottom: 1px solid #f0f0f0;
      }

      .table-row {
        transition: background-color 0.2s ease;
      }

      .table-row:hover {
        background-color: #f9f9f9;
      }

      .table-row:last-child td {
        border-bottom: none;
      }

      .totals {
        display: flex;
        gap: 2rem;
        padding: 1.5rem;
        background: #f5f5f5;
        border-radius: 8px;
        flex-wrap: wrap;
      }

      .total-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        flex: 1;
        min-width: 200px;
      }

      .total-label {
        font-size: 0.875rem;
        color: #666;
        font-weight: 500;
      }

      .total-value {
        font-size: 1.75rem;
        font-weight: 700;
      }

      .total-value.employee {
        color: #1976d2;
      }

      .total-value.employer {
        color: #2e7d32;
      }

      @media (max-width: 768px) {
        .header-content {
          flex-direction: column;
          text-align: center;
        }

        .rate-list {
          grid-template-columns: 1fr;
        }

        .totals {
          flex-direction: column;
        }
      }
    `
  ]
})
export class MonthlyPremiumsPage {
  private readonly fb = inject(FormBuilder);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly employeesService = inject(EmployeesService);
  private readonly mastersService = inject(MastersService);
  private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(Auth);

  readonly officeId$ = this.currentOffice.officeId$;
  readonly loading = signal(false);
  readonly results = signal<(MonthlyPremium & { employeeName: string })[]>([]);
  readonly rateSummary = signal<{ healthRate?: number; careRate?: number; pensionRate?: number } | null>(null);

  readonly form = this.fb.group({
    yearMonth: [new Date().toISOString().substring(0, 7), Validators.required]
  });

  readonly displayedColumns = [
    'employeeName',
    'healthStandardMonthly',
    'healthEmployee',
    'healthEmployer',
    'careEmployee',
    'careEmployer',
    'pensionEmployee',
    'pensionEmployer',
    'totalEmployee',
    'totalEmployer'
  ];

  readonly totalEmployee = computed(() => {
    return this.results().reduce((sum, r) => sum + r.totalEmployee, 0);
  });

  readonly totalEmployer = computed(() => {
    return this.results().reduce((sum, r) => sum + r.totalEmployer, 0);
  });

  constructor() {
    this.form.get('yearMonth')?.valueChanges.subscribe(() => {
      this.refreshRateSummary();
    });
    this.refreshRateSummary();
  }

  private async refreshRateSummary(office?: Office | null, yearMonth?: string | null): Promise<void> {
    const targetOffice = office ?? (await firstValueFrom(this.currentOffice.office$));
    const targetYearMonth = yearMonth ?? this.form.get('yearMonth')?.value;
    if (!targetOffice || !targetYearMonth) {
      this.rateSummary.set(null);
      return;
    }
    try {
      const rates = await this.mastersService.getRatesForYearMonth(
        targetOffice,
        targetYearMonth as string
      );
      this.rateSummary.set(rates);
    } catch (error) {
      console.error(error);
      this.rateSummary.set(null);
    }
  }

  async onCalculateAndSave(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    try {
      this.loading.set(true);

      const officeId = await firstValueFrom(this.officeId$);
      if (!officeId) {
        this.snackBar.open('事業所が設定されていません', '閉じる', { duration: 3000 });
        return;
      }

      const office = await firstValueFrom(this.currentOffice.office$);
      if (!office) {
        this.snackBar.open('事業所情報を取得できませんでした', '閉じる', { duration: 3000 });
        return;
      }

      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        this.snackBar.open('ログイン情報を取得できませんでした', '閉じる', { duration: 3000 });
        return;
      }
      const calculatedByUserId = currentUser.uid;

      const formValue = this.form.value;
      const yearMonth = formValue.yearMonth as string;
      const calcDate = new Date().toISOString();

      await this.refreshRateSummary(office, yearMonth);

      const employees = await firstValueFrom(this.employeesService.list(officeId));

      const savedPremiums = await this.monthlyPremiumsService.saveForMonth({
        officeId,
        yearMonth,
        calcDate,
        employees: employees as Employee[],
        calculatedByUserId
      });

      const employeeNameMap = new Map<string, string>();
      employees.forEach((emp) => {
        employeeNameMap.set(emp.id, emp.name);
      });

      const resultsWithName = savedPremiums.map((premium) => ({
        ...premium,
        employeeName: employeeNameMap.get(premium.employeeId) ?? '(不明)'
      }));

      this.results.set(resultsWithName);

      const skippedCount = employees.length - savedPremiums.length;
      let message = `${yearMonth} 分の月次保険料を ${savedPremiums.length} 件計算・保存しました`;
      if (skippedCount > 0) {
        message += `（${skippedCount} 件スキップ：未加入または標準報酬未設定）`;
      }
      this.snackBar.open(message, '閉じる', { duration: 5000 });
    } catch (error) {
      console.error('月次保険料の計算・保存に失敗しました', error);
      this.snackBar.open('月次保険料の計算・保存に失敗しました。マスタ設定を確認してください。', '閉じる', {
        duration: 5000
      });
    } finally {
      this.loading.set(false);
    }
  }
}
