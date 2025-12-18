# e-Gov 6種類届出に必要な項目の実装状況ギャップ分析

**作成日**: 2025年12月2日  
**最終更新日**: 2025年12月2日（Phase3-7実装完了後）  
**対象**: InsurePath Phase3-7（e-Gov用必要情報の先行実装）

**注意**: このドキュメントはPhase3-7の実装完了後に更新されています。実装済み項目の状態が「既存」に更新されています。

---

## 📋 調査方法

- **型定義**: `src/app/types.ts` を確認
- **フォーム**: 各画面のフォームコンポーネントを確認
- **サービス**: Firestoreへの保存処理を確認
- **Firestoreルール**: `firestore.rules` を確認

---

## 1. 事業所マスタ（offices）

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| office | officePrefCode | 都道府県コード | 部分的に既存 | `kyokaiPrefCode?: string` | 協会けんぽの場合のみ存在。都道府県コードとしての形式は未確認 |
| office | officeCityCode | 郡市区符号 | **既存** | `officeCityCode?: string` | `types.ts:110` Office型。Phase3-7で実装 |
| office | officeSymbol | 事業所記号 | **既存** | `officeSymbol?: string` | `types.ts:108` Office型。Phase3-7で実装 |
| office | officeNumber | 事業所番号 | **既存** | `officeNumber?: string` | `types.ts:109` Office型。Phase3-7で実装 |
| office | officeName | 事業所名称 | **既存** | `name: string` | `types.ts:101` Office型 |
| office | officeOwnerName | 事業主（代表者）氏名 | **既存** | `officeOwnerName?: string` | `types.ts:113` Office型。Phase3-7で実装 |
| office | officePostalCode | 郵便番号（7桁） | **既存** | `officePostalCode?: string` | `types.ts:111` Office型。Phase3-7で実装。7桁数字のみバリデーション |
| office | officeAddressKanji | 所在地（漢字） | **既存** | `address?: string` | `types.ts:102` Office型 |
| office | officeAddressKana | 所在地（カナ） | **不足** | - | 実装なし |
| office | officePhone | 電話番号 | **既存** | `officePhone?: string` | `types.ts:112` Office型。Phase3-7で実装 |
| office | officeSubmissionDestType | 年金事務所／健保組合等の区分 | 部分的に既存 | `healthPlanType: HealthPlanType` | `kyokai` / `kumiai` のみ。より詳細な区分は不足 |

---

## 2. 従業員マスタ（employees）

### 2-1. 識別・基本情報

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| employee | employeeId | InsurePath内部ID | **既存** | `id: string` | `types.ts:203` Employee型 |
| employee | employeeCodeInOffice | 被保険者整理番号／社内従業員番号 | **既存** | `employeeCodeInOffice?: string` | `types.ts:242` Employee型。Phase3-7で実装 |
| employee | nameKanji | 氏名（漢字） | **既存** | `name: string` | `types.ts:232` Employee型 |
| employee | nameKana | 氏名（カナ） | **既存** | `kana?: string` | `types.ts:233` Employee型（任意） |
| employee | dateOfBirth | 生年月日（西暦） | **既存** | `birthDate: IsoDateString` | `types.ts:234` Employee型 |
| employee | sex | 性別コード | **既存** | `sex?: Sex` | `types.ts:243` Employee型。Phase3-7で実装。`'male'` / `'female'` / `'other'` / `null` |
| employee | postalCode | 郵便番号 | **既存** | `postalCode?: string` | `types.ts:244` Employee型。Phase3-7で実装。7桁数字のみバリデーション |
| employee | addressKanji | 住所（漢字） | **既存** | `address?: string` | `types.ts:239` Employee型（任意） |
| employee | addressKana | 住所（カナ） | **既存** | `addressKana?: string` | `types.ts:245` Employee型。Phase3-7で実装 |

### 2-2. 番号系

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| employee | myNumber | 個人番号（マイナンバー・暗号化保存） | **既存** | `myNumber?: string` | `types.ts:263` Employee型。Phase3-7で実装。MyNumberService経由で管理。現時点では簡易実装（プレーン文字列）。本番運用では暗号化必須 |
| employee | basicPensionNumber | 基礎年金番号 | 部分的に既存 | `pensionNumber?: string` | `types.ts:262` Employee型。課所符号＋一連番号への分解対応は未確認 |
| employee | cannotUseResidenceAddressReason | 住民票住所を使えない理由コード | **不足** | - | 実装なし |
| employee | personalNumberNote | 個人番号関連の備考 | **不足** | - | 実装なし |

