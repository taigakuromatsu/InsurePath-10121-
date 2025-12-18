# Phase1-9 実装指示書: 月次保険料一覧機能の拡張

## 📋 概要

現在の月次保険料一覧ページ（`monthly-premiums.page.ts`）を拡張し、過去月分の閲覧・従業員名での絞り込み・合計表示機能を追加します。

**目的**: 
- これまで「当月のみ」計算・表示できた月次保険料一覧を拡張し、過去の年月を切り替えて閲覧できるようにする
- 従業員名で絞り込みできるようにする
- その月の本人負担・会社負担の合計金額を一覧の下部に表示する（既存の合計表示を拡張）

**前提条件**:
- `MonthlyPremiumsService.listByOfficeAndYearMonth`は既に実装済み
- `EmployeesService.list`で従業員一覧を取得可能
- 既存の「計算して保存」機能は変更しない（既存の計算ロジックはそのまま維持）

**実装スタイル**:
- **重要**: 現在の`monthly-premiums.page.ts`は`signal`/`computed`ベースの実装スタイルです
- Phase1-9でも、既存の実装スタイルに合わせて、画面コンポーネント（`monthly-premiums.page.ts`）では`signal`/`computed`/`effect`を使用し、Observableチェーン（`combineLatest`、`switchMap`など）は新たに増やさないこと
- サービスのObservableから値を取得する場合は、`firstValueFrom(...)`で1回分だけ受け取る（`pipe(switchMap...)`等のチェーンは作らない）

---

## 🎯 実装対象ファイル

### 編集（必須）
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts` - メインのページコンポーネント

### 編集（必要に応じて）
- `src/app/services/monthly-premiums.service.ts` - 直近の年月一覧を取得するヘルパーメソッドを追加（オプション）

### 参照のみ（変更不要）
- `src/app/services/employees.service.ts` - 従業員名のjoinに使用
- `src/app/services/current-office.service.ts` - 事業所ID取得に使用
- `src/app/types.ts` - 型定義の参照

---

## 🔧 機能要件

### 2-1. 年月選択UI（過去月の切り替え）

#### 要件
- 画面上部に「対象年月」を選択できる`MatSelect`を追加
- 選択肢は「直近12ヶ月程度」の`YYYY-MM`形式（例: `2025-11`, `2025-10`, `2025-09`...）
- デフォルト選択は当月（`new Date().toISOString().substring(0, 7)`）
- 年月を変更すると、その年月の月次保険料一覧を再取得してテーブルを更新する
- 既存の「計算して保存」フォームとは独立したUIとして配置

#### UI配置
- 計算フォームの上、または結果カードの上部に配置
- 「対象年月を選択」というラベルと`MatSelect`を配置
- 年月選択UIと「計算して保存」フォームは別々のセクションとして扱う

#### 実装方針
- `MonthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)`を活用
- 年月選択の選択肢は、以下のいずれかの方法で実装：
  - **方法A（推奨）**: フロント側で直近12ヶ月の`YYYY-MM`形式の配列を生成（`new Date()`から逆算）
  - **方法B（オプション）**: `MonthlyPremiumsService`に`listRecentYearMonths(officeId, limit = 12)`メソッドを追加し、Firestoreから実際に存在する年月を取得
    - `offices/{officeId}/monthlyPremiums`から`orderBy('yearMonth', 'desc')` + `limit(N)`で取得
    - `yearMonth`の重複をフロント側でユニークにする
    - この方法の場合、計算済みの年月のみが選択肢に表示される

**推奨**: 方法Aを採用（シンプルで実装が容易、ユーザーは計算前でも過去月を選択できる）

#### データ取得フロー
```typescript
// 年月選択時の処理フロー
1. ユーザーが年月を選択
2. selectedYearMonth signalを更新
3. 年月変更を検知して、loadPremiumsForYearMonth()メソッドを呼び出し
4. listByOfficeAndYearMonth(officeId, yearMonth)を呼び出し
5. 取得したMonthlyPremium[]を従業員名とjoin
6. rows signal（表示用の配列）を更新してテーブルを再描画
```

**重要**: 既存の`results` signalを`rows` signalに統一し、計算完了時と年月選択時の両方から同じ`rows` signalを更新する方針で実装します。これにより、状態の二重管理を避け、「画面に表示されているもの = 最後に読み込んだFirestoreの状態」を保ちます。

---

### 2-2. 従業員名での絞り込み（シンプルな検索）

#### 要件
- テーブルの上部（結果カード内、テーブルの上）に「従業員名で絞り込む」テキスト入力を追加
- 入力された文字列（前後の空白をトリム、大文字小文字を無視）を含む従業員だけを表示
- 入力が空のときは全件表示
- リアルタイムでフィルタリング（入力と同時にテーブルが更新される）

#### 実装方針
- 既存のコードでは、`results` signalに`(MonthlyPremium & { employeeName: string })[]`が格納されている
- Phase1-9では、`results` signalを`rows` signalにリネーム（またはそのまま使用）し、表示用の配列として統一管理
- `employeeName`フィールドを使ってフィルタリング
- フィルタリングは画面側で実装（Firestoreクエリは変更しない）
- `computed` signalを使ってフィルタ済みの配列を生成

#### フィルタリングロジック
```typescript
// フィルタリングの実装例
readonly filterText = signal<string>('');

