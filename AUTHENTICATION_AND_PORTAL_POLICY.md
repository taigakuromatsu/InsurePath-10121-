# InsurePath 認証・ロール・従業員ポータル方針（決定版ドラフト）

**作成日**: 2025年12月6日  
**最終更新**: 2025年12月6日  
**ステータス**: 決定版ドラフト

---

## 0. ゴール

- 従業員と管理者の役割を明確に分けたログイン／画面構成にする
- 「従業員台帳」と「ログインユーザー（Auth）」の連携状態が一目で分かる
- 「知らない人が勝手に事業所に参加する」リスクを減らす
- 現状実装とのギャップは、段階的に解消できるようにしておく（いきなり全面移行しない）

---

## 1. ロールと画面アクセス方針

### 1-1. ロールの意味

- **admin**: 事業所管理者（すべての設定・台帳編集が可能）
- **hr**: 人事担当（admin に近い権限、事務作業主体）
- **employee**: 一般従業員（自分の情報を確認・一部申請できるだけ）

### 1-2. 画面アクセス方針

#### employee ロール

- アクセスできるのは基本 `/me`（マイページ系）だけ
- ダッシュボード・従業員台帳・マスタ設定などはアクセス不可

#### admin / hr ロール

- 従来どおり管理画面（ダッシュボード、台帳、マスタ 等）にアクセス可能
- かつ 自分の従業員レコードとリンクされていれば `/me` も見られる

### ✅ 1-3. ルーティング／Guard の方針

- すべての保護されたルートに `authGuard` は必須（ログイン強制）
- `officeGuard` は「そのユーザーがどの office に属しているか」をチェック
- ✅ `roleGuard` の振る舞い（実装完了）：
  - ✅ `employee` ロールが `/me` 以外のルートに来たら、`/me` にリダイレクト
  - `admin` / `hr` は従来どおり

**補足**:
- `employee` ロールのユーザーは **必ず `officeId` を持っている前提** にする。
- → 招待を受けてオフィスに紐づくまでは、そもそもポータル利用対象外。

---

## 2. データモデル方針

### ✅ 2-1. UserProfile（ユーザー情報）実装完了

#### ✅ 現状（実装済み）

```typescript
// users/{uid}
{
  officeId?: string;  // 単一事業所
  role: UserRole;     // 'admin' | 'hr' | 'employee'
  employeeId?: string; // ✅ Phase2で追加実装
}
```

#### 方針

- ✅ 現状の **単一 `officeId` モデルは維持** する（マルチ事業所対応は将来）
- 将来の案として `officeMemberships`（複数事業所対応）を検討するが、**今フェーズでは実装しない**（カタログ or 設計メモ止まり）

**※注意**: `officeMemberships` に切り替えると `CurrentUserService` / `officeGuard` / `roleGuard` 全面改修＋データ移行が必要になるため、現段階ではスコープ外とする。

### ✅ 2-2. 従業員台帳（employees）

```typescript
// offices/{officeId}/employees/{employeeId}
{
  name: string;
  email?: string;
  // ...他の台帳項目

  portal?: {
    status: 'not_invited' | 'invited' | 'linked' | 'disabled';
    invitedEmail?: string;
    invitedAt?: Timestamp;
    linkedUserId?: string; // users/{uid}
    linkedAt?: Timestamp;
  };
}
```

- ✅ `portal.status` で「従業員ポータル連携状態」を管理する（実装完了）
  - `not_invited`: ポータル招待を送っていない
  - `invited`: 招待リンクを発行済み（まだ使われていない）
  - `linked`: 招待リンクや処理を通じてログインユーザーと紐づいた状態
  - `disabled`: 一時停止など、後々の拡張用

---

## 3. 従業員ポータル招待＆連携フロー

### ✅ 3-1. 招待トークン

✅ コレクション例：`employeePortalInvites/{token}`（実装完了）

```typescript
// employeePortalInvites/{token}
{
  officeId: string;
  employeeId: string;
  invitedEmail: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  used: boolean;
}
```

### ✅ 3-2. フロー概要（実装完了）

1. ✅ **管理者が従業員台帳に登録**
   - ✅ 氏名・メールアドレス等を入力して `employees` ドキュメントを作成

