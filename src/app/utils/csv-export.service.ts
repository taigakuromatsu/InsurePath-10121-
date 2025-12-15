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
    premiums: (MonthlyPremium & { employeeName: string; age?: number; isCareTarget?: boolean; careEmployee?: number; careEmployer?: number })[],
    yearMonth?: string,
    fileName = '月次保険料一覧'
  ): void {
    const columns: CsvColumn<MonthlyPremium & { employeeName: string; age?: number; isCareTarget?: boolean; careEmployee?: number; careEmployer?: number }>[] = [
      { label: '対象年月', getValue: (row) => row.yearMonth },
      { label: '氏名', getValue: (row) => row.employeeName },
      { label: '年齢', getValue: (row) => (row as any).age ?? '' },
      { label: '健康保険・介護保険の標準報酬月額', getValue: (row) => row.healthStandardMonthly },
      {
        label: '健康保険・介護保険の全額',
        getValue: (row) =>
          (row as any).healthCareFull ??
          (row.healthTotal ?? 0) + (row.careTotal ?? 0)
      },
      {
        label: '健康保険・介護保険の従業員負担',
        getValue: (row) =>
          (row as any).healthCareEmployee ??
          (row.healthEmployee ?? 0) + (row.careEmployee ?? 0)
      },
      {
        label: '健康保険・介護保険の会社負担',
        getValue: (row) =>
          (row as any).healthCareEmployer ??
          (row.healthEmployer ?? 0) + (row.careEmployer ?? 0)
      },
      { 
        label: '介護保険の従業員負担', 
        getValue: (row) => {
          const isCareTarget = (row as any).isCareTarget ?? false;
          const careEmployee = (row as any).careEmployee ?? row.careEmployee ?? 0;
          return isCareTarget && careEmployee > 0 ? careEmployee : '';
        }
      },
      { 
        label: '介護保険の会社負担', 
        getValue: (row) => {
          const isCareTarget = (row as any).isCareTarget ?? false;
          const careEmployer = (row as any).careEmployer ?? row.careEmployer ?? 0;
          return isCareTarget && careEmployer > 0 ? careEmployer : '';
        }
      },
      { label: '厚生年金の標準報酬月額', getValue: (row) => row.pensionStandardMonthly },
      { label: '厚生年金の全額', getValue: (row) => (row as any).pensionFull ?? row.pensionTotal ?? 0 },
      { label: '厚生年金の従業員負担', getValue: (row) => (row as any).pensionEmployee ?? row.pensionEmployee ?? 0 },
      { label: '厚生年金の会社負担', getValue: (row) => (row as any).pensionEmployer ?? row.pensionEmployer ?? 0 },
      { label: '合計の全額', getValue: (row) => (row as any).totalFull ?? ((row.totalEmployee ?? 0) + (row.totalEmployer ?? 0)) },
      { label: '合計の従業員負担', getValue: (row) => row.totalEmployee ?? 0 },
      { label: '合計の会社負担', getValue: (row) => row.totalEmployer ?? 0 }
    ];

    // サマリーの計算
    const healthCareFullTotal = premiums.reduce(
      (sum, row) =>
        sum +
        ((row as any).healthCareFull ?? (row.healthTotal ?? 0) + (row.careTotal ?? 0)),
      0
    );
    const healthCareFullRoundedDown = Math.floor(healthCareFullTotal);
    const healthCareEmployeeTotal = premiums.reduce(
      (sum, row) =>
        sum +
        ((row as any).healthCareEmployee ??
          (row.healthEmployee ?? 0) + (row.careEmployee ?? 0)),
      0
    );
    const healthCareEmployerTotal = healthCareFullRoundedDown - healthCareEmployeeTotal;

    const pensionFullTotal = premiums.reduce(
      (sum, row) => sum + ((row as any).pensionFull ?? row.pensionTotal ?? 0),
      0
    );
    const pensionFullRoundedDown = Math.floor(pensionFullTotal);
    const pensionEmployeeTotal = premiums.reduce(
      (sum, row) => sum + ((row as any).pensionEmployee ?? row.pensionEmployee ?? 0),
      0
    );
    const pensionEmployerTotal = pensionFullRoundedDown - pensionEmployeeTotal;

    const totalFullTotal = premiums.reduce(
      (sum, row) => sum + ((row as any).totalFull ?? (row.totalEmployee ?? 0) + (row.totalEmployer ?? 0)),
      0
    );
    const totalFullRoundedDown = Math.floor(totalFullTotal);
    const totalEmployeeTotal = premiums.reduce(
      (sum, row) => sum + (row.totalEmployee ?? 0),
      0
    );
    const totalEmployerTotal = totalFullRoundedDown - totalEmployeeTotal;

    const finalFileName = this.generateFileName(fileName, yearMonth);
    this.exportCsvWithSummary(premiums, columns, finalFileName, {
      healthCareFullTotal,
      healthCareFullRoundedDown,
      healthCareEmployeeTotal,
      healthCareEmployerTotal,
      pensionFullTotal,
      pensionFullRoundedDown,
      pensionEmployeeTotal,
      pensionEmployerTotal,
      totalFullTotal,
      totalFullRoundedDown,
      totalEmployeeTotal,
      totalEmployerTotal
    });
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
      { label: '標準賞与額（千円未満切捨）', getValue: (row) => row.standardBonusAmount },
      { label: '年度内累計標準賞与額', getValue: (row) => row.healthStandardBonusCumulative ?? '' },
      // 健康保険・介護保険
      { label: '健康保険・介護保険の標準賞与（有効額）', getValue: (row) => row.healthEffectiveAmount ?? '' },
      { label: '健康保険・介護保険の上限超過額', getValue: (row) => row.healthExceededAmount ?? 0 },
      { label: '健康保険・介護保険の従業員負担', getValue: (row) => (row as any).healthCareEmployee ?? row.healthEmployee ?? 0 },
      { label: '健康保険・介護保険の会社負担（参考）', getValue: (row) => (row as any).healthCareEmployer ?? row.healthEmployer ?? 0 },
      { label: '健康保険・介護保険の全額（端数前）', getValue: (row) => (row as any).healthCareFull ?? row.healthTotal ?? 0 },
      // 厚生年金
      { label: '厚生年金の標準賞与（有効額）', getValue: (row) => row.pensionEffectiveAmount ?? '' },
      { label: '厚生年金の上限超過額', getValue: (row) => row.pensionExceededAmount ?? 0 },
      { label: '厚生年金の従業員負担', getValue: (row) => row.pensionEmployee ?? 0 },
      { label: '厚生年金の会社負担（参考）', getValue: (row) => row.pensionEmployer ?? 0 },
      { label: '厚生年金の全額（端数前）', getValue: (row) => (row as any).pensionFull ?? row.pensionTotal ?? 0 },
      // 合計
      { label: '従業員負担合計', getValue: (row) => row.totalEmployee ?? 0 },
      { label: '会社負担合計（参考）', getValue: (row) => row.totalEmployer ?? 0 },
      { label: '全額合計（端数前）', getValue: (row) => (row as any).totalFull ?? 0 },
      // その他
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
    lines.push('# 資格喪失理由: retirement(退職) / death(死亡) / age_75(75歳到達) / disability(障害認定) / social_security_agreement(社会保障協定)');
    lines.push('# 就業状態: normal(通常勤務) / maternity_leave(産前産後休業) / childcare_leave(育児休業)');
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

  private exportCsvWithSummary<T>(
    data: T[],
    columns: CsvColumn<T>[],
    fileName: string,
    summary: {
      healthCareFullTotal: number;
      healthCareFullRoundedDown: number;
      healthCareEmployeeTotal: number;
      healthCareEmployerTotal: number;
      pensionFullTotal: number;
      pensionFullRoundedDown: number;
      pensionEmployeeTotal: number;
      pensionEmployerTotal: number;
      totalFullTotal: number;
      totalFullRoundedDown: number;
      totalEmployeeTotal: number;
      totalEmployerTotal: number;
    }
  ): void {
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

    // 空行を追加
    rows.push(columns.map(() => ''));

    // ===== 健康保険・介護保険のサマリー =====
    const healthSectionHeader: string[] = new Array(columns.length).fill('');
    healthSectionHeader[0] = this.escapeCsvValue('【健康保険・介護保険】');
    rows.push(healthSectionHeader);
    
    // 納入告知額（端数処理前）
    const healthNotificationRow1: string[] = new Array(columns.length).fill('');
    healthNotificationRow1[0] = this.escapeCsvValue('納入告知額（端数処理前）');
    healthNotificationRow1[4] = this.escapeCsvValue(String(summary.healthCareFullTotal));
    rows.push(healthNotificationRow1);

    // 納入告知額（端数処理後）
    const healthNotificationRow2: string[] = new Array(columns.length).fill('');
    healthNotificationRow2[0] = this.escapeCsvValue('納入告知額（端数処理後）');
    healthNotificationRow2[4] = this.escapeCsvValue(String(summary.healthCareFullRoundedDown));
    rows.push(healthNotificationRow2);

    // 従業員負担計
    const healthEmployeeRow: string[] = new Array(columns.length).fill('');
    healthEmployeeRow[0] = this.escapeCsvValue('従業員負担計');
    healthEmployeeRow[5] = this.escapeCsvValue(String(summary.healthCareEmployeeTotal));
    rows.push(healthEmployeeRow);

    // 会社負担計
    const healthEmployerRow: string[] = new Array(columns.length).fill('');
    healthEmployerRow[0] = this.escapeCsvValue('会社負担計');
    healthEmployerRow[6] = this.escapeCsvValue(String(summary.healthCareEmployerTotal));
    rows.push(healthEmployerRow);

    // 空行を追加
    rows.push(columns.map(() => ''));

    // ===== 厚生年金のサマリー =====
    const pensionSectionHeader: string[] = new Array(columns.length).fill('');
    pensionSectionHeader[0] = this.escapeCsvValue('【厚生年金】');
    rows.push(pensionSectionHeader);
    
    // 納入告知額（端数処理前）
    const pensionNotificationRow1: string[] = new Array(columns.length).fill('');
    pensionNotificationRow1[0] = this.escapeCsvValue('納入告知額（端数処理前）');
    pensionNotificationRow1[10] = this.escapeCsvValue(String(summary.pensionFullTotal));
    rows.push(pensionNotificationRow1);

    // 納入告知額（端数処理後）
    const pensionNotificationRow2: string[] = new Array(columns.length).fill('');
    pensionNotificationRow2[0] = this.escapeCsvValue('納入告知額（端数処理後）');
    pensionNotificationRow2[10] = this.escapeCsvValue(String(summary.pensionFullRoundedDown));
    rows.push(pensionNotificationRow2);

    // 従業員負担計
    const pensionEmployeeRow: string[] = new Array(columns.length).fill('');
    pensionEmployeeRow[0] = this.escapeCsvValue('従業員負担計');
    pensionEmployeeRow[11] = this.escapeCsvValue(String(summary.pensionEmployeeTotal));
    rows.push(pensionEmployeeRow);

    // 会社負担計
    const pensionEmployerRow: string[] = new Array(columns.length).fill('');
    pensionEmployerRow[0] = this.escapeCsvValue('会社負担計');
    pensionEmployerRow[12] = this.escapeCsvValue(String(summary.pensionEmployerTotal));
    rows.push(pensionEmployerRow);

    // 空行を追加
    rows.push(columns.map(() => ''));

    // ===== 総合計のサマリー =====
    const totalSectionHeader: string[] = new Array(columns.length).fill('');
    totalSectionHeader[0] = this.escapeCsvValue('【総合計】');
    rows.push(totalSectionHeader);
    
    // 納入告知額 合計（端数処理前）
    const totalNotificationRow1: string[] = new Array(columns.length).fill('');
    totalNotificationRow1[0] = this.escapeCsvValue('納入告知額 合計（端数処理前）');
    totalNotificationRow1[13] = this.escapeCsvValue(String(summary.totalFullTotal));
    rows.push(totalNotificationRow1);

    // 納入告知額 合計（端数処理後）
    const totalNotificationRow2: string[] = new Array(columns.length).fill('');
    totalNotificationRow2[0] = this.escapeCsvValue('納入告知額 合計（端数処理後）');
    totalNotificationRow2[13] = this.escapeCsvValue(String(summary.totalFullRoundedDown));
    rows.push(totalNotificationRow2);

    // 従業員負担 総計
    const totalEmployeeRow: string[] = new Array(columns.length).fill('');
    totalEmployeeRow[0] = this.escapeCsvValue('従業員負担 総計');
    totalEmployeeRow[14] = this.escapeCsvValue(String(summary.totalEmployeeTotal));
    rows.push(totalEmployeeRow);

    // 会社負担 総計
    const totalEmployerRow: string[] = new Array(columns.length).fill('');
    totalEmployerRow[0] = this.escapeCsvValue('会社負担 総計');
    totalEmployerRow[15] = this.escapeCsvValue(String(summary.totalEmployerTotal));
    rows.push(totalEmployerRow);

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
