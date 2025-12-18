# Phase1-10 実装指示書: 負担構成ダッシュボード機能の実装

## 📋 概要

ダッシュボードページで、事業所全体の社会保険料負担状況をざっくり把握できるようにします。

**目的**: 
- 事業所全体の社会保険料負担状況を一目で把握できるKPIカードを表示
- 今月の会社負担額合計と前月比の変化を可視化
- 経営判断に役立つ情報を提供

**前提条件**:
- `MonthlyPremiumsService.listByOfficeAndYearMonth`は既に実装済み
- `EmployeesService.list`で従業員一覧を取得可能
- `MonthlyPremium.totalEmployer`で会社負担額を取得可能
- `Employee.isInsured`で社会保険加入者を判定可能

**実装スタイル**:
- **重要**: 既存の`dashboard.page.ts`のスタイルを維持し、`monthly-premiums.page.ts`と同様に`signal`/`computed`ベースで実装します
- サービスのObservableから値を取得する場合は`firstValueFrom(...)`で1回分だけ受け取ります
- `combineLatest`や`switchMap`などのObservableチェーンは新たに増やしません

---

## 🎯 実装対象ファイル

### 編集（必須）
- `src/app/pages/dashboard/dashboard.page.ts` - メインのダッシュボードコンポーネント

### 編集（必要に応じて）
- `src/app/services/monthly-premiums.service.ts` - 集計用のヘルパーメソッドを追加（オプション）

### 参照のみ（変更不要）
- `src/app/services/employees.service.ts` - 従業員数取得に使用
- `src/app/services/current-office.service.ts` - 事業所ID取得に使用
- `src/app/types.ts` - 型定義の参照

---

## 🔧 機能要件

### 必須スコープ（Phase1-10で実装）

#### 1. 従業員数カード

**要件**:
- 対象事業所の従業員数を表示
- 可能であれば「社会保険加入者数」（`isInsured === true`の従業員数）を表示
- なければ「登録されている従業員数」でOK

**実装方針**:
- `EmployeesService.list(officeId)`で従業員一覧を取得
- `isInsured === true`の従業員数をカウント（可能な場合）
- または、全従業員数をカウント

**フォールバック処理**:
- `isInsured === true`の従業員が1人もいない場合（`insuredEmployeeCount === 0`）は、「登録済み従業員」のラベル＋`employeeCount`を表示する
- これにより、「加入者数が0」より「登録済み従業員」として表示する方が自然になる
- テンプレート側の`*ngIf`判定で自然にこの挙動になるように実装する

**表示形式**:
- メインの大きな数値で表示（例: `15人` または `12人`）
- ラベル: 「登録済み従業員」または「社会保険加入者」

#### 2. 月次保険料カード

**要件**:
- 「今月の会社負担額合計」をメインの大きな数値で表示
- 対象年月は「当月（`new Date()`の`YYYY-MM`）」を基本とする
- `monthlyPremiums`コレクションに保存されているデータから集計
- 会社負担 = `MonthlyPremium.totalEmployer`の合計

**実装方針**:
- `MonthlyPremiumsService.listByOfficeAndYearMonth(officeId, currentYearMonth)`で当月の月次保険料を取得
- `totalEmployer`を合計して表示
- データが存在しない場合は`0`または`-`を表示

**表示形式**:
- メインの大きな数値で表示（例: `¥1,234,567`）
- ラベル: 「今月の会社負担額」
- 余裕があればツールチップやサブテキストで「本人負担合計」も補足表示
- **任意**: カードのサブラベルなどに「（対象年月: YYYY-MM）」を表示してもよい（例: 「今月の会社負担額（対象年月: 2025-11）」）

#### 3. トレンドカード

**要件**:
- 「前月比」の変化を表示
- 対象:
  - 今月の「会社負担額合計」
  - 前月の「会社負担額合計」
- 差分または増減率（%）を計算
- 例: `+12.3%` や `▲5.4%` のような表示
- 前月データが存在しない場合は`-`や「データなし」と表示

