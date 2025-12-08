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
    <h1 mat-dialog-title>
      <mat-icon class="mr-2">account_balance</mat-icon>
      口座情報の変更申請
    </h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content class="dense-form">
      <div class="form-section mb-4" *ngIf="data.currentBankAccount; else noCurrent">
        <h3 class="mat-h3 mb-2 flex-row align-center gap-2">
          <mat-icon color="primary">info</mat-icon> 現在の口座情報
        </h3>
        <div class="screen-rules">
          <p>
            <strong>金融機関・支店:</strong> {{ data.currentBankAccount.bankName }} {{ data.currentBankAccount.branchName }}<br>
            <strong>口座種別・番号:</strong> {{ getBankAccountTypeLabel(data.currentBankAccount.accountType) }} / {{ data.currentBankAccount.accountNumber }}<br>
            <strong>名義:</strong> {{ data.currentBankAccount.accountHolderName }}
          </p>
        </div>
        </div>
        <ng-template #noCurrent>
        <div class="screen-rules mb-4">
          <p>現在の口座情報は登録されていません。</p>
        </div>
        </ng-template>

      <div class="form-section">
        <h3 class="mat-h3 mb-2 flex-row align-center gap-2">
          <mat-icon color="primary">edit</mat-icon> 新しい口座情報
        </h3>
        <div class="form-row flex-row gap-3 flex-wrap">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>金融機関名</mat-label>
            <input matInput formControlName="bankName" required />
            <mat-error *ngIf="form.get('bankName')?.hasError('required')">
              金融機関名を入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>金融機関コード</mat-label>
            <input matInput formControlName="bankCode" />
          </mat-form-field>
        </div>

        <div class="form-row flex-row gap-3 flex-wrap">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>支店名</mat-label>
            <input matInput formControlName="branchName" required />
            <mat-error *ngIf="form.get('branchName')?.hasError('required')">
              支店名を入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>支店コード</mat-label>
            <input matInput formControlName="branchCode" />
          </mat-form-field>
        </div>

        <div class="form-row flex-row gap-3 flex-wrap">
          <mat-form-field appearance="outline" style="flex: 0 0 160px">
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

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>口座番号</mat-label>
            <input matInput formControlName="accountNumber" required />
            <mat-error *ngIf="form.get('accountNumber')?.hasError('required')">
              口座番号を入力してください
            </mat-error>
            <mat-error *ngIf="form.get('accountNumber')?.hasError('pattern')">
              数字のみで入力してください
            </mat-error>
          </mat-form-field>
        </div>

        <div class="form-row flex-row gap-3 flex-wrap">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>名義</mat-label>
            <input matInput formControlName="accountHolderName" required />
            <mat-error *ngIf="form.get('accountHolderName')?.hasError('required')">
              名義を入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>名義カナ</mat-label>
            <input matInput formControlName="accountHolderKana" />
          </mat-form-field>
        </div>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-stroked-button mat-dialog-close type="button">キャンセル</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
          <mat-icon>send</mat-icon>
          申請する
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .mr-2 { margin-right: 8px; }
      
      /* フォームのレイアウト調整 */
      .form-row {
        display: flex;
        flex-wrap: wrap;
        gap: 16px; /* gapを広げて見やすく */
      }

      .flex-1 {
        flex: 1 1 200px; /* 最小幅を200px確保して、狭くなりすぎないようにする */
        min-width: 0; /* Flexboxの縮小ルール対策 */
      }

      .screen-rules {
        padding: 12px;
        background: #f5f7fa;
        border-radius: 4px;
        font-size: 13px;
        color: #666;
        border-left: 3px solid #1a237e;
        
        p { margin: 0; line-height: 1.5; }
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

