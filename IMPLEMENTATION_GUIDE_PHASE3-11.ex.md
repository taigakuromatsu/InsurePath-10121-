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

