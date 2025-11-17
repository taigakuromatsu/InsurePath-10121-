import { AsyncPipe, NgFor } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
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
      <mat-card>
        <h1>所属する事業所を設定してください</h1>
        <p>既存の事業所を選択するか、新しく作成できます。</p>

        <div class="setup-grid">
          <div>
            <h2>既存の事業所に参加</h2>
            <mat-form-field appearance="outline" class="full">
              <mat-label>参加する事業所</mat-label>
              <mat-select [formControl]="existingOfficeControl">
                <mat-option *ngFor="let office of offices$ | async" [value]="office.id">
                  {{ office.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>
            <button
              mat-stroked-button
              color="primary"
              (click)="joinExistingOffice()"
              [disabled]="joinDisabled() || loading()"
            >
              この事業所を選択
            </button>
          </div>

          <div>
            <h2>新規事業所を作成</h2>
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

              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading()">
                事業所を作成
              </button>
            </form>
          </div>
        </div>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .office-setup mat-card {
        max-width: 960px;
        margin: 0 auto;
      }
      .setup-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
        margin-top: 24px;
      }
      .full {
        width: 100%;
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
