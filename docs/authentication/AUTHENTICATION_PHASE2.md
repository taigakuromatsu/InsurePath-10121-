# InsurePath 認証・ロール・従業員ポータル Phase2 実装指示書: 従業員ポータル招待フロー

**作成日**: 2025年12月6日  
**対象フェーズ**: Phase2（従業員ポータル招待フローの導入）  
**優先度**: 🟢 高（Phase1の機能を実際に動かすための基盤）  
**依存関係**: Phase1完了必須  
**目標完了日**: Phase1完了後、順次実装

---

## 1. 概要

### 1-1. Phase2 の目的

Phase1で実装した「従業員ポータル連携状態の可視化」を、実際に動作させるための招待フローを導入します。

**Phase2で実現すること**:
- 管理者・人事担当者が従業員台帳から「ポータル招待」を実行できる
- 招待リンクを生成し、従業員に配布できる（URLコピー方式）
- 従業員が招待リンクを開いて、自分のログインアカウントと従業員レコードを紐づけられる
- `Employee.portal.status` が `not_invited` → `invited` → `linked` と実際に遷移する

**ログイン手段について**:
- 現時点（Phase2）でのログイン手段は Google ログインのみとする
- Email/Password 認証は Phase3 以降の拡張とする（方針ドキュメント 5-1 参照）

### 1-2. Phase1との関係性

Phase1で実装済みの機能:
- ✅ `/me` ルートに `roleGuard(['admin', 'hr', 'employee'])` が付いている
- ✅ `employee` ロールは基本 `/me` のみアクセス可、管理系ルートは `roleGuard(['admin','hr'])` で保護
- ✅ `Employee` 型に `portal` フィールドが追加済み（`PortalStatus`, `EmployeePortal` 型定義あり）
- ✅ 従業員一覧（`employees.page.ts`）に「ポータル」列とステータスチップ表示が追加済み

Phase2で追加する機能:
- `employeePortalInvites` コレクション（招待トークン管理）
- `/employee-portal/accept-invite` ページ（招待受諾画面）
- 従業員台帳からの招待操作UI（「招待」ボタン・ダイアログ）
- トークン検証・リンク処理ロジック

---

## 2. 対象機能の整理

### 2-1. Phase2-1: 従業員ポータル招待の基本機能

**実現する機能**:
- ✅ 招待トークンの生成（ランダム文字列、有効期限7日間）
- ✅ `employeePortalInvites/{token}` ドキュメントの作成
- ✅ トークン検証ロジック（有効期限・使用済みチェック）
- ✅ 従業員レコードと `UserProfile` のリンク処理
  - `employees/{employeeId}.portal.status = 'linked'`
  - `employees/{employeeId}.portal.linkedUserId = uid`
  - `employees/{employeeId}.portal.linkedAt = now`
  - `users/{uid}.officeId = officeId`（未設定の場合）
  - `users/{uid}.employeeId = employeeId`
  - `users/{uid}.role` は既存の `admin`/`hr` を維持（`employee` に変更しない）
- ✅ `/employee-portal/accept-invite?token=xxx` ページの実装
- ✅ 未ログイン時のログイン画面への誘導
- ✅ トークン検証後の `/me` へのリダイレクト

### 2-2. Phase2-2: 管理画面からの招待操作

**実現する機能**:
- ✅ 従業員台帳（`/employees`）の各行に「招待」ボタンまたはメニュー項目を追加
- ✅ クリックで招待トークンを発行し、招待URLをコピーできるダイアログ表示
- ✅ 招待実行時に `employees/{employeeId}.portal` を更新
  - `status: 'invited'`
  - `invitedEmail: employee.contactEmail`（存在する場合）
  - `invitedAt: now`
- ✅ 既に `linked` / `disabled` の場合の挙動
  - `linked`: 招待ボタンを非活性化、または「再招待」として扱う（既存リンクを解除して再招待）
  - `disabled`: 招待ボタンを非活性化、または「有効化」ボタンとして扱う（`status` を `not_invited` に戻す）

---

## 3. 関連ファイル一覧と現状の挙動の要約

### 3-1. ルーティング・ガード関係

| ファイル | 役割 | Phase2で影響を受けるポイント |
|---------|------|---------------------------|
| `src/app/app.routes.ts` | アプリケーション全体のルーティング定義 | `/employee-portal/accept-invite` ルートを追加（`authGuard` は付けない、内部でログインチェック） |
| `src/app/guards/auth.guard.ts` | ログイン認証チェック | 変更不要（accept-invite 画面では内部でログインチェック） |
| `src/app/guards/office.guard.ts` | 事業所所属チェック | 変更不要（accept-invite 画面では `officeGuard` を付けない） |
| `src/app/guards/role.guard.ts` | ロールベースアクセス制御 | 変更不要 |

