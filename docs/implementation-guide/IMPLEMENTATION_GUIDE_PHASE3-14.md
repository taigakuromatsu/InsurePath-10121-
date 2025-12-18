# Phase3-14 実装指示書: 手続きタスクの期限別ビュー・簡易アラート機能

## 1. 概要

Phase3-14では、Phase3-4で実装した「社会保険手続き履歴・期限管理機能」と連携し、「いつまでに何の手続きを行う必要があるか」をタスク一覧として見える化する機能を実装します。

事業所ごとに期限別ビューを提供し、ダッシュボード画面に手続きタスクの集計を表示することで、対応漏れのリスクを減らします。また、画面上のバッジ表示や強調表示などの簡易アラートにより、重要な手続きを見落としにくくします。

**重要**: 本機能はシステム内のみの簡易アラート機能であり、プッシュ通知やメール通知などの外部通知機能は実装範囲外です。

### Phase3-14のスコープ

Phase3-14では以下の機能を実装します：

- **期限別ビューの実装**: 「今週提出期限の手続き」「来週までに提出予定の手続き」「提出期限を過ぎて未完了の手続き」の一覧表示
- **ダッシュボードへの集計表示**: 「今週提出期限の手続き：◯件」「期限超過の手続き：◯件」などの集計表示
- **簡易アラート表示**: バッジ表示や強調表示による視覚的なアラート

**今回の実装対象外**:

- **プッシュ通知・メール通知**: 外部通知機能は実装範囲外
- **自動リマインダー**: 定期的な通知機能は実装範囲外

---

## 2. 前提・ゴール

### 前提

- **既存実装**: Phase3-4で`ProceduresService`、`ProceduresPage`が実装済み
- **既存サービス**: `ProceduresService.listByDeadline()`メソッドが存在し、`upcoming`（7日以内）と`overdue`（期限切れ）のフィルタが可能
- **既存ページ**: `src/app/pages/procedures/procedures.page.ts`が存在し、期限フィルタ機能が実装済み
- **既存ダッシュボード**: `src/app/pages/dashboard/dashboard.page.ts`が存在し、各種統計情報を表示している

### ゴール

Phase3-14完了の判定基準：

1. ✅ **期限フィルタの拡張**（`src/app/pages/procedures/procedures.page.ts`）
   - 「今週提出期限の手続き」一覧が表示できる
   - 「来週提出期限の手続き」一覧が表示できる
   - 「提出期限を過ぎて未完了の手続き」一覧が表示できる（既存の`overdue`フィルタを活用）

2. ✅ **ダッシュボードへの集計表示**（`src/app/pages/dashboard/dashboard.page.ts`）
   - 「今週提出期限の手続き：◯件」の集計が表示できる
   - 「期限超過の手続き：◯件」の集計が表示できる
   - バッジ表示や強調表示による視覚的なアラートが実装されている

3. ✅ **ProceduresServiceの拡張**（`src/app/services/procedures.service.ts`）
   - 「今週提出期限」を取得するメソッドが追加されている
   - 「来週までに提出予定」を取得するメソッドが追加されている（必要に応じて）

4. ✅ **既存機能が壊れていないこと**（手続き履歴管理、ダッシュボードの既存機能）

---

## 3. 現状整理

### 3.1 既存の実装状況

**`src/app/services/procedures.service.ts`**:
- `listByDeadline(officeId, filter: 'upcoming' | 'overdue' | 'all')`メソッドが実装済み
- `upcoming`: 7日以内の期限が近い手続き（未完了のみ）
- `overdue`: 期限切れの手続き（未完了のみ）

**`src/app/pages/procedures/procedures.page.ts`**:
- 期限フィルタ（`deadlineFilter$`）が実装済み
- 「期限が近い（7日以内）」「期限切れ」のフィルタが動作する
- 期限切れの手続きは赤色表示（`.overdue`クラス）
- 既存のフィルタ（ステータス、期限、手続き種別）は`combineLatest`で組み合わせ可能

**`src/app/pages/dashboard/dashboard.page.ts`**:
- 従業員数、月次保険料、トレンド、納付状況、ランキングなどを表示
- 手続きタスクの集計は未実装

**`src/app/types.ts`**:
- `ProcedureStatus`: `'not_started' | 'in_progress' | 'submitted' | 'rejected'`の4つのステータスが定義済み
- `SocialInsuranceProcedure.deadline`: `string`型（`YYYY-MM-DD`形式）で保存

### 3.2 仕様の明確化

#### 3.2.1 「今週」「来週」の定義

**採用方針**: 案B（カテゴリをきれいに分ける版）を採用

- **「今週提出期限」**: 今週の月曜日から日曜日までの期間に提出期限がある手続き
- **「来週提出期限」**: 来週の月曜日から日曜日までの期間に提出期限がある手続き
- **UIラベル**: 「来週提出期限」と表示（「来週までに提出予定」は廃止）

**理由**: InsurePath全体で「週」を月曜開始に統一することで、将来の混乱を防ぐ

#### 3.2.2 未完了ステータスの定義

**未完了ステータス**: `not_started`、`in_progress`、`rejected`の3つ

