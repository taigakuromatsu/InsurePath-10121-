# Phase1-12 実装指示書: 負担構成ダッシュボード機能の拡張（グラフ表示）

## 📋 概要

ダッシュボードページを拡張し、グラフやチャートによる可視化機能を追加します。

**目的**: 
- 過去12ヶ月の月次保険料推移をグラフで可視化
- 賞与保険料を含めたトータル負担の可視化
- 従業員別ランキング表示（会社負担額・本人負担額トップ10）
- 年度別集計表示（4月1日基準）
- 経営判断に役立つ詳細な分析情報を提供

**ユーザー利用シーン**:
- 月次保険料の推移をグラフで確認したい
- 賞与支給時の保険料負担を把握したい
- どの従業員の保険料負担が大きいかを確認したい
- 年度単位での保険料負担を確認したい

**他機能との関係**:
- **月次保険料一覧**: 同じデータソース（`monthlyPremiums`コレクション）を使用
- **賞与保険料**: `bonusPremiums`コレクションからデータを取得
- **従業員一覧**: 従業員名の表示に`employees`コレクションを使用
- **Phase1-10のダッシュボード**: 既存のKPIカードに加えて、グラフやランキングを追加

**実装スタイル**:
- **重要**: 既存の`dashboard.page.ts`のスタイルを維持し、`signal`/`computed`ベースで実装します
- **重要**: Phase1-10で実装済みのKPIカード用のsignal/computed/メソッドはそのまま維持し、本書で示すメソッド・signalを追記する形で実装すること。既存のロジックを削除しないこと。
- サービスのObservableから値を取得する場合は`firstValueFrom(...)`で1回分だけ受け取ります
- `combineLatest`や`switchMap`などのObservableチェーンは新たに増やしません
- グラフライブラリは`ng2-charts`（Chart.jsのAngularラッパー）を使用します

**制約**:
- Phase1-12では、グラフの詳細なカスタマイズ（色の変更、凡例の位置変更など）は最小限とします
- データのエクスポート機能（CSV、PDFなど）は将来の拡張スコープとします
- グラフの印刷機能は将来の拡張スコープとします

---

## 🎯 実装対象ファイル

### 編集（必須）
- `src/app/pages/dashboard/dashboard.page.ts` - ダッシュボードコンポーネント（グラフとランキングを追加）
- `package.json` - `ng2-charts`と`chart.js`の依存関係を追加

### 編集（必要に応じて）
- `src/app/services/monthly-premiums.service.ts` - 過去12ヶ月分の取得メソッド追加（オプション）
- `src/app/services/bonus-premiums.service.ts` - 年度別集計用のメソッド追加（オプション）

### 参照のみ（変更不要）
- `src/app/services/employees.service.ts` - 従業員名の取得に使用
- `src/app/services/current-office.service.ts` - 事業所ID取得に使用
- `src/app/types.ts` - 型定義の参照

---

## 🔧 機能要件

### 必須スコープ（Phase1-12で実装）

#### 1. 過去12ヶ月の推移グラフ

**要件**:
- 過去12ヶ月の月次保険料の会社負担額推移を折れ線グラフで表示
- X軸: 年月（`YYYY-MM`形式、例: `2025-11`, `2025-10`, ...）
- Y軸: 金額（円）
- データがない月は`0`として表示
- グラフのタイトル: 「過去12ヶ月の月次保険料推移（会社負担額）」

**実装方針**:
- 現在の年月から過去12ヶ月の`yearMonth`を生成（`YYYY-MM`形式）
- 各月の`MonthlyPremium.totalEmployer`を合計
- `ng2-charts`の`base-chart`コンポーネントを使用して折れ線グラフを表示
- データがない月は`0`として扱う

**表示形式**:
- グラフは`MatCard`内に配置
- グラフの下に凡例を表示（「月次保険料（会社負担額）」）
- グラフの右上に「過去12ヶ月」のラベルを表示（任意）

#### 2. 賞与保険料を含めたトータル負担の可視化

**要件**:
- 当月の月次保険料と賞与保険料の会社負担額を棒グラフで比較表示
- 月次保険料: `MonthlyPremium.totalEmployer`の合計
- 賞与保険料: `BonusPremium.totalEmployer`の合計（当月に支給されたもの）
- グラフのタイトル: 「今月の保険料負担（会社負担額）」

