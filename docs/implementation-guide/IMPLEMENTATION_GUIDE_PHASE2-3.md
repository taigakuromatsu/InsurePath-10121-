# Phase2-3 実装指示書: 扶養家族（被扶養者）管理機能

## 📋 概要

Phase2-1でセキュリティ・アクセス制御が強化され、Phase2-2でロール割り当てが改善された状態で、実務上必要な「扶養家族（被扶養者）管理機能」を実装します。

**目的**: 
- 各従業員ごとに扶養家族（被扶養者）情報をFirestore上で管理できるようにする
- admin / hr ユーザーが、所属事業所の従業員に対して扶養家族の追加・編集・削除を行える
- employee ロールのユーザーは、自分本人に紐づく扶養家族一覧を閲覧のみできる
- Guard / Firestore ルールと矛盾しないように、データモデルとアクセス権を整理する

**このフェーズで達成したいゴール**:
- admin / hr が従業員詳細画面から扶養家族を追加・編集・削除できる
- employee がマイページや従業員詳細画面で自分の扶養家族を閲覧できる
- Firestoreルールで適切なアクセス制御が機能している
- 既存の従業員管理機能と自然に統合されている

**前提条件**:
- Phase2-1（セキュリティ・アクセス制御の強化）が実装済み
- Phase2-2（ロール割り当てとユーザー管理の改善）が実装済み
- `Employee`型と`EmployeesService`が実装済み
- `employee-detail-dialog.component.ts`が実装済み

---

## 🧭 スコープ

### 対象とする機能・ファイル

#### データモデル
- `src/app/types.ts` - `Dependent`型と`DependentRelationship`型の追加

#### サービス層
- `src/app/services/dependents.service.ts` - 新規作成（扶養家族のCRUD操作）

#### UI（admin / hr 向け）
- `src/app/pages/employees/employee-detail-dialog.component.ts` - 扶養家族セクションの追加
- `src/app/pages/employees/dependent-form-dialog.component.ts` - 新規作成（扶養家族の追加・編集ダイアログ）

#### UI（employee 向け）
- `src/app/pages/me/my-page.ts` - 扶養家族情報の表示セクション追加（オプション）

#### Firestoreルール
- `firestore.rules` - `offices/{officeId}/employees/{employeeId}/dependents/{dependentId}`のルール追加

### 対象外とするもの

以下の機能はPhase2-3では対象外とします：
- 扶養家族の年次見直し支援機能（将来のフェーズで実装予定）
- 扶養家族の資格判定ロジック（自動判定など、将来の拡張として検討）
- employee ロールによる扶養家族の編集機能（申請ワークフロー機能で実装予定）
- CSVインポート・エクスポート機能（Phase2-5で実装予定）
- 扶養家族情報の履歴管理（将来の拡張として検討）

---

## 📝 現状の挙動と課題

### 1. 従業員情報管理の現状

**現状の挙動**:
- `EmployeesService`により、従業員の基本情報（氏名、生年月日、住所、社会保険情報など）は管理できている
- `employee-detail-dialog.component.ts`で従業員の詳細情報を表示できる
- マイページ（`my-page.ts`）で従業員本人が自分の情報を閲覧できる

**課題**:
- 扶養家族（被扶養者）情報を管理する機能が存在しない
- 従業員詳細画面やマイページに扶養家族情報が表示されない
- admin / hr が扶養家族を登録・更新する手段がない

### 2. データモデルの現状

**現状の構造**:
- `offices/{officeId}/employees/{employeeId}` - 従業員情報のみ
- 扶養家族情報を格納するコレクションが存在しない

**課題**:
- 扶養家族情報をどこに保存するかが未定義
- 扶養家族情報の型定義が存在しない

### 3. アクセス制御の現状

**現状の挙動**:
- Phase2-1で実装されたFirestoreルールにより、`offices/{officeId}/employees/{employeeId}`へのアクセス制御は機能している
- `belongsToOffice()`, `isAdminOrHr()`, `isOwnEmployee()`などの関数が利用可能

**課題**:
- 扶養家族コレクション（`dependents`）へのアクセス制御ルールが未定義
- admin / hr と employee の権限差をどう反映するかが未定義

---

## 📝 仕様（Before / After）

### 1. データモデル観点

#### Before（現状）
```
offices/{officeId}/
  └── employees/{employeeId}/
      ├── name: string
      ├── birthDate: string
      ├── address: string
      └── ...（従業員情報のみ）
```

