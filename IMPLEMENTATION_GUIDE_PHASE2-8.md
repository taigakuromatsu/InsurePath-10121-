# Phase2-8 実装指示書: CSVインポート機能

**作成日**: 2025年11月  
**対象フェーズ**: Phase2-8（CSVインポート機能）

---

## 📋 概要

Phase2-8では、InsurePathシステムにおけるデータの一括インポート機能を実装します。従業員情報をCSV形式で一括登録・更新できるようにし、データ移行や一括登録の効率化を実現します。

**前提フェーズ**: Phase2-7（CSVエクスポート機能）の実装が完了していることが推奨されますが、必須ではありません。

---

## 🎯 目的・ゴール

### Phase2-8（CSVインポート機能）の目的

1. **一括登録**: 新規従業員の一括登録を効率化する
2. **データ移行**: 既存システムからのデータ移行を支援する
3. **バルク更新**: 複数の従業員情報を一度に更新する

---

## 🧭 スコープ

### Phase2-8で実装する範囲

#### 対象機能・ファイル

1. **CSVインポート共通ユーティリティ**
   - `src/app/utils/csv-import.service.ts`（新規作成）
   - CSVパース、バリデーション、エラー検出
   - **注意**: Firestoreへの保存は行わない（`EmployeesService`の責務）

2. **従業員情報の一括インポートダイアログ**
   - `src/app/pages/employees/employee-import-dialog.component.ts`（新規作成）
   - CSVファイル選択、プレビュー、エラー行表示、確認ダイアログ、インポート実行
   - `MatDialog`を使用したダイアログコンポーネント

3. **従業員台帳ページの拡張**
   - `src/app/pages/employees/employees.page.ts`（拡張）
   - ヘッダ右側に「CSVインポート」ボタンを追加
   - ボタンクリックで`EmployeeImportDialogComponent`を開く
   - ダイアログclose時に結果を受け取って`snackBar`表示と`reload$.next()`で一覧を再読み込み

#### 対象外とするもの

- 月次保険料・賞与保険料のインポート（将来の拡張として検討）
- 標準報酬履歴のインポート（将来の拡張として検討）
- インポート履歴の管理機能（将来の拡張として検討）

---

## 📝 現状の挙動と課題（Before）

### 現状

- 従業員情報の登録は、1件ずつ手動で入力する必要がある
- 既存システムからのデータ移行時は、1件ずつ手動で入力する必要がある

### 課題

- **一括登録の非効率性**: 新規従業員を複数人登録する際、1件ずつ手動で入力する必要がある
- **データ移行の困難さ**: 既存システムからのデータ移行が非効率

---

## 🔄 仕様（Before / After）

### Before

- 従業員情報の登録は、1件ずつ手動で入力する必要がある

### After（Phase2-8）

- 従業員台帳ページ（`employees.page.ts`）のヘッダ右側に「CSVインポート」ボタンが追加される
- ボタンクリックで、CSVインポート専用のダイアログ（`EmployeeImportDialogComponent`）が開く
- CSVファイルの形式チェック、必須項目のバリデーション、エラー行の表示が行われる
- 確認ダイアログで、インポート対象の件数とエラー件数を確認してから実行できる
- インポート結果は、成功件数・エラー件数・エラー詳細を表示するダイアログで確認できる
- インポート完了後、従業員一覧が自動的に再読み込みされる

---

## 🗂️ データモデル・CSVレイアウト仕様

### CSVインポート形式

#### 従業員情報のCSV形式

**CSVファイル形式**: Phase2-7でエクスポートされるCSV形式と同じ形式を受け付ける

**ヘッダ行の仕様**:
- 1行目（ヘッダ行）は、Phase2-7のエクスポートと同じ「日本語カラム名」を前提とする（例: `氏名,生年月日,所属,住所,...`）
- インポート時は、ヘッダ名（日本語）と内部フィールド名（`name`, `birthDate`など）をマッピングしてパースする
- ヘッダ行の順序は、Phase2-7でエクスポートされる順序と同じである必要はないが、ヘッダ名の一致が必要

