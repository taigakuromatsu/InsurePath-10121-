# InsurePath 標準報酬・等級まわり現状分析レポート

## 調査日
2025年1月

## 概要
InsurePathのコードベース全体を調査し、標準報酬月額・等級・保険料率マスタ・標準報酬履歴まわりの実装現状を整理しました。

---

## ① monthlyWage と標準報酬まわりの現状把握

### Employee型の定義（`src/app/types.ts`）

#### 標準報酬関連フィールド

```typescript
export interface Employee {
  // ... 基本情報 ...
  
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
}
```

**重要なポイント:**
- `monthlyWage` は必須フィールドで、「健保・厚年 共通の標準報酬月額」として扱われている
- `healthStandardMonthly` / `pensionStandardMonthly` はオプショナルで、現状は `monthlyWage` と同じ値が入ることが想定されている
- `healthGrade` / `pensionGrade` は等級（1〜47、1〜32など）

### monthlyWage の使用箇所一覧

| ファイルパス | クラス/関数名 | 用途 | 備考 |
|------------|------------|------|------|
| `src/app/types.ts` | `Employee` インターフェース | 型定義 | 必須フィールドとして定義 |
| `src/app/services/employees.service.ts` | `EmployeesService.save()` | 従業員情報保存 | `monthlyWage` を Firestore に保存 |
| `src/app/pages/employees/employee-form-dialog.component.ts` | `EmployeeFormDialogComponent` | 従業員フォーム | フォーム入力・バリデーション・標準報酬履歴自動追加 |
| `src/app/pages/employees/employees.page.ts` | `EmployeesPage` | 従業員一覧 | テーブル表示（標準報酬月額列） |
| `src/app/pages/employees/employee-detail-dialog.component.ts` | `EmployeeDetailDialogComponent` | 従業員詳細 | 標準報酬月額の表示 |
| `src/app/pages/employees/employee-import-dialog.component.ts` | `EmployeeImportDialogComponent` | CSVインポート | CSVから `monthlyWage` を読み込み |
| `src/app/utils/csv-import.service.ts` | `CsvImportService` | CSVパース | `monthlyWage` のバリデーション・変換 |
| `src/app/utils/csv-export.service.ts` | `CsvExportService` | CSVエクスポート | `monthlyWage` をCSVに出力 |
| `src/app/utils/premium-calculator.ts` | `calculateMonthlyPremiumForEmployee()` | 保険料計算 | **重要**: `employee.monthlyWage` を「健保・厚年 共通の標準報酬月額」として使用 |
| `src/app/pages/simulator/simulator.page.ts` | `SimulatorPage` | 保険料シミュレーション | 試算用の `monthlyWage` 入力 |
| `src/app/pages/docum ents/document-generation-dialog.component.ts` | `DocumentGenerationDialogComponent` | 書類生成 | `monthlyWage` をフォールバックとして使用 |
| `src/app/services/document-generator.service.ts` | `DocumentGeneratorService.resolveStandardMonthlyReward()` | 標準報酬解決 | 履歴がない場合のフォールバック |

### 標準報酬関連フィールドの使用パターン

#### 1. `monthlyWage` を標準報酬として扱う箇所
- **`premium-calculator.ts`**: `calculateMonthlyPremiumForEmployee()` で `employee.monthlyWage` を健保・厚年共通の標準報酬として使用
- **`simulator.page.ts`**: シミュレーション時に `monthlyWage` を `healthStandardMonthly` / `pensionStandardMonthly` にそのままコピー

#### 2. `healthStandardMonthly` / `pensionStandardMonthly` の使用箇所
- **`monthly-premiums.service.ts`**: `MonthlyPremium` にスナップショットとして保存（計算結果から）
- **`my-page.ts`**: 従業員ポータルで表示
- **`monthly-premiums.page.ts`**: 月次保険料一覧で表示
- **`data-quality.service.ts`**: データ品質チェック（スナップショット欠落チェック）

