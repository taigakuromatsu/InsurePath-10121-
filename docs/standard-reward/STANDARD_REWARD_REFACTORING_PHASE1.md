# Phase1 実装指示書：コアモデル & 保険料計算ロジックの全面改修

## 改訂履歴
- 2025年1月: 初版作成
- 2025年1月: 修正版（保険種別ごとの計算スキップ、PayrollSettings型の扱い、insuranceKind必須化の影響を明確化）

---

## 1. 概要（Purpose / Scope）

### 1-1. Phase1 の目的

Phase1 では、**内部の「計算の根っこ」を正しい世界観にする**ことを目的とします。

具体的には：

1. `Employee` / `StandardRewardHistory` / `MonthlyPremium` などの**コアデータモデルを新世界観に合わせる**
2. 保険料計算ロジック（`premium-calculator.ts`）を
   - `monthlyWage` ではなく
   - `healthStandardMonthly` / `pensionStandardMonthly` を使う形に**全面改修**する
3. 今後 Phase2〜5 で UI や CSV、書類生成などを触るための「内部の正しい入口」を固める

### 1-2. Phase1 の範囲

**Phase1 で実施する内容:**
- 型定義（`types.ts`）の変更
- 標準報酬決定ユーティリティ（`standard-reward-resolver.ts`）の新規追加
- 保険料計算ロジック（`premium-calculator.ts`）の全面改修
- `MonthlyPremium` 関連の型・サービスへの影響対応（コンパイルを通すための最小修正）

**Phase1 では実施しない内容（Phase2〜5 で対応）:**
- 従業員フォーム・シミュレーターでの自動等級決定（Phase2）
- 標準報酬履歴の UI 改修（Phase3）
- CSV インポート／エクスポートの刷新（Phase4）
- 書類生成・データ品質チェックの本格改修（Phase5）

### 1-3. Phase1 のゴール

- **コンパイルが通る状態**を達成する
- 従業員フォームで `healthStandardMonthly` がまだ入っていなくても、保険料計算ロジック自体は新ロジックで動く（データが揃っていない場合は計算をスキップする）
- シミュレーター・CSV・書類生成・履歴はこの段階では一旦「旧仕様のまま」でOK

---

## 2. 対象ファイル一覧

### 2-1. 変更対象ファイル

| ファイルパス | 変更内容 | 優先度 |
|------------|---------|--------|
| `src/app/types.ts` | 型定義の変更（Employee, StandardRewardHistory, GradeDecisionSource） | **必須** |
| `src/app/utils/standard-reward-resolver.ts` | 新規追加：標準報酬決定ユーティリティ | **必須** |
| `src/app/utils/premium-calculator.ts` | 保険料計算ロジックの全面改修 | **必須** |
| `src/app/services/monthly-premiums.service.ts` | `MonthlyPremium` 型変更への対応（最小修正） | **必須** |
| `src/app/services/data-quality.service.ts` | 型変更への対応（コンパイルエラー解消のみ） | **推奨** |

### 2-2. 確認対象ファイル（変更なし、確認のみ）

| ファイルパス | 確認内容 |
|------------|---------|
| `src/app/services/masters.service.ts` | `getRatesForYearMonth()` のインターフェース確認（Phase2で使用するため） |

### 2-3. 影響を受けるが Phase1 では触らないファイル

以下のファイルは Phase1 の変更の影響を受けるが、**Phase1 では最小限の修正のみ**行い、本格的な改修は Phase2〜5 で実施します。

| ファイルパス | Phase1での対応 | 本格改修フェーズ |
|------------|--------------|----------------|
| `src/app/pages/premiums/monthly/monthly-premiums.page.ts` | コンパイルエラーがあれば最小修正 | Phase5 |
| `src/app/pages/employees/employee-form-dialog.component.ts` | 変更なし | Phase2 |
| `src/app/pages/simulator/simulator.page.ts` | 変更なし | Phase2 |
| `src/app/services/standard-reward-history.service.ts` | 変更なし | Phase3 |

---

## 3. データモデル変更（`types.ts`）

### 3-1.1. `Employee` インターフェースの変更

#### 変更内容

**Before（現状）:**
```typescript
export interface Employee {
  // ...
  /** 社会保険上の報酬月額（手当込みの月給ベース） */
  monthlyWage: number;  // 必須フィールド

  /** 健康保険の等級・標準報酬（月額） */
  healthGrade?: number;
  healthStandardMonthly?: number;
  healthGradeSource?: GradeDecisionSource;

  /** 厚生年金の等級・標準報酬（月額） */
  pensionGrade?: number;
  pensionStandardMonthly?: number;
  pensionGradeSource?: GradeDecisionSource;

  /** 給与基本情報（社会保険用） */
  payrollSettings?: PayrollSettings | null;
}
```

