# Phase3 実装指示書：標準報酬履歴（StandardRewardHistory）の刷新

## 改訂履歴
- 2025年1月: 初版作成

---

## 1. 概要 (Overview)

### 1-1. Phase3 の目的

Phase3 では、**標準報酬履歴を健保／厚年で区別して管理できるようにする**ことを目的とします。

具体的には：

1. `StandardRewardHistory` の CRUD を `insuranceKind` 対応にする
2. 従業員フォームから標準報酬を変更した際に、該当保険種別の履歴を自動追加する
3. Employee と StandardRewardHistory の同期ポリシーを実装する
4. 履歴UIを健保／厚年でタブ分けして表示する
5. 履歴からの標準報酬解決ロジックを保険種別対応にする

### 1-2. Phase1・Phase2 の結果を前提とした「今の世界観」

Phase1・Phase2 の実装により、以下の状態になっています：

- **データモデル**: `StandardRewardHistory` 型に `insuranceKind` と `grade` が追加済み（Phase1）
- **従業員フォーム**: 報酬月額と決定年月から自動的に健保・厚年の等級・標準報酬を決定できる（Phase2）
- **保険料計算**: `premium-calculator.ts` は既に新ロジックに置き換え済み（Phase1）
  - 健康保険: `Employee.healthStandardMonthly` を使用
  - 厚生年金: `Employee.pensionStandardMonthly` を使用

### 1-3. Phase3 で実現する状態

Phase3 完了時点で：

- 標準報酬履歴が健保と厚年で分離して管理される
- 従業員フォームで標準報酬を変更すると、該当保険種別の履歴が自動追加される
- 履歴を追加・更新すると、Employee の標準報酬が自動的に更新される
- 履歴UIで健保と厚年をタブで切り替えて表示できる
- 書類生成時に履歴から標準報酬を解決する際、保険種別を指定できる

---

## 2. 対象ファイル (Scope / Target Files)

### 2-1. 主な変更対象ファイル

| ファイルパス | 変更内容 | 優先度 |
|------------|---------|--------|
| `src/app/services/standard-reward-history.service.ts` | `insuranceKind` でフィルタできるようにする、一覧取得の拡張 | **必須** |
| `src/app/pages/employees/standard-reward-history-form-dialog.component.ts` | 保険種別選択フィールドの追加 | **必須** |
| `src/app/pages/employees/employee-detail-dialog.component.ts` | 履歴UIを健保／厚年タブで表示 | **必須** |
| `src/app/pages/employees/employee-form-dialog.component.ts` | 標準報酬変更時の自動履歴追加ロジック | **必須** |
| `src/app/services/employees.service.ts` | 履歴追加時の Employee 同期ロジック | **必須** |
| `src/app/services/document-generator.service.ts` | 標準報酬解決ロジックを保険種別対応に | **必須** |
| `src/app/pages/documents/document-generation-dialog.component.ts` | 書類生成時の保険種別指定 | **推奨** |

### 2-2. 参照のみ（変更なし）のファイル

| ファイルパス | 確認内容 |
|------------|---------|
| `src/app/types.ts` | Phase1 で更新済み、Phase3 では参照のみ |
| `src/app/utils/premium-calculator.ts` | Phase1 で改修済み、Phase3 では使用のみ |
| `src/app/utils/standard-reward-calculator.ts` | Phase2 で実装済み、Phase3 では使用のみ |

### 2-3. Phase4 以降で対応するファイル

| ファイルパス | Phase3での対応 | 本格改修フェーズ |
|------------|--------------|----------------|
| `src/app/utils/csv-import.service.ts` | 変更なし | Phase4 |
| `src/app/utils/csv-export.service.ts` | 変更なし | Phase4 |
| `src/app/services/data-quality.service.ts` | 最小限の修正のみ | Phase5 |

---

## 3. データモデルと同期ポリシー

### 3-1. `StandardRewardHistory` の構造（Phase1 で更新済み）

```typescript
export type InsuranceKind = 'health' | 'pension';

export interface StandardRewardHistory {
  id: string;
  employeeId: string;
  insuranceKind: InsuranceKind; // ★ 健保 or 厚年
  decisionYearMonth: YearMonthString;
  appliedFromYearMonth: YearMonthString;
  standardMonthlyReward: number; // 標準報酬月額（この保険種別用）
  grade?: number;                // ★ 等級（あれば）
  decisionKind: StandardRewardDecisionKind; // 算定／月変／賞与など
  note?: string;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  createdByUserId?: string;
  updatedByUserId?: string;
}
```

