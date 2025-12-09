# Phase3 実装指示書：事業所参加フロー見直し & Email/Password 認証追加

**ファイル名**: `AUTHENTICATION_PHASE3.md`  
**作成日**: 2024年  
**対象**: InsurePath（社会保険管理システム）  
**前提**: Phase1・Phase2 は実装済み

---

## 1. 概要

### 1.1 Phase3 の目的

Phase3 では、セキュリティ強化と認証手段の拡充を目的として、以下を実装する：

1. **事業所参加フローの見直し**
   - 既存事業所一覧からの自由参加を廃止し、招待リンク経由のみに統一
   - セキュリティリスク（知らない人が事業所に参加する）を低減

2. **Email/Password 認証の追加**
   - Google ログインに加えて、Email/Password 認証を追加
   - 従業員招待フローとの整合性を保ちながら、認証手段を拡充

### 1.2 実装スコープ

#### 今回実装する内容

- ✅ Phase3-1: 事業所参加フローの見直し
  - `/office-setup` ページから既存事業所一覧選択機能を削除
  - 招待リンク経由の参加を推奨する説明文を追加
  - 新規事業所作成機能は維持

- ✅ Phase3-2: Email/Password 認証の追加
  - Firebase Auth の Email/Password プロバイダを有効化
  - ログイン画面に Email/Password フォームを追加（ログイン専用）
  - 将来の新規登録フロー向けに `signUpWithEmailAndPassword` メソッドのみ用意（UIは今回実装しない）
  - 既存の Google ログインは維持

#### 今回は実装しない内容

- ❌ 複数事業所対応（`officeMemberships` モデル）→ Phase4 で実装予定
- ❌ メール送信機能（招待リンクの自動送信）→ Phase3 以降で実装予定
- ❌ パスワードリセット機能 → 将来拡張
- ❌ メール認証（Email Verification）→ 将来拡張

---

## 2. 現状の確認

### 2.1 `/office-setup` ページの現状

**ファイル**: `src/app/pages/office-setup/office-setup.page.ts`

**現状の機能**:
- ✅ 既存事業所一覧からの選択機能（46-71行目）
  - `offices$` で全事業所を取得
  - `mat-select` で事業所を選択
  - `joinExistingOffice()` で選択した事業所に参加
- ✅ 新規事業所作成機能（73-110行目）
  - 事業所名・所在地・健康保険プランを入力
  - `createOffice()` で新規事業所を作成し、`admin` ロールで紐づけ

**問題点**:
- 既存事業所一覧から誰でも自由に参加できてしまう（セキュリティリスク）
- 招待リンク経由の参加方法が明示されていない

### 2.2 `/login` ページの現状

**ファイル**: `src/app/pages/login/login.page.ts`

**現状の機能**:
- ✅ Google ログインのみ（36-40行目）
- ✅ `mode=employee` クエリパラメータによる文言切り替え（165-180行目）
- ✅ ログイン後のリダイレクト処理（`redirect` クエリパラメータ対応）

**問題点**:
- Email/Password 認証が未実装
- 新規登録フローがない

### 2.3 `AuthService` の現状

**ファイル**: `src/app/services/auth.service.ts`

**現状の機能**:
- ✅ `signInWithGoogle()` メソッド（23-27行目）
- ✅ `ensureUserDocument()` メソッド（33-71行目）
  - ユーザードキュメントの作成・更新
  - `officeId` が未設定の場合は `employee` ロールで作成

**問題点**:
- Email/Password 認証のメソッドが未実装
- 新規登録用のメソッドが未実装

---

## 3. 仕様詳細（UX 観点）

### 3.1 `/office-setup` ページの最終仕様

#### 画面構成

```
┌─────────────────────────────────────────┐
│  所属する事業所を設定してください        │
│  初めて InsurePath を使う場合は、       │
│  新規事業所を作成してください。         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  📧 既存の事業所に参加する              │
│                                         │
│  既存の事業所に参加するには、           │
│  管理者から送られた招待リンクを         │
│  利用してください。                     │
│                                         │
│  招待リンクをお持ちの場合は、          │
│  そのリンクを開いてログインしてください。│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  ➕ 新規事業所を作成                    │
│                                         │
│  [事業所名入力]                         │
│  [所在地入力]                           │
│  [健康保険プラン選択]                   │
│  [事業所を作成 ボタン]                  │
└─────────────────────────────────────────┘
```

