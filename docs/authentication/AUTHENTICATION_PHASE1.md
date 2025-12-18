# InsurePath 認証・ロール・従業員ポータル Phase1 実装指示書

**作成日**: 2025年12月6日  
**対象フェーズ**: Phase1（認証・ロール・従業員ポータル改修）  
**優先度**: 🟢 高（セキュリティ・UX改善）  
**依存関係**: なし（既存機能の拡張）  
**目標完了日**: 2025年12月10日

---

## 前提・現状整理

### 関連ファイル一覧と現状の挙動の要約

#### 1. ルーティング・Guard関係

| ファイル | 役割 | 現状の挙動 |
|---------|------|-----------|
| `src/app/app.routes.ts` | アプリケーション全体のルーティング定義 | `/me` ルートは `authGuard` + `officeGuard` のみ（`roleGuard`なし）。他の管理系ルートは `roleGuard(['admin', 'hr'])` が付いている |
| `src/app/guards/auth.guard.ts` | ログイン認証チェック | Firebase Auth の認証状態を確認し、未ログインなら `/login` にリダイレクト |
| `src/app/guards/office.guard.ts` | 事業所所属チェック | `UserProfile.officeId` が存在するか確認し、未所属なら `/office-setup` にリダイレクト |
| `src/app/guards/role.guard.ts` | ロールベースアクセス制御 | `allowedRoles` に含まれないロールの場合、`/me` にリダイレクトする実装がある |

**現状の問題点**:
- `/me` ルートに `roleGuard` が付いていないため、`employee` ロール以外のユーザーもアクセス可能（これは意図的かもしれないが、Phase1では明確化が必要）
- `roleGuard` は既に「許可されていないロールは `/me` にリダイレクト」する実装があるが、`employee` が `/me` 以外にアクセスした場合の処理が明確でない

#### 2. ユーザー・ロール関係

| ファイル | 役割 | 現状の構造 |
|---------|------|-----------|
| `src/app/types.ts` | 型定義 | `UserProfile` 型: `{ id, officeId?, role, email, displayName, employeeId?, createdAt?, updatedAt? }` |
| `src/app/services/current-user.service.ts` | 現在のユーザー情報管理 | `profile$` Observable で `UserProfile` を配信。`officeId$` などの派生ストリームも提供 |
| `src/app/services/auth.service.ts` | Firebase Auth ラッパー | Google ログインのみ実装。`ensureUserDocument()` で `users/{uid}` を作成・更新 |

**現状の前提**:
- `UserProfile` は単一 `officeId` 前提（複数事業所対応は未実装）
- `employee` ロールのユーザーは `officeId` を持つ前提（`officeGuard` でチェック済み）
- `employeeId` は任意フィールド（管理者も従業員レコードと紐づけることができる）

#### 3. 従業員台帳UI

| ファイル | 役割 | 現状の構造 |
|---------|------|-----------|
| `src/app/pages/employees/employees.page.ts` | 従業員一覧ページ | テンプレートはインライン定義。`displayedColumns` で列を定義。`mat-table` を使用 |
| `src/app/types.ts` | 型定義 | `Employee` 型に `portal` フィールドは未定義 |

**現状の一覧表示列**:
- `name`, `department`, `address`, `weeklyWorkingHours`, `weeklyWorkingDays`, `isStudent`, `monthlyWage`, `dependents`, `isInsured`, `workingStatus`, `updatedBy`, `updatedAt`, `actions`

---

## Phase1-1: employeeロールの `/me` 限定アクセス

### 目的

- `employee` ロールのユーザーは、基本的に `/me`（マイページ系）だけアクセス可能にする
- `/dashboard` や `/employees` など、管理系の画面にアクセスしようとした場合は `/me` にリダイレクト
- `admin` / `hr` ロールのユーザーは、従来どおり管理系の画面にアクセス可能
- `admin` / `hr` が従業員レコードと紐づいている場合は `/me` も閲覧可能（現状の挙動を維持）

