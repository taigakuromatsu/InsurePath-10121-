# Phase2-4 実装指示書: 扶養家族管理の導線改善（従業員一覧 → 詳細ダイアログ）

## 📋 概要

Phase2-3で扶養家族（被扶養者）管理機能が実装され、従業員詳細ダイアログ内に扶養家族セクションが追加されました。しかし、現状では「従業員一覧 → 従業員詳細ダイアログ → 下のほうまでスクロール → 扶養家族セクション」という導線しかなく、ユーザーにとって分かりづらい状態です。

**目的**: 
- 「扶養家族をどこから管理すればいいか」が、admin / hr ユーザーにとって直感的に分かるようにする
- 従業員一覧画面から、扶養家族セクションにワンクリックでアクセスできる導線を用意する
- 既存の実装（Phase2-3）を壊さずに、UI/UX面の改善だけで完結させる

**このフェーズで達成したいゴール**:
- 従業員一覧ページから、明示的な「扶養家族」ボタン/アイコンで扶養家族を管理できる
- ボタンを押したら、従業員詳細ダイアログが開き、扶養家族セクションに自動スクロールする
- 従業員詳細ダイアログの中でも、セクションをジャンプしやすくする簡易ナビ（タブ風ボタン等）が用意されている
- 既存のMy Page（従業員本人用）の扶養家族表示（閲覧のみ）との役割分担が明確な状態を文書化する

**前提条件**:
- Phase2-3（扶養家族管理機能）が実装済み
- `EmployeeDetailDialogComponent`に扶養家族セクションが実装済み（`id="dependents"`）
- `DependentsService`が実装済み
- `employees.page.ts`で従業員一覧が表示されている

---

## 🧭 スコープ

### 対象とする機能・ファイル

#### UI（admin / hr 向け）
- `src/app/pages/employees/employees.page.ts` - 従業員一覧テーブルに「扶養家族」列/アクションボタンの追加
- `src/app/pages/employees/employee-detail-dialog.component.ts` - セクションナビの追加、フォーカス機能の実装

#### 型定義
- `src/app/pages/employees/employee-detail-dialog.component.ts` - `EmployeeDetailDialogData`インターフェースの拡張（`focusSection`プロパティ追加）

### 対象外とするもの

以下の機能はPhase2-4では対象外とします：
- 扶養家族専用の新しいページ（`/dependents`など）を作ること
- 扶養家族の年次見直し・資格判定ロジック・集計機能
- 扶養家族件数のサーバサイド集計（必要なら簡易なクライアント計算レベルに留める）
- My Page（`my-page.ts`）の変更（Phase2-3時点で十分な導線があるため、Phase2-4では変更なし）
- Firestoreルールの変更（Phase2-3で実装済みのルール前提）

---

## 📝 現状の挙動と課題

### 1. 従業員一覧からの導線

**現状の挙動**:
- `employees.page.ts`で従業員一覧テーブルが表示される
- 各行に「詳細」「編集」「削除」ボタンがある
- 「詳細」ボタンを押すと`EmployeeDetailDialogComponent`が開く
- ダイアログ内には複数のセクション（基本情報、就労条件、社会保険情報、資格情報、就業状態、扶養家族、システム情報）が縦に並んでいる
- 扶養家族セクションは最下部に近い位置にあり、開いた直後は見えない

**課題**:
- 扶養家族を管理したい場合、詳細ダイアログを開いてから下までスクロールする必要がある
- 従業員一覧から「扶養家族を管理する」という意図が明確に伝わらない
- admin / hr ユーザーが「どこから扶養家族を管理すればいいか」が直感的でない

### 2. 従業員詳細ダイアログ内のナビゲーション

**現状の挙動**:
- `EmployeeDetailDialogComponent`には複数のセクションが縦に並んでいる
- 各セクションには`id`属性が付いていない（扶養家族セクションのみ`id="dependents"`が付いている）
- セクション間を移動するには、手動でスクロールする必要がある

