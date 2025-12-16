// src/app/pages/cloud-masters/cloud-health-master-form-dialog.component.ts
import { NgFor, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { CloudHealthRateTable, StandardRewardBand } from '../../types';
import { PREFECTURE_CODES, HEALTH_STANDARD_REWARD_BANDS_DEFAULT } from '../../utils/kyokai-presets';

export interface CloudHealthMasterDialogData {
  table?: CloudHealthRateTable;
}

@Component({
  selector: 'ip-cloud-health-master-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    NgIf,
    NgFor
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon>{{ data.table ? 'edit' : 'add' }}</mat-icon>
      {{ data.table ? '健康保険クラウドマスタを編集' : '健康保険クラウドマスタを作成' }}
    </h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <div class="form-section">
        <h3 class="section-title">基本情報</h3>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>適用開始年</mat-label>
            <input matInput type="number" formControlName="effectiveYear" required />
            <mat-hint>何年分からの料率か</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>適用開始月</mat-label>
            <mat-select formControlName="effectiveMonth" required>
              <mat-option *ngFor="let month of [1,2,3,4,5,6,7,8,9,10,11,12]" [value]="month">
                {{ month }}月
              </mat-option>
            </mat-select>
            <mat-hint>何月分からの料率か</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>都道府県</mat-label>
            <mat-select formControlName="kyokaiPrefCode" (selectionChange)="onPrefChange($event.value)">
              <mat-option *ngFor="let code of prefCodes" [value]="code">{{ prefectureName(code) }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <div class="help-text">
          <p>
            例）2025年3月分から改定される場合：<br>
            「適用開始年」= 2025、「適用開始月」= 3 を選択してください。<br>
            その前の月（〜2月分）は、前回登録した料率が自動的に使われます。
          </p>
          <p>
            協会けんぽの案内で「3月分（4月納付）から改定」と書かれている場合、<br>
            「3月分」の月（3）を選んでください。
          </p>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>ラベル（任意）</mat-label>
          <input matInput formControlName="label" placeholder="例: 令和7年度" />
        </mat-form-field>
      </div>

      <div class="form-section">
        <h3 class="section-title">料率情報</h3>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>健康保険料率（合計）</mat-label>
          <input matInput type="number" formControlName="healthRate" step="0.0001" />
          <mat-hint>例: 0.0991 (9.91%)</mat-hint>
        </mat-form-field>
      </div>

      <div class="form-section">
        <div class="bands-header">
          <h3 class="section-title">
            <mat-icon>list</mat-icon>
            標準報酬等級表（{{ bands.length }}件）
          </h3>
          <div class="band-actions">
            <button mat-raised-button color="primary" type="button" (click)="addBand()">
              <mat-icon>add</mat-icon>
              等級を追加
            </button>
          </div>
        </div>

        <div class="bands" formArrayName="bands">
          <div class="band-row" *ngFor="let band of bands.controls; let i = index" [formGroupName]="i">
            <div class="band-number">{{ i + 1 }}</div>
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
              <mat-hint *ngIf="isUnlimitedUpperLimit(i)" class="unlimited-hint">上限なし</mat-hint>
            </mat-form-field>
            <div class="unlimited-checkbox" *ngIf="isMaxGrade(i)">
              <mat-checkbox formControlName="unlimitedUpperLimit" 
                            (change)="onUnlimitedChange(i, $event)">
                上限なし
              </mat-checkbox>
            </div>
            <div class="unlimited-checkbox" *ngIf="!isMaxGrade(i)"></div>
            <mat-form-field appearance="outline">
              <mat-label>標準報酬月額</mat-label>
              <input matInput type="number" formControlName="standardMonthly" />
            </mat-form-field>
            <button mat-icon-button color="warn" type="button" (click)="removeBand(i)" title="削除">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
          <div class="bands-empty" *ngIf="bands.length === 0">
            <mat-icon>info</mat-icon>
            <p>等級が登録されていません。「等級を追加」ボタンで追加してください。</p>
          </div>
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
        max-height: 70vh;
        overflow-y: auto;
        padding: 1.5rem;
      }

      .form-section {
        margin-bottom: 2rem;
      }

      .form-section:last-child {
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

      .section-title mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #667eea;
      }

      .form-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .full-width {
        width: 100%;
        margin-top: 1rem;
      }

      .help-text {
        margin-top: 1rem;
        padding: 1rem;
        background: #f5f5f5;
        border-radius: 8px;
        border-left: 4px solid #667eea;
      }

      .help-text p {
        margin: 0.5rem 0;
        font-size: 0.875rem;
        color: #666;
        line-height: 1.6;
      }

      .help-text p:first-child {
        margin-top: 0;
      }

      .help-text p:last-child {
        margin-bottom: 0;
      }

      .bands-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }

      .band-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .bands {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
        max-height: 400px;
        overflow-y: auto;
        padding: 0.5rem;
        background: #fafafa;
        border-radius: 8px;
      }

      .band-row {
        display: grid;
        grid-template-columns: 40px repeat(auto-fit, minmax(140px, 1fr)) 100px auto;
        gap: 0.75rem;
        align-items: center;
        padding: 0.75rem;
        background: white;
        border-radius: 6px;
        border: 1px solid #e0e0e0;
        transition: all 0.2s ease;
      }
      
      .unlimited-checkbox {
        display: flex;
        align-items: center;
        padding: 0 8px;
      }
      
      .unlimited-hint {
        color: #666;
        font-size: 12px;
      }

      .band-row:hover {
        border-color: #667eea;
        box-shadow: 0 2px 4px rgba(102, 126, 234, 0.1);
      }

      .band-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: #667eea;
        color: white;
        border-radius: 50%;
        font-weight: 600;
        font-size: 0.875rem;
      }

      .bands-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3rem 1rem;
        text-align: center;
        color: #999;
        background: white;
        border-radius: 8px;
        border: 2px dashed #e0e0e0;
      }

      .bands-empty mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 0.5rem;
        opacity: 0.5;
      }

      .bands-empty p {
        margin: 0;
        font-size: 0.95rem;
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

      button[mat-raised-button] {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
      }

      button[mat-raised-button]:hover:not(:disabled) {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
      }

      button[mat-icon-button] {
        transition: all 0.2s ease;
      }

      button[mat-icon-button]:hover {
        transform: scale(1.1);
      }
    `
  ]
})
export class CloudHealthMasterFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<CloudHealthMasterFormDialogComponent>);

  readonly prefCodes = Object.keys(PREFECTURE_CODES);
  readonly form: ReturnType<FormBuilder['group']>;

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: CloudHealthMasterDialogData) {
    const table = data.table;
    const now = new Date();
    const defaultYear = now.getFullYear();
    const defaultMonth = 3; // デフォルトは3月

    this.form = this.fb.group({
      effectiveYear: [
        table?.effectiveYear ?? defaultYear,
        [Validators.required, Validators.min(2000)]
      ],
      effectiveMonth: [
        table?.effectiveMonth ?? defaultMonth,
        [Validators.required, Validators.min(1), Validators.max(12)]
      ],
      planType: ['kyokai', Validators.required],
      kyokaiPrefCode: [table?.kyokaiPrefCode ?? '', Validators.required],
      kyokaiPrefName: [table?.kyokaiPrefName ?? '', Validators.required],
      healthRate: [
        table?.healthRate ?? 0,
        [Validators.required, Validators.min(0), Validators.max(1)]
      ],
      label: [table?.label ?? ''],
      bands: this.fb.array([] as any[])
    });

    if (table) {
      table.bands?.forEach((band) => this.addBand(band));
    } else {
      // 新規作成時: デフォルトの標準報酬等級を設定
      HEALTH_STANDARD_REWARD_BANDS_DEFAULT.forEach((band) => this.addBand(band));
    }
  }

  get bands(): FormArray {
    return this.form.get('bands') as FormArray;
  }

  prefectureName(code: string): string {
    return PREFECTURE_CODES[code] ?? code;
  }

  addBand(band?: StandardRewardBand): void {
    const upperLimit = band?.upperLimit ?? null;
    const isUnlimited = upperLimit != null && (upperLimit === Infinity || upperLimit >= 999999999);
    const group = this.fb.group({
      grade: [band?.grade ?? null, Validators.required],
      lowerLimit: [band?.lowerLimit ?? null, Validators.required],
      upperLimit: [
        isUnlimited ? null : upperLimit, 
        (control: AbstractControl) => {
          const parent = control.parent;
          if (!parent) return null;
          const isUnlimited = parent.get('unlimitedUpperLimit')?.value === true;
          return isUnlimited ? null : Validators.required(control);
        }
      ],
      standardMonthly: [band?.standardMonthly ?? null, Validators.required],
      unlimitedUpperLimit: [isUnlimited]
    });
    this.bands.push(group);
    
    // 上限なしの場合はupperLimitコントロールをdisable
    const upperLimitCtrl = group.get('upperLimit');
    if (isUnlimited && upperLimitCtrl) {
      upperLimitCtrl.disable({ emitEvent: false });
    }
  }
  
  isUnlimitedUpperLimit(index: number): boolean {
    const band = this.bands.at(index);
    return band?.get('unlimitedUpperLimit')?.value === true;
  }
  
  isMaxGrade(index: number): boolean {
    if (this.bands.length === 0) return false;
    
    const currentGrade = this.bands.at(index)?.get('grade')?.value;
    if (currentGrade == null) return false;
    
    const maxGrade = Math.max(
      ...this.bands.controls
        .map(control => control.get('grade')?.value)
        .filter((grade): grade is number => grade != null)
    );
    
    return currentGrade === maxGrade;
  }
  
  onUnlimitedChange(index: number, event: any): void {
    const band = this.bands.at(index);
    const upperLimitCtrl = band?.get('upperLimit');
    const isUnlimited = event.checked;
    
    if (isUnlimited) {
      // 上限なしON: 値をnullに設定してdisable
      upperLimitCtrl?.setValue(null, { emitEvent: false });
      upperLimitCtrl?.disable({ emitEvent: false });
      upperLimitCtrl?.updateValueAndValidity({ emitEvent: false });
    } else {
      // 上限なしOFF: enableしてバリデーションを有効化
      upperLimitCtrl?.enable({ emitEvent: false });
      upperLimitCtrl?.updateValueAndValidity({ emitEvent: false });
    }
  }

  removeBand(index: number): void {
    this.bands.removeAt(index);
  }

  onPrefChange(code: string): void {
    this.form.patchValue({ kyokaiPrefName: this.prefectureName(code) });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const effectiveYear = this.form.value.effectiveYear!;
    const effectiveMonth = this.form.value.effectiveMonth!;
    const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;

    // getRawValue()を使用してdisabledコントロールの値も取得
    // Infinityを大きな値に変換（FirestoreではInfinityを保存できないため）
    const rawBands = this.bands.getRawValue() as any[];
    const processedBands = rawBands.map(band => ({
      ...band,
      upperLimit: band.unlimitedUpperLimit ? 999999999 : band.upperLimit
    })) as StandardRewardBand[];
    
    const payload: Partial<CloudHealthRateTable> = {
      ...this.form.value,
      bands: processedBands,
      effectiveYearMonth,
      id: this.data.table?.id || `${effectiveYearMonth}_${this.form.value.kyokaiPrefCode}`
    } as Partial<CloudHealthRateTable>;
    this.dialogRef.close(payload);
  }
}

