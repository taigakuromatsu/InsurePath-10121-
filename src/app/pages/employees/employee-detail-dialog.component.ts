import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  QueryList,
  ViewChild,
  ViewChildren,
  inject
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DecimalPipe } from '@angular/common'; // ★ number パイプ用
import { firstValueFrom, map, Observable, of, switchMap } from 'rxjs';
import { MatTableModule } from '@angular/material/table';

import { Dependent, Employee, StandardRewardHistory, Sex } from '../../types';
import {
  getDependentRelationshipLabel,
  getInsuranceLossReasonKindLabel,
  getInsuranceQualificationKindLabel,
  getStandardRewardDecisionKindLabel,
  getBankAccountTypeLabel,
  getPayrollPayTypeLabel,
  getPayrollPayCycleLabel,
  getPremiumTreatmentLabel,
  getWorkingStatusLabel
} from '../../utils/label-utils';
import { DependentsService } from '../../services/dependents.service';
import { CurrentUserService } from '../../services/current-user.service';
import { DependentFormDialogComponent } from './dependent-form-dialog.component';
import { StandardRewardHistoryService } from '../../services/standard-reward-history.service';
import { StandardRewardHistoryFormDialogComponent } from './standard-reward-history-form-dialog.component';
import { DocumentGenerationDialogComponent } from '../documents/document-generation-dialog.component';
import { CurrentOfficeService } from '../../services/current-office.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../components/confirm-dialog.component';

export type DialogFocusSection =
  | 'basic'
  | 'work'
  | 'insurance'
  | 'health-qualification'
  | 'pension-qualification'
  | 'working-status'
  | 'dependents'
  | 'standard-reward-history'
  | 'bankAccount'
  | 'payrollSettings'
  | 'system';

export interface EmployeeDetailDialogData {
  employee: Employee;
  focusSection?: DialogFocusSection;
}

