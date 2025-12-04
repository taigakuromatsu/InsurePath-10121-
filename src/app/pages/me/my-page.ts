import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { combineLatest, firstValueFrom, of, switchMap } from 'rxjs';

import { BonusPremiumsService } from '../../services/bonus-premiums.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { ChangeRequestsService } from '../../services/change-requests.service';
import { EmployeesService } from '../../services/employees.service';
import { MonthlyPremiumsService } from '../../services/monthly-premiums.service';
import {
  BonusPremium,
  ChangeRequest,
  ChangeRequestStatus,
  Dependent,
  MonthlyPremium
} from '../../types';
import { DependentsService } from '../../services/dependents.service';
import {
  getChangeRequestKindLabel,
  getChangeRequestStatusLabel,
  getDependentRelationshipLabel,
  getEmploymentTypeLabel,
  getInsuranceLossReasonKindLabel,
  getInsuranceQualificationKindLabel,
  getPremiumTreatmentLabel,
  getSexLabel,
  getWorkingStatusLabel,
  maskMyNumber,
  calculateAge
} from '../../utils/label-utils';
import { RequestKindSelectionDialogComponent } from '../requests/request-kind-selection-dialog.component';
import { DependentAddRequestFormDialogComponent } from '../requests/dependent-add-request-form-dialog.component';
import { DependentUpdateRequestFormDialogComponent } from '../requests/dependent-update-request-form-dialog.component';
import { DependentRemoveRequestFormDialogComponent } from '../requests/dependent-remove-request-form-dialog.component';
import { ConfirmDialogComponent } from '../requests/confirm-dialog.component';

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
    DecimalPipe
  ],
  template: `
    <section class="page my-page">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>person</mat-icon>
          </div>
          <div class="header-text">
            <h1>マイページ</h1>
            <p>自分の社員情報と保険料明細を確認できます</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="page-header">
          <h2>
            <mat-icon>info</mat-icon>
            基本情報
          </h2>
        </div>

        <ng-container *ngIf="employee$ | async as employee; else noEmployee">
          <!-- 1. 基本プロフィールカード -->
          <mat-card class="sub-card">
            <div class="sub-card-header">
              <h3>
                <mat-icon>person</mat-icon>
                基本プロフィール
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
          </mat-card>

          <!-- 2. 住所・連絡先カード -->
          <mat-card class="sub-card">
            <div class="sub-card-header">
              <h3>
                <mat-icon>home</mat-icon>
                住所・連絡先
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
          </mat-card>

          <!-- 3. 就労条件カード -->
          <mat-card class="sub-card">
            <div class="sub-card-header">
              <h3>
                <mat-icon>work</mat-icon>
                就労条件
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
          </mat-card>

          <!-- 4. 社会保険・資格情報（サマリ）カード -->
          <mat-card class="sub-card">
            <div class="sub-card-header">
              <h3>
                <mat-icon>health_and_safety</mat-icon>
                社会保険・資格情報
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
          </mat-card>

          <!-- 5. 就業状態カード -->
          <mat-card class="sub-card" *ngIf="employee.workingStatus">
            <div class="sub-card-header">
              <h3>
                <mat-icon>event</mat-icon>
                就業状態
              </h3>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">現在の就業状態</span>
                <span class="value">{{ getWorkingStatusLabel(employee.workingStatus) }}</span>
              </div>
              <div class="info-item" *ngIf="employee.workingStatusStartDate">
                <span class="label">状態開始日</span>
                <span class="value">{{ employee.workingStatusStartDate | date: 'yyyy-MM-dd' }}</span>
              </div>
              <div class="info-item" *ngIf="employee.premiumTreatment">
                <span class="label">保険料の扱い</span>
                <span class="value">{{ getPremiumTreatmentLabel(employee.premiumTreatment) }}</span>
              </div>
            </div>
          </mat-card>

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
              <div class="info-item" *ngIf="employee.workingStatusEndDate">
                <span class="label">状態終了日</span>
                <span class="value">{{ employee.workingStatusEndDate | date: 'yyyy-MM-dd' }}</span>
              </div>
            </div>
          </mat-expansion-panel>

          <!-- 7. マイナンバー（マスク表示） -->
          <mat-card class="sub-card" *ngIf="maskMyNumber(employee.myNumber) as maskedMyNumber">
            <div class="sub-card-header">
              <h3>
                <mat-icon>lock</mat-icon>
                マイナンバー
              </h3>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">個人番号</span>
                <span class="value">{{ maskedMyNumber }}</span>
              </div>
            </div>
          </mat-card>
        </ng-container>

        <ng-template #noEmployee>
          <div class="empty-state">
            <mat-icon>person_off</mat-icon>
            <p>従業員として登録されていないため、マイページ情報は表示されません。</p>
          </div>
        </ng-template>
      </mat-card>

      <mat-card class="content-card">
        <div class="page-header">
          <div>
          <h2>
            <mat-icon>family_restroom</mat-icon>
              扶養家族（被扶養者）
          </h2>
            <p class="sub-text">追加・変更・削除は申請フローから行います</p>
          </div>
          <button mat-stroked-button color="primary" (click)="openDependentAddForm()">
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
        <div class="page-header">
          <h2>
            <mat-icon>account_balance_wallet</mat-icon>
            月次保険料
          </h2>
        </div>

        <ng-container *ngIf="monthlyPremiums$ | async as premiums">
          <div class="table-container" *ngIf="premiums.length > 0; else noMonthlyPremiums">
            <table mat-table [dataSource]="premiums" class="premium-table">
              <ng-container matColumnDef="yearMonth">
                <th mat-header-cell *matHeaderCellDef>年月</th>
                <td mat-cell *matCellDef="let row">{{ row.yearMonth }}</td>
              </ng-container>

              <ng-container matColumnDef="healthEmployee">
                <th mat-header-cell *matHeaderCellDef>健康保険 本人</th>
                <td mat-cell *matCellDef="let row">{{ row.healthEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="healthEmployer">
                <th mat-header-cell *matHeaderCellDef>健康保険 会社</th>
                <td mat-cell *matCellDef="let row">{{ row.healthEmployer | number }}</td>
              </ng-container>

              <ng-container matColumnDef="careEmployee">
                <th mat-header-cell *matHeaderCellDef>介護保険 本人</th>
                <td mat-cell *matCellDef="let row">{{ row.careEmployee != null ? (row.careEmployee | number) : '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="careEmployer">
                <th mat-header-cell *matHeaderCellDef>介護保険 会社</th>
                <td mat-cell *matCellDef="let row">{{ row.careEmployer != null ? (row.careEmployer | number) : '-' }}</td>
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

              <tr
                mat-header-row
                *matHeaderRowDef="premiumDisplayedColumns"
                class="table-header-row"
              ></tr>
              <tr mat-row *matRowDef="let row; columns: premiumDisplayedColumns" class="table-row"></tr>
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
        <div class="page-header">
          <h2>
            <mat-icon>workspace_premium</mat-icon>
            賞与保険料
          </h2>
        </div>

        <ng-container *ngIf="bonusPremiums$ | async as bonuses">
          <div class="table-container" *ngIf="bonuses.length > 0; else noBonusPremiums">
            <table mat-table [dataSource]="bonuses" class="bonus-table">
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

              <ng-container matColumnDef="healthEmployee">
                <th mat-header-cell *matHeaderCellDef>健康保険 本人</th>
                <td mat-cell *matCellDef="let row">{{ row.healthEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="healthEmployer">
                <th mat-header-cell *matHeaderCellDef>健康保険 会社</th>
                <td mat-cell *matCellDef="let row">{{ row.healthEmployer | number }}</td>
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

              <tr mat-header-row *matHeaderRowDef="bonusDisplayedColumns" class="table-header-row"></tr>
              <tr mat-row *matRowDef="let row; columns: bonusDisplayedColumns" class="table-row"></tr>
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
        <div class="page-header">
          <h2>
            <mat-icon>edit</mat-icon>
            申請・手続き
          </h2>
        </div>

        <div class="section-actions">
          <button
            mat-stroked-button
            color="primary"
            (click)="openChangeRequestDialog()"
            [disabled]="!(employee$ | async)"
          >
            <mat-icon>add</mat-icon>
            新しい申請を作成
          </button>
        </div>

        <ng-container *ngIf="myRequests$ | async as requests">
          <div class="table-container" *ngIf="requests.length > 0; else noChangeRequests">
            <table mat-table [dataSource]="requests" class="request-history-table">
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
                  {{ row.kind === 'profile' ? getFieldLabel(row.field) : '-' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="target">
                <th mat-header-cell *matHeaderCellDef>対象被扶養者</th>
                <td mat-cell *matCellDef="let row">{{ getTargetDependentLabel(row) }}</td>
              </ng-container>

              <ng-container matColumnDef="currentValue">
                <th mat-header-cell *matHeaderCellDef>現在の値</th>
                <td mat-cell *matCellDef="let row">{{ row.currentValue || '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="requestedValue">
                <th mat-header-cell *matHeaderCellDef>申請する値</th>
                <td mat-cell *matCellDef="let row">{{ row.requestedValue }}</td>
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
    </section>
  `,
  styles: [
    `
      .header-card {
        margin-bottom: 1.5rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .header-card ::ng-deep .mat-mdc-card-content {
        padding: 0;
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem;
      }

      .header-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 12px;
      }

      .header-icon mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: white;
      }

      .header-text h1 {
        margin: 0 0 0.5rem 0;
        font-size: 1.75rem;
        font-weight: 600;
      }

      .header-text p {
        margin: 0;
        opacity: 0.9;
      }

      .content-card {
        margin-bottom: 1.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .page-header {
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
      }

      .page-header h2 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #333;
      }

      .sub-text {
        margin: 0.25rem 0 0 0;
        font-size: 0.875rem;
        color: #666;
      }

      .sub-card {
        margin-bottom: 1rem;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
      }

      .sub-card-header {
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid #e5e7eb;
      }

      .sub-card-header h3 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #374151;
      }

      .sub-card-header mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #6b7280;
      }

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
        text-align: center;
        padding: 2rem 1rem;
        color: #666;
      }

      .empty-state mat-icon {
        font-size: 48px;
        height: 48px;
        width: 48px;
        color: #9ca3af;
        margin-bottom: 0.5rem;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
      }

      .info-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .info-item .label {
        color: #6b7280;
        font-size: 0.9rem;
      }

      .info-item .value {
        font-weight: 600;
        color: #111827;
        font-size: 1.05rem;
      }

      .info-item .value.inactive {
        color: #ef4444;
      }

      .table-container {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
      }

      table {
        width: 100%;
      }

      th,
      td {
        padding: 12px 16px;
      }

      th {
        background: #f9fafb;
        color: #374151;
        font-weight: 700;
      }

      .table-row:hover {
        background: #f3f4f6;
      }

      .dependents-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
      }

      .dependent-card {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 1rem;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        position: relative;
      }

      .dependent-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.75rem;
        justify-content: flex-end;
      }

      .dependent-actions button {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }

      .dependent-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 0.5rem;
      }

      .dependent-name {
        font-weight: 700;
        color: #111827;
      }

      .dependent-relationship {
        color: #6b7280;
        font-size: 0.9rem;
      }

      .dependent-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.95rem;
        padding: 0.25rem 0;
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
        padding: 1rem 0;
        color: #666;
      }

      .dependents-empty mat-icon {
        color: #9ca3af;
        display: block;
        margin: 0 auto 0.25rem;
      }

      .section-actions {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 1rem;
      }

      .request-history-table .status-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.85rem;
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

      @media (max-width: 768px) {
        .header-content {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `
  ]
})
export class MyPage {
  private readonly currentUser = inject(CurrentUserService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly changeRequestsService = inject(ChangeRequestsService);
  private readonly employeesService = inject(EmployeesService);
  private readonly dependentsService = inject(DependentsService);
  private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
  private readonly bonusPremiumsService = inject(BonusPremiumsService);
  private readonly dialog = inject(MatDialog);

  readonly premiumDisplayedColumns = [
    'yearMonth',
    'healthEmployee',
    'healthEmployer',
    'careEmployee',
    'careEmployer',
    'pensionEmployee',
    'pensionEmployer',
    'totalEmployee',
    'totalEmployer'
  ];

  readonly bonusDisplayedColumns = [
    'payDate',
    'grossAmount',
    'standardBonusAmount',
    'healthEmployee',
    'healthEmployer',
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

  readonly bonusPremiums$ = combineLatest([this.currentUser.profile$, this.currentOffice.officeId$]).pipe(
    switchMap(([profile, officeId]) => {
      if (!profile?.employeeId || !officeId) {
        return of([] as BonusPremium[]);
      }

      return this.bonusPremiumsService.listByOfficeAndEmployee(officeId, profile.employeeId);
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

      return this.changeRequestsService.listForUser(officeId, profile.id);
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
      width: '600px',
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
      width: '600px',
      data: {
        officeId,
        employeeId: profile.employeeId,
        dependentId
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
    if (request.kind === 'profile') {
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
  protected readonly getEmploymentTypeLabel = getEmploymentTypeLabel;
  protected readonly getInsuranceQualificationKindLabel = getInsuranceQualificationKindLabel;
  protected readonly getInsuranceLossReasonKindLabel = getInsuranceLossReasonKindLabel;
  protected readonly getWorkingStatusLabel = getWorkingStatusLabel;
  protected readonly getPremiumTreatmentLabel = getPremiumTreatmentLabel;
  protected readonly getSexLabel = getSexLabel;
  protected readonly maskMyNumber = maskMyNumber;
  protected readonly calculateAge = calculateAge;
}
