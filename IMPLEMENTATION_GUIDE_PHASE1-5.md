# P1-5 指示書

**テーマ**: 標準報酬月額・等級・保険プランマスタ管理機能の実装

---

## 0. ゴール・位置づけ

CATALOG の (6)「標準報酬月額・等級・保険プランマスタ管理機能」を実装する。

現在、P1-4 の月次保険料計算画面では料率を手動入力しているが、本機能により：
- 事業所ごとに保険料率マスタを登録・管理できる
- 年度別にマスタを管理できる（改定対応）
- 協会けんぽの初期値プリセット機能を提供
- 標準報酬等級表を登録・管理できる

**後続フェーズ（P1-6 以降）で、月次保険料計算画面からマスタを自動取得して使用する想定。**

---

## 1. 前提・現状確認

### 1-1. 既存実装の確認

- ✅ `HealthRateTable`, `CareRateTable`, `PensionRateTable`, `StandardRewardBand` 型は `types.ts` に定義済み
- ✅ `MastersPage` はプレースホルダー状態
- ✅ `Office` 型に `healthPlanType`, `kyokaiPrefCode`, `kyokaiPrefName`, `unionName`, `unionCode` が定義済み
- ✅ `CurrentOfficeService` で事業所情報を取得可能

### 1-2. 注意事項

- マスタデータは年度（`year`）で管理する
- 協会けんぽの場合は都道府県別の料率を管理
- 組合健保の場合は事業所ごとに異なる料率を設定可能
- 厚生年金は全国共通のため、事業所に関係なく年度別に管理

---

## 2. 対象ファイル

### 既存ファイル（編集）

- `src/app/pages/masters/masters.page.ts`
  → プレースホルダーを実装に置き換える

- `src/app/types.ts`
  → 型定義は既にある前提（必要に応じて微調整）

### 新規作成ファイル

- `src/app/services/masters.service.ts`
  → マスタデータのCRUD操作を担当

- `src/app/utils/kyokai-presets.ts`
  → 協会けんぽの初期値プリセットデータ

- `src/app/pages/masters/health-master-form-dialog.component.ts`
  → 健康保険マスタ編集ダイアログ

- `src/app/pages/masters/care-master-form-dialog.component.ts`
  → 介護保険マスタ編集ダイアログ

- `src/app/pages/masters/pension-master-form-dialog.component.ts`
  → 厚生年金マスタ編集ダイアログ

---

## 3. Firestore コレクション構造

### コレクション構造

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

**注意**: 厚生年金マスタは全国共通のため、`officeId` は保持するが、実質的には年度のみで管理する。

---

## 4. MastersService の実装

**ファイル**: `src/app/services/masters.service.ts`

### 4-1. 基本構造

```typescript
import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  orderBy
} from '@angular/fire/firestore';
import { from, map, Observable } from 'rxjs';

import {
  CareRateTable,
  HealthRateTable,
  PensionRateTable,
  StandardRewardBand
} from '../types';

@Injectable({ providedIn: 'root' })
export class MastersService {
  constructor(private readonly firestore: Firestore) {}
}
```

### 4-2. 内部ヘルパー

#### `private getHealthCollectionRef(officeId: string)`

```typescript
private getHealthCollectionRef(officeId: string) {
  return collection(this.firestore, 'offices', officeId, 'healthRateTables');
}
```

#### `private getCareCollectionRef(officeId: string)`

```typescript
private getCareCollectionRef(officeId: string) {
  return collection(this.firestore, 'offices', officeId, 'careRateTables');
}
```

#### `private getPensionCollectionRef(officeId: string)`

```typescript
private getPensionCollectionRef(officeId: string) {
  return collection(this.firestore, 'offices', officeId, 'pensionRateTables');
}
```

### 4-3. 健康保険マスタのメソッド

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

### 4-4. 介護保険マスタのメソッド

同様のパターンで以下を実装：

- `listCareRateTables(officeId: string): Observable<CareRateTable[]>`
- `getCareRateTable(officeId: string, id: string): Observable<CareRateTable | null>`
- `async saveCareRateTable(officeId: string, table: Partial<CareRateTable> & { id?: string }): Promise<void>`
- `async deleteCareRateTable(officeId: string, id: string): Promise<void>`

**注意**: 介護保険マスタは `bands` を持たない（料率のみ）。

### 4-5. 厚生年金マスタのメソッド

同様のパターンで以下を実装：

- `listPensionRateTables(officeId: string): Observable<PensionRateTable[]>`
- `getPensionRateTable(officeId: string, id: string): Observable<PensionRateTable | null>`
- `async savePensionRateTable(officeId: string, table: Partial<PensionRateTable> & { id?: string }): Promise<void>`
- `async deletePensionRateTable(officeId: string, id: string): Promise<void>`