**After（Phase1 変更後）:**
```typescript
export interface Employee {
  // ... 基本情報（変更なし） ...

  /** 給与基本情報（社会保険用） */
  payrollSettings?: PayrollSettings | null;

  /** 健康保険の等級・標準報酬（月額） */
  healthGrade?: number | null;
  healthStandardMonthly?: number | null;
  healthGradeSource?: GradeDecisionSource;

  /** 厚生年金の等級・標準報酬（月額） */
  pensionGrade?: number | null;
  pensionStandardMonthly?: number | null;
  pensionGradeSource?: GradeDecisionSource;

  /**
   * @deprecated 旧設計の名残。計算には使わない。
   * Firestore ルール・CSV・フォーム UI からも事実上排除する。
   * Phase1 では optional に変更し、Phase2 以降で完全に排除する。
   */
  monthlyWage?: number;
}
```

**`PayrollSettings` インターフェースの変更:**
```typescript
export interface PayrollSettings {
  payType: PayrollPayType;
  payCycle: PayrollPayCycle;
  insurableMonthlyWage: number | null; // ← 報酬月額（実際の給与）を追加
  note?: string | null;
}
```

#### 実施手順

1. **`monthlyWage` を optional に変更**
   - `monthlyWage: number;` → `monthlyWage?: number;`
   - 上記の `@deprecated` コメントを追加

2. **`PayrollSettings` インターフェースに `insurableMonthlyWage` を追加**
   - 既存の `PayrollSettings` インターフェースに `insurableMonthlyWage: number | null;` を追加
   - `Employee` 側は `payrollSettings?: PayrollSettings | null;` のまま（型を一箇所に集約）

3. **`healthGrade` / `pensionGrade` / `healthStandardMonthly` / `pensionStandardMonthly` を `| null` に対応**
   - 現状は `number | undefined` だが、`null` も許容する形に変更
   - これにより「値が未設定」と「値が null（明示的にクリアされた）」を区別できる

### 3-2. `GradeDecisionSource` 型の拡張

#### 変更内容

**Before（現状）:**
```typescript
export type GradeDecisionSource = 'auto' | 'manual' | 'imported';
```

**After（Phase1 変更後）:**
```typescript
export type GradeDecisionSource =
  | 'auto'              // 自動決定（旧仕様の互換用）
  | 'auto_from_salary'  // 報酬月額から自動決定（Phase2 で使用）
  | 'manual'            // 手動入力（旧仕様の互換用）
  | 'manual_override'   // 手動上書き（Phase2 で使用）
  | 'imported';         // CSV インポート（Phase4 で使用）
```

#### 実施手順

1. `types.ts` の `GradeDecisionSource` 型定義を上記のように拡張
2. Phase1 では型定義のみ追加し、実際に使用するのは Phase2 以降

### 3-3. `StandardRewardHistory` インターフェースの変更

#### 変更内容

**Before（現状）:**
```typescript
export interface StandardRewardHistory {
  id: string;
  employeeId: string;
  decisionYearMonth: YearMonthString;
  appliedFromYearMonth: YearMonthString;
  standardMonthlyReward: number;
  decisionKind: StandardRewardDecisionKind;
  note?: string;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  createdByUserId?: string;
  updatedByUserId?: string;
}
```

**After（Phase1 変更後）:**
```typescript
export type InsuranceKind = 'health' | 'pension';

export interface StandardRewardHistory {
  id: string;
  employeeId: string;
  insuranceKind: InsuranceKind; // ★ 追加：健保 or 厚年
  decisionYearMonth: YearMonthString;
  appliedFromYearMonth: YearMonthString;
  standardMonthlyReward: number; // 標準報酬月額（この保険種別用）
  grade?: number;                // ★ 追加：等級（あれば）
  decisionKind: StandardRewardDecisionKind;
  note?: string;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  createdByUserId?: string;
  updatedByUserId?: string;
}
```

#### 実施手順

1. **`InsuranceKind` 型を新規追加
   - `export type InsuranceKind = 'health' | 'pension';`
   - `types.ts` の `StandardRewardHistory` 定義の前に追加

2. `StandardRewardHistory` に `insuranceKind` プロパティを追加
   - `insuranceKind: InsuranceKind;`（必須フィールド）

