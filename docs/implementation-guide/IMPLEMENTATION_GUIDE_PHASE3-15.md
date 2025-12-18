# Phase3-15: 口座情報・給与情報管理機能 実装指示書

**作成日**: 2025年12月6日  
**最終更新**: 2025年12月6日（現行コードとの整合性を確認・修正）  
**対象フェーズ**: Phase3-15  
**優先度**: 🟢 低（拡張機能）  
**依存関係**: Phase2-1（セキュリティ強化）、Phase3-3（ChangeRequest実装）  
**目標完了日**: 2025年12月6日

---

## ⚠️ 実装前の注意事項

本実装指示書は、現行コードベースとの整合性を確認した上で作成されています。実装時は以下の点に注意してください：

1. **Firestoreルール**: 既存の`validEmployeeExtendedFields()`関数を拡張する形で実装（新規関数名は使用しない）
2. **ChangeRequest.payload**: union型拡張時に、既存コードで`payload`を`DependentRequestPayload`前提で使っている箇所を`kind`で分岐するように修正
3. **ファイル名**: 指示書中のファイル名は「役割のイメージ」であり、実際のファイル名に合わせて実装してください

---

## 1. 概要

### 1.1. 目的

Phase3-15では、従業員ごとの**口座情報（BankAccount）**と**給与基本情報（PayrollSettings）**を台帳として管理できる機能を追加します。

本機能は「あくまで管理者・人事にとって便利な台帳機能」という位置付けであり、以下の機能は**スコープ外**です：

- ❌ 所得税・住民税の計算
- ❌ 手取り額の算出
- ❌ 給与明細の発行
- ❌ 月次の給与計算システムそのものの実装
- ❌ CSVインポート・エクスポートへの統合（将来フェーズ）
- ❌ 報酬月額から標準報酬月額・等級の自動サジェスト（将来フェーズ）

### 1.2. スコープ（In / Out）

#### ✅ 実装対象（In）

1. **口座情報（BankAccount）の管理**
   - 従業員ごとに1口座を保持（複数口座対応はスコープ外）
   - admin/hr: 全従業員の口座情報を閲覧・編集可能
   - employee: 自分の口座情報を閲覧可能、変更はChangeRequest経由のみ

2. **給与基本情報（PayrollSettings）の管理**
   - 支給形態（月給/日給/時給/年俸/その他）
   - 支給サイクル（月次/月2回/週次/その他）
   - 報酬月額（社会保険の標準報酬月額を決めるための「保険上の月額給与」）
   - admin/hr: 全従業員の給与情報を閲覧・編集可能
   - employee: 自分の給与情報を閲覧のみ（変更申請はスコープ外）

3. **ChangeRequest（口座情報変更申請）**
   - employeeが自分の口座情報を変更申請できる
   - admin/hrが承認・却下できる
   - 承認時に`employees/{employeeId}.bankAccount`を自動反映

#### ❌ 実装対象外（Out）

- 複数口座対応
- 給与情報（payrollSettings）の変更申請機能
- CSVインポート・エクスポートへの統合
- 報酬月額から標準報酬月額・等級の自動サジェスト
- 給与計算・所得税・住民税計算
- 給与明細の発行

---

## 2. データモデル仕様

### 2.1. BankAccount型の詳細

```typescript
export type BankAccountType = 'ordinary' | 'checking' | 'savings' | 'other';

export interface BankAccount {
  bankName: string;               // 金融機関名（必須）
  bankCode?: string | null;       // 任意（4桁コードなど）
  branchName: string;             // 支店名（必須）
  branchCode?: string | null;     // 任意（3桁コードなど）
  accountType: BankAccountType;   // 普通／当座など（必須）
  accountNumber: string;          // 口座番号（必須、先頭0を含むため string）
  accountHolderName: string;      // 名義（必須）
  accountHolderKana?: string | null; // 任意（カナ名義）

  // 将来拡張用（今回のフェーズでは特に UI 上で使わなくてもよい）
  isMain?: boolean;
  updatedAt?: IsoDateString;
  updatedByUserId?: string;
}
```

**注意事項**:
- `accountNumber`は先頭0を含む可能性があるため、`string`型とする
- `bankCode`、`branchCode`、`accountHolderKana`は任意フィールド（null許容）
- `updatedAt`、`updatedByUserId`は将来の監査ログ用（今回は必須ではないが、更新時に設定することを推奨）

### 2.2. PayrollSettings型の詳細

```typescript
export type PayrollPayType = 'monthly' | 'daily' | 'hourly' | 'annual' | 'other';
export type PayrollPayCycle = 'monthly' | 'twice_per_month' | 'weekly' | 'other';

export interface PayrollSettings {
  payType: PayrollPayType;        // 支給形態（必須）
  payCycle: PayrollPayCycle;      // 支給サイクル（必須）

  // 報酬月額（社会保険の標準報酬月額を決めるための「保険上の月額給与」）
  insurableMonthlyWage?: number | null; // 円単位、>= 0 を想定（任意）

  note?: string | null;           // 補足メモ（任意）
}
```

**注意事項**:
- `insurableMonthlyWage`は「社会保険の標準報酬月額を選ぶための報酬月額」として明示的に定義
- 将来的に、この値をもとに「標準報酬月額 + 等級の初期候補を自動算出」することを想定
- 今回のPhase3-15では「値を保持するところ」までを対象とし、自動算出ロジックの実装は必須ではない

