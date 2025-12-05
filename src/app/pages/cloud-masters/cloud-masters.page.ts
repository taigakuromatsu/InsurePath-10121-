// src/app/pages/cloud-masters/cloud-masters.page.ts
import { AsyncPipe, DatePipe, NgFor, NgIf, PercentPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { combineLatest, firstValueFrom, map, startWith } from 'rxjs';

import { CloudMasterService } from '../../services/cloud-master.service';
import {
  CloudCareRateTable,
  CloudHealthRateTable,
  CloudPensionRateTable
} from '../../types';
import {
  HEALTH_STANDARD_REWARD_BANDS_DEFAULT,
  PREFECTURE_CODES,
  getKyokaiHealthRatePreset
} from '../../utils/kyokai-presets';
import { CloudCareMasterFormDialogComponent } from './cloud-care-master-form-dialog.component';
import { CloudHealthMasterFormDialogComponent } from './cloud-health-master-form-dialog.component';
import { CloudPensionMasterFormDialogComponent } from './cloud-pension-master-form-dialog.component';

function getCurrentFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  // 4月以降ならその年、3月以前なら前年
  return month >= 4 ? year : year - 1;
}

function buildYearOptions(startYear: number, futureYears: number): number[] {
  const currentYear = new Date().getFullYear();
  const endYear = currentYear + futureYears;
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }
  return years;
}

