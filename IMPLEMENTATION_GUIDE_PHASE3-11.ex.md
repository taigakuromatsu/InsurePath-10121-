# Phase3-11.ex 実装指示書: 保険料率マスタの「年度ベース」→「適用開始年月ベース」への全面移行

**作成日**: 2025年12月4日  
**対象フェーズ**: Phase3-11.ex（拡張）  
**優先度**: 🟡 中（年度途中改定対応のため重要）  
**依存関係**: Phase3-11（クラウドマスタ機能）  
**目標完了日**: 2025年12月6日

---

## 📋 概要

Phase3-11.exでは、**保険料率マスタの管理単位を「年度」から「適用開始年月（effectiveYear, effectiveMonth）」に全面移行**します。

これにより、年度途中の改定（例：2025年3月改定）を正しく扱えるようになり、月次保険料・賞与保険料の計算ロジックが「対象月に有効なマスタ」を自動的に選択する仕組みに統一されます。

### 主な変更点

1. **型定義の変更**: すべてのマスタ型に`effectiveYear`、`effectiveMonth`、`effectiveYearMonth`フィールドを追加
2. **ID形式の変更**: クラウドマスタのIDを`"{effectiveYearMonth}_{prefCode}"`形式に変更
3. **UIの変更**: 年度選択から適用開始年月選択への変更
4. **ロジックの変更**: 「対象月に有効な最新マスタ」を取得するロジックに統一

### 重要な位置づけ

- **年度途中改定への対応**: 2025年3月改定のような年度途中の改定を正しく扱える
- **対象月ベースの計算**: 月次保険料・賞与保険料のどちらも「対象月に有効なマスタ」を使用
- **破壊的変更**: 既存の年度ベースのデータは少ない前提で、必要なら手動再登録で対応

---

## 🎯 目的・このフェーズで達成したいこと

### 主な目的

1. **年度途中改定への対応**: 年度途中（例：3月）の改定を正しく扱えるようにする
2. **ロジックの統一**: 月次保険料・賞与保険料のどちらも「対象月に有効なマスタ」を使用する仕組みに統一
3. **運用の簡素化**: 改定があった月だけレコードを登録する運用で、データ量を最小化

### このフェーズで達成する具体的な成果

- 2025年3月改定の場合、2025年3月以降は新料率、2025年1-2月は旧料率が自動的に適用される
- 月次保険料計算時に「その月に有効な最新マスタ」が自動的に選択される
- 賞与保険料計算時も「支給月に有効な最新マスタ」が自動的に選択される
- クラウドマスタ・事業所マスタの両方で適用開始年月ベースの管理が可能になる

---

## 📎 対象範囲・非対象（スコープ / アウトオブスコープ）

### 対象範囲（Phase3-11.exで実装する内容）

#### 1. 型定義の変更

- `CloudHealthRateTable`、`CloudCareRateTable`、`CloudPensionRateTable`に適用開始年月フィールドを追加
- `HealthRateTable`、`CareRateTable`、`PensionRateTable`に適用開始年月フィールドを追加
- 既存の`year`フィールドは**完全に削除**する（今後使用しない）

#### 2. CloudMasterServiceの変更

- ID形式を`"{effectiveYearMonth}_{prefCode}"`形式に変更
- 「対象月に有効な最新マスタ」を取得するメソッドに変更
- Firestoreの複合インデックス設定

#### 3. UIの変更

- クラウドマスタ管理画面: 年度選択から適用開始年月選択へ変更
- 事業所マスタ管理画面: 年度選択から適用開始年月選択へ変更
- 一覧表示: 「年度」列を「適用開始年月」列に変更

#### 4. 保険料計算ロジックの変更

- `MastersService.getRatesForYearMonth`を唯一の入口としてロジックを統一
- `getRatesForYearMonth`メソッドを適用開始年月ベースに変更
- 月次保険料・賞与保険料はこのメソッドを通じてマスタを参照
- 共通ユーティリティ関数は作成せず、すべて`MastersService`内にまとめる

#### 5. データ移行

- 既存の年度ベースデータの移行（必要に応じて手動再登録）

### 非対象範囲（Phase3-11.exでは実装しない内容）

- **段階的移行**: 本課題では一気に仕様を切り替える（段階的移行は行わない）
- **既存データの自動移行**: 既存データは少ない前提で、必要なら手動再登録で対応
- **年度ラベルの自動生成**: `label`フィールドは任意で、手動入力とする

---

## 📊 現在の実装状況

### 既存の実装（Phase3-11で実装済み）

- クラウドマスタの基本機能（年度ベース）
- 事業所マスタの基本機能（年度ベース）
- 月次保険料計算ロジック（年度ベース）
- 賞与保険料計算ロジック（年度ベース）

### 変更が必要な箇所

1. **型定義**: `types.ts`のすべてのマスタ型
2. **CloudMasterService**: ID形式と取得ロジック
3. **MastersService**: 取得ロジックと保存ロジック
4. **UI**: クラウドマスタ管理画面、事業所マスタ管理画面
5. **保険料計算**: `monthly-premiums.service.ts`、`bonus-premiums.service.ts`

---

## 🗂️ データ構造

### 1. CloudHealthRateTable（変更後）

```typescript
export interface CloudHealthRateTable {
  id: string; // 形式: "{effectiveYearMonth}_{prefCode}"（例: "202503_13"）
  effectiveYear: number; // 適用開始年（西暦、例: 2025）
  effectiveMonth: number; // 適用開始月（1-12、例: 3）
  effectiveYearMonth: number; // effectiveYear * 100 + effectiveMonth（例: 202503）
  planType: 'kyokai'; // クラウドマスタは協会けんぽのみ
  kyokaiPrefCode: string; // 都道府県コード（2桁、例: "13"）
  kyokaiPrefName: string; // 都道府県名（例: "東京都"）
  healthRate: number; // 健康保険料率（事業主＋被保険者合計の率、小数形式）
  bands: StandardRewardBand[]; // 標準報酬等級表
  label?: string; // 任意: 表示用ラベル（例: "令和7年度"）
  createdAt: IsoDateString; // 必須（Cloudマスタは必ず作成日時を持つ）
  updatedAt: IsoDateString; // 必須（Cloudマスタは必ず更新日時を持つ）
  updatedByUserId: string; // 必須（Cloudマスタは必ず更新者IDを持つ）
}
```

### 2. CloudCareRateTable（変更後）

```typescript
export interface CloudCareRateTable {
  id: string; // 形式: "{effectiveYearMonth}"（例: "202503"）
  effectiveYear: number; // 適用開始年（西暦）
  effectiveMonth: number; // 適用開始月（1-12）
  effectiveYearMonth: number; // effectiveYear * 100 + effectiveMonth
  careRate: number; // 介護保険料率（事業主＋被保険者合計の率、全国一律）
  label?: string; // 任意: 表示用ラベル
  createdAt: IsoDateString; // 必須（Cloudマスタは必ず作成日時を持つ）
  updatedAt: IsoDateString; // 必須（Cloudマスタは必ず更新日時を持つ）
  updatedByUserId: string; // 必須（Cloudマスタは必ず更新者IDを持つ）
}
```

### 3. CloudPensionRateTable（変更後）

```typescript
export interface CloudPensionRateTable {
  id: string; // 形式: "{effectiveYearMonth}"（例: "202503"）
  effectiveYear: number; // 適用開始年（西暦）
  effectiveMonth: number; // 適用開始月（1-12）
  effectiveYearMonth: number; // effectiveYear * 100 + effectiveMonth
  pensionRate: number; // 厚生年金保険料率（事業主＋被保険者合計の率、全国一律）
  bands: StandardRewardBand[]; // 標準報酬等級表
  label?: string; // 任意: 表示用ラベル
  createdAt: IsoDateString; // 必須（Cloudマスタは必ず作成日時を持つ）
  updatedAt: IsoDateString; // 必須（Cloudマスタは必ず更新日時を持つ）
  updatedByUserId: string; // 必須（Cloudマスタは必ず更新者IDを持つ）
}
```

