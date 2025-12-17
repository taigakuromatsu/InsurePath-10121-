import { NgFor, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { DocumentsService } from '../../services/documents.service';
import { StorageService } from '../../services/storage.service';
import { CurrentUserService } from '../../services/current-user.service';
import { EmployeesService } from '../../services/employees.service';
import { DocumentCategory, Employee } from '../../types';
import { getDocumentCategoryLabel } from '../../utils/label-utils';

export interface DocumentUploadFormDialogData {
  officeId: string;
  employeeId: string;
}

@Component({
  selector: 'ip-document-upload-form-dialog',
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
      <mat-icon class="mr-2">upload</mat-icon>
      書類をアップロード
    </h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content class="dense-form">
      <div class="form-section">
        <div class="form-row flex-row gap-3 flex-wrap">
          <mat-form-field appearance="outline" class="flex-1">
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

          <mat-form-field appearance="outline" class="flex-1">
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
        </div>

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
          <mat-label>メモ（任意）</mat-label>
          <textarea matInput formControlName="note" rows="3"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>有効期限（任意）</mat-label>
          <input matInput formControlName="expiresAt" type="date" min="1900-01-01" max="2100-12-31" />
        </mat-form-field>

                <!-- ここを差し替え -->

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>ファイル</mat-label>
          <!-- 表示用のテキスト入力（matInput） -->
          <input
            matInput
            [value]="selectedFile ? selectedFile.name : ''"
            placeholder="ファイルを選択してください"
            readonly
            (click)="fileInput.click()"
          />
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="fileInput.click()"
            aria-label="ファイルを選択"
          >
            <mat-icon>attach_file</mat-icon>
          </button>

          <mat-error *ngIf="form.get('file')?.hasError('required')">
            ファイルを選択してください
          </mat-error>
          <mat-error *ngIf="form.get('file')?.hasError('fileSize')">
            ファイルサイズは10MB以下にしてください
          </mat-error>
          <mat-error *ngIf="form.get('file')?.hasError('fileType')">
            PDFまたは画像ファイルを選択してください
          </mat-error>
        </mat-form-field>

        <!-- 実際の file input（非表示） -->
        <input
          #fileInput
          type="file"
          accept="application/pdf,image/*"
          (change)="onFileSelected($event)"
          style="display: none"
        />

        <div *ngIf="selectedFile" class="file-info">
          <mat-icon>description</mat-icon>
          <span>{{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})</span>
        </div>

      </div>
      <div mat-dialog-actions align="end">
        <button mat-stroked-button type="button" mat-dialog-close [disabled]="submitting">キャンセル</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting">
          <mat-icon *ngIf="!submitting">upload</mat-icon>
          <span *ngIf="submitting">アップロード中...</span>
          <span *ngIf="!submitting">アップロード</span>
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .mr-2 { margin-right: 8px; }
      .w-100 { width: 100%; }
      .flex-1 { flex: 1 1 200px; min-width: 0; }
      .form-section {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-row {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
      }
      .file-info {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background-color: #f5f5f5;
        border-radius: 4px;
      }
    `
  ]
})
export class DocumentUploadFormDialogComponent {
  private readonly documentsService = inject(DocumentsService);
  private readonly storageService = inject(StorageService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly employeesService = inject(EmployeesService);
  private readonly snackBar = inject(MatSnackBar);
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
  selectedFile: File | null = null;
  submitting = false;

  readonly form = this.fb.group({
    employeeId: ['', Validators.required],
    category: ['', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    note: [''],
    expiresAt: [''],
    file: [null as File | null, Validators.required]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<DocumentUploadFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DocumentUploadFormDialogData
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

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // ファイルサイズチェック（10MB）
      if (file.size > 10 * 1024 * 1024) {
        this.form.get('file')?.setErrors({ fileSize: true });
        this.selectedFile = null;
        return;
      }

      // ファイルタイプチェック
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        this.form.get('file')?.setErrors({ fileType: true });
        this.selectedFile = null;
        return;
      }

      this.selectedFile = file;
      this.form.patchValue({ file });
      this.form.get('file')?.setErrors(null);
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting || !this.selectedFile) return;

    this.submitting = true;
    try {
      const userProfile = await firstValueFrom(this.currentUser.profile$);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const formValue = this.form.value;
      const officeId = this.data.officeId;
      const employeeId = formValue.employeeId!;

      // ドキュメントIDを生成（一時的なID）
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Storageにアップロード
      const storagePath = await this.storageService.uploadFile(
        officeId,
        employeeId,
        documentId,
        this.selectedFile
      );

      // Firestoreにメタ情報を保存
      const now = new Date().toISOString();
      await this.documentsService.createAttachment(officeId, {
        employeeId,
        category: formValue.category as DocumentCategory,
        title: formValue.title!,
        note: formValue.note || null,
        storagePath,
        fileName: this.selectedFile.name,
        fileSize: this.selectedFile.size,
        mimeType: this.selectedFile.type,
        uploadedAt: now,
        uploadedByUserId: userProfile.id,
        uploadedByDisplayName: userProfile.displayName,
        source: 'adminUpload',
        requestId: null,
        expiresAt: formValue.expiresAt || null,
        isExpired: formValue.expiresAt ? new Date(formValue.expiresAt) < new Date() : false
      });

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Failed to upload document:', error);
      this.snackBar.open('アップロードに失敗しました', '閉じる', { duration: 3000 });
    } finally {
      this.submitting = false;
    }
  }
}

