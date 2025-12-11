# 標準報酬・等級まわり大規模改良方針書

## 改訂履歴
- 2025年1月: 初版作成
- 2025年1月: 追加方針反映（monthlyWage deprecated、decisionYearMonth、同期ポリシー、エラー処理、CSV仕様）
- 2025年1月: Phase3〜6のスコープ整理、Phase6追加（マイページ・従業員削除ポリシー）、Phase3に範囲外セクション追加
- 2025年1月: Phase2.5追加（月次保険料計算ロジックの厳密化：50銭ルール、取得／喪失月の扱い、納入告知額の計算）

---

## 0. ゴール（最終的な世界観）

### 目指す設計

**報酬月額（実際の給与）と標準報酬月額を明確に分離し、健保と厚年で別々の標準報酬を扱えるようにする。**

### 具体的な設計方針

1. **報酬月額と標準報酬の分離**
   - **実際の給与**: `payrollSettings.insurableMonthlyWage`（報酬月額）
   - **健保用標準報酬**: `healthStandardMonthly` / `healthGrade`
   - **厚年用標準報酬**: `pensionStandardMonthly` / `pensionGrade`
   - **介護保険**: 原則「健保の標準報酬」を使用（40〜64歳のみ）

2. **等級表マスタのフル活用**
   - 報酬月額を入力すると、健保マスタ・厚年マスタの `bands` から自動で等級・標準報酬を決定
   - ユーザーが手動で上書き可能（ハイブリッド運用）

3. **標準報酬履歴の分離**
   - `insuranceKind: 'health' | 'pension'` を持たせる
   - 1レコード = 1保険種別
   - 健保と厚年で異なる標準報酬になった場合は、行も2行になる

4. **全機能の改修**
   - 保険料計算・シミュレーター・CSV・書類生成・異常チェック
   - すべて「健保と厚年は別々の標準報酬で動く」前提に改修

5. **既存データへの配慮**
   - **既存データへの配慮はゼロでOK**
   - Firestore のスキーマを変更しても良い
   - CSVの列構成を変更しても良い
   - 後方互換や段階的移行は考えなくてよい
   - `monthlyWage` は**完全に "遺物（deprecated）"** として扱い、計算ロジックや正のデータモデルには一切使わない

---

## 1. データモデルの最終形イメージ

### 1-1. Employee（抜粋）

```typescript
export interface Employee {
  // ... 基本情報 ...

  // 実際の給与（標準報酬を決める材料）
  payrollSettings?: {
    payType: PayrollPayType;
    payCycle: PayrollPayCycle;
    insurableMonthlyWage: number | null; // ← 報酬月額（実際の給与）
    note?: string | null;
  };

  // 健康保険
  healthGrade?: number | null;
  healthStandardMonthly?: number | null;
  healthGradeSource?: GradeDecisionSource; 
  // 'auto_from_salary' | 'manual_override' | 'imported' など

  // 厚生年金
  pensionGrade?: number | null;
  pensionStandardMonthly?: number | null;
  pensionGradeSource?: GradeDecisionSource;

  // DEPRECATED: 旧設計の名残。計算には使わない。Firestore ルール・CSV・フォーム UI からも事実上排除する。
  monthlyWage?: number;
}
```

**ポイント:**
- 「計算で使う標準報酬」は `healthStandardMonthly` / `pensionStandardMonthly` の2本に一本化する
- `monthlyWage` は**完全に deprecated** として扱い、計算ロジックや正のデータモデルには一切使わない
- Firestore ルール・CSV インポート／エクスポート・フォーム UI からも事実上排除する

### 1-2. 標準報酬履歴（StandardRewardHistory）

現状は共通1本しか持てていないので、保険種別を持たせた形に変更する。

```typescript
export type InsuranceKind = 'health' | 'pension';

export interface StandardRewardHistory {
  id: string;
  employeeId: string;
  insuranceKind: InsuranceKind; // ★ 追加：健保 or 厚年
  decisionYearMonth: YearMonthString;
  appliedFromYearMonth: YearMonthString;
  standardMonthlyReward: number; // 標準報酬月額（この保険種別用）
  grade?: number;                // 等級（あれば）
  decisionKind: StandardRewardDecisionKind; // 算定／月変／賞与など
  note?: string;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  createdByUserId?: string;
  updatedByUserId?: string;
}
```

**運用イメージ:**
- 健保の月変 → `insuranceKind: 'health'` の履歴を1本追加
- 厚年の月変 → `insuranceKind: 'pension'` の履歴を1本追加
- 実務的には「同じ金額・同じ年月で2本立て」になるケースも多いが、システム的には別レコードで持つ前提

**Employee との同期ポリシー:**
- `Employee` は「現在有効な標準報酬」のスナップショット
- `StandardRewardHistory` は「過去も含めた全履歴」のログ
- 編集起点がどちらであっても、最終的に `Employee` と履歴が一致するようにする
- 詳細は Phase 3 のセクションを参照

