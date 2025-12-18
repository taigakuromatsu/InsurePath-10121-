# Phase3-6 実装指示書: 社会保険料納付状況管理機能

## 1. 概要

Phase3-6では、事業所ごと・対象年月ごとに、健康保険・介護保険・厚生年金それぞれの社会保険料について、「納付予定額」「実際の納付額」「納付日」「納付方法」「納付ステータス（未納／納付済／一部納付等）」を記録する機能を実装します。

納付予定額は、(8) 月次保険料一覧・会社負担集計機能 および (12) 賞与管理・賞与保険料計算機能で算出された会社負担額の合計値を初期値として自動設定し、人事・総務担当者が必要に応じて修正できます。納付完了後に、納付日および最終的な納付額を登録することで、その月の納付ステータスを更新できます。

ダッシュボード上で、「今月納付予定の社会保険料」「納付済み月／未納月の一覧」を確認できるようにし、納付漏れや金額確認漏れを防止します。

**重要**: 実際の金融機関への振込処理や会計仕訳の起票は対象外です。本システムは納付状況の記録・確認のみを担当します。

### Phase3-6のスコープ

Phase3-6では以下の機能を実装します：

- **納付状況レコードの手動登録・編集**: 管理者・担当者が対象年月ごとの納付状況を手動で登録・編集できる
- **納付予定額の自動設定**: 新規作成時に、月次保険料と賞与保険料の会社負担額合計を自動計算して初期値として設定
- **納付状況一覧表示**: 対象年月ごとの納付状況を一覧表示
- **ダッシュボード連携**: ダッシュボードに「今月納付予定の社会保険料」カードと「納付済み月／未納月の一覧」を追加

**今回の実装対象外**:

- **実際の金融機関への振込データ（全銀形式など）の生成**: 金融機関への振込データ生成機能は対象外
- **会計システムへの仕訳データ連携**: 会計システム連携機能は対象外
- **月次・賞与の金額変更に合わせた自動再計算・自動同期**: 予定額の自動再計算機能は対象外（手動修正を前提とする）
- **遅延利息・ペナルティの計算**: 遅延利息やペナルティの計算機能は対象外

---

## 2. 前提・ゴール

### 前提

- **型定義**: `SocialInsurancePayment`型は`src/app/types.ts`に未定義です。新規に定義します
- **既存サービス**: `MonthlyPremiumsService`、`BonusPremiumsService`が存在し、月次保険料・賞与保険料の会社負担額を取得できます
  - **注意**: `BonusPremiumsService`には現在、対象年月でフィルタするメソッドが存在しないため、Phase3-6の実装では`listByOfficeAndYearMonth(officeId: string, yearMonth: YearMonthString): Observable<BonusPremium[]>`メソッドを追加する必要があります
- **既存ページ**: 納付状況管理用のページは存在しません。新規に`src/app/pages/payments/payments.page.ts`を作成します
- **セキュリティルール**: `firestore.rules`に`payments`コレクションのルールは未定義です
- **リアルタイム購読パターン**: `ProceduresService`や`DependentsService`は`collectionData`を使用したリアルタイム購読パターンを使用しています。`PaymentsService.listByOffice()`もこのパターンに合わせます
- **ユーザー情報の取得**: 既存の「現在ログイン中のユーザー情報」を取得するサービス（`CurrentUserService`）が存在します
- **事業所情報の取得**: 既存の「現在の事業所情報」を取得するサービス（`CurrentOfficeService`）が存在し、`officeId$`プロパティで現在の事業所IDを取得できます

### ゴール

Phase3-6完了の判定基準：

1. ✅ **納付状況の型定義**（`src/app/types.ts`）が追加されていること
   - `SocialInsurancePayment`型の定義
   - `PaymentStatus`型（納付ステータス）の定義
   - `PaymentMethod`型（納付方法）の定義

2. ✅ **納付状況サービス**（`src/app/services/payments.service.ts`）が存在し、CRUD操作が実装されていること
   - 納付状況の作成（`create()`）- 新規作成時に予定額を自動計算
   - 納付状況の一覧取得（`listByOffice()`）- リアルタイム購読に対応
   - 納付状況の単一取得（`get()`）- 対象年月を指定して取得
   - 納付状況の更新（`update()`）
   - 予定額の自動計算ロジック（`calculatePlannedAmounts()`）- 月次・賞与の会社負担額合計を計算

3. ✅ **納付状況一覧画面**（`src/app/pages/payments/payments.page.ts`）が実装されていること
   - 納付状況一覧表示（テーブル形式、対象年月ごと）
   - 納付状況登録フォーム（ダイアログ）
   - 納付状況編集フォーム（ダイアログ）

4. ✅ **ダッシュボード連携**が実装されていること
   - 「今月納付予定の社会保険料」カードの追加
   - 「最近の納付状況（最大12件）」セクションの追加

5. ✅ **Firestoreセキュリティルール**が実装されていること
   - admin/hrは全納付状況を閲覧・作成・更新可能
   - employeeはアクセス不可
   - 金額フィールドは0以上（負の値は不可）
   - `paymentStatus === 'paid'`の場合は`paymentDate`と`actualTotalCompany`が必須

6. ✅ **既存機能が壊れていないこと**（月次保険料、賞与保険料、ダッシュボードなど）

---

## 3. 現状整理

### 3.1 既存の型定義

`src/app/types.ts`には以下の型が定義されていますが、納付状況関連の型は未定義です：

