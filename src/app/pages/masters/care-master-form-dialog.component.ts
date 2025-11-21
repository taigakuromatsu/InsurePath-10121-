import { NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { CareRateTable } from '../../types';
import { getCareRatePreset } from '../../utils/kyokai-presets';


export interface CareMasterDialogData {
  table?: CareRateTable;
}

@Component({
  selector: 'ip-care-master-form-dialog',
  standalone: true,
  imports: [MatDialogModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, NgIf],
  template: `
    <h1 mat-dialog-title>
      <mat-icon>{{ data.table ? 'edit' : 'add' }}</mat-icon>
      {{ data.table ? '介護保険マスタを編集' : '介護保険マスタを作成' }}
    </h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <div class="form-section">
        <h3 class="section-title">基本情報</h3>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>年度</mat-label>
            <input matInput type="number" formControlName="year" required />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>介護保険料率（合計）</mat-label>
            <input matInput type="number" formControlName="careRate" step="0.0001" />
            <mat-hint>例: 0.0191 (1.91%)</mat-hint>
          </mat-form-field>
        </div>

        <div class="actions" *ngIf="!data.table">
          <button mat-stroked-button color="accent" type="button" (click)="loadPreset()">
            <mat-icon>download</mat-icon>
            初期値を読み込む
          </button>
        </div>
      </div>
    </form>

    <div mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close>
        <mat-icon>close</mat-icon>
        キャンセル
      </button>
      <button mat-raised-button color="primary" (click)="submit()" [disabled]="form.invalid">
        <mat-icon>save</mat-icon>
        保存
      </button>
    </div>
  `,
  styles: [
    `
      h1[mat-dialog-title] {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid #e0e0e0;
      }

      h1[mat-dialog-title] mat-icon {
        color: #667eea;
      }

      form[mat-dialog-content] {
        padding: 1.5rem;
      }

      .form-section {
        margin-bottom: 0;
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

      .form-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .actions {
        margin-top: 1rem;
        display: flex;
        justify-content: flex-end;
      }

      .dialog-actions {
        padding: 1rem 1.5rem;
        border-top: 1px solid #e0e0e0;
        background: #fafafa;
      }

      .dialog-actions button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      button[mat-raised-button],
      button[mat-stroked-button] {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
      }

      button[mat-raised-button]:hover:not(:disabled),
      button[mat-stroked-button]:hover:not(:disabled) {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
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
