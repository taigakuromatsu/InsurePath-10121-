# Phase3-9 実装指示書: 従業員セルフ入力・申請フロー機能

**作成日**: 2025年12月3日  
**対象フェーズ**: Phase3-9  
**優先度**: 🟡 中（拡張機能）  
**依存関係**: Phase3-3（プロフィール変更申請機能）、Phase2-3（被扶養者管理機能）  
**目標完了日**: 2025年12月3日

---

## 1. 📋 概要

Phase3-9では、Phase3-3で実装された「プロフィール変更申請（ChangeRequest）簡易ワークフロー」機能を拡張し、従業員が自分自身のプロフィール情報だけでなく、扶養家族（被扶養者）に関する情報についてもセルフ入力・申請を行えるようにします。

従業員本人がWeb画面（`/me`マイページ）から申請を起票し、管理者・担当者（admin/hr）が申請一覧画面で内容を確認して承認・却下を行うことで、従業員台帳・扶養家族情報の更新を安全かつ効率的に行えるようにします。

**重要な位置づけ**:
- Phase3-3で実装されたChangeRequestワークフローを基盤として、申請種別を拡張します。
- 扶養家族情報の自動反映（承認時に自動で`dependents`コレクションを書き換える処理）はPhase3-9では必須とせず、承認後はHR/adminが画面上で内容を確認し、必要に応じて手動で扶養家族情報を更新する運用とします。
- 将来的に承認時に自動反映するFunctions/サービスを追加する余地があることを前提とします。

---

## 2. 🎯 目的・このフェーズで達成したいこと

### 2.1 主な目的

1. **従業員セルフ入力の拡張**: プロフィール変更申請に加え、扶養家族の追加・変更・削除についても従業員本人が申請できるようにする。
2. **申請ワークフローの統一**: プロフィール変更と扶養家族関連の申請を、同じChangeRequestコレクション・同じ管理画面で一元的に扱えるようにする。
3. **UI/UXの改善**: `/me`画面を拡張し、従業員が自分の申請（プロフィール＋扶養家族関連すべて）を一覧で確認できるようにする。
4. **申請の取り下げ機能**: 申請者が`pending`状態の申請を自分で取り下げ（`canceled`）できるようにする。

### 2.2 このフェーズで達成する具体的な成果

- `/me`画面から、プロフィール変更・扶養家族追加・扶養家族変更・扶養家族削除の4種類の申請を起票できる。
- 申請一覧画面（`/requests`）で、申請種別（`kind`）に応じて「プロフィール変更」「扶養家族追加」などと表示され、管理しやすくなる。
- 申請者が`pending`状態の申請を取り下げ（`canceled`）できる。
- 承認・却下時に申請者に通知が送信される（通知システムとの連携）。

---

## 3. 📎 対象範囲・非対象（スコープ / アウトオブスコープ）

### 3.1 対象範囲（Phase3-9で実装する内容）

#### 3.1.1 申請種別の拡張

Phase3-9で扱う「従業員セルフ入力・申請」の対象は、以下に限定します。

1. **プロフィール変更申請**（Phase3-3で既に実装済み）
   - `/me`から自分の基本情報（住所・電話番号・メールアドレス）の変更申請を行う。
   - Phase3-9では「UI・文言・一覧の扱い」を他の申請と一体的に整理する程度に留める（基本仕様はPhase3-3を踏襲）。

2. **扶養家族（被扶養者）に関する申請**（今回新しく扱う）
   - 被扶養者の「新規追加」の申請（`dependent_add`）
   - 既存被扶養者の「情報変更」の申請（`dependent_update`）
   - 既存被扶養者の「削除」の申請（`dependent_remove`）

#### 3.1.2 UI/UXの拡張

- `/me`画面に「申請・手続き」カード（仮称）を追加し、以下を提供：
  - 自分の申請一覧（プロフィール＋扶養家族関連すべて）
  - 「新しい申請を作成」導線
    - プロフィール変更
    - 扶養家族の追加・変更・削除
- 申請一覧画面（`/requests`）で、申請種別（`kind`）が分かるようにカラムやアイコンを追加。

#### 3.1.3 ステータスの拡張

- `ChangeRequestStatus`に`"canceled"`（申請者による取り下げ）を追加。
- 申請者が`pending`状態の申請を自分で`canceled`に変更できる機能を実装。

#### 3.1.4 通知機能の追加

- 新しいChangeRequestが`pending`で作成されたとき、同じofficeのadmin/hrに通知。
- ChangeRequestが`approved`になったとき、申請者本人に通知。
- ChangeRequestが`rejected`になったとき、申請者本人に通知。

### 3.2 非対象範囲（Phase3-9では実装しない内容）

以下の機能はPhase3-9のスコープ外とし、「将来フェーズで拡張可能な余地あり」として扱います。

- **銀行口座・給与情報のセルフ入力**: 口座情報や給与基本情報の変更申請は対象外。
- **マイナンバーのセルフ入力**: マイナンバーの変更申請は対象外（セキュリティ上の理由）。
- **入社手続きフロー**: 入社時のセルフ入力フォームは対象外（Phase3-17で扱う予定）。
- **扶養家族情報の自動反映**: 承認時に自動で`dependents`コレクションを書き換える処理は必須としない。承認後はHR/adminが画面上で内容を確認し、必要に応じて手動で扶養家族情報を更新する運用とする。
- **申請の編集機能**: `pending`状態の申請を編集する機能は対象外（取り下げ→再申請の運用とする）。
- **申請の再申請機能**: `rejected`状態の申請を再申請する機能は対象外（必要であれば新しい申請を作り直す運用とする）。
- **代理登録機能**: 管理者・担当者が従業員に代わって申請を登録する機能は対象外（セキュリティルール上も現時点では許可していない）。

---

## 4. 🧭 画面・UX仕様

### 4.1 従業員側（申請者）の画面設計

#### 4.1.1 `/me`画面の拡張

**現状**: `/me`画面には既に「変更申請履歴」セクションが存在し、プロフィール変更申請の履歴を表示しています。

**Phase3-9での拡張内容**:

1. **セクションタイトルの変更**
   - 「変更申請履歴」→「申請・手続き」に変更（プロフィール変更と扶養家族関連を統合した名称）。

2. **申請一覧の拡張**
   - プロフィール変更申請と扶養家族関連申請を同じテーブルで表示。
   - テーブルに「申請種別」列を追加し、`kind`に応じて以下のように表示：
     - `"profile"` → 「プロフィール変更」
     - `"dependent_add"` → 「扶養家族追加」
     - `"dependent_update"` → 「扶養家族変更」
     - `"dependent_remove"` → 「扶養家族削除」
   - 扶養家族関連申請の場合は、対象被扶養者名（`payload.dependentName`など）も表示。

3. **新規申請導線の追加**
   - 「新しい申請を作成」ボタンを追加。
   - クリックで申請種別選択ダイアログを表示：
     - 「プロフィール変更」
     - 「扶養家族を追加」
     - 「扶養家族を変更」
     - 「扶養家族を削除」
   - 各選択肢をクリックすると、該当する申請フォームダイアログを開く。

4. **扶養家族一覧との連携**
   - 既存の「扶養家族」セクション（Phase2-3で実装済み）の各行に、「情報変更を申請」「削除を申請」ボタンを追加。
   - これらのボタンから直接申請フォームを開けるようにする。

5. **申請の取り下げ機能**
   - `pending`状態の申請の行に「取り下げ」ボタンを表示。
   - クリックで確認ダイアログを表示し、承認後に`canceled`に変更。

**UI構成イメージ**:

```
┌─────────────────────────────────────────┐
│ 申請・手続き                            │
├─────────────────────────────────────────┤
│ [新しい申請を作成 ▼]                   │
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ 申請日時 │ 種別 │ 内容 │ ステータス ││
│ ├─────────────────────────────────────┤│
│ │ 12/03   │ 扶養家族追加 │ 山田花子 ││
│ │         │              │ 承認待ち  ││
│ │         │              │ [取り下げ]││
│ ├─────────────────────────────────────┤│
│ │ 12/01   │ プロフィール変更 │ 住所 ││
│ │         │              │ 承認済み  ││
│ └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

#### 4.1.2 扶養家族追加申請フォーム

**アクセス方法**:
- `/me`画面の「新しい申請を作成」→「扶養家族を追加」
- `/me`画面の「扶養家族」セクションの「扶養家族を追加申請する」ボタン

**画面構成**:
- **ダイアログ形式**（`MatDialog`を使用）
- **タイトル**: 「扶養家族追加申請」
- **フォーム項目**:
  1. **氏名（漢字）**（`mat-input`、必須）
  2. **氏名（カナ）**（`mat-input`、任意）
  3. **続柄**（`mat-select`、必須）
     - 選択肢: 配偶者、子、父母、祖父母、兄弟姉妹、その他
  4. **生年月日**（`mat-input`、type="date"、必須）
  5. **性別**（`mat-select`、任意）
  6. **郵便番号**（`mat-input`、任意、7桁数字）
  7. **住所**（`mat-textarea`、任意）
  8. **同居／別居**（`mat-select`、任意）
  9. **就労状況フラグ**（`mat-checkbox`、任意、「就労している」）

**バリデーション**:
- 氏名（漢字）: 必須、最大50文字（既存仕様に従う）
- 続柄: 必須
- 生年月日: 必須、YYYY-MM-DD形式
- 郵便番号: 7桁数字（ハイフンなし）

**アクション**:
- **申請する**ボタン: 申請を登録し、ダイアログを閉じる
- **キャンセル**ボタン: ダイアログを閉じる

#### 4.1.3 扶養家族変更申請フォーム

**アクセス方法**:
- `/me`画面の「新しい申請を作成」→「扶養家族を変更」
- `/me`画面の「扶養家族」セクションの各行の「情報変更を申請」ボタン

**画面構成**:
- **ダイアログ形式**（`MatDialog`を使用）
- **タイトル**: 「扶養家族変更申請」
- **対象被扶養者の表示**: 既存の被扶養者情報（氏名・続柄・生年月日）を読み取り専用で表示
- **フォーム項目**: 扶養家族追加申請フォームと同じ項目（現在値と申請値を表示）
  - 現在値: 既存の被扶養者情報から自動取得
  - 申請値: 変更したい値を入力

**バリデーション**: 扶養家族追加申請フォームと同じ

**アクション**:
- **申請する**ボタン: 申請を登録し、ダイアログを閉じる
- **キャンセル**ボタン: ダイアログを閉じる

#### 4.1.4 扶養家族削除申請フォーム

**アクセス方法**:
- `/me`画面の「新しい申請を作成」→「扶養家族を削除」
- `/me`画面の「扶養家族」セクションの各行の「削除を申請」ボタン

**画面構成**:
- **ダイアログ形式**（`MatDialog`を使用）
- **タイトル**: 「扶養家族削除申請」
- **対象被扶養者の表示**: 既存の被扶養者情報（氏名・続柄・生年月日・資格取得日）を読み取り専用で表示
- **削除理由**（`mat-textarea`、任意、最大500文字）

**アクション**:
- **申請する**ボタン: 申請を登録し、ダイアログを閉じる
- **キャンセル**ボタン: ダイアログを閉じる

### 4.2 管理側（admin/hr）の画面設計

#### 4.2.1 申請一覧画面（`/requests`）の拡張

**現状**: Phase3-3で実装済みの申請一覧画面が存在します。

**Phase3-9での拡張内容**:

1. **テーブル列の追加**
   - 「申請種別」列を追加し、`kind`に応じて以下のように表示：
     - `"profile"` → 「プロフィール変更」＋アイコン（`person`）
     - `"dependent_add"` → 「扶養家族追加」＋アイコン（`person_add`）
     - `"dependent_update"` → 「扶養家族変更」＋アイコン（`edit`）
     - `"dependent_remove"` → 「扶養家族削除」＋アイコン（`delete`）

2. **申請内容の表示改善**
   - プロフィール変更申請: 既存通り「変更項目」「現在の値」「申請する値」を表示。
   - 扶養家族追加申請: 「追加する被扶養者情報」を表示（氏名・続柄・生年月日など）。
   - 扶養家族変更申請: 「対象被扶養者名」「変更項目」「現在の値」「申請する値」を表示。
   - 扶養家族削除申請: 「対象被扶養者名」「削除理由」を表示。

3. **フィルタ機能の拡張**
   - ステータスフィルタに加え、「申請種別」フィルタを追加（オプション、時間があれば実装）。

4. **承認・却下処理の拡張**
   - 扶養家族関連申請の場合、承認時に自動反映は行わない（手動更新を前提とする）。
   - 承認・却下ボタンの動作は既存通り（プロフィール変更申請の承認時は自動反映を継続）。

**UI構成イメージ**:

```
┌─────────────────────────────────────────────────────────┐
│ 申請一覧                                                │
├─────────────────────────────────────────────────────────┤
│ [ステータス: すべて ▼] [申請種別: すべて ▼]          │
│                                         │
│ ┌─────────────────────────────────────────────────────┐│
│ │ 申請日時 │ 申請者 │ 種別 │ 内容 │ ステータス │操作││
│ ├─────────────────────────────────────────────────────┤│
│ │ 12/03   │ 山田一郎 │ 扶養家族追加 │ 山田花子 │承認待ち││
│ │         │          │              │          │ [承認][却下]││
│ ├─────────────────────────────────────────────────────┤│
│ │ 12/01   │ 佐藤二郎 │ プロフィール変更 │ 住所 │承認待ち││
│ │         │          │              │          │ [承認][却下]││
│ └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

