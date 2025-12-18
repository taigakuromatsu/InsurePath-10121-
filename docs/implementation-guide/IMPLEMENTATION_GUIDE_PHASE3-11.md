# Phase3-11 実装指示書: 保険料率・等級表クラウドマスタ・自動更新機能

**作成日**: 2025年12月4日  
**対象フェーズ**: Phase3-11  
**優先度**: 🟢 低（拡張機能）  
**依存関係**: Phase1-5（マスタ管理機能）  
**目標完了日**: 2025年12月5日

---

## 📋 概要

Phase3-11では、**協会けんぽおよび厚生年金などの全国共通マスタについて、システム全体で共有する「クラウドマスタ」として保険料率・等級表を一元管理できるようにする**機能を実装します。

システム管理者（開発者）がクラウドマスタを更新すると、協会けんぽの全事務所の初期値が自動的に更新される仕組みを構築します。

### 主な機能

1. **クラウドマスタコレクション**: システム全体で共有するマスタデータ（年度+都道府県コードで管理）
2. **自動初期値取得**: 新規マスタ作成時にクラウドマスタから自動的に初期値を取得
3. **プリセット読み込み**: 編集時に「プリセットを読み込む」ボタンでクラウドマスタから最新値を取得
4. **クラウドマスタ管理画面**: 開発者用の隠しページ（サイドメニューには表示しない）

### 重要な位置づけ

- **年度ベースの管理**: 保険料率の変更は年度が替わったときに起きるため、マスタも**年度**でデータを管理（4月〜3月の期間）
  - 例: 令和6年度（2024年度）= 2024年4月〜2025年3月、令和7年度（2025年度）= 2025年4月〜2026年3月
  - `year`フィールドは年度の開始年を表す（例: 2024年度なら`year: 2024`）
- **都道府県別データもクラウドマスタから取得**: 健康保険料率の都道府県別データも年度ごとにクラウドマスタで管理
- **新規作成時は自動設定**: ユーザー操作なしでクラウドマスタから初期値を自動取得
- **編集時は手動操作**: 既存データを表示し、「プリセットを読み込む」ボタンでクラウドマスタから再取得
- **開発者専用機能**: クラウドマスタ管理画面は開発者のみがアクセス可能（URLを知っている人だけ）

---

## 🎯 目的・このフェーズで達成したいこと

### 主な目的

1. **マスタデータの一元管理**: 全国共通の保険料率・等級表をクラウドマスタで一元管理
2. **初期値の自動適用**: 新規マスタ作成時にクラウドマスタから自動的に初期値を取得
3. **年度ごとの更新対応**: 年度ごとに変わる保険料率をクラウドマスタで管理
4. **都道府県別データの管理**: 健康保険料率の都道府県別データも年度ごとに管理

### このフェーズで達成する具体的な成果

- システム管理者がクラウドマスタを更新すると、全事務所の新規マスタ作成時に最新の初期値が自動適用される
- 新規マスタ作成時にユーザー操作なしでクラウドマスタから初期値を取得
- 編集時に「プリセットを読み込む」ボタンでクラウドマスタから最新値を再取得できる
- 全47都道府県分の健康保険料率データをクラウドマスタに登録できる

---

## 📎 対象範囲・非対象（スコープ / アウトオブスコープ）

### 対象範囲（Phase3-11で実装する内容）

#### 1. クラウドマスタのデータ構造

- `cloudHealthRateTables/{year}_{prefCode}`コレクション（年度+都道府県コードで管理）
- `cloudCareRateTables/{year}`コレクション（年度で管理、全国一律）
- `cloudPensionRateTables/{year}`コレクション（年度で管理、全国一律）

#### 2. CloudMasterServiceの実装

- クラウドマスタの取得メソッド（年度・都道府県コード指定）
- クラウドマスタの更新メソッド（システム管理者用）
- 事業所マスタへの初期値取得メソッド（クラウドマスタから取得）

#### 3. マスタフォームダイアログの拡張

- **新規作成時**: クラウドマスタから自動的に初期値を取得して設定（ボタン操作不要）
  - 健康保険: 都道府県選択時（`onPrefChange()`）に自動取得
  - 介護保険・厚生年金: フォーム初期化時（`constructor`）に自動取得
- **編集時**: 既存データを表示（自動更新しない）
  - 「プリセットを読み込む」ボタンでクラウドマスタから初期値を再取得（上書き）

#### 4. クラウドマスタ管理画面（開発者用）

- 新規ページ: `/cloud-masters`（admin専用、サイドメニューには表示しない）
- クラウドマスタの一覧表示・編集・削除
- 年度別・都道府県別の健康保険料率管理
- 年度別の介護保険料率・厚生年金保険料率管理

#### 5. 都道府県別データの実装

- 全47都道府県分の健康保険料率データをクラウドマスタに登録
- `kyokai-presets.ts`のハードコードされたデータは、クラウドマスタ取得失敗時のフォールバック用として保持

#### 6. Firestoreセキュリティルール

- クラウドマスタの読み取り: 全認証ユーザーが閲覧可能
- クラウドマスタの作成・更新・削除: adminロールのみ（システム管理者が更新可能）

### 非対象範囲（Phase3-11では実装しない内容）

- **クラウドマスタ更新時の自動通知機能**: 各事業所への自動通知は将来拡張として検討
- **クラウドマスタの改定履歴管理**: `version`フィールドは将来拡張用として定義のみ
- **CSVインポートによる一括登録機能**: 初期データ登録は管理者が`/cloud-masters`ページから手作業で登録（将来はスクリプト等による一括登録も検討）
- **クラウドマスタの自動同期機能**: 各事業所のマスタへの自動反映は将来拡張として検討

---

## 🏗️ 現在の実装状況

### 既存のマスタ管理機能

#### 1. 型定義（`src/app/types.ts`）

- `HealthRateTable`インターフェース: 健康保険料率マスタ
  - `officeId`: 事業所ID（必須）
  - `year`: 年度
  - `planType`: `'kyokai' | 'kumiai'`
  - `kyokaiPrefCode`: 都道府県コード（協会けんぽの場合）
  - `kyokaiPrefName`: 都道府県名（協会けんぽの場合）
  - `healthRate`: 健康保険料率
  - `bands`: 標準報酬等級表

- `CareRateTable`インターフェース: 介護保険料率マスタ
  - `officeId`: 事業所ID（必須）
  - `year`: 年度
  - `careRate`: 介護保険料率

