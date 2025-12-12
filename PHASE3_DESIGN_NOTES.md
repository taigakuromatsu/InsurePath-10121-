# Phase3-3: プロフィール変更申請機能の方針メモ（暫定）

**作成日**: 2025年11月30日  
**目的**: Phase3-3で実装した「従業員情報の変更申請・承認（簡易ワークフロー）機能」について、現在の運用方針と将来の設計方針を記録する

---

## 2. 将来の設計方針（ロール別画面＋権限制御の方向性）

今後 Phase4 以降で、以下のように詰めていく方針とする。

### 2.1 ロール別に見える画面をはっきり分ける

#### employee ロール

- 基本的には **`/me`（マイページ）を中心としたシンプルな画面構成**。
- 変更申請はマイページからのみ行う想定。
- これにより、「どこから申請するのか？」が直感的に分かる。

#### admin / hr ロール

- `/dashboard`, `/employees`, `/requests` など、事務担当者向け画面を利用。
- 他人の社員情報の変更は、原則 `/employees` から直接編集するのを基本とする。

### 2.2 自己申請・自己承認の扱い

- **将来の改善案として**、
  - 「`requestedByUserId` と `decidedByUserId` が同じ場合は承認不可」という制約を検討する。
- **実装場所の候補**：
  - Firestore ルールでチェックする
  - もしくは Functions / サービス層でバリデーションする
- ただしこれは **Phase3-3 以降の改善テーマ**とし、今すぐは実装しない。

### 2.3 導線のわかりやすさの強化

#### employee ロールに対して：

- サイドメニューやトップから「マイページ」への導線を強める。
- 「プロフィール変更を申請したい場合はマイページへ」というメッセージやガイドを追加する。

#### admin / hr に対して：

- 「基本は `/employees` から直接編集、それ以外は申請ワークフロー」というルールを
  ヘルプやマニュアルに明記する。

---

## 3. メモとしての扱い

- 上記は「Phase3-3 時点の暫定仕様＋今後の方針」として記録するだけで、
  - 今すぐ Firestore ルールや UI を追加で変更しない。
- ロール別画面構成や権限を本格的に詰めるタイミングで、
  - このメモをベースに「自己承認禁止」や「employee 専用マイページ運用」を正式仕様として組み込む。

---

## 4. 技術的な実装詳細（参考）

### 4.1 現在の実装

- **申請登録**: `ChangeRequestFormDialogComponent`（マイページから開く）
- **申請一覧**: `RequestsPage`（admin/hr専用、`/requests`）
- **申請履歴**: マイページ内のセクション（employee用、`listForUser()`を使用）
- **承認・却下**: `RequestsPage`から実行

### 4.2 Firestoreセキュリティルール

- **create**: 従業員本人のみ作成可能（`employeeId == currentUser().data.employeeId`）
- **read**: admin/hrは全件、employeeは自分の申請のみ
- **update**: admin/hrのみ更新可能（承認・却下）
- **delete**: 許可しない（履歴として保持）

### 4.3 注意事項

- `listForUser()`を使用してクエリで`requestedByUserId`を絞り込む必要がある（Firestoreルールと整合性を保つため）
- submit 2重実行バグは修正済み（`type="submit"`を使用）
- 却下理由の空文字はFirestoreルールで禁止（`rejectReason.size() > 0`）

---

以上




InsurePath Phase3-4 実装メモ
社会保険手続き履歴・期限管理機能（v1 実装範囲と将来拡張方針）
記録日: 2025-12-01

■ 1. 今回の実装ゴール（v1 の確定仕様）

1-1. 対象となる手続きの種類
- InsurePath で扱う社会保険手続きは、保険料算定に直結する主要 6 種類に限定する。
  - 資格取得届（qualification_acquisition）
  - 資格喪失届（qualification_loss）
  - 算定基礎届（standard_reward）
  - 月額変更届（monthly_change）
  - 被扶養者異動届（dependent_change）
  - 賞与支払届（bonus_payment）
- カタログには「InsurePath の手続き履歴は、保険料算定に直結する主要 6 種類のみを対象とする」と明記済み。
- これ以外の細かい届出（例：70 歳到達届 等）は v1 では扱わない。

1-2. データ項目（SocialInsuranceProcedure）
- 手続きごとに、以下の情報を保持する：
  - procedureType: 手続き種別（上記 6 種類）
  - employeeId: 対象従業員 ID（必須）
  - dependentId: 対象被扶養者 ID（被扶養者異動届のみ任意でセット）
  - incidentDate: 事由発生日（入社日・退職日・賞与支払日・被扶養者異動日など）
  - deadline: 法定提出期限の「目安」
  - status: 手続きステータス（not_started / in_progress / submitted / rejected）
  - submittedAt: 実際の提出日（status = submitted のときにセット）
  - assignedPersonName: 担当者名（任意）
  - note: 備考メモ（任意）
  - createdAt / updatedAt / createdByUserId / updatedByUserId（監査用メタデータ）

1-3. 提出期限（deadline）の自動計算ロジック
- utils/procedure-deadline-calculator.ts の calculateDeadline() にて、事由日と手続き種別から
  「代表的なルールに基づく提出期限の目安」を計算する。
