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

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-header">操作</th>
              <td mat-cell *matCellDef="let row">
                <div class="flex-row gap-2 justify-center">
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
                </div>
              </td>
            </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
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

      .content-card {
        padding: 24px;
        border-radius: 8px;
      }

      /* ユーティリティ */
      .m-0 { margin: 0; }
      .mb-0 { margin-bottom: 0; }
      .mb-2 { margin-bottom: 8px; }
      .mb-3 { margin-bottom: 16px; }
      .mb-4 { margin-bottom: 24px; }
      .gap-2 { gap: 8px; }
      .gap-3 { gap: 16px; }
      .flex-row { display: flex; flex-direction: row; }
      .align-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .flex-wrap { flex-wrap: wrap; }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .table-container {
        position: relative;
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        background: #fff;
      }

      .center { text-align: center; }

      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 16px;
        font-weight: 500;
        font-size: 0.875rem;
        white-space: nowrap;
      }

      .status-badge.insured { background: #e8f5e9; color: #2e7d32; }
      .status-badge.not-insured { background: #ffebee; color: #c62828; }

      .status-text {
        color: #333;
        font-weight: 500;
      }

      .dependents-button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 140px;
        justify-content: center;
      }

      .dependents-count { font-weight: 600; color: #333; }
      .dependents-label { color: #555; }

      .actions-header { text-align: center; }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        color: #999;
      }

      .empty-state mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      .empty-state p {
        margin: 0 0 16px 0;
        font-size: 1.05rem;
      }

      .empty-office-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        color: #999;
      }

      .empty-office-state mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        opacity: 0.5;
        color: #667eea;
      }

      .empty-office-state h3 {
        margin: 0 0 8px 0;
        font-size: 1.25rem;
        color: #666;
      }

      .empty-office-state p {
        margin: 0;
        font-size: 1rem;
      }

      .help-button {
        width: 36px;
        height: 36px;
      }

      @media (max-width: 768px) {
        .header-actions {
          width: 100%;
          justify-content: flex-start;
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
      width: '1200px',
      maxWidth: '95vw',
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