2. ✅ **「ポータル招待」ボタンを押す**
   - ✅ `employeePortalInvites/{token}` を作成
   - ✅ `employees/{employeeId}.portal` を `status: 'invited'`, `invitedEmail`, `invitedAt` に更新
   - ✅ 招待URLコピーで配布（メール送信は Phase3 以降）

3. ✅ **従業員が招待リンクを開く**
   - ✅ URL例：`/employee-portal/accept-invite?token=xxx`
   - ✅ 「InsurePath 従業員用ログイン」ページへ遷移

4. ✅ **ログイン**
   - ✅ まだログインしていない場合：Google ログイン（Email+Password は Phase3 以降）

5. ✅ **トークン検証＆リンク処理**
   - ✅ トークン有効期限・`officeId`/`employeeId` 存在チェック
   - ✅ `invitedEmail` と `user.email` の整合性チェック（小文字化して比較）
   - ✅ 問題なければ：
     - ✅ `employees/{employeeId}.portal.status = 'linked'`
     - ✅ `portal.linkedUserId = uid`, `portal.linkedAt = now`
     - ✅ `users/{uid}.officeId = officeId`（未設定の場合のみ）
     - ✅ `users/{uid}.role`（既存 `admin`/`hr` を維持、新規は `employee`）
     - ✅ `users/{uid}.employeeId = employeeId`

6. ✅ **マイページへリダイレクト**
   - ✅ `/me` に遷移し、自分の保険情報や申請状況を閲覧できる

**メール送信は後回しでもOK**:
- MVPでは「URLコピーしてLINEなどで共有」でも成立する。メール送信は Functions で後日実装。

---

## ✅ 4. 管理者も従業員として扱うポリシー（実装完了）

- ✅ 管理者・人事担当者も **1人の従業員として `employees` にレコードを持つ** 前提
- ✅ そのレコードに対しても、上記のポータル連携フローを適用できる

✅ **連携後**:
- ✅ `users/{uid}.role` は `admin` or `hr` のまま（既存ロールを維持）
- ✅ 同時に `users/{uid}.employeeId` が埋まる

✅ **UI**:
- ✅ 管理者は管理画面のナビに加えて「マイページ」リンクを持つ
- ✅ `/me` では「自分自身の従業員情報」を表示する

---

## 5. ログインページ／従業員用ログインの見せ方

### 5-1. 認証手段

**現状**: Google ログインのみ

**方針**:
- Google ログインをメインとして維持
- Email/Password 認証は Phase3 以降の段階的追加（必須ではない）
  - Firebase Auth で有効化
  - パスワードリセット・メール認証は後回しでもよい

### ✅ 5-2. 画面としての出し分け（実装完了）

✅ **ルート**:
- ✅ `/login`: 通常ログイン
- ✅ `/employee-portal/accept-invite?token=xxx`: 招待受諾用

✅ **UI 表現**:
- ✅ `/login` に `?mode=employee` クエリを付けて文言を切り替える方法を実装
- ✅ 例：`/login?mode=employee`

✅ **`mode=employee` の場合**:
- ✅ タイトル：「InsurePath 従業員用ログイン」
- ✅ サブ文言：
  - ✅ 「あなたの社会保険情報を確認するための従業員専用ページです。」
  - ✅ 「管理者・人事担当の方は、管理者画面用のログインからお入りください。」

✅ 招待受諾フローでは、内部的に `/login?mode=employee&redirect=...` に遷移して説明だけ変える形を実装。

---

## 6. 事業所セットアップ／参加フローの方針

### 6-1. 現状の問題

- `/office-setup` で既存事業所一覧から選んで参加できるため、理論上「知らない人」が事業所を選んで入れてしまう

### 6-2. 新ポリシー

#### 新規事業所作成

- 初めて InsurePath を使う管理者は `/office-setup` に飛ぶ
- 「新しく事業所を作成」して、自分が `admin` として紐付く

#### 既存事業所への参加

- 基本は **招待リンク経由のみ**
- `/office-setup` に表示する文言例：
  - 「既存の事業所に参加するには、管理者から送られた招待リンクを利用してください。」
- 既存の「リストから選んで参加」は今後非推奨とし、将来的に削除を検討
- 移行期間中は、必要なら「管理者承認フロー」を挟むなどで安全性を補う

**`joinCode` 方式はオプションとして検討**（今回は説明だけ）。