#### 4.2.2 従業員詳細画面からの導線（オプション）

**時間があれば実装**:
- 従業員詳細画面（`/employees/:id`）に「対象従業員の申請一覧」セクションを追加。
- 該当従業員の申請のみをフィルタして表示。

---

## 5. 🗂 データモデル & Firestore仕様

### 5.1 ChangeRequest型の拡張

Phase3-3で定義済みの`ChangeRequest`型を拡張します。

#### 5.1.1 既存のChangeRequest型（Phase3-3）

**注意**: 以下の型定義は「概念的な型」として記載しています。実装時は、現行の`src/app/types.ts`の`ChangeRequest`型定義を正として扱い、必要に応じてマイグレーション案を詰めてください。既に`field`以外の情報を持てるような`payload`的な構造が入っていたり、フィールド名が異なる可能性があります。

```typescript
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ChangeRequest {
  id: string;
  officeId: string;
  employeeId: string;
  requestedByUserId: string;
  field: 'address' | 'phone' | 'email' | 'other';
  currentValue: string;
  requestedValue: string;
  status: ChangeRequestStatus;
  requestedAt: IsoDateString;
  decidedAt?: IsoDateString;
  decidedByUserId?: string;
  rejectReason?: string;
}
```

**実装時の方針**:
- `field`、`currentValue`、`requestedValue`をオプショナルにする方向性だけ守る。
- 既存の構造を尊重しつつ、`kind`、`targetDependentId`、`payload`フィールドを追加する。

#### 5.1.2 Phase3-9での拡張案

**ステータスの拡張**:
```typescript
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'canceled';
```

**申請種別の追加**:
```typescript
export type ChangeRequestKind = 'profile' | 'dependent_add' | 'dependent_update' | 'dependent_remove';
```

**ChangeRequest型の拡張**:
```typescript
export interface ChangeRequest {
  id: string;
  officeId: string;
  employeeId: string;
  requestedByUserId: string;
  
  // 申請種別（新規追加）
  kind: ChangeRequestKind;
  
  // プロフィール変更申請の場合（kind === 'profile'）
  field?: 'address' | 'phone' | 'email'; // kind === 'profile'の場合のみ必須
  currentValue?: string; // kind === 'profile'の場合のみ必須
  requestedValue?: string; // kind === 'profile'の場合のみ必須
  
  // 扶養家族関連申請の場合（kind === 'dependent_add' | 'dependent_update' | 'dependent_remove'）
  targetDependentId?: string; // kind === 'dependent_update' | 'dependent_remove'の場合のみ必須
  payload?: DependentRequestPayload; // 扶養家族関連申請の場合のみ必須
  
  status: ChangeRequestStatus;
  requestedAt: IsoDateString;
  decidedAt?: IsoDateString;
  decidedByUserId?: string;
  rejectReason?: string;
}
```

**実装時の注意**: `kind`フィールドは型定義上必須ですが、既存の`ChangeRequest`ドキュメント（Phase3-3で作成されたもの）には`kind`が未設定の可能性があります。実装時は、ChangeRequest取得時に`kind: doc.kind ?? 'profile'`のようにマッピングするヘルパー関数を挟み、アプリ内では`kind`が常に定義されている前提で扱ってください。

**DependentRequestPayload型の定義**:
```typescript
// 扶養家族追加申請のペイロード
export interface DependentAddPayload {
  name: string;
  kana?: string;
  relationship: DependentRelationship;
  dateOfBirth: IsoDateString;
  sex?: Sex;
  postalCode?: string;
  address?: string;
  cohabitationFlag?: CohabitationFlag;
  isWorking?: boolean; // 就労状況フラグ
}

// 扶養家族変更申請のペイロード（変更後の値をすべて持たせる方針）
export interface DependentUpdatePayload {
  name: string;
  kana?: string;
  relationship: DependentRelationship;
  dateOfBirth: IsoDateString;
  sex?: Sex;
  postalCode?: string;
  address?: string;
  cohabitationFlag?: CohabitationFlag;
  isWorking?: boolean;
}

// 扶養家族削除申請のペイロード（削除対象のスナップショット）
export interface DependentRemovePayload {
  dependentName: string; // 削除対象の被扶養者名（履歴参照時に便利）
  relationship?: DependentRelationship; // 削除対象の続柄
  dateOfBirth?: IsoDateString; // 削除対象の生年月日
  reason?: string; // 削除理由（任意）
}

export type DependentRequestPayload = DependentAddPayload | DependentUpdatePayload | DependentRemovePayload;
```

