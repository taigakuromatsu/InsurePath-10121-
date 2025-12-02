# Phase3-8 実装指示書: e-Gov 電子申請連携機能

## 📋 概要

Phase3-8では、既存の「社会保険手続き履歴」ページ（`/procedures`）に、e-Gov電子申請で利用する申請データ（CSV形式）を自動生成・出力する機能を統合します。

**重要**: 本機能はe-Gov側へのAPI連携は行わず、あくまで「申請データの作成・管理」がInsurePathの役割です。ユーザーはダウンロードしたCSVファイルをe-Govの画面やツールからアップロードする前提とします。

**注意**: 本機能を実装する前に、Phase3-7（e-Gov用必要情報の先行実装）が完了している必要があります。Phase3-7で実装した必要情報（マイナンバー、基礎年金番号、事業所整理記号など）を活用してCSVを生成します。

### Phase3-8のスコープ

Phase3-8では以下の機能を実装します：

- **e-Govステータス管理**: 手続きレコードにe-Gov専用ステータス（未出力／準備OK／出力済／申請済／差戻し）を追加し、2階建てのステータス管理を実現
- **e-Govエクスポートダイアログ**: 手続き一覧からe-Gov用CSVを出力するための専用ダイアログを追加
- **CSV出力サービス**: 手続き種別ごとに適切なCSV形式で申請データを生成するサービスを実装
- **一覧テーブルの拡張**: 既存の手続き一覧テーブルに「e-Gov」列を追加し、e-Govステータスを表示

**今回の実装対象外**:

- **e-Gov側へのAPI連携**: e-Gov側への実際の送信は行わない
- **完全なe-Gov形式の再現**: 実際のe-Gov形式を完全再現する必要はなく、簡略化したCSV形式を採用
- **e-Govステータス専用フィルタ**: MVPでは画面上部にe-Govステータス専用フィルタは追加しない（エクスポートダイアログ内で絞り込み）

---

## 🎯 目的・スコープ

### 目的

Phase3-8の目的は、InsurePath上で作成した社会保険手続きをもとに、e-Gov電子申請で利用する申請データを自動生成できるようにすることです。

具体的には：

1. **申請データの自動生成**: 従業員・被扶養者・標準報酬決定履歴・賞与情報などを集約し、e-Gov用CSVテキストを構築
2. **ステータス管理**: 手続き単位で「作成中／申請準備完了／e-Gov送信済／差戻し」といったe-Gov専用ステータスを管理
3. **進捗の可視化**: 「どの手続きがどこまで進んでいるか」を一覧で分かるようにする

### ページ構成・役割分担

- **「申請ワークフロー」ページ** (`/requests`): 社内作業としての進捗を管理するタスク寄り画面（既存、Phase3-3で実装済み）
- **「手続き履歴」ページ** (`/procedures`): いつ・どんな手続きを行ったかの履歴台帳＋期限管理（既存、Phase3-4で実装済み）
- **Phase3-8での改修**: `/procedures`ページにe-Gov用のステータス管理とエクスポート機能を統合する。新しい`/egov`のようなページは作らない。

---

## 🏗 対象ファイルと全体アーキテクチャ

### 変更対象ファイル

#### 既存ファイルの修正

- `src/app/types.ts`
  - `EgovStatus`型の追加
  - `SocialInsuranceProcedure`インターフェースにe-Gov関連フィールドを追加

- `src/app/services/procedures.service.ts`
  - e-Govステータス更新用のメソッド追加（既存の`update()`メソッドで対応可能な場合は追加不要）

- `src/app/pages/procedures/procedures.page.ts`
  - 一覧テーブルに「e-Gov」列を追加
  - 「e-Gov用データ出力」ボタンを追加
  - 行メニューにe-Gov関連アクションを追加（MVPでは最小限）

#### 新規作成ファイル

- `src/app/utils/egov-export.service.ts`
  - e-Gov用CSV生成サービス（新規作成）

- `src/app/pages/procedures/egov-export-dialog.component.ts`
  - e-Govエクスポート専用ダイアログコンポーネント（新規作成）

#### Firestoreセキュリティルール

- `firestore.rules`
  - e-Gov関連フィールドの更新権限チェック（必要に応じて追加）

### 全体アーキテクチャ

