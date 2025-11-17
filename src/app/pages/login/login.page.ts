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
      <mat-card>
        <h1>InsurePath へログイン</h1>
        <p>Google アカウントでログインして従業員台帳を管理しましょう。</p>

        <button mat-raised-button color="primary" (click)="signIn()" [disabled]="loading()">
          <mat-icon aria-hidden="true">login</mat-icon>
          Google でログイン
        </button>

        <div class="spinner" *ngIf="loading()">
          <mat-progress-spinner mode="indeterminate" diameter="32"></mat-progress-spinner>
        </div>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .login {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 70vh;
      }
      mat-card {
        max-width: 480px;
        width: 100%;
        text-align: center;
      }
      .spinner {
        margin-top: 16px;
        display: flex;
        justify-content: center;
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
