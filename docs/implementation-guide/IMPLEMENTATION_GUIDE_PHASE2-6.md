# Phase2-6 実装指示書: 標準報酬履歴の自動追加（従業員フォーム連動）

## 📋 概要

Phase2-5で「標準報酬決定・改定履歴管理機能（手動CRUD）」を実装済みです。ここから一歩進めて、**従業員フォームで標準報酬月額を変更したときに履歴を自動追加する機能**を実装します。

**目的**: 
- 従業員編集フォームで`monthlyWage`を変更した際に、標準報酬履歴を自動で1行追加する
- 人事担当者の入力忘れ・付け忘れによる「履歴抜け」リスクを軽減する
- 既存の手動履歴追加・編集・削除機能は引き続き利用可能（ハイブリッド運用）
- 既存の月次保険料計算やマイページ表示の挙動は変えない

**このフェーズで達成したいゴール**:
- 従業員**編集**で`monthlyWage`が元の値から変わった場合のみ、自動で`StandardRewardHistory`を1行追加
- 「新規登録」は今回の自動追加対象外（初回の履歴は将来拡張か運用でカバー）
- 自動追加された履歴はPhase2-5のUIから編集・削除可能（ハイブリッド運用）
- テストで一時的に変更した履歴も一旦残るが、不要なら削除できる設計

**前提条件**:
- Phase2-5（標準報酬決定・改定履歴管理機能）が実装済み
- `StandardRewardHistoryService`が実装済み
- `employee-form-dialog.component.ts`が実装済み
- `EmployeesService.save()`が実装済み

---

## 🎯 目的・このフェーズで達成したいゴール

### 主な目的

1. **履歴の自動記録**
   - 従業員編集フォームで標準報酬月額を変更した際に、履歴が自動で記録される
   - 人事担当者が手動で履歴を追加する手間を削減する

2. **履歴抜けの防止**
   - 標準報酬変更時に履歴を付け忘れるリスクを軽減する
   - 変更履歴の完全性を向上させる

3. **ハイブリッド運用の実現**
   - 自動追加された履歴と手動追加された履歴が共存できる
   - 自動追加された履歴も後から編集・削除可能（運用の柔軟性を確保）

4. **既存機能への影響を最小限に**
   - 月次保険料計算ロジックは変更しない
   - マイページ表示は変更しない
   - `employees.monthlyWage`は引き続き「現在利用中の標準報酬月額」として扱う

### このフェーズで達成したいゴール

- ✅ 従業員編集フォームで`monthlyWage`を変更して保存した際に、履歴が自動で1行追加される
- ✅ 新規登録時は自動追加しない（初回の履歴は将来拡張か運用でカバー）
- ✅ `monthlyWage`を変更せずに保存した場合は履歴が増えない
- ✅ 自動追加された履歴はPhase2-5のUIから編集・削除可能
- ✅ 既存の手動履歴追加・編集・削除機能が引き続き正しく動作する
- ✅ 月次保険料計算やマイページ表示に影響がない

---

## 🧭 スコープ

### 対象とする機能・ファイル（Phase2-6の実装対象）

#### UI（admin / hr 向け）
- `src/app/pages/employees/employee-form-dialog.component.ts` - 従業員編集時の自動履歴追加ロジック追加

#### サービス層
- `StandardRewardHistoryService` - 既存の実装を再利用（必要なら軽微なhelper追加のみ）

### 対象外とするもの

以下の機能はPhase2-6では対象外とします：
- **新規登録時の初回標準報酬履歴自動生成**（将来の拡張として検討）
- **履歴レコードから`employees.monthlyWage`への自動反映機能**（「現在適用として反映」チェック機能は将来の拡張として検討）
- **決定区分（`decisionKind`）の自動判定**（定時決定 / 随時改定など。Phase2-6では一律`'other'`を使用）
- **等級・標準報酬月額フィールドの自動設定**（`healthGrade`/`pensionGrade`など。Phase2-6では`note`フィールドに自動追加であることを明記するのみ）
- マイページでの標準報酬履歴表示（Phase2-5で対象外とし、Phase2-6でも対象外）
- 履歴データからの保険料再計算機能（将来の拡張として検討）

