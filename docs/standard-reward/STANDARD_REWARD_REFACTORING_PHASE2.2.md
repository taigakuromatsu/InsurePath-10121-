# Phase2.2 実装指示書：月次保険料計算ロジックの厳密化

## 改訂履歴
- 2025年1月: 初版作成
- 2025年1月: 修正版（資格取得日の未入力時の扱い、hasSocialInsuranceInMonthの役割明確化、MonthlyPremiumAmountsのtotal〜の扱い明確化）

---

## 1. 概要 (Overview)

### 1-1. Phase2.5 の目的

Phase2.5 では、既に実装済みの標準報酬・等級の分離（健康保険／厚生年金で別々に管理）と保険料率マスタを前提に、**月次保険料計算ロジックを正式ルールに沿って厳密化する**ことを目的とします。

具体的には：

1. 「50銭ルール」「月末退職／月中退職」「取得／喪失月」の扱いを明文化したうえで実装する
2. 健康保険と介護保険の料率を合算して計算する
3. 月次保険料ページの表示内容（行レベル・フッター集計）を「納入告知額」との関係が分かりやすい形に整理する

### 1-2. Phase1・Phase2 の結果を前提とした「今の世界観」

Phase1・Phase2 の実装により、以下の状態になっています：

- **計算ロジック**: `premium-calculator.ts` は既に新ロジックに置き換え済み（Phase1）
  - 健康保険: `Employee.healthStandardMonthly` を使用
  - 厚生年金: `Employee.pensionStandardMonthly` を使用
  - 介護保険: `Employee.healthStandardMonthly` を使用（40〜64歳のみ）
  - ただし、健康保険と介護保険が別々に計算されている（Phase2.5 で修正）

- **データモデル**: `Employee` 型が更新済み（Phase1）
  - `healthGrade` / `healthStandardMonthly` / `healthGradeSource`
  - `pensionGrade` / `pensionStandardMonthly` / `pensionGradeSource`

- **月次保険料スナップショット**: `MonthlyPremium` に `healthStandardMonthly` / `pensionStandardMonthly` が保存される

### 1-3. Phase2.5 で実現する状態

Phase2.5 完了時点で：

- 保険料の対象となる従業員の判定ロジックが正式ルールに沿って実装される（取得日・喪失月の扱い）
- 健康保険と介護保険の料率が合算され、正しく計算される
- 従業員負担額に50銭ルールが適用される
- 納入告知額の計算ロジック（全額合計の円未満切り捨て）が実装される
- 月次保険料ページの表示内容が「納入告知額」との関係が分かりやすい形に整理される

---

## 2. 対象ファイル (Scope / Target Files)

### 2-1. 主な変更対象ファイル

| ファイルパス | 変更内容 | 優先度 |
|------------|---------|--------|
| `src/app/utils/premium-calculator.ts` | 健康＋介護を合算率で計算、50銭ルール適用、full/employee/employer(参考)を返す構造に整理 | **必須** |
| `src/app/services/monthly-premiums.service.ts` | 行レベルの全額（amounts.healthCareFull / amounts.pensionFull）を集計し、納入告知額（端数前／端数後）を算出 | **必須** |
| `src/app/pages/premiums/monthly/monthly-premiums.page.ts` | 行レベルに full 列＋会社負担（参考）を追加、フッター／サマリーカードに納入告知額まわり一式を表示 | **必須** |
| `src/app/pages/premiums/monthly/monthly-premiums.page.html` | UIテンプレートの更新（full列追加、フッター更新、説明文追加） | **必須** |

### 2-2. 参照のみ（変更なし）のファイル

| ファイルパス | 確認内容 |
|------------|---------|
| `src/app/types.ts` | Phase1 で更新済み、Phase2.5 では参照のみ |
| `src/app/services/masters.service.ts` | 料率マスタの取得に使用 |

---

## 3. 保険料の対象となる従業員の判定ロジック

### 3-1. 基本ルール（取得・喪失）

**基本ルール:**
- **取得日が属する月から**、その月分の保険料が発生する
- **喪失日が属する月の前月分まで**保険料が発生する
  - → 喪失月そのものの保険料は発生しない

### 3-2. 具体例（2025年3月分の月次保険料）

| ケース | 取得日 | 喪失日 | 3月分の保険料 | 備考 |
|--------|--------|--------|--------------|------|
| ケース1 | 2025/3/10 | - | **発生する** | 取得月なので対象 |
| ケース2 | 2025/2/15 | 2025/3/20 | **発生しない** | 喪失月が3月なので、2月まで |
| ケース3 | 2025/2/15 | 2025/3/31（喪失4/1扱い） | **発生する** | 喪失月が4月なので、3月分は対象 |