### 1-3. マスタ（HealthRateTable / PensionRateTable）

**現状のままで十分:**
- `bands: StandardRewardBand[]` に `grade` / `lowerLimit` / `upperLimit` / `standardMonthly` が入っている
- これを使って「報酬月額 → 等級＆標準報酬」を決める

**介護保険の扱い:**
- `CareRateTable.careRate` しか無いので、標準報酬は常に `healthStandardMonthly` を使う
- 40〜64歳のみ介護保険料を乗せる仕様に固定

---

## 2. 実装フェーズ分け（順番）

CSV・書類・異常チェックまで全部やる前提で、「どこを先にいじると安全か」でフェーズを切る。

### Phase 1：コアモデル & 保険料計算ロジックの全面改修

**目的:** 内部の「計算の根っこ」を正しい世界観にしてしまう。

#### やること

##### 1. `types.ts` の修正

- **Employee**: `healthStandardMonthly` / `pensionStandardMonthly` / `GradeSource` を「計算で使う前提の正式フィールド」として整える
- **StandardRewardHistory**: `insuranceKind` と `grade` を追加
- 必要なら `InsuranceKind` enum/union を定義

##### 2. 標準報酬決定ユーティリティ追加

**新規ファイル**: `src/app/utils/standard-reward-resolver.ts`

```typescript
// 例
resolveHealthStandardFromSalary(
  salary: number,
  healthTable: HealthRateTable
): { grade: number; standardMonthly: number } | null;

resolvePensionStandardFromSalary(
  salary: number,
  pensionTable: PensionRateTable
): { grade: number; standardMonthly: number } | null;
```

**内部処理:**
- `StandardRewardBand[]` を走査して `lowerLimit <= salary <= upperLimit` の行を返す
- 範囲外（頭打ち）もここで処理

**失敗時の挙動:**
- マスタが見つからない、もしくは `bands` にマッチする範囲がない場合は `null` を返す
- フォーム側では `null` が返された場合、対象保険種別の等級・標準報酬フィールドは空欄のままにする
- 「マスタから標準報酬を自動決定できませんでした（対象年月のマスタが無い／報酬額が範囲外など）」というバリデーションエラーメッセージを表示
- この状態では保存ボタンを無効化するか、少なくともユーザーが「手動で値を入れ直す」かどうか判断できるような UX を想定
- `premium-calculator` 側では、`employee.healthStandardMonthly` / `pensionStandardMonthly` が `null` の場合、該当保険種別についてはその月の保険料計算を**実行しない（0円を勝手に計算しない）**方針にする
- `DataQualityService` では、標準報酬が `null` の状態が続いている場合、「標準報酬未決定」系の issue として検知する

##### 3. `premium-calculator.ts` の大改修

**関数**: `calculateMonthlyPremiumForEmployee()` などを全面変更

**変更内容:**
- 健保計算 → `employee.healthStandardMonthly` を使用
- 厚年計算 → `employee.pensionStandardMonthly` を使用
- 介護計算 → `employee.healthStandardMonthly` を使用
- `MonthlyPremium` のスナップショットにも、それぞれの標準報酬を保存

##### 4. `masters.service.ts` 側の影響確認

- `getRatesForYearMonth()` のインターフェースはそのままでOK
- ただし後のフェーズで従業員フォームからも呼ぶので、使いやすい戻り値（`healthTable` / `pensionTable` / `careTable`）になっているか確認

#### Phase 1 の時点で壊れていてもよいもの

- 従業員フォームで `healthStandardMonthly` がまだ入っていない → 保険料計算は動かなくてOK（後のフェーズで埋める）
- シミュレーター・CSV・書類生成・履歴はこの段階では一旦「旧仕様のまま」でOK

**ここで「内部の正しい入口」を先に作っておくと、後のフェーズで Employee を整えた瞬間、全部一斉に正しくなる。**

---

### Phase 2：従業員フォーム & シミュレーターでの自動等級決定

**目的:** ユーザー入力から正しい標準報酬が落ちてくるようにする。

#### 対象ファイル

- `employees/employee-form-dialog.component.ts`
- `employees/employees.page.ts`（一覧表示）
- `simulator/simulator.page.ts`
- 必要なら `my-page.page.ts`（社員ポータル表示）

#### やること

##### 1. フォーム項目の役割整理

- `payrollInsurableMonthlyWage` … 報酬月額（ユーザー入力）
- `healthGrade` / `healthStandardMonthly` … 健保の標準報酬
- `pensionGrade` / `pensionStandardMonthly` … 厚年の標準報酬
- `monthlyWage` はフォーム上で非表示にしてもOK（裏で同期してもいいし、完全に捨ててもいい）

##### 2. 「報酬月額 → 等級＆標準報酬」の自動計算

**従業員フォームで報酬月額を変更したとき:**

