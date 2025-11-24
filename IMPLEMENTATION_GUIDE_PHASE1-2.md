# Phase1-2: 従業員の社会保険資格情報・就業状態の管理機能追加

**対象機能**: カタログ(3)「従業員台帳・在籍・資格情報・就労条件管理機能」の残り部分  
**優先度**: 中（データ管理の拡張）  
**作成日**: 2025年1月

---

## 0. フェーズ名

**Phase1-2: 従業員の社会保険資格情報・就業状態の管理機能追加（カタログ(3)の残り部分）**

---

## 1. 目的

カタログ(3)「従業員台帳・在籍・資格情報・就労条件管理機能」のうち、以下の機能がまだ未実装のため、以下を実現する：

- 従業員ごとに **健康保険・厚生年金の資格情報**（資格取得日・資格喪失日・取得区分・喪失理由区分）を保持できるようにする
- 従業員ごとに **就業状態**（通常勤務／産前産後休業／育児休業／傷病休職など）と期間・保険料扱いを登録・閲覧できるようにする
- これらの情報を `EmployeesService` / Firestore に保存し、編集ダイアログと詳細ダイアログで扱えるようにする

**※ このフェーズでは、まだ月次保険料計算ロジックや自動判定には使わない**

---

## 2. 前提・現状

- `Employee` 型は P1-1 で拡張済み（連絡先・就労条件・番号系・等級など）
- `EmployeesService.save` は既存フィールドを Firestore に保存できる状態
- `EmployeesPage` / `EmployeeFormDialogComponent` / `EmployeeDetailDialogComponent` が存在し、従業員の CRUD ができる
- カタログ(3) のうち、以下は未実装：
  - 健康保険・厚生年金の「資格取得日／資格喪失日」「取得区分／喪失理由区分」
  - 就業状態（通常勤務／産前産後休業／育児休業／傷病休職など）と、その期間・保険料扱いの保持

---

## 3. やってほしいこと（仕様）

### 3-1. 型定義の追加・変更（`src/app/types.ts`）

以下の新しい型を追加する：

```typescript
// 資格取得区分（簡易）
export type InsuranceQualificationKind =
  | 'new_hire'        // 新規採用
  | 'expansion'       // 適用拡大による加入
  | 'hours_change'    // 所定労働時間等の変更による加入
  | 'other';          // その他

// 資格喪失理由区分（簡易）
export type InsuranceLossReasonKind =
  | 'retirement'      // 退職
  | 'hours_decrease'  // 所定労働時間等の減少
  | 'death'           // 死亡
  | 'other';          // その他

// 就業状態（簡易）
export type WorkingStatus =
  | 'normal'          // 通常勤務
  | 'maternity_leave' // 産前産後休業
  | 'childcare_leave' // 育児休業
  | 'sick_leave'      // 傷病休職
  | 'other';          // その他

// 就業状態における保険料の扱い（簡易）
export type PremiumTreatment = 'normal' | 'exempt';
```

`Employee` インターフェースに以下のフィールドを追加する（既存フィールドは変更しない）：

```typescript
export interface Employee {
  // ...既存フィールド...

  /** 健康保険の資格情報 */
  healthQualificationDate?: IsoDateString;          // 資格取得日
  healthLossDate?: IsoDateString;                   // 資格喪失日
  healthQualificationKind?: InsuranceQualificationKind; // 取得区分
  healthLossReasonKind?: InsuranceLossReasonKind;        // 喪失理由区分

  /** 厚生年金の資格情報 */
  pensionQualificationDate?: IsoDateString;         // 資格取得日
  pensionLossDate?: IsoDateString;                  // 資格喪失日
  pensionQualificationKind?: InsuranceQualificationKind;
  pensionLossReasonKind?: InsuranceLossReasonKind;

  /** 就業状態（産休・育休・休職など） */
  workingStatus?: WorkingStatus;
  workingStatusStartDate?: IsoDateString;
  workingStatusEndDate?: IsoDateString;
  premiumTreatment?: PremiumTreatment;              // 保険料扱い（通常徴収／免除）
  workingStatusNote?: string;                       // 備考
}
```

**注意**: ここでは履歴（複数期間）は扱わず、「現在有効な状態を1セットだけ」持てれば OK。

---

### 3-2. ラベル変換ユーティリティの追加（推奨）

