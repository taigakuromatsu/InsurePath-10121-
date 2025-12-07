import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { map, of, switchMap } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { DataQualityService } from '../../services/data-quality.service';
import { DataQualityIssue, DataQualityIssueType } from '../../types';

@Component({
  selector: 'ip-data-quality-page',
  standalone: true,
  imports: [MatCardModule, MatTableModule, MatIconModule, AsyncPipe, NgIf],
  template: `
    <section class="page data-quality">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>fact_check</mat-icon>
          </div>
          <div class="header-text">
            <h1>社会保険情報の異常値チェック</h1>
            <p>現在のデータから自動検出された要確認レコードを一覧表示します。</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="card-header">
          <h2>異常値チェック結果</h2>
          <p class="caption">画面表示時に最新データを計算します（保存はしません）。</p>
        </div>

        <ng-container *ngIf="issues$ | async as issues; else loading">
          <div *ngIf="issues.length > 0; else empty" class="table-container">
            <table mat-table [dataSource]="issues">
              <ng-container matColumnDef="employeeName">
                <th mat-header-cell *matHeaderCellDef>対象者</th>
                <td mat-cell *matCellDef="let row">{{ row.employeeName }}</td>
              </ng-container>

              <ng-container matColumnDef="issueType">
                <th mat-header-cell *matHeaderCellDef>種類</th>
                <td mat-cell *matCellDef="let row">{{ issueTypeLabel(row.issueType) }}</td>
              </ng-container>

              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef>内容</th>
                <td mat-cell *matCellDef="let row">{{ row.description }}</td>
              </ng-container>

              <ng-container matColumnDef="targetPeriod">
                <th mat-header-cell *matHeaderCellDef>対象年月</th>
                <td mat-cell *matCellDef="let row">{{ row.targetPeriod || '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="detectedAt">
                <th mat-header-cell *matHeaderCellDef>検出日</th>
                <td mat-cell *matCellDef="let row">{{ row.detectedAt }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
        </ng-container>

        <ng-template #empty>
          <div class="empty-state">
            <mat-icon>check_circle</mat-icon>
            <p>異常は見つかりませんでした。</p>
          </div>
        </ng-template>

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
        background: #eef2ff;
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
      }
      .card-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .card-header .caption {
        margin: 0;
        color: #6b7280;
        font-size: 0.9rem;
      }
      .table-container {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }
      table {
        width: 100%;
      }
      th,
      td {
        padding: 0.75rem 1rem;
      }
      .empty-state {
        padding: 2rem;
        text-align: center;
        color: #6b7280;
        display: grid;
        place-items: center;
        gap: 0.5rem;
      }
      .empty-state mat-icon {
        font-size: 40px;
      }
    `
  ]
})
export class DataQualityPage {
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly dataQualityService = inject(DataQualityService);

  readonly displayedColumns = ['employeeName', 'issueType', 'description', 'targetPeriod', 'detectedAt'];

  readonly issues$ = this.currentOffice.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) return of([] as DataQualityIssue[]);
      return this.dataQualityService.listIssues(officeId);
    }),
    map((issues) => issues.sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1)))
  );

  private readonly ISSUE_TYPE_LABELS: Record<DataQualityIssueType, string> = {
    insured_qualification_inconsistent: '資格・加入フラグ不整合',
    missing_premium_record: '保険料レコード欠落',
    loss_retire_premium_mismatch: '喪失/退職と保険料計上の矛盾',
    standard_reward_overlap: '標準報酬履歴の期間矛盾',
    care_premium_mismatch: '介護保険料の年齢不整合',
    premium_snapshot_missing: '標準報酬スナップショット欠落'
  };

  issueTypeLabel(type: DataQualityIssueType): string {
    return this.ISSUE_TYPE_LABELS[type] ?? type;
  }
}

