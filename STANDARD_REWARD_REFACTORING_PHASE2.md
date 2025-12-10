# Phase2 実装指示書：従業員フォーム & シミュレーターでの自動等級決定

## 改訂履歴
- 2025年1月: 初版作成
- 2025年1月: 修正版（MastersServiceの戻り値型統一、関数名の重複解消、手動上書き検知ロジックの改善、Firestoreクエリスタイルの統一、gradeのmax値の注意点、valueChangesのクリーンアップ）

---

## 1. 概要 (Overview)

### 1-1. Phase2 の目的

Phase2 では、**ユーザー入力から正しい標準報酬が落ちてくるようにする**ことを目的とします。

具体的には：

1. 従業員フォームで `payrollSettings.insurableMonthlyWage`（報酬月額）と `decisionYearMonth`（標準報酬決定年月）を入力すると、対象年月の健保マスタ / 厚年マスタから等級・標準報酬を自動決定する
2. `healthGrade` / `healthStandardMonthly` と `pensionGrade` / `pensionStandardMonthly` が自動的に埋まる
3. `GradeDecisionSource`（`'auto_from_salary'` / `'manual_override'` など）が適切にセットされる
4. シミュレーター画面でも同じロジックを使って、報酬月額と決定年月から自動で健保／厚年の標準報酬を決定できる
5. フォーム保存時に `Employee` に正しくフィールドが保存され、`monthlyWage` は今後使わない

### 1-2. Phase1 の結果を前提とした「今の世界観」

Phase1 の実装により、以下の状態になっています：

- **計算ロジック**: `premium-calculator.ts` は既に新ロジックに置き換え済み
  - 健康保険: `Employee.healthStandardMonthly` を使用
  - 厚生年金: `Employee.pensionStandardMonthly` を使用
  - 介護保険: `Employee.healthStandardMonthly` を使用（40〜64歳のみ）
  - `monthlyWage` は deprecated で、計算には使用しない

- **標準報酬決定ユーティリティ**: `standard-reward-resolver.ts` が実装済み
  - `resolveHealthStandardFromSalary(salary, healthTable)` → `{ grade, standardMonthly } | null`
  - `resolvePensionStandardFromSalary(salary, pensionTable)` → `{ grade, standardMonthly } | null`

- **データモデル**: `Employee` 型が更新済み
  - `payrollSettings.insurableMonthlyWage: number | null`（報酬月額）
  - `healthGrade` / `healthStandardMonthly` / `healthGradeSource`
  - `pensionGrade` / `pensionStandardMonthly` / `pensionGradeSource`
  - `monthlyWage?: number`（deprecated、optional）

- **月次保険料スナップショット**: `MonthlyPremium` に `healthStandardMonthly` / `pensionStandardMonthly` が保存される

### 1-3. Phase2 で実現する状態

Phase2 完了時点で：

- 従業員フォームから報酬月額と決定年月を入力すると、自動的に健保・厚年の等級・標準報酬が決定される
- ユーザーが手動で等級・標準報酬を変更した場合、`GradeDecisionSource` が `'manual_override'` に切り替わる
- シミュレーターでも同じロジックで自動等級決定ができる
- 従業員一覧・マイページで新しい標準報酬フィールドが表示される（Phase2 の範囲で必要な箇所のみ）
- `premium-calculator` は Phase1 で既に新ロジックになっているため、フォームで正しくデータが保存されれば自動的に正しい保険料計算が動き始める

---

## 2. 対象ファイル (Scope / Target Files)

### 2-1. 主な変更対象ファイル

| ファイルパス | 変更内容 | 優先度 |
|------------|---------|--------|
| `src/app/pages/employees/employee-form-dialog.component.ts` | フォーム項目追加、自動計算ロジック実装、手動上書き検知 | **必須** |
| `src/app/pages/employees/employee-form-dialog.component.html` | フォームテンプレートの更新（decisionYearMonth追加、monthlyWage非表示化） | **必須** |
| `src/app/services/employees.service.ts` | 保存ロジックの更新（healthStandardMonthly/pensionStandardMonthly保存、monthlyWage非保存） | **必須** |
| `src/app/pages/simulator/simulator.page.ts` | シミュレーターでの自動等級決定ロジック実装 | **必須** |
| `src/app/pages/simulator/simulator.page.html` | シミュレーターUIの更新（decisionYearMonth追加、標準報酬フィールド追加） | **必須** |
| `src/app/services/masters.service.ts` | マスタテーブル取得メソッドの追加（Phase2で使用） | **必須** |
| `src/app/pages/employees/employees.page.ts` | 従業員一覧の表示列調整（monthlyWage → healthStandardMonthly/pensionStandardMonthly） | **推奨** |
| `src/app/pages/employees/employees.page.html` | 一覧テンプレートの更新 | **推奨** |
| `src/app/pages/me/my-page.ts` | マイページの表示調整（既にhealthStandardMonthly/pensionStandardMonthlyを表示しているため、確認のみ） | **確認** |

### 2-2. 参照のみ（変更なし）のファイル

| ファイルパス | 確認内容 |
|------------|---------|
| `src/app/utils/standard-reward-resolver.ts` | Phase1 で実装済み、Phase2 で使用する |
| `src/app/utils/premium-calculator.ts` | Phase1 で改修済み、Phase2 では使用のみ |
| `src/app/types.ts` | Phase1 で更新済み、Phase2 では参照のみ |

### 2-3. Phase3 以降で対応するファイル

| ファイルパス | Phase2での対応 | 本格改修フェーズ |
|------------|--------------|----------------|
| `src/app/services/standard-reward-history.service.ts` | 変更なし | Phase3 |
| `src/app/pages/employees/standard-reward-history-form-dialog.component.ts` | 変更なし | Phase3 |
| `src/app/pages/employees/employee-detail-dialog.component.ts` | 変更なし（標準報酬履歴タブは Phase3 で対応） | Phase3 |

---

## 3. フォーム項目とフィールドマッピング

### 3-1. 従業員フォームの FormControl と `Employee` 型の対応関係

#### 既存の FormControl（Phase2 で維持）

```typescript
// 基本情報（変更なし）
name: FormControl<string>
kana: FormControl<string>
birthDate: FormControl<string>
// ... その他の基本情報 ...

// 給与基本情報（既存）
payrollPayType: FormControl<string>
payrollPayCycle: FormControl<string>
payrollInsurableMonthlyWage: FormControl<number | null>  // ← 報酬月額（既存）
payrollNote: FormControl<string>
```

#### Phase2 で追加する FormControl

```typescript
// 標準報酬決定年月（新規追加）
decisionYearMonth: FormControl<YearMonthString>  // 例: '2025-07'

// 健康保険の等級・標準報酬（既存だが、自動計算で更新される）
healthGrade: FormControl<number | null>
healthStandardMonthly: FormControl<number | null>  // ← 新規追加
healthGradeSource: FormControl<GradeDecisionSource | null>  // ← 新規追加

// 厚生年金の等級・標準報酬（既存だが、自動計算で更新される）
pensionGrade: FormControl<number | null>
pensionStandardMonthly: FormControl<number | null>  // ← 新規追加
pensionGradeSource: FormControl<GradeDecisionSource | null>  // ← 新規追加
```