**実装方針**:
- 当月と前月の`yearMonth`を計算（`YYYY-MM`形式）
- 両方の月次保険料を取得して`totalEmployer`を合計
- 増減率を計算: `((今月 - 前月) / 前月) * 100`
- 前月データが存在しない場合、または前月の合計が`0`の場合は`null`を返し、`-`を表示
- **重要**: 前月の合計が`0`の場合も`-`（N/A）表示とし、無理に`100%`増などは出さない

**表示形式**:
- メインの大きな数値で表示（例: `+12.3%` または `▲5.4%`）
- ラベル: 「前月比の変化」
- 増加の場合は緑色、減少の場合は赤色で表示（任意）

---

### 拡張スコープ（将来の実装）

#### 4. 賞与保険料の集計（拡張案）

**要件**:
- 当月に支給された賞与保険料の会社負担額合計を表示
- `bonusPremiums`コレクションから、当月（`payDate`が当月に属する）のデータを集計
- `BonusPremium.totalEmployer`の合計

**実装方針**:
- `BonusPremiumsService.listByOfficeAndEmployee(officeId)`で全賞与保険料を取得
- `payDate`が当月に属するものをフィルタリング
- `totalEmployer`を合計

**注意**: Phase1-10の必須範囲では扱いません。拡張案として仕様書に記載します。

#### 5. グラフ表示（拡張案）

**要件**:
- 過去12ヶ月の会社負担額推移をグラフで表示
- Chart.jsまたはng2-chartsを使用

**実装方針**:
- 過去12ヶ月の`yearMonth`を生成
- 各月の`totalEmployer`を集計
- グラフライブラリで可視化

**注意**: Phase1-10の必須範囲では扱いません。拡張案として仕様書に記載します。

---

## 💻 実装詳細

### Step 1: 状態管理とデータ取得の実装

#### 1.1 状態管理の定義

```typescript
// dashboard.page.ts

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { EmployeesService } from '../../services/employees.service';
import { MonthlyPremiumsService } from '../../services/monthly-premiums.service';
import { Employee, MonthlyPremium } from '../../types';

@Component({
  selector: 'ip-dashboard-page',
  standalone: true,
  // 重要: DashboardPageのimports配列には、既存の[MatCardModule, MatIconModule]に加えて、
  // DecimalPipe, NgIf を追加してください（既存のimportは削除しない）
  // 例）最終的には次のようなimportsになるイメージ：
  // imports: [MatCardModule, MatIconModule, DecimalPipe, NgIf],
  // ... 既存のtemplateとstylesはそのまま維持
})
export class DashboardPage implements OnInit {
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly employeesService = inject(EmployeesService);
  private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);

  readonly officeId$ = this.currentOffice.officeId$;

  // 状態管理用のsignal
  readonly employeeCount = signal<number | null>(null);
  readonly insuredEmployeeCount = signal<number | null>(null);
  readonly currentMonthTotalEmployer = signal<number | null>(null);
  readonly previousMonthTotalEmployer = signal<number | null>(null);

  // 計算済みの値（computed）
  readonly trendPercentage = computed(() => {
    const current = this.currentMonthTotalEmployer();
    const previous = this.previousMonthTotalEmployer();
    
    // 前月の合計が0の場合もnullを返す（無理に100%増などは出さない）
    if (current === null || previous === null || previous === 0) {
      return null;
    }
    
    return ((current - previous) / previous) * 100;
  });

  readonly trendDisplay = computed(() => {
    const trend = this.trendPercentage();
    if (trend === null) {
      return '-';
    }
    
    const sign = trend >= 0 ? '+' : '';
    return `${sign}${trend.toFixed(1)}%`;
  });

  readonly trendColor = computed(() => {
    const trend = this.trendPercentage();
    if (trend === null) {
      return '#999';
    }
    return trend >= 0 ? '#2e7d32' : '#d32f2f'; // 緑: 増加、赤: 減少
  });
}
```

