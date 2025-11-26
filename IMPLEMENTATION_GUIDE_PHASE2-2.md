# Phase2-2 実装指示書: ロール割り当てとユーザー管理の改善

## 📋 概要

Phase2-1で実装したFirestoreセキュリティルールとAngular側の`roleGuard`により、ロール別のアクセス制御は機能していますが、**ロールの初期値・ライフサイクルの仕様が整っておらず、セキュリティ意図とズレている**状態です。

**目的**: 
- 「ログインしただけで全員 admin になる」現状を解消し、安全で自然なロール割り当てにする
- 「誰がどの事業所の何ロールか」を管理画面から明示的にコントロールできるようにする
- Firestore ルールでのロール制御（Phase2-1）と、ロールのライフサイクル仕様をきちんと揃える

**このフェーズで達成したいゴール**:
- 新規ユーザーは`role: 'employee'`、`officeId`フィールドを持たない（未所属）状態で初期化される
- 新規事業所を作成したユーザーは、そのオフィスの「初代 admin」として自動的に昇格する
- 既存ユーザーの`role`・`officeId`は変更されない（後方互換性を保つ）
- オフィス作成完了後、`/dashboard`などの業務画面に問題なくアクセスできる
- Firestoreルールの`belongsToOffice(officeId)` / `isInsureAdmin(officeId)`と整合性が取れている

**前提条件**:
- Phase2-1（セキュリティ・アクセス制御の強化）が実装済み
- `UserProfile`型に`role`、`officeId`、`employeeId`フィールドが存在する
- Firestoreルールで`currentUser()`、`getUserRole()`、`belongsToOffice()`等の関数が実装済み

---

## 🧭 スコープ

### 対象とする機能・ファイル

#### ログイン時ユーザー初期化
- `src/app/services/auth.service.ts`
  - `ensureUserDocument`メソッドの修正（新規ユーザーの初期値を`role: 'employee'`、`officeId`フィールドを持たせない状態に変更）

#### 事業所作成フロー
- `src/app/pages/office-setup/office-setup.page.ts`
  - `createOffice`メソッドの修正（オフィス作成成功後に`users/{uid}`を`admin` + `officeId`で更新）
  - ナビゲーション先の確認（`/dashboard`への遷移が適切か）

#### ユーザープロファイル管理
- `src/app/services/current-user.service.ts`
  - `assignOffice`メソッドの動作確認（既存オフィスへの参加時は`role`を変更しない）
  - プロファイル更新後のローカルキャッシュ更新が適切か

### 対象外とするもの

以下の機能はPhase2-2では対象外とします：
- ユーザー管理画面（ユーザー一覧 + ロール/事業所変更 UI）の実装（将来のフェーズで実装予定）
- 既存ユーザーのロールマイグレーション機能（別フェーズで検討）
- 「最後の admin を消さない」制約の実装（将来の拡張として検討）
- Firestoreルールの変更（原則として変更しない。必要に応じて微修正の候補を記載）

---

## 📝 現状の挙動と課題

### 1. ログイン時ユーザー初期化（`auth.service.ts`）

**現状の挙動**:
- `ensureUserDocument`メソッド（33-68行目）で、`users/{uid}`ドキュメントが存在しない場合に新規作成している
- **問題点**: 42行目で`role: (snapshot.exists() ? snapshot.data()['role'] : 'admin')`として、新規ユーザーの`role`を強制的に`'admin'`に設定している
- `officeId`は既存ユーザーの場合は保持し、新規ユーザーの場合は`undefined`として削除している（63-65行目）

**課題**:
- すべての新規ユーザーが`admin`ロールで作成されるため、セキュリティ意図と一致していない
- Phase2-1で実装したFirestoreルールや`roleGuard`が正しく機能していても、初期ロールが`admin`のままだと意味がない

### 2. 事業所作成フロー（`office-setup.page.ts`）

**現状の挙動**:
- `createOffice`メソッド（278-300行目）で、`officesService.createOffice`を呼び出して事業所を作成
- その後、`currentUser.assignOffice(office.id)`を呼び出して`users/{uid}`を更新
- 最後に`/offices`に遷移している（292行目）

