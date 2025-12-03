import { AsyncPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { combineLatest, firstValueFrom, map, of, startWith, switchMap } from 'rxjs';

import {
  DocumentAction,
  DocumentGeneratorService,
  DocumentType
} from '../../services/document-generator.service';
import { BonusPremium, Employee, Office } from '../../types';
import { StandardRewardHistoryService } from '../../services/standard-reward-history.service';

export interface DocumentGenerationDialogData {
  office: Office;
  employee: Employee;
  bonuses?: BonusPremium[];
  defaultType?: DocumentType;
}

interface DocumentValidationResult {
  criticalMissing: string[];
  requiredMissing: string[];
  optionalMissing: string[];
}

interface DocumentViewModel {
  type: DocumentType;
  standardMonthlyReward: number | null;
  referenceDate: string | null;
  bonus: BonusPremium | null;
  ackWarnings: boolean;
}

@Component({
  selector: 'ip-document-generation-dialog',
  standalone: true,
  imports: [
    AsyncPipe,
    DecimalPipe,
    NgFor,
    NgIf,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatCheckboxModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>picture_as_pdf</mat-icon>
      帳票生成
    </h2>

    <div mat-dialog-content class="content">
      <p class="disclaimer">
        本システムで生成される帳票は参考様式です。提出前に内容を確認し、必要に応じて手書き修正してください。
      </p>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>帳票種類</mat-label>
        <mat-select [formControl]="typeControl">
          <mat-option *ngFor="let type of documentTypes" [value]="type.value">{{ type.label }}</mat-option>
        </mat-select>
      </mat-form-field>

      <div class="readonly-field">
        <div class="label">対象従業員</div>
        <div class="value">{{ data.employee.name }}</div>
      </div>

      <ng-container *ngIf="(viewModel$ | async) as vm">
        <ng-container *ngIf="(validation$ | async) as validation">
          <ng-container *ngIf="vm.type === 'bonus_payment'">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>対象賞与</mat-label>
              <mat-select [formControl]="bonusControl">
                <mat-option *ngFor="let bonus of bonuses" [value]="bonus.id">
                  {{ bonus.payDate }} / {{ bonus.grossAmount | number }} 円
                </mat-option>
              </mat-select>
            </mat-form-field>
          </ng-container>

          <ng-container *ngIf="vm.type !== 'bonus_payment'">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>対象基準日</mat-label>
              <input matInput type="date" [formControl]="referenceDateControl" />
            </mat-form-field>
          </ng-container>

          <div class="warnings">
            <div class="error" *ngIf="validation.criticalMissing.length > 0">
              <strong>不足している致命的項目:</strong>
              <ul>
                <li *ngFor="let item of validation.criticalMissing">{{ item }}</li>
              </ul>
            </div>

            <div class="warning" *ngIf="validation.requiredMissing.length > 0">
              <strong>未入力の主要項目:</strong>
              <ul>
                <li *ngFor="let item of validation.requiredMissing">{{ item }}</li>
              </ul>
              <mat-checkbox [formControl]="ackWarningsControl">
                警告を理解した上で空欄のまま続行する
              </mat-checkbox>
            </div>

            <div class="info" *ngIf="validation.optionalMissing.length > 0">
              <strong>任意項目の不足:</strong>
              <ul>
                <li *ngFor="let item of validation.optionalMissing">{{ item }}</li>
              </ul>
            </div>
          </div>

          <div class="summary">
            <div>
              <strong>標準報酬月額（推定）:</strong>
              {{
                vm.standardMonthlyReward !== null && vm.standardMonthlyReward !== undefined
                  ? (vm.standardMonthlyReward | number)
                  : '未取得'
              }}
            </div>
            <div *ngIf="vm.type !== 'bonus_payment'">
              <strong>基準日:</strong> {{ vm.referenceDate || '未入力' }}
            </div>
            <div *ngIf="vm.type === 'bonus_payment'">
              <strong>対象賞与:</strong> {{ vm.bonus?.payDate || '未選択' }}
            </div>
          </div>

          <div class="actions">
            <button
              mat-stroked-button
              color="primary"
              type="button"
              (click)="generate('open')"
              [disabled]="!canGenerate(vm, validation)"
            >
              <mat-icon>visibility</mat-icon>
              プレビュー
            </button>
            <button
              mat-raised-button
              color="primary"
              type="button"
              (click)="generate('download')"
              [disabled]="!canGenerate(vm, validation)"
            >
              <mat-icon>download</mat-icon>
              PDFダウンロード
            </button>
            <button
              mat-button
              type="button"
              (click)="generate('print')"
              [disabled]="!canGenerate(vm, validation)"
            >
              <mat-icon>print</mat-icon>
              印刷
            </button>
          </div>
        </ng-container>
      </ng-container>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>閉じる</button>
    </div>
  `,
  styles: [
    `
      .content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-width: 420px;
      }

      .disclaimer {
        background: #f9fafb;
        border: 1px dashed #cbd5e1;
        padding: 0.75rem;
        border-radius: 6px;
        font-size: 0.95rem;
        margin: 0;
      }

      .full-width {
        width: 100%;
      }

      .readonly-field {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 0.5rem;
        border-bottom: 1px solid #e5e7eb;
        color: #111827;
      }

      .readonly-field .label {
        font-weight: 600;
      }

      .readonly-field .value {
        color: #374151;
      }

      .warnings {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .warnings .error {
        background: #fef2f2;
        border: 1px solid #fecdd3;
        color: #991b1b;
        padding: 0.75rem;
        border-radius: 6px;
      }

      .warnings .warning {
        background: #fffbeb;
        border: 1px solid #fef08a;
        color: #92400e;
        padding: 0.75rem;
        border-radius: 6px;
      }

      .warnings .info {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #0f172a;
        padding: 0.75rem;
        border-radius: 6px;
      }

      .warnings ul {
        margin: 0.25rem 0 0;
        padding-left: 1.25rem;
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.5rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 0.75rem;
        font-size: 0.95rem;
      }

      .actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
    `
  ]
})
export class DocumentGenerationDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<DocumentGenerationDialogComponent>);
  private readonly generator = inject(DocumentGeneratorService);
  private readonly standardRewardHistoryService = inject(StandardRewardHistoryService);
  private readonly snackBar = inject(MatSnackBar);

  // 他の this.data 利用フィールドよりも先に定義する
  readonly data = inject<DocumentGenerationDialogData>(MAT_DIALOG_DATA);

  readonly documentTypes: Array<{ value: DocumentType; label: string }> = [
    { value: 'qualification_acquisition', label: '資格取得届' },
    { value: 'qualification_loss', label: '資格喪失届' },
    { value: 'bonus_payment', label: '賞与支払届' }
  ];

  readonly bonuses = this.data.bonuses ?? [];

  readonly typeControl = this.fb.control<DocumentType>(
    this.data.defaultType ?? 'qualification_acquisition'
  );
  readonly referenceDateControl = this.fb.control<string | null>(this.initialReferenceDate());
  readonly bonusControl = this.fb.control<string | null>(this.bonuses[0]?.id ?? null);
  readonly ackWarningsControl = this.fb.control<boolean>(false);

  private readonly histories$ = this.standardRewardHistoryService
    .list(this.data.office.id, this.data.employee.id)
    .pipe(startWith([]));

  readonly standardMonthlyReward$ = this.histories$.pipe(
    map((histories) =>
      this.generator.resolveStandardMonthlyReward(histories, this.data.employee.monthlyWage)
    )
  );

  readonly selectedBonus$ = this.typeControl.valueChanges.pipe(
    startWith(this.typeControl.value),
    switchMap((type) => {
      if (type !== 'bonus_payment') return of<BonusPremium | null>(null);
      return this.bonusControl.valueChanges.pipe(
        startWith(this.bonusControl.value),
        map((bonusId) => this.bonuses.find((b) => b.id === bonusId) ?? null)
      );
    })
  );

  readonly viewModel$ = combineLatest([
    this.typeControl.valueChanges.pipe(startWith(this.typeControl.value)),
    this.standardMonthlyReward$,
    this.referenceDateControl.valueChanges.pipe(startWith(this.referenceDateControl.value)),
    this.selectedBonus$,
    this.ackWarningsControl.valueChanges.pipe(startWith(this.ackWarningsControl.value))
  ]).pipe(
    map(
      ([type, standardMonthlyReward, referenceDate, bonus, ackWarnings]) => ({
        type,
        standardMonthlyReward,
        referenceDate,
        bonus,
        ackWarnings
      }) as DocumentViewModel
    )
  );

  readonly validation$ = this.viewModel$.pipe(map((vm) => this.buildValidation(vm)));

  constructor() {}

  canGenerate(vm: DocumentViewModel, validation: DocumentValidationResult): boolean {
    if (validation.criticalMissing.length > 0) return false;
    if (validation.requiredMissing.length > 0 && !vm.ackWarnings) return false;
    if (vm.type === 'bonus_payment' && !vm.bonus) return false;
    return true;
  }

  async generate(action: DocumentAction): Promise<void> {
    const vm = await firstValueFrom(this.viewModel$);
    const validation = await firstValueFrom(this.validation$);

    if (!this.canGenerate(vm, validation)) {
      this.snackBar.open('不足している項目を確認してください。', undefined, { duration: 2500 });
      return;
    }

    try {
      switch (vm.type) {
        case 'qualification_acquisition':
          this.generator.generate(
            {
              type: 'qualification_acquisition',
              payload: {
                office: this.data.office,
                employee: this.data.employee,
                referenceDate: vm.referenceDate,
                standardMonthlyReward: vm.standardMonthlyReward
              }
            },
            action
          );
          break;
        case 'qualification_loss':
          this.generator.generate(
            {
              type: 'qualification_loss',
              payload: {
                office: this.data.office,
                employee: this.data.employee,
                lossDate: vm.referenceDate
              }
            },
            action
          );
          break;
        case 'bonus_payment':
          if (!vm.bonus) {
            throw new Error('対象賞与が選択されていません');
          }
          this.generator.generate(
            {
              type: 'bonus_payment',
              payload: {
                office: this.data.office,
                employee: this.data.employee,
                bonus: vm.bonus
              }
            },
            action
          );
          break;
      }
    } catch (error) {
      console.error(error);
      this.snackBar.open('帳票生成に失敗しました。時間をおいて再度お試しください。', undefined, {
        duration: 3000
      });
    }
  }

  private buildValidation(vm: DocumentViewModel): DocumentValidationResult {
    const criticalMissing: string[] = [];
    const requiredMissing: string[] = [];
    const optionalMissing: string[] = [];

    if (!this.data.office.name) {
      criticalMissing.push('事業所名');
    }
    if (!this.data.employee.name) {
      criticalMissing.push('被保険者氏名');
    }
    if (!this.data.employee.birthDate) {
      criticalMissing.push('生年月日');
    }

    if (vm.type === 'qualification_acquisition') {
      if (!vm.referenceDate) {
        requiredMissing.push('資格取得日');
      }
      if (vm.standardMonthlyReward === null || vm.standardMonthlyReward === undefined) {
        requiredMissing.push('標準報酬月額');
      }
      if (!this.data.office.officeSymbol) {
        optionalMissing.push('事業所記号');
      }
    }

    if (vm.type === 'qualification_loss') {
      if (!vm.referenceDate) {
        requiredMissing.push('資格喪失日');
      }
      if (!this.data.employee.retireDate) {
        optionalMissing.push('退職日');
      }
    }

    if (vm.type === 'bonus_payment') {
      if (!vm.bonus) {
        criticalMissing.push('対象賞与');
      } else {
        if (!vm.bonus.payDate) {
          criticalMissing.push('賞与支給日');
        }
        if (vm.bonus.grossAmount === undefined || vm.bonus.grossAmount === null) {
          criticalMissing.push('賞与支給額');
        }
        if (vm.bonus.standardBonusAmount === undefined || vm.bonus.standardBonusAmount === null) {
          requiredMissing.push('標準賞与額');
        }
        if (vm.bonus.healthTotal === undefined || vm.bonus.healthTotal === null) {
          requiredMissing.push('健康保険料');
        }
        if (vm.bonus.pensionTotal === undefined || vm.bonus.pensionTotal === null) {
          requiredMissing.push('厚生年金保険料');
        }
      }
    }

    return { criticalMissing, requiredMissing, optionalMissing };
  }

  private initialReferenceDate(): string | null {
    const type = this.data.defaultType ?? 'qualification_acquisition';
    if (type === 'qualification_loss') {
      return this.data.employee.healthLossDate ?? this.data.employee.retireDate ?? null;
    }
    if (type === 'qualification_acquisition') {
      return (
        this.data.employee.healthQualificationDate ||
        this.data.employee.pensionQualificationDate ||
        this.data.employee.hireDate ||
        null
      );
    }
    return null;
  }

  close(): void {
    this.dialogRef.close();
  }
}
