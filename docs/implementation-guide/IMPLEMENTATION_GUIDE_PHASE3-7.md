# Phase3-7 実装指示書: e-Gov用必要情報の先行実装

**作成日**: 2025年12月2日  
**対象フェーズ**: Phase3-7  
**目標完了日**: 2025年12月9日

---

## 1. 概要（Overview）

### 1.1. 目的

Phase3-7では、**e-Gov電子申請（CSVファイル添付方式）で必要となる情報を、事前にInsurePath側で管理できる状態にする**ことを目的とします。

Phase3-8（e-Gov電子申請連携機能）の実装前に、CSV出力に必要なコア項目をInsurePathのデータモデルに追加し、ユーザーが入力・管理できるUIを提供します。

### 1.2. 対象エンティティ

- **Office（事業所）**: 事業所識別情報・基本情報の拡張
- **Employee（従業員）**: 基本情報・番号系情報の拡張
- **Dependent（被扶養者）**: 基本情報・番号系情報の拡張
- **MyNumber管理**: マイナンバー（個人番号）の管理枠組み

### 1.3. Out of Scope（スコープ外）

以下の項目は、Phase3-7では実装しません（Phase3-8以降で対応予定）：

- **手続きレコード固有フィールドの追加**: 各手続きタイプ（資格取得届・資格喪失届・算定基礎届・月額変更届・賞与支払届・被扶養者異動届）ごとの詳細項目は、Phase3-8で実装
- **e-Gov CSV生成ロジック**: CSV生成機能自体はPhase3-8で実装
- **e-Govステータス管理**: 手続きレコードへのe-Govステータス追加はPhase3-8で実装
- **被扶養者の詳細判定項目**: 年間収入・生計維持関係・国内居住フラグなどは、Phase3-7では最低限の項目のみ実装
- **従業員の被保険者区分詳細化**: 一般／短時間／70歳以上の詳細区分は将来の拡張として検討

---

## 1.4. 実装時の注意事項

### ファイルパスの確認

本指示書では、以下のファイルパスを例として記載していますが、**実装時は実際のプロジェクト構成に合わせてファイルパスを確認してください**:

- `src/app/pages/offices/offices.page.ts`
- `src/app/pages/employees/employee-form-dialog.component.ts`
- `src/app/pages/employees/dependent-form-dialog.component.ts`
- `src/app/services/mynumber.service.ts`
- `src/app/types.ts`
- `firestore.rules`

実際のリポジトリ構成と異なる場合は、適宜パスを修正してください。

---

## 2. 変更対象一覧（Scope Summary）

### 2.1. MUST（Phase3-7で必ず実装）

| カテゴリ | フィールド論理名 | 実装フィールド名 | 型 | 必須/任意 | 優先度 | 備考 |
|---------|----------------|----------------|-----|----------|--------|------|
| office | 事業所記号 | `officeSymbol` | `string?` | 任意 | MUST | e-Gov CSV必須 |
| office | 事業所番号 | `officeNumber` | `string?` | 任意 | MUST | e-Gov CSV必須 |
| office | 郡市区符号 | `officeCityCode` | `string?` | 任意 | MUST | e-Gov CSV必須 |
| office | 郵便番号 | `officePostalCode` | `string?` | 任意 | MUST | 7桁（ハイフンなし） |
| office | 電話番号 | `officePhone` | `string?` | 任意 | MUST | - |
| office | 事業主（代表者）氏名 | `officeOwnerName` | `string?` | 任意 | MUST | - |
| employee | 被保険者整理番号 | `employeeCodeInOffice` | `string?` | 任意 | MUST | 社内従業員番号としても使用可 |
| employee | 性別コード | `sex` | `'male' \| 'female' \| 'other' \| null` | 任意 | MUST | enum型で実装 |
| employee | 郵便番号 | `postalCode` | `string?` | 任意 | MUST | 7桁（ハイフンなし） |
| employee | 住所カナ | `addressKana` | `string?` | 任意 | MUST | - |
| employee | マイナンバー | `myNumber` | `string?` | 任意 | MUST | 12桁、MyNumberService経由で管理 |
| dependent | 氏名カナ | `kana` | `string?` | 任意 | SHOULD | 被扶養者情報のコア拡張 |
| dependent | 性別 | `sex` | `'male' \| 'female' \| 'other' \| null` | 任意 | SHOULD | 被扶養者情報のコア拡張 |
| dependent | 郵便番号 | `postalCode` | `string?` | 任意 | SHOULD | 被扶養者情報のコア拡張 |
| dependent | 住所 | `address` | `string?` | 任意 | SHOULD | 被扶養者情報のコア拡張 |
| dependent | 同居／別居 | `cohabitationFlag` | `'cohabiting' \| 'separate' \| null` | 任意 | SHOULD | 被扶養者情報のコア拡張 |
| dependent | マイナンバー | `myNumber` | `string?` | 任意 | MUST | 12桁、MyNumberService経由で管理 |

### 2.2. SHOULD（時間が許す範囲で実装）

上記の被扶養者情報のコア拡張（`kana`, `sex`, `postalCode`, `address`, `cohabitationFlag`）は、時間が許す範囲で実装してください。

### 2.3. LATER（将来の候補）

以下の項目は、Phase3-7では実装しませんが、将来の拡張候補として記載します：

- `employee.insuredCategory`: 一般／短時間／70歳以上の被保険者区分詳細化
- `office.officeSubmissionDestType`: 年金事務所／健保組合等の詳細区分
- `employee.cannotUseResidenceAddressReason`: 住民票住所を使えない理由コード
- `employee.personalNumberNote`: 個人番号関連の備考
- `dependent.dependentAnnualIncome`: 年間収入額
- `dependent.livelihoodSupportRelation`: 生計維持関係の区分
- `dependent.domesticResidenceFlag`: 国内居住フラグ

---

## 3. データモデル変更（Type定義）

### 3.1. `src/app/types.ts` の変更

#### 3.1.1. Office型の拡張

