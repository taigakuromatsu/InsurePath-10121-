# 社会保険料の計算ロジックと集計処理の現状整理

## 改訂履歴
- 2025年1月: 初版作成（現状分析）

---

## 【1. 関連ファイル・サービスの特定】

### 1-1. 月額保険料（健康保険・介護保険・厚生年金）の計算に使われている場所

#### 計算ロジックの実装場所

**主要ファイル:**
- `src/app/utils/premium-calculator.ts`
  - `calculateMonthlyPremiumForEmployee()` 関数（136行目〜）
  - 個人ごとの月次保険料を計算する核心ロジック

**計算式の実装箇所:**
```190:200:src/app/utils/premium-calculator.ts
  const healthEmployee = Math.floor(healthTotal / 2);
  const healthEmployer = healthTotal - healthEmployee;

  const pensionEmployee = Math.floor(pensionTotal / 2);
  const pensionEmployer = pensionTotal - pensionEmployee;

  const careEmployee = Math.floor(careTotal / 2);
  const careEmployer = careTotal - careEmployee;

  const totalEmployee = healthEmployee + careEmployee + pensionEmployee;
  const totalEmployer = healthEmployer + careEmployer + pensionEmployer;
```

**計算の流れ:**
1. `healthTotal = healthStandardMonthly * healthRate`（174-175行目）
2. `pensionTotal = pensionStandardMonthly * pensionRate`（178-179行目）
3. `careTotal = healthStandardMonthly * careRate`（185-188行目、40-64歳のみ）
4. 各保険の全額を2で割って従業員負担を算出（`Math.floor()`で切り捨て）
5. 会社負担 = 全額 - 従業員負担

**サービス層:**
- `src/app/services/monthly-premiums.service.ts`
  - `saveForMonth()` メソッド（123行目〜）
  - 事業所単位で一括計算・保存を実行
  - `calculateMonthlyPremiumForEmployee()` を各従業員に対して呼び出し

**マスタ取得:**
- `src/app/services/masters.service.ts`
  - `getRatesForYearMonth()` メソッド（438行目〜）
  - 対象年月の保険料率（健康保険・介護保険・厚生年金）を取得

### 1-2. 賞与保険料の計算に使われている場所

**主要ファイル:**
- `src/app/utils/bonus-calculator.ts`
  - `calculateBonusPremium()` 関数（114行目〜）
  - 賞与支給額から標準賞与額を算出し、保険料を計算

**計算式の実装箇所:**
```145:156:src/app/utils/bonus-calculator.ts
  // 健康保険料（1円未満切り捨て）
  const healthTotal = Math.floor(healthCheck.effectiveAmount * healthRate);
  const healthEmployee = Math.floor(healthTotal / 2);
  const healthEmployer = healthTotal - healthEmployee;

  // 厚生年金保険料
  const pensionTotal = Math.floor(pensionCheck.effectiveAmount * pensionRate);
  const pensionEmployee = Math.floor(pensionTotal / 2);
  const pensionEmployer = pensionTotal - pensionEmployee;

  const totalEmployee = healthEmployee + pensionEmployee;
  const totalEmployer = healthEmployer + pensionEmployer;
```

**計算の流れ:**
1. 標準賞与額 = `Math.floor(grossAmount / 1000) * 1000`（1,000円未満切り捨て）
2. 健康保険上限チェック（年度累計573万円）
3. 厚生年金上限チェック（1回150万円）
4. 上限適用後の有効額に保険料率を掛けて全額を算出（1円未満切り捨て）
5. 全額を2で割って従業員負担を算出（`Math.floor()`で切り捨て）
6. 会社負担 = 全額 - 従業員負担

**サービス層:**
- `src/app/services/bonus-premiums.service.ts`
  - `saveBonusPremium()` メソッド（84行目〜）
  - 賞与保険料の保存処理

**画面側:**
- `src/app/pages/premiums/bonus/bonus-form-dialog.component.ts`
  - 賞与登録ダイアログで `calculateBonusPremium()` を呼び出し

### 1-3. 集計・スナップショット系

**月次保険料の保存場所:**
- Firestore コレクション: `offices/{officeId}/monthlyPremiums`
- ドキュメントID: `{employeeId}_{yearMonth}`（例: `emp123_2025-01`）

