import { firstValueFrom } from 'rxjs';

import { MastersService } from '../services/masters.service';
import { Office, YearMonthString } from '../types';
import {
  resolveHealthStandardFromSalary,
  resolvePensionStandardFromSalary
} from './standard-reward-resolver';

export interface StandardRewardCalculationResult {
  healthGrade: number | null;
  healthStandardMonthly: number | null;
  pensionGrade: number | null;
  pensionStandardMonthly: number | null;
  errors: {
    health?: string;
    pension?: string;
  };
}

/**
 * 報酬月額と決定年月から標準報酬を自動計算する共通ヘルパー
 */
export async function calculateStandardRewardsFromSalary(
  office: Office,
  salary: number,
  decisionYearMonth: YearMonthString,
  mastersService: MastersService
): Promise<StandardRewardCalculationResult> {
  const result: StandardRewardCalculationResult = {
    healthGrade: null,
    healthStandardMonthly: null,
    pensionGrade: null,
    pensionStandardMonthly: null,
    errors: {}
  };

  if (!salary || salary <= 0 || !decisionYearMonth) {
    return result;
  }

  // マスタ取得（Observable返却に合わせ firstValueFrom を使用）
  const healthTable = await firstValueFrom(
    mastersService.getHealthRateTableForYearMonth(office, decisionYearMonth)
  );
  const pensionTable = await firstValueFrom(
    mastersService.getPensionRateTableForYearMonth(office, decisionYearMonth)
  );

  // 健康保険
  const healthResolved = resolveHealthStandardFromSalary(salary, healthTable);
  if (healthResolved) {
    result.healthGrade = healthResolved.grade;
    result.healthStandardMonthly = healthResolved.standardMonthly;
  } else {
    if (!healthTable) {
      result.errors.health = `対象年月（${decisionYearMonth}）の健康保険マスタが設定されていません。`;
    } else if (!healthTable.bands || healthTable.bands.length === 0) {
      result.errors.health = `対象年月（${decisionYearMonth}）の健康保険等級表が設定されていません。`;
    } else {
      result.errors.health = `報酬月額（${salary.toLocaleString()}円）が健康保険等級表の範囲外です。`;
    }
  }

  // 厚生年金
  const pensionResolved = resolvePensionStandardFromSalary(salary, pensionTable);
  if (pensionResolved) {
    result.pensionGrade = pensionResolved.grade;
    result.pensionStandardMonthly = pensionResolved.standardMonthly;
  } else {
    if (!pensionTable) {
      result.errors.pension = `対象年月（${decisionYearMonth}）の厚生年金マスタが設定されていません。`;
    } else if (!pensionTable.bands || pensionTable.bands.length === 0) {
      result.errors.pension = `対象年月（${decisionYearMonth}）の厚生年金等級表が設定されていません。`;
    } else {
      result.errors.pension = `報酬月額（${salary.toLocaleString()}円）が厚生年金等級表の範囲外です。`;
    }
  }

  return result;
}

