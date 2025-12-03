# Phase3-8: 公的帳票（届出書）自動作成・PDF出力機能 実装指示書

**作成日**: 2025年12月3日  
**対象フェーズ**: Phase3-8  
**優先度**: 🟡 中（拡張機能）  
**依存関係**: Phase3-4（社会保険手続き履歴・期限管理機能）、Phase3-7（e-Gov届出対応マスタ管理機能）  
**目標完了日**: 2025年12月3日

---

## 1. 概要

### 1.1 目的

Phase3-7までで実装されたe-Gov届出対応マスタ管理機能により、InsurePath上には社会保険届出に必要な情報が蓄積されています。Phase3-8では、これらの情報を活用して、代表的な社会保険届出書の帳票を自動生成し、PDFとして出力できる機能を実装します。

**重要な位置づけ**:
- 本機能は「申請データの自動送信やCSV仕様の完全対応ではなく、あくまで帳票のひな型PDFを自動で作ってくれる補助機能」として位置づけます。
- 生成されたPDFは「参考様式」として扱い、印刷して手書き修正や、e-Gov入力時の参照用として利用することを想定します。
- 実務上の公的フォーマットを100%再現する必要はありませんが、項目名・レイアウトは可能な範囲で公的帳票に近づけます。

### 1.2 利用者

- **主な利用ロール**: `admin` / `hr`
- **利用シーン**:
  - 新入社員の資格取得手続き時に、資格取得届のPDFを1クリックで生成
  - 退職者の資格喪失手続き時に、資格喪失届のPDFを生成
  - 賞与支給時に、賞与支払届のPDFを生成
  - 算定基礎届の提出時期（7月）に、対象従業員分の帳票を一括生成（将来拡張）
  - 月額変更届が必要な際に、該当従業員の帳票を生成（将来拡張）
  - 被扶養者異動時に、被扶養者異動届のPDFを生成（将来拡張）

**注**: 上記の利用シーンのうち、算定基礎届・月額変更届・被扶養者異動届に関する部分は、本フェーズでは「将来拡張の想定シナリオ」として扱い、実装はPhase4以降とします。

### 1.3 ユースケース

**ユースケース1: 資格取得届の生成**
1. 人事担当者が従業員詳細画面を開く
2. 「帳票生成」ボタンをクリック
3. 帳票種類として「資格取得届」を選択
4. 対象基準日（入社日）を確認・修正
5. 「PDF生成」ボタンをクリック
6. PDFがダウンロードされ、内容を確認して印刷・提出

**ユースケース2: 賞与支払届の生成**
1. 人事担当者が賞与保険料画面を開く
2. 対象の賞与レコードの「賞与支払届PDF生成」ボタンをクリック
3. 帳票生成ダイアログで内容を確認
4. 「PDF生成」ボタンをクリック
5. PDFがダウンロードされ、内容を確認して印刷・提出

### 1.4 本フェーズの必須実装範囲（MVP）

Phase3-8では、設計上の対象帳票6種類すべてを実装するのではなく、**最低限以下の3種類の帳票を実装**することで完了とします。

**Phase3-8のMVP（実装必須）**:

1. **資格取得届**: 1人分のPDF生成（従業員詳細ダイアログから呼び出し）
2. **資格喪失届**: 1人分のPDF生成（従業員詳細ダイアログから呼び出し）
3. **賞与支払届**: 1件分のPDF生成（賞与保険料画面から呼び出し）

**MVPとして必要なUI／サービス**:
- `document-generator.service.ts`による単票PDF生成
- `document-generation-dialog.component`による簡易ダイアログ
- 従業員詳細ダイアログから「資格取得届／資格喪失届PDF」ボタン
- 賞与保険料画面から「賞与支払届PDF」ボタン

**Phase3-8では実装しないが将来拡張として残すもの**:
- 算定基礎届の一括PDF生成（複数名を1つのPDFにまとめる）
- 月額変更届のPDF生成
- 被扶養者異動届のPDF生成
- 手続き履歴画面からの「一括PDF生成」機能
- 複数ページ帳票（pageBreak / ページ番号など）の高度なレイアウト制御
- 帳票履歴管理機能（Storageへの保存、履歴再ダウンロード）
- PDFの自動テストなど、高度なテスト戦略

これらは「将来的に実装予定の拡張項目」として設計のみ行い、実装はPhase4以降の拡張とします。

---

## 2. 対象帳票一覧とマッピング方針

### 2.1 対象帳票

以下の6種類の帳票を対象とします：

1. **健康保険・厚生年金保険 資格取得届**
2. **健康保険・厚生年金保険 資格喪失届**
3. **算定基礎届**
4. **月額変更届**
5. **被扶養者異動届**
6. **賞与支払届**

### 2.2 データマッピング表

各帳票について、InsurePath内のどのコレクション・フィールドを参照してどの項目を埋めるかを以下に示します。

