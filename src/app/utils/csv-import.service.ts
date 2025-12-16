import { Injectable } from '@angular/core';

import { Employee } from '../types';
import {
  EMPLOYEE_CSV_COLUMNS_V2,
  findColumnDefinitionByHeader,
  getEmployeeCsvHeadersV2,
  CsvColumnDefinition
} from './csv-column-definitions';

export interface CsvParseResult<T> {
  data: T[];
  rowIndexes: number[]; // 元CSVの行番号（コメント行を考慮）
  errors: CsvParseError[];
}

export interface CsvParseError {
  rowIndex: number;
  message: string;
  column?: string;
}

export interface ValidationError {
  rowIndex: number;
  message: string;
  field: string;
}

/**
 * 深いネストのundefinedを除去するヘルパー
 */
function deepRemoveUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
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
      const cleaned = deepRemoveUndefined(value);
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

@Injectable({ providedIn: 'root' })
export class CsvImportService {
  /**
   * コメント行かどうかを判定する（BOM除去対応）
   * 最初のセルが # で始まる行をコメント行とみなす
   */
  private isCommentLine(values: string[]): boolean {
    const firstCell = (values[0] ?? '').replace(/^\uFEFF/, '').trim();
    return firstCell.startsWith('#');
  }

  /**
   * 従業員CSVのヘッダとEmployeeプロパティキーの対応を取得する（後方互換用）
   * v2列定義から生成
   */
  getEmployeeHeaderMapping(): { header: string; key: keyof Partial<Employee> }[] {
    return EMPLOYEE_CSV_COLUMNS_V2.map((col) => ({
      header: col.header,
      key: col.header as keyof Partial<Employee> // 簡易的なマッピング
    }));
  }

  /**
   * 従業員CSVのヘッダ行を取得する（後方互換用）
   * v2列定義から生成
   */
  getEmployeeCsvHeaders(): string[] {
    return getEmployeeCsvHeadersV2();
  }

