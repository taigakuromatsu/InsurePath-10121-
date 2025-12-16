import {
  Employee,
  EmploymentType,
  Sex,
  InsuranceQualificationKind,
  InsuranceLossReasonKind,
  WorkingStatus,
  BankAccountType,
  PayrollPayType,
  PayrollPayCycle,
  PremiumExemptionMonth,
  ExemptionKind,
  YearMonthString
} from '../types';

/**
 * CSV列定義（v2仕様）
 * インポート/エクスポート/テンプレートで共通使用
 */
export interface CsvColumnDefinition {
  /** CSVヘッダ名（日本語） */
  header: string;
  /** 旧ヘッダ名や揺れを吸収するエイリアス（例: "標準報酬月額" → healthStandardMonthly/pensionStandardMonthlyの救済読み込み用） */
  aliases?: string[];
  /** Employeeオブジェクトから値を取得する関数（エクスポート用） */
  getter: (employee: Employee) => string | number | null | undefined;
  /** CSVの生文字列をEmployeeオブジェクトに設定する関数（インポート用） */
  setter: (employee: Partial<Employee>, value: string) => void;
  /** 生文字列を型変換する関数（parse） */
  parse?: (value: string) => any;
  /** バリデーション関数（行単位/項目単位） */
  validate?: (value: any, employee: Partial<Employee>) => string | null;
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

/**
 * 文字列を正規化（空文字・null・undefinedの処理）
 */
function normalizeString(value: string): string | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '__CLEAR__') {
    return trimmed === '__CLEAR__' ? null : undefined;
  }
  return trimmed;
}

/**
 * 数値をパース
 */
function parseNumber(value: string): number | null | undefined {
  const normalized = normalizeString(value);
  if (normalized === undefined || normalized === null) {
    return normalized;
  }
  const num = Number(normalized);
  return Number.isNaN(num) ? undefined : num;
}

/**
 * 真偽値をパース
 */
function parseBoolean(value: string): boolean | null | undefined {
  const normalized = normalizeString(value);
  if (normalized === undefined || normalized === null) {
    return normalized;
  }
  const lower = normalized.toLowerCase();
  return ['true', '1', 'yes', 'y', 'はい'].includes(lower)
    ? true
    : ['false', '0', 'no', 'n', 'いいえ'].includes(lower)
      ? false
      : undefined;
}

/**
 * 日付をパース（YYYY-MM-DD形式）
 */
function parseDate(value: string): string | null | undefined {
  const normalized = normalizeString(value);
  if (normalized === undefined || normalized === null) {
    return normalized;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined;
  }
  return normalized;
}

/**
 * 年月をパース（YYYY-MM形式）
 */
function parseYearMonth(value: string): YearMonthString | null | undefined {
  const normalized = normalizeString(value);
  if (normalized === undefined || normalized === null) {
    return normalized;
  }
  if (!/^\d{4}-\d{2}$/.test(normalized)) {
    return undefined;
  }
  return normalized as YearMonthString;
}

/**
 * 雇用形態を正規化
 */
function normalizeEmploymentType(raw: string): EmploymentType | string | undefined {
  const normalized = raw.toLowerCase().replace(/\s+/g, '');
  const map: Record<string, EmploymentType> = {
    regular: 'regular',
    正社員: 'regular',
    contract: 'contract',
    契約社員: 'contract',
    契約: 'contract',
    part: 'part',
    パート: 'part',
    アルバイト: 'アルバイト',
    アルバイトスタッフ: 'アルバイト',
    other: 'other',
    その他: 'other'
  };
  return map[normalized] ?? raw;
}

/**
 * 性別を正規化
 */
function normalizeSex(raw: string): Sex | undefined {
  const normalized = raw.toLowerCase().trim();
  const map: Record<string, Sex> = {
    male: 'male',
    男: 'male',
    男性: 'male',
    female: 'female',
    女: 'female',
    女性: 'female',
    other: 'other',
    その他: 'other'
  };
  return map[normalized] ?? undefined;
}

/**
 * 就業状態を正規化
 */
