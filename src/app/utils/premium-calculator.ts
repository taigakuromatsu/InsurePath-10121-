import { Employee, IsoDateString, StandardRewardHistory, YearMonthString } from '../types';

/**
 * 保険料計算に必要な料率コンテキスト
 *
 * @param yearMonth - 計算対象年月（例: '2025-04'）
 * @param calcDate - 計算実行日時（ISO形式、例: '2025-01-15T10:30:00.000Z'）
 * @param healthRate - 健康保険料率（事業主＋被保険者合計、例: 0.0991 = 9.91%）
 * @param careRate - 介護保険料率（事業主＋被保険者合計、例: 0.0191 = 1.91%）
 * @param pensionRate - 厚生年金保険料率（事業主＋被保険者合計、例: 0.183 = 18.3%）
 */
export interface PremiumRateContext {
  yearMonth: YearMonthString;
  calcDate: IsoDateString;

  healthRate?: number;
  careRate?: number;
  pensionRate?: number;
}

/**
 * 月次保険料の金額（各保険の本人負担・事業主負担）
 */
export interface MonthlyPremiumAmounts {
  // 健康保険＋介護保険（合算）
  healthCareFull: number; // 全額（端数処理前）
  healthCareEmployee: number; // 従業員負担額（50銭ルール適用後）
  healthCareEmployer: number; // 会社負担額（参考値）

  // 厚生年金
  pensionFull: number; // 全額（端数処理前）
  pensionEmployee: number; // 従業員負担額（50銭ルール適用後）
  pensionEmployer: number; // 会社負担額（参考値）

  // 行レベル参考値（healthCare + pension の合計）
  totalFull: number; // 全額合計（端数処理前、行レベル参考値）
  totalEmployee: number; // 従業員負担合計（行レベル参考値）
  totalEmployer: number; // 会社負担合計（行レベル参考値）

  // 後方互換用（deprecated）
    /** @deprecated 健康保険と介護保険は合算して healthCareFull を使用してください。 */
  healthTotal: number;
    /** @deprecated 従業員負担（健保+介護の合算値）。通常は healthCareEmployee を使用してください。 */
  healthEmployee: number;
    /** @deprecated 会社負担（健保+介護の合算値）。通常は healthCareEmployer を使用してください。 */
  healthEmployer: number;
    /** @deprecated 介護保険分のみの参考値です。通常は healthCare* を使用してください。 */
  careTotal: number;
    /** @deprecated 介護保険の従業員負担（参考値） */
  careEmployee: number;
    /** @deprecated 介護保険の会社負担（参考値） */
  careEmployer: number;

  pensionTotal: number;
}

/**
 * 月次保険料計算結果
 *
 * → MonthlyPremium ドキュメントを作るための元データ
 */
export interface MonthlyPremiumCalculationResult {
  employeeId: string;
  officeId: string;
  yearMonth: YearMonthString;

  // 等級・標準報酬（月給）はスナップショットとして保持
  healthGrade: number;
  healthStandardMonthly: number;
  pensionGrade: number;
  pensionStandardMonthly: number;

  amounts: MonthlyPremiumAmounts;
}

// 'YYYY-MM-DD' 形式の文字列 → 'YYYY-MM' だけ取り出す。
// 空文字・undefined・null のときは null を返す。
function toYearMonthOrNull(dateStr?: string | null): YearMonthString | null {
  if (!dateStr) return null;
  return dateStr.substring(0, 7) as YearMonthString;
}

/**
 * 従業員負担額に50銭ルールを適用する
 * - 50銭以下: 切り捨て
 * - 50銭超 : 切り上げて1円
 */
export function roundForEmployeeDeduction(amount: number): number {
  const integer = Math.floor(amount);
  const fractional = amount - integer;
  const cent = Math.round(fractional * 100); // 浮動小数の誤差を避ける
  return cent <= 50 ? integer : integer + 1;
}

