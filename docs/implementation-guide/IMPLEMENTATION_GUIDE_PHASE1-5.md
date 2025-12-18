# P1-5 指示書（最終ドラフト）

**テーマ**: 標準報酬月額・等級・保険プランマスタ管理機能の実装

---

## 0. ゴール・位置づけ

CATALOG の (6)「標準報酬月額・等級・保険プランマスタ管理機能」を、InsurePath の実装として具体化するフェーズ。

今回は、以下 2 点までを P1-5 のスコープとする。

### 0-1. 標準報酬月額・保険料率マスタ管理の実装

- 事業所ごとの健康保険・介護保険・厚生年金のマスタ（年度別）を Firestore に保存・編集できる。
- 協会けんぽプリセット（都道府県別）、厚生年金・介護保険のプリセットを用意する。
- `MastersPage` から CRUD（一覧・追加・編集・削除）ができる。

### 0-2. 月次保険料計算画面をマスタ連携に切り替える

- `monthly-premiums.page.ts` から料率の手入力 UI を撤去し、対象年月を指定して計算するだけの画面にする。
- `MonthlyPremiumsService.saveForMonth()` がマスタから料率を自動取得して計算するように変更する。
- 画面上には、「この年月に適用される料率（健保・介護・厚年）」を参照用に表示する。

**※ 今回は標準報酬等級表（StandardRewardBand）は「登録・管理まで」。実際の計算ロジックではまだ使わず、現行通り `monthlyWage` + `healthGrade`/`pensionGrade` を利用する。**

---

## 1. 前提・現状

### 1-1. 既存の前提

- `types.ts` に以下の型が定義済み（必要に応じて微調整可）
  - `Employee`
  - `HealthRateTable`, `CareRateTable`, `PensionRateTable`
  - `StandardRewardBand`
  - `Office`
  - `MonthlyPremium`, `YearMonthString`, `IsoDateString` など

- `premium-calculator.ts` は P1-4 で以下が済んでいる前提
  - `monthlyWage` を「健保・厚年共通の標準報酬月額」として扱う
  - 等級は `employee.healthGrade` / `employee.pensionGrade`
  - `isInsured` が false の場合は対象外
  - `healthQualificationDate` / `healthLossDate` / `pensionQualificationDate` / `pensionLossDate` を使って、「当月に資格があるか」を判定済み

- `MonthlyPremiumsPage` / `MonthlyPremiumsService` は、まだ料率を画面から直接入力して計算する暫定版の実装になっている。

### 1-2. 注意事項

- `premium-calculator.ts` は P1-5 では変更しない。料率（`PremiumRateContext`）の中身をどこから持ってくるかだけを差し替える。
- 標準報酬等級表（`StandardRewardBand[]`）は今は計算に使わない。将来の「等級自動判定」や「過去月の等級履歴管理」で利用予定。

---

## 2. 対象ファイル

### 2-1. 既存ファイル（編集）

- `src/app/pages/masters/masters.page.ts`
  → 現状プレースホルダー → 実装に置き換える。

- `src/app/services/monthly-premiums.service.ts`
  → 料率をフォームから受け取る形 → マスタを参照する形に変更。

- `src/app/pages/premiums/monthly/monthly-premiums.page.ts`
  → 料率入力フォームを削除し、「対象年月＋結果表示」中心の画面に変更。

- `src/app/types.ts`
  → 既存の `HealthRateTable`, `CareRateTable`, `PensionRateTable`, `StandardRewardBand`, `Office` の定義を、実装と矛盾しないよう必要に応じて微調整。

**前提**: `Office` に以下が存在している前提（前フェーズで定義済み）
- `healthPlanType: 'kyokai' | 'kumiai'`
- `kyokaiPrefCode?: string`
- `kyokaiPrefName?: string`
- `unionName?: string`
- `unionCode?: string`

### 2-2. 新規ファイル

- `src/app/services/masters.service.ts`
  → 保険料率マスタ（健康・介護・厚年）の CRUD と、「対象年月での料率取得」ユーティリティ。

- `src/app/utils/kyokai-presets.ts`
  → 協会けんぽプリセット・標準報酬等級表・介護／厚年の基本プリセット。

- `src/app/pages/masters/health-master-form-dialog.component.ts`
  → 健康保険マスタ編集用ダイアログ。

- `src/app/pages/masters/care-master-form-dialog.component.ts`
  → 介護保険マスタ編集用ダイアログ。

