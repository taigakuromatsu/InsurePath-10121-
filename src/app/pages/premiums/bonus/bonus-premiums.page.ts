import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf, PercentPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subject, combineLatest, of, startWith, switchMap, map, firstValueFrom } from 'rxjs';

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
            <table mat-table [dataSource]="filteredRows()!" class="admin-table">
              <!-- グループヘッダー -->
              <ng-container matColumnDef="header-health">
                <th mat-header-cell *matHeaderCellDef [attr.colspan]="4" class="group-header health-group">健康保険・介護保険</th>
              </ng-container>
              <ng-container matColumnDef="header-pension">
                <th mat-header-cell *matHeaderCellDef [attr.colspan]="4" class="group-header pension-group">厚生年金</th>
              </ng-container>
              <ng-container matColumnDef="header-total">
                <th mat-header-cell *matHeaderCellDef [attr.colspan]="3" class="group-header total-group">合計（参考）</th>
              </ng-container>

              <ng-container matColumnDef="payDate">
                <th mat-header-cell *matHeaderCellDef [attr.rowspan]="2" class="col-name group-header name-header" style="vertical-align: middle; border-bottom: 1px solid #e0e0e0;">支給日</th>
                <td mat-cell *matCellDef="let row" class="col-name">{{ row.payDate | date: 'yyyy-MM-dd' }}</td>
              </ng-container>

              <ng-container matColumnDef="employeeName">
                <th mat-header-cell *matHeaderCellDef [attr.rowspan]="2" class="col-name group-header name-header" style="vertical-align: middle; border-bottom: 1px solid #e0e0e0;">氏名</th>
                <td mat-cell *matCellDef="let row" class="col-name font-bold">{{ row.employeeName }}</td>
              </ng-container>

              <ng-container matColumnDef="grossAmount">
                <th mat-header-cell *matHeaderCellDef [attr.rowspan]="2" class="number-cell group-header name-header" style="vertical-align: middle; border-bottom: 1px solid #e0e0e0;">賞与支給額（税引前）</th>
                <td mat-cell *matCellDef="let row" class="number-cell">{{ row.grossAmount | number }}</td>
              </ng-container>

              <ng-container matColumnDef="standardBonusAmount">
                <th mat-header-cell *matHeaderCellDef [attr.rowspan]="2" class="number-cell group-header name-header" style="vertical-align: middle; border-bottom: 1px solid #e0e0e0;">標準賞与額（共通）</th>
                <td mat-cell *matCellDef="let row" class="number-cell">{{ row.standardBonusAmount | number }}</td>
              </ng-container>

              <!-- 健康保険・介護保険グループ -->
              <ng-container matColumnDef="healthEffectiveAmount">
                <th mat-header-cell *matHeaderCellDef class="number-cell">標準賞与額（健保）</th>
                <td mat-cell *matCellDef="let row" class="number-cell">{{ row.healthEffectiveAmount | number }}</td>
              </ng-container>

              <ng-container matColumnDef="healthCareFull">
                <th mat-header-cell *matHeaderCellDef class="number-cell">全額</th>
                <td mat-cell *matCellDef="let row" class="number-cell">{{ row.healthCareFull | number:'1.0-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="healthCareEmployee">
                <th mat-header-cell *matHeaderCellDef class="number-cell">従業員負担</th>
                <td mat-cell *matCellDef="let row" class="number-cell font-medium">{{ row.healthCareEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="healthCareEmployer">
                <th mat-header-cell *matHeaderCellDef class="number-cell group-end">会社負担</th>
                <td mat-cell *matCellDef="let row" class="number-cell group-end text-secondary">{{ row.healthCareEmployer | number }}</td>
              </ng-container>

              <!-- 厚生年金グループ -->
              <ng-container matColumnDef="pensionEffectiveAmount">
                <th mat-header-cell *matHeaderCellDef class="number-cell">標準賞与額（厚年）</th>
                <td mat-cell *matCellDef="let row" class="number-cell">{{ row.pensionEffectiveAmount | number }}</td>
              </ng-container>

              <ng-container matColumnDef="pensionFull">
                <th mat-header-cell *matHeaderCellDef class="number-cell">全額</th>
                <td mat-cell *matCellDef="let row" class="number-cell">{{ row.pensionFull | number:'1.0-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="pensionEmployee">
                <th mat-header-cell *matHeaderCellDef class="number-cell">従業員負担</th>
                <td mat-cell *matCellDef="let row" class="number-cell font-medium">{{ row.pensionEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="pensionEmployer">
                <th mat-header-cell *matHeaderCellDef class="number-cell group-end">会社負担</th>
                <td mat-cell *matCellDef="let row" class="number-cell group-end text-secondary">{{ row.pensionEmployer | number }}</td>
              </ng-container>

              <!-- 合計グループ -->
              <ng-container matColumnDef="totalFull">
                <th mat-header-cell *matHeaderCellDef class="number-cell">全額</th>
                <td mat-cell *matCellDef="let row" class="number-cell">{{ row.totalFull | number:'1.0-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="totalEmployee">
                <th mat-header-cell *matHeaderCellDef class="number-cell">従業員負担</th>
                <td mat-cell *matCellDef="let row" class="number-cell font-bold">{{ row.totalEmployee | number }}</td>
              </ng-container>

              <ng-container matColumnDef="totalEmployer">
                <th mat-header-cell *matHeaderCellDef class="number-cell">会社負担</th>
                <td mat-cell *matCellDef="let row" class="number-cell text-secondary">{{ row.totalEmployer | number }}</td>
              </ng-container>

              <ng-container matColumnDef="document">
                <th mat-header-cell *matHeaderCellDef [attr.rowspan]="2" class="actions-header group-header name-header" style="vertical-align: middle; border-bottom: 1px solid #e0e0e0;">帳票</th>
                <td mat-cell *matCellDef="let row" class="actions-cell">
                  <button
                    mat-icon-button
                    color="primary"
                    aria-label="賞与支払届を生成"
                    (click)="openDocumentDialog(row)"
                  >
                    <mat-icon>picture_as_pdf</mat-icon>
                  </button>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef [attr.rowspan]="2" class="actions-header group-header name-header" style="vertical-align: middle; border-bottom: 1px solid #e0e0e0;">操作</th>
                <td mat-cell *matCellDef="let row" class="actions-cell">
                  <button mat-icon-button color="primary" (click)="openDialog(row)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="delete(row)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="headerRowDef"></tr>
              <tr mat-header-row *matHeaderRowDef="subHeaderRowDef"></tr>
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
        background: #fff;
        margin-bottom: 24px;
      }

      /* テーブルスタイル */
      .admin-table {
        width: 100%;
        min-width: 1200px;
      }

      .group-header {
        text-align: center !important;
        font-weight: 600;
        border-bottom: 1px solid #e0e0e0;
      }

      .name-header {
        background-color: #fff;
      }

      .health-group {
        background-color: #e3f2fd;
        color: #0d47a1;
      }

      .pension-group {
        background-color: #e8f5e9;
        color: #1b5e20;
      }

      .total-group {
        background-color: #fff3e0;
        color: #e65100;
      }

      .col-name {
        min-width: 120px;
        position: sticky;
        left: 0;
        background: #fff;
        z-index: 1;
      }

      .number-cell {
        text-align: right;
        padding-right: 16px;
        white-space: nowrap;
      }

      .group-end {
        border-right: 2px solid #e0e0e0 !important;
      }

      .font-bold {
        font-weight: 700;
      }

      .font-medium {
        font-weight: 500;
      }

      .text-secondary {
        color: #666;
      }

      .hover-row:hover {
        background-color: #f5f5f5;
      }

      .actions-header,
      .actions-cell {
        text-align: center;
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
export class BonusPremiumsPage {
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

  readonly headerRowDef = ['payDate', 'employeeName', 'grossAmount', 'standardBonusAmount', 'header-health', 'header-pension', 'header-total', 'document', 'actions'];
  readonly subHeaderRowDef = ['healthEffectiveAmount', 'healthCareFull', 'healthCareEmployee', 'healthCareEmployer', 'pensionEffectiveAmount', 'pensionFull', 'pensionEmployee', 'pensionEmployer', 'totalFull', 'totalEmployee', 'totalEmployer'];
  readonly displayedColumns = [
    'payDate',
    'employeeName',
    'grossAmount',
    'standardBonusAmount',
    'healthEffectiveAmount',
    'healthCareFull',
    'healthCareEmployee',
    'healthCareEmployer',
    'pensionEffectiveAmount',
    'pensionFull',
    'pensionEmployee',
    'pensionEmployer',
    'totalFull',
    'totalEmployee',
    'totalEmployer',
    'document',
    'actions'
  ];

  private readonly employees$ = this.officeId$.pipe(
    switchMap((officeId) => (officeId ? this.employeesService.list(officeId) : of([])))
  );

  readonly rateSummary = signal<{ healthRate?: number; careRate?: number; pensionRate?: number } | null>(null);
  readonly rows = signal<BonusPremiumViewRow[]>([]);

  constructor() {
    // selectedYearMonthが変更されたときにrowsを再計算
    effect(() => {
      const yearMonth = this.selectedYearMonth();
      const subscription = this.officeId$.subscribe((officeId) => {
        if (officeId) {
          this.loadRowsForYearMonth(officeId, yearMonth);
        } else {
          this.rows.set([]);
        }
      });
      return () => subscription.unsubscribe();
    });
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
    // 浮動小数点誤差対策
    const sumFullRounded = Math.round(sumFull * 100) / 100;
    const sumFullRoundedDown = Math.floor(sumFullRounded);
    const employerTotal = sumFullRoundedDown - employeeTotal;
    return { employeeTotal, sumFull, sumFullRoundedDown, employerTotal };
  });

  private async loadRowsForYearMonth(officeId: string, yearMonth: YearMonthString): Promise<void> {
    try {
      const bonuses = await firstValueFrom(
        this.bonusPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth)
      );
      const employees = await firstValueFrom(this.employeesService.list(officeId));
      const office = await firstValueFrom(this.office$);

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
    } catch (error) {
      console.error('賞与保険料の取得に失敗しました', error);
      this.snackBar.open('賞与保険料の取得に失敗しました', '閉じる', { duration: 3000 });
      this.rows.set([]);
    }
  }

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
        // selectedYearMonthが変わらないので、手動で再読み込み
        const officeId = firstValueFrom(this.officeId$);
        const yearMonth = this.selectedYearMonth();
        officeId.then((id) => {
          if (id) {
            this.loadRowsForYearMonth(id, yearMonth);
          }
        });
      }
    });
  }

  async delete(row: BonusPremiumViewRow): Promise<void> {
    const confirmed = window.confirm(
      `${row.employeeName} さんの ${row.payDate} 支給分の賞与を削除しますか？`
    );
    if (!confirmed) return;

    const officeId = await firstValueFrom(this.officeId$);
    if (!officeId) {
      this.snackBar.open('事業所が設定されていません', '閉じる', { duration: 3000 });
      return;
    }

    try {
      await this.bonusPremiumsService.deleteBonusPremium(officeId, row.id);
      this.snackBar.open('削除しました', '閉じる', { duration: 3000 });
      // selectedYearMonthが変わらないので、手動で再読み込み
      const yearMonth = this.selectedYearMonth();
      this.loadRowsForYearMonth(officeId, yearMonth);
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