**注意事項**:
- `field`、`currentValue`、`requestedValue`は`kind === 'profile'`の場合のみ必須とし、扶養家族関連申請の場合は未設定（`undefined`）でよい。
- `targetDependentId`は`kind === 'dependent_update' | 'dependent_remove'`の場合のみ必須とし、`dependent_add`の場合は未設定（`undefined`）でよい。
- `payload`は扶養家族関連申請の場合のみ必須とし、プロフィール変更申請の場合は未設定（`undefined`）でよい。
- 文字数制約は既存仕様に従う（氏名: 最大50文字、住所: 最大200文字など）。

### 5.2 Firestoreコレクション構造

**コレクションパス**: `offices/{officeId}/changeRequests/{requestId}`

**既存の構造を維持**しつつ、新規フィールド（`kind`、`targetDependentId`、`payload`）を追加します。

**注意**: 既存の`ChangeRequest`ドキュメント（Phase3-3で作成されたもの）は`kind`フィールドが未設定の可能性があります。マイグレーション処理は不要とし、クライアント側で`kind`が未設定の場合は`'profile'`として扱うフォールバック処理を実装してください。

---

## 6. 🔁 ワークフロー & 状態遷移

### 6.1 ステータス設計

Phase3-3の簡易ワークフローを踏襲しつつ、Phase3-9では以下のようにステータスを拡張します。

**ステータス一覧**:
- `"pending"`（申請済み・承認待ち）
- `"approved"`（承認済み）
- `"rejected"`（却下）
- `"canceled"`（申請者による取り下げ）← Phase3-9で新規追加

### 6.2 状態遷移図

```
[申請作成]
    ↓
pending（承認待ち）
    ├─→ approved（承認済み）[終端]
    ├─→ rejected（却下）[終端]
    └─→ canceled（取り下げ）[終端] ← Phase3-9で追加
```

**状態遷移のルール**:

1. **申請作成時**: 常に`pending`で作成される（ドラフトステータスは作らない）。
2. **申請者による取り下げ**: `pending` → `canceled`（申請者本人のみ可能）。
3. **管理者・担当者による承認**: `pending` → `approved`（admin/hrのみ可能）。
4. **管理者・担当者による却下**: `pending` → `rejected`（admin/hrのみ可能）。
5. **終端状態**: `approved`、`rejected`、`canceled`は原則として変更不可（履歴としてのみ参照）。

### 6.3 従業員（申請者）の挙動

#### 6.3.1 申請の作成

- `/me`画面から新しく申請を作成した時点で`pending`になる。
- 申請種別（`kind`）に応じて、適切なフォームを表示する。
- フォーム送信時に、`ChangeRequest`ドキュメントを作成する。

#### 6.3.2 申請の取り下げ

- `pending`状態の申請は、自分で`canceled`に変更できる。
- `/me`画面の申請一覧で「取り下げ」ボタンをクリック。
- 確認ダイアログを表示し、承認後に`canceled`に変更。
- 取り下げ後は編集不可・再申請不可とし、「必要であれば新しい申請を作り直す」という運用とする。

#### 6.3.3 申請の再申請

- `rejected`状態の申請は編集不可・再申請不可とする。
- 必要であれば新しい申請を作り直す運用とする。

### 6.4 admin/hrの挙動

#### 6.4.1 申請の承認

- `pending`状態の申請を`approved`に変更できる。
- プロフィール変更申請の場合: 承認時に従業員台帳（`employees`コレクション）に自動反映（Phase3-3の仕様を継承）。
- 扶養家族関連申請の場合: 承認時に自動反映は行わない。HR/adminが画面上で内容を確認し、必要に応じて手動で扶養家族情報を更新する運用とする。

#### 6.4.2 申請の却下

- `pending`状態の申請を`rejected`に変更できる。
- 却下理由（`rejectReason`）を入力して却下。
- 却下後は申請者に通知を送信。

#### 6.4.3 申請の変更制限

- `approved`、`rejected`、`canceled`の申請は原則として変更不可（履歴としてのみ参照）。
- Phase3-3で「admin/hrが自分の申請を自分で承認できる」状態であれば、その前提を一旦踏襲しつつ、「将来的に制約（`requestedByUserId`と`decidedByUserId`が同一なら不可など）を検討予定」として仕様書にコメントする。

---

## 7. 🔐 権限・Guard・Firestoreセキュリティルール

### 7.1 Guard（ルーティング守衛）

#### 7.1.1 `/me`画面へのアクセス

- **ログイン必須**: `authGuard`を使用。
- **事業所所属必須**: `officeGuard`を使用（既存のGuardを再利用）。
- **従業員IDの確認**: 対象officeに紐づく`employee`ドキュメントを持っていることを前提とする（既存のGuardで確認済みの前提）。

#### 7.1.2 `/requests`画面へのアクセス

- **ログイン必須**: `authGuard`を使用。
- **事業所所属必須**: `officeGuard`を使用。
- **ロール制限**: `roleGuard`を使用し、`admin`または`hr`ロールのみアクセス可能（既存のGuardを再利用）。

### 7.2 Firestoreセキュリティルール

Phase3-3のルールをベースに、以下の制約を整理・拡張します。

#### 7.2.1 既存のルール（Phase3-3）

**注意**: 以下のルールは`match /offices/{officeId}`ブロック内に配置されます。

```javascript
match /offices/{officeId}/changeRequests/{requestId} {
  allow read: if belongsToOffice(officeId) && (
    isAdminOrHr(officeId) ||
    (isInsureEmployee(officeId) && resource.data.requestedByUserId == request.auth.uid)
  );

  allow create: if belongsToOffice(officeId)
    && (isInsureEmployee(officeId) || isAdminOrHr(officeId))
    && request.resource.data.employeeId == currentUser().data.employeeId
    && request.resource.data.requestedByUserId == request.auth.uid
    && request.resource.data.keys().hasOnly([...])
    && request.resource.data.officeId == officeId
    && request.resource.data.status == 'pending'
    && !('decidedAt' in request.resource.data)
    && !('decidedByUserId' in request.resource.data)
    && !('rejectReason' in request.resource.data);

  allow update: if belongsToOffice(officeId) && isAdminOrHr(officeId) && (
    request.resource.data.diff(resource.data).changedKeys().hasOnly(['status', 'decidedAt', 'decidedByUserId', 'rejectReason'])
    && (
      (request.resource.data.status == 'approved' && resource.data.status == 'pending')
      || (
        request.resource.data.status == 'rejected'
        && resource.data.status == 'pending'
        && request.resource.data.rejectReason is string
        && request.resource.data.rejectReason.size() > 0
      )
    )
    && request.resource.data.decidedByUserId == request.auth.uid
    && request.resource.data.decidedAt is string
  );

  allow delete: if false;
}
```