### 2.3. Employeeモデルへの組み込み方

`src/app/types.ts`の`Employee`インターフェースに、以下の2つのフィールドを追加します：

```typescript
export interface Employee {
  // ... 既存フィールド ...

  /** 給与振込口座情報 */
  bankAccount?: BankAccount | null;

  /** 給与基本情報（社会保険用） */
  payrollSettings?: PayrollSettings | null;

  // ... 既存フィールド ...
}
```

**注意事項**:
- 両方とも`undefined`または`null`を許容する（任意フィールド）
- 未入力の場合は`null`のままで問題ない
- Firestoreに保存する際は、`undefined`フィールドは除外する（既存の`EmployeesService.save()`の実装パターンに従う）

### 2.4. Firestoreドキュメント構造とサンプル

#### 構造

```
offices/{officeId}/employees/{employeeId} {
  // 既存フィールド...
  bankAccount?: BankAccount | null;
  payrollSettings?: PayrollSettings | null;
}
```

#### サンプルデータ

```json
{
  "id": "emp001",
  "officeId": "office001",
  "name": "山田太郎",
  "kana": "ヤマダタロウ",
  "birthDate": "1990-01-01",
  "hireDate": "2020-04-01",
  "employmentType": "regular",
  "monthlyWage": 300000,
  "isInsured": true,
  // ... 既存フィールド ...

  "bankAccount": {
    "bankName": "みずほ銀行",
    "bankCode": "0001",
    "branchName": "新宿支店",
    "branchCode": "123",
    "accountType": "ordinary",
    "accountNumber": "1234567",
    "accountHolderName": "ヤマダタロウ",
    "accountHolderKana": "ヤマダタロウ"
  },

  "payrollSettings": {
    "payType": "monthly",
    "payCycle": "monthly",
    "insurableMonthlyWage": 300000,
    "note": "基本給のみ（手当込みで計算する場合は要調整）"
  }
}
```

---

## 3. 権限・アクセス制御

### 3.1. ロールごとの操作可否

| ロール | 自分の口座 | 他人の口座 | 自分の給与情報 | 他人の給与情報 |
|--------|-----------|-----------|---------------|---------------|
| admin | 閲覧＋編集 | 閲覧＋編集 | 閲覧＋編集 | 閲覧＋編集 |
| hr | 閲覧＋編集 | 閲覧＋編集 | 閲覧＋編集 | 閲覧＋編集 |
| employee | 閲覧のみ（＋変更申請） | なし | 閲覧のみ | なし |
| viewer | なし | なし | なし | なし |

**詳細**:

- **admin / hr**:
  - 同一`officeId`内の全従業員の`bankAccount`と`payrollSettings`を閲覧・編集可能
  - 従業員追加フォーム、従業員編集フォーム、従業員詳細ダイアログから編集可能

- **employee**:
  - 自分の`bankAccount`と`payrollSettings`を閲覧可能（`/me`マイページ）
  - `bankAccount`の変更は直接編集NG、ChangeRequest経由でのみ変更可能
  - `payrollSettings`の変更申請は今回のスコープ外（閲覧のみ）

- **viewer**:
  - 口座情報・給与情報にはアクセス不可

### 3.2. Firestoreルールに反映すべきポリシー

`firestore.rules`の`offices/{officeId}/employees/{employeeId}`セクションに、以下のルールを追加します：

**重要**: 既存の`validEmployeeExtendedFields()`関数のロジックは**そのまま残し**、末尾に`&& validBankAccount(data) && validPayrollSettings(data)`を**追加する**形で実装してください。

