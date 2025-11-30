# Phase3-3 実装指示書: 従業員情報の変更申請・承認（簡易ワークフロー）機能

## 1. 概要

Phase3-3では、一般従業員が自分のプロフィール情報（住所・電話番号・メールアドレス）を申請し、管理者・担当者が承認する簡易ワークフロー機能を実装します。

従業員本人がWeb画面から変更申請を行い、管理者・担当者（admin/hr）が申請一覧画面で内容を確認して承認・却下を行うことで、従業員台帳の更新を安全かつ効率的に行えるようにします。

**重要**: 賃金（報酬月額）・標準報酬月額・等級・社会保険加入フラグ・入社日・退職日など、社会保険料の計算に直接影響する項目は申請対象外とし、引き続き管理者・担当者が画面から直接更新します。

---

## 2. 前提・ゴール

### 前提

- **型定義**: `ChangeRequest`型と`ChangeRequestStatus`型は既に`src/app/types.ts`に定義されています
- **既存サービス**: `OfficeCollectionsService.listChangeRequests()`メソッドが存在しますが、これは`ChangeRequestsService.list()`を呼び出すだけの薄いラッパーとして扱います。UIやページコンポーネントは直接`OfficeCollectionsService.listChangeRequests()`を呼ばず、`ChangeRequestsService`を使用します
- **既存ページ**: `src/app/pages/requests/requests.page.ts`はプレースホルダーのみで、実装は未完了です。このファイルを「変更申請一覧ページ」として実装します
- **セキュリティルール**: `firestore.rules`に`changeRequests`コレクションのルールは未定義です
- **従業員情報の更新**: `EmployeesService.save()`メソッドで従業員情報を更新できます
- **ユーザー情報の取得**: 既存の「現在ログイン中のユーザー情報」を取得するサービス（例：`CurrentUserService`または`AuthService`）が存在します。コード例ではプロジェクトで実際に使っているサービス名に合わせて読み替えてください

### ゴール

Phase3-3完了の判定基準：

1. ✅ **変更申請サービス**（`src/app/services/change-requests.service.ts`）が存在し、CRUD操作が実装されていること
   - 申請の作成（`create()`）
   - 申請の一覧取得（`list()`）- リアルタイム購読に対応
   - 申請の承認（`approve()`）
   - 申請の却下（`reject()`）

2. ✅ **申請登録画面**（`src/app/pages/requests/change-request-form-dialog.component.ts`）が実装され、従業員本人が申請できること
   - 申請可能な項目：住所、電話番号、メールアドレス（`field`の`'other'`は今回のフェーズでは使用しない）
   - 現在値と申請値を表示・入力できる

3. ✅ **申請一覧画面**（`src/app/pages/requests/requests.page.ts`）が実装され、管理者・担当者が承認・却下できること
   - 事業所ごとの申請一覧表示
   - ステータス別フィルタ（pending / approved / rejected）
   - 承認・却下ボタン
   - 却下理由の入力（却下時）
   - **admin/hr専用**（employeeロールはアクセス不可）

4. ✅ **マイページに申請履歴セクション**が追加されていること
   - employeeロールが自分の申請履歴と却下理由（`rejectReason`）を確認できる
   - 「変更申請を行う」ボタンから申請登録ダイアログを開ける

5. ✅ **承認時の自動反映**が実装されていること
   - 承認時：従業員台帳への自動反映（`EmployeesService.save()`を使用）
   - 承認後：申請ステータスを`approved`に更新、`decidedAt`と`decidedByUserId`を設定
   - **注意**: 研修アプリの範囲では「従業員更新 → 申請ステータス更新」の順序で許容しますが、本番システムならトランザクションを検討してください

6. ✅ **却下時の処理**が実装されていること
   - 却下時：申請ステータスを`rejected`に更新、`rejectReason`を保存、`decidedAt`と`decidedByUserId`を設定
   - 却下理由を申請者がマイページで確認できる

7. ✅ **Firestoreセキュリティルール**が実装されていること
   - 従業員本人は自分の申請のみ作成・閲覧可能
   - 管理者・担当者は全申請を閲覧・承認・却下可能
   - **従業員本人しか`changeRequests`を`create`できない**仕様（代理登録は対象外）

8. ✅ **既存機能が壊れていないこと**（従業員台帳の登録・編集・削除など）

---

## 3. 現状整理

### 3.0 実コード確認済み事項（2025-11-30時点）

以下の事項は実コードを確認済みです。実装時はこれらの情報を前提として進めてください。

- ✅ **型定義**: `ChangeRequest`型と`ChangeRequestStatus`型は`src/app/types.ts`に定義されています
- ✅ **既存サービス**: `OfficeCollectionsService.listChangeRequests()`メソッドが存在しますが、UIやページコンポーネントは直接呼ばず、`ChangeRequestsService`を使用します
- ✅ **既存ページ**: `src/app/pages/requests/requests.page.ts`はプレースホルダーのみで、実装は未完了です。このファイルを実装します
- ✅ **従業員サービス**: `EmployeesService.save()`メソッドで従業員情報を更新できます。ただし、単一従業員取得メソッド（`get(officeId, employeeId)`）は存在しないため、パフォーマンスのため追加することを推奨します
- ✅ **セキュリティルール**: `firestore.rules`に`changeRequests`コレクションのルールは未定義です
- ✅ **リアルタイム購読パターン**: `DependentsService`や`StandardRewardHistoryService`は`collectionData`を使用したリアルタイム購読パターンを使用しています。`ChangeRequestsService.list()`もこのパターンに合わせます

### 3.1 ChangeRequest型の定義

`src/app/types.ts`に定義されている`ChangeRequest`型：

