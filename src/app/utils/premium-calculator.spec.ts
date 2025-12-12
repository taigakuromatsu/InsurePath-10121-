import { isCareInsuranceTarget } from './premium-calculator';

describe('isCareInsuranceTarget (協会けんぽ仕様)', () => {
  // 4-1. 5月2日生まれ
  it('1985-05-02: 40歳到達月の前月までは対象外、当月から対象、65歳到達月から対象外', () => {
    expect(isCareInsuranceTarget('1985-05-02', '2025-04')).toBe(false); // 40歳になる年の4月
    expect(isCareInsuranceTarget('1985-05-02', '2025-05')).toBe(true);  // 40歳になる年の5月開始
    expect(isCareInsuranceTarget('1985-05-02', '2050-04')).toBe(true);  // 65歳になる年の4月が最後
    expect(isCareInsuranceTarget('1985-05-02', '2050-05')).toBe(false); // 65歳になる年の5月から対象外
  });

  // 4-2. 5月1日生まれ（境界注意）
  it('1985-05-01: 40歳到達前日が4月、65歳到達前日も4月', () => {
    expect(isCareInsuranceTarget('1985-05-01', '2025-03')).toBe(false); // 40歳年の3月
    expect(isCareInsuranceTarget('1985-05-01', '2025-04')).toBe(true);  // 40歳年の4月開始
    expect(isCareInsuranceTarget('1985-05-01', '2050-03')).toBe(true);  // 65歳年の3月が最後
    expect(isCareInsuranceTarget('1985-05-01', '2050-04')).toBe(false); // 65歳年の4月から対象外
  });

  // 4-3. 単純ケース
  it('40歳未満 / 途中 / 65歳超の単純ケース', () => {
    expect(isCareInsuranceTarget('1990-01-15', '2029-12')).toBe(false); // 39歳年
    expect(isCareInsuranceTarget('1990-01-15', '2035-01')).toBe(true);  // 40〜64歳範囲内
    expect(isCareInsuranceTarget('1990-01-15', '2056-01')).toBe(false); // 65歳超
  });

  // 4-4. 異常値
  it('パース不能な入力は false を返す', () => {
    expect(isCareInsuranceTarget('', '2025-05')).toBe(false);
    expect(isCareInsuranceTarget('invalid-date', '2025-05')).toBe(false);
    expect(isCareInsuranceTarget('1985-05-02', 'invalid-ym')).toBe(false);
  });
});

