# Phase3-5.5 実装指示書: 扶養状況確認セッション管理機能

## 1. 概要

Phase3-5.5では、Phase3-5で実装した「被扶養者状況確認・年次見直し支援機能」を拡張し、事業所ごとに「扶養状況確認セッション」を管理する機能を実装します。

健康保険組合等から送付される「被扶養者状況リスト」への回答作業は、通常、特定の基準年月日（例：○年○月1日現在）を設定して実施されます。Phase3-5.5では、このような確認作業を「セッション」として管理し、セッションごとに基準年月日・実施日・担当者を記録し、各セッションに紐づく確認結果（`DependentReview`）を一括で管理できるようにします。

### Phase3-5.5のスコープ

Phase3-5.5では以下の機能を実装します：

- **セッションの作成・編集・削除**: 基準年月日、実施日、担当者、備考を設定してセッションを作成・管理できる
- **セッションごとの確認結果管理**: セッションに紐づく`DependentReview`を一覧表示・フィルタできる
- **セッション選択UI**: `/dependent-reviews`画面でセッションを選択し、選択したセッションに紐づく確認結果のみを表示できる
- **セッション作成時の確認結果自動紐付け**: セッション作成時に、基準年月日時点で抽出された被扶養者の確認結果を自動的にそのセッションに紐付ける

**今回の実装対象外**:

- **PDF / Excel へのエクスポート**: セッションごとの確認結果をPDFやExcel形式でエクスポートする機能は、将来の拡張として後送りします
- **セッションの承認フロー**: セッションの承認・差戻しなどのワークフロー機能は、将来の拡張として後送りします

---

## 2. 前提・ゴール

### 前提

- **Phase3-5の実装完了**: Phase3-5「被扶養者状況確認・年次見直し支援機能」が実装済みであること
- **型定義**: `DependentReview`型には既に`sessionId?: string`フィールドが追加済みです
- **既存サービス**: `DependentReviewsService`が存在し、確認結果のCRUD操作が実装されています
- **既存ページ**: `/dependent-reviews`ページが存在し、基準年月日時点での被扶養者抽出機能が実装されています
- **セキュリティルール**: `firestore.rules`に`dependentReviewSessions`コレクションのルールは未定義です
- **リアルタイム購読パターン**: `DependentReviewsService`は`collectionData`を使用したリアルタイム購読パターンを使用しています。`DependentReviewSessionsService.list()`もこのパターンに合わせます。`get()`メソッドは単発取得（`getDoc`）で実装します

### ゴール

Phase3-5.5完了の判定基準：

1. ✅ **セッションの型定義**（`src/app/types.ts`）が追加されていること
   - `DependentReviewSession`型の定義

2. ✅ **セッション管理サービス**（`src/app/services/dependent-review-sessions.service.ts`）が存在し、CRUD操作が実装されていること
   - セッションの作成（`create()`）- 戻り値は`Promise<string>`（作成されたセッションID）
   - セッションの一覧取得（`list()`）- リアルタイム購読に対応
   - セッションの取得（`get()`）- 単発取得（`Promise<DependentReviewSession | null>`）
   - セッションの更新（`update()`）
   - セッションの削除（`delete()`）

3. ✅ **セッション管理画面の拡張**（`src/app/pages/dependent-reviews/dependent-reviews.page.ts`）が実装されていること
   - セッション選択UI（セレクトボックス）
   - 選択したセッションに紐づく確認結果のみを表示
   - セッション作成ダイアログの呼び出し
   - セッション作成時に、基準年月日時点で抽出された被扶養者の確認結果を自動的にそのセッションに紐付ける

4. ✅ **セッション作成・編集ダイアログ**（`src/app/pages/dependent-reviews/session-form-dialog.component.ts`）が実装されていること
   - 基準年月日、実施日、担当者、備考の入力
   - フォーム値のみを返す（Firestoreへの保存はページ側で実行）

5. ✅ **ルーティング**が更新されていること（既存の`/dependent-reviews`ルートをそのまま使用）

6. ✅ **Firestoreセキュリティルール**が追加されていること
   - `offices/{officeId}/dependentReviewSessions/{sessionId}`のルール

7. ✅ **既存機能が壊れていないこと**（Phase3-5で実装した機能が正常に動作すること）

