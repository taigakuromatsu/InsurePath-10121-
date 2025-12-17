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

import { Employee, InsuranceKind, StandardRewardDecisionKind, StandardRewardHistory, YearMonthString } from '../../types';
import { getStandardRewardDecisionKindLabel } from '../../utils/label-utils';
import { StandardRewardHistoryService } from '../../services/standard-reward-history.service';
import { MastersService } from '../../services/masters.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { EmployeesService } from '../../services/employees.service';
import { OfficesService } from '../../services/offices.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { calculateStandardRewardsFromSalary } from '../../utils/standard-reward-calculator';
import {
  StandardRewardAutoInputConfirmDialogComponent,
  StandardRewardAutoInputConfirmDialogData
} from './standard-reward-auto-input-confirm-dialog.component';

export interface StandardRewardHistoryFormDialogData {
  officeId: string;
  employeeId: string;
  employee?: Employee;
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
    MatSnackBarModule,
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
        <mat-select formControlName="insuranceKind" required [disabled]="!!data.history">
          <mat-option value="health">健康保険</mat-option>
          <mat-option value="pension">厚生年金</mat-option>
        </mat-select>
        <mat-error *ngIf="form.controls.insuranceKind.hasError('required')">
          保険種別を選択してください
        </mat-error>
        <mat-hint *ngIf="data.history">編集時は保険種別を変更できません</mat-hint>
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

      <mat-form-field appearance="outline" class="full-width readonly-field" *ngIf="insurableMonthlyWage$ | async as wage">
        <mat-label>報酬月額（参照）</mat-label>
        <input matInput [value]="wage | number" readonly />
        <mat-hint>報酬月額は従業員フォームで編集してください。</mat-hint>
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

      <!-- 自動追加ボタン -->
      <div class="auto-add-section" *ngIf="(insurableMonthlyWage$ | async) != null && (insurableMonthlyWage$ | async)! > 0">
        <div class="auto-add-buttons">
          <button
            mat-stroked-button
            type="button"
            color="primary"
            [disabled]="!canExecuteAutoAdd('health')"
            (click)="onAutoAddHistoryClick('health')"
            class="auto-add-button"
            [matTooltip]="'報酬月額から保険マスタデータの等級表をもとに標準報酬履歴を自動追加します。'"
            matTooltipPosition="above"
          >
            <mat-icon>auto_fix_high</mat-icon>
            <span>報酬月額から自動追加（健保）</span>
          </button>
          <button
            mat-stroked-button
            type="button"
            color="primary"
            [disabled]="!canExecuteAutoAdd('pension')"
            (click)="onAutoAddHistoryClick('pension')"
            class="auto-add-button"
            [matTooltip]="'報酬月額から保険マスタデータの等級表をもとに標準報酬履歴を自動追加します。'"
            matTooltipPosition="above"
          >
            <mat-icon>auto_fix_high</mat-icon>
            <span>報酬月額から自動追加（厚年）</span>
          </button>
        </div>
      </div>
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

      .auto-add-section {
        margin-top: 16px;
        padding: 16px;
        background-color: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
      }