**現状の問題点:**
- `monthlyWage` が「健保・厚年共通」という前提で実装されている
- `healthStandardMonthly` / `pensionStandardMonthly` は主に `MonthlyPremium` のスナップショットとして使われ、`Employee` 自体には通常設定されていない

---

## ② 保険料率マスタ（健保・厚年・介護）の構造と利用箇所

### データ型定義（`src/app/types.ts`）

#### 1. 健康保険マスタ（`HealthRateTable`）

```typescript
export interface HealthRateTable {
  id: string;
  officeId: string;
  effectiveYear: number;
  effectiveMonth: number;
  effectiveYearMonth: number;  // effectiveYear * 100 + effectiveMonth
  planType: HealthPlanType;  // 'kyokai' | 'kumiai'
  kyokaiPrefCode?: string;  // 協会けんぽの場合
  kyokaiPrefName?: string;
  unionName?: string;  // 組合健保の場合
  unionCode?: string;
  healthRate: number;  // 健康保険料率（事業主＋被保険者合計）
  bands: StandardRewardBand[];  // 標準報酬等級表
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}
```

#### 2. 厚生年金マスタ（`PensionRateTable`）

```typescript
export interface PensionRateTable {
  id: string;
  officeId: string;
  effectiveYear: number;
  effectiveMonth: number;
  effectiveYearMonth: number;
  pensionRate: number;  // 厚生年金保険料率（事業主＋被保険者合計）
  bands: StandardRewardBand[];  // 標準報酬等級表
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}
```

#### 3. 介護保険マスタ（`CareRateTable`）

```typescript
export interface CareRateTable {
  id: string;
  officeId: string;
  effectiveYear: number;
  effectiveMonth: number;
  effectiveYearMonth: number;
  careRate: number;  // 介護保険料率（事業主＋被保険者合計）
  // 注意: bands はない（介護保険は標準報酬等級表を持たない）
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}
```

#### 4. 標準報酬等級バンド（`StandardRewardBand`）

```typescript
export interface StandardRewardBand {
  grade: number;  // 等級（1〜47、1〜32など）
  lowerLimit: number;  // 下限（円）
  upperLimit: number;  // 上限（円）
  standardMonthly: number;  // 標準報酬月額（円）
}
```

### Firestore 上のコレクション構造

| マスタ種別 | Firestore パス | 説明 |
|----------|---------------|------|
| 健康保険 | `offices/{officeId}/healthRateTables/{tableId}` | 事業所ごとの健康保険料率マスタ |
| 厚生年金 | `offices/{officeId}/pensionRateTables/{tableId}` | 事業所ごとの厚生年金料率マスタ |
| 介護保険 | `offices/{officeId}/careRateTables/{tableId}` | 事業所ごとの介護保険料率マスタ |
| クラウド健康保険 | `cloudHealthRateTables/{tableId}` | 全事業所共通の協会けんぽマスタ（Phase3-11.ex） |
| クラウド厚生年金 | `cloudPensionRateTables/{tableId}` | 全事業所共通の厚生年金マスタ（Phase3-11.ex） |
| クラウド介護保険 | `cloudCareRateTables/{tableId}` | 全事業所共通の介護保険マスタ（Phase3-11.ex） |

### マスタを操作しているサービス・コンポーネント

| ファイルパス | クラス/関数名 | 操作内容 |
|------------|------------|---------|
| `src/app/services/masters.service.ts` | `MastersService` | 事業所ごとのマスタの CRUD 操作 |
| `src/app/services/cloud-master.service.ts` | `CloudMasterService` | クラウドマスタの CRUD 操作 |
| `src/app/pages/masters/masters.page.ts` | `MastersPage` | マスタ一覧・編集画面 |
| `src/app/pages/masters/health-master-form-dialog.component.ts` | `HealthMasterFormDialogComponent` | 健康保険マスタ編集ダイアログ |
| `src/app/pages/masters/pension-master-form-dialog.component.ts` | `PensionMasterFormDialogComponent` | 厚生年金マスタ編集ダイアログ |
| `src/app/pages/cloud-masters/cloud-masters.page.ts` | `CloudMastersPage` | クラウドマスタ管理画面 |
| `src/app/pages/cloud-masters/cloud-health-master-form-dialog.component.ts` | `CloudHealthMasterFormDialogComponent` | クラウド健康保険マスタ編集 |
| `src/app/pages/cloud-masters/cloud-pension-master-form-dialog.component.ts` | `CloudPensionMasterFormDialogComponent` | クラウド厚生年金マスタ編集 |