3. `StandardRewardHistory` に `grade` プロパティを追加
   - `grade?: number;`（オプショナル）

4. **Phase1 では型定義のみ変更**
   - 実際に `insuranceKind` を設定・使用するロジックは Phase3 で実装
   - **Phase1 時点での対応方針**:
     - Phase1 では `StandardRewardHistory` の CRUD を一切触らない前提
     - TypeScript 型だけ `insuranceKind` を追加
     - 既存のコードで `StandardRewardHistory` を読み込む箇所は、`as StandardRewardHistory` などの型アサーションを使用して最低限動くようにする
     - もし Phase1 のどこかで新規作成するコードがある場合は、一時的に `insuranceKind: 'health'` を固定で入れる（本番データなし前提のため、テスト用として割り切り）

### 3-4. `MonthlyPremium` インターフェースの確認

#### 現状確認

`MonthlyPremium` インターフェースは既に以下のフィールドを持っています：

```typescript
export interface MonthlyPremium {
  // ...
  healthGrade: number;
  healthStandardMonthly: number;
  pensionGrade: number;
  pensionStandardMonthly: number;
  // ...
}
```

#### Phase1 での対応

**変更不要**（既に新世界観に対応している）

ただし、以下の点を確認・修正：

1. **`healthStandardMonthly` / `pensionStandardMonthly` が必須フィールドかどうか確認**
   - 現状は `number`（必須）だが、Phase1 では `number | null` に変更することを検討
   - ただし、`MonthlyPremium` は「計算結果のスナップショット」なので、計算が実行された時点では必ず値が入っている前提
   - **結論**: Phase1 では変更不要。計算がスキップされた場合は `MonthlyPremium` レコード自体を作成しない

2. **`healthGradeSource` / `pensionGradeSource` の扱い**
   - 現状は `MonthlyPremium` に含まれていないが、`monthly-premiums.service.ts` で条件付きで追加している
   - Phase1 では型定義に追加するか、現状のまま（`as any` で追加）かを判断
   - **推奨**: Phase1 では型定義に追加しない（Phase5 で本格対応）

---

## 4. 標準報酬決定ユーティリティ（`standard-reward-resolver.ts`）

### 4-1. ファイルの新規追加

**ファイルパス**: `src/app/utils/standard-reward-resolver.ts`

### 4-2. 提供する関数のシグネチャ

```typescript
import { HealthRateTable, PensionRateTable, StandardRewardBand } from '../types';

/**
 * 報酬月額から健康保険の標準報酬等級・標準報酬月額を決定する
 *
 * @param salary - 報酬月額（実際の給与）
 * @param healthTable - 健康保険料率マスタ（標準報酬等級表を含む）
 * @returns 等級と標準報酬月額のオブジェクト、または null（決定できない場合）
 *
 * @remarks
 * - Phase2: 従業員フォームから呼び出される
 * - Phase4: CSV インポート時にも使用される
 * - 失敗時（null 返却）の扱い:
 *   - フォーム側: フィールド空欄＋エラーメッセージ表示
 *   - premium-calculator: 計算スキップ
 *   - DataQuality: 「標準報酬未決定」として検知
 */
export function resolveHealthStandardFromSalary(
  salary: number,
  healthTable: HealthRateTable
): { grade: number; standardMonthly: number } | null;

/**
 * 報酬月額から厚生年金の標準報酬等級・標準報酬月額を決定する
 *
 * @param salary - 報酬月額（実際の給与）
 * @param pensionTable - 厚生年金料率マスタ（標準報酬等級表を含む）
 * @returns 等級と標準報酬月額のオブジェクト、または null（決定できない場合）
 *
 * @remarks
 * - Phase2: 従業員フォームから呼び出される
 * - Phase4: CSV インポート時にも使用される
 * - 失敗時（null 返却）の扱い:
 *   - フォーム側: フィールド空欄＋エラーメッセージ表示
 *   - premium-calculator: 計算スキップ
 *   - DataQuality: 「標準報酬未決定」として検知
 */
export function resolvePensionStandardFromSalary(
  salary: number,
  pensionTable: PensionRateTable
): { grade: number; standardMonthly: number } | null;
```

### 4-3. 内部ロジックの要件

#### `resolveHealthStandardFromSalary()` の実装

1. **入力バリデーション**
   - `salary <= 0` の場合は `null` を返す
   - `healthTable.bands` が空配列の場合は `null` を返す

