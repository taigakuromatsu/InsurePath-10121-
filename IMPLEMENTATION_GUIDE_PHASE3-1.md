# Phase3-1 実装指示書: 従業員一覧への最終更新者・最終更新日時表示追加

## 1. 概要

Phase3-1では、既に実装済みの「従業員情報の最終更新者・最終更新日時表示機能」を完成させます。現在、データ保存と詳細画面での表示は実装済みですが、**従業員一覧画面にこれらの情報を表示する列を追加**することで、機能として完結させます。

一覧画面からも最終更新情報を確認できるようになることで、複数の従業員の更新状況を一覧で把握できるようになります。

---

## 2. 前提・ゴール

### 前提

- **最終更新情報の保存**: `Employee`型には`updatedAt`（`IsoDateString`型）と`updatedByUserId`（`string | undefined`型）が定義されており、`EmployeesService.save()`メソッドで`updatedAt`は自動設定されています。
- **詳細画面での表示**: `EmployeeDetailDialogComponent`の「システム情報」セクションで、`updatedAt`と`updatedByUserId`が表示されています（ただし、`updatedByUserId`はユーザーIDのまま表示されており、ユーザー名への変換は行われていません）。
- **データ取得**: 従業員一覧は`EmployeesService.list()`で取得されており、`Employee`型の全フィールド（`updatedAt`、`updatedByUserId`を含む）が取得可能です。

### ゴール

- 従業員一覧テーブルに「最終更新者」「最終更新日時」の2列を追加する
- 最終更新者名は、`updatedByUserId`から`users`コレクションの`displayName`を取得して表示する（取得できない場合は「-」または「不明」を表示）
- 最終更新日時は`YYYY-MM-DD HH:mm`形式で表示する
- 既存の機能（CSVエクスポート、インポート、フィルタリング、ソートなど）が壊れないこと
- レスポンシブ対応を考慮し、画面幅が狭い場合でもレイアウトが崩れないこと

---

## 3. 現状整理

### 3.0 実コード確認済み事項（2025-11-28時点）

以下の事項は実コードを確認済みです。実装時はこれらの情報を前提として進めてください。

- ✅ **型定義**: `IsoDateString`型は`src/app/types.ts`で`export type IsoDateString = string;`として定義されています
- ✅ **フィールド名**: `Employee`型に`updatedByUserId?: string;`が正しく定義されています
- ✅ **サービス実装**: `EmployeesService.save()`メソッド内で`updatedByUserId`の条件付き保存（`if (employee.updatedByUserId != null) ...`）が実装されています
- ✅ **CurrentUserService**: `profile$`は`UserProfile | null`型を返し、`UserProfile.id`は`string`型です（`uid`ではありません）
- ✅ **テンプレート構成**: `employees.page.ts`はインラインテンプレート（`template: `）を使用しており、別ファイルの`.html`は存在しません

### 3.1 Employee型の定義

`src/app/types.ts`に定義されている`Employee`型には、以下のフィールドが含まれています：

```typescript
export interface Employee {
  // ... 他のフィールド ...
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  updatedByUserId?: string;
}
```

**確認済み**:
- `IsoDateString`型は`src/app/types.ts`で`export type IsoDateString = string;`として定義されています
- `updatedByUserId`のフィールド名は正しく、`Employee`型に`updatedByUserId?: string;`として定義されています

- `updatedAt`: 最終更新日時（ISO 8601形式の文字列、例: `"2024-11-28T12:34:56.789Z"`）
- `updatedByUserId`: 最終更新を行ったユーザーのID（`users`コレクションのドキュメントID）

### 3.2 最終更新情報の保存ロジック

`src/app/services/employees.service.ts`の`save()`メソッドでは、以下のように`updatedAt`が自動設定されています：

```typescript
async save(
  officeId: string,
  employee: Partial<Employee> & { id?: string }
): Promise<void> {
  // ...
  const now = new Date().toISOString();
  const payload: Employee = {
    // ...
    updatedAt: now
  };
  // ...
  if (employee.updatedByUserId != null) payload.updatedByUserId = employee.updatedByUserId;
  // ...
}
```

**確認済み**: `EmployeesService.save()`メソッドでは、`updatedByUserId`の条件付き代入（`if (employee.updatedByUserId != null) payload.updatedByUserId = employee.updatedByUserId;`）が実装されています。

