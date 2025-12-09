# HRロール実装 ＆ ユーザー管理UI追加 実装指示書

**ファイル名**: `IMPLEMENTATION_ROLE_PHASE1.md`  
**作成日**: 2024年  
**対象**: InsurePath（社会保険管理システム）

---

## 1. 概要・目的

### 1.1 実装の目的

カタログ(2)「ユーザー・ロール管理機能」に合わせて、HRロールを実務的に使えるようにし、管理者がユーザーのロールを変更できるUIを追加する。

### 1.2 目標状態

- 全ユーザーは `users/{uid}` に以下を持つ：
  - `officeId: string`（所属事業所）
  - `role: 'admin' | 'hr' | 'employee'`（ロール）
  - `employeeId?: string`（従業員レコードとの紐づけ、任意）

- ロールと employeeId に応じた動作：
  - **admin（管理者）**
    - 事業所設定・従業員台帳・保険料・マスタ・ダッシュボードなどを編集可能
    - 自分が従業員レコードに紐づいていれば `/me` で自分のマイページも閲覧可
    - ユーザー管理タブから他ユーザーのロールを変更可能
  
  - **hr（人事担当者）**
    - 従業員台帳・保険料計算・手続き関連など、admin に近い業務権限を持つ
    - ただしシステム管理寄りの設定（事業所基本設定、クラウドマスタなど）は admin 優先
    - 自分が従業員レコードに紐づいていれば `/me` で自分のマイページも閲覧可
    - ユーザー管理タブは表示されない／編集不可
  
  - **employee（一般従業員）**
    - `/me`（マイページ）のみ利用可（閲覧＋変更申請）
    - 他人の台帳や保険料は閲覧不可

### 1.3 実装の前提

- `/me` のガードは既に `hasEmployeeIdGuard` で `employeeId` ベースに実装済み
- `accept-invite.page.ts` で既存ロールを維持する仕組みは実装済み
- サイドバーメニューの「マイページ」表示条件も `employeeId` ベースに実装済み

---

## 2. 対象ファイル

### 2.1 Firestore ルール

**ファイル**: `firestore.rules`

**修正箇所**:
- `isInsureEmployee()` 関数の定義（58-60行目付近）
- `isInsureEmployee()` を使用している各ルール（14箇所）
- `match /users/{uid}` の update ルール（447-450行目付近）

**目的**:
- `isInsureEmployee()` を role ベースから `employeeId` ベースに変更
- admin による他ユーザーの role 更新権限を追加

### 2.2 ルーティング・ガード

**ファイル**: `src/app/app.routes.ts`

**確認箇所**:
- `/me` ルートのガード設定（60-62行目）
- `/offices` ルートのガード設定（24-26行目）

**目的**:
- `/me` のガードが `hasEmployeeIdGuard` になっていることを確認（既に実装済み）
- `/offices` のガードが `roleGuard(['admin'])` になっていることを確認

**ファイル**: `src/app/guards/has-employee-id.guard.ts`

**確認箇所**:
- `employeeId` の有無で判定していることを確認（既に実装済み）

### 2.3 サービス

**ファイル**: `src/app/services/current-user.service.ts`

**確認箇所**:
- `profile$` が `UserProfile` を返すことを確認
- `updateProfile()` メソッドが存在することを確認

**新規作成**: `src/app/services/users.service.ts`

**目的**:
- 事業所に属するユーザー一覧を取得するメソッド
- 他ユーザーの role を更新するメソッド

### 2.4 UI コンポーネント

**ファイル**: `src/app/pages/offices/offices.page.ts`

**修正箇所**:
- タブUIの追加（Material Tabs を使用）
- 「ユーザー管理」タブの追加
- ユーザー一覧表示コンポーネントの追加

**新規作成**: `src/app/pages/offices/user-management-tab.component.ts`

**目的**:
- ユーザー一覧の表示
- ロール編集UI（`mat-select` を使用）
- 権限制御（admin のみ編集可能）

### 2.5 型定義

**ファイル**: `src/app/types.ts`

**確認箇所**:
- `UserProfile` インターフェース（89-98行目）
- `UserRole` 型定義

**目的**:
- `UserProfile` に `employeeId?: string` が含まれていることを確認（既に実装済み）