**課題**:
- 特定のセクション（例：扶養家族）に直接ジャンプする手段がない
- セクションが多く、目的の情報を見つけるのに時間がかかる
- ダイアログを開いたときに特定のセクションにフォーカスする機能がない

### 3. My Pageとの役割分担

**現状の挙動**:
- `my-page.ts`には従業員本人向けの「扶養家族（閲覧のみ）」セクションがある
- admin / hr は従業員一覧から詳細ダイアログを開いて扶養家族を管理する

**課題**:
- 役割分担は明確だが、導線が分かりづらい

---

## 📝 仕様（Before / After）

### 1. 従業員一覧からの導線強化

#### Before（現状）
- 従業員一覧テーブルに「扶養家族」関連のアクションがない
- 詳細ボタンを押して、手動でスクロールして扶養家族セクションを見る

#### After（Phase2-4実装後）
- 従業員一覧テーブルに「扶養家族」列を追加
- 各行に「扶養家族を管理」ボタン（またはアイコンボタン）を表示
  - アイコン: `family_restroom`（Material Icons）
  - ラベル: 「管理」または「扶養家族」
  - オプション: 簡易な件数表示（例：「家族 2人」）
- ボタンをクリックすると、`EmployeeDetailDialogComponent`が開き、`focusSection: 'dependents'`を渡す
- ダイアログが開いた直後に、扶養家族セクション（`id="dependents"`）に自動スクロールする

### 2. 従業員詳細ダイアログ内のセクションナビ

#### Before（現状）
- セクション間を移動するには手動でスクロールする必要がある
- 特定のセクションに直接ジャンプする手段がない

#### After（Phase2-4実装後）
- ダイアログのコンテンツ上部に、簡易的なセクションナビ（タブ風のボタン行）を追加
- セクション一覧:
  - 「基本情報」
  - 「就労条件」
  - 「社会保険」
  - 「健保資格」
  - 「厚年資格」
  - 「就業状態」
  - 「扶養家族」
  - 「システム」
- 各ボタンをクリックすると、対応するセクションの先頭までスクロールする
- 現在表示されているセクションに対応するボタンがハイライトされる（オプション）
- 各セクションに`id`属性を付与（例：`id="basic"`, `id="work"`, `id="insurance"`, `id="health-qualification"`, `id="pension-qualification"`, `id="working-status"`, `id="dependents"`, `id="system"`）

### 3. 「扶養家族セクションへフォーカス」パラメータ

#### Before（現状）
```typescript
export interface EmployeeDetailDialogData {
  employee: Employee;
}
```

#### After（Phase2-4実装後）
```typescript
export type DialogFocusSection = 
  | 'basic' 
  | 'work' 
  | 'insurance' 
  | 'health-qualification' 
  | 'pension-qualification' 
  | 'working-status' 
  | 'dependents' 
  | 'system';

export interface EmployeeDetailDialogData {
  employee: Employee;
  focusSection?: DialogFocusSection; // オプショナル
}
```

- 従業員一覧からの「扶養家族を管理」ボタンでダイアログを開くときは、`focusSection: 'dependents'`を渡す
- 通常の「詳細」ボタンから開くときは、`focusSection`を渡さない（または`undefined`）
- `EmployeeDetailDialogComponent`側では、`ngAfterViewInit`または`AfterViewInit`で`data.focusSection`を確認し、該当セクションにスクロールする

### 4. 権限制御の前提

- 従業員一覧は admin / hr のみが使う前提でよい（employee ロールは一覧を見ない）
- My Page の「扶養家族（閲覧のみ）」セクションは従業員本人向け導線としてそのまま維持
- 今回の導線改善では Firestore ルールは変更しない（Phase2-3 で実装済みのルール前提）

### 5. パフォーマンス・実装コストに関する方針

- 扶養家族の件数表示は「できれば」でよい。実装コストが大きい場合は、「管理」ボタンのみのシンプルな仕様にして構わない
- 件数を出す場合も、MVP では各行ごとに`DependentsService.list(officeId, employeeId)`を購読する簡易実装で OK（想定利用規模が小さいため）
- 将来必要になれば、サマリフィールドや集計コレクションへの拡張を「今後の拡張」に記載

