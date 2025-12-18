# 日付処理のJST/UTC混在問題修正実装指示書

## 改訂履歴
- 2025年1月: 初版作成

---

## 1. 概要

### 1-1. 問題の背景

システム内で日付処理において、JST（日本標準時）とUTC（協定世界時）の混在により、日付が1日ズレる可能性がある問題が存在します。

**主な問題パターン**:
1. `new Date('YYYY-MM-DD')` + `toISOString().substring(0, 10)` の組み合わせ
   - `new Date('YYYY-MM-DD')` がUTCとして解釈される可能性
   - `toISOString()` がUTC時刻を返すため、JST環境では日付が1日ズレる
2. `toISOString().substring(0, 7)` で現在年月を取得
   - JSTの午前0時〜8時59分に実行すると、UTCでは前日になるため、前月として扱われる可能性

### 1-2. 影響範囲

**高リスク（境界処理・致命的な誤判定）**:
- `isCareInsuranceTarget()` - 40/65歳境界で介護保険対象判定が誤る
- 現在年月の取得 - ランキング集計やシミュレーションの対象月が1ヶ月ズレる

**中リスク（日付比較・計算）**:
- 年齢計算 - 誕生日近辺で1日ズレる
- デフォルト日付生成 - 保存・比較に使う場合は境界ズレの可能性

**低リスク（UX影響のみ）**:
- デフォルト日付生成 - 表示のみの場合は影響限定的

### 1-3. 修正方針

**基本原則**:
- **日付（YYYY-MM-DD）**: `date-helpers.ts` のローカル生成/変換に統一
- **年月（YYYY-MM）**: ローカル時刻から直接生成
- **タイムスタンプ（createdAt/updatedAt）**: UTC（`toISOString()`）でOK

**既存の安全なパターン**:
- `date-helpers.ts` の関数群（`ymdToDateLocal`, `dateToYmdLocal`, `todayYmd` など）
- ローカル時刻コンストラクタ（`new Date(year, month - 1, day)`）

---

## 2. 修正対象ファイルと優先度

### 優先度1（最優先・境界ロジック）

#### 2-1. `src/app/utils/premium-calculator.ts` - `isCareInsuranceTarget()`

**問題点**:
- `new Date(birthDate)` がUTCとして解釈される可能性
- `toISOString().substring(0, 10)` でUTC日付を取得
- 40/65歳境界で誤判定のリスク

**修正内容**:
- `date-helpers.ts` の `ymdToDateLocal()` と `dateToYmdLocal()` を使用
- または、YMD算術で直接年月を計算（より堅牢）

**影響範囲**: 介護保険料計算、月次保険料計算、賞与保険料計算、マイページ表示

---

### 優先度2（高優先度・現在年月の取得）

#### 2-2. `src/app/pages/dashboard/dashboard.page.ts` - ランキングデータ取得

**問題点**:
- `now.toISOString().substring(0, 7)` で現在年月を取得
- JSTの午前0時〜8時59分に実行すると前月になる可能性

**修正内容**:
- ローカル時刻から直接年月を生成する関数を使用

**影響範囲**: ダッシュボードのランキング表示

#### 2-3. `src/app/pages/simulator/simulator.page.ts` - 計算対象年月の生成

**問題点**:
- `new Date().toISOString().substring(0, 7)` で現在年月を取得
- 同様に前月になる可能性

**修正内容**:
- ローカル時刻から直接年月を生成する関数を使用

**影響範囲**: シミュレーターの単月計算モード

---

### 優先度3（中優先度・デフォルト日付生成）

#### 2-4. `src/app/pages/premiums/bonus/bonus-form-dialog.component.ts` - 賞与支払日のデフォルト

**問題点**:
- `new Date().toISOString().substring(0, 10)` でデフォルト日付を生成
- 午前9時前は前日になる可能性
- 保存・計算に使用されるため影響あり

**修正内容**:
- `date-helpers.ts` の `todayYmd()` を使用

**影響範囲**: 賞与フォームのデフォルト日付

#### 2-5. `src/app/pages/dependent-reviews/dependent-reviews.page.ts` - 基準年月日のデフォルト

**問題点**:
- `new Date().toISOString().substring(0, 10)` でデフォルト日付を生成
- 計算・判定に使用されるため、境界ズレの可能性