### 3-3. 実装イメージ

対象年月 `targetYm`（例: `2025-03`）を決める。

各社員ごとに、健康保険・厚生年金それぞれについて：

- `acquisitionDate`（資格取得日）
- `lossDate`（資格喪失日 or null）

を参照し、

- 「`acquisitionDate` が存在し、その属する年月 <= `targetYm`」かつ
- 「`lossDate` が null または `lossDate` の属する年月 > `targetYm`」

を満たす場合に、その保険の対象者として月次保険料計算に含める。

**重要**: 
- この判定を、健康保険（＋介護保険）と厚生年金で**別々に行う**（Phase1/2 で分離した標準報酬・等級を活かす）
- **資格取得日が未入力（null/undefined）の場合、その保険種別については加入なしとして扱い、月次保険料の対象外とします**
- `hireDate` / `retireDate` へのフォールバックは行いません

### 3-4. `hasSocialInsuranceInMonth` 関数の修正

**現状の問題:**
- `premium-calculator.ts` の `hasSocialInsuranceInMonth` 関数（75-108行目）で、`ym > end` という条件になっている
- これだと喪失月も含まれてしまう可能性がある

**修正後のロジック:**
```typescript
/**
 * 資格取得日・喪失日ベースで、指定年月に該当保険種別の資格があるかどうか判定する。
 * 
 * 基本ルール:
 * - 取得日が属する月から、その月分の保険料が発生する
 * - 喪失日が属する月の前月分まで保険料が発生する（喪失月そのものの保険料は発生しない）
 * 
 * 重要:
 * - 資格取得日が未入力（null/undefined）の場合、その保険種別については常に false を返す
 * - hireDate / retireDate へのフォールバックは行わない
 * - 喪失日が null の場合 → 「喪失なし」として扱う（取得月以降すべて対象）
 * 
 * @param employee - 従業員情報
 * @param yearMonth - 対象年月（例: '2025-03'）
 * @param insuranceKind - 保険種別（'health' | 'pension'）
 * @returns 対象年月に該当保険種別の資格がある場合 true
 * 
 * @remarks
 * 実装では、Employee 型（types.ts）の実際のフィールド名に合わせて実装すること。
 * 実際のフィールド名:
 * - 健康保険: healthQualificationDate, healthLossDate
 * - 厚生年金: pensionQualificationDate, pensionLossDate
 */
function hasInsuranceInMonth(
  employee: Employee,
  yearMonth: YearMonthString,
  insuranceKind: 'health' | 'pension'
): boolean {
  const ym = yearMonth;

  // 保険種別に応じて資格取得日・喪失日を取得
  // 実装では、Employee 型（types.ts）の実際のフィールド名に合わせて実装すること
  const acquisitionDate = insuranceKind === 'health'
    ? employee.healthQualificationDate
    : employee.pensionQualificationDate;
  
  const lossDate = insuranceKind === 'health'
    ? employee.healthLossDate
    : employee.pensionLossDate;

  // 資格取得日が未入力の場合、その保険種別については対象外
  if (!acquisitionDate) {
    return false;
  }

  // 取得日の属する年月
  const acquisitionYearMonth = toYearMonthOrNull(acquisitionDate);
  
  // 喪失日の属する年月（null の場合は「喪失なし」として扱う）
  const lossYearMonth = toYearMonthOrNull(lossDate);

  // 取得月より前の場合は対象外
  if (acquisitionYearMonth && ym < acquisitionYearMonth) {
    return false;
  }

  // 喪失月が設定されている場合、喪失月そのものは対象外
  // 喪失月の前月までが対象
  if (lossYearMonth && ym >= lossYearMonth) {
    return false;
  }

  return true;
}

/**
 * 健康保険と厚生年金それぞれについて、指定年月に資格があるかどうか判定する。
 * 
 * 用途:
 * - 「その月に健康保険または厚生年金のいずれかに加入しているかどうか」をざっくり判定するためのユーティリティ
 * - 例えば「この月の従業員一覧に載せるかどうかのフィルタ」など、表示制御の用途で使用する
 * 
 * 注意:
 * - 保険種別ごとの計算ロジックでは、必ず hasInsuranceInMonth(employee, ym, 'health' | 'pension') を使用すること
 * - hasSocialInsuranceInMonth の結果が true だからといって、健康保険と厚生年金の両方を一律に計算する、という使い方はしないこと
 * - 特に 70 歳以上など厚生年金がないケースでは、health のみ true / pension は false になりうるため、この区別を前提とした実装にすること
 * 
 * @param employee - 従業員情報
 * @param yearMonth - 対象年月（例: '2025-03'）
 * @returns 健康保険または厚生年金のいずれかに加入している場合 true
 */
function hasSocialInsuranceInMonth(
  employee: Employee,
  yearMonth: YearMonthString
): boolean {
  const healthOk = hasInsuranceInMonth(employee, yearMonth, 'health');
  const pensionOk = hasInsuranceInMonth(employee, yearMonth, 'pension');

  // どちらかの社会保険で資格期間内なら、その月は「社会保険対象」とみなす
  return healthOk || pensionOk;
}
```