- `MonthlyPremium`型：月次保険料（`healthEmployer`、`careEmployer`、`pensionEmployer`フィールドを含む）
- `BonusPremium`型：賞与保険料（`healthEmployer`、`pensionEmployer`フィールドを含む）
- `IsoDateString`型：ISO日付文字列（`YYYY-MM-DD`形式のstringとして扱う）
- `YearMonthString`型：年月文字列（`YYYY-MM`形式のstringとして扱う）

### 3.2 既存のサービスパターン

`MonthlyPremiumsService`と`BonusPremiumsService`は以下のパターンを使用しています：

- `MonthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)`：指定年月の月次保険料一覧を取得
- `BonusPremiumsService.listByOfficeAndEmployee(officeId, employeeId?)`：事業所（＋任意で従業員）ごとの賞与支給履歴一覧を取得
- 会社負担額は`healthEmployer`、`careEmployer`、`pensionEmployer`フィールドに格納されている

**注意**: `BonusPremiumsService`には現在、対象年月でフィルタするメソッドが存在しません。Phase3-6の実装では、`BonusPremiumsService`に`listByOfficeAndYearMonth(officeId: string, yearMonth: YearMonthString): Observable<BonusPremium[]>`メソッドを追加する必要があります。このメソッドは、`payDate`フィールドが指定年月に含まれる賞与保険料を返すように実装してください。

### 3.3 既存のページパターン

既存のページ（`procedures.page.ts`、`requests.page.ts`など）は以下のパターンを使用しています：

- Angular Materialの`MatTableModule`を使用したテーブル表示
- `MatDialog`を使用したフォームダイアログ
- `combineLatest`を使用した複数Observableの結合
- `AsyncPipe`を使用したテンプレート内での購読

### 3.4 ダッシュボードの実装パターン

`dashboard.page.ts`は以下のパターンを使用しています：

- `MatCardModule`を使用したKPIカード表示
- `combineLatest`を使用した複数データソースの結合
- `signal`を使用したリアクティブな状態管理

---

## 4. 変更対象ファイル

### 4.1 新規作成ファイル

1. **`src/app/types.ts`**（型定義の追加）
   - `PaymentStatus`型の追加
   - `PaymentMethod`型の追加
   - `SocialInsurancePayment`型の追加

2. **`src/app/services/payments.service.ts`**（新規作成）
   - 納付状況のCRUD操作を提供するサービス
   - 予定額の自動計算ロジック

3. **`src/app/pages/payments/payments.page.ts`**（新規作成）
   - 納付状況一覧画面

4. **`src/app/pages/payments/payment-form-dialog.component.ts`**（新規作成）
   - 納付状況登録・編集フォームダイアログ

### 4.2 変更ファイル

1. **`src/app/services/bonus-premiums.service.ts`**
   - `listByOfficeAndYearMonth(officeId: string, yearMonth: YearMonthString): Observable<BonusPremium[]>`メソッドの追加
   - 指定年月（`YYYY-MM`形式）に含まれる賞与支給日（`payDate`）の賞与保険料をフィルタして返す
   - 実装例：
     ```typescript
     /**
      * 事業所・対象年月ごとの賞与支給履歴一覧
      */
     listByOfficeAndYearMonth(
       officeId: string,
       yearMonth: YearMonthString
     ): Observable<BonusPremium[]> {
       const ref = this.getCollectionRef(officeId);
       const targetYear = yearMonth.substring(0, 4);
       const targetMonth = yearMonth.substring(5, 7);
       
       // payDateは'YYYY-MM-DD'形式なので、年月部分でフィルタ
       // 注意: Firestoreのwhere句では文字列の範囲検索が可能だが、
       // より確実な方法として、全件取得後にクライアント側でフィルタする方法も可
       const q = query(ref, orderBy('payDate', 'desc'));
       
       return from(getDocs(q)).pipe(
         map((snapshot) =>
           snapshot.docs
             .map((d) => ({ id: d.id, ...(d.data() as any) } as BonusPremium))
             .filter((b) => {
               const payYear = b.payDate.substring(0, 4);
               const payMonth = b.payDate.substring(5, 7);
               return payYear === targetYear && payMonth === targetMonth;
             })
         )
       );
     }
     ```

2. **`src/app/app.routes.ts`**
   - `/payments`ルートの追加（admin/hr専用）

3. **`src/app/app.ts`**
   - サイドメニューに「社会保険料納付状況」メニュー項目を追加（admin/hr専用）

4. **`src/app/pages/dashboard/dashboard.page.ts`**
   - 「今月納付予定の社会保険料」カードの追加
   - 「最近の納付状況（最大12件）」セクションの追加

5. **`firestore.rules`**
   - `payments`コレクションのセキュリティルール追加

---

## 5. データモデル設計

### 5.1 Firestoreコレクション構造

**コレクションパス**: `offices/{officeId}/payments/{targetYearMonth}`

- **1ドキュメント** = 「ある事業所の、ある対象年月の社会保険料（健康保険・介護保険・厚生年金の会社負担分をまとめたもの）」
- **ドキュメントID** = `targetYearMonth`（`'YYYY-MM'`形式の文字列、例: `"2025-12"`）
- **実際の引き落とし月や振込月は考慮せず、「対象年月ベース」で管理する**（MVP）。金融機関側の実際の振替月の厳密な管理はスコープ外

### 5.2 TypeScript型定義

`src/app/types.ts`に以下の型を追加します：