**修正内容**:
- `date-helpers.ts` の `todayYmd()` を使用

**影響範囲**: 扶養状況確認の基準年月日

#### 2-6. `src/app/pages/dependent-reviews/session-form-dialog.component.ts` - 今日の日付

**問題点**:
- `new Date().toISOString().substring(0, 10)` でデフォルト日付を生成

**修正内容**:
- `date-helpers.ts` の `todayYmd()` を使用

**影響範囲**: セッションフォームのデフォルト日付

#### 2-7. `src/app/pages/dependent-reviews/review-form-dialog.component.ts` - 今日の日付

**問題点**:
- `new Date().toISOString().substring(0, 10)` でデフォルト日付を生成

**修正内容**:
- `date-helpers.ts` の `todayYmd()` を使用

**影響範囲**: レビューフォームのデフォルト日付

---

### 優先度4（低優先度・年齢計算）

#### 2-8. `src/app/utils/premium-calculator.ts` - `calculateAge()` 関数

**問題点**:
- `new Date(birthDate)` がUTCとして解釈される可能性
- 年齢計算で1日ズレる可能性

**修正内容**:
- `date-helpers.ts` の `ymdToDateLocal()` を使用

**影響範囲**: 月次保険料ページの年齢表示

#### 2-9. `src/app/utils/label-utils.ts` - `calculateAge()` 関数

**問題点**:
- `new Date(birthDate)` がUTCとして解釈される可能性

**修正内容**:
- `date-helpers.ts` の `ymdToDateLocal()` を使用

**影響範囲**: ラベル表示の年齢計算

#### 2-10. `src/app/pages/premiums/bonus/bonus-premiums.page.ts` - `calculateAge()` 関数

**問題点**:
- `new Date(birthDate)` がUTCとして解釈される可能性

**修正内容**:
- `date-helpers.ts` の `ymdToDateLocal()` を使用

**影響範囲**: 賞与保険料ページの年齢表示

---

## 3. 実装ステップ

### ステップ1: `date-helpers.ts` に年月取得関数を追加（必要に応じて）

**目的**: ローカル時刻から年月（YYYY-MM）を取得する関数を追加

**対象ファイル**: `src/app/utils/date-helpers.ts`

**実装内容**:
```typescript
/**
 * ローカルタイム（JST想定）で今日のYYYY-MM形式の文字列を取得
 *
 * @returns YYYY-MM形式の文字列（例: "2025-12"）
 */
export function todayYearMonth(): YearMonthString {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}` as YearMonthString;
}

/**
 * DateオブジェクトからYYYY-MM形式の文字列を取得（ローカル時刻）
 *
 * @param date Dateオブジェクト
 * @returns YYYY-MM形式の文字列（例: "2025-12"）
 */
export function dateToYearMonthLocal(date: Date): YearMonthString {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}` as YearMonthString;
}
```

**注意**: `YearMonthString` 型のインポートが必要

---

### ステップ2: `isCareInsuranceTarget()` の修正（最優先）

**対象ファイル**: `src/app/utils/premium-calculator.ts`

**修正前**:
```typescript
export function isCareInsuranceTarget(
  birthDate: string,
  yearMonth: YearMonthString
): boolean {
  const ym = toYearMonthOrNull(`${yearMonth}-01`);
  if (!birthDate || !ym) return false;

  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return false;

  // 40歳到達前日が属する年月
  const dayBefore40 = new Date(birth);
  dayBefore40.setFullYear(dayBefore40.getFullYear() + 40);
  dayBefore40.setDate(dayBefore40.getDate() - 1);
  const startYm = toYearMonthOrNull(dayBefore40.toISOString().substring(0, 10));
  if (!startYm) return false;

  // 65歳到達前日が属する年月
  const dayBefore65 = new Date(birth);
  dayBefore65.setFullYear(dayBefore65.getFullYear() + 65);
  dayBefore65.setDate(dayBefore65.getDate() - 1);
  const lossYm = toYearMonthOrNull(dayBefore65.toISOString().substring(0, 10));
  if (!lossYm) return false;

  return startYm <= ym && ym < lossYm;
}
```

