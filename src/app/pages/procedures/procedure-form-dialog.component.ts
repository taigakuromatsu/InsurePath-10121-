import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom, map, of, startWith, switchMap } from 'rxjs';

import { DependentsService } from '../../services/dependents.service';
import { EmployeesService } from '../../services/employees.service';
import { ProceduresService } from '../../services/procedures.service';
import { CurrentUserService } from '../../services/current-user.service';
import { Dependent, ProcedureStatus, ProcedureType, SocialInsuranceProcedure } from '../../types';
import { calculateDeadline } from '../../utils/procedure-deadline-calculator';

export interface ProcedureFormDialogData {
  procedure?: SocialInsuranceProcedure;
  officeId: string;
}

@Component({
  selector: 'ip-procedure-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    NgIf,
    NgFor,
    AsyncPipe
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon>{{ data.procedure ? 'edit' : 'post_add' }}</mat-icon>
      {{ data.procedure ? '手続きを編集' : '手続きを登録' }}
    </h1>

    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <div class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>手続き種別</mat-label>
          <mat-select formControlName="procedureType" (selectionChange)="onProcedureTypeChange()">
            <mat-option value="qualification_acquisition">資格取得届</mat-option>
            <mat-option value="qualification_loss">資格喪失届</mat-option>
            <mat-option value="standard_reward">算定基礎届</mat-option>
            <mat-option value="monthly_change">月額変更届</mat-option>
            <mat-option value="dependent_change">被扶養者異動届</mat-option>
            <mat-option value="bonus_payment">賞与支払届</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>対象従業員</mat-label>
          <mat-select formControlName="employeeId">
            <mat-option *ngFor="let employee of employees$ | async" [value]="employee.id">
              {{ employee.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field
          appearance="outline"
          *ngIf="form.get('procedureType')?.value === 'dependent_change'"
        >
          <mat-label>対象被扶養者</mat-label>
          <mat-select formControlName="dependentId">
            <mat-option *ngFor="let dependent of dependents$ | async" [value]="dependent.id">
              {{ dependent.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>事由発生日</mat-label>
          <input matInput type="date" formControlName="incidentDate" (change)="onIncidentDateChange()" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>提出期限</mat-label>
          <input matInput type="date" formControlName="deadline" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>ステータス</mat-label>
          <mat-select formControlName="status" (selectionChange)="onStatusChange()">
            <mat-option value="not_started">未着手</mat-option>
            <mat-option value="in_progress">準備中</mat-option>
            <mat-option value="submitted">提出済</mat-option>
            <mat-option value="rejected">差戻し</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" *ngIf="form.get('status')?.value === 'submitted'">
          <mat-label>提出日</mat-label>
          <input matInput type="date" formControlName="submittedAt" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>担当者</mat-label>
          <input matInput formControlName="assignedPersonName" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>備考</mat-label>
          <textarea matInput formControlName="note" rows="3" maxlength="500"></textarea>
        </mat-form-field>
      </div>
    </form>

    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">キャンセル</button>
      <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid" (click)="submit()">
        保存
      </button>
    </div>
  `,
  styles: [
    `
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
      }

      .full-width {
        grid-column: 1 / -1;
      }
    `
  ]
})
export class ProcedureFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ProcedureFormDialogComponent>);
  private readonly proceduresService = inject(ProceduresService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly employeesService = inject(EmployeesService);
  private readonly dependentsService = inject(DependentsService);

  readonly data = inject<ProcedureFormDialogData>(MAT_DIALOG_DATA);

  readonly employees$ = this.employeesService.list(this.data.officeId);

  readonly dependents$ = this.form.get('employeeId')!.valueChanges.pipe(
    startWith(this.data.procedure?.employeeId ?? ''),
    switchMap((employeeId) => {
      if (!employeeId) {
        return of<Dependent[]>([]);
      }
      return this.dependentsService.list(this.data.officeId, employeeId);
    })
  );

  form = this.fb.group({
    procedureType: [this.data.procedure?.procedureType ?? '', Validators.required],
    employeeId: [this.data.procedure?.employeeId ?? '', Validators.required],
    dependentId: [this.data.procedure?.dependentId ?? ''],
    incidentDate: [this.data.procedure?.incidentDate ?? '', Validators.required],
    deadline: [this.data.procedure?.deadline ?? '', Validators.required],
    status: [this.data.procedure?.status ?? 'not_started', Validators.required],
    submittedAt: [this.data.procedure?.submittedAt ?? ''],
    assignedPersonName: [this.data.procedure?.assignedPersonName ?? ''],
    note: [this.data.procedure?.note ?? '']
  });

  constructor() {
    this.onProcedureTypeChange();
    this.onStatusChange();
  }

  onIncidentDateChange(): void {
    const incidentDate = this.form.get('incidentDate')?.value;
    const procedureType = this.form.get('procedureType')?.value as ProcedureType | null;

    if (incidentDate && procedureType) {
      const deadline = calculateDeadline(procedureType, incidentDate);
      this.form.patchValue({ deadline });
    }
  }

  onProcedureTypeChange(): void {
    const incidentDate = this.form.get('incidentDate')?.value;
    const procedureType = this.form.get('procedureType')?.value as ProcedureType | null;

    if (incidentDate && procedureType) {
      const deadline = calculateDeadline(procedureType, incidentDate);
      this.form.patchValue({ deadline });
    }

    if (procedureType === 'dependent_change') {
      this.form.get('dependentId')?.setValidators([Validators.required]);
    } else {
      this.form.get('dependentId')?.clearValidators();
      this.form.get('dependentId')?.setValue('');
    }
    this.form.get('dependentId')?.updateValueAndValidity();
  }

  onStatusChange(): void {
    const status = this.form.get('status')?.value as ProcedureStatus | null;
    if (status === 'submitted') {
      this.form.get('submittedAt')?.setValidators([Validators.required]);
    } else {
      this.form.get('submittedAt')?.clearValidators();
      this.form.get('submittedAt')?.setValue('');
    }
    this.form.get('submittedAt')?.updateValueAndValidity();
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

    if (this.data.procedure) {
      await this.proceduresService.update(
        this.data.officeId,
        this.data.procedure.id,
        {
          procedureType: formValue.procedureType as ProcedureType,
          employeeId: formValue.employeeId,
          dependentId: formValue.dependentId || undefined,
          incidentDate: formValue.incidentDate,
          deadline: formValue.deadline,
          status: formValue.status as ProcedureStatus,
          submittedAt: formValue.submittedAt || undefined,
          assignedPersonName: formValue.assignedPersonName || undefined,
          note: formValue.note || undefined
        },
        currentUserId
      );
    } else {
      await this.proceduresService.create(
        this.data.officeId,
        {
          procedureType: formValue.procedureType as ProcedureType,
          employeeId: formValue.employeeId,
          dependentId: formValue.dependentId || undefined,
          incidentDate: formValue.incidentDate,
          deadline: formValue.deadline,
          status: formValue.status as ProcedureStatus,
          submittedAt: formValue.submittedAt || undefined,
          assignedPersonName: formValue.assignedPersonName || undefined,
          note: formValue.note || undefined
        },
        currentUserId
      );
    }

    this.dialogRef.close(true);
  }
}