### 対象ファイル

1. **`src/app/app.routes.ts`**
   - `/me` ルートに `roleGuard` を追加
   - ルート定義の変更

2. **`src/app/guards/role.guard.ts`**
   - `employee` ロールが `/me` 以外のルートにアクセスした場合のリダイレクト処理を明確化
   - `/me` ルートに対するアクセス制御ロジックの追加

### 詳細な変更内容

#### 1. `roleGuard` の設計方針

**現状の `roleGuard` の挙動**:
- `allowedRoles` に含まれないロールの場合、`/me` にリダイレクト
- これは既に「`employee` が管理系ルートに来たら `/me` にリダイレクト」という仕様に合致している

**Phase1での変更方針**:
- `/me` ルートにも `roleGuard` を追加し、`employee` / `admin` / `hr` すべてを許可する
- 既存の `roleGuard` のロジックはそのまま維持（`employee` が許可されていないルートに来たら自動的に `/me` にリダイレクトされる）

**設計案**:
```typescript
// roleGuard の変更は不要（既存ロジックで対応可能）
// ただし、/me ルートに対しては roleGuard(['admin', 'hr', 'employee']) を追加

// app.routes.ts の変更
{
  path: 'me',
  canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr', 'employee'])],
  loadComponent: () => import('./pages/me/my-page').then((m) => m.MyPage)
}
```

**注意点**:
- `roleGuard` は既に「許可されていないロールは `/me` にリダイレクト」する実装があるため、追加の変更は不要
- `/me` ルートに `roleGuard(['admin', 'hr', 'employee'])` を追加することで、3つのロールすべてがアクセス可能になる

#### 2. `/me` ルートの `canActivate` 設定

**現状**:
```typescript
{
  path: 'me',
  canActivate: [authGuard, officeGuard],  // roleGuard なし
  ...
}
```

**変更後**:
```typescript
{
  path: 'me',
  canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr', 'employee'])],
  ...
}
```

**Guard の実行順序**:
1. `authGuard`: ログイン状態をチェック（未ログインなら `/login` にリダイレクト）
2. `officeGuard`: `officeId` の存在をチェック（未所属なら `/office-setup` にリダイレクト）
3. `roleGuard`: ロールをチェック（許可されていないロールなら `/me` にリダイレクト）

**`employee` ロールの前提**:
- `employee` ロールのユーザーは `officeId` を必ず持っている前提（`officeGuard` でチェック済み）
- もし `officeId` がない `employee` ロールのユーザーが存在する場合、`officeGuard` で `/office-setup` にリダイレクトされる（これは現状の挙動を維持）

#### 3. ルーティングの変更箇所

**`src/app/app.routes.ts`** の変更:

```typescript
// 変更前
{
  path: 'me',
  canActivate: [authGuard, officeGuard],
  loadComponent: () => import('./pages/me/my-page').then((m) => m.MyPage)
}

// 変更後
{
  path: 'me',
  canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr', 'employee'])],
  loadComponent: () => import('./pages/me/my-page').then((m) => m.MyPage)
}
```

**その他のルート**:
- 管理系ルート（`/dashboard`, `/employees`, `/premiums`, `/payments`, `/simulator`, `/masters`, `/requests`, `/procedures`, `/dependent-reviews`, `/documents`, `/cloud-masters`, `/data-quality`）は既に `roleGuard(['admin', 'hr'])` が付いているため変更不要
- `employee` ロールがこれらのルートにアクセスしようとすると、既存の `roleGuard` のロジックにより `/me` にリダイレクトされる

#### 4. `roleGuard` のロジック確認

**現状の `roleGuard` 実装**:
```typescript
export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const currentUser = inject(CurrentUserService);

    return currentUser.profile$.pipe(
      filter((profile): profile is UserProfile => profile !== null),
      take(1),
      map((profile) => {
        if (!allowedRoles.includes(profile.role)) {
          router.navigateByUrl('/me');  // 許可されていないロールは /me にリダイレクト
          return false;
        }
        return true;
      })
    );
  };
};
```