```
/procedures ページ
├── 既存の手続き一覧テーブル
│   ├── 既存列（手続き種別、対象者、事由発生日、提出期限、ステータス）
│   └── 新規列（e-Gov） ← Phase3-8で追加
├── 既存のフィルタ（ステータス、期限、手続き種別）
├── 「e-Gov用データ出力」ボタン ← Phase3-8で追加
└── 行メニュー（編集、削除）
    └── e-Gov関連アクション ← Phase3-8で追加（MVPでは最小限）

EgovExportDialogComponent（新規）
├── フィルタ条件
│   ├── 手続き種別（複数選択可）
│   ├── 期間（事由発生日 or 提出期限）
│   └── e-Govステータス
├── 出力候補一覧テーブル
│   ├── 手続き種別、対象者、事由発生日、ステータス、e-Govステータス
│   └── 要確認マーク（必要項目に欠けがある場合）
└── 出力アクション
    └── 「選択した手続きをe-Gov用CSVとして出力」

EgovExportService（新規）
├── buildCsvForProcedures()
│   ├── 手続き種別ごとに異なるCSV形式を生成
│   ├── 従業員・被扶養者・標準報酬・賞与情報を集約
│   └── CSVテキストを返す
└── downloadCsv()（または既存のCsvExportServiceを再利用）
```

---

## 📊 データモデル・Firestore 設計

### 型定義の追加

#### `EgovStatus`型の追加

`src/app/types.ts`に以下の型を追加します：

```typescript
export type EgovStatus =
  | 'not_applicable'   // e-Gov対象外（手続き種別によってはe-Gov非対応の場合）
  | 'not_exported'     // e-Gov対象だが、まだ出力していない
  | 'ready'            // 必要項目が揃い、いつでも出力可能
  | 'exported'         // CSVなどを出力済
  | 'sent'             // e-Govへ送信済（ユーザーが手動で更新）
  | 'returned';        // e-Govで差戻しになった
```

#### `SocialInsuranceProcedure`インターフェースの拡張

既存の`SocialInsuranceProcedure`インターフェースに、以下のフィールドを追加します：

```typescript
export interface SocialInsuranceProcedure {
  // ... 既存フィールド（id, officeId, procedureType, employeeId, dependentId, incidentDate, deadline, status, ...）
  
  // Phase3-8で追加: e-Gov関連フィールド
  egovStatus?: EgovStatus;                    // e-Govステータス（デフォルト: 'not_exported'）
  egovLastExportedAt?: IsoDateString | null; // 最後にCSV出力した日時
  egovLastExportedByUserId?: string | null;  // 最後にCSV出力したユーザーID
  egovNote?: string | null;                   // e-Gov関連メモ（差戻し理由など）
}
```

**注意**: 既存データへの影響を考慮し、すべてのe-Gov関連フィールドは`optional`（`?`）とし、デフォルト値は以下のように扱います：

- `egovStatus`: 未設定の場合は`'not_exported'`として扱う（手続き種別によっては`'not_applicable'`も可）
- `egovLastExportedAt`: `null`または未設定
- `egovLastExportedByUserId`: `null`または未設定
- `egovNote`: `null`または未設定

### e-Govステータスの遷移パターン

#### 基本フロー

```
[not_applicable]  ← e-Gov対象外の手続き種別の場合
     ↓
[not_exported]    ← 初期状態（e-Gov対象の手続き）
     ↓
[ready]           ← 必要項目が揃った状態（自動判定または手動設定）
     ↓
[exported]        ← CSV出力後（自動更新）
     ↓
[sent]            ← ユーザーが手動で「e-Gov送信済」に更新
     ↓
[returned]        ← e-Govで差戻しになった場合（ユーザーが手動で更新）
     ↓
[ready]           ← 差戻し後、修正して再出力可能な状態に戻す
```

#### ステータスの意味と遷移条件

| ステータス | 意味 | 遷移条件 |
|-----------|------|---------|
| `not_applicable` | e-Gov対象外 | 手続き種別がe-Gov非対応の場合（MVPでは全手続き種別を対象とするため、このステータスは使用しない想定） |
| `not_exported` | 未出力 | 初期状態。e-Gov対象の手続きで、まだCSV出力していない |
| `ready` | 準備OK | 必要項目が揃い、いつでも出力可能な状態。バリデーション通過後、自動または手動で設定 |
| `exported` | 出力済 | CSV出力後、自動的に`not_exported`または`ready`から遷移 |
| `sent` | 申請済 | ユーザーが手動で「e-Govへ送信済」に更新 |
| `returned` | 差戻し | ユーザーが手動で「e-Govで差戻しになった」に更新 |

#### メタ情報フィールドの更新タイミング

| フィールド | 更新タイミング | 更新値 |
|-----------|--------------|--------|
| `egovLastExportedAt` | CSV出力時 | 現在日時（`new Date().toISOString().slice(0, 10)`） |
| `egovLastExportedByUserId` | CSV出力時 | 現在ログインユーザーのID |
| `egovNote` | ユーザーが手動で更新 | 差戻し理由などのメモ |

