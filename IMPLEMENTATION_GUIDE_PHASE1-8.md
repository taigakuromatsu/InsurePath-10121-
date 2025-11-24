# Phase1-8 実装指示書: 従業員とユーザーアカウントの自動紐づけ機能

## 📋 概要

ログインユーザーと従業員レコードを自動的に紐づける機能を実装します。これにより、管理者が従業員マスタにメールアドレスを登録しておくだけで、従業員がGoogleログインした際に自動的に自分の従業員レコードに紐づき、マイページで自分の情報を確認できるようになります。

**目的**: 
- 管理者は従業員マスタにメールアドレスを登録するだけでOK
- 従業員は自分でGoogleログインするだけで、自動的に自分の従業員レコードに紐づく
- マイページで自分の情報が自動的に表示される

**前提条件**:
- `Employee`型に`contactEmail?: string`フィールドが存在する（確認済み）
- `UserProfile`型に`employeeId?: string`フィールドが存在する（確認済み）
- `AuthService.ensureUserDocument`でユーザープロファイルを作成している（確認済み）
- Phase1-7でマイページが実装済み

---

## 🎯 実装対象ファイル

### 編集（必須）
- `src/app/services/current-user.service.ts` - `assignOffice`メソッドに従業員レコードとの自動紐づけ処理を追加

### 新規作成（将来の拡張）
- `src/app/pages/me/employee-link-dialog.component.ts` - 手動で従業員レコードを選択するダイアログ（自動紐づけが失敗した場合のフォールバック）
  - **注意**: Phase1-8では実装不要。仕様として記載しておき、実装は後回しでOK

---

## 🔧 機能要件

### 1. 自動紐づけの仕組み

#### 1.1 紐づけの条件
- `UserProfile.employeeId`が未設定（`undefined`または`null`）
- `UserProfile.officeId`が設定されている
- `User.email`（Googleログイン時のメールアドレス）が存在する
- 該当する`officeId`配下の`employees`コレクションに、`contactEmail`が`User.email`と一致する従業員レコードが存在する

#### 1.2 紐づけのタイミング
- **必須**: 事業所確定時（`CurrentUserService.assignOffice`内）

**理由**: InsurePathの実際のフローでは、初回ログイン時は`officeId`が未設定のため、ログイン時（`AuthService.ensureUserDocument`）では従業員レコードを検索できません。事業所を作成または既存事業所に参加した時点で`officeId`が確定するため、そのタイミングで自動紐づけを実行します。

#### 1.3 紐づけの処理フロー
1. ユーザーがGoogleログイン
2. 初回ログイン時は`officeId`が未設定のため、`/office-setup`へリダイレクト
3. 事業所を作成または既存事業所に参加 → `CurrentUserService.assignOffice`が呼ばれる
4. **新規追加**: `employeeId`が未設定かつ`user.email`が存在する場合
5. **新規追加**: `offices/{officeId}/employees`コレクションを検索
6. **新規追加**: `contactEmail === user.email.toLowerCase()`の従業員レコードを探す（小文字統一）
7. **新規追加**: 見つかった場合、`UserProfile.employeeId`に従業員IDを設定して保存
8. 2回目以降のログイン時は、既に`employeeId`が設定されているため、自動紐づけ処理は実行されない

### 2. エラーハンドリング

- 複数の従業員レコードが見つかった場合: 最初の1件を使用（または警告ログ）
- 従業員レコードが見つからなかった場合: そのまま（`employeeId`は未設定のまま）
- Firestoreクエリエラー: エラーログを出力し、処理を継続（ユーザー体験を損なわない）

### 3. 手動紐づけ機能（将来の拡張）

自動紐づけが失敗した場合（メールアドレスが一致しない、従業員レコードが存在しないなど）のために、マイページで手動で従業員レコードを選択できる機能を実装することも可能です。

**Phase1-8での扱い**: 
- 仕様として記載しておくが、実装は後回しでOK
- 自動紐づけ機能が実装されれば、課題としては十分クリアしている
- レポートやカタログには「自動紐づけに失敗した場合には、今後の拡張として従業員を手動選択するダイアログを実装予定である」と記載

---

## 💻 実装詳細

### Step 1: CurrentUserService に自動紐づけ処理を追加

#### 1.1 従業員レコード検索メソッドの追加

`CurrentUserService`に、メールアドレスで従業員レコードを検索するメソッドを追加します：