#### 変更点

1. **既存事業所一覧選択機能を削除**
   - `mat-select` と「この事業所を選択」ボタンを削除
   - `joinExistingOffice()` メソッドを削除
   - `offices$` の取得処理を削除

2. **説明文を追加**
   - 「既存の事業所に参加する」カードに説明文を追加
   - 招待リンク経由の参加を推奨する文言を表示

3. **新規事業所作成機能は維持**
   - 既存のフォームと `createOffice()` メソッドはそのまま維持

### 3.2 `/login` ページの最終仕様

#### 画面構成（通常モード）

```
┌─────────────────────────────────────────┐
│  🔒 InsurePath へログイン              │
│  Google アカウントでログインして        │
│  従業員台帳を管理しましょう。           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [Google でログイン ボタン]            │
│                                         │
│  ───────── または ─────────            │
│                                         │
│  [メールアドレス入力]                   │
│  [パスワード入力]                       │
│  [ログイン ボタン]                      │
│                                         │
│  アカウントをお持ちでない場合は         │
│  招待リンクから新規登録できます。       │
└─────────────────────────────────────────┘
```

#### 画面構成（従業員モード: `mode=employee`）

```
┌─────────────────────────────────────────┐
│  🔒 InsurePath 従業員用ログイン         │
│  あなたの社会保険情報を確認するための   │
│  従業員専用ページです。                 │
│  管理者・人事担当の方は、管理者画面用の │
│  ログインからお入りください。          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [Google でログイン ボタン]            │
│                                         │
│  ───────── または ─────────            │
│                                         │
│  [メールアドレス入力]                   │
│  [パスワード入力]                       │
│  [ログイン ボタン]                      │
│                                         │
│  招待リンクから来た場合は、             │
│  そのリンクを開いてログインしてください。│
└─────────────────────────────────────────┘
```

#### 変更点

1. **Email/Password フォームを追加**
   - メールアドレス入力フィールド
   - パスワード入力フィールド
   - ログインボタン
   - エラーメッセージ表示エリア

2. **新規登録フローは追加しない**
   - 新規登録は招待リンク経由の利用を前提とする
   - 招待リンクから来たユーザーが初回ログイン（例: Googleログイン）したタイミングで、Firestore 上のユーザードキュメントが自動的に作成・更新される（`ensureUserDocument`）

3. **Google ログインは維持**
   - 既存の「Google でログイン」ボタンはそのまま維持

### 3.3 利用シナリオ

#### シナリオ1: 新規管理者が事業所を作成

1. 初回ログイン（Google または Email/Password）
2. `officeId` が未設定のため `/office-setup` にリダイレクト
3. 「新規事業所を作成」カードで事業所情報を入力
4. 「事業所を作成」ボタンをクリック
5. 事業所が作成され、`admin` ロールで紐づけられる
6. `/offices` にリダイレクト

#### シナリオ2: 従業員が招待リンクから参加

1. 管理者が従業員台帳から「招待」ボタンをクリック
2. 招待リンクが生成され、従業員に共有される
3. 従業員が招待リンクを開く → `/employee-portal/accept-invite?token=xxx`
4. 未ログインの場合は `/login?mode=employee&redirect=...` にリダイレクト
5. Google または Email/Password でログイン
6. ログイン後、`accept-invite` ページでトークン検証
7. `users/{uid}` と `employees/{employeeId}` が紐づけられる
8. `/me` にリダイレクト

#### シナリオ3: 既存ユーザーが Email/Password でログイン

1. `/login` にアクセス
2. メールアドレスとパスワードを入力
3. 「ログイン」ボタンをクリック
4. 認証成功後、`redirect` クエリパラメータがあればそこへ、なければ `/dashboard` へリダイレクト