**注意**: 厚生年金マスタは全国共通だが、`officeId` は保持する（実装の一貫性のため）。

---

## 5. 協会けんぽプリセットデータの実装

**ファイル**: `src/app/utils/kyokai-presets.ts`

### 5-1. 都道府県コードマッピング

```typescript
/**
 * 都道府県コードと名称のマッピング
 */
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

### 5-2. 協会けんぽ健康保険料率（2024年度参考値）

```typescript
/**
 * 協会けんぽの健康保険料率（都道府県別、2024年度参考値）
 * 
 * 注意: 実際の値は公式サイトで確認が必要。ここでは参考値として実装。
 * ユーザーがマスタ画面で実際の値を入力・更新できるようにする。
 */
export const KYOKAI_HEALTH_RATES_2024: Record<string, number> = {
  '01': 0.1000, // 北海道の例
  '13': 0.0981, // 東京都の例
  '27': 0.0985, // 大阪府の例
  // ... 他の都道府県も同様に定義
  // 実際の値は公式サイトで確認が必要
};
```

### 5-3. 標準報酬等級表（基本構造）

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

### 5-4. 介護保険料率（2024年度参考値）

```typescript
/**
 * 介護保険料率（全国一律、2024年度参考値）
 * 
 * 注意: 実際の値は公式サイトで確認が必要。ここでは参考値として実装。
 */
export const CARE_RATE_2024 = 0.0191; // 1.91%
```

### 5-5. 厚生年金保険料率（2024年度参考値）

```typescript
/**
 * 厚生年金保険料率（全国共通、2024年度参考値）
 * 
 * 注意: 実際の値は公式サイトで確認が必要。ここでは参考値として実装。
 */
export const PENSION_RATE_2024 = 0.183; // 18.3%
```

### 5-6. プリセット取得関数

```typescript
/**
 * 協会けんぽの健康保険マスタプリセットを取得
 * 
 * @param prefCode - 都道府県コード（例: '13'）
 * @param year - 年度（例: 2024）
 * @returns 健康保険マスタのプリセットデータ
 */
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

/**
 * 介護保険マスタプリセットを取得
 * 
 * @param year - 年度（例: 2024）
 * @returns 介護保険マスタのプリセットデータ
 */
export function getCareRatePreset(year: number): Partial<CareRateTable> {
  return {
    year,
    careRate: CARE_RATE_2024,
  };
}

/**
 * 厚生年金マスタプリセットを取得
 * 
 * @param year - 年度（例: 2024）
 * @returns 厚生年金マスタのプリセットデータ
 */
export function getPensionRatePreset(year: number): Partial<PensionRateTable> {
  return {
    year,
    pensionRate: PENSION_RATE_2024,
    bands: STANDARD_REWARD_BANDS_BASE,
  };
}
```

---

## 6. MastersPage の実装

**ファイル**: `src/app/pages/masters/masters.page.ts`

### 6-1. UI要件

- **タブ形式**で3つのマスタを切り替え
  - 「健康保険マスタ」タブ
  - 「介護保険マスタ」タブ
  - 「厚生年金マスタ」タブ

- 各タブには以下を表示:
  - 年度別のマスタ一覧（テーブル形式）
  - 「新規登録」ボタン
  - 各行に「編集」「削除」ボタン

### 6-2. テーブル列（健康保険マスタ例）

- 年度
- プラン種別（協会けんぽ/組合健保）
- 都道府県名（協会けんぽの場合）
- 組合名（組合健保の場合）
- 健康保険料率
- 等級数
- 操作（編集・削除）

### 6-3. 実装パターン

```typescript
import { Component, inject, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AsyncPipe, DecimalPipe, NgIf } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { MastersService } from '../../services/masters.service';
import { HealthRateTable, CareRateTable, PensionRateTable } from '../../types';
import { HealthMasterFormDialogComponent } from './health-master-form-dialog.component';
import { CareMasterFormDialogComponent } from './care-master-form-dialog.component';
import { PensionMasterFormDialogComponent } from './pension-master-form-dialog.component';