---

## 🗂️ データモデル設計

Phase2-4では、データモデル（Firestore構造）の変更はありません。Phase2-3で定義された以下の構造をそのまま使用します：

```
offices/{officeId}/employees/{employeeId}/dependents/{dependentId}
```

型定義については、`EmployeeDetailDialogData`インターフェースに`focusSection`プロパティを追加するのみです。

---

## 🎨 UI/UX設計

### 1. 従業員一覧テーブルへの「扶養家族」列追加

#### デザイン案A: アイコンボタン + 件数表示（推奨）
```
[氏名] [所属] [住所] ... [扶養家族] [操作]
山田太郎  営業部  ...  👨‍👩‍👧 2人  [詳細][編集][削除]
```

- 「扶養家族」列に、`family_restroom`アイコンと件数を表示
- クリック可能なボタンとして実装
- 件数が0の場合は「-」または「0人」と表示

#### デザイン案B: テキストボタン
```
[氏名] [所属] [住所] ... [扶養家族] [操作]
山田太郎  営業部  ...  [扶養家族を管理]  [詳細][編集][削除]
```

- 「扶養家族を管理」というテキストボタンを表示
- シンプルだが、テーブル幅を取る

**推奨**: デザイン案A（アイコンボタン + 件数表示）を採用。ただし、件数表示の実装コストが高い場合は、アイコンボタンのみでも可。

### 2. 従業員詳細ダイアログ内のセクションナビ

#### デザイン案
```
┌─────────────────────────────────────────┐
│ 従業員詳細                    [×]       │
├─────────────────────────────────────────┤
│ [基本情報] [就労条件] [社会保険] ...    │ ← セクションナビ（固定）
│                                         │
│ ┌─ 基本情報 ─────────────────────┐    │
│ │ 氏名: 山田太郎                  │    │
│ │ ...                            │    │
│ └─────────────────────────────────┘    │
│                                         │
│ ┌─ 就労条件 ─────────────────────┐    │
│ │ ...                            │    │
│ └─────────────────────────────────┘    │
│                                         │
│ ...                                     │
└─────────────────────────────────────────┘
```

- セクションナビは、ダイアログのコンテンツ上部に固定表示
- 各ボタンはクリック可能で、対応するセクションにスクロール
- 現在表示されているセクションに対応するボタンは、背景色や下線でハイライト（オプション）
- スクロール可能なコンテンツエリア内に配置

#### スタイル案
- セクションナビは横スクロール可能なボタン行として実装
- ボタンは`mat-stroked-button`または`mat-button`を使用
- アクティブなボタンは`color="primary"`でハイライト
- モバイル対応: 横スクロール可能にする

---

## 🔧 サービス層・ルーティング設計

Phase2-4では、新しいサービスやルーティングの追加はありません。既存の`DependentsService`と`EmployeesService`をそのまま使用します。

### 変更点
- `employees.page.ts`の`openDetail()`メソッドを拡張し、`focusSection`パラメータを受け取れるようにする
- または、新しいメソッド`openDetailWithFocus(employee: Employee, focusSection: DialogFocusSection)`を追加する

---

## 🔒 セキュリティ・Firestoreルール

Phase2-4では、Firestoreルールの変更はありません。Phase2-3で実装済みの以下のルールをそのまま使用します：

```javascript
match /offices/{officeId}/employees/{employeeId}/dependents/{dependentId} {
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    isOwnEmployee(officeId, employeeId)
  );
  allow create, update, delete: if belongsToOffice(officeId) && isAdminOrHr(officeId);
}
```

---

## 🛠️ 実装方針・変更ポイント（ファイルごと）

### Step 1: `src/app/pages/employees/employee-detail-dialog.component.ts`

#### 変更内容
1. **型定義の追加**
   - `DialogFocusSection`型を定義
   - `EmployeeDetailDialogData`インターフェースに`focusSection?: DialogFocusSection`を追加