#### Phase2 で非表示化・削除する FormControl

```typescript
// DEPRECATED: フォーム上では非表示にする（または完全削除）
monthlyWage: FormControl<number>  // ← 非表示化 or 削除
```

### 3-2. `Employee` 型への保存時のマッピング

```typescript
// 保存時に Employee オブジェクトに変換する際のマッピング

Employee {
  // 給与基本情報
  payrollSettings: {
    payType: formValue.payrollPayType,
    payCycle: formValue.payrollPayCycle,
    insurableMonthlyWage: formValue.payrollInsurableMonthlyWage,  // ← 報酬月額
    note: formValue.payrollNote
  },

  // 健康保険
  healthGrade: formValue.healthGrade,
  healthStandardMonthly: formValue.healthStandardMonthly,  // ← 自動計算 or 手動入力
  healthGradeSource: formValue.healthGradeSource,  // ← 'auto_from_salary' or 'manual_override'

  // 厚生年金
  pensionGrade: formValue.pensionGrade,
  pensionStandardMonthly: formValue.pensionStandardMonthly,  // ← 自動計算 or 手動入力
  pensionGradeSource: formValue.pensionGradeSource,  // ← 'auto_from_salary' or 'manual_override'

  // monthlyWage は保存しない（deprecated）
}
```

### 3-3. `decisionYearMonth` の扱い

**方針**: `decisionYearMonth` はフォーム項目として持つが、`Employee` 型には保存しない（Phase3 で `StandardRewardHistory.decisionYearMonth` として保存する）

**理由**:
- Phase2 では標準報酬履歴の CRUD を触らない
- `decisionYearMonth` は「どのマスタを使うか」を決めるための一時的な入力値
- Phase3 で履歴を追加する際に、この `decisionYearMonth` を `StandardRewardHistory.decisionYearMonth` として保存する

**実装方針**:
- フォームに `decisionYearMonth: FormControl<YearMonthString>` を追加
- 初期値は「今日の年月」（`new Date().toISOString().substring(0, 7)`）
- ユーザーが変更可能
- 保存時は `Employee` には含めない（フォーム内でのみ使用）

---

## 4. 自動計算フロー（従業員フォーム）

### 4-1. 自動計算のトリガー

以下のイベントで自動計算を実行する：

1. **報酬月額（`payrollInsurableMonthlyWage`）が変更されたとき**
2. **標準報酬決定年月（`decisionYearMonth`）が変更されたとき**
3. **フォーム初期化時（既存従業員を編集する場合）**

### 4-2. 自動計算フローのステップ（概念説明）

**注意**: このセクションは「アルゴリズムの手順」を概念的に説明するものです。実際の実装コードは **5章の共通ヘルパー関数**（`calculateStandardRewardsFromSalary`）に集約されます。

#### ステップ1: 入力値の取得

フォームから以下の値を取得します：

- `payrollInsurableMonthlyWage`（報酬月額）
- `decisionYearMonth`（標準報酬決定年月）

バリデーション: 報酬月額が 0 以下または null の場合はスキップ、決定年月が未設定の場合もスキップ

#### ステップ2: マスタの取得と等級・標準報酬の決定

1. 事業所情報を取得
2. `MastersService` から対象年月の `HealthRateTable` / `PensionRateTable` を取得
3. `standard-reward-resolver.ts` の resolver 関数を使って、報酬月額から等級・標準報酬を決定
   - 健康保険: `resolveHealthStandardFromSalary(salary, healthTable)`
   - 厚生年金: `resolvePensionStandardFromSalary(salary, pensionTable)`

#### ステップ3: フォームへの反映とエラー処理

1. 計算結果をフォームに反映
   - `healthGrade` / `healthStandardMonthly` / `healthGradeSource = 'auto_from_salary'`
   - `pensionGrade` / `pensionStandardMonthly` / `pensionGradeSource = 'auto_from_salary'`
2. resolver が `null` を返した場合（マスタ未設定、範囲外など）は、エラーメッセージを設定

**実装の詳細**: 実際のコードは **5章の共通ヘルパー関数**（`calculateStandardRewardsFromSalary`）に集約され、コンポーネント側ではこの関数を呼び出すだけになります。

### 4-3. resolver が `null` を返した場合の扱い（概念説明）

#### エラーケースの分類

共通ヘルパー関数（`calculateStandardRewardsFromSalary`）内で以下のエラーケースを処理します：

1. **マスタが未設定**: 対象年月の `HealthRateTable` / `PensionRateTable` が存在しない
2. **等級表の bands が空**: マスタは存在するが、等級表が空
3. **報酬月額が範囲外**: 報酬月額が最小等級の下限未満（異常値として扱う）

#### エラーメッセージの扱い

共通ヘルパー関数は `StandardRewardCalculationResult.errors` にエラーメッセージを返します。コンポーネント側では、このエラー情報を受け取って表示します。

**実装の詳細**: エラーメッセージの生成は共通ヘルパー関数内で行われ、コンポーネント側では結果を受け取るだけです（5章参照）。

#### 保存ボタンの無効化

```typescript
// フォームのバリデーション状態を確認
// 健康保険または厚生年金の標準報酬が決定できない場合は、保存を許可しない
get canSave(): boolean {
  const healthStandardMonthly = this.form.get('healthStandardMonthly')?.value;
  const pensionStandardMonthly = this.form.get('pensionStandardMonthly')?.value;
  
  // 両方とも null の場合は保存不可
  if (!healthStandardMonthly && !pensionStandardMonthly) {
    return false;
  }
  
  // フォームのバリデーションエラーがある場合は保存不可
  return this.form.valid;
}
```

### 4-4. フォーム初期化時の自動計算

既存従業員を編集する場合、フォーム初期化時に自動計算を実行します：

1. 既存従業員のデータをフォームに設定
2. `decisionYearMonth` の初期値は「今日の年月」（ユーザーが変更可能）
3. 報酬月額が設定されている場合は、自動計算を実行（`recalculateStandardRewardsFromForm()` を呼び出す）

**実装の詳細**: コンポーネント側の実装例は **5章の「従業員フォームでの使用」** セクションを参照してください。

---

## 5. シミュレーターでの自動等級決定

### 5-1. シミュレーターの現状

現状の `simulator.page.ts` では：

- `monthlyWage` を入力して、`healthGrade` / `pensionGrade` を手動入力
- `tempEmployee` を作成して `premium-calculator` に渡している
- `healthStandardMonthly` / `pensionStandardMonthly` は `monthlyWage` と同じ値にしている（旧仕様）

### 5-2. Phase2 での変更方針

#### フォーム項目の変更