/**
 * 標準報酬履歴から、指定年月に適用される標準報酬月額を取得する。
 *
 * ルール:
 * - appliedFromYearMonth <= yearMonth を満たす履歴のうち、最新のものを取得
 * - 該当する履歴がない場合は null を返す
 *
 * @param histories - 標準報酬履歴の配列（保険種別でフィルタ済み）
 * @param yearMonth - 対象年月（'YYYY-MM'形式）
 * @returns 適用される標準報酬月額、または null
 */
export function getStandardRewardFromHistory(
  histories: StandardRewardHistory[],
  yearMonth: YearMonthString
): number | null {
  if (!histories || histories.length === 0) {
    return null;
  }

  // appliedFromYearMonth <= yearMonth を満たす履歴をフィルタ
  const applicableHistories = histories.filter(
    (h) => h.appliedFromYearMonth <= yearMonth
  );

  if (applicableHistories.length === 0) {
    return null;
  }

  // appliedFromYearMonth が最新のものを取得（降順ソートして最初の要素）
  const sortedHistories = [...applicableHistories].sort((a, b) => {
    if (a.appliedFromYearMonth > b.appliedFromYearMonth) return -1;
    if (a.appliedFromYearMonth < b.appliedFromYearMonth) return 1;
    return 0;
  });

  return sortedHistories[0].standardMonthlyReward;
}

/**
 * 資格取得日・喪失日ベースで、指定年月に該当保険種別の資格があるかを判定する。
 *
 * 基本ルール:
 * - 取得日が属する月から、その月分の保険料が発生する
 * - 喪失日が属する月の前月分まで保険料が発生する（喪失月は対象外）
 *
 * 重要:
 * - 資格取得日が未入力の場合、その保険種別は常に対象外
 * - hireDate / retireDate へのフォールバックは行わない
 */
export function hasInsuranceInMonth(
  employee: Employee,
  yearMonth: YearMonthString,
  insuranceKind: 'health' | 'pension'
): boolean {
  const acquisitionDate =
    insuranceKind === 'health' ? employee.healthQualificationDate : employee.pensionQualificationDate;
  const lossDate = insuranceKind === 'health' ? employee.healthLossDate : employee.pensionLossDate;

  if (!acquisitionDate) {
    return false;
  }

  const acquisitionYm = toYearMonthOrNull(acquisitionDate);
  const lossYm = toYearMonthOrNull(lossDate);

  if (acquisitionYm && yearMonth < acquisitionYm) {
    return false;
  }

  if (lossYm && yearMonth >= lossYm) {
    return false;
  }

  return true;
}

/**
 * 資格取得日・喪失日ベースで、指定年月に社会保険の資格があるかどうか判定する。
 *
 * - 健康保険／厚生年金それぞれの資格期間を判定し、どちらか一方でも資格期間内なら対象。
 * - 取得日が未入力の保険種別は常に対象外（hireDate / retireDate にはフォールバックしない）。
 * - 保険種別ごとの計算では必ず hasInsuranceInMonth(...) を使用すること。
 */
function hasSocialInsuranceInMonth(
  employee: Employee,
  yearMonth: YearMonthString
): boolean {
  const healthOk = hasInsuranceInMonth(employee, yearMonth, 'health');
  const pensionOk = hasInsuranceInMonth(employee, yearMonth, 'pension');
  // どちらかの社会保険で資格期間内なら、その月は「社会保険対象」とみなす
  return healthOk || pensionOk;
}

/**
 * 介護保険第2号被保険者かどうかを判定する。
 *
 * 協会けんぽの説明に合わせて、
 * - 満40歳に達した日の前日が属する月から
 * - 満65歳に達した日の前日が属する月の「前月」まで
 * を第2号被保険者（介護保険料徴収対象）とみなす。
 *
 * 実装では、40歳到達前日の年月を startYm、65歳到達前日の年月を lossYm とし、
 * 対象年月 ym が startYm <= ym < lossYm のとき true を返す。
 *
 * @param birthDate 'YYYY-MM-DD' 形式
 * @param yearMonth 'YYYY-MM' 形式
 */