### 4. HealthRateTable（変更後）

```typescript
export interface HealthRateTable {
  id: string;
  officeId: string;
  effectiveYear: number; // 適用開始年（西暦）
  effectiveMonth: number; // 適用開始月（1-12）
  effectiveYearMonth: number; // effectiveYear * 100 + effectiveMonth
  planType: HealthPlanType;
  kyokaiPrefCode?: string;
  kyokaiPrefName?: string;
  unionName?: string;
  unionCode?: string;
  healthRate: number;
  bands: StandardRewardBand[];
  createdAt?: IsoDateString; // 任意（既存データとの互換性のため。実データでは必ず設定されている前提なら必須にしてもよい）
  updatedAt?: IsoDateString; // 任意（既存データとの互換性のため。実データでは必ず設定されている前提なら必須にしてもよい）
}
```

### 5. CareRateTable（変更後）

```typescript
export interface CareRateTable {
  id: string;
  officeId: string;
  effectiveYear: number; // 適用開始年（西暦）
  effectiveMonth: number; // 適用開始月（1-12）
  effectiveYearMonth: number; // effectiveYear * 100 + effectiveMonth
  careRate: number;
  createdAt?: IsoDateString; // 任意（既存データとの互換性のため。実データでは必ず設定されている前提なら必須にしてもよい）
  updatedAt?: IsoDateString; // 任意（既存データとの互換性のため。実データでは必ず設定されている前提なら必須にしてもよい）
}
```

### 6. PensionRateTable（変更後）

```typescript
export interface PensionRateTable {
  id: string;
  officeId: string;
  effectiveYear: number; // 適用開始年（西暦）
  effectiveMonth: number; // 適用開始月（1-12）
  effectiveYearMonth: number; // effectiveYear * 100 + effectiveMonth
  pensionRate: number;
  bands: StandardRewardBand[];
  createdAt?: IsoDateString; // 任意（既存データとの互換性のため。実データでは必ず設定されている前提なら必須にしてもよい）
  updatedAt?: IsoDateString; // 任意（既存データとの互換性のため。実データでは必ず設定されている前提なら必須にしてもよい）
}
```

---

## 🔧 実装詳細

### 1. 型定義の変更（`src/app/types.ts`）

#### 1-1. CloudHealthRateTableの変更

```typescript
export interface CloudHealthRateTable {
  id: string; // 形式: "{effectiveYearMonth}_{prefCode}"
  effectiveYear: number;
  effectiveMonth: number;
  effectiveYearMonth: number; // effectiveYear * 100 + effectiveMonth
  planType: 'kyokai';
  kyokaiPrefCode: string;
  kyokaiPrefName: string;
  healthRate: number;
  bands: StandardRewardBand[];
  label?: string; // 任意: 表示用ラベル（例: "令和7年度"）
  createdAt: IsoDateString; // 必須（Cloudマスタは必ず作成日時を持つ）
  updatedAt: IsoDateString; // 必須（Cloudマスタは必ず更新日時を持つ）
  updatedByUserId: string; // 必須（Cloudマスタは必ず更新者IDを持つ）
}
```

#### 1-2. CloudCareRateTableの変更

```typescript
export interface CloudCareRateTable {
  id: string; // 形式: "{effectiveYearMonth}"
  effectiveYear: number;
  effectiveMonth: number;
  effectiveYearMonth: number;
  careRate: number;
  label?: string;
  createdAt: IsoDateString; // 必須（Cloudマスタは必ず作成日時を持つ）
  updatedAt: IsoDateString; // 必須（Cloudマスタは必ず更新日時を持つ）
  updatedByUserId: string; // 必須（Cloudマスタは必ず更新者IDを持つ）
}
```

#### 1-3. CloudPensionRateTableの変更

```typescript
export interface CloudPensionRateTable {
  id: string; // 形式: "{effectiveYearMonth}"
  effectiveYear: number;
  effectiveMonth: number;
  effectiveYearMonth: number;
  pensionRate: number;
  bands: StandardRewardBand[];
  label?: string;
  createdAt: IsoDateString; // 必須（Cloudマスタは必ず作成日時を持つ）
  updatedAt: IsoDateString; // 必須（Cloudマスタは必ず更新日時を持つ）
  updatedByUserId: string; // 必須（Cloudマスタは必ず更新者IDを持つ）
}
```

#### 1-4. 事業所マスタ型の変更

`HealthRateTable`、`CareRateTable`、`PensionRateTable`にも同様に`effectiveYear`、`effectiveMonth`、`effectiveYearMonth`フィールドを追加。

---

### 2. CloudMasterServiceの変更（`src/app/services/cloud-master.service.ts`）

#### 2-1. ID形式の変更

**変更前**:
- `id: "{year}_{prefCode}"`（例: `"2024_13"`）

**変更後**:
- `id: "{effectiveYearMonth}_{prefCode}"`（例: `"202503_13"`）
- `effectiveYearMonth = effectiveYear * 100 + effectiveMonth`

#### 2-2. 保存メソッドの変更

```typescript
async saveCloudHealthRateTable(
  table: Partial<CloudHealthRateTable> & { id?: string }
): Promise<void> {
  const user = await firstValueFrom(this.currentUserService.profile$);
  if (!user?.id) {
    throw new Error('ユーザー情報を取得できませんでした');
  }

  const now = new Date().toISOString();
  
  // まずローカル変数に「実際に使う年・月」を決定する（デフォルト値を適用）
  const effectiveYear = Number(table.effectiveYear ?? new Date().getFullYear());
  const effectiveMonth = Number(table.effectiveMonth ?? 3); // デフォルトは3月
  
  // effectiveYearMonthを計算（既に計算済みの場合はそれを使用、なければ計算）
  const effectiveYearMonth =
    table.effectiveYearMonth ?? effectiveYear * 100 + effectiveMonth;
  
  const id = table.id ?? `${effectiveYearMonth}_${table.kyokaiPrefCode}`;

  const payload: Partial<CloudHealthRateTable> = {
    ...table,
    id,
    effectiveYear,
    effectiveMonth,
    effectiveYearMonth, // 必ず計算して含める
    planType: 'kyokai',
    updatedAt: now,
    updatedByUserId: user.id,
    createdAt: table.createdAt ?? now
  };

  const cleaned = this.removeUndefinedDeep(payload);
  const ref = doc(this.firestore, 'cloudHealthRateTables', id);
  await setDoc(ref, cleaned, { merge: true });
}
```

#### 2-3. 取得メソッドの変更

「対象月に有効な最新マスタ」を取得するメソッドに変更。

```typescript
async getHealthRatePresetFromCloud(
  targetYear: number,
  targetMonth: number,
  prefCode: string
): Promise<Partial<HealthRateTable> | null> {
  try {
    const targetYearMonth = targetYear * 100 + targetMonth;
    const ref = collection(this.firestore, 'cloudHealthRateTables');
    const q = query(
      ref,
      where('planType', '==', 'kyokai'),
      where('kyokaiPrefCode', '==', prefCode),
      where('effectiveYearMonth', '<=', targetYearMonth),
      orderBy('effectiveYearMonth', 'desc'),
      limit(1)
    );

    const snapshot = await firstValueFrom(from(getDocs(q)));
    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0].data() as CloudHealthRateTable;
    return {
      effectiveYear: data.effectiveYear,
      effectiveMonth: data.effectiveMonth,
      effectiveYearMonth: data.effectiveYearMonth,
      planType: data.planType,
      kyokaiPrefCode: data.kyokaiPrefCode,
      kyokaiPrefName: data.kyokaiPrefName,
      healthRate: data.healthRate,
      bands: data.bands
    };
  } catch (error) {
    console.error('クラウドマスタからの取得に失敗しました', error);
    return null;
  }
}
```

