# Phase3 実装計画

**作成日**: 2025年11月28日  
**最終更新**: 2025年12月（Phase3-10完了後）  
**目標完了日**: 2025年12月10日  
**残り日数**: 約7日間（Phase3-1からPhase3-9（追加）まで完了済み、残り9機能）

---

## 📊 Phase2までの実装完了状況

### 完了したフェーズ
- ✅ **Phase1-2**: 従業員台帳機能の資格情報・就業状態管理
- ✅ **Phase1-3**: 社会保険料自動計算機能
- ✅ **Phase1-4**: 月次保険料一覧・会社負担集計機能（基本実装）
- ✅ **Phase1-5**: 標準報酬月額・等級・保険プランマスタ管理機能
- ✅ **Phase1-6**: 賞与管理・賞与保険料計算機能
- ✅ **Phase1-7**: マイページ機能
- ✅ **Phase1-8**: 従業員とユーザーアカウントの自動紐づけ機能
- ✅ **Phase1-9**: 月次保険料一覧機能の拡張（過去月分閲覧、絞り込み、合計行）
- ✅ **Phase1-10**: 負担構成ダッシュボード機能（基本実装）
- ✅ **Phase1-11**: 保険料シミュレーション機能
- ✅ **Phase1-12**: 負担構成ダッシュボード機能の拡張（グラフ表示）
- ✅ **Phase2-1**: セキュリティ・アクセス制御の強化
- ✅ **Phase2-2**: ロール割り当てとユーザー管理の改善
- ✅ **Phase2-3**: 被扶養者管理機能の実装
- ✅ **Phase2-4**: 扶養家族管理の導線改善
- ✅ **Phase2-5**: 標準報酬決定・改定履歴管理機能の実装
- ✅ **Phase2-6**: 標準報酬履歴の自動追加（従業員フォーム連動）
- ✅ **Phase2-7**: CSVエクスポート機能の実装
- ✅ **Phase2-8**: CSVインポート機能の実装

---

## 🎯 Phase3の実装方針

Phase3では、**12月10日までの完成を目指し、残り10機能すべてを実装**します（Phase3-1からPhase3-8 MVPまで完了済み）。

### Phase3の目標
1. **基本機能の完成**: 部分実装されている機能を完成させる
2. **実務機能の実装**: 手続き管理、納付管理、扶養管理の強化
3. **拡張機能の実装**: PDF出力、セルフ入力、多言語対応など
4. **e-Gov対応**: e-Gov届出に必要なマスタ情報の管理機能（CSV生成機能は実装しない）

---

## 📋 Phase3の実装フェーズ（残り9機能）

### Phase3-1: 従業員情報の最終更新者・更新日時表示機能の完成 ✅ 実装完了

**優先度**: 🔴 最高（部分実装の完成）  
**依存関係**: なし  
**目標完了日**: 2025年11月28日（当日）  
**完了日**: 2025年11月28日

**目的**: 既にデータ保存と詳細表示は実装済みだが、一覧画面での表示を追加して機能を完成させる

**実装内容**:
1. **従業員一覧画面への表示追加**
   - 従業員一覧テーブルに「最終更新者」「最終更新日時」列を追加
   - 更新者名の表示（ユーザーIDからユーザー名への変換）
   - 日時のフォーマット表示（YYYY-MM-DD HH:mm形式）

**実装ファイル**:
- `src/app/services/users.service.ts`（新規作成）
- `src/app/pages/employees/employees.page.ts`（一覧テーブルに列追加）
- `src/app/pages/employees/employee-form-dialog.component.ts`（`updatedByUserId`設定追加）

---

### Phase3-2: 社会保険用語・ルールヘルプ機能 ✅ 実装完了

**優先度**: 🟡 高（ユーザビリティ向上）  
**依存関係**: なし  
**目標完了日**: 2025年11月28日（当日）  
**完了日**: 2025年11月28日

**目的**: 人事担当者や新任担当者が制度を確認しながら操作できるようにし、誤操作や制度理解のミスを防ぐ

**実装内容**:
1. **ヘルプコンテンツの定義**
   - 標準報酬月額・等級の説明
   - 賞与の範囲の説明
   - 短時間労働者の適用条件の説明

2. **ヘルプアイコン・モーダルの実装**
   - 各画面にヘルプアイコン（`help_outline`）を配置
   - クリックでヘルプモーダルを表示

**実装ファイル**:
- `src/app/components/help-dialog.component.ts`（新規作成）
- `src/app/utils/help-content.ts`（ヘルプコンテンツ定義、新規作成）
- `src/app/pages/employees/employees.page.ts`（ヘルプアイコン追加）
- `src/app/pages/employees/employee-form-dialog.component.ts`（ヘルプアイコン追加）
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts`（ヘルプアイコン追加）
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts`（ヘルプアイコン追加）

---

### Phase3-3: 従業員情報の変更申請・承認（簡易ワークフロー）機能 ✅ 実装完了

**優先度**: 🔴 最高（実務上重要な機能）  
**依存関係**: Phase2-1（セキュリティ強化後が望ましい）  
**目標完了日**: 2025年11月30日
**完了日**: 2025年11月30日

**目的**: 一般従業員が自分のプロフィール情報を申請し、管理者・担当者が承認する簡易ワークフロー機能を実装する

**実装完了内容**:
1. ✅ **変更申請の型定義**
   - `ChangeRequest`型の定義
   - `ChangeRequestStatus`型の定義
   - Firestoreコレクション構造の設計

2. ✅ **変更申請サービス**
   - `ChangeRequestsService`の実装
   - 申請の作成（`create()`）
   - 申請の一覧取得（`list()`）- admin/hr用、リアルタイム購読
   - ユーザー単位の申請一覧取得（`listForUser()`）- employee用、リアルタイム購読
   - 申請の承認（`approve()`）
   - 申請の却下（`reject()`）