```typescript
/**
 * 納付ステータス
 */
export type PaymentStatus =
  | 'unpaid'         // 未納（初期値）
  | 'paid'           // 納付済
  | 'partially_paid' // 一部納付
  | 'not_required';  // 納付不要（月次計上なし等・オプション）

/**
 * 納付方法
 */
export type PaymentMethod =
  | 'bank_transfer'    // 銀行振込
  | 'account_transfer'  // 口座振替
  | 'cash'             // 現金
  | 'other';           // その他

/**
 * 社会保険料納付状況
 */
export interface SocialInsurancePayment {
  id: string;              // Firestore docId（targetYearMonth と同一でもよい）
  officeId: string;        // パスから推測できるが、持っておいてもよい
  targetYearMonth: string; // 'YYYY-MM'

  // 予定額（会社負担）
  plannedHealthCompany: number;
  plannedCareCompany: number;
  plannedPensionCompany: number;
  plannedTotalCompany: number;  // 上3つの合計

  // 実績額（会社負担）
  actualHealthCompany: number | null;
  actualCareCompany: number | null;
  actualPensionCompany: number | null;
  actualTotalCompany: number | null;

  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  paymentMethodNote?: string | null;
  paymentDate: IsoDateString | null;  // 'YYYY-MM-DD'形式の文字列

  memo?: string | null;

  createdAt: IsoDateString;  // 'YYYY-MM-DD'形式の文字列
  createdByUserId: string;
  updatedAt: IsoDateString;  // 'YYYY-MM-DD'形式の文字列
  updatedByUserId: string;
}
```

**注意**: `IsoDateString`は`YYYY-MM-DD`形式の文字列として定義されています。`createdAt`、`updatedAt`、`paymentDate`はすべて`YYYY-MM-DD`形式で保存してください。日付の生成には`new Date().toISOString().slice(0, 10)`を使用してください。

---

## 6. サービス層の設計

### 6.1 PaymentsServiceの実装

`src/app/services/payments.service.ts`を新規作成し、以下のメソッドを実装します：

#### 6.1.1 コレクション参照の取得

```typescript
private getCollectionRef(officeId: string) {
  return collection(this.firestore, 'offices', officeId, 'payments');
}
```

#### 6.1.2 予定額の自動計算ロジック

```typescript
/**
 * 指定年月の予定額（会社負担額）を自動計算する
 * 
 * @param officeId - 事業所ID
 * @param targetYearMonth - 対象年月（'YYYY-MM'形式）
 * @returns 予定額オブジェクト
 */
async calculatePlannedAmounts(
  officeId: string,
  targetYearMonth: string
): Promise<{
  plannedHealthCompany: number;
  plannedCareCompany: number;
  plannedPensionCompany: number;
  plannedTotalCompany: number;
}> {
  // 1. 月次保険料の会社負担額を合計
  const monthlyPremiums = await firstValueFrom(
    this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, targetYearMonth)
  );
  
  const monthlyHealth = monthlyPremiums.reduce((sum, p) => sum + (p.healthEmployer ?? 0), 0);
  const monthlyCare = monthlyPremiums.reduce((sum, p) => sum + (p.careEmployer ?? 0), 0);
  const monthlyPension = monthlyPremiums.reduce((sum, p) => sum + (p.pensionEmployer ?? 0), 0);

  // 2. 賞与保険料の会社負担額を合計（対象年月の賞与支給日が含まれる賞与を対象）
  const bonusPremiums = await firstValueFrom(
    this.bonusPremiumsService.listByOfficeAndYearMonth(officeId, targetYearMonth)
  );
  
  const bonusHealth = bonusPremiums.reduce((sum, b) => sum + (b.healthEmployer ?? 0), 0);
  const bonusPension = bonusPremiums.reduce((sum, b) => sum + (b.pensionEmployer ?? 0), 0);

  // 3. 月次と賞与を合計
  const plannedHealthCompany = monthlyHealth + bonusHealth;
  const plannedCareCompany = monthlyCare;  // 賞与には介護保険料は含まれない
  const plannedPensionCompany = monthlyPension + bonusPension;
  const plannedTotalCompany = plannedHealthCompany + plannedCareCompany + plannedPensionCompany;

  return {
    plannedHealthCompany,
    plannedCareCompany,
    plannedPensionCompany,
    plannedTotalCompany
  };
}
```

#### 6.1.3 納付状況の作成