// フィルタ後の結果（nullセーフティを考慮）
readonly filteredRows = computed(() => {
  const text = this.filterText().trim().toLowerCase();
  const base = this.rows(); // rows signalから取得
  
  if (!text) {
    return base;
  }
  
  return base.filter(r => 
    (r.employeeName ?? '').toLowerCase().includes(text)
  );
});
```

**重要**: `employeeName`が`undefined`の場合に備えて、`?? ''`でnullセーフティを確保します。

#### UI配置
- 結果カード内、テーブルの上部に配置
- `MatFormField` + `MatInput`を使用
- プレースホルダー: "従業員名で絞り込む"
- クリアボタン（`matSuffix`に`mat-icon-button`）を追加してもよい

---

### 2-3. 月単位の合計行（本人／会社の合計）

#### 要件
- テーブルの最下部に「合計」行を1行追加（**必須**）
- `totalEmployee`と`totalEmployer`を合計して表示
- **任意（余裕があれば）**: 健康保険・介護保険・厚生年金の本人／会社分の合計も表示

#### 実装方針
- 既存の`totalEmployee`と`totalEmployer`の`computed`は、フィルタ後の結果（`filteredRows`）に対して計算するように変更
- 合計行は既存の`.totals`セクションを活用し、フィルタ後の合計を表示

#### 合計計算ロジック
```typescript
// フィルタ後の合計を計算（既存のtotalEmployee/totalEmployerを更新）
readonly totalEmployee = computed(() => {
  return this.filteredRows().reduce((sum, r) => sum + r.totalEmployee, 0);
});

readonly totalEmployer = computed(() => {
  return this.filteredRows().reduce((sum, r) => sum + r.totalEmployer, 0);
});

// 任意: 各保険種別の合計
readonly healthEmployeeTotal = computed(() => {
  return this.filteredRows().reduce((sum, r) => sum + r.healthEmployee, 0);
});

readonly healthEmployerTotal = computed(() => {
  return this.filteredRows().reduce((sum, r) => sum + r.healthEmployer, 0);
});
// ... 介護保険・厚生年金も同様（任意）
```

#### UI配置
- 既存の`.totals`セクションを活用し、フィルタ後の合計を表示
- または、テーブルの直下に合計行を追加（`mat-footer-row`を使用）

---

## 💻 実装詳細

### Step 1: 状態管理の統一と年月選択UIの追加

**重要**: 既存の`results` signalを`rows` signalにリネーム（またはそのまま使用）し、表示用の配列として統一管理します。計算完了時と年月選択時の両方から、同じ`rows` signalを更新します。

#### 1.1 状態管理の統一
```typescript
// 既存のresults signalをrows signalにリネーム（またはそのまま使用）
// 表示用の配列として統一管理
readonly rows = signal<(MonthlyPremium & { employeeName: string })[]>([]);

// 年月選択用のsignal
readonly selectedYearMonth = signal<string>(
  new Date().toISOString().substring(0, 7)
);