### 3-2. Employee と StandardRewardHistory の同期ポリシー

**基本方針:**
- 編集起点がどちらであっても、最終的に `Employee` と履歴が一致するようにする

#### 3-2-1. 履歴 → Employee 方向の同期

**トリガー:**
- 新しい `StandardRewardHistory` が追加されたとき
- 既存の `StandardRewardHistory` が更新されたとき

**処理内容:**
1. 追加・更新された履歴の `insuranceKind` を確認
2. 該当保険種別の最新履歴（`appliedFromYearMonth` が最新のもの）を取得
3. `Employee` の該当フィールドを更新
   - `insuranceKind === 'health'` → `Employee.healthStandardMonthly` / `healthGrade` を更新
   - `insuranceKind === 'pension'` → `Employee.pensionStandardMonthly` / `pensionGrade` を更新

**実装場所:**
- `StandardRewardHistoryService.save()` メソッド内で、保存後に同期処理を実行
- または、`EmployeesService` に同期メソッドを追加して呼び出す

#### 3-2-2. Employee → 履歴 方向の同期

**トリガー:**
- 従業員フォームで `Employee` の `healthStandardMonthly` / `pensionStandardMonthly`（あるいは grade）を直接変更した場合

**処理内容:**
1. 変更された保険種別を判定
   - `healthStandardMonthly` / `healthGrade` が変更された → `insuranceKind: 'health'`
   - `pensionStandardMonthly` / `pensionGrade` が変更された → `insuranceKind: 'pension'`
2. フォームの `decisionYearMonth` を取得
3. 該当保険種別の履歴を1件追加
   - `insuranceKind`: 判定した保険種別
   - `decisionYearMonth`: フォームの `decisionYearMonth`
   - `appliedFromYearMonth`: フォームの `decisionYearMonth`（または「今日の年月」）
   - `standardMonthlyReward`: 変更後の標準報酬月額
   - `grade`: 変更後の等級（あれば）
   - `decisionKind`: `'monthly_change'`（または適切な区分）

**実装場所:**
- `EmployeeFormDialogComponent.submit()` メソッド内で、保存前に履歴追加処理を実行

#### 3-2-3. 初回登録時の扱い

**ケース1: 健保と厚年で同じ標準報酬の場合**
- 両方の保険種別に履歴を追加する（2件追加）
- または、運用ルールに応じて「健保のみ履歴必須」とする

**ケース2: 健保と厚年で異なる標準報酬の場合**
- それぞれの保険種別に履歴を追加する（2件追加）

**推奨方針:**
- 初回登録時は、健保・厚年それぞれに履歴を追加する（2件追加）
- Employee の標準報酬が変わったら、`GradeDecisionSource` に関係なく履歴を追加する
- このとき `GradeDecisionSource` や `decisionKind` によって「自動決定（`auto_from_salary`）／手動修正（`manual_override`）／CSVインポート（`imported`）」などの由来を区別する

---

## 4. 履歴CRUDの `insuranceKind` 対応

### 4-1. `StandardRewardHistoryService` の拡張

#### 4-1-1. 一覧取得メソッドの拡張

**現状:**
```typescript
list(officeId: string, employeeId: string): Observable<StandardRewardHistory[]>
```

**変更後:**
```typescript
// 全履歴を取得（既存メソッド、互換性のため維持）
list(officeId: string, employeeId: string): Observable<StandardRewardHistory[]>

// 保険種別でフィルタして取得（新規追加）
listByInsuranceKind(
  officeId: string,
  employeeId: string,
  insuranceKind: InsuranceKind
): Observable<StandardRewardHistory[]>
```

**実装例:**
```typescript
listByInsuranceKind(
  officeId: string,
  employeeId: string,
  insuranceKind: InsuranceKind
): Observable<StandardRewardHistory[]> {
  const ref = query(
    this.collectionPath(officeId, employeeId),
    where('insuranceKind', '==', insuranceKind),
    orderBy('decisionYearMonth', 'desc')
  );
  return collectionData(ref, { idField: 'id' }) as Observable<StandardRewardHistory[]>;
}
```

