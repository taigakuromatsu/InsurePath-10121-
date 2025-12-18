# P1-6 指示書（完全版）

**テーマ**: 賞与管理・賞与保険料計算機能の実装

**対象アプリ**: InsurePath

---

## 0. ゴール・位置づけ

CATALOG の (12)「賞与管理・賞与保険料計算機能」を実装するフェーズ。

従業員ごとの **賞与支給履歴** を登録・閲覧できる。

その賞与について、健康保険・厚生年金の賞与保険料を自動計算して保存できる。

月次保険料計算（P1-3, P1-4）と同じく、「本人負担」「会社負担」「合計」が分かる。

### 0-1. 実装範囲（今回やること）

- ✅ 従業員ごとの賞与支給履歴の登録・閲覧機能
- ✅ 標準賞与額（千円未満切り捨て）の計算ロジック
- ✅ 上限チェック
  - 健康保険：同一年度の標準賞与額累計 **5,730,000 円**
  - 厚生年金：1回あたり標準賞与額 **1,500,000 円**
- ✅ 賞与保険料の計算ロジック（健康保険・厚生年金）
  - 料率は既存のマスタ（MastersService）から取得
  - 本人:会社 = 1:1 で按分（端数処理は月次と同様に 1円未満切り捨て）
- ✅ 賞与一覧ページ（bonus-premiums.page.ts）での表示・CRUD
- ⚠️ 必要に応じて、月次保険料一覧画面に「この月に賞与があった場合の参考表示」を追加（表示のみ / 任意）

### 0-2. スコープ外（やらないこと）

- ❌ 介護保険の賞与保険料計算（介護保険は賞与に課さない）
- ❌ 月次保険料計算ロジックへの自動統合（P1-6では「表示連携まで」。月次本体の計算には含めない）
- ❌ ダッシュボードでの年度別集計
- ❌ CSV インポート / エクスポート
- ❌ Functions / Rules の変更

---

## 1. 前提・現状

### 1-1. 技術スタック

- Angular standalone コンポーネント構成。ページは `xxx.page.ts` で定義。
- `src/app/types.ts` に `BonusPremium` がプレースホルダーとして定義済み（内容は要確認）。
- `src/app/utils/premium-calculator.ts` に月次保険料計算ロジックがある。
- `src/app/services/masters.service.ts` で「保険料率マスタ（健康・介護・厚生年金・等級）」を取得できる。
- `src/app/services/monthly-premiums.service.ts` で月次保険料の計算・保存が実装済み。
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts` で月次保険料の UI がある。
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts` は現在プレースホルダー（中身はほぼ空）想定。
- ルーティングはすでに `path: 'premiums/bonus'` がある前提。ルート定義は変更しない。

### 1-2. 注意事項

- 賞与保険料は健康保険と厚生年金のみ（介護保険は対象外）
- 健康保険の上限は「同一年度（4月1日〜翌年3月31日）の標準賞与額累計573万円」
- 厚生年金の上限は「1回の賞与ごとの標準賞与額150万円」
- 標準賞与額 = 賞与支給額（税引前）から1,000円未満を切り捨て
- 保険料の按分は月次と同様に1:1（従業員:会社）

---

## 2. 変更する / 追加するファイル

### 2-1. 編集するファイル

- **`src/app/types.ts`**
  - `BonusPremium` 型を P1-6 の仕様に合わせて拡張・調整する（既存フィールド名は壊さない）。

- **`src/app/pages/premiums/bonus/bonus-premiums.page.ts`**
  - プレースホルダーを本実装に差し替える。
  - 一覧表示・「賞与を登録」ボタン・編集 / 削除などの UI を実装。

- **`src/app/pages/premiums/monthly/monthly-premiums.page.ts`**（任意・優先度低）
  - 必要なら「この月の賞与保険料」の参考表示列を追加しても良い。

### 2-2. 新規追加ファイル

