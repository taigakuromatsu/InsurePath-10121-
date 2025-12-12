// src/app/pages/employees/employees.page.ts
import { AsyncPipe, DatePipe, DecimalPipe, NgIf, NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Subject,
  combineLatest,
  map,
  of,
  startWith,
  switchMap,
  tap,
  firstValueFrom
} from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { EmployeesService } from '../../services/employees.service';
import { Employee, PortalStatus } from '../../types';
import { UsersService } from '../../services/users.service';
import { EmployeeFormDialogComponent } from './employee-form-dialog.component';
import {
  DialogFocusSection,
  EmployeeDetailDialogComponent
} from './employee-detail-dialog.component';
import {
  getPortalStatusColor,
  getPortalStatusLabel,
  getWorkingStatusLabel,
  getEmploymentTypeLabel
} from '../../utils/label-utils';
import { DependentsService } from '../../services/dependents.service';
import { CsvExportService } from '../../utils/csv-export.service';
import {
  EmployeeImportDialogComponent,
  ImportResult
} from './employee-import-dialog.component';
import { HelpDialogComponent, HelpDialogData } from '../../components/help-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../components/confirm-dialog.component';
import {
  InviteEmployeeDialogComponent,
  InviteEmployeeDialogData,
  InviteEmployeeDialogResult
} from './invite-employee-dialog.component';

interface EmployeeWithUpdatedBy extends Employee {
  updatedByDisplayName: string | null;
}

