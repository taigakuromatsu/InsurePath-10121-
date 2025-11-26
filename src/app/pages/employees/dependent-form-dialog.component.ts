import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgFor, NgIf } from '@angular/common';

import { Dependent, DependentRelationship } from '../../types';
import { getDependentRelationshipLabel } from '../../utils/label-utils';

export interface DependentFormDialogData {
  officeId: string;
  employeeId: string;
  dependent?: Dependent;
}

@Component({
  selector: 'ip-dependent-form-dialog',
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
    NgFor
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon>{{ data.dependent ? 'edit' : 'person_add' }}</mat-icon>
      {{ data.dependent ? '扶養家族を編集' : '扶養家族を追加' }}
    </h1>

    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>氏名 *</mat-label>
        <input matInput formControlName="name" required />
        <mat-error *ngIf="form.controls.name.hasError('required')">
          氏名を入力してください
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>続柄 *</mat-label>
        <mat-select formControlName="relationship" required>
          <mat-option *ngFor="let relationship of relationships" [value]="relationship">
            {{ getDependentRelationshipLabel(relationship) }}
          </mat-option>
        </mat-select>
        <mat-error *ngIf="form.controls.relationship.hasError('required')">
          続柄を選択してください
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>生年月日 *</mat-label>
        <input matInput formControlName="dateOfBirth" type="date" required />
        <mat-error *ngIf="form.controls.dateOfBirth.hasError('required')">
          生年月日を入力してください
        </mat-error>
        <mat-error *ngIf="form.controls.dateOfBirth.hasError('pattern')">
          YYYY-MM-DD 形式で入力してください
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>資格取得日（任意）</mat-label>
        <input matInput formControlName="qualificationAcquiredDate" type="date" />
        <mat-error *ngIf="form.controls.qualificationAcquiredDate.hasError('pattern')">
          YYYY-MM-DD 形式で入力してください
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>資格喪失日（任意）</mat-label>
        <input matInput formControlName="qualificationLossDate" type="date" />
        <mat-error *ngIf="form.controls.qualificationLossDate.hasError('pattern')">
          YYYY-MM-DD 形式で入力してください
        </mat-error>
      </mat-form-field>
    </form>

    <div mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
        キャンセル
      </button>
      <button mat-flat-button color="primary" (click)="submit()" [disabled]="form.invalid">
        <mat-icon>save</mat-icon>
        保存
      </button>
    </div>
  `,
  styles: [
    `
      .dialog-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding-top: 0.5rem;
      }

      .full-width {
        width: 100%;
      }

      .dialog-actions {
        padding: 1rem 1.5rem 1.5rem;
      }

      .dialog-actions button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
    `
  ]
})
export class DependentFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly relationships: DependentRelationship[] = [
    'spouse',
    'child',
    'parent',
    'grandparent',
    'sibling',
    'other'
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    relationship: ['', Validators.required],
    dateOfBirth: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    qualificationAcquiredDate: ['', Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)],
    qualificationLossDate: ['', Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]
  });

  constructor(
    public readonly dialogRef: MatDialogRef<DependentFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: DependentFormDialogData
  ) {
    if (data.dependent) {
      this.form.patchValue({
        name: data.dependent.name,
        relationship: data.dependent.relationship,
        dateOfBirth: data.dependent.dateOfBirth,
        qualificationAcquiredDate: data.dependent.qualificationAcquiredDate ?? '',
        qualificationLossDate: data.dependent.qualificationLossDate ?? ''
      });
    }
  }

  protected readonly getDependentRelationshipLabel = getDependentRelationshipLabel;

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    const payload: Partial<Dependent> & { id?: string } = {
      id: this.data.dependent?.id,
      name: value.name.trim(),
      relationship: value.relationship as DependentRelationship,
      dateOfBirth: value.dateOfBirth,
      qualificationAcquiredDate: value.qualificationAcquiredDate || undefined,
      qualificationLossDate: value.qualificationLossDate || undefined
    };

    this.dialogRef.close(payload);
  }
}
