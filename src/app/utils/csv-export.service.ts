import { Injectable, inject } from '@angular/core';

import { BonusPremium, Employee, MonthlyPremium } from '../types';
import { CsvImportService } from './csv-import.service';

interface CsvColumn<T> {
  label: string;
  getValue: (row: T) => string | number | null | undefined;
  format?: (value: any) => string;
}

@Injectable({ providedIn: 'root' })
export class CsvExportService {
  private readonly csvImportService = inject(CsvImportService);
  /**
   * 従業員一覧をCSV形式でエクスポートする
   * ヘッダと順序は CsvImportService の headerMapping に準拠し、
   * テンプレートCSVと完全に同じフォーマットで出力する
   */
  exportEmployees(employees: Employee[], fileName = '従業員一覧'): void {
    if (!employees?.length) {
      return;
    }

    // CsvImportService 側から「ヘッダと key の一覧」を取得
    const columns = this.csvImportService.getEmployeeHeaderMapping();

    // ヘッダ行
    const headers = columns.map((c) => c.header);
    const rows: string[][] = [];
    rows.push(headers.map((h) => this.escapeCsvValue(h)));

    // データ行
    for (const emp of employees) {
      const row: string[] = [];
      for (const col of columns) {
        const key = col.key;
        const raw = (emp as any)[key];
        let text = '';

        if (raw !== undefined && raw !== null) {
          if (typeof raw === 'boolean') {
            text = raw ? 'true' : 'false';
          } else {
            text = String(raw);
          }
        }

        row.push(this.escapeCsvValue(text));
      }
      rows.push(row);
    }

    const blob = this.createCsvBlob(rows);
    this.downloadBlob(blob, this.generateFileName(fileName));
  }

  exportMonthlyPremiums(
    premiums: (MonthlyPremium & { employeeName: string })[],
    yearMonth?: string,
    fileName = '月次保険料一覧'
  ): void {
    const columns: CsvColumn<MonthlyPremium & { employeeName: string }>[] = [
      { label: '対象年月', getValue: (row) => row.yearMonth },
      { label: '従業員ID', getValue: (row) => row.employeeId },
      { label: '氏名', getValue: (row) => row.employeeName },
      { label: '健康保険等級', getValue: (row) => row.healthGrade },
      { label: '健康保険標準報酬月額', getValue: (row) => row.healthStandardMonthly },
      {
        label: '健康保険本人負担（健保＋介護）',
        getValue: (row) =>
          (row as any).healthCareEmployee ??
          (row.healthEmployee ?? 0) + (row.careEmployee ?? 0)
      },
      {
        label: '健康保険会社負担（健保＋介護・参考）',
        getValue: (row) =>
          (row as any).healthCareEmployer ??
          (row.healthEmployer ?? 0) + (row.careEmployer ?? 0)
      },
      {
        label: '健康保険合計（健保＋介護・端数前）',
        getValue: (row) =>
          (row as any).healthCareFull ??
          (row.healthTotal ?? 0) + (row.careTotal ?? 0)
      },
      { label: '介護保険本人負担', getValue: (row) => row.careEmployee ?? '' },
      { label: '介護保険会社負担', getValue: (row) => row.careEmployer ?? '' },
      { label: '介護保険合計', getValue: (row) => row.careTotal ?? '' },
      { label: '厚生年金等級', getValue: (row) => row.pensionGrade },
      { label: '厚生年金標準報酬月額', getValue: (row) => row.pensionStandardMonthly },
      { label: '厚生年金本人負担', getValue: (row) => (row as any).pensionEmployee ?? row.pensionEmployee },
      { label: '厚生年金会社負担', getValue: (row) => (row as any).pensionEmployer ?? row.pensionEmployer },
      { label: '厚生年金合計（端数前）', getValue: (row) => (row as any).pensionFull ?? row.pensionTotal },
      { label: '本人負担合計', getValue: (row) => row.totalEmployee },
      { label: '会社負担合計', getValue: (row) => row.totalEmployer },
      { label: '計算日時', getValue: (row) => row.calculatedAt }
    ];

    const finalFileName = this.generateFileName(fileName, yearMonth);
    this.exportCsv(premiums, columns, finalFileName);
  }