**課題**:
- `assignOffice`メソッド（`current-user.service.ts`の101-142行目）は、既存の`role`を保持する実装になっている（109行目: `const role = this.profileSubject.value?.role ?? 'admin'`）
- **問題点**: `profileSubject.value`が`null`の場合（ログイン直後でプロファイルがまだ読み込まれていない場合）、デフォルト値として`'admin'`が設定されてしまう可能性がある
- そのため、新規ユーザーが`employee`ロールで作成された場合でも、タイミングによっては`admin`になってしまうリスクがある
- 新規オフィス作成者は「初代 admin」として扱うべきだが、現状はその仕様が実装されていない

### 3. 既存オフィスへの参加フロー（`office-setup.page.ts`）

**現状の挙動**:
- `joinExistingOffice`メソッド（260-276行目）で、既存の事業所を選択して`assignOffice`を呼び出している
- その後、`/dashboard`に遷移している（268行目）

**確認事項**:
- `assignOffice`は既存の`role`を保持するため、`employee`ロールのユーザーが既存オフィスに参加しても`employee`のまま
- これは意図通り（既存オフィスへの参加時は`role`を変更しない）だが、Phase2-2の要件と一致していることを確認

### 4. Guard と Firestore ルールとの関係

**現状の挙動**:
- `officeGuard`: `officeId`がない場合は`/office-setup`にリダイレクト（`app.routes.ts`の19行目などで使用）
- `roleGuard`: 指定されたロールを持っているかチェック（例: `/dashboard`は`['admin', 'hr']`のみ）
- Firestoreルール: `belongsToOffice(officeId)`は`currentUser().data.officeId == officeId`でチェック

**確認事項**:
- オフィス作成完了後、`users/{uid}`の`officeId`と`role`が更新される
- その後、`CurrentUserService.profile$`が更新され、`officeGuard`と`roleGuard`が正しく動作する
- Firestoreルールも更新された`users/{uid}`を参照して、アクセス制御が正しく機能する

---

## 📝 仕様（Before / After）

### 1. 新規ログイン時の挙動

#### Before（現状）
```
1. Firebase Auth でログイン
2. ensureUserDocument が呼ばれる
3. users/{uid} が存在しない場合:
   - role: 'admin' で作成
   - officeId: undefined（削除される）
4. 結果: すべての新規ユーザーが admin として扱われる
```

#### After（Phase2-2実装後）
```
1. Firebase Auth でログイン
2. ensureUserDocument が呼ばれる
3. users/{uid} が存在しない場合:
   - role: 'employee' で作成
   - officeId: フィールド自体を持たせない（undefined として削除）
   - employeeId: フィールド自体を持たせない（undefined として削除）
4. 結果: 新規ユーザーは employee として初期化され、どの事業所にも属さない
```

**重要**: Firestoreルールの`validInsureUserProfile`関数では、`officeId`と`employeeId`は「存在しなければOK」「存在するなら string であること」というチェックになっている。`null`を設定すると`d.officeId is string`が`false`になってルール違反になるため、**フィールド自体を持たせない（undefined → 削除）**運用にする。

#### 既存ユーザーの場合
```
1. Firebase Auth でログイン
2. ensureUserDocument が呼ばれる
3. users/{uid} が存在する場合:
   - 既存の role / officeId / employeeId を保持
   - displayName / email / updatedAt のみ更新
4. 結果: 既存ユーザーの role / officeId は変更されない（後方互換性を保つ）
```

### 2. 新規事業所作成フローの挙動

#### Before（現状）
```
1. /office-setup で事業所を作成
2. officesService.createOffice を呼び出し
3. currentUser.assignOffice(office.id) を呼び出し
   - assignOffice は既存の role を保持する
   - 新規ユーザー（employee）の場合、employee のまま
4. /offices に遷移
5. 結果: roleGuard(['admin']) で弾かれる可能性がある
```

#### After（Phase2-2実装後）
```
1. /office-setup で事業所を作成
2. officesService.createOffice を呼び出し
3. オフィス作成成功後、users/{uid} を更新:
   - officeId = 作成した officeId
   - role = 'admin'（初代 admin に昇格）
   - updatedAt = 現在時刻
4. CurrentUserService のローカルキャッシュも更新
5. /dashboard に遷移（または /offices でも可）
6. 結果: officeGuard / roleGuard(['admin', 'hr']) を問題なくパスできる
```