---

## 3. Firestore ルール（共通ユーティリティ）の変更方針

### 3.1 `isInsureEmployee()` 関数の変更

**現状**:
```javascript
// 一般従業員かチェック
function isInsureEmployee(officeId) {
  return belongsToOffice(officeId) && getUserRole() == 'employee';
}
```

**変更後**:
```javascript
// その事業所に属していて、かつ、自分の employeeId を持っているユーザーかチェック
function isInsureEmployee(officeId) {
  return belongsToOffice(officeId)
    && ('employeeId' in currentUser().data)
    && (currentUser().data.employeeId is string)
    && currentUser().data.employeeId.size() > 0;
}
```

**変更の意図**:
- role が `'employee'` かどうかではなく、`employeeId` が設定されているかで判定
- これにより、admin/hr でも `employeeId` が設定されていれば「自分の従業員レコードに紐づくデータ」にアクセス可能になる

**注意**: 既存の `isInsureAdmin(officeId)` 関数（53-55行目）はそのまま使用可能。`isAdminOrHr()` ではなく、admin 専用の `isInsureAdmin()` を使用すること。

### 3.2 `isInsureEmployee()` を使用しているルールの確認

以下のコレクションで `isInsureEmployee()` を使用しているため、変更後の動作を確認：

#### 3.2.1 月次保険料（`monthlyPremiums`）

**現状**:
```javascript
allow read: if belongsToOffice(officeId) && (
  isAdminOrHr(officeId) || 
  (isInsureEmployee(officeId) && resource.data.employeeId == currentUser().data.employeeId)
);
```

**変更後の動作**:
- admin/hr: **引き続き全従業員の月次保険料を閲覧可能**（従来通り）
- employeeId が設定されているユーザー（admin/hr/employee 問わず）: **自分の月次保険料を「従業員として」も閲覧可能**
- つまり、admin/hr で employeeId がある場合は「全員分」も「自分の分」も両方見られる

#### 3.2.2 賞与保険料（`bonusPremiums`）

**現状**: 月次保険料と同様の構造

**変更後の動作**:
- admin/hr: **引き続き全従業員の賞与保険料を閲覧可能**（従来通り）
- employeeId が設定されているユーザー（admin/hr/employee 問わず）: **自分の賞与保険料を「従業員として」も閲覧可能**
- つまり、admin/hr で employeeId がある場合は「全員分」も「自分の分」も両方見られる

#### 3.2.3 社会保険手続き履歴（`procedures`）

**現状**:
```javascript
allow read: if belongsToOffice(officeId) && (
  isAdminOrHr(officeId) ||
  (isInsureEmployee(officeId) && resource.data.employeeId == currentUser().data.employeeId)
);
```

**変更後の動作**:
- admin/hr: **引き続き全従業員の手続き履歴を閲覧可能**（従来通り）
- employeeId が設定されているユーザー（admin/hr/employee 問わず）: **自分の手続き履歴を「従業員として」も閲覧可能**
- つまり、admin/hr で employeeId がある場合は「全員分」も「自分の分」も両方見られる

#### 3.2.4 書類管理（`documents`）

**現状**: `isInsureEmployee()` を使用している箇所を確認

**変更後の動作**: employeeId が設定されているユーザーは自分の書類のみ閲覧可能

#### 3.2.5 変更申請（`changeRequests`）

**現状**: `isInsureEmployee()` を使用している箇所を確認

**変更後の動作**: employeeId が設定されているユーザーは自分の申請のみ閲覧・作成可能

### 3.3 `getUserRole() == 'employee'` でフィルタしている箇所の確認

**確認方法**: `firestore.rules` 内で `getUserRole() == 'employee'` を検索

**方針**:
- もし見つかった場合は、`isInsureEmployee()` への置き換えを検討
- ただし、特定のロールのみに許可したい場合は現状維持（例: 特定の管理機能は admin のみ）

---

## 4. `users/{uid}` の更新権限（ロール編集）

### 4.1 現状のルール

**ファイル**: `firestore.rules`（447-450行目付近）

```javascript
allow create, update: if
  isSignedIn()
  && request.auth.uid == uid
  && validInsureUserProfile(request.resource.data);
```