---

## 📝 現状の挙動と課題（Before）

### 1. 従業員フォームでの標準報酬月額変更

**現状の挙動**:
- `employee-form-dialog.component.ts`で`monthlyWage`を編集可能
- 保存時に`EmployeesService.save()`が呼ばれ、`employees.monthlyWage`が更新される
- 標準報酬履歴は自動では追加されない
- 履歴を追加するには、従業員詳細ダイアログの「標準報酬履歴」セクションから手動で追加する必要がある

**課題**:
- フォームで`monthlyWage`を変えても履歴が自動では残らない
- 人事担当者の入力忘れ・付け忘れによる「履歴抜け」リスクがある
- 標準報酬変更の記録を完全に残すためには、毎回手動で履歴を追加する必要がある

### 2. 標準報酬履歴管理の現状

**現状の挙動**:
- Phase2-5で実装された手動CRUD機能が利用可能
- 従業員詳細ダイアログの「標準報酬履歴」セクションから履歴を追加・編集・削除できる
- 履歴は時系列順（決定年月の降順）で表示される

**課題**:
- 手動追加のみの運用では、変更時に履歴を付け忘れる可能性がある
- 自動追加機能がないため、運用の負担が大きい

### 3. テスト運用での課題

**現状の挙動**:
- テスト用に一時的に`monthlyWage`を変更した場合も、履歴が残らない（または手動で追加する必要がある）

**課題**:
- テスト用の変更も履歴に残ってしまう可能性がある（自動追加される場合）
- 不要な履歴を削除する機能はPhase2-5で実装済みだが、運用面での注意が必要

---

## 🔄 仕様（Before / After）

### 1. 従業員フォームでの標準報酬月額変更

#### Before（現状）
- `monthlyWage`を変更して保存しても履歴は増えない
- 履歴を追加するには、従業員詳細ダイアログから手動で追加する必要がある

#### After（Phase2-6実装後）
- 従業員**編集**で`monthlyWage`が元の値から変わった場合のみ、自動で`StandardRewardHistory`を1行追加
- 「新規登録」は今回の自動追加対象外（初回の履歴は将来拡張か運用でカバー）
- 自動追加された履歴はPhase2-5のUIから編集・削除可能（ハイブリッド運用）

### 2. 自動追加の条件

#### 自動追加が実行される条件
1. **編集モードであること**（`data.employee`が存在する）
2. **元の`monthlyWage`が存在すること**（`originalMonthlyWage`が`undefined`ではない）
3. **`monthlyWage`が変更されていること**（フォーム値`form.value.monthlyWage`を`Number()`で数値化してから`originalMonthlyWage`と比較）
4. **従業員保存処理が成功したこと**（`EmployeesService.save()`が成功した後）

**補足**: フォーム値`form.value.monthlyWage`は文字列型で来る可能性があるため、`Number()`で数値化してから`originalMonthlyWage`と比較してください。

#### 自動追加が実行されない条件
- 新規登録時（`data.employee`が存在しない）
- `monthlyWage`が変更されていない場合
- 従業員保存処理が失敗した場合

### 3. 自動追加される履歴の内容

#### 自動追加時にセットするフィールドの具体仕様

- `employeeId`: 編集対象従業員のID（`data.employee.id`）
- `decisionYearMonth`: `new Date()`から求めた`YYYY-MM`形式（現在の年月）
- `appliedFromYearMonth`: 原則`decisionYearMonth`と同じ（運用で後から調整可能）
- `standardMonthlyReward`: 保存後の`monthlyWage`（`form.value.monthlyWage`）
- `decisionKind`: 自動追加の場合は一律`'other'`にする
- `note`: 例）`'従業員フォームで標準報酬月額が変更されたため自動登録'`（または空文字でも可）
- `createdAt` / `updatedAt` / `createdByUserId` / `updatedByUserId`: 詳細は「データモデル観点」の章を参照