2. **等級表の走査**
   - `healthTable.bands` を `grade` 昇順（または `lowerLimit` 昇順）で走査
   - `lowerLimit <= salary <= upperLimit` を満たす最初の `StandardRewardBand` を見つける
   - 見つかった場合、`{ grade: band.grade, standardMonthly: band.standardMonthly }` を返す

3. **範囲外の処理**
   - **上限を超えた場合（頭打ち）**: 最大等級（`grade` が最大のもの）を返す
   - **下限未満の場合**: 最小等級（`grade` が最小のもの）を返す、または `null` を返す
   - **方針**: 下限未満の場合は `null` を返す（異常値として扱う）

4. **エラーケース**
   - マスタが見つからない、`bands` が空、範囲外などの場合は `null` を返す

#### `resolvePensionStandardFromSalary()` の実装

`resolveHealthStandardFromSalary()` と同じロジックを、`pensionTable.bands` に対して適用する。

### 4-4. 実装例（参考）

```typescript
export function resolveHealthStandardFromSalary(
  salary: number,
  healthTable: HealthRateTable
): { grade: number; standardMonthly: number } | null {
  // 入力バリデーション
  if (salary <= 0) {
    return null;
  }

  const bands = healthTable.bands;
  if (!bands || bands.length === 0) {
    return null;
  }

  // 等級表を grade 昇順でソート（念のため）
  const sortedBands = [...bands].sort((a, b) => a.grade - b.grade);

  // 範囲内のバンドを探す
  for (const band of sortedBands) {
    if (band.lowerLimit <= salary && salary <= band.upperLimit) {
      return {
        grade: band.grade,
        standardMonthly: band.standardMonthly
      };
    }
  }

  // 範囲外の場合
  // 上限を超えた場合（頭打ち）: 最大等級を返す
  const maxBand = sortedBands[sortedBands.length - 1];
  if (salary > maxBand.upperLimit) {
    return {
      grade: maxBand.grade,
      standardMonthly: maxBand.standardMonthly
    };
  }

  // 下限未満の場合: null を返す（異常値）
  return null;
}
```

---

## 5. 保険料計算ロジックの改修（`premium-calculator.ts`）

### 5-1. `calculateMonthlyPremiumForEmployee()` の全面改修

#### Before（現状）

```typescript
export function calculateMonthlyPremiumForEmployee(
  employee: Employee,
  rateContext: PremiumRateContext
): MonthlyPremiumCalculationResult | null {
  // ...
  // 2. 標準報酬月額（＝ monthlyWage）が必要
  const standardMonthly = employee.monthlyWage;
  if (!standardMonthly || standardMonthly <= 0) {
    return null;
  }

  // 3. 等級が未設定なら対象外
  if (employee.healthGrade == null || employee.pensionGrade == null) {
    return null;
  }

  // ...
  // 健康保険
  const healthTotal = isExempt ? 0 : standardMonthly * rateContext.healthRate;
  // 厚生年金
  const pensionTotal = isExempt ? 0 : standardMonthly * rateContext.pensionRate;
  // 介護保険
  const careTotal = isExempt || !isCareTarget || !hasCareRate
    ? 0
    : standardMonthly * rateContext.careRate!;

  // ...
  return {
    // ...
    healthGrade: employee.healthGrade!,
    healthStandardMonthly: standardMonthly,  // ← monthlyWage をそのまま使用
    pensionGrade: employee.pensionGrade!,
    pensionStandardMonthly: standardMonthly,  // ← monthlyWage をそのまま使用
    // ...
  };
}
```

#### After（Phase1 変更後）