- **`src/app/utils/bonus-calculator.ts`**
  - 賞与保険料の計算ロジック（標準賞与額、上限チェック、保険料計算）をまとめるユーティリティモジュール。

- **`src/app/services/bonus-premiums.service.ts`**
  - 賞与支給履歴 / 賞与保険料（BonusPremium）の CRUD・集計用サービス。

- **`src/app/pages/premiums/bonus/bonus-form-dialog.component.ts`**
  - 新規登録 / 編集用のダイアログコンポーネント。

---

## 3. Firestore コレクション構造

賞与保険料は事業所ごとに次のコレクションで管理する：

```
offices/
  {officeId}/
    bonusPremiums/
      {docId}/
        id: string
        officeId: string
        employeeId: string
        payDate: IsoDateString           // 賞与支給日（例: "2025-06-15"）
        fiscalYear: string               // 年度（4月1日基準の西暦年を文字列化したもの）
        grossAmount: number              // 賞与支給額（税引前）
        standardBonusAmount: number      // 標準賞与額（1,000円未満切り捨て後）
        
        // 上限・累計情報
        healthStandardBonusCumulative?: number  // 健保の年度内 累計「有効標準賞与額」
        healthEffectiveAmount?: number          // 健保の有効標準賞与額（上限適用後）
        healthExceededAmount?: number           // 健保の上限超過額
        pensionEffectiveAmount?: number         // 厚年の有効標準賞与額（上限適用後）
        pensionExceededAmount?: number          // 厚年の上限超過額
        
        // 健康保険
        healthTotal: number
        healthEmployee: number
        healthEmployer: number
        
        // 厚生年金
        pensionTotal: number
        pensionEmployee: number
        pensionEmployer: number
        
        // 合計
        totalEmployee: number
        totalEmployer: number
        
        // その他
        note?: string
        createdAt: IsoDateString
        createdByUserId?: string
```

**docId のルール**: `employeeId + '_' + payDate`（例: `abc123_2025-06-15`）

**注意**: 同じ従業員・同じ支給日の賞与は1件のみ（再登録時は上書き扱い）。

---

## 4. 型定義（types.ts）

### 4-1. BonusPremium 型の拡張

`src/app/types.ts` 内の `BonusPremium` を、上記 Firestore 構造と一致するように調整する。

**前提**：
- 既存のフィールド名（`payDate`, `grossAmount`, `fiscalYear` など）がある場合は変更しない。
- フィールドを追加する形で対応する。

**追加・保持したいフィールド例（最終的な構造イメージ）**：

```typescript
export interface BonusPremium {
  id: string;
  officeId: string;
  employeeId: string;
  payDate: IsoDateString;
  fiscalYear: string;
  grossAmount: number;
  standardBonusAmount: number;
  
  healthTotal: number;
  healthEmployee: number;
  healthEmployer: number;
  
  pensionTotal: number;
  pensionEmployee: number;
  pensionEmployer: number;
  
  totalEmployee: number;
  totalEmployer: number;
  
  // 追加フィールド（必要に応じて optional で）
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

実際の `types.ts` の内容を確認し、型名・型エイリアスなどを壊さないように微調整してよい。

---

## 5. bonus-calculator.ts の実装

**ファイル**: `src/app/utils/bonus-calculator.ts`（新規）

他のユーティリティ（`premium-calculator.ts`）と同様に、「ビジネスロジックだけ」をまとめる。

### 5-1. ユーティリティ関数

```typescript
// src/app/utils/bonus-calculator.ts
import { BonusPremium, Employee, IsoDateString } from '../types';

/**
 * 日付から年度（4月1日基準）を取得
 * 例: 2025-06-15 → 2025年度、2025-03-31 → 2024年度
 */
export function getFiscalYear(date: IsoDateString): number {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1 - 12
  return month >= 4 ? year : year - 1;
}

/**
 * 標準賞与額を計算（1,000円未満切り捨て）
 */
