import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Office } from '../../types';
import { DOCUMENT_DISCLAIMER } from '../document-helpers';

/**
 * 資格喪失届PDF行データ
 */
export interface QualificationLossPdfRow {
  // (1) 被保険者整理番号
  insuredNumber: string;
  // (2) 氏名（フリガナ）
  name: string;
  kana: string;
  // (3) 生年月日（元号）・(4) 種別
  birthDate: string; // 和暦表記
  sex: string; // 男/女
  // (5) 個人番号（基礎年金番号）
  myNumberOrPensionNumber: string;
  // (6) 喪失年月日（健保/厚年 両方記載・和暦）
  healthLossDate: string; // 和暦表記、空欄可
  pensionLossDate: string; // 和暦表記、空欄可
  // (7) 喪失原因（健保/厚年 それぞれの喪失理由区分から読み取って記載）
  healthLossReason: string; // 喪失原因ラベル、空欄可
  pensionLossReason: string; // 喪失原因ラベル、空欄可
  retireDate: string; // 退職の場合のみ追記（和暦表記、空欄可）
}

/**
 * 資格喪失届バッチ生成用のテンプレート入力
 */
export interface QualificationLossBatchTemplateInput {
  office: Office;
  rows: QualificationLossPdfRow[];
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
function padRowsTo4(rows: QualificationLossPdfRow[]): QualificationLossPdfRow[] {
  const padded = [...rows];
  while (padded.length < 4) {
    padded.push({
      insuredNumber: '',
      name: '',
      kana: '',
      birthDate: '',
      sex: '',
      myNumberOrPensionNumber: '',
      healthLossDate: '',
      pensionLossDate: '',
      healthLossReason: '',
      pensionLossReason: '',
      retireDate: ''
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
 * 資格喪失届バッチPDFテンプレートを生成
 */
export function buildQualificationLossBatchDefinition(
  office: Office,
  rows: QualificationLossPdfRow[]
): TDocumentDefinitions {
  // 4人ずつに分割
  const chunks = chunkArray(rows, 4);
  
  const content: any[] = [];

  // 各ページ（チャンク）ごとに処理
  chunks.forEach((chunk, pageIndex) => {
    // ページタイトル（1ページ目のみ）
    if (pageIndex === 0) {
      content.push(
        { text: '資格喪失届用入力補助', style: 'title', alignment: 'center' },
        { text: DOCUMENT_DISCLAIMER, style: 'disclaimer', alignment: 'center', margin: [0, 6, 0, 10] }
      );
    } else {
      // 2ページ目以降は改ページ
      content.push({ text: '', pageBreak: 'before' });
      content.push(
        { text: '資格喪失届用入力補助', style: 'title', alignment: 'center', margin: [0, 0, 0, 10] }
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
        { text: '個人番号\n（基礎年金番号）', style: 'tableHeader', alignment: 'center' },
        { text: '喪失年月日\n（健保/厚年）', style: 'tableHeader', alignment: 'center' },
        { text: '喪失原因\n（健保/厚年）', style: 'tableHeader', alignment: 'left' }
      ]
    ];

    // データ行
    paddedRows.forEach(row => {
      // 喪失年月日（健保/厚年）
      const lossDateLines: string[] = [];
      if (row.healthLossDate) {
        lossDateLines.push(`健保: ${row.healthLossDate}`);
      }
      if (row.pensionLossDate) {
        lossDateLines.push(`厚年: ${row.pensionLossDate}`);
      }
      const lossDateText = lossDateLines.join('\n');

      // 喪失原因（健保/厚年）
      const lossReasonLines: string[] = [];
      if (row.healthLossReason) {
        const healthReasonText = row.retireDate && row.healthLossReason.includes('退職')
          ? `健保: ${row.healthLossReason}（退社日: ${row.retireDate}）`
          : `健保: ${row.healthLossReason}`;
        lossReasonLines.push(healthReasonText);
      }
      if (row.pensionLossReason) {
        const pensionReasonText = row.retireDate && row.pensionLossReason.includes('退職')
          ? `厚年: ${row.pensionLossReason}（退社日: ${row.retireDate}）`
          : `厚年: ${row.pensionLossReason}`;
        lossReasonLines.push(pensionReasonText);
      }
      const lossReasonText = lossReasonLines.join('\n');

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
        { text: row.myNumberOrPensionNumber || '', style: 'tableCell', alignment: 'center' },
        { text: lossDateText || '', style: 'tableCell', alignment: 'center' },
        { text: lossReasonText || '', style: 'tableCell', alignment: 'left' }
      ]);
    });

    content.push({
      table: {
        headerRows: 1,
        // A4縦に収まるように調整（固定幅合計=約400pt、残りが喪失原因へ）
        widths: [42, 60, 52, 65, 60, '*'],
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
    info: { title: '資格喪失届（複数人まとめ）' },
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