3. ✅ **申請登録画面**
   - 従業員本人がアクセスできる申請フォーム（`change-request-form-dialog.component.ts`）
   - 申請可能な項目：住所、電話番号、メールアドレス
   - 現在値と申請値の入力フォーム
   - submit 2重実行バグ修正済み

4. ✅ **申請一覧画面（管理者・担当者向け）**
   - 事業所ごとの申請一覧表示（`requests.page.ts`）
   - ステータス別フィルタ
   - 承認・却下ボタン
   - admin/hr専用（employeeロールはアクセス不可）

5. ✅ **承認・却下処理**
   - 承認時：従業員台帳への自動反映
   - 却下時：却下理由の入力と保存（`reject-reason-dialog.component.ts`）
   - submit 2重実行バグ修正済み

6. ✅ **マイページへの申請履歴セクション追加**
   - employeeロールが自分の申請履歴と却下理由を確認できる
   - 「変更申請を行う」ボタンから申請登録ダイアログを開ける

7. ✅ **Firestoreセキュリティルール**
   - 従業員本人は自分の申請のみ作成・閲覧可能
   - 管理者・担当者は全申請を閲覧・承認・却下可能
   - 却下理由の空文字禁止
   - 作成時の`decidedAt`、`decidedByUserId`、`rejectReason`未設定チェック

**実装ファイル**:
- `src/app/types.ts`（`ChangeRequest`型、`ChangeRequestStatus`型）
- `src/app/services/change-requests.service.ts`（新規作成）
- `src/app/pages/requests/change-request-form-dialog.component.ts`（新規作成）
- `src/app/pages/requests/reject-reason-dialog.component.ts`（新規作成）
- `src/app/pages/requests/requests.page.ts`（実装完了）
- `src/app/pages/me/my-page.ts`（申請履歴セクション追加）
- `src/app/services/employees.service.ts`（単一取得メソッド`get()`追加）
- `firestore.rules`（`changeRequests`コレクションのルール追加）

---

### Phase3-4: 社会保険手続き履歴・期限管理機能 ✅ 実装完了

**優先度**: 🟡 高（実務上重要な機能）  
**依存関係**: Phase2-3、Phase2-5、Phase1-6  
**目標完了日**: 2025年12月1日  
**完了日**: 2025年12月1日

**目的**: 従業員および被扶養者ごとに、健康保険・厚生年金に関する主な社会保険手続きの履歴を登録・閲覧し、提出期限を管理することで、届出漏れ・提出遅れを防止する

**実装完了内容**:
1. ✅ **手続き履歴の型定義**
   - `ProcedureType`型の定義（6種類：資格取得届、資格喪失届、算定基礎届、月額変更届、被扶養者異動届、賞与支払届）
   - `ProcedureStatus`型の定義（未着手、準備中、提出済、差戻し）
   - `SocialInsuranceProcedure`型の定義
   - Firestoreコレクション構造の設計

2. ✅ **手続き履歴サービス**
   - `ProceduresService`の実装
   - 手続きの作成（`create()`）
   - 手続きの一覧取得（`list()`）- リアルタイム購読
   - 期限別フィルタ機能（`listByDeadline()`）- 期限が近い（7日以内）、期限切れ
   - 手続きの更新（`update()`）
   - 手続きの削除（`delete()`）

3. ✅ **手続き登録・閲覧画面**
   - 手続き一覧表示（テーブル形式）
   - 手続き登録フォーム（ダイアログ）
   - 手続き編集フォーム（ダイアログ）
   - ステータス別フィルタ、期限別フィルタ、手続き種別フィルタ
   - ViewModel合成パターンによる従業員名・被扶養者名の表示

4. ✅ **提出期限の自動計算ロジック**
   - `procedure-deadline-calculator.ts`の実装
   - 資格取得・喪失・被扶養者異動・賞与支払：事由日＋5日
   - 算定基礎届：対象年の7月10日
   - 月額変更届：事由月の翌月10日

5. ✅ **期限管理機能**
   - 「提出期限が近い手続き（7日以内）」一覧表示
   - 「提出期限を過ぎて未完了の手続き」一覧表示
   - 未完了ステータス（未着手・準備中・差戻し）のみを期限管理対象に含める

6. ✅ **Firestoreセキュリティルール**
   - admin/hrは全手続きを閲覧・作成・更新・削除可能
   - employeeは自分の手続きのみ閲覧可能（将来`/me`画面で利用する布石として残す）

7. ✅ **サイドメニューとルーティング**
   - サイドメニューに「手続き履歴」メニュー項目を追加（admin/hr専用）
   - `/procedures`ルートの追加
   - `roleGuard`の修正（`null`スキップ処理を追加）

**実装ファイル**:
- `src/app/types.ts`（`ProcedureType`型、`ProcedureStatus`型、`SocialInsuranceProcedure`型）
- `src/app/services/procedures.service.ts`（新規作成）
- `src/app/pages/procedures/procedures.page.ts`（新規作成）
- `src/app/pages/procedures/procedure-form-dialog.component.ts`（新規作成）
- `src/app/utils/procedure-deadline-calculator.ts`（新規作成）
- `src/app/app.routes.ts`（`/procedures`ルート追加）
- `src/app/app.ts`（サイドメニューに「手続き履歴」追加）
- `src/app/guards/role.guard.ts`（`null`スキップ処理を追加）
- `firestore.rules`（`procedures`コレクションのルール追加）

**注意**: イベントからの自動候補生成機能はPhase3-13「手続きタスク期限ビュー＆簡易アラート」または将来のFunctions連携フェーズに後送りされています。現状は人事担当者が必要に応じて手動登録する運用です。

---

### Phase3-5: 被扶養者状況確認・年次見直し支援機能 ✅ 実装完了

**優先度**: 🟡 中（実務上必要な機能）  
**依存関係**: Phase2-3  
**目標完了日**: 2025年12月1日  
**完了日**: 2025年12月1日

**目的**: 被扶養者の年次見直しや「被扶養者状況リスト」への回答作業を支援する

