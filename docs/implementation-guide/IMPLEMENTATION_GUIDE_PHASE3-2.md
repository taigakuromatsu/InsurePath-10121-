# Phase3-2 実装指示書: 社会保険用語・ルールヘルプ機能

## 1. 概要

Phase3-2では、社会保険の制度や用語が分からない人事担当者・新任担当者でも、画面上のヘルプを見ながら操作できるようにする「社会保険用語・ルールヘルプ機能」を実装します。

「標準報酬月額って何？」「賞与の範囲は？」「短時間労働者の適用条件は？」などの疑問に対して、各画面からヘルプアイコンをクリックすることで、Angular Material Dialogでヘルプコンテンツを表示できるようにします。

本機能は**フロントエンドのみで完結**し、Firebase Functionsなどのサーバーサイド処理は使用しません。すべて静的コンテンツとして実装します。

---

## 2. 前提・ゴール

### 前提

- **既存のヘルプ機能**: 現時点で、InsurePathには専用のヘルプ機能は存在しません
- **既存の説明テキスト**: `mat-hint`が一部のフォームフィールドで使用されていますが、詳細なヘルプコンテンツは存在しません
- **ダイアログ実装パターン**: 既存のダイアログはすべて`MatDialog`を使用し、スタンドアロンコンポーネントとして実装されています
- **コンポーネントディレクトリ**: `src/app/components`ディレクトリは存在しないため、新規作成が必要です

### ゴール

Phase3-2完了の判定基準：

1. ✅ **ヘルプコンテンツ定義ファイル**（`src/app/utils/help-content.ts`）が存在し、以下の3トピックが定義されていること
   - 「標準報酬月額・等級とは？」
   - 「賞与として扱うべき範囲」
   - 「短時間労働者の社会保険適用条件」

2. ✅ **ヘルプダイアログコンポーネント**（`src/app/components/help-dialog.component.ts`）がスタンドアロンで実装され、任意の画面から`MatDialog`経由で呼び出せること

3. ✅ **対象画面にヘルプアイコンが追加されていること**（最低限、以下の画面）
   - 従業員一覧画面（`src/app/pages/employees/employees.page.ts`）
   - 従業員フォーム画面（`src/app/pages/employees/employee-form-dialog.component.ts`）- 標準報酬月額フィールド付近
   - 月次保険料一覧画面（`src/app/pages/premiums/monthly/monthly-premiums.page.ts`）
   - 賞与保険料一覧画面（`src/app/pages/premiums/bonus/bonus-premiums.page.ts`）

4. ✅ **既存機能が壊れていないこと**（登録・編集・計算・CSV入出力など）

5. ✅ **レスポンシブ対応**（スマホ幅でもダイアログ表示が破綻しないこと）

---

## 3. 現状整理

### 3.0 実コード確認済み事項（2025-11-28時点）

以下の事項は実コードを確認済みです。実装時はこれらの情報を前提として進めてください。

- ✅ **コンポーネントディレクトリ**: `src/app/components`ディレクトリは存在しません。新規作成が必要です
- ✅ **ダイアログ実装パターン**: 既存のダイアログ（`employee-detail-dialog.component.ts`、`employee-form-dialog.component.ts`など）はすべて`MatDialog`を使用し、スタンドアロンコンポーネントとして実装されています
- ✅ **テンプレート構成**: すべてのページコンポーネントはインラインテンプレート（`template: `）を使用しており、別ファイルの`.html`は存在しません
- ✅ **既存の説明テキスト**: `employee-form-dialog.component.ts`の116行目で`mat-hint`が使用されていますが、詳細なヘルプ機能は存在しません
- ✅ **ユーティリティディレクトリ**: `src/app/utils`ディレクトリは存在し、`label-utils.ts`、`csv-export.service.ts`などのユーティリティが配置されています

### 3.1 対象画面の構成

#### 従業員関連画面

- **`src/app/pages/employees/employees.page.ts`**
  - 従業員一覧を表示するページ
  - スタンドアロンコンポーネント、インラインテンプレート
  - `MatDialog`を使用して`EmployeeFormDialogComponent`や`EmployeeDetailDialogComponent`を開いている
  - ヘッダ部分に`<mat-card class="header-card">`があり、タイトルと説明文が表示されている

- **`src/app/pages/employees/employee-form-dialog.component.ts`**
  - 従業員の新規作成・編集用のダイアログ
  - スタンドアロンコンポーネント、インラインテンプレート
  - 「標準報酬月額」フィールド（115行目付近）に`mat-hint`が使用されている
  - `MatDialog`を使用して実装されている

#### 保険料計算関連画面

- **`src/app/pages/premiums/monthly/monthly-premiums.page.ts`**
  - 月次保険料一覧を表示するページ
  - スタンドアロンコンポーネント、インラインテンプレート
  - ヘッダ部分に`<mat-card class="header-card">`があり、タイトルと説明文が表示されている
  - 「対象年月を選択」セクションがある