### 3-5. テストケース

以下のテストケースで動作確認する：

```typescript
describe('hasInsuranceInMonth', () => {
  const employee: Employee = {
    id: 'test',
    officeId: 'office1',
    name: 'テスト',
    // ... その他の必須フィールド
  };

  it('取得日が3/10の場合、3月分から保険料が発生する', () => {
    const emp = {
      ...employee,
      healthQualificationDate: '2025-03-10',
      healthLossDate: null
    };
    expect(hasInsuranceInMonth(emp, '2025-03', 'health')).toBe(true);
    expect(hasInsuranceInMonth(emp, '2025-02', 'health')).toBe(false);
  });

  it('喪失日が3/20の場合、3月分の保険料は発生しない（2月まで）', () => {
    const emp = {
      ...employee,
      healthQualificationDate: '2025-02-15',
      healthLossDate: '2025-03-20'
    };
    expect(hasInsuranceInMonth(emp, '2025-02', 'health')).toBe(true);
    expect(hasInsuranceInMonth(emp, '2025-03', 'health')).toBe(false);
  });

  it('退職日が3/31で喪失日が4/1扱いの場合、3月分は対象', () => {
    const emp = {
      ...employee,
      healthQualificationDate: '2025-02-15',
      healthLossDate: '2025-04-01' // 喪失月は4月
    };
    expect(hasInsuranceInMonth(emp, '2025-03', 'health')).toBe(true);
    expect(hasInsuranceInMonth(emp, '2025-04', 'health')).toBe(false);
  });

  it('資格取得日が未入力の場合、その保険種別は対象外', () => {
    const emp = {
      ...employee,
      healthQualificationDate: undefined,
      healthLossDate: null
    };
    expect(hasInsuranceInMonth(emp, '2025-03', 'health')).toBe(false);
  });

  it('資格取得日が未入力でも、他の保険種別は判定可能', () => {
    const emp = {
      ...employee,
      healthQualificationDate: undefined,
      healthLossDate: null,
      pensionQualificationDate: '2025-02-15',
      pensionLossDate: null
    };
    expect(hasInsuranceInMonth(emp, '2025-03', 'health')).toBe(false);
    expect(hasInsuranceInMonth(emp, '2025-03', 'pension')).toBe(true);
  });
});
```

**重要**: 
- 実装では、Employee 型（types.ts）の実際のフィールド名に合わせて実装すること
- 実際のフィールド名: `healthQualificationDate`, `healthLossDate`, `pensionQualificationDate`, `pensionLossDate`
- **資格取得日が未入力（null/undefined）の場合、その保険種別については加入なしとして扱い、月次保険料の対象外とします**
- `hireDate` / `retireDate` へのフォールバックは行いません

**従業員台帳の入力フォーム側での対応**:
- 従業員台帳の「資格取得日（健保）」「資格取得日（厚年）」項目について、以下のようなヘルプテキストを表示する：
  - 「未入力の場合、その保険種別は未加入として扱われ、月次保険料計算の対象外になります」
- この説明文により、ユーザーが資格取得日を入力する重要性を理解できるようにする

---

## 4. 計算対象・料率の扱い

### 4-1. 料率の取得

**対象**: 事業所＋対象年月ごとの料率マスタ

既存のマスタ画面／サービス（例：`HealthRateTable`, `PensionRateTable`）から、以下を取得する：

- 健康保険料率 `healthRate`（例：9.91% = 0.0991）
- 介護保険料率 `careRate`（例：1.59% = 0.0159）
- 厚生年金保険料率 `pensionRate`（例：18.3% = 0.183）

### 4-2. 健康保険＋介護保険（合算料率）

**各社員について:**
- 健康保険標準報酬月額 `healthStandardReward`
- 介護保険対象フラグ `hasCare`（40〜64歳かつ料率あり）

**使用する総料率:**
```typescript
const healthTotalRate = hasCare ? (healthRate + careRate) : healthRate;
```