1. **標準報酬決定年月の入力**
   - フォームに `decisionYearMonth`（標準報酬決定年月）入力欄を追加する（例: `2025-07`）
   - デフォルトでは「今日の年月」を初期値とするが、ユーザーが変更可能
   - この `decisionYearMonth` を使って、どの年月のマスタを使うかを決定する

2. **マスタの取得**
   - `MastersService.getRatesForYearMonth()` に `decisionYearMonth` を `targetYearMonth` として渡し、該当する `HealthRateTable` / `PensionRateTable` を取得

3. **等級・標準報酬の決定**
   - Phase1で作った resolver を使って
     - `healthGrade` / `healthStandardMonthly`
     - `pensionGrade` / `pensionStandardMonthly`
     を決定

4. **フォームへの反映**
   - フォームに自動反映
   - `healthGradeSource = 'auto_from_salary'` 等をセット

**シミュレーターでも同じ流れを採用**

**標準報酬履歴との関係:**
- 将来的には `decisionYearMonth` と `StandardRewardHistory.decisionYearMonth` を一致させるのが基本方針
- Phase 3 で履歴を追加する際も、この `decisionYearMonth` を使用する

##### 3. 手動上書きの扱い

- ユーザーが等級・標準報酬欄を手で変更したら `GradeSource = 'manual_override'` に変更
- UI上は「自動入力（マスタから計算）」と「手動修正」が共存する

##### 4. 保存ロジックの更新

- `EmployeesService.save()` が `healthStandardMonthly` / `pensionStandardMonthly` もきちんと保存するようにする
- `monthlyWage` は保存しない（deprecated フィールドとして扱う）

#### このフェーズ完了時点で達成されること

- 従業員1人分のデータを見れば、報酬月額・健保用標準報酬＆等級・厚年用標準報酬＆等級がすべて揃う
- `premium-calculator` は Phase1で変えてあるので、月次保険料計算も新ロジックで動き始める

---

### Phase 2.5：月次保険料計算ロジックの厳密化

**目的:** 月次保険料計算ロジックを正式ルールに沿って厳密化し、「50銭ルール」「月末退職／月中退職」「取得／喪失月」の扱いを明文化したうえで実装する。また、月次保険料ページの表示内容（行レベル・フッター集計）を「納入告知額」との関係が分かりやすい形に整理する。

#### 前提条件

Phase2.5 では、既に実装済みの以下を前提とする：
- 標準報酬・等級の分離（健康保険／厚生年金で別々に管理）
- 保険料率マスタ（都道府県・事業所種別・対象年月ごとの料率管理）

#### 対象ファイル

- `utils/premium-calculator.ts`（保険料計算ロジック）
- `pages/premiums/monthly/monthly-premiums.page.ts`（月次保険料ページ）
- `services/monthly-premiums.service.ts`（月次保険料サービス）

#### やること

##### 1. 保険料の対象となる従業員の判定ロジック確立

**基本ルール（取得・喪失）:**
- 取得日が属する月から、その月分の保険料が発生する
- 喪失日が属する月の**前月分まで**保険料が発生する
  - → 喪失月そのものの保険料は発生しない

**具体例（2025年3月分の月次保険料）:**
- 取得日が 2025/3/10 → 3月分から保険料発生（3月は対象）
- 退職・喪失日が 2025/3/20 → 喪失月が3月なので、3月分の保険料は発生しない（2月まで）
- 退職日が 2025/3/31 で喪失日が 2025/4/1 扱い → 喪失月は4月なので、3月分は対象

**実装イメージ:**
- 対象年月 `targetYm`（例: 2025-03）を決める
- 各社員ごとに、健康保険・厚生年金それぞれについて
  - `acquisitionDate`（資格取得日）
  - `lossDate`（資格喪失日 or null）
  を参照し、
  - 「`acquisitionDate` の属する年月 <= `targetYm`」かつ
  - 「`lossDate` が null または `lossDate` の属する年月 > `targetYm`」
  を満たす場合に、その保険の対象者として月次保険料計算に含める
- この判定を、健康保険（＋介護保険）と厚生年金で**別々に行う**（Phase1/2 で分離した標準報酬・等級を活かす）

##### 2. 計算対象・料率の扱い

**2-1. 料率の取得**
- 対象：事業所＋対象年月ごとの料率マスタ
- 既存のマスタ画面／サービス（例：`HealthRateTable`, `PensionRateTable`）から、
  - 健康保険料率 `healthRate`（例：9.91%）
  - 介護保険料率 `careRate`（例：1.59%）
  - 厚生年金保険料率 `pensionRate`（例：18.3%）
  を取得する

**2-2. 健康保険＋介護保険**
- 各社員について：
  - 健康保険標準報酬月額 `healthStandardReward`
  - 介護保険対象フラグ `hasCare`
- 使用する総料率：
  ```
  healthTotalRate = hasCare ? (healthRate + careRate) : healthRate
  ```
