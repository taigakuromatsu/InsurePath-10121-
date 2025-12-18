# Phase2-7 実装指示書: CSVエクスポート機能

**作成日**: 2025年11月  
**対象フェーズ**: Phase2-7（CSVエクスポート機能 MVP）

---

## 📋 概要

Phase2-7では、InsurePathシステムにおけるデータの一括エクスポート機能を実装します。従業員台帳一覧、月次保険料一覧、賞与一覧からCSV形式でデータをダウンロードできるようにし、Excel等での分析・レポート作成を支援します。

**関連フェーズ**: Phase2-8（CSVインポート機能）は別フェーズとして実装予定です。

---

## 🎯 目的・ゴール

### Phase2-7（CSVエクスポート機能）の目的

1. **運用効率化**: 従業員情報や保険料データをExcel等で編集・分析できるようにする
2. **データバックアップ**: 重要なデータをCSV形式でエクスポートし、バックアップとして保存可能にする
3. **レポート作成支援**: 外部ツール（Excel、Googleスプレッドシート等）でのレポート作成を支援する

---

## 🧭 スコープ

### Phase2-7で実装する範囲

#### 対象機能・ファイル

1. **CSVエクスポート共通ユーティリティ**
   - `src/app/utils/csv-export.service.ts`（新規作成）
   - CSV生成ロジック、UTF-8 + BOM対応、ダウンロード処理

2. **従業員台帳一覧からのCSVエクスポート**
   - `src/app/pages/employees/employees.page.ts`（拡張）
   - 「CSVエクスポート」ボタンの追加
   - `employees$` Observableを利用してCSV生成

3. **月次保険料一覧からのCSVエクスポート**
   - `src/app/pages/premiums/monthly/monthly-premiums.page.ts`（拡張）
   - 「CSVエクスポート」ボタンの追加
   - `filteredRows()` computed signalを利用してCSV生成（絞り込み後のデータを出力）

4. **賞与一覧からのCSVエクスポート**
   - `src/app/pages/premiums/bonus/bonus-premiums.page.ts`（拡張）
   - 「CSVエクスポート」ボタンの追加
   - `viewModel$` Observableを利用してCSV生成

#### 対象外とするもの

- CSVインポート機能（Phase2-8で実装予定）
- 標準報酬履歴のエクスポート（将来の拡張として検討）
- 被扶養者情報のエクスポート（将来の拡張として検討）
- フィルタ条件の保存・読み込み機能
- エクスポート履歴の管理機能

---

## 📝 現状の挙動と課題（Before）

### 現状

- 従業員情報、月次保険料、賞与保険料は、すべてFirestore上で管理されている
- データの閲覧・編集は、すべてWebアプリケーション上で行う必要がある
- 外部ツール（Excel等）での分析・レポート作成が困難
- 大量のデータを一度に確認・編集する際の効率が低い

### 課題

- **データ分析の非効率性**: Excel等で分析したい場合、手動でデータをコピー&ペーストする必要がある
- **バックアップの困難さ**: 重要なデータをCSV形式でエクスポートしてバックアップを取ることができない

---

## 🔄 仕様（Before / After）

### Before

- 従業員一覧、月次保険料一覧、賞与一覧は、Webアプリケーション上でのみ閲覧可能
- データを外部ツールで利用するには、手動でコピー&ペーストが必要

### After（Phase2-7）

- 各一覧画面に「CSVエクスポート」ボタンが追加される
- ボタンクリックで、現在表示されているデータ（フィルタ適用後）がCSV形式でダウンロードされる
- CSVファイルはUTF-8 + BOMエンコーディングで生成され、Excelで開いても文字化けしない
- ファイル名は「従業員一覧_YYYYMMDD_HHMMSS.csv」のような形式で自動生成される

---

## 🗂️ データモデル・CSVレイアウト仕様

### ⚠️ 実装時の重要な注意事項

**実装前に必ず確認**: 以下のカラム定義は、`src/app/types.ts`で定義されている`Employee`、`MonthlyPremium`、`BonusPremium`型のフィールド名を前提としています。実装時には、実際の型定義と照らし合わせて、`CsvColumn<T>`の`getValue`関数内で適切にプロパティにアクセスしてください。

**型の確認ポイント**:
- `Employee`型のフィールド名（`address`、`weeklyWorkingHours`、`healthStandardMonthly`など）が実際の型定義と一致しているか
- `createdAt`/`updatedAt`は`IsoDateString`型（string）なので、そのまま出力可能（Timestamp型への変換は不要）
- 月次保険料・賞与の「行の型」は、各ページで実際に使っている型（`MonthlyPremium & { employeeName: string }`、`BonusPremiumWithEmployee`など）に合わせる

