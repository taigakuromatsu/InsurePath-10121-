# 従業員台帳 CSVエクスポート・インポート・テンプレート項目の現状まとめ

**最終更新日**: 2025年1月（v2列定義実装完了時点）

## 1. 入力フォーム（employee-form-dialog.component.ts）の項目

### 基本情報
- 氏名 (name) - 必須
- カナ (kana) - 必須
- 生年月日 (birthDate) - 必須
- 所属 (department)
- 入社日 (hireDate) - 必須
- 退社日 (retireDate)
- 住所 (address)
- 電話番号 (phone)
- 連絡先メール (contactEmail)
- 社員番号 (employeeCodeInOffice)
- 性別 (sex)
- 郵便番号 (postalCode)
- 住所カナ (addressKana)
- マイナンバー (myNumber) - セキュリティ上CSVには含めない

### 就労条件
- 雇用形態 (employmentType) - 必須
- 所定労働時間（週） (weeklyWorkingHours)
- 所定労働日数（週） (weeklyWorkingDays)
- 雇用契約期間の見込み (contractPeriodNote)
- 学生 (isStudent)

### 社会保険関連
- 社会保険対象 (isInsured)
- 支給形態 (payrollPayType) - payrollSettings.payType
- 支給サイクル (payrollPayCycle) - payrollSettings.payCycle
- 報酬月額（円） (payrollInsurableMonthlyWage) - payrollSettings.insurableMonthlyWage
- 健康保険等級 (healthGrade) - 標準報酬履歴で管理（表示のみ）
- 健康保険標準報酬月額 (healthStandardMonthly) - 標準報酬履歴で管理（表示のみ）
- 厚生年金等級 (pensionGrade) - 標準報酬履歴で管理（表示のみ）
- 厚生年金標準報酬月額 (pensionStandardMonthly) - 標準報酬履歴で管理（表示のみ）
- 被保険者記号 (healthInsuredSymbol)
- 被保険者番号 (healthInsuredNumber)
- 厚生年金番号 (pensionNumber)
- 補足メモ（給与情報） (payrollNote) - payrollSettings.note

### 給与振込口座情報
- 金融機関名 (bankAccountBankName)
- 金融機関コード (bankAccountBankCode)
- 支店名 (bankAccountBranchName)
- 支店コード (bankAccountBranchCode)
- 口座種別 (bankAccountAccountType)
- 口座番号 (bankAccountAccountNumber)
- 名義 (bankAccountHolderName)
- 名義カナ (bankAccountHolderKana)
- 主口座フラグ (bankAccount.isMain)

### 資格情報（健康保険）
- 資格取得日（健保） (healthQualificationDate)
- 資格取得区分（健保） (healthQualificationKind)
- 資格喪失日（健保） (healthLossDate)
- 喪失理由区分（健保） (healthLossReasonKind)

### 資格情報（厚生年金）
- 資格取得日（厚年） (pensionQualificationDate)
- 資格取得区分（厚年） (pensionQualificationKind)
- 資格喪失日（厚年） (pensionLossDate)
- 喪失理由区分（厚年） (pensionLossReasonKind)

### 就業状態
- 現在の就業状態 (workingStatus)
- 就業状態メモ (workingStatusNote)
- 産前産後・育児休業の免除月（月次保険料用） (premiumExemptionMonths) - 配列項目

---

## 2. CSVインポート/エクスポート（csv-column-definitions.ts v2列定義）の項目

### ✅ 実装済み項目（v2列定義）

#### 基本情報
- ID (id)
- 氏名 (name) - 必須
- フリガナ (kana) - 必須
- 生年月日 (birthDate) - 必須
- 所属 (department)
- 住所 (address)
- 電話番号 (phone)
- メールアドレス (contactEmail)
- **社員番号** (employeeCodeInOffice) ✅ **実装済み**
- **性別** (sex) ✅ **実装済み**
- **郵便番号** (postalCode) ✅ **実装済み**
- **住所カナ** (addressKana) ✅ **実装済み**
- 入社日 (hireDate) - 必須
- 退社日 (retireDate)

#### 就労条件
- 雇用形態 (employmentType) - 必須
- 所定労働時間 (weeklyWorkingHours)
- 所定労働日数 (weeklyWorkingDays)
- 雇用契約期間の見込み (contractPeriodNote)
- 学生 (isStudent)

#### 社会保険関連
- 社会保険加入 (isInsured)
- 就業状態 (workingStatus)
- 就業状態メモ (workingStatusNote)
- 被保険者記号 (healthInsuredSymbol)
- 被保険者番号 (healthInsuredNumber)
- 厚生年金番号 (pensionNumber)

#### 資格情報（健康保険）
- 資格取得日（健保） (healthQualificationDate)
- 資格取得区分（健保） (healthQualificationKind)
- 資格喪失日（健保） (healthLossDate)
- 資格喪失理由（健保） (healthLossReasonKind)