  exportBonusPremiums(
    bonuses: (BonusPremium & { employeeName: string })[],
    fileName = '賞与一覧'
  ): void {
    const columns: CsvColumn<BonusPremium & { employeeName: string }>[] = [
      { label: '支給日', getValue: (row) => row.payDate },
      { label: '従業員ID', getValue: (row) => row.employeeId },
      { label: '氏名', getValue: (row) => row.employeeName },
      { label: '賞与支給額', getValue: (row) => row.grossAmount },
      { label: '標準賞与額', getValue: (row) => row.standardBonusAmount },
      { label: '年度内累計標準賞与額', getValue: (row) => row.healthStandardBonusCumulative ?? '' },
      { label: '健康保険本人負担', getValue: (row) => row.healthEmployee },
      { label: '健康保険会社負担', getValue: (row) => row.healthEmployer },
      { label: '健康保険合計', getValue: (row) => row.healthTotal },
      { label: '厚生年金本人負担', getValue: (row) => row.pensionEmployee },
      { label: '厚生年金会社負担', getValue: (row) => row.pensionEmployer },
      { label: '厚生年金合計', getValue: (row) => row.pensionTotal },
      { label: '本人負担合計', getValue: (row) => row.totalEmployee },
      { label: '会社負担合計', getValue: (row) => row.totalEmployer },
      { label: '年度', getValue: (row) => row.fiscalYear },
      { label: 'メモ', getValue: (row) => row.note ?? '' },
      { label: '作成日時', getValue: (row) => row.createdAt }
    ];

    this.exportCsv(bonuses, columns, this.generateFileName(fileName));
  }

  /**
   * 従業員CSVインポート用のテンプレート（ヘッダのみ）を出力
   * CsvImportService の headerMapping からヘッダを取得して出力する
   * これにより、ヘッダ定義の二重管理を避け、インポートとテンプレートの整合性を保つ
   * ヘッダの前にコメント行を追加して、入力ルールを説明する
   */
  exportEmployeesTemplate(): void {
    const headers = this.csvImportService.getEmployeeCsvHeaders();
    const lines: string[] = [];

    // コメント行を追加
    lines.push('# 従業員インポート用テンプレート（InsurePath）');
    lines.push('# 雇用形態: regular(正社員) / contract(契約社員) / part(パート) / アルバイト / other(その他)');
    lines.push('# 資格取得区分: new_hire(新規採用) / expansion(適用拡大) / hours_change(所定労働時間変更) / other(その他)');
    lines.push('# 資格喪失理由: retirement(退職) / hours_decrease(所定労働時間減少) / death(死亡) / other(その他)');
    lines.push('# 就業状態: normal(在籍) / maternity_leave(産休) / childcare_leave(育休) / sick_leave(病休) / other(その他)');
    lines.push('# 保険料の扱い: normal(通常) / exempt(免除)');
    lines.push('# ※日付は YYYY-MM-DD 形式で入力してください（例: 2024-04-01）');
    lines.push('# ※学生・社会保険加入は true / false（小文字）で入力してください');

    // ヘッダ行を追加
    const headerLine = headers.map((h) => this.escapeCsvValue(h)).join(',');
    lines.push(headerLine);

    const csvString = lines.join('\r\n') + '\r\n';
    const bom = '﻿';
    const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, 'employees-template.csv');
  }

  private exportCsv<T>(data: T[], columns: CsvColumn<T>[], fileName: string): void {
    if (!data?.length) {
      return;
    }

    const rows: string[][] = [];
    rows.push(columns.map((c) => this.escapeCsvValue(c.label)));

    data.forEach((row) => {
      const values = columns.map((column) => {
        const raw = column.getValue(row);
        const formatted = column.format ? column.format(raw) : raw;
        const text = formatted == null ? '' : String(formatted);
        return this.escapeCsvValue(text);
      });
      rows.push(values);
    });

    const blob = this.createCsvBlob(rows);
    this.downloadBlob(blob, fileName);
  }

  private escapeCsvValue(value: string): string {
    const needsEscaping = /[",\n\r]/.test(value);
    const escaped = value.replace(/"/g, '""');
    return needsEscaping ? `"${escaped}"` : value;
  }

  private createCsvBlob(rows: string[][]): Blob {
    const csvString = rows.map((r) => r.join(',')).join('\r\n');
    const bom = '﻿';
    return new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });
  }

  private generateFileName(baseName: string, suffix?: string): string {
    const timestamp = this.formatTimestamp(new Date());
    const suffixPart = suffix ? `_${suffix}` : '';
    return `${baseName}${suffixPart}_${timestamp}.csv`;
  }

  private formatTimestamp(date: Date): string {
    const pad = (num: number) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