### 2-3. 就業・資格区分

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| employee | employmentStartDate | 入社日 | **既存** | `hireDate: IsoDateString` | `types.ts:209` Employee型 |
| employee | insuredCategory | 一般／短時間／70歳以上等の被保険者区分 | 部分的に既存 | `isInsured: boolean` | `types.ts:226` Employee型。短時間労働者・70歳以上の区分は不足 |

---

## 3. 被扶養者マスタ（dependents）

### 3-1. 識別・基本情報

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| dependent | dependentId | 内部ID | **既存** | `id: string` | `types.ts:144` Dependent型 |
| dependent | dependentNameKanji | 被扶養者氏名（漢字） | **既存** | `name: string` | `types.ts:167` Dependent型 |
| dependent | dependentNameKana | 被扶養者氏名（カナ） | **既存** | `kana?: string` | `types.ts:168` Dependent型。Phase3-7で実装 |
| dependent | dependentDateOfBirth | 生年月日 | **既存** | `dateOfBirth: IsoDateString` | `types.ts:174` Dependent型 |
| dependent | dependentSex | 性別 | **既存** | `sex?: Sex` | `types.ts:169` Dependent型。Phase3-7で実装。`'male'` / `'female'` / `'other'` / `null` |

### 3-2. 番号・続柄・居住

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| dependent | dependentMyNumber | 被扶養者の個人番号（マイナンバー） | **既存** | `myNumber?: string` | `types.ts:175` Dependent型。Phase3-7で実装。MyNumberService経由で管理。現時点では簡易実装（プレーン文字列）。本番運用では暗号化必須 |
| dependent | relationshipToInsured | 続柄（子／配偶者／父母等） | **既存** | `relationship: DependentRelationship` | `types.ts:173` Dependent型。`spouse`/`child`/`parent`/`grandparent`/`sibling`/`other` |
| dependent | cohabitationFlag | 同居／別居 1/2等 | **既存** | `cohabitationFlag?: CohabitationFlag` | `types.ts:172` Dependent型。Phase3-7で実装。`'cohabiting'` / `'separate'` / `null` |
| dependent | dependentPostalCode | 郵便番号 | **既存** | `postalCode?: string` | `types.ts:170` Dependent型。Phase3-7で実装。7桁数字のみバリデーション |
| dependent | dependentAddress | 住所 | **既存** | `address?: string` | `types.ts:171` Dependent型。Phase3-7で実装 |

### 3-3. 要件判定

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| dependent | dependentAnnualIncome | 年間収入額 | **不足** | - | 実装なし |
| dependent | livelihoodSupportRelation | 生計維持関係の区分 | **不足** | - | 実装なし |
| dependent | domesticResidenceFlag | 国内居住かどうか／例外該当か | **不足** | - | 実装なし |
| dependent | otherCoverageFlags | 他制度への加入有無等（任意） | **不足** | - | 実装なし |

---

## 4. 手続きレコード共通（procedures 共通メタ）

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| procedure | procedureId | 内部ID | **既存** | `id: string` | `types.ts:50` SocialInsuranceProcedure型 |
| procedure | procedureType | 種別 | **既存** | `procedureType: ProcedureType` | `types.ts:52` SocialInsuranceProcedure型。6種類に対応 |
| procedure | officeId | 紐づく事業所 | **既存** | `officeId: string` | `types.ts:51` SocialInsuranceProcedure型 |
| procedure | employeeId | 紐づく従業員 | **既存** | `employeeId: string` | `types.ts:53` SocialInsuranceProcedure型 |
| procedure | dependentId | 対象被扶養者（必要な場合のみ） | **既存** | `dependentId?: string` | `types.ts:54` SocialInsuranceProcedure型 |
| procedure | createdAt, updatedAt | 作成日時／更新日時 | **既存** | `createdAt?: IsoDateString`, `updatedAt?: IsoDateString` | `types.ts:61-62` SocialInsuranceProcedure型 |
| procedure | createdByUserId, updatedByUserId | 作成者／更新者 | **既存** | `createdByUserId?: string`, `updatedByUserId?: string` | `types.ts:63-64` SocialInsuranceProcedure型 |
| procedure | eGovStatus | e-Gov連携ステータス | **不足** | - | 実装予定なし（e-Gov CSV生成機能は実装しない方針） |
| procedure | notes | 共通の備考 | **既存** | `note?: string` | `types.ts:60` SocialInsuranceProcedure型 |