- `src/app/pages/masters/pension-master-form-dialog.component.ts`
  → 厚生年金マスタ編集用ダイアログ。

**補足**: Office 情報の取得には、既存の `CurrentOfficeService` または `OfficesService` 等、現行実装に合わせて最適な手段を利用して良い。

---

## 3. Firestore コレクション構造

`offices/{officeId}` 配下に、年度別のマスタを持つ。

```
offices/
  {officeId}/
    healthRateTables/
      {tableId}/
        id: string
        officeId: string
        year: number
        planType: 'kyokai' | 'kumiai'
        kyokaiPrefCode?: string
        kyokaiPrefName?: string
        unionName?: string
        unionCode?: string
        healthRate: number
        bands: StandardRewardBand[]
        createdAt: string
        updatedAt: string

    careRateTables/
      {tableId}/
        id: string
        officeId: string
        year: number
        careRate: number
        createdAt: string
        updatedAt: string

    pensionRateTables/
      {tableId}/
        id: string
        officeId: string
        year: number
        pensionRate: number
        bands: StandardRewardBand[]
        createdAt: string
        updatedAt: string
```

**「厚生年金マスタは全国共通」だが、実装の簡潔さのために `officeId` も保持する（UI 的には事業所ごとに見える形で OK）。**

年度の扱いはシンプルに「`year = 年`（例: 2025）」で管理する。

---

## 4. MastersService の仕様

**ファイル**: `src/app/services/masters.service.ts`

### 4-1. 基本構造

```typescript
import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  orderBy
} from '@angular/fire/firestore';
import { from, map, Observable, firstValueFrom } from 'rxjs';

import {
  CareRateTable,
  HealthRateTable,
  Office,
  PensionRateTable,
  StandardRewardBand,
  YearMonthString
} from '../types';

@Injectable({ providedIn: 'root' })
export class MastersService {
  constructor(private readonly firestore: Firestore) {}

  // 健保／介護／厚年 各コレクションの ref 取得ヘルパー
}
```

### 4-2. コレクション参照ヘルパー

```typescript
private getHealthCollectionRef(officeId: string) {
  return collection(this.firestore, 'offices', officeId, 'healthRateTables');
}

private getCareCollectionRef(officeId: string) {
  return collection(this.firestore, 'offices', officeId, 'careRateTables');
}

private getPensionCollectionRef(officeId: string) {
  return collection(this.firestore, 'offices', officeId, 'pensionRateTables');
}
```

### 4-3. 健康保険マスタ CRUD

#### `listHealthRateTables(officeId: string): Observable<HealthRateTable[]>`

```typescript
/**
 * 健康保険マスタ一覧を取得（年度降順）
 */
listHealthRateTables(officeId: string): Observable<HealthRateTable[]> {
  const ref = this.getHealthCollectionRef(officeId);
  const q = query(ref, orderBy('year', 'desc'));
  
  return from(getDocs(q)).pipe(
    map((snapshot) =>
      snapshot.docs.map(
        (d) =>
          ({
            id: d.id,
            ...(d.data() as any)
          } as HealthRateTable)
      )
    )
  );
}
```

#### `getHealthRateTable(officeId: string, id: string): Observable<HealthRateTable | null>`

```typescript
/**
 * 健康保険マスタを1件取得
 */
getHealthRateTable(officeId: string, id: string): Observable<HealthRateTable | null> {
  const ref = doc(this.getHealthCollectionRef(officeId), id);
  return from(getDoc(ref)).pipe(
    map((snapshot) => {
      if (!snapshot.exists()) {
        return null;
      }
      return {
        id: snapshot.id,
        ...(snapshot.data() as any)
      } as HealthRateTable;
    })
  );
}
```

#### `async saveHealthRateTable(officeId: string, table: Partial<HealthRateTable> & { id?: string }): Promise<void>`