- 例）東京都 2025年3月分
  - `healthRate = 9.91%`
  - `careRate = 1.59%`
  - 介護ありの人だけ 11.5% を使用

**2-3. 厚生年金**
- 各社員について：
  - 厚生年金標準報酬月額 `pensionStandardReward`
- 使用する料率：
  ```
  pensionTotalRate = pensionRate  （例：18.3%）
  ```

##### 3. 行レベルの計算ロジック（共通パターン）

以下は「健康保険＋介護保険」「厚生年金」どちらにも共通の考え方。違いは「使う標準報酬・等級」と「使う料率」だけ。

**3-1. 行レベルで計算する値**

- **標準報酬月額・等級**
  - 健康保険側の標準報酬／等級（健康保険セクション）
  - 厚生年金側の標準報酬／等級（厚生年金セクション）

- **全額（full）**
  - 定義：事業主負担＋被保険者負担の合計額（端数処理前）
  - 計算式：`fullAmount = 標準報酬月額 × 対象の総料率（healthTotalRate or pensionTotalRate）`
  - 小数点以下はそのまま保持（例：13279.4円）

- **従業員負担額（控除額）**
  - 基本的には「全額のちょうど半額」をベースにする：`employeeShareRaw = fullAmount / 2`
  - そのうえで、**50銭ルールによる端数処理**を行う（詳細は 4章）

- **会社負担額（個人単位／参考）**
  - 個人レベルでは「参考（概算）」としてのみ表示
  - 計算式は、`employerShareReference = fullAmount - employeeShareRounded`
  - ただし、画面上のラベル等で「※参考値（概算）」であることを明示する

##### 4. 50銭ルール（従業員負担額の端数処理）

**4-1. 適用対象**
- 対象は「従業員負担額（給与から控除する被保険者負担分）」のみ
- 「全額」や「納入告知額」自体には50銭ルールは適用しない

**4-2. ルール**
- 事業主が給与（賞与）から被保険者負担分を控除する場合、
- 控除額の計算において、被保険者負担分の端数が
  - 50銭以下 → 切り捨て
  - 50銭超 → 切り上げて1円
- とする

**例:**
- 12,345.50 → 12,345 円を控除
- 12,345.51 → 12,346 円を控除

**4-3. 実装イメージ**
```typescript
function roundForEmployeeDeduction(x: number): number {
  const integer = Math.floor(x);           // 円部分
  const fractional = x - integer;         // 小数部分
  if (fractional <= 0.50) {
    return integer;
  } else {
    return integer + 1;
  }
}

employeeShareRounded = roundForEmployeeDeduction(employeeShareRaw)
```
を「従業員負担額（控除額）」として画面表示・集計に使用する。

##### 5. 集計ロジック（フッター・集計カード）

健康保険＋介護保険、厚生年金それぞれについて、同じパターンで集計する。

**5-1. 行から集計に使う値**
- `fullAmount[i]` … i番目の社員の「全額」（端数処理前）
- `employeeShareRounded[i]` … i番目の社員の「従業員負担額」（50銭ルール適用後）

**5-2. 集計値**
- **従業員負担合計**
  - `employeeTotal = Σ employeeShareRounded[i]`

- **合計（納入告知額） – 端数処理前**
  - `sumFull = Σ fullAmount[i]` // 小数点付きの合計をそのまま持つ
  - 画面には「合計（端数処理前）」などのラベルで表示
  - 少数第2位くらいまで表示（例：72,435.40円）

- **合計（納入告知額） – 端数処理後（正式な納入告知額）**
  - `sumFullRoundedDown = Math.floor(sumFull)` // 円未満切り捨て
  - これが「納入告知額」として扱われる金額

- **会社負担合計**
  - `employerTotal = sumFullRoundedDown - employeeTotal`
  - 「納入告知額 － 従業員負担合計」という関係がユーザーに分かりやすいように、ラベルや説明文で明示する

**5-3. 画面表示イメージ（フッター／集計カード）**
各保険種別ごとに、例えば以下のようなカード・フッターを表示：
- 「従業員負担合計」：`employeeTotal` 円
- 「会社負担合計」：`employerTotal` 円
- 「合計（納入告知額）」
  - 1行目：`sumFull` 円（端数処理前：小数付き）
  - 2行目：`sumFullRoundedDown` 円（納入告知額：円未満切り捨て）

##### 6. 月次保険料ページの画面仕様（完成イメージ）

**6-1. セクション構成**
- タブ or セクション分け：
  - 「健康保険・介護保険」
  - 「厚生年金」
- それぞれに同じレイアウトの表＋フッターを持つ

**6-2. 行レベルで表示する項目（共通）**
各セクションの行には、最低限以下を表示：
- 従業員名
- 標準報酬月額
- 等級
- （健康保険側のみ）介護保険対象フラグ or「介護あり」アイコンなど
- 「全額」（`fullAmount`）
- 「従業員負担額（控除額）」＝ `employeeShareRounded`
- 「会社負担額（参考）」＝ `employerShareReference`（※参考値と明記）