**必須フィールド**（内部フィールド名）:
- `name`（氏名）: **絶対に必須**
- `birthDate`（生年月日、YYYY-MM-DD形式）: **必須**（既存フォームの`Validators.required`に合わせる）
- `hireDate`（入社日、YYYY-MM-DD形式）: **必須**（既存フォームの`Validators.required`に合わせる）
- `employmentType`（雇用形態）: **必須**（既存フォームの`Validators.required`に合わせる、デフォルト値: `'regular'`）
- `monthlyWage`（標準報酬月額）: **必須**（既存フォームの`Validators.required`に合わせる、デフォルト値: `0`）

**更新判定用フィールド**:
- `id`（既存レコード更新時は必須、新規作成時は任意）: 既存レコードの更新判定に使用（Phase2-8では`id`のみで判定）

**注意**: 必須フィールドの定義は、既存の`employee-form-dialog.component.ts`の`Validators.required`に合わせる。`isInsured`は必須ではない（デフォルト値: `true`）。

**任意フィールド**（内部フィールド名）:
- `kana`（フリガナ）
- `department`（所属部署）
- `address`（住所）
- `phone`（電話番号）
- `contactEmail`（メールアドレス）
- `retireDate`（退職日）
- `weeklyWorkingHours`（所定労働時間）
- `weeklyWorkingDays`（所定労働日数）
- `isStudent`（学生フラグ、`true`/`false`）
- その他の`Employee`型のフィールド

**注意**: 上記の「必須フィールド」「任意フィールド」は、`Employee`型のフィールド名を指しており、CSVヘッダ行の文字列そのものではない。CSVヘッダ行には日本語カラム名（例: `氏名`, `生年月日`）が記載され、それを内部フィールド名（`name`, `birthDate`）にマッピングする。

**既存レコードの更新判定**（Phase2-8の実装範囲）:
- `id`フィールドが存在する場合 → `EmployeesService.save()`が既存ドキュメントを更新（`setDoc`の`merge: true`により、存在すれば更新、存在しなければ新規作成される）
- `id`フィールドが存在しない場合 → `EmployeesService.save()`が新規ドキュメントを作成

**注意**: 
- `EmployeesService.save()`は既に`id`フィールドの有無で新規作成/更新を判定するロジックを持っているため、ダイアログ側は`save()`を呼ぶだけでよい。明示的なFirestore存在チェックは不要。
- Phase2-8では、`id`フィールドによる更新判定のみを実装する。`name` + `birthDate`の組み合わせによる既存レコード検索機能は、今後の拡張余地として検討する（実装コストを抑えるため）。

---

## 🎨 UI/UX仕様

### 従業員台帳ページ（`employees.page.ts`）の拡張

**追加するUI要素**:
- ヘッダ右側のアクションボタンエリアに「CSVインポート」ボタンを追加
- ボタンの配置: 「CSVエクスポート」ボタンの左側（または右側）
- ボタンのスタイル: `mat-stroked-button`、`color="primary"`
- アイコン: `upload`（または`file_upload`）
- 権限制御: `canExport$` Observableを使用（`admin`/`hr`のみ表示）

**ボタンの動作**:
- クリック時に`EmployeeImportDialogComponent`を`MatDialog`で開く
- ダイアログの幅: `720px`（既存の`EmployeeFormDialogComponent`と同じ）

### インポートダイアログ（`employee-import-dialog.component.ts`）

**ダイアログ構成**:
1. **ファイル選択セクション**
   - CSVファイル選択ボタン（`<input type="file" accept=".csv">`）
   - 選択されたファイル名の表示

2. **プレビューセクション**
   - CSVファイルの内容をテーブル形式でプレビュー表示（最大10行まで）
   - エラー行は赤色でハイライト表示

3. **エラー行表示セクション**
   - バリデーションエラーがある行の行番号とエラー内容をリスト表示

