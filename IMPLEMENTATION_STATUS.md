# InsurePath 実装状況レポート

**作成日**: 2025年1月  
**最終更新**: 2025年12月2日（Phase3-6完了後）

## 概要

本ドキュメントは、CATALOG.mdに記載された35の機能要件に対する現時点での実装状況をまとめたものです。

---

## ✅ 実装済み機能

### (12) 賞与管理・賞与保険料計算機能（実装済み）

**実装状況**: 賞与支給履歴の登録・閲覧・計算機能は実装済み

- ✅ ページコンポーネントとルーティング
- ✅ 型定義（BonusPremium）
- ✅ 賞与支給履歴の登録・閲覧・編集・削除
- ✅ 標準賞与額の計算（1,000円未満切り捨て）
- ✅ 賞与保険料の計算ロジック（健康保険・厚生年金）
- ✅ 上限チェック（健康保険573万円/年度累計、厚生年金150万円/回）
- ✅ 年度（4月1日基準）の自動判定
- ✅ 健康保険の年度内累計標準賞与額の管理
- ✅ マスタからの保険料率自動取得
- ✅ 計算結果プレビュー表示
- ✅ 本人負担額・会社負担額の集計表示

**関連ファイル**:
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts`（実装済み）
- `src/app/pages/premiums/bonus/bonus-form-dialog.component.ts`（実装済み）
- `src/app/services/bonus-premiums.service.ts`（実装済み）
- `src/app/utils/bonus-calculator.ts`（実装済み）

### (2) ユーザー・ロール管理機能（部分実装）

**実装状況**: 基本認証とユーザープロファイル管理は実装済み

- ✅ Firebase Authenticationによるログイン認証
- ✅ ユーザープロファイル（UserProfile）の型定義と保存
- ✅ 所属事業所ID（officeId）とロール（admin/hr/employee）の保持
- ✅ 従業員ID（employeeId）の自動紐づけ機能（Phase1-8で実装）
- ⚠️ ロール別アクセス制御の実装は未完了（ガードは存在するが、画面レベルでの制御は未実装）

**関連ファイル**:
- `src/app/services/auth.service.ts`
- `src/app/services/current-user.service.ts`
- `src/app/guards/auth.guard.ts`
- `src/app/guards/office.guard.ts`

### (1) 事業所（会社）管理機能（基本実装）

**実装状況**: CRUD操作は実装済み

- ✅ 事業所の基本情報（事業所名、所在地、健康保険種別）の登録・編集
- ✅ 協会けんぽ／組合健保の選択
- ✅ 都道府県支部の選択（協会けんぽ）
- ✅ 健康保険組合名の登録（組合健保）
- ⚠️ 保険料率の初期値設定は未実装

**関連ファイル**:
- `src/app/services/offices.service.ts`
- `src/app/pages/offices/offices.page.ts`
- `src/app/pages/office-setup/office-setup.page.ts`

### (3) 従業員台帳・在籍・資格情報・就労条件管理機能（実装済み）

**実装状況**: 基本情報のCRUDと資格情報・就業状態管理は実装済み

- ✅ 従業員の基本情報（氏名、フリガナ、生年月日、住所、電話番号、メールアドレス、入社日、退職日、所属部署）
- ✅ 雇用区分（正社員・契約社員・パート・アルバイト等）
- ✅ 報酬月額（月給）
- ✅ 所定労働時間・所定労働日数
- ✅ 雇用契約期間の見込み
- ✅ 学生フラグ
- ✅ 健康保険の被保険者記号・番号
- ✅ 厚生年金の被保険者番号
- ✅ 社会保険加入フラグ（isInsured）
- ✅ 健康保険・厚生年金の等級・標準報酬月額の保持
- ✅ 最終更新者・更新日時の記録
- ✅ 資格取得日・資格喪失日の管理（健康保険・厚生年金）
- ✅ 資格取得区分・資格喪失理由区分（健康保険・厚生年金）
- ✅ 就業状態（通常勤務／産前産後休業／育児休業／傷病休職等）の管理
- ✅ 就業状態の期間・保険料扱いの管理
- ✅ 介護保険対象判定の自動化（premium-calculator.tsで実装済み）
- ✅ 入社日・退職日・資格日からの「計上対象月」自動判定ロジック（premium-calculator.tsで実装済み）

**関連ファイル**:
- `src/app/services/employees.service.ts`
- `src/app/pages/employees/employees.page.ts`
- `src/app/pages/employees/employee-form-dialog.component.ts`
- `src/app/pages/employees/employee-detail-dialog.component.ts`
- `src/app/utils/label-utils.ts`（新規追加）

### (4) 被扶養者（家族）管理機能（実装済み）

**実装状況**: Phase2-3完了により、被扶養者管理機能が完全実装済み

- ✅ 被扶養者情報の型定義（`Dependent`型、`DependentRelationship`型）
- ✅ 被扶養者登録・編集画面（`dependent-form-dialog.component.ts`）
- ✅ 資格取得日・喪失日の管理
- ✅ 従業員詳細ダイアログ内での扶養家族一覧表示（admin/hrは追加・編集・削除可能、employeeは閲覧のみ）
- ✅ マイページでの扶養家族閲覧機能（employeeロール向け）
- ✅ Firestoreセキュリティルールによるアクセス制御
- ⚠️ 扶養状況確認機能（年次見直し支援機能は将来の拡張として検討）

**関連ファイル**:
- `src/app/types.ts`（`Dependent`型、`DependentRelationship`型追加）
- `src/app/services/dependents.service.ts`（新規作成）
- `src/app/pages/employees/dependent-form-dialog.component.ts`（新規作成）
- `src/app/pages/employees/employee-detail-dialog.component.ts`（扶養家族セクション追加）
- `src/app/pages/me/my-page.ts`（扶養家族閲覧セクション追加）
- `src/app/utils/label-utils.ts`（`getDependentRelationshipLabel`関数追加）
- `firestore.rules`（`dependents`サブコレクションのルール追加）

**Phase2-4による導線改善**:
- ✅ 従業員一覧からの「扶養家族を管理」ボタン追加
- ✅ 従業員詳細ダイアログ内のセクションナビ追加
- ✅ 特定セクションへの自動スクロール機能

### (5) 標準報酬決定・改定履歴管理機能（実装済み）

**実装状況**: Phase2-5完了により、標準報酬決定・改定履歴管理機能が完全実装済み

- ✅ 履歴管理の型定義（`StandardRewardHistory`型、`StandardRewardDecisionKind`型）
- ✅ 履歴登録・編集・削除画面（`standard-reward-history-form-dialog.component.ts`）
- ✅ 履歴一覧表示（従業員詳細ダイアログ内のセクションとして実装、時系列順）
- ✅ 適用開始年月の管理（決定年月と適用開始年月の両方を入力可能）
- ✅ 決定区分の管理（定時決定、随時改定、賞与支払時、資格取得時、資格喪失時、その他）
- ✅ Firestoreセキュリティルールによるアクセス制御（admin/hrのみ追加・編集・削除可能）
- ✅ Phase2-6により、従業員編集フォームでの`monthlyWage`変更時に自動で履歴を追加する機能も実装済み

**関連ファイル**:
- `src/app/types.ts`（`StandardRewardHistory`型、`StandardRewardDecisionKind`型追加）
- `src/app/services/standard-reward-history.service.ts`（新規作成）
- `src/app/pages/employees/standard-reward-history-form-dialog.component.ts`（新規作成）
- `src/app/pages/employees/employee-detail-dialog.component.ts`（標準報酬履歴セクション追加）
- `src/app/pages/employees/employee-form-dialog.component.ts`（自動履歴追加ロジック追加）
- `src/app/utils/label-utils.ts`（`getStandardRewardDecisionKindLabel`関数追加）
- `firestore.rules`（`standardRewardHistories`サブコレクションのルール追加）

### (13) セキュリティ・アクセス制御機能（実装済み）

**実装状況**: Phase2-1完了により、FirestoreセキュリティルールとAngular側のアクセス制御が完全実装済み

- ✅ Firebase Authenticationによる認証
- ✅ Firestoreセキュリティルールの詳細化（事業所IDに基づくデータ分離、ロール別アクセス制御）
- ✅ InsurePath向けのユーティリティ関数（`currentUser`, `getUserRole`, `belongsToOffice`, `isAdminOrHr`, `isInsureAdmin`, `isInsureEmployee`, `isOwnEmployee`）
- ✅ `offices/{officeId}`配下の各コレクションに対するロール別アクセス制御
  - 事業所情報: 所属ユーザー全員閲覧可能、adminのみ更新・削除可能
  - 従業員情報: admin/hrは全件閲覧可能、employeeは自分のレコードのみ閲覧可能
  - 月次保険料・賞与保険料: admin/hrは全件閲覧可能、employeeは自分のデータのみ閲覧可能
  - マスタ情報: 所属ユーザー全員閲覧可能、adminのみ更新・削除可能
- ✅ Angular側の`roleGuard`実装（ロール別ルート保護）
- ✅ ルーティング設定への`roleGuard`適用（各ルートに適切なロール制限を設定）
- ✅ サイドメニューのロール別表示制御（`app.ts`で実装）
- ✅ 権限がない場合の適切なリダイレクト（`/me`へ遷移）
- ⚠️ 識別情報のマスキング表示は未実装（将来の拡張として検討）

**関連ファイル**:
- `firestore.rules`（大幅拡張、InsurePath向けルール追加）
- `src/app/guards/role.guard.ts`（新規作成）
- `src/app/app.routes.ts`（`roleGuard`追加）
- `src/app/app.ts`（サイドメニューのロール別表示制御）

### (14) 従業員情報一括インポート機能（実装済み）

**実装状況**: Phase2-8完了により、従業員情報の一括インポート機能が完全実装済み

- ✅ CSVインポートサービスの実装（`CsvImportService`）
- ✅ CSVパース機能（自前実装の簡易CSVパーサー、コメント行サポート）
- ✅ バリデーション機能（必須項目チェック、データ型チェック、形式チェック）
- ✅ ヘッダマッピング（日本語ヘッダ → Employeeプロパティキー）
- ✅ 雇用形態のマッピング（日本語入力 → 内部コード変換）
- ✅ インポートダイアログ（ファイル選択、プレビュー、エラー行表示、確認ダイアログ、結果表示）
- ✅ エラーハンドリング（部分的な成功も許容、エラー行はスキップ）
- ✅ エラーメッセージの改善（利用可能な値を表示）
- ✅ CSVテンプレートダウンロード機能
- ✅ 簡易ルール説明表示

**関連ファイル**:
- `src/app/utils/csv-import.service.ts`（新規作成）
- `src/app/pages/employees/employee-import-dialog.component.ts`（新規作成）
- `src/app/pages/employees/employees.page.ts`（CSVインポートボタン追加）
- `src/app/utils/csv-export.service.ts`（テンプレート出力機能追加）

### (15) 保険料データのCSVエクスポート機能（実装済み）

**実装状況**: Phase2-7完了により、CSVエクスポート機能が完全実装済み

- ✅ CSVエクスポートサービスの実装（`CsvExportService`）
- ✅ 従業員台帳のエクスポート（全件エクスポート、admin/hrのみ）
- ✅ 月次保険料一覧のエクスポート（対象年月指定、フィルタ後のデータをエクスポート）
- ✅ 賞与一覧のエクスポート（全件エクスポート）
- ✅ CSV形式の定義（UTF-8 + BOMエンコーディング、日本語ヘッダ、CRLF改行）
- ✅ CSVテンプレートダウンロード機能（ヘッダ行のみ、コメント行付き）
- ✅ エクスポートとテンプレートのフォーマット統一（`CsvImportService.getEmployeeHeaderMapping()`を使用）

**関連ファイル**:
- `src/app/utils/csv-export.service.ts`（新規作成）
- `src/app/pages/employees/employees.page.ts`（CSVエクスポートボタン追加）
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts`（CSVエクスポートボタン追加）
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts`（CSVエクスポートボタン追加）

### (35) CSVテンプレートダウンロード機能（実装済み）

**実装状況**: Phase2-7完了により、CSVテンプレートダウンロード機能が完全実装済み

- ✅ CSVテンプレートダウンロード機能
- ✅ ヘッダ行のみのテンプレートCSV出力
- ✅ コメント行付きテンプレート（入力ルール説明）
- ✅ 従業員台帳ページからのダウンロード
- ✅ CSVインポートダイアログからのダウンロード

**関連ファイル**:
- `src/app/utils/csv-export.service.ts`（`exportEmployeesTemplate()`メソッド）
- `src/app/pages/employees/employees.page.ts`（CSVテンプレートボタン追加）
- `src/app/pages/employees/employee-import-dialog.component.ts`（テンプレートダウンロードボタン追加）

---

## 🚧 部分実装・プレースホルダー状態

### (8) 月次保険料一覧・会社負担集計機能（実装済み）

**実装状況**: 計算・保存・一覧表示・マスタ連携・機能拡張は実装済み（Phase1-9完了）

- ✅ ページコンポーネントとルーティング
- ✅ 保険料計算ロジック（premium-calculator.ts経由）
- ✅ 一括計算・保存機能
- ✅ 一覧表示（シート形式）
- ✅ 会社負担額総計の集計
- ✅ 本人負担額総計の集計
- ✅ マスタからの料率自動取得
- ✅ 適用料率の表示
- ✅ 過去月分の一覧表示（年月選択UI、直近12ヶ月対応）
- ✅ 従業員名での絞り込み機能
- ✅ 月単位の合計行表示（本人負担・会社負担）
- ✅ 初期表示で当月分を自動ロード

**関連ファイル**:
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts`（実装済み）
- `src/app/services/monthly-premiums.service.ts`（実装済み）
- `src/app/utils/premium-calculator.ts`（実装済み）