---

## 3. 変更対象ファイル

### 新規作成

- `src/app/services/dependent-review-sessions.service.ts`（新規作成）
- `src/app/pages/dependent-reviews/session-form-dialog.component.ts`（新規作成）

### 既存ファイルの修正

- `src/app/types.ts`（既存ファイルに`DependentReviewSession`型を追加。ファイル全体は上書きしない）
- `src/app/pages/dependent-reviews/dependent-reviews.page.ts`（セッション選択UIとセッションごとのフィルタリングを追加、`onQuickResultChange`で`sessionId`を扱う）
- `src/app/services/dependent-reviews.service.ts`（`list()`メソッドに`sessionId`フィルタを追加）
- `firestore.rules`（`dependentReviewSessions`コレクションのルールを追加）

---

## 4. 画面仕様

### 4.1 `/dependent-reviews`ページの拡張

#### セッション選択UI

ページ上部（基準年月日選択の上または下）に、セッション選択UIを追加します。

**UI要素**:

- **セレクトボックス**: セッション一覧から選択
  - 選択肢: 「すべての確認結果」（デフォルト）+ セッション一覧（実施日降順）
  - セッション表示形式: `{実施日} - {備考または基準年月日}`（例：「2025-12-01 - 2025年定期確認」）
  - 備考が空の場合は、基準年月日を表示します（例：「2025-12-01 - 2025年12月1日現在」）
- **「セッションを作成」ボタン**: セッション作成ダイアログを開く

**動作**:

- 「すべての確認結果」を選択した場合: Phase3-5の既存動作（全確認結果を表示）
- セッションを選択した場合: 選択したセッションに紐づく確認結果（`sessionId`が一致する`DependentReview`）のみを表示

#### 確認結果一覧のフィルタリング

「確認結果一覧」カードの表示内容を、選択したセッションに応じてフィルタリングします。

- セッション未選択（「すべての確認結果」）: 既存動作（全確認結果を表示）
- セッション選択済み: `DependentReviewsService.list(officeId, { sessionId: selectedSessionId })`を使用してフィルタリング

#### 抽出テーブルの動作

「基準年月日時点での被扶養者抽出」カードの動作は、Phase3-5の既存動作を維持します。

#### インライン操作でのセッション紐付け

セッションが選択されている状態で「確認区分」を新規登録した場合、その確認結果は自動的に選択中のセッションに紐づきます（`sessionId`を付与します）。

既に他のセッションに紐づいている確認結果の`sessionId`は、インライン操作では自動変更しません。セッションの付け替えは将来的に別UIで対応します。

---

### 4.2 セッション作成・編集ダイアログ

#### セッション作成ダイアログ（`SessionFormDialogComponent`）

**表示タイミング**: 「セッションを作成」ボタンをクリックしたとき

**フォーム項目**:

1. **基準年月日**（必須）
   - `<input type="date">`
   - 初期値: 現在の`referenceDate`（抽出テーブルで選択されている基準年月日）、または今日の日付
   - バリデーション: 必須

2. **実施日**（必須）
   - `<input type="date">`
   - 初期値: 今日の日付（`new Date().toISOString().substring(0, 10)`）
   - バリデーション: 必須

3. **担当者**（任意）
   - `<input matInput>`
   - 初期値: 空（ページ側で自動補完）
   - バリデーション: 任意

4. **備考**（任意）
   - `<textarea matInput rows="3" maxlength="500">`
   - 例: 「2025年定期確認」「健康保険組合提出用」など
   - バリデーション: 任意、最大500文字

**保存時の処理**:

`SessionFormDialogComponent`はフォーム入力専用コンポーネントとして実装し、Firestoreへの保存は行いません。`submit()`では、`this.form.getRawValue()`を`close()`で返すだけにします。

ページ側（`DependentReviewsPage`）では、ダイアログの`afterClosed()`でフォーム値を受け取り、`onCreateSession(formValue)`を呼んでセッション作成と自動紐付けを実行します。

#### セッション編集ダイアログ

**表示タイミング**: セッション一覧から編集ボタンをクリックしたとき（将来拡張）

**フォーム項目**: セッション作成ダイアログと同じ（既存値を初期値として設定）

