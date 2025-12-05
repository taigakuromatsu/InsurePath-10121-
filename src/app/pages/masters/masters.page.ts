import { AsyncPipe, NgIf, PercentPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom, of, switchMap } from 'rxjs';

import { CareMasterFormDialogComponent } from './care-master-form-dialog.component';
import { HealthMasterFormDialogComponent } from './health-master-form-dialog.component';
import { PensionMasterFormDialogComponent } from './pension-master-form-dialog.component';
import { CurrentOfficeService } from '../../services/current-office.service';
import { MastersService } from '../../services/masters.service';
import { CareRateTable, HealthRateTable, Office, PensionRateTable } from '../../types';

@Component({
  selector: 'ip-masters-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    AsyncPipe,
    NgIf,
    PercentPipe
  ],
  template: `
    <section class="page masters">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>settings</mat-icon>
          </div>
          <div class="header-text">
        <h1>保険料率管理</h1>
        <p>保険料率や標準報酬等級を適用開始年月別に管理します。</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <mat-tab-group class="master-tabs">
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
                <p>協会けんぽ・組合健保の料率と標準報酬等級を管理します。</p>
              </div>
              <button mat-raised-button color="primary" (click)="openHealthDialog()" [disabled]="!(office$ | async)">
                  <mat-icon>add</mat-icon>
                新規登録
              </button>
            </div>
            <div class="screen-rules">
              <p>
                この画面では、保険料率が「改定される月」ごとに1行を登録します。<br>
                改定があった月だけ新しい行を追加してください。<br>
                対象月の計算では、「その月より前に登録された中で一番新しい行」が自動的に使われます。<br>
                過去の計算に使うため、過去の行は基本的に削除しないことをおすすめします。
              </p>
            </div>

              <div class="table-container">
                <table mat-table [dataSource]="(healthTables$ | async) || []" class="master-table">
              <ng-container matColumnDef="effectiveYearMonth">
                <th mat-header-cell *matHeaderCellDef>適用開始年月</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="year-month-badge">{{ row.effectiveYear }}年{{ row.effectiveMonth }}月</span>
                    </td>
              </ng-container>

              <ng-container matColumnDef="plan">
                <th mat-header-cell *matHeaderCellDef>プラン</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="plan-badge" [class.kyokai]="row.planType === 'kyokai'" [class.kumiai]="row.planType === 'kumiai'">
                        {{ row.planType === 'kyokai' ? '協会けんぽ' : '組合健保' }}
                      </span>
                    </td>
              </ng-container>

              <ng-container matColumnDef="area">
                <th mat-header-cell *matHeaderCellDef>都道府県 / 組合</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="area-text">{{ row.kyokaiPrefName || row.unionName || '-' }}</span>
                    </td>
              </ng-container>

              <ng-container matColumnDef="rate">
                <th mat-header-cell *matHeaderCellDef>料率</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="rate-value">{{ row.healthRate | percent: '1.2-2' }}</span>
                    </td>
              </ng-container>

              <ng-container matColumnDef="bands">
                <th mat-header-cell *matHeaderCellDef>等級数</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="bands-count">{{ row.bands?.length || 0 }}件</span>
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
                <div class="empty-state" *ngIf="(healthTables$ | async)?.length === 0">
                  <mat-icon>inbox</mat-icon>
                  <p>マスタが登録されていません</p>
                  <button mat-stroked-button color="primary" (click)="openHealthDialog()" [disabled]="!(office$ | async)">
                    <mat-icon>add</mat-icon>
                    最初のマスタを登録
                  </button>
                </div>
              </div>
            </div>
          </mat-tab>

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
                <p>適用開始年月別の介護保険料率を管理します。</p>
              </div>
              <button mat-raised-button color="primary" (click)="openCareDialog()" [disabled]="!(office$ | async)">
                  <mat-icon>add</mat-icon>
                新規登録
              </button>
            </div>
            <div class="screen-rules">
              <p>
                この画面では、保険料率が「改定される月」ごとに1行を登録します。<br>
                改定があった月だけ新しい行を追加してください。<br>
                対象月の計算では、「その月より前に登録された中で一番新しい行」が自動的に使われます。<br>
                過去の計算に使うため、過去の行は基本的に削除しないことをおすすめします。
              </p>
            </div>

              <div class="table-container">
                <table mat-table [dataSource]="(careTables$ | async) || []" class="master-table">
              <ng-container matColumnDef="effectiveYearMonth">
                <th mat-header-cell *matHeaderCellDef>適用開始年月</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="year-month-badge">{{ row.effectiveYear }}年{{ row.effectiveMonth }}月</span>
                    </td>
              </ng-container>

              <ng-container matColumnDef="rate">
                <th mat-header-cell *matHeaderCellDef>料率</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="rate-value">{{ row.careRate | percent: '1.2-2' }}</span>
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
                  <button mat-stroked-button color="primary" (click)="openCareDialog()" [disabled]="!(office$ | async)">
                    <mat-icon>add</mat-icon>
                    最初のマスタを登録
                  </button>
                </div>
              </div>
            </div>
          </mat-tab>

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
                <p>適用開始年月別の厚生年金料率と標準報酬等級を管理します。</p>
              </div>
              <button mat-raised-button color="primary" (click)="openPensionDialog()" [disabled]="!(office$ | async)">
                  <mat-icon>add</mat-icon>
                新規登録
              </button>
            </div>
            <div class="screen-rules">
              <p>
                この画面では、保険料率が「改定される月」ごとに1行を登録します。<br>
                改定があった月だけ新しい行を追加してください。<br>
                対象月の計算では、「その月より前に登録された中で一番新しい行」が自動的に使われます。<br>
                過去の計算に使うため、過去の行は基本的に削除しないことをおすすめします。
              </p>
            </div>

              <div class="table-container">
                <table mat-table [dataSource]="(pensionTables$ | async) || []" class="master-table">
              <ng-container matColumnDef="effectiveYearMonth">
                <th mat-header-cell *matHeaderCellDef>適用開始年月</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="year-month-badge">{{ row.effectiveYear }}年{{ row.effectiveMonth }}月</span>
                    </td>
              </ng-container>

              <ng-container matColumnDef="rate">
                <th mat-header-cell *matHeaderCellDef>料率</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="rate-value">{{ row.pensionRate | percent: '1.2-2' }}</span>
                    </td>
              </ng-container>

              <ng-container matColumnDef="bands">
                <th mat-header-cell *matHeaderCellDef>等級数</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="bands-count">{{ row.bands?.length || 0 }}件</span>
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
                  <button mat-stroked-button color="primary" (click)="openPensionDialog()" [disabled]="!(office$ | async)">
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

      .year-month-badge {
        display: inline-block;
        padding: 4px 12px;
        background: #e3f2fd;
        color: #1976d2;
        border-radius: 16px;
        font-weight: 600;
        font-size: 0.875rem;
      }

      .screen-rules {
        margin-bottom: 1.5rem;
        padding: 1rem 1.5rem;
        background: #f5f5f5;
        border-radius: 8px;
        border-left: 4px solid #667eea;
      }

      .screen-rules p {
        margin: 0;
        font-size: 0.875rem;
        color: #666;
        line-height: 1.8;
      }

      .plan-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 16px;
        font-weight: 500;
        font-size: 0.875rem;
      }

      .plan-badge.kyokai {
        background: #e8f5e9;
        color: #2e7d32;
      }

      .plan-badge.kumiai {
        background: #fff3e0;
        color: #e65100;
      }

      .area-text {
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
export class MastersPage {
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly mastersService = inject(MastersService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly office$ = this.currentOffice.office$;

  readonly healthTables$ = this.office$.pipe(
    switchMap((office) => (office ? this.mastersService.listHealthRateTables(office.id) : of([] as HealthRateTable[])))
  );
  readonly careTables$ = this.office$.pipe(
    switchMap((office) => (office ? this.mastersService.listCareRateTables(office.id) : of([] as CareRateTable[])))
  );
  readonly pensionTables$ = this.office$.pipe(
    switchMap((office) => (office ? this.mastersService.listPensionRateTables(office.id) : of([] as PensionRateTable[])))
  );

  readonly healthDisplayedColumns = ['effectiveYearMonth', 'plan', 'area', 'rate', 'bands', 'actions'];
  readonly careDisplayedColumns = ['effectiveYearMonth', 'rate', 'actions'];
  readonly pensionDisplayedColumns = ['effectiveYearMonth', 'rate', 'bands', 'actions'];

  private async requireOffice(): Promise<Office> {
    const office = await firstValueFrom(this.office$);
    if (!office) {
      throw new Error('事業所が選択されていません');
    }
    return office;
  }

  async openHealthDialog(table?: HealthRateTable): Promise<void> {
    try {
      const office = await this.requireOffice();
      const ref = this.dialog.open(HealthMasterFormDialogComponent, {
        data: { office, table },
        width: '960px'
      });
      const result = await firstValueFrom(ref.afterClosed());
      if (!result) return;
      await this.mastersService.saveHealthRateTable(office.id, result);
      this.snackBar.open('健康保険マスタを保存しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('健康保険マスタの保存に失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async deleteHealth(table: HealthRateTable): Promise<void> {
    if (!confirm('削除してもよろしいですか？')) return;
    try {
      const office = await this.requireOffice();
      await this.mastersService.deleteHealthRateTable(office.id, table.id);
      this.snackBar.open('健康保険マスタを削除しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('健康保険マスタの削除に失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async openCareDialog(table?: CareRateTable): Promise<void> {
    try {
      const office = await this.requireOffice();
      const ref = this.dialog.open(CareMasterFormDialogComponent, {
        data: { table },
        width: '600px'
      });
      const result = await firstValueFrom(ref.afterClosed());
      if (!result) return;
      await this.mastersService.saveCareRateTable(office.id, result);
      this.snackBar.open('介護保険マスタを保存しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('介護保険マスタの保存に失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async deleteCare(table: CareRateTable): Promise<void> {
    if (!confirm('削除してもよろしいですか？')) return;
    try {
      const office = await this.requireOffice();
      await this.mastersService.deleteCareRateTable(office.id, table.id);
      this.snackBar.open('介護保険マスタを削除しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('介護保険マスタの削除に失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async openPensionDialog(table?: PensionRateTable): Promise<void> {
    try {
      const office = await this.requireOffice();
      const ref = this.dialog.open(PensionMasterFormDialogComponent, {
        data: { table },
        width: '960px'
      });
      const result = await firstValueFrom(ref.afterClosed());
      if (!result) return;
      await this.mastersService.savePensionRateTable(office.id, result);
      this.snackBar.open('厚生年金マスタを保存しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('厚生年金マスタの保存に失敗しました', '閉じる', { duration: 3000 });
    }
  }

  async deletePension(table: PensionRateTable): Promise<void> {
    if (!confirm('削除してもよろしいですか？')) return;
    try {
      const office = await this.requireOffice();
      await this.mastersService.deletePensionRateTable(office.id, table.id);
      this.snackBar.open('厚生年金マスタを削除しました', '閉じる', { duration: 3000 });
    } catch (error) {
      console.error(error);
      this.snackBar.open('厚生年金マスタの削除に失敗しました', '閉じる', { duration: 3000 });
    }
  }
}
