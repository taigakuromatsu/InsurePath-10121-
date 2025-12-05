// Common types
export type UserRole = 'admin' | 'hr' | 'employee';
export type IsoDateString = string;
export type YearMonthString = string;

// Payments
export type PaymentStatus = 'unpaid' | 'paid' | 'partially_paid' | 'not_required';
export type PaymentMethod = 'bank_transfer' | 'account_transfer' | 'cash' | 'other';

/**
 * 性別コード
 */
export type Sex = 'male' | 'female' | 'other' | null;

/**
 * 同居／別居フラグ
 */
export type CohabitationFlag = 'cohabiting' | 'separate' | null;

/**
 * 個人番号（マイナンバー）
 */
export type MyNumber = string;

export interface SocialInsurancePayment {
  id: string;
  officeId: string;
  targetYearMonth: string;

  plannedHealthCompany: number;
  plannedCareCompany: number;
  plannedPensionCompany: number;
  plannedTotalCompany: number;

  actualHealthCompany: number | null;
  actualCareCompany: number | null;
  actualPensionCompany: number | null;
  actualTotalCompany: number | null;

  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  paymentMethodNote?: string | null;
  paymentDate: IsoDateString | null;

  memo?: string | null;

  createdAt: IsoDateString;
  createdByUserId: string;
  updatedAt: IsoDateString;
  updatedByUserId: string;
}

// Social insurance procedures
export type ProcedureType =
  | 'qualification_acquisition'
  | 'qualification_loss'
  | 'standard_reward'
  | 'monthly_change'
  | 'dependent_change'
  | 'bonus_payment';

export type ProcedureStatus = 'not_started' | 'in_progress' | 'submitted' | 'rejected';

export interface SocialInsuranceProcedure {
  id: string;
  officeId: string;
  procedureType: ProcedureType;
  employeeId: string;
  dependentId?: string;
  incidentDate: string;
  deadline: string;
  status: ProcedureStatus;
  submittedAt?: string;
  assignedPersonName?: string;
  note?: string;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  createdByUserId?: string;
  updatedByUserId?: string;
}

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
  officeSymbol?: string;
  officeNumber?: string;
  officeCityCode?: string;
  officePostalCode?: string;
  officePhone?: string;
  officeOwnerName?: string;
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

// 資格取得区分（簡易）
export type InsuranceQualificationKind =
  | 'new_hire'
  | 'expansion'
  | 'hours_change'
  | 'other';

// 資格喪失理由区分（簡易）
export type InsuranceLossReasonKind = 'retirement' | 'hours_decrease' | 'death' | 'other';

// 就業状態（簡易）
export type WorkingStatus =
  | 'normal'
  | 'maternity_leave'
  | 'childcare_leave'
  | 'sick_leave'
  | 'other';

// 就業状態における保険料の扱い（簡易）
export type PremiumTreatment = 'normal' | 'exempt';

// 標準報酬決定区分
export type StandardRewardDecisionKind =
  | 'regular'
  | 'interim'
  | 'bonus'
  | 'qualification'
  | 'loss'
  | 'other';

// 扶養家族（被扶養者）
export type DependentRelationship =
  | 'spouse'
  | 'child'
  | 'parent'
  | 'grandparent'
  | 'sibling'
  | 'other';

export interface Dependent {
  id: string;
  name: string;
  kana?: string;
  sex?: Sex;
  postalCode?: string;
  address?: string;
  cohabitationFlag?: CohabitationFlag;
  relationship: DependentRelationship;
  dateOfBirth: IsoDateString;
  myNumber?: MyNumber;
  qualificationAcquiredDate?: IsoDateString;
  qualificationLossDate?: IsoDateString;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}

// 扶養状況確認結果
export type DependentReviewResult = 'continued' | 'to_be_removed' | 'needs_review';

export interface DependentReview {
  id: string;
  officeId: string;
  employeeId: string;
  dependentId: string;
  reviewDate: string; // YYYY-MM-DD形式
  result: DependentReviewResult;
  reviewedBy?: string;
  note?: string;
  sessionId?: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  createdByUserId: string;
  updatedByUserId: string;
}

export interface DependentReviewSession {
  id: string;
  officeId: string;
  referenceDate: string; // YYYY-MM-DD形式（基準年月日）
  checkedAt: string; // YYYY-MM-DD形式（実施日）
  checkedBy?: string; // 担当者名
  note?: string; // 備考（例：「2025年定期確認」）
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  createdByUserId: string;
  updatedByUserId: string;
}