**実装方針**: `src/app/types.ts`に`PENDING_PROCEDURE_STATUSES`定数として定義し、クエリやUIで再利用する（詳細はStep 0-3を参照）

**注意**: `rejected`（差戻し）は期限が過ぎている場合でも「期限超過」に含める

#### 3.2.3 期限が設定されていない手続きの扱い

**仕様**: 期限なし（`deadline`が`null`または空文字）の手続きは、期限フィルタには表示しない

- 期限フィルタ（「今週提出期限」「来週提出期限」「期限切れ」など）では表示しない
- 「すべて」を選択した場合は表示する（既存のフィルタ機能で確認可能）

**将来の拡張**: 期限なしの手続きが多い場合は、別のフィルタオプション「期限未設定」を追加する案を検討

#### 3.2.4 既存フィルタとの相互作用

**仕様**: 期限別ビューと既存フィルタ（ステータス、手続き種別）は組み合わせ可能

- 期限別ビューで取得したデータに対して、クライアント側で既存フィルタを適用
- Firestoreクエリは期限別ビューで絞り込み、細かい組み合わせはRxJSの`filter`で実装
- 理由: 事業所規模的にデータ量は多くないため、クライアント側絞り込みで問題なし

#### 3.2.5 日付型とタイムゾーン

**問題**: `toISOString()`はUTC基準のため、JSTで日付を扱う場合に日付がズレる可能性がある

**実装方針**: JSTでのローカル日付を前提に`YYYY-MM-DD`を作成するヘルパー関数を作成

**実装イメージ**: Step 0-1で定義する`todayYmd()`などの関数を使用して、JSTでのローカル日付を`YYYY-MM-DD`形式の文字列として取得する（詳細はStep 0-1を参照）

#### 3.2.6 ダッシュボードからの遷移仕様

**仕様**: カードをクリックすると`/procedures`画面に遷移し、該当の期限フィルタが自動選択される

- 「今週提出期限の手続き」カードクリック → `/procedures?deadline=thisWeek`
- 「期限超過の手続き」カードクリック → `/procedures?deadline=overdue`

**フィルタの扱い**: 遷移時は期限フィルタのみを適用し、既存のフィルタ（ステータス、手続き種別）はリセットする

### 3.3 実装が必要な機能

1. **日付ヘルパー関数の作成**（`src/app/utils/date-helpers.ts`）
   - JSTでのローカル日付を`YYYY-MM-DD`形式で取得する関数

2. **未完了ステータスの定数定義**（`src/app/types.ts`）
   - `PENDING_PROCEDURE_STATUSES`定数の追加

3. **期限別ビューの実装**（`src/app/pages/procedures/procedures.page.ts`）
   - 「今週提出期限」「来週提出期限」「期限超過」のタブ追加
   - 既存フィルタとの組み合わせ機能

4. **ダッシュボードへの集計表示**（`src/app/pages/dashboard/dashboard.page.ts`）
   - 「今週提出期限の手続き：◯件」「期限超過の手続き：◯件」のカード追加
   - クリック時の遷移機能

---

## 4. 変更対象ファイル

### 4.1 新規作成ファイル

1. **`src/app/utils/date-helpers.ts`**（新規作成）
   - JSTでのローカル日付を`YYYY-MM-DD`形式で取得するヘルパー関数

### 4.2 変更ファイル

1. **`src/app/types.ts`**
   - `PENDING_PROCEDURE_STATUSES`定数の追加（未完了ステータスの定義）

2. **`src/app/services/procedures.service.ts`**
   - `listThisWeekDeadlines()`メソッドの追加（今週提出期限の手続きを取得）
   - `listNextWeekDeadlines()`メソッドの追加（来週提出期限の手続きを取得）
   - `countThisWeekDeadlines()`メソッドの追加（今週提出期限の件数を取得）
   - `countOverdueDeadlines()`メソッドの追加（期限超過の件数を取得）

3. **`src/app/pages/procedures/procedures.page.ts`**
   - 既存の期限フィルタドロップダウンに「今週提出期限」「来週提出期限」の選択肢を追加
   - 既存フィルタとの組み合わせ機能
   - クエリパラメータからの初期化機能

4. **`src/app/pages/dashboard/dashboard.page.ts`**
   - 手続きタスク集計の統計カードを追加
   - 「今週提出期限の手続き：◯件」「期限超過の手続き：◯件」を表示
   - バッジ表示や強調表示を実装
   - クリック時の遷移機能

---

## 5. 画面仕様

### 5.1 手続き履歴一覧画面（`/procedures`）の拡張

**既存の画面構成**:
- フィルタセクション（ステータス、期限、手続き種別）
- 手続き一覧テーブル

**追加する機能**:

1. **期限フィルタの拡張**（既存の期限フィルタドロップダウンに選択肢を追加）
   - 既存の期限フィルタ（`<mat-select>`）に以下の選択肢を追加：
     - **「すべて」**: 既存の一覧表示（すべての手続き）
     - **「期限が近い（7日以内）」**: 既存の選択肢（変更なし）
     - **「今週提出期限」**: 今週の月曜日から日曜日までの期間に提出期限がある手続き（未完了のみ）
     - **「来週提出期限」**: 来週の月曜日から日曜日までの期間に提出期限がある手続き（未完了のみ）
     - **「期限切れ」**: 既存の選択肢（変更なし）
   - **既存フィルタとの組み合わせ**: 期限フィルタで取得したデータに対して、ステータスフィルタ・手続き種別フィルタをクライアント側で適用可能