```typescript
/**
 * 健康保険マスタを保存（新規作成または更新）
 */
async saveHealthRateTable(
  officeId: string,
  table: Partial<HealthRateTable> & { id?: string }
): Promise<void> {
  const collectionRef = this.getHealthCollectionRef(officeId);
  const ref = table.id ? doc(collectionRef, table.id) : doc(collectionRef);
  const now = new Date().toISOString();

  const payload: HealthRateTable = {
    id: ref.id,
    officeId,
    year: Number(table.year ?? new Date().getFullYear()),
    planType: table.planType ?? 'kyokai',
    healthRate: Number(table.healthRate ?? 0),
    bands: table.bands ?? [],
    createdAt: table.createdAt ?? now,
    updatedAt: now,
  };

  // オプショナルフィールドを追加
  if (table.kyokaiPrefCode != null) payload.kyokaiPrefCode = table.kyokaiPrefCode;
  if (table.kyokaiPrefName != null) payload.kyokaiPrefName = table.kyokaiPrefName;
  if (table.unionName != null) payload.unionName = table.unionName;
  if (table.unionCode != null) payload.unionCode = table.unionCode;

  // undefined を削除
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as HealthRateTable;

  await setDoc(ref, cleanPayload, { merge: true });
}
```

#### `async deleteHealthRateTable(officeId: string, id: string): Promise<void>`

```typescript
/**
 * 健康保険マスタを削除
 */
async deleteHealthRateTable(officeId: string, id: string): Promise<void> {
  const ref = doc(this.getHealthCollectionRef(officeId), id);
  return deleteDoc(ref);
}
```

### 4-4. 介護保険マスタ CRUD

同様の構造で以下を実装：

- `listCareRateTables(officeId: string): Observable<CareRateTable[]>`
- `getCareRateTable(officeId: string, id: string): Observable<CareRateTable | null>`
- `async saveCareRateTable(officeId: string, table: Partial<CareRateTable> & { id?: string }): Promise<void>`
  - `careRate` のみ（等級表なし）。
- `async deleteCareRateTable(officeId: string, id: string): Promise<void>`

### 4-5. 厚生年金マスタ CRUD

同様の構造で以下を実装：

- `listPensionRateTables(officeId: string): Observable<PensionRateTable[]>`
- `getPensionRateTable(officeId: string, id: string): Observable<PensionRateTable | null>`
- `async savePensionRateTable(officeId: string, table: Partial<PensionRateTable> & { id?: string }): Promise<void>`
- `async deletePensionRateTable(officeId: string, id: string): Promise<void>`

### 4-6. 対象年月の料率取得ユーティリティ

**P1-5 の肝。`MonthlyPremiumsService` から利用する。**

```typescript
/**
 * 対象年月に適用される保険料率セットを取得する。
 *
 * - yearMonth の「年」（例: '2025-09' → 2025）を年度として扱う。
 * - 健康保険:
 *   - office.healthPlanType === 'kyokai' の場合:
 *     - office.kyokaiPrefCode と year が一致するレコードから1件選ぶ（なければ null 相当）。
 *   - office.healthPlanType === 'kumiai' の場合:
 *     - officeId + year で 1件選ぶ（組合名・コードは office に保持）。
 * - 介護保険:
 *   - officeId + year で 1件選ぶ。
 * - 厚生年金:
 *   - officeId + year で 1件選ぶ（全国共通だが実装簡略化のため officeId も含める）。
 *
 * 戻り値:
 *  - healthRate / careRate / pensionRate は、見つからなければ undefined。
 */
async getRatesForYearMonth(
  office: Office,
  yearMonth: YearMonthString
): Promise<{
  healthRate?: number;
  careRate?: number;
  pensionRate?: number;
}> {
  const year = parseInt(yearMonth.substring(0, 4), 10);
  const officeId = office.id;

  const results: {
    healthRate?: number;
    careRate?: number;
    pensionRate?: number;
  } = {};

  // 健康保険料率の取得
  if (office.healthPlanType === 'kyokai' && office.kyokaiPrefCode) {
    // 協会けんぽ: 都道府県コード + 年度で検索
    const healthRef = this.getHealthCollectionRef(officeId);
    const healthQuery = query(
      healthRef,
      where('year', '==', year),
      where('planType', '==', 'kyokai'),
      where('kyokaiPrefCode', '==', office.kyokaiPrefCode)
    );
    const healthSnapshot = await firstValueFrom(from(getDocs(healthQuery)));
    if (!healthSnapshot.empty) {
      results.healthRate = healthSnapshot.docs[0].data()['healthRate'] as number;
    }
  } else if (office.healthPlanType === 'kumiai') {
    // 組合健保: officeId + 年度で検索
    const healthRef = this.getHealthCollectionRef(officeId);
    const healthQuery = query(
      healthRef,
      where('year', '==', year),
      where('planType', '==', 'kumiai')
    );
    const healthSnapshot = await firstValueFrom(from(getDocs(healthQuery)));
    if (!healthSnapshot.empty) {
      results.healthRate = healthSnapshot.docs[0].data()['healthRate'] as number;
    }
  }

  // 介護保険料率の取得
  const careRef = this.getCareCollectionRef(officeId);
  const careQuery = query(careRef, where('year', '==', year));
  const careSnapshot = await firstValueFrom(from(getDocs(careQuery)));
  if (!careSnapshot.empty) {
    results.careRate = careSnapshot.docs[0].data()['careRate'] as number;
  }

  // 厚生年金料率の取得
  const pensionRef = this.getPensionCollectionRef(officeId);
  const pensionQuery = query(pensionRef, where('year', '==', year));
  const pensionSnapshot = await firstValueFrom(from(getDocs(pensionQuery)));
  if (!pensionSnapshot.empty) {
    results.pensionRate = pensionSnapshot.docs[0].data()['pensionRate'] as number;
  }

  return results;
}
```

