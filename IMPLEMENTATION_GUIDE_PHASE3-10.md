# Phase3-10 実装指示書: 書類管理機能（ドキュメントセンター＆添付ファイル管理）

**作成日**: 2025年12月4日  
**対象フェーズ**: Phase3-10  
**優先度**: 🟡 中（実務上重要な機能）  
**依存関係**: Phase2-1（セキュリティ強化）、Phase3-3（申請フロー）  
**目標完了日**: 2025年12月4日

---

## 📋 概要

Phase3-10では、**厚生年金・健康保険・介護保険に関する社会保険手続きで使う添付書類を管理する機能**を実装します。

カタログの(25)「社会保険手続き用添付書類管理機能」を、**「手続きレコードに紐づける」方式ではなく、「従業員ごとの書類ボックス（ドキュメントセンター）として整理する」方式**で実装します。

### 主な機能

1. **ドキュメントセンター**（`/documents`）: 管理者・人事担当者向けの書類管理ページ
   - 従業員ごとの添付書類一覧表示
   - 書類アップロード依頼の作成・管理
   - 管理者による直接アップロード

2. **マイページ拡張**（`/me`）: 従業員本人向けの書類アップロード機能
   - 自分宛ての書類アップロード依頼一覧
   - ファイルアップロード機能
   - 自分の提出書類一覧（簡易ビュー）

### 重要な位置づけ

- **手続きレコードとの紐づけは今回スコープ外**: カタログ(25)の「手続きレコードに紐づけて」という記述は、今回の実装では「従業員ごとの書類ボックス」として再解釈します
- **従業員中心の管理**: 従業員ごとに書類を整理し、将来的に手続きレコードと紐づける余地を残します
- **セキュリティ重視**: 個人情報を含む書類を扱うため、適切なアクセス制御を実装します

---

## 🎯 目的・このフェーズで達成したいこと

### 主な目的

1. **書類管理の効率化**: 社会保険手続きに必要な添付書類を従業員ごとに整理し、提出漏れを防止する
2. **従業員セルフサービス**: 従業員本人がマイページから書類をアップロードできるようにする
3. **管理者の負担軽減**: 管理者が従業員に書類提出を依頼し、提出状況を一覧で確認できる
4. **有効期限管理**: 書類の有効期限を管理し、期限切れ・期限が近い書類を把握できる

### このフェーズで達成する具体的な成果

- `/documents`画面から、従業員ごとの書類を一覧表示・管理できる
- 管理者・人事担当者が従業員に対して「書類アップロードを依頼」できる
- 管理者・人事担当者が直接書類をアップロードできる
- 従業員が`/me`画面から自分宛ての依頼を確認し、ファイルをアップロードできる
- アップロードされた書類はFirebase Storageに保存され、Firestoreにメタ情報が記録される
- 書類の有効期限が近い・期限切れのものをフィルタリングできる
- 適切なアクセス制御により、従業員は自分の書類のみ閲覧・操作できる

---

## 📎 対象範囲・非対象（スコープ / アウトオブスコープ）

### 対象範囲（Phase3-10で実装する内容）

#### 1. ドキュメントセンター（`/documents`）画面

- 従業員一覧（左カラム）
- 選択中従業員の書類一覧（右カラム）
- 書類アップロード依頼の作成・管理
- 管理者による直接アップロード
- 書類のカテゴリ別フィルタ・並べ替え
- 有効期限が近い書類のフィルタリング

#### 2. マイページ（`/me`）の拡張

- 自分宛ての書類アップロード依頼一覧表示
- ファイルアップロード機能
- 自分の提出書類一覧（簡易ビュー）

#### 3. データモデル

- `DocumentAttachment`型の定義とFirestoreコレクション
- `DocumentRequest`型の定義とFirestoreコレクション
- `DocumentCategory`型の定義とラベル変換

#### 4. Firebase Storage連携

- Storageへのファイルアップロード・ダウンロード
- Storageセキュリティルールの実装

#### 5. セキュリティルール

- Firestoreルール（`documents`、`documentRequests`コレクション）
- Storageルール（ファイルアクセス制御）

### 非対象範囲（Phase3-10では実装しない内容）

- **手続きレコードとの紐づけ**: `SocialInsuranceProcedure`レコードと書類の直接的な紐づけは今回スコープ外
- **書類のバージョン管理**: 同じ書類の複数バージョン管理は将来拡張として検討
- **書類の承認フロー**: アップロードされた書類の承認・却下フローは今回スコープ外
- **書類の自動分類**: AIによる書類種別の自動判定は今回スコープ外
- **書類のOCR処理**: 書類内容の自動読み取りは今回スコープ外

---

## 🔍 現状整理（InsurePath側の前提）

### ルーティング構成

- **既存ルート**: `/employees`（従業員台帳、admin/hr専用）、`/me`（マイページ、全ロール）
- **新規追加**: `/documents`（ドキュメントセンター、admin/hr専用）
- **ガード**: `authGuard`、`officeGuard`、`roleGuard(['admin', 'hr'])`を使用

### ロール・権限管理

- **ロール**: `admin`（管理者）、`hr`（人事担当者）、`employee`（一般従業員）
- **ガード実装**: `roleGuard`でロール別アクセス制御が実装済み
- **Firestoreルール**: `isAdminOrHr(officeId)`、`isInsureEmployee(officeId)`、`isOwnEmployee(officeId, employeeId)`などのユーティリティ関数が実装済み

### 従業員データモデル

- **コレクションパス**: `offices/{officeId}/employees/{employeeId}`
- **型定義**: `Employee`型が`types.ts`に定義済み
- **主要フィールド**: `id`、`officeId`、`name`、`kana`、`department`、`employeeId`など

### マイページ（`/me`）の現状

- **実装済み**: 基本情報表示、保険料明細、申請履歴セクション
- **拡張予定**: 書類アップロード依頼セクション、自分の提出書類セクション

### Firestoreルールの現状

- **マルチテナント構成**: `offices/{officeId}/...`をルートとしたデータ分離
- **ユーティリティ関数**: `belongsToOffice(officeId)`、`isAdminOrHr(officeId)`、`isOwnEmployee(officeId, employeeId)`などが実装済み
- **パターン**: 既存コレクション（`employees`、`changeRequests`など）のルールを参考に実装

### Firebase Storageの現状

