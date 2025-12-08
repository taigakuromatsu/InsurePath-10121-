import { AsyncPipe, DatePipe, DecimalPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subject, combineLatest, of, startWith, switchMap, map, firstValueFrom } from 'rxjs';

import { CurrentOfficeService } from '../../../services/current-office.service';
import { CurrentUserService } from '../../../services/current-user.service';
import { EmployeesService } from '../../../services/employees.service';
import { BonusPremiumsService } from '../../../services/bonus-premiums.service';
import { BonusPremium, Employee } from '../../../types';
import { BonusFormDialogComponent } from './bonus-form-dialog.component';
import { CsvExportService } from '../../../utils/csv-export.service';
import { HelpDialogComponent, HelpDialogData } from '../../../components/help-dialog.component';
import { DocumentGenerationDialogComponent } from '../../documents/document-generation-dialog.component';

interface BonusPremiumWithEmployee extends BonusPremium {
  employeeName: string;
}

@Component({
  selector: 'ip-bonus-premiums-page',
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
          <h1 class="m-0">賞与保険料管理</h1>
              <button
                mat-icon-button
                class="help-button"
                type="button"
                (click)="openHelp()"
                aria-label="賞与保険料のヘルプを表示"
              >
                <mat-icon>help_outline</mat-icon>
              </button>
        </div>
        <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">
          賞与支給額から標準賞与額を算出し、健康保険・厚生年金の賞与保険料を自動計算して保存します。
        </p>
      </header>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center mb-4 flex-wrap gap-2">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">list</mat-icon> 賞与支給履歴
            </h2>
            <p class="mat-body-2" style="color: #666">登録済みの賞与と保険料の一覧です。</p>
          </div>
          <div class="flex-row gap-2 flex-wrap">
            <button
              mat-stroked-button
              color="primary"
              (click)="exportToCsv()"
              [disabled]="!((viewModel$ | async)?.rows?.length ?? 0)"
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
              <mat-icon>note_add</mat-icon>
              賞与を登録
            </button>
          </div>
        </div>

        <ng-container *ngIf="viewModel$ | async as vm; else noOffice">
          <div class="table-container" *ngIf="vm.rows.length > 0; else emptyState">
            <table mat-table [dataSource]="vm.rows" class="admin-table">
              <ng-container matColumnDef="payDate">
                <th mat-header-cell *matHeaderCellDef>支給日</th>
                <td mat-cell *matCellDef="let row">{{ row.payDate | date: 'yyyy-MM-dd' }}</td>
              </ng-container>

              <ng-container matColumnDef="employee">
                <th mat-header-cell *matHeaderCellDef>従業員</th>
                <td mat-cell *matCellDef="let row">{{ row.employeeName }}</td>
              </ng-container>

              <ng-container matColumnDef="grossAmount">
                <th mat-header-cell *matHeaderCellDef>賞与支給額</th>
                <td mat-cell *matCellDef="let row">{{ row.grossAmount | number }}</td>
              </ng-container>

              <ng-container matColumnDef="standardBonusAmount">
                <th mat-header-cell *matHeaderCellDef>標準賞与額</th>
                <td mat-cell *matCellDef="let row">{{ row.standardBonusAmount | number }}</td>
              </ng-container>

              <ng-container matColumnDef="health">
                <th mat-header-cell *matHeaderCellDef class="center">健康保険</th>
                <td mat-cell *matCellDef="let row" class="center">
                  本人 {{ row.healthEmployee | number }} / 会社 {{ row.healthEmployer | number }}
                </td>
              </ng-container>

              <ng-container matColumnDef="pension">
                <th mat-header-cell *matHeaderCellDef class="center">厚生年金</th>
                <td mat-cell *matCellDef="let row" class="center">
                  本人 {{ row.pensionEmployee | number }} / 会社 {{ row.pensionEmployer | number }}
                </td>
              </ng-container>

              <ng-container matColumnDef="total">
                <th mat-header-cell *matHeaderCellDef class="center">合計</th>
                <td mat-cell *matCellDef="let row" class="center">
                  本人 {{ row.totalEmployee | number }} / 会社 {{ row.totalEmployer | number }}
                </td>
              </ng-container>

              <ng-container matColumnDef="document">
                <th mat-header-cell *matHeaderCellDef class="actions-header">帳票</th>
                <td mat-cell *matCellDef="let row" class="actions-cell">
                  <button
                    mat-icon-button
                    color="primary"
                    aria-label="賞与支払届を生成"
                    (click)="openDocumentDialog(row)"
                  >
                    <mat-icon>picture_as_pdf</mat-icon>
                  </button>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-header">操作</th>
                <td mat-cell *matCellDef="let row" class="actions-cell">
                  <button mat-icon-button color="primary" (click)="openDialog(row)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="delete(row)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>

          <div class="totals" *ngIf="vm.rows.length > 0">
            <div class="total-item">
              <span class="label">本人負担合計</span>
              <span class="value">{{ vm.totalEmployee | number }} 円</span>
            </div>
            <div class="total-item">
              <span class="label">会社負担合計</span>
              <span class="value">{{ vm.totalEmployer | number }} 円</span>
            </div>
          </div>
        </ng-container>

        <ng-template #emptyState>
          <div class="empty-state">
            <mat-icon>pending_actions</mat-icon>
            <p>登録済みの賞与がありません。まずは賞与を登録してください。</p>
            <button mat-stroked-button color="primary" (click)="openDialog()" [disabled]="!(officeId$ | async)">
              <mat-icon>note_add</mat-icon>
              賞与を登録
            </button>
          </div>
        </ng-template>

        <ng-template #noOffice>
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
        max-width: 1366px;
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

      .help-button {
        width: 36px;
        height: 36px;
      }

      .table-container {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        background: #fff;
      }

      .admin-table .actions-header,
      .admin-table .actions-cell {
        text-align: center;
      }

      .totals {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-top: 16px;
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
      }

      .total-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        color: #111827;
      }

      .total-item .label {
        color: #6b7280;
        font-weight: 500;
      }

      .empty-state,
      .empty-office-state {
        text-align: center;
        padding: 48px 24px;
        color: #666;
      }

      .empty-state mat-icon,
      .empty-office-state mat-icon {
        font-size: 48px;
        height: 48px;
        width: 48px;
        color: #9ca3af;
        opacity: 0.5;
        margin-bottom: 8px;
      }
    `
  ]
})
export class BonusPremiumsPage {
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly employeesService = inject(EmployeesService);
  private readonly bonusPremiumsService = inject(BonusPremiumsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly csvExportService = inject(CsvExportService);

  readonly officeId$ = this.currentOffice.officeId$;

  readonly canExport$ = this.currentUser.profile$.pipe(
    map((profile) => profile?.role === 'admin' || profile?.role === 'hr')
  );

  readonly displayedColumns = [
    'payDate',
    'employee',
    'grossAmount',
    'standardBonusAmount',
    'health',
    'pension',
    'total',
    'document',
    'actions'
  ];

  private readonly refresh$ = new Subject<void>();

  private readonly employees$ = this.officeId$.pipe(
    switchMap((officeId) => (officeId ? this.employeesService.list(officeId) : of([])))
  );

  private readonly bonuses$ = combineLatest([this.officeId$, this.refresh$.pipe(startWith(undefined))]).pipe(
    switchMap(([officeId]) =>
      officeId ? this.bonusPremiumsService.listByOfficeAndEmployee(officeId) : of([])
    )
  );

  readonly viewModel$ = combineLatest([this.bonuses$, this.employees$]).pipe(
    map(([bonuses, employees]) => {
      const nameMap = new Map<string, string>();
      employees.forEach((emp) => nameMap.set(emp.id, emp.name));

      const rows: BonusPremiumWithEmployee[] = bonuses.map((b) => ({
        ...b,
        employeeName: nameMap.get(b.employeeId) ?? '(不明)'
      }));

      const totalEmployee = rows.reduce((sum, r) => sum + r.totalEmployee, 0);
      const totalEmployer = rows.reduce((sum, r) => sum + r.totalEmployer, 0);

      return { rows, totalEmployee, totalEmployer };
    })
  );

    openHelp(): void {
      this.dialog.open(HelpDialogComponent, {
        width: '720px',
        data: {
          topicIds: ['bonusRange'],
          title: '賞与保険料に関するヘルプ'
        } satisfies HelpDialogData
      });
    }

  async exportToCsv(): Promise<void> {
    const vm = await firstValueFrom(this.viewModel$);
    if (!vm || vm.rows.length === 0) {
      this.snackBar.open('エクスポートするデータがありません', '閉じる', { duration: 3000 });
      return;
    }

    this.csvExportService.exportBonusPremiums(vm.rows);
    this.snackBar.open('CSVエクスポートが完了しました', '閉じる', { duration: 3000 });
  }

  async openDialog(bonus?: BonusPremiumWithEmployee): Promise<void> {
    const office = await firstValueFrom(this.currentOffice.office$);
    if (!office) {
      this.snackBar.open('事業所が設定されていません', '閉じる', { duration: 3000 });
      return;
    }

    const employees = await firstValueFrom(this.employees$);

    const dialogRef = this.dialog.open(BonusFormDialogComponent, {
      width: '720px',
      data: {
        office,
        employees: employees as Employee[],
        bonus
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.snackBar.open('賞与情報を更新しました', '閉じる', { duration: 3000 });
        this.refresh$.next();
      }
    });
  }

  async delete(row: BonusPremiumWithEmployee): Promise<void> {
    const confirmed = window.confirm(
      `${row.employeeName} さんの ${row.payDate} 支給分の賞与を削除しますか？`
    );
    if (!confirmed) return;

    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) {
      this.snackBar.open('事業所が設定されていません', '閉じる', { duration: 3000 });
      return;
    }

    try {
      await this.bonusPremiumsService.deleteBonusPremium(officeId, row.id);
      this.snackBar.open('削除しました', '閉じる', { duration: 3000 });
      this.refresh$.next();
    } catch (error) {
      console.error('削除に失敗しました', error);
      this.snackBar.open('削除に失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async openDocumentDialog(row: BonusPremiumWithEmployee): Promise<void> {
    const office = await firstValueFrom(this.currentOffice.office$);
    if (!office) {
      this.snackBar.open('事業所が設定されていません', '閉じる', { duration: 3000 });
      return;
    }

    const employee = await firstValueFrom(this.employeesService.get(office.id, row.employeeId));
    if (!employee) {
      this.snackBar.open('従業員情報が取得できませんでした', '閉じる', { duration: 3000 });
      return;
    }

    this.dialog.open(DocumentGenerationDialogComponent, {
      width: '720px',
      data: {
        office,
        employee,
        bonuses: [row],
        defaultType: 'bonus_payment'
      }
    });
  }
}