**保存されるフィールド構成（MonthlyPremium型）:**
```492:524:src/app/types.ts
export interface MonthlyPremium {
  id: string;
  officeId: string;
  employeeId: string;
  yearMonth: YearMonthString;

  // 計算時点での等級・標準報酬（スナップショット）
  healthGrade: number;
  healthStandardMonthly: number;
  healthGradeSource?: GradeDecisionSource;

  pensionGrade: number;
  pensionStandardMonthly: number;
  pensionGradeSource?: GradeDecisionSource;

  healthTotal: number;
  healthEmployee: number;
  healthEmployer: number;

  careTotal?: number;
  careEmployee?: number;
  careEmployer?: number;

  pensionTotal: number;
  pensionEmployee: number;
  pensionEmployer: number;

  totalEmployee: number;
  totalEmployer: number;

  calculatedAt: IsoDateString;
  calculatedByUserId?: string;
}
```

**賞与保険料の保存場所:**
- Firestore コレクション: `offices/{officeId}/bonusPremiums`
- ドキュメントID: `{employeeId}_{payDate}`（例: `emp123_2025-01-15`）

**保存されるフィールド構成（BonusPremium型）:**
```527:557:src/app/types.ts
export interface BonusPremium {
  id: string;
  officeId: string;
  employeeId: string;
  payDate: IsoDateString;
  grossAmount: number;
  standardBonusAmount: number;
  fiscalYear: string;

  healthTotal: number;
  healthEmployee: number;
  healthEmployer: number;

  pensionTotal: number;
  pensionEmployee: number;
  pensionEmployer: number;

  totalEmployee: number;
  totalEmployer: number;

  // オプション情報
  healthStandardBonusCumulative?: number;
  note?: string;
  healthEffectiveAmount?: number;
  healthExceededAmount?: number;
  pensionEffectiveAmount?: number;
  pensionExceededAmount?: number;

  createdAt: IsoDateString;
  createdByUserId?: string;
}
```

**集計処理の実装場所:**
- 画面側で集計（後述の4-1、4-2参照）
- ダッシュボードでの集計（後述の4-3参照）
- **注意**: 事業所単位の集計値はFirestore上に別途保存されていない。画面表示時に都度計算している。

### 1-4. 画面側

**月次保険料ページ:**
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts`
  - 月次保険料の一覧表示・計算・保存
  - `MonthlyPremiumsService.listByOfficeAndYearMonth()` でデータ取得
  - 画面下部に事業所合計を表示（517-523行目）

**賞与保険料ページ:**
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts`
  - 賞与保険料の一覧表示・登録
  - `BonusPremiumsService.listByOfficeAndEmployee()` でデータ取得
  - 画面下部に事業所合計を表示（166-175行目）

**ダッシュボード:**
- `src/app/pages/dashboard/dashboard.page.ts`
  - 月次保険料・賞与保険料の集計表示
  - `loadMonthlyPremiumsTotals()` メソッド（783行目〜）
  - `loadCurrentMonthComparisonData()` メソッド（845行目〜）
  - `loadFiscalYearComparisonData()` メソッド（887行目〜）

**マイページ:**
- `src/app/pages/me/my-page.ts`
  - 個人の月次保険料・賞与保険料の表示
  - `MonthlyPremiumsService.listByOfficeAndEmployee()` で個人データ取得

---

## 【2. 現在の計算ロジックの整理（式・単位・端数処理）】

### 2-1. 個人ごとの計算式

#### 健康保険・介護保険・厚生年金の全額計算

**健康保険:**
```typescript
healthTotal = healthStandardMonthly * healthRate
```
- 端数処理: なし（浮動小数点のまま計算）
- ただし、最終的な従業員負担・会社負担の算出時に端数処理が発生

**介護保険:**
```typescript
careTotal = healthStandardMonthly * careRate
```
- 条件: 40〜64歳かつ健康保険加入者かつ免除でない場合のみ
- 端数処理: なし（浮動小数点のまま計算）

**厚生年金:**
```typescript
pensionTotal = pensionStandardMonthly * pensionRate
```
- 端数処理: なし（浮動小数点のまま計算）

#### 従業員負担額・会社負担額の算出

**現在の実装:**
```190:197:src/app/utils/premium-calculator.ts
  const healthEmployee = Math.floor(healthTotal / 2);
  const healthEmployer = healthTotal - healthEmployee;

  const pensionEmployee = Math.floor(pensionTotal / 2);
  const pensionEmployer = pensionTotal - pensionEmployee;

  const careEmployee = Math.floor(careTotal / 2);
  const careEmployer = careTotal - careEmployee;
```

