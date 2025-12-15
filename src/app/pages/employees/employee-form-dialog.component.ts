import { Component, DestroyRef, Inject, inject } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgFor, NgIf } from '@angular/common';
import { HelpDialogComponent, HelpDialogData } from '../../components/help-dialog.component';
import {
  StandardRewardAutoInputConfirmDialogComponent,
  StandardRewardAutoInputConfirmDialogData
} from './standard-reward-auto-input-confirm-dialog.component';
import {
  StandardRewardHistoryAddConfirmDialogComponent,
  StandardRewardHistoryAddConfirmDialogData
} from './standard-reward-history-add-confirm-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../components/confirm-dialog.component';

import { EmployeesService } from '../../services/employees.service';
import { StandardRewardHistoryService } from '../../services/standard-reward-history.service';
import {
  BankAccountType,
  Employee,
  PayrollPayCycle,
  PayrollPayType,
  GradeDecisionSource,
  Sex,
  YearMonthString,
  ExemptionKind,
  PremiumExemptionMonth,
  StandardRewardHistory
} from '../../types';
import { CurrentUserService } from '../../services/current-user.service';
import { combineLatest, firstValueFrom, map, Observable, of, startWith, switchMap } from 'rxjs';
import { MyNumberService } from '../../services/mynumber.service';
import { OfficesService } from '../../services/offices.service';
import { MastersService } from '../../services/masters.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { calculateStandardRewardsFromSalary } from '../../utils/standard-reward-calculator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface EmployeeDialogData {
  employee?: Employee;
  officeId: string;
}