#### 7.2.2 Phase3-9でのルール拡張

**createルールの拡張**:
- `kind`フィールドの追加を許可。
- `kind === 'profile'`の場合: `field`、`currentValue`、`requestedValue`が必須。
- `kind === 'dependent_add'`の場合: `payload`が必須、`targetDependentId`は未設定。
- `kind === 'dependent_update' | 'dependent_remove'`の場合: `targetDependentId`と`payload`が必須。
- `kind`が未設定の場合は`'profile'`として扱う（後方互換性のため）。

**updateルールの拡張**:
- 申請者本人による取り下げ（`pending → canceled`）を許可:
  ```javascript
  match /offices/{officeId}/changeRequests/{requestId} {
    allow update: if belongsToOffice(officeId) && (
      // 管理者・担当者による承認・却下（既存）
      (isAdminOrHr(officeId) && (
        request.resource.data.diff(resource.data).changedKeys().hasOnly(['status', 'decidedAt', 'decidedByUserId', 'rejectReason'])
        && (
          (request.resource.data.status == 'approved' && resource.data.status == 'pending')
          || (
            request.resource.data.status == 'rejected'
            && resource.data.status == 'pending'
            && request.resource.data.rejectReason is string
            && request.resource.data.rejectReason.size() > 0
          )
        )
        && request.resource.data.decidedByUserId == request.auth.uid
        && request.resource.data.decidedAt is string
      ))
      ||
      // 申請者本人（＋同じ office の admin/hr で自分の申請）だけが canceled にできる（Phase3-9で追加）
      (
        (isInsureEmployee(officeId) || isAdminOrHr(officeId))
        && resource.data.requestedByUserId == request.auth.uid
        && resource.data.status == 'pending'
        && request.resource.data.status == 'canceled'
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['status'])
      )
    );
  }
  ```

**実装時の注意**: 上記のコード例は`allow update`の条件式のみを示しています。実装時は、`match /offices/{officeId}/changeRequests/{requestId}`ブロックを1つだけ残し、その中の`allow update`を上記の条件式に差し替えてください（7.2.1の既存ルールと二重定義にならないように注意）。

**readルール**: 既存のまま（変更なし）。

**deleteルール**: 既存のまま（変更なし、履歴として保持）。

#### 7.2.3 ルール変更のdiff

**変更箇所**:

1. **`create`ルール**: `keys().hasOnly([...])`の配列に`'kind'`、`'targetDependentId'`、`'payload'`を追加。
2. **`update`ルール**: 申請者本人による取り下げ（`pending → canceled`）の条件を追加。
   - **重要**: `update`ルールの条件式では、括弧の優先順位に注意してください。`(isInsureEmployee(officeId) || isAdminOrHr(officeId))`のように括弧で囲むことで、意図した条件評価が保証されます。

**後方互換性**:
- 既存の`ChangeRequest`ドキュメント（`kind`未設定）も読み取り可能とする。
- クライアント側で`kind`が未設定の場合は`'profile'`として扱うフォールバック処理を実装。

---

## 8. 🔔 通知仕様

### 8.1 通知イベント

既存の通知機能・改良要件に合わせて、最低限以下のイベントで通知を出す仕様とします。

#### 8.1.1 新しいChangeRequestが`pending`で作成されたとき

- **対象**: 同じofficeのadmin/hr
- **文言例**: 
  - プロフィール変更申請: 「【申請】○○さんから『プロフィール変更申請（住所）』が届きました」
  - 扶養家族追加申請: 「【申請】○○さんから『扶養家族追加申請（山田花子さん）』が届きました」
  - 扶養家族変更申請: 「【申請】○○さんから『扶養家族変更申請（山田花子さん）』が届きました」
  - 扶養家族削除申請: 「【申請】○○さんから『扶養家族削除申請（山田花子さん）』が届きました」

#### 8.1.2 ChangeRequestが`approved`になったとき

- **対象**: 申請者本人
- **文言例**:
  - プロフィール変更申請: 「【申請結果】あなたの『プロフィール変更申請（住所）』が承認されました」
  - 扶養家族追加申請: 「【申請結果】あなたの『扶養家族追加申請（山田花子さん）』が承認されました。担当者による手続き完了までお待ちください。」
  - 扶養家族変更申請: 「【申請結果】あなたの『扶養家族変更申請（山田花子さん）』が承認されました。担当者による手続き完了までお待ちください。」
  - 扶養家族削除申請: 「【申請結果】あなたの『扶養家族削除申請（山田花子さん）』が承認されました。担当者による手続き完了までお待ちください。」

#### 8.1.3 ChangeRequestが`rejected`になったとき

- **対象**: 申請者本人
- **文言例**:
  - プロフィール変更申請: 「【申請結果】あなたの『プロフィール変更申請（住所）』は却下されました。理由: [却下理由]」
  - 扶養家族追加申請: 「【申請結果】あなたの『扶養家族追加申請（山田花子さん）』は却下されました。理由: [却下理由]」
  - 扶養家族変更申請: 「【申請結果】あなたの『扶養家族変更申請（山田花子さん）』は却下されました。理由: [却下理由]」
  - 扶養家族削除申請: 「【申請結果】あなたの『扶養家族削除申請（山田花子さん）』は却下されました。理由: [却下理由]」

### 8.2 通知メッセージの必須要素

通知メッセージには、少なくとも以下を含めるよう仕様に書いてください。

- **申請種別**: プロフィール変更 / 扶養家族追加 / 扶養家族変更 / 扶養家族削除
- **対象従業員名**: 申請者の氏名
- **扶養家族関連の場合は対象の被扶養者名**: `payload.dependentName`または`payload.name`から取得（可能な場合）