#### 4-1-2. 最新履歴取得メソッドの追加

**用途:**
- Employee との同期時に、各保険種別の最新履歴を取得する

**実装例:**
```typescript
async getLatestByInsuranceKind(
  officeId: string,
  employeeId: string,
  insuranceKind: InsuranceKind
): Promise<StandardRewardHistory | null> {
  const ref = query(
    this.collectionPath(officeId, employeeId),
    where('insuranceKind', '==', insuranceKind),
    orderBy('appliedFromYearMonth', 'desc'),
    limit(1)
  );
  const snapshot = await firstValueFrom(collectionData(ref, { idField: 'id' }));
  return snapshot.length > 0 ? snapshot[0] : null;
}
```

#### 4-1-3. `save()` メソッドの更新

**現状:**
- `insuranceKind` のデフォルト値が `'health'` に固定されている

**変更後:**
- `insuranceKind` が必須フィールドになるようにバリデーションを追加
- デフォルト値は削除し、呼び出し側で必ず指定するようにする

**実装例:**
```typescript
async save(
  officeId: string,
  employeeId: string,
  history: Partial<StandardRewardHistory> & { id?: string }
): Promise<void> {
  // insuranceKind が必須であることを確認
  if (!history.insuranceKind || (history.insuranceKind !== 'health' && history.insuranceKind !== 'pension')) {
    throw new Error('insuranceKind must be "health" or "pension"');
  }

  // ... 既存の処理 ...
  
  const payload: Partial<StandardRewardHistory> = {
    id: ref.id,
    employeeId,
    insuranceKind: history.insuranceKind, // デフォルト値なし
    decisionYearMonth: history.decisionYearMonth ?? '',
    appliedFromYearMonth: history.appliedFromYearMonth ?? '',
    standardMonthlyReward: history.standardMonthlyReward ?? 0,
    grade: history.grade ?? undefined,
    decisionKind: history.decisionKind ?? 'other',
    note: history.note ?? undefined,
    updatedAt: now,
    updatedByUserId: currentUser?.id
  };

  // ... 既存の処理 ...
  
  await setDoc(ref, payload, { merge: true });
  
  // 保存後に Employee を同期
  await this.syncEmployeeFromHistory(officeId, employeeId, history.insuranceKind);
}
```

### 4-2. Employee との同期メソッドの実装

**実装場所:**
- `StandardRewardHistoryService` に追加するか、`EmployeesService` に追加するかは設計による
- **推奨**: `StandardRewardHistoryService` に追加し、`EmployeesService` を注入して使用

**実装例:**
```typescript
// StandardRewardHistoryService に追加

private async syncEmployeeFromHistory(
  officeId: string,
  employeeId: string,
  insuranceKind: InsuranceKind
): Promise<void> {
  const latestHistory = await this.getLatestByInsuranceKind(officeId, employeeId, insuranceKind);
  if (!latestHistory) {
    return;
  }

  const employee = await firstValueFrom(
    this.employeesService.getById(officeId, employeeId)
  );
  if (!employee) {
    return;
  }

  const updatePayload: Partial<Employee> = {};
  
  if (insuranceKind === 'health') {
    updatePayload.healthStandardMonthly = latestHistory.standardMonthlyReward;
    updatePayload.healthGrade = latestHistory.grade ?? null;
  } else if (insuranceKind === 'pension') {
    updatePayload.pensionStandardMonthly = latestHistory.standardMonthlyReward;
    updatePayload.pensionGrade = latestHistory.grade ?? null;
  }

  await this.employeesService.save(officeId, { ...employee, ...updatePayload });
}
```

**注意:**
- `EmployeesService` を注入する必要があるため、循環依存に注意する
- または、`EmployeesService` 側に同期メソッドを追加し、`StandardRewardHistoryService` から呼び出す

---

## 5. 従業員フォームからの自動履歴追加

### 5-1. 変更検知ロジック

**実装場所:**
- `EmployeeFormDialogComponent.submit()` メソッド内

**処理フロー:**
1. フォームの現在の値を取得
2. 既存の `Employee` データと比較して、変更された保険種別を判定
3. 変更された保険種別ごとに履歴を追加