- `PensionRateTable`インターフェース: 厚生年金保険料率マスタ
  - `officeId`: 事業所ID（必須）
  - `year`: 年度
  - `pensionRate`: 厚生年金保険料率
  - `bands`: 標準報酬等級表

#### 2. MastersService（`src/app/services/masters.service.ts`）

- 事業所ごとのマスタ管理（`offices/{officeId}/healthRateTables`など）
- CRUD操作メソッド（`listHealthRateTables()`、`getHealthRateTable()`、`saveHealthRateTable()`など）
- `getRatesForYearMonth()`: 対象年月の料率を取得（保険料計算で使用）

#### 3. マスタ管理画面（`src/app/pages/masters/masters.page.ts`）

- タブ形式で健康保険・介護保険・厚生年金のマスタを管理
- 年度別マスタ一覧表示
- マスタ追加・編集・削除ボタン

#### 4. マスタフォームダイアログ

- `health-master-form-dialog.component.ts`: 健康保険マスタの登録・編集
  - 都道府県選択時に`onPrefChange()`が呼ばれる
  - 「プリセットを読み込む」ボタンで`loadPreset()`が呼ばれる（新規作成時のみ表示）
  - 現在は`getKyokaiHealthRatePreset()`を使用（ハードコードされたデータ）

- `care-master-form-dialog.component.ts`: 介護保険マスタの登録・編集
  - 「初期値を読み込む」ボタンで`loadPreset()`が呼ばれる（新規作成時のみ表示）
  - 現在は`getCareRatePreset()`を使用（ハードコードされたデータ）

- `pension-master-form-dialog.component.ts`: 厚生年金マスタの登録・編集
  - 「初期値を読み込む」ボタンで`loadPreset()`が呼ばれる（新規作成時のみ表示）
  - 現在は`getPensionRatePreset()`を使用（ハードコードされたデータ）

#### 5. プリセットデータ（`src/app/utils/kyokai-presets.ts`）

- `PREFECTURE_CODES`: 都道府県コードマッピング（全47都道府県）
- `KYOKAI_HEALTH_RATES_2024`: 健康保険料率（都道府県別、現在は3都道府県のみ）
- `HEALTH_STANDARD_REWARD_BANDS_DEFAULT`: 健康保険の標準報酬等級表（全国一律）
- `STANDARD_REWARD_BANDS_BASE`: `HEALTH_STANDARD_REWARD_BANDS_DEFAULT`のエイリアス（既存コードとの互換用）
- `CARE_RATE_2024`: 介護保険料率（全国一律）
- `PENSION_RATE_2024`: 厚生年金保険料率（全国一律）
- `PENSION_STANDARD_REWARD_BANDS_DEFAULT`: 厚生年金の標準報酬等級表（全国一律）
- `getKyokaiHealthRatePreset()`: 協会けんぽの健康保険料率プリセット取得関数
- `getCareRatePreset()`: 介護保険料率プリセット取得関数
- `getPensionRatePreset()`: 厚生年金保険料率プリセット取得関数

#### 6. Firestoreセキュリティルール（`firestore.rules`）

- `offices/{officeId}/healthRateTables/{docId}`: adminのみ作成・更新・削除可能、所属ユーザー全員閲覧可能
- `offices/{officeId}/careRateTables/{docId}`: adminのみ作成・更新・削除可能、所属ユーザー全員閲覧可能
- `offices/{officeId}/pensionRateTables/{docId}`: adminのみ作成・更新・削除可能、所属ユーザー全員閲覧可能

#### 7. ルーティング（`src/app/app.routes.ts`）

- `/masters`ルート: admin専用

#### 8. サイドメニュー（`src/app/app.ts`）

- 「マスタ管理」メニュー項目: admin専用

---

## 📐 データモデル仕様

### クラウドマスタの型定義

#### CloudHealthRateTable

```typescript
export interface CloudHealthRateTable {
  id: string; // ドキュメントID（形式: "{year}_{prefCode}"、例: "2024_13"）
  year: number; // 年度（年度の開始年、例: 2024年度なら2024）
  planType: 'kyokai'; // クラウドマスタは協会けんぽのみ（組合健保は事業所ごとに異なるため）
  kyokaiPrefCode: string; // 都道府県コード（2桁、例: "13"）
  kyokaiPrefName: string; // 都道府県名（例: "東京都"）
  healthRate: number; // 健康保険料率（事業主＋被保険者合計の率、小数形式、例: 0.1031 = 10.31%）
  bands: StandardRewardBand[]; // 標準報酬等級表（全国一律）
  createdAt: IsoDateString; // 作成日時
  updatedAt: IsoDateString; // 更新日時
  updatedByUserId: string; // 更新者ユーザーID
  version?: number; // 改定履歴管理用（将来拡張、現時点では未使用）
}
```

**注意**: 
- `id`は`{year}_{prefCode}`形式（例: `"2024_13"`）で、年度と都道府県コードの組み合わせで一意に識別
- `year`は**年度の開始年**を表す（例: 2024年度 = 2024年4月〜2025年3月なら`year: 2024`）
- `planType`は常に`'kyokai'`（組合健保は事業所ごとに異なるため、クラウドマスタでは管理しない）
- `healthRate`は小数形式で管理（例: 10.31% = 0.1031）

#### CloudCareRateTable

```typescript
export interface CloudCareRateTable {
  id: string; // ドキュメントID（形式: "{year}"、例: "2024"）
  year: number; // 年度（年度の開始年、例: 2024年度なら2024）
  careRate: number; // 介護保険料率（事業主＋被保険者合計の率、全国一律、小数形式、例: 0.0159 = 1.59%）
  createdAt: IsoDateString; // 作成日時
  updatedAt: IsoDateString; // 更新日時
  updatedByUserId: string; // 更新者ユーザーID
  version?: number; // 改定履歴管理用（将来拡張、現時点では未使用）
}
```

**注意**: 
- `id`は`{year}`形式（例: `"2024"`）で、年度で一意に識別
- `year`は**年度の開始年**を表す（例: 2024年度 = 2024年4月〜2025年3月なら`year: 2024`）
- 介護保険料率は全国一律のため、都道府県コードは不要
- `careRate`は小数形式で管理（例: 1.59% = 0.0159）

#### CloudPensionRateTable