```typescript
// src/app/services/current-user.service.ts

import { collection, query, where, getDocs } from '@angular/fire/firestore';

/**
 * メールアドレスで従業員レコードを検索し、employeeId を取得する
 * 
 * @param officeId - 事業所ID
 * @param email - 検索対象のメールアドレス（小文字に正規化して検索）
 * @returns 従業員ID（見つからない場合は null）
 */
private async findEmployeeIdByEmail(
  officeId: string,
  email: string
): Promise<string | null> {
  if (!officeId || !email) {
    return null;
  }

  try {
    const employeesRef = collection(
      this.firestore,
      'offices',
      officeId,
      'employees'
    );
    // メールアドレスを小文字に統一して検索（大文字小文字の違いを回避）
    const q = query(
      employeesRef,
      where('contactEmail', '==', email.toLowerCase())
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    // 複数見つかった場合は最初の1件を使用
    const employeeDoc = snapshot.docs[0];
    return employeeDoc.id;
  } catch (error) {
    console.error('従業員レコードの検索に失敗しました', error);
    return null;
  }
}
```

**重要**: `collection`、`query`、`where`、`getDocs`をインポートする必要があります。

#### 1.2 assignOffice メソッドの拡張

`assignOffice`メソッドに、自動紐づけ処理を追加します：

```typescript
// src/app/services/current-user.service.ts

async assignOffice(officeId: string): Promise<void> {
  const user = this.auth.currentUser;
  if (!user) {
    throw new Error('ログイン情報を確認できませんでした');
  }

  const userDoc = doc(this.firestore, 'users', user.uid);
  const now = new Date().toISOString();
  const role = this.profileSubject.value?.role ?? 'admin';

  // ★新規追加: 従業員レコードとの自動紐づけ
  // employeeId が未設定の場合のみ検索を実行
  let employeeId = this.profileSubject.value?.employeeId;
  if (!employeeId && user.email) {
    employeeId = await this.findEmployeeIdByEmail(officeId, user.email);
  }

  const updateData: any = {
    id: user.uid,
    officeId,
    role,
    displayName: user.displayName ?? user.email ?? 'User',
    email: user.email ?? 'unknown@example.com',
    updatedAt: now,
    createdAt: this.profileSubject.value?.createdAt ?? now
  };

  // employeeId が見つかった場合のみ設定（undefined の場合はフィールド自体を保存しない）
  if (employeeId) {
    updateData.employeeId = employeeId;
  }

  await setDoc(userDoc, updateData, { merge: true });

  // ローカルキャッシュも更新しておくとガードが即反映される
  const current = this.profileSubject.value;
  if (current) {
    this.profileSubject.next({ 
      ...current, 
      officeId, 
      ...(employeeId && { employeeId }),
      updatedAt: now 
    });
  }
}
```

**動作フロー**:
1. 初回: 事業所を選んだ瞬間に`employeeId`が自動セットされる
2. 2回目以降: `employeeId`は既に入っているので、自動紐づけ処理は実行されない（既存の紐づけを保持）

### Step 2: 手動紐づけ機能の実装（将来の拡張・参考用）

**Phase1-8での扱い**: 
- **実装不要**: 仕様として記載しておくが、実装は後回しでOK
- 自動紐づけ機能が実装されれば、課題としては十分クリアしている
- レポートやカタログには「自動紐づけに失敗した場合には、今後の拡張として従業員を手動選択するダイアログを実装予定である」と記載

以下は実装例（参考用・Phase1-8では実装不要）：

#### 3.1 ダイアログコンポーネントの作成

