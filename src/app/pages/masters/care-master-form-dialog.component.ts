import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgFor } from '@angular/common';

import { CareRateTable } from '../../types';
import { CloudMasterService } from '../../services/cloud-master.service';
import { getCareRatePreset } from '../../utils/kyokai-presets';


export interface CareMasterDialogData {
  table?: CareRateTable;
}

@Component({
  selector: 'ip-care-master-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    NgFor
  ],
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
        <mat-label>介護保険料率（合計）</mat-label>
        <input matInput type="number" formControlName="careRate" step="0.0001" />
            <mat-hint>例: 0.0191 (1.91%)</mat-hint>
      </mat-form-field>
        </div>
        <div class="help-text">
          <p>
            例）2025年3月分から改定される場合：<br>
            「適用開始年」= 2025、「適用開始月」= 3 を選択してください。<br>
            その前の月（〜2月分）は、前回登録した料率が自動的に使われます。
          </p>
        </div>

      <div class="actions">
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
  private readonly cloudMasterService = inject(CloudMasterService);

  readonly form = this.fb.group({
    effectiveYear: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
    effectiveMonth: [3, [Validators.required, Validators.min(1), Validators.max(12)]],
    careRate: [0, [Validators.required, Validators.min(0), Validators.max(1)]]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: CareMasterDialogData) {
    const now = new Date();
    const defaultYear = now.getFullYear();
    const defaultMonth = 3; // デフォルトは3月

    if (data.table) {
      this.form.patchValue({
        effectiveYear: data.table.effectiveYear,
        effectiveMonth: data.table.effectiveMonth,
        careRate: data.table.careRate
      });
    } else {
      // 新規作成時: クラウドマスタから自動取得
      // 対象月は「現在の年月」を使用（現在有効なマスタを取得）
      this.form.patchValue({
        effectiveYear: defaultYear,
        effectiveMonth: defaultMonth
      });
      this.loadPresetFromCloud(defaultYear, now.getMonth() + 1);
    }
  }
  
  private async loadPresetFromCloud(targetYear: number, targetMonth: number): Promise<void> {
    try {
      const preset = await this.cloudMasterService.getCareRatePresetFromCloud(targetYear, targetMonth);
      if (preset) {
        this.form.patchValue({
          careRate: preset.careRate
        });
      } else {
        // フォールバック: ハードコードされたデータを使用（年度ベースのフォールバック）
        const fallbackPreset = getCareRatePreset(targetYear);
        this.form.patchValue({
          careRate: fallbackPreset.careRate
        });
      }
    } catch (error) {
      console.error('クラウドマスタからの取得に失敗しました', error);
      // フォールバック: ハードコードされたデータを使用
      const fallbackPreset = getCareRatePreset(targetYear);
      this.form.patchValue({
        careRate: fallbackPreset.careRate
      });
    }
  }

  async loadPreset(): Promise<void> {
    // フォーム値がstringでも安全に処理するため、明示的に数値化
    const effectiveYear = Number(this.form.get('effectiveYear')?.value ?? new Date().getFullYear());
    const effectiveMonth = Number(this.form.get('effectiveMonth')?.value ?? 3);
    await this.loadPresetFromCloud(effectiveYear, effectiveMonth);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const effectiveYear = this.form.value.effectiveYear!;
    const effectiveMonth = this.form.value.effectiveMonth!;
    const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;

    const payload: Partial<CareRateTable> = {
      ...this.form.value,
      effectiveYearMonth,
      id: this.data.table?.id
    } as Partial<CareRateTable>;
    this.dialogRef.close(payload);
  }
}