### 3-2. ユーザー・オフィス・従業員関係

| ファイル | 役割 | Phase2で影響を受けるポイント |
|---------|------|---------------------------|
| `src/app/services/current-user.service.ts` | 現在のユーザー情報管理 | `updateProfile()` メソッドを使用して `employeeId` を設定する処理を追加 |
| `src/app/services/current-office.service.ts` | 現在の事業所情報管理 | 変更不要 |
| `src/app/services/employees.service.ts` | 従業員情報のCRUD操作 | `save()` メソッドで `portal` フィールドを更新する処理を追加（既存の `save()` で対応可能） |
| `src/app/services/users.service.ts` | ユーザー情報の取得 | 変更不要 |
| `src/app/types.ts` | 型定義 | `EmployeePortalInvite` 型を追加 |
| `src/app/utils/label-utils.ts` | ラベル変換関数 | 変更不要（既に `getPortalStatusLabel`, `getPortalStatusColor` が実装済み） |

### 3-3. 画面

| ファイル | 役割 | Phase2で影響を受けるポイント |
|---------|------|---------------------------|
| `src/app/pages/login/login.page.ts` | ログインUI | `?mode=employee` クエリパラメータで従業員向け文言を表示する機能を追加（オプション） |
| `src/app/pages/me/my-page.ts` | 従業員マイページ | 変更不要 |
| `src/app/pages/employees/employees.page.ts` | 従業員一覧 | 「招待」ボタンまたはメニュー項目を追加、招待ダイアログを実装 |

### 3-4. セキュリティ・ルール

| ファイル | 役割 | Phase2で影響を受けるポイント |
|---------|------|---------------------------|
| `firestore.rules` | Firestoreセキュリティルール | `employeePortalInvites` コレクションのルールを追加、`employees/{employeeId}.portal` の更新ルールを調整 |

---

## 4. データモデル設計

### 4-1. `employeePortalInvites` コレクション

**パス**: `employeePortalInvites/{token}`

**型定義** (`src/app/types.ts` に追加):

```typescript
export interface EmployeePortalInvite {
  /** トークン（ドキュメントIDとして使用） */
  id: string;
  
  /** 事業所ID */
  officeId: string;
  
  /** 従業員ID */
  employeeId: string;
  
  /** 招待先メールアドレス（従業員レコードの contactEmail） */
  invitedEmail: string;
  
  /** 招待作成者（管理者・人事担当者のUID） */
  createdByUserId: string;
  
  /** 招待作成日時 */
  createdAt: IsoDateString;
  
  /** 有効期限（ISO日時文字列） */
  expiresAt: IsoDateString;
  
  /** 使用済みフラグ */
  used: boolean;
  
  /** 使用日時（used=true の場合のみ） */
  usedAt?: IsoDateString;
  
  /** 使用したユーザーのUID（used=true の場合のみ） */
  usedByUserId?: string;
}
```

**トークン生成方針**:
- ランダム文字列（32文字程度、英数字・ハイフン・アンダースコア）
- 例: `abc123def456ghi789jkl012mno345pq`
- ドキュメントIDとして使用するため、重複チェックは Firestore の自動ID生成機能を利用するか、事前に存在チェックを行う

**有効期限**:
- デフォルト: 7日間（`createdAt` から7日後を `expiresAt` に設定）
- 将来的に設定可能にしてもよいが、Phase2では固定でOK

**型定義について**:
- Firestore 上でも `createdAt` / `expiresAt` は ISO 8601 形式の文字列として保存する（`IsoDateString`）
- `IsoDateString` は `type IsoDateString = string;` として実装し、InsurePath/ProblemPath 全体で統一する
- これにより、Firestore セキュリティルールでも `is string` としてチェックできる

### 4-2. `Employee.portal` の利用方針（再掲）

**型定義**（Phase1で既に実装済み）:

```typescript
export type PortalStatus = 'not_invited' | 'invited' | 'linked' | 'disabled';

export interface EmployeePortal {
  status: PortalStatus;
  invitedEmail?: string;
  invitedAt?: IsoDateString;
  linkedUserId?: string;
  linkedAt?: IsoDateString;
}

export interface Employee {
  // ... 既存フィールド ...
  portal?: EmployeePortal | null;
}
```

**状態遷移パターン**:

1. **`not_invited`**（初期状態）
   - `portal` が `undefined` または `null` の場合も `not_invited` とみなす
   - 管理者が「招待」ボタンを押すと `invited` に遷移

2. **`invited`**（招待済み）
   - 管理者が招待トークンを発行した時点で設定
   - `invitedEmail`, `invitedAt` を記録
   - 従業員が招待リンクを開いてリンク処理が完了すると `linked` に遷移

