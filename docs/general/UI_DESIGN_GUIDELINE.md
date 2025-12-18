# InsurePath UIデザインガイドライン

## 1. 概要
本ドキュメントは、社会保険管理システム「InsurePath」のUI/UXの一貫性を保ち、開発効率と保守性を高めるためのガイドラインです。
**「既存のビジネスロジックを破壊せず、CSSとHTMLテンプレートの微調整で信頼感のあるUIを実現する」** ことを最優先とします。

## 2. デザイン原則 (Design Principles)

*   **Trustworthy (信頼感):** 金融・個人情報を扱うシステムとして、落ち着いた配色と整列されたレイアウトを採用します。
*   **Opt-in Styling (選択的適用):** グローバルスタイルでの無条件な上書きは避け、専用のクラス（`.dense-form`など）を付与することでスタイルを適用します。これにより、副作用を防ぎます。
*   **Standard Material (標準準拠):** Angular Materialの標準機能を最大限活用し、過度なカスタマイズを避けます。

## 3. 基本スタイル定義 (Visual Foundation)

### カラーパレット
ビジネスライクで落ち着いた配色を定義します。

| 役割 | 色名 | カラーコード | 用途 |
| :--- | :--- | :--- | :--- |
| **Primary** | Deep Navy | `#1A237E` | ヘッダー、主要ボタン、アクティブ状態 |
| **Accent** | Teal | `#009688` | スイッチ、FAB、強調表示（彩度控えめ） |
| **Warn** | Red | `#B00020` | エラー、削除ボタン |
| **Background** | Pale Gray | `#F5F7FA` | アプリケーション全体の背景 |
| **Surface** | White | `#FFFFFF` | カード、サイドナビ、ダイアログの背景 |
| **Text Main** | Dark Grey | `#212121` | 主要テキスト |
| **Text Sub** | Grey | `#757575` | ラベル、補足情報 |

### タイポグラフィ
*   **Font Family:** `Roboto`, `"Noto Sans JP"`, `sans-serif`
*   **Base Size:** `14px` (`.dense-form` 適用時)
*   **Heading:** 明確な階層構造を持たせます。
    *   Page Title: `24px` (Bold)
    *   Section Title: `18px` (Medium)

---

## 4. レイアウトルール

### 全体構造
*   **基本構成:** 上部ヘッダー (Toolbar) + 左サイドナビ (Sidenav) + メインコンテンツ
*   **メインコンテンツ幅:**
    *   最大幅 (`max-width`) を `1366px` 程度に設定し、大型モニターでの間延びを防ぎます。
    *   中央揃え (`margin: 0 auto`)。

### レスポンシブ方針
*   **Desktop (> 960px):** サイドナビ常時表示。テーブル全列表示。
*   **Tablet (600px - 959px):** サイドナビはオーバーレイ（またはアイコン化）。フォームは2列レイアウト。
*   **Mobile (< 600px):** サイドナビはハンバーガーメニュー格納。フォームは1列スタック。テーブルは重要列のみ表示またはリスト形式。

---

## 5. コンポーネント別ガイドライン & 実装ルール

スタイルは原則として**ユーティリティクラス**を付与して適用します。

### A. フォーム (Forms) - Class: `.dense-form`

業務アプリ向けに情報を凝縮し、一覧性を高めたフォームスタイル。

*   **適用方法:** `<form>` タグまたはフォームを含むコンテナに `.dense-form` を付与。
*   **スタイル特徴:**
    *   フォントサイズ: `14px`
    *   フィールドの余白: 標準より少し狭く設定。
    *   外観 (`appearance`): `outline` を推奨（入力エリアが明確なため）。
*   **ラベル:** `mat-label` を必ず使用。

```html
<form class="dense-form" [formGroup]="form">
  <div class="form-row"> <!-- Flexbox等で横並び制御 -->
    <mat-form-field appearance="outline">
      <mat-label>氏名</mat-label>
      <input matInput formControlName="name">
    </mat-form-field>
  </div>
</form>
```

### B. テーブル (Data Tables) - Class: `.admin-table`

大量のデータを視認性高く表示するためのスタイル。

*   **適用方法:** `<table>` またはそのラッパーに `.admin-table` を付与。
*   **スタイル特徴:**
    *   ヘッダー: 背景色 `#FAFAFA` (薄いグレー)、文字太字、固定 (`sticky`)。
    *   行 (`row`): 高さ `48px` (Dense)。
    *   ホバー: マウスオーバー時に行背景色を `#E3F2FD` (薄い青) に変更。
    *   ボーダー: 行の下線のみ表示。

```html
<table mat-table [dataSource]="dataSource" class="admin-table">
  <!-- 列定義 -->
</table>
```

### C. カード (Cards) - Class: `.content-card`

セクションを区切り、情報をまとめるためのコンテナ。

*   **適用方法:** `<mat-card>` に `.content-card` を付与。
*   **スタイル特徴:**
    *   Padding: `24px` (PC), `16px` (SP)。
    *   Header: コンテンツとの境界を明確にする。

---

## 6. SCSS実装サンプル (styles.scss)

以下のCSS変数を定義し、各クラスで利用します。

```scss
/* styles.scss */

:root {
  --app-primary: #1A237E;
  --app-bg: #F5F7FA;
  --table-header-bg: #FAFAFA;
  --table-hover-bg: #E3F2FD;
}

body {
  background-color: var(--app-bg);
}

/* ユーティリティクラス: フォーム */
.dense-form {
  .mat-mdc-form-field {
    font-size: 14px;
    
    // 必要に応じて密度調整
    .mat-mdc-text-field-wrapper {
      padding-top: 4px;
      padding-bottom: 4px;
    }
  }
}

/* ユーティリティクラス: テーブル */
.admin-table {
  width: 100%;
  
  .mat-mdc-header-row {
    background-color: var(--table-header-bg);
  }
  
  .mat-mdc-row:hover {
    background-color: var(--table-hover-bg);
  }
}

/* ユーティリティクラス: カード */
.content-card {
  padding: 24px;
  
  @media (max-width: 600px) {
    padding: 16px;
  }
}
```