**例）東京都 2025年3月分**
- `healthRate = 9.91%`
- `careRate = 1.59%`
- 介護ありの人だけ `11.5%` を使用

**重要**: 健康保険と介護保険を**別々に計算するのではなく、合算料率で1回だけ計算する**。

### 4-3. 厚生年金

**各社員について:**
- 厚生年金標準報酬月額 `pensionStandardReward`

**使用する料率:**
```typescript
const pensionTotalRate = pensionRate;  // 例：18.3%
```

---

## 5. 行レベルの計算ロジック（共通パターン）

以下は「健康保険＋介護保険」「厚生年金」どちらにも共通の考え方。違いは「使う標準報酬・等級」と「使う料率」だけ。

### 5-1. 行レベルで計算する値

#### 標準報酬月額・等級
- 健康保険側の標準報酬／等級（健康保険セクション）
- 厚生年金側の標準報酬／等級（厚生年金セクション）

#### 全額（full）
- **定義**: 事業主負担＋被保険者負担の合計額（端数処理前）
- **計算式**: `fullAmount = 標準報酬月額 × 対象の総料率（healthTotalRate or pensionTotalRate）`
- **小数点以下はそのまま保持**（例：13279.4円）

#### 従業員負担額（控除額）
- 基本的には「全額のちょうど半額」をベースにする：`employeeShareRaw = fullAmount / 2`
- そのうえで、**50銭ルールによる端数処理**を行う（詳細は 6章）

#### 会社負担額（個人単位／参考）
- 個人レベルでは「参考（概算）」としてのみ表示
- 計算式は、`employerShareReference = fullAmount - employeeShareRounded`
- ただし、画面上のラベル等で「※参考値（概算）」であることを明示する

### 5-2. 計算結果の構造

`MonthlyPremiumCalculationResult` の `amounts` フィールドを以下のように拡張する：

```typescript
export interface MonthlyPremiumAmounts {
  // 健康保険＋介護保険（合算）
  healthCareFull: number;        // 全額（端数処理前）
  healthCareEmployee: number;    // 従業員負担額（50銭ルール適用後）
  healthCareEmployer: number;     // 会社負担額（参考値）

  // 厚生年金
  pensionFull: number;            // 全額（端数処理前）
  pensionEmployee: number;        // 従業員負担額（50銭ルール適用後）
  pensionEmployer: number;        // 会社負担額（参考値）

  // 合計（行レベルの参考値）
  // 注意: これらは行内で healthCare + pension をまとめた参考値であり、
  // フッターの「会社負担合計」などの正式な集計には使用しない
  totalFull: number;              // 全額合計（端数処理前、行レベル参考値）
  totalEmployee: number;          // 従業員負担合計（行レベル参考値）
  totalEmployer: number;         // 会社負担合計（行レベル参考値、正式な集計には使用しない）
  
  // 重要: totalFull / totalEmployee / totalEmployer は行レベルの参考値であり、
  // フッターの「会社負担合計」などの正式な集計には使用しません。
  // 正式な「会社負担合計」は、必ず「納入告知額（sumFullRoundedDown） − 従業員負担合計（employeeTotal）」で算出してください。
  // 行レベルの totalEmployer を単純合計して「会社負担合計」とする実装は NG です。

  // 後方互換のため、既存フィールドも維持（deprecated）
  /** @deprecated 健康保険と介護保険を分離しない。healthCareFull を使用すること。 */
  healthTotal: number;
  healthEmployee: number;
  healthEmployer: number;
  /** @deprecated 介護保険を分離しない。healthCareFull を使用すること。 */
  careTotal: number;
  careEmployee: number;
  careEmployer: number;
  pensionTotal: number;
}
```

---

## 6. 50銭ルール（従業員負担額の端数処理）

### 6-1. 適用対象

- 対象は「従業員負担額（給与から控除する被保険者負担分）」のみ
- 「全額」や「納入告知額」自体には50銭ルールは適用しない

### 6-2. ルール

事業主が給与（賞与）から被保険者負担分を控除する場合、控除額の計算において、被保険者負担分の端数が：

- **50銭以下** → 切り捨て
- **50銭超** → 切り上げて1円

とする。

**例:**
- 12,345.50 → 12,345 円を控除
- 12,345.51 → 12,346 円を控除

### 6-3. 実装イメージ

