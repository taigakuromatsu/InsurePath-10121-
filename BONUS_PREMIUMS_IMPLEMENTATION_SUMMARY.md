# 賞与保険料ページ 現状実装まとめ

## ①関連ファイル一覧（パス付き）

### メインコンポーネント
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts` - 賞与保険料ページのメインコンポーネント（1470行）
- `src/app/pages/premiums/bonus/bonus-form-dialog.component.ts` - 賞与登録・編集ダイアログ

### サービス層
- `src/app/services/bonus-premiums.service.ts` - 賞与データのCRUD・一覧取得・再計算ロジック（546行）
- `src/app/services/employees.service.ts` - 従業員データ取得（`list()`, `get()`）
- `src/app/services/masters.service.ts` - 保険料率マスタ取得（`getRatesForYearMonth()`）
- `src/app/services/current-office.service.ts` - 現在の事業所情報取得（`officeId$`, `office$`）

### PDF出力関連
- `src/app/pages/documents/document-generation-dialog.component.ts` - PDF生成ダイアログ（499行）
- `src/app/services/document-generator.service.ts` - PDF生成サービスのエントリーポイント（136行）
- `src/app/utils/document-templates/bonus-payment.ts` - 賞与支払届PDFテンプレート（74行）
- `src/app/utils/document-helpers.ts` - PDF用ヘルパー関数（日付・通貨フォーマット等）

### ユーティリティ
- `src/app/utils/bonus-calculator.ts` - 賞与保険料計算ロジック（上限チェック・料率適用）
- `src/app/utils/premium-calculator.ts` - 保険料計算共通ロジック（50銭ルール・資格判定等）
- `src/app/utils/csv-export.service.ts` - CSVエクスポート機能

### 型定義
- `src/app/types.ts` - `BonusPremium`, `Employee`, `Office`, `YearMonthString` 等の型定義

---

## ②現状のデータモデル要約

### BonusPremium（賞与データ）の主要フィールド

```typescript
interface BonusPremium {
  id: string;                    // ドキュメントID（形式: "{employeeId}_{payDate}"）
  officeId: string;              // 事業所ID
  employeeId: string;            // 従業員ID
  payDate: IsoDateString;        // 支給日（YYYY-MM-DD形式）
  grossAmount: number;            // 賞与支給額（税引前）
  standardBonusAmount: number;   // 標準賞与額（1,000円未満切り捨て後）
  fiscalYear: string;            // 年度（4月1日基準、例: "2025"）
  
  // 上限関連
  healthEffectiveAmount: number;           // 健康保険の有効標準賞与額（上限適用後）
  healthStandardBonusCumulative: number;   // 健康保険の年度内累計
  pensionEffectiveAmount: number;          // 厚生年金の有効標準賞与額（上限適用後）
  
  // 保険料（保存済み）
  healthTotal: number;           // 健康保険＋介護保険の全額
  healthEmployee: number;       // 健康保険＋介護保険の従業員負担額
  pensionTotal: number;          // 厚生年金の全額
  pensionEmployee: number;       // 厚生年金の従業員負担額
  // ... その他
}
```

### 参照関係
- `BonusPremium.officeId` → `Office.id`（事業所情報）
- `BonusPremium.employeeId` → `Employee.id`（従業員情報）
- 保険料率は `MastersService.getRatesForYearMonth(office, yearMonth)` で取得

---

## ③画面表示の流れ（クエリ/フィルタ/ソート）

### (A) 画面初期表示のデータフロー

```
1. ページコンポーネント初期化
   ↓
2. selectedYearMonth を現在年月に設定（デフォルト）
   ↓
3. yearMonthOptions() で直近12か月の候補を生成（UI側）
   ↓
4. effect() 内で officeId$ を購読
   ↓
5. setupReactiveSubscription(officeId, yearMonth) を呼び出し
   ↓
6. BonusPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)
   ↓
7. Firestoreクエリ:
   - collection: 'offices/{officeId}/bonusPremiums'
   - orderBy: 'payDate' desc（支給日降順）
   - フィルタ: クライアント側で年月フィルタ（payDate.substring(0,7) === yearMonth）
   ↓
8. EmployeesService.list(officeId) で従業員一覧を取得
   ↓
9. MastersService.getRatesForYearMonth(office, yearMonth) で保険料率を取得
   ↓
10. combineLatest([bonuses$, employees$, office$]) で統合
   ↓
11. フィルタ処理:
    - 従業員が存在するかチェック
    - hasInsuranceInMonth() で対象年月に資格があるか判定
    - healthEffectiveAmount > 0 または pensionEffectiveAmount > 0 のレコードのみ表示
   ↓
12. 各行に保険料を再計算（healthCareFull, pensionFull 等）
   ↓
