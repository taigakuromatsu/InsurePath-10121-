import { NgFor, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PensionRateTable, StandardRewardBand, Office } from '../../types';
import { CloudMasterService } from '../../services/cloud-master.service';
import { PENSION_STANDARD_REWARD_BANDS_DEFAULT, getPensionRatePreset } from '../../utils/kyokai-presets';
import { MastersService } from '../../services/masters.service';

export interface PensionMasterDialogData {
  office: Office;
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
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    NgIf,
    NgFor
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon class="mr-2">{{ data.table ? 'edit' : 'add' }}</mat-icon>
      {{ data.table ? '厚生年金マスタを編集' : '厚生年金マスタを作成' }}
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
          <mat-label>厚生年金料率（合計）</mat-label>
          <input matInput type="number" formControlName="pensionRate" step="0.0001" />
            <mat-hint>例: 0.183 (18.3%)</mat-hint>
        </mat-form-field>
        </div>
        
        <div class="screen-rules mb-3">
          <p>
            <strong>設定ヒント:</strong><br>
            例）2025年3月分から改定される場合：「適用開始年」= 2025、「適用開始月」= 3。<br>
            その前の月（〜2月分）は、前回登録した料率が自動的に使われます。<br>
            例）適用開始年月2024年3月で0.082と設定し、適用開始年月2025年3月に0.09と設定した場合、2024年3月〜2025年2月は0.082、2025年3月以降以降は0.09となります。
            <br>
            そのため現状、厚生年金においては適用開始年月2017年9月で0.183と1つだけ設定することをおすすめします。
            <br>
            <strong>料率読み込みについて:</strong><br>
            2023年3月改定分・2024年3月改定分・2025年3月改定分のプリセットが設定済みです。<br>
            2023年3月〜2025年3月の期間は該当する改定分のプリセットが読み込めます。<br>
            2023年3月より前の期間は正しく読み込めないためユーザーが入力して設定してください。2025年3月より後の期間は2025年3月改定分が読み込まれます。
          </p>
        </div>
      </div>

      <div class="form-section">
        <div class="flex-row justify-between align-center mb-2">
          <h3 class="mat-h3 m-0 flex-row align-center gap-2">
            <mat-icon color="primary">list</mat-icon> 標準報酬等級表（{{ bands.length }}件）
          </h3>
          <div class="flex-row gap-2">
            <button mat-stroked-button color="primary" type="button" (click)="loadPreset()"
                    matTooltip="適用開始年月から現在の日本年金機構の料率を読み込む">
              <mat-icon>download</mat-icon>
              料率読み込み
            </button>
            <button mat-flat-button color="primary" type="button" (click)="addBand()">
            <mat-icon>add</mat-icon>
              行を追加
          </button>
        </div>
      </div>

        <div class="editable-table-container" *ngIf="bands.length > 0">
          <div class="editable-table-header">
            <div class="col col-index">#</div>
            <div class="col col-grade">等級</div>
            <div class="col col-currency">下限</div>
            <div class="col col-separator"></div>
            <div class="col col-currency">上限</div>
            <div class="col col-currency">標準報酬</div>
            <div class="col col-action"></div>
          </div>
          
          <div class="editable-table-body" formArrayName="bands">
            <div class="editable-table-row" *ngFor="let band of bands.controls; let i = index" [formGroupName]="i">
              <div class="col col-index">{{ i + 1 }}</div>
              <div class="col col-grade">
                <mat-form-field appearance="outline" class="no-subscript">
                  <input matInput type="number" formControlName="grade" placeholder="等級" />
          </mat-form-field>
              </div>
              <div class="col col-currency">
                <mat-form-field appearance="outline" class="no-subscript">
                  <input matInput type="number" formControlName="lowerLimit" placeholder="下限" />
          </mat-form-field>
              </div>
              <div class="col col-separator">~</div>
              <div class="col col-currency">
                <mat-form-field appearance="outline" class="no-subscript">
                  <input matInput type="number" formControlName="upperLimit" placeholder="上限" />
          </mat-form-field>
              </div>
              <div class="col col-currency">
                <mat-form-field appearance="outline" class="no-subscript">
                  <input matInput type="number" formControlName="standardMonthly" placeholder="標準報酬" />
          </mat-form-field>
              </div>
              <div class="col col-action">
                <button mat-icon-button color="warn" type="button" (click)="removeBand(i)" matTooltip="削除">
            <mat-icon>delete</mat-icon>
          </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="empty-state-simple" *ngIf="bands.length === 0">
          <mat-icon>list</mat-icon>
          <p>等級が登録されていません。「追加」ボタンで登録してください。</p>
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
      .m-0 { margin: 0; }
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