```typescript
export interface Office {
  id: string;
  name: string;
  address?: string;
  healthPlanType: HealthPlanType;
  kyokaiPrefCode?: string;
  kyokaiPrefName?: string;
  unionName?: string;
  unionCode?: string;
  
  // Phase3-7で追加: 事業所識別情報
  /** 事業所記号（e-Gov CSV必須） */
  officeSymbol?: string;
  /** 事業所番号（e-Gov CSV必須） */
  officeNumber?: string;
  /** 郡市区符号（e-Gov CSV必須） */
  officeCityCode?: string;
  
  // Phase3-7で追加: 事業所基本情報
  /** 郵便番号（7桁、ハイフンなし） */
  officePostalCode?: string;
  /** 電話番号 */
  officePhone?: string;
  /** 事業主（代表者）氏名 */
  officeOwnerName?: string;
  
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}
```

**注意事項**:
- `officeSymbol` + `officeNumber` + `officeCityCode` + `kyokaiPrefCode` で「適用事業所番号」を構成できる想定
- すべて任意フィールド（`?`）として追加し、既存データへの影響を避ける

#### 3.1.2. Employee型の拡張

```typescript
export interface Employee {
  id: string;
  officeId: string;
  name: string;
  kana?: string;
  birthDate: IsoDateString;
  department?: string;
  hireDate: IsoDateString;
  retireDate?: IsoDateString;
  employmentType: EmploymentType;
  address?: string;
  phone?: string;
  contactEmail?: string;

  // Phase3-7で追加: 従業員基本情報の拡張
  /** 被保険者整理番号／社内従業員番号 */
  employeeCodeInOffice?: string;
  /** 性別コード */
  sex?: Sex;
  /** 郵便番号（7桁、ハイフンなし） */
  postalCode?: string;
  /** 住所カナ */
  addressKana?: string;

  /** 所定労働条件 */
  weeklyWorkingHours?: number;
  weeklyWorkingDays?: number;
  contractPeriodNote?: string;
  isStudent?: boolean;

  /** 社会保険上の報酬月額（手当込みの月給ベース） */
  monthlyWage: number;

  /** 社会保険の加入対象かどうか（true のみ計算対象） */
  isInsured: boolean;

  /** 保険関連番号 */
  healthInsuredSymbol?: string;
  healthInsuredNumber?: string;
  /** 基礎年金番号（厚生年金被保険者番号） */
  pensionNumber?: string;
  
  // Phase3-7で追加: マイナンバー管理
  /** 個人番号（マイナンバー）
   * 
   * ⚠️ 重要: 本番運用では必ず暗号化・アクセス制御を強化すること
   * - MyNumberService経由でのみ read/write すること
   * - UI上はマスク表示（例: *******1234）を基本とする
   * - 生データ表示は管理者のみに限定すること
   * 
   * 将来の暗号化実装時には、MyNumberService内部の実装を差し替えるだけで済むように設計すること
   */
  myNumber?: string;

  // ... 既存フィールド（healthQualificationDate, pensionQualificationDate 等）はそのまま ...
  
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  updatedByUserId?: string;
}
```

**注意事項**:
- `sex`はenum型（`'male' | 'female' | 'other' | null`）で実装
- `myNumber`は12桁の数字のみを許可（バリデーションでチェック）
- `pensionNumber`は既存のまま使用（将来の分解対応はPhase3-8以降で検討）

#### 3.1.3. Dependent型の拡張

```typescript
export interface Dependent {
  id: string;
  name: string;
  
  // Phase3-7で追加: 被扶養者基本情報の拡張
  /** 被扶養者氏名カナ */
  kana?: string;
  /** 性別コード */
  sex?: Sex;
  /** 郵便番号（7桁、ハイフンなし） */
  postalCode?: string;
  /** 住所 */
  address?: string;
  /** 同居／別居フラグ */
  cohabitationFlag?: CohabitationFlag;
  
  relationship: DependentRelationship;
  dateOfBirth: IsoDateString;
  
  // Phase3-7で追加: マイナンバー管理
  /** 被扶養者の個人番号（マイナンバー）
   * 
   * ⚠️ 重要: 本番運用では必ず暗号化・アクセス制御を強化すること
   * - MyNumberService経由でのみ read/write すること
   * - UI上はマスク表示（例: *******1234）を基本とする
   * - 生データ表示は管理者のみに限定すること
   */
  myNumber?: string;
  
  qualificationAcquiredDate?: IsoDateString;
  qualificationLossDate?: IsoDateString;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}
```

**注意事項**:
- `sex`は`Sex`型エイリアスを使用（Employee型と同じ）
- `cohabitationFlag`は`CohabitationFlag`型エイリアスを使用

#### 3.1.4. 型エイリアスの定義（再利用可能な型）

```typescript
// Phase3-7: 性別・同居別居フラグの型エイリアス定義
// Employee / Dependent 両方で使用するため、型エイリアスとして定義

/**
 * 性別コード
 */
export type Sex = 'male' | 'female' | 'other' | null;

/**
 * 同居／別居フラグ
 */
export type CohabitationFlag = 'cohabiting' | 'separate' | null;

/**
 * 個人番号（マイナンバー）の型定義
 * 
 * 現時点では string として扱うが、将来の暗号化実装時には
 * MyNumberService 内部の実装を差し替えるだけで済むように設計すること
 * 
 * 注意: MyNumberに関するバリデーション・マスク表示は、
 * MyNumberService に集約されているため、ここでは型定義のみを行う
 */
export type MyNumber = string;
```

**注意事項**:
- `Sex`型と`CohabitationFlag`型を型エイリアスとして定義し、Employee/Dependent両方で再利用
- MyNumberのバリデーション・マスク表示は`MyNumberService`に集約（後述）

---

## 4. フロントエンド実装方針（フォーム・サービス）

### 4.1. 事業所設定画面の拡張

#### 4.1.1. 対象ファイル

- `src/app/pages/offices/offices.page.ts`

**注意**: 実装時は、実際のプロジェクト構成に合わせてファイルパスを確認してください。