**重要**: ここでは「単純に year 一致のレコードを1件選ぶ」だけでよい。将来の「改定月による切り替え」は別フェーズで拡張する。

---

## 5. 協会けんぽプリセット & 等級表

**ファイル**: `src/app/utils/kyokai-presets.ts`

### 5-1. 都道府県コードマッピング

```typescript
export const PREFECTURE_CODES: Record<string, string> = {
  '01': '北海道',
  '02': '青森県',
  '03': '岩手県',
  '04': '宮城県',
  '05': '秋田県',
  '06': '山形県',
  '07': '福島県',
  '08': '茨城県',
  '09': '栃木県',
  '10': '群馬県',
  '11': '埼玉県',
  '12': '千葉県',
  '13': '東京都',
  '14': '神奈川県',
  '15': '新潟県',
  '16': '富山県',
  '17': '石川県',
  '18': '福井県',
  '19': '山梨県',
  '20': '長野県',
  '21': '岐阜県',
  '22': '静岡県',
  '23': '愛知県',
  '24': '三重県',
  '25': '滋賀県',
  '26': '京都府',
  '27': '大阪府',
  '28': '兵庫県',
  '29': '奈良県',
  '30': '和歌山県',
  '31': '鳥取県',
  '32': '島根県',
  '33': '岡山県',
  '34': '広島県',
  '35': '山口県',
  '36': '徳島県',
  '37': '香川県',
  '38': '愛媛県',
  '39': '高知県',
  '40': '福岡県',
  '41': '佐賀県',
  '42': '長崎県',
  '43': '熊本県',
  '44': '大分県',
  '45': '宮崎県',
  '46': '鹿児島県',
  '47': '沖縄県',
};
```

### 5-2. 協会けんぽ健康保険料率（例・ダミー値）

```typescript
/**
 * 協会けんぽの健康保険料率（都道府県別、例としての値）
 *
 * ※ 実際の値はユーザーがマスタ画面で編集できる前提。
 *   ここでは「初期値としてのサンプル」を用意するだけ。
 */
export const KYOKAI_HEALTH_RATES_2024: Record<string, number> = {
  '01': 0.1000,
  '13': 0.0981,
  '27': 0.0985,
  // ... 必要に応じて主要都道府県のみ定義してもよい
};
```

### 5-3. 標準報酬等級表の基本配列

```typescript
import { StandardRewardBand } from '../types';

/**
 * 標準報酬等級表（健康保険・厚生年金共通の基本構造）
 *
 * 実際の等級表は等級1〜47まで存在するが、ここでは主要な等級のみを定義。
 * ユーザーがマスタ画面で全等級を登録できるようにする。
 */
export const STANDARD_REWARD_BANDS_BASE: StandardRewardBand[] = [
  { grade: 1, lowerLimit: 0, upperLimit: 63000, standardMonthly: 58000 },
  { grade: 2, lowerLimit: 63000, upperLimit: 73000, standardMonthly: 68000 },
  { grade: 3, lowerLimit: 73000, upperLimit: 83000, standardMonthly: 78000 },
  { grade: 4, lowerLimit: 83000, upperLimit: 93000, standardMonthly: 88000 },
  { grade: 5, lowerLimit: 93000, upperLimit: 101000, standardMonthly: 98000 },
  { grade: 6, lowerLimit: 101000, upperLimit: 107000, standardMonthly: 104000 },
  { grade: 7, lowerLimit: 107000, upperLimit: 114000, standardMonthly: 110000 },
  { grade: 8, lowerLimit: 114000, upperLimit: 122000, standardMonthly: 118000 },
  { grade: 9, lowerLimit: 122000, upperLimit: 130000, standardMonthly: 126000 },
  { grade: 10, lowerLimit: 130000, upperLimit: 138000, standardMonthly: 134000 },
  // ... 等級11〜47も同様に定義
  // 実際の値は公式サイトで確認が必要
];
```

