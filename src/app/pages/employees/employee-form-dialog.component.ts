import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';

import { Employee } from '../../types';

export interface EmployeeDialogData {
  employee?: Employee;
  officeId: string;
}

@Component({
  selector: 'ip-employee-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule
  ],
  template: `
    <h1 mat-dialog-title>{{ data.employee ? '従業員を編集' : '従業員を追加' }}</h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <p class="section-title">基本情報</p>
      <mat-form-field appearance="outline">
        <mat-label>氏名</mat-label>
        <input matInput formControlName="name" required />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>カナ</mat-label>
        <input matInput formControlName="kana" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>生年月日</mat-label>
        <input matInput formControlName="birthDate" type="date" required />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>所属</mat-label>
        <input matInput formControlName="department" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>入社日</mat-label>
        <input matInput formControlName="hireDate" type="date" required />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>退社日</mat-label>
        <input matInput formControlName="retireDate" type="date" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>住所</mat-label>
        <textarea matInput formControlName="address" rows="2"></textarea>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>電話番号</mat-label>
        <input matInput formControlName="phone" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>連絡先メール</mat-label>
        <input matInput formControlName="contactEmail" type="email" />
      </mat-form-field>

      <p class="section-title">就労条件</p>
      <mat-form-field appearance="outline">
        <mat-label>雇用形態</mat-label>
        <mat-select formControlName="employmentType">
          <mat-option value="regular">正社員</mat-option>
          <mat-option value="contract">契約社員</mat-option>
          <mat-option value="part">パート</mat-option>
          <mat-option value="アルバイト">アルバイト</mat-option>
          <mat-option value="other">その他</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>標準報酬月額（給与）</mat-label>
        <input matInput type="number" formControlName="monthlyWage" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>所定労働時間（週）</mat-label>
        <input matInput type="number" formControlName="weeklyWorkingHours" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>所定労働日数（週）</mat-label>
        <input matInput type="number" formControlName="weeklyWorkingDays" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>雇用契約期間の見込み</mat-label>
        <textarea matInput formControlName="contractPeriodNote" rows="2"></textarea>
      </mat-form-field>

      <mat-slide-toggle formControlName="isStudent">学生</mat-slide-toggle>

      <p class="section-title">社会保険関連</p>
      <mat-slide-toggle formControlName="isInsured">社会保険対象</mat-slide-toggle>

      <mat-form-field appearance="outline">
        <mat-label>健康保険 等級</mat-label>
        <input matInput type="number" formControlName="healthGrade" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>厚生年金 等級</mat-label>
        <input matInput type="number" formControlName="pensionGrade" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>被保険者記号</mat-label>
        <input matInput formControlName="healthInsuredSymbol" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>被保険者番号</mat-label>
        <input matInput formControlName="healthInsuredNumber" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>厚生年金番号</mat-label>
        <input matInput formControlName="pensionNumber" />
      </mat-form-field>
    </form>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>キャンセル</button>
      <button mat-raised-button color="primary" (click)="submit()" [disabled]="form.invalid">
        保存
      </button>
    </div>
  `,
  styles: [
    `
      form {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
      }
      mat-slide-toggle,
      .section-title {
        grid-column: 1 / -1;
      }
      .section-title {
        margin: 8px 0 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #555;
      }
      [mat-dialog-actions] {
        margin-top: 12px;
      }
    `
  ]
})
export class EmployeeFormDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<EmployeeFormDialogComponent>);

  readonly form = inject(FormBuilder).group({
    id: [''],
    name: ['', Validators.required],
    kana: [''],
    birthDate: ['', Validators.required],
    department: [''],
    hireDate: ['', Validators.required],
    retireDate: [''],
    employmentType: ['regular', Validators.required],
    address: [''],
    phone: [''],
    contactEmail: [''],
    weeklyWorkingHours: [null],
    weeklyWorkingDays: [null],
    contractPeriodNote: [''],
    isStudent: [false],
    monthlyWage: [0, Validators.required],
    isInsured: [true],
    healthGrade: [null],
    pensionGrade: [null],
    healthInsuredSymbol: [''],
    healthInsuredNumber: [''],
    pensionNumber: ['']
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: EmployeeDialogData) {
    if (data.employee) {
      const employee = data.employee;
      this.form.patchValue({
        ...employee,
        healthGrade: employee.healthGrade ?? null,
        pensionGrade: employee.pensionGrade ?? null,
        weeklyWorkingHours: employee.weeklyWorkingHours ?? null,
        weeklyWorkingDays: employee.weeklyWorkingDays ?? null
      } as any);
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.value);
  }
}