**注意**: `updatedByUserId`は、`employee`オブジェクトに含まれている場合のみ保存されます。現在、`EmployeeFormDialogComponent`では`updatedByUserId`を明示的に設定していないため、**フォーム保存時に`updatedByUserId`を設定する必要があります**。

**設計メモ**: 本来は、`updatedByUserId`はサーバー側（Firebase Functions）やサービス層で`request.auth.uid`から自動設定する方がセキュリティ上望ましい設計です。ただし、現時点ではInsurePathはFirebase Functionsを使用していないため、短期的にはフォーム側で設定する実装とします。将来的にFirebase Functionsを導入する際は、`updatedByUserId`の設定をサーバー側に移行することを推奨します。

### 3.3 詳細ダイアログでの表示

`src/app/pages/employees/employee-detail-dialog.component.ts`のテンプレート内、「システム情報」セクションで以下のように表示されています：

```html
<div class="label">更新日時</div>
<div class="value">{{ data.employee.updatedAt || '-' }}</div>

<div class="label">更新ユーザーID</div>
<div class="value">{{ data.employee.updatedByUserId || '-' }}</div>
```

- `updatedAt`はそのまま表示（ISO形式のまま）
- `updatedByUserId`はユーザーIDのまま表示されており、ユーザー名への変換は行われていない

### 3.4 従業員一覧画面の構造

`src/app/pages/employees/employees.page.ts`で実装されています。

**確認済み**: `employees.page.ts`はインラインテンプレート（`template: `で始まる）を使用しており、別ファイルの`.html`は存在しません。

- **テーブル実装**: Angular Material Table（`MatTableModule`）を使用
- **データソース**: `employees$` Observable（`EmployeesService.list()`から取得）
- **列定義**: `displayedColumns`配列で列を定義
  - 現在の列: `['name', 'department', 'address', 'weeklyWorkingHours', 'weeklyWorkingDays', 'isStudent', 'monthlyWage', 'dependents', 'isInsured', 'workingStatus', 'actions']`
- **テンプレート**: インラインで定義されており、`matColumnDef`ディレクティブで各列を定義

### 3.5 ユーザー名解決ロジック

現状、**ユーザーIDからユーザー名（`displayName`）への変換を行う既存のサービスやヘルパーは存在しません**。

**確認済み**:
- `CurrentUserService`は存在し、`profile$` Observableは`UserProfile | null`型を返します
- `UserProfile`型には`id: string`フィールドが定義されています（`uid`ではなく`id`）
- `users`コレクションには`UserProfile`型のデータが保存されており、`displayName`フィールドが含まれています
- `CurrentUserService`は現在のユーザーのプロファイルを取得できますが、任意のユーザーIDからユーザー名を取得する機能はありません

**実装方針**: 
- 一覧表示時に、各従業員の`updatedByUserId`から`users`コレクションを参照して`displayName`を取得する必要があります
- パフォーマンスを考慮し、複数のユーザーIDを一度に取得できるヘルパー関数またはサービスメソッドを作成することを推奨します

---

## 4. 変更対象ファイル

以下のファイルを変更します：

1. **`src/app/pages/employees/employees.page.ts`**
   - ユーザー名解決のためのロジック追加
   - テーブル列定義の追加（`displayedColumns`に`updatedBy`と`updatedAt`を追加）

2. **`src/app/pages/employees/employees.page.ts`（テンプレート部分）**
   - Material Tableに「最終更新者」「最終更新日時」列を追加

3. **`src/app/pages/employees/employee-form-dialog.component.ts`**
   - フォーム保存時に`updatedByUserId`を設定するロジック追加（`CurrentUserService`から現在のユーザーIDを取得）

4. **（オプション）`src/app/services/users.service.ts`（新規作成）**
   - ユーザーIDからユーザー名を取得するヘルパーメソッドを提供するサービスを作成（再利用性を考慮）

---

## 5. 画面仕様（従業員一覧への表示仕様）

### 5.1 テーブルに追加する列

#### 列1: 最終更新者

- **列タイトル**: 「最終更新者」
- **表示内容**: 
  - `updatedByUserId`が存在する場合: `users`コレクションから取得した`displayName`を表示
  - `updatedByUserId`が存在しない、またはユーザーが見つからない場合: 「-」を表示
- **列キー**: `updatedBy`

#### 列2: 最終更新日時

