import { NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom, map } from 'rxjs';

import { ChangeRequestsService } from '../../services/change-requests.service';
import { CurrentUserService } from '../../services/current-user.service';
import { DependentsService } from '../../services/dependents.service';
import { Dependent, DependentRemovePayload } from '../../types';
import { getDependentRelationshipLabel } from '../../utils/label-utils';

export interface DependentRemoveRequestFormDialogData {
  officeId: string;
  employeeId: string;
  dependentId: string;
}

@Component({
  selector: 'ip-dependent-remove-request-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    NgIf
  ],
  template: `
    <h1 mat-dialog-title>扶養家族削除申請</h1>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <div mat-dialog-content>
        <div class="current-info" *ngIf="currentDependent">
          <h3>削除対象の被扶養者</h3>
          <div class="info-item">
            <span class="label">氏名:</span>
            <span class="value">{{ currentDependent.name }}</span>
          </div>
          <div class="info-item" *ngIf="currentDependent.kana">
            <span class="label">カナ:</span>
            <span class="value">{{ currentDependent.kana }}</span>
          </div>
          <div class="info-item">
            <span class="label">続柄:</span>
            <span class="value">
              {{ getDependentRelationshipLabel(currentDependent.relationship) }}
            </span>
          </div>
          <div class="info-item">
            <span class="label">生年月日:</span>
            <span class="value">{{ currentDependent.dateOfBirth }}</span>
          </div>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>削除理由（任意）</mat-label>
          <textarea
            matInput
            formControlName="reason"
            rows="3"
            placeholder="削除理由を入力してください（任意）"
          ></textarea>
          <mat-error *ngIf="form.get('reason')?.hasError('maxlength')">
            削除理由は500文字以内で入力してください
          </mat-error>
        </mat-form-field>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button mat-dialog-close type="button">キャンセル</button>
        <button mat-flat-button color="warn" type="submit" [disabled]="form.invalid">
          <mat-icon>delete</mat-icon>
          削除を申請する
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }

      .current-info {
        background: #f5f5f5;
        padding: 1rem;
        border-radius: 4px;
        margin-bottom: 1rem;
      }

      .current-info h3 {
        margin: 0 0 0.5rem 0;
        font-size: 0.875rem;
        font-weight: 600;
      }

      .info-item {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
      }

      .info-item .label {
        font-weight: 600;
        min-width: 80px;
      }
    `
  ]
})
export class DependentRemoveRequestFormDialogComponent {
  private readonly currentUser = inject(CurrentUserService);
  private readonly changeRequestsService = inject(ChangeRequestsService);
  private readonly dependentsService = inject(DependentsService);
  private readonly fb = inject(FormBuilder);

  protected readonly getDependentRelationshipLabel = getDependentRelationshipLabel;

  currentDependent: Dependent | null = null;

  form = this.fb.group({
    reason: ['', Validators.maxLength(500)]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<DependentRemoveRequestFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: DependentRemoveRequestFormDialogData
  ) {
    this.loadCurrentDependent();
  }

  private async loadCurrentDependent(): Promise<void> {
    try {
      const dependents = await firstValueFrom(
        this.dependentsService.list(this.data.officeId, this.data.employeeId)
      );
      const dependent = dependents.find((d) => d.id === this.data.dependentId);
      if (dependent) {
        this.currentDependent = dependent;
      }
    } catch (error) {
      console.error('Failed to load dependent', error);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.getRawValue();
    const currentUserId = await firstValueFrom(
      this.currentUser.profile$.pipe(map((profile) => profile?.id ?? null))
    );

    if (!currentUserId) {
      throw new Error('ユーザーIDが取得できませんでした');
    }

    if (!this.currentDependent) {
      throw new Error('被扶養者情報が見つかりませんでした');
    }

    const payload: DependentRemovePayload = {
      dependentName: this.currentDependent.name,
      relationship: this.currentDependent.relationship,
      dateOfBirth: this.currentDependent.dateOfBirth,
      reason: formValue.reason || undefined
    };

    await this.changeRequestsService.create(this.data.officeId, {
      employeeId: this.data.employeeId,
      requestedByUserId: currentUserId,
      kind: 'dependent_remove',
      targetDependentId: this.data.dependentId,
      payload
    });

    this.dialogRef.close(true);
  }
}