3. **`linked`**（連携済み）
   - 従業員が招待リンクを開いて、自分のログインアカウントと従業員レコードを紐づけた状態
   - `linkedUserId`, `linkedAt` を記録
   - この状態では、基本的に再招待は不要（必要に応じて「再招待」機能を追加可能）

4. **`disabled`**（停止中）
   - 将来的な拡張用（Phase2では実装しない）
   - 一時的にポータル連携を無効化したい場合に使用

### 4-3. `UserProfile` との関係

**`users/{uid}` の更新方針**:

招待受諾時（accept-invite 処理）に以下のフィールドを更新:

- `officeId`: 未設定の場合のみ設定（既に設定されている場合は変更しない）
- `employeeId`: 必ず設定（既存の `admin`/`hr` が自分の従業員レコードにリンクする場合も含む）
- `role`: 既存ユーザーの `role` は変更しない（`admin`/`hr` はそのまま維持し、新規ユーザーの場合のみ `employee` を設定する）

**注意事項**:
- 既に `admin`/`hr` としてログインしているユーザーが、自分の従業員レコードにリンクする場合:
  - `users/{uid}.role` は `admin`/`hr` のまま維持
  - `users/{uid}.employeeId` を設定
  - これにより、管理者も `/me` で自分の従業員情報を閲覧できる

---

## 5. ルーティングとフロー設計

### 5-1. 新規ルート: `/employee-portal/accept-invite`

**ルート定義** (`src/app/app.routes.ts`):

```typescript
{
  path: 'employee-portal',
  children: [
    {
      path: 'accept-invite',
      // authGuard は付けない（未ログインでもアクセス可能にする）
      loadComponent: () => import('./pages/employee-portal/accept-invite.page').then((m) => m.AcceptInvitePage)
    }
  ]
}
```

**コンポーネントファイル**: `src/app/pages/employee-portal/accept-invite.page.ts`

**クエリパラメータ**:
- `token`: 招待トークン（必須）

**フロー**:

1. **ページ読み込み時**:
   - URLから `token` クエリパラメータを取得
   - `token` が存在しない場合 → エラーメッセージ表示

2. **ログイン状態チェック**:
   - 未ログインの場合:
     - 「ログインが必要です」メッセージとログインボタンを表示
     - ログインボタンクリック → `/login?mode=employee&redirect=/employee-portal/accept-invite?token=xxx` に遷移
     - ログイン後、元のURLにリダイレクト
   - ログイン済みの場合:
     - トークン検証処理を実行

3. **トークン検証**:
   - `employeePortalInvites/{token}` を取得
   - 存在しない → 「無効な招待リンクです」エラー
   - `used === true` → 「この招待リンクは既に使用されています」エラー
   - `expiresAt < now` → 「招待リンクの有効期限が切れています」エラー
   - `officeId`, `employeeId` の存在確認

4. **メールアドレス整合性チェック**（5-4 参照）:
   - `user.email` が存在しない場合 → エラーとして処理を中止
   - `invitedEmail` と `user.email` を小文字化して比較
   - 一致しない場合 → エラーとして処理を中止

5. **リンク処理**:
   - `employees/{employeeId}` を取得して存在確認
   - `employees/{employeeId}.portal.status` を `'linked'` に更新
   - `employees/{employeeId}.portal.linkedUserId = uid`
   - `employees/{employeeId}.portal.linkedAt = now`
   - `users/{uid}.officeId` を設定（未設定の場合のみ）
   - `users/{uid}.employeeId = employeeId` を設定
   - `users/{uid}.role` を設定（既存ユーザーの `role` は変更せず、新規ユーザーの場合のみ `employee` を設定）
   - `employeePortalInvites/{token}.used = true`
   - `employeePortalInvites/{token}.usedAt = now`
   - `employeePortalInvites/{token}.usedByUserId = uid`

6. **リダイレクト**:
   - `/me` に遷移

### 5-2. ログインとの関係

**`/login?mode=employee` の実装**（オプション）:

`login.page.ts` で `mode` クエリパラメータをチェック:

```typescript
// ActivatedRoute から mode を取得
const mode = this.route.snapshot.queryParams['mode'];

// mode === 'employee' の場合、タイトルと説明文を変更
if (mode === 'employee') {
  // 「InsurePath 従業員用ログイン」というタイトルを表示
  // 「あなたの社会保険情報を確認するための従業員専用ページです。」という説明を表示
}
```

**リダイレクト処理**:
- ログイン成功後、`redirect` クエリパラメータがあればそこに遷移
- なければ `/dashboard` に遷移（従来どおり）

**ログイン手段について**:
- 現時点（Phase2）でのログイン手段は Google ログインのみとする
- Email/Password 認証は Phase3 以降の拡張とする（方針ドキュメント 5-1 参照）