**実装方針**:
- 当月の`yearMonth`を計算（`new Date().toISOString().substring(0, 7)`）
- 月次保険料: `MonthlyPremiumsService.listByOfficeAndYearMonth`で取得して合計
- 賞与保険料: `BonusPremiumsService`の実装に合わせて、事業所単位で賞与保険料を取得するメソッドを呼び出し、`payDate`が当月に属するものをフィルタリングして合計
  - **注意**: `BonusPremiumsService`の実際のメソッド名・引数は実コードを確認して調整してください（例: `listByOffice(officeId)`や`listByOfficeAndYearMonth(officeId, yearMonth)`の可能性があります）
- `ng2-charts`の`base-chart`コンポーネントを使用して棒グラフを表示

**表示形式**:
- グラフは`MatCard`内に配置
- 2本の棒（「月次保険料」「賞与保険料」）を並べて表示
- グラフの下に凡例を表示
- 各棒の上に金額を表示（任意）

#### 3. 従業員別ランキング表示

**要件**:
- 会社負担額が多い従業員トップ10をテーブル形式で表示
- 本人負担額が多い従業員トップ10をテーブル形式で表示
- 各ランキングに従業員名、金額、順位を表示
- ランキングの対象: 当月の月次保険料（`MonthlyPremium`）

**実装方針**:
- 当月の`yearMonth`を計算
- `MonthlyPremiumsService.listByOfficeAndYearMonth`で当月の月次保険料を取得
- `EmployeesService.list`で従業員一覧を取得し、`employeeId`でjoinして従業員名を取得
- `totalEmployer`で降順ソートしてトップ10を抽出
- `totalEmployee`で降順ソートしてトップ10を抽出
- `MatTableModule`を使用してテーブル表示

**表示形式**:
- 2つの`MatCard`に分けて表示（「会社負担額ランキング」「本人負担額ランキング」）
- テーブルのカラム: 順位、従業員名、金額
- 金額は`DecimalPipe`でカンマ区切り表示
- データがない場合は「データなし」と表示

#### 4. 年度別集計表示

**要件**:
- 年度（4月1日基準）ごとの月次保険料と賞与保険料の合計を表示
- 対象年度: 現在の年度と前年度（2年度分）
- グラフのタイトル: 「年度別保険料負担（会社負担額）」

**実装方針**:
- 現在の年度を計算（4月1日基準）
- 前年度も計算
- 各年度の月次保険料: `yearMonth`がその年度に属する`MonthlyPremium.totalEmployer`を合計
- 各年度の賞与保険料: `payDate`がその年度に属する`BonusPremium.totalEmployer`を合計（年度の開始日と終了日でフィルタリング）
- `ng2-charts`の`base-chart`コンポーネントを使用して棒グラフを表示

**年度の計算方法**:
- 現在の日付が4月1日以降の場合: 現在の年度 = 現在の年
- 現在の日付が4月1日未満の場合: 現在の年度 = 現在の年 - 1
- 例: 2025年11月の場合、現在の年度 = 2025、前年度 = 2024
- 例: 2025年3月の場合、現在の年度 = 2024、前年度 = 2023

**表示形式**:
- グラフは`MatCard`内に配置
- X軸: 年度（例: `2024年度`, `2025年度`）
- Y軸: 金額（円）
- 各年度に2本の棒（「月次保険料」「賞与保険料」）を並べて表示
- グラフの下に凡例を表示

---

### 拡張スコープ（将来の実装）

以下の機能はPhase1-12では実装しませんが、将来の拡張案として検討可能です：

1. **グラフの詳細なカスタマイズ**
   - 色の変更、凡例の位置変更
   - グラフの種類変更（折れ線→棒グラフなど）

2. **データのエクスポート**
   - CSV形式でのエクスポート
   - PDF形式でのエクスポート

3. **グラフの印刷機能**
   - グラフのみを印刷
   - ダッシュボード全体を印刷

4. **期間選択機能**
   - ユーザーが任意の期間を選択してグラフを表示
   - カスタム期間の集計表示

---

## 💻 実装詳細

### Step 0: 依存関係の追加

#### 0.1 ng2-chartsとchart.jsのインストール

```bash
npm install ng2-charts chart.js
```

**注意**: `package.json`に以下の依存関係が追加されます：
- `ng2-charts`: Chart.jsのAngularラッパー
- `chart.js`: グラフ描画ライブラリ

**Chart.jsの初期化について**:
- Chart.jsのバージョンによっては、`Chart.register(...registerables)`を呼び出す必要がある場合があります
- エラー「line が見つからない」などが発生した場合は、`main.ts`またはダッシュボードコンポーネントで以下のように初期化してください：
  ```typescript
  import { Chart, registerables } from 'chart.js';
  Chart.register(...registerables);
  ```
