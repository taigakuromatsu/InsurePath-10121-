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
import { MatExpansionModule } from '@angular/material/expansion';
import { combineLatest, of, switchMap, firstValueFrom, Subscription, map } from 'rxjs';

import { CurrentOfficeService } from '../../../services/current-office.service';
import { CurrentUserService } from '../../../services/current-user.service';
import { EmployeesService } from '../../../services/employees.service';
import { BonusPremiumsService } from '../../../services/bonus-premiums.service';
import { MastersService } from '../../../services/masters.service';
import { BonusPremium, Employee, Office, YearMonthString, IsoDateString } from '../../../types';
import { BonusFormDialogComponent } from './bonus-form-dialog.component';
import { CsvExportService } from '../../../utils/csv-export.service';
import { HelpDialogComponent, HelpDialogData } from '../../../components/help-dialog.component';
import { DocumentGenerationDialogComponent } from '../../documents/document-generation-dialog.component';
import { isCareInsuranceTarget, roundForEmployeeDeduction } from '../../../utils/premium-calculator';
import { hasInsuranceInMonth } from '../../../utils/premium-calculator';
import { getFiscalYear } from '../../../utils/bonus-calculator';

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
    MatExpansionModule,
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

      <mat-card class="content-card info-card">
        <mat-accordion multi="true">
          <!-- 計算ロジックの説明（詳細版） -->
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="info-icon">calculate</mat-icon>
                計算ロジックの概要
              </mat-panel-title>
              <mat-panel-description>
                賞与保険料がどのような手順で計算されるか
              </mat-panel-description>
            </mat-expansion-panel-header>

            <div class="info-body">
              <p class="info-intro">
                このページでは、選択した「対象年月」に支給された賞与データから、<br />
                健康保険・介護保険・厚生年金の保険料と「納入告知額」を自動計算します。
              </p>

              <ol class="info-list">
                <li>
                  <strong>対象となる賞与データの抽出</strong><br />
                  ・選択した対象年月（例：2025-12）に支給日が属する賞与のみを対象とします。<br />
                  ・事業所と従業員IDで紐づく賞与データ（BonusPremium）を読み込みます。
                </li>

                <li>
                  <strong>従業員の資格判定</strong><br />
                  ・健康保険／厚生年金の資格取得日・喪失日から、対象年月に資格があるかを判定します。<br />
                  ・資格がない保険種別については、その賞与は計算対象外（0円）になります。<br />
                  ・生年月日と対象年月から40〜65歳未満かどうかを判定し、介護保険の対象を判定します。<br />
                  ・従業員が社会保険未加入（isInsured = false）の場合は、賞与は一覧に表示されません。
                </li>

                <li>
                  <strong>標準賞与額（千円未満切り捨て）の算出</strong><br />
                  ・賞与支給額（税引前）から <strong>1,000円未満を切り捨てた金額</strong> を標準賞与額とします。<br />
                  ・この標準賞与額をもとに、健康保険・厚生年金の上限チェックと保険料計算を行います。
                </li>

                <li>
                  <strong>上限額のチェック</strong><br />
                  【健康保険の上限】<br />
                  ・健康保険では、<strong>同じ年度（毎年 4/1〜翌年 3/31）内の標準賞与額の合計</strong>に、<br />
                  &nbsp;&nbsp;賞与を足し込んでいき、<strong>年間 5,730,000 円</strong>を上限とします。<br />
                  ・今回の賞与分を足し込んだ結果が 5,730,000 円を超える場合、<br />
                  &nbsp;&nbsp;超えた分は <span class="info-em">「上限超過額（健康保険）」</span>として切り捨て、<br />
                  &nbsp;&nbsp;上限内に収まる金額だけを「有効額」として計算に使います。<br />
                  <br />
                  【厚生年金の上限】<br />
                  ・厚生年金では、<strong>同じ年月内の標準賞与額の合計</strong>に、賞与を足し込んでいき、<br />
                  &nbsp;&nbsp;<strong>月間 1,500,000 円</strong>を上限とします。<br />
                  ・同じ月の他の賞与を含めた合計が 1,500,000 円を超える場合、<br />
                  &nbsp;&nbsp;超えた分は <span class="info-em">「上限超過額（厚生年金）」</span>として切り捨てます。
                </li>

                <li>
                  <strong>保険料率の適用</strong><br />
                  ・対象年月ごとに、マスタ画面で設定した<br />
                  &nbsp;&nbsp;健康保険料率／介護保険料率／厚生年金保険料率を参照します。<br />
                  ・健康保険＋介護保険については、介護保険の対象年齢（40〜65歳未満）の場合、<br />
                  &nbsp;&nbsp;<strong>健康保険率 ＋ 介護保険率</strong> を合算した率を用いて保険料を計算します。<br />
                  ・厚生年金は、厚生年金保険料率を用いて計算します。
                </li>

                <li>
                  <strong>被保険者負担分と事業主負担分への分割</strong><br />
                  ・健康保険＋介護保険、厚生年金それぞれについて、<br />
                  &nbsp;&nbsp;「有効な標準賞与額 × 保険料率」で <strong>保険料の全額</strong>を算出します。<br />
                  ・全額を 2 等分し、従業員負担分と会社負担分を計算します。<br />
                  ・このとき、<strong>「事業主が給与（賞与）から被保険者負担分を控除する」</strong>ことを前提に、<br />
                  &nbsp;&nbsp;従業員負担分の端数については<br />
                  &nbsp;&nbsp;<strong>50銭以下は切り捨て、50銭を超える場合は切り上げて1円</strong>とするルールで丸めます。<br />
                  ・個人毎の会社負担分はあくまでも参考値で「保険料全額 − 従業員負担分」で求めます。<br />
                  ・端数処理のルールにより、（参考値である）個人毎の会社負担分の合計と会社負担総額との差が発生する場合がありますが、これは正常な現象です。
                </li>

                <li>
                  <strong>納入告知額の算出と表示</strong><br />
                  ・各制度ごとに、「保険料の全額」を社員分すべて合計した値を基準に、<br />
                  &nbsp;&nbsp;端数処理（円未満切り捨て）を行った金額を <strong>納入告知額</strong>として表示します。<br />
                  &nbsp;&nbsp;納入告知額から全対象従業員負担分を引いた金額が事業所負担分となります。<br />
                  ・画面下部のサマリーでは、<br />
                  &nbsp;&nbsp;「健康保険・介護保険」「厚生年金」「総合計」それぞれの<br />
                  &nbsp;&nbsp;<strong>納入告知額・従業員負担総額・会社負担総額</strong>を確認できます。
                </li>
              </ol>

              <p class="info-note">
                ※ 上記の上限額（健康保険：年度内 573 万円、厚生年金：月間 150 万円）と<br />
                &nbsp;&nbsp;50銭ルール（従業員負担分の端数処理）は、一般的な社会保険料の実務運用を前提としています。<br />
                &nbsp;&nbsp;この画面の金額はあくまでシステム上の計算結果であり、最終的な納付額は各保険者からの<br />
                &nbsp;&nbsp;「納入告知書」等と照らし合わせてご確認ください。
              </p>
            </div>
          </mat-expansion-panel>

          <!-- 従業員台帳で必要な入力項目 -->
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="info-icon">badge</mat-icon>
                従業員台帳で必要な入力項目
              </mat-panel-title>
              <mat-panel-description>
                賞与保険料を正しく計算するための必須情報
              </mat-panel-description>
            </mat-expansion-panel-header>

            <div class="info-body">
              <p class="info-intro">
                賞与保険料ページでは、従業員台帳の次の情報を使用して<br />
                「資格の有無」「介護保険の対象かどうか」を判定しています。
              </p>

              <ul class="info-list">
                <li>
                  <strong>健康保険の資格期間</strong><br />
                  ・健康保険の資格取得日（healthQualificationDate）<br />
                  ・健康保険の資格喪失日（healthLossDate）<br />
                  ⇒ 対象年月に健康保険の資格があるかどうかを判定します。
                </li>
                <li>
                  <strong>厚生年金の資格期間</strong><br />
                  ・厚生年金の資格取得日（pensionQualificationDate）<br />
                  ・厚生年金の資格喪失日（pensionLossDate）<br />
                  ⇒ 対象年月に厚生年金の資格があるかどうかを判定します。
                </li>
                <li>
                  <strong>生年月日（birthDate）</strong><br />
                  ⇒ 40〜65歳未満の期間かどうかを判定し、<br />
                  介護保険料を加算するかどうかを決めます。
                </li>
                <li>
                  <strong>社会保険加入フラグ（isInsured）</strong><br />
                  ⇒ false の場合は賞与保険料の計算対象外となります。
                </li>
              </ul>

              <p class="info-note">
                これらの項目が未入力または誤っている場合、<br />
                ・賞与が一覧に表示されない<br />
                ・介護保険料が 0 円のままになる<br />
                などの挙動になることがあります。<br />
                賞与保険料ページを利用する前に、従業員台帳の情報をご確認ください。
              </p>
            </div>
          </mat-expansion-panel>
        </mat-accordion>
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
            <!-- ★ 追加: 事業所全体 × 年度再集計ボタン -->
            <button
              mat-stroked-button
              color="warn"
              (click)="recalculateFiscalYearForOffice()"
              [disabled]="!(office$ | async)"
            >
              <mat-icon>refresh</mat-icon>
              年度の賞与を再集計（事業所全体）
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
                        <span class="split-label">（会社）</span>
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
                        <span class="split-label">（会社）</span>
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
                        <span class="split-label">（会社）</span>
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

      /* 説明カードのスタイル */
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
      }

      .info-em {
        color: #d32f2f;
        font-weight: 600;
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

  async recalculateFiscalYearForOffice(): Promise<void> {
    const office = await firstValueFrom(this.office$);
    if (!office) {
      this.snackBar.open('事業所が設定されていません', '閉じる', { duration: 3000 });
      return;
    }

    const yearMonth = this.selectedYearMonth();
    const fiscalYear = String(
      getFiscalYear(`${yearMonth}-01` as IsoDateString)
    );

    const confirmed = window.confirm(
      `${fiscalYear}年度の賞与保険料を、事業所全体で再集計します。\n\n` +
        '支給日順に並べ直し、健康保険・厚生年金の上限チェックを年度単位で再計算します。\n' +
        'よろしいですか？'
    );

    if (!confirmed) return;

    try {
      const employees = await firstValueFrom(this.employees$);
      if (!employees || employees.length === 0) {
        this.snackBar.open('再集計対象の従業員がいません', '閉じる', { duration: 3000 });
        return;
      }

      this.snackBar.open(
        `${fiscalYear}年度の賞与再集計を開始しました…`,
        undefined,
        { duration: 3000 }
      );

      // 従業員ごとに年度全体の賞与を再計算
      for (const emp of employees as Employee[]) {
        await this.bonusPremiumsService.recalculateForEmployeeFiscalYear(
          office,
          emp,
          fiscalYear
        );
      }

      this.snackBar.open(
        `${fiscalYear}年度の賞与再集計が完了しました`,
        '閉じる',
        { duration: 4000 }
      );
    } catch (e) {
      console.error('年度再集計に失敗しました', e);
      this.snackBar.open('年度再集計に失敗しました', '閉じる', { duration: 4000 });
    }
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
