# Phase3-14 既存実装確認結果

## 1. SocialInsuranceProcedure 型定義の確認

### ファイルパス
`src/app/types.ts` (54-80行目)

### 型定義
```typescript
export type ProcedureStatus = 'not_started' | 'in_progress' | 'submitted' | 'rejected';

export interface SocialInsuranceProcedure {
  id: string;
  officeId: string;
  procedureType: ProcedureType;
  employeeId: string;
  dependentId?: string;
  incidentDate: string;  // YYYY-MM-DD形式のstring
  deadline: string;       // YYYY-MM-DD形式のstring
  status: ProcedureStatus;
  submittedAt?: string;   // YYYY-MM-DD形式のstring
  assignedPersonName?: string;
  note?: string;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  createdByUserId?: string;
  updatedByUserId?: string;
}
```

### フィールドの詳細

- **`deadline`**: `string`型（`YYYY-MM-DD`形式の文字列）
- **`status`**: `ProcedureStatus`型（`'not_started' | 'in_progress' | 'submitted' | 'rejected'`の4つの値）
- **`incidentDate`**: `string`型（`YYYY-MM-DD`形式の文字列）
- **`submittedAt`**: `string | undefined`型（`YYYY-MM-DD`形式の文字列、提出済の場合のみ）

### status値の意味とUI表示

`src/app/pages/procedures/procedures.page.ts` (410-418行目) より：

```typescript
getStatusLabel(status: ProcedureStatus): string {
  const labels: Record<ProcedureStatus, string> = {
    not_started: '未着手',
    in_progress: '準備中',
    submitted: '提出済',
    rejected: '差戻し'
  };
  return labels[status] ?? status;
}
```

**ステータス値一覧**:
- `'not_started'`: 未着手（UI表示: 「未着手」）
- `'in_progress'`: 準備中（UI表示: 「準備中」）
- `'submitted'`: 提出済（UI表示: 「提出済」）
- `'rejected'`: 差戻し（UI表示: 「差戻し」）

---

## 2. deadline フィールドのフォーマット／タイムゾーン

### 現在の実装状況

**`deadline`は`YYYY-MM-DD`形式の文字列としてFirestoreに保存されています。**

### deadlineを設定している箇所

#### 2.1 手続き新規作成・編集処理

**ファイル**: `src/app/pages/procedures/procedure-form-dialog.component.ts`

**フォーム定義** (153-154行目):
```typescript
incidentDate: [this.data.procedure?.incidentDate ?? '', Validators.required],
deadline: [this.data.procedure?.deadline ?? '', Validators.required],
```

**期限計算ロジック** (185-192行目, 195-203行目):
```typescript
onIncidentDateChange(): void {
  const incidentDate = this.form.get('incidentDate')?.value;
  const procedureType = this.form.get('procedureType')?.value as ProcedureType | null;

  if (incidentDate && procedureType) {
    const deadline = calculateDeadline(procedureType, incidentDate);
    this.form.patchValue({ deadline });
  }
}
```

**保存処理** (261-262行目, 277-278行目):
```typescript
incidentDate: formValue.incidentDate || '',
deadline: formValue.deadline || '',
```

#### 2.2 期限計算関数

**ファイル**: `src/app/utils/procedure-deadline-calculator.ts`

**実装** (18-50行目):
```typescript
export function calculateDeadline(procedureType: ProcedureType, incidentDate: string): string {
  const incident = new Date(incidentDate);
  let deadline: Date;

  switch (procedureType) {
    case 'qualification_acquisition':
    case 'qualification_loss':
    case 'dependent_change':
    case 'bonus_payment': {
      deadline = new Date(incident);
      deadline.setDate(deadline.getDate() + 5);
      break;
    }
    case 'standard_reward': {
      deadline = new Date(incident.getFullYear(), 6, 10);
      break;
    }
    case 'monthly_change': {
      deadline = new Date(incident.getFullYear(), incident.getMonth() + 1, 10);
      break;
    }
    default: {
      deadline = new Date(incident.getFullYear(), incident.getMonth() + 1, 10);
      break;
    }
  }

  return deadline.toISOString().substring(0, 10);  // ⚠️ タイムゾーン問題あり
}
```

#### 2.3 ProceduresServiceでの使用

**ファイル**: `src/app/services/procedures.service.ts`

