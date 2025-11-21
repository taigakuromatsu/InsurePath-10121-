import { NgFor, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { HealthRateTable, Office, StandardRewardBand } from '../../types';
import { PREFECTURE_CODES, getKyokaiHealthRatePreset, STANDARD_REWARD_BANDS_BASE } from '../../utils/kyokai-presets';

export interface HealthMasterDialogData {
  office: Office;
  table?: HealthRateTable;
}

@Component({
  selector: 'ip-health-master-form-dialog',
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
    <h1 mat-dialog-title>{{ data.table ? '健康保険マスタを編集' : '健康保険マスタを作成' }}</h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>年度</mat-label>
          <input matInput type="number" formControlName="year" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>プラン種別</mat-label>
          <mat-select formControlName="planType">
            <mat-option value="kyokai">協会けんぽ</mat-option>
            <mat-option value="kumiai">組合健保</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <ng-container *ngIf="form.get('planType')?.value === 'kyokai'; else kumiaiFields">
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>都道府県</mat-label>
            <mat-select formControlName="kyokaiPrefCode" (selectionChange)="onPrefChange($event.value)">
              <mat-option *ngFor="let code of prefCodes" [value]="code">{{ prefectureName(code) }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>都道府県名</mat-label>
            <input matInput formControlName="kyokaiPrefName" readonly />
          </mat-form-field>
        </div>
      </ng-container>
      <ng-template #kumiaiFields>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>組合名</mat-label>
            <input matInput formControlName="unionName" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>組合コード</mat-label>
            <input matInput formControlName="unionCode" />
          </mat-form-field>
        </div>
      </ng-template>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>健康保険料率（合計）</mat-label>
        <input matInput type="number" formControlName="healthRate" step="0.0001" />
      </mat-form-field>

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
            プリセットを読み込む
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

      .full-width {
        width: 100%;
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
export class HealthMasterFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<HealthMasterFormDialogComponent>);

  readonly prefCodes = Object.keys(PREFECTURE_CODES);

  readonly form = this.fb.group({
    year: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
    planType: ['kyokai', Validators.required],
    kyokaiPrefCode: [''],
    kyokaiPrefName: [''],
    unionName: [''],
    unionCode: [''],
    healthRate: [0, [Validators.required, Validators.min(0), Validators.max(1)]],
    bands: this.fb.array([] as any[])
  });

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: HealthMasterDialogData) {
    const table = data.table;
    if (table) {
      this.form.patchValue({
        year: table.year,
        planType: table.planType,
        kyokaiPrefCode: table.kyokaiPrefCode,
        kyokaiPrefName: table.kyokaiPrefName,
        unionName: table.unionName,
        unionCode: table.unionCode,
        healthRate: table.healthRate
      });
      table.bands?.forEach((band) => this.addBand(band));
    } else {
      const planType = data.office.healthPlanType ?? 'kyokai';
      this.form.patchValue({
        planType,
        kyokaiPrefCode: data.office.kyokaiPrefCode,
        kyokaiPrefName: data.office.kyokaiPrefName
      });
      STANDARD_REWARD_BANDS_BASE.forEach((band) => this.addBand(band));
    }
  }

  get bands(): FormArray {
    return this.form.get('bands') as FormArray;
  }

  prefectureName(code: string): string {
    return PREFECTURE_CODES[code] ?? code;
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

  onPrefChange(code: string): void {
    this.form.patchValue({ kyokaiPrefName: this.prefectureName(code) });
  }

  loadPreset(): void {
    const prefCode = this.form.get('kyokaiPrefCode')?.value || this.data.office.kyokaiPrefCode || '13';
    const year = this.form.get('year')?.value ?? new Date().getFullYear();
    const preset = getKyokaiHealthRatePreset(prefCode as string, Number(year));
    this.form.patchValue({
      planType: 'kyokai',
      kyokaiPrefCode: prefCode,
      kyokaiPrefName: this.prefectureName(prefCode as string),
      healthRate: preset.healthRate
    });

    this.bands.clear();
    (preset.bands ?? STANDARD_REWARD_BANDS_BASE).forEach((band) => this.addBand(band));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload: Partial<HealthRateTable> = {
      ...this.form.value,
      bands: this.bands.value as StandardRewardBand[],
      id: this.data.table?.id
    } as Partial<HealthRateTable>;
    if (payload.planType === 'kyokai') {
      payload.unionCode = undefined;
      payload.unionName = undefined;
    } else {
      payload.kyokaiPrefCode = undefined;
      payload.kyokaiPrefName = undefined;
    }
    this.dialogRef.close(payload);
  }
}