---

## 🗂️ データモデル観点

### `StandardRewardHistory`型の利用

**Phase2-5のMVP版をそのまま利用**（型の追加・変更はしない）

```typescript
export interface StandardRewardHistory {
  id: string;
  employeeId: string;
  decisionYearMonth: YearMonthString;      // 決定年月（YYYY-MM形式）
  appliedFromYearMonth: YearMonthString;  // 適用開始年月（YYYY-MM形式）
  standardMonthlyReward: number;          // 標準報酬月額
  decisionKind: StandardRewardDecisionKind; // 決定区分（自動追加時は'other'）
  note?: string;                           // メモ（自動追加であることを明記可能）
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  createdByUserId?: string;
  updatedByUserId?: string;
}
```

### 自動追加時のフィールド設定例

```typescript
const autoHistory: Partial<StandardRewardHistory> = {
  employeeId: employee.id, // 含めても含めなくても可（サービス側で第2引数から設定される）
  decisionYearMonth: getCurrentYearMonth(), // 例: "2025-01"
  appliedFromYearMonth: getCurrentYearMonth(), // 例: "2025-01"
  standardMonthlyReward: newMonthlyWage, // 保存後の値
  decisionKind: 'other', // 自動追加時は一律'other'
  note: '従業員フォームで標準報酬月額が変更されたため自動登録' // 任意
};
```

**補足**: 
- `note`フィールドは任意ですが、自動追加であることを明示するために設定することを推奨します。運用で後から編集・削除する際の目安になります。
- `employeeId`は`StandardRewardHistoryService.save()`の第2引数`employeeId`から自動的に設定されるため、payloadに含めなくても動作します。ただし、将来の変更を考慮すると、含めても問題ありません。
- `createdAt`/`updatedAt`と`createdByUserId`/`updatedByUserId`は`StandardRewardHistoryService.save()`側で自動設定されます。新規作成時は`createdAt`と`updatedAt`の両方を現在時刻で設定し、`createdByUserId`と`updatedByUserId`を現在のユーザーIDで設定します。更新時は`updatedAt`のみ更新し、`createdAt`と`createdByUserId`は保持されます。呼び出し側ではこれらのフィールドを明示的に設定する必要はありません。

---

## 🎨 UI/UX設計

### 1. 自動追加のトリガー

**トリガー**: 「従業員編集フォーム → 保存」ボタンをクリックした際

**処理フロー**:
1. フォーム送信時、`originalMonthlyWage`と`form.value.monthlyWage`を比較
2. 変更があった場合、`EmployeesService.save()`を実行
3. 保存が成功した後、`StandardRewardHistoryService.save()`を呼び出して履歴を追加
4. ユーザーには明示的な通知は不要（バックグラウンドで自動実行）

### 2. UI上のヒント（任意）

**推奨案**: 標準報酬月額の入力欄の下に、`mat-hint`で以下のような一文を表示

```
標準報酬月額を変更すると、標準報酬履歴に自動で記録されます
```

**実装コスト**: 低（`mat-hint`を追加するだけ）
**優先度**: 中（Phase2-6の必須要件ではないが、推奨）

**表示条件**: ヒント文は**編集時のみ**表示する（`*ngIf="data.employee"`）。新規作成時は自動履歴対象外のため、混乱を避ける目的。

### 3. テスト用変更への対策

**問題点**:
- テスト用に一時的に変更した履歴も残ってしまう可能性がある

**対策**:
- 本番運用時は原則「テスト用事業所」で検証してから本番に反映
- どうしても気になる履歴は、Phase2-5で実装済みの削除機能で消せる（ハイブリッド運用）
- 自動追加された履歴は`note`フィールドに「自動登録」と明記されているため、識別しやすい

### 4. エラーハンドリング

**方針**:
- 従業員保存は成功したが、履歴追加が失敗した場合
  - エラーログを出力する（コンソールログで十分）
  - ユーザーには明示的なエラー通知は不要（履歴は後から手動で追加可能）
  - 従業員データの保存は成功しているため、業務への影響は最小限

