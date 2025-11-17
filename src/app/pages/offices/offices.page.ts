import { NgIf } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
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
    MatSnackBarModule,
    ReactiveFormsModule,
    NgIf
  ],
  template: `
    <section class="page">
      <mat-card>
        <h1>事業所情報</h1>
        <p>協会けんぽ / 健康保険組合の設定や所在地情報を管理します。</p>

        <form [formGroup]="form" (ngSubmit)="save()" *ngIf="form">
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>事業所名</mat-label>
              <input matInput formControlName="name" required />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>所在地</mat-label>
              <input matInput formControlName="address" />
            </mat-form-field>

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

          <div class="actions">
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading()">
              保存
            </button>
          </div>
        </form>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
      }
      .actions {
        margin-top: 1.5rem;
        display: flex;
        justify-content: flex-end;
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
