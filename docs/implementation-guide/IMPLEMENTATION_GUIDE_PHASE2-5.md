# Phase2-5 実装指示書: 標準報酬決定・改定履歴管理機能

## 📋 概要

Phase2-3で被扶養者管理機能が実装され、Phase2-4で扶養家族管理の導線改善が完了した状態で、実務上必要な「標準報酬決定・改定履歴管理機能」を実装します。

**目的**: 
- 従業員ごとに標準報酬の決定・改定履歴をFirestore上で管理できるようにする
- admin / hr ユーザーが、従業員ごとの標準報酬履歴を一覧表示・追加・編集・削除できる
- 既存の保険料計算ロジックを壊さないことを優先しつつ、「標準報酬履歴を記録・参照できる基盤」を作る
- **Phase2-5では「履歴のCRUDと閲覧」に焦点を当て、履歴と現在値（`employees.monthlyWage`）の連動機能は将来の拡張とする**

**このフェーズで達成したいゴール**:
- admin / hr が従業員詳細画面から標準報酬履歴を追加・編集・削除できる
- 標準報酬履歴を時系列順に一覧表示できる
- 既存の月次保険料計算・マイページ表示が従来通り動作する
- Firestoreルールで適切なアクセス制御が機能している

**方針変更について**:
- 元のPhase2計画では専用ページ（`standard-reward-histories.page.ts`）を作成する方針でしたが、Phase2-5では**従業員詳細ダイアログ内のセクションとして完結する設計**に変更します。これにより、既存の被扶養者管理機能（Phase2-3）と同様のパターンで実装でき、UIの一貫性が保たれます。
- 必要であれば、将来的に`/standard-reward-histories`のような一覧専用ページを追加することも可能です（「今後の拡張」参照）。

**前提条件**:
- Phase2-1（セキュリティ・アクセス制御の強化）が実装済み
- Phase2-2（ロール割り当てとユーザー管理の改善）が実装済み
- Phase2-3（被扶養者管理機能）が実装済み
- Phase2-4（扶養家族管理の導線改善）が実装済み
- `Employee`型と`EmployeesService`が実装済み
- `employee-detail-dialog.component.ts`にセクションナビが実装済み（`DialogFocusSection`型）

---

## 🧭 スコープ

### 対象とする機能・ファイル（Phase2-5の実装対象）

#### データモデル
- `src/app/types.ts` - `StandardRewardHistory`型と`StandardRewardDecisionKind`型の追加

#### サービス層
- `src/app/services/standard-reward-history.service.ts` - 新規作成（標準報酬履歴のCRUD操作）

#### UI（admin / hr 向け）
- `src/app/pages/employees/employee-detail-dialog.component.ts` - 標準報酬履歴セクションの追加
- `src/app/pages/employees/standard-reward-history-form-dialog.component.ts` - 新規作成（標準報酬履歴の追加・編集ダイアログ）

#### Firestoreルール
- `firestore.rules` - `offices/{officeId}/employees/{employeeId}/standardRewardHistories/{historyId}`のルール追加

#### ユーティリティ
- `src/app/utils/label-utils.ts` - `getStandardRewardDecisionKindLabel`関数の追加

### 対象外とするもの

以下の機能はPhase2-5では対象外とします：
- **履歴レコードから`employees.monthlyWage`への自動反映機能**（「現在適用として反映」チェック機能は将来の拡張として検討。Phase2-5では履歴のCRUDと閲覧のみに焦点を当てる）
- **標準報酬履歴からの自動等級判定機能**（`healthGrade`/`pensionGrade`フィールド自体は型定義に含めるが、値の自動計算は行わない。手動入力または将来の拡張として実装）
- 従業員フォーム（`employee-form-dialog.component.ts`）での`monthlyWage`変更時に履歴を自動追加する機能（将来の拡張として検討）
- 標準報酬履歴のCSVエクスポート機能（Phase2-6で実装予定）
- 履歴データからの保険料再計算機能（将来の拡張として検討）
- **マイページでの標準報酬履歴表示**（`src/app/pages/me/my-page.ts`への追加は将来の拡張として検討）

---

## 📝 現状の挙動と課題

### 1. 標準報酬月額の管理方法

**現状の挙動**:
- `Employee`型に`monthlyWage`フィールドがあり、従業員フォーム（`employee-form-dialog.component.ts`）で直接編集可能
- 健康保険と厚生年金でそれぞれ等級（`healthGrade`, `pensionGrade`）と標準報酬月額（`healthStandardMonthly`, `pensionStandardMonthly`）が別々に管理されている
- 月次保険料計算（`premium-calculator.ts`）では、`employee.monthlyWage`を基準に等級を決定し、保険料を計算している
- 月次保険料一覧（`monthly-premiums.page.ts`）では、計算時点での等級・標準報酬月額をスナップショットとして保存している