```typescript
export function calculateMonthlyPremiumForEmployee(
  employee: Employee,
  rateContext: PremiumRateContext
): MonthlyPremiumCalculationResult | null {
  // 1. 加入していないなら対象外
  if (employee.isInsured !== true) {
    return null;
  }

  // 1-2. 資格取得日／喪失日ベースで、その月に資格がなければ対象外
  if (!hasSocialInsuranceInMonth(employee, rateContext.yearMonth)) {
    return null;
  }

  // 2. 健康保険の計算可否を判定
  const canCalcHealth =
    employee.healthStandardMonthly != null &&
    employee.healthStandardMonthly > 0 &&
    employee.healthGrade != null &&
    rateContext.healthRate != null;

  // 3. 厚生年金の計算可否を判定
  const canCalcPension =
    employee.pensionStandardMonthly != null &&
    employee.pensionStandardMonthly > 0 &&
    employee.pensionGrade != null &&
    rateContext.pensionRate != null;

  // 4. 両方とも計算不可の場合は null を返す
  if (!canCalcHealth && !canCalcPension) {
    return null;
  }

  const isExempt = employee.premiumTreatment === 'exempt';
  const healthStandardMonthly = employee.healthStandardMonthly ?? 0;
  const pensionStandardMonthly = employee.pensionStandardMonthly ?? 0;

  // 5. 健康保険の計算（canCalcHealth が true の場合のみ）
  const healthTotal = canCalcHealth && !isExempt
    ? healthStandardMonthly * rateContext.healthRate!
    : 0;

  // 6. 厚生年金の計算（canCalcPension が true の場合のみ）
  const pensionTotal = canCalcPension && !isExempt
    ? pensionStandardMonthly * rateContext.pensionRate!
    : 0;

  // 7. 介護保険の計算（healthStandardMonthly を使用、40〜64歳のみ）
  // 健康保険が計算可能でない場合は介護保険も 0
  const isCareTarget = isCareInsuranceTarget(employee.birthDate, rateContext.yearMonth);
  const hasCareRate = rateContext.careRate != null && rateContext.careRate > 0;

  const careTotal =
    !canCalcHealth || isExempt || !isCareTarget || !hasCareRate
      ? 0
      : healthStandardMonthly * rateContext.careRate!;

  const healthEmployee = Math.floor(healthTotal / 2);
  const healthEmployer = healthTotal - healthEmployee;

  const pensionEmployee = Math.floor(pensionTotal / 2);
  const pensionEmployer = pensionTotal - pensionEmployee;

  const careEmployee = Math.floor(careTotal / 2);
  const careEmployer = careTotal - careEmployee;

  const totalEmployee = healthEmployee + careEmployee + pensionEmployee;
  const totalEmployer = healthEmployer + careEmployer + pensionEmployer;

  return {
    employeeId: employee.id,
    officeId: employee.officeId,
    yearMonth: rateContext.yearMonth,
    healthGrade: employee.healthGrade ?? 0,  // canCalcHealth が false の場合は 0
    healthStandardMonthly: canCalcHealth ? healthStandardMonthly : 0,  // ← 健康保険用の標準報酬
    pensionGrade: employee.pensionGrade ?? 0,  // canCalcPension が false の場合は 0
    pensionStandardMonthly: canCalcPension ? pensionStandardMonthly : 0,  // ← 厚生年金用の標準報酬
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
      totalEmployer
    }
  };
}
```

#### 実施手順

1. **コメントの更新**
   - 「`employee.monthlyWage` を「健保・厚年 共通の標準報酬月額」として扱う」というコメントを削除
   - 新ロジックの説明コメントを追加

2. **標準報酬の取得ロジックを変更**
   - `const standardMonthly = employee.monthlyWage;` を削除
   - `healthStandardMonthly` / `pensionStandardMonthly` をそれぞれ取得

3. **バリデーションロジックを変更（保険種別ごとに判定）**
   - `monthlyWage` のチェックを削除
   - `canCalcHealth` / `canCalcPension` をそれぞれ計算
     - `canCalcHealth`: `healthStandardMonthly != null && healthStandardMonthly > 0 && healthGrade != null && healthRate != null`
     - `canCalcPension`: `pensionStandardMonthly != null && pensionStandardMonthly > 0 && pensionGrade != null && pensionRate != null`
   - 両方とも `false` の場合は `null` を返す（全保険種別をスキップ）
   - 片方だけ `true` の場合は、その保険種別だけ計算し、もう片方は 0 とする

4. **保険料計算ロジックを変更（保険種別ごとに条件分岐）**
   - 健康保険: `canCalcHealth && !isExempt` の場合のみ `healthStandardMonthly * rateContext.healthRate`、それ以外は 0
   - 厚生年金: `canCalcPension && !isExempt` の場合のみ `pensionStandardMonthly * rateContext.pensionRate`、それ以外は 0
   - 介護保険: `canCalcHealth && !isExempt && isCareTarget && hasCareRate` の場合のみ `healthStandardMonthly * rateContext.careRate`、それ以外は 0（健保の標準報酬を使用）

5. **戻り値の更新**
   - `healthStandardMonthly` / `pensionStandardMonthly` をそれぞれ設定
   - `canCalcHealth` / `canCalcPension` が `false` の場合は 0 を設定
   - `healthGrade` / `pensionGrade` も同様に、計算不可の場合は 0 を設定

### 5-2. その他の関数への影響

#### `hasSocialInsuranceInMonth()` / `isCareInsuranceTarget()`

**変更不要**（`Employee` の基本情報のみを使用しているため）