- 現行ルール：
  - 資格取得・資格喪失・被扶養者異動・賞与支払
    → incidentDate + 5 日
  - 算定基礎届
    → incidentDate の年の 7 月 10 日
  - 月額変更届
    → 事由月の翌月 10 日
  - 上記以外（将来タイプ追加時）はデフォルトで「事由月の翌月 10 日」
- あくまで「目安」として扱い、画面上から手動で修正できることを明示。
- カタログにも、
  - 「計算は代表的なルールに基づく簡略ロジックとし、ユーザーが手動で修正できる」
  - 「最終的な提出要否・期限判断は事業所側の責任」
  を明記済み。

1-4. フォーム画面（/procedures → ProcedureFormDialogComponent）
- 新規登録時：
  - 手続き種別と事由発生日を入力したタイミングで calculateDeadline() を呼び出し、
    deadline に目安値を自動セット。
- 編集時：
  - 既存の deadline 値を尊重してそのまま表示する。
  - ユーザーが「事由発生日」または「手続き種別」を変更した場合のみ、deadline を再計算。
  - それ以外の編集（ステータス変更や備考編集など）では deadline は自動変更しない。
- ステータスごとのバリデーション：
  - procedureType, employeeId, incidentDate, deadline, status は必須。
  - status = submitted のとき only submittedAt を必須にする。
  - procedureType = dependent_change のとき only dependentId を必須にする。

1-5. 一覧画面（/procedures → ProceduresPage）
- admin / hr ロールのみアクセス可能。サイドメニュー「手続き履歴」から遷移。
- 手続き一覧を表形式で表示し、以下のフィルタを提供：
  - ステータス（すべて／未着手／準備中／提出済／差戻し）
  - 期限状態（すべて／期限が近い［7 日以内］／期限切れ）
  - 手続き種別（6 種類＋すべて）
- 「期限が近い」「期限切れ」は未完了ステータス（未着手／準備中／差戻し）のみを対象とする。
- deadline ＜ 今日 かつ 未完了のレコードは「期限切れ」として強調表示（赤色＋太字）。
- dependent_change の場合は「従業員名／被扶養者名」の形式で対象者を表示。
- レコードは admin / hr が手動で追加・編集・削除できる。

1-6. 権限・セキュリティ
- Firestore.rules では offices/{officeId}/procedures に対して：
  - read: belongsToOffice(officeId) かつ isAdminOrHr(officeId)
  - create/update/delete: belongsToOffice(officeId) かつ isAdminOrHr(officeId)
- 一般従業員（employee ロール）は現時点では /procedures を閲覧不可。
  - 将来、本人用の閲覧 UI を用意する場合は別ルート／別ビューで対応する前提。


■ 2. 今回は実装しないが、カタログに残した将来拡張

2-1. イベントからの「手続き作成候補」自動生成
- 対象イベント：
  - 入社（Employee 作成・資格取得日セット）
  - 退職（retireDate セット）
  - 標準報酬決定・改定（StandardRewardHistory 作成）
  - 賞与支給（BonusPremium 作成）
  - 被扶養者の追加／削除（Dependents 作成・qualificationAcquiredDate／LossDate セット）
- 将来案：
  - 上記イベントが登録されたタイミングで、対応する手続きレコード案を「ドラフト」として生成する。
  - ドラフトは status = not_started かつ isDraft フラグ（もしくは別フィールド）を持つイメージ。
  - 人事担当者（admin / hr）が /procedures 画面から内容を確認し、
    「確定（正式登録）」「不要（ドラフト削除）」を選択できるようにする。
- 現バージョンでは、自動生成は実装せず、
  「人事担当者が必要に応じて手続きレコードを手動登録する」という運用で落ち着く。

2-2. 簡易カレンダー形式での可視化
- 現状：
  - 期限一覧は表形式（テーブル）で提供し、
    「期限が近い」「期限切れ」の絞り込みとステータス／種別フィルタで管理する。
- 将来案：
  - カレンダー（月表示）やタイムライン式の UI に procedures.deadline をプロットし、
    一目で「今月の提出ラッシュ」「遅延中手続き」が把握できるビューを追加する。
  - ダッシュボード／通知機能とも連携し、「今週提出期限の手続き」をホーム画面にダイジェスト表示する。

2-3. 提出期限ロジックのカスタマイズ
- 現在：
  - calculateDeadline() は画一的な簡易ルール（事由日＋5日、7月10日、翌月10日）で計算するのみ。
- 将来案：
  - Office 単位で「自社運用ルール」を設定できるようにする（例：＋3日, ＋7日 など）。
  - 健康保険の種類（協会けんぽ／組合）や事務所コードに応じて、
    デフォルトの目安を切り替える余地を残しておく。
  - ただし、最終判断はユーザー側の責任である前提は維持する。

■ 3. まとめ（Phase3-4 の前提として扱うこと）

- Phase3-4 では、
  - 「社会保険手続き履歴の手動登録・編集・削除」
  - 「事由日・種別からの提出期限目安の自動計算（簡易ルール＋手動修正可）」
  - 「期限が近い／期限切れの手続き一覧表示とフィルタ」
  を v1 の完成ラインとする。
- イベント連動の自動ドラフト生成とカレンダー UI は、
  カタログ上は【将来拡張案】として明示し、本フェーズの実装対象外とする。
- 今後、Phase4 以降で
  - イベント → 手続きドラフト
  - ダッシュボード／通知との連携
  - カレンダービュー
  の優先度を再検討し、実装範囲を段階的に拡張していく。

以上