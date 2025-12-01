import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { BehaviorSubject, combineLatest, firstValueFrom, map, of, switchMap } from 'rxjs';

import { ProceduresService } from '../../services/procedures.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { EmployeesService } from '../../services/employees.service';
import { DependentsService } from '../../services/dependents.service';
import { ProcedureFormDialogComponent } from './procedure-form-dialog.component';
import { ProcedureStatus, ProcedureType, SocialInsuranceProcedure, Employee } from '../../types';

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
    NgIf,
    NgFor
  ],
  template: `
    <section class="page">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>assignment_turned_in</mat-icon>
          </div>
          <div class="header-text">
            <h1>社会保険手続き履歴</h1>
            <p>従業員・被扶養者ごとの社会保険手続きの履歴を管理できます。</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="card-header">
          <h2>手続き一覧</h2>
          <button mat-flat-button color="primary" (click)="openCreateDialog()">
            <mat-icon>post_add</mat-icon>
            手続きを登録
          </button>
        </div>

        <div class="filters">
          <mat-form-field appearance="outline">
            <mat-label>ステータス</mat-label>
            <mat-select [value]="statusFilter$.value" (selectionChange)="statusFilter$.next($event.value)">
              <mat-option value="all">すべて</mat-option>
              <mat-option value="not_started">未着手</mat-option>
              <mat-option value="in_progress">準備中</mat-option>
              <mat-option value="submitted">提出済</mat-option>
              <mat-option value="rejected">差戻し</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>期限</mat-label>
            <mat-select [value]="deadlineFilter$.value" (selectionChange)="deadlineFilter$.next($event.value)">
              <mat-option value="all">すべて</mat-option>
              <mat-option value="upcoming">期限が近い（7日以内）</mat-option>
              <mat-option value="overdue">期限切れ</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
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
            <table mat-table [dataSource]="procedures" class="procedures-table">
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
              <p>手続き履歴がありません。</p>
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
    </section>
  `,
  styles: [
    `
      .header-card {
        margin-bottom: 1rem;
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .header-icon {
        width: 56px;
        height: 56px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: #ecfeff;
        color: #0ea5e9;
      }

      .header-text h1 {
        margin: 0;
        font-size: 1.5rem;
      }

      .header-text p {
        margin: 0;
        color: #4b5563;
      }

      .content-card {
        padding: 1.5rem;
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .table-container {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }

      table {
        width: 100%;
      }

      .procedures-table th,
      .procedures-table td {
        padding: 0.75rem 1rem;
      }

      .status-chip {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.875rem;
        font-weight: 600;
      }

      .status-not_started {
        background: #eef2ff;
        color: #4338ca;
      }

      .status-in_progress {
        background: #ecfeff;
        color: #0ea5e9;
      }

      .status-submitted {
        background: #ecfdf3;
        color: #15803d;
      }

      .status-rejected {
        background: #fef2f2;
        color: #b91c1c;
      }

      .actions-header,
      .actions-cell {
        text-align: center;
      }

      .empty-state {
        padding: 2rem;
        text-align: center;
        color: #6b7280;
        display: grid;
        place-items: center;
        gap: 0.5rem;
      }

      .empty-state mat-icon {
        font-size: 40px;
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
  readonly deadlineFilter$ = new BehaviorSubject<'all' | 'upcoming' | 'overdue'>('all');
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

      if (deadlineFilter !== 'all') {
        return this.proceduresService.listByDeadline(officeId, deadlineFilter).pipe(
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
      }

      const filters: { status?: ProcedureStatus; procedureType?: ProcedureType } = {};
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      if (procedureTypeFilter !== 'all') {
        filters.procedureType = procedureTypeFilter;
      }
      return this.proceduresService.list(officeId, Object.keys(filters).length > 0 ? filters : undefined);
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
    const today = new Date().toISOString().substring(0, 10);
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
}
