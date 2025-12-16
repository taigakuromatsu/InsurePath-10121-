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

/**
 * 日付を和暦表記に変換（YYYY-MM-DD → 昭和/平成/令和X年M月D日）
 * 元号判定:
 * - 令和: 2019-05-01 以降 → 令和X年M月D日（令和1年は「令和元年」でも可だが、ここでは「令和1年」で統一）
 * - 平成: 1989-01-08 以降 → 平成X年M月D日
 * - 昭和: 1926-12-25 以降 → 昭和X年M月D日
 * - それ以前は西暦表示
 * 
 * @param value YYYY-MM-DD形式の日付文字列、またはnull/undefined
 * @returns 和暦表記の文字列（空の場合は空文字列）
 */
export function formatJapaneseEraDate(value?: string | null): string {
  if (!value) {
    return '';
  }

  const parts = value.split('-');
  if (parts.length !== 3) {
    // 不正な形式の場合はそのまま返す
    return value;
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return value;
  }

  // 日付の妥当性チェック（簡易）
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return value;
  }

  // 元号判定
  // 令和開始日: 2019年5月1日
  if (year > 2019 || (year === 2019 && month >= 5)) {
    const reiwaYear = year - 2018; // 2019年→令和1年
    return `令和${reiwaYear}年${month}月${day}日`;
  }

  // 平成開始日: 1989年1月8日
  if (year > 1989 || (year === 1989 && month > 1) || (year === 1989 && month === 1 && day >= 8)) {
    const heiseiYear = year - 1988; // 1989年→平成1年
    return `平成${heiseiYear}年${month}月${day}日`;
  }

  // 昭和開始日: 1926年12月25日
  if (year > 1926 || (year === 1926 && month === 12 && day >= 25)) {
    const showaYear = year - 1925; // 1926年→昭和1年
    return `昭和${showaYear}年${month}月${day}日`;
  }

  // それ以前は西暦表示
  return `${year}年${month}月${day}日`;
}

export const DOCUMENT_DISCLAIMER =
  '届書の様式に合わせて届出記入の際に必要な情報のみ抽出してまとめています';