**保存時の処理**:

`SessionFormDialogComponent`はフォーム値のみを返し、ページ側で`DependentReviewSessionsService.update()`を呼び出します。

**注意**: Phase3-5.5では、セッション編集機能は実装しなくても構いません。将来拡張として、セッション一覧に編集ボタンを追加する予定です。

---

### 4.3 セッション作成時の自動紐付け

セッション作成時に、基準年月日時点で抽出された被扶養者の確認結果を自動的にそのセッションに紐付ける処理を実装します。

**処理フロー**:

1. セッション作成後、作成されたセッションの`id`を取得
2. 基準年月日時点で抽出された被扶養者の一覧を取得（`extractDependents()`と同じロジック）
3. 各被扶養者について、基準年月日以前の最新の確認結果（`DependentReview`）を取得
   - **重要**: 画面上のフィルタやセッション選択状態に関わらず、該当事業所の全`DependentReview`を対象として「基準年月日以前の最新の確認結果」を検出します
4. 確認結果が存在し、かつ既に他のセッションに紐づいていない場合（`sessionId`が`null`または未設定の場合）、その確認結果の`sessionId`を更新（`DependentReviewsService.update()`）

**実装場所**: `DependentReviewsPage.onCreateSession()`内

**自動紐付けのポリシー**:

- 基準年月日以前の最新の`DependentReview`を対象とします
- 既に別セッションに紐づいているレビュー（`sessionId`が設定されている）は自動では付け替えません
- 確認結果が存在しない被扶養者については、自動的に確認結果を作成せず、ユーザーが手動で確認結果を登録する必要があります

---

## 5. 実装方針

### 5.1 型定義（`src/app/types.ts`）

`DependentReviewSession`型を追加します。

```typescript
export interface DependentReviewSession {
  id: string;
  officeId: string;
  referenceDate: string; // YYYY-MM-DD形式（基準年月日）
  checkedAt: string; // YYYY-MM-DD形式（実施日）
  checkedBy?: string; // 担当者名
  note?: string; // 備考（例：「2025年定期確認」）
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  createdByUserId: string; // 必須フィールド
  updatedByUserId: string; // 必須フィールド
}
```

---

### 5.2 セッション管理サービス（`src/app/services/dependent-review-sessions.service.ts`）

`DependentReviewSessionsService`を新規作成します。

**実装パターン**: `list()`は`collectionData`を使用したリアルタイム購読、`get()`は単発取得（`getDoc`）で実装します

**メソッド**:

- `create(officeId: string, session: { referenceDate: string; checkedAt: string; checkedBy?: string; note?: string; }, createdByUserId: string): Promise<string>`（作成されたセッションIDを返す）
- `list(officeId: string): Observable<DependentReviewSession[]>`（実施日降順でソート、リアルタイム購読）
- `get(officeId: string, sessionId: string): Promise<DependentReviewSession | null>`（単発取得）
- `update(officeId: string, sessionId: string, updates: Partial<DependentReviewSession>, updatedByUserId: string): Promise<void>`
- `delete(officeId: string, sessionId: string): Promise<void>`

**実装例**:

```typescript
import { Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  orderBy,
  query,
  setDoc,
  updateDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { DependentReviewSession } from '../types';

@Injectable({ providedIn: 'root' })
export class DependentReviewSessionsService {
  constructor(private readonly firestore: Firestore) {}

  private collectionPath(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'dependentReviewSessions');
  }

  async create(
    officeId: string,
    session: {
      referenceDate: string; // YYYY-MM-DD形式
      checkedAt: string; // YYYY-MM-DD形式
      checkedBy?: string;
      note?: string;
    },
    createdByUserId: string
  ): Promise<string> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref);
    const now = new Date().toISOString();

    const payload: DependentReviewSession = {
      id: docRef.id,
      officeId,
      referenceDate: session.referenceDate,
      checkedAt: session.checkedAt,
      checkedBy: session.checkedBy,
      note: session.note,
      createdAt: now,
      updatedAt: now,
      createdByUserId,
      updatedByUserId: createdByUserId
    };

    await setDoc(docRef, payload);
    return docRef.id;
  }

  list(officeId: string): Observable<DependentReviewSession[]> {
    const ref = this.collectionPath(officeId);
    const q = query(ref, orderBy('checkedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<DependentReviewSession[]>;
  }

  async get(officeId: string, sessionId: string): Promise<DependentReviewSession | null> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, sessionId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as DependentReviewSession;
  }

  async update(
    officeId: string,
    sessionId: string,
    updates: Partial<DependentReviewSession>,
    updatedByUserId: string
  ): Promise<void> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, sessionId);
    const now = new Date().toISOString();

    const payload: Partial<DependentReviewSession> = {
      ...updates,
      updatedAt: now,
      updatedByUserId
    };

    await updateDoc(docRef, payload);
  }

  async delete(officeId: string, sessionId: string): Promise<void> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, sessionId);
    await deleteDoc(docRef);
  }
}
```