#### 資格情報（厚生年金）
- 資格取得日（年金） (pensionQualificationDate)
- 資格取得区分（年金） (pensionQualificationKind)
- 資格喪失日（年金） (pensionLossDate)
- 資格喪失理由（年金） (pensionLossReasonKind)

#### 標準報酬関連（参照用・インポートでは反映されない）
- 健康保険等級 (healthGrade) - エクスポート時は標準報酬履歴から取得
- 健康保険標準報酬月額 (healthStandardMonthly) - エクスポート時は標準報酬履歴から取得
- 健康保険適用開始年月 - エクスポート時は標準報酬履歴から取得
- 厚生年金等級 (pensionGrade) - エクスポート時は標準報酬履歴から取得
- 厚生年金標準報酬月額 (pensionStandardMonthly) - エクスポート時は標準報酬履歴から取得
- 厚生年金適用開始年月 - エクスポート時は標準報酬履歴から取得

#### 給与基本情報（payrollSettings）
- **報酬月額** (payrollSettings.insurableMonthlyWage) ✅ **実装済み**
- **支給形態** (payrollSettings.payType) ✅ **実装済み**
- **支給サイクル** (payrollSettings.payCycle) ✅ **実装済み**
- **給与メモ** (payrollSettings.note) ✅ **実装済み**

#### 保険料免除月
- **保険料免除月** (premiumExemptionMonths) ✅ **実装済み**
  - 形式: `maternity:2025-01,2025-02;childcare:2025-04`
  - 種別（maternity/childcare）と対象年月（YYYY-MM）をセミコロン区切りで複数指定可能

#### 給与振込口座情報（bankAccount）
- **金融機関名** (bankAccount.bankName) ✅ **実装済み**
- **金融機関コード** (bankAccount.bankCode) ✅ **実装済み**
- **支店名** (bankAccount.branchName) ✅ **実装済み**
- **支店コード** (bankAccount.branchCode) ✅ **実装済み**
- **口座種別** (bankAccount.accountType) ✅ **実装済み**
- **口座番号** (bankAccount.accountNumber) ✅ **実装済み**
- **名義** (bankAccount.accountHolderName) ✅ **実装済み**
- **名義カナ** (bankAccount.accountHolderKana) ✅ **実装済み**
- **主口座フラグ** (bankAccount.isMain) ✅ **実装済み**

#### 廃止予定項目（後方互換用エイリアス）
- **標準報酬月額** (monthlyWage) - deprecated、エクスポートには含めない、インポートでは無視

---

## 3. 実装状況のまとめ

### ✅ 実装完了項目

**v2列定義で実装済み（入力フォームとCSVの両方で対応）:**

1. ✅ 社員番号
2. ✅ 性別
3. ✅ 郵便番号
4. ✅ 住所カナ
5. ✅ 支給形態
6. ✅ 支給サイクル
7. ✅ 報酬月額（給与基本情報）
8. ✅ 補足メモ（給与情報）
9. ✅ 金融機関名
10. ✅ 金融機関コード
11. ✅ 支店名
12. ✅ 支店コード
13. ✅ 口座種別
14. ✅ 口座番号
15. ✅ 名義
16. ✅ 名義カナ
17. ✅ 主口座フラグ
18. ✅ 産前産後・育児休業の免除月（配列項目をCSV形式で対応）

### ⚠️ セキュリティ上の理由でCSVに含めない項目

1. **マイナンバー** (myNumber)
   - セキュリティ上の理由により、CSVエクスポート/インポートには含めない
   - 入力フォームでは暗号化して保存
   - CSV列定義のコメントにも明記されている

### 📋 システム自動設定項目（CSVに含めない）

1. **作成日時** (createdAt) - システム自動設定
2. **更新日時** (updatedAt) - システム自動設定

### 📌 標準報酬関連の扱い

- **標準報酬は「標準報酬履歴」で管理**
- CSVの標準報酬関連列（健康保険等級、健康保険標準報酬月額、健康保険適用開始年月、厚生年金等級、厚生年金標準報酬月額、厚生年金適用開始年月）は**参照用**で、インポートでは反映されない
- エクスポート時は、現在有効な標準報酬履歴から値を取得して出力
- テンプレートCSVのコメントにも説明が記載されている

---

## 4. CSVフォーマット仕様（v2）

### データ形式

- **日付**: YYYY-MM-DD 形式（例: 2024-04-01）
- **年月**: YYYY-MM 形式（例: 2025-01）
- **数値**: 整数または小数（例: 40.0, 1000000）
  - カンマ区切りは使用不可（例: 1,000,000 は無効。1000000 と入力）
  - 金融機関コード/支店コード/口座番号は先頭0が落ちやすいため注意（Excelで数値として扱われると先頭0が消えます）