**課題**:
- 標準報酬の決定・改定履歴が記録されていない
- いつ、どのような理由で標準報酬が変更されたかを追跡できない
- 定時決定・随時改定・賞与時の改定などの区分が管理されていない
- 過去の標準報酬を参照する際に、履歴データがないため確認が困難

### 2. 従業員詳細ダイアログの現状

**現状の挙動**:
- `employee-detail-dialog.component.ts`には複数のセクション（基本情報、就労条件、社会保険情報、資格情報、就業状態、扶養家族、システム情報）が実装されている
- Phase2-4でセクションナビが追加され、`DialogFocusSection`型でセクションIDが管理されている
- 標準報酬に関する情報は「社会保険情報」セクションに表示されているが、履歴は表示されていない

**課題**:
- 標準報酬履歴を表示するセクションがない
- 履歴を追加・編集・削除するUIがない

### 3. マイページの現状

**現状の挙動**:
- `my-page.ts`で従業員本人の基本情報と保険料明細が表示されている
- 標準報酬月額・等級は表示されているが、履歴は表示されていない

**課題**:
- 従業員本人が自分の標準報酬履歴を確認できない

---

## 📝 仕様（Before / After）

### 1. データモデル観点

#### Before（現状）
```
offices/{officeId}/employees/{employeeId}
  - monthlyWage: number（標準報酬月額）
  - healthGrade?: number（健康保険等級）
  - healthStandardMonthly?: number（健康保険標準報酬月額）
  - pensionGrade?: number（厚生年金等級）
  - pensionStandardMonthly?: number（厚生年金標準報酬月額）
```

標準報酬履歴を管理するコレクションが存在しない。

#### After（Phase2-5実装後）
```
offices/{officeId}/employees/{employeeId}
  - monthlyWage: number（標準報酬月額）※既存のまま
  - healthGrade?: number（健康保険等級）※既存のまま
  - healthStandardMonthly?: number（健康保険標準報酬月額）※既存のまま
  - pensionGrade?: number（厚生年金等級）※既存のまま
  - pensionStandardMonthly?: number（厚生年金標準報酬月額）※既存のまま

offices/{officeId}/employees/{employeeId}/standardRewardHistories/{historyId}
  - id: string（ドキュメントID）
  - employeeId: string（従業員ID、パスから取得可能だが明示的に保持）
  - decisionYearMonth: YearMonthString（決定年月、YYYY-MM形式）
  - appliedFromYearMonth: YearMonthString（適用開始年月、YYYY-MM形式）
  - standardMonthlyReward: number（標準報酬月額）
  - healthGrade?: number（健康保険等級）
  - healthStandardMonthly?: number（健康保険標準報酬月額）
  - pensionGrade?: number（厚生年金等級）
  - pensionStandardMonthly?: number（厚生年金標準報酬月額）
  - decisionKind: StandardRewardDecisionKind（決定区分）
  - note?: string（メモ）
  - createdAt: IsoDateString（作成日時）
  - updatedAt: IsoDateString（更新日時）
  - createdByUserId?: string（作成ユーザーID）
  - updatedByUserId?: string（更新ユーザーID）
```

### 2. 画面・操作フロー観点

#### Before（現状）
- 従業員詳細ダイアログで標準報酬月額・等級を表示するのみ
- 履歴を確認・管理するUIがない

#### After（Phase2-5実装後）
- 従業員詳細ダイアログに「標準報酬履歴」セクションを追加
- 履歴一覧を時系列順（決定年月の降順）で表示
- admin / hr は「履歴を追加」ボタンで履歴を追加できる
- admin / hr は各履歴レコードの「編集」「削除」ボタンで履歴を管理できる
- **Phase2-5では履歴のCRUDと閲覧のみを実装**。履歴と`employees.monthlyWage`の連動機能は将来の拡張として検討

---

## 🗂️ データモデル設計

### Firestoreコレクション構造

```
offices/{officeId}/employees/{employeeId}/standardRewardHistories/{historyId}
```

### TypeScript型定義

#### `StandardRewardDecisionKind`型

```typescript
export type StandardRewardDecisionKind =
  | 'regular'        // 定時決定（年次見直し）
  | 'interim'        // 随時改定
  | 'bonus'          // 賞与支払時の改定
  | 'qualification'  // 資格取得時の決定
  | 'loss'           // 資格喪失時の決定
  | 'other';         // その他
```