- **未実装**: Storage関連のサービス・コンポーネントは未実装
- **新規実装**: `StorageService`と`DocumentsService`を新規作成
- **Angular Fire**: `@angular/fire`パッケージはインストール済み（`^20.0.1`）
- **Storage API**: `@angular/fire/storage`から`Storage`、`ref`、`uploadBytes`、`getDownloadURL`、`getBlob`、`deleteObject`をインポートして使用
- **app.config.ts**: `provideStorage`の設定が必要（`src/app/app.config.ts`に追加）

---

## 👥 ユースケース / ユーザーストーリー

### ユースケース1: 管理者が従業員に書類提出を依頼する

**アクター**: 管理者（admin）または人事担当者（hr）

**前提条件**: 
- ログイン済み
- 所属事業所が設定済み
- `/documents`画面にアクセス可能

**主フロー**:
1. `/documents`画面を開く
2. 左カラムから従業員を選択
3. 「📨 書類アップロードを依頼」ボタンをクリック
4. ダイアログで以下を入力：
   - 対象従業員（デフォルトは選択中従業員）
   - 書類カテゴリ（例：`identity`）
   - タイトル（例：「運転免許証の両面コピー」）
   - メッセージ（任意、注意事項など）
   - 締め切り日（任意）
5. 「依頼を作成」ボタンをクリック
6. `DocumentRequest`ドキュメントが作成される
7. 従業員の`/me`画面に依頼が表示される

**代替フロー**:
- 締め切り日を入力しない場合、締め切りなしとして扱う

### ユースケース2: 従業員が書類をアップロードする

**アクター**: 一般従業員（employee）

**前提条件**:
- ログイン済み
- 所属事業所が設定済み
- `employeeId`が設定済み
- 自分宛ての`DocumentRequest`が存在する

**主フロー**:
1. `/me`画面を開く
2. 「書類アップロード依頼」セクションを確認
3. `status === 'pending'`の依頼を確認
4. 「ファイルをアップロード」ボタンをクリック
5. ファイル選択ダイアログでPDFまたは画像ファイルを選択
6. タイトル・メモを確認・修正（任意）
7. 「アップロード」ボタンをクリック
8. Firebase Storageにファイルがアップロードされる
9. `DocumentAttachment`ドキュメントが作成される（`source = 'employeeUploadViaRequest'`、`requestId`に紐づけ）
10. 対応する`DocumentRequest.status`が`'uploaded'`に更新される
11. `DocumentRequest.resolvedAt`に現在時刻が設定される

**代替フロー**:
- ファイル選択をキャンセルした場合、何も変更されない
- アップロードに失敗した場合、エラーメッセージを表示

### ユースケース3: 管理者が直接書類をアップロードする

**アクター**: 管理者（admin）または人事担当者（hr）

**前提条件**:
- ログイン済み
- 所属事業所が設定済み
- `/documents`画面にアクセス可能

**主フロー**:
1. `/documents`画面を開く
2. 左カラムから従業員を選択
3. 「📤 管理者として書類をアップロード」ボタンをクリック
4. ダイアログで以下を入力：
   - 対象従業員（デフォルトは選択中従業員）
   - 書類カテゴリ（例：`incomeProof`）
   - タイトル（例：「源泉徴収票（2024年度）」）
   - メモ（任意）
   - 有効期限（任意）
   - ファイル（PDFまたは画像）
5. 「アップロード」ボタンをクリック
6. Firebase Storageにファイルがアップロードされる
7. `DocumentAttachment`ドキュメントが作成される（`source = 'adminUpload'`、`requestId = null`）

**代替フロー**:
- 有効期限を入力しない場合、有効期限なしとして扱う

### ユースケース4: 管理者が有効期限が近い書類を確認する

**アクター**: 管理者（admin）または人事担当者（hr）

**前提条件**:
- ログイン済み
- 所属事業所が設定済み
- `/documents`画面にアクセス可能

**主フロー**:
1. `/documents`画面を開く
2. 「有効期限が近い書類」フィルタを選択
3. 30日以内に期限切れになる書類の一覧が表示される
4. 各書類について、従業員名・書類タイトル・有効期限・残り日数を確認
5. 必要に応じて、従業員に再提出を依頼する

---

## 🖥️ 画面仕様

### 3-1. ドキュメントセンター（`/documents`）画面

#### 3-1-1. 基本レイアウト

**左カラム: 従業員一覧**

- **表示項目**:
  - 氏名（`employee.name`）
  - カナ（`employee.kana`、あれば）
  - 所属部署（`employee.department`、あれば）
- **機能**:
  - テキスト検索（氏名・カナで絞り込み）
  - クリックで選択（選択中の従業員はハイライト表示）
- **スタイル**: 既存の`/employees`ページと同様のテーブル形式またはリスト形式

**右カラム: 選択中従業員の情報**

- **上部**: 選択中従業員の基本情報（氏名、所属部署など）
- **アクションボタン**:
  - 「📨 書類アップロードを依頼」ボタン
  - 「📤 管理者として書類をアップロード」ボタン
- **タブまたはセクション**:
  - **タブ1: 添付書類一覧**
    - カテゴリ別フィルタ（プルダウン）
    - 並べ替え（アップロード日降順、タイトル昇順など）
    - 有効期限フィルタ（「すべて」「期限切れ」「30日以内に期限切れ」「有効期限内」）
    - 書類一覧テーブル:
      - 書類種別（カテゴリのラベル）
      - タイトル
      - アップロード日
      - アップロード者
      - 有効期限（あれば）
      - 残り日数（有効期限がある場合）
      - 操作（ダウンロード、プレビュー、削除）
  - **タブ2: 書類アップロード依頼一覧**
    - ステータスフィルタ（「すべて」「pending」「uploaded」「cancelled」）
    - 依頼一覧テーブル:
      - カテゴリ
      - タイトル
      - 依頼日
      - 依頼者
      - 締め切り日（あれば）
      - ステータス
      - 解決日（`uploaded`の場合）
      - 操作（キャンセル、詳細表示）

#### 3-1-2. アクション

**「📨 書類アップロードを依頼」ボタン**

- **ダイアログ**: `DocumentRequestFormDialogComponent`（新規作成）
- **入力項目**:
  - 対象従業員（選択、デフォルトは右カラムで選択中）
  - 書類カテゴリ（`DocumentCategory`のプルダウン、必須）
  - タイトル（テキスト入力、必須）
  - メッセージ（テキストエリア、任意）
  - 締め切り日（日付ピッカー、任意）
- **バリデーション**:
  - 対象従業員: 必須
  - 書類カテゴリ: 必須
  - タイトル: 必須、最大200文字
  - メッセージ: 最大1000文字