---

## 4. 実装手順（ファイル単位）

### 4.1 Phase3-1: 事業所参加フローの見直し

#### 4.1.1 `src/app/pages/office-setup/office-setup.page.ts`

**現状の役割**:
- 既存事業所一覧からの選択機能
- 新規事業所作成機能

**今回追加・変更する責務**:
- 既存事業所一覧選択機能を削除
- 招待リンク経由の参加を推奨する説明文を追加
- 新規事業所作成機能は維持

**大まかなコード方針**:

```typescript
// 削除するコード
- readonly offices$: Observable<Office[]> = this.officesService.listOffices();
- readonly existingOfficeControl = this.fb.control<string | null>(null);
- joinDisabled = signal(true);
- constructor() 内の existingOfficeControl.valueChanges の購読
- joinExistingOffice() メソッド全体

// テンプレートの変更
- 「既存の事業所に参加」カードの mat-select とボタンを削除
- 代わりに説明文を追加：
  <mat-card class="content-card setup-card">
    <div class="card-header flex-row align-center gap-2 mb-3">
      <mat-icon color="primary">group_add</mat-icon>
      <h2 class="mat-h2 mb-0">既存の事業所に参加</h2>
    </div>
    <div class="card-content">
      <p class="info-text">
        既存の事業所に参加するには、管理者から送られた招待リンクを利用してください。
      </p>
      <p class="info-text">
        招待リンクをお持ちの場合は、そのリンクを開いてログインしてください。
      </p>
    </div>
  </mat-card>
```

**具体的な変更内容**:

1. **インポートの削除**
   - `OfficesService` のインポートは削除しない（新規事業所作成で使用）
   - `NgFor`, `AsyncPipe` のインポートは削除可能

2. **プロパティの削除**
   ```typescript
   // 削除
   readonly offices$: Observable<Office[]> = this.officesService.listOffices();
   readonly existingOfficeControl = this.fb.control<string | null>(null);
   readonly joinDisabled = signal(true);
   ```

3. **コンストラクタの変更**
   ```typescript
   constructor() {
     // existingOfficeControl.valueChanges の購読を削除
   }
   ```

4. **メソッドの削除**
   ```typescript
   // joinExistingOffice() メソッド全体を削除
   ```

5. **テンプレートの変更**
   - 46-71行目の「既存の事業所に参加」カードを以下のように置き換え：
   ```html
   <mat-card class="content-card setup-card">
     <div class="card-header flex-row align-center gap-2 mb-3">
       <mat-icon color="primary">group_add</mat-icon>
       <h2 class="mat-h2 mb-0">既存の事業所に参加</h2>
     </div>
     <div class="card-content">
       <p class="info-text">
         既存の事業所に参加するには、管理者から送られた招待リンクを利用してください。
       </p>
       <p class="info-text">
         招待リンクをお持ちの場合は、そのリンクを開いてログインしてください。
       </p>
     </div>
   </mat-card>
   ```

6. **スタイルの追加**
   ```scss
   .info-text {
     margin: 0 0 12px 0;
     color: #666;
     font-size: 0.95rem;
     line-height: 1.6;
   }
   ```

7. **ヘッダーの文言変更**
   ```html
   <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">
     初めて InsurePath を使う場合は、新規事業所を作成してください。
   </p>
   ```

#### 4.1.2 `src/app/pages/office-setup/office-setup.page.ts`（スタイル）

**変更内容**:
- `.info-text` クラスのスタイルを追加

---

### 4.2 Phase3-2: Email/Password 認証の追加

#### 4.2.1 `src/app/services/auth.service.ts`

**現状の役割**:
- Google ログイン
- ユーザードキュメントの作成・更新

**今回追加・変更する責務**:
- Email/Password ログインメソッドの追加
- Email/Password 新規登録メソッドの追加
- エラーハンドリングの統一

**大まかなコード方針**:

```typescript
// 追加するインポート
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  UserCredential
} from '@angular/fire/auth';

// 追加するメソッド
async signInWithEmailAndPassword(email: string, password: string): Promise<void> {
  const credential = await signInWithEmailAndPassword(this.auth, email, password);
  await this.ensureUserDocument(credential.user);
}

async signUpWithEmailAndPassword(
  email: string,
  password: string,
  displayName?: string
): Promise<void> {
  const credential = await createUserWithEmailAndPassword(this.auth, email, password);
  // displayName の更新は Firebase Auth の updateProfile を使用
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  await this.ensureUserDocument(credential.user);
}
```

**具体的な変更内容**:

1. **インポートの追加**
   ```typescript
   import {
     Auth,
     GoogleAuthProvider,
     User,
     authState,
     signInWithPopup,
     signOut,
     createUserWithEmailAndPassword,
     signInWithEmailAndPassword,
     updateProfile
   } from '@angular/fire/auth';
   ```
   
   **注意**: `signInWithEmailAndPassword` は関数名とクラスメソッド名が同じだが、使用時に区別される
   - クラスメソッド: `this.signInWithEmailAndPassword(email, password)`
   - import した関数: `signInWithEmailAndPassword(this.auth, email, password)`

2. **メソッドの追加**
   ```typescript
   /**
    * Email/Password でログイン
    */
   async signInWithEmailAndPassword(email: string, password: string): Promise<void> {
     const credential = await signInWithEmailAndPassword(this.auth, email, password);
     await this.ensureUserDocument(credential.user);
   }

   /**
    * Email/Password で新規登録するための共通メソッド
    * 将来、招待リンク経由の初回登録フローなどで使用する想定（今回のフェーズではUIからは呼ばない）
    */
   async signUpWithEmailAndPassword(
     email: string,
     password: string,
     displayName?: string
   ): Promise<void> {
     const credential = await createUserWithEmailAndPassword(this.auth, email, password);
     
     // displayName が指定されている場合は更新
     if (displayName) {
       await updateProfile(credential.user, { displayName });
     }
     
     await this.ensureUserDocument(credential.user);
   }
   ```

3. **エラーハンドリング**
   - エラーハンドリングは呼び出し側（`login.page.ts`）で行う
   - `AuthService` ではエラーをそのまま throw する

#### 4.2.2 `src/app/pages/login/login.page.ts`

**現状の役割**:
- Google ログイン
- `mode=employee` による文言切り替え
- ログイン後のリダイレクト処理

**今回追加・変更する責務**:
- Email/Password フォームの追加
- Email/Password ログイン処理の追加
- エラーメッセージの表示
- フォームバリデーション

**大まかなコード方針**:

```typescript
// 追加するインポート
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

// 追加するプロパティ
readonly emailForm: FormGroup;
readonly showEmailForm = signal(false);
readonly emailError = signal<string | null>(null);

// 追加するメソッド
toggleEmailForm(): void { ... }
async signInWithEmail(): Promise<void> { ... }
getErrorMessage(): string | null { ... }
```

**具体的な変更内容**:

1. **インポートの追加**
   ```typescript
   import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
   import { MatFormFieldModule } from '@angular/material/form-field';
   import { MatInputModule } from '@angular/material/input';
   ```

2. **コンポーネントの imports に追加**
   ```typescript
   imports: [
     MatCardModule,
     MatButtonModule,
     MatIconModule,
     MatSnackBarModule,
     MatProgressSpinnerModule,
     MatFormFieldModule,
     MatInputModule,
     ReactiveFormsModule,
     NgIf
   ]
   ```

3. **プロパティの追加**
   ```typescript
   private readonly fb = inject(FormBuilder);
   readonly emailForm: FormGroup;
   readonly showEmailForm = signal(false);
   readonly emailError = signal<string | null>(null);

   constructor() {
     this.emailForm = this.fb.group({
       email: ['', [Validators.required, Validators.email]],
       password: ['', [Validators.required, Validators.minLength(6)]]
     });
   }
   ```

