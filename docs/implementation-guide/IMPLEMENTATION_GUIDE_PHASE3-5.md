# Phase3-5 実装指示書: 被扶養者状況確認・年次見直し支援機能

## 1. 概要

Phase3-5では、被扶養者の年次見直しや「被扶養者状況リスト」への回答作業を支援する機能を実装します。

事業所ごとに「扶養状況確認」を実施した年月および担当者を記録し、被扶養者ごとに直近の扶養状況確認結果（確認日、確認結果、確認担当者、備考）を保持します。また、特定の基準年月日時点（例：○年○月1日現在）で扶養に入っている被扶養者の一覧を抽出・表示できるようにし、健康保険組合等から送付される被扶養者状況リストへの記入・回答作業を効率化します。

**重要**: 被扶養者資格の最終的な認定（継続・喪失）はあくまで事業所および健康保険組合等の判断とし、本システムは確認結果の記録・参照を支援する役割にとどめます。

### Phase3-5のスコープ

Phase3-5では以下の機能を実装します：

- **扶養状況確認の記録**: 事業所ごとに「扶養状況確認」を実施した年月および担当者を記録できる
- **被扶養者ごとの確認結果記録**: 被扶養者ごとに、直近の扶養状況確認結果を保持する
  - 確認日
  - 確認結果（継続／削除予定／要確認）
  - 確認担当者
  - 備考（所得状況・就労状況のメモなど）
- **基準年月日時点での抽出機能**: 特定の基準年月日時点で扶養に入っている被扶養者の一覧を抽出・表示できる

**今回の実装対象外**:

- **自動判定機能**: 被扶養者資格の自動判定や、所得・就労状況の自動チェック機能は対象外とします
- **被扶養者状況リストの自動生成**: PDFやExcel形式での被扶養者状況リストの自動生成は将来拡張案とします

---

## 2. 前提・ゴール

### 前提

- **型定義**: `DependentReview`型（扶養状況確認結果）は`src/app/types.ts`に未定義です。新規に定義します
- **既存サービス**: `DependentsService`が存在し、被扶養者情報を取得できます
- **既存サービス**: `EmployeesService`が存在し、従業員情報を取得できます
- **既存ページ**: 被扶養者状況確認管理用のページは存在しません。新規に`src/app/pages/dependent-reviews/dependent-reviews.page.ts`を作成します
- **セキュリティルール**: `firestore.rules`に`dependentReviews`コレクションのルールは未定義です
- **リアルタイム購読パターン**: `DependentsService`や`ProceduresService`は`collectionData`を使用したリアルタイム購読パターンを使用しています。`DependentReviewsService.list()`もこのパターンに合わせます
- **ユーザー情報の取得**: 既存の「現在ログイン中のユーザー情報」を取得するサービス（例：`CurrentUserService`または`AuthService`）が存在します。コード例ではプロジェクトで実際に使っているサービス名に合わせて読み替えてください

### ゴール

Phase3-5完了の判定基準：

1. ✅ **扶養状況確認の型定義**（`src/app/types.ts`）が追加されていること
   - `DependentReview`型の定義
   - `DependentReviewResult`型（確認結果）の定義

2. ✅ **扶養状況確認サービス**（`src/app/services/dependent-reviews.service.ts`）が存在し、CRUD操作が実装されていること
   - 確認結果の作成（`create()`）
   - 確認結果の一覧取得（`list()`）- リアルタイム購読に対応
   - 確認結果の更新（`update()`）
   - 確認結果の削除（`delete()`）
   - **注意**: 基準年月日時点での抽出ロジックはサービス層では提供せず、ページコンポーネント側で実装します

3. ✅ **扶養状況確認管理画面**（`src/app/pages/dependent-reviews/dependent-reviews.page.ts`）が実装されていること
   - 事業所ごとの確認結果一覧表示
   - 基準年月日時点での被扶養者抽出・表示（**最終的な列構成やインライン操作仕様は 11 章を優先する**）
   - 確認結果の登録・編集・削除
   - **admin/hr専用**（employeeロールはアクセス不可）

4. ✅ **Firestoreセキュリティルール**が実装されていること
   - admin/hrは全確認結果を閲覧・作成・更新・削除可能
   - **現時点では、employeeロールは`dependentReviews`コレクションを一切readしない前提**（将来拡張用としてルールは準備）

5. ✅ **既存機能が壊れていないこと**（被扶養者管理、従業員管理など）

---

## 3. 現状整理

### 3.1 Dependent型の定義

`src/app/types.ts`に定義されている`Dependent`型：

```typescript
export interface Dependent {
  id: string;
  name: string;
  relationship: DependentRelationship;
  dateOfBirth: IsoDateString;
  qualificationAcquiredDate?: IsoDateString;
  qualificationLossDate?: IsoDateString;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}
```

被扶養者の資格取得日（`qualificationAcquiredDate`）と資格喪失日（`qualificationLossDate`）が既に定義されています。これらを基準年月日時点での抽出に利用します。

### 3.2 DependentsServiceの実装

`src/app/services/dependents.service.ts`は既に存在し、以下のメソッドが実装されています：

- `list(officeId: string, employeeId: string): Observable<Dependent[]>`
- `save(...)`
- `delete(...)`

### 3.3 EmployeesServiceの実装

`src/app/services/employees.service.ts`は既に存在し、以下のメソッドが実装されています：

- `list(officeId: string): Observable<Employee[]>`
- `get(officeId: string, employeeId: string): Observable<Employee | null>`

---

## 4. 変更対象ファイル

### 4.1 新規作成ファイル

- `src/app/types.ts`（型定義の追加）
- `src/app/services/dependent-reviews.service.ts`（新規作成）
- `src/app/pages/dependent-reviews/dependent-reviews.page.ts`（新規作成）
- `src/app/pages/dependent-reviews/review-form-dialog.component.ts`（新規作成）

### 4.2 既存ファイルの変更

- `src/app/app.routes.ts`（`/dependent-reviews`ルートの追加）
- `src/app/app.ts`（サイドメニューに「扶養状況確認」メニュー項目を追加）
- `firestore.rules`（`dependentReviews`コレクションのルール追加）

---

## 5. 画面仕様

### 5.1 扶養状況確認管理画面（`/dependent-reviews`）

**アクセス権限**: admin/hr専用

**主要機能**:

1. **基準年月日時点での被扶養者抽出**
   - 基準年月日を選択（例：2025年4月1日）
   - 「抽出」ボタンをクリック
   - 基準年月日時点で扶養に入っている被扶養者の一覧を表示
   - **最終的な列構成・表示内容・インライン操作の仕様は 11 章を参照してください**

2. **確認結果の登録・編集**
   - 「確認結果を登録」ボタンから登録ダイアログを開く
   - 登録項目：
     - 対象従業員（必須）
     - 対象被扶養者（必須）
     - 確認日（必須、YYYY-MM-DD形式）
     - 確認結果（必須、継続／削除予定／要確認）
     - 確認担当者（任意、テキスト入力）
     - 備考（任意、テキストエリア）