function normalizeWorkingStatus(raw: string): WorkingStatus | undefined {
  const normalized = raw.toLowerCase().trim();
  const map: Record<string, WorkingStatus> = {
    normal: 'normal',
    通常勤務: 'normal',
    maternity_leave: 'maternity_leave',
    産前産後休業: 'maternity_leave',
    産休: 'maternity_leave',
    childcare_leave: 'childcare_leave',
    育児休業: 'childcare_leave',
    育休: 'childcare_leave'
  };
  return map[normalized] ?? undefined;
}

/**
 * 資格取得区分を正規化
 */
function normalizeQualificationKind(raw: string): InsuranceQualificationKind | undefined {
  const normalized = raw.toLowerCase().trim();
  const map: Record<string, InsuranceQualificationKind> = {
    new_hire: 'new_hire',
    新規採用: 'new_hire',
    expansion: 'expansion',
    適用拡大: 'expansion',
    hours_change: 'hours_change',
    所定労働時間変更: 'hours_change',
    other: 'other',
    その他: 'other'
  };
  return map[normalized] ?? undefined;
}

/**
 * 資格喪失理由を正規化
 */
function normalizeLossReasonKind(raw: string): InsuranceLossReasonKind | undefined {
  const normalized = raw.toLowerCase().trim();
  const map: Record<string, InsuranceLossReasonKind> = {
    retirement: 'retirement',
    退職: 'retirement',
    death: 'death',
    死亡: 'death',
    age_75: 'age_75',
    '75歳到達': 'age_75',
    disability: 'disability',
    障害認定: 'disability',
    social_security_agreement: 'social_security_agreement',
    社会保障協定: 'social_security_agreement'
  };
  return map[normalized] ?? undefined;
}

/**
 * 口座種別を正規化
 */
function normalizeBankAccountType(raw: string): BankAccountType | undefined {
  const normalized = raw.toLowerCase().trim();
  const map: Record<string, BankAccountType> = {
    ordinary: 'ordinary',
    普通: 'ordinary',
    checking: 'checking',
    当座: 'checking',
    savings: 'savings',
    貯蓄: 'savings',
    other: 'other',
    その他: 'other'
  };
  return map[normalized] ?? undefined;
}

/**
 * 支給形態を正規化
 */
function normalizePayType(raw: string): PayrollPayType | undefined {
  const normalized = raw.toLowerCase().trim();
  const map: Record<string, PayrollPayType> = {
    monthly: 'monthly',
    月給: 'monthly',
    daily: 'daily',
    日給: 'daily',
    hourly: 'hourly',
    時給: 'hourly',
    annual: 'annual',
    年俸: 'annual',
    other: 'other',
    その他: 'other'
  };
  return map[normalized] ?? undefined;
}

/**
 * 支給サイクルを正規化
 */
function normalizePayCycle(raw: string): PayrollPayCycle | undefined {
  const normalized = raw.toLowerCase().trim();
  const map: Record<string, PayrollPayCycle> = {
    monthly: 'monthly',
    月次: 'monthly',
    twice_per_month: 'twice_per_month',
    月2回: 'twice_per_month',
    weekly: 'weekly',
    週次: 'weekly',
    other: 'other',
    その他: 'other'
  };
  return map[normalized] ?? undefined;
}

/**
 * 免除月をパース（形式: maternity:2025-01,2025-02;childcare:2025-04）
 */
function parsePremiumExemptionMonths(value: string): PremiumExemptionMonth[] | null | undefined {
  const normalized = normalizeString(value);
  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  const result: PremiumExemptionMonth[] = [];
  const yearMonthSet = new Set<string>();
  const parts = normalized.split(';');

  for (const part of parts) {
    const [kindStr, yearMonthsStr] = part.split(':');
    if (!kindStr || !yearMonthsStr) {
      continue;
    }

    const kind = kindStr.trim() as ExemptionKind;
    if (kind !== 'maternity' && kind !== 'childcare') {
      continue;
    }

    const yearMonths = yearMonthsStr.split(',').map((ym) => ym.trim());
    for (const ym of yearMonths) {
      if (!/^\d{4}-\d{2}$/.test(ym)) {
        continue;
      }
      if (yearMonthSet.has(ym)) {
        throw new Error(`重複した対象年月: ${ym}`);
      }
      yearMonthSet.add(ym);
      result.push({ kind, yearMonth: ym as YearMonthString });
    }
  }

  return result.length > 0 ? result : null;
}

