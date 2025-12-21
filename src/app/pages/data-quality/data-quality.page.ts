import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { firstValueFrom } from 'rxjs';
import { combineLatest, map, of, Subject, startWith, switchMap } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { DataQualityService } from '../../services/data-quality.service';
import { DataQualityIssue, DataQualityIssueType } from '../../types';

@Component({
  selector: 'ip-data-quality-page',
  standalone: true,
  imports: [MatCardModule, MatTableModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatSnackBarModule, MatExpansionModule, AsyncPipe, NgIf],
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

      <mat-card class="content-card info-card">
        <mat-accordion [multi]="true">
          <!-- 異常値チェックのルール説明 -->
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="info-icon">info</mat-icon>
                異常値チェックのルールについて
              </mat-panel-title>
              <mat-panel-description>
                どのような異常をチェックするか
              </mat-panel-description>
            </mat-expansion-panel-header>

            <div class="info-body">
              <p class="info-intro">
                このページでは、従業員台帳と標準報酬履歴のデータを自動的にチェックし、<br />
                論理的な不整合や入力ミスの可能性がある項目を検出します。
              </p>

              <h4 style="margin-top: 20px; margin-bottom: 12px; font-size: 1rem; font-weight: 600;">ルール1: 資格・加入フラグ不整合</h4>
              <ul class="info-list">
                <li>
                  <strong>社会保険加入フラグがONなのに、資格取得日または標準報酬履歴が未登録</strong><br />
                  加入フラグがONの場合は、資格取得日と標準報酬履歴が登録されている必要があります。
                </li>
                <li>
                  <strong>資格取得日が入力されているのに、加入フラグがOFF</strong><br />
                  資格取得日が入力されている場合は、加入フラグもONにする必要があります。
                </li>
              </ul>

              <h4 style="margin-top: 20px; margin-bottom: 12px; font-size: 1rem; font-weight: 600;">ルール2: 退職日と資格喪失日の不整合</h4>
              <ul class="info-list">
                <li>
                  <strong>退職日が入力されているのに、資格喪失日が未設定</strong><br />
                  退職日がある場合、資格取得日が入力されていれば資格喪失日も設定する必要があります。
                </li>
              </ul>

              <h4 style="margin-top: 20px; margin-bottom: 12px; font-size: 1rem; font-weight: 600;">ルール3: 資格取得日より前の適用開始年月の履歴</h4>
              <ul class="info-list">
                <li>
                  <strong>標準報酬履歴の適用開始年月が資格取得日より前</strong><br />
                  資格取得日より前に適用開始年月の履歴が登録されているのは論理的に不整合です。
                </li>
              </ul>

              <h4 style="margin-top: 20px; margin-bottom: 12px; font-size: 1rem; font-weight: 600;">ルール4: 資格喪失日が資格取得日より前</h4>
              <ul class="info-list">
                <li>
                  <strong>資格喪失日が資格取得日より前になっている</strong><br />
                  資格喪失日は資格取得日以降である必要があります。
                </li>
              </ul>

              <h4 style="margin-top: 20px; margin-bottom: 12px; font-size: 1rem; font-weight: 600;">ルール5: 退職日が入社日より前</h4>
              <ul class="info-list">
                <li>
                  <strong>退職日が入社日より前になっている</strong><br />
                  退職日は入社日以降である必要があります。
                </li>
              </ul>

              <h4 style="margin-top: 20px; margin-bottom: 12px; font-size: 1rem; font-weight: 600;">ルール6: 資格喪失日より後の標準報酬履歴</h4>
              <ul class="info-list">
                <li>
                  <strong>標準報酬履歴の適用開始年月が資格喪失日より後</strong><br />
                  資格喪失日より後に適用開始年月の履歴が登録されているのは論理的に不整合です。<br />
                  ただし、同月得喪（資格取得日と資格喪失日が同じ月）の場合は、その月の標準報酬履歴は有効なため、検出対象外となります。
                </li>
              </ul>

              <h4 style="margin-top: 20px; margin-bottom: 12px; font-size: 1rem; font-weight: 600;">ルール7: 標準報酬履歴の適用開始年月が未来</h4>
              <ul class="info-list">
                <li>
                  <strong>標準報酬履歴の適用開始年月が現在より未来</strong><br />
                  適用開始年月は現在の年月以前である必要があります。
                </li>
              </ul>

              <h4 style="margin-top: 20px; margin-bottom: 12px; font-size: 1rem; font-weight: 600;">ルール8: 資格取得日が入社日より前</h4>
              <ul class="info-list">
                <li>
                  <strong>資格取得日が入社日より前になっている</strong><br />
                  通常、資格取得日は入社日以降である必要があります。転籍などの例外ケースを除き、確認してください。
                </li>
              </ul>

              <h4 style="margin-top: 20px; margin-bottom: 12px; font-size: 1rem; font-weight: 600;">ルール9: 資格取得日が未来</h4>
              <ul class="info-list">
                <li>
                  <strong>資格取得日が未来になっている</strong><br />
                  資格取得日は現在の日付以前である必要があります。
                </li>
              </ul>

              <p class="info-note" style="margin-top: 20px;">
                <strong>注意事項</strong><br />
                ・入社日から1ヶ月以内の従業員については、上記のチェックは適用されません（猶予期間）。<br />
                ・警告が表示された場合は、該当する従業員の情報を確認し、必要に応じて修正してください。<br />
                ・例外ケース（転籍など）で問題ない場合は、「確認済み」ボタンで警告を無視できます。
              </p>
            </div>
          </mat-expansion-panel>
        </mat-accordion>
      </mat-card>

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

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>操作</th>
                <td mat-cell *matCellDef="let row">
                  <button
                    *ngIf="!row.isAcknowledged"
                    mat-stroked-button
                    color="primary"
                    (click)="onAcknowledge(row)"
                    [disabled]="acknowledgingIds.has(row.id)"
                  >
                    <mat-icon *ngIf="!acknowledgingIds.has(row.id)">check</mat-icon>
                    <mat-spinner *ngIf="acknowledgingIds.has(row.id)" diameter="20"></mat-spinner>
                    確認済み
                  </button>
                  <button
                    *ngIf="row.isAcknowledged"
                    mat-stroked-button
                    color="warn"
                    (click)="onUnacknowledge(row)"
                    [disabled]="acknowledgingIds.has(row.id)"
                  >
                    <mat-icon *ngIf="!acknowledgingIds.has(row.id)">undo</mat-icon>
                    <mat-spinner *ngIf="acknowledgingIds.has(row.id)" diameter="20"></mat-spinner>
                    解除
                  </button>
                </td>
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
      .page-container {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .table-container {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        background: #fff;
      }

      .acknowledged-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #2e7d32;
        font-size: 0.875rem;
      }

      .acknowledged-badge mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .info-card {
        padding-top: 16px;
        padding-bottom: 16px;
      }

      .info-icon {
        margin-right: 4px;
      }

      .info-body {
        padding: 8px 4px 12px;
      }

      .info-body h4 {
        margin-top: 20px;
        margin-bottom: 12px;
        font-size: 1rem;
        font-weight: 600;
      }

      .info-list {
        margin: 0;
        padding-left: 1.2rem;
        font-size: 0.9rem;
        line-height: 1.6;
      }

      .info-list li {
        margin-bottom: 8px;
      }

      .info-note,
      .info-intro {
        margin-top: 8px;
        font-size: 0.85rem;
        color: #666;
        line-height: 1.6;
      }

      .info-note strong {
        color: #d32f2f;
        font-weight: 600;
      }
    `
  ]
})
export class DataQualityPage {
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly dataQualityService = inject(DataQualityService);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = ['employeeName', 'issueType', 'description', 'targetPeriod', 'detectedAt', 'actions'];
  readonly acknowledgingIds = new Set<string>();
  private readonly refreshTrigger$ = new Subject<void>();

  readonly issues$ = combineLatest([
    this.currentOffice.officeId$,
    this.refreshTrigger$.pipe(startWith(null))
  ]).pipe(
    switchMap(([officeId]) => {
      if (!officeId) return of([] as DataQualityIssue[]);
      return this.dataQualityService.listIssues(officeId);
    }),
    map((issues) => issues.sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1)))
  );

  private readonly ISSUE_TYPE_LABELS: Record<DataQualityIssueType, string> = {
    insured_qualification_inconsistent: '資格・加入フラグ不整合',
    loss_retire_premium_mismatch: '退職日と資格喪失日の不整合',
    standard_reward_before_qualification: '資格取得日より前の適用開始年月の履歴',
    loss_date_before_qualification: '資格喪失日が資格取得日より前',
    retire_date_before_hire: '退職日が入社日より前',
    standard_reward_after_loss: '資格喪失日より後の標準報酬履歴',
    standard_reward_future_date: '標準報酬履歴の適用開始年月が未来',
    qualification_before_hire: '資格取得日が入社日より前',
    qualification_future_date: '資格取得日が未来'
  };

  issueTypeLabel(type: DataQualityIssueType): string {
    return this.ISSUE_TYPE_LABELS[type] ?? type;
  }

  async onAcknowledge(issue: DataQualityIssue): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) {
      this.snackBar.open('事業所情報を取得できませんでした', '閉じる', { duration: 3000 });
      return;
    }

    this.acknowledgingIds.add(issue.id);
    try {
      await this.dataQualityService.acknowledgeIssue(officeId, issue.id);
      this.snackBar.open('確認済みとしてマークしました', '閉じる', { duration: 3000 });
      // リストを再読み込み（確認済みフラグを更新）
      this.refreshTrigger$.next();
    } catch (error) {
      console.error('確認済みマークに失敗しました:', error);
      this.snackBar.open('確認済みマークに失敗しました', '閉じる', { duration: 3000 });
    } finally {
      this.acknowledgingIds.delete(issue.id);
    }
  }

  async onUnacknowledge(issue: DataQualityIssue): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) {
      this.snackBar.open('事業所情報を取得できませんでした', '閉じる', { duration: 3000 });
      return;
    }

    this.acknowledgingIds.add(issue.id);
    try {
      await this.dataQualityService.unacknowledgeIssue(officeId, issue.id);
      this.snackBar.open('確認済みを解除しました', '閉じる', { duration: 3000 });
      // リストを再読み込み（確認済みフラグを更新）
      this.refreshTrigger$.next();
    } catch (error) {
      console.error('確認済み解除に失敗しました:', error);
      this.snackBar.open('確認済み解除に失敗しました', '閉じる', { duration: 3000 });
    } finally {
      this.acknowledgingIds.delete(issue.id);
    }
  }
}