#### 4.1.2. 追加する入力項目

**新しいセクション: 「e-Gov用事業所情報」**を追加

| フィールド名 | ラベル | プレースホルダー | バリデーション | FormControl名 |
|------------|--------|----------------|---------------|--------------|
| `officeSymbol` | 事業所記号 | 例: 1234 | 任意、最大20文字 | `officeSymbol` |
| `officeNumber` | 事業所番号 | 例: 567890 | 任意、最大20文字 | `officeNumber` |
| `officeCityCode` | 郡市区符号 | 例: 01 | 任意、最大10文字 | `officeCityCode` |
| `officePostalCode` | 郵便番号 | 例: 1234567 | 任意、7桁数字（ハイフンなし） | `officePostalCode` |
| `officePhone` | 電話番号 | 例: 03-1234-5678 | 任意、最大20文字 | `officePhone` |
| `officeOwnerName` | 事業主（代表者）氏名 | 例: 山田 太郎 | 任意、最大100文字 | `officeOwnerName` |

#### 4.1.3. 実装手順

1. `offices.page.ts`のFormGroupに新しいFormControlを追加:
   ```typescript
   form = this.fb.group({
     name: ['', Validators.required],
     address: [''],
     healthPlanType: ['kyokai', Validators.required],
     kyokaiPrefCode: [''],
     kyokaiPrefName: [''],
     unionName: [''],
     unionCode: [''],
     // Phase3-7で追加
     officeSymbol: [''],
     officeNumber: [''],
     officeCityCode: [''],
     officePostalCode: ['', [Validators.pattern(/^\d{7}$/)]], // 7桁数字のみ
     officePhone: [''],
     officeOwnerName: ['']
   });
   ```

2. テンプレートに新しいセクションを追加:
   ```html
   <div class="form-section">
     <h3 class="section-title">
       <mat-icon>business_center</mat-icon>
       e-Gov用事業所情報
     </h3>
     <div class="form-grid">
       <mat-form-field appearance="outline">
         <mat-label>事業所記号</mat-label>
         <input matInput formControlName="officeSymbol" />
         <mat-hint>e-Gov CSV出力に必要です</mat-hint>
       </mat-form-field>
       
       <mat-form-field appearance="outline">
         <mat-label>事業所番号</mat-label>
         <input matInput formControlName="officeNumber" />
         <mat-hint>e-Gov CSV出力に必要です</mat-hint>
       </mat-form-field>
       
       <mat-form-field appearance="outline">
         <mat-label>郡市区符号</mat-label>
         <input matInput formControlName="officeCityCode" />
         <mat-hint>e-Gov CSV出力に必要です</mat-hint>
       </mat-form-field>
       
       <mat-form-field appearance="outline">
         <mat-label>郵便番号</mat-label>
         <input matInput formControlName="officePostalCode" 
                placeholder="1234567" 
                maxlength="7" />
         <mat-hint>7桁の数字（ハイフンなし）</mat-hint>
         <mat-error *ngIf="form.get('officePostalCode')?.hasError('pattern')">
           7桁の数字を入力してください
         </mat-error>
       </mat-form-field>
       
       <mat-form-field appearance="outline">
         <mat-label>電話番号</mat-label>
         <input matInput formControlName="officePhone" />
       </mat-form-field>
       
       <mat-form-field appearance="outline">
         <mat-label>事業主（代表者）氏名</mat-label>
         <input matInput formControlName="officeOwnerName" />
       </mat-form-field>
     </div>
   </div>
   ```

3. `save()`メソッドで新しいフィールドを保存:
   ```typescript
   const office: Partial<Office> = {
     name: formValue.name,
     address: formValue.address,
     healthPlanType: formValue.healthPlanType,
     // ... 既存フィールド ...
     // Phase3-7で追加
     officeSymbol: formValue.officeSymbol || undefined,
     officeNumber: formValue.officeNumber || undefined,
     officeCityCode: formValue.officeCityCode || undefined,
     officePostalCode: formValue.officePostalCode || undefined,
     officePhone: formValue.officePhone || undefined,
     officeOwnerName: formValue.officeOwnerName || undefined
   };
   ```

### 4.2. 従業員登録／編集画面の拡張

#### 4.2.1. 対象ファイル

- `src/app/pages/employees/employee-form-dialog.component.ts`

**注意**: 実装時は、実際のプロジェクト構成に合わせてファイルパスを確認してください。

#### 4.2.2. 追加する入力項目

**既存の「基本情報」セクションに追加**

| フィールド名 | ラベル | プレースホルダー | バリデーション | FormControl名 |
|------------|--------|----------------|---------------|--------------|
| `employeeCodeInOffice` | 被保険者整理番号 | 例: EMP001 | 任意、最大50文字 | `employeeCodeInOffice` |
| `sex` | 性別 | - | 任意、enum選択 | `sex` |
| `postalCode` | 郵便番号 | 例: 1234567 | 任意、7桁数字（ハイフンなし） | `postalCode` |
| `addressKana` | 住所カナ | 例: トウキョウト... | 任意、最大200文字 | `addressKana` |
| `myNumber` | マイナンバー | 例: 123456789012 | 任意、12桁数字 | `myNumber` |

#### 4.2.3. 実装手順

1. `employee-form-dialog.component.ts`のFormGroupに新しいFormControlを追加:
   ```typescript
   import { MyNumberService } from '../../services/mynumber.service';
   import { Sex } from '../../types';
   
   // ...
   
   constructor(
     // ... 既存の依存注入 ...
     private readonly myNumberService: MyNumberService
   ) {}
   
   form = this.fb.group({
     name: ['', Validators.required],
     kana: [''],
     birthDate: ['', Validators.required],
     // ... 既存フィールド ...
     // Phase3-7で追加
     employeeCodeInOffice: [''],
     sex: [null as Sex],
     postalCode: ['', [Validators.pattern(/^\d{7}$/)]], // 7桁数字のみ
     addressKana: [''],
     myNumber: ['', [
       Validators.pattern(/^\d{12}$/), // 12桁数字のみ
       (control) => {
         // MyNumberService経由でバリデーション（MyNumber関連の処理はMyNumberServiceに集約）
         if (control.value && !this.myNumberService.isValid(control.value)) {
           return { invalidMyNumber: true };
         }
         return null;
       }
     ]]
   });
   ```

