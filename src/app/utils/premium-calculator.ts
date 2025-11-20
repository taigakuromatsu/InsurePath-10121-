import { Employee, IsoDateString, YearMonthString } from '../types';

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
  yearMonth: YearMonthString; // 必須
  calcDate: IsoDateString; // 必須（計算実行日）

  // 以下のいずれかは必須（計算対象の保険によって異なる）
  healthRate?: number; // 健康保険計算時は必須
  careRate?: number; // 介護保険計算時は必須（対象者のみ使用）
  pensionRate?: number; // 厚生年金計算時は必須
}

/**
 * 月次保険料の金額（各保険の本人負担・事業主負担）
 */
export interface MonthlyPremiumAmounts {
  // health
  healthTotal: number;
  healthEmployee: number;
  healthEmployer: number;

  // care（対象外なら 0）
  careTotal: number;
  careEmployee: number;
  careEmployer: number;

  // pension
  pensionTotal: number;
  pensionEmployee: number;
  pensionEmployer: number;

  // 合計
  totalEmployee: number;
  totalEmployer: number;
}

/**
 * 月次保険料計算結果
 *
 * この結果は、後続フェーズ（P1-4）で MonthlyPremium ドキュメントを作成する際に使用される。
 */
export interface MonthlyPremiumCalculationResult {
  // 計算対象の従業員 ID など
  employeeId: string;
  officeId: string;
  yearMonth: YearMonthString;

  // 等級・標準報酬のスナップショット
  healthGrade: number;
  healthStandardMonthly: number;
  pensionGrade: number;
  pensionStandardMonthly: number;

  // 金額
  amounts: MonthlyPremiumAmounts;
}

/**
 * 10円未満を切り捨てる（社会保険料の端数処理）
 *
 * 例:
 * - 1234 → 1230
 * - 1239 → 1230
 * - 1240 → 1240
 * - 1245 → 1240
 */
function roundTo10Yen(value: number): number {
  return Math.floor(value / 10) * 10;
}

/**
 * 介護保険の対象判定（40〜64歳）
 *
 * 対象年月の1日時点で満年齢を計算し、40歳以上64歳以下なら対象。
 *
 * 境界値の扱い:
 * - 40歳の誕生日当日から対象（40歳0ヶ月）
 * - 65歳の誕生日前日まで対象（64歳11ヶ月）
 *
 * @param birthDate - 生年月日（YYYY-MM-DD形式）
 * @param yearMonth - 対象年月（YYYY-MM形式）
 * @returns 介護保険第2号被保険者に該当する場合 true
 */
function isCareInsuranceTarget(
  birthDate: string,
  yearMonth: YearMonthString
): boolean {
  const [year, month] = yearMonth.split('-');
  const targetDate = new Date(`${year}-${month}-01`);
  const birth = new Date(birthDate);

  let age = targetDate.getFullYear() - birth.getFullYear();
  const monthDiff = targetDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && targetDate.getDate() < birth.getDate())) {
    age--;
  }

  return age >= 40 && age <= 64;
}

/**
 * 従業員一人分の当月保険料を計算する。
 *
 * 計算不可となるケース:
 * 1. employee.isInsured !== true（社会保険未加入）
 * 2. employee.healthStandardMonthly が未設定（健康保険の標準報酬なし）
 * 3. employee.pensionStandardMonthly が未設定（厚生年金の標準報酬なし）
 * 4. rateContext.healthRate が未設定（健康保険料率なし）
 * 5. rateContext.pensionRate が未設定（厚生年金保険料率なし）
 *
 * 注意:
 * - premiumTreatment === 'exempt' の場合は、金額を0として計算結果を返す
 * - careRate が未設定でも、健康保険・厚生年金が計算可能なら結果を返す（careTotal = 0）
 */
export function calculateMonthlyPremiumForEmployee(
  employee: Employee,
  rateContext: PremiumRateContext
): MonthlyPremiumCalculationResult | null {
  if (employee.isInsured !== true) {
    return null;
  }

  if (!employee.healthStandardMonthly || !employee.pensionStandardMonthly) {
    return null;
  }

  if (!rateContext.healthRate || !rateContext.pensionRate) {
    return null;
  }

  const isExempt = employee.premiumTreatment === 'exempt';

  const healthTotal = isExempt
    ? 0
    : roundTo10Yen(employee.healthStandardMonthly * rateContext.healthRate);

  const pensionTotal = isExempt
    ? 0
    : roundTo10Yen(employee.pensionStandardMonthly * rateContext.pensionRate);

  const isCareTarget = isCareInsuranceTarget(employee.birthDate, rateContext.yearMonth);
  const careTotal = isExempt || !isCareTarget || !rateContext.careRate
    ? 0
    : roundTo10Yen(employee.healthStandardMonthly * rateContext.careRate);

  const healthEmployee = Math.floor(healthTotal / 2);
  const healthEmployer = healthTotal - healthEmployee;

  const pensionEmployee = Math.floor(pensionTotal / 2);
  const pensionEmployer = pensionTotal - pensionEmployee;

  const careEmployee = Math.floor(careTotal / 2);
  const careEmployer = careTotal - careEmployee;

  const totalEmployee = healthEmployee + careEmployee + pensionEmployee;
  const totalEmployer = healthEmployer + careEmployer + pensionEmployer;

  return {
    employeeId: employee.id,
    officeId: employee.officeId,
    yearMonth: rateContext.yearMonth,
    healthGrade: employee.healthGrade!,
    healthStandardMonthly: employee.healthStandardMonthly,
    pensionGrade: employee.pensionGrade!,
    pensionStandardMonthly: employee.pensionStandardMonthly,
    amounts: {
      healthTotal,
      healthEmployee,
      healthEmployer,
      careTotal,
      careEmployee,
      careEmployer,
      pensionTotal,
      pensionEmployee,
      pensionEmployer,
      totalEmployee,
      totalEmployer,
    },
  };
}