4. **確認ダイアログ**（インポート実行前）
   - インポート対象件数・エラー件数を確認
   - 「インポート実行」ボタンと「キャンセル」ボタン

5. **インポート結果表示**（インポート実行後）
   - 成功件数・新規作成件数・更新件数・エラー件数の表示
   - エラー詳細のリスト表示（行番号、エラー内容）
   - 「閉じる」ボタン

**ダイアログフロー**:
1. ユーザーがCSVファイルを選択
2. ファイルをパースしてプレビュー表示
3. バリデーションを実行してエラー行を検出
4. エラー行があれば、エラー内容を表示
5. 「インポート実行」ボタンをクリック
6. 確認ダイアログを表示（`MatDialog`の`confirm`または独自の確認ダイアログ）
7. 「インポート実行」をクリックして実行
8. `EmployeesService.save()`を呼び出して各従業員データを保存
9. インポート結果を表示
10. 「閉じる」ボタンでダイアログを閉じる
11. `employees.page.ts`側で`reload$.next()`を呼び出して一覧を再読み込み
12. `snackBar`で成功メッセージを表示

---

## 🔧 サービス層 / 実装設計

### CSVインポートサービス

#### `src/app/utils/csv-import.service.ts`（新規作成）

**サービスの責務**:
- CSVファイルのパース（日本語ヘッダを内部フィールド名にマッピング）
- バリデーション（必須項目チェック、データ型チェック、形式チェック）
- エラー行の検出とエラーメッセージの生成

**注意**: Firestoreへの保存は行わない。保存処理は`EmployeeImportDialogComponent`側で`EmployeesService.save()`を呼び出して行う。これにより、`CsvImportService`はFirestoreに依存しないユーティリティとして実装できる。

**メソッドシグネチャ（TypeScript疑似コード）**:

```typescript
@Injectable({ providedIn: 'root' })
export class CsvImportService {
  /**
   * CSVファイルをパースして従業員データの配列に変換
   * @param file - CSVファイル（Fileオブジェクト）
   * @returns パース結果（成功データとエラー行の情報）
   * 
   * 注意: パース直後のデータは必須項目が揃っていない可能性があるため、
   * 戻り値の型は`CsvParseResult<Partial<Employee>>`とする。
   * バリデーションで必須項目をチェックしたうえで、
   * ダイアログ側で`Employee`型に整形して`EmployeesService`に渡す。
   */
  async parseEmployeesCsv(file: File): Promise<CsvParseResult<Partial<Employee>>>;

  /**
   * 従業員データのバリデーション
   * @param employee - バリデーション対象の従業員データ
   * @param rowIndex - 行番号（エラーメッセージ用）
   * @returns バリデーションエラーの配列（エラーがない場合は空配列）
   */
  validateEmployee(employee: Partial<Employee>, rowIndex: number): ValidationError[];

}

/**
 * CSVパース結果の型
 */
interface CsvParseResult<T> {
  /** パース成功したデータの配列（バリデーション前のため、必須項目が揃っていない可能性がある） */
  data: T[];
  /** エラー行の情報 */
  errors: CsvParseError[];
}

/**
 * CSVパースエラーの型
 */
interface CsvParseError {
  /** 行番号（1始まり） */
  rowIndex: number;
  /** エラーメッセージ */
  message: string;
  /** エラーが発生したカラム名（オプション） */
  column?: string;
}

/**
 * バリデーションエラーの型
 */
interface ValidationError {
  /** 行番号（1始まり） */
  rowIndex: number;
  /** エラーメッセージ */
  message: string;
  /** エラーが発生したフィールド名 */
  field: string;
}

// 以下のインターフェースは EmployeeImportDialogComponent 側で定義する
// （csv-import.service.ts には定義しない）

/**
 * インポート結果の型（EmployeeImportDialogComponent側で定義・使用）
 */
interface ImportResult {
  /** 成功件数（新規作成 + 更新の合計） */
  successCount: number;
  /** 新規作成件数 */
  createdCount: number;
  /** 更新件数 */
  updatedCount: number;
  /** エラー件数 */
  errorCount: number;
  /** エラー詳細 */
  errors: ImportError[];
}

/**
 * インポートエラーの型（EmployeeImportDialogComponent側で定義・使用）
 */
interface ImportError {
  /** 行番号（1始まり） */
  rowIndex: number;
  /** エラーメッセージ */
  message: string;
}
```