- 実装前に`ng2-charts`のREADMEを確認し、推奨される初期化方法を確認してください

---

### Step 1: dashboard.page.ts の拡張

#### 1.1 インポートの追加

```typescript
// src/app/pages/dashboard/dashboard.page.ts

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
// 推奨: Standalone Component では NgChartsModule を imports に追加する
import { NgChartsModule } from 'ng2-charts';
// ※BaseChartDirective を直接 imports に追加する方法もあるが、本実装では NgChartsModule を利用する
import { ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
import { firstValueFrom } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { EmployeesService } from '../../services/employees.service';
import { MonthlyPremiumsService } from '../../services/monthly-premiums.service';
import { BonusPremiumsService } from '../../services/bonus-premiums.service';
import { Employee, MonthlyPremium, BonusPremium } from '../../types';

@Component({
  selector: 'ip-dashboard-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatTableModule,
    NgChartsModule, // ★追加（グラフ表示用）
    DecimalPipe,
    NgIf
  ],
  // ... 既存のtemplateとstylesはそのまま維持
})
export class DashboardPage implements OnInit {
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly employeesService = inject(EmployeesService);
  private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
  private readonly bonusPremiumsService = inject(BonusPremiumsService); // ★追加

  readonly officeId$ = this.currentOffice.officeId$;

  // 既存のsignal（Phase1-10で実装済み）
  readonly employeeCount = signal<number | null>(null);
  readonly insuredEmployeeCount = signal<number | null>(null);
  readonly currentMonthTotalEmployer = signal<number | null>(null);
  readonly previousMonthTotalEmployer = signal<number | null>(null);

  // 新しいsignal（Phase1-12で追加）
  readonly monthlyTrendData = signal<ChartData<'line'>>({
    labels: [],
    datasets: []
  });
  readonly currentMonthComparisonData = signal<ChartData<'bar'>>({
    labels: [],
    datasets: []
  });
  readonly fiscalYearComparisonData = signal<ChartData<'bar'>>({
    labels: [],
    datasets: []
  });
  readonly employerRanking = signal<Array<{ employeeName: string; amount: number; rank: number }>>([]);
  readonly employeeRanking = signal<Array<{ employeeName: string; amount: number; rank: number }>>([]);

  // 既存のcomputed（Phase1-10で実装済み）
  readonly trendPercentage = computed(() => {
    // ... 既存の実装
  });

  readonly trendDisplay = computed(() => {
    // ... 既存の実装
  });

  readonly trendColor = computed(() => {
    // ... 既存の実装
  });
}
```

#### 1.2 グラフオプションの定義

```typescript
// dashboard.page.ts

// 折れ線グラフのオプション（過去12ヶ月の推移）
readonly lineChartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom'
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          return `¥${context.parsed.y.toLocaleString()}`;
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => {
          return `¥${Number(value).toLocaleString()}`;
        }
      }
    }
  }
};

// 棒グラフのオプション（月次・賞与比較、年度別比較）
readonly barChartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom'
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          return `¥${context.parsed.y.toLocaleString()}`;
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => {
          return `¥${Number(value).toLocaleString()}`;
        }
      }
    }
  }
};
```

#### 1.3 データ取得メソッドの実装

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
    // 既存のデータ取得（Phase1-10で実装済み）
    await this.loadEmployeeCount(officeId);
    await this.loadMonthlyPremiumsTotals(officeId);

    // 新しいデータ取得（Phase1-12で追加）
    await this.loadMonthlyTrendData(officeId);
    await this.loadCurrentMonthComparisonData(officeId);
    await this.loadFiscalYearComparisonData(officeId);
    await this.loadRankingData(officeId);
  } catch (error) {
    console.error('ダッシュボードデータの取得に失敗しました', error);
  }
}

// 過去12ヶ月の推移データを取得
private async loadMonthlyTrendData(officeId: string): Promise<void> {
  try {
    const now = new Date();
    const yearMonths: string[] = [];
    const totals: number[] = [];

    // 過去12ヶ月のyearMonthを生成
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = date.toISOString().substring(0, 7);
      yearMonths.push(yearMonth);

      // 各月の月次保険料を取得して合計
      const premiums = await firstValueFrom(
        this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)
      );
      const total = premiums.reduce((sum, p) => sum + p.totalEmployer, 0);
      totals.push(total);
    }

    // Chart.jsのデータ形式に変換
    this.monthlyTrendData.set({
      labels: yearMonths,
      datasets: [
        {
          label: '月次保険料（会社負担額）',
          data: totals,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        }
      ]
    });
  } catch (error) {
    console.error('過去12ヶ月の推移データの取得に失敗しました', error);
    this.monthlyTrendData.set({ labels: [], datasets: [] });
  }
}