- **列タイトル**: 「最終更新日時」
- **表示内容**: 
  - `updatedAt`が存在する場合: `YYYY-MM-DD HH:mm`形式で表示（例: `2024-11-28 12:34`）
  - `updatedAt`が存在しない場合: 「-」を表示
- **列キー**: `updatedAt`
- **フォーマット**: Angularの`DatePipe`を使用（`date`パイプ、フォーマット: `'yyyy-MM-dd HH:mm'`）

### 5.2 列の配置順序

既存の列の後に追加します：

```
['name', 'department', 'address', 'weeklyWorkingHours', 'weeklyWorkingDays', 'isStudent', 'monthlyWage', 'dependents', 'isInsured', 'workingStatus', 'updatedBy', 'updatedAt', 'actions']
```

### 5.3 レスポンシブ対応

- 画面幅が狭い場合（例: 768px以下）でも、テーブルが横スクロール可能な状態を維持する
- 必要に応じて、最終更新関連の列を省略するのではなく、テーブル全体を横スクロール可能にする方針を維持する
- 既存の`@media (max-width: 768px)`のスタイル定義を確認し、新しい列が適切に表示されることを確認する

### 5.4 既存のソート・フィルターとの関係

- **本リリースでは、最終更新関連の列をソート対象にしない**（将来的に追加する可能性はあるが、今回は表示のみ）
- 既存のフィルタリング機能（現在は実装されていないが、将来追加される可能性を考慮）への影響は最小限にする

---

## 6. 実装方針

### Step 1: ユーザー名解決のためのヘルパー関数またはサービスを作成（オプション）

**目的**: 複数のユーザーIDから一度にユーザー名を取得できるようにする

**実装内容**:
- `src/app/services/users.service.ts`を新規作成（または既存のサービスがあれば拡張）
- `getUserDisplayName(userId: string): Observable<string | null>`メソッドを追加
- または、`getUserDisplayNames(userIds: string[]): Observable<Map<string, string>>`メソッドを追加（パフォーマンス向上のため）

**実装イメージ**:
```typescript
@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly firestore: Firestore) {}

  /**
   * ユーザーIDからユーザー名（displayName）を取得
   * @param userId ユーザーID
   * @returns ユーザー名（見つからない場合はnull）
   */
  getUserDisplayName(userId: string): Observable<string | null> {
    if (!userId) {
      return of(null);
    }
    const ref = doc(this.firestore, 'users', userId);
    return from(getDoc(ref)).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }
        const data = snapshot.data() as UserProfile;
        return data.displayName ?? null;
      }),
      catchError(() => of(null))
    );
  }

  /**
   * 複数のユーザーIDから一度にユーザー名を取得
   * @param userIds ユーザーIDの配列
   * @returns ユーザーIDをキー、ユーザー名を値とするMap
   */
  getUserDisplayNames(userIds: string[]): Observable<Map<string, string>> {
    const uniqueIds = [...new Set(userIds.filter(id => id))];
    if (uniqueIds.length === 0) {
      return of(new Map());
    }

    const requests = uniqueIds.map(id => 
      this.getUserDisplayName(id).pipe(
        map(name => ({ id, name }))
      )
    );

    return combineLatest(requests).pipe(
      map(results => {
        const map = new Map<string, string>();
        results.forEach(({ id, name }) => {
          if (name) {
            map.set(id, name);
          }
        });
        return map;
      })
    );
  }
}
```

**注意**: このステップはオプションです。`EmployeesPage`内で直接実装しても構いませんが、再利用性を考慮してサービス化することを推奨します。

### Step 2: 従業員フォームで`updatedByUserId`を設定

**目的**: 従業員情報を保存する際に、現在のユーザーIDを`updatedByUserId`として保存する

**対象ファイル**: `src/app/pages/employees/employee-form-dialog.component.ts`

**実装内容**:
1. `CurrentUserService`をインジェクト
2. `submit()`メソッド内で、現在のユーザーIDを取得して`payload`に追加

**実装イメージ**:
```typescript
export class EmployeeFormDialogComponent {
  // ... 既存のコード ...
  private readonly currentUser = inject(CurrentUserService);

  async submit(): Promise<void> {
    // ... 既存のバリデーション ...

    const formValue = this.form.getRawValue();
    
    // 現在のユーザーIDを取得
    // 注意: firstValueFrom は最初の1件で完了するため、take(1) は不要
    const currentUserId = await firstValueFrom(
      this.currentUser.profile$.pipe(
        map(profile => profile?.id ?? null)
      )
    );

    const payload: Partial<Employee> & { id?: string } = this.data.employee
      ? ({ 
          ...this.data.employee, 
          ...formValue,
          updatedByUserId: currentUserId ?? undefined
        } as unknown as Partial<Employee> & { id?: string })
      : ({ 
          ...formValue,
          updatedByUserId: currentUserId ?? undefined
        } as unknown as Partial<Employee> & { id?: string });

    try {
      await this.employeesService.save(this.data.officeId, payload);
      // ... 既存のコード ...
    }
  }
}
```