### 5-3. ガードとの関係

**accept-invite 画面のガード方針**:
- `authGuard` は付けない（未ログインでもアクセス可能にする）
- 内部で `AuthService.authState$` を監視してログイン状態をチェック
- 未ログインの場合はログインボタンを表示

### 5-4. メールアドレス整合性チェック

**`invitedEmail` と `user.email` の整合性チェック**:

Phase2 の時点で、以下のチェックを実装する:

1. **ログインユーザーのメールアドレス確認**:
   - `user.email` が存在しない場合 → エラーとしてリンク処理を中止
   - エラーメッセージ: 「ログイン中のアカウントにメールアドレスが設定されていません。管理者に問い合わせてください。」

2. **メールアドレスの比較**:
   - `invitedEmail` と `user.email` を小文字化（`toLowerCase()`）して比較
   - 一致しない場合 → エラーとしてリンク処理を中止
   - エラーメッセージ: 「招待されたメールアドレス（{invitedEmail}）とログイン中のアカウント（{user.email}）が一致しません。正しいアカウントでログインしてください。」

**実装箇所**:
- `accept-invite.page.ts` のリンク処理（Step 4）で、トークン検証後・リンク処理実行前にチェックを追加

**将来の拡張**:
- Phase3 以降で、管理者による例外承認などの拡張を検討する

---

## 6. UI / UX 設計

### 6-1. `/employees` 一覧のポータル列に対する操作

**「招待」ボタンの配置**:
- オプション1: 各行の「操作」列に「招待」ボタンを追加
- オプション2: ポータル列のチップをクリック可能にして、メニューを表示（「招待」「再招待」「状態を確認」など）

**推奨**: オプション1（既存の「操作」列に追加）

**招待ボタンの状態**:
- `portal.status === 'not_invited'` または `portal === undefined/null`: 「招待」ボタンを表示（有効）
- `portal.status === 'invited'`: 「招待済み」ボタンを表示（無効、または「再招待」として有効）
- `portal.status === 'linked'`: 「連携済み」ボタンを表示（無効、または「再招待」として有効）
- `portal.status === 'disabled'`: 「停止中」ボタンを表示（無効）

**招待ダイアログ** (`invite-employee-dialog.component.ts`):

1. **ダイアログ表示時**:
   - 従業員名を表示
   - 招待トークンを生成
   - `employeePortalInvites/{token}` を作成
   - `employees/{employeeId}.portal` を `status: 'invited'` に更新

2. **ダイアログ内容**:
   - タイトル: 「従業員ポータル招待」
   - 本文:
     - 「{従業員名}さんにポータル招待を送信しますか？」
     - 招待URLを表示（読み取り専用テキストフィールド）
     - 「URLをコピー」ボタン
   - ボタン:
     - 「閉じる」（デフォルト）
     - 「URLをコピー」（プライマリ）

3. **URLコピー処理**:
   - `navigator.clipboard.writeText()` を使用
   - コピー成功時はスナックバーで「URLをコピーしました」と表示

### 6-2. 招待受諾画面（accept-invite）の基本UI

**ローディング状態**:
- トークン検証中はスピナーを表示

**成功時の表示**:
- 「従業員ポータルへの接続が完了しました」
- 「マイページに移動します...」というメッセージ
- 自動的に `/me` にリダイレクト（2秒後）

**エラー時の表示**:
- **無効なトークン**: 「この招待リンクは無効です。管理者に問い合わせてください。」
- **期限切れ**: 「この招待リンクの有効期限が切れています。管理者に再招待を依頼してください。」
- **既使用**: 「この招待リンクは既に使用されています。」
- **従業員レコード不存在**: 「従業員情報が見つかりませんでした。管理者に問い合わせてください。」
- **メールアドレス不一致**: 「招待されたメールアドレス（{invitedEmail}）とログイン中のアカウント（{user.email}）が一致しません。正しいアカウントでログインしてください。」
- **メールアドレス未設定**: 「ログイン中のアカウントにメールアドレスが設定されていません。管理者に問い合わせてください。」

**未ログイン時の表示**:
- 「ログインが必要です」メッセージ
- 「Google でログイン」ボタン
- ログイン後、元のURLにリダイレクト

**メールアドレス不一致時の表示**:
- 「招待されたメールアドレス（{invitedEmail}）とログイン中のアカウント（{user.email}）が一致しません。正しいアカウントでログインしてください。」というエラーメッセージ

### 6-3. `/login` の表示切り替え（オプション）

`mode=employee` の場合の表示変更:

- **タイトル**: 「InsurePath 従業員用ログイン」
- **説明文**:
  - 「あなたの社会保険情報を確認するための従業員専用ページです。」
  - 「管理者・人事担当の方は、管理者画面用のログインからお入りください。」

