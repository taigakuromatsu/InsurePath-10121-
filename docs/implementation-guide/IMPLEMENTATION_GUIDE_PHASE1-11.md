# Phase1-11 実装指示書: 保険料シミュレーション機能の実装

## 📋 概要

「シミュレーター」ページを新規追加し、報酬月額等を入力すると社会保険料を試算できるようにします。

**目的**: 
- 報酬月額や等級を入力して、社会保険料を事前に試算できる機能を提供
- 人事・総務担当者や従業員本人が、給与変更時の保険料影響を把握できるようにする
- 既存の月次保険料計算ロジック（`premium-calculator.ts`）を再利用し、一貫性のある計算結果を提供

**ユーザー利用シーン**:
- 給与改定前に、新しい報酬月額での保険料を試算したい
- 等級変更時の保険料影響を確認したい
- 新規採用時の給与設定で、保険料負担を事前に把握したい

**他機能との関係**:
- **月次保険料一覧**: 同じ計算ロジック（`premium-calculator.ts`）を使用し、実際の計算結果と一致する
- **マスタ管理**: 保険料率はマスタから自動取得し、実際の計算と同じ料率を使用
- **マイページ**: 従業員本人が自分の保険料を確認する際の参考として利用可能

**実装スタイル**:
- **重要**: 既存の`monthly-premiums.page.ts`や`dashboard.page.ts`と同様に`signal`/`computed`ベースで実装します
- サービスのObservableから値を取得する場合は`firstValueFrom(...)`で1回分だけ受け取ります
- `combineLatest`や`switchMap`などのObservableチェーンは新たに増やしません
- Angular Material + Reactive Forms を使用します

**制約**:
- Phase1-11では、Firestoreへの保存や履歴機能は一切実装しません
- 「1回の試算を画面で表示するだけ」のシンプルな構成とします
- 複数シナリオ比較、CSVエクスポートなどは将来の拡張スコープとします

---

## 🎯 実装対象ファイル

### 編集（必須）
- `src/app/pages/simulator/simulator.page.ts` - シミュレーターコンポーネント（既存のプレースホルダーを実装に置き換え）

### 編集（必要に応じて）
- `src/app/app.routes.ts` - ルーティングは既に定義済み（確認のみ）
- サイドメニューのコンポーネント - シミュレーターへのメニュー項目追加（必要に応じて）

### 参照のみ（変更不要）
- `src/app/utils/premium-calculator.ts` - 保険料計算ロジック（`calculateMonthlyPremiumForEmployee`関数を使用）
- `src/app/services/masters.service.ts` - マスタサービス（`getRatesForYearMonth`メソッドを使用）
- `src/app/services/current-office.service.ts` - 事業所情報取得（`office$`を使用）
- `src/app/pages/premiums/monthly/monthly-premiums.page.ts` - UIデザインの参考
- `src/app/types.ts` - 型定義の参照

---

## 🔧 機能要件

### 必須スコープ（Phase1-11で実装）

#### 1. 入力項目

**対象年月**
- 入力形式: `type="month"`（`YYYY-MM`形式）
- デフォルト値: 当月（`new Date().toISOString().substring(0, 7)`）
- 必須項目
- 説明: この年月の保険料率を使用して計算します

**報酬月額**
- 入力形式: 数値入力（円単位）
- バリデーション: 必須、0より大きい値
- 説明: 社会保険の標準報酬月額として使用されます

**健康保険等級**
- 入力形式: 数値入力（1〜47の範囲）
- バリデーション: 必須、1以上47以下
- 説明: 健康保険の等級を指定します

**厚生年金等級**
- 入力形式: 数値入力（1〜32の範囲）
- バリデーション: 必須、1以上32以下
- 説明: 厚生年金の等級を指定します

**介護保険対象フラグ**
- 入力形式: チェックボックス
- デフォルト値: `false`
- 説明: 40〜64歳の場合は`true`に設定してください（Phase1-11では年齢計算は行わず、ユーザーが手動で設定）

**備考**:
- 健康保険プラン（協会けんぽ／組合健保）は、現在の事業所設定（`Office.healthPlanType`）から自動取得します
- 保険料率は、選択した対象年月と事業所のマスタ設定から自動取得します

#### 2. 出力項目（計算結果）

