# Phase2-1 実装指示書: セキュリティ・アクセス制御の強化

## 📋 概要

Firestoreセキュリティルールと画面レベルのアクセス制御を強化し、本番環境で安全に運用できる状態を実現します。

**目的**: 
- 事業所単位でのデータ完全分離を実現
- ロール別（admin/hr/employee）の適切なアクセス制御を実装
- 個人情報の保護とマスキング表示を実装
- 本番環境でのセキュリティリスクを最小化

**このフェーズで達成したいゴール**:
- ロール別のアクセス制御がFirestoreルールとAngularガードの両方で機能している状態
- 各ロール（admin/hr/employee）ごとに、アクセスできる画面・できない画面が明確に分離されている状態
- `employee`ロールが自分の情報のみ閲覧可能で、他人の個人情報にアクセスできない状態
- Firestore Emulator Suiteでのルールテストが通過する状態
- 既存のProblemPath向けルールに影響を与えず、InsurePath専用のルールが追加されている状態

**前提条件**:
- Phase1-12までの機能が実装済み
- `UserProfile`に`role`フィールドが存在し、`'admin' | 'hr' | 'employee'`のいずれかが設定されている
- `UserProfile`に`officeId`と`employeeId`が設定されている（`employee`ロールの場合）

---

## 🧭 スコープ

### 対象とするコレクション・画面

#### Firestoreコレクション
- `offices/{officeId}` - 事業所情報
- `offices/{officeId}/employees/{employeeId}` - 従業員情報
- `offices/{officeId}/monthlyPremiums/{docId}` - 月次保険料
- `offices/{officeId}/bonusPremiums/{docId}` - 賞与保険料
- `offices/{officeId}/healthRateTables/{docId}` - 健康保険料率マスタ
- `offices/{officeId}/careRateTables/{docId}` - 介護保険料率マスタ
- `offices/{officeId}/pensionRateTables/{docId}` - 厚生年金保険料率マスタ
- `users/{uid}` - ユーザープロファイル（InsurePath用）

#### Angular画面・機能
- ダッシュボード（`/dashboard`）
- 従業員台帳（`/employees`）
- 月次保険料一覧（`/premiums/monthly`）
- 賞与保険料管理（`/premiums/bonus`）
- マイページ（`/me`）
- 保険料シミュレーター（`/simulator`）
- マスタ管理（`/masters`）
- 事業所管理（`/offices`）
- 変更申請（`/requests`）- プレースホルダー状態

### 対象外とするもの

以下の機能はPhase2-1では対象外とします：
- CSVインポート・エクスポート機能（Phase2-4で実装予定）
- 被扶養者管理機能（Phase2-2で実装予定）
- 標準報酬決定・改定履歴管理機能（Phase2-3で実装予定）
- ProblemPath向けの既存ルール・コード（変更しない）

---

## 📂 影響範囲と対象ファイル一覧

### Firestoreルール側

**編集対象**:
- `firestore.rules` - InsurePath向けのルールを追加・拡張

**追加するルール**:
- `offices/{officeId}`配下の各コレクションに対するロール別アクセス制御
- 事業所IDに基づくデータ分離ロジック
- ユーザープロファイルからのロール取得ロジック

### Angular側

#### 新規作成ファイル
- `src/app/guards/role.guard.ts` - ロール別アクセス制御用のガード

#### 編集対象ファイル

**Guards**:
- `src/app/guards/auth.guard.ts` - 既存のまま（変更なし）
- `src/app/guards/office.guard.ts` - 既存のまま（変更なし）
- `src/app/guards/needs-office.guard.ts` - 既存のまま（変更なし）

**Services**:
- `src/app/services/current-user.service.ts` - ロール取得用のヘルパーメソッド追加（オプション）

**Routing**:
- `src/app/app.routes.ts` - 各ルートに`roleGuard`を追加

**Pages**:
- 各ページコンポーネント - ロール別のUI制御（メニュー表示制御など）を追加
  - `src/app/pages/employees/employees.page.ts`
  - `src/app/pages/premiums/monthly/monthly-premiums.page.ts`
  - `src/app/pages/premiums/bonus/bonus-premiums.page.ts`
  - `src/app/pages/dashboard/dashboard.page.ts`
  - `src/app/pages/me/my-page.ts`
  - `src/app/pages/masters/masters.page.ts`
  - `src/app/pages/offices/offices.page.ts`
  - `src/app/pages/simulator/simulator.page.ts`

**Types**:
- `src/app/types.ts` - 変更なし（既存の`UserRole`型を使用）

---

## 🔧 実装方針（ステップごとに分解）

### Step 1: Firestoreルールの現状整理と、InsurePath向けの最小ルール追加

#### 1.1 現状の整理

