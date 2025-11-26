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
import { map, Observable, of, switchMap } from 'rxjs';
import { MatTableModule } from '@angular/material/table';

import { Dependent, Employee, StandardRewardHistory } from '../../types';
import {
  getDependentRelationshipLabel,
  getInsuranceLossReasonKindLabel,
  getInsuranceQualificationKindLabel,
  getStandardRewardDecisionKindLabel,
  getPremiumTreatmentLabel,
  getWorkingStatusLabel
} from '../../utils/label-utils';
import { DependentsService } from '../../services/dependents.service';
import { CurrentUserService } from '../../services/current-user.service';
import { DependentFormDialogComponent } from './dependent-form-dialog.component';
import { StandardRewardHistoryService } from '../../services/standard-reward-history.service';
import { StandardRewardHistoryFormDialogComponent } from './standard-reward-history-form-dialog.component';

export type DialogFocusSection =
  | 'basic'
  | 'work'
  | 'insurance'
  | 'health-qualification'
  | 'pension-qualification'
  | 'working-status'
  | 'dependents'
  | 'standard-reward-history'
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
    <h1 mat-dialog-title>
      <mat-icon>person</mat-icon>
      従業員詳細
      <span class="subtitle">{{ data.employee.name }}</span>
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
      <div class="form-section" id="work" #sectionBlock>
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
      <div class="form-section" id="insurance" #sectionBlock>
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
      <div class="form-section" id="health-qualification" #sectionBlock>
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
      <div class="form-section" id="pension-qualification" #sectionBlock>
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
      <div class="form-section" id="working-status" #sectionBlock>
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

      <!-- 標準報酬履歴 -->
      <div class="form-section" id="standard-reward-history" #sectionBlock>
        <div class="section-title standard-reward-title">
          <div class="section-title-left">
            <mat-icon>trending_up</mat-icon>
            標準報酬履歴
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
              <table mat-table [dataSource]="histories">
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
          <div class="section-title-left">
            <mat-icon>family_restroom</mat-icon>
            扶養家族
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
                  <button mat-icon-button color="warn" (click)="deleteDependent(dependent)">
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

      <!-- システム情報（フォームに無いが、メタ情報として残す） -->
      <div class="form-section" id="system" #sectionBlock>
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

      .section-nav {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.5rem;
        margin-bottom: 1rem;
        position: sticky;
        top: 0;
        background: #fff;
        padding-bottom: 0.5rem;
        z-index: 1;
      }

      .section-nav button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        text-align: center;
        white-space: nowrap;
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

      .standard-reward-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .standard-reward-title button {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }

      .standard-reward-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
        color: #666;
        padding: 1rem 0;
      }

      .standard-reward-empty mat-icon {
        color: #9ca3af;
      }

      .standard-reward-table table {
        width: 100%;
      }

      .standard-reward-table th,
      .standard-reward-table td {
        padding: 0.75rem;
      }

      .standard-reward-table th {
        font-weight: 600;
        color: #374151;
        border-bottom: 2px solid #e5e7eb;
      }

      .standard-reward-table td {
        border-bottom: 1px solid #e5e7eb;
        color: #111827;
      }

      .standard-reward-note {
        white-space: pre-line;
      }

      .actions-header,
      .actions-cell {
        text-align: right;
      }

      .actions-cell button {
        margin-left: 0.25rem;
      }

      .dependents-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .dependents-title button {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }

      .dependents-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
        color: #666;
        padding: 1rem 0;
      }

      .dependents-empty mat-icon {
        color: #9ca3af;
      }

      .dependents-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 1rem;
      }

      .dependent-card {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 1rem;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }

      .dependent-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .dependent-name {
        font-weight: 700;
        font-size: 1.05rem;
      }

      .dependent-relationship {
        color: #6b7280;
        font-size: 0.9rem;
      }

      .dependent-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
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
    `
  ]
})
export class EmployeeDetailDialogComponent implements AfterViewInit {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dependentsService = inject(DependentsService);
  private readonly standardRewardHistoryService = inject(StandardRewardHistoryService);
  private readonly currentUser = inject(CurrentUserService);

  readonly dependents$!: Observable<Dependent[]>;
  readonly standardRewardHistories$!: Observable<StandardRewardHistory[]>;

  readonly sections: Array<{ id: DialogFocusSection; label: string; icon: string }> = [
    { id: 'basic', label: '基本情報', icon: 'person' },
    { id: 'work', label: '就労条件', icon: 'work' },
    { id: 'insurance', label: '社会保険', icon: 'account_balance' },
    { id: 'health-qualification', label: '健保資格', icon: 'local_hospital' },
    { id: 'pension-qualification', label: '厚年資格', icon: 'account_balance' },
    { id: 'working-status', label: '就業状態', icon: 'event' },
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
      setTimeout(() => this.scrollToSection(this.data.focusSection!), 0);
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
    const margin = 12; // 余白（8〜16px程度）

    const targetTop = target.offsetTop;
    const scrollTop = targetTop - navHeight - margin;

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
        width: '480px',
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
        width: '480px',
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

  deleteDependent(dependent: Dependent): void {
    const confirmed = window.confirm(`${dependent.name} を削除しますか？`);
    if (!confirmed) return;

    this.dependentsService
      .delete(this.data.employee.officeId, this.data.employee.id, dependent.id)
      .then(() => {
        this.snackBar.open('扶養家族を削除しました', undefined, { duration: 2500 });
      })
      .catch(() => {
        this.snackBar.open('削除に失敗しました。時間をおいて再度お試しください。', undefined, {
          duration: 3000
        });
      });
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