**等級・標準報酬月額**
- 健康保険等級: 入力値
- 健康保険標準報酬月額: 報酬月額（入力値）
- 厚生年金等級: 入力値
- 厚生年金標準報酬月額: 報酬月額（入力値）

**健康保険**
- 本人負担額: 計算結果（`amounts.healthEmployee`）
- 会社負担額: 計算結果（`amounts.healthEmployer`）
- 合計: 計算結果（`amounts.healthTotal`）

**介護保険**（介護保険対象フラグが`true`の場合のみ表示）
- 本人負担額: 計算結果（`amounts.careEmployee`）
- 会社負担額: 計算結果（`amounts.careEmployer`）
- 合計: 計算結果（`amounts.careTotal`）

**厚生年金**
- 本人負担額: 計算結果（`amounts.pensionEmployee`）
- 会社負担額: 計算結果（`amounts.pensionEmployer`）
- 合計: 計算結果（`amounts.pensionTotal`）

**トータル**
- 本人負担合計: 計算結果（`amounts.totalEmployee`）
- 会社負担合計: 計算結果（`amounts.totalEmployer`）
- 合計額: 本人負担合計 + 会社負担合計

#### 3. 挙動

**シミュレーション実行**
- 「シミュレーション実行」ボタンを押すと、入力値を検証
- 検証OKの場合、`premium-calculator.ts`の`calculateMonthlyPremiumForEmployee`関数を呼び出して計算
- 計算結果を結果エリアのカードに表示
- 金額は`DecimalPipe`でカンマ区切り表示

**エラーハンドリング**
- マスタが未設定の場合: 「対象年月の保険料率がマスタに設定されていません。マスタ管理画面で設定してください。」と表示
- 健康保険料率が未設定の場合: 「健康保険料率が設定されていません。」と表示
- 厚生年金保険料率が未設定の場合: 「厚生年金保険料率が設定されていません。」と表示
- 入力値が不正な場合: フォームバリデーションエラーを表示

**初期状態・未計算時**
- 結果カードは「まだ計算されていません」または`-`を表示
- 計算が完了するまで、結果カードは非表示またはプレースホルダー表示

---

### 拡張スコープ（将来の実装）

以下の機能はPhase1-11では実装しませんが、将来の拡張案として検討可能です：

1. **複数シナリオ比較**
   - 複数の報酬月額・等級を入力して、結果を並べて比較表示
   - シナリオの保存・読み込み機能

2. **履歴保存機能**
   - Firestoreにシミュレーション結果を保存
   - 過去のシミュレーション結果を一覧表示

3. **CSVエクスポート**
   - シミュレーション結果をCSV形式でエクスポート

4. **年齢自動計算**
   - 生年月日を入力すると、介護保険対象フラグを自動判定

5. **等級自動判定**
   - 報酬月額を入力すると、標準報酬等級表から等級を自動判定

---

## 💻 実装詳細

### Step 1: simulator.page.ts の骨組み作成

#### 1.1 Standaloneコンポーネントの基本構成

```typescript
// src/app/pages/simulator/simulator.page.ts

import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { MastersService } from '../../services/masters.service';
import {
  calculateMonthlyPremiumForEmployee,
  MonthlyPremiumCalculationResult,
  PremiumRateContext
} from '../../utils/premium-calculator';
import { Employee, Office } from '../../types';

@Component({
  selector: 'ip-simulator-page',
  standalone: true,
  imports: [
    MatCardModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    DecimalPipe,
    NgIf
  ],
  // template と styles は後続のStepで実装
})
export class SimulatorPage {
  private readonly fb = inject(FormBuilder);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly mastersService = inject(MastersService);
  private readonly snackBar = inject(MatSnackBar);

  readonly office$ = this.currentOffice.office$;

  // 計算結果を保持するsignal
  readonly calculationResult = signal<MonthlyPremiumCalculationResult | null>(null);
  readonly loading = signal(false);

  // フォーム定義
  readonly form = this.fb.group({
    yearMonth: [new Date().toISOString().substring(0, 7), Validators.required],
    monthlyWage: [null as number | null, [Validators.required, Validators.min(1)]],
    healthGrade: [null as number | null, [Validators.required, Validators.min(1), Validators.max(47)]],
    pensionGrade: [null as number | null, [Validators.required, Validators.min(1), Validators.max(32)]],
    isCareInsuranceTarget: [false]
  });
}
```

