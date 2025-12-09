import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CurrentUserService } from '../../services/current-user.service';
import { OfficesService } from '../../services/offices.service';
import { HealthPlanType } from '../../types';

@Component({
  selector: 'ip-office-setup-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    ReactiveFormsModule
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div>
          <h1 class="m-0">所属する事業所を設定してください</h1>
          <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">
            初めて InsurePath を使う場合は、新規事業所を作成してください。
          </p>
        </div>
      </header>

        <div class="setup-grid">
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

        <mat-card class="content-card setup-card">
          <div class="card-header flex-row align-center gap-2 mb-3">
            <mat-icon color="primary">add_business</mat-icon>
            <h2 class="mat-h2 mb-0">新規事業所を作成</h2>
          </div>
          <div class="card-content dense-form">
            <form [formGroup]="form" (ngSubmit)="createOffice()">
              <mat-form-field appearance="outline" class="full dense-form-field">
                <mat-label>事業所名</mat-label>
                <input matInput formControlName="name" required />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full dense-form-field">
                <mat-label>所在地</mat-label>
                <input matInput formControlName="address" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full dense-form-field">
                <mat-label>健康保険プラン</mat-label>
                <mat-select formControlName="healthPlanType" required>
                  <mat-option value="kyokai">協会けんぽ</mat-option>
                  <mat-option value="kumiai">健康保険組合</mat-option>
                </mat-select>
              </mat-form-field>

              <button
                mat-flat-button
                color="primary"
                type="submit"
                [disabled]="form.invalid || loading()"
                class="action-button"
              >
                <mat-icon>add</mat-icon>
                事業所を作成
              </button>
            </form>
          </div>
        </mat-card>
        </div>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .content-card {
        padding: 24px;
        border-radius: 8px;
      }

      /* ユーティリティ */
      .m-0 { margin: 0; }
      .mb-0 { margin-bottom: 0; }
      .mb-2 { margin-bottom: 8px; }
      .mb-3 { margin-bottom: 16px; }
      .mb-4 { margin-bottom: 24px; }
      .gap-2 { gap: 8px; }
      .gap-3 { gap: 16px; }
      .flex-row { display: flex; flex-direction: row; }
      .align-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .flex-wrap { flex-wrap: wrap; }
      .dense-form-field { font-size: 14px; }

      .setup-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 16px;
      }

      .setup-card {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 0 8px 0;
        border-bottom: 1px solid #e0e0e0;
      }

      .card-header mat-icon {
        color: #1a237e;
      }

      .card-content {
        padding-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .info-text {
        margin: 0 0 12px 0;
        color: #666;
        font-size: 0.95rem;
        line-height: 1.6;
      }

      .full { width: 100%; }

      .action-button {
        width: fit-content;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      @media (max-width: 768px) {
        .setup-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class OfficeSetupPage {
  private readonly fb = inject(FormBuilder);
  private readonly officesService = inject(OfficesService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    address: [''],
    healthPlanType: ['kyokai', Validators.required]
  });

  readonly loading = signal(false);

  async createOffice(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      this.loading.set(true);
      const formValue = this.form.value;
      const office = await this.officesService.createOffice({
        name: formValue.name ?? '',
        address: formValue.address ?? undefined,
        healthPlanType: (formValue.healthPlanType ?? 'kyokai') as HealthPlanType
      });
      await this.currentUser.assignOffice(office.id);
      await this.currentUser.updateProfile({ role: 'admin' });
      await this.router.navigateByUrl('/offices');
      this.snackBar.open(
        '新しい事業所を作成しました。事業所設定画面で事業所記号や郵便番号などの識別情報も入力してください。',
        '閉じる',
        { duration: 4000 }
      );
    } catch (error) {
      console.error(error);
      this.snackBar.open('事業所の作成に失敗しました', '閉じる', { duration: 4000 });
    } finally {
      this.loading.set(false);
    }
  }
}
