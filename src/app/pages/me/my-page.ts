import {
  AsyncPipe,
  DatePipe,
  DecimalPipe,
  NgFor,
  NgIf,
  NgSwitch,
  NgSwitchCase,
  NgSwitchDefault
} from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { combineLatest, firstValueFrom, from, map, of, switchMap } from 'rxjs';

import { BonusPremiumsService } from '../../services/bonus-premiums.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { ChangeRequestsService } from '../../services/change-requests.service';
import { DocumentsService } from '../../services/documents.service';
import { EmployeesService } from '../../services/employees.service';
import { MonthlyPremiumsService } from '../../services/monthly-premiums.service';
import { MastersService } from '../../services/masters.service';
import { OfficesService } from '../../services/offices.service';
import { isCareInsuranceTarget, roundForEmployeeDeduction, hasInsuranceInMonth } from '../../utils/premium-calculator';
import {
  BonusPremium,
  ChangeRequest,
  ChangeRequestStatus,
  BankAccountChangePayload,
  BankAccount,
  Employee,
  Dependent,
  DocumentRequest,
  MonthlyPremium,
  YearMonthString
} from '../../types';
import { DependentsService } from '../../services/dependents.service';
import {
  getChangeRequestKindLabel,
  getChangeRequestStatusLabel,
  getDependentRelationshipLabel,
  getDocumentCategoryLabel,
  getEmploymentTypeLabel,
  getBankAccountTypeLabel,
  getPayrollPayTypeLabel,
  getPayrollPayCycleLabel,
  getInsuranceLossReasonKindLabel,
  getInsuranceQualificationKindLabel,
  getSexLabel,
  getWorkingStatusLabel,
  maskMyNumber,
  calculateAge
} from '../../utils/label-utils';
import { RequestKindSelectionDialogComponent } from '../requests/request-kind-selection-dialog.component';
import { BankAccountChangeRequestFormDialogComponent } from '../requests/bank-account-change-request-form-dialog.component';
import { DependentAddRequestFormDialogComponent } from '../requests/dependent-add-request-form-dialog.component';
import { DependentUpdateRequestFormDialogComponent } from '../requests/dependent-update-request-form-dialog.component';
import { DependentRemoveRequestFormDialogComponent } from '../requests/dependent-remove-request-form-dialog.component';
import { ConfirmDialogComponent } from '../requests/confirm-dialog.component';
import { DocumentUploadDialogComponent } from '../documents/document-upload-dialog.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'ip-my-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatExpansionModule,
    MatTableModule,
    AsyncPipe,
    NgIf,
    NgFor,
    DatePipe,
    DecimalPipe,
    NgSwitch,
    NgSwitchCase,
    NgSwitchDefault,
    MatSnackBarModule
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div>
            <h1>マイページ</h1>
          <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">自分の社員情報と保険料明細を確認できます</p>
          </div>
      </header>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center mb-4">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">info</mat-icon> 基本情報
          </h2>
          </div>
        </div>

        <ng-container *ngIf="employee$ | async as employee; else noEmployee">
          <!-- 1. 基本プロフィールカード -->
          <div class="info-section mb-4">
            <div class="info-section-header">
              <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                <mat-icon color="primary">person</mat-icon> 基本プロフィール
              </h3>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">氏名</span>
                <span class="value">{{ employee.name }}</span>
              </div>
              <div class="info-item" *ngIf="employee.kana">
                <span class="label">カナ</span>
                <span class="value">{{ employee.kana }}</span>
              </div>
              <div class="info-item">
                <span class="label">所属</span>
                <span class="value">{{ employee.department || '未設定' }}</span>
              </div>
              <div class="info-item" *ngIf="employee.birthDate">
                <span class="label">生年月日</span>
                <span class="value">
                  {{ employee.birthDate | date: 'yyyy年MM月dd日' }}
                  <span class="age-badge" *ngIf="calculateAge(employee.birthDate) !== null">
                    （{{ calculateAge(employee.birthDate) }}歳）
                  </span>
                </span>
              </div>
              <div class="info-item" *ngIf="employee.sex">
                <span class="label">性別</span>
                <span class="value">{{ getSexLabel(employee.sex) }}</span>
              </div>
              <div class="info-item">
                <span class="label">入社日</span>
                <span class="value">{{ employee.hireDate | date: 'yyyy-MM-dd' }}</span>
              </div>
              <div class="info-item" *ngIf="employee.retireDate">
                <span class="label">退社日</span>
                <span class="value">{{ employee.retireDate | date: 'yyyy-MM-dd' }}</span>
              </div>
            </div>
          </div>

          <!-- 2. 住所・連絡先カード -->
          <div class="info-section mb-4">
            <div class="info-section-header">
              <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                <mat-icon color="primary">home</mat-icon> 住所・連絡先
              </h3>
            </div>
            <div class="info-grid">
              <div class="info-item" *ngIf="employee.postalCode">
                <span class="label">郵便番号</span>
                <span class="value">{{ employee.postalCode }}</span>
              </div>
              <div class="info-item" *ngIf="employee.address">
                <span class="label">住所</span>
                <span class="value">{{ employee.address }}</span>
              </div>
              <div class="info-item" *ngIf="employee.phone">
                <span class="label">電話番号</span>
                <span class="value">{{ employee.phone }}</span>
              </div>
              <div class="info-item" *ngIf="employee.contactEmail">
                <span class="label">連絡先メール</span>
                <span class="value">{{ employee.contactEmail }}</span>
              </div>
              <div
                class="info-item"
                *ngIf="
                  !employee.postalCode &&
                  !employee.address &&
                  !employee.phone &&
                  !employee.contactEmail
                "
              >
                <span class="value" style="color: #6b7280;">住所・連絡先情報が未設定です</span>
              </div>
            </div>
          </div>

          <!-- 2.5 給与振込口座 -->
          <div class="info-section mb-4">
            <div class="info-section-header flex-row justify-between align-center">
              <h3 class="mat-h3 m-0 flex-row align-center gap-2">
                <mat-icon color="primary">account_balance</mat-icon> 給与振込口座
              </h3>
              <button
                mat-stroked-button
                color="primary"
                (click)="openBankAccountChangeRequest(employee)"
              >
                <mat-icon>edit</mat-icon>
                口座情報を{{ employee.bankAccount ? '変更' : '登録' }}申請
              </button>
            </div>
            <ng-container *ngIf="employee.bankAccount as bankAccount; else noBankAccount">
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">金融機関名</span>
                  <span class="value">{{ bankAccount.bankName }}</span>
                </div>
                <div class="info-item" *ngIf="bankAccount.bankCode">
                  <span class="label">金融機関コード</span>
                  <span class="value">{{ bankAccount.bankCode }}</span>
                </div>
                <div class="info-item">
                  <span class="label">支店名</span>
                  <span class="value">{{ bankAccount.branchName }}</span>
                </div>
                <div class="info-item" *ngIf="bankAccount.branchCode">
                  <span class="label">支店コード</span>
                  <span class="value">{{ bankAccount.branchCode }}</span>
                </div>
                <div class="info-item">
                  <span class="label">口座種別</span>
                  <span class="value">{{ getBankAccountTypeLabel(bankAccount.accountType) }}</span>
                </div>
                <div class="info-item">
                  <span class="label">口座番号</span>
                  <span class="value">{{ bankAccount.accountNumber }}</span>
                </div>
                <div class="info-item">
                  <span class="label">名義</span>
                  <span class="value">{{ bankAccount.accountHolderName }}</span>
                </div>
                <div class="info-item" *ngIf="bankAccount.accountHolderKana">
                  <span class="label">名義カナ</span>
                  <span class="value">{{ bankAccount.accountHolderKana }}</span>
                </div>
              </div>
            </ng-container>
            <ng-template #noBankAccount>
              <div class="info-grid">
                <div class="info-item">
                  <span class="value" style="color: #6b7280;">口座情報が未登録です</span>
                </div>
              </div>
            </ng-template>
          </div>

          <!-- 2.6 給与情報（保険用） -->
          <div class="info-section mb-4">
            <div class="info-section-header">
              <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                <mat-icon color="primary">payments</mat-icon> 給与情報（保険用）
              </h3>
            </div>
            <ng-container *ngIf="employee.payrollSettings as payroll; else noPayrollSettings">
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">支給形態</span>
                  <span class="value">{{ getPayrollPayTypeLabel(payroll.payType) }}</span>
                </div>
                <div class="info-item">
                  <span class="label">支給サイクル</span>
                  <span class="value">{{ getPayrollPayCycleLabel(payroll.payCycle) }}</span>
                </div>
                <div class="info-item">
                  <span class="label">報酬月額</span>
                  <span class="value">
                    {{ payroll.insurableMonthlyWage != null ? (payroll.insurableMonthlyWage | number) + ' 円' : '-' }}
                  </span>
                </div>
                <div class="info-item" *ngIf="payroll.note">
                  <span class="label">補足メモ</span>
                  <span class="value">{{ payroll.note }}</span>
                </div>
              </div>
            </ng-container>
            <ng-template #noPayrollSettings>
              <div class="info-grid">
                <div class="info-item">
                  <span class="value" style="color: #6b7280;">給与情報が未登録です</span>
                </div>
              </div>
            </ng-template>
          </div>

          <!-- 3. 就労条件カード -->
          <div class="info-section mb-4">
            <div class="info-section-header">
              <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                <mat-icon color="primary">work</mat-icon> 就労条件
              </h3>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">雇用形態</span>
                <span class="value">{{ getEmploymentTypeLabel(employee.employmentType) }}</span>
              </div>
              <div class="info-item" *ngIf="employee.weeklyWorkingHours != null">
                <span class="label">所定労働時間（週）</span>
                <span class="value">{{ employee.weeklyWorkingHours }}時間</span>
              </div>
              <div class="info-item" *ngIf="employee.weeklyWorkingDays != null">
                <span class="label">所定労働日数（週）</span>
                <span class="value">{{ employee.weeklyWorkingDays }}日</span>
              </div>
              <div class="info-item" *ngIf="employee.contractPeriodNote">
                <span class="label">契約期間の見込み</span>
                <span class="value">{{ employee.contractPeriodNote }}</span>
              </div>
              <div class="info-item" *ngIf="employee.isStudent">
                <span class="label">学生フラグ</span>
                <span class="value">学生アルバイト</span>
              </div>
            </div>
          </div>

          <!-- 4. 社会保険・資格情報（サマリ）カード -->
          <div class="info-section mb-4">
            <div class="info-section-header">
              <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                <mat-icon color="primary">health_and_safety</mat-icon> 社会保険・資格情報
              </h3>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">社会保険加入状況</span>
                <span class="value" [class.inactive]="!employee.isInsured">
                  {{ employee.isInsured ? '加入中' : '未加入' }}
                </span>
              </div>
              <div class="info-item">
                <span class="label">健康保険 等級 / 標準報酬月額</span>
                <span class="value">
                  {{ employee.healthGrade ? '等級 ' + employee.healthGrade : '未設定' }}
                  <ng-container *ngIf="employee.healthStandardMonthly != null">
                    / {{ employee.healthStandardMonthly | number }} 円
                  </ng-container>
                </span>
              </div>
              <div class="info-item">
                <span class="label">厚生年金 等級 / 標準報酬月額</span>
                <span class="value">
                  {{ employee.pensionGrade ? '等級 ' + employee.pensionGrade : '未設定' }}
                  <ng-container *ngIf="employee.pensionStandardMonthly != null">
                    / {{ employee.pensionStandardMonthly | number }} 円
                  </ng-container>
                </span>
              </div>
              <div class="info-item" *ngIf="employee.healthQualificationDate">
                <span class="label">資格取得日（健保）</span>
                <span class="value">{{ employee.healthQualificationDate | date: 'yyyy-MM-dd' }}</span>
              </div>
              <div class="info-item" *ngIf="employee.pensionQualificationDate">
                <span class="label">資格取得日（厚年）</span>
                <span class="value">{{ employee.pensionQualificationDate | date: 'yyyy-MM-dd' }}</span>
              </div>
            </div>
          </div>

          <!-- 5. 就業状態カード -->
          <div class="info-section mb-4" *ngIf="employee.workingStatus">
            <div class="info-section-header">
              <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                <mat-icon color="primary">event</mat-icon> 就業状態
              </h3>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">現在の就業状態</span>
                <span class="value">{{ getWorkingStatusLabel(employee.workingStatus) }}</span>
              </div>
            </div>
          </div>

          <!-- 6. 詳細情報（折りたたみセクション） -->
          <mat-expansion-panel class="detail-panel">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>info_outline</mat-icon>
                詳細情報
              </mat-panel-title>
              <mat-panel-description>
                被保険者番号、資格情報の詳細など
              </mat-panel-description>
            </mat-expansion-panel-header>
            <div class="info-grid">
              <div class="info-item" *ngIf="employee.healthInsuredSymbol">
                <span class="label">被保険者記号</span>
                <span class="value">{{ employee.healthInsuredSymbol }}</span>
              </div>
              <div class="info-item" *ngIf="employee.healthInsuredNumber">
                <span class="label">被保険者番号</span>
                <span class="value">{{ employee.healthInsuredNumber }}</span>
              </div>
              <div class="info-item" *ngIf="employee.pensionNumber">
                <span class="label">厚生年金番号</span>
                <span class="value">{{ employee.pensionNumber }}</span>
              </div>
              <div class="info-item" *ngIf="employee.healthQualificationKind">
                <span class="label">資格取得区分（健保）</span>
                <span class="value">{{ getInsuranceQualificationKindLabel(employee.healthQualificationKind) }}</span>
              </div>
              <div class="info-item" *ngIf="employee.pensionQualificationKind">
                <span class="label">資格取得区分（厚年）</span>
                <span class="value">{{ getInsuranceQualificationKindLabel(employee.pensionQualificationKind) }}</span>
              </div>
              <div class="info-item" *ngIf="employee.healthLossDate">
                <span class="label">資格喪失日（健保）</span>
                <span class="value">{{ employee.healthLossDate | date: 'yyyy-MM-dd' }}</span>
              </div>
              <div class="info-item" *ngIf="employee.pensionLossDate">
                <span class="label">資格喪失日（厚年）</span>
                <span class="value">{{ employee.pensionLossDate | date: 'yyyy-MM-dd' }}</span>
              </div>
              <div class="info-item" *ngIf="employee.healthLossReasonKind">
                <span class="label">喪失理由区分（健保）</span>
                <span class="value">{{ getInsuranceLossReasonKindLabel(employee.healthLossReasonKind) }}</span>
              </div>
              <div class="info-item" *ngIf="employee.pensionLossReasonKind">
                <span class="label">喪失理由区分（厚年）</span>
                <span class="value">{{ getInsuranceLossReasonKindLabel(employee.pensionLossReasonKind) }}</span>
              </div>
            </div>
          </mat-expansion-panel>

          <!-- 7. マイナンバー（マスク表示） -->
          <div class="info-section mb-4" *ngIf="maskMyNumber(employee.myNumber) as maskedMyNumber">
            <div class="info-section-header">
              <h3 class="mat-h3 flex-row align-center gap-2 m-0">
                <mat-icon color="primary">lock</mat-icon> マイナンバー
              </h3>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">個人番号</span>
                <span class="value">{{ maskedMyNumber }}</span>
              </div>
            </div>
          </div>
        </ng-container>

        <ng-template #noEmployee>
          <div class="empty-state">
            <mat-icon>person_off</mat-icon>
            <p>従業員として登録されていないため、マイページ情報は表示されません。</p>
          </div>
        </ng-template>
      </mat-card>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center mb-4">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">family_restroom</mat-icon> 扶養家族（被扶養者）
          </h2>
            <p class="mat-body-2" style="color: #666">追加・変更・削除は申請フローから行います</p>
          </div>
          <button mat-flat-button color="primary" (click)="openDependentAddForm()">
            <mat-icon>person_add</mat-icon>
            扶養家族を追加申請する
          </button>
        </div>

        <ng-container *ngIf="dependents$ | async as dependents">
          <div class="dependents-empty" *ngIf="dependents.length === 0">
            <mat-icon>group_off</mat-icon>
            <p>扶養家族が登録されていません。</p>
          </div>

          <div class="dependents-grid" *ngIf="dependents.length > 0">
            <div class="dependent-card" *ngFor="let dependent of dependents">
              <div class="dependent-header">
                <div class="dependent-name">{{ dependent.name }}</div>
                <div class="dependent-relationship">
                  {{ getDependentRelationshipLabel(dependent.relationship) }}
                </div>
              </div>
              <div class="dependent-row">
                <span class="label">生年月日</span>
                <span class="value">{{ dependent.dateOfBirth | date: 'yyyy-MM-dd' }}</span>
              </div>
              <div class="dependent-row">
                <span class="label">資格取得日</span>
                <span class="value">
                  <ng-container *ngIf="dependent.qualificationAcquiredDate; else noQualificationAcquired">
                    {{ dependent.qualificationAcquiredDate | date: 'yyyy-MM-dd' }}
                  </ng-container>
                  <ng-template #noQualificationAcquired>-</ng-template>
                </span>
              </div>
              <div class="dependent-row">
                <span class="label">資格喪失日</span>
                <span class="value">
                  <ng-container *ngIf="dependent.qualificationLossDate; else noQualificationLoss">
                    {{ dependent.qualificationLossDate | date: 'yyyy-MM-dd' }}
                  </ng-container>
                  <ng-template #noQualificationLoss>-</ng-template>
                </span>
              </div>
              <div class="dependent-actions">
                <button
                  mat-stroked-button
                  color="primary"
                  (click)="openDependentUpdateForm(dependent.id)"
                >
                  <mat-icon>edit</mat-icon>
                  情報変更を申請
                </button>
                <button
                  mat-stroked-button
                  color="warn"
                  (click)="openDependentRemoveForm(dependent.id)"
                >
                  <mat-icon>delete</mat-icon>
                  削除を申請
                </button>
              </div>
            </div>
          </div>
        </ng-container>
      </mat-card>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center mb-4">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">account_balance_wallet</mat-icon> 月次保険料
          </h2>
          </div>
        </div>

        <ng-container *ngIf="monthlyPremiums$ | async as premiums">
          <div class="table-container" *ngIf="premiums.length > 0; else noMonthlyPremiums">
            <table mat-table [dataSource]="premiums" class="admin-table">
              <ng-container matColumnDef="yearMonth">
                <th mat-header-cell *matHeaderCellDef>年月</th>
                <td mat-cell *matCellDef="let row">{{ row.yearMonth }}</td>
              </ng-container>

              <ng-container matColumnDef="healthCareEmployee">
                <th mat-header-cell *matHeaderCellDef>健康・介護保険 本人</th>
                <td mat-cell *matCellDef="let row">
                  <div class="premium-value-cell">
                    <span>{{ (row.healthCareEmployee ?? row.healthEmployee ?? 0) | number }}</span>
                    <span class="split-sub-value" *ngIf="row.careEmployee != null && row.careEmployee > 0">
                      <span class="sub-label">介護分</span>
                      <span class="sub-value">{{ row.careEmployee | number }}</span>
                    </span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="healthCareEmployer">
                <th mat-header-cell *matHeaderCellDef>健康・介護保険 会社</th>
                <td mat-cell *matCellDef="let row">
                  <div class="premium-value-cell">
                    <span>({{ (row.healthCareEmployer ?? row.healthEmployer ?? 0) | number }})</span>
                    <span class="split-sub-value" *ngIf="row.careEmployer != null && row.careEmployer > 0">
                      <span class="sub-label">（介護分）</span>
                      <span class="sub-value">({{ row.careEmployer | number }})</span>
                    </span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="pensionEmployee">
                <th mat-header-cell *matHeaderCellDef>厚生年金 本人</th>
                <td mat-cell *matCellDef="let row">{{ row.pensionEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="pensionEmployer">
                <th mat-header-cell *matHeaderCellDef>厚生年金 会社</th>
                <td mat-cell *matCellDef="let row">{{ row.pensionEmployer | number }}</td>
              </ng-container>

              <ng-container matColumnDef="totalEmployee">
                <th mat-header-cell *matHeaderCellDef>本人合計</th>
                <td mat-cell *matCellDef="let row">{{ row.totalEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="totalEmployer">
                <th mat-header-cell *matHeaderCellDef>会社合計</th>
                <td mat-cell *matCellDef="let row">{{ row.totalEmployer | number }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="premiumDisplayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: premiumDisplayedColumns"></tr>
            </table>
          </div>

          <ng-template #noMonthlyPremiums>
            <div class="empty-state">
              <mat-icon>pending_actions</mat-icon>
              <p>まだ計算された月次保険料はありません。</p>
            </div>
          </ng-template>
        </ng-container>
      </mat-card>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center mb-4">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">workspace_premium</mat-icon> 賞与保険料
          </h2>
          </div>
        </div>

        <ng-container *ngIf="bonusPremiums$ | async as bonuses">
          <div class="table-container" *ngIf="bonuses.length > 0; else noBonusPremiums">
            <table mat-table [dataSource]="bonuses" class="admin-table">
              <ng-container matColumnDef="payDate">
                <th mat-header-cell *matHeaderCellDef>支給日</th>
                <td mat-cell *matCellDef="let row">{{ row.payDate | date: 'yyyy-MM-dd' }}</td>
              </ng-container>

              <ng-container matColumnDef="grossAmount">
                <th mat-header-cell *matHeaderCellDef>賞与支給額</th>
                <td mat-cell *matCellDef="let row">{{ row.grossAmount | number }}</td>
              </ng-container>

              <ng-container matColumnDef="standardBonusAmount">
                <th mat-header-cell *matHeaderCellDef>標準賞与額</th>
                <td mat-cell *matCellDef="let row">{{ row.standardBonusAmount | number }}</td>
              </ng-container>

              <ng-container matColumnDef="healthCareEmployee">
                <th mat-header-cell *matHeaderCellDef>健康・介護保険 本人</th>
                <td mat-cell *matCellDef="let row">
                  <div class="premium-value-cell">
                    <span>{{ row.healthCareEmployee ?? 0 | number }}</span>
                    <span class="split-sub-value" *ngIf="row.isCareTarget && row.careEmployee != null && row.careEmployee > 0">
                      <span class="sub-label">介護分</span>
                      <span class="sub-value">{{ row.careEmployee | number }}</span>
                    </span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="healthCareEmployer">
                <th mat-header-cell *matHeaderCellDef>健康・介護保険 会社</th>
                <td mat-cell *matCellDef="let row">
                  <div class="premium-value-cell">
                    <span>({{ row.healthCareEmployer ?? 0 | number }})</span>
                    <span class="split-sub-value" *ngIf="row.isCareTarget && row.careEmployer != null && row.careEmployer > 0">
                      <span class="sub-label">（介護分）</span>
                      <span class="sub-value">({{ row.careEmployer | number }})</span>
                    </span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="pensionEmployee">
                <th mat-header-cell *matHeaderCellDef>厚生年金 本人</th>
                <td mat-cell *matCellDef="let row">{{ row.pensionEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="pensionEmployer">
                <th mat-header-cell *matHeaderCellDef>厚生年金 会社</th>
                <td mat-cell *matCellDef="let row">{{ row.pensionEmployer | number }}</td>
              </ng-container>

              <ng-container matColumnDef="totalEmployee">
                <th mat-header-cell *matHeaderCellDef>本人合計</th>
                <td mat-cell *matCellDef="let row">{{ row.totalEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="totalEmployer">
                <th mat-header-cell *matHeaderCellDef>会社合計</th>
                <td mat-cell *matCellDef="let row">{{ row.totalEmployer | number }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="bonusDisplayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: bonusDisplayedColumns"></tr>
            </table>
          </div>

          <ng-template #noBonusPremiums>
            <div class="empty-state">
              <mat-icon>pending_actions</mat-icon>
              <p>まだ登録された賞与保険料はありません。</p>
            </div>
          </ng-template>
        </ng-container>
      </mat-card>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center mb-4">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">edit</mat-icon> 申請・手続き
          </h2>
        </div>
          <button
            mat-flat-button
            color="primary"
            (click)="openChangeRequestDialog()"
            [disabled]="!(employee$ | async)"
          >
            <mat-icon>add</mat-icon>
            新しい申請を作成
          </button>
        </div>

        <ng-container *ngIf="requestsWithEmployee$ | async as data">
          <div class="table-container" *ngIf="data.requests.length > 0; else noChangeRequests">
            <table mat-table [dataSource]="data.requests" class="admin-table">
              <ng-container matColumnDef="requestedAt">
                <th mat-header-cell *matHeaderCellDef>申請日時</th>
                <td mat-cell *matCellDef="let row">{{ row.requestedAt | date: 'yyyy-MM-dd HH:mm' }}</td>
              </ng-container>

              <ng-container matColumnDef="kind">
                <th mat-header-cell *matHeaderCellDef>申請種別</th>
                <td mat-cell *matCellDef="let row">{{ getKindLabel(row.kind) }}</td>
              </ng-container>

              <ng-container matColumnDef="field">
                <th mat-header-cell *matHeaderCellDef>変更項目</th>
                <td mat-cell *matCellDef="let row">
                  {{
                    row.kind === 'profile'
                      ? getFieldLabel(row.field)
                      : row.kind === 'bankAccount'
                        ? '口座情報'
                        : '-'
                  }}
                </td>
              </ng-container>

              <ng-container matColumnDef="target">
                <th mat-header-cell *matHeaderCellDef>対象被扶養者</th>
                <td mat-cell *matCellDef="let row">{{ getTargetDependentLabel(row) }}</td>
              </ng-container>

              <ng-container matColumnDef="currentValue">
                <th mat-header-cell *matHeaderCellDef>現在の値</th>
                <td mat-cell *matCellDef="let row">
                  <ng-container [ngSwitch]="row.kind">
                    <ng-container *ngSwitchCase="'bankAccount'">
                      <div class="bank-account-info" *ngIf="data.employee?.bankAccount as bankAccount; else noCurrent">
                        <div><strong>金融機関名:</strong> {{ bankAccount.bankName }}</div>
                        <div *ngIf="bankAccount.bankCode"><strong>金融機関コード:</strong> {{ bankAccount.bankCode }}</div>
                        <div><strong>支店名:</strong> {{ bankAccount.branchName }}</div>
                        <div *ngIf="bankAccount.branchCode"><strong>支店コード:</strong> {{ bankAccount.branchCode }}</div>
                        <div><strong>口座種別:</strong> {{ getBankAccountTypeLabel(bankAccount.accountType) }}</div>
                        <div><strong>口座番号:</strong> {{ bankAccount.accountNumber }}</div>
                        <div><strong>名義:</strong> {{ bankAccount.accountHolderName }}</div>
                        <div *ngIf="bankAccount.accountHolderKana"><strong>名義カナ:</strong> {{ bankAccount.accountHolderKana }}</div>
                      </div>
                      <ng-template #noCurrent>未登録</ng-template>
                    </ng-container>
                    <ng-container *ngSwitchDefault>
                      {{ row.currentValue || '-' }}
                    </ng-container>
                  </ng-container>
                </td>
              </ng-container>

              <ng-container matColumnDef="requestedValue">
                <th mat-header-cell *matHeaderCellDef>申請する値</th>
                <td mat-cell *matCellDef="let row">
                  <ng-container [ngSwitch]="row.kind">
                    <ng-container *ngSwitchCase="'bankAccount'">
                      <div class="bank-account-info" *ngIf="getBankAccountPayload(row) as payload; else noPayload">
                        <div><strong>金融機関名:</strong> {{ payload.bankName }}</div>
                        <div *ngIf="payload.bankCode"><strong>金融機関コード:</strong> {{ payload.bankCode }}</div>
                        <div><strong>支店名:</strong> {{ payload.branchName }}</div>
                        <div *ngIf="payload.branchCode"><strong>支店コード:</strong> {{ payload.branchCode }}</div>
                        <div><strong>口座種別:</strong> {{ getBankAccountTypeLabel(payload.accountType) }}</div>
                        <div><strong>口座番号:</strong> {{ payload.accountNumber }}</div>
                        <div><strong>名義:</strong> {{ payload.accountHolderName }}</div>
                        <div *ngIf="payload.accountHolderKana"><strong>名義カナ:</strong> {{ payload.accountHolderKana }}</div>
                      </div>
                      <ng-template #noPayload>-</ng-template>
                    </ng-container>
                    <ng-container *ngSwitchDefault>
                      {{ row.requestedValue }}
                    </ng-container>
                  </ng-container>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>ステータス</th>
                <td mat-cell *matCellDef="let row">
                  <span [class]="'status-chip status-' + row.status">
                    {{ getStatusLabel(row.status) }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="rejectReason">
                <th mat-header-cell *matHeaderCellDef>却下理由</th>
                <td mat-cell *matCellDef="let row">
                  <span *ngIf="row.rejectReason; else noReason" class="reject-reason">
                    {{ row.rejectReason }}
                  </span>
                  <ng-template #noReason>-</ng-template>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let row">
                  <button
                    mat-stroked-button
                    color="warn"
                    *ngIf="row.status === 'pending'"
                    (click)="cancelRequest(row)"
                  >
                    取り下げ
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="requestHistoryColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: requestHistoryColumns"></tr>
            </table>
          </div>
        </ng-container>

        <ng-template #noChangeRequests>
          <div class="empty-state">
            <mat-icon>pending_actions</mat-icon>
            <p>申請履歴がありません。</p>
          </div>
        </ng-template>
      </mat-card>

      <!-- 書類アップロード依頼セクション -->
      <mat-card class="content-card" *ngIf="employee$ | async as employee">
        <div class="flex-row justify-between align-center mb-4">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">mail</mat-icon> 書類アップロード依頼
          </h2>
            <p class="mat-body-2" style="color: #666">管理者から依頼された書類をアップロードしてください。</p>
        </div>
        </div>

        <ng-container *ngIf="documentRequests$ | async as requests">
          <div class="document-requests-list" *ngIf="requests.length > 0; else noDocumentRequests">
            <div class="request-card" *ngFor="let request of requests">
              <div class="request-header">
                <div class="request-title-section">
                  <span class="category-badge">{{ getDocumentCategoryLabel(request.category) }}</span>
                  <h3>{{ request.title }}</h3>
                </div>
                <button
                  mat-flat-button
                  color="primary"
                  (click)="openDocumentUploadDialog(request)"
                >
                  <mat-icon>upload</mat-icon>
                  ファイルをアップロード
                </button>
              </div>
              <div class="request-message" *ngIf="request.message">
                <p>{{ request.message }}</p>
              </div>
              <div class="request-meta">
                <span class="meta-item">
                  <mat-icon>person</mat-icon>
                  依頼者: {{ request.requestedByDisplayName }}
                </span>
                <span class="meta-item">
                  <mat-icon>calendar_today</mat-icon>
                  依頼日: {{ request.createdAt | date: 'yyyy-MM-dd' }}
                </span>
                <span class="meta-item" *ngIf="request.dueDate">
                  <mat-icon>event</mat-icon>
                  締め切り: {{ request.dueDate | date: 'yyyy-MM-dd' }}
                  <span class="days-remaining" *ngIf="getDaysRemaining(request.dueDate) !== null">
                    (残り{{ getDaysRemaining(request.dueDate) }}日)
                  </span>
                </span>
              </div>
            </div>
          </div>

          <ng-template #noDocumentRequests>
            <div class="empty-state">
              <mat-icon>inbox</mat-icon>
              <p>現在、アップロード依頼はありません。</p>
            </div>
          </ng-template>
        </ng-container>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 1366px;
        margin: 0 auto;
        padding: 24px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 24px;

        @media (max-width: 600px) {
          padding: 16px;
          gap: 16px;
        }
      }

      .content-card {
        padding: 24px;
        border-radius: 8px;
        /* box-shadowはAngular Materialのデフォルトを使用 */
      }

      .m-0 { margin: 0; }

      .info-section {
        /* 旧 .sub-card に相当。よりフラットで区切りが明確なデザインへ */
        margin-bottom: 24px;
        padding: 24px;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        background-color: #fafafa;
      }
      
      .info-section:last-child {
        margin-bottom: 0;
      }

      .info-section-header {
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e0e0e0;
      }

      /* 共通ユーティリティ */
      .mb-0 { margin-bottom: 0; }
      .mb-2 { margin-bottom: 8px; }
      .mb-3 { margin-bottom: 16px; }
      .mb-4 { margin-bottom: 24px; }

      .flex-row { display: flex; flex-direction: row; }
      .align-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .gap-2 { gap: 8px; }

      .age-badge {
        color: #6b7280;
        font-size: 0.9rem;
        font-weight: normal;
        margin-left: 0.5rem;
      }

      .detail-panel {
        margin-top: 1rem;
        margin-bottom: 1rem;
      }

      .detail-panel mat-expansion-panel-header {
        padding: 1rem;
      }

      .detail-panel mat-panel-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        color: #999;
        background: #fff;

        mat-icon {
        font-size: 48px;
        width: 48px;
          height: 48px;
          margin-bottom: 16px;
          opacity: 0.3;
        }

        p {
          margin: 0 0 16px 0;
          font-size: 14px;
        }

        button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          
          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
            margin: 0;
            opacity: 1;
            vertical-align: middle;
          }
        }
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
      }

      .info-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .info-item .label {
        color: #6b7280;
        font-size: 0.85rem;
      }

      .info-item .value {
        font-weight: 500;
        color: #111827;
        font-size: 1rem;
      }

      .info-item .value.inactive {
        color: #ef4444;
      }

      .table-container {
        position: relative;
        overflow-x: auto;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 4px;
      }

      .dependents-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
      }

      .dependent-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        background: #fff;
        position: relative;
      }

      .dependent-actions {
        display: flex;
        gap: 8px;
        margin-top: 16px;
        justify-content: flex-end;
        padding-top: 12px;
        border-top: 1px solid #f0f0f0;
      }

      .dependent-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 8px;
      }

      .dependent-name {
        font-weight: 700;
        color: #111827;
        font-size: 1.1rem;
      }

      .dependent-relationship {
        color: #6b7280;
        font-size: 0.9rem;
        background: #f3f4f6;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .dependent-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.95rem;
        padding: 4px 0;
      }

      .dependent-row .label {
        color: #6b7280;
      }

      .dependent-row .value {
        color: #111827;
        font-weight: 500;
      }

      .dependents-empty {
        text-align: center;
        padding: 48px 24px;
        color: #999;
      }

      .dependents-empty mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #9ca3af;
        opacity: 0.3;
        display: block;
        margin: 0 auto 16px;
      }

      .document-requests-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .request-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 24px;
        background: #fff;
      }

      .request-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
        flex-wrap: wrap;
        gap: 16px;
      }

      .request-title-section {
        flex: 1;
        min-width: 200px;
      }

      .category-badge {
        display: inline-block;
        padding: 2px 8px;
        background-color: #e3f2fd;
        color: #1976d2;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .request-title-section h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #111827;
      }

      .request-message {
        margin-bottom: 16px;
        padding: 16px;
        background-color: #f5f7fa;
        border-radius: 4px;
        border-left: 4px solid #1a237e;
      }

      .request-message p {
        margin: 0;
        color: #555;
        font-size: 0.95rem;
        line-height: 1.6;
      }

      .request-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        font-size: 0.9rem;
        color: #6b7280;
        padding-top: 16px;
        border-top: 1px solid #f0f0f0;
      }

      .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .meta-item mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .days-remaining {
        color: #f59e0b;
        font-weight: 600;
        margin-left: 4px;
      }

      .status-chip {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }

      .status-pending {
        background: #fffbeb;
        color: #92400e;
      }

      .status-approved {
        background: #ecfdf3;
        color: #166534;
      }

      .status-rejected {
        background: #fef2f2;
        color: #991b1b;
      }

      .reject-reason {
        color: #991b1b;
        font-weight: 500;
      }

      .bank-account-info {
        font-size: 0.875rem;
        line-height: 1.6;
      }

      .bank-account-info div {
        margin-bottom: 4px;
      }

      .bank-account-info div:last-child {
        margin-bottom: 0;
      }

      .bank-account-info strong {
        color: #666;
        font-weight: 500;
        margin-right: 4px;
      }

      .premium-value-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }

      .split-sub-value {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        margin-top: 3px;
        padding-top: 3px;
        border-top: 1px dotted rgba(0,0,0,0.1);
      }

      .split-sub-value .sub-label {
        font-size: 0.6rem;
        color: #aaa;
        line-height: 1.2;
      }

      .split-sub-value .sub-value {
        font-size: 0.75rem;
        font-weight: 400;
        color: #888;
        line-height: 1.2;
      }
    `
  ]
})
export class MyPage {
  private readonly currentUser = inject(CurrentUserService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly changeRequestsService = inject(ChangeRequestsService);
  private readonly documentsService = inject(DocumentsService);
  private readonly employeesService = inject(EmployeesService);
  private readonly dependentsService = inject(DependentsService);
  private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
  private readonly bonusPremiumsService = inject(BonusPremiumsService);
  private readonly mastersService = inject(MastersService);
  private readonly officesService = inject(OfficesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly premiumDisplayedColumns = [
    'yearMonth',
    'healthCareEmployee',
    'healthCareEmployer',
    'pensionEmployee',
    'pensionEmployer',
    'totalEmployee',
    'totalEmployer'
  ];

  readonly bonusDisplayedColumns = [
    'payDate',
    'grossAmount',
    'standardBonusAmount',
    'healthCareEmployee',
    'healthCareEmployer',
    'pensionEmployee',
    'pensionEmployer',
    'totalEmployee',
    'totalEmployer'
  ];

  readonly requestHistoryColumns = [
    'requestedAt',
    'kind',
    'field',
    'target',
    'currentValue',
    'requestedValue',
    'status',
    'rejectReason',
    'actions'
  ];

  readonly employee$ = combineLatest([this.currentUser.profile$, this.currentOffice.officeId$]).pipe(
    switchMap(([profile, officeId]) => {
      if (!profile?.employeeId || !officeId) {
        return of(null);
      }

      return this.employeesService.get(officeId, profile.employeeId);
    })
  );

  readonly monthlyPremiums$ = combineLatest([this.currentUser.profile$, this.currentOffice.officeId$]).pipe(
    switchMap(([profile, officeId]) => {
      if (!profile?.employeeId || !officeId) {
        return of([] as MonthlyPremium[]);
      }

      return this.monthlyPremiumsService.listByOfficeAndEmployee(officeId, profile.employeeId);
    })
  );

  readonly bonusPremiums$ = combineLatest([
    this.currentUser.profile$,
    this.currentOffice.officeId$,
    this.employee$
  ]).pipe(
    switchMap(([profile, officeId, employee]) => {
      if (!profile?.employeeId || !officeId || !employee) {
        return of([] as BonusPremium[]);
      }

      return this.bonusPremiumsService.listByOfficeAndEmployee(officeId, profile.employeeId).pipe(
        switchMap((bonuses) => {
          if (bonuses.length === 0) {
            return of([]);
          }

          return this.officesService.watchOffice(officeId).pipe(
            switchMap((office) => {
              if (!office) {
                return of(bonuses);
              }

              // 各賞与について、介護保険料を計算
              return combineLatest(
                bonuses.map((bonus) => {
                  const yearMonth = bonus.payDate.substring(0, 7) as YearMonthString;
                  return from(this.mastersService.getRatesForYearMonth(office, yearMonth)).pipe(
                    map((rates) => {
                      // 健康保険＋介護保険の計算
                      let healthCareFull = 0;
                      let healthCareEmployee = 0;
                      let healthCareEmployer = 0;
                      let careFull = 0;
                      let careEmployee = 0;
                      let careEmployer = 0;
                      let isCareTarget = false;

                      const hasHealth = hasInsuranceInMonth(employee, yearMonth, 'health');
                      if (hasHealth && bonus.healthEffectiveAmount > 0) {
                        isCareTarget = isCareInsuranceTarget(employee.birthDate, yearMonth);
                        const careRate = isCareTarget && rates.careRate ? rates.careRate : 0;
                        const combinedRate = (rates.healthRate ?? 0) + careRate;
                        healthCareFull = bonus.healthEffectiveAmount * combinedRate;
                        healthCareEmployee = roundForEmployeeDeduction(healthCareFull / 2);
                        healthCareEmployer = healthCareFull - healthCareEmployee;
                        
                        // 介護保険料の個別計算（データベースから取得した値を使用、なければ計算）
                        careFull = bonus.careFull ?? (isCareTarget && careRate > 0 ? bonus.healthEffectiveAmount * careRate : 0);
                        careEmployee = bonus.careEmployee ?? roundForEmployeeDeduction(careFull / 2);
                        careEmployer = bonus.careEmployer ?? (careFull - careEmployee);
                      }

                      return {
                        ...bonus,
                        healthCareEmployee,
                        healthCareEmployer,
                        careEmployee,
                        careEmployer,
                        isCareTarget
                      };
                    })
                  );
                })
              );
            })
          );
        })
      );
    })
  );

  readonly dependents$ = combineLatest([this.currentUser.profile$, this.currentOffice.officeId$]).pipe(
    switchMap(([profile, officeId]) => {
      if (!profile?.employeeId || !officeId) {
        return of([] as Dependent[]);
      }

      return this.dependentsService.list(officeId, profile.employeeId);
    })
  );

  readonly myRequests$ = combineLatest([this.currentOffice.officeId$, this.currentUser.profile$]).pipe(
    switchMap(([officeId, profile]) => {
      if (!officeId || !profile?.id) {
        return of([] as ChangeRequest[]);
      }

      return this.changeRequestsService.listForUser(officeId, profile.id, undefined, 10); // マイページは10件まで表示
    })
  );

  readonly requestsWithEmployee$ = combineLatest([this.myRequests$, this.employee$]).pipe(
    map(([requests, employee]) => ({
      requests,
      employee
    }))
  );

  readonly documentRequests$ = combineLatest([this.currentOffice.officeId$, this.currentUser.profile$]).pipe(
    switchMap(([officeId, profile]) => {
      if (!officeId || !profile?.employeeId) {
        return of([] as DocumentRequest[]);
      }

      return this.documentsService.listRequests(officeId, profile.employeeId, 'pending');
    })
  );

  async openChangeRequestDialog(): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);

    if (!officeId) {
      return;
    }

    this.dialog.open(RequestKindSelectionDialogComponent, {
      width: '500px'
    });
  }

  async openDependentAddForm(): Promise<void> {
    const [profile, officeId] = await Promise.all([
      firstValueFrom(this.currentUser.profile$),
      firstValueFrom(this.currentOffice.officeId$)
    ]);

    if (!profile?.employeeId || !officeId) {
      return;
    }

    this.dialog.open(DependentAddRequestFormDialogComponent, {
      width: '800px',
      data: {
        officeId,
        employeeId: profile.employeeId
      }
    });
  }

  async openDependentUpdateForm(dependentId: string): Promise<void> {
    const [profile, officeId] = await Promise.all([
      firstValueFrom(this.currentUser.profile$),
      firstValueFrom(this.currentOffice.officeId$)
    ]);

    if (!profile?.employeeId || !officeId) {
      return;
    }

    this.dialog.open(DependentUpdateRequestFormDialogComponent, {
      width: '600px',
      data: {
        officeId,
        employeeId: profile.employeeId,
        dependentId
      }
    });
  }

  async openDependentRemoveForm(dependentId: string): Promise<void> {
    const [profile, officeId] = await Promise.all([
      firstValueFrom(this.currentUser.profile$),
      firstValueFrom(this.currentOffice.officeId$)
    ]);

    if (!profile?.employeeId || !officeId) {
      return;
    }

    this.dialog.open(DependentRemoveRequestFormDialogComponent, {
      width: '600px', // 削除確認なので少し狭くても良いが他と合わせてもOK。今回は600pxのままか、少し広げる。削除理由くらいしかないので600pxで十分か
      data: {
        officeId,
        employeeId: profile.employeeId,
        dependentId
      }
    });
  }

  async openBankAccountChangeRequest(employee: Employee): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    this.dialog.open(BankAccountChangeRequestFormDialogComponent, {
      width: '800px',
      data: {
        officeId,
        employeeId: employee.id,
        currentBankAccount: employee.bankAccount ?? null
      }
    });
  }

  getFieldLabel(field: ChangeRequest['field'] | undefined): string {
    switch (field) {
      case 'postalCode':
        return '郵便番号';
      case 'address':
        return '住所';
      case 'phone':
        return '電話番号';
      case 'contactEmail':
        return '連絡先メール';
      case 'kana':
        return 'カナ';
      case 'other':
        return 'その他';
      default:
        return field || '-';
    }
  }

  getKindLabel(kind: ChangeRequest['kind']): string {
    return getChangeRequestKindLabel(kind);
  }

  getStatusLabel(status: ChangeRequestStatus): string {
    return getChangeRequestStatusLabel(status);
  }

  getTargetDependentLabel(request: ChangeRequest): string {
    if (request.kind === 'profile' || request.kind === 'bankAccount') {
      return '-';
    }

    const payload = request.payload as
      | { name?: string; relationship?: string }
      | { dependentName?: string; relationship?: string }
      | undefined;

    const name = (payload as any)?.name ?? (payload as any)?.dependentName;
    const relationship = (payload as any)?.relationship;

    if (!name) {
      return '-';
    }

    const relationshipLabel = relationship
      ? `（${this.getDependentRelationshipLabel(relationship as any)}）`
      : '';

    return `${name}${relationshipLabel}`;
  }

  getBankAccountPayload(request: ChangeRequest): BankAccountChangePayload | null {
    if (request.kind !== 'bankAccount') return null;
    return (request.payload as BankAccountChangePayload) ?? null;
  }

  getCurrentBankAccount(request: ChangeRequest): BankAccount | null {
    if (request.kind !== 'bankAccount') return null;
    // employee$から現在の従業員情報を取得して口座情報を返す
    // テンプレートで employee$ | async と組み合わせて使用する
    return null; // テンプレート側で employee$ から取得する
  }

  async cancelRequest(request: ChangeRequest): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);

    if (!officeId || request.status !== 'pending') {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: '申請の取り下げ',
        message: 'この申請を取り下げますか？',
        confirmText: '取り下げる',
        cancelText: 'キャンセル',
        confirmColor: 'warn'
      }
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }

    await this.changeRequestsService.cancel(officeId, request.id);
  }

  protected readonly getDependentRelationshipLabel = getDependentRelationshipLabel;
  protected readonly getBankAccountTypeLabel = getBankAccountTypeLabel;
  protected readonly getPayrollPayTypeLabel = getPayrollPayTypeLabel;
  protected readonly getPayrollPayCycleLabel = getPayrollPayCycleLabel;

  getDocumentCategoryLabel(category: string): string {
    return getDocumentCategoryLabel(category as any);
  }

  getDaysRemaining(dueDate: string | null | undefined): number | null {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
  
    // 日単位でのズレを減らすために 0:00 固定にそろえるのもアリ
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
  
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
    return diffDays >= 0 ? diffDays : 0;
  }
  
  async openDocumentUploadDialog(request: DocumentRequest): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    const dialogRef = this.dialog.open(DocumentUploadDialogComponent, {
      width: '600px',
      data: { officeId, request }
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result) {
      this.snackBar.open('書類をアップロードしました', '閉じる', { duration: 3000 });
    }
  }
  protected readonly getEmploymentTypeLabel = getEmploymentTypeLabel;
  protected readonly getInsuranceQualificationKindLabel = getInsuranceQualificationKindLabel;
  protected readonly getInsuranceLossReasonKindLabel = getInsuranceLossReasonKindLabel;
  protected readonly getWorkingStatusLabel = getWorkingStatusLabel;
  protected readonly getSexLabel = getSexLabel;
  protected readonly maskMyNumber = maskMyNumber;
  protected readonly calculateAge = calculateAge;
}