**修正後（案A: date-helpers.ts を使用）**:
```typescript
import { ymdToDateLocal, dateToYmdLocal } from './date-helpers';

export function isCareInsuranceTarget(
  birthDate: string,
  yearMonth: YearMonthString
): boolean {
  const ym = toYearMonthOrNull(`${yearMonth}-01`);
  if (!birthDate || !ym) return false;

  const birth = ymdToDateLocal(birthDate);
  if (isNaN(birth.getTime())) return false;

  // 40歳到達前日が属する年月
  const dayBefore40 = new Date(birth);
  dayBefore40.setFullYear(dayBefore40.getFullYear() + 40);
  dayBefore40.setDate(dayBefore40.getDate() - 1);
  const startYm = toYearMonthOrNull(dateToYmdLocal(dayBefore40));
  if (!startYm) return false;

  // 65歳到達前日が属する年月
  const dayBefore65 = new Date(birth);
  dayBefore65.setFullYear(dayBefore65.getFullYear() + 65);
  dayBefore65.setDate(dayBefore65.getDate() - 1);
  const lossYm = toYearMonthOrNull(dateToYmdLocal(dayBefore65));
  if (!lossYm) return false;

  return startYm <= ym && ym < lossYm;
}
```

**修正後（案B: YMD算術で直接計算・より堅牢）**:
```typescript
export function isCareInsuranceTarget(
  birthDate: string,
  yearMonth: YearMonthString
): boolean {
  const ym = toYearMonthOrNull(`${yearMonth}-01`);
  if (!birthDate || !ym) return false;

  // YYYY-MM-DD形式を分解
  const [by, bm, bd] = birthDate.split('-').map(Number);
  if (!by || !bm || !bd) return false;

  // 40歳到達前日を計算（YMD算術）
  // 誕生日が1日の場合、前日は前月の最終日になる
  let startYear = by + 40;
  let startMonth = bm;
  let startDay = bd - 1;
  
  if (startDay < 1) {
    startMonth--;
    if (startMonth < 1) {
      startMonth = 12;
      startYear--;
    }
    // 前月の最終日を取得（簡易版：28-31日の扱いは実装が必要）
    const daysInPrevMonth = new Date(startYear, startMonth, 0).getDate();
    startDay = daysInPrevMonth;
  }
  
  const startYm = `${startYear}-${String(startMonth).padStart(2, '0')}` as YearMonthString;

  // 65歳到達前日を計算（同様）
  let lossYear = by + 65;
  let lossMonth = bm;
  let lossDay = bd - 1;
  
  if (lossDay < 1) {
    lossMonth--;
    if (lossMonth < 1) {
      lossMonth = 12;
      lossYear--;
    }
    const daysInPrevMonth = new Date(lossYear, lossMonth, 0).getDate();
    lossDay = daysInPrevMonth;
  }
  
  const lossYm = `${lossYear}-${String(lossMonth).padStart(2, '0')}` as YearMonthString;

  return startYm <= ym && ym < lossYm;
}
```

**推奨**: 案A（`date-helpers.ts` を使用）を推奨。既存の関数を活用でき、実装がシンプル。

**確認事項**:
- `date-helpers.ts` のインポートが追加されているか
- テストケースが正しく動作するか

---

### ステップ3: 現在年月の取得を修正（優先度2）

#### 3-1. `dashboard.page.ts` の修正

**対象ファイル**: `src/app/pages/dashboard/dashboard.page.ts`

**修正前**:
```typescript
const now = new Date();
const currentYearMonth = now.toISOString().substring(0, 7);
```

**修正後**:
```typescript
import { todayYearMonth } from '../../utils/date-helpers';

const currentYearMonth = todayYearMonth();
```

**または、既存の関数がない場合**:
```typescript
const now = new Date();
const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` as YearMonthString;
```

#### 3-2. `simulator.page.ts` の修正

**対象ファイル**: `src/app/pages/simulator/simulator.page.ts`

**修正前**:
```typescript
yearMonths.push(new Date().toISOString().substring(0, 7) as YearMonthString);
```

**修正後**:
```typescript
import { todayYearMonth } from '../../utils/date-helpers';

yearMonths.push(todayYearMonth());
```

**または、既存の関数がない場合**:
```typescript
const now = new Date();
const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` as YearMonthString;
yearMonths.push(currentYearMonth);
```

---

### ステップ4: デフォルト日付生成を修正（優先度3）

#### 4-1. `bonus-form-dialog.component.ts` の修正