同様に`getCareRatePresetFromCloud`、`getPensionRatePresetFromCloud`も変更。

#### 2-4. Firestoreインデックスの設定

以下の複合インデックスをFirestoreコンソールで作成する必要があります：

**cloudHealthRateTablesコレクション**:
- `planType` (Ascending)
- `kyokaiPrefCode` (Ascending)
- `effectiveYearMonth` (Descending)

**cloudCareRateTablesコレクション**:
- `effectiveYearMonth` (Descending)

**cloudPensionRateTablesコレクション**:
- `effectiveYearMonth` (Descending)

---

### 3. MastersServiceの変更（`src/app/services/masters.service.ts`）

#### 3-1. 保存メソッドの変更

```typescript
async saveHealthRateTable(
  officeId: string,
  table: Partial<HealthRateTable> & { id?: string }
): Promise<void> {
  const collectionRef = this.getHealthCollectionRef(officeId);
  const ref = table.id ? doc(collectionRef, table.id) : doc(collectionRef);
  const now = new Date().toISOString();

  // まずローカル変数に「実際に使う年・月」を決定する（デフォルト値を適用）
  const effectiveYear = Number(table.effectiveYear ?? new Date().getFullYear());
  const effectiveMonth = Number(table.effectiveMonth ?? 3); // デフォルトは3月
  
  // effectiveYearMonthを計算（既に計算済みの場合はそれを使用、なければ計算）
  const effectiveYearMonth =
    table.effectiveYearMonth ?? effectiveYear * 100 + effectiveMonth;

  const payload: HealthRateTable = {
    id: ref.id,
    officeId,
    effectiveYear,
    effectiveMonth,
    effectiveYearMonth,
    planType: table.planType ?? 'kyokai',
    healthRate: Number(table.healthRate ?? 0),
    bands: table.bands ?? [],
    createdAt: table.createdAt ?? now,
    updatedAt: now
  };

  if (table.kyokaiPrefCode != null) payload.kyokaiPrefCode = table.kyokaiPrefCode;
  if (table.kyokaiPrefName != null) payload.kyokaiPrefName = table.kyokaiPrefName;
  if (table.unionName != null) payload.unionName = table.unionName;
  if (table.unionCode != null) payload.unionCode = table.unionCode;

  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as HealthRateTable;

  await setDoc(ref, cleanPayload, { merge: true });
}
```

#### 3-2. 取得メソッドの変更

`getRatesForYearMonth`メソッドを適用開始年月ベースに変更。

**⚠️ 重要**: 既存のシグネチャ（引数・戻り値の型）を**壊さない**ように注意すること。既存の呼び出し側（`monthly-premiums.service.ts`、`simulator.page.ts`、`bonus-form-dialog.component.ts`など）は変更不要になるように実装する。

```typescript
async getRatesForYearMonth(
  office: Office,
  yearMonth: YearMonthString
): Promise<{
  healthRate?: number;
  careRate?: number;
  pensionRate?: number;
}> {
  const targetYear = parseInt(yearMonth.substring(0, 4), 10);
  const targetMonth = parseInt(yearMonth.substring(5, 7), 10);
  const targetYearMonth = targetYear * 100 + targetMonth;
  const officeId = office.id;

  const results: {
    healthRate?: number;
    careRate?: number;
    pensionRate?: number;
  } = {};

  // 健康保険マスタの取得
  if (office.healthPlanType === 'kyokai' && office.kyokaiPrefCode) {
    const healthRef = this.getHealthCollectionRef(officeId);
    const healthQuery = query(
      healthRef,
      where('planType', '==', 'kyokai'),
      where('kyokaiPrefCode', '==', office.kyokaiPrefCode),
      where('effectiveYearMonth', '<=', targetYearMonth),
      orderBy('effectiveYearMonth', 'desc'),
      limit(1)
    );
    const healthSnapshot = await firstValueFrom(from(getDocs(healthQuery)));
    if (!healthSnapshot.empty) {
      results.healthRate = healthSnapshot.docs[0].data()['healthRate'] as number;
    }
  } else if (office.healthPlanType === 'kumiai') {
    const healthRef = this.getHealthCollectionRef(officeId);
    const healthQuery = query(
      healthRef,
      where('planType', '==', 'kumiai'),
      where('effectiveYearMonth', '<=', targetYearMonth),
      orderBy('effectiveYearMonth', 'desc'),
      limit(1)
    );
    const healthSnapshot = await firstValueFrom(from(getDocs(healthQuery)));
    if (!healthSnapshot.empty) {
      results.healthRate = healthSnapshot.docs[0].data()['healthRate'] as number;
    }
  }

  // 介護保険マスタの取得
  const careRef = this.getCareCollectionRef(officeId);
  const careQuery = query(
    careRef,
    where('effectiveYearMonth', '<=', targetYearMonth),
    orderBy('effectiveYearMonth', 'desc'),
    limit(1)
  );
  const careSnapshot = await firstValueFrom(from(getDocs(careQuery)));
  if (!careSnapshot.empty) {
    results.careRate = careSnapshot.docs[0].data()['careRate'] as number;
  }

  // 厚生年金マスタの取得
  const pensionRef = this.getPensionCollectionRef(officeId);
  const pensionQuery = query(
    pensionRef,
    where('effectiveYearMonth', '<=', targetYearMonth),
    orderBy('effectiveYearMonth', 'desc'),
    limit(1)
  );
  const pensionSnapshot = await firstValueFrom(from(getDocs(pensionQuery)));
  if (!pensionSnapshot.empty) {
    results.pensionRate = pensionSnapshot.docs[0].data()['pensionRate'] as number;
  }

  return results;
}
```

#### 3-3. 一覧取得メソッドの変更

`listHealthRateTables`などの一覧取得メソッドは、`effectiveYearMonth`でソートするように変更。

```typescript
listHealthRateTables(officeId: string): Observable<HealthRateTable[]> {
  const ref = this.getHealthCollectionRef(officeId);
  const q = query(ref, orderBy('effectiveYearMonth', 'desc'));

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

---

**注意**: 共通ユーティリティ関数（`rate-table-utils.ts`）は作成しない。すべてのロジックは`MastersService`内にまとめる。これにより、「どこが本物のロジックか」が明確になり、コードの保守性が向上する。

---

### 5. UIの変更

#### 5-1. CloudMastersPage（`src/app/pages/cloud-masters/cloud-masters.page.ts`）

**変更点**:
- 年度選択ドロップダウンを「表示対象年」フィルタに変更
- テーブルの「年度」列を「適用開始年月」列に変更
- データソースは`effectiveYearMonth`でソート

**テンプレート例**:

```html
<div class="tab-actions">
  <mat-form-field appearance="outline" class="year-select">
    <mat-label>表示対象年</mat-label>
    <mat-select [formControl]="displayYearControl">
      <mat-option *ngFor="let year of availableYears" [value]="year">
        {{ year }}年
      </mat-option>
    </mat-select>
  </mat-form-field>
  <!-- その他のボタン -->
</div>

<!-- テーブル -->
<ng-container matColumnDef="effectiveYearMonth">
  <th mat-header-cell *matHeaderCellDef>適用開始年月</th>
  <td mat-cell *matCellDef="let row">
    {{ row.effectiveYear }}年{{ row.effectiveMonth }}月
  </td>