```typescript
// Before（現状）
readonly form = this.fb.group({
  yearMonth: FormControl<YearMonthString>,  // 計算対象年月
  monthlyWage: FormControl<number | null>,  // ← 報酬月額（旧名称）
  healthGrade: FormControl<number | null>,  // 手動入力
  pensionGrade: FormControl<number | null>,  // 手動入力
  isCareInsuranceTarget: FormControl<boolean>
});

// After（Phase2）
readonly form = this.fb.group({
  yearMonth: FormControl<YearMonthString>,  // 計算対象年月
  decisionYearMonth: FormControl<YearMonthString>,  // ← 標準報酬決定年月（新規追加）
  salary: FormControl<number | null>,  // ← 報酬月額（名称変更）
  healthGrade: FormControl<number | null>,  // 自動計算 or 手動入力
  healthStandardMonthly: FormControl<number | null>,  // ← 自動計算 or 手動入力（新規追加）
  pensionGrade: FormControl<number | null>,  // 自動計算 or 手動入力
  pensionStandardMonthly: FormControl<number | null>,  // ← 自動計算 or 手動入力（新規追加）
  isCareInsuranceTarget: FormControl<boolean>
});
```

#### 共通ヘルパー関数の実装

従業員フォームとシミュレーターで共通のロジックを再利用するため、共通ヘルパー関数を作成します。

**重要**: この共通ヘルパー関数が、マスタ取得・resolver呼び出し・エラーメッセージ生成まで全てを担当します。コンポーネント側は「フォームから値を取り→helper を呼び→結果を patch」だけを行います。

```typescript
// 新規ファイル: src/app/utils/standard-reward-calculator.ts
// （または既存のファイルに追加）

import { Office, YearMonthString } from '../types';
import { MastersService } from '../services/masters.service';
import { resolveHealthStandardFromSalary, resolvePensionStandardFromSalary } from './standard-reward-resolver';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';

export interface StandardRewardCalculationResult {
  healthGrade: number | null;
  healthStandardMonthly: number | null;
  pensionGrade: number | null;
  pensionStandardMonthly: number | null;
  errors: {
    health?: string;
    pension?: string;
  };
}

/**
 * 報酬月額と決定年月から標準報酬を自動計算する共通ヘルパー関数
 * 
 * @param office - 事業所情報
 * @param salary - 報酬月額
 * @param decisionYearMonth - 標準報酬決定年月
 * @param mastersService - MastersService インスタンス
 * @returns 計算結果とエラー情報
 */
export async function calculateStandardRewardsFromSalary(
  office: Office,
  salary: number,
  decisionYearMonth: YearMonthString,
  mastersService: MastersService
): Promise<StandardRewardCalculationResult> {
  const result: StandardRewardCalculationResult = {
    healthGrade: null,
    healthStandardMonthly: null,
    pensionGrade: null,
    pensionStandardMonthly: null,
    errors: {}
  };

  if (!salary || salary <= 0) {
    return result;
  }

  // マスタの取得
  const healthTable = await firstValueFrom(
    mastersService.getHealthRateTableForYearMonth(office, decisionYearMonth)
  );
  const pensionTable = await firstValueFrom(
    mastersService.getPensionRateTableForYearMonth(office, decisionYearMonth)
  );

  // 健康保険の計算
  const healthResult = resolveHealthStandardFromSalary(salary, healthTable);
  if (healthResult) {
    result.healthGrade = healthResult.grade;
    result.healthStandardMonthly = healthResult.standardMonthly;
  } else {
    if (!healthTable) {
      result.errors.health = `対象年月（${decisionYearMonth}）の健康保険マスタが設定されていません。`;
    } else if (!healthTable.bands || healthTable.bands.length === 0) {
      result.errors.health = `対象年月（${decisionYearMonth}）の健康保険等級表が設定されていません。`;
    } else {
      result.errors.health = `報酬月額（${salary}円）が健康保険等級表の範囲外です。`;
    }
  }

  // 厚生年金の計算
  const pensionResult = resolvePensionStandardFromSalary(salary, pensionTable);
  if (pensionResult) {
    result.pensionGrade = pensionResult.grade;
    result.pensionStandardMonthly = pensionResult.standardMonthly;
  } else {
    if (!pensionTable) {
      result.errors.pension = `対象年月（${decisionYearMonth}）の厚生年金マスタが設定されていません。`;
    } else if (!pensionTable.bands || pensionTable.bands.length === 0) {
      result.errors.pension = `対象年月（${decisionYearMonth}）の厚生年金等級表が設定されていません。`;
    } else {
      result.errors.pension = `報酬月額（${salary}円）が厚生年金等級表の範囲外です。`;
    }
  }

  return result;
}
```

#### 従業員フォームでの使用

**実装方針**: コンポーネント側は「フォームから値を取り→helper を呼び→結果を patch」だけを行います。

```typescript
// employee-form-dialog.component.ts

import { calculateStandardRewardsFromSalary } from '../../utils/standard-reward-calculator';

// エラー状態を管理するためのプロパティ
protected healthCalculationError: string | null = null;
protected pensionCalculationError: string | null = null;

// 自動計算済みの値を記録（手動変更を検知するため）
private autoCalculatedHealthGrade: number | null = null;
private autoCalculatedHealthStandardMonthly: number | null = null;
private autoCalculatedPensionGrade: number | null = null;
private autoCalculatedPensionStandardMonthly: number | null = null;

/**
 * フォームから値を取得して標準報酬を自動計算し、結果をフォームに反映する
 */
private async recalculateStandardRewardsFromForm(): Promise<void> {
  const salary = this.form.get('payrollInsurableMonthlyWage')?.value;
  const decisionYearMonth = this.form.get('decisionYearMonth')?.value as YearMonthString | null;

  // バリデーション: 報酬月額が 0 以下または null の場合はスキップ
  if (!salary || salary <= 0 || !decisionYearMonth) {
    return;
  }

  // 事業所情報を取得
  const office = await firstValueFrom(this.office$);  // または適切な方法で取得
  if (!office) {
    return;
  }

  // 共通ヘルパー関数を呼び出し（マスタ取得・resolver・エラー生成まで全て担当）
  const result = await calculateStandardRewardsFromSalary(
    office,
    salary,
    decisionYearMonth,
    this.mastersService
  );

  // 自動計算値を記録（手動変更検知のため）
  this.autoCalculatedHealthGrade = result.healthGrade;
  this.autoCalculatedHealthStandardMonthly = result.healthStandardMonthly;
  this.autoCalculatedPensionGrade = result.pensionGrade;
  this.autoCalculatedPensionStandardMonthly = result.pensionStandardMonthly;

  // フォームに結果を反映
  this.form.patchValue({
    healthGrade: result.healthGrade,
    healthStandardMonthly: result.healthStandardMonthly,
    healthGradeSource: result.healthGrade ? 'auto_from_salary' : null,
    pensionGrade: result.pensionGrade,
    pensionStandardMonthly: result.pensionStandardMonthly,
    pensionGradeSource: result.pensionGrade ? 'auto_from_salary' : null
  }, { emitEvent: false });  // emitEvent: false で再計算ループを防ぐ

  // エラーメッセージを設定
  this.healthCalculationError = result.errors.health ?? null;
  this.pensionCalculationError = result.errors.pension ?? null;
}
```