**6-3. フッター／サマリーカード**
各セクション下部に以下を表示：
- 従業員負担合計
- 会社負担合計
- 合計（納入告知額）
  - 端数処理前合計（`sumFull`）
  - 円未満切り捨て後の納入告知額（`sumFullRoundedDown`）

補足として：
- ※「納入告知額」は、行レベルの「全額」を全員分足し合わせ、円未満を切り捨てた金額です。
- ※ 従業員負担額は、給与から控除する際の50銭ルール（50銭以下切り捨て／50銭超切り上げ）を適用しています。

といった説明文を付けておく。

##### 7. 仕様としての制約明記

- 従業員負担額の50銭ルールは「給与から控除する場合」のルールに準拠していること
- 日割り・日数按分は行わず、月単位で計算すること
- 個人の会社負担額はあくまで参考値（概算）であること

#### このフェーズ完了時点で達成されること

- 月次保険料計算ロジックが正式ルールに沿って厳密化される
- 「50銭ルール」「月末退職／月中退職」「取得／喪失月」の扱いが明文化・実装される
- 月次保険料ページの表示内容が「納入告知額」との関係が分かりやすい形に整理される
- 健康保険と介護保険の料率が合算され、正しく計算される

---

### Phase 3：標準報酬履歴リファクタ

**目的:** 履歴も健保／厚年をきっちり区別して持てるようにし、Employee との同期を実現する。

#### 対象ファイル

- `types.ts`（すでに保険種別を追加済みの前提）
- `services/standard-reward-history.service.ts`
- `employees/employee-detail-dialog.component.ts`
- `employees/standard-reward-history-form-dialog.component.ts`
- `employees/employee-form-dialog.component.ts`
- `services/document-generator.service.ts`
- ルール関連（Firestore rules）も必要なら

#### やること

##### 1. 履歴のCRUDを「insuranceKind」対応にする

- **一覧取得**: 従来は1本の配列だったものを、`insuranceKind` でフィルタできるようにする
  - `listByInsuranceKind(officeId, employeeId, insuranceKind)` メソッドを追加
  - UIではタブ切り替えで健保／厚年を分けて表示
- **編集ダイアログ**: 保険種別を選択できるようにする（新規作成時のみ選択可能、編集時は表示のみ）
- **保存処理**: `insuranceKind` を必須フィールドとして扱い、バリデーションを追加

##### 2. Employee ⇔ StandardRewardHistory の同期ポリシー実装

**基本方針:**
- 編集起点がどちらであっても、最終的に `Employee` と履歴が一致するようにする

**2-1. 履歴 → Employee 方向の同期**
- 新しい `StandardRewardHistory` が追加／更新されたとき、その `insuranceKind` に応じて
  - `Employee.healthStandardMonthly` / `healthGrade`
  - または `Employee.pensionStandardMonthly` / `pensionGrade`
  を最新値で上書きする
- つまり「履歴の最新レコードが Employee 側に反映される」のが基本
- `StandardRewardHistoryService.save()` 内で、保存後に自動同期処理を実行

**2-2. Employee → 履歴 方向の同期**
- 従業員フォームで `Employee` の `healthStandardMonthly` / `pensionStandardMonthly`（あるいは grade）を直接変更した場合は、
  - 変更された保険種別（`insuranceKind: 'health' | 'pension'`）の履歴を1件自動追加する
  - このとき `GradeDecisionSource` や `decisionKind` によって「自動決定（`auto_from_salary`）／手動修正（`manual_override`）／CSVインポート（`imported`）」などの由来を区別する
- 初回登録時にも同様に、必要に応じて health / pension それぞれに履歴を登録する
- フォームの `decisionYearMonth` を `StandardRewardHistory.decisionYearMonth` として使用する
- **重要**: Employee の標準報酬が変わったら、`GradeDecisionSource` に関係なく履歴を追加する。これにより「履歴の最新レコード = Employee スナップショット」という整合性が保たれる

##### 3. 履歴UIのタブ分け（健保／厚年）

- Employee詳細ダイアログで、タブ：標準報酬履歴（健保） / 標準報酬履歴（厚年）
- 各タブで該当保険種別の履歴のみを表示
- 一覧：決定年月 / 適用開始 / 等級 / 標準報酬 / 決定区分 / メモ
- 履歴追加ボタンで選択中のタブの保険種別を自動設定

##### 4. 書類生成用の標準報酬解決ロジックを保険種別対応に

- `DocumentGeneratorService.resolveStandardMonthlyReward()` に `insuranceKind` パラメータを追加
- 指定保険種別の `StandardRewardHistory`（最新）のみを見る
- 解決順位:
  1. 指定保険種別の `StandardRewardHistory`（最新）
  2. `Employee` の `healthStandardMonthly` / `pensionStandardMonthly`
  3. （最終フォールバックとして）`payrollSettings.insurableMonthlyWage`（報酬月額）