**CSV値のフォーマット方針（MVP）**:
- boolean値: `"true"`/`"false"`の文字列として出力（Excelで見やすいように）
- number値: 生値のまま出力（カンマ区切りやフォーマットは将来の拡張として検討）
- null/undefined: 空文字列（`''`）として出力

### CSVエクスポート対象のカラム定義

#### 1. 従業員台帳一覧（`employees.page.ts`）

**CSVファイル名**: `従業員一覧_YYYYMMDD_HHMMSS.csv`

**データソース**: `employees$` Observable（`Employee[]`型）

**カラム定義**:

| カラム名（日本語） | フィールド名 | 型 | 説明 |
|------------------|------------|-----|------|
| ID | id | string | 従業員ID（FirestoreドキュメントID） |
| 氏名 | name | string | 従業員氏名 |
| フリガナ | kana | string | フリガナ（任意） |
| 生年月日 | birthDate | string (YYYY-MM-DD) | 生年月日 |
| 所属 | department | string | 所属部署（任意） |
| 住所 | address | string | 住所（任意） |
| 電話番号 | phone | string | 電話番号（任意） |
| メールアドレス | contactEmail | string | 連絡先メールアドレス（任意） |
| 入社日 | hireDate | string (YYYY-MM-DD) | 入社日 |
| 退職日 | retireDate | string (YYYY-MM-DD) | 退職日（任意） |
| 雇用形態 | employmentType | string | 雇用形態（正社員、契約社員、パート、アルバイト、その他） |
| 所定労働時間 | weeklyWorkingHours | number | 週所定労働時間（任意） |
| 所定労働日数 | weeklyWorkingDays | number | 週所定労働日数（任意） |
| 学生 | isStudent | boolean | 学生フラグ（true/false） |
| 標準報酬月額 | monthlyWage | number | 標準報酬月額 |
| 社会保険加入 | isInsured | boolean | 社会保険加入フラグ（true/false） |
| 健康保険等級 | healthGrade | number | 健康保険等級（任意） |
| 健康保険標準報酬月額 | healthStandardMonthly | number | 健康保険標準報酬月額（任意） |
| 厚生年金等級 | pensionGrade | number | 厚生年金等級（任意） |
| 厚生年金標準報酬月額 | pensionStandardMonthly | number | 厚生年金標準報酬月額（任意） |
| 就業状態 | workingStatus | string | 就業状態（通常、産休、育休、休職、その他） |
| 作成日時 | createdAt | string (ISO 8601) | 作成日時（任意） |
| 更新日時 | updatedAt | string (ISO 8601) | 更新日時（任意） |

**実装時の注意事項**:
- カラムの順序は上記の通りとする
- 任意項目が`null`または`undefined`の場合は、空文字列（`''`）として出力する
- 日付型（`birthDate`、`hireDate`、`retireDate`）は`IsoDateString`型（`YYYY-MM-DD`形式のstring）なので、そのまま出力可能
- 日時型（`createdAt`、`updatedAt`）は`IsoDateString`型（ISO 8601形式のstring）なので、そのまま出力可能
- 真偽値（`isStudent`、`isInsured`）は`"true"`/`"false"`の文字列として出力する
- `Employee`型の実際のフィールド名に合わせて、`getValue`関数内でプロパティにアクセスする

#### 2. 月次保険料一覧（`monthly-premiums.page.ts`）

**CSVファイル名**: `月次保険料一覧_YYYY-MM_YYYYMMDD_HHMMSS.csv`（`YYYY-MM`は対象年月）

**ファイル名フォーマットの注意事項**:
- `yearMonth`パラメータは`YYYY-MM`形式（例: `2025-01`）で受け取る
- ファイル名の「対象年月トークン」部分は`YYYY-MM`形式のまま使用する（例: `月次保険料一覧_2025-01_20250115_143022.csv`）
- タイムスタンプ部分（`YYYYMMDD_HHMMSS`）はハイフンなし形式を使用する

**データソース**: `filteredRows()` computed signal（`(MonthlyPremium & { employeeName: string })[]`型）

**実装時の注意事項**:
- このページでは`rows` signalが`(MonthlyPremium & { employeeName: string })[]`型として定義されている
- `CsvExportService.exportMonthlyPremiums()`の引数型は、実際のページで使っている型に合わせる
- `getValue`関数内で、`row.employeeName`などのプロパティにアクセスする

**カラム定義**:

| カラム名（日本語） | フィールド名 | 型 | 説明 |
|------------------|------------|-----|------|
| 対象年月 | yearMonth | string (YYYY-MM) | 対象年月 |
| 従業員ID | employeeId | string | 従業員ID |
| 氏名 | employeeName | string | 従業員氏名 |
| 健康保険等級 | healthGrade | number | 健康保険等級 |
| 健康保険標準報酬月額 | healthStandardMonthly | number | 健康保険標準報酬月額 |
| 健康保険本人負担 | healthEmployee | number | 健康保険本人負担額 |
| 健康保険会社負担 | healthEmployer | number | 健康保険会社負担額 |
| 健康保険合計 | healthTotal | number | 健康保険合計額 |
| 介護保険本人負担 | careEmployee | number | 介護保険本人負担額（任意） |
| 介護保険会社負担 | careEmployer | number | 介護保険会社負担額（任意） |
| 介護保険合計 | careTotal | number | 介護保険合計額（任意） |
| 厚生年金等級 | pensionGrade | number | 厚生年金等級 |
| 厚生年金標準報酬月額 | pensionStandardMonthly | number | 厚生年金標準報酬月額 |
| 厚生年金本人負担 | pensionEmployee | number | 厚生年金本人負担額 |
| 厚生年金会社負担 | pensionEmployer | number | 厚生年金会社負担額 |
| 厚生年金合計 | pensionTotal | number | 厚生年金合計額 |
| 本人負担合計 | totalEmployee | number | 本人負担合計額 |
| 会社負担合計 | totalEmployer | number | 会社負担合計額 |
| 計算日時 | calculatedAt | string (ISO 8601) | 計算実行日時 |

**注意事項**:
- 絞り込みフィルタが適用されている場合は、フィルタ後のデータのみをエクスポートする
- 介護保険が適用されていない従業員の場合、介護保険関連のカラムは空文字列として出力する

#### 3. 賞与一覧（`bonus-premiums.page.ts`）

**CSVファイル名**: `賞与一覧_YYYYMMDD_HHMMSS.csv`

**データソース**: `viewModel$` Observableの`rows`プロパティ（`BonusPremiumWithEmployee[]`型）

**実装時の注意事項**:
- このページでは`BonusPremiumWithEmployee`という型エイリアスが定義されている
  - `BonusPremiumWithEmployee`は`BonusPremium & { employeeName: string }`の型エイリアス
  - 実装時には、`bonus-premiums.page.ts`で定義されている型エイリアスをそのまま使用するか、または`(BonusPremium & { employeeName: string })[]`として記述しても良い
- `CsvExportService.exportBonusPremiums()`の引数型は、実際のページで使っている型に合わせる
- `getValue`関数内で、`row.employeeName`などのプロパティにアクセスする

**カラム定義**:

| カラム名（日本語） | フィールド名 | 型 | 説明 |
|------------------|------------|-----|------|
| 支給日 | payDate | string (YYYY-MM-DD) | 賞与支給日 |
| 従業員ID | employeeId | string | 従業員ID |
| 氏名 | employeeName | string | 従業員氏名 |
| 賞与支給額 | grossAmount | number | 賞与支給額（総額） |
| 標準賞与額 | standardBonusAmount | number | 標準賞与額 |
| 年度内累計標準賞与額 | healthStandardBonusCumulative | number | 健康保険の年度内累計標準賞与額（任意） |
| 健康保険本人負担 | healthEmployee | number | 健康保険本人負担額 |
| 健康保険会社負担 | healthEmployer | number | 健康保険会社負担額 |
| 健康保険合計 | healthTotal | number | 健康保険合計額 |
| 厚生年金本人負担 | pensionEmployee | number | 厚生年金本人負担額 |
| 厚生年金会社負担 | pensionEmployer | number | 厚生年金会社負担額 |
| 厚生年金合計 | pensionTotal | number | 厚生年金合計額 |
| 本人負担合計 | totalEmployee | number | 本人負担合計額 |
| 会社負担合計 | totalEmployer | number | 会社負担合計額 |
| 年度 | fiscalYear | string | 年度（YYYY形式） |
| メモ | note | string | メモ（任意） |
| 作成日時 | createdAt | string (ISO 8601) | 作成日時 |

**注意事項**:
- 年度内累計標準賞与額が未設定の場合は、空文字列として出力する

### CSVエンコーディング仕様

- **エンコーディング**: UTF-8 + BOM（Byte Order Mark）
- **改行コード**: CRLF（`\r\n`）
- **区切り文字**: カンマ（`,`）
- **文字列の囲み文字**: ダブルクォート（`"`）
- **エスケープ**: ダブルクォートを含む文字列は、ダブルクォートを2つ重ねてエスケープ（`""`）

**理由**: Excelで開いた際に文字化けしないようにするため、UTF-8 + BOMを採用する。

### CSVヘッダ行の仕様

**重要**: CSVの1行目（ヘッダ行）には、`CsvColumn<T>.label`として定義した「カラム名（日本語）」を出力する。

- 例: `氏名,生年月日,所属,住所,電話番号,メールアドレス,入社日,...`
- フィールド名（`name`, `birthDate`など）は内部マッピング用であり、ヘッダ行には出力しない
- Phase2-8（CSVインポート機能）では、この日本語ヘッダを読み取って内部フィールド名にマッピングする