#### シミュレーターでの使用

```typescript
// simulator.page.ts

import { calculateStandardRewardsFromSalary } from '../../utils/standard-reward-calculator';

async onSimulate(): Promise<void> {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  try {
    this.loading.set(true);

    const office = await firstValueFrom(this.office$);
    if (!office) {
      this.calculationResult.set(null);
      this.snackBar.open('事業所情報を取得できませんでした', '閉じる', { duration: 3000 });
      return;
    }

    const formValue = this.form.value;
    const yearMonth = formValue.yearMonth as string;
    const salary = Number(formValue.salary);
    const decisionYearMonth = formValue.decisionYearMonth as string;
    const isCareInsuranceTarget = formValue.isCareInsuranceTarget === true;

    // 自動計算を実行
    const calculationResult = await calculateStandardRewardsFromSalary(
      office,
      salary,
      decisionYearMonth,
      this.mastersService
    );

    // フォームに結果を反映
    this.form.patchValue({
      healthGrade: calculationResult.healthGrade,
      healthStandardMonthly: calculationResult.healthStandardMonthly,
      pensionGrade: calculationResult.pensionGrade,
      pensionStandardMonthly: calculationResult.pensionStandardMonthly
    }, { emitEvent: false });

    // エラーがある場合は表示
    if (calculationResult.errors.health) {
      this.snackBar.open(calculationResult.errors.health, '閉じる', { duration: 5000 });
    }
    if (calculationResult.errors.pension) {
      this.snackBar.open(calculationResult.errors.pension, '閉じる', { duration: 5000 });
    }

    // 保険料計算用の Employee オブジェクトを作成
    const tempEmployee: Employee = {
      id: 'temp',
      officeId: office.id,
      name: 'シミュレーション用',
      birthDate: isCareInsuranceTarget ? '1980-01-01' : '2005-01-01',
      hireDate: '2000-01-01',
      employmentType: 'regular',
      isInsured: true,
      healthGrade: calculationResult.healthGrade ?? undefined,
      healthStandardMonthly: calculationResult.healthStandardMonthly ?? undefined,
      pensionGrade: calculationResult.pensionGrade ?? undefined,
      pensionStandardMonthly: calculationResult.pensionStandardMonthly ?? undefined
      // monthlyWage は使用しない
    };

    // 以降の保険料計算処理...
  } finally {
    this.loading.set(false);
  }
}
```

### 5-3. シミュレーターでの手動上書き

シミュレーターでも、ユーザーが等級・標準報酬を手動で変更できるようにする：

- `healthGrade` / `healthStandardMonthly` / `pensionGrade` / `pensionStandardMonthly` は手動入力可能
- 自動計算後、ユーザーが手動で変更した場合はその値を使用
- `GradeDecisionSource` はシミュレーターでは管理しない（一時的な計算用のため）

---

## 6. 手動上書きの扱い

### 6-1. 手動上書きの検知

ユーザーが `healthGrade` / `healthStandardMonthly` / `pensionGrade` / `pensionStandardMonthly` をフォーム上で手動修正した場合、`GradeDecisionSource` を `'manual_override'` に変更する。

#### 実装方針

```typescript
// employee-form-dialog.component.ts

private readonly destroyRef = inject(DestroyRef);

ngOnInit() {
  // フォーム初期化...
  
  // 自動計算済みの値を記録（手動変更を検知するため）
  this.autoCalculatedHealthGrade = null;
  this.autoCalculatedHealthStandardMonthly = null;
  this.autoCalculatedPensionGrade = null;
  this.autoCalculatedPensionStandardMonthly = null;
  
  // GradeDecisionSource の初期値を設定
  // 既存従業員を編集する場合、既存の GradeDecisionSource を使用
  // 新規作成の場合、初期値は null（自動計算が走ったら 'auto_from_salary' に更新）
  // 一度も自動計算を走らせずに手入力した場合は、手動変更検知ロジックで 'manual_override' に設定される
  
  // フォーム値変更を監視（メモリリークを防ぐため takeUntilDestroyed を使用）
  this.form.get('healthGrade')?.valueChanges
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe((value) => {
      this.onHealthGradeChanged(value);
    });
  this.form.get('healthStandardMonthly')?.valueChanges
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe((value) => {
      this.onHealthStandardMonthlyChanged(value);
    });
  this.form.get('pensionGrade')?.valueChanges
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe((value) => {
      this.onPensionGradeChanged(value);
    });
  this.form.get('pensionStandardMonthly')?.valueChanges
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe((value) => {
      this.onPensionStandardMonthlyChanged(value);
    });
}

private autoCalculatedHealthGrade: number | null = null;
private autoCalculatedHealthStandardMonthly: number | null = null;
private autoCalculatedPensionGrade: number | null = null;
private autoCalculatedPensionStandardMonthly: number | null = null;

private onHealthGradeChanged(value: number | null): void {
  // 自動計算値と異なる場合は手動上書きとみなす
  // 自動計算を一度も走らせていない場合（autoCalculatedHealthGrade === null）でも、
  // 値が入力されていれば手動入力とみなす
  if (value != null && value > 0) {
    if (this.autoCalculatedHealthGrade === null || value !== this.autoCalculatedHealthGrade) {
      this.form.patchValue({ healthGradeSource: 'manual_override' }, { emitEvent: false });
    }
  }
}

private onHealthStandardMonthlyChanged(value: number | null): void {
  // 同様に、自動計算を一度も走らせていない場合でも、値が入力されていれば手動入力とみなす
  if (value != null && value > 0) {
    if (this.autoCalculatedHealthStandardMonthly === null || 
        value !== this.autoCalculatedHealthStandardMonthly) {
      this.form.patchValue({ healthGradeSource: 'manual_override' }, { emitEvent: false });
    }
  }
}

// 同様に pensionGrade / pensionStandardMonthly の変更も監視
```

#### 自動計算時の値の記録

```typescript
// 自動計算を実行した際に、計算結果を記録
// 注意: コンポーネント内メソッド名は recalculateStandardRewardsFromForm として、
// ユーティリティ関数 calculateStandardRewardsFromSalary と区別する
private async recalculateStandardRewardsFromForm(): Promise<void> {
  // ... 自動計算処理（共通ヘルパー関数 calculateStandardRewardsFromSalary を使用） ...
  
  if (healthResult) {
    this.autoCalculatedHealthGrade = healthResult.grade;
    this.autoCalculatedHealthStandardMonthly = healthResult.standardMonthly;
    
    this.form.patchValue({
      healthGrade: healthResult.grade,
      healthStandardMonthly: healthResult.standardMonthly,
      healthGradeSource: 'auto_from_salary'  // 自動計算が走ったら 'auto_from_salary' に設定
    }, { emitEvent: false });
  }
  
  // 同様に pension も記録
}
```

### 6-2. 初回編集ケースの扱い