### Firestoreコレクション構造

既存の`offices/{officeId}/procedures/{procedureId}`コレクション構造は変更せず、ドキュメントにe-Gov関連フィールドを追加するだけです。

**既存データへの影響**: 新フィールドはすべて`optional`のため、既存データには影響しません。既存の手続きレコードは、e-Gov関連フィールドが未設定の状態で動作します。

---

## 🖥 画面仕様（/procedures 改修 & e-Gov エクスポートダイアログ）

### 1. 手続き一覧テーブルの拡張

#### 1-1. 「e-Gov」列の追加

既存の手続き一覧テーブル（`procedures.page.ts`）に、右側に「e-Gov」列を追加します。

**表示イメージ**:

| 手続き種別 | 対象者 | 事由発生日 | 提出期限 | ステータス | e-Gov | アクション |
|-----------|--------|------------|----------|-----------|-------|-----------|
| 資格取得届 | 黒松 大河 | 2025-12-01 | 2025-12-06 | 🟦 未着手 | 🟪 e-Gov未出力 | ︙ |
| 資格喪失届 | 山田 花子 | 2025-11-15 | 2025-11-20 | 🟩 提出済 | 🟦 e-Gov出力済 | ︙ |

**実装詳細**:

- 「ステータス」列は既存の`ProcedureStatus`（`not_started` / `in_progress` / `submitted` / `rejected`）をそのまま表示
- 「e-Gov」列には`EgovStatus`をチップ表示する
- チップのラベルは用途が分かるように、**必ず「e-Gov」または「電子申請」を含む文言**にする
  - `not_exported` → 「e-Gov未出力」
  - `ready` → 「e-Gov準備OK」
  - `exported` → 「e-Gov出力済」
  - `sent` → 「e-Gov申請済」
  - `returned` → 「e-Gov差戻し」
- チップの色分けは、既存のステータスチップと同様のスタイルを適用

**テンプレート例**:

```html
<ng-container matColumnDef="egovStatus">
  <th mat-header-cell *matHeaderCellDef>e-Gov</th>
  <td mat-cell *matCellDef="let row">
    <span [class]="'status-chip egov-status-' + (row.egovStatus || 'not_exported')">
      {{ getEgovStatusLabel(row.egovStatus) }}
    </span>
  </td>
</ng-container>
```

#### 1-2. 上部フィルタの扱い

既存のフィルタ（ステータス／期限／手続き種別）はそのまま利用します。

**MVPでは、e-Govステータス専用のフィルタは画面上部には追加しません。**

代わりに、e-Gov用データ出力ダイアログ側でe-Govステータスによる絞り込みを行う仕様にします。

#### 1-3. 「e-Gov用データ出力」ボタンの追加

手続き一覧の右上（「手続きを登録」ボタンの横）に、**「e-Gov用データ出力」**ボタン（`mat-flat-button`）を追加します。

**実装詳細**:

- ボタンのラベル: 「e-Gov用データ出力」または「電子申請データ出力」
- アイコン: `cloud_download`または`file_download`
- クリック時の動作: `EgovExportDialogComponent`を開く

**テンプレート例**:

```html
<div class="card-header">
  <h2>手続き一覧</h2>
  <div class="header-actions">
    <button mat-stroked-button (click)="openEgovExportDialog()">
      <mat-icon>cloud_download</mat-icon>
      e-Gov用データ出力
    </button>
    <button mat-flat-button color="primary" (click)="openCreateDialog()">
      <mat-icon>post_add</mat-icon>
      手続きを登録
    </button>
  </div>
</div>
```

#### 1-4. 行メニューへのe-Gov関連アクション追加（将来拡張）

各行の「︙」メニュー（または相当）に、以下のようなe-Gov関連アクションを追加する想定ですが、**MVPでは実装しません**。将来拡張として仕様を記載します。

**将来拡張案**:

- 「この手続きをe-Gov用にプレビュー」
- 「この手続きのe-Gov用CSVを出力」
- 「e-Govステータスを変更（申請済／差戻し など）」

**MVPでの対応**: MVPでは、e-Gov関連の操作は「e-Gov用データ出力」ダイアログから一括で行う仕様とします。

### 2. e-Govエクスポートダイアログ（新規コンポーネント）

#### 2-1. コンポーネント名とファイル

- **コンポーネント名**: `EgovExportDialogComponent`
- **ファイルパス**: `src/app/pages/procedures/egov-export-dialog.component.ts`
- **スタンドアロンコンポーネント**: `standalone: true`

#### 2-2. ダイアログのUI構成

**ダイアログタイトル**: 「e-Gov用データ出力」

**ダイアログの構成要素**:

1. **フィルタ条件セクション**（上部）
   - 手続き種別（複数選択可）
   - 期間（事由発生日 or 提出期限で絞り込み）
   - e-Govステータス（「未出力のみ」「準備OKのみ」「出力済のみ」など）

2. **出力候補一覧テーブル**（中央）
   - 手続き種別 / 対象者 / 事由発生日 / ステータス / e-Govステータス などを表示
   - 必要項目に欠けがある場合は「⚠ 要確認」マークを表示
   - チェックボックスで出力対象を選択可能（全選択/全解除ボタンも）

3. **出力アクション**（下部）
   - 「選択した手続きをe-Gov用CSVとして出力」ボタン
   - 出力後に該当手続きのe-Govステータスをどう更新するかの説明

#### 2-3. フィルタ条件の詳細

**手続き種別フィルタ**:

- `mat-select`（複数選択可）または`mat-checkbox`リスト
- 選択肢: 資格取得届、資格喪失届、算定基礎届、月額変更届、被扶養者異動届、賞与支払届
- デフォルト: すべて選択

**期間フィルタ**:

- ラジオボタンで「事由発生日」または「提出期限」を選択
- 開始日・終了日の日付入力（`mat-datepicker`）
- デフォルト: 過去1ヶ月〜未来1ヶ月

**e-Govステータスフィルタ**:

- `mat-select`（単一選択）
- 選択肢:
  - 「すべて」
  - 「未出力のみ」（`not_exported`）
  - 「準備OKのみ」（`ready`）
  - 「出力済のみ」（`exported`）
  - 「申請済のみ」（`sent`）
  - 「差戻しのみ」（`returned`）
- デフォルト: 「すべて」

#### 2-4. 出力候補一覧テーブルの詳細

**テーブル列**:

| 列名 | 内容 |
|------|------|
| 選択 | チェックボックス（全選択/全解除対応） |
| 手続き種別 | `getProcedureTypeLabel(procedure.procedureType)` |
| 対象者 | 従業員名（被扶養者異動届の場合は被扶養者名も表示） |
| 事由発生日 | `procedure.incidentDate` |
| 提出期限 | `procedure.deadline` |
| ステータス | 業務ステータス（`not_started` / `in_progress` / `submitted` / `rejected`） |
| e-Govステータス | e-Govステータス（`not_exported` / `ready` / `exported` / `sent` / `returned`） |
| 確認 | 「⚠ 要確認」マーク（必要項目に欠けがある場合） |

**「⚠ 要確認」マークの表示条件**:

- 従業員にマイナンバー/被保険者番号が未設定の場合
- 資格取得日・喪失日が未入力の場合（該当する手続き種別の場合）
- 被扶養者異動届なのに対象の被扶養者が紐づいていない場合
- 標準報酬決定履歴が未登録の場合（該当する手続き種別の場合）

**実装方針**: バリデーションロジックは`EgovExportService`に実装し、テーブル表示時に各手続きのバリデーション結果を表示します。

#### 2-5. 出力アクションの詳細

**「選択した手続きをe-Gov用CSVとして出力」ボタン**:

- `mat-flat-button`、`color="primary"`
- ボタンラベル: 「選択した手続きをe-Gov用CSVとして出力」
- アイコン: `download`
- クリック時の動作:
  1. 選択された手続きのIDを取得
  2. `EgovExportService.buildCsvForProcedures()`を呼び出し、CSVテキストを生成
  3. CSVファイルをダウンロード
  4. 出力された手続きの`egovStatus`を`'exported'`に更新（`ProceduresService.update()`を呼び出し）
  5. `egovLastExportedAt`と`egovLastExportedByUserId`を更新
  6. ダイアログを閉じる（または「出力完了」メッセージを表示）

**出力後のステータス更新**:

- 出力された手続きの`egovStatus`を`'exported'`に更新
- `egovLastExportedAt`を現在日時に更新
- `egovLastExportedByUserId`を現在ログインユーザーのIDに更新

**エラー時のUX**:

- エラーがある行は出力対象から除外し、テーブルに「⚠ エラーがあるため出力対象から除外されました」と表示
- CSV出力ボタン横に「エラーがある行は出力対象から除外されています」という説明を表示
- または、エラー行がある場合は出力ボタンを`disabled`にする（仕様としてどちらかを選択）

**MVPでの方針**: エラーがある行は出力対象から除外し、警告メッセージを表示する方針とします。

---

## ⚙ ロジック・サービス設計（egov-export.service.ts）

### 1. サービスファイルの作成

**ファイルパス**: `src/app/utils/egov-export.service.ts`

**サービスの役割**:

- 手続き・従業員・被扶養者・標準報酬決定・賞与情報などを集約し、e-Gov用CSVテキストを構築する
- 手続き種別ごとに異なるCSV形式を生成する
- バリデーションロジックを実装し、必要項目の欠けをチェックする

### 2. データ取得の方針

**Firestoreから直接読むのか、呼び出し側から渡すのか**:

- **方針**: 呼び出し側（`EgovExportDialogComponent`）から必要データを渡す方針とします
- **理由**: 
  - サービス層の責務を明確にする（データ取得はコンポーネント側、CSV生成はサービス側）
  - テストしやすくする
  - 既存の`CsvExportService`のパターンに合わせる

**必要なデータ**:

- `Office`: 事業所情報（事業所コードなど）
- `SocialInsuranceProcedure[]`: 出力対象の手続き一覧
- `Employee[]`: 関連する従業員情報
- `Dependent[]`: 関連する被扶養者情報（被扶養者異動届の場合）
- `StandardRewardHistory[]`: 標準報酬決定履歴（算定基礎届・月額変更届の場合）
- `BonusPremium[]`: 賞与情報（賞与支払届の場合）

### 3. 出力形式の設計

**簡略化したCSV形式を採用**します。実際のe-Gov形式を完全再現する必要はなく、InsurePathの既存データから埋められる項目を優先し、不足するものは空欄のまま出力します。

#### 3-1. 手続き種別ごとのCSV形式

**資格取得届 CSV**:

```csv
事業所コード,従業員番号,氏名,生年月日,資格取得日,標準報酬月額,健康保険被保険者記号,健康保険被保険者番号,厚生年金被保険者番号
OFFICE001,EMP001,黒松 大河,1990-01-01,2025-12-01,300000,1234,567890,123456789012
```

**資格喪失届 CSV**:

```csv
事業所コード,従業員番号,氏名,資格喪失日,喪失理由,健康保険被保険者記号,健康保険被保険者番号,厚生年金被保険者番号
OFFICE001,EMP001,黒松 大河,2025-12-31,退職,1234,567890,123456789012
```

**算定基礎届 CSV**:

```csv
事業所コード,従業員番号,氏名,対象年,標準報酬月額,健康保険等級,厚生年金等級
OFFICE001,EMP001,黒松 大河,2025,300000,20,20
```

**月額変更届 CSV**:

```csv
事業所コード,従業員番号,氏名,変更年月,変更前標準報酬月額,変更後標準報酬月額,変更前健康保険等級,変更後健康保険等級
OFFICE001,EMP001,黒松 大河,2025-12,280000,300000,19,20
```

**被扶養者異動届 CSV**:

```csv
事業所コード,従業員番号,被扶養者氏名,続柄,生年月日,異動日,異動区分,健康保険被保険者記号,健康保険被保険者番号
OFFICE001,EMP001,黒松 花子,子,2020-01-01,2025-12-01,追加,1234,567890
```

**賞与支払届 CSV**:

```csv
事業所コード,従業員番号,氏名,支給日,標準賞与額,健康保険被保険者記号,健康保険被保険者番号,厚生年金被保険者番号
OFFICE001,EMP001,黒松 大河,2025-12-15,500000,1234,567890,123456789012
```

**注意**: 上記は簡略化した例です。実際のe-Gov形式に近づける場合は、カタログやe-Govの仕様書を参照してください。

#### 3-2. 必須項目と不足項目の扱い

**少なくとも以下の項目は入れたい**:

- 事業所コード（`Office`から取得、未設定の場合は空欄）
- 従業員番号（`Employee.employeeNumber`、未設定の場合は空欄）
- 氏名（`Employee.name`）
- 手続き種別ごとの必須項目（資格取得日、資格喪失日、標準報酬月額など）

**足りない項目がある場合の扱い**:

- **空欄のまま出力**: 不足する項目は空欄（`''`）として出力
- **警告表示**: バリデーションロジックで必要項目の欠けを検出し、エクスポートダイアログのテーブルに「⚠ 要確認」マークを表示
- **出力対象から除外**: MVPでは、エラーがある行は出力対象から除外し、警告メッセージを表示する方針とします

### 4. API設計例

**サービスのメソッド構成**:

```typescript
@Injectable({ providedIn: 'root' })
export class EgovExportService {
  /**
   * 手続き一覧をe-Gov用CSV形式に変換する
   * @param office 事業所情報
   * @param procedures 出力対象の手続き一覧
   * @param employees 関連する従業員情報（employeeIdをキーとしたMap）
   * @param dependents 関連する被扶養者情報（dependentIdをキーとしたMap、必要に応じて）
   * @param standardRewardHistories 標準報酬決定履歴（必要に応じて）
   * @param bonuses 賞与情報（必要に応じて）
   * @returns CSVテキスト（UTF-8 + BOM）
   */
  buildCsvForProcedures(
    office: Office,
    procedures: SocialInsuranceProcedure[],
    employees: Map<string, Employee>,
    dependents?: Map<string, Dependent>,
    standardRewardHistories?: StandardRewardHistory[],
    bonuses?: BonusPremium[]
  ): string {
    // 手続き種別ごとにグループ化
    const grouped = this.groupProceduresByType(procedures);
    
    // 手続き種別ごとにCSVを生成
    const csvLines: string[] = [];
    
    for (const [type, procs] of Object.entries(grouped)) {
      const csv = this.buildCsvForType(
        type as ProcedureType,
        office,
        procs,
        employees,
        dependents,
        standardRewardHistories,
        bonuses
      );
      csvLines.push(csv);
    }
    
    // 複数の手続き種別がある場合は、種別ごとにセクションを分ける
    return csvLines.join('\n\n');
  }

  /**
   * 手続き種別ごとのCSVを生成
   */
  private buildCsvForType(
    type: ProcedureType,
    office: Office,
    procedures: SocialInsuranceProcedure[],
    employees: Map<string, Employee>,
    dependents?: Map<string, Dependent>,
    standardRewardHistories?: StandardRewardHistory[],
    bonuses?: BonusPremium[]
  ): string {
    switch (type) {
      case 'qualification_acquisition':
        return this.buildQualificationAcquisitionCsv(office, procedures, employees);
      case 'qualification_loss':
        return this.buildQualificationLossCsv(office, procedures, employees);
      case 'standard_reward':
        return this.buildStandardRewardCsv(office, procedures, employees, standardRewardHistories);
      case 'monthly_change':
        return this.buildMonthlyChangeCsv(office, procedures, employees, standardRewardHistories);
      case 'dependent_change':
        return this.buildDependentChangeCsv(office, procedures, employees, dependents);
      case 'bonus_payment':
        return this.buildBonusPaymentCsv(office, procedures, employees, bonuses);
      default:
        return '';
    }
  }

  /**
   * バリデーション: 手続きの必要項目が揃っているかチェック
   * @returns エラーメッセージの配列（エラーがない場合は空配列）
   */
  validateProcedure(
    procedure: SocialInsuranceProcedure,
    employee: Employee | undefined,
    dependent?: Dependent,
    standardRewardHistory?: StandardRewardHistory,
    bonus?: BonusPremium
  ): string[] {
    const errors: string[] = [];
    
    // 従業員情報のチェック
    if (!employee) {
      errors.push('従業員情報が見つかりません');
      return errors;
    }
    
    // 手続き種別ごとの必須項目チェック
    switch (procedure.procedureType) {
      case 'qualification_acquisition':
      case 'qualification_loss':
        if (!employee.healthInsuranceNumber || !employee.pensionInsuranceNumber) {
          errors.push('被保険者番号が未設定です');
        }
        break;
      case 'dependent_change':
        if (!dependent) {
          errors.push('被扶養者情報が見つかりません');
        }
        break;
      case 'standard_reward':
      case 'monthly_change':
        if (!standardRewardHistory) {
          errors.push('標準報酬決定履歴が見つかりません');
        }
        break;
      case 'bonus_payment':
        if (!bonus) {
          errors.push('賞与情報が見つかりません');
        }
        break;
    }
    
    return errors;
  }

  /**
   * CSVダウンロード処理（既存のCsvExportServiceのパターンを参考）
   */
  downloadCsv(csvText: string, fileName: string): void {
    const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}
```

**実装の注意点**:

- 既存の`CsvExportService`のパターン（`escapeCsvValue()`、`createCsvBlob()`など）を参考にする
- UTF-8 + BOMエンコーディングで出力（Excelでの文字化け防止）
- CSVのエスケープ処理（カンマ、改行、ダブルクォートの処理）

### 5. バリデーションロジックの詳細

**MVPとして実装するバリデーション**:

1. **従業員情報の存在チェック**: 手続きに紐づく従業員情報が存在するか
2. **被保険者番号のチェック**: 資格取得届・資格喪失届の場合、健康保険被保険者番号・厚生年金被保険者番号が設定されているか
3. **被扶養者情報のチェック**: 被扶養者異動届の場合、被扶養者情報が紐づいているか
4. **標準報酬決定履歴のチェック**: 算定基礎届・月額変更届の場合、標準報酬決定履歴が存在するか
5. **賞与情報のチェック**: 賞与支払届の場合、賞与情報が紐づいているか

**エラーメッセージの形式**:

- エラーメッセージは日本語で、ユーザーが理解しやすい形式にする
- 複数のエラーがある場合は、すべてのエラーメッセージを配列で返す

---

## ✅ バリデーション・エラー処理・UX

### 1. バリデーションの実装方針

**エクスポートダイアログ内でのバリデーション**:

- テーブル表示時に、各手続きのバリデーション結果を表示
- 「⚠ 要確認」マークを表示し、ツールチップでエラー内容を表示
- エラーがある行は、デフォルトでチェックボックスを外す（または出力対象から除外）

**CSV出力時のバリデーション**:

- 選択された手続きに対して、再度バリデーションを実行
- エラーがある行は出力対象から除外し、警告メッセージを表示
- すべての行にエラーがある場合は、出力ボタンを`disabled`にする

### 2. エラー時のUX

**エクスポートダイアログ内**:

- エラーがある行に「⚠ 要確認」マークを表示
- マークにマウスオーバーすると、ツールチップでエラー内容を表示
- エラーがある行は、デフォルトでチェックボックスを外す

**CSV出力後**:

- 出力完了時に、スナックバーで「○件の手続きをCSV出力しました。エラーがある○件は出力対象から除外されました。」と表示
- または、ダイアログ内に結果メッセージを表示

### 3. エラーメッセージの例

- 「従業員情報が見つかりません」
- 「被保険者番号が未設定です」
- 「被扶養者情報が見つかりません」
- 「標準報酬決定履歴が見つかりません」
- 「賞与情報が見つかりません」

---

## 🔒 セキュリティ・権限制御のメモ

### Firestoreセキュリティルール

**既存のルール**（Phase3-4で実装済み）:

- `admin` / `hr`は全手続きを閲覧・作成・更新・削除可能
- `employee`は自分の手続きのみ閲覧可能（作成・更新・削除は不可）

**Phase3-8での追加検討事項**:

- e-Gov関連フィールド（`egovStatus`、`egovLastExportedAt`、`egovLastExportedByUserId`、`egovNote`）の更新権限
- **方針**: 既存のルールで対応可能なため、追加のルール変更は不要
- **理由**: e-Gov関連フィールドの更新も「手続きの更新」として扱われ、既存のルール（`admin` / `hr`のみ更新可能）が適用される

**将来の拡張で検討**:

- e-Govステータスの変更履歴を記録する場合、別コレクション（`egovStatusHistory`など）を作成し、そのコレクションに対するルールを追加

---

## 📌 実装ステップ（Codex 向け作業手順）

### Step 1: 型定義の追加

1. `src/app/types.ts`を開く
2. `EgovStatus`型を追加
3. `SocialInsuranceProcedure`インターフェースにe-Gov関連フィールドを追加

### Step 2: e-Govエクスポートサービスの作成

1. `src/app/utils/egov-export.service.ts`を新規作成
2. `EgovExportService`クラスを実装
3. `buildCsvForProcedures()`メソッドを実装
4. 手続き種別ごとのCSV生成メソッドを実装（`buildQualificationAcquisitionCsv()`など）
5. `validateProcedure()`メソッドを実装
6. `downloadCsv()`メソッドを実装（既存の`CsvExportService`のパターンを参考）

### Step 3: e-Govエクスポートダイアログの作成

1. `src/app/pages/procedures/egov-export-dialog.component.ts`を新規作成
2. `EgovExportDialogComponent`クラスを実装
3. フィルタ条件のフォームを実装（手続き種別、期間、e-Govステータス）
4. 出力候補一覧テーブルを実装
5. バリデーション結果の表示を実装（「⚠ 要確認」マーク）
6. CSV出力ボタンの実装
7. 出力後のステータス更新処理を実装

### Step 4: 手続き一覧ページの改修

1. `src/app/pages/procedures/procedures.page.ts`を開く
2. `displayedColumns`に`'egovStatus'`を追加
3. 「e-Gov」列のテンプレートを追加
4. `getEgovStatusLabel()`メソッドを追加
5. 「e-Gov用データ出力」ボタンを追加
6. `openEgovExportDialog()`メソッドを実装

### Step 5: サービスの拡張（必要に応じて）

1. `src/app/services/procedures.service.ts`を確認
2. e-Govステータス更新用のメソッドが必要な場合は追加（既存の`update()`メソッドで対応可能な場合は追加不要）

### Step 6: スタイルの追加

1. `procedures.page.ts`の`styles`配列に、e-Govステータスチップのスタイルを追加
2. `egov-export-dialog.component.ts`の`styles`配列に、ダイアログ内のテーブルやボタンのスタイルを追加

### Step 7: テスト・動作確認