// フィルタテキスト用のsignal
readonly filterText = signal<string>('');
```

#### 1.2 年月選択肢の生成
```typescript
// 直近12ヶ月の年月配列を生成
readonly yearMonthOptions = computed(() => {
  const options: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = date.toISOString().substring(0, 7); // YYYY-MM
    options.push(yearMonth);
  }
  return options;
});
```

#### 1.3 年月選択時のデータ取得メソッド
```typescript
// 年月選択時に月次保険料を読み込むメソッド
// 重要: サービスのObservableから値を取得する場合は、firstValueFrom(...)で1回分だけ受け取る
private async loadPremiumsForYearMonth(yearMonth: string): Promise<void> {
  const officeId = await firstValueFrom(this.officeId$);
  if (!officeId) {
    this.rows.set([]);
    return;
  }

  try {
    // Firestoreから月次保険料を取得（firstValueFromで1回分だけ受け取る）
    const premiums = await firstValueFrom(
      this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)
    );

    // 従業員名とjoin（firstValueFromで1回分だけ受け取る）
    const employees = await firstValueFrom(this.employeesService.list(officeId));
    const employeeNameMap = new Map<string, string>();
    employees.forEach(emp => {
      employeeNameMap.set(emp.id, emp.name);
    });

    const rowsWithName = premiums.map(premium => ({
      ...premium,
      employeeName: employeeNameMap.get(premium.employeeId) ?? '(不明)'
    }));

    // rows signalを更新
    this.rows.set(rowsWithName);
  } catch (error) {
    console.error('月次保険料の取得に失敗しました', error);
    this.snackBar.open('月次保険料の取得に失敗しました', '閉じる', { duration: 3000 });
    this.rows.set([]);
  }
}
```

**重要**: 
- データ取得は`firstValueFrom`前提で実装します。`pipe(switchMap...)`等のObservableチェーンは作らないでください
- 年月選択の変更は、テンプレート側の`(selectionChange)`イベントから直接`loadPremiumsForYearMonth`を呼び出します（`effect`は使用しません）

#### 1.4 初期表示時のデータ読み込み
```typescript
ngOnInit(): void {
  // 初期表示で当月分を読み込んでおく（すでに計算済みであれば一覧に表示される）
  this.loadPremiumsForYearMonth(this.selectedYearMonth());
}
```

**重要**: 
- `ngOnInit()`で初期表示時に当月分を自動ロードすることで、ページを開いた直後から既に計算済みのデータがあれば一覧に表示されます
- これにより、以下の動作フローが実現されます：
  - **初回ロード**: 当月分の一覧があればすぐ見える
  - **計算して保存**: 保存後に再ロード
  - **年月セレクト変更**: その月をロード

#### 1.5 テンプレートの追加
```html
<!-- 年月選択UI（計算フォームの上、または結果カードの上部） -->
<mat-card class="content-card">
  <div class="page-header">
    <h2>
      <mat-icon>calendar_month</mat-icon>
      月次保険料一覧
    </h2>
  </div>
  
  <div class="year-month-selector">
    <mat-form-field appearance="outline">
      <mat-label>対象年月</mat-label>
      <mat-select [value]="selectedYearMonth()" 
                  (selectionChange)="selectedYearMonth.set($event.value); loadPremiumsForYearMonth($event.value)">
        <mat-option *ngFor="let ym of yearMonthOptions()" [value]="ym">
          {{ ym }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  </div>

  <!-- 既存の計算フォームはそのまま維持 -->
  <!-- ... -->
</mat-card>
```

**重要**: 年月選択の変更は、テンプレート側の`(selectionChange)`イベントから直接`loadPremiumsForYearMonth`を呼び出します。`effect`は使用せず、この方法で統一してください。これにより、`loadPremiumsForYearMonth`が二重に呼ばれることを防ぎます。

---

### Step 2: 従業員名での絞り込み機能の追加

#### 2.1 フィルタリングロジックの実装
```typescript
// filterText signalは既にStep 1で定義済み

// フィルタ後の結果（nullセーフティを考慮）
readonly filteredRows = computed(() => {
  const text = this.filterText().trim().toLowerCase();
  const base = this.rows();
  
  if (!text) {
    return base;
  }
  
  return base.filter(r => 
    (r.employeeName ?? '').toLowerCase().includes(text)
  );
});
```

#### 2.2 テンプレートの追加
```html
<!-- 結果カード内、テーブルの上部 -->
<mat-card *ngIf="rows().length > 0 || selectedYearMonth()">
  <!-- ... -->
  
  <div class="filter-section">
    <mat-form-field appearance="outline" class="filter-input">
      <mat-label>従業員名で絞り込む</mat-label>
      <input matInput 
             [value]="filterText()"
             (input)="filterText.set($any($event.target).value)"
             placeholder="従業員名を入力">
      <mat-icon matSuffix>search</mat-icon>
      <button mat-icon-button 
              matSuffix 
              *ngIf="filterText()"
              (click)="filterText.set('')"
              type="button">
        <mat-icon>clear</mat-icon>
      </button>
    </mat-form-field>
  </div>

  <div class="table-container">
    <table mat-table [dataSource]="filteredRows()" class="premiums-table">
      <!-- 既存の列定義はそのまま -->
    </table>
  </div>
</mat-card>
```

---

### Step 3: 合計行の実装（拡張）

#### 3.1 合計計算の更新
```typescript
// 既存のtotalEmployee/totalEmployerを、filteredRowsに対して計算するように更新
readonly totalEmployee = computed(() => {
  return this.filteredRows().reduce((sum, r) => sum + r.totalEmployee, 0);
});

readonly totalEmployer = computed(() => {
  return this.filteredRows().reduce((sum, r) => sum + r.totalEmployer, 0);
});

// 任意: 各保険種別の合計
readonly healthEmployeeTotal = computed(() => {
  return this.filteredRows().reduce((sum, r) => sum + r.healthEmployee, 0);
});

readonly healthEmployerTotal = computed(() => {
  return this.filteredRows().reduce((sum, r) => sum + r.healthEmployer, 0);
});

// 介護保険・厚生年金も同様に実装（任意）
```

#### 3.2 テンプレートの更新
```html
<!-- 既存の.totalsセクションを更新 -->
<div class="totals">
  <div class="total-item">
    <span class="total-label">事業所合計（本人負担）</span>
    <span class="total-value employee">
      {{ totalEmployee() | number }}円
    </span>
    <span class="total-note" *ngIf="filterText()">
      （絞り込み後: {{ filteredRows().length }}件）
    </span>
  </div>
  <div class="total-item">
    <span class="total-label">事業所合計（会社負担）</span>
    <span class="total-value employer">
      {{ totalEmployer() | number }}円
    </span>
  </div>
</div>
```

---

### Step 4: 既存機能との統合

#### 4.1 計算ボタン押下時の処理の更新
- 既存の`onCalculateAndSave()`メソッドを更新し、計算完了後に`rows` signalを更新する処理を追加
- 計算完了後、`selectedYearMonth`を計算した年月に自動設定
- Firestoreに保存後、その年月のデータを再取得して`rows` signalを更新

```typescript
async onCalculateAndSave(): Promise<void> {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  try {
    this.loading.set(true);

    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) {
      this.snackBar.open('事業所が設定されていません', '閉じる', { duration: 3000 });
      return;
    }

    const office = await firstValueFrom(this.currentOffice.office$);
    if (!office) {
      this.snackBar.open('事業所情報を取得できませんでした', '閉じる', { duration: 3000 });
      return;
    }

    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      this.snackBar.open('ログイン情報を取得できませんでした', '閉じる', { duration: 3000 });
      return;
    }
    const calculatedByUserId = currentUser.uid;

    const formValue = this.form.value;
    const yearMonth = formValue.yearMonth as string;
    const calcDate = new Date().toISOString();

    await this.refreshRateSummary(office, yearMonth);

    const employees = await firstValueFrom(this.employeesService.list(officeId));

    // 既存の計算・保存処理
    const savedPremiums = await this.monthlyPremiumsService.saveForMonth({
      officeId,
      yearMonth,
      calcDate,
      employees: employees as Employee[],
      calculatedByUserId
    });

    // ★新規追加: 計算完了後、選択年月を更新
    this.selectedYearMonth.set(yearMonth);

    // ★新規追加: Firestoreから再取得してrows signalを更新
    // （これにより、計算結果とFirestoreの状態が同期される）
    await this.loadPremiumsForYearMonth(yearMonth);

    const skippedCount = employees.length - savedPremiums.length;
    let message = `${yearMonth} 分の月次保険料を ${savedPremiums.length} 件計算・保存しました`;
    if (skippedCount > 0) {
      message += `（${skippedCount} 件スキップ：未加入または標準報酬未設定）`;
    }
    this.snackBar.open(message, '閉じる', { duration: 5000 });
  } catch (error) {
    console.error('月次保険料の計算・保存に失敗しました', error);
    this.snackBar.open('月次保険料の計算・保存に失敗しました。マスタ設定を確認してください。', '閉じる', {
      duration: 5000
    });
  } finally {
    this.loading.set(false);
  }
}
```

#### 4.2 データの統一管理
- **重要**: `results` signalを`rows` signalにリネーム（またはそのまま使用）し、表示用の配列として統一管理
- 計算完了時も年月選択時も、同じ`rows` signalを更新する
- これにより、「画面に表示されているもの = 最後に読み込んだFirestoreの状態」が保証される
- 状態の二重管理を避け、実装がシンプルになる

#### 4.3 動作フロー
Phase1-9の実装により、以下の動作フローが実現されます：

1. **初回ロード（`ngOnInit()`）**: 当月分の一覧があればすぐ見える
2. **計算して保存（`onCalculateAndSave()`）**: 保存後に再ロードして最新状態を表示
3. **年月セレクト変更（`(selectionChange)`）**: 選択した月をロードして表示

これにより、「月次保険料一覧」ページは基本として当月の状況を確認するページとして機能し、ユーザーがページを開いた直後から既に計算済みのデータがあれば一覧に表示されます。

---

## ✅ 受け入れ条件

### 機能要件
1. ✅ 年月選択UIで過去12ヶ月の年月を選択できる
2. ✅ 年月を変更すると、その年月の月次保険料一覧が表示される
3. ✅ 従業員名で絞り込みができる（大文字小文字を無視、部分一致）
4. ✅ フィルタ後の合計（本人負担・会社負担）が正しく表示される
5. ✅ 既存の「計算して保存」機能が正常に動作する（既存機能を壊さない）

### UI/UX要件
1. ✅ 年月選択UIが直感的に操作できる
2. ✅ フィルタ入力がリアルタイムで反映される
3. ✅ 合計金額が明確に表示される
4. ✅ フィルタ適用時は、件数が表示される（「絞り込み後: X件」など）

### データ整合性
1. ✅ 表示されている月次保険料の金額が正しい
2. ✅ 合計金額が表示されている行の合計と一致する
3. ✅ 従業員名が正しく表示される（`employeeId`とのjoinが正しい）

---

## 🔍 実装時の注意点

### 1. 既存機能の保持
- **重要**: 既存の「計算して保存」機能は一切変更しない
- `onCalculateAndSave()`メソッドのロジックはそのまま維持
- `form`（ReactiveForm）の構造は変更しない

### 2. データ取得の最適化
- 年月選択時は`MonthlyPremiumsService.listByOfficeAndYearMonth`を使用
- 従業員名のjoinは、`EmployeesService.list`を1回だけ呼び出し、`Map`で管理
- **重要**: 画面側（`monthly-premiums.page.ts`）では、サービスのObservableから値を取得する場合は`firstValueFrom(...)`で1回分だけ受け取ります。`pipe(switchMap...)`等のObservableチェーンは作らないでください
- （必要であればサービス側の実装では`shareReplay`/`distinctUntilChanged`を使ってもよいが、`monthly-premiums.page.ts`では使用しない）

### 3. パフォーマンス
- フィルタリングは画面側で実装（Firestoreクエリは変更しない）
- `computed` signalを使用して、不要な再計算を避ける
- 大量のデータがある場合でも、フィルタリングがスムーズに動作することを確認

### 4. エラーハンドリング
- `officeId`が未設定の場合の処理
- 年月選択時にデータが存在しない場合の処理（空のテーブルを表示）
- Firestoreクエリエラー時の処理（エラーメッセージを表示）

### 5. UIの一貫性
- 既存のUIデザイン（カード、テーブル、ボタン）と統一感を保つ
- 年月選択UIは`MatSelect`を使用し、既存のフォームフィールドと統一
- フィルタ入力は`MatFormField` + `MatInput`を使用

### 6. 状態管理（重要）
- **既存の実装スタイルに合わせる**: 現在の`monthly-premiums.page.ts`は`signal`/`computed`ベースの実装スタイルです
- 画面コンポーネント（`monthly-premiums.page.ts`）では、`signal`/`computed`/`effect`を使用し、Observableチェーン（`combineLatest`、`switchMap`など）は新たに増やさないこと
- `selectedYearMonth`、`filterText`、`rows`はすべて`signal`で管理
- `filteredRows`、`totalEmployee`、`totalEmployer`は`computed` signalで計算
- サービスのObservableから値を取得する場合は、`firstValueFrom(...)`で1回分だけ受け取る（`pipe(switchMap...)`等のチェーンは作らない）
- 既存の`results` signalを`rows` signalにリネーム（またはそのまま使用）し、表示用の配列として統一管理
- 年月選択の変更は、テンプレート側の`(selectionChange)`イベントから直接`loadPremiumsForYearMonth`を呼び出す（`effect`は使用しない）

### 7. テンプレートの構造
- 年月選択UIと計算フォームは別々のセクションとして配置
- 結果カード内に、フィルタ入力とテーブルを配置
- 合計表示は既存の`.totals`セクションを活用

---

## 📝 実装チェックリスト

### 必須実装
- [ ] 既存の`results` signalを`rows` signalにリネーム（またはそのまま使用）
- [ ] `selectedYearMonth`、`filterText` signalを追加
- [ ] `loadPremiumsForYearMonth()`メソッドを実装（年月選択時のデータ取得）
- [ ] `ngOnInit()`を実装し、初期表示時に当月分を自動ロード（`loadPremiumsForYearMonth(this.selectedYearMonth())`）
- [ ] 年月選択UI（`MatSelect`）を追加
- [ ] 直近12ヶ月の年月選択肢を生成（`yearMonthOptions` computed）
- [ ] 従業員名とjoinする処理を実装（`loadPremiumsForYearMonth`内）
- [ ] フィルタ入力UI（`MatFormField` + `MatInput`）を追加
- [ ] フィルタリングロジックを実装（`filteredRows` computed、nullセーフティ考慮）
- [ ] 既存の`totalEmployee`/`totalEmployer` computedを`filteredRows`に対して計算するように更新
- [ ] `onCalculateAndSave()`メソッドを更新（計算完了後に`loadPremiumsForYearMonth`を呼び出し）
- [ ] 既存の「計算して保存」機能が正常に動作することを確認

### 任意実装（余裕があれば）
- [ ] 各保険種別（健康保険・介護保険・厚生年金）の合計を表示
- [ ] フィルタ適用時の件数を表示（「絞り込み後: X件」）
- [ ] 計算完了後、選択年月を自動更新
- [ ] `MonthlyPremiumsService`に`listRecentYearMonths`メソッドを追加（方法B）

### テスト・確認
- [ ] 年月選択で過去月のデータが正しく表示される
- [ ] 従業員名での絞り込みが正しく動作する
- [ ] 合計金額が正しく計算される
- [ ] 既存の計算機能が正常に動作する
- [ ] エラーハンドリングが適切に実装されている
- [ ] UIが既存デザインと統一されている

---

## 🎨 参考実装

以下のファイルを参考にしてください：

- `src/app/pages/premiums/monthly/monthly-premiums.page.ts` - 既存の実装パターン
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts` - テーブル表示のUIパターン
- `src/app/pages/employees/employees.page.ts` - フィルタリングのUIパターン（参考）

---

## 📌 補足事項

1. **データモデルの変更**: Phase1-9では、Firestoreのスキーマやデータモデルは変更しません。既存の`MonthlyPremium`型と`Employee`型をそのまま使用します。

2. **従業員名のjoin**: 従業員名は`MonthlyPremium`には保存されていないため、画面側で`EmployeesService.list`を使ってjoinします。これは既存の`onCalculateAndSave()`メソッドでも同様の処理が行われています。

3. **状態管理の統一**: Phase1-9では、`results` signalを`rows` signalにリネーム（またはそのまま使用）し、表示用の配列として統一管理します。計算完了時も年月選択時も、同じ`rows` signalを更新することで、状態の二重管理を避け、「画面に表示されているもの = 最後に読み込んだFirestoreの状態」を保証します。

4. **パフォーマンス**: 従業員数が多い場合でも、フィルタリングがスムーズに動作するよう、`computed` signalを活用してください。

5. **将来の拡張**: Phase1-10（ダッシュボード機能）では、この画面で実装した集計ロジックを再利用できるように、適切に抽象化しておくと良いでしょう。

---

以上で実装指示書は完了です。不明点があれば確認してください。

