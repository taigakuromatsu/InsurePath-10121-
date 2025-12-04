import {
  ChangeRequestKind,
  ChangeRequestStatus,
  DependentRelationship,
  EmploymentType,
  InsuranceLossReasonKind,
  InsuranceQualificationKind,
  IsoDateString,
  MyNumber,
  PremiumTreatment,
  Sex,
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

export function getChangeRequestKindLabel(kind?: ChangeRequestKind): string {
  switch (kind) {
    case 'dependent_add':
      return '扶養家族追加';
    case 'dependent_update':
      return '扶養家族変更';
    case 'dependent_remove':
      return '扶養家族削除';
    case 'profile':
    default:
      return 'プロフィール変更';
  }
}

export function getChangeRequestStatusLabel(status?: ChangeRequestStatus): string {
  switch (status) {
    case 'pending':
      return '承認待ち';
    case 'approved':
      return '承認済み';
    case 'rejected':
      return '却下済み';
    case 'canceled':
      return '取り下げ';
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

export function getEmploymentTypeLabel(type?: EmploymentType): string {
  switch (type) {
    case 'regular':
      return '正社員';
    case 'contract':
      return '契約社員';
    case 'part':
      return 'パート';
    case 'アルバイト':
      return 'アルバイト';
    case 'other':
      return 'その他';
    default:
      return '未設定';
  }
}

export function getSexLabel(sex?: Sex): string {
  switch (sex) {
    case 'male':
      return '男性';
    case 'female':
      return '女性';
    case 'other':
      return 'その他';
    default:
      return '未設定';
  }
}

export function calculateAge(birthDate?: IsoDateString | null): number | null {
  if (!birthDate) {
    return null;
  }
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function maskMyNumber(myNumber?: MyNumber): string | null {
  if (!myNumber) {
    return null;
  }
  const cleaned = myNumber.replace(/[-\s]/g, '');
  if (cleaned.length < 4) {
    return null;
  }
  const last4 = cleaned.slice(-4);
  return `***-****-${last4}（登録済）`;
}