- **処理**:
  - `DocumentsService.createRequest()`を呼び出し
  - `DocumentRequest`ドキュメントを作成
  - 成功時、SnackBarで通知

**「📤 管理者として書類をアップロード」ボタン**

- **ダイアログ**: `DocumentUploadFormDialogComponent`（新規作成）
- **入力項目**:
  - 対象従業員（選択、デフォルトは右カラムで選択中）
  - 書類カテゴリ（`DocumentCategory`のプルダウン、必須）
  - タイトル（テキスト入力、必須）
  - メモ（テキストエリア、任意）
  - 有効期限（日付ピッカー、任意）
  - ファイル（ファイル選択、必須、PDFまたは画像）
- **バリデーション**:
  - 対象従業員: 必須
  - 書類カテゴリ: 必須
  - タイトル: 必須、最大200文字
  - ファイル: 必須、最大10MB、PDF/PNG/JPG/JPEGのみ
- **処理**:
  - Firebase Storageにファイルをアップロード
  - `DocumentsService.createAttachment()`を呼び出し
  - `DocumentAttachment`ドキュメントを作成（`source = 'adminUpload'`）
  - 成功時、SnackBarで通知

**書類一覧行でのアクション**

- **ダウンロード**: Storageからファイルをダウンロード
- **プレビュー**: ブラウザ内でプレビュー（PDFは`<iframe>`、画像は`<img>`）
- **削除**: 確認ダイアログ後、StorageとFirestoreの両方から削除（admin/hrのみ）

#### 3-1-3. 「有効期限が近い書類」の把握

- **フィルタオプション**:
  - 「すべて」
  - 「期限切れ」（`expiresAt < 現在日時`）
  - 「30日以内に期限切れ」（`現在日時 <= expiresAt <= 現在日時 + 30日`）
  - 「有効期限内」（`expiresAt > 現在日時 + 30日`）
- **表示**: 有効期限が近い書類は警告アイコン（⚠️）を表示
- **集計**: ダッシュボードへの集計表示は将来拡張として検討

### 3-2. `/me`側でのUI

#### 3-2-1. 書類アップロード依頼セクション

**配置**: `/me`画面の「申請・手続き」セクションの下に追加

**表示内容**:
- **セクションタイトル**: 「📨 書類アップロード依頼」
- **説明文**: 「管理者から依頼された書類をアップロードしてください。」
- **依頼一覧**: `status === 'pending'`の`DocumentRequest`をカード形式で表示
  - カテゴリ（バッジ表示）
  - タイトル
  - メッセージ（あれば）
  - 締め切り日（あれば、残り日数も表示）
  - 「ファイルをアップロード」ボタン

**「ファイルをアップロード」ボタン**

- **ダイアログ**: `DocumentUploadDialogComponent`（新規作成、依頼用）
- **表示内容**:
  - 依頼情報（読み取り専用）: カテゴリ、タイトル、メッセージ、締め切り日
  - ファイル選択（必須）
  - タイトル（デフォルトは依頼のタイトル、編集可能）
  - メモ（任意）
- **処理**:
  - Firebase Storageにファイルをアップロード
  - `DocumentsService.createAttachment()`を呼び出し（`source = 'employeeUploadViaRequest'`、`requestId`に紐づけ）
  - `DocumentsService.updateRequestStatus()`を呼び出し（`status = 'uploaded'`、`resolvedAt`を設定）
  - 成功時、SnackBarで通知

#### 3-2-2. 自分の提出書類セクション（任意）

**配置**: `/me`画面の「書類アップロード依頼」セクションの下に追加

**表示内容**:
- **セクションタイトル**: 「📄 自分の提出書類」
- **説明文**: 「あなたが提出した書類の一覧です。」
- **書類一覧**: `employeeId`が自分の`DocumentAttachment`を簡易テーブルで表示
  - 書類種別
  - タイトル
  - アップロード日
  - 有効期限（あれば）
  - 操作（ダウンロード、プレビュー）

**注意**: このセクションは「必須」ではなく「任意」として実装。時間に余裕があれば実装する。

---

## 📊 データモデル仕様

### 4-1. DocumentAttachment（添付書類本体）

**Firestoreコレクションパス**: `offices/{officeId}/documents/{documentId}`

**型定義**:

```typescript
export type DocumentCategory =
  | 'identity'           // 本人確認書類（運転免許証、マイナンバーカード、在留カード 等）
  | 'residence'          // 住所・居住関係（住民票 等）
  | 'incomeProof'        // 収入証明（源泉徴収票、給与明細、課税証明書 等）
  | 'studentProof'       // 在学証明
  | 'relationshipProof'  // 続柄・同居証明（戸籍謄本、住民票（世帯全員） 等）
  | 'otherInsurance'     // 他健康保険・年金加入証明
  | 'medical'            // 障害・傷病関連証明（診断書 等）
  | 'caregiving'         // 介護関連証明（要介護・要支援認定 等）
  | 'procedureOther'     // その他社会保険手続き用資料
  | 'other';             // 上記いずれにも当てはまらないもの

export type DocumentSource = 'adminUpload' | 'employeeUploadViaRequest';

export interface DocumentAttachment {
  id: string;
  officeId: string;
  
  // この書類が紐づく従業員
  employeeId: string;          // 必須。誰の書類かを一意に特定する
  
  // 将来的に「扶養家族ごとの書類」も扱いたいので余地を残しておく
  dependentId?: string | null; // Phase3-10ではあってもなくてもよいが、型としては考慮したい
  
  // 書類種別
  category: DocumentCategory;
  
  // 一覧でわかりやすくするための自由タイトル（例：「源泉徴収票（2024年度）」）
  title: string;
  
  // 管理者・従業員が自由に書けるメモ
  note?: string | null;
  
  // Storage 上のパス（例：offices/{officeId}/employees/{employeeId}/documents/{documentId}/{filename}）
  storagePath: string;
  
  // ファイル名（元のファイル名を保持）
  fileName: string;
  
  // ファイルサイズ（バイト）
  fileSize: number;
  
  // MIMEタイプ（例：application/pdf、image/png）
  mimeType: string;
  
  // 誰がいつアップロードしたか
  uploadedAt: IsoDateString;  // Storage にファイルを上げたタイミング（≒ほぼ createdAt と同じでもOK）
  uploadedByUserId: string;
  uploadedByDisplayName: string;
  
  // この書類が、リクエスト経由でアップされたものかどうか
  source: DocumentSource;
  requestId?: string | null;  // source === 'employeeUploadViaRequest' の場合のみ設定
  
  // 有効期限の管理（任意）
  expiresAt?: IsoDateString | null;
  isExpired?: boolean;  // 将来の集計用にフラグを用意しておいてもよい
  
  createdAt: IsoDateString;  // Firestore ドキュメントの作成時刻（uploadedAt と基本的に同じタイミングでセット）
  updatedAt: IsoDateString;  // メモや有効期限変更時に更新
}
```