2. **各ビューの表示内容**:
   - 手続き種別、対象者、事由発生日、提出期限、ステータス、提出日、担当者
   - 期限超過の手続きは赤色で強調表示
   - 今週提出期限の手続きは警告色（オレンジ色）で強調表示

### 5.2 ダッシュボード画面（`/dashboard`）の拡張

**既存の画面構成**:
- 統計カード（従業員数、月次保険料、トレンド、今月納付予定の社会保険料）
- グラフ（過去12ヶ月の推移、今月の保険料負担、年度別保険料負担）
- 最近の納付状況
- ランキング（会社負担額、本人負担額）

**追加する機能**:

1. **手続きタスク集計カード**（統計カードセクションに追加）
   - **「今週提出期限の手続き」カード**:
     - アイコン: `assignment_turned_in`（警告色）
     - 値: 「◯件」（今週提出期限の手続き件数）
     - ラベル: 「今週提出期限の手続き」
     - 件数が0件より大きい場合は警告色（オレンジ色）で表示
   - **「期限超過の手続き」カード**:
     - アイコン: `warning`（赤色）
     - 値: 「◯件」（期限超過の手続き件数）
     - ラベル: 「期限超過の手続き」
     - 件数が0件より大きい場合は警告色（赤色）で表示

2. **クリック時の動作**:
   - 「今週提出期限の手続き」カードをクリック → `/procedures?deadline=thisWeek`に遷移（期限フィルタのみ適用、既存フィルタはリセット）
   - 「期限超過の手続き」カードをクリック → `/procedures?deadline=overdue`に遷移（期限フィルタのみ適用、既存フィルタはリセット）

---

## 6. 実装方針

### 6.1 実装上の注意点

#### 6.1.1 Firestoreのコンポジットインデックス

期限別ビューのクエリでは、`deadline`の範囲条件（`>=`、`<=`）と`status`の`in`条件を組み合わせるため、**コンポジットインデックスが必須**です。

- 初回実行時にFirestoreコンソールが「このクエリにはインデックスが必要です」というリンクを表示します
- そのリンクから必要なインデックスを作成してください
- インデックスの作成には数分かかる場合があります

**インデックス作成手順**:
1. アプリを実行し、期限別ビューを表示する
2. ブラウザコンソールに表示されるインデックス作成リンクをクリック
3. Firestoreコンソールでインデックス作成を確認
4. インデックス作成完了後、再度アプリを実行して動作確認

#### 6.1.2 日付ヘルパー関数の使用

**重要**: ここで使う`YYYY-MM-DD`文字列は、既にアプリ内で使っている日付文字列生成ロジック（例: `getTodayString()`など）に**必ず合わせること**。

- 既存の日付ヘルパー関数がある場合は、それを優先して使用する
- 既存のヘルパーがない場合のみ、`src/app/utils/date-helpers.ts`に新規作成する
- `toISOString()`はタイムゾーン問題があるため、JSTでのローカル日付を直接文字列として生成する

#### 6.1.3 BehaviorSubjectの使い方

テンプレート側で`BehaviorSubject`を使用する場合：

- `.next()`をテンプレートから呼び出すのは問題ありません（既存のスタイルに合わせる）
- `.value`をテンプレートで直接参照するのは動作しますが、Angularのベストプラクティスとしては`Observable`を`async`パイプで購読する方が推奨されます
- 余裕があれば、ViewModelストリーム（例: `vm$`）を作成し、テンプレートはすべて`| async`で読むスタイルに寄せると、今後のメンテナンス性が向上します
- ただし、時間がない場合は現在の実装（`.value`を直接参照）でも十分動作します

#### 6.1.4 件数取得のコスト

現在の実装では、件数を数えるために一覧をまるごと取得する方式です：

```typescript
countThisWeekDeadlines(officeId: string): Observable<number> {
  return this.listThisWeekDeadlines(officeId).pipe(
    map(procedures => procedures.length)
  );
}
```

- 事業所あたりの手続き数がそこまで多くない前提では、MVPとして問題ありません
- 将来、本番運用で件数が大きくなりそうな場合は、以下の方向に拡張可能です：
  - Firestoreの`count()`集計クエリを使用
  - Cloud Functionsで夜間集計して`aggregates/officeProceduresSummary`のようなコレクションを使用
- 現時点では、サーバ集計に乗せ替え可能な設計として実装しておく

---

## 7. 実装手順

### Step 0: 共通基盤の修正（Phase3-14の前準備）

**目的**: Phase3-14の新規機能と既存機能が同じ日付ロジックを共有し、「今週/来週」「upcoming」「overdue」「isOverdue」の境界がすべて同じ基準になるようにする。

#### Step 0-1: 日付ヘルパー関数の作成

**対象ファイル**: `src/app/utils/date-helpers.ts`（新規作成）

**実装内容**:

```typescript
/**
 * YYYY-MM-DD形式の文字列をローカル日付（Dateオブジェクト）に変換
 * toISOString()のタイムゾーン問題を回避するため、ローカル時刻として解釈
 * 
 * @param value YYYY-MM-DD形式の文字列
 * @returns Dateオブジェクト（ローカル時刻）
 */
export function ymdToDateLocal(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * DateオブジェクトをYYYY-MM-DD形式の文字列に変換（ローカル時刻）
 * toISOString()のタイムゾーン問題を回避するため、ローカル時刻から直接文字列を生成
 * 
 * @param date Dateオブジェクト
 * @returns YYYY-MM-DD形式の文字列（例: "2025-12-06"）
 */
export function dateToYmdLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * ローカルタイム（JST想定）で今日のYYYY-MM-DD形式の文字列を取得
 * 
 * @returns YYYY-MM-DD形式の文字列（例: "2025-12-06"）
 */
export function todayYmd(): string {
  return dateToYmdLocal(new Date());
}

/**
 * 指定した日付から指定日数後の日付をYYYY-MM-DD形式の文字列として取得
 * 
 * @param dateStr YYYY-MM-DD形式の文字列
 * @param days 加算する日数（負の値も可）
 * @returns YYYY-MM-DD形式の文字列
 */
export function addDays(dateStr: string, days: number): string {
  const date = ymdToDateLocal(dateStr);
  date.setDate(date.getDate() + days);
  return dateToYmdLocal(date);
}

/**
 * 指定した日付が属する週の月曜日と日曜日をYYYY-MM-DD形式の文字列として取得
 * 週の開始日は月曜日とする
 * 
 * @param date 基準となる日付（省略時は今日）
 * @returns 週の月曜日と日曜日（YYYY-MM-DD形式）
 */
export function getWeekRangeMonToSun(date: Date = new Date()): { startYmd: string; endYmd: string } {
  const dayOfWeek = date.getDay(); // 0=日曜日, 1=月曜日, ..., 6=土曜日
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 日曜日の場合は-6、それ以外は1-dayOfWeek
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  
  const startYmd = dateToYmdLocal(monday);
  const endYmd = addDays(startYmd, 6);
  
  return { startYmd, endYmd };
}

/**
 * 今週の月曜日をYYYY-MM-DD形式の文字列として取得
 * 週の開始日は月曜日とする
 * 
 * @returns YYYY-MM-DD形式の文字列
 */
export function getThisWeekMonday(): string {
  return getWeekRangeMonToSun().startYmd;
}

/**
 * 来週の月曜日をYYYY-MM-DD形式の文字列として取得
 * 
 * @returns YYYY-MM-DD形式の文字列
 */
export function getNextWeekMonday(): string {
  const thisWeekMonday = getThisWeekMonday();
  return addDays(thisWeekMonday, 7);
}

/**
 * 指定した週の日曜日をYYYY-MM-DD形式の文字列として取得
 * 
 * @param mondayStr 週の月曜日（YYYY-MM-DD形式）
 * @returns YYYY-MM-DD形式の文字列
 */
export function getSundayOfWeek(mondayStr: string): string {
  return addDays(mondayStr, 6);
}
```

#### Step 0-2: 既存コードの日付処理を修正

**対象ファイル**: `src/app/utils/procedure-deadline-calculator.ts`

**修正内容**: `calculateDeadline`関数の最後の行を修正

```typescript
// 修正前
return deadline.toISOString().substring(0, 10);

// 修正後
import { dateToYmdLocal } from './date-helpers';
return dateToYmdLocal(deadline);
```

**対象ファイル**: `src/app/services/procedures.service.ts`

**修正内容**: `listByDeadline`メソッド内の日付生成を修正

```typescript
// 修正前
const now = new Date().toISOString().substring(0, 10);
const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

// 修正後
import { todayYmd, addDays } from '../utils/date-helpers';
const now = todayYmd();
const sevenDaysLater = addDays(now, 7);
```

**対象ファイル**: `src/app/pages/procedures/procedures.page.ts`

**修正内容**: `isOverdue`メソッド内の日付生成を修正

```typescript
// 修正前
const today = new Date().toISOString().substring(0, 10);

// 修正後
import { todayYmd } from '../../utils/date-helpers';
const today = todayYmd();
```

#### Step 0-3: 未完了ステータス定数の作成と既存コードへの適用

**対象ファイル**: `src/app/types.ts`

**実装内容**:

`ProcedureStatus`型の定義の下に追加：

```typescript
// 未完了ステータスの定義（期限管理の対象となるステータス）
export const PENDING_PROCEDURE_STATUSES: ProcedureStatus[] = [
  'not_started',
  'in_progress',
  'rejected'
] as const;
```

**対象ファイル**: `src/app/services/procedures.service.ts`

**修正内容**: `listByDeadline`メソッド内のハードコードされた未完了ステータスを定数に置き換え

```typescript
// 修正前
where('status', 'in', ['not_started', 'in_progress', 'rejected']),

// 修正後
import { PENDING_PROCEDURE_STATUSES } from '../types';
where('status', 'in', PENDING_PROCEDURE_STATUSES),
```

**対象ファイル**: `src/app/types.ts`

