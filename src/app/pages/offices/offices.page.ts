import { NgIf } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { OfficesService } from '../../services/offices.service';
import { HealthPlanType, Office } from '../../types';

@Component({
  selector: 'ip-offices-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    ReactiveFormsModule,
    NgIf
  ],
  template: `
    <section class="page offices">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>business</mat-icon>
          </div>
          <div class="header-text">
            <h1>事業所情報</h1>
            <p>協会けんぽ / 健康保険組合の設定や所在地情報を管理します。</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="page-header">
          <div class="page-title-section">
            <h2>
              <mat-icon>settings</mat-icon>
              事業所設定
            </h2>
            <p>事業所の基本情報と健康保険プランの設定を行います。</p>
          </div>
        </div>

        <form [formGroup]="form" (ngSubmit)="save()" *ngIf="form" class="office-form">
          <div class="form-section">
            <h3 class="section-title">基本情報</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>事業所名</mat-label>
                <input matInput formControlName="name" required />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>所在地</mat-label>
                <input matInput formControlName="address" />
              </mat-form-field>
            </div>
          </div>

          <div class="form-section">
            <h3 class="section-title">健康保険プラン</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>健康保険プラン</mat-label>
                <mat-select formControlName="healthPlanType" required>
                  <mat-option value="kyokai">協会けんぽ</mat-option>
                  <mat-option value="kumiai">健康保険組合</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" *ngIf="healthPlanType() === 'kyokai'">
                <mat-label>協会けんぽ 都道府県コード</mat-label>
                <input matInput formControlName="kyokaiPrefCode" />
              </mat-form-field>

              <mat-form-field appearance="outline" *ngIf="healthPlanType() === 'kyokai'">
                <mat-label>協会けんぽ 都道府県名</mat-label>
                <input matInput formControlName="kyokaiPrefName" />
              </mat-form-field>

              <mat-form-field appearance="outline" *ngIf="healthPlanType() === 'kumiai'">
                <mat-label>組合名</mat-label>
                <input matInput formControlName="unionName" />
              </mat-form-field>

              <mat-form-field appearance="outline" *ngIf="healthPlanType() === 'kumiai'">
                <mat-label>組合コード</mat-label>
                <input matInput formControlName="unionCode" />
              </mat-form-field>
            </div>
          </div>

          <div class="actions">
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading()">
              <mat-icon>save</mat-icon>
              保存
            </button>
          </div>
        </form>
      </mat-card>
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

      .content-card {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .page-header {
        margin-bottom: 2rem;
        padding-bottom: 1.5rem;
        border-bottom: 2px solid #e0e0e0;
      }

      .page-title-section h2 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0 0 0.5rem 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #333;
      }

      .page-title-section h2 mat-icon {
        color: #667eea;
      }

      .page-title-section p {
        margin: 0;
        color: #666;
        font-size: 0.95rem;
      }

      .office-form {
        margin-top: 1rem;
      }

      .form-section {
        margin-bottom: 2rem;
      }

      .form-section:last-of-type {
        margin-bottom: 1rem;
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0 0 1rem 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: #333;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #e0e0e0;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
      }

      .actions {
        margin-top: 2rem;
        display: flex;
        justify-content: flex-end;
        padding-top: 1.5rem;
        border-top: 1px solid #e0e0e0;
      }

      button[mat-raised-button] {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      button[mat-raised-button]:hover:not(:disabled) {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
      }

      @media (max-width: 768px) {
        .header-content {
          flex-direction: column;
          text-align: center;
        }
      }
    `
  ]
})
export class OfficesPage implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly officesService = inject(OfficesService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(false);
  form = this.fb.group({
    id: [''],
    name: ['', Validators.required],
    address: [''],
    healthPlanType: ['kyokai', Validators.required],
    kyokaiPrefCode: [''],
    kyokaiPrefName: [''],
    unionName: [''],
    unionCode: ['']
  });

  private readonly subscription: Subscription;

  constructor() {
    this.subscription = this.currentOffice.office$.subscribe((office) => {
      if (!office) {
        return;
      }
      this.form.patchValue(office);
    });
  }

  healthPlanType(): HealthPlanType | null {
    return (this.form.get('healthPlanType')?.value as HealthPlanType) ?? null;
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const office = this.form.value as Office;
    if (!office.id) {
      this.snackBar.open('事業所IDを取得できませんでした', '閉じる', { duration: 3000 });
      return;
    }

    try {
      this.loading.set(true);
      await this.officesService.saveOffice(office);
      this.snackBar.open('事業所情報を保存しました', '閉じる', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