**端数処理の方法:**
- **従業員負担**: `Math.floor(全額 / 2)` → **切り捨て**
- **会社負担**: `全額 - 従業員負担` → 従業員負担の切り捨て分が会社負担に加算される
- **50銭ルール**: 実装されていない（単純に切り捨てのみ）

**問題点:**
- 制度上のルールでは「従業員負担は50銭ルールで端数処理」が正しいが、現状は単純切り捨て
- 例: 全額が10,001円の場合
  - 現状: 従業員負担 = 5,000円、会社負担 = 5,001円
  - 正しい: 従業員負担 = 5,000円（50銭ルール）、会社負担 = 5,001円

#### 賞与保険料の計算

**標準賞与額の算出:**
```17:19:src/app/utils/bonus-calculator.ts
export function calculateStandardBonusAmount(bonusAmount: number): number {
  return Math.floor(bonusAmount / 1000) * 1000;
}
```
- 1,000円未満切り捨て

**保険料の全額計算:**
```145:151:src/app/utils/bonus-calculator.ts
  // 健康保険料（1円未満切り捨て）
  const healthTotal = Math.floor(healthCheck.effectiveAmount * healthRate);
  const healthEmployee = Math.floor(healthTotal / 2);
  const healthEmployer = healthTotal - healthEmployee;

  // 厚生年金保険料
  const pensionTotal = Math.floor(pensionCheck.effectiveAmount * pensionRate);
```
- 全額計算時に1円未満切り捨て（`Math.floor()`）
- その後、従業員負担・会社負担を算出（月次保険料と同様のロジック）

### 2-2. 事業所単位の集計ロジック

**現在の実装パターン: パターンA（個人ごとの負担額を合計）**

**月次保険料ページでの集計:**
```517:523:src/app/pages/premiums/monthly/monthly-premiums.page.ts
  readonly totalEmployee = computed(() => {
    return this.filteredRows().reduce((sum, r) => sum + r.totalEmployee, 0);
  });

  readonly totalEmployer = computed(() => {
    return this.filteredRows().reduce((sum, r) => sum + r.totalEmployer, 0);
  });
```

**ダッシュボードでの集計:**
```794:801:src/app/pages/dashboard/dashboard.page.ts
      const currentTotal = currentPremiums.reduce((sum, p) => sum + p.totalEmployer, 0);
      this.currentMonthTotalEmployer.set(currentTotal);

      const previousPremiums: MonthlyPremium[] = await firstValueFrom(
        this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, previousYearMonth)
      );
      const previousTotal = previousPremiums.reduce((sum, p) => sum + p.totalEmployer, 0);
      this.previousMonthTotalEmployer.set(previousTotal);
```

**現在の集計方法:**
- 個人ごとに計算された `totalEmployee` / `totalEmployer` を単純合計
- **事業所全体の全額（納入告知額）は保存・表示されていない**
- 端数処理は個人ごとに行われた後、合計しているため、事業所単位での端数処理は行われていない

**Firestore上での保存状況:**
- **事業所全体の集計値は保存されていない**
- 個人ごとの `MonthlyPremium` ドキュメントのみ保存
- 画面表示時に都度集計している

**問題点:**
- 制度上のルールでは「事業所全体の納入告知額 = 各人全額の合計 → 1円未満切り捨て」が正しい
- 現状は個人ごとの負担額を合計しているため、制度上のルールと不一致

### 2-3. 賞与の計算ロジック

**個人ごとの計算:**
- 月次保険料と同様のロジック
- 全額を2で割って従業員負担を算出（`Math.floor()`で切り捨て）
- 会社負担 = 全額 - 従業員負担

**事業所合計:**
```338:341:src/app/pages/premiums/bonus/bonus-premiums.page.ts
      const totalEmployee = rows.reduce((sum, r) => sum + r.totalEmployee, 0);
      const totalEmployer = rows.reduce((sum, r) => sum + r.totalEmployer, 0);

      return { rows, totalEmployee, totalEmployer };
```
- 個人ごとの負担額を合計している（月次保険料と同様）

---

## 【3. 入社・退職・資格取得／喪失日の扱い】

### 3-1. 保険料が発生する「対象月」の決定ロジック

**実装場所:**
- `src/app/utils/premium-calculator.ts` の `hasSocialInsuranceInMonth()` 関数（75行目〜）

