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

      <mat-slide-toggle formControlName="isInsured">社会保険対象</mat-slide-toggle>

      <mat-form-field appearance="outline">
        <mat-label>健康保険 等級</mat-label>
        <input matInput type="number" formControlName="healthGrade" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>厚生年金 等級</mat-label>
        <input matInput type="number" formControlName="pensionGrade" />
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
      mat-slide-toggle {
        grid-column: 1 / -1;
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
    monthlyWage: [0, Validators.required],
    isInsured: [true],
    healthGrade: [null],
    pensionGrade: [null]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: EmployeeDialogData) {
    if (data.employee) {
      const employee = data.employee;
      this.form.patchValue({
        ...employee,
        healthGrade: employee.healthGrade ?? null,
        pensionGrade: employee.pensionGrade ?? null
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