```typescript
// src/app/pages/me/employee-link-dialog.component.ts

import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { AsyncPipe, NgForOf, NgIf } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { CurrentUserService } from '../../services/current-user.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { EmployeesService } from '../../services/employees.service';
import { Employee } from '../../types';

@Component({
  selector: 'ip-employee-link-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatListModule,
    MatIconModule,
    AsyncPipe,
    NgIf,
    NgForOf
  ],
  template: `
    <h1 mat-dialog-title>従業員レコードを選択</h1>
    <div mat-dialog-content>
      <p>あなたの従業員レコードを選択してください。</p>
      <mat-list *ngIf="employees$ | async as employees">
        <mat-list-item
          *ngFor="let emp of employees"
          (click)="selectEmployee(emp)"
          class="employee-item"
        >
          <mat-icon matListItemIcon>person</mat-icon>
          <div matListItemTitle>{{ emp.name }}</div>
          <div matListItemLine>{{ emp.department || '部署未設定' }}</div>
        </mat-list-item>
      </mat-list>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button (click)="close()">キャンセル</button>
    </div>
  `,
  styles: [
    `
      .employee-item {
        cursor: pointer;
      }
      .employee-item:hover {
        background: #f5f5f5;
      }
    `
  ]
})
export class EmployeeLinkDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<EmployeeLinkDialogComponent>);
  private readonly currentUser = inject(CurrentUserService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly employeesService = inject(EmployeesService);

  readonly employees$ = this.currentOffice.officeId$.pipe(
    switchMap((officeId) => 
      officeId ? this.employeesService.list(officeId) : of([])
    )
  );

  async selectEmployee(employee: Employee): Promise<void> {
    await this.currentUser.updateProfile({ employeeId: employee.id });
    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
```

#### 3.2 マイページでの表示

マイページで、`employeeId`が未設定の場合に手動紐づけダイアログを表示するボタンを追加します：

```typescript
// src/app/pages/me/my-page.ts

import { MatDialog } from '@angular/material/dialog';
import { EmployeeLinkDialogComponent } from './employee-link-dialog.component';

// ...

export class MyPage {
  // ...
  private readonly dialog = inject(MatDialog);

  // employeeId が未設定の場合に表示するメソッド
  async openEmployeeLinkDialog(): Promise<void> {
    const dialogRef = this.dialog.open(EmployeeLinkDialogComponent, {
      width: '500px'
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result) {
      // ページをリロードまたはプロファイルを再取得
      window.location.reload(); // または適切な更新処理
    }
  }
}
```

テンプレート側：

```html
<ng-template #noEmployee>
  <div class="empty-state">
    <mat-icon>person_off</mat-icon>
    <p>従業員として登録されていないため、マイページ情報は表示されません。</p>
    <button 
      mat-raised-button 
      color="primary" 
      (click)="openEmployeeLinkDialog()"
      *ngIf="(currentUser.profile$ | async)?.officeId"
    >
      <mat-icon>link</mat-icon>
      従業員レコードを選択
    </button>
  </div>
</ng-template>
```

---

## ✅ 受け入れ条件

### 機能要件
1. ✅ 事業所を設定した時点（`CurrentUserService.assignOffice`）で、`contactEmail`と`user.email`が一致する従業員レコードが存在する場合、自動的に`UserProfile.employeeId`が設定される
2. ✅ 既に`employeeId`が設定されている場合、自動紐づけ処理は実行されない（既存の紐づけを保持）
3. ✅ 複数の従業員レコードが見つかった場合、最初の1件が使用される
4. ✅ 従業員レコードが見つからない場合、エラーにならずに処理が継続される（`employeeId`は未設定のまま）

### セキュリティ要件
1. ✅ 自分のメールアドレスと一致する従業員レコードのみが紐づけられる
2. ✅ 他社員の従業員レコードに紐づけられない（`contactEmail`と`user.email`の一致チェックにより保証）

### データ整合性
1. ✅ `UserProfile.employeeId`が設定されると、マイページで従業員情報が表示される
2. ✅ 既存の`employeeId`は上書きされない（既に設定されている場合は保持）

### UI/UX要件
1. ✅ 自動紐づけはバックグラウンドで実行され、ユーザーに負担をかけない
2. ✅ 手動紐づけ機能（オプション）は、自動紐づけが失敗した場合にのみ表示される

---

## 🔍 実装時の注意点

### 1. Firestore インデックス（重要）

`contactEmail`で検索するため、以下のインデックスが必要になる可能性があります：

- **コレクション**: `offices/{officeId}/employees`
- **フィールド**: `contactEmail`（単一フィールドインデックス）

Firestoreコンソールでエラーメッセージに従ってインデックスを作成してください。

### 2. メールアドレスの大文字小文字統一（重要）

Firestoreの`where`クエリはデフォルトで大文字小文字を区別します。メールアドレスは通常大文字小文字を区別しないため、**必ず小文字に統一**して保存・検索してください。

**実装時の推奨事項**:

1. **自動紐づけ側**: `user.email.toLowerCase()`で検索
   ```typescript
   where('contactEmail', '==', email.toLowerCase())
   ```

