import { Component, Inject, inject } from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AsyncPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { combineLatest, defer, firstValueFrom, map, Observable, of, startWith, switchMap } from 'rxjs';

import { InsuranceKind, StandardRewardDecisionKind, StandardRewardHistory, YearMonthString } from '../../types';
import { getStandardRewardDecisionKindLabel } from '../../utils/label-utils';
import { StandardRewardHistoryService } from '../../services/standard-reward-history.service';
import { MastersService } from '../../services/masters.service';
import { CurrentOfficeService } from '../../services/current-office.service';

export interface StandardRewardHistoryFormDialogData {
  officeId: string;
  employeeId: string;
  history?: StandardRewardHistory;
}

@Component({
  selector: 'ip-standard-reward-history-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    NgIf,
    NgFor,
    AsyncPipe,
    DecimalPipe
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">{{ data.history ? 'edit' : 'add' }}</mat-icon>
      {{ data.history ? '標準報酬履歴を編集' : '標準報酬履歴を追加' }}
    </h1>

    <form class="dense-form" [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>保険種別 *</mat-label>
        <mat-select formControlName="insuranceKind" required>
          <mat-option value="health">健康保険</mat-option>
          <mat-option value="pension">厚生年金</mat-option>
        </mat-select>
        <mat-error *ngIf="form.controls.insuranceKind.hasError('required')">
          保険種別を選択してください
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>適用開始年月 *</mat-label>
        <input
          matInput
          formControlName="appliedFromYearMonth"
          type="month"
          required
          placeholder="YYYY-MM"
        />
        <mat-error *ngIf="form.controls.appliedFromYearMonth.hasError('required')">
          適用開始年月を入力してください
        </mat-error>
        <mat-error *ngIf="form.controls.appliedFromYearMonth.hasError('pattern')">
          YYYY-MM 形式で入力してください
        </mat-error>
        <mat-error *ngIf="form.controls.appliedFromYearMonth.hasError('duplicate')">
          この保険種別・適用開始年月の履歴が既に存在します
        </mat-error>
        <mat-error *ngIf="form.controls.appliedFromYearMonth.hasError('pending')">
          重複チェック中...
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>標準報酬月額 *</mat-label>
        <mat-select formControlName="standardMonthlyReward" required [disabled]="!(availableStandardMonthlyRewards$ | async)?.length">
          <mat-option *ngFor="let amount of availableStandardMonthlyRewards$ | async" [value]="amount">
            {{ amount | number }}円
          </mat-option>
        </mat-select>
        <mat-spinner *ngIf="loadingMasterData$ | async" diameter="20" matPrefix class="inline-spinner"></mat-spinner>
        <mat-error *ngIf="form.controls.standardMonthlyReward.hasError('required')">
          標準報酬月額を選択してください
        </mat-error>
        <mat-hint *ngIf="hintMessage$ | async as hintMessage">
          {{ hintMessage }}
        </mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width readonly-field">
        <mat-label>等級（任意）</mat-label>
        <input
          matInput
          type="number"
          formControlName="grade"
          readonly
          [matTooltip]="'標準報酬月額を選択すると自動的に設定されます'"
          matTooltipPosition="above"
        />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>決定区分 *</mat-label>
        <mat-select formControlName="decisionKind" required>
          <mat-option *ngFor="let kind of decisionKinds" [value]="kind">
            {{ getStandardRewardDecisionKindLabel(kind) }}
          </mat-option>
        </mat-select>
        <mat-error *ngIf="form.controls.decisionKind.hasError('required')">
          決定区分を選択してください
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>メモ（任意）</mat-label>
        <textarea matInput formControlName="note" rows="3"></textarea>
        <mat-hint align="end">
          {{ form.controls.note.value.length || 0 }}/1000
        </mat-hint>
      </mat-form-field>
    </form>

    <div mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
        キャンセル
      </button>
      <button mat-flat-button color="primary" (click)="submit()" [disabled]="form.invalid">
        <mat-icon>save</mat-icon>
        保存
      </button>
    </div>
  `,
  styles: [
    `
      .dialog-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 16px 16px 12px;
        border-bottom: 1px solid #e0e0e0;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px 16px;
      }

      .full-width {
        width: 100%;
      }

      .dialog-actions {
        padding: 12px 16px 16px;
        border-top: 1px solid #e0e0e0;
        background: #fafafa;
      }

      .dialog-actions button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .inline-spinner {
        margin-right: 8px;
      }

      .readonly-field .mat-mdc-text-field-wrapper {
        background-color: #f5f5f5;
      }

      .readonly-field .mat-mdc-form-field-focus-overlay {
        background-color: #f5f5f5;
      }

      .readonly-field input[readonly] {
        background-color: #f5f5f5;
        cursor: default;
      }
    `
  ]
})
export class StandardRewardHistoryFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly standardRewardHistoryService = inject(StandardRewardHistoryService);
  private readonly mastersService = inject(MastersService);
  private readonly currentOfficeService = inject(CurrentOfficeService);

  protected readonly decisionKinds: StandardRewardDecisionKind[] = [
    'regular',
    'interim',
    'bonus',
    'qualification',
    'loss',
    'other'
  ];

  readonly form = this.fb.nonNullable.group({
    insuranceKind: ['health' as InsuranceKind, Validators.required],
    appliedFromYearMonth: [
      '',
      [Validators.required, Validators.pattern(/^\d{4}-\d{2}$/)],
      [this.duplicateValidator()]
    ],
    standardMonthlyReward: [null as number | null, Validators.required],
    grade: [null as number | null, [Validators.min(1), Validators.max(100)]],
    decisionKind: ['', Validators.required],
    note: ['', Validators.maxLength(1000)]
  });

  readonly appliedFromYearMonth$ = defer(() =>
    this.form.controls.appliedFromYearMonth.valueChanges.pipe(
      startWith(this.form.controls.appliedFromYearMonth.value)
    )
  );

  readonly insuranceKind$ = defer(() =>
    this.form.controls.insuranceKind.valueChanges.pipe(
      startWith(this.form.controls.insuranceKind.value)
    )
  );

  readonly masterBands$ = combineLatest([
    this.currentOfficeService.office$,
    this.insuranceKind$,
    this.appliedFromYearMonth$
  ]).pipe(
    switchMap(([office, insuranceKind, yearMonth]) => {
      if (!office || !insuranceKind || !yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
        return of([]);
      }

      const yearMonthString = yearMonth as YearMonthString;
      if (insuranceKind === 'health') {
        return this.mastersService.getHealthRateTableForYearMonth(office, yearMonthString).pipe(
          map((master) => master?.bands ?? [])
        );
      } else {
        // pension
        return this.mastersService.getPensionRateTableForYearMonth(office, yearMonthString).pipe(
          map((master) => master?.bands ?? [])
        );
      }
    })
  );

  readonly availableStandardMonthlyRewards$: Observable<number[]> = this.masterBands$.pipe(
    map((bands) => {
      // 標準報酬月額のリストを取得し、重複を除去してソート
      const amounts = bands.map((band) => band.standardMonthly);
      return [...new Set(amounts)].sort((a, b) => a - b);
    })
  );

  readonly loadingMasterData$ = combineLatest([
    this.currentOfficeService.office$,
    this.insuranceKind$,
    this.appliedFromYearMonth$,
    this.availableStandardMonthlyRewards$
  ]).pipe(
    map(([office, insuranceKind, yearMonth, amounts]) => {
      // 条件が満たされていて、まだデータが取得されていない場合のみローディング
      const isValid = !!(office && insuranceKind && yearMonth && /^\d{4}-\d{2}$/.test(yearMonth));
      // データが取得されたら（空配列でも）ローディング終了
      // ただし、yearMonthが空文字列の場合はローディングしない
      return isValid && yearMonth !== '' && amounts.length === 0;
    })
  );

  readonly hintMessage$ = combineLatest([
    this.appliedFromYearMonth$,
    this.availableStandardMonthlyRewards$
  ]).pipe(
    map(([yearMonth, amounts]) => {
      // 適用開始年月が未入力または空文字列の場合
      if (!yearMonth || yearMonth === '') {
        return '適用開始年月を選択してから標準報酬月額を選択してください';
      }
      // 適用開始年月が有効な形式で、マスターデータが見つからない場合
      if (/^\d{4}-\d{2}$/.test(yearMonth) && (!amounts || amounts.length === 0)) {
        return '適用開始年月に有効なマスターデータが見つかりません。保険料率管理ページでマスターデータを登録してください。';
      }
      // それ以外の場合はヒントを表示しない
      return null;
    })
  );

  constructor(
    public readonly dialogRef: MatDialogRef<StandardRewardHistoryFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: StandardRewardHistoryFormDialogData
  ) {
    if (data.history) {
      this.form.patchValue({
        insuranceKind: data.history.insuranceKind,
        appliedFromYearMonth: data.history.appliedFromYearMonth,
        standardMonthlyReward: data.history.standardMonthlyReward,
        grade: data.history.grade ?? null,
        decisionKind: data.history.decisionKind,
        note: data.history.note ?? ''
      });
    }

    // 保険種別が変更されたときも重複チェックを再実行
    this.form.controls.insuranceKind.valueChanges.subscribe(() => {
      this.form.controls.appliedFromYearMonth.updateValueAndValidity();
    });

    // 保険種別または適用開始年月が変更されたとき、標準報酬月額の選択肢が変更される
    // 現在選択されている値が新しい選択肢に含まれていない場合は、nullにリセット
    combineLatest([this.insuranceKind$, this.appliedFromYearMonth$, this.availableStandardMonthlyRewards$]).subscribe(
      ([, , availableAmounts]) => {
        const currentValue = this.form.controls.standardMonthlyReward.value;
        if (currentValue !== null && !availableAmounts.includes(currentValue)) {
          this.form.controls.standardMonthlyReward.setValue(null);
          this.form.controls.grade.setValue(null);
        }
      }
    );

    // 標準報酬月額が変更されたとき、マスターデータから対応する等級を自動設定
    // 保険種別と適用開始年月も監視して、正しいマスターデータを参照する
    combineLatest([
      this.form.controls.standardMonthlyReward.valueChanges.pipe(startWith(this.form.controls.standardMonthlyReward.value)),
      this.form.controls.insuranceKind.valueChanges.pipe(startWith(this.form.controls.insuranceKind.value)),
      this.form.controls.appliedFromYearMonth.valueChanges.pipe(startWith(this.form.controls.appliedFromYearMonth.value)),
      this.currentOfficeService.office$
    ]).pipe(
      switchMap(([standardMonthlyReward, insuranceKind, appliedFromYearMonth, office]) => {
        if (!standardMonthlyReward || !insuranceKind || !appliedFromYearMonth || !office || !/^\d{4}-\d{2}$/.test(appliedFromYearMonth)) {
          return of(null);
        }
        const yearMonthString = appliedFromYearMonth as YearMonthString;
        if (insuranceKind === 'health') {
          return this.mastersService.getHealthRateTableForYearMonth(office, yearMonthString).pipe(
            map((master) => ({ standardMonthlyReward, bands: master?.bands ?? [] }))
          );
        } else {
          // pension
          return this.mastersService.getPensionRateTableForYearMonth(office, yearMonthString).pipe(
            map((master) => ({ standardMonthlyReward, bands: master?.bands ?? [] }))
          );
        }
      })
    ).subscribe((result) => {
      if (result && result.standardMonthlyReward != null && result.bands.length > 0) {
        // 標準報酬月額に対応する等級を検索（最初に見つかったものを使用）
        const matchingBand = result.bands.find((band) => band.standardMonthly === result.standardMonthlyReward);
        if (matchingBand) {
          this.form.controls.grade.setValue(matchingBand.grade, { emitEvent: false });
        }
      }
    });
  }

  private duplicateValidator(): AsyncValidatorFn {
    return (control: AbstractControl) => {
      const insuranceKind = this.form.controls.insuranceKind.value;
      const appliedFromYearMonth = control.value;

      // 基本バリデーションをパスしていない場合はスキップ
      if (!insuranceKind || !appliedFromYearMonth || !/^\d{4}-\d{2}$/.test(appliedFromYearMonth)) {
        return Promise.resolve(null);
      }

      return firstValueFrom(
        this.standardRewardHistoryService
          .listByInsuranceKind(this.data.officeId, this.data.employeeId, insuranceKind)
          .pipe(
            map((histories) => {
              // 編集時は自分自身を除外
              const existingHistories = histories.filter(
                (h) => !this.data.history || h.id !== this.data.history.id
              );

              const isDuplicate = existingHistories.some(
                (h) => h.appliedFromYearMonth === appliedFromYearMonth
              );

              return isDuplicate ? { duplicate: true } : null;
            })
          )
      );
    };
  }

  protected readonly getStandardRewardDecisionKindLabel =
    getStandardRewardDecisionKindLabel;

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    const payload: Partial<StandardRewardHistory> & { id?: string } = {
      id: this.data.history?.id,
      insuranceKind: value.insuranceKind,
      appliedFromYearMonth: value.appliedFromYearMonth,
      standardMonthlyReward: Number(value.standardMonthlyReward),
      grade: value.grade != null ? Number(value.grade) : undefined,
      decisionKind: value.decisionKind as StandardRewardDecisionKind,
      note: value.note?.trim() || undefined,
      createdAt: this.data.history?.createdAt,
      createdByUserId: this.data.history?.createdByUserId
    };

    this.dialogRef.close(payload);
  }
}