2. **セクションナビの追加**
   - テンプレート上部（`<div mat-dialog-content>`の直下）にセクションナビを追加
   - 各セクションに`id`属性を付与（例：`id="basic"`, `id="work"`, `id="insurance"`, `id="health-qualification"`, `id="pension-qualification"`, `id="working-status"`, `id="dependents"`, `id="system"`）
   - セクションナビの各ボタンにクリックハンドラを追加

3. **スクロール機能の実装**
   - `@ViewChild`または`ElementRef`を使って各セクションの要素を取得
   - `scrollToSection(sectionId: string)`メソッドを実装
   - `scrollIntoView({ behavior: 'smooth', block: 'start' })`を使用してスクロール

4. **初期フォーカス処理**
   - `ngAfterViewInit`で`data.focusSection`を確認
   - 値が設定されている場合は、該当セクションにスクロール
   - `setTimeout`を使って、ダイアログのレンダリング完了を待つ

5. **アクティブセクションのハイライト（オプション）**
   - `IntersectionObserver`を使って、現在表示されているセクションを検知
   - アクティブなセクションに対応するボタンをハイライト

#### 実装のポイント
- セクションナビは`position: sticky`または`position: fixed`で固定表示することを検討
- スクロール処理は`behavior: 'smooth'`でスムーズなアニメーションを実現
- `focusSection`が`undefined`の場合は、通常通り上部から表示

#### 擬似コード例
```typescript
export type DialogFocusSection = 
  | 'basic' 
  | 'work' 
  | 'insurance' 
  | 'health-qualification' 
  | 'pension-qualification' 
  | 'working-status' 
  | 'dependents' 
  | 'system';

export interface EmployeeDetailDialogData {
  employee: Employee;
  focusSection?: DialogFocusSection;
}

@Component({...})
export class EmployeeDetailDialogComponent implements AfterViewInit {
  @ViewChild('contentContainer', { read: ElementRef }) contentContainer?: ElementRef;
  
  readonly sections: Array<{ id: DialogFocusSection; label: string; icon: string }> = [
    { id: 'basic', label: '基本情報', icon: 'person' },
    { id: 'work', label: '就労条件', icon: 'work' },
    { id: 'insurance', label: '社会保険', icon: 'account_balance' },
    { id: 'health-qualification', label: '健保資格', icon: 'local_hospital' },
    { id: 'pension-qualification', label: '厚年資格', icon: 'account_balance' },
    { id: 'working-status', label: '就業状態', icon: 'event' },
    { id: 'dependents', label: '扶養家族', icon: 'family_restroom' },
    { id: 'system', label: 'システム', icon: 'info' }
  ];

  ngAfterViewInit(): void {
    if (this.data.focusSection) {
      setTimeout(() => {
        this.scrollToSection(this.data.focusSection!);
      }, 100);
    }
  }

  scrollToSection(sectionId: DialogFocusSection): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
```

### Step 2: `src/app/pages/employees/employees.page.ts`

#### 変更内容
1. **テーブル列の追加**
   - `displayedColumns`配列に`'dependents'`を追加
   - テンプレートに`matColumnDef="dependents"`の列定義を追加

2. **扶養家族アクションボタンの実装**
   - 各行に「扶養家族を管理」ボタンまたはアイコンボタンを表示
   - オプション: 件数表示（`DependentsService.list()`を購読して件数を表示）

3. **ダイアログを開くメソッドの追加/拡張**
   - `openDetailWithFocus(employee: Employee, focusSection: DialogFocusSection)`メソッドを追加
   - または、既存の`openDetail()`メソッドを拡張して`focusSection`パラメータを受け取れるようにする

#### 実装のポイント
- 件数表示は`async`パイプと`combineLatest`を使って実装
- 件数が0の場合の表示を考慮（「-」または「0人」）
- ボタンのスタイルは既存の「詳細」「編集」「削除」ボタンと統一感を保つ

