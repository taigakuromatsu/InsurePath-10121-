import { NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom, map } from 'rxjs';

import { ChangeRequestsService } from '../../services/change-requests.service';
import { CurrentUserService } from '../../services/current-user.service';
import { BankAccount, BankAccountType } from '../../types';
import { getBankAccountTypeLabel } from '../../utils/label-utils';

@Component({
  selector: 'ip-bank-account-change-request-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    NgIf
  ],
  template: `
    <h1 mat-dialog-title>口座情報の変更申請</h1>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <div mat-dialog-content class="dialog-content">
        <div class="current-info" *ngIf="data.currentBankAccount; else noCurrent">
          <h3>現在の口座情報</h3>
          <p class="muted">
            {{ data.currentBankAccount.bankName }} {{ data.currentBankAccount.branchName }}
          </p>
          <p class="muted">
            {{ getBankAccountTypeLabel(data.currentBankAccount.accountType) }} /
            {{ data.currentBankAccount.accountNumber }}
          </p>
          <p class="muted">名義: {{ data.currentBankAccount.accountHolderName }}</p>
        </div>
        <ng-template #noCurrent>
          <p class="muted">現在の口座情報は登録されていません。</p>
        </ng-template>

        <h3 class="section-title">新しい口座情報</h3>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>金融機関名</mat-label>
            <input matInput formControlName="bankName" required />
            <mat-error *ngIf="form.get('bankName')?.hasError('required')">
              金融機関名を入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>金融機関コード</mat-label>
            <input matInput formControlName="bankCode" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>支店名</mat-label>
            <input matInput formControlName="branchName" required />
            <mat-error *ngIf="form.get('branchName')?.hasError('required')">
              支店名を入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>支店コード</mat-label>
            <input matInput formControlName="branchCode" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>口座種別</mat-label>
            <mat-select formControlName="accountType" required>
              <mat-option value="ordinary">普通</mat-option>
              <mat-option value="checking">当座</mat-option>
              <mat-option value="savings">貯蓄</mat-option>
              <mat-option value="other">その他</mat-option>
            </mat-select>
            <mat-error *ngIf="form.get('accountType')?.hasError('required')">
              口座種別を選択してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>口座番号</mat-label>
            <input matInput formControlName="accountNumber" required />
            <mat-error *ngIf="form.get('accountNumber')?.hasError('required')">
              口座番号を入力してください
            </mat-error>
            <mat-error *ngIf="form.get('accountNumber')?.hasError('pattern')">
              数字のみで入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>名義</mat-label>
            <input matInput formControlName="accountHolderName" required />
            <mat-error *ngIf="form.get('accountHolderName')?.hasError('required')">
              名義を入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>名義カナ</mat-label>
            <input matInput formControlName="accountHolderKana" />
          </mat-form-field>
        </div>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button mat-dialog-close type="button">キャンセル</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
          <mat-icon>send</mat-icon>
          申請する
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .dialog-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-width: 420px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }

      .section-title {
        margin: 1rem 0 0.25rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }

      .muted {
        color: #6b7280;
        margin: 0;
      }
    `
  ]
})
export class BankAccountChangeRequestFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly currentUser = inject(CurrentUserService);
  private readonly changeRequestsService = inject(ChangeRequestsService);
  private readonly dialogRef = inject(MatDialogRef<BankAccountChangeRequestFormDialogComponent>);

  readonly form = this.fb.group({
    bankName: ['', Validators.required],
    bankCode: [''],
    branchName: ['', Validators.required],
    branchCode: [''],
    accountType: ['ordinary' as BankAccountType | null, Validators.required],
    accountNumber: ['', [Validators.required, Validators.pattern(/^[0-9]+$/), Validators.maxLength(8)]],
    accountHolderName: ['', Validators.required],
    accountHolderKana: ['']
  });

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: {
      officeId: string;
      employeeId: string;
      currentBankAccount: BankAccount | null;
    }
  ) {
    if (data.currentBankAccount) {
      const bank = data.currentBankAccount;
      this.form.patchValue({
        bankName: bank.bankName,
        bankCode: bank.bankCode ?? '',
        branchName: bank.branchName,
        branchCode: bank.branchCode ?? '',
        accountType: bank.accountType,
        accountNumber: bank.accountNumber,
        accountHolderName: bank.accountHolderName,
        accountHolderKana: bank.accountHolderKana ?? ''
      });
    }
  }

  protected readonly getBankAccountTypeLabel = getBankAccountTypeLabel;

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const currentUserId = await firstValueFrom(
      this.currentUser.profile$.pipe(map((profile) => profile?.id ?? null))
    );

    if (!currentUserId) {
      throw new Error('ユーザーIDが取得できませんでした');
    }

    const formValue = this.form.getRawValue();

    await this.changeRequestsService.create(this.data.officeId, {
      employeeId: this.data.employeeId,
      requestedByUserId: currentUserId,
      kind: 'bankAccount',
      payload: {
        bankName: formValue.bankName ?? '',
        bankCode: formValue.bankCode?.trim() || null,
        branchName: formValue.branchName ?? '',
        branchCode: formValue.branchCode?.trim() || null,
        accountType: formValue.accountType ?? 'ordinary',
        accountNumber: formValue.accountNumber ?? '',
        accountHolderName: formValue.accountHolderName ?? '',
        accountHolderKana: formValue.accountHolderKana?.trim() || null
      }
    });

    this.dialogRef.close(true);
  }
}