```typescript
/**
 * 納付状況を新規作成する
 * 
 * @param officeId - 事業所ID
 * @param dto - 作成データ（targetYearMonthは必須、予定額は自動計算される）
 * @param createdByUserId - 作成者ユーザーID
 * @returns 作成された納付状況のID
 */
async create(
  officeId: string,
  dto: {
    targetYearMonth: string;  // 'YYYY-MM'形式
    plannedHealthCompany?: number;  // 省略時は自動計算
    plannedCareCompany?: number;
    plannedPensionCompany?: number;
    plannedTotalCompany?: number;
    actualHealthCompany?: number | null;
    actualCareCompany?: number | null;
    actualPensionCompany?: number | null;
    actualTotalCompany?: number | null;
    paymentStatus?: PaymentStatus;  // デフォルト: 'unpaid'
    paymentMethod?: PaymentMethod | null;
    paymentMethodNote?: string | null;
    paymentDate?: IsoDateString | null;
    memo?: string | null;
  },
  createdByUserId: string
): Promise<string> {
  const collectionRef = this.getCollectionRef(officeId);
  const docId = dto.targetYearMonth;  // docId = targetYearMonth
  const docRef = doc(collectionRef, docId);
  const now = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

  // 予定額が4つすべて未指定の場合は自動計算
  const allPlannedMissing = 
    dto.plannedHealthCompany == null && 
    dto.plannedCareCompany == null && 
    dto.plannedPensionCompany == null && 
    dto.plannedTotalCompany == null;

  const plannedAmounts = allPlannedMissing
    ? await this.calculatePlannedAmounts(officeId, dto.targetYearMonth)
    : {
        plannedHealthCompany: dto.plannedHealthCompany ?? 0,
        plannedCareCompany: dto.plannedCareCompany ?? 0,
        plannedPensionCompany: dto.plannedPensionCompany ?? 0,
        plannedTotalCompany: dto.plannedTotalCompany ?? 0
      };

  const payload: SocialInsurancePayment = {
    id: docId,
    officeId,
    targetYearMonth: dto.targetYearMonth,
    ...plannedAmounts,
    actualHealthCompany: dto.actualHealthCompany ?? null,
    actualCareCompany: dto.actualCareCompany ?? null,
    actualPensionCompany: dto.actualPensionCompany ?? null,
    actualTotalCompany: dto.actualTotalCompany ?? null,
    paymentStatus: dto.paymentStatus ?? 'unpaid',
    paymentMethod: dto.paymentMethod ?? null,
    paymentMethodNote: dto.paymentMethodNote ?? null,
    paymentDate: dto.paymentDate ?? null,
    memo: dto.memo ?? null,
    createdAt: now,
    createdByUserId,
    updatedAt: now,
    updatedByUserId: createdByUserId
  };

  // setDocは既存ドキュメントが存在する場合は上書き（upsert）する
  await setDoc(docRef, payload);
  return docId;
}
```

#### 6.1.4 納付状況の一覧取得（リアルタイム購読）

```typescript
/**
 * 事業所ごとの納付状況一覧を取得（リアルタイム購読）
 * 
 * @param officeId - 事業所ID
 * @param limitCount - 取得件数の上限（省略時は全件）
 * @returns 納付状況の配列（Observable、targetYearMonth降順）
 */
listByOffice(officeId: string, limitCount?: number): Observable<SocialInsurancePayment[]> {
  const collectionRef = this.getCollectionRef(officeId);
  const constraints: QueryConstraint[] = [orderBy('targetYearMonth', 'desc')];
  
  if (limitCount != null) {
    constraints.push(limit(limitCount));
  }
  
  const q = query(collectionRef, ...constraints);
  
  return collectionData(q, { idField: 'id' }) as Observable<SocialInsurancePayment[]>;
}
```

**注意**: `QueryConstraint`と`limit`は`@angular/fire/firestore`からインポートしてください。既存の`ProceduresService`と同じパターンです。

#### 6.1.5 納付状況の単一取得

```typescript
/**
 * 指定年月の納付状況を取得する
 * 
 * @param officeId - 事業所ID
 * @param targetYearMonth - 対象年月（'YYYY-MM'形式）
 * @returns 納付状況（存在しない場合はundefined）
 */
get(officeId: string, targetYearMonth: string): Observable<SocialInsurancePayment | undefined> {
  const collectionRef = this.getCollectionRef(officeId);
  const docRef = doc(collectionRef, targetYearMonth);
  
  return from(getDoc(docRef)).pipe(
    map((snapshot) => {
      if (!snapshot.exists()) {
        return undefined;
      }
      return {
        id: snapshot.id,
        ...snapshot.data()
      } as SocialInsurancePayment;
    })
  );
}
```

#### 6.1.6 納付状況の更新

```typescript
/**
 * 納付状況を更新する
 * 
 * @param officeId - 事業所ID
 * @param targetYearMonth - 対象年月（'YYYY-MM'形式）
 * @param dto - 更新データ
 * @param updatedByUserId - 更新者ユーザーID
 */
async update(
  officeId: string,
  targetYearMonth: string,
  dto: {
    plannedHealthCompany?: number;
    plannedCareCompany?: number;
    plannedPensionCompany?: number;
    plannedTotalCompany?: number;
    actualHealthCompany?: number | null;
    actualCareCompany?: number | null;
    actualPensionCompany?: number | null;
    actualTotalCompany?: number | null;
    paymentStatus?: PaymentStatus;
    paymentMethod?: PaymentMethod | null;
    paymentMethodNote?: string | null;
    paymentDate?: IsoDateString | null;
    memo?: string | null;
  },
  updatedByUserId: string
): Promise<void> {
  const collectionRef = this.getCollectionRef(officeId);
  const docRef = doc(collectionRef, targetYearMonth);
  const now = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

  const updateData: Partial<SocialInsurancePayment> = {
    updatedAt: now,
    updatedByUserId
  };

  if (dto.plannedHealthCompany != null) updateData.plannedHealthCompany = dto.plannedHealthCompany;
  if (dto.plannedCareCompany != null) updateData.plannedCareCompany = dto.plannedCareCompany;
  if (dto.plannedPensionCompany != null) updateData.plannedPensionCompany = dto.plannedPensionCompany;
  if (dto.plannedTotalCompany != null) updateData.plannedTotalCompany = dto.plannedTotalCompany;
  if (dto.actualHealthCompany !== undefined) updateData.actualHealthCompany = dto.actualHealthCompany;
  if (dto.actualCareCompany !== undefined) updateData.actualCareCompany = dto.actualCareCompany;
  if (dto.actualPensionCompany !== undefined) updateData.actualPensionCompany = dto.actualPensionCompany;
  if (dto.actualTotalCompany !== undefined) updateData.actualTotalCompany = dto.actualTotalCompany;
  if (dto.paymentStatus != null) updateData.paymentStatus = dto.paymentStatus;
  if (dto.paymentMethod !== undefined) updateData.paymentMethod = dto.paymentMethod;
  if (dto.paymentMethodNote !== undefined) updateData.paymentMethodNote = dto.paymentMethodNote;
  if (dto.paymentDate !== undefined) updateData.paymentDate = dto.paymentDate;
  if (dto.memo !== undefined) updateData.memo = dto.memo;

  await updateDoc(docRef, updateData);
}
```