4. **メソッドの追加**
   ```typescript
   toggleEmailForm(): void {
     this.showEmailForm.set(!this.showEmailForm());
     this.emailError.set(null);
   }

   async signInWithEmail(): Promise<void> {
     if (this.emailForm.invalid) {
       this.emailForm.markAllAsTouched();
       return;
     }

     const { email, password } = this.emailForm.value;
     // 型エラーが発生する場合は、以下のようにキャストする
     // const { email, password } = this.emailForm.value as { email: string; password: string };
     try {
       this.loading.set(true);
       this.emailError.set(null);
       await this.auth.signInWithEmailAndPassword(email, password);
       const redirect = this.route.snapshot.queryParamMap.get('redirect');
       await this.router.navigateByUrl(redirect || '/dashboard');
     } catch (error: any) {
       console.error(error);
       this.emailError.set(this.getErrorMessage(error.code));
       this.snackBar.open('ログインに失敗しました。再度お試しください。', '閉じる', {
         duration: 4000
       });
     } finally {
       this.loading.set(false);
     }
   }

   getErrorMessage(errorCode: string): string {
     switch (errorCode) {
       case 'auth/user-not-found':
         return 'このメールアドレスは登録されていません。';
       case 'auth/wrong-password':
         return 'パスワードが正しくありません。';
       case 'auth/invalid-email':
         return 'メールアドレスの形式が正しくありません。';
       case 'auth/user-disabled':
         return 'このアカウントは無効化されています。';
       case 'auth/too-many-requests':
         return 'ログイン試行が多すぎます。しばらくしてから再度お試しください。';
       default:
         return 'ログインに失敗しました。';
     }
   }
   ```

5. **テンプレートの変更**
   ```html
   <div class="login-content">
     <button 
       mat-raised-button 
       color="primary" 
       (click)="signIn()" 
       [disabled]="loading()" 
       class="login-button">
       <mat-icon *ngIf="!loading()">login</mat-icon>
       <mat-spinner *ngIf="loading()" diameter="20" class="button-spinner"></mat-spinner>
       Google でログイン
     </button>

     <div class="divider" *ngIf="!showEmailForm()">
       <span>または</span>
     </div>

     <div class="email-form" *ngIf="showEmailForm(); else showEmailToggle">
       <form [formGroup]="emailForm" (ngSubmit)="signInWithEmail()">
         <mat-form-field appearance="outline" class="full-width">
           <mat-label>メールアドレス</mat-label>
           <input matInput type="email" formControlName="email" required />
           <mat-error *ngIf="emailForm.get('email')?.hasError('required')">
             メールアドレスを入力してください
           </mat-error>
           <mat-error *ngIf="emailForm.get('email')?.hasError('email')">
             メールアドレスの形式が正しくありません
           </mat-error>
         </mat-form-field>

         <mat-form-field appearance="outline" class="full-width">
           <mat-label>パスワード</mat-label>
           <input matInput type="password" formControlName="password" required />
           <mat-error *ngIf="emailForm.get('password')?.hasError('required')">
             パスワードを入力してください
           </mat-error>
           <mat-error *ngIf="emailForm.get('password')?.hasError('minlength')">
             パスワードは6文字以上で入力してください
           </mat-error>
         </mat-form-field>

         <div class="error-message" *ngIf="emailError()">
           {{ emailError() }}
         </div>

         <button 
           mat-raised-button 
           color="primary" 
           type="submit"
           [disabled]="emailForm.invalid || loading()" 
           class="login-button">
           <mat-icon *ngIf="!loading()">login</mat-icon>
           <mat-spinner *ngIf="loading()" diameter="20" class="button-spinner"></mat-spinner>
           ログイン
         </button>

         <button 
           mat-button 
           type="button"
           (click)="toggleEmailForm()" 
           class="toggle-button">
           キャンセル
         </button>
       </form>
     </div>

     <ng-template #showEmailToggle>
       <button 
         mat-stroked-button 
         type="button"
         (click)="toggleEmailForm()" 
         class="toggle-button">
         メールアドレスとパスワードでログイン
       </button>
     </ng-template>

     <p class="info-text" *ngIf="mode() === 'employee'">
       招待リンクから来た場合は、そのリンクを開いてログインしてください。
     </p>
     <p class="info-text" *ngIf="mode() !== 'employee'">
       アカウントをお持ちでない場合は、招待リンクから新規登録できます。
     </p>
   </div>
   ```