- Phase5 の書類生成でもこの関数を使用する

##### 3-x. このフェーズの範囲外（後続フェーズで対応）

以下の内容は Phase3 では対応せず、後続フェーズで仕様整理・実装する：

- **従業員削除と各種履歴の整合性ポリシー**
  - 過去の計算・履歴（月次保険料、賞与保険料、標準報酬履歴、社会保険手続き履歴など）を持つ従業員の削除方針
  - 方針: 過去の計算・履歴を持つ従業員は原則として物理削除せず、退職フラグ等で扱う方向で検討する
  - 既に削除済み従業員に紐づく履歴の表示（画面上の「氏名（不明）」行など）の扱いは **Phase6 で仕様整理・実装する**

つまり、Phase3 では「標準報酬・履歴の構造と同期」が主テーマであり、従業員削除まわりの仕様変更は行わない。

---

### Phase 4：CSVインポート／エクスポート刷新

**目的:** CSV経由でも新モデルで行き来できるようにし、テンプレートDL → 入力 → インポートとエクスポート → 編集 → 再インポートが同一フォーマットで往復できるようにする。

#### 対象ファイル

- `utils/csv-import.service.ts`
- `utils/csv-export.service.ts`
- `employees/employee-import-dialog.component.ts`
- CSVテンプレートの仕様（コメント・ヘッダ）

#### やること

##### 1. 列構成の決め直し（報酬月額＋健保／厚年の標準報酬・等級）

**ヘッダ行の例（第一行目）:**

```text
salary_monthly,health_grade,health_standard_monthly,pension_grade,pension_standard_monthly
```

**各列の意味（人間向け説明）:**

- `salary_monthly` … 報酬月額（各種手当込みの月給ベース）。`payrollSettings.insurableMonthlyWage` に対応
- `health_grade` … 健康保険の標準報酬等級
- `health_standard_monthly` … 健康保険の標準報酬月額
- `pension_grade` … 厚生年金の標準報酬等級
- `pension_standard_monthly` … 厚生年金の標準報酬月額

既存の「標準報酬月額」列は廃止してOK（テストデータしかない前提）。

##### 2. インポート側（報酬月額のみ／標準報酬指定ありの両方に対応）

- **報酬月額だけ入っていて、標準報酬が空の場合**:
  - `MastersService` + resolver を使って健保・厚年の等級／標準報酬を自動決定
  - `GradeSource = 'auto_from_salary'` のように記録する
  - この場合、標準報酬決定年月（`decisionYearMonth`）は「今日の年月」をデフォルトとして使用する

- **健保・厚年の等級／標準報酬がCSVに入っている場合**:
  - 入力されている値を優先してセットし、`GradeSource = 'imported'` のように記録する
  - 自動計算結果ではなく、ユーザーの指定を尊重する

##### 3. エクスポート側（常に新モデルの項目で出力）

- 常に新モデルのフィールドをエクスポート：
  - 報酬月額（`salary_monthly`）
  - 健保等級＆標準報酬（`health_grade`, `health_standard_monthly`）
  - 厚年等級＆標準報酬（`pension_grade`, `pension_standard_monthly`）
- **重要**: 「テンプレートをダウンロード → 値を入力 → インポート」と「既存データをエクスポート → 編集 → 再インポート」の両方が**同一フォーマット**で往復できることを保証する

##### 4. ヘッダ名・説明文のアップデート

- ヘッダを英語に統一（上記の列名を使用）
- `health_standard_monthly` の説明に「健康保険の標準報酬月額」、`pension_standard_monthly` に「厚生年金の標準報酬月額」を明記
- インポートダイアログの説明文も調整し、各列の意味を明確にする

---

### Phase 5：書類生成・異常チェック刷新

**目的:** 外に出ていく帳票やエラーチェックも新モデル（health/pension 別標準報酬）前提に揃える。

#### 対象ファイル

- `services/document-generator.service.ts`
- `pages/documents/document-generation-dialog.component.ts`
- `services/data-quality.service.ts`
- 異常チェックページ（`/data-quality`）
- PDFテンプレート周辺

#### やること

##### 5-1. 書類生成（資格取得届・喪失届など）での標準報酬解決を `insuranceKind` 対応に

1. **`resolveStandardMonthlyReward()` を保険種別対応にする**
   - Phase3 で実装済みの関数を使用
   - 各帳票でどの種別を使うかを明示:
     - 資格取得届（健保） → `'health'`
     - 資格取得届（厚年） → `'pension'`
     - 資格喪失届も同様
   - PDFの項目名としては今まで通りだが、中身はちゃんと健保／厚年それぞれの標準報酬が出るようにする

2. **`DocumentGenerationDialog` の更新**
   - 「標準報酬（月額）」の表示に `insuranceKind` を意識させる（ヘルプテキストなど）