3. **確認結果一覧表示**
   - 事業所ごとの確認結果を一覧表示
   - 表示項目：
     - 確認日
     - 従業員名
     - 被扶養者名
     - 確認結果
     - 確認担当者
     - 備考
   - フィルタ機能：
     - 確認結果別フィルタ（継続／削除予定／要確認）

### 5.2 確認結果登録・編集ダイアログ

**フォーム項目**:

- **対象従業員**（必須）
  - `<mat-select>`で従業員を選択
  - `EmployeesService.list()`で取得した従業員一覧から選択
  - **現時点では、編集ダイアログでも対象従業員を変更可能とする（誤登録の修正や付け替えを想定）**
  - 将来、「編集時は対象を固定したい」などの要望が出たら、disabledにする／別仕様にする余地があります（実装は今回不要）

- **対象被扶養者**（必須）
  - 対象従業員を選択したら、その従業員の被扶養者一覧を`<mat-select>`で表示
  - `DependentsService.list(officeId, employeeId)`で取得
  - **現時点では、編集ダイアログでも対象被扶養者を変更可能とする（誤登録の修正や付け替えを想定）**

- **確認日**（必須）
  - `<input type="date">`で日付を入力
  - YYYY-MM-DD形式のstringとして保存

- **確認結果**（必須）
  - `<mat-select>`で選択
  - 選択肢：
    - `'continued'` - 継続
    - `'to_be_removed'` - 削除予定
    - `'needs_review'` - 要確認

- **確認担当者**（任意）
  - `<input matInput>`でテキスト入力
  - 担当者名（テキスト文字列）として保存

- **備考**（任意）
  - `<textarea matInput>`でテキスト入力
  - 所得状況・就労状況のメモなど

---

## 6. 実装方針

### 6.1 型定義（`src/app/types.ts`）

```typescript
// 扶養状況確認結果
export type DependentReviewResult = 'continued' | 'to_be_removed' | 'needs_review';

export interface DependentReview {
  id: string;
  officeId: string;
  employeeId: string;
  dependentId: string;
  reviewDate: string; // YYYY-MM-DD形式
  result: DependentReviewResult;
  reviewedBy?: string; // 確認担当者名（テキスト）
  note?: string; // 備考
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  createdByUserId?: string;
  updatedByUserId?: string;
}
```

### 6.2 DependentReviewsService（`src/app/services/dependent-reviews.service.ts`）

```typescript
import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  orderBy,
  query,
  QueryConstraint,
  setDoc,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { DependentReview, DependentReviewResult } from '../types';

@Injectable({ providedIn: 'root' })
export class DependentReviewsService {
  constructor(private readonly firestore: Firestore) {}

  private collectionPath(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'dependentReviews');
  }

  async create(
    officeId: string,
    review: {
      employeeId: string;
      dependentId: string;
      reviewDate: string; // YYYY-MM-DD形式
      result: DependentReviewResult;
      reviewedBy?: string;
      note?: string;
    },
    createdByUserId: string
  ): Promise<void> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref);
    const now = new Date().toISOString();

    const payload: DependentReview = {
      id: docRef.id,
      officeId,
      employeeId: review.employeeId,
      dependentId: review.dependentId,
      reviewDate: review.reviewDate,
      result: review.result,
      createdAt: now,
      updatedAt: now,
      createdByUserId,
      updatedByUserId: createdByUserId
    };

    if (review.reviewedBy != null) {
      payload.reviewedBy = review.reviewedBy;
    }
    if (review.note != null) {
      payload.note = review.note;
    }

    await setDoc(docRef, payload);
  }

  list(
    officeId: string,
    filters?: {
      result?: DependentReviewResult;
      employeeId?: string;
      dependentId?: string;
    }
  ): Observable<DependentReview[]> {
    const ref = this.collectionPath(officeId);
    const constraints: QueryConstraint[] = [];

    if (filters?.result) {
      constraints.push(where('result', '==', filters.result));
    }
    if (filters?.employeeId) {
      constraints.push(where('employeeId', '==', filters.employeeId));
    }
    if (filters?.dependentId) {
      constraints.push(where('dependentId', '==', filters.dependentId));
    }

    constraints.push(orderBy('reviewDate', 'desc'));

    const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref, orderBy('reviewDate', 'desc'));

    return collectionData(q, { idField: 'id' }) as Observable<DependentReview[]>;
  }

  async update(
    officeId: string,
    reviewId: string,
    updates: Partial<DependentReview>,
    updatedByUserId: string
  ): Promise<void> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, reviewId);
    const now = new Date().toISOString();

    const payload: Partial<DependentReview> = {
      ...updates,
      updatedAt: now,
      updatedByUserId
    };

    await updateDoc(docRef, payload);
  }

  async delete(officeId: string, reviewId: string): Promise<void> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, reviewId);
    await deleteDoc(docRef);
  }
}
```

**注意**: 
- サービス層では`list()`（＋CRUD）のみ提供し、基準年月日時点の抽出ロジックはページ側（`extractDependents()`）に集約します。
- Firestoreの複雑なクエリを避けるため、基準年月日時点での抽出はページコンポーネント側で`combineLatest`を使って実装してください。
- 不要なimport（例：`IsoDateString`が実際に使用されていない場合など）は残さないでください。

### 6.3 DependentReviewsPage（`src/app/pages/dependent-reviews/dependent-reviews.page.ts`）

**注意**: ここでは基礎的な画面構造を説明しており、**最終的な列構成やインライン操作仕様は 11 章を優先する**。11 章の内容が最終版 UI（被扶養者状況リスト風）の仕様を上書きする追加指示です。

