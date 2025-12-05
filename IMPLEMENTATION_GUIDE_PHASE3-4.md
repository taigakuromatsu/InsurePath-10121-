# Phase3-4 実装指示書: 社会保険手続き履歴・期限管理機能

## 1. 概要

Phase3-4では、従業員および被扶養者ごとに、健康保険・厚生年金に関する主な社会保険手続きの履歴を登録・閲覧し、提出期限を管理することで、届出漏れ・提出遅れを防止する機能を実装します。

手続き種別（資格取得届、資格喪失届、算定基礎届、月額変更届、被扶養者異動届、賞与支払届など）ごとに手続きレコードを作成し、事由発生日から法定提出期限の目安を自動計算して表示します。また、「提出期限が近い手続き」「提出期限を過ぎて未完了の手続き」を一覧表示することで、人事担当者が手続きの進捗を把握しやすくします。

**重要**: 提出期限の算出は代表的なルールに基づく目安を提供するにとどめ、最終的な提出要否・期限判断は事業所側の責任とします。

### Phase3-4のスコープ

Phase3-4では以下の機能を実装します：

- **手続きレコードの手動登録**: 管理者・担当者が手続き情報を手動で登録できる
- **手続き一覧／フィルタ／期限ビュー（期限が近い・期限切れ）の表示**: 登録された手続きを一覧表示し、ステータス・期限・種別でフィルタできる

**今回の実装対象外**:

- **イベントからの自動候補生成**: 入社・退職・標準報酬決定・賞与支給・被扶養者の追加／削除イベントから手続き作成候補を自動生成する機能は、Phase3-14「手続きタスク期限ビュー＆簡易アラート」または将来のFunctions連携フェーズに後送りします

---

## 2. 前提・ゴール

### 前提

- **型定義**: `SocialInsuranceProcedure`型は`src/app/types.ts`に未定義です。新規に定義します
- **既存サービス**: `EmployeesService`、`DependentsService`が存在し、従業員・被扶養者情報を取得できます
- **既存ページ**: 手続き履歴管理用のページは存在しません。新規に`src/app/pages/procedures/procedures.page.ts`を作成します
- **セキュリティルール**: `firestore.rules`に`procedures`コレクションのルールは未定義です
- **リアルタイム購読パターン**: `DependentsService`や`StandardRewardHistoryService`は`collectionData`を使用したリアルタイム購読パターンを使用しています。`ProceduresService.list()`もこのパターンに合わせます
- **ユーザー情報の取得**: 既存の「現在ログイン中のユーザー情報」を取得するサービス（例：`CurrentUserService`または`AuthService`）が存在します。コード例ではプロジェクトで実際に使っているサービス名に合わせて読み替えてください

### ゴール

Phase3-4完了の判定基準：

1. ✅ **手続き履歴の型定義**（`src/app/types.ts`）が追加されていること
   - `SocialInsuranceProcedure`型の定義
   - `ProcedureType`型（手続き種別）の定義
   - `ProcedureStatus`型（手続きステータス）の定義

2. ✅ **手続き履歴サービス**（`src/app/services/procedures.service.ts`）が存在し、CRUD操作が実装されていること
   - 手続きの作成（`create()`）
   - 手続きの一覧取得（`list()`）- リアルタイム購読に対応
   - 手続きの更新（`update()`）
   - 手続きの削除（`delete()`）
   - 期限別フィルタ機能（`listByDeadline()`）

3. ✅ **手続き登録・閲覧画面**（`src/app/pages/procedures/procedures.page.ts`）が実装されていること
   - 手続き一覧表示（テーブル形式）
   - 手続き登録フォーム（ダイアログ）
   - 手続き編集フォーム（ダイアログ）
   - ステータス別フィルタ
   - 期限別フィルタ（期限が近い、期限切れ）

4. ✅ **期限管理機能**が実装されていること
   - 「提出期限が近い手続き」一覧表示（7日以内）
   - 「提出期限を過ぎて未完了の手続き」一覧表示
   - 提出期限の自動計算（事由発生日から法定提出期限の目安を計算）
   - **未完了扱い**: `not_started`（未着手）、`in_progress`（準備中）、`rejected`（差戻し）は未完了として期限管理の対象に含める
   - **完了扱い**: `submitted`（提出済）は期限管理の対象から除外する

5. ✅ **Firestoreセキュリティルール**が実装されていること
   - admin/hrは全手続きを閲覧・作成・更新・削除可能
   - employeeは自分の手続きのみ閲覧可能（作成・更新・削除は不可、将来`/me`画面で利用する布石として残す）

6. ✅ **既存機能が壊れていないこと**（従業員台帳、被扶養者管理など）

---

## 3. 現状整理

### 3.1 既存の型定義

`src/app/types.ts`には以下の型が定義されていますが、手続き履歴関連の型は未定義です：

- `Employee`型：従業員情報
- `Dependent`型：被扶養者情報
- `StandardRewardHistory`型：標準報酬決定・改定履歴
- `IsoDateString`型：ISO日付文字列（`YYYY-MM-DD`形式のstringとして扱う）

### 3.2 既存のサービスパターン

`DependentsService`や`StandardRewardHistoryService`は以下のパターンを使用しています：

