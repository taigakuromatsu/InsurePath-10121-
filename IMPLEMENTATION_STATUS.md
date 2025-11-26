# InsurePath 実装状況レポート

**作成日**: 2025年1月  
**最終更新**: 2025年11月（Phase2-6完了後）

## 概要

本ドキュメントは、CATALOG.mdに記載された21の機能要件に対する現時点での実装状況をまとめたものです。

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

### (18) 従業員情報の変更申請・承認（簡易ワークフロー）機能

**実装状況**: ページは存在するが、実装は未完了

- ✅ ページコンポーネントとルーティング
- ✅ 型定義（ChangeRequest）
- ❌ 申請登録画面
- ❌ 承認・却下機能
- ❌ 申請一覧表示

**関連ファイル**:
- `src/app/pages/requests/requests.page.ts`（プレースホルダーのみ）

---

## ❌ 未実装機能

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

### (14) 従業員情報一括インポート機能

**実装状況**: 完全に未実装

- ✅ 型定義（ImportJob）
- ❌ CSVアップロード機能
- ❌ 形式チェック
- ❌ エラー行の確認・修正画面

### (15) 保険料データのCSVエクスポート機能

**実装状況**: 完全に未実装

- ❌ CSV出力機能
- ❌ 月次保険料一覧のエクスポート
- ❌ 従業員台帳のエクスポート
- ❌ 賞与一覧のエクスポート

### (16) 従業員情報の最終更新者・更新日時表示機能

**実装状況**: データ保存と詳細表示は実装済み

- ✅ 更新日時・更新ユーザーIDの保存（employees.service.ts）
- ✅ 詳細ダイアログでの表示（employee-detail-dialog.component.ts）
- ⚠️ 一覧画面での表示は未実装（任意実装）

### (17) 社会保険用語・ルールヘルプ機能

**実装状況**: 完全に未実装

- ❌ ヘルプコンテンツ
- ❌ ヘルプアイコン・モーダル

### (19) 社会保険手続き履歴・期限管理機能

**実装状況**: 完全に未実装

- ❌ 手続き履歴の型定義
- ❌ 手続き登録・閲覧画面
- ❌ 提出期限の自動計算
- ❌ 期限切れアラート

### (20) 被扶養者状況確認・年次見直し支援機能

**実装状況**: 完全に未実装

- ❌ 扶養状況確認の型定義
- ❌ 確認結果の記録機能
- ❌ 基準年月日時点での抽出機能

### (21) 社会保険料納付状況管理機能

**実装状況**: 完全に未実装

- ❌ 納付状況の型定義
- ❌ 納付予定額・実納付額の記録
- ❌ 納付ステータス管理
- ❌ ダッシュボードでの表示

---

## 📊 実装進捗サマリー

| カテゴリ | 実装済み | 部分実装 | 未実装 | 合計 |
|---------|---------|---------|--------|------|
| 基本機能 | 3 | 0 | 0 | 3 |
| 管理機能 | 4 | 1 | 0 | 5 |
| 計算・表示機能 | 7 | 0 | 0 | 7 |
| その他機能 | 1 | 1 | 4 | 6 |
| **合計** | **15** | **2** | **4** | **21** |

**実装率**: 約71%（完全実装のみ） / 約81%（部分実装含む）

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

---

## 🔧 技術スタック

- **フレームワーク**: Angular 20.3.0
- **UIライブラリ**: Angular Material 20.2.13
- **バックエンド**: Firebase (Firestore, Authentication)
- **言語**: TypeScript 5.9.2

---

## 📝 次のステップ推奨事項

### 優先度: 中

1. **CSVインポート・エクスポート機能（(14), (15)）の実装（Phase2-7）**
   - 従業員情報の一括インポート（CSV）
   - 月次保険料・賞与保険料のエクスポート（CSV）
   - 標準報酬履歴のエクスポート（CSV）
   - エラー行の確認・修正画面

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

---

## 📌 注意事項

- FirestoreセキュリティルールはPhase2-1完了により、事業所IDとロールに基づいた詳細なアクセス制御が実装されました。本番環境での運用に向けて、Firestore Emulator Suiteでのルールテストを十分に行うことを推奨します。

- 保険料計算ロジックは、実務上の細かなルール（入社月・退職月の扱い、端数処理など）を簡略化した形で実装する必要があります。カタログの制約条件を参照してください。

- マスタデータ（保険料率・等級表）は、外部サイトからの自動取得ではなく、管理者が手動で更新する運用を前提としています。