#### ボーナス計算関連

**Phase1 では対応しない**
- ボーナス保険料計算は Phase5 で対応
- Phase1 では `premium-calculator.ts` の月次保険料計算のみを対象とする

---

## 6. 他ファイルへの影響と最小修正

### 6-1. `monthly-premiums.service.ts`

#### 影響箇所

`fromCalculationResult()` メソッドで `MonthlyPremiumCalculationResult` から `MonthlyPremium` に変換している部分。

#### 現状確認

既に `healthStandardMonthly` / `pensionStandardMonthly` を正しく設定しているため、**変更不要**。

ただし、以下の点を確認：

1. **`MonthlyPremiumCalculationResult` の型変更に追従**
   - `premium-calculator.ts` の変更により、`MonthlyPremiumCalculationResult` の `healthStandardMonthly` / `pensionStandardMonthly` がそれぞれ異なる値になる
   - 現状のコードは既に正しく動作するはずだが、念のため確認

2. **コメントの更新**
   - 「等級・標準報酬のスナップショット」というコメントが正しいことを確認

#### 実施手順

1. `fromCalculationResult()` メソッドの動作確認
2. コメントの更新（必要に応じて）

### 6-2. `data-quality.service.ts`

#### 影響箇所

「ルール6: 月次保険料レコードの標準報酬スナップショット欠落」のチェック部分。

#### 現状確認

既に `healthStandardMonthly` / `pensionStandardMonthly` をチェックしているため、**変更不要**。

ただし、以下の点を確認：

1. **`null` チェックの追加**
   - Phase1 では `healthStandardMonthly` / `pensionStandardMonthly` が `null` の場合も計算をスキップする
   - DataQuality のチェックでも `null` を適切に検知できるか確認

2. **エラーメッセージの更新**
   - 「標準報酬未決定」という表現を追加（Phase5 で本格対応）

#### 実施手順

1. `null` チェックが正しく動作することを確認
2. コメントを追加（Phase5 で本格改修する旨を記載）

```typescript
// ルール6: 月次保険料レコードの標準報酬スナップショット欠落
// Phase1: 新ロジック（healthStandardMonthly / pensionStandardMonthly）に対応
// Phase5: エラーメッセージの改善、「標準報酬未決定」系の issue として明確化
empPremiums.forEach((p) => {
  const missing =
    p.healthGrade == null ||
    p.pensionGrade == null ||
    p.healthStandardMonthly == null ||
    p.pensionStandardMonthly == null ||
    p.healthGrade <= 0 ||
    p.pensionGrade <= 0 ||
    p.healthStandardMonthly <= 0 ||
    p.pensionStandardMonthly <= 0;
  // ...
});
```

### 6-3. `masters.service.ts`

#### 確認内容

`getRatesForYearMonth()` のインターフェースを確認し、Phase2 で従業員フォームから呼び出す際に使いやすいか確認する。

#### 現状確認

```typescript
async getRatesForYearMonth(
  office: Office,
  yearMonth: YearMonthString
): Promise<{
  healthRate?: number;
  careRate?: number;
  pensionRate?: number;
}>
```

#### Phase1 での対応

**変更不要**（インターフェースはそのままでOK）

ただし、Phase2 で `HealthRateTable` / `PensionRateTable` のオブジェクト自体が必要になる可能性があるため、以下の点を確認：

1. **戻り値にマスタオブジェクトを含めるかどうか**
   - Phase2 では `resolveHealthStandardFromSalary()` / `resolvePensionStandardFromSalary()` に `HealthRateTable` / `PensionRateTable` を渡す必要がある
   - 現状の `getRatesForYearMonth()` は料率のみを返しているため、Phase2 で拡張が必要になる可能性がある
   - **Phase1 では対応不要**（Phase2 で判断）

2. **コメントの追加**
   - Phase2 で使用する旨をコメントで記載

### 6-4. その他のファイル

#### `monthly-premiums.page.ts`（月次保険料一覧画面）

**Phase1 での対応**: コンパイルエラーがあれば最小修正のみ

- `MonthlyPremium` 型のフィールド名変更に追従する必要がある箇所を確認
- 表示カラム名（ラベル）は旧文言のままでもよいが、参照フィールドは新フィールドを使う

#### `standard-reward-history.service.ts`

**Phase1 での対応**: 変更なし（Phase3 で対応）

