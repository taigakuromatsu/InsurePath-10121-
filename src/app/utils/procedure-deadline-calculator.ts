import { ProcedureType } from '../types';
import { dateToYmdLocal, ymdToDateLocal } from './date-helpers';

/**
 * 事由発生日から法定提出期限の目安を計算する
 * 
 * 計算ルール:
 * - 資格取得・喪失・被扶養者異動・賞与支払：事由日＋5日（目安）
 * - 算定基礎：対象年の7月10日
 * - 月額変更：事由月の翌月10日（簡易ルール）
 * 
 * 注意: これは代表的なルールに基づく目安であり、最終的な提出要否・期限判断は事業所側の責任とする。
 * 実際の法定期限・要否は各健保・年金事務所の案内に従うべきこと。
 *
 * @param procedureType 手続き種別
 * @param incidentDate 事由発生日（YYYY-MM-DD形式のstring）
 * @returns 提出期限（YYYY-MM-DD形式のstring）
 */
export function calculateDeadline(procedureType: ProcedureType, incidentDate: string): string {
  const incident = ymdToDateLocal(incidentDate);
  let deadline: Date;

  switch (procedureType) {
    case 'qualification_acquisition':
    case 'qualification_loss':
    case 'dependent_change':
    case 'bonus_payment': {
      // 事由日＋5日
      deadline = new Date(incident);
      deadline.setDate(deadline.getDate() + 5);
      break;
    }
    case 'standard_reward': {
      // 対象年の7月10日
      deadline = new Date(incident.getFullYear(), 6, 10);
      break;
    }
    case 'monthly_change': {
      // 事由月の翌月10日
      deadline = new Date(incident.getFullYear(), incident.getMonth() + 1, 10);
      break;
    }
    default: {
      // デフォルト：事由月の翌月10日
      deadline = new Date(incident.getFullYear(), incident.getMonth() + 1, 10);
      break;
    }
  }

  return dateToYmdLocal(deadline);
}
