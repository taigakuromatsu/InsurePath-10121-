# Phase3-13 実装指示書: 社会保険情報の異常値チェック・ギャップ検知機能

## 1. 概要

Phase3-13では、従業員台帳・資格情報・標準報酬履歴・保険料計算結果などに対し、代表的な「おかしな状態」を自動チェックし、要確認レコードを一覧化・集計する機能を実装する。異常の種類別に件数を集計し、ダッシュボードでサマリ表示することで、台帳の整合性を高める。

### Phase3-13のスコープ
- 異常値チェックの実装（最低限の代表的ルール）
- 異常値チェック結果一覧画面の実装
- ダッシュボードへの要確認件数の集計表示
- （範囲外）自動修正・外部通知・スケジュール実行

---

## 2. 前提・ゴール

### 前提
- 既存データ: 従業員台帳、資格情報（isInsured, qualification dates）、標準報酬履歴、保険料計算結果（月次/賞与）、年齢・生年月日。
- Firestore構造は既存コレクションを利用。異常チェック結果はクライアント計算（MVP）。
- ダッシュボードは`dashboard.page.ts`でsignalベースのカード表示。

### ゴール（完了判定）
1. ✅ 異常値チェック処理が実装され、代表的ルールを検知できる。
2. ✅ 異常値チェック結果を一覧表示するページがある（絞り込み/並び替えは任意、最低限一覧表示）。
3. ✅ ダッシュボードに「要確認レコード：◯件」が表示され、クリックで異常一覧へ遷移する。
4. ✅ 既存機能を破壊しない（従業員/保険料計算/ダッシュボード等）。

---

## 3. 仕様の明確化

### 3.1 チェック対象データ
- 従業員: `Employee`（isInsured, health/pension qualification & loss dates, retireDate, birthDate など）
- 標準報酬履歴: `StandardRewardHistory`（appliedFromYearMonth など）
- 月次保険料: `MonthlyPremium`（yearMonth, careTotal, health/pension 等級・標準報酬スナップショット など）
- 年齢判定: 生年月日から算出（基準日は対象年月末、計算ロジックは保険料計算で使用しているヘルパーを流用）

### 3.2 共通の判定仕様
- **対象年月レンジ（MVP）**: 「最新の年月」と「その前月」の2ヶ月を `DataQualityService` 内で固定判定。最新年月は `MonthlyPremium.yearMonth` の最大値から求める。将来的にはUIで選択可能とし、パラメータ化しやすい設計とする。
- **資格期間の判定**: 対象年月の1日を基準日として、`acquiredDate <= targetMonthFirstDay < lossDate`（lossDate が未設定なら無期限）で「資格期間内」とみなす。
- **年齢判定（介護保険）**: 対象年月末日時点の年齢で判定し、既存の保険料計算ヘルパーを共通利用する（新規ロジックを増やさない）。

### 3.3 MVPチェックルール（6本柱＝実装対象）
`DataQualityIssueType`と1:1対応させる。
1) **被保険者フラグと資格情報・標準報酬履歴の不整合**  
   - `isInsured = true` なのに健康/厚年の資格取得日未設定、または `StandardRewardHistory` が1件もない  
   - 健康/厚年の資格取得日があるのに `isInsured = false`
2) **資格期間内なのに月次保険料レコードが存在しない**  
   - 対象レンジ（最新+前月）で `isInsured = true` かつ資格期間内なのに、その年月の `MonthlyPremium` が存在しない
3) **資格喪失日（＋退職日）と保険料計上の矛盾**  
   - 資格喪失日があるのに、その後の年月に `MonthlyPremium` が計上され続けている  
   - 退職日があるのに資格喪失日が未入力/矛盾し、その後も計上が続くケースを含む
4) **標準報酬決定・改定履歴の期間矛盾**  
   - 同一社員の `StandardRewardHistory` を `appliedFromYearMonth` 昇順ソート  
   - 前レコードの有効終了と次レコードの開始が重なっていないかをチェック（endがnullなら最終レコードとして無期限扱い）
5) **介護保険料の年齢不整合**  
   - 40〜64歳に該当するのに `careTotal` が0/未設定  
   - 40歳未満または65歳以上なのに `careTotal` が正の値  
   - 年齢判定は既存ヘルパーを流用
6) **月次保険料レコードの標準報酬スナップショット欠落**  
   - `MonthlyPremium` の等級/標準報酬スナップショット（health/pension 等級・標準報酬）が未設定または0

### 3.4 拡張チェックルール例（今回実装対象外）
- isInsured = true なのに保険者番号・基礎年金番号が未登録
- 賞与保険料（`BonusPremium`）との整合性チェック（賞与支給があるのに賞与保険料レコードなし等）
- 雇用形態・勤務時間と社会保険適用区分の矛盾（短時間労働者判定との不整合 等）
- 介護保険適用年齢と `careRate` 適用テーブルの不整合（将来のマスタ連携を想定）

### 3.5 出力形式と保存方針
- `DataQualityIssue`（新規インターフェース）  
  - id（ローカル生成で可）、employeeId、employeeName、issueType、description、targetPeriod（任意）、detectedAt、severity（MVPは'warning'固定だが将来'error'も想定）