**重要な注意事項**:
- 本指示書中に記載している `offices/{officeId}` や `employees/{employeeId}` などのコレクションパス・フィールド名はあくまで **論理名（概念名）** です。
- 実際のInsurePathのFirestoreスキーマ（`offices/{officeId}/employees/{employeeId}` 配下のサブコレクション等）とは異なる可能性があるため、**実装時には既存スキーマと付き合わせてマッピングを行うこと**。
- 必要に応じてフィールド名を既存定義に合わせたり、新規フィールドとして追加したりする前提とする。

**標準報酬月額・等級の取得方針**:
- 標準報酬月額・等級に関しては、可能な限り `StandardRewardHistory`（標準報酬決定履歴）側から、対象年月（算定基礎の対象年7月・月額変更の適用開始月など）に対応するレコードを取得する。
- 従業員ドキュメント側 (`employees/{employeeId}.monthlyWage` など) の値は、履歴が取れない場合のフォールバックとして扱う。

#### 2.2.1 資格取得届

| 帳票項目 | InsurePathデータソース | フィールドパス | 必須/任意 | 備考 |
|---------|---------------------|--------------|----------|------|
| 事業所名 | `offices/{officeId}` | `name` | 必須 | |
| 事業所記号 | `offices/{officeId}` | `officeSymbol` | 任意 | 未設定時は空欄 |
| 事業所番号 | `offices/{officeId}` | `officeNumber` | 任意 | 未設定時は空欄 |
| 事業所所在地 | `offices/{officeId}` | `address` | 任意 | 未設定時は空欄 |
| 事業所郵便番号 | `offices/{officeId}` | `officePostalCode` | 任意 | 未設定時は空欄 |
| 事業主氏名 | `offices/{officeId}` | `officeOwnerName` | 任意 | 未設定時は空欄 |
| 被保険者整理番号 | `employees/{employeeId}` | `employeeCodeInOffice` | 任意 | 未設定時は空欄 |
| 被保険者氏名（漢字） | `employees/{employeeId}` | `name` | 必須 | |
| 被保険者氏名（カナ） | `employees/{employeeId}` | `kana` | 任意 | 未設定時は空欄 |
| 生年月日 | `employees/{employeeId}` | `birthDate` | 必須 | YYYY-MM-DD形式から変換 |
| 性別 | `employees/{employeeId}` | `sex` | 任意 | `male`→「男」、`female`→「女」、`other`→「その他」、未設定時は空欄 |
| 住所 | `employees/{employeeId}` | `address` | 任意 | 未設定時は空欄 |
| 郵便番号 | `employees/{employeeId}` | `postalCode` | 任意 | 未設定時は空欄 |
| 資格取得日 | `employees/{employeeId}` | `healthQualificationDate`（健保）<br>`pensionQualificationDate`（厚年） | 必須 | 健保と厚年で異なる場合は両方記載 |
| 資格取得区分 | `employees/{employeeId}` | `healthQualificationKind`（健保）<br>`pensionQualificationKind`（厚年） | 任意 | `new_hire`→「新規採用」、`expansion`→「適用拡大」、`hours_change`→「所定労働時間変更」、`other`→「その他」 |
| 標準報酬月額 | `standardRewardHistories/{historyId}`<br>`employees/{employeeId}` | `standardMonthlyReward`（優先）<br>`monthlyWage`（フォールバック） | 必須 | 標準報酬履歴から対象年月の値を取得。履歴が存在しない場合は従業員ドキュメント側の値を使用 |
| 健康保険等級 | `employees/{employeeId}` | `healthGrade` | 任意 | 未設定時は空欄 |
| 厚生年金等級 | `employees/{employeeId}` | `pensionGrade` | 任意 | 未設定時は空欄 |
| 被保険者記号 | `employees/{employeeId}` | `healthInsuredSymbol` | 任意 | 未設定時は空欄 |
| 被保険者番号 | `employees/{employeeId}` | `healthInsuredNumber` | 任意 | 未設定時は空欄 |
| 厚生年金番号 | `employees/{employeeId}` | `pensionNumber` | 任意 | 未設定時は空欄 |

**データが存在しない場合の挙動**:
- 必須項目の分類については、5.1「データ不足・不整合時の挙動」を参照
- 任意項目が欠けている場合: 該当欄を空欄のままPDF生成を続行

#### 2.2.2 資格喪失届