**現状の問題点**:
- `firestore.rules`の478-486行目で、`offices/{officeId}`配下が`isSignedIn()`のみで全アクセス可能になっている
- 事業所間のデータ分離ができていない
- ロール別のアクセス制御が実装されていない

**既存のProblemPath向けルールとの関係**:
- `projects/{projectId}`配下のルールは変更しない
- `users/{uid}`配下のルールは、InsurePath用とProblemPath用が混在しているため、慎重に追加する

#### 1.2 InsurePath向けのユーティリティ関数追加

`firestore.rules`の冒頭（共通ユーティリティセクション）に、InsurePath専用の関数を追加します。

**追加する関数**:
```javascript
// InsurePath 用: 現在のユーザープロファイルを取得（キャッシュを活用）
// 注意: Firestore Rules は同じパスへの get() をキャッシュするため、
// この関数を経由することで、複数回 get() を呼んでも読み取り回数は1回に抑えられる
function currentUser() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid));
}

// InsurePath 用: ユーザープロファイルからロールを取得
function getUserRole() {
  return currentUser().data.role;
}

// InsurePath 用: ユーザーが指定事業所に所属しているかチェック
// 前提条件: users/{uid} ドキュメントが存在し、officeId が設定されていること
// （users ドキュメント未作成 / officeId 未設定のユーザーは authGuard / officeGuard 側でブロックされる前提）
function belongsToOffice(officeId) {
  return isSignedIn() &&
    currentUser().data.officeId == officeId;
}

// InsurePath 用: 指定事業所の管理者または人事担当者かチェック
function isAdminOrHr(officeId) {
  return belongsToOffice(officeId) &&
    getUserRole() in ['admin', 'hr'];
}

// InsurePath 用: 指定事業所の管理者かチェック
function isInsureAdmin(officeId) {
  return belongsToOffice(officeId) &&
    getUserRole() == 'admin';
}

// InsurePath 用: 指定事業所の一般従業員かチェック
function isInsureEmployee(officeId) {
  return belongsToOffice(officeId) &&
    getUserRole() == 'employee';
}

// InsurePath 用: ユーザーが指定従業員レコードに紐づいているかチェック
// 前提条件: users/{uid} に employeeId が設定されていること（employee ロールの場合）
function isOwnEmployee(officeId, employeeId) {
  return isSignedIn() &&
    belongsToOffice(officeId) &&
    currentUser().data.employeeId == employeeId;
}
```

**実装場所**: `firestore.rules`の30行目付近（`isValidRole`関数の後）

#### 1.3 `offices/{officeId}`配下のルール詳細化

現在の478-486行目のルールを、コレクションごとに詳細化します。

**実装方針**:
- 既存の`match /offices/{officeId}`ブロック（478行目）を拡張
- 各サブコレクションごとに`match`ブロックを追加
- ロール別のアクセス制御を実装

**コレクションごとのアクセス制御方針**:

1. **`offices/{officeId}`（事業所情報）**
   - Read: その事業所に所属する全ロール
   - Write: `admin`のみ

2. **`offices/{officeId}/employees/{employeeId}`（従業員情報）**
   - Read: 
     - `admin` / `hr`: 全従業員閲覧可能
     - `employee`: 自分の従業員レコードのみ閲覧可能（`employeeId`が一致する場合）
   - Write: `admin` / `hr`のみ

3. **`offices/{officeId}/monthlyPremiums/{docId}`（月次保険料）**
   - Read:
     - `admin` / `hr`: 全件閲覧可能
     - `employee`: 自分の従業員IDに紐づく月次保険料のみ閲覧可能
   - Write: `admin` / `hr`のみ

4. **`offices/{officeId}/bonusPremiums/{docId}`（賞与保険料）**
   - Read:
     - `admin` / `hr`: 全件閲覧可能
     - `employee`: 自分の従業員IDに紐づく賞与保険料のみ閲覧可能
   - Write: `admin` / `hr`のみ

5. **`offices/{officeId}/healthRateTables/{docId}`（健康保険料率マスタ）**
   - Read: その事業所に所属する全ロール
   - Write: `admin`のみ

6. **`offices/{officeId}/careRateTables/{docId}`（介護保険料率マスタ）**
   - Read: その事業所に所属する全ロール
   - Write: `admin`のみ

7. **`offices/{officeId}/pensionRateTables/{docId}`（厚生年金保険料率マスタ）**
   - Read: その事業所に所属する全ロール
   - Write: `admin`のみ