```javascript
match /employees/{employeeId} {
  // 既存の validEmployeeExtendedFields() 関数の既存条件はそのまま維持し、
  // 末尾に bankAccount と payrollSettings のバリデーションを追加する
  function validEmployeeExtendedFields(data) {
    // ここに既存のチェックがある前提（以下は既存の条件）
    return (!('employeeCodeInOffice' in data) || data.employeeCodeInOffice == null || data.employeeCodeInOffice is string)
      && (!('sex' in data) || data.sex == null || data.sex in ['male', 'female', 'other'])
      && (!('postalCode' in data) || data.postalCode == null || (data.postalCode is string && data.postalCode.matches('^[0-9]{7}$')))
      && (!('addressKana' in data) || data.addressKana == null || data.addressKana is string)
      && (!('myNumber' in data) || data.myNumber == null || (data.myNumber is string && data.myNumber.size() == 12 && data.myNumber.matches('^[0-9]{12}$')))
      // Phase3-15: 既存条件の末尾に bankAccount と payrollSettings のバリデーションを追加
      && validBankAccount(data)
      && validPayrollSettings(data);
  }

  function validBankAccount(data) {
    return (!('bankAccount' in data) || 
            data.bankAccount == null ||
            (data.bankAccount is map &&
             data.bankAccount.keys().hasAll(['bankName', 'branchName', 'accountType', 'accountNumber', 'accountHolderName']) &&
             data.bankAccount.bankName is string && data.bankAccount.bankName.size() > 0 &&
             data.bankAccount.branchName is string && data.bankAccount.branchName.size() > 0 &&
             data.bankAccount.accountType in ['ordinary', 'checking', 'savings', 'other'] &&
             data.bankAccount.accountNumber is string && data.bankAccount.accountNumber.size() > 0 &&
             (!('bankCode' in data.bankAccount) || data.bankAccount.bankCode == null || data.bankAccount.bankCode is string) &&
             (!('branchCode' in data.bankAccount) || data.bankAccount.branchCode == null || data.bankAccount.branchCode is string) &&
             (!('accountHolderKana' in data.bankAccount) || data.bankAccount.accountHolderKana == null || data.bankAccount.accountHolderKana is string)));
  }

  function validPayrollSettings(data) {
    return (!('payrollSettings' in data) ||
            data.payrollSettings == null ||
            (data.payrollSettings is map &&
             data.payrollSettings.keys().hasAll(['payType', 'payCycle']) &&
             data.payrollSettings.payType in ['monthly', 'daily', 'hourly', 'annual', 'other'] &&
             data.payrollSettings.payCycle in ['monthly', 'twice_per_month', 'weekly', 'other'] &&
             (!('insurableMonthlyWage' in data.payrollSettings) || 
              data.payrollSettings.insurableMonthlyWage == null ||
              (data.payrollSettings.insurableMonthlyWage is int && data.payrollSettings.insurableMonthlyWage >= 0)) &&
             (!('note' in data.payrollSettings) || data.payrollSettings.note == null || data.payrollSettings.note is string)));
  }

  // 既存の allow read 条件はそのまま維持（viewer ロールは既に除外されている）
  allow read: if belongsToOffice(officeId) && (isAdminOrHr(officeId) || isOwnEmployee(officeId, employeeId));

  // 既存の allow create, update 条件に validBankAccount() と validPayrollSettings() を追加
  allow create, update: if isAdminOrHr(officeId) && validEmployeeExtendedFields(request.resource.data);

  // employee は bankAccount / payrollSettings に対して直接 write 不可
  // （ChangeRequest 経由でのみ変更可能）
}
```

**注意事項**:
- **既存の`validEmployeeExtendedFields()`関数の既存条件は削除せず、そのまま維持する**
- 既存条件の末尾に`&& validBankAccount(data) && validPayrollSettings(data)`を追加することで、既存のバリデーションロジックに新しいチェックを追加する
- `bankAccount`と`payrollSettings`はネストされたオブジェクトのため、専用のバリデーション関数で型チェックを行う
- `employee`ロールは`bankAccount`と`payrollSettings`に対して直接`write`不可（ChangeRequest経由でのみ変更可能）
- `viewer`ロールは既存の`allow read`条件（`isAdminOrHr`または`isOwnEmployee`が必要）により、`read`も不可（既存仕様を維持）

---

## 4. UI / UX 変更点

### 4.1. 従業員追加フォーム（`employee-form-dialog.component.ts`）

**変更箇所**: `src/app/pages/employees/employee-form-dialog.component.ts`（既存ファイル）

**注意**: このファイルは従業員追加と編集の両方に対応しています。既存の構造に合わせて新しいセクションを追加してください。

#### 追加するセクション

1. **「給与振込口座情報」セクション**
   - すべて任意入力
   - 入力項目:
     - 金融機関名（`bankName`、必須バリデーション: `bankAccount`を保存する場合のみ）
     - 金融機関コード（`bankCode`、任意）
     - 支店名（`branchName`、必須バリデーション: `bankAccount`を保存する場合のみ）
     - 支店コード（`branchCode`、任意）
     - 口座種別（`accountType`、必須バリデーション: `bankAccount`を保存する場合のみ）
       - 選択肢: 普通 / 当座 / 貯蓄 / その他
     - 口座番号（`accountNumber`、必須バリデーション: `bankAccount`を保存する場合のみ）
       - 数字のみ（`^\d+$`）を推奨
       - 文字数上限: 20文字程度
     - 名義（`accountHolderName`、必須バリデーション: `bankAccount`を保存する場合のみ）
     - 名義カナ（`accountHolderKana`、任意）

2. **「給与情報（保険用）」セクション**
   - すべて任意入力
   - 入力項目:
     - 支給形態（`payType`、必須バリデーション: `payrollSettings`を保存する場合のみ）
       - 選択肢: 月給 / 日給 / 時給 / 年俸 / その他
     - 支給サイクル（`payCycle`、必須バリデーション: `payrollSettings`を保存する場合のみ）
       - 選択肢: 月次 / 月2回 / 週次 / その他
     - 報酬月額（`insurableMonthlyWage`、任意）
       - 数値入力（円単位）
       - 0以上の数値のみ（負数はエラー）
       - `mat-hint`: 「社会保険の標準報酬月額を決めるための月額給与です」
     - 補足メモ（`note`、任意）

#### 実装方針

- 既存の`employee-form-dialog.component.ts`の構造に合わせて、新しいセクションを追加
- フォームコントロールは`ReactiveFormsModule`を使用
- `bankAccount`と`payrollSettings`は、すべての必須フィールドが入力されている場合のみ保存する
- 一部のみ入力されている場合は、バリデーションエラーとして扱う（または、入力されたフィールドのみ保存する方針でも可。仕様として明確化が必要）

