import { ProcedureType } from '../types';

/**
 * 事由発生日から法定提出期限の目安を計算する
 * 注意: これは代表的なルールに基づく目安であり、最終的な提出要否・期限判断は事業所側の責任とする
 *
 * @param procedureType 手続き種別
 * @param incidentDate 事由発生日（YYYY-MM-DD形式のstring）
 * @returns 提出期限（YYYY-MM-DD形式のstring）
 */
export function calculateDeadline(procedureType: ProcedureType, incidentDate: string): string {
  const incident = new Date(incidentDate);
  let deadline: Date;

  switch (procedureType) {
    case 'qualification_acquisition':
    case 'qualification_loss':
      deadline = new Date(incident.getFullYear(), incident.getMonth() + 1, 10);
      break;
    case 'standard_reward':
      deadline = new Date(incident.getFullYear(), 6, 10);
      break;
    case 'monthly_change':
    case 'dependent_change':
    case 'bonus_payment':
      deadline = new Date(incident.getFullYear(), incident.getMonth() + 1, 10);
      break;
    default:
      deadline = new Date(incident.getFullYear(), incident.getMonth() + 1, 10);
  }

  return deadline.toISOString().substring(0, 10);
}