**実装例**:
```javascript
// ---- InsurePath 用: offices 以下 ----
match /offices/{officeId} {
  // 事業所情報自体のアクセス制御
  allow read: if belongsToOffice(officeId);
  allow create: if isSignedIn(); // 新規事業所作成はログイン済みなら誰でも可（初期設定用）
  allow update, delete: if isInsureAdmin(officeId);

  // 従業員情報
  match /employees/{employeeId} {
    allow read: if belongsToOffice(officeId) && (
      isAdminOrHr(officeId) ||
      isOwnEmployee(officeId, employeeId)
    );
    allow create, update, delete: if isAdminOrHr(officeId);
  }

  // 月次保険料
  // 前提条件: monthlyPremiums ドキュメントには employeeId が必須フィールドとして必ず入っている
  match /monthlyPremiums/{docId} {
    allow read: if belongsToOffice(officeId) && (
      isAdminOrHr(officeId) ||
      (isInsureEmployee(officeId) &&
       resource.data.employeeId == currentUser().data.employeeId)
    );
    allow create, update, delete: if isAdminOrHr(officeId);
  }

  // 賞与保険料
  // 前提条件: bonusPremiums ドキュメントには employeeId が必須フィールドとして必ず入っている
  match /bonusPremiums/{docId} {
    allow read: if belongsToOffice(officeId) && (
      isAdminOrHr(officeId) ||
      (isInsureEmployee(officeId) &&
       resource.data.employeeId == currentUser().data.employeeId)
    );
    allow create, update, delete: if isAdminOrHr(officeId);
  }

  // 健康保険料率マスタ
  match /healthRateTables/{docId} {
    allow read: if belongsToOffice(officeId);
    allow create, update, delete: if isInsureAdmin(officeId);
  }

  // 介護保険料率マスタ
  match /careRateTables/{docId} {
    allow read: if belongsToOffice(officeId);
    allow create, update, delete: if isInsureAdmin(officeId);
  }

  // 厚生年金保険料率マスタ
  match /pensionRateTables/{docId} {
    allow read: if belongsToOffice(officeId);
    allow create, update, delete: if isInsureAdmin(officeId);
  }

  // その他のサブコレクション（将来の拡張用）
  // デフォルトでは、所属ユーザーのみ読み取り可能、admin/hrのみ書き込み可能
  match /{subcollection}/{docId} {
    allow read: if belongsToOffice(officeId);
    allow create, update, delete: if isAdminOrHr(officeId);
  }
}
```

**段階的な実装方針**:
- **Step 1（実装＆エミュレータテスト中）**: 
  - 新しい詳細ルールを追加
  - 既存の478-486行目の緩いルールは「一旦コメントアウト」または「TODO付きで残す」
  - 例: `// TODO: テスト完了後に削除` というコメントを付けて残す
- **Step 2（テスト完了後）**: 
  - Firestore Emulator Suiteでルールテストが通過することを確認
  - 問題がなければ、緩いルールを完全削除するコミットを別で切る

**重要**: 最初のコミットでは旧`offices`ルールはコメントアウトにしておき、Emulatorでテストが通ることを確認できた段階で完全削除するコミットを別で切ってください。

---

### Step 2: ロール別の認可ロジック（`role.guard.ts`）の設計

#### 2.1 `role.guard.ts`の作成

**目的**: 特定のロールのみがアクセスできるルートを保護する

**実装内容**:
```typescript
// src/app/guards/role.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';

import { CurrentUserService } from '../services/current-user.service';
import { UserRole } from '../types';

/**
 * 指定されたロールのいずれかを持っているユーザーのみアクセスを許可するガード
 * 
 * @param allowedRoles - アクセスを許可するロールの配列
 * @returns CanActivateFn
 * 
 * 使用例:
 * {
 *   path: 'employees',
 *   canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
 *   ...
 * }
 */
export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const currentUser = inject(CurrentUserService);

    return currentUser.profile$.pipe(
      take(1),
      map((profile) => {
        if (!profile) {
          // プロファイルが取得できない場合はログインページへ
          router.navigateByUrl('/login');
          return false;
        }

        if (!allowedRoles.includes(profile.role)) {
          // 権限がない場合は /me（マイページ）へリダイレクト
          // 注意: /dashboard にリダイレクトすると、employee ロールがアクセス権のないページから
          // /dashboard に飛ばされて、そこでもまた弾かれるという動きになるため、/me を使用
          // 将来的に汎用403ページ（/forbidden）を作成した場合は、そちらに変更してもよい
          router.navigateByUrl('/me');
          return false;
        }

        return true;
      })
    );
  };
};
```

**役割分担**:
- `authGuard`: ログイン済みかチェック
- `officeGuard`: 事業所に所属しているかチェック
- `roleGuard`: 指定されたロールを持っているかチェック

**使用パターン**:
- 管理者専用ページ: `canActivate: [authGuard, officeGuard, roleGuard(['admin'])]`
- 管理者・人事担当者用ページ: `canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])]`
- 全ロールアクセス可能: `canActivate: [authGuard, officeGuard]`（`roleGuard`は不要）

---

### Step 3: ルーティングとサイドメニューのロール別表示制御の設計

#### 3.1 ルーティング設定の更新

`src/app/app.routes.ts`の各ルートに`roleGuard`を追加します。

**実装方針**:

1. **管理者専用ページ**（`admin`のみ）:
   - `/offices` - 事業所管理
   - `/masters` - マスタ管理

2. **管理者・人事担当者用ページ**（`admin` / `hr`）:
   - `/employees` - 従業員台帳
   - `/premiums/monthly` - 月次保険料一覧
   - `/premiums/bonus` - 賞与保険料管理
   - `/dashboard` - ダッシュボード
   - `/simulator` - 保険料シミュレーター

3. **全ロールアクセス可能**:
   - `/me` - マイページ

**実装例**:
```typescript
// src/app/app.routes.ts

import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
        loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage)
      },
      {
        path: 'offices',
        canActivate: [authGuard, officeGuard, roleGuard(['admin'])],
        loadComponent: () => import('./pages/offices/offices.page').then((m) => m.OfficesPage)
      },
      {
        path: 'employees',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
        loadComponent: () => import('./pages/employees/employees.page').then((m) => m.EmployeesPage)
      },
      {
        path: 'premiums',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
        children: [
          {
            path: 'monthly',
            loadComponent: () =>
              import('./pages/premiums/monthly/monthly-premiums.page').then((m) => m.MonthlyPremiumsPage)
          },
          {
            path: 'bonus',
            loadComponent: () =>
              import('./pages/premiums/bonus/bonus-premiums.page').then((m) => m.BonusPremiumsPage)
          },
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'monthly'
          }
        ]
      },
      {
        path: 'me',
        canActivate: [authGuard, officeGuard],
        loadComponent: () => import('./pages/me/my-page').then((m) => m.MyPage)
      },
      {
        path: 'simulator',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
        loadComponent: () => import('./pages/simulator/simulator.page').then((m) => m.SimulatorPage)
      },
      {
        path: 'masters',
        canActivate: [authGuard, officeGuard, roleGuard(['admin'])],
        loadComponent: () => import('./pages/masters/masters.page').then((m) => m.MastersPage)
      },
      {
        path: 'requests',
        canActivate: [authGuard, officeGuard],
        loadComponent: () => import('./pages/requests/requests.page').then((m) => m.RequestsPage)
      }
    ]
  },
  // ... 既存のルート（login, office-setup, not-found）は変更なし
];
```

#### 3.2 サイドメニューのロール別表示制御

**実装方針**:
- 各ページコンポーネントまたは共通のナビゲーションコンポーネントで、`CurrentUserService.profile$`を購読
- ロールに応じてメニュー項目の表示/非表示を制御

**注意**: サイドメニューの実装が確認できなかったため、実装時に以下を確認してください：
- サイドメニューコンポーネントの場所（`app.component.ts`や専用のコンポーネント）
- メニュー項目の定義方法

**実装例（仮想）**:
```typescript
// サイドメニューコンポーネント内

readonly profile$ = this.currentUser.profile$;

readonly menuItems$ = this.profile$.pipe(
  map((profile) => {
    if (!profile) return [];
    
    const items = [
      { label: 'ダッシュボード', path: '/dashboard', icon: 'dashboard', roles: ['admin', 'hr'] },
      { label: '従業員台帳', path: '/employees', icon: 'people', roles: ['admin', 'hr'] },
      { label: '月次保険料', path: '/premiums/monthly', icon: 'table_chart', roles: ['admin', 'hr'] },
      { label: '賞与保険料', path: '/premiums/bonus', icon: 'workspace_premium', roles: ['admin', 'hr'] },
      { label: 'マイページ', path: '/me', icon: 'person', roles: ['admin', 'hr', 'employee'] },
      { label: 'シミュレーター', path: '/simulator', icon: 'calculate', roles: ['admin', 'hr'] },
      { label: 'マスタ管理', path: '/masters', icon: 'settings', roles: ['admin'] },
      { label: '事業所管理', path: '/offices', icon: 'business', roles: ['admin'] },
    ];
    
    return items.filter(item => item.roles.includes(profile.role));
  })
);
```

---

### Step 4: 個人情報表示の制御・マスキング方針

#### 4.1 マイページでの個人情報表示

**現状**: `my-page.ts`では、既に`CurrentUserService`から`employeeId`を取得し、自分の従業員レコードのみを表示している

**確認事項**:
- `my-page.ts`の実装を確認し、`employeeId`によるフィルタリングが正しく機能していることを確認
- Firestoreルールで`employee`ロールが自分の従業員レコードのみ閲覧可能になっていることを確認

#### 4.2 管理画面での個人情報マスキング

**実装方針**:
- `admin` / `hr`ロールは、全従業員の個人情報を閲覧可能（マスキング不要）
- 将来的に、より厳格な個人情報保護が必要な場合は、電話番号やメールアドレスの一部マスキングを検討

**Phase2-1での実装範囲**:
- 個人情報のマスキング表示は、Phase2-1では実装しない
- Firestoreルールとガードによるアクセス制御で、`employee`ロールが他人の情報にアクセスできないことを保証する