- `StandardRewardHistory` 型に `insuranceKind` が追加されるため、Phase3 で CRUD ロジックを改修する必要がある
- **Phase1 時点での対応方針**:
  - Phase1 では `StandardRewardHistory` の CRUD を一切触らない前提
  - TypeScript 型だけ `insuranceKind` を追加
  - 既存のコードで `StandardRewardHistory` を読み込む箇所は、`as StandardRewardHistory` などの型アサーションを使用して最低限動くようにする
  - もし Phase1 のどこかで新規作成するコードがある場合は、一時的に `insuranceKind: 'health'` を固定で入れる（本番データなし前提のため、テスト用として割り切り）

---

## 7. テスト観点（Phase1 時点で追加・更新すべきテスト）

### 7-1. `standard-reward-resolver.ts` のテスト

#### テストケース

1. **正常系**
   - 報酬月額が等級表の範囲内にある場合、正しい等級・標準報酬を返す
   - 複数の等級表バンドがある場合、正しいバンドを選択する

2. **境界値**
   - `lowerLimit` ちょうどの場合
   - `upperLimit` ちょうどの場合
   - `lowerLimit` より1円少ない場合
   - `upperLimit` より1円多い場合

3. **頭打ち処理**
   - 報酬月額が最大等級の上限を超えた場合、最大等級を返す

4. **異常系**
   - `salary <= 0` の場合、`null` を返す
   - `bands` が空配列の場合、`null` を返す
   - `healthTable` / `pensionTable` が `null` / `undefined` の場合、`null` を返す

5. **下限未満**
   - 報酬月額が最小等級の下限未満の場合、`null` を返す（異常値として扱う）

### 7-2. `premium-calculator.ts` のテスト

#### テストケース

1. **正常系**
   - `healthStandardMonthly` / `pensionStandardMonthly` に値がある場合、正しく計算される
   - 健保・厚年で異なる標準報酬月額が設定されている場合、それぞれ正しく計算される
   - 介護保険は `healthStandardMonthly` を使用して計算される

2. **標準報酬が null または 0 以下の場合（保険種別ごとのスキップ）**
   - `healthStandardMonthly` が `null` または `<= 0` の場合、
     - 健康保険・介護保険の金額は 0 になる
     - 戻り値の `healthStandardMonthly` / `healthGrade` は 0 で保存される（DataQuality で欠落として検知される）
   - `pensionStandardMonthly` が `null` または `<= 0` の場合、
     - 厚生年金の金額は 0 になる
     - 戻り値の `pensionStandardMonthly` / `pensionGrade` は 0 で保存される
   - 両方 `null` または `<= 0` の場合、`null` を返す（全保険種別をスキップ）

3. **等級が未設定の場合（保険種別ごとのスキップ）**
   - `healthGrade` が `null` だが `pensionGrade` は設定されている場合、
     - 健康保険・介護保険の金額は 0 になる
     - 厚生年金のみ計算される
   - `pensionGrade` が `null` だが `healthGrade` は設定されている場合、
     - 厚生年金の金額は 0 になる
     - 健康保険・介護保険のみ計算される
   - 両方の等級が `null` の場合、`null` を返す

4. **保険料免除の場合**
   - `premiumTreatment === 'exempt'` の場合、金額はすべて 0 になるが、
     - `healthStandardMonthly` / `pensionStandardMonthly` はスナップショットとして保持される

5. **`MonthlyPremiumCalculationResult` のフィールド確認**
   - `healthStandardMonthly` / `pensionStandardMonthly` が正しく設定されているか
   - 健保・厚年で異なる標準報酬が設定されている場合、それぞれ正しく反映されているか
   - 片方の標準報酬や等級が未設定の場合、
     - その保険種別の金額・スナップショットが 0 になること
     - もう片方は正しく計算されること


### 7-3. `monthly-premiums.service.ts` のテスト

#### テストケース

1. **`fromCalculationResult()` の動作確認**
   - `MonthlyPremiumCalculationResult` から `MonthlyPremium` への変換が正しく行われるか
   - `healthStandardMonthly` / `pensionStandardMonthly` が正しく設定されるか

2. **`saveForMonth()` の動作確認**
   - 計算結果が正しく `MonthlyPremium` レコードとして保存されるか
   - 標準報酬が `null` の従業員はスキップされるか

### 7-4. 統合テスト

1. **既存の月次保険料画面がコンパイルエラーなく動くか**
   - 表示は旧ままでも可（Phase5 で本格改修）

2. **型定義の変更による影響**
   - `Employee` / `StandardRewardHistory` / `MonthlyPremium` の型変更が他のファイルに影響していないか

---

## 8. 今後のフェーズへの引き継ぎメモ