- **`src/app/pages/premiums/bonus/bonus-premiums.page.ts`**
  - 賞与保険料一覧を表示するページ
  - スタンドアロンコンポーネント、インラインテンプレート
  - ヘッダ部分に`<mat-card class="header-card">`があり、タイトルと説明文が表示されている
  - 「賞与支給履歴」セクションがある

### 3.2 既存のダイアログ実装パターン

既存のダイアログコンポーネント（例：`employee-detail-dialog.component.ts`）の実装パターン：

```typescript
@Component({
  selector: 'ip-employee-detail-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    // ... その他の必要なモジュール
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon>person</mat-icon>
      従業員詳細
    </h1>
    <div mat-dialog-content class="content">
      <!-- コンテンツ -->
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>閉じる</button>
    </div>
  `,
  styles: [/* スタイル定義 */]
})
export class EmployeeDetailDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: EmployeeDetailDialogData) {}
}
```

**確認済み**: 既存のダイアログはすべて以下のパターンに従っています：
- `MAT_DIALOG_DATA`を使用してデータを受け取る
- `mat-dialog-title`、`mat-dialog-content`、`mat-dialog-actions`を使用
- スタンドアロンコンポーネントとして実装
- インラインテンプレートとスタイルを使用

### 3.3 既存の説明テキスト・ヒント

**確認済み**: 以下の箇所で`mat-hint`が使用されています：

- `employee-form-dialog.component.ts`（116行目）: 「標準報酬月額を変更すると、標準報酬履歴に自動で記録されます」
- `health-master-form-dialog.component.ts`（91行目）: 「例: 0.0991 (9.91%)」
- `pension-master-form-dialog.component.ts`（47行目）: 「例: 0.183 (18.3%)」
- `care-master-form-dialog.component.ts`（39行目）: 「例: 0.0191 (1.91%)」

ただし、詳細なヘルプコンテンツやヘルプ機能は存在しません。

### 3.4 共通コンポーネント・ユーティリティの場所

**確認済み**:
- `src/app/utils/`ディレクトリは存在し、以下のファイルが配置されています：
  - `label-utils.ts`: ラベル変換用のユーティリティ関数
  - `csv-export.service.ts`: CSVエクスポートサービス
  - `csv-import.service.ts`: CSVインポートサービス
  - `premium-calculator.ts`: 保険料計算ロジック
  - `bonus-calculator.ts`: 賞与保険料計算ロジック
  - `kyokai-presets.ts`: 協会けんぽのプリセットデータ

- `src/app/components/`ディレクトリは存在しません（新規作成が必要）

### 3.5 型定義・ユーティリティの確認

**確認済み**: `src/app/types.ts`には、社会保険関連の型定義が含まれていますが、ヘルプ関連の型定義は存在しません。

既存のユーティリティ（`label-utils.ts`など）は、関数型のユーティリティとして実装されており、サービスとして実装されていません。ヘルプコンテンツも同様に、関数型または定数オブジェクトとして実装することを推奨します。

---

## 4. 変更対象ファイル

### 4.1 新規作成ファイル

1. **`src/app/components/help-dialog.component.ts`**
   - ヘルプダイアログコンポーネント（スタンドアロン）
   - インラインテンプレートとスタイルを含む

2. **`src/app/utils/help-content.ts`**
   - ヘルプコンテンツの定義ファイル
   - トピックID、タイトル、本文、補足情報などを定義

### 4.2 既存ファイルの変更

1. **`src/app/pages/employees/employees.page.ts`**
   - ヘッダ部分にヘルプアイコンを追加
   - `HelpDialogComponent`をインポートして使用

2. **`src/app/pages/employees/employee-form-dialog.component.ts`**
   - 「標準報酬月額」フィールド付近にヘルプアイコンを追加
   - `HelpDialogComponent`をインポートして使用

3. **`src/app/pages/premiums/monthly/monthly-premiums.page.ts`**
   - ヘッダ部分にヘルプアイコンを追加
   - `HelpDialogComponent`をインポートして使用

4. **`src/app/pages/premiums/bonus/bonus-premiums.page.ts`**
   - ヘッダ部分にヘルプアイコンを追加
   - `HelpDialogComponent`をインポートして使用

### 4.3 スコープの明確化

**Phase3-2の対象範囲**:
- 今回は、上記4画面（従業員一覧、従業員フォーム、月次保険料、賞与保険料）にヘルプ機能を追加します
- その他の画面（ダッシュボード、マスタ管理、シミュレーターなど）への追加は、Phase3-2の範囲外とします
- 将来的に他の画面にも追加する場合は、同じパターンで拡張可能な設計にします

---

## 5. 画面仕様（どの画面にどのヘルプを出すか）

### 5.1 ヘルプトピックの定義

以下の3つのヘルプトピックを定義します：

#### トピック1: 標準報酬月額・等級とは？

- **トピックID**: `standardMonthlyReward`
- **表示対象画面**: 
  - 従業員一覧画面（ヘッダ部分）
  - 従業員フォーム画面（標準報酬月額フィールド付近）
  - 月次保険料一覧画面（ヘッダ部分）

- **概要（content）**:
  標準報酬月額は、健康保険・厚生年金の保険料や給付額を計算するときの"基礎となる金額"です。実際の給与（基本給＋各種手当など）の月額を、あらかじめ決められた区分に当てはめたものが標準報酬月額となります。

- **箇条書き（points）**:
  - 基本給に各種手当（通勤手当、残業手当など）を加えた月額報酬をもとに、標準報酬月額が決まります
  - 標準報酬月額に応じて、1級から47級までの等級が決まります
  - 等級は毎年4月から6月の報酬を基に「定時決定」され、その年の9月から翌年8月まで適用されます
  - 報酬が大きく変わった場合（昇給・降給など）には「随時改定」が行われ、等級が変更されることがあります
  - InsurePath上では、この標準報酬月額と等級をマスタや従業員情報に登録して、保険料計算の基礎として使用しています

- **注意書き（notes）**:
  標準報酬月額は、社会保険料の計算だけでなく、傷病手当金や出産手当金などの給付額の計算にも使用されます。等級の決定方法や最新のルールについては、必ず協会けんぽ・年金事務所・社労士などの案内を確認してください。

#### トピック2: 賞与として扱うべき範囲

- **トピックID**: `bonusRange`
- **表示対象画面**:
  - 賞与保険料一覧画面（ヘッダ部分）

- **概要（content）**:
  ここでいう"賞与"は、毎月の給与とは別に臨時・一時的に支給されるお金であり、社会保険上の"標準賞与額"の対象になる支給を指します。

- **箇条書き（points）**:
  - 一般的に賞与に含まれる例：夏・冬のボーナス、決算賞与、業績連動の一時金など
  - 一般的に賞与に含めない例：通勤手当や残業代など毎月の給与に含まれる手当、退職金、見舞金など
  - InsurePathでは、この画面に登録した支給額が「標準賞与額」として扱われ、健康保険・厚生年金の賞与保険料計算に使用されます

- **注意書き（notes）**:
  どの支給を賞与とみなすかは、就業規則や社会保険の運用によって異なる場合があります。迷った場合は、年金事務所や社労士に確認してください。

#### トピック3: 短時間労働者の社会保険適用条件

- **トピックID**: `shortTimeWorker`
- **表示対象画面**:
  - 従業員一覧画面（ヘッダ部分）
  - 従業員フォーム画面（標準報酬月額フィールド付近）

- **概要（content）**:
  短時間労働者（パート・アルバイト等）であっても、一定の条件を満たす場合は社会保険の適用対象になります。これを「適用拡大」といいます。

- **箇条書き（points）**:
  - 短時間労働者のイメージ：一般社員より所定労働時間が短いパート・アルバイトなどの従業員
  - 社会保険の適用が必要になる代表的な条件（目安として）：
    - 週の所定労働時間がおおむね20時間以上であること
    - 月額賃金が一定額以上（例：おおむね8.8万円以上）であること
    - 2か月を超えて雇用が続く見込みがあること
    - 昼間学生ではないこと
    - 事業所の規模など、会社側の条件がある場合があること
  - InsurePath上では、これらの条件を満たす短時間労働者を「社会保険対象」として登録し、標準報酬月額や保険料を管理する前提となっています

- **注意書き（notes）**:
  実際の適用条件や企業規模要件は、法改正等により変わる可能性があります。最終的な判断は、日本年金機構・厚生労働省の公式資料や社労士等の専門家の案内に従ってください。

### 5.2 ヘルプアイコンの配置

#### 従業員一覧画面（`employees.page.ts`）

- **配置場所**: ヘッダカード（`<mat-card class="header-card">`）内のタイトル部分
- **表示内容**: `help_outline`アイコン
- **クリック時の動作**: `['standardMonthlyReward', 'shortTimeWorker']`の2トピックを表示

#### 従業員フォーム画面（`employee-form-dialog.component.ts`）

- **配置場所**: 「標準報酬月額」フィールド（`mat-form-field`）のラベル横またはフィールド右側
- **表示内容**: `help_outline`アイコン（小さめのサイズ）
- **クリック時の動作**: `['standardMonthlyReward', 'shortTimeWorker']`の2トピックを表示

#### 月次保険料一覧画面（`monthly-premiums.page.ts`）

- **配置場所**: ヘッダカード（`<mat-card class="header-card">`）内のタイトル部分
- **表示内容**: `help_outline`アイコン
- **クリック時の動作**: `['standardMonthlyReward']`の1トピックを表示

#### 賞与保険料一覧画面（`bonus-premiums.page.ts`）

- **配置場所**: ヘッダカード（`<mat-card class="header-card">`）内のタイトル部分
- **表示内容**: `help_outline`アイコン
- **クリック時の動作**: `['bonusRange']`の1トピックを表示

### 5.3 ヘルプダイアログのUI仕様

- **ダイアログ幅**: 最大幅720px（既存の`EmployeeDetailDialogComponent`と同様）
- **タイトル**: 「社会保険制度のヘルプ」または各トピックのタイトル
- **コンテンツ**:
  - 複数トピックを表示する場合は、各トピックをセクション分けして表示
  - 各トピックにはタイトル、本文、箇条書き、注意書きなどを含める
  - 長文の場合は縦スクロール可能にする（`max-height: 70vh`、`overflow-y: auto`）
- **アクション**: 「閉じる」ボタン（`mat-dialog-close`）
- **レスポンシブ**: スマホ幅（768px以下）でも内容が読みやすく、横スクロールが発生しないこと

---

## 6. 実装方針

### Step 1: ヘルプコンテンツ定義ファイル `help-content.ts` の設計と実装

**対象ファイル**: `src/app/utils/help-content.ts`（新規作成）

**目的**: ヘルプコンテンツを一元管理し、将来の拡張やi18n対応を容易にする

**実装内容**:

1. **トピックIDの型定義**
   ```typescript
   export type HelpTopicId = 
     | 'standardMonthlyReward'
     | 'bonusRange'
     | 'shortTimeWorker';
   ```

2. **ヘルプトピックのインターフェース定義**
   ```typescript
   export interface HelpTopic {
     id: HelpTopicId;
     title: string;
     content: string; // 本文（Markdown風の簡易記法またはHTML）
     points?: string[]; // 箇条書きのポイント
     notes?: string; // 注意書き
   }
   ```

3. **ヘルプコンテンツの定義**
   - 各トピックのタイトル・本文・ポイント・注意書きを日本語で定義
   - **対象読者**: 人事担当者・新任担当者で、制度に詳しくない人でも雰囲気がつかめるレベルを目標にする
   - **文章の方針**: 専門書レベルの細かい条件は書きすぎず、「どんな概念で、この画面ではどういう意味で使っているのか」を中心に説明する
   - **注意書きの必須項目**: すべてのトピックに「最終判断は年金事務所・社労士・公式資料に従ってください」という趣旨の注意書きを含める
   - 将来トピックを追加しやすい構造にする

4. **トピックマップの作成**
   ```typescript
   export const HELP_TOPICS: Record<HelpTopicId, HelpTopic> = {
     standardMonthlyReward: { /* ... */ },
     bonusRange: { /* ... */ },
     shortTimeWorker: { /* ... */ }
   };
   ```

5. **ヘルパー関数の追加**
   ```typescript
   export function getHelpTopic(id: HelpTopicId): HelpTopic | undefined {
     return HELP_TOPICS[id];
   }
   
   export function getHelpTopics(ids: HelpTopicId[]): HelpTopic[] {
     return ids.map(id => HELP_TOPICS[id]).filter(Boolean);
   }
   ```

**実装イメージ（ほぼコピペ可能なサンプル）**:

```typescript
export const HELP_TOPICS: Record<HelpTopicId, HelpTopic> = {
  standardMonthlyReward: {
    id: 'standardMonthlyReward',
    title: '標準報酬月額・等級とは？',
    content: '標準報酬月額は、健康保険・厚生年金の保険料や給付額を計算するときの"基礎となる金額"です。実際の給与（基本給＋各種手当など）の月額を、あらかじめ決められた区分に当てはめたものが標準報酬月額となります。',
    points: [
      '基本給に各種手当（通勤手当、残業手当など）を加えた月額報酬をもとに、標準報酬月額が決まります',
      '標準報酬月額に応じて、1級から47級までの等級が決まります',
      '等級は毎年4月から6月の報酬を基に「定時決定」され、その年の9月から翌年8月まで適用されます',
      '報酬が大きく変わった場合（昇給・降給など）には「随時改定」が行われ、等級が変更されることがあります',
      'InsurePath上では、この標準報酬月額と等級をマスタや従業員情報に登録して、保険料計算の基礎として使用しています'
    ],
    notes: '標準報酬月額は、社会保険料の計算だけでなく、傷病手当金や出産手当金などの給付額の計算にも使用されます。等級の決定方法や最新のルールについては、必ず協会けんぽ・年金事務所・社労士などの案内を確認してください。'
  },
  bonusRange: {
    id: 'bonusRange',
    title: '賞与として扱うべき範囲',
    content: 'ここでいう"賞与"は、毎月の給与とは別に臨時・一時的に支給されるお金であり、社会保険上の"標準賞与額"の対象になる支給を指します。',
    points: [
      '一般的に賞与に含まれる例：夏・冬のボーナス、決算賞与、業績連動の一時金など',
      '一般的に賞与に含めない例：通勤手当や残業代など毎月の給与に含まれる手当、退職金、見舞金など',
      'InsurePathでは、この画面に登録した支給額が「標準賞与額」として扱われ、健康保険・厚生年金の賞与保険料計算に使用されます'
    ],
    notes: 'どの支給を賞与とみなすかは、就業規則や社会保険の運用によって異なる場合があります。迷った場合は、年金事務所や社労士に確認してください。'
  },
  shortTimeWorker: {
    id: 'shortTimeWorker',
    title: '短時間労働者の社会保険適用条件',
    content: '短時間労働者（パート・アルバイト等）であっても、一定の条件を満たす場合は社会保険の適用対象になります。これを「適用拡大」といいます。',
    points: [
      '短時間労働者のイメージ：一般社員より所定労働時間が短いパート・アルバイトなどの従業員',
      '社会保険の適用が必要になる代表的な条件（目安として）：週の所定労働時間がおおむね20時間以上であること',
      '月額賃金が一定額以上（例：おおむね8.8万円以上）であること',
      '2か月を超えて雇用が続く見込みがあること',
      '昼間学生ではないこと',
      '事業所の規模など、会社側の条件がある場合があること',
      'InsurePath上では、これらの条件を満たす短時間労働者を「社会保険対象」として登録し、標準報酬月額や保険料を管理する前提となっています'
    ],
    notes: '実際の適用条件や企業規模要件は、法改正等により変わる可能性があります。最終的な判断は、日本年金機構・厚生労働省の公式資料や社労士等の専門家の案内に従ってください。'
  }
};
```

**注意事項**:
- 文言は日本語でハードコードしますが、将来的にi18n（多言語化）を導入しやすいように、1箇所にまとめます
- コンテンツは専門的すぎず、初心者にも分かりやすい文章にします
- 必要に応じて、箇条書きや改行を使用して読みやすくします
- **すべてのトピックに注意書きを含め、最終判断は専門家や公式資料に従う旨を明記します**

### Step 2: ヘルプダイアログコンポーネント `help-dialog.component.ts` の設計

**対象ファイル**: `src/app/components/help-dialog.component.ts`（新規作成）

**目的**: ヘルプコンテンツを表示する再利用可能なダイアログコンポーネントを作成

**実装内容**:

1. **スタンドアロンコンポーネントとして実装**
   - `standalone: true`を設定
   - 必要なAngular Materialモジュールをインポート（`MatDialogModule`、`MatButtonModule`、`MatIconModule`など）

2. **ダイアログデータの型定義**
   - `help-dialog.component.ts`ファイル内で`HelpDialogData`インターフェースを定義・exportする
   - 他のページ側（`employees.page.ts`など）から`HelpDialogComponent`と一緒にインポートして使用する
   
   ```typescript
   // help-dialog.component.ts 内で定義
   export interface HelpDialogData {
     topicIds: HelpTopicId[];
     title?: string; // オプション：カスタムタイトル（指定しない場合は「社会保険制度のヘルプ」）
   }
   ```

3. **テンプレートの実装**
   - `mat-dialog-title`: タイトル（`data.title`またはデフォルト）
   - `mat-dialog-content`: ヘルプコンテンツを表示
     - 複数トピックの場合は、各トピックをセクション分けして表示
     - 各トピックにはタイトル、本文、箇条書き、注意書きを含める
   - `mat-dialog-actions`: 「閉じる」ボタン

4. **スタイルの実装**
   - ダイアログ幅: 最大幅720px
   - コンテンツの最大高さ: 70vh
   - 縦スクロール対応: `overflow-y: auto`
   - レスポンシブ対応: スマホ幅でも横スクロールが発生しない

5. **コンポーネントロジック**
   - `MAT_DIALOG_DATA`から`topicIds`を受け取る
   - `help-content.ts`から`getHelpTopics()`を使用してトピックを取得
   - テンプレートでトピックをループ表示

**実装イメージ**:

```typescript
// help-dialog.component.ts の先頭で型定義をexport
export interface HelpDialogData {
  topicIds: HelpTopicId[];
  title?: string;
}