---

### 5.3 DependentReviewsServiceの拡張

`DependentReviewsService.list()`メソッドに`sessionId`フィルタを追加します。

**変更内容**:

```typescript
list(
  officeId: string,
  filters?: {
    result?: DependentReviewResult;
    employeeId?: string;
    dependentId?: string;
    sessionId?: string; // ★追加
  }
): Observable<DependentReview[]>
```

**実装例**:

```typescript
list(
  officeId: string,
  filters?: {
    result?: DependentReviewResult;
    employeeId?: string;
    dependentId?: string;
    sessionId?: string;
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
  if (filters?.sessionId) {
    constraints.push(where('sessionId', '==', filters.sessionId));
  }

  constraints.push(orderBy('reviewDate', 'desc'));

  const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref, orderBy('reviewDate', 'desc'));

  return collectionData(q, { idField: 'id' }) as Observable<DependentReview[]>;
}
```

---

### 5.4 DependentReviewsPageの拡張

`DependentReviewsPage`にセッション選択UIとセッションごとのフィルタリングを追加します。

**追加するプロパティ**:

```typescript
private readonly sessionsService = inject(DependentReviewSessionsService);

readonly sessions$ = this.currentOffice.officeId$.pipe(
  switchMap((officeId) => {
    if (!officeId) return of([]);
    return this.sessionsService.list(officeId);
  })
);

readonly selectedSessionId$ = new BehaviorSubject<string | null>(null);
```

**テンプレートの変更**:

1. セッション選択UIを追加（基準年月日選択の上または下）
2. `reviews$`の定義を変更し、`selectedSessionId$`に応じてフィルタリング

**実装例**:

```typescript
readonly reviews$ = combineLatest([
  this.currentOffice.officeId$,
  this.resultFilter$,
  this.selectedSessionId$
]).pipe(
  switchMap(([officeId, resultFilter, sessionId]) => {
    if (!officeId) return of([]);
    const filters: {
      result?: DependentReviewResult;
      sessionId?: string;
    } = {};
    if (resultFilter !== 'all') {
      filters.result = resultFilter;
    }
    if (sessionId) {
      filters.sessionId = sessionId;
    }
    return this.reviewsService.list(officeId, filters);
  })
);
```

**セッション作成ダイアログの呼び出し**:

```typescript
openCreateSessionDialog(): void {
  this.dialog
    .open(SessionFormDialogComponent, {
      width: '600px',
      data: {
        referenceDate: this.referenceDate
      }
    })
    .afterClosed()
    .subscribe((formValue) => {
      if (!formValue) return;
      this.onCreateSession(formValue);
    });
}
```

**セッション作成時の自動紐付け処理**:

セッション作成後、基準年月日時点で抽出された被扶養者の確認結果を自動的にそのセッションに紐付ける処理を実装します。