- **真偽値**: true / false（小文字）
  - 学生、社会保険加入、主口座フラグに使用
- **保険料免除月**: `maternity:2025-01,2025-02;childcare:2025-04`
  - 形式: `kind:YYYY-MM,YYYY-MM;kind:YYYY-MM`
  - kindはmaternity（産前産後）またはchildcare（育児）

### 選択肢の入力値

- **雇用形態**: regular(正社員) / contract(契約社員) / part(パート) / アルバイト / other(その他)
- **性別**: male(男) / female(女) / other(その他)
- **資格取得区分**: new_hire(新規採用) / expansion(適用拡大) / hours_change(所定労働時間変更) / other(その他)
- **資格喪失理由**: retirement(退職) / death(死亡) / age_75(75歳到達) / disability(障害認定) / social_security_agreement(社会保障協定)
- **就業状態**: normal(通常勤務) / maternity_leave(産前産後休業) / childcare_leave(育児休業)
- **支給形態**: monthly(月給) / daily(日給) / hourly(時給) / annual(年俸) / other(その他)
- **支給サイクル**: monthly(月次) / twice_per_month(月2回) / weekly(週次) / other(その他)
- **口座種別**: ordinary(普通) / checking(当座) / savings(貯蓄) / other(その他)

### セルの入力ルール

- **空欄**: 変更しません（更新インポート時のみ有効。新規作成時は必須項目を入力してください）
- **値あり**: その値に更新します
- **__CLEAR__**: その項目を削除します（Firestoreからフィールドを削除）
- **注意**: 必須項目（氏名/フリガナ/生年月日/入社日/雇用形態）は更新時でも__CLEAR__できません

### ネストオブジェクトの削除（口座情報・給与情報）

- **口座情報を削除**: 口座情報に関連する全列（金融機関名/金融機関コード/支店名/支店コード/口座種別/口座番号/名義/名義カナ/主口座フラグ）のすべてに__CLEAR__を入力
- **給与情報を削除**: 給与情報に関連する全列（報酬月額/支給形態/支給サイクル/給与メモ）のすべてに__CLEAR__を入力
- **注意**: 一部の列だけに__CLEAR__を入力した場合、オブジェクト全体は削除されず、該当フィールドのみが削除されます（Firestoreからフィールドを削除）

---

## 5. 実装完了状況

### ✅ 完了した項目

**v2列定義（csv-column-definitions.ts）で実装完了:**

- ✅ 入力フォームの全項目がCSVに対応済み（マイナンバーを除く）
- ✅ 給与基本情報（payrollSettings）の全項目がCSVに対応済み
- ✅ 給与振込口座情報（bankAccount）の全項目がCSVに対応済み
- ✅ 保険料免除月（premiumExemptionMonths）がCSV形式で対応済み
- ✅ 標準報酬関連項目は参照用として実装済み（インポートでは無視、エクスポート時は履歴から取得）
- ✅ 廃止予定項目（標準報酬月額）は後方互換用エイリアスとして実装済み

### 📝 実装ファイル

- **CSV列定義**: `src/app/utils/csv-column-definitions.ts`
- **CSVインポート**: `src/app/utils/csv-import.service.ts`
- **CSVエクスポート**: `src/app/utils/csv-export.service.ts`
- **入力フォーム**: `src/app/pages/employees/employee-form-dialog.component.ts`

---

## 6. 注意事項

### 標準報酬関連

- 標準報酬は「標準報酬履歴」で管理します
- CSVの標準報酬関連列（健康保険等級、健康保険標準報酬月額、健康保険適用開始年月、厚生年金等級、厚生年金標準報酬月額、厚生年金適用開始年月）は参照用で、インポートでは反映されません
- エクスポート時は、現在有効な標準報酬履歴から値を取得して出力します
- 標準報酬履歴の編集は、従業員フォームの「標準報酬履歴を開く」ボタンから行います

### マイナンバー

- セキュリティ上の理由により、CSVエクスポート/インポートには含めません
- 入力フォームでは暗号化して保存されます
- CSV列定義のコメントにも明記されています

### 必須項目

- **新規作成時**: 氏名、フリガナ、生年月日、入社日、雇用形態が必須
- **更新時**: 必須項目は__CLEAR__できません
- **部分入力時の必須ルール**:
  - 口座情報: 何か1つでも入力したら、金融機関名/支店名/口座種別/口座番号/名義が必須
  - 給与情報: 何か1つでも入力したら（報酬月額だけでも）、支給形態/支給サイクルが必須（新規作成時）

---

## 7. 次のステップ（将来の拡張）

現在の実装状況では、入力フォームとCSVの項目は完全に一致しています（マイナンバーを除く）。

将来の拡張として検討可能な項目：

1. 標準報酬履歴のCSVエクスポート/インポート機能
2. 扶養家族情報のCSVエクスポート/インポート機能
3. その他の拡張項目の追加