##### 5-2. DataQualityService のルールを新モデル前提で書き直す

1. **「標準報酬スナップショット欠落」ルールの見直し**
   - `MonthlyPremium.healthStandardMonthly` / `pensionStandardMonthly` をそれぞれチェック
   - 保険料計算が動いている前提なので、どちらかだけ欠落している場合は別種の異常として扱う
   - `Employee` や `MonthlyPremium` において、標準報酬が `null` の状態が続いている場合、「標準報酬未決定」系の issue として検知する

2. **「標準報酬履歴と Employee の不整合」チェック**
   - 最新の `StandardRewardHistory`（各保険種別）と `Employee` の `healthStandardMonthly` / `pensionStandardMonthly` が一致しているかどうか
   - 差異が大きい場合は警告

3. **「マスタの等級表と Employee の標準報酬のギャップ」チェック**
   - 現在のマスタ（`bands`）を使って、`Employee` の標準報酬がその等級の `standardMonthly` と大きくズレていないかを確認
   - これで「手入力で変な値にされた」ケースを検出できる

4. **UI表示の微調整**
   - `issueType` 表示に「健保標準報酬ギャップ」「厚年標準報酬ギャップ」などの分類を追加

---

### Phase 6：マイページ＋履歴系の細かい整合性・従業員削除ポリシー

**目的:** 本人向け画面での標準報酬・保険料表示を新モデルと整合させ、従業員削除と各種履歴の関係を整理する。

#### 対象ファイル

- `pages/me/my-page.ts` / `my-page.html`（マイページ）
- `pages/dashboard/dashboard.page.ts`（ダッシュボードなど、本人向け画面）
- `services/employees.service.ts`（従業員削除ロジック）
- 月次保険料・賞与保険料・標準報酬履歴・社会保険手続き履歴などの表示画面

#### やること

##### 6-1. マイページ・ダッシュボードでの標準報酬・保険料表示の整合性

- MyPage やダッシュボードなど「本人向け画面」での標準報酬・保険料の表示を、Phase1〜5 で定義した新しいデータモデル（`healthStandardMonthly` / `pensionStandardMonthly`）と整合させる
- `monthlyWage` の参照を削除し、健保・厚年それぞれの標準報酬を正しく表示する

##### 6-2. 従業員削除と各種履歴の整合性ポリシー

1. **従業員削除方針の整理**
   - 過去に保険料計算や標準報酬履歴を持つ従業員は、**原則として物理削除せず「退職」ステータスで管理する** 方針を検討・実装する
   - 退職フラグや退職日フィールドを追加し、削除ではなく「退職済み」として扱う

2. **物理削除が必要な場合への備え**
   - それでも物理削除が必要な場合に備え、月次保険料・賞与保険料などの履歴レコードに `employeeNameSnapshot`（計算時点の氏名など）を持たせる
   - 画面上では「削除済み従業員（〇〇〇〇）」のように表示できるようにする
   - 現状「氏名（不明）」として表示されているようなケースをなくし、履歴画面で「誰に対する計算だったのか」が分かるようにする

3. **履歴データの整合性確保**
   - 標準報酬履歴、月次保険料、賞与保険料、社会保険手続き履歴など、従業員に紐づく各種履歴データと従業員削除の関係を整理する
   - 履歴が存在する従業員を削除しようとした場合の警告・確認ダイアログを実装する

---

## 3. フェーズ順のまとめ

最後に、ざっくり順番だけもう一度並べると：

### Phase 1：モデル & premium-calculator
- `types.ts` 修正
- `standard-reward-resolver` 追加
- `premium-calculator` と `MonthlyPremium` 周りの大改修

### Phase 2：従業員フォーム & シミュレーター
- 報酬月額 → 健保／厚年等級・標準報酬 自動計算
- フォーム保存ロジック更新
- 一覧／マイページの表示調整

### Phase 2.5：月次保険料計算ロジックの厳密化
- 保険料の対象となる従業員の判定ロジック確立（取得日・喪失日の扱い）
- 健康保険＋介護保険の料率合算
- 50銭ルールの実装（従業員負担額の端数処理）
- 納入告知額の計算ロジック（全額合計の円未満切り捨て）
- 月次保険料ページの表示内容整理（行レベル・フッター集計）

### Phase 3：標準報酬履歴リファクタ
- `insuranceKind` で履歴を分離
- Employee ⇔ StandardRewardHistory の同期ポリシー実装
- 履歴UIのタブ分け（健保／厚年）
- 書類生成用の標準報酬解決ロジックを保険種別対応に

### Phase 4：CSVインポート／エクスポート刷新
- CSVの列構成を「報酬月額＋健保／厚年の標準報酬・等級」に揃える
- インポート時は報酬月額のみ／標準報酬指定ありの両方に対応
- エクスポートは常に新モデルの項目で出力
- テンプレDL → 入力 → インポートとエクスポート → 編集 → 再インポートが同一フォーマットで往復できる