---

## 7. Firestore セキュリティルールの方針

### 7-1. `employeePortalInvites` コレクション

**ルール案** (`firestore.rules`):

```javascript
match /employeePortalInvites/{token} {
  // 読み取り: 管理者・人事担当者は全件、一般従業員は自分のトークン（usedByUserId が自分のUID）のみ
  allow read: if isSignedIn() && (
    isAdminOrHr(resource.data.officeId)
    || (resource.data.usedByUserId == request.auth.uid)
  );
  
  // 作成: 管理者・人事担当者のみ
  allow create: if isSignedIn()
    && isAdminOrHr(request.resource.data.officeId)
    && request.resource.data.keys().hasOnly([
      'id', 'officeId', 'employeeId', 'invitedEmail',
      'createdByUserId', 'createdAt', 'expiresAt', 'used'
    ])
    && request.resource.data.officeId is string
    && request.resource.data.employeeId is string
    && request.resource.data.invitedEmail is string
    && request.resource.data.createdByUserId == request.auth.uid
    && request.resource.data.createdAt is string
    && request.resource.data.expiresAt is string
    && request.resource.data.used == false;
  
  // 更新: 管理者・人事担当者は全件、一般従業員は自分のトークンを初回使用済みにする場合のみ
  allow update: if isSignedIn() && (
    (
      isAdminOrHr(resource.data.officeId)
      && request.resource.data.diff(resource.data).changedKeys().hasOnly(['used', 'usedAt', 'usedByUserId'])
    )
    || (
      // 一般従業員が初回に used を true にする場合（accept-invite 画面経由でしか満たせない前提）
      resource.data.used == false
      && request.resource.data.used == true
      && request.resource.data.usedByUserId == request.auth.uid
      && request.resource.data.usedAt is string
    )
  );
  
  // 削除: 管理者・人事担当者のみ
  allow delete: if isSignedIn() && isAdminOrHr(resource.data.officeId);
}
```

### 7-2. `employees/{employeeId}.portal` の更新

**現状のルール** (`firestore.rules`):
- `employees/{employeeId}` の更新は `isAdminOrHr(officeId)` のみ許可

**Phase2での調整**:
- `portal.status` を `'invited'` に変更: 管理者・人事担当者のみ（既存ルールで対応可能）
- `portal.status` を `'linked'` に変更: **accept-invite 処理時のみ許可**
  - オプション1: クライアント側で更新（Firestoreルールで `portal.linkedUserId == request.auth.uid` をチェック）
  - オプション2: Cloud Functions で更新（より安全だが、Phase2では実装しない）

**推奨**: オプション1（クライアント側で更新）

**ルール案**:

```javascript
// employees/{employeeId} の update ルールに追加
allow update: if belongsToOffice(officeId) && (
  (
    // 管理者・人事担当者は全フィールド更新可能
    isAdminOrHr(officeId)
    && validEmployeeExtendedFields(request.resource.data)
  )
  || (
    // 一般従業員は portal フィールドのみ更新可能（linked への変更のみ）
    // ※この条件は accept-invite 画面経由でしか満たせないことを前提とする
    // ※将来 Functions 化する場合は、この分岐を整理する必要がある
    isInsureEmployee(officeId)
    && request.resource.data.diff(resource.data).changedKeys().hasOnly(['portal', 'updatedAt'])
    && request.resource.data.portal.status == 'linked'
    && request.resource.data.portal.linkedUserId == request.auth.uid
    && resource.data.portal.status == 'invited'
  )
);
```

**注意事項**:
- 上記のルール例では、既存の `firestore.rules` のヘルパー関数名（`isAdminOrHr`, `belongsToOffice`, `isInsureEmployee`, `validEmployeeExtendedFields` など）を使用している
- 実装時は、実際の `firestore.rules` ファイル内のヘルパー関数名と引数に合わせて調整すること

### 7-3. MVP実装方針

**Phase2では「全部クライアント側でやる」方針**:

- **メリット**:
  - 実装が簡単
  - Cloud Functions のデプロイが不要
  - 開発・テストが容易

- **デメリット**:
  - セキュリティルールが複雑になる
  - クライアント側でトークン検証・リンク処理を行うため、悪意のあるクライアントによる改ざんリスクがある（ただし、Firestoreルールで最小限の保護は可能）

- **将来の拡張**:
  - Phase3以降で Cloud Functions を導入し、`portal.status` を `'linked'` に変更する処理をサーバー側で実行することを検討

---

## 8. 実装ステップ（推奨順序）

### Step 1: 型定義・データモデル追加

**対象ファイル**:
- `src/app/types.ts`

**作業内容**:
1. `EmployeePortalInvite` インターフェースを追加
2. 既存の `Employee.portal` 型定義を確認（Phase1で実装済み）

