# P1-4 指示書（改訂版）

**サブテーマ**: 標準報酬月額ベースの「月次保険料ドキュメント作成＆一括計算実行」機能（サービス＋簡易UI）

---

## 0. ゴール・位置づけ

P1-3 で実装した `calculateMonthlyPremiumForEmployee` を活用して：

- ある事業所・ある年月 (`yearMonth`) を指定
- 健康保険／介護保険／厚生年金の「合計料率」を入力
- 対象事業所の **全「社会保険加入」従業員** について月次保険料を一括計算
- 結果を Firestore の `MonthlyPremium` ドキュメント群として保存する

さらに、同じ画面で：
- 計算・保存した結果をテーブルで一覧表示
- 本人負担／会社負担を **1 円単位**で確認できる

**ここではまだ「保険料率マスタ（協会けんぽPDFの取り込み）」はやらず、料率は画面から直接入力する簡易版とする。**

---

## 1. 前提・現状確認

### 1-1. 既存実装の確認

- ✅ `premium-calculator.ts` の `calculateMonthlyPremiumForEmployee` は実装済み
- ✅ `MonthlyPremium` 型は `types.ts` に定義済み
- ✅ `EmployeesService.list()` で従業員一覧を取得可能
- ✅ `CurrentOfficeService.officeId$` で事業所IDを取得可能
- ⚠️ `CurrentUserService` には `userId$` がないため、`Auth.currentUser` を直接使用する必要がある

### 1-2. 注意事項

- `premium-calculator.ts` の `roundToYen` 関数は **1円未満切り捨て** を実装している（10円未満切り捨てではない）
- `careTotal` などは `MonthlyPremium` 型で `?` が付いているため、0 の場合は `undefined` でも `0` でも可
- Firestore の `where` クエリを使用する場合は、インデックスの設定が必要になる可能性がある

---

## 2. 対象ファイル

### 既存ファイル（編集）

- `src/app/pages/premiums/monthly/monthly-premiums.page.ts`
  → プレースホルダ状態のページを、実際にフォーム（年月＋料率入力）、一括計算＆保存ボタン、結果一覧テーブルを持つページに作り込む。

- `src/app/utils/premium-calculator.ts`
  → 既に実装済みの `calculateMonthlyPremiumForEmployee` / 型をそのまま利用。（ロジック修正は不要。必要ならコメントの微調整程度）

- `src/app/types.ts`
  → `MonthlyPremium` 型は既にある前提。フィールド追加が必要な場合のみ編集（基本は変更なし）。

### 新規作成ファイル

- `src/app/services/monthly-premiums.service.ts`
  → 月次保険料ドキュメントの計算結果 → `MonthlyPremium` への変換、Firestore への保存、指定年月の一覧取得などを担当するサービス。

**※ ルーティングやメニューは既に `MonthlyPremiums` ページが存在していれば変更不要。無ければ最小限でルートを追加する程度に留める。**

---

## 3. Firestore モデル・コレクション構造

### コレクション構造（新規）

**パス**: `offices/{officeId}/monthlyPremiums/{docId}`

**docId のルール**:
```
docId = employeeId + '_' + yearMonth
例）abc123_2025-04
```

これにより、同じ従業員・同じ年月は常に **1 ドキュメント** になる（再計算時は上書き）。

### ドキュメント内容

ドキュメント内容は `types.ts` の `MonthlyPremium` に準拠：

#### 基本情報
- `id`: docId をセット
- `officeId`: 引数の `officeId`
- `employeeId`: 対象従業員の `id`
- `yearMonth`: フォームで指定された年月

#### 等級・標準報酬（スナップショット）
- `healthGrade`: `employee.healthGrade`（`!` で確定）
- `healthStandardMonthly`: `employee.healthStandardMonthly`
- `healthGradeSource?`: 必要なら `employee.healthGradeSource` をそのままコピー
- `pensionGrade`: `employee.pensionGrade`
- `pensionStandardMonthly`: `employee.pensionStandardMonthly`
- `pensionGradeSource?`: 同様にコピー

#### 金額系
- `healthTotal` / `healthEmployee` / `healthEmployer`
- `careTotal?` / `careEmployee?` / `careEmployer?`（対象外の場合は `0` または `undefined`）
- `pensionTotal` / `pensionEmployee` / `pensionEmployer`
- `totalEmployee` / `totalEmployer`

→ すべて `calculateMonthlyPremiumForEmployee` の結果からコピー

#### メタ情報
- `calculatedAt`: `rateContext.calcDate`（`new Date().toISOString()`）
- `calculatedByUserId?`: 現在ログイン中ユーザーの `uid`