export function isCareInsuranceTarget(
  birthDate: string,
  yearMonth: YearMonthString
): boolean {
  const ym = toYearMonthOrNull(`${yearMonth}-01`);
  if (!birthDate || !ym) return false;

  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return false;

  // 40歳到達前日が属する年月
  const dayBefore40 = new Date(birth);
  dayBefore40.setFullYear(dayBefore40.getFullYear() + 40);
  dayBefore40.setDate(dayBefore40.getDate() - 1);
  const startYm = toYearMonthOrNull(dayBefore40.toISOString().substring(0, 10));
  if (!startYm) return false;

  // 65歳到達前日が属する年月
  const dayBefore65 = new Date(birth);
  dayBefore65.setFullYear(dayBefore65.getFullYear() + 65);
  dayBefore65.setDate(dayBefore65.getDate() - 1);
  const lossYm = toYearMonthOrNull(dayBefore65.toISOString().substring(0, 10));
  if (!lossYm) return false;

  return startYm <= ym && ym < lossYm;
}

/**
 * 従業員一人分の当月保険料を計算する。
 *
 * 健保・厚年それぞれの標準報酬（月額）と等級を前提に計算する。
 * 片方のみ揃っている場合は揃っている保険種別のみ計算し、もう片方は 0 として扱う。
 *
 * 標準報酬は、履歴から取得を試み、履歴がない場合は従業員データの標準報酬を使用する。
 *
 * @param employee - 従業員情報
 * @param rateContext - 料率コンテキスト
 * @param standardRewardHistories - 標準報酬履歴の配列（オプション）。指定された場合、履歴から標準報酬を取得する
 */
