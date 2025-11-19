// src/app/pages/employees/employees.page.ts
import { AsyncPipe, DecimalPipe, NgIf } from '@angular/common';
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
  of,
  startWith,
  switchMap,
  tap,
  firstValueFrom
} from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { EmployeesService } from '../../services/employees.service';
import { Employee } from '../../types';
import { EmployeeFormDialogComponent } from './employee-form-dialog.component';
import { EmployeeDetailDialogComponent } from './employee-detail-dialog.component';

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
    DecimalPipe
  ],
  template: `
    <section class="page employees">
      <mat-card>
        <div class="header">
          <div>
            <h1>従業員台帳</h1>
            <p>現在の事業所に紐づく従業員を登録・更新できます。</p>
          </div>
          <!-- officeId$ | async でボタンの活性/非活性を制御 -->
          <button
            mat-raised-button
            color="primary"
            (click)="openDialog()"
            [disabled]="!(officeId$ | async)"
          >
            <mat-icon aria-hidden="true">person_add</mat-icon>
            従業員を追加
          </button>
        </div>

        <!-- officeId$ | async を使ってテーブル表示を制御 -->
        <ng-container *ngIf="officeId$ | async as officeId; else emptyOffice">
          <table
            mat-table
            [dataSource]="(employees$ | async) || []"
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

            <!-- 社会保険列 -->
            <ng-container matColumnDef="isInsured">
              <th mat-header-cell *matHeaderCellDef class="center">社会保険</th>
              <td mat-cell *matCellDef="let row" class="center">
                {{ row.isInsured ? '加入' : '対象外' }}
              </td>
            </ng-container>

            <!-- 操作列 -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="center">操作</th>
              <td mat-cell *matCellDef="let row" class="actions">
                <!-- 詳細ボタン -->
                <button
                  mat-icon-button
                  (click)="openDetail(row)"
                  aria-label="詳細"
                >
                  <mat-icon aria-hidden="true">visibility</mat-icon>
                </button>

                <!-- 編集ボタン -->
                <button
                  mat-icon-button
                  color="primary"
                  (click)="openDialog(row)"
                  aria-label="編集"
                >
                  <mat-icon aria-hidden="true">edit</mat-icon>
                </button>

                <!-- 削除ボタン -->
                <button
                  mat-icon-button
                  color="warn"
                  (click)="delete(row)"
                  aria-label="削除"
                >
                  <mat-icon aria-hidden="true">delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </ng-container>

        <ng-template #emptyOffice>
          <p>事業所が未設定です。まずは所属事業所を設定してください。</p>
        </ng-template>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .employees .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
      }

      table.employee-table {
        width: 100%;
        margin-top: 1.5rem;
        table-layout: fixed; /* 列幅をキッチリ揃える */
      }

      .employee-table .mat-header-cell,
      .employee-table .mat-cell {
        padding-right: 12px;
        padding-left: 12px;
      }

      .employee-table .center {
        text-align: center;
      }

      /* 操作列は幅を少し広めに固定してズレを防ぐ */
      .employee-table .mat-column-actions {
        width: 132px;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.25rem;
      }
    `
  ]
})
export class EmployeesPage {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly employeesService = inject(EmployeesService);
  private readonly currentOffice = inject(CurrentOfficeService);

  readonly displayedColumns = [
    'name',
    'department',
    'address',
    'weeklyWorkingHours',
    'weeklyWorkingDays',
    'isStudent',
    'monthlyWage',
    'isInsured',
    'actions'
  ];

  // CurrentOfficeService からそのまま officeId$ を公開
  readonly officeId$ = this.currentOffice.officeId$;

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

  // 🔍 詳細ダイアログを開く
  openDetail(employee: Employee): void {
    this.dialog.open(EmployeeDetailDialogComponent, {
      width: '720px',
      data: { employee }
    });
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

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) {
        return;
      }

      const payload: Partial<Employee> & { id?: string } =
        employee ? { ...employee, ...result } : result;

      try {
        await this.employeesService.save(officeId, payload);
        this.snackBar.open('従業員情報を保存しました', '閉じる', {
          duration: 3000
        });
        // 一覧再読み込み
        this.reload$.next();
      } catch (error) {
        console.error(error);
        this.snackBar.open('従業員情報の保存に失敗しました', '閉じる', {
          duration: 4000
        });
      }
    });
  }

  // 削除後も reload$.next() で一覧を再取得
  async delete(employee: Employee): Promise<void> {
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