---

## 4. MonthlyPremiumsService の仕様

**ファイル**: `src/app/services/monthly-premiums.service.ts`

```typescript
import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDocs, query, setDoc, where } from '@angular/fire/firestore';
import { from, map, Observable } from 'rxjs';
import { Employee, IsoDateString, MonthlyPremium, YearMonthString } from '../types';
import {
  calculateMonthlyPremiumForEmployee,
  MonthlyPremiumCalculationResult,
  PremiumRateContext
} from '../utils/premium-calculator';

@Injectable({ providedIn: 'root' })
export class MonthlyPremiumsService {
  constructor(private readonly firestore: Firestore) {}
}
```

### 4-1. 内部ヘルパー

#### `private getCollectionRef(officeId: string)`

```typescript
private getCollectionRef(officeId: string) {
  return collection(this.firestore, 'offices', officeId, 'monthlyPremiums');
}
```

#### `private buildDocId(employeeId: string, yearMonth: YearMonthString): string`

```typescript
private buildDocId(employeeId: string, yearMonth: YearMonthString): string {
  return `${employeeId}_${yearMonth}`;
}
```

#### `private fromCalculationResult(...): MonthlyPremium`

```typescript
/**
 * 計算結果を MonthlyPremium ドキュメントに変換する
 * 
 * @param employee - 従業員情報（等級ソース等を取得するため）
 * @param result - 計算結果
 * @param calcDate - 計算実行日時
 * @param calculatedByUserId - 計算実行ユーザーID
 * @returns MonthlyPremium オブジェクト
 */
private fromCalculationResult(
  employee: Employee,
  result: MonthlyPremiumCalculationResult,
  calcDate: IsoDateString,
  calculatedByUserId: string
): MonthlyPremium {
  const docId = this.buildDocId(result.employeeId, result.yearMonth);
  
  return {
    id: docId,
    officeId: result.officeId,
    employeeId: result.employeeId,
    yearMonth: result.yearMonth,
    
    // 等級・標準報酬のスナップショット
    healthGrade: result.healthGrade,
    healthStandardMonthly: result.healthStandardMonthly,
    healthGradeSource: employee.healthGradeSource,
    
    pensionGrade: result.pensionGrade,
    pensionStandardMonthly: result.pensionStandardMonthly,
    pensionGradeSource: employee.pensionGradeSource,
    
    // 金額
    healthTotal: result.amounts.healthTotal,
    healthEmployee: result.amounts.healthEmployee,
    healthEmployer: result.amounts.healthEmployer,
    
    // 介護保険（0 の場合は undefined でも可、ただし 0 を明示的に保存する方が分かりやすい）
    careTotal: result.amounts.careTotal > 0 ? result.amounts.careTotal : undefined,
    careEmployee: result.amounts.careTotal > 0 ? result.amounts.careEmployee : undefined,
    careEmployer: result.amounts.careTotal > 0 ? result.amounts.careEmployer : undefined,
    
    pensionTotal: result.amounts.pensionTotal,
    pensionEmployee: result.amounts.pensionEmployee,
    pensionEmployer: result.amounts.pensionEmployer,
    
    totalEmployee: result.amounts.totalEmployee,
    totalEmployer: result.amounts.totalEmployer,
    
    // メタ情報
    calculatedAt: calcDate,
    calculatedByUserId,
  };
}
```

### 4-2. 公開メソッド

#### `async saveForMonth(options): Promise<MonthlyPremium[]>`

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

/**
 * 指定年月の月次保険料を一括計算・保存する
 * 
 * @param options - 計算・保存オプション
 * @returns 保存した MonthlyPremium の配列
 * 
 * 処理内容:
 * 1. PremiumRateContext を組み立てる
 * 2. employees をループし、calculateMonthlyPremiumForEmployee を呼び出し
 * 3. 戻り値が null の従業員（未加入・標準報酬未設定など）はスキップ
 * 4. fromCalculationResult で MonthlyPremium を組み立て
 * 5. 各 MonthlyPremium について setDoc で保存（再実行時は上書き）
 * 6. 保存した MonthlyPremium[] を返す
 * 
 * 注意:
 * - 計算できない従業員はスキップされる（エラーにはならない）
 * - 同じ従業員・同じ年月の再計算時は上書きされる
 * - バッチ書き込みは Promise.all を使用（writeBatch でも可）
 */
