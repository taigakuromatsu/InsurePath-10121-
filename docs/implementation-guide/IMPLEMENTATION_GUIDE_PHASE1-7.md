# Phase1-7 実装指示書: マイページ（自分の保険情報ビュー）の実装

## 📋 概要

ログインユーザーが、自分の社員情報・月次/賞与保険料・申請状況を1画面で確認できるマイページ機能を実装します。

**目的**: 従業員本人が自分の社会保険料情報を一元的に確認できるようにする

**前提条件**:
- `users/{uid}` に `officeId`, `employeeId` が設定済み
- `EmployeesService`, `MonthlyPremiumsService`, `BonusPremiumsService` は実装済み
- `CurrentUserService` でユーザープロファイル（`employeeId`含む）を取得可能

---

## 🎯 実装対象ファイル

### 新規作成・編集
- `src/app/pages/me/my-page.ts` - マイページコンポーネント（既存のプレースホルダーを実装）

### 既存ファイルの確認（変更不要の可能性あり）
- `src/app/app.routes.ts` - ルートは既に設定済み（`/me`）
- `src/app/app.ts` - サイドメニューは既に設定済み

### サービス拡張（必須）
- `src/app/services/monthly-premiums.service.ts` - 従業員IDでフィルタするメソッド追加（`listByOfficeAndEmployee`）

**注意**: ファイル名とクラス名の整合性について
- 既存のファイル名: `src/app/pages/me/my-page.ts`
- 既存のクラス名: `MyPage`
- ルート定義: `import('./pages/me/my-page').then((m) => m.MyPage)`
- 上記の通り整合性が取れているため、ファイル名・クラス名の変更は不要です。

---

## 📐 UI要件

### レイアウト構成（4つのブロック）

```
┌─────────────────────────────────────────┐
│  [ヘッダーカード]                         │
│  マイページ - 自分の保険情報              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [1. 基本情報ブロック]                    │
│  - 氏名、所属部署、入社日                 │
│  - 標準報酬月額（健康保険・厚生年金）     │
│  - 社会保険加入状況                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [2. 月次保険料一覧ブロック]              │
│  - 年月、健康保険、介護保険、厚生年金     │
│  - 本人負担額・会社負担額・合計           │
│  - 直近12ヶ月分を表示（降順）            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [3. 賞与保険料一覧ブロック]              │
│  - 支給日、賞与支給額、標準賞与額         │
│  - 健康保険・厚生年金の本人/会社負担      │
│  - 直近12件を表示（降順）                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [4. 申請状況ブロック]（将来実装予定）    │
│  - プレースホルダー表示                  │
└─────────────────────────────────────────┘
```

### UIデザイン要件

1. **ヘッダーカード**
   - 既存ページ（`monthly-premiums.page.ts`, `bonus-premiums.page.ts`）と同様のスタイル
   - グラデーション背景（例: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`）
   - アイコン: `person`
   - タイトル: "マイページ"
   - 説明文: "自分の社員情報と保険料明細を確認できます"

2. **各ブロック**
   - `mat-card` を使用
   - セクションタイトルにアイコンを配置
   - 空データ時は適切なメッセージを表示

3. **テーブルスタイル**
   - 既存の `employees.page.ts` や `bonus-premiums.page.ts` と同様のスタイル
   - ホバー効果、ヘッダー背景色の統一

4. **空状態の表示**
   - アイコン + メッセージ + 必要に応じてアクションボタン
   - 例: "まだ計算された保険料はありません"

---

## 🔧 機能要件

### 1. データ取得ロジック

#### 1.1 ユーザー情報の取得
```typescript
// CurrentUserService から profile$ を購読
// profile.employeeId と profile.officeId を取得
```

#### 1.2 従業員情報の取得
```typescript
// EmployeesService.get(officeId, employeeId) または
// EmployeesService.list(officeId) で全件取得後、employeeId でフィルタ
```

#### 1.3 月次保険料の取得
```typescript
// MonthlyPremiumsService に従業員IDでフィルタするメソッドを追加（必須）
// listByOfficeAndEmployee(officeId, employeeId) を実装
// Firestore のクエリで employeeId フィルタ + orderBy('yearMonth', 'desc') + limit(12)
// これにより、読み取り回数を最小化（1クエリで済む）
```

#### 1.4 賞与保険料の取得
```typescript
// BonusPremiumsService.listByOfficeAndEmployee(officeId, employeeId)
// 既に実装済みのメソッドを使用
```

### 2. セキュリティ要件

- **アクセス制御**: ログインユーザーの `employeeId` でフィルタし、自分の情報のみを表示
- **データ分離**: `CurrentUserService.profile$` から取得した `employeeId` のみを使用
- **バリデーション**: `employeeId` が未設定の場合は適切なメッセージを表示

### 3. データ表示要件

#### 3.1 基本情報ブロック
- 氏名、所属部署、入社日
- 健康保険: 等級、標準報酬月額
- 厚生年金: 等級、標準報酬月額
- 社会保険加入フラグ（`isInsured`）

#### 3.2 月次保険料一覧
- 列: 年月、健康保険（本人/会社）、介護保険（本人/会社）、厚生年金（本人/会社）、合計（本人/会社）
- ソート: 年月降順（最新が上）
- 表示件数: 直近12ヶ月分（または全件）

#### 3.3 賞与保険料一覧
- 列: 支給日、賞与支給額、標準賞与額、健康保険（本人/会社）、厚生年金（本人/会社）、合計（本人/会社）
- ソート: 支給日降順（最新が上）
- 表示件数: 直近12件（または全件）

#### 3.4 申請状況ブロック
- 現時点ではプレースホルダーのみ
- メッセージ: "申請機能は今後実装予定です"

### 4. 空データ時の処理

- **従業員情報未設定（employeeId が無い場合）**: "従業員として登録されていないため、マイページ情報は表示されません。"
  - 管理者ユーザーなど、従業員と紐付いていないアカウントでも適切に表示される文言
- **月次保険料なし**: "まだ計算された月次保険料はありません。"
- **賞与保険料なし**: "まだ登録された賞与保険料はありません。"

---

## 💻 実装詳細

### Step 1: コンポーネントの基本構造

```typescript
// src/app/pages/me/my-page.ts

