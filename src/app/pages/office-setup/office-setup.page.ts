import { AsyncPipe, NgFor } from '@angular/common';
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
import { Office, HealthPlanType } from '../../types';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
    ReactiveFormsModule,
    NgFor,
    AsyncPipe
  ],
  template: `
    <section class="page office-setup">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>business_center</mat-icon>
          </div>
          <div class="header-text">
            <h1>所属する事業所を設定してください</h1>
            <p>既存の事業所を選択するか、新しく作成できます。</p>
          </div>
        </div>
      </mat-card>

      <div class="setup-grid">
        <mat-card class="setup-card">
          <div class="card-header">
            <mat-icon>group_add</mat-icon>
            <h2>既存の事業所に参加</h2>
          </div>
          <div class="card-content">
            <mat-form-field appearance="outline" class="full">
              <mat-label>参加する事業所</mat-label>
              <mat-select [formControl]="existingOfficeControl">
                <mat-option *ngFor="let office of offices$ | async" [value]="office.id">
                  {{ office.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>
            <button
              mat-raised-button
              color="primary"
              (click)="joinExistingOffice()"
              [disabled]="joinDisabled() || loading()"
              class="action-button"
            >
              <mat-icon>check</mat-icon>
              この事業所を選択
            </button>
          </div>
        </mat-card>

        <mat-card class="setup-card">
          <div class="card-header">
            <mat-icon>add_business</mat-icon>
            <h2>新規事業所を作成</h2>
          </div>
          <div class="card-content">
            <form [formGroup]="form" (ngSubmit)="createOffice()">
              <mat-form-field appearance="outline" class="full">
                <mat-label>事業所名</mat-label>
                <input matInput formControlName="name" required />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>所在地</mat-label>
                <input matInput formControlName="address" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full">
                <mat-label>健康保険プラン</mat-label>
                <mat-select formControlName="healthPlanType" required>
                  <mat-option value="kyokai">協会けんぽ</mat-option>
                  <mat-option value="kumiai">健康保険組合</mat-option>
                </mat-select>
              </mat-form-field>

              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading()" class="action-button">
                <mat-icon>add</mat-icon>
                事業所を作成
              </button>
            </form>
          </div>
        </mat-card>
      </div>
    </section>
  `,
  styles: [
    `
      .header-card {
        margin-bottom: 1.5rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .header-card ::ng-deep .mat-mdc-card-content {
        padding: 0;
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem;
      }

      .header-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 12px;
      }

      .header-icon mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: white;
      }

      .header-text h1 {
        margin: 0 0 0.5rem 0;
        font-size: 1.75rem;
        font-weight: 600;
      }

      .header-text p {
        margin: 0;
        opacity: 0.9;
        font-size: 1rem;
      }

      .setup-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 1.5rem;
      }

      .setup-card {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
      }

      .setup-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateY(-2px);
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 2px solid #e0e0e0;
      }

      .card-header mat-icon {
        color: #667eea;
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      .card-header h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #333;
      }

      .card-content {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .full {
        width: 100%;
      }

      .action-button {
        margin-top: 0.5rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .action-button:hover:not(:disabled) {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
      }

      @media (max-width: 768px) {
        .header-content {
          flex-direction: column;
          text-align: center;
        }

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

  readonly offices$: Observable<Office[]> = this.officesService.listOffices();
  readonly existingOfficeControl = this.fb.control<string | null>(null);
  readonly form = this.fb.group({
    name: ['', Validators.required],
    address: [''],
    healthPlanType: ['kyokai', Validators.required]
  });

  readonly loading = signal(false);

  joinDisabled = signal(true);

  constructor() {
    this.existingOfficeControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.joinDisabled.set(!value));
  }

  async joinExistingOffice(): Promise<void> {
    const officeId = this.existingOfficeControl.value;
    if (!officeId) {
      return;
    }
    try {
      this.loading.set(true);
      await this.currentUser.assignOffice(officeId);
      await this.router.navigateByUrl('/dashboard');
      this.snackBar.open('事業所を設定しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('事業所の設定に失敗しました', '閉じる', { duration: 4000 });
    } finally {
      this.loading.set(false);
    }
  }

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
      await this.router.navigateByUrl('/offices');
      this.snackBar.open('新しい事業所を作成しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('事業所の作成に失敗しました', '閉じる', { duration: 4000 });
    } finally {
      this.loading.set(false);
    }
  }
}