**現状**: 本人のみ更新可能

### 4.2 変更後のルール

**方針**: create と update を分けて、より安全で明確なルールにする

**理由**: create 時には `resource.data` が存在しないため、create と update を分けることで：
- create では `resource.data` に触らない（安全）
- update では `resource.data` と `diff()` を使う（明確）

```javascript
match /users/{uid} {
  // create: これまで通り「本人が自分のプロフィールを作るだけ」
  allow create: if
    isSignedIn()
    && request.auth.uid == uid
    && validInsureUserProfile(request.resource.data);

  // update: 本人 or admin による role 更新
  allow update: if
    isSignedIn()
    && (
      // パターン1: 本人による更新（従来通り）
      (
        request.auth.uid == uid
        && validInsureUserProfile(request.resource.data)
      )
      ||
      // パターン2: admin による role 更新のみ
      (
        isInsureAdmin(resource.data.officeId)
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['role', 'updatedAt'])
        && request.resource.data.role in ['admin', 'hr', 'employee']
        && request.resource.data.id == resource.data.id
        && request.resource.data.officeId == resource.data.officeId
        && request.resource.data.email == resource.data.email
        && request.resource.data.displayName == resource.data.displayName
        && (!('employeeId' in request.resource.data) || request.resource.data.employeeId == resource.data.employeeId)
        && request.resource.data.createdAt == resource.data.createdAt
      )
    );
}
```

**ポイント**:
- **`isInsureAdmin()` は既存のヘルパー関数（53-55行目）を使用**。`isAdminOrHr()` ではなく、admin 専用の `isInsureAdmin()` を使用すること（hr が role を変更できないようにするため）
- **`isInsureAdmin(resource.data.officeId)` により、「そのユーザードキュメントの `officeId` に対して admin か？」を判定**。`currentUser().data.officeId == resource.data.officeId` のチェックは不要（`isInsureAdmin()` 内で `belongsToOffice()` がチェックしているため）
- **create と update を分けることで、create 時には `resource.data` に触らない安全な構造になる**
- admin は同じ事業所のユーザーの role のみ変更可能（`isInsureAdmin(resource.data.officeId)` により自動的にチェックされる）
- 変更可能なキーは `role` と `updatedAt` のみに限定
- `id`, `officeId`, `email`, `employeeId`, `createdAt` などは変更不可
- `validInsureUserProfile()` の制約は維持（パターン1では従来通り）

### 4.3 既存の create / update ロジックとの整合性

**create（本人による作成）**:
- `AuthService.ensureUserDocument()` などで使用
- `validInsureUserProfile()` の制約を満たす必要がある
- create ルールは従来通りで問題なし

**update（本人による更新）**:
- `CurrentUserService.updateProfile()` を使用
- `validInsureUserProfile()` の制約を満たす必要がある

**update（admin による role 更新）**:
- 新規作成する `UsersService.updateUserRole()` を使用
- `role` と `updatedAt` のみを更新
- `resource.data` と `diff()` を使用するため、update ルールでのみ許可

**create と update を分ける利点**:
- create 時には `resource.data` が存在しないため、create ルールでは `resource.data` に触らない安全な構造になる
- update 時のみ `resource.data` と `diff()` を使用するため、ルールが明確で読みやすい

### 4.4 `/users/{uid}` の read ルールの追加

**現状**:
```javascript
allow read: if isSignedIn() && request.auth.uid == uid;
```

**問題点**: 現在は「自分の分だけ読み取り可」のため、ユーザー管理タブで同じ事業所のユーザー一覧を取得できない

**変更後**:
```javascript
allow read: if
  isSignedIn() && (
    // パターン1: 自分自身（従来通り）
    request.auth.uid == uid
    ||
    // パターン2: admin は自分が admin を務める事業所のユーザーのみ閲覧OK
    isInsureAdmin(resource.data.officeId)
  );
```

**ポイント**:
- **`get()` を使わず `resource.data` を使用することで、同じドキュメントを `get()` で読みに行く問題を回避**
- `isInsureAdmin(resource.data.officeId)` により、「そのユーザードキュメントの `officeId` に対して admin か？」を判定
- admin のみが同じ事業所のユーザーを読み取り可能
- hr は他のユーザーを読み取れない（ユーザー管理タブは admin 専用のため）
- 自分自身は引き続き読み取り可能
- クエリ（`where('officeId', '==', officeId)`）にも自然に対応できる