| 帳票項目 | InsurePathデータソース | フィールドパス | 必須/任意 | 備考 |
|---------|---------------------|--------------|----------|------|
| 事業所名 | `offices/{officeId}` | `name` | 必須 | |
| 事業所記号 | `offices/{officeId}` | `officeSymbol` | 任意 | |
| 事業所番号 | `offices/{officeId}` | `officeNumber` | 任意 | |
| 被保険者整理番号 | `employees/{employeeId}` | `employeeCodeInOffice` | 任意 | |
| 被保険者氏名（漢字） | `employees/{employeeId}` | `name` | 必須 | |
| 被保険者氏名（カナ） | `employees/{employeeId}` | `kana` | 任意 | |
| 生年月日 | `employees/{employeeId}` | `birthDate` | 必須 | |
| 資格喪失日 | `employees/{employeeId}` | `healthLossDate`（健保）<br>`pensionLossDate`（厚年） | 必須 | |
| 資格喪失理由区分 | `employees/{employeeId}` | `healthLossReasonKind`（健保）<br>`pensionLossReasonKind`（厚年） | 任意 | `retirement`→「退職」、`hours_decrease`→「所定労働時間減少」、`death`→「死亡」、`other`→「その他」 |
| 退職日 | `employees/{employeeId}` | `retireDate` | 任意 | 資格喪失日と異なる場合に記載 |

#### 2.2.3 算定基礎届

| 帳票項目 | InsurePathデータソース | フィールドパス | 必須/任意 | 備考 |
|---------|---------------------|--------------|----------|------|
| 事業所名 | `offices/{officeId}` | `name` | 必須 | |
| 対象年 | ユーザー入力 | `targetYear` | 必須 | 例：2025年 |
| 対象従業員一覧 | `employees/{employeeId}` | 複数従業員 | 必須 | 対象年7月1日時点で在籍かつ`isInsured=true`の従業員 |
| 各従業員の氏名 | `employees/{employeeId}` | `name` | 必須 | |
| 各従業員の生年月日 | `employees/{employeeId}` | `birthDate` | 必須 | |
| 各従業員の標準報酬月額 | `standardRewardHistories/{historyId}`<br>`employees/{employeeId}` | `standardMonthlyReward`（優先）<br>`monthlyWage`（フォールバック） | 必須 | 標準報酬履歴から対象年7月時点の値を取得。履歴が存在しない場合は従業員ドキュメント側の値を使用 |
| 各従業員の健康保険等級 | `employees/{employeeId}` | `healthGrade` | 任意 | |
| 各従業員の厚生年金等級 | `employees/{employeeId}` | `pensionGrade` | 任意 | |

**注意**: 
- 算定基礎届は複数名を1つの帳票にまとめる形式が一般的です。PDF生成時は、1ページ目に事業所情報、2ページ目以降に従業員一覧を記載します。
- 本帳票はPhase3-8のMVPには含まれず、将来拡張として設計のみ行います。

#### 2.2.4 月額変更届

| 帳票項目 | InsurePathデータソース | フィールドパス | 必須/任意 | 備考 |
|---------|---------------------|--------------|----------|------|
| 事業所名 | `offices/{officeId}` | `name` | 必須 | |
| 被保険者整理番号 | `employees/{employeeId}` | `employeeCodeInOffice` | 任意 | |
| 被保険者氏名 | `employees/{employeeId}` | `name` | 必須 | |
| 変更前標準報酬月額 | `standardRewardHistories/{historyId}` | 変更前の`standardMonthlyReward` | 必須 | 標準報酬履歴から取得 |
| 変更後標準報酬月額 | `standardRewardHistories/{historyId}` | 変更後の`standardMonthlyReward` | 必須 | 標準報酬履歴から取得 |
| 変更前等級 | `standardRewardHistories/{historyId}` | 変更前の等級 | 任意 | |
| 変更後等級 | `standardRewardHistories/{historyId}` | 変更後の等級 | 任意 | |
| 変更事由月 | `standardRewardHistories/{historyId}` | `appliedFromYearMonth` | 必須 | YYYY-MM形式から変換 |
| 変更理由 | `standardRewardHistories/{historyId}` | `decisionKind` | 任意 | `interim`→「随時改定」、`other`→「その他」 |

**注意**: 月額変更届は標準報酬履歴（`StandardRewardHistory`）から変更前後の値を取得します。履歴が存在しない場合はエラーとします。本帳票はPhase3-8のMVPには含まれず、将来拡張として設計のみ行います。

#### 2.2.5 被扶養者異動届

| 帳票項目 | InsurePathデータソース | フィールドパス | 必須/任意 | 備考 |
|---------|---------------------|--------------|----------|------|
| 事業所名 | `offices/{officeId}` | `name` | 必須 | |
| 被保険者氏名 | `employees/{employeeId}` | `name` | 必須 | |
| 被保険者整理番号 | `employees/{employeeId}` | `employeeCodeInOffice` | 任意 | |
| 被扶養者氏名（漢字） | `dependents/{dependentId}` | `name` | 必須 | |
| 被扶養者氏名（カナ） | `dependents/{dependentId}` | `kana` | 任意 | |
| 被扶養者生年月日 | `dependents/{dependentId}` | `dateOfBirth` | 必須 | |
| 被扶養者性別 | `dependents/{dependentId}` | `sex` | 任意 | |
| 続柄 | `dependents/{dependentId}` | `relationship` | 必須 | `spouse`→「配偶者」、`child`→「子」、`parent`→「父母」、`grandparent`→「祖父母」、`sibling`→「兄弟姉妹」、`other`→「その他」 |
| 資格取得日 | `dependents/{dependentId}` | `qualificationAcquiredDate` | 必須（異動種別が「追加」の場合） | |
| 資格喪失日 | `dependents/{dependentId}` | `qualificationLossDate` | 必須（異動種別が「削除」の場合） | |
| 同居／別居 | `dependents/{dependentId}` | `cohabitationFlag` | 任意 | `cohabiting`→「同居」、`separate`→「別居」 |

