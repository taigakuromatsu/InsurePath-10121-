import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { BehaviorSubject, combineLatest, firstValueFrom, map, of, switchMap } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { DocumentsService } from '../../services/documents.service';
import { EmployeesService } from '../../services/employees.service';
import { StorageService } from '../../services/storage.service';
import {
  DocumentAttachment,
  DocumentRequest,
  DocumentCategory,
  DocumentRequestStatus,
  Employee
} from '../../types';
import { getDocumentCategoryLabel, getDocumentRequestStatusLabel } from '../../utils/label-utils';
import { DocumentRequestFormDialogComponent } from './document-request-form-dialog.component';
import { DocumentUploadFormDialogComponent } from './document-upload-form-dialog.component';
import { ConfirmDialogComponent } from '../requests/confirm-dialog.component';

@Component({
  selector: 'ip-documents-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    AsyncPipe,
    NgIf,
    NgFor,
    DatePipe
  ],
  template: `
    <section class="page documents">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>description</mat-icon>
          </div>
          <div class="header-text">
            <h1>書類管理</h1>
            <p>従業員ごとの添付書類を管理し、書類アップロード依頼を作成できます。</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card" *ngIf="officeId$ | async as officeId; else noOffice">
        <div class="documents-layout">
          <!-- 左カラム: 従業員一覧 -->
          <div class="employee-list-column">
            <div class="employee-list-header">
              <h2>
                <mat-icon>people</mat-icon>
                従業員一覧
              </h2>
              <mat-form-field appearance="outline" class="search-field">
                <mat-label>検索</mat-label>
                <input
                  matInput
                  [value]="searchQuery$.value"
                  (input)="searchQuery$.next($any($event.target).value)"
                  placeholder="氏名・カナで検索"
                />
                <mat-icon matPrefix>search</mat-icon>
              </mat-form-field>
            </div>
            <div class="employee-list-content">
              <div
                *ngFor="let emp of filteredEmployees$ | async"
                class="employee-item"
                [class.selected]="(selectedEmployeeId$ | async) === emp.id"
                (click)="selectEmployee(emp.id)"
              >
                <div class="employee-name">{{ emp.name }}</div>
                <div class="employee-details" *ngIf="emp.kana || emp.department">
                  <span *ngIf="emp.kana" class="detail-item">{{ emp.kana }}</span>
                  <span *ngIf="emp.department" class="detail-item">{{ emp.department }}</span>
                </div>
              </div>
              <div class="empty-state" *ngIf="(filteredEmployees$ | async)?.length === 0">
                <mat-icon>people_outline</mat-icon>
                <p>従業員が見つかりません</p>
              </div>
            </div>
          </div>

          <!-- 右カラム: 選択中従業員の情報 -->
          <div class="document-detail-column" *ngIf="selectedEmployee$ | async as employee">
            <div class="detail-header">
              <div class="employee-info">
                <h2>{{ employee.name }}</h2>
                <div class="employee-meta" *ngIf="employee.kana || employee.department">
                  <span *ngIf="employee.kana">{{ employee.kana }}</span>
                  <span *ngIf="employee.department">{{ employee.department }}</span>
                </div>
              </div>
              <div class="header-actions">
                <button
                  mat-raised-button
                  color="primary"
                  (click)="openRequestDialog(employee.id)"
                >
                  <mat-icon>mail</mat-icon>
                  書類アップロードを依頼
                </button>
                <button
                  mat-raised-button
                  color="accent"
                  (click)="openUploadDialog(employee.id)"
                >
                  <mat-icon>upload</mat-icon>
                  管理者として書類をアップロード
                </button>
              </div>
            </div>

            <mat-tab-group class="document-tabs">
              <!-- タブ1: 添付書類一覧 -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <mat-icon class="tab-icon">attach_file</mat-icon>
                  <span>添付書類</span>
                </ng-template>
                <div class="tab-content">
                  <div class="tab-filters">
                    <mat-form-field appearance="outline" class="filter-field">
                      <mat-label>カテゴリ</mat-label>
                      <mat-select
                        [value]="selectedCategory$.value"
                        (selectionChange)="selectedCategory$.next($event.value)"
                      >
                        <mat-option value="">すべて</mat-option>
                        <mat-option *ngFor="let cat of categories" [value]="cat">
                          {{ getCategoryLabel(cat) }}
                        </mat-option>
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="filter-field">
                      <mat-label>有効期限</mat-label>
                      <mat-select
                        [value]="selectedExpiryFilter$.value"
                        (selectionChange)="selectedExpiryFilter$.next($event.value)"
                      >
                        <mat-option value="all">すべて</mat-option>
                        <mat-option value="expired">期限切れ</mat-option>
                        <mat-option value="expiring_soon">30日以内に期限切れ</mat-option>
                        <mat-option value="valid">有効期限内</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>

                  <div class="table-container">
                    <table
                      mat-table
                      [dataSource]="(filteredAttachments$ | async) ?? []"
                      class="documents-table"
                    >
                      <ng-container matColumnDef="category">
                        <th mat-header-cell *matHeaderCellDef>書類種別</th>
                        <td mat-cell *matCellDef="let row">
                          {{ getCategoryLabel(row.category) }}
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="title">
                        <th mat-header-cell *matHeaderCellDef>タイトル</th>
                        <td mat-cell *matCellDef="let row">{{ row.title }}</td>
                      </ng-container>

                      <ng-container matColumnDef="uploadedAt">
                        <th mat-header-cell *matHeaderCellDef>アップロード日</th>
                        <td mat-cell *matCellDef="let row">
                          {{ row.uploadedAt | date: 'yyyy-MM-dd' }}
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="uploadedBy">
                        <th mat-header-cell *matHeaderCellDef>アップロード者</th>
                        <td mat-cell *matCellDef="let row">{{ row.uploadedByDisplayName }}</td>
                      </ng-container>

                      <ng-container matColumnDef="expiresAt">
                        <th mat-header-cell *matHeaderCellDef>有効期限</th>
                        <td mat-cell *matCellDef="let row">
                          <span *ngIf="row.expiresAt">
                            {{ row.expiresAt | date: 'yyyy-MM-dd' }}
                            <mat-icon
                              class="warning-icon"
                              *ngIf="isExpiringSoon(row.expiresAt)"
                              title="期限が近い"
                            >
                              warning
                            </mat-icon>
                          </span>
                          <span *ngIf="!row.expiresAt">-</span>
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef class="actions-header">操作</th>
                        <td mat-cell *matCellDef="let row" class="actions-cell">
                          <button
                            mat-icon-button
                            color="primary"
                            (click)="downloadDocument(row)"
                            title="ダウンロード"
                          >
                            <mat-icon>download</mat-icon>
                          </button>
                          <button
                            mat-icon-button
                            color="primary"
                            (click)="previewDocument(row)"
                            title="プレビュー"
                          >
                            <mat-icon>visibility</mat-icon>
                          </button>
                          <button
                            mat-icon-button
                            color="warn"
                            (click)="deleteDocument(row)"
                            title="削除"
                          >
                            <mat-icon>delete</mat-icon>
                          </button>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="attachmentColumns" class="table-header-row"></tr>
                      <tr mat-row *matRowDef="let row; columns: attachmentColumns" class="table-row"></tr>
                    </table>
                    <div class="empty-state" *ngIf="(filteredAttachments$ | async)?.length === 0">
                      <mat-icon>inbox</mat-icon>
                      <p>書類が登録されていません</p>
                    </div>
                  </div>
                </div>
              </mat-tab>

              <!-- タブ2: 書類アップロード依頼一覧 -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <mat-icon class="tab-icon">mail</mat-icon>
                  <span>アップロード依頼</span>
                </ng-template>
                <div class="tab-content">
                  <div class="tab-filters">
                    <mat-form-field appearance="outline" class="filter-field">
                      <mat-label>ステータス</mat-label>
                      <mat-select
                        [value]="selectedRequestStatus$.value"
                        (selectionChange)="selectedRequestStatus$.next($event.value)"
                      >
                        <mat-option value="">すべて</mat-option>
                        <mat-option value="pending">アップロード待ち</mat-option>
                        <mat-option value="uploaded">アップロード済み</mat-option>
                        <mat-option value="cancelled">キャンセル済み</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>

                  <div class="table-container">
                    <table
                      mat-table
                      [dataSource]="(filteredRequests$ | async) ?? []"
                      class="requests-table"
                    >
                      <ng-container matColumnDef="category">
                        <th mat-header-cell *matHeaderCellDef>カテゴリ</th>
                        <td mat-cell *matCellDef="let row">
                          {{ getCategoryLabel(row.category) }}
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="title">
                        <th mat-header-cell *matHeaderCellDef>タイトル</th>
                        <td mat-cell *matCellDef="let row">{{ row.title }}</td>
                      </ng-container>

                      <ng-container matColumnDef="createdAt">
                        <th mat-header-cell *matHeaderCellDef>依頼日</th>
                        <td mat-cell *matCellDef="let row">
                          {{ row.createdAt | date: 'yyyy-MM-dd' }}
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="requestedBy">
                        <th mat-header-cell *matHeaderCellDef>依頼者</th>
                        <td mat-cell *matCellDef="let row">{{ row.requestedByDisplayName }}</td>
                      </ng-container>

                      <ng-container matColumnDef="dueDate">
                        <th mat-header-cell *matHeaderCellDef>締め切り日</th>
                        <td mat-cell *matCellDef="let row">
                          <span *ngIf="row.dueDate">
                            {{ row.dueDate | date: 'yyyy-MM-dd' }}
                          </span>
                          <span *ngIf="!row.dueDate">-</span>
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="status">
                        <th mat-header-cell *matHeaderCellDef>ステータス</th>
                        <td mat-cell *matCellDef="let row">
                          {{ getStatusLabel(row.status) }}
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="resolvedAt">
                        <th mat-header-cell *matHeaderCellDef>解決日</th>
                        <td mat-cell *matCellDef="let row">
                          <span *ngIf="row.resolvedAt">
                            {{ row.resolvedAt | date: 'yyyy-MM-dd' }}
                          </span>
                          <span *ngIf="!row.resolvedAt">-</span>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="requestColumns" class="table-header-row"></tr>
                      <tr mat-row *matRowDef="let row; columns: requestColumns" class="table-row"></tr>
                    </table>
                    <div class="empty-state" *ngIf="(filteredRequests$ | async)?.length === 0">
                      <mat-icon>inbox</mat-icon>
                      <p>依頼がありません</p>
                    </div>
                  </div>
                </div>
              </mat-tab>
            </mat-tab-group>
          </div>

          <div class="no-selection" *ngIf="!(selectedEmployee$ | async)">
            <mat-icon>person_outline</mat-icon>
            <p>左側から従業員を選択してください</p>
          </div>
        </div>
      </mat-card>

      <ng-template #noOffice>
        <mat-card class="content-card">
          <div class="empty-office-state">
            <mat-icon>business</mat-icon>
            <h3>事業所が未設定です</h3>
            <p>まずは所属事業所を設定してください。</p>
          </div>
        </mat-card>
      </ng-template>
    </section>
  `,
  styles: [
    `
      .documents-layout {
        display: flex;
        gap: 1.5rem;
        min-height: 600px;
      }

      .employee-list-column {
        width: 300px;
        border-right: 1px solid #e0e0e0;
        padding-right: 1.5rem;
      }

      .employee-list-header {
        margin-bottom: 1rem;
      }

      .employee-list-header h2 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
        font-size: 1.25rem;
      }

      .search-field {
        width: 100%;
      }

      .employee-list-content {
        max-height: 600px;
        overflow-y: auto;
      }

      .employee-item {
        padding: 1rem;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        margin-bottom: 0.5rem;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .employee-item:hover {
        background-color: #f5f5f5;
      }

      .employee-item.selected {
        background-color: #e3f2fd;
        border-color: #2196f3;
      }

      .employee-name {
        font-weight: 600;
        margin-bottom: 0.25rem;
      }

      .employee-details {
        display: flex;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #666;
      }

      .detail-item {
        padding: 0.25rem 0.5rem;
        background-color: #f5f5f5;
        border-radius: 4px;
      }

      .document-detail-column {
        flex: 1;
      }

      .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #e0e0e0;
      }

      .employee-info h2 {
        margin: 0 0 0.5rem 0;
      }

      .employee-meta {
        display: flex;
        gap: 1rem;
        color: #666;
        font-size: 0.875rem;
      }

      .header-actions {
        display: flex;
        gap: 0.5rem;
      }

      .document-tabs {
        margin-top: 1rem;
      }

      .tab-content {
        padding: 1rem 0;
      }

      .tab-filters {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .filter-field {
        min-width: 200px;
      }

      .table-container {
        overflow-x: auto;
      }

      .documents-table,
      .requests-table {
        width: 100%;
      }

      .warning-icon {
        color: #ff9800;
        font-size: 18px;
        width: 18px;
        height: 18px;
        vertical-align: middle;
        margin-left: 0.25rem;
      }

      .actions-header,
      .actions-cell {
        text-align: center;
        width: 150px;
      }

      .empty-state {
        text-align: center;
        padding: 3rem 1rem;
        color: #999;
      }

      .empty-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 1rem;
        color: #ccc;
      }

      .no-selection {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #999;
        min-height: 400px;
      }

      .no-selection mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 1rem;
        color: #ccc;
      }

      .empty-office-state {
        text-align: center;
        padding: 3rem 1rem;
        color: #999;
      }

      .empty-office-state mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 1rem;
        color: #ccc;
      }
    `
  ]
})
export class DocumentsPage {
  private readonly documentsService = inject(DocumentsService);
  private readonly employeesService = inject(EmployeesService);
  private readonly storageService = inject(StorageService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly officeId$ = this.currentOffice.office$.pipe(map((office) => office?.id));
  readonly employees$ = this.officeId$.pipe(
    switchMap((officeId) => (officeId ? this.employeesService.list(officeId) : of([])))
  );

  readonly selectedEmployeeId$ = new BehaviorSubject<string | null>(null);
  readonly searchQuery$ = new BehaviorSubject<string>('');
  readonly selectedCategory$ = new BehaviorSubject<DocumentCategory | ''>('');
  readonly selectedExpiryFilter$ = new BehaviorSubject<'all' | 'expired' | 'expiring_soon' | 'valid'>('all');
  readonly selectedRequestStatus$ = new BehaviorSubject<DocumentRequestStatus | ''>('');

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

  readonly attachmentColumns = ['category', 'title', 'uploadedAt', 'uploadedBy', 'expiresAt', 'actions'];
  readonly requestColumns = ['category', 'title', 'createdAt', 'requestedBy', 'dueDate', 'status', 'resolvedAt'];

  readonly filteredEmployees$ = combineLatest([this.employees$, this.searchQuery$]).pipe(
    map(([employees, query]) => {
      if (!query) return employees;
      const lowerQuery = query.toLowerCase();
      return employees.filter(
        (emp) =>
          emp.name.toLowerCase().includes(lowerQuery) ||
          (emp.kana && emp.kana.toLowerCase().includes(lowerQuery))
      );
    })
  );

  readonly selectedEmployee$ = combineLatest([this.employees$, this.selectedEmployeeId$]).pipe(
    map(([employees, selectedId]) => {
      if (!selectedId) return null;
      return employees.find((emp) => emp.id === selectedId) || null;
    })
  );

  readonly attachments$ = combineLatest([this.officeId$, this.selectedEmployeeId$]).pipe(
    switchMap(([officeId, employeeId]) => {
      if (!officeId || !employeeId) return of([]);
      return this.documentsService.listAttachments(officeId, employeeId);
    })
  );

  readonly filteredAttachments$ = combineLatest([
    this.attachments$,
    this.selectedCategory$,
    this.selectedExpiryFilter$
  ]).pipe(
    map(([attachments, category, expiryFilter]) => {
      let filtered = attachments;

      if (category) {
        filtered = filtered.filter((att) => att.category === category);
      }

      if (expiryFilter !== 'all') {
        const now = new Date();
        const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        filtered = filtered.filter((att) => {
          if (!att.expiresAt) {
            return expiryFilter === 'valid';
          }
          const expiresAt = new Date(att.expiresAt);

          switch (expiryFilter) {
            case 'expired':
              return expiresAt < now;
            case 'expiring_soon':
              return expiresAt >= now && expiresAt <= thirtyDaysLater;
            case 'valid':
              return expiresAt > thirtyDaysLater;
            default:
              return true;
          }
        });
      }

      return filtered;
    })
  );

  readonly requests$ = combineLatest([this.officeId$, this.selectedEmployeeId$]).pipe(
    switchMap(([officeId, employeeId]) => {
      if (!officeId || !employeeId) return of([]);
      return this.documentsService.listRequests(officeId, employeeId);
    })
  );

  readonly filteredRequests$ = combineLatest([this.requests$, this.selectedRequestStatus$]).pipe(
    map(([requests, status]) => {
      if (!status) return requests;
      return requests.filter((req) => req.status === status);
    })
  );

  selectEmployee(employeeId: string): void {
    this.selectedEmployeeId$.next(employeeId);
  }

  getCategoryLabel(category: DocumentCategory): string {
    return getDocumentCategoryLabel(category);
  }

  getStatusLabel(status: DocumentRequestStatus): string {
    return getDocumentRequestStatusLabel(status);
  }

  isExpiringSoon(expiresAt: string): boolean {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiry >= now && expiry <= thirtyDaysLater;
  }

  async openRequestDialog(employeeId: string): Promise<void> {
    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) return;

    const dialogRef = this.dialog.open(DocumentRequestFormDialogComponent, {
      width: '600px',
      data: { officeId, employeeId }
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result) {
      this.snackBar.open('書類アップロード依頼を作成しました', '閉じる', { duration: 3000 });
    }
  }

  async openUploadDialog(employeeId: string): Promise<void> {
    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) return;

    const dialogRef = this.dialog.open(DocumentUploadFormDialogComponent, {
      width: '600px',
      data: { officeId, employeeId }
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result) {
      this.snackBar.open('書類をアップロードしました', '閉じる', { duration: 3000 });
    }
  }

  async downloadDocument(attachment: DocumentAttachment): Promise<void> {
    try {
      // getDownloadURL() で取得したURLから fetch でBlobを取得してダウンロード
      const url = await this.storageService.getDownloadUrl(attachment.storagePath);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      this.snackBar.open('ダウンロードに失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async previewDocument(attachment: DocumentAttachment): Promise<void> {
    try {
      const url = await this.storageService.getDownloadUrl(attachment.storagePath);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Preview failed:', error);
      this.snackBar.open('プレビューに失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async deleteDocument(attachment: DocumentAttachment): Promise<void> {
    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: '書類の削除',
        message: `「${attachment.title}」を削除しますか？この操作は取り消せません。`,
        confirmText: '削除',
        cancelText: 'キャンセル'
      }
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

    try {
      await this.documentsService.deleteAttachment(officeId, attachment.id);
      this.snackBar.open('書類を削除しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error('Delete failed:', error);
      this.snackBar.open('削除に失敗しました', '閉じる', { duration: 3000 });
    }
  }
}