**実装前の確認事項**:
- この read ルールを追加しないと、`UsersService.getUsersByOfficeId()` で `FirebaseError: Missing or insufficient permissions.` が発生する
- 必ず read ルールと update ルールをセットで実装すること
- **`get()` を使わず `resource.data` を使用すること**。同じドキュメントを `get()` で読みに行くとエラーになる可能性がある

---

## 5. `/me`（マイページ）ルートガードの改善

### 5.1 現状確認

**ファイル**: `src/app/app.routes.ts`（60-62行目）

```typescript
{
  path: 'me',
  canActivate: [authGuard, officeGuard, hasEmployeeIdGuard],
  loadComponent: () => import('./pages/me/my-page').then((m) => m.MyPage)
}
```

**確認**: 既に `hasEmployeeIdGuard` が適用されている ✅

### 5.2 `hasEmployeeIdGuard` の実装確認

**ファイル**: `src/app/guards/has-employee-id.guard.ts`

**現状**:
- `profile.employeeId` の有無で判定
- `employeeId` がない場合は、ロールに応じてリダイレクト
  - admin/hr: `/dashboard` へ
  - employee: `/login` へ

**確認事項**: この実装で問題ないことを確認 ✅

### 5.3 テスト観点

- admin で `employeeId` がある場合: `/me` にアクセス可能
- admin で `employeeId` がない場合: `/dashboard` にリダイレクト
- hr で `employeeId` がある場合: `/me` にアクセス可能
- hr で `employeeId` がない場合: `/dashboard` にリダイレクト
- employee で `employeeId` がある場合: `/me` にアクセス可能
- employee で `employeeId` がない場合: `/login` にリダイレクト

---

## 6. 事業所設定ページへの「ユーザー管理」タブ追加

### 6.1 画面概要

**ファイル**: `src/app/pages/offices/offices.page.ts`

**追加内容**:
- Material Tabs を使用してタブUIを追加
- 「事業所設定」タブ（既存のフォーム）
- 「ユーザー管理」タブ（新規追加）

**タブ構成**:
```html
<mat-tab-group>
  <mat-tab label="事業所設定">
    <!-- 既存のフォーム -->
  </mat-tab>
  <mat-tab label="ユーザー管理" *ngIf="isAdmin()">
    <!-- ユーザー一覧テーブル -->
  </mat-tab>
</mat-tab-group>
```

### 6.2 ユーザー管理タブの実装

#### 6.2.1 新規コンポーネント作成

**ファイル**: `src/app/pages/offices/user-management-tab.component.ts`

**実装内容**:
- ユーザー一覧の取得（`UsersService` を使用）
- テーブル表示（Material Table を使用）
- ロール編集UI（`mat-select` を使用）
- 権限制御（admin のみ編集可能）

**テーブル列**:
- 表示名（`displayName`）
- メール（`email`）
- 現在ロール（`role`）
- employeeId（あれば表示）
- ロール編集（admin のみ表示・編集可能）

**テンプレート例**:
```html
<mat-table [dataSource]="users$ | async">
  <ng-container matColumnDef="displayName">
    <mat-header-cell *matHeaderCellDef>表示名</mat-header-cell>
    <mat-cell *matCellDef="let user">{{ user.displayName }}</mat-cell>
  </ng-container>
  
  <ng-container matColumnDef="email">
    <mat-header-cell *matHeaderCellDef>メール</mat-header-cell>
    <mat-cell *matCellDef="let user">{{ user.email }}</mat-cell>
  </ng-container>
  
  <ng-container matColumnDef="role">
    <mat-header-cell *matHeaderCellDef>ロール</mat-header-cell>
    <mat-cell *matCellDef="let user">
      <mat-select 
        [value]="user.role" 
        [disabled]="!canEditRole()"
        (selectionChange)="updateRole(user.id, $event.value)">
        <mat-option value="admin">管理者</mat-option>
        <mat-option value="hr">人事担当者</mat-option>
        <mat-option value="employee">一般従業員</mat-option>
      </mat-select>
    </mat-cell>
  </ng-container>
  
  <ng-container matColumnDef="employeeId">
    <mat-header-cell *matHeaderCellDef>従業員ID</mat-header-cell>
    <mat-cell *matCellDef="let user">{{ user.employeeId || '-' }}</mat-cell>
  </ng-container>
  
  <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
  <mat-row *matRowDef="let row; columns: displayedColumns"></mat-row>
</mat-table>
```