#### 1.2 ページタイトルと説明文のテンプレート

```html
<!-- simulator.page.ts の template 内 -->

<section class="page simulator">
  <mat-card class="header-card">
    <div class="header-content">
      <div class="header-icon">
        <mat-icon>calculate</mat-icon>
      </div>
      <div class="header-text">
        <h1>保険料シミュレーター</h1>
        <p>
          報酬月額や等級を入力して、社会保険料を試算できます。
          実際の月次保険料計算と同じロジックを使用します。
        </p>
      </div>
    </div>
  </mat-card>

  <!-- 入力フォームと結果表示は後続のStepで実装 -->
</section>
```

---

### Step 2: Reactive Form と計算ロジックの接続

#### 2.1 フォーム送信時の処理

```typescript
// simulator.page.ts

async onSimulate(): Promise<void> {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  try {
    this.loading.set(true);

    // 事業所情報を取得
    // 注意: CurrentOfficeService.office$ が Observable<Office | null> であることを確認してください
    // Office の ID プロパティ名が id で合っていることを確認してください（もし officeId しか無い場合は office.officeId を使用）
    const office = await firstValueFrom(this.office$);
    if (!office) {
      this.calculationResult.set(null); // エラー時に古い結果を消す
      this.snackBar.open('事業所情報を取得できませんでした', '閉じる', { duration: 3000 });
      return;
    }

    const formValue = this.form.value;
    const yearMonth = formValue.yearMonth as string;
    const monthlyWage = Number(formValue.monthlyWage);
    const healthGrade = Number(formValue.healthGrade);
    const pensionGrade = Number(formValue.pensionGrade);
    const isCareInsuranceTarget = formValue.isCareInsuranceTarget === true;

    // マスタから保険料率を取得
    // 注意: MastersService.getRatesForYearMonth が Promise を返す場合は await でOK
    // Observable を返す場合は await firstValueFrom(this.mastersService.getRatesForYearMonth(...)) を使用してください
    // 実装時に実コードに合わせて調整してください
    const rates = await this.mastersService.getRatesForYearMonth(office, yearMonth);

    if (rates.healthRate == null || rates.pensionRate == null) {
      this.calculationResult.set(null); // エラー時に古い結果を消す
      let errorMessage = '対象年月の保険料率がマスタに設定されていません。';
      if (rates.healthRate == null) {
        errorMessage += ' 健康保険料率が未設定です。';
      }
      if (rates.pensionRate == null) {
        errorMessage += ' 厚生年金保険料率が未設定です。';
      }
      errorMessage += ' マスタ管理画面で設定してください。';
      this.snackBar.open(errorMessage, '閉じる', { duration: 5000 });
      return;
    }

    // 一時的なEmployeeオブジェクトを作成
    // 重要: Employee型の必須項目をすべてダミー値で埋めてください
    // 実コードのEmployeeインターフェースを確認し、必須フィールド（id, officeId, name, birthDate, hireDate, employmentType, monthlyWage, isInsured）をすべて設定してください
    // healthStandardMonthly / pensionStandardMonthly が型に存在するか確認してください（optional の場合は設定してもOK）
    // 足りない必須フィールドがある場合は、実コードのEmployee型を見て調整してください
    const tempEmployee: Employee = {
      id: 'temp',
      officeId: office.id, // 注意: office.id が正しいか確認（office.officeId の可能性もある）
      name: 'シミュレーション用',
      // 介護保険対象判定: isCareInsuranceTarget === true のときは「確実に40〜64歳」の日付（例: '1980-01-01'）
      // false のときは「確実に40歳未満」の日付（例: '2005-01-01'）
      // これにより、premium-calculator.tsのisCareInsuranceTarget関数が正しく判定します
      birthDate: isCareInsuranceTarget ? '1980-01-01' : '2005-01-01',
      hireDate: '2000-01-01',
      employmentType: 'regular',
      monthlyWage,
      isInsured: true,
      healthGrade,
      healthStandardMonthly: monthlyWage, // optional フィールド（型に存在する場合）
      pensionGrade,
      pensionStandardMonthly: monthlyWage // optional フィールド（型に存在する場合）
    };

    // 料率コンテキストを作成
    // 注意: PremiumRateContext の実際のフィールド構造は premium-calculator.ts を見て合わせてください
    // プロパティ名やネストが違う可能性があるので、実コードを確認して調整してください
    const rateContext: PremiumRateContext = {
      yearMonth,
      calcDate: new Date().toISOString(),
      healthRate: rates.healthRate,
      careRate: rates.careRate,
      pensionRate: rates.pensionRate
    };

    // 計算実行
    // 注意: birthDateを適切に設定しているため、premium-calculator.tsのisCareInsuranceTarget関数が正しく判定します
    // isCareInsuranceTarget === true のとき: birthDate = '1980-01-01'（40〜64歳）
    // isCareInsuranceTarget === false のとき: birthDate = '2005-01-01'（40歳未満）
    // これにより、calculateMonthlyPremiumForEmployeeの結果をそのまま使用でき、手動でcare金額を上書きする必要はありません
    const result = calculateMonthlyPremiumForEmployee(tempEmployee, rateContext);

    if (!result) {
      this.calculationResult.set(null); // エラー時に古い結果を消す
      this.snackBar.open('保険料の計算に失敗しました。入力値を確認してください。', '閉じる', {
        duration: 3000
      });
      return;
    }

    // 計算結果を設定（介護保険料はbirthDateに基づいて自動計算されているため、そのまま使用）
    this.calculationResult.set(result);
  } catch (error) {
    console.error('シミュレーション実行に失敗しました', error);
    this.calculationResult.set(null); // エラー時に古い結果を消す
    this.snackBar.open('シミュレーション実行に失敗しました', '閉じる', { duration: 3000 });
  } finally {
    this.loading.set(false);
  }
}
```