#### `StandardRewardHistory`インターフェース

**MVP版（Phase2-5で実装する最小構成）**:
```typescript
export interface StandardRewardHistory {
  id: string;
  employeeId: string;
  decisionYearMonth: YearMonthString;      // 決定年月（YYYY-MM形式）
  appliedFromYearMonth: YearMonthString;  // 適用開始年月（YYYY-MM形式）
  standardMonthlyReward: number;          // 標準報酬月額
  decisionKind: StandardRewardDecisionKind; // 決定区分
  note?: string;                           // メモ（等級・標準報酬月額の詳細もここに記載可能）
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  createdByUserId?: string;
  updatedByUserId?: string;
}
```

**フル版（将来の拡張として検討）**:
```typescript
export interface StandardRewardHistory {
  id: string;
  employeeId: string;
  decisionYearMonth: YearMonthString;      // 決定年月（YYYY-MM形式）
  appliedFromYearMonth: YearMonthString;  // 適用開始年月（YYYY-MM形式）
  standardMonthlyReward: number;          // 標準報酬月額
  healthGrade?: number;                    // 健康保険等級（将来の拡張）
  healthStandardMonthly?: number;          // 健康保険標準報酬月額（将来の拡張）
  pensionGrade?: number;                   // 厚生年金等級（将来の拡張）
  pensionStandardMonthly?: number;        // 厚生年金標準報酬月額（将来の拡張）
  decisionKind: StandardRewardDecisionKind; // 決定区分
  note?: string;                           // メモ
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  createdByUserId?: string;
  updatedByUserId?: string;
}
```

**Phase2-5での実装方針**:
- **MVP版を採用**。必須フィールド（決定年月、適用開始年月、標準報酬月額、決定区分）のみを実装し、等級・標準報酬月額の詳細は`note`フィールドに記載してもらう運用とする。
- 型定義自体は将来の拡張を見据えて、`healthGrade`/`pensionGrade`/`healthStandardMonthly`/`pensionStandardMonthly`をオプショナルフィールドとして含めることも可能だが、Phase2-5ではUIに表示せず、データベースにも保存しない（または隠しフィールドとして扱う）。
- 実装コストとテスト量を考慮し、まずは「履歴の記録と閲覧」に焦点を当てる。

### フィールドの説明

#### 必須フィールド（MVP版）
- `id`: ドキュメントID（Firestoreから自動生成）
- `employeeId`: 従業員ID（パスから取得可能だが、明示的に保持することでクエリの柔軟性を確保）
- `decisionYearMonth`: 決定年月（YYYY-MM形式、例: "2025-01"）
- `appliedFromYearMonth`: 適用開始年月（YYYY-MM形式、例: "2025-02"）
- `standardMonthlyReward`: 標準報酬月額（数値）
- `decisionKind`: 決定区分（`StandardRewardDecisionKind`型）

#### 任意フィールド（MVP版）
- `note`: メモ（文字列、最大1000文字程度。等級・標準報酬月額の詳細もここに記載可能）
- `createdAt`, `updatedAt`: 作成日時・更新日時（ISO文字列）
- `createdByUserId`, `updatedByUserId`: 作成ユーザーID・更新ユーザーID（文字列）

#### 将来の拡張フィールド（フル版）
- `healthGrade`: 健康保険等級（数値、将来の拡張として検討）
- `healthStandardMonthly`: 健康保険標準報酬月額（数値、将来の拡張として検討）
- `pensionGrade`: 厚生年金等級（数値、将来の拡張として検討）
- `pensionStandardMonthly`: 厚生年金標準報酬月額（数値、将来の拡張として検討）

**補足**: Phase2-5では、等級・標準報酬月額の詳細は`note`フィールドに記載してもらう運用とします。将来的に自動等級判定機能を実装する際に、これらのフィールドを追加することも可能です。

### バリデーション方針

- `decisionYearMonth`, `appliedFromYearMonth`: YYYY-MM形式の文字列（正規表現: `/^\d{4}-\d{2}$/`）
- `standardMonthlyReward`: 0以上の数値
- 等級・標準報酬月額フィールド（`healthGrade`/`pensionGrade`/`healthStandardMonthly`/`pensionStandardMonthly`）: Phase2-5では実装しないため、バリデーションは不要
- `note`: 最大1000文字

---

## 🎨 UI/UX設計

### 1. 従業員詳細ダイアログへの「標準報酬履歴」セクション追加

#### セクションナビへの追加
- `DialogFocusSection`型に`'standard-reward-history'`を追加
- セクションナビのボタン一覧に「標準報酬履歴」を追加
- アイコン: `trending_up`（Material Icons）

