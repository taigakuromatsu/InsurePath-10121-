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
 * 協会けんぽの健康保険料率（都道府県別、例としての値）
 */
export const KYOKAI_HEALTH_RATES_2024: Record<string, number> = {
  '01': 0.1,
  '13': 0.0981,
  '27': 0.0985
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
  year: number
): Partial<HealthRateTable> {
  return {
    year,
    planType: 'kyokai',
    kyokaiPrefCode: prefCode,
    kyokaiPrefName: PREFECTURE_CODES[prefCode] ?? '',
    healthRate: KYOKAI_HEALTH_RATES_2024[prefCode] ?? 0.1,
    bands: HEALTH_STANDARD_REWARD_BANDS_DEFAULT
  };
}

export function getCareRatePreset(year: number): Partial<CareRateTable> {
  return {
    year,
    careRate: CARE_RATE_2024
  };
}

export function getPensionRatePreset(year: number): Partial<PensionRateTable> {
  return {
    year,
    pensionRate: PENSION_RATE_2024,
    bands: PENSION_STANDARD_REWARD_BANDS_DEFAULT
  };
}