6. **スタイルの追加**
   ```scss
   .divider {
     display: flex;
     align-items: center;
     margin: 24px 0;
     text-align: center;
     
     &::before,
     &::after {
       content: '';
       flex: 1;
       border-bottom: 1px solid #e0e0e0;
     }
     
     span {
       padding: 0 16px;
       color: #666;
       font-size: 0.9rem;
     }
   }

   .email-form {
     width: 100%;
     margin-top: 16px;
   }

   .full-width {
     width: 100%;
     margin-bottom: 16px;
   }

   .error-message {
     color: #d32f2f;
     font-size: 0.875rem;
     margin-bottom: 16px;
     padding: 8px;
     background-color: #ffebee;
     border-radius: 4px;
   }

   .toggle-button {
     width: 100%;
     margin-top: 8px;
   }

   .info-text {
     margin-top: 16px;
     font-size: 0.875rem;
     color: #666;
     text-align: center;
   }
   ```
   
   **注意**: `/office-setup` と `/login` の両方で `.info-text` を定義しているが、コンポーネントごとの SCSS に書いているため問題なし。もしグローバル SCSS に書く場合は、デザインが意図せず共有される可能性があるため、コンポーネントローカルにすることを推奨。

#### 4.2.3 `src/app/pages/employee-portal/accept-invite.page.ts`

**現状の役割**:
- 招待トークンの検証
- ユーザーと従業員レコードの紐づけ
- ログイン未完了時の `/login` へのリダイレクト

**今回追加・変更する責務**:
- Email/Password ログインにも対応（既存の Google ログインは維持）
- 変更不要（`AuthService` の `signInWithEmailAndPassword` が追加されれば自動的に対応）

**大まかなコード方針**:

```typescript
// 変更は最小限
// accept-invite.page.ts 自体は変更不要
// AuthService の signInWithEmailAndPassword / signUpWithEmailAndPassword を使用するだけ
```

**具体的な変更内容**:

- **変更不要**: `accept-invite.page.ts` は既存の実装のままで問題なし
- `AuthService` の `signInWithEmailAndPassword` / `signUpWithEmailAndPassword` が追加されれば、自動的に Email/Password 認証にも対応する
- ログイン画面（`/login?mode=employee&redirect=...`）で Email/Password ログインが可能になる

#### 4.2.4 Firebase コンソール側の設定

**手作業で実施する必要がある設定**:

1. **Firebase Console にアクセス**
   - https://console.firebase.google.com/ にアクセス
   - 対象プロジェクトを選択

2. **Authentication の設定**
   - 左メニューから「Authentication」を選択
   - 「Sign-in method」タブを開く

3. **Email/Password プロバイダを有効化**
   - 「Email/Password」をクリック
   - 「Enable」を選択
   - 「Email link (passwordless sign-in)」は無効のまま（今回は実装しない）
   - 「Save」をクリック

4. **確認**
   - 「Email/Password」のステータスが「Enabled」になっていることを確認

**注意事項**:
- この設定は手作業で実施する必要がある
- 実装前に必ず実施すること
- 設定が完了していないと、`signInWithEmailAndPassword` / `createUserWithEmailAndPassword` がエラーになる

---

## 5. テスト観点・確認手順

### 5.1 Phase3-1: 事業所参加フローの見直し

#### テストケース1: 新規管理者が事業所を作成

**手順**:
1. 未ログイン状態で `/login` にアクセス
2. Google または Email/Password でログイン
3. `officeId` が未設定のため `/office-setup` にリダイレクトされることを確認
4. 「新規事業所を作成」カードが表示されることを確認
5. 事業所名・所在地・健康保険プランを入力
6. 「事業所を作成」ボタンをクリック
7. 事業所が作成され、`admin` ロールで紐づけられることを確認
8. `/offices` にリダイレクトされることを確認