// 当月の月次・賞与比較データを取得
private async loadCurrentMonthComparisonData(officeId: string): Promise<void> {
  try {
    const now = new Date();
    const currentYearMonth = now.toISOString().substring(0, 7);

    // 月次保険料の合計
    const monthlyPremiums = await firstValueFrom(
      this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, currentYearMonth)
    );
    const monthlyTotal = monthlyPremiums.reduce((sum, p) => sum + p.totalEmployer, 0);

    // 賞与保険料の合計（当月に支給されたもの）
    // TODO: 実際のメソッド名・引数に差し替えること（BonusPremiumsServiceの実装を確認）
    // 仮の例: listByOffice(officeId) や listByOfficeAndYearMonth(officeId, yearMonth) の可能性があります
    const bonusPremiums = await firstValueFrom(
      this.bonusPremiumsService.listByOffice(/* officeId など実装に合わせる */)
    );
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const currentMonthBonuses = bonusPremiums.filter((b) => {
      const payDate = new Date(b.payDate);
      return payDate >= currentMonthStart && payDate <= currentMonthEnd;
    });
    const bonusTotal = currentMonthBonuses.reduce((sum, b) => sum + b.totalEmployer, 0);

    // Chart.jsのデータ形式に変換
    this.currentMonthComparisonData.set({
      labels: ['今月の保険料負担'],
      datasets: [
        {
          label: '月次保険料',
          data: [monthlyTotal],
          backgroundColor: 'rgba(54, 162, 235, 0.5)'
        },
        {
          label: '賞与保険料',
          data: [bonusTotal],
          backgroundColor: 'rgba(255, 99, 132, 0.5)'
        }
      ]
    });
  } catch (error) {
    console.error('当月の比較データの取得に失敗しました', error);
    this.currentMonthComparisonData.set({ labels: [], datasets: [] });
  }
}

// 年度別比較データを取得
private async loadFiscalYearComparisonData(officeId: string): Promise<void> {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 現在の年度を計算（4月1日基準）
    const currentFiscalYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const previousFiscalYear = currentFiscalYear - 1;

    const fiscalYears = [`${previousFiscalYear}年度`, `${currentFiscalYear}年度`];
    const monthlyTotals: number[] = [];
    const bonusTotals: number[] = [];

    // 賞与保険料一覧は年度ループの外で一度だけ取得し、年度ごとのフィルタはメモリ上で行う
    // TODO: 実際のメソッド名・引数に差し替えること（BonusPremiumsServiceの実装を確認）
    const allBonusPremiums = await firstValueFrom(
      this.bonusPremiumsService.listByOffice(/* officeId など実装に合わせる */)
    );

    // 各年度のデータを集計
    for (const fiscalYear of [previousFiscalYear, currentFiscalYear]) {
      // 年度の開始月（4月）と終了月（3月）を計算
      const fiscalYearStart = new Date(fiscalYear, 3, 1); // 4月1日
      const fiscalYearEnd = new Date(fiscalYear + 1, 2, 31); // 翌年3月31日

      // 月次保険料の合計（年度内の各月をループ）
      let monthlyTotal = 0;
      for (let month = 3; month <= 14; month++) {
        const date = new Date(fiscalYear, month, 1);
        if (date > fiscalYearEnd) break;

        const yearMonth = date.toISOString().substring(0, 7);
        const premiums = await firstValueFrom(
          this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)
        );
        monthlyTotal += premiums.reduce((sum, p) => sum + p.totalEmployer, 0);
      }
      monthlyTotals.push(monthlyTotal);

      // 賞与保険料の合計（年度内の支給分）
      // payDateベースで年度範囲をフィルタリング（メモリ上でフィルタ）
      const fiscalYearBonuses = allBonusPremiums.filter((b) => {
        const payDate = new Date(b.payDate);
        return payDate >= fiscalYearStart && payDate <= fiscalYearEnd;
      });
      const bonusTotal = fiscalYearBonuses.reduce((sum, b) => sum + b.totalEmployer, 0);
      bonusTotals.push(bonusTotal);
    }

    // Chart.jsのデータ形式に変換
    this.fiscalYearComparisonData.set({
      labels: fiscalYears,
      datasets: [
        {
          label: '月次保険料',
          data: monthlyTotals,
          backgroundColor: 'rgba(54, 162, 235, 0.5)'
        },
        {
          label: '賞与保険料',
          data: bonusTotals,
          backgroundColor: 'rgba(255, 99, 132, 0.5)'
        }
      ]
    });
  } catch (error) {
    console.error('年度別比較データの取得に失敗しました', error);
    this.fiscalYearComparisonData.set({ labels: [], datasets: [] });
  }
}

