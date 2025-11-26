import {
  DependentRelationship,
  InsuranceLossReasonKind,
  InsuranceQualificationKind,
  PremiumTreatment,
  StandardRewardDecisionKind,
  WorkingStatus
} from '../types';

export function getInsuranceQualificationKindLabel(kind?: InsuranceQualificationKind): string {
  switch (kind) {
    case 'new_hire':
      return '新規採用';
    case 'expansion':
      return '適用拡大';
    case 'hours_change':
      return '所定労働時間変更';
    case 'other':
      return 'その他';
    default:
      return '-';
  }
}

export function getInsuranceLossReasonKindLabel(kind?: InsuranceLossReasonKind): string {
  switch (kind) {
    case 'retirement':
      return '退職';
    case 'hours_decrease':
      return '所定労働時間減少';
    case 'death':
      return '死亡';
    case 'other':
      return 'その他';
    default:
      return '-';
  }
}

export function getWorkingStatusLabel(status?: WorkingStatus): string {
  switch (status) {
    case 'normal':
      return '通常勤務';
    case 'maternity_leave':
      return '産前産後休業';
    case 'childcare_leave':
      return '育児休業';
    case 'sick_leave':
      return '傷病休職';
    case 'other':
      return 'その他';
    default:
      return '-';
  }
}

export function getPremiumTreatmentLabel(treatment?: PremiumTreatment): string {
  switch (treatment) {
    case 'normal':
      return '通常徴収';
    case 'exempt':
      return '保険料免除';
    default:
      return '-';
  }
}

export function getDependentRelationshipLabel(
  relationship?: DependentRelationship
): string {
  switch (relationship) {
    case 'spouse':
      return '配偶者';
    case 'child':
      return '子';
    case 'parent':
      return '父母';
    case 'grandparent':
      return '祖父母';
    case 'sibling':
      return '兄弟姉妹';
    case 'other':
      return 'その他';
    default:
      return '-';
  }
}

export function getStandardRewardDecisionKindLabel(
  decisionKind?: StandardRewardDecisionKind
): string {
  switch (decisionKind) {
    case 'regular':
      return '定時決定';
    case 'interim':
      return '随時改定';
    case 'bonus':
      return '賞与支払時';
    case 'qualification':
      return '資格取得時';
    case 'loss':
      return '資格喪失時';
    case 'other':
      return 'その他';
    default:
      return '-';
  }
}