**必要なインポート**:
```typescript
import { CurrentUserService } from '../../services/current-user.service';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
```

**注意**: `firstValueFrom`は最初の1件で完了するため、`take(1)`は不要です。

### Step 3: 従業員一覧コンポーネントにユーザー名解決ロジックを追加

**対象ファイル**: `src/app/pages/employees/employees.page.ts`

**実装内容**:
1. `UsersService`（または直接Firestoreアクセス）をインジェクト
2. `employees$`から取得した従業員の`updatedByUserId`を収集
3. ユーザーIDからユーザー名を取得し、従業員データにマージしたObservableを作成

**実装イメージ**:
```typescript
export class EmployeesPage {
  // ... 既存のコード ...
  private readonly usersService = inject(UsersService); // Step 1で作成したサービス

  // 従業員データにユーザー名をマージしたObservable
  readonly employeesWithUserNames$ = this.employees$.pipe(
    switchMap(employees => {
      if (employees.length === 0) {
        return of([]);
      }

      // すべてのupdatedByUserIdを収集
      const userIds = employees
        .map(emp => emp.updatedByUserId)
        .filter((id): id is string => Boolean(id));

      if (userIds.length === 0) {
        return of(employees.map(emp => ({ ...emp, updatedByDisplayName: null })));
      }

      // ユーザー名を取得
      return this.usersService.getUserDisplayNames(userIds).pipe(
        map(userNameMap => {
          return employees.map(emp => ({
            ...emp,
            updatedByDisplayName: emp.updatedByUserId 
              ? (userNameMap.get(emp.updatedByUserId) ?? null)
              : null
          }));
        })
      );
    })
  );
}
```

**型定義の拡張**（推奨）:
```typescript
interface EmployeeWithUserName extends Employee {
  updatedByDisplayName: string | null;
}
```

**型の扱いに関する注意**:
- `employeesWithUserNames$`の型を`Observable<EmployeeWithUserName[]>`に明示的に指定することで、TypeScriptの型チェックがより厳密になります
- Material Tableがジェネリック型を強くチェックしている場合、テンプレート側で`employeesWithUserNames$`を使用する際に型エラーが発生する可能性があります
- その場合は、`employees$`を`employeesWithUserNames$`に差し替えるか、型アサーション（`as EmployeeWithUserName[]`）を使用してください
- 実装例:
```typescript
readonly employeesWithUserNames$: Observable<EmployeeWithUserName[]> = this.employees$.pipe(
  // ... 実装内容 ...
);
```

### Step 4: テーブルテンプレートに列を追加

**対象ファイル**: `src/app/pages/employees/employees.page.ts`（テンプレート部分）

**実装内容**:
1. `displayedColumns`配列に`'updatedBy'`と`'updatedAt'`を追加
2. Material Tableに2つの`ng-container matColumnDef`を追加

**実装イメージ**:
```typescript
readonly displayedColumns = [
  'name',
  'department',
  'address',
  'weeklyWorkingHours',
  'weeklyWorkingDays',
  'isStudent',
  'monthlyWage',
  'dependents',
  'isInsured',
  'workingStatus',
  'updatedBy',    // ★追加
  'updatedAt',    // ★追加
  'actions'
];
```

**テンプレート部分**:
```html
<!-- 最終更新者列 -->
<ng-container matColumnDef="updatedBy">
  <th mat-header-cell *matHeaderCellDef>最終更新者</th>
  <td mat-cell *matCellDef="let row">
    {{ row.updatedByDisplayName || '-' }}
  </td>
</ng-container>

<!-- 最終更新日時列 -->
<ng-container matColumnDef="updatedAt">
  <th mat-header-cell *matHeaderCellDef>最終更新日時</th>
  <td mat-cell *matCellDef="let row">
    {{ row.updatedAt ? (row.updatedAt | date: 'yyyy-MM-dd HH:mm') : '-' }}
  </td>
</ng-container>
```

