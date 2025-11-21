import { NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
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
        <h1>InsurePath へログイン</h1>
        <p>Google アカウントでログインして従業員台帳を管理しましょう。</p>
          </div>

          <div class="login-content">
            <button mat-raised-button color="primary" (click)="signIn()" [disabled]="loading()" class="login-button">
              <mat-icon *ngIf="!loading()">login</mat-icon>
              <mat-spinner *ngIf="loading()" diameter="20" class="button-spinner"></mat-spinner>
          Google でログイン
        </button>
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

  readonly loading = signal(false);

  async signIn(): Promise<void> {
    try {
      this.loading.set(true);
      await this.auth.signInWithGoogle();
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      console.error(error);
      this.snackBar.open('ログインに失敗しました。再度お試しください。', '閉じる', {
        duration: 4000
      });
    } finally {
      this.loading.set(false);
    }
  }
}
