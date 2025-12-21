import { CommonModule, NgClass } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { EmployeesService } from '../../services/employees.service';
import {
  CsvImportService,
  CsvParseError,
  ValidationError
} from '../../utils/csv-import.service';
import { CsvExportService } from '../../utils/csv-export.service';
import { Employee } from '../../types';

export interface EmployeeImportDialogData {
  officeId: string;
}

export interface ImportError {
  rowIndex: number;
  message: string;
}

export interface ImportResult {
  successCount: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  errors: ImportError[];
}

interface PreviewRow {
  rowIndex: number;
  employee: Partial<Employee>;
}

interface PreviewColumn {
  key: keyof Partial<Employee>;
  label: string;
}

@Component({
  selector: 'ip-employee-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    NgClass
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">upload</mat-icon>
      従業員CSVインポート
    </h1>

    <div mat-dialog-content class="dialog-content">
      <section class="file-section content-card">
        <h3 class="mat-h3 flex-row align-center gap-2 m-0">
          <mat-icon>description</mat-icon>
          CSVファイルを選択
        </h3>
        <div class="file-input-row">
        <label class="file-input-label">
          <input type="file" accept=".csv" (change)="onFileSelected($event)" />
          <span class="file-input-button">
            <mat-icon>upload_file</mat-icon>
            ファイルを選択
          </span>
          <span class="file-name" *ngIf="selectedFileName">{{ selectedFileName }}</span>
        </label>
        <button
          mat-stroked-button
          type="button"
          (click)="downloadTemplate()"
          class="template-download-button"
        >
          <mat-icon>download</mat-icon>
            CSVテンプレート
        </button>
        </div>
        <p class="helper-text">
          エクスポートした形式、またはCSVテンプレートに従業員情報を入力したファイルを指定してください。
        </p>
        <div class="import-rules">
          <h4>主な入力ルール</h4>
          <ul>
            <li>必須項目: 氏名 / フリガナ / 生年月日 / 入社日 / 雇用形態</li>
            <li>雇用形態: regular(正社員) / contract(契約社員) / part(パート) / アルバイト / other(その他)</li>
            <li>給与区分: monthly(月給) / daily(日給) / hourly(時給) / annual(年俸) / other(その他)</li>
            <li>給与サイクル: monthly(月次) / twice_per_month(月2回) / weekly(週次) / other(その他)</li>
            <li>口座種別: ordinary(普通) / checking(当座) / savings(貯蓄) / other(その他)</li>
            <li>保険料免除月: maternity:2025-01,2025-02;childcare:2025-04（形式: kind:YYYY-MM,YYYY-MM;kind:YYYY-MM）</li>
            <li>学生・社会保険加入・主口座フラグ: true / false（小文字）</li>
            <li>日付: YYYY-MM-DD 形式（例: 2024-04-01）</li>
            <li>年月: YYYY-MM 形式（例: 2025-01）</li>
            <li>空欄は変更しません（更新インポート時のみ）。明示的に削除する場合は "__CLEAR__" を入力</li>
            <li>CSVテンプレートのヘッダ名は変更しないでください</li>
            <li># で始まる行はコメント行として無視されます</li>
          </ul>
          <div class="standard-reward-notice">
            <h4>標準報酬に関する重要なお知らせ</h4>
            <p>標準報酬は"標準報酬履歴"で管理します。CSVの標準報酬関連列（健康保険等級、健康保険標準報酬月額、健康保険適用開始年月、厚生年金等級、厚生年金標準報酬月額、厚生年金適用開始年月）は参照用で、インポートでは反映されません。</p>
          </div>
        </div>
      </section>

      <section *ngIf="previewRows.length" class="preview-section content-card">
        <div class="section-header">
          <h3 class="mat-h3 flex-row align-center gap-2 m-0">
            <mat-icon>preview</mat-icon>
            プレビュー (最大10件)
          </h3>
          <span class="summary-chip" [ngClass]="{ error: hasAnyErrors }">
            {{ validRowCount }} 件をインポート予定 / エラー {{ totalErrorCount }} 件
          </span>
        </div>
        <div class="preview-table-container">
          <table mat-table [dataSource]="previewRows" class="admin-table preview-table">
            <ng-container *ngFor="let column of previewColumns" [matColumnDef]="getColumnKey(column)">
              <th mat-header-cell *matHeaderCellDef>{{ column.label }}</th>
              <td
                mat-cell
                *matCellDef="let row"
                [ngClass]="{ 'error-row': hasErrorForRow(row.rowIndex) }"
              >
                {{ getCellValue(row.employee, column.key) }}
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="previewColumnsKeys"></tr>
            <tr
              mat-row
              *matRowDef="let row; columns: previewColumnsKeys"
              [ngClass]="{ 'error-row': hasErrorForRow(row.rowIndex) }"
            ></tr>
          </table>
        </div>
      </section>

      <section *ngIf="totalErrorCount" class="error-section content-card">
        <h3 class="mat-h3 flex-row align-center gap-2 m-0">
          <mat-icon color="warn">error</mat-icon>
          エラー {{ totalErrorCount }} 件
        </h3>
        <mat-list>
          <mat-list-item *ngFor="let error of combinedErrors">
            <mat-icon matListItemIcon color="warn">error</mat-icon>
            <div matListItemTitle>行 {{ error.rowIndex }}</div>
            <div matListItemLine>{{ error.message }}</div>
          </mat-list-item>
        </mat-list>
      </section>

      <section *ngIf="importResult" class="result-section content-card">
        <h3 class="mat-h3 flex-row align-center gap-2 m-0">
          <mat-icon>task_alt</mat-icon>
          インポート結果
        </h3>
        <div class="result-grid">
          <div class="result-card success">
            <div class="label">成功件数</div>
            <div class="value">{{ importResult.successCount }}</div>
          </div>
          <div class="result-card">
            <div class="label">新規作成</div>
            <div class="value">{{ importResult.createdCount }}</div>
          </div>
          <div class="result-card">
            <div class="label">更新</div>
            <div class="value">{{ importResult.updatedCount }}</div>
          </div>
          <div class="result-card error">
            <div class="label">エラー</div>
            <div class="value">{{ importResult.errorCount }}</div>
          </div>
        </div>

        <div *ngIf="importResult.errors.length" class="result-errors">
          <h4>エラー詳細</h4>
          <ul>
            <li *ngFor="let error of importResult.errors">
              行 {{ error.rowIndex }}: {{ error.message }}
            </li>
          </ul>
        </div>
      </section>
    </div>

    <div mat-dialog-actions class="dialog-actions">
      <button mat-button mat-dialog-close [disabled]="isImporting" *ngIf="!importResult">
        <mat-icon>close</mat-icon>
        キャンセル
      </button>
      <button
        mat-flat-button
        color="primary"
        (click)="importResult ? closeWithResult() : confirmImport()"
        [disabled]="isImporting || !parsedData.length"
      >
        <mat-icon>{{ importResult ? 'check' : 'file_upload' }}</mat-icon>
        {{ importResult ? '閉じる' : 'インポート実行' }}
      </button>

      <mat-spinner *ngIf="isImporting" diameter="28"></mat-spinner>
    </div>
  `,
  styles: [
    `
      .dialog-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      h3 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0 0 0.75rem 0;
        font-weight: 600;
      }

      .file-section .file-input-label {
        display: inline-flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1rem;
        border: 1px dashed #c5cae9;
        border-radius: 8px;
        background: #f5f7ff;
        cursor: pointer;
      }

      .file-section input[type='file'] {
        display: none;
      }

      .file-input-button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        color: #3f51b5;
        font-weight: 600;
      }

      .file-name {
        color: #555;
      }

      .helper-text {
        margin: 0.5rem 0 0 0;
        color: #666;
        font-size: 0.9rem;
      }

      .template-download-button {
        margin-top: 0.75rem;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .import-rules {
        margin-top: 0.75rem;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        background: #f8f9ff;
        border: 1px solid #e0e3ff;
        font-size: 0.9rem;
        color: #444;
      }

      .import-rules h4 {
        margin: 0 0 0.5rem 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #3f51b5;
      }

      .import-rules ul {
        margin: 0;
        padding-left: 1.2rem;
      }

      .import-rules li {
        margin-bottom: 0.25rem;
      }

      .standard-reward-notice {
        margin-top: 1rem;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        background: #fff3e0;
        border: 1px solid #ffcc80;
      }

      .standard-reward-notice h4 {
        margin: 0 0 0.5rem 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #e65100;
      }

      .standard-reward-notice p {
        margin: 0;
        font-size: 0.9rem;
        color: #bf360c;
        line-height: 1.5;
      }

      .preview-section .preview-table-container {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
      }

      table.preview-table {
        width: 100%;
      }

      table.preview-table th,
      table.preview-table td {
        padding: 12px;
      }

      .error-row {
        background: #fff4f4;
      }

      .error-section mat-list-item {
        border-bottom: 1px solid #eee;
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .summary-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.35rem 0.75rem;
        border-radius: 16px;
        background: #eef2ff;
        color: #3f51b5;
        font-weight: 600;
      }

      .summary-chip.error {
        background: #fff5f5;
        color: #c62828;
      }

      .result-section {
        border-top: 1px solid #eee;
        padding-top: 1rem;
      }

      .result-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 0.75rem;
      }

      .result-card {
        padding: 0.75rem;
        border-radius: 8px;
        background: #f9f9f9;
        border: 1px solid #eee;
      }

      .result-card.success {
        background: #e8f5e9;
        border-color: #c8e6c9;
        color: #2e7d32;
      }

      .result-card.error {
        background: #fff4f4;
        border-color: #ffcdd2;
        color: #c62828;
      }

      .result-card .label {
        font-size: 0.9rem;
        color: #555;
      }

      .result-card .value {
        font-size: 1.4rem;
        font-weight: 700;
      }

      .result-errors {
        margin-top: 1rem;
      }

      .result-errors ul {
        padding-left: 1.2rem;
        margin: 0;
      }

      .dialog-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        justify-content: flex-end;
        padding: 1rem 1.5rem;
        border-top: 1px solid #e0e0e0;
      }

      .dialog-actions button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
    `
  ]
})
export class EmployeeImportDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<EmployeeImportDialogComponent>);
  private readonly employeesService = inject(EmployeesService);
  private readonly csvImportService = inject(CsvImportService);
  private readonly csvExportService = inject(CsvExportService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly previewColumns: PreviewColumn[] = [
    { key: 'name', label: '氏名' },
    { key: 'birthDate', label: '生年月日' },
    { key: 'department', label: '所属' },
    { key: 'employmentType', label: '雇用形態' },
    { key: 'payrollSettings', label: '報酬月額' },
    { key: 'isInsured', label: '社会保険加入' }
  ];

  protected readonly previewColumnsKeys = this.previewColumns.map((c) => c.key as string);

  protected selectedFileName = '';
  protected parsedData: Partial<Employee>[] = [];
  protected rowIndexes: number[] = []; // 元CSVの行番号
  protected previewRows: PreviewRow[] = [];
  protected parseErrors: CsvParseError[] = [];
  protected validationErrors: ValidationError[] = [];
  protected importResult?: ImportResult;
  protected isImporting = false;

  constructor(@Inject(MAT_DIALOG_DATA) private readonly data: EmployeeImportDialogData) {}

  get combinedErrors(): ImportError[] {
    return [
      ...this.parseErrors.map((error) => ({ rowIndex: error.rowIndex, message: error.message })),
      ...this.validationErrors.map((error) => ({ rowIndex: error.rowIndex, message: error.message }))
    ];
  }

  get totalErrorCount(): number {
    return this.combinedErrors.length;
  }

  get validRowCount(): number {
    const invalidRows = new Set(this.combinedErrors.map((e) => e.rowIndex));
    return this.parsedData.filter((_, index) => {
      const rowIndex = this.rowIndexes[index];
      return rowIndex && !invalidRows.has(rowIndex);
    }).length;
  }

  get hasAnyErrors(): boolean {
    return this.totalErrorCount > 0;
  }

  async onFileSelected(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    this.resetState();

    if (!file) {
      return;
    }

    this.selectedFileName = file.name;
    const parseResult = await this.csvImportService.parseEmployeesCsv(file);
    this.parsedData = parseResult.data;
    this.rowIndexes = parseResult.rowIndexes;
    this.parseErrors = parseResult.errors;

    this.validationErrors = this.parsedData.flatMap((employee, index) => {
      const rowIndex = this.rowIndexes[index];
      return this.csvImportService.validateEmployee(employee, rowIndex);
    });

    this.previewRows = this.parsedData
      .map((employee, index) => ({ rowIndex: this.rowIndexes[index], employee }))
      .slice(0, 10);
  }

  hasErrorForRow(rowIndex: number): boolean {
    return this.combinedErrors.some((error) => error.rowIndex === rowIndex);
  }

  protected getColumnKey(column: PreviewColumn): string {
    return column.key as string;
  }

  downloadTemplate(): void {
    this.csvExportService.exportEmployeesTemplate();
    this.snackBar.open('CSVテンプレートをダウンロードしました', '閉じる', {
      duration: 3000
    });
  }

  getCellValue(row: Partial<Employee>, key: keyof Partial<Employee>): string {
    // ネストされたオブジェクトの処理
    if (key === 'payrollSettings') {
      const payroll = row.payrollSettings;
      if (payroll?.insurableMonthlyWage) {
        return String(payroll.insurableMonthlyWage);
      }
      return '';
    }
    if (key === 'bankAccount') {
      const bank = row.bankAccount;
      if (bank?.bankName) {
        return bank.bankName;
      }
      return '';
    }

    const value = row[key];
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (Array.isArray(value)) {
      return value.map((v) => String(v)).join(', ');
    }
    return String(value);
  }

  async confirmImport(): Promise<void> {
    if (!this.parsedData.length || this.isImporting) {
      return;
    }

    const invalidRows = new Set(this.combinedErrors.map((e) => e.rowIndex));
    const targets = this.parsedData
      .map((employee, index) => ({ employee, rowIndex: this.rowIndexes[index] }))
      .filter((row) => !invalidRows.has(row.rowIndex));

    const confirmed = window.confirm(
      `インポート対象: ${targets.length}件 / エラー: ${this.totalErrorCount}件\n実行しますか？`
    );

    if (!confirmed) {
      return;
    }

    this.isImporting = true;
    const errors: ImportError[] = [...this.combinedErrors];
    let createdCount = 0;
    let updatedCount = 0;

    for (const row of targets) {
      try {
        const payload = this.normalizeEmployee(row.employee);
        await this.employeesService.save(this.data.officeId, payload);
        if (payload.id) {
          updatedCount++;
        } else {
          createdCount++;
        }
      } catch (error) {
        errors.push({ rowIndex: row.rowIndex, message: '保存に失敗しました' });
      }
    }

    this.importResult = {
      successCount: createdCount + updatedCount,
      createdCount,
      updatedCount,
      errorCount: errors.length,
      errors
    };

    this.isImporting = false;
  }

  closeWithResult(): void {
    this.dialogRef.close(this.importResult);
  }

  /**
   * 深いネストのundefinedを除去するヘルパー
   */
  private deepRemoveUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        continue;
      }
      if (value === null) {
        result[key] = null;
      } else if (Array.isArray(value)) {
        result[key] = value;
      } else if (typeof value === 'object') {
        const cleaned = this.deepRemoveUndefined(value);
        if (Object.keys(cleaned).length > 0) {
          result[key] = cleaned;
        }
      } else {
        result[key] = value;
      }
    }
    return result;
      }

  private normalizeEmployee(employee: Partial<Employee>): Partial<Employee> & { id?: string } {
    // undefinedを除去（merge動作のため）
    const cleaned = this.deepRemoveUndefined(employee);
    return cleaned as Partial<Employee> & { id?: string };
  }

  private resetState(): void {
    this.selectedFileName = '';
    this.parsedData = [];
    this.rowIndexes = [];
    this.previewRows = [];
    this.parseErrors = [];
    this.validationErrors = [];
    this.importResult = undefined;
    this.isImporting = false;
  }
}