</ng-container>
```

#### 5-2. CloudHealthMasterFormDialogComponent（`src/app/pages/cloud-masters/cloud-health-master-form-dialog.component.ts`）

**変更点**:
- 「年度」入力欄を削除
- 「適用開始年」「適用開始月」入力欄を追加
- 任意で「ラベル」入力欄を追加

**フォーム例**:

```html
<div class="form-row">
  <mat-form-field appearance="outline">
    <mat-label>適用開始年</mat-label>
    <input matInput type="number" formControlName="effectiveYear" required />
    <mat-hint>何年分からの料率か</mat-hint>
  </mat-form-field>

  <mat-form-field appearance="outline">
    <mat-label>適用開始月</mat-label>
    <mat-select formControlName="effectiveMonth" required>
      <mat-option *ngFor="let month of [1,2,3,4,5,6,7,8,9,10,11,12]" [value]="month">
        {{ month }}月
      </mat-option>
    </mat-select>
    <mat-hint>何月分からの料率か</mat-hint>
  </mat-form-field>
</div>

<div class="help-text">
  <p>
    例）2025年3月分から改定される場合：<br>
    「適用開始年」= 2025、「適用開始月」= 3 を選択してください。<br>
    その前の月（〜2月分）は、前回登録した料率が自動的に使われます。
  </p>
  <p *ngIf="form.get('planType')?.value === 'kyokai'">
    協会けんぽの案内で「3月分（4月納付）から改定」と書かれている場合、<br>
    「3月分」の月（3）を選んでください。
  </p>
</div>

<mat-form-field appearance="outline" class="full-width">
  <mat-label>ラベル（任意）</mat-label>
  <input matInput formControlName="label" placeholder="例: 令和7年度" />
</mat-form-field>
```

**送信時の処理**:

```typescript
async submit(): Promise<void> {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }
  const currentUserProfile = await firstValueFrom(this.currentUserService.profile$);
  if (!currentUserProfile?.id) {
    console.error('Current user ID not found.');
    return;
  }

  const effectiveYear = this.form.value.effectiveYear!;
  const effectiveMonth = this.form.value.effectiveMonth!;
  const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;

  const payload: Partial<CloudHealthRateTable> = {
    ...this.form.value,
    bands: this.bands.value as StandardRewardBand[],
    effectiveYearMonth,
    id: this.data.table?.id || `${effectiveYearMonth}_${this.form.value.kyokaiPrefCode}`,
    updatedByUserId: currentUserProfile.id
  } as Partial<CloudHealthRateTable>;

  this.dialogRef.close(payload);
}
```

#### 5-3. 事業所マスタ管理画面の変更

`health-master-form-dialog.component.ts`、`care-master-form-dialog.component.ts`、`pension-master-form-dialog.component.ts`も同様に変更。

---

### 6. 保険料計算ロジックの変更

#### 6-1. 月次保険料計算（`src/app/services/monthly-premiums.service.ts`）

`getRatesForYearMonth`メソッドが既に適用開始年月ベースに変更されているため、そのまま使用可能。

#### 6-2. 賞与保険料計算（`src/app/services/bonus-premiums.service.ts`）

賞与支給日（`payDate`）から年月を抽出し、`getRatesForYearMonth`を使用。

```typescript
async calculateBonusPremium(
  office: Office,
  bonus: BonusPremium
): Promise<BonusPremium> {
  // payDateから年月を抽出（例: "2025-07-15" → 2025年7月）
  const payDate = new Date(bonus.payDate);
  const targetYear = payDate.getFullYear();
  const targetMonth = payDate.getMonth() + 1;
  const yearMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}` as YearMonthString;

  const { healthRate, careRate, pensionRate } = await this.mastersService.getRatesForYearMonth(
    office,
    yearMonth
  );

  // 既存の計算ロジック...
}
```

---

### 7. Firestoreインデックスの設定

以下の複合インデックスをFirestoreコンソールで作成する必要があります：

#### 7-1. cloudHealthRateTablesコレクション

```
Collection: cloudHealthRateTables
Fields:
  - planType (Ascending)
  - kyokaiPrefCode (Ascending)
  - effectiveYearMonth (Descending)
```

#### 7-2. cloudCareRateTablesコレクション

```
Collection: cloudCareRateTables
Fields:
  - effectiveYearMonth (Descending)
```

#### 7-3. cloudPensionRateTablesコレクション

```
Collection: cloudPensionRateTables
Fields:
  - effectiveYearMonth (Descending)
```

#### 7-4. 事業所マスタコレクション

各事業所の`healthRateTables`、`careRateTables`、`pensionRateTables`にも以下のインデックスが必要：

**healthRateTables**:
- `planType` (Ascending)
- `kyokaiPrefCode` (Ascending)
- `effectiveYearMonth` (Descending)

**careRateTables**:
- `effectiveYearMonth` (Descending)

**pensionRateTables**:
- `effectiveYearMonth` (Descending)

---

## 🎨 UI/UX仕様

### 0. UI/UXの基本方針

#### 0-1. フォームのラベルと説明文を「実務の言葉」に寄せる

フィールド名は`effectiveYear`/`effectiveMonth`だが、UIでは実務に即したラベルと説明文を使用する。

**フォームラベル案**:
- **適用開始年**: 「何年分からの料率か」
- **適用開始月**: 「何月分からの料率か」

**ヘルプテキスト例**:
```
例）2025年3月分から改定される場合：
「適用開始年」= 2025、「適用開始月」= 3 を選択してください。
その前の月（〜2月分）は、前回登録した料率が自動的に使われます。
```

**協会けんぽ向けの追加説明**:
```
協会けんぽの案内で「3月分（4月納付）から改定」と書かれている場合、
「3月分」の月（3）を選んでください。
```

#### 0-2. マスタ一覧の上に「この画面のルール」を表示

事業所マスタ管理画面（健康保険・介護・厚生年金共通）の上部に説明文を表示する。

**説明文案**:
```
この画面では、保険料率が「改定される月」ごとに1行を登録します。
改定があった月だけ新しい行を追加してください。
対象月の計算では、「その月より前に登録された中で一番新しい行」が自動的に使われます。
過去の計算に使うため、過去の行は基本的に削除しないことをおすすめします。
```

#### 0-3. 協会けんぽ vs 組合健保でフォームを分かりやすく出し分け

**フォームタイトルの切り替え**:

- **協会けんぽの場合**:
  - タイトル: 「協会けんぽ用 保険料率マスタ（この事業所の都道府県：○○）」
  - 都道府県セレクトを表示（読み取り専用でも可）
  - プリセット利用が主役

- **組合健保の場合**:
  - タイトル: 「組合健保用 保険料率マスタ」
  - 組合名・組合コードフィールドをしっかり表示

**フォームフィールドの出し分け**:
- `planType === 'kyokai'`のときのみ: 都道府県セレクト（`kyokaiPrefCode`）を表示
- `planType === 'kumiai'`のときのみ: 組合名（`unionName`）・組合コード（`unionCode`）を表示

#### 0-4. 組合健保ユーザー向けに「前回マスタからコピーして新規作成」

組合健保は初期値がないため、毎回全部入力するのは負担が大きい。改定時は「前のをコピーして必要なところだけ直す」運用が現実的。

**仕様**:
- 組合健保の事業所マスタでは、「前回のマスタをコピーして新規作成」ボタンを用意する（将来拡張でも可）
- `effectiveYear`/`effectiveMonth`だけをユーザーが変更し、必要に応じて料率・等級表を修正できるようにする

#### 0-5. 一覧に「状態」列を追加（オプション）

時間があれば、一覧テーブルに「状態」列を追加すると親切。

**状態の分類**:
- **現在有効**: 今日が適用開始年月以降で、より新しい改定がない
- **過去の改定**: より新しい改定が存在する（例: 2023年3月〜2025年2月分用）
- **将来の改定**: 今日より未来の適用開始年月（例: 2026年4月分から適用予定）

**テーブル列例**:
```
状態
- 現在有効
- 過去の改定
- 将来の改定
```