```typescript
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ChangeRequest {
  id: string;
  officeId: string;
  employeeId: string;
  requestedByUserId: string;
  field: 'address' | 'phone' | 'email' | 'other';
  currentValue: string;
  requestedValue: string;
  status: ChangeRequestStatus;
  requestedAt: IsoDateString;
  decidedAt?: IsoDateString;
  decidedByUserId?: string;
  rejectReason?: string;
}
```

**確認済み**:
- `field`は`'address' | 'phone' | 'email' | 'other'`の4種類ですが、**Phase3-3では`'other'`は使用しません**（将来拡張用）
- `status`は`'pending' | 'approved' | 'rejected'`の3種類
- `requestedByUserId`は申請者のユーザーID
- `decidedByUserId`は承認・却下を行ったユーザーID
- `rejectReason`は却下理由（却下時のみ）

### 3.2 既存のサービス実装

`src/app/services/office-collections.service.ts`に`listChangeRequests()`メソッドが存在しますが、UIやページコンポーネントは直接呼ばず、`ChangeRequestsService`を使用します。

**確認済み**:
- `listChangeRequests(officeId: string): Observable<ChangeRequest[]>`が存在します
- コレクションパス: `offices/{officeId}/changeRequests`
- CRUD操作（`create()`, `approve()`, `reject()`）は`ChangeRequestsService`に実装します

### 3.3 既存のページ実装

`src/app/pages/requests/requests.page.ts`はプレースホルダーのみで、実装は未完了です。このファイルを「変更申請一覧ページ」として実装します。

**確認済み**:
- スタンドアロンコンポーネントとして実装されています
- テンプレートは「準備中」のメッセージのみです
- 実装が必要です

### 3.4 従業員情報の更新方法

`src/app/services/employees.service.ts`の`save()`メソッドで従業員情報を更新できます。

**確認済み**:
- `save(officeId: string, employee: Partial<Employee> & { id?: string }): Promise<void>`
- `Employee`型には`address`, `phone`, `email`フィールドが存在します
- 承認時は、このメソッドを使用して従業員情報を更新します
- **注意**: 単一従業員取得メソッド（`get(officeId, employeeId)`）は存在しないため、パフォーマンスのため追加することを推奨します

### 3.5 セキュリティルールの現状

`firestore.rules`に`changeRequests`コレクションのルールは未定義です。

**確認済み**:
- `offices/{officeId}/changeRequests`のルールが存在しません
- 実装時に`match /offices/{officeId}`ブロック内に`match /changeRequests/{requestId}`を追加する必要があります

### 3.6 リアルタイム購読パターン

既存のサービス（`DependentsService`、`StandardRewardHistoryService`）は`collectionData`を使用したリアルタイム購読パターンを使用しています。

**確認済み**:
- `DependentsService.list()`は`collectionData(ref, { idField: 'id' })`を使用
- `ChangeRequestsService.list()`もこのパターンに合わせます

---

## 4. 変更対象ファイル

### 4.1 新規作成ファイル

1. **`src/app/services/change-requests.service.ts`**
   - 変更申請のCRUD操作を提供するサービス
   - `create()`, `list()`, `approve()`, `reject()`メソッドを実装
   - `list()`はリアルタイム購読パターン（`collectionData`）を使用

2. **`src/app/pages/requests/change-request-form-dialog.component.ts`**
   - 申請登録ダイアログ（従業員本人向け）
   - 現在値と申請値の入力フォーム
   - `field`の選択肢は「住所」「電話番号」「メールアドレス」のみ（`'other'`は含めない）

3. **`src/app/pages/requests/reject-reason-dialog.component.ts`**
   - 却下理由入力ダイアログ

### 4.2 既存ファイルの変更

1. **`src/app/pages/requests/requests.page.ts`**
   - 既存のプレースホルダーを削除し、「変更申請一覧ページ」として実装
   - admin/hr専用（employeeロールはアクセス不可）

2. **`src/app/pages/me/my-page.ts`**
   - マイページに「変更申請履歴」セクションを追加
   - employeeロールが自分の申請履歴と却下理由を確認できる
   - 「変更申請を行う」ボタンから申請登録ダイアログを開ける

3. **`src/app/services/employees.service.ts`**（推奨）
   - 単一従業員取得メソッド（`get(officeId, employeeId)`）を追加（パフォーマンス向上のため）

4. **`firestore.rules`**
   - `match /offices/{officeId}`ブロック内に`match /changeRequests/{requestId}`を追加
   - 既存のヘルパー関数（`belongsToOffice`, `isAdminOrHr`, `isInsureEmployee`, `currentUser()`など）を使用

5. **`src/app/app.routes.ts`**（必要に応じて）
   - `/requests`のルーティングが既に存在する場合は確認、存在しない場合は追加

### 4.3 スコープの明確化

**Phase3-3の対象範囲**:
- 申請可能な項目：住所、電話番号、メールアドレスの3項目のみ（`field`の`'other'`は使用しない）
- 申請対象外：報酬月額・標準報酬月額・等級・社会保険加入フラグ・入社日・退職日など
- ワークフロー：1段階承認の簡易機能（多段階承認は対象外）
- 通知機能：承認・却下時の通知は対象外（将来的に追加可能）
- 申請一覧画面：admin/hr専用（employeeロールはアクセス不可）
- 申請履歴確認：employeeロールはマイページで自分の申請履歴と却下理由を確認

---

## 5. 画面仕様

### 5.1 申請登録画面（従業員本人向け）

#### 5.1.1 アクセス方法

- **マイページ**（`/me`）の「変更申請履歴」セクションから「変更申請を行う」ボタンをクリック

#### 5.1.2 画面構成

