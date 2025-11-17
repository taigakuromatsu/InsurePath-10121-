// Common types
export type UserRole = 'admin' | 'hr' | 'employee';
export type IsoDateString = string;
export type YearMonthString = string;

// 等級がどう決まったかの情報
export type GradeDecisionSource = 'auto' | 'manual' | 'imported';

// User & Office
export interface UserProfile {
  id: string;
  officeId?: string;
  role: UserRole;
  email: string;
  displayName: string;
  employeeId?: string;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}

export type HealthPlanType = 'kyokai' | 'kumiai';

export interface Office {
  id: string;
  name: string;
  address?: string;
  healthPlanType: HealthPlanType;
  kyokaiPrefCode?: string;
  kyokaiPrefName?: string;
  unionName?: string;
  unionCode?: string;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}

// Employees
export type EmploymentType =
  | 'regular'
  | 'contract'
  | 'part'
  | 'アルバイト'
  | 'other';

export interface Employee {
  id: string;
  officeId: string;
  name: string;
  kana?: string;
  birthDate: IsoDateString;
  department?: string;
  hireDate: IsoDateString;
  retireDate?: IsoDateString;
  employmentType: EmploymentType;

  /** 社会保険上の報酬月額（手当込みの月給ベース） */
  monthlyWage: number;

  /** 社会保険の加入対象かどうか（true のみ計算対象） */
  isInsured: boolean;

  /** 健康保険の等級・標準報酬（月額） */
  healthGrade?: number;
  healthStandardMonthly?: number;
  healthGradeSource?: GradeDecisionSource;

  /** 厚生年金の等級・標準報酬（月額） */
  pensionGrade?: number;
  pensionStandardMonthly?: number;
  pensionGradeSource?: GradeDecisionSource;

  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  updatedByUserId?: string;
}

// Rate tables
export interface StandardRewardBand {
  grade: number;
  lowerLimit: number;
  upperLimit: number;
  standardMonthly: number;
}

export interface HealthRateTable {
  id: string;
  officeId: string;
  year: number;
  planType: HealthPlanType;
  kyokaiPrefCode?: string;
  kyokaiPrefName?: string;
  unionName?: string;
  unionCode?: string;
  /** 健康保険料率（事業主＋被保険者合計の率） */
  healthRate: number;
  bands: StandardRewardBand[];
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}

export interface CareRateTable {
  id: string;
  officeId: string;
  year: number;
  /** 介護保険料率（事業主＋被保険者合計の率） */
  careRate: number;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}

export interface PensionRateTable {
  id: string;
  officeId: string;
  year: number;
  /** 厚生年金保険料率（事業主＋被保険者合計の率） */
  pensionRate: number;
  bands: StandardRewardBand[];
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}

// Monthly premiums
export interface MonthlyPremium {
  id: string;
  officeId: string;
  employeeId: string;
  yearMonth: YearMonthString;

  // 計算時点での等級・標準報酬（スナップショット）
  healthGrade: number;
  healthStandardMonthly: number;
  healthGradeSource?: GradeDecisionSource;

  pensionGrade: number;
  pensionStandardMonthly: number;
  pensionGradeSource?: GradeDecisionSource;

  healthTotal: number;
  healthEmployee: number;
  healthEmployer: number;

  careTotal?: number;
  careEmployee?: number;
  careEmployer?: number;

  pensionTotal: number;
  pensionEmployee: number;
  pensionEmployer: number;

  totalEmployee: number;
  totalEmployer: number;

  calculatedAt: IsoDateString;
  calculatedByUserId?: string;
}

// Bonus premiums
export interface BonusPremium {
  id: string;
  officeId: string;
  employeeId: string;
  payDate: IsoDateString;
  grossAmount: number;
  standardBonusAmount: number;
  fiscalYear: string;

  healthTotal: number;
  healthEmployee: number;
  healthEmployer: number;

  pensionTotal: number;
  pensionEmployee: number;
  pensionEmployer: number;

  totalEmployee: number;
  totalEmployer: number;

  createdAt: IsoDateString;
  createdByUserId?: string;
}

// Change requests
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ChangeRequest {
  id: string;
  officeId: string;
  employeeId: string;
  requestedByUserId: string;
  field: 'address' | 'phone' | 'email' | 'other';
  currentValue: string;
  requestedValue: string;
  status: ChangeRequestStatus;
  requestedAt: IsoDateString;
  decidedAt?: IsoDateString;
  decidedByUserId?: string;
  rejectReason?: string;
}

// Import jobs
export type ImportJobStatus = 'running' | 'completed' | 'failed';

export interface ImportJob {
  id: string;
  officeId: string;
  fileName: string;
  status: ImportJobStatus;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errorMessages?: string[];
  startedAt: IsoDateString;
  finishedAt?: IsoDateString;
  startedByUserId: string;
}