```typescript
export interface CloudPensionRateTable {
  id: string; // ドキュメントID（形式: "{year}"、例: "2024"）
  year: number; // 年度（年度の開始年、例: 2024年度なら2024）
  pensionRate: number; // 厚生年金保険料率（事業主＋被保険者合計の率、全国一律、小数形式、例: 0.183 = 18.3%）
  bands: StandardRewardBand[]; // 標準報酬等級表（全国一律）
  createdAt: IsoDateString; // 作成日時
  updatedAt: IsoDateString; // 更新日時
  updatedByUserId: string; // 更新者ユーザーID
  version?: number; // 改定履歴管理用（将来拡張、現時点では未使用）
}
```

**注意**: 
- `id`は`{year}`形式（例: `"2024"`）で、年度で一意に識別
- `year`は**年度の開始年**を表す（例: 2024年度 = 2024年4月〜2025年3月なら`year: 2024`）
- 厚生年金保険料率は全国一律のため、都道府県コードは不要
- `pensionRate`は小数形式で管理（例: 18.3% = 0.183）

### Firestoreコレクション構造

```
cloudHealthRateTables/
  ├── {year}_{prefCode}/  (例: 2024_13, 2024_27, 2025_13)
  │   - year: number
  │   - planType: 'kyokai'
  │   - kyokaiPrefCode: string
  │   - kyokaiPrefName: string
  │   - healthRate: number
  │   - bands: StandardRewardBand[]
  │   - createdAt: IsoDateString
  │   - updatedAt: IsoDateString
  │   - updatedByUserId: string
  │   - version?: number

cloudCareRateTables/
  ├── {year}/  (例: 2024, 2025)
  │   - year: number
  │   - careRate: number
  │   - createdAt: IsoDateString
  │   - updatedAt: IsoDateString
  │   - updatedByUserId: string
  │   - version?: number

cloudPensionRateTables/
  ├── {year}/  (例: 2024, 2025)
  │   - year: number
  │   - pensionRate: number
  │   - bands: StandardRewardBand[]
  │   - createdAt: IsoDateString
  │   - updatedAt: IsoDateString
  │   - updatedByUserId: string
  │   - version?: number
```

**注意**: 
- トップレベルに3つのコレクションを配置（`cloudMasters`という親コレクションは使用しない）
- 各コレクションは`officeId`を持たない（システム全体で共有）
- 健康保険料率は年度+都道府県コードで管理（全47都道府県×年度分のデータ）
- 介護保険料率・厚生年金保険料率は年度で管理（全国一律）

---

## 🖥️ 画面仕様

### 1. クラウドマスタ管理画面（`/cloud-masters`）

**アクセス**: admin専用、サイドメニューには表示しない（URLを知っている人だけアクセス可能）

**レイアウト**:
- ヘッダーカード: タイトル「クラウドマスタ管理」、説明文「システム全体で共有する保険料率・等級表を管理します。」
- タブ形式で3つのタブ:
  - **健康保険マスタ**: 年度別・都道府県別の健康保険料率一覧
  - **介護保険マスタ**: 年度別の介護保険料率一覧
  - **厚生年金マスタ**: 年度別の厚生年金保険料率一覧

**健康保険マスタタブ**:
- 年度選択ドロップダウン（デフォルト: 現在の年度）
- 都道府県別の健康保険料率一覧テーブル（47都道府県分）
  - 列: 都道府県コード、都道府県名、健康保険料率、標準報酬等級数、更新日時、操作
- 「新規登録」ボタン（年度+都道府県コードを指定して作成）
- 各行に「編集」「削除」ボタン

**介護保険マスタタブ**:
- 年度別の介護保険料率一覧テーブル
  - 列: 年度、介護保険料率、更新日時、操作
- 「新規登録」ボタン（年度を指定して作成）
- 各行に「編集」「削除」ボタン

**厚生年金マスタタブ**:
- 年度別の厚生年金保険料率一覧テーブル
  - 列: 年度、厚生年金保険料率、標準報酬等級数、更新日時、操作
- 「新規登録」ボタン（年度を指定して作成）
- 各行に「編集」「削除」ボタン

**クラウドマスタ編集ダイアログ**:
- 健康保険マスタ編集: 年度、都道府県コード、都道府県名、健康保険料率、標準報酬等級表の編集
- 介護保険マスタ編集: 年度、介護保険料率の編集
- 厚生年金マスタ編集: 年度、厚生年金保険料率、標準報酬等級表の編集
- 標準報酬等級表の編集機能（既存のマスタフォームダイアログと同様）

### 2. マスタ管理画面（`/masters`）の変更

**変更なし**: 既存の画面はそのまま維持（事業所ごとのマスタ管理）

### 3. マスタフォームダイアログの変更

#### 健康保険マスタフォームダイアログ（`health-master-form-dialog.component.ts`）

**新規作成時の動作**:
1. フォーム初期化時（`constructor`）:
   - プラン種別が`'kyokai'`で、`kyokaiPrefCode`が設定されている場合:
     - **クラウドマスタから自動的に年度+都道府県コードで健康保険料率と標準報酬等級を取得**
     - 取得に失敗した場合は、`getKyokaiHealthRatePreset()`をフォールバックとして使用
   - プラン種別が`'kumiai'`の場合:
     - クラウドマスタから取得しない（組合健保は事業所ごとに異なるため）
     - 標準報酬等級のみ`STANDARD_REWARD_BANDS_BASE`（=`HEALTH_STANDARD_REWARD_BANDS_DEFAULT`のエイリアス）を設定

2. 都道府県選択時（`onPrefChange()`）:
   - 都道府県名を更新
   - **クラウドマスタから自動的に年度+都道府県コードで健康保険料率と標準報酬等級を取得**
   - 取得に失敗した場合は、`getKyokaiHealthRatePreset()`をフォールバックとして使用
   - フォームに自動設定（ユーザー操作不要）

**編集時の動作**:
1. 既存データをフォームに表示（クラウドマスタから自動取得しない）
2. 「プリセットを読み込む」ボタン（新規作成時のみ表示 → **編集時も表示**）:
   - クリック時にクラウドマスタから最新の初期値を取得
   - 取得に失敗した場合は、`getKyokaiHealthRatePreset()`をフォールバックとして使用
   - フォームに上書き設定

**変更点**:
- 「プリセットを読み込む」ボタンの表示条件を変更: `*ngIf="!data.table"` → `*ngIf="true"`（編集時も表示）
- `onPrefChange()`メソッドを拡張: クラウドマスタから自動取得する処理を追加
- `constructor`を拡張: 新規作成時にクラウドマスタから自動取得する処理を追加
- `loadPreset()`メソッドを変更: クラウドマスタから取得する処理に変更