**期待結果**:
- ✅ 新規事業所作成が正常に動作する
- ✅ 「既存の事業所に参加」カードに説明文が表示される
- ✅ 既存事業所一覧選択機能が表示されない

#### テストケース2: 既存事業所一覧選択機能が削除されている

**手順**:
1. `/office-setup` にアクセス
2. 画面を確認

**期待結果**:
- ✅ `mat-select` で事業所を選択するUIが表示されない
- ✅ 「この事業所を選択」ボタンが表示されない
- ✅ 「既存の事業所に参加」カードに説明文のみが表示される

### 5.2 Phase3-2: Email/Password 認証の追加

#### テストケース1: Email/Password でログイン（既存ユーザー）

**前提条件**:
- Firebase Console で Email/Password プロバイダが有効化されている
- 既存の Email/Password アカウントが作成されている（手動で作成、または招待リンク経由）

**手順**:
1. `/login` にアクセス
2. 「メールアドレスとパスワードでログイン」ボタンをクリック
3. Email/Password フォームが表示されることを確認
4. メールアドレスとパスワードを入力
5. 「ログイン」ボタンをクリック
6. ログインが成功し、`/dashboard` にリダイレクトされることを確認

**期待結果**:
- ✅ Email/Password フォームが表示される
- ✅ バリデーションが正常に動作する（メールアドレス形式、パスワード6文字以上）
- ✅ ログインが成功する
- ✅ リダイレクトが正常に動作する

#### テストケース2: Email/Password でログイン（エラーケース）

**手順**:
1. `/login` にアクセス
2. 「メールアドレスとパスワードでログイン」ボタンをクリック
3. 存在しないメールアドレスでログインを試みる
4. エラーメッセージが表示されることを確認

**期待結果**:
- ✅ 適切なエラーメッセージが表示される（例：「このメールアドレスは登録されていません。」）
- ✅ エラーメッセージが赤色で表示される

#### テストケース3: 招待リンク経由で Email/Password ログイン

**前提条件**:
- 管理者が従業員台帳から「招待」ボタンをクリック
- 招待リンクが生成されている

**手順**:
1. 招待リンク（`/employee-portal/accept-invite?token=xxx`）を開く
2. 未ログインのため `/login?mode=employee&redirect=...` にリダイレクトされることを確認
3. 「メールアドレスとパスワードでログイン」ボタンをクリック
4. メールアドレスとパスワードを入力
5. 「ログイン」ボタンをクリック
6. ログイン後、`accept-invite` ページでトークン検証が実行されることを確認
7. `users/{uid}` と `employees/{employeeId}` が紐づけられることを確認
8. `/me` にリダイレクトされることを確認

**期待結果**:
- ✅ 招待リンク経由でも Email/Password ログインが可能
- ✅ トークン検証が正常に動作する
- ✅ ユーザーと従業員レコードが正常に紐づけられる

#### テストケース4: Google ログインが維持されている

**手順**:
1. `/login` にアクセス
2. 「Google でログイン」ボタンが表示されることを確認
3. 「Google でログイン」ボタンをクリック
4. Google ログインが正常に動作することを確認

**期待結果**:
- ✅ Google ログインボタンが表示される
- ✅ Google ログインが正常に動作する
- ✅ 既存の Google ログインフローが壊れていない

#### テストケース5: `mode=employee` での表示確認

**手順**:
1. `/login?mode=employee` にアクセス
2. タイトルが「InsurePath 従業員用ログイン」になっていることを確認
3. 説明文が従業員向けになっていることを確認
4. Email/Password フォームが表示されることを確認

**期待結果**:
- ✅ `mode=employee` での文言切り替えが正常に動作する
- ✅ Email/Password フォームも表示される

### 5.3 統合テスト

#### テストケース1: 新規ユーザーが招待リンク経由で Email/Password で新規登録（将来拡張時）

**前提条件**:
- 管理者が従業員台帳から「招待」ボタンをクリック
- 招待リンクが生成されている