13. rows.set() で画面に反映
```

### (B) 対象年月の選択

**12か月制限の実装箇所:**
- **場所**: `bonus-premiums.page.ts` の `yearMonthOptions()` computed（1120-1129行）
- **実装**: 
  ```typescript
  readonly yearMonthOptions = computed(() => {
    const options: YearMonthString[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {  // ← ここで12か月に制限
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` as YearMonthString;
      options.push(yearMonth);
    }
    return options;
  });
  ```
- **制限の理由**: UI側の候補生成ロジックのみ。Firestoreクエリ側には制限なし。

**Firestoreクエリ側の制限:**
- `listByOfficeAndYearMonth()` では `orderBy('payDate', 'desc')` のみ
- 年月フィルタはクライアント側で `payDate.substring(0,7) === yearMonth` で実施
- **Firestore側に where 条件はない**ため、全データを取得してからフィルタしている

**並び順:**
- Firestore: `payDate` 降順（最新が上）
- 画面表示: そのまま（支給日降順）

---

## ④PDF出力の流れ（呼び出し階層と主要関数名）

### (C) 1件PDF出力のデータフロー

```
1. ユーザーがテーブル行の「帳票出力」ボタンをクリック
   ↓
2. bonus-premiums.page.ts: openDocumentDialog(row: BonusPremiumViewRow)
   - 行1466行目
   ↓
3. DocumentGenerationDialogComponent を開く
   - data: { office, employee, bonuses: [row], defaultType: 'bonus_payment' }
   ↓
4. ダイアログ内で「対象賞与」を選択（bonusControl）
   ↓
5. ユーザーが「PDFダウンロード」ボタンをクリック
   ↓
6. document-generation-dialog.component.ts: generate('download')
   - 行355行目
   ↓
7. DocumentGeneratorService.generate()
   - document-generator.service.ts: 行67行目
   - payload: { type: 'bonus_payment', payload: { office, employee, bonus } }
   ↓
8. DocumentGeneratorService.createDefinition()
   - document-generator.service.ts: 行104行目
   ↓
9. createBonusPaymentDocument(input)
   - document-templates/bonus-payment.ts: 行12行目
   - pdfmake の TDocumentDefinitions を生成
   ↓
10. pdfMake.createPdf(definition)
    ↓
11. pdf.download(fileName)
    - ファイル名: "bonus-payment-{従業員名}.pdf"
```

### (D) 1件PDFで使用している入力項目のマッピング

**事業所情報（Office）:**
- `office.name` → 「事業所名」
- `office.officeSymbol` → 「事業所記号」
- `office.officeNumber` → 「事業所番号」

**従業員情報（Employee）:**
- `employee.employeeCodeInOffice` → 「被保険者整理番号」
- `employee.name` → 「氏名」
- `employee.kana` → 「氏名（カナ）」

**賞与情報（BonusPremium）:**
- `bonus.payDate` → 「賞与支給日」（formatDateWithFallback）
- `bonus.grossAmount` → 「賞与支給額」（formatCurrency）
- `bonus.standardBonusAmount` → 「標準賞与額」（formatCurrency）
- `bonus.healthTotal` → 「健康保険料」（formatCurrency）
- `bonus.pensionTotal` → 「厚生年金保険料」（formatCurrency）
- `bonus.fiscalYear` → 「年度」

**バリデーション（document-generation-dialog.component.ts: 454-473行）:**
- 必須: `bonus.payDate`, `bonus.grossAmount`
- 推奨: `bonus.standardBonusAmount`, `bonus.healthTotal`, `bonus.pensionTotal`
- 任意: `office.officeSymbol`

---

## ⑤12か月制限の実装箇所（コード位置と理由）

### 実装箇所

**1. UI候補生成ロジック（主原因）**
- **ファイル**: `src/app/pages/premiums/bonus/bonus-premiums.page.ts`
- **行番号**: 1120-1129行
- **関数**: `yearMonthOptions()` computed
- **コード**:
  ```typescript
  for (let i = 0; i < 12; i++) {  // ← 12か月に固定
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    // ...
  }
  ```
- **理由**: UIのセレクトボックスに表示する候補を12か月に制限

**2. UI説明文**
- **ファイル**: `src/app/pages/premiums/bonus/bonus-premiums.page.ts`
- **行番号**: 91行目
- **内容**: `"直近12ヶ月から閲覧する年月を選択できます。"`

### Firestoreクエリ側の制限

**制限なし**
- `BonusPremiumsService.listByOfficeAndYearMonth()` では:
  - `orderBy('payDate', 'desc')` のみ
  - `where` 条件による年月フィルタは**なし**
  - クライアント側で `payDate.substring(0,7) === yearMonth` でフィルタ

**パフォーマンス影響:**
- 事業所の全賞与データを取得してからフィルタするため、データ量が多い場合にパフォーマンス問題の可能性あり
- ただし、リアルタイムリスナー（`collectionData()`）を使用しているため、初回取得後は変更差分のみ更新される

### 解除/拡張方法の提案

**最小変更案（デフォルト12か月表示 + 過去を開ける）:**
1. `yearMonthOptions()` を修正:
   - デフォルトは12か月
   - 「過去を選択...」オプションを追加
   - 選択時に年選択UIを表示
2. Firestoreクエリは現状のまま（クライアント側フィルタ継続）

**より良い案（Firestore側でフィルタ）:**
1. `listByOfficeAndYearMonth()` に `where` 条件を追加:
   ```typescript
   const startDate = `${yearMonth}-01`;
   const endDate = `${yearMonth}-31`;  // 月末日を正確に計算
   where('payDate', '>=', startDate),
   where('payDate', '<=', endDate)
   ```
2. Firestoreインデックスが必要: `payDate` の昇順インデックス
3. UI側は年選択・年度選択・ページングなどを追加

---

## ⑥月次PDFに拡張する際の変更ポイント（影響範囲・追加が必要な関数案）

### 変更が必要なファイル

#### 1. **bonus-payment.ts（テンプレート）** - 大幅改修
**現状**: 1件1枚の縦型レイアウト
**変更内容**:
- 表形式レイアウトに変更（1枚10人、複数ページ対応）
- 同一月内の複数賞与を合算する処理を追加
- 70歳以上判定と基礎年金番号の表示ロジック追加
- フッターに上限表記を追加

**追加関数案**:
```typescript
// 月次PDF用のデータ集計
interface MonthlyBonusPdfRow {
  employeeCode: string;
  name: string;
  birthDate: string;
  payDate: string;  // 最後の支給日
  grossAmount: number;  // 合算後の支給額
  standardBonusAmount: number;  // 合算後の標準賞与額（1,000円未満切捨て）
  myNumber?: string;  // 70歳以上の場合のみ
  pensionNumber?: string;  // 70歳以上の場合のみ
  note?: string;  // 備考（同一月内に複数回支給がある場合）
}

function aggregateBonusesByEmployee(
  bonuses: BonusPremium[],
  employees: Employee[],
  yearMonth: YearMonthString
): MonthlyBonusPdfRow[]
```

#### 2. **bonus-premiums.page.ts** - 月次PDF出力ボタン追加
**追加場所**: テーブル上部のアクションボタンエリア（268-298行付近）
**追加内容**:
- 「月次PDF出力」ボタンを追加
- `openMonthlyPdfDialog()` メソッドを追加

**追加関数案**:
```typescript
async openMonthlyPdfDialog(): Promise<void> {
  const office = await firstValueFrom(this.office$);
  const yearMonth = this.selectedYearMonth();
  const bonuses = await firstValueFrom(
    this.bonusPremiumsService.listByOfficeAndYearMonth(office.id, yearMonth)
  );
  const employees = await firstValueFrom(this.employees$);
  
  // 月次PDF生成処理を呼び出し
  this.documentGeneratorService.generateMonthlyBonusPdf({
    office,
    employees,
    bonuses,
    yearMonth
  });
}
```

#### 3. **document-generator.service.ts** - 月次PDF生成メソッド追加
**追加内容**:
- `generateMonthlyBonusPdf()` メソッドを追加
- 新しいペイロード型 `MonthlyBonusPdfPayload` を追加

**追加関数案**:
```typescript
export interface MonthlyBonusPdfPayload {
  office: Office;
  employees: Employee[];
  bonuses: BonusPremium[];
  yearMonth: YearMonthString;
}

generateMonthlyBonusPdf(payload: MonthlyBonusPdfPayload, action: DocumentAction): void {
  // データ集計
  const rows = aggregateBonusesByEmployee(payload.bonuses, payload.employees, payload.yearMonth);
  
  // ページ分割（10人/枚）
  const pages = chunkArray(rows, 10);
  
  // PDF生成
  const definition = createMonthlyBonusPaymentDocument({
    office: payload.office,
    rows: pages,
    yearMonth: payload.yearMonth
  });
  
  // ... 既存のPDF生成処理
}
```

#### 4. **bonus-premiums.service.ts** - 月次集計用ヘルパー追加（オプション）
**追加内容**:
- 同一月内の複数賞与を合算するヘルパー関数

**追加関数案**:
```typescript
/**
 * 同一従業員・同一年月の賞与を合算する
 */
aggregateBonusesByEmployeeAndMonth(
  bonuses: BonusPremium[],
  yearMonth: YearMonthString
): Map<string, BonusPremium[]> {
  // employeeId をキーにグループ化
  // payDate でソートして合算ロジックを適用
}
```

### 影響範囲

**影響が少ない箇所:**
- 既存の1件PDF出力機能は変更不要（`bonus_payment` タイプはそのまま）
- データ取得ロジックは変更不要（`listByOfficeAndYearMonth()` をそのまま使用）

**影響がある箇所:**
- PDFテンプレート（`bonus-payment.ts`）は大幅改修が必要
- または、新しいテンプレートファイル（`monthly-bonus-payment.ts`）を作成

### 同一月内に複数支給がある場合の扱い

**現状のモデルで判定可能:**
- `BonusPremium.payDate` の `substring(0,7)` で年月を抽出可能
- `employeeId` でグループ化すれば同一従業員の複数賞与を特定可能
- `payDate` でソートして「最後の支給日」を取得可能

**合算処理の実装方針:**
1. `employeeId` でグループ化
2. 各グループ内で `payDate` 降順ソート
3. 合算処理:
   - `grossAmount`: 合計
   - `standardBonusAmount`: 合計してから1,000円未満切り捨て
   - `payDate`: 最後の支給日を使用
   - 備考: 同一月内に2回以上ある場合は「3」を○して初回支払日を記載

### ページ分割（1枚10人・11人以上は2枚目）

**pdfmakeでの実装可否:**
- **可能**: pdfmakeは複数ページ対応
- `content` 配列に複数の `table` を追加すれば自動的にページ分割される
- または、`pageBreak: 'before'` で明示的にページ分割

**実装例:**
```typescript
const pages = chunkArray(rows, 10);  // 10人ずつに分割
const content = pages.map((pageRows, pageIndex) => ({
  table: { /* 10人分のテーブル */ },
  pageBreak: pageIndex > 0 ? 'before' : undefined
}));
```

---

## ⑦不明点/前提不足があれば「何がどのファイルに無いので判断できないか」を明記

### 確認できたこと
- ✅ 12か月制限の実装箇所（UI側の `yearMonthOptions()`）
- ✅ PDF出力の流れ（`openDocumentDialog` → `DocumentGeneratorService` → `createBonusPaymentDocument`）
- ✅ データ取得ロジック（`listByOfficeAndYearMonth()`）
- ✅ 同一月内の複数賞与の判定方法（`payDate.substring(0,7)` と `employeeId` でグループ化可能）

### 確認できなかったこと（要追加調査）

1. **70歳以上判定ロジック** ✅ 確認済み
   - `label-utils.ts` に `calculateAge(birthDate)` 関数が存在（216-228行）
   - 使用方法: `calculateAge(employee.birthDate) >= 70` で判定可能
   - 対象年月での年齢計算が必要な場合は、対象年月の月末日を基準に年齢を計算する関数を追加する必要あり

2. **基礎年金番号の取得方法** ✅ 確認済み
   - `Employee` 型に `pensionNumber?: string` フィールドが存在（types.ts: 342行）
   - `Employee` 型に `myNumber?: MyNumber` フィールドも存在（types.ts: 343行）
   - 70歳以上の場合のみ、これらのフィールドをPDFに表示する処理を追加

3. **pdfmakeのページ分割の詳細実装**
   - テーブルがページを跨ぐ場合の自動分割動作の確認
   - ヘッダー・フッターの繰り返し設定方法の確認

4. **Firestoreインデックスの現状**
   - `bonusPremiums` コレクションに `payDate` のインデックスが設定されているか未確認
   - 月次PDFで大量データを取得する場合のパフォーマンス影響の見積りが必要

5. **CSVエクスポートとの整合性**
   - `CsvExportService.exportBonusPremiums()` の実装内容未確認
   - 月次PDFとCSVエクスポートのデータ形式の整合性確認が必要

---

## まとめ

### 現状の構造
- **データ取得**: Firestoreから全データ取得 → クライアント側で年月フィルタ
- **PDF出力**: 1件1枚の縦型レイアウト
- **12か月制限**: UI側の候補生成ロジックのみ（Firestore側に制限なし）

### 月次PDF実装への道筋
1. **データ集計ロジック**: 同一月内の複数賞与を合算する関数を追加
2. **PDFテンプレート**: 表形式レイアウトに変更（1枚10人対応）
3. **UI追加**: 月次PDF出力ボタンを追加
4. **サービス拡張**: `DocumentGeneratorService` に月次PDF生成メソッドを追加

### 12か月制限の解除
- **最小変更**: `yearMonthOptions()` を修正して年選択UIを追加
- **推奨変更**: Firestoreクエリに `where` 条件を追加してパフォーマンス改善