#### After（Phase2-3実装後）
```
offices/{officeId}/
  └── employees/{employeeId}/
      ├── name: string
      ├── birthDate: string
      ├── address: string
      ├── ...（従業員情報）
      └── dependents/{dependentId}/
          ├── id: string
          ├── name: string
          ├── relationship: DependentRelationship
          ├── dateOfBirth: IsoDateString
          ├── qualificationAcquiredDate?: IsoDateString
          ├── qualificationLossDate?: IsoDateString
          ├── createdAt?: IsoDateString
          └── updatedAt?: IsoDateString
```

### 2. 画面・操作フロー観点

#### Before（現状）
```
1. admin / hr が従業員詳細ダイアログを開く
2. 基本情報、就労条件、社会保険情報などが表示される
3. 扶養家族情報は表示されない
```

#### After（Phase2-3実装後）

**admin / hr 向けフロー**:
```
1. admin / hr が従業員詳細ダイアログを開く
2. 基本情報、就労条件、社会保険情報などが表示される
3. 「扶養家族」セクションが追加され、登録済みの扶養家族一覧が表示される
4. 「扶養家族を追加」ボタンをクリック
5. 扶養家族追加ダイアログが開き、氏名・続柄・生年月日などを入力
6. 保存後、扶養家族一覧に追加される
7. 各扶養家族の「編集」「削除」ボタンから操作可能
```

**employee 向けフロー**:
```
1. employee がマイページまたは従業員詳細ダイアログを開く
2. 「扶養家族」セクションが表示される（閲覧のみ）
3. 自分の扶養家族一覧が表示される
4. 編集・削除ボタンは表示されない（閲覧のみ）
```

---

## 📊 データモデル設計

### Firestoreコレクション構造

```
offices/{officeId}/employees/{employeeId}/dependents/{dependentId}
```

**パス構造の理由**:
- 従業員に紐づく扶養家族情報として、従業員のサブコレクションとして配置
- 事業所IDと従業員IDの両方でアクセス制御が可能
- 既存の`employees`コレクション構造と一貫性がある

### TypeScript型定義

#### `DependentRelationship`型（続柄）

```typescript
export type DependentRelationship = 
  | 'spouse'      // 配偶者
  | 'child'       // 子
  | 'parent'      // 父母
  | 'grandparent' // 祖父母
  | 'sibling'     // 兄弟姉妹
  | 'other';      // その他
```

#### `Dependent`型

```typescript
export interface Dependent {
  id: string;
  name: string;                                    // 必須: 氏名
  relationship: DependentRelationship;             // 必須: 続柄
  dateOfBirth: IsoDateString;                      // 必須: 生年月日（'YYYY-MM-DD'形式）
  qualificationAcquiredDate?: IsoDateString;       // 任意: 資格取得日（'YYYY-MM-DD'形式）
  qualificationLossDate?: IsoDateString;          // 任意: 資格喪失日（'YYYY-MM-DD'形式）
  createdAt?: IsoDateString;                       // 任意: 作成日時
  updatedAt?: IsoDateString;                        // 任意: 更新日時
}
```

**注意**: `isActive`フィールドはPhase2-3では実装しない。資格喪失日から自動判定する機能は将来の拡張として検討。

### 必須フィールド / 任意フィールド

**必須フィールド**:
- `id`: ドキュメントID（Firestoreが自動生成、または手動設定）
- `name`: 氏名（空文字列は不可）
- `relationship`: 続柄（`DependentRelationship`型のいずれか）
- `dateOfBirth`: 生年月日（'YYYY-MM-DD'形式）

**任意フィールド**:
- `qualificationAcquiredDate`: 資格取得日（未設定の場合は表示時に「未設定」と表示）
- `qualificationLossDate`: 資格喪失日（未設定の場合は表示時に「未設定」と表示）
- `createdAt`: 作成日時（保存時に自動設定）
- `updatedAt`: 更新日時（保存時に自動設定）

### バリデーション方針

**クライアント側（Angular）**:
- `name`: 1文字以上、100文字以下（簡易チェック）
- `relationship`: `DependentRelationship`型のいずれかであること
- `dateOfBirth`: 'YYYY-MM-DD'形式であること、過去日のみ許容（将来日はエラー）
- `qualificationAcquiredDate`: 'YYYY-MM-DD'形式であること、`dateOfBirth`以降の日付であること（任意）
- `qualificationLossDate`: 'YYYY-MM-DD'形式であること、`qualificationAcquiredDate`以降の日付であること（任意）