---

## 🎨 UI/UX仕様

### 1. 従業員台帳一覧（`employees.page.ts`）

**ボタン配置**:
- ページヘッダー（`.page-header`）内の「従業員を追加」ボタンの右側に配置
- ボタンラベル: 「CSVエクスポート」
- アイコン: `download`（Material Icons）

**実装イメージ**:
```html
<div class="page-header">
  <div class="page-title-section">
    <!-- 既存のタイトルセクション -->
  </div>
  <div class="header-actions">
    <button
      mat-stroked-button
      color="primary"
      (click)="exportToCsv()"
      [disabled]="!(employees$ | async)?.length"
      *ngIf="canExport$ | async"
    >
      <mat-icon>download</mat-icon>
      CSVエクスポート
    </button>
    <button
      mat-raised-button
      color="primary"
      (click)="openDialog()"
      [disabled]="!(officeId$ | async)"
    >
      <mat-icon>person_add</mat-icon>
      従業員を追加
    </button>
  </div>
</div>
```

**動作**:
- ボタンクリック時、`employees$` Observableから現在の従業員一覧を取得
- `CsvExportService.exportEmployees()`を呼び出してCSV生成・ダウンロード
- エクスポート完了後、`MatSnackBar`で「CSVエクスポートが完了しました」と通知

### 2. 月次保険料一覧（`monthly-premiums.page.ts`）

**ボタン配置**:
- 結果カード（`.result-card`）内の結果ヘッダー（`.result-header`）内に配置
- ボタンラベル: 「CSVエクスポート」
- アイコン: `download`（Material Icons）

**実装イメージ**:
```html
<div class="result-header">
  <h2>
    <mat-icon>list</mat-icon>
    計算結果一覧（{{ selectedYearMonth() }}）
  </h2>
  <button
    mat-stroked-button
    color="primary"
    (click)="exportToCsv()"
    [disabled]="filteredRows().length === 0"
    *ngIf="canExport$ | async"
  >
    <mat-icon>download</mat-icon>
    CSVエクスポート
  </button>
</div>
```

**動作**:
- ボタンクリック時、`filteredRows()` computed signalから現在表示されているデータを取得
- `CsvExportService.exportMonthlyPremiums()`を呼び出してCSV生成・ダウンロード
- ファイル名に対象年月を含める（`YYYY-MM`形式、例: `月次保険料一覧_2025-01_20250115_143022.csv`）

### 3. 賞与一覧（`bonus-premiums.page.ts`）

**ボタン配置**:
- ページヘッダー（`.page-header`）内の「賞与を登録」ボタンの右側に配置
- ボタンラベル: 「CSVエクスポート」
- アイコン: `download`（Material Icons）

**実装イメージ**:
```html
<div class="page-header">
  <div class="page-title-section">
    <!-- 既存のタイトルセクション -->
  </div>
  <div class="header-actions">
    <button
      mat-stroked-button
      color="primary"
      (click)="exportToCsv()"
      [disabled]="!(viewModel$ | async)?.rows.length"
      *ngIf="canExport$ | async"
    >
      <mat-icon>download</mat-icon>
      CSVエクスポート
    </button>
    <button
      mat-raised-button
      color="primary"
      (click)="openDialog()"
      [disabled]="!(officeId$ | async)"
    >
      <mat-icon>note_add</mat-icon>
      賞与を登録
    </button>
  </div>
</div>
```

**動作**:
- ボタンクリック時、`viewModel$` Observableから現在の賞与一覧を取得
- `CsvExportService.exportBonusPremiums()`を呼び出してCSV生成・ダウンロード

---

## 🔧 サービス層 / 実装設計

### CSVエクスポートサービス

#### `src/app/utils/csv-export.service.ts`（新規作成）

**サービスの責務**:
- CSV形式の文字列生成
- UTF-8 + BOMエンコーディングでのファイル生成
- ブラウザのダウンロード機能を利用したファイルダウンロード

**メソッドシグネチャ（TypeScript疑似コード）**:

```typescript
@Injectable({ providedIn: 'root' })
export class CsvExportService {
  /**
   * 従業員一覧をCSV形式でエクスポート
   * @param employees - エクスポート対象の従業員配列
   * @param fileName - ファイル名（拡張子なし、デフォルト: '従業員一覧'）
   */
  exportEmployees(employees: Employee[], fileName?: string): void;

  /**
   * 月次保険料一覧をCSV形式でエクスポート
   * @param premiums - エクスポート対象の月次保険料配列（employeeNameを含む）
   *                   実際のページで使っている型に合わせる（例: MonthlyPremium & { employeeName: string }）
   * @param yearMonth - 対象年月（ファイル名に含める）
   * @param fileName - ファイル名（拡張子なし、デフォルト: '月次保険料一覧'）
   */
  exportMonthlyPremiums(
    premiums: (MonthlyPremium & { employeeName: string })[],
    yearMonth?: string,
    fileName?: string
  ): void;

  /**
   * 賞与一覧をCSV形式でエクスポート
   * @param bonuses - エクスポート対象の賞与配列（employeeNameを含む）
   *                  実際のページで使っている型に合わせる
   *                  `BonusPremiumWithEmployee`は`BonusPremium & { employeeName: string }`の型エイリアス
   * @param fileName - ファイル名（拡張子なし、デフォルト: '賞与一覧'）
   */
  exportBonusPremiums(
    bonuses: (BonusPremium & { employeeName: string })[],
    fileName?: string
  ): void;

  /**
   * 汎用CSVエクスポートメソッド
   * @param data - エクスポート対象のデータ配列
   * @param columns - カラム定義（カラム名とデータ取得関数のペア）
   * @param fileName - ファイル名（拡張子なし）
   * 
   * 実装時の注意:
   * - `getValue`の戻り値（`string | number | null | undefined`）を文字列に変換する処理を実装する
   * - `null`/`undefined`の場合は空文字列（`''`）に変換
   * - `number`型の場合は`String()`で文字列化
   * - 例: `const raw = column.getValue(row); const text = raw == null ? '' : String(raw);`
   */
  private exportCsv<T>(
    data: T[],
    columns: CsvColumn<T>[],
    fileName: string
  ): void;

  /**
   * CSV形式の文字列を生成（UTF-8 + BOM）
   * @param rows - CSV行の配列（各行は文字列の配列）
   * @returns UTF-8 + BOMエンコーディングのBlob
   */
  private createCsvBlob(rows: string[][]): Blob;

  /**
   * ファイル名にタイムスタンプを付与
   * @param baseName - ベースファイル名（拡張子なし）
   * @returns タイムスタンプ付きファイル名（拡張子付き）
   */
  private generateFileName(baseName: string, suffix?: string): string;

  /**
   * ブラウザのダウンロード機能を利用してファイルをダウンロード
   * @param blob - ダウンロード対象のBlob
   * @param fileName - ファイル名（拡張子付き）
   */
  private downloadBlob(blob: Blob, fileName: string): void;
}

/**
 * CSVカラム定義の型
 */
interface CsvColumn<T> {
  /** カラム名（日本語） */
  label: string;
  /** データ取得関数
   * 
   * 戻り値は`string | number | null | undefined`のいずれか。
   * `exportCsv()`メソッド内で、この戻り値を文字列に変換する処理を実装する。
   * - `null`/`undefined` → 空文字列（`''`）
   * - `number` → `String()`で文字列化
   * - `string` → そのまま使用
   */
  getValue: (row: T) => string | number | null | undefined;
  /** 値のフォーマット関数（オプション）
   * 
   * この関数が指定されている場合は、`getValue`の戻り値を`format`で変換してから使用する。
   * 指定されていない場合は、`getValue`の戻り値をそのまま文字列化する。
   */
  format?: (value: any) => string;
}
```

**実装のポイント**:
- UTF-8 + BOMエンコーディングは、`\uFEFF`（BOM文字）を先頭に付与することで実現
- CSVのエスケープ処理（ダブルクォートのエスケープ、改行の処理）を適切に実装
- `exportCsv()`メソッド内で、`getValue`の戻り値を文字列に変換する処理を実装する
  - `null`/`undefined` → 空文字列（`''`）
  - `number` → `String()`で文字列化
  - `string` → そのまま使用
  - 例: `const raw = column.getValue(row); const text = raw == null ? '' : String(raw);`
- 日付・日時型のフォーマットは、上記の仕様に従う（`IsoDateString`型はそのまま出力可能）
- 真偽値は`getValue`内で`"true"`/`"false"`の文字列として返す（または`format`関数で変換）
- 数値は生値のまま出力（カンマ区切りやフォーマットは将来の拡張として検討）
- `CsvColumn<T>`の`getValue`関数内で、実際の型定義に合わせてプロパティにアクセスする
  - 例: `getValue: (row) => row.employeeName ?? ''`（型に応じて適切にアクセス）

---

## 🔒 Firestore / セキュリティルールへの影響

**Firestoreルールへの影響**: **なし**

**理由**: CSVエクスポート機能は、既存のFirestore read権限の範囲内でデータを取得するだけであり、新しい書き込み操作や特別な権限は不要です。既存のFirestoreルール（`belongsToOffice`、`isAdminOrHr`、`isOwnEmployee`等）をそのまま利用できます。