  /**
   * v2列定義を使用してCSVをパース
   */
  async parseEmployeesCsv(file: File): Promise<CsvParseResult<Partial<Employee>>> {
    const text = await file.text();
    const allLines = text
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .filter((line) => line.trim() !== '');

    if (!allLines.length) {
      return {
        data: [],
        rowIndexes: [],
        errors: [{ rowIndex: 1, message: 'CSVにデータがありません' }]
      };
    }

    // コメント行をスキップしてヘッダ行を探す
    let headerLineIndex = -1;
    let headerLineNumber = 0;
    for (let i = 0; i < allLines.length; i++) {
      const values = this.parseCsvLine(allLines[i]);
      if (!this.isCommentLine(values)) {
        headerLineIndex = i;
        headerLineNumber = i + 1; // 1-based
        break;
      }
    }

    if (headerLineIndex === -1) {
      return {
        data: [],
        rowIndexes: [],
        errors: [{ rowIndex: 1, message: 'CSVにヘッダ行が見つかりません' }]
      };
    }

    const headers = this.parseCsvLine(allLines[headerLineIndex]);
    const errors: CsvParseError[] = [];

    // ヘッダから列定義をマッピング
    const columnMap = new Map<number, CsvColumnDefinition>();
    headers.forEach((header, index) => {
      const colDef = findColumnDefinitionByHeader(header.trim());
      if (colDef) {
        columnMap.set(index, colDef);
      } else {
        errors.push({
          rowIndex: headerLineNumber,
          column: header,
          message: `認識できないヘッダ: ${header}`
        });
      }
    });

    const data: Partial<Employee>[] = [];
    const rowIndexes: number[] = [];

    // ネストオブジェクトのヘッダセット
    const BANK_HEADERS = new Set([
      '金融機関名',
      '金融機関コード',
      '支店名',
      '支店コード',
      '口座種別',
      '口座番号',
      '名義',
      '名義カナ',
      '主口座フラグ'
    ]);
    const PAYROLL_HEADERS = new Set(['報酬月額', '支給形態', '支給サイクル', '給与メモ']);

    // ヘッダ行以降のデータ行を処理（コメント行はスキップ）
    for (let i = headerLineIndex + 1; i < allLines.length; i++) {
      const line = allLines[i];
      const values = this.parseCsvLine(line);
      const actualRowNumber = i + 1; // 1-based（元CSVの行番号）

      // コメント行はスキップ
      if (this.isCommentLine(values)) {
        continue;
      }

      const record: Partial<Employee> = {};

      // 全列__CLEAR__判定用のカウンター
      let bankSeen = 0;
      let bankClear = 0;
      let payrollSeen = 0;
      let payrollClear = 0;

      // 各列を処理
      columnMap.forEach((colDef, colIndex) => {
        const raw = (values[colIndex] ?? '').trim();

        // 全列__CLEAR__判定のためのカウント
        if (BANK_HEADERS.has(colDef.header)) {
          bankSeen++;
          if (raw === '__CLEAR__') {
            bankClear++;
          }
        }
        if (PAYROLL_HEADERS.has(colDef.header)) {
          payrollSeen++;
          if (raw === '__CLEAR__') {
            payrollClear++;
          }
        }

        try {
          colDef.setter(record, raw);
        } catch (error) {
          errors.push({
            rowIndex: actualRowNumber,
            column: colDef.header,
            message: `${colDef.header}の処理中にエラーが発生しました: ${error}`
          });
        }
      });

      // undefinedを除去（merge動作のため）
      const cleaned = deepRemoveUndefined(record);

      // 全列__CLEAR__のときだけオブジェクトごと消す
      if (bankSeen > 0 && bankClear === bankSeen) {
        (cleaned as any).bankAccount = null;
      }
      if (payrollSeen > 0 && payrollClear === payrollSeen) {
        (cleaned as any).payrollSettings = null;
      }

      if (Object.keys(cleaned).length > 0) {
        data.push(cleaned);
        rowIndexes.push(actualRowNumber);
      }
    }

    // テンプレート未編集時のエラー追加
    if (data.length === 0 && errors.length === 0) {
      errors.push({
        rowIndex: headerLineNumber,
        message: 'データ行がありません（テンプレを編集してからインポートしてください）'
      });
    }

    return { data, rowIndexes, errors };
  }