### 8-1. Phase2 への引き継ぎ

1. **従業員フォームでの自動等級決定**
   - `standard-reward-resolver.ts` の `resolveHealthStandardFromSalary()` / `resolvePensionStandardFromSalary()` を使用
   - `MastersService.getRatesForYearMonth()` から `HealthRateTable` / `PensionRateTable` を取得する必要がある（現状は料率のみを返しているため、拡張が必要になる可能性がある）

2. **`decisionYearMonth` の導入**
   - フォームに標準報酬決定年月の入力欄を追加
   - この `decisionYearMonth` を使ってマスタを取得

3. **`GradeDecisionSource` の使用**
   - `'auto_from_salary'` / `'manual_override'` を実際に使用

### 8-2. Phase3 への引き継ぎ

1. **`StandardRewardHistory` の `insuranceKind` 対応**
   - Phase1 で型定義のみ追加したため、Phase3 で CRUD ロジックを改修する必要がある
   - 履歴の一覧取得・追加・更新・削除で `insuranceKind` を適切に扱う

2. **Employee と StandardRewardHistory の同期**
   - 履歴 → Employee 方向の同期ロジックを実装
   - Employee → 履歴 方向の自動追加ロジックを実装

### 8-3. Phase4 への引き継ぎ

1. **CSV インポート時の自動計算**
   - `standard-reward-resolver.ts` を使用して等級・標準報酬を自動決定
   - `GradeDecisionSource = 'imported'` を設定

### 8-4. Phase5 への引き継ぎ

1. **書類生成での標準報酬解決**
   - `DocumentGeneratorService.resolveStandardMonthlyReward()` を保険種別対応に変更
   - `insuranceKind` パラメータを追加

2. **データ品質チェックの本格改修**
   - 「標準報酬未決定」系の issue を明確化
   - エラーメッセージの改善

---

## 9. 実装チェックリスト

### 9-1. 型定義の変更

- [ ] `Employee.monthlyWage` を optional に変更し、`@deprecated` コメントを追加
- [ ] `PayrollSettings` インターフェースに `insurableMonthlyWage: number | null` を追加
- [ ] `Employee.healthGrade` / `pensionGrade` / `healthStandardMonthly` / `pensionStandardMonthly` を `| null` に対応
- [ ] `GradeDecisionSource` 型を拡張（`'auto_from_salary'` / `'manual_override'` を追加）
- [ ] `InsuranceKind` 型を新規追加
- [ ] `StandardRewardHistory` に `insuranceKind` と `grade` を追加
- [ ] 既存の `StandardRewardHistory` を読み込む箇所に型アサーションを追加（必要に応じて）

### 9-2. 標準報酬決定ユーティリティの実装

- [ ] `src/app/utils/standard-reward-resolver.ts` を新規作成
- [ ] `resolveHealthStandardFromSalary()` を実装
- [ ] `resolvePensionStandardFromSalary()` を実装
- [ ] 境界値・異常系のテストケースを実装

### 9-3. 保険料計算ロジックの改修

- [ ] `calculateMonthlyPremiumForEmployee()` のコメントを更新
- [ ] `monthlyWage` の参照を削除
- [ ] `canCalcHealth` / `canCalcPension` をそれぞれ計算するロジックを追加
- [ ] `healthStandardMonthly` / `pensionStandardMonthly` を使用するように変更（保険種別ごとに条件分岐）
- [ ] 両方とも計算不可の場合は `null` を返す、片方だけ計算可能な場合はその保険種別だけ計算するロジックを実装
- [ ] 戻り値の `healthStandardMonthly` / `pensionStandardMonthly` を正しく設定（計算不可の場合は 0）

### 9-4. 他ファイルへの影響対応

- [ ] `monthly-premiums.service.ts` の動作確認
- [ ] `data-quality.service.ts` の `null` チェック確認
- [ ] `masters.service.ts` のインターフェース確認（コメント追加）
- [ ] コンパイルエラーの解消

### 9-5. テスト

- [ ] `standard-reward-resolver.ts` のテストを追加
- [ ] `premium-calculator.ts` のテストを更新
- [ ] 統合テストの実行

---

## 10. 参考資料

- `STANDARD_REWARD_REFACTORING_PLAN.md`: 大規模改良方針書
- `STANDARD_REWARD_ANALYSIS.md`: 現状分析レポート
- `src/app/types.ts`: 型定義
- `src/app/utils/premium-calculator.ts`: 保険料計算ロジック（現行）
- `src/app/services/masters.service.ts`: マスタサービス