### マスタの取得ロジック（`MastersService.getRatesForYearMonth()`）

**ファイル**: `src/app/services/masters.service.ts`

**処理概要:**
1. 対象年月（`yearMonth`）から `effectiveYearMonth` を計算
2. 健康保険マスタ: `effectiveYearMonth <= targetYearMonth` で最新のマスタを取得
   - 協会けんぽ: `planType === 'kyokai'` + `kyokaiPrefCode` でフィルタ
   - 組合健保: `planType === 'kumiai'` (+ `unionCode` でフィルタ)
3. 介護保険マスタ: `effectiveYearMonth <= targetYearMonth` で最新のマスタを取得
4. 厚生年金マスタ: `effectiveYearMonth <= targetYearMonth` で最新のマスタを取得

**呼び出し元:**
- `monthly-premiums.service.ts`: 月次保険料計算時に料率を取得
- `simulator.page.ts`: シミュレーション時に料率を取得
- `bonus-form-dialog.component.ts`: 賞与保険料計算時に料率を取得

### 標準報酬等級表の使用

**現状:**
- `HealthRateTable.bands` / `PensionRateTable.bands` に標準報酬等級表が格納されている
- しかし、**報酬月額から等級を自動決定するロジックは実装されていない**
- ユーザーが手動で `healthGrade` / `pensionGrade` を入力する前提

**デフォルト値:**
- `src/app/utils/kyokai-presets.ts` にデフォルトの等級表が定義されている
  - `HEALTH_STANDARD_REWARD_BANDS_DEFAULT`: 健康保険1〜50等級
  - `PENSION_STANDARD_REWARD_BANDS_DEFAULT`: 厚生年金1〜32等級

---

## ③ 報酬月額から等級・標準報酬を決めているロジック

### 現状: 自動決定ロジックは存在しない

**重要な発見:**
- InsurePath には、報酬月額（`monthlyWage`）から標準報酬等級を自動決定するロジックが**存在しない**
- ユーザーが手動で `healthGrade` / `pensionGrade` を入力する前提で設計されている

### 等級・標準報酬の設定箇所

| ファイルパス | クラス/関数名 | 処理内容 |
|------------|------------|---------|
| `src/app/pages/employees/employee-form-dialog.component.ts` | `EmployeeFormDialogComponent` | フォームで `healthGrade` / `pensionGrade` を手動入力 |
| `src/app/pages/simulator/simulator.page.ts` | `SimulatorPage` | シミュレーション時に `healthGrade` / `pensionGrade` を手動入力 |
| `src/app/pages/employees/employee-import-dialog.component.ts` | `EmployeeImportDialogComponent` | CSVインポート時に `healthGrade` / `pensionGrade` を読み込み（オプショナル） |

### 保険料計算時の標準報酬の扱い

**ファイル**: `src/app/utils/premium-calculator.ts`

**関数**: `calculateMonthlyPremiumForEmployee()`

**処理の流れ:**
1. `employee.monthlyWage` を「健保・厚年 共通の標準報酬月額」として取得
2. `employee.healthGrade` / `employee.pensionGrade` が設定されていることを確認
3. 保険料計算:
   - 健康保険料 = `monthlyWage * healthRate`
   - 厚生年金料 = `monthlyWage * pensionRate`
   - 介護保険料 = `monthlyWage * careRate`（40〜64歳の場合）

