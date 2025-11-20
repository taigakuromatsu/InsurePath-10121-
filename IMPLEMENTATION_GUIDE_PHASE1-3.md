# P1-3 指示書（改訂版）

**テーマ**: 標準報酬ベースの月次保険料計算ロジック（ユーティリティ）実装

---

## 0. ゴール・範囲

CATALOG の (7)「社会保険料自動計算機能」の中核ロジック部分だけを先に作る。

**UI や Firestore 書き込み・一覧表示はまだやらない。**

標準報酬月額／等級 ＋ 料率マスタから、1人の従業員について 1 か月分の保険料（本人・会社）を計算できる純粋関数を作る。

後続のタスク（P1-4 以降）で：
- `MonthlyPremium` ドキュメントを作成・保存
- 月次一覧画面やマイページ、ダッシュボード
などからこのロジックを呼び出す想定。

---

## 1. 前提となる設計方針（ここを必ず尊重）

### 1-1. 給与（monthlyWage）は計算に使わない

実際の賃金はいくらでもよく、計算に使うのは **標準報酬月額（healthStandardMonthly / pensionStandardMonthly）** だけとする。

等級（healthGrade / pensionGrade）は UI 表示用の補助。計算は「standardMonthly × 率」で行う。

### 1-2. 料率は「事業所 × 年度」のマスタから取得済みとして渡す

このタスクでは Firestore からマスタを読む処理はやらない。呼び出し側が `healthRate`, `careRate`, `pensionRate` を決めて渡す前提。

### 1-3. 協会けんぽと組合健保の違い

- `Office.healthPlanType === 'kyokai'` の場合：本来は都道府県ごとの率をプリセットしておき、`HealthRateTable` から拾う。
- `Office.healthPlanType === 'kumiai'` の場合：管理者が `HealthRateTable` に手入力した率を使う。

**ただし このタスクでは「どこから持ってきたか」は気にしない。すべて「healthRate という数値が渡されている」前提で実装。**

### 1-4. 介護保険の対象判定

**40〜64 歳の従業員のみ対象。**（`YearMonthString` から対象月の年齢を計算）

対象でなければ `care` 系の金額は 0 または undefined。

**境界値の扱い**:
- 対象年月の1日時点で満年齢を計算
- 40歳の誕生日当日から対象（40歳0ヶ月）
- 65歳の誕生日前日まで対象（64歳11ヶ月）
- 例: 対象年月が `2025-04`、生年月日が `1985-04-01` の場合 → 40歳（対象）
- 例: 対象年月が `2025-04`、生年月日が `1985-04-02` の場合 → 39歳（非対象）
- 例: 対象年月が `2025-04`、生年月日が `1960-04-01` の場合 → 65歳（非対象）
- 例: 対象年月が `2025-04`、生年月日が `1960-04-02` の場合 → 64歳（対象）

### 1-5. 徴収区分（PremiumTreatment）

`premiumTreatment === 'exempt'` の場合：
→ その月の保険料は **すべて 0** として扱う。

`premiumTreatment === 'normal'` または未設定：通常どおり計算。

### 1-6. 計算できないケースの扱い

以下の場合は「計算せずに null を返す」方針とする（呼び出し側でスキップ・警告など）：

1. `isInsured === false` の従業員
2. `healthStandardMonthly` または `pensionStandardMonthly` が未設定
3. 料率が渡されていない（`healthRate`/`pensionRate` が null/undefined）

**注意**: `careRate` が未設定でも、健康保険・厚生年金が計算可能なら結果を返す（`careTotal = 0`）。

---

## 2. 修正・追加するファイル

### 新規ファイル

- `src/app/utils/premium-calculator.ts`（新規）

### 既存ファイル（必要なら最小限の追記のみ）

- `src/app/types.ts`
  - すでに `MonthlyPremium`, `Employee`, `IsoDateString`, `YearMonthString` などがある前提。
  - 必要なら このユーティリティ専用の補助型 を追加してよいが、既存の型定義・フィールド名は変えない。