**将来の拡張案**:
- 電話番号の一部マスキング（例: `090-****-1234`）
- メールアドレスの一部マスキング（例: `taro.****@example.com`）
- 住所の一部マスキング（例: `東京都渋谷区****`）

---

## 🛡 Firestoreセキュリティルールの具体案

### コレクションごとのアクセス制御詳細

#### 1. `offices/{officeId}`（事業所情報）

**Read**:
- 条件: `belongsToOffice(officeId)` - その事業所に所属する全ロール

**Write**:
- Create: `isSignedIn()` - 新規事業所作成はログイン済みなら誰でも可（初期設定用）
- Update/Delete: `isInsureAdmin(officeId)` - 管理者のみ

**ルール例**:
```javascript
match /offices/{officeId} {
  allow read: if belongsToOffice(officeId);
  allow create: if isSignedIn();
  allow update, delete: if isInsureAdmin(officeId);
  
  // サブコレクションは下記で定義
}
```

#### 2. `offices/{officeId}/employees/{employeeId}`（従業員情報）

**Read**:
- `admin` / `hr`: 全従業員閲覧可能
- `employee`: 自分の従業員レコードのみ閲覧可能（`employeeId`が`users/{uid}.employeeId`と一致する場合）

**Write**:
- Create/Update/Delete: `admin` / `hr`のみ

**ルール例**:
```javascript
match /employees/{employeeId} {
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    isOwnEmployee(officeId, employeeId)
  );
  allow create, update, delete: if isAdminOrHr(officeId);
}
```

#### 3. `offices/{officeId}/monthlyPremiums/{docId}`（月次保険料）

**Read**:
- `admin` / `hr`: 全件閲覧可能
- `employee`: 自分の従業員IDに紐づく月次保険料のみ閲覧可能（`resource.data.employeeId == users/{uid}.employeeId`）

**Write**:
- Create/Update/Delete: `admin` / `hr`のみ

**ルール例**:
```javascript
match /monthlyPremiums/{docId} {
  // 前提条件: monthlyPremiums ドキュメントには employeeId が必須フィールドとして必ず入っている
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    (isInsureEmployee(officeId) &&
     resource.data.employeeId == currentUser().data.employeeId)
  );
  allow create, update, delete: if isAdminOrHr(officeId);
}
```

#### 4. `offices/{officeId}/bonusPremiums/{docId}`（賞与保険料）

**Read**:
- `admin` / `hr`: 全件閲覧可能
- `employee`: 自分の従業員IDに紐づく賞与保険料のみ閲覧可能

**Write**:
- Create/Update/Delete: `admin` / `hr`のみ

**ルール例**:
```javascript
match /bonusPremiums/{docId} {
  // 前提条件: bonusPremiums ドキュメントには employeeId が必須フィールドとして必ず入っている
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    (isInsureEmployee(officeId) &&
     resource.data.employeeId == currentUser().data.employeeId)
  );
  allow create, update, delete: if isAdminOrHr(officeId);
}
```

#### 5. `offices/{officeId}/healthRateTables/{docId}`（健康保険料率マスタ）

**Read**:
- その事業所に所属する全ロール

**Write**:
- Create/Update/Delete: `admin`のみ

**ルール例**:
```javascript
match /healthRateTables/{docId} {
  allow read: if belongsToOffice(officeId);
  allow create, update, delete: if isInsureAdmin(officeId);
}
```

#### 6. `offices/{officeId}/careRateTables/{docId}`（介護保険料率マスタ）

**Read**:
- その事業所に所属する全ロール

**Write**:
- Create/Update/Delete: `admin`のみ

**ルール例**:
```javascript
match /careRateTables/{docId} {
  allow read: if belongsToOffice(officeId);
  allow create, update, delete: if isInsureAdmin(officeId);
}
```

#### 7. `offices/{officeId}/pensionRateTables/{docId}`（厚生年金保険料率マスタ）

**Read**:
- その事業所に所属する全ロール

**Write**:
- Create/Update/Delete: `admin`のみ

**ルール例**:
```javascript
match /pensionRateTables/{docId} {
  allow read: if belongsToOffice(officeId);
  allow create, update, delete: if isInsureAdmin(officeId);
}
```

#### 8. `users/{uid}`（ユーザープロファイル）

**現状**: 既に379-417行目でInsurePath用のルールが実装されている

**Read**:
- 自分のプロファイルのみ閲覧可能（`request.auth.uid == uid`）

**Write**:
- Create/Update: 自分のプロファイルのみ更新可能（`request.auth.uid == uid`）

**変更**: 既存のルールを維持（変更不要）