---

### 1. クラウドマスタ管理画面

#### 1-1. 健康保険マスタタブ

- **表示対象年フィルタ**: ページ上部に配置
  - 「表示対象年」は`effectiveYear`（適用開始年）を基準にフィルタします
  - 例：表示対象年 = 2025 の場合、`effectiveYear = 2025`の行のみを表示
- **テーブル列**:
  - 適用開始年月（例: "2025年3月"）
  - 都道府県コード
  - 都道府県名
  - 健康保険料率
  - 等級数
  - 更新日時
  - 操作（編集・削除）

#### 1-2. 介護保険マスタタブ

- **表示対象年フィルタ**: ページ上部に配置
  - 「表示対象年」は`effectiveYear`（適用開始年）を基準にフィルタします
  - 例：表示対象年 = 2025 の場合、`effectiveYear = 2025`の行のみを表示
- **テーブル列**:
  - 適用開始年月
  - 介護保険料率
  - 更新日時
  - 操作（編集・削除）

#### 1-3. 厚生年金マスタタブ

- **表示対象年フィルタ**: ページ上部に配置
  - 「表示対象年」は`effectiveYear`（適用開始年）を基準にフィルタします
  - 例：表示対象年 = 2025 の場合、`effectiveYear = 2025`の行のみを表示
- **テーブル列**:
  - 適用開始年月
  - 厚生年金料率
  - 等級数
  - 更新日時
  - 操作（編集・削除）

### 2. 事業所マスタ管理画面

#### 2-1. 画面説明文の表示

各マスタタブの上部に説明文を表示する。

**説明文**:
```
この画面では、保険料率が「改定される月」ごとに1行を登録します。
改定があった月だけ新しい行を追加してください。
対象月の計算では、「その月より前に登録された中で一番新しい行」が自動的に使われます。
過去の計算に使うため、過去の行は基本的に削除しないことをおすすめします。
```

#### 2-2. 健康保険マスタフォーム

**フォームタイトルの出し分け**:
- **協会けんぽの場合**: 「協会けんぽ用 保険料率マスタ（この事業所の都道府県：○○）」
- **組合健保の場合**: 「組合健保用 保険料率マスタ」

**フォーム項目**:
- **適用開始年**: 数値入力（例: 2025）
  - ヒント: 「何年分からの料率か」
- **適用開始月**: セレクト（1-12月）
  - ヒント: 「何月分からの料率か」
- **都道府県**: セレクト（協会けんぽの場合のみ表示）
- **組合名**: テキスト入力（組合健保の場合のみ表示）
- **組合コード**: テキスト入力（組合健保の場合のみ表示）
- **健康保険料率**: 数値入力
- **標準報酬等級**: テーブル形式

**ヘルプテキスト**:
```
例）2025年3月分から改定される場合：
「適用開始年」= 2025、「適用開始月」= 3 を選択してください。
その前の月（〜2月分）は、前回登録した料率が自動的に使われます。
```

**協会けんぽ向け追加説明**:
```
協会けんぽの案内で「3月分（4月納付）から改定」と書かれている場合、
「3月分」の月（3）を選んでください。
```

**組合健保向け機能（将来拡張）**:
- 「前回のマスタをコピーして新規作成」ボタン
- 前回のマスタの内容をコピーし、`effectiveYear`/`effectiveMonth`だけを変更して新規作成

#### 2-3. 介護保険マスタフォーム

- **適用開始年**: 数値入力
  - ヒント: 「何年分からの料率か」
- **適用開始月**: セレクト（1-12月）
  - ヒント: 「何月分からの料率か」
- **介護保険料率**: 数値入力

**ヘルプテキスト**: 健康保険マスタと同じ

#### 2-4. 厚生年金マスタフォーム

- **適用開始年**: 数値入力
  - ヒント: 「何年分からの料率か」
- **適用開始月**: セレクト（1-12月）
  - ヒント: 「何月分からの料率か」
- **厚生年金料率**: 数値入力
- **標準報酬等級**: テーブル形式

**ヘルプテキスト**: 健康保険マスタと同じ

#### 2-5. 一覧テーブルの「状態」列（オプション）

時間があれば、一覧テーブルに「状態」列を追加する。

**状態の判定ロジック**:
```typescript
function getStatusLabel(
  effectiveYear: number,
  effectiveMonth: number,
  allTables: RateTable[]
): string {
  const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;
  const today = new Date();
  const currentYearMonth = today.getFullYear() * 100 + (today.getMonth() + 1);
  
  // より新しい改定があるかチェック
  const hasNewer = allTables.some(
    t => t.effectiveYearMonth > effectiveYearMonth
  );
  
  if (effectiveYearMonth > currentYearMonth) {
    return '将来の改定';
  } else if (hasNewer) {
    return '過去の改定';
  } else {
    return '現在有効';
  }
}
```

**表示例**:
- 「現在有効」（緑色のバッジ）
- 「過去の改定」（グレーのバッジ）
- 「将来の改定」（青色のバッジ）

---

## 🔒 セキュリティ・権限

### Firestoreセキュリティルール

既存のルールは維持し、新しいフィールド（`effectiveYear`、`effectiveMonth`、`effectiveYearMonth`）も同様に扱う。

---

## ✅ テスト・確認事項

### 1. クラウドマスタ管理

- [ ] 適用開始年月でマスタを登録できる
- [ ] 一覧表示で適用開始年月が正しく表示される
- [ ] 表示対象年フィルタで絞り込みができる
- [ ] 編集・削除が正常に動作する

### 2. 事業所マスタ管理

- [ ] 適用開始年月でマスタを登録できる
- [ ] 一覧表示で適用開始年月が正しく表示される
- [ ] クラウドマスタから初期値を取得できる

### 3. 保険料計算

- [ ] 2025年3月改定の場合、2025年3月以降は新料率が適用される
- [ ] 2025年3月改定の場合、2025年1-2月は旧料率が適用される
- [ ] 月次保険料計算で正しい料率が使用される
- [ ] 賞与保険料計算で正しい料率が使用される

### 4. データ移行

- [ ] 既存の年度ベースデータを削除し、新仕様で再登録できる

---

## 📝 データ移行について

### データ移行の方針

**移行スクリプトは作成しない**。既存の年度ベースデータは少ない前提で、**UIから新仕様（適用開始年月ベース）で手動再登録する**ことを前提とする。

### 既存データの扱い

- 既存の年度ベースデータ（`year`フィールドを持つデータ）は、新仕様では使用しない
- 必要に応じて、クラウドマスタ管理画面・事業所マスタ管理画面から新仕様で再登録する
- `year`フィールドは型定義からも削除し、今後一切使用しない

---

## 🚨 注意事項

1. **破壊的変更**: 既存の年度ベースデータとの互換性は保証しない
2. **Firestoreインデックス**: 複合インデックスの作成が必要
3. **データ移行**: 移行スクリプトは作成しない。既存データは少ない前提で、UIから新仕様で手動再登録する
4. **yearフィールドの削除**: `year`フィールドは型定義からも完全に削除し、今後一切使用しない
5. **段階的移行なし**: 一気に仕様を切り替える（段階的移行は行わない）
6. **既存シグネチャの維持**: `getRatesForYearMonth`メソッドの引数・戻り値の型は既存のまま維持する（呼び出し側を変更しない）
7. **ロジックの統一**: 共通ユーティリティ関数（`rate-table-utils.ts`）は作成せず、すべて`MastersService`内にまとめる

---

## 📚 参考資料

- Phase3-11実装指示書: `IMPLEMENTATION_GUIDE_PHASE3-11.md`
- Firestore複合インデックス設定: https://firebase.google.com/docs/firestore/query-data/indexes

---

**最終更新**: 2025年12月4日

---