---

## 7. 画面設計

### 7.1 納付状況一覧画面（`/payments`）

**アクセス権限**: admin/hr専用（employeeロールはアクセス不可）

**画面構成**:

1. **ヘッダーセクション**
   - タイトル：「社会保険料納付状況」
   - 説明文：「事業所ごと・対象年月ごとの社会保険料の納付状況を管理できます」

2. **アクションボタン**
   - **納付状況を登録**ボタン（`mat-flat-button`、`color="primary"`）
     - クリックで納付状況登録ダイアログを開く

3. **納付状況一覧テーブル**（`mat-table`）
   - **列構成**:
     - **対象年月**（`targetYearMonth`、`YYYY-MM`形式）
     - **予定合計金額**（`plannedTotalCompany`、`¥`記号付き、カンマ区切り）
     - **実績合計金額**（`actualTotalCompany`、`¥`記号付き、カンマ区切り、nullの場合は「未入力」）
     - **ステータス**（`paymentStatus`、バッジ表示）
       - `unpaid`：未納（赤色）
       - `paid`：納付済（緑色）
       - `partially_paid`：一部納付（黄色）
       - `not_required`：納付不要（グレー）
     - **納付日**（`paymentDate`、`YYYY-MM-DD`形式、nullの場合は「未入力」）
     - **納付方法**（`paymentMethod`、日本語ラベル表示）
       - `bank_transfer`：銀行振込
       - `account_transfer`：口座振替
       - `cash`：現金
       - `other`：その他（`paymentMethodNote`も表示）
     - **アクション**（編集ボタン）

4. **空状態表示**
   - 納付状況が0件の場合：「納付状況が登録されていません」

### 7.2 納付状況登録・編集フォームダイアログ

**フォーム項目**:

- **対象年月**（`<input matInput type="month">`、必須、編集時は読み取り専用）
  - フォーム値は`YYYY-MM`形式のstring
- **予定額セクション**（各保険の予定額を個別に入力可能）
  - **健康保険（会社負担）**（`<input matInput type="number">`、必須、0以上）
  - **介護保険（会社負担）**（`<input matInput type="number">`、必須、0以上）
  - **厚生年金（会社負担）**（`<input matInput type="number">`、必須、0以上）
  - **予定合計**（自動計算、読み取り専用）
  - **予定額を自動計算**ボタン（新規作成時のみ表示）
    - クリックで`PaymentsService.calculatePlannedAmounts()`を呼び出し、予定額フィールドに自動入力
- **実績額セクション**（各保険の実績額を個別に入力可能）
  - **健康保険（会社負担）**（`<input matInput type="number">`、任意、0以上）
  - **介護保険（会社負担）**（`<input matInput type="number">`、任意、0以上）
  - **厚生年金（会社負担）**（`<input matInput type="number">`、任意、0以上）
  - **実績合計**（自動計算、読み取り専用）
- **納付ステータス**（`mat-select`、必須）
  - 選択肢：
    - `unpaid`：未納
    - `paid`：納付済
    - `partially_paid`：一部納付
    - `not_required`：納付不要
- **納付方法**（`mat-select`、任意）
  - 選択肢：
    - `bank_transfer`：銀行振込
    - `account_transfer`：口座振替
    - `cash`：現金
    - `other`：その他
- **納付方法の詳細**（`<textarea matInput>`、任意、納付方法が「その他」の場合に推奨）
- **納付日**（`<input matInput type="date">`、任意、納付ステータスが`paid`の場合は必須）
  - フォーム値は`YYYY-MM-DD`形式のstring（`IsoDateString`型）
  - HTMLの`<input type="date">`は`YYYY-MM-DD`形式のstringを返すため、そのまま`IsoDateString`として保存できます
- **備考**（`<textarea matInput>`、任意）

**バリデーション**:

- 納付ステータスが`paid`の場合、`paymentDate`と`actualTotalCompany`が必須
- 金額フィールドは0以上（負の値は不可）
- 予定額の合計と個別フィールドの合計が一致すること（クライアント側でチェック）

**フォーム送信**:

- 新規作成時：`PaymentsService.create()`を呼び出す
- 編集時：`PaymentsService.update()`を呼び出す

---

## 8. ダッシュボード連携

### 8.1 「今月納付予定の社会保険料」カード

`dashboard.page.ts`に以下のカードを追加します：

**表示内容**:
- **タイトル**: 「今月納付予定の社会保険料」
- **金額**: 現在年月に対応する`targetYearMonth`の`SocialInsurancePayment`ドキュメントの`plannedTotalCompany`を表示
- **ドキュメントが存在しない場合**: 「未登録」と表示