// ランキングデータを取得
private async loadRankingData(officeId: string): Promise<void> {
  try {
    const now = new Date();
    const currentYearMonth = now.toISOString().substring(0, 7);

    // 当月の月次保険料を取得
    const premiums = await firstValueFrom(
      this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, currentYearMonth)
    );

    // 従業員一覧を取得
    const employees = await firstValueFrom(this.employeesService.list(officeId));
    const employeeMap = new Map(employees.map((e) => [e.id, e.name]));

    // 会社負担額ランキング（トップ10）
    const employerRanking = premiums
      .map((p) => ({
        employeeId: p.employeeId,
        employeeName: employeeMap.get(p.employeeId) ?? '不明',
        amount: p.totalEmployer
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));
    this.employerRanking.set(employerRanking);

    // 本人負担額ランキング（トップ10）
    const employeeRanking = premiums
      .map((p) => ({
        employeeId: p.employeeId,
        employeeName: employeeMap.get(p.employeeId) ?? '不明',
        amount: p.totalEmployee
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));
    this.employeeRanking.set(employeeRanking);
  } catch (error) {
    console.error('ランキングデータの取得に失敗しました', error);
    this.employerRanking.set([]);
    this.employeeRanking.set([]);
  }
}
```

---

### Step 2: テンプレートの更新

#### 2.1 過去12ヶ月の推移グラフ

```html
<!-- dashboard.page.ts の template 内 -->

<mat-card class="chart-card">
  <div class="chart-header">
    <h3>
      <mat-icon>show_chart</mat-icon>
      過去12ヶ月の月次保険料推移（会社負担額）
    </h3>
  </div>
  <div class="chart-container">
    <canvas baseChart
            [data]="monthlyTrendData()"
            [options]="lineChartOptions"
            type="line">
    </canvas>
  </div>
</mat-card>
```

#### 2.2 当月の月次・賞与比較グラフ

```html
<!-- dashboard.page.ts の template 内 -->

<mat-card class="chart-card">
  <div class="chart-header">
    <h3>
      <mat-icon>bar_chart</mat-icon>
      今月の保険料負担（会社負担額）
    </h3>
  </div>
  <div class="chart-container">
    <canvas baseChart
            [data]="currentMonthComparisonData()"
            [options]="barChartOptions"
            type="bar">
    </canvas>
  </div>
</mat-card>
```

#### 2.3 年度別比較グラフ

```html
<!-- dashboard.page.ts の template 内 -->

<mat-card class="chart-card">
  <div class="chart-header">
    <h3>
      <mat-icon>assessment</mat-icon>
      年度別保険料負担（会社負担額）
    </h3>
  </div>
  <div class="chart-container">
    <canvas baseChart
            [data]="fiscalYearComparisonData()"
            [options]="barChartOptions"
            type="bar">
    </canvas>
  </div>
</mat-card>
```

#### 2.4 従業員別ランキング

```html
<!-- dashboard.page.ts の template 内 -->

<div class="ranking-section">
  <!-- 会社負担額ランキング -->
  <mat-card class="ranking-card">
    <div class="chart-header">
      <h3>
        <mat-icon>trending_up</mat-icon>
        会社負担額ランキング（トップ10）
      </h3>
    </div>
    <table mat-table [dataSource]="employerRanking()" class="ranking-table">
      <ng-container matColumnDef="rank">
        <th mat-header-cell *matHeaderCellDef>順位</th>
        <td mat-cell *matCellDef="let item">{{ item.rank }}</td>
      </ng-container>

      <ng-container matColumnDef="employeeName">
        <th mat-header-cell *matHeaderCellDef>従業員名</th>
        <td mat-cell *matCellDef="let item">{{ item.employeeName }}</td>
      </ng-container>

      <ng-container matColumnDef="amount">
        <th mat-header-cell *matHeaderCellDef>金額</th>
        <td mat-cell *matCellDef="let item">¥{{ item.amount | number }}</td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="['rank', 'employeeName', 'amount']"></tr>
      <tr mat-row *matRowDef="let row; columns: ['rank', 'employeeName', 'amount']"></tr>

      <tr class="mat-row" *ngIf="employerRanking().length === 0">
        <td class="mat-cell" colspan="3">データなし</td>
      </tr>
    </table>
  </mat-card>

  <!-- 本人負担額ランキング -->
  <mat-card class="ranking-card">
    <div class="chart-header">
      <h3>
        <mat-icon>person</mat-icon>
        本人負担額ランキング（トップ10）
      </h3>
    </div>
    <table mat-table [dataSource]="employeeRanking()" class="ranking-table">
      <ng-container matColumnDef="rank">
        <th mat-header-cell *matHeaderCellDef>順位</th>
        <td mat-cell *matCellDef="let item">{{ item.rank }}</td>
      </ng-container>

      <ng-container matColumnDef="employeeName">
        <th mat-header-cell *matHeaderCellDef>従業員名</th>
        <td mat-cell *matCellDef="let item">{{ item.employeeName }}</td>
      </ng-container>

      <ng-container matColumnDef="amount">
        <th mat-header-cell *matHeaderCellDef>金額</th>
        <td mat-cell *matCellDef="let item">¥{{ item.amount | number }}</td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="['rank', 'employeeName', 'amount']"></tr>
      <tr mat-row *matRowDef="let row; columns: ['rank', 'employeeName', 'amount']"></tr>

      <tr class="mat-row" *ngIf="employeeRanking().length === 0">
        <td class="mat-cell" colspan="3">データなし</td>
      </tr>
    </table>
  </mat-card>
</div>
```

#### 2.5 スタイルの追加

```typescript
// dashboard.page.ts の styles 内

styles: [
  `
    /* 既存のスタイルはそのまま維持 */

    .chart-card {
      margin-bottom: 1.5rem;
      padding: 1.5rem;
    }

    .chart-header {
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #e0e0e0;
    }

    .chart-header h3 {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #333;
    }

    .chart-header h3 mat-icon {
      color: #667eea;
    }

    .chart-container {
      height: 300px;
      position: relative;
    }

    .ranking-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .ranking-card {
      padding: 1.5rem;
    }

    .ranking-table {
      width: 100%;
    }

    .ranking-table th {
      font-weight: 600;
      color: #666;
    }

    .ranking-table td {
      color: #333;
    }

    @media (max-width: 768px) {
      .ranking-section {
        grid-template-columns: 1fr;
      }

      .chart-container {
        height: 250px;
      }
    }
  `
]
```

---

## ✅ 受け入れ条件

### 機能要件

#### 過去12ヶ月の推移グラフ
1. ✅ 過去12ヶ月の月次保険料の会社負担額推移が折れ線グラフで表示される
2. ✅ X軸に年月（`YYYY-MM`形式）が表示される
3. ✅ Y軸に金額（円）が表示される
4. ✅ データがない月は`0`として表示される
5. ✅ グラフのタイトルが正しく表示される

#### 賞与保険料を含めたトータル負担の可視化
1. ✅ 当月の月次保険料と賞与保険料の会社負担額が棒グラフで比較表示される
2. ✅ 月次保険料と賞与保険料が2本の棒で並べて表示される
3. ✅ グラフのタイトルが正しく表示される
4. ✅ 賞与保険料がない場合は`0`として表示される

#### 従業員別ランキング表示
1. ✅ 会社負担額が多い従業員トップ10がテーブル形式で表示される
2. ✅ 本人負担額が多い従業員トップ10がテーブル形式で表示される
3. ✅ 各ランキングに順位、従業員名、金額が表示される
4. ✅ 金額が`DecimalPipe`でカンマ区切り表示される
5. ✅ データがない場合は「データなし」と表示される

#### 年度別集計表示
1. ✅ 現在の年度と前年度の月次保険料と賞与保険料の合計が棒グラフで表示される
2. ✅ 各年度に2本の棒（「月次保険料」「賞与保険料」）が並べて表示される
3. ✅ 年度の計算が4月1日基準で正しく行われる
4. ✅ グラフのタイトルが正しく表示される

### データ整合性
1. ✅ グラフのデータが、月次保険料一覧画面（`monthly-premiums.page.ts`）の合計と一致する
2. ✅ ランキングの従業員名が、従業員一覧画面（`employees.page.ts`）の名前と一致する
3. ✅ 年度別集計が、実際の年度（4月1日基準）で正しく計算される

### UI/UX要件
1. ✅ 既存のカードスタイルを維持している
2. ✅ グラフが適切なサイズで表示される（レスポンシブ対応）
3. ✅ グラフの凡例が適切に表示される
4. ✅ テーブルのスタイルが既存のテーブルと一貫している
5. ✅ モバイルでも見やすいレイアウトになっている

### 既存機能への影響
1. ✅ 既存のKPIカード（Phase1-10で実装済み）が正しく表示される
2. ✅ 既存のページ（月次保険料・従業員一覧など）に影響を及ぼさない

---

## 🔍 実装時の注意点

### 1. グラフライブラリの導入
- `ng2-charts`と`chart.js`をインストールする必要があります
- **推奨**: Standalone Componentでは`NgChartsModule`を`imports`配列に追加してください
  - `BaseChartDirective`を直接`imports`に追加する方法もありますが、本実装では`NgChartsModule`を利用します
- Chart.jsの型定義（`ChartConfiguration`, `ChartData`, `ChartOptions`）をインポートしてください
- Chart.jsのバージョンによっては、`Chart.register(...registerables)`を呼び出す必要がある場合があります。エラーが発生した場合は、`main.ts`またはダッシュボードコンポーネントで初期化してください

### 2. データ取得の最適化とFirestoreクエリ回数
- 過去12ヶ月のデータ取得は、各月ごとに`listByOfficeAndYearMonth`を呼び出すため、12回のFirestoreクエリが発生します
- 年度別集計では、年度ごとにさらに複数回のクエリが発生します
- **賞与保険料の取得最適化**: 年度別集計では、賞与保険料一覧を年度ループの外で一度だけ取得し、年度ごとのフィルタはメモリ上で行うことで、クエリ回数を削減できます（コード例を参照）
- **パフォーマンスについて**: 学内用・データ少ない前提であれば、Phase1-12の範囲では許容範囲です
- 将来的にパフォーマンスが気になる場合は、以下の最適化を検討できます：
  - サービス側に`listByOfficeAndYearMonths`のようなメソッドを追加して、一度に複数月を取得する
  - Cloud Functions側で集計して「ダッシュボード用サマリコレクション」を作成する
  - 月次保険料を年度・yearMonthで一括取得し、メモリ側で集計する
- ただし、Phase1-12では各月ごとの取得で問題ありません

### 3. 年度の計算
- 年度の計算は4月1日基準で行います
- 現在の日付が4月1日以降の場合: 現在の年度 = 現在の年
- 現在の日付が4月1日未満の場合: 現在の年度 = 現在の年 - 1
- 例: 2025年11月の場合、現在の年度 = 2025、前年度 = 2024
- 例: 2025年3月の場合、現在の年度 = 2024、前年度 = 2023

### 4. 賞与保険料のフィルタリング
- 当月の賞与保険料は、`payDate`が当月に属するものをフィルタリングします
- `payDate`は`IsoDateString`形式（`YYYY-MM-DD`）なので、`Date`オブジェクトに変換して比較します
- 年度別集計では、`payDate`を`Date`オブジェクトに変換し、年度の開始日（4月1日）と終了日（翌年3月31日）の範囲でフィルタリングします
- **注意**: `BonusPremiumsService`の実装に合わせて、実際のメソッド名・引数を調整してください（例: `listByOffice(officeId)`や`listByOfficeAndYearMonth(officeId, yearMonth)`の可能性があります）

### 5. 従業員名の取得
- ランキング表示では、`employeeId`から従業員名を取得する必要があります
- `EmployeesService.list`で従業員一覧を取得し、`Map`を使って`employeeId`から`name`を取得します
- 従業員が見つからない場合は「不明」と表示します

### 6. エラーハンドリング
- データ取得に失敗した場合は、空のデータ（`{ labels: [], datasets: [] }`）を設定します
- エラーログを`console.error`で出力します
- ユーザーにはエラーメッセージを表示しない（既存のKPIカードが表示されていれば問題なし）

### 7. パフォーマンス
- グラフの描画はChart.jsが自動的に行いますが、データが多い場合は描画に時間がかかる可能性があります
- `maintainAspectRatio: false`を設定して、グラフのサイズを固定することで、パフォーマンスを向上させることができます

### 8. レスポンシブデザイン
- グラフの高さを`300px`に固定し、モバイルでは`250px`に調整します
- ランキングテーブルは、モバイルでは1列表示にします
- `@media (max-width: 768px)`でモバイル向けのスタイルを定義します

---

## 📝 実装チェックリスト

### 必須実装
- [ ] `package.json`に`ng2-charts`と`chart.js`を追加
- [ ] `dashboard.page.ts`に`NgChartsModule`をインポート（推奨パターン）
- [ ] Chart.jsの初期化が必要な場合は`Chart.register(...registerables)`を実行
- [ ] `dashboard.page.ts`に`BonusPremiumsService`をインジェクト
- [ ] `BonusPremiumsService`の実装を確認し、実際のメソッド名・引数に合わせて調整（コード例の`TODO`コメントを参照）
- [ ] `monthlyTrendData` signalを追加
- [ ] `currentMonthComparisonData` signalを追加
- [ ] `fiscalYearComparisonData` signalを追加
- [ ] `employerRanking` signalを追加
- [ ] `employeeRanking` signalを追加
- [ ] `lineChartOptions`と`barChartOptions`を定義
- [ ] `loadMonthlyTrendData`メソッドを実装
- [ ] `loadCurrentMonthComparisonData`メソッドを実装
- [ ] `loadFiscalYearComparisonData`メソッドを実装
- [ ] `loadRankingData`メソッドを実装
- [ ] 過去12ヶ月の推移グラフのテンプレートを追加
- [ ] 当月の月次・賞与比較グラフのテンプレートを追加
- [ ] 年度別比較グラフのテンプレートを追加
- [ ] 従業員別ランキングのテンプレートを追加
- [ ] グラフとランキングのスタイルを追加

### 任意実装（余裕があれば）
- [ ] グラフの色をカスタマイズ
- [ ] グラフの凡例の位置を変更
- [ ] グラフのツールチップをカスタマイズ
- [ ] ランキングテーブルにソート機能を追加

### テスト・確認
- [ ] 過去12ヶ月の推移グラフが正しく表示される
- [ ] 当月の月次・賞与比較グラフが正しく表示される
- [ ] 年度別比較グラフが正しく表示される
- [ ] 従業員別ランキングが正しく表示される
- [ ] データがない場合に適切な表示がされる
- [ ] モバイルでも見やすいレイアウトになっている
- [ ] 既存のKPIカードが正しく表示される
- [ ] 既存ページに影響を及ぼさない

---

## 🎨 参考実装

以下のファイルを参考にしてください：

- `src/app/pages/dashboard/dashboard.page.ts` - 既存のダッシュボード実装パターン
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts` - signal/computedの実装パターン
- `src/app/services/monthly-premiums.service.ts` - 月次保険料の取得方法
- `src/app/services/bonus-premiums.service.ts` - 賞与保険料の取得方法
- [ng2-charts公式ドキュメント](https://www.npmjs.com/package/ng2-charts) - グラフライブラリの使い方

---

## 📌 補足事項

### 1. グラフライブラリの選定について
- `ng2-charts`はChart.jsのAngularラッパーで、Angular Materialとの統合も容易です
- Chart.jsは軽量で、多くのグラフタイプ（折れ線、棒、円など）をサポートしています
- 将来的に他のグラフライブラリ（例: D3.js、Plotly.js）に変更することも可能ですが、Phase1-12では`ng2-charts`を使用します

### 2. データ取得のパフォーマンスについて
- 過去12ヶ月のデータ取得は、各月ごとに`listByOfficeAndYearMonth`を呼び出すため、12回のFirestoreクエリが発生します
- パフォーマンスが気になる場合は、サービス側に`listByOfficeAndYearMonths`のようなメソッドを追加して、一度に複数月を取得することも検討できます（オプション）
- ただし、Phase1-12では各月ごとの取得で問題ありません

### 3. 年度の計算について
- 年度の計算は4月1日基準で行います
- 現在の日付が4月1日以降の場合: 現在の年度 = 現在の年
- 現在の日付が4月1日未満の場合: 現在の年度 = 現在の年 - 1
- 例: 2025年11月の場合、現在の年度 = 2025、前年度 = 2024
- 例: 2025年3月の場合、現在の年度 = 2024、前年度 = 2023

### 4. 賞与保険料のフィルタリングについて
- 当月の賞与保険料は、`payDate`が当月に属するものをフィルタリングします
- `payDate`は`IsoDateString`形式（`YYYY-MM-DD`）なので、`Date`オブジェクトに変換して比較します
- 年度別集計では、`payDate`を`Date`オブジェクトに変換し、年度の開始日（4月1日）と終了日（翌年3月31日）の範囲でフィルタリングします
- **注意**: `BonusPremiumsService`の実装に合わせて、実際のメソッド名・引数を調整してください

### 5. 将来の拡張案
- **グラフの詳細なカスタマイズ**: 色の変更、凡例の位置変更、グラフの種類変更
- **データのエクスポート**: CSV形式、PDF形式でのエクスポート
- **グラフの印刷機能**: グラフのみを印刷、ダッシュボード全体を印刷
- **期間選択機能**: ユーザーが任意の期間を選択してグラフを表示

---

以上で実装指示書は完了です。不明点があれば確認してください。