**Phase1での変更**:
- 既存のロジックで十分対応可能（変更不要）
- `/me` ルートに `roleGuard(['admin', 'hr', 'employee'])` を追加するだけで、3つのロールすべてがアクセス可能になる

### テストケース

#### 1. `employee` ロールのアクセス制御

- ✅ **テストケース1-1**: `employee` ロールが `/me` にアクセス → 正常に表示されること
- ✅ **テストケース1-2**: `employee` ロールが `/dashboard` に直接URL入力 → `/me` にリダイレクトされること
- ✅ **テストケース1-3**: `employee` ロールが `/employees` に直接URL入力 → `/me` にリダイレクトされること
- ✅ **テストケース1-4**: `employee` ロールが `/premiums`, `/payments`, `/simulator`, `/masters`, `/requests`, `/procedures`, `/dependent-reviews`, `/documents`, `/cloud-masters`, `/data-quality` に直接URL入力 → `/me` にリダイレクトされること

#### 2. `admin` / `hr` ロールのアクセス制御

- ✅ **テストケース2-1**: `admin` ロールが `/dashboard` にアクセス → 正常に表示されること
- ✅ **テストケース2-2**: `admin` ロールが `/employees` にアクセス → 正常に表示されること
- ✅ **テストケース2-3**: `admin` ロールが `/me` にアクセス → 正常に表示されること（従業員レコードと紐づいている場合）
- ✅ **テストケース2-4**: `hr` ロールが `/dashboard` にアクセス → 正常に表示されること
- ✅ **テストケース2-5**: `hr` ロールが `/me` にアクセス → 正常に表示されること（従業員レコードと紐づいている場合）

#### 3. ログイン・事業所設定の前提条件

- ✅ **テストケース3-1**: 未ログインユーザーが `/me` にアクセス → `/login` にリダイレクトされること（`authGuard` の動作確認）
- ✅ **テストケース3-2**: ログイン済みだが `officeId` がない `employee` ロールが `/me` にアクセス → `/office-setup` にリダイレクトされること（`officeGuard` の動作確認）

---

## Phase1-2: 従業員台帳でのポータル連携状態可視化

### 目的

- `offices/{officeId}/employees/{employeeId}` の従業員ドキュメントに、従業員ポータル連携用の `portal` フィールドを追加
- 従業員一覧画面に「ポータル状態」列を追加し、`未招待` / `招待済` / `連携済` / `停止中` を表示
- Phase1では「表示専用」でOK（実際の招待フロー・連携フローは Phase2 以降で実装）

### 対象ファイル

1. **`src/app/types.ts`**
   - `Employee` 型に `portal` フィールドを追加

2. **`src/app/pages/employees/employees.page.ts`**
   - `displayedColumns` に `portal` 列を追加
   - テンプレートに「ポータル状態」列の定義を追加
   - ポータル状態を表示するヘルパーメソッドを追加

3. **`src/app/utils/label-utils.ts`**（オプション）
   - ポータル状態のラベル変換関数を追加（既存の `getWorkingStatusLabel` などと同様のパターン）

### 詳細な変更内容

#### 1. 型定義の変更

**`src/app/types.ts` の変更**:

```typescript
// Employee 型に portal フィールドを追加
export interface Employee {
  // ... 既存フィールド ...

  /** 給与基本情報（社会保険用） */
  payrollSettings?: PayrollSettings | null;

  /** 従業員ポータル連携状態（Phase1では表示専用） */
  portal?: {
    status: 'not_invited' | 'invited' | 'linked' | 'disabled';
    invitedEmail?: string;
    invitedAt?: IsoDateString;
    linkedUserId?: string;
    linkedAt?: IsoDateString;
  } | null;

  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  updatedByUserId?: string;
}
```