**対象ファイル**: `src/app/pages/premiums/bonus/bonus-form-dialog.component.ts`

**修正前**:
```typescript
payDate: [new Date().toISOString().substring(0, 10), Validators.required],
```

**修正後**:
```typescript
import { todayYmd } from '../../../utils/date-helpers';

payDate: [todayYmd(), Validators.required],
```

**修正前**:
```typescript
payDate: this.data.bonus?.payDate ?? new Date().toISOString().substring(0, 10),
```

**修正後**:
```typescript
payDate: this.data.bonus?.payDate ?? todayYmd(),
```

#### 4-2. `dependent-reviews.page.ts` の修正

**対象ファイル**: `src/app/pages/dependent-reviews/dependent-reviews.page.ts`

**修正前**:
```typescript
referenceDate: string = new Date().toISOString().substring(0, 10);
```

**修正後**:
```typescript
import { todayYmd } from '../../utils/date-helpers';

referenceDate: string = todayYmd();
```

**修正前**:
```typescript
const reviewDate = this.referenceDate || new Date().toISOString().substring(0, 10);
```

**修正後**:
```typescript
const reviewDate = this.referenceDate || todayYmd();
```

#### 4-3. `session-form-dialog.component.ts` の修正

**対象ファイル**: `src/app/pages/dependent-reviews/session-form-dialog.component.ts`

**修正前**:
```typescript
private readonly today = new Date().toISOString().substring(0, 10);
```

**修正後**:
```typescript
import { todayYmd } from '../../utils/date-helpers';

private readonly today = todayYmd();
```

#### 4-4. `review-form-dialog.component.ts` の修正

**対象ファイル**: `src/app/pages/dependent-reviews/review-form-dialog.component.ts`

**修正前**:
```typescript
private readonly today = new Date().toISOString().substring(0, 10);
```

**修正後**:
```typescript
import { todayYmd } from '../../utils/date-helpers';

private readonly today = todayYmd();
```

---

### ステップ5: 年齢計算関数の修正（優先度4）

#### 5-1. `premium-calculator.ts` の `calculateAge()` 修正

**対象ファイル**: `src/app/utils/premium-calculator.ts`

**修正前**:
```typescript
function calculateAge(birthDate: string | null | undefined, yearMonth: YearMonthString): number | undefined {
  if (!birthDate) return undefined;
  
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return undefined;
  
  // 対象年月の月末日を取得
  const [year, month] = yearMonth.split('-').map(Number);
  const targetDate = new Date(year, month, 0); // 月末日
  
  let age = targetDate.getFullYear() - birth.getFullYear();
  const monthDiff = targetDate.getMonth() - birth.getMonth();
  
  // まだ誕生日が来ていない場合は1歳減らす
  if (monthDiff < 0 || (monthDiff === 0 && targetDate.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}
```

**修正後**:
```typescript
import { ymdToDateLocal } from './date-helpers';

function calculateAge(birthDate: string | null | undefined, yearMonth: YearMonthString): number | undefined {
  if (!birthDate) return undefined;
  
  const birth = ymdToDateLocal(birthDate);
  if (isNaN(birth.getTime())) return undefined;
  
  // 対象年月の月末日を取得（ローカル時刻コンストラクタは安全）
  const [year, month] = yearMonth.split('-').map(Number);
  const targetDate = new Date(year, month, 0); // 月末日
  
  let age = targetDate.getFullYear() - birth.getFullYear();
  const monthDiff = targetDate.getMonth() - birth.getMonth();
  
  // まだ誕生日が来ていない場合は1歳減らす
  if (monthDiff < 0 || (monthDiff === 0 && targetDate.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}
```

#### 5-2. `label-utils.ts` の `calculateAge()` 修正

**対象ファイル**: `src/app/utils/label-utils.ts`

**修正前**:
```typescript
export function calculateAge(birthDate?: string | null): number | null {
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
```

**修正後**:
```typescript
import { ymdToDateLocal } from './date-helpers';

export function calculateAge(birthDate?: string | null): number | null {
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
```

#### 5-3. `bonus-premiums.page.ts` の `calculateAge()` 修正

**対象ファイル**: `src/app/pages/premiums/bonus/bonus-premiums.page.ts`

**修正前**:
```typescript
const birth = new Date(birthDate);
```

