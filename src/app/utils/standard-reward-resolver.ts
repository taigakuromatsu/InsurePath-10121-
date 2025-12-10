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
    if (band.lowerLimit <= salary && salary <= band.upperLimit) {
      return { grade: band.grade, standardMonthly: band.standardMonthly };
    }
  }

  const maxBand = sorted[sorted.length - 1];
  if (salary > maxBand.upperLimit) {
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