1. 手続き一覧に「e-Gov」列が表示されることを確認
2. 「e-Gov用データ出力」ボタンをクリックしてダイアログが開くことを確認
3. フィルタ条件で手続きが絞り込まれることを確認
4. CSV出力が正常に動作することを確認
5. 出力後のステータス更新が正常に動作することを確認
6. バリデーションエラーが正しく表示されることを確認

---

## 🔍 テスト観点・受け入れ条件

### 基本動作の確認

1. ✅ **手続き一覧に「e-Gov」列が表示される**
   - 既存の手続きレコードにe-Govステータスが表示される（デフォルト: `not_exported`）
   - ステータスチップが正しく表示される

2. ✅ **「e-Gov用データ出力」ボタンが表示される**
   - ボタンをクリックすると`EgovExportDialogComponent`が開く

3. ✅ **e-Govエクスポートダイアログが正常に動作する**
   - フィルタ条件で手続きが絞り込まれる
   - 出力候補一覧テーブルに手続きが表示される
   - バリデーションエラーが正しく表示される（「⚠ 要確認」マーク）

4. ✅ **CSV出力が正常に動作する**
   - 選択した手続きがCSV形式でダウンロードされる
   - CSVファイルの文字化けがない（UTF-8 + BOM）
   - 手続き種別ごとに適切なCSV形式で出力される

5. ✅ **出力後のステータス更新が正常に動作する**
   - 出力された手続きの`egovStatus`が`'exported'`に更新される
   - `egovLastExportedAt`と`egovLastExportedByUserId`が更新される
   - 一覧テーブルの「e-Gov」列に即時反映される

### エラー処理の確認

6. ✅ **バリデーションエラーが正しく表示される**
   - 必要項目に欠けがある手続きに「⚠ 要確認」マークが表示される
   - エラーがある行は出力対象から除外される
   - エラーメッセージが正しく表示される

7. ✅ **エラーがある場合のUXが適切**
   - エラーがある行はデフォルトでチェックボックスが外れる
   - CSV出力ボタン横に警告メッセージが表示される
   - すべての行にエラーがある場合は出力ボタンが`disabled`になる

### 既存機能への影響確認

8. ✅ **既存の手続き一覧機能が壊れていない**
   - 既存のフィルタ（ステータス、期限、手続き種別）が正常に動作する
   - 既存の手続き登録・編集・削除機能が正常に動作する
   - 既存のテーブル表示が正常に動作する

9. ✅ **既存データへの影響がない**
   - 既存の手続きレコードにe-Gov関連フィールドが未設定でも正常に動作する
   - 既存の手続きレコードがエラーにならない

### セキュリティの確認

10. ✅ **権限制御が正常に動作する**
    - `admin` / `hr`のみがe-Gov関連機能にアクセスできる
    - `employee`はe-Gov関連機能にアクセスできない（既存のルールで対応）

### パフォーマンスの確認

11. ✅ **大量データでの動作確認**
    - 100件以上の手続きがある場合でも、フィルタやCSV出力が正常に動作する
    - テーブルの表示が遅延しない

---

## 📝 補足・注意事項

### 実装時の注意点

1. **既存コードとの整合性**: 既存の`CsvExportService`のパターン（`escapeCsvValue()`、`createCsvBlob()`など）を参考にし、コードスタイルを統一する

2. **型安全性**: TypeScriptの型を適切に使用し、`any`型の使用を避ける

3. **エラーハンドリング**: データ取得やCSV生成時のエラーを適切にハンドリングし、ユーザーに分かりやすいエラーメッセージを表示する

4. **パフォーマンス**: 大量の手続きがある場合でも、フィルタやCSV生成が遅延しないように実装する（必要に応じて`take()`や`limit()`を使用）

5. **将来拡張への配慮**: MVPでは実装しない機能（行メニューからの個別出力など）についても、将来拡張しやすい設計にする

### 実装範囲の明確化

**MVPで実装する機能**:

- ✅ e-Govステータスの追加と表示
- ✅ e-Govエクスポートダイアログの基本機能
- ✅ CSV出力機能（手続き種別ごとの簡略形式）
- ✅ バリデーション機能（必要項目のチェック）
- ✅ 出力後のステータス更新

**将来拡張として検討する機能**:

- ⏳ 行メニューからの個別出力
- ⏳ e-Govステータスの手動変更機能（ダイアログから）
- ⏳ e-Gov形式の完全再現
- ⏳ e-Govステータス変更履歴の記録
- ⏳ 画面上部へのe-Govステータス専用フィルタ追加

---

以上でPhase3-8の実装指示書は完了です。実装時は、既存のコードパターンに合わせて、段階的に実装を進めてください。