@Component({
  selector: 'ip-masters-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    AsyncPipe,
    DecimalPipe,
    NgIf
  ],
  template: `
    <section class="page masters">
      <mat-card>
        <h1>マスタ管理</h1>
        <p>保険料率や標準報酬等級を年度別に管理します。</p>

        <mat-tab-group>
          <!-- 健康保険マスタタブ -->
          <mat-tab label="健康保険マスタ">
            <!-- テーブルとボタン -->
          </mat-tab>

          <!-- 介護保険マスタタブ -->
          <mat-tab label="介護保険マスタ">
            <!-- テーブルとボタン -->
          </mat-tab>

          <!-- 厚生年金マスタタブ -->
          <mat-tab label="厚生年金マスタ">
            <!-- テーブルとボタン -->
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </section>
  `
})
export class MastersPage {
  // 実装
}
```

---

## 7. 健康保険マスタ編集ダイアログの実装

**ファイル**: `src/app/pages/masters/health-master-form-dialog.component.ts`

### 7-1. UI要件

- フォーム項目:
  - 年度（number, required）
  - プラン種別（select: 'kyokai' | 'kumiai', required）
  - 協会けんぽの場合:
    - 都道府県コード（select）
    - 都道府県名（自動入力）
  - 組合健保の場合:
    - 組合名（text）
    - 組合コード（text）
  - 健康保険料率（number, required, 0.01〜1.0の範囲）
  - 標準報酬等級表（動的フォーム配列）
    - 等級（number）
    - 下限額（number）
    - 上限額（number）
    - 標準報酬月額（number）

- 「協会けんぽの初期値を読み込む」ボタン（新規作成時のみ表示）
  - クリックで `kyokai-presets.ts` から該当都道府県のデータを読み込み

- 等級表の追加・削除ボタン

### 7-2. 実装パターン

`EmployeeFormDialogComponent` のパターンに従う。`FormArray` で等級表を動的に管理。

---

## 8. 介護保険マスタ編集ダイアログの実装

**ファイル**: `src/app/pages/masters/care-master-form-dialog.component.ts`

### 8-1. UI要件

- フォーム項目:
  - 年度（number, required）
  - 介護保険料率（number, required, 0.01〜1.0の範囲）

- 「協会けんぽの初期値を読み込む」ボタン（新規作成時のみ表示）

**注意**: 介護保険マスタは等級表を持たない（料率のみ）。

---

## 9. 厚生年金マスタ編集ダイアログの実装

**ファイル**: `src/app/pages/masters/pension-master-form-dialog.component.ts`

### 9-1. UI要件

- フォーム項目:
  - 年度（number, required）
  - 厚生年金保険料率（number, required, 0.01〜1.0の範囲）
  - 標準報酬等級表（動的フォーム配列）

- 「初期値を読み込む」ボタン（新規作成時のみ表示）

**注意**: 厚生年金は全国共通のため、事業所情報は不要。

---

## 10. バリデーション・エラーハンドリング

### 10-1. バリデーションルール

- 年度: 1900以上2100以下
- 保険料率: 0.01以上1.0以下（1%以上100%以下）
- 等級表:
  - 等級は1以上47以下
  - 下限額 < 上限額
  - 等級間の重複チェック（任意）

### 10-2. エラーハンドリング

- Firestore の保存エラーは `MatSnackBar` で通知
- フォームバリデーションエラーは適切に表示
- 削除時は確認ダイアログを表示

---

## 11. スキップ・非対象事項

この P1-5 では **やらない** と明示：

- ❌ 月次保険料計算画面からのマスタ自動取得（P1-6 以降で対応）
- ❌ 等級自動判定機能（報酬月額から等級を自動判定）
- ❌ CSVインポート・エクスポート
- ❌ 外部サイトからの自動取得

---

## 12. 受け入れ条件（動作確認の観点）

### 12-1. 基本動作

- ✅ マスタ管理画面が表示される
- ✅ 3つのタブが切り替えられる
- ✅ 各タブでマスタ一覧が表示される

### 12-2. CRUD操作

- ✅ 新規マスタを登録できる
- ✅ 既存マスタを編集できる
- ✅ マスタを削除できる（確認ダイアログ表示）

### 12-3. プリセット機能

- ✅ 協会けんぽの初期値を読み込める
- ✅ 読み込んだ値がフォームに反映される

### 12-4. バリデーション

- ✅ フォームバリデーションが正しく動作する
- ✅ エラーメッセージが適切に表示される

---

## 13. 実装時の注意事項

1. **既存コードの保護**: 既存の型定義やサービスを壊さない
2. **年度管理**: 年度ごとに複数のマスタが存在可能（改定対応）
3. **協会けんぽの都道府県情報**: `Office` の `kyokaiPrefCode` と連携
4. **標準報酬等級表のバリデーション**: 等級間の重複チェック（任意）
5. **Firestore の undefined**: `undefined` フィールドは保存しない

---

## 14. 参考実装

既存の `EmployeesPage` や `OfficesPage` のパターンを参考にしてください：

- `CurrentOfficeService` の使用
- `MatTableModule` でのテーブル表示
- `MatDialog` での編集ダイアログ
- `MatSnackBar` での通知
- `signal` での状態管理

---

**実装完了後は、この指示書のチェックリストを確認して、実装状況を更新してください。**