**実装時の注意**: 扶養家族名を表示／通知に使う場合は、`const dependentName = payload.dependentName ?? payload.name;`のように取得してください（`DependentRemovePayload`は`dependentName`、`DependentAddPayload`/`DependentUpdatePayload`は`name`を持ちます）。

### 8.3 通知のオン/オフや保持仕様

通知のオン/オフや保持仕様は、InsurePath全体の通知仕様に合わせる形で簡潔に触れる程度で構いません。

### 8.4 Phase3-9での通知実装範囲

**Phase3-9では「ChangeRequest生成／決定イベントに対して通知データを作る」ことを主目的とし、通知のUIや一覧画面の改善は既存仕様の範囲にとどめる。**

具体的には：
- ChangeRequest作成時・承認時・却下時に通知データ（通知ドキュメント）を作成する処理を実装する。
- 通知のUI表示や通知センター側での表示改善は、既存の通知機能の枠内で対応可能な範囲のみとする。
- 通知システムの詳細な実装（通知の分類・フィルタリング・一括処理など）は他のフェーズで扱う。

---

## 9. 🛠 実装タスク一覧

### 9.1 型定義の拡張

**対象ファイル**: `src/app/types.ts`

**タスク**:
1. `ChangeRequestStatus`型に`'canceled'`を追加。
2. `ChangeRequestKind`型を新規作成（`'profile' | 'dependent_add' | 'dependent_update' | 'dependent_remove'`）。
3. `DependentRequestPayload`型を新規作成（`DependentAddPayload`、`DependentUpdatePayload`、`DependentRemovePayload`のユニオン型）。
4. `ChangeRequest`型を拡張:
   - `kind: ChangeRequestKind`を追加（必須）。
   - `field`、`currentValue`、`requestedValue`をオプショナルに変更。
   - `targetDependentId?: string`を追加。
   - `payload?: DependentRequestPayload`を追加。

### 9.2 サービスの拡張

**対象ファイル**: `src/app/services/change-requests.service.ts`

**タスク**:
1. `create()`メソッドのシグネチャを拡張:
   - `kind`パラメータを追加。
   - `field`、`currentValue`、`requestedValue`をオプショナルに変更。
   - `targetDependentId`、`payload`パラメータを追加。
2. `cancel()`メソッドを新規追加:
   - `pending`状態の申請を`canceled`に変更するメソッド。
   - 申請者本人のみ実行可能（Firestoreルールで制御）。
3. `list()`、`listForUser()`メソッドは既存のまま（変更なし）。

### 9.3 UIコンポーネントの実装・拡張

#### 9.3.1 `/me`画面の拡張

**対象ファイル**: `src/app/pages/me/my-page.ts`

**タスク**:
1. 「変更申請履歴」セクションのタイトルを「申請・手続き」に変更。
2. 申請一覧テーブルに「申請種別」列を追加。
3. 「新しい申請を作成」ボタンを追加。
4. 申請種別選択ダイアログを実装。
5. 扶養家族関連申請の申請内容表示ロジックを追加。
6. `pending`状態の申請に「取り下げ」ボタンを追加。
7. 取り下げ確認ダイアログを実装。
8. 扶養家族セクションの各行に「情報変更を申請」「削除を申請」ボタンを追加。

#### 9.3.2 扶養家族追加申請フォーム

**対象ファイル**: `src/app/pages/requests/dependent-add-request-form-dialog.component.ts`（新規作成）

**タスク**:
1. フォームコンポーネントを新規作成。
2. フォーム項目を実装（氏名・続柄・生年月日など）。
3. バリデーションを実装。
4. `ChangeRequestsService.create()`を呼び出して申請を登録。

#### 9.3.3 扶養家族変更申請フォーム

**対象ファイル**: `src/app/pages/requests/dependent-update-request-form-dialog.component.ts`（新規作成）

**タスク**:
1. フォームコンポーネントを新規作成。
2. 既存の被扶養者情報を読み取り専用で表示。
3. 変更したい項目の入力フォームを実装。
4. バリデーションを実装。
5. `ChangeRequestsService.create()`を呼び出して申請を登録。

#### 9.3.4 扶養家族削除申請フォーム

**対象ファイル**: `src/app/pages/requests/dependent-remove-request-form-dialog.component.ts`（新規作成）

**タスク**:
1. フォームコンポーネントを新規作成。
2. 既存の被扶養者情報を読み取り専用で表示。
3. 削除理由の入力フォームを実装（任意）。
4. `ChangeRequestsService.create()`を呼び出して申請を登録。

#### 9.3.5 申請種別選択ダイアログ

**対象ファイル**: `src/app/pages/requests/request-kind-selection-dialog.component.ts`（新規作成）

**タスク**:
1. 申請種別選択ダイアログを新規作成。
2. 4つの選択肢（プロフィール変更、扶養家族追加、扶養家族変更、扶養家族削除）を表示。
3. 選択に応じて適切な申請フォームダイアログを開く。

#### 9.3.6 申請一覧画面の拡張

**対象ファイル**: `src/app/pages/requests/requests.page.ts`

**タスク**:
1. テーブルに「申請種別」列を追加。
2. `kind`に応じた表示ロジックを実装。
3. 扶養家族関連申請の申請内容表示ロジックを追加。
4. 申請種別フィルタを追加（オプション、時間があれば実装）。

### 9.4 Firestoreセキュリティルールの拡張

**対象ファイル**: `firestore.rules`

**タスク**:
1. `changeRequests`コレクションの`create`ルールを拡張:
   - `keys().hasOnly([...])`の配列に`'kind'`、`'targetDependentId'`、`'payload'`を追加。
   - `kind`に応じた必須フィールドチェックを追加（オプション、簡略化可）。
2. `changeRequests`コレクションの`update`ルールを拡張:
   - 申請者本人による取り下げ（`pending → canceled`）の条件を追加。

### 9.5 通知機能の実装

**対象ファイル**: 通知システムの実装ファイル（既存の通知サービスを確認して決定）