#### 1.2 データ取得メソッドの実装

```typescript
// dashboard.page.ts

ngOnInit(): void {
  this.loadDashboardData();
}

private async loadDashboardData(): Promise<void> {
  const officeId = await firstValueFrom(this.officeId$);
  if (!officeId) {
    return;
  }

  try {
    // 従業員数の取得
    await this.loadEmployeeCount(officeId);

    // 月次保険料の集計
    await this.loadMonthlyPremiumsTotals(officeId);
  } catch (error) {
    console.error('ダッシュボードデータの取得に失敗しました', error);
  }
}

private async loadEmployeeCount(officeId: string): Promise<void> {
  try {
    const employees = await firstValueFrom(this.employeesService.list(officeId));
    
    // 全従業員数
    this.employeeCount.set(employees.length);
    
    // 社会保険加入者数（isInsured === true）
    // 注意: isInsuredがundefinedの従業員は除外される（filterで明示的にtrueのみをカウント）
    const insuredCount = employees.filter(emp => emp.isInsured === true).length;
    
    // 加入者が1人もいない場合はnullを設定（テンプレート側で「登録済み従業員」として表示）
    // これにより、「加入者数が0」より「登録済み従業員」として表示する方が自然になる
    this.insuredEmployeeCount.set(insuredCount > 0 ? insuredCount : null);
  } catch (error) {
    console.error('従業員数の取得に失敗しました', error);
    this.employeeCount.set(null);
    this.insuredEmployeeCount.set(null);
  }
}

private async loadMonthlyPremiumsTotals(officeId: string): Promise<void> {
  try {
    // 当月と前月のyearMonthを計算
    const now = new Date();
    const currentYearMonth = now.toISOString().substring(0, 7); // YYYY-MM
    
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousYearMonth = previousMonth.toISOString().substring(0, 7); // YYYY-MM

    // 当月の月次保険料を取得
    const currentPremiums = await firstValueFrom(
      this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, currentYearMonth)
    );
    const currentTotal = currentPremiums.reduce((sum, p) => sum + p.totalEmployer, 0);
    this.currentMonthTotalEmployer.set(currentTotal);

    // 前月の月次保険料を取得
    const previousPremiums = await firstValueFrom(
      this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, previousYearMonth)
    );
    const previousTotal = previousPremiums.reduce((sum, p) => sum + p.totalEmployer, 0);
    this.previousMonthTotalEmployer.set(previousTotal);
  } catch (error) {
    console.error('月次保険料の集計に失敗しました', error);
    this.currentMonthTotalEmployer.set(null);
    this.previousMonthTotalEmployer.set(null);
  }
}
```

---

### Step 2: テンプレートの更新

#### 2.1 従業員数カードの更新

```html
<mat-card class="stat-card">
  <div class="stat-icon" style="background: #e3f2fd;">
    <mat-icon style="color: #1976d2;">people</mat-icon>
  </div>
  <div class="stat-content">
    <h3>従業員数</h3>
    <p class="stat-value">
      <ng-container *ngIf="insuredEmployeeCount() !== null; else allEmployees">
        {{ insuredEmployeeCount() }}人
      </ng-container>
      <ng-template #allEmployees>
        {{ employeeCount() ?? '-' }}
        <ng-container *ngIf="employeeCount() !== null">人</ng-container>
      </ng-template>
    </p>
    <p class="stat-label">
      <ng-container *ngIf="insuredEmployeeCount() !== null">
        社会保険加入者
      </ng-container>
      <ng-container *ngIf="insuredEmployeeCount() === null">
        登録済み従業員
      </ng-container>
    </p>
  </div>
</mat-card>
```

#### 2.2 月次保険料カードの更新