**ファイル**: `src/app/utils/label-utils.ts`（新規作成）

表示用のラベル変換関数を追加することを推奨：

```typescript
export function getInsuranceQualificationKindLabel(kind?: InsuranceQualificationKind): string {
  switch (kind) {
    case 'new_hire': return '新規採用';
    case 'expansion': return '適用拡大';
    case 'hours_change': return '所定労働時間変更';
    case 'other': return 'その他';
    default: return '-';
  }
}

export function getInsuranceLossReasonKindLabel(kind?: InsuranceLossReasonKind): string {
  switch (kind) {
    case 'retirement': return '退職';
    case 'hours_decrease': return '所定労働時間減少';
    case 'death': return '死亡';
    case 'other': return 'その他';
    default: return '-';
  }
}

export function getWorkingStatusLabel(status?: WorkingStatus): string {
  switch (status) {
    case 'normal': return '通常勤務';
    case 'maternity_leave': return '産前産後休業';
    case 'childcare_leave': return '育児休業';
    case 'sick_leave': return '傷病休職';
    case 'other': return 'その他';
    default: return '-';
  }
}

export function getPremiumTreatmentLabel(treatment?: PremiumTreatment): string {
  switch (treatment) {
    case 'normal': return '通常徴収';
    case 'exempt': return '保険料免除';
    default: return '-';
  }
}
```

---

### 3-3. EmployeesService で新フィールドを保存（`src/app/services/employees.service.ts`）

`save` メソッドの `payload` に、新フィールドを反映する。

**実装パターン**: 既存の `if (employee.xxx != null)` パターンに従う：

```typescript
async save(
  officeId: string,
  employee: Partial<Employee> & { id?: string }
): Promise<void> {
  // ...既存のコード...

  // 必須系＋よく使う基本項目だけをまずセット
  const payload: Employee = {
    // ...既存フィールド...
  };

  // --- ここから下は「値が入っているものだけ追加する」 ---
  // ...既存の条件分岐...

  // ▼ 追加: 健康保険の資格情報
  if (employee.healthQualificationDate != null) {
    payload.healthQualificationDate = employee.healthQualificationDate;
  }
  if (employee.healthLossDate != null) {
    payload.healthLossDate = employee.healthLossDate;
  }
  if (employee.healthQualificationKind != null) {
    payload.healthQualificationKind = employee.healthQualificationKind;
  }
  if (employee.healthLossReasonKind != null) {
    payload.healthLossReasonKind = employee.healthLossReasonKind;
  }

  // ▼ 追加: 厚生年金の資格情報
  if (employee.pensionQualificationDate != null) {
    payload.pensionQualificationDate = employee.pensionQualificationDate;
  }
  if (employee.pensionLossDate != null) {
    payload.pensionLossDate = employee.pensionLossDate;
  }
  if (employee.pensionQualificationKind != null) {
    payload.pensionQualificationKind = employee.pensionQualificationKind;
  }
  if (employee.pensionLossReasonKind != null) {
    payload.pensionLossReasonKind = employee.pensionLossReasonKind;
  }

  // ▼ 追加: 就業状態
  if (employee.workingStatus != null) {
    payload.workingStatus = employee.workingStatus;
  }
  if (employee.workingStatusStartDate != null) {
    payload.workingStatusStartDate = employee.workingStatusStartDate;
  }
  if (employee.workingStatusEndDate != null) {
    payload.workingStatusEndDate = employee.workingStatusEndDate;
  }
  if (employee.premiumTreatment != null) {
    payload.premiumTreatment = employee.premiumTreatment;
  }
  if (employee.workingStatusNote != null) {
    payload.workingStatusNote = employee.workingStatusNote;
  }

  await setDoc(ref, payload, { merge: true });
}
```

**注意事項**:
- 日付系はすべて `IsoDateString`（YYYY-MM-DD）を想定
- 既存のロジックを壊さないこと（特に `createdAt` / `updatedAt` の扱いは現状のまま）
- `undefined` フィールドは Firestore に保存しない（既存パターンに従う）

---

### 3-4. 従業員編集ダイアログの拡張（`employee-form-dialog.component.ts`）

#### FormGroup に新しい FormControl を追加