/**
 * 免除月をフォーマット（エクスポート用）
 */
function formatPremiumExemptionMonths(months: PremiumExemptionMonth[] | null | undefined): string {
  if (!months || months.length === 0) {
    return '';
  }

  const byKind: Record<ExemptionKind, YearMonthString[]> = {
    maternity: [],
    childcare: []
  };

  for (const month of months) {
    byKind[month.kind].push(month.yearMonth);
  }

  const parts: string[] = [];
  if (byKind.maternity.length > 0) {
    parts.push(`maternity:${byKind.maternity.join(',')}`);
  }
  if (byKind.childcare.length > 0) {
    parts.push(`childcare:${byKind.childcare.join(',')}`);
  }

  return parts.join(';');
}

/**
 * v2 CSV列定義（順序固定）
 */
export const EMPLOYEE_CSV_COLUMNS_V2: CsvColumnDefinition[] = [
  // 基本情報
  {
    header: 'ID',
    getter: (emp) => emp.id ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized) {
        (emp as any).id = normalized;
      }
    }
  },
  {
    header: '氏名',
    getter: (emp) => emp.name ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.name = normalized as string;
      }
    },
    validate: (val) => (!val || val.trim() === '') ? '氏名は必須です' : null
  },
  {
    header: 'フリガナ',
    getter: (emp) => emp.kana ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.kana = normalized as string;
      }
    },
    validate: (val) => (!val || val.trim() === '') ? 'フリガナは必須です' : null
  },
  {
    header: '生年月日',
    getter: (emp) => emp.birthDate ?? '',
    setter: (emp, val) => {
      const parsed = parseDate(val);
      if (parsed !== undefined) {
        emp.birthDate = parsed as any;
      }
    },
    validate: (val) => {
      if (!val || val.trim() === '') {
        return '生年月日は必須です';
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
        return '生年月日はYYYY-MM-DD形式で入力してください';
      }
      return null;
    }
  },
  {
    header: '所属',
    getter: (emp) => emp.department ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.department = normalized as string;
      }
    }
  },
  {
    header: '住所',
    getter: (emp) => emp.address ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.address = normalized as string;
      }
    }
  },
  {
    header: '電話番号',
    getter: (emp) => emp.phone ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.phone = normalized as string;
      }
    }
  },
  {
    header: 'メールアドレス',
    getter: (emp) => emp.contactEmail ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.contactEmail = normalized as string;
      }
    }
  },
  {
    header: '社員番号',
    getter: (emp) => emp.employeeCodeInOffice ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.employeeCodeInOffice = normalized as string;
      }
    }
  },
  {
    header: '性別',
    getter: (emp) => {
      if (emp.sex === 'male') return 'male';
      if (emp.sex === 'female') return 'female';
      if (emp.sex === 'other') return 'other';
      return '';
    },
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined && normalized !== null) {
        emp.sex = normalizeSex(normalized);
      } else if (normalized === null) {
        emp.sex = null;
      }
    }
  },
  {
    header: '郵便番号',
    getter: (emp) => emp.postalCode ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.postalCode = normalized as string;
      }
    }
  },
  {
    header: '住所カナ',
    getter: (emp) => emp.addressKana ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.addressKana = normalized as string;
      }
    }
  },
  {
    header: '入社日',
    getter: (emp) => emp.hireDate ?? '',
    setter: (emp, val) => {
      const parsed = parseDate(val);
      if (parsed !== undefined) {
        emp.hireDate = parsed as any;
      }
    },
    validate: (val) => {
      if (!val || val.trim() === '') {
        return '入社日は必須です';
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
        return '入社日はYYYY-MM-DD形式で入力してください';
      }
      return null;
    }
  },
  {
    header: '退社日',
    getter: (emp) => emp.retireDate ?? '',
    setter: (emp, val) => {
      const parsed = parseDate(val);
      if (parsed !== undefined) {
        emp.retireDate = parsed as any;
      }
    }
  },
  {
    header: '雇用形態',
    getter: (emp) => emp.employmentType ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined && normalized !== null) {
        emp.employmentType = normalizeEmploymentType(normalized) as EmploymentType;
      } else if (normalized === null) {
        emp.employmentType = null as any;
      }
    },
    validate: (val) => {
      if (!val || val.trim() === '') {
        return '雇用形態は必須です';
      }
      return null;
    }
  },
  {
    header: '所定労働時間',
    getter: (emp) => emp.weeklyWorkingHours ?? '',
    setter: (emp, val) => {
      const parsed = parseNumber(val);
      if (parsed !== undefined) {
        emp.weeklyWorkingHours = parsed as number;
      }
    }
  },
  {
    header: '所定労働日数',
    getter: (emp) => emp.weeklyWorkingDays ?? '',
    setter: (emp, val) => {
      const parsed = parseNumber(val);
      if (parsed !== undefined) {
        emp.weeklyWorkingDays = parsed as number;
      }
    }
  },
  {
    header: '雇用契約期間の見込み',
    getter: (emp) => emp.contractPeriodNote ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.contractPeriodNote = normalized as string;
      }
    }
  },
  {
    header: '学生',
    getter: (emp) =>
      emp.isStudent === undefined || emp.isStudent === null ? '' : (emp.isStudent ? 'true' : 'false'),
    setter: (emp, val) => {
      const parsed = parseBoolean(val);
      if (parsed !== undefined) {
        emp.isStudent = parsed as boolean;
      }
    }
  },
  {
    header: '社会保険加入',
    getter: (emp) =>
      emp.isInsured === undefined || emp.isInsured === null ? '' : (emp.isInsured ? 'true' : 'false'),
    setter: (emp, val) => {
      const parsed = parseBoolean(val);
      if (parsed !== undefined) {
        emp.isInsured = parsed as boolean;
      }
    }
  },
  {
    header: '就業状態',
    getter: (emp) => emp.workingStatus ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined && normalized !== null) {
        emp.workingStatus = normalizeWorkingStatus(normalized);
      } else if (normalized === null) {
        emp.workingStatus = null as any;
      }
    }
  },
  {
    header: '就業状態メモ',
    getter: (emp) => emp.workingStatusNote ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.workingStatusNote = normalized as string;
      }
    }
  },
  {
    header: '被保険者記号',
    getter: (emp) => emp.healthInsuredSymbol ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.healthInsuredSymbol = normalized as string;
      }
    }
  },
  {
    header: '被保険者番号',
    getter: (emp) => emp.healthInsuredNumber ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.healthInsuredNumber = normalized as string;
      }
    }
  },
  {
    header: '厚生年金番号',
    getter: (emp) => emp.pensionNumber ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        emp.pensionNumber = normalized as string;
      }
    }
  },
  {
    header: '資格取得日（健保）',
    getter: (emp) => emp.healthQualificationDate ?? '',
    setter: (emp, val) => {
      const parsed = parseDate(val);
      if (parsed !== undefined) {
        emp.healthQualificationDate = parsed as any;
      }
    }
  },
  {
    header: '資格取得区分（健保）',
    getter: (emp) => emp.healthQualificationKind ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined && normalized !== null) {
        emp.healthQualificationKind = normalizeQualificationKind(normalized);
      } else if (normalized === null) {
        emp.healthQualificationKind = null as any;
      }
    }
  },
  {
    header: '資格喪失日（健保）',
    getter: (emp) => emp.healthLossDate ?? '',
    setter: (emp, val) => {
      const parsed = parseDate(val);
      if (parsed !== undefined) {
        emp.healthLossDate = parsed as any;
      }
    }
  },
  {
    header: '資格喪失理由（健保）',
    getter: (emp) => emp.healthLossReasonKind ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined && normalized !== null) {
        emp.healthLossReasonKind = normalizeLossReasonKind(normalized);
      } else if (normalized === null) {
        emp.healthLossReasonKind = null as any;
      }
    }
  },
  {
    header: '資格取得日（年金）',
    getter: (emp) => emp.pensionQualificationDate ?? '',
    setter: (emp, val) => {
      const parsed = parseDate(val);
      if (parsed !== undefined) {
        emp.pensionQualificationDate = parsed as any;
      }
    }
  },
  {
    header: '資格取得区分（年金）',
    getter: (emp) => emp.pensionQualificationKind ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined && normalized !== null) {
        emp.pensionQualificationKind = normalizeQualificationKind(normalized);
      } else if (normalized === null) {
        emp.pensionQualificationKind = null as any;
      }
    }
  },
  {
    header: '資格喪失日（年金）',
    getter: (emp) => emp.pensionLossDate ?? '',
    setter: (emp, val) => {
      const parsed = parseDate(val);
      if (parsed !== undefined) {
        emp.pensionLossDate = parsed as any;
      }
    }
  },
  {
    header: '資格喪失理由（年金）',
    getter: (emp) => emp.pensionLossReasonKind ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined && normalized !== null) {
        emp.pensionLossReasonKind = normalizeLossReasonKind(normalized);
      } else if (normalized === null) {
        emp.pensionLossReasonKind = null as any;
      }
    }
  },
  {
    header: '健康保険等級',
    getter: (emp) => emp.healthGrade ?? '',
    setter: (emp, val) => {
      const parsed = parseNumber(val);
      if (parsed !== undefined) {
        emp.healthGrade = parsed as number;
      }
    }
  },
  {
    header: '健康保険標準報酬月額',
    getter: (emp) => emp.healthStandardMonthly ?? '',
    setter: (emp, val) => {
      const parsed = parseNumber(val);
      if (parsed !== undefined) {
        emp.healthStandardMonthly = parsed as number;
      }
    }
  },
  {
    header: '厚生年金等級',
    getter: (emp) => emp.pensionGrade ?? '',
    setter: (emp, val) => {
      const parsed = parseNumber(val);
      if (parsed !== undefined) {
        emp.pensionGrade = parsed as number;
      }
    }
  },
  {
    header: '厚生年金標準報酬月額',
    getter: (emp) => emp.pensionStandardMonthly ?? '',
    setter: (emp, val) => {
      const parsed = parseNumber(val);
      if (parsed !== undefined) {
        emp.pensionStandardMonthly = parsed as number;
      }
    }
  },
  // 旧CSV救済: 「標準報酬月額」→ healthStandardMonthly/pensionStandardMonthly の両方に設定
  {
    header: '標準報酬月額',
    aliases: ['標準報酬月額'],
    getter: () => '', // エクスポートには出さない（deprecated）
    setter: (emp, val) => {
      const parsed = parseNumber(val);
      if (parsed !== undefined && parsed !== null) {
        // 旧CSV救済: 両方に同じ値を設定
        emp.healthStandardMonthly = parsed as number;
        emp.pensionStandardMonthly = parsed as number;
      }
    }
  },
  {
    header: '報酬月額',
    getter: (emp) => emp.payrollSettings?.insurableMonthlyWage ?? '',
    setter: (emp, val) => {
      const parsed = parseNumber(val);
      if (parsed !== undefined) {
        if (!emp.payrollSettings) {
          emp.payrollSettings = {} as any;
        }
        emp.payrollSettings!.insurableMonthlyWage = parsed as number;
      }
    }
  },
  {
    header: '支給形態',
    getter: (emp) => emp.payrollSettings?.payType ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined && normalized !== null) {
        if (!emp.payrollSettings) {
          emp.payrollSettings = {} as any;
        }
        emp.payrollSettings!.payType = normalizePayType(normalized) as PayrollPayType;
      } else if (normalized === null) {
        if (!emp.payrollSettings) {
          emp.payrollSettings = {} as any;
        }
        emp.payrollSettings!.payType = null as any;
      }
    }
  },
  {
    header: '支給サイクル',
    getter: (emp) => emp.payrollSettings?.payCycle ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined && normalized !== null) {
        if (!emp.payrollSettings) {
          emp.payrollSettings = {} as any;
        }
        emp.payrollSettings!.payCycle = normalizePayCycle(normalized) as PayrollPayCycle;
      } else if (normalized === null) {
        if (!emp.payrollSettings) {
          emp.payrollSettings = {} as any;
        }
        emp.payrollSettings!.payCycle = null as any;
      }
    }
  },
  {
    header: '給与メモ',
    getter: (emp) => emp.payrollSettings?.note ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        if (!emp.payrollSettings) {
          emp.payrollSettings = {} as any;
        }
        emp.payrollSettings!.note = normalized as string;
      }
    }
  },
  {
    header: '保険料免除月',
    getter: (emp) => formatPremiumExemptionMonths(emp.premiumExemptionMonths),
    setter: (emp, val) => {
      const parsed = parsePremiumExemptionMonths(val);
      if (parsed !== undefined) {
        emp.premiumExemptionMonths = parsed as PremiumExemptionMonth[];
      }
    }
  },
  {
    header: '金融機関名',
    getter: (emp) => emp.bankAccount?.bankName ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        if (!emp.bankAccount) {
          emp.bankAccount = {} as any;
        }
        emp.bankAccount!.bankName = normalized as string;
      }
    }
  },
  {
    header: '金融機関コード',
    getter: (emp) => emp.bankAccount?.bankCode ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        if (!emp.bankAccount) {
          emp.bankAccount = {} as any;
        }
        emp.bankAccount!.bankCode = normalized as string;
      }
    }
  },
  {
    header: '支店名',
    getter: (emp) => emp.bankAccount?.branchName ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        if (!emp.bankAccount) {
          emp.bankAccount = {} as any;
        }
        emp.bankAccount!.branchName = normalized as string;
      }
    }
  },
  {
    header: '支店コード',
    getter: (emp) => emp.bankAccount?.branchCode ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        if (!emp.bankAccount) {
          emp.bankAccount = {} as any;
        }
        emp.bankAccount!.branchCode = normalized as string;
      }
    }
  },
  {
    header: '口座種別',
    getter: (emp) => emp.bankAccount?.accountType ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined && normalized !== null) {
        if (!emp.bankAccount) {
          emp.bankAccount = {} as any;
        }
        emp.bankAccount!.accountType = normalizeBankAccountType(normalized) as BankAccountType;
      } else if (normalized === null) {
        if (!emp.bankAccount) {
          emp.bankAccount = {} as any;
        }
        emp.bankAccount!.accountType = null as any;
      }
    }
  },
  {
    header: '口座番号',
    getter: (emp) => emp.bankAccount?.accountNumber ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        if (!emp.bankAccount) {
          emp.bankAccount = {} as any;
        }
        emp.bankAccount!.accountNumber = normalized as string;
      }
    }
  },
  {
    header: '名義',
    getter: (emp) => emp.bankAccount?.accountHolderName ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        if (!emp.bankAccount) {
          emp.bankAccount = {} as any;
        }
        emp.bankAccount!.accountHolderName = normalized as string;
      }
    }
  },
  {
    header: '名義カナ',
    getter: (emp) => emp.bankAccount?.accountHolderKana ?? '',
    setter: (emp, val) => {
      const normalized = normalizeString(val);
      if (normalized !== undefined) {
        if (!emp.bankAccount) {
          emp.bankAccount = {} as any;
        }
        emp.bankAccount!.accountHolderKana = normalized as string;
      }
    }
  },
  {
    header: '主口座フラグ',
    getter: (emp) =>
      emp.bankAccount?.isMain === undefined || emp.bankAccount?.isMain === null
        ? ''
        : (emp.bankAccount!.isMain ? 'true' : 'false'),
    setter: (emp, val) => {
      const parsed = parseBoolean(val);
      if (parsed !== undefined) {
        if (!emp.bankAccount) {
          emp.bankAccount = {} as any;
        }
        emp.bankAccount!.isMain = parsed as boolean;
      }
    }
  }
  // マイナンバーはセキュリティ上、CSVには含めない（必要なら別途検討）
];

/**
 * ヘッダ名から列定義を取得（エイリアス対応・BOM除去対応）
 */
export function findColumnDefinitionByHeader(header: string): CsvColumnDefinition | undefined {
  const normalized = header.replace(/^\uFEFF/, '').trim(); // BOM除去
  return EMPLOYEE_CSV_COLUMNS_V2.find(
    (col) => col.header === normalized || col.aliases?.includes(normalized)
  );
}

/**
 * v2 CSVヘッダ一覧を取得（テンプレート/エクスポート用）
 */
export function getEmployeeCsvHeadersV2(): string[] {
  return EMPLOYEE_CSV_COLUMNS_V2.map((col) => col.header);
}