**推奨実装方針**: `bankAccount`を保存する場合は、`bankName`、`branchName`、`accountType`、`accountNumber`、`accountHolderName`がすべて必須。`payrollSettings`を保存する場合は、`payType`、`payCycle`が必須。

### 4.2. 従業員編集フォーム（`employee-form-dialog.component.ts`）

**変更箇所**: `src/app/pages/employees/employee-form-dialog.component.ts`（既存ファイル、4.1と同じファイル）

**注意**: `employee-form-dialog.component.ts`は従業員追加と編集の両方に対応しているため、4.1と同じファイルに実装します。

- 編集時（`data.employee`が存在する場合）は既存の`bankAccount`と`payrollSettings`をフォームにセット
- 更新時は`updatedAt`と`updatedByUserId`を更新（既存の実装パターンに従う）

### 4.3. 従業員詳細ダイアログ（`employee-detail-dialog.component.ts`）

**変更箇所**: `src/app/pages/employees/employee-detail-dialog.component.ts`

#### 追加するセクション

1. **「給与振込口座情報」セクション**（`id="bankAccount"`）
   - admin/hrのみ編集可能（編集ボタンから`employee-form-dialog`を開く）
   - 表示項目:
     - 金融機関名・支店名
     - 口座種別
     - 口座番号
     - 名義・名義カナ
     - 未登録の場合は「未登録」と表示

2. **「給与情報（保険用）」セクション**（`id="payrollSettings"`）
   - admin/hrのみ編集可能（編集ボタンから`employee-form-dialog`を開く）
   - 表示項目:
     - 支給形態
     - 支給サイクル
     - 報酬月額（`insurableMonthlyWage`、数値フォーマット: `| number`）
     - 補足メモ
     - 未登録の場合は「未登録」と表示

#### セクションナビへの追加

既存の`DialogFocusSection`型に以下を追加：

```typescript
export type DialogFocusSection =
  | 'basic'
  | 'work'
  | 'insurance'
  | 'health-qualification'
  | 'pension-qualification'
  | 'working-status'
  | 'dependents'
  | 'standard-reward-history'
  | 'bankAccount'        // 追加
  | 'payrollSettings'    // 追加
  | 'system';
```

### 4.4. `/me`（マイページ）の新規カード

**変更箇所**: `src/app/pages/me/my-page.ts`（既存ファイル）

#### 追加するカード

1. **「給与振込口座」カード**
   - 表示項目:
     - 金融機関名・支店名
     - 口座種別
     - 口座番号（今回はマスキング不要）
     - 名義・名義カナ
   - アクション:
     - 「口座情報を変更申請」ボタン（`bankAccount`が存在する場合のみ表示）
     - クリックで`bank-account-change-request-form-dialog.component.ts`を開く
   - 未登録の場合:
     - 「口座情報が未登録です」と表示
     - 「口座情報を登録申請」ボタンを表示（申請フォームを開く）

2. **「給与情報（保険用）」カード**
   - 表示項目（閲覧専用）:
     - 支給形態
     - 支給サイクル
     - 報酬月額（`insurableMonthlyWage`、数値フォーマット: `| number`）
     - 補足メモ
   - 未登録の場合:
     - 「給与情報が未登録です」と表示
   - **注意**: employeeは編集不可（変更申請もスコープ外）

#### 実装方針

- 既存の`my-page.ts`の構造に合わせて、新しいカードを追加
- `employee$` Observableから`bankAccount`と`payrollSettings`を取得して表示
- ラベル変換関数は`src/app/utils/label-utils.ts`に追加（`getBankAccountTypeLabel()`、`getPayrollPayTypeLabel()`、`getPayrollPayCycleLabel()`）

---

## 5. ChangeRequest（口座情報変更）の仕様

### 5.1. ドキュメント構造

`ChangeRequest`型に`kind: 'bankAccount'`を追加します：

```typescript
export type ChangeRequestKind = 
  | 'profile' 
  | 'dependent_add' 
  | 'dependent_update' 
  | 'dependent_remove'
  | 'bankAccount';  // 追加

export interface BankAccountChangePayload {
  bankName: string;
  bankCode?: string | null;
  branchName: string;
  branchCode?: string | null;
  accountType: BankAccountType;
  accountNumber: string;
  accountHolderName: string;
  accountHolderKana?: string | null;
}

export interface ChangeRequest {
  id: string;
  officeId: string;
  employeeId: string;
  requestedByUserId: string;
  kind: ChangeRequestKind;
  field?: 'postalCode' | 'address' | 'phone' | 'contactEmail' | 'kana' | 'other';
  currentValue?: string;
  requestedValue?: string;
  targetDependentId?: string;
  payload?: DependentRequestPayload | BankAccountChangePayload;  // 拡張
  status: ChangeRequestStatus;
  requestedAt: IsoDateString;
  decidedAt?: IsoDateString;
  decidedByUserId?: string;
  rejectReason?: string;
}
```

**注意事項**:
- `kind === 'bankAccount'`の場合、`payload`に`BankAccountChangePayload`を格納
- `field`、`currentValue`、`requestedValue`は使用しない（`payload`にすべての情報を含める）
- 既存の`ChangeRequest`との互換性を保つため、`payload`の型を`DependentRequestPayload | BankAccountChangePayload`とする