**実装例:**
```typescript
async submit(): Promise<void> {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  const formValue = this.form.getRawValue();
  const employeePayload: Partial<Employee> = {
    // ... 既存のフィールドマッピング ...
  };

  // Employee を保存
  const employeeId = await this.employeesService.save(this.data.officeId, employeePayload);
  
  // 標準報酬が変更された場合、履歴を自動追加
  if (this.data.employee) {
    // 既存従業員の場合、変更を検知
    const existingEmployee = this.data.employee;
    const decisionYearMonth = formValue.decisionYearMonth as YearMonthString;
    
    // 健康保険の変更を検知
    const healthChanged = 
      existingEmployee.healthStandardMonthly !== formValue.healthStandardMonthly ||
      existingEmployee.healthGrade !== formValue.healthGrade;
    
    if (healthChanged && formValue.healthStandardMonthly != null && formValue.healthStandardMonthly > 0) {
      await this.addStandardRewardHistory(
        this.data.officeId,
        employeeId,
        'health',
        decisionYearMonth,
        formValue.healthStandardMonthly,
        formValue.healthGrade ?? undefined
      );
    }
    
    // 厚生年金の変更を検知
    const pensionChanged = 
      existingEmployee.pensionStandardMonthly !== formValue.pensionStandardMonthly ||
      existingEmployee.pensionGrade !== formValue.pensionGrade;
    
    if (pensionChanged && formValue.pensionStandardMonthly != null && formValue.pensionStandardMonthly > 0) {
      await this.addStandardRewardHistory(
        this.data.officeId,
        employeeId,
        'pension',
        decisionYearMonth,
        formValue.pensionStandardMonthly,
        formValue.pensionGrade ?? undefined
      );
    }
  } else {
    // 新規作成の場合、両方の保険種別に履歴を追加
    const decisionYearMonth = formValue.decisionYearMonth as YearMonthString;
    
    if (formValue.healthStandardMonthly != null && formValue.healthStandardMonthly > 0) {
      await this.addStandardRewardHistory(
        this.data.officeId,
        employeeId,
        'health',
        decisionYearMonth,
        formValue.healthStandardMonthly,
        formValue.healthGrade ?? undefined
      );
    }
    
    if (formValue.pensionStandardMonthly != null && formValue.pensionStandardMonthly > 0) {
      await this.addStandardRewardHistory(
        this.data.officeId,
        employeeId,
        'pension',
        decisionYearMonth,
        formValue.pensionStandardMonthly,
        formValue.pensionGrade ?? undefined
      );
    }
  }
}

private async addStandardRewardHistory(
  officeId: string,
  employeeId: string,
  insuranceKind: InsuranceKind,
  decisionYearMonth: YearMonthString,
  standardMonthlyReward: number,
  grade?: number,
  decisionKind?: StandardRewardDecisionKind
): Promise<void> {
  await this.standardRewardHistoryService.save(officeId, employeeId, {
    insuranceKind,
    decisionYearMonth,
    appliedFromYearMonth: decisionYearMonth, // または「今日の年月」
    standardMonthlyReward,
    grade,
    decisionKind: decisionKind ?? 'monthly_change' // デフォルトは月変
  });
}
```

### 5-2. 履歴追加時の由来の区別

**方針:**
- Employee の標準報酬が変わったら、`GradeDecisionSource` に関係なく履歴を追加する
- これにより「履歴の最新レコード = Employee スナップショット」という整合性が保たれる
- `GradeDecisionSource` や `decisionKind` によって「自動決定（`auto_from_salary`）／手動修正（`manual_override`）／CSVインポート（`imported`）」などの由来を区別する

**実装例:**
```typescript
// 健康保険の変更を検知
const healthChanged = 
  existingEmployee.healthStandardMonthly !== formValue.healthStandardMonthly ||
  existingEmployee.healthGrade !== formValue.healthGrade;

const shouldAddHealthHistory = 
  healthChanged && 
  formValue.healthStandardMonthly != null && 
  formValue.healthStandardMonthly > 0;

if (shouldAddHealthHistory) {
  // GradeDecisionSource に応じて decisionKind を設定
  const decisionKind = formValue.healthGradeSource === 'auto_from_salary' 
    ? 'monthly_change' // 自動決定の場合は月変
    : formValue.healthGradeSource === 'imported'
    ? 'other' // CSVインポートの場合はその他
    : 'monthly_change'; // 手動修正の場合も月変として記録
  
  await this.addStandardRewardHistory(
    this.data.officeId,
    employeeId,
    'health',
    decisionYearMonth,
    formValue.healthStandardMonthly,
    formValue.healthGrade ?? undefined,
    decisionKind
  );
}
```

