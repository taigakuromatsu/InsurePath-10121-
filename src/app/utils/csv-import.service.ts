import { Injectable } from '@angular/core';

import { Employee, EmploymentType, InsuranceQualificationKind, InsuranceLossReasonKind, WorkingStatus } from '../types';

export interface CsvParseResult<T> {
  data: T[];
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

@Injectable({ providedIn: 'root' })
export class CsvImportService {
  private readonly headerMapping: Record<string, keyof Partial<Employee>> = {
    ID: 'id',
    氏名: 'name',
    フリガナ: 'kana',
    生年月日: 'birthDate',
    所属: 'department',
    住所: 'address',
    電話番号: 'phone',
    メールアドレス: 'contactEmail',
    入社日: 'hireDate',
    退職日: 'retireDate',
    雇用形態: 'employmentType',
    所定労働時間: 'weeklyWorkingHours',
    所定労働日数: 'weeklyWorkingDays',
    学生: 'isStudent',
    標準報酬月額: 'monthlyWage',
    社会保険加入: 'isInsured',
    健康保険等級: 'healthGrade',
    健康保険標準報酬月額: 'healthStandardMonthly',
    厚生年金等級: 'pensionGrade',
    厚生年金標準報酬月額: 'pensionStandardMonthly',
    就業状態: 'workingStatus',
    作成日時: 'createdAt',
    更新日時: 'updatedAt',
    被保険者記号: 'healthInsuredSymbol',
    被保険者番号: 'healthInsuredNumber',
    厚生年金番号: 'pensionNumber',
    '資格取得日（健保）': 'healthQualificationDate',
    '資格取得区分（健保）': 'healthQualificationKind',
    '資格喪失日（健保）': 'healthLossDate',
    '資格喪失理由（健保）': 'healthLossReasonKind',
    '資格取得日（年金）': 'pensionQualificationDate',
    '資格取得区分（年金）': 'pensionQualificationKind',
    '資格喪失日（年金）': 'pensionLossDate',
    '資格喪失理由（年金）': 'pensionLossReasonKind',
    雇用契約期間の見込み: 'contractPeriodNote',
    就業状態メモ: 'workingStatusNote'
  };

  private readonly requiredFields: (keyof Partial<Employee>)[] = [
    'name',
    'birthDate',
    'hireDate',
    'employmentType',
    'monthlyWage'
  ];

  private readonly numericFields = new Set<keyof Partial<Employee>>([
    'monthlyWage',
    'weeklyWorkingHours',
    'weeklyWorkingDays',
    'healthGrade',
    'healthStandardMonthly',
    'pensionGrade',
    'pensionStandardMonthly'
  ]);

  private readonly booleanFields = new Set<keyof Partial<Employee>>([
    'isStudent',
    'isInsured'
  ]);

  private readonly dateFields = new Set<keyof Partial<Employee>>([
    'birthDate',
    'hireDate',
    'retireDate',
    'healthQualificationDate',
    'healthLossDate',
    'pensionQualificationDate',
    'pensionLossDate'
  ]);

  /**
   * 従業員CSVのヘッダとEmployeeプロパティキーの対応を取得する
   * headerMapping のエントリを順序通りに配列として返す
   * エクスポート機能で使用する
   */
  getEmployeeHeaderMapping(): { header: string; key: keyof Partial<Employee> }[] {
    return Object.entries(this.headerMapping).map(([header, key]) => ({
      header,
      key
    }));
  }

  /**
   * 従業員CSVのヘッダ行を取得する
   * headerMapping のキーを順序通りに配列として返す
   * テンプレート出力やエクスポート機能で使用する
   */
  getEmployeeCsvHeaders(): string[] {
    return this.getEmployeeHeaderMapping().map((c) => c.header);
  }

  /**
   * コメント行かどうかを判定する
   * 最初のセルが # で始まる行をコメント行とみなす
   */
  private isCommentLine(values: string[]): boolean {
    const firstCell = (values[0] ?? '').trim();
    return firstCell.startsWith('#');
  }