**重要な前提:**
- `monthlyWage` が健保・厚年で同じ標準報酬月額として扱われる
- 等級は既に設定されている前提（自動決定しない）

### 上限等級（頭打ち）の扱い

**現状:**
- 上限等級の特別な処理は実装されていない
- `healthGrade` / `pensionGrade` に上限値（47、32など）を超える値が入る可能性がある
- バリデーションは `simulator.page.ts` で `Validators.max(47)` / `Validators.max(32)` が設定されているが、従業員フォームには設定されていない

### 介護保険の標準報酬参照

**ファイル**: `src/app/utils/premium-calculator.ts`

**処理:**
- 介護保険料計算時も `employee.monthlyWage` を標準報酬として使用
- 介護保険は等級表を持たないため、健康保険と同じ標準報酬月額を使用

---

## ④ StandardRewardHistory（標準報酬履歴）との関係

### 型定義（`src/app/types.ts`）

```typescript
export interface StandardRewardHistory {
  id: string;
  employeeId: string;
  decisionYearMonth: YearMonthString;  // 決定年月（例: '2025-04'）
  appliedFromYearMonth: YearMonthString;  // 適用開始年月（例: '2025-09'）
  standardMonthlyReward: number;  // 標準報酬月額
  decisionKind: StandardRewardDecisionKind;  // 決定区分
  note?: string;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  createdByUserId?: string;
  updatedByUserId?: string;
}
```

### Firestore のパス・構造

**パス**: `offices/{officeId}/employees/{employeeId}/standardRewardHistories/{historyId}`

**構造:**
- 従業員ごとのサブコレクションとして管理
- `decisionYearMonth` で降順ソートして取得

### 操作しているサービス

**ファイル**: `src/app/services/standard-reward-history.service.ts`

**クラス**: `StandardRewardHistoryService`

**メソッド:**
- `list(officeId, employeeId)`: 履歴一覧取得（`decisionYearMonth` 降順）
- `save(officeId, employeeId, history)`: 履歴保存
- `delete(officeId, employeeId, historyId)`: 履歴削除

### 従業員フォームでの自動追加ロジック

**ファイル**: `src/app/pages/employees/employee-form-dialog.component.ts`

**関数**: `addAutoStandardRewardHistory(employeeId, mode, newMonthlyWage)`

**処理の流れ:**

1. **新規作成時（`mode === 'created'`）:**
   - `newMonthlyWage > 0` の場合、無条件で履歴を1件追加
   - `decisionYearMonth` / `appliedFromYearMonth` = 現在年月（`getCurrentYearMonth()`）
   - `note` = "従業員フォームで初回の標準報酬月額が登録されたため自動登録"

2. **更新時（`mode === 'updated'`）:**
   - `newMonthlyWage > 0` かつ
   - `this.data.employee` が存在し、
   - `this.originalMonthlyWage` が定義されていて、
   - `newMonthlyWage !== originalMonthlyWage` の場合のみ履歴を追加
   - `note` = "従業員フォームで標準報酬月額が変更されたため自動登録"

**呼び出し箇所:**
- `submit()` メソッド内で、`employeesService.save()` の後に呼び出される

### 標準報酬履歴の表示・編集

| ファイルパス | クラス/関数名 | 用途 |
|------------|------------|------|
| `src/app/pages/employees/employee-detail-dialog.component.ts` | `EmployeeDetailDialogComponent` | 履歴一覧表示・追加・編集・削除 |
| `src/app/pages/employees/standard-reward-history-form-dialog.component.ts` | `StandardRewardHistoryFormDialogComponent` | 履歴編集ダイアログ |

### 標準報酬履歴の利用箇所