**サーバー側（Firestoreルール）**:
- `name`: string型、1文字以上、100文字以下
- `relationship`: string型、`'spouse' | 'child' | 'parent' | 'grandparent' | 'sibling' | 'other'`のいずれか
- `dateOfBirth`: string型、'YYYY-MM-DD'形式
- `qualificationAcquiredDate`: string型または未設定、'YYYY-MM-DD'形式（設定されている場合）
- `qualificationLossDate`: string型または未設定、'YYYY-MM-DD'形式（設定されている場合）

**注意**: Phase2-3では簡易的なバリデーションのみ実装し、詳細な日付の妥当性チェック（例: 資格喪失日が資格取得日より前でないか）は将来の拡張として検討。

---

## 🎨 画面・UX設計

### admin / hr 向けUI

#### 従業員詳細ダイアログへの追加

**配置場所**: `employee-detail-dialog.component.ts`の既存セクションの後に追加

**セクション構成**:
```
┌─────────────────────────────────────┐
│ 扶養家族                            │
│ ─────────────────────────────────── │
│ [扶養家族を追加] ボタン              │
│                                     │
│ ┌───────────────────────────────┐ │
│ │ 氏名: 山田 花子                │ │
│ │ 続柄: 配偶者                   │ │
│ │ 生年月日: 1990-05-15           │ │
│ │ 資格取得日: 2020-04-01         │ │
│ │ 資格喪失日: -                  │ │
│ │ [編集] [削除]                  │ │
│ └───────────────────────────────┘ │
│                                     │
│ ┌───────────────────────────────┐ │
│ │ 氏名: 山田 太郎                │ │
│ │ 続柄: 子                       │ │
│ │ 生年月日: 2015-08-20           │ │
│ │ 資格取得日: 2020-04-01         │ │
│ │ 資格喪失日: -                  │ │
│ │ [編集] [削除]                  │ │
│ └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**表示内容**:
- 扶養家族が0件の場合: 「扶養家族が登録されていません」というメッセージと「扶養家族を追加」ボタン
- 扶養家族が1件以上の場合: カード形式で一覧表示、各カードに「編集」「削除」ボタン

**ボタン配置**:
- 「扶養家族を追加」ボタン: セクションタイトルの右側、または一覧の上部
- 「編集」「削除」ボタン: 各扶養家族カードの右下

**UI上のボタン表示制御ルール（重要）**:
- **admin / hr**:
  - 従業員詳細ダイアログの「扶養家族」セクションに
    - 「扶養家族を追加」ボタン
    - 各レコードの「編集」「削除」アイコン
    を表示する
- **employee**:
  - 同じセクションでは**一覧のみ**表示し、
    「扶養家族を追加」「編集」「削除」ボタンは一切表示しない

**実装時の注意**:
- `CurrentUserService`の`profile$`から`role`情報を取得し、`*ngIf`で明示的に出し分ける
- `profile.role`が`'admin'`または`'hr'`の場合のみボタンを表示
- `profile.role`が`'employee'`の場合は、一覧のみ表示（ボタンは非表示）

#### 扶養家族追加・編集ダイアログ

**コンポーネント**: `dependent-form-dialog.component.ts`（新規作成）

**フォーム項目**:
```
┌─────────────────────────────────────┐
│ 扶養家族を追加 / 編集                │
├─────────────────────────────────────┤
│ 氏名 *                              │
│ [___________________________]       │
│                                     │
│ 続柄 *                              │
│ [▼ 選択してください]                │
│   - 配偶者                           │
│   - 子                               │
│   - 父母                             │
│   - 祖父母                           │
│   - 兄弟姉妹                         │
│   - その他                           │
│                                     │
│ 生年月日 *                          │
│ [YYYY-MM-DD]                        │
│                                     │
│ 資格取得日（任意）                   │
│ [YYYY-MM-DD]                        │
│                                     │
│ 資格喪失日（任意）                   │
│ [YYYY-MM-DD]                        │
│                                     │
│ [キャンセル] [保存]                  │
└─────────────────────────────────────┘
```

**バリデーション表示**:
- 必須項目が未入力の場合、フィールド下にエラーメッセージを表示
- 日付形式が不正な場合、フィールド下にエラーメッセージを表示

### employee 向けUI

#### マイページへの追加（オプション）

**配置場所**: `my-page.ts`の基本情報セクションの後に追加

**セクション構成**:
```
┌─────────────────────────────────────┐
│ 扶養家族（閲覧のみ）                  │
│ ─────────────────────────────────── │
│                                     │
│ ┌───────────────────────────────┐ │
│ │ 氏名: 山田 花子                │ │
│ │ 続柄: 配偶者                   │ │
│ │ 生年月日: 1990-05-15           │ │
│ │ 資格取得日: 2020-04-01         │ │
│ │ 資格喪失日: -                  │ │
│ └───────────────────────────────┘ │
│                                     │
│ （編集・削除ボタンは表示しない）      │
└─────────────────────────────────────┘
```

**表示内容**:
- 扶養家族が0件の場合: 「扶養家族が登録されていません」というメッセージのみ
- 扶養家族が1件以上の場合: カード形式で一覧表示（編集・削除ボタンなし）

#### 従業員詳細ダイアログでの表示

**配置場所**: `employee-detail-dialog.component.ts`の既存セクションの後に追加

**表示内容**:
- admin / hr と同様のセクション構成だが、「扶養家族を追加」ボタンと「編集」「削除」ボタンは表示しない
- 自分の扶養家族のみ表示（`isOwnEmployee()`で判定）

**UI上のボタン表示制御ルール（重要）**:
- **employee**ロールの場合:
  - 「扶養家族を追加」「編集」「削除」ボタンは一切表示しない
  - 一覧のみ表示（閲覧専用）
- `CurrentUserService`の`profile$`から`role`情報を取得し、`*ngIf`で明示的に制御する

---

## 🔧 サービス層・ルーティング設計

### 新規サービス: `DependentsService`

**ファイル**: `src/app/services/dependents.service.ts`（新規作成）

**役割**:
- 扶養家族情報のCRUD操作を提供
- Firestoreとの通信を担当
- エラーハンドリングとバリデーション

**主なメソッド**:

```typescript
@Injectable({ providedIn: 'root' })
export class DependentsService {
  constructor(private readonly firestore: Firestore) {}