async saveForMonth(options: SaveForMonthOptions): Promise<MonthlyPremium[]> {
  const { officeId, yearMonth, calcDate, healthRate, careRate, pensionRate, employees, calculatedByUserId } = options;
  
  // PremiumRateContext を組み立て
  const rateContext: PremiumRateContext = {
    yearMonth,
    calcDate,
    healthRate,
    careRate,
    pensionRate,
  };
  
  // 計算結果を格納する配列
  const premiumsToSave: MonthlyPremium[] = [];
  
  // 各従業員について計算
  for (const employee of employees) {
    // 計算実行
    const result = calculateMonthlyPremiumForEmployee(employee, rateContext);
    
    // null の場合はスキップ（未加入・標準報酬未設定など）
    if (!result) {
      continue;
    }
    
    // MonthlyPremium に変換
    const monthlyPremium = this.fromCalculationResult(
      employee,
      result,
      calcDate,
      calculatedByUserId
    );
    
    premiumsToSave.push(monthlyPremium);
  }
  
  // Firestore に保存（Promise.all で並列実行）
  const collectionRef = this.getCollectionRef(officeId);
  await Promise.all(
    premiumsToSave.map((premium) => {
      const docRef = doc(collectionRef, premium.id);
      return setDoc(docRef, premium, { merge: true });
    })
  );
  
  return premiumsToSave;
}
```

#### `listByOfficeAndYearMonth(officeId: string, yearMonth: YearMonthString): Observable<MonthlyPremium[]>`

```typescript
/**
 * 指定事業所・指定年月の月次保険料一覧を取得する
 * 
 * @param officeId - 事業所ID
 * @param yearMonth - 対象年月（YYYY-MM形式）
 * @returns MonthlyPremium の配列（Observable）
 * 
 * 注意:
 * - Firestore の where クエリを使用
 * - インデックスが必要な場合はエラーメッセージに従って設定する必要がある
 */
listByOfficeAndYearMonth(
  officeId: string,
  yearMonth: YearMonthString
): Observable<MonthlyPremium[]> {
  const collectionRef = this.getCollectionRef(officeId);
  const q = query(collectionRef, where('yearMonth', '==', yearMonth));
  
  return from(getDocs(q)).pipe(
    map((snapshot) =>
      snapshot.docs.map(
        (d) =>
          ({
            id: d.id,
            ...(d.data() as any)
          } as MonthlyPremium)
      )
    )
  );
}
```

---

## 5. monthly-premiums.page.ts の仕様

### 目的

事業所単位・年月単位で、保険料率を入力 → 月次保険料を一括計算 → Firestore に保存 → その結果を画面に表示する。

### 5-1. 依存関係（DI）

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { AsyncPipe, DecimalPipe, NgIf } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { EmployeesService } from '../../services/employees.service';
import { MonthlyPremiumsService } from '../../services/monthly-premiums.service';
import { Auth } from '@angular/fire/auth';
import { Employee, MonthlyPremium } from '../../types';
```

### 5-2. UI レイアウト（イメージ）

#### 上部カード（フォーム）

```html
<mat-card>
  <h1>月次保険料 計算・保存</h1>
  <p>
    対象年月と、健康保険・介護保険・厚生年金の「事業主＋被保険者合計の料率」を入力して、
    現在の事業所に所属する社会保険加入者の月次保険料を一括計算・保存します。
  </p>
  
  <form [formGroup]="form" (ngSubmit)="onCalculateAndSave()">
    <!-- フォーム項目 -->
  </form>
</mat-card>
```

#### フォーム項目（FormGroup）

```typescript
readonly form = inject(FormBuilder).group({
  yearMonth: [
    new Date().toISOString().substring(0, 7), // 初期値：当月（YYYY-MM）
    Validators.required
  ],
  healthRate: [
    null,
    [Validators.required, Validators.min(0), Validators.max(1)]
  ],
  careRate: [
    null,
    [Validators.min(0), Validators.max(1)]
  ],
  pensionRate: [
    null,
    [Validators.required, Validators.min(0), Validators.max(1)]
  ],
});
```

**フォーム項目の詳細**:

- `yearMonth`（必須）
  - `<input type="month" formControlName="yearMonth">`
  - 初期値：当月（`YYYY-MM`）

- `healthRate`（必須, number）
  - `<input type="number" step="0.0001" formControlName="healthRate">`
  - プレースホルダ：「0.0991」（9.91% の場合）
  - バリデーション：0以上1以下

- `careRate`（任意, number）
  - `<input type="number" step="0.0001" formControlName="careRate">`
  - 対象者のみ利用。空の場合は介護保険 0 扱い。
  - バリデーション：0以上1以下（任意）

- `pensionRate`（必須, number）
  - `<input type="number" step="0.0001" formControlName="pensionRate">`
  - プレースホルダ：「0.183」（18.3% の場合）
  - バリデーション：0以上1以下