---

## 5. 手続きタイプ別のコア項目

### 5-1. 資格取得届（qualification_acquisition）

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| procedure:qualification_acquisition | qualificationAcquiredDate | 資格取得年月日 | 部分的に既存 | `incidentDate: string` | `types.ts:55` SocialInsuranceProcedure型。`incidentDate`として共通化されている |
| procedure:qualification_acquisition | qualificationType | 資格取得の区分 | 部分的に既存 | `employee.healthQualificationKind?: InsuranceQualificationKind` | 従業員マスタ側に存在。手続きレコード側には不足 |
| procedure:qualification_acquisition | hasDependentsAtAcquisition | 資格取得時点で被扶養者がいるか | **不足** | - | 実装なし |
| procedure:qualification_acquisition | baseMonthlyWageAtAcquisition | 通貨による報酬額 | 部分的に既存 | `employee.monthlyWage: number` | 従業員マスタ側に存在。取得時点のスナップショットは不足 |
| procedure:qualification_acquisition | inKindWageAtAcquisition | 現物による報酬額 | **不足** | - | 実装なし |
| procedure:qualification_acquisition | totalWageAtAcquisition | 上記合計 | **不足** | - | 実装なし |
| procedure:qualification_acquisition | needEligibilityCertificate | 資格確認書発行要否 | **不足** | - | 実装なし |
| procedure:qualification_acquisition | onlySeventyPlusForm | 70歳以上被用者届のみ提出フラグ | **不足** | - | 実装なし |
| procedure:qualification_acquisition | qualificationNotes | 備考 | **既存** | `note?: string` | `types.ts:60` SocialInsuranceProcedure型 |

---

### 5-2. 資格喪失届（qualification_loss）

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| procedure:qualification_loss | lossDate | 資格喪失年月日 | 部分的に既存 | `incidentDate: string` | `types.ts:55` SocialInsuranceProcedure型。`incidentDate`として共通化されている |
| procedure:qualification_loss | lossReasonCode | 喪失（不該当）原因コード | 部分的に既存 | `employee.healthLossReasonKind?: InsuranceLossReasonKind` | 従業員マスタ側に存在。手続きレコード側には不足 |
| procedure:qualification_loss | retirementOrDeathDate | 退職日／死亡日 | 部分的に既存 | `employee.retireDate?: IsoDateString` | 従業員マスタ側に存在。手続きレコード側には不足 |
| procedure:qualification_loss | multiEmployerFlag | 二以上事業所勤務者の喪失 | **不足** | - | 実装なし |
| procedure:qualification_loss | reEmploymentFlag | 退職後の継続再雇用者の喪失 | **不足** | - | 実装なし |
| procedure:qualification_loss | seventyNotApplicableFlag | 70歳不該当 | **不足** | - | 実装なし |
| procedure:qualification_loss | seventyNotApplicableDate | 不該当年月日 | **不足** | - | 実装なし |
| procedure:qualification_loss | eligibilityCertificateCollectedCount | 資格確認書回収枚数 | **不足** | - | 実装なし |
| procedure:qualification_loss | eligibilityCertificateUnreturnedCount | 返不能枚数 | **不足** | - | 実装なし |
| procedure:qualification_loss | postRetirementPostalCode | 退職後住所の郵便番号 | **不足** | - | 実装なし |
| procedure:qualification_loss | postRetirementAddress | 退職後住所 | **不足** | - | 実装なし |
| procedure:qualification_loss | lossNotes | 備考 | **既存** | `note?: string` | `types.ts:60` SocialInsuranceProcedure型 |

---

### 5-3. 算定基礎届（santei / standard_reward）

