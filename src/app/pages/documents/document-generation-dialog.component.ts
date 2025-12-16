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
import { MatListModule } from '@angular/material/list';
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
  employee?: Employee;  // 単票生成用（オプショナル）
  bonuses?: BonusPremium[];
  defaultType?: DocumentType;
  yearMonth?: string;  // 月次PDF用の対象年月
  employees?: Employee[];  // バッチ生成用の候補従業員リスト（資格取得/喪失届の複数選択用）
  disableBonus?: boolean;  // 賞与支払届を無効化するかどうか
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
    MatSnackBarModule,
    MatListModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>picture_as_pdf</mat-icon>
      入力補助PDF生成
    </h2>

    <div mat-dialog-content class="content">
      <p class="disclaimer">
        本システムで生成されるPDFは入力補助用の参考様式です。届け出作成時の補助資料としてご利用ください。
      </p>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>PDF種類</mat-label>
        <mat-select [formControl]="typeControl">
          <mat-option 
            *ngFor="let type of documentTypes" 
            [value]="type.value"
            [disabled]="data.disableBonus && type.value === 'monthly_bonus_payment'"
          >
            {{ type.label }}
          </mat-option>
        </mat-select>
      </mat-form-field>

      <!-- 資格取得/喪失届の複数選択UI -->
      <ng-container *ngIf="(viewModel$ | async)?.type === 'qualification_acquisition' || (viewModel$ | async)?.type === 'qualification_loss'">
        <div class="employee-selection-section" *ngIf="data.employees && data.employees.length > 0">
          <div class="label">対象従業員（複数選択可）</div>
          <mat-selection-list [formControl]="selectedEmployeeIdsControl" class="employee-list">
            <mat-list-option *ngFor="let emp of data.employees" [value]="emp.id">
              {{ emp.name }} {{ emp.kana ? '(' + emp.kana + ')' : '' }}
            </mat-list-option>
          </mat-selection-list>
            <div class="selection-info">
              選択中: {{ (selectedEmployeeIdsControl.value || [])?.length || 0 }}名
            </div>
        </div>
      </ng-container>

      <!-- 単票生成用の従業員表示 -->
      <div class="readonly-field" *ngIf="data.employee && (viewModel$ | async)?.type !== 'monthly_bonus_payment' && (viewModel$ | async)?.type !== 'qualification_acquisition' && (viewModel$ | async)?.type !== 'qualification_loss'">
        <div class="label">対象従業員</div>
        <div class="value">{{ data.employee.name }}</div>
      </div>

      <div class="readonly-field" *ngIf="(viewModel$ | async)?.type === 'monthly_bonus_payment'">
        <div class="label">対象年月</div>
        <div class="value">{{ data.yearMonth || '未設定' }}</div>
      </div>

      <ng-container *ngIf="(viewModel$ | async) as vm">
        <ng-container *ngIf="(validation$ | async) as validation">
          <ng-container *ngIf="vm.type !== 'monthly_bonus_payment'">
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
            <div *ngIf="vm.type !== 'monthly_bonus_payment' && vm.type !== 'qualification_acquisition' && vm.type !== 'qualification_loss'">
              <strong>標準報酬月額（推定）:</strong>
              {{
                vm.standardMonthlyReward !== null && vm.standardMonthlyReward !== undefined
                  ? (vm.standardMonthlyReward | number)
                  : '未取得'
              }}
            </div>
            <div *ngIf="vm.type !== 'monthly_bonus_payment' && vm.type !== 'qualification_acquisition' && vm.type !== 'qualification_loss'">
              <strong>基準日:</strong> {{ vm.referenceDate || '未入力' }}
            </div>
            <div *ngIf="vm.type === 'qualification_acquisition' || vm.type === 'qualification_loss'">
              <strong>選択人数:</strong> {{ (selectedEmployeeIdsControl.value || [])?.length || 0 }}名
            </div>
            <div *ngIf="vm.type === 'monthly_bonus_payment'">
              <strong>対象年月:</strong> {{ data.yearMonth || '未設定' }}
              <br />
              <strong>対象賞与件数:</strong> {{ bonuses.length }} 件
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

      .employee-selection-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .employee-selection-section .label {
        font-weight: 600;
        font-size: 0.875rem;
      }

      .employee-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        padding: 0.5rem 0;
      }

      .selection-info {
        font-size: 0.875rem;
        color: #666;
        padding: 0.5rem;
        background: #f8fafc;
        border-radius: 4px;
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
    { value: 'monthly_bonus_payment', label: '賞与支払届用補助PDF（月次まとめ）' }
  ];

  readonly bonuses = this.data.bonuses ?? [];

  readonly typeControl = this.fb.control<DocumentType>(
    this.data.defaultType ?? 'qualification_acquisition'
  );
  readonly referenceDateControl = this.fb.control<string | null>(this.initialReferenceDate());
  readonly ackWarningsControl = this.fb.control<boolean>(false);
  readonly selectedEmployeeIdsControl = this.fb.control<string[]>([]);

  private readonly histories$ = this.data.employee
    ? this.standardRewardHistoryService
        .list(this.data.office.id, this.data.employee.id)
        .pipe(startWith([]))
    : of([]);

  readonly standardMonthlyReward$ = combineLatest([
    this.typeControl.valueChanges.pipe(startWith(this.typeControl.value)),
    this.histories$,
    this.referenceDateControl.valueChanges.pipe(startWith(this.referenceDateControl.value))
  ]).pipe(
    map(([type, histories, referenceDate]) => {
      // 資格取得届・資格喪失届の場合は健康保険の標準報酬を使用
      // （将来的に健保/厚年を分ける場合は、ここで保険種別を選択できるようにする）
      const insuranceKind: 'health' | 'pension' | undefined = 
        type === 'qualification_acquisition' || type === 'qualification_loss' 
          ? 'health' 
          : undefined;
      
      // 対象年月を決定（資格取得日/喪失日から年月を抽出）
      let targetYearMonth: string | undefined;
      if (referenceDate && (type === 'qualification_acquisition' || type === 'qualification_loss')) {
        targetYearMonth = referenceDate.substring(0, 7); // YYYY-MM形式
      }
      
      return this.data.employee
        ? this.generator.resolveStandardMonthlyReward(
            histories,
            this.data.employee.payrollSettings?.insurableMonthlyWage ?? undefined,
            insuranceKind,
            targetYearMonth as any,
            this.data.employee
          )
        : null;
    })
  );

  readonly viewModel$ = combineLatest([
    this.typeControl.valueChanges.pipe(startWith(this.typeControl.value)),
    this.standardMonthlyReward$,
    this.referenceDateControl.valueChanges.pipe(startWith(this.referenceDateControl.value)),
    this.ackWarningsControl.valueChanges.pipe(startWith(this.ackWarningsControl.value))
  ]).pipe(
    map(
      ([type, standardMonthlyReward, referenceDate, ackWarnings]) => ({
        type,
        standardMonthlyReward,
        referenceDate,
        bonus: null,  // bonus_paymentは削除したため常にnull
        ackWarnings
      }) as DocumentViewModel
    )
  );

  readonly validation$ = this.viewModel$.pipe(map((vm) => this.buildValidation(vm)));

  constructor() {}

  canGenerate(vm: DocumentViewModel, validation: DocumentValidationResult): boolean {
    if (validation.criticalMissing.length > 0) return false;
    if (validation.requiredMissing.length > 0 && !vm.ackWarnings) return false;
    
    // 資格取得/喪失届のバッチ生成の場合
    if (vm.type === 'qualification_acquisition' || vm.type === 'qualification_loss') {
      const selectedIds = this.selectedEmployeeIdsControl.value || [];
      if (selectedIds.length === 0) return false;
    }
    
    if (vm.type === 'monthly_bonus_payment') {
      // 月次PDFの場合は、bonusesとyearMonthがあれば生成可能
      if (!this.data.bonuses || this.data.bonuses.length === 0) return false;
      if (!this.data.yearMonth) return false;
      if (!this.data.employees || this.data.employees.length === 0) return false;
    }
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
        case 'qualification_acquisition': {
          // バッチ生成の場合
          if (this.data.employees && this.data.employees.length > 0) {
            const selectedIds = this.selectedEmployeeIdsControl.value || [];
            const selectedEmployees = this.data.employees.filter(emp => selectedIds.includes(emp.id));
            if (selectedEmployees.length === 0) {
              this.snackBar.open('対象従業員を選択してください。', undefined, { duration: 2500 });
              return;
            }
            await this.generator.generateQualificationBatch(
              this.data.office,
              selectedEmployees,
              'qualification_acquisition',
              action
            );
          } else if (this.data.employee) {
            // 単票生成の場合
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
          }
          break;
        }
        case 'qualification_loss': {
          // バッチ生成の場合
          if (this.data.employees && this.data.employees.length > 0) {
            const selectedIds = this.selectedEmployeeIdsControl.value || [];
            const selectedEmployees = this.data.employees.filter(emp => selectedIds.includes(emp.id));
            if (selectedEmployees.length === 0) {
              this.snackBar.open('対象従業員を選択してください。', undefined, { duration: 2500 });
              return;
            }
            await this.generator.generateQualificationBatch(
              this.data.office,
              selectedEmployees,
              'qualification_loss',
              action
            );
          } else if (this.data.employee) {
            // 単票生成の場合
            this.generator.generate(
              {
                type: 'qualification_loss',
                payload: {
                  office: this.data.office,
                  employee: this.data.employee,
                  lossDate: vm.referenceDate,
                  standardMonthlyReward: vm.standardMonthlyReward
                }
              },
              action
            );
          }
          break;
        }
        case 'monthly_bonus_payment':
          if (!this.data.bonuses || this.data.bonuses.length === 0) {
            throw new Error('対象年月に賞与データがありません');
          }
          if (!this.data.yearMonth) {
            throw new Error('対象年月が設定されていません');
          }
          if (!this.data.employees || this.data.employees.length === 0) {
            throw new Error('従業員データが取得できませんでした');
          }
          this.generator.generate(
            {
              type: 'monthly_bonus_payment',
              payload: {
                office: this.data.office,
                employees: this.data.employees,
                bonuses: this.data.bonuses,
                yearMonth: this.data.yearMonth
              }
            },
            action,
            `bonus-payment-monthly-${this.data.yearMonth}.pdf`
          );
          break;
      }
    } catch (error) {
      console.error(error);
      this.snackBar.open('入力補助PDF生成に失敗しました。時間をおいて再度お試しください。', undefined, {
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
    
    // バッチ生成の場合は従業員の検証をスキップ
    if (this.data.employee) {
      if (!this.data.employee.name) {
        criticalMissing.push('被保険者氏名');
      }
      if (!this.data.employee.birthDate) {
        criticalMissing.push('生年月日');
      }
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
      if (this.data.employee && !this.data.employee.retireDate) {
        optionalMissing.push('退職日');
      }
    }

    return { criticalMissing, requiredMissing, optionalMissing };
  }

  private initialReferenceDate(): string | null {
    if (!this.data.employee) {
      return null;
    }
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