**実装のポイント**:
- **CSVパース**: 今回の実装では、新たなライブラリ（`papaparse`など）は追加せず、自前実装の簡易CSVパーサで構わない。理由: 出力元は自システムのCSV（Phase2-7）のみであり、複雑なCSV形式への対応は不要。ただし、将来的に外部CSVをインポートする場合は`papaparse`などのライブラリを検討する。
- パース直後のデータは`Partial<Employee>`型として扱い、バリデーションで必須項目をチェック
- バリデーション通過後、`Employee`型に整形してから`EmployeeImportDialogComponent`側に返す
- 既存レコードの更新判定は、`id`フィールドのみで行う（Phase2-8の実装範囲）
- エラーハンドリングは、部分的な成功も許容し、エラー行だけをスキップする
- `CsvImportService`はFirestoreに依存しないユーティリティとして実装する（`CsvExportService`と同様）

---

## 🔒 Firestore / セキュリティルールへの影響

**Firestoreルールへの影響**: **なし**

**理由**: CSVインポート機能は、既存の`EmployeesService.save()`メソッドを利用してデータを保存するため、既存のFirestoreルール（`isAdminOrHr`による書き込み制御）をそのまま利用できます。

**画面側の権限制御**:
- インポートボタンの表示は、`employees.page.ts`の`canExport$` Observableを使用（`admin`/`hr`のみ表示）
- 既存の`CSVエクスポート`ボタンと同じ権限制御ロジックを再利用
- 新しいルートを追加する必要がないため、`roleGuard`の追加設定は不要

---

## 📁 対象ファイル一覧と、ファイルごとの変更方針

### Phase2-8で作成・変更するファイル

#### 1. `src/app/utils/csv-import.service.ts`（新規作成）

**変更内容**:
- CSVインポート機能の共通サービスを実装
- `parseEmployeesCsv()`、`validateEmployee()`メソッドを実装
- **注意**: Firestoreへの保存は行わない（`EmployeesService`の責務）

#### 2. `src/app/pages/employees/employee-import-dialog.component.ts`（新規作成）

**変更内容**:
- CSVファイル選択、プレビュー表示、エラー行表示、確認ダイアログ、インポート実行の機能を実装
- `MatDialog`を使用したダイアログコンポーネント
- `MAT_DIALOG_DATA`で`officeId: string`を受け取る（既存の`EmployeeFormDialogComponent`と同様）
- `CsvImportService`でパース・バリデーションを行い、`EmployeesService.save()`で各従業員データを保存
- インポート結果（成功件数、新規作成件数、更新件数、エラー件数、エラー詳細）を表示
- ダイアログclose時に`ImportResult | undefined`を返す（キャンセル時は`undefined`）

#### 3. `src/app/pages/employees/employees.page.ts`（拡張）

**変更内容**:
- ヘッダ右側のアクションボタンエリアに「CSVインポート」ボタンを追加
- ボタンクリックで`EmployeeImportDialogComponent`を`MatDialog`で開く
- ダイアログclose時に結果を受け取り、`snackBar`で成功メッセージを表示
- `reload$.next()`を呼び出して従業員一覧を再読み込み

---

## 🛠️ 実装ステップ

#### Step 1: CSVインポートサービスの実装

1. `src/app/utils/csv-import.service.ts`を新規作成
2. `CsvImportService`クラスを実装
3. `parseEmployeesCsv()`メソッドを実装（自前実装の簡易CSVパーサを使用）
   - 日本語ヘッダ行を読み取り、内部フィールド名にマッピング
   - CSVデータ行をパースして`Partial<Employee>[]`に変換