**タスク**:
1. ChangeRequest作成時の通知データ作成処理を追加（admin/hr向け）。
2. ChangeRequest承認時の通知データ作成処理を追加（申請者向け）。
3. ChangeRequest却下時の通知データ作成処理を追加（申請者向け）。
4. 通知メッセージの文言を実装（申請種別・対象従業員名・対象被扶養者名を含む）。

**実装範囲**:
- Phase3-9では「ChangeRequest生成／決定イベントに対して通知データを作る」ことを主目的とする。
- 通知のUI表示や通知センター側での表示改善は、既存の通知機能の枠内で対応可能な範囲のみとする。
- 既存の通知機能がある場合はそれを使用し、ない場合は簡易的な実装（SnackBar通知など）で代替しても構いません。

**実装時の注意**: 扶養家族名を通知メッセージに含める場合は、`const dependentName = payload.dependentName ?? payload.name;`のように取得してください（`DependentRemovePayload`は`dependentName`、`DependentAddPayload`/`DependentUpdatePayload`は`name`を持ちます）。

### 9.6 ヘルパー関数の追加

**対象ファイル**: `src/app/utils/label-utils.ts`（既存ファイル）

**タスク**:
1. `getChangeRequestKindLabel(kind: ChangeRequestKind): string`関数を追加。
2. `getChangeRequestStatusLabel(status: ChangeRequestStatus): string`関数を拡張（`'canceled'`に対応）。

---

## 10. ✅ テスト観点・完了条件

### 10.1 テスト観点

Phase3-9完了判定のためのテスト観点チェックリスト：

#### 10.1.1 基本機能のテスト

- [ ] **従業員がプロフィール変更申請を登録できる**（Phase3-3の既存機能が正常に動作すること）
  - テスト手順:
    1. employeeロールでログイン
    2. `/me`画面の「申請・手続き」セクションから「新しい申請を作成」→「プロフィール変更」を選択
    3. 変更項目（住所・電話番号・メールアドレス）を選択
    4. 申請する値を入力して申請
    5. 申請が正常に登録されることを確認

- [ ] **従業員が扶養家族追加申請を登録できる**
  - テスト手順:
    1. employeeロールでログイン
    2. `/me`画面の「申請・手続き」セクションから「新しい申請を作成」→「扶養家族を追加」を選択
    3. 扶養家族情報（氏名・続柄・生年月日など）を入力
    4. 申請を登録
    5. 申請が正常に登録され、`kind: 'dependent_add'`、`payload`が正しく保存されていることを確認

- [ ] **従業員が扶養家族変更申請を登録できる**
  - テスト手順:
    1. employeeロールでログイン
    2. `/me`画面の「扶養家族」セクションから既存の被扶養者の「情報変更を申請」ボタンをクリック
    3. 変更したい項目を入力
    4. 申請を登録
    5. 申請が正常に登録され、`kind: 'dependent_update'`、`targetDependentId`、`payload`が正しく保存されていることを確認

- [ ] **従業員が扶養家族削除申請を登録できる**
  - テスト手順:
    1. employeeロールでログイン
    2. `/me`画面の「扶養家族」セクションから既存の被扶養者の「削除を申請」ボタンをクリック
    3. 削除理由を入力（任意）
    4. 申請を登録
    5. 申請が正常に登録され、`kind: 'dependent_remove'`、`targetDependentId`、`payload`が正しく保存されていることを確認

- [ ] **従業員が申請を取り下げできる**
  - テスト手順:
    1. employeeロールでログイン
    2. `/me`画面の「申請・手続き」セクションで`pending`状態の申請を確認
    3. 「取り下げ」ボタンをクリック
    4. 確認ダイアログで承認
    5. 申請ステータスが`canceled`になることを確認

- [ ] **管理者・担当者が申請一覧を閲覧できる**
  - テスト手順:
    1. adminまたはhrロールでログイン
    2. 申請一覧画面（`/requests`）を開く
    3. 申請一覧が表示され、「申請種別」列に適切な表示（プロフィール変更、扶養家族追加など）がされることを確認

- [ ] **管理者・担当者が扶養家族関連申請を承認できる**
  - テスト手順:
    1. adminまたはhrロールでログイン
    2. 申請一覧画面で扶養家族追加申請を選択
    3. 「承認」ボタンをクリック
    4. 申請ステータスが「承認済み」になることを確認
    5. 申請者に通知が送信されることを確認（通知システムが実装されている場合）

- [ ] **管理者・担当者が扶養家族関連申請を却下できる**
  - テスト手順:
    1. adminまたはhrロールでログイン
    2. 申請一覧画面で扶養家族追加申請を選択
    3. 「却下」ボタンをクリック
    4. 却下理由を入力して却下
    5. 申請ステータスが「却下済み」になることを確認
    6. 申請者に通知が送信されることを確認（通知システムが実装されている場合）

#### 10.1.2 セキュリティのテスト

- [ ] **従業員本人は自分の申請のみ閲覧可能**
  - テスト手順:
    1. employeeロールでログイン
    2. `/me`画面の「申請・手続き」セクションを確認
    3. 自分の申請のみが表示されることを確認（`listForUser()`を使用）
    4. 他の従業員の申請が表示されないことを確認

- [ ] **従業員本人は自分の申請のみ取り下げ可能**
  - テスト手順:
    1. employeeロールでログイン
    2. `/me`画面で自分の`pending`申請の「取り下げ」ボタンをクリック
    3. 申請が`canceled`になることを確認
    4. 他の従業員の申請は取り下げできないことを確認（Firestoreルールで制御）

- [ ] **管理者・担当者は全申請を閲覧・承認・却下可能**
  - テスト手順:
    1. adminまたはhrロールでログイン
    2. 申請一覧画面を開く
    3. 全従業員の申請が表示されることを確認
    4. 任意の申請を承認・却下できることを確認

#### 10.1.3 データ整合性のテスト

- [ ] **プロフィール変更申請の承認時に従業員台帳が正しく更新される**（Phase3-3の既存機能が正常に動作すること）
  - テスト手順:
    1. プロフィール変更申請を承認
    2. 従業員詳細画面で該当項目が更新されていることを確認