### 3. 既存オフィスへの参加フローの挙動

#### Before / After（変更なし）
```
1. /office-setup で既存オフィスを選択
2. currentUser.assignOffice(officeId) を呼び出し
   - assignOffice は既存の role を保持する
   - employee ロールのユーザーは employee のまま
3. /dashboard に遷移
4. 結果: roleGuard(['admin', 'hr']) で弾かれる（employee は /me のみアクセス可能）
```

**注意**: 既存オフィスへの参加時は`role`を変更しない。これは意図通り（admin が明示的にロールを変更する必要がある）。

### 4. Guard と Firestore ルールとの関係

#### タイミングと整合性

**オフィス作成完了後の状態遷移**:
```
1. offices/{officeId} が作成される（Firestore）
2. users/{uid} が更新される（officeId, role = 'admin', updatedAt）
3. CurrentUserService.profile$ が更新される（ローカルキャッシュ）
4. officeGuard が評価される:
   - profile.officeId が存在する → true
5. roleGuard(['admin', 'hr']) が評価される:
   - profile.role === 'admin' → true
6. Firestore ルールが評価される:
   - belongsToOffice(officeId) → currentUser().data.officeId == officeId → true
   - isInsureAdmin(officeId) → getUserRole() == 'admin' → true
```

**重要なポイント**:
- `users/{uid}`の更新と`CurrentUserService`のローカルキャッシュ更新を確実に行う
- ナビゲーション前にプロファイルが更新されていることを保証する（`await`を使用）
- Firestoreルールは`currentUser()`で`users/{uid}`を取得するため、更新が反映されるまで若干の遅延がある可能性がある（通常は問題ない）

---

## 🔧 実装方針・ステップ

### Step 1: `auth.service.ts`の`ensureUserDocument`メソッドを修正

**目的**: 新規ユーザーの初期値を`role: 'employee'`、`officeId`フィールドを持たせない状態にする

**変更箇所**:
- 42行目の`role`の初期値を`'admin'`から`'employee'`に変更
- 新規ユーザー作成時に`officeId`と`employeeId`は`undefined`として削除する（既存の実装を維持）

**実装方針**:
```typescript
// 変更前（42行目）
role: (snapshot.exists() ? snapshot.data()['role'] : 'admin') as UserProfile['role'],

// 変更後
role: (snapshot.exists() ? snapshot.data()['role'] : 'employee') as UserProfile['role'],
```

**注意事項**:
- 既存ユーザー（`snapshot.exists()`が`true`）の場合は、既存の`role`を保持する（変更しない）
- `officeId`と`employeeId`は、新規ユーザーの場合は`undefined`として削除する（既存の実装を維持）
- Firestoreは`undefined`を受け付けないため、`dataToSave`から`undefined`のフィールドを削除する処理（63-65行目）は維持する
- **重要**: Firestoreルールの`validInsureUserProfile`関数では、`officeId`と`employeeId`は「存在しなければOK」「存在するなら string であること」というチェックになっている。`null`を設定するとルール違反になるため、**フィールド自体を持たせない（undefined → 削除）**運用を維持する

### Step 2: `office-setup.page.ts`の`createOffice`メソッドを修正

**目的**: オフィス作成成功後に、作成者を`admin`ロールに昇格させる

**変更箇所**:
- 291行目の`assignOffice`呼び出しを、専用のメソッド呼び出しに変更
- または、`assignOffice`の後に`updateProfile`を呼び出して`role: 'admin'`を設定

**実装方針（案1: `updateProfile`を使用）**:
```typescript
// 変更前（291行目）
await this.currentUser.assignOffice(office.id);

// 変更後
await this.currentUser.assignOffice(office.id);
await this.currentUser.updateProfile({ role: 'admin' });
```

**実装方針（案2: 専用メソッドを作成）**:
- `CurrentUserService`に`assignOfficeAsAdmin(officeId: string)`のような専用メソッドを追加
- このメソッド内で`officeId`と`role: 'admin'`を同時に更新する

**推奨**: 案1（`updateProfile`を使用）の方がシンプルで、既存のメソッドを活用できる