**実装完了内容**:
1. ✅ **扶養状況確認の型定義**
   - `DependentReview`型の定義（`createdByUserId`、`updatedByUserId`は必須フィールド）
   - `DependentReviewResult`型の定義（continued / to_be_removed / needs_review）
   - Firestoreコレクション構造の設計

2. ✅ **扶養状況確認サービス**
   - `DependentReviewsService`の実装
   - 確認結果の作成（`create()`）
   - 確認結果の一覧取得（`list()`）- リアルタイム購読、`sessionId`フィルタ対応
   - 確認結果の更新（`update()`）
   - 確認結果の削除（`delete()`）

3. ✅ **基準年月日時点での抽出機能**
   - 特定の基準年月日時点で扶養に入っている被扶養者の一覧を抽出・表示
   - 基準年月日の初期値を「今日」に設定
   - 基準年月日以前の最新の確認結果を表示

4. ✅ **確認結果の登録・編集・削除機能**
   - 確認結果登録・編集ダイアログ（`review-form-dialog.component.ts`）
   - 対象従業員・対象被扶養者の選択（編集時も変更可能）
   - 確認日・確認結果・確認担当者・備考の入力
   - 確認日の初期値を「今日」に設定
   - 確認担当者の自動補完（ログインユーザーの`displayName`）

5. ✅ **被扶養者状況リスト風レイアウト**
   - テーブル形式での一覧表示（行番号、被保険者名、被扶養者名、続柄、生年月日、資格取得日、資格喪失日、確認区分、備考、操作）
   - インライン操作（確認区分のトグル操作：継続／削除予定／要確認）
   - 備考列の表示（メモありの場合はアイコン＋「メモあり」、クリックでダイアログを開く）
   - 確認結果一覧テーブル（ViewModel合成パターンによる従業員名・被扶養者名の表示）

6. ✅ **Firestoreセキュリティルール**
   - admin/hrは全確認結果を閲覧・作成・更新・削除可能
   - employeeは現時点では閲覧不可（将来拡張用プレースホルダー）
   - `createdByUserId`と`updatedByUserId`の必須チェック

7. ✅ **ルーティングとサイドメニュー**
   - `/dependent-reviews`ルートの追加（admin/hr専用）
   - サイドメニューへの追加（将来拡張）

**実装ファイル**:
- `src/app/types.ts`（`DependentReview`型、`DependentReviewResult`型追加）
- `src/app/services/dependent-reviews.service.ts`（新規作成）
- `src/app/pages/dependent-reviews/dependent-reviews.page.ts`（新規作成）
- `src/app/pages/dependent-reviews/review-form-dialog.component.ts`（新規作成）
- `src/app/app.routes.ts`（`/dependent-reviews`ルート追加）
- `firestore.rules`（`dependentReviews`コレクションのルール追加）

---

### Phase3-6: 社会保険料納付状況管理機能 ✅ 実装完了

**優先度**: 🟡 高（実務上重要な機能）  
**依存関係**: Phase1-4、Phase1-6  
**目標完了日**: 2025年12月2日  
**完了日**: 2025年12月2日

**目的**: 事業所ごと・対象年月ごとに、健康保険・介護保険・厚生年金それぞれの社会保険料について、納付予定額・実際の納付額・納付日・納付ステータスを記録し、納付漏れや金額確認漏れを防止する

**実装完了内容**:
1. ✅ **納付状況の型定義**
   - `PaymentStatus`型の定義（unpaid / paid / partially_paid / not_required）
   - `PaymentMethod`型の定義（bank_transfer / account_transfer / cash / other）
   - `SocialInsurancePayment`型の定義
   - Firestoreコレクション構造の設計（`offices/{officeId}/payments/{targetYearMonth}`）

2. ✅ **納付状況サービス**
   - `PaymentsService`の実装
   - 納付状況の作成（`create()`）- 新規作成時に予定額を自動計算（4つすべて未指定の場合のみ）
   - 納付状況の一覧取得（`listByOffice()`）- リアルタイム購読、`limit`パラメータ対応
   - 納付状況の単一取得（`get()`）- 対象年月を指定して取得、リアルタイム購読対応
   - 納付状況の更新（`update()`）
   - 予定額の自動計算ロジック（`calculatePlannedAmounts()`）- 月次・賞与の会社負担額合計を計算

3. ✅ **BonusPremiumsServiceの拡張**
   - `listByOfficeAndYearMonth(officeId, yearMonth)`メソッドの追加
   - 対象年月に含まれる賞与支給日の賞与保険料をフィルタして返す

4. ✅ **納付状況一覧画面**
   - 納付状況一覧表示（テーブル形式、対象年月ごと）
   - 納付状況登録フォーム（ダイアログ）
   - 納付状況編集フォーム（ダイアログ）
   - ステータス別フィルタ、納付方法表示

5. ✅ **納付状況フォームダイアログ**
   - 予定額・納付額（実績額）の入力フォーム
   - 納付ステータス・納付方法・納付日の入力
   - 「納付済」選択時のバリデーション（納付日と納付額が必須）
   - 予定額の自動計算ボタン（新規作成時のみ）
   - セクション単位のヘルプテキスト追加
   - 各入力項目の`mat-hint`追加
   - エラーメッセージとSnackBar通知

6. ✅ **ダッシュボード連携**
   - 「今月納付予定の社会保険料」カードの追加（リアルタイム更新対応）
   - 「最近の納付状況（最大12件）」セクションの追加
   - ステータスバッジ表示、納付状況へのリンク

7. ✅ **Firestoreセキュリティルール**
   - admin/hrは全納付状況を閲覧・作成・更新可能
   - employeeはアクセス不可
   - 金額フィールドは0以上（負の値は不可）
   - `paymentStatus === 'paid'`の場合は`paymentDate`と`actualTotalCompany`が必須
   - フィールド型チェック（`paymentMethod`、`paymentDate`、`memo`など）