@Component({
  selector: 'ip-employee-detail-dialog',
  standalone: true,
  imports: [
    AsyncPipe,
    NgFor,
    NgIf,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSnackBarModule,
    DecimalPipe // ★ 追加済み
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">person</mat-icon>
      <span>従業員詳細</span>
      <span class="subtitle mat-body-2">{{ data.employee.name }}</span>
    </h1>

    <div mat-dialog-content class="content" #contentRef>
      <div class="section-nav" role="tablist">
        <button
          mat-stroked-button
          *ngFor="let section of sections"
          type="button"
          (click)="scrollToSection(section.id)"
          [color]="activeSection === section.id ? 'primary' : undefined"
          [attr.aria-label]="section.label"
        >
          <mat-icon aria-hidden="true">{{ section.icon }}</mat-icon>
          <span>{{ section.label }}</span>
        </button>
      </div>

      <!-- 基本情報 -->
      <div class="form-section" id="basic" #sectionBlock>
        <h2 class="mat-h3 section-title">
          <mat-icon>person</mat-icon>
        基本情報
      </h2>
      <div class="grid">
        <div class="label">氏名</div>
        <div class="value">{{ data.employee.name }}</div>

        <div class="label">カナ</div>
        <div class="value">{{ data.employee.kana || '-' }}</div>

        <div class="label">所属</div>
        <div class="value">{{ data.employee.department || '-' }}</div>

        <div class="label">生年月日</div>
        <div class="value">{{ data.employee.birthDate }}</div>

        <div class="label">入社日</div>
        <div class="value">{{ data.employee.hireDate }}</div>

        <div class="label">退社日</div>
        <div class="value">{{ data.employee.retireDate || '-' }}</div>

        <div class="label">住所</div>
        <div class="value">{{ data.employee.address || '-' }}</div>

        <div class="label">電話番号</div>
        <div class="value">{{ data.employee.phone || '-' }}</div>

        <div class="label">連絡先メール</div>
        <div class="value">{{ data.employee.contactEmail || '-' }}</div>

        <div class="label">被保険者整理番号</div>
        <div class="value">{{ data.employee.employeeCodeInOffice || '-' }}</div>

        <div class="label">性別</div>
        <div class="value">{{ getSexLabel(data.employee.sex) }}</div>

        <div class="label">郵便番号</div>
        <div class="value">{{ data.employee.postalCode || '-' }}</div>

        <div class="label">住所カナ</div>
        <div class="value">{{ data.employee.addressKana || '-' }}</div>

        <div class="label">マイナンバー</div>
        <div class="value">
          {{ data.employee.myNumber ? '登録済み（番号は非表示）' : '未登録' }}
        </div>
      </div>
      </div>

      <!-- 就労条件 -->
      <div class="form-section" id="work" #sectionBlock>
        <h2 class="mat-h3 section-title">
          <mat-icon>work</mat-icon>
        就労条件
      </h2>
      <div class="grid">
        <div class="label">雇用形態</div>
        <div class="value">{{ getEmploymentTypeLabel(data.employee.employmentType) }}</div>

        <div class="label">所定労働時間（週）</div>
        <div class="value">{{ data.employee.weeklyWorkingHours ?? '-' }}</div>

        <div class="label">所定労働日数（週）</div>
        <div class="value">{{ data.employee.weeklyWorkingDays ?? '-' }}</div>

        <div class="label">契約期間の見込み</div>
        <div class="value">{{ data.employee.contractPeriodNote || '-' }}</div>

        <div class="label">学生</div>
        <div class="value">{{ data.employee.isStudent ? '学生' : '-' }}</div>
      </div>
      </div>

      <!-- 社会保険情報 -->
      <div class="form-section" id="insurance" #sectionBlock>
        <h2 class="mat-h3 section-title">
          <mat-icon>account_balance</mat-icon>
        社会保険情報
      </h2>
      <div class="grid">
        <div class="label">社会保険対象</div>
        <div class="value">
          {{ data.employee.isInsured ? '加入' : '対象外' }}
        </div>

        <div class="label">被保険者記号</div>
        <div class="value">{{ data.employee.healthInsuredSymbol || '-' }}</div>

        <div class="label">被保険者番号</div>
        <div class="value">{{ data.employee.healthInsuredNumber || '-' }}</div>

        <div class="label">厚生年金番号</div>
        <div class="value">{{ data.employee.pensionNumber || '-' }}</div>

        <div class="label">健康保険 等級</div>
        <div class="value">{{ data.employee.healthGrade ?? '-' }}</div>

        <div class="label">健康保険 標準報酬月額</div>
        <div class="value">
          {{ data.employee.healthStandardMonthly != null ? (data.employee.healthStandardMonthly | number) + ' 円' : '-' }}
        </div>

        <div class="label">厚生年金 等級</div>
        <div class="value">{{ data.employee.pensionGrade ?? '-' }}</div>

        <div class="label">厚生年金 標準報酬月額</div>
        <div class="value">
          {{ data.employee.pensionStandardMonthly != null ? (data.employee.pensionStandardMonthly | number) + ' 円' : '-' }}
        </div>
      </div>
      </div>

      <!-- 資格情報（健康保険） -->
      <div class="form-section" id="health-qualification" #sectionBlock>
        <h2 class="mat-h3 section-title">
          <mat-icon>local_hospital</mat-icon>
        資格情報（健康保険）
      </h2>
      <div class="grid">
        <div class="label">資格取得日（健保）</div>
        <div class="value">{{ data.employee.healthQualificationDate || '-' }}</div>

        <div class="label">資格取得区分（健保）</div>
        <div class="value">
          {{
            getInsuranceQualificationKindLabel(
              data.employee.healthQualificationKind
            )
          }}
        </div>

        <div class="label">資格喪失日（健保）</div>
        <div class="value">{{ data.employee.healthLossDate || '-' }}</div>

        <div class="label">喪失理由区分（健保）</div>
        <div class="value">
          {{
            getInsuranceLossReasonKindLabel(
              data.employee.healthLossReasonKind
            )
          }}
        </div>
      </div>
      </div>

      <!-- 資格情報（厚生年金） -->
      <div class="form-section" id="pension-qualification" #sectionBlock>
        <h2 class="mat-h3 section-title">
          <mat-icon>account_balance</mat-icon>
        資格情報（厚生年金）
      </h2>
      <div class="grid">
        <div class="label">資格取得日（厚年）</div>
        <div class="value">{{ data.employee.pensionQualificationDate || '-' }}</div>

        <div class="label">資格取得区分（厚年）</div>
        <div class="value">
          {{
            getInsuranceQualificationKindLabel(
              data.employee.pensionQualificationKind
            )
          }}
        </div>

        <div class="label">資格喪失日（厚年）</div>
        <div class="value">{{ data.employee.pensionLossDate || '-' }}</div>

        <div class="label">喪失理由区分（厚年）</div>
        <div class="value">
          {{
            getInsuranceLossReasonKindLabel(
              data.employee.pensionLossReasonKind
            )
          }}
        </div>
      </div>
      </div>

      <!-- 就業状態 -->
      <div class="form-section" id="working-status" #sectionBlock>
        <h2 class="mat-h3 section-title">
          <mat-icon>event</mat-icon>
        就業状態
      </h2>
      <div class="grid">
        <div class="label">就業状態</div>
        <div class="value">{{ getWorkingStatusLabel(data.employee.workingStatus) }}</div>

        <div class="label">状態開始日</div>
        <div class="value">{{ data.employee.workingStatusStartDate || '-' }}</div>

        <div class="label">状態終了日</div>
        <div class="value">{{ data.employee.workingStatusEndDate || '-' }}</div>

        <div class="label">保険料の扱い</div>
        <div class="value">{{ getPremiumTreatmentLabel(data.employee.premiumTreatment) }}</div>

        <div class="label">備考</div>
        <div class="value">{{ data.employee.workingStatusNote || '-' }}</div>
      </div>
      </div>

      <!-- 給与振込口座 -->
      <div class="form-section" id="bankAccount" #sectionBlock>
        <h2 class="mat-h3 section-title">
          <mat-icon>account_balance_wallet</mat-icon>
          給与振込口座
        </h2>
        <div class="grid">
          <ng-container *ngIf="data.employee.bankAccount as bankAccount; else noBankAccount">
            <div class="label">金融機関名</div>
            <div class="value">{{ bankAccount.bankName }}</div>

            <div class="label">金融機関コード</div>
            <div class="value">{{ bankAccount.bankCode || '-' }}</div>

            <div class="label">支店名</div>
            <div class="value">{{ bankAccount.branchName }}</div>

            <div class="label">支店コード</div>
            <div class="value">{{ bankAccount.branchCode || '-' }}</div>

            <div class="label">口座種別</div>
            <div class="value">{{ getBankAccountTypeLabel(bankAccount.accountType) }}</div>

            <div class="label">口座番号</div>
            <div class="value">{{ bankAccount.accountNumber }}</div>

            <div class="label">名義</div>
            <div class="value">{{ bankAccount.accountHolderName }}</div>

            <div class="label">名義カナ</div>
            <div class="value">{{ bankAccount.accountHolderKana || '-' }}</div>
          </ng-container>
          <ng-template #noBankAccount>
            <div class="label">口座情報</div>
            <div class="value">未登録</div>
          </ng-template>
        </div>
      </div>

      <!-- 給与情報（保険用） -->
      <div class="form-section" id="payrollSettings" #sectionBlock>
        <h2 class="mat-h3 section-title">
          <mat-icon>payments</mat-icon>
          給与情報（保険用）
        </h2>
        <div class="grid">
          <ng-container *ngIf="data.employee.payrollSettings as payroll; else noPayroll">
            <div class="label">支給形態</div>
            <div class="value">{{ getPayrollPayTypeLabel(payroll.payType) }}</div>

            <div class="label">支給サイクル</div>
            <div class="value">{{ getPayrollPayCycleLabel(payroll.payCycle) }}</div>

            <div class="label">報酬月額</div>
            <div class="value">
              {{ payroll.insurableMonthlyWage != null ? (payroll.insurableMonthlyWage | number) + ' 円' : '-' }}
            </div>

            <div class="label">補足メモ</div>
            <div class="value">{{ payroll.note || '-' }}</div>
          </ng-container>
          <ng-template #noPayroll>
            <div class="label">給与情報</div>
            <div class="value">未登録</div>
          </ng-template>
      </div>
      </div>

      <!-- 標準報酬履歴 -->
      <div class="form-section" id="standard-reward-history" #sectionBlock>
        <div class="section-title standard-reward-title">
          <div class="flex-row align-center gap-2">
            <mat-icon>trending_up</mat-icon>
            <span class="mat-h3 m-0">標準報酬履歴</span>
          </div>

          <ng-container *ngIf="canManageStandardRewardHistory$ | async">
            <button
              mat-stroked-button
              color="primary"
              type="button"
              (click)="openAddStandardRewardHistory()"
            >
              <mat-icon>add</mat-icon>
              履歴を追加
            </button>
          </ng-container>
        </div>

        <ng-container *ngIf="standardRewardHistories$ | async as histories">
          <div class="standard-reward-empty" *ngIf="histories.length === 0">
            <mat-icon>history</mat-icon>
            <p>標準報酬履歴が登録されていません</p>
          </div>

          <div class="standard-reward-table" *ngIf="histories.length > 0">
            <ng-container
              *ngIf="canManageStandardRewardHistory$ | async as canManageStandardRewardHistory"
            >
              <table mat-table [dataSource]="histories" class="admin-table">
                <ng-container matColumnDef="decisionYearMonth">
                  <th mat-header-cell *matHeaderCellDef>決定年月</th>
                  <td mat-cell *matCellDef="let history">
                    {{ history.decisionYearMonth }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="appliedFromYearMonth">
                  <th mat-header-cell *matHeaderCellDef>適用開始年月</th>
                  <td mat-cell *matCellDef="let history">
                    {{ history.appliedFromYearMonth }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="standardMonthlyReward">
                  <th mat-header-cell *matHeaderCellDef>標準報酬月額</th>
                  <td mat-cell *matCellDef="let history">
                    {{ history.standardMonthlyReward | number }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="decisionKind">
                  <th mat-header-cell *matHeaderCellDef>決定区分</th>
                  <td mat-cell *matCellDef="let history">
                    {{ getStandardRewardDecisionKindLabel(history.decisionKind) }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="note">
                  <th mat-header-cell *matHeaderCellDef>メモ</th>
                  <td mat-cell *matCellDef="let history" class="standard-reward-note">
                    {{ history.note || '-' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef class="actions-header">操作</th>
                  <td mat-cell *matCellDef="let history" class="actions-cell">
                    <button
                      mat-icon-button
                      color="primary"
                      aria-label="標準報酬履歴を編集"
                      (click)="openEditStandardRewardHistory(history)"
                    >
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      color="warn"
                      aria-label="標準報酬履歴を削除"
                      (click)="deleteStandardRewardHistory(history)"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  </td>
                </ng-container>

                <tr
                  mat-header-row
                  *matHeaderRowDef="
                    canManageStandardRewardHistory
                      ? displayedStandardRewardColumns
                      : standardRewardColumnsWithoutActions
                  "
                ></tr>
                <tr
                  mat-row
                  *matRowDef="
                    let row;
                    columns:
                      canManageStandardRewardHistory
                        ? displayedStandardRewardColumns
                        : standardRewardColumnsWithoutActions
                  "
                ></tr>
              </table>
            </ng-container>
          </div>
        </ng-container>
      </div>

      <!-- 扶養家族 -->
      <div class="form-section" id="dependents" #sectionBlock>
        <div class="section-title dependents-title">
          <div class="flex-row align-center gap-2">
            <mat-icon>family_restroom</mat-icon>
            <span class="mat-h3 m-0">扶養家族</span>
          </div>
          <ng-container *ngIf="canManageDependents$ | async">
            <button mat-stroked-button color="primary" (click)="openAddDependent()">
              <mat-icon>person_add</mat-icon>
              扶養家族を追加
            </button>
          </ng-container>
        </div>

        <ng-container *ngIf="dependents$ | async as dependents">
          <div class="dependents-empty" *ngIf="dependents.length === 0">
            <mat-icon>group_off</mat-icon>
            <p>扶養家族が登録されていません</p>
          </div>

          <div class="dependents-grid" *ngIf="dependents.length > 0">
            <div class="dependent-card" *ngFor="let dependent of dependents">
              <div class="dependent-header">
                <div>
                  <div class="dependent-name">{{ dependent.name }}</div>
                  <div class="dependent-relationship">
                    {{ getDependentRelationshipLabel(dependent.relationship) }}
                  </div>
                </div>

                <div class="dependent-actions" *ngIf="canManageDependents$ | async">
                  <button mat-icon-button color="primary" (click)="openEditDependent(dependent)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="confirmDeleteDependent(dependent)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>

              <div class="dependent-row">
                <span class="label">生年月日</span>
                <span class="value">{{ dependent.dateOfBirth || '-' }}</span>
              </div>
              <div class="dependent-row">
                <span class="label">資格取得日</span>
                <span class="value">{{ dependent.qualificationAcquiredDate || '-' }}</span>
              </div>
              <div class="dependent-row">
                <span class="label">資格喪失日</span>
                <span class="value">{{ dependent.qualificationLossDate || '-' }}</span>
              </div>
            </div>
          </div>
        </ng-container>
      </div>

      <!-- システム情報 -->
      <div class="form-section" id="system" #sectionBlock>
        <h2 class="mat-h3 section-title">
          <mat-icon>info</mat-icon>
        システム情報
      </h2>
      <div class="grid">
        <div class="label">ID</div>
        <div class="value">{{ data.employee.id }}</div>

        <div class="label">作成日時</div>
        <div class="value">{{ data.employee.createdAt || '-' }}</div>

        <div class="label">更新日時</div>
        <div class="value">{{ data.employee.updatedAt || '-' }}</div>

        <div class="label">更新ユーザーID</div>
        <div class="value">{{ data.employee.updatedByUserId || '-' }}</div>
      </div>
      </div>
    </div>

    <div mat-dialog-actions align="end" class="dialog-actions">
      <button
        mat-stroked-button
        color="primary"
        type="button"
        (click)="openDocumentDialog('qualification_acquisition')"
      >
        <mat-icon>picture_as_pdf</mat-icon>
        資格取得届PDF
      </button>
      <button
        mat-stroked-button
        color="primary"
        type="button"
        (click)="openDocumentDialog('qualification_loss')"
      >
        <mat-icon>picture_as_pdf</mat-icon>
        資格喪失届PDF
      </button>
      <button mat-button mat-dialog-close>
        <mat-icon>close</mat-icon>
        閉じる
      </button>
    </div>
    `,
  styles: [
    `

       /* 標準報酬履歴テーブル：セクションナビより前面に出ないようにする */
      .standard-reward-table {
        position: relative;
        z-index: 0;
      }

      .standard-reward-table .admin-table {
        width: 100%;
      }

      /* グローバルの sticky ヘッダー設定を、このダイアログ内では無効化 */
      .standard-reward-table .admin-table .mat-mdc-header-row {
        position: static !important;
        top: auto !important;
        z-index: auto !important;
      }

      .dialog-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 16px 16px 12px;
        border-bottom: 1px solid #e0e0e0;
      }

      .subtitle {
        margin-left: auto;
        color: #666;
      }

      .content {
        display: flex;
        flex-direction: column;
        gap: 24px;
        max-height: 70vh;
        overflow-y: auto;
        padding: 16px;
        position: relative;
      }

      .section-nav {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 8px;
        position: sticky;
        top: 0;
        background: #fff;
        padding-bottom: 8px;
        z-index: 20;
      }

      .section-nav button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        white-space: nowrap;
      }

      .form-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding-bottom: 8px;
        border-bottom: 1px solid #e0e0e0;
      }

      .grid {
        display: grid;
        grid-template-columns: 170px 1fr;
        row-gap: 8px;
        column-gap: 12px;
        font-size: 0.95rem;
      }

      .label {
        color: #666;
        font-weight: 500;
      }

      .value {
        color: #333;
        word-break: break-word;
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

      .standard-reward-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .standard-reward-empty,
      .dependents-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #666;
        padding: 12px 0;
      }

      .standard-reward-note {
        white-space: pre-line;
      }

      .actions-header,
      .actions-cell {
        text-align: right;
      }

      .actions-cell {
        display: flex;
        justify-content: flex-end;
        gap: 4px;
      }

      .dependents-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 12px;
      }

      .dependent-card {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 12px;
        background: #fff;
      }

      .dependent-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 8px;
      }

      .dependent-name {
        font-weight: 700;
        font-size: 1rem;
      }

      .dependent-relationship {
        color: #6b7280;
        font-size: 0.9rem;
      }

      .dependent-actions {
        display: inline-flex;
        align-items: center;
        gap: 4px;
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
    `
  ]
})
export class EmployeeDetailDialogComponent implements AfterViewInit {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dependentsService = inject(DependentsService);
  private readonly standardRewardHistoryService = inject(StandardRewardHistoryService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly currentOffice = inject(CurrentOfficeService);

  readonly dependents$!: Observable<Dependent[]>;
  readonly standardRewardHistories$!: Observable<StandardRewardHistory[]>;

  readonly sections: Array<{ id: DialogFocusSection; label: string; icon: string }> = [
    { id: 'basic', label: '基本情報', icon: 'person' },
    { id: 'work', label: '就労条件', icon: 'work' },
    { id: 'insurance', label: '社会保険', icon: 'account_balance' },
    { id: 'health-qualification', label: '健保資格', icon: 'local_hospital' },
    { id: 'pension-qualification', label: '厚年資格', icon: 'account_balance' },
    { id: 'working-status', label: '就業状態', icon: 'event' },
    { id: 'bankAccount', label: '口座情報', icon: 'account_balance_wallet' },
    { id: 'payrollSettings', label: '給与情報', icon: 'payments' },
    { id: 'standard-reward-history', label: '標準報酬履歴', icon: 'trending_up' },
    { id: 'dependents', label: '扶養家族', icon: 'family_restroom' },
    { id: 'system', label: 'システム', icon: 'info' }
  ];

  activeSection: DialogFocusSection = 'basic';

  @ViewChild('contentRef') private readonly contentRef?: ElementRef<HTMLDivElement>;
  @ViewChildren('sectionBlock') private readonly sectionBlocks?: QueryList<
    ElementRef<HTMLElement>
  >;

  readonly canManageDependents$: Observable<boolean> = this.currentUser.profile$.pipe(
    map((profile) => profile?.role === 'admin' || profile?.role === 'hr')
  );
  readonly canManageStandardRewardHistory$: Observable<boolean> =
    this.canManageDependents$;

  readonly displayedStandardRewardColumns: Array<
    keyof Pick<
      StandardRewardHistory,
      'decisionYearMonth' | 'appliedFromYearMonth' | 'standardMonthlyReward' | 'decisionKind' | 'note'
    > | 'actions'
  > = [
    'decisionYearMonth',
    'appliedFromYearMonth',
    'standardMonthlyReward',
    'decisionKind',
    'note',
    'actions'
  ];
  readonly standardRewardColumnsWithoutActions = this.displayedStandardRewardColumns.filter(
    (column) => column !== 'actions'
  );

  constructor(@Inject(MAT_DIALOG_DATA) public data: EmployeeDetailDialogData) {
    this.dependents$ = this.dependentsService.list(
      this.data.employee.officeId,
      this.data.employee.id
    );

    this.standardRewardHistories$ = this.canManageStandardRewardHistory$.pipe(
      switchMap((canManage) =>
        canManage
          ? this.standardRewardHistoryService.list(
              this.data.employee.officeId,
              this.data.employee.id
            )
          : of([])
      )
    );
  }

  ngAfterViewInit(): void {
    if (this.data.focusSection) {
      // 少し待ってからスクロールを実行（ダイアログのアニメーションやレンダリング待ち）
      setTimeout(() => this.scrollToSection(this.data.focusSection!), 300);
    }
  }

  protected readonly getInsuranceQualificationKindLabel =
    getInsuranceQualificationKindLabel;
  protected readonly getInsuranceLossReasonKindLabel =
    getInsuranceLossReasonKindLabel;
  protected readonly getWorkingStatusLabel = getWorkingStatusLabel;
  protected readonly getPremiumTreatmentLabel = getPremiumTreatmentLabel;
  protected readonly getDependentRelationshipLabel = getDependentRelationshipLabel;
  protected readonly getStandardRewardDecisionKindLabel =
    getStandardRewardDecisionKindLabel;
  protected readonly getBankAccountTypeLabel = getBankAccountTypeLabel;
  protected readonly getPayrollPayTypeLabel = getPayrollPayTypeLabel;
  protected readonly getPayrollPayCycleLabel = getPayrollPayCycleLabel;

  protected readonly getSexLabel = (sex: Sex | null | undefined): string => {
    switch (sex) {
      case 'male':
        return '男';
      case 'female':
        return '女';
      case 'other':
        return 'その他';
      default:
        return '-';
    }
  };

  protected readonly getEmploymentTypeLabel = (
    type: Employee['employmentType'] | null | undefined
  ): string => {
    switch (type) {
      case 'regular':
        return '正社員';
      case 'contract':
        return '契約社員';
      case 'part':
        return 'パート';
      case 'アルバイト':
        return 'アルバイト';
      case 'other':
        return 'その他';
      default:
        return '-';
    }
  };

  async openDocumentDialog(
    type: 'qualification_acquisition' | 'qualification_loss'
  ): Promise<void> {
    const office = await firstValueFrom(this.currentOffice.office$);
    if (!office) {
      this.snackBar.open('事業所情報が取得できませんでした。', undefined, { duration: 3000 });
      return;
    }

    this.dialog.open(DocumentGenerationDialogComponent, {
      width: '720px',
      data: {
        office,
        employee: this.data.employee,
        defaultType: type
      }
    });
  }

  scrollToSection(sectionId: DialogFocusSection): void {
    const container = this.contentRef?.nativeElement;
    if (!container) return;

    const target = this.sectionBlocks
      ?.map((ref) => ref.nativeElement)
      .find((element) => element.id === sectionId) ||
      (container.querySelector(`#${sectionId}`) as HTMLElement | null);

    if (!target) return;

    const nav = container.querySelector('.section-nav') as HTMLElement | null;
    const navHeight = nav?.offsetHeight ?? 0;
    const margin = 12;

    // コンテナ内での相対位置を計算（現在のスクロール量を加味）
    // offsetTop は position: relative でない場合、祖先要素基準になる可能性があるため
    // getBoundingClientRect を使用して計算する
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const relativeTop = targetRect.top - containerRect.top + container.scrollTop;

    const scrollTop = relativeTop - navHeight - margin;

    container.scrollTo({
      top: Math.max(scrollTop, 0),
      behavior: 'smooth'
    });

    this.activeSection = sectionId;
  }

  openAddStandardRewardHistory(): void {
    this.dialog
      .open(StandardRewardHistoryFormDialogComponent, {
        width: '520px',
        data: {
          officeId: this.data.employee.officeId,
          employeeId: this.data.employee.id
        }
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.saveStandardRewardHistory(result);
        }
      });
  }

  openEditStandardRewardHistory(history: StandardRewardHistory): void {
    this.dialog
      .open(StandardRewardHistoryFormDialogComponent, {
        width: '520px',
        data: {
          officeId: this.data.employee.officeId,
          employeeId: this.data.employee.id,
          history
        }
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.saveStandardRewardHistory({ ...result, id: history.id });
        }
      });
  }

  deleteStandardRewardHistory(history: StandardRewardHistory): void {
    const confirmed = window.confirm('この標準報酬履歴を削除しますか？');
    if (!confirmed) return;

    this.standardRewardHistoryService
      .delete(this.data.employee.officeId, this.data.employee.id, history.id)
      .then(() =>
        this.snackBar.open('標準報酬履歴を削除しました', undefined, { duration: 2500 })
      )
      .catch(() =>
        this.snackBar.open('削除に失敗しました。時間をおいて再度お試しください。', undefined, {
          duration: 3000
        })
      );
  }

  private saveStandardRewardHistory(
    history: Partial<StandardRewardHistory> & { id?: string }
  ): void {
    this.standardRewardHistoryService
      .save(this.data.employee.officeId, this.data.employee.id, history)
      .then(() =>
        this.snackBar.open('標準報酬履歴を保存しました', undefined, { duration: 2500 })
      )
      .catch(() =>
        this.snackBar.open('保存に失敗しました。入力内容をご確認ください。', undefined, {
          duration: 3000
        })
      );
  }

  openAddDependent(): void {
    this.dialog
      .open(DependentFormDialogComponent, {
        width: '1200px',
        maxWidth: '95vw',
        data: {
          officeId: this.data.employee.officeId,
          employeeId: this.data.employee.id
        }
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.saveDependent(result);
        }
      });
  }

  openEditDependent(dependent: Dependent): void {
    this.dialog
      .open(DependentFormDialogComponent, {
        width: '1200px',
        maxWidth: '95vw',
        data: {
          officeId: this.data.employee.officeId,
          employeeId: this.data.employee.id,
          dependent
        }
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.saveDependent({ ...result, id: dependent.id, createdAt: dependent.createdAt });
        }
      });
  }

  async confirmDeleteDependent(dependent: Dependent): Promise<void> {
    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        width: '400px',
        data: {
          title: '扶養家族を削除しますか？',
          message: `扶養家族「${dependent.name}」を削除します。よろしいですか？`,
          confirmLabel: '削除',
          cancelLabel: 'キャンセル'
        }
      }
    );

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) {
      // キャンセル時は何もしない
      return;
    }

    // 削除処理を実行
    await this.deleteDependent(dependent);
  }

  private async deleteDependent(dependent: Dependent): Promise<void> {
    try {
      await this.dependentsService.delete(
        this.data.employee.officeId,
        this.data.employee.id,
        dependent.id
      );
      this.snackBar.open('扶養家族を削除しました', undefined, { duration: 2500 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('削除に失敗しました。時間をおいて再度お試しください。', undefined, {
        duration: 3000
      });
    }
  }

  private saveDependent(dependent: Partial<Dependent> & { id?: string }): void {
    this.dependentsService
      .save(this.data.employee.officeId, this.data.employee.id, dependent)
      .then(() => this.snackBar.open('扶養家族を保存しました', undefined, { duration: 2500 }))
      .catch(() =>
        this.snackBar.open('保存に失敗しました。入力内容をご確認ください。', undefined, {
          duration: 3000
        })
      );
  }
}
