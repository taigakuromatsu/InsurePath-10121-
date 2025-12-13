import { AsyncPipe, DecimalPipe, NgIf, NgFor, PercentPipe } from '@angular/common';
import { Component, OnInit, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Auth } from '@angular/fire/auth';
import { combineLatest, firstValueFrom, map, of, switchMap, Subscription, debounceTime } from 'rxjs';

import { CurrentOfficeService } from '../../../services/current-office.service';
import { CurrentUserService } from '../../../services/current-user.service';
import { EmployeesService } from '../../../services/employees.service';
import { MastersService } from '../../../services/masters.service';
import { MonthlyPremiumsService } from '../../../services/monthly-premiums.service';
import { Employee, MonthlyPremium, Office, YearMonthString } from '../../../types';
import { CsvExportService } from '../../../utils/csv-export.service';
import { HelpDialogComponent, HelpDialogData } from '../../../components/help-dialog.component';
import { isCareInsuranceTarget } from '../../../utils/premium-calculator';

/**
 * 生年月日と対象年月から年齢を計算する
 * @param birthDate 生年月日（YYYY-MM-DD形式）
 * @param yearMonth 対象年月（YYYY-MM形式）
 * @returns 年齢（対象年月の月末時点）
 */
function calculateAge(birthDate: string | null | undefined, yearMonth: YearMonthString): number | undefined {
  if (!birthDate) return undefined;
  
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return undefined;
  
  // 対象年月の月末日を取得
  const [year, month] = yearMonth.split('-').map(Number);
  const targetDate = new Date(year, month, 0); // 月末日
  
  let age = targetDate.getFullYear() - birth.getFullYear();
  const monthDiff = targetDate.getMonth() - birth.getMonth();
  
  // まだ誕生日が来ていない場合は1歳減らす
  if (monthDiff < 0 || (monthDiff === 0 && targetDate.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

type MonthlyPremiumViewRow = MonthlyPremium & {
  employeeName: string;
  healthCareFull: number;
  healthCareEmployee: number;
  healthCareEmployer: number;
  pensionFull: number;
  pensionEmployee: number;
  pensionEmployer: number;
  totalFull: number;
  totalEmployee: number;
  totalEmployer: number;
  careEmployee: number;
  careEmployer: number;
  isCareTarget: boolean;
  age?: number; // 対象年月時点での年齢
};

@Component({
  selector: 'ip-monthly-premiums-page',
  standalone: true,
  imports: [
    MatCardModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatSlideToggleModule,
    AsyncPipe,
    DecimalPipe,
    NgIf,
    NgFor,
    PercentPipe
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div class="flex-row align-center gap-2">
          <h1 class="m-0">
            月次保険料 一覧・再計算
            <button
              mat-icon-button
              class="help-button"
              type="button"
              (click)="openHelp()"
              aria-label="月次保険料のヘルプを表示"
            >
              <mat-icon>help_outline</mat-icon>
            </button>
          </h1>
        </div>
        <p class="mb-0" style="color: var(--mat-sys-on-surface-variant)">
          対象年月を指定すると、マスタで定義された保険料率を用いて現在の事業所に所属する社会保険加入者の月次保険料を自動計算・保存します。
        </p>
      </header>

      <mat-card class="content-card selection-card">
        <div class="flex-row justify-between align-center mb-4 flex-wrap gap-2">
          <div>
            <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
              <mat-icon color="primary">calendar_month</mat-icon> 対象年月を選択
            </h2>
            <p class="mat-body-2" style="color: #666">デフォルトでは直近12ヶ月を選択できます。過去の年月も10年分まで選択できます。</p>
          </div>
        </div>

        <div class="year-month-selector dense-form">
          <div class="flex-row gap-2 align-center flex-wrap">
            <mat-form-field appearance="outline" class="dense-form-field">
              <mat-label>対象年月</mat-label>
              <mat-select
                [value]="selectedYearMonth()"
                (selectionChange)="onYearMonthSelectionChange($event.value)"
              >
                <mat-option *ngFor="let ym of yearMonthOptions()" [value]="ym">{{ ym }}</mat-option>
              </mat-select>
            </mat-form-field>
            
            <mat-slide-toggle
              [checked]="showPastMonths()"
              (change)="showPastMonths.set($event.checked)"
              color="primary"
            >
              過去を表示
            </mat-slide-toggle>
            
            <button
              mat-stroked-button
              color="primary"
              (click)="resetToCurrentMonth()"
              type="button"
            >
              <mat-icon>today</mat-icon>
              今月に戻す
            </button>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card info-card">
        <mat-accordion [multi]="true">
          <!-- 計算ロジックの説明（詳細版） -->
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="info-icon">calculate</mat-icon>
                計算ロジックの概要
              </mat-panel-title>
              <mat-panel-description>
                月次保険料がどのような手順で計算されるか
              </mat-panel-description>
            </mat-expansion-panel-header>

            <div class="info-body">
              <p class="info-intro">
                このページでは、選択した「対象年月」に基づいて、<br />
                健康保険・介護保険・厚生年金の保険料と「納入告知額」を自動計算・保存します。
              </p>

              <ol class="info-list">
                <li>
                  <strong>対象となる従業員の抽出</strong><br />
                  ・選択した対象年月（例：2025-12）に社会保険の資格がある従業員を対象とします。<br />
                  ・事業所に所属する従業員（Employee）を読み込みます。
                </li>

                <li>
                  <strong>従業員の資格判定</strong><br />
                  ・健康保険／厚生年金の資格取得日・喪失日から、対象年月に資格があるかを判定します。<br />
                  ・資格がない保険種別については、その保険料は計算対象外（0円）になります。<br />
                  ・生年月日と対象年月から40〜65歳未満かどうかを判定し、介護保険の対象を判定します。<br />
                  ・従業員が社会保険未加入（isInsured = false）の場合は、月次保険料の計算対象外となります。
                </li>

                <li>
                  <strong>標準報酬月額の取得</strong><br />
                  ・従業員の標準報酬月額（healthStandardMonthly / pensionStandardMonthly）を使用します。<br />
                  ・標準報酬月額が設定されていない場合は、その保険種別の保険料は0円として扱います。
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
                  &nbsp;&nbsp;「標準報酬月額 × 保険料率」で <strong>保険料の全額</strong>を算出します。<br />
                  ・全額を 2 等分し、従業員負担分と会社負担分を計算します。<br />
                  ・このとき、<strong>「事業主が給与から被保険者負担分を控除する」</strong>ことを前提に、<br />
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
                ※ 50銭ルール（従業員負担分の端数処理）は、一般的な社会保険料の実務運用を前提としています。<br />
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
                月次保険料を正しく計算するための必須情報
              </mat-panel-description>
            </mat-expansion-panel-header>

            <div class="info-body">
              <p class="info-intro">
                月次保険料ページでは、従業員台帳の次の情報を使用して<br />
                「資格の有無」「介護保険の対象かどうか」「標準報酬月額」を判定しています。
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
                  <strong>標準報酬月額</strong><br />
                  ・健康保険の標準報酬月額（healthStandardMonthly）<br />
                  ・厚生年金の標準報酬月額（pensionStandardMonthly）<br />
                  ⇒ 保険料計算の基準となる標準報酬月額です。
                </li>
                <li>
                  <strong>生年月日（birthDate）</strong><br />
                  ⇒ 40〜65歳未満の期間かどうかを判定し、<br />
                  介護保険料を加算するかどうかを決めます。
                </li>
                <li>
                  <strong>社会保険加入フラグ（isInsured）</strong><br />
                  ⇒ false の場合は月次保険料の計算対象外となります。
                </li>
              </ul>

              <p class="info-note">
                これらの項目が未入力または誤っている場合、<br />
                ・月次保険料が計算されない<br />
                ・介護保険料が 0 円のままになる<br />
                などの挙動になることがあります。<br />
                月次保険料ページを利用する前に、従業員台帳の情報をご確認ください。
              </p>
            </div>
          </mat-expansion-panel>
        </mat-accordion>
      </mat-card>

      <mat-card class="content-card">
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

          <div class="flex-row justify-between align-center mb-4 flex-wrap gap-2">
            <div>
              <h2 class="mat-h2 mb-2 flex-row align-center gap-2">
                <mat-icon color="primary">list</mat-icon> 計算結果一覧（{{ selectedYearMonth() }}）
            </h2>
            </div>
          <button
            mat-stroked-button
            color="primary"
            (click)="exportToCsv()"
            [disabled]="filteredRows().length === 0"
            *ngIf="canExport$ | async"
          >
            <mat-icon>download</mat-icon>
            CSVエクスポート
          </button>
        </div>

        <div class="filter-section">
          <mat-form-field appearance="outline" class="filter-input dense-form-field">
            <mat-label>従業員名で絞り込む</mat-label>
            <input
              matInput
              [value]="filterText()"
              (input)="filterText.set($any($event.target).value)"
              placeholder="従業員名を入力"
            />
            <mat-icon matSuffix>search</mat-icon>
            <button
              mat-icon-button
              matSuffix
              *ngIf="filterText()"
              (click)="filterText.set('')"
              type="button"
            >
              <mat-icon>clear</mat-icon>
            </button>
          </mat-form-field>
        </div>

        <div class="table-container">
          <table mat-table [dataSource]="filteredRows()" class="admin-table">
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

          <ng-container matColumnDef="employeeName">
              <th mat-header-cell *matHeaderCellDef [attr.rowspan]="2" class="col-name group-header name-header" style="vertical-align: middle; border-bottom: 1px solid #e0e0e0;">氏名</th>
              <td mat-cell *matCellDef="let row" class="col-name font-bold">
                <div class="employee-name-cell">
                  <span>{{ row.employeeName }}</span>
                  <span class="employee-age" *ngIf="row.age != null">{{ row.age }}歳</span>
                </div>
              </td>
          </ng-container>

          <ng-container matColumnDef="healthStandardMonthly">
              <th mat-header-cell *matHeaderCellDef class="number-cell">標準報酬</th>
              <td mat-cell *matCellDef="let row" class="number-cell">{{ row.healthStandardMonthly | number }}</td>
          </ng-container>

          <ng-container matColumnDef="healthCareFull">
              <th mat-header-cell *matHeaderCellDef class="number-cell">全額</th>
              <td mat-cell *matCellDef="let row" class="number-cell">{{ row.healthCareFull | number:'1.0-2' }}</td>
          </ng-container>

          <ng-container matColumnDef="healthCareEmployee">
              <th mat-header-cell *matHeaderCellDef class="number-cell">従業員負担</th>
              <td mat-cell *matCellDef="let row" class="number-cell font-medium">
                <div class="premium-value-cell">
                  <span>{{ row.healthCareEmployee | number }}</span>
                  <span class="split-sub-value" *ngIf="row.isCareTarget && row.careEmployee > 0">
                    <span class="sub-label">介護分</span>
                    <span class="sub-value">{{ row.careEmployee | number }}</span>
                  </span>
                </div>
              </td>
          </ng-container>

            <ng-container matColumnDef="healthCareEmployer">
              <th mat-header-cell *matHeaderCellDef class="number-cell group-end">会社負担</th>
              <td mat-cell *matCellDef="let row" class="number-cell group-end text-secondary">
                <div class="premium-value-cell">
                  <span>({{ row.healthCareEmployer | number }})</span>
                  <span class="split-sub-value" *ngIf="row.isCareTarget && row.careEmployer > 0">
                    <span class="sub-label">（介護分）</span>
                    <span class="sub-value">({{ row.careEmployer | number }})</span>
                  </span>
                </div>
              </td>
            </ng-container>

          <ng-container matColumnDef="pensionStandardMonthly">
              <th mat-header-cell *matHeaderCellDef class="number-cell">標準報酬</th>
              <td mat-cell *matCellDef="let row" class="number-cell">{{ row.pensionStandardMonthly | number }}</td>
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
              <td mat-cell *matCellDef="let row" class="number-cell group-end text-secondary">
                ({{ row.pensionEmployer | number }})
              </td>
            </ng-container>

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
              <td mat-cell *matCellDef="let row" class="number-cell text-secondary">
                ({{ row.totalEmployer | number }})
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
        /* max-width を削除（複数要素を横並びにするため） */
      }
      
      .year-month-selector .dense-form-field {
        width: 240px;  /* セレクトボックスのみ幅を固定 */
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

      .filter-section {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 12px;
      }

      .filter-input {
        width: 320px;
        max-width: 100%;
      }

      .no-results {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #666;
        margin-bottom: 12px;
      }

      /* テーブルスタイル */
      .admin-table {
        width: 100%;
        min-width: 1200px; /* 横スクロールを許容 */
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
        background-color: #e3f2fd; /* 薄い青 */
        color: #0d47a1;
      }

      .pension-group {
        background-color: #e8f5e9; /* 薄い緑 */
        color: #1b5e20;
      }

      .total-group {
        background-color: #fff3e0; /* 薄いオレンジ */
        color: #e65100;
      }

      .col-name {
        min-width: 120px;
        position: sticky;
        left: 0;
        background: #fff;
        z-index: 1;
      }

      .employee-name-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .employee-age {
        font-size: 0.75rem;
        color: #999;
        font-weight: 400;
      }

      .premium-value-cell {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }

      .split-sub-value {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        margin-top: 3px;
        padding-top: 3px;
        border-top: 1px dotted rgba(0,0,0,0.1);
      }

      .split-sub-value .sub-label {
        font-size: 0.6rem;
        color: #aaa;
        line-height: 1.2;
      }

      .split-sub-value .sub-value {
        font-size: 0.75rem;
        font-weight: 400;
        color: #888;
        line-height: 1.2;
      }

      .number-cell {
        text-align: right;
        padding-right: 16px;
        white-space: nowrap;
      }

      .group-end {
        border-right: 2px solid #e0e0e0 !important;
      }
      
      .font-bold { font-weight: 700; }
      .font-medium { font-weight: 500; }
      .text-secondary { color: #666; }

      .hover-row:hover {
        background-color: #f5f5f5;
      }

      /* サマリーセクション */
      .summary-section {
        margin-top: 32px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        margin-bottom: 16px;
      }

      .summary-card {
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid #e0e0e0;
        background: #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      }

      .summary-header {
        padding: 12px 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1rem;
      }

      /* カードごとのテーマカラー */
      .health-card { border-top: 4px solid #1976d2; }
      .health-card .summary-header { background: #e3f2fd; color: #0d47a1; }
      
      .pension-card { border-top: 4px solid #2e7d32; }
      .pension-card .summary-header { background: #e8f5e9; color: #1b5e20; }

      .total-card { border-top: 4px solid #ed6c02; }
      .total-card .summary-header { background: #fff3e0; color: #e65100; }

      .summary-content {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .main-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: 4px;
      }

      .label-group {
        display: flex;
        flex-direction: column;
      }

      .main-label {
        font-size: 0.9rem;
        font-weight: 600;
        color: #444;
      }

      .sub-label {
        font-size: 0.75rem;
        color: #888;
        margin-top: 2px;
      }

      .main-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: #333;
        line-height: 1;
      }

      .main-value small {
        font-size: 0.9rem;
        margin-left: 2px;
        font-weight: normal;
      }

      .divider {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        height: 16px;
        color: #999;
      }

      .operator-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .detail-row, .result-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .detail-label {
        font-size: 0.9rem;
        color: #666;
      }

      .detail-value {
        font-size: 1.1rem;
        font-weight: 500;
        color: #555;
      }

      .result-row {
        padding-top: 8px;
      }

      .result-label {
        font-weight: 600;
        color: #333;
      }

      .result-value {
        font-size: 1.3rem;
        font-weight: 700;
        color: #333;
      }

      /* 会社負担を少し強調 */
      .health-card .result-value { color: #1976d2; }
      .pension-card .result-value { color: #2e7d32; }
      .total-card .result-value { color: #ed6c02; }

      .summary-footer-note {
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 12px;
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }

      .note-icon {
        color: #64748b;
        font-size: 20px;
        width: 20px;
        height: 20px;
        margin-top: 2px;
      }

      .summary-footer-note p {
        margin: 0;
        font-size: 0.85rem;
        color: #64748b;
        line-height: 1.5;
      }

      .empty-office-state {
        text-align: center;
        padding: 48px 24px;
        color: #666;
      }

      .empty-office-state mat-icon {
        font-size: 48px;
        height: 48px;
        width: 48px;
        color: #9ca3af;
        opacity: 0.5;
        margin-bottom: 8px;
      }

      .empty-office-state h3 {
        margin: 16px 0 8px 0;
        font-size: 1.2rem;
        font-weight: 600;
      }

      .empty-office-state p {
        margin: 0;
        font-size: 0.9rem;
      }

      @media (max-width: 960px) {
        .summary-grid {
          grid-template-columns: 1fr;
          gap: 16px;
        }
      }

      @media (max-width: 768px) {
        .filter-section {
          justify-content: flex-start;
        }
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
  export class MonthlyPremiumsPage implements OnInit, OnDestroy {
    private readonly currentOffice = inject(CurrentOfficeService);
    private readonly currentUser = inject(CurrentUserService);
    private readonly employeesService = inject(EmployeesService);
    private readonly mastersService = inject(MastersService);
    private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly auth = inject(Auth);
    private readonly csvExportService = inject(CsvExportService);
    private readonly dialog = inject(MatDialog);

  readonly officeId$ = this.currentOffice.officeId$;
  readonly office$ = this.currentOffice.office$;
  readonly rows = signal<MonthlyPremiumViewRow[]>([]);
  private dataSubscription?: Subscription;
  private refreshSeq = 0;  // レースコンディション対策: 世代番号
  private autoCalcInProgressByYearMonth = new Map<YearMonthString, boolean>();  // 年月ごとの自動計算中のフラグ（無限ループ防止）
  private lastAutoCalcHashByYearMonth = new Map<YearMonthString, string>();  // 年月ごとの最後に自動計算したときのハッシュ（従業員データと料率の変更検知用）

  /**
   * ローカル時刻で年月文字列を生成（UTC問題を回避）
   */
  private buildYearMonth(d = new Date()): YearMonthString {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` as YearMonthString;
  }

  readonly selectedYearMonth = signal<YearMonthString>(this.buildYearMonth());
  
  // 「過去を表示」トグル（デフォルトはOFF）
  readonly showPastMonths = signal<boolean>(false);

  readonly filterText = signal<string>('');
  readonly rateSummary = signal<{ healthRate?: number; careRate?: number; pensionRate?: number } | null>(null);

  readonly canExport$ = this.currentUser.profile$.pipe(
    map((profile) => profile?.role === 'admin' || profile?.role === 'hr')
  );

  readonly yearMonthOptions = computed(() => {
    const options: YearMonthString[] = [];
    const now = new Date();
    const selected = this.selectedYearMonth();
    
    // 表示する月数（過去を表示する場合は120か月=10年、デフォルトは12か月）
    const monthCount = this.showPastMonths() ? 120 : 12;
    
    // 直近Nか月を生成（降順：新しい→古い）
    for (let i = 0; i < monthCount; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` as YearMonthString;
      options.push(yearMonth);
    }
    
    // 選択中の年月がリストに含まれていない場合（過去を表示OFFで過去月を選択している場合）、追加
    if (!options.includes(selected)) {
      options.push(selected);
      // 年月順にソート（降順：新しい→古い）
      options.sort((a, b) => b.localeCompare(a));
    }
    
    return options;
  });

  private readonly employees$ = this.officeId$.pipe(
    switchMap((officeId) => (officeId ? this.employeesService.list(officeId) : of([])))
  );


  readonly displayedColumns = [
    'employeeName',
    'healthStandardMonthly',
    'healthCareFull',
    'healthCareEmployee',
    'healthCareEmployer',
    'pensionStandardMonthly',
    'pensionFull',
    'pensionEmployee',
    'pensionEmployer',
    'totalFull',
    'totalEmployee',
    'totalEmployer'
  ];

  readonly headerRowDef = ['employeeName', 'header-health', 'header-pension', 'header-total'];
  
  get subHeaderRowDef(): string[] {
    return this.displayedColumns.filter(c => c !== 'employeeName');
  }

  readonly filteredRows = computed(() => {
    const text = this.filterText().trim().toLowerCase();
    const base = this.rows();

    if (!text) {
      return base;
    }

    return base.filter((r) => (r.employeeName ?? '').toLowerCase().includes(text));
  });

  readonly healthSummary = computed(() => {
    const rows = this.filteredRows();
    const employeeTotal = rows.reduce((sum, r) => sum + (r.healthCareEmployee ?? 0), 0);
    const sumFull = rows.reduce((sum, r) => sum + (r.healthCareFull ?? 0), 0);
    const sumFullRoundedDown = Math.floor(sumFull);
    const employerTotal = sumFullRoundedDown - employeeTotal;
    return { employeeTotal, sumFull, sumFullRoundedDown, employerTotal };
  });

  readonly pensionSummary = computed(() => {
    const rows = this.filteredRows();
    const employeeTotal = rows.reduce((sum, r) => sum + (r.pensionEmployee ?? 0), 0);
    const sumFull = rows.reduce((sum, r) => sum + (r.pensionFull ?? 0), 0);
    const sumFullRoundedDown = Math.floor(sumFull);
    const employerTotal = sumFullRoundedDown - employeeTotal;
    return { employeeTotal, sumFull, sumFullRoundedDown, employerTotal };
  });

  readonly combinedSummary = computed(() => {
    const health = this.healthSummary();
    const pension = this.pensionSummary();
    const employeeTotal = health.employeeTotal + pension.employeeTotal;
    const sumFull = health.sumFull + pension.sumFull;
    const sumFullRoundedDown = Math.floor(sumFull);
    const employerTotal = sumFullRoundedDown - employeeTotal;
    return { employeeTotal, sumFull, sumFullRoundedDown, employerTotal };
  });

  constructor() {
    // 自動計算機能：effect()でselectedYearMonth()とofficeId$を監視
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
    // effect の cleanup で既に解除されるが、念のため
    this.dataSubscription?.unsubscribe();
  }

  ngOnInit(): void {
    // effect()で自動的に読み込まれるため、ここでは不要
  }

  /**
   * 自動計算用のリアクティブ購読を設定
   */
  private setupReactiveSubscription(officeId: string, yearMonth: YearMonthString): void {
    // 既存の購読を解除
    this.dataSubscription?.unsubscribe();

    // 世代番号を進めて、古い処理の結果が反映されないようにする
    const seq = ++this.refreshSeq;

    const premiums$ = this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, yearMonth);
    const employees$ = this.employees$;
    const office$ = this.office$;

    this.dataSubscription = combineLatest([premiums$, employees$, office$]).subscribe(
      async ([premiums, employees, office]) => {
        try {
          // 最新の年月を取得（購読中に年月が変更された場合を検知）
          const currentYearMonth = this.selectedYearMonth();
          // この購読が対象とする年月と異なる場合は処理をスキップ
          if (currentYearMonth !== yearMonth) {
            return;
          }

          if (!office) {
            // await前でもチェック（早期リターン）
            if (seq !== this.refreshSeq) return;
            this.rows.set([]);
            return;
          }

          const rates = await this.mastersService.getRatesForYearMonth(office, yearMonth);
          // await後に世代番号と年月をチェック（古い処理の結果を無視）
          if (seq !== this.refreshSeq) return;
          // 年月が変更されていないか再チェック
          if (this.selectedYearMonth() !== yearMonth) return;

          // 料率が未設定の場合はスキップ
          if (rates.healthRate == null || rates.pensionRate == null) {
            this.rateSummary.set({
              healthRate: rates.healthRate ?? undefined,
              careRate: rates.careRate ?? undefined,
              pensionRate: rates.pensionRate ?? undefined
            });
            this.rows.set([]);
            return;
          }

          this.rateSummary.set({
            healthRate: rates.healthRate ?? undefined,
            careRate: rates.careRate ?? undefined,
            pensionRate: rates.pensionRate ?? undefined
          });

          // 従業員マップを作成（削除された従業員のフィルタリング用）
          const employeeMap = new Map(employees.map((e) => [e.id, e]));
          const employeeNameMap = new Map<string, string>();
          employees.forEach((emp) => {
            employeeNameMap.set(emp.id, emp.name);
          });

          // 削除された従業員のフィルタリング：従業員が存在しないpremiumは除外
          const validPremiums = premiums.filter((premium) => {
            return employeeMap.has(premium.employeeId);
          });

          // 自動計算・保存の判定
          // 従業員データと料率のハッシュを作成（変更検知用）
          const employeesHash = JSON.stringify(
            employees
              .filter((e) => e.isInsured)
              .map((e) => ({
                id: e.id,
                healthStandardMonthly: e.healthStandardMonthly,
                healthGrade: e.healthGrade,
                pensionStandardMonthly: e.pensionStandardMonthly,
                pensionGrade: e.pensionGrade,
                birthDate: e.birthDate
              }))
              .sort((a, b) => a.id.localeCompare(b.id))
          );
          const ratesHash = JSON.stringify({
            healthRate: rates.healthRate,
            careRate: rates.careRate,
            pensionRate: rates.pensionRate
          });
          const currentHash = `${employeesHash}|${ratesHash}`;

          // 自動計算が必要かチェック（年月ごとにハッシュを管理）
          const lastHash = this.lastAutoCalcHashByYearMonth.get(yearMonth);
          const isAutoCalcInProgress = this.autoCalcInProgressByYearMonth.get(yearMonth) ?? false;
          const needsAutoCalc =
            !isAutoCalcInProgress &&
            (validPremiums.length === 0 || lastHash !== currentHash);

          if (needsAutoCalc && employees.length > 0) {
            // 自動計算・保存を実行
            this.autoCalcInProgressByYearMonth.set(yearMonth, true);
            try {
              const currentUser = this.auth.currentUser;
              if (currentUser) {
                const calcDate = new Date().toISOString();
                const savedPremiums = await this.monthlyPremiumsService.saveForMonth({
                  officeId,
                  yearMonth,
                  calcDate,
                  employees: employees as Employee[],
                  calculatedByUserId: currentUser.uid
                });

                // 保存後にハッシュを更新
                this.lastAutoCalcHashByYearMonth.set(yearMonth, currentHash);
                
                // 保存されたデータを使って表示処理を続行
                // 年月が変更されていないか再チェック
                if (this.selectedYearMonth() !== yearMonth) {
                  this.autoCalcInProgressByYearMonth.set(yearMonth, false);
                  return;
                }
                
                // 保存されたデータを使って表示
                const savedValidPremiums = savedPremiums.filter((premium) => {
                  return employeeMap.has(premium.employeeId);
                });
                
                const rowsWithName = savedValidPremiums.map((premium) =>
                  this.buildViewRow(premium, employeeNameMap, employeeMap, yearMonth)
                );

                // 最終的なset前にも念のためチェック
                if (seq !== this.refreshSeq) {
                  this.autoCalcInProgressByYearMonth.set(yearMonth, false);
                  return;
                }
                // 年月が変更されていないか再チェック
                if (this.selectedYearMonth() !== yearMonth) {
                  this.autoCalcInProgressByYearMonth.set(yearMonth, false);
                  return;
                }
                this.rows.set(rowsWithName);
                this.autoCalcInProgressByYearMonth.set(yearMonth, false);
                return;
              }
            } catch (error) {
              console.error('月次保険料の自動計算・保存に失敗', error);
              // エラー時は静かに失敗（ユーザーには通知しない）
            } finally {
              this.autoCalcInProgressByYearMonth.set(yearMonth, false);
            }
            // エラー時やユーザー未認証時はreturn
            return;
          }

          const rowsWithName = validPremiums.map((premium) =>
            this.buildViewRow(premium, employeeNameMap, employeeMap, yearMonth)
          );

          // 最終的なset前にも念のためチェック
          if (seq !== this.refreshSeq) return;
          // 年月が変更されていないか再チェック
          if (this.selectedYearMonth() !== yearMonth) return;
          this.rows.set(rowsWithName);
          // データが存在する場合もハッシュを更新（データが正しく読み込まれたことを記録）
          this.lastAutoCalcHashByYearMonth.set(yearMonth, currentHash);
        } catch (e) {
          console.error('月次保険料の読込に失敗', e);
          // エラー時も世代番号をチェック
          if (seq !== this.refreshSeq) return;
          this.rows.set([]);
          this.rateSummary.set(null);
          this.snackBar.open('月次保険料の読込に失敗しました', '閉じる', { duration: 4000 });
        }
      }
    );
  }

  openHelp(): void {
    this.dialog.open(HelpDialogComponent, {
      width: '720px',
      data: {
        topicIds: ['standardMonthlyReward'],
        title: '月次保険料に関するヘルプ'
      } satisfies HelpDialogData
    });
  }

  onYearMonthSelectionChange(yearMonth: YearMonthString): void {
    this.selectedYearMonth.set(yearMonth);
    this.filterText.set('');
    // effectで自動的に再計算される
  }

  /**
   * 選択年月を今月にリセット
   */
  resetToCurrentMonth(): void {
    this.selectedYearMonth.set(this.buildYearMonth());
    // 過去表示もOFFに戻す（ユーザーの体感が分かりやすい）
    this.showPastMonths.set(false);
  }

  exportToCsv(): void {
    const rows = this.filteredRows();
    if (rows.length === 0) {
      this.snackBar.open('エクスポートするデータがありません', '閉じる', { duration: 3000 });
      return;
    }

    this.csvExportService.exportMonthlyPremiums(rows, this.selectedYearMonth());
    this.snackBar.open('CSVエクスポートが完了しました', '閉じる', { duration: 3000 });
  }

  private buildViewRow(
    premium: MonthlyPremium,
    employeeNameMap: Map<string, string>,
    employeeMap: Map<string, Employee>,
    yearMonth: YearMonthString
  ): MonthlyPremiumViewRow {
    const healthCareFull =
      premium.healthCareFull ?? (premium.healthTotal ?? 0) + (premium.careTotal ?? 0);
    const healthCareEmployee =
      premium.healthCareEmployee ??
      (premium.healthEmployee ?? 0) +
        (premium.careEmployee ?? 0);
    const healthCareEmployer =
      premium.healthCareEmployer ??
      (premium.healthEmployer ?? 0) +
        (premium.careEmployer ?? 0);

    const pensionFull = premium.pensionFull ?? premium.pensionTotal ?? 0;
    const pensionEmployee = premium.pensionEmployee ?? 0;
    const pensionEmployer = premium.pensionEmployer ?? 0;

    const totalFull = premium.totalFull ?? healthCareFull + pensionFull;
    const totalEmployee = premium.totalEmployee ?? healthCareEmployee + pensionEmployee;
    const totalEmployer = premium.totalEmployer ?? totalFull - totalEmployee;

    // 従業員データから年齢と介護保険対象を判定
    const employee = employeeMap.get(premium.employeeId);
    const age = employee ? calculateAge(employee.birthDate, yearMonth) : undefined;
    const isCareTarget = employee ? isCareInsuranceTarget(employee.birthDate, yearMonth) : false;
    const careEmployee = premium.careEmployee ?? 0;
    const careEmployer = premium.careEmployer ?? 0;

    return {
      ...premium,
      employeeName: employeeNameMap.get(premium.employeeId) ?? '(不明)',
      age,
      healthCareFull,
      healthCareEmployee,
      healthCareEmployer,
      pensionFull,
      pensionEmployee,
      pensionEmployer,
      totalFull,
      totalEmployee,
      totalEmployer,
      careEmployee,
      careEmployer,
      isCareTarget
    };
  }

}