---

## 6. 履歴UIの刷新（健保／厚年タブ）

### 6-1. `employee-detail-dialog.component.ts` の変更

#### 6-1-1. タブ構造の追加

**実装例:**
```typescript
// employee-detail-dialog.component.ts

import { MatTabsModule } from '@angular/material/tabs';

// コンポーネント内
selectedInsuranceKind: InsuranceKind = 'health';

healthHistories$: Observable<StandardRewardHistory[]>;
pensionHistories$: Observable<StandardRewardHistory[]>;

ngOnInit() {
  if (this.data.employee) {
    this.healthHistories$ = this.standardRewardHistoryService.listByInsuranceKind(
      this.data.officeId,
      this.data.employee.id,
      'health'
    );
    this.pensionHistories$ = this.standardRewardHistoryService.listByInsuranceKind(
      this.data.officeId,
      this.data.employee.id,
      'pension'
    );
  }
}
```

**テンプレート例:**
```html
<!-- 標準報酬履歴 -->
<div class="form-section" id="standard-reward-history" #sectionBlock>
  <div class="section-title standard-reward-title">
    <div class="flex-row align-center gap-2">
      <mat-icon>trending_up</mat-icon>
      <span class="mat-h3 m-0">標準報酬履歴</span>
    </div>
    <!-- ... 既存のボタン ... -->
  </div>

  <mat-tab-group [(selectedIndex)]="selectedInsuranceKindIndex">
    <mat-tab label="健康保険">
      <ng-container *ngIf="healthHistories$ | async as healthHistories">
        <!-- 健康保険の履歴テーブル -->
        <table mat-table [dataSource]="healthHistories" class="mat-elevation-z2">
          <!-- ... テーブル定義 ... -->
        </table>
      </ng-container>
    </mat-tab>
    
    <mat-tab label="厚生年金">
      <ng-container *ngIf="pensionHistories$ | async as pensionHistories">
        <!-- 厚生年金の履歴テーブル -->
        <table mat-table [dataSource]="pensionHistories" class="mat-elevation-z2">
          <!-- ... テーブル定義 ... -->
        </table>
      </ng-container>
    </mat-tab>
  </mat-tab-group>
</div>
```

#### 6-1-2. 履歴追加ボタンの更新

**変更内容:**
- タブで選択されている保険種別に応じて、履歴追加ダイアログを開く際に `insuranceKind` を渡す

**実装例:**
```typescript
openHistoryFormDialog(insuranceKind?: InsuranceKind): void {
  const kind = insuranceKind ?? this.selectedInsuranceKind;
  const dialogRef = this.dialog.open<
    StandardRewardHistoryFormDialogComponent,
    StandardRewardHistoryFormDialogData
  >(StandardRewardHistoryFormDialogComponent, {
    width: '600px',
    data: {
      officeId: this.data.officeId,
      employeeId: this.data.employee.id,
      insuranceKind: kind // ★ 追加
    }
  });

  dialogRef.afterClosed().subscribe(() => {
    // 履歴一覧を再読み込み
    this.refreshHistories();
  });
}
```

### 6-2. `standard-reward-history-form-dialog.component.ts` の変更

#### 6-2-1. 保険種別選択フィールドの追加

**変更内容:**
- 新規作成時のみ保険種別を選択可能にする
- 編集時は既存の `insuranceKind` を表示のみ（変更不可）

**実装例:**
```typescript
// standard-reward-history-form-dialog.component.ts

export interface StandardRewardHistoryFormDialogData {
  officeId: string;
  employeeId: string;
  history?: StandardRewardHistory;
  insuranceKind?: InsuranceKind; // ★ 追加：新規作成時のデフォルト値
}

// コンポーネント内
readonly form = this.fb.group({
  insuranceKind: [this.data.insuranceKind ?? 'health', Validators.required], // ★ 追加
  decisionYearMonth: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}$/)]],
  appliedFromYearMonth: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}$/)]],
  standardMonthlyReward: [0, [Validators.required, Validators.min(1)]],
  grade: [null as number | null],
  decisionKind: ['other', Validators.required],
  note: ['']
});

get isEditMode(): boolean {
  return !!this.data.history;
}

get canEditInsuranceKind(): boolean {
  return !this.isEditMode; // 編集時は変更不可
}
```