## 🔧 追加実装: 保険料率管理の改善（重複登録防止・都道府県固定）

**作成日**: 2025年12月4日  
**対象フェーズ**: Phase3-11.ex（追加改善）  
**優先度**: 🟡 中（データ整合性のため重要）

---

### 📋 概要

保険料率管理画面で以下の2つの問題を解決する：

1. **同じ適用年月の重複登録問題**: 同じ適用年月で複数のマスタを登録できると、計算時にどれを参照するか混乱する
2. **事業所設定と異なる都道府県の登録問題**: 事業所設定が東京なのに、埼玉や沖縄などの異なる都道府県を登録できてしまう

### 🎯 目的

- **データ整合性の確保**: 同じ適用年月のマスタは1件のみ存在するようにする
- **事業所設定との整合性**: 事業所設定の都道府県と一致するマスタのみ登録可能にする

---

### 📎 対象範囲

#### 1. 重複登録防止機能

**対象マスタ**:
- 健康保険マスタ（`HealthRateTable`）
- 介護保険マスタ（`CareRateTable`）
- 厚生年金マスタ（`PensionRateTable`）

**重複判定条件**:
- **健康保険**: `effectiveYearMonth` + `planType` + `kyokaiPrefCode`（協会けんぽの場合）または `effectiveYearMonth` + `planType`（組合健保の場合）
- **介護保険**: `effectiveYearMonth`
- **厚生年金**: `effectiveYearMonth`

**動作**:
- 保存前に既存マスタを検索
- 重複がある場合、上書き確認ダイアログを表示
- 「はい」を選択した場合、既存マスタのIDで上書き保存
- 「いいえ」を選択した場合、保存をキャンセル

#### 2. プラン種別固定機能

**対象**: 健康保険マスタ

**動作**:
- `planType`セレクトを事業所設定の`healthPlanType`に固定
- `planType`セレクトを読み取り専用（`disabled`）にする
- 事業所設定の`healthPlanType`が唯一の真実として扱われる
- これにより、「事業所は協会けんぽなのに、マスタは組合健保で登録されている」という不整合が設計上起こりえない

#### 3. 都道府県固定機能

**対象**: 健康保険マスタ（協会けんぽの場合のみ）

**動作**:
- 協会けんぽの場合、都道府県セレクトを事業所設定の都道府県に固定
- 都道府県セレクトを読み取り専用（`disabled`）にする
- 事業所設定に都道府県が未設定の場合、エラーメッセージを表示

---

### 🔧 実装詳細

#### 1. MastersServiceに重複チェックメソッドと一括削除メソッドを追加

**ファイル**: `src/app/services/masters.service.ts`

**追加メソッド**:

##### 1-1. 重複チェックメソッド

```typescript
/**
 * 健康保険マスタの重複チェック
 * 同じeffectiveYearMonth + planType + (kyokaiPrefCode or unionCode)のマスタが存在するか確認
 */
async checkHealthRateTableDuplicate(
  officeId: string,
  effectiveYearMonth: number,
  planType: HealthPlanType,
  kyokaiPrefCode?: string,
  unionCode?: string,
  excludeId?: string // 編集時は現在編集中のIDを除外
): Promise<HealthRateTable | null> {
  const ref = this.getHealthCollectionRef(officeId);
  let q;
  
  if (planType === 'kyokai' && kyokaiPrefCode) {
    q = query(
      ref,
      where('effectiveYearMonth', '==', effectiveYearMonth),
      where('planType', '==', 'kyokai'),
      where('kyokaiPrefCode', '==', kyokaiPrefCode)
    );
  } else if (planType === 'kumiai') {
    q = query(
      ref,
      where('effectiveYearMonth', '==', effectiveYearMonth),
      where('planType', '==', 'kumiai')
    );
    if (unionCode) {
      q = query(q, where('unionCode', '==', unionCode));
    }
  } else {
    return null;
  }
  
  const snapshot = await firstValueFrom(from(getDocs(q)));
  const existing = snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) } as HealthRateTable))
    .find((t) => !excludeId || t.id !== excludeId);
  
  return existing || null;
}

/**
 * 介護保険マスタの重複チェック
 */
async checkCareRateTableDuplicate(
  officeId: string,
  effectiveYearMonth: number,
  excludeId?: string
): Promise<CareRateTable | null> {
  const ref = this.getCareCollectionRef(officeId);
  const q = query(
    ref,
    where('effectiveYearMonth', '==', effectiveYearMonth)
  );
  
  const snapshot = await firstValueFrom(from(getDocs(q)));
  const existing = snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) } as CareRateTable))
    .find((t) => !excludeId || t.id !== excludeId);
  
  return existing || null;
}

/**
 * 厚生年金マスタの重複チェック
 */
async checkPensionRateTableDuplicate(
  officeId: string,
  effectiveYearMonth: number,
  excludeId?: string
): Promise<PensionRateTable | null> {
  const ref = this.getPensionCollectionRef(officeId);
  const q = query(
    ref,
    where('effectiveYearMonth', '==', effectiveYearMonth)
  );
  
  const snapshot = await firstValueFrom(from(getDocs(q)));
  const existing = snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) } as PensionRateTable))
    .find((t) => !excludeId || t.id !== excludeId);
  
  return existing || null;
}
```

##### 1-2. 健康保険マスタ一括削除メソッド

健康保険プラン変更時に、既存の健康保険マスタをすべて削除するためのメソッドを追加します。

```typescript
/**
 * 健康保険マスタをすべて削除する（プラン変更時などに使用）
 */
async deleteAllHealthRateTables(officeId: string): Promise<void> {
  const ref = this.getHealthCollectionRef(officeId);
  const snapshot = await firstValueFrom(from(getDocs(ref)));
  
  if (snapshot.empty) return;
  
  const batch = writeBatch(this.firestore);
  snapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  
  await batch.commit();
}
```

**注意**: 
- `writeBatch`を`@angular/fire/firestore`からインポートする必要があります。
- このメソッドは、Office設定画面で`healthPlanType`を変更する際に使用されます。

**注意（重複チェックメソッドについて）**: 
- 型注釈は不要です。`let q`として型推論に任せます。
- このクエリは`where`のみで`orderBy`や範囲条件を使っていないため、基本的には追加のFirestoreインデックスは不要です。もしコンソールで「インデックスを作れ」とエラーが出た場合は、そのエラーメッセージに従ってインデックスを作成してください。
- **重要**: ReactiveFormsでは`disabled`なコントロールは`form.value`から除外されるため、プラン種別と都道府県情報（`planType`、`kyokaiPrefCode`、`kyokaiPrefName`）は`data.office`から直接取得します。これにより、「事業所設定が唯一の真実」という設計思想が保たれます。

---

#### 2. 健康保険マスタフォームダイアログの変更

**ファイル**: `src/app/pages/masters/health-master-form-dialog.component.ts`

**変更点**:

1. **プラン種別の固定**:
   - `planType`セレクトを`disabled`にする（事業所設定の`healthPlanType`が唯一の真実）
   - 初期値は`data.office.healthPlanType`を使用
   - ユーザーは変更できない

2. **都道府県セレクトの固定**:
   - 協会けんぽの場合、都道府県セレクトを`disabled`にする
   - 事業所設定の都道府県を強制的に設定
   - 事業所設定に都道府県が未設定の場合、エラーメッセージを表示

3. **重複チェックと上書き確認**:
   - `submit()`メソッドで保存前に重複チェックを実行
   - 重複がある場合、確認ダイアログを表示
   - 「はい」を選択した場合、既存マスタのIDで上書き保存

**実装例**:

```typescript
// コンストラクタでプラン種別と都道府県を固定
constructor(@Inject(MAT_DIALOG_DATA) public readonly data: HealthMasterDialogData) {
  // ... 既存のコード ...
  
  // プラン種別を事業所設定の値に固定（事業所設定が唯一の真実）
  const planType = data.office.healthPlanType ?? 'kyokai';
  this.form.patchValue({
    planType
  });
  this.form.get('planType')?.disable();
  
  // 協会けんぽの場合、都道府県を事業所設定の値に固定
  if (planType === 'kyokai') {
    if (!data.office.kyokaiPrefCode) {
      // 事業所設定に都道府県が未設定の場合、エラーメッセージを表示してダイアログを閉じる
      this.snackBar.open('事業所設定に都道府県が設定されていません。事業所設定画面で都道府県を設定してください。', '閉じる', {
        duration: 5000
      });
      this.dialogRef.close();
      return;
    } else {
      // 都道府県を固定
      this.form.patchValue({
        kyokaiPrefCode: data.office.kyokaiPrefCode,
        kyokaiPrefName: data.office.kyokaiPrefName
      });
      // ReactiveForms的に、TS側でdisable()を呼ぶ方がキレイ
      this.form.get('kyokaiPrefCode')?.disable();
    }
  }
}

// テンプレート側は既存のままでOK（disabledはTS側で制御）

// submit()メソッドの変更
async submit(): Promise<void> {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  // プラン種別と都道府県情報は事業所設定から取得（事業所設定が唯一の真実）
  // disabledなコントロールはform.valueから除外されるため、data.officeから取得する
  const planType = this.data.office.healthPlanType ?? 'kyokai';
  const effectiveYear = this.form.value.effectiveYear!;
  const effectiveMonth = this.form.value.effectiveMonth!;
  const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;
  const kyokaiPrefCode = planType === 'kyokai' ? this.data.office.kyokaiPrefCode ?? undefined : undefined;
  const unionCode = this.form.value.unionCode;

  // 重複チェック
  const existing = await this.mastersService.checkHealthRateTableDuplicate(
    this.data.office.id,
    effectiveYearMonth,
    planType,
    kyokaiPrefCode,
    unionCode,
    this.data.table?.id // 編集時は現在編集中のIDを除外
  );

  if (existing && existing.id !== this.data.table?.id) {
    // 重複がある場合、上書き確認ダイアログを表示
    const planLabel = planType === 'kyokai' ? '協会けんぽ' : '組合健保';
    const confirmed = confirm(
      `${effectiveYear}年${effectiveMonth}月分（${planLabel}）のマスタが既に登録されています。\n` +
      `上書き保存しますか？\n\n` +
      `既存の料率: ${(existing.healthRate * 100).toFixed(2)}%`
    );
    
    if (!confirmed) {
      return; // キャンセル
    }
    
    // 既存マスタのIDで上書き保存
    const payload: Partial<HealthRateTable> = {
      ...this.form.value,
      bands: this.bands.value as StandardRewardBand[],
      effectiveYearMonth,
      id: existing.id // 既存マスタのIDを使用
    } as Partial<HealthRateTable>;
    
    // プラン種別と都道府県情報は事業所設定から設定（事業所設定が唯一の真実）
    payload.planType = planType;
    if (planType === 'kyokai') {
      payload.kyokaiPrefCode = this.data.office.kyokaiPrefCode;
      payload.kyokaiPrefName = this.data.office.kyokaiPrefName;
      payload.unionCode = undefined;
      payload.unionName = undefined;
    } else {
      payload.kyokaiPrefCode = undefined;
      payload.kyokaiPrefName = undefined;
    }
    
    this.dialogRef.close(payload);
    return;
  }

  // 重複がない場合、通常通り保存
  const payload: Partial<HealthRateTable> = {
    ...this.form.value,
    bands: this.bands.value as StandardRewardBand[],
    effectiveYearMonth,
    id: this.data.table?.id
  } as Partial<HealthRateTable>;
  
  // プラン種別と都道府県情報は事業所設定から設定（事業所設定が唯一の真実）
  payload.planType = planType;
  if (planType === 'kyokai') {
    payload.kyokaiPrefCode = this.data.office.kyokaiPrefCode;
    payload.kyokaiPrefName = this.data.office.kyokaiPrefName;
    payload.unionCode = undefined;
    payload.unionName = undefined;
  } else {
    payload.kyokaiPrefCode = undefined;
    payload.kyokaiPrefName = undefined;
  }
  
  this.dialogRef.close(payload);
}
```

**注意**: `MatDialog`を使用して確認ダイアログを表示する場合は、`MatDialog`をインジェクトして使用します。簡易的な確認の場合は`confirm()`でも構いませんが、UXを向上させる場合は`MatDialog`を使用することを推奨します。

---

#### 4. MastersPageの変更（介護・厚生年金ダイアログにofficeを渡す）

**ファイル**: `src/app/pages/masters/masters.page.ts`

**変更点**: `openCareDialog`と`openPensionDialog`で`data: { office, table }`を渡すように統一

**実装例**:

```typescript
async openCareDialog(table?: CareRateTable): Promise<void> {
  try {
    const office = await this.requireOffice();
    const ref = this.dialog.open(CareMasterFormDialogComponent, {
      data: { office, table }, // officeを追加
      width: '600px'
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    await this.mastersService.saveCareRateTable(office.id, result);
    this.snackBar.open('介護保険マスタを保存しました', '閉じる', { duration: 3000 });
  } catch (error) {
    console.error(error);
    this.snackBar.open('介護保険マスタの保存に失敗しました', '閉じる', { duration: 3000 });
  }
}

async openPensionDialog(table?: PensionRateTable): Promise<void> {
  try {
    const office = await this.requireOffice();
    const ref = this.dialog.open(PensionMasterFormDialogComponent, {
      data: { office, table }, // officeを追加
      width: '960px'
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    await this.mastersService.savePensionRateTable(office.id, result);
    this.snackBar.open('厚生年金マスタを保存しました', '閉じる', { duration: 3000 });
  } catch (error) {
    console.error(error);
    this.snackBar.open('厚生年金マスタの保存に失敗しました', '閉じる', { duration: 3000 });
  }
}
```

**注意**: これにより、介護・厚生年金のフォームダイアログでも`data.office`を使用できるようになり、`CurrentOfficeService`をフォームでinjectする必要がなくなります。

---

#### 5. 介護保険マスタフォームダイアログの変更

**ファイル**: `src/app/pages/masters/care-master-form-dialog.component.ts`

**変更点**: 
- `CareMasterDialogData`インターフェースに`office: Office`を追加
- `submit()`メソッドで重複チェックと上書き確認を追加

**実装例**:

```typescript
// インターフェースの変更
export interface CareMasterDialogData {
  office: Office; // 追加
  table?: CareRateTable;
}

async submit(): Promise<void> {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  const effectiveYear = this.form.value.effectiveYear!;
  const effectiveMonth = this.form.value.effectiveMonth!;
  const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;

  // 重複チェック（data.officeを使用）
  const existing = await this.mastersService.checkCareRateTableDuplicate(
    this.data.office.id,
    effectiveYearMonth,
    this.data.table?.id
  );

  if (existing && existing.id !== this.data.table?.id) {
    const confirmed = confirm(
      `${effectiveYear}年${effectiveMonth}月分の介護保険マスタが既に登録されています。\n` +
      `上書き保存しますか？\n\n` +
      `既存の料率: ${(existing.careRate * 100).toFixed(2)}%`
    );
    
    if (!confirmed) {
      return;
    }
    
    const payload: Partial<CareRateTable> = {
      ...this.form.value,
      effectiveYearMonth,
      id: existing.id
    };
    
    this.dialogRef.close(payload);
    return;
  }

  // 重複がない場合、通常通り保存
  const payload: Partial<CareRateTable> = {
    ...this.form.value,
    effectiveYearMonth,
    id: this.data.table?.id
  };
  
  this.dialogRef.close(payload);
}
```