**問題**: 自動計算を一度も走らせずに、いきなり手入力で値を入れた場合、`autoCalculatedHealthGrade` は `null` のままになり、`valueChanges` では比較できないため `GradeDecisionSource` が更新されない。

**解決策**:
- **初期値の方針**: 
  - 既存従業員を編集する場合: 既存の `healthGradeSource` / `pensionGradeSource` を使用
  - 新規作成の場合: 初期値は `null`（自動計算が走ったら `'auto_from_salary'` に更新）
- **手動変更検知ロジック**: 
  - 自動計算を一度も走らせていない場合（`autoCalculatedHealthGrade === null`）でも、値が入力されていれば手動入力とみなす
  - 自動計算が走った瞬間に `'auto_from_salary'` に上書き
  - その後人が変えたら `'manual_override'` に戻す

**実装例**:
```typescript
private onHealthGradeChanged(value: number | null): void {
  // 自動計算を一度も走らせていない場合でも、値が入力されていれば手動入力とみなす
  if (value != null && value > 0) {
    if (this.autoCalculatedHealthGrade === null || value !== this.autoCalculatedHealthGrade) {
      this.form.patchValue({ healthGradeSource: 'manual_override' }, { emitEvent: false });
    }
  }
}
```

### 6-3. UX の考慮

- **自動計算した値と手動上書きの切り替え**: フォームで値を書き換えた瞬間に `GradeDecisionSource` を変更
- **視覚的なフィードバック**: 自動計算された値と手動入力された値を区別できるように、UI に表示を追加する（例: 自動計算値には「自動」バッジ、手動入力値には「手動」バッジ）

---

## 7. 保存ロジック (EmployeesService など)

### 7-1. `EmployeesService.save()` の更新

現状の `save()` メソッドを確認し、以下の変更を実施：

#### 変更内容

1. **`payrollSettings.insurableMonthlyWage` を保存**
   - 既存の `payrollSettings` の保存処理を確認し、`insurableMonthlyWage` が正しく保存されることを確認

2. **`healthStandardMonthly` / `pensionStandardMonthly` と `grade` / `GradeSource` の保存**
   - `Employee` 型のフィールドとして保存

3. **`monthlyWage` を今後保存しない**
   - 既存の `monthlyWage` の保存処理を削除または無視

#### 実装例

```typescript
// employees.service.ts

async save(
  officeId: string,
  employee: Partial<Employee> & { id?: string }
): Promise<string> {
  // ... 既存の処理 ...
  
  const payload: any = {
    // ... 既存の必須フィールド ...
    // monthlyWage の保存を削除
    // monthlyWage: Number(employee.monthlyWage ?? 0),  // ← この行を削除
  };
  
  // payrollSettings の保存
  if (employee.payrollSettings !== undefined) {
    payload.payrollSettings = {
      payType: employee.payrollSettings.payType,
      payCycle: employee.payrollSettings.payCycle,
      insurableMonthlyWage: employee.payrollSettings.insurableMonthlyWage ?? null,
      note: employee.payrollSettings.note ?? null
    };
  }
  
  // 健康保険の標準報酬・等級・GradeSource の保存
  if (employee.healthGrade !== undefined) payload.healthGrade = employee.healthGrade;
  if (employee.healthStandardMonthly !== undefined) payload.healthStandardMonthly = employee.healthStandardMonthly;
  if (employee.healthGradeSource !== undefined) payload.healthGradeSource = employee.healthGradeSource;
  
  // 厚生年金の標準報酬・等級・GradeSource の保存
  if (employee.pensionGrade !== undefined) payload.pensionGrade = employee.pensionGrade;
  if (employee.pensionStandardMonthly !== undefined) payload.pensionStandardMonthly = employee.pensionStandardMonthly;
  if (employee.pensionGradeSource !== undefined) payload.pensionGradeSource = employee.pensionGradeSource;
  
  // ... 既存の保存処理 ...
}
```

### 7-2. フォームからの保存処理

```typescript
// employee-form-dialog.component.ts

async submit(): Promise<void> {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  const formValue = this.form.getRawValue();
  
  // Employee オブジェクトを作成
  const employeePayload: Partial<Employee> = {
    // ... 既存のフィールド ...
    
    // 給与基本情報
    payrollSettings: {
      payType: formValue.payrollPayType as PayrollPayType,
      payCycle: formValue.payrollPayCycle as PayrollPayCycle,
      insurableMonthlyWage: formValue.payrollInsurableMonthlyWage ?? null,
      note: formValue.payrollNote ?? null
    },
    
    // 健康保険
    healthGrade: formValue.healthGrade ?? null,
    healthStandardMonthly: formValue.healthStandardMonthly ?? null,
    healthGradeSource: formValue.healthGradeSource ?? null,
    
    // 厚生年金
    pensionGrade: formValue.pensionGrade ?? null,
    pensionStandardMonthly: formValue.pensionStandardMonthly ?? null,
    pensionGradeSource: formValue.pensionGradeSource ?? null
    
    // monthlyWage は含めない
  };
  
  // 保存
  await this.employeesService.save(this.data.officeId, employeePayload);
}
```

---

## 8. 一覧・マイページ等の表示調整

### 8-1. 従業員一覧（`employees.page.ts` / `employees.page.html`）

#### 現状確認

現状の一覧では `monthlyWage` を「標準報酬月額」として表示している。

#### Phase2 での変更方針

**変更内容**:
- `monthlyWage` 列を削除または非表示化
- `healthStandardMonthly` / `pensionStandardMonthly` を表示（2列に分ける、または1列にまとめる）

**実装例**:

```html
<!-- employees.page.html -->

<!-- Before -->
<ng-container matColumnDef="monthlyWage">
  <th mat-header-cell *matHeaderCellDef>標準報酬月額</th>
  <td mat-cell *matCellDef="let row">
    {{ row.monthlyWage | number }}
  </td>
</ng-container>

<!-- After -->
<ng-container matColumnDef="healthStandardMonthly">
  <th mat-header-cell *matHeaderCellDef>健保 標準報酬</th>
  <td mat-cell *matCellDef="let row">
    {{ row.healthStandardMonthly ? (row.healthStandardMonthly | number) + '円' : '未設定' }}
  </td>
</ng-container>

<ng-container matColumnDef="pensionStandardMonthly">
  <th mat-header-cell *matHeaderCellDef>厚年 標準報酬</th>
  <td mat-cell *matCellDef="let row">
    {{ row.pensionStandardMonthly ? (row.pensionStandardMonthly | number) + '円' : '未設定' }}
  </td>
</ng-container>
```

```typescript
// employees.page.ts

displayedColumns: string[] = [
  // ... 既存の列 ...
  'healthStandardMonthly',  // ← 追加
  'pensionStandardMonthly',  // ← 追加
  // 'monthlyWage',  // ← 削除
  // ... その他の列 ...
];
```

### 8-2. マイページ（`my-page.ts` / `my-page.html`）

#### 現状確認

既に `healthStandardMonthly` / `pensionStandardMonthly` を表示しているため、**変更不要**。

ただし、表示内容を確認し、必要に応じて微調整する。