4. `validateEmployee()`メソッドを実装（必須項目チェック、データ型チェック）
   - 既存の`employee-form-dialog.component.ts`の`Validators.required`に合わせる
   - 必須項目: `name`, `birthDate`, `hireDate`, `employmentType`, `monthlyWage`
   - エラーメッセージを`ValidationError[]`形式で返す

#### Step 2: インポートダイアログの実装

1. `src/app/pages/employees/employee-import-dialog.component.ts`を新規作成
2. `MatDialog`を使用したダイアログコンポーネントとして実装
3. `MAT_DIALOG_DATA`で`{ officeId: string }`を受け取るインターフェースを定義
4. CSVファイル選択機能を実装（`<input type="file" accept=".csv">`）
5. CSVパース・プレビュー表示機能を実装（`CsvImportService.parseEmployeesCsv()`を使用）
6. バリデーション・エラー行表示機能を実装（`CsvImportService.validateEmployee()`を使用）
7. 確認ダイアログを実装（インポート実行前）
8. インポート実行機能を実装
   - バリデーション通過したデータに対して、`EmployeesService.save(officeId, employee)`を呼び出して各従業員データを保存
   - `EmployeesService.save()`の引数は`Partial<Employee> & { id?: string }`形式
   - **重要**: `EmployeesService.save()`は既に`id`フィールドの有無で新規作成/更新を判定するロジックを持っている（`id`が存在する場合は既存ドキュメントを更新、存在しない場合は新規作成）。ダイアログ側は`save()`を呼ぶだけでよく、明示的な存在チェックは不要。
   - `id`フィールドの有無で新規作成件数（`createdCount`）と更新件数（`updatedCount`）を記録（`id`が存在する場合は`updatedCount`をインクリメント、存在しない場合は`createdCount`をインクリメント）
   - エラーが発生した行は`ImportError[]`に記録
   - 各従業員データの保存は`Promise.all()`または順次処理で実行（大量データの場合は進捗表示を検討）
9. インポート結果表示機能を実装（成功件数、新規作成件数、更新件数、エラー件数、エラー詳細）
10. ダイアログclose時に`ImportResult | undefined`を返す（キャンセル時は`undefined`）

#### Step 3: 従業員台帳ページの拡張

1. `src/app/pages/employees/employees.page.ts`を拡張
2. `EmployeeImportDialogComponent`をインポート
3. ヘッダ右側のアクションボタンエリアに「CSVインポート」ボタンを追加
4. ボタンの権限制御: `canExport$` Observableを使用（既存の`CSVエクスポート`ボタンと同じ）
5. ボタンクリック時に`EmployeeImportDialogComponent`を`MatDialog`で開く
   - `data: { officeId }`を渡す（`officeId$`から取得）
6. ダイアログclose時に結果（`ImportResult | undefined`）を受け取り、結果が存在する場合は`snackBar`で成功メッセージを表示
7. `reload$.next()`を呼び出して従業員一覧を再読み込み（結果が存在する場合のみ）

#### Step 4: 動作確認・テスト

1. 正しい形式のCSVファイルをインポートし、正常に登録されることを確認
2. エラー行を含むCSVファイルをインポートし、エラー行が適切に表示されることを確認
3. 部分的な成功時も、エラー行だけがスキップされることを確認
4. 既存レコードの`id`を含むCSVをインポートし、更新されることを確認
5. 権限制御が正しく動作することを確認（`admin`/`hr`のみボタンが表示される）

---

## ✅ テスト観点・受け入れ条件

#### テストケース1: 正しい形式のCSVファイルのインポート

**前提条件**:
- `admin`または`hr`ロールでログインしている
- 正しい形式のCSVファイル（必須項目がすべて入力されている）を準備

**実行手順**:
1. 従業員台帳ページ（`employees.page.ts`）にアクセス
2. ヘッダ右側の「CSVインポート」ボタンをクリック
3. CSVインポートダイアログが開くことを確認
4. CSVファイルを選択
5. プレビューを確認
6. 「インポート実行」ボタンをクリック
7. 確認ダイアログで「インポート実行」をクリック

