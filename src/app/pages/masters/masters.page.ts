import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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
    MatDialogModule,
    MatSnackBarModule,
    AsyncPipe,
    NgIf,
    NgFor
  ],
  template: `
    <section class="page masters">
      <mat-card>
        <h1>マスタ管理</h1>
        <p>保険料率や標準報酬等級を年度別に管理します。</p>
      </mat-card>

      <mat-card>
        <mat-tab-group>
          <mat-tab label="健康保険マスタ">
            <div class="tab-header">
              <div>
                <h2>健康保険マスタ</h2>
                <p>協会けんぽ・組合健保の料率と標準報酬等級を管理します。</p>
              </div>
              <button mat-raised-button color="primary" (click)="openHealthDialog()" [disabled]="!(office$ | async)">
                新規登録
              </button>
            </div>

            <table mat-table [dataSource]="healthTables$ | async" class="master-table">
              <ng-container matColumnDef="year">
                <th mat-header-cell *matHeaderCellDef>年度</th>
                <td mat-cell *matCellDef="let row">{{ row.year }}</td>
              </ng-container>

              <ng-container matColumnDef="plan">
                <th mat-header-cell *matHeaderCellDef>プラン</th>
                <td mat-cell *matCellDef="let row">{{ row.planType === 'kyokai' ? '協会けんぽ' : '組合健保' }}</td>
              </ng-container>

              <ng-container matColumnDef="area">
                <th mat-header-cell *matHeaderCellDef>都道府県 / 組合</th>
                <td mat-cell *matCellDef="let row">{{ row.kyokaiPrefName || row.unionName || '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="rate">
                <th mat-header-cell *matHeaderCellDef>料率</th>
                <td mat-cell *matCellDef="let row">{{ row.healthRate | percent: '1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="bands">
                <th mat-header-cell *matHeaderCellDef>等級数</th>
                <td mat-cell *matCellDef="let row">{{ row.bands?.length || 0 }}</td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>操作</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-button color="primary" (click)="openHealthDialog(row)">編集</button>
                  <button mat-button color="warn" (click)="deleteHealth(row)">削除</button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="healthDisplayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: healthDisplayedColumns"></tr>
            </table>
          </mat-tab>

          <mat-tab label="介護保険マスタ">
            <div class="tab-header">
              <div>
                <h2>介護保険マスタ</h2>
                <p>年度別の介護保険料率を管理します。</p>
              </div>
              <button mat-raised-button color="primary" (click)="openCareDialog()" [disabled]="!(office$ | async)">
                新規登録
              </button>
            </div>

            <table mat-table [dataSource]="careTables$ | async" class="master-table">
              <ng-container matColumnDef="year">
                <th mat-header-cell *matHeaderCellDef>年度</th>
                <td mat-cell *matCellDef="let row">{{ row.year }}</td>
              </ng-container>

              <ng-container matColumnDef="rate">
                <th mat-header-cell *matHeaderCellDef>料率</th>
                <td mat-cell *matCellDef="let row">{{ row.careRate | percent: '1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>操作</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-button color="primary" (click)="openCareDialog(row)">編集</button>
                  <button mat-button color="warn" (click)="deleteCare(row)">削除</button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="careDisplayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: careDisplayedColumns"></tr>
            </table>
          </mat-tab>

          <mat-tab label="厚生年金マスタ">
            <div class="tab-header">
              <div>
                <h2>厚生年金マスタ</h2>
                <p>年度別の厚生年金料率と標準報酬等級を管理します。</p>
              </div>
              <button mat-raised-button color="primary" (click)="openPensionDialog()" [disabled]="!(office$ | async)">
                新規登録
              </button>
            </div>

            <table mat-table [dataSource]="pensionTables$ | async" class="master-table">
              <ng-container matColumnDef="year">
                <th mat-header-cell *matHeaderCellDef>年度</th>
                <td mat-cell *matCellDef="let row">{{ row.year }}</td>
              </ng-container>

              <ng-container matColumnDef="rate">
                <th mat-header-cell *matHeaderCellDef>料率</th>
                <td mat-cell *matCellDef="let row">{{ row.pensionRate | percent: '1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="bands">
                <th mat-header-cell *matHeaderCellDef>等級数</th>
                <td mat-cell *matCellDef="let row">{{ row.bands?.length || 0 }}</td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>操作</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-button color="primary" (click)="openPensionDialog(row)">編集</button>
                  <button mat-button color="warn" (click)="deletePension(row)">削除</button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="pensionDisplayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: pensionDisplayedColumns"></tr>
            </table>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .tab-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }

      table.master-table {
        width: 100%;
      }

      table.master-table th,
      table.master-table td {
        padding: 8px 12px;
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

  readonly healthDisplayedColumns = ['year', 'plan', 'area', 'rate', 'bands', 'actions'];
  readonly careDisplayedColumns = ['year', 'rate', 'actions'];
  readonly pensionDisplayedColumns = ['year', 'rate', 'bands', 'actions'];

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