```typescript
import { AsyncPipe, DatePipe, NgIf, NgFor } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject, combineLatest, firstValueFrom, map, of, switchMap, take, Observable } from 'rxjs';
import { DependentReviewsService } from '../../services/dependent-reviews.service';
import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { EmployeesService } from '../../services/employees.service';
import { DependentsService } from '../../services/dependents.service';
import { DependentReviewResult, DependentReview, Employee, Dependent } from '../../types';
import { ReviewFormDialogComponent } from './review-form-dialog.component';

interface DependentWithReview extends Dependent {
  employeeId: string;
  employeeName: string;
  latestReview?: DependentReview;
}

@Component({
  selector: 'ip-dependent-reviews-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatButtonToggleModule,
    MatTooltipModule,
    AsyncPipe,
    NgIf,
    NgFor,
    DatePipe
  ],
  template: `
    <section class="page">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>family_restroom</mat-icon>
          </div>
          <div class="header-text">
            <h1>扶養状況確認・年次見直し</h1>
            <p>被扶養者の年次見直しや「被扶養者状況リスト」への回答作業を支援します。</p>
          </div>
        </div>
      </mat-card>

      <mat-card class="content-card">
        <div class="card-header">
          <h2>基準年月日時点での被扶養者抽出</h2>
          <div class="extraction-controls">
            <mat-form-field appearance="outline">
              <mat-label>基準年月日</mat-label>
              <input matInput type="date" [value]="referenceDate" (change)="referenceDate = $any($event.target).value" />
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="extractDependents()">
              <mat-icon>search</mat-icon>
              抽出
            </button>
          </div>
        </div>

        <div *ngIf="extractedDependents$ | async as dependents; else noExtraction">
          <div class="table-container" *ngIf="dependents && dependents.length > 0; else empty">
            <table mat-table [dataSource]="dependents" class="dependents-table">
              <!-- 行番号列 -->
              <ng-container matColumnDef="index">
                <th mat-header-cell *matHeaderCellDef>No.</th>
                <td mat-cell *matCellDef="let row; let i = index">{{ i + 1 }}</td>
              </ng-container>

              <!-- 被保険者名列 -->
              <ng-container matColumnDef="employeeName">
                <th mat-header-cell *matHeaderCellDef>被保険者名</th>
                <td mat-cell *matCellDef="let row">{{ row.employeeName }}</td>
              </ng-container>

              <!-- 被扶養者名列 -->
              <ng-container matColumnDef="dependentName">
                <th mat-header-cell *matHeaderCellDef>被扶養者名</th>
                <td mat-cell *matCellDef="let row">{{ row.name }}</td>
              </ng-container>

              <!-- 続柄列 -->
              <ng-container matColumnDef="relationship">
                <th mat-header-cell *matHeaderCellDef>続柄</th>
                <td mat-cell *matCellDef="let row">{{ getRelationshipLabel(row.relationship) }}</td>
              </ng-container>

              <!-- 生年月日列 -->
              <ng-container matColumnDef="dateOfBirth">
                <th mat-header-cell *matHeaderCellDef>生年月日</th>
                <td mat-cell *matCellDef="let row">{{ row.dateOfBirth | date: 'yyyy-MM-dd' }}</td>
              </ng-container>

              <!-- 資格取得日列 -->
              <ng-container matColumnDef="qualificationAcquiredDate">
                <th mat-header-cell *matHeaderCellDef>資格取得日</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.qualificationAcquiredDate ? (row.qualificationAcquiredDate | date: 'yyyy-MM-dd') : '-' }}
                </td>
              </ng-container>

              <!-- 資格喪失日列 -->
              <ng-container matColumnDef="qualificationLossDate">
                <th mat-header-cell *matHeaderCellDef>資格喪失日</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.qualificationLossDate ? (row.qualificationLossDate | date: 'yyyy-MM-dd') : '-' }}
                </td>
              </ng-container>

              <!-- 確認結果列（インライン操作） -->
              <ng-container matColumnDef="result">
                <th mat-header-cell *matHeaderCellDef class="result-header">確認区分</th>
                <td mat-cell *matCellDef="let row" class="result-cell">
                  <mat-button-toggle-group
                    [value]="row.latestReview?.result || null"
                    (change)="onQuickResultChange(row, $event.value)"
                    [disabled]="!row.latestReview && !referenceDate"
                  >
                    <mat-button-toggle value="continued">継続</mat-button-toggle>
                    <mat-button-toggle value="to_be_removed">削除予定</mat-button-toggle>
                    <mat-button-toggle value="needs_review">要確認</mat-button-toggle>
                  </mat-button-toggle-group>
                  <span *ngIf="!row.latestReview && !referenceDate" class="no-review">未確認</span>
                </td>
              </ng-container>

              <!-- 備考列 -->
              <ng-container matColumnDef="note">
                <th mat-header-cell *matHeaderCellDef>備考</th>
                <td mat-cell *matCellDef="let row" class="note-cell">
                  <ng-container *ngIf="row.latestReview?.note; else noNote">
                    <mat-icon matTooltip="{{ row.latestReview.note }}" (click)="openEditDialog(row.latestReview!)" style="cursor: pointer;">
                      notes
                    </mat-icon>
                    <span>メモあり</span>
                  </ng-container>
                  <ng-template #noNote>
                    <span class="no-note">-</span>
                  </ng-template>
                </td>
              </ng-container>

              <!-- アクション列 -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-header">操作</th>
                <td mat-cell *matCellDef="let row" class="actions-cell">
                  <button mat-icon-button (click)="openReviewDialog(row)" aria-label="確認結果を登録">
                    <mat-icon>edit</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
          <ng-template #empty>
            <div class="empty-state">
              <mat-icon>inbox</mat-icon>
              <p>基準年月日時点で扶養に入っている被扶養者はありません。</p>
            </div>
          </ng-template>
        </div>

        <ng-template #noExtraction>
          <div class="empty-state">
            <mat-icon>info</mat-icon>
            <p>基準年月日を選択して「抽出」ボタンをクリックしてください。</p>
          </div>
        </ng-template>
      </mat-card>

      <mat-card class="content-card">
        <div class="card-header">
          <h2>確認結果一覧</h2>
          <div class="filters">
            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>確認結果</mat-label>
              <mat-select [value]="resultFilter$.value" (selectionChange)="resultFilter$.next($event.value)">
                <mat-option value="all">すべて</mat-option>
                <mat-option value="continued">継続</mat-option>
                <mat-option value="to_be_removed">削除予定</mat-option>
                <mat-option value="needs_review">要確認</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <button mat-flat-button color="primary" (click)="openCreateDialog()">
            <mat-icon>add</mat-icon>
            確認結果を登録
          </button>
        </div>

        <div *ngIf="reviewsViewModel$ | async as reviewsViewModel; else loading">
          <div class="table-container" *ngIf="reviewsViewModel.length > 0; else emptyReviews">
            <table mat-table [dataSource]="reviewsViewModel" class="reviews-table">
              <!-- 確認日列 -->
              <ng-container matColumnDef="reviewDate">
                <th mat-header-cell *matHeaderCellDef>確認日</th>
                <td mat-cell *matCellDef="let row">{{ row.review.reviewDate | date: 'yyyy-MM-dd' }}</td>
              </ng-container>

              <!-- 従業員名列 -->
              <ng-container matColumnDef="employeeName">
                <th mat-header-cell *matHeaderCellDef>従業員名</th>
                <td mat-cell *matCellDef="let row">{{ row.employeeName }}</td>
              </ng-container>

              <!-- 被扶養者名列 -->
              <ng-container matColumnDef="dependentName">
                <th mat-header-cell *matHeaderCellDef>被扶養者名</th>
                <td mat-cell *matCellDef="let row">{{ row.dependentName }}</td>
              </ng-container>

              <!-- 確認結果列 -->
              <ng-container matColumnDef="result">
                <th mat-header-cell *matHeaderCellDef>確認結果</th>
                <td mat-cell *matCellDef="let row">
                  <span [class]="'review-chip review-' + row.review.result">
                    {{ getReviewResultLabel(row.review.result) }}
                  </span>
                </td>
              </ng-container>

              <!-- 確認担当者列 -->
              <ng-container matColumnDef="reviewedBy">
                <th mat-header-cell *matHeaderCellDef>確認担当者</th>
                <td mat-cell *matCellDef="let row">{{ row.review.reviewedBy || '-' }}</td>
              </ng-container>

              <!-- 備考列 -->
              <ng-container matColumnDef="note">
                <th mat-header-cell *matHeaderCellDef>備考</th>
                <td mat-cell *matCellDef="let row">{{ row.review.note || '-' }}</td>
              </ng-container>

              <!-- アクション列 -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-header">アクション</th>
                <td mat-cell *matCellDef="let row" class="actions-cell">
                  <button mat-icon-button (click)="openEditDialog(row.review)" aria-label="編集">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteReview(row.review)" aria-label="削除">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="reviewDisplayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: reviewDisplayedColumns"></tr>
            </table>
          </div>
          <ng-template #emptyReviews>
            <div class="empty-state">
              <mat-icon>inbox</mat-icon>
              <p>確認結果はありません。</p>
            </div>
          </ng-template>
        </div>

        <ng-template #loading>
          <div class="empty-state">
            <mat-icon>hourglass_empty</mat-icon>
            <p>読み込み中...</p>
          </div>
        </ng-template>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .header-card {
        margin-bottom: 1rem;
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .header-icon {
        width: 56px;
        height: 56px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: #e0e7ff;
        color: #4338ca;
      }

      .header-text h1 {
        margin: 0;
        font-size: 1.5rem;
      }

      .header-text p {
        margin: 0;
        color: #4b5563;
      }

      .content-card {
        padding: 1.5rem;
        margin-bottom: 1rem;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }

      .extraction-controls {
        display: flex;
        gap: 1rem;
        align-items: center;
      }

      .filters {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .filter-select {
        width: 200px;
      }

      .table-container {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }

      .dependents-table {
        width: 100%;
      }

      .dependents-table th,
      .dependents-table td {
        padding: 8px 12px;
        font-size: 0.875rem;
      }

      .dependents-table th {
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        color: #374151;
        text-align: left;
      }

      .dependents-table td {
        border-bottom: 1px solid #f3f4f6;
      }

      .dependents-table .result-cell {
        text-align: center;
      }

      .dependents-table .no-review {
        color: #9ca3af;
        font-style: italic;
      }

      .dependents-table .note-cell {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      table {
        width: 100%;
      }

      th,
      td {
        padding: 12px 16px;
      }

      th {
        background: #f9fafb;
        color: #374151;
        text-align: left;
      }

      .actions-header,
      .actions-cell {
        text-align: center;
        width: 120px;
      }

      .empty-state {
        text-align: center;
        padding: 2rem 1rem;
        color: #6b7280;
      }

      .empty-state mat-icon {
        display: block;
        margin: 0 auto 0.5rem;
        color: #9ca3af;
        font-size: 48px;
        width: 48px;
        height: 48px;
      }

      .review-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.875rem;
      }

      .review-continued {
        background: #d1fae5;
        color: #065f46;
      }

      .review-to_be_removed {
        background: #fee2e2;
        color: #991b1b;
      }

      .review-needs_review {
        background: #fef3c7;
        color: #92400e;
      }

      .review-date {
        font-size: 0.75rem;
        margin-left: 0.5rem;
        opacity: 0.7;
      }

      .no-review {
        color: #9ca3af;
      }
    `
  ]
})
export class DependentReviewsPage {
  private readonly reviewsService = inject(DependentReviewsService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly dialog = inject(MatDialog);
  private readonly employeesService = inject(EmployeesService);
  private readonly dependentsService = inject(DependentsService);

  referenceDate: string = '';

  readonly resultFilter$ = new BehaviorSubject<DependentReviewResult | 'all'>('all');

  readonly displayedColumns: string[] = [
    'index',
    'employeeName',
    'dependentName',
    'relationship',
    'dateOfBirth',
    'qualificationAcquiredDate',
    'qualificationLossDate',
    'result',
    'note',
    'actions'
  ];

  readonly reviewDisplayedColumns: string[] = [
    'reviewDate',
    'employeeName',
    'dependentName',
    'result',
    'reviewedBy',
    'note',
    'actions'
  ];

  readonly employees$ = this.currentOffice.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) return of([]);
      return this.employeesService.list(officeId);
    })
  );

  readonly employeesMap$ = this.employees$.pipe(
    map((employees) => new Map(employees.map((emp) => [emp.id, emp])))
  );

  readonly dependentsMap$ = combineLatest([this.currentOffice.officeId$, this.employeesMap$]).pipe(
    switchMap(([officeId, employeesMap]) => {
      if (!officeId || employeesMap.size === 0) return of(new Map<string, Map<string, Dependent>>());

      const allDependents$: Observable<Dependent[]>[] = [];
      for (const employeeId of employeesMap.keys()) {
        allDependents$.push(this.dependentsService.list(officeId, employeeId));
      }

      if (allDependents$.length === 0) return of(new Map<string, Map<string, Dependent>>());

      return combineLatest(allDependents$).pipe(
        map((nestedDependents) => {
          const dependentsMap = new Map<string, Map<string, Dependent>>();
          let employeeIndex = 0;
          for (const employeeId of employeesMap.keys()) {
            dependentsMap.set(employeeId, new Map(nestedDependents[employeeIndex].map((dep) => [dep.id, dep])));
            employeeIndex++;
          }
          return dependentsMap;
        })
      );
    })
  );

  readonly reviews$ = combineLatest([this.currentOffice.officeId$, this.resultFilter$]).pipe(
    switchMap(([officeId, resultFilter]) => {
      if (!officeId) return of([]);
      const filters = resultFilter !== 'all' ? { result: resultFilter } : undefined;
      return this.reviewsService.list(officeId, filters);
    })
  );

  // 確認結果一覧テーブル用のViewModel（従業員名・被扶養者名を含む）
  readonly reviewsViewModel$ = combineLatest([this.reviews$, this.employeesMap$, this.dependentsMap$]).pipe(
    map(([reviews, employeesMap, dependentsMap]) => {
      return reviews.map((review) => {
        const employee = employeesMap.get(review.employeeId);
        const employeeDependents = dependentsMap.get(review.employeeId);
        const dependent = employeeDependents?.get(review.dependentId);
        return {
          review,
          employeeName: employee?.name ?? '不明な従業員',
          dependentName: dependent?.name ?? '不明な被扶養者'
        };
      });
    })
  );

  readonly extractedDependents$ = new BehaviorSubject<DependentWithReview[] | null>(null);

  extractDependents(): void {
    if (!this.referenceDate) {
      alert('基準年月日を選択してください');
      return;
    }

    // 抽出ボタン押下時に一度だけ現在値を使って集計するため、take(1) を使う
    combineLatest([this.employees$, this.dependentsMap$, this.reviews$])
      .pipe(
        take(1),
        map(([employees, dependentsMap, reviews]) => {
          const result: DependentWithReview[] = [];

          for (const employee of employees) {
            const employeeDependents = dependentsMap.get(employee.id);
            if (!employeeDependents) continue;

            for (const dependent of employeeDependents.values()) {
              // 基準年月日時点で扶養に入っているかチェック
              const acquiredDate = dependent.qualificationAcquiredDate;
              const lossDate = dependent.qualificationLossDate;

              if (!acquiredDate) continue; // 資格取得日が未設定の場合はスキップ

              if (acquiredDate > this.referenceDate) continue; // 資格取得日が基準日より後の場合はスキップ

              if (lossDate && lossDate <= this.referenceDate) continue; // 資格喪失日が基準日以前の場合はスキップ

              // 直近の確認結果を取得（reviewDateで降順ソート済みの前提）
              const dependentReviews = reviews.filter(
                (r) => r.employeeId === employee.id && r.dependentId === dependent.id
              );
              const latestReview = dependentReviews.length > 0 ? dependentReviews[0] : undefined;

              result.push({
                ...dependent,
                employeeId: employee.id,
                employeeName: employee.name,
                latestReview
              });
            }
          }

          return result.sort((a, b) => {
            // 従業員名、被扶養者名の順でソート
            if (a.employeeName !== b.employeeName) {
              return a.employeeName.localeCompare(b.employeeName);
            }
            return a.name.localeCompare(b.name);
          });
        })
      )
      .subscribe((dependents) => {
        this.extractedDependents$.next(dependents);
      });
  }

  async onQuickResultChange(row: DependentWithReview, newResult: DependentReviewResult): Promise<void> {
    // 同じ値を再選択した場合は更新しない
    if (row.latestReview?.result === newResult) return;

    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    const currentUserProfile = await firstValueFrom(this.currentUser.profile$);
    const currentUserId = currentUserProfile?.id;
    if (!currentUserId) {
      throw new Error('ユーザーIDが取得できませんでした');
    }

    const reviewDate = this.referenceDate || new Date().toISOString().substring(0, 10);
    const reviewedBy = currentUserProfile?.name || '';

    if (row.latestReview) {
      // 既存レコードを更新
      await this.reviewsService.update(
        officeId,
        row.latestReview.id,
        { result: newResult },
        currentUserId
      );
    } else {
      // 新しいレコードを作成
      await this.reviewsService.create(
        officeId,
        {
          employeeId: row.employeeId,
          dependentId: row.id,
          reviewDate,
          result: newResult,
          reviewedBy
        },
        currentUserId
      );
    }
  }

  getRelationshipLabel(relationship: string): string {
    const labels: Record<string, string> = {
      spouse: '配偶者',
      child: '子',
      parent: '父母',
      grandparent: '祖父母',
      sibling: '兄弟姉妹',
      other: 'その他'
    };
    return labels[relationship] || relationship;
  }

  getReviewResultLabel(result: DependentReviewResult): string {
    const labels: Record<DependentReviewResult, string> = {
      continued: '継続',
      to_be_removed: '削除予定',
      needs_review: '要確認'
    };
    return labels[result] || result;
  }

  async openCreateDialog(): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    this.dialog
      .open(ReviewFormDialogComponent, {
        width: '600px',
        data: { officeId }
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          // ダイアログが閉じられた後の処理（必要に応じて）
        }
      });
  }

  async openReviewDialog(dependent: DependentWithReview): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    this.dialog
      .open(ReviewFormDialogComponent, {
        width: '600px',
        data: { officeId, employeeId: dependent.employeeId, dependentId: dependent.id }
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          // ダイアログが閉じられた後の処理（必要に応じて）
        }
      });
  }

  async openEditDialog(review: DependentReview): Promise<void> {
    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    this.dialog
      .open(ReviewFormDialogComponent, {
        width: '600px',
        data: { officeId, review }
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          // ダイアログが閉じられた後の処理（必要に応じて）
        }
      });
  }

  async deleteReview(review: DependentReview): Promise<void> {
    if (!confirm(`確認結果を削除しますか？`)) {
      return;
    }

    const officeId = await firstValueFrom(this.currentOffice.officeId$);
    if (!officeId) return;

    await this.reviewsService.delete(officeId, review.id);
  }
}
```

### 6.4 ReviewFormDialogComponent（`src/app/pages/dependent-reviews/review-form-dialog.component.ts`）

```typescript
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom, map, of, startWith, switchMap } from 'rxjs';

import { DependentsService } from '../../services/dependents.service';
import { EmployeesService } from '../../services/employees.service';
import { DependentReviewsService } from '../../services/dependent-reviews.service';
import { CurrentUserService } from '../../services/current-user.service';
import { Dependent, DependentReviewResult, DependentReview } from '../../types';

export interface ReviewFormDialogData {
  review?: DependentReview;
  officeId: string;
  employeeId?: string;
  dependentId?: string;
}

@Component({
  selector: 'ip-review-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    NgIf,
    NgFor,
    AsyncPipe
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon>{{ data.review ? 'edit' : 'post_add' }}</mat-icon>
      {{ data.review ? '確認結果を編集' : '確認結果を登録' }}
    </h1>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <div mat-dialog-content class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>対象従業員</mat-label>
          <mat-select formControlName="employeeId" (selectionChange)="onEmployeeChange()">
            <mat-option *ngFor="let employee of employees$ | async" [value]="employee.id">
              {{ employee.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>対象被扶養者</mat-label>
          <mat-select formControlName="dependentId">
            <mat-option *ngFor="let dependent of dependents$ | async" [value]="dependent.id">
              {{ dependent.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>確認日</mat-label>
          <input matInput type="date" formControlName="reviewDate" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>確認結果</mat-label>
          <mat-select formControlName="result">
            <mat-option value="continued">継続</mat-option>
            <mat-option value="to_be_removed">削除予定</mat-option>
            <mat-option value="needs_review">要確認</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>確認担当者</mat-label>
          <input matInput formControlName="reviewedBy" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>備考</mat-label>
          <textarea matInput formControlName="note" rows="3" maxlength="500"></textarea>
        </mat-form-field>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button mat-dialog-close type="button">キャンセル</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
          保存
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
      }

      .full-width {
        grid-column: 1 / -1;
      }
    `
  ]
})
export class ReviewFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ReviewFormDialogComponent>);
  private readonly reviewsService = inject(DependentReviewsService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly employeesService = inject(EmployeesService);
  private readonly dependentsService = inject(DependentsService);

  readonly data = inject<ReviewFormDialogData>(MAT_DIALOG_DATA);

  form = this.fb.group({
    employeeId: [this.data.review?.employeeId || this.data.employeeId || '', Validators.required],
    dependentId: [this.data.review?.dependentId || this.data.dependentId || '', Validators.required],
    reviewDate: [this.data.review?.reviewDate || '', Validators.required],
    result: [this.data.review?.result || '', Validators.required],
    reviewedBy: [this.data.review?.reviewedBy || ''],
    note: [this.data.review?.note || '']
  });

  readonly employees$ = this.employeesService.list(this.data.officeId);

  readonly dependents$ = this.form.get('employeeId')!.valueChanges.pipe(
    startWith(this.data.review?.employeeId || this.data.employeeId || ''),
    switchMap((employeeId) => {
      if (!employeeId) {
        return of<Dependent[]>([]);
      }
      return this.dependentsService.list(this.data.officeId, employeeId);
    })
  );

  onEmployeeChange(): void {
    // 従業員が変更されたら、被扶養者をリセット
    this.form.patchValue({ dependentId: '' });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    const formValue = this.form.getRawValue();
    const currentUserId = await firstValueFrom(
      this.currentUser.profile$.pipe(map((profile) => profile?.id ?? null))
    );

    if (!currentUserId) {
      throw new Error('ユーザーIDが取得できませんでした');
    }

    if (this.data.review) {
      await this.reviewsService.update(
        this.data.officeId,
        this.data.review.id,
        {
          employeeId: formValue.employeeId || '',
          dependentId: formValue.dependentId || '',
          reviewDate: formValue.reviewDate || '',
          result: formValue.result as DependentReviewResult,
          reviewedBy: formValue.reviewedBy || '',
          note: formValue.note || ''
        },
        currentUserId
      );
    } else {
      await this.reviewsService.create(
        this.data.officeId,
        {
          employeeId: formValue.employeeId || '',
          dependentId: formValue.dependentId || '',
          reviewDate: formValue.reviewDate || '',
          result: formValue.result as DependentReviewResult,
          reviewedBy: formValue.reviewedBy || '',
          note: formValue.note || ''
        },
        currentUserId
      );
    }

    this.dialogRef.close(true);
  }
}
```

### 6.5 ルーティング（`src/app/app.routes.ts`）

```typescript
{
  path: 'dependent-reviews',
  canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
  loadComponent: () => import('./pages/dependent-reviews/dependent-reviews.page').then((m) => m.DependentReviewsPage)
}
```

### 6.6 サイドメニュー（`src/app/app.ts`）

```typescript
readonly navLinks: { label: string; path: string; icon: string; roles: UserRole[] }[] = [
  // ... 既存のメニュー項目 ...
  { label: '手続き履歴', path: '/procedures', icon: 'assignment_turned_in', roles: ['admin', 'hr'] },
  { label: '扶養状況確認', path: '/dependent-reviews', icon: 'family_restroom', roles: ['admin', 'hr'] },
  // ... 残りのメニュー項目 ...
];
```

---

## 7. Firestoreセキュリティルール

`firestore.rules`の`match /offices/{officeId}`ブロック内に以下を追加：

```javascript
// 扶養状況確認結果
match /dependentReviews/{reviewId} {
  // 閲覧: admin/hrは全件、employeeは現時点では閲覧不可
  // 現時点では、employeeロールはdependentReviewsコレクションを一切readしない前提
  // 将来、社員本人が自分の被扶養者の確認結果を参照できるようにする場合は、このルールを拡張する
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    (isInsureEmployee(officeId) && 
     // 将来拡張用: employeeが自分の被扶養者の確認結果を閲覧できるようにする
     // 現時点では、employeeは閲覧不可とする（必要に応じて実装）
     false)
  );

  // 作成・更新・削除: admin/hrのみ
  allow create, update, delete: if belongsToOffice(officeId) && isAdminOrHr(officeId);
}
```

**注意**: 
- **現時点では、employeeロールは`dependentReviews`コレクションを一切readしない前提**です。
- 将来、社員本人が自分の被扶養者の確認結果を参照できるようにする場合は、このルールを拡張してください。

---

## 8. テスト観点

### 8.1 機能テスト

1. **基準年月日時点での抽出機能**
   - 基準年月日を選択して「抽出」ボタンをクリック
   - 基準年月日時点で扶養に入っている被扶養者の一覧が正しく表示されること
   - `qualificationAcquiredDate <= 基準年月日`かつ`(qualificationLossDate == null || qualificationLossDate > 基準年月日)`の条件でフィルタリングされていること

2. **確認結果の登録**
   - 「確認結果を登録」ボタンから登録ダイアログを開く
   - 必須項目（対象従業員、対象被扶養者、確認日、確認結果）を入力して保存
   - Firestoreに正しく保存されること

3. **確認結果の編集・削除**
   - 確認結果一覧から編集・削除ができること
   - 編集後、Firestoreが正しく更新されること
   - 削除後、Firestoreから正しく削除されること

4. **フィルタ機能**
   - 確認結果別フィルタが正しく動作すること
   - フィルタ適用後、一覧が正しく更新されること

5. **インライン操作（11章の仕様）**
   - 基準年月日時点での被扶養者一覧で、各行の「継続／削除予定／要確認」をクリックすると、即座にスタイルが切り替わり、Firestoreに`DependentReview`が作成 or 更新されていること
   - 一度選んだ結果を別の結果に変更すると、既存レコードの`result`が上書きされること

### 8.2 権限テスト

1. **admin/hrロール**
   - `/dependent-reviews`にアクセスできること
   - 全確認結果を閲覧・作成・更新・削除できること
   - インライン操作・ダイアログ操作ができること

2. **employeeロール**
   - `/dependent-reviews`にアクセスできないこと（ガードでリダイレクト）
   - **現時点では、employeeロールは`dependentReviews`コレクションを一切readしない前提**であること

### 8.3 データ整合性テスト

1. **基準年月日時点での抽出**
   - 資格取得日が基準年月日より後の被扶養者は表示されないこと
   - 資格喪失日が基準年月日以前の被扶養者は表示されないこと
   - 資格取得日が基準年月日以前で、資格喪失日が未設定の被扶養者は表示されること

2. **確認結果の記録**
   - 確認日が正しい形式（YYYY-MM-DD）で保存されること
   - 確認結果が正しい値（continued/to_be_removed/needs_review）で保存されること

---

## 9. 完了条件

Phase3-5完了の判定基準：

1. ✅ **型定義**（`src/app/types.ts`）が追加されていること
   - `DependentReview`型の定義
   - `DependentReviewResult`型の定義

2. ✅ **扶養状況確認サービス**（`src/app/services/dependent-reviews.service.ts`）が存在し、CRUD操作が実装されていること
   - 確認結果の作成（`create()`）
   - 確認結果の一覧取得（`list()`）- リアルタイム購読に対応
   - 確認結果の更新（`update()`）
   - 確認結果の削除（`delete()`）

3. ✅ **扶養状況確認管理画面**（`src/app/pages/dependent-reviews/dependent-reviews.page.ts`）が実装されていること
   - 基準年月日時点での被扶養者抽出機能（**最終的な列構成やインライン操作仕様は 11 章を優先する**）
   - 確認結果一覧表示（ViewModelパターンを使用）
   - 確認結果の登録・編集・削除
   - フィルタ機能

4. ✅ **確認結果登録・編集ダイアログ**（`src/app/pages/dependent-reviews/review-form-dialog.component.ts`）が実装されていること
   - 対象従業員・対象被扶養者の選択（編集時も変更可能）
   - 確認日・確認結果・確認担当者・備考の入力

5. ✅ **ルーティング**が追加されていること
   - `/dependent-reviews`ルートが追加されていること
   - admin/hr専用のガードが設定されていること

6. ✅ **サイドメニュー**に「扶養状況確認」メニュー項目が追加されていること
   - admin/hrロールのみ表示されること

7. ✅ **Firestoreセキュリティルール**が実装されていること
   - admin/hrは全確認結果を閲覧・作成・更新・削除可能
   - **現時点では、employeeロールは`dependentReviews`コレクションを一切readしない前提**（将来拡張用としてルールは準備）

8. ✅ **既存機能が壊れていないこと**（被扶養者管理、従業員管理など）

---

## 10. 実装時の注意事項

1. **基準年月日時点での抽出ロジック**
   - Firestoreの複雑なクエリを避けるため、ページコンポーネント側で`combineLatest`を使って実装してください
   - `EmployeesService.list()`と`DependentsService.list()`を組み合わせて、クライアント側でフィルタリングします
   - `extractDependents()`内の購読には`take(1)`を挟み、抽出ボタン押下時に一度だけ現在値を使って集計するようにしてください
   - **日付比較の前提**: `qualificationAcquiredDate` / `qualificationLossDate` / `referenceDate` はいずれも YYYY-MM-DD 形式の文字列で管理し、文字列比較で大小判定できる前提とします。ISO形式（YYYY-MM-DD）同士であれば文字列比較で時系列順になるため、この実装で問題ありません

2. **日付の扱い**
   - 確認日（`reviewDate`）は`YYYY-MM-DD`形式のstringとして保存します
   - `<input type="date">`を使用して日付を入力します

3. **確認担当者の扱い**
   - 確認担当者はユーザーIDではなく、テキスト文字列として保存します
   - 将来的にユーザー選択機能を追加する場合は、その時点で実装を拡張してください

4. **直近の確認結果の表示**
   - 基準年月日時点での抽出画面で、各被扶養者の直近の確認結果を表示します
   - `DependentReviewsService.list()`で取得した確認結果を、`reviewDate`で降順ソートして最新のものを表示します

5. **ViewModelパターン**
   - 確認結果一覧表示では、従業員名・被扶養者名を表示するため、`combineLatest`を使って`reviews$`、`employeesMap$`、`dependentsMap$`を合成したViewModel（`reviewsViewModel$`）を作成してください

---

## 11. Phase3-5 追加実装指示書: 扶養状況確認画面を「被扶養者状況リスト」風レイアウトにする

### 0. 前提

- すでに6章に基づき、以下が実装済み or 実装中である前提です。
  - `DependentReview` / `DependentReviewResult` 型の追加（types.ts）
  - `DependentReviewsService` の作成（list/create/update/delete）
  - `/dependent-reviews` ルートとガード設定（admin/hr 専用）
  - `DependentReviewsPage` と `ReviewFormDialogComponent` の基本実装
    - 基準年月日の抽出
    - 被扶養者一覧の表示
    - 確認結果の登録・編集・削除
- 本指示書では **6.3 をベースにしたうえで、最終版 UI（被扶養者状況リスト風）の仕様を上書きする追加指示**です。
- テーブル列構成・result列のインライン操作・note列などは、**11章の内容が正とする**。

---

### 1. 目的・ゴール

#### 目的

- 健康保険組合から送付される「被扶養者状況リスト（○年○月1日現在）」に回答する作業を、InsurePath の画面からほぼそのまま行えるようにする。
- 具体的には、
  - 「○年○月1日現在で扶養に入っている被扶養者」を一覧表示
  - 一覧上で「継続／削除予定／要確認」を直感的に選択
  - 備考欄に所得状況・就労状況などのメモを残す
  といった操作を、紙の様式に近い見た目・流れで行えるようにする。

#### ゴール（Phase3-5 最終状態）

1. `/dependent-reviews` の「基準年月日時点での被扶養者一覧」のテーブルが、被保険者名・被扶養者名・続柄・生年月日・資格取得日・資格喪失日・確認区分（継続／削除予定／要確認）・備考といった列を持つ「被扶養者状況リスト」風のレイアウトになっていること。
2. 各行で **ワンクリック（ラジオボタン or トグル）で「継続／削除予定／要確認」を選択可能** になっていること。
   - 既に `DependentReview` が存在する場合はそのレコードを更新。
   - 初めて選択した場合は、新しい `DependentReview` レコードを作成。
3. 一覧から「詳細編集」ダイアログ（ReviewFormDialog）を開くことで、確認日・担当者名・備考を含めた詳細な編集も継続して行えること。
4. 既存の「確認結果一覧」テーブル（ページ下部）は、必要最小限の調整にとどめ、これまで通り `DependentReview` を時系列に確認できること。
5. 既存の他ページ・サービス・Firestore ルールには影響を与えないこと。

---

### 2. 対象ファイル

- **既存ファイル**
  - `src/app/pages/dependent-reviews/dependent-reviews.page.ts`
  - `src/app/pages/dependent-reviews/review-form-dialog.component.ts`
  - `src/app/services/dependent-reviews.service.ts`（必要なら小さなヘルパー追加のみ）
- それ以外のファイル（types.ts, firestore.rules など）は、極力変更しない。

---

### 3. 画面仕様（/dependent-reviews）

#### 3-1. ヘッダー部分は現行踏襲

- ページ上部のカード（タイトル「扶養状況確認・年次見直し」）は現行をベースに軽微な文言調整のみで OK。

---

#### 3-2. 「基準年月日時点での被扶養者一覧」を「状況リスト」風に変更

##### (1) テーブル列構成の変更

`DependentReviewsPage` の `displayedColumns` とテンプレートを以下の構成に変更してください。

**列順（displayedColumns）:**

1. `index` … 行番号（1,2,3,…）
2. `employeeName` … 被保険者名（従業員名）
3. `dependentName` … 被扶養者名
4. `relationship` … 続柄
5. `dateOfBirth` … 被扶養者の生年月日
6. `qualificationAcquiredDate` … 資格取得日
7. `qualificationLossDate` … 資格喪失日
8. `result` … 確認結果（継続／削除予定／要確認）
9. `note` … 備考（メモの有無とアイコン）
10. `actions` … 詳細編集ボタン（ReviewFormDialog を開く）

**ヘッダー表示例:**

- index → 「No.」
- employeeName → 「被保険者名」
- dependentName → 「被扶養者名」
- relationship → 「続柄」
- dateOfBirth → 「生年月日」
- qualificationAcquiredDate → 「資格取得日」
- qualificationLossDate → 「資格喪失日」
- result → 「確認区分（継続／削除予定／要確認）」
- note → 「備考」
- actions → 「操作」

※ Angular Material の `mat-table` を継続利用し、既存の `DependentWithReview` ViewModel（employeeName / latestReview などを持つ構造）を活かして実装してください。

##### (2) 確認結果のインライン操作（行ごと）

- `result` 列には、以下 3 つを横並びで表示します。
  - 継続
  - 削除予定
  - 要確認
- 実装は以下いずれかで OK です（簡単な方を選択してください）。
  - `mat-button-toggle-group`＋`mat-button-toggle` を 3 つ並べる
  - `mat-radio-group`＋`mat-radio-button` を 3 つ並べる

**要件:**

1. その行の最新確認結果（`row.latestReview?.result`）が選択状態になること。
2. ユーザーが選択を変更したとき、以下のロジックで Firestore に反映すること。

```typescript
async onQuickResultChange(row: DependentWithReview, newResult: DependentReviewResult): Promise<void> {
  // 同じ値を再選択した場合は更新しない
  if (row.latestReview?.result === newResult) return;

  const officeId = await firstValueFrom(this.currentOffice.officeId$);
  if (!officeId) return;

  const currentUserProfile = await firstValueFrom(this.currentUser.profile$);
  const currentUserId = currentUserProfile?.id;
  if (!currentUserId) {
    throw new Error('ユーザーIDが取得できませんでした');
  }

  const reviewDate = this.referenceDate || new Date().toISOString().substring(0, 10);
  const reviewedBy = currentUserProfile?.name || '';

  if (row.latestReview) {
    // 既存レコードを更新
    await this.reviewsService.update(
      officeId,
      row.latestReview.id,
      { result: newResult },
      currentUserId
    );
  } else {
    // 新しいレコードを作成
    await this.reviewsService.create(
      officeId,
      {
        employeeId: row.employeeId,
        dependentId: row.id,
        reviewDate,
        result: newResult,
        reviewedBy
      },
      currentUserId
    );
  }
  
  // Firestore 更新後は、既存のリアルタイム購読 (reviews$ / extractedDependents$) により
  // 表示が自動的に反映される想定です。明示的な再読み込み処理は不要にしてください。
}
```

##### (3) 備考列 note

`note` 列では、

- `row.latestReview?.note` が存在する場合 → アイコン＋「メモあり」などのラベルを表示（ツールチップで内容を確認できると尚良し）
- 存在しない場合 → 「-」またはグレーの「未入力」と表示

アイコン（例：`notes`）をクリックしたときは、`ReviewFormDialogComponent` を開き、該当従業員・被扶養者の確認結果を編集できるようにします。

既存 `openEditDialog(review: DependentReview)` を使う形で OK です。

##### (4) actions 列

行末の `actions` 列には、現行どおり「編集」アイコンを置き、`ReviewFormDialogComponent` を開くボタンとします。

ここからは `reviewDate` や `reviewedBy`、長い備考を含めて詳細編集ができます。

##### (5) 見た目の調整（SCSS）

被扶養者状況リストのイメージに近づけるため、以下のような調整をお願いします。

- 行高をやや低めにして一覧性を高める（padding を少し詰める）
- テーブルの枠線を薄いグレーで表示（border）
- `result` 列のラジオ/トグルは中央寄せ
- 「未確認」の場合は `result` 列にグレーのテキスト「未確認」を出すか、何も選ばれていない状態を明示的にスタイル調整する

**スタイル例:**

```scss
.dependents-table {
  th, td {
    padding: 8px 12px; // 行高を低めに
    font-size: 0.875rem;
  }

  th {
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  td {
    border-bottom: 1px solid #f3f4f6;
  }

  .result-cell {
    text-align: center;
  }

  .no-review {
    color: #9ca3af;
    font-style: italic;
  }

  .note-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
}
```

#### 3-3. 「確認結果一覧」カードの扱い

ページ下部の「確認結果一覧」カードは、基本的には **現行どおり** で構いません。

ただし、今回の UI 変更に合わせて以下の軽微な調整は行ってください（任意）。

- `result` 列の表示ラベルを `getReviewResultLabel` に統一（継続／削除予定／要確認）
- 上部フィルタのラベルやヘッダー文言を、今回の「状況リスト」用語と揃える程度の調整

---

### 4. サービス層の補助メソッド（任意）

`DependentReviewsService` に、インライン更新用の薄いラッパーメソッドを追加しても OK です。

**例:**

```typescript
async upsertQuickResult(
  officeId: string,
  existingReview: DependentReview | undefined,
  payload: {
    employeeId: string;
    dependentId: string;
    reviewDate: string;
    result: DependentReviewResult;
    reviewedBy?: string;
  },
  userId: string
): Promise<void> {
  if (existingReview) {
    return this.update(officeId, existingReview.id, { result: payload.result }, userId);
  } else {
    return this.create(officeId, payload, userId);
  }
}
```

ただし必須ではありません。ページ側で `create` / `update` を直接呼ぶ方がシンプルであれば、そのままで大丈夫です。

---

### 5. テスト観点

#### 抽出〜行ごとの操作

- 基準年月日を設定 → 「抽出」 → 被扶養者一覧が表示される。
- どの行でも「継続／削除予定／要確認」をクリックすると、即座にスタイルが切り替わり、Firestore に `DependentReview` が作成 or 更新されている。
- 一度選んだ結果を別の結果に変更すると、既存レコードの `result` が上書きされる。

#### 詳細編集との連携

- 行の「編集」アイコンや「備考」アイコンからダイアログを開き、確認日・担当者・備考を編集して保存できる。
- 保存後、一覧の `note` 列・`result` 表示がリアルタイムに更新される。

#### 再抽出時の状態維持

- 一度確認結果をつけた被扶養者について、別の基準年月日で再抽出した場合でも、過去の `latestReview`（`reviewDate` の降順先頭）が表示されること。
- （今回の仕様では「常に直近の確認結果」を表示すれば OK。基準日との厳密な整合は Phase3-5.5 以降で検討。）

#### 権限

- admin / hr ロールでのみ `/dependent-reviews` にアクセスでき、インライン操作・ダイアログ操作ができる。
- employee ロールでは `/dependent-reviews` にアクセスできない（既存ガードの挙動が変わっていないこと）。

---

### 6. Phase3-5.5（将来拡張メモ）

※ 実装は今回のスコープ外だが、コードの構成を壊さない前提で設計してほしい将来案です。

事業所ごとに「扶養状況確認セッション」を持つコレクションを追加予定。

**例**: `offices/{officeId}/dependentReviewSessions/{sessionId}`

**フィールド例：**

- `referenceDate`（○年○月1日現在）
- `checkedAt`（確認実施日）
- `checkedBy`（担当者名）
- `note`（「2025 年定期確認」など）

将来的には、

- `/dependent-reviews` 画面の上部で「セッション」を選択
- 各セッションごとの `DependentReview` 一覧を絞り込んで確認
- PDF / Excel へのエクスポート

などを実装する予定。

今回の UI 実装では、`DependentReview` が「セッション ID を持てる余地」を残しておいてもらえれば十分です。
（例えば、今は使わないが `sessionId?: string` を型に追加してもよい。）

---

以上が Phase3-5 実装指示書です。実装時は、既存のコードパターン（Phase3-3、Phase3-4など）を参考にしながら、一貫性のある実装を心がけてください。

**重要**: 6.3 で説明したテーブル構造は基礎的な画面構造の説明であり、**最終的な列構成・表示内容・インライン操作の仕様は 11 章の内容を優先してください**。11 章は 6.3 をベースにしたうえで、最終版 UI（被扶養者状況リスト風）の仕様を上書きする追加指示です。
