import { AsyncPipe, DecimalPipe, NgIf } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
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
    MatTableModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    AsyncPipe,
    DecimalPipe,
    NgIf
  ],
  template: `
    <section class="page monthly-premiums">
      <mat-card>
        <h1>月次保険料 一覧・再計算</h1>
        <p>
          対象年月を指定し、マスタで定義された保険料率を用いて
          現在の事業所に所属する社会保険加入者の月次保険料を一括計算・保存します。
        </p>

        <form [formGroup]="form" (ngSubmit)="onCalculateAndSave()" class="premium-form">
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>対象年月</mat-label>
              <input matInput type="month" formControlName="yearMonth" required />
            </mat-form-field>
          </div>

          <div class="rate-summary" *ngIf="rateSummary() as r">
            <p>適用される保険料率（{{ form.get('yearMonth')?.value }}）</p>
            <ul>
              <li>健康保険: {{ r.healthRate != null ? (r.healthRate | percent: '1.2-2') : '未設定' }}</li>
              <li>介護保険: {{ r.careRate != null ? (r.careRate | percent: '1.2-2') : '-' }}</li>
              <li>厚生年金: {{ r.pensionRate != null ? (r.pensionRate | percent: '1.2-2') : '未設定' }}</li>
            </ul>
          </div>

          <div class="actions">
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="form.invalid || !(officeId$ | async) || loading()"
            >
              <mat-spinner *ngIf="loading()" diameter="20" class="inline-spinner"></mat-spinner>
              計算して保存
            </button>
          </div>
        </form>
      </mat-card>

      <mat-card *ngIf="results().length > 0" class="result-card">
        <h2>計算結果一覧（{{ form.get('yearMonth')?.value }}）</h2>

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

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>

        <div class="totals">
          <strong>事業所合計（本人負担）: {{ totalEmployee() | number }}円</strong>
          <strong>事業所合計（会社負担）: {{ totalEmployer() | number }}円</strong>
        </div>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .premium-form {
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }

      .rate-summary {
        background: #fafafa;
        padding: 0.75rem 1rem;
        border-radius: 4px;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
      }

      .inline-spinner {
        margin-right: 8px;
      }

      table.premiums-table {
        width: 100%;
        margin-top: 1rem;
      }

      table.premiums-table th,
      table.premiums-table td {
        padding: 8px 12px;
      }

      .totals {
        display: flex;
        gap: 2rem;
        margin-top: 1rem;
        flex-wrap: wrap;
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