### 5.2. 画面フロー

#### 5.2.1. 申請作成（employee側）

1. `/me`画面（`src/app/pages/me/my-page.ts`）で「口座情報を変更申請」ボタンをクリック
2. `bank-account-change-request-form-dialog.component.ts`（新規作成）を開く
3. フォーム項目:
   - **現在の口座情報**（読み取り専用、存在する場合のみ表示）
     - 情報源: `employees/{employeeId}`ドキュメントの`bankAccount`フィールド
     - 例: `employeesService.get(officeId, employeeId)`で取得した`employee.bankAccount`
   - **新しい口座情報**（すべて入力可能）
     - 金融機関名、金融機関コード、支店名、支店コード、口座種別、口座番号、名義、名義カナ
     - 送信時に`ChangeRequest.payload`に`BankAccountChangePayload`として格納される
4. 送信時に`ChangeRequestsService.create()`を呼び出し、`kind: 'bankAccount'`、`payload: BankAccountChangePayload`で申請を作成

#### 5.2.2. 申請一覧・承認・却下（admin/hr側）

既存の`src/app/pages/requests/requests.page.ts`を拡張します：

1. **申請一覧表示**
   - `kind === 'bankAccount'`の申請を表示
   - 表示項目:
     - 申請日時
     - 申請者
     - 申請種別（「口座情報変更」）
     - **現在の口座情報**（存在する場合のみ表示）
       - 情報源: `employees/{employeeId}`ドキュメントの`bankAccount`フィールド
       - 例: `employeesService.get(officeId, request.employeeId)`で取得した`employee.bankAccount`
     - **申請する新しい口座情報**
       - 情報源: `ChangeRequest.payload as BankAccountChangePayload`
     - ステータス
     - アクション（承認・却下ボタン）

2. **`getTargetDependentLabel()`メソッドの修正**
   - `request.kind === 'bankAccount'`の場合は`'-'`を返すように分岐を追加
   - 既存の`dependent_*`処理は`kind`で分岐しているため、そのまま維持可能
   ```typescript
   getTargetDependentLabel(request: ChangeRequest): string {
     if (request.kind === 'profile' || request.kind === 'bankAccount') {
       return '-';
     }
     // 既存の dependent_* 処理はそのまま
     const payload = request.payload as
       | { name?: string; relationship?: string }
       | { dependentName?: string; relationship?: string }
       | undefined;
     // ...
   }
   ```

3. **承認処理**
   - `requests.page.ts`の`approve()`メソッドを拡張
   - `kind === 'bankAccount'`の場合:
     ```typescript
     else if (request.kind === 'bankAccount') {
       const payload = request.payload as BankAccountChangePayload;
       if (!payload) {
         throw new Error('申請データが見つかりませんでした');
       }

       const employee = await firstValueFrom(
         this.employeesService.get(officeId, request.employeeId)
       );
       if (!employee) {
         throw new Error('従業員が見つかりませんでした');
       }

       await this.employeesService.save(officeId, {
         ...employee,
         bankAccount: {
           ...payload,
           updatedAt: new Date().toISOString(),
           updatedByUserId: currentUserId
         },
         updatedByUserId: currentUserId
       });
     }
     ```

4. **却下処理**
   - 既存の`reject()`メソッドを使用（変更不要）
   - 却下理由を入力して`ChangeRequestsService.reject()`を呼び出す

### 5.3. 承認・却下時の処理

#### 承認時

1. `employees/{employeeId}.bankAccount`を`payload`の内容で上書き
2. `bankAccount.updatedAt`と`bankAccount.updatedByUserId`を設定（推奨）
3. `employees/{employeeId}.updatedAt`と`employees/{employeeId}.updatedByUserId`を更新
4. `ChangeRequest.status`を`'approved'`に更新

#### 却下時

1. `employees/{employeeId}`への変更は行わない
2. `ChangeRequest.status`を`'rejected'`に更新
3. `ChangeRequest.rejectReason`を保存

---

## 6. バリデーション・エラーハンドリング

### 6.1. 口座情報（BankAccount）

#### 必須フィールド（`bankAccount`を保存する場合）

- `bankName`: 文字列、1文字以上
- `branchName`: 文字列、1文字以上
- `accountType`: `'ordinary' | 'checking' | 'savings' | 'other'`のいずれか
- `accountNumber`: 文字列、1文字以上、数字のみ（`^\d+$`）を推奨、最大20文字
- `accountHolderName`: 文字列、1文字以上

#### 任意フィールド

- `bankCode`: 文字列またはnull
- `branchCode`: 文字列またはnull
- `accountHolderKana`: 文字列またはnull

#### バリデーション実装例（Angular Reactive Forms）

```typescript
const bankAccountForm = this.fb.group({
  bankName: ['', [Validators.required, Validators.maxLength(100)]],
  bankCode: [null, [Validators.maxLength(10)]],
  branchName: ['', [Validators.required, Validators.maxLength(100)]],
  branchCode: [null, [Validators.maxLength(10)]],
  accountType: ['ordinary', Validators.required],
  accountNumber: ['', [
    Validators.required, 
    Validators.pattern(/^\d+$/),
    Validators.maxLength(20)
  ]],
  accountHolderName: ['', [Validators.required, Validators.maxLength(100)]],
  accountHolderKana: [null, [Validators.maxLength(100)]]
});
```