```typescript
/**
 * 従業員負担額に50銭ルールを適用する
 * 
 * ルール:
 * - 50銭以下 → 切り捨て
 * - 50銭超 → 切り上げて1円
 * 
 * @param amount - 端数処理前の従業員負担額（例: 12345.50）
 * @returns 50銭ルール適用後の従業員負担額（例: 12345 または 12346）
 */
function roundForEmployeeDeduction(amount: number): number {
  const integer = Math.floor(amount);           // 円部分
  const fractional = amount - integer;           // 小数部分
  
  // 実装では小数誤差に注意して cent（0.01円単位）で比較する
  const cent = Math.round(fractional * 100);    // 銭単位に変換（誤差対策）
  
  if (cent <= 50) {
    return integer;
  } else {
    return integer + 1;
  }
}
```

**使用例:**
```typescript
const employeeShareRaw = fullAmount / 2;
const employeeShareRounded = roundForEmployeeDeduction(employeeShareRaw);
```

---

## 7. 集計ロジック（フッター・集計カード）

健康保険＋介護保険、厚生年金それぞれについて、同じパターンで集計する。

**重要**: 本章のコード例では、`MonthlyPremiumAmounts`（5-2で定義）の具体的なフィールド名（`healthCareFull`, `pensionFull` など）を直接参照しています。実装では、`monthly-premiums.page.ts` 側で view-model を作成し、これらの値を `row.fullAmount` / `row.employeeShareRounded` などのプロパティにラップして使用しても構いません。

### 7-1. 行から集計に使う値

各セクションごとに、以下のフィールドを使用します：

**健康保険・介護保険セクション:**
- `amounts.healthCareFull` … i番目の社員の「全額」（端数処理前）
- `amounts.healthCareEmployee` … i番目の社員の「従業員負担額」（50銭ルール適用後）

**厚生年金セクション:**
- `amounts.pensionFull` … i番目の社員の「全額」（端数処理前）
- `amounts.pensionEmployee` … i番目の社員の「従業員負担額」（50銭ルール適用後）

### 7-2. 集計値

**重要**: フッター／サマリーカードで表示する合計値は、必ず以下のロジックを使用します。`MonthlyPremiumAmounts.totalFull` / `totalEmployee` / `totalEmployer` は行レベルの参考値であり、正式な集計には使用しません。

以下のコード例では、健康保険・介護保険セクションと厚生年金セクションで同じパターンを使用しますが、参照するフィールド名が異なります。

#### 従業員負担合計

**健康保険・介護保険セクション:**
```typescript
const employeeTotal = rows.reduce((sum, row) => sum + row.amounts.healthCareEmployee, 0);
```

**厚生年金セクション:**
```typescript
const employeeTotal = rows.reduce((sum, row) => sum + row.amounts.pensionEmployee, 0);
```

- 各行の従業員負担額（50銭ルール適用後）を合計した値

#### 合計（納入告知額） – 端数処理前

**健康保険・介護保険セクション:**
```typescript
const sumFull = rows.reduce((sum, row) => sum + row.amounts.healthCareFull, 0);
```

**厚生年金セクション:**
```typescript
const sumFull = rows.reduce((sum, row) => sum + row.amounts.pensionFull, 0);
```

- 各行の全額（端数処理前）を合計した値
- 小数点付きの合計をそのまま持つ
- 画面には「合計（端数処理前）」などのラベルで表示
- 少数第2位くらいまで表示（例：72,435.40円）

#### 合計（納入告知額） – 端数処理後（正式な納入告知額）
```typescript
const sumFullRoundedDown = Math.floor(sumFull);  // 円未満切り捨て
```
- これが「納入告知額」として扱われる金額

#### 会社負担合計
```typescript
const employerTotal = sumFullRoundedDown - employeeTotal;
```
- 「納入告知額 － 従業員負担合計」という関係がユーザーに分かりやすいように、ラベルや説明文で明示する
- **重要**: `MonthlyPremiumAmounts.totalEmployer` を単純合計して「会社負担合計」とする実装は NG です
- 正式な「会社負担合計」は、必ず「納入告知額（`sumFullRoundedDown`） − 従業員負担合計（`employeeTotal`）」で算出してください

### 7-3. 画面表示イメージ（フッター／サマリーカード）

各保険種別ごとに、例えば以下のようなカード・フッターを表示：

```
【健康保険・介護保険】
従業員負担合計: 123,456 円
会社負担合計: 234,567 円
合計（納入告知額）:
  端数処理前: 358,023.40 円
  納入告知額: 358,023 円（円未満切り捨て）

【厚生年金】
従業員負担合計: 456,789 円
会社負担合計: 456,789 円
合計（納入告知額）:
  端数処理前: 913,578.20 円
  納入告知額: 913,578 円（円未満切り捨て）
```

