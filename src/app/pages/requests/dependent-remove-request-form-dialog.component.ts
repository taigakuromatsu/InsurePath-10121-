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
    <h1 mat-dialog-title>
      <mat-icon class="mr-2">delete</mat-icon>
      扶養家族削除申請
    </h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content class="dense-form">
      <div class="form-section mb-4" *ngIf="currentDependent">
        <h3 class="mat-h3 mb-2 flex-row align-center gap-2">
          <mat-icon color="primary">info</mat-icon> 削除対象の被扶養者
        </h3>
        <div class="screen-rules">
          <p>
            <strong>氏名:</strong> {{ currentDependent.name }}<br>
            <span *ngIf="currentDependent.kana"><strong>カナ:</strong> {{ currentDependent.kana }}<br></span>
            <strong>続柄:</strong> {{ getDependentRelationshipLabel(currentDependent.relationship) }}<br>
            <strong>生年月日:</strong> {{ currentDependent.dateOfBirth }}
          </p>
        </div>
      </div>

      <div class="form-section">
        <mat-form-field appearance="outline" class="w-100">
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
        <button mat-stroked-button mat-dialog-close type="button">キャンセル</button>
        <button mat-flat-button color="warn" type="submit" [disabled]="form.invalid">
          <mat-icon>delete</mat-icon>
          削除を申請する
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .mr-2 { margin-right: 8px; }
      
      .screen-rules {
        padding: 12px;
        background: #f5f7fa;
        border-radius: 4px;
        font-size: 13px;
        color: #666;
        border-left: 3px solid #1a237e;
        
        p { margin: 0; line-height: 1.5; }
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