#### 6.2.2 権限制御

**UI側**:
- `canEditRole()` メソッドで `profile.role === 'admin'` をチェック
- admin 以外は `mat-select` を `disabled` にする

**Firestore ルール側**:
- 前述の `users/{uid}` の update ルールで admin のみ許可

### 6.3 データ取得・更新

#### 6.3.1 `UsersService` の作成

**ファイル**: `src/app/services/users.service.ts`

**実装メソッド**:
```typescript
@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(
    private readonly firestore: Firestore,
    private readonly currentUser: CurrentUserService
  ) {}

  /**
   * 指定事業所に属するユーザー一覧を取得
   */
  async getUsersByOfficeId(officeId: string): Promise<UserProfile[]> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('officeId', '==', officeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as UserProfile));
  }

  /**
   * ユーザーのロールを更新（admin のみ実行可能）
   */
  async updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    const userDoc = doc(this.firestore, 'users', userId);
    const updatedAt = new Date().toISOString();
    await updateDoc(userDoc, {
      role: newRole,
      updatedAt
    });
  }
}
```

**実装時の注意点**:

1. **`UserProfile` 型との整合性**:
   - `getUsersByOfficeId()` で `id` フィールドを付けて返しているため、`UserProfile` 型に `id: string` が含まれていることを確認
   - 現状の `UserProfile` インターフェース（`types.ts` 89-98行目）では `id: string` が必須フィールドになっているため問題なし

2. **読み取りルールとの整合性**:
   - `/users/{uid}` の read ルール（4.4節）が適切に実装されていないと、`getUsersByOfficeId()` で `FirebaseError: Missing or insufficient permissions.` が発生する
   - **必ず read ルールと update ルールをセットで実装すること**

#### 6.3.4 更新完了後の処理

**トースト表示**:
```typescript
this.snackBar.open('ロールを更新しました', '閉じる', { duration: 3000 });
```

**ローディング状態管理**:
```typescript
readonly updating = signal(false);

async updateRole(userId: string, newRole: UserRole): Promise<void> {
  this.updating.set(true);
  try {
    await this.usersService.updateUserRole(userId, newRole);
    this.snackBar.open('ロールを更新しました', '閉じる', { duration: 3000 });
    // 一覧を再取得
    await this.loadUsers();
  } catch (error) {
    console.error(error);
    this.snackBar.open('ロールの更新に失敗しました', '閉じる', { duration: 3000 });
  } finally {
    this.updating.set(false);
  }
}
```

---

## 7. HR ユーザーの運用フロー整理

### 7.1 フロー概要

1. **管理者によるユーザー作成・ロール設定**
   - 管理者がユーザー管理タブから、対象ユーザーの role を `hr` に変更
   - または、新規ユーザーがログイン時に `hr` ロールで作成される

2. **HR ユーザーを従業員台帳に登録**
   - 管理者が従業員台帳に HR ユーザーの従業員レコードを作成
   - `contactEmail` に HR ユーザーのメールアドレスを設定

3. **従業員ポータル招待**
   - 管理者が従業員台帳から HR ユーザーに「従業員ポータル招待」を送信
   - `employeePortalInvites` コレクションに招待トークンが作成される
   - 従業員レコードの `portal.status` が `invited` に更新される

4. **HR ユーザーが招待リンクでログイン**
   - HR ユーザーが招待リンク（`/employee-portal/accept-invite?token=...`）にアクセス
   - ログイン画面で Google 認証を実行
   - `accept-invite.page.ts` の `handleInvite()` が実行される