**テーブルのデータソース変更**:
```html
<table
  mat-table
  [dataSource]="(employeesWithUserNames$ | async) || []"
  class="employee-table"
>
```

**必要なインポート**:
```typescript
import { DatePipe } from '@angular/common';
```

**注意**: `DatePipe`は`employees.page.ts`の`imports`配列に既に含まれているか確認してください。含まれていない場合は追加が必要です。

### Step 5: スタイル調整（必要に応じて）

**対象ファイル**: `src/app/pages/employees/employees.page.ts`（`styles`配列）

**実装内容**:
- 新しい列の幅や配置が適切か確認
- レスポンシブ対応が維持されているか確認
- 必要に応じて、最終更新日時列の幅を調整（日時表示は長いため）

**実装イメージ**（必要に応じて）:
```typescript
styles: [
  `
    /* 既存のスタイル ... */

    /* 最終更新日時列の幅を調整（オプション） */
    table.employee-table th[mat-header-cell]:nth-last-child(3),
    table.employee-table td[mat-cell]:nth-last-child(3) {
      min-width: 140px; /* 最終更新者列 */
    }

    table.employee-table th[mat-header-cell]:nth-last-child(2),
    table.employee-table td[mat-cell]:nth-last-child(2) {
      min-width: 160px; /* 最終更新日時列 */
    }
  `
]
```

### Step 6: 既存機能への影響確認

**確認項目**:
1. **CSVエクスポート**: `CsvExportService.exportEmployees()`が新しい列を含めないことを確認（既存のCSV形式を維持）
2. **CSVインポート**: 新しい列がインポート処理に影響しないことを確認
3. **フィルタリング**: 既存のフィルタリング機能（現在は実装されていないが）が動作することを確認
4. **ソート**: 既存のソート機能（現在は実装されていないが）が動作することを確認

**注意**: CSVエクスポートに新しい列を追加する場合は、別途仕様を確認してください。今回は一覧表示のみを追加するため、CSVエクスポートには影響しない想定です。

---

## 7. テスト観点

Phase3-1完了判定のためのテスト観点チェックリスト：

### 7.1 基本機能のテスト

- [ ] **既存の従業員を編集すると、一覧の「最終更新者」「最終更新日時」が期待通りに更新される**
  - テスト手順:
    1. 従業員一覧画面を開く
    2. 既存の従業員を編集し、保存する
    3. 一覧画面に戻り、該当従業員の「最終更新者」が現在のユーザー名、「最終更新日時」が現在の日時（おおよそ）になっていることを確認

- [ ] **新規作成した従業員について、一覧に最終更新情報が正しく反映される**
  - テスト手順:
    1. 従業員一覧画面から新規従業員を追加する
    2. 一覧画面に戻り、新規追加した従業員の「最終更新者」が現在のユーザー名、「最終更新日時」が現在の日時（おおよそ）になっていることを確認

- [ ] **最終更新情報が未設定の既存レコードがある場合でも、一覧画面の表示が崩れず、「-」などのフォールバック表示になる**
  - テスト手順:
    1. `updatedAt`または`updatedByUserId`が未設定の従業員レコードが存在する場合、一覧画面で「-」が表示されることを確認
    2. エラーが発生しないことを確認

### 7.2 ユーザー名解決のテスト

- [ ] **`updatedByUserId`が存在する場合、正しいユーザー名が表示される**
  - テスト手順:
    1. `updatedByUserId`が設定されている従業員を編集する
    2. 一覧画面で、該当ユーザーの`displayName`が正しく表示されることを確認

- [ ] **`updatedByUserId`が存在しない、またはユーザーが見つからない場合、「-」が表示される**
  - テスト手順:
    1. `updatedByUserId`が未設定、または存在しないユーザーIDが設定されている従業員について、一覧画面で「-」が表示されることを確認
    2. エラーが発生しないことを確認

### 7.3 日時フォーマットのテスト

- [ ] **`updatedAt`が存在する場合、`YYYY-MM-DD HH:mm`形式で正しく表示される**
  - テスト手順:
    1. `updatedAt`が設定されている従業員について、一覧画面で日時が正しい形式で表示されることを確認
    2. タイムゾーンの違いによる表示のズレがないことを確認（必要に応じて）

- [ ] **`updatedAt`が存在しない場合、「-」が表示される**
  - テスト手順:
    1. `updatedAt`が未設定の従業員について、一覧画面で「-」が表示されることを確認

