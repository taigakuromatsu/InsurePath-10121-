# Phase3-16 実装指示書：従業員新規作成後の扶養家族登録誘導UX

## 概要
従業員を新規登録した後、実務的なフローとして「続けて扶養家族を登録したい」というニーズに対応するため、作成直後にスナックバーで誘導を行い、ワンクリックで詳細ダイアログの扶養家族セクションへ遷移できる機能を実装します。

## 変更対象ファイル
1. `src/app/services/employees.service.ts`
2. `src/app/pages/employees/employee-form-dialog.component.ts`
3. `src/app/pages/employees/employees.page.ts`

※ `employee-detail-dialog.component.ts` は既存の `focusSection` 機能を利用するため、変更不要と判断しました。

---

## 1. `EmployeesService` の改修

`save` メソッドが作成/更新したドキュメントの ID を返すように変更します。

### `src/app/services/employees.service.ts`

- `save` メソッドの戻り値を `Promise<void>` から `Promise<string>` に変更します。
- メソッドの最後で `return ref.id;` を行い、保存したドキュメントの ID を返却します。
- **注意**: もし `IEmployeesService` のようなインターフェースが定義されている場合は、そちらの戻り値型も `Promise<string>` に合わせて更新してください。

```typescript
// 変更前
async save(officeId: string, employee: Partial<Employee> & { id?: string }): Promise<void> {
  // ...
  await setDoc(ref, processedPayload, { merge: true });
}

// 変更後
async save(officeId: string, employee: Partial<Employee> & { id?: string }): Promise<string> { // 戻り値を変更
  // ...
  await setDoc(ref, processedPayload, { merge: true });
  return ref.id; // IDを返す（新規作成時も更新時も ref.id が正しいIDを返す）
}
```

**補足**: 
- 新規作成時: `ref = doc(collectionRef)` → `ref.id` は新しく生成されたID
- 更新時: `ref = doc(collectionRef, employee.id)` → `ref.id` は既存のID
- どちらの場合も `ref.id` は正しい従業員IDを返すため、この実装で問題ありません。
- **既存コードへの影響**: 既存のコードで `await this.employeesService.save(...);` のように戻り値を使っていない呼び出しがあっても、そのままでもコンパイル・動作に問題はありません（戻り値の `string` を単に使っていないだけです）。すべての呼び出し元を書き換える必要はありません。

---

## 2. `EmployeeFormDialogComponent` の改修

ダイアログを閉じる際に、新規作成された従業員の ID とモード（作成/更新）を呼び出し元に伝えます。

### `src/app/pages/employees/employee-form-dialog.component.ts`

- `submit` メソッド内で `this.employeesService.save` の戻り値（ID）を受け取ります。
- `dialogRef.close()` に渡すオブジェクトを拡張します。

```typescript
// 戻り値の型定義イメージ（明示的な型定義は不要ですが、この構造を返します）
// { saved: boolean; mode: 'created' | 'updated'; employeeId: string }

async submit(): Promise<void> {
  // ... バリデーションチェックなど ...

  try {
    // IDを受け取る
    const savedId = await this.employeesService.save(this.data.officeId, payload);
    
    // ... 標準報酬月額の自動履歴追加など ...
    // 注意: もし標準報酬履歴追加などで employeeId を参照している処理があれば、
    // 新規作成時でも savedId を使えば一意に紐付けられる想定です。
    // 既存コードで this.data.employee?.id を使っている場合は、savedId に置き換えることを検討してください。

    // 新規作成か更新かを判定 (this.data.employee があれば更新、なければ新規)
    const mode = this.data.employee ? 'updated' : 'created';

    // 結果を返して閉じる
    this.dialogRef.close({ 
      saved: true, 
      mode, 
      employeeId: savedId 
    });
  } catch (error) {
    // ... エラーハンドリング ...
  }
}
```