#### セクションのレイアウト
```
┌─ 標準報酬履歴 ─────────────────────────────┐
│ [履歴を追加] ボタン（admin/hrのみ）        │
│                                            │
│ ┌─ 履歴一覧 ───────────────────────────┐  │
│ │ 決定年月 | 適用開始 | 標準報酬 | 区分 │  │
│ │ 2025-01  | 2025-02  | 280,000 | 定時 │  │
│ │ 2024-01  | 2024-02  | 260,000 | 定時 │  │
│ │ ...                                    │  │
│ │ （等級・標準報酬月額の詳細はメモ欄に記載）│  │
│ └────────────────────────────────────────┘  │
│                                            │
│ 各履歴レコードに「編集」「削除」ボタン     │
│ （admin/hrのみ）                            │
└────────────────────────────────────────────┘
```

#### 履歴一覧の表示形式

**案A: テーブル形式（推奨）**
- Material Tableを使用
- 列（MVP版）: 決定年月、適用開始年月、標準報酬月額、決定区分、メモ、操作
- 時系列順（決定年月の降順）で表示
- 等級・標準報酬月額の詳細はメモ欄に記載（将来の拡張で列を追加可能）

**案B: カード形式**
- 各履歴をカードとして表示
- カード内に決定年月、適用開始年月、標準報酬月額、決定区分、メモを表示
- カードの右上に「編集」「削除」ボタンを配置

**推奨**: 案A（テーブル形式）を採用。既存の従業員一覧や月次保険料一覧と統一感を保つ。

### 2. 標準報酬履歴フォームダイアログ

#### ダイアログの構成（MVP版）
- タイトル: 「標準報酬履歴を追加」または「標準報酬履歴を編集」
- フォームフィールド:
  - 決定年月（`decisionYearMonth`）: 日付入力（年月のみ、YYYY-MM形式、必須）
  - 適用開始年月（`appliedFromYearMonth`）: 日付入力（年月のみ、YYYY-MM形式、必須）
  - 標準報酬月額（`standardMonthlyReward`）: 数値入力（必須）
  - 決定区分（`decisionKind`）: セレクトボックス（必須）
  - メモ（`note`）: テキストエリア（任意、最大1000文字。等級・標準報酬月額の詳細もここに記載可能）

**将来の拡張フィールド**（Phase2-5では実装しない）:
- 健康保険等級（`healthGrade`）: 数値入力（任意）
- 健康保険標準報酬月額（`healthStandardMonthly`）: 数値入力（任意）
- 厚生年金等級（`pensionGrade`）: 数値入力（任意）
- 厚生年金標準報酬月額（`pensionStandardMonthly`）: 数値入力（任意）
- 「現在適用として反映」チェックボックス:
  - ONの場合、`employees.monthlyWage`や等級フィールドも同時に更新
  - OFFの場合、履歴のみを保存

#### バリデーション
- 決定年月、適用開始年月: YYYY-MM形式の必須入力
- 標準報酬月額: 0以上の数値、必須
- 決定区分: 必須選択
- 等級・標準報酬月額: 0以上の数値（任意）

### 3. 従業員一覧からの導線（オプション）

**推奨案**: 従業員一覧の「標準報酬月額」列に小さな「履歴」アイコンを追加
- アイコン: `history`（Material Icons）
- クリック時に`openDetailWithFocus(row, 'standard-reward-history')`を呼び出し
- 従業員詳細ダイアログが開き、標準報酬履歴セクションに自動スクロール

**実装コスト**: 低（既存の`openDetailWithFocus`メソッドを活用）
**優先度**: 中（Phase2-5の必須要件ではないが、推奨）

### 4. マイページでの履歴表示（将来の拡張）

**検討事項**:
- 従業員本人が自分の標準報酬履歴を閲覧できるようにする
- 編集・削除は不可（閲覧のみ）

**実装コスト**: 中（新しいセクション追加が必要）
**優先度**: 低（Phase2-5の必須要件ではない。将来の拡張として検討）

**Phase2-5での方針**: 
- Phase2-5では実装せず、将来の拡張として検討する。
- Phase2-5時点のFirestoreルールは admin/hr のみ読み取り可能とし、employeeロールからはアクセスできない。
- 将来的にマイページに履歴表示を追加する際は、Firestoreルールを`isOwnEmployee`を含む形に拡張して対応する。

---

## 🔧 サービス層・ルーティング設計

### 新規サービス: `StandardRewardHistoryService`

#### メソッド一覧

