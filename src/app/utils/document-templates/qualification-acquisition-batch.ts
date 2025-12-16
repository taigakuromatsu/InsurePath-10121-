import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Office } from '../../types';
import { DOCUMENT_DISCLAIMER } from '../document-helpers';

/**
 * 資格取得届PDF行データ
 */
export interface QualificationAcquisitionPdfRow {
  // (1) 被保険者整理番号
  insuredNumber: string;
  // (2) 氏名（フリガナ）
  name: string;
  kana: string;
  // (3) 生年月日（元号）・(4) 種別
  birthDate: string; // 和暦表記
  sex: string; // 男/女
  // (5) 取得区分（健保/厚年 一律）
  qualificationKind: string;
  // (6) 個人番号（なければ基礎年金番号）
  myNumberOrPensionNumber: string;
  // (7) 取得年月日（健保/厚年 両方記載・和暦）
  healthQualificationDate: string; // 和暦表記、空欄可
  pensionQualificationDate: string; // 和暦表記、空欄可
  // (8) 扶養者
  hasDependents: string; // 「有」or「無」
  // (9) 報酬月額
  monthlyWage: string; // 通貨表記、空欄可
  // (10) 備考
  note: string; // 70歳以上被用者の場合のみ記載
  // (11) 住所
  address: string; // 〒+住所、住所カナがあれば追加
}

/**
 * 資格取得届バッチ生成用のテンプレート入力
 */
export interface QualificationAcquisitionBatchTemplateInput {
  office: Office;
  rows: QualificationAcquisitionPdfRow[];
}

/**
 * 配列を指定サイズのチャンクに分割
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * 行を4行に揃える（空行でパディング）
 */
function padRowsTo4(rows: QualificationAcquisitionPdfRow[]): QualificationAcquisitionPdfRow[] {
  const padded = [...rows];
  while (padded.length < 4) {
    padded.push({
      insuredNumber: '',
      name: '',
      kana: '',
      birthDate: '',
      sex: '',
      qualificationKind: '',
      myNumberOrPensionNumber: '',
      healthQualificationDate: '',
      pensionQualificationDate: '',
      hasDependents: '',
      monthlyWage: '',
      note: '',
      address: ''
    });
  }
  return padded;
}

/**
 * 事業所情報ヘッダーテーブルを作成
 */
function createOfficeHeaderTable(office: Office): any {
  return {
    table: {
      widths: [120, '*'],
      body: [
        ['事業所名称', office.name ?? ''],
        ['事業所整理記号', office.officeSymbol ?? ''],
        ['事業所番号', office.officeNumber ?? ''],
        ['郵便番号', office.officePostalCode ?? ''],
        ['事業所所在地', office.address ?? ''],
        ['事業主氏名', office.officeOwnerName ?? ''],
        ['電話番号', office.officePhone ?? '']
      ]
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 10]
  };
}

/**
 * 資格取得届バッチPDFテンプレートを生成
 */
