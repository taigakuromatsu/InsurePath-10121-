import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Employee, Office } from '../../types';
import {
  DOCUMENT_DISCLAIMER,
  formatJapaneseEraDate,
  formatLossReason,
  formatSexLabel
} from '../document-helpers';

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
  // (5) 喪失年月日（健保/厚年 両方記載・和暦）
  healthLossDate: string; // 和暦表記、空欄可
  pensionLossDate: string; // 和暦表記、空欄可
  // (6) 喪失原因（健保/厚年 それぞれの喪失理由区分から読み取って記載）
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
        { text: '資格喪失届（参考様式）', style: 'title', alignment: 'center' },
        { text: DOCUMENT_DISCLAIMER, style: 'disclaimer', margin: [0, 6, 0, 10] }
      );
    } else {
      // 2ページ目以降は改ページ
      content.push({ text: '', pageBreak: 'before' });
      content.push(
        { text: '資格喪失届（参考様式）', style: 'title', alignment: 'center', margin: [0, 0, 0, 10] }
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
        { text: '喪失年月日\n（健保/厚年）', style: 'tableHeader', alignment: 'center' },
        { text: '喪失原因\n（健保/厚年）', style: 'tableHeader', alignment: 'left' }
      ]
    ];

    // データ行
    paddedRows.forEach(row => {
      // 喪失年月日（健保/厚年）
      const lossDateText = [
        row.healthLossDate ? `健保: ${row.healthLossDate}` : '健保: ',
        row.pensionLossDate ? `厚年: ${row.pensionLossDate}` : '厚年: '
      ]
        .filter(line => line.trim() !== '健保: ' && line.trim() !== '厚年: ')
        .join('\n') || '';

      // 喪失原因（健保/厚年）
      const lossReasonParts: string[] = [];
      if (row.healthLossReason) {
        let healthReasonText = `健保: ${row.healthLossReason}`;
        // 退職の場合のみ退社日を追記
        if (row.retireDate && row.healthLossReason.includes('退職')) {
          healthReasonText += `（退社日: ${row.retireDate}）`;
        }
        lossReasonParts.push(healthReasonText);
      } else {
        lossReasonParts.push('健保: ');
      }
      
      if (row.pensionLossReason) {
        let pensionReasonText = `厚年: ${row.pensionLossReason}`;
        // 退職の場合のみ退社日を追記
        if (row.retireDate && row.pensionLossReason.includes('退職')) {
          pensionReasonText += `（退社日: ${row.retireDate}）`;
        }
        lossReasonParts.push(pensionReasonText);
      } else {
        lossReasonParts.push('厚年: ');
      }

      const lossReasonText = lossReasonParts
        .filter(line => line.trim() !== '健保: ' && line.trim() !== '厚年: ')
        .join('\n') || '';

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
        { text: lossDateText || '', style: 'tableCell', alignment: 'center' },
        { text: lossReasonText || '', style: 'tableCell', alignment: 'left' }
      ]);
    });

    content.push({
      table: {
        headerRows: 1,
        widths: [70, 80, 70, 90, '*'],
        body: tableBody
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0.8 : 0.5,
        vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 0.8 : 0.5,
        hLineColor: () => '#000000',
        vLineColor: () => '#000000',
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 4,
        paddingBottom: () => 4
      },
      margin: [0, 0, 0, 10]
    });
  });

  return {
    info: { title: '資格喪失届（複数人まとめ）' },
    pageSize: 'A4',
    pageOrientation: 'landscape', // 横向きで4人分を収める
    defaultStyle: {
      font: 'NotoSansJP',
      fontSize: 9
    },
    content,
    styles: {
      title: { fontSize: 14, bold: true },
      disclaimer: { fontSize: 9, color: '#666' },
      tableHeader: { 
        fontSize: 8, 
        bold: true, 
        fillColor: '#f0f0f0',
        margin: [2, 2, 2, 2]
      },
      tableCell: { 
        fontSize: 8,
        margin: [2, 2, 2, 2]
      }
    },
    pageMargins: [40, 50, 40, 50]
  };
}