#### 擬似コード例
```typescript
// テンプレート側
<ng-container matColumnDef="dependents">
  <th mat-header-cell *matHeaderCellDef>扶養家族</th>
  <td mat-cell *matCellDef="let row">
    <button 
      mat-stroked-button 
      color="primary" 
      (click)="openDetailWithFocus(row, 'dependents')"
      [title]="getDependentsCountLabel(row) | async"
    >
      <mat-icon>family_restroom</mat-icon>
      <span *ngIf="getDependentsCount(row) | async as count">
        {{ count > 0 ? count + '人' : '-' }}
      </span>
    </button>
  </td>
</ng-container>

// コンポーネント側
openDetailWithFocus(employee: Employee, focusSection: DialogFocusSection): void {
  this.dialog.open(EmployeeDetailDialogComponent, {
    width: '720px',
    data: { 
      employee,
      focusSection 
    }
  });
}

getDependentsCount(employee: Employee): Observable<number> {
  return this.dependentsService.list(employee.officeId, employee.id).pipe(
    map(dependents => dependents.length)
  );
}
```

#### 件数表示の実装コストが高い場合の代替案
- 件数表示を省略し、アイコンボタンのみを表示
- ボタンのラベルを「扶養家族を管理」とする

### Step 3: スタイル調整

#### `employee-detail-dialog.component.ts`のスタイル
- セクションナビのスタイルを追加
- 横スクロール可能なボタン行として実装
- アクティブなボタンのハイライトスタイル

#### `employees.page.ts`のスタイル
- 「扶養家族」列のスタイル調整（必要に応じて）

---

## ✅ 受け入れ条件（テスト観点）

### 1. 従業員一覧からの導線

**テストケース1: admin / hr ロールで従業員一覧を開いたとき**
- 前提: admin または hr ロールでログインしている
- 手順: `/employees`ページにアクセス
- 期待結果:
  - 従業員一覧テーブルに「扶養家族」列が表示される
  - 各行に「扶養家族を管理」ボタン（またはアイコンボタン）が表示される
  - オプション: 件数が表示される（実装した場合）

**テストケース2: 「扶養家族を管理」ボタンをクリックしたとき**
- 前提: admin / hr ロールでログインしている
- 手順: 従業員一覧で任意の従業員の「扶養家族を管理」ボタンをクリック
- 期待結果:
  - `EmployeeDetailDialogComponent`が開く
  - ダイアログが開いた直後に、扶養家族セクション（`id="dependents"`）が表示領域に入る
  - セクションナビの「扶養家族」ボタンがハイライトされる（実装した場合）

### 2. 従業員詳細ダイアログのセクションナビ

**テストケース3: セクションナビの各ボタンをクリックしたとき**
- 前提: `EmployeeDetailDialogComponent`が開いている
- 手順: セクションナビの各ボタン（「基本情報」「就労条件」「社会保険」など）をクリック
- 期待結果:
  - 対応するセクションの先頭までスムーズにスクロールする
  - クリックしたボタンがハイライトされる（実装した場合）

**テストケース4: 通常の「詳細」ボタンからダイアログを開いたとき**
- 前提: admin / hr ロールでログインしている
- 手順: 従業員一覧で「詳細」ボタンをクリック
- 期待結果:
  - `EmployeeDetailDialogComponent`が開く
  - `focusSection`が未指定のため、通常通り上部（基本情報セクション）から表示される
  - セクションナビは表示されているが、特定のセクションにフォーカスされていない

### 3. 既存機能の回帰テスト

**テストケース5: 扶養家族の追加・編集・削除が引き続き動作すること**
- 前提: admin / hr ロールでログインしている
- 手順:
  1. 従業員一覧から「扶養家族を管理」ボタンをクリック
  2. 扶養家族セクションに移動
  3. 「扶養家族を追加」ボタンをクリック
  4. フォームに入力して保存
  5. 追加された扶養家族の「編集」ボタンをクリック
  6. 内容を変更して保存
  7. 「削除」ボタンをクリックして削除
- 期待結果:
  - すべての操作が正常に動作する
  - Firestoreルール違反エラーが発生しない
  - エラーメッセージが適切に表示される（エラー時）