**注意**: 
- Phase3-8のスコープでは、被扶養者異動届は **「追加」と「削除」の2パターンのみ** を対象とします。
- 住所変更・同居／別居変更などの"異動のみ"パターンは、今後の拡張（Phase4以降）で検討します。
- 実装上は、`qualificationAcquiredDate`が設定されていれば「追加」、`qualificationLossDate`が設定されていれば「削除」として扱い、それ以外のケースは今回の帳票生成対象外とします。
- 本帳票はPhase3-8のMVPには含まれず、将来拡張として設計のみ行います。

#### 2.2.6 賞与支払届

| 帳票項目 | InsurePathデータソース | フィールドパス | 必須/任意 | 備考 |
|---------|---------------------|--------------|----------|------|
| 事業所名 | `offices/{officeId}` | `name` | 必須 | |
| 被保険者整理番号 | `employees/{employeeId}` | `employeeCodeInOffice` | 任意 | |
| 被保険者氏名 | `employees/{employeeId}` | `name` | 必須 | |
| 賞与支給日 | `bonusPremiums/{bonusId}` | `payDate` | 必須 | YYYY-MM-DD形式から変換 |
| 賞与支給額 | `bonusPremiums/{bonusId}` | `grossAmount` | 必須 | |
| 標準賞与額 | `bonusPremiums/{bonusId}` | `standardBonusAmount` | 必須 | |
| 健康保険料 | `bonusPremiums/{bonusId}` | `healthTotal` | 必須 | |
| 厚生年金保険料 | `bonusPremiums/{bonusId}` | `pensionTotal` | 必須 | |
| 年度 | `bonusPremiums/{bonusId}` | `fiscalYear` | 必須 | 例：「2024年度」 |

**注意**: 賞与支払届は`BonusPremium`レコードから情報を取得します。Phase3-8のMVPでは1件分のPDF生成のみを対象とし、複数の賞与を1つの帳票にまとめる機能は将来拡張とします。

---

## 3. UI / UX設計

### 3.1 帳票生成の呼び出し元

**Phase3-8のMVP（実装必須）**:
帳票生成は以下の画面から呼び出せるようにします：

1. **従業員詳細ダイアログ**（`employee-detail-dialog.component.ts`）
   - 「資格取得届PDF生成」「資格喪失届PDF生成」ボタンを追加
   - 該当従業員に関する帳票を生成可能

2. **賞与保険料画面**（`bonus-premiums.page.ts`）
   - 賞与一覧の各行に「賞与支払届PDF生成」ボタンを追加

**将来拡張（Phase4以降）**:
- 手続き履歴画面（`procedures.page.ts`）からの帳票生成
- 複数選択して「一括PDF生成」機能（算定基礎届など）
- 従業員詳細ダイアログに「帳票」タブを追加し、各種帳票を一覧表示

### 3.2 帳票生成ダイアログの設計

帳票生成ダイアログ（`document-generation-dialog.component.ts`）を新規作成します。

**ワイヤーフレームイメージ**:

```
┌─────────────────────────────────────────┐
│ 帳票生成                                │
├─────────────────────────────────────────┤
│                                         │
│ 帳票種類: [資格取得届 ▼]               │
│                                         │
│ 対象従業員: 山田 太郎                  │
│                                         │
│ 対象基準日: [2025-04-01]               │
│                                         │
│ 対象賞与: [選択...] (賞与支払届の場合) │
│                                         │
│ 対象被扶養者: [選択...] (被扶養者異動届の場合) │
│                                         │
│ [必須項目チェック結果]                 │
│ ✅ 必須項目がすべて入力されています     │
│ ⚠️ 事業所記号が未設定です（任意項目）  │
│                                         │
│ [プレビュー] [PDFダウンロード] [印刷]  │
│                                         │
└─────────────────────────────────────────┘
```

**注**: 上記ワイヤーフレームには将来拡張分（被扶養者異動届用の「対象被扶養者」選択欄など）も含まれていますが、Phase3-8のMVPでは実装しません。

**実装要素（Phase3-8のMVP）**:
- 帳票種類の選択（`mat-select`）- MVPでは「資格取得届」「資格喪失届」「賞与支払届」の3種類のみ
- 対象従業員の表示（読み取り専用）
- 対象基準日の選択（資格取得届・資格喪失届の場合）
- 対象賞与の選択（賞与支払届の場合）
- 必須項目チェック結果の表示（リアルタイムバリデーション）
- 「プレビュー」ボタン（PDFを新しいタブで開く）
- 「PDFダウンロード」ボタン（PDFをダウンロード）
- 「印刷」ボタン（ブラウザの印刷ダイアログを開く）