**注意事項**:
- `portal` は `optional` フィールドとして追加（既存コードに影響を与えない）
- `portal` が `undefined` または `null` の場合は `not_invited` とみなす
- Phase1では、Firestore ルールの変更は不要（`portal` フィールドは任意のため）

#### 2. ラベル変換関数の追加

**`src/app/utils/label-utils.ts` に追加**:

```typescript
export type PortalStatus = 'not_invited' | 'invited' | 'linked' | 'disabled';

export function getPortalStatusLabel(status?: PortalStatus | null): string {
  switch (status) {
    case 'not_invited':
      return '未招待';
    case 'invited':
      return '招待済';
    case 'linked':
      return '連携済';
    case 'disabled':
      return '停止中';
    default:
      return '未招待';  // undefined または null の場合は 'not_invited' と同等扱い
  }
}

export function getPortalStatusColor(status?: PortalStatus | null): 'default' | 'primary' | 'accent' | 'warn' {
  switch (status) {
    case 'not_invited':
      return 'default';  // 灰色
    case 'invited':
      return 'primary';  // 青色
    case 'linked':
      return 'accent';   // 緑色（または 'primary' でも可）
    case 'disabled':
      return 'warn';     // 赤色（または 'default' でも可）
    default:
      return 'default';
  }
}
```

#### 3. 従業員一覧UIの変更

**`src/app/pages/employees/employees.page.ts` の変更**:

1. **`displayedColumns` に `portal` を追加**:
```typescript
readonly displayedColumns = [
  'name',
  'department',
  'address',
  'weeklyWorkingHours',
  'weeklyWorkingDays',
  'isStudent',
  'monthlyWage',
  'dependents',
  'isInsured',
  'workingStatus',
  'portal',  // 追加
  'updatedBy',
  'updatedAt',
  'actions'
];
```

2. **ヘルパーメソッドの追加**:
```typescript
import { getPortalStatusLabel, getPortalStatusColor } from '../../utils/label-utils';

// クラス内に追加
getPortalStatus(employee: Employee): 'not_invited' | 'invited' | 'linked' | 'disabled' {
  return employee.portal?.status ?? 'not_invited';
}

getPortalStatusLabel = getPortalStatusLabel;
getPortalStatusColor = getPortalStatusColor;
```

3. **テンプレートに「ポータル状態」列を追加**:
```typescript
// employees.page.ts の template 内に追加
<ng-container matColumnDef="portal">
  <th mat-header-cell *matHeaderCellDef class="center">ポータル</th>
  <td mat-cell *matCellDef="let row" class="center">
    <mat-chip [color]="getPortalStatusColor(getPortalStatus(row))">
      {{ getPortalStatusLabel(getPortalStatus(row)) }}
    </mat-chip>
  </td>
</ng-container>
```

**Material Chips のインポート**:
```typescript
import { MatChipsModule } from '@angular/material/chips';

// @Component の imports に追加
imports: [
  // ... 既存の imports ...
  MatChipsModule,  // 追加
]
```

#### 4. `portal` が `undefined` の場合の扱い

**方針**:
- `employee.portal` が `undefined` または `null` の場合は、`not_invited` と同等扱い
- `getPortalStatus()` メソッドで `employee.portal?.status ?? 'not_invited'` を返す
- UI上では「未招待」と表示し、灰色のチップを表示

#### 5. 状態ごとの表示ラベル・色分け

**表示方針**:
- `not_invited`（または `undefined`）: 灰色チップ「未招待」
- `invited`: 青色チップ「招待済」
- `linked`: 緑色チップ「連携済」
- `disabled`: 赤色チップ「停止中」

**Material Chips の使用**:
- `mat-chip` コンポーネントを使用
- `[color]` 属性で色を指定（`'default'` = 灰色、`'primary'` = 青色、`'accent'` = 緑色、`'warn'` = 赤色）

### Firestoreデータへの影響