補足として：
- ※「納入告知額」は、行レベルの「全額」を全員分足し合わせ、円未満を切り捨てた金額です。
- ※ 従業員負担額は、給与から控除する際の50銭ルール（50銭以下切り捨て／50銭超切り上げ）を適用しています。

といった説明文を付けておく。

---

## 8. 月次保険料ページの画面仕様（完成イメージ）

### 8-1. セクション構成

- タブ or セクション分け：
  - 「健康保険・介護保険」
  - 「厚生年金」
- それぞれに同じレイアウトの表＋フッターを持つ

### 8-2. 行レベルで表示する項目（共通）

各セクションの行には、最低限以下を表示：

- 従業員名
- 標準報酬月額
- 等級
- （健康保険側のみ）介護保険対象フラグ or「介護あり」アイコンなど
- **「全額」** ← 新規追加
  - 健康保険・介護保険セクション: `amounts.healthCareFull`
  - 厚生年金セクション: `amounts.pensionFull`
- **「従業員負担額（控除額）」**
  - 健康保険・介護保険セクション: `amounts.healthCareEmployee`
  - 厚生年金セクション: `amounts.pensionEmployee`
- **「会社負担額（参考）」** ← 新規追加（※参考値と明記）
  - 健康保険・介護保険セクション: `amounts.healthCareEmployer`
  - 厚生年金セクション: `amounts.pensionEmployer`

### 8-3. フッター／サマリーカード

各セクション下部に以下を表示：

- 従業員負担合計
- 会社負担合計
- 合計（納入告知額）
  - 端数処理前合計（`sumFull`）
  - 円未満切り捨て後の納入告知額（`sumFullRoundedDown`）

---

## 9. 実装ステップ (Step-by-step Plan)

### ステップ1: `premium-calculator.ts` の修正

**目的**: 健康＋介護を合算率で計算、50銭ルール適用、full/employee/employer(参考)を返す構造に整理

**対象ファイル**:
- `src/app/utils/premium-calculator.ts`

**実施内容**:
1. `roundForEmployeeDeduction()` 関数を追加（50銭ルール実装）
2. `hasInsuranceInMonth()` 関数を追加（保険種別ごとの判定）
   - 資格取得日が未入力の場合は false を返す（hireDate へのフォールバックは行わない）
   - 実装では、Employee 型（types.ts）の実際のフィールド名（`healthQualificationDate`, `pensionQualificationDate` など）に合わせて実装すること
3. `hasSocialInsuranceInMonth()` 関数を修正（新しい `hasInsuranceInMonth()` を使用）
   - この関数は表示制御の用途に限定し、保険種別ごとの計算ロジックでは使用しない
4. `calculateMonthlyPremiumForEmployee()` 関数を修正：
   - **保険種別ごとの計算では、必ず `hasInsuranceInMonth(employee, ym, 'health' | 'pension')` を使用すること**
   - 健康保険と介護保険を別々に計算するのではなく、合算料率で1回だけ計算
   - `healthCareFull`, `healthCareEmployee`, `healthCareEmployer` を計算
   - `pensionFull`, `pensionEmployee`, `pensionEmployer` を計算
   - `totalFull`, `totalEmployee`, `totalEmployer` を追加（行レベルの参考値として）
   - 既存フィールド（`healthTotal`, `careTotal` など）は後方互換のため維持（deprecated マーク）

**確認事項**:
- 50銭ルールが正しく動作するか
- 健康＋介護の合算料率が正しく計算されるか
- 既存のコードに影響がないか

---

### ステップ2: `hasSocialInsuranceInMonth` の修正

**目的**: 取得／喪失ロジックを新仕様に合わせる

**対象ファイル**:
- `src/app/utils/premium-calculator.ts`

**実施内容**:
1. `hasInsuranceInMonth()` 関数を追加（保険種別ごとの判定）
   - 資格取得日が未入力の場合は false を返す（hireDate へのフォールバックは行わない）
   - 実装では、Employee 型（types.ts）の実際のフィールド名に合わせて実装すること
2. `hasSocialInsuranceInMonth()` 関数を修正（新しい `hasInsuranceInMonth()` を使用）
   - この関数は表示制御の用途に限定し、保険種別ごとの計算ロジックでは使用しないことを明記
3. テストケースを追加（取得日・喪失日の各パターン、資格取得日が未入力の場合）

**確認事項**:
- 取得日が属する月から保険料が発生するか
- 喪失日が属する月の前月分まで保険料が発生するか（喪失月そのものは発生しない）
- テストケースが正しく動作するか

---

### ステップ3: `monthly-premiums.service.ts` の修正

**目的**: fullAmount を集計し、納入告知額（端数前／端数後）を算出