### Phase 5：書類生成・異常チェック刷新
- 資格取得届・喪失届などで使う標準報酬の解決を `insuranceKind` 対応にする
- DataQualityService のルールを新モデル（health/pension 別標準報酬）前提で書き直す

### Phase 6：マイページ＋履歴系の細かい整合性・従業員削除ポリシー
- MyPage やダッシュボードなど「本人向け画面」での標準報酬・保険料の表示を新モデルと整合させる
- 従業員削除と各種履歴（月次保険料、賞与保険料、標準報酬履歴、社会保険手続き履歴など）の関係を整理する
- 過去の計算・履歴を持つ従業員は原則として物理削除せず「退職」ステータスで管理する方針を検討・実装する

---

## 4. 実装時の注意事項

### 4-1. 既存データへの影響

- **既存データへの配慮は不要**
- Firestore のスキーマ変更は問題なし
- CSVの列構成変更も問題なし
- 後方互換や段階的移行は考えなくてよい

### 4-2. monthlyWage の扱い

- `monthlyWage` は**完全に "遺物（deprecated）"** として扱う
- 今後の世界では「計算ロジックや正のデータモデルには一切使わない」
- Firestore ルール・CSV インポート／エクスポート・フォーム UI からも事実上排除する
- フォーム上で非表示にする
- 今後は `healthStandardMonthly` / `pensionStandardMonthly` を使う

### 4-3. 等級決定ロジックの実装

- `StandardRewardBand` の `lowerLimit` / `upperLimit` を使って等級を決定
- 範囲外（頭打ち）の処理も考慮する
- ユーザーが手動で上書き可能な設計にする

### 4-4. 標準報酬決定年月（decisionYearMonth）の扱い

- 標準報酬を決めるときは、フォームに `decisionYearMonth`（標準報酬決定年月）を入力させる
- `MastersService.getRatesForYearMonth()` にこの `decisionYearMonth` を渡して、該当するマスタを取得する
- デフォルトでは「今日の年月」を初期値とするが、ユーザーが変更可能
- 将来的には `decisionYearMonth` と `StandardRewardHistory.decisionYearMonth` を一致させるのが基本方針

### 4-5. Employee と StandardRewardHistory の同期

- 編集起点がどちらであっても、最終的に `Employee` と履歴が一致するようにする
- 履歴 → Employee: 履歴の最新レコードが Employee 側に反映される
- Employee → 履歴: Employee の標準報酬を変更した場合、該当保険種別の履歴を自動追加する

### 4-6. 等級決定ユーティリティの失敗時の扱い

- resolver が `null` を返した場合、フォーム側では対象保険種別の等級・標準報酬フィールドを空欄のままにする
- バリデーションエラーメッセージを表示し、保存ボタンを無効化するか、ユーザーが手動で値を入れ直せるようにする
- `premium-calculator` 側では、標準報酬が `null` の場合、該当保険種別の保険料計算を実行しない（0円を勝手に計算しない）
- `DataQualityService` では、標準報酬が `null` の状態を「標準報酬未決定」系の issue として検知する

### 4-7. CSV 仕様の具体化

- 列構成: `salary_monthly,health_grade,health_standard_monthly,pension_grade,pension_standard_monthly`
- インポート時: 報酬月額のみの場合は自動計算、標準報酬が入力されている場合はそれを優先
- エクスポート時: 常に上記5列を出力し、テンプレートDL → 入力 → インポートとエクスポート → 編集 → 再インポートの両方が同一フォーマットで往復できるようにする

### 4-8. テスト方針

- 各フェーズごとにテストを追加
- 保険料計算ロジックのテストを充実させる
- 等級決定ロジックのテストを追加（成功時・失敗時の両方）
- CSVインポート/エクスポートのテストを更新
- Employee と StandardRewardHistory の同期ロジックのテストを追加

### 4-9. 従業員削除と履歴の扱い

- この方針書では標準報酬と等級の世界観を中心に設計しているが、従業員の退職・削除と、月次保険料／賞与保険料／標準報酬履歴などの履歴データの整合性については **Phase6 で詳細設計・実装する**
- Phase1〜5 の実装では、従業員削除ロジックを大きく変更しない前提で進める
- 既に削除済み従業員に紐づく履歴の表示（画面上の「氏名（不明）」行など）の扱いも Phase6 で対応する

---

## 5. 参考資料

- `STANDARD_REWARD_ANALYSIS.md`: 現状分析レポート
- `src/app/types.ts`: 型定義
- `src/app/utils/premium-calculator.ts`: 保険料計算ロジック
- `src/app/services/masters.service.ts`: マスタサービス

---

## 6. 次のステップ

1. Phase 1 の実装開始
2. 各フェーズごとにレビュー・テスト
3. 段階的にリリース