export function calculateStandardBonusAmount(bonusAmount: number): number {
  return Math.floor(bonusAmount / 1000) * 1000;
}

/**
 * 健康保険の上限チェック（同一年度の累計573万円）
 */
export function checkHealthInsuranceLimit(
  standardBonusAmount: number,
  cumulativeAmount: number
): {
  withinLimit: boolean;
  effectiveAmount: number; // 上限適用後の有効な標準賞与額
  exceededAmount: number;  // 上限超過額
} {
  const limit = 5730000; // 573万円
  const newCumulative = cumulativeAmount + standardBonusAmount;
  
  if (newCumulative <= limit) {
    return {
      withinLimit: true,
      effectiveAmount: standardBonusAmount,
      exceededAmount: 0
    };
  }
  
  const exceeded = newCumulative - limit;
  const effective = standardBonusAmount - exceeded;
  
  return {
    withinLimit: false,
    effectiveAmount: Math.max(0, effective),
    exceededAmount: exceeded
  };
}

/**
 * 厚生年金の上限チェック（1回の賞与150万円）
 */
export function checkPensionLimit(
  standardBonusAmount: number
): {
  withinLimit: boolean;
  effectiveAmount: number;
  exceededAmount: number;
} {
  const limit = 1500000; // 150万円
  
  if (standardBonusAmount <= limit) {
    return {
      withinLimit: true,
      effectiveAmount: standardBonusAmount,
      exceededAmount: 0
    };
  }
  
  return {
    withinLimit: false,
    effectiveAmount: limit,
    exceededAmount: standardBonusAmount - limit
  };
}
```

### 5-2. メイン計算関数

`MonthlyPremium` と同様に「計算結果 DTO」を返す形にする。

```typescript
export interface BonusPremiumCalculationResult {
  employeeId: string;
  officeId: string;
  payDate: IsoDateString;
  fiscalYear: string;
  grossAmount: number;
  standardBonusAmount: number;
  healthStandardBonusCumulative: number;
  healthEffectiveAmount: number;
  healthExceededAmount: number;
  pensionEffectiveAmount: number;
  pensionExceededAmount: number;
  healthTotal: number;
  healthEmployee: number;
  healthEmployer: number;
  pensionTotal: number;
  pensionEmployee: number;
  pensionEmployer: number;
  totalEmployee: number;
  totalEmployer: number;
}

/**
 * 賞与保険料を計算する
 *
 * @param officeId 対象事業所ID
 * @param employee 従業員情報
 * @param grossAmount 賞与支給額（税引前）
 * @param payDate 支給日
 * @param healthStandardBonusCumulative 健保の年度内累計（既存分）
 * @param healthRate 健康保険料率（合計）
 * @param pensionRate 厚生年金保険料率（合計）
 * @returns 計算結果、または計算不可の場合は null
 */
export function calculateBonusPremium(
  officeId: string,
  employee: Employee,
  grossAmount: number,
  payDate: IsoDateString,
  healthStandardBonusCumulative: number,
  healthRate: number,
  pensionRate: number
): BonusPremiumCalculationResult | null {
  // 加入していない / 0 円 はスキップ
  if (!employee.isInsured || grossAmount <= 0) {
    return null;
  }

  // 標準賞与額（千円未満切り捨て）
  const standardBonusAmount = calculateStandardBonusAmount(grossAmount);
  
  if (standardBonusAmount <= 0) {
    return null;
  }

  const fiscalYear = String(getFiscalYear(payDate));

  // 上限チェック
  const healthCheck = checkHealthInsuranceLimit(
    standardBonusAmount,
    healthStandardBonusCumulative
  );
  
  const pensionCheck = checkPensionLimit(standardBonusAmount);

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

  return {
    employeeId: employee.id,
    officeId,
    payDate,
    fiscalYear,
    grossAmount,
    standardBonusAmount,
    healthStandardBonusCumulative:
      healthStandardBonusCumulative + healthCheck.effectiveAmount,
    healthEffectiveAmount: healthCheck.effectiveAmount,
    healthExceededAmount: healthCheck.exceededAmount,
    pensionEffectiveAmount: pensionCheck.effectiveAmount,
    pensionExceededAmount: pensionCheck.exceededAmount,
    healthTotal,
    healthEmployee,
    healthEmployer,
    pensionTotal,
    pensionEmployee,
    pensionEmployer,
    totalEmployee,
    totalEmployer
  };
}
```

---

## 6. BonusPremiumsService の実装

**ファイル**: `src/app/services/bonus-premiums.service.ts`（新規）

`MonthlyPremiumsService` と同じパターンで作る。

Firestore の CRUD と、健康保険の年度内累計取得を担当。

```typescript
// src/app/services/bonus-premiums.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where
} from '@angular/fire/firestore';
import { firstValueFrom, from, map, Observable } from 'rxjs';

