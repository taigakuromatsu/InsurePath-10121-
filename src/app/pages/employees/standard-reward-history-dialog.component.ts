import { AsyncPipe, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
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
    MatCardModule,
    MatMenuModule,
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
      <ng-container *ngIf="{ canManage: (canManageStandardRewardHistory$ | async) } as vm">
        <!-- 左右2カラム表示（PC幅） -->
        <div class="histories-grid">
          <!-- 健康保険カード -->
          <ng-container *ngIf="healthHistories$ | async as healthHistories">
            <mat-card class="history-card">
              <mat-card-header class="card-header">
                <div class="card-header-content">
                  <mat-icon class="card-icon">local_hospital</mat-icon>
                  <div class="card-title-section">
                    <mat-card-title>健康保険</mat-card-title>
                    <mat-card-subtitle>
                      {{ healthHistories.length }}件
                    </mat-card-subtitle>
                  </div>
                </div>
                <button
                  *ngIf="vm.canManage"
                  mat-stroked-button
                  color="primary"
                  type="button"
                  (click)="openAddStandardRewardHistory('health')"
                  class="add-button-header"
                >
                  <mat-icon>add</mat-icon>
                  履歴を追加
                </button>
              </mat-card-header>
              <mat-card-content class="card-content">
                <ng-container *ngIf="healthHistories.length > 0; else healthEmpty">
                  <table mat-table [dataSource]="healthHistories" class="admin-table">
                  <ng-container matColumnDef="health-appliedFromYearMonth">
                    <th mat-header-cell *matHeaderCellDef>適用開始年月</th>
                    <td mat-cell *matCellDef="let history" class="mat-column-health-appliedFromYearMonth">
                      {{ history.appliedFromYearMonth }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="health-standardMonthlyReward">
                    <th mat-header-cell *matHeaderCellDef>標準報酬月額</th>
                    <td mat-cell *matCellDef="let history" class="mat-column-health-standardMonthlyReward">
                      {{ history.standardMonthlyReward | number }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="health-grade">
                    <th mat-header-cell *matHeaderCellDef>等級</th>
                    <td mat-cell *matCellDef="let history" class="mat-column-health-grade">
                      {{ history.grade ?? '-' }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="health-decisionKind">
                    <th mat-header-cell *matHeaderCellDef>決定区分</th>
                    <td mat-cell *matCellDef="let history" class="mat-column-health-decisionKind">
                      {{ getStandardRewardDecisionKindLabel(history.decisionKind) }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="health-note">
                    <th mat-header-cell *matHeaderCellDef>メモ</th>
                    <td mat-cell *matCellDef="let history" class="mat-column-health-note standard-reward-note">
                      {{ history.note || '-' }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="health-actions">
                    <th mat-header-cell *matHeaderCellDef class="mat-column-health-actions actions-header">操作</th>
                    <td mat-cell *matCellDef="let history" class="mat-column-health-actions actions-cell">
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
                      vm.canManage
                        ? displayedHealthColumns
                        : healthColumnsWithoutActions
                    "
                    sticky
                  ></tr>
                  <tr
                    mat-row
                    *matRowDef="
                      let row;
                      columns:
                        vm.canManage
                          ? displayedHealthColumns
                          : healthColumnsWithoutActions
                    "
                  >                  </tr>
                  </table>
                </ng-container>
                <ng-template #healthEmpty>
                  <div class="standard-reward-empty">
                    <mat-icon>history</mat-icon>
                    <p>健康保険の標準報酬履歴が登録されていません</p>
                    <button
                      *ngIf="vm.canManage"
                      mat-stroked-button
                      color="primary"
                      type="button"
                      (click)="openAddStandardRewardHistory('health')"
                      class="add-button"
                    >
                      <mat-icon>add</mat-icon>
                      健康保険の履歴を追加
                    </button>
                  </div>
                </ng-template>
              </mat-card-content>
            </mat-card>
          </ng-container>

          <!-- 厚生年金カード -->
          <ng-container *ngIf="pensionHistories$ | async as pensionHistories">
            <mat-card class="history-card">
              <mat-card-header class="card-header">
                <div class="card-header-content">
                  <mat-icon class="card-icon">account_balance</mat-icon>
                  <div class="card-title-section">
                    <mat-card-title>厚生年金</mat-card-title>
                    <mat-card-subtitle>
                      {{ pensionHistories.length }}件
                    </mat-card-subtitle>
                  </div>
                </div>
                <button
                  *ngIf="vm.canManage"
                  mat-stroked-button
                  color="primary"
                  type="button"
                  (click)="openAddStandardRewardHistory('pension')"
                  class="add-button-header"
                >
                  <mat-icon>add</mat-icon>
                  履歴を追加
                </button>
              </mat-card-header>
              <mat-card-content class="card-content">
                <ng-container *ngIf="pensionHistories.length > 0; else pensionEmpty">
                  <table mat-table [dataSource]="pensionHistories" class="admin-table">
                  <ng-container matColumnDef="pension-appliedFromYearMonth">
                    <th mat-header-cell *matHeaderCellDef>適用開始年月</th>
                    <td mat-cell *matCellDef="let history" class="mat-column-pension-appliedFromYearMonth">
                      {{ history.appliedFromYearMonth }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="pension-standardMonthlyReward">
                    <th mat-header-cell *matHeaderCellDef>標準報酬月額</th>
                    <td mat-cell *matCellDef="let history" class="mat-column-pension-standardMonthlyReward">
                      {{ history.standardMonthlyReward | number }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="pension-grade">
                    <th mat-header-cell *matHeaderCellDef>等級</th>
                    <td mat-cell *matCellDef="let history" class="mat-column-pension-grade">
                      {{ history.grade ?? '-' }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="pension-decisionKind">
                    <th mat-header-cell *matHeaderCellDef>決定区分</th>
                    <td mat-cell *matCellDef="let history" class="mat-column-pension-decisionKind">
                      {{ getStandardRewardDecisionKindLabel(history.decisionKind) }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="pension-note">
                    <th mat-header-cell *matHeaderCellDef>メモ</th>
                    <td mat-cell *matCellDef="let history" class="mat-column-pension-note standard-reward-note">
                      {{ history.note || '-' }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="pension-actions">
                    <th mat-header-cell *matHeaderCellDef class="mat-column-pension-actions actions-header">操作</th>
                    <td mat-cell *matCellDef="let history" class="mat-column-pension-actions actions-cell">
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
                      vm.canManage
                        ? displayedPensionColumns
                        : pensionColumnsWithoutActions
                    "
                    sticky
                  ></tr>
                  <tr
                    mat-row
                    *matRowDef="
                      let row;
                      columns:
                        vm.canManage
                          ? displayedPensionColumns
                          : pensionColumnsWithoutActions
                    "
                  >                  </tr>
                  </table>
                </ng-container>
                <ng-template #pensionEmpty>
                  <div class="standard-reward-empty">
                    <mat-icon>history</mat-icon>
                    <p>厚生年金の標準報酬履歴が登録されていません</p>
                    <button
                      *ngIf="vm.canManage"
                      mat-stroked-button
                      color="primary"
                      type="button"
                      (click)="openAddStandardRewardHistory('pension')"
                      class="add-button"
                    >
                      <mat-icon>add</mat-icon>
                      厚生年金の履歴を追加
                    </button>
                  </div>
                </ng-template>
              </mat-card-content>
            </mat-card>
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
        padding: 16px;
        overflow: auto;
        box-sizing: border-box;
        max-height: calc(90vh - 140px); /* title + actions 分を引く */
        width: min(1400px, 95vw);
        min-width: 0; /* 1200px固定をやめる */
        background: #f5f5f5;
      }

      .histories-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        height: auto;
        align-items: start;
      }

      @media (max-width: 959px) {
        .histories-grid {
          grid-template-columns: 1fr;
          height: auto;
          min-height: auto;
        }
      }

      .history-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        border: 1px solid #e0e0e0;
        min-width: 0; /* flexboxの子要素がはみ出さないように */
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid #e0e0e0;
        flex-shrink: 0;
        border-radius: 8px 8px 0 0;
        background: #ffffff;
        gap: 12px;
        min-width: 0; /* flexboxの子要素がはみ出さないように */
        overflow: hidden; /* はみ出しを防ぐ */
      }

      .card-header-content {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0; /* flexboxの子要素がはみ出さないように */
      }

      .card-icon {
        color: #1976d2;
      }

      .card-title-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .card-title-section mat-card-title {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
      }

      .card-title-section mat-card-subtitle {
        margin: 0;
        font-size: 0.85rem;
        color: #666;
      }

      .add-button-header {
        flex-shrink: 0;
        white-space: nowrap;
        margin: 0;
        max-width: 100%;
        box-sizing: border-box;
      }

      /* Material 3 ボタンの内部構造を上書き */
      .add-button-header ::ng-deep {
        .mdc-button {
          padding: 0 12px !important;
          min-width: auto !important;
          height: 36px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .mdc-button__ripple {
          padding: 0 !important;
        }

        .mdc-button__label {
          display: inline-flex !important;
          align-items: center !important;
          gap: 4px !important;
          white-space: nowrap !important;
          padding: 0 !important;
          line-height: 1 !important;
        }

        .mat-mdc-button-persistent-ripple {
          display: none;
        }
      }

      /* アイコンのスタイル */
      .add-button-header mat-icon {
        margin: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        width: 18px !important;
        height: 18px !important;
        font-size: 18px !important;
        line-height: 18px !important;
        flex-shrink: 0;
        display: inline-block !important;
      }

      .card-content {
        flex: 1;
        overflow-y: auto;
        padding: 0;
        min-height: 0;
        border-radius: 0 0 8px 8px;
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

      .standard-reward-empty .add-button {
        margin-top: 16px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      /* Material 3 ボタンの内部構造を上書き */
      .standard-reward-empty .add-button ::ng-deep {
        .mdc-button {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .mdc-button__label {
          display: inline-flex !important;
          align-items: center !important;
          gap: 4px !important;
          white-space: nowrap !important;
        }
      }

      /* アイコンのスタイル */
      .standard-reward-empty .add-button mat-icon {
        margin: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        width: 18px !important;
        height: 18px !important;
        font-size: 18px !important;
        line-height: 18px !important;
        flex-shrink: 0;
        display: inline-block !important;
        vertical-align: middle;
      }

      .standard-reward-table {
        margin-top: 16px;
      }

      .admin-table {
        width: 100%;
        table-layout: fixed;
      }

      .admin-table th {
        white-space: nowrap;
        border-bottom: 2px solid #e0e0e0;
      }

      .admin-table th,
      .admin-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #e0e0e0;
        font-size: 13px;
      }

      /* 適用開始年月 */
      .mat-column-health-appliedFromYearMonth,
      .mat-column-pension-appliedFromYearMonth {
        width: 120px;
        white-space: nowrap;
      }

      /* 標準報酬月額 */
      .mat-column-health-standardMonthlyReward,
      .mat-column-pension-standardMonthlyReward {
        width: 120px;
        text-align: right;
      }

      /* 等級 */
      .mat-column-health-grade,
      .mat-column-pension-grade {
        width: 70px;
        text-align: center;
      }

      /* 決定区分 */
      .mat-column-health-decisionKind,
      .mat-column-pension-decisionKind {
        width: 96px;
      }

      /* メモ（ここを"固定"するのがポイント） */
      .mat-column-health-note,
      .mat-column-pension-note {
        width: 200px;
      }

      /* 操作 */
      .mat-column-health-actions,
      .mat-column-pension-actions {
        width: 96px;
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
        padding: 16px 24px;
        margin: 0;
        gap: 8px;
        border-top: 1px solid #e0e0e0;
        background: #fafafa;
        display: flex;
        justify-content: flex-end;
      }

      div[mat-dialog-actions] button {
        display: inline-flex;
        align-items: center;
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

  readonly displayedHealthColumns = [
    'health-appliedFromYearMonth',
    'health-standardMonthlyReward',
    'health-grade',
    'health-decisionKind',
    'health-note',
    'health-actions'
  ];
  readonly healthColumnsWithoutActions = this.displayedHealthColumns.filter(
    (column) => column !== 'health-actions'
  );

  readonly displayedPensionColumns = [
    'pension-appliedFromYearMonth',
    'pension-standardMonthlyReward',
    'pension-grade',
    'pension-decisionKind',
    'pension-note',
    'pension-actions'
  ];
  readonly pensionColumnsWithoutActions = this.displayedPensionColumns.filter(
    (column) => column !== 'pension-actions'
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

  openAddStandardRewardHistory(insuranceKind: InsuranceKind): void {
    this.dialog
      .open(StandardRewardHistoryFormDialogComponent, {
        width: '520px',
        data: {
          officeId: this.data.employee.officeId,
          employeeId: this.data.employee.id,
          employee: this.data.employee,
          initialInsuranceKind: insuranceKind
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

