import { NgFor, NgIf } from '@angular/common';
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
import { MatTabsModule } from '@angular/material/tabs';

import { Employee, Sex } from '../../types';
import {
  getInsuranceLossReasonKindLabel,
  getInsuranceQualificationKindLabel,
  getBankAccountTypeLabel,
  getPayrollPayTypeLabel,
  getPayrollPayCycleLabel,
  getWorkingStatusLabel,
  getExemptionKindLabel
} from '../../utils/label-utils';
import { CurrentUserService } from '../../services/current-user.service';
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
    NgFor,
    NgIf,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MatSnackBarModule,
    DecimalPipe // ★ 追加済み
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">person</mat-icon>
      <span>従業員詳細</span>
      <span *ngIf="data.employee.name" class="employee-name">
        （{{ data.employee.name }}）
      </span>
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

        <div class="label">社員番号</div>
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

      <!-- 社会保険関連 -->
      <div class="form-section" id="insurance" #sectionBlock>
        <h2 class="mat-h3 section-title">
          <mat-icon>account_balance</mat-icon>
        社会保険関連
        </h2>
      <div class="grid">
        <!-- 社会保険対象（独立した行） -->
        <div class="label full-row">社会保険対象</div>
        <div class="value full-row">
          {{ data.employee.isInsured ? '加入' : '対象外' }}
        </div>

        <!-- 給与情報（標準報酬決定用） -->
        <ng-container *ngIf="data.employee.payrollSettings as payroll; else noPayroll">
          <div class="label">支給形態</div>
          <div class="value">{{ getPayrollPayTypeLabel(payroll.payType) }}</div>

          <div class="label">支給サイクル</div>
          <div class="value">{{ getPayrollPayCycleLabel(payroll.payCycle) }}</div>

          <div class="label">報酬月額</div>
          <div class="value">
            {{ payroll.insurableMonthlyWage != null ? (payroll.insurableMonthlyWage | number) + ' 円' : '-' }}
          </div>
        </ng-container>
        <ng-template #noPayroll>
          <div class="label">給与情報</div>
          <div class="value">未登録</div>
        </ng-template>

        <!-- 標準報酬・等級 -->
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

        <!-- その他の社会保険情報 -->
        <div class="label">被保険者記号</div>
        <div class="value">{{ data.employee.healthInsuredSymbol || '-' }}</div>

        <div class="label">被保険者番号</div>
        <div class="value">{{ data.employee.healthInsuredNumber || '-' }}</div>

        <div class="label">厚生年金番号</div>
        <div class="value">{{ data.employee.pensionNumber || '-' }}</div>

        <!-- 補足メモ（給与情報） -->
        <ng-container *ngIf="data.employee.payrollSettings as payroll">
          <div class="label full-row">補足メモ（給与情報）</div>
          <div class="value full-row">{{ payroll.note || '-' }}</div>
        </ng-container>
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

        <!-- 免除月（産休/育休） -->
        <ng-container *ngIf="data.employee.premiumExemptionMonths && data.employee.premiumExemptionMonths.length > 0">
          <div class="label full-row">産前産後・育児休業の免除月（月次保険料用）</div>
          <div class="value full-row">
            <div class="exemption-months-list">
              <div *ngFor="let exemption of data.employee.premiumExemptionMonths" class="exemption-month-item">
                <span class="exemption-kind">{{ getExemptionKindLabel(exemption.kind) }}</span>
                <span class="exemption-yearmonth">{{ exemption.yearMonth }}</span>
              </div>
            </div>
          </div>
        </ng-container>
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
      .history-section-title {
        margin-top: 24px;
        margin-bottom: 12px;
        font-size: 1rem;
        font-weight: 500;
        color: #666;
      }
      .history-section-title:first-child {
        margin-top: 0;
      }
      .history-section-title {
        margin-top: 24px;
        margin-bottom: 12px;
        font-size: 1rem;
        font-weight: 500;
        color: #666;
      }
      .history-section-title:first-child {
        margin-top: 0;
      }
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

      .dialog-title .employee-name {
        color: rgba(0, 0, 0, 0.6);
        font-weight: normal;
        font-size: 0.9em;
      }

      .content {
        display: flex;
        flex-direction: column;
        gap: 0;
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
        padding: 20px 0;
        border-bottom: 1px solid #e0e0e0;
      }

      .form-section:last-child {
        border-bottom: none;
      }

      .form-section:first-child {
        padding-top: 0;
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

      .section-title-with-action {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }

      .section-title-with-action .section-title {
        border-bottom: none;
        padding-bottom: 0;
        flex: 1;
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

      .exemption-months-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .exemption-month-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        background-color: #f8f9fa;
        border-radius: 4px;
        border: 1px solid #e0e0e0;
      }

      .exemption-kind {
        font-weight: 500;
        color: #1976d2;
      }

      .exemption-yearmonth {
        color: #666;
        font-size: 0.9rem;
      }
    `
  ]
})
export class EmployeeDetailDialogComponent implements AfterViewInit {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly currentUser = inject(CurrentUserService);
  private readonly currentOffice = inject(CurrentOfficeService);


  readonly sections: Array<{ id: DialogFocusSection; label: string; icon: string }> = [
    { id: 'basic', label: '基本情報', icon: 'person' },
    { id: 'work', label: '就労条件', icon: 'work' },
    { id: 'insurance', label: '社会保険', icon: 'account_balance' },
    { id: 'bankAccount', label: '口座情報', icon: 'account_balance_wallet' },
    { id: 'health-qualification', label: '健保資格', icon: 'local_hospital' },
    { id: 'pension-qualification', label: '厚年資格', icon: 'account_balance' },
    { id: 'working-status', label: '就業状態', icon: 'event' },
    { id: 'system', label: 'システム', icon: 'info' }
  ];

  activeSection: DialogFocusSection = 'basic';

  @ViewChild('contentRef') private readonly contentRef?: ElementRef<HTMLDivElement>;
  @ViewChildren('sectionBlock') private readonly sectionBlocks?: QueryList<
    ElementRef<HTMLElement>
  >;

  constructor(@Inject(MAT_DIALOG_DATA) public data: EmployeeDetailDialogData) {}

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
  protected readonly getBankAccountTypeLabel = getBankAccountTypeLabel;
  protected readonly getPayrollPayTypeLabel = getPayrollPayTypeLabel;
  protected readonly getPayrollPayCycleLabel = getPayrollPayCycleLabel;
  protected readonly getExemptionKindLabel = getExemptionKindLabel;

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

}
