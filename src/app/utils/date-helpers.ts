/**
 * YYYY-MM-DD形式の文字列をローカル日付（Dateオブジェクト）に変換
 * toISOString()のタイムゾーン問題を回避するため、ローカル時刻として解釈する
 *
 * @param value YYYY-MM-DD形式の文字列
 * @returns Dateオブジェクト（ローカル時刻）
 */
export function ymdToDateLocal(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/**
 * DateオブジェクトをYYYY-MM-DD形式の文字列に変換（ローカル時刻）
 * toISOString()のタイムゾーン問題を回避するため、ローカル時刻から直接文字列を生成する
 *
 * @param date Dateオブジェクト
 * @returns YYYY-MM-DD形式の文字列（例: "2025-12-06"）
 */
export function dateToYmdLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * ローカルタイム（JST想定）で今日のYYYY-MM-DD形式の文字列を取得
 *
 * @returns YYYY-MM-DD形式の文字列
 */
export function todayYmd(): string {
  return dateToYmdLocal(new Date());
}

/**
 * 指定した日付から指定日数後の日付をYYYY-MM-DD形式の文字列として取得
 *
 * @param dateStr YYYY-MM-DD形式の文字列
 * @param days 加算する日数（負の値も可）
 * @returns YYYY-MM-DD形式の文字列
 */
export function addDays(dateStr: string, days: number): string {
  const date = ymdToDateLocal(dateStr);
  date.setDate(date.getDate() + days);
  return dateToYmdLocal(date);
}

/**
 * 指定した日付が属する週の月曜日と日曜日をYYYY-MM-DD形式の文字列として取得
 * 週の開始日は月曜日とする
 *
 * @param date 基準となる日付（省略時は今日）
 * @returns 週の月曜日と日曜日（YYYY-MM-DD形式）
 */
export function getWeekRangeMonToSun(date: Date = new Date()): { startYmd: string; endYmd: string } {
  const dayOfWeek = date.getDay(); // 0=日曜, 1=月曜, ... 6=土曜
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const startYmd = dateToYmdLocal(monday);
  const endYmd = addDays(startYmd, 6);

  return { startYmd, endYmd };
}

/**
 * 今週の月曜日をYYYY-MM-DD形式の文字列として取得（週の開始日は月曜日）
 */
export function getThisWeekMonday(): string {
  return getWeekRangeMonToSun().startYmd;
}

/**
 * 来週の月曜日をYYYY-MM-DD形式の文字列として取得
 */
export function getNextWeekMonday(): string {
  const thisWeekMonday = getThisWeekMonday();
  return addDays(thisWeekMonday, 7);
}

/**
 * 指定した週の日曜日をYYYY-MM-DD形式の文字列として取得
 *
 * @param mondayStr 週の月曜日（YYYY-MM-DD形式）
 */
export function getSundayOfWeek(mondayStr: string): string {
  return addDays(mondayStr, 6);
}

