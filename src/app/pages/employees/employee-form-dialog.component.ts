import { Component, DestroyRef, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgIf } from '@angular/common';
import { HelpDialogComponent, HelpDialogData } from '../../components/help-dialog.component';
import {
  StandardRewardAutoInputConfirmDialogComponent,
  StandardRewardAutoInputConfirmDialogData
} from './standard-reward-auto-input-confirm-dialog.component';

import { EmployeesService } from '../../services/employees.service';
import { StandardRewardHistoryService } from '../../services/standard-reward-history.service';
import {
  BankAccountType,
  Employee,
  PayrollPayCycle,
  PayrollPayType,
  GradeDecisionSource,
  Sex,
  YearMonthString
} from '../../types';
import { CurrentUserService } from '../../services/current-user.service';
import { firstValueFrom, map } from 'rxjs';
import { MyNumberService } from '../../services/mynumber.service';
import { OfficesService } from '../../services/offices.service';
import { MastersService } from '../../services/masters.service';
import { calculateStandardRewardsFromSalary } from '../../utils/standard-reward-calculator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
    NgIf
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">{{ data.employee ? 'edit' : 'person_add' }}</mat-icon>
      <span>{{ data.employee ? '従業員を編集' : '従業員を追加' }}</span>
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
        <input matInput formControlName="hireDate" type="date" required />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>退社日</mat-label>
        <input matInput formControlName="retireDate" type="date" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>住所</mat-label>
        <textarea matInput formControlName="address" rows="2"></textarea>
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
        <mat-hint>社内管理用（整理番号など）を入力してください</mat-hint>
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
        <textarea matInput formControlName="addressKana" rows="2"></textarea>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-row">
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
        <textarea matInput formControlName="contractPeriodNote" rows="2"></textarea>
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
            <mat-hint>標準報酬月額を概算するための月額給与です（標準報酬は算定基礎で決められた額になるので未入力でも構いません）</mat-hint>
            <mat-error *ngIf="form.get('payrollInsurableMonthlyWage')?.hasError('min')">
          1以上の数値を入力してください
            </mat-error>
            <mat-error *ngIf="form.get('payrollInsurableMonthlyWage')?.hasError('pattern')">
              数字のみを入力してください
            </mat-error>
          </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>標準報酬決定年月</mat-label>
        <input matInput type="month" formControlName="decisionYearMonth" />
        <mat-error *ngIf="form.get('decisionYearMonth')?.hasError('required')">
          標準報酬決定年月を入力してください
        </mat-error>
      </mat-form-field>

      <div class="auto-input-button-container">
        <button
          mat-stroked-button
          type="button"
          color="primary"
          [disabled]="!canExecuteAutoInput"
          (click)="onAutoInputButtonClick()"
          class="auto-input-button"
        >
          <mat-icon>auto_fix_high</mat-icon>
          <span>標準報酬を自動入力</span>
        </button>
        <span class="auto-input-hint">標準報酬月額と等級は手動で変更・上書き・入力が可能です。</span>
      </div>

          <!-- 標準報酬・等級（自動入力結果） -->
      <mat-form-field appearance="outline">
        <mat-label>健康保険 等級</mat-label>
        <input matInput type="number" formControlName="healthGrade" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>健康保険 標準報酬月額</mat-label>
        <input matInput type="number" formControlName="healthStandardMonthly" />
        <mat-hint *ngIf="healthCalculationError" style="color:#d32f2f">
          {{ healthCalculationError }}
        </mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>厚生年金 等級</mat-label>
        <input matInput type="number" formControlName="pensionGrade" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>厚生年金 標準報酬月額</mat-label>
        <input matInput type="number" formControlName="pensionStandardMonthly" />
        <mat-hint *ngIf="pensionCalculationError" style="color:#d32f2f">
          {{ pensionCalculationError }}
        </mat-hint>
      </mat-form-field>

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
        <mat-label>就業状態</mat-label>
        <mat-select formControlName="workingStatus">
          <mat-option [value]="''">未選択</mat-option>
          <mat-option [value]="'normal'">通常勤務</mat-option>
          <mat-option [value]="'maternity_leave'">産前産後休業</mat-option>
          <mat-option [value]="'childcare_leave'">育児休業</mat-option>
          <mat-option [value]="'sick_leave'">傷病休職</mat-option>
          <mat-option [value]="'other'">その他</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>状態開始日</mat-label>
        <input matInput type="date" formControlName="workingStatusStartDate" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>状態終了日</mat-label>
        <input matInput type="date" formControlName="workingStatusEndDate" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>保険料の扱い</mat-label>
        <mat-select formControlName="premiumTreatment">
          <mat-option [value]="''">未選択</mat-option>
          <mat-option [value]="'normal'">通常徴収</mat-option>
          <mat-option [value]="'exempt'">保険料免除</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-row">
        <mat-label>備考（就業状態）</mat-label>
        <textarea matInput rows="2" formControlName="workingStatusNote"></textarea>
      </mat-form-field>
        </div>
      </div>
    </form>
    <div mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close>
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
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
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

      .auto-input-button-container {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 12px;
        justify-content: flex-start;
        margin-top: -8px;
        margin-bottom: 8px;
      }

      .auto-input-button {
        font-size: 0.875rem;
        padding: 4px 12px;
        min-width: auto;
        height: 32px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .auto-input-button mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .auto-input-hint {
        font-size: 0.75rem;
        color: #666;
        line-height: 1.4;
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
  private readonly destroyRef = inject(DestroyRef);

  protected maskedMyNumber: string | null = null;
  protected healthCalculationError: string | null = null;
  protected pensionCalculationError: string | null = null;

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
    hireDate: ['', Validators.required],
    retireDate: [''],
    employmentType: ['', Validators.required],
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
    decisionYearMonth: [this.getCurrentYearMonth(), Validators.required],
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
    workingStatusStartDate: [''],
    workingStatusEndDate: [''],
    premiumTreatment: [''],
    workingStatusNote: [''],
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
        decisionYearMonth: this.getCurrentYearMonth(),
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
        workingStatusStartDate: employee.workingStatusStartDate ?? '',
        workingStatusEndDate: employee.workingStatusEndDate ?? '',
        premiumTreatment: employee.premiumTreatment ?? '',
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
  }

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
    if (this.form.invalid) {
      return false;
    }

    const isInsured = this.form.get('isInsured')?.value === true;

    const healthStandard = this.form.get('healthStandardMonthly')?.value;
    const healthGrade = this.form.get('healthGrade')?.value;
    const pensionStandard = this.form.get('pensionStandardMonthly')?.value;
    const pensionGrade = this.form.get('pensionGrade')?.value;

    if (!isInsured) {
      return true;
    }

    const hasHealth = healthStandard != null && Number(healthStandard) > 0;
    const hasPension = pensionStandard != null && Number(pensionStandard) > 0;

    if (!hasHealth && !hasPension) {
      return false;
    }

    if (hasHealth && (!healthGrade || Number(healthGrade) <= 0)) {
      return false;
    }
    if (hasPension && (!pensionGrade || Number(pensionGrade) <= 0)) {
      return false;
    }

    return true;
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

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

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
    const healthStandardMonthly =
      formValue.healthStandardMonthly !== null &&
      formValue.healthStandardMonthly !== undefined &&
      formValue.healthStandardMonthly !== ''
        ? Number(formValue.healthStandardMonthly)
        : null;
    const pensionStandardMonthly =
      formValue.pensionStandardMonthly !== null &&
      formValue.pensionStandardMonthly !== undefined &&
      formValue.pensionStandardMonthly !== ''
        ? Number(formValue.pensionStandardMonthly)
        : null;
    const healthGradeSource =
      (formValue.healthGradeSource as GradeDecisionSource | null | undefined) ?? null;
    const pensionGradeSource =
      (formValue.pensionGradeSource as GradeDecisionSource | null | undefined) ?? null;

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
      healthGrade: formValue.healthGrade ?? undefined,
      healthStandardMonthly: healthStandardMonthly ?? undefined,
      healthGradeSource: healthGradeSource ?? undefined,
      pensionGrade: formValue.pensionGrade ?? undefined,
      pensionStandardMonthly: pensionStandardMonthly ?? undefined,
      pensionGradeSource: pensionGradeSource ?? undefined,
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
      workingStatusStartDate: normalizeDate(formValue.workingStatusStartDate) as any,
      workingStatusEndDate: normalizeDate(formValue.workingStatusEndDate) as any,
      premiumTreatment: normalizeSelectString(formValue.premiumTreatment) as any,
      workingStatusNote: normalizeString(formValue.workingStatusNote) as any,
      updatedByUserId: currentUserId ?? undefined
    };

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
        return;
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
        return;
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

    try {
      const savedId = await this.employeesService.save(this.data.officeId, payload);
      const mode: 'created' | 'updated' = this.data.employee ? 'updated' : 'created';
      const decisionYearMonth = formValue.decisionYearMonth as YearMonthString | null;
      
      // 健康保険と厚生年金の履歴をそれぞれ登録
      await this.addAutoStandardRewardHistory(
        savedId,
        mode,
        'health',
        healthStandardMonthly,
        decisionYearMonth
      );
      await this.addAutoStandardRewardHistory(
        savedId,
        mode,
        'pension',
        pensionStandardMonthly,
        decisionYearMonth
      );
      
      this.dialogRef.close({ saved: true, mode, employeeId: savedId });
    } catch (error) {
      console.error('従業員情報の保存に失敗しました', error);
    }
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
        decisionYearMonth,
        appliedFromYearMonth: decisionYearMonth, // 決定年月を適用開始年月として使用
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
}