**実装内容**:

`ProcedureStatus`型の定義の下に追加：

```typescript
// 未完了ステータスの定義（期限管理の対象となるステータス）
export const PENDING_PROCEDURE_STATUSES: ProcedureStatus[] = [
  'not_started',
  'in_progress',
  'rejected'
] as const;
```

### Step 1: ProceduresServiceの拡張

**対象ファイル**: `src/app/services/procedures.service.ts`

**実装内容**:

1. **「今週提出期限」を取得するメソッド**（`listThisWeekDeadlines()`）
   ```typescript
   listThisWeekDeadlines(officeId: string): Observable<SocialInsuranceProcedure[]> {
     const ref = this.collectionPath(officeId);
     
     // 今週の月曜日と日曜日を取得
     const thisWeekMonday = getThisWeekMonday();
     const thisWeekSunday = getSundayOfWeek(thisWeekMonday);
     
     const q = query(
       ref,
       where('deadline', '>=', thisWeekMonday),
       where('deadline', '<=', thisWeekSunday),
       where('status', 'in', PENDING_PROCEDURE_STATUSES),
       orderBy('deadline', 'asc')
     );
     
     return collectionData(q, { idField: 'id' }) as Observable<SocialInsuranceProcedure[]>;
   }
   ```

2. **「来週提出期限」を取得するメソッド**（`listNextWeekDeadlines()`）
   ```typescript
   listNextWeekDeadlines(officeId: string): Observable<SocialInsuranceProcedure[]> {
     const ref = this.collectionPath(officeId);
     
     // 来週の月曜日と日曜日を取得
     const nextWeekMonday = getNextWeekMonday();
     const nextWeekSunday = getSundayOfWeek(nextWeekMonday);
     
     const q = query(
       ref,
       where('deadline', '>=', nextWeekMonday),
       where('deadline', '<=', nextWeekSunday),
       where('status', 'in', PENDING_PROCEDURE_STATUSES),
       orderBy('deadline', 'asc')
     );
     
     return collectionData(q, { idField: 'id' }) as Observable<SocialInsuranceProcedure[]>;
   }
   ```

3. **「今週提出期限」の件数を取得するメソッド**（`countThisWeekDeadlines()`）
   ```typescript
   countThisWeekDeadlines(officeId: string): Observable<number> {
     return this.listThisWeekDeadlines(officeId).pipe(
       map(procedures => procedures.length)
     );
   }
   ```
   
   **注意**: 現在の実装では、件数を数えるために一覧をまるごと取得する方式です。事業所あたりの手続き数がそこまで多くない前提では、MVPとして問題ありません。
   
   **将来の拡張**: 本番運用で件数が大きくなりそうな場合は、以下の方向に拡張可能です：
   - Firestoreの`count()`集計クエリを使用
   - Cloud Functionsで夜間集計して`aggregates/officeProceduresSummary`のようなコレクションを使用
   - 現時点では、サーバ集計に乗せ替え可能な設計として実装しておく

4. **「期限超過」の件数を取得するメソッド**（`countOverdueDeadlines()`）
   ```typescript
   countOverdueDeadlines(officeId: string): Observable<number> {
     return this.listByDeadline(officeId, 'overdue').pipe(
       map(procedures => procedures.length)
     );
   }
   ```
   
   **注意**: `countThisWeekDeadlines()`と同様、件数を数えるために一覧をまるごと取得する方式です。将来の拡張については上記を参照してください。

**必要なインポート**: 既存のインポートに以下を追加
```typescript
import { map } from 'rxjs/operators';
import { PENDING_PROCEDURE_STATUSES } from '../types';
import { getThisWeekMonday, getNextWeekMonday, getSundayOfWeek } from '../utils/date-helpers';
```

**重要**: Firestoreのコンポジットインデックスが必要です。詳細は「6.1.1 Firestoreのコンポジットインデックス」を参照してください。

### Step 2: 手続き履歴一覧画面の拡張

**対象ファイル**: `src/app/pages/procedures/procedures.page.ts`

**実装方針**: 既存の`deadlineFilter$`を拡張して「今週/来週」を追加する方式を採用します。これにより、期限フィルタが1本にまとまり、既存UXとの整合性が高くなります。

**実装内容**:

1. **deadlineFilter$の型を拡張**

   ```typescript
   // 修正前
   readonly deadlineFilter$ = new BehaviorSubject<'all' | 'upcoming' | 'overdue'>('all');
   
   // 修正後
   readonly deadlineFilter$ = new BehaviorSubject<'all' | 'upcoming' | 'overdue' | 'thisWeek' | 'nextWeek'>('all');
   ```