**テンプレート例:**
```html
<mat-form-field appearance="outline" class="full-width" *ngIf="canEditInsuranceKind">
  <mat-label>保険種別 *</mat-label>
  <mat-select formControlName="insuranceKind" required>
    <mat-option value="health">健康保険</mat-option>
    <mat-option value="pension">厚生年金</mat-option>
  </mat-select>
  <mat-error *ngIf="form.controls.insuranceKind.hasError('required')">
    保険種別を選択してください
  </mat-error>
</mat-form-field>

<mat-form-field appearance="outline" class="full-width" *ngIf="!canEditInsuranceKind">
  <mat-label>保険種別</mat-label>
  <input matInput [value]="getInsuranceKindLabel(data.history?.insuranceKind)" readonly />
</mat-form-field>
```

---

## 7. 履歴からの標準報酬解決ロジックの保険種別対応

### 7-1. `DocumentGeneratorService` の更新

**現状:**
- `resolveStandardMonthlyReward()` メソッドが存在するが、保険種別を考慮していない

**変更後:**
- `insuranceKind` パラメータを追加し、該当保険種別の履歴のみを見る

**実装例:**
```typescript
// document-generator.service.ts

/**
 * 標準報酬月額を解決する（保険種別対応）
 * 
 * 解決順位:
 * 1. 指定保険種別の StandardRewardHistory（最新）
 * 2. Employee の healthStandardMonthly / pensionStandardMonthly
 * 3. （最終フォールバックとして）payrollSettings.insurableMonthlyWage（報酬月額）
 */
async resolveStandardMonthlyReward(
  employee: Employee,
  histories: StandardRewardHistory[],
  kind: InsuranceKind,
  targetYearMonth: YearMonthString
): Promise<number | null> {
  // 1. 指定保険種別の履歴から解決
  const filteredHistories = histories.filter(h => h.insuranceKind === kind);
  if (filteredHistories.length > 0) {
    // 対象年月以前の最新履歴を探す
    const targetYearMonthNum = this.yearMonthToNumber(targetYearMonth);
    const applicableHistory = filteredHistories
      .filter(h => this.yearMonthToNumber(h.appliedFromYearMonth) <= targetYearMonthNum)
      .sort((a, b) => 
        this.yearMonthToNumber(b.appliedFromYearMonth) - 
        this.yearMonthToNumber(a.appliedFromYearMonth)
      )[0];
    
    if (applicableHistory) {
      return applicableHistory.standardMonthlyReward;
    }
  }

  // 2. Employee の標準報酬から解決
  if (kind === 'health' && employee.healthStandardMonthly != null) {
    return employee.healthStandardMonthly;
  }
  if (kind === 'pension' && employee.pensionStandardMonthly != null) {
    return employee.pensionStandardMonthly;
  }

  // 3. 報酬月額をフォールバックとして使用
  if (employee.payrollSettings?.insurableMonthlyWage != null) {
    return employee.payrollSettings.insurableMonthlyWage;
  }

  return null;
}

private yearMonthToNumber(yearMonth: YearMonthString): number {
  const [year, month] = yearMonth.split('-').map(Number);
  return year * 100 + month;
}
```

### 7-2. 書類生成ダイアログの更新

**変更内容:**
- 各帳票でどの保険種別を使うかを明示
- 資格取得届（健保） → `'health'`
- 資格取得届（厚年） → `'pension'`
- 資格喪失届も同様

**実装例:**
```typescript
// document-generation-dialog.component.ts

async generateDocument(documentType: DocumentType): Promise<void> {
  // ... 既存の処理 ...
  
  const insuranceKind = this.getInsuranceKindForDocument(documentType);
  
  const standardReward = await this.documentGeneratorService.resolveStandardMonthlyReward(
    employee,
    histories,
    insuranceKind,
    targetYearMonth
  );
  
  // ... 既存の処理 ...
}

private getInsuranceKindForDocument(documentType: DocumentType): InsuranceKind {
  // 資格取得届・喪失届の種類に応じて保険種別を返す
  if (documentType.includes('health')) {
    return 'health';
  } else if (documentType.includes('pension')) {
    return 'pension';
  }
  // デフォルトは健康保険
  return 'health';
}
```