```typescript
@Injectable({ providedIn: 'root' })
export class StandardRewardHistoryService {
  constructor(private readonly firestore: Firestore) {}

  /**
   * 指定従業員の標準報酬履歴一覧を取得（時系列順）
   */
  list(officeId: string, employeeId: string): Observable<StandardRewardHistory[]>

  /**
   * 標準報酬履歴を保存（新規作成または更新）
   */
  async save(
    officeId: string,
    employeeId: string,
    history: Partial<StandardRewardHistory> & { id?: string }
  ): Promise<void>

  /**
   * 標準報酬履歴を削除
   */
  async delete(
    officeId: string,
    employeeId: string,
    historyId: string
  ): Promise<void>
}
```

#### 実装のポイント

- `list()`メソッドは、AngularFireの`collectionData`を使用してリアルタイム購読を実装
- `{ idField: 'id' }`を指定して、ドキュメントIDを`id`フィールドにマッピング
- `orderBy('decisionYearMonth', 'desc')`で時系列順（新しい順）にソート
- `save()`メソッドでは、`createdAt`と`updatedAt`を自動設定
  - 新規作成時: `createdAt`と`updatedAt`の両方を現在時刻で設定
  - 更新時: `updatedAt`のみ更新（`createdAt`は保持）
- `createdByUserId`と`updatedByUserId`は、`CurrentUserService`から取得して設定

### 既存サービスとの関係

- `CurrentUserService`: 現在のユーザーIDを取得するために使用（`createdByUserId`/`updatedByUserId`の設定用）
- `EmployeesService`: Phase2-5では使用しない。将来「現在適用として反映」機能を実装する際に使用する予定。

### ルーティング

- 新しいルートは追加しない
- 既存の従業員詳細ダイアログ内にセクションとして追加する

---

## 🔒 セキュリティ・Firestoreルール

### 権限ポリシー

| ロール | 読み取り | 作成 | 更新 | 削除 |
|--------|---------|------|------|------|
| admin | 所属事業所の全従業員の履歴 | 所属事業所の全従業員の履歴 | 所属事業所の全従業員の履歴 | 所属事業所の全従業員の履歴 |
| hr | 所属事業所の全従業員の履歴 | 所属事業所の全従業員の履歴 | 所属事業所の全従業員の履歴 | 所属事業所の全従業員の履歴 |
| employee | 不可（Phase2-5ではUIからも表示しない。将来の拡張として検討） | 不可 | 不可 | 不可 |
| 他事業所 | 不可 | 不可 | 不可 | 不可 |

### Firestoreルール案

**Phase2-5での実装方針**:
- Phase2-5では`employee`ロールからの履歴閲覧はUI側でも実装しないため、ルールも`isAdminOrHr`のみに限定する。
- 将来的にマイページで履歴表示を追加する際は、ルールを`isOwnEmployee`を含む形に拡張する。

```javascript
match /offices/{officeId}/employees/{employeeId}/standardRewardHistories/{historyId} {
  // Read: admin/hrのみ閲覧可能（Phase2-5ではemployeeからの閲覧はUI側でも実装しない）
  allow read: if belongsToOffice(officeId) && isAdminOrHr(officeId);

  // Write: admin/hrのみ追加・編集・削除可能
  allow create, update, delete: if belongsToOffice(officeId) && isAdminOrHr(officeId);
}
```

**将来の拡張時のルール案**（マイページで履歴表示を追加する場合）:
```javascript
match /offices/{officeId}/employees/{employeeId}/standardRewardHistories/{historyId} {
  // Read: admin/hrは全従業員の履歴を閲覧可能、employeeは自分の履歴のみ閲覧可能
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    isOwnEmployee(officeId, employeeId)
  );

  // Write: admin/hrのみ追加・編集・削除可能
  allow create, update, delete: if belongsToOffice(officeId) && isAdminOrHr(officeId);
}
```

**補足**: `firestore.rules`では既に以下のヘルパー関数が定義済みです：
- `belongsToOffice(officeId)`
- `isAdminOrHr(officeId)`
- `isOwnEmployee(officeId, employeeId)`

新しい関数は作らず、既存の関数名に揃えてください。

---

## 🛠️ 実装ステップ

※Phase2-5の必須範囲は Step1〜6 までとし、Step7 は任意（実装できれば推奨）、Step8 は将来の拡張とする。

### Step 1: 型定義の追加

**ファイル**: `src/app/types.ts`

