// src/app/utils/kyokai-presets.ts
import { CareRateTable, HealthRateTable, PensionRateTable, StandardRewardBand } from '../types';

export const PREFECTURE_CODES: Record<string, string> = {
  '01': '北海道',
  '02': '青森県',
  '03': '岩手県',
  '04': '宮城県',
  '05': '秋田県',
  '06': '山形県',
  '07': '福島県',
  '08': '茨城県',
  '09': '栃木県',
  '10': '群馬県',
  '11': '埼玉県',
  '12': '千葉県',
  '13': '東京都',
  '14': '神奈川県',
  '15': '新潟県',
  '16': '富山県',
  '17': '石川県',
  '18': '福井県',
  '19': '山梨県',
  '20': '長野県',
  '21': '岐阜県',
  '22': '静岡県',
  '23': '愛知県',
  '24': '三重県',
  '25': '滋賀県',
  '26': '京都府',
  '27': '大阪府',
  '28': '兵庫県',
  '29': '奈良県',
  '30': '和歌山県',
  '31': '鳥取県',
  '32': '島根県',
  '33': '岡山県',
  '34': '広島県',
  '35': '山口県',
  '36': '徳島県',
  '37': '香川県',
  '38': '愛媛県',
  '39': '高知県',
  '40': '福岡県',
  '41': '佐賀県',
  '42': '長崎県',
  '43': '熊本県',
  '44': '大分県',
  '45': '宮崎県',
  '46': '鹿児島県',
  '47': '沖縄県'
};

/**
 * 協会けんぽの健康保険料率（都道府県別、令和6年度 = 2024年度）
 * 年度: 2024年4月〜2025年3月
 */
export const KYOKAI_HEALTH_RATES_2024: Record<string, number> = {
  '01': 0.1021, // 北海道: 10.21%
  '02': 0.0949, // 青森県: 9.49%
  '03': 0.0963, // 岩手県: 9.63%
  '04': 0.1001, // 宮城県: 10.01%
  '05': 0.0985, // 秋田県: 9.85%
  '06': 0.0984, // 山形県: 9.84%
  '07': 0.0959, // 福島県: 9.59%
  '08': 0.0966, // 茨城県: 9.66%
  '09': 0.0979, // 栃木県: 9.79%
  '10': 0.0981, // 群馬県: 9.81%
  '11': 0.0978, // 埼玉県: 9.78%
  '12': 0.0977, // 千葉県: 9.77%
  '13': 0.0998, // 東京都: 9.98%
  '14': 0.1002, // 神奈川県: 10.02%
  '15': 0.0935, // 新潟県: 9.35%
  '16': 0.0962, // 富山県: 9.62%
  '17': 0.0994, // 石川県: 9.94%
  '18': 0.1007, // 福井県: 10.07%
  '19': 0.0994, // 山梨県: 9.94%
  '20': 0.0955, // 長野県: 9.55%
  '21': 0.0991, // 岐阜県: 9.91%
  '22': 0.0985, // 静岡県: 9.85%
  '23': 0.1002, // 愛知県: 10.02%
  '24': 0.0994, // 三重県: 9.94%
  '25': 0.0989, // 滋賀県: 9.89%
  '26': 0.1013, // 京都府: 10.13%
  '27': 0.1034, // 大阪府: 10.34%
  '28': 0.1018, // 兵庫県: 10.18%
  '29': 0.1022, // 奈良県: 10.22%
  '30': 0.1000, // 和歌山県: 10.00%
  '31': 0.0968, // 鳥取県: 9.68%
  '32': 0.0992, // 島根県: 9.92%
  '33': 0.1002, // 岡山県: 10.02%
  '34': 0.0995, // 広島県: 9.95%
  '35': 0.1020, // 山口県: 10.20%
  '36': 0.1019, // 徳島県: 10.19%
  '37': 0.1033, // 香川県: 10.33%
  '38': 0.1003, // 愛媛県: 10.03%
  '39': 0.0989, // 高知県: 9.89%
  '40': 0.1035, // 福岡県: 10.35%
  '41': 0.1042, // 佐賀県: 10.42%
  '42': 0.1017, // 長崎県: 10.17%
  '43': 0.1030, // 熊本県: 10.30%
  '44': 0.1025, // 大分県: 10.25%
  '45': 0.0985, // 宮崎県: 9.85%
  '46': 0.1013, // 鹿児島県: 10.13%
  '47': 0.0952  // 沖縄県: 9.52%
};

/**
 * 協会けんぽの健康保険料率（都道府県別、令和7年度 = 2025年度）
 * 年度: 2025年4月〜2026年3月
 */