**現在の実装:**
```75:108:src/app/utils/premium-calculator.ts
function hasSocialInsuranceInMonth(
  employee: Employee,
  yearMonth: YearMonthString
): boolean {
  const ym = yearMonth;

  // 健康保険の資格期間（なければ雇用日・退職日で代用）
  const healthStart = toYearMonthOrNull(
    employee.healthQualificationDate || employee.hireDate
  );
  const healthEnd = toYearMonthOrNull(
    employee.healthLossDate || employee.retireDate
  );

  // 厚生年金の資格期間（なければ雇用日・退職日で代用）
  const pensionStart = toYearMonthOrNull(
    employee.pensionQualificationDate || employee.hireDate
  );
  const pensionEnd = toYearMonthOrNull(
    employee.pensionLossDate || employee.retireDate
  );

  const inRange = (start: YearMonthString | null, end: YearMonthString | null): boolean => {
    if (start && ym < start) return false;
    if (end && ym > end) return false;
    return true;
  };

  const healthOk = inRange(healthStart, healthEnd);
  const pensionOk = inRange(pensionStart, pensionEnd);

  // どちらかの社会保険で資格期間内なら、その月は「社会保険対象」とみなす
  return healthOk || pensionOk;
}
```

**判定ロジックの詳細:**
- 資格取得日・資格喪失日が未入力の場合は、`hireDate` / `retireDate` をフォールバックとして使用
- 日付から年月（`YYYY-MM`）を抽出して比較
- 健康保険と厚生年金のどちらか一方でも資格期間内なら対象とみなす

**月途中入社・退職の扱い:**
- **現状**: 日付から年月（`YYYY-MM`）を抽出して比較しているため、**月単位で判定**
- 例: 6月10日入社 → `hireDate = '2025-06-10'` → `toYearMonthOrNull()` → `'2025-06'`
  - 6月分の保険料に含まれる
- 例: 6月20日退職 → `retireDate = '2025-06-20'` → `toYearMonthOrNull()` → `'2025-06'`
  - 6月分の保険料に含まれる

**月末退職の扱い:**
- **現状**: 月末かどうかの特別な判定は行われていない
- 例: 6月30日退職 → `retireDate = '2025-06-30'` → `toYearMonthOrNull()` → `'2025-06'`
  - 6月分の保険料に含まれる
- **問題点**: 制度上のルールでは「月末退職の場合は退職月の保険料は発生しない」が、現状は月末でも含まれてしまう

**資格取得日・資格喪失日の優先順位:**
1. `healthQualificationDate` / `healthLossDate`（健康保険）
2. `pensionQualificationDate` / `pensionLossDate`（厚生年金）
3. フォールバック: `hireDate` / `retireDate`

### 3-2. 賞与支給のタイミング判定

**実装場所:**
- `src/app/utils/bonus-calculator.ts` の `calculateBonusPremium()` 関数
- 退職月に賞与を支給した場合の特別な判定は**実装されていない**

**現在の実装:**
- 賞与保険料の計算時に、退職日や資格喪失日を考慮した判定は行われていない
- 賞与支給日（`payDate`）のみを使用して計算

**問題点:**
- 制度上のルールでは「退職月に賞与を支給した場合、月末退職かどうかで控除要否が決まる」が、現状は実装されていない

### 3-3. 現状の状態まとめ

**実装されている点:**
- 資格取得日・資格喪失日を使って、対象月を判定するロジックは存在する
- 月単位での判定は行われている（日割りではない）

**実装されていない点:**
- **月末退職の特別扱い**: 月末退職の場合は退職月の保険料を発生させない判定がない
- **賞与支給のタイミング判定**: 退職月に賞与を支給した場合の特別な判定がない
- **資格取得日が月末の場合の判定**: 月末入社の場合の特別な判定がない

**結論:**
- 現状では、資格取得日・資格喪失日を使って月単位で判定しているが、**月末かどうかの判定は行われていない**
- そのため、制度上のルール（月末退職の場合は退職月の保険料は発生しない）とはまだ一致していない

---

## 【4. 画面表示とのつながり】

### 4-1. 月次保険料ページ

**表示内容:**
- 従業員ごとの行: `healthEmployee`, `healthEmployer`, `careEmployee`, `careEmployer`, `pensionEmployee`, `pensionEmployer`, `totalEmployee`, `totalEmployer`
- 事業所合計: `totalEmployee`（本人負担合計）、`totalEmployer`（会社負担合計）

**算出元:**
```517:523:src/app/pages/premiums/monthly/monthly-premiums.page.ts
  readonly totalEmployee = computed(() => {
    return this.filteredRows().reduce((sum, r) => sum + r.totalEmployee, 0);
  });

  readonly totalEmployer = computed(() => {
    return this.filteredRows().reduce((sum, r) => sum + r.totalEmployer, 0);
  });
```