#### 介護保険マスタフォームダイアログ（`care-master-form-dialog.component.ts`）

**新規作成時の動作**:
1. フォーム初期化時（`constructor`）:
   - **クラウドマスタから自動的に年度で介護保険料率を取得**
   - 取得に失敗した場合は、`getCareRatePreset()`をフォールバックとして使用
   - フォームに自動設定（ユーザー操作不要）

**編集時の動作**:
1. 既存データをフォームに表示（クラウドマスタから自動取得しない）
2. 「初期値を読み込む」ボタン（新規作成時のみ表示 → **編集時も表示**）:
   - クリック時にクラウドマスタから最新の初期値を取得
   - 取得に失敗した場合は、`getCareRatePreset()`をフォールバックとして使用
   - フォームに上書き設定

**変更点**:
- 「初期値を読み込む」ボタンの表示条件を変更: `*ngIf="!data.table"` → `*ngIf="true"`（編集時も表示）
- `constructor`を拡張: 新規作成時にクラウドマスタから自動取得する処理を追加
- `loadPreset()`メソッドを変更: クラウドマスタから取得する処理に変更

#### 厚生年金マスタフォームダイアログ（`pension-master-form-dialog.component.ts`）

**新規作成時の動作**:
1. フォーム初期化時（`constructor`）:
   - **クラウドマスタから自動的に年度で厚生年金保険料率と標準報酬等級を取得**
   - 取得に失敗した場合は、`getPensionRatePreset()`をフォールバックとして使用
   - フォームに自動設定（ユーザー操作不要）

**編集時の動作**:
1. 既存データをフォームに表示（クラウドマスタから自動取得しない）
2. 「初期値を読み込む」ボタン（新規作成時のみ表示 → **編集時も表示**）:
   - クリック時にクラウドマスタから最新の初期値を取得
   - 取得に失敗した場合は、`getPensionRatePreset()`をフォールバックとして使用
   - フォームに上書き設定

**変更点**:
- 「初期値を読み込む」ボタンの表示条件を変更: `*ngIf="!data.table"` → `*ngIf="true"`（編集時も表示）
- `constructor`を拡張: 新規作成時にクラウドマスタから自動取得する処理を追加
- `loadPreset()`メソッドを変更: クラウドマスタから取得する処理に変更

---

## 🔐 アクセス制御（Firestoreルール）

### クラウドマスタコレクションのルール

```javascript
// 健康保険クラウドマスタ（システム全体で共有）
match /cloudHealthRateTables/{docId} {
  // 読み取り: 全認証ユーザーが閲覧可能
  allow read: if isSignedIn();
  
  // 作成・更新・削除: adminロールのみ（システム管理者が更新可能）
  allow create, update, delete: if isSignedIn() && getUserRole() == 'admin';
}

// 介護保険クラウドマスタ（システム全体で共有）
match /cloudCareRateTables/{docId} {
  // 読み取り: 全認証ユーザーが閲覧可能
  allow read: if isSignedIn();
  
  // 作成・更新・削除: adminロールのみ（システム管理者が更新可能）
  allow create, update, delete: if isSignedIn() && getUserRole() == 'admin';
}

// 厚生年金クラウドマスタ（システム全体で共有）
match /cloudPensionRateTables/{docId} {
  // 読み取り: 全認証ユーザーが閲覧可能
  allow read: if isSignedIn();
  
  // 作成・更新・削除: adminロールのみ（システム管理者が更新可能）
  allow create, update, delete: if isSignedIn() && getUserRole() == 'admin';
}
```

**注意**: 
- 各コレクションは`officeId`を持たないため、`belongsToOffice()`などの事業所チェックは不要
- 読み取りは全認証ユーザーが可能（各事業所のマスタ作成時に参照するため）
- 作成・更新・削除はadminロールのみ（システム管理者が更新可能）

### 既存の事業所マスタコレクションのルール

**変更なし**: 既存の`offices/{officeId}/healthRateTables`などのルールはそのまま維持

---

## 📝 実装タスクリスト

### 1. 型定義の追加（`src/app/types.ts`）

- [ ] `CloudHealthRateTable`インターフェースを追加
- [ ] `CloudCareRateTable`インターフェースを追加
- [ ] `CloudPensionRateTable`インターフェースを追加

**実装例**:
```typescript
export interface CloudHealthRateTable {
  id: string; // "{year}_{prefCode}"形式
  year: number;
  planType: 'kyokai';
  kyokaiPrefCode: string;
  kyokaiPrefName: string;
  healthRate: number;
  bands: StandardRewardBand[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  updatedByUserId: string;
  version?: number;
}

export interface CloudCareRateTable {
  id: string; // "{year}"形式
  year: number;
  careRate: number;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  updatedByUserId: string;
  version?: number;
}

export interface CloudPensionRateTable {
  id: string; // "{year}"形式
  year: number;
  pensionRate: number;
  bands: StandardRewardBand[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  updatedByUserId: string;
  version?: number;
}
```

### 2. CloudMasterServiceの実装（`src/app/services/cloud-master.service.ts`）

- [ ] `CloudMasterService`クラスを作成
- [ ] `getCloudHealthRateTable(year: number, prefCode: string): Observable<CloudHealthRateTable | null>`メソッドを実装（`cloudHealthRateTables`コレクションを参照）
- [ ] `getCloudCareRateTable(year: number): Observable<CloudCareRateTable | null>`メソッドを実装（`cloudCareRateTables`コレクションを参照）
- [ ] `getCloudPensionRateTable(year: number): Observable<CloudPensionRateTable | null>`メソッドを実装（`cloudPensionRateTables`コレクションを参照）
- [ ] `saveCloudHealthRateTable(table: Partial<CloudHealthRateTable> & { id?: string }): Promise<void>`メソッドを実装
- [ ] `saveCloudCareRateTable(table: Partial<CloudCareRateTable> & { id?: string }): Promise<void>`メソッドを実装
- [ ] `saveCloudPensionRateTable(table: Partial<CloudPensionRateTable> & { id?: string }): Promise<void>`メソッドを実装
- [ ] `deleteCloudHealthRateTable(year: number, prefCode: string): Promise<void>`メソッドを実装
- [ ] `deleteCloudCareRateTable(year: number): Promise<void>`メソッドを実装
- [ ] `deleteCloudPensionRateTable(year: number): Promise<void>`メソッドを実装
- [ ] `listCloudHealthRateTables(year?: number): Observable<CloudHealthRateTable[]>`メソッドを実装（年度指定可、未指定時は全件）
- [ ] `listCloudCareRateTables(): Observable<CloudCareRateTable[]>`メソッドを実装
- [ ] `listCloudPensionRateTables(): Observable<CloudPensionRateTable[]>`メソッドを実装
- [ ] `getHealthRatePresetFromCloud(year: number, prefCode: string): Promise<Partial<HealthRateTable>>`メソッドを実装（事業所マスタ用の初期値取得）
- [ ] `getCareRatePresetFromCloud(year: number): Promise<Partial<CareRateTable>>`メソッドを実装（事業所マスタ用の初期値取得）
- [ ] `getPensionRatePresetFromCloud(year: number): Promise<Partial<PensionRateTable>>`メソッドを実装（事業所マスタ用の初期値取得）