@Component({
  selector: 'ip-help-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    NgFor,
    NgIf
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon>help_outline</mat-icon>
      {{ data.title || '社会保険制度のヘルプ' }}
    </h1>
    <div mat-dialog-content class="help-content">
      <div *ngFor="let topic of topics" class="help-topic">
        <h3 class="topic-title">{{ topic.title }}</h3>
        <p class="topic-content">{{ topic.content }}</p>
        <ul *ngIf="topic.points" class="topic-points">
          <li *ngFor="let point of topic.points">{{ point }}</li>
        </ul>
        <p *ngIf="topic.notes" class="topic-notes">
          <strong>注意:</strong> {{ topic.notes }}
        </p>
      </div>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>
        <mat-icon>close</mat-icon>
        閉じる
      </button>
    </div>
  `,
  styles: [`
    .help-content {
      max-height: 70vh;
      overflow-y: auto;
      padding: 1.5rem;
    }
    .help-topic {
      margin-bottom: 2rem;
    }
    .help-topic:last-child {
      margin-bottom: 0;
    }
    .topic-title {
      font-size: 1.2rem;
      font-weight: 600;
      margin: 0 0 1rem 0;
      color: #333;
    }
    .topic-content {
      margin: 0 0 1rem 0;
      line-height: 1.6;
      color: #555;
    }
    .topic-points {
      margin: 1rem 0;
      padding-left: 1.5rem;
    }
    .topic-points li {
      margin-bottom: 0.5rem;
      line-height: 1.6;
    }
    .topic-notes {
      margin: 1rem 0 0 0;
      padding: 0.75rem 1rem;
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      border-radius: 4px;
      color: #856404;
    }
  `]
})
export class HelpDialogComponent {
  topics: HelpTopic[] = [];

  constructor(@Inject(MAT_DIALOG_DATA) public data: HelpDialogData) {
    this.topics = getHelpTopics(data.topicIds);
  }
}
```

**必要なインポート**（`help-dialog.component.ts`内）:
```typescript
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgFor, NgIf } from '@angular/common';
import { HelpTopicId, HelpTopic, getHelpTopics } from '../../utils/help-content';

// HelpDialogData はこのファイル内で定義・export する（自分自身からインポートする必要はない）
export interface HelpDialogData {
  topicIds: HelpTopicId[];
  title?: string;
}
```

**他のページ側でのインポート例**（`employees.page.ts`など）:
```typescript
import { HelpDialogComponent, HelpDialogData } from '../../components/help-dialog.component';
```

**アクセシビリティ**:
- Escキーで閉じる（`MatDialog`のデフォルト動作）
- 「閉じる」ボタンに適切なラベルを付与
- ダイアログタイトルにアイコンを追加して視認性を向上

### Step 3: 各画面へのヘルプアイコン追加

#### 3-1. 従業員一覧画面（`employees.page.ts`）

**変更内容**:
1. `MatDialog`と`HelpDialogComponent`をインポート
2. ヘッダカードのタイトル部分にヘルプアイコンを追加
3. クリック時に`HelpDialogComponent`を開くメソッドを追加

**実装イメージ**:

```typescript
// imports に追加
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent, HelpDialogData } from '../../components/help-dialog.component';

// コンポーネントクラス内
private readonly dialog = inject(MatDialog);

openHelp(): void {
  this.dialog.open(HelpDialogComponent, {
    width: '720px',
    data: {
      topicIds: ['standardMonthlyReward', 'shortTimeWorker'],
      title: '従業員管理に関するヘルプ'
    } as HelpDialogData
  });
}
```

**テンプレート部分**:
```html
<div class="header-text">
  <h1>
    従業員台帳
    <button mat-icon-button (click)="openHelp()" aria-label="ヘルプを表示">
      <mat-icon>help_outline</mat-icon>
    </button>
  </h1>
  <p>現在の事業所に紐づく従業員を登録・更新できます。</p>
</div>
```

#### 3-2. 従業員フォーム画面（`employee-form-dialog.component.ts`）

**変更内容**:
1. `MatDialog`と`HelpDialogComponent`をインポート（既に`MatDialog`は使用されている可能性あり）
2. 「標準報酬月額」フィールドのラベル横にヘルプアイコンを追加
3. クリック時に`HelpDialogComponent`を開くメソッドを追加

**実装イメージ**:

```typescript
// imports に追加
import { HelpDialogComponent, HelpDialogData } from '../../components/help-dialog.component';

// コンポーネントクラス内（既にdialogが存在する場合はそれを使用）
openHelp(): void {
  this.dialog.open(HelpDialogComponent, {
    width: '720px',
    data: {
      topicIds: ['standardMonthlyReward', 'shortTimeWorker'],
      title: '標準報酬月額に関するヘルプ'
    } as HelpDialogData
  });
}
```

**テンプレート部分**:
```html
<mat-form-field appearance="outline">
  <mat-label>
    標準報酬月額
    <button mat-icon-button (click)="openHelp(); $event.stopPropagation()" aria-label="ヘルプを表示" class="help-icon-button">
      <mat-icon>help_outline</mat-icon>
    </button>
  </mat-label>
  <input matInput type="number" formControlName="monthlyWage" />
  <mat-hint *ngIf="data.employee">標準報酬月額を変更すると、標準報酬履歴に自動で記録されます</mat-hint>
</mat-form-field>
```

**スタイル追加**:
```typescript
styles: [`
  .help-icon-button {
    width: 20px;
    height: 20px;
    line-height: 20px;
    margin-left: 0.25rem;
  }
  .help-icon-button mat-icon {
    font-size: 18px;
    width: 18px;
    height: 18px;
  }
`]
```

#### 3-3. 月次保険料一覧画面（`monthly-premiums.page.ts`）

**変更内容**:
1. `MatDialog`と`HelpDialogComponent`をインポート
2. ヘッダカードのタイトル部分にヘルプアイコンを追加
3. クリック時に`HelpDialogComponent`を開くメソッドを追加

**実装イメージ**: 従業員一覧画面と同様のパターン

```typescript
openHelp(): void {
  this.dialog.open(HelpDialogComponent, {
    width: '720px',
    data: {
      topicIds: ['standardMonthlyReward'],
      title: '月次保険料に関するヘルプ'
    } as HelpDialogData
  });
}
```

#### 3-4. 賞与保険料一覧画面（`bonus-premiums.page.ts`）

**変更内容**:
1. `MatDialog`と`HelpDialogComponent`をインポート（既に`MatDialog`は使用されている可能性あり）
2. ヘッダカードのタイトル部分にヘルプアイコンを追加
3. クリック時に`HelpDialogComponent`を開くメソッドを追加

**実装イメージ**: 従業員一覧画面と同様のパターン

```typescript
openHelp(): void {
  this.dialog.open(HelpDialogComponent, {
    width: '720px',
    data: {
      topicIds: ['bonusRange'],
      title: '賞与保険料に関するヘルプ'
    } as HelpDialogData
  });
}
```

### Step 4: 既存コードとの整合性チェック

**確認項目**:

1. **スタンドアロンコンポーネントの書き方**
   - 既存のダイアログコンポーネントと同じパターンに従う
   - `standalone: true`、インラインテンプレート、スタイル配列を使用

2. **importパスの整理**
   - 相対パスを使用（`../../components/help-dialog.component`など）
   - 既存のコードと同じパス形式に合わせる

3. **既存のダイアログへの影響**
   - 既存の`MatDialog`の使用に影響を与えないこと
   - 既存のダイアログコンポーネントの動作を確認

4. **スタイルの一貫性**
   - 既存のダイアログ（`EmployeeDetailDialogComponent`など）と同様のスタイルを使用
   - 色やフォントサイズを既存のデザインシステムに合わせる

5. **i18n対応の準備**
   - ヘルプ文言を`help-content.ts`に一元化することで、将来的にi18nを導入しやすい構造にする
   - コメントとして「将来的にi18n対応する場合は、このファイルを多言語リソースファイルに置き換える」と記載

**実装時の注意**:
- 既存の`MatDialog`の使用パターンを確認し、同じ方法で`HelpDialogComponent`を開く
- 既存のスタイル（色、フォント、余白など）に合わせる
- 既存のコンポーネントの構造を壊さないように注意する

---

## 7. テスト観点

Phase3-2完了判定のためのテスト観点チェックリスト：

### 7.1 基本機能のテスト

- [ ] **各対象画面でヘルプアイコンが表示される**
  - テスト手順:
    1. 従業員一覧画面を開く
    2. ヘッダ部分に`help_outline`アイコンが表示されていることを確認
    3. 従業員フォーム画面を開く
    4. 「標準報酬月額」フィールド付近にヘルプアイコンが表示されていることを確認
    5. 月次保険料一覧画面を開く
    6. ヘッダ部分にヘルプアイコンが表示されていることを確認
    7. 賞与保険料一覧画面を開く
    8. ヘッダ部分にヘルプアイコンが表示されていることを確認

- [ ] **ヘルプアイコンをクリックするとダイアログが開く**
  - テスト手順:
    1. 各画面のヘルプアイコンをクリック
    2. ヘルプダイアログが表示されることを確認
    3. ダイアログのタイトルが正しいことを確認

- [ ] **ダイアログの内容が想定どおりのヘルプ内容になっている**
  - テスト手順:
    1. 従業員一覧画面のヘルプを開く
    2. 「標準報酬月額・等級とは？」と「短時間労働者の社会保険適用条件」の2トピックが表示されることを確認
    3. 月次保険料一覧画面のヘルプを開く
    4. 「標準報酬月額・等級とは？」の1トピックが表示されることを確認
    5. 賞与保険料一覧画面のヘルプを開く
    6. 「賞与として扱うべき範囲」の1トピックが表示されることを確認

### 7.2 UI/UXのテスト

- [ ] **PC幅で内容が読みやすい（横スクロールが発生しない）**
  - テスト手順:
    1. PC幅（1024px以上）で各画面のヘルプを開く
    2. ダイアログの内容が横スクロールなしで表示されることを確認
    3. テキストが適切に折り返されていることを確認

- [ ] **スマホ幅でも内容が読みやすい（横スクロールが発生しない、縦スクロールで全文が読める）**
  - テスト手順:
    1. ブラウザの開発者ツールで画面幅を768px以下に設定
    2. 各画面のヘルプを開く
    3. ダイアログが画面幅に収まり、横スクロールが発生しないことを確認
    4. 長文の場合は縦スクロールで全文が読めることを確認

- [ ] **ダイアログの閉じるボタンが正常に動作する**
  - テスト手順:
    1. ヘルプダイアログを開く
    2. 「閉じる」ボタンをクリック
    3. ダイアログが閉じることを確認
    4. Escキーを押す
    5. ダイアログが閉じることを確認

### 7.3 既存機能への影響のテスト

- [ ] **既存のボタン・ダイアログ・ナビゲーションに影響していない**
  - テスト手順:
    1. 従業員一覧画面で「従業員を追加」ボタンが正常に動作することを確認
    2. 従業員詳細ダイアログが正常に開くことを確認
    3. 従業員フォームダイアログが正常に開くことを確認
    4. CSVエクスポート・インポート機能が正常に動作することを確認

- [ ] **リロードや画面遷移後もヘルプ機能が正常動作する**
  - テスト手順:
    1. 各画面でヘルプを開く
    2. ページをリロード
    3. 再度ヘルプを開き、正常に表示されることを確認
    4. 画面遷移（従業員一覧 → 月次保険料など）を行い、各画面でヘルプが正常に動作することを確認

- [ ] **FirestoreへのアクセスやFunctions呼び出しが増えていない（静的ヘルプである）**
  - テスト手順:
    1. ブラウザの開発者ツールでネットワークタブを開く
    2. ヘルプダイアログを開く
    3. FirestoreへのアクセスやFunctions呼び出しが発生していないことを確認（静的コンテンツのみ）

### 7.4 アクセシビリティのテスト

- [ ] **ヘルプアイコンに適切なaria-labelが設定されている**
  - テスト手順:
    1. 各画面のヘルプアイコンのHTMLを確認
    2. `aria-label="ヘルプを表示"`などの適切なラベルが設定されていることを確認

- [ ] **キーボード操作でヘルプを開ける**
  - テスト手順:
    1. Tabキーでヘルプアイコンにフォーカスを移動
    2. EnterキーまたはSpaceキーでヘルプを開く
    3. ヘルプダイアログが表示されることを確認

---

## 8. 注意事項・今後の拡張余地

### 8.1 既存機能を壊さないための注意点

- **既存のダイアログ実装**: 既存の`MatDialog`の使用パターンを確認し、同じ方法で`HelpDialogComponent`を開くこと
- **スタイルの一貫性**: 既存のダイアログ（`EmployeeDetailDialogComponent`など）と同様のスタイルを使用すること
- **コンポーネント構造**: 既存のコンポーネントの構造を壊さないように注意すること

### 8.2 パフォーマンスに関する注意点

- **静的コンテンツ**: ヘルプコンテンツは静的であるため、FirestoreへのアクセスやFunctions呼び出しは発生しません
- **バンドルサイズ**: ヘルプコンテンツが大きくなる場合は、将来的に遅延読み込みを検討することができます

### 8.3 今後の拡張余地

- **追加トピック**: `help-content.ts`に新しいトピックを追加することで、簡単にヘルプコンテンツを拡張できます
- **他の画面への追加**: 同じパターンで他の画面（ダッシュボード、マスタ管理、シミュレーターなど）にもヘルプ機能を追加できます
- **i18n対応**: 将来的に多言語対応が必要になった場合、`help-content.ts`を多言語リソースファイルに置き換えることで対応できます
- **動的コンテンツ**: 将来的にFirebase Functionsや外部APIからヘルプコンテンツを取得する場合は、`help-content.ts`の実装を変更することで対応できます
- **検索機能**: ヘルプコンテンツが増えた場合、検索機能を追加することができます
- **カテゴリ分類**: トピックが増えた場合、カテゴリで分類して表示することができます

### 8.4 Phase3-2の範囲外

- **Firebase Functions**: Phase3-2ではFirebase Functionsなどのサーバーサイド処理は使用しません
- **外部API連携**: 外部APIからヘルプコンテンツを取得する機能は含まれません
- **ユーザーごとのカスタマイズ**: ユーザーごとにヘルプコンテンツをカスタマイズする機能は含まれません
- **ヘルプの編集機能**: 管理者がヘルプコンテンツを編集する機能は含まれません（将来的に追加可能）

---

## 9. 実装完了の判定基準

以下の条件をすべて満たした場合、Phase3-2は完了とみなします：

1. ✅ `src/app/utils/help-content.ts`が存在し、3つのヘルプトピック（`standardMonthlyReward`、`bonusRange`、`shortTimeWorker`）が定義されている
2. ✅ `src/app/components/help-dialog.component.ts`が存在し、スタンドアロンコンポーネントとして実装されている
3. ✅ 4つの対象画面（従業員一覧、従業員フォーム、月次保険料、賞与保険料）にヘルプアイコンが追加されている
4. ✅ ヘルプアイコンをクリックすると、適切なトピックが表示されるヘルプダイアログが開く
5. ✅ PC幅・スマホ幅の両方で、ヘルプダイアログが適切に表示される（横スクロールが発生しない）
6. ✅ 既存の機能（登録・編集・計算・CSV入出力など）が正常に動作する
7. ✅ テスト観点のチェックリストの主要項目（7.1〜7.3）がすべてクリアされている

---

以上でPhase3-2の実装指示書は完了です。実装時は、この指示書に従って段階的に実装を進めてください。