---

## 8. 実装ステップ (Step-by-step Plan)

### ステップ1: `StandardRewardHistoryService` の拡張

**目的**: 保険種別でフィルタできるようにする

**対象ファイル**:
- `src/app/services/standard-reward-history.service.ts`

**実施内容**:
1. `listByInsuranceKind()` メソッドを追加
2. `getLatestByInsuranceKind()` メソッドを追加
3. `save()` メソッドで `insuranceKind` のバリデーションを追加
4. `syncEmployeeFromHistory()` メソッドを追加（Employee との同期）

**確認事項**:
- メソッドが正しく実装されているか
- 既存のコードに影響がないか

---

### ステップ2: 従業員フォームからの自動履歴追加

**目的**: 標準報酬変更時に履歴を自動追加

**対象ファイル**:
- `src/app/pages/employees/employee-form-dialog.component.ts`

**実施内容**:
1. `submit()` メソッド内で変更検知ロジックを追加
2. `addStandardRewardHistory()` ヘルパーメソッドを追加
3. 新規作成時と更新時で処理を分岐
4. `GradeDecisionSource` による制御を追加

**確認事項**:
- 変更が正しく検知されるか
- 履歴が正しく追加されるか

---

### ステップ3: 履歴フォームダイアログの更新

**目的**: 保険種別選択フィールドを追加

**対象ファイル**:
- `src/app/pages/employees/standard-reward-history-form-dialog.component.ts`

**実施内容**:
1. `insuranceKind` FormControl を追加
2. 新規作成時のみ選択可能にする
3. 編集時は表示のみ（変更不可）
4. テンプレートに保険種別フィールドを追加

**確認事項**:
- フォームが正しく動作するか
- バリデーションが正しく機能するか

---

### ステップ4: 履歴UIの刷新（タブ分け）

**目的**: 健保／厚年でタブ分けして表示

**対象ファイル**:
- `src/app/pages/employees/employee-detail-dialog.component.ts`

**実施内容**:
1. `MatTabsModule` をインポート
2. `healthHistories$` / `pensionHistories$` Observable を追加
3. テンプレートにタブ構造を追加
4. 履歴追加ボタンで選択中の保険種別を渡す

**確認事項**:
- タブが正しく動作するか
- 履歴が正しく表示されるか

---

### ステップ5: 書類生成ロジックの更新

**目的**: 標準報酬解決を保険種別対応に

**対象ファイル**:
- `src/app/services/document-generator.service.ts`
- `src/app/pages/documents/document-generation-dialog.component.ts`

**実施内容**:
1. `resolveStandardMonthlyReward()` メソッドに `insuranceKind` パラメータを追加
2. 指定保険種別の履歴のみを見るように変更
3. 書類生成ダイアログで保険種別を指定

**確認事項**:
- 標準報酬が正しく解決されるか
- 各帳票で正しい保険種別が使われるか

---

### ステップ6: 影響確認とテスト追加

**目的**: 変更が既存機能に影響していないことを確認

**対象ファイル**:
- すべての変更対象ファイル

**実施内容**:
1. 既存機能の動作確認
2. テストケースの追加
3. E2E テストの実行（可能な場合）

**確認事項**:
- 既存機能が正しく動作しているか
- テストが適切に追加されているか

---

## 9. テスト観点

### 9-1. 履歴CRUDのテスト

#### 保険種別でのフィルタリング

1. **正常系**
   - `listByInsuranceKind('health')` で健康保険の履歴のみが取得できる
   - `listByInsuranceKind('pension')` で厚生年金の履歴のみが取得できる

2. **空の結果**
   - 該当保険種別の履歴が存在しない場合、空配列が返される

#### 履歴の保存

1. **正常系**
   - `insuranceKind` を指定して保存できる
   - `grade` が正しく保存される

2. **バリデーション**
   - `insuranceKind` が未指定の場合、エラーが発生する
   - `insuranceKind` が `'health'` または `'pension'` 以外の場合、エラーが発生する

### 9-2. Employee との同期のテスト

#### 履歴 → Employee 方向