2. **procedures$のロジックを拡張**

   ```typescript
   readonly procedures$ = combineLatest([
     this.currentOffice.officeId$,
     this.statusFilter$,
     this.deadlineFilter$,
     this.procedureTypeFilter$
   ]).pipe(
     switchMap(([officeId, statusFilter, deadlineFilter, procedureTypeFilter]) => {
       if (!officeId) return of([]);

       let procedures$: Observable<SocialInsuranceProcedure[]>;

       // 期限フィルタに応じて適切なメソッドを呼び出す
       if (deadlineFilter === 'upcoming') {
         procedures$ = this.proceduresService.listByDeadline(officeId, 'upcoming');
       } else if (deadlineFilter === 'overdue') {
         procedures$ = this.proceduresService.listByDeadline(officeId, 'overdue');
       } else if (deadlineFilter === 'thisWeek') {
         procedures$ = this.proceduresService.listThisWeekDeadlines(officeId);
       } else if (deadlineFilter === 'nextWeek') {
         procedures$ = this.proceduresService.listNextWeekDeadlines(officeId);
       } else {
         // 'all'の場合は既存のlistメソッドを使用
         const filters: { status?: ProcedureStatus; procedureType?: ProcedureType } = {};
         if (statusFilter !== 'all') {
           filters.status = statusFilter;
         }
         if (procedureTypeFilter !== 'all') {
           filters.procedureType = procedureTypeFilter;
         }
         procedures$ = this.proceduresService.list(officeId, Object.keys(filters).length > 0 ? filters : undefined);
         return procedures$;
       }

       // 期限フィルタが適用されている場合は、クライアント側でステータス・種別フィルタを適用
       return procedures$.pipe(
         map((procedures) => {
           let filtered = procedures;
           if (statusFilter !== 'all') {
             filtered = filtered.filter((p) => p.status === statusFilter);
           }
           if (procedureTypeFilter !== 'all') {
             filtered = filtered.filter((p) => p.procedureType === procedureTypeFilter);
           }
           return filtered;
         })
       );
     })
   );
   ```

3. **テンプレートの期限フィルタセレクトを拡張**

   ```html
   <mat-form-field appearance="outline">
     <mat-label>期限</mat-label>
     <mat-select [value]="deadlineFilter$.value" (selectionChange)="deadlineFilter$.next($event.value)">
       <mat-option value="all">すべて</mat-option>
       <mat-option value="upcoming">期限が近い（7日以内）</mat-option>
       <mat-option value="thisWeek">今週提出期限</mat-option>
       <mat-option value="nextWeek">来週提出期限</mat-option>
       <mat-option value="overdue">期限切れ</mat-option>
     </mat-select>
   </mat-form-field>
   ```

4. **クエリパラメータからの初期化**（オプション）

   ```typescript
   import { ActivatedRoute } from '@angular/router';
   
   // 既存のprocedures.page.tsがconstructorベースかinject()ベースかに応じて、以下のいずれかのスタイルを使用
   
   // パターンA: inject()スタイル（既存コードがinject()を使用している場合）
   private readonly route = inject(ActivatedRoute);
   
   constructor() {
     // ... 既存のコンストラクタ処理 ...
     
     // クエリパラメータから期限フィルタを初期化
     this.route.queryParams.subscribe(params => {
       if (params['deadline'] === 'thisWeek') {
         this.deadlineFilter$.next('thisWeek');
         // 既存フィルタをリセット（オプション）
         this.statusFilter$.next('all');
         this.procedureTypeFilter$.next('all');
       } else if (params['deadline'] === 'overdue') {
         this.deadlineFilter$.next('overdue');
         this.statusFilter$.next('all');
         this.procedureTypeFilter$.next('all');
       } else if (params['deadline'] === 'nextWeek') {
         this.deadlineFilter$.next('nextWeek');
         this.statusFilter$.next('all');
         this.procedureTypeFilter$.next('all');
       }
     });
   }
   
   // パターンB: constructor引数スタイル（既存コードがconstructor引数を使用している場合）
   // constructor(
   //   // ... 既存のコンストラクタ引数 ...
   //   private readonly route: ActivatedRoute
   // ) {
   //   // 上記と同じ処理
   // }
   ```
   
   **注意**: 実装時は既存の`procedures.page.ts`のスタイル（`inject()`または`constructor`引数）に合わせて選択してください。

**注意**: `proceduresWithNames$`は既存の実装をそのまま使用できます（変更不要）。

### Step 3: ダッシュボード画面の拡張

**対象ファイル**: `src/app/pages/dashboard/dashboard.page.ts`

**実装方針**: 既存のDashboardは`signal`を多用しているため、Observableを`toSignal`でsignalに変換して既存スタイルに統一します。

**実装内容**:

1. **必要なインポートの追加**

   ```typescript
   import { toSignal } from '@angular/core/rxjs-interop';
   import { ProceduresService } from '../../services/procedures.service';
   import { Router } from '@angular/router';
   ```

2. **手続きタスク集計のObservableとsignalの定義**

   ```typescript
   // Observable定義
   readonly thisWeekDeadlinesCount$ = this.officeId$.pipe(
     switchMap((officeId) => {
       if (!officeId) {
         return of(0);
       }
       return this.proceduresService.countThisWeekDeadlines(officeId);
     })
   );
   
   readonly overdueDeadlinesCount$ = this.officeId$.pipe(
     switchMap((officeId) => {
       if (!officeId) {
         return of(0);
       }
       return this.proceduresService.countOverdueDeadlines(officeId);
     })
   );
   
   // signalに変換（既存スタイルに統一）
   readonly thisWeekDeadlinesCount = toSignal(thisWeekDeadlinesCount$, { initialValue: 0 });
   readonly overdueDeadlinesCount = toSignal(this.overdueDeadlinesCount$, { initialValue: 0 });
   ```