```typescript
async onCreateSession(sessionData: {
  referenceDate: string;
  checkedAt: string;
  checkedBy?: string;
  note?: string;
}): Promise<void> {
  const officeId = await firstValueFrom(this.currentOffice.officeId$);
  if (!officeId) return;

  const currentUserProfile = await firstValueFrom(this.currentUser.profile$);
  const currentUserId = currentUserProfile?.id;
  if (!currentUserId) {
    throw new Error('ユーザーIDが取得できませんでした');
  }

  // 1. セッションを作成
  const sessionId = await this.sessionsService.create(
    officeId,
    {
      referenceDate: sessionData.referenceDate,
      checkedAt: sessionData.checkedAt,
      checkedBy: sessionData.checkedBy || currentUserProfile?.displayName || '',
      note: sessionData.note
    },
    currentUserId
  );

  // 2. 基準年月日時点での「扶養に入っている被扶養者」と、
  //    すべての DependentReview を元に latestReview を決定する
  //    （画面上のフィルタやセッション選択状態に関わらず、全件を対象とする）
  const [employees, dependentsMap, allReviews] = await firstValueFrom(
    combineLatest([
      this.employees$,
      this.dependentsMap$,
      this.reviewsService.list(officeId) // ★ フィルタ無しで全件取得
    ]).pipe(take(1))
  );

  const referenceDate = sessionData.referenceDate;
  const extractedDependents: DependentWithReview[] = [];

  for (const employee of employees) {
    const employeeDependents = dependentsMap.get(employee.id);
    if (!employeeDependents) continue;

    for (const dependent of employeeDependents.values()) {
      const acquiredDate = dependent.qualificationAcquiredDate;
      const lossDate = dependent.qualificationLossDate;
      if (!acquiredDate) continue;
      if (acquiredDate > referenceDate) continue;
      if (lossDate && lossDate <= referenceDate) continue;

      // reviewDate <= referenceDate の中から最新を選ぶ
      const reviewsForDependent = allReviews.filter(
        (r) =>
          r.employeeId === employee.id &&
          r.dependentId === dependent.id &&
          (!referenceDate || r.reviewDate <= referenceDate)
      );
      const latestReview = reviewsForDependent.length > 0 ? reviewsForDependent[0] : undefined;

      extractedDependents.push({
        ...dependent,
        employeeId: employee.id,
        employeeName: employee.name,
        latestReview
      });
    }
  }

  // 3. 既に他のセッションに紐づいていない latestReview に対してのみ sessionId を付与する
  for (const dependent of extractedDependents) {
    if (dependent.latestReview && !dependent.latestReview.sessionId) {
      await this.reviewsService.update(
        officeId,
        dependent.latestReview.id,
        { sessionId },
        currentUserId
      );
    }
  }

  // 4. 作成したセッションを選択状態にする
  this.selectedSessionId$.next(sessionId);
}
```

**インライン操作でのセッション紐付け**:

`onQuickResultChange`メソッドを修正し、セッション選択中に新規レビューを作成した場合は`sessionId`を付与します。

```typescript
async onQuickResultChange(row: DependentWithReview, newResult: DependentReviewResult): Promise<void> {
  if (row.latestReview?.result === newResult) return;

  const officeId = await firstValueFrom(this.currentOffice.officeId$);
  if (!officeId) return;

  const currentUserProfile = await firstValueFrom(this.currentUser.profile$);
  const currentUserId = currentUserProfile?.id;
  if (!currentUserId) {
    throw new Error('ユーザーIDが取得できませんでした');
  }

  const reviewDate = this.referenceDate || new Date().toISOString().substring(0, 10);
  const reviewedBy = currentUserProfile?.displayName || '';
  const selectedSessionId = await firstValueFrom(this.selectedSessionId$);

  if (row.latestReview) {
    // 既存レコードの result のみを更新。sessionId は自動では変更しない。
    await this.reviewsService.update(
      officeId,
      row.latestReview.id,
      { result: newResult },
      currentUserId
    );
  } else {
    // 新しく作成する場合、セッションが選択されていればその sessionId を付与する
    await this.reviewsService.create(
      officeId,
      {
        employeeId: row.employeeId,
        dependentId: row.id,
        reviewDate,
        result: newResult,
        reviewedBy,
        ...(selectedSessionId ? { sessionId: selectedSessionId } : {})
      },
      currentUserId
    );
  }

  // 保存後に再抽出して、抽出テーブル側の latestReview も最新状態に更新する
  this.extractDependents();
}
```

---

### 5.5 セッション作成・編集ダイアログ（`src/app/pages/dependent-reviews/session-form-dialog.component.ts`）

`SessionFormDialogComponent`を新規作成します。

**実装パターン**: フォーム入力専用コンポーネントとして実装し、Firestoreへの保存は行いません。`DependentReviewSessionsService`や`CurrentUserService`には依存しません。

