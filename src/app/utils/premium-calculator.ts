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
 * 健保・厚年それぞれの標準報酬（月額）と等級を前提に計算する。
 * 片方のみ揃っている場合は揃っている保険種別のみ計算し、もう片方は 0 として扱う。
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

  // 2. 健康保険の計算可否を判定
  const canCalcHealth =
    employee.healthStandardMonthly != null &&
    employee.healthStandardMonthly > 0 &&
    employee.healthGrade != null &&
    rateContext.healthRate != null;

  // 3. 厚生年金の計算可否を判定
  const canCalcPension =
    employee.pensionStandardMonthly != null &&
    employee.pensionStandardMonthly > 0 &&
    employee.pensionGrade != null &&
    rateContext.pensionRate != null;

  // 4. 両方不可ならスキップ
  if (!canCalcHealth && !canCalcPension) {
    return null;
  }

  const isExempt = employee.premiumTreatment === 'exempt';
  const healthStandardMonthly = employee.healthStandardMonthly ?? 0;
  const pensionStandardMonthly = employee.pensionStandardMonthly ?? 0;

  // 健康保険
  const healthTotal =
    canCalcHealth && !isExempt ? healthStandardMonthly * rateContext.healthRate! : 0;

  // 厚生年金
  const pensionTotal =
    canCalcPension && !isExempt ? pensionStandardMonthly * rateContext.pensionRate! : 0;

  // 介護保険（40〜64歳かつ料率あり、かつ免除でない場合のみ）
  const isCareTarget = isCareInsuranceTarget(employee.birthDate, rateContext.yearMonth);
  const hasCareRate = rateContext.careRate != null && rateContext.careRate > 0;

  const careTotal =
    !canCalcHealth || isExempt || !isCareTarget || !hasCareRate
      ? 0
      : healthStandardMonthly * rateContext.careRate!;

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
    healthGrade: canCalcHealth ? employee.healthGrade! : 0,
    healthStandardMonthly: canCalcHealth ? healthStandardMonthly : 0,
    pensionGrade: canCalcPension ? employee.pensionGrade! : 0,
    pensionStandardMonthly: canCalcPension ? pensionStandardMonthly : 0,
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