```typescript
readonly form = inject(FormBuilder).group({
  // ...既存フィールド...
  pensionNumber: [''],

  // ▼ 追加: 健康保険の資格情報
  healthQualificationDate: [''],
  healthLossDate: [''],
  healthQualificationKind: [''],
  healthLossReasonKind: [''],

  // ▼ 追加: 厚生年金の資格情報
  pensionQualificationDate: [''],
  pensionLossDate: [''],
  pensionQualificationKind: [''],
  pensionLossReasonKind: [''],

  // ▼ 追加: 就業状態
  workingStatus: ['normal'],
  workingStatusStartDate: [''],
  workingStatusEndDate: [''],
  premiumTreatment: ['normal'],
  workingStatusNote: ['']
});
```

#### コンストラクタの patchValue で既存従業員を読み込む際に新フィールドもマージ

```typescript
constructor(@Inject(MAT_DIALOG_DATA) public data: EmployeeDialogData) {
  if (data.employee) {
    const employee = data.employee;
    this.form.patchValue({
      ...employee,
      // 既存のパッチ処理...
      // ▼ 追加: 新フィールドもマージ（undefined の場合は空文字や null でよい）
      healthQualificationDate: employee.healthQualificationDate ?? '',
      healthLossDate: employee.healthLossDate ?? '',
      healthQualificationKind: employee.healthQualificationKind ?? '',
      healthLossReasonKind: employee.healthLossReasonKind ?? '',
      pensionQualificationDate: employee.pensionQualificationDate ?? '',
      pensionLossDate: employee.pensionLossDate ?? '',
      pensionQualificationKind: employee.pensionQualificationKind ?? '',
      pensionLossReasonKind: employee.pensionLossReasonKind ?? '',
      workingStatus: employee.workingStatus ?? 'normal',
      workingStatusStartDate: employee.workingStatusStartDate ?? '',
      workingStatusEndDate: employee.workingStatusEndDate ?? '',
      premiumTreatment: employee.premiumTreatment ?? 'normal',
      workingStatusNote: employee.workingStatusNote ?? ''
    } as any);
  }
}
```

#### テンプレートに UI を追加

「社会保険関連」セクションの下に、以下のセクションを追加する：

```html
<!-- 資格情報（健康保険） -->
<p class="section-title">資格情報（健康保険）</p>

<mat-form-field appearance="outline">
  <mat-label>資格取得日（健保）</mat-label>
  <input matInput type="date" formControlName="healthQualificationDate" />
</mat-form-field>

<mat-form-field appearance="outline">
  <mat-label>資格取得区分（健保）</mat-label>
  <mat-select formControlName="healthQualificationKind">
    <mat-option [value]="'new_hire'">新規採用</mat-option>
    <mat-option [value]="'expansion'">適用拡大</mat-option>
    <mat-option [value]="'hours_change'">所定労働時間変更</mat-option>
    <mat-option [value]="'other'">その他</mat-option>
  </mat-select>
</mat-form-field>

<mat-form-field appearance="outline">
  <mat-label>資格喪失日（健保）</mat-label>
  <input matInput type="date" formControlName="healthLossDate" />
</mat-form-field>

<mat-form-field appearance="outline">
  <mat-label>喪失理由区分（健保）</mat-label>
  <mat-select formControlName="healthLossReasonKind">
    <mat-option [value]="'retirement'">退職</mat-option>
    <mat-option [value]="'hours_decrease'">所定労働時間減少</mat-option>
    <mat-option [value]="'death'">死亡</mat-option>
    <mat-option [value]="'other'">その他</mat-option>
  </mat-select>
</mat-form-field>

<!-- 資格情報（厚生年金） -->
<p class="section-title">資格情報（厚生年金）</p>

<mat-form-field appearance="outline">
  <mat-label>資格取得日（厚年）</mat-label>
  <input matInput type="date" formControlName="pensionQualificationDate" />
</mat-form-field>

<mat-form-field appearance="outline">
  <mat-label>資格取得区分（厚年）</mat-label>
  <mat-select formControlName="pensionQualificationKind">
    <mat-option [value]="'new_hire'">新規採用</mat-option>
    <mat-option [value]="'expansion'">適用拡大</mat-option>
    <mat-option [value]="'hours_change'">所定労働時間変更</mat-option>
    <mat-option [value]="'other'">その他</mat-option>
  </mat-select>
</mat-form-field>

<mat-form-field appearance="outline">
  <mat-label>資格喪失日（厚年）</mat-label>
  <input matInput type="date" formControlName="pensionLossDate" />
</mat-form-field>

<mat-form-field appearance="outline">
  <mat-label>喪失理由区分（厚年）</mat-label>
  <mat-select formControlName="pensionLossReasonKind">
    <mat-option [value]="'retirement'">退職</mat-option>
    <mat-option [value]="'hours_decrease'">所定労働時間減少</mat-option>
    <mat-option [value]="'death'">死亡</mat-option>
    <mat-option [value]="'other'">その他</mat-option>
  </mat-select>
</mat-form-field>

<!-- 就業状態 -->
<p class="section-title">就業状態</p>

<mat-form-field appearance="outline">
  <mat-label>就業状態</mat-label>
  <mat-select formControlName="workingStatus">
    <mat-option [value]="'normal'">通常勤務</mat-option>
    <mat-option [value]="'maternity_leave'">産前産後休業</mat-option>
    <mat-option [value]="'childcare_leave'">育児休業</mat-option>
    <mat-option [value]="'sick_leave'">傷病休職</mat-option>
    <mat-option [value]="'other'">その他</mat-option>
  </mat-select>
</mat-form-field>

<mat-form-field appearance="outline">
  <mat-label>状態開始日</mat-label>
  <input matInput type="date" formControlName="workingStatusStartDate" />
</mat-form-field>

<mat-form-field appearance="outline">
  <mat-label>状態終了日</mat-label>
  <input matInput type="date" formControlName="workingStatusEndDate" />
</mat-form-field>

<mat-form-field appearance="outline">
  <mat-label>保険料の扱い</mat-label>
  <mat-select formControlName="premiumTreatment">
    <mat-option [value]="'normal'">通常徴収</mat-option>
    <mat-option [value]="'exempt'">保険料免除</mat-option>
  </mat-select>
</mat-form-field>

<mat-form-field appearance="outline" class="full-row">
  <mat-label>備考（就業状態）</mat-label>
  <textarea matInput rows="2" formControlName="workingStatusNote"></textarea>
</mat-form-field>
```