- [ ] **扶養家族関連申請の承認時に自動反映されない**（手動更新を前提とする）
  - テスト手順:
    1. 扶養家族追加申請を承認
    2. 従業員詳細画面の「扶養家族」セクションを確認
    3. 申請内容が自動反映されていないことを確認（手動更新が必要であることを確認）

- [ ] **申請の取り下げ時に従業員台帳が更新されない**
  - テスト手順:
    1. プロフィール変更申請を取り下げ
    2. 従業員詳細画面で該当項目が変更されていないことを確認

- [ ] **申請一覧がリアルタイムで更新される**（リアルタイム購読）
  - テスト手順:
    1. 申請一覧画面を開く
    2. 申請を承認・却下・取り下げ
    3. 一覧が自動的に更新されることを確認（手動リロード不要）

#### 10.1.4 通知機能のテスト

- [ ] **新しい申請作成時にadmin/hrに通知が送信される**（通知システムが実装されている場合）
  - テスト手順:
    1. employeeロールで申請を作成
    2. admin/hrロールで通知を確認
    3. 通知メッセージに申請種別・対象従業員名が含まれていることを確認

- [ ] **申請承認時に申請者に通知が送信される**（通知システムが実装されている場合）
  - テスト手順:
    1. admin/hrロールで申請を承認
    2. 申請者（employeeロール）で通知を確認
    3. 通知メッセージに申請種別・承認結果が含まれていることを確認

- [ ] **申請却下時に申請者に通知が送信される**（通知システムが実装されている場合）
  - テスト手順:
    1. admin/hrロールで申請を却下
    2. 申請者（employeeロール）で通知を確認
    3. 通知メッセージに申請種別・却下理由が含まれていることを確認

### 10.2 Phase3-9としての完了条件

以下の条件をすべて満たした場合、Phase3-9は完了とみなします：

1. ✅ `src/app/types.ts`で`ChangeRequestStatus`型に`'canceled'`が追加され、`ChangeRequestKind`型と`DependentRequestPayload`型が定義されている
2. ✅ `ChangeRequest`型が拡張され、`kind`、`targetDependentId`、`payload`フィールドが追加されている
3. ✅ `src/app/services/change-requests.service.ts`の`create()`メソッドが拡張され、扶養家族関連申請に対応している
4. ✅ `src/app/services/change-requests.service.ts`に`cancel()`メソッドが追加されている
5. ✅ `/me`画面に「申請・手続き」セクションが追加され、プロフィール変更と扶養家族関連申請の両方が表示される
6. ✅ `/me`画面から「新しい申請を作成」導線が追加され、4種類の申請種別を選択できる
7. ✅ 扶養家族追加・変更・削除申請フォームが実装されている
8. ✅ `/me`画面で`pending`状態の申請を取り下げ（`canceled`）できる
9. ✅ 申請一覧画面（`/requests`）で申請種別（`kind`）が表示される
10. ✅ `firestore.rules`の`changeRequests`コレクションのルールが拡張され、`kind`、`targetDependentId`、`payload`フィールドの作成が許可されている
11. ✅ `firestore.rules`の`changeRequests`コレクションの`update`ルールが拡張され、申請者本人による取り下げ（`pending → canceled`）が許可されている（括弧の優先順位に注意）
12. ✅ 通知機能が実装されている（ChangeRequest生成／決定イベントに対して通知データを作成する処理が実装されている）
13. ✅ 既存の機能（プロフィール変更申請の承認時の自動反映など）が正常に動作する
14. ✅ テスト観点のチェックリストの主要項目（10.1.1〜10.1.3）がすべてクリアされている

**完了ライン**: `/me`からセルフ申請（プロフィール変更・扶養家族追加/変更/削除）→管理者による承認/却下→結果の確認→通知まで一連のUXが一通り動作する状態。

---

## 11. 注意事項・今後の拡張余地

### 11.1 既存機能を壊さないための注意点

- **後方互換性**: 既存の`ChangeRequest`ドキュメント（`kind`未設定）も読み取り可能とする。クライアント側で`kind`が未設定の場合は`'profile'`として扱うフォールバック処理を実装。
- **プロフィール変更申請の自動反映**: Phase3-3で実装された承認時の自動反映機能は継続して動作することを確認。
- **セキュリティルール**: `changeRequests`コレクションのルールを拡張する際、既存のルールを壊さないように注意。

### 11.2 パフォーマンスに関する注意点

- **申請一覧の取得**: `list()`と`listForUser()`はリアルタイム購読パターン（`collectionData`）を使用するため、承認・却下・取り下げ後に一覧が自動更新される。
- **申請数が増えた場合**: ページネーションを実装することで、パフォーマンスを向上させることができる（Phase3-9ではオプション）。

### 11.3 今後の拡張余地

- **扶養家族情報の自動反映**: 承認時に自動で`dependents`コレクションを書き換えるFunctions/サービスを追加することができる。
- **申請の編集機能**: `pending`状態の申請を編集する機能を追加することができる。
- **申請の再申請機能**: `rejected`状態の申請を再申請する機能を追加することができる。
- **代理登録機能**: 管理者・担当者が従業員に代わって申請を登録する機能を追加することができる（この場合、セキュリティルールの`create`ルールを修正する必要がある）。
- **申請種別の拡張**: 銀行口座・給与情報・マイナンバーなどの申請種別を追加することができる。
- **多段階承認**: 1段階承認の簡易機能から、多段階承認に拡張することができる。

### 11.4 Phase3-9の範囲外

- **扶養家族情報の自動反映**: 承認時に自動で`dependents`コレクションを書き換える処理は必須としない。
- **申請の編集機能**: `pending`状態の申請を編集する機能は対象外（取り下げ→再申請の運用とする）。
- **申請の再申請機能**: `rejected`状態の申請を再申請する機能は対象外（必要であれば新しい申請を作り直す運用とする）。
- **代理登録機能**: 管理者・担当者が従業員に代わって申請を登録する機能は対象外。

---

以上でPhase3-9の実装指示書は完了です。実装時は、この指示書に従って段階的に実装を進めてください。

