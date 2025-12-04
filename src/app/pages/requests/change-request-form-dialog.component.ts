import { NgIf } from '@angular/common';
import { Component, Inject, OnDestroy, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom, map, Subscription } from 'rxjs';

import { ChangeRequestsService } from '../../services/change-requests.service';
import { CurrentUserService } from '../../services/current-user.service';
import { Employee } from '../../types';

@Component({
  selector: 'ip-change-request-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    NgIf
  ],
  template: `
    <h1 mat-dialog-title>プロフィール変更申請</h1>
    <form [formGroup]="form" (ngSubmit)="submit()">
     <div mat-dialog-content>
       <mat-form-field appearance="outline" class="full-width">
         <mat-label>変更項目</mat-label>
         <mat-select formControlName="field" (selectionChange)="onFieldChange()">
           <mat-option value="postalCode">郵便番号</mat-option>
           <mat-option value="address">住所</mat-option>
           <mat-option value="phone">電話番号</mat-option>
           <mat-option value="contactEmail">連絡先メール</mat-option>
           <mat-option value="kana">カナ</mat-option>
         </mat-select>
       </mat-form-field>

       <mat-form-field appearance="outline" class="full-width" *ngIf="form.value.field">
         <mat-label>現在の値</mat-label>
         <input matInput [value]="getCurrentValue(form.value.field!)" readonly />
       </mat-form-field>

       <mat-form-field appearance="outline" class="full-width">
         <mat-label>申請する値</mat-label>
         <input matInput formControlName="requestedValue" />
         <mat-error *ngIf="form.get('requestedValue')?.hasError('required')">
           申請する値を入力してください
         </mat-error>
         <mat-error *ngIf="form.get('requestedValue')?.hasError('email')">
           正しいメールアドレスを入力してください
         </mat-error>
       </mat-form-field>
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
      .full-width {
        width: 100%;
      }
    `
  ]
})
export class ChangeRequestFormDialogComponent implements OnDestroy {
  private readonly currentUser = inject(CurrentUserService);
  private readonly changeRequestsService = inject(ChangeRequestsService);
  private readonly subscriptions = new Subscription();
  private readonly fb = inject(FormBuilder);

  form = this.fb.group({
    field: ['', Validators.required],
    requestedValue: ['', Validators.required]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<ChangeRequestFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      employee: Employee;
      officeId: string;
    }
  ) {
    this.subscriptions.add(
      this.form.get('field')?.valueChanges.subscribe(() => this.onFieldChange()) ??
        new Subscription()
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onFieldChange(): void {
    const requestedValueControl = this.form.get('requestedValue');
    if (!requestedValueControl) return;

    const validators = [Validators.required];
    if (this.form.value.field === 'contactEmail') {
      validators.push(Validators.email);
    }

    if (this.form.value.field === 'postalCode') {
      validators.push(Validators.pattern(/^[0-9]{7}$/));
    }

    requestedValueControl.setValidators(validators);
    requestedValueControl.updateValueAndValidity();
  }

  getCurrentValue(field: string | null | undefined): string {
    switch (field) {
      case 'postalCode':
        return this.data.employee.postalCode ?? '';
      case 'address':
        return this.data.employee.address ?? '';
      case 'phone':
        return this.data.employee.phone ?? '';
      case 'contactEmail':
        return this.data.employee.contactEmail ?? '';
      case 'kana':
        return this.data.employee.kana ?? '';
      default:
        return '';
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    const formValue = this.form.getRawValue();
    const currentUserId = await firstValueFrom(
      this.currentUser.profile$.pipe(map((profile) => profile?.id ?? null))
    );

    if (!currentUserId) {
      throw new Error('ユーザーIDが取得できませんでした');
    }

    const currentValue = this.getCurrentValue(
      formValue.field as typeof formValue.field
    );

    await this.changeRequestsService.create(this.data.officeId, {
      employeeId: this.data.employee.id,
      requestedByUserId: currentUserId,
      kind: 'profile',
      field: formValue.field as typeof formValue.field,
      currentValue,
      requestedValue: formValue.requestedValue ?? ''
    });

    this.dialogRef.close(true);
  }
}