**※ このタスクではページコンポーネントやサービスには触れない。`monthly-premiums.page.ts` などは ノータッチ。**

---

## 3. 実装内容の詳細

### 3-1. premium-calculator.ts に作るもの

#### 型定義

```typescript
import { Employee, IsoDateString, YearMonthString } from '../types';

/**
 * 保険料計算に必要な料率コンテキスト
 * 
 * @param yearMonth - 計算対象年月（例: '2025-04'）
 * @param calcDate - 計算実行日時（ISO形式、例: '2025-01-15T10:30:00.000Z'）
 * @param healthRate - 健康保険料率（事業主＋被保険者合計、例: 0.0991 = 9.91%）
 * @param careRate - 介護保険料率（事業主＋被保険者合計、例: 0.0191 = 1.91%）
 * @param pensionRate - 厚生年金保険料率（事業主＋被保険者合計、例: 0.183 = 18.3%）
 */
export interface PremiumRateContext {
  yearMonth: YearMonthString;   // 必須
  calcDate: IsoDateString;       // 必須（計算実行日）
  
  // 以下のいずれかは必須（計算対象の保険によって異なる）
  healthRate?: number;          // 健康保険計算時は必須
  careRate?: number;            // 介護保険計算時は必須（対象者のみ使用）
  pensionRate?: number;         // 厚生年金計算時は必須
}

/**
 * 月次保険料の金額（各保険の本人負担・事業主負担）
 */
export interface MonthlyPremiumAmounts {
  // health
  healthTotal: number;
  healthEmployee: number;
  healthEmployer: number;

  // care（対象外なら 0）
  careTotal: number;
  careEmployee: number;
  careEmployer: number;

  // pension
  pensionTotal: number;
  pensionEmployee: number;
  pensionEmployer: number;

  // 合計
  totalEmployee: number;
  totalEmployer: number;
}

/**
 * 月次保険料計算結果
 * 
 * この結果は、後続フェーズ（P1-4）で MonthlyPremium ドキュメントを作成する際に使用される。
 * 
 * MonthlyPremium への変換例:
 * ```typescript
 * const result = calculateMonthlyPremiumForEmployee(employee, rateContext);
 * if (result) {
 *   const monthlyPremium: MonthlyPremium = {
 *     id: generateId(),
 *     officeId: result.officeId,
 *     employeeId: result.employeeId,
 *     yearMonth: result.yearMonth,
 *     healthGrade: result.healthGrade,
 *     healthStandardMonthly: result.healthStandardMonthly,
 *     pensionGrade: result.pensionGrade,
 *     pensionStandardMonthly: result.pensionStandardMonthly,
 *     healthTotal: result.amounts.healthTotal,
 *     healthEmployee: result.amounts.healthEmployee,
 *     healthEmployer: result.amounts.healthEmployer,
 *     // ... 他のフィールドも同様に展開
 *     calculatedAt: rateContext.calcDate,
 *   };
 * }
 * ```
 */
export interface MonthlyPremiumCalculationResult {
  // 計算対象の従業員 ID など
  employeeId: string;
  officeId: string;
  yearMonth: YearMonthString;

  // 等級・標準報酬のスナップショット
  healthGrade: number;
  healthStandardMonthly: number;
  pensionGrade: number;
  pensionStandardMonthly: number;

  // 金額
  amounts: MonthlyPremiumAmounts;
}

/**
 * 従業員一人分の当月保険料を計算する。
 * 
 * @param employee - 従業員情報
 * @param rateContext - 料率コンテキスト
 * @returns 計算結果。計算不可の場合は null
 * 
 * 計算不可となるケース:
 * 1. employee.isInsured !== true（社会保険未加入）
 * 2. employee.healthStandardMonthly が未設定（健康保険の標準報酬なし）
 * 3. employee.pensionStandardMonthly が未設定（厚生年金の標準報酬なし）
 * 4. rateContext.healthRate が未設定（健康保険料率なし）
 * 5. rateContext.pensionRate が未設定（厚生年金保険料率なし）
 * 
 * 注意:
 * - premiumTreatment === 'exempt' の場合は、金額を0として計算結果を返す
 * - careRate が未設定でも、健康保険・厚生年金が計算可能なら結果を返す（careTotal = 0）
 */
export function calculateMonthlyPremiumForEmployee(
  employee: Employee,
  rateContext: PremiumRateContext
): MonthlyPremiumCalculationResult | null;
```