**テストケース6: My Pageの扶養家族表示が引き続き動作すること**
- 前提: employee ロールでログインしている
- 手順: `/me`ページにアクセス
- 期待結果:
  - 「扶養家族（閲覧のみ）」セクションが表示される
  - 扶養家族の一覧が正しく表示される
  - 編集・削除ボタンは表示されない（閲覧のみ）

### 4. エラーケース

**テストケース7: 扶養家族が0人の場合**
- 前提: admin / hr ロールでログインしている
- 手順: 扶養家族が登録されていない従業員の「扶養家族を管理」ボタンをクリック
- 期待結果:
  - ダイアログが開き、扶養家族セクションに移動する
  - 「扶養家族が登録されていません」というメッセージが表示される
  - 「扶養家族を追加」ボタンが表示される（admin / hr の場合）

---

## ⚠️ 注意点・今後の拡張

### 注意点
1. **パフォーマンス**: 従業員一覧で件数表示を実装する場合、各行ごとに`DependentsService.list()`を購読することになる。従業員数が非常に多い場合は、パフォーマンスに影響する可能性がある。必要に応じて、件数表示をオプションにするか、遅延読み込みを検討する。

2. **モバイル対応**: セクションナビは横スクロール可能にする必要がある。モバイルデバイスでも使いやすいUIを心がける。

3. **アクセシビリティ**: セクションナビのボタンには適切な`aria-label`を付与し、キーボード操作でも動作するようにする。

4. **既存機能との整合性**: Phase2-3で実装された扶養家族管理機能を壊さないように注意する。特に、`EmployeeDetailDialogData`インターフェースの拡張は後方互換性を保つ（`focusSection`はオプショナル）。

### 今後の拡張余地
1. **件数のサーバサイド集計**: 従業員数が増えた場合、各行ごとに`DependentsService.list()`を購読するのではなく、`employees/{employeeId}`ドキュメントに`dependentCount`フィールドを追加し、集計をサーバサイドで行う。

2. **セクションナビの改善**: 
   - 現在表示されているセクションを`IntersectionObserver`で検知し、自動的にハイライトする
   - セクションナビを`position: sticky`で固定表示し、常に見えるようにする

3. **キーボードショートカット**: セクションナビの各ボタンにキーボードショートカットを割り当てる（例：`Ctrl+1`で基本情報、`Ctrl+2`で就労条件など）。

4. **検索・フィルタ機能**: 従業員一覧で扶養家族の有無でフィルタリングできる機能を追加する。

5. **一括操作**: 複数の従業員の扶養家族を一括で管理する機能（将来の拡張として検討）。

---

## 📚 参考実装

### Angular Material Dialog のスクロール処理
- `ElementRef`と`scrollIntoView()`を使用
- `behavior: 'smooth'`でスムーズなアニメーションを実現

### IntersectionObserver によるアクティブセクション検知
- `IntersectionObserver`を使って、現在表示されているセクションを検知
- アクティブなセクションに対応するボタンをハイライト

### 既存の実装パターン
- `employees.page.ts`の`openDetail()`メソッドを参考にする
- `employee-detail-dialog.component.ts`の既存のスタイルを参考にする

---

## 📝 まとめ

Phase2-4では、Phase2-3で実装された扶養家族管理機能の導線を改善し、admin / hr ユーザーがより直感的に扶養家族を管理できるようにします。

**主な変更点**:
1. 従業員一覧テーブルに「扶養家族」列を追加し、ワンクリックで扶養家族セクションにアクセスできるようにする
2. 従業員詳細ダイアログ内にセクションナビを追加し、セクション間を簡単に移動できるようにする
3. `EmployeeDetailDialogData`インターフェースに`focusSection`プロパティを追加し、特定のセクションにフォーカスできるようにする

**実装の優先順位**:
1. **必須**: 従業員一覧からの「扶養家族を管理」ボタン追加、ダイアログのフォーカス機能
2. **推奨**: セクションナビの追加
3. **オプション**: 件数表示、アクティブセクションのハイライト

この実装により、扶養家族管理の導線が大幅に改善され、ユーザビリティが向上します。

