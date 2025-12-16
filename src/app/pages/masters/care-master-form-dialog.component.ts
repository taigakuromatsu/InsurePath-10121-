import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgFor } from '@angular/common';

import { CareRateTable, Office } from '../../types';
import { CloudMasterService } from '../../services/cloud-master.service';
import { getCareRatePreset } from '../../utils/kyokai-presets';
import { MastersService } from '../../services/masters.service';


export interface CareMasterDialogData {
  office: Office;
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
    MatTooltipModule,
    NgFor
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon class="mr-2">{{ data.table ? 'edit' : 'add' }}</mat-icon>
      {{ data.table ? '介護保険マスタを編集' : '介護保険マスタを作成' }}
    </h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content class="dense-form">
      <div class="form-section mb-4">
        <h3 class="mat-h3 mb-2 flex-row align-center gap-2">
          <mat-icon color="primary">info</mat-icon> 基本情報
        </h3>
        <div class="form-row flex-row gap-2 flex-wrap">
          <mat-form-field appearance="outline" class="flex-1">
        <mat-label>適用開始年</mat-label>
        <input matInput type="number" formControlName="effectiveYear" required />
            <span matTextSuffix>年</span>
            <mat-hint>例: 2025</mat-hint>
      </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
        <mat-label>適用開始月</mat-label>
        <mat-select formControlName="effectiveMonth" required>
          <mat-option *ngFor="let month of [1,2,3,4,5,6,7,8,9,10,11,12]" [value]="month">
            {{ month }}月
          </mat-option>
        </mat-select>
      </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
        <mat-label>介護保険料率（合計）</mat-label>
        <input matInput type="number" formControlName="careRate" step="0.0001" />
            <mat-hint>例: 0.0191 (1.91%)</mat-hint>
      </mat-form-field>
        </div>
        
        <div class="flex-row justify-end mb-2">
          <button mat-stroked-button color="primary" type="button" (click)="loadPreset()"
                  matTooltip="適用開始年月から現在の協会けんぽの料率を読み込む">
            <mat-icon>download</mat-icon>
            料率読み込み
          </button>
        </div>

        <div class="screen-rules">
          <p>
            <strong>設定ヒント:</strong><br>
            例）2025年3月分から改定される場合：「適用開始年」= 2025、「適用開始月」= 3。<br>
            その前の月（〜2月分）は、前回登録した料率が自動的に使われます。<br><br>
            <strong>料率読み込みについて:</strong><br>
            2023年3月改定分・2024年3月改定分・2025年3月改定分のプリセットが設定済みです。<br>
            2023年3月〜2025年3月の期間は該当する改定分のプリセットが読み込めます。<br>
            2023年3月より前の期間は正しく読み込めないためユーザーが入力して設定してください。2025年3月より後の期間は2025年3月改定分が読み込まれます。
          </p>
        </div>
      </div>
    </form>

    <div mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>キャンセル</button>
      <button mat-flat-button color="primary" (click)="submit()" [disabled]="form.invalid">保存する</button>
    </div>
  `,
  styles: [
    `
      .mr-2 { margin-right: 8px; }
      .flex-1 { flex: 1; }

      .screen-rules {
        padding: 12px;
        background: #f5f7fa;
        border-radius: 4px;
        font-size: 13px;
        color: #666;
        border-left: 3px solid #1a237e;
        
        p { margin: 0; line-height: 1.5; }
      }
    `
  ]
})
export class CareMasterFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<CareMasterFormDialogComponent>);
  private readonly cloudMasterService = inject(CloudMasterService);
  private readonly mastersService = inject(MastersService);

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

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const effectiveYear = Number(this.form.value.effectiveYear!);
    const effectiveMonth = Number(this.form.value.effectiveMonth!);
    const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;

    const existing = await this.mastersService.checkCareRateTableDuplicate(
      this.data.office.id,
      effectiveYearMonth,
      this.data.table?.id
    );

    if (existing && existing.id !== this.data.table?.id) {
      const confirmed = confirm(
        `${effectiveYear}年${effectiveMonth}月分の介護保険マスタが既に登録されています。\n` +
          `上書き保存しますか？\n\n` +
          `既存の料率: ${(existing.careRate * 100).toFixed(2)}%`
      );

      if (!confirmed) {
        return;
      }

      const payload: Partial<CareRateTable> = {
        effectiveYear,
        effectiveMonth,
        careRate: Number(this.form.value.careRate ?? 0),
        effectiveYearMonth,
        id: existing.id
      };
      this.dialogRef.close(payload);
      return;
    }

    const payload: Partial<CareRateTable> = {
      effectiveYear,
      effectiveMonth,
      careRate: Number(this.form.value.careRate ?? 0),
      effectiveYearMonth,
      id: this.data.table?.id
    };

    this.dialogRef.close(payload);
  }
}