### Step 2: 招待トークン発行サービス・処理の実装

**対象ファイル**:
- `src/app/services/employee-portal-invites.service.ts`（新規作成）

**作業内容**:
1. `EmployeePortalInvitesService` クラスを作成
2. `createInvite(officeId: string, employeeId: string, invitedEmail: string): Promise<EmployeePortalInvite>` メソッドを実装
   - トークン生成（32文字のランダム文字列）
   - `employeePortalInvites/{token}` を作成
   - `employees/{employeeId}.portal` を `status: 'invited'` に更新
3. `getInvite(token: string): Observable<EmployeePortalInvite | null>` メソッドを実装
4. `markAsUsed(token: string, userId: string): Promise<void>` メソッドを実装

### Step 3: accept-invite 画面の skeleton 実装

**対象ファイル**:
- `src/app/pages/employee-portal/accept-invite.page.ts`（新規作成）
- `src/app/app.routes.ts`

**作業内容**:
1. `accept-invite.page.ts` を作成（スタンドアロンコンポーネント）
2. 基本的なUI構造を実装（ローディング、エラー表示、成功表示）
3. `app.routes.ts` に `/employee-portal/accept-invite` ルートを追加
4. クエリパラメータ `token` の取得処理を実装

### Step 4: トークン検証ロジックとリンク処理の実装

**対象ファイル**:
- `src/app/pages/employee-portal/accept-invite.page.ts`
- `src/app/services/employee-portal-invites.service.ts`
- `src/app/services/current-user.service.ts`
- `src/app/services/employees.service.ts`

**作業内容**:
1. `accept-invite.page.ts` にトークン検証処理を実装
   - トークン存在チェック
   - 有効期限チェック
   - 使用済みチェック
2. **メールアドレス整合性チェックを実装**（5-4 参照）
   - `user.email` の存在確認
   - `invitedEmail` と `user.email` を小文字化して比較
   - 一致しない場合はエラーとして処理を中止
3. リンク処理を実装
   - `employees/{employeeId}.portal.status = 'linked'` に更新
   - `employees/{employeeId}.portal.linkedUserId = uid` を設定
   - `employees/{employeeId}.portal.linkedAt = now` を設定
   - `users/{uid}.officeId` を設定（未設定の場合のみ）
   - `users/{uid}.employeeId = employeeId` を設定
   - `users/{uid}.role` を設定（既存ユーザーは変更せず、新規ユーザーの場合のみ `employee` を設定）
   - `employeePortalInvites/{token}.used = true` に更新
4. エラーハンドリングを実装（無効トークン、期限切れ、既使用、メールアドレス不一致など）

### Step 5: ログイン状態チェックとリダイレクト処理

**対象ファイル**:
- `src/app/pages/employee-portal/accept-invite.page.ts`
- `src/app/pages/login/login.page.ts`（オプション）

**作業内容**:
1. `accept-invite.page.ts` でログイン状態をチェック
2. 未ログインの場合はログインボタンを表示
3. ログインボタンクリック時、`/login?mode=employee&redirect=/employee-portal/accept-invite?token=xxx` に遷移
4. `login.page.ts` で `mode=employee` の場合の表示切り替えを実装（オプション）
5. ログイン成功後、`redirect` クエリパラメータがあればそこにリダイレクト

### Step 6: `/employees` 一覧からの招待UI追加

**対象ファイル**:
- `src/app/pages/employees/employees.page.ts`
- `src/app/pages/employees/invite-employee-dialog.component.ts`（新規作成）

**作業内容**:
1. `invite-employee-dialog.component.ts` を作成
2. `employees.page.ts` の「操作」列に「招待」ボタンを追加
3. 招待ボタンクリック時に `invite-employee-dialog` を開く
4. ダイアログ内で招待トークンを生成し、URLを表示
5. 「URLをコピー」ボタンを実装
6. 招待ボタンの状態管理（`not_invited` / `invited` / `linked` / `disabled` で表示を切り替え）

### Step 7: Firestore ルールの調整

**対象ファイル**:
- `firestore.rules`

**作業内容**:
1. `employeePortalInvites` コレクションのルールを追加
2. `employees/{employeeId}` の更新ルールを調整（`portal.status` を `'linked'` に変更する処理を許可）

### Step 8: 最後に E2E 的な動作確認

**確認項目**:
1. 管理者が従業員台帳から「招待」ボタンを押す → トークン生成 → `portal.status` が `invited` になる
2. 招待URLをコピーして、未ログイン状態で開く → ログイン画面に遷移
3. ログイン後、自動的に accept-invite 画面に戻る → トークン検証 → リンク処理 → `/me` に遷移
4. 既に `linked` の従業員に対しては招待ボタンが適切に無効化される
5. 期限切れトークン、無効トークン、既使用トークンで適切なエラーメッセージが表示される
6. 管理者自身が自分の従業員レコードにリンクする場合も正常に動作する