1. `StandardRewardDecisionKind`型を追加
2. `StandardRewardHistory`インターフェースを追加（MVP版）
   - 必須フィールド: `id`, `employeeId`, `decisionYearMonth`, `appliedFromYearMonth`, `standardMonthlyReward`, `decisionKind`
   - 任意フィールド: `note`, `createdAt`, `updatedAt`, `createdByUserId`, `updatedByUserId`
   - 等級・標準報酬月額フィールド（`healthGrade`/`pensionGrade`/`healthStandardMonthly`/`pensionStandardMonthly`）はPhase2-5では実装しない

**実装のポイント**:
- 既存の型定義（`Dependent`, `Employee`など）のスタイルに合わせる
- `YearMonthString`型は既に定義されているので、それを活用する
- MVP版のフィールドのみを実装し、将来の拡張フィールドは含めない

### Step 2: ラベルユーティリティの追加

**ファイル**: `src/app/utils/label-utils.ts`

1. `getStandardRewardDecisionKindLabel`関数を追加
   - `StandardRewardDecisionKind`の各値に対応する日本語ラベルを返す
   - 例: `'regular'` → `'定時決定'`, `'interim'` → `'随時改定'`など

### Step 3: サービスの実装

**ファイル**: `src/app/services/standard-reward-history.service.ts`（新規作成）

1. `StandardRewardHistoryService`クラスを実装
2. `list()`メソッドの実装
   - AngularFireの`collectionData`を使用
   - `orderBy('decisionYearMonth', 'desc')`でソート
   - `{ idField: 'id' }`を指定
3. `save()`メソッドの実装
   - 新規作成時: `createdAt`と`updatedAt`を設定
   - 更新時: `updatedAt`のみ更新
   - `CurrentUserService`からユーザーIDを取得して`createdByUserId`/`updatedByUserId`を設定
4. `delete()`メソッドの実装

### Step 4: フォームダイアログコンポーネントの実装

**ファイル**: `src/app/pages/employees/standard-reward-history-form-dialog.component.ts`（新規作成）

1. `StandardRewardHistoryFormDialogComponent`クラスを実装
2. フォームの実装（MVP版）
   - Reactive Formsを使用
   - 必須フィールド: 決定年月、適用開始年月、標準報酬月額、決定区分
   - 任意フィールド: メモ
   - 各フィールドのバリデーションを設定
3. 保存処理の実装
   - `StandardRewardHistoryService.save()`を呼び出す
   - Phase2-5では`EmployeesService`との連動は実装しない（将来の拡張として検討）

### Step 5: 従業員詳細ダイアログへのセクション追加

**ファイル**: `src/app/pages/employees/employee-detail-dialog.component.ts`

1. `DialogFocusSection`型に`'standard-reward-history'`を追加
2. `sections`配列に「標準報酬履歴」セクションを追加
3. テンプレートに「標準報酬履歴」セクションを追加
   - セクションID: `id="standard-reward-history"`
   - `#sectionBlock`を付与（セクションナビのスクロール機能用）
4. 履歴一覧の表示（MVP版）
   - `StandardRewardHistoryService.list()`を使用
   - Material Table形式で表示（推奨）
   - 表示列: 決定年月、適用開始年月、標準報酬月額、決定区分、メモ、操作
   - 等級・標準報酬月額の詳細列は表示しない（将来の拡張として検討）
5. 「履歴を追加」ボタンの実装（admin/hrのみ表示）
6. 各履歴レコードの「編集」「削除」ボタンの実装（admin/hrのみ表示）
7. `StandardRewardHistoryService`と`CurrentUserService`を注入
8. `canManageStandardRewardHistory$`Observableを追加（admin/hr判定用）

### Step 6: Firestoreルールの追加

**ファイル**: `firestore.rules`

1. `standardRewardHistories`サブコレクション用のルールブロックを追加
2. 既存の`dependents`ルールを参考に実装
3. `belongsToOffice`, `isAdminOrHr`関数を使用（Phase2-5では employee ロールからの閲覧は許可しないため、`isOwnEmployee`は使用しない）

**補足**: 将来 employee にも閲覧を許可する場合は、前述の「将来の拡張時のルール案」に差し替える。

### Step 7: 従業員一覧からの導線追加（オプション）

**ファイル**: `src/app/pages/employees/employees.page.ts`

1. 「標準報酬月額」列に「履歴」アイコンボタンを追加
2. クリック時に`openDetailWithFocus(row, 'standard-reward-history')`を呼び出す

### Step 8: マイページへの履歴表示追加（オプション、将来の拡張）

**ファイル**: `src/app/pages/me/my-page.ts`

1. 「標準報酬履歴」セクションを追加（閲覧のみ）
2. `StandardRewardHistoryService.list()`を使用して履歴を表示

---

## ✅ 受け入れ条件（テスト観点）

### 1. 基本機能のテスト