  /**
   * 雇用形態の値を正規化する
   * 日本語入力（正社員、契約社員など）を内部コードに変換
   */
  private normalizeEmploymentType(raw: unknown): EmploymentType | string | undefined {
    if (raw == null) return undefined;
    const s = String(raw).trim();
    if (!s) return undefined;

    const normalized = s.toLowerCase().replace(/\s+/g, '');
    
    const employmentTypeMap: Record<string, EmploymentType> = {
      'regular': 'regular',
      '正社員': 'regular',
      'contract': 'contract',
      '契約社員': 'contract',
      '契約': 'contract',
      'part': 'part',
      'パート': 'part',
      'アルバイト': 'アルバイト',
      'アルバイトスタッフ': 'アルバイト',
      'other': 'other',
      'その他': 'other'
    };

    return employmentTypeMap[normalized] ?? s;
  }

  async parseEmployeesCsv(file: File): Promise<CsvParseResult<Partial<Employee>>> {
    const text = await file.text();
    const allLines = text
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .filter((line) => line.trim() !== '');

    if (!allLines.length) {
      return { data: [], errors: [{ rowIndex: 1, message: 'CSVにデータがありません' }] };
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
      return { data: [], errors: [{ rowIndex: 1, message: 'CSVにヘッダ行が見つかりません' }] };
    }

    const headers = this.parseCsvLine(allLines[headerLineIndex]);
    const errors: CsvParseError[] = [];

    const headerIndexes = new Map<number, keyof Partial<Employee>>();
    headers.forEach((header, index) => {
      const field = this.headerMapping[header.trim()];
      if (field) {
        headerIndexes.set(index, field);
      } else {
        errors.push({ rowIndex: headerLineNumber, column: header, message: `認識できないヘッダ: ${header}` });
      }
    });

    const missingHeaders = this.requiredFields.filter(
      (field) => !Array.from(headerIndexes.values()).includes(field)
    );
    missingHeaders.forEach((field) =>
      errors.push({ rowIndex: headerLineNumber, message: `必須ヘッダが不足しています: ${field}` })
    );

    const data: Partial<Employee>[] = [];

    // ヘッダ行以降のデータ行を処理（コメント行はスキップ）
    let dataRowCount = 0;
    for (let i = headerLineIndex + 1; i < allLines.length; i++) {
      const line = allLines[i];
      const values = this.parseCsvLine(line);
      const actualRowNumber = i + 1; // 1-based（元CSVの行番号）

      // コメント行はスキップ
      if (this.isCommentLine(values)) {
        continue;
      }

      dataRowCount++;
      const record: Partial<Employee> = {};

      headerIndexes.forEach((field, colIndex) => {
        const raw = values[colIndex] ?? '';
        const trimmed = raw.trim();

        if (trimmed === '') {
          return;
        }

        if (this.booleanFields.has(field)) {
          const normalized = trimmed.toLowerCase();
          record[field] = (['true', '1', 'yes', 'y', 'はい'] as string[]).includes(normalized)
            ? (true as any)
            : (['false', '0', 'no', 'n', 'いいえ'] as string[]).includes(normalized)
              ? (false as any)
              : (trimmed as any);
          return;
        }

        if (this.numericFields.has(field)) {
          const num = Number(trimmed);
          record[field] = Number.isNaN(num) ? (trimmed as any) : (num as any);
          return;
        }

        // employmentTypeの正規化
        if (field === 'employmentType') {
          record[field] = this.normalizeEmploymentType(trimmed) as any;
          return;
        }

        record[field] = trimmed as any;
      });

      data.push(record);
    }

    return { data, errors };
  }

  validateEmployee(employee: Partial<Employee>, rowIndex: number): ValidationError[] {
    const errors: ValidationError[] = [];

    this.requiredFields.forEach((field) => {
      const value = employee[field];
      if (value === undefined || value === null || value === '') {
        errors.push({ rowIndex, field, message: `${field} は必須です` });
      }
    });

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    this.dateFields.forEach((field) => {
      const value = employee[field];
      if (value === undefined || value === null || value === '') {
        return;
      }
      if (typeof value !== 'string' || !datePattern.test(value)) {
        errors.push({ rowIndex, field, message: `${field} は YYYY-MM-DD 形式で入力してください` });
      }
    });

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

    if (employee.monthlyWage !== undefined && employee.monthlyWage !== null) {
      const wage = Number(employee.monthlyWage);
      if (Number.isNaN(wage)) {
        errors.push({ rowIndex, field: 'monthlyWage', message: '標準報酬月額は数値で入力してください' });
      }
    }

    return errors;
  }

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