```html
<mat-card class="stat-card">
  <div class="stat-icon" style="background: #e8f5e9;">
    <mat-icon style="color: #2e7d32;">account_balance_wallet</mat-icon>
  </div>
  <div class="stat-content">
    <h3>月次保険料</h3>
    <p class="stat-value">
      <ng-container *ngIf="currentMonthTotalEmployer() !== null; else noData">
        ¥{{ currentMonthTotalEmployer() | number }}
      </ng-container>
      <ng-template #noData>-</ng-template>
    </p>
    <p class="stat-label">今月の会社負担額</p>
  </div>
</mat-card>
```

#### 2.3 トレンドカードの更新

```html
<mat-card class="stat-card">
  <div class="stat-icon" style="background: #fff3e0;">
    <mat-icon style="color: #e65100;">trending_up</mat-icon>
  </div>
  <div class="stat-content">
    <h3>トレンド</h3>
    <p class="stat-value" [style.color]="trendColor()">
      {{ trendDisplay() }}
    </p>
    <p class="stat-label">前月比の変化</p>
  </div>
</mat-card>
```

#### 2.4 「今後の予定」カードのテキスト調整

```html
<mat-card class="info-card">
  <h3>
    <mat-icon>info</mat-icon>
    今後の予定
  </h3>
  <p>
    今後はグラフやチャートによる可視化機能、従業員別ランキングなどを追加予定です。
    賞与保険料を含めたトータル負担の可視化も検討中です。
  </p>
</mat-card>
```

---

### Step 3: サービス側のヘルパーメソッド追加（オプション）

#### 3.1 集計用ヘルパーメソッドの追加（任意）

もし便利な集計ヘルパーが欲しい場合は、`MonthlyPremiumsService`に以下のメソッドを追加できます：

```typescript
// src/app/services/monthly-premiums.service.ts

/**
 * 指定事業所・指定年月の月次保険料の会社負担額合計を取得する
 * 
 * @param officeId - 事業所ID
 * @param yearMonth - 対象年月（YYYY-MM形式）
 * @returns 会社負担額合計（Promise）
 */
async getTotalEmployerByOfficeAndYearMonth(
  officeId: string,
  yearMonth: YearMonthString
): Promise<number> {
  const premiums = await firstValueFrom(
    this.listByOfficeAndYearMonth(officeId, yearMonth)
  );
  return premiums.reduce((sum, p) => sum + p.totalEmployer, 0);
}
```

**注意**: このメソッドはオプションです。画面側で直接集計しても問題ありません。

---

## ✅ 受け入れ条件

### 機能要件

#### 従業員数カード
1. ✅ 対象事業所の従業員数が正しく表示される
2. ✅ 可能であれば「社会保険加入者数」が表示される（`isInsured === true`の従業員数）
3. ✅ `isInsured === true`の従業員が1人もいない場合は、「登録済み従業員」として表示される
4. ✅ データが存在しない場合は`-`が表示される

#### 月次保険料カード
1. ✅ 今月の会社負担額合計が正しく表示される
2. ✅ 対象年月は当月（`new Date()`の`YYYY-MM`）を使用
3. ✅ `MonthlyPremium.totalEmployer`の合計が正しい
4. ✅ データが存在しない場合は`-`が表示される

#### トレンドカード
1. ✅ 前月比の変化が正しく計算される（増減率%）
2. ✅ 前月データが存在する場合は、増減率が表示される（例: `+12.3%` または `▲5.4%`）
3. ✅ 前月データが存在しない場合、または前月の合計が`0`の場合は`-`が表示される
4. ✅ 前月の合計が`0`の場合も`-`（N/A）表示とし、無理に`100%`増などは出さない
5. ✅ 増加の場合は緑色、減少の場合は赤色で表示される（任意）

### データ整合性
1. ✅ 表示されている数値が、月次保険料一覧画面（`monthly-premiums.page.ts`）の合計と一致する
2. ✅ 従業員数が、従業員一覧画面（`employees.page.ts`）の件数と一致する