export const KYOKAI_HEALTH_RATES_2025: Record<string, number> = {
  '01': 0.1031, // 北海道: 10.31%
  '02': 0.0985, // 青森県: 9.85%
  '03': 0.0962, // 岩手県: 9.62%
  '04': 0.1011, // 宮城県: 10.11%
  '05': 0.1001, // 秋田県: 10.01%
  '06': 0.0975, // 山形県: 9.75%
  '07': 0.0962, // 福島県: 9.62%
  '08': 0.0967, // 茨城県: 9.67%
  '09': 0.0982, // 栃木県: 9.82%
  '10': 0.0977, // 群馬県: 9.77%
  '11': 0.0976, // 埼玉県: 9.76%
  '12': 0.0979, // 千葉県: 9.79%
  '13': 0.0991, // 東京都: 9.91%
  '14': 0.0992, // 神奈川県: 9.92%
  '15': 0.0955, // 新潟県: 9.55%
  '16': 0.0965, // 富山県: 9.65%
  '17': 0.0988, // 石川県: 9.88%
  '18': 0.0994, // 福井県: 9.94%
  '19': 0.0989, // 山梨県: 9.89%
  '20': 0.0969, // 長野県: 9.69%
  '21': 0.0993, // 岐阜県: 9.93%
  '22': 0.0980, // 静岡県: 9.80%
  '23': 0.1003, // 愛知県: 10.03%
  '24': 0.0999, // 三重県: 9.99%
  '25': 0.0997, // 滋賀県: 9.97%
  '26': 0.1003, // 京都府: 10.03%
  '27': 0.1024, // 大阪府: 10.24%
  '28': 0.1016, // 兵庫県: 10.16%
  '29': 0.1002, // 奈良県: 10.02%
  '30': 0.1019, // 和歌山県: 10.19%
  '31': 0.0993, // 鳥取県: 9.93%
  '32': 0.0994, // 島根県: 9.94%
  '33': 0.1017, // 岡山県: 10.17%
  '34': 0.0997, // 広島県: 9.97%
  '35': 0.1036, // 山口県: 10.36%
  '36': 0.1047, // 徳島県: 10.47%
  '37': 0.1021, // 香川県: 10.21%
  '38': 0.1018, // 愛媛県: 10.18%
  '39': 0.1013, // 高知県: 10.13%
  '40': 0.1031, // 福岡県: 10.31%
  '41': 0.1078, // 佐賀県: 10.78%
  '42': 0.1041, // 長崎県: 10.41%
  '43': 0.1012, // 熊本県: 10.12%
  '44': 0.1025, // 大分県: 10.25%
  '45': 0.1009, // 宮崎県: 10.09%
  '46': 0.1031, // 鹿児島県: 10.31%
  '47': 0.0944  // 沖縄県: 9.44%
};

/**
 * 健康保険の標準報酬等級（1〜50等級）
 * 画像の表に合わせてデフォルト値を定義
 */