**Firestoreパス設計**:
- コレクション: `offices/{officeId}/documents/{documentId}`
- インデックス: `employeeId`、`category`、`expiresAt`でクエリ可能にする

**時刻系フィールドの運用**:
- `uploadedAt`と`createdAt`は基本的に同じタイミングでセット（初回作成時）
- メモ・有効期限などの更新時は`updatedAt`のみ更新

### 4-2. DocumentRequest（書類アップロード依頼）

**Firestoreコレクションパス**: `offices/{officeId}/documentRequests/{requestId}`

**型定義**:

```typescript
export type DocumentRequestStatus = 'pending' | 'uploaded' | 'cancelled';

export interface DocumentRequest {
  id: string;
  officeId: string;
  
  // 依頼先の従業員
  employeeId: string;
  
  // 要求する書類種別
  category: DocumentCategory;
  
  // タイトル（例：「運転免許証の両面コピー」）
  title: string;
  
  // 注意事項や補足の長文メッセージ
  message?: string | null;
  
  // 誰がいつ依頼したか
  requestedByUserId: string;
  requestedByDisplayName: string;
  
  // 依頼ステータス
  status: DocumentRequestStatus;
  
  // 依頼作成タイミング
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  
  // アップロード完了やキャンセル時にセットされる
  resolvedAt?: IsoDateString | null;  // status === 'uploaded' の場合に設定
  
  // 期限（任意）
  dueDate?: IsoDateString | null;
}
```

**Firestoreパス設計**:
- コレクション: `offices/{officeId}/documentRequests/{requestId}`
- インデックス: `employeeId`、`status`、`dueDate`でクエリ可能にする

### 4-3. DocumentCategory（書類種別）のラベル変換

**ラベル変換関数**: `label-utils.ts`に追加

```typescript
export function getDocumentCategoryLabel(category: DocumentCategory): string {
  switch (category) {
    case 'identity':
      return '本人確認書類';
    case 'residence':
      return '住所・居住関係';
    case 'incomeProof':
      return '収入証明';
    case 'studentProof':
      return '在学証明';
    case 'relationshipProof':
      return '続柄・同居証明';
    case 'otherInsurance':
      return '他健康保険・年金加入証明';
    case 'medical':
      return '障害・傷病関連証明';
    case 'caregiving':
      return '介護関連証明';
    case 'procedureOther':
      return 'その他社会保険手続き用資料';
    case 'other':
      return 'その他';
    default:
      return category ?? '未設定';
  }
}
```

### 4-4. Firebase Storageパス設計

**Storageパス構造**:

```
offices/{officeId}/employees/{employeeId}/documents/{documentId}/{fileName}
```

**例**:
- `offices/office123/employees/emp456/documents/doc789/drivers_license.pdf`
- `offices/office123/employees/emp456/documents/doc790/residence_certificate.png`

**ファイル名の扱い**:
- 元のファイル名を`fileName`フィールドに保持
- Storageパスには`documentId`と元のファイル名を含める
- ファイル名に特殊文字が含まれる場合は、URLエンコードまたはサニタイズする

---

## 🔒 アクセス制御（Firestore ルール / Storage ルール）方針

### 5-1. Firestoreルール

#### 5-1-1. `documents`コレクション

**パス**: `offices/{officeId}/documents/{documentId}`

**ルール**:

```javascript
match /documents/{documentId} {
  // 共通バリデーション: DocumentAttachment の基本フィールド
  function isValidDocumentAttachmentBase(data) {
    return data.id == documentId
      && data.officeId == officeId
      && data.employeeId is string
      && data.category in ['identity', 'residence', 'incomeProof', 'studentProof', 'relationshipProof', 'otherInsurance', 'medical', 'caregiving', 'procedureOther', 'other']
      && data.title is string && data.title.size() > 0 && data.title.size() <= 200
      && data.storagePath is string
      && data.fileName is string
      && data.fileSize is int && data.fileSize > 0
      && data.mimeType is string
      && data.uploadedAt is string
      && data.uploadedByUserId is string
      && data.uploadedByDisplayName is string
      && data.source in ['adminUpload', 'employeeUploadViaRequest']
      && data.createdAt is string
      && data.updatedAt is string;
  }
  
  // 閲覧: admin/hr は全件、employee は自分の employeeId に紐づくもののみ
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    (isInsureEmployee(officeId) && resource.data.employeeId == currentUser().data.employeeId)
  );
  
  // 作成: admin/hr は全件、employee は自分の employeeId に紐づくもののみ（リクエスト経由）
  allow create: if belongsToOffice(officeId) && (
    (
      isAdminOrHr(officeId)
        && request.resource.data.keys().hasOnly([
          'id', 'officeId', 'employeeId', 'dependentId',
          'category', 'title', 'note', 'storagePath', 'fileName', 'fileSize', 'mimeType',
          'uploadedAt', 'uploadedByUserId', 'uploadedByDisplayName',
          'source', 'requestId',
          'expiresAt', 'isExpired',
          'createdAt', 'updatedAt'
        ])
        && isValidDocumentAttachmentBase(request.resource.data)
        && request.resource.data.uploadedByUserId == request.auth.uid
    )
    || (
      isInsureEmployee(officeId)
        && request.resource.data.employeeId == currentUser().data.employeeId
        && request.resource.data.source == 'employeeUploadViaRequest'
        && request.resource.data.requestId is string
        && request.resource.data.uploadedByUserId == request.auth.uid
        && isValidDocumentAttachmentBase(request.resource.data)
        // オプション: リクエストが存在することを保証したい場合は以下のチェックを追加
        // && exists(/databases/$(database)/documents/offices/$(officeId)/documentRequests/$(request.resource.data.requestId))
    )
  );
  
  // 更新: admin/hr のみ（メモ、有効期限の更新など）
  allow update: if belongsToOffice(officeId)
    && isAdminOrHr(officeId)
    && request.resource.data.diff(resource.data).changedKeys().hasOnly([
      'note', 'expiresAt', 'isExpired', 'updatedAt'
    ])
    && request.resource.data.id == resource.data.id
    && request.resource.data.officeId == resource.data.officeId
    && request.resource.data.employeeId == resource.data.employeeId;
  
  // 削除: admin/hr のみ
  allow delete: if belongsToOffice(officeId) && isAdminOrHr(officeId);
}
```