- 各行の値: `MonthlyPremium` ドキュメントの `totalEmployee` / `totalEmployer` フィールドをそのまま表示
- 事業所合計: 画面表示時に個人ごとの `totalEmployee` / `totalEmployer` を合計
- **事業所全体の全額（納入告知額）は表示されていない**

### 4-2. 賞与保険料ページ

**表示内容:**
- 各行: `healthEmployee`, `healthEmployer`, `pensionEmployee`, `pensionEmployer`, `totalEmployee`, `totalEmployer`
- 事業所合計: `totalEmployee`（本人負担合計）、`totalEmployer`（会社負担合計）

**算出元:**
```338:341:src/app/pages/premiums/bonus/bonus-premiums.page.ts
      const totalEmployee = rows.reduce((sum, r) => sum + r.totalEmployee, 0);
      const totalEmployer = rows.reduce((sum, r) => sum + r.totalEmployer, 0);

      return { rows, totalEmployee, totalEmployer };
```

- 各行の値: `BonusPremium` ドキュメントの `totalEmployee` / `totalEmployer` フィールドをそのまま表示
- 事業所合計: 画面表示時に個人ごとの `totalEmployee` / `totalEmployer` を合計
- **月次保険料と同様のロジック**

### 4-3. ダッシュボード・マイページ

**ダッシュボードでの集計:**
```783:807:src/app/pages/dashboard/dashboard.page.ts
  private async loadMonthlyPremiumsTotals(officeId: string): Promise<void> {
    try {
      const now = new Date();
      const currentYearMonth = now.toISOString().substring(0, 7);

      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousYearMonth = previousMonth.toISOString().substring(0, 7);

      const currentPremiums: MonthlyPremium[] = await firstValueFrom(
        this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, currentYearMonth)
      );
      const currentTotal = currentPremiums.reduce((sum, p) => sum + p.totalEmployer, 0);
      this.currentMonthTotalEmployer.set(currentTotal);

      const previousPremiums: MonthlyPremium[] = await firstValueFrom(
        this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, previousYearMonth)
      );
      const previousTotal = previousPremiums.reduce((sum, p) => sum + p.totalEmployer, 0);
      this.previousMonthTotalEmployer.set(previousTotal);
    } catch (error) {
      console.error('月次保険料の集計に失敗しました', error);
      this.currentMonthTotalEmployer.set(null);
      this.previousMonthTotalEmployer.set(null);
    }
  }
```

**集計方法:**
- `MonthlyPremium` ドキュメントの `totalEmployer` を合計
- 会社負担額のみを集計して表示
- **2. で整理した集計ロジックと一致している**（個人ごとの負担額を合計）

**マイページ:**
- 個人の `MonthlyPremium` / `BonusPremium` をそのまま表示
- 集計処理は行っていない

---

## 【5. 今後の改良に向けた「差分のメモ」】

### 目指している仕様（要約）

1. **事業所単位の納入額**: 各人 `fullAmount` を合計 → 1円未満切り捨て
2. **従業員負担額**: 各人 `fullAmount / 2` に50銭ルールで端数処理
3. **会社負担額**: 納入額 − 従業員負担合計（個人ごとの会社負担は任意）
4. **月途中入社・退職**: 資格取得日・資格喪失日と月末かどうかで判断（保険料は日割りではなく月単位）
5. **賞与支給のタイミング**: 退職月が月末かどうかで控除要否が決まる

### 現状との差分

#### ✅ 一致している点

1. **月単位での判定**: 資格取得日・資格喪失日を使って月単位で判定している
2. **個人ごとの計算**: 標準報酬月額 × 保険料率で全額を計算している
3. **従業員負担・会社負担の分割**: 全額を2で割って負担額を算出している

#### ❌ 不一致・未実装の点

1. **事業所単位の納入額の算出方法**
   - **現状**: 個人ごとの `totalEmployee` / `totalEmployer` を合計
   - **目標**: 個人ごとの `fullAmount`（健康保険全額 + 介護保険全額 + 厚生年金全額）を合計 → 1円未満切り捨て → これを「納入告知額」とする
   - **影響**: 現在は事業所全体の全額（納入告知額）が保存・表示されていない

2. **従業員負担額の端数処理**
   - **現状**: `Math.floor(全額 / 2)` で単純切り捨て
   - **目標**: 50銭ルールで端数処理（1円未満は50銭未満なら切り捨て、50銭以上なら切り上げ）
   - **影響**: 端数処理の方法が制度上のルールと不一致