      // テーブル内のフォームフィールド微調整
      ::ng-deep .editable-table-row .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
      
      ::ng-deep .editable-table-row .mat-mdc-text-field-wrapper {
        padding-left: 8px;
        padding-right: 8px;
      }
    `
  ]
})
export class PensionMasterFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<PensionMasterFormDialogComponent>);
  private readonly cloudMasterService = inject(CloudMasterService);
  private readonly mastersService = inject(MastersService);

  readonly form = this.fb.group({
    effectiveYear: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
    effectiveMonth: [3, [Validators.required, Validators.min(1), Validators.max(12)]],
    pensionRate: [0, [Validators.required, Validators.min(0), Validators.max(1)]],
    bands: this.fb.array([] as any[])
  });

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: PensionMasterDialogData) {
    const now = new Date();
    const defaultYear = now.getFullYear();
    const defaultMonth = 3; // デフォルトは3月

    if (data.table) {
      this.form.patchValue({
        effectiveYear: data.table.effectiveYear,
        effectiveMonth: data.table.effectiveMonth,
        pensionRate: data.table.pensionRate
      });
      data.table.bands?.forEach((band) => this.addBand(band));
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
      const preset = await this.cloudMasterService.getPensionRatePresetFromCloud(targetYear, targetMonth);
      if (preset) {
        this.form.patchValue({
          pensionRate: preset.pensionRate
        });
        this.bands.clear();
        (preset.bands ?? PENSION_STANDARD_REWARD_BANDS_DEFAULT).forEach((band) => this.addBand(band));
      } else {
        // フォールバック: ハードコードされたデータを使用（年度ベースのフォールバック）
        const fallbackPreset = getPensionRatePreset(targetYear);
        this.form.patchValue({
          pensionRate: fallbackPreset.pensionRate
        });
        this.bands.clear();
        (fallbackPreset.bands ?? PENSION_STANDARD_REWARD_BANDS_DEFAULT).forEach((band) => this.addBand(band));
      }
    } catch (error) {
      console.error('クラウドマスタからの取得に失敗しました', error);
      // フォールバック: ハードコードされたデータを使用
      const fallbackPreset = getPensionRatePreset(targetYear);
      this.form.patchValue({
        pensionRate: fallbackPreset.pensionRate
      });
      this.bands.clear();
      (fallbackPreset.bands ?? PENSION_STANDARD_REWARD_BANDS_DEFAULT).forEach((band) => this.addBand(band));
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

    const existing = await this.mastersService.checkPensionRateTableDuplicate(
      this.data.office.id,
      effectiveYearMonth,
      this.data.table?.id
    );

    if (existing && existing.id !== this.data.table?.id) {
      const confirmed = confirm(
        `${effectiveYear}年${effectiveMonth}月分の厚生年金マスタが既に登録されています。\n` +
          `上書き保存しますか？\n\n` +
          `既存の料率: ${(existing.pensionRate * 100).toFixed(2)}%`
      );

      if (!confirmed) {
        return;
      }

      const payload: Partial<PensionRateTable> = {
        effectiveYear,
        effectiveMonth,
        pensionRate: Number(this.form.value.pensionRate ?? 0),
        bands: this.bands.value as StandardRewardBand[],
        effectiveYearMonth,
        id: existing.id
      };

      this.dialogRef.close(payload);
      return;
    }

    const payload: Partial<PensionRateTable> = {
      effectiveYear,
      effectiveMonth,
      pensionRate: Number(this.form.value.pensionRate ?? 0),
      bands: this.bands.value as StandardRewardBand[],
      effectiveYearMonth,
      id: this.data.table?.id
    };

    this.dialogRef.close(payload);
  }
}