#### ロジック仕様

`calculateMonthlyPremiumForEmployee` の中身：

##### 事前チェック

```typescript
// 1. 社会保険未加入チェック
if (employee.isInsured !== true) {
  return null;
}

// 2. 標準報酬月額の存在チェック
if (!employee.healthStandardMonthly || !employee.pensionStandardMonthly) {
  return null;
}

// 3. 料率の存在チェック
if (!rateContext.healthRate || !rateContext.pensionRate) {
  return null;
}

// 4. 保険料免除チェック
const isExempt = employee.premiumTreatment === 'exempt';
```

**注意**: `premiumTreatment === 'exempt'` の場合、金額はすべて 0 だが、等級・標準報酬スナップショットは埋めたうえで result を返す。

##### 年齢計算（介護保険用）

```typescript
/**
 * 介護保険の対象判定（40〜64歳）
 * 
 * 対象年月の1日時点で満年齢を計算し、40歳以上64歳以下なら対象。
 * 
 * 境界値の扱い:
 * - 40歳の誕生日当日から対象（40歳0ヶ月）
 * - 65歳の誕生日前日まで対象（64歳11ヶ月）
 * 
 * @param birthDate - 生年月日（YYYY-MM-DD形式）
 * @param yearMonth - 対象年月（YYYY-MM形式）
 * @returns 介護保険第2号被保険者に該当する場合 true
 */
function isCareInsuranceTarget(
  birthDate: string,
  yearMonth: YearMonthString
): boolean {
  // yearMonth の 1 日を基準日として
  // 基準日時点の満年齢を計算
  // 40 <= 年齢 <= 64 なら true
}
```

**実装例**:
```typescript
function isCareInsuranceTarget(
  birthDate: string,
  yearMonth: YearMonthString
): boolean {
  // yearMonth を 'YYYY-MM-01' 形式に変換
  const [year, month] = yearMonth.split('-');
  const targetDate = new Date(`${year}-${month}-01`);
  
  // 生年月日から Date オブジェクトを作成
  const birth = new Date(birthDate);
  
  // 満年齢を計算
  let age = targetDate.getFullYear() - birth.getFullYear();
  const monthDiff = targetDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && targetDate.getDate() < birth.getDate())) {
    age--;
  }
  
  // 40〜64歳なら対象
  return age >= 40 && age <= 64;
}
```

##### 保険料額の計算

それぞれ「合計率」を前提とした簡易ロジックで良い：

```typescript
/**
 * 10円未満を切り捨てる（社会保険料の端数処理）
 * 
 * カタログ(7)では「端数処理はシステム内で統一」とあるが、
 * 本実装では10円未満切り捨てを採用。
 * 
 * 例:
 * - 1234 → 1230
 * - 1239 → 1230
 * - 1240 → 1240
 * - 1245 → 1240
 */
function roundTo10Yen(value: number): number {
  return Math.floor(value / 10) * 10;
}

// 健康保険料
const healthTotal = isExempt 
  ? 0 
  : roundTo10Yen(employee.healthStandardMonthly * rateContext.healthRate!);

// 厚生年金保険料
const pensionTotal = isExempt 
  ? 0 
  : roundTo10Yen(employee.pensionStandardMonthly * rateContext.pensionRate!);

// 介護保険料（40〜64歳のみ）
const isCareTarget = isCareInsuranceTarget(employee.birthDate, rateContext.yearMonth);
const careTotal = (isExempt || !isCareTarget || !rateContext.careRate)
  ? 0
  : roundTo10Yen(employee.healthStandardMonthly * rateContext.careRate);
```

