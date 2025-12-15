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
    <div class="page-container">
      <header class="page-header">
        <div>
          <h1 class="m-0">社会保険情報の異常値チェック</h1>
          <p class="mb-0 mat-body-2" style="color: var(--app-text-sub);">
            現在のデータから自動検出された要確認レコードを一覧表示します。
          </p>
        </div>
      </header>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center flex-wrap gap-2 mb-2">
          <h2 class="mat-h2 m-0 flex-row align-center gap-2">
            <mat-icon color="primary">fact_check</mat-icon>
            異常値チェック結果
          </h2>
        </div>
        <p class="mat-body-2 mb-3" style="color: #666;">
          画面表示時に最新データを計算します（保存はしません）。
        </p>

        <ng-container *ngIf="issues$ | async as issues; else loading">
          <div *ngIf="issues.length > 0; else empty" class="table-container">
            <table mat-table [dataSource]="issues" class="admin-table">
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
          <div class="empty-state-simple">
            <mat-icon>check_circle</mat-icon>
            <p>異常は見つかりませんでした。</p>
          </div>
        </ng-template>

        <ng-template #loading>
          <div class="empty-state-simple">
            <mat-icon>hourglass_empty</mat-icon>
            <p>読み込み中...</p>
          </div>
        </ng-template>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .table-container {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        background: #fff;
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
    loss_retire_premium_mismatch: '退職日と資格喪失日の不整合'
  };

  issueTypeLabel(type: DataQualityIssueType): string {
    return this.ISSUE_TYPE_LABELS[type] ?? type;
  }
}