8. ✅ **ルーティングとサイドメニュー**
   - `/payments`ルートの追加（admin/hr専用）
   - サイドメニューに「社会保険料納付状況」メニュー項目を追加

**実装ファイル**:
- `src/app/types.ts`（`PaymentStatus`型、`PaymentMethod`型、`SocialInsurancePayment`型追加）
- `src/app/services/payments.service.ts`（新規作成）
- `src/app/services/bonus-premiums.service.ts`（`listByOfficeAndYearMonth`メソッド追加）
- `src/app/pages/payments/payments.page.ts`（新規作成）
- `src/app/pages/payments/payment-form-dialog.component.ts`（新規作成）
- `src/app/pages/dashboard/dashboard.page.ts`（納付状況表示追加）
- `src/app/app.routes.ts`（`/payments`ルート追加）
- `src/app/app.ts`（サイドメニューに「社会保険料納付状況」追加）
- `firestore.rules`（`payments`コレクションのルール追加）

**UX改善**:
- 「実績額」→「納付額」への用語統一
- セクション単位のヘルプテキスト追加
- 各入力項目の`mat-hint`追加
- バリデーション強化（「納付済」選択時の必須チェック）

---

### Phase3-7: e-Gov届出対応マスタ管理機能 ✅ 実装完了

**優先度**: 🔴 高（実務上重要な機能）  
**依存関係**: Phase3-4、Phase2-1  
**目標完了日**: 2025年12月9日  
**完了日**: 2025年12月2日

**目的**: e-Gov届出（CSVファイル添付方式を含む）に必要となる情報を、事前にInsurePath側で管理できる状態にする。本システムは e-Gov への直接送信や CSV 出力は行わず、「e-Gov届出に必要な基礎情報を漏れなく整備しておけるマスタ管理機能」として位置づける。

**実装完了内容**:
1. ✅ **マイナンバー管理機能**
   - 従業員および被扶養者のマイナンバー（個人番号）の管理
   - MyNumberService経由での一元管理
   - 画面表示時には下数桁のみのマスキング表示
   - 現時点では簡易実装（プレーン文字列保存）。本番運用では暗号化必須

2. ✅ **事業所情報の拡張**
   - 事業所記号・事業所番号・郡市区符号の管理
   - 事業所所在地の詳細情報（郵便番号、電話番号、事業主氏名）

3. ✅ **従業員情報の拡張**
   - 被保険者整理番号、性別、郵便番号、住所カナの追加
   - マイナンバーの追加

4. ✅ **被扶養者情報の拡張**
   - 氏名カナ、性別、郵便番号、住所、同居／別居区分の追加
   - マイナンバーの追加

**実装ファイル**:
- `src/app/types.ts`（Office、Employee、Dependent型の拡張、Sex型、CohabitationFlag型の追加）
- `src/app/services/mynumber.service.ts`（新規作成）
- `src/app/pages/employees/employee-form-dialog.component.ts`（拡張）
- `src/app/pages/employees/dependent-form-dialog.component.ts`（拡張）
- `src/app/pages/offices/offices.page.ts`（拡張）
- `src/app/services/employees.service.ts`（拡張）
- `src/app/services/dependents.service.ts`（拡張）
- `src/app/services/offices.service.ts`（拡張）
- `firestore.rules`（新フィールドの型チェック追加）

**注意**: 
- 本システムは e-Gov への直接送信や CSV 出力は行わない。
- 担当者は InsurePath のマスタ画面を参照しながら e-Gov の入力画面へ転記することで、届出作成作業を効率化できる。
- 項目設計にあたっては、日本年金機構が公開している届書作成仕様書を参考にしている。

---


### Phase3-8: 公的帳票（届出書）自動作成・PDF出力機能 ✅ 実装完了（MVP）

**優先度**: 🟡 中（拡張機能）  
**依存関係**: Phase3-4、Phase3-7  
**目標完了日**: 2025年12月3日  
**完了日**: 2025年12月3日

**目的**: 資格取得届・資格喪失届・賞与支払届など、代表的な社会保険届出書について、従業員データから必要項目を自動反映した帳票を生成できる

**実装完了内容（MVP）**:
1. ✅ **PDF生成サービスの実装**
   - `DocumentGeneratorService`の実装（pdfmake使用）
   - 日本語フォント対応（Noto Sans JP）
   - PDF出力機能（プレビュー・ダウンロード・印刷）

2. ✅ **帳票テンプレートの定義**
   - 資格取得届のテンプレート定義（`qualification-acquisition.ts`）
   - 資格喪失届のテンプレート定義（`qualification-loss.ts`）
   - 賞与支払届のテンプレート定義（`bonus-payment.ts`）

3. ✅ **帳票生成ダイアログの実装**
   - `DocumentGenerationDialogComponent`の実装
   - バリデーション機能（致命的必須項目・通常必須項目・任意項目の3段階分類）
   - 標準報酬月額の自動取得（標準報酬履歴を優先）

4. ✅ **UI連携**
   - 従業員詳細ダイアログからの帳票生成ボタン（資格取得届PDF、資格喪失届PDF）
   - 賞与保険料画面からの帳票生成ボタン（賞与支払届PDF）

**将来拡張（Phase4以降）**:
- ❌ 算定基礎届の一括PDF生成（複数名を1つのPDFにまとめる）
- ❌ 月額変更届のPDF生成
- ❌ 被扶養者異動届のPDF生成
- ❌ 手続き履歴画面からの一括PDF生成機能
- ❌ 帳票履歴管理機能（Storageへの保存、履歴再ダウンロード）

