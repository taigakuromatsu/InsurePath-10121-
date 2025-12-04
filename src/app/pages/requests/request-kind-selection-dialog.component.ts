import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom, of, switchMap } from 'rxjs';

import { DependentsService } from '../../services/dependents.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { Dependent } from '../../types';
import { DependentAddRequestFormDialogComponent } from './dependent-add-request-form-dialog.component';
import { DependentRemoveRequestFormDialogComponent } from './dependent-remove-request-form-dialog.component';
import { DependentUpdateRequestFormDialogComponent } from './dependent-update-request-form-dialog.component';
import { ChangeRequestFormDialogComponent } from './change-request-form-dialog.component';
import { DependentSelectDialogComponent } from './dependent-select-dialog.component';
import { EmployeesService } from '../../services/employees.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'ip-request-kind-selection-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h1 mat-dialog-title>申請種別を選択</h1>
    <div mat-dialog-content>
      <div class="kind-options">
        <button
          mat-stroked-button
          class="kind-option"
          (click)="openProfileChangeForm()"
        >
          <mat-icon>person</mat-icon>
          <div class="option-content">
            <div class="option-title">プロフィール変更</div>
            <div class="option-description">住所・連絡先などの変更を申請</div>
          </div>
        </button>

        <button
          mat-stroked-button
          class="kind-option"
          (click)="openDependentAddForm()"
        >
          <mat-icon>person_add</mat-icon>
          <div class="option-content">
            <div class="option-title">扶養家族を追加</div>
            <div class="option-description">新しい被扶養者の追加を申請</div>
          </div>
        </button>

        <button
          mat-stroked-button
          class="kind-option"
          (click)="openDependentUpdateForm()"
        >
          <mat-icon>edit</mat-icon>
          <div class="option-content">
            <div class="option-title">扶養家族を変更</div>
            <div class="option-description">既存の被扶養者情報の変更を申請</div>
          </div>
        </button>

        <button
          mat-stroked-button
          class="kind-option"
          (click)="openDependentRemoveForm()"
        >
          <mat-icon>delete</mat-icon>
          <div class="option-content">
            <div class="option-title">扶養家族を削除</div>
            <div class="option-description">被扶養者の削除を申請</div>
          </div>
        </button>
      </div>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>キャンセル</button>
    </div>
  `,
  styles: [
    `
      .kind-options {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: 400px;
      }

      .kind-option {
        width: 100%;
        height: auto;
        padding: 1rem;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .kind-option mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #667eea;
      }

      .option-content {
        flex: 1;
      }

      .option-title {
        font-weight: 600;
        font-size: 1rem;
        margin-bottom: 0.25rem;
      }

      .option-description {
        font-size: 0.875rem;
        color: #666;
      }
    `
  ]
})
export class RequestKindSelectionDialogComponent {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly currentUser = inject(CurrentUserService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly employeesService = inject(EmployeesService);
  private readonly dependentsService = inject(DependentsService);

  constructor(private readonly dialogRef: MatDialogRef<RequestKindSelectionDialogComponent>) {}

  async openProfileChangeForm(): Promise<void> {
    this.dialogRef.close();
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    const profile = await firstValueFrom(this.currentUser.profile$);
    if (!profile?.employeeId) return;

    const employee = await firstValueFrom(
      this.employeesService.get(officeId, profile.employeeId)
    );

    if (!employee) {
      return;
    }

    this.dialog.open(ChangeRequestFormDialogComponent, {
      width: '600px',
      data: { employee, officeId }
    });
  }

  async openDependentAddForm(): Promise<void> {
    this.dialogRef.close();
    const [profile, officeId] = await Promise.all([
      firstValueFrom(this.currentUser.profile$),
      firstValueFrom(this.currentOffice.officeId$)
    ]);

    if (!profile?.employeeId || !officeId) {
      return;
    }

    this.dialog.open(DependentAddRequestFormDialogComponent, {
      width: '600px',
      data: {
        officeId,
        employeeId: profile.employeeId
      }
    });
  }

  async openDependentUpdateForm(): Promise<void> {
    this.dialogRef.close();
    const [profile, officeId] = await Promise.all([
      firstValueFrom(this.currentUser.profile$),
      firstValueFrom(this.currentOffice.officeId$)
    ]);

    if (!profile?.employeeId || !officeId) {
      return;
    }

    // 被扶養者一覧を取得して選択ダイアログを開く
    const dependents = await firstValueFrom(
      this.dependentsService.list(officeId, profile.employeeId)
    );

    if (dependents.length === 0) {
      this.snackBar.open('変更対象の被扶養者がいません。', '閉じる', {
        duration: 3000
      });
      return;
    }

    if (dependents.length === 1) {
      // 1人だけの場合はそのまま開く
      this.dialog.open(DependentUpdateRequestFormDialogComponent, {
        width: '600px',
        data: {
          officeId,
          employeeId: profile.employeeId,
          dependentId: dependents[0].id
        }
      });
    } else {
      // 複数いる場合は選択ダイアログを開く
      const dialogRef = this.dialog.open(DependentSelectDialogComponent, {
        width: '500px',
        data: {
          dependents,
          title: '変更対象の被扶養者を選択',
          message: '変更したい被扶養者を選択してください。'
        }
      });

      const selected = await firstValueFrom(dialogRef.afterClosed());
      if (selected) {
        this.dialog.open(DependentUpdateRequestFormDialogComponent, {
          width: '600px',
          data: {
            officeId,
            employeeId: profile.employeeId,
            dependentId: selected.id
          }
        });
      }
    }
  }

  async openDependentRemoveForm(): Promise<void> {
    this.dialogRef.close();
    const [profile, officeId] = await Promise.all([
      firstValueFrom(this.currentUser.profile$),
      firstValueFrom(this.currentOffice.officeId$)
    ]);

    if (!profile?.employeeId || !officeId) {
      return;
    }

    // 被扶養者一覧を取得して選択ダイアログを開く
    const dependents = await firstValueFrom(
      this.dependentsService.list(officeId, profile.employeeId)
    );

    if (dependents.length === 0) {
      this.snackBar.open('削除対象の被扶養者がいません。', '閉じる', {
        duration: 3000
      });
      return;
    }

    if (dependents.length === 1) {
      // 1人だけの場合はそのまま開く
      this.dialog.open(DependentRemoveRequestFormDialogComponent, {
        width: '600px',
        data: {
          officeId,
          employeeId: profile.employeeId,
          dependentId: dependents[0].id
        }
      });
    } else {
      // 複数いる場合は選択ダイアログを開く
      const dialogRef = this.dialog.open(DependentSelectDialogComponent, {
        width: '500px',
        data: {
          dependents,
          title: '削除対象の被扶養者を選択',
          message: '削除したい被扶養者を選択してください。'
        }
      });

      const selected = await firstValueFrom(dialogRef.afterClosed());
      if (selected) {
        this.dialog.open(DependentRemoveRequestFormDialogComponent, {
          width: '600px',
          data: {
            officeId,
            employeeId: profile.employeeId,
            dependentId: selected.id
          }
        });
      }
    }
  }
}