**実装のポイント**:
- コレクション参照: `cloudHealthRateTables`、`cloudCareRateTables`、`cloudPensionRateTables`をトップレベルで参照（`cloudMasters`という親コレクションは使用しない）
- `id`の生成: `cloudHealthRateTables`は`${year}_${prefCode}`形式、`cloudCareRateTables`と`cloudPensionRateTables`は`${year}`形式
- `removeUndefinedDeep()`メソッドを使用してFirestore書き込み前に`undefined`フィールドを除去
- `updatedByUserId`は`CurrentUserService`から取得（`saveCloudHealthRateTable`、`saveCloudCareRateTable`、`saveCloudPensionRateTable`メソッド内で設定）
- `getHealthRatePresetFromCloud`、`getCareRatePresetFromCloud`、`getPensionRatePresetFromCloud`メソッドは`Promise`を返す（フォームダイアログで`await`で使用するため）
- エラーハンドリング: クラウドマスタが存在しない場合は`null`を返す（フォールバック処理に委ねる）

### 3. マスタフォームダイアログの拡張

#### 3-1. 健康保険マスタフォームダイアログ（`health-master-form-dialog.component.ts`）

- [ ] `CloudMasterService`をインジェクト
- [ ] `constructor`を拡張:
  - 新規作成時（`!data.table`）かつプラン種別が`'kyokai'`で`kyokaiPrefCode`が設定されている場合:
    - `CloudMasterService.getHealthRatePresetFromCloud()`を呼び出し
    - 成功時: 取得したデータをフォームに設定
    - 失敗時: `getKyokaiHealthRatePreset()`をフォールバックとして使用
- [ ] `onPrefChange()`メソッドを拡張:
  - 都道府県名を更新
  - プラン種別が`'kyokai'`の場合:
    - `CloudMasterService.getHealthRatePresetFromCloud()`を呼び出し
    - 成功時: 取得したデータをフォームに設定
    - 失敗時: `getKyokaiHealthRatePreset()`をフォールバックとして使用
- [ ] `loadPreset()`メソッドを変更:
  - プラン種別が`'kyokai'`の場合:
    - `CloudMasterService.getHealthRatePresetFromCloud()`を呼び出し
    - 成功時: 取得したデータをフォームに設定
    - 失敗時: `getKyokaiHealthRatePreset()`をフォールバックとして使用
  - プラン種別が`'kumiai'`の場合:
    - 既存の処理を維持（組合健保はクラウドマスタから取得しない）
- [ ] 「プリセットを読み込む」ボタンの表示条件を変更: `*ngIf="!data.table"` → `*ngIf="true"`（編集時も表示）

#### 3-2. 介護保険マスタフォームダイアログ（`care-master-form-dialog.component.ts`）

- [ ] `CloudMasterService`をインジェクト
- [ ] `constructor`を拡張:
  - 新規作成時（`!data.table`）の場合:
    - `CloudMasterService.getCareRatePresetFromCloud()`を呼び出し
    - 成功時: 取得したデータをフォームに設定
    - 失敗時: `getCareRatePreset()`をフォールバックとして使用
- [ ] `loadPreset()`メソッドを変更:
  - `CloudMasterService.getCareRatePresetFromCloud()`を呼び出し
  - 成功時: 取得したデータをフォームに設定
  - 失敗時: `getCareRatePreset()`をフォールバックとして使用
- [ ] 「初期値を読み込む」ボタンの表示条件を変更: `*ngIf="!data.table"` → `*ngIf="true"`（編集時も表示）

#### 3-3. 厚生年金マスタフォームダイアログ（`pension-master-form-dialog.component.ts`）

- [ ] `CloudMasterService`をインジェクト
- [ ] `constructor`を拡張:
  - 新規作成時（`!data.table`）の場合:
    - `CloudMasterService.getPensionRatePresetFromCloud()`を呼び出し
    - 成功時: 取得したデータをフォームに設定
    - 失敗時: `getPensionRatePreset()`をフォールバックとして使用
- [ ] `loadPreset()`メソッドを変更:
  - `CloudMasterService.getPensionRatePresetFromCloud()`を呼び出し
  - 成功時: 取得したデータをフォームに設定
  - 失敗時: `getPensionRatePreset()`をフォールバックとして使用
- [ ] 「初期値を読み込む」ボタンの表示条件を変更: `*ngIf="!data.table"` → `*ngIf="true"`（編集時も表示）

### 4. クラウドマスタ管理画面の実装（`src/app/pages/cloud-masters/cloud-masters.page.ts`）

- [ ] `CloudMastersPage`コンポーネントを作成
- [ ] タブ形式で3つのタブを実装:
  - 健康保険マスタタブ
  - 介護保険マスタタブ
  - 厚生年金マスタタブ
- [ ] 健康保険マスタタブ:
  - 年度選択ドロップダウン（デフォルト: 現在の年度）
  - 都道府県別の健康保険料率一覧テーブル（47都道府県分）
  - 「新規登録」ボタン（年度+都道府県コードを指定して作成）
  - 各行に「編集」「削除」ボタン
- [ ] 介護保険マスタタブ:
  - 年度別の介護保険料率一覧テーブル
  - 「新規登録」ボタン（年度を指定して作成）
  - 各行に「編集」「削除」ボタン
- [ ] 厚生年金マスタタブ:
  - 年度別の厚生年金保険料率一覧テーブル
  - 「新規登録」ボタン（年度を指定して作成）
  - 各行に「編集」「削除」ボタン
- [ ] エラーハンドリングとSnackBar通知

### 5. クラウドマスタ編集ダイアログの実装

#### 5-1. 健康保険マスタ編集ダイアログ（`cloud-health-master-form-dialog.component.ts`）