import { BonusPremium, IsoDateString } from '../types';
import { getFiscalYear } from '../utils/bonus-calculator';

@Injectable({ providedIn: 'root' })
export class BonusPremiumsService {
  private readonly firestore = inject(Firestore);

  private getCollectionRef(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'bonusPremiums');
  }

  private buildDocId(employeeId: string, payDate: IsoDateString): string {
    return `${employeeId}_${payDate}`;
  }

  /**
   * 事業所（＋任意で従業員）ごとの賞与支給履歴一覧
   */
  listByOfficeAndEmployee(
    officeId: string,
    employeeId?: string
  ): Observable<BonusPremium[]> {
    const ref = this.getCollectionRef(officeId);
    let q = query(ref, orderBy('payDate', 'desc'));
    
    if (employeeId) {
      q = query(q, where('employeeId', '==', employeeId));
    }
    
    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as BonusPremium)
        )
      )
    );
  }

  /**
   * 賞与支給履歴の保存（新規 or 更新）
   */
  async saveBonusPremium(
    officeId: string,
    bonus: Partial<BonusPremium> & { employeeId: string; payDate: IsoDateString }
  ): Promise<void> {
    const collectionRef = this.getCollectionRef(officeId);
    const docId = this.buildDocId(bonus.employeeId, bonus.payDate);
    const ref = doc(collectionRef, docId);
    const now = new Date().toISOString();

    const payload: BonusPremium = {
      id: docId,
      officeId,
      employeeId: bonus.employeeId,
      payDate: bonus.payDate,
      grossAmount: Number(bonus.grossAmount ?? 0),
      standardBonusAmount: Number(bonus.standardBonusAmount ?? 0),
      fiscalYear: bonus.fiscalYear ?? String(getFiscalYear(bonus.payDate)),
      healthTotal: Number(bonus.healthTotal ?? 0),
      healthEmployee: Number(bonus.healthEmployee ?? 0),
      healthEmployer: Number(bonus.healthEmployer ?? 0),
      pensionTotal: Number(bonus.pensionTotal ?? 0),
      pensionEmployee: Number(bonus.pensionEmployee ?? 0),
      pensionEmployer: Number(bonus.pensionEmployer ?? 0),
      totalEmployee: Number(bonus.totalEmployee ?? 0),
      totalEmployer: Number(bonus.totalEmployer ?? 0),
      createdAt: bonus.createdAt ?? now,
      createdByUserId: bonus.createdByUserId
    };

    // オプショナル
    if (bonus.healthStandardBonusCumulative != null) {
      payload.healthStandardBonusCumulative = Number(
        bonus.healthStandardBonusCumulative
      );
    }
    if (bonus.note != null) payload.note = bonus.note;
    if (bonus.healthEffectiveAmount != null) {
      payload.healthEffectiveAmount = Number(bonus.healthEffectiveAmount);
    }
    if (bonus.healthExceededAmount != null) {
      payload.healthExceededAmount = Number(bonus.healthExceededAmount);
    }
    if (bonus.pensionEffectiveAmount != null) {
      payload.pensionEffectiveAmount = Number(bonus.pensionEffectiveAmount);
    }
    if (bonus.pensionExceededAmount != null) {
      payload.pensionExceededAmount = Number(bonus.pensionExceededAmount);
    }

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    ) as BonusPremium;

    await setDoc(ref, cleanPayload, { merge: true });
  }

  /**
   * 賞与支給履歴の削除
   */
  async deleteBonusPremium(officeId: string, id: string): Promise<void> {
    const ref = doc(this.getCollectionRef(officeId), id);
    return deleteDoc(ref);
  }

  /**
   * 健康保険の年度内累計標準賞与額（有効額）を取得する
   * 編集時には excludePayDate で現在編集中の支給日を除外できる
   */
  async getHealthStandardBonusCumulative(
    officeId: string,
    employeeId: string,
    fiscalYear: string,
    excludePayDate?: IsoDateString
  ): Promise<number> {
    const ref = this.getCollectionRef(officeId);
    const q = query(
      ref,
      where('employeeId', '==', employeeId),
      where('fiscalYear', '==', fiscalYear)
    );

    const snapshot = await firstValueFrom(from(getDocs(q)));
    const bonuses = snapshot.docs
      .map((d) => d.data() as BonusPremium)
      .filter((b) => !excludePayDate || b.payDate !== excludePayDate);

    return bonuses.reduce(
      (sum, b) => sum + (b.healthEffectiveAmount ?? b.standardBonusAmount),
      0
    );
  }
}
```

---

## 7. bonus-premiums.page.ts の実装

**ファイル**: `src/app/pages/premiums/bonus/bonus-premiums.page.ts`（編集）

### 7-1. 概要

ページ構成は `monthly-premiums.page.ts` や `employees.page.ts` と同じテイストで。

**機能**：
- 対象事業所の賞与支給履歴一覧の表示
- 「賞与を登録」ボタン → `BonusFormDialogComponent` を開いて登録 / 編集
- 削除ボタン（confirm ダイアログあり）
- 一覧下部に「事業所合計（本人負担）」「事業所合計（会社負担）」の合計表示

### 7-2. 使用するサービス・依存

- `CurrentOfficeService`：`officeId$` から現在の事業所を取得
- `EmployeesService`：従業員名を解決するために一覧を取得（Map にしておく）
- `BonusPremiumsService`：賞与一覧の取得・削除
- `MatDialog`：登録 / 編集ダイアログ
- `MatSnackBar`：成功 / 失敗のメッセージ表示

**Angular Material**: `MatCardModule`, `MatTableModule`, `MatButtonModule`, `MatIconModule`, `MatDialogModule`, `MatSnackBarModule`

**パイプ/ディレクティブ**: `AsyncPipe`, `DecimalPipe`, `DatePipe`, `NgIf`, `NgForOf` など必要なもの

### 7-3. テーブルの列

- 支給日（`payDate`）
- 従業員名
- 賞与支給額（`grossAmount`）
- 標準賞与額（`standardBonusAmount`）
- 健康保険 本人 / 会社
- 厚生年金 本人 / 会社
- 合計 本人 / 会社
- 操作（編集・削除）

`monthly-premiums.page.ts` と同じように `displayedColumns` で列 ID を管理する。

### 7-4. 一覧データの成形

`BonusPremiumsService.listByOfficeAndEmployee(officeId)` で `BonusPremium[]` を取得。

従業員 ID → 名称の Map を作成して `employeeName` を付けた表示用配列にしてもよい。

合計値は `computed` or RxJS `map` で算出。

### 7-5. UIデザイン

既存のページ（`monthly-premiums.page.ts`, `employees.page.ts`, `masters.page.ts`）と同じデザインパターンを適用：

- ヘッダーカード（グラデーション背景）
- ページタイトルセクション（アイコン付き）
- テーブルコンテナ（ボーダー、ホバー効果）
- 空の状態の表示
- 合計表示エリア

---

## 8. bonus-form-dialog.component.ts の実装

**ファイル**: `src/app/pages/premiums/bonus/bonus-form-dialog.component.ts`（新規）

### 8-1. 概要

standalone コンポーネント + `MatDialog` 用のダイアログ。

新規作成 / 編集共通。

`MAT_DIALOG_DATA` で既存の `BonusPremium` を渡せるようにする。

### 8-2. UI 要素

- **ダイアログタイトル**（新規作成/編集）
- **フォーム項目**:
  - 従業員選択（`mat-select`）
  - 支給日（`input type="date"`）
  - 賞与支給額（`number`）
  - メモ（任意、`textarea`）
- **「計算して保存」ボタン**
- **計算結果プレビュー**（オプション）
  - 標準賞与額
  - 健康保険料（本人/会社）
  - 厚生年金保険料（本人/会社）
  - 合計（本人/会社）
  - 上限超過警告（該当する場合）

### 8-3. ロジック

1. **従業員一覧の取得**
   - `EmployeesService` から `isInsured === true` の従業員のみを取得して選択肢に表示。

2. **料率の取得**
   - `MastersService.getRatesForYearMonth(office, yearMonth)` を利用して、支給日の属する **暦年月** の料率を取得。
   - `payDate` → `YYYY-MM` 形式の文字列に変換して渡す。
   - 戻り値から `healthRate`, `pensionRate` を利用（`careRate` は無視）。

3. **フォーム送信時の処理**：
   - `payDate` から `fiscalYear` を算出（`getFiscalYear` を利用）。
   - `BonusPremiumsService.getHealthStandardBonusCumulative` を呼び出し、年度内の累計を取得。
     - 編集時は `excludePayDate` に元の `payDate` を渡して、自己分を除外。
   - `calculateBonusPremium` を呼び出し、`BonusPremiumCalculationResult` を取得。
   - 上限超過（`healthExceededAmount > 0` など）がある場合は、`MatSnackBar` で警告を表示。
   - `BonusPremiumsService.saveBonusPremium` で Firestore に保存。
   - ダイアログを `close()` し、`afterClosed()` 側で一覧を再読み込み or 自動更新されるようにする。

### 8-4. 戻り値

ダイアログは保存成功時に `true`、キャンセル時に `false` または `undefined` を返す想定。

`bonus-premiums.page.ts` 側では `afterClosed()` で真偽値を見て、必要に応じてスナックバーや再読込を行う。

### 8-5. エラーハンドリング

- 料率未設定・Masters が見つからない場合は、`MatSnackBar` でユーザーにエラーを表示して計算を中断。
- `calculateBonusPremium` が `null` を返した場合も同様。
- フォームバリデーション（従業員選択、支給日、賞与支給額は必須）。

---

## 9. 月次保険料一覧との連携（任意・余裕があれば）

**ファイル**: `src/app/pages/premiums/monthly/monthly-premiums.page.ts`（編集）

対象年月の月次保険料一覧の下部に「この月に支給された賞与保険料の合計（本人 / 会社）」を参考表示してもよい。

### 9-1. 実装イメージ

- `BonusPremiumsService` を注入。
- `yearMonth` と `officeId` から、`payDate` がその月に属する賞与を検索。
- その `totalEmployee`, `totalEmployer` を合算して `bonusTotalEmployee`, `bonusTotalEmployer` として下部に表示。

**注意**: このフェーズでは月次の計算ロジックには一切組み込まず、「参考値の表示のみ」です。

---

## 10. 実装時の注意事項

### 10-1. 年度計算

必ず **4月1日基準**（`getFiscalYear`）を使用する。

### 10-2. 累計の管理

健保の上限は「累計有効標準賞与額」が 5,730,000 円を超えないようにする。

累計取得時は、編集対象の賞与を除外できるように `excludePayDate` を使う。

### 10-3. 端数処理

- **標準賞与額**：1,000 円未満切り捨て。
- **保険料**：1 円未満切り捨て（`Math.floor`）。

### 10-4. 介護保険

P1-6 では賞与に対して介護保険料の計算はしない（フィールドも作らない）。

### 10-5. Firestore の undefined

`setDoc` 前に `undefined` をフィルタしてから書き込む（既存実装と同じパターン）。

### 10-6. エラーハンドリング

- 料率未設定・Masters が見つからない場合は、`MatSnackBar` でユーザーにエラーを表示して計算を中断。
- `calculateBonusPremium` が `null` を返した場合も同様。
- 従業員が社会保険未加入（`isInsured === false`）の場合は、計算をスキップしてエラーメッセージを表示。

---

## 11. 動作確認・受け入れ条件

### 11-1. 賞与登録

- ✅ 賞与を登録すると、標準賞与額が「千円未満切り捨て」で正しく計算される。
- ✅ 健康保険の上限（年度内合計 5,730,000 円）が適用される。
- ✅ 厚生年金の上限（1回あたり 1,500,000 円）が適用される。
- ✅ 上限超過がある場合、警告メッセージが表示される。
- ✅ 健康保険・厚生年金・本人/会社の金額が正しく計算される。
- ✅ Firestore に `BonusPremium` ドキュメントが保存される。

### 11-2. 一覧表示

- ✅ 登録した賞与が `bonus-premiums.page.ts` の一覧に表示される。
- ✅ 従業員名が正しく解決され、`employeeId` と紐づいている。
- ✅ 合計（本人 / 会社）が下部に表示され、合計値が正しい。

### 11-3. 編集・削除

- ✅ 既存の賞与を開いて内容を編集できる。
- ✅ 編集時も健康保険の年度内累計が正しく再計算される（自己分を除外して算出）。
- ✅ 削除ボタンで、確認ダイアログのあとに削除できる。

### 11-4. エラーケース

- ✅ 料率未設定時に適切なエラーメッセージが表示される。
- ✅ 社会保険未加入の従業員を選択した場合、適切なエラーメッセージが表示される。
- ✅ 賞与支給額が 0 以下の場合、適切なエラーメッセージが表示される。

---

## 12. 参考実装

既存の実装パターンを参考にしてください：

- **`monthly-premiums.page.ts`** - 一覧表示と計算実行のパターン
- **`employees.page.ts`** - テーブル表示とCRUD操作のパターン
- **`premium-calculator.ts`** - 計算ロジックのパターン
- **`masters.page.ts`** - UIデザインのパターン
- **`employee-form-dialog.component.ts`** - ダイアログフォームのパターン

---

## 13. チェックリスト

実装完了後、以下を確認してください：

- [ ] `types.ts` の `BonusPremium` 型が拡張されている
- [ ] `bonus-calculator.ts` が作成され、計算ロジックが実装されている
- [ ] `BonusPremiumsService` が作成され、CRUD操作が実装されている
- [ ] `bonus-premiums.page.ts` が実装され、一覧表示・CRUD操作が動作する
- [ ] `bonus-form-dialog.component.ts` が作成され、登録・編集が動作する
- [ ] 標準賞与額の計算が正しく動作する（1,000円未満切り捨て）
- [ ] 健康保険の上限チェックが正しく動作する（573万円）
- [ ] 厚生年金の上限チェックが正しく動作する（150万円）
- [ ] 上限超過時の警告が表示される
- [ ] 編集時に累計が正しく再計算される
- [ ] 削除機能が動作する（確認ダイアログあり）
- [ ] エラーハンドリングが適切に実装されている
- [ ] UIデザインが既存ページと統一されている

---

**実装完了後は、この指示書のチェックリストを確認して、実装状況を更新してください。**