- `collectionData`を使用したリアルタイム購読
- `setDoc`を使用した保存（`merge: true`オプション）
- `deleteDoc`を使用した削除

### 3.3 既存のページパターン

既存のページ（`employees.page.ts`、`requests.page.ts`など）は以下のパターンを使用しています：

- Angular Materialの`MatTableModule`を使用したテーブル表示
- `MatDialog`を使用したフォームダイアログ
- `combineLatest`を使用した複数Observableの結合（従業員情報と手続き情報を結合してViewModelを作成）
- `AsyncPipe`を使用したテンプレート内での購読

---

## 4. 変更対象ファイル

### 4.1 新規作成ファイル

1. **`src/app/types.ts`**（型定義の追加）
   - `ProcedureType`型の追加
   - `ProcedureStatus`型の追加
   - `SocialInsuranceProcedure`型の追加

2. **`src/app/services/procedures.service.ts`**（新規作成）
   - 手続き履歴のCRUD操作を提供するサービス

3. **`src/app/pages/procedures/procedures.page.ts`**（新規作成）
   - 手続き履歴一覧画面

4. **`src/app/pages/procedures/procedure-form-dialog.component.ts`**（新規作成）
   - 手続き登録・編集フォームダイアログ

5. **`src/app/utils/procedure-deadline-calculator.ts`**（新規作成）
   - 提出期限の自動計算ロジック

### 4.2 変更ファイル

1. **`src/app/app.routes.ts`**
   - `/procedures`ルートの追加（admin/hr専用）

2. **`firestore.rules`**
   - `procedures`コレクションのセキュリティルール追加

---

## 5. 画面仕様

### 5.1 手続き履歴一覧画面（`/procedures`）

**アクセス権限**: admin/hr専用（employeeロールはアクセス不可）

**画面構成**:

1. **ヘッダーセクション**
   - タイトル：「社会保険手続き履歴」
   - 説明文：「従業員・被扶養者ごとの社会保険手続きの履歴を管理できます」

2. **フィルタセクション**
   - **ステータスフィルタ**（`mat-select`）
     - 選択肢：「すべて」「未着手」「準備中」「提出済」「差戻し」
   - **期限フィルタ**（`mat-select`）
     - 選択肢：「すべて」「期限が近い（7日以内）」「期限切れ」
   - **手続き種別フィルタ**（`mat-select`、任意）
     - 選択肢：「すべて」「資格取得届」「資格喪失届」「算定基礎届」「月額変更届」「被扶養者異動届」「賞与支払届」

3. **アクションボタン**
   - **手続きを登録**ボタン（`mat-flat-button`、`color="primary"`）
     - クリックで手続き登録ダイアログを開く

4. **手続き一覧テーブル**（`mat-table`）
   - **列構成**:
     - **手続き種別**（`procedureType`）
     - **対象者**（従業員名、被扶養者異動届の場合は「従業員名／被扶養者名」）
     - **事由発生日**（`incidentDate`、`YYYY-MM-DD`形式）
     - **提出期限**（`deadline`、`YYYY-MM-DD`形式、期限切れの場合は赤色表示）
     - **ステータス**（`status`、バッジ表示）
     - **提出日**（`submittedAt`、`YYYY-MM-DD`形式、未提出の場合は「未提出」）
     - **担当者**（`assignedPersonName`、テキスト）
     - **アクション**（編集ボタン、削除ボタン）

5. **空状態表示**
   - 手続きが0件の場合：「手続き履歴がありません」

**注意**: employeeロールが自分の手続きを見るUIは、Phase3-9「従業員セルフ入力・申請フロー」以降で`/me`（マイページ）側に載せる前提とし、今回のPhase3-4では実装しません。

### 5.2 手続き登録・編集フォームダイアログ

**フォーム項目**:

- **手続き種別**（`mat-select`、必須）
  - 選択肢：
    - `qualification_acquisition`：資格取得届
    - `qualification_loss`：資格喪失届
    - `standard_reward`：算定基礎届
    - `monthly_change`：月額変更届
    - `dependent_change`：被扶養者異動届
    - `bonus_payment`：賞与支払届
- **対象従業員**（`mat-select`、必須）
  - 事業所内の従業員一覧から選択
- **対象被扶養者**（`mat-select`、任意、被扶養者異動届の場合のみ表示）
  - 選択した従業員の被扶養者一覧から選択
- **事由発生日**（`<input matInput type="date">`、必須）
  - 例：入社日、退職日、標準報酬改定日、賞与支給日、扶養認定日
  - フォーム値は`YYYY-MM-DD`形式のstring
- **提出期限**（`<input matInput type="date">`、必須）
  - 事由発生日から自動計算（手動で変更可能）
  - 法定提出期限の目安を表示
  - フォーム値は`YYYY-MM-DD`形式のstring
- **ステータス**（`mat-select`、必須）
  - 選択肢：
    - `not_started`：未着手
    - `in_progress`：準備中
    - `submitted`：提出済
    - `rejected`：差戻し
- **提出日**（`<input matInput type="date">`、任意、提出済の場合のみ表示）
  - フォーム値は`YYYY-MM-DD`形式のstring
- **担当者**（`<input matInput>`、任意、テキスト入力）
  - 担当者名をテキストで入力（ユーザーIDではなくテキスト名で保持）
