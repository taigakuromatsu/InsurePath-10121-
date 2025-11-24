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