**テストケース1: admin / hr ロールで標準報酬履歴を追加できること**
- 前提: admin または hr ロールでログインしている
- 手順:
  1. 従業員詳細ダイアログを開く
  2. 「標準報酬履歴」セクションに移動
  3. 「履歴を追加」ボタンをクリック
  4. フォームに入力して保存（決定年月、適用開始年月、標準報酬月額、決定区分を入力）
- 期待結果:
  - 履歴が正常に保存される
  - 履歴一覧に新しいレコードが表示される
  - `employees.monthlyWage`は変更されない（Phase2-5では履歴と現在値の連動は実装しない）

**テストケース2: admin / hr ロールで標準報酬履歴を編集できること**
- 前提: admin または hr ロールでログインしている
- 手順:
  1. 従業員詳細ダイアログを開く
  2. 「標準報酬履歴」セクションに移動
  3. 既存の履歴レコードの「編集」ボタンをクリック
  4. 内容を変更して保存
- 期待結果:
  - 履歴が正常に更新される
  - 履歴一覧に変更が反映される

**テストケース3: admin / hr ロールで標準報酬履歴を削除できること**
- 前提: admin または hr ロールでログインしている
- 手順:
  1. 従業員詳細ダイアログを開く
  2. 「標準報酬履歴」セクションに移動
  3. 既存の履歴レコードの「削除」ボタンをクリック
  4. 確認ダイアログで「OK」をクリック
- 期待結果:
  - 履歴が正常に削除される
  - 履歴一覧からレコードが消える

**テストケース4: 履歴一覧が時系列順（決定年月の降順）で表示されること**
- 前提: 複数の履歴レコードが存在する
- 手順: 従業員詳細ダイアログの「標準報酬履歴」セクションを開く
- 期待結果: 履歴が決定年月の降順（新しい順）で表示される

### 2. 権限制御のテスト

**テストケース5: employee ロールは履歴にアクセスできないこと**
- 前提: employee ロールでログインしている
- 手順: 従業員詳細ダイアログを開く（マイページから）
- 期待結果:
  - 「標準報酬履歴」セクションが表示されない（Phase2-5ではemployee向けのUIは実装しない）
  - Firestoreルールにより、履歴へのアクセスが拒否される

**テストケース6: 他事業所の履歴にアクセスできないこと**
- 前提: admin ロールでログインしているが、別の事業所に所属している
- 手順: 他事業所の従業員の履歴にアクセスしようとする
- 期待結果:
  - Firestoreルールにより、アクセスが拒否される
  - エラーメッセージが表示される

### 3. 既存機能の回帰テスト

**テストケース7: 既存の月次保険料計算が従来通り動作すること**
- 前提: 標準報酬履歴を追加した後
- 手順:
  1. 月次保険料一覧ページを開く
  2. 対象年月を選択して計算・保存を実行
- 期待結果:
  - 保険料が正常に計算される
  - `employees.monthlyWage`が計算の基準として使用される（既存の挙動を維持）

**テストケース8: マイページが従来通り動作すること**
- 前提: employee ロールでログインしている
- 手順: マイページを開く
- 期待結果:
  - 基本情報、月次保険料、賞与保険料が正常に表示される
  - 標準報酬月額・等級が正常に表示される

---

## ⚠️ 注意点・今後の拡張

### 注意点

1. **既存機能への影響を最小限に抑える**
   - `employees.monthlyWage`は引き続き「現在利用中の標準報酬月額」として扱う
   - 月次保険料計算ロジックは変更しない
   - Phase2-5では履歴と現在値（`employees.monthlyWage`）の連動機能は実装しない

2. **データ整合性**
   - 履歴レコードの`decisionYearMonth`と`appliedFromYearMonth`の整合性チェック（適用開始年月が決定年月以降であることなど）
   - 同じ決定年月の履歴が複数存在しないようにする（バリデーションで対応）

3. **パフォーマンス**
   - 履歴一覧の取得は、`limit()`を使用して最大件数を制限することを検討（例: 直近50件）
   - 大量の履歴がある場合のページネーション機能は将来の拡張として検討

4. **UI/UX**
   - 履歴一覧が空の場合の適切なメッセージ表示
   - ローディング状態の表示
   - エラーハンドリングとユーザーフィードバック

### 今後の拡張余地

1. **履歴と現在値（`employees.monthlyWage`）の連動機能**
   - 履歴レコード作成時に「現在適用として反映」チェックがONの場合、`employees.monthlyWage`や等級フィールドも同時に更新する機能
   - 履歴を「真のソース」として扱い、現在値を履歴から自動的に反映する機能