**実装のポイント**:
- `StandardRewardHistoryService.save()`の呼び出しを`try-catch`で囲む
- エラーが発生しても、従業員保存処理の成功/失敗には影響しない

---

## 🔧 サービス層 / 実装設計（コードレベルの方針）

### `employee-form-dialog.component.ts`における具体的な方針

#### 1. 元の`monthlyWage`の保持

**実装方針**:
- ダイアログに渡ってくる`Employee`を基に`originalMonthlyWage`をプロパティとして保持
- コンストラクタまたは`ngOnInit`で`data.employee?.monthlyWage`を`originalMonthlyWage`に保存

```typescript
export class EmployeeFormDialogComponent {
  private originalMonthlyWage?: number;

  constructor(@Inject(MAT_DIALOG_DATA) public data: EmployeeDialogData) {
    if (data.employee) {
      this.originalMonthlyWage = data.employee.monthlyWage;
      // ... 既存のフォーム初期化処理
    }
  }
}
```

#### 2. フォーム送信時の処理

**実装方針**:
- `submit()`メソッド内で、以下の条件を満たす場合にのみ自動履歴追加を行う：
  1. 「編集モードであること」（`this.data.employee`が存在する）
  2. `originalMonthlyWage`が`undefined`ではないこと
  3. フォーム値`form.value.monthlyWage`を`Number()`で数値化してから`originalMonthlyWage`と比較し、値が変更されていること

**補足**: フォーム値`form.value.monthlyWage`は文字列型で来る可能性があるため、必ず`Number()`で数値化してから比較してください。

**疑似コード**:
```typescript
async submit(): Promise<void> {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  const formValue = this.form.value;
  
  // 従業員保存処理
  await this.employeesService.save(this.data.officeId, formValue);
  
  // 自動履歴追加の条件チェック
  const newMonthlyWage = Number(formValue.monthlyWage);
  if (
    this.data.employee && // 編集モード
    this.originalMonthlyWage !== undefined && // 元の値が存在
    newMonthlyWage !== this.originalMonthlyWage // 値が変更されている（数値で比較）
  ) {
    // 履歴を自動追加
    await this.addAutoHistory(newMonthlyWage);
  }
  
  this.dialogRef.close(formValue);
}

private async addAutoHistory(newMonthlyWage: number): Promise<void> {
  try {
    const currentYearMonth = this.getCurrentYearMonth(); // 例: "2025-01"
    
    await this.standardRewardHistoryService.save(
      this.data.officeId,
      this.data.employee!.id,
      {
        // employeeId は含めても含めなくても可（サービス側で第2引数から設定される）
        decisionYearMonth: currentYearMonth,
        appliedFromYearMonth: currentYearMonth,
        standardMonthlyReward: newMonthlyWage,
        decisionKind: 'other',
        note: '従業員フォームで標準報酬月額が変更されたため自動登録'
      }
    );
  } catch (error) {
    // エラーログを出力（ユーザーには通知しない）
    console.error('標準報酬履歴の自動追加に失敗しました:', error);
  }
}

private getCurrentYearMonth(): YearMonthString {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
```

#### 3. `StandardRewardHistoryService`の利用

**実装方針**:
- 既存の`StandardRewardHistoryService.save()`をそのまま利用
- 必要なら軽微なhelper関数（例: `getCurrentYearMonth()`）を追加するのみ

**補足**: `StandardRewardHistoryService.save()`の責務（`createdAt`/`updatedAt`と`createdByUserId`/`updatedByUserId`の自動設定など）については、「データモデル観点」の章を参照してください。

### 既存サービスとの関係

- `EmployeesService`: 従業員保存処理に使用（既存の実装をそのまま利用）
- `StandardRewardHistoryService`: 履歴追加処理に使用（既存の実装をそのまま利用）
- `CurrentUserService`: `StandardRewardHistoryService`内部で使用（Phase2-6では直接使用しない）

---

## 🔒 Firestoreルール

### 基本方針

**Phase2-5で追加したルールをそのまま利用する**