MVP の実装は「招待リンク方式 + 既存の一覧選択は実質使わない」でも可。





---

## 7. 段階的実装計画（Cursor の評価を踏まえた整理）

### Phase 1（今すぐやりやすく・効果が大きいところ）

#### ✅ 1. employee ロールの `/me` 限定アクセス

- ✅ `roleGuard` を整理し、`employee` が他ルートに来たら `/me` にリダイレクト
- ✅ `/me` ルートには `roleGuard` を追加

#### ✅ 2. 従業員台帳に `portal.status` 表示

- ✅ `Employee` 型に `portal` を追加
- ✅ 一覧に「ポータル状態」列：
  - 灰：未招待
  - 青：招待済
  - 緑：連携済

**※ここだけでも「社員はマイページだけ」「連携状況が目で分かる」という改善が得られる。**

### ✅ Phase 2（従業員招待フローの導入）実装完了

#### ✅ 1. 従業員ポータル招待の基本機能

- ✅ `employeePortalInvites` コレクション
- ✅ トークン生成・検証ロジック
- ✅ `/employee-portal/accept-invite` ページ（＋`/login?mode=employee` 表示）
- ✅ Firestore セキュリティルール実装

#### ✅ 2. 管理画面からの招待操作

- ✅ 従業員台帳行に「招待」ボタン
- ✅ 「招待リンクコピー」機能を実装（メール送信は Phase3 以降）

### Phase 3（セキュリティ・認証の強化）

#### 1. 事業所参加フローの見直し

- `/office-setup` から「既存事業所一覧から自由参加」をやめる／非推奨化する
- 事業所参加は基本「招待リンク」で行う

#### 2. Email/Password 認証の追加

- Firebase Auth で Email/Password を有効化
- ログイン画面の UI を拡張（Google + メールの2択）

### Phase 4（将来：複数事業所対応）

#### 1. `officeMemberships` モデルへの移行

- `users/{uid}` に `officeMemberships` を導入
- `officeId` 単一から複数対応へ段階的に移行
- `CurrentUserService` / `officeGuard` / `roleGuard` のロジックを対応
- 既存データの移行スクリプトを作成（Functions など）

---








## 8. 実装スコープ（今回の提出視点）

今回の提出（〜12/10）視点では、**Phase 1〜2 の一部まで**を現実的な範囲とし、**Phase 3〜4 は設計メモ＆カタログの将来拡張**として位置づけるイメージ。

### 優先実装項目

1. ✅ **Phase 1-1**: employee ロールの `/me` 限定アクセス
2. ✅ **Phase 1-2**: 従業員台帳に `portal.status` 表示
3. ✅ **Phase 2-1**: 従業員ポータル招待の基本機能（実装完了）
4. ✅ **Phase 2-2**: 管理画面からの招待操作（実装完了）

### 将来拡張項目（設計メモ）

- Phase 3: 事業所参加フローの見直し、Email/Password 認証
- Phase 4: 複数事業所対応（`officeMemberships`）

---

## 9. 注意事項・制約

### 9-1. 既存データとの互換性

- 現状の `UserProfile` 構造（単一 `officeId`）は維持する
- 既存ユーザーのデータ移行は不要
- `Employee.portal` フィールドは任意（既存データには影響しない）

### 9-2. セキュリティ考慮事項

- トークンの有効期限は適切に設定（例：7日間）
- トークンは1回使用後は無効化（`used: true`）
- `invitedEmail` と `user.email` の整合性チェックは必須（ただし、大文字小文字の違いなどは許容）

### 9-3. パフォーマンス考慮事項

- `employeePortalInvites` コレクションは `expiresAt` でインデックスを張る
- 古いトークンは定期的にクリーンアップ（Cloud Functions でスケジュール実行）

---

## 10. 関連ドキュメント

- `IMPLEMENTATION_GUIDE_PHASE3-15.md`: 口座情報・給与情報管理機能（従業員マイページの拡張）
- `IMPLEMENTATION_PLAN_PHASE3.md`: Phase3 の実装計画全体
- `IMPLEMENTATION_CATALOG.md`: 機能カタログ（将来拡張項目の記載）

---

以上で、InsurePath の認証・ロール・従業員ポータル方針の決定版ドラフトは完了です。

実装時は、この方針に従って段階的に機能を追加していきます。