**実装ファイル**:
- `src/app/services/document-generator.service.ts`（新規作成）
- `src/app/utils/document-templates/qualification-acquisition.ts`（新規作成）
- `src/app/utils/document-templates/qualification-loss.ts`（新規作成）
- `src/app/utils/document-templates/bonus-payment.ts`（新規作成）
- `src/app/utils/document-helpers.ts`（新規作成）
- `src/app/utils/pdf-vfs-fonts-jp.ts`（日本語フォントvfsファイル）
- `src/app/pages/documents/document-generation-dialog.component.ts`（新規作成）
- `src/app/pages/employees/employee-detail-dialog.component.ts`（帳票生成ボタン追加）
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts`（帳票生成ボタン追加）

**注意**: 本機能は「参考様式」として位置づけられており、公的機関が正式に認めた様式ではありません。生成されたPDFは印刷して手書き修正や、e-Gov入力時の参照用として利用することを想定しています。

---

### Phase3-9: 従業員セルフ入力・手続き申請フロー機能 ✅ 実装完了

**優先度**: 🟡 中（拡張機能）  
**依存関係**: Phase3-3  
**目標完了日**: 2025年12月3日
**完了日**: 2025年12月（Phase3-9（追加）完了）

**目的**: 入社時や扶養異動時に、従業員本人がWeb画面から自分および家族の情報を入力・更新できるセルフ入力フォームを提供する

**実装完了内容**:
1. ✅ **プロフィール変更申請機能**（Phase3-3で実装済み）
   - 従業員本人がマイページからプロフィール変更を申請できる
   - 申請可能な項目：郵便番号、住所、電話番号、連絡先メールアドレス、カナ（オプション）
   - 申請登録ダイアログ（`change-request-form-dialog.component.ts`）
   - 申請履歴の表示と取り下げ機能

2. ✅ **扶養家族申請機能**（Phase3-9（追加）で実装）
   - **扶養家族追加申請フォーム**（`dependent-add-request-form-dialog.component.ts`）
     - 新規被扶養者の追加を申請
     - フォーム項目：氏名、カナ、続柄、生年月日、性別、郵便番号、住所、同居／別居、就労状況フラグ
   - **扶養家族変更申請フォーム**（`dependent-update-request-form-dialog.component.ts`）
     - 既存の被扶養者情報の変更を申請
     - 既存情報を読み取り専用で表示し、変更したい項目を入力
   - **扶養家族削除申請フォーム**（`dependent-remove-request-form-dialog.component.ts`）
     - 被扶養者の削除を申請
     - 既存の被扶養者情報を読み取り専用で表示し、削除理由を入力（任意）

3. ✅ **申請種別選択ダイアログ**（`request-kind-selection-dialog.component.ts`）
   - マイページの「新しい申請を作成」ボタンから開く
   - 4つの選択肢（プロフィール変更、扶養家族追加、扶養家族変更、扶養家族削除）を表示
   - 選択に応じて適切な申請フォームダイアログを開く
   - 複数の被扶養者がいる場合、`DependentSelectDialogComponent`で対象を選択

4. ✅ **被扶養者選択ダイアログ**（`dependent-select-dialog.component.ts`）
   - 複数の被扶養者がいる場合に、変更・削除対象を選択するダイアログ

5. ✅ **申請一覧画面の拡張**（`requests.page.ts`）
   - プロフィール変更申請と扶養家族申請の両方を扱う
   - 承認時の自動反映機能（プロフィール変更申請と扶養家族申請の両方）

6. ✅ **マイページの拡張**（`my-page.ts`）
   - 「申請・手続き」セクションの追加
   - 申請履歴テーブル
   - 扶養家族カードの改善

7. ✅ **型定義の整理**（`types.ts`）
   - `ChangeRequest.field`の型を`'postalCode' | 'address' | 'phone' | 'contactEmail' | 'kana' | 'other'`に整理
   - `ChangeRequestKind`に`'dependent_add' | 'dependent_update' | 'dependent_remove'`を追加

8. ✅ **自動反映機能**
   - プロフィール変更申請の承認時：`employees`コレクションへ自動反映
   - 扶養家族申請の承認時：`dependents`サブコレクションへ自動反映（追加・更新・削除）

**実装ファイル**:
- `src/app/types.ts`（型定義の拡張）
- `src/app/services/change-requests.service.ts`（`removeUndefinedDeep()`メソッド追加）
- `src/app/pages/requests/change-request-form-dialog.component.ts`（プロフィール変更申請フォーム）
- `src/app/pages/requests/dependent-add-request-form-dialog.component.ts`（新規作成）
- `src/app/pages/requests/dependent-update-request-form-dialog.component.ts`（新規作成）
- `src/app/pages/requests/dependent-remove-request-form-dialog.component.ts`（新規作成）
- `src/app/pages/requests/request-kind-selection-dialog.component.ts`（新規作成）
- `src/app/pages/requests/dependent-select-dialog.component.ts`（新規作成）
- `src/app/pages/requests/confirm-dialog.component.ts`（新規作成）
- `src/app/pages/requests/requests.page.ts`（承認時の自動反映ロジック追加）
- `src/app/pages/me/my-page.ts`（申請履歴セクション追加）
- `src/app/utils/label-utils.ts`（ラベル変換関数の拡張）
- `firestore.rules`（セキュリティルール）

---

### Phase3-10: 社会保険手続き用添付書類管理機能 ✅ 実装完了

**優先度**: 🟡 中（実務上重要な機能）  
**依存関係**: Phase2-1（セキュリティ強化）、Phase3-3（申請フロー）  
**目標完了日**: 2025年12月4日
**完了日**: 2025年12月4日

**目的**: 被扶養者認定用書類、本人確認書類など、社会保険手続きに必要な添付書類を、従業員ごとの書類ボックス（ドキュメントセンター）として整理し、アップロード・管理できる

**実装完了内容**:
1. ✅ **型定義**
   - `DocumentCategory`型の定義（10種類）
   - `DocumentAttachment`型の定義（書類メタ情報）
   - `DocumentRequest`型の定義（書類アップロード依頼）
   - `DocumentSource`型、`DocumentRequestStatus`型の定義

2. ✅ **StorageServiceの実装**
   - ファイルアップロード機能（`uploadFile()`）- Firebase Storageへのアップロード、ファイル名サニタイズ、contentTypeメタデータ設定
   - ファイルダウンロード機能（`downloadFile()`）- `getDownloadURL()`経由でBlob取得（CORS対応）
   - ダウンロードURL取得機能（`getDownloadUrl()`）- プレビュー・ダウンロード用
   - ファイル削除機能（`deleteFile()`）

3. ✅ **DocumentsServiceの実装**
   - 書類添付のCRUD操作（`listAttachments()`、`getAttachment()`、`createAttachment()`、`updateAttachment()`、`deleteAttachment()`）
   - 書類アップロード依頼のCRUD操作（`listRequests()`、`getRequest()`、`createRequest()`、`updateRequest()`）
   - `removeUndefinedDeep()`メソッドによるFirestore書き込み前の`undefined`フィールド除去処理

4. ✅ **ドキュメントセンター画面**（`documents.page.ts`）
   - 2カラムレイアウト（左：従業員一覧、右：書類・依頼一覧）
   - 従業員検索・選択機能
   - 書類添付一覧タブ（フィルタ・ソート機能）
   - 書類アップロード依頼一覧タブ（フィルタ・ソート機能）
   - アクションボタン（依頼作成、直接アップロード、ダウンロード・プレビュー・削除、依頼キャンセル）

5. ✅ **書類アップロード依頼作成ダイアログ**（`document-request-form-dialog.component.ts`）
   - 対象従業員選択、カテゴリ選択、タイトル入力、メッセージ入力（任意）、期限設定（任意）
   - バリデーション（必須項目チェック、文字数制限）

6. ✅ **管理者直接アップロードダイアログ**（`document-upload-form-dialog.component.ts`）
   - 対象従業員選択、カテゴリ選択、タイトル入力、メモ入力（任意）、有効期限設定（任意）、ファイル選択
   - ファイルサイズ制限（10MB）、MIMEタイプ制限（PDF、画像）
   - バリデーション（必須項目チェック、ファイルサイズ・タイプチェック）

7. ✅ **従業員アップロードダイアログ**（`document-upload-dialog.component.ts`）
   - 依頼情報の表示（読み取り専用）、タイトル編集、メモ入力（任意）、ファイル選択
   - ファイルサイズ制限（10MB）、MIMEタイプ制限（PDF、画像）
   - アップロード後の依頼ステータス自動更新（`pending` → `uploaded`）

8. ✅ **マイページの拡張**（`my-page.ts`）
   - 「書類アップロード依頼」セクション追加
   - 自分宛ての`pending`ステータスの依頼一覧表示
   - 各依頼からアップロードダイアログを開くボタン
   - リアルタイム更新対応

9. ✅ **ラベル変換関数**（`label-utils.ts`）
   - `getDocumentCategoryLabel()`関数
   - `getDocumentRequestStatusLabel()`関数

10. ✅ **ルーティングとサイドメニュー**
    - `/documents`ルートの追加（admin/hr専用）
    - サイドメニューに「書類管理」メニュー項目を追加

11. ✅ **Firestoreセキュリティルール**
    - `documents`コレクションのルール（admin/hrは全件閲覧・作成・更新・削除可能、employeeは自分の`employeeId`に紐づくもののみ閲覧・作成可能）
    - `documentRequests`コレクションのルール（admin/hrは全件閲覧・作成・更新可能、employeeは自分の`employeeId`に紐づくもののみ閲覧可能、依頼ステータスの更新は従業員本人も可能）
    - データバリデーション（必須フィールドチェック、型チェック、ステータス遷移チェック）

12. ✅ **Storageセキュリティルール**
    - パスベースのアクセス制御（`offices/{officeId}/employees/{employeeId}/documents/{documentId}/{fileName}`）
    - 認証済みユーザーは全員アップロード・閲覧可能（将来的に従業員ロールはマイページの表示のみにする予定のため、現状は緩いルールで運用）
    - ファイルサイズ制限（10MB）、MIMEタイプ制限（PDF、画像）
    - admin/hrのみ削除可能

**実装ファイル**:
- `src/app/types.ts`（`DocumentCategory`型、`DocumentAttachment`型、`DocumentRequest`型、`DocumentSource`型、`DocumentRequestStatus`型追加）
- `src/app/services/storage.service.ts`（新規作成）
- `src/app/services/documents.service.ts`（新規作成）
- `src/app/pages/documents/documents.page.ts`（新規作成）
- `src/app/pages/documents/document-request-form-dialog.component.ts`（新規作成）
- `src/app/pages/documents/document-upload-form-dialog.component.ts`（新規作成）
- `src/app/pages/documents/document-upload-dialog.component.ts`（新規作成）
- `src/app/pages/me/my-page.ts`（書類アップロード依頼セクション追加）
- `src/app/utils/label-utils.ts`（`getDocumentCategoryLabel()`、`getDocumentRequestStatusLabel()`関数追加）
- `src/app/app.routes.ts`（`/documents`ルート追加）
- `src/app/app.ts`（サイドメニューに「書類管理」追加）
- `src/app/app.config.ts`（`provideStorage`追加）
- `firestore.rules`（`documents`、`documentRequests`コレクションのルール追加）
- `storage.rules`（新規作成、書類ファイルのアクセス制御ルール）

**注意**: 本機能は「手続きレコードに紐づける」方式ではなく、「従業員ごとの書類ボックス（ドキュメントセンター）として整理する」方式で実装されています。将来的に手続きレコードと紐づける余地を残しています。

---

### Phase3-11: 保険料率・等級表クラウドマスタ・自動更新機能 📋 未実装（優先度：低）

**優先度**: 🟢 低（拡張機能）  
**依存関係**: Phase1-5  
**目標完了日**: 2025年12月5日

**目的**: 協会けんぽおよび厚生年金などの全国共通マスタについて、システム全体で共有する「クラウドマスタ」として保険料率・等級表を一元管理できるようにする。システム管理者がクラウドマスタを更新すると、協会けんぽの全事務所の初期値が自動的に更新される。

**実装予定内容**:

1. **クラウドマスタのデータ構造**
   - Firestoreコレクション: `cloudMasters/healthRateTables/{year}_{prefCode}`（年度+都道府県コードで管理）
   - Firestoreコレクション: `cloudMasters/careRateTables/{year}`（年度で管理、全国一律）
   - Firestoreコレクション: `cloudMasters/pensionRateTables/{year}`（年度で管理、全国一律）
   - 都道府県別の健康保険料率も年度ごとにクラウドマスタで管理（全47都道府県分）

2. **CloudMasterServiceの実装**
   - クラウドマスタの取得メソッド（年度・都道府県コード指定）
   - クラウドマスタの更新メソッド（システム管理者用）
   - 事業所マスタへの初期値取得メソッド（クラウドマスタから取得）

3. **マスタフォームダイアログの拡張**
   - **新規作成時**: クラウドマスタから自動的に初期値を取得して設定（ボタン操作不要）
     - 健康保険: 都道府県選択時（`onPrefChange()`）に自動取得
     - 介護保険・厚生年金: フォーム初期化時（`constructor`）に自動取得
   - **編集時**: 既存データを表示（自動更新しない）
     - 「プリセットを読み込む」ボタンでクラウドマスタから初期値を再取得（上書き）

4. **都道府県別データの実装**
   - 全47都道府県分の健康保険料率データをクラウドマスタに登録
   - `kyokai-presets.ts`のハードコードされたデータは、クラウドマスタ取得失敗時のフォールバック用として保持

5. **クラウドマスタ管理画面（システム管理者用）**
   - 新規ページ: `/cloud-masters`（admin専用）
   - クラウドマスタの一覧表示・編集・削除
   - 年度別・都道府県別の健康保険料率管理
   - 年度別の介護保険料率・厚生年金保険料率管理

6. **Firestoreセキュリティルール**
   - クラウドマスタの読み取り: 全認証ユーザーが閲覧可能
   - クラウドマスタの作成・更新・削除: adminロールのみ（システム管理者が更新可能）

**実装予定ファイル**:
- `src/app/types.ts`（`CloudHealthRateTable`、`CloudCareRateTable`、`CloudPensionRateTable`型追加）
- `src/app/services/cloud-master.service.ts`（新規作成）
- `src/app/pages/masters/health-master-form-dialog.component.ts`（クラウドマスタからの自動取得機能追加）
- `src/app/pages/masters/care-master-form-dialog.component.ts`（クラウドマスタからの自動取得機能追加）
- `src/app/pages/masters/pension-master-form-dialog.component.ts`（クラウドマスタからの自動取得機能追加）
- `src/app/pages/cloud-masters/cloud-masters.page.ts`（新規作成、システム管理者用）
- `src/app/utils/kyokai-presets.ts`（全47都道府県データ追加、フォールバック用として保持）
- `firestore.rules`（`cloudMasters`コレクションのルール追加）
- `src/app/app.routes.ts`（`/cloud-masters`ルート追加）
- `src/app/app.ts`（サイドメニューに「クラウドマスタ管理」追加、admin専用）

---

### Phase3-12: 多言語対応機能 📋 未実装（優先度：低）

**優先度**: 🟢 低（拡張機能）  
**依存関係**: なし  
**目標完了日**: 2025年12月8日

**目的**: 日本語に加え、英語UIへの切り替えに対応し、日本語が母語でない従業員・担当者も利用しやすい画面を提供する

**実装予定内容**:
1. **英語UIの実装**
   - Angular i18nまたはngx-translateを使用
   - 表示言語の設定機能

**実装予定ファイル**:
- `src/app/i18n/`（多言語リソースファイル）
- `src/app/services/i18n.service.ts`（新規作成）

---

### Phase3-13: 社会保険情報の異常値チェック・ギャップ検知機能 📋 未実装（優先度：中）

**優先度**: 🟡 中（データ品質向上）  
**依存関係**: なし  
**目標完了日**: 2025年12月5日

**目的**: 従業員台帳・資格情報・標準報酬履歴・保険料計算結果などのデータに対して、代表的な「おかしな状態」を自動チェックする

**実装予定内容**:
1. **異常値チェックルールの定義**
   - 代表的なチェックルールの定義

2. **自動チェック機能**
   - 異常値の自動検知
   - 異常値一覧表示

**実装予定ファイル**:
- `src/app/services/data-quality.service.ts`（新規作成）
- `src/app/pages/data-quality/data-quality.page.ts`（新規作成）

---

### Phase3-14: 手続きタスクの期限別ビュー・簡易アラート機能 📋 未実装（優先度：中）

**優先度**: 🟡 中（実務上必要な機能）  
**依存関係**: Phase3-4  
**目標完了日**: 2025年12月6日

**目的**: 社会保険手続き履歴・期限管理機能と連携し、「いつまでに何の手続きを行う必要があるか」をタスク一覧として見える化する

**実装予定内容**:
1. **期限別ビューの実装**
   - 「今週提出期限の手続き」一覧
   - 「提出期限を過ぎて未完了の手続き」一覧

2. **ダッシュボードへの集計表示**
   - 「今週提出期限の手続き：◯件」の表示

**実装予定ファイル**:
- `src/app/pages/procedures/procedures.page.ts`（期限別ビュー追加）
- `src/app/pages/dashboard/dashboard.page.ts`（手続きタスク集計追加）

---


### Phase3-15: 口座情報・給与情報管理機能 📋 未実装（優先度：低）

**優先度**: 🟢 低（拡張機能）  
**依存関係**: Phase2-1  
**目標完了日**: 2025年12月6日

**目的**: 従業員ごとに、給与振込口座情報を台帳として登録・管理できる

**実装予定内容**:
1. **口座情報の型定義**
   - `BankAccount`型の定義
   - Firestoreコレクション構造の設計

2. **口座情報の登録・編集機能**
   - 従業員詳細ダイアログに口座情報セクション追加

**実装予定ファイル**:
- `src/app/types.ts`（`BankAccount`型追加）
- `src/app/services/bank-accounts.service.ts`（新規作成）
- `src/app/pages/employees/employee-detail-dialog.component.ts`（口座情報セクション追加）

---

### Phase3-16: 入社手続きフロー・入社チェックリスト機能 📋 未実装（優先度：低）

**優先度**: 🟢 低（拡張機能）  
**依存関係**: Phase3-4、Phase3-8  
**目標完了日**: 2025年12月7日

**目的**: 新しく入社する従業員ごとに、「入社手続きチェックリスト」を作成し、必要な項目の進捗を一覧で管理できる

**実装予定内容**:
1. **入社チェックリストの型定義**
   - `OnboardingChecklist`型の定義

2. **チェックリストの作成・管理機能**
   - チェックリストの作成
   - 進捗管理機能

**実装予定ファイル**:
- `src/app/types.ts`（`OnboardingChecklist`型追加）
- `src/app/services/onboarding.service.ts`（新規作成）
- `src/app/pages/onboarding/onboarding.page.ts`（新規作成）

---

### Phase3-17: 年末調整・確定申告用社会保険料集計・エクスポート機能 📋 未実装（優先度：低）

**優先度**: 🟢 低（拡張機能）  
**依存関係**: Phase1-4、Phase1-6  
**目標完了日**: 2025年12月7日

**目的**: 対象年を指定すると、従業員ごとに1年間の社会保険料（健康保険・介護保険・厚生年金の本人負担分）を集計し、一覧で表示できる

**実装予定内容**:
1. **年間集計機能**
   - 従業員ごとの年間社会保険料集計

2. **年末調整用CSVエクスポート機能**
   - 年間集計結果をCSVとしてエクスポート

**実装予定ファイル**:
- `src/app/utils/year-end-export.service.ts`（新規作成）
- `src/app/pages/premiums/monthly-premiums.page.ts`（年末調整用エクスポートボタン追加）

---

## 📅 Phase3の実装スケジュール（12日間：Phase3-1からPhase3-7まで完了済み）

### 11月28日（金）- Day 1 ✅ 完了
- ✅ **Phase3-1**: 従業員情報の最終更新者・更新日時表示機能
- ✅ **Phase3-2**: 社会保険用語・ルールヘルプ機能

### 11月29日（土）- Day 2 ✅ 完了
- ✅ **Phase3-3**: 従業員情報の変更申請・承認機能

### 11月30日（日）- Day 3 ✅ 完了
- ✅ **Phase3-3**: 従業員情報の変更申請・承認機能

### 12月1日（月）- Day 4 ✅ 完了
- ✅ **Phase3-4**: 社会保険手続き履歴・期限管理機能
- ✅ **Phase3-5**: 被扶養者状況確認・年次見直し支援機能

### 12月2日（火）- Day 5 ✅ 完了
- ✅ **Phase3-6**: 社会保険料納付状況管理機能
- ✅ **Phase3-7**: e-Gov届出対応マスタ管理機能（マイナンバー、基礎年金番号、事業所整理記号など）

### 12月3日（水）- Day 6 ✅ 完了
- ✅ **Phase3-8**: 公的帳票（届出書）自動作成・PDF出力機能（MVP完了）
- ✅ **Phase3-9**: 従業員セルフ入力・手続き申請フロー機能（Phase3-9（追加）完了）

### 12月4日（木）- Day 7 ✅ 完了
- ✅ **Phase3-10**: 社会保険手続き用添付書類管理機能（書類管理機能（ドキュメントセンター＆添付ファイル管理）実装完了）
- **Phase3-11**: 保険料率・等級表クラウドマスタ・自動更新機能

### 12月5日（金）- Day 8
- **Phase3-13**: 社会保険情報の異常値チェック・ギャップ検知機能
- **Phase3-14**: 手続きタスクの期限別ビュー・簡易アラート機能

### 12月6日（土）- Day 9
- **Phase3-15**: 口座情報・給与情報管理機能

### 12月7日（日）- Day 10
- **Phase3-16**: 入社手続きフロー・入社チェックリスト機能
- **Phase3-17**: 年末調整・確定申告用社会保険料集計・エクスポート機能

### 12月8日（月）- Day 11
- **Phase3-12**: 多言語対応機能
- **最終確認・テスト**: 残り時間で最終確認とテスト

### 12月9日（火）- Day 12
- **最終確認・テスト**: 残り時間で最終確認とテスト
- **バグ修正・調整**

### 12月10日（水）- Day 13（最終日）
- **最終確認・テスト**: 全機能の最終確認とテスト
- **バグ修正・調整**
- **リリース準備**

---

## 📌 注意事項

- **並行作業**: 可能な限り複数の機能を並行して実装
- **既存機能への影響**: 既存の実装を壊さないよう、十分なテストを実施

---



### e-Gov届出対応マスタ管理機能について

Phase3-7では、e-Gov届出（CSVファイル添付方式を含む）に必要となる情報を、事前にInsurePath側で管理できる状態にするため、以下の項目を実装しました：

- **事業所マスタ**: 事業所記号・事業所番号・郡市区符号・事業主氏名・所在地（住所／郵便番号／電話番号）など
- **従業員マスタ**: 氏名（漢字／カナ）、生年月日、性別、住所・郵便番号、被保険者整理番号、基礎年金番号、マイナンバーなど
- **被扶養者マスタ**: 氏名（漢字／カナ）、生年月日、性別、住所・郵便番号、同居／別居区分、マイナンバーなど

**注意**: 本システムは e-Gov への直接送信や CSV 出力は行わず、「e-Gov届出に必要な基礎情報を漏れなく整備しておけるマスタ管理機能」として位置づけています。担当者は InsurePath のマスタ画面を参照しながら e-Gov の入力画面へ転記することで、届出作成作業を効率化できます。




以上でPhase3の実装計画（全機能完成版）は完了です。各フェーズの詳細な実装指示書は、実装開始前に作成することを推奨します。
