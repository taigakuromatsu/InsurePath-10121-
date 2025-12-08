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
    <div class="page-container">
      <header class="page-header">
        <div>
          <h1>書類管理</h1>
          <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">
            従業員ごとの添付書類を管理し、書類アップロード依頼を作成できます。
          </p>
        </div>
      </header>

      <mat-card class="content-card" *ngIf="officeId$ | async as officeId; else noOffice">
        <div class="documents-layout">
          <!-- 左カラム: 従業員一覧 -->
          <div class="employee-list-column">
            <div class="employee-list-header">
              <h2 class="mat-h3 flex-row align-center gap-2">
                <mat-icon color="primary">people</mat-icon>
                従業員一覧
              </h2>
              <mat-form-field appearance="outline" class="search-field dense-form-field">
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
              <div class="empty-state-simple" *ngIf="(filteredEmployees$ | async)?.length === 0">
                <mat-icon>people_outline</mat-icon>
                <p>従業員が見つかりません</p>
              </div>
            </div>
          </div>

          <!-- 右カラム: 選択中従業員の情報 -->
          <div class="document-detail-column" *ngIf="selectedEmployee$ | async as employee">
            <div class="detail-header flex-row justify-between align-center mb-3">
              <div class="employee-info">
                <h2 class="mat-h2 m-0">{{ employee.name }}</h2>
                <div class="employee-meta flex-row gap-2 mt-1" *ngIf="employee.kana || employee.department">
                  <span *ngIf="employee.kana">{{ employee.kana }}</span>
                  <span *ngIf="employee.department" class="separator">|</span>
                  <span *ngIf="employee.department">{{ employee.department }}</span>
                </div>
              </div>
              <div class="header-actions flex-row gap-2">
                <button
                  mat-stroked-button
                  color="primary"
                  (click)="openRequestDialog(employee.id)"
                >
                  <mat-icon>mail</mat-icon>
                  書類アップロードを依頼
                </button>
                <button
                  mat-flat-button
                  color="primary"
                  (click)="openUploadDialog(employee.id)"
                >
                  <mat-icon>upload</mat-icon>
                  管理者として書類をアップロード
                </button>
              </div>
            </div>

            <mat-tab-group class="document-tabs" animationDuration="0ms">
              <!-- タブ1: 添付書類一覧 -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <mat-icon class="tab-icon mr-2">attach_file</mat-icon>
                  <span>添付書類</span>
                </ng-template>
                <div class="tab-content">
                  <div class="tab-filters flex-row gap-3 mb-3 align-center">
                    <mat-form-field appearance="outline" class="filter-field dense-form-field">
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
                    <mat-form-field appearance="outline" class="filter-field dense-form-field">
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
                      class="admin-table"
                    >
                      <ng-container matColumnDef="category">
                        <th mat-header-cell *matHeaderCellDef style="width: 140px;">書類種別</th>
                        <td mat-cell *matCellDef="let row">
                          <span class="category-badge">{{ getCategoryLabel(row.category) }}</span>
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="title">
                        <th mat-header-cell *matHeaderCellDef>タイトル</th>
                        <td mat-cell *matCellDef="let row" class="font-medium">{{ row.title }}</td>
                      </ng-container>

                      <ng-container matColumnDef="uploadedAt">
                        <th mat-header-cell *matHeaderCellDef style="width: 120px;">アップロード日</th>
                        <td mat-cell *matCellDef="let row">
                          {{ row.uploadedAt | date: 'yyyy-MM-dd' }}
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="uploadedBy">
                        <th mat-header-cell *matHeaderCellDef style="width: 140px;">アップロード者</th>
                        <td mat-cell *matCellDef="let row">{{ row.uploadedByDisplayName }}</td>
                      </ng-container>

                      <ng-container matColumnDef="expiresAt">
                        <th mat-header-cell *matHeaderCellDef style="width: 140px;">有効期限</th>
                        <td mat-cell *matCellDef="let row">
                          <span *ngIf="row.expiresAt" [class.text-warn]="isExpiringSoon(row.expiresAt)">
                            {{ row.expiresAt | date: 'yyyy-MM-dd' }}
                            <mat-icon
                              class="warning-icon"
                              *ngIf="isExpiringSoon(row.expiresAt)"
                              title="期限が近い"
                            >
                              warning
                            </mat-icon>
                          </span>
                          <span *ngIf="!row.expiresAt" class="text-muted">-</span>
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef class="actions-header" style="width: 160px; text-align: center;">操作</th>
                        <td mat-cell *matCellDef="let row" class="actions-cell">
                          <div class="flex-row justify-center gap-1">
                            <button
                              mat-icon-button
                              color="primary"
                              (click)="downloadDocument(row)"
                              matTooltip="ダウンロード"
                            >
                              <mat-icon>download</mat-icon>
                            </button>
                            <button
                              mat-icon-button
                              color="primary"
                              (click)="previewDocument(row)"
                              matTooltip="プレビュー"
                            >
                              <mat-icon>visibility</mat-icon>
                            </button>
                            <button
                              mat-icon-button
                              color="warn"
                              (click)="deleteDocument(row)"
                              matTooltip="削除"
                            >
                              <mat-icon>delete</mat-icon>
                            </button>
                          </div>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="attachmentColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: attachmentColumns"></tr>
                    </table>
                    <div class="empty-state-simple" *ngIf="(filteredAttachments$ | async)?.length === 0">
                      <mat-icon>inbox</mat-icon>
                      <p>書類が登録されていません</p>
                    </div>
                  </div>
                </div>
              </mat-tab>

              <!-- タブ2: 書類アップロード依頼一覧 -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <mat-icon class="tab-icon mr-2">mail</mat-icon>
                  <span>アップロード依頼</span>
                </ng-template>
                <div class="tab-content">
                  <div class="tab-filters flex-row gap-3 mb-3 align-center">
                    <mat-form-field appearance="outline" class="filter-field dense-form-field">
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
                      class="admin-table"
                    >
                      <ng-container matColumnDef="category">
                        <th mat-header-cell *matHeaderCellDef style="width: 140px;">カテゴリ</th>
                        <td mat-cell *matCellDef="let row">
                          <span class="category-badge">{{ getCategoryLabel(row.category) }}</span>
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="title">
                        <th mat-header-cell *matHeaderCellDef>タイトル</th>
                        <td mat-cell *matCellDef="let row" class="font-medium">{{ row.title }}</td>
                      </ng-container>

                      <ng-container matColumnDef="createdAt">
                        <th mat-header-cell *matHeaderCellDef style="width: 120px;">依頼日</th>
                        <td mat-cell *matCellDef="let row">
                          {{ row.createdAt | date: 'yyyy-MM-dd' }}
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="requestedBy">
                        <th mat-header-cell *matHeaderCellDef style="width: 140px;">依頼者</th>
                        <td mat-cell *matCellDef="let row">{{ row.requestedByDisplayName }}</td>
                      </ng-container>

                      <ng-container matColumnDef="dueDate">
                        <th mat-header-cell *matHeaderCellDef style="width: 120px;">締め切り日</th>
                        <td mat-cell *matCellDef="let row">
                          <span *ngIf="row.dueDate">
                            {{ row.dueDate | date: 'yyyy-MM-dd' }}
                          </span>
                          <span *ngIf="!row.dueDate" class="text-muted">-</span>
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="status">
                        <th mat-header-cell *matHeaderCellDef style="width: 140px;">ステータス</th>
                        <td mat-cell *matCellDef="let row">
                          <span class="status-chip" [class]="'status-' + row.status">
                            {{ getStatusLabel(row.status) }}
                          </span>
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="resolvedAt">
                        <th mat-header-cell *matHeaderCellDef style="width: 120px;">解決日</th>
                        <td mat-cell *matCellDef="let row">
                          <span *ngIf="row.resolvedAt">
                            {{ row.resolvedAt | date: 'yyyy-MM-dd' }}
                          </span>
                          <span *ngIf="!row.resolvedAt" class="text-muted">-</span>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="requestColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: requestColumns"></tr>
                    </table>
                    <div class="empty-state-simple" *ngIf="(filteredRequests$ | async)?.length === 0">
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
          <div class="empty-state">
            <mat-icon>business</mat-icon>
            <p class="text-lg font-medium mb-2">事業所が未設定です</p>
            <p>まずは所属事業所を設定してください。</p>
          </div>
        </mat-card>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 1366px;
        margin: 0 auto;
        padding: 24px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 24px;

        @media (max-width: 600px) {
          padding: 16px;
          gap: 16px;
        }
      }

      .content-card {
        padding: 24px;
        border-radius: 8px;
      }

      .m-0 { margin: 0; }
      .mt-1 { margin-top: 4px; }
      .mb-2 { margin-bottom: 8px; }
      .mb-3 { margin-bottom: 16px; }
      .mr-2 { margin-right: 8px; }
      
      .flex-row { display: flex; flex-direction: row; }
      .align-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .justify-center { justify-content: center; }
      .gap-1 { gap: 4px; }
      .gap-2 { gap: 8px; }
      .gap-3 { gap: 16px; }

      .text-muted { color: #999; }
      .text-warn { color: #f44336; }
      .font-medium { font-weight: 500; }

      .documents-layout {
        display: flex;
        gap: 24px;
        min-height: 600px;
        align-items: flex-start;
        flex-wrap: wrap;
      }

      /* 左カラム: 従業員一覧 */
      .employee-list-column {
        width: 300px;
        padding: 16px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        background: #fafafa;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
      }

      .employee-list-header {
        margin-bottom: 16px;
      }

      .dense-form-field {
        width: 100%;
        font-size: 14px;
      }

      .employee-list-content {
        flex: 1;
        overflow-y: auto;
      }

      .employee-item {
        padding: 12px;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
        background: #fff;
      }

      .employee-item:hover {
        background-color: #fafafa;
        border-color: #bdbdbd;
      }

      .employee-item.selected {
        background-color: #e3f2fd;
        border-color: #2196f3;
      }

      .employee-name {
        font-weight: 600;
        margin-bottom: 4px;
        font-size: 14px;
      }

      .employee-details {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        font-size: 12px;
        color: #666;
      }

      .detail-item {
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 4px;
      }

      /* 右カラム: 詳細 */
      .document-detail-column {
        flex: 1;
        min-width: 0; /* Flexboxの子要素がはみ出さないように */
      }

      .detail-header {
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 16px;
      }

      .employee-meta {
        color: #666;
        font-size: 14px;
      }

      .separator {
        color: #ccc;
      }

      .tab-content {
        padding-top: 16px;
      }

      .filter-field {
        min-width: 180px;
      }

      .table-container {
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
        background: #fff;
      }

      .category-badge {
        display: inline-block;
        padding: 2px 8px;
        background-color: #e3f2fd;
        color: #1976d2;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
      }

      .warning-icon {
        color: #ff9800;
        font-size: 16px;
        width: 16px;
        height: 16px;
        vertical-align: text-bottom;
        margin-left: 4px;
      }

      .status-chip {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
      }

      .status-pending { background: #fffbeb; color: #92400e; }
      .status-uploaded { background: #ecfdf3; color: #166534; }
      .status-cancelled { background: #f3f4f6; color: #4b5563; }

      .empty-state-simple {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 32px;
        color: #999;
        
        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
          margin-bottom: 8px;
          opacity: 0.5;
        }
        p { margin: 0; font-size: 13px; }
      }

      .no-selection {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #999;
        background: #fafafa;
        border-radius: 8px;
        border: 1px dashed #e0e0e0;
        min-height: 420px;
      }

      .no-selection mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.3;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px 24px;
        text-align: center;
        color: #999;
        
        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          margin-bottom: 16px;
          opacity: 0.3;
        }
      }

      @media (max-width: 960px) {
        .documents-layout {
          flex-direction: column;
        }
        .employee-list-column {
          width: 100%;
          padding: 12px;
        }
        .document-detail-column {
          width: 100%;
        }
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