2. テンプレートに新しい入力項目を追加（「基本情報」セクション内）:
   ```html
   <mat-form-field appearance="outline">
     <mat-label>被保険者整理番号</mat-label>
     <input matInput formControlName="employeeCodeInOffice" />
     <mat-hint>社内従業員番号としても使用できます</mat-hint>
   </mat-form-field>

   <mat-form-field appearance="outline">
     <mat-label>性別</mat-label>
     <mat-select formControlName="sex">
       <mat-option [value]="null">未選択</mat-option>
       <mat-option value="male">男</mat-option>
       <mat-option value="female">女</mat-option>
       <mat-option value="other">その他</mat-option>
     </mat-select>
   </mat-form-field>

   <mat-form-field appearance="outline">
     <mat-label>郵便番号</mat-label>
     <input matInput formControlName="postalCode" 
            placeholder="1234567" 
            maxlength="7" />
     <mat-hint>7桁の数字（ハイフンなし）</mat-hint>
     <mat-error *ngIf="form.get('postalCode')?.hasError('pattern')">
       7桁の数字を入力してください
     </mat-error>
   </mat-form-field>

   <mat-form-field appearance="outline">
     <mat-label>住所カナ</mat-label>
     <textarea matInput formControlName="addressKana" rows="2"></textarea>
   </mat-form-field>

   <mat-form-field appearance="outline" class="full-width">
     <mat-label>マイナンバー</mat-label>
     <input matInput formControlName="myNumber" 
            placeholder="123456789012" 
            maxlength="12"
            type="password" /> <!-- セキュリティのため password タイプ -->
     <mat-hint>12桁の数字（入力時は非表示）</mat-hint>
     <mat-error *ngIf="form.get('myNumber')?.hasError('pattern')">
       12桁の数字を入力してください
     </mat-error>
     <mat-error *ngIf="form.get('myNumber')?.hasError('invalidMyNumber')">
       正しい形式のマイナンバーを入力してください
     </mat-error>
   </mat-form-field>
   ```

3. `submit()`メソッドで新しいフィールドを保存（MyNumberService経由）:
   ```typescript
   // MyNumberServiceは既にconstructorで注入済み
   
   async submit(): Promise<void> {
     const formValue = this.form.getRawValue();
     
     // MyNumberはMyNumberService経由で保存（非同期で暗号化）
     const myNumberValue = formValue.myNumber 
       ? await this.myNumberService.encrypt(formValue.myNumber)
       : undefined;
     
     const employee: Partial<Employee> = {
       name: formValue.name,
       kana: formValue.kana || undefined,
       // ... 既存フィールド ...
       // Phase3-7で追加
       employeeCodeInOffice: formValue.employeeCodeInOffice || undefined,
       sex: formValue.sex || undefined,
       postalCode: formValue.postalCode || undefined,
       addressKana: formValue.addressKana || undefined,
       myNumber: myNumberValue
     };
     
     // ... 保存処理 ...
   }
   ```

4. 表示時はMyNumberService経由で取得・マスク表示:
   ```typescript
   // 既存データの読み込み時
   if (this.data.employee?.myNumber) {
     const decrypted = await this.myNumberService.decrypt(this.data.employee.myNumber);
     // 表示時はマスク（入力欄には生データを表示しない）
     this.form.patchValue({
       // ... 他のフィールド ...
       // myNumberは表示しない（セキュリティのため）
     });
   }
   ```

### 4.3. 被扶養者登録／編集画面の拡張

#### 4.3.1. 対象ファイル

- `src/app/pages/employees/dependent-form-dialog.component.ts`

**注意**: 実装時は、実際のプロジェクト構成に合わせてファイルパスを確認してください。

#### 4.3.2. 追加する入力項目

| フィールド名 | ラベル | プレースホルダー | バリデーション | FormControl名 |
|------------|--------|----------------|---------------|--------------|
| `kana` | 氏名カナ | 例: ヤマダ ハナコ | 任意、最大100文字 | `kana` |
| `sex` | 性別 | - | 任意、enum選択 | `sex` |
| `postalCode` | 郵便番号 | 例: 1234567 | 任意、7桁数字（ハイフンなし） | `postalCode` |
| `address` | 住所 | 例: 東京都... | 任意、最大200文字 | `address` |
| `cohabitationFlag` | 同居／別居 | - | 任意、enum選択 | `cohabitationFlag` |
| `myNumber` | マイナンバー | 例: 123456789012 | 任意、12桁数字 | `myNumber` |

#### 4.3.3. 実装手順

1. `dependent-form-dialog.component.ts`のFormGroupに新しいFormControlを追加:
   ```typescript
   import { MyNumberService } from '../../services/mynumber.service';
   import { Sex, CohabitationFlag } from '../../types';
   
   // ...
   
   constructor(
     // ... 既存の依存注入 ...
     private readonly myNumberService: MyNumberService
   ) {}
   
   // 注意: nonNullable.groupではなく、通常のgroupを使用
   // sex / cohabitationFlag は null を許容するため（未選択状態を許可）
   form = this.fb.group({
     name: ['', [Validators.required, Validators.maxLength(100)]],
     relationship: ['', Validators.required],
     dateOfBirth: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
     qualificationAcquiredDate: ['', Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)],
     qualificationLossDate: ['', Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)],
     // Phase3-7で追加
     kana: ['', Validators.maxLength(100)],
     sex: [null as Sex],
     postalCode: ['', [Validators.pattern(/^\d{7}$/)]],
     address: ['', Validators.maxLength(200)],
     cohabitationFlag: [null as CohabitationFlag],
     myNumber: ['', [
       Validators.pattern(/^\d{12}$/),
       (control) => {
         // MyNumberService経由でバリデーション（MyNumber関連の処理はMyNumberServiceに集約）
         if (control.value && !this.myNumberService.isValid(control.value)) {
           return { invalidMyNumber: true };
         }
         return null;
       }
     ]]
   });
   ```