**注意**: InsurePathでは `procedureType` が `'standard_reward'` として定義されているが、理想モデルでは `'santei'` としている。実装では `'standard_reward'` を使用。

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| procedure:standard_reward | applicableYearMonth | 算定基礎の適用年月 | 部分的に既存 | `incidentDate: string` | `types.ts:55` SocialInsuranceProcedure型。年月のみの形式は未確認 |
| procedure:standard_reward | prevStandardRemunerationHealth | 従前の標準報酬月額（健保） | 部分的に既存 | `employee.healthStandardMonthly?: number` | 従業員マスタ側に存在。手続きレコード側には不足 |
| procedure:standard_reward | prevStandardRemunerationPension | 従前の標準報酬月額（厚年） | 部分的に既存 | `employee.pensionStandardMonthly?: number` | 従業員マスタ側に存在。手続きレコード側には不足 |
| procedure:standard_reward | prevRevisionYearMonth | 従前の改定月 | 部分的に既存 | `StandardRewardHistory.appliedFromYearMonth` | `types.ts:192` StandardRewardHistory型。手続きレコード側には不足 |
| procedure:standard_reward | aprilBaseDays, aprilCashWage, aprilInKindWage, aprilTotalWage | 4月の基礎日数・賃金 | **不足** | - | 実装なし |
| procedure:standard_reward | mayBaseDays, mayCashWage, mayInKindWage, mayTotalWage | 5月の基礎日数・賃金 | **不足** | - | 実装なし |
| procedure:standard_reward | juneBaseDays, juneCashWage, juneInKindWage, juneTotalWage | 6月の基礎日数・賃金 | **不足** | - | 実装なし |
| procedure:standard_reward | seventySanteiMonth | 70歳算定基礎月 | **不足** | - | 実装なし |
| procedure:standard_reward | santeiNotes | 備考 | **既存** | `note?: string` | `types.ts:60` SocialInsuranceProcedure型 |

---

### 5-4. 月額変更届（monthly_change）

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| procedure:monthly_change | changeEffectiveMonth | 変更後標準報酬の適用開始月 | 部分的に既存 | `incidentDate: string` | `types.ts:55` SocialInsuranceProcedure型。年月のみの形式は未確認 |
| procedure:monthly_change | wageClosingPeriod | 賃金締切期間 | **不足** | - | 実装なし |
| procedure:monthly_change | wageForm | 賃金形態（月給／日給／時給） | **不足** | - | 実装なし |
| procedure:monthly_change | hasFixedWageChange | 固定的賃金の変動があったか | **不足** | - | 実装なし |
| procedure:monthly_change | changeReasonCode | 昇給／降給／手当追加等 | **不足** | - | 実装なし |
| procedure:monthly_change | changeReasonDetail | 理由の詳細（コメント） | **不足** | - | 実装なし |
| procedure:monthly_change | prevMonthlyWage | 変更前報酬月額 | 部分的に既存 | `StandardRewardHistory`から取得可能 | 履歴から推測可能だが、手続きレコード側には不足 |
| procedure:monthly_change | prevStandardRemuneration | 変更前標準報酬月額 | 部分的に既存 | `StandardRewardHistory`から取得可能 | 履歴から推測可能だが、手続きレコード側には不足 |
| procedure:monthly_change | newMonthlyWage | 変更後報酬月額 | 部分的に既存 | `employee.monthlyWage: number` | 従業員マスタ側に存在。変更時点のスナップショットは不足 |
| procedure:monthly_change | newStandardRemuneration | 変更後標準報酬月額 | 部分的に既存 | `employee.healthStandardMonthly?: number`, `employee.pensionStandardMonthly?: number` | 従業員マスタ側に存在。変更時点のスナップショットは不足 |
| procedure:monthly_change | monthlyBaseDays1, monthlyWage1 | 変更月の基礎日数・賃金（1ヶ月目） | **不足** | - | 実装なし |
| procedure:monthly_change | monthlyBaseDays2, monthlyWage2 | 変更月の基礎日数・賃金（2ヶ月目） | **不足** | - | 実装なし |
| procedure:monthly_change | monthlyBaseDays3, monthlyWage3 | 変更月の基礎日数・賃金（3ヶ月目） | **不足** | - | 実装なし |
| procedure:monthly_change | monthlyChangeNotes | 備考 | **既存** | `note?: string` | `types.ts:60` SocialInsuranceProcedure型 |

