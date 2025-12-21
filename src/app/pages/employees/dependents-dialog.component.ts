import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom, map, Observable } from 'rxjs';

import { Dependent, Employee } from '../../types';
import { getDependentRelationshipLabel } from '../../utils/label-utils';
import { DependentsService } from '../../services/dependents.service';
import { DependentFormDialogComponent } from './dependent-form-dialog.component';
import { CurrentUserService } from '../../services/current-user.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../components/confirm-dialog.component';

export interface DependentsDialogData {
  employee: Employee;
}

@Component({
  selector: 'ip-dependents-dialog',
  standalone: true,
  imports: [
    AsyncPipe,
    NgFor,
    NgIf,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">family_restroom</mat-icon>
      <span>扶養家族</span>
      <span *ngIf="data.employee.name" class="employee-name">
        （{{ data.employee.name }}）
      </span>
    </h1>

    <div mat-dialog-content class="content">
      <div class="section-title-with-action">
        <h2 class="mat-h3 section-title">
          <mat-icon>family_restroom</mat-icon>
          扶養家族
        </h2>
        <ng-container *ngIf="canManageDependents$ | async">
          <button mat-stroked-button color="primary" (click)="openAddDependent()">
            <mat-icon>person_add</mat-icon>
            扶養家族を追加
          </button>
        </ng-container>
      </div>

      <ng-container *ngIf="dependents$ | async as dependents">
        <div class="dependents-empty" *ngIf="dependents.length === 0">
          <mat-icon>group_off</mat-icon>
          <p>扶養家族が登録されていません</p>
        </div>

        <div class="dependents-grid" *ngIf="dependents.length > 0">
          <div class="dependent-card" *ngFor="let dependent of dependents">
            <div class="dependent-header">
              <div>
                <div class="dependent-name">{{ dependent.name }}</div>
                <div class="dependent-relationship">
                  {{ getDependentRelationshipLabel(dependent.relationship) }}
                </div>
              </div>

              <div class="dependent-actions" *ngIf="canManageDependents$ | async">
                <button mat-icon-button color="primary" (click)="openEditDependent(dependent)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="confirmDeleteDependent(dependent)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>

            <div class="dependent-row">
              <span class="label">生年月日</span>
              <span class="value">{{ dependent.dateOfBirth || '-' }}</span>
            </div>
            <div class="dependent-row">
              <span class="label">資格取得日</span>
              <span class="value">{{ dependent.qualificationAcquiredDate || '-' }}</span>
            </div>
            <div class="dependent-row">
              <span class="label">資格喪失日</span>
              <span class="value">{{ dependent.qualificationLossDate || '-' }}</span>
            </div>
          </div>
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
        max-height: 70vh;
        overflow-y: auto;
        padding: 16px;
        min-width: 600px;
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

      .dependents-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        color: #999;
        text-align: center;
      }

      .dependents-empty mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      .dependents-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
        margin-top: 16px;
      }

      .dependent-card {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 16px;
        background: #fff;
      }

      .dependent-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #f0f0f0;
      }

      .dependent-name {
        font-size: 1rem;
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
      }

      .dependent-relationship {
        font-size: 0.875rem;
        color: #666;
      }

      .dependent-actions {
        display: flex;
        gap: 4px;
      }

      .dependent-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #f5f5f5;
      }

      .dependent-row:last-child {
        border-bottom: none;
      }

      .dependent-row .label {
        color: #666;
        font-size: 0.875rem;
      }

      .dependent-row .value {
        color: #333;
        font-size: 0.875rem;
        font-weight: 500;
      }

      div[mat-dialog-actions] {
        padding: 8px 16px 16px;
        margin: 0;
        gap: 8px;
      }
    `
  ]
})
export class DependentsDialogComponent {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dependentsService = inject(DependentsService);
  private readonly currentUser = inject(CurrentUserService);

  readonly dependents$!: Observable<Dependent[]>;
  readonly canManageDependents$: Observable<boolean> = this.currentUser.profile$.pipe(
    map((profile) => profile?.role === 'admin' || profile?.role === 'hr')
  );

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DependentsDialogData,
    private readonly dialogRef: MatDialogRef<DependentsDialogComponent>
  ) {
    this.dependents$ = this.dependentsService.list(
      this.data.employee.officeId,
      this.data.employee.id
    );
  }

  protected readonly getDependentRelationshipLabel = getDependentRelationshipLabel;

  openAddDependent(): void {
    this.dialog
      .open(DependentFormDialogComponent, {
        width: '1200px',
        maxWidth: '95vw',
        data: {
          officeId: this.data.employee.officeId,
          employeeId: this.data.employee.id
        }
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.saveDependent(result);
        }
      });
  }

  openEditDependent(dependent: Dependent): void {
    this.dialog
      .open(DependentFormDialogComponent, {
        width: '1200px',
        maxWidth: '95vw',
        data: {
          officeId: this.data.employee.officeId,
          employeeId: this.data.employee.id,
          dependent
        }
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.saveDependent({
            ...result,
            id: dependent.id,
            createdAt: dependent.createdAt
          });
        }
      });
  }

  async confirmDeleteDependent(dependent: Dependent): Promise<void> {
    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        width: '400px',
        data: {
          title: '扶養家族を削除しますか？',
          message: `扶養家族「${dependent.name}」を削除します。よろしいですか？`,
          confirmLabel: '削除',
          cancelLabel: 'キャンセル'
        }
      }
    );

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) {
      return;
    }

    await this.deleteDependent(dependent);
  }

  private async deleteDependent(dependent: Dependent): Promise<void> {
    try {
      await this.dependentsService.delete(
        this.data.employee.officeId,
        this.data.employee.id,
        dependent.id
      );
      this.snackBar.open('扶養家族を削除しました', undefined, { duration: 2500 });
    } catch (error) {
      this.snackBar.open('削除に失敗しました。時間をおいて再度お試しください。', undefined, {
        duration: 3000
      });
    }
  }

  private saveDependent(dependent: Partial<Dependent> & { id?: string }): void {
    this.dependentsService
      .save(this.data.employee.officeId, this.data.employee.id, dependent)
      .then(() => this.snackBar.open('扶養家族を保存しました', undefined, { duration: 2500 }))
      .catch(() =>
        this.snackBar.open('保存に失敗しました。入力内容をご確認ください。', undefined, {
          duration: 3000
        })
      );
  }
}