※ このルールブロックは Phase2-5 で既に追加済みのものを再掲しただけであり、Phase2-6 では変更不要です。

```javascript
match /offices/{officeId}/employees/{employeeId}/standardRewardHistories/{historyId} {
  // Read: admin/hrのみ閲覧可能
  allow read: if belongsToOffice(officeId) && isAdminOrHr(officeId);

  // Write: admin/hrのみ追加・編集・削除可能
  allow create, update, delete: if belongsToOffice(officeId) && isAdminOrHr(officeId);
}
```

### 自動追加に伴う懸念事項

**懸念**: 自動追加は`employee-form-dialog.component.ts`から実行されるため、ユーザーは`admin`または`hr`ロールであることが前提です。従業員保存処理（`EmployeesService.save()`）も同様に`admin`/`hr`のみが実行可能なため、自動履歴追加も同じ権限で実行されます。

**結論**: Phase2-5のルールで問題なく動作します。追加のルール変更は不要です。

---

## 🛠️ 実装ステップ

### Step 1: `employee-form-dialog.component.ts`の修正

**ファイル**: `src/app/pages/employees/employee-form-dialog.component.ts`

1. `StandardRewardHistoryService`を注入
2. `originalMonthlyWage`プロパティを追加
3. コンストラクタで`data.employee?.monthlyWage`を`originalMonthlyWage`に保存
4. `submit()`メソッドを修正
   - 従業員保存処理の後に、自動履歴追加の条件チェックを追加
   - 条件を満たす場合、`StandardRewardHistoryService.save()`を呼び出す
5. `getCurrentYearMonth()`ヘルパーメソッドを追加（必要に応じて）
6. エラーハンドリングを追加（`try-catch`で囲む）

**実装のポイント**:
- `submit()`メソッドは既に`async`であることを確認（そうでない場合は`async`に変更）
- 従業員保存処理が成功した**後**に履歴追加を行う
- 履歴追加が失敗しても、従業員保存処理の成功/失敗には影響しない

### Step 2: UI上のヒント追加（オプション）

**ファイル**: `src/app/pages/employees/employee-form-dialog.component.ts`

1. 標準報酬月額の入力欄の下に`mat-hint`を追加
   - 「標準報酬月額を変更すると、標準報酬履歴に自動で記録されます」という一文を表示

**実装のポイント**:
- `mat-hint`は`mat-form-field`内に配置
- 編集モード時のみ表示する（`*ngIf="data.employee"`）

### Step 3: 動作確認

1. 既存従業員の編集フォームを開き、`monthlyWage`を変更 → 保存
2. 従業員詳細ダイアログの「標準報酬履歴」セクションを開く
3. 直近の履歴が自動で1行追加されていることを確認
4. `monthlyWage`を変更せずに保存 → 履歴が増えないことを確認
5. 手動での履歴追加・編集・削除が引き続き正しく動作することを確認

---

## ✅ 受け入れ条件（テスト観点）

### 1. 基本機能のテスト

**テストケース1: 従業員編集で`monthlyWage`を変更した際に履歴が自動追加されること**
- 前提: admin または hr ロールでログインしている
- 手順:
  1. 既存従業員の編集フォームを開く
  2. `monthlyWage`を変更（例: 280,000 → 300,000）
  3. 「保存」ボタンをクリック
  4. 従業員詳細ダイアログの「標準報酬履歴」セクションを開く
- 期待結果:
  - 履歴が自動で1行追加されている
  - `decisionYearMonth`が現在の年月（例: "2025-01"）になっている
  - `appliedFromYearMonth`が現在の年月（例: "2025-01"）になっている
  - `standardMonthlyReward`が変更後の値（例: 300,000）になっている
  - `decisionKind`が`'other'`になっている
  - `note`に「従業員フォームで標準報酬月額が変更されたため自動登録」と記載されている（または空文字）