**対象ファイル**:
- `src/app/services/monthly-premiums.service.ts`

**実施内容**:
1. `fromCalculationResult()` メソッドを修正：
   - 新しい `amounts` フィールド（`healthCareFull`, `pensionFull`, `totalFull` など）を保存
   - 既存フィールドも後方互換のため維持
2. 集計ロジックを追加（必要に応じて）：
   - `sumFull`（端数処理前合計）← 各セクションごとに、行の `amounts.healthCareFull`（健保・介護）または `amounts.pensionFull`（厚年）を合計
   - `sumFullRoundedDown`（納入告知額：円未満切り捨て）
   - `employeeTotal`（従業員負担合計）← 各セクションごとに、行の `amounts.healthCareEmployee`（健保・介護）または `amounts.pensionEmployee`（厚年）を合計
   - `employerTotal`（会社負担合計）← `sumFullRoundedDown - employeeTotal`
   - **重要**: `MonthlyPremiumAmounts.totalEmployer` を単純合計して「会社負担合計」とする実装は NG

**確認事項**:
- 新しいフィールドが正しく保存されるか
- 集計ロジックが正しく動作するか

---

### ステップ4: `monthly-premiums.page.ts` / `.html` の修正

**目的**: 行レベルに full 列＋会社負担（参考）を追加、フッター／サマリーカードに納入告知額まわり一式を表示

