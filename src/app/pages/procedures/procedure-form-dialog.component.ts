import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
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
      <mat-icon class="mr-2">{{ data.procedure ? 'edit' : 'post_add' }}</mat-icon>
      {{ data.procedure ? '手続きを編集' : '手続きを登録' }}
    </h1>

    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content class="dense-form">
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

      <div mat-dialog-actions align="end">
        <button mat-stroked-button mat-dialog-close type="button">キャンセル</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
          保存
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .mr-2 { margin-right: 8px; }
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

  // ✅ 先に form を定義
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

  constructor() {
    // 初期表示時は、既存の値を尊重し、deadline は触らない
    // バリデーションだけを初期化
    const initialType = this.form.get('procedureType')?.value as ProcedureType | null;
    const initialStatus = this.form.get('status')?.value as ProcedureStatus | null;

    this.updateDependentValidators(initialType);
    this.updateSubmittedAtValidators(initialStatus);
  }

  // --- 期限計算：ユーザー操作時のみ呼ぶ ---

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

    // ユーザーが種別を変更したタイミングでのみ deadline を再計算
    if (incidentDate && procedureType) {
      const deadline = calculateDeadline(procedureType, incidentDate);
      this.form.patchValue({ deadline });
    }

    this.updateDependentValidators(procedureType);
  }

  onStatusChange(): void {
    const status = this.form.get('status')?.value as ProcedureStatus | null;
    this.updateSubmittedAtValidators(status);
  }

  // --- バリデーションだけを担当するヘルパー ---

  private updateDependentValidators(procedureType: ProcedureType | null): void {
    const control = this.form.get('dependentId');
    if (!control) return;

    if (procedureType === 'dependent_change') {
      control.setValidators([Validators.required]);
    } else {
      control.clearValidators();
      control.setValue('');
    }
    control.updateValueAndValidity();
  }

  private updateSubmittedAtValidators(status: ProcedureStatus | null): void {
    const control = this.form.get('submittedAt');
    if (!control) return;

    if (status === 'submitted') {
      control.setValidators([Validators.required]);
    } else {
      control.clearValidators();
      control.setValue('');
    }
    control.updateValueAndValidity();
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
          employeeId: formValue.employeeId || '',
          dependentId: formValue.dependentId || '',
          incidentDate: formValue.incidentDate || '',
          deadline: formValue.deadline || '',
          status: formValue.status as ProcedureStatus,
          submittedAt: formValue.submittedAt || '',          
          assignedPersonName: formValue.assignedPersonName || '', 
          note: formValue.note || ''                         
        },
        currentUserId
      );
    } else {
      await this.proceduresService.create(
        this.data.officeId,
        {
          procedureType: formValue.procedureType as ProcedureType,
          employeeId: formValue.employeeId || '',
          dependentId: formValue.dependentId || '',          
          incidentDate: formValue.incidentDate || '',
          deadline: formValue.deadline || '',
          status: formValue.status as ProcedureStatus,
          submittedAt: formValue.submittedAt || '',          
          assignedPersonName: formValue.assignedPersonName || '', 
          note: formValue.note || ''                         
        },
        currentUserId
      );
    }
    

    this.dialogRef.close(true);
  }
}
