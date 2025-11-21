import { NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { CareRateTable } from '../../types';
import { getCareRatePreset } from '../../utils/kyokai-presets';


export interface CareMasterDialogData {
  table?: CareRateTable;
}

@Component({
  selector: 'ip-care-master-form-dialog',
  standalone: true,
  imports: [MatDialogModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, NgIf],
  template: `
    <h1 mat-dialog-title>{{ data.table ? '介護保険マスタを編集' : '介護保険マスタを作成' }}</h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <mat-form-field appearance="outline">
        <mat-label>年度</mat-label>
        <input matInput type="number" formControlName="year" required />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>介護保険料率（合計）</mat-label>
        <input matInput type="number" formControlName="careRate" step="0.0001" />
      </mat-form-field>

      <div class="actions" *ngIf="!data.table">
        <button mat-stroked-button color="accent" type="button" (click)="loadPreset()">
          初期値を読み込む
        </button>
      </div>
    </form>

    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>キャンセル</button>
      <button mat-raised-button color="primary" (click)="submit()" [disabled]="form.invalid">保存</button>
    </div>
  `,
  styles: [
    `
      .actions {
        margin-top: 0.5rem;
      }
    `
  ]
})
export class CareMasterFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<CareMasterFormDialogComponent>);

  readonly form = this.fb.group({
    year: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
    careRate: [0, [Validators.required, Validators.min(0), Validators.max(1)]]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: CareMasterDialogData) {
    if (data.table) {
      this.form.patchValue({
        year: data.table.year,
        careRate: data.table.careRate
      });
    }
  }

  loadPreset(): void {
    const year = this.form.get('year')?.value ?? new Date().getFullYear();
    const preset = getCareRatePreset(Number(year));
    this.form.patchValue({
      careRate: preset.careRate
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload: Partial<CareRateTable> = {
      ...this.form.value,
      id: this.data.table?.id
    } as Partial<CareRateTable>;
    this.dialogRef.close(payload);
  }
}