### 8-3. Phase2 で対応しない表示

以下の表示は Phase2 では対応しない（Phase3 以降で対応）：

- 標準報酬履歴の一覧表示（Phase3）
- 標準報酬履歴の詳細表示（Phase3）

---

## 9. MastersService の拡張

### 9-1. 現状の問題

現状の `MastersService.getRatesForYearMonth()` は料率のみを返すため、Phase2 で必要な `HealthRateTable` / `PensionRateTable` オブジェクト自体を取得できない。

### 9-2. 新規メソッドの追加

```typescript
// masters.service.ts

import { Observable, of, from } from 'rxjs';
import { map } from 'rxjs/operators';
// ... 既存のimport ...

/**
 * 対象年月に有効な最新の健康保険マスタ（等級表を含む）を取得する
 * 
 * 注意: 既存の MastersService の実装スタイル（Observable を返す）に合わせる
 * 既存の getHealthRateTable() や listHealthRateTables() と同じパターンで実装する
 * 
 * @param office - 事業所情報
 * @param yearMonth - 対象年月（YYYY-MM形式）
 * @returns HealthRateTable または null を返す Observable
 */
getHealthRateTableForYearMonth(
  office: Office,
  yearMonth: YearMonthString
): Observable<HealthRateTable | null> {
  const targetYear = parseInt(yearMonth.substring(0, 4), 10);
  const targetMonth = parseInt(yearMonth.substring(5, 7), 10);
  const targetYearMonth = targetYear * 100 + targetMonth;
  const officeId = office.id;

  const healthRef = this.getHealthCollectionRef(officeId);
  let healthQuery;

  if (office.healthPlanType === 'kyokai' && office.kyokaiPrefCode) {
    healthQuery = query(
      healthRef,
      where('planType', '==', 'kyokai'),
      where('kyokaiPrefCode', '==', office.kyokaiPrefCode),
      where('effectiveYearMonth', '<=', targetYearMonth),
      orderBy('effectiveYearMonth', 'desc'),
      limit(1)
    );
  } else if (office.healthPlanType === 'kumiai') {
    healthQuery = query(
      healthRef,
      where('planType', '==', 'kumiai'),
      where('effectiveYearMonth', '<=', targetYearMonth),
      orderBy('effectiveYearMonth', 'desc'),
      limit(1)
    );
  } else {
    return of(null);
  }

  // 既存の実装スタイル（from(getDocs(...)).pipe(map(...))）に合わせる
  return from(getDocs(healthQuery)).pipe(
    map((snapshot) => {
      if (snapshot.empty) {
        return null;
      }
      return {
        id: snapshot.docs[0].id,
        ...(snapshot.docs[0].data() as any)
      } as HealthRateTable;
    })
  );
}

/**
 * 対象年月に有効な最新の厚生年金マスタ（等級表を含む）を取得する
 * 
 * 注意: 既存の MastersService の実装スタイル（Observable を返す）に合わせる
 * 
 * @param office - 事業所情報
 * @param yearMonth - 対象年月（YYYY-MM形式）
 * @returns PensionRateTable または null を返す Observable
 */
getPensionRateTableForYearMonth(
  office: Office,
  yearMonth: YearMonthString
): Observable<PensionRateTable | null> {
  const targetYear = parseInt(yearMonth.substring(0, 4), 10);
  const targetMonth = parseInt(yearMonth.substring(5, 7), 10);
  const targetYearMonth = targetYear * 100 + targetMonth;
  const officeId = office.id;

  const pensionRef = this.getPensionCollectionRef(officeId);
  const pensionQuery = query(
    pensionRef,
    where('effectiveYearMonth', '<=', targetYearMonth),
    orderBy('effectiveYearMonth', 'desc'),
    limit(1)
  );

  // 既存の実装スタイル（from(getDocs(...)).pipe(map(...))）に合わせる
  return from(getDocs(pensionQuery)).pipe(
    map((snapshot) => {
      if (snapshot.empty) {
        return null;
      }
      return {
        id: snapshot.docs[0].id,
        ...(snapshot.docs[0].data() as any)
      } as PensionRateTable;
    })
  );
}
```

### 9-3. 既存メソッドへの影響

既存の `getRatesForYearMonth()` は変更しない（既存の呼び出し側への影響を避けるため）。

### 9-4. 実装時の注意事項

**Firestore クエリの実装スタイル**:
- 実装例では `from(getDocs(...)).pipe(map(...))` のパターンを示しているが、実際の実装時は既存の `MastersService` のコードを確認し、同じスタイルに合わせること
- 既存の `getHealthRateTable()` や `listHealthRateTables()` の実装を参考にする
- AngularFire の `collectionData` / `docData` など、プロジェクトで統一されているパターンがあればそれに従う

**戻り値の型**:
- 既存の `MastersService` は `Observable` を返すパターンで統一されているため、新規メソッドも `Observable<HealthRateTable | null>` / `Observable<PensionRateTable | null>` を返す
- 呼び出し側では `await firstValueFrom(...)` を使用する

---

## 10. バリデーション・エラーメッセージ

### 10-1. フォームのバリデーション条件

#### 必須項目

- `payrollInsurableMonthlyWage`: 自動計算を実行する場合は必須（ただし、0 以下は不可）
- `decisionYearMonth`: 自動計算を実行する場合は必須

#### 数値の範囲チェック

- `payrollInsurableMonthlyWage`: `Validators.min(1)`（0 以下は不可）
- `healthGrade`: `Validators.min(1)`, `Validators.max(100)`（緩い上限を設定。実際の等級はマスタの等級表で制御される）
- `pensionGrade`: `Validators.min(1)`, `Validators.max(100)`（緩い上限を設定。実際の等級はマスタの等級表で制御される）
- `healthStandardMonthly`: `Validators.min(1)`（0 以下は不可）
- `pensionStandardMonthly`: `Validators.min(1)`（0 以下は不可）

**注意**: 等級の最大値は将来的にマスタ側で変更される可能性があるため、ハードコードされた上限（47/32）ではなく、緩い上限（100など）を設定することを推奨。実際の等級はマスタの等級表（`StandardRewardBand[]`）で制御されるため、マスタに存在しない等級は自然に弾かれる。

### 10-2. resolver 失敗時のエラーメッセージ

#### エラーメッセージの定義

```typescript
// エラーメッセージの定数定義（必要に応じて）

const ERROR_MESSAGES = {
  HEALTH_MASTER_NOT_FOUND: (yearMonth: string) => 
    `対象年月（${yearMonth}）の健康保険マスタが設定されていません。マスタ管理画面で設定してください。`,
  HEALTH_BANDS_EMPTY: (yearMonth: string) => 
    `対象年月（${yearMonth}）の健康保険等級表が設定されていません。`,
  HEALTH_SALARY_OUT_OF_RANGE: (salary: number) => 
    `報酬月額（${salary.toLocaleString()}円）が健康保険等級表の範囲外です。`,
  PENSION_MASTER_NOT_FOUND: (yearMonth: string) => 
    `対象年月（${yearMonth}）の厚生年金マスタが設定されていません。マスタ管理画面で設定してください。`,
  PENSION_BANDS_EMPTY: (yearMonth: string) => 
    `対象年月（${yearMonth}）の厚生年金等級表が設定されていません。`,
  PENSION_SALARY_OUT_OF_RANGE: (salary: number) => 
    `報酬月額（${salary.toLocaleString()}円）が厚生年金等級表の範囲外です。`
};
```