3. **ProceduresServiceのインジェクト**

   ```typescript
   private readonly proceduresService = inject(ProceduresService);
   private readonly router = inject(Router);
   ```

2. **テンプレートに統計カードを追加**（既存の統計カードセクションに追加）

   ```html
   <mat-card 
     class="stat-card" 
     [class.warning]="thisWeekDeadlinesCount() > 0"
     (click)="navigateToProcedures('thisWeek')"
     style="cursor: pointer;"
   >
     <div class="stat-icon" style="background: #fff3e0;">
       <mat-icon style="color: #ff9800;">assignment_turned_in</mat-icon>
     </div>
     <div class="stat-content">
       <h3>今週提出期限の手続き</h3>
       <p class="stat-value" [style.color]="thisWeekDeadlinesCount() > 0 ? '#ff9800' : '#333'">
         {{ thisWeekDeadlinesCount() }}件
       </p>
       <p class="stat-label">対応が必要</p>
     </div>
   </mat-card>
   
   <mat-card 
     class="stat-card" 
     [class.danger]="overdueDeadlinesCount() > 0"
     (click)="navigateToProcedures('overdue')"
     style="cursor: pointer;"
   >
     <div class="stat-icon" style="background: #fef2f2;">
       <mat-icon style="color: #b91c1c;">warning</mat-icon>
     </div>
     <div class="stat-content">
       <h3>期限超過の手続き</h3>
       <p class="stat-value" [style.color]="overdueDeadlinesCount() > 0 ? '#b91c1c' : '#333'">
         {{ overdueDeadlinesCount() }}件
       </p>
       <p class="stat-label">緊急対応が必要</p>
     </div>
   </mat-card>
   ```

3. **クリック時の動作**（`router`を使用）

   ```typescript
   navigateToProcedures(deadline: 'thisWeek' | 'overdue' | 'nextWeek'): void {
     this.router.navigate(['/procedures'], { queryParams: { deadline } });
   }
   ```

4. **スタイルの追加**（警告表示用）
   ```typescript
   styles: [
     `
     // ... 既存のスタイル ...
     
     .stat-card.warning {
       border: 2px solid #ff9800;
     }
     
     .stat-card.danger {
       border: 2px solid #b91c1c;
     }
     
     .stat-card.warning:hover,
     .stat-card.danger:hover {
       box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
     }
     `
   ]
   ```

**必要なインポート**: 
```typescript
import { ProceduresService } from '../../services/procedures.service';
import { Router } from '@angular/router'; // オプション
```

### Step 4: ルーティングの拡張

**対象ファイル**: `src/app/pages/procedures/procedures.page.ts`

**実装内容**:

クエリパラメータから期限フィルタを初期化する（Step 2の実装に含まれています）

**注意**: Step 2で既に実装済みのため、ここでは説明のみです。

---

## 8. テスト観点

### 8.0 Step 0（共通基盤の修正）のテスト

- [ ] **日付ヘルパー関数の動作確認**
  - テスト手順:
    1. `todayYmd()`が正しく今日の日付（YYYY-MM-DD形式）を返すことを確認
    2. `getThisWeekMonday()`が今週の月曜日を正しく返すことを確認
    3. `getNextWeekMonday()`が来週の月曜日を正しく返すことを確認
    4. `getWeekRangeMonToSun()`が正しい週の範囲を返すことを確認

- [ ] **既存コードの修正確認**
  - テスト手順:
    1. `procedure-deadline-calculator.ts`の`calculateDeadline`が正しく動作することを確認
    2. `procedures.service.ts`の`listByDeadline`が正しく動作することを確認
    3. `procedures.page.ts`の`isOverdue`が正しく動作することを確認

- [ ] **PENDING_PROCEDURE_STATUSES定数の適用確認**
  - テスト手順:
    1. `procedures.service.ts`の`listByDeadline`が`PENDING_PROCEDURE_STATUSES`を使用していることを確認
    2. 未完了ステータスの手続きのみが表示されることを確認

---

### 8.1 期限フィルタの拡張テスト

- [ ] **「今週提出期限」フィルタの表示**
  - テスト手順:
    1. `/procedures`画面を開く
    2. 期限フィルタで「今週提出期限」を選択
    3. 今週の月曜日から日曜日までの期間に提出期限がある手続きのみが表示されることを確認
    4. 提出済の手続きは表示されないことを確認

- [ ] **「来週提出期限」フィルタの表示**
  - テスト手順:
    1. 期限フィルタで「来週提出期限」を選択
    2. 来週の月曜日から日曜日までの期間に提出期限がある手続きのみが表示されることを確認
    3. 提出済の手続きは表示されないことを確認

- [ ] **「期限切れ」フィルタの表示**
  - テスト手順:
    1. 期限フィルタで「期限切れ」を選択
    2. 提出期限を過ぎて未完了の手続きのみが表示されることを確認
    3. 提出済の手続きは表示されないことを確認