2. テンプレートに新しい入力項目を追加:
   ```html
   <mat-form-field appearance="outline" class="full-width">
     <mat-label>氏名カナ</mat-label>
     <input matInput formControlName="kana" />
   </mat-form-field>

   <mat-form-field appearance="outline" class="full-width">
     <mat-label>性別</mat-label>
     <mat-select formControlName="sex">
       <mat-option [value]="null">未選択</mat-option>
       <mat-option value="male">男</mat-option>
       <mat-option value="female">女</mat-option>
       <mat-option value="other">その他</mat-option>
     </mat-select>
   </mat-form-field>

   <mat-form-field appearance="outline" class="full-width">
     <mat-label>郵便番号</mat-label>
     <input matInput formControlName="postalCode" 
            placeholder="1234567" 
            maxlength="7" />
     <mat-hint>7桁の数字（ハイフンなし）</mat-hint>
     <mat-error *ngIf="form.controls.postalCode.hasError('pattern')">
       7桁の数字を入力してください
     </mat-error>
   </mat-form-field>

   <mat-form-field appearance="outline" class="full-width">
     <mat-label>住所</mat-label>
     <textarea matInput formControlName="address" rows="2"></textarea>
   </mat-form-field>

   <mat-form-field appearance="outline" class="full-width">
     <mat-label>同居／別居</mat-label>
     <mat-select formControlName="cohabitationFlag">
       <mat-option [value]="null">未選択</mat-option>
       <mat-option value="cohabiting">同居</mat-option>
       <mat-option value="separate">別居</mat-option>
     </mat-select>
   </mat-form-field>

   <mat-form-field appearance="outline" class="full-width">
     <mat-label>マイナンバー</mat-label>
     <input matInput formControlName="myNumber" 
            placeholder="123456789012" 
            maxlength="12"
            type="password" />
     <mat-hint>12桁の数字（入力時は非表示）</mat-hint>
     <mat-error *ngIf="form.controls.myNumber.hasError('pattern')">
       12桁の数字を入力してください
     </mat-error>
   </mat-form-field>
   ```

3. `submit()`メソッドで新しいフィールドを保存（MyNumberService経由）:
   ```typescript
   // MyNumberServiceは既にconstructorで注入済み
   
   async submit(): Promise<void> {
     const value = this.form.getRawValue();
     
     // MyNumberはMyNumberService経由で保存（非同期で暗号化）
     const myNumberValue = value.myNumber 
       ? await this.myNumberService.encrypt(value.myNumber)
       : undefined;
     
     const payload: Partial<Dependent> & { id?: string } = {
       id: this.data.dependent?.id,
       name: value.name.trim(),
       kana: value.kana?.trim() || undefined,
       sex: value.sex || undefined,
       postalCode: value.postalCode || undefined,
       address: value.address?.trim() || undefined,
       cohabitationFlag: value.cohabitationFlag || undefined,
       myNumber: myNumberValue,
       relationship: value.relationship as DependentRelationship,
       dateOfBirth: value.dateOfBirth,
       qualificationAcquiredDate: value.qualificationAcquiredDate || undefined,
       qualificationLossDate: value.qualificationLossDate || undefined
     };
     
     this.dialogRef.close(payload);
   }
   ```

### 4.4. サービス層の変更

#### 4.4.1. OfficesService

- `src/app/services/offices.service.ts` は既存のまま使用可能（新フィールドは自動的に保存される）

#### 4.4.2. EmployeesService

- `src/app/services/employees.service.ts` は既存のまま使用可能（新フィールドは自動的に保存される）
- MyNumberの保存・取得は`MyNumberService`経由で行う（後述）

#### 4.4.3. DependentsService

- `src/app/services/dependents.service.ts` は既存のまま使用可能（新フィールドは自動的に保存される）
- MyNumberの保存・取得は`MyNumberService`経由で行う（後述）

---

## 5. MyNumber管理の方針（簡易版）

### 5.1. MyNumberServiceの作成

#### 5.1.1. ファイル作成

- `src/app/services/mynumber.service.ts`（新規作成）

#### 5.1.2. 実装方針

Phase3-7時点では、**フル暗号化実装までやりきらない前提**で、最低限の設計方針を実装します。

**重要**: 本番運用では必ず暗号化・アクセス制御を強化すること

#### 5.1.3. インターフェース設計

