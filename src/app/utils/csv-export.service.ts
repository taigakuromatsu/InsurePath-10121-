import { Injectable } from '@angular/core';

import { BonusPremium, Employee, MonthlyPremium } from '../types';

interface CsvColumn<T> {
  label: string;
  getValue: (row: T) => string | number | null | undefined;
  format?: (value: any) => string;
}

@Injectable({ providedIn: 'root' })
export class CsvExportService {
  exportEmployees(employees: Employee[], fileName = '従業員一覧'): void {
    const columns: CsvColumn<Employee>[] = [
      { label: 'ID', getValue: (row) => row.id },
      { label: '氏名', getValue: (row) => row.name },
      { label: 'フリガナ', getValue: (row) => row.kana ?? '' },
      { label: '生年月日', getValue: (row) => row.birthDate },
      { label: '所属', getValue: (row) => row.department ?? '' },
      { label: '住所', getValue: (row) => row.address ?? '' },
      { label: '電話番号', getValue: (row) => row.phone ?? '' },
      { label: 'メールアドレス', getValue: (row) => row.contactEmail ?? '' },
      { label: '入社日', getValue: (row) => row.hireDate },
      { label: '退職日', getValue: (row) => row.retireDate ?? '' },
      { label: '雇用形態', getValue: (row) => row.employmentType },
      { label: '所定労働時間', getValue: (row) => row.weeklyWorkingHours ?? '' },
      { label: '所定労働日数', getValue: (row) => row.weeklyWorkingDays ?? '' },
      {
        label: '学生',
        getValue: (row) =>
          row.isStudent === undefined ? '' : row.isStudent ? 'true' : 'false'
      },
      { label: '標準報酬月額', getValue: (row) => row.monthlyWage },
      { label: '社会保険加入', getValue: (row) => (row.isInsured ? 'true' : 'false') },
      { label: '健康保険等級', getValue: (row) => row.healthGrade ?? '' },
      { label: '健康保険標準報酬月額', getValue: (row) => row.healthStandardMonthly ?? '' },
      { label: '厚生年金等級', getValue: (row) => row.pensionGrade ?? '' },
      { label: '厚生年金標準報酬月額', getValue: (row) => row.pensionStandardMonthly ?? '' },
      { label: '就業状態', getValue: (row) => row.workingStatus ?? '' },
      { label: '作成日時', getValue: (row) => row.createdAt ?? '' },
      { label: '更新日時', getValue: (row) => row.updatedAt ?? '' }
    ];

    this.exportCsv(employees, columns, this.generateFileName(fileName));
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
      { label: '健康保険本人負担', getValue: (row) => row.healthEmployee },
      { label: '健康保険会社負担', getValue: (row) => row.healthEmployer },
      { label: '健康保険合計', getValue: (row) => row.healthTotal },
      { label: '介護保険本人負担', getValue: (row) => row.careEmployee ?? '' },
      { label: '介護保険会社負担', getValue: (row) => row.careEmployer ?? '' },
      { label: '介護保険合計', getValue: (row) => row.careTotal ?? '' },
      { label: '厚生年金等級', getValue: (row) => row.pensionGrade },
      { label: '厚生年金標準報酬月額', getValue: (row) => row.pensionStandardMonthly },
      { label: '厚生年金本人負担', getValue: (row) => row.pensionEmployee },
      { label: '厚生年金会社負担', getValue: (row) => row.pensionEmployer },
      { label: '厚生年金合計', getValue: (row) => row.pensionTotal },
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