**画面側の権限制御**:
- CSVエクスポートボタンは、`admin`/`hr`ロールのみに表示する
- `employee`ロールには表示しない（既存の`roleGuard`やメニュー表示制御で対応）

**実装方法**:
- 各ページコンポーネントで、`CurrentUserService`を注入
- `CurrentUserService.profile$` Observableから現在のユーザープロファイルを取得
- `profile.role`が`'admin'`または`'hr'`の場合のみ、CSVエクスポートボタンを表示（`*ngIf`で制御）
- 実装例:
  ```typescript
  private readonly currentUser = inject(CurrentUserService);
  readonly canExport$ = this.currentUser.profile$.pipe(
    map(profile => profile?.role === 'admin' || profile?.role === 'hr')
  );
  ```
- テンプレート側では、`*ngIf="canExport$ | async"`でボタンの表示を制御

---

## 📁 対象ファイル一覧と、ファイルごとの変更方針

### Phase2-7で変更するファイル

#### 1. `src/app/utils/csv-export.service.ts`（新規作成）

**変更内容**:
- CSVエクスポート機能の共通サービスを実装
- `exportEmployees()`、`exportMonthlyPremiums()`、`exportBonusPremiums()`メソッドを実装
- UTF-8 + BOMエンコーディング対応のCSV生成ロジックを実装

#### 2. `src/app/pages/employees/employees.page.ts`（拡張）

**変更内容**:
- `CsvExportService`を注入
- `CurrentUserService`を注入し、`canExport$` Observableを作成
- `exportToCsv()`メソッドを追加
- ページヘッダーに「CSVエクスポート」ボタンを追加
- `employees$` Observableから現在の従業員一覧を取得してCSVエクスポート

**追加するメソッド**:
```typescript
private readonly currentUser = inject(CurrentUserService);
readonly canExport$ = this.currentUser.profile$.pipe(
  map(profile => profile?.role === 'admin' || profile?.role === 'hr')
);

async exportToCsv(): Promise<void> {
  // 実装時の注意: employees$ Observableから現在のデータを取得
  // 実際のコンポーネントでsignalベースの場合は、this.employees()のように調整
  const employees = await firstValueFrom(this.employees$);
  if (!employees || employees.length === 0) {
    this.snackBar.open('エクスポートするデータがありません', '閉じる', { duration: 3000 });
    return;
  }
  this.csvExportService.exportEmployees(employees);
  this.snackBar.open('CSVエクスポートが完了しました', '閉じる', { duration: 3000 });
}
```

#### 3. `src/app/pages/premiums/monthly/monthly-premiums.page.ts`（拡張）

**変更内容**:
- `CsvExportService`を注入
- `CurrentUserService`を注入し、`canExport$` Observableを作成
- `exportToCsv()`メソッドを追加
- 結果ヘッダーに「CSVエクスポート」ボタンを追加
- `filteredRows()` computed signalから現在表示されているデータを取得してCSVエクスポート

**追加するメソッド**:
```typescript
private readonly currentUser = inject(CurrentUserService);
readonly canExport$ = this.currentUser.profile$.pipe(
  map(profile => profile?.role === 'admin' || profile?.role === 'hr')
);

exportToCsv(): void {
  // 実装時の注意: filteredRows() computed signalから現在表示されているデータを取得
  // 型は (MonthlyPremium & { employeeName: string })[] に合わせる
  const rows = this.filteredRows();
  if (rows.length === 0) {
    this.snackBar.open('エクスポートするデータがありません', '閉じる', { duration: 3000 });
    return;
  }
  this.csvExportService.exportMonthlyPremiums(rows, this.selectedYearMonth());
  this.snackBar.open('CSVエクスポートが完了しました', '閉じる', { duration: 3000 });
}
```

#### 4. `src/app/pages/premiums/bonus/bonus-premiums.page.ts`（拡張）

**変更内容**:
- `CsvExportService`を注入
- `CurrentUserService`を注入し、`canExport$` Observableを作成
- `exportToCsv()`メソッドを追加
- ページヘッダーに「CSVエクスポート」ボタンを追加
- `viewModel$` Observableから現在の賞与一覧を取得してCSVエクスポート

**追加するメソッド**:
```typescript
private readonly currentUser = inject(CurrentUserService);
readonly canExport$ = this.currentUser.profile$.pipe(
  map(profile => profile?.role === 'admin' || profile?.role === 'hr')
);

async exportToCsv(): Promise<void> {
  // 実装時の注意: viewModel$ Observableから現在のデータを取得
  // vm.rows の型は BonusPremiumWithEmployee[] に合わせる
  const vm = await firstValueFrom(this.viewModel$);
  if (!vm || vm.rows.length === 0) {
    this.snackBar.open('エクスポートするデータがありません', '閉じる', { duration: 3000 });
    return;
  }
  this.csvExportService.exportBonusPremiums(vm.rows);
  this.snackBar.open('CSVエクスポートが完了しました', '閉じる', { duration: 3000 });
}
```