### 6.2. 給与情報（PayrollSettings）

#### 必須フィールド（`payrollSettings`を保存する場合）

- `payType`: `'monthly' | 'daily' | 'hourly' | 'annual' | 'other'`のいずれか
- `payCycle`: `'monthly' | 'twice_per_month' | 'weekly' | 'other'`のいずれか

#### 任意フィールド

- `insurableMonthlyWage`: 数値またはnull、0以上（負数はエラー）
- `note`: 文字列またはnull

#### バリデーション実装例（Angular Reactive Forms）

```typescript
const payrollSettingsForm = this.fb.group({
  payType: ['monthly', Validators.required],
  payCycle: ['monthly', Validators.required],
  insurableMonthlyWage: [null, [
    Validators.min(0),
    Validators.pattern(/^\d+$/)
  ]],
  note: [null, [Validators.maxLength(500)]]
});
```

### 6.3. エラーメッセージ

既存の実装パターンに合わせて、`mat-error`でエラーメッセージを表示します：

```html
<mat-error *ngIf="form.get('accountNumber')?.hasError('required')">
  口座番号を入力してください
</mat-error>
<mat-error *ngIf="form.get('accountNumber')?.hasError('pattern')">
  数字のみを入力してください
</mat-error>
<mat-error *ngIf="form.get('insurableMonthlyWage')?.hasError('min')">
  0以上の数値を入力してください
</mat-error>
```

---

## 7. テスト観点（最低限のシナリオ一覧）

### 7.1. 管理者・人事側（admin/hr）

1. **従業員追加フォーム**
   - ✅ 口座情報を入力して従業員を追加できる
   - ✅ 給与情報を入力して従業員を追加できる
   - ✅ 両方とも未入力で従業員を追加できる
   - ✅ 一部のみ入力した場合のバリデーションが正しく動作する

2. **従業員編集フォーム**
   - ✅ 既存の口座情報を編集できる
   - ✅ 既存の給与情報を編集できる
   - ✅ 口座情報を削除（nullに設定）できる
   - ✅ 給与情報を削除（nullに設定）できる

3. **従業員詳細ダイアログ**
   - ✅ 口座情報セクションが表示される
   - ✅ 給与情報セクションが表示される
   - ✅ セクションナビから該当セクションにスクロールできる

4. **ChangeRequest承認**
   - ✅ 口座情報変更申請を承認できる
   - ✅ 承認時に`employees/{employeeId}.bankAccount`が正しく更新される
   - ✅ 却下時に`employees/{employeeId}`が変更されない

### 7.2. 従業員側（employee）

1. **マイページ（`/me`）**
   - ✅ 自分の口座情報が表示される
   - ✅ 自分の給与情報が表示される
   - ✅ 口座情報が未登録の場合、「未登録」と表示される
   - ✅ 給与情報が未登録の場合、「未登録」と表示される

2. **口座情報変更申請**
   - ✅ 「口座情報を変更申請」ボタンから申請フォームを開ける
   - ✅ 現在の口座情報が読み取り専用で表示される（`employees/{employeeId}.bankAccount`から取得、存在する場合）
   - ✅ 新しい口座情報を入力して申請できる（`ChangeRequest.payload`に格納）
   - ✅ バリデーションエラーが正しく表示される

3. **申請履歴**
   - ✅ 自分の口座情報変更申請が申請履歴に表示される
   - ✅ 承認・却下された申請のステータスが正しく表示される

### 7.3. Firestoreセキュリティルール

1. **admin/hr**
   - ✅ 全従業員の`bankAccount`と`payrollSettings`を読み取り可能
   - ✅ 全従業員の`bankAccount`と`payrollSettings`を書き込み可能

2. **employee**
   - ✅ 自分の`bankAccount`と`payrollSettings`のみ読み取り可能
   - ✅ 自分の`bankAccount`と`payrollSettings`を直接書き込み不可（エラーになる）

3. **viewer**
   - ✅ `bankAccount`と`payrollSettings`を読み取り不可（エラーになる）

---

## 8. 既存機能への影響と注意点

### 8.1. 既存のChangeRequest実装との整合

- `ChangeRequestKind`に`'bankAccount'`を追加
- `ChangeRequestsService.create()`は既存のまま使用可能（`payload`に`BankAccountChangePayload`を渡す）
- `requests.page.ts`の`approve()`メソッドを拡張して`kind === 'bankAccount'`の処理を追加
- 既存の`'profile'`、`'dependent_*'`申請との互換性を保つ

**重要**: `payload`を`DependentRequestPayload | BankAccountChangePayload`のunion型に拡張する際、既存コードで`payload`を`DependentRequestPayload`前提で使っている箇所を修正する必要があります：

1. **`src/app/pages/requests/requests.page.ts`の`getTargetDependentLabel()`メソッド**:
   - `request.kind === 'bankAccount'`の場合は`'-'`を返すように分岐を追加
   - 既存の`dependent_*`処理は`kind`で分岐しているため、そのまま維持可能
   ```typescript
   getTargetDependentLabel(request: ChangeRequest): string {
     if (request.kind === 'profile' || request.kind === 'bankAccount') {
       return '-';
     }
     // 既存の dependent_* 処理はそのまま
     const payload = request.payload as
       | { name?: string; relationship?: string }
       | { dependentName?: string; relationship?: string }
       | undefined;
     // ...
   }
   ```