5. **招待受諾処理**
   - `accept-invite.page.ts` の `resolveRole()` により、既存の `role: 'hr'` が維持される
   - `users/{uid}.employeeId` が従業員レコードの ID に設定される
   - `users/{uid}.officeId` が従業員レコードの `officeId` に設定される
   - 従業員レコードの `portal.status` が `linked` に更新される
   - 招待トークンが `used: true` にマークされる

6. **結果**
   - HR ロールとしては台帳・保険料などの画面を操作できる（`roleGuard(['admin', 'hr'])` により）
   - 同時に、自分の `/me`（マイページ）も閲覧できる（`hasEmployeeIdGuard` により `employeeId` が設定されているため）
   - 自分の月次保険料・賞与保険料・書類・変更申請なども閲覧可能（`isInsureEmployee()` により）

### 7.2 フロー図

```
管理者
  ↓
ユーザー管理タブで role を 'hr' に設定
  ↓
従業員台帳に HR ユーザーの従業員レコードを作成
  ↓
従業員ポータル招待を送信
  ↓
HR ユーザー
  ↓
招待リンクでログイン
  ↓
accept-invite.page.ts で処理
  ↓
role: 'hr' を維持したまま employeeId を設定
  ↓
結果: HR ロール + employeeId 設定済み
  ├─ 台帳・保険料などの管理画面を利用可能
  └─ /me で自分のマイページも閲覧可能
```

---

## 8. テスト観点

### 8.1 ロール別アクセス制御の確認

#### admin ロール

- [ ] ユーザー管理タブが表示される
- [ ] ユーザー一覧が表示される
- [ ] 他ユーザーのロールを変更できる
- [ ] `/me` にアクセスすると、`employeeId` の有無に応じて挙動が変わる
  - `employeeId` がある場合: `/me` にアクセス可能
  - `employeeId` がない場合: `/dashboard` にリダイレクト
- [ ] 事業所設定・従業員台帳・保険料・マスタ・ダッシュボードなどが利用できる

#### hr ロール

- [ ] ユーザー管理タブが表示されない（または表示されても編集不可）
- [ ] 事業所設定の一部画面や従業員台帳などが利用できる
- [ ] 自分に `employeeId` がある場合のみ `/me` にアクセスできる
- [ ] ロール編集UIが表示されない／編集できない
- [ ] 自分に `employeeId` がない場合: `/dashboard` にリダイレクト

#### employee ロール

- [ ] `/me` は利用できるが、従業員台帳や事業所設定にはアクセスできない
- [ ] ユーザー管理タブが表示されない
- [ ] 自分に `employeeId` がない場合: `/login` にリダイレクト

### 8.2 HR ユーザーのマイページ確認

- [ ] HR ユーザーでログインし、`employeeId` が設定されている場合
- [ ] `/me` にアクセスできる
- [ ] 扶養家族・月次保険料・書類アップロードなど「自分のものだけ」が見えている
- [ ] 他人のデータは表示されない

### 8.3 Firestore ルールの確認

- [ ] `isInsureEmployee()` が `employeeId` ベースで動作している
- [ ] admin/hr で `employeeId` が設定されている場合、**全従業員のデータを閲覧可能**（従来通り）+ **自分のデータを「従業員として」も閲覧可能**（二重の権限）
- [ ] admin/hr で `employeeId` がない場合、全従業員のデータを閲覧可能（従来通り）
- [ ] `users/{uid}` の read ルールで、admin が同じ事業所のユーザー一覧を取得できる
- [ ] `users/{uid}` の update ルールで、admin のみ role を変更できる（`isInsureAdmin()` を使用）
- [ ] admin が別事業所のユーザーの role を変更できない（`officeId` 一致チェック）

### 8.4 ユーザー管理UIの確認

- [ ] admin でログインし、ユーザー管理タブを開く
- [ ] 事業所に属するユーザー一覧が表示される
- [ ] 各ユーザーの表示名・メール・ロール・employeeId が表示される
- [ ] ロール編集用の `mat-select` が表示される
- [ ] ロールを変更すると、Firestore に反映される
- [ ] 更新完了後にトーストが表示される
- [ ] hr でログインした場合、ユーザー管理タブが表示されない（または編集不可）

### 8.5 招待フローの確認