  /**
   * 指定従業員の扶養家族一覧を取得（リアルタイム購読）
   * @param officeId - 事業所ID
   * @param employeeId - 従業員ID
   * @returns 扶養家族一覧のObservable（リアルタイム更新）
   */
  list(officeId: string, employeeId: string): Observable<Dependent[]>

  /**
   * 指定従業員の扶養家族を保存（追加または更新）
   * @param officeId - 事業所ID
   * @param employeeId - 従業員ID
   * @param dependent - 扶養家族情報（idが存在する場合は更新、存在しない場合は追加）
   * @returns Promise<void>
   */
  save(
    officeId: string,
    employeeId: string,
    dependent: Partial<Dependent> & { id?: string }
  ): Promise<void>

  /**
   * 指定従業員の扶養家族を削除
   * @param officeId - 事業所ID
   * @param employeeId - 従業員ID
   * @param dependentId - 扶養家族ID
   * @returns Promise<void>
   */
  delete(officeId: string, employeeId: string, dependentId: string): Promise<void>
}
```

**実装方針**:
- `EmployeesService`の実装パターンに合わせる
- `collectionPath()`のようなプライベートメソッドでパスを生成
- **重要**: `list()`は`Observable<Dependent[]>`を返し、AngularFire / rxfire のリアルタイム購読方式（`collectionData`または`collectionChanges`）を使用する
  - `from(getDocs(ref))`のような一発読みではなく、リアルタイム購読で実装する
  - これにより、別タブで扶養家族を編集した場合も、従業員詳細ダイアログに自動的に反映される
- `save()`は`async`で`Promise<void>`を返す
- `setDoc`に`{ merge: true }`を使用
- `createdAt`と`updatedAt`の扱い:
  - **新規作成時**: `createdAt`と`updatedAt`の両方を現在時刻で必ず設定
  - **更新時**: `updatedAt`のみ更新（`createdAt`は既存の値を保持）

### 既存サービスとの関係

**`EmployeesService`との関係**:
- `DependentsService`は`EmployeesService`とは独立したサービス
- `EmployeesService`のメソッドは変更しない（既存機能への影響を避ける）

**`CurrentOfficeService`との関係**:
- `DependentsService`は`CurrentOfficeService`を使用しない（`officeId`は引数で受け取る）
- コンポーネント側で`CurrentOfficeService`から`officeId`を取得して、`DependentsService`に渡す

### ルーティング設計

**方針**: 専用ページは作成せず、既存のダイアログ内に収める

**理由**:
- 扶養家族情報は従業員情報の一部として扱う方が自然
- 既存の`employee-detail-dialog.component.ts`に統合することで、UXが一貫する
- ルーティングの追加が不要で、実装がシンプル

**将来の拡張**:
- 扶養家族情報が複雑になった場合、`/employees/:employeeId/dependents`のような専用ページを検討可能
- Phase2-3ではダイアログ内に収める方針で進める

---

## 🛡️ セキュリティ / Firestoreルール

### アクセス権限の整理

| ロール | Read（閲覧） | Write（追加・編集・削除） |
|--------|-------------|-------------------------|
| admin | 自分の所属officeの全従業員の扶養家族 | 自分の所属officeの全従業員の扶養家族 |
| hr | 自分の所属officeの全従業員の扶養家族 | 自分の所属officeの全従業員の扶養家族 |
| employee | 自分の扶養家族のみ | 不可（Phase2-3では実装しない） |

**注意**: 
- 他オフィスの扶養家族データには誰もアクセスできない（`belongsToOffice(officeId)`で制御）
- employee ロールの編集機能は将来の「申請ワークフロー」機能で実装予定

### Firestoreルールの追加

**追加場所**: `firestore.rules`の`offices/{officeId}/employees/{employeeId}`ブロック内

**重要**: `firestore.rules`では既に以下のヘルパー関数が定義済みです。新しい関数は作らず、既存の関数名に合わせてください。

**既存の関数**:
- `belongsToOffice(officeId)`: 事業所への所属チェック
- `isAdminOrHr(officeId)`: admin / hr ロールチェック（**注意**: `isInsureAdminOrHr`ではない）
- `isOwnEmployee(officeId, employeeId)`: 自分の従業員レコードかチェック

**ルール案**:

```javascript
match /offices/{officeId} {
  // ... 既存のルール ...

  match /employees/{employeeId} {
    // ... 既存のルール ...

    // 扶養家族情報
    match /dependents/{dependentId} {
      // Read: admin/hrは全従業員の扶養家族を閲覧可能、employeeは自分の扶養家族のみ閲覧可能
      allow read: if belongsToOffice(officeId) && (
        isAdminOrHr(officeId) ||
        isOwnEmployee(officeId, employeeId)
      );
      
      // Write: admin/hrのみ追加・編集・削除可能
      allow create, update, delete: if belongsToOffice(officeId) && isAdminOrHr(officeId);
    }
  }
}
```

**補足**:
- `isAdminOrHr()`関数は既に`firestore.rules`の48-50行目で定義済み
- `isOwnEmployee()`関数は既に`firestore.rules`の63-65行目で定義済み
- 新しい`isInsureAdminOrHr`や`isOwnEmployee`関数は作成しないでください
- `belongsToOffice()`を`write`ルールにも追加することで、他オフィスへの書き込みを明示的に防ぐ

---

## 🔧 実装ステップ

### Step 1: 型定義の追加

**ファイル**: `src/app/types.ts`

**追加内容**:
1. `DependentRelationship`型の定義
2. `Dependent`インターフェースの定義

**実装方針**:
- 既存の型定義（`Employee`, `MonthlyPremium`など）の後に追加
- `IsoDateString`型を使用（既存の型定義と一貫性を保つ）

### Step 2: `DependentsService`の作成

**ファイル**: `src/app/services/dependents.service.ts`（新規作成）

**実装内容**:
1. `@Injectable({ providedIn: 'root' })`デコレータを付けたサービスクラス
2. `collectionPath(officeId: string, employeeId: string)`プライベートメソッド
3. `list(officeId: string, employeeId: string): Observable<Dependent[]>`メソッド
4. `save(officeId: string, employeeId: string, dependent: Partial<Dependent> & { id?: string }): Promise<void>`メソッド
5. `delete(officeId: string, employeeId: string, dependentId: string): Promise<void>`メソッド

**実装方針**:
- `EmployeesService`の実装パターンに合わせる
- **重要**: `list()`はAngularFire / rxfire のリアルタイム購読方式（`collectionData`または`collectionChanges`）を使用する
  - `from(getDocs(ref))`のような一発読みではなく、リアルタイム購読で実装する
  - これにより、別タブで扶養家族を編集した場合も、従業員詳細ダイアログに自動的に反映される
  - `collectionData`を使用する場合、`{ idField: 'id' }`を指定して`Dependent.id`にドキュメントIDを自動的に埋める（手作業でのマージを避ける）
- `setDoc`に`{ merge: true }`を使用
- `createdAt`と`updatedAt`の扱い:
  - **新規作成時**: `createdAt`と`updatedAt`の両方を現在時刻で必ず設定
  - **更新時**: `updatedAt`のみ更新（`createdAt`は既存の値を保持）

### Step 3: ラベルユーティリティの追加

**ファイル**: `src/app/utils/label-utils.ts`（既存ファイルに追加）

**追加内容**:
- `getDependentRelationshipLabel(relationship: DependentRelationship | undefined): string`関数

**実装方針**:
- 既存の`getWorkingStatusLabel()`などの関数と同じパターンで実装
- 続柄の日本語ラベルを返す（例: `'spouse'` → `'配偶者'`）

### Step 4: `dependent-form-dialog.component.ts`の作成

**ファイル**: `src/app/pages/employees/dependent-form-dialog.component.ts`（新規作成）

**実装内容**:
1. Material Dialogコンポーネントとして実装
2. フォーム項目（氏名、続柄、生年月日、資格取得日、資格喪失日）
3. バリデーション（必須項目チェック、日付形式チェック）
4. 「キャンセル」「保存」ボタン

**実装方針**:
- `employee-form-dialog.component.ts`の実装パターンに合わせる
- Reactive Formsを使用
- `MAT_DIALOG_DATA`で従業員IDと扶養家族情報（編集時）を受け取る
- `MatDialogRef`で結果を返す

### Step 5: `employee-detail-dialog.component.ts`の拡張

**ファイル**: `src/app/pages/employees/employee-detail-dialog.component.ts`

**追加内容**:
1. 「扶養家族」セクションの追加
2. `DependentsService`の注入
3. 扶養家族一覧の取得と表示
4. 「扶養家族を追加」ボタン（admin / hr のみ表示）
5. 各扶養家族の「編集」「削除」ボタン（admin / hr のみ表示）

**実装方針**:
1. `CurrentUserService`を注入してロールを取得（`profile$`から`role`を取得）
2. `DependentsService.list()`で扶養家族一覧を取得（リアルタイム購読）
3. **重要**: `*ngIf`でロールに応じてボタンの表示/非表示を明示的に制御
   - `profile.role === 'admin' || profile.role === 'hr'`の場合のみ、「扶養家族を追加」「編集」「削除」ボタンを表示
   - `profile.role === 'employee'`の場合は、一覧のみ表示（ボタンは非表示）
4. 「扶養家族を追加」ボタンクリック時に`dependent-form-dialog.component.ts`を開く
5. 「編集」ボタンクリック時に既存データを渡して`dependent-form-dialog.component.ts`を開く
6. 「削除」ボタンクリック時に確認ダイアログを表示してから削除

**注意**: UI側でボタンを非表示にすることで、employee ロールが誤ってボタンをクリックしてFirestoreルールでエラーになることを防ぐ

### Step 6: `my-page.ts`の拡張（オプション）

**ファイル**: `src/app/pages/me/my-page.ts`

**追加内容**:
1. 「扶養家族」セクションの追加（閲覧のみ）
2. `DependentsService`の注入
3. 自分の扶養家族一覧の取得と表示

**実装方針**:
1. `CurrentUserService`から`employeeId`を取得
2. `CurrentOfficeService`から`officeId`を取得
3. `DependentsService.list()`で自分の扶養家族一覧を取得
4. カード形式で表示（編集・削除ボタンなし）

**注意**: このステップはオプション。従業員詳細ダイアログで閲覧できるため、マイページへの追加は必須ではない。

### Step 7: Firestoreルールの追加

**ファイル**: `firestore.rules`

**追加場所**: `offices/{officeId}/employees/{employeeId}`ブロック内（既存のルールの後）

**追加内容**:
```javascript
match /dependents/{dependentId} {
  // Read: admin/hrは全従業員の扶養家族を閲覧可能、employeeは自分の扶養家族のみ閲覧可能
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    isOwnEmployee(officeId, employeeId)
  );
  
  // Write: admin/hrのみ追加・編集・削除可能
  allow create, update, delete: if belongsToOffice(officeId) && isAdminOrHr(officeId);
}
```

**注意**: `belongsToOffice(officeId)`を`write`ルールにも追加することで、他オフィスへの書き込みを明示的に防ぐ

**実装方針**:
- 既存の`employees`ルールの直後に追加
- 既存のユーティリティ関数（`belongsToOffice`, `isAdminOrHr`, `isOwnEmployee`）を活用
- バリデーションルールはPhase2-3では簡易的なもののみ（型チェック程度）

---

## ✅ テスト観点 / 受け入れ条件

### テストケース 1: admin が従業員の扶養家族を追加・編集・削除できる

**前提条件**:
- admin ロールのユーザーがログイン済み
- 自分の所属officeの従業員が存在する

**実行手順**:
1. 従業員一覧ページで従業員を選択
2. 従業員詳細ダイアログを開く
3. 「扶養家族」セクションを確認
4. 「扶養家族を追加」ボタンをクリック
5. フォームに情報を入力して保存
6. 扶養家族一覧に追加されたことを確認
7. 「編集」ボタンをクリックして情報を更新
8. 「削除」ボタンをクリックして削除

**期待結果**:
- ✅ 扶養家族が追加される
- ✅ 扶養家族が編集できる
- ✅ 扶養家族が削除できる
- ✅ Firestoreに正しく保存される
- ✅ Firestoreルールでアクセスが許可される

### テストケース 2: hr が従業員の扶養家族を追加・編集・削除できる

**前提条件**:
- hr ロールのユーザーがログイン済み
- 自分の所属officeの従業員が存在する

**実行手順**:
- テストケース 1 と同じ

**期待結果**:
- ✅ admin と同様に追加・編集・削除ができる
- ✅ Firestoreルールでアクセスが許可される

### テストケース 3: employee が自分の扶養家族を閲覧できる（編集・削除は不可）

**前提条件**:
- employee ロールのユーザーがログイン済み
- 自分の`employeeId`が設定されている
- 自分の扶養家族が登録されている

**実行手順**:
1. マイページまたは従業員詳細ダイアログを開く
2. 「扶養家族」セクションを確認
3. 自分の扶養家族一覧が表示されることを確認
4. 「編集」「削除」ボタンが表示されないことを確認

**期待結果**:
- ✅ 自分の扶養家族一覧が表示される
- ✅ 「編集」「削除」ボタンが表示されない
- ✅ Firestoreルールで読み取りアクセスが許可される
- ✅ Firestoreルールで書き込みアクセスが拒否される

### テストケース 4: employee が他人の扶養家族を閲覧できない

**前提条件**:
- employee ロールのユーザーがログイン済み
- 自分の`employeeId`が設定されている
- 他の従業員の扶養家族が登録されている

**実行手順**:
1. 従業員一覧ページで他の従業員を選択しようとする
2. 従業員詳細ダイアログが開かない、または扶養家族セクションが表示されないことを確認

**期待結果**:
- ✅ 他の従業員の扶養家族が表示されない
- ✅ Firestoreルールでアクセスが拒否される

### テストケース 5: 他オフィスの扶養家族にアクセスできない

**前提条件**:
- admin ロールのユーザーがログイン済み
- 別のofficeの従業員の扶養家族が存在する

**実行手順**:
1. FirestoreコンソールまたはAPI経由で他オフィスの扶養家族にアクセスしようとする

**期待結果**:
- ✅ Firestoreルールでアクセスが拒否される
- ✅ `belongsToOffice(officeId)`が`false`になる

### テストケース 6: バリデーションの動作確認

**前提条件**:
- admin ロールのユーザーがログイン済み

**実行手順**:
1. 「扶養家族を追加」ダイアログを開く
2. 必須項目（氏名、続柄、生年月日）を空のまま保存しようとする
3. エラーメッセージが表示されることを確認
4. 日付形式が不正な場合、エラーメッセージが表示されることを確認

**期待結果**:
- ✅ 必須項目のバリデーションが機能する
- ✅ 日付形式のバリデーションが機能する
- ✅ エラーメッセージが適切に表示される

---

## 🚀 今後の拡張の余地

### 1. 年次見直し・資格判定支援機能

**現状**: Phase2-3では実装しない

**将来の拡張**:
- 基準年月日時点での扶養家族抽出機能
- 資格取得・喪失日の自動判定ロジック
- 年次見直しチェックリストの生成

### 2. 扶養家族情報の履歴管理

**現状**: Phase2-3では実装しない

**将来の拡張**:
- 扶養家族情報の変更履歴を記録
- 過去の状態を参照できる機能

### 3. employee ロールによる編集機能

**現状**: Phase2-3では閲覧のみ

**将来の拡張**:
- 申請ワークフロー機能で、employee が扶養家族情報の変更を申請できるようにする
- admin / hr が申請を承認・却下する機能

### 4. CSVインポート・エクスポート機能

**現状**: Phase2-3では実装しない

**将来の拡張**:
- 扶養家族情報の一括インポート（Phase2-5で実装予定）
- 扶養家族情報のエクスポート（Phase2-5で実装予定）

### 5. 扶養家族情報の詳細なバリデーション

**現状**: Phase2-3では簡易的なバリデーションのみ

**将来の拡張**:
- 資格取得日が生年月日より前でないかのチェック
- 資格喪失日が資格取得日より前でないかのチェック
- 続柄に応じた年齢制限のチェック（例: 子は18歳未満など）

### 6. `isActive`フィールドの追加

**現状**: Phase2-3では実装しない

**将来の拡張**:
- `qualificationLossDate`から自動的に`isActive`を判定する機能
- 有効な扶養家族のみを表示するフィルタ機能

---

## 📝 実装チェックリスト

### 型定義
- [ ] `src/app/types.ts`に`DependentRelationship`型を追加
- [ ] `src/app/types.ts`に`Dependent`インターフェースを追加

### サービス層
- [ ] `src/app/services/dependents.service.ts`を新規作成
- [ ] `list()`メソッドを実装
- [ ] `save()`メソッドを実装
- [ ] `delete()`メソッドを実装

### ユーティリティ
- [ ] `src/app/utils/label-utils.ts`に`getDependentRelationshipLabel()`関数を追加

### UI（admin / hr 向け）
- [ ] `src/app/pages/employees/dependent-form-dialog.component.ts`を新規作成
- [ ] フォーム項目（氏名、続柄、生年月日、資格取得日、資格喪失日）を実装
- [ ] バリデーションを実装
- [ ] `src/app/pages/employees/employee-detail-dialog.component.ts`に扶養家族セクションを追加
- [ ] 「扶養家族を追加」ボタンを実装（admin / hr のみ表示）
- [ ] 「編集」「削除」ボタンを実装（admin / hr のみ表示）

### UI（employee 向け）
- [ ] `src/app/pages/me/my-page.ts`に扶養家族セクションを追加（オプション）
- [ ] 閲覧のみの表示を実装

### Firestoreルール
- [ ] `firestore.rules`に`dependents`コレクションのルールを追加
- [ ] Read権限のルールを実装（admin/hr と employee の区別）
- [ ] Write権限のルールを実装（admin/hr のみ）

### テスト・確認
- [ ] テストケース 1: admin が扶養家族を追加・編集・削除できる
- [ ] テストケース 2: hr が扶養家族を追加・編集・削除できる
- [ ] テストケース 3: employee が自分の扶養家族を閲覧できる（編集・削除は不可）
- [ ] テストケース 4: employee が他人の扶養家族を閲覧できない
- [ ] テストケース 5: 他オフィスの扶養家族にアクセスできない
- [ ] テストケース 6: バリデーションの動作確認

---

## 🎨 参考実装

以下のファイルを参考にしてください：

- `src/app/types.ts` - 既存の型定義（`Employee`, `MonthlyPremium`など）
- `src/app/services/employees.service.ts` - 既存のサービス実装パターン
- `src/app/pages/employees/employee-form-dialog.component.ts` - 既存のフォームダイアログ実装
- `src/app/pages/employees/employee-detail-dialog.component.ts` - 既存の詳細ダイアログ実装
- `src/app/utils/label-utils.ts` - 既存のラベルユーティリティ関数
- `firestore.rules` - 既存のFirestoreルール（Phase2-1で実装）

---

## 📌 補足事項

### 1. 日付形式の扱い

**実装時の注意**:
- `dateOfBirth`, `qualificationAcquiredDate`, `qualificationLossDate`は`IsoDateString`型（`string`）を使用
- フォームでは`<input type="date">`を使用して、'YYYY-MM-DD'形式で入力・表示
- Firestoreには文字列として保存

### 2. 続柄の選択肢

**実装時の注意**:
- `DependentRelationship`型の選択肢は、実務上の一般的な続柄を想定
- 「その他」を選択肢に含めることで、特殊なケースにも対応可能
- 将来的に選択肢を追加する場合は、`DependentRelationship`型を拡張する

### 3. 資格取得日・資格喪失日の扱い

**実装時の注意**:
- Phase2-3では、資格取得日・資格喪失日は任意フィールドとして実装
- 未設定の場合は表示時に「未設定」または「-」と表示
- 将来的に自動判定ロジックを追加する場合は、これらのフィールドを活用する

### 4. エラーハンドリング

**実装時の注意**:
- Firestoreへのアクセスが失敗した場合、適切なエラーメッセージを表示
- ネットワークエラーなどの場合、ユーザーに再試行を促す
- `MatSnackBar`を使用してエラーメッセージを表示（既存の実装パターンに合わせる）

---

以上で実装指示書は完了です。不明点があれば確認してください。