**Phase1での方針**:
- 既存の `employees` ドキュメントに `portal` フィールドを自動追加するバッチ処理は作成しない
- `portal` が `undefined` の場合は `not_invited` とみなして表示するだけ
- 既存ドキュメントに変更を加えなくても、UI表示だけで成立する

**将来の Phase2 以降**:
- 招待フロー実装時に、`employees/{employeeId}.portal` を `status: 'invited'` などに更新する処理を追加
- その際に、既存データへの影響を考慮する必要がある

### テストケース

#### 1. ポータル状態の表示

- ✅ **テストケース1-1**: `portal` フィールドなしの既存従業員 → 一覧上で「未招待」（灰色チップ）と表示されること
- ✅ **テストケース1-2**: `portal.status = 'invited'` の従業員 → 一覧上で「招待済」（青色チップ）と表示されること
- ✅ **テストケース1-3**: `portal.status = 'linked'` の従業員 → 一覧上で「連携済」（緑色チップ）と表示されること
- ✅ **テストケース1-4**: `portal.status = 'disabled'` の従業員 → 一覧上で「停止中」（赤色チップ）と表示されること
- ✅ **テストケース1-5**: `portal = null` の従業員 → 一覧上で「未招待」（灰色チップ）と表示されること

#### 2. UIレイアウトの確認

- ✅ **テストケース2-1**: 一覧に新しい「ポータル」列を追加しても、既存の列が正しく表示されること
- ✅ **テストケース2-2**: テーブルのソート機能が正常に動作すること（`portal` 列はソート対象外でも可）
- ✅ **テストケース2-3**: レスポンシブレイアウト（モバイル表示）で、テーブルが崩れないこと
- ✅ **テストケース2-4**: 空の従業員一覧でも、エラーが発生しないこと

#### 3. 型安全性の確認

- ✅ **テストケース3-1**: `Employee` 型に `portal` フィールドを追加しても、既存のコードで型エラーが発生しないこと
- ✅ **テストケース3-2**: `employeesService.list()` で取得した `Employee[]` に `portal` フィールドが含まれていること（`undefined` でも可）

---

## スコープ外・今後の拡張メモ

### Phase1で実装しない項目

以下の項目は、Phase1のスコープ外です。将来の Phase2 以降で実装予定です。

#### 1. Email/Password認証の追加

- Firebase Auth で Email/Password を有効化
- ログイン画面の UI を拡張（Google + メールの2択）
- パスワードリセット・メール認証機能

#### 2. 従業員ポータル招待フロー

- `employeePortalInvites` コレクションの作成
- トークン生成・検証ロジック
- `/employee-portal/accept-invite` ページの実装
- 招待メール送信（Firebase Functions またはクライアント側）

#### 3. 事業所参加フローの見直し

- `/office-setup` から「既存事業所一覧から自由参加」をやめる／非推奨化
- 事業所参加は基本「招待リンク」で行う仕組みの実装

#### 4. 複数事業所対応

- `officeMemberships` モデルへの移行
- `CurrentUserService` / `officeGuard` / `roleGuard` のロジックを対応
- 既存データの移行スクリプト

---

## 実装手順（推奨順序）

### Step 1: 型定義の追加

1. `src/app/types.ts` に `Employee.portal` フィールドを追加
2. `src/app/utils/label-utils.ts` に `getPortalStatusLabel()` と `getPortalStatusColor()` 関数を追加

### Step 2: Phase1-1 の実装（employeeロールの `/me` 限定アクセス）

1. `src/app/app.routes.ts` の `/me` ルートに `roleGuard(['admin', 'hr', 'employee'])` を追加
2. 動作確認: `employee` ロールが管理系ルートにアクセスした場合、`/me` にリダイレクトされることを確認

### Step 3: Phase1-2 の実装（従業員台帳でのポータル連携状態可視化）

