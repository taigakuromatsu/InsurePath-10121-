import { AsyncPipe, DatePipe, NgIf, NgForOf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, firstValueFrom, map, of, switchMap, take, Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DependentReviewsService } from '../../services/dependent-reviews.service';
import { DependentReviewSessionsService } from '../../services/dependent-review-sessions.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { EmployeesService } from '../../services/employees.service';
import { DependentsService } from '../../services/dependents.service';
import { DependentReviewResult, DependentReview, Dependent, DependentReviewSession } from '../../types';
import { ReviewFormDialogComponent } from './review-form-dialog.component';
import { SessionFormDialogComponent } from './session-form-dialog.component';

interface DependentWithReview extends Dependent {
  employeeId: string;
  employeeName: string;
  latestReview?: DependentReview;
}

@Component({
  selector: 'ip-dependent-reviews-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatButtonToggleModule,
    MatTooltipModule,
    AsyncPipe,
    NgForOf,
    NgIf,
    DatePipe
  ],
  template: `
    <section class="page">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>family_restroom</mat-icon>
          </div>
          <div class="header-text">
            <h1>扶養状況確認・年次見直し</h1>
            <p>被扶養者の年次見直しや「被扶養者状況リスト」への回答作業を支援します。</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="card-header">
          <h2>基準年月日時点での被扶養者抽出</h2>
          <div class="extraction-controls">
            <mat-form-field appearance="outline">
              <mat-label>基準年月日</mat-label>
              <input matInput type="date" [value]="referenceDate" (change)="referenceDate = $any($event.target).value" />
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="extractDependents()">
              <mat-icon>search</mat-icon>
              抽出
            </button>
          </div>
        </div>

        <div *ngIf="extractedDependents$ | async as dependents; else noExtraction">
          <div class="table-container" *ngIf="dependents && dependents.length > 0; else empty">
            <table mat-table [dataSource]="dependents" class="dependents-table">
              <!-- 行番号列 -->
              <ng-container matColumnDef="index">
                <th mat-header-cell *matHeaderCellDef>No.</th>
                <td mat-cell *matCellDef="let row; let i = index">{{ i + 1 }}</td>
              </ng-container>

              <!-- 被保険者名列 -->
              <ng-container matColumnDef="employeeName">
                <th mat-header-cell *matHeaderCellDef>被保険者名</th>
                <td mat-cell *matCellDef="let row">{{ row.employeeName }}</td>
              </ng-container>

              <!-- 被扶養者名列 -->
              <ng-container matColumnDef="dependentName">
                <th mat-header-cell *matHeaderCellDef>被扶養者名</th>
                <td mat-cell *matCellDef="let row">{{ row.name }}</td>
              </ng-container>

              <!-- 続柄列 -->
              <ng-container matColumnDef="relationship">
                <th mat-header-cell *matHeaderCellDef>続柄</th>
                <td mat-cell *matCellDef="let row">{{ getRelationshipLabel(row.relationship) }}</td>
              </ng-container>

              <!-- 生年月日列 -->
              <ng-container matColumnDef="dateOfBirth">
                <th mat-header-cell *matHeaderCellDef>生年月日</th>
                <td mat-cell *matCellDef="let row">{{ row.dateOfBirth | date: 'yyyy-MM-dd' }}</td>
              </ng-container>

              <!-- 資格取得日列 -->
              <ng-container matColumnDef="qualificationAcquiredDate">
                <th mat-header-cell *matHeaderCellDef>資格取得日</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.qualificationAcquiredDate ? (row.qualificationAcquiredDate | date: 'yyyy-MM-dd') : '-' }}
                </td>
              </ng-container>

              <!-- 資格喪失日列 -->
              <ng-container matColumnDef="qualificationLossDate">
                <th mat-header-cell *matHeaderCellDef>資格喪失日</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.qualificationLossDate ? (row.qualificationLossDate | date: 'yyyy-MM-dd') : '-' }}
                </td>
              </ng-container>

              <!-- 確認結果列（インライン操作） -->
              <ng-container matColumnDef="result">
                <th mat-header-cell *matHeaderCellDef class="result-header">確認区分（継続／削除予定／要確認）</th>
                <td mat-cell *matCellDef="let row" class="result-cell">
                  <mat-button-toggle-group
                    [value]="row.latestReview?.result || null"
                    (change)="onQuickResultChange(row, $event.value)"
                    [disabled]="!row.latestReview && !referenceDate"
                  >
                    <mat-button-toggle value="continued">継続</mat-button-toggle>
                    <mat-button-toggle value="to_be_removed">削除予定</mat-button-toggle>
                    <mat-button-toggle value="needs_review">要確認</mat-button-toggle>
                  </mat-button-toggle-group>
                  <span *ngIf="!row.latestReview && !referenceDate" class="no-review">未確認</span>
                </td>
              </ng-container>

              <!-- 備考列 -->
              <ng-container matColumnDef="note">
                <th mat-header-cell *matHeaderCellDef>備考</th>
                <td mat-cell *matCellDef="let row" class="note-cell">
                  <ng-container *ngIf="row.latestReview?.note; else noNote">
                    <button mat-icon-button matTooltip="{{ row.latestReview.note }}" (click)="openEditDialog(row.latestReview!)">
                      <mat-icon>notes</mat-icon>
                    </button>
                    <span>メモあり</span>
                  </ng-container>
                  <ng-template #noNote>
                    <span class="no-note">-</span>
                  </ng-template>
                </td>
              </ng-container>

              <!-- アクション列 -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-header">操作</th>
                <td mat-cell *matCellDef="let row" class="actions-cell">
                  <button mat-icon-button (click)="openReviewDialog(row)" aria-label="確認結果を登録">
                    <mat-icon>edit</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
          <ng-template #empty>
            <div class="empty-state">
              <mat-icon>inbox</mat-icon>
              <p>基準年月日時点で扶養に入っている被扶養者はありません。</p>
            </div>
          </ng-template>
        </div>

        <ng-template #noExtraction>
          <div class="empty-state">
            <mat-icon>info</mat-icon>
            <p>基準年月日を選択して「抽出」ボタンをクリックしてください。</p>
          </div>
        </ng-template>
      </mat-card>

      <mat-card class="content-card">
        <div class="card-header">
          <h2>確認結果一覧</h2>
          <div class="filters">
            <div class="session-controls">
              <mat-form-field appearance="outline" class="filter-select session-select">
                <mat-label>セッション</mat-label>
                <mat-select [value]="selectedSessionId$.value" (selectionChange)="selectedSessionId$.next($event.value || null)">
                  <mat-option [value]="null">すべての確認結果</mat-option>
                  <mat-option *ngFor="let session of sessions$ | async" [value]="session.id">
                    {{ formatSessionLabel(session) }}
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <button mat-stroked-button type="button" color="primary" (click)="openCreateSessionDialog()">
                <mat-icon>event_available</mat-icon>
                セッションを作成
              </button>
            </div>
            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>確認結果</mat-label>
              <mat-select [value]="resultFilter$.value" (selectionChange)="resultFilter$.next($event.value)">
                <mat-option value="all">すべて</mat-option>
                <mat-option value="continued">継続</mat-option>
                <mat-option value="to_be_removed">削除予定</mat-option>
                <mat-option value="needs_review">要確認</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <button mat-flat-button color="primary" (click)="openCreateDialog()">
            <mat-icon>add</mat-icon>
            確認結果を登録
          </button>
        </div>

        <div *ngIf="reviewsViewModel$ | async as reviewsViewModel; else loading">
          <div class="table-container" *ngIf="reviewsViewModel.length > 0; else emptyReviews">
            <table mat-table [dataSource]="reviewsViewModel" class="reviews-table">
              <!-- 確認日列 -->
              <ng-container matColumnDef="reviewDate">
                <th mat-header-cell *matHeaderCellDef>確認日</th>
                <td mat-cell *matCellDef="let row">{{ row.review.reviewDate | date: 'yyyy-MM-dd' }}</td>
              </ng-container>

              <!-- 従業員名列 -->
              <ng-container matColumnDef="employeeName">
                <th mat-header-cell *matHeaderCellDef>従業員名</th>
                <td mat-cell *matCellDef="let row">{{ row.employeeName }}</td>
              </ng-container>

              <!-- 被扶養者名列 -->
              <ng-container matColumnDef="dependentName">
                <th mat-header-cell *matHeaderCellDef>被扶養者名</th>
                <td mat-cell *matCellDef="let row">{{ row.dependentName }}</td>
              </ng-container>

              <!-- 確認結果列 -->
              <ng-container matColumnDef="result">
                <th mat-header-cell *matHeaderCellDef>確認結果</th>
                <td mat-cell *matCellDef="let row">
                  <span [class]="'review-chip review-' + row.review.result">
                    {{ getReviewResultLabel(row.review.result) }}
                  </span>
                </td>
              </ng-container>

              <!-- 確認担当者列 -->
              <ng-container matColumnDef="reviewedBy">
                <th mat-header-cell *matHeaderCellDef>確認担当者</th>
                <td mat-cell *matCellDef="let row">{{ row.review.reviewedBy || '-' }}</td>
              </ng-container>

              <!-- 備考列 -->
              <ng-container matColumnDef="note">
                <th mat-header-cell *matHeaderCellDef>備考</th>
                <td mat-cell *matCellDef="let row">{{ row.review.note || '-' }}</td>
              </ng-container>

              <!-- アクション列 -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-header">アクション</th>
                <td mat-cell *matCellDef="let row" class="actions-cell">
                  <button mat-icon-button (click)="openEditDialog(row.review)" aria-label="編集">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteReview(row.review)" aria-label="削除">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="reviewDisplayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: reviewDisplayedColumns"></tr>
            </table>
          </div>
          <ng-template #emptyReviews>
            <div class="empty-state">
              <mat-icon>inbox</mat-icon>
              <p>確認結果はありません。</p>
            </div>
          </ng-template>
        </div>

        <ng-template #loading>
          <div class="empty-state">
            <mat-icon>hourglass_empty</mat-icon>
            <p>読み込み中...</p>
          </div>
        </ng-template>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .header-card {
        margin-bottom: 1rem;
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .header-icon {
        width: 56px;
        height: 56px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: #e0e7ff;
        color: #4338ca;
      }

      .header-text h1 {
        margin: 0;
        font-size: 1.5rem;
      }

      .header-text p {
        margin: 0;
        color: #4b5563;
      }

      .content-card {
        padding: 1.5rem;
        margin-bottom: 1rem;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }

      .extraction-controls {
        display: flex;
        gap: 1rem;
        align-items: center;
      }

      .filters {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .session-controls {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }

      .filter-select {
        width: 200px;
      }

      .session-select {
        min-width: 260px;
      }

      .table-container {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }

      .dependents-table {
        width: 100%;
      }

      .dependents-table th,
      .dependents-table td {
        padding: 8px 12px;
        font-size: 0.875rem;
      }

      .dependents-table th {
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        color: #374151;
        text-align: left;
      }

      .dependents-table td {
        border-bottom: 1px solid #f3f4f6;
      }

      .dependents-table .result-cell {
        text-align: center;
      }

      .dependents-table .no-review {
        color: #9ca3af;
        font-style: italic;
      }

      .dependents-table .note-cell {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      table {
        width: 100%;
      }

      th,
      td {
        padding: 12px 16px;
      }

      th {
        background: #f9fafb;
        color: #374151;
        text-align: left;
      }

      .actions-header,
      .actions-cell {
        text-align: center;
        width: 120px;
      }

      .empty-state {
        text-align: center;
        padding: 2rem 1rem;
        color: #6b7280;
      }

      .empty-state mat-icon {
        display: block;
        margin: 0 auto 0.5rem;
        color: #9ca3af;
        font-size: 48px;
        width: 48px;
        height: 48px;
      }

      .review-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.875rem;
      }

      .review-continued {
        background: #d1fae5;
        color: #065f46;
      }

      .review-to_be_removed {
        background: #fee2e2;
        color: #991b1b;
      }

      .review-needs_review {
        background: #fef3c7;
        color: #92400e;
      }

      .review-date {
        font-size: 0.75rem;
        margin-left: 0.5rem;
        opacity: 0.7;
      }

      .no-review {
        color: #9ca3af;
      }
    `
  ]
})
export class DependentReviewsPage {
  private readonly reviewsService = inject(DependentReviewsService);
  private readonly sessionsService = inject(DependentReviewSessionsService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly dialog = inject(MatDialog);
  private readonly employeesService = inject(EmployeesService);
  private readonly dependentsService = inject(DependentsService);

  // 扶養状況の抽出に使う基準年月日。初期値は「今日」の YYYY-MM-DD。
  referenceDate: string = new Date().toISOString().substring(0, 10);

  readonly resultFilter$ = new BehaviorSubject<DependentReviewResult | 'all'>('all');
  readonly selectedSessionId$ = new BehaviorSubject<string | null>(null);

  readonly displayedColumns: string[] = [
    'index',
    'employeeName',
    'dependentName',
    'relationship',
    'dateOfBirth',
    'qualificationAcquiredDate',
    'qualificationLossDate',
    'result',
    'note',
    'actions'
  ];

  readonly reviewDisplayedColumns: string[] = [
    'reviewDate',
    'employeeName',
    'dependentName',
    'result',
    'reviewedBy',
    'note',
    'actions'
  ];

  readonly employees$ = this.currentOffice.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) return of([]);
      return this.employeesService.list(officeId);
    })
  );

  readonly employeesMap$ = this.employees$.pipe(map((employees) => new Map(employees.map((emp) => [emp.id, emp]))));

  readonly dependentsMap$ = combineLatest([this.currentOffice.officeId$, this.employeesMap$]).pipe(
    switchMap(([officeId, employeesMap]) => {
      if (!officeId || employeesMap.size === 0) return of(new Map<string, Map<string, Dependent>>());

      const allDependents$: Observable<Dependent[]>[] = [];
      for (const employeeId of employeesMap.keys()) {
        allDependents$.push(this.dependentsService.list(officeId, employeeId));
      }

      if (allDependents$.length === 0) return of(new Map<string, Map<string, Dependent>>());

      return combineLatest(allDependents$).pipe(
        map((nestedDependents) => {
          const dependentsMap = new Map<string, Map<string, Dependent>>();
          let employeeIndex = 0;
          for (const employeeId of employeesMap.keys()) {
            dependentsMap.set(employeeId, new Map(nestedDependents[employeeIndex].map((dep) => [dep.id, dep])));
            employeeIndex++;
          }
          return dependentsMap;
        })
      );
    })
  );

  readonly sessions$ = this.currentOffice.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) return of([]);
      return this.sessionsService.list(officeId);
    })
  );

  readonly reviewsForExtraction$ = this.currentOffice.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) return of([]);
      return this.reviewsService.list(officeId);
    })
  );

  readonly reviews$ = combineLatest([
    this.currentOffice.officeId$,
    this.resultFilter$,
    this.selectedSessionId$
  ]).pipe(
    switchMap(([officeId, resultFilter, sessionId]) => {
      if (!officeId) return of([]);
      const filters: {
        result?: DependentReviewResult;
        sessionId?: string;
      } = {};
      if (resultFilter !== 'all') {
        filters.result = resultFilter;
      }
      if (sessionId) {
        filters.sessionId = sessionId;
      }
      return this.reviewsService.list(officeId, Object.keys(filters).length > 0 ? filters : undefined);
    })
  );

  readonly reviewsViewModel$ = combineLatest([this.reviews$, this.employeesMap$, this.dependentsMap$]).pipe(
    map(([reviews, employeesMap, dependentsMap]) => {
      return reviews.map((review) => {
        const employee = employeesMap.get(review.employeeId);
        const employeeDependents = dependentsMap.get(review.employeeId);
        const dependent = employeeDependents?.get(review.dependentId);
        return {
          review,
          employeeName: employee?.name ?? '不明な従業員',
          dependentName: dependent?.name ?? '不明な被扶養者'
        };
      });
    })
  );

  readonly extractedDependents$ = new BehaviorSubject<DependentWithReview[] | null>(null);

  extractDependents(): void {
    if (!this.referenceDate) {
      alert('基準年月日を選択してください');
      return;
    }

    combineLatest([this.employees$, this.dependentsMap$, this.reviewsForExtraction$])
      .pipe(
        take(1),
        map(([employees, dependentsMap, reviews]) => {
          const result: DependentWithReview[] = [];

          for (const employee of employees) {
            const employeeDependents = dependentsMap.get(employee.id);
            if (!employeeDependents) continue;

            for (const dependent of employeeDependents.values()) {
              const acquiredDate = dependent.qualificationAcquiredDate;
              const lossDate = dependent.qualificationLossDate;

              if (!acquiredDate) continue;
              if (acquiredDate > this.referenceDate) continue;
              if (lossDate && lossDate <= this.referenceDate) continue;

              // 基準日が指定されている場合は reviewDate <= referenceDate のものだけを対象
              const dependentReviews = reviews.filter(
                (r) =>
                  r.employeeId === employee.id &&
                  r.dependentId === dependent.id &&
                  (!this.referenceDate || r.reviewDate <= this.referenceDate)
              );
              const latestReview = dependentReviews.length > 0 ? dependentReviews[0] : undefined;

              result.push({
                ...dependent,
                employeeId: employee.id,
                employeeName: employee.name,
                latestReview
              });
            }
          }

          return result.sort((a, b) => {
            if (a.employeeName !== b.employeeName) {
              return a.employeeName.localeCompare(b.employeeName);
            }
            return a.name.localeCompare(b.name);
          });
        })
      )
      .subscribe((dependents) => {
        this.extractedDependents$.next(dependents);
      });
  }

  async onQuickResultChange(row: DependentWithReview, newResult: DependentReviewResult): Promise<void> {
    if (row.latestReview?.result === newResult) return;

    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    const currentUserProfile = await firstValueFrom(this.currentUser.profile$);
    const currentUserId = currentUserProfile?.id;
    if (!currentUserId) {
      throw new Error('ユーザーIDが取得できませんでした');
    }

    const reviewDate = this.referenceDate || new Date().toISOString().substring(0, 10);
    const reviewedBy = currentUserProfile?.displayName || '';
    const selectedSessionId = await firstValueFrom(this.selectedSessionId$);

    if (row.latestReview) {
      await this.reviewsService.update(officeId, row.latestReview.id, { result: newResult }, currentUserId);
    } else {
      await this.reviewsService.create(
        officeId,
        {
          employeeId: row.employeeId,
          dependentId: row.id,
          reviewDate,
          result: newResult,
          reviewedBy,
          ...(selectedSessionId ? { sessionId: selectedSessionId } : {})
        },
        currentUserId
      );
    }

    // 保存後に再抽出して、抽出テーブル側の latestReview も最新状態に更新する
    this.extractDependents();
  }

  getRelationshipLabel(relationship: string): string {
    const labels: Record<string, string> = {
      spouse: '配偶者',
      child: '子',
      parent: '父母',
      grandparent: '祖父母',
      sibling: '兄弟姉妹',
      other: 'その他'
    };
    return labels[relationship] || relationship;
  }

  getReviewResultLabel(result: DependentReviewResult): string {
    const labels: Record<DependentReviewResult, string> = {
      continued: '継続',
      to_be_removed: '削除予定',
      needs_review: '要確認'
    };
    return labels[result] || result;
  }

  formatSessionLabel(session: DependentReviewSession): string {
    const detail = session.note && session.note.trim().length > 0 ? session.note : `${session.referenceDate} 現在`;
    return `${session.checkedAt} - ${detail}`;
  }

  openCreateSessionDialog(): void {
    this.dialog
      .open(SessionFormDialogComponent, {
        width: '600px',
        data: {
          referenceDate: this.referenceDate
        }
      })
      .afterClosed()
      .subscribe((formValue) => {
        if (!formValue) return;
        this.onCreateSession(formValue);
      });
  }

  async onCreateSession(sessionData: {
    referenceDate: string;
    checkedAt: string;
    checkedBy?: string;
    note?: string;
  }): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    const currentUserProfile = await firstValueFrom(this.currentUser.profile$);
    const currentUserId = currentUserProfile?.id;
    if (!currentUserId) {
      throw new Error('ユーザーIDが取得できませんでした');
    }

    const sessionId = await this.sessionsService.create(
      officeId,
      {
        referenceDate: sessionData.referenceDate,
        checkedAt: sessionData.checkedAt,
        checkedBy: sessionData.checkedBy || currentUserProfile?.displayName || '',
        note: sessionData.note
      },
      currentUserId
    );

    const [employees, dependentsMap, allReviews] = await firstValueFrom(
      combineLatest([this.employees$, this.dependentsMap$, this.reviewsForExtraction$]).pipe(take(1))
    );

    const referenceDate = sessionData.referenceDate;
    const extractedDependents: DependentWithReview[] = [];

    for (const employee of employees) {
      const employeeDependents = dependentsMap.get(employee.id);
      if (!employeeDependents) continue;

      for (const dependent of employeeDependents.values()) {
        const acquiredDate = dependent.qualificationAcquiredDate;
        const lossDate = dependent.qualificationLossDate;

        if (!acquiredDate) continue;
        if (acquiredDate > referenceDate) continue;
        if (lossDate && lossDate <= referenceDate) continue;

        const reviewsForDependent = allReviews.filter(
          (r) =>
            r.employeeId === employee.id &&
            r.dependentId === dependent.id &&
            (!referenceDate || r.reviewDate <= referenceDate)
        );
        const latestReview = reviewsForDependent.length > 0 ? reviewsForDependent[0] : undefined;

        extractedDependents.push({
          ...dependent,
          employeeId: employee.id,
          employeeName: employee.name,
          latestReview
        });
      }
    }

    for (const dependent of extractedDependents) {
      if (dependent.latestReview && !dependent.latestReview.sessionId) {
        await this.reviewsService.update(officeId, dependent.latestReview.id, { sessionId }, currentUserId);
      }
    }

    this.selectedSessionId$.next(sessionId);
    this.extractDependents();
  }

  async openCreateDialog(): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    this.dialog
      .open(ReviewFormDialogComponent, {
        width: '600px',
        data: { officeId }
      })
      .afterClosed()
      .subscribe();
  }

  async openReviewDialog(dependent: DependentWithReview): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    this.dialog
      .open(ReviewFormDialogComponent, {
        width: '600px',
        data: { officeId, employeeId: dependent.employeeId, dependentId: dependent.id }
      })
      .afterClosed()
      .subscribe();
  }

  async openEditDialog(review: DependentReview): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    this.dialog
      .open(ReviewFormDialogComponent, {
        width: '600px',
        data: { officeId, review }
      })
      .afterClosed()
      .subscribe();
  }

  async deleteReview(review: DependentReview): Promise<void> {
    if (!confirm(`確認結果を削除しますか？`)) {
      return;
    }

    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    await this.reviewsService.delete(officeId, review.id);
  }
}
