import { Employee, IsoDateString, YearMonthString } from '../types';
import { isCareInsuranceTarget, roundForEmployeeDeduction, hasInsuranceInMonth } from './premium-calculator';

/**
 * 日付から年度（4月1日基準）を取得
 * 例: 2025-06-15 → 2025年度、2025-03-31 → 2024年度
 */
export function getFiscalYear(date: IsoDateString): number {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1 - 12
  return month >= 4 ? year : year - 1;
}

/**
 * 標準賞与額を計算（1,000円未満切り捨て）
 */
export function calculateStandardBonusAmount(bonusAmount: number): number {
  return Math.floor(bonusAmount / 1000) * 1000;
}

/**
 * 健康保険の上限チェック（同一年度の累計573万円）
 */
export function checkHealthInsuranceLimit(
  standardBonusAmount: number,
  cumulativeAmount: number
): {
  withinLimit: boolean;
  effectiveAmount: number; // 上限適用後の有効な標準賞与額
  exceededAmount: number; // 上限超過額
} {
  const limit = 5730000; // 573万円
  const newCumulative = cumulativeAmount + standardBonusAmount;

  if (newCumulative <= limit) {
    return {
      withinLimit: true,
      effectiveAmount: standardBonusAmount,
      exceededAmount: 0
    };
  }

  const exceeded = newCumulative - limit;
  const effective = standardBonusAmount - exceeded;

  return {
    withinLimit: false,
    effectiveAmount: Math.max(0, effective),
    exceededAmount: exceeded
  };
}

/**
 * 厚生年金の上限チェック（1回の賞与150万円）
 */
export function checkPensionLimit(
  standardBonusAmount: number
): {
  withinLimit: boolean;
  effectiveAmount: number;
  exceededAmount: number;
} {
  const limit = 1500000; // 150万円

  if (standardBonusAmount <= limit) {
    return {
      withinLimit: true,
      effectiveAmount: standardBonusAmount,
      exceededAmount: 0
    };
  }

  return {
    withinLimit: false,
    effectiveAmount: limit,
    exceededAmount: standardBonusAmount - limit
  };
}

export interface BonusPremiumCalculationResult {
  employeeId: string;
  officeId: string;
  payDate: IsoDateString;
  fiscalYear: string;
  grossAmount: number;
  standardBonusAmount: number;
  healthStandardBonusCumulative: number;
  healthEffectiveAmount: number;
  healthExceededAmount: number;
  pensionEffectiveAmount: number;
  pensionExceededAmount: number;
  // 新規追加フィールド（UI表示用の補助値）
  healthCareFull: number; // 健康保険＋介護保険の全額（端数処理前）
  healthCareEmployee: number; // 健康保険＋介護保険の従業員負担額（50銭ルール適用後）
  healthCareEmployer: number; // 健康保険＋介護保険の会社負担額（参考値）
  pensionFull: number; // 厚生年金の全額（端数処理前）
  totalFull: number; // 行レベル参考値（healthCareFull + pensionFull）
  // 既存フィールドを新ロジックの結果で上書き保存（月次と同じ意味）
  healthTotal: number; // 健康保険＋介護保険の全額（月次と同じ意味）
  healthEmployee: number; // 健康保険＋介護保険の従業員負担額
  healthEmployer: number; // 健康保険＋介護保険の会社負担額
  pensionTotal: number; // 厚生年金の全額
  pensionEmployee: number; // 厚生年金の従業員負担額
  pensionEmployer: number; // 厚生年金の会社負担額
  totalEmployee: number; // 従業員負担合計（健康＋厚年）
  totalEmployer: number; // 会社負担合計（健康＋厚年）
}