**注意**: P1-5 では「等級表を管理する UI がある」ことが目的。計算ではまだ `standardMonthly` を参照しない。

### 5-4. 介護・厚年のプリセット

```typescript
export const CARE_RATE_2024 = 0.0191;   // サンプル値
export const PENSION_RATE_2024 = 0.183; // サンプル値
```

### 5-5. プリセット取得関数

```typescript
import { CareRateTable, HealthRateTable, PensionRateTable } from '../types';

export function getKyokaiHealthRatePreset(
  prefCode: string,
  year: number
): Partial<HealthRateTable> {
  return {
    year,
    planType: 'kyokai',
    kyokaiPrefCode: prefCode,
    kyokaiPrefName: PREFECTURE_CODES[prefCode] ?? '',
    healthRate: KYOKAI_HEALTH_RATES_2024[prefCode] ?? 0.1000,
    bands: STANDARD_REWARD_BANDS_BASE,
  };
}

export function getCareRatePreset(year: number): Partial<CareRateTable> {
  return {
    year,
    careRate: CARE_RATE_2024,
  };
}

export function getPensionRatePreset(year: number): Partial<PensionRateTable> {
  return {
    year,
    pensionRate: PENSION_RATE_2024,
    bands: STANDARD_REWARD_BANDS_BASE,
  };
}
```

---

## 6. MastersPage（マスタ管理画面）の仕様

**ファイル**: `src/app/pages/masters/masters.page.ts`

### 6-1. UI 概要

**画面構成**:
- タイトル: 「マスタ管理」
- 説明文: 「保険料率や標準報酬等級を年度別に管理します。」
- タブ:
  - 「健康保険マスタ」
  - 「介護保険マスタ」
  - 「厚生年金マスタ」

### 6-2. 各タブの共通要素

- 年度別のマスタ一覧を `MatTable` で表示
- 上部右側に「新規登録」ボタン
- 行末に「編集」「削除」ボタン
- 読み取りは `MastersService` の `listXXXRateTables` を利用
- ダイアログは以下コンポーネントを利用
  - 健保: `HealthMasterFormDialogComponent`
  - 介護: `CareMasterFormDialogComponent`
  - 厚年: `PensionMasterFormDialogComponent`

### 6-3. 表示項目例（健康保険マスタ）

- 年度（year）
- プラン種別（協会けんぽ / 組合健保）
- 都道府県名 or 組合名
- 健康保険料率（パーセント表示）
- 等級数（`bands.length`）
- 操作（編集・削除）

介護・厚年は適宜簡略化してよい（料率 + 等級数 など）。

---

## 7. マスタ編集ダイアログの仕様（概要）

### 7-1. HealthMasterFormDialog

**フォーム項目**:
- 年度（number, required）
- プラン種別（select: 'kyokai' | 'kumiai'）
- 協会けんぽの場合:
  - 都道府県コード（select + `PREFECTURE_CODES`）
  - 都道府県名（表示のみ or 自動入力）
- 組合健保の場合:
  - 組合名
  - 組合コード
- 健康保険料率（number, 0.01〜1.0）
- 標準報酬等級表（`FormArray<StandardRewardBand>`）

**新規作成時のみ「協会けんぽの初期値を読み込む」ボタン**
- クリックで `getKyokaiHealthRatePreset` を呼び出してフォームにセット。

### 7-2. CareMasterFormDialog

- 年度
- 介護保険料率
- **新規作成時のみ「初期値を読み込む」**（`getCareRatePreset`）

### 7-3. PensionMasterFormDialog

- 年度
- 厚生年金料率
- 標準報酬等級表
- **新規作成時のみ「初期値を読み込む」**（`getPensionRatePreset`）

実装パターンは `EmployeeFormDialogComponent` と同じく `ReactiveFormsModule` + `MatDialog` + `FormArray` で OK。

---

## 8. 月次保険料計算との連携

ここが P1-5 の後半のメイン。

### 8-1. SaveForMonthOptions の変更

