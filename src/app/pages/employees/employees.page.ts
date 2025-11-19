import { AsyncPipe, DecimalPipe, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { of, switchMap } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { EmployeesService } from '../../services/employees.service';
import { Employee } from '../../types';
import { EmployeeFormDialogComponent } from './employee-form-dialog.component';

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
          <button mat-raised-button color="primary" (click)="openDialog()" [disabled]="!officeId()">
            <mat-icon aria-hidden="true">person_add</mat-icon>
            従業員を追加
          </button>
        </div>

        <table mat-table [dataSource]="(employees$ | async) || []" class="employee-table" *ngIf="officeId(); else emptyOffice">
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
            <td mat-cell *matCellDef="let row">{{ row.weeklyWorkingHours ?? '-' }}</td>
          </ng-container>

          <ng-container matColumnDef="weeklyWorkingDays">
            <th mat-header-cell *matHeaderCellDef>所定労働日数</th>
            <td mat-cell *matCellDef="let row">{{ row.weeklyWorkingDays ?? '-' }}</td>
          </ng-container>

          <ng-container matColumnDef="isStudent">
            <th mat-header-cell *matHeaderCellDef>学生</th>
            <td mat-cell *matCellDef="let row">{{ row.isStudent ? '学生' : '-' }}</td>
          </ng-container>

          <ng-container matColumnDef="monthlyWage">
            <th mat-header-cell *matHeaderCellDef>標準報酬月額</th>
            <td mat-cell *matCellDef="let row">{{ row.monthlyWage | number }}</td>
          </ng-container>

          <ng-container matColumnDef="isInsured">
            <th mat-header-cell *matHeaderCellDef>社会保険</th>
            <td mat-cell *matCellDef="let row">{{ row.isInsured ? '加入' : '対象外' }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row" class="actions">
              <button mat-icon-button color="primary" (click)="openDialog(row)">
                <mat-icon aria-hidden="true">edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="delete(row)">
                <mat-icon aria-hidden="true">delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>

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
      table {
        width: 100%;
        margin-top: 1.5rem;
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
  readonly officeId = signal<string | null>(null);

  readonly employees$ = this.currentOffice.officeId$.pipe(
    switchMap((officeId) => {
      this.officeId.set(officeId);
      if (!officeId) {
        return of([] as Employee[]);
      }
      return this.employeesService.list(officeId);
    })
  );

  openDialog(employee?: Employee): void {
    const officeId = this.officeId();
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
      try {
        await this.employeesService.save(officeId, { ...employee, ...result });
        this.snackBar.open('従業員情報を保存しました', '閉じる', { duration: 3000 });
      } catch (error) {
        console.error(error);
        this.snackBar.open('従業員情報の保存に失敗しました', '閉じる', { duration: 4000 });
      }
    });
  }

  async delete(employee: Employee): Promise<void> {
    const officeId = this.officeId();
    if (!officeId) {
      return;
    }
    try {
      await this.employeesService.delete(officeId, employee.id);
      this.snackBar.open('従業員を削除しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('従業員の削除に失敗しました', '閉じる', { duration: 4000 });
    }
  }
}
