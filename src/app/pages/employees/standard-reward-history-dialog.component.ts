import { AsyncPipe, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { DecimalPipe } from '@angular/common';
import { map, Observable, of, switchMap } from 'rxjs';

import { Employee, InsuranceKind, StandardRewardHistory } from '../../types';
import { getStandardRewardDecisionKindLabel } from '../../utils/label-utils';
import { StandardRewardHistoryService } from '../../services/standard-reward-history.service';
import { StandardRewardHistoryFormDialogComponent } from './standard-reward-history-form-dialog.component';
import { CurrentUserService } from '../../services/current-user.service';

export interface StandardRewardHistoryDialogData {
  employee: Employee;
}

@Component({
  selector: 'ip-standard-reward-history-dialog',
  standalone: true,
  imports: [
    AsyncPipe,
    NgIf,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MatSnackBarModule,
    DecimalPipe
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">trending_up</mat-icon>
      <span>標準報酬履歴</span>
      <span *ngIf="data.employee.name" class="employee-name">
        （{{ data.employee.name }}）
      </span>
    </h1>

    <div mat-dialog-content class="content">
      <div class="section-title-with-action">
        <h2 class="mat-h3 section-title">
          <mat-icon>trending_up</mat-icon>
          標準報酬履歴
        </h2>
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
            <mat-tab-group>
              <!-- 健康保険のタブ -->
              <mat-tab label="健康保険" *ngIf="((healthHistories$ | async)?.length ?? 0) > 0">
                <table mat-table [dataSource]="(healthHistories$ | async) || []" class="admin-table">
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

                  <ng-container matColumnDef="grade">
                    <th mat-header-cell *matHeaderCellDef>等級</th>
                    <td mat-cell *matCellDef="let history">
                      {{ history.grade ?? '-' }}
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
              </mat-tab>

              <!-- 厚生年金のタブ -->
              <mat-tab label="厚生年金" *ngIf="((pensionHistories$ | async)?.length ?? 0) > 0">
                <table mat-table [dataSource]="(pensionHistories$ | async) || []" class="admin-table">
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

                  <ng-container matColumnDef="grade">
                    <th mat-header-cell *matHeaderCellDef>等級</th>
                    <td mat-cell *matCellDef="let history">
                      {{ history.grade ?? '-' }}
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
              </mat-tab>
            </mat-tab-group>
          </ng-container>
        </div>
      </ng-container>
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

      div[mat-dialog-content] {
        max-height: calc(90vh - 120px);
        overflow-y: auto;
        padding: 16px;
        min-width: 800px;
      }

      .section-title-with-action {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
      }

      .standard-reward-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        color: #999;
        text-align: center;
      }

      .standard-reward-empty mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      .standard-reward-table {
        margin-top: 16px;
      }

      .admin-table {
        width: 100%;
      }

      .admin-table th,
      .admin-table td {
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
      }

      .admin-table th {
        border-bottom: 2px solid #e0e0e0;
      }

      .admin-table tr:last-child td {
        border-bottom: none;
      }

      .standard-reward-note {
        max-width: 300px;
        white-space: normal;
        word-break: break-word;
      }

      .actions-header {
        width: 120px;
      }

      .actions-cell {
        display: flex;
        gap: 4px;
        align-items: center;
        justify-content: center;
      }

      div[mat-dialog-actions] {
        padding: 8px 16px 16px;
        margin: 0;
        gap: 8px;
      }
    `
  ]
})
export class StandardRewardHistoryDialogComponent {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly standardRewardHistoryService = inject(StandardRewardHistoryService);
  private readonly currentUser = inject(CurrentUserService);

  readonly standardRewardHistories$!: Observable<StandardRewardHistory[]>;
  readonly healthHistories$!: Observable<StandardRewardHistory[]>;
  readonly pensionHistories$!: Observable<StandardRewardHistory[]>;

  readonly canManageStandardRewardHistory$: Observable<boolean> = this.currentUser.profile$.pipe(
    map((profile) => profile?.role === 'admin' || profile?.role === 'hr')
  );

  readonly displayedStandardRewardColumns: Array<
    keyof Pick<
      StandardRewardHistory,
      'appliedFromYearMonth' | 'standardMonthlyReward' | 'grade' | 'decisionKind' | 'note'
    > | 'actions'
  > = [
    'appliedFromYearMonth',
    'standardMonthlyReward',
    'grade',
    'decisionKind',
    'note',
    'actions'
  ];
  readonly standardRewardColumnsWithoutActions = this.displayedStandardRewardColumns.filter(
    (column) => column !== 'actions'
  );

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StandardRewardHistoryDialogData,
    private readonly dialogRef: MatDialogRef<StandardRewardHistoryDialogComponent>
  ) {
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

    // 健康保険と厚生年金の履歴を分割
    this.healthHistories$ = this.standardRewardHistories$.pipe(
      map((histories) => (histories ?? []).filter((h) => h.insuranceKind === 'health'))
    );
    this.pensionHistories$ = this.standardRewardHistories$.pipe(
      map((histories) => (histories ?? []).filter((h) => h.insuranceKind === 'pension'))
    );
  }

  protected readonly getStandardRewardDecisionKindLabel = getStandardRewardDecisionKindLabel;

  openAddStandardRewardHistory(): void {
    this.dialog
      .open(StandardRewardHistoryFormDialogComponent, {
        width: '520px',
        data: {
          officeId: this.data.employee.officeId,
          employeeId: this.data.employee.id,
          employee: this.data.employee
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
          employee: this.data.employee,
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
      .delete(
        this.data.employee.officeId,
        this.data.employee.id,
        history.id,
        history.insuranceKind
      )
      .then(() => {
        this.snackBar.open('標準報酬履歴を削除しました', undefined, { duration: 2500 });
      })
      .catch(() => {
        this.snackBar.open('削除に失敗しました。時間をおいて再度お試しください。', undefined, {
          duration: 3000
        });
      });
  }

  private saveStandardRewardHistory(
    history: Partial<StandardRewardHistory> & { id?: string }
  ): void {
    this.standardRewardHistoryService
      .save(this.data.employee.officeId, this.data.employee.id, history)
      .then(() => {
        this.snackBar.open('標準報酬履歴を保存しました', undefined, { duration: 2500 });
      })
      .catch(() => {
        this.snackBar.open('保存に失敗しました。入力内容をご確認ください。', undefined, {
          duration: 3000
        });
      });
  }
}