export const HEALTH_STANDARD_REWARD_BANDS_DEFAULT: StandardRewardBand[] = [
  { grade: 1,  lowerLimit:      0, upperLimit:  63000,  standardMonthly:  58000 },
  { grade: 2,  lowerLimit:  63000, upperLimit:  73000,  standardMonthly:  68000 },
  { grade: 3,  lowerLimit:  73000, upperLimit:  83000,  standardMonthly:  78000 },
  { grade: 4,  lowerLimit:  83000, upperLimit:  93000,  standardMonthly:  88000 },
  { grade: 5,  lowerLimit:  93000, upperLimit: 101000,  standardMonthly:  98000 },
  { grade: 6,  lowerLimit: 101000, upperLimit: 107000,  standardMonthly: 104000 },
  { grade: 7,  lowerLimit: 107000, upperLimit: 114000,  standardMonthly: 110000 },
  { grade: 8,  lowerLimit: 114000, upperLimit: 122000,  standardMonthly: 118000 },
  { grade: 9,  lowerLimit: 122000, upperLimit: 130000,  standardMonthly: 126000 },
  { grade: 10, lowerLimit: 130000, upperLimit: 138000,  standardMonthly: 134000 },
  { grade: 11, lowerLimit: 138000, upperLimit: 146000,  standardMonthly: 142000 },
  { grade: 12, lowerLimit: 146000, upperLimit: 155000,  standardMonthly: 150000 },
  { grade: 13, lowerLimit: 155000, upperLimit: 165000,  standardMonthly: 160000 },
  { grade: 14, lowerLimit: 165000, upperLimit: 175000,  standardMonthly: 170000 },
  { grade: 15, lowerLimit: 175000, upperLimit: 185000,  standardMonthly: 180000 },
  { grade: 16, lowerLimit: 185000, upperLimit: 195000,  standardMonthly: 190000 },
  { grade: 17, lowerLimit: 195000, upperLimit: 210000,  standardMonthly: 200000 },
  { grade: 18, lowerLimit: 210000, upperLimit: 230000,  standardMonthly: 220000 },
  { grade: 19, lowerLimit: 230000, upperLimit: 250000,  standardMonthly: 240000 },
  { grade: 20, lowerLimit: 250000, upperLimit: 270000,  standardMonthly: 260000 },
  { grade: 21, lowerLimit: 270000, upperLimit: 290000,  standardMonthly: 280000 },
  { grade: 22, lowerLimit: 290000, upperLimit: 310000,  standardMonthly: 300000 },
  { grade: 23, lowerLimit: 310000, upperLimit: 330000,  standardMonthly: 320000 },
  { grade: 24, lowerLimit: 330000, upperLimit: 350000,  standardMonthly: 340000 },
  { grade: 25, lowerLimit: 350000, upperLimit: 370000,  standardMonthly: 360000 },
  { grade: 26, lowerLimit: 370000, upperLimit: 395000,  standardMonthly: 380000 },
  { grade: 27, lowerLimit: 395000, upperLimit: 425000,  standardMonthly: 410000 },
  { grade: 28, lowerLimit: 425000, upperLimit: 455000,  standardMonthly: 440000 },
  { grade: 29, lowerLimit: 455000, upperLimit: 485000,  standardMonthly: 470000 },
  { grade: 30, lowerLimit: 485000, upperLimit: 515000,  standardMonthly: 500000 },
  { grade: 31, lowerLimit: 515000, upperLimit: 545000,  standardMonthly: 530000 },
  { grade: 32, lowerLimit: 545000, upperLimit: 575000,  standardMonthly: 560000 },
  { grade: 33, lowerLimit: 575000, upperLimit: 605000,  standardMonthly: 590000 },
  { grade: 34, lowerLimit: 605000, upperLimit: 635000,  standardMonthly: 620000 },
  { grade: 35, lowerLimit: 635000, upperLimit: 665000,  standardMonthly: 650000 },
  { grade: 36, lowerLimit: 665000, upperLimit: 695000,  standardMonthly: 680000 },
  { grade: 37, lowerLimit: 695000, upperLimit: 730000,  standardMonthly: 710000 },
  { grade: 38, lowerLimit: 730000, upperLimit: 770000,  standardMonthly: 730000 },
  { grade: 39, lowerLimit: 770000, upperLimit: 810000,  standardMonthly: 790000 },
  { grade: 40, lowerLimit: 810000, upperLimit: 855000,  standardMonthly: 830000 },
  { grade: 41, lowerLimit: 855000, upperLimit: 905000,  standardMonthly: 880000 },
  { grade: 42, lowerLimit: 905000, upperLimit: 955000,  standardMonthly: 930000 },
  { grade: 43, lowerLimit: 955000, upperLimit: 1005000, standardMonthly: 980000 },
  { grade: 44, lowerLimit: 1005000, upperLimit: 1055000, standardMonthly: 1030000 },
  { grade: 45, lowerLimit: 1055000, upperLimit: 1155000, standardMonthly: 1090000 },
  { grade: 46, lowerLimit: 1115000, upperLimit: 1175000, standardMonthly: 1150000 },
  { grade: 47, lowerLimit: 1175000, upperLimit: 1235000, standardMonthly: 1210000 },
  { grade: 48, lowerLimit: 1235000, upperLimit: 1295000, standardMonthly: 1270000 },
  { grade: 49, lowerLimit: 1295000, upperLimit: 1355000, standardMonthly: 1330000 },
  // 最上位等級は「135万5千円以上〜」なので、上限は便宜上大きな値を入れておく
  { grade: 50, lowerLimit: 1355000, upperLimit: 999999999, standardMonthly: 1390000 }
];

/**
 * 厚生年金の標準報酬等級（1〜32等級）
 * 画像の「厚生年金の等級」列に基づき、健康保険4〜35等級に対応
 */