**将来拡張（Phase4以降）**:
- 対象被扶養者の選択（被扶養者異動届の場合）
- その他、算定基礎届・月額変更届に必要な入力項目

### 3.3 バリデーション・警告

本機能は「参考様式」としての位置づけのため、必須項目が不足していてもユーザー判断で続行できる仕様とします。

**致命的必須項目（critical）が不足している場合**:
- 例：事業所名、被保険者氏名、生年月日 など
- エラーメッセージを表示: 「以下の必須項目が不足しています: [項目名のリスト]」
- 「PDFダウンロード」ボタンを無効化し、PDF生成を中断

**通常必須項目（required）が不足している場合**:
- マッピング表の「必須」として定義しているが、欠けていても「とりあえず帳票を出して手書き補完したい」ケースがありうる項目
- 例：資格取得日、標準報酬月額 など
- エラーではなく「⚠ 警告」として不足項目をリスト表示
- 「PDFダウンロード」ボタンはデフォルトで無効化
- 「警告を理解した上で続行する」チェックボックス or 二段階ボタンで、**ユーザーが明示的に続行を選べる仕様**とする

**任意項目（optional）が不足している場合**:
- 警告メッセージを表示: 「以下の項目が未設定です（任意項目）: [項目名のリスト]」
- 「PDFダウンロード」ボタンは有効のまま（空欄でPDF生成可能）

**データ不整合の場合**:
- 例：資格取得日が未来の日付
- 警告メッセージを表示し、ユーザーに確認を求める
- ユーザーが「続行」を選択した場合はPDF生成を続行

---

## 4. 技術設計（PDF生成）

### 4.1 PDF生成ライブラリの選定

**候補ライブラリの比較**:

| ライブラリ | メリット | デメリット | 選定結果 |
|----------|---------|----------|---------|
| **jsPDF** | 軽量、クライアント側で完結、日本語フォント対応可能 | レイアウト定義が複雑、テーブル作成が面倒 | ❌ |
| **pdfmake** | JSONベースのレイアウト定義、テーブル作成が容易、日本語フォント対応 | 日本語フォントの設定が必要、バンドルサイズが大きい | ✅ **採用** |
| **html2pdf.js** | HTML/CSSからPDF生成、既存のAngularコンポーネントを再利用可能 | レイアウト制御が難しい、印刷品質が不安定 | ❌ |
| **Puppeteer** (サーバー側) | 高品質なPDF生成、ブラウザレンダリング | Cloud Functionsの実装が必要、コストがかかる | ❌ |

**選定理由**:
- **pdfmake**を採用します
- JSONベースのレイアウト定義により、帳票テンプレートをTypeScriptの定数として管理しやすい
- テーブル作成が容易で、算定基礎届のような複数名一覧の帳票にも対応しやすい
- クライアント側で完結するため、既存のAngularアプリケーションとの統合が容易
- 日本語フォント（IPAexフォントなど）の設定により、日本語表示に対応可能

### 4.2 クライアント生成 vs サーバー生成

**クライアント生成（pdfmake）を採用**:

**理由**:
- **パフォーマンス**: サーバーへのリクエスト不要で、即座にPDF生成可能
- **セキュリティ**: 機密情報（マイナンバーなど）をサーバーに送信する必要がない
- **実装コスト**: Cloud Functionsの実装・デプロイが不要
- **スケーラビリティ**: サーバー側のリソースを消費しない

**デメリットと対策**:
- **日本語フォントのバンドルサイズ**: pdfmakeの日本語フォントファイル（IPAexフォント）は約2MB程度。初回ロード時にダウンロードするが、ブラウザキャッシュにより2回目以降は高速化される。
- **ブラウザ依存**: 最新のChrome/Edgeを前提とする（既存の制約条件と一致）

### 4.3 帳票レイアウト定義の持ち方

**テンプレートJSON / TypeScript定数のハイブリッド方式**:

各帳票のレイアウト定義を、TypeScriptの定数として管理します。

**例: 資格取得届のテンプレート定義**

```typescript
// src/app/utils/document-templates/qualification-acquisition.ts

import { TDocumentDefinitions } from 'pdfmake/interfaces';

export function createQualificationAcquisitionDocument(
    office: Office,
  employee: Employee,
  data: {
    qualificationDate: string;
    qualificationKind?: string;
  }
): TDocumentDefinitions {
  return {
    content: [
      { text: '健康保険・厚生年金保険 資格取得届', style: 'header' },
      { text: '\n' },
      {
        table: {
          widths: ['*', '*'],
          body: [
            ['事業所名', office.name],
            ['事業所記号', office.officeSymbol || ''],
            ['被保険者氏名', employee.name],
            ['生年月日', formatDate(employee.birthDate)],
            // ... 他の項目
          ]
        }
      }
    ],
    styles: {
      header: { fontSize: 16, bold: true, alignment: 'center' }
    },
    defaultStyle: {
      font: 'IPAexGothic'
    }
  };
}
```