### (10) 保険料シミュレーション機能（実装済み）

**実装状況**: Phase1-11完了により、保険料シミュレーション機能が完全実装済み

- ✅ ページコンポーネントとルーティング
- ✅ シミュレーション計算ロジック（`premium-calculator.ts`を再利用）
- ✅ 入力フォーム（対象年月、報酬月額、健康保険等級、厚生年金等級、介護保険対象フラグ）
- ✅ 結果表示（等級・標準報酬月額、各保険の本人負担額・会社負担額・合計、トータル）
- ✅ マスタからの保険料率自動取得
- ✅ エラーハンドリング（マスタ未設定、料率未設定など）
- ✅ 既存の月次保険料計算ロジックとの整合性確保

**関連ファイル**:
- `src/app/pages/simulator/simulator.page.ts`（実装済み）
- `src/app/utils/premium-calculator.ts`（再利用）

### (11) 負担構成ダッシュボード機能（実装済み）

**実装状況**: Phase1-10完了によりKPIカードの基本機能が実装済み、Phase1-12完了によりグラフ表示機能が追加実装済み

- ✅ ページコンポーネントとルーティング
- ✅ 従業員数カード（社会保険加入者数または全従業員数）
- ✅ 月次保険料カード（今月の会社負担額合計）
- ✅ トレンドカード（前月比の変化、増減率%）
- ✅ 過去12ヶ月の推移グラフ（折れ線グラフ、月次保険料の会社負担額推移）
- ✅ 当月の月次・賞与比較グラフ（棒グラフ）
- ✅ 年度別集計グラフ（棒グラフ、4月1日基準）
- ✅ 従業員別ランキング表示（会社負担額・本人負担額トップ10）
- ✅ データ取得と集計ロジック
- ✅ エラーハンドリングとデータなし時の表示