### UI/UX要件
1. ✅ 既存のカードスタイルを維持している
2. ✅ 数値が適切にフォーマットされている（カンマ区切り、通貨記号など）
3. ✅ データがない場合の表示が適切である（`-`や「データなし」）
4. ✅ ローディング状態の表示が適切である（必要に応じて）

---

## 🔍 実装時の注意点

### 1. 既存スタイルの維持
- **重要**: 既存の`dashboard.page.ts`のスタイル（`.stat-card`、`.stat-icon`、`.stat-value`など）を維持してください
- カードのレイアウトや色は変更しないでください
- 既存の`.dashboard-grid`の構造を維持してください

### 2. データ取得の最適化
- サービスのObservableから値を取得する場合は、`firstValueFrom(...)`で1回分だけ受け取ります
- `combineLatest`や`switchMap`などのObservableチェーンは新たに増やしません
- エラーハンドリングを適切に実装し、エラー時は`null`を設定して`-`を表示します

### 3. 年月の計算
- 当月の`yearMonth`は`new Date().toISOString().substring(0, 7)`で取得
- 前月の`yearMonth`は`new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 7)`で取得
- タイムゾーンの問題に注意（必要に応じて調整）

### 4. 増減率の計算
- 増減率は`((今月 - 前月) / 前月) * 100`で計算
- **重要**: 前月の合計が`0`の場合も`-`（N/A）表示とし、無理に`100%`増などは出さない
- 前月データが存在しない場合も`null`を返し、`-`を表示
- 増減率の表示は`+12.3%`（増加）または`▲5.4%`（減少）の形式

### 5. エラーハンドリング
- `officeId`が未設定の場合の処理
- Firestoreクエリエラー時の処理（エラーログを出力し、`null`を設定）
- データが存在しない場合の処理（`-`を表示）

### 6. パフォーマンス
- `ngOnInit()`で一度だけデータを取得
- 不要な再取得を避けるため、`signal`で状態を管理
- 大量のデータがある場合でも、集計がスムーズに動作することを確認

### 7. ローディング状態の扱い
- **方針**: Phase1-10では、ページ全体で1つの`loading` signalを持つか、カードごとには持たず「読み込み中でも`-`を出しておく」で割り切る
- Phase1-9のような`loading` signalを追加してもよいが、必須ではない
- データ取得中は`null`のままにしておき、テンプレート側で`-`を表示する方法でも問題ない

### 8. 従業員数カードのフォールバック処理
- `isInsured === true`の従業員が1人もいない場合（`insuredEmployeeCount === 0`）は、「登録済み従業員」のラベル＋`employeeCount`を表示する
- テンプレート側の`*ngIf`判定で自然にこの挙動になるように実装する
- これにより、「加入者数が0」より「登録済み従業員」として表示する方が自然になる

---

## 📝 実装チェックリスト

### 必須実装
- [ ] `DashboardPage`に`OnInit`インターフェースを実装
- [ ] 既存の`imports`配列に`DecimalPipe`、`NgIf`を追加（既存の`MatCardModule`、`MatIconModule`は削除しない）
- [ ] `PercentPipe`は使用しないため、importsに追加しない（`trendDisplay()`で文字列を返すため）
- [ ] `employeeCount`、`insuredEmployeeCount` signalを追加
- [ ] `currentMonthTotalEmployer`、`previousMonthTotalEmployer` signalを追加
- [ ] `trendPercentage`、`trendDisplay`、`trendColor` computedを追加
- [ ] `loadDashboardData()`メソッドを実装
- [ ] `loadEmployeeCount()`メソッドを実装（`insuredEmployeeCount === 0`の場合は`null`を設定）
- [ ] `loadMonthlyPremiumsTotals()`メソッドを実装
- [ ] 従業員数カードのテンプレートを更新（`insuredEmployeeCount === null`の場合は「登録済み従業員」を表示）
- [ ] 月次保険料カードのテンプレートを更新
- [ ] トレンドカードのテンプレートを更新（前月合計が`0`の場合も`-`を表示）
- [ ] 「今後の予定」カードのテキストを調整
- [ ] エラーハンドリングを実装
- [ ] データがない場合の表示を実装

