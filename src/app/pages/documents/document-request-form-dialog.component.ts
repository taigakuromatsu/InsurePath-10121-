import { NgFor, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';

import { DocumentsService } from '../../services/documents.service';
import { CurrentUserService } from '../../services/current-user.service';
import { EmployeesService } from '../../services/employees.service';
import { DocumentCategory, Employee } from '../../types';
import { getDocumentCategoryLabel } from '../../utils/label-utils';

export interface DocumentRequestFormDialogData {
  officeId: string;
  employeeId: string;
}

@Component({
  selector: 'ip-document-request-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    NgIf,
    NgFor
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon class="mr-2">mail</mat-icon>
      書類アップロード依頼
    </h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content class="dense-form">
      <div class="form-section">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>対象従業員</mat-label>
          <mat-select formControlName="employeeId" required>
            <mat-option *ngFor="let emp of employees" [value]="emp.id">
              {{ emp.name }} {{ emp.kana ? '(' + emp.kana + ')' : '' }}
            </mat-option>
          </mat-select>
          <mat-error *ngIf="form.get('employeeId')?.hasError('required')">
            対象従業員を選択してください
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>書類カテゴリ</mat-label>
          <mat-select formControlName="category" required>
            <mat-option *ngFor="let cat of categories" [value]="cat">
              {{ getCategoryLabel(cat) }}
            </mat-option>
          </mat-select>
          <mat-error *ngIf="form.get('category')?.hasError('required')">
            書類カテゴリを選択してください
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>タイトル</mat-label>
          <input matInput formControlName="title" required maxlength="200" />
          <mat-hint>{{ form.get('title')?.value?.length || 0 }}/200</mat-hint>
          <mat-error *ngIf="form.get('title')?.hasError('required')">
            タイトルを入力してください
          </mat-error>
          <mat-error *ngIf="form.get('title')?.hasError('maxlength')">
            タイトルは200文字以内で入力してください
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>メッセージ（任意）</mat-label>
          <textarea
            matInput
            formControlName="message"
            rows="4"
            maxlength="1000"
          ></textarea>
          <mat-hint>{{ form.get('message')?.value?.length || 0 }}/1000</mat-hint>
          <mat-error *ngIf="form.get('message')?.hasError('maxlength')">
            メッセージは1000文字以内で入力してください
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>締め切り日（任意）</mat-label>
          <input matInput formControlName="dueDate" type="date" />
        </mat-form-field>
      </div>
      <div mat-dialog-actions align="end">
        <button mat-stroked-button type="button" mat-dialog-close>キャンセル</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting">
          <mat-icon *ngIf="!submitting">send</mat-icon>
          <span *ngIf="submitting">作成中...</span>
          <span *ngIf="!submitting">依頼を作成</span>
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .mr-2 { margin-right: 8px; }
      .w-100 { width: 100%; }
      .form-section {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `
  ]
})
export class DocumentRequestFormDialogComponent {
  private readonly documentsService = inject(DocumentsService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly employeesService = inject(EmployeesService);
  private readonly fb = inject(FormBuilder);

  readonly categories: DocumentCategory[] = [
    'identity',
    'residence',
    'incomeProof',
    'studentProof',
    'relationshipProof',
    'otherInsurance',
    'medical',
    'caregiving',
    'procedureOther',
    'other'
  ];

  employees: Employee[] = [];
  submitting = false;

  readonly form = this.fb.group({
    employeeId: ['', Validators.required],
    category: ['', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    message: ['', Validators.maxLength(1000)],
    dueDate: ['']
  });

  constructor(
    private readonly dialogRef: MatDialogRef<DocumentRequestFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DocumentRequestFormDialogData
  ) {
    // data が注入された後に form の初期値を設定
    this.form.patchValue({
      employeeId: this.data.employeeId
    });
    this.loadEmployees();
  }

  async loadEmployees(): Promise<void> {
    try {
      this.employees = await firstValueFrom(
        this.employeesService.list(this.data.officeId)
      );
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  }

  getCategoryLabel(category: DocumentCategory): string {
    return getDocumentCategoryLabel(category);
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting) return;

    this.submitting = true;
    try {
      const userProfile = await firstValueFrom(this.currentUser.profile$);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const formValue = this.form.value;
      await this.documentsService.createRequest(this.data.officeId, {
        employeeId: formValue.employeeId!,
        category: formValue.category as DocumentCategory,
        title: formValue.title!,
        message: formValue.message || null,
        requestedByUserId: userProfile.id,
        requestedByDisplayName: userProfile.displayName,
        dueDate: formValue.dueDate || null
      });

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Failed to create request:', error);
      alert('依頼の作成に失敗しました');
    } finally {
      this.submitting = false;
    }
  }
}