```typescript
import { Injectable } from '@angular/core';

/**
 * MyNumber（マイナンバー）管理サービス
 * 
 * ⚠️ 重要: 本番運用では必ず暗号化・アクセス制御を強化すること
 * 
 * 現時点では簡易実装（プレーン文字列保存）だが、
 * 将来の暗号化実装時には、このサービスの内部実装を差し替えるだけで
 * 済むように設計されている。
 * 
 * MyNumberに関するすべての処理（バリデーション・マスク表示・暗号化）は
 * このサービスに集約されているため、変更点は一箇所で済む。
 */
@Injectable({
  providedIn: 'root'
})
export class MyNumberService {
  
  /**
   * マイナンバーを暗号化して保存用の形式に変換する
   * 
   * 現時点では簡易実装（そのまま返す）だが、
   * 将来は Cloud Functions 経由などで非同期暗号化処理を実装すること。
   * 
   * 非同期メソッドとして定義することで、将来の暗号化実装時の差し替えが容易になる。
   * 
   * @param plainText 平文のマイナンバー（12桁数字）
   * @returns Promise<string> 暗号化済み文字列（現時点ではそのまま返す）
   */
  async encrypt(plainText: string): Promise<string> {
    // Phase3-7: 簡易実装（そのまま返す）
    // TODO: 本番運用では必ず暗号化処理を実装すること
    // 例: Firebase Admin SDK の暗号化機能を使用
    // 例: Cloud Functions 経由で暗号化
    if (!plainText || !/^\d{12}$/.test(plainText)) {
      throw new Error('Invalid MyNumber format');
    }
    return plainText;
  }
  
  /**
   * 保存されているマイナンバーを復号化する
   * 
   * 現時点では簡易実装（そのまま返す）だが、
   * 将来は Cloud Functions 経由などで非同期復号化処理を実装すること。
   * 
   * 非同期メソッドとして定義することで、将来の復号化実装時の差し替えが容易になる。
   * 
   * @param encrypted 暗号化済み文字列
   * @returns Promise<string> 平文のマイナンバー（12桁数字）
   */
  async decrypt(encrypted: string): Promise<string> {
    // Phase3-7: 簡易実装（そのまま返す）
    // TODO: 本番運用では必ず復号化処理を実装すること
    return encrypted;
  }
  
  /**
   * マイナンバーをマスク表示用の形式に変換する
   * 
   * @param myNumber マイナンバー（12桁数字）
   * @returns マスク済み文字列（例: "*******1234"）
   */
  mask(myNumber: string | null | undefined): string {
    if (!myNumber || myNumber.length !== 12) {
      return '****-****-****';
    }
    // 下4桁のみ表示
    return `*******${myNumber.slice(-4)}`;
  }
  
  /**
   * マイナンバーのバリデーション
   * 
   * MyNumberに関するバリデーションはすべてこのメソッドに集約されている。
   * フォーム側のカスタムバリデータからもこのメソッドを呼び出すこと。
   * 
   * @param value 検証する値
   * @returns 有効な場合 true
   */
  isValid(value: string | null | undefined): boolean {
    if (!value) return false;
    return /^\d{12}$/.test(value);
  }
}
```

#### 5.1.4. UI上の取扱い

- **入力時**: `type="password"`を使用して入力内容を非表示にする
- **表示時**: `MyNumberService.mask()`を使用してマスク表示（例: `*******1234`）
- **生データ表示**: 管理者（adminロール）のみに限定（Phase3-7では実装しないが、将来の拡張として設計に含める）

---

## 6. Firestoreルールの変更方針（概要）

### 6.1. 対象ファイル

- `firestore.rules`

### 6.2. 変更内容

#### 6.2.1. MyNumberフィールドのアクセス制御

**重要**: Firestoreルールはフィールド単位でマスクできないため、`allow read`が通る場合はドキュメント全体が読み取れてしまいます。

**現時点の方針**:
- Employee本人は自分のレコードを読み取れる（`isOwnEmployee`条件により）
- この場合、MyNumberフィールドも含めてドキュメント全体が読み取れる
- **本番運用では、MyNumber情報を別コレクションに切り出す設計を推奨**（後述）

**Phase3-7での実装**:
`offices/{officeId}/employees/{employeeId}` と `offices/{officeId}/employees/{employeeId}/dependents/{dependentId}` のルールに、MyNumberフィールドの型チェックを追加:

**重要**: 以下のサンプルコードでは、同じパス（`/employees/{employeeId}` や `/dependents/{dependentId}`）に対して複数の`match`ブロックが記載されていますが、**実際のFirestoreルールでは、同じパスに対して`match`ブロックは1つだけ**です。

実装時には、**既存の`match`ブロック内に、新フィールドの型チェックとMyNumberフィールドの型チェックを統合**してください。

```javascript
// employees コレクションのルール内
// 注意: 既存のmatchブロックに統合すること（新しく別のmatchブロックを作らない）
match /employees/{employeeId} {
  // 既存のルール...
  
  // Phase3-7: 既存の読み取りルール（employee本人も自分のレコードを読める）
  // 注意: Firestoreルールはフィールド単位でマスクできないため、
  // employee本人が自分のレコードを読む場合、myNumberフィールドも含めて
  // ドキュメント全体が読み取れる状態になる
  // 
  // 本番運用では、MyNumber情報を別コレクション（例: employeeSecrets）に
  // 切り出し、そこだけ admin/hr のみ read 許可する設計を推奨
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) || 
    (isInsureEmployee(officeId) && isOwnEmployee(officeId, employeeId))
  );
  
  allow update: if isAdminOrHr(officeId) && 
    // 既存の型チェック...
    // Phase3-7: myNumberフィールドの型チェックを追加
    (!('myNumber' in request.resource.data) || 
     request.resource.data.myNumber == null || 
     (request.resource.data.myNumber is string && 
      request.resource.data.myNumber.size() == 12 && 
      request.resource.data.myNumber.matches('^[0-9]{12}$')));
}

// dependents サブコレクションのルール内
match /dependents/{dependentId} {
  // 既存のルール...
  
  // Phase3-7: 読み取り権限をAdmin/HRに限定
  // （employee本人は被扶養者情報を直接読めない想定）
  allow read: if belongsToOffice(officeId) && isAdminOrHr(officeId);
  
  allow update: if isAdminOrHr(officeId) &&
    // 既存の型チェック...
    // Phase3-7: myNumberフィールドの型チェックを追加
    (!('myNumber' in request.resource.data) || 
     request.resource.data.myNumber == null || 
     (request.resource.data.myNumber is string && 
      request.resource.data.myNumber.size() == 12 && 
      request.resource.data.myNumber.matches('^[0-9]{12}$')));
}
```

**本番運用での推奨設計（将来の拡張）**:

MyNumber情報を別コレクションに切り出す場合の設計例:

```javascript
// メインのemployeesコレクションからMyNumberを分離
match /employees/{employeeId} {
  // myNumberフィールドは持たない（または常にマスク済み文字列のみ）
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) || 
    (isInsureEmployee(officeId) && isOwnEmployee(officeId, employeeId))
  );
}

// MyNumber専用の別コレクション（admin/hrのみ読み取り可能）
match /employeeSecrets/{employeeId} {
  allow read: if belongsToOffice(officeId) && isAdminOrHr(officeId);
  allow write: if belongsToOffice(officeId) && isAdminOrHr(officeId);
}
```

