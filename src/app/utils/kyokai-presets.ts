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

export const STANDARD_REWARD_BANDS_BASE: StandardRewardBand[] = [
  { grade: 1, lowerLimit: 0, upperLimit: 63000, standardMonthly: 58000 },
  { grade: 2, lowerLimit: 63000, upperLimit: 73000, standardMonthly: 68000 },
  { grade: 3, lowerLimit: 73000, upperLimit: 83000, standardMonthly: 78000 },
  { grade: 4, lowerLimit: 83000, upperLimit: 93000, standardMonthly: 88000 },
  { grade: 5, lowerLimit: 93000, upperLimit: 101000, standardMonthly: 98000 },
  { grade: 6, lowerLimit: 101000, upperLimit: 107000, standardMonthly: 104000 },
  { grade: 7, lowerLimit: 107000, upperLimit: 114000, standardMonthly: 110000 },
  { grade: 8, lowerLimit: 114000, upperLimit: 122000, standardMonthly: 118000 },
  { grade: 9, lowerLimit: 122000, upperLimit: 130000, standardMonthly: 126000 },
  { grade: 10, lowerLimit: 130000, upperLimit: 138000, standardMonthly: 134000 }
];

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
    bands: STANDARD_REWARD_BANDS_BASE
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
    bands: STANDARD_REWARD_BANDS_BASE
  };
}