**修正後**:
```typescript
import { ymdToDateLocal } from '../../../utils/date-helpers';

const birth = ymdToDateLocal(birthDate);
```

---

## 4. テスト観点

### 4-1. `isCareInsuranceTarget()` のテスト

**必須テストケース**:

1. **40歳境界のテスト**
   - 生年月日: `1985-05-02` → 40歳到達前日: `2025-05-01`
   - 対象年月: `2025-04` → `false`（40歳になる年の4月）
   - 対象年月: `2025-05` → `true`（40歳になる年の5月開始）
   - 対象年月: `2025-06` → `true`

2. **65歳境界のテスト**
   - 生年月日: `1985-05-02` → 65歳到達前日: `2050-05-01`
   - 対象年月: `2050-04` → `true`（65歳になる年の4月が最後）
   - 対象年月: `2050-05` → `false`（65歳になる年の5月から対象外）

3. **月初生まれのテスト**
   - 生年月日: `1985-05-01` → 40歳到達前日: `2025-04-30`
   - 対象年月: `2025-03` → `false`
   - 対象年月: `2025-04` → `true`（40歳年の4月開始）

4. **境界値のテスト**
   - 生年月日: `1990-01-15` → 40歳到達前日: `2030-01-14`
   - 対象年月: `2029-12` → `false`（39歳年）
   - 対象年月: `2030-01` → `true`（40〜64歳範囲内）

5. **エッジケース**
   - 空文字・不正な日付形式 → `false`
   - 不正な年月形式 → `false`

### 4-2. 現在年月取得のテスト

**必須テストケース**:

1. **JSTの午前0時〜8時59分での実行**
   - UTCでは前日になる時間帯でも、正しく現在月が取得できること

2. **月末・月初での実行**
   - 月末の23時59分でも、月初の0時0分でも、正しい月が取得できること

### 4-3. デフォルト日付生成のテスト

**必須テストケース**:

1. **JSTの午前0時〜8時59分での実行**
   - UTCでは前日になる時間帯でも、正しく今日の日付が取得できること

2. **フォームの初期値**
   - フォームを開いたときに、正しい今日の日付がデフォルト値として設定されること

### 4-4. 年齢計算のテスト

**必須テストケース**:

1. **誕生日当日の年齢**
   - 誕生日当日に正しい年齢が計算されること

2. **月末・月初での年齢計算**
   - 月末・月初でも正しい年齢が計算されること

---

## 5. 実装時の注意事項

### 5-1. インポートの追加

各ファイルで `date-helpers.ts` から必要な関数をインポートする必要があります。

**例**:
```typescript
import { todayYmd, ymdToDateLocal, dateToYmdLocal, todayYearMonth } from '../utils/date-helpers';
```

### 5-2. タイムスタンプは変更しない

`createdAt`, `updatedAt` などのタイムスタンプは、UTC（`toISOString()`）のまま維持します。
これらは「瞬間」として一意に扱えるため、UTCで問題ありません。

### 5-3. 既存のテストの確認

修正後、既存のテストが正しく動作することを確認してください。
特に `isCareInsuranceTarget()` のテストケースは、修正前後で結果が変わらないことを確認します。

### 5-4. 段階的な実装

優先度順に段階的に実装することを推奨します：
1. 優先度1（`isCareInsuranceTarget()`）を最優先で修正
2. 優先度2（現在年月の取得）を次に修正
3. 優先度3、4は必要に応じて修正

---

## 6. 参考資料

- `src/app/utils/date-helpers.ts` - ローカル時刻ベースの日付処理関数群
- `src/app/utils/premium-calculator.ts` - 保険料計算ロジック（修正対象）
- `src/app/utils/premium-calculator.spec.ts` - `isCareInsuranceTarget()` のテストケース

---

## 7. 修正完了後の確認事項

- [ ] `isCareInsuranceTarget()` のテストが全て通過する
- [ ] 月次保険料計算で介護保険料が正しく計算される
- [ ] 賞与保険料計算で介護保険料が正しく計算される
- [ ] ダッシュボードのランキングが正しい月のデータを表示する
- [ ] シミュレーターの単月計算が正しい月を使用する
- [ ] フォームのデフォルト日付が正しく表示される
- [ ] 年齢計算が正しく動作する
- [ ] リンターエラーがない