2. **等級・標準報酬月額フィールドの追加**
   - `healthGrade`/`pensionGrade`/`healthStandardMonthly`/`pensionStandardMonthly`フィールドを追加
   - フォームにこれらのフィールドを表示し、手動入力または自動計算で設定

3. **履歴からの自動等級判定**
   - 標準報酬月額から自動的に等級を判定する機能
   - マスタデータ（`StandardRewardBand`）を参照して等級を自動設定
   - `healthGrade`/`pensionGrade`フィールドに自動的に値を設定

4. **従業員フォームでの履歴自動追加**
   - `employee-form-dialog.component.ts`で`monthlyWage`を変更した際に、履歴を自動追加する機能
   - 変更前後の値を比較して、変更があった場合のみ履歴を追加

5. **履歴データからの保険料再計算**
   - 過去の履歴データを基準に、保険料を再計算する機能
   - 履歴の`appliedFromYearMonth`を基準に、該当月の保険料を再計算

6. **履歴のCSVエクスポート**
   - 標準報酬履歴をCSV形式でエクスポートする機能（Phase2-6で実装予定）

7. **マイページでの履歴表示**
   - 従業員本人が自分の標準報酬履歴を閲覧できる機能
   - Firestoreルールを`isOwnEmployee`を含む形に拡張

8. **履歴の一括インポート**
   - CSV形式で履歴を一括インポートする機能

9. **履歴の検索・フィルタ機能**
   - 決定区分や期間で履歴をフィルタリングする機能

10. **履歴のグラフ表示**
    - 標準報酬月額の推移をグラフで表示する機能

11. **専用ページの追加**
    - `/standard-reward-histories`のような一覧専用ページを追加
    - 複数の従業員の履歴を横断的に確認できる機能

---

## 📚 参考実装

### 既存の実装パターン

- **被扶養者管理機能（Phase2-3）**: `DependentsService`と`dependent-form-dialog.component.ts`の実装を参考にする
- **扶養家族管理の導線改善（Phase2-4）**: `DialogFocusSection`型とセクションナビの実装を参考にする
- **月次保険料計算**: `premium-calculator.ts`で`employee.monthlyWage`がどのように使われているかを確認

### データモデルの参考

- **被扶養者（`Dependent`型）**: サブコレクション構造とメタ情報（`createdAt`, `updatedAt`など）の扱いを参考にする
- **月次保険料（`MonthlyPremium`型）**: スナップショット形式でのデータ保存方法を参考にする

---

## 📝 まとめ

Phase2-5では、標準報酬決定・改定履歴管理機能を実装し、従業員ごとの標準報酬履歴を記録・参照できる基盤を構築します。

**Phase2-5の実装方針（MVP版）**:
- **履歴のCRUDと閲覧に焦点を当てる**。履歴と現在値（`employees.monthlyWage`）の連動機能は将来の拡張とする。
- **必須フィールドのみを実装**。等級・標準報酬月額の詳細は`note`フィールドに記載してもらう運用とする。
- **従業員詳細ダイアログ内のセクションとして完結**。専用ページは作成しない（将来の拡張として検討可能）。
- **admin/hrのみが履歴を管理**。employeeロールからの閲覧はPhase2-5では実装しない（将来の拡張として検討）。

**主な変更点**:
1. `StandardRewardHistory`型（MVP版）と`StandardRewardDecisionKind`型の追加
2. `StandardRewardHistoryService`の実装（CRUD操作）
3. 従業員詳細ダイアログへの「標準報酬履歴」セクション追加
4. 標準報酬履歴フォームダイアログの実装（MVP版フィールドのみ）
5. Firestoreルールの追加（アクセス制御、admin/hrのみ）

**実装の優先順位**:
1. **必須**: 型定義（MVP版）、サービス実装、従業員詳細ダイアログへのセクション追加、Firestoreルール
2. **推奨**: 従業員一覧からの導線追加（Phase2-4のパターンを参考）
3. **将来の拡張**: 「現在適用として反映」チェック機能、等級・標準報酬月額フィールドの追加、マイページでの履歴表示、専用ページの追加

**方針変更のまとめ**:
- 元のPhase2計画では専用ページを作成する方針でしたが、Phase2-5では**従業員詳細ダイアログ内のセクションとして完結する設計**に変更しました。
- これにより、既存の被扶養者管理機能（Phase2-3）と同様のパターンで実装でき、UIの一貫性が保たれます。

この実装により、標準報酬の決定・改定履歴を管理できるようになり、実務上のニーズに対応できるようになります。将来的には、履歴と現在値の連動機能や等級フィールドの追加など、より高度な機能を段階的に実装していくことが可能です。