- **備考**（`mat-textarea`、任意）
  - 最大500文字

**アクション**:
- **保存**ボタン：フォームを送信して手続きを保存（`type="submit"`）
- **キャンセル**ボタン：ダイアログを閉じる（`type="button"`）

---

## 6. 実装方針

### Step 1: 型定義の追加

**対象ファイル**: `src/app/types.ts`

**実装内容**:

1. **手続き種別の型定義**
   ```typescript
   export type ProcedureType =
     | 'qualification_acquisition'  // 資格取得届
     | 'qualification_loss'         // 資格喪失届
     | 'standard_reward'            // 算定基礎届
     | 'monthly_change'             // 月額変更届
     | 'dependent_change'           // 被扶養者異動届
     | 'bonus_payment';              // 賞与支払届
   ```

2. **手続きステータスの型定義**
   ```typescript
   export type ProcedureStatus =
     | 'not_started'  // 未着手
     | 'in_progress'  // 準備中
     | 'submitted'    // 提出済
     | 'rejected';    // 差戻し
   ```

3. **手続き履歴の型定義**
   ```typescript
   export interface SocialInsuranceProcedure {
     id: string;
     officeId: string;
     procedureType: ProcedureType;
     employeeId: string;
     dependentId?: string;  // 被扶養者異動届の場合のみ
     incidentDate: string;  // 事由発生日（YYYY-MM-DD形式のstring）
     deadline: string;  // 提出期限（YYYY-MM-DD形式のstring）
     status: ProcedureStatus;
     submittedAt?: string;  // 提出日（YYYY-MM-DD形式のstring）
     assignedPersonName?: string;  // 担当者名（テキスト）
     note?: string;  // 備考
     createdAt?: IsoDateString;  // 作成日時（ISO文字列）
     updatedAt?: IsoDateString;  // 更新日時（ISO文字列）
     createdByUserId?: string;
     updatedByUserId?: string;
   }
   ```

**必要なインポート**: 既存のインポートに追加する必要はありません（`IsoDateString`は既に定義されています）

### Step 2: ProceduresServiceの実装

**対象ファイル**: `src/app/services/procedures.service.ts`（新規作成）

**実装内容**:

1. **サービスの基本構造**
   ```typescript
   @Injectable({ providedIn: 'root' })
   export class ProceduresService {
     constructor(private readonly firestore: Firestore) {}
     
     private collectionPath(officeId: string) {
       return collection(this.firestore, 'offices', officeId, 'procedures');
     }
   }
   ```

2. **手続きの作成**（`create()`メソッド）
   ```typescript
   async create(
     officeId: string,
     procedure: {
       procedureType: ProcedureType;
       employeeId: string;
       dependentId?: string;
       incidentDate: string;  // YYYY-MM-DD形式のstring
       deadline: string;  // YYYY-MM-DD形式のstring
       status: ProcedureStatus;
       submittedAt?: string;  // YYYY-MM-DD形式のstring
       assignedPersonName?: string;  // 担当者名（テキスト）
       note?: string;
     },
     createdByUserId: string
   ): Promise<void> {
     const ref = this.collectionPath(officeId);
     const docRef = doc(ref);
     const now = new Date().toISOString();
     
     const payload: SocialInsuranceProcedure = {
       id: docRef.id,
       officeId,
       procedureType: procedure.procedureType,
       employeeId: procedure.employeeId,
       incidentDate: procedure.incidentDate,
       deadline: procedure.deadline,
       status: procedure.status,
       createdAt: now,
       updatedAt: now,
       createdByUserId,
       updatedByUserId: createdByUserId
     };
     
     if (procedure.dependentId != null) {
       payload.dependentId = procedure.dependentId;
     }
     if (procedure.submittedAt != null) {
       payload.submittedAt = procedure.submittedAt;
     }
     if (procedure.assignedPersonName != null) {
       payload.assignedPersonName = procedure.assignedPersonName;
     }
     if (procedure.note != null) {
       payload.note = procedure.note;
     }
     
     await setDoc(docRef, payload);
   }
   ```

3. **手続きの一覧取得**（`list()`メソッド）- リアルタイム購読パターン
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