この設計により、employee本人は自分の基本情報は読めるが、MyNumber情報は読めない状態を実現できます。

#### 6.2.2. 新フィールドの型チェック

Office、Employee、Dependentの各ルールに、新フィールドの型チェックを追加:

**重要**: 以下のサンプルコードは「差分イメージ」として記載しています。実装時には、**既存の`match`ブロック内に統合**してください（同じパスに対して複数の`match`ブロックを作るとコンパイルエラーになります）。

```javascript
// offices コレクションのルール内
// 注意: 既存のmatchブロックに統合すること
match /offices/{officeId} {
  allow update: if isInsureAdmin(officeId) &&
    // 既存の型チェック...
    // Phase3-7: 新フィールドの型チェックを追加
    (!('officeSymbol' in request.resource.data) || 
     request.resource.data.officeSymbol == null || 
     request.resource.data.officeSymbol is string) &&
    (!('officeNumber' in request.resource.data) || 
     request.resource.data.officeNumber == null || 
     request.resource.data.officeNumber is string) &&
    (!('officeCityCode' in request.resource.data) || 
     request.resource.data.officeCityCode == null || 
     request.resource.data.officeCityCode is string) &&
    (!('officePostalCode' in request.resource.data) || 
     request.resource.data.officePostalCode == null || 
     request.resource.data.officePostalCode is string) &&
    (!('officePhone' in request.resource.data) || 
     request.resource.data.officePhone == null || 
     request.resource.data.officePhone is string) &&
    (!('officeOwnerName' in request.resource.data) || 
     request.resource.data.officeOwnerName == null || 
     request.resource.data.officeOwnerName is string);
}

// employees コレクションのルール内（MyNumber以外の新フィールド）
// 注意: 6.2.1のmatchブロックと同じパスなので、実装時には既存のmatchブロックに統合すること
match /employees/{employeeId} {
  allow update: if isAdminOrHr(officeId) &&
    // 既存の型チェック...
    // 6.2.1のmyNumberフィールドの型チェックもここに統合...
    // Phase3-7: 新フィールドの型チェックを追加
    (!('employeeCodeInOffice' in request.resource.data) || 
     request.resource.data.employeeCodeInOffice == null || 
     request.resource.data.employeeCodeInOffice is string) &&
    (!('sex' in request.resource.data) || 
     request.resource.data.sex == null || 
     request.resource.data.sex in ['male', 'female', 'other']) && // Sex型の値と一致（types.tsのSex型エイリアスと対応）
    (!('postalCode' in request.resource.data) || 
     request.resource.data.postalCode == null || 
     (request.resource.data.postalCode is string && 
      request.resource.data.postalCode.matches('^[0-9]{7}$'))) &&
    (!('addressKana' in request.resource.data) || 
     request.resource.data.addressKana == null || 
     request.resource.data.addressKana is string);
}

// dependents サブコレクションのルール内（MyNumber以外の新フィールド）
// 注意: 6.2.1のmatchブロックと同じパスなので、実装時には既存のmatchブロックに統合すること
match /dependents/{dependentId} {
  allow update: if isAdminOrHr(officeId) &&
    // 既存の型チェック...
    // 6.2.1のmyNumberフィールドの型チェックもここに統合...
    // Phase3-7: 新フィールドの型チェックを追加
    (!('kana' in request.resource.data) || 
     request.resource.data.kana == null || 
     request.resource.data.kana is string) &&
    (!('sex' in request.resource.data) || 
     request.resource.data.sex == null || 
     request.resource.data.sex in ['male', 'female', 'other']) && // Sex型の値と一致（types.tsのSex型エイリアスと対応）
    (!('postalCode' in request.resource.data) || 
     request.resource.data.postalCode == null || 
     (request.resource.data.postalCode is string && 
      request.resource.data.postalCode.matches('^[0-9]{7}$'))) && 
    (!('address' in request.resource.data) ||
     request.resource.data.address == null || 
     request.resource.data.address is string) &&
    (!('cohabitationFlag' in request.resource.data) || 
     request.resource.data.cohabitationFlag == null || 
     request.resource.data.cohabitationFlag in ['cohabiting', 'separate']); // CohabitationFlag型の値と一致（types.tsのCohabitationFlag型エイリアスと対応）
}
```

**注意**: 
- 上記のルールは概要です。実際の実装時には、既存のルール構造を確認し、適切な位置に追加してください。
- **同じパス（`/employees/{employeeId}`や`/dependents/{dependentId}`）に対して複数の`match`ブロックを作るとコンパイルエラーになります**。既存の`match`ブロック内に、MyNumberフィールドの型チェックと新フィールドの型チェックを統合してください。

---

## 7. 既存データへの影響・移行方針

### 7.1. 既存データへの影響

- **すべての新フィールドは optional（`?`）として定義**しているため、既存のFirestoreドキュメントには影響しません
- 既存レコードに対しては、**ユーザーが必要に応じて後から追加入力する**運用を想定します

### 7.2. 互換性の確保

- **既存フィールドの変更は行わない**: `pensionNumber`など既存フィールドはそのまま使用します
- **新フィールドの追加のみ**: 既存のコードが壊れないように、新フィールドのみを追加します

### 7.3. 画面での未入力時の扱い

- 新フィールドが未入力（`null`または`undefined`）の場合でも、エラーにならないように実装します
- 一覧表示や詳細表示で、未入力の場合は「-」や空欄で表示します

---

## 8. 実装ステップ（推奨手順）

以下の順序で実装を進めることを推奨します:

### Step 1: 型定義の変更

1. `src/app/types.ts` を編集:
   - 型エイリアスの追加: `Sex`型、`CohabitationFlag`型を定義
   - `Office`型に新フィールドを追加
   - `Employee`型に新フィールドを追加（`Sex`型を使用）
   - `Dependent`型に新フィールドを追加（`Sex`型、`CohabitationFlag`型を使用）
   - `MyNumber`型を定義（バリデーション・マスク表示はMyNumberServiceに集約）