| ファイルパス | クラス/関数名 | 用途 |
|------------|------------|------|
| `src/app/services/document-generator.service.ts` | `DocumentGeneratorService.resolveStandardMonthlyReward()` | 書類生成時に標準報酬月額を解決（履歴 → `monthlyWage` の順でフォールバック） |
| `src/app/pages/documents/document-generation-dialog.component.ts` | `DocumentGenerationDialogComponent` | 資格取得届・資格喪失届のPDF生成時に標準報酬月額を表示 |
| `src/app/services/data-quality.service.ts` | `DataQualityService` | データ品質チェック（期間重複チェックなど） |

---

## ⑤ 将来の設計変更に影響しそうな箇所

### 前提の整理

**現状の前提:**
- `monthlyWage` = 健保・厚年 共通の標準報酬月額
- `healthGrade` / `pensionGrade` は手動入力
- `healthStandardMonthly` / `pensionStandardMonthly` は主に `MonthlyPremium` のスナップショットとして使用

**将来の設計変更案:**
- `Employee` に「報酬月額（実際の給与）」と「健康保険用の標準報酬月額＆等級」「厚生年金用の標準報酬月額＆等級」を分けて持つ

### 注意が必要な箇所一覧

#### 1. `monthlyWage` を「標準報酬月額」とみなしている箇所

| ファイルパス | クラス/関数名 | 該当コード | 説明 |
|------------|------------|----------|------|
| `src/app/utils/premium-calculator.ts` | `calculateMonthlyPremiumForEmployee()` | `const standardMonthly = employee.monthlyWage;` | **最重要**: 保険料計算の核心部分。健保・厚年で同じ標準報酬として使用 |
| `src/app/utils/premium-calculator.ts` | `calculateMonthlyPremiumForEmployee()` | `healthStandardMonthly: standardMonthly, pensionStandardMonthly: standardMonthly` | 計算結果に同じ値を設定 |
| `src/app/pages/simulator/simulator.page.ts` | `SimulatorPage.calculate()` | `healthStandardMonthly: monthlyWage, pensionStandardMonthly: monthlyWage` | シミュレーション時に同じ値を設定 |
| `src/app/services/document-generator.service.ts` | `DocumentGeneratorService.resolveStandardMonthlyReward()` | `employeeFallback` として `monthlyWage` を使用 | 書類生成時のフォールバック |
| `src/app/pages/documents/document-generation-dialog.component.ts` | `DocumentGenerationDialogComponent` | `this.data.employee.monthlyWage` をフォールバックとして使用 | 書類生成ダイアログ |

#### 2. 健保と厚年で標準報酬が同じという前提で書かれている箇所

| ファイルパス | クラス/関数名 | 該当コード | 説明 |
|------------|------------|----------|------|
| `src/app/utils/premium-calculator.ts` | `calculateMonthlyPremiumForEmployee()` | コメント: `employee.monthlyWage を「健保・厚年 共通の標準報酬月額」として扱う` | コメントで前提が明記されている |
| `src/app/utils/premium-calculator.ts` | `calculateMonthlyPremiumForEmployee()` | `healthStandardMonthly: standardMonthly, pensionStandardMonthly: standardMonthly` | 同じ値を両方に設定 |
| `src/app/pages/simulator/simulator.page.ts` | `SimulatorPage` | `healthStandardMonthly: monthlyWage, pensionStandardMonthly: monthlyWage` | シミュレーション時に同じ値を設定 |
| `src/app/pages/employees/employee-form-dialog.component.ts` | `EmployeeFormDialogComponent.addAutoStandardRewardHistory()` | `standardMonthlyReward: newMonthlyWage` | 履歴追加時に `monthlyWage` をそのまま使用（健保・厚年共通の前提） |

#### 3. 等級の自動決定ロジックが存在しない箇所

| ファイルパス | クラス/関数名 | 説明 |
|------------|------------|------|
| `src/app/pages/employees/employee-form-dialog.component.ts` | `EmployeeFormDialogComponent` | フォームで `healthGrade` / `pensionGrade` を手動入力 |
| `src/app/pages/simulator/simulator.page.ts` | `SimulatorPage` | シミュレーション時に `healthGrade` / `pensionGrade` を手動入力 |
| `src/app/utils/premium-calculator.ts` | `calculateMonthlyPremiumForEmployee()` | 等級が未設定の場合は計算をスキップ（自動決定しない） |