**将来的な拡張案**（Phase2-2では実装しない）:
- 将来的に`assignOfficeAsAdmin`のような専用メソッドを追加することで、コードがより明確になる可能性がある
- ただし、現時点では`assignOffice`と`updateProfile`を併用する方が、`CurrentUserService`の責務が散らからないため、案1を推奨する

**ナビゲーション先の確認**:
- 292行目で`/offices`に遷移しているが、`roleGuard(['admin'])`が適用されている
- オフィス作成後は`role: 'admin'`に更新されるため、`/offices`にアクセス可能
- ただし、`/dashboard`に遷移する方が自然かもしれない（ユーザーの期待に沿う）
- **推奨**: `/dashboard`に変更するか、現状の`/offices`のままでも可（どちらでも動作する）

**エラーハンドリング**:
- オフィス作成が成功したが、`users/{uid}`の更新が失敗した場合の処理を考慮する
- トランザクションは使用しない（Firestoreのトランザクションは同一ドキュメントまたは関連ドキュメントのみ）
- エラー時は、オフィス作成をロールバックするか、エラーメッセージを表示するかを検討する
- **推奨**: エラー時は`users/{uid}`の更新をリトライするか、エラーメッセージを表示してユーザーに再試行を促す

### Step 3: `current-user.service.ts`の`assignOffice`メソッドのデフォルトロールを修正

**目的**: `assignOffice`メソッドのデフォルトロールを`'admin'`から`'employee'`に変更し、予期せぬ admin 昇格を防ぐ

**変更箇所**:
- 109行目の`const role = this.profileSubject.value?.role ?? 'admin';`を`const role = this.profileSubject.value?.role ?? 'employee';`に変更

**問題点**:
- ログイン直後、`CurrentUserService.profile$`の購読がまだ反映される前に`assignOffice`が呼ばれると、`this.profileSubject.value`が`null`のまま
- `?? 'admin'`が効いて、意図せず`admin`にされてしまう可能性がある
- 特に「既存オフィスに employee として参加させるつもりだったのに、タイミングによっては admin になってしまう」という挙動が起こりうる

**実装方針**:
```typescript
// 変更前（109行目）
const role = this.profileSubject.value?.role ?? 'admin';

// 変更後
const role = this.profileSubject.value?.role ?? 'employee';
```

**理由**:
- 「プロファイルがまだ取れていない場合は employee 扱い」が今の仕様に合っている
- 新規オフィス作成時は、別途`updateProfile({ role: 'admin' })`を呼ぶので問題なし
- 既存 admin / hr / employee は`profileSubject.value.role`によってちゃんと維持される

**確認事項**:
- `assignOffice`メソッドは、既存オフィスへの参加時は`role`を変更しない（既存の`role`を保持する）
- これは既存オフィスへの参加時は`role`を変更しないという仕様と一致している

**プロファイル更新後のローカルキャッシュ更新**:
- `assignOffice`メソッド（133-141行目）で、ローカルキャッシュ（`profileSubject`）を更新している
- `updateProfile`メソッド（155-158行目）でも、ローカルキャッシュを更新している
- **確認**: 両方のメソッドでローカルキャッシュが更新されているため、`officeGuard`や`roleGuard`が即座に反映される

**必要に応じた修正**:
- `updateProfile`メソッドが`role`の更新に対応しているか確認（既に対応済み）
- プロファイル更新後に`profile$`が再購読されることを確認（`BehaviorSubject`を使用しているため、自動的に再購読される）

### Step 4: エラーハンドリングとロールバックの検討

**目的**: オフィス作成とユーザープロファイル更新の整合性を保つ

**検討事項**:
- オフィス作成が成功したが、`users/{uid}`の更新が失敗した場合の処理
- Firestoreのトランザクションは使用できない（`offices/{officeId}`と`users/{uid}`は異なるコレクション）
- **推奨**: エラー時は`users/{uid}`の更新をリトライするか、エラーメッセージを表示してユーザーに再試行を促す

**実装方針**:
```typescript
try {
  const office = await this.officesService.createOffice({ ... });
  await this.currentUser.assignOffice(office.id);
  await this.currentUser.updateProfile({ role: 'admin' });
  // 成功時の処理
} catch (error) {
  // エラー時の処理（オフィス作成は成功しているが、users/{uid}の更新が失敗した場合）
  // オフィスを削除するか、エラーメッセージを表示する
}
```

