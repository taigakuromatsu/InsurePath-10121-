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
import { CloudMasterService } from '../../services/cloud-master.service';
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
    <h1 mat-dialog-title>
      <mat-icon>{{ data.table ? 'edit' : 'add' }}</mat-icon>
      {{ data.table ? '健康保険マスタを編集' : '健康保険マスタを作成' }}
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
          <mat-label>プラン種別</mat-label>
          <mat-select formControlName="planType">
            <mat-option value="kyokai">協会けんぽ</mat-option>
            <mat-option value="kumiai">組合健保</mat-option>
          </mat-select>
        </mat-form-field>
        </div>
        <div class="help-text">
          <p>
            例）2025年3月分から改定される場合：<br>
            「適用開始年」= 2025、「適用開始月」= 3 を選択してください。<br>
            その前の月（〜2月分）は、前回登録した料率が自動的に使われます。
          </p>
          <p *ngIf="form.get('planType')?.value === 'kyokai'">
            協会けんぽの案内で「3月分（4月納付）から改定」と書かれている場合、<br>
            「3月分」の月（3）を選んでください。
          </p>
        </div>
      </div>

      <div class="form-section">
        <h3 class="section-title">プラン詳細</h3>
      <ng-container *ngIf="form.get('planType')?.value === 'kyokai'; else kumiaiFields">
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>都道府県</mat-label>
            <mat-select formControlName="kyokaiPrefCode" (selectionChange)="onPrefChange($event.value)">
              <mat-option *ngFor="let code of prefCodes" [value]="code">{{ prefectureName(code) }}</mat-option>
            </mat-select>
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
            <button mat-stroked-button color="accent" type="button" (click)="loadPreset()">
              <mat-icon>download</mat-icon>
              {{ form.get('planType')?.value === 'kyokai' ? '協会けんぽのプリセットを読み込む' : 'プリセットを読み込む' }}
            </button>
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
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>標準報酬月額</mat-label>
            <input matInput type="number" formControlName="standardMonthly" />
          </mat-form-field>
            <button mat-icon-button color="warn" type="button" (click)="removeBand(i)" title="削除">
            <mat-icon>delete</mat-icon>
          </button>
          </div>
        </div>
        <div class="bands-empty" *ngIf="bands.length === 0">
          <mat-icon>info</mat-icon>
          <p>等級が登録されていません。「等級を追加」ボタンで追加してください。</p>
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
        grid-template-columns: 40px repeat(auto-fit, minmax(140px, 1fr)) auto;
        gap: 0.75rem;
        align-items: center;
        padding: 0.75rem;
        background: white;
        border-radius: 6px;
        border: 1px solid #e0e0e0;
        transition: all 0.2s ease;
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
export class HealthMasterFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<HealthMasterFormDialogComponent>);
  private readonly cloudMasterService = inject(CloudMasterService);

  readonly prefCodes = Object.keys(PREFECTURE_CODES);

  readonly form = this.fb.group({
    effectiveYear: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
    effectiveMonth: [3, [Validators.required, Validators.min(1), Validators.max(12)]],
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
    const now = new Date();
    const defaultYear = now.getFullYear();
    const defaultMonth = 3; // デフォルトは3月

    if (table) {
      this.form.patchValue({
        effectiveYear: table.effectiveYear,
        effectiveMonth: table.effectiveMonth,
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
        effectiveYear: defaultYear,
        effectiveMonth: defaultMonth,
        kyokaiPrefCode: data.office.kyokaiPrefCode,
        kyokaiPrefName: data.office.kyokaiPrefName
      });
      
      // 新規作成時: プラン種別が'kyokai'で都道府県コードが設定されている場合、クラウドマスタから自動取得
      // 対象月は「現在の年月」を使用（現在有効なマスタを取得）
      if (planType === 'kyokai' && data.office.kyokaiPrefCode) {
        const targetYear = now.getFullYear();
        const targetMonth = now.getMonth() + 1;
        this.loadPresetFromCloud(targetYear, targetMonth, data.office.kyokaiPrefCode);
      } else {
        STANDARD_REWARD_BANDS_BASE.forEach((band) => this.addBand(band));
      }
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

  async onPrefChange(code: string): Promise<void> {
    this.form.patchValue({ kyokaiPrefName: this.prefectureName(code) });
    
    // プラン種別が'kyokai'の場合、クラウドマスタから自動取得
    const planType = this.form.get('planType')?.value;
    if (planType === 'kyokai' && code) {
      // フォーム値がstringでも安全に処理するため、明示的に数値化
      const effectiveYear = Number(this.form.get('effectiveYear')?.value ?? new Date().getFullYear());
      const effectiveMonth = Number(this.form.get('effectiveMonth')?.value ?? 3);
      await this.loadPresetFromCloud(effectiveYear, effectiveMonth, code);
    }
  }
  
  private async loadPresetFromCloud(targetYear: number, targetMonth: number, prefCode: string): Promise<void> {
    try {
      const preset = await this.cloudMasterService.getHealthRatePresetFromCloud(targetYear, targetMonth, prefCode);
      if (preset) {
        this.form.patchValue({
          healthRate: preset.healthRate,
          kyokaiPrefName: preset.kyokaiPrefName
        });
        this.bands.clear();
        (preset.bands ?? STANDARD_REWARD_BANDS_BASE).forEach((band) => this.addBand(band));
      } else {
        // フォールバック: ハードコードされたデータを使用（年度ベースのフォールバック）
        // 年度はtargetYearを使用（3月開始を想定）
        const fallbackPreset = getKyokaiHealthRatePreset(prefCode, targetYear);
        if (fallbackPreset) {
          this.form.patchValue({
            healthRate: fallbackPreset.healthRate,
            kyokaiPrefName: fallbackPreset.kyokaiPrefName
          });
          this.bands.clear();
          (fallbackPreset.bands ?? STANDARD_REWARD_BANDS_BASE).forEach((band) => this.addBand(band));
        } else {
          // プリセットが存在しない年度（2026以降など）は料率0で初期化
          this.form.patchValue({
            healthRate: 0,
            kyokaiPrefName: this.prefectureName(prefCode)
          });
          this.bands.clear();
          STANDARD_REWARD_BANDS_BASE.forEach((band) => this.addBand(band));
        }
      }
    } catch (error) {
      console.error('クラウドマスタからの取得に失敗しました', error);
      // フォールバック: ハードコードされたデータを使用
      const fallbackPreset = getKyokaiHealthRatePreset(prefCode, targetYear);
      if (fallbackPreset) {
        this.form.patchValue({
          healthRate: fallbackPreset.healthRate,
          kyokaiPrefName: fallbackPreset.kyokaiPrefName
        });
        this.bands.clear();
        (fallbackPreset.bands ?? STANDARD_REWARD_BANDS_BASE).forEach((band) => this.addBand(band));
      } else {
        // プリセットが存在しない年度（2026以降など）は料率0で初期化
        this.form.patchValue({
          healthRate: 0,
          kyokaiPrefName: this.prefectureName(prefCode)
        });
        this.bands.clear();
        STANDARD_REWARD_BANDS_BASE.forEach((band) => this.addBand(band));
      }
    }
  }

  async loadPreset(): Promise<void> {
    const planType = this.form.get('planType')?.value;
    const prefCode = this.form.get('kyokaiPrefCode')?.value || this.data.office.kyokaiPrefCode || '13';
    // フォーム値がstringでも安全に処理するため、明示的に数値化
    const effectiveYear = Number(this.form.get('effectiveYear')?.value ?? new Date().getFullYear());
    const effectiveMonth = Number(this.form.get('effectiveMonth')?.value ?? 3);
    
    if (planType === 'kyokai' && prefCode) {
      // クラウドマスタから取得を試みる（適用開始年月に有効な最新マスタを取得）
      await this.loadPresetFromCloud(effectiveYear, effectiveMonth, prefCode as string);
    } else {
      // 組合健保の場合は既存の処理を維持
      const preset = getKyokaiHealthRatePreset(prefCode as string, effectiveYear);
      if (preset) {
        this.form.patchValue({
          planType: 'kyokai',
          kyokaiPrefCode: prefCode,
          kyokaiPrefName: this.prefectureName(prefCode as string),
          healthRate: preset.healthRate
        });
        this.bands.clear();
        (preset.bands ?? STANDARD_REWARD_BANDS_BASE).forEach((band) => this.addBand(band));
      } else {
        // プリセットが存在しない年度（2026以降など）は料率0で初期化
        this.form.patchValue({
          planType: 'kyokai',
          kyokaiPrefCode: prefCode,
          kyokaiPrefName: this.prefectureName(prefCode as string),
          healthRate: 0
        });
        this.bands.clear();
        STANDARD_REWARD_BANDS_BASE.forEach((band) => this.addBand(band));
      }
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const effectiveYear = this.form.value.effectiveYear!;
    const effectiveMonth = this.form.value.effectiveMonth!;
    const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;

    const payload: Partial<HealthRateTable> = {
      ...this.form.value,
      bands: this.bands.value as StandardRewardBand[],
      effectiveYearMonth,
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