### Step 2: MyNumberServiceの作成

2. `src/app/services/mynumber.service.ts` を新規作成:
   - `encrypt()`, `decrypt()`, `mask()`, `isValid()` メソッドを実装
   - 現時点では簡易実装（プレーン文字列）でOK

### Step 3: Office画面・サービスの対応

3. `src/app/pages/offices/offices.page.ts` を編集:
   - FormGroupに新しいFormControlを追加
   - テンプレートに新しい入力項目を追加
   - `save()`メソッドで新しいフィールドを保存

### Step 4: Employee画面・サービスの対応

4. `src/app/pages/employees/employee-form-dialog.component.ts` を編集:
   - FormGroupに新しいFormControlを追加
   - テンプレートに新しい入力項目を追加
   - `submit()`メソッドで新しいフィールドを保存（MyNumberService経由）
   - MyNumberの表示時はマスク表示を実装

### Step 5: Dependent画面・サービスの対応

5. `src/app/pages/employees/dependent-form-dialog.component.ts` を編集:
   - FormGroupに新しいFormControlを追加
   - テンプレートに新しい入力項目を追加
   - `submit()`メソッドで新しいフィールドを保存（MyNumberService経由）

### Step 6: Firestoreルールの変更

6. `firestore.rules` を編集:
   - MyNumberフィールドのアクセス制御を追加
   - 新フィールドの型チェックを追加

### Step 7: テスト・確認

7. 以下のテスト観点に沿って確認:
   - 新フィールドを含めた新規登録・編集がエラーなくできる
   - バリデーションが正しく動作する（郵便番号7桁、マイナンバー12桁など）
   - 既存レコード（新フィールドが未設定）の一覧表示や詳細表示でエラーにならない
   - MyNumber表示がマスクされていること（必要に応じて）

---

## 9. テスト観点（簡易チェックリスト）

実装完了後、以下のポイントを確認してください:

### 9.1. 事業所設定画面

- [ ] 新フィールド（事業所記号・番号・郡市区符号・郵便番号・電話番号・事業主氏名）が表示される
- [ ] 新フィールドを入力して保存できる
- [ ] 郵便番号のバリデーション（7桁数字のみ）が正しく動作する
- [ ] 既存の事業所レコード（新フィールドが未設定）でもエラーなく表示・編集できる

### 9.2. 従業員登録／編集画面

- [ ] 新フィールド（被保険者整理番号・性別・郵便番号・住所カナ・マイナンバー）が表示される
- [ ] 新フィールドを入力して保存できる
- [ ] 性別の選択（男／女／その他）が正しく動作する
- [ ] 郵便番号のバリデーション（7桁数字のみ）が正しく動作する
- [ ] マイナンバーのバリデーション（12桁数字のみ）が正しく動作する
- [ ] マイナンバー入力時は`type="password"`で非表示になる
- [ ] 既存の従業員レコード（新フィールドが未設定）でもエラーなく表示・編集できる

### 9.3. 被扶養者登録／編集画面

- [ ] 新フィールド（氏名カナ・性別・郵便番号・住所・同居別居・マイナンバー）が表示される
- [ ] 新フィールドを入力して保存できる
- [ ] 性別の選択（男／女／その他）が正しく動作する
- [ ] 同居／別居の選択が正しく動作する
- [ ] 郵便番号のバリデーション（7桁数字のみ）が正しく動作する
- [ ] マイナンバーのバリデーション（12桁数字のみ）が正しく動作する
- [ ] 既存の被扶養者レコード（新フィールドが未設定）でもエラーなく表示・編集できる

### 9.4. MyNumberService

- [ ] `encrypt()`メソッドが正しく動作する（現時点ではそのまま返す）
- [ ] `decrypt()`メソッドが正しく動作する（現時点ではそのまま返す）
- [ ] `mask()`メソッドが正しく動作する（下4桁のみ表示）
- [ ] `isValid()`メソッドが正しく動作する（12桁数字のみ有効）

### 9.5. Firestoreルール

- [ ] 新フィールド（sex / postalCode / myNumber 等）の型チェックが正しく動作する
- [ ] 想定しているロールだけが employees / dependents ドキュメントを read / update できる
  - 現時点の方針：employee本人は自分のemployeesレコードを読める
  - dependentsはAdmin/HRのみ読める

### 9.6. 既存機能への影響

- [ ] 既存の一覧表示機能が正常に動作する
- [ ] 既存のCSVエクスポート機能が正常に動作する（新フィールドは含まれなくてもOK）
- [ ] 既存のCSVインポート機能が正常に動作する（新フィールドは未対応でもOK）

---

## 10. 注意事項・将来の拡張

### 10.1. マイナンバー管理の強化（将来の拡張）

Phase3-7では簡易実装（プレーン文字列保存）としていますが、**本番運用では必ず以下を実装すること**:

1. **暗号化実装**: Firebase Admin SDKの暗号化機能、またはCloud Functions経由での暗号化
2. **アクセス制御の強化**: 
   - MyNumber情報を別コレクション（例: `employeeSecrets`）に切り出す
   - Admin/HRロールのみがMyNumber情報を閲覧可能にする
   - Employee本人は自分の基本情報は読めるが、MyNumber情報は読めない設計にする
3. **アクセスログの記録**: MyNumberへのアクセス履歴を記録する
4. **マスキング表示の徹底**: UI上では常にマスク表示を基本とする

### 10.2. 基礎年金番号の分解対応（将来の拡張）

現時点では`employee.pensionNumber`をそのまま使用しますが、将来は「課所符号＋一連番号」に分解する対応を検討してください。

### 10.3. 手続きレコード固有フィールドの追加（Phase3-8で実装）

各手続きタイプごとの詳細項目（資格取得届の報酬額、算定基礎届の4〜6月の基礎日数・賃金など）は、Phase3-8で実装します。

---

以上で、Phase3-7「e-Gov用必要情報の先行実装」の実装指示書は完了です。

実装時には、この指示書を参照しながら、段階的に実装を進めてください。