- [ ] `CloudHealthMasterFormDialogComponent`コンポーネントを作成
- [ ] `CloudMasterService`をインジェクト
- [ ] `CurrentUserService`をインジェクト（`updatedByUserId`取得用）
- [ ] 年度、都道府県コード、都道府県名、健康保険料率、標準報酬等級表の編集フォーム
- [ ] 標準報酬等級表の編集機能（既存の`health-master-form-dialog.component.ts`と同様）
- [ ] `CloudMasterService.saveCloudHealthRateTable()`を呼び出して保存（`updatedByUserId`を設定）

#### 5-2. 介護保険マスタ編集ダイアログ（`cloud-care-master-form-dialog.component.ts`）

- [ ] `CloudCareMasterFormDialogComponent`コンポーネントを作成
- [ ] `CloudMasterService`をインジェクト
- [ ] `CurrentUserService`をインジェクト（`updatedByUserId`取得用）
- [ ] 年度、介護保険料率の編集フォーム
- [ ] `CloudMasterService.saveCloudCareRateTable()`を呼び出して保存（`updatedByUserId`を設定）

#### 5-3. 厚生年金マスタ編集ダイアログ（`cloud-pension-master-form-dialog.component.ts`）

- [ ] `CloudPensionMasterFormDialogComponent`コンポーネントを作成
- [ ] `CloudMasterService`をインジェクト
- [ ] `CurrentUserService`をインジェクト（`updatedByUserId`取得用）
- [ ] 年度、厚生年金保険料率、標準報酬等級表の編集フォーム
- [ ] 標準報酬等級表の編集機能（既存の`pension-master-form-dialog.component.ts`と同様）
- [ ] `CloudMasterService.saveCloudPensionRateTable()`を呼び出して保存（`updatedByUserId`を設定）

### 6. 都道府県別データの実装（`src/app/utils/kyokai-presets.ts`）

- [ ] `KYOKAI_HEALTH_RATES_2024`に全47都道府県のデータを追加（令和6年度 = 2024年度のデータ）
- [ ] `KYOKAI_HEALTH_RATES_2025`に全47都道府県のデータを追加（令和7年度 = 2025年度のデータ）
- [ ] `getKyokaiHealthRatePreset()`関数を拡張: 年度に応じて適切なデータを返すように変更
- [ ] `getKyokaiHealthRatePreset()`関数はフォールバック用として保持（クラウドマスタ取得失敗時に使用）

**実装例**:
```typescript
/**
 * 協会けんぽの健康保険料率（都道府県別、令和6年度 = 2024年度）
 * 年度: 2024年4月〜2025年3月
 */
export const KYOKAI_HEALTH_RATES_2024: Record<string, number> = {
  '01': 0.1021, // 北海道: 10.21%
  '02': 0.0949, // 青森県: 9.49%
  '03': 0.0963, // 岩手県: 9.63%
  '04': 0.1001, // 宮城県: 10.01%
  '05': 0.0985, // 秋田県: 9.85%
  '06': 0.0984, // 山形県: 9.84%
  '07': 0.0959, // 福島県: 9.59%
  '08': 0.0966, // 茨城県: 9.66%
  '09': 0.0979, // 栃木県: 9.79%
  '10': 0.0981, // 群馬県: 9.81%
  '11': 0.0978, // 埼玉県: 9.78%
  '12': 0.0977, // 千葉県: 9.77%
  '13': 0.0998, // 東京都: 9.98%
  '14': 0.1002, // 神奈川県: 10.02%
  '15': 0.0935, // 新潟県: 9.35%
  '16': 0.0962, // 富山県: 9.62%
  '17': 0.0994, // 石川県: 9.94%
  '18': 0.1007, // 福井県: 10.07%
  '19': 0.0994, // 山梨県: 9.94%
  '20': 0.0955, // 長野県: 9.55%
  '21': 0.0991, // 岐阜県: 9.91%
  '22': 0.0985, // 静岡県: 9.85%
  '23': 0.1002, // 愛知県: 10.02%
  '24': 0.0994, // 三重県: 9.94%
  '25': 0.0989, // 滋賀県: 9.89%
  '26': 0.1013, // 京都府: 10.13%
  '27': 0.1034, // 大阪府: 10.34%
  '28': 0.1018, // 兵庫県: 10.18%
  '29': 0.1022, // 奈良県: 10.22%
  '30': 0.1000, // 和歌山県: 10.00%
  '31': 0.0968, // 鳥取県: 9.68%
  '32': 0.0992, // 島根県: 9.92%
  '33': 0.1002, // 岡山県: 10.02%
  '34': 0.0995, // 広島県: 9.95%
  '35': 0.1020, // 山口県: 10.20%
  '36': 0.1019, // 徳島県: 10.19%
  '37': 0.1033, // 香川県: 10.33%
  '38': 0.1003, // 愛媛県: 10.03%
  '39': 0.0989, // 高知県: 9.89%
  '40': 0.1035, // 福岡県: 10.35%
  '41': 0.1042, // 佐賀県: 10.42%
  '42': 0.1017, // 長崎県: 10.17%
  '43': 0.1030, // 熊本県: 10.30%
  '44': 0.1025, // 大分県: 10.25%
  '45': 0.0985, // 宮崎県: 9.85%
  '46': 0.1013, // 鹿児島県: 10.13%
  '47': 0.0952  // 沖縄県: 9.52%
};

/**
 * 協会けんぽの健康保険料率（都道府県別、令和7年度 = 2025年度）
 * 年度: 2025年4月〜2026年3月
 */
export const KYOKAI_HEALTH_RATES_2025: Record<string, number> = {
  '01': 0.1031, // 北海道: 10.31%
  '02': 0.0985, // 青森県: 9.85%
  '03': 0.0962, // 岩手県: 9.62%
  '04': 0.1011, // 宮城県: 10.11%
  '05': 0.1001, // 秋田県: 10.01%
  '06': 0.0975, // 山形県: 9.75%
  '07': 0.0962, // 福島県: 9.62%
  '08': 0.0967, // 茨城県: 9.67%
  '09': 0.0982, // 栃木県: 9.82%
  '10': 0.0977, // 群馬県: 9.77%
  '11': 0.0976, // 埼玉県: 9.76%
  '12': 0.0979, // 千葉県: 9.79%
  '13': 0.0991, // 東京都: 9.91%
  '14': 0.0992, // 神奈川県: 9.92%
  '15': 0.0955, // 新潟県: 9.55%
  '16': 0.0965, // 富山県: 9.65%
  '17': 0.0988, // 石川県: 9.88%
  '18': 0.0994, // 福井県: 9.94%
  '19': 0.0989, // 山梨県: 9.89%
  '20': 0.0969, // 長野県: 9.69%
  '21': 0.0993, // 岐阜県: 9.93%
  '22': 0.0980, // 静岡県: 9.80%
  '23': 0.1003, // 愛知県: 10.03%
  '24': 0.0999, // 三重県: 9.99%
  '25': 0.0997, // 滋賀県: 9.97%
  '26': 0.1003, // 京都府: 10.03%
  '27': 0.1024, // 大阪府: 10.24%
  '28': 0.1016, // 兵庫県: 10.16%
  '29': 0.1002, // 奈良県: 10.02%
  '30': 0.1019, // 和歌山県: 10.19%
  '31': 0.0993, // 鳥取県: 9.93%
  '32': 0.0994, // 島根県: 9.94%
  '33': 0.1017, // 岡山県: 10.17%
  '34': 0.0997, // 広島県: 9.97%
  '35': 0.1036, // 山口県: 10.36%
  '36': 0.1047, // 徳島県: 10.47%
  '37': 0.1021, // 香川県: 10.21%
  '38': 0.1018, // 愛媛県: 10.18%
  '39': 0.1013, // 高知県: 10.13%
  '40': 0.1031, // 福岡県: 10.31%
  '41': 0.1078, // 佐賀県: 10.78%
  '42': 0.1041, // 長崎県: 10.41%
  '43': 0.1012, // 熊本県: 10.12%
  '44': 0.1025, // 大分県: 10.25%
  '45': 0.1009, // 宮崎県: 10.09%
  '46': 0.1031, // 鹿児島県: 10.31%
  '47': 0.0944  // 沖縄県: 9.44%
};

export function getKyokaiHealthRatePreset(
  prefCode: string,
  year: number // 年度の開始年（例: 2024年度なら2024）
): Partial<HealthRateTable> {
  // 年度に応じて適切なデータを選択
  const rates = year >= 2025 ? KYOKAI_HEALTH_RATES_2025 : KYOKAI_HEALTH_RATES_2024;
  
  return {
    year,
    planType: 'kyokai',
    kyokaiPrefCode: prefCode,
    kyokaiPrefName: PREFECTURE_CODES[prefCode] ?? '',
    healthRate: rates[prefCode] ?? 0.1, // デフォルト値: 10%
    bands: HEALTH_STANDARD_REWARD_BANDS_DEFAULT // または STANDARD_REWARD_BANDS_BASE（エイリアス）
  };
}
```