**listByDeadlineメソッド** (106-107行目):
```typescript
const now = new Date().toISOString().substring(0, 10);  // ⚠️ タイムゾーン問題あり
const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
```

### 問題点

**`toISOString().substring(0, 10)`の使用によるタイムゾーン問題**:
- `toISOString()`はUTC基準のため、JST（日本時間）で日付を扱う場合に日付がズレる可能性がある
- 例：JSTの`2025-12-06 01:00`は、UTCだと`2025-12-05 16:00` → `toISOString().substring(0,10)`は`2025-12-05`になる

### 結論

- **フォーマット**: `YYYY-MM-DD`形式の文字列として保存されている ✅
- **タイムゾーン**: JST（日本時間）を前提としているが、現在の実装では`toISOString()`を使用しているため、タイムゾーン問題が発生する可能性がある ⚠️
- **Phase3-14での対応**: JSTでのローカル日付を直接文字列として生成するヘルパー関数を作成する必要がある

---

## 3. PENDING_PROCEDURE_STATUSES と status 値の対応確認

### 現在のstatus値

`ProcedureStatus`型は以下の4つの値を持っています：
- `'not_started'`: 未着手
- `'in_progress'`: 準備中
- `'submitted'`: 提出済
- `'rejected'`: 差戻し

### 既存実装での未完了ステータスの扱い

**ファイル**: `src/app/services/procedures.service.ts` (116行目, 123行目)

```typescript
// listByDeadlineメソッド内
where('status', 'in', ['not_started', 'in_progress', 'rejected']),
```

**既存のフィルタ実装**: `src/app/pages/procedures/procedures.page.ts` (429-435行目)

```typescript
isOverdue(procedure: SocialInsuranceProcedure): boolean {
  if (procedure.status === 'submitted') {
    return false;  // 提出済は期限切れ判定から除外
  }
  const today = new Date().toISOString().substring(0, 10);
  return procedure.deadline < today;
}
```

### 結論

**未完了ステータス**: `'not_started'`, `'in_progress'`, `'rejected'`の3つで正しい ✅

- `'submitted'`（提出済）は期限管理の対象外
- 既存実装でも同じ3つのステータスを使用している
- Phase3-14の`PENDING_PROCEDURE_STATUSES`定義は既存実装と一致している

---

## 4. 既存の日付ヘルパーの有無

### 確認結果

**既存の日付ヘルパー関数は存在しません。**

### 既存の日付関連ユーティリティ

**ファイル**: `src/app/utils/document-helpers.ts`

```typescript
/**
 * YYYY-MM-DD を「YYYY年M月D日」の表記に変換します。
 */
export function formatDate(value?: string | null): string {
  if (!value) {
    return '';
  }
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }
  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
}
```

**用途**: 表示用のフォーマット変換（`YYYY-MM-DD` → `YYYY年M月D日`）

### 結論

- **YYYY-MM-DD形式の文字列を生成するヘルパー関数は存在しない**
- Phase3-14では`src/app/utils/date-helpers.ts`を新規作成する必要がある
- 既存の`formatDate`は表示用なので、Phase3-14では使用しない

---

## 5. ProceduresService の現行実装

### ファイルパス
`src/app/services/procedures.service.ts`

### 主要メソッド

#### 5.1 listByDeadline メソッド

```typescript
listByDeadline(
  officeId: string,
  filter: 'upcoming' | 'overdue' | 'all'
): Observable<SocialInsuranceProcedure[]> {
  const ref = this.collectionPath(officeId);
  const now = new Date().toISOString().substring(0, 10);  // ⚠️ タイムゾーン問題
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  let q: Query;

  if (filter === 'upcoming') {
    q = query(
      ref,
      where('deadline', '>=', now),
      where('deadline', '<=', sevenDaysLater),
      where('status', 'in', ['not_started', 'in_progress', 'rejected']),
      orderBy('deadline', 'asc')
    );
  } else if (filter === 'overdue') {
    q = query(
      ref,
      where('deadline', '<', now),
      where('status', 'in', ['not_started', 'in_progress', 'rejected']),
      orderBy('deadline', 'asc')
    );
  } else {
    q = query(ref, orderBy('deadline', 'asc'));
  }

  return collectionData(q, { idField: 'id' }) as Observable<SocialInsuranceProcedure[]>;
}
```

