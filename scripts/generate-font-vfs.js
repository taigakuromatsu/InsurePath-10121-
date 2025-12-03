/**
 * pdfmake用の日本語フォントvfsファイルを生成するスクリプト
 *
 * 使用方法:
 * 1. Noto Sans JPフォントをダウンロードして、fonts/ ディレクトリに配置
 *    - NotoSansJP-Regular.ttf
 *    - NotoSansJP-Bold.ttf
 * 2. このスクリプトを実行: node scripts/generate-font-vfs.js
 * 3. 生成された src/app/utils/pdf-vfs-fonts-jp.ts を確認
 *
 * フォントのダウンロード先:
 * - Google Fonts: https://fonts.google.com/noto/specimen/Noto+Sans+JP
 * - または、Noto CJKフォント: https://github.com/googlefonts/noto-cjk
 */

const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, '..', 'fonts');
const outputFile = path.join(__dirname, '..', 'src', 'app', 'utils', 'pdf-vfs-fonts-jp.ts');

const fontFiles = [
  { name: 'NotoSansJP-Regular.ttf', key: 'NotoSansJP-Regular.ttf' },
  { name: 'NotoSansJP-Bold.ttf', key: 'NotoSansJP-Bold.ttf' }
];

function base64EncodeFile(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

function generateVfsFile() {
  const vfs = {};

  for (const fontFile of fontFiles) {
    const fontPath = path.join(fontsDir, fontFile.name);
    if (!fs.existsSync(fontPath)) {
      console.error(`エラー: フォントファイルが見つかりません: ${fontPath}`);
      console.error(`フォントファイルを ${fontsDir} に配置してください。`);
      process.exit(1);
    }

    console.log(`処理中: ${fontFile.name}...`);
    const base64 = base64EncodeFile(fontPath);
    vfs[fontFile.key] = base64;
  }

  const output = `/**
 * pdfmake用の日本語フォントvfsファイル
 *
 * 生成元フォント: Noto Sans JP
 * - Regular: NotoSansJP-Regular.ttf
 * - Bold: NotoSansJP-Bold.ttf
 *
 * 再生成手順:
 * 1. fonts/ ディレクトリにNoto Sans JPフォントファイルを配置
 * 2. node scripts/generate-font-vfs.js を実行
 *
 * フォントのダウンロード先:
 * - Google Fonts: https://fonts.google.com/noto/specimen/Noto+Sans+JP
 */

export const pdfVfsJp = ${JSON.stringify(vfs, null, 2)};
`;

  fs.writeFileSync(outputFile, output, 'utf8');
  console.log(`\n✅ vfsファイルを生成しました: ${outputFile}`);
  console.log(`   ファイルサイズ: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
}

generateVfsFile();