**注意**: オフィス作成後に`users/{uid}`の更新が失敗した場合、オフィスは作成されているがユーザーは`admin`になっていない状態になる。この場合、手動で`users/{uid}`を更新するか、再試行を促す必要がある。

---

## ✅ 受け入れ条件（テスト観点）

### テストケース 1: まっさらな新規ユーザーがログイン → オフィス作成 → admin に昇格 → `/dashboard`へアクセス可能

**前提条件**:
- Firebase Auth で新規アカウントを作成
- `users/{uid}`ドキュメントが存在しない

**実行手順**:
1. Google でログイン
2. `/office-setup`に遷移（`needsOfficeGuard`により自動遷移）
3. 新規事業所を作成
4. `/dashboard`に遷移（または`/offices`に遷移）

**期待結果**:
- ✅ `users/{uid}`が`role: 'employee'`、`officeId`フィールドを持たない状態で作成される
- ✅ オフィス作成後、`users/{uid}`が`role: 'admin'`、`officeId: <作成したofficeId>`に更新される
- ✅ `/dashboard`にアクセス可能（`officeGuard`と`roleGuard(['admin', 'hr'])`をパス）
- ✅ `/offices`にアクセス可能（`roleGuard(['admin'])`をパス）
- ✅ Firestoreルールで`belongsToOffice(officeId)`と`isInsureAdmin(officeId)`が`true`になる

### テストケース 2: 既存の admin ユーザーがログイン → これまでどおりダッシュボード等にアクセス可能

**前提条件**:
- 既存の`users/{uid}`ドキュメントが存在し、`role: 'admin'`、`officeId: <既存のofficeId>`が設定されている

**実行手順**:
1. Google でログイン
2. `/dashboard`にアクセス

**期待結果**:
- ✅ `users/{uid}`の`role`と`officeId`が変更されない（既存の値が保持される）
- ✅ `/dashboard`にアクセス可能
- ✅ `/offices`にアクセス可能
- ✅ 既存のデータに影響がない

### テストケース 3: 新規ユーザーがログインするがオフィスを作成しない → `role: 'employee'` かつ `officeId`フィールドなしのまま → guard により業務画面には入れず、`/office-setup`に誘導される

**前提条件**:
- Firebase Auth で新規アカウントを作成
- `users/{uid}`ドキュメントが存在しない

**実行手順**:
1. Google でログイン
2. `/dashboard`に直接アクセスしようとする

**期待結果**:
- ✅ `users/{uid}`が`role: 'employee'`、`officeId`フィールドを持たない状態で作成される
- ✅ `officeGuard`により`/office-setup`にリダイレクトされる
- ✅ `/office-setup`では既存オフィスを選択できるが、`role`は`employee`のまま
- ✅ 既存オフィスに参加しても`role`は`employee`のまま（`/dashboard`にはアクセスできない）
- ✅ `assignOffice`のデフォルトロールが`'employee'`になっているため、プロファイルが読み込まれる前でも予期せぬ`admin`昇格が起きない

### テストケース 4: エラーケース - オフィス作成は成功したが、`users/{uid}`の更新が失敗した場合

**前提条件**:
- Firebase Auth でログイン済み
- `users/{uid}`ドキュメントが存在する（`role: 'employee'`、まだどの事業所にも所属していない状態）

**実行手順**:
1. `/office-setup`で新規事業所を作成
2. オフィス作成は成功するが、`users/{uid}`の更新が失敗する（ネットワークエラーなど）

**期待結果**:
- ✅ オフィスは作成されている
- ✅ `users/{uid}`は`role: 'employee'`、`officeId`フィールドを持たない状態のまま
- ✅ エラーメッセージが表示される
- ✅ ユーザーに再試行を促すか、手動で`users/{uid}`を更新する必要がある

**注意**: このケースは稀だが、実装時にエラーハンドリングを考慮する必要がある。

### テストケース 5: 既存オフィスへの参加時は`role`が変更されない

**前提条件**:
- Firebase Auth でログイン済み
- `users/{uid}`ドキュメントが存在する（`role: 'employee'`、`officeId: null`）
- 既存のオフィスが存在する