  /**
   * 従業員データをバリデーション（create/patchで分ける）
   */
  validateEmployee(employee: Partial<Employee>, rowIndex: number): ValidationError[] {
    const errors: ValidationError[] = [];
    const isUpdate = !!employee.id;

    const isEmpty = (v: any): boolean =>
      v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

    // update時: 必須項目が__CLEAR__で消されていないかチェック
    const forbidClearRequiredOnUpdate = (field: keyof Partial<Employee>, label: string): void => {
      const v = employee[field];
      if (isUpdate && v !== undefined && isEmpty(v)) {
        errors.push({
          rowIndex,
          field: field as string,
          message: `${label}は更新で空にできません（空欄は変更なし、消す操作は禁止）`
        });
      }
    };

    // create: 必須項目チェック
    if (!isUpdate) {
      if (isEmpty(employee.name)) {
        errors.push({ rowIndex, field: 'name', message: '氏名は必須です' });
      }
      if (isEmpty(employee.kana)) {
        errors.push({ rowIndex, field: 'kana', message: 'フリガナは必須です' });
      }
      if (isEmpty(employee.birthDate)) {
        errors.push({ rowIndex, field: 'birthDate', message: '生年月日は必須です' });
      }
      if (isEmpty(employee.hireDate)) {
        errors.push({ rowIndex, field: 'hireDate', message: '入社日は必須です' });
      }
      if (isEmpty(employee.employmentType)) {
        errors.push({ rowIndex, field: 'employmentType', message: '雇用形態は必須です' });
      }
    } else {
      // update: この行で触っている場合だけチェック
      forbidClearRequiredOnUpdate('name', '氏名');
      forbidClearRequiredOnUpdate('kana', 'フリガナ');
      forbidClearRequiredOnUpdate('birthDate', '生年月日');
      forbidClearRequiredOnUpdate('hireDate', '入社日');
      forbidClearRequiredOnUpdate('employmentType', '雇用形態');
    }

    // 日付フォーマットチェック
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const dateFields: (keyof Partial<Employee>)[] = [
      'birthDate',
      'hireDate',
      'retireDate',
      'healthQualificationDate',
      'healthLossDate',
      'pensionQualificationDate',
      'pensionLossDate'
    ];
    dateFields.forEach((field) => {
      const value = employee[field];
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value !== 'string' || !datePattern.test(value)) {
          errors.push({
            rowIndex,
            field: field as string,
            message: `${field} は YYYY-MM-DD 形式で入力してください`
          });
        }
      }
    });

    // 雇用形態の値チェック
    const employmentType = employee.employmentType;
    const allowedEmploymentTypes: Employee['employmentType'][] = [
      'regular',
      'contract',
      'part',
      'アルバイト',
      'other'
    ];
    if (employmentType && !allowedEmploymentTypes.includes(employmentType as any)) {
      errors.push({
        rowIndex,
        field: 'employmentType',
        message:
          '雇用形態の値が不正です。利用可能な値: regular(正社員) / contract(契約社員) / part(パート) / アルバイト / other(その他)'
      });
    }

    // ネスト必須チェック: bankAccount（createのときだけ）
    if (!isUpdate) {
      const bankAccount = employee.bankAccount as any;
      if (bankAccount && typeof bankAccount === 'object') {
        const hasAnyBankField = [
          bankAccount.bankName,
          bankAccount.bankCode,
          bankAccount.branchName,
          bankAccount.branchCode,
          bankAccount.accountType,
          bankAccount.accountNumber,
          bankAccount.accountHolderName,
          bankAccount.accountHolderKana
        ].some((v) => v !== undefined && v !== null && v !== '');

        if (hasAnyBankField) {
          const requiredFields = [
            { key: 'bankName', label: '金融機関名' },
            { key: 'branchName', label: '支店名' },
            { key: 'accountType', label: '口座種別' },
            { key: 'accountNumber', label: '口座番号' },
            { key: 'accountHolderName', label: '名義' }
          ];

          for (const field of requiredFields) {
            if (!bankAccount[field.key] || bankAccount[field.key].trim() === '') {
              errors.push({
                rowIndex,
                field: `bankAccount.${field.key}`,
                message: `給与振込口座情報を入力する場合、${field.label}は必須です`
              });
            }
          }
        }
      }

      // ネスト必須チェック: payrollSettings（createのときだけ）
      const payrollSettings = employee.payrollSettings as any;
      if (payrollSettings && typeof payrollSettings === 'object') {
        const hasAnyPayrollField = [
          payrollSettings.payType,
          payrollSettings.payCycle,
          payrollSettings.insurableMonthlyWage,
          payrollSettings.note
        ].some((v) => v !== undefined && v !== null && v !== '');

        if (hasAnyPayrollField) {
          if (!payrollSettings.payType) {
            errors.push({
              rowIndex,
              field: 'payrollSettings.payType',
              message: '給与基本情報を入力する場合、支給形態は必須です'
            });
          }
          if (!payrollSettings.payCycle) {
            errors.push({
              rowIndex,
              field: 'payrollSettings.payCycle',
              message: '給与基本情報を入力する場合、支給サイクルは必須です'
            });
          }
        }
      }
    }

    // 免除月の重複チェック
    if (employee.premiumExemptionMonths && Array.isArray(employee.premiumExemptionMonths)) {
      const yearMonthSet = new Set<string>();
      for (const month of employee.premiumExemptionMonths) {
        if (yearMonthSet.has(month.yearMonth)) {
          errors.push({
            rowIndex,
            field: 'premiumExemptionMonths',
            message: `重複した対象年月: ${month.yearMonth}`
          });
          break;
        }
        yearMonthSet.add(month.yearMonth);
      }
    }

    return errors;
  }

  /**
   * CSV行をパース（クォート対応）
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    result.push(current);
    return result;
  }
}
