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
import { MastersService } from '../../services/masters.service';
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
    <div class="page-container">
      <header class="page-header">
        <div>
          <h1 class="m-0">事業所情報</h1>
          <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">
            協会けんぽ / 健康保険組合の設定や所在地情報を管理します。
          </p>
        </div>
      </header>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center mb-4 flex-wrap gap-2">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">settings</mat-icon> 事業所設定
            </h2>
            <p class="mat-body-2" style="color: #666">事業所の基本情報と健康保険プランの設定を行います。</p>
          </div>
        </div>

        <form [formGroup]="form" (ngSubmit)="save()" *ngIf="form" class="office-form dense-form">
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

          <div class="form-section">
            <h3 class="section-title">
              <mat-icon>business_center</mat-icon>
              事業所識別情報
            </h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>事業所記号</mat-label>
                <input matInput formControlName="officeSymbol" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>事業所番号</mat-label>
                <input matInput formControlName="officeNumber" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>郡市区符号</mat-label>
                <input matInput formControlName="officeCityCode" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>郵便番号</mat-label>
                <input
                  matInput
                  formControlName="officePostalCode"
                  placeholder="1234567"
                  maxlength="7"
                />
                <mat-hint>7桁の数字（ハイフンなし）</mat-hint>
                <mat-error *ngIf="form.get('officePostalCode')?.hasError('pattern')">
                  7桁の数字を入力してください
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>電話番号</mat-label>
                <input matInput formControlName="officePhone" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>事業主（代表者）氏名</mat-label>
                <input matInput formControlName="officeOwnerName" />
              </mat-form-field>
            </div>
          </div>

          <div class="actions">
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading()">
              <mat-icon>save</mat-icon>
              保存
            </button>
          </div>
        </form>
      </mat-card>
    </div>
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
  private readonly mastersService = inject(MastersService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(false);
  private currentOfficeValue: Office | null = null;
  form = this.fb.group({
    id: [''],
    name: ['', Validators.required],
    address: [''],
    healthPlanType: ['kyokai', Validators.required],
    kyokaiPrefCode: [''],
    kyokaiPrefName: [''],
    unionName: [''],
    unionCode: [''],
    officeSymbol: [''],
    officeNumber: [''],
    officeCityCode: [''],
    officePostalCode: ['', [Validators.pattern(/^\d{7}$/)]],
    officePhone: [''],
    officeOwnerName: ['']
  });

  private readonly subscription: Subscription;

  constructor() {
    this.subscription = this.currentOffice.office$.subscribe((office) => {
      if (!office) {
        return;
      }
      this.currentOfficeValue = office;
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

    const formValue = this.form.getRawValue();
    if (!formValue.id) {
      this.snackBar.open('事業所IDを取得できませんでした', '閉じる', { duration: 3000 });
      return;
    }

    // 空文字の場合はnullをセット（Firestoreで値をクリアする）
    const normalizeString = (val: string | null | undefined): string | null => {
      const trimmed = val?.trim() ?? '';
      return trimmed === '' ? null : trimmed;
    };

    const office = {
      id: formValue.id,
      name: formValue.name ?? '',
      address: normalizeString(formValue.address),
      healthPlanType: (formValue.healthPlanType as HealthPlanType) ?? 'kyokai',
      kyokaiPrefCode: normalizeString(formValue.kyokaiPrefCode),
      kyokaiPrefName: normalizeString(formValue.kyokaiPrefName),
      unionName: normalizeString(formValue.unionName),
      unionCode: normalizeString(formValue.unionCode),
      officeSymbol: normalizeString(formValue.officeSymbol),
      officeNumber: normalizeString(formValue.officeNumber),
      officeCityCode: normalizeString(formValue.officeCityCode),
      officePostalCode: normalizeString(formValue.officePostalCode),
      officePhone: normalizeString(formValue.officePhone),
      officeOwnerName: normalizeString(formValue.officeOwnerName)
    } as Office;

    try {
      this.loading.set(true);
      // プラン変更チェック
      const previousPlan = this.currentOfficeValue?.healthPlanType;
      if (previousPlan && previousPlan !== office.healthPlanType) {
        const confirmed = confirm(
          '健康保険のプランを変更すると、現在登録されている\n' +
            '「健康保険マスタ（料率・標準報酬等級）」はすべて削除されます。\n' +
            '新しいプランに合わせてマスタを登録し直す必要があります。\n' +
            '本当にプランを変更しますか？'
        );
        if (!confirmed) {
          // 変更をキャンセル
          office.healthPlanType = previousPlan;
          this.form.patchValue({ healthPlanType: previousPlan });
          this.loading.set(false);
          return;
        }
        await this.mastersService.deleteAllHealthRateTables(office.id);
      }

      await this.officesService.saveOffice(office);
      this.snackBar.open('事業所情報を保存しました', '閉じる', { duration: 3000 });
    } catch (e) {
      console.error(e);
      this.snackBar.open('事業所情報の保存に失敗しました', '閉じる', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