### 7.4 権限・アクセス制御のテスト

- [ ] **権限のないユーザー（employeeロールなど）でも一覧画面がエラーにならず、想定どおりに表示される**
  - テスト手順:
    1. `employee`ロールでログインし、従業員一覧画面を開く
    2. エラーが発生せず、最終更新情報が正しく表示されることを確認（閲覧権限がある場合）

### 7.5 レスポンシブ対応のテスト

- [ ] **スマホ幅相当の画面でもレイアウト崩れが致命的でないこと**
  - テスト手順:
    1. ブラウザの開発者ツールで画面幅を768px以下に設定
    2. 従業員一覧画面を開き、テーブルが横スクロール可能であることを確認
    3. 新しい列が適切に表示されることを確認

### 7.6 既存機能への影響のテスト

- [ ] **CSVエクスポート機能が正常に動作する**
  - テスト手順:
    1. 従業員一覧画面からCSVエクスポートを実行
    2. エクスポートされたCSVファイルが正常にダウンロードされることを確認
    3. CSVファイルの内容が既存の形式と一致していることを確認（新しい列が追加されていないことを確認）

- [ ] **CSVインポート機能が正常に動作する**
  - テスト手順:
    1. 既存のCSVファイルをインポートする
    2. インポートが正常に完了することを確認
    3. 一覧画面で最終更新情報が正しく表示されることを確認

- [ ] **従業員の追加・編集・削除機能が正常に動作する**
  - テスト手順:
    1. 従業員の追加・編集・削除を実行
    2. 各操作が正常に完了することを確認
    3. 一覧画面で最終更新情報が正しく更新されることを確認

---

## 8. 注意事項・今後の拡張余地

### 8.1 既存機能を壊さないための注意点

- **CSVエクスポート**: 新しい列をCSVエクスポートに含める場合は、別途仕様を確認してください。今回は一覧表示のみを追加するため、CSVエクスポートには影響しない想定です。
- **列キー名の変更**: 既存の列キー名（`name`、`department`など）を変更しないでください。CSVエクスポートやインポート処理が既存の列キーに依存している可能性があります。
- **型定義の変更**: `Employee`型の既存フィールドの型を変更しないでください。既存のコードが壊れる可能性があります。

### 8.2 パフォーマンスに関する注意点

- **ユーザー名解決の最適化**: 複数の従業員が同じユーザーによって更新されている場合、同じユーザーIDに対して複数回Firestoreアクセスが発生しないよう、`getUserDisplayNames()`のようなバッチ取得メソッドを使用することを推奨します。
- **キャッシュの検討**: ユーザー名は頻繁に変更されないため、将来的にキャッシュを導入することでパフォーマンスを向上させることができます。

### 8.3 今後の拡張余地

- **ソート機能**: 将来的に「最終更新日時」列をクリックしてソートできるようにする機能を追加することができます。
- **フィルタリング機能**: 「最終更新者」でフィルタリングできる機能を追加することができます。
- **CSVエクスポートへの追加**: 必要に応じて、CSVエクスポートに「最終更新者」「最終更新日時」列を追加することができます。この場合、`CsvExportService.exportEmployees()`を修正する必要があります。
- **詳細ダイアログでのユーザー名表示**: `EmployeeDetailDialogComponent`でも、`updatedByUserId`をユーザー名に変換して表示する機能を追加することができます。
- **サーバー側での`updatedByUserId`設定**: Firebase Functionsを導入する際は、`updatedByUserId`の設定をサーバー側（`request.auth.uid`から自動設定）に移行することで、セキュリティを向上させることができます。

---

## 9. 実装完了の判定基準

以下の条件をすべて満たした場合、Phase3-1は完了とみなします：

1. ✅ 従業員一覧テーブルに「最終更新者」「最終更新日時」列が追加されている
2. ✅ 最終更新者名が正しく表示される（ユーザーIDからユーザー名への変換が機能している）
3. ✅ 最終更新日時が`YYYY-MM-DD HH:mm`形式で正しく表示される
4. ✅ 既存の機能（CSVエクスポート、インポート、追加・編集・削除）が正常に動作する
5. ✅ テスト観点のチェックリストの主要項目（7.1〜7.3）がすべてクリアされている

---

以上でPhase3-1の実装指示書は完了です。実装時は、この指示書に従って段階的に実装を進めてください。