---

### 5-5. 賞与支払届（bonus / bonus_payment）

**注意**: InsurePathでは `procedureType` が `'bonus_payment'` として定義されているが、理想モデルでは `'bonus'` としている。実装では `'bonus_payment'` を使用。

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| procedure:bonus_payment | bonusPaymentDate | 賞与支払年月日 | 部分的に既存 | `incidentDate: string` | `types.ts:55` SocialInsuranceProcedure型。`incidentDate`として共通化されている。実際の賞与データは`BonusPremium.payDate`に存在 |
| procedure:bonus_payment | bonusCashAmount | 通貨による賞与額 | 部分的に既存 | `BonusPremium.grossAmount: number` | `types.ts:353` BonusPremium型。手続きレコード側には不足 |
| procedure:bonus_payment | bonusInKindAmount | 現物による賞与額 | **不足** | - | 実装なし |
| procedure:bonus_payment | bonusTotalAmount | 賞与合計額 | 部分的に既存 | `BonusPremium.grossAmount: number` | `types.ts:353` BonusPremium型。手続きレコード側には不足 |
| procedure:bonus_payment | bonusTimesInYear | 当年の何回目の賞与か | **不足** | - | 実装なし |
| procedure:bonus_payment | seventyPlusFlag | 70歳以上被用者フラグ | **不足** | - | 実装なし |
| procedure:bonus_payment | bonusNotes | 備考 | **既存** | `note?: string` | `types.ts:60` SocialInsuranceProcedure型。`BonusPremium.note`も存在 |

---

### 5-6. 被扶養者（異動）届（dependent_change）

| カテゴリ | 必要フィールド論理名 | CSV上の意味・用途 | 状態 | 実際のInsurePathでのフィールド | 備考 |
|---------|---------------------|------------------|------|------------------------------|------|
| procedure:dependent_change | employeeId | 親の被保険者 | **既存** | `employeeId: string` | `types.ts:53` SocialInsuranceProcedure型 |
| procedure:dependent_change | dependentId | 対象被扶養者 | **既存** | `dependentId?: string` | `types.ts:54` SocialInsuranceProcedure型 |
| procedure:dependent_change | dependentChangeType | 異動の別（該当／非該当／変更等） | **不足** | - | 実装なし |
| procedure:dependent_change | dependentChangeDate | 異動年月日 | 部分的に既存 | `incidentDate: string` | `types.ts:55` SocialInsuranceProcedure型。`incidentDate`として共通化されている |
| procedure:dependent_change | dependentChangeReasonCode | 異動理由コード | **不足** | - | 実装なし |
| procedure:dependent_change | dependentChangeReasonDetail | 異動理由の補足コメント | **不足** | - | 実装なし |
| procedure:dependent_change | dependentAnnualIncome | 年間収入 | **不足** | - | 実装なし |
| procedure:dependent_change | livelihoodSupportRelation | 生計維持関係 | **不足** | - | 実装なし |
| procedure:dependent_change | domesticResidenceFlag | 国内居住かどうか | **不足** | - | 実装なし |
| procedure:dependent_change | cohabitationFlag | 同居／別居 | 部分的に既存 | `dependent.cohabitationFlag?: CohabitationFlag` | 被扶養者マスタ側に存在（Phase3-7で実装）。手続きレコード側には不足。異動時点のスナップショットは不足 |
| procedure:dependent_change | dependentPostalCode | 異動時点の郵便番号 | 部分的に既存 | `dependent.postalCode?: string` | 被扶養者マスタ側に存在（Phase3-7で実装）。手続きレコード側には不足。異動時点のスナップショットは不足 |
| procedure:dependent_change | dependentAddress | 異動時点の住所 | 部分的に既存 | `dependent.address?: string` | 被扶養者マスタ側に存在（Phase3-7で実装）。手続きレコード側には不足。異動時点のスナップショットは不足 |
| procedure:dependent_change | dependentChangeNotes | 備考 | **既存** | `note?: string` | `types.ts:60` SocialInsuranceProcedure型 |

---

## 📊 サマリ

### Phase3-7実装完了後の状況