**期待結果**:
- CSVファイルが正常にパースされる
- バリデーションエラーがない
- すべての従業員データがFirestoreに保存される
- インポート結果ダイアログで、成功件数（`successCount`）、新規作成件数（`createdCount`）、更新件数（`updatedCount`）が正しく表示される
- ダイアログを閉じた後、従業員一覧が自動的に再読み込みされる
- `snackBar`で成功メッセージが表示される

#### テストケース2: エラー行を含むCSVファイルのインポート

**前提条件**:
- `admin`または`hr`ロールでログインしている
- エラー行（必須項目が未入力、データ型が不正など）を含むCSVファイルを準備

**実行手順**:
1. 従業員台帳ページにアクセス
2. 「CSVインポート」ボタンをクリック
3. CSVファイルを選択
4. プレビューを確認
5. エラー行が赤色でハイライト表示されることを確認
6. エラー行表示セクションでエラー内容を確認
7. 「インポート実行」ボタンをクリック
8. 確認ダイアログで、エラー件数が表示されることを確認
9. 「インポート実行」をクリック

**期待結果**:
- エラー行はスキップされ、正常な行のみがFirestoreに保存される
- インポート結果ダイアログで、成功件数（`successCount`）、新規作成件数（`createdCount`）、更新件数（`updatedCount`）、エラー件数（`errorCount`）が正しく表示される
- エラー詳細に、行番号とエラー内容が表示される

#### テストケース3: 既存レコードの更新

**前提条件**:
- `admin`または`hr`ロールでログインしている
- 既存の従業員レコードが存在する
- CSVファイルに、既存レコードの`id`が含まれている

**実行手順**:
1. 従業員台帳ページにアクセス
2. 「CSVインポート」ボタンをクリック
3. CSVファイルを選択（既存レコードの`id`を含む）
4. 「インポート実行」ボタンをクリック
5. 確認ダイアログで「インポート実行」をクリック

**期待結果**:
- 既存レコードが更新される（新規作成されない）
- インポート結果ダイアログで、更新件数（`updatedCount`）が正しく表示される
- 新規作成件数（`createdCount`）は0、更新件数（`updatedCount`）が正の値として表示される

#### テストケース4: 権限制御の確認

**前提条件**:
- `employee`ロールでログインしている

**実行手順**:
1. 従業員台帳ページにアクセス

**期待結果**:
- 「CSVインポート」ボタンが表示されない（`canExport$`が`false`のため）

---

## ⚠️ 注意点・今後の拡張余地

### Phase2-8で注意すべき点

1. **バリデーション**: 既存の`Employee`型の必須項目をチェックし、データ型の整合性を保つ
2. **エラーハンドリング**: 部分的な成功も許容し、エラー行だけをスキップする設計にする
3. **パフォーマンス**: 大量のデータをインポートする場合、進捗表示を実装することを検討する
4. **CSV形式の互換性**: Phase2-7でエクスポートされるCSV形式と互換性を保つ

### 今後の拡張余地

1. **月次保険料・賞与保険料のインポート**: CSV形式で月次保険料・賞与保険料を一括登録できるようにする
2. **標準報酬履歴のインポート**: CSV形式で標準報酬履歴を一括登録できるようにする
3. **インポート履歴の管理**: インポート実行履歴をFirestoreに保存し、過去のインポート結果を確認できるようにする
4. **CSVテンプレートのダウンロード**: インポート用のCSVテンプレートをダウンロードできるようにする（Phase2-7のエクスポート機能を活用）
5. **既存レコードの検索機能**: `id`フィールドがない場合でも、`name` + `birthDate`の組み合わせで既存レコードを検索して更新できるようにする（実装コストを考慮してPhase2-8では実装しない）
6. **外部CSVライブラリの導入**: 将来的に外部システムからのCSVインポートに対応する場合、`papaparse`などのライブラリを導入して、より複雑なCSV形式に対応する

---

以上で、Phase2-8（CSVインポート機能）の実装指示書は完了です。