---

#### 6. 厚生年金マスタフォームダイアログの変更

**ファイル**: `src/app/pages/masters/pension-master-form-dialog.component.ts`

**変更点**: 
- `PensionMasterDialogData`インターフェースに`office: Office`を追加
- `submit()`メソッドで重複チェックと上書き確認を追加

**実装例**:

```typescript
// インターフェースの変更
export interface PensionMasterDialogData {
  office: Office; // 追加
  table?: PensionRateTable;
}

async submit(): Promise<void> {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  const effectiveYear = this.form.value.effectiveYear!;
  const effectiveMonth = this.form.value.effectiveMonth!;
  const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;

  // 重複チェック（data.officeを使用）
  const existing = await this.mastersService.checkPensionRateTableDuplicate(
    this.data.office.id,
    effectiveYearMonth,
    this.data.table?.id
  );

  if (existing && existing.id !== this.data.table?.id) {
    const confirmed = confirm(
      `${effectiveYear}年${effectiveMonth}月分の厚生年金マスタが既に登録されています。\n` +
      `上書き保存しますか？\n\n` +
      `既存の料率: ${(existing.pensionRate * 100).toFixed(2)}%`
    );
    
    if (!confirmed) {
      return;
    }
    
    const payload: Partial<PensionRateTable> = {
      ...this.form.value,
      bands: this.bands.value as StandardRewardBand[],
      effectiveYearMonth,
      id: existing.id
    };
    
    this.dialogRef.close(payload);
    return;
  }

  // 重複がない場合、通常通り保存
  const payload: Partial<PensionRateTable> = {
    ...this.form.value,
    bands: this.bands.value as StandardRewardBand[],
    effectiveYearMonth,
    id: this.data.table?.id
  };
  
  this.dialogRef.close(payload);
}
```

---

### ✅ テスト・確認事項

#### 1. 重複登録防止機能

- [ ] 同じ適用年月で健康保険マスタを2回登録しようとした場合、上書き確認ダイアログが表示される
- [ ] 「はい」を選択した場合、既存マスタが上書き保存される
- [ ] 「いいえ」を選択した場合、保存がキャンセルされる
- [ ] 編集時（既存マスタを編集している場合）は、自分自身との重複チェックが除外される
- [ ] 介護保険マスタ、厚生年金マスタでも同様の動作が確認できる

#### 2. プラン種別固定機能

- [ ] `planType`セレクトが読み取り専用（`disabled`）になっている
- [ ] 事業所設定の`healthPlanType`が自動的に設定されている
- [ ] ユーザーが`planType`を変更できない

#### 3. 都道府県固定機能

- [ ] 協会けんぽの場合、都道府県セレクトが読み取り専用（`disabled`）になっている
- [ ] 事業所設定の都道府県が自動的に設定されている
- [ ] 事業所設定に都道府県が未設定の場合、適切なエラーメッセージが表示される
- [ ] 組合健保の場合、都道府県セレクトは表示されない（既存の動作を維持）

#### 4. 健康保険プラン変更時の挙動

- [ ] Office設定画面で`healthPlanType`を変更しようとした場合、確認ダイアログが表示される
- [ ] 「はい」を選択した場合、`healthPlanType`が更新され、健康保険マスタがすべて削除される
- [ ] 「いいえ」を選択した場合、変更がキャンセルされる
- [ ] 介護保険・厚生年金のマスタは削除されない

---

### 🚨 注意事項

1. **Firestoreインデックス**: 重複チェック用のクエリは`where`のみで`orderBy`や範囲条件を使っていないため、基本的には追加のインデックスは不要です。もしコンソールで「インデックスを作れ」とエラーが出た場合は、そのエラーメッセージに従ってインデックスを作成してください。

2. **既存データへの影響**: 既存の重複データがある場合、手動で整理する必要があります。

3. **UXの改善**: 確認ダイアログは`confirm()`でも動作しますが、将来的には`MatDialog`を使用したカスタムダイアログに変更することで、より良いUXを提供できます。

4. **型注釈について**: `MastersService`の重複チェックメソッドでは、`Query`型の明示的な型注釈は不要です。型推論に任せることで、コードがシンプルになります。

5. **プラン種別・都道府県固定の実装**: `planType`と都道府県セレクトはテンプレート側の`[disabled]`ではなく、TS側で`form.get('planType')?.disable()`や`form.get('kyokaiPrefCode')?.disable()`を呼ぶことで、ReactiveForms的に正しく動作します。これにより、`form.value`から自動的に除外され、コード上でも「固定値」であることが明確になります。

6. **プラン変更時のデータ整合性**: Office設定で`healthPlanType`を変更する際は、既存の健康保険マスタをすべて削除することで、データ整合性を保ちます。介護保険・厚生年金のマスタはプランと無関係のため、削除対象外です。

---

#### 6. 健康保険プラン変更時の挙動（Office設定）

**対象**: `Office`ドキュメントの`healthPlanType`フィールド（`'kyokai' | 'kumiai'`）

**目的**:
- 事業所ごとの健康保険プランを「単一の真実」としてOfficeで管理する
- プラン切替時にマスタの取り扱いを明確にすることで、データ整合性を保つ

**仕様**:

1. **`healthPlanType`の管理**:
   - `healthPlanType`はOffice設定画面のみで変更可能とし、保険料率マスタ画面では`office.healthPlanType`をそのまま使用・表示する（`planType`のセレクトは`disabled`にする）

2. **プラン変更時の確認ダイアログ**:
   - Office設定画面で`healthPlanType`を変更しようとした場合、次の内容の確認ダイアログを表示する：
     > 健康保険のプランを変更すると、現在登録されている  
     > 「健康保険マスタ（料率・標準報酬等級）」はすべて削除されます。  
     > 新しいプランに合わせてマスタを登録し直す必要があります。  
     > 本当にプランを変更しますか？

3. **「はい」を選択した場合**:
   1. `Office`ドキュメントの`healthPlanType`を新しい値に更新する
   2. `offices/{officeId}/healthRateTables`コレクション配下のドキュメントを全件削除する（`MastersService.deleteAllHealthRateTables(officeId)`を呼び出す）

4. **「いいえ」を選択した場合**:
   - `healthPlanType`の変更はキャンセルし、元の値のままとする

**実装イメージ（Office設定画面側）**:

```typescript
// Office設定画面の保存処理例
async saveOffice(office: Partial<Office>): Promise<void> {
  const currentOffice = await firstValueFrom(this.office$);
  if (!currentOffice) return;
  
  // healthPlanTypeが変更されているかチェック
  if (office.healthPlanType && office.healthPlanType !== currentOffice.healthPlanType) {
    const confirmed = confirm(
      '健康保険のプランを変更すると、現在登録されている\n' +
      '「健康保険マスタ（料率・標準報酬等級）」はすべて削除されます。\n' +
      '新しいプランに合わせてマスタを登録し直す必要があります。\n' +
      '本当にプランを変更しますか？'
    );
    
    if (!confirmed) {
      // 変更をキャンセル（healthPlanTypeを元の値に戻す）
      office.healthPlanType = currentOffice.healthPlanType;
      return;
    }
    
    // 健康保険マスタをすべて削除
    await this.mastersService.deleteAllHealthRateTables(currentOffice.id);
  }
  
  // Officeドキュメントを更新
  await this.officesService.updateOffice(currentOffice.id, office);
}
```

**備考**:
- 介護保険・厚生年金のマスタは事業所の健康保険プランとは独立しているため、プラン変更時に削除するのは「健康保険マスタ（healthRateTables）」のみとする
- 将来的にプラン変更履歴や移行ロジックを実装する場合は、`healthPlanTypeChangedAt`などのフィールドを`Office`に追加する余地を残しておく

---

**最終更新**: 2025年12月4日