- **ダイアログ形式**（`MatDialog`を使用）
- **タイトル**: 「プロフィール変更申請」
- **フォーム項目**:
  1. **変更項目**（`mat-select`）
     - 選択肢: 「住所」「電話番号」「メールアドレス」のみ（`'other'`は含めない）
     - 必須項目
  2. **現在の値**（`mat-input`、読み取り専用）
     - 従業員情報から自動取得
     - 変更項目に応じて表示内容を切り替え
  3. **申請する値**（`mat-input`）
     - 必須項目
     - バリデーション: 空欄不可、形式チェック（メールアドレスの場合）

#### 5.1.3 アクション

- **申請する**ボタン: 申請を登録し、ダイアログを閉じる
- **キャンセル**ボタン: ダイアログを閉じる

### 5.2 申請一覧画面（管理者・担当者向け）

#### 5.2.1 アクセス方法

- **サイドメニュー**から「変更申請」をクリック
- **ルート**: `/requests`
- **アクセス権限**: admin/hr専用（employeeロールはアクセス不可）

#### 5.2.2 画面構成

- **ページ形式**（`RequestsPage`）
- **ヘッダカード**:
  - タイトル: 「変更申請一覧」
  - 説明文: 「従業員からのプロフィール変更申請を承認・却下できます。」
- **フィルタセクション**:
  - ステータスフィルタ（`mat-select`）
    - 選択肢: 「すべて」「承認待ち」「承認済み」「却下済み」
    - デフォルト: 「承認待ち」
- **申請一覧テーブル**（`MatTableModule`を使用）:
  - 列: 申請日時、申請者、変更項目、現在の値、申請する値、ステータス、アクション
  - ソート: 申請日時の降順（デフォルト）
  - ページネーション: 必要に応じて実装（今回は省略可）

#### 5.2.3 アクション

- **承認**ボタン: 申請を承認し、従業員台帳に反映
- **却下**ボタン: 却下理由を入力して却下

### 5.3 マイページの申請履歴セクション（従業員本人向け）

#### 5.3.1 画面構成

- **セクションタイトル**: 「変更申請履歴」
- **表示内容**:
  - 自分の申請一覧（ステータス別に表示）
  - 各申請の詳細：申請日時、変更項目、現在の値、申請する値、ステータス
  - 却下済みの場合は却下理由（`rejectReason`）を表示
- **アクション**:
  - **変更申請を行う**ボタン: 申請登録ダイアログを開く

### 5.4 却下理由入力ダイアログ

#### 5.4.1 画面構成

- **ダイアログ形式**（`MatDialog`を使用）
- **タイトル**: 「却下理由を入力」
- **フォーム項目**:
  - **却下理由**（`mat-textarea`、必須）
    - 最大500文字
- **アクション**:
  - **却下する**ボタン: 却下理由を保存して却下
  - **キャンセル**ボタン: ダイアログを閉じる

---

## 6. 実装方針

### Step 1: ChangeRequestsServiceの実装

**対象ファイル**: `src/app/services/change-requests.service.ts`（新規作成）

**目的**: 変更申請のCRUD操作を提供するサービスを作成

**実装内容**:

1. **サービスの基本構造**
   ```typescript
   @Injectable({ providedIn: 'root' })
   export class ChangeRequestsService {
     constructor(private readonly firestore: Firestore) {}
     
     private collectionPath(officeId: string) {
       return collection(this.firestore, 'offices', officeId, 'changeRequests');
     }
   }
   ```

2. **申請の作成**（`create()`メソッド）
   ```typescript
   async create(
     officeId: string,
     request: {
       employeeId: string;
       requestedByUserId: string;
       field: 'address' | 'phone' | 'email';
       currentValue: string;
       requestedValue: string;
     }
   ): Promise<void> {
     const ref = this.collectionPath(officeId);
     const docRef = doc(ref);
     const now = new Date().toISOString();
     
     const payload: ChangeRequest = {
       id: docRef.id,
       officeId,
       employeeId: request.employeeId,
       requestedByUserId: request.requestedByUserId,
       field: request.field,
       currentValue: request.currentValue,
       requestedValue: request.requestedValue,
       status: 'pending',
       requestedAt: now
     };
     
     await setDoc(docRef, payload);
   }
   ```

3. **申請の一覧取得**（`list()`メソッド）- リアルタイム購読パターン（admin/hr用）
   ```typescript
   list(officeId: string, status?: ChangeRequestStatus): Observable<ChangeRequest[]> {
     const ref = this.collectionPath(officeId);
     const q = status
       ? query(ref, where('status', '==', status), orderBy('requestedAt', 'desc'))
       : query(ref, orderBy('requestedAt', 'desc'));
     
     return collectionData(q, { idField: 'id' }) as Observable<ChangeRequest[]>;
   }
   ```

4. **ユーザー単位の申請一覧取得**（`listForUser()`メソッド）- リアルタイム購読パターン（employee用）
   ```typescript
   listForUser(
     officeId: string,
     userId: string,
     status?: ChangeRequestStatus
   ): Observable<ChangeRequest[]> {
     const ref = this.collectionPath(officeId);
     const q = status
       ? query(
           ref,
           where('requestedByUserId', '==', userId),
           where('status', '==', status),
           orderBy('requestedAt', 'desc')
         )
       : query(
           ref,
           where('requestedByUserId', '==', userId),
           orderBy('requestedAt', 'desc')
         );
     
     return collectionData(q, { idField: 'id' }) as Observable<ChangeRequest[]>;
   }
   ```
   
   **注意**: `listForUser()`はemployeeロールが自分の申請のみを取得するために使用します。Firestoreのセキュリティルールと整合性を保つため、クエリで`requestedByUserId`を絞り込みます。