**重要**: `users/{uid}`のトップレベルドキュメントのルールは再利用してOKですが、ProblemPath用サブコレクション（`notifyPrefs`, `memberships`, `fcmTokens`, `fcmStatus`など）のルールは一切変更しないでください。これらのサブコレクションは419-475行目で定義されており、ProblemPath用の機能として動作しています。

---

## 🚪 Angular側のガード・メニュー制御の具体案

### ガードの役割分担

#### `authGuard`
- **役割**: ログイン済みかチェック
- **実装**: 既存のまま（変更なし）
- **戻り値**: `true`（ログイン済み）または`false`（未ログイン時は`/login`へリダイレクト）

#### `officeGuard`
- **役割**: 事業所に所属しているかチェック
- **実装**: 既存のまま（変更なし）
- **戻り値**: `true`（所属済み）または`UrlTree`（未所属時は`/office-setup`へリダイレクト）

#### `roleGuard`（新規）
- **役割**: 指定されたロールを持っているかチェック
- **実装**: Step 2で作成
- **戻り値**: `true`（権限あり）または`false`（権限なし時は`/me`へリダイレクト）
- **注意**: 権限がない場合の遷移先は`/me`（または汎用403ページ）にしてほしい。少なくとも`employee`がアクセス権のないページから`/dashboard`に飛ばされて、そこでもまた弾かれる、という動きにはしないでほしい。

### ルーティング設定での使用例

```typescript
// 管理者専用ページ
{
  path: 'masters',
  canActivate: [authGuard, officeGuard, roleGuard(['admin'])],
  loadComponent: () => import('./pages/masters/masters.page').then((m) => m.MastersPage)
}

// 管理者・人事担当者用ページ
{
  path: 'employees',
  canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
  loadComponent: () => import('./pages/employees/employees.page').then((m) => m.EmployeesPage)
}

// 全ロールアクセス可能
{
  path: 'me',
  canActivate: [authGuard, officeGuard],
  loadComponent: () => import('./pages/me/my-page').then((m) => m.MyPage)
}
```

### サイドメニューのロール別表示制御

**実装場所**: サイドメニューコンポーネント（実装時に確認）

**実装方針**:
1. `CurrentUserService.profile$`を購読
2. ロールに応じてメニュー項目をフィルタリング
3. `*ngIf`や`*ngFor`で表示制御

**メニュー項目のロール別アクセス**:
- ダッシュボード: `admin`, `hr`
- 従業員台帳: `admin`, `hr`
- 月次保険料: `admin`, `hr`
- 賞与保険料: `admin`, `hr`
- マイページ: `admin`, `hr`, `employee`
- シミュレーター: `admin`, `hr`
- マスタ管理: `admin`
- 事業所管理: `admin`

---

## ✅ 受け入れ条件（テスト観点）

### ロール別のアクセス制御テスト

#### `admin`ロール

**アクセスできる画面**:
- ✅ `/dashboard` - ダッシュボード
- ✅ `/employees` - 従業員台帳
- ✅ `/premiums/monthly` - 月次保険料一覧
- ✅ `/premiums/bonus` - 賞与保険料管理
- ✅ `/me` - マイページ
- ✅ `/simulator` - 保険料シミュレーター
- ✅ `/masters` - マスタ管理
- ✅ `/offices` - 事業所管理

**Firestoreでのアクセス権限**:
- ✅ 自分の事業所の全従業員情報を閲覧・編集可能
- ✅ 自分の事業所の全月次保険料・賞与保険料を閲覧・編集可能
- ✅ 自分の事業所のマスタ情報を閲覧・編集可能
- ✅ 自分の事業所の事業所情報を閲覧・編集可能
- ✅ 他の事業所のデータにはアクセス不可

#### `hr`ロール

**アクセスできる画面**:
- ✅ `/dashboard` - ダッシュボード
- ✅ `/employees` - 従業員台帳
- ✅ `/premiums/monthly` - 月次保険料一覧
- ✅ `/premiums/bonus` - 賞与保険料管理
- ✅ `/me` - マイページ
- ✅ `/simulator` - 保険料シミュレーター
- ❌ `/masters` - マスタ管理（アクセス不可）
- ❌ `/offices` - 事業所管理（アクセス不可）

**Firestoreでのアクセス権限**:
- ✅ 自分の事業所の全従業員情報を閲覧・編集可能
- ✅ 自分の事業所の全月次保険料・賞与保険料を閲覧・編集可能
- ✅ 自分の事業所のマスタ情報を閲覧可能（編集不可）
- ❌ 自分の事業所の事業所情報の編集不可（閲覧のみ）
- ✅ 他の事業所のデータにはアクセス不可

#### `employee`ロール