1. `src/app/pages/employees/employees.page.ts` の `displayedColumns` に `portal` を追加
2. `MatChipsModule` をインポートに追加
3. テンプレートに「ポータル状態」列の定義を追加
4. ヘルパーメソッド `getPortalStatus()` を追加
5. `getPortalStatusLabel` と `getPortalStatusColor` をインポートして使用

### Step 4: テスト・動作確認

1. Phase1-1 のテストケースを実行
2. Phase1-2 のテストケースを実行
3. 既存機能（従業員追加・編集・削除）が正常に動作することを確認

---

## 注意事項・制約

### 1. 既存データとの互換性

- `Employee.portal` フィールドは `optional` として追加するため、既存の `employees` ドキュメントに影響しない
- `portal` が `undefined` の場合は `not_invited` とみなして表示する

### 2. Firestore ルール

- Phase1では、Firestore ルールの変更は不要
- `portal` フィールドは任意のため、既存の `validEmployeeExtendedFields()` 関数に影響しない
- 将来的に Phase2 で招待フローを実装する際に、`portal` フィールドのバリデーションを追加する可能性がある

### 3. パフォーマンス考慮事項

- `portal` フィールドは軽量なオブジェクトのため、一覧取得時のパフォーマンスへの影響は最小限
- `getPortalStatus()` メソッドは単純な null チェックのみのため、パフォーマンス問題は発生しない

### 4. セキュリティ考慮事項

- Phase1では、`portal` フィールドは「表示専用」として扱う
- 実際の `portal.status` を書き換えるような操作は Phase2 以降で実装する

### 5. 実装時の確認ポイント

#### 5-1. MatChipsModule のインポート

- `employees.page.ts` が standalone コンポーネントの場合、`imports` 配列に `MatChipsModule` を追加すればOK
- もし module 管理の場合、該当 module にも `MatChipsModule` を追加する必要がある

#### 5-2. center クラスのスタイル

- 既存列（例：`isInsured`, `dependents`）にも `class="center"` が使われている場合は、そのまま使用可能
- もし `center` クラスが未定義の場合、`employees.page.ts` の `styles` 配列（または共通CSS）に以下を追加：
  ```typescript
  .center { text-align: center; }
  ```

#### 5-3. label-utils.ts の関数スタイル

- 既存の `getWorkingStatusLabel()` などの関数スタイルに合わせて、`getPortalStatusLabel()` と `getPortalStatusColor()` を実装する
- 既存関数と同じパターン（`switch` 文、`default` ケースで `'-'` または適切なデフォルト値を返す）に統一する

### 6. 将来の拡張に関する注意事項

#### 6-1. `/office-setup` へのアクセス制御

- Phase1では `/office-setup` ルートには変更を加えない（現状の `authGuard` + `needsOfficeGuard` のまま）
- 将来的に Phase3 で「事業所参加は招待リンクのみ」という方針に変更する場合、`/office-setup` にも `roleGuard(['admin', 'hr'])` を追加する、または `employee` ロールが来たら `/me` にリダイレクトするなどの調整が必要になる可能性がある
- 現時点では Phase1 のスコープ外だが、設計として頭の片隅に置いておく

#### 6-2. 将来のロール追加時の対応

- 現状のロールは `admin` / `hr` / `employee` の3種類のみのため、無限リダイレクトの懸念はない
- 将来的に `guest` などの新しいロールを追加する場合、`/me` の `roleGuard(['admin','hr','employee'])` にどう含めるか、その時に `roleGuard` の中身やルート側の `allowedRoles` を調整する必要がある
- Phase1では現状のロール構成を前提として実装する

---

## 関連ドキュメント

- `AUTHENTICATION_AND_PORTAL_POLICY.md`: 認証・ロール・従業員ポータル方針（決定版ドラフト）
- `IMPLEMENTATION_GUIDE_PHASE3-15.md`: 口座情報・給与情報管理機能（従業員マイページの拡張）

---

以上で、InsurePath 認証・ロール・従業員ポータル Phase1 の実装指示書は完了です。

実装時は、この指示書に従って段階的に機能を追加していきます。