**実行手順**:
1. `/office-setup`で既存オフィスを選択
2. `joinExistingOffice`を実行

**期待結果**:
- ✅ `users/{uid}`が`officeId: <選択したofficeId>`に更新される
- ✅ `role`は`employee`のまま（変更されない）
- ✅ `/dashboard`にはアクセスできない（`roleGuard(['admin', 'hr'])`で弾かれる）
- ✅ `/me`にはアクセス可能（`roleGuard`なし）

---

## ⚠️ 注意点・今後の拡張

### 1. Firestoreルールとの整合性

**現状**:
- Phase2-1で実装したFirestoreルールは、`currentUser()`で`users/{uid}`を取得して`role`や`officeId`をチェックしている
- Phase2-2では`users/{uid}`の初期値と更新ロジックを変更するが、Firestoreルール自体は変更しない

**確認事項**:
- `users/{uid}`が`role: 'employee'`、`officeId`フィールドを持たない状態で作成された場合、Firestoreルールの`belongsToOffice(officeId)`は`false`になる（意図通り）
- オフィス作成後、`users/{uid}`が`role: 'admin'`、`officeId: <officeId>`に更新されると、Firestoreルールが正しく機能する

**Firestoreルールとの整合性**:
- `validInsureUserProfile`関数では、`officeId`と`employeeId`は「存在しなければOK」「存在するなら string であること」というチェックになっている
- `null`を設定すると`d.officeId is string`が`false`になってルール違反になるため、**フィールド自体を持たせない（undefined → 削除）**運用を維持する必要がある
- 現状の実装（`undefined`のフィールドを削除する処理）で問題ないため、Phase2-2では変更しない

### 2. 1ユーザーが複数オフィスを持てるかどうか

**現状**:
- `UserProfile`型の`officeId`は`string | undefined`で、1つのオフィスにのみ所属できる設計
- Phase2-2では、この設計を維持する（複数オフィス対応は将来の拡張として検討）

**今後の拡張**:
- 複数オフィス対応が必要になった場合、`officeId`を配列にするか、`memberships`のようなサブコレクションを使用する設計変更が必要
- 現時点では、この設計変更はPhase2-2のスコープ外とする

### 3. 本格的なユーザー管理画面の実装

**現状**:
- Phase2-2では、ロールの初期値とオフィス作成時の昇格ロジックのみを実装する
- ユーザー管理画面（ユーザー一覧 + ロール/事業所変更 UI）は実装しない

**今後の拡張**:
- ユーザー管理画面では、admin が以下の操作をできるようにする:
  - 任意の`users`ドキュメントに対して`officeId`を自分のオフィス ID に設定する
  - `role`を`'admin' | 'hr' | 'employee'`のいずれかに変更する
  - `employeeId`を設定する（`employee`ロールの場合）
- この機能は将来のフェーズで実装予定

### 4. 既存ユーザーのロールマイグレーション

**現状**:
- Phase2-2では、既存ユーザーの`role`・`officeId`は変更しない（後方互換性を保つ）
- 既存の admin テストアカウントなどが壊れないようにする

**今後の拡張**:
- 既存ユーザーのロールを一括で変更するマイグレーションツールが必要になった場合、別フェーズで実装する
- マイグレーション時は、各ユーザーの`role`を適切な値に変更する必要がある

### 5. 「最後の admin を消さない」制約の実装

**現状**:
- Phase2-2では、この制約は実装しない
- オフィス作成時は自動的に`admin`に昇格するため、各オフィスに少なくとも1人の admin が存在する状態からスタートする

**今後の拡張**:
- ユーザー管理画面でロール変更を行う際に、「最後の admin を消さない」制約を実装する
- 実装時は、`offices/{officeId}/members`のようなサブコレクションで admin の数をカウントするか、`users`コレクションをクエリして admin の数を確認する必要がある

### 6. `employee`ロールと`employeeId`の関係

**現状**:
- Phase2-2では、`employee`ロールのユーザーに`employeeId`を自動的に設定する機能は実装しない
- `assignOffice`メソッドで、メールアドレスから`employeeId`を検索する機能は既に実装されているが、これは既存オフィスへの参加時に使用される

