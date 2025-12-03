import {
  InsuranceLossReasonKind,
  InsuranceQualificationKind,
  Sex
} from '../types';
import {
  getInsuranceLossReasonKindLabel,
  getInsuranceQualificationKindLabel
} from './label-utils';

/**
 * YYYY-MM-DD を「YYYY年M月D日」の表記に変換します。
 */
export function formatDate(value?: string | null): string {
  if (!value) {
    return '';
  }
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }
  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
}

export function formatDateWithFallback(value?: string | null, fallbackText = ''): string {
  const formatted = formatDate(value);
  return formatted || fallbackText;
}

export function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '';
  }
  return value.toLocaleString('ja-JP');
}

export function formatSexLabel(sex?: Sex | null): string {
  switch (sex) {
    case 'male':
      return '男';
    case 'female':
      return '女';
    case 'other':
      return 'その他';
    default:
      return '';
  }
}

export function formatQualificationKind(kind?: InsuranceQualificationKind | null): string {
  return kind ? getInsuranceQualificationKindLabel(kind) ?? '' : '';
}

export function formatLossReason(kind?: InsuranceLossReasonKind | null): string {
  return kind ? getInsuranceLossReasonKindLabel(kind) ?? '' : '';
}

export const DOCUMENT_DISCLAIMER =
  '本システムで生成される帳票は参考様式です。提出前に最新様式と内容を確認の上、必要に応じて手書き修正してください。';