**注意**: 
- 年度の開始年でデータを選択（例: 2024年度なら`year: 2024`、2025年度なら`year: 2025`）
- パーセンテージ表記（例: 10.31%）を小数形式（例: 0.1031）に変換して保存

### 7. ルーティングとサイドメニュー

#### 7-1. ルーティング（`src/app/app.routes.ts`）

- [ ] `/cloud-masters`ルートを追加（admin専用）
- [ ] `authGuard`、`officeGuard`、`roleGuard(['admin'])`を適用

**実装例**:
```typescript
{
  path: 'cloud-masters',
  canActivate: [authGuard, officeGuard, roleGuard(['admin'])],
  loadComponent: () => import('./pages/cloud-masters/cloud-masters.page').then((m) => m.CloudMastersPage)
}
```

#### 7-2. サイドメニュー（`src/app/app.ts`）

- [ ] **変更なし**: クラウドマスタ管理画面はサイドメニューに表示しない（開発者専用の隠しページ）

### 8. Firestoreセキュリティルール（`firestore.rules`）

- [ ] `cloudHealthRateTables`コレクションのルールを追加
- [ ] `cloudCareRateTables`コレクションのルールを追加
- [ ] `cloudPensionRateTables`コレクションのルールを追加
- [ ] 読み取り: 全認証ユーザーが閲覧可能
- [ ] 作成・更新・削除: adminロールのみ

**実装例**:
```javascript
// 健康保険クラウドマスタ（システム全体で共有）
match /cloudHealthRateTables/{docId} {
  // 読み取り: 全認証ユーザーが閲覧可能
  allow read: if isSignedIn();
  
  // 作成・更新・削除: adminロールのみ（システム管理者が更新可能）
  allow create, update, delete: if isSignedIn() && getUserRole() == 'admin';
}

// 介護保険クラウドマスタ（システム全体で共有）
match /cloudCareRateTables/{docId} {
  // 読み取り: 全認証ユーザーが閲覧可能
  allow read: if isSignedIn();
  
  // 作成・更新・削除: adminロールのみ（システム管理者が更新可能）
  allow create, update, delete: if isSignedIn() && getUserRole() == 'admin';
}

// 厚生年金クラウドマスタ（システム全体で共有）
match /cloudPensionRateTables/{docId} {
  // 読み取り: 全認証ユーザーが閲覧可能
  allow read: if isSignedIn();
  
  // 作成・更新・削除: adminロールのみ（システム管理者が更新可能）
  allow create, update, delete: if isSignedIn() && getUserRole() == 'admin';
}
```

### 9. Firestoreインデックスの設定

- [ ] `cloudHealthRateTables`コレクション: `year`、`kyokaiPrefCode`の複合インデックス（必要に応じて）
- [ ] `cloudCareRateTables`コレクション: `year`のインデックス（必要に応じて）
- [ ] `cloudPensionRateTables`コレクション: `year`のインデックス（必要に応じて）

**注意**: クエリの実装に応じて、必要に応じてインデックスを追加

---

## 🧪 テスト観点

### 機能テスト

1. **クラウドマスタの取得**
   - 健康保険料率マスタの取得（年度+都道府県コード指定）
   - 介護保険料率マスタの取得（年度指定）
   - 厚生年金保険料率マスタの取得（年度指定）
   - 存在しない年度・都道府県コードの場合のエラーハンドリング

2. **クラウドマスタの更新**
   - システム管理者（admin）による作成・更新・削除
   - 非adminユーザーによる更新の拒否（Firestoreルール）

3. **マスタフォームダイアログの自動初期値取得**
   - 新規作成時（健康保険）: 都道府県選択時に自動取得
   - 新規作成時（介護保険・厚生年金）: フォーム初期化時に自動取得
   - 編集時: 既存データを表示（自動取得しない）
   - 「プリセットを読み込む」ボタン: クラウドマスタから再取得