#### 計算ボタン

```html
<button
  mat-raised-button
  color="primary"
  type="submit"
  [disabled]="form.invalid || !(officeId$ | async) || loading()"
>
  <mat-spinner *ngIf="loading()" diameter="20" class="inline-spinner"></mat-spinner>
  計算して保存
</button>
```

**無効条件**:
- フォーム無効
- `officeId` 未設定
- ローディング中

#### 結果テーブル

データは `MonthlyPremium & { employeeName: string }` を表示。

**想定カラム**:

```typescript
readonly displayedColumns = [
  'employeeName',           // 氏名
  'healthStandardMonthly',  // 標準報酬月額（健保）
  'healthEmployee',         // 健康保険 本人
  'healthEmployer',         // 健康保険 会社
  'careEmployee',           // 介護保険 本人
  'careEmployer',           // 介護保険 会社
  'pensionEmployee',        // 厚生年金 本人
  'pensionEmployer',        // 厚生年金 会社
  'totalEmployee',          // 本人合計
  'totalEmployer',          // 会社合計
];
```

**テーブル実装例**:

```html
<mat-card *ngIf="results().length > 0">
  <h2>計算結果一覧（{{ form.get('yearMonth')?.value }}）</h2>
  
  <table mat-table [dataSource]="results()" class="premiums-table">
    <ng-container matColumnDef="employeeName">
      <th mat-header-cell *matHeaderCellDef>氏名</th>
      <td mat-cell *matCellDef="let row">{{ row.employeeName }}</td>
    </ng-container>
    
    <ng-container matColumnDef="healthStandardMonthly">
      <th mat-header-cell *matHeaderCellDef>標準報酬（健保）</th>
      <td mat-cell *matCellDef="let row">{{ row.healthStandardMonthly | number }}</td>
    </ng-container>
    
    <!-- 他のカラムも同様に定義 -->
    
    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
    <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
  </table>
  
  <!-- 合計行（オプション） -->
  <div class="totals">
    <strong>事業所合計（本人負担）: {{ totalEmployee() | number }}円</strong>
    <strong>事業所合計（会社負担）: {{ totalEmployer() | number }}円</strong>
  </div>
</mat-card>
```

**表示ルール**:
- 1 円単位でそのまま表示（`number` パイプで整形する程度）
- `careTotal` が `undefined` または `0` の場合は `-` または `0` を表示
- `premiumTreatment === 'exempt'` の従業員は金額がすべて 0 として表示（特別なマークは P1-4 では不要）

### 5-3. コンポーネントロジック

#### プロパティ

```typescript
export class MonthlyPremiumsPage {
  private readonly fb = inject(FormBuilder);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly employeesService = inject(EmployeesService);
  private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(Auth);
  
  readonly officeId$ = this.currentOffice.officeId$;
  readonly loading = signal(false);
  readonly results = signal<(MonthlyPremium & { employeeName: string })[]>([]);
  
  // フォーム定義（上記参照）
  readonly form = this.fb.group({...});
  
  // テーブルカラム定義（上記参照）
  readonly displayedColumns = [...];
}
```

#### 「計算して保存」ボタンのクリックハンドラ

```typescript
async onCalculateAndSave(): Promise<void> {
  // フォームバリデーション
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }
  
  try {
    this.loading.set(true);
    
    // 1. officeId 取得
    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) {
      this.snackBar.open('事業所が設定されていません', '閉じる', { duration: 3000 });
      return;
    }
    
    // 2. currentUserId 取得
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      this.snackBar.open('ログイン情報を取得できませんでした', '閉じる', { duration: 3000 });
      return;
    }
    const calculatedByUserId = currentUser.uid;
    
    // 3. フォーム値取得
    const formValue = this.form.value;
    const yearMonth = formValue.yearMonth as string;
    const healthRate = Number(formValue.healthRate);
    const careRate = formValue.careRate ? Number(formValue.careRate) : undefined;
    const pensionRate = Number(formValue.pensionRate);
    const calcDate = new Date().toISOString();
    
    // 4. EmployeesService.list(officeId) で従業員一覧取得
    const employees = await firstValueFrom(this.employeesService.list(officeId));
    
    // 5. MonthlyPremiumsService.saveForMonth(...) を呼ぶ
    const savedPremiums = await this.monthlyPremiumsService.saveForMonth({
      officeId,
      yearMonth,
      calcDate,
      healthRate,
      careRate,
      pensionRate,
      employees,
      calculatedByUserId,
    });
    
    // 6. 従業員名との紐付け
    const employeeNameMap = new Map<string, string>();
    employees.forEach((emp) => {
      employeeNameMap.set(emp.id, emp.name);
    });
    
    const resultsWithName = savedPremiums.map((premium) => ({
      ...premium,
      employeeName: employeeNameMap.get(premium.employeeId) ?? '(不明)',
    }));
    
    // 7. ローカル state に保存してテーブル表示
    this.results.set(resultsWithName);
    
    // 8. SnackBar で成功メッセージ
    const skippedCount = employees.length - savedPremiums.length;
    let message = `${yearMonth} 分の月次保険料を ${savedPremiums.length} 件計算・保存しました`;
    if (skippedCount > 0) {
      message += `（${skippedCount} 件スキップ：未加入または標準報酬未設定）`;
    }
    this.snackBar.open(message, '閉じる', { duration: 5000 });
    
  } catch (error) {
    console.error('月次保険料の計算・保存に失敗しました', error);
    this.snackBar.open(
      '月次保険料の計算・保存に失敗しました。コンソールを確認してください。',
      '閉じる',
      { duration: 5000 }
    );
  } finally {
    this.loading.set(false);
  }
}
```