#### スタイルの追加

必要であれば `.full-row { grid-column: 1 / -1; }` のようなスタイルを追加して、メモ欄を横幅いっぱいに表示。

---

### 3-5. 従業員詳細ダイアログの拡張（`employee-detail-dialog.component.ts`）

詳細ダイアログに「資格情報（健保／厚年）」「就業状態」セクションを追加し、以下を読み取り専用で表示：

- 健保／厚年の資格取得日・喪失日
- 資格取得区分・喪失理由区分（ラベルは日本語に変換、`label-utils.ts` の関数を使用推奨）
- 就業状態／期間／保険料扱い／備考

**実装例**:

```typescript
// コンポーネント内でユーティリティ関数をインポート
import {
  getInsuranceQualificationKindLabel,
  getInsuranceLossReasonKindLabel,
  getWorkingStatusLabel,
  getPremiumTreatmentLabel
} from '../../utils/label-utils';

// テンプレート内で使用
<div class="label">資格取得区分（健保）</div>
<div class="value">
  {{ getInsuranceQualificationKindLabel(data.employee.healthQualificationKind) }}
</div>
```

**表示ルール**:
- 日付が未設定の場合は `-` 表示
- 区分が未設定の場合は `-` 表示（ユーティリティ関数が処理）

---

### 3-6. 一覧ページでの簡易表示（`employees.page.ts`）

テーブルに「就業状態」列を1列追加する（余白を見て問題なさそうであれば）。

#### displayedColumns に追加

```typescript
readonly displayedColumns = [
  'name',
  'department',
  'address',
  'weeklyWorkingHours',
  'weeklyWorkingDays',
  'isStudent',
  'monthlyWage',
  'isInsured',
  'workingStatus',  // ▼ 追加
  'actions'
];
```

#### テーブル列の定義を追加

```typescript
<ng-container matColumnDef="workingStatus">
  <th mat-header-cell *matHeaderCellDef>就業状態</th>
  <td mat-cell *matCellDef="let row">
    {{ getWorkingStatusLabel(row.workingStatus) }}
  </td>
</ng-container>
```

#### ユーティリティ関数のインポート

```typescript
import { getWorkingStatusLabel } from '../../utils/label-utils';
```

**注意**: それ以外の列・ロジックは変更しない（P1-1 で完成した部分を壊さない）。