4. **期限別フィルタ機能**（`listByDeadline()`メソッド）
   ```typescript
   listByDeadline(
     officeId: string,
     filter: 'upcoming' | 'overdue' | 'all'
   ): Observable<SocialInsuranceProcedure[]> {
     const ref = this.collectionPath(officeId);
     // YYYY-MM-DD形式のstringとして生成
     const now = new Date().toISOString().substring(0, 10);
     const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
     
     let q: Query;
     
     if (filter === 'upcoming') {
       // 期限が近い（7日以内）かつ未完了
       // 未完了ステータス: not_started, in_progress, rejected
       q = query(
         ref,
         where('deadline', '>=', now),
         where('deadline', '<=', sevenDaysLater),
         where('status', 'in', ['not_started', 'in_progress', 'rejected']),
         orderBy('deadline', 'asc')
       );
     } else if (filter === 'overdue') {
       // 期限切れかつ未完了
       // 未完了ステータス: not_started, in_progress, rejected
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
   
   **注意**: このクエリにはFirestoreのコンポジットインデックスが必要になる可能性があります。実行時にコンソールに表示されるリンクからインデックスを作成してください。

5. **手続きの更新**（`update()`メソッド）
   ```typescript
   async update(
     officeId: string,
     procedureId: string,
     updates: Partial<SocialInsuranceProcedure>,
     updatedByUserId: string
   ): Promise<void> {
     const ref = this.collectionPath(officeId);
     const docRef = doc(ref, procedureId);
     const now = new Date().toISOString();
     
     const payload: Partial<SocialInsuranceProcedure> = {
       ...updates,
       updatedAt: now,
       updatedByUserId
     };
     
     await updateDoc(docRef, payload);
   }
   ```

6. **手続きの削除**（`delete()`メソッド）
   ```typescript
   async delete(officeId: string, procedureId: string): Promise<void> {
     const ref = this.collectionPath(officeId);
     const docRef = doc(ref, procedureId);
     await deleteDoc(docRef);
   }
   ```

**必要なインポート**:
```typescript
import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  orderBy,
  query,
  Query,
  QueryConstraint,
  setDoc,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { IsoDateString, ProcedureType, ProcedureStatus, SocialInsuranceProcedure } from '../types';
```

**注意**: `list()`は1回きりの`getDocs`ではなく、`collectionData`を使用したリアルタイム購読パターンにします。これにより、手続きの追加・更新・削除後に一覧が自動更新されます。

### Step 3: 提出期限の自動計算ロジック

**対象ファイル**: `src/app/utils/procedure-deadline-calculator.ts`（新規作成）

**実装内容**:

```typescript
import { ProcedureType } from '../types';

/**
 * 事由発生日から法定提出期限の目安を計算する
 * 注意: これは代表的なルールに基づく目安であり、最終的な提出要否・期限判断は事業所側の責任とする
 * 
 * @param procedureType 手続き種別
 * @param incidentDate 事由発生日（YYYY-MM-DD形式のstring）
 * @returns 提出期限（YYYY-MM-DD形式のstring）
 */
