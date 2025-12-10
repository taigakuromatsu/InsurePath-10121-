import { NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'ip-login-page',
  standalone: true,
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
  ],
  template: `
    <section class="page login">
      <div class="login-container">
        <mat-card class="login-card">
          <div class="login-header">
            <div class="login-icon-wrapper">
              <mat-icon class="login-icon">lock_person</mat-icon>
            </div>
            <h1 class="login-title">{{ getTitle() }}</h1>
            <p class="login-description">{{ getDescription() }}</p>
            <p class="login-sub-description" *ngIf="getSubDescription() as sub">
              {{ sub }}
            </p>
          </div>

          <div class="login-content">
            <!-- Google ログイン -->
            <button
              mat-flat-button
              (click)="signIn()"
              [disabled]="loading()"
              class="google-login-button"
            >
              <span class="button-content-wrapper">
                <mat-icon *ngIf="!loading()" class="button-icon">login</mat-icon>
                <mat-spinner *ngIf="loading()" diameter="20" class="button-spinner"></mat-spinner>
                <span>Google でログイン / アカウント作成</span>
              </span>
            </button>

            <div class="divider">
              <span class="divider-text">または</span>
            </div>

            <!-- メールアドレス＋パスワード -->
            <div class="email-login-section" *ngIf="showEmailForm(); else showEmailToggle">
              <form [formGroup]="emailForm" (ngSubmit)="signInWithEmail()" class="login-form">
                <mat-form-field appearance="outline" class="full-width-field">
                  <mat-label>メールアドレス</mat-label>
                  <mat-icon matPrefix>email</mat-icon>
                  <input
                    matInput
                    type="email"
                    formControlName="email"
                    required
                    placeholder="example@company.com"
                  />
                  <mat-error *ngIf="emailForm.get('email')?.hasError('required')">
                    メールアドレスを入力してください
                  </mat-error>
                  <mat-error *ngIf="emailForm.get('email')?.hasError('email')">
                    メールアドレスの形式が正しくありません
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width-field">
                  <mat-label>パスワード</mat-label>
                  <mat-icon matPrefix>lock</mat-icon>
                  <input
                    matInput
                    type="password"
                    formControlName="password"
                    required
                  />
                  <mat-error *ngIf="emailForm.get('password')?.hasError('required')">
                    パスワードを入力してください
                  </mat-error>
                  <mat-error *ngIf="emailForm.get('password')?.hasError('minlength')">
                    パスワードは6文字以上で入力してください
                  </mat-error>
                </mat-form-field>

                <div class="error-message-box" *ngIf="emailError()">
                  <mat-icon inline>error_outline</mat-icon>
                  {{ emailError() }}
                </div>

                <div class="form-actions">
                  <button
                    mat-flat-button
                    color="primary"
                    type="submit"
                    [disabled]="emailForm.invalid || loading()"
                    class="submit-button"
                  >
                    <span class="button-content-wrapper">
                      <mat-icon *ngIf="!loading()" class="button-icon">arrow_forward</mat-icon>
                      <mat-spinner *ngIf="loading()" diameter="20" class="button-spinner"></mat-spinner>
                      <span>ログイン / アカウント作成</span>
                    </span>
                  </button>

                  <button
                    mat-button
                    type="button"
                    (click)="toggleEmailForm()"
                    class="cancel-button"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>

            <ng-template #showEmailToggle>
              <button
                mat-stroked-button
                type="button"
                (click)="toggleEmailForm()"
                class="email-toggle-button"
              >
                <mat-icon class="button-icon">mail</mat-icon>
                メールアドレスとパスワードで続行
              </button>
            </ng-template>

            <!-- 説明テキスト -->
            <div class="info-text-container">
              <!-- 従業員モード（招待リンク付き /login?mode=employee） -->
              <p class="info-text" *ngIf="mode() === 'employee'">
                <mat-icon inline class="info-icon">info</mat-icon>
                従業員の方は、所属事業所の管理者から送られた招待リンク経由でこの画面にアクセスし、
                ログインしてください。初めてご利用の方も、そのままログインするとアカウントが作成されます。
                一度参加が完了した従業員は、次回以降もこのログイン画面から再ログインできます。
              </p>

              <!-- それ以外: 管理者・人事担当 + 再ログインする従業員 -->
              <div *ngIf="mode() !== 'employee'" class="admin-info">
                <p class="info-text">
                  <mat-icon inline class="info-icon">business</mat-icon>
                  このログイン画面は、主に事業所を管理する方（管理者・人事担当）向けです。
                  InsurePath を初めてご利用の方は、ここからログイン／アカウント作成を行い、
                  事業所情報の登録を進めてください。
                </p>
                <p class="info-text secondary-info">
                  従業員の方は、初回のみ管理者から送られた招待リンク経由で InsurePath に参加します。
                  参加が完了した後は、このログイン画面から通常どおり再ログインできます。
                </p>
              </div>

            </div>
          </div>
        </mat-card>
      </div>
    </section>
  `,
  styles: [
    `
      .login {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        padding: 24px;
        box-sizing: border-box;
      }

      .login-container {
        width: 100%;
        max-width: 600px;
      }

      .login-card {
        border-radius: 24px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
        overflow: hidden;
        background: #ffffff;
        border: none;
      }

      .login-header {
        background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
        color: white;
        padding: 48px 32px 40px;
        text-align: center;
        position: relative;
      }

      .login-icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 72px;
        height: 72px;
        margin: 0 auto 24px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 50%;
        backdrop-filter: blur(4px);
      }

      .login-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: white;
      }

      .login-title {
        margin: 0 0 12px 0;
        font-size: 1.5rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        line-height: 1.4;
      }

      .login-description {
        margin: 0;
        opacity: 0.95;
        font-size: 0.95rem;
        line-height: 1.6;
      }

      .login-sub-description {
        margin-top: 8px;
        font-size: 0.85rem;
        opacity: 0.8;
      }

      .login-content {
        padding: 40px 32px;
      }

      .button-content-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
      }

      .button-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .button-spinner {
        margin: 0;
      }

      .google-login-button {
        width: 100%;
        height: 48px;
        font-size: 1rem;
        font-weight: 500;
        background-color: #4285f4;
        color: white;
        border-radius: 24px;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .google-login-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
      }

      .divider {
        display: flex;
        align-items: center;
        margin: 32px 0;
        color: #9ca3af;
      }

      .divider::before,
      .divider::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid #e5e7eb;
      }

      .divider-text {
        padding: 0 16px;
        font-size: 0.85rem;
        font-weight: 500;
      }

      .email-login-section {
        animation: fadeIn 0.3s ease-out;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .login-form {
        display: flex;
        flex-direction: column;
      }

      .full-width-field {
        width: 100%;
        margin-bottom: 8px;
      }

      .error-message-box {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #b91c1c;
        font-size: 0.85rem;
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 24px;
        line-height: 1.4;
      }

      .form-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 8px;
      }

      .submit-button {
        width: 100%;
        height: 48px;
        border-radius: 24px;
        font-size: 1rem;
        font-weight: 500;
      }

      .cancel-button {
        width: 100%;
        color: #6b7280;
      }

      .email-toggle-button {
        width: 100%;
        height: 48px;
        border-radius: 24px;
        border-color: #d1d5db;
        color: #4b5563;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .email-toggle-button:hover {
        background-color: #f9fafb;
        border-color: #9ca3af;
      }

      .info-text-container {
        margin-top: 40px;
        border-top: 1px solid #f3f4f6;
        padding-top: 24px;
      }

      .info-text {
        font-size: 0.8rem;
        color: #6b7280;
        line-height: 1.6;
        margin: 0 0 12px 0;
        text-align: left;
      }

      .info-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        vertical-align: text-bottom;
        margin-right: 4px;
        color: #9ca3af;
      }

      .secondary-info {
        font-size: 0.75rem;
        color: #9ca3af;
        margin-top: 8px;
      }

      @media (max-width: 600px) {
        .login {
          padding: 0;
          background: #ffffff;
          align-items: flex-start;
        }

        .login-container {
          max-width: 100%;
          min-height: 100vh;
        }

        .login-card {
          box-shadow: none;
          border-radius: 0;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .login-header {
          padding: 40px 24px 32px;
          border-radius: 0 0 24px 24px;
        }

        .login-content {
          padding: 32px 24px;
          flex: 1;
        }
      }
    `
  ]
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly mode = signal(this.route.snapshot.queryParamMap.get('mode') ?? null);
  readonly showEmailForm = signal(false);
  readonly emailError = signal<string | null>(null);
  readonly emailForm: FormGroup;

  constructor() {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  getTitle(): string {
    return this.mode() === 'employee'
      ? 'InsurePath 従業員ログイン'
      : 'InsurePath ログイン / アカウント作成';
  }

  getDescription(): string {
    if (this.mode() === 'employee') {
      return '管理者から送られた招待リンク経由で、従業員用マイページにログインします。';
    }
    // ★シンプルな説明だけにする
    return '社会保険業務を管理するための InsurePath の共通ログインページです。';
  }
  

  getSubDescription(): string | null {
    if (this.mode() === 'employee') {
      return '初めてご利用の方も、この画面からログインするとアカウントが作成されます。';
    }
    return null;
  }

  async signIn(): Promise<void> {
    try {
      this.loading.set(true);
      await this.auth.signInWithGoogle();
      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      await this.router.navigateByUrl(redirect || '/dashboard');
    } catch (error) {
      console.error(error);
      this.snackBar.open('ログインに失敗しました。再度お試しください。', '閉じる', {
        duration: 4000
      });
    } finally {
      this.loading.set(false);
    }
  }

  toggleEmailForm(): void {
    this.showEmailForm.set(!this.showEmailForm());
    this.emailError.set(null);
    if (!this.showEmailForm()) {
      this.emailForm.reset();
    }
  }

  async signInWithEmail(): Promise<void> {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.emailForm.value as { email: string; password: string };
    try {
      this.loading.set(true);
      this.emailError.set(null);
      await this.auth.signInWithEmailAndPassword(email, password);
      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      await this.router.navigateByUrl(redirect || '/dashboard');
    } catch (error: any) {
      console.error(error);
      this.emailError.set(this.getErrorMessage(error?.code));
      this.snackBar.open('ログインに失敗しました。再度お試しください。', '閉じる', {
        duration: 4000
      });
    } finally {
      this.loading.set(false);
    }
  }

  getErrorMessage(errorCode: string | undefined): string {
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
}

