import { NgFor, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { HealthRateTable, Office, StandardRewardBand } from '../../types';
import { CloudMasterService } from '../../services/cloud-master.service';
import { PREFECTURE_CODES, getKyokaiHealthRatePreset, STANDARD_REWARD_BANDS_BASE } from '../../utils/kyokai-presets';
import { MastersService } from '../../services/masters.service';

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
      <mat-icon class="mr-2">{{ data.table ? 'edit' : 'add' }}</mat-icon>
      {{ data.table ? '健康保険マスタを編集' : '健康保険マスタを作成' }}
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
          <mat-label>プラン種別</mat-label>
          <mat-select formControlName="planType">
            <mat-option value="kyokai">協会けんぽ</mat-option>
            <mat-option value="kumiai">組合健保</mat-option>
          </mat-select>
        </mat-form-field>
        </div>
        
        <div class="screen-rules mb-3">
          <p>
            <strong>設定ヒント:</strong><br>
            例）2025年3月分から改定される場合：「適用開始年」= 2025、「適用開始月」= 3。<br>
            その前の月（〜2月分）は、前回登録した料率が自動的に使われます。
          </p>
        </div>
      </div>

      <div class="form-section mb-4">
        <h3 class="mat-h3 mb-2 flex-row align-center gap-2">
          <mat-icon color="primary">tune</mat-icon> プラン詳細
        </h3>
        
      <ng-container *ngIf="form.get('planType')?.value === 'kyokai'; else kumiaiFields">
        <div class="form-row">
            <mat-form-field appearance="outline" class="w-100">
            <mat-label>都道府県</mat-label>
            <mat-select formControlName="kyokaiPrefCode" (selectionChange)="onPrefChange($event.value)">
              <mat-option *ngFor="let code of prefCodes" [value]="code">{{ prefectureName(code) }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </ng-container>
      <ng-template #kumiaiFields>
          <div class="form-row flex-row gap-2 flex-wrap">
            <mat-form-field appearance="outline" class="flex-1">
            <mat-label>組合名</mat-label>
            <input matInput formControlName="unionName" />
          </mat-form-field>

            <mat-form-field appearance="outline" class="flex-1">
            <mat-label>組合コード</mat-label>
            <input matInput formControlName="unionCode" />
          </mat-form-field>
        </div>
      </ng-template>

        <mat-form-field appearance="outline" class="w-100">
        <mat-label>健康保険料率（合計）</mat-label>
        <input matInput type="number" formControlName="healthRate" step="0.0001" />
          <mat-hint>例: 0.0991 (9.91%)</mat-hint>
      </mat-form-field>
      </div>

      <div class="form-section">
        <div class="flex-row justify-between align-center mb-2">
          <h3 class="mat-h3 m-0 flex-row align-center gap-2">
            <mat-icon color="primary">list</mat-icon> 標準報酬等級表（{{ bands.length }}件）
          </h3>
          <div class="flex-row gap-2">
            <button mat-stroked-button color="primary" type="button" (click)="loadPreset()">
              <mat-icon>download</mat-icon>
              {{ form.get('planType')?.value === 'kyokai' ? '協会けんぽプリセット' : '標準プリセット' }}
            </button>
            <button mat-flat-button color="primary" type="button" (click)="addBand()">
            <mat-icon>add</mat-icon>
              追加
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
          <p>等級が登録されていません。「追加」ボタンまたはプリセット読込を行ってください。</p>
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
        display: none; // スペース節約のためバリデーションエラーはツールチップ等で代用（今回は非表示）
      }
      
      ::ng-deep .editable-table-row .mat-mdc-text-field-wrapper {
        padding-left: 8px;
        padding-right: 8px;
      }
    `
  ]
})
export class HealthMasterFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<HealthMasterFormDialogComponent>);
  private readonly cloudMasterService = inject(CloudMasterService);
  private readonly mastersService = inject(MastersService);
  private readonly snackBar = inject(MatSnackBar);

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

    // 事業所設定を唯一の真実としてプラン種別を固定
    const planType = data.office.healthPlanType ?? 'kyokai';
    this.form.patchValue({ planType });
    this.form.get('planType')?.disable();

    if (planType === 'kyokai') {
      if (!data.office.kyokaiPrefCode) {
        this.snackBar.open('事業所設定に都道府県が設定されていません。事業所設定画面で都道府県を設定してください。', '閉じる', {
          duration: 5000
        });
        this.dialogRef.close();
        return;
      }
      this.form.patchValue({
        kyokaiPrefCode: data.office.kyokaiPrefCode,
        kyokaiPrefName: data.office.kyokaiPrefName
      });
      this.form.get('kyokaiPrefCode')?.disable();
    }

    if (table) {
      this.form.patchValue({
        effectiveYear: table.effectiveYear,
        effectiveMonth: table.effectiveMonth,
        healthRate: table.healthRate,
        unionName: table.unionName,
        unionCode: table.unionCode
      });
      table.bands?.forEach((band) => this.addBand(band));
    } else {
      this.form.patchValue({
        effectiveYear: defaultYear,
        effectiveMonth: defaultMonth
      });

      if (planType === 'kumiai') {
        this.form.patchValue({
          unionName: data.office.unionName ?? '',
          unionCode: data.office.unionCode ?? ''
        });
      }

      // 新規作成時: 協会けんぽで事業所に都道府県がある場合はクラウドマスタから取得
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
    const planType = this.data.office.healthPlanType ?? 'kyokai';
    if (planType === 'kyokai' && code) {
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
    const planType = this.data.office.healthPlanType ?? 'kyokai';
    const prefCode = this.data.office.kyokaiPrefCode;
    const effectiveYear = Number(this.form.get('effectiveYear')?.value ?? new Date().getFullYear());
    const effectiveMonth = Number(this.form.get('effectiveMonth')?.value ?? 3);

    if (planType === 'kyokai' && prefCode) {
      await this.loadPresetFromCloud(effectiveYear, effectiveMonth, prefCode);
      return;
    }

    // 組合健保など：標準報酬等級だけ初期値で埋める（planTypeは事業所設定を変更しない）
    this.bands.clear();
    STANDARD_REWARD_BANDS_BASE.forEach((band) => this.addBand(band));
    this.form.patchValue({
      healthRate: this.form.value.healthRate ?? 0
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const planType = this.data.office.healthPlanType ?? 'kyokai';
    const effectiveYear = Number(this.form.value.effectiveYear!);
    const effectiveMonth = Number(this.form.value.effectiveMonth!);
    const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;
    const rawUnionName = this.form.value.unionName as string | null | undefined;
    const rawUnionCode = this.form.value.unionCode as string | null | undefined;
    const unionName =
      typeof rawUnionName === 'string' && rawUnionName.trim() !== ''
        ? rawUnionName.trim()
        : undefined;
    const unionCode =
      typeof rawUnionCode === 'string' && rawUnionCode.trim() !== ''
        ? rawUnionCode.trim()
        : undefined;
    const kyokaiPrefCode =
      planType === 'kyokai' ? this.data.office.kyokaiPrefCode ?? undefined : undefined;

    const existing = await this.mastersService.checkHealthRateTableDuplicate(
      this.data.office.id,
      effectiveYearMonth,
      planType,
      kyokaiPrefCode,
      unionCode,
      this.data.table?.id
    );

    if (existing && existing.id !== this.data.table?.id) {
      const planLabel =
        planType === 'kyokai'
          ? `協会けんぽ（${this.data.office.kyokaiPrefName ?? '都道府県不明'}）`
          : `組合健保（${unionName ?? '組合名未設定'}）`;
      const confirmed = confirm(
        `${effectiveYear}年${effectiveMonth}月分（${planLabel}）のマスタが既に登録されています。\n` +
          `上書き保存しますか？\n\n` +
          `既存の料率: ${(existing.healthRate * 100).toFixed(2)}%`
      );
      if (!confirmed) {
        return;
      }
      const payload: Partial<HealthRateTable> = {
        id: existing.id,
        effectiveYear,
        effectiveMonth,
        healthRate: Number(this.form.value.healthRate ?? 0),
        bands: this.bands.value as StandardRewardBand[],
        effectiveYearMonth,
        planType,
        kyokaiPrefCode:
          planType === 'kyokai' ? this.data.office.kyokaiPrefCode ?? undefined : undefined,
        kyokaiPrefName:
          planType === 'kyokai' ? this.data.office.kyokaiPrefName ?? undefined : undefined,
        unionName: planType === 'kyokai' ? undefined : unionName,
        unionCode: planType === 'kyokai' ? undefined : unionCode
      };
      this.dialogRef.close(payload);
      return;
    }

    const payload: Partial<HealthRateTable> = {
      id: this.data.table?.id,
      effectiveYear,
      effectiveMonth,
      healthRate: Number(this.form.value.healthRate ?? 0),
      bands: this.bands.value as StandardRewardBand[],
      effectiveYearMonth,
      planType,
      kyokaiPrefCode:
        planType === 'kyokai' ? this.data.office.kyokaiPrefCode ?? undefined : undefined,
      kyokaiPrefName:
        planType === 'kyokai' ? this.data.office.kyokaiPrefName ?? undefined : undefined,
      unionName: planType === 'kyokai' ? undefined : unionName,
      unionCode: planType === 'kyokai' ? undefined : unionCode
    };
    this.dialogRef.close(payload);
  }
}
