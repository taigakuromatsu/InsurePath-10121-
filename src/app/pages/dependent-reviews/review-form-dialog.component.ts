import { AsyncPipe, NgFor } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom, map, of, startWith, switchMap } from 'rxjs';

import { DependentsService } from '../../services/dependents.service';
import { EmployeesService } from '../../services/employees.service';
import { DependentReviewsService } from '../../services/dependent-reviews.service';
import { CurrentUserService } from '../../services/current-user.service';
import { Dependent, DependentReviewResult, DependentReview } from '../../types';

export interface ReviewFormDialogData {
  review?: DependentReview;
  officeId: string;
  employeeId?: string;
  dependentId?: string;
}

@Component({
  selector: 'ip-review-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    NgFor,
    AsyncPipe
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon>{{ data.review ? 'edit' : 'post_add' }}</mat-icon>
      {{ data.review ? '確認結果を編集' : '確認結果を登録' }}
    </h1>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <div mat-dialog-content class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>対象従業員</mat-label>
          <mat-select formControlName="employeeId" (selectionChange)="onEmployeeChange()">
            <mat-option *ngFor="let employee of employees$ | async" [value]="employee.id">
              {{ employee.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>対象被扶養者</mat-label>
          <mat-select formControlName="dependentId">
            <mat-option *ngFor="let dependent of dependents$ | async" [value]="dependent.id">
              {{ dependent.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>確認日</mat-label>
          <input matInput type="date" formControlName="reviewDate" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>確認結果</mat-label>
          <mat-select formControlName="result">
            <mat-option value="continued">継続</mat-option>
            <mat-option value="to_be_removed">削除予定</mat-option>
            <mat-option value="needs_review">要確認</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>確認担当者</mat-label>
          <input matInput formControlName="reviewedBy" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>備考</mat-label>
          <textarea matInput formControlName="note" rows="3" maxlength="500"></textarea>
        </mat-form-field>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button mat-dialog-close type="button">キャンセル</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
          保存
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
      }

      .full-width {
        grid-column: 1 / -1;
      }
    `
  ]
})
export class ReviewFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ReviewFormDialogComponent>);
  private readonly reviewsService = inject(DependentReviewsService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly employeesService = inject(EmployeesService);
  private readonly dependentsService = inject(DependentsService);

  readonly data = inject<ReviewFormDialogData>(MAT_DIALOG_DATA);

  // 今日の日付 (YYYY-MM-DD)
  private readonly today = new Date().toISOString().substring(0, 10);

  form = this.fb.group({
    employeeId: [this.data.review?.employeeId || this.data.employeeId || '', Validators.required],
    dependentId: [this.data.review?.dependentId || this.data.dependentId || '', Validators.required],
    // 既存レビューがあればその日付、なければ今日の日付
    reviewDate: [this.data.review?.reviewDate || this.today, Validators.required],
    result: [this.data.review?.result || '', Validators.required],
    reviewedBy: [this.data.review?.reviewedBy || ''],
    note: [this.data.review?.note || '']
  });

  readonly employees$ = this.employeesService.list(this.data.officeId);

  readonly dependents$ = this.form.get('employeeId')!.valueChanges.pipe(
    startWith(this.data.review?.employeeId || this.data.employeeId || ''),
    switchMap((employeeId) => {
      if (!employeeId) {
        return of<Dependent[]>([]);
      }
      return this.dependentsService.list(this.data.officeId, employeeId);
    })
  );

  onEmployeeChange(): void {
    this.form.patchValue({ dependentId: '' });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    const formValue = this.form.getRawValue();

    // id と displayName の両方を取得
    const currentUserData = await firstValueFrom(
      this.currentUser.profile$.pipe(
        map((profile) => ({
          id: profile?.id ?? null,
          displayName: profile?.displayName ?? ''
        }))
      )
    );

    const currentUserId = currentUserData.id;
    const currentUserName = currentUserData.displayName;

    if (!currentUserId) {
      throw new Error('ユーザーIDが取得できませんでした');
    }

    const reviewedBy = formValue.reviewedBy || currentUserName;

    if (this.data.review) {
      await this.reviewsService.update(
        this.data.officeId,
        this.data.review.id,
        {
          employeeId: formValue.employeeId || '',
          dependentId: formValue.dependentId || '',
          reviewDate: formValue.reviewDate || '',
          result: formValue.result as DependentReviewResult,
          reviewedBy,
          note: formValue.note || ''
        },
        currentUserId
      );
    } else {
      await this.reviewsService.create(
        this.data.officeId,
        {
          employeeId: formValue.employeeId || '',
          dependentId: formValue.dependentId || '',
          reviewDate: formValue.reviewDate || '',
          result: formValue.result as DependentReviewResult,
          reviewedBy,
          note: formValue.note || ''
        },
        currentUserId
      );
    }

    this.dialogRef.close(true);
  }
}
