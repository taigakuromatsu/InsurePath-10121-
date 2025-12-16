# 従業員台帳 CSVエクスポート・インポート・テンプレート項目の現状まとめ

## 1. 入力フォーム（employee-form-dialog.component.ts）の項目

### 基本情報
- 氏名 (name) - 必須
- カナ (kana) - 必須
- 生年月日 (birthDate) - 必須
- 所属 (department)
- 入社日 (hireDate)
- 退社日 (retireDate)
- 住所 (address)
- 電話番号 (phone)
- 連絡先メール (contactEmail)
- 社員番号 (employeeCodeInOffice)
- 性別 (sex)
- 郵便番号 (postalCode)
- 住所カナ (addressKana)
- マイナンバー (myNumber)

### 就労条件
- 雇用形態 (employmentType)
- 所定労働時間（週） (weeklyWorkingHours)
- 所定労働日数（週） (weeklyWorkingDays)
- 雇用契約期間の見込み (contractPeriodNote)
- 学生 (isStudent)

### 社会保険関連
- 社会保険対象 (isInsured)
- 支給形態 (payrollPayType)
- 支給サイクル (payrollPayCycle)
- 報酬月額（円） (payrollInsurableMonthlyWage)
- 健康保険等級 (healthGrade)
- 健康保険標準報酬月額 (healthStandardMonthly)
- 厚生年金等級 (pensionGrade)
- 厚生年金標準報酬月額 (pensionStandardMonthly)
- 被保険者記号 (healthInsuredSymbol)
- 被保険者番号 (healthInsuredNumber)
- 厚生年金番号 (pensionNumber)
- 補足メモ（給与情報） (payrollNote)

### 給与振込口座情報
- 金融機関名 (bankAccountBankName)
- 金融機関コード (bankAccountBankCode)
- 支店名 (bankAccountBranchName)
- 支店コード (bankAccountBranchCode)
- 口座種別 (bankAccountAccountType)
- 口座番号 (bankAccountAccountNumber)
- 名義 (bankAccountHolderName)
- 名義カナ (bankAccountHolderKana)

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
- 産前産後・育児休業の免除月（月次保険料用） (premiumExemptionMonths)

---

## 2. CSVインポート/エクスポート（csv-import.service.ts）の項目

### headerMapping で定義されている項目
- ID (id)
- 氏名 (name)
- フリガナ (kana)
- 生年月日 (birthDate)
- 所属 (department)
- 住所 (address)
- 電話番号 (phone)
- メールアドレス (contactEmail)
- 入社日 (hireDate)
- 退職日 (retireDate)
- 雇用形態 (employmentType)
- 所定労働時間 (weeklyWorkingHours)
- 所定労働日数 (weeklyWorkingDays)
- 学生 (isStudent)
- **標準報酬月額 (monthlyWage)** ← 廃止予定項目
- 社会保険加入 (isInsured)
- 健康保険等級 (healthGrade)
- 健康保険標準報酬月額 (healthStandardMonthly)
- 厚生年金等級 (pensionGrade)
- 厚生年金標準報酬月額 (pensionStandardMonthly)
- 就業状態 (workingStatus)
- 作成日時 (createdAt)
- 更新日時 (updatedAt)
- 被保険者記号 (healthInsuredSymbol)
- 被保険者番号 (healthInsuredNumber)
- 厚生年金番号 (pensionNumber)
- 資格取得日（健保） (healthQualificationDate)
- 資格取得区分（健保） (healthQualificationKind)
- 資格喪失日（健保） (healthLossDate)
- 資格喪失理由（健保） (healthLossReasonKind)
- 資格取得日（年金） (pensionQualificationDate)
- 資格取得区分（年金） (pensionQualificationKind)
- 資格喪失日（年金） (pensionLossDate)
- 資格喪失理由（年金） (pensionLossReasonKind)
- 雇用契約期間の見込み (contractPeriodNote)
- 就業状態メモ (workingStatusNote)

---

## 3. 不一致の項目

### ❌ 入力フォームにあるがCSVにない項目
1. **社員番号** (employeeCodeInOffice)
2. **性別** (sex)
3. **郵便番号** (postalCode)
4. **住所カナ** (addressKana)
5. **マイナンバー** (myNumber)
6. **支給形態** (payrollPayType) - payrollSettings.payType
7. **支給サイクル** (payrollPayCycle) - payrollSettings.payCycle
8. **報酬月額（円）** (payrollInsurableMonthlyWage) - payrollSettings.insurableMonthlyWage
9. **補足メモ（給与情報）** (payrollNote) - payrollSettings.note
10. **給与振込口座情報** 全項目（8項目）
   - 金融機関名 (bankAccountBankName)
   - 金融機関コード (bankAccountBankCode)
   - 支店名 (bankAccountBranchName)
   - 支店コード (bankAccountBranchCode)
   - 口座種別 (bankAccountAccountType)
   - 口座番号 (bankAccountAccountNumber)
   - 名義 (bankAccountHolderName)
   - 名義カナ (bankAccountHolderKana)
11. **産前産後・育児休業の免除月** (premiumExemptionMonths) - 配列項目

### ❌ CSVにあるが入力フォームにない項目
1. **標準報酬月額** (monthlyWage) - 廃止予定項目（入力フォームでは使用されていない）
2. **作成日時** (createdAt) - システム自動設定
3. **更新日時** (updatedAt) - システム自動設定

### ⚠️ 注意が必要な項目
- **標準報酬月額 (monthlyWage)**: CSVには存在するが、入力フォームでは `payrollSettings.insurableMonthlyWage` を使用している。CSVの `monthlyWage` は廃止予定項目。

---

## 4. まとめ

### 追加が必要なCSV項目（入力フォームに合わせる）
1. 社員番号
2. 性別
3. 郵便番号
4. 住所カナ
5. マイナンバー
6. 支給形態
7. 支給サイクル
8. 報酬月額（給与基本情報）
9. 補足メモ（給与情報）
10. 金融機関名
11. 金融機関コード
12. 支店名
13. 支店コード
14. 口座種別
15. 口座番号
16. 名義
17. 名義カナ
18. 産前産後・育児休業の免除月（配列項目のため、複数行またはJSON形式での対応が必要）

### 削除または非推奨化が必要なCSV項目
1. 標準報酬月額 (monthlyWage) - 廃止予定項目

### システム自動設定項目（CSVに含めるか検討）
1. 作成日時 (createdAt)
2. 更新日時 (updatedAt)

---

## 5. 次のステップ

1. CSVインポート/エクスポートの項目定義を入力フォームに合わせて更新
2. テンプレートCSVの項目も同様に更新
3. 既存のCSVデータとの互換性を考慮した移行計画の検討
4. 免除月（premiumExemptionMonths）の配列項目のCSV表現方法の決定