#### 2.2 介護保険対象判定の補足

**重要**: `premium-calculator.ts`の`isCareInsuranceTarget`関数は生年月日から年齢を計算して判定します。

Phase1-11では、ユーザーが手動で「介護保険対象フラグ」を設定する方式としますが、計算時は`birthDate`を適切に設定することで、`premium-calculator.ts`のロジックをそのまま使用します：

- `isCareInsuranceTarget === true` のとき: `birthDate = '1980-01-01'`（確実に40〜64歳になる日付）
- `isCareInsuranceTarget === false` のとき: `birthDate = '2005-01-01'`（確実に40歳未満になる日付）

これにより、`calculateMonthlyPremiumForEmployee`の結果をそのまま使用でき、手動で`care`金額を上書きする必要はありません。月次保険料計算との整合性も保たれます。

**将来の拡張案**: より正確な実装としては、生年月日入力フィールドを追加して、実際の生年月日から`isCareInsuranceTarget`関数を使用する方法があります。

---

### Step 3: テンプレートでの結果表示

#### 3.1 入力フォームの実装

```html
<!-- simulator.page.ts の template 内 -->

<mat-card class="content-card">
  <div class="page-header">
    <div class="page-title-section">
      <h2>
        <mat-icon>input</mat-icon>
        入力項目
      </h2>
      <p>報酬月額や等級を入力して、シミュレーションを実行してください。</p>
    </div>
  </div>

  <form [formGroup]="form" (ngSubmit)="onSimulate()" class="simulator-form">
    <div class="form-section">
      <div class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>対象年月</mat-label>
          <input matInput type="month" formControlName="yearMonth" required />
          <mat-error *ngIf="form.get('yearMonth')?.hasError('required')">
            対象年月を選択してください
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>報酬月額（円）</mat-label>
          <input matInput type="number" formControlName="monthlyWage" required />
          <mat-error *ngIf="form.get('monthlyWage')?.hasError('required')">
            報酬月額を入力してください
          </mat-error>
          <mat-error *ngIf="form.get('monthlyWage')?.hasError('min')">
            1円以上の値を入力してください
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>健康保険等級</mat-label>
          <input matInput type="number" formControlName="healthGrade" required />
          <mat-error *ngIf="form.get('healthGrade')?.hasError('required')">
            健康保険等級を入力してください
          </mat-error>
          <mat-error *ngIf="form.get('healthGrade')?.hasError('min') || form.get('healthGrade')?.hasError('max')">
            1〜47の範囲で入力してください
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>厚生年金等級</mat-label>
          <input matInput type="number" formControlName="pensionGrade" required />
          <mat-error *ngIf="form.get('pensionGrade')?.hasError('required')">
            厚生年金等級を入力してください
          </mat-error>
          <mat-error *ngIf="form.get('pensionGrade')?.hasError('min') || form.get('pensionGrade')?.hasError('max')">
            1〜32の範囲で入力してください
          </mat-error>
        </mat-form-field>
      </div>

      <mat-checkbox formControlName="isCareInsuranceTarget">
        介護保険対象（40〜64歳）
      </mat-checkbox>
    </div>

    <div class="actions">
      <button
        mat-raised-button
        color="primary"
        type="submit"
        [disabled]="form.invalid || loading()"
      >
        <mat-spinner *ngIf="loading()" diameter="20" class="inline-spinner"></mat-spinner>
        <mat-icon *ngIf="!loading()">calculate</mat-icon>
        シミュレーション実行
      </button>
    </div>
  </form>
</mat-card>
```

