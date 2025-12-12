import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf, PercentPipe } from '@angular/common';
import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { combineLatest, of, switchMap, firstValueFrom, Subscription, map } from 'rxjs';

import { CurrentOfficeService } from '../../../services/current-office.service';
import { CurrentUserService } from '../../../services/current-user.service';
import { EmployeesService } from '../../../services/employees.service';
import { BonusPremiumsService } from '../../../services/bonus-premiums.service';
import { MastersService } from '../../../services/masters.service';
import { BonusPremium, Employee, Office, YearMonthString } from '../../../types';
import { BonusFormDialogComponent } from './bonus-form-dialog.component';
import { CsvExportService } from '../../../utils/csv-export.service';
import { HelpDialogComponent, HelpDialogData } from '../../../components/help-dialog.component';
import { DocumentGenerationDialogComponent } from '../../documents/document-generation-dialog.component';
import { isCareInsuranceTarget, roundForEmployeeDeduction } from '../../../utils/premium-calculator';
import { hasInsuranceInMonth } from '../../../utils/premium-calculator';

interface BonusPremiumViewRow extends BonusPremium {
  employeeName: string;
  healthCareFull: number;
  healthCareEmployee: number;
  healthCareEmployer: number;
  pensionFull: number;
  pensionEmployee: number;
  pensionEmployer: number;
  totalFull: number;
}