**今後の拡張**:
- `employee`ロールに設定する際に、同じ`officeId`配下の従業員レコードから1件を選んで`employeeId`に設定する機能を実装する
- これは UI 側のバリデーションで対応し、必要であれば Firestore ルールでの厳密チェックは別フェーズで追加する

---

## 📝 実装チェックリスト

### `auth.service.ts`
- [ ] `ensureUserDocument`メソッドの`role`の初期値を`'admin'`から`'employee'`に変更
- [ ] 既存ユーザーの`role`が変更されないことを確認（`snapshot.exists()`の場合は既存の`role`を保持）
- [ ] 新規ユーザーの`officeId`と`employeeId`が`undefined`として削除されることを確認（既存の実装を維持）
- [ ] Firestoreルールとの整合性を確認（`null`ではなくフィールド自体を持たせない運用）

### `office-setup.page.ts`
- [ ] `createOffice`メソッドで、オフィス作成成功後に`updateProfile({ role: 'admin' })`を呼び出す
- [ ] エラーハンドリングを追加（オフィス作成は成功したが、`users/{uid}`の更新が失敗した場合）
- [ ] ナビゲーション先を確認（`/dashboard`または`/offices`のどちらが適切か検討）

### `current-user.service.ts`
- [ ] `assignOffice`メソッドのデフォルトロールを`'admin'`から`'employee'`に変更（109行目）
- [ ] `assignOffice`メソッドが既存オフィスへの参加時に`role`を変更しないことを確認（既存の`role`を保持）
- [ ] `updateProfile`メソッドが`role`の更新に対応していることを確認（既に対応済み）
- [ ] プロファイル更新後のローカルキャッシュ更新が適切に行われることを確認（既に対応済み）

### テスト・確認
- [ ] テストケース 1: 新規ユーザーがログイン → オフィス作成 → admin に昇格 → `/dashboard`へアクセス可能
- [ ] テストケース 2: 既存の admin ユーザーがログイン → これまでどおりダッシュボード等にアクセス可能
- [ ] テストケース 3: 新規ユーザーがログインするがオフィスを作成しない → guard により業務画面には入れず、`/office-setup`に誘導される
- [ ] テストケース 4: エラーケース - オフィス作成は成功したが、`users/{uid}`の更新が失敗した場合
- [ ] テストケース 5: 既存オフィスへの参加時は`role`が変更されない

---

## 🎨 参考実装

以下のファイルを参考にしてください：

- `src/app/services/auth.service.ts` - 既存の`ensureUserDocument`実装
- `src/app/services/current-user.service.ts` - 既存の`assignOffice`と`updateProfile`実装
- `src/app/pages/office-setup/office-setup.page.ts` - 既存のオフィス作成フロー
- `src/app/guards/office.guard.ts` - 既存の`officeGuard`実装
- `src/app/guards/role.guard.ts` - 既存の`roleGuard`実装（Phase2-1で実装）
- `firestore.rules` - 既存のFirestoreルール（Phase2-1で実装）

---

## 📌 補足事項

### 1. プロファイル更新のタイミング

**実装時の注意**:
- `assignOffice`と`updateProfile`を連続で呼び出す場合、`await`を使用して順序を保証する
- `CurrentUserService`のローカルキャッシュ（`profileSubject`）が更新されるまで、ナビゲーションを待つ必要はない（`BehaviorSubject`を使用しているため、自動的に反映される）

### 2. Firestoreルールの評価タイミング

**実装時の注意**:
- Firestoreルールは`currentUser()`で`users/{uid}`を取得するため、更新が反映されるまで若干の遅延がある可能性がある
- 通常は問題ないが、オフィス作成直後にFirestoreへのアクセスを行う場合、ルールが正しく評価されることを確認する

### 3. エラーハンドリングの方針

**実装時の注意**:
- オフィス作成と`users/{uid}`の更新は、Firestoreのトランザクションでは扱えない（異なるコレクション）
- エラー時は、エラーメッセージを表示してユーザーに再試行を促すか、手動で`users/{uid}`を更新する必要がある
- オフィス作成後に`users/{uid}`の更新が失敗した場合、オフィスは作成されているがユーザーは`admin`になっていない状態になる

---

以上で実装指示書は完了です。不明点があれば確認してください。