**特徴**:
- `upcoming`: 7日以内の期限が近い手続き（未完了のみ）
- `overdue`: 期限切れの手続き（未完了のみ）
- 未完了ステータスはハードコードされている（`['not_started', 'in_progress', 'rejected']`）

#### 5.2 list メソッド

```typescript
list(
  officeId: string,
  filters?: {
    status?: ProcedureStatus;
    procedureType?: ProcedureType;
  }
): Observable<SocialInsuranceProcedure[]> {
  const ref = this.collectionPath(officeId);
  const constraints: QueryConstraint[] = [];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters?.procedureType) {
    constraints.push(where('procedureType', '==', filters.procedureType));
  }

  constraints.push(orderBy('deadline', 'asc'));

  const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref, orderBy('deadline', 'asc'));

  return collectionData(q, { idField: 'id' }) as Observable<SocialInsuranceProcedure[]>;
}
```

### 結論

- **既存の`listByDeadline`メソッドを活用可能**
- Phase3-14では、`listThisWeekDeadlines`と`listNextWeekDeadlines`を新規追加
- `countThisWeekDeadlines`と`countOverdueDeadlines`は、既存の`listByDeadline`や新規メソッドを利用して実装可能
- 未完了ステータスは`PENDING_PROCEDURE_STATUSES`定数を使用するように統一する

---

## 6. /procedures ページの現行実装

### ファイルパス
`src/app/pages/procedures/procedures.page.ts`

### 既存のフィルタ実装

#### 6.1 フィルタの定義

```typescript
readonly statusFilter$ = new BehaviorSubject<ProcedureStatus | 'all'>('all');
readonly deadlineFilter$ = new BehaviorSubject<'all' | 'upcoming' | 'overdue'>('all');
readonly procedureTypeFilter$ = new BehaviorSubject<ProcedureType | 'all'>('all');
```

#### 6.2 データソースの合成

```typescript
readonly procedures$ = combineLatest([
  this.currentOffice.officeId$,
  this.statusFilter$,
  this.deadlineFilter$,
  this.procedureTypeFilter$
]).pipe(
  switchMap(([officeId, statusFilter, deadlineFilter, procedureTypeFilter]) => {
    if (!officeId) return of([]);

    if (deadlineFilter !== 'all') {
      return this.proceduresService.listByDeadline(officeId, deadlineFilter).pipe(
        map((procedures) => {
          let filtered = procedures;
          if (statusFilter !== 'all') {
            filtered = filtered.filter((p) => p.status === statusFilter);
          }
          if (procedureTypeFilter !== 'all') {
            filtered = filtered.filter((p) => p.procedureType === procedureTypeFilter);
          }
          return filtered;
        })
      );
    }

    const filters: { status?: ProcedureStatus; procedureType?: ProcedureType } = {};
    if (statusFilter !== 'all') {
      filters.status = statusFilter;
    }
    if (procedureTypeFilter !== 'all') {
      filters.procedureType = procedureTypeFilter;
    }
    return this.proceduresService.list(officeId, Object.keys(filters).length > 0 ? filters : undefined);
  })
);
```

#### 6.3 ViewModel合成（従業員名・被扶養者名の結合）

```typescript
readonly proceduresWithNames$ = combineLatest([
  this.procedures$,
  this.employees$,
  this.currentOffice.officeId$
]).pipe(
  switchMap(([procedures, employees, officeId]) => {
    // ... 従業員名・被扶養者名を結合するロジック ...
  })
);
```

### テンプレート構造

**フィルタセクション** (56-92行目):
```html
<div class="filters">
  <mat-form-field appearance="outline">
    <mat-label>ステータス</mat-label>
    <mat-select [value]="statusFilter$.value" (selectionChange)="statusFilter$.next($event.value)">
      <!-- オプション -->
    </mat-select>
  </mat-form-field>

  <mat-form-field appearance="outline">
    <mat-label>期限</mat-label>
    <mat-select [value]="deadlineFilter$.value" (selectionChange)="deadlineFilter$.next($event.value)">
      <mat-option value="all">すべて</mat-option>
      <mat-option value="upcoming">期限が近い（7日以内）</mat-option>
      <mat-option value="overdue">期限切れ</mat-option>
    </mat-select>
  </mat-form-field>

  <mat-form-field appearance="outline">
    <mat-label>手続き種別</mat-label>
    <!-- オプション -->
  </mat-form-field>
</div>
```