// 標準報酬決定・改定履歴（Phase2-5: MVP）
export interface StandardRewardHistory {
  id: string;
  employeeId: string;
  decisionYearMonth: YearMonthString;
  appliedFromYearMonth: YearMonthString;
  standardMonthlyReward: number;
  decisionKind: StandardRewardDecisionKind;
  note?: string;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  createdByUserId?: string;
  updatedByUserId?: string;
}

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
  address?: string;
  phone?: string;
  contactEmail?: string;
  employeeCodeInOffice?: string;
  sex?: Sex;
  postalCode?: string;
  addressKana?: string;

  /** 所定労働条件 */
  weeklyWorkingHours?: number;
  weeklyWorkingDays?: number;
  contractPeriodNote?: string;
  isStudent?: boolean;

  /** 社会保険上の報酬月額（手当込みの月給ベース） */
  monthlyWage: number;

  /** 社会保険の加入対象かどうか（true のみ計算対象） */
  isInsured: boolean;

  /** 保険関連番号 */
  healthInsuredSymbol?: string;
  healthInsuredNumber?: string;
  pensionNumber?: string;
  myNumber?: MyNumber;

  /** 健康保険の資格情報 */
  healthQualificationDate?: IsoDateString;
  healthLossDate?: IsoDateString;
  healthQualificationKind?: InsuranceQualificationKind;
  healthLossReasonKind?: InsuranceLossReasonKind;

  /** 厚生年金の資格情報 */
  pensionQualificationDate?: IsoDateString;
  pensionLossDate?: IsoDateString;
  pensionQualificationKind?: InsuranceQualificationKind;
  pensionLossReasonKind?: InsuranceLossReasonKind;

  /** 就業状態（産休・育休・休職など） */
  workingStatus?: WorkingStatus;
  workingStatusStartDate?: IsoDateString;
  workingStatusEndDate?: IsoDateString;
  premiumTreatment?: PremiumTreatment;
  workingStatusNote?: string;

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

// Cloud Master types (Phase3-11)
export interface CloudHealthRateTable {
  id: string; // ドキュメントID（形式: "{year}_{prefCode}"、例: "2024_13"）
  year: number; // 年度（年度の開始年、例: 2024年度なら2024）
  planType: 'kyokai'; // クラウドマスタは協会けんぽのみ（組合健保は事業所ごとに異なるため）
  kyokaiPrefCode: string; // 都道府県コード（2桁、例: "13"）
  kyokaiPrefName: string; // 都道府県名（例: "東京都"）
  healthRate: number; // 健康保険料率（事業主＋被保険者合計の率、小数形式、例: 0.1031 = 10.31%）
  bands: StandardRewardBand[]; // 標準報酬等級表（全国一律）
  createdAt: IsoDateString; // 作成日時
  updatedAt: IsoDateString; // 更新日時
  updatedByUserId: string; // 更新者ユーザーID
  version?: number; // 改定履歴管理用（将来拡張、現時点では未使用）
}

export interface CloudCareRateTable {
  id: string; // ドキュメントID（形式: "{year}"、例: "2024"）
  year: number; // 年度（年度の開始年、例: 2024年度なら2024）
  careRate: number; // 介護保険料率（事業主＋被保険者合計の率、全国一律、小数形式、例: 0.0159 = 1.59%）
  createdAt: IsoDateString; // 作成日時
  updatedAt: IsoDateString; // 更新日時
  updatedByUserId: string; // 更新者ユーザーID
  version?: number; // 改定履歴管理用（将来拡張、現時点では未使用）
}

export interface CloudPensionRateTable {
  id: string; // ドキュメントID（形式: "{year}"、例: "2024"）
  year: number; // 年度（年度の開始年、例: 2024年度なら2024）
  pensionRate: number; // 厚生年金保険料率（事業主＋被保険者合計の率、全国一律、小数形式、例: 0.183 = 18.3%）
  bands: StandardRewardBand[]; // 標準報酬等級表（全国一律）
  createdAt: IsoDateString; // 作成日時
  updatedAt: IsoDateString; // 更新日時
  updatedByUserId: string; // 更新者ユーザーID
  version?: number; // 改定履歴管理用（将来拡張、現時点では未使用）
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

  // オプション情報
  healthStandardBonusCumulative?: number;
  note?: string;
  healthEffectiveAmount?: number;
  healthExceededAmount?: number;
  pensionEffectiveAmount?: number;
  pensionExceededAmount?: number;

  createdAt: IsoDateString;
  createdByUserId?: string;
}

// Change requests
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'canceled';

export type ChangeRequestKind = 'profile' | 'dependent_add' | 'dependent_update' | 'dependent_remove';

export interface DependentAddPayload {
  name: string;
  kana?: string;
  relationship: DependentRelationship;
  dateOfBirth: IsoDateString;
  sex?: Sex;
  postalCode?: string;
  address?: string;
  cohabitationFlag?: CohabitationFlag;
  isWorking?: boolean;
}