@Component({
  selector: 'ip-employees-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    AsyncPipe,
    NgIf,
    NgClass,
    DecimalPipe,
    DatePipe,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div class="flex-row align-center gap-2">
          <h1 class="m-0">従業員台帳</h1>
              <button
                mat-icon-button
                class="help-button"
                (click)="openHelp()"
                aria-label="従業員管理のヘルプを表示"
              >
                <mat-icon>help_outline</mat-icon>
              </button>
        </div>
        <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">
          現在の事業所に紐づく従業員を登録・更新できます。
        </p>
      </header>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center mb-4 flex-wrap gap-2">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">list</mat-icon> 従業員一覧
            </h2>
            <p class="mat-body-2" style="color: #666">登録されている従業員の一覧を表示します。</p>
          </div>
          <div class="header-actions flex-row gap-2 flex-wrap">
            <button
              mat-stroked-button
              color="primary"
              (click)="downloadCsvTemplate()"
              *ngIf="canExport$ | async"
            >
              <mat-icon>description</mat-icon>
              CSVテンプレート
            </button>
            <button
              mat-stroked-button
              color="primary"
              (click)="openImportDialog()"
              [disabled]="!(officeId$ | async)"
              *ngIf="canExport$ | async"
            >
              <mat-icon>upload</mat-icon>
              CSVインポート
            </button>
            <button
              mat-stroked-button
              color="primary"
              (click)="exportToCsv()"
              [disabled]="!(employees$ | async)?.length"
              *ngIf="canExport$ | async"
            >
              <mat-icon>download</mat-icon>
              CSVエクスポート
            </button>
            <button
              mat-flat-button
              color="primary"
              (click)="openDialog()"
              [disabled]="!(officeId$ | async)"
            >
              <mat-icon>person_add</mat-icon>
              従業員を追加
            </button>
          </div>
        </div>

        <ng-container *ngIf="officeId$ | async as officeId; else emptyOffice">
          <div class="table-container">
          <table
            mat-table
            [dataSource]="(employeesWithUpdatedBy$ | async) || []"
              class="admin-table"
          >
            <!-- 1. 従業員情報 -->
            <ng-container matColumnDef="employeeInfo">
              <th mat-header-cell *matHeaderCellDef class="col-employee">従業員情報</th>
              <td mat-cell *matCellDef="let row" class="col-employee cell-padding">
                <div class="info-cell">
                  <div class="name-row">
                    <span class="employee-name">{{ row.name }}</span>
                  </div>
                  <div class="meta-row">
                    <mat-icon class="tiny-icon">business</mat-icon>
                    <span class="department-text">{{ row.department || '(所属なし)' }}</span>
                  </div>
                  <div class="meta-row" *ngIf="row.address">
                    <mat-icon class="tiny-icon">place</mat-icon>
                    <span class="address-text" [title]="row.address">{{ row.address }}</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- 2. 労働条件 -->
            <ng-container matColumnDef="workingConditions">
              <th mat-header-cell *matHeaderCellDef class="col-work">労働条件</th>
              <td mat-cell *matCellDef="let row" class="col-work cell-padding">
                <div class="info-cell">
                  <div class="status-row mb-1">
                    <span class="status-text">{{ getWorkingStatusLabel(row.workingStatus) }}</span>
                    <span class="mini-badge student ml-2" *ngIf="row.isStudent">学生</span>
                  </div>
                  <div class="work-metrics">
                    <span class="metric-item">週 {{ row.weeklyWorkingHours ?? '-' }} 時間</span>
                    <span class="separator">/</span>
                    <span class="metric-item">週 {{ row.weeklyWorkingDays ?? '-' }} 日</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- 3. 標準報酬・等級 -->
            <ng-container matColumnDef="insuranceRewards">
              <th mat-header-cell *matHeaderCellDef class="col-rewards">標準報酬・等級</th>
              <td mat-cell *matCellDef="let row" class="col-rewards cell-padding">
                <div class="reward-grid">
                  <!-- 報酬月額 -->
                  <div class="reward-item wage-item">
                    <span class="reward-label">報酬月額</span>
                    <span class="reward-value">{{ (row.payrollSettings?.insurableMonthlyWage ?? row.monthlyWage) | number }}</span>
                  </div>
                  
                  <!-- 健保 -->
                  <div class="reward-item">
                    <span class="reward-label">健保</span>
                    <div class="reward-detail">
                      <span class="grade-badge health" *ngIf="row.healthGrade">{{ row.healthGrade }}等級</span>
                      <span class="monthly-val" *ngIf="row.healthStandardMonthly">{{ row.healthStandardMonthly | number }}</span>
                      <span class="text-secondary" *ngIf="!row.healthGrade && !row.healthStandardMonthly">-</span>
                    </div>
                  </div>

                  <!-- 厚年 -->
                  <div class="reward-item">
                    <span class="reward-label">厚年</span>
                    <div class="reward-detail">
                      <span class="grade-badge pension" *ngIf="row.pensionGrade">{{ row.pensionGrade }}等級</span>
                      <span class="monthly-val" *ngIf="row.pensionStandardMonthly">{{ row.pensionStandardMonthly | number }}</span>
                      <span class="text-secondary" *ngIf="!row.pensionGrade && !row.pensionStandardMonthly">-</span>
                    </div>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- 4. ステータス（社保・扶養・ポータル） -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef class="col-status">ステータス</th>
              <td mat-cell *matCellDef="let row" class="col-status cell-padding">
                <div class="status-cell gap-2">
                  <div class="flex-row align-center gap-2">
                    <span class="label-fixed">社保</span>
                    <span class="status-badge" [class.insured]="row.isInsured" [class.not-insured]="!row.isInsured">
                      {{ row.isInsured ? '加入' : '対象外' }}
                    </span>
                  </div>

                  <div class="flex-row align-center gap-2">
                    <span class="label-fixed">扶養</span>
                <button
                  mat-stroked-button
                      class="dependents-button small-btn"
                      [class.has-dependents]="((getDependentsCount(row) | async) ?? 0) > 0"
                  type="button"
                  (click)="openDetailWithFocus(row, 'dependents')"
                >
                      <mat-icon class="tiny-icon">group</mat-icon>
                      <span class="dependents-count">{{ (getDependentsCount(row) | async) ?? 0 }}人</span>
                </button>
                  </div>

                  <div class="flex-row align-center gap-2">
                    <span class="label-fixed">ポータル</span>
                    <span class="portal-badge" [ngClass]="getPortalStatus(row)">
                      {{ getPortalStatusLabel(getPortalStatus(row)) }}
                </span>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- 5. 管理情報 (New) -->
            <ng-container matColumnDef="managementInfo">
              <th mat-header-cell *matHeaderCellDef class="col-management">管理情報</th>
              <td mat-cell *matCellDef="let row" class="col-management cell-padding">
                <div class="info-cell">
                  <div class="meta-row mb-1">
                    <span class="label-mini">入社</span>
                    <span class="value-text">{{ row.hireDate | date: 'yyyy/MM/dd' }}</span>
                  </div>
                  <div class="meta-row mb-1">
                    <span class="label-mini">形態</span>
                    <span class="value-text">{{ getEmploymentTypeLabel(row.employmentType) }}</span>
                  </div>
                  <div class="meta-row" *ngIf="row.employeeCodeInOffice">
                    <span class="label-mini">社員番号</span>
                    <span class="value-text font-mono">{{ row.employeeCodeInOffice }}</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- 6. 操作・更新 -->
            <ng-container matColumnDef="metaActions">
              <th mat-header-cell *matHeaderCellDef class="col-actions">操作</th>
              <td mat-cell *matCellDef="let row" class="col-actions cell-padding">
                <div class="action-cell">
                  <div class="action-buttons flex-row gap-1 justify-end">
                <button
                      mat-icon-button
                      [color]="getPortalStatus(row) === 'invited' ? 'accent' : 'primary'"
                      class="action-btn"
                  (click)="openInviteDialog(row)"
                  [disabled]="isInviteDisabled(getPortalStatus(row)) || !(officeId$ | async)"
                      [matTooltip]="getInviteButtonLabel(getPortalStatus(row))"
                >
                  <mat-icon fontIcon="mail"></mat-icon>
                </button>
                <button
                  mat-icon-button
                      class="action-btn"
                  (click)="openDetail(row)"
                      matTooltip="詳細"
                >
                  <mat-icon>visibility</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="primary"
                      class="action-btn"
                  (click)="openDialog(row)"
                      matTooltip="編集"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                      class="action-btn"
                  (click)="confirmDeleteEmployee(row)"
                      matTooltip="削除"
                >
                  <mat-icon>delete</mat-icon>
                </button>
                  </div>
                  <div class="update-info">
                    <span class="update-date">{{ row.updatedAt ? (row.updatedAt | date: 'yyyy/MM/dd') : '-' }}</span>
                    <span class="update-user" *ngIf="row.updatedByDisplayName">by {{ row.updatedByDisplayName }}</span>
                  </div>
                </div>
              </td>
            </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns" class="hover-row"></tr>
          </table>
          <div class="empty-state" *ngIf="(employeesWithUpdatedBy$ | async)?.length === 0">
            <mat-icon>people_outline</mat-icon>
            <p>従業員が登録されていません</p>
            <button mat-stroked-button color="primary" (click)="openDialog()" [disabled]="!(officeId$ | async)">
              <mat-icon>person_add</mat-icon>
              最初の従業員を追加
            </button>
          </div>
          </div>
        </ng-container>

        <ng-template #emptyOffice>
          <div class="empty-office-state">
            <mat-icon>business</mat-icon>
            <h3>事業所が未設定です</h3>
            <p>まずは所属事業所を設定してください。</p>
          </div>
        </ng-template>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 100%;
        margin: 0 auto;
        padding: 24px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .page-header {
        margin-bottom: 8px;
      }

      .content-card {
        padding: 24px;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
      }

      /* ユーティリティ */
      .m-0 { margin: 0; }
      .mb-0 { margin-bottom: 0; }
      .mb-2 { margin-bottom: 8px; }
      .mb-3 { margin-bottom: 16px; }
      .mb-4 { margin-bottom: 24px; }
      .gap-1 { gap: 4px; }
      .gap-2 { gap: 8px; }
      .gap-3 { gap: 16px; }
      .flex-row { display: flex; flex-direction: row; }
      .align-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .justify-center { justify-content: center; }
      .items-end { align-items: flex-end; }
      .flex-col { display: flex; flex-direction: column; }
      .flex-wrap { flex-wrap: wrap; }
      .font-bold { font-weight: 700; }
      .font-medium { font-weight: 500; }
      .font-normal { font-weight: 400; }
      .text-secondary { color: #666; }
      .text-small { font-size: 0.8125rem; }
      .text-xs { font-size: 0.75rem; }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* テーブル全体 */
      .table-container {
        position: relative;
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        background: #fff;
      }

      .admin-table {
        width: 100%;
        /* min-width: 1400px;  削除: カラム統合によりスクロール不要を目指す */
        border-collapse: collapse;
      }

      /* カラム幅設定 */
      .col-employee { width: 20%; min-width: 180px; }
      .col-work { width: 14%; min-width: 140px; }
      .col-rewards { width: 22%; min-width: 220px; }
      .col-status { width: 20%; min-width: 200px; }
      .col-management { width: 14%; min-width: 140px; }
      .col-actions { width: 10%; min-width: 100px; text-align: right; }

      .cell-padding {
        padding: 12px 16px !important;
        vertical-align: top;
      }

      .info-cell, .status-cell, .action-cell {
        display: flex;
        flex-direction: column;
      }

      /* 従業員情報列 */
      .name-row { margin-bottom: 4px; }
      .employee-name { font-weight: 700; font-size: 1rem; color: #333; }

      .meta-row {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #666;
        font-size: 0.85rem;
        line-height: 1.4;
      }
      .tiny-icon { font-size: 16px; width: 16px; height: 16px; color: #999; }
      .address-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      /* 労働条件列 */
      .status-row { display: flex; align-items: center; }
      .ml-2 { margin-left: 8px; }
      
      .work-metrics {
        font-size: 0.9rem;
        color: #444;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .separator { color: #ccc; }

      /* 標準報酬・等級列 */
      .reward-grid {
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: #f8fafc;
        padding: 8px;
        border-radius: 6px;
      }
      
      .reward-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.85rem;
      }

      .wage-item {
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 4px;
        margin-bottom: 4px;
      }
      
      .reward-label { color: #64748b; font-size: 0.8rem; }
      .reward-value { font-weight: 600; font-size: 0.95rem; }

      .reward-detail {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .grade-badge {
        font-size: 0.7rem;
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 500;
      }
      .grade-badge.health { background: #e3f2fd; color: #0d47a1; }
      .grade-badge.pension { background: #e8f5e9; color: #1b5e20; }

      .monthly-val { font-weight: 500; }

      /* ステータス列 */
      .gap-2 { gap: 8px; }
      .label-fixed {
        width: 60px; /* ラベル幅を広げて改行を防ぐ */
        font-size: 0.75rem;
        color: #888;
        text-align: right;
        flex-shrink: 0;
        white-space: nowrap;
      }
      
      .small-btn {
        height: 28px;
        line-height: 28px;
        padding: 0 10px;
        font-size: 0.85rem;
      }

      /* 操作・更新列 */
      .justify-end { justify-content: flex-end; }
      .update-info {
        margin-top: 8px;
        text-align: right;
        font-size: 0.75rem;
        color: #888;
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }

      /* バッジ・ステータス共通 */
      .status-badge, .portal-badge {
        font-size: 0.7rem;
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 500;
        white-space: nowrap;
        line-height: 1.2;
      }

      /* 社保バッジ色 */
      .status-badge.insured { background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; }
      .status-badge.not-insured { background: #ffebee; color: #c62828; border: 1px solid #ffcdd2; }

      /* ポータルバッジ色 */
      .portal-badge.not_invited { background: #f5f5f5; color: #757575; border: 1px solid #e0e0e0; }
      .portal-badge.invited { background: #fff3e0; color: #ef6c00; border: 1px solid #ffe0b2; }
      .portal-badge.linked { background: #e3f2fd; color: #1976d2; border: 1px solid #bbdefb; }
      .portal-badge.disabled { background: #eceff1; color: #546e7a; border: 1px solid #cfd8dc; }

      /* 扶養ボタン色 */
      .dependents-button.has-dependents {
        border-color: #bbdefb;
        background-color: #e3f2fd;
        color: #1976d2;
      }
      
      .mb-1 { margin-bottom: 4px; }
      
      .meta-row {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #666;
        font-size: 0.85rem;
        line-height: 1.4;
      }
      .label-mini {
        font-size: 0.7rem;
        color: #888;
        width: auto;
        min-width: 28px;
        margin-right: 4px;
        flex-shrink: 0;
      }
      .value-text {
        font-size: 0.85rem;
        color: #333;
      }
      .font-mono { font-family: monospace; }

      .hover-row:hover {
        background-color: #fcfcfc;
        }

      /* 古いスタイルの一部削除・調整 */
      .col-name, .basic-col, .group-end { border: none; }
    `
  ]
})
export class EmployeesPage {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly employeesService = inject(EmployeesService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly dependentsService = inject(DependentsService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly csvExportService = inject(CsvExportService);
  private readonly usersService = inject(UsersService);
  protected readonly getWorkingStatusLabel = getWorkingStatusLabel;
  protected readonly getPortalStatusLabel = getPortalStatusLabel;
  protected readonly getPortalStatusColor = getPortalStatusColor;
  protected readonly getEmploymentTypeLabel = getEmploymentTypeLabel;

  private readonly dependentsCountMap = new Map<
    string,
    ReturnType<typeof this.createDependentsCountStream>
  >();

  readonly displayedColumns = [
    'employeeInfo',
    'workingConditions',
    'insuranceRewards',
    'status',
    'managementInfo',
    'metaActions'
  ];

  // CurrentOfficeService からそのまま officeId$ を公開
  readonly officeId$ = this.currentOffice.officeId$;

  readonly canExport$ = this.currentUser.profile$.pipe(
    map((profile) => profile?.role === 'admin' || profile?.role === 'hr')
  );

  // 保存・削除後に一覧を取り直すためのトリガー
  private readonly reload$ = new Subject<void>();

  // officeId$ と reload$ を組み合わせて、初回＆更新のたびに list() を実行
  readonly employees$ = combineLatest([
    this.officeId$,
    this.reload$.pipe(startWith<void>(undefined))
  ]).pipe(
    tap(([officeId]) => console.log('[EmployeesPage] officeId$', officeId)),
    switchMap(([officeId]) => {
      if (!officeId) {
        return of([] as Employee[]);
      }
      return this.employeesService.list(officeId);
    })
  );

  readonly employeesWithUpdatedBy$ = combineLatest([
    this.employees$,
    this.currentUser.profile$
  ]).pipe(
    switchMap(([employees, profile]) => {
      // hr は /users を読めないので displayName 付与をスキップ（admin のみ取得）
      if (!profile || profile.role !== 'admin') {
        return of(
          employees.map((employee) => ({
            ...employee,
            updatedByDisplayName: null
          })) as EmployeeWithUpdatedBy[]
        );
      }

      const userIds = employees
        .map((emp) => emp.updatedByUserId)
        .filter((id): id is string => Boolean(id));

      if (userIds.length === 0) {
        return of(
          employees.map((employee) => ({
            ...employee,
            updatedByDisplayName: null
          })) as EmployeeWithUpdatedBy[]
        );
      }

      return this.usersService.getUserDisplayNames(userIds).pipe(
        map((nameMap) =>
          employees.map((employee) => ({
            ...employee,
            updatedByDisplayName: employee.updatedByUserId
              ? nameMap.get(employee.updatedByUserId) ?? null
              : null
          })) as EmployeeWithUpdatedBy[]
        )
      );
      })
    );

  openHelp(): void {
    this.dialog.open(HelpDialogComponent, {
      width: '720px',
      data: {
        topicIds: ['standardMonthlyReward', 'shortTimeWorker'],
        title: '従業員管理に関するヘルプ'
      } satisfies HelpDialogData
    });
  }

  // 🔍 詳細ダイアログを開く
  openDetail(employee: Employee): void {
    this.dialog.open(EmployeeDetailDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      data: { employee }
    });
  }

  openDetailWithFocus(employee: Employee, focusSection: DialogFocusSection): void {
    this.dialog.open(EmployeeDetailDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      data: { employee, focusSection }
    });
  }

  private createDependentsCountStream(employee: Employee) {
    return this.dependentsService
      .list(employee.officeId, employee.id)
      .pipe(map((dependents) => dependents.length));
  }

  async openImportDialog(): Promise<void> {
    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) {
      return;
    }

    const dialogRef = this.dialog.open(EmployeeImportDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      data: { officeId }
    });

    dialogRef.afterClosed().subscribe((result?: ImportResult) => {
      if (!result) {
        return;
      }

      this.snackBar.open(
        `インポート完了: 成功 ${result.successCount} 件 / エラー ${result.errorCount} 件`,
        '閉じる',
        { duration: 4000 }
      );

      if (result.successCount > 0) {
        this.reload$.next();
      }
    });
  }

  async exportToCsv(): Promise<void> {
    const employees = await firstValueFrom(this.employees$);
    if (!employees || employees.length === 0) {
      this.snackBar.open('エクスポートするデータがありません', '閉じる', { duration: 3000 });
      return;
    }

    this.csvExportService.exportEmployees(employees);
    this.snackBar.open('CSVエクスポートが完了しました', '閉じる', { duration: 3000 });
  }

  downloadCsvTemplate(): void {
    this.csvExportService.exportEmployeesTemplate();
    this.snackBar.open('CSVテンプレートをダウンロードしました', '閉じる', {
      duration: 3000
    });
  }

  getPortalStatus(employee: Employee): PortalStatus {
    return employee.portal?.status ?? 'not_invited';
  }

  getInviteButtonLabel(status: PortalStatus): string {
    switch (status) {
      case 'invited':
        return '再招待';
      case 'linked':
        return '連携済み';
      case 'disabled':
        return '停止中';
      default:
        return '招待';
    }
  }

  isInviteDisabled(status: PortalStatus): boolean {
    return status === 'disabled' || status === 'linked';
  }

  getDependentsCount(employee: Employee) {
    const cached = this.dependentsCountMap.get(employee.id);
    if (cached) {
      return cached;
    }

    const stream = this.createDependentsCountStream(employee);
    this.dependentsCountMap.set(employee.id, stream);
    return stream;
  }

  async openInviteDialog(employee: Employee): Promise<void> {
    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) {
      return;
    }

    const dialogRef = this.dialog.open<
      InviteEmployeeDialogComponent,
      InviteEmployeeDialogData,
      InviteEmployeeDialogResult
    >(InviteEmployeeDialogComponent, {
      width: '560px',
      data: { employee, officeId }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result?.invited) {
        return;
      }
      this.snackBar.open('招待URLを生成しました', '閉じる', { duration: 3000 });
      this.reload$.next();
    });
  }

  // 編集ダイアログを開いて保存後に reload$.next() で一覧を再取得
  async openDialog(employee?: Employee): Promise<void> {
    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) {
      return;
    }

    const dialogRef = this.dialog.open(EmployeeFormDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      data: { employee, officeId }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result?.saved) {
        return;
      }

      // 一覧再読み込み
      this.reload$.next();

      if (result.mode === 'created' && result.employeeId) {
        const snackRef = this.snackBar.open(
          '従業員を作成しました。続けて扶養家族を登録しますか？',
          '登録する',
          { duration: 8000 }
        );

        snackRef.onAction().subscribe(async () => {
          const officeId = await firstValueFrom(this.officeId$);
          if (!officeId) {
            return;
          }

          const employee = await firstValueFrom(
            this.employeesService.get(officeId, result.employeeId)
          );
          if (employee) {
            this.openDetailWithFocus(employee, 'dependents');
          }
        });
      } else {
        this.snackBar.open('従業員情報を保存しました', '閉じる', {
          duration: 3000
        });
      }
    });
  }

  // 削除確認ダイアログを表示してから削除
  async confirmDeleteEmployee(employee: Employee): Promise<void> {
    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        width: '400px',
        data: {
          title: '従業員を削除しますか？',
          message: `従業員「${employee.name}」を削除します。よろしいですか？`,
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
    await this.delete(employee);
  }

  // 削除後も reload$.next() で一覧を再取得
  private async delete(employee: Employee): Promise<void> {
    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) {
      return;
    }
    try {
      await this.employeesService.delete(officeId, employee.id);
      this.snackBar.open('従業員を削除しました', '閉じる', { duration: 3000 });
      // 一覧再読み込み
      this.reload$.next();
    } catch (error) {
      console.error(error);
      this.snackBar.open('従業員の削除に失敗しました', '閉じる', {
        duration: 4000
      });
    }
  }
}