**ファイル**: `src/app/services/monthly-premiums.service.ts`

**現状**:
```typescript
export interface SaveForMonthOptions {
  officeId: string;
  yearMonth: YearMonthString;
  calcDate: IsoDateString;
  healthRate: number;
  careRate?: number;
  pensionRate: number;
  employees: Employee[];
  calculatedByUserId: string;
}
```

**これを、料率を含まない形に変更する**:
```typescript
export interface SaveForMonthOptions {
  officeId: string;
  yearMonth: YearMonthString;
  calcDate: IsoDateString;
  employees: Employee[];
  calculatedByUserId: string;
}
```

### 8-2. saveForMonth 内のロジック変更

引数から `healthRate` / `careRate` / `pensionRate` を削除。

`MastersService` と `Office` 情報を使って、当該年月の料率を取得する。

```typescript
async saveForMonth(options: SaveForMonthOptions): Promise<MonthlyPremium[]> {
  const { officeId, yearMonth, calcDate, employees, calculatedByUserId } = options;

  // 1. Office 情報の取得（既存の仕組みに合わせる）
  // OfficesService に getOfficeById があればそれを使う、なければ firstValueFrom(watchOffice) を使う
  const office = await firstValueFrom(this.officesService.watchOffice(officeId));
  if (!office) {
    throw new Error(`事業所が見つかりません: ${officeId}`);
  }

  // 2. MastersService から対象年月の料率セットを取得
  const { healthRate, careRate, pensionRate } =
    await this.mastersService.getRatesForYearMonth(office, yearMonth);

  if (healthRate == null || pensionRate == null) {
    // 健保・厚年のどちらかが取得できなければエラー
    throw new Error('healthRate / pensionRate がマスタに設定されていません');
  }

  const rateContext: PremiumRateContext = {
    yearMonth,
    calcDate,
    healthRate,
    careRate,
    pensionRate,
  };

  // 以降は現行実装と同じロジックでOK（従業員ループ→ calculateMonthlyPremiumForEmployee → Firestore 保存）
  // ...
}
```

**ポイント**:
- `premium-calculator.ts` の仕様に合わせて `healthRate`/`pensionRate` は必須。
- `careRate` は `undefined` でも計算できる（計算側で 0 扱い）。

**注意**: `MonthlyPremiumsService` に `MastersService` と `OfficesService` を注入する必要がある。

---

## 9. 月次保険料ページ（UI）の修正

**ファイル**: `src/app/pages/premiums/monthly/monthly-premiums.page.ts`

### 9-1. フォーム構造の変更

**現状**:
```typescript
readonly form = this.fb.group({
  yearMonth: [new Date().toISOString().substring(0, 7), Validators.required],
  healthRate: [null, ...],
  careRate: [null, ...],
  pensionRate: [null, ...]
});
```

**これを対象年月のみにする**:
```typescript
readonly form = this.fb.group({
  yearMonth: [new Date().toISOString().substring(0, 7), Validators.required]
});
```

### 9-2. 料率入力欄の削除

テンプレート内の以下 3 つの `mat-form-field` を削除：
- 健康保険 料率（合計）
- 介護保険 料率（合計）
- 厚生年金 料率（合計）

### 9-3. 適用料率の表示ブロック追加

`MastersService` から取得した料率を `signal` に保持し、テンプレート上に「適用料率」として表示する。

```typescript
readonly rateSummary = signal<{
  healthRate?: number;
  careRate?: number;
  pensionRate?: number;
} | null>(null);
```

`onCalculateAndSave` 実行前 or 中で、`MastersService.getRatesForYearMonth` を呼び出して `rateSummary` を更新する。

**テンプレート例**:
```html
<mat-card>
  <h1>月次保険料 一覧・再計算</h1>
  <p>
    対象年月を指定し、マスタで定義された保険料率を用いて
    現在の事業所に所属する社会保険加入者の月次保険料を一括計算・保存します。
  </p>

  <form [formGroup]="form" (ngSubmit)="onCalculateAndSave()" class="premium-form">
    <div class="form-grid">
      <mat-form-field appearance="outline">
        <mat-label>対象年月</mat-label>
        <input matInput type="month" formControlName="yearMonth" required />
      </mat-form-field>
    </div>

    <div class="rate-summary" *ngIf="rateSummary() as r">
      <p>適用される保険料率（{{ form.get('yearMonth')?.value }}）</p>
      <ul>
        <li>健康保険: {{ r.healthRate != null ? (r.healthRate | percent:'1.2-2') : '未設定' }}</li>
        <li>介護保険: {{ r.careRate != null ? (r.careRate | percent:'1.2-2') : '-' }}</li>
        <li>厚生年金: {{ r.pensionRate != null ? (r.pensionRate | percent:'1.2-2') : '未設定' }}</li>
      </ul>
    </div>

    <div class="actions">
      <button
        mat-raised-button
        color="primary"
        type="submit"
        [disabled]="form.invalid || !(officeId$ | async) || loading()"
      >
        <mat-spinner *ngIf="loading()" diameter="20" class="inline-spinner"></mat-spinner>
        計算して保存
      </button>
    </div>
  </form>
</mat-card>
```