/**
 * 賞与保険料を計算する（月次保険料と同じロジックを適用）
 *
 * @param officeId 対象事業所ID
 * @param employee 従業員情報
 * @param grossAmount 賞与支給額（税引前）
 * @param payDate 支給日
 * @param healthStandardBonusCumulative 健保の年度内累計（既存分）
 * @param healthRate 健康保険料率（事業主＋被保険者合計）
 * @param careRate 介護保険料率（事業主＋被保険者合計、オプション）
 * @param pensionRate 厚生年金保険料率（事業主＋被保険者合計）
 * @returns 計算結果、または計算不可の場合は null
 */
export function calculateBonusPremium(
  officeId: string,
  employee: Employee,
  grossAmount: number,
  payDate: IsoDateString,
  healthStandardBonusCumulative: number,
  healthRate: number,
  careRate: number | null | undefined,
  pensionRate: number
): BonusPremiumCalculationResult | null {
  // 加入していない / 0 円 はスキップ
  if (!employee.isInsured || grossAmount <= 0) {
    return null;
  }

  // 標準賞与額（千円未満切り捨て）
  const standardBonusAmount = calculateStandardBonusAmount(grossAmount);

  if (standardBonusAmount <= 0) {
    return null;
  }

  const fiscalYear = String(getFiscalYear(payDate));
  const yearMonth = payDate.substring(0, 7) as YearMonthString;

  // 資格取得日・喪失日ベースの資格判定
  const hasHealth = hasInsuranceInMonth(employee, yearMonth, 'health');
  const hasPension = hasInsuranceInMonth(employee, yearMonth, 'pension');
  if (!hasHealth && !hasPension) {
    return null;
  }

  // 上限チェック
  const healthCheck = checkHealthInsuranceLimit(
    standardBonusAmount,
    healthStandardBonusCumulative
  );

  const pensionCheck = checkPensionLimit(standardBonusAmount);

  // 健康保険＋介護保険の計算
  const isCareTarget = isCareInsuranceTarget(employee.birthDate, yearMonth);
  const hasCareRate = careRate != null && careRate > 0;
  const effectiveCareRate = hasCareRate && isCareTarget ? careRate : 0;
  const combinedRate = healthRate + effectiveCareRate;

  // 全額計算（端数処理前）
  const healthCareFull = healthCheck.effectiveAmount * combinedRate;

  // 従業員負担（50銭ルール適用）
  const healthCareEmployee = roundForEmployeeDeduction(healthCareFull / 2);

  // 会社負担（参考値）
  const healthCareEmployer = healthCareFull - healthCareEmployee;

  // 厚生年金の計算
  // 全額計算（端数処理前）
  const pensionFull = pensionCheck.effectiveAmount * pensionRate;

  // 従業員負担（50銭ルール適用）
  const pensionEmployee = roundForEmployeeDeduction(pensionFull / 2);

  // 会社負担（参考値）
  const pensionEmployer = pensionFull - pensionEmployee;

  // 行レベル参考値
  const totalFull = healthCareFull + pensionFull;
  const totalEmployee = healthCareEmployee + pensionEmployee;
  const totalEmployer = healthCareEmployer + pensionEmployer;

  return {
    employeeId: employee.id,
    officeId,
    payDate,
    fiscalYear,
    grossAmount,
    standardBonusAmount,
    healthStandardBonusCumulative:
      healthStandardBonusCumulative + healthCheck.effectiveAmount,
    healthEffectiveAmount: healthCheck.effectiveAmount,
    healthExceededAmount: healthCheck.exceededAmount,
    pensionEffectiveAmount: pensionCheck.effectiveAmount,
    pensionExceededAmount: pensionCheck.exceededAmount,
    // 新規追加フィールド（UI表示用の補助値）
    healthCareFull,
    healthCareEmployee,
    healthCareEmployer,
    pensionFull,
    totalFull,
    // 既存フィールドを新ロジックの結果で上書き（月次と同じ意味）
    healthTotal: healthCareFull,
    healthEmployee: healthCareEmployee,
    healthEmployer: healthCareEmployer,
    pensionTotal: pensionFull,
    pensionEmployee,
    pensionEmployer,
    totalEmployee,
    totalEmployer
  };
}
