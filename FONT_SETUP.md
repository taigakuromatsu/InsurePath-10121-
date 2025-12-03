# 日本語フォント設定手順

pdfmakeで日本語を正しく表示するために、日本語フォント（Noto Sans JP）を設定する必要があります。

## 手順

### 1. フォントファイルのダウンロード

以下のいずれかの方法でNoto Sans JPフォントをダウンロードしてください。

#### 方法A: Google Fontsからダウンロード（推奨）

1. [Google Fonts - Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) にアクセス
2. 「Download family」をクリックしてZIPファイルをダウンロード
3. ZIPファイルを展開
4. 以下のファイルを `fonts/` ディレクトリにコピー：
   - `NotoSansJP-Regular.ttf`
   - `NotoSansJP-Bold.ttf`

#### 方法B: Noto CJKフォントからダウンロード

1. [Noto CJK GitHub Releases](https://github.com/googlefonts/noto-cjk/releases) にアクセス
2. 最新版のZIPファイルをダウンロード
3. 展開後、以下のファイルを `fonts/` ディレクトリにコピー：
   - `NotoSansCJK-Regular.ttf` → `NotoSansJP-Regular.ttf` にリネーム
   - `NotoSansCJK-Bold.ttf` → `NotoSansJP-Bold.ttf` にリネーム

### 2. vfsファイルの生成

フォントファイルを配置したら、以下のコマンドを実行してvfsファイルを生成してください：

```bash
npm run generate-font-vfs
```

これにより、`src/app/utils/pdf-vfs-fonts-jp.ts` が生成されます。

### 3. 動作確認

1. `ng serve` でアプリケーションを起動
2. 従業員詳細画面から「資格取得届PDF」または「資格喪失届PDF」を生成
3. PDFビューアで日本語が正しく表示されることを確認

## ファイル構成

```
fonts/
  ├── README.md                    # フォント配置の説明
  ├── NotoSansJP-Regular.ttf      # 通常フォント（要配置）
  └── NotoSansJP-Bold.ttf         # 太字フォント（要配置）

scripts/
  └── generate-font-vfs.js        # vfsファイル生成スクリプト

src/app/utils/
  └── pdf-vfs-fonts-jp.ts         # 生成されるvfsファイル
```

## 注意事項

- フォントファイル（.ttf）はGitにコミットしないでください（.gitignoreに追加済み）
- vfsファイル（`pdf-vfs-fonts-jp.ts`）は生成後にGitにコミットしてください
- フォントファイルのサイズが大きいため、vfsファイルも大きくなります（数MB程度）
- Noto Sans JPはSIL Open Font Licenseで提供されています

## トラブルシューティング

### フォントファイルが見つからないエラー

```
エラー: フォントファイルが見つかりません: fonts/NotoSansJP-Regular.ttf
```

→ `fonts/` ディレクトリにフォントファイルが正しく配置されているか確認してください。

### PDFで日本語が豆腐文字（□）になる

→ vfsファイルが正しく生成されているか確認してください。`src/app/utils/pdf-vfs-fonts-jp.ts` に実際のBase64データが含まれている必要があります。

### ビルドエラー

→ TypeScriptのコンパイルエラーが出る場合は、`src/app/utils/pdf-vfs-fonts-jp.ts` が正しく生成されているか確認してください。