import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe, DecimalPipe, NgForOf, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { combineLatest, map, switchMap, of } from 'rxjs';

import { CurrentUserService } from '../../services/current-user.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { EmployeesService } from '../../services/employees.service';
import { MonthlyPremiumsService } from '../../services/monthly-premiums.service';
import { BonusPremiumsService } from '../../services/bonus-premiums.service';
import { Employee, MonthlyPremium, BonusPremium } from '../../types';

@Component({
  selector: 'ip-my-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatTableModule,
    AsyncPipe,
    NgIf,
    NgForOf,
    DatePipe,
    DecimalPipe
  ],
  template: `...`,
  styles: [`...`]
})
export class MyPage {
  // サービス注入
  private readonly currentUser = inject(CurrentUserService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly employeesService = inject(EmployeesService);
  private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
  private readonly bonusPremiumsService = inject(BonusPremiumsService);

  // データ取得ロジック
  // ...
}
```

### Step 2: データ取得の実装

#### 2.1 従業員情報の取得
```typescript
readonly employee$ = combineLatest([
  this.currentUser.profile$,
  this.currentOffice.officeId$
]).pipe(
  switchMap(([profile, officeId]) => {
    if (!profile?.employeeId || !officeId) {
      return of(null);
    }
    return this.employeesService.list(officeId).pipe(
      map(employees => employees.find(e => e.id === profile.employeeId) ?? null)
    );
  })
);
```

#### 2.2 月次保険料の取得（直近12ヶ月）

**重要**: パフォーマンスを考慮し、サービス側に `listByOfficeAndEmployee` メソッドを実装して、Firestore のクエリで直接フィルタリングします。これにより、読み取り回数を最小化（1クエリ）できます。

```typescript
readonly monthlyPremiums$ = combineLatest([
  this.currentUser.profile$,
  this.currentOffice.officeId$
]).pipe(
  switchMap(([profile, officeId]) => {
    if (!profile?.employeeId || !officeId) {
      return of([]);
    }
    return this.monthlyPremiumsService.listByOfficeAndEmployee(
      officeId,
      profile.employeeId
    );
  })
);
```

#### 2.3 賞与保険料の取得
```typescript
readonly bonusPremiums$ = combineLatest([
  this.currentUser.profile$,
  this.currentOffice.officeId$
]).pipe(
  switchMap(([profile, officeId]) => {
    if (!profile?.employeeId || !officeId) {
      return of([]);
    }
    return this.bonusPremiumsService.listByOfficeAndEmployee(
      officeId,
      profile.employeeId
    );
  })
);
```

### Step 3: テンプレートの実装

#### 3.1 ヘッダーカード
```html
<mat-card class="header-card">
  <div class="header-content">
    <div class="header-icon">
      <mat-icon>person</mat-icon>
    </div>
    <div class="header-text">
      <h1>マイページ</h1>
      <p>自分の社員情報と保険料明細を確認できます</p>
    </div>
  </div>
</mat-card>
```

#### 3.2 基本情報ブロック
```html
<mat-card class="content-card">
  <div class="page-header">
    <h2>
      <mat-icon>info</mat-icon>
      基本情報
    </h2>
  </div>

  <ng-container *ngIf="employee$ | async as employee; else noEmployee">
    <div class="info-grid">
      <div class="info-item">
        <span class="label">氏名</span>
        <span class="value">{{ employee.name }}</span>
      </div>
      <!-- 他の項目も同様に -->
    </div>
  </ng-container>

  <ng-template #noEmployee>
    <div class="empty-state">
      <mat-icon>person_off</mat-icon>
      <p>従業員として登録されていないため、マイページ情報は表示されません。</p>
    </div>
  </ng-template>
</mat-card>
```

#### 3.3 月次保険料一覧ブロック
```html
<mat-card class="content-card">
  <div class="page-header">
    <h2>
      <mat-icon>account_balance_wallet</mat-icon>
      月次保険料
    </h2>
  </div>

  <ng-container *ngIf="monthlyPremiums$ | async as premiums">
    <div class="table-container" *ngIf="premiums.length > 0; else noMonthlyPremiums">
      <table mat-table [dataSource]="premiums" class="premium-table">
        <!-- 列定義 -->
      </table>
    </div>

    <ng-template #noMonthlyPremiums>
      <div class="empty-state">
        <mat-icon>pending_actions</mat-icon>
        <p>まだ計算された月次保険料はありません。</p>
      </div>
    </ng-template>
  </ng-container>
</mat-card>
```

#### 3.4 賞与保険料一覧ブロック
```html
<mat-card class="content-card">
  <div class="page-header">
    <h2>
      <mat-icon>workspace_premium</mat-icon>
      賞与保険料
    </h2>
  </div>

  <ng-container *ngIf="bonusPremiums$ | async as bonuses">
    <div class="table-container" *ngIf="bonuses.length > 0; else noBonusPremiums">
      <table mat-table [dataSource]="bonuses" class="bonus-table">
        <!-- 列定義 -->
      </table>
    </div>

    <ng-template #noBonusPremiums>
      <div class="empty-state">
        <mat-icon>pending_actions</mat-icon>
        <p>まだ登録された賞与保険料はありません。</p>
      </div>
    </ng-template>
  </ng-container>
</mat-card>
```

#### 3.5 申請状況ブロック（プレースホルダー）
```html
<mat-card class="content-card">
  <div class="page-header">
    <h2>
      <mat-icon>description</mat-icon>
      申請状況
    </h2>
  </div>