**重要: 他の呼び出し元の確認**
- 現在、`employee-form-dialog` を開いているのは `employees.page.ts` の `openDialog` メソッドのみの想定ですが、実装前に以下を確認してください：
  - 他のページやコンポーネントからも `EmployeeFormDialogComponent` を開いていないか
  - もし他の呼び出し元があれば、そちらも `result?.saved` 形式で結果を受け取るように修正が必要です
  - 既存のコードが `dialogRef.close(true)` / `dialogRef.close(false)` のような形式で返していた場合、すべての呼び出し元で `result?.saved` 形式に変更する必要があります

---

## 3. `EmployeesPage` の改修

従業員一覧ページでダイアログの結果を受け取り、新規作成時のみスナックバーを表示して誘導を行います。

### `src/app/pages/employees/employees.page.ts`

- `openDialog` メソッド内の `dialogRef.afterClosed()` の処理を拡張します。
- `result.mode === 'created'` の場合のみ、誘導スナックバーを表示します。
- 「登録する」アクションがクリックされた場合、その従業員の詳細ダイアログを「扶養家族セクション」にフォーカスした状態で開きます。
- **重要**: スナックバーは新規作成時と更新時で分岐し、重複表示を避けます。

```typescript
// openDialog メソッド内

dialogRef.afterClosed().subscribe(async (result) => {
  if (!result?.saved) {
    return;
  }

  // 一覧再読み込み
  this.reload$.next();

  // ★ 新規作成時: 扶養家族登録への誘導スナックバーを表示
  if (result.mode === 'created' && result.employeeId) {
    const snackRef = this.snackBar.open(
      '従業員を作成しました。続けて扶養家族を登録しますか？',
      '登録する',
      { duration: 8000 }
    );

    // アクション（登録する）がクリックされたら詳細を開く
    snackRef.onAction().subscribe(async () => {
      const officeId = await firstValueFrom(this.officeId$);
      if (!officeId) return;

      // 最新の従業員データを取得
      // 注意: employeesService.get の戻り値型を確認してください
      // - Observable<Employee | null> の場合 → firstValueFrom を使用
      // - Promise<Employee | null> の場合 → await のみでOK
      const employee = await firstValueFrom(
        this.employeesService.get(officeId, result.employeeId)
      );

      if (employee) {
        // 既存の openDetailWithFocus メソッドを利用して、扶養家族セクション('dependents')を指定して開く
        // ※ openDetailWithFocus は EmployeeDetailDialogData の focusSection を設定してくれます
        this.openDetailWithFocus(employee, 'dependents');
      }
    });
  } else {
    // ★ 既存従業員の更新時: 従来の「保存しました」メッセージを表示
    this.snackBar.open('従業員情報を保存しました', '閉じる', {
      duration: 3000
    });
  }
});
```

**補足: `employeesService.get` の戻り値型について**
- 実装前に `employeesService.get` の戻り値型を確認してください
- `Observable<Employee | null>` の場合: `firstValueFrom(...)` を使用
- `Promise<Employee | null>` の場合: `await this.employeesService.get(...)` のみでOK（`firstValueFrom` は不要）

---

## 補足: `EmployeeDetailDialogComponent` について

既存の実装を確認したところ、すでに `EmployeeDetailDialogData` に `focusSection` プロパティがあり、これを受け取ると自動的に該当セクションへスクロールする機能（`scrollToSection`）が `ngAfterViewInit` で実装されています。

```typescript
export interface EmployeeDetailDialogData {
  employee: Employee;
  focusSection?: DialogFocusSection; // これが既に存在する
}
```

**型確認が必要な点**:
- `DialogFocusSection` は union 型として定義されています
- 実装前に `DialogFocusSection` の型定義を確認し、`'dependents'` が含まれていることを確認してください
- 既存のコードでは `DialogFocusSection = 'basic' | 'work' | 'insurance' | ... | 'dependents' | ...` のような形式になっているはずです
- `'dependents'` が含まれていれば、`this.openDetailWithFocus(employee, 'dependents')` の呼び出しで問題なく動作します

したがって、`EmployeeDetailDialogComponent` への修正（`initialTab` の追加など）は不要で、既存の `focusSection` に `'dependents'` を渡すだけで要件を満たせます。