export function calculateDeadline(
  procedureType: ProcedureType,
  incidentDate: string
): string {
  const incident = new Date(incidentDate);
  let deadline: Date;
  
  switch (procedureType) {
    case 'qualification_acquisition':
    case 'qualification_loss':
      // 資格取得届・資格喪失届：事由発生日の属する月の翌月10日
      deadline = new Date(incident.getFullYear(), incident.getMonth() + 1, 10);
      break;
    case 'standard_reward':
      // 算定基礎届：毎年7月10日（簡略化）
      deadline = new Date(incident.getFullYear(), 6, 10);
      break;
    case 'monthly_change':
      // 月額変更届：事由発生日の属する月の翌月10日
      deadline = new Date(incident.getFullYear(), incident.getMonth() + 1, 10);
      break;
    case 'dependent_change':
      // 被扶養者異動届：事由発生日の属する月の翌月10日
      deadline = new Date(incident.getFullYear(), incident.getMonth() + 1, 10);
      break;
    case 'bonus_payment':
      // 賞与支払届：賞与支給日の属する月の翌月10日
      deadline = new Date(incident.getFullYear(), incident.getMonth() + 1, 10);
      break;
    default:
      // デフォルト：事由発生日の属する月の翌月10日
      deadline = new Date(incident.getFullYear(), incident.getMonth() + 1, 10);
  }
  
  return deadline.toISOString().substring(0, 10);
}
```

### Step 4: 手続き登録・編集フォームダイアログの実装

**対象ファイル**: `src/app/pages/procedures/procedure-form-dialog.component.ts`（新規作成）

**実装内容**:

1. **コンポーネントの基本構造**
   ```typescript
   @Component({
     selector: 'ip-procedure-form-dialog',
     standalone: true,
     imports: [
       MatDialogModule,
       ReactiveFormsModule,
       MatFormFieldModule,
       MatInputModule,
       MatSelectModule,
       MatButtonModule,
       MatIconModule,
       NgIf
     ],
     template: `...`,
     styles: [`...`]
   })
   export class ProcedureFormDialogComponent {
     // ...
   }
   ```

2. **フォームの定義**（日付は`YYYY-MM-DD`形式のstring）
   ```typescript
   form = this.fb.group({
     procedureType: ['', Validators.required],
     employeeId: ['', Validators.required],
     dependentId: [''],
     incidentDate: ['', Validators.required],  // YYYY-MM-DD形式のstring
     deadline: ['', Validators.required],  // YYYY-MM-DD形式のstring
     status: ['not_started', Validators.required],
     submittedAt: [''],  // YYYY-MM-DD形式のstring
     assignedPersonName: [''],  // 担当者名（テキスト）
     note: ['']
   });
   ```

3. **事由発生日変更時の提出期限自動計算**
   ```typescript
   onIncidentDateChange(): void {
     const incidentDate = this.form.get('incidentDate')?.value;
     const procedureType = this.form.get('procedureType')?.value;
     
     if (incidentDate && procedureType) {
       // incidentDateは'YYYY-MM-DD'形式のstringとして入ってくる
       const deadline = calculateDeadline(procedureType as ProcedureType, incidentDate);
       this.form.patchValue({ deadline });
     }
   }
   ```

4. **手続き種別変更時の提出期限再計算**
   ```typescript
   onProcedureTypeChange(): void {
     const incidentDate = this.form.get('incidentDate')?.value;
     const procedureType = this.form.get('procedureType')?.value;
     
     if (incidentDate && procedureType) {
       // incidentDateは'YYYY-MM-DD'形式のstringとして入ってくる
       const deadline = calculateDeadline(procedureType as ProcedureType, incidentDate);
       this.form.patchValue({ deadline });
     }
     
     // 被扶養者異動届の場合のみdependentIdを表示
     if (procedureType === 'dependent_change') {
       this.form.get('dependentId')?.setValidators([Validators.required]);
     } else {
       this.form.get('dependentId')?.clearValidators();
       this.form.get('dependentId')?.setValue('');
     }
     this.form.get('dependentId')?.updateValueAndValidity();
   }
   ```

5. **提出済ステータス選択時の提出日表示**
   ```typescript
   onStatusChange(): void {
     const status = this.form.get('status')?.value;
     if (status === 'submitted') {
       this.form.get('submittedAt')?.setValidators([Validators.required]);
     } else {
       this.form.get('submittedAt')?.clearValidators();
       this.form.get('submittedAt')?.setValue('');
     }
     this.form.get('submittedAt')?.updateValueAndValidity();
   }
   ```

6. **保存処理**
   ```typescript
   async submit(): Promise<void> {
     if (this.form.invalid) return;
     
     const formValue = this.form.getRawValue();
     const currentUserId = await firstValueFrom(
       this.currentUser.profile$.pipe(
         map(profile => profile?.id ?? null)
       )
     );
     
     if (!currentUserId) {
       throw new Error('ユーザーIDが取得できませんでした');
     }
     
     if (this.data.procedure) {
       // 更新
       await this.proceduresService.update(
         this.data.officeId,
         this.data.procedure.id,
         {
           procedureType: formValue.procedureType as ProcedureType,
           employeeId: formValue.employeeId,
           dependentId: formValue.dependentId || undefined,
           incidentDate: formValue.incidentDate,
           deadline: formValue.deadline,
           status: formValue.status as ProcedureStatus,
           submittedAt: formValue.submittedAt || undefined,
           assignedPersonName: formValue.assignedPersonName || undefined,
           note: formValue.note || undefined
         },
         currentUserId
       );
     } else {
       // 作成
       await this.proceduresService.create(
         this.data.officeId,
         {
           procedureType: formValue.procedureType as ProcedureType,
           employeeId: formValue.employeeId,
           dependentId: formValue.dependentId || undefined,
           incidentDate: formValue.incidentDate,
           deadline: formValue.deadline,
           status: formValue.status as ProcedureStatus,
           submittedAt: formValue.submittedAt || undefined,
           assignedPersonName: formValue.assignedPersonName || undefined,
           note: formValue.note || undefined
         },
         currentUserId
       );
     }
     
     this.dialogRef.close(true);
   }
   ```

7. **テンプレート例**（重要な部分のみ）
   ```html
   <form [formGroup]="form" (ngSubmit)="submit()">
     <div mat-dialog-content>
       <!-- 手続き種別 -->
       <mat-form-field appearance="outline" class="full-width">
         <mat-label>手続き種別</mat-label>
         <mat-select formControlName="procedureType" (selectionChange)="onProcedureTypeChange()">
           <mat-option value="qualification_acquisition">資格取得届</mat-option>
           <mat-option value="qualification_loss">資格喪失届</mat-option>
           <mat-option value="standard_reward">算定基礎届</mat-option>
           <mat-option value="monthly_change">月額変更届</mat-option>
           <mat-option value="dependent_change">被扶養者異動届</mat-option>
           <mat-option value="bonus_payment">賞与支払届</mat-option>
         </mat-select>
       </mat-form-field>
       
       <!-- 事由発生日（type="date"を使用） -->
       <mat-form-field appearance="outline" class="full-width">
         <mat-label>事由発生日</mat-label>
         <input matInput type="date" formControlName="incidentDate" (change)="onIncidentDateChange()" />
       </mat-form-field>
       
       <!-- 提出期限（type="date"を使用） -->
       <mat-form-field appearance="outline" class="full-width">
         <mat-label>提出期限</mat-label>
         <input matInput type="date" formControlName="deadline" />
       </mat-form-field>
       
       <!-- 担当者（テキスト入力） -->
       <mat-form-field appearance="outline" class="full-width">
         <mat-label>担当者</mat-label>
         <input matInput formControlName="assignedPersonName" />
       </mat-form-field>
       
       <!-- その他のフィールド... -->
     </div>
     
     <div mat-dialog-actions align="end">
       <button mat-button mat-dialog-close type="button">キャンセル</button>
       <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
         保存
       </button>
     </div>
   </form>
   ```

**必要なインポート**:
```typescript
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgIf } from '@angular/common';
import { firstValueFrom, map } from 'rxjs';
import { ProceduresService } from '../../services/procedures.service';
import { CurrentUserService } from '../../services/current-user.service';
import { EmployeesService } from '../../services/employees.service';
import { DependentsService } from '../../services/dependents.service';
import { ProcedureType, ProcedureStatus, SocialInsuranceProcedure, Employee, Dependent } from '../../types';
import { calculateDeadline } from '../../utils/procedure-deadline-calculator';
```

### Step 5: 手続き履歴一覧画面の実装

**対象ファイル**: `src/app/pages/procedures/procedures.page.ts`（新規作成）

**実装内容**:

1. **コンポーネントの基本構造**
   ```typescript
   @Component({
     selector: 'ip-procedures-page',
     standalone: true,
     imports: [
       MatCardModule,
       MatTableModule,
       MatButtonModule,
       MatIconModule,
       MatSelectModule,
       MatFormFieldModule,
       MatDialogModule,
       AsyncPipe,
       NgIf,
       DatePipe
     ],
     template: `...`,
     styles: [`...`]
   })
   export class ProceduresPage {
     // ...
   }
   ```

2. **フィルタとデータの購読**（ViewModel合成パターン）
   ```typescript
   readonly statusFilter$ = new BehaviorSubject<ProcedureStatus | 'all'>('all');
   readonly deadlineFilter$ = new BehaviorSubject<'all' | 'upcoming' | 'overdue'>('all');
   readonly procedureTypeFilter$ = new BehaviorSubject<ProcedureType | 'all'>('all');
   
   // 従業員一覧と被扶養者一覧を取得
   readonly employees$ = this.currentOffice.officeId$.pipe(
     switchMap(officeId => officeId ? this.employeesService.list(officeId) : of([]))
   );
   
   // 手続き一覧を取得（フィルタ適用）
   readonly procedures$ = combineLatest([
     this.currentOffice.officeId$,
     this.statusFilter$,
     this.deadlineFilter$,
     this.procedureTypeFilter$
   ]).pipe(
     switchMap(([officeId, statusFilter, deadlineFilter, procedureTypeFilter]) => {
       if (!officeId) return of([]);
       
       if (deadlineFilter !== 'all') {
         // 期限別フィルタを使用
         return this.proceduresService.listByDeadline(officeId, deadlineFilter).pipe(
           map(procedures => {
             let filtered = procedures;
             if (statusFilter !== 'all') {
               filtered = filtered.filter(p => p.status === statusFilter);
             }
             if (procedureTypeFilter !== 'all') {
               filtered = filtered.filter(p => p.procedureType === procedureTypeFilter);
             }
             return filtered;
           })
         );
       } else {
         // 通常のリスト取得
         const filters: { status?: ProcedureStatus; procedureType?: ProcedureType } = {};
         if (statusFilter !== 'all') {
           filters.status = statusFilter;
         }
         if (procedureTypeFilter !== 'all') {
           filters.procedureType = procedureTypeFilter;
         }
         return this.proceduresService.list(officeId, Object.keys(filters).length > 0 ? filters : undefined);
       }
     })
   );
   
   // ViewModel合成：手続き情報に従業員名・被扶養者名を結合
   readonly proceduresWithNames$ = combineLatest([
     this.procedures$,
     this.employees$,
     this.currentOffice.officeId$
   ]).pipe(
     switchMap(([procedures, employees, officeId]) => {
       if (!officeId) return of([]);
       
       // 従業員IDから従業員名へのMapを作成
       const employeeMap = new Map<string, Employee>();
       employees.forEach(emp => employeeMap.set(emp.id, emp));
       
       // 被扶養者情報を取得（必要な手続きのみ）
       const dependentProcedures = procedures.filter(p => p.dependentId);
       if (dependentProcedures.length === 0) {
         // 被扶養者がいない場合は従業員名だけ結合
         return of(
           procedures.map(p => ({
             ...p,
             employeeName: employeeMap.get(p.employeeId)?.name || '不明',
             dependentName: undefined
           }))
         );
       }
       
       // 被扶養者情報を取得
       const dependentObservables = dependentProcedures.map(p =>
         this.dependentsService.list(officeId, p.employeeId).pipe(
           map(dependents => {
             const dependent = dependents.find(d => d.id === p.dependentId);
             return { procedureId: p.id, dependentName: dependent?.name };
           })
         )
       );
       
       return combineLatest(dependentObservables).pipe(
         map(dependentNames => {
           const dependentNameMap = new Map<string, string>();
           dependentNames.forEach(({ procedureId, dependentName }) => {
             if (dependentName) {
               dependentNameMap.set(procedureId, dependentName);
             }
           });
           
           return procedures.map(p => ({
             ...p,
             employeeName: employeeMap.get(p.employeeId)?.name || '不明',
             dependentName: dependentNameMap.get(p.id)
           }));
         })
       );
     })
   );
   ```

3. **対象者名の表示メソッド**
   ```typescript
   getTargetPersonName(procedure: SocialInsuranceProcedure & { employeeName?: string; dependentName?: string }): string {
     if (procedure.procedureType === 'dependent_change' && procedure.dependentName) {
       return `${procedure.employeeName || '不明'}／${procedure.dependentName}`;
     }
     return procedure.employeeName || '不明';
   }
   ```

4. **手続き登録ダイアログを開く**
   ```typescript
   async openCreateDialog(): Promise<void> {
     const officeId = await firstValueFrom(this.currentOffice.officeId$);
     if (!officeId) return;
     
     this.dialog.open(ProcedureFormDialogComponent, {
       width: '600px',
       data: { officeId }
     }).afterClosed().subscribe(result => {
       if (result) {
         // ダイアログが閉じられた後の処理（必要に応じて）
       }
     });
   }
   ```

5. **手続き編集ダイアログを開く**
   ```typescript
   async openEditDialog(procedure: SocialInsuranceProcedure): Promise<void> {
     const officeId = await firstValueFrom(this.currentOffice.officeId$);
     if (!officeId) return;
     
     this.dialog.open(ProcedureFormDialogComponent, {
       width: '600px',
       data: { officeId, procedure }
     }).afterClosed().subscribe(result => {
       if (result) {
         // ダイアログが閉じられた後の処理（必要に応じて）
       }
     });
   }
   ```

6. **手続きの削除**
   ```typescript
   async deleteProcedure(procedure: SocialInsuranceProcedure): Promise<void> {
     if (!confirm(`手続き「${this.getProcedureTypeLabel(procedure.procedureType)}」を削除しますか？`)) {
       return;
     }
     
     const officeId = await firstValueFrom(this.currentOffice.officeId$);
     if (!officeId) return;
     
     await this.proceduresService.delete(officeId, procedure.id);
   }
   ```

7. **ラベル取得メソッド**
   ```typescript
   getProcedureTypeLabel(type: ProcedureType): string {
     const labels: Record<ProcedureType, string> = {
       qualification_acquisition: '資格取得届',
       qualification_loss: '資格喪失届',
       standard_reward: '算定基礎届',
       monthly_change: '月額変更届',
       dependent_change: '被扶養者異動届',
       bonus_payment: '賞与支払届'
     };
     return labels[type] || type;
   }
   
   getStatusLabel(status: ProcedureStatus): string {
     const labels: Record<ProcedureStatus, string> = {
       not_started: '未着手',
       in_progress: '準備中',
       submitted: '提出済',
       rejected: '差戻し'
     };
     return labels[status] || status;
   }
   ```

8. **テンプレート例**（重要な部分のみ）
   ```html
   <table mat-table [dataSource]="proceduresWithNames$ | async" class="procedures-table">
     <!-- 対象者列 -->
     <ng-container matColumnDef="targetPerson">
       <th mat-header-cell *matHeaderCellDef>対象者</th>
       <td mat-cell *matCellDef="let row">
         {{ getTargetPersonName(row) }}
       </td>
     </ng-container>
     
     <!-- 提出期限列（期限切れの場合は赤色表示） -->
     <ng-container matColumnDef="deadline">
       <th mat-header-cell *matHeaderCellDef>提出期限</th>
       <td mat-cell *matCellDef="let row" [class.overdue]="isOverdue(row)">
         {{ row.deadline }}
       </td>
     </ng-container>
     
     <!-- 担当者列 -->
     <ng-container matColumnDef="assignedPerson">
       <th mat-header-cell *matHeaderCellDef>担当者</th>
       <td mat-cell *matCellDef="let row">
         {{ row.assignedPersonName || '-' }}
       </td>
     </ng-container>
     
     <!-- その他の列... -->
   </table>
   ```

9. **期限切れ判定メソッド**
   ```typescript
   isOverdue(procedure: SocialInsuranceProcedure): boolean {
     if (procedure.status === 'submitted') {
       return false;  // 提出済は期限切れ判定から除外
     }
     const today = new Date().toISOString().substring(0, 10);
     return procedure.deadline < today;
   }
   ```

**必要なインポート**:
```typescript
import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AsyncPipe, DatePipe, NgIf } from '@angular/common';
import { BehaviorSubject, combineLatest, firstValueFrom, map, of, switchMap } from 'rxjs';
import { ProceduresService } from '../../services/procedures.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { EmployeesService } from '../../services/employees.service';
import { DependentsService } from '../../services/dependents.service';
import { ProcedureType, ProcedureStatus, SocialInsuranceProcedure, Employee } from '../../types';
import { ProcedureFormDialogComponent } from './procedure-form-dialog.component';
```

### Step 6: ルーティングの追加

**対象ファイル**: `src/app/app.routes.ts`

**実装内容**:

```typescript
{
  path: 'procedures',
  canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
  loadComponent: () => import('./pages/procedures/procedures.page').then((m) => m.ProceduresPage)
}
```

**注意**: `/procedures`はadmin/hr専用のルートです。employeeロールはアクセスできません。

### Step 7: Firestoreセキュリティルールの追加

**対象ファイル**: `firestore.rules`

**実装内容**:

`match /offices/{officeId}`ブロック内に以下を追加：

```javascript
// 社会保険手続き履歴（procedures）
match /procedures/{procedureId} {
  // 閲覧: admin/hrは全件、employeeは自分の手続きのみ閲覧可能
  // 注意: employeeのread許可は将来 /me 画面で利用する布石として残す
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    (isInsureEmployee(officeId) && resource.data.employeeId == currentUser().data.employeeId)
  );
  
  // 作成・更新・削除: admin/hrのみ
  allow create, update, delete: if belongsToOffice(officeId) && isAdminOrHr(officeId);
  
  // TODO: 今後、必要に応じて procedureType / status の許容値や必須フィールドをルール側でも検証する予定
  // Phase3-4ではロールとoffice所属のみをチェックし、詳細なschemaバリデーションは将来の強化対象とする
}
```

**注意事項**:
- 以下のルールでは既存の`belongsToOffice`、`isAdminOrHr`、`isInsureEmployee`、`currentUser()`などのヘルパー関数を利用します。もし名前が異なる場合は、プロジェクト側の名前に置き換えてください
- `read`ルールでは、employeeロールは`resource.data.employeeId == currentUser().data.employeeId`の条件で自分の手続きのみ閲覧可能です。これは将来`/me`画面で利用する布石として残します
- ルールの追加箇所は`match /offices/{officeId}`ブロック内に`match /procedures/{procedureId}`を追加する形です（root直下に書く誤解を避けるため）
- Phase3-4ではロールとoffice所属のみをチェックし、詳細なschemaバリデーション（許可キー制御、値のバリデーション等）は将来の強化対象とします

---

## 7. テスト観点

### 7.1 基本機能のテスト

- [ ] **手続きの登録**
  - テスト手順:
    1. admin/hrロールでログイン
    2. `/procedures`画面を開く
    3. 「手続きを登録」ボタンをクリック
    4. フォームに必要項目を入力して保存
    5. 手続き一覧に新規登録した手続きが表示されることを確認

- [ ] **手続きの編集**
  - テスト手順:
    1. 手続き一覧から編集したい手続きの「編集」ボタンをクリック
    2. フォームの内容を変更して保存
    3. 手続き一覧に変更が反映されることを確認

- [ ] **手続きの削除**
  - テスト手順:
    1. 手続き一覧から削除したい手続きの「削除」ボタンをクリック
    2. 確認ダイアログで「OK」をクリック
    3. 手続き一覧から削除されたことを確認

### 7.2 フィルタ機能のテスト

- [ ] **ステータスフィルタ**
  - テスト手順:
    1. ステータスフィルタで「提出済」を選択
    2. 手続き一覧に「提出済」の手続きのみが表示されることを確認

- [ ] **期限フィルタ**
  - テスト手順:
    1. 期限フィルタで「期限が近い（7日以内）」を選択
    2. 手続き一覧に期限が7日以内の未完了手続き（未着手・準備中・差戻し）のみが表示されることを確認
    3. 期限フィルタで「期限切れ」を選択
    4. 手続き一覧に期限切れの未完了手続き（未着手・準備中・差戻し）のみが表示されることを確認
    5. 提出済の手続きは期限フィルタの対象外であることを確認

### 7.3 提出期限の自動計算のテスト

- [ ] **事由発生日変更時の提出期限自動計算**
  - テスト手順:
    1. 手続き登録フォームを開く
    2. 手続き種別を選択
    3. 事由発生日を入力
    4. 提出期限が自動計算されることを確認

### 7.4 セキュリティのテスト

- [ ] **admin/hrは全手続きを閲覧・作成・更新・削除可能**
  - テスト手順:
    1. admin/hrロールでログイン
    2. `/procedures`画面を開く
    3. 全手続きが表示されることを確認
    4. 手続きの作成・編集・削除が可能であることを確認

- [ ] **employeeは/proceduresにアクセス不可**
  - テスト手順:
    1. employeeロールでログイン
    2. `/procedures`画面にアクセスできないことを確認（ルーティングガードでブロック）

---

## 8. 実装完了の判定基準

Phase3-4完了の判定基準：

1. ✅ `src/app/types.ts`に`ProcedureType`、`ProcedureStatus`、`SocialInsuranceProcedure`型が追加されている
2. ✅ `SocialInsuranceProcedure`型の`assignedPersonName`フィールドがテキスト型として定義されている（`assignedToUserId`ではない）
3. ✅ `src/app/services/procedures.service.ts`が存在し、CRUD操作（`create()`、`list()`、`listByDeadline()`、`update()`、`delete()`）が実装されている
4. ✅ `list()`はリアルタイム購読パターン（`collectionData`）を使用している
5. ✅ `listByDeadline()`の未完了ステータスは`['not_started', 'in_progress', 'rejected']`を使用している
6. ✅ `src/app/utils/procedure-deadline-calculator.ts`が存在し、提出期限の自動計算ロジックが実装されている
7. ✅ `src/app/pages/procedures/procedure-form-dialog.component.ts`が存在し、手続きの登録・編集ができる
8. ✅ フォームでは`<input type="date">`を使用し、日付は`YYYY-MM-DD`形式のstringとして扱われている
9. ✅ 担当者フィールドはテキスト入力（`<input matInput>`）として実装されている
10. ✅ `src/app/pages/procedures/procedures.page.ts`が実装され、手続き一覧が表示できる
11. ✅ ViewModel合成パターンを使用して、従業員名・被扶養者名が表示される
12. ✅ ステータスフィルタ、期限フィルタ、手続き種別フィルタが動作する
13. ✅ `/procedures`ルートが追加され、admin/hr専用（employeeロールはアクセス不可）
14. ✅ `firestore.rules`に`procedures`コレクションのセキュリティルールが追加されている（`match /offices/{officeId}`ブロック内）
15. ✅ 既存の機能（従業員台帳の登録・編集・削除など）が正常に動作する
16. ✅ テスト観点のチェックリストの主要項目（7.1〜7.3）がすべてクリアされている

---

以上
