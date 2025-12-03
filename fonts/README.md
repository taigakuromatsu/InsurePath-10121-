# 日本語フォントファイルの配置場所

このディレクトリに、pdfmakeで使用する日本語フォントファイルを配置してください。

## 必要なフォントファイル

以下の2つのフォントファイルが必要です：

- `NotoSansJP-Regular.ttf` - 通常のテキスト用
- `NotoSansJP-Bold.ttf` - 太字テキスト用

## フォントのダウンロード方法

### 方法1: Google Fontsからダウンロード

1. [Google Fonts - Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) にアクセス
2. 「Download family」をクリック
3. ダウンロードしたZIPファイルを展開
4. 以下のファイルをこのディレクトリにコピー：
   - `NotoSansJP-Regular.ttf`
   - `NotoSansJP-Bold.ttf`

### 方法2: Noto CJKフォントからダウンロード

1. [Noto CJK GitHub](https://github.com/googlefonts/noto-cjk) にアクセス
2. Releasesページから最新版をダウンロード
3. 展開後、以下のファイルをこのディレクトリにコピー：
   - `NotoSansCJK-Regular.ttf` → `NotoSansJP-Regular.ttf` にリネーム
   - `NotoSansCJK-Bold.ttf` → `NotoSansJP-Bold.ttf` にリネーム

## vfsファイルの生成

フォントファイルを配置したら、以下のコマンドを実行してvfsファイルを生成してください：

```bash
npm run generate-font-vfs
```

これにより、`src/app/utils/pdf-vfs-fonts-jp.ts` が生成されます。

## 注意事項

- フォントファイルはライセンスに注意してください（Noto Sans JPはSIL Open Font License）
- フォントファイルはGitにコミットしないことを推奨します（.gitignoreに追加）
- vfsファイルは生成後にGitにコミットしてください