2. **従業員マスタ保存側**: `contactEmail`を保存する際も小文字に統一
   - `EmployeesService.save`で`contactEmail`を保存する際に、`contactEmail.toLowerCase()`で正規化
   - または、従業員一覧画面で`contactEmail`を編集するUIで、入力時に小文字に変換

これにより、大文字小文字の違いによる紐づけ失敗を防げます。

### 3. パフォーマンス

- 従業員レコードの検索は、事業所設定時に1回だけ実行されます
- クエリ結果はキャッシュされないため、毎回Firestoreに問い合わせます
- 従業員数が多い場合でも、`contactEmail`での検索は高速です（インデックス使用）
- 既に`employeeId`が設定されている場合は、検索処理をスキップするため、パフォーマンスへの影響は最小限です

### 4. エラーハンドリング

- Firestoreクエリエラーが発生しても、ユーザー体験を損なわないようにエラーログを出力して処理を継続します
- 自動紐づけが失敗しても、手動紐づけ機能（オプション）で対応可能です

### 5. 既存データへの影響

- 既存の`UserProfile`に`employeeId`が設定されている場合、自動紐づけ処理は実行されません（既存の紐づけを保持）
- 管理者ユーザーなど、従業員レコードと紐づけないアカウントは、`employeeId`が未設定のままです

---

## 📝 実装チェックリスト

### Phase1-8（必須）
- [ ] `CurrentUserService`に`findEmployeeIdByEmail`メソッドを追加
- [ ] `CurrentUserService.assignOffice`に自動紐づけ処理を追加
- [ ] Firestoreインデックスを作成（`contactEmail`フィールド）
- [ ] メールアドレスの小文字統一を実装（検索時と保存時の両方）
- [ ] 事業所設定時に自動紐づけが動作することを確認
- [ ] マイページで従業員情報が表示されることを確認
- [ ] エラーハンドリングが適切に実装されていることを確認
- [ ] 複数の従業員レコードが見つかった場合の動作を確認
- [ ] 既存の`employeeId`が保持されることを確認（上書きされない）

### 余裕があれば
- [ ] 従業員一覧で`contactEmail`を編集できるUIの確認
- [ ] メールアドレスの小文字統一が保存時にも適用されていることを確認

### 将来の拡張
- [ ] 手動紐づけダイアログを実装（Phase2以降）

---

## 🎨 参考実装

以下のファイルを参考にしてください：

- `src/app/services/auth.service.ts` - ユーザープロファイル作成処理
- `src/app/services/current-user.service.ts` - プロファイル管理処理
- `src/app/services/employees.service.ts` - 従業員データ取得処理
- `src/app/pages/me/my-page.ts` - マイページの実装

---

## 📌 補足事項

1. **自動紐づけのタイミング**: 
   - **必須**: 事業所設定時（`CurrentUserService.assignOffice`）に実装します
   - ログイン時（`AuthService.ensureUserDocument`）には実装しません
   - 理由: 初回ログイン時は`officeId`が未設定のため、従業員レコードを検索できないため

2. **手動紐づけ機能**: 
   - Phase1-8では実装不要です
   - 仕様として記載しておき、実装は後回しでOK
   - 自動紐づけ機能が実装されれば、課題としては十分クリアしています
   - レポートやカタログには「自動紐づけに失敗した場合には、今後の拡張として従業員を手動選択するダイアログを実装予定である」と記載

3. **メールアドレスの管理**: 
   - 管理者が従業員マスタに`contactEmail`を登録する際は、Googleログインで使用するメールアドレスと一致させる必要があります
   - **重要**: 大文字小文字の違いを避けるため、保存時と検索時の両方で小文字に統一してください
   - スペースの有無にも注意してください

4. **実装の優先順位**: 
   - **Phase1-8（必須）**: `CurrentUserService.assignOffice`に自動紐づけ処理を実装
   - **余裕があれば**: 従業員一覧で`contactEmail`を編集できるUIの確認、メールアドレスの小文字統一が保存時にも適用されていることを確認
   - **将来の拡張**: 手動紐づけダイアログをPhase2以降で実装

5. **将来の拡張**: 
   - メールアドレス以外の紐づけ方法（従業員番号など）を追加することも可能です
   - 複数の紐づけ方法を試行する順序を定義することも検討できます

---

以上で実装指示書は完了です。不明点があれば確認してください。