#### 合計額の計算（オプション）

```typescript
readonly totalEmployee = computed(() => {
  return this.results().reduce((sum, r) => sum + r.totalEmployee, 0);
});

readonly totalEmployer = computed(() => {
  return this.results().reduce((sum, r) => sum + r.totalEmployer, 0);
});
```

### 5-4. エラーハンドリング

- **フォームバリデーションエラー**: `markAllAsTouched()` で表示
- **事業所未設定**: SnackBar で通知
- **ログイン情報取得失敗**: SnackBar で通知
- **Firestore エラー**: コンソール出力 + SnackBar で通知
- **計算できない従業員**: スキップして続行（エラーにはしない）

### 5-5. ローディング状態

- `loading` signal で管理
- ローディング中はボタンを無効化
- ローディングスピナーを表示（オプション）

---

## 6. スキップ・非対象事項

この指示書では以下は **やらない**：

- ❌ 保険料率マスタ（協会けんぽ PDF）の取り込み・自動セット
- ❌ ダッシュボード・グラフ表示
- ❌ My ページ（従業員本人向けの明細表示）
- ❌ CSV エクスポート
- ❌ Firestore セキュリティルールの細かい強化（現行ルールで動く範囲に留める。ルール強化は Phase2 以降で対応）
- ❌ 過去月分の一覧表示（今回は計算・保存した結果のみ表示）
- ❌ ソート・フィルタリング機能（P1-5 以降で対応）

---

## 7. 受け入れ条件（動作確認の観点）

### 7-1. 基本動作

- ✅ フォームに入力して「計算して保存」ボタンをクリックできる
- ✅ ローディング中はボタンが無効化される
- ✅ 計算・保存が完了すると結果テーブルが表示される

### 7-2. 計算・保存

- ✅ 社会保険加入者（`isInsured === true`）のみ計算される
- ✅ 標準報酬未設定の従業員はスキップされる
- ✅ 計算結果が Firestore に保存される
- ✅ 同じ従業員・同じ年月の再計算時は上書きされる

### 7-3. 結果表示

- ✅ テーブルに計算結果が正しく表示される
- ✅ 従業員名が正しく表示される
- ✅ 金額が1円単位で正しく表示される
- ✅ 介護保険が0の場合は適切に表示される（`-` または `0`）

### 7-4. エラーハンドリング

- ✅ フォーム無効時にエラーメッセージが表示される
- ✅ 事業所未設定時にエラーメッセージが表示される
- ✅ Firestore エラー時にエラーメッセージが表示される

### 7-5. スキップ通知

- ✅ スキップされた従業員数が SnackBar に表示される（オプション）

---

## 8. 実装時の注意事項

1. **既存コードの保護**: `premium-calculator.ts` のロジックは変更しない
2. **型安全性**: TypeScript の型チェックを活用
3. **エラーハンドリング**: ユーザーフレンドリーなエラーメッセージを表示
4. **パフォーマンス**: 大量の従業員がいる場合でも動作するように実装（Promise.all で並列処理）
5. **UI/UX**: ローディング状態を適切に表示

---

## 9. 参考実装

既存の `EmployeesPage` のパターンを参考にしてください：

- `CurrentOfficeService` の使用
- `MatTableModule` でのテーブル表示
- `MatSnackBar` での通知
- `signal` での状態管理

---

**実装完了後は、この指示書のチェックリストを確認して、実装状況を更新してください。**