#### 5-1-2. `documentRequests`コレクション

**パス**: `offices/{officeId}/documentRequests/{requestId}`

**ルール**:

```javascript
match /documentRequests/{requestId} {
  // 共通バリデーション: DocumentRequest の基本フィールド
  function isValidDocumentRequestBase(data) {
    return data.id == requestId
      && data.officeId == officeId
      && data.employeeId is string
      && data.category in ['identity', 'residence', 'incomeProof', 'studentProof', 'relationshipProof', 'otherInsurance', 'medical', 'caregiving', 'procedureOther', 'other']
      && data.title is string && data.title.size() > 0 && data.title.size() <= 200
      && data.status in ['pending', 'uploaded', 'cancelled']
      && data.requestedByUserId is string
      && data.requestedByDisplayName is string
      && data.createdAt is string
      && data.updatedAt is string;
  }
  
  // 閲覧: admin/hr は全件、employee は自分の employeeId に紐づくもののみ
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    (isInsureEmployee(officeId) && resource.data.employeeId == currentUser().data.employeeId)
  );
  
  // 作成: admin/hr のみ
  allow create: if belongsToOffice(officeId)
    && isAdminOrHr(officeId)
    && request.resource.data.keys().hasOnly([
      'id', 'officeId', 'employeeId',
      'category', 'title', 'message',
      'requestedByUserId', 'requestedByDisplayName',
      'status', 'dueDate',
      'createdAt', 'updatedAt'
    ])
    && isValidDocumentRequestBase(request.resource.data)
    && request.resource.data.status == 'pending'
    && request.resource.data.requestedByUserId == request.auth.uid;
  
  // 更新: admin/hr は全件、employee は自分の employeeId に紐づく pending なもののみ（status を uploaded に更新）
  allow update: if belongsToOffice(officeId) && (
    (
      isAdminOrHr(officeId)
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'resolvedAt', 'updatedAt'
        ])
        && (
          (request.resource.data.status == 'cancelled' && resource.data.status == 'pending')
          || (request.resource.data.status == 'uploaded' && resource.data.status == 'pending' && request.resource.data.resolvedAt is string)
        )
    )
    || (
      isInsureEmployee(officeId)
        && resource.data.employeeId == currentUser().data.employeeId
        && resource.data.status == 'pending'
        && request.resource.data.status == 'uploaded'
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['status', 'resolvedAt', 'updatedAt'])
        && request.resource.data.resolvedAt is string
    )
  );
  
  // 削除: 不可（履歴として保持）
  allow delete: if false;
}
```

### 5-2. Storageルール

**Storageパス**: `offices/{officeId}/employees/{employeeId}/documents/{documentId}/{fileName}`

**ルール設計方針**:
- Storageルールでは`$(database)`プレースホルダは使えないため、`(default)`を直書きする
- Firestoreルールと同様に、`users/{uid}`からロール情報を参照する（InsurePathの実装では`users/{uid}`に`officeId`と`role`、`employeeId`が保持されている）
- パスセグメント（`officeId`、`employeeId`）を直接使用し、メタデータ依存を避けることで実装を簡素化する

