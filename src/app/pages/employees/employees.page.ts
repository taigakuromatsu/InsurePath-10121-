// src/app/pages/employees/employees.page.ts
import { AsyncPipe, DatePipe, DecimalPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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
import { Employee } from '../../types';
import { UsersService } from '../../services/users.service';
import { EmployeeFormDialogComponent } from './employee-form-dialog.component';
import {
  DialogFocusSection,
  EmployeeDetailDialogComponent
} from './employee-detail-dialog.component';
import { getWorkingStatusLabel } from '../../utils/label-utils';
import { DependentsService } from '../../services/dependents.service';
import { CsvExportService } from '../../utils/csv-export.service';
import {
  EmployeeImportDialogComponent,
  ImportResult
} from './employee-import-dialog.component';
import { HelpDialogComponent, HelpDialogData } from '../../components/help-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../components/confirm-dialog.component';

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
    DecimalPipe,
    DatePipe
  ],
  template: `
    <section class="page employees">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>people</mat-icon>
          </div>
          <div class="header-text">
            <h1>
              従業員台帳
              <button
                mat-icon-button
                class="help-button"
                (click)="openHelp()"
                aria-label="従業員管理のヘルプを表示"
              >
                <mat-icon>help_outline</mat-icon>
              </button>
            </h1>
            <p>現在の事業所に紐づく従業員を登録・更新できます。</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="page-header">
          <div class="page-title-section">
            <h2>
              <mat-icon>list</mat-icon>
              従業員一覧
            </h2>
            <p>登録されている従業員の一覧を表示します。</p>
          </div>
          <div class="header-actions">
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
              mat-raised-button
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
            class="employee-table"
          >
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>氏名</th>
              <td mat-cell *matCellDef="let row">{{ row.name }}</td>
            </ng-container>

            <ng-container matColumnDef="department">
              <th mat-header-cell *matHeaderCellDef>所属</th>
              <td mat-cell *matCellDef="let row">{{ row.department || '-' }}</td>
            </ng-container>

            <ng-container matColumnDef="address">
              <th mat-header-cell *matHeaderCellDef>住所</th>
              <td mat-cell *matCellDef="let row">{{ row.address || '-' }}</td>
            </ng-container>

            <ng-container matColumnDef="weeklyWorkingHours">
              <th mat-header-cell *matHeaderCellDef>所定労働時間</th>
              <td mat-cell *matCellDef="let row">
                {{ row.weeklyWorkingHours ?? '-' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="weeklyWorkingDays">
              <th mat-header-cell *matHeaderCellDef>所定労働日数</th>
              <td mat-cell *matCellDef="let row">
                {{ row.weeklyWorkingDays ?? '-' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="isStudent">
              <th mat-header-cell *matHeaderCellDef>学生</th>
              <td mat-cell *matCellDef="let row">
                {{ row.isStudent ? '学生' : '-' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="monthlyWage">
              <th mat-header-cell *matHeaderCellDef>標準報酬月額</th>
              <td mat-cell *matCellDef="let row">
                {{ row.monthlyWage | number }}
              </td>
            </ng-container>

            <ng-container matColumnDef="dependents">
              <th mat-header-cell *matHeaderCellDef class="center">扶養家族</th>
              <td mat-cell *matCellDef="let row" class="center">
                <button
                  mat-stroked-button
                  color="primary"
                  class="dependents-button"
                  type="button"
                  (click)="openDetailWithFocus(row, 'dependents')"
                  aria-label="扶養家族を管理"
                >
                  <mat-icon aria-hidden="true">family_restroom</mat-icon>
                  <ng-container *ngIf="getDependentsCount(row) | async as count">
                    <span class="dependents-count" *ngIf="typeof count === 'number'">{{ count + '人' }}</span>
                    <span class="dependents-count" *ngIf="typeof count !== 'number'">-</span>
                  </ng-container>
                  <span class="dependents-label">管理</span>
                </button>
              </td>
            </ng-container>

            <!-- 社会保険列 -->
            <ng-container matColumnDef="isInsured">
              <th mat-header-cell *matHeaderCellDef class="center">社会保険</th>
              <td mat-cell *matCellDef="let row" class="center">
                <span class="status-badge" [class.insured]="row.isInsured" [class.not-insured]="!row.isInsured">
                {{ row.isInsured ? '加入' : '対象外' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="workingStatus">
              <th mat-header-cell *matHeaderCellDef>就業状態</th>
              <td mat-cell *matCellDef="let row">
                <span class="status-text">{{ getWorkingStatusLabel(row.workingStatus) }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="updatedBy">
              <th mat-header-cell *matHeaderCellDef>最終更新者</th>
              <td mat-cell *matCellDef="let row">
                {{ row.updatedByDisplayName || '-' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="updatedAt">
              <th mat-header-cell *matHeaderCellDef>最終更新日時</th>
              <td mat-cell *matCellDef="let row">
                {{ row.updatedAt ? (row.updatedAt | date: 'yyyy-MM-dd HH:mm') : '-' }}
              </td>
            </ng-container>

            <!-- 操作列 -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-header">操作</th>
              <td mat-cell *matCellDef="let row" class="actions-cell">
                <button
                  mat-icon-button
                  (click)="openDetail(row)"
                  aria-label="詳細"
                  title="詳細"
                >
                  <mat-icon>visibility</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="primary"
                  (click)="openDialog(row)"
                  aria-label="編集"
                  title="編集"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                  (click)="confirmDeleteEmployee(row)"
                  aria-label="削除"
                  title="削除"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns" class="table-header-row"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns" class="table-row"></tr>
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
        font-size: 1rem;
      }

      .content-card {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1.5rem;
        margin-bottom: 2rem;
        padding-bottom: 1.5rem;
        border-bottom: 2px solid #e0e0e0;
      }

      .page-title-section h2 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0 0 0.5rem 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #333;
      }

      .page-title-section h2 mat-icon {
        color: #667eea;
      }

      .page-title-section p {
        margin: 0;
        color: #666;
        font-size: 0.95rem;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .table-container {
        position: relative;
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
      }

      table.employee-table {
        width: 100%;
        background: white;
      }

      .table-header-row {
        background: #f5f5f5;
      }

      table.employee-table th {
        font-weight: 600;
        color: #555;
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 16px;
      }

      table.employee-table td {
        padding: 16px;
        border-bottom: 1px solid #f0f0f0;
      }

      .table-row {
        transition: background-color 0.2s ease;
      }

      .table-row:hover {
        background-color: #f9f9f9;
      }

      .table-row:last-child td {
        border-bottom: none;
      }

      .center {
        text-align: center;
      }

      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 16px;
        font-weight: 500;
        font-size: 0.875rem;
      }

      .status-badge.insured {
        background: #e8f5e9;
        color: #2e7d32;
      }

      .status-badge.not-insured {
        background: #ffebee;
        color: #c62828;
      }

      .status-text {
        color: #333;
        font-weight: 500;
      }

      .dependents-button {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        min-width: 140px;
        justify-content: center;
      }

      .dependents-count {
        font-weight: 600;
        color: #333;
      }

      .dependents-label {
        color: #555;
      }

      .actions-header {
        text-align: center;
      }

      .actions-cell {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        text-align: center;
        color: #999;
      }

      .empty-state mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 1rem;
        opacity: 0.5;
      }

      .empty-state p {
        margin: 0 0 1.5rem 0;
        font-size: 1.1rem;
      }

      .empty-office-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        text-align: center;
        color: #999;
      }

      .empty-office-state mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 1rem;
        opacity: 0.5;
        color: #667eea;
      }

      .empty-office-state h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1.25rem;
        color: #666;
      }

      .empty-office-state p {
        margin: 0;
        font-size: 1rem;
      }

      button[mat-raised-button] {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
      }

      button[mat-raised-button]:hover:not(:disabled) {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
      }

      button[mat-icon-button] {
        transition: all 0.2s ease;
      }

      button[mat-icon-button]:hover {
        transform: scale(1.1);
      }

      .help-button {
        width: 36px;
        height: 36px;
        margin-left: 0.25rem;
        color: white;
      }

      .help-button mat-icon {
        font-size: 22px;
      }

      @media (max-width: 768px) {
        .page-header {
          flex-direction: column;
          align-items: stretch;
        }

        .page-header button {
          width: 100%;
        }

        .header-content {
          flex-direction: column;
          text-align: center;
        }
      }
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

  private readonly dependentsCountMap = new Map<
    string,
    ReturnType<typeof this.createDependentsCountStream>
  >();

  readonly displayedColumns = [
    'name',
    'department',
    'address',
    'weeklyWorkingHours',
    'weeklyWorkingDays',
    'isStudent',
    'monthlyWage',
    'dependents',
    'isInsured',
    'workingStatus',
    'updatedBy',
    'updatedAt',
    'actions'
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

  readonly employeesWithUpdatedBy$ = this.employees$.pipe(
    switchMap((employees) => {
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
      width: '720px',
      data: { employee }
    });
  }

  openDetailWithFocus(employee: Employee, focusSection: DialogFocusSection): void {
    this.dialog.open(EmployeeDetailDialogComponent, {
      width: '720px',
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
      width: '720px',
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

  getDependentsCount(employee: Employee) {
    const cached = this.dependentsCountMap.get(employee.id);
    if (cached) {
      return cached;
    }

    const stream = this.createDependentsCountStream(employee);
    this.dependentsCountMap.set(employee.id, stream);
    return stream;
  }

  // 編集ダイアログを開いて保存後に reload$.next() で一覧を再取得
  async openDialog(employee?: Employee): Promise<void> {
    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) {
      return;
    }

    const dialogRef = this.dialog.open(EmployeeFormDialogComponent, {
      width: '720px',
      data: { employee, officeId }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result?.saved) {
        return;
      }

      this.snackBar.open('従業員情報を保存しました', '閉じる', {
        duration: 3000
      });
      // 一覧再読み込み
      this.reload$.next();
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

