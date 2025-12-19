# システム整合性問題報告書

## 作成日
2025年12月

---

## 1. 日付処理のJST/UTC混在問題

### 1-1. 問題の概要
システム内で日付処理において、JST（日本標準時）とUTC（協定世界時）の混在により、日付が1日ズレる可能性がある問題が存在します。

**詳細**: `docs/general/DATE_FIXED.md` に詳細な修正指示書があります。

### 1-2. 影響範囲
- **高リスク**: `isCareInsuranceTarget()` - 40/65歳境界で介護保険対象判定が誤る可能性
- **高リスク**: 現在年月の取得 - ランキング集計やシミュレーションの対象月が1ヶ月ズレる可能性
- **中リスク**: 年齢計算 - 誕生日近辺で1日ズレる可能性

### 1-3. 現在の状況
- `isCareInsuranceTarget()` は既に `date-helpers.ts` の `ymdToDateLocal()` と `dateToYearMonthLocal()` を使用するように修正済み
- ただし、`DATE_FIXED.md` に記載されている他の修正項目（優先度2-4）は未確認

### 1-4. 推奨対応
`docs/general/DATE_FIXED.md` の優先度順に修正を実施することを推奨します。

---

## 2. 年月変換関数の重複と不整合

### 2-1. 問題の概要
年月変換（`YYYY-MM-DD` → `YYYY-MM`）を行う関数が複数箇所に存在し、実装が統一されていません。

### 2-2. 実装箇所

#### 2-2-1. `premium-calculator.ts` の `toYearMonthOrNull()`
```typescript
function toYearMonthOrNull(dateStr?: string | null): YearMonthString | null {
  if (!dateStr) return null;
  const ym = dateStr.substring(0, 7);
  // YYYY-MM 形式（ゼロ埋め必須）であることを確認
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  return ym as YearMonthString;
}
```

**問題点**:
- 月の範囲チェック（1-12）がないため、`2025-99` のような不正な月が通ってしまう可能性がある
- `date-helpers.ts` の `dateToYearMonthLocal()` と機能が重複している

#### 2-2-2. `data-quality.service.ts` の `toYearMonth()`
```typescript
private toYearMonth(dateStr: string): string {
  return dateStr.substring(0, 7);
}
```

**問題点**:
- バリデーションが一切ない
- 空文字や不正な形式でもそのまま返す
- `YearMonthString` 型ではなく `string` を返す

