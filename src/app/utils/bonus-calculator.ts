import { Employee, IsoDateString } from '../types';

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
  healthTotal: number;
  healthEmployee: number;
  healthEmployer: number;
  pensionTotal: number;
  pensionEmployee: number;
  pensionEmployer: number;
  totalEmployee: number;
  totalEmployer: number;
}

/**
 * 賞与保険料を計算する
 *
 * @param officeId 対象事業所ID
 * @param employee 従業員情報
 * @param grossAmount 賞与支給額（税引前）
 * @param payDate 支給日
 * @param healthStandardBonusCumulative 健保の年度内累計（既存分）
 * @param healthRate 健康保険料率（合計）
 * @param pensionRate 厚生年金保険料率（合計）
 * @returns 計算結果、または計算不可の場合は null
 */
export function calculateBonusPremium(
  officeId: string,
  employee: Employee,
  grossAmount: number,
  payDate: IsoDateString,
  healthStandardBonusCumulative: number,
  healthRate: number,
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

  // 上限チェック
  const healthCheck = checkHealthInsuranceLimit(
    standardBonusAmount,
    healthStandardBonusCumulative
  );

  const pensionCheck = checkPensionLimit(standardBonusAmount);

  // 健康保険料（1円未満切り捨て）
  const healthTotal = Math.floor(healthCheck.effectiveAmount * healthRate);
  const healthEmployee = Math.floor(healthTotal / 2);
  const healthEmployer = healthTotal - healthEmployee;

  // 厚生年金保険料
  const pensionTotal = Math.floor(pensionCheck.effectiveAmount * pensionRate);
  const pensionEmployee = Math.floor(pensionTotal / 2);
  const pensionEmployer = pensionTotal - pensionEmployee;

  const totalEmployee = healthEmployee + pensionEmployee;
  const totalEmployer = healthEmployer + pensionEmployer;

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
    healthTotal,
    healthEmployee,
    healthEmployer,
    pensionTotal,
    pensionEmployee,
    pensionEmployer,
    totalEmployee,
    totalEmployer
  };
}