5. **申請の承認**（`approve()`メソッド）
   ```typescript
   async approve(
     officeId: string,
     requestId: string,
     decidedByUserId: string
   ): Promise<void> {
     const ref = this.collectionPath(officeId);
     const docRef = doc(ref, requestId);
     const now = new Date().toISOString();
     
     await updateDoc(docRef, {
       status: 'approved',
       decidedAt: now,
       decidedByUserId
     });
   }
   ```

6. **申請の却下**（`reject()`メソッド）
   ```typescript
   async reject(
     officeId: string,
     requestId: string,
     decidedByUserId: string,
     rejectReason: string
   ): Promise<void> {
     const ref = this.collectionPath(officeId);
     const docRef = doc(ref, requestId);
     const now = new Date().toISOString();
     
     await updateDoc(docRef, {
       status: 'rejected',
       decidedAt: now,
       decidedByUserId,
       rejectReason
     });
   }
   ```

**必要なインポート**:
```typescript
import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { ChangeRequest, ChangeRequestStatus } from '../types';
```

**注意**: `list()`は1回きりの`getDocs`ではなく、`collectionData`を使用したリアルタイム購読パターンにします。これにより、承認・却下後に一覧が自動更新されます。

### Step 2: EmployeesServiceに単一取得メソッドを追加（推奨）

**対象ファイル**: `src/app/services/employees.service.ts`

**目的**: パフォーマンス向上のため、単一従業員取得メソッドを追加

**実装内容**:

```typescript
get(officeId: string, employeeId: string): Observable<Employee | null> {
  const ref = doc(this.collectionPath(officeId), employeeId);
  return from(getDoc(ref)).pipe(
    map((snapshot) => {
      if (!snapshot.exists()) {
        return null;
      }
      return { id: snapshot.id, ...(snapshot.data() as any) } as Employee;
    })
  );
}
```

**必要なインポート**（既に存在する場合は追加不要）:
```typescript
import { getDoc } from '@angular/fire/firestore';
import { from, map } from 'rxjs';
```

**注意**: このメソッドがない場合、承認処理で`list().pipe(find(...))`を使用することになりますが、パフォーマンスのため単一取得メソッドの追加を推奨します。

### Step 3: 申請登録ダイアログの実装

**対象ファイル**: `src/app/pages/requests/change-request-form-dialog.component.ts`（新規作成）

**目的**: 従業員本人が変更申請を登録できるダイアログを作成

**実装内容**:

1. **コンポーネントの基本構造**
   ```typescript
   @Component({
     selector: 'ip-change-request-form-dialog',
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
   export class ChangeRequestFormDialogComponent {
     // ...
   }
   ```

2. **フォームの定義**
   ```typescript
   form = this.fb.group({
     field: ['', Validators.required],
     requestedValue: ['', Validators.required]
   });
   ```

3. **変更項目の選択肢**
   - `mat-select`の選択肢は「住所」「電話番号」「メールアドレス」のみ（`'other'`は含めない）

4. **現在値の取得**
   - `data.employee`から`address`, `phone`, `email`を取得
   - `field`の値に応じて現在値を表示

5. **バリデーション**
   - `field`: 必須
   - `requestedValue`: 必須、メールアドレスの場合は形式チェック

