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
  healthTotal: number;
  healthEmployee: number;
  healthEmployer: number;

  careTotal: number;
  careEmployee: number;
  careEmployer: number;

  pensionTotal: number;
  pensionEmployee: number;
  pensionEmployer: number;

  totalEmployee: number;
  totalEmployer: number;
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
 * 資格取得日・喪失日ベースで、指定年月に社会保険の資格があるかどうか判定する。
 *
 * - 健康保険／厚生年金それぞれの資格期間を見て、
 *   「どちらか一方でも資格期間内なら対象」とみなす。
 * - 資格日が未入力のときは hireDate / retireDate をフォールバックとして利用する。
 */
function hasSocialInsuranceInMonth(
  employee: Employee,
  yearMonth: YearMonthString
): boolean {
  const ym = yearMonth;

  // 健康保険の資格期間（なければ雇用日・退職日で代用）
  const healthStart = toYearMonthOrNull(
    employee.healthQualificationDate || employee.hireDate
  );
  const healthEnd = toYearMonthOrNull(
    employee.healthLossDate || employee.retireDate
  );

  // 厚生年金の資格期間（なければ雇用日・退職日で代用）
  const pensionStart = toYearMonthOrNull(
    employee.pensionQualificationDate || employee.hireDate
  );
  const pensionEnd = toYearMonthOrNull(
    employee.pensionLossDate || employee.retireDate
  );

  const inRange = (start: YearMonthString | null, end: YearMonthString | null): boolean => {
    if (start && ym < start) return false;
    if (end && ym > end) return false;
    return true;
  };

  const healthOk = inRange(healthStart, healthEnd);
  const pensionOk = inRange(pensionStart, pensionEnd);

  // どちらかの社会保険で資格期間内なら、その月は「社会保険対象」とみなす
  return healthOk || pensionOk;
}

/**
 * 介護保険の対象判定（40〜64歳）
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
 * ★重要な前提：
 * - employee.monthlyWage を「健保・厚年 共通の標準報酬月額」として扱う。
 *
 * 計算不可となる例：
 * 1. employee.isInsured !== true（社会保険未加入）
 * 2. employee.monthlyWage が未設定 or 0 以下
 * 3. employee.healthGrade / pensionGrade が未設定
 * 4. rateContext.healthRate / pensionRate が未設定
 *
 * 備考：
 * - premiumTreatment === 'exempt' の場合は金額を 0 にする（標準報酬はスナップショットとして保持）
 * - careRate が未設定でも、健保・厚年が計算可能なら結果を返す（careTotal = 0）
 */
export function calculateMonthlyPremiumForEmployee(
  employee: Employee,
  rateContext: PremiumRateContext
): MonthlyPremiumCalculationResult | null {
  // 1. 加入していないなら対象外
  if (employee.isInsured !== true) {
    return null;
  }

  // 1-2. 資格取得日／喪失日ベースで、その月に資格がなければ対象外
  if (!hasSocialInsuranceInMonth(employee, rateContext.yearMonth)) {
    return null;
  }

  // 2. 標準報酬月額（＝ monthlyWage）が必要
  const standardMonthly = employee.monthlyWage;
  if (!standardMonthly || standardMonthly <= 0) {
    return null;
  }

  // 3. 等級が未設定なら対象外
  if (employee.healthGrade == null || employee.pensionGrade == null) {
    return null;
  }

  // 4. 料率（健保・厚年）は必須
  if (rateContext.healthRate == null || rateContext.pensionRate == null) {
    return null;
  }

  const isExempt = employee.premiumTreatment === 'exempt';

  // 健康保険
  const healthTotal = isExempt ? 0 : standardMonthly * rateContext.healthRate;

  // 厚生年金
  const pensionTotal = isExempt ? 0 : standardMonthly * rateContext.pensionRate;

  // 介護保険（40〜64歳かつ料率あり、かつ免除でない場合のみ）
  const isCareTarget = isCareInsuranceTarget(employee.birthDate, rateContext.yearMonth);
  const hasCareRate = rateContext.careRate != null && rateContext.careRate > 0;

  const careTotal =
    isExempt || !isCareTarget || !hasCareRate
      ? 0
      : standardMonthly * rateContext.careRate!;

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
    healthStandardMonthly: standardMonthly,
    pensionGrade: employee.pensionGrade!,
    pensionStandardMonthly: standardMonthly,
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
      totalEmployer
    }
  };
}