#### 2-2-3. `date-helpers.ts` の `dateToYearMonthLocal()`
```typescript
export function dateToYearMonthLocal(date: Date): YearMonthString {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}` as YearMonthString;
}
```

**問題点**: なし（正しい実装）

### 2-3. 推奨対応
1. `premium-calculator.ts` の `toYearMonthOrNull()` に月の範囲チェック（1-12）を追加
2. `data-quality.service.ts` の `toYearMonth()` を `date-helpers.ts` の関数を使用するように変更、または適切なバリデーションを追加
3. 可能であれば、年月変換処理を `date-helpers.ts` に統一

---

## 3. 標準報酬履歴の取得ロジックの整合性

### 3-1. 問題の概要
標準報酬履歴から標準報酬を取得する際のロジックが複数箇所に存在し、整合性が取れていない可能性があります。

### 3-2. 実装箇所

#### 3-2-1. `premium-calculator.ts` の `getStandardRewardFromHistory()`
```typescript
export function getStandardRewardFromHistory(
  histories: StandardRewardHistory[],
  yearMonth: YearMonthString
): { standardMonthlyReward: number; grade?: number } | null {
  // appliedFromYearMonth <= yearMonth を満たす履歴をフィルタ
  const applicableHistories = histories.filter(
    (h) => h.appliedFromYearMonth <= yearMonth
  );
  // appliedFromYearMonth が最新のものを取得
  const sortedHistories = [...applicableHistories].sort((a, b) => {
    if (a.appliedFromYearMonth > b.appliedFromYearMonth) return -1;
    if (a.appliedFromYearMonth < b.appliedFromYearMonth) return 1;
    return 0;
  });
  const latestHistory = sortedHistories[0];
  return {
    standardMonthlyReward: latestHistory.standardMonthlyReward,
    grade: latestHistory.grade
  };
}
```

**問題点**: なし（正しい実装）

#### 3-2-2. `employee-form-dialog.component.ts` の `pickEffectiveHistory()`
```typescript
private pickEffectiveHistory(
  histories: StandardRewardHistory[],
  asOfYm: YearMonthString
): StandardRewardHistory | null {
  if (!histories?.length) return null;
  const pastOrCurrent = histories
    .filter((h) => h.appliedFromYearMonth <= asOfYm)
    .sort((a, b) => b.appliedFromYearMonth.localeCompare(a.appliedFromYearMonth));
  if (pastOrCurrent.length) return pastOrCurrent[0];
  // 未来しかない場合などは一番新しいもの
  return [...histories].sort((a, b) => b.appliedFromYearMonth.localeCompare(a.appliedFromYearMonth))[0];
}
```

**問題点**:
- `getStandardRewardFromHistory()` とロジックが異なる
- 未来の履歴しかない場合の扱いが異なる（`pickEffectiveHistory()` は未来の履歴も返す）

### 3-3. 推奨対応
1. `employee-form-dialog.component.ts` の `pickEffectiveHistory()` を `getStandardRewardFromHistory()` に統一するか、意図的な違いがある場合はコメントで明記
2. 未来の履歴の扱いについて仕様を明確化

---

## 4. 保険料計算ロジックの整合性

### 4-1. 月次保険料と賞与保険料の計算ロジック

#### 4-1-1. 月次保険料計算 (`premium-calculator.ts`)
- 健康保険＋介護保険を合算率で計算
- 50銭ルール適用（`roundForEmployeeDeduction()`）
- 資格取得日・喪失日ベースの判定（`hasInsuranceInMonth()`）

#### 4-1-2. 賞与保険料計算 (`bonus-calculator.ts`)
- 健康保険＋介護保険を合算率で計算（月次と同じ）
- 50銭ルール適用（`roundForEmployeeDeduction()`）
- 資格取得日・喪失日ベースの判定（`hasInsuranceInMonth()`）
- 上限チェック（健保: 年度内累計573万円、厚年: 同一月累計150万円）

**整合性**: ✅ 良好（月次と賞与で同じロジックを使用）

### 4-2. 介護保険対象判定の整合性

#### 4-2-1. `isCareInsuranceTarget()` の使用箇所
- `premium-calculator.ts` - 月次保険料計算
- `bonus-calculator.ts` - 賞与保険料計算
- `monthly-premiums.page.ts` - 月次保険料ページ
- `bonus-premiums.page.ts` - 賞与保険料ページ
- `dashboard.page.ts` - ダッシュボード
- `my-page.ts` - マイページ

**整合性**: ✅ 良好（すべて同じ関数を使用）

### 4-3. 50銭ルールの適用の整合性

#### 4-3-1. `roundForEmployeeDeduction()` の使用箇所
- `premium-calculator.ts` - 月次保険料計算
- `bonus-calculator.ts` - 賞与保険料計算
- `dashboard.page.ts` - ダッシュボード（手動計算）
- `simulator.page.ts` - シミュレーター（手動計算）
- `bonus-premiums.page.ts` - 賞与保険料ページ（手動計算）
- `my-page.ts` - マイページ（手動計算）

**整合性**: ✅ 良好（すべて同じ関数を使用）

---

## 5. 資格取得日・喪失日の判定ロジックの整合性

### 5-1. `hasInsuranceInMonth()` の使用箇所
- `premium-calculator.ts` - 月次保険料計算、`hasSocialInsuranceInMonth()` の内部実装
- `bonus-calculator.ts` - 賞与保険料計算
- `monthly-premiums.page.ts` - 月次保険料ページ
- `bonus-premiums.page.ts` - 賞与保険料ページ
- `dashboard.page.ts` - ダッシュボード
- `my-page.ts` - マイページ

**整合性**: ✅ 良好（すべて同じ関数を使用）

### 5-2. 判定ロジックの仕様
- 取得日が属する月から対象
- 喪失日が属する月は対象外（前月分まで）
- 同月得喪の場合はその月だけ対象
- 取得日が未入力の場合は対象外（`hireDate` へのフォールバックなし）

**整合性**: ✅ 良好（仕様が明確で一貫している）

---

## 6. データ品質チェックの整合性

### 6-1. `data-quality.service.ts` の `toYearMonth()` メソッド

**問題点**:
- バリデーションが一切ない
- 空文字や不正な形式でもそのまま返す
- `YearMonthString` 型ではなく `string` を返す

**影響範囲**:
- データ品質チェックの結果が不正確になる可能性
- 不正な年月形式のデータがチェックを通過してしまう可能性

### 6-2. 推奨対応
1. `toYearMonth()` メソッドに適切なバリデーションを追加
2. または、`date-helpers.ts` の関数を使用するように変更
3. 戻り値の型を `YearMonthString` に統一

---

## 7. まとめ

### 7-1. 整合性が取れている項目
- ✅ 月次保険料と賞与保険料の計算ロジック（同じ関数を使用）
- ✅ 介護保険対象判定（`isCareInsuranceTarget()` を統一使用）
- ✅ 50銭ルールの適用（`roundForEmployeeDeduction()` を統一使用）
- ✅ 資格取得日・喪失日の判定（`hasInsuranceInMonth()` を統一使用）

### 7-2. 整合性に問題がある項目
- ⚠️ 年月変換関数の重複と不整合
  - `premium-calculator.ts` の `toYearMonthOrNull()` - 月の範囲チェック不足
  - `data-quality.service.ts` の `toYearMonth()` - バリデーションなし
- ⚠️ 標準報酬履歴の取得ロジックの不整合
  - `employee-form-dialog.component.ts` の `pickEffectiveHistory()` と `getStandardRewardFromHistory()` のロジックが異なる
- ⚠️ 日付処理のJST/UTC混在問題（一部修正済み、残りの修正が必要）

### 7-3. 優先度別の推奨対応

#### 優先度1（高）: 年月変換関数の統一とバリデーション強化
1. `premium-calculator.ts` の `toYearMonthOrNull()` に月の範囲チェック（1-12）を追加
2. `data-quality.service.ts` の `toYearMonth()` を適切なバリデーション付きの実装に変更

#### 優先度2（中）: 標準報酬履歴取得ロジックの統一
1. `employee-form-dialog.component.ts` の `pickEffectiveHistory()` を `getStandardRewardFromHistory()` に統一するか、意図的な違いがある場合はコメントで明記

#### 優先度3（低）: 日付処理のJST/UTC混在問題の残りの修正
1. `docs/general/DATE_FIXED.md` の優先度2-4の項目を確認し、必要に応じて修正

---

## 8. 参考資料
- `docs/general/DATE_FIXED.md` - 日付処理のJST/UTC混在問題修正指示書
- `src/app/utils/premium-calculator.ts` - 月次保険料計算ロジック
- `src/app/utils/bonus-calculator.ts` - 賞与保険料計算ロジック
- `src/app/utils/date-helpers.ts` - 日付処理ヘルパー関数
- `src/app/services/data-quality.service.ts` - データ品質チェックサービス

