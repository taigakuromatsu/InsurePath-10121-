import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { BehaviorSubject, combineLatest, firstValueFrom, map, of, switchMap, Observable } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

import { ProceduresService } from '../../services/procedures.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { EmployeesService } from '../../services/employees.service';
import { DependentsService } from '../../services/dependents.service';
import { ProcedureFormDialogComponent } from './procedure-form-dialog.component';
import { ProcedureStatus, ProcedureType, SocialInsuranceProcedure, Employee } from '../../types';
import { todayYmd } from '../../utils/date-helpers';

@Component({
  selector: 'ip-procedures-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDialogModule,
    AsyncPipe,
    NgIf
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div>
          <h1>社会保険手続き状況・履歴</h1>
          <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">
            従業員・被扶養者ごとの社会保険手続きの状況と履歴を管理できます。
          </p>
        </div>
      </header>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center mb-4 flex-wrap gap-2">
          <h2 class="mat-h2 mb-0 flex-row align-center gap-2">
            <mat-icon color="primary">assignment_turned_in</mat-icon> 手続き一覧
          </h2>
          <button mat-flat-button color="primary" (click)="openCreateDialog()">
            <mat-icon>post_add</mat-icon>
            手続きを登録
          </button>
        </div>

        <div class="filters dense-form">
          <mat-form-field appearance="outline" class="filter-field dense-form-field">
            <mat-label>ステータス</mat-label>
            <mat-select [value]="statusFilter$.value" (selectionChange)="statusFilter$.next($event.value)">
              <mat-option value="all">すべて</mat-option>
              <mat-option value="not_started">未着手</mat-option>
              <mat-option value="in_progress">準備中</mat-option>
              <mat-option value="submitted">提出済</mat-option>
              <mat-option value="rejected">差戻し</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field dense-form-field">
            <mat-label>期限</mat-label>
            <mat-select [value]="deadlineFilter$.value" (selectionChange)="deadlineFilter$.next($event.value)">
              <mat-option value="all">すべて</mat-option>
              <mat-option value="upcoming">期限が近い（7日以内）</mat-option>
              <mat-option value="thisWeek">今週提出期限</mat-option>
              <mat-option value="nextWeek">来週提出期限</mat-option>
              <mat-option value="overdue">期限切れ</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field dense-form-field">
            <mat-label>手続き種別</mat-label>
            <mat-select
              [value]="procedureTypeFilter$.value"
              (selectionChange)="procedureTypeFilter$.next($event.value)"
            >
              <mat-option value="all">すべて</mat-option>
              <mat-option value="qualification_acquisition">資格取得届</mat-option>
              <mat-option value="qualification_loss">資格喪失届</mat-option>
              <mat-option value="standard_reward">算定基礎届</mat-option>
              <mat-option value="monthly_change">月額変更届</mat-option>
              <mat-option value="dependent_change">被扶養者異動届</mat-option>
              <mat-option value="bonus_payment">賞与支払届</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div *ngIf="proceduresWithNames$ | async as procedures; else loading">
          <div class="table-container" *ngIf="procedures.length > 0; else empty">
            <table mat-table [dataSource]="procedures" class="admin-table">
              <ng-container matColumnDef="procedureType">
                <th mat-header-cell *matHeaderCellDef>手続き種別</th>
                <td mat-cell *matCellDef="let row">{{ getProcedureTypeLabel(row.procedureType) }}</td>
              </ng-container>

              <ng-container matColumnDef="target">
                <th mat-header-cell *matHeaderCellDef>対象者</th>
                <td mat-cell *matCellDef="let row">{{ getTargetPersonName(row) }}</td>
              </ng-container>

              <ng-container matColumnDef="incidentDate">
                <th mat-header-cell *matHeaderCellDef>事由発生日</th>
                <td mat-cell *matCellDef="let row">{{ row.incidentDate }}</td>
              </ng-container>

              <ng-container matColumnDef="deadline">
                <th mat-header-cell *matHeaderCellDef>提出期限</th>
                <td mat-cell *matCellDef="let row" [class.overdue]="isOverdue(row)">
                  {{ row.deadline }}
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>ステータス</th>
                <td mat-cell *matCellDef="let row">
                  <span [class]="'status-chip status-' + row.status">{{ getStatusLabel(row.status) }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="submittedAt">
                <th mat-header-cell *matHeaderCellDef>提出日</th>
                <td mat-cell *matCellDef="let row">{{ row.submittedAt || '未提出' }}</td>
              </ng-container>

              <ng-container matColumnDef="assignedPersonName">
                <th mat-header-cell *matHeaderCellDef>担当者</th>
                <td mat-cell *matCellDef="let row">{{ row.assignedPersonName || '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-header">アクション</th>
                <td mat-cell *matCellDef="let row" class="actions-cell">
                  <button mat-icon-button color="primary" (click)="openEditDialog(row)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteProcedure(row)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
          <ng-template #empty>
            <div class="empty-state">
              <mat-icon>inbox</mat-icon>
              <p>手続き状況・履歴がありません。</p>
            </div>
          </ng-template>
        </div>

        <ng-template #loading>
          <div class="empty-state">
            <mat-icon>hourglass_empty</mat-icon>
            <p>読み込み中...</p>
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
      .mb-0 { margin-bottom: 0; }
      .mb-2 { margin-bottom: 8px; }
      .mb-3 { margin-bottom: 16px; }
      .mb-4 { margin-bottom: 24px; }
      .mr-2 { margin-right: 8px; }
      .gap-2 { gap: 8px; }
      .gap-3 { gap: 16px; }
      .flex-row { display: flex; flex-direction: row; }
      .align-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .flex-wrap { flex-wrap: wrap; }
      .filter-field { min-width: 200px; }
      .dense-form-field { font-size: 14px; }

      .filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }

      .table-container {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
        background: #fff;
      }

      .status-chip {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 9999px;
        font-size: 0.875rem;
        font-weight: 600;
      }

      .status-not_started { background: #eef2ff; color: #4338ca; }
      .status-in_progress { background: #ecfeff; color: #0ea5e9; }
      .status-submitted { background: #ecfdf3; color: #15803d; }
      .status-rejected { background: #fef2f2; color: #b91c1c; }

      .actions-header,
      .actions-cell {
        text-align: center;
      }

      .empty-state {
        padding: 48px 24px;
        text-align: center;
        color: #6b7280;
        display: grid;
        place-items: center;
        gap: 12px;
      }

      .empty-state mat-icon {
        font-size: 40px;
        color: #9ca3af;
        opacity: 0.5;
      }

      .overdue {
        color: #b91c1c;
        font-weight: 600;
      }
    `
  ]
})
export class ProceduresPage {
  private readonly proceduresService = inject(ProceduresService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly employeesService = inject(EmployeesService);
  private readonly dependentsService = inject(DependentsService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);

  readonly displayedColumns = [
    'procedureType',
    'target',
    'incidentDate',
    'deadline',
    'status',
    'submittedAt',
    'assignedPersonName',
    'actions'
  ];

  readonly statusFilter$ = new BehaviorSubject<ProcedureStatus | 'all'>('all');
  readonly deadlineFilter$ = new BehaviorSubject<'all' | 'upcoming' | 'overdue' | 'thisWeek' | 'nextWeek'>('all');
  readonly procedureTypeFilter$ = new BehaviorSubject<ProcedureType | 'all'>('all');

  readonly employees$ = this.currentOffice.officeId$.pipe(
    switchMap((officeId) => (officeId ? this.employeesService.list(officeId) : of([] as Employee[])))
  );

  readonly procedures$ = combineLatest([
    this.currentOffice.officeId$,
    this.statusFilter$,
    this.deadlineFilter$,
    this.procedureTypeFilter$
  ]).pipe(
    switchMap(([officeId, statusFilter, deadlineFilter, procedureTypeFilter]) => {
      if (!officeId) return of([]);

      let procedures$: ReturnType<ProceduresService['list']>;

      if (deadlineFilter === 'upcoming') {
        procedures$ = this.proceduresService.listByDeadline(officeId, 'upcoming');
      } else if (deadlineFilter === 'overdue') {
        procedures$ = this.proceduresService.listByDeadline(officeId, 'overdue');
      } else if (deadlineFilter === 'thisWeek') {
        procedures$ = this.proceduresService.listThisWeekDeadlines(officeId);
      } else if (deadlineFilter === 'nextWeek') {
        procedures$ = this.proceduresService.listNextWeekDeadlines(officeId);
      } else {
        const filters: { status?: ProcedureStatus; procedureType?: ProcedureType } = {};
        if (statusFilter !== 'all') {
          filters.status = statusFilter;
        }
        if (procedureTypeFilter !== 'all') {
          filters.procedureType = procedureTypeFilter;
        }
        return this.proceduresService.list(officeId, Object.keys(filters).length > 0 ? filters : undefined);
      }

      return procedures$.pipe(
        map((procedures) => {
          let filtered = procedures;
          if (statusFilter !== 'all') {
            filtered = filtered.filter((p) => p.status === statusFilter);
          }
          if (procedureTypeFilter !== 'all') {
            filtered = filtered.filter((p) => p.procedureType === procedureTypeFilter);
          }
          return filtered;
        })
      );
    })
  );

  readonly proceduresWithNames$ = combineLatest([
    this.procedures$,
    this.employees$,
    this.currentOffice.officeId$
  ]).pipe(
    switchMap(([procedures, employees, officeId]) => {
      if (!officeId) return of([] as (SocialInsuranceProcedure & { employeeName?: string; dependentName?: string })[]);

      const employeeMap = new Map<string, Employee>();
      employees.forEach((emp) => employeeMap.set(emp.id, emp));

      const proceduresNeedingDependents = procedures.filter((p) => p.dependentId);
      if (proceduresNeedingDependents.length === 0) {
        return of(
          procedures.map((p) => ({
            ...p,
            employeeName: employeeMap.get(p.employeeId)?.name || '不明'
          }))
        );
      }

      const dependentObservables = proceduresNeedingDependents.map((p) =>
        this.dependentsService.list(officeId, p.employeeId).pipe(
          map((dependents) => {
            const dependent = dependents.find((d) => d.id === p.dependentId);
            return { procedureId: p.id, dependentName: dependent?.name };
          })
        )
      );

      return combineLatest(dependentObservables).pipe(
        map((dependentNames) => {
          const dependentNameMap = new Map<string, string>();
          dependentNames.forEach(({ procedureId, dependentName }) => {
            if (dependentName) {
              dependentNameMap.set(procedureId, dependentName);
            }
          });

          return procedures.map((p) => ({
            ...p,
            employeeName: employeeMap.get(p.employeeId)?.name || '不明',
            dependentName: dependentNameMap.get(p.id)
          }));
        })
      );
    })
  );

  getProcedureTypeLabel(type: ProcedureType): string {
    const labels: Record<ProcedureType, string> = {
      qualification_acquisition: '資格取得届',
      qualification_loss: '資格喪失届',
      standard_reward: '算定基礎届',
      monthly_change: '月額変更届',
      dependent_change: '被扶養者異動届',
      bonus_payment: '賞与支払届'
    };
    return labels[type] ?? type;
  }

  getStatusLabel(status: ProcedureStatus): string {
    const labels: Record<ProcedureStatus, string> = {
      not_started: '未着手',
      in_progress: '準備中',
      submitted: '提出済',
      rejected: '差戻し'
    };
    return labels[status] ?? status;
  }

  getTargetPersonName(
    procedure: SocialInsuranceProcedure & { employeeName?: string; dependentName?: string }
  ): string {
    if (procedure.procedureType === 'dependent_change' && procedure.dependentName) {
      return `${procedure.employeeName || '不明'}／${procedure.dependentName}`;
    }
    return procedure.employeeName || '不明';
  }

  isOverdue(procedure: SocialInsuranceProcedure): boolean {
    if (procedure.status === 'submitted') {
      return false;
    }
    const today = todayYmd();
    return procedure.deadline < today;
  }

  async openCreateDialog(): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    this.dialog.open(ProcedureFormDialogComponent, {
      width: '640px',
      data: { officeId }
    });
  }

  async openEditDialog(procedure: SocialInsuranceProcedure): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    this.dialog.open(ProcedureFormDialogComponent, {
      width: '640px',
      data: { officeId, procedure }
    });
  }

  async deleteProcedure(procedure: SocialInsuranceProcedure): Promise<void> {
    if (!confirm(`手続き「${this.getProcedureTypeLabel(procedure.procedureType)}」を削除しますか？`)) {
      return;
    }

    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    await this.proceduresService.delete(officeId, procedure.id);
  }

  constructor() {
    this.route.queryParams.subscribe((params) => {
      const deadline = params['deadline'] as 'thisWeek' | 'overdue' | 'nextWeek' | undefined;
      if (deadline === 'thisWeek' || deadline === 'overdue' || deadline === 'nextWeek') {
        this.deadlineFilter$.next(deadline);
        this.statusFilter$.next('all');
        this.procedureTypeFilter$.next('all');
      }
    });
  }
}