4. **フォールバック処理**
   - クラウドマスタが存在しない場合、`kyokai-presets.ts`のハードコードされたデータを使用

### セキュリティテスト

1. **Firestoreルール**
   - 非認証ユーザーはクラウドマスタを閲覧できない
   - 非adminユーザーはクラウドマスタを更新できない
   - adminユーザーはクラウドマスタを更新できる

2. **アクセス制御**
   - `/cloud-masters`ページはadmin専用
   - サイドメニューに表示されない（URLを知っている人だけアクセス可能）

### UXテスト

1. **新規作成時の自動初期値取得**
   - ユーザー操作なしで初期値が自動設定される
   - クラウドマスタ取得中のローディング表示（必要に応じて）

2. **編集時のプリセット読み込み**
   - 「プリセットを読み込む」ボタンでクラウドマスタから最新値を取得
   - 既存データが上書きされることを確認

---

## ✅ 完了条件

### 必須実装項目

- [ ] クラウドマスタの型定義（`CloudHealthRateTable`、`CloudCareRateTable`、`CloudPensionRateTable`）
- [ ] `CloudMasterService`の実装（取得・更新・削除メソッド）
- [ ] マスタフォームダイアログの拡張（新規作成時の自動初期値取得、編集時のプリセット読み込み）
- [ ] クラウドマスタ管理画面の実装（`/cloud-masters`ページ）
- [ ] クラウドマスタ編集ダイアログの実装（3種類）
- [ ] 全47都道府県分の健康保険料率データの追加（`kyokai-presets.ts`）
- [ ] Firestoreセキュリティルールの追加（`cloudHealthRateTables`、`cloudCareRateTables`、`cloudPensionRateTables`コレクション）
- [ ] ルーティングの追加（`/cloud-masters`）

### 動作確認項目

- [ ] `/cloud-masters`ページから手作業で2024年度・2025年度のデータを登録できる
- [ ] 新規マスタ作成時にクラウドマスタから自動的に初期値を取得できる
- [ ] 編集時に「プリセットを読み込む」ボタンでクラウドマスタから最新値を取得できる
- [ ] クラウドマスタが存在しない場合、フォールバック処理が動作する
- [ ] システム管理者がクラウドマスタを更新できる
- [ ] 非adminユーザーがクラウドマスタを更新できない（Firestoreルール）

---

## 📌 実装時の注意事項

### 1. 年度の概念について

- **年度は4月から3月までの期間を表す**: 例: 2024年度 = 2024年4月〜2025年3月
- **`year`フィールドは年度の開始年を表す**: 例: 2024年度なら`year: 2024`
- **保険料率の変更は年度が替わったときに起きる**: 年度ごとにデータを管理する必要がある
- **年度の判定**: 現在の日付から年度を判定する場合は、4月1日以降ならその年、3月31日以前なら前年を年度の開始年とする

**年度判定の実装例**:
```typescript
function getCurrentFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  // 4月以降ならその年、3月以前なら前年
  return month >= 4 ? year : year - 1;
}
```

### 2. クラウドマスタのID形式

- 健康保険料率マスタ: `{year}_{prefCode}`形式（例: `"2024_13"` = 2024年度の東京都）
- 介護保険料率マスタ: `{year}`形式（例: `"2024"` = 2024年度）
- 厚生年金保険料率マスタ: `{year}`形式（例: `"2024"` = 2024年度）

### 3. フォールバック処理

- クラウドマスタが存在しない場合、`kyokai-presets.ts`のハードコードされたデータを使用
- エラーハンドリング: `CloudMasterService`の取得メソッドが`null`を返した場合、フォールバック処理を実行
- `getKyokaiHealthRatePreset()`関数は年度に応じて適切なデータを選択（2025年度以降は`KYOKAI_HEALTH_RATES_2025`、それ以前は`KYOKAI_HEALTH_RATES_2024`）

### 4. 新規作成時の自動初期値取得

- 健康保険マスタ: プラン種別が`'kyokai'`で`kyokaiPrefCode`が設定されている場合のみ自動取得
- 組合健保（`'kumiai'`）の場合は自動取得しない（事業所ごとに異なるため）
- 介護保険・厚生年金マスタ: 常に自動取得

### 5. 編集時の動作

- 既存データをフォームに表示（クラウドマスタから自動取得しない）
- 「プリセットを読み込む」ボタンでクラウドマスタから最新値を取得（上書き）

### 6. クラウドマスタ管理画面のアクセス制御

- サイドメニューには表示しない（開発者専用の隠しページ）
- URLを知っている人だけアクセス可能
- `roleGuard(['admin'])`で保護

### 7. 都道府県別データの実装

- 全47都道府県分の健康保険料率データを`KYOKAI_HEALTH_RATES_2024`（令和6年度 = 2024年度）と`KYOKAI_HEALTH_RATES_2025`（令和7年度 = 2025年度）に追加済み
- パーセンテージ表記（例: 10.31%）を小数形式（例: 0.1031）に変換して保存
- `getKyokaiHealthRatePreset()`関数は年度に応じて適切なデータを選択

---

## 🔄 既存機能への影響

### 影響を受ける既存機能

1. **マスタフォームダイアログ**: 新規作成時の自動初期値取得機能を追加
2. **マスタフォームダイアログ**: 編集時の「プリセットを読み込む」ボタンの表示条件を変更

### 影響を受けない既存機能

1. **MastersService**: 既存のメソッドはそのまま維持（事業所ごとのマスタ管理）
2. **マスタ管理画面**: 既存の画面はそのまま維持
3. **保険料計算機能**: 既存の`getRatesForYearMonth()`メソッドはそのまま維持（事業所マスタを参照）

---

## 📚 参考資料

### 既存の実装パターン

- `DocumentsService`（`src/app/services/documents.service.ts`）: `removeUndefinedDeep()`メソッドの実装パターン
- `MastersService`（`src/app/services/masters.service.ts`）: マスタ管理サービスの実装パターン
- `health-master-form-dialog.component.ts`: マスタフォームダイアログの実装パターン

### 関連ファイル

- `src/app/types.ts`: 型定義
- `src/app/services/masters.service.ts`: 既存のマスタ管理サービス
- `src/app/pages/masters/`: 既存のマスタ管理画面・フォームダイアログ
- `src/app/utils/kyokai-presets.ts`: プリセットデータ
- `firestore.rules`: Firestoreセキュリティルール

---

以上でPhase3-11の実装指示書は完了です。実装時は、この指示書を参照しながら段階的に実装を進めてください。

