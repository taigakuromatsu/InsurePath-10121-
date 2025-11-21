import { NgFor, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { PensionRateTable, StandardRewardBand } from '../../types';
import { PENSION_STANDARD_REWARD_BANDS_DEFAULT, STANDARD_REWARD_BANDS_BASE, getPensionRatePreset } from '../../utils/kyokai-presets';

export interface PensionMasterDialogData {
  table?: PensionRateTable;
}

@Component({
  selector: 'ip-pension-master-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    NgIf,
    NgFor
  ],
  template: `
    <h1 mat-dialog-title>{{ data.table ? '厚生年金マスタを編集' : '厚生年金マスタを作成' }}</h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>年度</mat-label>
          <input matInput type="number" formControlName="year" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>厚生年金料率（合計）</mat-label>
          <input matInput type="number" formControlName="pensionRate" step="0.0001" />
        </mat-form-field>
      </div>

      <div class="bands-header">
        <h3>標準報酬等級表（{{ bands.length }}件）</h3>
        <div class="band-actions">
          <button mat-button color="primary" type="button" (click)="addBand()">
            <mat-icon>add</mat-icon>
            等級を追加
          </button>
          <button
            mat-stroked-button
            color="accent"
            type="button"
            *ngIf="!data.table"
            (click)="loadPreset()"
          >
            初期値を読み込む
          </button>
        </div>
      </div>

      <div class="bands" formArrayName="bands">
        <div class="band-row" *ngFor="let band of bands.controls; let i = index" [formGroupName]="i">
          <mat-form-field appearance="outline">
            <mat-label>等級</mat-label>
            <input matInput type="number" formControlName="grade" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>下限</mat-label>
            <input matInput type="number" formControlName="lowerLimit" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>上限</mat-label>
            <input matInput type="number" formControlName="upperLimit" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>標準報酬月額</mat-label>
            <input matInput type="number" formControlName="standardMonthly" />
          </mat-form-field>
          <button mat-icon-button color="warn" type="button" (click)="removeBand(i)">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>
    </form>

    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>キャンセル</button>
      <button mat-raised-button color="primary" (click)="submit()" [disabled]="form.invalid">保存</button>
    </div>
  `,
  styles: [
    `
      .form-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }

      .bands-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-top: 1rem;
      }

      .band-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .bands {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 0.5rem;
      }

      .band-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)) auto;
        gap: 0.5rem;
        align-items: center;
      }
    `
  ]
})
export class PensionMasterFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<PensionMasterFormDialogComponent>);

  readonly form = this.fb.group({
    year: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
    pensionRate: [0, [Validators.required, Validators.min(0), Validators.max(1)]],
    bands: this.fb.array([] as any[])
  });

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: PensionMasterDialogData) {
    if (data.table) {
      this.form.patchValue({
        year: data.table.year,
        pensionRate: data.table.pensionRate
      });
      data.table.bands?.forEach((band) => this.addBand(band));
    } else {
      PENSION_STANDARD_REWARD_BANDS_DEFAULT.forEach((band) => this.addBand(band));
    }
  }

  get bands(): FormArray {
    return this.form.get('bands') as FormArray;
  }

  addBand(band?: StandardRewardBand): void {
    const group = this.fb.group({
      grade: [band?.grade ?? null, Validators.required],
      lowerLimit: [band?.lowerLimit ?? null, Validators.required],
      upperLimit: [band?.upperLimit ?? null, Validators.required],
      standardMonthly: [band?.standardMonthly ?? null, Validators.required]
    });
    this.bands.push(group);
  }

  removeBand(index: number): void {
    this.bands.removeAt(index);
  }

  loadPreset(): void {
    const year = this.form.get('year')?.value ?? new Date().getFullYear();
    const preset = getPensionRatePreset(Number(year));
    this.form.patchValue({
      pensionRate: preset.pensionRate
    });
    this.bands.clear();
    (preset.bands ?? STANDARD_REWARD_BANDS_BASE).forEach((band) => this.addBand(band));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload: Partial<PensionRateTable> = {
      ...this.form.value,
      bands: this.bands.value as StandardRewardBand[],
      id: this.data.table?.id
    } as Partial<PensionRateTable>;
    this.dialogRef.close(payload);
  }
}