**任意**: 「`healthRate` / `pensionRate` が未設定の場合はボタンを無効化」などの UX 改良はおまかせ。

### 9-4. onCalculateAndSave の変更

料率を `form` から読む処理を削除。

`MonthlyPremiumsService.saveForMonth` への引数も対応させる。

```typescript
const yearMonth = formValue.yearMonth as string;
const calcDate = new Date().toISOString();

const employees = await firstValueFrom(this.employeesService.list(officeId));

const savedPremiums = await this.monthlyPremiumsService.saveForMonth({
  officeId,
  yearMonth,
  calcDate,
  employees: employees as Employee[],
  calculatedByUserId
});
```

その直前か `saveForMonth` の中で、`MastersService.getRatesForYearMonth` を呼び、`rateSummary` にセットしておく。

**注意**: `MonthlyPremiumsPage` に `MastersService` と `CurrentOfficeService`（または `OfficesService`）を注入する必要がある。

---

## 10. スコープ外（今回やらないこと）

P1-5 では以下はやらない：

- ❌ 報酬月額からの「標準報酬等級の自動判定」
- ❌ 標準報酬等級表を利用した等級自動更新
- ❌ 過去年度にまたがる細かい改定月の管理（4月改定などの境目ロジック）
- ❌ CSVインポート・エクスポート
- ❌ ボーナス（賞与）保険料画面とのマスタ連携

---

## 11. 動作確認・受け入れ条件

### 11-1. マスタ管理

`MastersPage` で：
- ✅ 健康保険 / 介護保険 / 厚生年金 のタブが切り替えられる。
- ✅ 各タブで年度別マスタの一覧が表示される（空の場合は空表示）。
- ✅ 「新規登録」からマスタを登録できる。
- ✅ 既存マスタを編集できる。
- ✅ マスタを削除できる（確認ダイアログあり）。
- ✅ 健康保険マスタで「協会けんぽの初期値を読み込む」ボタンが動作し、フォームにプリセット値が入る。

### 11-2. 月次保険料計算画面

- ✅ 月次保険料画面から料率入力欄がなくなっている。
- ✅ 対象年月を選んだとき、画面上部に「適用料率」が表示される。
- ✅ 健康保険・厚生年金のマスタが未設定の場合、計算時にエラー扱いになり、`MatSnackBar` で分かりやすいメッセージが表示される。
- ✅ マスタが設定されている場合、従業員ごとの月次保険料が正しく計算・保存され、テーブルに表示される。
- ✅ 入社前・資格取得前の月には、その従業員のレコードが作成されない（P1-4 のロジック維持）。
- ✅ 過去の年月を指定しても、当時のマスタ（対象年度のレコード）で計算される。

---

## 12. 実装時の注意事項

1. **既存コードの保護**: `premium-calculator.ts` は変更しない
2. **年度管理**: 年度ごとに複数のマスタが存在可能（改定対応）
3. **協会けんぽの都道府県情報**: `Office` の `kyokaiPrefCode` と連携
4. **標準報酬等級表のバリデーション**: 等級間の重複チェック（任意）
5. **Firestore の undefined**: `undefined` フィールドは保存しない
6. **エラーハンドリング**: マスタ未設定時のエラーメッセージを分かりやすく

---

## 13. 参考実装

既存の `EmployeesPage` や `OfficesPage` のパターンを参考にしてください：

- `CurrentOfficeService` の使用
- `MatTableModule` でのテーブル表示
- `MatDialog` での編集ダイアログ
- `MatSnackBar` での通知
- `signal` での状態管理

---

**実装完了後は、この指示書のチェックリストを確認して、実装状況を更新してください。**