@Component({
  selector: 'ip-employee-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    NgIf,
    NgFor,
    AsyncPipe,
    DecimalPipe
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">{{ data.employee ? 'edit' : 'person_add' }}</mat-icon>
      <span>{{ data.employee ? '従業員を編集' : '従業員を追加' }}</span>
      <span *ngIf="data.employee && form.get('name')?.value" class="employee-name">
        （{{ form.get('name')?.value }}）
      </span>
    </h1>
    <form class="dense-form" [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content autocomplete="off">
      <div class="form-section">
        <h3 class="mat-h3 flex-row align-center gap-2 mb-3">
          <mat-icon>person</mat-icon>
          基本情報
        </h3>
        <div class="form-grid">
      <mat-form-field appearance="outline">
        <mat-label>氏名</mat-label>
        <input matInput formControlName="name" required />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>カナ</mat-label>
        <input matInput formControlName="kana" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>生年月日</mat-label>
        <input matInput formControlName="birthDate" type="date" required />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>所属</mat-label>
        <input matInput formControlName="department" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>入社日</mat-label>
        <input matInput formControlName="hireDate" type="date" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>退社日</mat-label>
        <input matInput formControlName="retireDate" type="date" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>住所</mat-label>
        <textarea matInput formControlName="address" rows="1"></textarea>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>電話番号</mat-label>
        <input matInput formControlName="phone" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>連絡先メール</mat-label>
        <input matInput formControlName="contactEmail" type="email" autocomplete="off" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>社員番号</mat-label>
        <input matInput formControlName="employeeCodeInOffice" />
        <mat-hint>整理番号などを入力してください</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>性別</mat-label>
        <mat-select formControlName="sex">
          <mat-option [value]="null">未選択</mat-option>
          <mat-option value="male">男</mat-option>
          <mat-option value="female">女</mat-option>
          <mat-option value="other">その他</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>郵便番号</mat-label>
        <input
          matInput
          formControlName="postalCode"
          placeholder="1234567"
          maxlength="7"
          name="employee-postal-code"
          autocomplete="off"
          inputmode="numeric"
        />
        <mat-hint>7桁の数字（ハイフンなし）</mat-hint>
        <mat-error *ngIf="form.get('postalCode')?.hasError('pattern')">
          7桁の数字を入力してください
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>住所カナ</mat-label>
        <textarea matInput formControlName="addressKana" rows="1"></textarea>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>マイナンバー</mat-label>
        <input
          matInput
          formControlName="myNumber"
          placeholder="123456789012"
          maxlength="12"
          type="password"
          name="employee-my-number"
          autocomplete="new-password"
          inputmode="numeric"
        />

        <!-- 左側ヒント：入力方法 -->
        <mat-hint align="start">12桁の数字（入力時は非表示）</mat-hint>

        <mat-error *ngIf="form.get('myNumber')?.hasError('invalidMyNumber')">
          正しい形式のマイナンバーを入力してください（12桁の数字）
        </mat-error>

        <!-- 右側ヒント：登録済みのマスク表示 -->
        <mat-hint *ngIf="maskedMyNumber" align="end">
          登録済み: {{ maskedMyNumber }}
        </mat-hint>
      </mat-form-field>

        </div>
      </div>

      <div class="form-section">
        <h3 class="mat-h3 flex-row align-center gap-2 mb-3">
          <mat-icon>work</mat-icon>
          就労条件
        </h3>
        <div class="form-grid">
      <mat-form-field appearance="outline">
        <mat-label>雇用形態</mat-label>
        <mat-select formControlName="employmentType">
          <mat-option [value]="''">未選択</mat-option>
          <mat-option value="regular">正社員</mat-option>
          <mat-option value="contract">契約社員</mat-option>
          <mat-option value="part">パート</mat-option>
          <mat-option value="アルバイト">アルバイト</mat-option>
          <mat-option value="other">その他</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>所定労働時間（週）</mat-label>
        <input matInput type="number" formControlName="weeklyWorkingHours" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>所定労働日数（週）</mat-label>
        <input matInput type="number" formControlName="weeklyWorkingDays" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>雇用契約期間の見込み</mat-label>
        <textarea matInput formControlName="contractPeriodNote" rows="1"></textarea>
      </mat-form-field>

          <div class="toggle-field">
      <mat-slide-toggle formControlName="isStudent">学生</mat-slide-toggle>
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3 class="mat-h3 flex-row align-center gap-2 mb-3">
          <mat-icon>account_balance</mat-icon>
          社会保険関連
        </h3>
        <div class="form-grid">
          <!-- 社会保険対象（独立した行） -->
          <div class="toggle-field full-row">
      <mat-slide-toggle formControlName="isInsured">社会保険対象</mat-slide-toggle>
          </div>

          <!-- 給与情報（標準報酬決定用） -->
          <mat-form-field appearance="outline">
            <mat-label>支給形態</mat-label>
            <mat-select formControlName="payrollPayType">
              <mat-option [value]="''">未選択</mat-option>
              <mat-option value="monthly">月給</mat-option>
              <mat-option value="daily">日給</mat-option>
              <mat-option value="hourly">時給</mat-option>
              <mat-option value="annual">年俸</mat-option>
              <mat-option value="other">その他</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>支給サイクル</mat-label>
            <mat-select formControlName="payrollPayCycle">
              <mat-option [value]="''">未選択</mat-option>
              <mat-option value="monthly">月次</mat-option>
              <mat-option value="twice_per_month">月2回</mat-option>
              <mat-option value="weekly">週次</mat-option>
              <mat-option value="other">その他</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>報酬月額（円）</mat-label>
            <input matInput formControlName="payrollInsurableMonthlyWage" />
            <mat-hint>標準報酬月額を概算するための月額給与</mat-hint>
            <mat-error *ngIf="form.get('payrollInsurableMonthlyWage')?.hasError('min')">
          1以上の数値を入力してください
            </mat-error>
            <mat-error *ngIf="form.get('payrollInsurableMonthlyWage')?.hasError('pattern')">
              数字のみを入力してください
            </mat-error>
          </mat-form-field>

      <!-- 標準報酬セクション -->
      <div class="standard-reward-section">
        <!-- 最新の標準報酬履歴見出し -->
        <h4 class="latest-standard-reward-title">最新の標準報酬履歴</h4>

        <!-- ヘッダー行：適用開始年月と自動計算ボタン -->
        <div class="standard-reward-header">
          <mat-form-field appearance="outline" class="decision-year-month-field">
            <mat-label>適用開始年月</mat-label>
            <input matInput type="month" formControlName="decisionYearMonth" />
          </mat-form-field>
          <button
            mat-stroked-button
            type="button"
            color="primary"
            [disabled]="!canExecuteAutoInput"
            (click)="onAutoInputButtonClick()"
            class="auto-calc-button"
          >
            <mat-icon>auto_fix_high</mat-icon>
            <span>報酬月額から概算して標準報酬を自動入力</span>
          </button>
        </div>

        <!-- 説明文（コンパクト） -->
        <div class="standard-reward-hint">
          <mat-icon class="hint-icon">info</mat-icon>
          <div class="hint-content">
            <p class="hint-text">報酬月額と標準報酬は別管理です。標準報酬は"履歴"に追加した内容が保険料計算で使用されます。</p>
            <p class="hint-text">現在の報酬月額の金額が必ずしも標準報酬月額や等級範囲と一致するとは限りません（例：通勤費の有無などで金額に幅がある場合など）。</p>
            <p class="hint-text">自動入力はあくまでも報酬月額をもとにした概算なので、標準報酬月額は年金機構によって決められた額を確認して正しいものを選択してください。</p>
          </div>
        </div>

        <!-- 健康保険と厚生年金を2カラムで表示 -->
        <div class="standard-reward-grid">
          <!-- 健康保険カラム -->
          <div class="insurance-column">
            <div class="insurance-header">
              <mat-icon class="insurance-icon">local_hospital</mat-icon>
              <span class="insurance-title">健康保険</span>
            </div>
            <div class="grade-reward-row">
              <mat-form-field appearance="outline" class="grade-field">
                <mat-label>等級</mat-label>
                <input matInput type="number" formControlName="healthGrade" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="reward-field">
                <mat-label>標準報酬</mat-label>
                <mat-select formControlName="healthStandardMonthly" [disabled]="!(availableHealthStandardMonthlyRewards$ | async)?.length">
                  <mat-option *ngFor="let amount of availableHealthStandardMonthlyRewards$ | async" [value]="amount">
                    {{ amount | number }}円
                  </mat-option>
                </mat-select>
                <mat-spinner *ngIf="loadingHealthMasterData$ | async" diameter="20" matPrefix class="inline-spinner"></mat-spinner>
                <mat-hint *ngIf="healthCalculationError" style="color:#d32f2f">
                  {{ healthCalculationError }}
                </mat-hint>
                <mat-hint *ngIf="healthHintMessage$ | async as hintMessage">
                  {{ hintMessage }}
                </mat-hint>
              </mat-form-field>
            </div>
            <button
              mat-stroked-button
              type="button"
              color="primary"
              [disabled]="!canAddHealthHistory"
              (click)="onAddHistoryClick('health')"
              class="add-history-button-compact"
            >
              <mat-icon>add</mat-icon>
              <span>履歴に追加</span>
            </button>
          </div>

          <!-- 厚生年金カラム -->
          <div class="insurance-column">
            <div class="insurance-header">
              <mat-icon class="insurance-icon">account_balance</mat-icon>
              <span class="insurance-title">厚生年金</span>
            </div>
            <div class="grade-reward-row">
              <mat-form-field appearance="outline" class="grade-field">
                <mat-label>等級</mat-label>
                <input matInput type="number" formControlName="pensionGrade" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="reward-field">
                <mat-label>標準報酬</mat-label>
                <mat-select formControlName="pensionStandardMonthly" [disabled]="!(availablePensionStandardMonthlyRewards$ | async)?.length">
                  <mat-option *ngFor="let amount of availablePensionStandardMonthlyRewards$ | async" [value]="amount">
                    {{ amount | number }}円
                  </mat-option>
                </mat-select>
                <mat-spinner *ngIf="loadingPensionMasterData$ | async" diameter="20" matPrefix class="inline-spinner"></mat-spinner>
                <mat-hint *ngIf="pensionCalculationError" style="color:#d32f2f">
                  {{ pensionCalculationError }}
                </mat-hint>
                <mat-hint *ngIf="pensionHintMessage$ | async as hintMessage">
                  {{ hintMessage }}
                </mat-hint>
              </mat-form-field>
            </div>
            <button
              mat-stroked-button
              type="button"
              color="primary"
              [disabled]="!canAddPensionHistory"
              (click)="onAddHistoryClick('pension')"
              class="add-history-button-compact"
            >
              <mat-icon>add</mat-icon>
              <span>履歴に追加</span>
            </button>
          </div>
        </div>
      </div>

      <mat-form-field appearance="outline">
        <mat-label>被保険者記号</mat-label>
        <input matInput formControlName="healthInsuredSymbol" />
      </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>被保険者番号</mat-label>
          <input matInput formControlName="healthInsuredNumber" />
        </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>厚生年金番号</mat-label>
        <input matInput formControlName="pensionNumber" />
      </mat-form-field>

          <mat-form-field appearance="outline" class="full-row">
            <mat-label>補足メモ（給与情報）</mat-label>
            <textarea matInput rows="2" formControlName="payrollNote"></textarea>
      </mat-form-field>
        </div>
      </div>

      <div class="form-section">
        <h3 class="mat-h3 flex-row align-center gap-2 mb-3">
          <mat-icon>account_balance_wallet</mat-icon>
          給与振込口座情報
        </h3>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>金融機関名</mat-label>
            <input matInput formControlName="bankAccountBankName" />
            <mat-error *ngIf="form.get('bankAccountBankName')?.hasError('required')">
              金融機関名を入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>金融機関コード</mat-label>
            <input matInput formControlName="bankAccountBankCode" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>支店名</mat-label>
            <input matInput formControlName="bankAccountBranchName" />
            <mat-error *ngIf="form.get('bankAccountBranchName')?.hasError('required')">
              支店名を入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>支店コード</mat-label>
            <input matInput formControlName="bankAccountBranchCode" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>口座種別</mat-label>
            <mat-select formControlName="bankAccountAccountType">
              <mat-option value="ordinary">普通</mat-option>
              <mat-option value="checking">当座</mat-option>
              <mat-option value="savings">貯蓄</mat-option>
              <mat-option value="other">その他</mat-option>
            </mat-select>
            <mat-error *ngIf="form.get('bankAccountAccountType')?.hasError('required')">
              口座種別を選択してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>口座番号</mat-label>
            <input matInput formControlName="bankAccountAccountNumber" />
            <mat-error *ngIf="form.get('bankAccountAccountNumber')?.hasError('required')">
              口座番号を入力してください
            </mat-error>
            <mat-error *ngIf="form.get('bankAccountAccountNumber')?.hasError('pattern')">
              数字のみを入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>名義</mat-label>
            <input matInput formControlName="bankAccountHolderName" />
            <mat-error *ngIf="form.get('bankAccountHolderName')?.hasError('required')">
              名義を入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>名義カナ</mat-label>
            <input matInput formControlName="bankAccountHolderKana" />
          </mat-form-field>
        </div>
      </div>

      <div class="form-section">
        <h3 class="mat-h3 flex-row align-center gap-2 mb-3">
          <mat-icon>local_hospital</mat-icon>
          資格情報（健康保険）
        </h3>
        <div class="form-grid">
      <mat-form-field appearance="outline">
        <mat-label>資格取得日（健保）</mat-label>
        <input matInput type="date" formControlName="healthQualificationDate" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>資格取得区分（健保）</mat-label>
        <mat-select formControlName="healthQualificationKind">
          <mat-option [value]="''">未選択</mat-option>
          <mat-option [value]="'new_hire'">新規採用</mat-option>
          <mat-option [value]="'expansion'">適用拡大</mat-option>
          <mat-option [value]="'hours_change'">所定労働時間変更</mat-option>
          <mat-option [value]="'other'">その他</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>資格喪失日（健保）</mat-label>
        <input matInput type="date" formControlName="healthLossDate" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>喪失理由区分（健保）</mat-label>
        <mat-select formControlName="healthLossReasonKind">
          <mat-option [value]="''">未選択</mat-option>
          <mat-option [value]="'retirement'">退職</mat-option>
          <mat-option [value]="'hours_decrease'">所定労働時間減少</mat-option>
          <mat-option [value]="'death'">死亡</mat-option>
          <mat-option [value]="'other'">その他</mat-option>
        </mat-select>
      </mat-form-field>
        </div>
      </div>

      <div class="form-section">
        <h3 class="mat-h3 flex-row align-center gap-2 mb-3">
          <mat-icon>account_balance</mat-icon>
          資格情報（厚生年金）
        </h3>
        <div class="form-grid">
      <mat-form-field appearance="outline">
        <mat-label>資格取得日（厚年）</mat-label>
        <input matInput type="date" formControlName="pensionQualificationDate" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>資格取得区分（厚年）</mat-label>
        <mat-select formControlName="pensionQualificationKind">
          <mat-option [value]="''">未選択</mat-option>
          <mat-option [value]="'new_hire'">新規採用</mat-option>
          <mat-option [value]="'expansion'">適用拡大</mat-option>
          <mat-option [value]="'hours_change'">所定労働時間変更</mat-option>
          <mat-option [value]="'other'">その他</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>資格喪失日（厚年）</mat-label>
        <input matInput type="date" formControlName="pensionLossDate" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>喪失理由区分（厚年）</mat-label>
        <mat-select formControlName="pensionLossReasonKind">
          <mat-option [value]="''">未選択</mat-option>
          <mat-option [value]="'retirement'">退職</mat-option>
          <mat-option [value]="'hours_decrease'">所定労働時間減少</mat-option>
          <mat-option [value]="'death'">死亡</mat-option>
          <mat-option [value]="'other'">その他</mat-option>
        </mat-select>
      </mat-form-field>
        </div>
      </div>

      <div class="form-section">
        <h3 class="mat-h3 flex-row align-center gap-2 mb-3">
          <mat-icon>event</mat-icon>
          就業状態
        </h3>
        <div class="form-grid">
      <mat-form-field appearance="outline">
        <mat-label>現在の就業状態</mat-label>
        <mat-select formControlName="workingStatus">
          <mat-option [value]="''">未選択</mat-option>
          <mat-option [value]="'normal'">通常勤務</mat-option>
          <mat-option [value]="'maternity_leave'">産前産後休業</mat-option>
          <mat-option [value]="'childcare_leave'">育児休業</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- 免除月（産休/育休）セクション -->
      <div class="exemption-months-section full-row">
        <div class="section-header">
          <h4 class="mat-h4 mb-2">産前産後・育児休業の免除月（月次保険料用）</h4>
          <p class="mat-body-2 hint-text">
            免除月に登録した月は、月次保険料計算で0円として扱われます（制度の詳細判定は行いません）。<br />
            賞与保険料については、システムによる制御は行いません。免除月に該当する従業員の賞与は、賞与登録の際に免除対象かを判断して、免除対象の場合は賞与登録をしないでください。
          </p>
        </div>
        <div formArrayName="premiumExemptionMonths" class="exemption-months-list">
          <div
            *ngFor="let idx of sortedExemptionMonthsIndices; let i = index"
            [formGroupName]="idx"
            class="exemption-month-row"
          >
            <mat-form-field appearance="outline" class="exemption-kind-field">
              <mat-label>種別</mat-label>
              <mat-select formControlName="kind">
                <mat-option value="maternity">産前産後休業</mat-option>
                <mat-option value="childcare">育児休業</mat-option>
        </mat-select>
      </mat-form-field>
            <mat-form-field appearance="outline" class="exemption-yearmonth-field">
              <mat-label>対象年月</mat-label>
              <input matInput type="month" formControlName="yearMonth" />
              <mat-error *ngIf="exemptionMonthsArray.at(idx).get('yearMonth')?.hasError('duplicate')">
                この年月は既に登録されています
              </mat-error>
            </mat-form-field>
            <button
              mat-icon-button
              color="warn"
              type="button"
              (click)="removeExemptionMonth(idx)"
              matTooltip="削除"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
        <button
          mat-stroked-button
          color="primary"
          type="button"
          (click)="addExemptionMonth()"
          class="add-exemption-button"
        >
          <mat-icon>add</mat-icon>
          免除月（月次保険料用）を追加
        </button>
      </div>
        </div>
      </div>
    </form>
    <div mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button (click)="onCancel()">
        <mat-icon>close</mat-icon>
        キャンセル
      </button>
        <button mat-flat-button color="primary" (click)="submit()" [disabled]="!canSave">
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
      }

      .dialog-title .employee-name {
        color: rgba(0, 0, 0, 0.6);
        font-weight: normal;
        font-size: 0.9em;
        border-bottom: 1px solid #e0e0e0;
      }

      form[mat-dialog-content] {
        max-height: 70vh;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .form-section {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin: 0;
        padding: 20px 0;
        border-bottom: 1px solid #e0e0e0;
      }

      .form-section:last-child {
        border-bottom: none;
      }

      .form-section:first-child {
        padding-top: 0;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
      }

      /* textareaの高さを通常のinputフィールドと同じにする */
      .form-grid mat-form-field textarea,
      form[mat-dialog-content] mat-form-field textarea {
        min-height: 1.5em;
        line-height: 1.5;
        resize: vertical;
        overflow-y: auto;
      }

      /* すべての入力フィールドの高さを統一 */
      form[mat-dialog-content] mat-form-field {
        height: auto;
      }

      form[mat-dialog-content] mat-form-field .mat-mdc-text-field-wrapper {
        height: auto;
        min-height: 56px;
      }

      form[mat-dialog-content] mat-form-field input,
      form[mat-dialog-content] mat-form-field textarea {
        min-height: 20px;
        line-height: 1.5;
      }

      .field-help-button {
        width: 24px;
        height: 24px;
        margin-left: 6px;
      }

      .field-help-button mat-icon {
        font-size: 18px;
      }

      .toggle-field {
        display: flex;
        align-items: center;
        padding: 4px 0;
      }

      .full-row {
        grid-column: 1 / -1;
      }

      .dialog-actions {
        padding: 12px 16px;
        border-top: 1px solid #e0e0e0;
        background: #fafafa;
      }

      .dialog-actions button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .standard-reward-section {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background-color: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
      }

      .standard-reward-header {
        display: flex;
        align-items: flex-end;
        gap: 12px;
      }

      .decision-year-month-field {
        flex: 0 0 auto;
        width: 240px;
      }

      .decision-year-month-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        margin-top: 0;
      }

      .auto-calc-button {
        height: 40px;
        white-space: nowrap;
        margin-bottom: 16px;
      }

      .standard-reward-hint {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px 12px;
        background-color: #e3f2fd;
        border-radius: 4px;
        font-size: 0.8125rem;
        color: #1976d2;
        line-height: 1.5;
      }

      .standard-reward-hint .hint-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-top: 2px;
        flex-shrink: 0;
      }

      .standard-reward-hint .hint-content {
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .standard-reward-hint .hint-text {
        margin: 0;
        line-height: 1.5;
      }

      .latest-standard-reward-title {
        margin: 0 0 16px 0;
        font-size: 0.9375rem;
        font-weight: 600;
        color: #333;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .standard-reward-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .insurance-column {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        background-color: #fff;
        border-radius: 6px;
        border: 1px solid #e0e0e0;
      }

      .insurance-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e0e0e0;
      }

      .insurance-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #1976d2;
      }

      .insurance-title {
        font-weight: 600;
        font-size: 0.9375rem;
        color: #333;
      }

      .grade-reward-row {
        display: grid;
        grid-template-columns: 100px 1fr;
        gap: 12px;
      }

      .grade-field {
        min-width: 0;
      }

      .reward-field {
        min-width: 0;
      }

      .add-history-button-compact {
        width: 100%;
        height: 36px;
        font-size: 0.875rem;
      }

      @media (max-width: 768px) {
        .standard-reward-grid {
          grid-template-columns: 1fr;
        }
      }

      .exemption-months-section {
        grid-column: 1 / -1;
        padding: 16px;
        background-color: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
      }

      .section-header {
        margin-bottom: 16px;
      }

      .hint-text {
        color: #666;
        font-size: 0.875rem;
        margin-top: 4px;
      }

      .inline-spinner {
        margin-right: 8px;
      }

      .exemption-months-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 12px;
      }

      .exemption-month-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .exemption-kind-field {
        flex: 0 0 200px;
      }

      .exemption-yearmonth-field {
        flex: 0 0 180px;
      }

      .add-exemption-button {
        margin-top: 8px;
      }
    `
  ]
})
export class EmployeeFormDialogComponent {
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<EmployeeFormDialogComponent>);
  private readonly employeesService = inject(EmployeesService);
  private readonly standardRewardHistoryService = inject(StandardRewardHistoryService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly myNumberService = inject(MyNumberService);
  private readonly officesService = inject(OfficesService);
  private readonly mastersService = inject(MastersService);
  private readonly currentOfficeService = inject(CurrentOfficeService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  protected maskedMyNumber: string | null = null;
  protected healthCalculationError: string | null = null;
  protected pensionCalculationError: string | null = null;
  private historyChanged = false;

  private autoCalculatedHealthGrade: number | null = null;
  private autoCalculatedHealthStandardMonthly: number | null = null;
  private autoCalculatedPensionGrade: number | null = null;
  private autoCalculatedPensionStandardMonthly: number | null = null;
  private readonly originalStandardMonthly?: number;
  private previousSalary: number | null = null;
  private previousDecisionYearMonth: YearMonthString | null = null;

  readonly form = inject(FormBuilder).group({
    id: [''],
    name: ['', Validators.required],
    kana: [''],
    birthDate: ['', Validators.required],
    department: [''],
    hireDate: [''],
    retireDate: [''],
    employmentType: [''],
    address: [''],
    phone: [''],
    contactEmail: [''],
    employeeCodeInOffice: [''],
    sex: [null as Sex | null],
    postalCode: ['', [Validators.pattern(/^\d{7}$/)]],
    addressKana: [''],
    myNumber: [
      '',
      [
        (control: any) => {
          // MyNumberService経由でバリデーション（MyNumber関連の処理はMyNumberServiceに集約）
          if (control.value && !this.myNumberService.isValid(control.value)) {
            return { invalidMyNumber: true };
          }
          return null;
        }
      ]
    ],
    weeklyWorkingHours: [null],
    weeklyWorkingDays: [null],
    contractPeriodNote: [''],
    isStudent: [false],
    decisionYearMonth: [this.getCurrentYearMonth()],
    isInsured: [true],
    healthGrade: [null, [Validators.min(1), Validators.max(100)]],
    healthStandardMonthly: [null, [Validators.min(1)]],
    healthGradeSource: [null as GradeDecisionSource | null],
    pensionGrade: [null, [Validators.min(1), Validators.max(100)]],
    pensionStandardMonthly: [null, [Validators.min(1)]],
    pensionGradeSource: [null as GradeDecisionSource | null],
    healthInsuredSymbol: [''],
    healthInsuredNumber: [''],
    pensionNumber: [''],
    healthQualificationDate: [''],
    healthLossDate: [''],
    healthQualificationKind: [''],
    healthLossReasonKind: [''],
    pensionQualificationDate: [''],
    pensionLossDate: [''],
    pensionQualificationKind: [''],
    pensionLossReasonKind: [''],
    workingStatus: [''],
    workingStatusNote: [''],
    premiumExemptionMonths: this.fb.array([] as any[]),
    bankAccountBankName: [''],
    bankAccountBankCode: [''],
    bankAccountBranchName: [''],
    bankAccountBranchCode: [''],
    bankAccountAccountType: [''],
    bankAccountAccountNumber: [
      '',
      [Validators.pattern(/^[0-9]+$/), Validators.maxLength(8)]
    ],
    bankAccountHolderName: [''],
    bankAccountHolderKana: [''],
    payrollPayType: [''],
    payrollPayCycle: [''],
    payrollInsurableMonthlyWage: [null, [Validators.min(1), Validators.pattern(/^\d+$/)]],
    payrollNote: ['']
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: EmployeeDialogData) {
    if (data.employee) {
      const employee = data.employee;
      const maxStandard = Math.max(
        employee.healthStandardMonthly ?? 0,
        employee.pensionStandardMonthly ?? 0
      );
      this.originalStandardMonthly = maxStandard > 0 ? maxStandard : undefined;

      this.form.patchValue({
        ...employee,
        // decisionYearMonthはbindEffectiveStandardRewardで後から設定されるため、ここでは設定しない
        // 新規作成時のみgetCurrentYearMonth()を使用（else節で設定）
        employeeCodeInOffice: employee.employeeCodeInOffice ?? '',
        sex: employee.sex ?? null,
        postalCode: employee.postalCode ?? '',
        addressKana: employee.addressKana ?? '',
        healthGrade: employee.healthGrade ?? null,
        healthStandardMonthly: employee.healthStandardMonthly ?? null,
        healthGradeSource: employee.healthGradeSource ?? null,
        pensionGrade: employee.pensionGrade ?? null,
        pensionStandardMonthly: employee.pensionStandardMonthly ?? null,
        pensionGradeSource: employee.pensionGradeSource ?? null,
        weeklyWorkingHours: employee.weeklyWorkingHours ?? null,
        weeklyWorkingDays: employee.weeklyWorkingDays ?? null,
        healthQualificationDate: employee.healthQualificationDate ?? '',
        healthLossDate: employee.healthLossDate ?? '',
        healthQualificationKind: employee.healthQualificationKind ?? '',
        healthLossReasonKind: employee.healthLossReasonKind ?? '',
        pensionQualificationDate: employee.pensionQualificationDate ?? '',
        pensionLossDate: employee.pensionLossDate ?? '',
        pensionQualificationKind: employee.pensionQualificationKind ?? '',
        pensionLossReasonKind: employee.pensionLossReasonKind ?? '',
        workingStatus: employee.workingStatus ?? '',
        workingStatusNote: employee.workingStatusNote ?? '',
        bankAccountBankName: employee.bankAccount?.bankName ?? '',
        bankAccountBankCode: employee.bankAccount?.bankCode ?? '',
        bankAccountBranchName: employee.bankAccount?.branchName ?? '',
        bankAccountBranchCode: employee.bankAccount?.branchCode ?? '',
        bankAccountAccountType: employee.bankAccount?.accountType ?? '',
        bankAccountAccountNumber: employee.bankAccount?.accountNumber ?? '',
        bankAccountHolderName: employee.bankAccount?.accountHolderName ?? '',
        bankAccountHolderKana: employee.bankAccount?.accountHolderKana ?? '',
        payrollPayType: employee.payrollSettings?.payType ?? '',
        payrollPayCycle: employee.payrollSettings?.payCycle ?? '',
        payrollInsurableMonthlyWage: employee.payrollSettings?.insurableMonthlyWage ?? null,
        payrollNote: employee.payrollSettings?.note ?? ''
      } as any);

      if (employee.myNumber) {
        void this.loadExistingMyNumber(employee.myNumber);
      }

      // 免除月の設定
      if (employee.premiumExemptionMonths && employee.premiumExemptionMonths.length > 0) {
        const exemptionMonthsArray = this.form.get('premiumExemptionMonths') as FormArray;
        exemptionMonthsArray.clear();
        // yearMonth昇順でソート
        const sorted = [...employee.premiumExemptionMonths].sort((a, b) =>
          a.yearMonth.localeCompare(b.yearMonth)
        );
        sorted.forEach((exemption) => {
          exemptionMonthsArray.push(
            this.fb.group({
              kind: [exemption.kind, Validators.required],
              yearMonth: [exemption.yearMonth, Validators.required]
            })
          );
        });
      }

      // 変更前の値を初期化
      this.previousSalary = employee.payrollSettings?.insurableMonthlyWage ?? null;
      this.previousDecisionYearMonth = this.getCurrentYearMonth();
    } else {
      // 新規作成時は初期値を設定
      this.previousSalary = null;
      this.previousDecisionYearMonth = this.getCurrentYearMonth();
    }

    this.setupAutoCalculationSubscriptions();
    
    // 既存の従業員を編集する場合、標準報酬が既に設定されている場合は自動計算をスキップ
    // （手動で上書きした値が自動計算で上書きされるのを防ぐ）
    const isExistingEmployee = !!this.data.employee;
    const hasExistingStandardReward = 
      (this.data.employee?.healthStandardMonthly != null && this.data.employee.healthStandardMonthly > 0) ||
      (this.data.employee?.pensionStandardMonthly != null && this.data.employee.pensionStandardMonthly > 0);
    
    const salaryInit = this.form.get('payrollInsurableMonthlyWage')?.value;
    if (salaryInit && salaryInit > 0 && !(isExistingEmployee && hasExistingStandardReward)) {
      void this.recalculateStandardRewardsFromForm();
    }

    // 既存の従業員を編集する場合、最新のemployeeをwatchして反映
    if (isExistingEmployee && this.data.employee?.id) {
      this.watchEmployeeAndUpdateForm(this.data.employee.id);
      this.bindEffectiveStandardReward(this.data.employee.id);
    }

    // 標準報酬月額の選択肢が変更されたとき、現在の値が選択肢に含まれていない場合はリセット
    combineLatest([
      this.availableHealthStandardMonthlyRewards$,
      this.availablePensionStandardMonthlyRewards$
    ]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([healthAmounts, pensionAmounts]) => {
      const currentHealth = this.form.get('healthStandardMonthly')?.value;
      if (currentHealth != null && typeof currentHealth === 'number' && healthAmounts && healthAmounts.length > 0 && !healthAmounts.includes(currentHealth)) {
        this.form.get('healthStandardMonthly')?.setValue(null);
      }
      const currentPension = this.form.get('pensionStandardMonthly')?.value;
      if (currentPension != null && typeof currentPension === 'number' && pensionAmounts && pensionAmounts.length > 0 && !pensionAmounts.includes(currentPension)) {
        this.form.get('pensionStandardMonthly')?.setValue(null);
      }
    });
  }

  readonly decisionYearMonth$ = this.form.get('decisionYearMonth')!.valueChanges.pipe(
    startWith(this.form.get('decisionYearMonth')!.value)
  );

  readonly availableHealthStandardMonthlyRewards$: Observable<number[]> = combineLatest([
    this.currentOfficeService.office$,
    this.decisionYearMonth$
  ]).pipe(
    switchMap(([office, yearMonth]) => {
      if (!office || !yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
        return of([]);
      }

      const yearMonthString = yearMonth as YearMonthString;
      return this.mastersService.getHealthRateTableForYearMonth(office, yearMonthString).pipe(
        map((master) => {
          if (!master || !master.bands) return [];
          // 標準報酬月額のリストを取得し、重複を除去してソート
          const amounts = master.bands.map((band) => band.standardMonthly);
          return [...new Set(amounts)].sort((a, b) => a - b);
        })
      );
    })
  );

  readonly availablePensionStandardMonthlyRewards$: Observable<number[]> = combineLatest([
    this.currentOfficeService.office$,
    this.decisionYearMonth$
  ]).pipe(
    switchMap(([office, yearMonth]) => {
      if (!office || !yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
        return of([]);
      }

      const yearMonthString = yearMonth as YearMonthString;
      return this.mastersService.getPensionRateTableForYearMonth(office, yearMonthString).pipe(
        map((master) => {
          if (!master || !master.bands) return [];
          // 標準報酬月額のリストを取得し、重複を除去してソート
          const amounts = master.bands.map((band) => band.standardMonthly);
          return [...new Set(amounts)].sort((a, b) => a - b);
        })
      );
    })
  );

  readonly loadingHealthMasterData$ = combineLatest([
    this.currentOfficeService.office$,
    this.decisionYearMonth$,
    this.availableHealthStandardMonthlyRewards$
  ]).pipe(
    map(([office, yearMonth, amounts]) => {
      // 条件が満たされていて、まだデータが取得されていない場合のみローディング
      const isValid = !!(office && yearMonth && /^\d{4}-\d{2}$/.test(yearMonth));
      // データが取得されたら（空配列でも）ローディング終了
      // ただし、yearMonthが空文字列の場合はローディングしない
      return isValid && yearMonth !== '' && amounts.length === 0;
    })
  );

  readonly loadingPensionMasterData$ = combineLatest([
    this.currentOfficeService.office$,
    this.decisionYearMonth$,
    this.availablePensionStandardMonthlyRewards$
  ]).pipe(
    map(([office, yearMonth, amounts]) => {
      // 条件が満たされていて、まだデータが取得されていない場合のみローディング
      const isValid = !!(office && yearMonth && /^\d{4}-\d{2}$/.test(yearMonth));
      // データが取得されたら（空配列でも）ローディング終了
      // ただし、yearMonthが空文字列の場合はローディングしない
      return isValid && yearMonth !== '' && amounts.length === 0;
    })
  );

  readonly healthHintMessage$ = combineLatest([
    this.decisionYearMonth$,
    this.availableHealthStandardMonthlyRewards$
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

  readonly pensionHintMessage$ = combineLatest([
    this.decisionYearMonth$,
    this.availablePensionStandardMonthlyRewards$
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

  private setupAutoCalculationSubscriptions(): void {

    this.form
      .get('healthGrade')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onHealthGradeChanged(value));
    this.form
      .get('healthStandardMonthly')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onHealthStandardMonthlyChanged(value));
    this.form
      .get('pensionGrade')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onPensionGradeChanged(value));
    this.form
      .get('pensionStandardMonthly')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onPensionStandardMonthlyChanged(value));
  }

  private async onSalaryOrDecisionYearMonthChanged(
    newSalary: number | null,
    newDecisionYearMonth: YearMonthString | null,
    previousSalaryValue: number | null | undefined,
    previousDecisionYearMonthValue: YearMonthString | null | undefined
  ): Promise<void> {
    const currentSalary = newSalary ?? this.form.get('payrollInsurableMonthlyWage')?.value;
    const currentDecisionYearMonth =
      (newDecisionYearMonth ?? this.form.get('decisionYearMonth')?.value) as YearMonthString | null;

    if (!currentSalary || currentSalary <= 0 || !currentDecisionYearMonth) {
      this.healthCalculationError = null;
      this.pensionCalculationError = null;
      return;
    }

    // 自動計算を実行して結果を取得
    const office = await firstValueFrom(this.officesService.watchOffice(this.data.officeId));
    if (!office) {
      return;
    }

    const calcResult = await calculateStandardRewardsFromSalary(
      office,
      Number(currentSalary),
      currentDecisionYearMonth,
      this.mastersService
    );

    // 確認ダイアログを表示
    const dialogRef = this.dialog.open<
      StandardRewardAutoInputConfirmDialogComponent,
      StandardRewardAutoInputConfirmDialogData,
      'execute' | 'skip' | 'cancel'
    >(StandardRewardAutoInputConfirmDialogComponent, {
      width: '600px',
      data: {
        salary: Number(currentSalary),
        decisionYearMonth: currentDecisionYearMonth,
        healthGrade: calcResult.healthGrade,
        healthStandardMonthly: calcResult.healthStandardMonthly,
        pensionGrade: calcResult.pensionGrade,
        pensionStandardMonthly: calcResult.pensionStandardMonthly,
        healthError: calcResult.errors.health ?? null,
        pensionError: calcResult.errors.pension ?? null
      }
    });

    const result = await firstValueFrom(dialogRef.afterClosed());

    if (result === 'execute') {
      // 自動入力する
      this.autoCalculatedHealthGrade = calcResult.healthGrade;
      this.autoCalculatedHealthStandardMonthly = calcResult.healthStandardMonthly;
      this.autoCalculatedPensionGrade = calcResult.pensionGrade;
      this.autoCalculatedPensionStandardMonthly = calcResult.pensionStandardMonthly;

      this.healthCalculationError = calcResult.errors.health ?? null;
      this.pensionCalculationError = calcResult.errors.pension ?? null;

      // 自動計算結果がマスターデータに存在するかチェック
      const healthAmounts = await firstValueFrom(this.availableHealthStandardMonthlyRewards$);
      const pensionAmounts = await firstValueFrom(this.availablePensionStandardMonthlyRewards$);
      
      if (calcResult.healthStandardMonthly && healthAmounts.length > 0) {
        if (!healthAmounts.includes(calcResult.healthStandardMonthly)) {
          this.healthCalculationError = `計算結果（${calcResult.healthStandardMonthly.toLocaleString()}円）がマスターデータに存在しません。`;
        }
      }
      
      if (calcResult.pensionStandardMonthly && pensionAmounts.length > 0) {
        if (!pensionAmounts.includes(calcResult.pensionStandardMonthly)) {
          this.pensionCalculationError = `計算結果（${calcResult.pensionStandardMonthly.toLocaleString()}円）がマスターデータに存在しません。`;
        }
      }

      this.form.patchValue(
        {
          healthGrade: calcResult.healthGrade ?? null,
          healthStandardMonthly: calcResult.healthStandardMonthly ?? null,
          healthGradeSource: calcResult.healthGrade ? ('auto_from_salary' as GradeDecisionSource) : null,
          pensionGrade: calcResult.pensionGrade ?? null,
          pensionStandardMonthly: calcResult.pensionStandardMonthly ?? null,
          pensionGradeSource: calcResult.pensionGrade
            ? ('auto_from_salary' as GradeDecisionSource)
            : null
        } as any,
        { emitEvent: false }
      );

      // 変更前の値を更新
      this.previousSalary = Number(currentSalary);
      this.previousDecisionYearMonth = currentDecisionYearMonth;
    } else if (result === 'cancel') {
      // キャンセル：報酬月額と決定年月の変更を取り消し
      this.form.patchValue(
        {
          payrollInsurableMonthlyWage: previousSalaryValue ?? null,
          decisionYearMonth: previousDecisionYearMonthValue ?? null
        } as any,
        { emitEvent: false }
      );
      // 変更前の値も元に戻す
      this.previousSalary = previousSalaryValue ?? null;
      this.previousDecisionYearMonth = previousDecisionYearMonthValue ?? null;
    } else {
      // スキップ：何もしない（報酬月額と決定年月は変更されたまま）
      // 変更前の値は既に更新済み
    }
  }

  private async recalculateStandardRewardsFromForm(): Promise<void> {
    const salary = this.form.get('payrollInsurableMonthlyWage')?.value;
    const decisionYearMonth = this.form.get('decisionYearMonth')?.value as YearMonthString | null;

    if (!salary || salary <= 0 || !decisionYearMonth) {
      this.healthCalculationError = null;
      this.pensionCalculationError = null;
      return;
    }

    const previousSalary = this.previousSalary ?? salary;
    const previousDecisionYearMonth = this.previousDecisionYearMonth ?? decisionYearMonth;
    await this.onSalaryOrDecisionYearMonthChanged(null, null, previousSalary, previousDecisionYearMonth);
  }

  private onHealthGradeChanged(value: number | null): void {
    if (value != null && value > 0) {
      if (this.autoCalculatedHealthGrade === null || value !== this.autoCalculatedHealthGrade) {
        this.form.patchValue({ healthGradeSource: 'manual_override' }, { emitEvent: false });
      }
    }
  }

  private onHealthStandardMonthlyChanged(value: number | null): void {
    if (value != null && value > 0) {
      if (
        this.autoCalculatedHealthStandardMonthly === null ||
        value !== this.autoCalculatedHealthStandardMonthly
      ) {
        this.form.patchValue({ healthGradeSource: 'manual_override' }, { emitEvent: false });
      }
    }
  }

  private onPensionGradeChanged(value: number | null): void {
    if (value != null && value > 0) {
      if (this.autoCalculatedPensionGrade === null || value !== this.autoCalculatedPensionGrade) {
        this.form.patchValue({ pensionGradeSource: 'manual_override' }, { emitEvent: false });
      }
    }
  }

  private onPensionStandardMonthlyChanged(value: number | null): void {
    if (value != null && value > 0) {
      if (
        this.autoCalculatedPensionStandardMonthly === null ||
        value !== this.autoCalculatedPensionStandardMonthly
      ) {
        this.form.patchValue({ pensionGradeSource: 'manual_override' }, { emitEvent: false });
      }
    }
  }

  get canExecuteAutoInput(): boolean {
    const salary = this.form.get('payrollInsurableMonthlyWage')?.value;
    const decisionYearMonth = this.form.get('decisionYearMonth')?.value;
    return !!(salary && salary > 0 && decisionYearMonth);
  }

  get canAddHealthHistory(): boolean {
    const standardMonthly = this.form.get('healthStandardMonthly')?.value;
    const decisionYearMonth = this.form.get('decisionYearMonth')?.value;
    return !!(standardMonthly && standardMonthly > 0 && decisionYearMonth);
  }

  get exemptionMonthsArray(): FormArray {
    return this.form.get('premiumExemptionMonths') as FormArray;
  }

  /**
   * 免除月の配列をyearMonth昇順でソートしたインデックス配列を返す（表示用）
   */
  get sortedExemptionMonthsIndices(): number[] {
    const array = this.exemptionMonthsArray.controls;
    const indices = array.map((_, i) => i);
    return indices.sort((a, b) => {
      const aYm = array[a].get('yearMonth')?.value || '';
      const bYm = array[b].get('yearMonth')?.value || '';
      return aYm.localeCompare(bYm);
    });
  }

  addExemptionMonth(): void {
    const exemptionMonthsArray = this.exemptionMonthsArray;
    const newGroup = this.fb.group({
      kind: ['maternity', Validators.required],
      yearMonth: ['', Validators.required]
    });
    exemptionMonthsArray.push(newGroup);
  }

  removeExemptionMonth(index: number): void {
    this.exemptionMonthsArray.removeAt(index);
  }

  private getExemptionMonthsValue(): PremiumExemptionMonth[] | null | undefined {
    const exemptionMonthsArray = this.exemptionMonthsArray;
    const values: PremiumExemptionMonth[] = [];
    const yearMonthSet = new Set<string>();
    let hasDuplicate = false;

    // 重複エラーをクリア
    for (let i = 0; i < exemptionMonthsArray.length; i++) {
      const group = exemptionMonthsArray.at(i);
      group.get('yearMonth')?.setErrors(null);
    }

    for (let i = 0; i < exemptionMonthsArray.length; i++) {
      const group = exemptionMonthsArray.at(i);
      const kind = group.get('kind')?.value as ExemptionKind | null;
      const yearMonth = group.get('yearMonth')?.value as YearMonthString | null;

      if (!kind || !yearMonth) {
        continue; // 未入力の行はスキップ
      }

      // 重複チェック（yearMonthは1回だけ）
      if (yearMonthSet.has(yearMonth)) {
        hasDuplicate = true;
        group.get('yearMonth')?.setErrors({ duplicate: true });
        this.snackBar.open(
          `対象年月「${yearMonth}」は既に登録されています。重複は登録できません。`,
          '閉じる',
          { duration: 4000 }
        );
        continue;
      }

      yearMonthSet.add(yearMonth);
      values.push({ kind, yearMonth });
    }

    // yearMonth昇順でソート
    values.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

    // 0件の場合：編集時は null（削除）、新規作成時は undefined（フィールドを載せない）
    if (values.length === 0) {
      return this.data.employee ? null : undefined;
    }

    return values;
  }

  private hasDuplicateExemptionMonths(): boolean {
    const exemptionMonthsArray = this.exemptionMonthsArray;
    const yearMonthSet = new Set<string>();

    for (let i = 0; i < exemptionMonthsArray.length; i++) {
      const group = exemptionMonthsArray.at(i);
      const yearMonth = group.get('yearMonth')?.value as YearMonthString | null;

      if (!yearMonth) {
        continue;
      }

      if (yearMonthSet.has(yearMonth)) {
        return true;
      }

      yearMonthSet.add(yearMonth);
    }

    return false;
  }

  get canAddPensionHistory(): boolean {
    const standardMonthly = this.form.get('pensionStandardMonthly')?.value;
    const decisionYearMonth = this.form.get('decisionYearMonth')?.value;
    return !!(standardMonthly && standardMonthly > 0 && decisionYearMonth);
  }

  async onAddHistoryClick(insuranceKind: 'health' | 'pension'): Promise<void> {
    const standardMonthly = this.form.get(
      insuranceKind === 'health' ? 'healthStandardMonthly' : 'pensionStandardMonthly'
    )?.value;
    const grade = this.form.get(insuranceKind === 'health' ? 'healthGrade' : 'pensionGrade')?.value;
    const decisionYearMonth = this.form.get('decisionYearMonth')?.value as YearMonthString | null;

    if (!standardMonthly || standardMonthly <= 0 || !decisionYearMonth) {
      return;
    }

    // 確認ダイアログを表示
    const dialogRef = this.dialog.open<
      StandardRewardHistoryAddConfirmDialogComponent,
      StandardRewardHistoryAddConfirmDialogData,
      boolean
    >(StandardRewardHistoryAddConfirmDialogComponent, {
      width: '500px',
      data: {
        insuranceKind,
        appliedFromYearMonth: decisionYearMonth,
        grade: grade ?? null,
        standardMonthlyReward: standardMonthly
      }
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }

    // 従業員IDを取得（新規作成の場合は先に保存）
    let employeeId: string;
    if (this.data.employee?.id) {
      employeeId = this.data.employee.id;
    } else {
      // 新規作成の場合は先に従業員を保存
      if (!this.canSave) {
        this.snackBar.open('先に従業員情報を保存してください。', undefined, {
          duration: 3000
        });
        return;
      }
      
      const savedId = await this.saveEmployeeWithoutClosing();
      if (!savedId) {
        return;
      }
      employeeId = savedId;
    }

    try {
      // 履歴を追加（save()が更新後の従業員データを返す）
      const updatedEmployee = await this.standardRewardHistoryService.save(
        this.data.officeId,
        employeeId,
        {
        insuranceKind,
        appliedFromYearMonth: decisionYearMonth,
        standardMonthlyReward: standardMonthly,
        grade: grade ?? undefined,
        decisionKind: 'other',
        note: '従業員フォームから追加'
        }
      );

      if (updatedEmployee) {
        // 追加した保険種別だけフォームに反映する
        const patch: any =
          insuranceKind === 'health'
            ? {
          healthStandardMonthly: updatedEmployee.healthStandardMonthly ?? null,
          healthGrade: updatedEmployee.healthGrade ?? null,
              }
            : {
                pensionStandardMonthly: updatedEmployee.pensionStandardMonthly ?? null,
                pensionGrade: updatedEmployee.pensionGrade ?? null,
              };

        this.form.patchValue(patch, { emitEvent: false });
        this.data.employee = updatedEmployee;
        // 履歴が変更されたことを記録
        this.historyChanged = true;
      }

      this.snackBar.open('標準報酬履歴を追加しました', undefined, {
        duration: 2500
      });
    } catch (error) {
      console.error(`標準報酬履歴（${insuranceKind}）の追加に失敗しました:`, error);
      this.snackBar.open('標準報酬履歴の追加に失敗しました。時間をおいて再度お試しください。', undefined, {
        duration: 3000
      });
    }
  }

  async onAutoInputButtonClick(): Promise<void> {
    const salary = this.form.get('payrollInsurableMonthlyWage')?.value;
    const decisionYearMonth = this.form.get('decisionYearMonth')?.value as YearMonthString | null;

    if (!salary || salary <= 0 || !decisionYearMonth) {
      return;
    }

    // 変更前の値は現在のフォームの値（ボタンクリック時点での値）
    const previousSalary = this.previousSalary ?? salary;
    const previousDecisionYearMonth = this.previousDecisionYearMonth ?? decisionYearMonth;
    
    // 変更前の値を更新（次回のボタンクリック時に使用）
    this.previousSalary = salary ?? null;
    this.previousDecisionYearMonth = decisionYearMonth;
    
    await this.onSalaryOrDecisionYearMonthChanged(salary, decisionYearMonth, previousSalary, previousDecisionYearMonth);
  }

  get canSave(): boolean {
    // 標準報酬は履歴で管理するため、フォーム保存時には標準報酬の入力は必須ではない
    // 免除月の重複チェック
    if (this.hasDuplicateExemptionMonths()) {
      return false;
    }
    return !this.form.invalid;
  }

  openHelp(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.dialog.open(HelpDialogComponent, {
      width: '720px',
      data: {
        topicIds: ['standardMonthlyReward', 'shortTimeWorker'],
        title: '標準報酬月額に関するヘルプ'
      } satisfies HelpDialogData
    });
  }

  private async loadExistingMyNumber(encrypted: string): Promise<void> {
    try {
      const decrypted = await this.myNumberService.decrypt(encrypted);
      // フォームの myNumber に復号済みの値をセット（type="password" なので画面上は伏字）
      this.form.patchValue({ myNumber: decrypted });
      // 右側ヒント用にマスク済み文字列もセット
      this.maskedMyNumber = this.myNumberService.mask(decrypted);
    } catch (error) {
      console.error('Failed to decrypt employee myNumber', error);
      this.maskedMyNumber = null;
    }
  }

  /**
   * 従業員情報を保存する（ダイアログを閉じない）
   * 新規作成時の履歴追加前に使用
   */
  private async saveEmployeeWithoutClosing(): Promise<string | null> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return null;
    }

    try {
      const savedId = await this.saveEmployeePayload();
      if (savedId) {
        // 従業員データを再読み込み
        const updatedEmployee = await firstValueFrom(
          this.employeesService.get(this.data.officeId, savedId)
        );
        if (updatedEmployee) {
          this.data.employee = updatedEmployee;
        }
      }
      return savedId;
    } catch (error) {
      console.error('従業員情報の保存に失敗しました', error);
      this.snackBar.open('従業員情報の保存に失敗しました。時間をおいて再度お試しください。', undefined, {
        duration: 3000
      });
      return null;
    }
  }

  /**
   * 従業員情報の保存処理（payload作成と保存）
   */
  private async saveEmployeePayload(): Promise<string | null> {

    const formValue = this.form.getRawValue();
    const currentUserId = await firstValueFrom(
      this.currentUser.profile$.pipe(map((profile) => profile?.id ?? null))
    );

    // 空文字の場合はnullをセット（Firestoreで値をクリアする）
    // undefined = 変更しない、null = 削除する
    const normalizeString = (value: string | null | undefined): string | null => {
      const trimmed = value?.trim() ?? '';
      return trimmed === '' ? null : trimmed;
    };

    // 日付フィールド: 空文字の場合はnull（削除扱い）
    const normalizeDate = (value: string | null | undefined): string | null => {
      const trimmed = value?.trim() ?? '';
      return trimmed === '' ? null : trimmed;
    };

    // 文字列選択フィールド: 空文字の場合はnull（削除扱い）
    const normalizeSelectString = (value: string | null | undefined): string | null => {
      const trimmed = value?.trim() ?? '';
      return trimmed === '' ? null : trimmed;
    };

    const bankName = normalizeString(formValue.bankAccountBankName);
    const bankCode = normalizeString(formValue.bankAccountBankCode);
    const branchName = normalizeString(formValue.bankAccountBranchName);
    const branchCode = normalizeString(formValue.bankAccountBranchCode);
    const accountType = normalizeSelectString(formValue.bankAccountAccountType) as
      | BankAccountType
      | null;
    const accountNumber = normalizeString(formValue.bankAccountAccountNumber);
    const accountHolderName = normalizeString(formValue.bankAccountHolderName);
    const accountHolderKana = normalizeString(formValue.bankAccountHolderKana);

    const payrollPayType = normalizeSelectString(formValue.payrollPayType) as
      | PayrollPayType
      | null;
    const payrollPayCycle = normalizeSelectString(formValue.payrollPayCycle) as
      | PayrollPayCycle
      | null;
    const payrollInsurableMonthlyWage =
      formValue.payrollInsurableMonthlyWage !== null &&
      formValue.payrollInsurableMonthlyWage !== undefined &&
      formValue.payrollInsurableMonthlyWage !== ''
        ? Number(formValue.payrollInsurableMonthlyWage)
        : null;
    const payrollNote = normalizeString(formValue.payrollNote);
    // 標準報酬関連のフィールドは履歴で管理するため、フォーム保存時には使用しない
    // healthStandardMonthly, pensionStandardMonthly, healthGradeSource, pensionGradeSource は除外

    // マイナンバー: 空文字の場合はnull（削除扱い）
    const encryptedMyNumber =
      formValue.myNumber && formValue.myNumber.trim() !== ''
        ? await this.myNumberService.encrypt(formValue.myNumber.trim())
        : null;

    const payload: Partial<Employee> & { id?: string } = {
      id: this.data.employee?.id,
      name: (formValue.name?.trim() || '') as string,
      kana: normalizeString(formValue.kana) as any,
      birthDate: formValue.birthDate || '',
      department: normalizeString(formValue.department) as any,
      hireDate: formValue.hireDate || '',
      retireDate: normalizeDate(formValue.retireDate) as any,
      employmentType: (formValue.employmentType || '') as any,
      address: normalizeString(formValue.address) as any,
      phone: normalizeString(formValue.phone) as any,
      contactEmail: normalizeString(formValue.contactEmail) as any,
      employeeCodeInOffice: normalizeString(formValue.employeeCodeInOffice) as any,
      sex: formValue.sex ?? undefined,
      postalCode: normalizeString(formValue.postalCode) as any,
      addressKana: normalizeString(formValue.addressKana) as any,
      myNumber: encryptedMyNumber as any,
      weeklyWorkingHours: formValue.weeklyWorkingHours ?? undefined,
      weeklyWorkingDays: formValue.weeklyWorkingDays ?? undefined,
      contractPeriodNote: normalizeString(formValue.contractPeriodNote) as any,
      isStudent: formValue.isStudent ?? false,
      isInsured: formValue.isInsured ?? true,
      // 標準報酬関連のフィールドは履歴で管理するため、フォーム保存時には含めない
      // healthGrade, healthStandardMonthly, healthGradeSource,
      // pensionGrade, pensionStandardMonthly, pensionGradeSource は除外
      healthInsuredSymbol: normalizeString(formValue.healthInsuredSymbol) as any,
      healthInsuredNumber: normalizeString(formValue.healthInsuredNumber) as any,
      pensionNumber: normalizeString(formValue.pensionNumber) as any,
      healthQualificationDate: normalizeDate(formValue.healthQualificationDate) as any,
      healthLossDate: normalizeDate(formValue.healthLossDate) as any,
      healthQualificationKind: normalizeSelectString(formValue.healthQualificationKind) as any,
      healthLossReasonKind: normalizeSelectString(formValue.healthLossReasonKind) as any,
      pensionQualificationDate: normalizeDate(formValue.pensionQualificationDate) as any,
      pensionLossDate: normalizeDate(formValue.pensionLossDate) as any,
      pensionQualificationKind: normalizeSelectString(formValue.pensionQualificationKind) as any,
      pensionLossReasonKind: normalizeSelectString(formValue.pensionLossReasonKind) as any,
      workingStatus: normalizeSelectString(formValue.workingStatus) as any,
      workingStatusNote: normalizeString(formValue.workingStatusNote) as any,
      updatedByUserId: currentUserId ?? undefined
    };

    // 免除月の設定（undefined の場合はフィールドを載せない）
    const exemptionMonths = this.getExemptionMonthsValue();
    if (exemptionMonths !== undefined) {
      (payload as any).premiumExemptionMonths = exemptionMonths;
    }

    const hasBankAccountInput = [
      bankName,
      bankCode,
      branchName,
      branchCode,
      accountType,
      accountNumber,
      accountHolderName,
      accountHolderKana
    ].some((v) => v !== null && v !== undefined && v !== '');

    if (hasBankAccountInput) {
      if (!bankName) {
        this.form.get('bankAccountBankName')?.setErrors({ required: true });
      }
      if (!branchName) {
        this.form.get('bankAccountBranchName')?.setErrors({ required: true });
      }
      if (!accountType) {
        this.form.get('bankAccountAccountType')?.setErrors({ required: true });
      }
      if (!accountNumber) {
        this.form.get('bankAccountAccountNumber')?.setErrors({ required: true });
      }
      if (!accountHolderName) {
        this.form.get('bankAccountHolderName')?.setErrors({ required: true });
      }

      const missingRequired =
        !bankName || !branchName || !accountType || !accountNumber || !accountHolderName;

      if (missingRequired) {
        this.form.markAllAsTouched();
        return null;
      }

      const bankAccountPayload: any = {
        bankName,
        bankCode,
        branchName,
        branchCode,
        accountType,
        accountNumber,
        accountHolderName,
        accountHolderKana,
        updatedAt: new Date().toISOString()
      };

      if (currentUserId) {
        bankAccountPayload.updatedByUserId = currentUserId;
      }

      payload.bankAccount = bankAccountPayload;
    } else if (this.data.employee?.bankAccount) {
      payload.bankAccount = null;
    }

    const hasPayrollInput =
      payrollPayType ||
      payrollPayCycle ||
      payrollInsurableMonthlyWage !== null ||
      payrollNote !== null;

    if (hasPayrollInput) {
      if (!payrollPayType) {
        this.form.get('payrollPayType')?.setErrors({ required: true });
      }
      if (!payrollPayCycle) {
        this.form.get('payrollPayCycle')?.setErrors({ required: true });
      }

      if (!payrollPayType || !payrollPayCycle) {
        this.form.markAllAsTouched();
        return null;
      }

      payload.payrollSettings = {
        payType: payrollPayType,
        payCycle: payrollPayCycle,
        insurableMonthlyWage: payrollInsurableMonthlyWage,
        note: payrollNote
      };
    } else if (this.data.employee?.payrollSettings) {
      payload.payrollSettings = null;
    }

    const savedId = await this.employeesService.save(this.data.officeId, payload);
    return savedId;
  }

  async submit(): Promise<void> {
    const savedId = await this.saveEmployeeWithoutClosing();
    if (!savedId) {
      return;
    }

    const mode: 'created' | 'updated' = this.data.employee ? 'updated' : 'created';
    
    // 標準報酬履歴の自動追加は廃止
    // 履歴を追加する場合は「履歴に追加」ボタンを使用すること
    
    this.dialogRef.close({ 
      saved: true, 
      mode, 
      employeeId: savedId,
      historyChanged: this.historyChanged 
    });
  }

  async onCancel(): Promise<void> {
    // 履歴が変更されていたら確認ダイアログを表示
    if (this.historyChanged) {
      const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
        ConfirmDialogComponent,
        {
          width: '500px',
          data: {
            title: '従業員フォームを閉じますか？',
            message: '標準報酬履歴の追加は保存済みです。従業員フォームの変更は破棄して閉じますか？',
            confirmLabel: '閉じる',
            cancelLabel: 'キャンセル'
          }
        }
      );

      const confirmed = await firstValueFrom(dialogRef.afterClosed());
      if (!confirmed) {
        return; // キャンセルされた場合は何もしない
      }
    }

    // 履歴が変更されていたら、親画面に通知して閉じる
    this.dialogRef.close({ 
      saved: false, 
      historyChanged: this.historyChanged,
      employeeId: this.data.employee?.id 
    });
  }

  private async addAutoStandardRewardHistory(
    employeeId: string,
    mode: 'created' | 'updated',
    insuranceKind: 'health' | 'pension',
    newStandardMonthly: number | null,
    decisionYearMonth: YearMonthString | null
  ): Promise<void> {
    // 標準報酬が設定されていない場合はスキップ
    if (!newStandardMonthly || newStandardMonthly <= 0) {
      return;
    }

    // 決定年月が設定されていない場合はスキップ
    if (!decisionYearMonth) {
      return;
    }

    // 更新モードの場合、変更がない場合はスキップ
    if (mode === 'updated') {
      const originalStandardMonthly =
        insuranceKind === 'health'
          ? this.data.employee?.healthStandardMonthly
          : this.data.employee?.pensionStandardMonthly;
      
      if (originalStandardMonthly === newStandardMonthly) {
        return;
      }
    }

    try {
      await this.standardRewardHistoryService.save(this.data.officeId, employeeId, {
        insuranceKind,
        appliedFromYearMonth: decisionYearMonth,
        standardMonthlyReward: newStandardMonthly,
        decisionKind: 'other',
        note:
          mode === 'created'
            ? `従業員フォームで初回の${insuranceKind === 'health' ? '健康保険' : '厚生年金'}標準報酬月額が登録されたため自動登録`
            : `従業員フォームで${insuranceKind === 'health' ? '健康保険' : '厚生年金'}標準報酬月額が変更されたため自動登録`
      });
    } catch (error) {
      console.error(`標準報酬履歴（${insuranceKind}）の自動追加に失敗しました:`, error);
    }
  }

  private getCurrentYearMonth(): YearMonthString {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * 従業員をリアルタイムで監視してフォームを更新
   */
  private watchEmployeeAndUpdateForm(employeeId: string): void {
    this.employeesService
      .watch(this.data.officeId, employeeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((latest) => {
        if (!latest) return;

        // 標準報酬関連のフィールドを最新の値で更新（emitEvent:falseで事故防止）
        this.form.patchValue(
          {
            healthGrade: latest.healthGrade ?? null,
            healthStandardMonthly: latest.healthStandardMonthly ?? null,
            pensionGrade: latest.pensionGrade ?? null,
            pensionStandardMonthly: latest.pensionStandardMonthly ?? null
          } as any,
          { emitEvent: false }
        );

        // dataも最新に更新
        this.data.employee = latest;
      });
  }

  /**
   * 今月時点で有効な標準報酬履歴を選択
   */
  private pickEffectiveHistory(
    histories: StandardRewardHistory[],
    asOfYm: YearMonthString
  ): StandardRewardHistory | null {
    if (!histories?.length) return null;

    const pastOrCurrent = histories
      .filter((h) => h.appliedFromYearMonth <= asOfYm)
      .sort((a, b) => b.appliedFromYearMonth.localeCompare(a.appliedFromYearMonth));

    if (pastOrCurrent.length) return pastOrCurrent[0];

    // 未来しかない場合などは一番新しいもの
    return [...histories].sort((a, b) => b.appliedFromYearMonth.localeCompare(a.appliedFromYearMonth))[0];
  }

  /**
   * 現行で使われている標準報酬履歴を取得してフォームに反映
   */
  private bindEffectiveStandardReward(employeeId: string): void {
    const asOfYm = this.getCurrentYearMonth();

    combineLatest([
      this.standardRewardHistoryService.listByInsuranceKind(this.data.officeId, employeeId, 'health'),
      this.standardRewardHistoryService.listByInsuranceKind(this.data.officeId, employeeId, 'pension')
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([healthList, pensionList]) => {
        const healthEff = this.pickEffectiveHistory(healthList ?? [], asOfYm);
        const pensionEff = this.pickEffectiveHistory(pensionList ?? [], asOfYm);

        // 適用開始年月は health を優先（どちらか一方に合わせる）
        const decisionYm = (healthEff?.appliedFromYearMonth ?? pensionEff?.appliedFromYearMonth ?? asOfYm) as YearMonthString;

        this.form.patchValue(
          {
            decisionYearMonth: decisionYm,
            // 現行履歴の値もフォームに表示（見た目目的）
            healthGrade: healthEff?.grade ?? null,
            healthStandardMonthly: healthEff?.standardMonthlyReward ?? null,
            pensionGrade: pensionEff?.grade ?? null,
            pensionStandardMonthly: pensionEff?.standardMonthlyReward ?? null
          } as any,
          { emitEvent: false }
        );
      });
  }
}