---

## 4. バリデーション・エラーハンドリング

### 4-1. 日付の整合性チェック（推奨）

以下のバリデーションを追加することを推奨（任意実装）：

- 資格取得日 ≤ 資格喪失日（同じ保険種別内）
- 就業状態開始日 ≤ 就業状態終了日
- 資格取得日 ≤ 入社日（論理的な整合性チェック、任意）

**実装方法**: Angular のカスタムバリデーターを使用するか、`submit()` メソッド内でチェック。

### 4-2. エラーハンドリング

- Firestore の保存エラーは既存の `MatSnackBar` パターンに従う
- フォームバリデーションエラーは既存の `markAllAsTouched()` パターンに従う

---

## 5. このフェーズでやらないこと（明示）

- ❌ 月次保険料計算ロジック（カタログ(7)）への組み込み
- ❌ 入社日・退職日・資格日からの「計上対象月」自動判定ロジック
- ❌ 介護保険第2号被保険者（40〜64歳）の自動判定と保険料計算への反映
- ❌ Firestore セキュリティルールの変更
- ❌ ダッシュボード・月次一覧・シミュレータなど他ページの改修
- ❌ 就業状態の履歴管理（複数期間の保持）

これらは **後続フェーズ（P1-3 以降）** で対応予定。

---

## 6. 動作確認の目安

### 6-1. 新規従業員登録

- 「資格情報」「就業状態」セクションが表示される
- 入力した値が Firestore の `offices/{officeId}/employees/{employeeId}` に保存される
- 保存後、詳細ダイアログで正しく表示される

### 6-2. 既存従業員の編集

- 保存済みの資格情報・就業状態がフォームに反映される
- 更新後も値が維持される
- 一部のフィールドのみ更新しても、他のフィールドが消えない

### 6-3. 一覧表示

- 「就業状態」列が正しく表示される
- 未設定の場合は `-` が表示される

### 6-4. 詳細ダイアログ

- 追加した項目が正しく読み取り専用で表示される
- ラベルが日本語で表示される（ユーティリティ関数使用時）

---

## 7. 実装チェックリスト

### 型定義
- [ ] `InsuranceQualificationKind` 型の追加
- [ ] `InsuranceLossReasonKind` 型の追加
- [ ] `WorkingStatus` 型の追加
- [ ] `PremiumTreatment` 型の追加
- [ ] `Employee` インターフェースへの新フィールド追加

### ユーティリティ（推奨）
- [ ] `label-utils.ts` の作成
- [ ] ラベル変換関数の実装

### サービス
- [ ] `EmployeesService.save` に新フィールドの保存処理を追加

### UI コンポーネント
- [ ] `EmployeeFormDialogComponent` の FormGroup 拡張
- [ ] `EmployeeFormDialogComponent` のテンプレート拡張
- [ ] `EmployeeDetailDialogComponent` のテンプレート拡張
- [ ] `EmployeesPage` のテーブル列追加

### テスト
- [ ] 新規登録時の動作確認
- [ ] 既存従業員編集時の動作確認
- [ ] 詳細ダイアログの表示確認
- [ ] 一覧表示の確認

---

## 8. 参考実装

### 既存コードのパターン

1. **サービス実装**: `src/app/services/employees.service.ts`
   - `if (employee.xxx != null)` パターンでオプショナルフィールドを処理

2. **フォーム実装**: `src/app/pages/employees/employee-form-dialog.component.ts`
   - `ReactiveFormsModule` を使用
   - `FormBuilder` でフォーム構築
   - `patchValue` で既存データを読み込み

3. **詳細表示**: `src/app/pages/employees/employee-detail-dialog.component.ts`
   - グリッドレイアウトで情報を表示
   - 未設定値は `-` 表示

---

## 9. 注意事項

1. **既存コードの保護**: P1-1 で実装した機能を壊さないこと
2. **オプショナルフィールド**: すべての新フィールドはオプショナル（`?`）として定義
3. **日付フォーマット**: すべて `IsoDateString`（YYYY-MM-DD）形式で統一
4. **Firestore の undefined**: `undefined` フィールドは保存しない（既存パターンに従う）
5. **UI の一貫性**: 既存の UI パターン（グリッドレイアウト、セクションタイトルなど）に統一

---

**実装完了後は、このチェックリストを確認して、実装状況を更新してください。**