**テストケース2: `monthlyWage`を変更せずに保存した場合、履歴が増えないこと**
- 前提: admin または hr ロールでログインしている
- 手順:
  1. 既存従業員の編集フォームを開く
  2. `monthlyWage`を変更せずに「保存」ボタンをクリック
  3. 従業員詳細ダイアログの「標準報酬履歴」セクションを開く
- 期待結果:
  - 履歴が増えていない（既存の履歴のみが表示される）

**テストケース3: 新規登録時は履歴が自動追加されないこと**
- 前提: admin または hr ロールでログインしている
- 手順:
  1. 従業員新規登録フォームを開く
  2. `monthlyWage`を入力して「保存」ボタンをクリック
  3. 従業員詳細ダイアログの「標準報酬履歴」セクションを開く
- 期待結果:
  - 履歴が自動追加されていない（空の状態または既存の履歴のみが表示される）

### 2. ハイブリッド運用のテスト

**テストケース4: 自動追加された履歴を編集できること**
- 前提: admin または hr ロールでログインしている
- 手順:
  1. 従業員編集で`monthlyWage`を変更して保存（自動履歴追加）
  2. 従業員詳細ダイアログの「標準報酬履歴」セクションを開く
  3. 自動追加された履歴の「編集」ボタンをクリック
  4. 内容を変更して保存
- 期待結果:
  - 履歴が正常に更新される
  - 編集後の内容が履歴一覧に反映される

**テストケース5: 自動追加された履歴を削除できること**
- 前提: admin または hr ロールでログインしている
- 手順:
  1. 従業員編集で`monthlyWage`を変更して保存（自動履歴追加）
  2. 従業員詳細ダイアログの「標準報酬履歴」セクションを開く
  3. 自動追加された履歴の「削除」ボタンをクリック
  4. 確認ダイアログで「OK」をクリック
- 期待結果:
  - 履歴が正常に削除される
  - 履歴一覧からレコードが消える

**テストケース6: 手動での履歴追加・編集・削除が引き続き正しく動作すること**
- 前提: admin または hr ロールでログインしている
- 手順:
  1. 従業員詳細ダイアログの「標準報酬履歴」セクションを開く
  2. 「履歴を追加」ボタンをクリックして手動で履歴を追加
  3. 手動追加した履歴を編集・削除
- 期待結果:
  - 手動での履歴追加・編集・削除が正常に動作する
  - 自動追加された履歴と手動追加された履歴が共存できる

### 3. 既存機能の回帰テスト

**テストケース7: 月次保険料計算が従来通り動作すること**
- 前提: 標準報酬履歴を自動追加した後
- 手順:
  1. 月次保険料一覧ページを開く
  2. 対象年月を選択して計算・保存を実行
- 期待結果:
   - 保険料が正常に計算される
   - `employees.monthlyWage`が計算の基準として使用される（既存の挙動を維持）

**テストケース8: マイページが従来通り動作すること**
- 前提: employee ロールでログインしている
- 手順: マイページを開く
- 期待結果:
  - 基本情報、月次保険料、賞与保険料が正常に表示される
  - 標準報酬月額・等級が正常に表示される

---

## ⚠️ 注意点・今後の拡張

### 注意点

1. **既存機能への影響を最小限に抑える**
   - `employees.monthlyWage`は引き続き「現在利用中の標準報酬月額」として扱う
   - 月次保険料計算ロジックは変更しない
   - Phase2-6では履歴と現在値（`employees.monthlyWage`）の連動機能は実装しない

2. **エラーハンドリング**
   - 従業員保存は成功したが、履歴追加が失敗した場合
     - エラーログを出力する（コンソールログで十分）
     - ユーザーには明示的なエラー通知は不要（履歴は後から手動で追加可能）
     - 従業員データの保存は成功しているため、業務への影響は最小限

3. **テスト運用での注意**
   - テスト用に一時的に変更した履歴も残ってしまう可能性がある
   - 本番運用時は原則「テスト用事業所」で検証してから本番に反映
   - どうしても気になる履歴は、Phase2-5で実装済みの削除機能で消せる（ハイブリッド運用）