- [ ] **既存フィルタとの組み合わせ**
  - テスト手順:
    1. 期限フィルタで「今週提出期限」を選択
    2. ステータスフィルタで「準備中」を選択
    3. 今週提出期限かつ準備中の手続きのみが表示されることを確認
    4. 手続き種別フィルタで「資格取得届」を選択
    5. 今週提出期限かつ準備中かつ資格取得届の手続きのみが表示されることを確認

- [ ] **既存の期限フィルタ（期限が近い、期限切れ）の動作確認**
  - テスト手順:
    1. 期限フィルタで「期限が近い（7日以内）」を選択
    2. 既存の動作が正常に機能することを確認
    3. 期限フィルタで「期限切れ」を選択
    4. 既存の動作が正常に機能することを確認

### 8.2 ダッシュボードの集計表示のテスト

- [ ] **「今週提出期限の手続き」カードの表示**
  - テスト手順:
    1. `/dashboard`画面を開く
    2. 「今週提出期限の手続き」カードが表示されることを確認
    3. 件数が正しく表示されることを確認
    4. 件数が0件より大きい場合は警告色で表示されることを確認

- [ ] **「期限超過の手続き」カードの表示**
  - テスト手順:
    1. 「期限超過の手続き」カードが表示されることを確認
    2. 件数が正しく表示されることを確認
    3. 件数が0件より大きい場合は警告色で表示されることを確認

- [ ] **ダッシュボードからの遷移**
  - テスト手順:
    1. 「今週提出期限の手続き」カードをクリック
    2. `/procedures?deadline=thisWeek`に遷移し、期限フィルタで「今週提出期限」が選択されていることを確認
    3. 既存フィルタ（ステータス、手続き種別）がリセットされていることを確認
    4. 「期限超過の手続き」カードをクリック
    5. `/procedures?deadline=overdue`に遷移し、期限フィルタで「期限切れ」が選択されていることを確認
    6. 既存フィルタ（ステータス、手続き種別）がリセットされていることを確認

### 8.3 既存機能の回帰テスト

- [ ] **手続き履歴管理機能が正常に動作する**
  - テスト手順:
    1. 手続きの登録・編集・削除が正常に動作することを確認
    2. 既存のフィルタ機能が正常に動作することを確認

- [ ] **ダッシュボードの既存機能が正常に動作する**
  - テスト手順:
    1. 既存の統計カードが正常に表示されることを確認
    2. グラフが正常に表示されることを確認

---

## 10. 実装完了の判定基準

Phase3-14完了の判定基準：

1. ✅ `src/app/utils/date-helpers.ts`が作成され、JSTでのローカル日付を取得するヘルパー関数が実装されている
2. ✅ `src/app/utils/procedure-deadline-calculator.ts`の`calculateDeadline`関数が日付ヘルパーを使用するように修正されている
3. ✅ `src/app/services/procedures.service.ts`の`listByDeadline`メソッドが日付ヘルパーを使用するように修正されている
4. ✅ `src/app/pages/procedures/procedures.page.ts`の`isOverdue`メソッドが日付ヘルパーを使用するように修正されている
5. ✅ `src/app/types.ts`に`PENDING_PROCEDURE_STATUSES`定数が追加されている
6. ✅ `src/app/services/procedures.service.ts`の`listByDeadline`メソッドが`PENDING_PROCEDURE_STATUSES`定数を使用するように修正されている
7. ✅ `src/app/services/procedures.service.ts`に`listThisWeekDeadlines()`、`listNextWeekDeadlines()`、`countThisWeekDeadlines()`、`countOverdueDeadlines()`メソッドが追加されている
8. ✅ 「今週提出期限」は今週の月曜日から日曜日までの期間に提出期限がある手続きとして定義されている
9. ✅ 「来週提出期限」は来週の月曜日から日曜日までの期間に提出期限がある手続きとして定義されている
10. ✅ `src/app/pages/procedures/procedures.page.ts`の`deadlineFilter$`が拡張され、「今週提出期限」「来週提出期限」が追加されている
11. ✅ 期限フィルタで未完了ステータス（`PENDING_PROCEDURE_STATUSES`を使用）の手続きのみが表示される
12. ✅ 期限フィルタと既存フィルタ（ステータス、手続き種別）が組み合わせ可能である
13. ✅ 期限超過の手続きは赤色で強調表示される
14. ✅ 今週提出期限の手続きは警告色（オレンジ色）で強調表示される
15. ✅ `src/app/pages/dashboard/dashboard.page.ts`に「今週提出期限の手続き：◯件」「期限超過の手続き：◯件」の集計が表示される（signalスタイルで実装）
16. ✅ 件数が0件より大きい場合は警告色で表示される
17. ✅ ダッシュボードのカードをクリックすると`/procedures?deadline=thisWeek`または`/procedures?deadline=overdue`に遷移し、該当の期限フィルタが自動選択される
18. ✅ 遷移時に既存フィルタ（ステータス、手続き種別）がリセットされる
19. ✅ 期限なし（`deadline`が`null`または空文字）の手続きは期限フィルタには表示されない
20. ✅ 既存の機能（手続き履歴管理、ダッシュボードの既存機能）が正常に動作する
21. ✅ テスト観点のチェックリストの主要項目（8.1〜8.3）がすべてクリアされている

---

以上