### 10-3. 保存を許可する／しない条件

#### 保存可能条件

```typescript
// 以下の条件をすべて満たす場合に保存を許可

1. フォームのバリデーションエラーがない
2. 健康保険または厚生年金の標準報酬が少なくとも1つは設定されている
   - `healthStandardMonthly != null && healthStandardMonthly > 0` または
   - `pensionStandardMonthly != null && pensionStandardMonthly > 0`
3. 標準報酬が設定されている場合、対応する等級も設定されている
   - `healthStandardMonthly != null` → `healthGrade != null`
   - `pensionStandardMonthly != null` → `pensionGrade != null`
```

#### 実装例

```typescript
// employee-form-dialog.component.ts

get canSave(): boolean {
  // フォームのバリデーションエラーがある場合は保存不可
  if (this.form.invalid) {
    return false;
  }

  const healthStandardMonthly = this.form.get('healthStandardMonthly')?.value;
  const healthGrade = this.form.get('healthGrade')?.value;
  const pensionStandardMonthly = this.form.get('pensionStandardMonthly')?.value;
  const pensionGrade = this.form.get('pensionGrade')?.value;

  // 健康保険または厚生年金の標準報酬が少なくとも1つは設定されている必要がある
  const hasHealthStandard = healthStandardMonthly != null && healthStandardMonthly > 0;
  const hasPensionStandard = pensionStandardMonthly != null && pensionStandardMonthly > 0;

  if (!hasHealthStandard && !hasPensionStandard) {
    return false;
  }

  // 標準報酬が設定されている場合、対応する等級も設定されている必要がある
  if (hasHealthStandard && (!healthGrade || healthGrade <= 0)) {
    return false;
  }
  if (hasPensionStandard && (!pensionGrade || pensionGrade <= 0)) {
    return false;
  }

  return true;
}
```

---

## 11. テスト観点

### 11-1. 従業員フォームのテスト

#### 自動計算のテスト

1. **正常系**
   - 報酬月額と決定年月を入力すると、健保・厚年の等級・標準報酬が自動決定される
   - `healthGradeSource` / `pensionGradeSource` が `'auto_from_salary'` に設定される

2. **マスタ未設定**
   - 対象年月のマスタが存在しない場合、エラーメッセージが表示される
   - 標準報酬フィールドが空欄のままになる

3. **等級表が空**
   - マスタは存在するが等級表が空の場合、エラーメッセージが表示される

4. **報酬月額が範囲外**
   - 報酬月額が最小等級の下限未満の場合、エラーメッセージが表示される

5. **報酬月額変更時の再計算**
   - 報酬月額を変更すると、自動的に再計算される

6. **決定年月変更時の再計算**
   - 決定年月を変更すると、自動的に再計算される

#### 手動上書きのテスト

1. **手動変更の検知**
   - 自動計算後に等級・標準報酬を手動で変更すると、`GradeDecisionSource` が `'manual_override'` に変更される

2. **手動変更後の自動計算**
   - 手動変更後、報酬月額を変更して自動計算を実行すると、手動変更が上書きされる（または確認ダイアログを表示）

#### 保存のテスト

1. **保存データの確認**
   - 保存後に `Employee` に `healthStandardMonthly` / `pensionStandardMonthly` が正しく保存される
   - `monthlyWage` が保存されない（または無視される）

2. **保存後の保険料計算**
   - 保存後に `premium-calculator` が期待通りの標準報酬を参照すること（E2E的な観点）

### 11-2. シミュレーターのテスト

1. **自動計算の動作**
   - 報酬月額と決定年月を入力すると、健保・厚年の等級・標準報酬が自動決定される

2. **保険料計算の確認**
   - 自動決定された標準報酬を使って保険料計算が正しく実行される

3. **手動上書きの動作**
   - 自動計算後、等級・標準報酬を手動で変更できる

### 11-3. 一覧表示のテスト

1. **表示列の確認**
   - `monthlyWage` 列が非表示になっている
   - `healthStandardMonthly` / `pensionStandardMonthly` 列が表示されている

2. **データの表示**
   - 既存データの `healthStandardMonthly` / `pensionStandardMonthly` が正しく表示される

---

## 12. 実装ステップ (Step-by-step Plan)

### ステップ1: MastersService の拡張

**目的**: `HealthRateTable` / `PensionRateTable` を取得するメソッドを追加

**対象ファイル**:
- `src/app/services/masters.service.ts`

**実施内容**:
1. `getHealthRateTableForYearMonth()` メソッドを追加
2. `getPensionRateTableForYearMonth()` メソッドを追加
3. 既存の `getRatesForYearMonth()` は変更しない

**確認事項**:
- メソッドが正しく実装されているか
- 既存のコードに影響がないか

---

### ステップ2: 共通ヘルパー関数の作成

**目的**: 従業員フォームとシミュレーターで共通の自動計算ロジックを作成

**対象ファイル**:
- `src/app/utils/standard-reward-calculator.ts`（新規作成）

**実施内容**:
1. `calculateStandardRewardsFromSalary()` 関数を実装（ユーティリティ関数名）
2. エラーハンドリングを含める
3. `MastersService` の `Observable` を返すメソッドを使用する前提で実装

**確認事項**:
- 関数が正しく動作するか
- エラーケースが適切に処理されているか

---

### ステップ3: 従業員フォームのフォーム項目追加

**目的**: フォームに `decisionYearMonth` と標準報酬関連フィールドを追加

**対象ファイル**:
- `src/app/pages/employees/employee-form-dialog.component.ts`
- `src/app/pages/employees/employee-form-dialog.component.html`

**実施内容**:
1. `decisionYearMonth` FormControl を追加（初期値は今日の年月）
2. `healthStandardMonthly` FormControl を追加
3. `healthGradeSource` FormControl を追加
4. `pensionStandardMonthly` FormControl を追加
5. `pensionGradeSource` FormControl を追加
6. `monthlyWage` FormControl を非表示化または削除
7. HTML テンプレートにフォーム項目を追加

**確認事項**:
- フォーム項目が正しく追加されているか
- 初期値が正しく設定されているか

---

### ステップ4: 従業員フォームの自動計算ロジック実装

**目的**: 報酬月額と決定年月から自動的に等級・標準報酬を決定

**対象ファイル**:
- `src/app/pages/employees/employee-form-dialog.component.ts`

**実施内容**:
1. `recalculateStandardRewardsFromForm()` メソッドを実装
   - フォームから値を取得
   - 共通ヘルパー関数 `calculateStandardRewardsFromSalary` を呼び出し
   - 結果をフォームに反映（自動計算値の記録、エラーメッセージの設定も含む）