4. **データ整合性**
   - 自動追加された履歴は`decisionKind`が`'other'`になるため、定時決定・随時改定などの区分は手動で編集する必要がある
   - 運用で後から`decisionYearMonth`や`appliedFromYearMonth`を調整する場合は、手動で編集する

### 今後の拡張余地

1. **新規登録時の初回標準報酬履歴自動生成**
   - 従業員新規登録時に、初回の標準報酬履歴を自動生成する機能
   - `decisionKind`を`'qualification'`（資格取得時）にする

2. **決定区分（`decisionKind`）の自動判定**
   - 変更のタイミングや理由から、`decisionKind`を自動判定する機能
   - 例: 年次見直し時期（4月・10月）なら`'regular'`、それ以外なら`'interim'`

3. **等級・標準報酬月額フィールドの自動設定**
   - 標準報酬月額から自動的に等級を判定し、`healthGrade`/`pensionGrade`を設定する機能
   - マスタデータ（`StandardRewardBand`）を参照して等級を自動設定

4. **履歴と現在値（`employees.monthlyWage`）の連動機能**
   - 履歴レコード作成時に「現在適用として反映」チェックがONの場合、`employees.monthlyWage`や等級フィールドも同時に更新する機能
   - 履歴を「真のソース」として扱い、現在値を履歴から自動的に反映する機能

5. **履歴データからの保険料再計算**
   - 過去の履歴データを基準に、保険料を再計算する機能
   - 履歴の`appliedFromYearMonth`を基準に、該当月の保険料を再計算

6. **マイページでの履歴表示**
   - 従業員本人が自分の標準報酬履歴を閲覧できる機能
   - Firestoreルールを`isOwnEmployee`を含む形に拡張

7. **履歴の一括インポート**
   - CSV形式で履歴を一括インポートする機能

8. **履歴の検索・フィルタ機能**
   - 決定区分や期間で履歴をフィルタリングする機能

9. **履歴のグラフ表示**
   - 標準報酬月額の推移をグラフで表示する機能

---

## 📚 参考実装

### 既存の実装パターン

- **標準報酬履歴管理機能（Phase2-5）**: `StandardRewardHistoryService`と`standard-reward-history-form-dialog.component.ts`の実装を参考にする
- **被扶養者管理機能（Phase2-3）**: `DependentsService`と`dependent-form-dialog.component.ts`の実装を参考にする
- **従業員フォーム**: `employee-form-dialog.component.ts`の既存実装を参考にする

### データモデルの参考

- **標準報酬履歴（`StandardRewardHistory`型）**: Phase2-5で実装されたMVP版をそのまま利用
- **従業員（`Employee`型）**: `monthlyWage`フィールドの扱いを確認

---

## 📝 まとめ

Phase2-6では、従業員フォームで標準報酬月額を変更した際に履歴を自動追加する機能を実装します。

**Phase2-6の実装方針**:
- **従業員編集時のみ自動追加**。新規登録時は対象外。
- **`monthlyWage`が変更された場合のみ自動追加**。変更がない場合は履歴を追加しない。
- **自動追加された履歴は`decisionKind`が`'other'`**。定時決定・随時改定などの区分は手動で編集可能。
- **ハイブリッド運用を実現**。自動追加された履歴も後から編集・削除可能。

**主な変更点**:
1. `employee-form-dialog.component.ts`に自動履歴追加ロジックを追加
2. `originalMonthlyWage`を保持し、変更があった場合のみ履歴を追加
3. UI上のヒント追加（オプション）

**実装の優先順位**:
1. **必須**: `employee-form-dialog.component.ts`の修正（自動履歴追加ロジック）
2. **推奨**: UI上のヒント追加（`mat-hint`で自動記録されることを明示）
3. **将来の拡張**: 新規登録時の初回履歴自動生成、決定区分の自動判定、等級フィールドの自動設定

この実装により、標準報酬変更時の履歴記録が自動化され、人事担当者の負担が軽減されます。将来的には、決定区分の自動判定や等級フィールドの自動設定など、より高度な機能を段階的に実装していくことが可能です。