**将来の拡張ポイント:**
- 報酬月額から等級を自動決定する関数を追加する必要がある
- `StandardRewardBand` の `lowerLimit` / `upperLimit` を使って等級を決定するロジックが必要

#### 4. CSVインポート/エクスポートでの扱い

| ファイルパス | クラス/関数名 | 説明 |
|------------|------------|------|
| `src/app/utils/csv-import.service.ts` | `CsvImportService` | CSVの「標準報酬月額」列を `monthlyWage` にマッピング |
| `src/app/utils/csv-export.service.ts` | `CsvExportService` | `monthlyWage` を「標準報酬月額」としてエクスポート |
| `src/app/pages/employees/employee-import-dialog.component.ts` | `EmployeeImportDialogComponent` | CSVインポート時に `healthStandardMonthly` / `pensionStandardMonthly` も読み込み可能（オプショナル） |

**注意点:**
- CSVの列名が「標準報酬月額」となっており、健保・厚年共通の前提

#### 5. データ品質チェックでの扱い

| ファイルパス | クラス/関数名 | 説明 |
|------------|------------|------|
| `src/app/services/data-quality.service.ts` | `DataQualityService` | `MonthlyPremium` の `healthStandardMonthly` / `pensionStandardMonthly` が欠落していないかチェック |

**注意点:**
- 現状は `MonthlyPremium` のスナップショットとして両方の値が保存されている前提

### 設計変更時の影響範囲まとめ

**高影響度（必須変更）:**
1. `premium-calculator.ts`: 保険料計算ロジックの全面見直しが必要
2. `employee-form-dialog.component.ts`: フォーム設計の変更（報酬月額と標準報酬を分離）
3. `simulator.page.ts`: シミュレーション画面の変更

**中影響度（要確認）:**
1. CSVインポート/エクスポート: 列の追加・変更が必要
2. 標準報酬履歴: 健保・厚年で分けるか、共通のままか要検討
3. 書類生成: 標準報酬の解決ロジックの変更

**低影響度（影響少）:**
1. マスタ管理: 既に `bands` を持っているため、等級決定ロジックの追加は容易
2. データ品質チェック: スナップショットの扱いは変更不要

---

## まとめ

### 現状の設計の特徴

1. **`monthlyWage` が健保・厚年共通の標準報酬として扱われている**
   - 保険料計算の核心部分でこの前提が使われている
   - 将来の設計変更時は最も注意が必要

2. **等級の自動決定ロジックが存在しない**
   - ユーザーが手動で等級を入力する前提
   - 等級表（`StandardRewardBand`）はマスタに存在するが、報酬月額から等級を決定する関数がない

3. **`healthStandardMonthly` / `pensionStandardMonthly` は主にスナップショット用途**
   - `MonthlyPremium` に計算時点の値を保存するために使用
   - `Employee` 自体には通常設定されていない

4. **標準報酬履歴は健保・厚年共通の前提**
   - `StandardRewardHistory.standardMonthlyReward` は1つの値のみ
   - 将来、健保・厚年で分ける場合は構造変更が必要

### 将来の設計変更時の推奨事項

1. **段階的な移行を検討**
   - まず `healthStandardMonthly` / `pensionStandardMonthly` を `Employee` に設定する機能を追加
   - 保険料計算ロジックを段階的に変更

2. **等級自動決定ロジックの追加**
   - `StandardRewardBand` を使って報酬月額から等級を決定する関数を実装
   - マスタの `bands` を活用

3. **後方互換性の確保**
   - `monthlyWage` を残しつつ、新しいフィールドを追加
   - 既存データの移行スクリプトを準備

4. **テストの充実**
   - 保険料計算ロジックのテストを追加
   - 等級決定ロジックのテストを追加