---

## 9. テストケース一覧

### 9-1. 管理者/人事の視点

#### テストケース1: 招待ボタン押下 → トークン生成 → portal.status が `invited` になる
- **前提**: 管理者がログイン済み、従業員レコードが存在し、`portal.status` が `not_invited` または `undefined`
- **手順**:
  1. `/employees` にアクセス
  2. 対象従業員の行の「招待」ボタンをクリック
  3. 招待ダイアログが表示される
  4. 招待URLが表示される
  5. 「URLをコピー」ボタンをクリック
- **期待結果**:
  - `employeePortalInvites/{token}` が作成される
  - `employees/{employeeId}.portal.status` が `'invited'` になる
  - `employees/{employeeId}.portal.invitedEmail` が設定される
  - `employees/{employeeId}.portal.invitedAt` が設定される
  - 招待URLがクリップボードにコピーされる
  - 一覧のポータル列に「招待済」（青色チップ）が表示される

#### テストケース2: 既に `linked` の従業員に対しての挙動
- **前提**: 従業員レコードの `portal.status` が `'linked'`
- **手順**:
  1. `/employees` にアクセス
  2. 対象従業員の行を確認
- **期待結果**:
  - 「招待」ボタンが無効化されている、または「再招待」ボタンとして表示される
  - ポータル列に「連携済」（緑色チップ）が表示される

#### テストケース3: 既に `invited` の従業員に対して再招待
- **前提**: 従業員レコードの `portal.status` が `'invited'`
- **手順**:
  1. `/employees` にアクセス
  2. 対象従業員の行の「招待」ボタンをクリック（または「再招待」ボタン）
- **期待結果**:
  - 新しいトークンが生成される
  - 既存の `employeePortalInvites/{oldToken}` はそのまま（削除しない）
  - `employees/{employeeId}.portal.invitedAt` が更新される

### 9-2. 従業員の視点

#### テストケース4: 招待リンクを未ログインで開く → ログイン → accept-invite → `/me` に遷移
- **前提**: 管理者が招待トークンを発行済み、従業員は未ログイン
- **手順**:
  1. 招待URL（`/employee-portal/accept-invite?token=xxx`）を未ログイン状態で開く
  2. 「ログインが必要です」メッセージとログインボタンが表示される
  3. ログインボタンをクリック
  4. `/login?mode=employee&redirect=/employee-portal/accept-invite?token=xxx` に遷移
  5. Google でログイン
  6. 自動的に `/employee-portal/accept-invite?token=xxx` に戻る
  7. トークン検証 → リンク処理が実行される
- **期待結果**:
  - ログイン後、元のURLにリダイレクトされる
  - トークン検証が成功する
  - `employees/{employeeId}.portal.status` が `'linked'` になる
  - `users/{uid}.officeId` が設定される（未設定の場合）
  - `users/{uid}.employeeId` が設定される
  - `/me` にリダイレクトされる

#### テストケース5: ログイン済みで開く → そのままトークン検証＆リンク処理が走る
- **前提**: 管理者が招待トークンを発行済み、従業員は既にログイン済み
- **手順**:
  1. 招待URLをログイン済み状態で開く
  2. トークン検証 → リンク処理が実行される
- **期待結果**:
   - トークン検証が成功する
   - リンク処理が実行される
   - `/me` にリダイレクトされる

#### テストケース6: 期限切れトークン
- **前提**: 招待トークンの `expiresAt` が過去の日時
- **手順**:
  1. 期限切れの招待URLを開く
- **期待結果**:
   - 「この招待リンクの有効期限が切れています。管理者に再招待を依頼してください。」というエラーメッセージが表示される

#### テストケース7: 無効トークン
- **前提**: 存在しないトークン
- **手順**:
  1. 無効なトークンの招待URLを開く
- **期待結果**:
   - 「この招待リンクは無効です。管理者に問い合わせてください。」というエラーメッセージが表示される

#### テストケース8: 既使用トークン
- **前提**: 招待トークンの `used === true`
- **手順**:
  1. 既に使用済みの招待URLを開く
- **期待結果**:
   - 「この招待リンクは既に使用されています。」というエラーメッセージが表示される

#### テストケース9: メールアドレス不一致
- **前提**: 管理者が `invitedEmail = 'employee@example.com'` で招待トークンを発行、ユーザーは `user@example.com` でログイン
- **手順**:
  1. 招待URLを開く
  2. トークン検証処理を実行
- **期待結果**:
   - 「招待されたメールアドレス（employee@example.com）とログイン中のアカウント（user@example.com）が一致しません。正しいアカウントでログインしてください。」というエラーメッセージが表示される
   - リンク処理が実行されない