**関連ファイル**:
- `src/app/pages/dashboard/dashboard.page.ts`（実装済み）

### (9) 従業員別保険料明細（マイページ）機能（実装済み）

**実装状況**: Phase1-7で完全実装済み

- ✅ ページコンポーネントとルーティング
- ✅ 基本情報の表示（氏名、所属部署、入社日、等級・標準報酬月額、社会保険加入状況）
- ✅ 月次保険料明細の表示（直近12ヶ月分）
- ✅ 賞与保険料明細の表示
- ✅ 本人・会社負担額の表示
- ✅ 空データ時の適切なメッセージ表示
- ✅ 従業員IDによる自動フィルタリング（セキュリティ確保）
- ⚠️ 推移グラフ（未実装、将来の拡張）

**関連ファイル**:
- `src/app/pages/me/my-page.ts`（実装済み）
- `src/app/services/monthly-premiums.service.ts`（`listByOfficeAndEmployee`メソッド追加）

### (12) 賞与管理・賞与保険料計算機能（実装済み）

**実装状況**: 賞与支給履歴の登録・閲覧・計算機能は実装済み

- ✅ ページコンポーネントとルーティング
- ✅ 型定義（BonusPremium）
- ✅ 賞与支給履歴の登録・閲覧・編集・削除
- ✅ 標準賞与額の計算（1,000円未満切り捨て）
- ✅ 賞与保険料の計算ロジック（健康保険・厚生年金）
- ✅ 上限チェック（健康保険573万円/年度累計、厚生年金150万円/回）
- ✅ 年度（4月1日基準）の自動判定
- ✅ 健康保険の年度内累計標準賞与額の管理
- ✅ マスタからの保険料率自動取得
- ✅ 計算結果プレビュー表示
- ✅ 本人負担額・会社負担額の集計表示