##### 本人／事業主の按分

**1:1 としてシンプルに 2 分割**（合計がずれても OK。誤差は今回の課題では気にしない）

```typescript
/**
 * 保険料を本人負担分と事業主負担分に按分する
 * 
 * 按分方法:
 * - 合計額を2で割り、端数切り捨てで本人負担分を計算
 * - 事業主負担分 = 合計額 - 本人負担分
 * 
 * これにより、合計額が奇数の場合でも誤差が1円以内に収まる
 * 
 * 例:
 * - 合計 30,000円 → 本人 15,000円、事業主 15,000円
 * - 合計 30,001円 → 本人 15,000円、事業主 15,001円
 */
const healthEmployee = Math.floor(healthTotal / 2);
const healthEmployer = healthTotal - healthEmployee;

const pensionEmployee = Math.floor(pensionTotal / 2);
const pensionEmployer = pensionTotal - pensionEmployee;

const careEmployee = Math.floor(careTotal / 2);
const careEmployer = careTotal - careEmployee;

// 合計
const totalEmployee = healthEmployee + careEmployee + pensionEmployee;
const totalEmployer = healthEmployer + careEmployer + pensionEmployer;
```

##### 戻り値の組み立て

`MonthlyPremiumCalculationResult` に以下を設定：

```typescript
return {
  employeeId: employee.id,
  officeId: employee.officeId,
  yearMonth: rateContext.yearMonth,
  
  // 等級・標準報酬のスナップショット
  healthGrade: employee.healthGrade!,
  healthStandardMonthly: employee.healthStandardMonthly,
  pensionGrade: employee.pensionGrade!,
  pensionStandardMonthly: employee.pensionStandardMonthly,
  
  // 金額
  amounts: {
    healthTotal,
    healthEmployee,
    healthEmployer,
    careTotal,
    careEmployee,
    careEmployer,
    pensionTotal,
    pensionEmployee,
    pensionEmployer,
    totalEmployee,
    totalEmployer,
  },
};
```

**注意**: `healthGrade` と `pensionGrade` は `!` 前提でよい（事前チェックで標準報酬が存在することを確認済み）。

---

## 4. 非対象（やらないこと）

この P1-3 では **やらない** と明示：

- ❌ Firestore から `HealthRateTable` / `CareRateTable` / `PensionRateTable` を読む処理
- ❌ `MonthlyPremium` ドキュメントの保存・再計算・削除
- ❌ UI の変更（ページ・コンポーネント・ルーティング等）
- ❌ 賞与保険料の計算（`BonusPremium` 用ロジック）

これらは **後続フェーズ（P1-4 以降）** で別タスクとして実装。

---

## 5. 受け入れ条件（Cursor 側で簡単にテストできる観点）

### 5-1. 基本動作

- ✅ `premium-calculator.ts` が追加されており、ビルドエラーがない
- ✅ `calculateMonthlyPremiumForEmployee` をインポートして実行できる

### 5-2. エラーケース

- ✅ `isInsured === false` なら `null` を返す
- ✅ `healthStandardMonthly` が `undefined` なら `null` を返す
- ✅ `pensionStandardMonthly` が `undefined` なら `null` を返す
- ✅ `healthRate` が `undefined` なら `null` を返す
- ✅ `pensionRate` が `undefined` なら `null` を返す

### 5-3. 保険料免除ケース

- ✅ `premiumTreatment === 'exempt'` の場合、`amounts` 内の金額がすべて 0 になる
- ✅ ただし、等級・標準報酬のスナップショットは正しく設定される

### 5-4. 介護保険対象判定

- ✅ 40歳の従業員（対象年月時点）→ `careTotal > 0`（`careRate` が設定されている場合）
- ✅ 39歳の従業員（対象年月時点）→ `careTotal = 0`
- ✅ 64歳の従業員（対象年月時点）→ `careTotal > 0`（`careRate` が設定されている場合）
- ✅ 65歳の従業員（対象年月時点）→ `careTotal = 0`
- ✅ `careRate` が未設定でも、健康保険・厚生年金は計算される（`careTotal = 0`）