---

## 🛠️ 実装ステップ

#### Step 1: CSVエクスポートサービスの実装

1. `src/app/utils/csv-export.service.ts`を新規作成
2. `CsvExportService`クラスを実装
3. `createCsvBlob()`、`generateFileName()`、`downloadBlob()`などのプライベートメソッドを実装
4. `exportCsv()`汎用メソッドを実装
5. `exportEmployees()`、`exportMonthlyPremiums()`、`exportBonusPremiums()`メソッドを実装
6. 各メソッドで、カラム定義（`CsvColumn`配列）を作成して`exportCsv()`を呼び出す
7. **重要**: `CsvColumn<T>`の`getValue`関数内で、実際の型定義（`Employee`、`MonthlyPremium`、`BonusPremium`など）に合わせてプロパティにアクセスする
   - `src/app/types.ts`の型定義を確認し、フィールド名が一致しているか確認
   - `createdAt`/`updatedAt`は`IsoDateString`型（string）なので、そのまま出力可能
   - boolean値は`"true"`/`"false"`の文字列として出力
   - number値は生値のまま出力（MVPではフォーマットなし）

#### Step 2: 従業員台帳一覧へのCSVエクスポート機能追加

1. `src/app/pages/employees/employees.page.ts`を開く
2. `CsvExportService`を`inject()`で注入
3. `CurrentUserService`を`inject()`で注入し、`canExport$` Observableを作成
4. `exportToCsv()`メソッドを追加（`employees$` Observableからデータを取得）
5. テンプレートの`.page-header`セクションに「CSVエクスポート」ボタンを追加
6. ボタンの`*ngIf`で`canExport$ | async`をチェックし、`admin`/`hr`のみ表示
7. ボタンの`[disabled]`属性で、データがない場合は無効化
8. ボタンクリック時に`exportToCsv()`を呼び出す
9. エクスポート完了後、`MatSnackBar`で通知

#### Step 3: 月次保険料一覧へのCSVエクスポート機能追加

1. `src/app/pages/premiums/monthly/monthly-premiums.page.ts`を開く（※実際のファイルパスに合わせて調整）
2. `CsvExportService`を`inject()`で注入
3. `CurrentUserService`を`inject()`で注入し、`canExport$` Observableを作成
4. `exportToCsv()`メソッドを追加（`filteredRows()` computed signalからデータを取得）
   - 型は`(MonthlyPremium & { employeeName: string })[]`に合わせる
5. テンプレートの`.result-header`セクションに「CSVエクスポート」ボタンを追加
6. ボタンの`*ngIf`で`canExport$ | async`をチェックし、`admin`/`hr`のみ表示
7. ボタンの`[disabled]`属性で、`filteredRows().length === 0`の場合は無効化
8. ボタンクリック時に`exportToCsv()`を呼び出す
9. エクスポート完了後、`MatSnackBar`で通知

#### Step 4: 賞与一覧へのCSVエクスポート機能追加

1. `src/app/pages/premiums/bonus/bonus-premiums.page.ts`を開く（※実際のファイルパスに合わせて調整）
2. `CsvExportService`を`inject()`で注入
3. `CurrentUserService`を`inject()`で注入し、`canExport$` Observableを作成
4. `exportToCsv()`メソッドを追加（`viewModel$` Observableからデータを取得）
   - `vm.rows`の型は`BonusPremiumWithEmployee[]`に合わせる
5. テンプレートの`.page-header`セクションに「CSVエクスポート」ボタンを追加
6. ボタンの`*ngIf`で`canExport$ | async`をチェックし、`admin`/`hr`のみ表示
7. ボタンの`[disabled]`属性で、データがない場合は無効化
8. ボタンクリック時に`exportToCsv()`を呼び出す
9. エクスポート完了後、`MatSnackBar`で通知

#### Step 5: 動作確認・テスト

1. 従業員一覧からCSVエクスポートを実行し、Excelで開いて文字化けしないことを確認
2. 月次保険料一覧からCSVエクスポートを実行し、フィルタ後のデータのみがエクスポートされることを確認
3. 賞与一覧からCSVエクスポートを実行し、全件がエクスポートされることを確認
4. `employee`ロールでログインし、CSVエクスポートボタンが表示されないことを確認

---

## ✅ テスト観点・受け入れ条件

#### テストケース1: 従業員一覧からのCSVエクスポート

**前提条件**:
- `admin`または`hr`ロールでログインしている
- 従業員が1件以上登録されている

**実行手順**:
1. 従業員台帳一覧画面（`/employees`）にアクセス
2. 「CSVエクスポート」ボタンをクリック