### 任意実装（余裕があれば）
- [ ] 月次保険料カードに「本人負担合計」をツールチップやサブテキストで表示
- [ ] `MonthlyPremiumsService`に`getTotalEmployerByOfficeAndYearMonth`メソッドを追加
- [ ] ローディング状態の表示を追加

### テスト・確認
- [ ] 従業員数が正しく表示される
- [ ] 今月の会社負担額合計が正しく表示される
- [ ] 前月比の変化が正しく計算される
- [ ] 前月データが存在しない場合に`-`が表示される
- [ ] データがない場合に適切な表示がされる
- [ ] エラーハンドリングが適切に実装されている
- [ ] 既存のスタイルが維持されている

---

## 🎨 参考実装

以下のファイルを参考にしてください：

- `src/app/pages/dashboard/dashboard.page.ts` - 既存のダッシュボード実装パターン
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts` - signal/computedの実装パターン
- `src/app/services/monthly-premiums.service.ts` - 月次保険料の取得方法

---

## 📌 補足事項

### 1. データモデルの確認
- `MonthlyPremium.totalEmployer`: 会社負担額（必須フィールド）
- `Employee.isInsured`: 社会保険加入フラグ（`true`の場合のみ計算対象）
- `MonthlyPremium.yearMonth`: 年月（`YYYY-MM`形式）

### 2. 年月の計算について
- 当月: `new Date().toISOString().substring(0, 7)` → `2025-11`
- 前月: `new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 7)` → `2025-10`
- タイムゾーンの問題に注意（必要に応じて調整）

### 3. 増減率の計算について
- 増減率 = `((今月 - 前月) / 前月) * 100`
- **重要**: 前月の合計が`0`の場合も`-`（N/A）表示とし、無理に`100%`増などは出さない
- 前月データが存在しない場合も`null`を返し、`-`を表示
- 増減率の表示は`+12.3%`（増加）または`▲5.4%`（減少）の形式

### 4. 社会保険加入者数の判定
- `Employee.isInsured === true`の従業員をカウント
- `isInsured`が`undefined`の従業員は除外される（`filter`で明示的に`true`のみをカウント）
- **重要**: `isInsured === true`の従業員が1人もいない場合（`insuredEmployeeCount === 0`）は、「登録済み従業員」のラベル＋`employeeCount`を表示する
- これにより、「加入者数が0」より「登録済み従業員」として表示する方が自然になる

### 5. 年月の表示について
- 月次保険料カードは「今月の会社負担額」を表示するが、年月（`YYYY-MM`）をどこかに小さく表示するか、あくまで「今月」という曖昧表示のままにするかは実装側の判断
- もし明示したい場合は、カードのサブラベルなどに「（対象年月: YYYY-MM）」を表示してもよい（例: 「今月の会社負担額（対象年月: 2025-11）」）

### 6. 将来の拡張
- Phase1-10では、賞与保険料（`bonusPremiums`）は扱いません
- グラフ表示（Chart.js等）は将来の拡張として検討
- 従業員別ランキングも将来の拡張として検討

---

## 🚀 将来の拡張アイデア（任意）

### 1. 12ヶ月推移グラフ
- 過去12ヶ月の会社負担額推移をグラフで表示
- Chart.jsまたはng2-chartsを使用
- 月次保険料と賞与保険料を分けて表示

### 2. 賞与保険料も含めたトータル負担の可視化
- 当月の賞与保険料の会社負担額合計を追加表示
- 月次保険料と賞与保険料の合計を表示

### 3. 従業員別ランキング
- 会社負担額が多い従業員トップ10を表示
- 本人負担額が多い従業員トップ10を表示

### 4. 年度別集計
- 年度（4月1日基準）ごとの集計を表示
- 月次保険料と賞与保険料の合計を表示

---

以上で実装指示書は完了です。不明点があれば確認してください。