**対象ファイル**:
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts`
- `src/app/pages/premiums/monthly/monthly-premiums.page.html`

**実施内容**:
1. テーブルの列定義を更新：
   - 「全額」列を追加
   - 「会社負担額（参考）」列を追加
   - 既存の列は維持（後方互換）
2. フッター／サマリーカードを追加：
   - 従業員負担合計
   - 会社負担合計
   - 合計（納入告知額）
     - 端数処理前合計（`sumFull`）
     - 円未満切り捨て後の納入告知額（`sumFullRoundedDown`）
3. 説明文を追加：
   - 「納入告知額」の説明
   - 「50銭ルール」の説明
   - 「会社負担額（参考）」の説明

**確認事項**:
- 新しい列が正しく表示されるか
- フッターの集計が正しく表示されるか
- 説明文が適切に表示されるか

---

### ステップ5: テスト

**目的**: 実装が正しく動作することを確認

**対象ファイル**:
- `src/app/utils/premium-calculator.spec.ts`（新規作成または既存を更新）
- `src/app/services/monthly-premiums.service.spec.ts`（新規作成または既存を更新）

**実施内容**:
1. `hasInsuranceInMonth()` のテストケースを追加：
   - 取得日が3/10の場合、3月分から保険料が発生する
   - 喪失日が3/20の場合、3月分の保険料は発生しない（2月まで）
   - 退職日が3/31で喪失日が4/1扱いの場合、3月分は対象
2. `roundForEmployeeDeduction()` のテストケースを追加：
   - 12,345.50 → 12,345 円
   - 12,345.51 → 12,346 円
   - 12,345.49 → 12,345 円
3. `calculateMonthlyPremiumForEmployee()` のテストケースを追加：
   - 健康＋介護の合算料率が正しく計算されるか
   - 50銭ルールが正しく適用されるか
   - `amounts.healthCareFull` / `amounts.pensionFull` が正しく計算されるか

**確認事項**:
- すべてのテストケースがパスするか
- エッジケースが正しく処理されるか

---

## 10. テスト観点

### 10-1. `hasInsuranceInMonth()` のテスト

#### 取得日の扱い

1. **正常系**
   - 取得日が3/10の場合、3月分から保険料が発生する
   - 取得日が3/1の場合、3月分から保険料が発生する
   - 取得日が3/31の場合、3月分から保険料が発生する

2. **取得月より前**
   - 取得日が4/1の場合、3月分の保険料は発生しない

#### 喪失日の扱い

1. **正常系**
   - 喪失日が3/20の場合、3月分の保険料は発生しない（2月まで）
   - 喪失日が3/1の場合、3月分の保険料は発生しない（2月まで）
   - 喪失日が3/31の場合、3月分の保険料は発生しない（2月まで）

2. **月末退職（喪失4/1扱い）**
   - 退職日が3/31で喪失日が4/1扱いの場合、3月分は対象
   - 喪失月が4月なので、3月分は対象

3. **喪失日が未設定**
   - 喪失日が null の場合、取得月以降すべての月が対象

4. **資格取得日が未入力**
   - 資格取得日が null/undefined の場合、その保険種別については常に false
   - hireDate へのフォールバックは行わない

### 10-2. `roundForEmployeeDeduction()` のテスト

1. **正常系**
   - 12,345.50 → 12,345 円（50銭以下なので切り捨て）
   - 12,345.51 → 12,346 円（50銭超なので切り上げ）
   - 12,345.49 → 12,345 円（50銭以下なので切り捨て）

2. **境界値**
   - 12,345.00 → 12,345 円
   - 12,345.99 → 12,346 円

3. **浮動小数誤差対策**
   - 12,345.5000000001 → 12,345 円（cent で比較することで誤差を回避）

### 10-3. `calculateMonthlyPremiumForEmployee()` のテスト

1. **健康＋介護の合算料率**
   - 介護対象の場合、`healthRate + careRate` で計算される
   - 介護対象外の場合、`healthRate` のみで計算される

2. **50銭ルールの適用**
   - 従業員負担額に50銭ルールが適用される
   - 全額には50銭ルールが適用されない

3. **fullAmount の計算**
   - `amounts.healthCareFull` / `amounts.pensionFull = 標準報酬月額 × 対象の総料率` が正しく計算される
   - 小数点以下がそのまま保持される

### 10-4. 集計ロジックのテスト

1. **従業員負担合計**
   - 各行の `amounts.healthCareEmployee` または `amounts.pensionEmployee` を合計した値が正しい

2. **納入告知額**
   - `sumFull`（端数処理前合計）が正しく計算される
     - 健康保険・介護保険セクション: 各行の `amounts.healthCareFull` の合計
     - 厚生年金セクション: 各行の `amounts.pensionFull` の合計
   - `sumFullRoundedDown`（円未満切り捨て）が正しく計算される

3. **会社負担合計**
   - `employerTotal = sumFullRoundedDown - employeeTotal` が正しく計算される
   - `MonthlyPremiumAmounts.totalEmployer` を単純合計した値ではないことを確認

---

## 11. 懸念点・要確認事項

### 11-1. 後方互換性

**懸念点**: 既存の `MonthlyPremium` レコードに新しいフィールドが存在しない場合、どう扱うか

**提案**:
- 既存フィールド（`healthTotal`, `careTotal` など）は後方互換のため維持
- 新しいフィールド（`healthCareFull`, `pensionFull` など）は optional として扱う
- 既存データの移行は不要（新規計算時に自動的に新しいフィールドが設定される）

**要確認**: 既存データの移行が必要かどうか

---

### 11-2. UIの表示順序

**懸念点**: 健康保険と介護保険を1つのセクションとして扱う場合、UIの表示順序をどうするか

**提案**:
- 「健康保険・介護保険」セクションと「厚生年金」セクションをタブ or セクション分けで表示
- 各セクション内で「全額」「従業員負担額」「会社負担額（参考）」を表示

**要確認**: UIの表示順序に要望があるかどうか

---

### 11-3. 会社負担額の表示

**懸念点**: 個人レベルの会社負担額を「参考値（概算）」として表示する場合、ユーザーが混乱しないか

**提案**:
- ラベルに「※参考値（概算）」を明記
- フッターの「会社負担合計」は正式な値（納入告知額 - 従業員負担合計）として表示
- 説明文で「個人の会社負担額は概算値であり、正式な会社負担額はフッターの集計値を参照してください」と明記

**要確認**: ユーザーの理解度に合わせて説明文を調整する

---

### 11-4. 資格取得日の未入力時の扱い

**方針**:
- 資格取得日が未入力の場合、その保険種別については加入なしとして扱い、月次保険料の対象外とする
- `hireDate` / `retireDate` へのフォールバックは行わない

**従業員台帳の入力フォーム側での対応**:
- 従業員台帳の「資格取得日（健保）」「資格取得日（厚年）」項目について、以下のようなヘルプテキストを表示する：
  - 「未入力の場合、その保険種別は未加入として扱われ、月次保険料計算の対象外になります」
- この説明文により、ユーザーが資格取得日を入力する重要性を理解できるようにする

**要確認**: ヘルプテキストの文言をユーザーの理解度に合わせて調整する

---

## 12. 参考資料

- `STANDARD_REWARD_REFACTORING_PLAN.md`: 大規模改良方針書
- `STANDARD_REWARD_REFACTORING_PHASE1.md`: Phase1 実装指示書
- `STANDARD_REWARD_REFACTORING_PHASE2.md`: Phase2 実装指示書
- `src/app/utils/premium-calculator.ts`: 保険料計算ロジック（現行実装）
- `src/app/services/monthly-premiums.service.ts`: 月次保険料サービス（現行実装）
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts`: 月次保険料ページ（現行実装）