**期待結果**:
- CSVファイルがダウンロードされる
- ファイル名は「従業員一覧_YYYYMMDD_HHMMSS.csv」形式
- Excelで開いても文字化けしない
- すべての従業員データが含まれている
- カラムの順序が仕様通りである
- 任意項目が`null`の場合は空文字列として出力されている

#### テストケース2: 月次保険料一覧からのCSVエクスポート（フィルタ適用後）

**前提条件**:
- `admin`または`hr`ロールでログインしている
- 月次保険料が1件以上登録されている
- 絞り込みフィルタで従業員名を検索している

**実行手順**:
1. 月次保険料一覧画面（`/premiums/monthly`）にアクセス
2. 対象年月を選択
3. 絞り込みフィルタで従業員名を検索
4. 「CSVエクスポート」ボタンをクリック

**期待結果**:
- CSVファイルがダウンロードされる
- ファイル名は「月次保険料一覧_YYYY-MM_YYYYMMDD_HHMMSS.csv」形式（対象年月が`YYYY-MM`形式で含まれる、例: `月次保険料一覧_2025-01_20250115_143022.csv`）
- Excelで開いても文字化けしない
- フィルタ後のデータのみが含まれている（フィルタ前の全件ではない）
- すべてのカラムが含まれている

#### テストケース3: 賞与一覧からのCSVエクスポート

**前提条件**:
- `admin`または`hr`ロールでログインしている
- 賞与が1件以上登録されている

**実行手順**:
1. 賞与一覧画面（`/premiums/bonus`）にアクセス
2. 「CSVエクスポート」ボタンをクリック

**期待結果**:
- CSVファイルがダウンロードされる
- ファイル名は「賞与一覧_YYYYMMDD_HHMMSS.csv」形式
- Excelで開いても文字化けしない
- すべての賞与データが含まれている

#### テストケース4: データが0件の場合の動作

**前提条件**:
- `admin`または`hr`ロールでログインしている
- 従業員が0件登録されている（または、月次保険料・賞与が0件）

**実行手順**:
1. 各一覧画面にアクセス
2. 「CSVエクスポート」ボタンの状態を確認

**期待結果**:
- CSVエクスポートボタンが無効化（`disabled`）されている
- ボタンクリック時は、エラーメッセージが表示される（「エクスポートするデータがありません」）

#### テストケース5: 権限制御の確認

**前提条件**:
- `employee`ロールでログインしている

**実行手順**:
1. 各一覧画面にアクセス
2. CSVエクスポートボタンの表示を確認

**期待結果**:
- CSVエクスポートボタンが表示されない（`*ngIf`で非表示）

---

## ⚠️ 注意点・今後の拡張余地

### Phase2-7で注意すべき点

1. **既存実装への影響を最小に**: 既存の一覧表示・集計ロジックを壊さないように、Observableやcomputed signalをそのまま再利用する
2. **型の整合性**: 実装時には、`src/app/types.ts`の型定義と実際のページで使っている型を確認し、`CsvColumn<T>`の`getValue`関数内で適切にプロパティにアクセスする
3. **データソースの確認**: 各ページで使っているデータソース（Observable/signal）を確認し、それに合わせて実装を調整する
4. **ファイルパスの確認**: 実際のファイルパスが指示書と異なる場合は、適宜読み替える（Cursorはリポジトリを見ているので自動で合わせてくれるはず）
5. **パフォーマンス**: 大量のデータをエクスポートする場合、ブラウザのメモリ使用量に注意する（必要に応じて、チャンク処理を検討）
6. **エンコーディング**: UTF-8 + BOMエンコーディングを正しく実装し、Excelで開いても文字化けしないことを確認する
7. **CSV値のフォーマット**: MVPでは、boolean値は`"true"`/`"false"`、number値は生値のまま出力する。カンマ区切りやフォーマットは将来の拡張として検討

### 今後の拡張余地

1. **標準報酬履歴のエクスポート**: 従業員詳細ダイアログの「標準報酬履歴」セクションから、履歴データをCSVエクスポートできるようにする
2. **被扶養者情報のエクスポート**: 従業員詳細ダイアログの「扶養家族」セクションから、被扶養者データをCSVエクスポートできるようにする
3. **エクスポート履歴の管理**: エクスポート実行履歴をFirestoreに保存し、過去のエクスポートファイルを再ダウンロードできるようにする
4. **フィルタ条件の保存・読み込み**: エクスポート時のフィルタ条件を保存し、次回同じ条件でエクスポートできるようにする
5. **CSVテンプレートのダウンロード**: Phase2-8（CSVインポート機能）で使用するCSVテンプレートをダウンロードできるようにする

---

以上で、Phase2-7（CSVエクスポート機能）の実装指示書は完了です。