**手順**:
1. 招待リンクを開く
2. 未ログインのため `/login?mode=employee&redirect=...` にリダイレクト
3. 「メールアドレスとパスワードでログイン」ボタンをクリック
4. 新規登録が必要な場合は、`AuthService.signUpWithEmailAndPassword` が呼ばれる想定
5. ただし、今回は新規登録フローは実装しないため、既存のアカウントでのログインのみをテスト

**注意事項**:
- 今回は新規登録フローは実装しないため、このテストケースは将来拡張時に実施

#### テストケース2: 既存ユーザーが招待リンク経由で Email/Password でログイン

**前提条件**:
- 既存の Email/Password アカウントが作成されている
- 管理者が従業員台帳から「招待」ボタンをクリック

**手順**:
1. 招待リンクを開く
2. `/login?mode=employee&redirect=...` にリダイレクト
3. Email/Password でログイン
4. ログイン後、`accept-invite` ページでトークン検証
5. `users/{uid}` と `employees/{employeeId}` が紐づけられる
6. `/me` にリダイレクト

**期待結果**:
- ✅ 既存ユーザーでも招待リンク経由で正常に紐づけられる
- ✅ Email/Password ログインが正常に動作する

---

## 6. 実装チェックリスト

### 6.1 Phase3-1: 事業所参加フローの見直し

- [ ] `src/app/pages/office-setup/office-setup.page.ts` から既存事業所一覧選択機能を削除
- [ ] `offices$` の取得処理を削除
- [ ] `existingOfficeControl` を削除
- [ ] `joinDisabled` を削除
- [ ] `joinExistingOffice()` メソッドを削除
- [ ] テンプレートから `mat-select` と「この事業所を選択」ボタンを削除
- [ ] 「既存の事業所に参加」カードに説明文を追加
- [ ] ヘッダーの文言を変更
- [ ] 新規事業所作成機能が正常に動作することを確認

### 6.2 Phase3-2: Email/Password 認証の追加

- [ ] Firebase Console で Email/Password プロバイダを有効化
- [ ] `src/app/services/auth.service.ts` に `signInWithEmailAndPassword` メソッドを追加
- [ ] `src/app/services/auth.service.ts` に `signUpWithEmailAndPassword` メソッドを追加（将来拡張用）
- [ ] `src/app/pages/login/login.page.ts` に Email/Password フォームを追加
- [ ] フォームバリデーションを実装
- [ ] エラーメッセージ表示を実装
- [ ] Google ログインが正常に動作することを確認
- [ ] Email/Password ログインが正常に動作することを確認
- [ ] 招待リンク経由で Email/Password ログインが正常に動作することを確認

---

## 7. 注意事項・制約

### 7.1 既存実装との互換性

- Phase1・Phase2 で実装済みの機能は壊さないこと
- 既存の Google ログインは維持すること
- 既存のガード（`authGuard`, `needsOfficeGuard`, `officeGuard`, `roleGuard`）は変更しないこと

### 7.2 セキュリティ考慮事項

- Email/Password 認証のパスワードは6文字以上を必須とする
- 本番運用ではエラーメッセージを詳細にしすぎない（セキュリティリスクを避ける）ことを検討する
- 現段階では開発・学習目的のため、ある程度わかりやすいメッセージを表示している
- 既存事業所一覧からの自由参加を完全に削除すること

### 7.3 パフォーマンス考慮事項

- Email/Password フォームの表示/非表示は `signal` で管理し、パフォーマンスを最適化
- フォームバリデーションはリアルタイムで行うが、過度な処理は避ける

### 7.4 将来拡張への配慮

- `signUpWithEmailAndPassword` メソッドは将来の新規登録フローに対応できるように実装
- ただし、今回は新規登録フローは実装しない（招待リンク経由のみ）

---

## 8. 関連ドキュメント

- `AUTHENTICATION_AND_PORTAL_POLICY.md`: 認証・ロール・従業員ポータル方針（決定版ドラフト）
- `IMPLEMENTATION_ROLE_PHASE1.md`: HRロール実装 & ユーザー管理UI追加 実装指示書

---

**以上**