**アクセスできる画面**:
- ❌ `/dashboard` - ダッシュボード（アクセス不可）
- ❌ `/employees` - 従業員台帳（アクセス不可）
- ❌ `/premiums/monthly` - 月次保険料一覧（アクセス不可）
- ❌ `/premiums/bonus` - 賞与保険料管理（アクセス不可）
- ✅ `/me` - マイページ（アクセスのみ可能）
- ❌ `/simulator` - 保険料シミュレーター（アクセス不可）
- ❌ `/masters` - マスタ管理（アクセス不可）
- ❌ `/offices` - 事業所管理（アクセス不可）

**Firestoreでのアクセス権限**:
- ✅ 自分の従業員レコードのみ閲覧可能（編集不可）
- ✅ 自分の従業員IDに紐づく月次保険料のみ閲覧可能（編集不可）
- ✅ 自分の従業員IDに紐づく賞与保険料のみ閲覧可能（編集不可）
- ✅ 自分の事業所のマスタ情報を閲覧可能（編集不可）
- ❌ 他人の従業員情報・保険料情報にはアクセス不可
- ✅ 他の事業所のデータにはアクセス不可

### Firestore Emulatorでのテスト観点

1. **事業所間のデータ分離テスト**:
   - 事業所Aのユーザーが事業所Bのデータにアクセスできないことを確認

2. **ロール別アクセステスト**:
   - `admin`ロールが全データにアクセス可能なことを確認
   - `hr`ロールがマスタ編集不可なことを確認
   - `employee`ロールが自分のデータのみ閲覧可能なことを確認

3. **書き込み権限テスト**:
   - `admin` / `hr`が従業員情報・保険料情報を編集可能なことを確認
   - `employee`がデータを編集不可なことを確認

4. **エラーハンドリングテスト**:
   - 権限がない場合の適切なエラーメッセージ表示を確認

---

## ⚠️ 注意点

### 既存のProblemPath向けルールとの衝突リスク

**問題点**:
- `firestore.rules`には、ProblemPath向けの`projects/{projectId}`配下のルールが大部分を占めている
- `users/{uid}`配下にも、ProblemPath用のサブコレクション（`notifyPrefs`, `memberships`, `fcmTokens`など）が存在

**対策**:
- InsurePath向けのルールは、`offices/{officeId}`配下と`users/{uid}`のトップレベルドキュメントのみを対象とする
- ProblemPath向けの既存ルールは一切変更しない
- ルールの追加は、既存の`match`ブロックの後に追加する形で実装する

### 段階的な適用のイメージ

**Phase 1: ルール追加（既存ルールはコメントアウト）**
- InsurePath向けのユーティリティ関数を追加（`currentUser`, `getUserRole`, `belongsToOffice`など）
- `offices/{officeId}`配下の詳細なルールを追加
- 既存の478-486行目の緩いルールは「一旦コメントアウト」または「TODO付きで残す」
  - 例: `// TODO: テスト完了後に削除` というコメントを付けて残す

**Phase 2: テストと検証**
- Firestore Emulator Suiteでルールテストを実行
- 各ロールでのアクセステストを実施
- 問題がなければ、既存の緩いルールを完全削除するコミットを別で切る

**Phase 3: Angular側のガード実装**
- `roleGuard`を実装
- ルーティング設定を更新
- サイドメニューの表示制御を実装

**Phase 4: 本番デプロイ前の確認**
- ステージング環境での動作確認
- 既存ユーザーへの影響確認
- ロール設定の確認

**重要**: 最初のコミットでは旧`offices`ルールはコメントアウトにしておき、Emulatorでテストが通ることを確認できた段階で完全削除するコミットを別で切ってください。

### 本番デプロイ前に確認すべきこと

1. **Firestore Emulator Suiteでのルールテスト**:
   - 各コレクション・ロールごとのアクセステストを実施
   - エッジケース（`employeeId`が未設定の場合など）のテスト

2. **既存データへの影響確認**:
   - 既存のユーザーが正しくアクセスできることを確認
   - `employeeId`が未設定のユーザーへの影響確認

3. **ロール設定の確認**:
   - 既存ユーザーの`role`フィールドが正しく設定されていることを確認
   - デフォルトロール（`admin`）が適切に設定されていることを確認

4. **エラーハンドリングの確認**:
   - 権限がない場合の適切なエラーメッセージ表示
   - リダイレクト先の確認

5. **パフォーマンスへの影響**:
   - Firestoreルールの評価によるクエリ性能への影響確認
   - 必要に応じて、インデックスの追加を検討

### その他の注意事項

1. **`employeeId`が未設定の場合**:
   - `employee`ロールで`employeeId`が未設定の場合、マイページ以外のページにアクセスできない
   - マイページでも、従業員情報が表示されない（適切なメッセージを表示）

2. **事業所未所属の場合**:
   - `officeGuard`で`/office-setup`へリダイレクトされる
   - 事業所設定後、適切なロールが設定されることを確認

3. **ロール変更時の挙動**:
   - ユーザーのロールが変更された場合、再ログインまたはプロファイルの再読み込みが必要
   - 必要に応じて、ロール変更時の自動リロード機能を検討