2. **`src/app/pages/me/my-page.ts`の`getTargetDependentLabel()`メソッド**:
   - 同様に`request.kind === 'bankAccount'`の場合は`'-'`を返すように分岐を追加

3. **`src/app/pages/requests/requests.page.ts`の`approve()`メソッド**:
   - `kind === 'bankAccount'`の場合の処理を追加
   - 既存の`dependent_*`処理は`kind`で分岐しているため、そのまま維持可能

### 8.2. 既存のEmployee / /me / employeesページの構造

- `Employee`型に`bankAccount`と`payrollSettings`を追加するだけなので、既存のコードへの影響は最小限
- `EmployeesService.save()`は既存の実装パターン（`undefined`フィールドの除外）に従うため、追加の変更は不要
- `/me`ページに新しいカードを追加するだけなので、既存のカードへの影響はなし

### 8.3. 既存のFirestoreルール

- `validBankAccount()`と`validPayrollSettings()`関数を新規追加
- **既存の`validEmployeeExtendedFields()`関数の既存条件は削除せず、そのまま維持する**
- 既存条件の末尾に`&& validBankAccount(data) && validPayrollSettings(data)`を追加することで、既存のバリデーションロジックに新しいチェックを追加する
- 既存の`allow read`条件はそのまま維持（`viewer`ロールは既に除外されている）
- 既存の`allow create, update`条件は`validEmployeeExtendedFields()`を使用しているため、追加の変更は不要（関数内で統合済み）
- 既存のルールとの競合はなし

### 8.4. CSVインポート・エクスポートとの関係

- **今回のスコープ外**: CSVインポート・エクスポートへの統合は行わない
- 将来の拡張として、`bankAccount`と`payrollSettings`をCSVに含めることを検討

### 8.5. 社保シミュレーションとの関係

- **今回のスコープ外**: `insurableMonthlyWage`から標準報酬月額・等級の自動サジェストは実装しない
- 将来の拡張として、`insurableMonthlyWage`をもとに標準報酬月額・等級の初期候補を自動算出する機能を検討

---

## 9. 実装ファイル一覧

### 9.1. 型定義

- `src/app/types.ts`
  - `BankAccountType`型の追加
  - `BankAccount`インターフェースの追加
  - `PayrollPayType`型の追加
  - `PayrollPayCycle`型の追加
  - `PayrollSettings`インターフェースの追加
  - `BankAccountChangePayload`インターフェースの追加
  - `ChangeRequestKind`型に`'bankAccount'`を追加
  - `ChangeRequest`インターフェースの`payload`型を拡張
  - `Employee`インターフェースに`bankAccount`と`payrollSettings`を追加

### 9.2. サービス

- `src/app/services/employees.service.ts`
  - 既存の`save()`メソッドで`bankAccount`と`payrollSettings`を保存できるようにする（追加の変更は不要、既存の実装パターンで対応可能）

- `src/app/services/change-requests.service.ts`
  - 既存のまま使用可能（追加の変更は不要）

### 9.3. コンポーネント

- `src/app/pages/employees/employee-form-dialog.component.ts`
  - 「給与振込口座情報」セクションの追加
  - 「給与情報（保険用）」セクションの追加
  - フォームコントロールとバリデーションの追加

- `src/app/pages/employees/employee-detail-dialog.component.ts`
  - 「給与振込口座情報」セクションの追加
  - 「給与情報（保険用）」セクションの追加
  - `DialogFocusSection`型に`'bankAccount'`と`'payrollSettings'`を追加

- `src/app/pages/me/my-page.ts`
  - 「給与振込口座」カードの追加
  - 「給与情報（保険用）」カードの追加
  - 「口座情報を変更申請」ボタンの追加

- `src/app/pages/requests/bank-account-change-request-form-dialog.component.ts`（新規作成）
  - 口座情報変更申請フォームダイアログ

- `src/app/pages/requests/requests.page.ts`（既存ファイル）
  - `getTargetDependentLabel()`メソッドに`kind === 'bankAccount'`の分岐を追加（`'-'`を返す）
  - `approve()`メソッドに`kind === 'bankAccount'`の処理を追加
  - 申請一覧表示で`kind === 'bankAccount'`の申請を正しく表示

### 9.4. ユーティリティ

- `src/app/utils/label-utils.ts`
  - `getBankAccountTypeLabel()`関数の追加
  - `getPayrollPayTypeLabel()`関数の追加
  - `getPayrollPayCycleLabel()`関数の追加
  - `getChangeRequestKindLabel()`関数に`'bankAccount'`のラベルを追加

### 9.5. Firestoreルール

- `firestore.rules`（既存ファイル）
  - `validBankAccount()`関数の追加（新規）
  - `validPayrollSettings()`関数の追加（新規）
  - **既存の`validEmployeeExtendedFields()`関数の既存条件は削除せず、そのまま維持する**
  - 既存条件の末尾に`&& validBankAccount(data) && validPayrollSettings(data)`を追加
  - 既存の`allow create, update`条件は`validEmployeeExtendedFields()`を使用しているため、追加の変更は不要（関数内で統合済み）

