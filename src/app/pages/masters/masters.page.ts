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
    <div class="page-container">
      <header class="page-header">
        <div>
        <h1>保険料率管理</h1>
          <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">保険料率や標準報酬等級を適用開始年月別に管理します。</p>
        </div>
      </header>

      <mat-card class="content-card">
        <mat-tab-group class="master-tabs" animationDuration="0ms">
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">local_hospital</mat-icon>
              <span>健康保険マスタ</span>
            </ng-template>
            <div class="tab-content">
              <div class="flex-row justify-between align-center mb-4">
                <div>
                  <h2 class="mat-h2 mb-2">健康保険マスタ</h2>
                  <p class="mat-body-2" style="color: #666">協会けんぽ・組合健保の料率と標準報酬等級を管理します。</p>
              </div>
                <button mat-flat-button color="primary" (click)="openHealthDialog()" [disabled]="!(office$ | async)">
                  <mat-icon>add</mat-icon>
                新規登録
              </button>
            </div>
              
              <div class="screen-rules mb-4">
              <p>
                この画面では、保険料率が「改定される月」ごとに1行を登録します。<br>
                改定があった月だけ新しい行を追加してください。<br>
                対象月の計算では、「その月より前に登録された中で一番新しい行」が自動的に使われます。<br>
                過去の計算に使うため、過去の行は基本的に削除しないことをおすすめします。
              </p>
            </div>

              <div class="table-container">
                <table mat-table [dataSource]="(healthTables$ | async) || []" class="admin-table">
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
                    <th mat-header-cell *matHeaderCellDef class="actions-header" style="width: 100px; text-align: center;">操作</th>
                    <td mat-cell *matCellDef="let row" class="actions-cell">
                      <div class="flex-row gap-2 justify-center">
                        <button mat-icon-button color="primary" (click)="openHealthDialog(row)" matTooltip="編集">
                        <mat-icon>edit</mat-icon>
                      </button>
                        <button mat-icon-button color="warn" (click)="deleteHealth(row)" matTooltip="削除">
                        <mat-icon>delete</mat-icon>
                      </button>
                      </div>
                </td>
              </ng-container>

                  <tr mat-header-row *matHeaderRowDef="healthDisplayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: healthDisplayedColumns"></tr>
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
              <div class="flex-row justify-between align-center mb-4">
                <div>
                  <h2 class="mat-h2 mb-2">介護保険マスタ</h2>
                  <p class="mat-body-2" style="color: #666">適用開始年月別の介護保険料率を管理します。</p>
              </div>
                <button mat-flat-button color="primary" (click)="openCareDialog()" [disabled]="!(office$ | async)">
                  <mat-icon>add</mat-icon>
                新規登録
              </button>
            </div>

              <div class="screen-rules mb-4">
              <p>
                この画面では、保険料率が「改定される月」ごとに1行を登録します。<br>
                改定があった月だけ新しい行を追加してください。<br>
                対象月の計算では、「その月より前に登録された中で一番新しい行」が自動的に使われます。<br>
                過去の計算に使うため、過去の行は基本的に削除しないことをおすすめします。
              </p>
            </div>

              <div class="table-container">
                <table mat-table [dataSource]="(careTables$ | async) || []" class="admin-table">
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
                    <th mat-header-cell *matHeaderCellDef class="actions-header" style="width: 100px; text-align: center;">操作</th>
                    <td mat-cell *matCellDef="let row" class="actions-cell">
                      <div class="flex-row gap-2 justify-center">
                        <button mat-icon-button color="primary" (click)="openCareDialog(row)" matTooltip="編集">
                        <mat-icon>edit</mat-icon>
                      </button>
                        <button mat-icon-button color="warn" (click)="deleteCare(row)" matTooltip="削除">
                        <mat-icon>delete</mat-icon>
                      </button>
                      </div>
                </td>
              </ng-container>

                  <tr mat-header-row *matHeaderRowDef="careDisplayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: careDisplayedColumns"></tr>
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
              <div class="flex-row justify-between align-center mb-4">
                <div>
                  <h2 class="mat-h2 mb-2">厚生年金マスタ</h2>
                  <p class="mat-body-2" style="color: #666">適用開始年月別の厚生年金料率と標準報酬等級を管理します。</p>
              </div>
                <button mat-flat-button color="primary" (click)="openPensionDialog()" [disabled]="!(office$ | async)">
                  <mat-icon>add</mat-icon>
                新規登録
              </button>
            </div>

              <div class="screen-rules mb-4">
              <p>
                この画面では、保険料率が「改定される月」ごとに1行を登録します。<br>
                改定があった月だけ新しい行を追加してください。<br>
                対象月の計算では、「その月より前に登録された中で一番新しい行」が自動的に使われます。<br>
                過去の計算に使うため、過去の行は基本的に削除しないことをおすすめします。
              </p>
            </div>

              <div class="table-container">
                <table mat-table [dataSource]="(pensionTables$ | async) || []" class="admin-table">
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
                    <th mat-header-cell *matHeaderCellDef class="actions-header" style="width: 100px; text-align: center;">操作</th>
                    <td mat-cell *matCellDef="let row" class="actions-cell">
                      <div class="flex-row gap-2 justify-center">
                        <button mat-icon-button color="primary" (click)="openPensionDialog(row)" matTooltip="編集">
                        <mat-icon>edit</mat-icon>
                      </button>
                        <button mat-icon-button color="warn" (click)="deletePension(row)" matTooltip="削除">
                        <mat-icon>delete</mat-icon>
                      </button>
                      </div>
                </td>
              </ng-container>

                  <tr mat-header-row *matHeaderRowDef="pensionDisplayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: pensionDisplayedColumns"></tr>
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
    </div>
  `,
  styles: [
    `
      .tab-icon {
        margin-right: 8px;
        vertical-align: middle;
      }

      .tab-content {
        padding: 24px 0;
      }

      .table-container {
        position: relative;
        overflow-x: auto;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 4px;
      }

      .year-month-badge {
        display: inline-block;
        padding: 4px 8px;
        background: #e3f2fd;
        color: #1565c0;
        border-radius: 4px;
        font-weight: 500;
        font-size: 13px;
      }

      .screen-rules {
        padding: 12px 16px;
        background: #f8f9fa;
        border-left: 3px solid #667eea;
        border-radius: 0 4px 4px 0;
        
        p {
        margin: 0;
          font-size: 13px;
          color: #555;
          line-height: 1.6;
        }
      }

      .plan-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;

        &.kyokai {
        background: #e8f5e9;
        color: #2e7d32;
      }
        &.kumiai {
        background: #fff3e0;
        color: #e65100;
        }
      }

      .area-text {
        font-weight: 500;
      }

      .rate-value {
        font-family: 'Roboto Mono', monospace;
        font-weight: 500;
      }

      .bands-count {
        color: #666;
        font-size: 13px;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        color: #999;
        background: #fff;
        
        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          margin-bottom: 16px;
          opacity: 0.3;
      }

        p {
          margin: 0 0 16px 0;
          font-size: 14px;
      }

        // ボタン内のアイコンとテキストの配置を調整
        button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          
          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
            margin: 0;
            opacity: 1;
            vertical-align: middle;
          }
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
        width: '1200px',
        maxWidth: '95vw'
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
        data: { office, table },
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
        data: { office, table },
        width: '1200px',
        maxWidth: '95vw'
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
