import { Component, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DecimalPipe } from '@angular/common'; // ★ number パイプ用

import { Employee } from '../../types';
import {
  getInsuranceLossReasonKindLabel,
  getInsuranceQualificationKindLabel,
  getPremiumTreatmentLabel,
  getWorkingStatusLabel
} from '../../utils/label-utils';

export interface EmployeeDetailDialogData {
  employee: Employee;
}

@Component({
  selector: 'ip-employee-detail-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    DecimalPipe // ★ 追加済み
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon>person</mat-icon>
      従業員詳細
      <span class="subtitle">{{ data.employee.name }}</span>
    </h1>

    <div mat-dialog-content class="content">
      <!-- 基本情報 -->
      <div class="form-section">
        <h2 class="section-title">
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

        <div class="label">雇用形態</div>
        <div class="value">{{ data.employee.employmentType }}</div>

        <div class="label">住所</div>
        <div class="value">{{ data.employee.address || '-' }}</div>

        <div class="label">電話番号</div>
        <div class="value">{{ data.employee.phone || '-' }}</div>

        <div class="label">連絡先メール</div>
        <div class="value">{{ data.employee.contactEmail || '-' }}</div>
      </div>
      </div>

      <!-- 就労条件 -->
      <div class="form-section">
        <h2 class="section-title">
          <mat-icon>work</mat-icon>
          就労条件
        </h2>
      <div class="grid">
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
      <div class="form-section">
        <h2 class="section-title">
          <mat-icon>account_balance</mat-icon>
          社会保険情報
        </h2>
      <div class="grid">
        <!-- ★ フォームと同じ「標準報酬月額」に統一 -->
        <div class="label">標準報酬月額</div>
        <div class="value">{{ data.employee.monthlyWage | number }}</div>

        <!-- ★ フォームのラベル「社会保険対象」に合わせる -->
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

        <!-- ★ healthStandardMonthly はフォームに無いので削除 -->

        <div class="label">厚生年金 等級</div>
        <div class="value">{{ data.employee.pensionGrade ?? '-' }}</div>

        <!-- ★ pensionStandardMonthly もフォームに無いので削除 -->
      </div>
      </div>

      <!-- 資格情報（健康保険） -->
      <div class="form-section">
        <h2 class="section-title">
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
      <div class="form-section">
        <h2 class="section-title">
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
      <div class="form-section">
        <h2 class="section-title">
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

      <!-- システム情報（フォームに無いが、メタ情報として残す） -->
      <div class="form-section">
        <h2 class="section-title">
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
      <button mat-button mat-dialog-close>
        <mat-icon>close</mat-icon>
        閉じる
      </button>
    </div>
  `,
  styles: [
    `
      h1[mat-dialog-title] {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid #e0e0e0;
      }

      h1[mat-dialog-title] mat-icon {
        color: #667eea;
      }

      .subtitle {
        margin-left: auto;
        font-size: 0.9rem;
        color: #666;
        font-weight: 400;
      }

      .content {
        display: flex;
        flex-direction: column;
        gap: 0;
        max-height: 70vh;
        overflow-y: auto;
        padding: 1.5rem;
      }

      .form-section {
        margin-bottom: 2rem;
      }

      .form-section:last-child {
        margin-bottom: 0;
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0 0 1rem 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: #333;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #e0e0e0;
      }

      .section-title mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #667eea;
      }

      .grid {
        display: grid;
        grid-template-columns: 160px 1fr;
        row-gap: 0.75rem;
        column-gap: 1rem;
        font-size: 0.95rem;
        padding: 0.5rem 0;
      }

      .label {
        color: #666;
        font-weight: 500;
        justify-self: flex-start;
      }

      .value {
        color: #333;
        word-break: break-word;
        font-weight: 400;
      }

      .dialog-actions {
        padding: 1rem 1.5rem;
        border-top: 1px solid #e0e0e0;
        background: #fafafa;
      }

      .dialog-actions button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      button[mat-button] {
        transition: all 0.2s ease;
      }

      button[mat-button]:hover {
        background: rgba(0, 0, 0, 0.04);
      }
    `
  ]
})
export class EmployeeDetailDialogComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<EmployeeDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EmployeeDetailDialogData
  ) {}

  protected readonly getInsuranceQualificationKindLabel =
    getInsuranceQualificationKindLabel;
  protected readonly getInsuranceLossReasonKindLabel =
    getInsuranceLossReasonKindLabel;
  protected readonly getWorkingStatusLabel = getWorkingStatusLabel;
  protected readonly getPremiumTreatmentLabel = getPremiumTreatmentLabel;
}