---

## 10. 実装手順（推奨順序）

### Step 1: 型定義の追加

1. `src/app/types.ts`に以下を追加:
   - `BankAccountType`型
   - `BankAccount`インターフェース
   - `PayrollPayType`型
   - `PayrollPayCycle`型
   - `PayrollSettings`インターフェース
   - `BankAccountChangePayload`インターフェース
   - `ChangeRequestKind`型に`'bankAccount'`を追加
   - `ChangeRequest`インターフェースの`payload`型を拡張
   - `Employee`インターフェースに`bankAccount`と`payrollSettings`を追加

### Step 2: ラベル変換関数の追加

1. `src/app/utils/label-utils.ts`に以下を追加:
   - `getBankAccountTypeLabel()`
   - `getPayrollPayTypeLabel()`
   - `getPayrollPayCycleLabel()`
   - `getChangeRequestKindLabel()`に`'bankAccount'`のラベルを追加

### Step 3: 従業員追加・編集フォームの拡張

1. `src/app/pages/employees/employee-form-dialog.component.ts`に以下を追加:
   - 「給与振込口座情報」セクション（フォームコントロールとバリデーション）
   - 「給与情報（保険用）」セクション（フォームコントロールとバリデーション）
   - `submit()`メソッドで`bankAccount`と`payrollSettings`を保存

### Step 4: 従業員詳細ダイアログの拡張

1. `src/app/pages/employees/employee-detail-dialog.component.ts`に以下を追加:
   - 「給与振込口座情報」セクション
   - 「給与情報（保険用）」セクション
   - `DialogFocusSection`型に`'bankAccount'`と`'payrollSettings'`を追加
   - セクションナビに新しいセクションを追加

### Step 5: マイページの拡張

1. `src/app/pages/me/my-page.ts`（既存ファイル）に以下を追加:
   - 「給与振込口座」カード
   - 「給与情報（保険用）」カード
   - 「口座情報を変更申請」ボタン（`bank-account-change-request-form-dialog.component.ts`を開く）
   - `getTargetDependentLabel()`メソッドに`kind === 'bankAccount'`の分岐を追加（`'-'`を返す）

### Step 6: 口座情報変更申請フォームの作成

1. `src/app/pages/requests/bank-account-change-request-form-dialog.component.ts`を新規作成:
   - 現在の口座情報の表示（読み取り専用、`employees/{employeeId}.bankAccount`から取得）
   - 新しい口座情報の入力フォーム（`ChangeRequest.payload`に格納）
   - `ChangeRequestsService.create()`を呼び出して申請を作成

### Step 7: ChangeRequest承認処理の拡張

1. `src/app/pages/requests/requests.page.ts`（既存ファイル）を拡張:
   - `getTargetDependentLabel()`メソッドに`kind === 'bankAccount'`の分岐を追加（`'-'`を返す）
   - `approve()`メソッドに`kind === 'bankAccount'`の場合の処理を追加
   - `employees/{employeeId}.bankAccount`を`payload`の内容で更新

2. `src/app/pages/me/my-page.ts`（既存ファイル）の`getTargetDependentLabel()`メソッドも同様に修正:
   - `request.kind === 'bankAccount'`の場合は`'-'`を返すように分岐を追加

### Step 8: Firestoreルールの追加

1. `firestore.rules`（既存ファイル）に以下を追加:
   - `validBankAccount()`関数（新規追加）
   - `validPayrollSettings()`関数（新規追加）
   - **既存の`validEmployeeExtendedFields()`関数の既存条件は削除せず、そのまま維持する**
   - 既存条件の末尾に`&& validBankAccount(data) && validPayrollSettings(data)`を追加
   - 既存の`allow create, update`条件は`validEmployeeExtendedFields()`を使用しているため、追加の変更は不要（関数内で統合済み）

### Step 9: テスト・動作確認

1. 管理者・人事側のテスト（従業員追加・編集・詳細表示・ChangeRequest承認）
2. 従業員側のテスト（マイページ表示・口座情報変更申請）
3. Firestoreセキュリティルールのテスト（各ロールでの読み書き権限）

---

## 11. 補足事項

### 11.1. 将来の拡張候補

- CSVインポート・エクスポートへの統合
- `insurableMonthlyWage`から標準報酬月額・等級の自動サジェスト
- 複数口座対応
- 給与情報（payrollSettings）の変更申請機能
- 口座情報のマスキング表示（セキュリティ強化）
- 口座情報変更申請に任意のコメントフィールドを追加する（変更理由・コメント機能）

### 11.2. 注意事項

- `bankAccount`と`payrollSettings`は任意フィールドのため、既存の従業員データには影響しない
- `accountNumber`は先頭0を含む可能性があるため、`string`型とする（数値型にしない）
- `insurableMonthlyWage`は将来の自動サジェスト機能を見据えて、明示的に「保険上の月額給与」として定義する
- ChangeRequestの承認処理は、既存の`'profile'`、`'dependent_*'`申請と同じパターンで実装する

---

以上でPhase3-15の実装指示書は完了です。実装時は、この指示書に従って段階的に実装を進めてください。