6. **申請の登録**
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
     
     const currentValue = this.getCurrentValue(formValue.field);
     
     await this.changeRequestsService.create(this.data.officeId, {
       employeeId: this.data.employee.id,
       requestedByUserId: currentUserId,
       field: formValue.field as 'address' | 'phone' | 'email',
       currentValue,
       requestedValue: formValue.requestedValue
     });
     
     this.dialogRef.close(true);
   }
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
import { ChangeRequestsService } from '../../services/change-requests.service';
import { CurrentUserService } from '../../services/current-user.service';
import { Employee } from '../../types';
```

**注意**: `CurrentUserService`はプロジェクトで実際に使っているサービス名に合わせて読み替えてください（例：`AuthService`など）。

### Step 4: 申請一覧画面の実装

**対象ファイル**: `src/app/pages/requests/requests.page.ts`（既存ファイルを実装）

**目的**: 管理者・担当者が申請一覧を確認し、承認・却下できる画面を作成

**実装内容**:

1. **コンポーネントの基本構造**
   ```typescript
   @Component({
     selector: 'ip-requests-page',
     standalone: true,
     imports: [
       MatCardModule,
       MatTableModule,
       MatButtonModule,
       MatIconModule,
       MatSelectModule,
       MatFormFieldModule,
       MatDialogModule,
       NgIf,
       DatePipe,
       AsyncPipe
     ],
     template: `...`,
     styles: [`...`]
   })
   export class RequestsPage {
     // ...
   }
   ```

2. **データの取得**
   ```typescript
   readonly selectedStatus$ = new BehaviorSubject<ChangeRequestStatus | 'all'>('pending');
   
   readonly requests$ = combineLatest([
     this.currentOffice.officeId$,
     this.selectedStatus$
   ]).pipe(
     switchMap(([officeId, status]) => {
       if (!officeId) return of([]);
       return this.changeRequestsService.list(
         officeId,
         status === 'all' ? undefined : status
       );
     })
   );
   ```

3. **承認処理**
   ```typescript
   async approve(request: ChangeRequest): Promise<void> {
     const currentUserId = await firstValueFrom(
       this.currentUser.profile$.pipe(
         map(profile => profile?.id ?? null)
       )
     );
     
     if (!currentUserId) {
       throw new Error('ユーザーIDが取得できませんでした');
     }
     
     const officeId = await firstValueFrom(this.currentOffice.officeId$);
     if (!officeId) return;
     
     // 従業員情報を取得（単一取得メソッドを使用）
     const employee = await firstValueFrom(
       this.employeesService.get(officeId, request.employeeId)
     );
     
     if (!employee) {
       throw new Error('従業員が見つかりませんでした');
     }
     
     // 申請内容を従業員情報に反映
     const updateData: Partial<Employee> = {};
     if (request.field === 'address') updateData.address = request.requestedValue;
     if (request.field === 'phone') updateData.phone = request.requestedValue;
     if (request.field === 'email') updateData.email = request.requestedValue;
     
     // 注意: 研修アプリの範囲ではこの順序で許容するが、
     // 本番システムならトランザクションを検討する
     await this.employeesService.save(officeId, {
       ...employee,
       ...updateData,
       updatedByUserId: currentUserId
     });
     
     // 申請を承認
     await this.changeRequestsService.approve(officeId, request.id, currentUserId);
   }
   ```

4. **却下処理**
   ```typescript
   async reject(request: ChangeRequest): Promise<void> {
     const dialogRef = this.dialog.open(RejectReasonDialogComponent, {
       width: '500px',
       data: { request }
     });
     
     const result = await firstValueFrom(dialogRef.afterClosed());
     if (!result) return;
     
     const currentUserId = await firstValueFrom(
       this.currentUser.profile$.pipe(
         map(profile => profile?.id ?? null)
       )
     );
     
     if (!currentUserId) {
       throw new Error('ユーザーIDが取得できませんでした');
     }
     
     const officeId = await firstValueFrom(this.currentOffice.officeId$);
     if (!officeId) return;
     
     await this.changeRequestsService.reject(
       officeId,
       request.id,
       currentUserId,
       result.reason
     );
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
import { NgIf, DatePipe, AsyncPipe } from '@angular/common';
import { BehaviorSubject, combineLatest, firstValueFrom, map, switchMap, of } from 'rxjs';
import { ChangeRequestsService } from '../../services/change-requests.service';
import { EmployeesService } from '../../services/employees.service';
import { CurrentUserService } from '../../services/current-user.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { ChangeRequest, ChangeRequestStatus, Employee } from '../../types';
import { RejectReasonDialogComponent } from './reject-reason-dialog.component';
```

**注意**: 
- `of`のインポートを忘れないでください
- `CurrentUserService`はプロジェクトで実際に使っているサービス名に合わせて読み替えてください
- 単一取得メソッド（`get()`）がない場合は、`list().pipe(find(...))`を使用しますが、パフォーマンスのため`get()`の追加を推奨します

### Step 5: 却下理由入力ダイアログの実装

**対象ファイル**: `src/app/pages/requests/reject-reason-dialog.component.ts`（新規作成）

**目的**: 却下理由を入力するダイアログを作成

**実装内容**:

```typescript
@Component({
  selector: 'ip-reject-reason-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    NgIf
  ],
  template: `
    <h1 mat-dialog-title>却下理由を入力</h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>却下理由</mat-label>
        <textarea matInput formControlName="reason" rows="4" maxlength="500"></textarea>
        <mat-hint>{{ form.get('reason')?.value?.length || 0 }} / 500</mat-hint>
      </mat-form-field>
    </form>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>キャンセル</button>
      <button mat-button color="warn" (click)="submit()" [disabled]="form.invalid">
        却下する
      </button>
    </div>
  `,
  styles: [`
    .full-width {
      width: 100%;
    }
  `]
})
export class RejectReasonDialogComponent {
  form = this.fb.group({
    reason: ['', [Validators.required, Validators.maxLength(500)]]
  });
  
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { request: ChangeRequest },
    private readonly dialogRef: MatDialogRef<RejectReasonDialogComponent>,
    private readonly fb: FormBuilder
  ) {}
  
  submit(): void {
    if (this.form.invalid) return;
    this.dialogRef.close({ reason: this.form.get('reason')?.value });
  }
}
```

### Step 6: マイページへの申請履歴セクション追加

**対象ファイル**: `src/app/pages/me/my-page.ts`

**目的**: 従業員本人がマイページから変更申請を行い、申請履歴と却下理由を確認できるようにする

**実装内容**:

1. **申請履歴セクションの追加**
   ```html
   <mat-card class="content-card">
     <div class="page-header">
       <h2>
         <mat-icon>edit</mat-icon>
         変更申請履歴
       </h2>
     </div>
     <div class="section-content">
       <button mat-stroked-button color="primary" (click)="openChangeRequestDialog()">
         <mat-icon>add</mat-icon>
         変更申請を行う
       </button>
       
       <div *ngIf="myRequests$ | async as requests; else noRequests">
         <table mat-table [dataSource]="requests" class="requests-table">
           <!-- 申請日時列 -->
           <ng-container matColumnDef="requestedAt">
             <th mat-header-cell *matHeaderCellDef>申請日時</th>
             <td mat-cell *matCellDef="let row">
               {{ row.requestedAt | date: 'yyyy-MM-dd HH:mm' }}
             </td>
           </ng-container>
           
           <!-- 変更項目列 -->
           <ng-container matColumnDef="field">
             <th mat-header-cell *matHeaderCellDef>変更項目</th>
             <td mat-cell *matCellDef="let row">
               {{ getFieldLabel(row.field) }}
             </td>
           </ng-container>
           
           <!-- 現在の値列 -->
           <ng-container matColumnDef="currentValue">
             <th mat-header-cell *matHeaderCellDef>現在の値</th>
             <td mat-cell *matCellDef="let row">{{ row.currentValue || '-' }}</td>
           </ng-container>
           
           <!-- 申請する値列 -->
           <ng-container matColumnDef="requestedValue">
             <th mat-header-cell *matHeaderCellDef>申請する値</th>
             <td mat-cell *matCellDef="let row">{{ row.requestedValue }}</td>
           </ng-container>
           
           <!-- ステータス列 -->
           <ng-container matColumnDef="status">
             <th mat-header-cell *matHeaderCellDef>ステータス</th>
             <td mat-cell *matCellDef="let row">
               <span [class]="'status-' + row.status">
                 {{ getStatusLabel(row.status) }}
               </span>
             </td>
           </ng-container>
           
           <!-- 却下理由列 -->
           <ng-container matColumnDef="rejectReason">
             <th mat-header-cell *matHeaderCellDef>却下理由</th>
             <td mat-cell *matCellDef="let row">
               <span *ngIf="row.rejectReason" class="reject-reason">
                 {{ row.rejectReason }}
               </span>
               <span *ngIf="!row.rejectReason">-</span>
             </td>
           </ng-container>
           
           <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
           <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
         </table>
       </div>
       <ng-template #noRequests>
         <p class="no-data">申請履歴がありません。</p>
       </ng-template>
     </div>
   </mat-card>
   ```

2. **コンポーネントロジックの追加**
   ```typescript
   readonly displayedColumns = ['requestedAt', 'field', 'currentValue', 'requestedValue', 'status', 'rejectReason'];
   
   readonly myRequests$ = combineLatest([
     this.currentOffice.officeId$,
     this.currentUser.profile$
   ]).pipe(
     switchMap(([officeId, profile]) => {
       if (!officeId || !profile?.id) return of([]);
       // listForUser()を使用してクエリで絞り込む（Firestoreルールと整合性を保つ）
       return this.changeRequestsService.listForUser(officeId, profile.id);
     })
   );
   
   async openChangeRequestDialog(): Promise<void> {
     const [employee, officeId] = await Promise.all([
       firstValueFrom(this.employee$),
       firstValueFrom(this.currentOffice.officeId$)
     ]);
     
     if (!employee || !officeId) return;
     
     this.dialog.open(ChangeRequestFormDialogComponent, {
       width: '600px',
       data: { employee, officeId }
     });
   }
   
   getFieldLabel(field: ChangeRequest['field']): string {
     switch (field) {
       case 'address': return '住所';
       case 'phone': return '電話番号';
       case 'email': return 'メールアドレス';
       default: return field;
     }
   }
   
   getStatusLabel(status: ChangeRequestStatus): string {
     switch (status) {
       case 'pending': return '承認待ち';
       case 'approved': return '承認済み';
       case 'rejected': return '却下済み';
     }
   }
   ```

3. **必要なインポートの追加**
   ```typescript
   import { MatDialog, MatDialogModule } from '@angular/material/dialog';
   import { MatButtonModule } from '@angular/material/button';
   import { MatTableModule } from '@angular/material/table';
   import { MatIconModule } from '@angular/material/icon';
   import { DatePipe } from '@angular/common';
   import { firstValueFrom } from 'rxjs';
   import { ChangeRequestsService } from '../../services/change-requests.service';
   import { ChangeRequest, ChangeRequestStatus } from '../../types';
   import { ChangeRequestFormDialogComponent } from '../requests/change-request-form-dialog.component';
   ```
   
   **注意**: テンプレートで使用している`MatTableModule`、`MatIconModule`、`DatePipe`なども`imports`配列に追加してください。既に`my-page.ts`で他のセクションで使用している場合は追加不要です。

**注意**: 
- `openChangeRequestDialog()`は`async`で宣言し、`firstValueFrom()`を使用してObservableから値を取得します
- TSファイル内で`| async`は使用しません

### Step 7: Firestoreセキュリティルールの追加

**対象ファイル**: `firestore.rules`

**目的**: `changeRequests`コレクションのセキュリティルールを追加

**実装内容**:

`match /offices/{officeId}`ブロック内に以下を追加：

```javascript
// 変更申請（changeRequests）
match /changeRequests/{requestId} {
  // 閲覧: 所属ユーザー全員が閲覧可能
  // ただし、employeeロールは自分の申請のみ閲覧可能
  // 注意: クエリで requestedByUserId を絞り込む必要がある（listForUser()を使用）
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    (isInsureEmployee(officeId) && resource.data.requestedByUserId == request.auth.uid)
  );
  
  // 作成: 従業員本人しか作成できない（代理登録は対象外）
  // employeeロールは自分の従業員IDの申請のみ作成可能
  // admin/hrも自分の従業員IDの申請のみ作成可能（自分自身の申請として扱う）
  allow create: if belongsToOffice(officeId)
    && (isInsureEmployee(officeId) || isAdminOrHr(officeId))
    && request.resource.data.employeeId == currentUser().data.employeeId
    && request.resource.data.requestedByUserId == request.auth.uid
    && request.resource.data.keys().hasOnly([
      'id', 'officeId', 'employeeId', 'requestedByUserId',
      'field', 'currentValue', 'requestedValue', 'status',
      'requestedAt', 'decidedAt', 'decidedByUserId', 'rejectReason'
    ])
    && request.resource.data.officeId == officeId
    && request.resource.data.status == 'pending'
    // 作成時は decidedAt / decidedByUserId / rejectReason は未設定であることを明示的に縛る
    && !('decidedAt' in request.resource.data)
    && !('decidedByUserId' in request.resource.data)
    && !('rejectReason' in request.resource.data);
  
  // 更新: 管理者・担当者のみ更新可能（承認・却下）
  // 注意: belongsToOffice(officeId) を明示的に追加して、他のルール（read / create）とポリシーを揃える
  allow update: if belongsToOffice(officeId) && isAdminOrHr(officeId) && (
    // ステータスの変更のみ許可
    request.resource.data.diff(resource.data).changedKeys().hasOnly(['status', 'decidedAt', 'decidedByUserId', 'rejectReason'])
    // 承認時: status を 'approved' に変更
    && (
      (request.resource.data.status == 'approved' && resource.data.status == 'pending')
      // 却下時: status を 'rejected' に変更、rejectReason を設定
      || (request.resource.data.status == 'rejected' && resource.data.status == 'pending' && request.resource.data.rejectReason is string)
    )
    && request.resource.data.decidedByUserId == request.auth.uid
    && request.resource.data.decidedAt is string
  );
  
  // 削除: 許可しない（履歴として保持）
  allow delete: if false;
}
```

**注意事項**:
- 以下のルールでは既存の`belongsToOffice`、`isAdminOrHr`、`isInsureEmployee`、`currentUser()`などのヘルパー関数を利用します。もし名前が異なる場合は、プロジェクト側の名前に置き換えてください
- `create`ルールでは、`request.resource.data.employeeId == currentUser().data.employeeId`と`request.resource.data.requestedByUserId == request.auth.uid`を要求しているため、**従業員本人しか`changeRequests`を`create`できない**仕様になっています（代理登録は対象外）。admin/hrも自分の従業員IDの申請のみ作成可能です。将来の拡張（代理登録）の余地があることを「今後の拡張」として書いておく程度でOKです
- `create`ルールでは、`decidedAt`、`decidedByUserId`、`rejectReason`が未設定であることを明示的に縛っています。これにより、作成時にこれらのフィールドが設定されることを防ぎます（実際のクライアント実装では設定しませんが、ルールとして厳密にしておく）
- `update`ルールでは、`belongsToOffice(officeId)`を明示的に追加して、他のルール（`read`、`create`）とポリシーを揃えています。`isAdminOrHr()`の中で既に`belongsToOffice()`をチェックしている場合でも、ルールファイルを単体で読んだときに分かりやすくなります
- `read`ルールでは、employeeロールは`resource.data.requestedByUserId == request.auth.uid`の条件で自分の申請のみ閲覧可能です。このため、クライアント側でも`listForUser()`を使用してクエリで`requestedByUserId`を絞り込む必要があります。全件クエリ（`list()`）をemployeeが実行すると権限エラーになります
- ルールの追加箇所は`match /offices/{officeId}`ブロック内に`match /changeRequests/{requestId}`を追加する形です（root直下に書く誤解を避けるため）

### Step 8: ルーティングの確認・追加

**対象ファイル**: `src/app/app.routes.ts`

**目的**: `/requests`のルーティングが存在するか確認し、存在しない場合は追加

**実装内容**:

```typescript
{
  path: 'requests',
  component: RequestsPage,
  canActivate: [authGuard, officeGuard, roleGuard],
  data: { roles: ['admin', 'hr'] }
}
```

**注意**: `/requests`のルーティングが既に存在する場合は、コンポーネントとガードを確認してください。

---

## 7. テスト観点

Phase3-3完了判定のためのテスト観点チェックリスト：

### 7.1 基本機能のテスト

- [ ] **従業員本人が変更申請を登録できる**
  - テスト手順:
    1. employeeロールでログイン
    2. マイページの「変更申請履歴」セクションから「変更申請を行う」ボタンをクリック
    3. 変更項目（住所・電話番号・メールアドレス）を選択
    4. 申請する値を入力して申請
    5. 申請が正常に登録されることを確認

- [ ] **管理者・担当者が申請一覧を閲覧できる**
  - テスト手順:
    1. adminまたはhrロールでログイン
    2. 申請一覧画面（`/requests`）を開く
    3. 申請一覧が表示されることを確認
    4. ステータスフィルタが動作することを確認

- [ ] **管理者・担当者が申請を承認できる**
  - テスト手順:
    1. adminまたはhrロールでログイン
    2. 申請一覧画面で「承認待ち」の申請を選択
    3. 「承認」ボタンをクリック
    4. 申請ステータスが「承認済み」になることを確認
    5. 従業員台帳の該当項目が更新されていることを確認

- [ ] **管理者・担当者が申請を却下できる**
  - テスト手順:
    1. adminまたはhrロールでログイン
    2. 申請一覧画面で「承認待ち」の申請を選択
    3. 「却下」ボタンをクリック
    4. 却下理由を入力して却下
    5. 申請ステータスが「却下済み」になることを確認
    6. 却下理由が保存されていることを確認

- [ ] **従業員本人がマイページで申請履歴と却下理由を確認できる**
  - テスト手順:
    1. employeeロールでログイン
    2. マイページの「変更申請履歴」セクションを確認
    3. 自分の申請履歴が表示されることを確認
    4. 却下済みの申請について、却下理由（`rejectReason`）が表示されることを確認

### 7.2 セキュリティのテスト

- [ ] **従業員本人は自分の申請のみ閲覧可能**
  - テスト手順:
    1. employeeロールでログイン
    2. マイページの「変更申請履歴」セクションを確認
    3. 自分の申請のみが表示されることを確認（`listForUser()`を使用）
    4. 他の従業員の申請が表示されないことを確認
    5. ブラウザの開発者ツールでネットワークエラーが発生していないことを確認

- [ ] **employeeロールは申請一覧画面（`/requests`）にアクセスできない**
  - テスト手順:
    1. employeeロールでログイン
    2. `/requests`に直接アクセスしようとする
    3. アクセスが拒否されるか、適切なページにリダイレクトされることを確認

- [ ] **管理者・担当者は全申請を閲覧可能**
  - テスト手順:
    1. adminまたはhrロールでログイン
    2. 申請一覧画面を開く
    3. 全従業員の申請が表示されることを確認

- [ ] **従業員本人は申請の承認・却下ができない**
  - テスト手順:
    1. employeeロールでログイン
    2. マイページの「変更申請履歴」セクションを確認
    3. 「承認」「却下」ボタンが表示されないことを確認

### 7.3 データ整合性のテスト

- [ ] **承認時に従業員台帳が正しく更新される**
  - テスト手順:
    1. 申請を承認
    2. 従業員詳細画面で該当項目が更新されていることを確認
    3. 最終更新者・最終更新日時が正しく記録されていることを確認

- [ ] **却下時に従業員台帳が更新されない**
  - テスト手順:
    1. 申請を却下
    2. 従業員詳細画面で該当項目が変更されていないことを確認

- [ ] **承認・却下後に申請一覧が自動更新される（リアルタイム購読）**
  - テスト手順:
    1. 申請一覧画面を開く
    2. 申請を承認または却下
    3. 一覧が自動的に更新されることを確認（手動リロード不要）

### 7.4 既存機能への影響のテスト

- [ ] **従業員台帳の登録・編集・削除が正常に動作する**
  - テスト手順:
    1. 従業員の追加・編集・削除を実行
    2. 各操作が正常に完了することを確認

- [ ] **マイページが正常に動作する**
  - テスト手順:
    1. マイページを開く
    2. 従業員情報が正しく表示されることを確認
    3. 「変更申請履歴」セクションが表示されることを確認

---

## 8. 注意事項・今後の拡張余地

### 8.1 既存機能を壊さないための注意点

- **従業員情報の更新**: `EmployeesService.save()`を使用して従業員情報を更新する際、`updatedByUserId`を設定することで、最終更新者情報が正しく記録されます
- **セキュリティルール**: `changeRequests`コレクションのルールを追加する際、既存のルールを壊さないように注意してください
- **ルーティング**: `/requests`のルーティングが既に存在する場合は、コンポーネントとガードを確認してください
- **承認時の順序**: 研修アプリの範囲では「従業員更新 → 申請ステータス更新」の順序で許容しますが、本番システムならトランザクションを検討してください

### 8.2 パフォーマンスに関する注意点

- **申請一覧の取得**: `list()`と`listForUser()`はリアルタイム購読パターン（`collectionData`）を使用するため、承認・却下後に一覧が自動更新されます
- **employeeロールの申請取得**: employeeロールは`listForUser()`を使用してクエリで`requestedByUserId`を絞り込む必要があります。全件クエリ（`list()`）を実行するとFirestoreのセキュリティルールで権限エラーになります
- **従業員情報の取得**: 承認時に従業員情報を取得する際、単一取得メソッド（`get()`）を使用することで、パフォーマンスを向上させることができます。`get()`がない場合は追加することを推奨します
- **申請一覧のフィルタリング**: 申請数が増えた場合、ページネーションを実装することで、パフォーマンスを向上させることができます

### 8.3 今後の拡張余地

- **通知機能**: 承認・却下時に申請者に通知を送信する機能を追加することができます
- **申請履歴の拡張**: 従業員ごとの申請履歴をより詳細に表示する機能を追加することができます
- **一括承認**: 複数の申請を一度に承認する機能を追加することができます
- **申請の編集**: 申請待ちの申請を編集・削除する機能を追加することができます
- **申請の取り消し**: 申請者が申請を取り消す機能を追加することができます
- **代理登録**: 管理者・担当者が従業員に代わって申請を登録する機能を追加することができます（この場合、セキュリティルールの`create`ルールを修正する必要があります）

### 8.4 Phase3-3の範囲外

- **多段階承認**: 1段階承認の簡易機能のみを実装し、多段階承認は対象外とします
- **申請対象項目の拡張**: 今回は住所・電話番号・メールアドレスの3項目のみを対象とし、`field`の`'other'`は使用しません（将来拡張用）
- **通知機能**: 承認・却下時の通知機能は対象外とします（将来的に追加可能）
- **トランザクション**: 承認時の「従業員更新 → 申請ステータス更新」はトランザクションを使用しません（研修アプリの範囲では許容）

---

## 9. 実装完了の判定基準

以下の条件をすべて満たした場合、Phase3-3は完了とみなします：

1. ✅ `src/app/services/change-requests.service.ts`が存在し、CRUD操作（`create()`, `list()`, `listForUser()`, `approve()`, `reject()`）が実装されている
2. ✅ `list()`と`listForUser()`はリアルタイム購読パターン（`collectionData`）を使用している
3. ✅ `create()`の型定義が正しく、`officeId`が重複しない
4. ✅ `src/app/pages/requests/change-request-form-dialog.component.ts`が存在し、従業員本人が申請を登録できる
5. ✅ `field`の選択肢は「住所」「電話番号」「メールアドレス」のみ（`'other'`は含めない）
6. ✅ `src/app/pages/requests/requests.page.ts`が実装され、管理者・担当者が申請一覧を閲覧・承認・却下できる
7. ✅ `/requests`はadmin/hr専用（employeeロールはアクセス不可）
8. ✅ マイページに「変更申請履歴」セクションが追加され、employeeロールが`listForUser()`を使用して自分の申請履歴と却下理由を確認できる
9. ✅ 承認時に従業員台帳が自動更新される
10. ✅ 却下時に却下理由が保存される
11. ✅ `firestore.rules`に`changeRequests`コレクションのセキュリティルールが追加されている（`match /offices/{officeId}`ブロック内）
12. ✅ `create`ルールは従業員本人のみ作成可能（`employeeId == currentUser().data.employeeId`を要求）
13. ✅ 既存の機能（従業員台帳の登録・編集・削除など）が正常に動作する
14. ✅ テスト観点のチェックリストの主要項目（7.1〜7.3）がすべてクリアされている

---

以上でPhase3-3の実装指示書は完了です。実装時は、この指示書に従って段階的に実装を進めてください。