**拡張性の考慮**:
- 各帳票のテンプレート定義を独立したファイルに分離（`src/app/utils/document-templates/`配下）
- 共通のヘルパー関数（日付フォーマット、金額フォーマットなど）を`document-helpers.ts`に集約
- 将来的に帳票を追加する際は、新しいテンプレートファイルを追加するだけで対応可能

### 4.4 多ページ帳票への対応

**将来拡張（Phase4以降）**:
- 算定基礎届などの複数名一覧帳票では、pdfmakeの`pageBreak`を使用して、1ページあたりの行数を制御
- 2ページ目以降にもヘッダー（事業所名など）を繰り返し表示
- ページ番号をフッターに表示

**Phase3-8のMVPでは**:
- 単票PDF生成のみを対象とするため、多ページ帳票への対応は不要
- 将来拡張として設計のみ行う

---

## 5. エラーハンドリングと制約事項

### 5.1 データ不足・不整合時の挙動

本機能は「参考様式」としての位置づけのため、必須項目の不足を3段階に分類し、致命的な場合のみ中断、それ以外は警告表示＋ユーザー判断で続行可能とします。

**致命的必須項目（critical）が欠けている場合**:
- 例：事業所名、被保険者氏名、生年月日 など、帳票の基本情報として絶対に必要な項目
- PDF生成を中断し、エラーメッセージをSnackBarで表示
- 不足している項目をリストアップしてユーザーに提示
- 例：「資格取得届の生成に失敗しました。以下の必須項目が不足しています: 事業所名、被保険者氏名」

**通常必須項目（required）が欠けている場合**:
- 例：資格取得日、標準報酬月額 など、帳票の主要項目だが、手書き補完も可能な項目
- エラーではなく「⚠ 警告」として不足項目をリスト表示
- 「PDFダウンロード」ボタンはデフォルトで無効化
- 「警告を理解した上で続行する」チェックボックスを表示
- ユーザーがチェックを入れた場合のみ「PDFダウンロード」ボタンを有効化
- 空欄のままPDF生成を続行可能（手書き補完を前提とする）

**データ不整合の場合**:
- 例：資格取得届なのに`healthQualificationDate`が未来の日付
- 警告メッセージを表示し、ユーザーに確認を求める
- ユーザーが「続行」を選択した場合はPDF生成を続行

**文字数オーバーの場合**:
- 帳票の各項目には文字数制限がある場合がある
- 超過した場合は自動で切り詰め、警告メッセージを表示
- 例：「氏名が20文字を超えているため、最初の20文字のみを記載しました」

### 5.2 文字化け・フォントに関する注意点

**日本語フォントの設定**:
- pdfmakeで日本語を表示するには、日本語フォント（IPAexフォントなど）を設定する必要がある
- フォントファイルを`src/assets/fonts/`配下に配置
- pdfmakeの初期化時にフォントを登録

**実装例（イメージ用の擬似コード）**:
```typescript
// src/app/services/document-generator.service.ts
// 注意: 以下は実装イメージ用の擬似コードです。実際の実装方法は別途決定してください。

import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// 日本語フォントを登録（実装イメージ）
// 実際の実装では、ビルド時にvfsにフォントを取り込む方法や、
// Angular側での初期化パターンなど、プロジェクトの構成に合わせて具体的な実装方法を別途決定する
pdfMake.vfs = {
  ...pdfFonts.pdfMake.vfs,
  'IPAexGothic': await loadFontFile('assets/fonts/ipaexg.ttf') // 実コードは要調整
};

pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf', // 実コードは要調整（フォントファイルをバンドルするかどうかはプロジェクトの方針に依存）
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf'
  },
  IPAexGothic: {
    normal: 'IPAexGothic',
    bold: 'IPAexGothic',
    italics: 'IPAexGothic',
    bolditalics: 'IPAexGothic'
  }
};
```

**重要な注意事項**:
- ここに記載しているpdfmake + 日本語フォント設定のコードは **あくまでイメージ用の擬似コード** です。
- 実際の実装では、ビルド時にvfsにフォントを取り込む方法や、Angular側での初期化パターンなど、プロジェクトの構成に合わせて具体的な実装方法を別途決定する。
- Robotoフォント設定も同様に、実際にフォントファイルをバンドルするかどうかはプロジェクトの方針に依存する。

### 5.3 ブラウザ依存の注意事項

**PDF表示**:
- 生成されたPDFはブラウザのPDFビューアで表示されます
- Chrome/Edgeの標準PDFビューアで正常に表示されることを確認
- 印刷時のレイアウト崩れがないことを確認