- [ ] admin が HR ユーザーに従業員ポータル招待を送信
- [ ] HR ユーザーが招待リンクでログイン
- [ ] `accept-invite.page.ts` で処理が実行される
- [ ] `role: 'hr'` が維持される（`employee` に変更されない）
- [ ] `employeeId` が設定される
- [ ] `/me` にリダイレクトされる
- [ ] HR ロールとして管理画面も利用可能

### 8.6 エッジケースの確認

- [ ] Firestore コンソールなどから直接ロールを書き換えた際の挙動
- [ ] `employeeId` が設定されている admin/hr が `/me` にアクセスした際の挙動
- [ ] `employeeId` がない employee が `/me` にアクセスしようとした際の挙動
- [ ] 別事業所のユーザーの role を変更しようとした際のエラーハンドリング

---

## 9. 実装チェックリスト

### 9.1 Firestore ルール

- [ ] `isInsureEmployee()` 関数を `employeeId` ベースに変更
- [ ] `users/{uid}` の **read ルール**に admin による一覧取得を追加（**重要**: これがないとユーザー管理タブが動作しない）
- [ ] `users/{uid}` の **create ルール**は従来通り（本人のみ作成可能）
- [ ] `users/{uid}` の **update ルール**を本人による更新と admin による role 更新に分けて実装（`isInsureAdmin()` を使用）
- [ ] `getUserRole() == 'employee'` でフィルタしている箇所を確認・修正

### 9.2 サービス

- [ ] `UsersService` を新規作成
- [ ] `getUsersByOfficeId()` メソッドを実装
- [ ] `updateUserRole()` メソッドを実装

### 9.3 UI コンポーネント

- [ ] `offices.page.ts` にタブUIを追加
- [ ] `user-management-tab.component.ts` を新規作成
- [ ] ユーザー一覧テーブルを実装
- [ ] ロール編集UIを実装
- [ ] 権限制御を実装

### 9.4 テスト

- [ ] ロール別アクセス制御のテスト
- [ ] HR ユーザーのマイページ確認
- [ ] Firestore ルールの確認
- [ ] ユーザー管理UIの確認
- [ ] 招待フローの確認
- [ ] エッジケースの確認

---

## 10. 補足・注意事項

### 10.1 既存実装との整合性

- `/me` のガードは既に `hasEmployeeIdGuard` で実装済み
- `accept-invite.page.ts` の `resolveRole()` は既に既存ロールを維持する実装済み
- サイドバーメニューの「マイページ」表示条件も既に `employeeId` ベースに実装済み

### 10.2 セキュリティ考慮事項

- admin による role 更新は、同じ事業所のユーザーのみに限定
- `employeeId` の変更は許可しない（role 更新時）
- `officeId` の変更は許可しない（role 更新時）

### 10.3 パフォーマンス考慮事項

- ユーザー一覧の取得は、必要に応じてページネーションを検討
- 大量のユーザーがいる場合のパフォーマンステストを実施

### 10.4 実装前の必須チェック項目

**実装を開始する前に、以下を必ず確認すること**:

1. **Firestore ルールのヘルパー関数名の確認**
   - `isInsureAdmin(officeId)` が既存の関数（53-55行目）であることを確認
   - `isAdminOrHr()` ではなく、admin 専用の `isInsureAdmin()` を使用すること

2. **`/users/{uid}` の read ルールの確認**
   - 現在は「自分の分だけ読み取り可」（446行目）
   - admin による一覧取得を許可する read ルールを追加すること（4.4節参照）
   - **これがないと `UsersService.getUsersByOfficeId()` で `FirebaseError: Missing or insufficient permissions.` が発生する**
   - **`get()` を使わず `resource.data` を使用すること**。同じドキュメントを `get()` で読みに行くとエラーになる可能性がある

3. **`isInsureEmployee()` の変更に伴う影響確認**
   - `getUserRole() == 'employee'` でフィルタしている箇所がないか確認（現在は `isInsureEmployee()` の定義内に1箇所のみ）
   - 必要に応じて `isInsureEmployee()` への置き換えを検討

4. **UsersService の実装時の注意**
   - `UserProfile` 型に `id: string` が含まれていることを確認
   - read ルールと update ルールをセットで実装すること

---

**以上**