  <div class="empty-state">
    <mat-icon>construction</mat-icon>
    <p>申請機能は今後実装予定です。</p>
  </div>
</mat-card>
```

### Step 4: スタイルの実装

既存のページ（`monthly-premiums.page.ts`, `bonus-premiums.page.ts`, `employees.page.ts`）と同様のスタイルを適用：

```scss
.header-card {
  margin-bottom: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
}

.content-card {
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.page-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e0e0e0;
}

.page-header h2 {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: #666;
}

.empty-state mat-icon {
  font-size: 48px;
  height: 48px;
  width: 48px;
  color: #9ca3af;
  margin-bottom: 0.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-item .label {
  color: #6b7280;
  font-size: 0.9rem;
}

.info-item .value {
  font-weight: 600;
  color: #111827;
  font-size: 1.1rem;
}

.table-container {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

table {
  width: 100%;
}

th, td {
  padding: 12px 16px;
}
```

---

## ✅ 受け入れ条件

### 機能要件
1. ✅ ログインユーザーの `employeeId` でフィルタされ、自分の情報のみが表示される
2. ✅ 月次保険料・賞与保険料は本人のものだけが読み込まれる
3. ✅ 空データ時は適切なメッセージが表示される
4. ✅ 基本情報、月次保険料、賞与保険料が正しく表示される

### セキュリティ要件
1. ✅ 正しいユーザーでログインした時だけ、自分の情報だけが見える
2. ✅ 別社員の情報に直接アクセスできない（`employeeId` フィルタにより保証）
3. ✅ `employeeId` が未設定の場合は適切なメッセージを表示

### データ整合性
1. ✅ 月次・賞与の数字が各一覧画面（`monthly-premiums.page.ts`, `bonus-premiums.page.ts`）と一致している
2. ✅ 年月・支給日のソート順が正しい（降順）

### UI/UX要件
1. ✅ 既存ページと統一されたデザイン
2. ✅ レスポンシブ対応（モバイルでも見やすい）
3. ✅ ローディング状態の適切な表示（必要に応じて）

---

## 🔍 実装時の注意点

### 1. サービスメソッドの追加（必須）

**重要**: パフォーマンスを考慮し、`MonthlyPremiumsService` に従業員IDでフィルタするメソッドを追加します。これにより、Firestore の読み取り回数を最小化（1クエリ）できます。

`MonthlyPremiumsService` に以下のメソッドを追加してください：

```typescript
// src/app/services/monthly-premiums.service.ts

// 既存のインポート文を以下のように更新:
// import { Firestore, collection, doc, getDocs, query, setDoc, where, orderBy, limit } from '@angular/fire/firestore';

/**
 * 指定事業所・指定従業員の月次保険料一覧を取得する
 * 直近12ヶ月分を降順で取得
 *
 * @param officeId - 事業所ID
 * @param employeeId - 従業員ID
 * @returns MonthlyPremium の配列（Observable）
 */
listByOfficeAndEmployee(
  officeId: string,
  employeeId: string
): Observable<MonthlyPremium[]> {
  const collectionRef = this.getCollectionRef(officeId);
  const q = query(
    collectionRef,
    where('employeeId', '==', employeeId),
    orderBy('yearMonth', 'desc'),
    limit(12) // 直近12ヶ月に絞る
  );

  return from(getDocs(q)).pipe(
    map((snapshot) =>
      snapshot.docs.map(
        (d) =>
          ({
            id: d.id,
            ...(d.data() as any)
          } as MonthlyPremium)
      )
    )
  );
}
```

**注意**: Firestore のインデックスが必要な場合があります。`employeeId` と `yearMonth` の複合インデックスが自動的に作成されない場合は、Firestore コンソールで手動で作成してください。

### 2. エラーハンドリング

- `employeeId` が未設定の場合の処理
  - 管理者ユーザーなど、従業員と紐付いていないアカウントでも適切なメッセージを表示
- `officeId` が未設定の場合の処理
- データ取得エラー時の処理

### 3. パフォーマンス

- 月次保険料の取得は、サービス側の `limit(12)` で直近12ヶ月分に限定
- Firestore のクエリで直接フィルタリングすることで、読み取り回数を最小化（1クエリ）
- コンポーネント側での追加フィルタリングは不要

### 4. 日付フォーマット

- 年月: `YYYY-MM` 形式
- 支給日: `YYYY-MM-DD` 形式
- `DatePipe` を使用して適切にフォーマット

---

## 📝 実装チェックリスト

- [ ] `MonthlyPremiumsService` に `listByOfficeAndEmployee` メソッドを追加
- [ ] Firestore のインデックスが必要な場合は作成（`employeeId` + `yearMonth` の複合インデックス）
- [ ] コンポーネントの基本構造を作成
- [ ] `CurrentUserService` から `profile$` を取得
- [ ] 従業員情報の取得ロジックを実装
- [ ] 月次保険料の取得ロジックを実装（`listByOfficeAndEmployee` を使用）
- [ ] 賞与保険料の取得ロジックを実装
- [ ] ヘッダーカードのUIを実装
- [ ] 基本情報ブロックのUIを実装
- [ ] 月次保険料一覧ブロックのUIを実装
- [ ] 賞与保険料一覧ブロックのUIを実装
- [ ] 申請状況ブロック（プレースホルダー）を実装
- [ ] 空データ時のメッセージを実装
- [ ] スタイルを既存ページと統一
- [ ] セキュリティ要件を満たしているか確認
- [ ] データ整合性を確認（他の画面と一致しているか）
- [ ] エラーハンドリングを実装
- [ ] レスポンシブ対応を確認

---

## 🎨 参考実装

以下のファイルを参考にしてください：

- `src/app/pages/premiums/monthly/monthly-premiums.page.ts` - 月次保険料一覧のUIパターン
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts` - 賞与保険料一覧のUIパターン
- `src/app/pages/employees/employees.page.ts` - テーブル表示のUIパターン
- `src/app/pages/masters/masters.page.ts` - カードレイアウトのUIパターン

---

## 📌 補足事項

1. **ルーティング**: 既に `app.routes.ts` に `/me` ルートが設定されているため、追加作業は不要です。
   - ファイル名: `my-page.ts`
   - クラス名: `MyPage`
   - ルート定義: `import('./pages/me/my-page').then((m) => m.MyPage)`
   - 上記の通り整合性が取れているため、変更不要です。

2. **サイドメニュー**: 既に `app.ts` にマイページのメニュー項目が設定されているため、追加作業は不要です。

3. **ガード**: `authGuard` と `officeGuard` が既に適用されているため、認証・事業所設定のチェックは自動的に行われます。

4. **Firestore インデックス**: `listByOfficeAndEmployee` メソッドで `where('employeeId', '==', employeeId)` と `orderBy('yearMonth', 'desc')` を併用する場合、Firestore の複合インデックスが必要になる可能性があります。エラーメッセージに従って、Firestore コンソールでインデックスを作成してください。

5. **将来の拡張**: 申請状況ブロックは、Phase1-8以降で実装予定の申請機能と連携する予定です。

---

以上で実装指示書は完了です。不明点があれば確認してください。




---

# Phase1-7 実装指示書（追加）: マイページ基本情報セクションの拡張・改良

## 📋 概要

マイページの基本情報セクションを拡張し、従業員が自分の契約条件・住所連絡先・保険の状態を一通り確認できるようにします。

**目的**: マイページに表示する項目を整理・拡張し、従業員本人が自分の情報を包括的に確認できるようにする

**前提条件**:
- `Employee` 型に必要なフィールドが定義済み（`types.ts` を参照）
- `label-utils.ts` に一部のラベル変換関数が実装済み（既存関数を再利用）
- 既存のマイページ実装（`my-page.ts`）が存在する

**重要**: 実装前に必ず `types.ts` の `Employee` 型定義を確認し、フィールド名が完全一致していることを確認してください。詳細は「0. フィールド名の確認」セクションを参照してください。

---

## 🎯 実装対象ファイル

### 編集対象
- `src/app/pages/me/my-page.ts` - 基本情報セクションの拡張

### 拡張が必要な可能性があるファイル
- `src/app/utils/label-utils.ts` - ラベル変換関数の追加（必要に応じて）

---

## 📐 UI要件

### レイアウト構成（基本情報セクション内）

```
┌─────────────────────────────────────────┐
│  [1. 基本プロフィールカード]              │
│  - 氏名、カナ、所属、生年月日、性別       │
│  - 入社日、退社日（ある場合のみ）         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [2. 住所・連絡先カード]                  │
│  - 郵便番号、住所、電話番号、連絡先メール │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [3. 就労条件カード]                      │
│  - 雇用形態、所定労働時間、所定労働日数   │
│  - 契約期間の見込み、学生フラグ           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [4. 社会保険・資格情報（サマリ）カード]  │
│  - 社会保険対象、健康保険等級/標準報酬    │
│  - 厚生年金等級/標準報酬                 │
│  - 資格取得日（健保）、資格取得日（厚年） │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [5. 就業状態カード]                      │
│  - 現在の就業状態、状態開始日             │
│  - 保険料の扱い                           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [6. 詳細情報（折りたたみセクション）]    │
│  - 被保険者整理番号、被保険者記号         │
│  - 被保険者番号、厚生年金番号             │
│  - 資格取得区分、資格喪失日、喪失理由区分 │
│  - 状態終了日、研修                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [7. マイナンバー（マスク表示）]          │
│  - ***-****-1234（登録済）形式           │
└─────────────────────────────────────────┘
```

### UIデザイン要件

1. **各カード**
   - `mat-card` を使用
   - カードタイトルにアイコンを配置
   - `info-grid` レイアウトで項目を表示

2. **折りたたみセクション**
   - `mat-expansion-panel` を使用して詳細情報を折りたたみ可能にする
   - デフォルトは閉じた状態

3. **マイナンバーのマスク表示**
   - 末尾4桁のみ表示し、それ以外は `***-****-` でマスク
   - 「（登録済）」のラベルを表示

4. **空データ時の表示**
   - 未設定の項目は「未設定」と表示
   - 退社日など、条件によって表示しない項目は非表示

---

## 🔧 機能要件

### 0. フィールド名の確認（重要）

**実装前に必ず確認**: 以下のフィールド名は `types.ts` の `Employee` 型定義と完全一致していることを確認済みです。

- ✅ `healthStandardMonthly` - 健康保険の標準報酬月額（既存実装と一致）
- ✅ `pensionStandardMonthly` - 厚生年金の標準報酬月額（既存実装と一致）
- ✅ `employmentType` - 雇用形態（`EmploymentType` 型）
- ✅ `workingStatus` - 就業状態（`WorkingStatus` 型）
- ✅ `premiumTreatment` - 保険料の扱い（`PremiumTreatment` 型）
- ✅ `healthInsuredSymbol` - 被保険者記号（**注意**: 「被保険者整理番号」というフィールドは存在しません）
- ✅ `healthInsuredNumber` - 被保険者番号
- ✅ `pensionNumber` - 厚生年金番号

**EmploymentType の値**: `'regular' | 'contract' | 'part' | 'アルバイト' | 'other'`
- 型の値自体が `'アルバイト'` となっているため、ラベル変換関数でも `case 'アルバイト':` を使用します。

### 1. 表示項目の分類

#### 1.1 「必ず載せたい」項目（基本表示）

**基本プロフィール系**
- 氏名（既に表示済）
- カナ（`employee.kana`）
- 所属（`employee.department`、既に表示済）
- 生年月日（`employee.birthDate`）または年齢表示
- 性別（`employee.sex`）
- 入社日（`employee.hireDate`、既に表示済）
- 退社日（`employee.retireDate`、ある場合のみ表示）

**住所・連絡先**
- 郵便番号（`employee.postalCode`）
- 住所（`employee.address`）
- 電話番号（`employee.phone`）
- 連絡先メール（`employee.contactEmail`）

**就労条件**
- 雇用形態（`employee.employmentType`）
- 所定労働時間（週）（`employee.weeklyWorkingHours`）
- 所定労働日数（週）（`employee.weeklyWorkingDays`）
- 契約期間の見込み（`employee.contractPeriodNote`）
- 学生フラグ（`employee.isStudent`）

**社会保険・資格情報（サマリ）**
- 社会保険対象（`employee.isInsured`、既に表示済）
- 健康保険 等級／標準報酬月額（既に表示済）
- 厚生年金 等級／標準報酬月額（既に表示済）
- 資格取得日（健保）（`employee.healthQualificationDate`）
- 資格取得日（厚年）（`employee.pensionQualificationDate`）

**就業状態**
- 現在の就業状態（`employee.workingStatus`）
- 状態開始日（`employee.workingStatusStartDate`）
- 保険料の扱い（`employee.premiumTreatment`）

#### 1.2 「詳細情報としてならアリ」項目（折りたたみセクション）

- 被保険者記号（`employee.healthInsuredSymbol`）
- 被保険者番号（`employee.healthInsuredNumber`）
- 厚生年金番号（`employee.pensionNumber`）
- 資格取得区分（健保）（`employee.healthQualificationKind`）
- 資格取得区分（厚年）（`employee.pensionQualificationKind`）
- 資格喪失日（健保）（`employee.healthLossDate`）
- 資格喪失日（厚年）（`employee.pensionLossDate`）
- 喪失理由区分（健保）（`employee.healthLossReasonKind`）
- 喪失理由区分（厚年）（`employee.pensionLossReasonKind`）
- 状態終了日（`employee.workingStatusEndDate`）
- 研修（該当する場合、`Employee` 型にフィールドがない場合は実装不要）

#### 1.3 「マイページには基本出さない／マスクしたい」項目

**マイナンバー**
- 末尾4桁のみ表示（例: `***-****-1234（登録済）`）
- `employee.myNumber` が存在する場合のみ表示

**備考**
- マイページには表示しない（`employee` 型に `memo` や `note` フィールドがあっても非表示）

### 2. ラベル変換関数の追加

**既存関数の確認**: `label-utils.ts` には以下の関数が既に存在します。これらは**既存関数を再利用**します：
- ✅ `getInsuranceQualificationKindLabel` - 資格取得区分のラベル変換
- ✅ `getInsuranceLossReasonKindLabel` - 喪失理由区分のラベル変換
- ✅ `getWorkingStatusLabel` - 就業状態のラベル変換
- ✅ `getPremiumTreatmentLabel` - 保険料の扱いのラベル変換

**新規追加が必要な関数**: `label-utils.ts` に以下の関数を**新規追加**します：

```typescript
// 雇用形態のラベル変換
// 注意: EmploymentType の型定義は 'regular' | 'contract' | 'part' | 'アルバイト' | 'other'
// 型の値自体が 'アルバイト' となっているため、case も 'アルバイト' を使用
export function getEmploymentTypeLabel(type?: EmploymentType): string {
  switch (type) {
    case 'regular':
      return '正社員';
    case 'contract':
      return '契約社員';
    case 'part':
      return 'パート';
    case 'アルバイト':  // 型の値が 'アルバイト' のため、そのまま使用
      return 'アルバイト';
    case 'other':
      return 'その他';
    default:
      return '未設定';
  }
}

// 性別のラベル変換
export function getSexLabel(sex?: Sex): string {
  switch (sex) {
    case 'male':
      return '男性';
    case 'female':
      return '女性';
    case 'other':
      return 'その他';
    default:
      return '未設定';
  }
}
```

### 3. 年齢計算関数の追加

生年月日から年齢を計算する関数を追加（オプション）：

```typescript
// 年齢計算（生年月日から現在の年齢を計算）
export function calculateAge(birthDate: IsoDateString): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
```

### 4. マイナンバーのマスク表示関数

```typescript
// マイナンバーのマスク表示（末尾4桁のみ表示）
export function maskMyNumber(myNumber?: MyNumber): string | null {
  if (!myNumber) {
    return null;
  }
  // ハイフンやスペースを除去
  const cleaned = myNumber.replace(/[-\s]/g, '');
  if (cleaned.length < 4) {
    return null;
  }
  const last4 = cleaned.slice(-4);
  return `***-****-${last4}（登録済）`;
}
```

---

## 💻 実装詳細

### Step 1: ラベル変換関数の追加

**重要**: 以下の関数は既に `label-utils.ts` に存在します。これらは**新規追加せず、既存関数をインポートして再利用**してください：
- `getInsuranceQualificationKindLabel`
- `getInsuranceLossReasonKindLabel`
- `getWorkingStatusLabel`
- `getPremiumTreatmentLabel`

`src/app/utils/label-utils.ts` に以下の関数を**新規追加**します：

```typescript
import { EmploymentType, Sex, MyNumber, IsoDateString } from '../types';

export function getEmploymentTypeLabel(type?: EmploymentType): string {
  switch (type) {
    case 'regular':
      return '正社員';
    case 'contract':
      return '契約社員';
    case 'part':
      return 'パート';
    case 'アルバイト':
      return 'アルバイト';
    case 'other':
      return 'その他';
    default:
      return '未設定';
  }
}

export function getSexLabel(sex?: Sex): string {
  switch (sex) {
    case 'male':
      return '男性';
    case 'female':
      return '女性';
    case 'other':
      return 'その他';
    default:
      return '未設定';
  }
}

export function calculateAge(birthDate: IsoDateString): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function maskMyNumber(myNumber?: MyNumber): string | null {
  if (!myNumber) {
    return null;
  }
  const cleaned = myNumber.replace(/[-\s]/g, '');
  if (cleaned.length < 4) {
    return null;
  }
  const last4 = cleaned.slice(-4);
  return `***-****-${last4}（登録済）`;
}
```

### Step 2: コンポーネントの拡張

`src/app/pages/me/my-page.ts` を拡張：

#### 2.1 インポートの追加

```typescript
import { MatExpansionModule } from '@angular/material/expansion';
import {
  getEmploymentTypeLabel,
  getSexLabel,
  calculateAge,
  maskMyNumber,
  // 以下は既存関数を再利用
  getInsuranceQualificationKindLabel,
  getInsuranceLossReasonKindLabel,
  getWorkingStatusLabel,
  getPremiumTreatmentLabel
} from '../../utils/label-utils';
```

**重要**: `@Component` の `imports` 配列に `MatExpansionModule` を追加する必要があります。

```typescript
@Component({
  selector: 'ip-my-page',
  standalone: true,
  imports: [
    // ... 既存のインポート ...
    MatExpansionModule,  // ← 追加
    // ... 既存のインポート ...
  ],
  // ...
})
```

#### 2.2 コンポーネントクラスにヘルパーメソッドを追加

```typescript
export class MyPage {
  // ... 既存のコード ...

  // ヘルパーメソッド
  protected readonly getEmploymentTypeLabel = getEmploymentTypeLabel;
  protected readonly getSexLabel = getSexLabel;
  protected readonly calculateAge = calculateAge;
  protected readonly maskMyNumber = maskMyNumber;
  protected readonly getInsuranceQualificationKindLabel = getInsuranceQualificationKindLabel;
  protected readonly getInsuranceLossReasonKindLabel = getInsuranceLossReasonKindLabel;
  protected readonly getWorkingStatusLabel = getWorkingStatusLabel;
  protected readonly getPremiumTreatmentLabel = getPremiumTreatmentLabel;
}
```

#### 2.3 テンプレートの拡張

既存の「基本情報」セクションを以下のように拡張：

```html
<mat-card class="content-card">
  <div class="page-header">
    <h2>
      <mat-icon>info</mat-icon>
      基本情報
    </h2>
  </div>

  <ng-container *ngIf="employee$ | async as employee; else noEmployee">
    <!-- 1. 基本プロフィールカード -->
    <mat-card class="sub-card">
      <div class="sub-card-header">
        <h3>
          <mat-icon>person</mat-icon>
          基本プロフィール
        </h3>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">氏名</span>
          <span class="value">{{ employee.name }}</span>
        </div>
        <div class="info-item" *ngIf="employee.kana">
          <span class="label">カナ</span>
          <span class="value">{{ employee.kana }}</span>
        </div>
        <div class="info-item">
          <span class="label">所属</span>
          <span class="value">{{ employee.department || '未設定' }}</span>
        </div>
        <div class="info-item" *ngIf="employee.birthDate">
          <span class="label">生年月日</span>
          <span class="value">
            {{ employee.birthDate | date: 'yyyy年MM月dd日' }}
            <span class="age-badge">（{{ calculateAge(employee.birthDate) }}歳）</span>
          </span>
        </div>
        <div class="info-item" *ngIf="employee.sex">
          <span class="label">性別</span>
          <span class="value">{{ getSexLabel(employee.sex) }}</span>
        </div>
        <div class="info-item">
          <span class="label">入社日</span>
          <span class="value">{{ employee.hireDate | date: 'yyyy-MM-dd' }}</span>
        </div>
        <div class="info-item" *ngIf="employee.retireDate">
          <span class="label">退社日</span>
          <span class="value">{{ employee.retireDate | date: 'yyyy-MM-dd' }}</span>
        </div>
      </div>
    </mat-card>

    <!-- 2. 住所・連絡先カード -->
    <mat-card class="sub-card">
      <div class="sub-card-header">
        <h3>
          <mat-icon>home</mat-icon>
          住所・連絡先
        </h3>
      </div>
      <div class="info-grid">
        <div class="info-item" *ngIf="employee.postalCode">
          <span class="label">郵便番号</span>
          <span class="value">{{ employee.postalCode }}</span>
        </div>
        <div class="info-item" *ngIf="employee.address">
          <span class="label">住所</span>
          <span class="value">{{ employee.address }}</span>
        </div>
        <div class="info-item" *ngIf="employee.phone">
          <span class="label">電話番号</span>
          <span class="value">{{ employee.phone }}</span>
        </div>
        <div class="info-item" *ngIf="employee.contactEmail">
          <span class="label">連絡先メール</span>
          <span class="value">{{ employee.contactEmail }}</span>
        </div>
        <div class="info-item" *ngIf="!employee.postalCode && !employee.address && !employee.phone && !employee.contactEmail">
          <span class="value" style="color: #6b7280;">住所・連絡先情報が未設定です</span>
        </div>
      </div>
    </mat-card>

    <!-- 3. 就労条件カード -->
    <mat-card class="sub-card">
      <div class="sub-card-header">
        <h3>
          <mat-icon>work</mat-icon>
          就労条件
        </h3>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">雇用形態</span>
          <span class="value">{{ getEmploymentTypeLabel(employee.employmentType) }}</span>
        </div>
        <div class="info-item" *ngIf="employee.weeklyWorkingHours != null">
          <span class="label">所定労働時間（週）</span>
          <span class="value">{{ employee.weeklyWorkingHours }}時間</span>
        </div>
        <div class="info-item" *ngIf="employee.weeklyWorkingDays != null">
          <span class="label">所定労働日数（週）</span>
          <span class="value">{{ employee.weeklyWorkingDays }}日</span>
        </div>
        <div class="info-item" *ngIf="employee.contractPeriodNote">
          <span class="label">契約期間の見込み</span>
          <span class="value">{{ employee.contractPeriodNote }}</span>
        </div>
        <div class="info-item" *ngIf="employee.isStudent">
          <span class="label">学生フラグ</span>
          <span class="value">学生アルバイト</span>
        </div>
      </div>
    </mat-card>

    <!-- 4. 社会保険・資格情報（サマリ）カード -->
    <mat-card class="sub-card">
      <div class="sub-card-header">
        <h3>
          <mat-icon>health_and_safety</mat-icon>
          社会保険・資格情報
        </h3>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">社会保険加入状況</span>
          <span class="value" [class.inactive]="!employee.isInsured">
            {{ employee.isInsured ? '加入中' : '未加入' }}
          </span>
        </div>
        <div class="info-item">
          <span class="label">健康保険 等級 / 標準報酬月額</span>
          <span class="value">
            {{ employee.healthGrade ? '等級 ' + employee.healthGrade : '未設定' }}
            <ng-container *ngIf="employee.healthStandardMonthly != null">
              / {{ employee.healthStandardMonthly | number }} 円
            </ng-container>
          </span>
        </div>
        <div class="info-item">
          <span class="label">厚生年金 等級 / 標準報酬月額</span>
          <span class="value">
            {{ employee.pensionGrade ? '等級 ' + employee.pensionGrade : '未設定' }}
            <ng-container *ngIf="employee.pensionStandardMonthly != null">
              / {{ employee.pensionStandardMonthly | number }} 円
            </ng-container>
          </span>
        </div>
        <div class="info-item" *ngIf="employee.healthQualificationDate">
          <span class="label">資格取得日（健保）</span>
          <span class="value">{{ employee.healthQualificationDate | date: 'yyyy-MM-dd' }}</span>
        </div>
        <div class="info-item" *ngIf="employee.pensionQualificationDate">
          <span class="label">資格取得日（厚年）</span>
          <span class="value">{{ employee.pensionQualificationDate | date: 'yyyy-MM-dd' }}</span>
        </div>
      </div>
    </mat-card>

    <!-- 5. 就業状態カード -->
    <mat-card class="sub-card" *ngIf="employee.workingStatus">
      <div class="sub-card-header">
        <h3>
          <mat-icon>event</mat-icon>
          就業状態
        </h3>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">現在の就業状態</span>
          <span class="value">{{ getWorkingStatusLabel(employee.workingStatus) }}</span>
        </div>
        <div class="info-item" *ngIf="employee.workingStatusStartDate">
          <span class="label">状態開始日</span>
          <span class="value">{{ employee.workingStatusStartDate | date: 'yyyy-MM-dd' }}</span>
        </div>
        <div class="info-item" *ngIf="employee.premiumTreatment">
          <span class="label">保険料の扱い</span>
          <span class="value">{{ getPremiumTreatmentLabel(employee.premiumTreatment) }}</span>
        </div>
      </div>
    </mat-card>

    <!-- 6. 詳細情報（折りたたみセクション） -->
    <mat-expansion-panel class="detail-panel">
      <mat-expansion-panel-header>
        <mat-panel-title>
          <mat-icon>info_outline</mat-icon>
          詳細情報
        </mat-panel-title>
        <mat-panel-description>
          被保険者番号、資格情報の詳細など
        </mat-panel-description>
      </mat-expansion-panel-header>
      <div class="info-grid">
        <div class="info-item" *ngIf="employee.healthInsuredSymbol">
          <span class="label">被保険者記号</span>
          <span class="value">{{ employee.healthInsuredSymbol }}</span>
        </div>
        <div class="info-item" *ngIf="employee.healthInsuredNumber">
          <span class="label">被保険者番号</span>
          <span class="value">{{ employee.healthInsuredNumber }}</span>
        </div>
        <!-- 注意: 「被保険者整理番号」というフィールドは Employee 型に存在しません -->
        <div class="info-item" *ngIf="employee.pensionNumber">
          <span class="label">厚生年金番号</span>
          <span class="value">{{ employee.pensionNumber }}</span>
        </div>
        <div class="info-item" *ngIf="employee.healthQualificationKind">
          <span class="label">資格取得区分（健保）</span>
          <span class="value">{{ getInsuranceQualificationKindLabel(employee.healthQualificationKind) }}</span>
        </div>
        <div class="info-item" *ngIf="employee.pensionQualificationKind">
          <span class="label">資格取得区分（厚年）</span>
          <span class="value">{{ getInsuranceQualificationKindLabel(employee.pensionQualificationKind) }}</span>
        </div>
        <div class="info-item" *ngIf="employee.healthLossDate">
          <span class="label">資格喪失日（健保）</span>
          <span class="value">{{ employee.healthLossDate | date: 'yyyy-MM-dd' }}</span>
        </div>
        <div class="info-item" *ngIf="employee.pensionLossDate">
          <span class="label">資格喪失日（厚年）</span>
          <span class="value">{{ employee.pensionLossDate | date: 'yyyy-MM-dd' }}</span>
        </div>
        <div class="info-item" *ngIf="employee.healthLossReasonKind">
          <span class="label">喪失理由区分（健保）</span>
          <span class="value">{{ getInsuranceLossReasonKindLabel(employee.healthLossReasonKind) }}</span>
        </div>
        <div class="info-item" *ngIf="employee.pensionLossReasonKind">
          <span class="label">喪失理由区分（厚年）</span>
          <span class="value">{{ getInsuranceLossReasonKindLabel(employee.pensionLossReasonKind) }}</span>
        </div>
        <div class="info-item" *ngIf="employee.workingStatusEndDate">
          <span class="label">状態終了日</span>
          <span class="value">{{ employee.workingStatusEndDate | date: 'yyyy-MM-dd' }}</span>
        </div>
      </div>
    </mat-expansion-panel>

    <!-- 7. マイナンバー（マスク表示） -->
    <!-- 注意: maskMyNumber() を *ngIf と {{ }} の両方で呼び出しているため、2回評価されます。
         パフォーマンス上の問題はありませんが、認識しておいてください。
         必要に応じて、コンポーネント側で一度だけ評価して変数に格納する方法も検討できます。 -->
    <mat-card class="sub-card" *ngIf="maskMyNumber(employee.myNumber)">
      <div class="sub-card-header">
        <h3>
          <mat-icon>lock</mat-icon>
          マイナンバー
        </h3>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">個人番号</span>
          <span class="value">{{ maskMyNumber(employee.myNumber) }}</span>
        </div>
      </div>
    </mat-card>
  </ng-container>

  <ng-template #noEmployee>
    <div class="empty-state">
      <mat-icon>person_off</mat-icon>
      <p>従業員として登録されていないため、マイページ情報は表示されません。</p>
    </div>
  </ng-template>
</mat-card>
```

#### 2.4 スタイルの追加

```scss
.sub-card {
  margin-bottom: 1rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.sub-card-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.sub-card-header h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
}

.sub-card-header mat-icon {
  font-size: 20px;
  width: 20px;
  height: 20px;
  color: #6b7280;
}

.age-badge {
  color: #6b7280;
  font-size: 0.9rem;
  font-weight: normal;
  margin-left: 0.5rem;
}

.detail-panel {
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.detail-panel mat-expansion-panel-header {
  padding: 1rem;
}

.detail-panel mat-panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
```

---

## ✅ 受け入れ条件

### 機能要件
1. ✅ 基本プロフィール、住所・連絡先、就労条件、社会保険・資格情報、就業状態が正しく表示される
2. ✅ 詳細情報は折りたたみセクションで表示され、デフォルトは閉じた状態
3. ✅ マイナンバーは末尾4桁のみマスク表示される
4. ✅ 未設定の項目は「未設定」と表示されるか、非表示になる
5. ✅ 退社日は退社している場合のみ表示される

### UI/UX要件
1. ✅ 各カードが適切にレイアウトされている
2. ✅ 既存のマイページデザインと統一されている
3. ✅ レスポンシブ対応（モバイルでも見やすい）
4. ✅ ラベル変換関数が正しく動作している

### セキュリティ要件
1. ✅ マイナンバーはマスク表示され、フル表示されない
2. ✅ 備考などの事務側メモは表示されない

---

## 🔍 実装時の注意点

### 1. データの存在確認
- 各項目は `*ngIf` で存在確認を行い、存在しない場合は適切に処理する
- 退社日など、条件によって表示しない項目は `*ngIf` で制御
- **フィールド名の確認**: `types.ts` の `Employee` 型定義と完全一致していることを確認（上記「0. フィールド名の確認」を参照）

### 2. 日付フォーマット
- 生年月日: `yyyy年MM月dd日` 形式（年齢も併記）
- その他の日付: `yyyy-MM-dd` 形式

### 3. 数値フォーマット
- 標準報酬月額などは `DecimalPipe` で3桁区切り表示

### 4. ラベル変換関数
- `label-utils.ts` に追加する関数は、既存の関数と統一されたスタイルで実装
- 未設定の場合は「未設定」を返す

### 5. マイナンバーのマスク表示
- ハイフンやスペースを除去してから末尾4桁を抽出
- 4桁未満の場合は表示しない
- **パフォーマンス注意**: テンプレート内で `maskMyNumber(employee.myNumber)` を `*ngIf` と `{{ }}` の両方で呼び出すと2回評価されます。パフォーマンス上の問題はありませんが、認識しておいてください。必要に応じて、コンポーネント側で一度だけ評価して変数に格納する方法も検討できます。

### 6. Angular Material モジュールのインポート
- `MatExpansionModule` は `import` 文だけでなく、`@Component` の `imports` 配列にも追加する必要があります
- `DecimalPipe` は既存実装で `imports` 配列に含まれているため、追加不要です

---

## 📝 実装チェックリスト

- [ ] **types.ts の Employee 型定義を確認**（フィールド名の整合性確認）
- [ ] `label-utils.ts` に `getEmploymentTypeLabel` 関数を追加（新規）
- [ ] `label-utils.ts` に `getSexLabel` 関数を追加（新規）
- [ ] `label-utils.ts` に `calculateAge` 関数を追加（新規）
- [ ] `label-utils.ts` に `maskMyNumber` 関数を追加（新規）
- [ ] 既存関数（`getInsuranceQualificationKindLabel` など）をインポートして再利用
- [ ] `my-page.ts` に `MatExpansionModule` をインポート
- [ ] `@Component` の `imports` 配列に `MatExpansionModule` を追加（重要）
- [ ] `my-page.ts` にラベル変換関数をインポート
- [ ] `DecimalPipe` が `imports` 配列に含まれているか確認（既存実装で確認済み）
- [ ] 基本プロフィールカードを実装
- [ ] 住所・連絡先カードを実装
- [ ] 就労条件カードを実装
- [ ] 社会保険・資格情報（サマリ）カードを実装
- [ ] 就業状態カードを実装
- [ ] 詳細情報の折りたたみセクションを実装
- [ ] マイナンバーのマスク表示を実装
- [ ] スタイルを追加・調整
- [ ] レスポンシブ対応を確認
- [ ] 空データ時の表示を確認
- [ ] セキュリティ要件を確認（マイナンバーのマスク表示）

---

## 🎨 参考実装

以下のファイルを参考にしてください：

- `src/app/pages/me/my-page.ts` - 既存のマイページ実装
- `src/app/utils/label-utils.ts` - ラベル変換関数の実装パターン
- `src/app/types.ts` - `Employee` 型の定義

---

## 📌 補足事項

1. **既存実装との統合**: 既存の「基本情報」セクションを拡張する形で実装します。既存の表示項目は維持しつつ、新しいカードを追加します。

2. **パフォーマンス**: データ取得は既存の `employee$` Observable を使用するため、追加のクエリは不要です。

3. **将来の拡張**: 詳細情報セクションは、必要に応じて項目を追加できるように拡張可能な構造にしています。

4. **アクセシビリティ**: `mat-expansion-panel` を使用することで、キーボード操作にも対応しています。

5. **フィールド名の整合性**: 実装前に必ず `types.ts` の `Employee` 型定義を確認し、フィールド名が完全一致していることを確認してください。特に以下の点に注意：
   - `healthStandardMonthly`, `pensionStandardMonthly` は既存実装と一致
   - 「被保険者整理番号」というフィールドは存在しない（`healthInsuredSymbol` は「被保険者記号」のみ）
   - `EmploymentType` の値は `'regular' | 'contract' | 'part' | 'アルバイト' | 'other'`（型の値自体が `'アルバイト'`）

6. **既存関数の再利用**: `label-utils.ts` には既に以下の関数が存在します。これらは新規追加せず、既存関数をインポートして再利用してください：
   - `getInsuranceQualificationKindLabel`
   - `getInsuranceLossReasonKindLabel`
   - `getWorkingStatusLabel`
   - `getPremiumTreatmentLabel`

7. **Angular Material モジュール**: `MatExpansionModule` は `import` 文だけでなく、`@Component` の `imports` 配列にも追加する必要があります。`DecimalPipe` は既存実装で `imports` 配列に含まれているため、追加不要です。

8. **マイナンバーのマスク表示**: テンプレート内で `maskMyNumber()` を `*ngIf` と `{{ }}` の両方で呼び出すと2回評価されます。パフォーマンス上の問題はありませんが、認識しておいてください。

---

以上で実装指示書は完了です。不明点があれば確認してください。

