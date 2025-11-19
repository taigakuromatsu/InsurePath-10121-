// src/app/pages/employees/employee-detail-dialog.component.ts
import { Component, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DecimalPipe } from '@angular/common'; // ★ 追加

import { Employee } from '../../types';

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
    DecimalPipe // ★ 追加
  ],
  template: `
    <h1 mat-dialog-title>
      従業員詳細
      <span class="subtitle">{{ data.employee.name }}</span>
    </h1>

    <div mat-dialog-content class="content">
      <!-- 基本情報 -->
      <h2 class="section-title">
        <mat-icon aria-hidden="true" class="icon">person</mat-icon>
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

      <!-- 就労条件 -->
      <h2 class="section-title">
        <mat-icon aria-hidden="true" class="icon">work_history</mat-icon>
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

      <!-- 社会保険情報 -->
      <h2 class="section-title">
        <mat-icon aria-hidden="true" class="icon">health_and_safety</mat-icon>
        社会保険情報
      </h2>
      <div class="grid">
        <div class="label">標準報酬月額（給与）</div>
        <div class="value">{{ data.employee.monthlyWage | number }}</div>

        <div class="label">社会保険</div>
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

        <div class="label">健康保険 標準報酬</div>
        <div class="value">
          {{ data.employee.healthStandardMonthly ?? '-' }}
        </div>

        <div class="label">厚生年金 等級</div>
        <div class="value">{{ data.employee.pensionGrade ?? '-' }}</div>

        <div class="label">厚生年金 標準報酬</div>
        <div class="value">
          {{ data.employee.pensionStandardMonthly ?? '-' }}
        </div>
      </div>

      <!-- システム情報 -->
      <h2 class="section-title">
        <mat-icon aria-hidden="true" class="icon">info</mat-icon>
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

    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>
        閉じる
      </button>
    </div>
  `,
  styles: [
    `
      .subtitle {
        margin-left: 8px;
        font-size: 0.9rem;
        color: #666;
        font-weight: 400;
      }

      .content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-height: 70vh;
        overflow: auto;
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 8px 0 4px;
        font-size: 0.95rem;
        font-weight: 600;
        color: #444;
      }

      .icon {
        font-size: 18px;
      }

      .grid {
        display: grid;
        grid-template-columns: 140px 1fr;
        row-gap: 4px;
        column-gap: 8px;
        font-size: 0.9rem;
      }

      .label {
        color: #666;
        justify-self: flex-start;
      }

      .value {
        color: #222;
        word-break: break-all;
      }
    `
  ]
})
export class EmployeeDetailDialogComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<EmployeeDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EmployeeDetailDialogData
  ) {}
}