export const PENSION_STANDARD_REWARD_BANDS_DEFAULT: StandardRewardBand[] = [
  { grade: 1,  lowerLimit:  83000, upperLimit:  93000, standardMonthly:  88000 },
  { grade: 2,  lowerLimit:  93000, upperLimit: 101000, standardMonthly:  98000 },
  { grade: 3,  lowerLimit: 101000, upperLimit: 107000, standardMonthly: 104000 },
  { grade: 4,  lowerLimit: 107000, upperLimit: 114000, standardMonthly: 110000 },
  { grade: 5,  lowerLimit: 114000, upperLimit: 122000, standardMonthly: 118000 },
  { grade: 6,  lowerLimit: 122000, upperLimit: 130000, standardMonthly: 126000 },
  { grade: 7,  lowerLimit: 130000, upperLimit: 138000, standardMonthly: 134000 },
  { grade: 8,  lowerLimit: 138000, upperLimit: 146000, standardMonthly: 142000 },
  { grade: 9,  lowerLimit: 146000, upperLimit: 155000, standardMonthly: 150000 },
  { grade: 10, lowerLimit: 155000, upperLimit: 165000, standardMonthly: 160000 },
  { grade: 11, lowerLimit: 165000, upperLimit: 175000, standardMonthly: 170000 },
  { grade: 12, lowerLimit: 175000, upperLimit: 185000, standardMonthly: 180000 },
  { grade: 13, lowerLimit: 185000, upperLimit: 195000, standardMonthly: 190000 },
  { grade: 14, lowerLimit: 195000, upperLimit: 210000, standardMonthly: 200000 },
  { grade: 15, lowerLimit: 210000, upperLimit: 230000, standardMonthly: 220000 },
  { grade: 16, lowerLimit: 230000, upperLimit: 250000, standardMonthly: 240000 },
  { grade: 17, lowerLimit: 250000, upperLimit: 270000, standardMonthly: 260000 },
  { grade: 18, lowerLimit: 270000, upperLimit: 290000, standardMonthly: 280000 },
  { grade: 19, lowerLimit: 290000, upperLimit: 310000, standardMonthly: 300000 },
  { grade: 20, lowerLimit: 310000, upperLimit: 330000, standardMonthly: 320000 },
  { grade: 21, lowerLimit: 330000, upperLimit: 350000, standardMonthly: 340000 },
  { grade: 22, lowerLimit: 350000, upperLimit: 370000, standardMonthly: 360000 },
  { grade: 23, lowerLimit: 370000, upperLimit: 395000, standardMonthly: 380000 },
  { grade: 24, lowerLimit: 395000, upperLimit: 425000, standardMonthly: 410000 },
  { grade: 25, lowerLimit: 425000, upperLimit: 455000, standardMonthly: 440000 },
  { grade: 26, lowerLimit: 455000, upperLimit: 485000, standardMonthly: 470000 },
  { grade: 27, lowerLimit: 485000, upperLimit: 515000, standardMonthly: 500000 },
  { grade: 28, lowerLimit: 515000, upperLimit: 545000, standardMonthly: 530000 },
  { grade: 29, lowerLimit: 545000, upperLimit: 575000, standardMonthly: 560000 },
  { grade: 30, lowerLimit: 575000, upperLimit: 605000, standardMonthly: 590000 },
  { grade: 31, lowerLimit: 605000, upperLimit: 635000, standardMonthly: 620000 },
  { grade: 32, lowerLimit: 635000, upperLimit: 665000, standardMonthly: 650000 }
];

/**
 * 互換用エイリアス（健康保険用）
 * 既存コードで STANDARD_REWARD_BANDS_BASE を使っている箇所を壊さないため
 */
export const STANDARD_REWARD_BANDS_BASE = HEALTH_STANDARD_REWARD_BANDS_DEFAULT;

export const CARE_RATE_2024 = 0.0191;
export const PENSION_RATE_2024 = 0.183;

export function getKyokaiHealthRatePreset(
  prefCode: string,
  year: number // 年度の開始年（例: 2024年度なら2024）
): Partial<HealthRateTable> | undefined {
  // 年度に応じて適切なデータを選択（2024/2025のみ対応）
  let rates: Record<string, number> | undefined;
  if (year === 2024) {
    rates = KYOKAI_HEALTH_RATES_2024;
  } else if (year === 2025) {
    rates = KYOKAI_HEALTH_RATES_2025;
  } else {
    // 対応していない年度はプリセットなし
    return undefined;
  }
  
  // 年度ベースのフォールバックデータなので、effectiveYear/effectiveMonthは3月開始として設定
  return {
    effectiveYear: year,
    effectiveMonth: 3,
    effectiveYearMonth: year * 100 + 3,
    planType: 'kyokai',
    kyokaiPrefCode: prefCode,
    kyokaiPrefName: PREFECTURE_CODES[prefCode] ?? '',
    healthRate: rates[prefCode] ?? 0.1, // デフォルト値: 10%
    bands: HEALTH_STANDARD_REWARD_BANDS_DEFAULT
  };
}

export function getCareRatePreset(year: number): Partial<CareRateTable> {
  // 年度ベースのフォールバックデータなので、effectiveYear/effectiveMonthは3月開始として設定
  return {
    effectiveYear: year,
    effectiveMonth: 3,
    effectiveYearMonth: year * 100 + 3,
    careRate: CARE_RATE_2024
  };
}

export function getPensionRatePreset(year: number): Partial<PensionRateTable> {
  // 年度ベースのフォールバックデータなので、effectiveYear/effectiveMonthは3月開始として設定
  return {
    effectiveYear: year,
    effectiveMonth: 3,
    effectiveYearMonth: year * 100 + 3,
    pensionRate: PENSION_RATE_2024,
    bands: PENSION_STANDARD_REWARD_BANDS_DEFAULT
  };
}
