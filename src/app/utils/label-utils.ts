import { ThemePalette } from '@angular/material/core';
import {
  ChangeRequestKind,
  ChangeRequestStatus,
  DependentRelationship,
  DocumentCategory,
  DocumentRequestStatus,
  BankAccountType,
  PayrollPayType,
  PayrollPayCycle,
  EmploymentType,
  InsuranceLossReasonKind,
  InsuranceQualificationKind,
  IsoDateString,
  MyNumber,
  Sex,
  StandardRewardDecisionKind,
  WorkingStatus,
  PortalStatus,
  ExemptionKind
} from '../types';
import { ymdToDateLocal } from './date-helpers';

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
    case 'death':
      return '死亡';
    case 'age_75':
      return '75歳到達';
    case 'disability':
      return '障害認定';
    case 'social_security_agreement':
      return '社会保障協定';
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
    default:
      return '-';
  }
}

export function getPortalStatusLabel(status?: PortalStatus | null): string {
  switch (status) {
    case 'not_invited':
      return '未招待';
    case 'invited':
      return '招待済';
    case 'linked':
      return '連携済';
    case 'disabled':
      return '停止中';
    default:
      return '未招待';
  }
}

export function getPortalStatusColor(
  status?: PortalStatus | null
): ThemePalette {
  switch (status) {
    case 'not_invited':
      return undefined;
    case 'invited':
      return 'primary';
    case 'linked':
      return 'accent';
    case 'disabled':
      return 'warn';
    default:
      return undefined;
  }
}

export function getExemptionKindLabel(kind?: ExemptionKind): string {
  switch (kind) {
    case 'maternity':
      return '産前産後休業';
    case 'childcare':
      return '育児休業';
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
    case 'bankAccount':
      return '口座情報変更';
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
  const birth = ymdToDateLocal(birthDate);
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

export function getDocumentCategoryLabel(category?: DocumentCategory): string {
  switch (category) {
    case 'identity':
      return '本人確認書類';
    case 'residence':
      return '住所・居住関係';
    case 'incomeProof':
      return '収入証明';
    case 'studentProof':
      return '在学証明';
    case 'relationshipProof':
      return '続柄・同居証明';
    case 'otherInsurance':
      return '他健康保険・年金加入証明';
    case 'medical':
      return '障害・傷病関連証明';
    case 'caregiving':
      return '介護関連証明';
    case 'procedureOther':
      return 'その他社会保険手続き用資料';
    case 'other':
      return 'その他';
    default:
      return category ?? '未設定';
  }
}

export function getDocumentRequestStatusLabel(status?: DocumentRequestStatus): string {
  switch (status) {
    case 'pending':
      return 'アップロード待ち';
    case 'uploaded':
      return 'アップロード済み';
    case 'cancelled':
      return 'キャンセル済み';
    default:
      return '-';
  }
}

export function getBankAccountTypeLabel(type?: BankAccountType | null): string {
  switch (type) {
    case 'ordinary':
      return '普通';
    case 'checking':
      return '当座';
    case 'savings':
      return '貯蓄';
    case 'other':
      return 'その他';
    default:
      return '-';
  }
}

export function getPayrollPayTypeLabel(type?: PayrollPayType | null): string {
  switch (type) {
    case 'monthly':
      return '月給';
    case 'daily':
      return '日給';
    case 'hourly':
      return '時給';
    case 'annual':
      return '年俸';
    case 'other':
      return 'その他';
    default:
      return '-';
  }
}

export function getPayrollPayCycleLabel(cycle?: PayrollPayCycle | null): string {
  switch (cycle) {
    case 'monthly':
      return '月次';
    case 'twice_per_month':
      return '月2回';
    case 'weekly':
      return '週次';
    case 'other':
      return 'その他';
    default:
      return '-';
  }
}