**メモリ使用量**:
- Phase3-8のMVPでは単票PDF生成のみを対象とするため、メモリ使用量の問題は発生しにくい
- 将来拡張として複数名一括生成を実装する際は、一度に生成する従業員数を制限（例：50名ずつ）することを検討する

### 5.4 「参考様式」としての位置づけ

**重要な注意事項**:
- 本システムで生成されるPDFは「参考様式」であり、公的機関が正式に認めた様式ではありません
- 公的機関により様式が変更された場合、本システムの帳票が古い様式のままになる可能性があります
- 最終的な提出内容の確認は、事業所側の責任で行う必要があります
- 本システムの帳票をそのまま提出するのではなく、e-Gov入力時の参照用や、社内での確認用として利用することを推奨します

**画面への注意書き表示**:
- 帳票生成ダイアログに以下の注意書きを表示:
  > 「本システムで生成される帳票は参考様式です。公的機関が正式に認めた様式ではないため、提出前に内容を確認し、必要に応じて手書きで修正してください。」

---

## 6. テスト方針

### 6.1 最低限行うべきテストケース

#### 6.1.1 正常系テスト

**テストケース1: 資格取得届のPDF生成（必須項目すべて入力済み）**
- 前提条件: 従業員情報に必須項目（氏名、生年月日、資格取得日）がすべて入力されている
- 実行: 資格取得届のPDF生成を実行
- 期待結果: PDFが正常に生成され、必須項目がすべて記載されている

**テストケース2: 資格喪失届のPDF生成（必須項目すべて入力済み）**
- 前提条件: 従業員情報に必須項目（氏名、生年月日、資格喪失日）がすべて入力されている
- 実行: 資格喪失届のPDF生成を実行
- 期待結果: PDFが正常に生成され、必須項目がすべて記載されている

**テストケース3: 賞与支払届のPDF生成**
- 前提条件: `BonusPremium`レコードが存在し、必須項目がすべて入力されている
- 実行: 賞与支払届のPDF生成を実行
- 期待結果: PDFが正常に生成され、賞与支給日・支給額・標準賞与額・保険料が記載されている

#### 6.1.2 異常系テスト

**テストケース4: 致命的必須項目が欠けている場合のエラー表示**
- 前提条件: 従業員情報に氏名が未設定
- 実行: 資格取得届のPDF生成を実行
- 期待結果: エラーメッセージが表示され、PDF生成が中断される

**テストケース5: 通常必須項目が欠けている場合の警告表示と続行**
- 前提条件: 従業員情報に資格取得日が未設定
- 実行: 資格取得届のPDF生成を実行
- 期待結果: 警告メッセージが表示され、「警告を理解した上で続行する」チェックボックスが表示される。チェックを入れるとPDF生成が可能になる

**テストケース6: データ不整合時の警告表示と続行**
- 前提条件: 資格取得日が未来の日付
- 実行: 資格取得届のPDF生成を実行
- 期待結果: 警告メッセージが表示され、ユーザーに確認を求める

**テストケース7: 任意項目が不足している場合の軽い警告表示**
- 前提条件: 従業員情報に事業所記号が未設定
- 実行: 資格取得届のPDF生成を実行
- 期待結果: 軽い警告メッセージが表示されるが、PDF生成は可能

**テストケース8: 文字数オーバー時の自動切り詰め**
- 前提条件: 従業員名が30文字（帳票の制限20文字を超過）
- 実行: 資格取得届のPDF生成を実行
- 期待結果: 最初の20文字のみが記載され、警告メッセージが表示される

#### 6.1.3 レイアウト確認テスト

**テストケース9: ChromeでのPDF表示確認**
- 前提条件: Chromeブラウザでアプリケーションを開く
- 実行: MVP対象の各帳票（資格取得届、資格喪失届、賞与支払届）のPDFを生成し、ブラウザのPDFビューアで表示
- 期待結果: レイアウトが崩れず、日本語が正しく表示される

**テストケース10: EdgeでのPDF表示確認**
- 前提条件: Edgeブラウザでアプリケーションを開く
- 実行: MVP対象の各帳票（資格取得届、資格喪失届、賞与支払届）のPDFを生成し、ブラウザのPDFビューアで表示
- 期待結果: レイアウトが崩れず、日本語が正しく表示される

**テストケース11: 印刷時のレイアウト確認**
- 前提条件: MVP対象の各帳票（資格取得届、資格喪失届、賞与支払届）のPDFを生成
- 実行: ブラウザの印刷ダイアログを開き、プレビューを確認
- 期待結果: 印刷時のレイアウトが崩れず、用紙サイズ（A4）に収まる

### 6.2 自動テストの有無

**現時点では自動テストは実装しない方針**:
- PDF生成の自動テストは、PDFの内容を検証するのが困難
- スナップショットテストも、フォントの違いやブラウザ依存により安定しない可能性がある
- 手動テストを中心に、代表的なパターンで動作確認を行う

**将来的な拡張案**:
- PDFのテキスト抽出ライブラリを使用して、必須項目が正しく記載されているかを自動検証
- ただし、現時点では工数削減のため手動テストに留める