### 9-3. 管理者自身が従業員レコードにリンクするケース

#### テストケース10: 管理者が自分の従業員レコードにリンク
- **前提**: 管理者（`role: 'admin'`）がログイン済み、自分の従業員レコードが存在
- **手順**:
  1. 管理者が自分の従業員レコードに対して招待トークンを発行（または他の管理者が発行）
  2. 招待URLを開く
  3. トークン検証 → リンク処理が実行される
- **期待結果**:
   - `users/{uid}.role` は `'admin'` のまま維持される
   - `users/{uid}.employeeId` が設定される
   - `employees/{employeeId}.portal.status` が `'linked'` になる
   - `/me` にリダイレクトされ、自分の従業員情報が表示される

### 9-4. セキュリティ観点

#### テストケース11: 別 office の従業員招待を悪用できないか
- **前提**: ユーザーAが office1 に所属、トークンは office2 の従業員用
- **手順**:
  1. office2 の従業員用招待URLを開く
  2. トークン検証処理を実行
- **期待結果**:
   - Firestoreルールで `officeId` の整合性をチェック
   - 別 office のトークンを使用できない（エラーになる）

#### テストケース12: メールアドレス不一致でリンクできないことの確認
- **前提**: ユーザーAがログイン済み（`userA@example.com`）、トークンはユーザーB用（`invitedEmail = 'userB@example.com'`）
- **手順**:
  1. ユーザーB用の招待URLを開く
  2. トークン検証処理を実行
- **期待結果**:
   - メールアドレス不一致のエラーが表示される
   - リンク処理が実行されない（`employees/{employeeId}.portal.status` は `'invited'` のまま）
   - `users/{uid}.employeeId` が設定されない

---

## 10. 今回スコープ外にすること（明示）

### 10-1. Phase3 以降の内容

以下の項目は Phase3 以降で実装予定です:

- `/office-setup` の UX 見直し
- 事業所参加フローの完全招待制への移行
- 既存の「リストから選んで参加」機能の削除

### 10-2. Email/Password 認証の導入

以下の項目は Phase3 以降で実装予定です:

- Firebase Auth の Email/Password 認証の有効化
- ログイン画面の UI 拡張（Google + メールの2択）
- パスワードリセット・メール認証機能

### 10-3. 本格的なメール送信

以下の項目は Phase3 以降で実装予定です:

- 招待メール送信のための Cloud Functions
- メールテンプレートの作成
- メール送信失敗時のリトライ処理

**Phase2での代替手段**:
- 招待URLをコピーして、LINEやSlackなどで共有する方式で運用
- 将来的にメール送信を追加しやすい設計にする（`EmployeePortalInvite.invitedEmail` フィールドを用意しておく）

### 10-4. その他の将来拡張項目

- トークンの有効期限を設定可能にする（現状は7日間固定）
- 招待履歴の表示（誰がいつ招待したか）
- 複数の招待トークンを同時に有効にする機能
- 招待トークンの一覧表示・管理画面

---

## 11. 注意事項・制約

### 11-1. 既存データとの互換性

- `Employee.portal` フィールドは `optional` として追加済みのため、既存の `employees` ドキュメントに影響しない
- `portal` が `undefined` の場合は `not_invited` とみなして表示する（Phase1で実装済み）

### 11-2. セキュリティ考慮事項

- トークンは32文字のランダム文字列で、推測困難にする
- トークンの有効期限は7日間（将来的に設定可能にしてもよい）
- トークンは1回使用後は無効化（`used: true`）
- **`invitedEmail` と `user.email` の整合性チェックは Phase2 で実装する**
  - 比較は大小文字を無視して行い、一致しない場合はエラーとしてリンク処理を中止する
  - 将来、管理者による例外承認などの拡張を Phase3 以降で検討する

### 11-3. パフォーマンス考慮事項

- `employeePortalInvites` コレクションは `expiresAt` でインデックスを張る（将来的に）
- 古いトークンは定期的にクリーンアップ（Cloud Functions でスケジュール実行、Phase3 以降で実装）

### 11-4. エラーハンドリング

- トークン検証時のエラーは、ユーザーに分かりやすいメッセージを表示する
- ネットワークエラー時はリトライ機能を実装する（オプション）

---

## 12. 関連ドキュメント

- `AUTHENTICATION_PHASE1.md`: Phase1 の実装指示書
- `AUTHENTICATION_AND_PORTAL_POLICY.md`: 認証・ロール・従業員ポータル方針（決定版ドラフト）

---

以上で、InsurePath 認証・ロール・従業員ポータル Phase2 の実装指示書は完了です。

実装時は、この指示書に従って段階的に機能を追加していきます。