2. `payrollInsurableMonthlyWage` 変更時に `recalculateStandardRewardsFromForm()` を実行
3. `decisionYearMonth` 変更時に `recalculateStandardRewardsFromForm()` を実行
4. フォーム初期化時に自動計算を実行（既存従業員を編集する場合）
5. エラーメッセージの表示処理を実装（共通ヘルパー関数から返されたエラー情報を表示）
6. `valueChanges` の購読時に `takeUntilDestroyed` を使用してメモリリークを防ぐ

**注意**: マスタ取得・resolver呼び出し・エラーメッセージ生成は共通ヘルパー関数内で行われるため、コンポーネント側では実装不要です。

**確認事項**:
- 自動計算が正しく動作するか
- エラーケースが適切に処理されているか

---

### ステップ5: 手動上書きの検知ロジック実装

**目的**: ユーザーが手動で等級・標準報酬を変更した場合に `GradeDecisionSource` を更新

**対象ファイル**:
- `src/app/pages/employees/employee-form-dialog.component.ts`

**実施内容**:
1. 自動計算済みの値を記録するプロパティを追加
2. フォーム値変更を監視する処理を追加（`takeUntilDestroyed` を使用）
3. 自動計算値と異なる場合は `GradeDecisionSource` を `'manual_override'` に変更
4. 初回編集ケース（自動計算を一度も走らせていない場合）も考慮して、値が入力されていれば手動入力とみなす

**確認事項**:
- 手動変更が正しく検知されるか
- `GradeDecisionSource` が正しく更新されるか

---

### ステップ6: 保存ロジックの更新

**目的**: `Employee` に正しいフィールドを保存し、`monthlyWage` を保存しない

**対象ファイル**:
- `src/app/services/employees.service.ts`
- `src/app/pages/employees/employee-form-dialog.component.ts`

**実施内容**:
1. `EmployeesService.save()` で `healthStandardMonthly` / `pensionStandardMonthly` を保存
2. `healthGradeSource` / `pensionGradeSource` を保存
3. `monthlyWage` の保存処理を削除
4. フォームからの保存処理を更新

**確認事項**:
- 保存データが正しいか
- `monthlyWage` が保存されていないか

---

### ステップ7: シミュレーターの更新

**目的**: シミュレーターでも自動等級決定ができるようにする

**対象ファイル**:
- `src/app/pages/simulator/simulator.page.ts`
- `src/app/pages/simulator/simulator.page.html`

**実施内容**:
1. フォーム項目を更新（`monthlyWage` → `salary`、`decisionYearMonth` 追加、標準報酬フィールド追加）
2. 自動計算ロジックを実装（共通ヘルパー関数を使用）
3. `tempEmployee` の作成処理を更新（`monthlyWage` を使用しない）

**確認事項**:
- 自動計算が正しく動作するか
- 保険料計算が正しく実行されるか

---

### ステップ8: 一覧表示の調整

**目的**: 従業員一覧で新しい標準報酬フィールドを表示

**対象ファイル**:
- `src/app/pages/employees/employees.page.ts`
- `src/app/pages/employees/employees.page.html`

**実施内容**:
1. `monthlyWage` 列を削除または非表示化
2. `healthStandardMonthly` / `pensionStandardMonthly` 列を追加
3. 表示列の定義を更新

**確認事項**:
- 表示列が正しく更新されているか
- データが正しく表示されるか

---

### ステップ9: 影響確認とテスト追加

**目的**: 変更が既存機能に影響していないことを確認し、テストを追加

**対象ファイル**:
- すべての変更対象ファイル

**実施内容**:
1. 既存機能の動作確認（特に保険料計算）
2. テストケースの追加（上記のテスト観点を参照）
3. E2E テストの実行（可能な場合）

**確認事項**:
- 既存機能が正しく動作しているか
- テストが適切に追加されているか

---

## 13. 懸念点・要確認事項

### 13-1. `decisionYearMonth` のデフォルト挙動

**懸念点**: `decisionYearMonth` のデフォルト値を「今日の年月」にするか、「計算対象年月（`yearMonth`）」にするか

**提案**:
- **従業員フォーム**: デフォルトは「今日の年月」（ユーザーが変更可能）
- **シミュレーター**: デフォルトは「計算対象年月（`yearMonth`）」と同じ値（ユーザーが変更可能）

**要確認**: ユーザーの運用方針に合わせて決定する

---

### 13-2. 従業員フォームとシミュレーターの UX 統一

**懸念点**: 従業員フォームとシミュレーターで完全に同じ UX にするか、それぞれの用途に合わせて最適化するか

**提案**:
- **基本ロジック**: 共通ヘルパー関数を使用して統一
- **UI/UX**: それぞれの用途に合わせて最適化（シミュレーターは一時的な計算用なので、よりシンプルな UI でも可）

**要確認**: ユーザーの要望に合わせて決定する

---

### 13-3. 既存データの `monthlyWage` の扱い

**懸念点**: 既存データに `monthlyWage` が設定されている場合、Phase2 でどう扱うか

**提案**:
- Phase2 では `monthlyWage` を非表示化するだけで、既存データへの影響は最小限にする
- Phase3 以降で、必要に応じて既存データの移行処理を実施

**要確認**: 既存データの移行が必要かどうか

---

### 13-4. 標準報酬が片方だけ設定されている場合の扱い

**懸念点**: 健康保険の標準報酬だけ設定されている場合（または厚生年金だけの場合）、保存を許可するか

**提案**:
- Phase2 では、健康保険または厚生年金の標準報酬が少なくとも1つは設定されていれば保存を許可する
- `premium-calculator` は Phase1 で既に保険種別ごとの計算に対応しているため、片方だけでも問題ない

**要確認**: 運用上の要件に合わせて決定する

---

### 13-5. 自動計算後の手動変更の扱い

**懸念点**: 自動計算後にユーザーが手動で変更した場合、報酬月額を変更して再計算したときにどう扱うか

**提案**:
- **案A（推奨）**: 報酬月額を変更した場合は、自動的に再計算して手動変更を上書きする
- **案B**: 報酬月額を変更した場合、確認ダイアログを表示してから再計算する

**要確認**: ユーザーの要望に合わせて決定する

---

## 14. 参考資料

- `STANDARD_REWARD_REFACTORING_PLAN.md`: 大規模改良方針書
- `STANDARD_REWARD_REFACTORING_PHASE1.md`: Phase1 実装指示書
- `src/app/types.ts`: 型定義
- `src/app/utils/standard-reward-resolver.ts`: 標準報酬決定ユーティリティ（Phase1 で実装）
- `src/app/utils/premium-calculator.ts`: 保険料計算ロジック（Phase1 で改修済み）
- `src/app/services/masters.service.ts`: マスタサービス
- `src/app/pages/employees/employee-form-dialog.component.ts`: 従業員フォーム（現行実装）
- `src/app/pages/simulator/simulator.page.ts`: シミュレーター（現行実装）