**インターフェース定義**:

```typescript
export interface SessionFormDialogData {
  referenceDate?: string;
  session?: DependentReviewSession;
}
```

**実装例**:

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DependentReviewSession } from '../../types';

export interface SessionFormDialogData {
  referenceDate?: string;
  session?: DependentReviewSession;
}

@Component({
  selector: 'ip-session-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon>{{ data.session ? 'edit_calendar' : 'event_note' }}</mat-icon>
      {{ data.session ? '扶養状況確認セッションを編集' : '扶養状況確認セッションを作成' }}
    </h1>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <div mat-dialog-content class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>基準年月日</mat-label>
          <input matInput type="date" formControlName="referenceDate" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>実施日</mat-label>
          <input matInput type="date" formControlName="checkedAt" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>担当者</mat-label>
          <input matInput formControlName="checkedBy" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>備考</mat-label>
          <textarea matInput formControlName="note" rows="3" maxlength="500"></textarea>
        </mat-form-field>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>キャンセル</button>
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
export class SessionFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<SessionFormDialogComponent>);

  readonly data = inject<SessionFormDialogData>(MAT_DIALOG_DATA);

  private readonly today = new Date().toISOString().substring(0, 10);

  form = this.fb.group({
    referenceDate: [
      this.data.session?.referenceDate || this.data.referenceDate || this.today,
      Validators.required
    ],
    checkedAt: [
      this.data.session?.checkedAt || this.today,
      Validators.required
    ],
    checkedBy: [this.data.session?.checkedBy || ''],
    note: [this.data.session?.note || '']
  });

  submit(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.getRawValue());
  }
}
```

---

## 6. Firestoreセキュリティルール

`firestore.rules`に`dependentReviewSessions`コレクションのルールを追加します。

**追加場所**: `match /offices/{officeId}`ブロック内、`dependentReviews`の後に追加

**ルール内容**:

```javascript
// 扶養状況確認セッション
match /dependentReviewSessions/{sessionId} {
  // 共通バリデーション: DependentReviewSession の基本フィールド
  function isValidDependentReviewSessionBase(data) {
    return data.id == sessionId
      && data.officeId == officeId
      && data.referenceDate is string
      && data.checkedAt is string
      && data.createdAt is string
      && data.updatedAt is string
      && data.createdByUserId is string
      && data.updatedByUserId is string;
  }

  // 閲覧: admin/hr は全件、employee は現時点では閲覧不可（将来拡張用プレースホルダー）
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    (isInsureEmployee(officeId) && false)
  );

  // 作成: admin/hr のみ、フィールドと officeId / userId を厳密チェック
  allow create: if belongsToOffice(officeId)
    && isAdminOrHr(officeId)
    && request.resource.data.keys().hasOnly([
      'id', 'officeId', 'referenceDate', 'checkedAt',
      'checkedBy', 'note', 'createdAt', 'updatedAt',
      'createdByUserId', 'updatedByUserId'
    ])
    && isValidDependentReviewSessionBase(request.resource.data)
    && request.resource.data.createdByUserId == request.auth.uid
    && request.resource.data.updatedByUserId == request.auth.uid;

  // 更新: admin/hr のみ、変更可能なフィールドを限定
  allow update: if belongsToOffice(officeId)
    && isAdminOrHr(officeId)
    && isValidDependentReviewSessionBase(request.resource.data)
    // id / officeId / createdAt / createdByUserId は更新不可
    && request.resource.data.id == resource.data.id
    && request.resource.data.officeId == resource.data.officeId
    && request.resource.data.createdAt == resource.data.createdAt
    && request.resource.data.createdByUserId == resource.data.createdByUserId
    // 変更されうるキーを限定
    && request.resource.data.diff(resource.data).changedKeys().hasOnly([
      'referenceDate', 'checkedAt', 'checkedBy', 'note',
      'updatedAt', 'updatedByUserId'
    ])
    && request.resource.data.updatedByUserId == request.auth.uid;

  // 削除: admin/hr のみ
  allow delete: if belongsToOffice(officeId) && isAdminOrHr(officeId);
}
```

---

## 7. テスト観点

### 7.1 機能テスト

1. **セッションの作成**
   - 「セッションを作成」ボタンからセッション作成ダイアログを開く
   - 必須項目（基準年月日、実施日）を入力して保存
   - Firestoreに正しく保存されること
   - セッション作成時に、基準年月日時点で抽出された被扶養者の確認結果が自動的にそのセッションに紐付けられること
   - 既に他のセッションに紐づいている確認結果は自動では付け替えられないこと

2. **セッション一覧の表示**
   - セッション選択UIに、実施日降順でセッション一覧が表示されること
   - 「すべての確認結果」オプションがデフォルトで選択されていること

3. **セッションごとの確認結果フィルタリング**
   - セッションを選択したとき、選択したセッションに紐づく確認結果のみが表示されること
   - 「すべての確認結果」を選択したとき、全確認結果が表示されること

4. **インライン操作でのセッション紐付け**
   - セッションが選択されている状態で「確認区分」を新規登録した場合、その確認結果が自動的に選択中のセッションに紐づくこと
   - 既に他のセッションに紐づいている確認結果の`sessionId`は、インライン操作では自動変更されないこと

5. **セッションの更新・削除**
   - セッション編集ダイアログからセッションを更新できること（将来拡張）
   - セッション削除ボタンからセッションを削除できること（将来拡張）
   - **注意**: Phase3-5.5ではセッション削除UIは実装しません。サービスとFirestoreルールには`delete()`メソッドが用意されていますが、UI上の削除ボタンは将来拡張として後送りします（削除時に`DependentReview.sessionId`に孤立した値が残る可能性があるため）

### 7.2 権限テスト

1. **admin/hrロール**
   - セッションの作成・閲覧・更新・削除ができること
   - セッションごとの確認結果を閲覧できること

2. **employeeロール**
   - セッションにアクセスできないこと（既存ガードの挙動が変わっていないこと）

### 7.3 データ整合性テスト

1. **セッション作成時の自動紐付け**
   - 基準年月日時点で抽出された被扶養者の確認結果が、セッション作成時に自動的にそのセッションに紐付けられること
   - 確認結果が存在しない被扶養者については、自動的に確認結果が作成されないこと
   - 既に他のセッションに紐づいている確認結果は自動では付け替えられないこと
   - 画面上のフィルタやセッション選択状態に関わらず、該当事業所の全`DependentReview`を対象として「基準年月日以前の最新の確認結果」が検出されること

2. **セッション削除時の動作**
   - Phase3-5.5ではセッション削除UIは実装しません。サービスとFirestoreルールには`delete()`メソッドが用意されていますが、UI上の削除ボタンは将来拡張として後送りします
   - 将来拡張として実装する場合は、セッションを削除したとき、そのセッションに紐づく確認結果の`sessionId`を`null`に更新する処理、またはセッション削除時にエラーを表示して削除を防ぐ処理を実装する必要があります

---

## 8. 完了条件

Phase3-5.5完了の判定基準：

1. ✅ **型定義**（`src/app/types.ts`）が追加されていること
   - `DependentReviewSession`型の定義（`createdByUserId`と`updatedByUserId`は必須フィールド）

2. ✅ **セッション管理サービス**（`src/app/services/dependent-review-sessions.service.ts`）が存在し、CRUD操作が実装されていること
   - セッションの作成（`create()`）- 戻り値は`Promise<string>`（作成されたセッションID）
   - セッションの一覧取得（`list()`）- リアルタイム購読に対応
   - セッションの取得（`get()`）- 単発取得（`Promise<DependentReviewSession | null>`）
   - セッションの更新（`update()`）
   - セッションの削除（`delete()`）

3. ✅ **セッション管理画面の拡張**（`src/app/pages/dependent-reviews/dependent-reviews.page.ts`）が実装されていること
   - セッション選択UI（セレクトボックス）
   - 選択したセッションに紐づく確認結果のみを表示
   - セッション作成ダイアログの呼び出し
   - セッション作成時に、基準年月日時点で抽出された被扶養者の確認結果を自動的にそのセッションに紐付ける
   - インライン操作でセッション選択中に新規レビューを作成した場合、`sessionId`を付与する

4. ✅ **セッション作成・編集ダイアログ**（`src/app/pages/dependent-reviews/session-form-dialog.component.ts`）が実装されていること
   - 基準年月日、実施日、担当者、備考の入力
   - フォーム値のみを返す（Firestoreへの保存はページ側で実行）

5. ✅ **DependentReviewsServiceの拡張**が実装されていること
   - `list()`メソッドに`sessionId`フィルタが追加されていること

6. ✅ **ルーティング**が更新されていること（既存の`/dependent-reviews`ルートをそのまま使用）

7. ✅ **Firestoreセキュリティルール**が追加されていること
   - `offices/{officeId}/dependentReviewSessions/{sessionId}`のルール
   - `createdByUserId`と`updatedByUserId`が必須フィールドとしてチェックされること

8. ✅ **既存機能が壊れていないこと**（Phase3-5で実装した機能が正常に動作すること）

---

## 9. 実装時の注意事項

1. **セッション作成時の自動紐付け**
   - セッション作成時の自動紐付けでは、画面上のフィルタやセッション選択状態に関わらず、該当事業所の全`DependentReview`を対象として「基準年月日以前の最新の確認結果」を検出します
   - 既に`sessionId`を持っている`DependentReview`は、自動では付け替えず、そのままにします（手動編集のみ許可）
   - 確認結果が存在しない被扶養者については、自動的に確認結果を作成せず、ユーザーが手動で確認結果を登録する必要があります

2. **インライン操作でのセッション紐付け**
   - セッションが選択されている状態で「確認区分」を新規登録した場合は、その確認結果は自動的に選択中のセッションに紐づきます（`sessionId`を付与します）
   - 既に他のセッションに紐づいている確認結果の`sessionId`は、インライン操作では自動変更しません。セッションの付け替えは将来的に別UIで対応します

3. **セッション選択UIの配置**
   - セッション選択UIは、基準年月日選択の上または下に配置してください
   - UIの見た目は、既存の「確認結果」フィルタと統一感を持たせてください

4. **セッション表示形式**
   - セッション選択UIの表示形式は、`{実施日} - {備考または基準年月日}`とします
   - 備考が空の場合は、基準年月日を表示します（例：「2025-12-01 - 2025年12月1日現在」）

5. **既存機能との整合性**
   - Phase3-5で実装した機能（基準年月日時点での被扶養者抽出、確認結果の登録・編集・削除など）が正常に動作することを確認してください
   - セッション未選択時（「すべての確認結果」選択時）は、Phase3-5の既存動作を維持してください

6. **Firestoreルールの厳密性**
   - `dependentReviewSessions`コレクションのルールは、`dependentReviews`コレクションのルールと同じパターンで実装してください
   - `createdByUserId`と`updatedByUserId`は必須フィールドとして扱い、ルール側でも整合性をチェックしてください

7. **パフォーマンス**
   - セッション一覧の取得は、リアルタイム購読を使用しますが、大量のセッションが存在する場合は、ページネーションを検討してください（Phase3-5.5では実装不要）

8. **SessionFormDialogComponentの責務**
   - `SessionFormDialogComponent`はフォーム入力専用コンポーネントとして実装し、Firestoreへの保存は行いません
   - `DependentReviewSessionsService`や`CurrentUserService`には依存せず、`submit()`では`this.form.getRawValue()`を`close()`で返すだけにします
   - セッション作成・更新の処理は、ページ側（`DependentReviewsPage`）で実装します
   - **注意**: このコンポーネントでは`AsyncPipe`や`NgIf`は使用しないため、`imports`配列に含めないでください

9. **セッション削除UIの扱い**
   - Phase3-5.5ではセッション削除UIは実装しません。`DependentReviewSessionsService.delete()`メソッドとFirestoreルールには削除機能が用意されていますが、UI上の削除ボタンは将来拡張として後送りします
   - 理由: セッションを削除した場合、そのセッションに紐づく`DependentReview`の`sessionId`に孤立した値が残る可能性があるため、削除時の整合性処理（`sessionId`を`null`に更新する、または削除を防ぐ）を先に実装する必要があります

---

以上が Phase3-5.5 実装指示書です。実装時は、既存のコードパターン（Phase3-5など）を参考にしながら、一貫性のある実装を心がけてください。