- **保存方針**: Firestoreへ保存せず、画面表示時に毎回クライアントで再計算して一覧表示する。無視/確認済みフラグは今回スコープ外。

### 3.6 ダッシュボード連携
- 要確認件数 = `issues.length`（クライアント計算）
- カードクリックで `/data-quality` へ遷移（query params不要）

---

## 4. 変更対象ファイル
- `src/app/types.ts`  
  - `DataQualityIssue`型（issueTypeは文字列リテラルのunionで十分）
- `src/app/services/data-quality.service.ts`（新規）  
  - 異常値チェックを行い、`Observable<DataQualityIssue[]>`を返す
- `src/app/pages/data-quality/data-quality.page.ts`（新規）  
  - 異常一覧ページ（テーブル表示、簡易フィルタ任意）
- `src/app/pages/dashboard/dashboard.page.ts`  
  - 要確認件数カード追加、クリックで `/data-quality` へ遷移

---

## 5. 画面仕様（MVP）

### 5.1 異常値チェック結果一覧 `/data-quality`
- テーブル表示: 対象者名、issueType、description、targetPeriod（任意）、detectedAt
- 並び: detectedAt DESC（クライアントソートで可）
- フィルタは任意（MVPはなしでも可）
- 未件数時は「異常は見つかりませんでした」を表示

### 5.2 ダッシュボード `/dashboard`
- 「要確認レコード：◯件」カードを追加
- 件数 > 0 の場合は警告色
- クリックで `/data-quality` に遷移

---

## 6. 実装方針

### 6.1 チェック実装のスタンス
- MVPではクライアント集計（Firestoreクエリ＋メモリチェック）とする。
- データ量は事業所規模を想定し、パフォーマンス問題は許容。将来は Cloud Functions での夜間バッチや集計コレクションに差し替え可能な構造にする。

### 6.2 サービス設計
`data-quality.service.ts`（新規）
- 依存サービス: `EmployeesService`, `MonthlyPremiumsService`, （標準報酬履歴を取得できるサービスがあればそれも）
- メソッド例:
  - `listIssues(officeId: string): Observable<DataQualityIssue[]>`
  - 内部で各ルールをチェックし、配列を結合
- 日付/年月計算に既存ヘルパーを流用（必要なら`date-helpers`を利用）

### 6.3 ダッシュボード連携
- `DashboardPage`で`dataQualityIssuesCount$`を追加し、`toSignal`でsignal化。
- カードクリックで`/data-quality`へ`router.navigate`。
- 既存のスタイルに合わせて `warning` クラスなどを適用。

### 6.4 ルーティング
- ルート `/data-quality` を追加（スタンドアロンコンポーネントならルート登録のみ）。

---

## 7. 実装手順

### Step 0: 型定義
- `types.ts` に `DataQualityIssue` 追加  
  ```ts
  export type DataQualityIssueType =
    | 'insured_qualification_inconsistent' // ルール1
    | 'missing_premium_record'             // ルール2
    | 'loss_retire_premium_mismatch'       // ルール3
    | 'standard_reward_overlap'            // ルール4
    | 'care_premium_mismatch'              // ルール5
    | 'premium_snapshot_missing';          // ルール6

  export interface DataQualityIssue {
    id: string;
    employeeId: string;
    employeeName: string; // DataQualityServiceでEmployeeをJOINして設定する
    issueType: DataQualityIssueType;
    description: string;
    targetPeriod?: string; // YYYY-MM など
    detectedAt: string; // ISO or YYYY-MM-DD
    severity?: 'warning' | 'error'; // MVPはすべてwarningで運用、将来errorも利用可能
  }
  ```

### Step 1: サービス実装
- `src/app/services/data-quality.service.ts` 新規作成
  - `listIssues(officeId: string): Observable<DataQualityIssue[]>`
  - 各チェックを関数化し、配列を合算
  - description はユーザーが読んで理解できる日本語
  - detectedAt は `todayYmd()` を利用

### Step 2: 異常一覧ページ
- `src/app/pages/data-quality/data-quality.page.ts` 新規
  - スタンドアロンでテーブル表示（MatTable/MatCard/MatIcon程度）
  - `issues$ = officeId$.pipe(switchMap(listIssues))`
  - 空状態表示を用意

### Step 3: ダッシュボード
- `dashboard.page.ts`
  - `dataQualityIssuesCount$` を追加し、signal化
  - カードを追加（警告色、クリックで`/data-quality`）

---

## 8. テスト観点
- 各ルールごとに異常データを用意し、該当件数が出ること
- 正常データのみの場合に0件となること
- ダッシュボードの件数が一覧と一致すること
- クリック遷移で `/data-quality` が開くこと

---

## 9. 注意事項・今後の拡張
- 将来: Cloud Functionsで夜間集計し、`aggregates/dataQualitySummary` に格納する拡張を想定。
- 大規模データでのパフォーマンスが必要になれば、ルール単位でFirestore側に集計を委譲する設計を検討。