      .auto-add-buttons {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .auto-add-button {
        flex: 1;
        min-width: 200px;
      }

      @media (max-width: 600px) {
        .auto-add-buttons {
          flex-direction: column;
        }

        .auto-add-button {
          width: 100%;
        }
      }
    `
  ]
})
export class StandardRewardHistoryFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly standardRewardHistoryService = inject(StandardRewardHistoryService);
  private readonly mastersService = inject(MastersService);
  private readonly currentOfficeService = inject(CurrentOfficeService);
  private readonly employeesService = inject(EmployeesService);
  private readonly officesService = inject(OfficesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

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

  readonly masterBands$: Observable<{ standardMonthly: number; grade: number }[] | null> = combineLatest([
    this.currentOfficeService.office$,
    this.insuranceKind$,
    this.appliedFromYearMonth$
  ]).pipe(
    switchMap(([office, insuranceKind, yearMonth]) => {
      if (!office || !insuranceKind || !yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
        return of(null);
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
      // nullの場合は空配列を返す
      if (!bands) {
        return [];
      }
      // 標準報酬月額のリストを取得し、重複を除去してソート
      const amounts = bands.map((band) => band.standardMonthly);
      return [...new Set(amounts)].sort((a, b) => a - b);
    })
  );

  readonly loadingMasterData$ = combineLatest([
    this.currentOfficeService.office$,
    this.insuranceKind$,
    this.appliedFromYearMonth$,
    this.masterBands$
  ]).pipe(
    map(([office, insuranceKind, yearMonth, bands]) => {
      // 条件が満たされていて、まだデータが取得されていない場合（null）のみローディング
      const isValid = !!(office && insuranceKind && yearMonth && /^\d{4}-\d{2}$/.test(yearMonth));
      // nullの間だけローディング（空配列の場合はローディング終了）
      return isValid && yearMonth !== '' && bands === null;
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

  /**
   * 報酬月額を取得（従業員マスタから）
   */
  readonly insurableMonthlyWage$: Observable<number | null>;

  constructor(
    public readonly dialogRef: MatDialogRef<StandardRewardHistoryFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: StandardRewardHistoryFormDialogData
  ) {
    // 報酬月額を取得（従業員マスタから）
    this.insurableMonthlyWage$ = data.employee
      ? of(data.employee.payrollSettings?.insurableMonthlyWage ?? null)
      : this.employeesService.get(this.data.officeId, this.data.employeeId).pipe(
          map((employee) => employee?.payrollSettings?.insurableMonthlyWage ?? null)
        );

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

  /**
   * 自動追加ボタンが実行可能かどうかを判定
   */
  canExecuteAutoAdd(insuranceKind: 'health' | 'pension'): boolean {
    const appliedFromYearMonth = this.form.get('appliedFromYearMonth')?.value;
    // 適用開始年月が有効な形式であることを確認
    return !!(appliedFromYearMonth && /^\d{4}-\d{2}$/.test(appliedFromYearMonth));
  }

  /**
   * 自動追加ボタンクリック時の処理
   */
  async onAutoAddHistoryClick(insuranceKind: 'health' | 'pension'): Promise<void> {
    const appliedFromYearMonth = this.form.get('appliedFromYearMonth')?.value as YearMonthString | null;
    const insurableMonthlyWage = await firstValueFrom(this.insurableMonthlyWage$);

    if (!appliedFromYearMonth || !insurableMonthlyWage || insurableMonthlyWage <= 0) {
      return;
    }

    // オフィス情報を取得
    const office = await firstValueFrom(this.officesService.watchOffice(this.data.officeId));
    if (!office) {
      return;
    }

    // 標準報酬を計算
    const calcResult = await calculateStandardRewardsFromSalary(
      office,
      insurableMonthlyWage,
      appliedFromYearMonth,
      this.mastersService
    );

    // 保険種別に応じた値を取得
    const grade = insuranceKind === 'health' ? calcResult.healthGrade : calcResult.pensionGrade;
    const standardMonthly = insuranceKind === 'health' ? calcResult.healthStandardMonthly : calcResult.pensionStandardMonthly;
    const error = insuranceKind === 'health' ? calcResult.errors.health : calcResult.errors.pension;

    // エラーがある場合は処理を中断
    if (error) {
      this.snackBar.open(error, undefined, {
        duration: 5000
      });
      return;
    }

    // 値がない場合は処理を中断
    if (!grade || !standardMonthly) {
      this.snackBar.open('標準報酬を計算できませんでした。', undefined, {
        duration: 3000
      });
      return;
    }

    // 同月キー重複チェック
    try {
      const existingHistories = await firstValueFrom(
        this.standardRewardHistoryService.listByInsuranceKind(
          this.data.officeId,
          this.data.employeeId,
          insuranceKind
        )
      );

      const isDuplicate = existingHistories.some(
        (h) => h.appliedFromYearMonth === appliedFromYearMonth && (!this.data.history || h.id !== this.data.history.id)
      );

      if (isDuplicate) {
        this.snackBar.open(
          `この保険種別・適用開始年月（${appliedFromYearMonth}）の履歴が既に存在します。既存の履歴を編集してください。`,
          '閉じる',
          { duration: 5000 }
        );
        return;
      }
    } catch (error) {
      console.error('重複チェックに失敗しました:', error);
      this.snackBar.open('重複チェックに失敗しました。', undefined, {
        duration: 3000
      });
      return;
    }

    // 確認ダイアログを表示
    const dialogRef = this.dialog.open<
      StandardRewardAutoInputConfirmDialogComponent,
      StandardRewardAutoInputConfirmDialogData,
      'add' | 'cancel'
    >(StandardRewardAutoInputConfirmDialogComponent, {
      width: '600px',
      disableClose: true,
      data: {
        salary: insurableMonthlyWage,
        decisionYearMonth: appliedFromYearMonth,
        healthGrade: insuranceKind === 'health' ? grade : null,
        healthStandardMonthly: insuranceKind === 'health' ? standardMonthly : null,
        pensionGrade: insuranceKind === 'pension' ? grade : null,
        pensionStandardMonthly: insuranceKind === 'pension' ? standardMonthly : null,
        healthError: insuranceKind === 'health' ? null : null,
        pensionError: insuranceKind === 'pension' ? null : null
      }
    });

    const result = await firstValueFrom(dialogRef.afterClosed());

    if (result === 'add') {
      // 履歴を追加（B案：保存して閉じる）
      try {
        await this.standardRewardHistoryService.save(this.data.officeId, this.data.employeeId, {
          insuranceKind,
          appliedFromYearMonth,
          standardMonthlyReward: standardMonthly,
          grade,
          decisionKind: 'other',
          note: `報酬月額${insurableMonthlyWage.toLocaleString()}円を基に算出`
        });

        this.snackBar.open('標準報酬履歴を追加しました', undefined, {
          duration: 3000
        });

        // ダイアログを閉じる（B案：保存して完了）
        this.dialogRef.close();
      } catch (error) {
        console.error('標準報酬履歴の追加に失敗しました:', error);
        this.snackBar.open('標準報酬履歴の追加に失敗しました。', undefined, {
          duration: 3000
        });
      }
    }
  }

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
      decisionKind: value.decisionKind as StandardRewardDecisionKind
    };

    // gradeが設定されている場合のみ追加（undefinedはFirestoreに保存できない）
    if (value.grade != null) {
      payload.grade = Number(value.grade);
    }

    // noteが設定されている場合のみ追加（undefinedはFirestoreに保存できない）
    const note = value.note?.trim();
    if (note) {
      payload.note = note;
    }

    // 編集時のみcreatedAt/createdByUserIdを追加
    if (this.data.history) {
      if (this.data.history.createdAt) {
        payload.createdAt = this.data.history.createdAt;
      }
      if (this.data.history.createdByUserId) {
        payload.createdByUserId = this.data.history.createdByUserId;
      }
    }

    this.dialogRef.close(payload);
  }
}