4. **usersドキュメント未作成/officeId未設定のユーザーについて**:
   - `users`ドキュメント未作成 / `officeId`未設定というパターンは、`authGuard` / `officeGuard`側でブロックする前提
   - Firestoreルール側では、そこまで防御的にしなくてOK（無駄に複雑な条件にしない）
   - InsurePathでは「ログイン時にusersを必ず作成」＋「office-setup済みでないと他ページに行けない」状態になっているため、この前提で問題ない

5. **monthlyPremiums/bonusPremiumsのemployeeId必須について**:
   - `monthlyPremiums` / `bonusPremiums`のドキュメントに`employeeId`は必須フィールドで、今後も必ず入っている前提でルールを書く
   - データ設計として、これらのコレクションのドキュメントには`employeeId`が必須であることを明文化する

---

## 📝 実装チェックリスト

### Firestoreルール側

- [ ] InsurePath向けのユーティリティ関数を追加（`getUserRole`, `belongsToOffice`, `isAdminOrHr`, `isInsureAdmin`, `isInsureEmployee`, `isOwnEmployee`）
- [ ] `offices/{officeId}`配下の詳細なルールを実装
  - [ ] 事業所情報のアクセス制御
  - [ ] 従業員情報のアクセス制御
  - [ ] 月次保険料のアクセス制御
  - [ ] 賞与保険料のアクセス制御
  - [ ] マスタ情報のアクセス制御
- [ ] 既存の緩いルール（478-486行目）をコメントアウト（最初のコミット）
- [ ] Firestore Emulator Suiteでテストが通過することを確認
- [ ] テスト完了後、緩いルールを完全削除するコミットを別で切る
- [ ] ProblemPath向けの既存ルールに影響がないことを確認

### Angular側

- [ ] `roleGuard`を作成（`src/app/guards/role.guard.ts`）
- [ ] `roleGuard`で権限がない場合の遷移先を`/me`（または汎用403ページ）に設定（`/dashboard`ではない）
- [ ] `app.routes.ts`の各ルートに`roleGuard`を追加
  - [ ] 管理者専用ページに`roleGuard(['admin'])`を追加
  - [ ] 管理者・人事担当者用ページに`roleGuard(['admin', 'hr'])`を追加
  - [ ] 全ロールアクセス可能ページは`roleGuard`を追加しない
- [ ] サイドメニューのロール別表示制御を実装（実装場所を確認してから）
- [ ] 各ページコンポーネントで、ロールに応じたUI制御を実装（必要に応じて）

### テスト・確認

- [ ] Firestore Emulator Suiteでルールテストを実施
- [ ] 各ロール（`admin`, `hr`, `employee`）でのアクセステストを実施
- [ ] 事業所間のデータ分離テストを実施
- [ ] エラーハンドリングの確認
- [ ] 既存ユーザーへの影響確認
- [ ] 本番デプロイ前の最終確認

---

## 🎨 参考実装

以下のファイルを参考にしてください：

- `firestore.rules` - 既存のProblemPath向けルールの実装パターン
- `src/app/guards/auth.guard.ts` - 既存のガード実装パターン
- `src/app/guards/office.guard.ts` - 既存のガード実装パターン
- `src/app/services/current-user.service.ts` - ユーザープロファイル取得の実装パターン
- [Firestoreセキュリティルール公式ドキュメント](https://firebase.google.com/docs/firestore/security/get-started)

---

## 📌 補足事項

### 1. Firestoreルールの評価順序について

Firestoreルールは、上から順に評価されます。より具体的な`match`ブロックが先に評価されるため、`offices/{officeId}/employees/{employeeId}`のルールは、`offices/{officeId}/{subcollection}/{docId}`のルールより先に評価されます。

### 2. ルールのパフォーマンスについて

Firestoreルールの評価は、クエリ実行前に行われます。ルールが複雑になると、クエリ性能に影響を与える可能性があるため、必要に応じてインデックスの追加を検討してください。

### 3. エラーメッセージの表示について

Firestoreルールでアクセスが拒否された場合、Angular側では`permission-denied`エラーが発生します。適切なエラーハンドリングとユーザーフィードバックを実装してください。

### 4. ロール変更時の挙動について

ユーザーのロールが変更された場合、`CurrentUserService.profile$`を再購読するか、ページをリロードする必要があります。必要に応じて、ロール変更時の自動リロード機能を検討してください。

### 5. 将来の拡張について

Phase2-1では、基本的なロール別アクセス制御を実装します。将来的には、以下の拡張を検討できます：
- より細かい権限管理（例: 部署単位のアクセス制御）
- 監査ログ機能（誰がいつ何を変更したかの記録）
- 個人情報のマスキング表示（電話番号、メールアドレスなど）

---

以上で実装指示書は完了です。不明点があれば確認してください。