**ルール**:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // InsurePath 用: offices 以下
    match /offices/{officeId}/employees/{employeeId}/documents/{documentId}/{fileName} {
      // ユーティリティ関数: ユーザーが指定事業所に所属しているかチェック
      function userInOffice() {
        return request.auth != null
          && exists(/databases/(default)/documents/users/$(request.auth.uid))
          && get(/databases/(default)/documents/users/$(request.auth.uid)).data.officeId == officeId;
      }
      
      // ユーティリティ関数: 管理者または人事担当者かチェック
      function isAdminOrHr() {
        return userInOffice()
          && get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in ['admin', 'hr'];
      }
      
      // ユーティリティ関数: 自分の従業員レコードに紐づいているかチェック
      function isOwnEmployee() {
        return userInOffice()
          && get(/databases/(default)/documents/users/$(request.auth.uid)).data.employeeId == employeeId;
      }
      
      // 閲覧: admin/hr は全件、employee は自分の employeeId に紐づくもののみ
      allow read: if request.auth != null && (isAdminOrHr() || isOwnEmployee());
      
      // 作成・更新: admin/hr は全件、employee は自分の employeeId に紐づくもののみ
      allow create, update: if request.auth != null
        && request.resource.size < 10 * 1024 * 1024  // 10MB制限
        && request.resource.contentType.matches('(application/pdf|image/.*)')
        && (isAdminOrHr() || isOwnEmployee());
      
      // 削除: admin/hr のみ
      allow delete: if request.auth != null && isAdminOrHr();
    }
  }
}
```

**注意**: 
- Storageルールでは`$(database)`プレースホルダは使えないため、`(default)`を直書きする必要があります
- パスセグメント（`officeId`、`employeeId`）を直接使用するため、メタデータに`officeId`や`employeeId`を設定する必要はありません（実装が簡素化されます）
- Firestoreルールと同様に、`users/{uid}`からロール情報を参照します（InsurePathの実装では`users/{uid}`に`officeId`、`role`、`employeeId`が保持されています）

---

## 📝 実装タスクリスト

### 6-1. Firebase Storage設定の追加（`src/app/app.config.ts`）

- [ ] `provideStorage`のインポートと設定を追加
  ```typescript
  import { provideStorage, getStorage } from '@angular/fire/storage';
  
  // providers配列に追加
  provideStorage(() => getStorage()),
  ```

### 6-2. 型定義の追加（`src/app/types.ts`）

- [ ] `DocumentCategory`型の追加
- [ ] `DocumentSource`型の追加
- [ ] `DocumentRequestStatus`型の追加
- [ ] `DocumentAttachment`インターフェースの追加
- [ ] `DocumentRequest`インターフェースの追加

### 6-3. ラベル変換関数の追加（`src/app/utils/label-utils.ts`）

- [ ] `getDocumentCategoryLabel()`関数の追加
- [ ] `getDocumentRequestStatusLabel()`関数の追加（必要に応じて）

### 6-4. サービスの実装

#### 6-3-1. `DocumentsService`（`src/app/services/documents.service.ts`、新規作成）

**実装パターン**: 既存の`ChangeRequestsService`と同様に、`@Injectable({ providedIn: 'root' })`を使用し、コンストラクタで`Firestore`を注入する。リアルタイム購読には`collectionData`を使用する。

**Angular Fire Firestoreのインポート**:
```typescript
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from '@angular/fire/firestore';
```

**実装メソッド**:
- [ ] `listAttachments(officeId: string, employeeId?: string, category?: DocumentCategory): Observable<DocumentAttachment[]>`メソッド
  - `collectionData`を使用してリアルタイム購読
  - `employeeId`が指定されている場合は`where('employeeId', '==', employeeId)`でフィルタ
  - `category`が指定されている場合は`where('category', '==', category)`でフィルタ
  - `orderBy('uploadedAt', 'desc')`で並べ替え
  - `map`で`id`フィールドを追加
- [ ] `getAttachment(officeId: string, documentId: string): Observable<DocumentAttachment | null>`メソッド
  - `getDoc`を使用して単一ドキュメントを取得
  - `from(getDoc(...)).pipe(map(...))`パターンを使用
- [ ] `createAttachment(officeId: string, attachment: Omit<DocumentAttachment, 'id' | 'createdAt' | 'updatedAt'>): Promise<void>`メソッド
  - `doc(collection(...))`で新しいドキュメント参照を作成
  - `id`、`createdAt`、`updatedAt`を自動設定
  - `uploadedAt`と`createdAt`は同じタイミング（現在時刻）でセット
  - `setDoc`で保存
  - `undefined`フィールドは`removeUndefinedDeep`（`ChangeRequestsService`と同様）で除去
- [ ] `updateAttachment(officeId: string, documentId: string, updates: Partial<DocumentAttachment>): Promise<void>`メソッド
  - `updateDoc`を使用して部分更新
  - `updatedAt`を自動更新
  - `undefined`フィールドは除去
- [ ] `deleteAttachment(officeId: string, documentId: string): Promise<void>`メソッド
  - まず`getAttachment`で`storagePath`を取得
  - `StorageService.deleteFile()`でStorageからファイルを削除
  - `deleteDoc`でFirestoreからドキュメントを削除
  - エラーハンドリング: Storage削除失敗時もFirestore削除は実行（または両方のエラーを適切に処理）
- [ ] `listRequests(officeId: string, employeeId?: string, status?: DocumentRequestStatus): Observable<DocumentRequest[]>`メソッド
  - `collectionData`を使用してリアルタイム購読
  - `employeeId`が指定されている場合は`where('employeeId', '==', employeeId)`でフィルタ
  - `status`が指定されている場合は`where('status', '==', status)`でフィルタ
  - `orderBy('createdAt', 'desc')`で並べ替え
- [ ] `getRequest(officeId: string, requestId: string): Observable<DocumentRequest | null>`メソッド
  - `getDoc`を使用して単一ドキュメントを取得
- [ ] `createRequest(officeId: string, request: Omit<DocumentRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<void>`メソッド
  - `doc(collection(...))`で新しいドキュメント参照を作成
  - `id`、`status = 'pending'`、`createdAt`、`updatedAt`を自動設定
  - `setDoc`で保存
- [ ] `updateRequestStatus(officeId: string, requestId: string, status: DocumentRequestStatus): Promise<void>`メソッド
  - `updateDoc`を使用して`status`と`updatedAt`を更新
  - `status === 'uploaded'`の場合は`resolvedAt`も設定

#### 6-3-2. `StorageService`（`src/app/services/storage.service.ts`、新規作成）

**実装パターン**: 既存の`EmployeesService`や`ChangeRequestsService`と同様に、`@Injectable({ providedIn: 'root' })`を使用し、コンストラクタで`Storage`を注入する。

**Angular Fire Storageのインポート**:
```typescript
import { Storage, ref, uploadBytes, getDownloadURL, getBlob, deleteObject } from '@angular/fire/storage';
```

**実装メソッド**:
- [ ] `uploadFile(officeId: string, employeeId: string, documentId: string, file: File): Promise<string>`メソッド
  - Storageパス: `offices/{officeId}/employees/{employeeId}/documents/{documentId}/{fileName}`
  - ファイル名のサニタイズ: 特殊文字（`/`、`\`、`:`など）を`_`に置換、またはURLエンコード
  - `uploadBytes()`を使用してアップロード
  - アップロード成功後、Storageパス（文字列）を返す
  - エラーハンドリング: アップロード失敗時は例外をスロー
- [ ] `downloadFile(storagePath: string): Promise<Blob>`メソッド
  - `getBlob()`を使用してファイルをダウンロード
  - エラーハンドリング: ファイルが存在しない場合は例外をスロー
- [ ] `getDownloadUrl(storagePath: string): Promise<string>`メソッド（一時URLを取得）
  - `getDownloadURL()`を使用して一時URLを取得
  - プレビュー表示に使用
  - エラーハンドリング: ファイルが存在しない場合は例外をスロー
- [ ] `deleteFile(storagePath: string): Promise<void>`メソッド
  - `deleteObject()`を使用してファイルを削除
  - エラーハンドリング: ファイルが存在しない場合は例外をスロー（または無視）

**実装例（参考）**:
```typescript
import { Injectable } from '@angular/core';
import { Storage, ref, uploadBytes, getDownloadURL, getBlob, deleteObject } from '@angular/fire/storage';

@Injectable({ providedIn: 'root' })
export class StorageService {
  constructor(private readonly storage: Storage) {}

  /**
   * ファイル名をサニタイズ（特殊文字を置換）
   */
  private sanitizeFileName(fileName: string): string {
    // 特殊文字を _ に置換（または URL エンコード）
    return fileName.replace(/[/\\:*?"<>|]/g, '_');
  }

  async uploadFile(
    officeId: string,
    employeeId: string,
    documentId: string,
    file: File
  ): Promise<string> {
    const sanitizedFileName = this.sanitizeFileName(file.name);
    const storagePath = `offices/${officeId}/employees/${employeeId}/documents/${documentId}/${sanitizedFileName}`;
    const storageRef = ref(this.storage, storagePath);
    
    await uploadBytes(storageRef, file);
    return storagePath;
  }

  async downloadFile(storagePath: string): Promise<Blob> {
    const storageRef = ref(this.storage, storagePath);
    return await getBlob(storageRef);
  }

  async getDownloadUrl(storagePath: string): Promise<string> {
    const storageRef = ref(this.storage, storagePath);
    return await getDownloadURL(storageRef);
  }

  async deleteFile(storagePath: string): Promise<void> {
    const storageRef = ref(this.storage, storagePath);
    await deleteObject(storageRef);
  }
}
```

### 6-5. コンポーネントの実装

#### 6-5-1. ドキュメントセンター画面（`src/app/pages/documents/documents.page.ts`、新規作成）

**レイアウト**: 2カラムレイアウト（左: 従業員一覧、右: 選択中従業員の詳細）

**必要なAngular Materialモジュール**:
- `MatTableModule`（既存パターンに合わせる）
- `MatTabsModule`（タブ表示用、`masters.page.ts`と同様のパターン）
- `MatCardModule`、`MatButtonModule`、`MatIconModule`、`MatDialogModule`、`MatSnackBarModule`
- `MatFormFieldModule`、`MatInputModule`、`MatSelectModule`（フィルタ用）

**実装項目**:
- [ ] 左カラム: 従業員一覧（検索機能付き）
  - `EmployeesService.list()`を使用して従業員一覧を取得
  - テキスト検索（氏名・カナ）でフィルタリング
  - クリックで選択（選択中の従業員IDを保持）
- [ ] 右カラム: 選択中従業員の情報
  - 選択中従業員の基本情報表示（氏名、所属部署など）
  - `MatTabsModule`を使用してタブ表示（`masters.page.ts`と同様のパターン）
    - **タブ1: 添付書類一覧**
      - `DocumentsService.listAttachments()`を使用
      - カテゴリ別フィルタ（`MatSelectModule`）
      - 有効期限フィルタ（`MatSelectModule`）
      - 並べ替え（アップロード日降順など）
      - 書類一覧テーブル（`MatTableModule`）
      - 各行にダウンロード・プレビュー・削除ボタン
    - **タブ2: 書類アップロード依頼一覧**
      - `DocumentsService.listRequests()`を使用
      - ステータスフィルタ（`MatSelectModule`）
      - 依頼一覧テーブル（`MatTableModule`）
- [ ] 「📨 書類アップロードを依頼」ボタン
  - `DocumentRequestFormDialogComponent`を開く
- [ ] 「📤 管理者として書類をアップロード」ボタン
  - `DocumentUploadFormDialogComponent`を開く
- [ ] 書類のダウンロード・プレビュー・削除機能
  - ダウンロード: `StorageService.downloadFile()`を使用
  - プレビュー: `StorageService.getDownloadUrl()`を使用して`<iframe>`または`<img>`で表示
  - 削除: 確認ダイアログ後、`DocumentsService.deleteAttachment()`を呼び出し

#### 6-4-2. 書類アップロード依頼フォーム（`src/app/pages/documents/document-request-form-dialog.component.ts`、新規作成）

- [ ] 対象従業員選択
- [ ] 書類カテゴリ選択
- [ ] タイトル入力
- [ ] メッセージ入力（任意）
- [ ] 締め切り日入力（任意）
- [ ] バリデーション
- [ ] 送信処理

#### 6-4-3. 書類アップロードフォーム（管理者用）（`src/app/pages/documents/document-upload-form-dialog.component.ts`、新規作成）

- [ ] 対象従業員選択
- [ ] 書類カテゴリ選択
- [ ] タイトル入力
- [ ] メモ入力（任意）
- [ ] 有効期限入力（任意）
- [ ] ファイル選択
- [ ] バリデーション
- [ ] アップロード処理

#### 6-4-4. 書類アップロードダイアログ（従業員用、依頼対応）（`src/app/pages/documents/document-upload-dialog.component.ts`、新規作成）

- [ ] 依頼情報の表示（読み取り専用）
- [ ] ファイル選択
- [ ] タイトル確認・編集
- [ ] メモ入力（任意）
- [ ] バリデーション
- [ ] アップロード処理（`DocumentAttachment`作成 + `DocumentRequest.status`更新）

### 6-6. マイページの拡張（`src/app/pages/me/my-page.ts`）

- [ ] 「書類アップロード依頼」セクションの追加
  - [ ] `status === 'pending'`の`DocumentRequest`一覧表示
  - [ ] 各依頼に「ファイルをアップロード」ボタン
- [ ] 「自分の提出書類」セクションの追加（任意）
  - [ ] 自分の`DocumentAttachment`一覧表示
  - [ ] ダウンロード・プレビュー機能

### 6-7. ルーティングの追加（`src/app/app.routes.ts`）

- [ ] `/documents`ルートの追加（`roleGuard(['admin', 'hr'])`適用）

### 6-8. サイドメニューの追加（`src/app/app.ts`）

- [ ] 「書類管理」メニュー項目の追加（admin/hr専用）

### 6-9. Firestoreルールの追加（`firestore.rules`）

- [ ] `documents`コレクションのルール追加
- [ ] `documentRequests`コレクションのルール追加

### 6-10. Storageルールの追加（`storage.rules`、新規作成または既存ファイルに追加）

**注意**: `storage.rules`ファイルが存在しない場合は新規作成する。既存の場合は既存ルールに追加する。

- [ ] `offices/{officeId}/employees/{employeeId}/documents/{documentId}/{fileName}`のルール追加
  - 実装指示書の「5-2. Storageルール」セクションに記載されたルールをそのまま実装
  - `$(database)`は`(default)`に置き換える
  - パスセグメント（`officeId`、`employeeId`）を直接使用する

### 6-11. Firestoreインデックスの設定

- [ ] `documents`コレクション: `employeeId`、`category`、`expiresAt`の複合インデックス
- [ ] `documentRequests`コレクション: `employeeId`、`status`、`dueDate`の複合インデックス

---

## ✅ テスト観点

### 7-1. 機能テスト

#### 7-1-1. ドキュメントセンター画面

- [ ] 従業員一覧が正しく表示される
- [ ] 従業員検索が正しく動作する
- [ ] 従業員を選択すると、その従業員の書類一覧が表示される
- [ ] カテゴリ別フィルタが正しく動作する
- [ ] 有効期限フィルタが正しく動作する
- [ ] 書類の並べ替えが正しく動作する
- [ ] 「📨 書類アップロードを依頼」ボタンで依頼を作成できる
- [ ] 「📤 管理者として書類をアップロード」ボタンで書類をアップロードできる
- [ ] 書類のダウンロードが正しく動作する
- [ ] 書類のプレビューが正しく動作する（PDF・画像）
- [ ] 書類の削除が正しく動作する（確認ダイアログ表示）

#### 7-1-2. マイページ拡張

- [ ] 自分宛ての`status === 'pending'`の依頼が正しく表示される
- [ ] 「ファイルをアップロード」ボタンでファイルをアップロードできる
- [ ] アップロード後、対応する`DocumentRequest.status`が`'uploaded'`に更新される
- [ ] 自分の提出書類一覧が正しく表示される（実装した場合）
- [ ] 自分の提出書類のダウンロード・プレビューが正しく動作する（実装した場合）

#### 7-1-3. データ整合性

- [ ] `DocumentAttachment`作成時、Storageにファイルが正しく保存される
- [ ] `DocumentAttachment`削除時、Storageからファイルが正しく削除される
- [ ] `DocumentRequest`作成時、必須フィールドが正しく設定される
- [ ] `DocumentRequest.status`更新時、`resolvedAt`が正しく設定される
- [ ] `source === 'employeeUploadViaRequest'`の場合、`requestId`が正しく設定される

### 7-2. セキュリティテスト

#### 7-2-1. Firestoreルール

- [ ] `admin`/`hr`は全従業員の書類を閲覧できる
- [ ] `employee`は自分の書類のみ閲覧できる
- [ ] `admin`/`hr`は全従業員の書類をアップロードできる
- [ ] `employee`は自分の書類のみアップロードできる（リクエスト経由）
- [ ] `admin`/`hr`のみ書類を削除できる
- [ ] `admin`/`hr`は全従業員の依頼を閲覧できる
- [ ] `employee`は自分の依頼のみ閲覧できる
- [ ] `admin`/`hr`のみ依頼を作成できる
- [ ] `employee`は自分の依頼の`status`を`'uploaded'`に更新できる（`pending`の場合のみ）

#### 7-2-2. Storageルール

- [ ] `admin`/`hr`は全従業員のファイルを閲覧できる
- [ ] `employee`は自分のファイルのみ閲覧できる
- [ ] `admin`/`hr`は全従業員のファイルをアップロードできる
- [ ] `employee`は自分のファイルのみアップロードできる
- [ ] `admin`/`hr`のみファイルを削除できる
- [ ] ファイルサイズ制限（10MB）が正しく動作する
- [ ] MIMEタイプ制限（PDF・画像のみ）が正しく動作する

### 7-3. UXテスト

- [ ] エラーメッセージが適切に表示される
- [ ] アップロード中のローディング表示が適切に表示される
- [ ] アップロード成功時にSnackBarで通知される
- [ ] ファイル選択時にファイル名・サイズが表示される
- [ ] 有効期限が近い書類に警告アイコンが表示される
- [ ] 締め切りが近い依頼に警告表示がされる

### 7-4. パフォーマンステスト

- [ ] 大量の書類がある場合でも一覧表示が遅延しない
- [ ] ファイルアップロードが適切な時間内に完了する
- [ ] ファイルダウンロードが適切な時間内に完了する

---

## 🎯 完了条件

### 必須実装項目

- [ ] `/documents`画面が実装され、従業員ごとの書類管理ができる
- [ ] 管理者・人事担当者が書類アップロード依頼を作成できる
- [ ] 管理者・人事担当者が直接書類をアップロードできる
- [ ] 従業員が`/me`画面から自分宛ての依頼を確認し、ファイルをアップロードできる
- [ ] アップロードされた書類がFirebase Storageに保存され、Firestoreにメタ情報が記録される
- [ ] 書類のダウンロード・プレビューが正しく動作する
- [ ] 書類の削除が正しく動作する（admin/hrのみ）
- [ ] Firestoreルールが正しく実装され、適切なアクセス制御が機能する
- [ ] Storageルールが正しく実装され、適切なアクセス制御が機能する
- [ ] カテゴリ別フィルタが正しく動作する
- [ ] 有効期限フィルタが正しく動作する

### 任意実装項目（時間に余裕があれば）

- [ ] `/me`画面に「自分の提出書類」セクションを追加
- [ ] 書類のバージョン管理機能
- [ ] 書類の一括ダウンロード機能
- [ ] 書類の承認フロー機能

---

## 📌 注意事項

### 実装時の注意点

1. **ファイルサイズ制限**: 10MBを超えるファイルはアップロードできないようにする
2. **MIMEタイプ制限**: PDFと画像（PNG、JPG、JPEG）のみ許可する
3. **ファイル名のサニタイズ**: 特殊文字を含むファイル名は適切に処理する
4. **エラーハンドリング**: Storageアップロード失敗時は適切なエラーメッセージを表示する
5. **トランザクション**: `DocumentAttachment`作成と`DocumentRequest.status`更新は、可能であればトランザクションで処理する（Firestoreの制約により、別コレクション間のトランザクションは不可のため、エラーハンドリングで整合性を保つ）
6. **時刻系フィールドの設定**: `DocumentAttachment`作成時、`uploadedAt`と`createdAt`は同じタイミング（現在時刻）でセットする。メモ・有効期限の更新時は`updatedAt`のみ更新する
7. **Storageルールの実装**: Storageルールでは`$(database)`プレースホルダは使えないため、`(default)`を直書きする。パスセグメント（`officeId`、`employeeId`）を直接使用することで、メタデータ設定の手間を省ける
8. **Angular Fire Storageの使用**: `@angular/fire/storage`から`Storage`、`ref`、`uploadBytes`、`getDownloadURL`、`getBlob`、`deleteObject`をインポートして使用する。既存のサービスパターン（`EmployeesService`、`ChangeRequestsService`など）と同様に、コンストラクタで`Storage`を注入する
9. **ファイル名のサニタイズ**: ファイル名に特殊文字（`/`、`\`、`:`、`*`、`?`、`"`、`<`、`>`、`|`）が含まれる場合は、`_`に置換するかURLエンコードする
10. **エラーハンドリング**: Storageアップロード・ダウンロード・削除時のエラーは適切にキャッチし、ユーザーに分かりやすいエラーメッセージを表示する。`DocumentAttachment`削除時は、Storage削除とFirestore削除の両方のエラーを適切に処理する

### 将来拡張の余地

- **手続きレコードとの紐づけ**: `SocialInsuranceProcedure`レコードに`documentIds`フィールドを追加し、関連書類を紐づける
- **書類の承認フロー**: アップロードされた書類に対して承認・却下フローを追加
- **書類の自動分類**: AIによる書類種別の自動判定機能
- **書類のOCR処理**: 書類内容の自動読み取り機能

---

以上でPhase3-10の実装指示書は完了です。実装時は、この指示書を参照しながら段階的に実装を進めてください。