export function buildQualificationAcquisitionBatchDefinition(
  office: Office,
  rows: QualificationAcquisitionPdfRow[]
): TDocumentDefinitions {
  // 4人ずつに分割
  const chunks = chunkArray(rows, 4);
  
  const content: any[] = [];

  // 各ページ（チャンク）ごとに処理
  chunks.forEach((chunk, pageIndex) => {
    // ページタイトル（1ページ目のみ）
    if (pageIndex === 0) {
      content.push(
        { text: '資格取得届用入力補助', style: 'title', alignment: 'center' },
        { text: DOCUMENT_DISCLAIMER, style: 'disclaimer', alignment: 'center', margin: [0, 6, 0, 10] }
      );
    } else {
      // 2ページ目以降は改ページ
      content.push({ text: '', pageBreak: 'before' });
      content.push(
        { text: '資格取得届用入力補助', style: 'title', alignment: 'center', margin: [0, 0, 0, 10] }
      );
    }

    // 事業所情報テーブル（全ページに表示）
    content.push(createOfficeHeaderTable(office));

    // 4行に揃える
    const paddedRows = padRowsTo4(chunk);

    // 従業員テーブル
    const tableBody: any[] = [
      // ヘッダー行
      [
        { text: '被保険者整理番号', style: 'tableHeader', alignment: 'center' },
        { text: '氏名\n（フリガナ）', style: 'tableHeader', alignment: 'center' },
        { text: '生年月日\n（元号）・種別', style: 'tableHeader', alignment: 'center' },
        { text: '取得区分', style: 'tableHeader', alignment: 'center' },
        { text: '個人番号\n（基礎年金番号）', style: 'tableHeader', alignment: 'center' },
        { text: '取得年月日\n（健保/厚年）', style: 'tableHeader', alignment: 'center' },
        { text: '扶養者', style: 'tableHeader', alignment: 'center' },
        { text: '報酬月額', style: 'tableHeader', alignment: 'right' },
        { text: '備考', style: 'tableHeader', alignment: 'left' },
        { text: '住所', style: 'tableHeader', alignment: 'left' }
      ]
    ];

    // データ行
    paddedRows.forEach(row => {
      // 取得年月日（健保/厚年）
      const qualificationDateLines: string[] = [];
      if (row.healthQualificationDate) {
        qualificationDateLines.push(`健保: ${row.healthQualificationDate}`);
      }
      if (row.pensionQualificationDate) {
        qualificationDateLines.push(`厚年: ${row.pensionQualificationDate}`);
      }
      const qualificationDateText = qualificationDateLines.join('\n');

      tableBody.push([
        { text: row.insuredNumber || '', style: 'tableCell', alignment: 'center' },
        { 
          text: [
            row.name || '',
            row.kana || ''
          ].filter(Boolean).join('\n') || '', 
          style: 'tableCell' 
        },
        { 
          text: [
            row.birthDate || '',
            row.sex || ''
          ].filter(Boolean).join('\n') || '', 
          style: 'tableCell', 
          alignment: 'center' 
        },
        { text: row.qualificationKind || '', style: 'tableCell', alignment: 'center' },
        { text: row.myNumberOrPensionNumber || '', style: 'tableCell', alignment: 'center' },
        { text: qualificationDateText || '', style: 'tableCell', alignment: 'center' },
        { text: row.hasDependents || '', style: 'tableCell', alignment: 'center' },
        { text: row.monthlyWage || '', style: 'tableCell', alignment: 'right' },
        { text: row.note || '', style: 'tableCell', alignment: 'left' },
        { text: row.address || '', style: 'tableCell', alignment: 'left' }
      ]);
    });

    content.push({
      table: {
        headerRows: 1,
        // A4縦に収まるように調整（固定幅合計=439pt、残りが住所へ）
        widths: [42, 60, 52, 40, 65, 60, 30, 50, 40, '*'],
        body: tableBody
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0.8 : 0.5,
        vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 0.8 : 0.5,
        hLineColor: () => '#000000',
        vLineColor: () => '#000000',
        // パディングも少し減らす（横幅を実質稼ぐ）
        paddingLeft: () => 2,
        paddingRight: () => 2,
        paddingTop: () => 3,
        paddingBottom: () => 3
      },
      margin: [0, 0, 0, 10]
    });
  });

  return {
    info: { title: '資格取得届（複数人まとめ）' },
    pageSize: 'A4',
    pageOrientation: 'portrait', // A4縦向き
    defaultStyle: {
      font: 'NotoSansJP',
      fontSize: 9
    },
    content,
    styles: {
      title: { fontSize: 14, bold: true },
      disclaimer: { fontSize: 9, color: '#666' },
      tableHeader: { 
        fontSize: 7, 
        bold: true, 
        fillColor: '#f0f0f0',
        margin: [2, 2, 2, 2]
      },
      tableCell: { 
        fontSize: 7,
        margin: [2, 2, 2, 2]
      }
    },
    pageMargins: [25, 50, 25, 50]
  };
}