**実装方針**:
- `PaymentsService.get()`を使用して現在年月の納付状況を取得
- `combineLatest`を使用して`officeId$`と`currentYearMonth`を結合
- `signal`または`Observable`を使用してリアクティブに更新

**コード例（参考）**:

```typescript
// dashboard.page.ts に追加

private readonly paymentsService = inject(PaymentsService);
private readonly currentOffice = inject(CurrentOfficeService);

readonly currentPayment$ = this.currentOffice.officeId$.pipe(
  switchMap((officeId) => {
    if (!officeId) {
      return of(null);
    }
    // 現在年月を組み立て
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}-${month}`;
    
    return this.paymentsService.get(officeId, yearMonth).pipe(
      catchError(() => of(null))
    );
  })
);
```

**テンプレート例（参考）**:

```html
<mat-card class="stat-card">
  <div class="stat-icon" style="background: #fff3e0;">
    <mat-icon style="color: #e65100;">account_balance</mat-icon>
  </div>
  <div class="stat-content">
    <h3>今月納付予定の社会保険料</h3>
    <p class="stat-value">
      <ng-container *ngIf="currentPayment$ | async as payment; else notRegistered">
        <ng-container *ngIf="payment; else notRegistered">
          ¥{{ payment.plannedTotalCompany | number }}
        </ng-container>
        <ng-template #notRegistered>未登録</ng-template>
      </ng-container>
    </p>
    <p class="stat-label">会社負担額（予定）</p>
  </div>
</mat-card>
```

### 8.2 「納付済み月／未納月の一覧（直近12ヶ月）」セクション

`dashboard.page.ts`に以下のセクションを追加します：

**表示内容**:
- **タイトル**: 「最近の納付状況（最大12件）」
- **一覧表示**: 記録が存在する月のうち、新しい順に最大12件の納付状況をリストまたはテーブル形式で表示
  - **対象年月**（`targetYearMonth`）
  - **ステータス**（`paymentStatus`、バッジ表示）
    - `paid`：納付済み（緑色）
    - `unpaid`：未納（赤色）
    - `partially_paid`：一部納付（黄色）
    - `not_required`：納付不要（グレー、または除外）
  - **予定額**（`plannedTotalCompany`）
  - **実績額**（`actualTotalCompany`、nullの場合は「未入力」）
- **詳細画面へのリンク**: 各項目をクリックすると`/payments`画面に遷移（またはダイアログで詳細表示）

**実装方針**:
- `PaymentsService.listByOffice(officeId, 12)`を使用して納付状況一覧を取得（`limit(12)`をクエリ側で適用）
- `targetYearMonth`降順でソート（既にサービス側で実装済み）
- **注意**: 「直近12ヶ月」という表現は避け、「最近の納付状況（最大12件）」など、記録が存在する月のうち新しい順に最大12件を表示することを明示するラベルを使用してください

**コード例（参考）**:

```typescript
// dashboard.page.ts に追加

private readonly paymentsService = inject(PaymentsService);
private readonly currentOffice = inject(CurrentOfficeService);

readonly recentPayments$ = this.currentOffice.officeId$.pipe(
  switchMap((officeId) => {
    if (!officeId) {
      return of([]);
    }
    // limit(12)をクエリ側で適用
    return this.paymentsService.listByOffice(officeId, 12);
  })
);
```

**テンプレート例（参考）**:

```html
<mat-card class="info-card">
  <h3>
    <mat-icon>account_balance</mat-icon>
    最近の納付状況（最大12件）
  </h3>
  <div class="payment-list" *ngIf="recentPayments$ | async as payments">
    <div *ngIf="payments.length === 0" class="empty-state">
      納付状況が登録されていません
    </div>
    <table mat-table [dataSource]="payments" *ngIf="payments.length > 0">
      <ng-container matColumnDef="targetYearMonth">
        <th mat-header-cell *matHeaderCellDef>対象年月</th>
        <td mat-cell *matCellDef="let payment">{{ payment.targetYearMonth }}</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>ステータス</th>
        <td mat-cell *matCellDef="let payment">
          <span [class]="'status-badge status-' + payment.paymentStatus">
            {{ getPaymentStatusLabel(payment.paymentStatus) }}
          </span>
        </td>
      </ng-container>
      <ng-container matColumnDef="plannedTotal">
        <th mat-header-cell *matHeaderCellDef>予定額</th>
        <td mat-cell *matCellDef="let payment">¥{{ payment.plannedTotalCompany | number }}</td>
      </ng-container>
      <ng-container matColumnDef="actualTotal">
        <th mat-header-cell *matHeaderCellDef>実績額</th>
        <td mat-cell *matCellDef="let payment">
          <ng-container *ngIf="payment.actualTotalCompany != null; else notInput">
            ¥{{ payment.actualTotalCompany | number }}
          </ng-container>
          <ng-template #notInput>未入力</ng-template>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="['targetYearMonth', 'status', 'plannedTotal', 'actualTotal']"></tr>
      <tr mat-row *matRowDef="let row; columns: ['targetYearMonth', 'status', 'plannedTotal', 'actualTotal']"
          [routerLink]="['/payments']"
          style="cursor: pointer;"></tr>
    </table>
  </div>