### 5-5. 計算ロジック

#### テストケース1: 基本計算

```
標準報酬（健保）: 300,000円
標準報酬（厚年）: 300,000円
健保率: 10% (0.10)
厚年率: 18% (0.18)
介護率: 0% (未設定)
年齢: 45歳

期待結果:
- healthTotal = 30,000円（300,000 × 0.10、10円未満切り捨て）
- pensionTotal = 54,000円（300,000 × 0.18）
- careTotal = 0円（介護率未設定）
- healthEmployee = 15,000円、healthEmployer = 15,000円
- pensionEmployee = 27,000円、pensionEmployer = 27,000円
- totalEmployee = 42,000円、totalEmployer = 42,000円
```

#### テストケース2: 介護保険あり

```
標準報酬（健保）: 300,000円
標準報酬（厚年）: 300,000円
健保率: 10% (0.10)
厚年率: 18% (0.18)
介護率: 2% (0.02)
年齢: 45歳

期待結果:
- healthTotal = 30,000円
- pensionTotal = 54,000円
- careTotal = 6,000円（300,000 × 0.02）
- careEmployee = 3,000円、careEmployer = 3,000円
- totalEmployee = 45,000円、totalEmployer = 45,000円
```

#### テストケース3: 端数処理

```
標準報酬（健保）: 123,456円
健保率: 10% (0.10)

期待結果:
- healthTotal = 12,340円（123,456 × 0.10 = 12,345.6 → 10円未満切り捨て）
- healthEmployee = 6,170円、healthEmployer = 6,170円
```

#### テストケース4: 奇数の合計額

```
標準報酬（健保）: 300,001円
健保率: 10% (0.10)

期待結果:
- healthTotal = 30,000円（300,001 × 0.10 = 30,000.1 → 10円未満切り捨て）
- healthEmployee = 15,000円（30,000 ÷ 2）
- healthEmployer = 15,000円（30,000 - 15,000）
```

#### テストケース5: 保険料免除

```
標準報酬（健保）: 300,000円
標準報酬（厚年）: 300,000円
健保率: 10% (0.10)
厚年率: 18% (0.18)
premiumTreatment: 'exempt'

期待結果:
- すべての金額が 0 になる
- ただし、等級・標準報酬のスナップショットは正しく設定される
```

### 5-6. 年齢計算の境界値

- ✅ 対象年月が `2025-04`、生年月日が `1985-04-01` の場合 → 40歳（対象）
- ✅ 対象年月が `2025-04`、生年月日が `1985-04-02` の場合 → 39歳（非対象）
- ✅ 対象年月が `2025-04`、生年月日が `1960-04-01` の場合 → 65歳（非対象）
- ✅ 対象年月が `2025-04`、生年月日が `1960-04-02` の場合 → 64歳（対象）

---

## 6. 実装時の注意事項

1. **既存コードの保護**: 既存の型定義やフィールド名は変更しない
2. **純粋関数**: 副作用のない純粋関数として実装する（Firestore への書き込みは行わない）
3. **エラーハンドリング**: 計算不可の場合は `null` を返し、例外を投げない
4. **型安全性**: TypeScript の型チェックを活用し、`!` 演算子は最小限に
5. **コメント**: 関数と重要なロジックには JSDoc コメントを追加

---

## 7. 参考実装

既存の `label-utils.ts` のパターンを参考に、ユーティリティ関数として実装してください。

```typescript
// label-utils.ts のパターン
export function getWorkingStatusLabel(status?: WorkingStatus): string {
  switch (status) {
    case 'normal': return '通常勤務';
    // ...
  }
}
```

同様に、`premium-calculator.ts` もエクスポート関数として実装してください。

---

**実装完了後は、この指示書のチェックリストを確認して、実装状況を更新してください。**