1. **正常系**
   - 健康保険の履歴を追加すると、`Employee.healthStandardMonthly` / `healthGrade` が更新される
   - 厚生年金の履歴を追加すると、`Employee.pensionStandardMonthly` / `pensionGrade` が更新される

2. **最新履歴の選択**
   - 複数の履歴がある場合、`appliedFromYearMonth` が最新のものが Employee に反映される

#### Employee → 履歴 方向

1. **正常系**
   - 従業員フォームで健康保険の標準報酬を変更すると、健康保険の履歴が追加される
   - 従業員フォームで厚生年金の標準報酬を変更すると、厚生年金の履歴が追加される

2. **変更検知**
   - 標準報酬が変更されていない場合、履歴は追加されない
   - 標準報酬が変更された場合、`GradeDecisionSource` に関係なく履歴を追加する
   - `GradeDecisionSource` に応じて由来（自動決定／手動修正／CSVインポート）が正しく記録される

### 9-3. UIのテスト

#### タブ表示

1. **正常系**
   - 健康保険タブで健康保険の履歴のみが表示される
   - 厚生年金タブで厚生年金の履歴のみが表示される

2. **空の状態**
   - 該当保険種別の履歴が存在しない場合、空のメッセージが表示される

#### 履歴追加ダイアログ

1. **正常系**
   - 新規作成時、保険種別を選択できる
   - 編集時、保険種別は表示のみ（変更不可）

2. **バリデーション**
   - 保険種別が未選択の場合、保存できない

### 9-4. 書類生成のテスト

1. **正常系**
   - 資格取得届（健保）で健康保険の標準報酬が使用される
   - 資格取得届（厚年）で厚生年金の標準報酬が使用される

2. **解決順位**
   - 履歴がある場合、履歴から解決される
   - 履歴がない場合、Employee の標準報酬から解決される
   - どちらもない場合、報酬月額がフォールバックとして使用される

---

## 10. 懸念点・要確認事項

### 10-1. 既存データの移行

**懸念点**: 既存の `StandardRewardHistory` レコードに `insuranceKind` が設定されていない場合、どう扱うか

**提案**:
- Phase3 では既存データへの配慮は不要（Phase1 の方針に従う）
- 既存データは手動で修正するか、移行スクリプトを作成する

**要確認**: 既存データの移行が必要かどうか

---

### 10-2. 履歴追加のタイミング

**懸念点**: 従業員フォームで標準報酬を変更した際、毎回履歴を追加するか、確認ダイアログを表示するか

**提案**:
- **案A（推奨）**: 自動的に履歴を追加する（`GradeDecisionSource` が `'auto_from_salary'` の場合のみ）
- **案B**: 確認ダイアログを表示してから履歴を追加する

**要確認**: ユーザーの要望に合わせて決定する

---

### 10-3. 初回登録時の履歴追加

**懸念点**: 新規従業員登録時、健保と厚年で同じ標準報酬の場合、履歴を2件追加するか、1件のみ追加するか

**提案**:
- 健保・厚年それぞれに履歴を追加する（2件追加）
- ただし、`GradeDecisionSource` が `'auto_from_salary'` の場合のみ自動追加

**要確認**: 運用上の要件に合わせて決定する

---

### 10-4. 履歴削除時の Employee 同期

**懸念点**: 履歴を削除した場合、Employee の標準報酬をどう更新するか

**提案**:
- 履歴削除後、該当保険種別の最新履歴を取得して Employee を更新
- 履歴が存在しない場合、Employee の標準報酬を `null` にするか、そのまま維持するかは運用による

**要確認**: 運用上の要件に合わせて決定する

---

## 11. 参考資料

- `STANDARD_REWARD_REFACTORING_PLAN.md`: 大規模改良方針書
- `STANDARD_REWARD_REFACTORING_PHASE1.md`: Phase1 実装指示書
- `STANDARD_REWARD_REFACTORING_PHASE2.md`: Phase2 実装指示書
- `src/app/types.ts`: 型定義
- `src/app/services/standard-reward-history.service.ts`: 標準報酬履歴サービス（現行実装）
- `src/app/pages/employees/employee-form-dialog.component.ts`: 従業員フォーム（Phase2 で更新済み）
- `src/app/services/document-generator.service.ts`: 書類生成サービス（現行実装）