export function calculateMonthlyPremiumForEmployee(
  employee: Employee,
  rateContext: PremiumRateContext,
  standardRewardHistories?: StandardRewardHistory[]
): MonthlyPremiumCalculationResult | null {
  // 1. 加入していないなら対象外
  if (employee.isInsured !== true) {
    return null;
  }

  // 1-2. 資格取得日／喪失日ベースで、その月に資格がなければ対象外
  if (!hasSocialInsuranceInMonth(employee, rateContext.yearMonth)) {
    return null;
  }

  // 保険種別ごとの加入判定
  const hasHealthInsurance = hasInsuranceInMonth(employee, rateContext.yearMonth, 'health');
  const hasPensionInsurance = hasInsuranceInMonth(employee, rateContext.yearMonth, 'pension');

  // 標準報酬を履歴から取得（履歴がない場合は計算不可）
  let healthStandardMonthly: number | null = null;
  let pensionStandardMonthly: number | null = null;
  
  if (standardRewardHistories && standardRewardHistories.length > 0) {
    // 健康保険の履歴から標準報酬を取得
    const healthHistories = standardRewardHistories.filter((h) => h.insuranceKind === 'health');
    const healthFromHistory = getStandardRewardFromHistory(healthHistories, rateContext.yearMonth);
    if (healthFromHistory != null) {
      healthStandardMonthly = healthFromHistory;
    }
    
    // 厚生年金の履歴から標準報酬を取得
    const pensionHistories = standardRewardHistories.filter((h) => h.insuranceKind === 'pension');
    const pensionFromHistory = getStandardRewardFromHistory(pensionHistories, rateContext.yearMonth);
    if (pensionFromHistory != null) {
      pensionStandardMonthly = pensionFromHistory;
    }
  }
  
  // 履歴から標準報酬が取得できない場合は計算不可
  // （健康保険または厚生年金のいずれかが加入している場合、その保険種別の履歴が必要）
  if (hasHealthInsurance && healthStandardMonthly == null) {
    return null; // 健康保険に加入しているが履歴がない場合は計算不可
  }
  if (hasPensionInsurance && pensionStandardMonthly == null) {
    return null; // 厚生年金に加入しているが履歴がない場合は計算不可
  }
  
  // どちらの保険にも加入していない場合は計算不可
  if (!hasHealthInsurance && !hasPensionInsurance) {
    return null;
  }
  
  // nullの場合は0として扱う（実際には上記のチェックでnullの場合はreturnされるため、ここには到達しない）
  const healthStandard = healthStandardMonthly ?? 0;
  const pensionStandard = pensionStandardMonthly ?? 0;

  // 2. 健康保険の計算可否を判定（履歴から取得した標準報酬を使用）
  const canCalcHealth =
    hasHealthInsurance &&
    healthStandard > 0 &&
    employee.healthGrade != null &&
    rateContext.healthRate != null;

  // 3. 厚生年金の計算可否を判定（履歴から取得した標準報酬を使用）
  const canCalcPension =
    hasPensionInsurance &&
    pensionStandard > 0 &&
    employee.pensionGrade != null &&
    rateContext.pensionRate != null;

  // 4. 両方不可ならスキップ
  if (!canCalcHealth && !canCalcPension) {
    return null;
  }

  // 5. 免除判定（premiumExemptionMonths）
  const exemptionMonth = employee.premiumExemptionMonths?.find(
    (ex) => ex.yearMonth === rateContext.yearMonth
  );
  const isExempt = exemptionMonth != null;

    // 健康保険 + 介護保険（合算率）
    const isCareTarget = isCareInsuranceTarget(employee.birthDate, rateContext.yearMonth);
    const hasCareRate = rateContext.careRate != null && rateContext.careRate > 0;
    const healthRate = rateContext.healthRate ?? 0;
    const careRate = hasCareRate && isCareTarget ? rateContext.careRate ?? 0 : 0;
    const healthTotalRate = healthRate + careRate;
  
    // ★ 介護保険「単体」の金額（参考値：データ品質チェック用など）
    const careFull =
      canCalcHealth && !isExempt ? healthStandard * careRate : 0;
    const careEmployee = roundForEmployeeDeduction(careFull / 2);
    const careEmployer = careFull - careEmployee;
  
    const healthCareFull =
      canCalcHealth && !isExempt ? healthStandard * healthTotalRate : 0;
    const healthCareEmployee = roundForEmployeeDeduction(healthCareFull / 2);
    const healthCareEmployer = healthCareFull - healthCareEmployee;
  

  // 厚生年金
  const pensionFull =
    canCalcPension && !isExempt ? pensionStandard * rateContext.pensionRate! : 0;
  const pensionEmployee = roundForEmployeeDeduction(pensionFull / 2);
  const pensionEmployer = pensionFull - pensionEmployee;

  // 行レベル参考値
  const totalFull = healthCareFull + pensionFull;
  const totalEmployee = healthCareEmployee + pensionEmployee;
  const totalEmployer = totalFull - totalEmployee;

  return {
    employeeId: employee.id,
    officeId: employee.officeId,
    yearMonth: rateContext.yearMonth,
    healthGrade: canCalcHealth ? employee.healthGrade! : 0,
    healthStandardMonthly: canCalcHealth ? healthStandard : 0,
    pensionGrade: canCalcPension ? employee.pensionGrade! : 0,
    pensionStandardMonthly: canCalcPension ? pensionStandard : 0,
    amounts: {
      healthCareFull,
      healthCareEmployee,
      healthCareEmployer,
      pensionFull,
      pensionEmployee,
      pensionEmployer,
      totalFull,
      totalEmployee,
      totalEmployer,
      // deprecated fields（後方互換）
      // healthTotal* は「健保＋介護の合算値」として従来どおり維持
      healthTotal: healthCareFull,
      healthEmployee: healthCareEmployee,
      healthEmployer: healthCareEmployer,
      // care* は「介護保険分のみ」の参考値
      careTotal: careFull,
      careEmployee,
      careEmployer,
      pensionTotal: pensionFull
    }

  };
}