**Phase3-7で実装された項目**:
- ✅ マイナンバー管理機能（`employee.myNumber`, `dependent.myNumber`）
- ✅ 事業所識別情報（`office.officeSymbol`, `office.officeNumber`, `office.officeCityCode`）
- ✅ 事業所基本情報の拡張（`office.officePostalCode`, `office.officePhone`, `office.officeOwnerName`）
- ✅ 従業員基本情報の拡張（`employee.sex`, `employee.postalCode`, `employee.addressKana`, `employee.employeeCodeInOffice`）
- ✅ 被扶養者情報の拡張（`dependent.kana`, `dependent.sex`, `dependent.postalCode`, `dependent.address`, `dependent.cohabitationFlag`）

### 改善の優先度（e-Gov CSV実装のために追加・整理すべき項目）

#### ✅ Phase3-7で実装完了

1. **マイナンバー管理機能**
   - ✅ `employee.myNumber`（MyNumberService経由で管理、現時点では簡易実装）
   - ✅ `dependent.myNumber`（MyNumberService経由で管理、現時点では簡易実装）
   - ✅ マスキング表示機能（`MyNumberService.mask()`）

2. **事業所識別情報**
   - ✅ `office.officeSymbol`（事業所記号）
   - ✅ `office.officeNumber`（事業所番号）
   - ✅ `office.officeCityCode`（郡市区符号）

3. **事業所基本情報の拡張**
   - ✅ `office.officePostalCode`（郵便番号、7桁数字のみバリデーション）
   - ✅ `office.officePhone`（電話番号）
   - ✅ `office.officeOwnerName`（事業主氏名）

4. **従業員基本情報の拡張**
   - ✅ `employee.sex`（性別コード、`Sex`型）
   - ✅ `employee.postalCode`（郵便番号、7桁数字のみバリデーション）
   - ✅ `employee.addressKana`（住所カナ）
   - ✅ `employee.employeeCodeInOffice`（被保険者整理番号）

5. **被扶養者情報の拡張（最低限）**
   - ✅ `dependent.kana`（被扶養者氏名カナ）
   - ✅ `dependent.sex`（性別、`Sex`型）
   - ✅ `dependent.postalCode`（郵便番号、7桁数字のみバリデーション）
   - ✅ `dependent.address`（住所）
   - ✅ `dependent.cohabitationFlag`（同居／別居フラグ、`CohabitationFlag`型）

#### 🟡 中優先度（将来の拡張候補）

6. **基礎年金番号の整理**
   - `employee.basicPensionNumber`の形式確認・分解対応（課所符号＋一連番号）

7. **被扶養者情報の詳細判定項目**
   - `dependent.dependentAnnualIncome`（年間収入）
   - `dependent.livelihoodSupportRelation`（生計維持関係）
   - `dependent.domesticResidenceFlag`（国内居住フラグ）

8. **手続きレコードの拡張（手続きタイプ別）**
   - 資格取得届: `qualificationType`, `hasDependentsAtAcquisition`, `baseMonthlyWageAtAcquisition`, `inKindWageAtAcquisition`, `totalWageAtAcquisition`
   - 資格喪失届: `lossReasonCode`, `retirementOrDeathDate`, `multiEmployerFlag`, `reEmploymentFlag`, `postRetirementPostalCode`, `postRetirementAddress`
   - 算定基礎届: `prevStandardRemunerationHealth`, `prevStandardRemunerationPension`, `aprilBaseDays`〜`juneTotalWage`（4〜6月の基礎日数・賃金）
   - 月額変更届: `changeReasonCode`, `changeReasonDetail`, `prevMonthlyWage`, `prevStandardRemuneration`, `newMonthlyWage`, `newStandardRemuneration`, `monthlyBaseDays1`〜`monthlyWage3`
   - 賞与支払届: `bonusCashAmount`, `bonusInKindAmount`, `bonusTotalAmount`, `bonusTimesInYear`
   - 被扶養者異動届: `dependentChangeType`, `dependentChangeReasonCode`, `dependentChangeReasonDetail`, `dependentAnnualIncome`, `livelihoodSupportRelation`, `cohabitationFlag`

#### 🟢 中優先度（余裕があれば後回しでもいい項目）

9. **従業員の被保険者区分の詳細化**
   - `employee.insuredCategory`（一般／短時間／70歳以上等）