3. **会社負担額の算出方法**
   - **現状**: 個人ごとに `全額 - 従業員負担` で算出し、それを合計
   - **目標**: 納入告知額 − 従業員負担合計（個人ごとの会社負担は必須ではない）
   - **影響**: 事業所全体の会社負担額が制度上のルールと不一致になる可能性

4. **月末退職の判定**
   - **現状**: 月末かどうかの判定は行われていない（6月30日退職でも6月分の保険料に含まれる）
   - **目標**: 月末退職の場合は退職月の保険料は発生しない
   - **影響**: 月末退職の場合に保険料が過剰に計上される

5. **賞与支給のタイミング判定**
   - **現状**: 退職月に賞与を支給した場合の特別な判定がない
   - **目標**: 退職月が月末かどうかで控除要否が決まる
   - **影響**: 退職月に賞与を支給した場合の保険料計算が制度上のルールと不一致

6. **事業所全体の全額（納入告知額）の保存**
   - **現状**: Firestore上に保存されていない（画面表示時に都度計算）
   - **目標**: 事業所単位の月次保険料スナップショットに納入告知額を保存することを検討
   - **影響**: 過去の納入告知額を参照できない

### 改良が必要な箇所のまとめ

1. **`premium-calculator.ts`**
   - 従業員負担額の端数処理を50銭ルールに変更
   - 事業所単位の集計ロジックを追加（各人全額を合計 → 1円未満切り捨て）

2. **`monthly-premiums.service.ts`**
   - 事業所単位の集計値を保存する処理を追加（オプション）
   - または、画面側で集計する際に正しいロジックを使用

3. **`premium-calculator.ts` の `hasSocialInsuranceInMonth()`**
   - 月末退職の判定を追加（資格喪失日が月末の場合、その月は対象外）

4. **`bonus-calculator.ts`**
   - 退職月に賞与を支給した場合の判定を追加（退職日が月末かどうかで控除要否を決定）

5. **画面側（月次保険料ページ・ダッシュボード）**
   - 事業所全体の全額（納入告知額）を表示
   - 集計ロジックを正しい方法に変更

---

## 【6. 補足情報】

### 6-1. 現在の計算ロジックの詳細フロー

**月次保険料計算の流れ:**
1. `MonthlyPremiumsService.saveForMonth()` が呼ばれる
2. 対象年月の保険料率を取得（`MastersService.getRatesForYearMonth()`）
3. 各従業員に対して `calculateMonthlyPremiumForEmployee()` を呼び出し
4. 個人ごとの保険料を計算（全額 → 従業員負担・会社負担に分割）
5. `MonthlyPremium` ドキュメントとして保存
6. 画面表示時に個人ごとの負担額を合計して事業所合計を表示

**賞与保険料計算の流れ:**
1. `BonusFormDialogComponent` で賞与情報を入力
2. `calculateBonusPremium()` を呼び出し
3. 標準賞与額を算出（1,000円未満切り捨て）
4. 上限チェック（健康保険: 年度累計573万円、厚生年金: 1回150万円）
5. 保険料を計算（全額 → 従業員負担・会社負担に分割）
6. `BonusPremium` ドキュメントとして保存

### 6-2. データ構造の補足

**MonthlyPremium の保存場所:**
- コレクション: `offices/{officeId}/monthlyPremiums`
- ドキュメントID: `{employeeId}_{yearMonth}`
- 例: `emp123_2025-01`

**BonusPremium の保存場所:**
- コレクション: `offices/{officeId}/bonusPremiums`
- ドキュメントID: `{employeeId}_{payDate}`
- 例: `emp123_2025-01-15`

**注意点:**
- 事業所単位の集計値は別のコレクションやドキュメントに保存されていない
- 画面表示時に都度集計している

---

## 【7. 次のステップ】

1. **計算ロジックの改良**
   - 従業員負担額の端数処理を50銭ルールに変更
   - 事業所単位の集計ロジックを追加

2. **月末退職の判定追加**
   - `hasSocialInsuranceInMonth()` に月末判定を追加

3. **賞与支給のタイミング判定追加**
   - `calculateBonusPremium()` に退職月判定を追加

4. **画面表示の改良**
   - 事業所全体の全額（納入告知額）を表示
   - 集計ロジックを正しい方法に変更

5. **データ保存の検討**
   - 事業所単位の月次保険料スナップショットに納入告知額を保存することを検討

