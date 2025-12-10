# 標準報酬・等級まわり大規模改良方針書

## 改訂履歴
- 2025年1月: 初版作成
- 2025年1月: 追加方針反映（monthlyWage deprecated、decisionYearMonth、同期ポリシー、エラー処理、CSV仕様）

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

### Phase 3：標準報酬履歴（StandardRewardHistory）の刷新

**目的:** 履歴も健保／厚年をきっちり区別して持てるようにする。

#### 対象ファイル

- `types.ts`（すでに保険種別を追加済みの前提）
- `services/standard-reward-history.service.ts`
- `employees/employee-detail-dialog.component.ts`
- `employees/standard-reward-history-form-dialog.component.ts`
- ルール関連（Firestore rules）も必要なら

#### やること

##### 1. 履歴のCRUDを「insuranceKind」対応にする

- **一覧取得**: 従来は1本の配列だったものを、`insuranceKind` でフィルタできるようにする（UIではタブ切り替えでもOK）
- **編集ダイアログ**: 保険種別を選択できるようにする（もしくは「健保タブから開いたら自動で health 固定」でもいい）

##### 2. 従業員フォームからの自動履歴追加の見直し

**現状**: `addAutoStandardRewardHistory()` は「monthlyWage を共通履歴に記録」している

**新仕様**: 変更された保険種別ごとに履歴を追加する
- 健保標準報酬が変わった → `insuranceKind: 'health'` の履歴を1件追加
- 厚年標準報酬が変わった → `insuranceKind: 'pension'` の履歴を1件追加
- 初回登録時は両方同じであれば「2本追加」するか、「とりあえず健保のみ履歴必須」といった運用ルールを決める
- フォームの `decisionYearMonth` を `StandardRewardHistory.decisionYearMonth` として使用する

##### 2-1. Employee と StandardRewardHistory の同期ポリシー

**基本方針:**
- 編集起点がどちらであっても、最終的に `Employee` と履歴が一致するようにする

**1. 履歴 → Employee 方向**
- 新しい `StandardRewardHistory` が追加／更新されたとき、その `insuranceKind` に応じて
  - `Employee.healthStandardMonthly` / `healthGrade`
  - または `Employee.pensionStandardMonthly` / `pensionGrade`
  を最新値で上書きする
- つまり「履歴の最新レコードが Employee 側に反映される」のが基本

**2. Employee → 履歴 方向**
- 従業員フォームで `Employee` の `healthStandardMonthly` / `pensionStandardMonthly`（あるいは grade）を直接変更した場合は、
  - 変更された保険種別（`insuranceKind: 'health' | 'pension'`）の履歴を1件自動追加する
- 初回登録時にも同様に、必要に応じて health / pension それぞれに履歴を登録する

**3. 結論**
- 「編集の起点が Employee 側でも履歴側でも、最終的には Employee ⇔ History が常に整合している状態を目指す」ことを基本方針とする

##### 3. 履歴からの解決ロジックも保険種別に対応

- `DocumentGeneratorService.resolveStandardMonthlyReward()` などは、引数に `insuranceKind` を追加 (`'health' | 'pension'`)
- 該当保険種別の履歴だけを見る
- 後述する書類生成（Phase5）でもこの関数を使う

##### 4. UIの見せ方

- Employee詳細ダイアログで、タブ：標準報酬履歴（健保） / 標準報酬履歴（厚年）
- 一覧：決定年月 / 適用開始 / 等級 / 標準報酬 / 決定区分 / メモ

---

### Phase 4：CSVインポート／エクスポートの刷新

**目的:** CSV経由でも新モデルで行き来できるようにする。

#### 対象ファイル

- `utils/csv-import.service.ts`
- `utils/csv-export.service.ts`
- `employees/employee-import-dialog.component.ts`
- CSVテンプレートの仕様（コメント・ヘッダ）

#### やること

##### 1. 列構成の決め直し

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

##### 2. インポート側

- **報酬月額だけ入っていて、標準報酬が空の場合**:
  - `MastersService` + resolver を使って健保・厚年の等級／標準報酬を自動決定
  - `GradeSource = 'auto_from_salary'` のように記録する
  - この場合、標準報酬決定年月（`decisionYearMonth`）は「今日の年月」をデフォルトとして使用する

- **健保・厚年の等級／標準報酬がCSVに入っている場合**:
  - 入力されている値を優先してセットし、`GradeSource = 'imported'` のように記録する
  - 自動計算結果ではなく、ユーザーの指定を尊重する

##### 3. エクスポート側

- 常に新モデルのフィールドをエクスポート：
  - 報酬月額（`salary_monthly`）
  - 健保等級＆標準報酬（`health_grade`, `health_standard_monthly`）
  - 厚年等級＆標準報酬（`pension_grade`, `pension_standard_monthly`）
- これで「テンプレートをダウンロード → 値を入力 → インポート」「既存データをエクスポート → 編集 → 再インポート」の両方が**同一フォーマット**で往復できる

##### 4. ヘッダ名・説明文のアップデート

- ヘッダを英語に統一（上記の列名を使用）
- `health_standard_monthly` の説明に「健康保険の標準報酬月額」、`pension_standard_monthly` に「厚生年金の標準報酬月額」を明記
- インポートダイアログの説明文も調整し、各列の意味を明確にする

---

### Phase 5：書類生成 & 異常チェック（データ品質チェック）の改良

**目的:** 外に出ていく帳票やエラーチェックも新モデルに揃える。

#### 5-1. 書類生成（資格取得届・喪失届など）

##### 対象ファイル

- `services/document-generator.service.ts`
- `pages/documents/document-generation-dialog.component.ts`
- PDFテンプレート周辺

##### やること

1. **`resolveStandardMonthlyReward()` を保険種別対応にする**

   ```typescript
   resolveStandardMonthlyReward(
     employee: Employee,
     histories: StandardRewardHistory[],
     kind: 'health' | 'pension'
   ): number | null
   ```

   **解決順位:**
   - 指定保険種別の `StandardRewardHistory`（最新）
   - `Employee` の `healthStandardMonthly` / `pensionStandardMonthly`
   - （最終フォールバックとして）`payrollSettings.insurableMonthlyWage`（報酬月額）

2. **各帳票でどの種別を使うかを明示**
   - 資格取得届（健保） → `'health'`
   - 資格取得届（厚年） → `'pension'`
   - 資格喪失届も同様
   - PDFの項目名としては今まで通りだが、中身はちゃんと健保／厚年それぞれの標準報酬が出るようにする

3. **`DocumentGenerationDialog` も**
   - 「標準報酬（月額）」の表示に `insuranceKind` を意識させる（ヘルプテキストなど）

#### 5-2. データ品質チェック（DataQualityService）

##### 対象ファイル

- `services/data-quality.service.ts`
- 異常チェックページ（`/data-quality`）

##### やること（例）

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

### Phase 3：標準報酬履歴
- `insuranceKind` 追加
- 履歴UI（健保／厚年タブ）
- 従業員フォームからの自動追加ロジック改修

### Phase 4：CSV 全面改良
- 新しい列構成（報酬月額＋健保／厚年標準報酬＆等級）
- インポート時の自動計算＆手入力対応
- エクスポートの整合性

### Phase 5：書類生成 & データ品質チェック
- 書類生成での標準報酬解決を保険種別対応に
- `DataQualityService` のルールを新モデル前提に書き換え

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

