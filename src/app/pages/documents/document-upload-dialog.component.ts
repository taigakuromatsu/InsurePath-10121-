import { DatePipe, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { DocumentsService } from '../../services/documents.service';
import { StorageService } from '../../services/storage.service';
import { CurrentUserService } from '../../services/current-user.service';
import { DocumentRequest } from '../../types';
import { getDocumentCategoryLabel } from '../../utils/label-utils';

export interface DocumentUploadDialogData {
  officeId: string;
  request: DocumentRequest;
}

@Component({
  selector: 'ip-document-upload-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    NgIf,
    DatePipe
  ],
  template: `
    <h1 mat-dialog-title>ファイルをアップロード</h1>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <div mat-dialog-content>
        <!-- 依頼情報（読み取り専用） -->
        <div class="request-info">
          <h3>依頼内容</h3>
          <div class="info-item">
            <span class="label">カテゴリ:</span>
            <span class="value">{{ getCategoryLabel(data.request.category) }}</span>
          </div>
          <div class="info-item">
            <span class="label">タイトル:</span>
            <span class="value">{{ data.request.title }}</span>
          </div>
          <div class="info-item" *ngIf="data.request.message">
            <span class="label">メッセージ:</span>
            <span class="value">{{ data.request.message }}</span>
          </div>
          <div class="info-item" *ngIf="data.request.dueDate">
            <span class="label">締め切り日:</span>
            <span class="value">{{ data.request.dueDate | date: 'yyyy-MM-dd' }}</span>
          </div>
        </div>

                <!-- ファイル選択（ここを差し替え） -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>ファイル</mat-label>
          <!-- 表示用のテキスト入力 -->
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


        <!-- タイトル確認・編集 -->
        <mat-form-field appearance="outline" class="full-width">
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

        <!-- メモ（任意） -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>メモ（任意）</mat-label>
          <textarea matInput formControlName="note" rows="3"></textarea>
        </mat-form-field>
      </div>
      <div mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close [disabled]="submitting">キャンセル</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || submitting">
          <mat-icon *ngIf="!submitting">upload</mat-icon>
          <span *ngIf="submitting">アップロード中...</span>
          <span *ngIf="!submitting">アップロード</span>
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
        margin-bottom: 1rem;
      }

      .request-info {
        background-color: #f5f5f5;
        padding: 1rem;
        border-radius: 4px;
        margin-bottom: 1.5rem;
      }

      .request-info h3 {
        margin: 0 0 0.75rem 0;
        font-size: 1rem;
        font-weight: 600;
      }

      .info-item {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .info-item .label {
        font-weight: 600;
        min-width: 100px;
      }

      .info-item .value {
        flex: 1;
      }

      .file-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        background-color: #f5f5f5;
        border-radius: 4px;
        margin-bottom: 1rem;
      }
    `
  ]
})
export class DocumentUploadDialogComponent {
  private readonly documentsService = inject(DocumentsService);
  private readonly storageService = inject(StorageService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  selectedFile: File | null = null;
  submitting = false;

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    note: [''],
    file: [null as File | null, Validators.required]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<DocumentUploadDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DocumentUploadDialogData
  ) {
    // data が注入された後に form の初期値を設定
    this.form.patchValue({
      title: this.data.request.title
    });
  }

  getCategoryLabel(category: string): string {
    return getDocumentCategoryLabel(category as any);
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
      const request = this.data.request;

      // ドキュメントIDを生成
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Storageにアップロード
      const storagePath = await this.storageService.uploadFile(
        officeId,
        request.employeeId,
        documentId,
        this.selectedFile
      );

      // Firestoreにメタ情報を保存
      const now = new Date().toISOString();
      await this.documentsService.createAttachment(officeId, {
        employeeId: request.employeeId,
        category: request.category,
        title: formValue.title!,
        note: formValue.note || null,
        storagePath,
        fileName: this.selectedFile.name,
        fileSize: this.selectedFile.size,
        mimeType: this.selectedFile.type,
        uploadedAt: now,
        uploadedByUserId: userProfile.id,
        uploadedByDisplayName: userProfile.displayName,
        source: 'employeeUploadViaRequest',
        requestId: request.id,
        expiresAt: null,
        isExpired: false
      });

      // DocumentRequestのステータスを更新
      await this.documentsService.updateRequestStatus(officeId, request.id, 'uploaded');

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Failed to upload document:', error);
      this.snackBar.open('アップロードに失敗しました', '閉じる', { duration: 3000 });
    } finally {
      this.submitting = false;
    }
  }
}

