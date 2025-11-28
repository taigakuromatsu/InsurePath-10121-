import { AsyncPipe, DecimalPipe, NgIf, NgFor, PercentPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom, map } from 'rxjs';

import { CurrentOfficeService } from '../../../services/current-office.service';
import { CurrentUserService } from '../../../services/current-user.service';
import { EmployeesService } from '../../../services/employees.service';
import { MastersService } from '../../../services/masters.service';
import { MonthlyPremiumsService } from '../../../services/monthly-premiums.service';
import { Employee, MonthlyPremium, Office } from '../../../types';
import { CsvExportService } from '../../../utils/csv-export.service';
import { HelpDialogComponent, HelpDialogData } from '../../../components/help-dialog.component';

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
    MatSelectModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    AsyncPipe,
    DecimalPipe,
    NgIf,
    NgFor,
    PercentPipe
  ],
  template: `
    <section class="page monthly-premiums">
      <mat-card class="content-card selection-card">
        <div class="page-header">
          <div class="page-title-section">
            <h2>
              <mat-icon>calendar_month</mat-icon>
              対象年月を選択
            </h2>
            <p>直近12ヶ月から閲覧する年月を選択できます。</p>
          </div>
        </div>

        <div class="year-month-selector">
          <mat-form-field appearance="outline">
            <mat-label>対象年月</mat-label>
            <mat-select
              [value]="selectedYearMonth()"
              (selectionChange)="onYearMonthSelectionChange($event.value)"
            >
              <mat-option *ngFor="let ym of yearMonthOptions()" [value]="ym">{{ ym }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </mat-card>

      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>account_balance_wallet</mat-icon>
          </div>
          <div class="header-text">
        <h1>
          月次保険料 一覧・再計算
          <button
            mat-icon-button
            class="help-button"
            type="button"
            (click)="openHelp()"
            aria-label="月次保険料のヘルプを表示"
          >
            <mat-icon>help_outline</mat-icon>
          </button>
        </h1>
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

      <mat-card class="result-card">
        <div class="result-header">
          <h2>
            <mat-icon>list</mat-icon>
            計算結果一覧（{{ selectedYearMonth() }}）
          </h2>
          <button
            mat-stroked-button
            color="primary"
            (click)="exportToCsv()"
            [disabled]="filteredRows().length === 0"
            *ngIf="canExport$ | async"
          >
            <mat-icon>download</mat-icon>
            CSVエクスポート
          </button>
        </div>

        <div class="filter-section">
          <mat-form-field appearance="outline" class="filter-input">
            <mat-label>従業員名で絞り込む</mat-label>
            <input
              matInput
              [value]="filterText()"
              (input)="filterText.set($any($event.target).value)"
              placeholder="従業員名を入力"
            />
            <mat-icon matSuffix>search</mat-icon>
            <button
              mat-icon-button
              matSuffix
              *ngIf="filterText()"
              (click)="filterText.set('')"
              type="button"
            >
              <mat-icon>clear</mat-icon>
            </button>
          </mat-form-field>
        </div>

        <div class="table-container">
        <table mat-table [dataSource]="filteredRows()" class="premiums-table">
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

        <div class="no-results" *ngIf="filteredRows().length === 0">
          <mat-icon>info</mat-icon>
          <span>該当するデータがありません。</span>
        </div>

        <div class="totals">
          <div class="total-item">
            <span class="total-label">事業所合計（本人負担）</span>
            <span class="total-value employee">{{ totalEmployee() | number }}円</span>
            <span class="total-note" *ngIf="filterText()">（絞り込み後: {{ filteredRows().length }}件）</span>
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

        .help-button {
          width: 36px;
          height: 36px;
          margin-left: 0.25rem;
          color: white;
        }

        .help-button mat-icon {
          font-size: 22px;
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

      .selection-card {
        margin-bottom: 1.5rem;
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

      .year-month-selector {
        max-width: 240px;
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
        display: flex;
        align-items: center;
        justify-content: space-between;
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

      .filter-section {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 1rem;
      }

      .filter-input {
        width: 320px;
        max-width: 100%;
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

      .total-note {
        color: #666;
        font-size: 0.9rem;
      }

      .no-results {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #666;
        margin-bottom: 1rem;
      }

      @media (max-width: 768px) {
        .header-content {
          flex-direction: column;
          text-align: center;
        }

        .rate-list {
          grid-template-columns: 1fr;
        }

        .filter-section {
          justify-content: flex-start;
        }

        .totals {
          flex-direction: column;
        }
      }
    `
  ]
})
  export class MonthlyPremiumsPage implements OnInit {
    private readonly fb = inject(FormBuilder);
    private readonly currentOffice = inject(CurrentOfficeService);
    private readonly currentUser = inject(CurrentUserService);
    private readonly employeesService = inject(EmployeesService);
    private readonly mastersService = inject(MastersService);
    private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly auth = inject(Auth);
    private readonly csvExportService = inject(CsvExportService);
    private readonly dialog = inject(MatDialog);

  readonly officeId$ = this.currentOffice.officeId$;
  readonly loading = signal(false);
  readonly rows = signal<(MonthlyPremium & { employeeName: string })[]>([]);
  readonly selectedYearMonth = signal<string>(new Date().toISOString().substring(0, 7));
  readonly filterText = signal<string>('');
  readonly rateSummary = signal<{ healthRate?: number; careRate?: number; pensionRate?: number } | null>(null);

  readonly canExport$ = this.currentUser.profile$.pipe(
    map((profile) => profile?.role === 'admin' || profile?.role === 'hr')
  );

  readonly yearMonthOptions = computed(() => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push(date.toISOString().substring(0, 7));
    }
    return options;
  });

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

  readonly filteredRows = computed(() => {
    const text = this.filterText().trim().toLowerCase();
    const base = this.rows();

    if (!text) {
      return base;
    }

    return base.filter((r) => (r.employeeName ?? '').toLowerCase().includes(text));
  });

  readonly totalEmployee = computed(() => {
    return this.filteredRows().reduce((sum, r) => sum + r.totalEmployee, 0);
  });

  readonly totalEmployer = computed(() => {
    return this.filteredRows().reduce((sum, r) => sum + r.totalEmployer, 0);
  });

  constructor() {
    this.form.get('yearMonth')?.valueChanges.subscribe(() => {
      this.refreshRateSummary();
    });
    this.refreshRateSummary();
  }

  ngOnInit(): void {
    this.loadPremiumsForYearMonth(this.selectedYearMonth());
  }

  openHelp(): void {
    this.dialog.open(HelpDialogComponent, {
      width: '720px',
      data: {
        topicIds: ['standardMonthlyReward'],
        title: '月次保険料に関するヘルプ'
      } satisfies HelpDialogData
    });
  }

  onYearMonthSelectionChange(yearMonth: string): void {
    this.selectedYearMonth.set(yearMonth);
    this.filterText.set('');
    this.loadPremiumsForYearMonth(yearMonth);
  }

  exportToCsv(): void {
    const rows = this.filteredRows();
    if (rows.length === 0) {
      this.snackBar.open('エクスポートするデータがありません', '閉じる', { duration: 3000 });
      return;
    }

    this.csvExportService.exportMonthlyPremiums(rows, this.selectedYearMonth());
    this.snackBar.open('CSVエクスポートが完了しました', '閉じる', { duration: 3000 });
  }

  private async loadPremiumsForYearMonth(yearMonth: string): Promise<void> {
    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) {
      this.rows.set([]);
      return;
    }

    try {
      const premiums = await firstValueFrom(
        this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)
      );

      const employees = await firstValueFrom(this.employeesService.list(officeId));
      const employeeNameMap = new Map<string, string>();
      employees.forEach((emp) => {
        employeeNameMap.set(emp.id, emp.name);
      });

      const rowsWithName = premiums.map((premium) => ({
        ...premium,
        employeeName: employeeNameMap.get(premium.employeeId) ?? '(不明)'
      }));

      this.rows.set(rowsWithName);
    } catch (error) {
      console.error('月次保険料の取得に失敗しました', error);
      this.snackBar.open('月次保険料の取得に失敗しました', '閉じる', { duration: 3000 });
      this.rows.set([]);
    }
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

      this.rows.set(resultsWithName);

      this.selectedYearMonth.set(yearMonth);
      await this.loadPremiumsForYearMonth(yearMonth);

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