#### 3.2 結果表示カードの実装

```html
<!-- simulator.page.ts の template 内 -->

<!-- 結果表示: else付きng-templateを使用して、常にどちらか片方だけを表示 -->
<ng-container *ngIf="calculationResult() as result; else noResult">
  <mat-card class="result-card">
  <div class="result-header">
    <h2>
      <mat-icon>assessment</mat-icon>
      計算結果
    </h2>
  </div>

  <div class="result-content">
    <!-- 等級・標準報酬月額 -->
    <div class="result-section">
      <h3>等級・標準報酬月額</h3>
      <div class="result-grid">
        <div class="result-item">
          <span class="result-label">健康保険等級</span>
          <span class="result-value">{{ result.healthGrade }}</span>
        </div>
        <div class="result-item">
          <span class="result-label">健康保険標準報酬月額</span>
          <span class="result-value">{{ result.healthStandardMonthly | number }}円</span>
        </div>
        <div class="result-item">
          <span class="result-label">厚生年金等級</span>
          <span class="result-value">{{ result.pensionGrade }}</span>
        </div>
        <div class="result-item">
          <span class="result-label">厚生年金標準報酬月額</span>
          <span class="result-value">{{ result.pensionStandardMonthly | number }}円</span>
        </div>
      </div>
    </div>

    <!-- 健康保険 -->
    <div class="result-section">
      <h3>健康保険</h3>
      <div class="result-grid">
        <div class="result-item">
          <span class="result-label">本人負担額</span>
          <span class="result-value employee">{{ result.amounts.healthEmployee | number }}円</span>
        </div>
        <div class="result-item">
          <span class="result-label">会社負担額</span>
          <span class="result-value employer">{{ result.amounts.healthEmployer | number }}円</span>
        </div>
        <div class="result-item">
          <span class="result-label">合計</span>
          <span class="result-value">{{ result.amounts.healthTotal | number }}円</span>
        </div>
      </div>
    </div>

    <!-- 介護保険（対象の場合のみ） -->
    <div class="result-section" *ngIf="result.amounts.careTotal > 0">
      <h3>介護保険</h3>
      <div class="result-grid">
        <div class="result-item">
          <span class="result-label">本人負担額</span>
          <span class="result-value employee">{{ result.amounts.careEmployee | number }}円</span>
        </div>
        <div class="result-item">
          <span class="result-label">会社負担額</span>
          <span class="result-value employer">{{ result.amounts.careEmployer | number }}円</span>
        </div>
        <div class="result-item">
          <span class="result-label">合計</span>
          <span class="result-value">{{ result.amounts.careTotal | number }}円</span>
        </div>
      </div>
    </div>

    <!-- 厚生年金 -->
    <div class="result-section">
      <h3>厚生年金</h3>
      <div class="result-grid">
        <div class="result-item">
          <span class="result-label">本人負担額</span>
          <span class="result-value employee">{{ result.amounts.pensionEmployee | number }}円</span>
        </div>
        <div class="result-item">
          <span class="result-label">会社負担額</span>
          <span class="result-value employer">{{ result.amounts.pensionEmployer | number }}円</span>
        </div>
        <div class="result-item">
          <span class="result-label">合計</span>
          <span class="result-value">{{ result.amounts.pensionTotal | number }}円</span>
        </div>
      </div>
    </div>

    <!-- トータル -->
    <div class="result-section total-section">
      <h3>トータル</h3>
      <div class="result-grid">
        <div class="result-item">
          <span class="result-label">本人負担合計</span>
          <span class="result-value employee large">{{ result.amounts.totalEmployee | number }}円</span>
        </div>
        <div class="result-item">
          <span class="result-label">会社負担合計</span>
          <span class="result-value employer large">{{ result.amounts.totalEmployer | number }}円</span>
        </div>
        <div class="result-item">
          <span class="result-label">合計額</span>
          <span class="result-value large">
            {{ (result.amounts.totalEmployee + result.amounts.totalEmployer) | number }}円
          </span>
        </div>
      </div>
    </div>
  </div>
  </mat-card>
</ng-container>

<!-- 未計算時の表示 -->
<ng-template #noResult>
  <mat-card class="result-card placeholder">
    <div class="result-header">
      <h2>
        <mat-icon>assessment</mat-icon>
        計算結果
      </h2>
    </div>
    <div class="placeholder-content">
      <mat-icon>info</mat-icon>
      <p>まだ計算されていません。上記の入力項目を入力して「シミュレーション実行」ボタンを押してください。</p>
    </div>
  </mat-card>
</ng-template>
```