10. **事業所の提出先区分の詳細化**
    - `office.officeSubmissionDestType`（年金事務所／健保組合等の詳細区分）

11. **その他の任意項目**
    - `employee.cannotUseResidenceAddressReason`（住民票住所を使えない理由）
    - `employee.personalNumberNote`（個人番号関連の備考）
    - `dependent.otherCoverageFlags`（他制度への加入有無）

12. **事業所の所在地カナ**
    - `office.officeAddressKana`（所在地カナ）

---

## 📝 実装方針の推奨

### Phase3-7での実装範囲（実装完了）

1. ✅ **必須項目（最高優先度）**: マイナンバー管理、事業所識別情報、事業所基本情報拡張、従業員基本情報拡張
2. ✅ **可能な範囲で**: 被扶養者情報の拡張（最低限、カナ・性別・住所・郵便番号・同居別居フラグ）

**実装状況**: Phase3-7の実装は完了しています。詳細は `PHASE3-7_ADDED_FIELDS.md` を参照してください。

### 将来の拡張候補（実装予定なし）

以下の項目は、現時点では実装予定がありませんが、将来の拡張候補として記載します：

1. **手続きレコードの拡張**: 各手続きタイプごとの固有フィールドを追加
2. **e-Gov CSV生成ロジック**: CSV生成機能自体の実装（本システムは e-Gov への直接送信や CSV 出力は行わない方針）
3. **マイナンバーの暗号化実装**: 本番運用での必須実装（MyNumberServiceの暗号化処理）

### データ整合性の考慮

- 既存の`incidentDate`を各手続きタイプの日付フィールドとして活用するか、別フィールドを追加するかは設計判断が必要
- 従業員マスタ側の情報（`employee.monthlyWage`等）を手続きレコードにスナップショットとして保存するか、参照するかは設計判断が必要
- `BonusPremium`と`SocialInsuranceProcedure`の連携方法を検討（手続きレコードから賞与データを参照する仕組み）

---

## 📌 Phase3-7実装後の主な変更点

### 実装完了した項目

**事業所マスタ**:
- ✅ `officeSymbol`, `officeNumber`, `officeCityCode`（事業所識別情報）
- ✅ `officePostalCode`, `officePhone`, `officeOwnerName`（事業所基本情報）

**従業員マスタ**:
- ✅ `employeeCodeInOffice`（被保険者整理番号）
- ✅ `sex`（性別コード、`Sex`型）
- ✅ `postalCode`（郵便番号、7桁数字のみバリデーション）
- ✅ `addressKana`（住所カナ）
- ✅ `myNumber`（マイナンバー、MyNumberService経由で管理）

**被扶養者マスタ**:
- ✅ `kana`（被扶養者氏名カナ）
- ✅ `sex`（性別コード、`Sex`型）
- ✅ `postalCode`（郵便番号、7桁数字のみバリデーション）
- ✅ `address`（住所）
- ✅ `cohabitationFlag`（同居／別居フラグ、`CohabitationFlag`型）
- ✅ `myNumber`（マイナンバー、MyNumberService経由で管理）

### 追加されたサービス・型

- ✅ `MyNumberService`（マイナンバー管理サービス）
- ✅ `Sex`型エイリアス（`'male' | 'female' | 'other' | null`）
- ✅ `CohabitationFlag`型エイリアス（`'cohabiting' | 'separate' | null`）

### 残っている不足項目

**事業所マスタ**:
- ❌ `officeAddressKana`（所在地カナ）

**従業員マスタ**:
- ⚠️ `basicPensionNumber`（基礎年金番号の分解対応は未実装）

**被扶養者マスタ**:
- ❌ `dependentAnnualIncome`（年間収入）
- ❌ `livelihoodSupportRelation`（生計維持関係）
- ❌ `domesticResidenceFlag`（国内居住フラグ）

**手続きレコード**:
- ❌ 各手続きタイプごとの固有フィールド（実装予定なし）
- ❌ `eGovStatus`（e-Gov連携ステータス、実装予定なし。e-Gov CSV生成機能は実装しない方針）

---

以上で、e-Gov 6種類届出に必要な項目の実装状況ギャップ分析は完了です。

**参考**: Phase3-7で追加された項目の詳細は `PHASE3-7_ADDED_FIELDS.md` を参照してください。

