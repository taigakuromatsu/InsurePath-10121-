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
            <div class="login-icon">
              <mat-icon>lock</mat-icon>
            </div>
            <h1>{{ getTitle() }}</h1>
            <p>{{ getDescription() }}</p>
            <p class="sub-text" *ngIf="getSubDescription() as sub">{{ sub }}</p>
          </div>

          <div class="login-content">
            <button
              mat-raised-button
              color="primary"
              (click)="signIn()"
              [disabled]="loading()"
              class="login-button"
            >
              <mat-icon *ngIf="!loading()">login</mat-icon>
              <mat-spinner *ngIf="loading()" diameter="20" class="button-spinner"></mat-spinner>
              Google でログイン
            </button>

            <div class="divider">
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
                  class="login-button"
                >
                  <mat-icon *ngIf="!loading()">login</mat-icon>
                  <mat-spinner *ngIf="loading()" diameter="20" class="button-spinner"></mat-spinner>
                  ログイン
                </button>

                <button
                  mat-button
                  type="button"
                  (click)="toggleEmailForm()"
                  class="toggle-button"
                >
                  キャンセル
                </button>
              </form>
            </div>

            <ng-template #showEmailToggle>
              <button
                mat-stroked-button
                type="button"
                (click)="toggleEmailForm()"
                class="toggle-button"
              >
                メールアドレスとパスワードでログイン
              </button>
            </ng-template>

            <p class="info-text" *ngIf="mode() === 'employee'">
              招待リンクから来た場合は、そのリンクを開いてログインしてください。
            </p>
            <p class="info-text" *ngIf="mode() !== 'employee'">
              管理者・人事担当の方は、この画面からそのままログインして事業所を作成できます。
              従業員の方は、管理者から送られた招待リンクから参加してください。
            </p>

            <p class="info-text" *ngIf="mode() !== 'employee'">
              アカウントをお持ちでない場合は、招待リンクから新規登録できます。
            </p>
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
        min-height: 80vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 2rem;
      }

      .login-container {
        width: 100%;
        max-width: 480px;
      }

      .login-card {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        border-radius: 16px;
        overflow: hidden;
      }

      .login-card ::ng-deep .mat-mdc-card-content {
        padding: 0;
      }

      .login-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 3rem 2rem;
        text-align: center;
      }

      .login-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        margin: 0 auto 1.5rem;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
      }

      .login-icon mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: white;
      }

      .login-header h1 {
        margin: 0 0 0.75rem 0;
        font-size: 1.75rem;
        font-weight: 600;
      }

      .login-header p {
        margin: 0;
        opacity: 0.9;
        font-size: 1rem;
      }

      .sub-text {
        margin-top: 0.5rem;
        opacity: 0.9;
      }

      .login-content {
        padding: 2rem;
        text-align: center;
      }

      .login-button {
        width: 100%;
        padding: 12px 24px;
        font-size: 1rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }

      .login-button:hover:not(:disabled) {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transform: translateY(-2px);
      }

      .button-spinner {
        margin-right: 0;
      }

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

      @media (max-width: 768px) {
        .login {
          padding: 1rem;
        }

        .login-header {
          padding: 2rem 1.5rem;
        }

        .login-content {
          padding: 1.5rem;
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
    return this.mode() === 'employee' ? 'InsurePath 従業員用ログイン' : 'InsurePath へログイン';
  }

  getDescription(): string {
    return this.mode() === 'employee'
      ? 'あなたの社会保険情報を確認するための従業員専用ページです。'
      : 'Google またはメールアドレスでログインして従業員台帳を管理しましょう。';
  }

  getSubDescription(): string | null {
    if (this.mode() === 'employee') {
      return '管理者・人事担当の方は、管理者画面用のログインからお入りください。';
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