**関連ファイル**:
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts`（実装済み）
- `src/app/pages/premiums/bonus/bonus-form-dialog.component.ts`（実装済み）
- `src/app/services/bonus-premiums.service.ts`（実装済み）
- `src/app/utils/bonus-calculator.ts`（実装済み）

### (7) 社会保険料自動計算機能（実装済み）

**実装状況**: 計算ロジックと保存機能は実装済み

- ✅ 型定義（MonthlyPremium, PremiumRateContext, MonthlyPremiumCalculationResult）
- ✅ 厚生年金保険料計算ロジック
- ✅ 介護保険料計算ロジック（40〜64歳判定含む）
- ✅ 健康保険料計算ロジック
- ✅ 端数処理の統一（1円未満切り捨て）
- ✅ 計算結果の保存（Firestore）
- ✅ 資格取得日・喪失日ベースの対象月判定
- ✅ 保険料免除（premiumTreatment === 'exempt'）の処理

**関連ファイル**:
- `src/app/utils/premium-calculator.ts`（新規追加）
- `src/app/services/monthly-premiums.service.ts`（新規追加）

### (6) 標準報酬月額・等級・保険プランマスタ管理機能（実装済み）

**実装状況**: マスタ管理機能は実装済み

- ✅ ページコンポーネントとルーティング
- ✅ 型定義（HealthRateTable, CareRateTable, PensionRateTable, StandardRewardBand）
- ✅ マスタ登録・編集画面（健康保険・介護保険・厚生年金）
- ✅ 年度別マスタ管理
- ✅ 協会けんぽの初期値プリセット（都道府県別）
- ✅ 標準報酬等級表の登録・管理
- ✅ 月次保険料計算画面とのマスタ連携
- ⚠️ 等級自動判定機能（報酬月額からの自動判定）は未実装

**関連ファイル**:
- `src/app/pages/masters/masters.page.ts`（実装済み）
- `src/app/services/masters.service.ts`（新規追加）
- `src/app/pages/masters/health-master-form-dialog.component.ts`（新規追加）
- `src/app/pages/masters/care-master-form-dialog.component.ts`（新規追加）
- `src/app/pages/masters/pension-master-form-dialog.component.ts`（新規追加）
- `src/app/utils/kyokai-presets.ts`（新規追加）

### (18) 従業員情報の変更申請・承認（簡易ワークフロー）機能 ✅ 実装済み

**実装状況**: Phase3-3完了により、従業員情報の変更申請・承認機能が完全実装済み

- ✅ 型定義（`ChangeRequest`型、`ChangeRequestStatus`型）
- ✅ 変更申請サービス（`ChangeRequestsService`）
  - 申請の作成（`create()`）
  - 申請の一覧取得（`list()`）- admin/hr用、リアルタイム購読
  - ユーザー単位の申請一覧取得（`listForUser()`）- employee用、リアルタイム購読
  - 申請の承認（`approve()`）
  - 申請の却下（`reject()`）
- ✅ 申請登録ダイアログ（`change-request-form-dialog.component.ts`）
  - 従業員本人が申請を登録できる
  - 申請可能な項目：住所、電話番号、メールアドレス
  - 現在値と申請値の入力フォーム
  - submit 2重実行バグ修正済み（`type="submit"`使用）
- ✅ 申請一覧画面（`requests.page.ts`）
  - admin/hr専用（employeeロールはアクセス不可）
  - 事業所ごとの申請一覧表示
  - ステータス別フィルタ（pending / approved / rejected）
  - 承認・却下ボタン
  - 承認時：従業員台帳への自動反映
  - 却下時：却下理由の入力と保存
- ✅ 却下理由入力ダイアログ（`reject-reason-dialog.component.ts`）
  - 却下理由の入力フォーム
  - submit 2重実行バグ修正済み（`type="submit"`使用）
- ✅ マイページへの申請履歴セクション追加（`my-page.ts`）
  - employeeロールが自分の申請履歴と却下理由を確認できる
  - 「変更申請を行う」ボタンから申請登録ダイアログを開ける
  - `listForUser()`を使用してクエリで絞り込み
- ✅ Firestoreセキュリティルール
  - 従業員本人は自分の申請のみ作成・閲覧可能
  - 管理者・担当者は全申請を閲覧・承認・却下可能
  - 却下理由の空文字禁止（`rejectReason.size() > 0`）
  - 作成時の`decidedAt`、`decidedByUserId`、`rejectReason`未設定チェック

**関連ファイル**:
- `src/app/types.ts`（`ChangeRequest`型、`ChangeRequestStatus`型）
- `src/app/services/change-requests.service.ts`（新規作成）
- `src/app/pages/requests/change-request-form-dialog.component.ts`（新規作成）
- `src/app/pages/requests/reject-reason-dialog.component.ts`（新規作成）
- `src/app/pages/requests/requests.page.ts`（実装完了）
- `src/app/pages/me/my-page.ts`（申請履歴セクション追加）
- `src/app/services/employees.service.ts`（単一取得メソッド`get()`追加）
- `firestore.rules`（`changeRequests`コレクションのルール追加）

---

## ❌ 未実装機能

**実装状況**: Phase2-5完了により、標準報酬決定・改定履歴管理機能が完全実装済み

- ✅ 履歴管理の型定義（`StandardRewardHistory`型、`StandardRewardDecisionKind`型）
- ✅ 履歴登録・編集・削除画面（`standard-reward-history-form-dialog.component.ts`）
- ✅ 履歴一覧表示（従業員詳細ダイアログ内のセクションとして実装、時系列順）
- ✅ 適用開始年月の管理（決定年月と適用開始年月の両方を入力可能）
- ✅ 決定区分の管理（定時決定、随時改定、賞与支払時、資格取得時、資格喪失時、その他）
- ✅ Firestoreセキュリティルールによるアクセス制御（admin/hrのみ追加・編集・削除可能）
- ✅ Phase2-6により、従業員編集フォームでの`monthlyWage`変更時に自動で履歴を追加する機能も実装済み

**関連ファイル**:
- `src/app/types.ts`（`StandardRewardHistory`型、`StandardRewardDecisionKind`型追加）
- `src/app/services/standard-reward-history.service.ts`（新規作成）
- `src/app/pages/employees/standard-reward-history-form-dialog.component.ts`（新規作成）
- `src/app/pages/employees/employee-detail-dialog.component.ts`（標準報酬履歴セクション追加）
- `src/app/pages/employees/employee-form-dialog.component.ts`（自動履歴追加ロジック追加）
- `src/app/utils/label-utils.ts`（`getStandardRewardDecisionKindLabel`関数追加）
- `firestore.rules`（`standardRewardHistories`サブコレクションのルール追加）

### (13) セキュリティ・アクセス制御機能（実装済み）

**実装状況**: Phase2-1完了により、FirestoreセキュリティルールとAngular側のアクセス制御が完全実装済み

- ✅ Firebase Authenticationによる認証
- ✅ Firestoreセキュリティルールの詳細化（事業所IDに基づくデータ分離、ロール別アクセス制御）
- ✅ InsurePath向けのユーティリティ関数（`currentUser`, `getUserRole`, `belongsToOffice`, `isAdminOrHr`, `isInsureAdmin`, `isInsureEmployee`, `isOwnEmployee`）
- ✅ `offices/{officeId}`配下の各コレクションに対するロール別アクセス制御
  - 事業所情報: 所属ユーザー全員閲覧可能、adminのみ更新・削除可能
  - 従業員情報: admin/hrは全件閲覧可能、employeeは自分のレコードのみ閲覧可能
  - 月次保険料・賞与保険料: admin/hrは全件閲覧可能、employeeは自分のデータのみ閲覧可能
  - マスタ情報: 所属ユーザー全員閲覧可能、adminのみ更新・削除可能
- ✅ Angular側の`roleGuard`実装（ロール別ルート保護）
- ✅ ルーティング設定への`roleGuard`適用（各ルートに適切なロール制限を設定）
- ✅ サイドメニューのロール別表示制御（`app.ts`で実装）
- ✅ 権限がない場合の適切なリダイレクト（`/me`へ遷移）
- ⚠️ 識別情報のマスキング表示は未実装（将来の拡張として検討）

**関連ファイル**:
- `firestore.rules`（大幅拡張、InsurePath向けルール追加）
- `src/app/guards/role.guard.ts`（新規作成）
- `src/app/app.routes.ts`（`roleGuard`追加）
- `src/app/app.ts`（サイドメニューのロール別表示制御）

### (14) 従業員情報一括インポート機能（実装済み）

**実装状況**: Phase2-8完了により、従業員情報の一括インポート機能が完全実装済み

- ✅ CSVインポートサービスの実装（`CsvImportService`）
- ✅ CSVパース機能（自前実装の簡易CSVパーサー、コメント行サポート）
- ✅ バリデーション機能（必須項目チェック、データ型チェック、形式チェック）
- ✅ ヘッダマッピング（日本語ヘッダ → Employeeプロパティキー）
- ✅ 雇用形態のマッピング（日本語入力 → 内部コード変換）
- ✅ インポートダイアログ（ファイル選択、プレビュー、エラー行表示、確認ダイアログ、結果表示）
- ✅ エラーハンドリング（部分的な成功も許容、エラー行はスキップ）
- ✅ エラーメッセージの改善（利用可能な値を表示）
- ✅ CSVテンプレートダウンロード機能
- ✅ 簡易ルール説明表示

**関連ファイル**:
- `src/app/utils/csv-import.service.ts`（新規作成）
- `src/app/pages/employees/employee-import-dialog.component.ts`（新規作成）
- `src/app/pages/employees/employees.page.ts`（CSVインポートボタン追加）
- `src/app/utils/csv-export.service.ts`（テンプレート出力機能追加）

### (15) 保険料データのCSVエクスポート機能（実装済み）

**実装状況**: Phase2-7完了により、CSVエクスポート機能が完全実装済み

- ✅ CSVエクスポートサービスの実装（`CsvExportService`）
- ✅ 従業員台帳のエクスポート（全件エクスポート、admin/hrのみ）
- ✅ 月次保険料一覧のエクスポート（対象年月指定、フィルタ後のデータをエクスポート）
- ✅ 賞与一覧のエクスポート（全件エクスポート）
- ✅ CSV形式の定義（UTF-8 + BOMエンコーディング、日本語ヘッダ、CRLF改行）
- ✅ CSVテンプレートダウンロード機能（ヘッダ行のみ、コメント行付き）
- ✅ エクスポートとテンプレートのフォーマット統一（`CsvImportService.getEmployeeHeaderMapping()`を使用）

**関連ファイル**:
- `src/app/utils/csv-export.service.ts`（新規作成）
- `src/app/pages/employees/employees.page.ts`（CSVエクスポートボタン追加）
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts`（CSVエクスポートボタン追加）
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts`（CSVエクスポートボタン追加）

### (35) CSVテンプレートダウンロード機能（実装済み）

**実装状況**: Phase2-7完了により、CSVテンプレートダウンロード機能が完全実装済み

- ✅ CSVテンプレートダウンロード機能
- ✅ ヘッダ行のみのテンプレートCSV出力
- ✅ コメント行付きテンプレート（入力ルール説明）
- ✅ 従業員台帳ページからのダウンロード
- ✅ CSVインポートダイアログからのダウンロード

**関連ファイル**:
- `src/app/utils/csv-export.service.ts`（`exportEmployeesTemplate()`メソッド）
- `src/app/pages/employees/employees.page.ts`（CSVテンプレートボタン追加）
- `src/app/pages/employees/employee-import-dialog.component.ts`（テンプレートダウンロードボタン追加）

### (16) 従業員情報の最終更新者・更新日時表示機能（実装済み）

**実装状況**: Phase3-1完了により、従業員情報の最終更新者・更新日時表示機能が完全実装済み

- ✅ 従業員一覧テーブルに「最終更新者」「最終更新日時」列を追加
- ✅ 最終更新者名の表示（ユーザーIDからユーザー名への変換）
- ✅ 最終更新日時のフォーマット表示（YYYY-MM-DD HH:mm形式）
- ✅ ユーザー名解決サービスの実装（`UsersService`）
- ✅ 従業員フォームでの`updatedByUserId`自動設定
- ✅ 既存機能（CSVエクスポート、インポート、追加・編集・削除）への影響なし

**関連ファイル**:
- `src/app/services/users.service.ts`（新規作成）
- `src/app/pages/employees/employees.page.ts`（最終更新者・更新日時列追加）
- `src/app/pages/employees/employee-form-dialog.component.ts`（`updatedByUserId`設定追加）

### (17) 社会保険用語・ルールヘルプ機能（実装済み）

**実装状況**: Phase3-2完了により、社会保険用語・ルールヘルプ機能が完全実装済み

- ✅ ヘルプコンテンツ定義ファイル（`help-content.ts`）
- ✅ 3つのヘルプトピック（標準報酬月額・等級、賞与範囲、短時間労働者）
- ✅ ヘルプダイアログコンポーネント（`HelpDialogComponent`）
- ✅ 対象画面へのヘルプアイコン追加（従業員一覧、従業員フォーム、月次保険料、賞与保険料）
- ✅ レスポンシブ対応（PC幅・スマホ幅での適切な表示）

**関連ファイル**:
- `src/app/components/help-dialog.component.ts`（新規作成）
- `src/app/utils/help-content.ts`（新規作成）
- `src/app/pages/employees/employees.page.ts`（ヘルプアイコン追加）
- `src/app/pages/employees/employee-form-dialog.component.ts`（ヘルプアイコン追加）
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts`（ヘルプアイコン追加）
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts`（ヘルプアイコン追加）

### (19) 社会保険手続き履歴・期限管理機能 ✅ 実装済み

**実装状況**: Phase3-4完了により、社会保険手続き履歴・期限管理機能が完全実装済み

- ✅ 手続き履歴の型定義（`ProcedureType`型、`ProcedureStatus`型、`SocialInsuranceProcedure`型）
- ✅ 手続き履歴サービス（`ProceduresService`）
  - 手続きの作成（`create()`）
  - 手続きの一覧取得（`list()`）- リアルタイム購読
  - 期限別フィルタ機能（`listByDeadline()`）- 期限が近い（7日以内）、期限切れ
  - 手続きの更新（`update()`）
  - 手続きの削除（`delete()`）
- ✅ 手続き登録・閲覧画面（`procedures.page.ts`）
  - 手続き一覧表示（テーブル形式）
  - 手続き登録フォーム（ダイアログ）
  - 手続き編集フォーム（ダイアログ）
  - ステータス別フィルタ、期限別フィルタ、手続き種別フィルタ
  - ViewModel合成パターンによる従業員名・被扶養者名の表示
- ✅ 提出期限の自動計算（`procedure-deadline-calculator.ts`）
  - 資格取得・喪失・被扶養者異動・賞与支払：事由日＋5日
  - 算定基礎届：対象年の7月10日
  - 月額変更届：事由月の翌月10日
- ✅ 期限管理機能
  - 「提出期限が近い手続き（7日以内）」一覧表示
  - 「提出期限を過ぎて未完了の手続き」一覧表示
  - 未完了ステータス（未着手・準備中・差戻し）のみを期限管理対象に含める
- ✅ Firestoreセキュリティルール
  - admin/hrは全手続きを閲覧・作成・更新・削除可能
  - employeeは自分の手続きのみ閲覧可能（将来`/me`画面で利用する布石として残す）
- ✅ サイドメニューに「手続き履歴」メニュー項目を追加（admin/hr専用）

**関連ファイル**:
- `src/app/types.ts`（`ProcedureType`型、`ProcedureStatus`型、`SocialInsuranceProcedure`型）
- `src/app/services/procedures.service.ts`（新規作成）
- `src/app/pages/procedures/procedures.page.ts`（新規作成）
- `src/app/pages/procedures/procedure-form-dialog.component.ts`（新規作成）
- `src/app/utils/procedure-deadline-calculator.ts`（新規作成）
- `src/app/app.routes.ts`（`/procedures`ルート追加）
- `src/app/app.ts`（サイドメニューに「手続き履歴」追加）
- `src/app/guards/role.guard.ts`（`null`スキップ処理を追加）
- `firestore.rules`（`procedures`コレクションのルール追加）

### (20) 被扶養者状況確認・年次見直し支援機能 ✅ 実装済み

**実装状況**: Phase3-5完了により、被扶養者状況確認・年次見直し支援機能が完全実装済み

- ✅ 扶養状況確認の型定義（`DependentReview`型、`DependentReviewResult`型）
- ✅ 確認結果の記録機能（CRUD操作、リアルタイム購読）
- ✅ 基準年月日時点での抽出機能（特定の基準年月日時点で扶養に入っている被扶養者の一覧を抽出・表示）
- ✅ 確認結果の登録・編集・削除機能
- ✅ 確認結果一覧表示（フィルタ機能付き）
- ✅ インライン操作（確認区分のトグル操作：継続／削除予定／要確認）
- ✅ 被扶養者状況リスト風レイアウト（テーブル形式、行番号、確認区分のインライン操作、備考表示）
- ✅ Firestoreセキュリティルール（admin/hrは全件閲覧・作成・更新・削除可能、employeeは現時点では閲覧不可）

**関連ファイル**:
- `src/app/types.ts`（`DependentReview`型、`DependentReviewResult`型）
- `src/app/services/dependent-reviews.service.ts`（新規作成）
- `src/app/pages/dependent-reviews/dependent-reviews.page.ts`（新規作成）
- `src/app/pages/dependent-reviews/review-form-dialog.component.ts`（新規作成）
- `src/app/app.routes.ts`（`/dependent-reviews`ルート追加）
- `firestore.rules`（`dependentReviews`コレクションのルール追加）

### (21) 社会保険料納付状況管理機能 ✅ 実装済み

**実装状況**: Phase3-6完了により、社会保険料納付状況管理機能が完全実装済み

- ✅ 納付状況の型定義（`PaymentStatus`型、`PaymentMethod`型、`SocialInsurancePayment`型）
- ✅ 納付状況サービス（`PaymentsService`）
  - 納付状況の作成（`create()`）- 新規作成時に予定額を自動計算（4つすべて未指定の場合のみ）
  - 納付状況の一覧取得（`listByOffice()`）- リアルタイム購読、`limit`パラメータ対応
  - 納付状況の単一取得（`get()`）- 対象年月を指定して取得、リアルタイム購読対応
  - 納付状況の更新（`update()`）
  - 予定額の自動計算ロジック（`calculatePlannedAmounts()`）- 月次・賞与の会社負担額合計を計算
- ✅ BonusPremiumsServiceの拡張（`listByOfficeAndYearMonth`メソッド追加）
- ✅ 納付状況一覧画面（`payments.page.ts`）
  - 納付状況一覧表示（テーブル形式、対象年月ごと）
  - 納付状況登録フォーム（ダイアログ）
  - 納付状況編集フォーム（ダイアログ）
  - ステータス別フィルタ、納付方法表示
- ✅ 納付状況フォームダイアログ（`payment-form-dialog.component.ts`）
  - 予定額・納付額（実績額）の入力フォーム
  - 納付ステータス・納付方法・納付日の入力
  - 「納付済」選択時のバリデーション（納付日と納付額が必須）
  - 予定額の自動計算ボタン（新規作成時のみ）
  - セクション単位のヘルプテキスト追加
  - 各入力項目の`mat-hint`追加
  - エラーメッセージとSnackBar通知
- ✅ ダッシュボード連携
  - 「今月納付予定の社会保険料」カードの追加（リアルタイム更新対応）
  - 「最近の納付状況（最大12件）」セクションの追加
  - ステータスバッジ表示、納付状況へのリンク
- ✅ Firestoreセキュリティルール
  - admin/hrは全納付状況を閲覧・作成・更新可能
  - employeeはアクセス不可
  - 金額フィールドは0以上（負の値は不可）
  - `paymentStatus === 'paid'`の場合は`paymentDate`と`actualTotalCompany`が必須
  - フィールド型チェック（`paymentMethod`、`paymentDate`、`memo`など）
- ✅ ルーティングとサイドメニュー
  - `/payments`ルートの追加（admin/hr専用）
  - サイドメニューに「社会保険料納付状況」メニュー項目を追加

**関連ファイル**:
- `src/app/types.ts`（`PaymentStatus`型、`PaymentMethod`型、`SocialInsurancePayment`型追加）
- `src/app/services/payments.service.ts`（新規作成）
- `src/app/services/bonus-premiums.service.ts`（`listByOfficeAndYearMonth`メソッド追加）
- `src/app/pages/payments/payments.page.ts`（新規作成）
- `src/app/pages/payments/payment-form-dialog.component.ts`（新規作成）
- `src/app/pages/dashboard/dashboard.page.ts`（納付状況表示追加）
- `src/app/app.routes.ts`（`/payments`ルート追加）
- `src/app/app.ts`（サイドメニューに「社会保険料納付状況」追加）
- `firestore.rules`（`payments`コレクションのルール追加）

### (22) e-Gov 電子申請連携機能

**実装状況**: 完全に未実装

- ❌ 電子申請用データの自動生成
- ❌ 電子申請用ファイル（CSV／固定長テキスト）の出力
- ❌ 申請ステータス管理

### (23) 公的帳票（届出書）自動作成・PDF 出力機能

**実装状況**: 完全に未実装

- ❌ 帳票テンプレートの定義
- ❌ 帳票の自動生成機能
- ❌ PDF出力機能
- ❌ 帳票履歴管理

### (24) 従業員セルフ入力・手続き申請フロー機能

**実装状況**: 完全に未実装

- ❌ セルフ入力フォーム
- ❌ 手続き申請の一時保存機能
- ❌ 申請内容の承認・却下機能
- ❌ 申請履歴の管理

### (25) 社会保険手続き用添付書類管理機能（ファイル添付機能）

**実装状況**: 完全に未実装

- ❌ ファイルアップロード機能
- ❌ 添付書類のメタ情報管理
- ❌ 閲覧権限制御
- ❌ 有効期限管理

### (26) 保険料率・等級表クラウドマスタ・自動更新機能

**実装状況**: 完全に未実装

- ❌ クラウドマスタの実装
- ❌ 事業所への自動適用機能
- ❌ マスタ改定履歴管理

### (27) マイナンバー管理機能

**実装状況**: 完全に未実装

- ❌ マイナンバーの暗号化保存
- ❌ アクセス制御
- ❌ マスキング表示
- ❌ アクセスログ記録

### (28) 多言語対応機能

**実装状況**: 完全に未実装

- ❌ 英語UIの実装
- ❌ 表示言語の設定機能
- ❌ 多言語リソース管理

### (29) 社会保険情報の異常値チェック・ギャップ検知機能

**実装状況**: 完全に未実装

- ❌ 異常値チェックルールの定義
- ❌ 自動チェック機能
- ❌ 異常値一覧表示
- ❌ ダッシュボードへの集計表示

### (30) 手続きタスクの期限別ビュー・簡易アラート機能

**実装状況**: 完全に未実装

- ❌ 期限別ビューの実装
- ❌ ダッシュボードへの集計表示
- ❌ 簡易アラート機能


### (32) 口座情報・給与情報管理機能

**実装状況**: 完全に未実装

- ❌ 口座情報の型定義
- ❌ 口座情報の登録・編集機能
- ❌ 給与基本情報の管理機能

### (33) 入社手続きフロー・入社チェックリスト機能

**実装状況**: 完全に未実装

- ❌ 入社チェックリストの型定義
- ❌ チェックリストの作成・管理機能
- ❌ 進捗管理機能

### (34) 年末調整・確定申告用 社会保険料集計・エクスポート機能

**実装状況**: 完全に未実装

- ❌ 年間集計機能
- ❌ 年末調整用CSVエクスポート機能

---

## 📊 実装進捗サマリー

| カテゴリ | 実装済み | 部分実装 | 未実装 | 合計 |
|---------|---------|---------|--------|------|
| 基本機能 | 3 | 0 | 0 | 3 |
| 管理機能 | 6 | 0 | 0 | 6 |
| 計算・表示機能 | 7 | 0 | 0 | 7 |
| その他機能 | 5 | 0 | 12 | 17 |
| **合計** | **22** | **0** | **13** | **35** |

**実装率**: 約63%（完全実装のみ）

**注**: Phase3で残り17機能の実装を予定しています。

**注**: 完成版カタログでは機能要件が35件に拡張されました。新規追加された機能（(22)～(34)）の多くは将来拡張として位置づけられており、現時点では未実装です。(35) CSVテンプレートダウンロード機能は実装済みです。

**最新更新**: 
- Phase1-2完了により、従業員台帳機能の資格情報・就業状態管理が追加実装されました。
- Phase1-3完了により、社会保険料自動計算機能（premium-calculator.ts）が実装されました。
- Phase1-4完了により、月次保険料一覧・会社負担集計機能が基本実装されました。
- Phase1-5完了により、標準報酬月額・等級・保険プランマスタ管理機能が実装され、月次保険料計算画面がマスタ連携に切り替わりました。
- Phase1-6完了により、賞与管理・賞与保険料計算機能が完全実装されました。標準賞与額の計算、上限チェック、年度内累計管理、マスタ連携による保険料計算が実装されています。
- Phase1-7完了により、マイページ機能が完全実装されました。ログインユーザーが自分の社員情報・月次/賞与保険料を1画面で確認できるようになりました。
- Phase1-8完了により、従業員とユーザーアカウントの自動紐づけ機能が実装されました。事業所設定時に、メールアドレス（contactEmail）が一致する従業員レコードを自動的に検索して紐づけます。
- Phase1-9完了により、月次保険料一覧機能が拡張されました。過去月分の閲覧（年月選択UI、直近12ヶ月対応）、従業員名での絞り込み、月単位の合計行表示が実装されています。
- Phase1-10完了により、負担構成ダッシュボード機能の基本実装が完了しました。従業員数、月次保険料（今月の会社負担額）、トレンド（前月比の変化）の3つのKPIカードが実装されています。
- Phase1-11完了により、保険料シミュレーション機能が完全実装されました。報酬月額や等級を入力して社会保険料を試算できる機能が実装され、既存の月次保険料計算ロジック（`premium-calculator.ts`）を再利用することで、計算結果の整合性が保たれています。
- Phase1-12完了により、負担構成ダッシュボード機能が拡張されました。過去12ヶ月の推移グラフ、当月の月次・賞与比較グラフ、年度別集計グラフ、従業員別ランキング表示が実装され、ng2-charts（Chart.js）を使用した視覚的な分析機能が追加されました。
- Phase2-1完了により、セキュリティ・アクセス制御機能が完全実装されました。Firestoreセキュリティルールの詳細化（事業所IDに基づくデータ分離、ロール別アクセス制御）、Angular側の`roleGuard`実装、ルーティング設定への`roleGuard`適用、サイドメニューのロール別表示制御が実装され、本番環境で安全に運用できる状態になりました。
- Phase2-2完了により、ロール割り当てとユーザー管理が改善されました。初回ログイン時のロール初期化（`role: 'employee'`, `officeId: null`）、新規オフィス作成時の初代admin設定処理が実装され、セキュリティルールと整合性が保たれています。
- Phase2-3完了により、被扶養者（家族）管理機能が完全実装されました。被扶養者情報の型定義、CRUD機能、従業員詳細ダイアログ内での表示、マイページでの閲覧機能が実装され、admin/hrは追加・編集・削除、employeeは閲覧のみという適切なアクセス制御が実現されています。
- Phase2-4完了により、扶養家族管理の導線が改善されました。従業員一覧からの「扶養家族を管理」ボタン追加、従業員詳細ダイアログ内のセクションナビ追加、特定セクションへの自動スクロール機能が実装され、ユーザビリティが大幅に向上しました。
- Phase2-5完了により、標準報酬決定・改定履歴管理機能が完全実装されました。標準報酬履歴の型定義、CRUD機能、従業員詳細ダイアログ内での表示が実装され、admin/hrは追加・編集・削除可能、employeeは閲覧不可（Phase2-5ではUI側でも実装しない）という適切なアクセス制御が実現されています。
- Phase2-6完了により、標準報酬履歴の自動追加機能が実装されました。従業員編集フォームで`monthlyWage`を変更した際に、自動で`StandardRewardHistory`を1行追加する機能が実装され、人事担当者の入力忘れ・付け忘れによる「履歴抜け」リスクが軽減されました。自動追加された履歴もPhase2-5のUIから編集・削除可能なハイブリッド運用が実現されています。
- Phase2-7完了により、CSVエクスポート機能が完全実装されました。従業員台帳、月次保険料、賞与保険料のCSVエクスポート機能が実装され、UTF-8 + BOMエンコーディングによるExcelでの文字化け防止、CSVテンプレートダウンロード機能が追加されました。admin/hrのみがエクスポート可能という適切な権限制御が実現されています。
- Phase2-8完了により、CSVインポート機能が完全実装されました。従業員情報の一括インポート機能、CSVパース・バリデーション機能、インポートダイアログ（プレビュー、エラー行表示、結果表示）、コメント行サポート、雇用形態のマッピング（日本語入力 → 内部コード変換）、エラーメッセージの改善（利用可能な値を表示）が実装されました。エクスポートとテンプレートのフォーマット統一により、「エクスポート → 編集 → インポート」のラウンドトリップが可能になりました。
- Phase3-1完了により、従業員情報の最終更新者・更新日時表示機能が完全実装されました。従業員一覧テーブルに「最終更新者」「最終更新日時」列を追加し、ユーザーIDからユーザー名への変換機能、従業員フォームでの`updatedByUserId`自動設定が実装されました。一覧画面からも最終更新情報を確認できるようになり、機能として完成しました。
- Phase3-2完了により、社会保険用語・ルールヘルプ機能が完全実装されました。ヘルプコンテンツ定義ファイル（3つのトピック：標準報酬月額・等級、賞与範囲、短時間労働者）、ヘルプダイアログコンポーネント、対象画面へのヘルプアイコン追加が実装されました。人事担当者や新任担当者が制度を確認しながら操作できるようになり、誤操作や制度理解のミスを防ぐことができます。
- Phase3-3完了により、従業員情報の変更申請・承認（簡易ワークフロー）機能が完全実装されました。変更申請サービス（CRUD操作）、申請登録ダイアログ、申請一覧画面（admin/hr専用）、却下理由入力ダイアログ、マイページへの申請履歴セクション追加、Firestoreセキュリティルールが実装されました。従業員本人がマイページからプロフィール変更を申請し、管理者・担当者が承認・却下できるワークフローが完成しました。submit 2重実行バグの修正と、Firestoreルールでの却下理由空文字禁止も実装済みです。
- Phase3-4完了により、社会保険手続き履歴・期限管理機能が完全実装されました。手続き履歴サービス（CRUD操作、リアルタイム購読、期限別フィルタ）、手続き登録・閲覧画面（admin/hr専用）、提出期限の自動計算ロジック（資格取得・喪失・被扶養者異動・賞与支払は事由日＋5日、算定基礎届は対象年の7月10日、月額変更届は事由月の翌月10日）、期限管理機能（期限が近い・期限切れの一覧表示）、Firestoreセキュリティルール、サイドメニューへの追加が実装されました。人事担当者が手続きの進捗を把握し、届出漏れ・提出遅れを防止できる機能が完成しました。
- Phase3-5完了により、被扶養者状況確認・年次見直し支援機能が完全実装されました。扶養状況確認の型定義（`DependentReview`型、`DependentReviewResult`型）、確認結果の記録機能（CRUD操作、リアルタイム購読）、基準年月日時点での抽出機能、確認結果の登録・編集・削除機能、確認結果一覧表示（フィルタ機能付き）、インライン操作（確認区分のトグル操作：継続／削除予定／要確認）、被扶養者状況リスト風レイアウト、Firestoreセキュリティルールが実装されました。健康保険組合等から送付される「被扶養者状況リスト」への回答作業を効率化できる機能が完成しました。
- Phase3-6完了により、社会保険料納付状況管理機能が完全実装されました。納付状況の型定義（`PaymentStatus`型、`PaymentMethod`型、`SocialInsurancePayment`型）、納付状況サービス（CRUD操作、予定額自動計算、リアルタイム購読）、BonusPremiumsServiceの拡張（`listByOfficeAndYearMonth`メソッド追加）、納付状況一覧画面、納付状況フォームダイアログ（バリデーション強化、ヘルプテキスト追加）、ダッシュボード連携（「今月納付予定の社会保険料」カード、「最近の納付状況（最大12件）」セクション）、Firestoreセキュリティルール、ルーティングとサイドメニュー追加が実装されました。事業所ごと・対象年月ごとの社会保険料の納付状況を記録・管理し、納付漏れや金額確認漏れを防止できる機能が完成しました。

---

## 🔧 技術スタック

- **フレームワーク**: Angular 20.3.0
- **UIライブラリ**: Angular Material 20.2.13
- **バックエンド**: Firebase (Firestore, Authentication)
- **言語**: TypeScript 5.9.2

---

## 📝 次のステップ推奨事項

### 優先度: 中

1. **CSVインポート・エクスポート機能（(14), (15)）の実装** ✅ 完了
   - ✅ 従業員情報の一括インポート（CSV）
   - ✅ 月次保険料・賞与保険料のエクスポート（CSV）
   - ✅ 従業員台帳のエクスポート（CSV）
   - ✅ エラー行の確認・修正画面
   - ✅ CSVテンプレートダウンロード機能

### 優先度: 低

3. **社会保険手続き履歴管理（(19)）**
   - 手続き履歴の型定義とCRUD機能
   - 提出期限の自動計算
   - 期限切れアラート

4. **納付状況管理（(21)）**
   - 納付状況の型定義とCRUD機能
   - 納付予定額・実納付額の記録
   - 納付ステータス管理

5. **社会保険用語・ルールヘルプ機能（(17)）**
   - ヘルプコンテンツの作成
   - ヘルプアイコン・モーダルの実装

6. **将来拡張機能（(22)～(34)）**
   - e-Gov電子申請連携機能（(22)）
   - 公的帳票自動作成・PDF出力機能（(23)）
   - 従業員セルフ入力・手続き申請フロー機能（(24)）
   - 添付書類管理機能（(25)）
   - クラウドマスタ機能（(26)）
   - マイナンバー管理機能（(27)）
   - 多言語対応機能（(28)）
   - 異常値チェック機能（(29)）
   - 手続きタスク期限別ビュー機能（(30)）
   - 外部給与システム連携機能（(31)）
   - 口座情報・給与情報管理機能（(32)）
   - 入社手続きフロー機能（(33)）
   - 年末調整用集計機能（(34)）

---

## 📌 注意事項

- FirestoreセキュリティルールはPhase2-1完了により、事業所IDとロールに基づいた詳細なアクセス制御が実装されました。本番環境での運用に向けて、Firestore Emulator Suiteでのルールテストを十分に行うことを推奨します。

- 保険料計算ロジックは、実務上の細かなルール（入社月・退職月の扱い、端数処理など）を簡略化した形で実装する必要があります。カタログの制約条件を参照してください。

- マスタデータ（保険料率・等級表）は、外部サイトからの自動取得ではなく、管理者が手動で更新する運用を前提としています。