@Component({
  selector: 'ip-bonus-premiums-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    ReactiveFormsModule,
    AsyncPipe,
    NgIf,
    NgFor,
    DecimalPipe,
    DatePipe,
    PercentPipe
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div class="flex-row align-center gap-2">
          <h1 class="m-0">賞与保険料管理</h1>
              <button
                mat-icon-button
                class="help-button"
                type="button"
                (click)="openHelp()"
                aria-label="賞与保険料のヘルプを表示"
              >
                <mat-icon>help_outline</mat-icon>
              </button>
        </div>
        <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">
          対象年月を指定し、その月に支給された賞与データから健康保険・介護保険と厚生年金の保険料を集計します。
        </p>
      </header>

      <mat-card class="content-card selection-card">
        <div class="flex-row justify-between align-center mb-4 flex-wrap gap-2">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">calendar_month</mat-icon> 対象年月を選択
            </h2>
            <p class="mat-body-2" style="color: #666">直近12ヶ月から閲覧する年月を選択できます。</p>
          </div>
        </div>

        <div class="year-month-selector dense-form">
          <mat-form-field appearance="outline" class="dense-form-field">
            <mat-label>対象年月</mat-label>
            <mat-select
              [value]="selectedYearMonth()"
              (selectionChange)="onYearMonthSelectionChange($event.value)"
            >
              <mat-option *ngFor="let ym of yearMonthOptions()" [value]="ym">{{ ym }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="flex-row justify-between align-center mb-4 flex-wrap gap-2">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">list</mat-icon> 賞与支給一覧（{{ selectedYearMonth() }}）
            </h2>
            <p class="mat-body-2" style="color: #666">対象年月に支給された賞与と保険料の一覧です。</p>
          </div>
          <div class="flex-row gap-2 flex-wrap">
            <button
              mat-stroked-button
              color="primary"
              (click)="exportToCsv()"
              [disabled]="!(filteredRows().length > 0)"
              *ngIf="canExport$ | async"
            >
              <mat-icon>download</mat-icon>
              CSVエクスポート
            </button>
            <button
              mat-flat-button
              color="primary"
              (click)="openDialog()"
              [disabled]="!(officeId$ | async)"
            >
              <mat-icon>note_add</mat-icon>
              賞与を登録
            </button>
          </div>
        </div>

        <ng-container *ngIf="office$ | async as office; else noOffice">
          <div class="rate-summary" *ngIf="rateSummary() as r">
            <h3 class="rate-summary-title">
              <mat-icon>info</mat-icon>
              適用される保険料率（{{ selectedYearMonth() }}）
            </h3>
            <div class="rate-list">
              <div class="rate-item">
                <span class="rate-label">健康保険</span>
                <span class="rate-value" [class.not-set]="r.healthRate == null">
                  {{ r.healthRate != null ? (r.healthRate | percent: '1.2-2') : '未設定' }}
                </span>
              </div>
              <div class="rate-item">
                <span class="rate-label">介護保険</span>
                <span class="rate-value" [class.not-set]="r.careRate == null">
                  {{ r.careRate != null ? (r.careRate | percent: '1.2-2') : '-' }}
                </span>
              </div>
              <div class="rate-item">
                <span class="rate-label">厚生年金</span>
                <span class="rate-value" [class.not-set]="r.pensionRate == null">
                  {{ r.pensionRate != null ? (r.pensionRate | percent: '1.2-2') : '未設定' }}
                </span>
              </div>
            </div>
          </div>

          <div class="table-container" *ngIf="filteredRows() && filteredRows()!.length > 0; else emptyState">
            <table mat-table [dataSource]="filteredRows()!" class="admin-table dense-table">

              <!-- 1. 支給情報（固定） -->
              <ng-container matColumnDef="payInfo">
                <th mat-header-cell *matHeaderCellDef class="col-fixed-info">支給日 / 氏名</th>
                <td mat-cell *matCellDef="let row" class="col-fixed-info cell-padding">
                  <div class="info-cell">
                    <span class="pay-date">{{ row.payDate | date: 'yyyy/MM/dd' }}</span>
                    <span class="employee-name">{{ row.employeeName }}</span>
                  </div>
                </td>
              </ng-container>

              <!-- 2. 賞与額 -->
              <ng-container matColumnDef="bonusAmount">
                <th mat-header-cell *matHeaderCellDef class="col-amount">賞与支給額<br><span class="sub-header">（千円未満切捨）</span></th>
                <td mat-cell *matCellDef="let row" class="col-amount cell-padding">
                  <div class="amount-cell">
                    <div class="amount-row main-amount">
                      <span class="label">支給</span>
                      <span class="value">{{ row.grossAmount | number }}</span>
                    </div>
                    <div class="amount-row sub-amount">
                      <span class="label">切捨後</span>
                      <span class="value">{{ row.standardBonusAmount | number }}</span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- 3. 健康保険 -->
              <ng-container matColumnDef="healthInfo">
                <th mat-header-cell *matHeaderCellDef class="col-insurance health-col">健康保険・介護保険</th>
                <td mat-cell *matCellDef="let row" class="col-insurance health-col cell-padding">
                  <div class="insurance-cell-v2">
                    <div class="std-section">
                      <span class="label">標準賞与</span>
                      <span class="value">{{ row.healthEffectiveAmount | number }}</span>
                    </div>
                    <div class="split-section">
                      <div class="split-item">
                        <span class="split-label">従業員</span>
                        <span class="split-value emp-value">{{ row.healthCareEmployee | number }}</span>
                      </div>
                      <div class="split-divider"></div>
                      <div class="split-item">
                        <span class="split-label">会社</span>
                        <span class="split-value comp-value">({{ row.healthCareEmployer | number }})</span>
                      </div>
                    </div>
                    <div class="full-section">
                      <span class="label">全額</span>
                      <span class="value">{{ row.healthCareFull | number:'1.0-2' }}</span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- 4. 厚生年金 -->
              <ng-container matColumnDef="pensionInfo">
                <th mat-header-cell *matHeaderCellDef class="col-insurance pension-col">厚生年金</th>
                <td mat-cell *matCellDef="let row" class="col-insurance pension-col cell-padding">
                  <div class="insurance-cell-v2">
                    <div class="std-section">
                      <span class="label">標準賞与</span>
                      <span class="value">{{ row.pensionEffectiveAmount | number }}</span>
                    </div>
                    <div class="split-section">
                      <div class="split-item">
                        <span class="split-label">従業員</span>
                        <span class="split-value emp-value">{{ row.pensionEmployee | number }}</span>
                      </div>
                      <div class="split-divider"></div>
                      <div class="split-item">
                        <span class="split-label">会社</span>
                        <span class="split-value comp-value">({{ row.pensionEmployer | number }})</span>
                      </div>
                    </div>
                    <div class="full-section">
                      <span class="label">全額</span>
                      <span class="value">{{ row.pensionFull | number:'1.0-2' }}</span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- 5. 合計 -->
              <ng-container matColumnDef="totalInfo">
                <th mat-header-cell *matHeaderCellDef class="col-total total-col">合計</th>
                <td mat-cell *matCellDef="let row" class="col-total total-col cell-padding">
                  <div class="insurance-cell-v2">
                    <div class="split-section mt-2">
                      <div class="split-item">
                        <span class="split-label">従業員</span>
                        <span class="split-value emp-value">{{ row.totalEmployee | number }}</span>
                      </div>
                      <div class="split-divider"></div>
                      <div class="split-item">
                        <span class="split-label">会社</span>
                        <span class="split-value comp-value">({{ row.totalEmployer | number }})</span>
                      </div>
                    </div>
                    <div class="full-section">
                      <span class="label">全額</span>
                      <span class="value">{{ row.totalFull | number:'1.0-2' }}</span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- 6. 操作 -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="col-actions">操作</th>
                <td mat-cell *matCellDef="let row" class="col-actions cell-padding">
                  <div class="actions-cell">
                  <button
                    mat-icon-button
                    color="primary"
                      class="small-icon-btn"
                    aria-label="賞与支払届を生成"
                    (click)="openDocumentDialog(row)"
                      matTooltip="帳票出力"
                  >
                    <mat-icon>picture_as_pdf</mat-icon>
                  </button>
                    <button mat-icon-button color="primary" class="small-icon-btn" (click)="openDialog(row)" matTooltip="編集">
                    <mat-icon>edit</mat-icon>
                  </button>
                    <button mat-icon-button color="warn" class="small-icon-btn" (click)="delete(row)" matTooltip="削除">
                    <mat-icon>delete</mat-icon>
                  </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns" class="hover-row"></tr>
            </table>
          </div>

          <div class="summary-section" *ngIf="filteredRows() && filteredRows()!.length > 0">
            <div class="summary-grid">
              <!-- 健康保険・介護保険 -->
              <div class="summary-card health-card">
                <div class="summary-header">
                  <mat-icon>medical_services</mat-icon> 健康保険・介護保険
                </div>
                <div class="summary-content">
                  <div class="main-row">
                    <div class="label-group">
                      <span class="main-label">納入告知額</span>
                      <span class="sub-label">（端数処理前: {{ healthSummary().sumFull | number:'1.0-2' }}円）</span>
                    </div>
                    <span class="main-value">{{ healthSummary().sumFullRoundedDown | number }}<small>円</small></span>
                  </div>
                  
                  <div class="divider">
                    <mat-icon class="operator-icon">remove</mat-icon>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">従業員負担計</span>
                    <span class="detail-value">{{ healthSummary().employeeTotal | number }}円</span>
                  </div>

                  <div class="divider">
                    <mat-icon class="operator-icon">drag_handle</mat-icon>
                  </div>

                  <div class="result-row">
                    <span class="result-label">会社負担計</span>
                    <span class="result-value">{{ healthSummary().employerTotal | number }}円</span>
                  </div>
                </div>
              </div>

              <!-- 厚生年金 -->
              <div class="summary-card pension-card">
                <div class="summary-header">
                  <mat-icon>elderly</mat-icon> 厚生年金
                </div>
                <div class="summary-content">
                  <div class="main-row">
                    <div class="label-group">
                      <span class="main-label">納入告知額</span>
                      <span class="sub-label">（端数処理前: {{ pensionSummary().sumFull | number:'1.0-2' }}円）</span>
                    </div>
                    <span class="main-value">{{ pensionSummary().sumFullRoundedDown | number }}<small>円</small></span>
                  </div>

                  <div class="divider">
                    <mat-icon class="operator-icon">remove</mat-icon>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">従業員負担計</span>
                    <span class="detail-value">{{ pensionSummary().employeeTotal | number }}円</span>
                  </div>

                  <div class="divider">
                    <mat-icon class="operator-icon">drag_handle</mat-icon>
                  </div>

                  <div class="result-row">
                    <span class="result-label">会社負担計</span>
                    <span class="result-value">{{ pensionSummary().employerTotal | number }}円</span>
                  </div>
                </div>
              </div>

              <!-- 総合計 -->
              <div class="summary-card total-card">
                <div class="summary-header">
                  <mat-icon>functions</mat-icon> 総合計
                </div>
                <div class="summary-content">
                  <div class="main-row">
                    <div class="label-group">
                      <span class="main-label">納入告知額 合計</span>
                      <span class="sub-label">（端数処理前: {{ combinedSummary().sumFull | number:'1.0-2' }}円）</span>
                    </div>
                    <span class="main-value">{{ combinedSummary().sumFullRoundedDown | number }}<small>円</small></span>
                  </div>

                  <div class="divider">
                    <mat-icon class="operator-icon">remove</mat-icon>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">従業員負担 総計</span>
                    <span class="detail-value">{{ combinedSummary().employeeTotal | number }}円</span>
                  </div>

                  <div class="divider">
                    <mat-icon class="operator-icon">drag_handle</mat-icon>
                  </div>

                  <div class="result-row">
                    <span class="result-label">会社負担 総計</span>
                    <span class="result-value">{{ combinedSummary().employerTotal | number }}円</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="summary-footer-note">
              <mat-icon class="note-icon">info</mat-icon>
              <p>
                従業員負担額には50銭ルール（50銭以下切り捨て／50銭超切り上げ）を適用しています。<br>
                会社負担合計は「納入告知額（端数処理後の全額合計） − 従業員負担合計」で算出しています。
              </p>
            </div>
          </div>

        <ng-template #emptyState>
          <div class="empty-state">
            <mat-icon>pending_actions</mat-icon>
              <p>対象年月（{{ selectedYearMonth() }}）に登録済みの賞与がありません。まずは賞与を登録してください。</p>
            <button mat-stroked-button color="primary" (click)="openDialog()" [disabled]="!(officeId$ | async)">
              <mat-icon>note_add</mat-icon>
              賞与を登録
            </button>
          </div>
        </ng-template>
        </ng-container>

        <ng-template #noOffice>
          <div class="empty-office-state">
            <mat-icon>business</mat-icon>
            <h3>事業所が未設定です</h3>
            <p>まずは所属事業所を設定してください。</p>
          </div>
        </ng-template>
      </mat-card>
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
      }

      .page-header {
        margin-bottom: 24px;
      }

      .content-card {
        padding: 24px;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
      }

      /* ユーティリティ */
      .m-0 { margin: 0; }
      .mb-0 { margin-bottom: 0; }
      .mb-2 { margin-bottom: 8px; }
      .mb-3 { margin-bottom: 16px; }
      .mb-4 { margin-bottom: 24px; }
      .gap-2 { gap: 8px; }
      .gap-3 { gap: 16px; }
      .flex-row { display: flex; flex-direction: row; }
      .align-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .flex-wrap { flex-wrap: wrap; }
      .dense-form-field { font-size: 14px; }

      .selection-card {
        margin-bottom: 1.5rem;
      }

      .year-month-selector {
        max-width: 240px;
      }

      .help-button {
        width: 36px;
        height: 36px;
      }

      .rate-summary {
        background: #f5f7fa;
        padding: 16px;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        margin-bottom: 24px;
      }

      .rate-summary-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 12px 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: #333;
      }

      .rate-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }

      .rate-item {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: #fff;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
      }

      .rate-label {
        font-size: 0.9rem;
        color: #666;
        font-weight: 500;
      }

      .rate-value {
        font-size: 1.2rem;
        font-weight: 700;
        color: #1976d2;
      }

      .rate-value.not-set {
        color: #999;
        font-weight: 500;
      }

      .table-container {
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        overflow: hidden;
        overflow-x: auto; /* 横スクロールを有効化 */
        background: #fff;
        margin-bottom: 24px;
      }

      /* テーブルスタイル */
      .admin-table {
        width: 100%;
        border-collapse: collapse;
      }

      /* カラム定義 */
      .col-fixed-info { width: 15%; min-width: 140px; }
      .col-amount { width: 15%; min-width: 140px; }
      .col-insurance { width: 22%; min-width: 200px; }
      .col-total { width: 18%; min-width: 180px; }
      .col-actions { width: 10%; min-width: 100px; text-align: center; }

      .cell-padding {
        padding: 12px !important;
        vertical-align: top;
      }

      /* 情報セル */
      .info-cell {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .pay-date { font-size: 0.85rem; color: #666; }
      .employee-name { font-weight: 700; font-size: 1rem; color: #333; }

      /* 金額セル */
      .amount-cell {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .amount-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.9rem;
      }
      .main-amount .value { font-weight: 700; font-size: 1rem; }
      .sub-amount { color: #666; font-size: 0.85rem; }
      .sub-header { font-size: 0.75rem; font-weight: normal; color: #666; }

      /* 保険料セル */
      .health-col { background-color: #fafdff; }
      .pension-col { background-color: #fafffa; }
      .total-col { background-color: #fffaf0; }

      .insurance-cell {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .std-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
        color: #666;
        border-bottom: 1px solid rgba(0,0,0,0.05);
        padding-bottom: 4px;
        margin-bottom: 2px;
      }
      
      .premium-grid {
        display: grid;
        grid-template-columns: 1fr 1fr; /* 2列グリッドに変更 */
        gap: 4px;
        font-size: 0.85rem;
      }
      
      .insurance-cell-v2 {
        display: flex;
        flex-direction: column;
        background: rgba(255,255,255,0.5);
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid rgba(0,0,0,0.05);
      }

      .std-section, .full-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        font-size: 0.8rem;
        color: #666;
      }
      
      .std-section {
        background-color: rgba(0,0,0,0.02);
        border-bottom: 1px solid rgba(0,0,0,0.05);
      }
      
      .full-section {
        border-top: 1px solid rgba(0,0,0,0.05);
      }
      
      .split-section {
        display: flex;
        align-items: center;
        padding: 6px 0;
      }
      
      .mt-2 { margin-top: 8px; }

      .split-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }
      
      .split-divider {
        width: 1px;
        height: 24px;
        background-color: #e0e0e0;
      }
      
      .split-label {
        font-size: 0.7rem;
        color: #888;
      }
      
      .split-value {
        font-weight: 600;
        font-size: 0.95rem;
      }
      
      .emp-value { color: #333; }
      .comp-value { color: #666; }

      .p-row.full {
        grid-column: 1 / -1; /* 全額は横幅いっぱい */
        display: flex;
        justify-content: space-between;
        border-bottom: 1px dashed #e0e0e0;
        padding-bottom: 2px;
        margin-bottom: 2px;
      }
      
      .p-split {
        display: contents; /* p-split自体はレイアウトに影響させない */
      }
      
      .p-item {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      .p-item .p-label { font-size: 0.7rem; color: #888; }
      .p-item .p-value { font-weight: 500; }
      .emp .p-value { color: #333; }
      .comp .p-value { color: #666; }

      /* アクション */
      .actions-cell {
        display: flex;
        justify-content: center;
        gap: 4px;
      }
      .small-icon-btn {
        width: 32px;
        height: 32px;
        line-height: 32px;
      }
      .small-icon-btn mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 18px;
      }

      /* サマリーカード */
      .summary-section {
        margin-top: 24px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 24px;
        margin-bottom: 24px;
      }

      .summary-card {
        background: #fff;
        border-radius: 12px;
        border: 2px solid #e0e0e0;
        padding: 24px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      }

      .health-card {
        border-color: #2196f3;
        background: linear-gradient(135deg, #e3f2fd 0%, #fff 100%);
      }

      .pension-card {
        border-color: #4caf50;
        background: linear-gradient(135deg, #e8f5e9 0%, #fff 100%);
      }

      .total-card {
        border-color: #ff9800;
        background: linear-gradient(135deg, #fff3e0 0%, #fff 100%);
      }

      .summary-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 20px;
        font-size: 1.2rem;
        font-weight: 700;
        color: #333;
      }

      .summary-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .main-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding-bottom: 16px;
        border-bottom: 2px solid #e0e0e0;
      }

      .label-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .main-label {
        font-size: 1rem;
        font-weight: 600;
        color: #333;
      }

      .sub-label {
        font-size: 0.85rem;
        color: #666;
      }

      .main-value {
        font-size: 2rem;
        font-weight: 700;
        color: #1976d2;
      }

      .main-value small {
        font-size: 1rem;
        font-weight: 500;
        margin-left: 4px;
      }

      .divider {
        display: flex;
        justify-content: center;
        padding: 8px 0;
      }

      .operator-icon {
        color: #999;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .detail-row,
      .result-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
      }

      .detail-label,
      .result-label {
        font-size: 0.95rem;
        color: #666;
        font-weight: 500;
      }

      .detail-value,
      .result-value {
        font-size: 1.3rem;
        font-weight: 700;
        color: #333;
      }

      .result-row {
        padding-top: 12px;
        border-top: 1px solid #e0e0e0;
      }

      .result-value {
        color: #1976d2;
      }

      .summary-footer-note {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
        background: #f5f7fa;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
      }

      .note-icon {
        color: #1976d2;
        margin-top: 2px;
      }

      .summary-footer-note p {
        margin: 0;
        font-size: 0.9rem;
        color: #666;
        line-height: 1.6;
      }

      .empty-state,
      .empty-office-state {
        text-align: center;
        padding: 48px 24px;
        color: #666;
      }

      .empty-state mat-icon,
      .empty-office-state mat-icon {
        font-size: 48px;
        height: 48px;
        width: 48px;
        color: #9ca3af;
        opacity: 0.5;
        margin-bottom: 8px;
      }
    `
  ]
})
export class BonusPremiumsPage implements OnDestroy {
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly employeesService = inject(EmployeesService);
  private readonly bonusPremiumsService = inject(BonusPremiumsService);
  private readonly mastersService = inject(MastersService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly csvExportService = inject(CsvExportService);

  readonly officeId$ = this.currentOffice.officeId$;
  readonly office$ = this.currentOffice.office$;

  readonly canExport$ = this.currentUser.profile$.pipe(
    map((profile) => profile?.role === 'admin' || profile?.role === 'hr')
  );

  readonly selectedYearMonth = signal<YearMonthString>(
    new Date().toISOString().substring(0, 7) as YearMonthString
  );

  readonly yearMonthOptions = computed(() => {
    const options: YearMonthString[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` as YearMonthString;
      options.push(yearMonth);
    }
    return options;
  });

  readonly headerRowDef = ['payInfo', 'bonusAmount', 'healthInfo', 'pensionInfo', 'totalInfo', 'actions'];
  readonly displayedColumns = [
    'payInfo',
    'bonusAmount',
    'healthInfo',
    'pensionInfo',
    'totalInfo',
    'actions'
  ];

  private readonly employees$ = this.officeId$.pipe(
    switchMap((officeId) => (officeId ? this.employeesService.list(officeId) : of([])))
  );

  readonly rateSummary = signal<{ healthRate?: number; careRate?: number; pensionRate?: number } | null>(null);
  readonly rows = signal<BonusPremiumViewRow[]>([]);
  private dataSubscription?: Subscription;

  constructor() {
    effect((onCleanup) => {
      const yearMonth = this.selectedYearMonth();
  
      // officeId$ の購読を開始
      const officeSub = this.officeId$.subscribe((officeId) => {
        if (officeId) {
          this.setupReactiveSubscription(officeId, yearMonth);
        } else {
          this.rows.set([]);
        }
      });
  
      // cleanup で Rx の購読も解除
      onCleanup(() => {
        officeSub.unsubscribe();
        this.dataSubscription?.unsubscribe();
        this.dataSubscription = undefined;
      });
    });
  }
  

  ngOnDestroy(): void {
    this.dataSubscription?.unsubscribe();
  }

  private setupReactiveSubscription(officeId: string, yearMonth: YearMonthString): void {
    // 既存の購読を解除
    this.dataSubscription?.unsubscribe();

    const bonuses$ = this.bonusPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth);
    const employees$ = this.employees$;
    const office$ = this.office$;

    this.dataSubscription = combineLatest([bonuses$, employees$, office$]).subscribe(
      async ([bonuses, employees, office]) => {
        if (!office) {
          this.rows.set([]);
          return;
        }

        const rates = await this.mastersService.getRatesForYearMonth(office, yearMonth);
        this.rateSummary.set({
          healthRate: rates.healthRate ?? undefined,
          careRate: rates.careRate ?? undefined,
          pensionRate: rates.pensionRate ?? undefined
        });

        const employeeMap = new Map(employees.map((e) => [e.id, e]));

        const rows: BonusPremiumViewRow[] = bonuses
          .filter((b) => {
            const employee = employeeMap.get(b.employeeId);
            if (!employee) return false;
            const hasHealth = hasInsuranceInMonth(employee, yearMonth, 'health');
            const hasPension = hasInsuranceInMonth(employee, yearMonth, 'pension');
            return (hasHealth && b.healthEffectiveAmount > 0) || (hasPension && b.pensionEffectiveAmount > 0);
          })
          .map((b) => {
            const employee = employeeMap.get(b.employeeId)!;
            const employeeName = employee.name;

            // 健康保険＋介護保険の計算（毎回計算）
            let healthCareFull = 0;
            let healthCareEmployee = 0;
            let healthCareEmployer = 0;

            const hasHealth = hasInsuranceInMonth(employee, yearMonth, 'health');
            if (hasHealth && b.healthEffectiveAmount > 0) {
              const isCareTarget = isCareInsuranceTarget(employee.birthDate, yearMonth);
              const careRate = isCareTarget && rates.careRate ? rates.careRate : 0;
              const combinedRate = (rates.healthRate ?? 0) + careRate;
              healthCareFull = b.healthEffectiveAmount * combinedRate;
              healthCareEmployee = roundForEmployeeDeduction(healthCareFull / 2);
              healthCareEmployer = healthCareFull - healthCareEmployee;
            }

            // 厚生年金の計算（毎回計算）
            let pensionFull = 0;
            let pensionEmployee = 0;
            let pensionEmployer = 0;

            const hasPension = hasInsuranceInMonth(employee, yearMonth, 'pension');
            if (hasPension && b.pensionEffectiveAmount > 0) {
              pensionFull = b.pensionEffectiveAmount * (rates.pensionRate ?? 0);
              pensionEmployee = roundForEmployeeDeduction(pensionFull / 2);
              pensionEmployer = pensionFull - pensionEmployee;
            }

            const totalFull = healthCareFull + pensionFull;
            const totalEmployee = healthCareEmployee + pensionEmployee;
            const totalEmployer = healthCareEmployer + pensionEmployer;

            return {
        ...b,
              employeeName,
              healthCareFull,
              healthCareEmployee,
              healthCareEmployer,
              pensionFull,
              pensionEmployee,
              pensionEmployer,
              totalFull,
              totalEmployee,
              totalEmployer
            };
          });

        this.rows.set(rows);
      }
    );
  }

  readonly filteredRows = computed(() => {
    return this.rows();
  });

  readonly healthSummary = computed(() => {
    const rows = this.filteredRows();
    const employeeTotal = rows.reduce((sum, r) => sum + r.healthCareEmployee, 0);
    const sumFull = rows.reduce((sum, r) => sum + r.healthCareFull, 0);
    // 浮動小数点誤差対策
    const sumFullRounded = Math.round(sumFull * 100) / 100;
    const sumFullRoundedDown = Math.floor(sumFullRounded);
    const employerTotal = sumFullRoundedDown - employeeTotal;
    return { employeeTotal, sumFull, sumFullRoundedDown, employerTotal };
  });

  readonly pensionSummary = computed(() => {
    const rows = this.filteredRows();
    const employeeTotal = rows.reduce((sum, r) => sum + r.pensionEmployee, 0);
    const sumFull = rows.reduce((sum, r) => sum + r.pensionFull, 0);
    // 浮動小数点誤差対策
    const sumFullRounded = Math.round(sumFull * 100) / 100;
    const sumFullRoundedDown = Math.floor(sumFullRounded);
    const employerTotal = sumFullRoundedDown - employeeTotal;
    return { employeeTotal, sumFull, sumFullRoundedDown, employerTotal };
  });

  readonly combinedSummary = computed(() => {
    const health = this.healthSummary();
    const pension = this.pensionSummary();
    const employeeTotal = health.employeeTotal + pension.employeeTotal;
    const sumFull = health.sumFull + pension.sumFull;
    // 納入告知額は各制度の納入告知額を足したもの
    const sumFullRoundedDown = health.sumFullRoundedDown + pension.sumFullRoundedDown;
    const employerTotal = sumFullRoundedDown - employeeTotal;
    return { employeeTotal, sumFull, sumFullRoundedDown, employerTotal };
  });


  onYearMonthSelectionChange(yearMonth: YearMonthString): void {
    this.selectedYearMonth.set(yearMonth);
    // effectで自動的に再計算される
  }

    openHelp(): void {
      this.dialog.open(HelpDialogComponent, {
        width: '720px',
        data: {
          topicIds: ['bonusRange'],
          title: '賞与保険料に関するヘルプ'
        } satisfies HelpDialogData
      });
    }

  exportToCsv(): void {
    const rows = this.filteredRows();
    if (!rows || rows.length === 0) {
      this.snackBar.open('エクスポートするデータがありません', '閉じる', { duration: 3000 });
      return;
    }

    this.csvExportService.exportBonusPremiums(rows);
    this.snackBar.open('CSVエクスポートが完了しました', '閉じる', { duration: 3000 });
  }

  async openDialog(bonus?: BonusPremiumViewRow): Promise<void> {
    const office = await firstValueFrom(this.office$);
    if (!office) {
      this.snackBar.open('事業所が設定されていません', '閉じる', { duration: 3000 });
      return;
    }

    const employees = await firstValueFrom(this.employees$);

    const dialogRef = this.dialog.open(BonusFormDialogComponent, {
      width: '720px',
      data: {
        office,
        employees: employees as Employee[],
        bonus
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.snackBar.open('賞与情報を更新しました', '閉じる', { duration: 3000 });
        // リアルタイム購読により自動で更新される
      }
    });
  }

  async delete(row: BonusPremiumViewRow): Promise<void> {
    const confirmed = window.confirm(
      `${row.employeeName} さんの ${row.payDate} 支給分の賞与を削除しますか？`
    );
    if (!confirmed) return;

    const office = await firstValueFrom(this.office$);
    if (!office) {
      this.snackBar.open('事業所が設定されていません', '閉じる', { duration: 3000 });
      return;
    }

    try {
      await this.bonusPremiumsService.deleteBonusPremium(office.id, row.id);

      // 削除後にその従業員 × 年月の賞与を一括再計算
      try {
        const employees = await firstValueFrom(this.employees$);
        const targetEmployee = (employees as Employee[]).find((e) => e.id === row.employeeId);
        if (targetEmployee) {
          const yearMonth = row.payDate.substring(0, 7) as YearMonthString;
          await this.bonusPremiumsService.recalculateForEmployeeMonth(
            office,
            targetEmployee,
            yearMonth
          );
        }
      } catch (e) {
        console.error('賞与削除後の一括再計算に失敗しました', e);
        // ここも保存同様、致命的エラーとはしない
      }

      this.snackBar.open('削除しました', '閉じる', { duration: 3000 });
      // リアルタイム購読により一覧は自動更新される
    } catch (error) {
      console.error('削除に失敗しました', error);
      this.snackBar.open('削除に失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async openDocumentDialog(row: BonusPremiumViewRow): Promise<void> {
    const office = await firstValueFrom(this.office$);
    if (!office) {
      this.snackBar.open('事業所が設定されていません', '閉じる', { duration: 3000 });
      return;
    }

    const employee = await firstValueFrom(this.employeesService.get(office.id, row.employeeId));
    if (!employee) {
      this.snackBar.open('従業員情報が取得できませんでした', '閉じる', { duration: 3000 });
      return;
    }

    this.dialog.open(DocumentGenerationDialogComponent, {
      width: '720px',
      data: {
        office,
        employee,
        bonuses: [row],
        defaultType: 'bonus_payment'
      }
    });
  }
}