export interface DependentUpdatePayload {
  name: string;
  kana?: string;
  relationship: DependentRelationship;
  dateOfBirth: IsoDateString;
  sex?: Sex;
  postalCode?: string;
  address?: string;
  cohabitationFlag?: CohabitationFlag;
  isWorking?: boolean;
}

export interface DependentRemovePayload {
  dependentName: string;
  relationship?: DependentRelationship;
  dateOfBirth?: IsoDateString;
  reason?: string;
}

export type DependentRequestPayload =
  | DependentAddPayload
  | DependentUpdatePayload
  | DependentRemovePayload;

export interface ChangeRequest {
  id: string;
  officeId: string;
  employeeId: string;
  requestedByUserId: string;
  kind: ChangeRequestKind;
  field?: 'postalCode' | 'address' | 'phone' | 'contactEmail' | 'kana' | 'other';
  currentValue?: string;
  requestedValue?: string;
  targetDependentId?: string;
  payload?: DependentRequestPayload;
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

// Document management (Phase3-10)
export type DocumentCategory =
  | 'identity'           // 本人確認書類（運転免許証、マイナンバーカード、在留カード 等）
  | 'residence'          // 住所・居住関係（住民票 等）
  | 'incomeProof'        // 収入証明（源泉徴収票、給与明細、課税証明書 等）
  | 'studentProof'       // 在学証明
  | 'relationshipProof'  // 続柄・同居証明（戸籍謄本、住民票（世帯全員） 等）
  | 'otherInsurance'     // 他健康保険・年金加入証明
  | 'medical'            // 障害・傷病関連証明（診断書 等）
  | 'caregiving'         // 介護関連証明（要介護・要支援認定 等）
  | 'procedureOther'     // その他社会保険手続き用資料
  | 'other';             // 上記いずれにも当てはまらないもの

export type DocumentSource = 'adminUpload' | 'employeeUploadViaRequest';

export type DocumentRequestStatus = 'pending' | 'uploaded' | 'cancelled';

export interface DocumentAttachment {
  id: string;
  officeId: string;
  
  // この書類が紐づく従業員
  employeeId: string;          // 必須。誰の書類かを一意に特定する
  
  // 将来的に「扶養家族ごとの書類」も扱いたいので余地を残しておく
  dependentId?: string | null; // Phase3-10ではあってもなくてもよいが、型としては考慮したい
  
  // 書類種別
  category: DocumentCategory;
  
  // 一覧でわかりやすくするための自由タイトル（例：「源泉徴収票（2024年度）」）
  title: string;
  
  // 管理者・従業員が自由に書けるメモ
  note?: string | null;
  
  // Storage 上のパス（例：offices/{officeId}/employees/{employeeId}/documents/{documentId}/{filename}）
  storagePath: string;
  
  // ファイル名（元のファイル名を保持）
  fileName: string;
  
  // ファイルサイズ（バイト）
  fileSize: number;
  
  // MIMEタイプ（例：application/pdf、image/png）
  mimeType: string;
  
  // 誰がいつアップロードしたか
  uploadedAt: IsoDateString;  // Storage にファイルを上げたタイミング（≒ほぼ createdAt と同じでもOK）
  uploadedByUserId: string;
  uploadedByDisplayName: string;
  
  // この書類が、リクエスト経由でアップされたものかどうか
  source: DocumentSource;
  requestId?: string | null;  // source === 'employeeUploadViaRequest' の場合のみ設定
  
  // 有効期限の管理（任意）
  expiresAt?: IsoDateString | null;
  isExpired?: boolean;  // 将来の集計用にフラグを用意しておいてもよい
  
  createdAt: IsoDateString;  // Firestore ドキュメントの作成時刻（uploadedAt と基本的に同じタイミングでセット）
  updatedAt: IsoDateString;  // メモや有効期限変更時に更新
}

export interface DocumentRequest {
  id: string;
  officeId: string;
  
  // 依頼先の従業員
  employeeId: string;
  
  // 要求する書類種別
  category: DocumentCategory;
  
  // タイトル（例：「運転免許証の両面コピー」）
  title: string;
  
  // 注意事項や補足の長文メッセージ
  message?: string | null;
  
  // 誰がいつ依頼したか
  requestedByUserId: string;
  requestedByDisplayName: string;
  
  // 依頼ステータス
  status: DocumentRequestStatus;
  
  // 依頼作成タイミング
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  
  // アップロード完了やキャンセル時にセットされる
  resolvedAt?: IsoDateString | null;  // status === 'uploaded' の場合に設定
  
  // 期限（任意）
  dueDate?: IsoDateString | null;
}