---

## 7. 今後の拡張余地

### 7.1 帳票履歴管理機能

**将来の拡張案**:
- 生成したPDFをFirebase Storageに保存し、履歴として管理
- 帳票生成履歴をFirestoreに記録（生成日時、生成者、対象従業員、帳票種類など）
- 過去に生成した帳票を再ダウンロードできる機能

**実装時の考慮事項**:
- PDFファイルの保存先: `offices/{officeId}/documents/{documentId}.pdf`
- 帳票履歴の型定義: `DocumentHistory`型を追加
- セキュリティ: admin/hrのみが履歴を閲覧可能

### 7.2 その他の将来拡張項目

**算定基礎届の一括PDF生成**:
- 複数名を1つのPDFにまとめる機能
- 多ページ帳票への対応（pageBreak、ページ番号など）

**月額変更届のPDF生成**:
- 標準報酬履歴から変更前後の値を取得して帳票を生成

**被扶養者異動届のPDF生成**:
- 追加・削除パターンに加え、住所変更・同居／別居変更などの"異動のみ"パターンへの対応

**手続き履歴画面からの帳票生成**:
- 手続き一覧の各行に「PDF生成」ボタンを追加
- 複数選択して「一括PDF生成」機能

**高度なテスト戦略**:
- PDFのテキスト抽出ライブラリを使用した自動検証
- スナップショットテストの導入

---

## 8. 実装ファイル一覧

### 8.1 新規作成ファイル（Phase3-8のMVP）

- `src/app/services/document-generator.service.ts` - PDF生成サービスのメインロジック
- `src/app/utils/document-templates/qualification-acquisition.ts` - 資格取得届のテンプレート定義
- `src/app/utils/document-templates/qualification-loss.ts` - 資格喪失届のテンプレート定義
- `src/app/utils/document-templates/bonus-payment.ts` - 賞与支払届のテンプレート定義
- `src/app/utils/document-helpers.ts` - 帳票生成用の共通ヘルパー関数（日付フォーマット、金額フォーマットなど）
- `src/app/pages/documents/document-generation-dialog.component.ts` - 帳票生成ダイアログコンポーネント
- `src/app/pages/documents/document-generation-dialog.component.html` - 帳票生成ダイアログのテンプレート（必要に応じて）

### 8.2 修正ファイル（Phase3-8のMVP）

- `src/app/pages/employees/employee-detail-dialog.component.ts` - 「資格取得届PDF生成」「資格喪失届PDF生成」ボタンの追加
- `src/app/pages/premiums/bonus/bonus-premiums.page.ts` - 「賞与支払届PDF生成」ボタンの追加
- `package.json` - pdfmakeライブラリの追加

### 8.3 将来拡張で追加予定のファイル

- `src/app/utils/document-templates/standard-reward.ts` - 算定基礎届のテンプレート定義（将来拡張）
- `src/app/utils/document-templates/monthly-change.ts` - 月額変更届のテンプレート定義（将来拡張）
- `src/app/utils/document-templates/dependent-change.ts` - 被扶養者異動届のテンプレート定義（将来拡張）
- `src/app/pages/procedures/procedures.page.ts` - 「PDF生成」ボタンの追加、一括PDF生成機能（将来拡張）

### 8.4 依存関係の追加

**npmパッケージ**:
```json
{
  "dependencies": {
    "pdfmake": "^0.2.11"
  }
}
```

**フォントファイル**:
- IPAexフォント（IPAexGothic）を`src/assets/fonts/ipaexg.ttf`に配置

---

## 9. 実装手順（概要）

1. **依存関係の追加**
   - `npm install pdfmake`
   - IPAexフォントファイルを`src/assets/fonts/`に配置

2. **PDF生成サービスの実装**
   - `document-generator.service.ts`を作成
   - pdfmakeの初期化（日本語フォントの登録）
   - 各帳票テンプレートの呼び出しロジック

3. **帳票テンプレートの実装（MVP対象の3種類のみ）**
   - 資格取得届、資格喪失届、賞与支払届のテンプレート定義ファイルを作成
   - データマッピングロジックの実装（標準報酬履歴を優先的に取得するロジックを含む）
   - 共通ヘルパー関数の実装

4. **UIコンポーネントの実装**
   - 帳票生成ダイアログの作成
   - バリデーションロジックの実装（致命的必須／通常必須／任意の3段階分類）
   - 従業員詳細ダイアログへの「資格取得届PDF生成」「資格喪失届PDF生成」ボタンの追加
   - 賞与保険料画面への「賞与支払届PDF生成」ボタンの追加

5. **テスト**
   - MVP対象の3種類の帳票のPDF生成テスト
   - バリデーション（致命的必須／通常必須／任意）のテスト
   - エラーハンドリングのテスト
   - ブラウザでの表示確認

---

以上で Phase3-8 の実装指示書は完了です。