@Component({
  selector: 'ip-cloud-masters-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    ReactiveFormsModule,
    AsyncPipe,
    NgIf,
    NgFor,
    PercentPipe,
    DatePipe
  ],
  template: `
    <section class="page cloud-masters">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>cloud</mat-icon>
          </div>
          <div class="header-text">
            <h1>クラウドマスタ管理</h1>
            <p>システム全体で共有する保険料率・等級表を管理します。</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <mat-tab-group class="master-tabs">
          <!-- 健康保険マスタタブ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">local_hospital</mat-icon>
              <span>健康保険マスタ</span>
            </ng-template>
            <div class="tab-content">
              <div class="tab-header">
                <div class="tab-title-section">
                  <h2>
                    <mat-icon>local_hospital</mat-icon>
                    健康保険マスタ
                  </h2>
                  <p>年度別・都道府県別の健康保険料率を管理します。</p>
                </div>
                <div class="tab-actions">
                  <mat-form-field appearance="outline" class="year-select">
                    <mat-label>年度</mat-label>
                    <mat-select [formControl]="healthYearControl">
                      <mat-option *ngFor="let year of availableYears" [value]="year">
                        {{ year }}年度
                      </mat-option>
                    </mat-select>
                  </mat-form-field>
                  <button mat-stroked-button color="primary" type="button" (click)="bulkRegisterKyokaiHealth()">
                    <mat-icon>cloud_download</mat-icon>
                    協会けんぽ都道府県別ひな形一括登録
                  </button>
                  <button mat-raised-button color="primary" (click)="openHealthDialog()">
                    <mat-icon>add</mat-icon>
                    新規登録
                  </button>
                </div>
              </div>

              <div class="table-container">
                <table
                  mat-table
                  [dataSource]="(filteredHealthTables$ | async) || []"
                  class="master-table"
                >
                  <ng-container matColumnDef="prefCode">
                    <th mat-header-cell *matHeaderCellDef>都道府県コード</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="pref-code-badge">{{ row.kyokaiPrefCode }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="prefName">
                    <th mat-header-cell *matHeaderCellDef>都道府県名</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="pref-name-text">{{ row.kyokaiPrefName }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="rate">
                    <th mat-header-cell *matHeaderCellDef>健康保険料率</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="rate-value">{{ row.healthRate | percent: '1.2-2' }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="bands">
                    <th mat-header-cell *matHeaderCellDef>標準報酬等級数</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="bands-count">{{ row.bands?.length || 0 }}件</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="updatedAt">
                    <th mat-header-cell *matHeaderCellDef>更新日時</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="updated-at-text">{{ row.updatedAt | date: 'yyyy/MM/dd HH:mm' }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef class="actions-header">操作</th>
                    <td mat-cell *matCellDef="let row" class="actions-cell">
                      <button mat-icon-button color="primary" (click)="openHealthDialog(row)" title="編集">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" (click)="deleteHealth(row)" title="削除">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="healthDisplayedColumns" class="table-header-row"></tr>
                  <tr mat-row *matRowDef="let row; columns: healthDisplayedColumns" class="table-row"></tr>
                </table>
                <div class="empty-state" *ngIf="(filteredHealthTables$ | async)?.length === 0">
                  <mat-icon>inbox</mat-icon>
                  <p>マスタが登録されていません</p>
                  <button mat-stroked-button color="primary" (click)="openHealthDialog()">
                    <mat-icon>add</mat-icon>
                    最初のマスタを登録
                  </button>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- 介護保険マスタタブ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">elderly</mat-icon>
              <span>介護保険マスタ</span>
            </ng-template>
            <div class="tab-content">
              <div class="tab-header">
                <div class="tab-title-section">
                  <h2>
                    <mat-icon>elderly</mat-icon>
                    介護保険マスタ
                  </h2>
                  <p>年度別の介護保険料率を管理します。</p>
                </div>
                <button mat-raised-button color="primary" (click)="openCareDialog()">
                  <mat-icon>add</mat-icon>
                  新規登録
                </button>
              </div>

              <div class="table-container">
                <table
                  mat-table
                  [dataSource]="(careTables$ | async) || []"
                  class="master-table"
                >
                  <ng-container matColumnDef="year">
                    <th mat-header-cell *matHeaderCellDef>年度</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="year-badge">{{ row.year }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="rate">
                    <th mat-header-cell *matHeaderCellDef>介護保険料率</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="rate-value">{{ row.careRate | percent: '1.2-2' }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="updatedAt">
                    <th mat-header-cell *matHeaderCellDef>更新日時</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="updated-at-text">{{ row.updatedAt | date: 'yyyy/MM/dd HH:mm' }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef class="actions-header">操作</th>
                    <td mat-cell *matCellDef="let row" class="actions-cell">
                      <button mat-icon-button color="primary" (click)="openCareDialog(row)" title="編集">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" (click)="deleteCare(row)" title="削除">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="careDisplayedColumns" class="table-header-row"></tr>
                  <tr mat-row *matRowDef="let row; columns: careDisplayedColumns" class="table-row"></tr>
                </table>
                <div class="empty-state" *ngIf="(careTables$ | async)?.length === 0">
                  <mat-icon>inbox</mat-icon>
                  <p>マスタが登録されていません</p>
                  <button mat-stroked-button color="primary" (click)="openCareDialog()">
                    <mat-icon>add</mat-icon>
                    最初のマスタを登録
                  </button>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- 厚生年金マスタタブ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">account_balance</mat-icon>
              <span>厚生年金マスタ</span>
            </ng-template>
            <div class="tab-content">
              <div class="tab-header">
                <div class="tab-title-section">
                  <h2>
                    <mat-icon>account_balance</mat-icon>
                    厚生年金マスタ
                  </h2>
                  <p>年度別の厚生年金料率と標準報酬等級を管理します。</p>
                </div>
                <button mat-raised-button color="primary" (click)="openPensionDialog()">
                  <mat-icon>add</mat-icon>
                  新規登録
                </button>
              </div>

              <div class="table-container">
                <table
                  mat-table
                  [dataSource]="(pensionTables$ | async) || []"
                  class="master-table"
                >
                  <ng-container matColumnDef="year">
                    <th mat-header-cell *matHeaderCellDef>年度</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="year-badge">{{ row.year }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="rate">
                    <th mat-header-cell *matHeaderCellDef>厚生年金料率</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="rate-value">{{ row.pensionRate | percent: '1.2-2' }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="bands">
                    <th mat-header-cell *matHeaderCellDef>標準報酬等級数</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="bands-count">{{ row.bands?.length || 0 }}件</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="updatedAt">
                    <th mat-header-cell *matHeaderCellDef>更新日時</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="updated-at-text">{{ row.updatedAt | date: 'yyyy/MM/dd HH:mm' }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef class="actions-header">操作</th>
                    <td mat-cell *matCellDef="let row" class="actions-cell">
                      <button mat-icon-button color="primary" (click)="openPensionDialog(row)" title="編集">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" (click)="deletePension(row)" title="削除">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="pensionDisplayedColumns" class="table-header-row"></tr>
                  <tr mat-row *matRowDef="let row; columns: pensionDisplayedColumns" class="table-row"></tr>
                </table>
                <div class="empty-state" *ngIf="(pensionTables$ | async)?.length === 0">
                  <mat-icon>inbox</mat-icon>
                  <p>マスタが登録されていません</p>
                  <button mat-stroked-button color="primary" (click)="openPensionDialog()">
                    <mat-icon>add</mat-icon>
                    最初のマスタを登録
                  </button>
                </div>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .header-card {
        margin-bottom: 1.5rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .header-card ::ng-deep .mat-mdc-card-content {
        padding: 0;
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem;
      }

      .header-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 12px;
      }

      .header-icon mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: white;
      }

      .header-text h1 {
        margin: 0 0 0.5rem 0;
        font-size: 1.75rem;
        font-weight: 600;
      }

      .header-text p {
        margin: 0;
        opacity: 0.9;
        font-size: 1rem;
      }

      .content-card {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .master-tabs ::ng-deep .mat-mdc-tab-label {
        min-width: 180px;
      }

      .tab-icon {
        margin-right: 8px;
        vertical-align: middle;
      }

      .tab-content {
        padding: 2rem;
      }

      .tab-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1.5rem;
        margin-bottom: 2rem;
        padding-bottom: 1.5rem;
        border-bottom: 2px solid #e0e0e0;
      }

      .tab-title-section h2 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0 0 0.5rem 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #333;
      }

      .tab-title-section h2 mat-icon {
        color: #667eea;
      }

      .tab-title-section p {
        margin: 0;
        color: #666;
        font-size: 0.95rem;
      }

      .tab-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .year-select {
        width: 150px;
      }

      .table-container {
        position: relative;
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
      }

      table.master-table {
        width: 100%;
        background: white;
      }

      .table-header-row {
        background: #f5f5f5;
      }

      table.master-table th {
        font-weight: 600;
        color: #555;
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 16px;
      }

      table.master-table td {
        padding: 16px;
        border-bottom: 1px solid #f0f0f0;
      }

      .table-row {
        transition: background-color 0.2s ease;
      }

      .table-row:hover {
        background-color: #f9f9f9;
      }

      .table-row:last-child td {
        border-bottom: none;
      }

      .year-badge {
        display: inline-block;
        padding: 4px 12px;
        background: #e3f2fd;
        color: #1976d2;
        border-radius: 16px;
        font-weight: 600;
        font-size: 0.875rem;
      }

      .pref-code-badge {
        display: inline-block;
        padding: 4px 10px;
        background: #f3e5f5;
        color: #7b1fa2;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.875rem;
      }

      .pref-name-text {
        color: #333;
        font-weight: 500;
      }

      .rate-value {
        font-weight: 600;
        color: #1976d2;
        font-size: 1rem;
      }

      .bands-count {
        display: inline-block;
        padding: 4px 10px;
        background: #f3e5f5;
        color: #7b1fa2;
        border-radius: 12px;
        font-weight: 500;
        font-size: 0.875rem;
      }

      .updated-at-text {
        color: #666;
        font-size: 0.875rem;
      }

      .actions-header {
        text-align: center;
      }

      .actions-cell {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        text-align: center;
        color: #999;
      }

      .empty-state mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 1rem;
        opacity: 0.5;
      }

      .empty-state p {
        margin: 0 0 1.5rem 0;
        font-size: 1.1rem;
      }

      button[mat-raised-button] {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
      }

      button[mat-raised-button]:hover:not(:disabled) {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
      }

      button[mat-icon-button] {
        transition: all 0.2s ease;
      }

      button[mat-icon-button]:hover {
        transform: scale(1.1);
      }

      @media (max-width: 768px) {
        .tab-header {
          flex-direction: column;
          align-items: stretch;
        }

        .tab-header button {
          width: 100%;
        }

        .header-content {
          flex-direction: column;
          text-align: center;
        }
      }
    `
  ]
})
export class CloudMastersPage {
  private readonly cloudMasterService = inject(CloudMasterService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly healthYearControl = new FormControl<number>(getCurrentFiscalYear());
  
  // 2000年度〜「今年+10年」まで
  readonly availableYears = buildYearOptions(2000, 10);

  readonly healthTables$ = this.cloudMasterService.listCloudHealthRateTables();
  readonly filteredHealthTables$ = combineLatest([
    this.healthTables$,
    this.healthYearControl.valueChanges.pipe(startWith(this.healthYearControl.value))
  ]).pipe(
    map(([tables, year]) => {
      if (!year) return tables;
      return tables.filter((t) => t.year === year);
    })
  );

  readonly careTables$ = this.cloudMasterService.listCloudCareRateTables();
  readonly pensionTables$ = this.cloudMasterService.listCloudPensionRateTables();

  readonly healthDisplayedColumns = ['prefCode', 'prefName', 'rate', 'bands', 'updatedAt', 'actions'];
  readonly careDisplayedColumns = ['year', 'rate', 'updatedAt', 'actions'];
  readonly pensionDisplayedColumns = ['year', 'rate', 'bands', 'updatedAt', 'actions'];

  async openHealthDialog(table?: CloudHealthRateTable): Promise<void> {
    try {
      const ref = this.dialog.open(CloudHealthMasterFormDialogComponent, {
        data: { table, year: this.healthYearControl.value ?? getCurrentFiscalYear() },
        width: '960px'
      });
      const result = await firstValueFrom(ref.afterClosed());
      if (!result) return;
      await this.cloudMasterService.saveCloudHealthRateTable(result);
      this.snackBar.open('健康保険クラウドマスタを保存しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('健康保険クラウドマスタの保存に失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async deleteHealth(table: CloudHealthRateTable): Promise<void> {
    if (!confirm('削除してもよろしいですか？')) return;
    try {
      await this.cloudMasterService.deleteCloudHealthRateTable(table.year, table.kyokaiPrefCode);
      this.snackBar.open('健康保険クラウドマスタを削除しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('健康保険クラウドマスタの削除に失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async bulkRegisterKyokaiHealth(): Promise<void> {
    const year = this.healthYearControl.value ?? getCurrentFiscalYear();

    const confirmed = confirm(
      `${year}年度の協会けんぽ健康保険料率を全都道府県分まとめて登録（既存データは上書き）します。よろしいですか？`
    );
    if (!confirmed) return;

    try {
      const codes = Object.keys(PREFECTURE_CODES);

      const tasks = codes.map((code) => {
        const preset = getKyokaiHealthRatePreset(code, year);
        
        // プリセットが存在しない年度（2026以降など）は料率0でレコードを作成
        const healthRate = preset?.healthRate ?? 0;
        const bands = preset?.bands ?? HEALTH_STANDARD_REWARD_BANDS_DEFAULT;

        const payload: Partial<CloudHealthRateTable> = {
          year,
          planType: 'kyokai',
          kyokaiPrefCode: code,
          kyokaiPrefName: PREFECTURE_CODES[code],
          healthRate,
          bands
        };

        // saveCloudHealthRateTable は upsert（year+prefCode 単位で上書き）想定
        return this.cloudMasterService.saveCloudHealthRateTable(payload);
      });

      await Promise.all(tasks);
      const hasPreset = year === 2024 || year === 2025;
      const message = hasPreset
        ? '協会けんぽ健康保険料率を一括登録しました'
        : '協会けんぽ健康保険料率のクラウドマスタを一括登録しました（プリセットがない年度は料率0で作成しています）';
      this.snackBar.open(message, '閉じる', {
        duration: 4000
      });
    } catch (error) {
      console.error(error);
      this.snackBar.open('協会けんぽ健康保険料率の一括登録に失敗しました', '閉じる', {
        duration: 4000
      });
    }
  }

  async openCareDialog(table?: CloudCareRateTable): Promise<void> {
    try {
      const ref = this.dialog.open(CloudCareMasterFormDialogComponent, {
        data: { table },
        width: '600px'
      });
      const result = await firstValueFrom(ref.afterClosed());
      if (!result) return;
      await this.cloudMasterService.saveCloudCareRateTable(result);
      this.snackBar.open('介護保険クラウドマスタを保存しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('介護保険クラウドマスタの保存に失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async deleteCare(table: CloudCareRateTable): Promise<void> {
    if (!confirm('削除してもよろしいですか？')) return;
    try {
      await this.cloudMasterService.deleteCloudCareRateTable(table.year);
      this.snackBar.open('介護保険クラウドマスタを削除しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('介護保険クラウドマスタの削除に失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async openPensionDialog(table?: CloudPensionRateTable): Promise<void> {
    try {
      const ref = this.dialog.open(CloudPensionMasterFormDialogComponent, {
        data: { table },
        width: '960px'
      });
      const result = await firstValueFrom(ref.afterClosed());
      if (!result) return;
      await this.cloudMasterService.saveCloudPensionRateTable(result);
      this.snackBar.open('厚生年金クラウドマスタを保存しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('厚生年金クラウドマスタの保存に失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async deletePension(table: CloudPensionRateTable): Promise<void> {
    if (!confirm('削除してもよろしいですか？')) return;
    try {
      await this.cloudMasterService.deleteCloudPensionRateTable(table.year);
      this.snackBar.open('厚生年金クラウドマスタを削除しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('厚生年金クラウドマスタの削除に失敗しました', '閉じる', { duration: 3000 });
    }
  }
}