#### 3.3 スタイルの実装

```typescript
// simulator.page.ts の styles 内

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
      margin-bottom: 1.5rem;
    }

    .page-header {
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 2px solid #e0e0e0;
    }

    .page-title-section h2 {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: #333;
    }

    .page-title-section h2 mat-icon {
      color: #667eea;
    }

    .page-title-section p {
      margin: 0;
      color: #666;
      font-size: 0.95rem;
    }

    .simulator-form {
      margin-top: 1rem;
    }

    .form-section {
      margin-bottom: 1.5rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 1.5rem;
      border-top: 1px solid #e0e0e0;
    }

    .inline-spinner {
      margin-right: 8px;
    }

    button[mat-raised-button] {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    button[mat-raised-button]:hover:not(:disabled) {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
    }

    .result-card {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .result-header {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #e0e0e0;
    }

    .result-header h2 {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: #333;
    }

    .result-header h2 mat-icon {
      color: #667eea;
    }

    .result-content {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .result-section {
      padding: 1.5rem;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .result-section h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #333;
    }

    .result-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .result-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .result-label {
      font-size: 0.875rem;
      color: #666;
      font-weight: 500;
    }

    .result-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: #333;
    }

    .result-value.employee {
      color: #1976d2;
    }

    .result-value.employer {
      color: #2e7d32;
    }

    .result-value.large {
      font-size: 1.5rem;
    }

    .total-section {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    }

    .placeholder-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 3rem;
      color: #999;
      text-align: center;
    }

    .placeholder-content mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #ccc;
    }

    .placeholder-content p {
      margin: 0;
      font-size: 1rem;
    }

    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        text-align: center;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      .result-grid {
        grid-template-columns: 1fr;
      }
    }
  `
]
```

---

## ✅ 受け入れ条件

### 機能要件

1. ✅ 入力項目（対象年月、報酬月額、健康保険等級、厚生年金等級、介護保険対象フラグ）が正しく入力できる
2. ✅ 「シミュレーション実行」ボタンを押すと、計算が実行される
3. ✅ 計算結果が正しく表示される（等級・標準報酬月額、各保険の本人負担額・会社負担額・合計、トータル）
4. ✅ 金額が`DecimalPipe`でカンマ区切り表示される
5. ✅ 介護保険対象フラグが`false`の場合、介護保険の結果が表示されない（または0円と表示される）

### 計算ロジックの整合性

1. ✅ 既存の`premium-calculator.ts`の`calculateMonthlyPremiumForEmployee`関数を使用している
2. ✅ マスタから取得した保険料率を使用している（`MastersService.getRatesForYearMonth`）
3. ✅ 月次保険料一覧画面（`monthly-premiums.page.ts`）と同じ計算ロジックを使用している
4. ✅ 計算結果が、月次保険料一覧画面の結果と一致する（同じ入力値の場合）

### エラーハンドリング

1. ✅ マスタが未設定の場合、適切なエラーメッセージが表示される
2. ✅ 健康保険料率が未設定の場合、エラーメッセージが表示される
3. ✅ 厚生年金保険料率が未設定の場合、エラーメッセージが表示される
4. ✅ 入力値が不正な場合、フォームバリデーションエラーが表示される

### UI/UX要件

1. ✅ 既存のページ（`monthly-premiums.page.ts`、`dashboard.page.ts`）と一貫したデザインになっている
2. ✅ 未計算時は「まだ計算されていません」と表示される
3. ✅ ローディング状態が適切に表示される（ボタンにスピナー表示）
4. ✅ レスポンシブデザインに対応している（モバイルでも見やすい）

### 既存機能への影響

1. ✅ 既存のページ（ダッシュボード・月次保険料・従業員一覧など）に影響を及ぼさない
2. ✅ 既存の計算ロジック（`premium-calculator.ts`）を変更しない
3. ✅ 既存のマスタサービス（`MastersService`）を変更しない

---

## 🔍 実装時の注意点

### 1. 既存スタイルの維持
- **重要**: 既存の`monthly-premiums.page.ts`や`dashboard.page.ts`のスタイルを参考にし、一貫したデザインを維持してください
- カードのレイアウト、色、余白などは既存ページと統一してください

### 2. 計算ロジックの再利用
- `premium-calculator.ts`の`calculateMonthlyPremiumForEmployee`関数をそのまま使用します
- この関数は`Employee`オブジェクトと`PremiumRateContext`を受け取るため、一時的な`Employee`オブジェクトを作成して渡します
- 計算ロジックを変更せず、既存の実装をそのまま利用してください

### 3. マスタからの料率取得
- `MastersService.getRatesForYearMonth(office, yearMonth)`を使用して保険料率を取得します
- **重要**: このメソッドが`Promise`を返す場合は`await`でOKですが、`Observable`を返す場合は`await firstValueFrom(...)`を使用してください
- 実装時に実コードを確認して、適切な方法で呼び出してください
- このメソッドは`{ healthRate?, careRate?, pensionRate? }`を返します
- 健康保険料率と厚生年金保険料率が必須で、未設定の場合はエラーを表示します

### 4. 介護保険対象判定
- Phase1-11では、ユーザーが手動で「介護保険対象フラグ」を設定する方式とします
- **重要**: 計算時は`birthDate`を適切に設定することで、`premium-calculator.ts`の`isCareInsuranceTarget`関数が正しく判定します
  - `isCareInsuranceTarget === true` のとき: `birthDate = '1980-01-01'`（確実に40〜64歳になる日付）
  - `isCareInsuranceTarget === false` のとき: `birthDate = '2005-01-01'`（確実に40歳未満になる日付）
- これにより、`calculateMonthlyPremiumForEmployee`の結果をそのまま使用でき、手動で`care`金額を上書きする必要はありません
- 月次保険料計算との整合性も保たれます
- **将来の拡張案**: より正確な実装としては、生年月日入力フィールドを追加して、実際の生年月日から`isCareInsuranceTarget`関数を使用する方法があります

### 5. エラーハンドリング
- マスタ未設定、料率未設定、計算失敗などのエラーケースを適切に処理してください
- `MatSnackBar`を使用してエラーメッセージを表示します
- **重要**: エラー時は必ず`this.calculationResult.set(null)`を呼び出し、古い結果を消してください
- これにより、「エラーなのに数字だけ残ってる」状態を避けられます
- エラー時は結果カードを非表示またはプレースホルダー表示にします

### 6. データの保存
- **重要**: Phase1-11では、Firestoreへの保存は一切行いません
- 計算結果は画面表示のみで、ページを離れると消えます
- 履歴機能や保存機能は将来の拡張スコープとします

### 7. Employeeダミーオブジェクトの作成
- **重要**: `Employee`型の必須項目をすべてダミー値で埋めてください
- 実コードの`Employee`インターフェースを確認し、必須フィールド（`id`, `officeId`, `name`, `birthDate`, `hireDate`, `employmentType`, `monthlyWage`, `isInsured`）をすべて設定してください
- `healthStandardMonthly` / `pensionStandardMonthly`が型に存在するか確認してください（optionalの場合は設定してもOK）
- 足りない必須フィールドがある場合は、実コードの`Employee`型を見て調整してください
- `office.id`が正しいか確認してください（`office.officeId`の可能性もある）

### 8. パフォーマンス
- 計算は同期的に実行されるため、パフォーマンスの問題はありません
- ただし、マスタ取得は非同期処理のため、`firstValueFrom`を使用して適切に処理してください

---

## 📝 実装チェックリスト

### 必須実装
- [ ] `SimulatorPage`コンポーネントの基本構成を作成
- [ ] `ReactiveFormsModule`を使用したフォームを実装
- [ ] 入力項目（対象年月、報酬月額、健康保険等級、厚生年金等級、介護保険対象フラグ）を実装
- [ ] フォームバリデーションを実装
- [ ] `onSimulate()`メソッドを実装
- [ ] `MastersService.getRatesForYearMonth`を使用して保険料率を取得
- [ ] 一時的な`Employee`オブジェクトを作成
- [ ] `calculateMonthlyPremiumForEmployee`関数を呼び出して計算
- [ ] 計算結果を`calculationResult` signalに設定
- [ ] 結果表示カードを実装（等級・標準報酬月額、各保険の金額、トータル）
- [ ] エラーハンドリングを実装（マスタ未設定、料率未設定など）
- [ ] 未計算時のプレースホルダー表示を実装
- [ ] ローディング状態の表示を実装
- [ ] スタイルを実装（既存ページと一貫したデザイン）

### 任意実装（余裕があれば）
- [ ] 生年月日入力フィールドを追加して、介護保険対象を自動判定
- [ ] 計算結果の詳細表示（各保険の料率表示など）
- [ ] 入力値の履歴表示（ローカルストレージに保存）

### テスト・確認
- [ ] 入力項目が正しく入力できる
- [ ] シミュレーション実行ボタンが正しく動作する
- [ ] 計算結果が正しく表示される
- [ ] マスタ未設定時にエラーメッセージが表示される
- [ ] 入力値が不正な場合にバリデーションエラーが表示される
- [ ] 既存ページに影響を及ぼさない
- [ ] 月次保険料一覧画面と同じ計算結果になる（同じ入力値の場合）

---

## 🎨 参考実装

以下のファイルを参考にしてください：

- `src/app/pages/premiums/monthly/monthly-premiums.page.ts` - UIデザインとフォーム実装の参考
- `src/app/pages/dashboard/dashboard.page.ts` - カードデザインの参考
- `src/app/utils/premium-calculator.ts` - 計算ロジックの実装
- `src/app/services/masters.service.ts` - マスタサービス（`getRatesForYearMonth`メソッド）

---

## 📌 補足事項

### 1. 計算ロジックの再利用について
- `premium-calculator.ts`の`calculateMonthlyPremiumForEmployee`関数は、`Employee`オブジェクトと`PremiumRateContext`を受け取ります
- シミュレーションでは、実際の従業員レコードは存在しないため、一時的な`Employee`オブジェクトを作成して渡します
- この一時的なオブジェクトには、計算に必要な最小限の情報（`monthlyWage`、`healthGrade`、`pensionGrade`など）を設定します

### 2. マスタからの料率取得について
- `MastersService.getRatesForYearMonth(office, yearMonth)`を使用して保険料率を取得します
- このメソッドは、事業所の健康保険プラン（協会けんぽ／組合健保）に応じて適切な料率を取得します
- 健康保険料率と厚生年金保険料率が必須で、未設定の場合はエラーを表示します
- 介護保険料率はオプションで、未設定の場合は介護保険料は0円になります

### 3. 介護保険対象判定について
- `premium-calculator.ts`の`isCareInsuranceTarget`関数は、生年月日から年齢を計算して40〜64歳かどうかを判定します
- Phase1-11では、年齢計算を行わず、ユーザーが手動で「介護保険対象フラグ」を設定する方式とします
- より正確な実装としては、生年月日入力フィールドを追加して、`isCareInsuranceTarget`関数を使用することも可能です（将来の拡張案）

### 4. 将来の拡張案
- **複数シナリオ比較**: 複数の報酬月額・等級を入力して、結果を並べて比較表示
- **履歴保存機能**: Firestoreにシミュレーション結果を保存し、過去の結果を一覧表示
- **CSVエクスポート**: シミュレーション結果をCSV形式でエクスポート
- **年齢自動計算**: 生年月日を入力すると、介護保険対象フラグを自動判定
- **等級自動判定**: 報酬月額を入力すると、標準報酬等級表から等級を自動判定

---

以上で実装指示書は完了です。不明点があれば確認してください。