</mat-card>
```

---

## 9. ルーティングとメニュー

### 9.1 ルーティング設定

`src/app/app.routes.ts`に以下のルートを追加します：

```typescript
{
  path: 'payments',
  canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
  loadComponent: () => import('./pages/payments/payments.page').then((m) => m.PaymentsPage)
}
```

### 9.2 サイドメニュー追加

`src/app/app.ts`の`navLinks`配列に以下の項目を追加します：

```typescript
{ label: '社会保険料納付状況', path: '/payments', icon: 'account_balance', roles: ['admin', 'hr'] }
```

**推奨配置位置**: 「賞与保険料」の直後、または「マスタ管理」の直前

---

## 10. Firestoreセキュリティルール

`firestore.rules`の`match /offices/{officeId}`ブロック内に、以下のルールを追加します：

```javascript
// 社会保険料納付状況
match /payments/{paymentId} {
  // 共通バリデーション: SocialInsurancePayment の基本フィールド
  function isValidSocialInsurancePaymentBase(data) {
    return data.id == paymentId
      && data.officeId == officeId
      && data.targetYearMonth is string
      && data.plannedHealthCompany is int && data.plannedHealthCompany >= 0
      && data.plannedCareCompany is int && data.plannedCareCompany >= 0
      && data.plannedPensionCompany is int && data.plannedPensionCompany >= 0
      && data.plannedTotalCompany is int && data.plannedTotalCompany >= 0
      && data.paymentStatus in ['unpaid', 'paid', 'partially_paid', 'not_required']
      && (!('paymentMethod' in data) || data.paymentMethod == null || data.paymentMethod in ['bank_transfer', 'account_transfer', 'cash', 'other'])
      && (!('paymentMethodNote' in data) || data.paymentMethodNote == null || data.paymentMethodNote is string)
      && (!('paymentDate' in data) || data.paymentDate == null || data.paymentDate is string)
      && (!('memo' in data) || data.memo == null || data.memo is string)
      && data.createdAt is string
      && data.updatedAt is string
      && data.createdByUserId is string
      && data.updatedByUserId is string;
  }

  // 納付ステータスが'paid'の場合の整合性チェック
  function isValidPaidStatus(data) {
    return data.paymentStatus != 'paid' || (
      data.paymentDate != null
      && data.paymentDate is string
      && data.actualTotalCompany != null
      && data.actualTotalCompany is int
      && data.actualTotalCompany >= 0
    );
  }

  // 金額フィールドの整合性チェック（実績額がnullでない場合）
  function isValidAmountFields(data) {
    return (
      (!('actualHealthCompany' in data) || data.actualHealthCompany == null || (data.actualHealthCompany is int && data.actualHealthCompany >= 0))
      && (!('actualCareCompany' in data) || data.actualCareCompany == null || (data.actualCareCompany is int && data.actualCareCompany >= 0))
      && (!('actualPensionCompany' in data) || data.actualPensionCompany == null || (data.actualPensionCompany is int && data.actualPensionCompany >= 0))
      && (!('actualTotalCompany' in data) || data.actualTotalCompany == null || (data.actualTotalCompany is int && data.actualTotalCompany >= 0))
    );
  }

  // 閲覧: admin/hr のみ
  allow read: if belongsToOffice(officeId) && isAdminOrHr(officeId);

  // 作成: admin/hr のみ、フィールドと officeId / userId を厳密チェック
  allow create: if belongsToOffice(officeId)
    && isAdminOrHr(officeId)
    && request.resource.data.keys().hasOnly([
      'id', 'officeId', 'targetYearMonth',
      'plannedHealthCompany', 'plannedCareCompany', 'plannedPensionCompany', 'plannedTotalCompany',
      'actualHealthCompany', 'actualCareCompany', 'actualPensionCompany', 'actualTotalCompany',
      'paymentStatus', 'paymentMethod', 'paymentMethodNote', 'paymentDate',
      'memo', 'createdAt', 'updatedAt', 'createdByUserId', 'updatedByUserId'
    ])
    && isValidSocialInsurancePaymentBase(request.resource.data)
    && isValidAmountFields(request.resource.data)
    && isValidPaidStatus(request.resource.data)
    && request.resource.data.createdByUserId == request.auth.uid
    && request.resource.data.updatedByUserId == request.auth.uid;

  // 更新: admin/hr のみ、変更可能なフィールドを限定
  allow update: if belongsToOffice(officeId)
    && isAdminOrHr(officeId)
    && isValidSocialInsurancePaymentBase(request.resource.data)
    && isValidAmountFields(request.resource.data)
    && isValidPaidStatus(request.resource.data)
    // id / officeId / createdAt / createdByUserId は更新不可
    && request.resource.data.id == resource.data.id
    && request.resource.data.officeId == resource.data.officeId
    && request.resource.data.createdAt == resource.data.createdAt
    && request.resource.data.createdByUserId == resource.data.createdByUserId
    && request.resource.data.updatedByUserId == request.auth.uid;

  // 削除: admin/hr のみ（必要に応じて実装、今回はスコープ外でも可）
  allow delete: if belongsToOffice(officeId) && isAdminOrHr(officeId);
}
```

---

## 11. テスト観点・確認項目

### 11.1 新規作成時の予定額自動セットの確認

1. **月次保険料のみ存在する場合**
   - 対象年月に月次保険料が存在し、賞与保険料が存在しない場合
   - 予定額が月次保険料の会社負担額合計と一致することを確認

2. **賞与保険料のみ存在する場合**
   - 対象年月に賞与保険料が存在し、月次保険料が存在しない場合
   - 予定額が賞与保険料の会社負担額合計と一致することを確認

3. **月次保険料と賞与保険料の両方が存在する場合**
   - 対象年月に月次保険料と賞与保険料の両方が存在する場合
   - 予定額が両方の会社負担額合計と一致することを確認

4. **月次保険料も賞与保険料も存在しない場合**
   - 対象年月に月次保険料も賞与保険料も存在しない場合
   - 予定額が0になることを確認

### 11.2 ステータスと金額整合性の確認

1. **納付ステータスが`paid`の場合**
   - `paymentDate`が必須であることを確認（Firestoreルールでチェック）
   - `actualTotalCompany`が必須であることを確認（Firestoreルールでチェック）
   - フォーム側でもバリデーションが機能することを確認

2. **納付ステータスが`unpaid`の場合**
   - `paymentDate`と`actualTotalCompany`がnullでも問題ないことを確認

3. **金額フィールドのバリデーション**
   - 負の値を入力できないことを確認（Firestoreルールとフォーム側の両方でチェック）

### 11.3 権限制御の確認

1. **admin/hrロール**
   - 納付状況一覧画面にアクセスできることを確認
   - 納付状況の作成・編集ができることを確認

2. **employeeロール**
   - 納付状況一覧画面にアクセスできないことを確認（`/payments`にアクセスするとリダイレクトされる）
   - ダッシュボードの納付状況セクションが表示されないことを確認（または表示されても編集不可）

### 11.4 ダッシュボード連携の確認

1. **「今月納付予定の社会保険料」カード**
   - 現在年月の納付状況が存在する場合、予定額が正しく表示されることを確認
   - 現在年月の納付状況が存在しない場合、「未登録」と表示されることを確認

2. **「最近の納付状況（最大12件）」セクション**
   - 記録が存在する月のうち、新しい順に最大12件の納付状況が正しく表示されることを確認
   - ステータスバッジが正しく表示されることを確認
   - 各項目をクリックすると`/payments`画面に遷移することを確認

### 11.5 その他の確認項目

1. **対象年月の重複作成時の挙動**
   - 同じ`targetYearMonth`で2回目に作成を試みた場合は、新規作成ではなく既存レコードの上書きとして扱われることを確認（`setDoc`によるidempotentなupsert挙動）

2. **予定額の手動修正**
   - 予定額を手動で修正できることを確認
   - 予定額の合計と個別フィールドの合計が一致しない場合のエラーハンドリングを確認

3. **実績額の入力**
   - 実績額を個別に入力できることを確認
   - 実績額の合計が自動計算されることを確認

---

## 12. 実装上の注意事項

### 12.1 予定額の自動計算タイミング

- **新規作成時のみ自動計算**: `PaymentsService.create()`で予定額が省略されている場合のみ自動計算を実行
- **更新時は自動計算しない**: `PaymentsService.update()`では予定額の自動再計算は行わない（手動修正を前提とする）
- **「予定額を自動計算」ボタン**: フォーム側で「予定額を自動計算」ボタンを実装し、ユーザーが明示的に再計算を実行できるようにする

### 12.2 賞与保険料の対象年月判定

- **賞与保険料の対象年月**: `BonusPremium.payDate`は`'YYYY-MM-DD'`形式なので、`targetYearMonth`（`'YYYY-MM'`形式）と一致するかどうかを判定する際は、年月部分のみを比較する

### 12.3 日付フィールドの型統一

- **`IsoDateString`の形式**: `IsoDateString`は`YYYY-MM-DD`形式の文字列として定義されています
- **`createdAt` / `updatedAt`の生成**: `new Date().toISOString().slice(0, 10)`を使用して`YYYY-MM-DD`形式の文字列を生成してください
- **`paymentDate`の型**: `paymentDate`も`IsoDateString`（`YYYY-MM-DD`形式）として保存してください
- **フォーム側の扱い**: HTMLの`<input type="date">`は`YYYY-MM-DD`形式のstringを返すため、そのまま`IsoDateString`として保存できます

### 12.4 エラーハンドリング

- **予定額の自動計算エラー**: `calculatePlannedAmounts()`でエラーが発生した場合（例：マスタ未設定）、適切なエラーメッセージを表示する
- **Firestoreエラー**: 権限エラーやバリデーションエラーが発生した場合、ユーザーに分かりやすいエラーメッセージを表示する

### 12.5 パフォーマンス

- **リアルタイム購読**: `listByOffice()`は`collectionData`を使用したリアルタイム購読を実装するが、大量のデータが存在する場合は`limit()`パラメータを指定して取得件数を制限する
- **ダッシュボードのパフォーマンス**: ダッシュボードに追加するセクションは、`listByOffice(officeId, 12)`のように`limit(12)`をクエリ側で適用して、必要最小限のデータのみを取得する

---

## 13. スコープ外事項の明記

Phase3-6では以下の機能は実装対象外です：

1. **実際の金融機関への振込データ（全銀形式など）の生成**
   - 金融機関への振込データ生成機能は対象外です

2. **会計システムへの仕訳データ連携**
   - 会計システム連携機能は対象外です

3. **月次・賞与の金額変更に合わせた自動再計算・自動同期**
   - 予定額の自動再計算機能は対象外です（手動修正を前提とする）
   - 「予定額を自動計算」ボタンによる明示的な再計算は実装します

4. **遅延利息・ペナルティの計算**
   - 遅延利息やペナルティの計算機能は対象外です

5. **納付状況の削除機能**
   - 納付状況の削除機能はFirestoreルールには含めていますが、UI側での実装は任意です（必要に応じて実装してください）

---

以上でPhase3-6の実装指示書は完了です。実装時は、既存のコードパターンに合わせて実装を進めてください。

