import { HealthRateTable, PensionRateTable, StandardRewardBand } from '../types';

function resolveFromBands(
  salary: number,
  bands: StandardRewardBand[] | undefined | null
): { grade: number; standardMonthly: number } | null {
  if (salary <= 0) {
    return null;
  }

  if (!bands || bands.length === 0) {
    return null;
  }

  const sorted = [...bands].sort((a, b) => a.grade - b.grade);

  for (const band of sorted) {
    // Infinityや大きな値（999999999以上）の場合は上限なしとして扱う
    const isUnlimited = band.upperLimit === Infinity || band.upperLimit >= 999999999;
    if (band.lowerLimit <= salary && (isUnlimited || salary <= band.upperLimit)) {
      return { grade: band.grade, standardMonthly: band.standardMonthly };
    }
  }

  const maxBand = sorted[sorted.length - 1];
  const isMaxUnlimited = maxBand.upperLimit === Infinity || maxBand.upperLimit >= 999999999;
  if (!isMaxUnlimited && salary > maxBand.upperLimit) {
    return { grade: maxBand.grade, standardMonthly: maxBand.standardMonthly };
  }

  // 下限未満は異常値として扱う
  return null;
}

/**
 * 報酬月額から健康保険の標準報酬等級・標準報酬月額を決定する
 */
export function resolveHealthStandardFromSalary(
  salary: number,
  healthTable: HealthRateTable | null | undefined
): { grade: number; standardMonthly: number } | null {
  return resolveFromBands(salary, healthTable?.bands);
}

/**
 * 報酬月額から厚生年金の標準報酬等級・標準報酬月額を決定する
 */
export function resolvePensionStandardFromSalary(
  salary: number,
  pensionTable: PensionRateTable | null | undefined
): { grade: number; standardMonthly: number } | null {
  return resolveFromBands(salary, pensionTable?.bands);
}