**テーブル表示** (94-150行目):
```html
<div *ngIf="proceduresWithNames$ | async as procedures; else loading">
  <div class="table-container" *ngIf="procedures.length > 0; else empty">
    <table mat-table [dataSource]="procedures" class="procedures-table">
      <!-- 列定義 -->
    </table>
  </div>
</div>
```

### 結論

- **既存のフィルタ実装パターンを踏襲する**
- Phase3-14では、`deadlineView$`を追加し、既存の`deadlineFilter$`とは別に管理する
- 期限別ビューと既存フィルタの組み合わせは、クライアント側で`map`を使用して実装する（既存パターンと同じ）
- `proceduresWithNames$`の合成ロジックは再利用可能

---

## 7. /dashboard ページの現行実装

### ファイルパス
`src/app/pages/dashboard/dashboard.page.ts`

### 既存の統計カード構造

**テンプレート** (37-105行目):
```html
<div class="dashboard-grid">
  <mat-card class="stat-card">
    <div class="stat-icon" style="background: #e3f2fd;">
      <mat-icon style="color: #1976d2;">people</mat-icon>
    </div>
    <div class="stat-content">
      <h3>従業員数</h3>
      <p class="stat-value">{{ insuredEmployeeCount() }}人</p>
      <p class="stat-label">社会保険加入者</p>
    </div>
  </mat-card>

  <mat-card class="stat-card">
    <!-- 月次保険料 -->
  </mat-card>

  <mat-card class="stat-card">
    <!-- トレンド -->
  </mat-card>

  <mat-card class="stat-card">
    <!-- 今月納付予定の社会保険料 -->
  </mat-card>
</div>
```

### 既存のObservable定義

```typescript
readonly officeId$ = this.currentOffice.officeId$;

readonly employeeCount = signal<number | null>(null);
readonly insuredEmployeeCount = signal<number | null>(null);
readonly currentMonthTotalEmployer = signal<number | null>(null);
readonly previousMonthTotalEmployer = signal<number | null>(null);
```

### ProceduresServiceの使用状況

**確認結果**: 現在、`ProceduresService`は使用されていません。

### 結論

- **既存の統計カードパターンを踏襲する**
- Phase3-14では、`thisWeekDeadlinesCount$`と`overdueDeadlinesCount$`のObservableを追加
- 既存の`dashboard-grid`に新しいカードを追加する
- カードのクリックイベントで`/procedures`に遷移する機能を実装する

---

## まとめとPhase3-14実装への影響

### 1. 型定義
- ✅ `SocialInsuranceProcedure`型は既に定義済み
- ✅ `deadline`は`string`型（`YYYY-MM-DD`形式）
- ✅ `status`は4つの値（`'not_started'`, `'in_progress'`, `'submitted'`, `'rejected'`）

### 2. 日付処理
- ⚠️ `toISOString().substring(0, 10)`のタイムゾーン問題がある
- ✅ Phase3-14でJST対応の日付ヘルパー関数を新規作成する必要がある

### 3. 未完了ステータス
- ✅ `PENDING_PROCEDURE_STATUSES`は`['not_started', 'in_progress', 'rejected']`で正しい
- ✅ 既存実装と一致している

### 4. ProceduresService
- ✅ `listByDeadline`メソッドが既に実装済み
- ✅ Phase3-14では新規メソッドを追加する形で実装可能

### 5. /proceduresページ
- ✅ 既存のフィルタ実装パターンを踏襲可能
- ✅ `deadlineView$`を追加して期限別ビューを実装可能

### 6. /dashboardページ
- ✅ 既存の統計カードパターンを踏襲可能
- ✅ `ProceduresService`は未使用なので、新規にインポートして使用可能

### 実装時の注意点

1. **日付ヘルパー関数の作成**: JST対応の`YYYY-MM-DD`文字列生成関数を新規作成
2. **既存コードの修正**: `procedure-deadline-calculator.ts`と`procedures.service.ts`の`toISOString()`使用箇所を修正（オプション、Phase3-14の範囲外でも可）
3. **PENDING_PROCEDURE_STATUSES定数の追加**: `types.ts`に定数を追加し、既存のハードコードを置き換える（オプション）
4. **Firestoreインデックス**: コンポジットインデックスの作成が必要

---

以上

