import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { BonusPremium, Employee, Office, YearMonthString } from '../../types';
import { DOCUMENT_DISCLAIMER, formatCurrency, formatDate } from '../document-helpers';

// 型定義
export interface MonthlyBonusPdfRow {
  employeeCode: string;  // 被保険者整理番号
  name: string;  // 氏名
  kana: string;  // 氏名（カナ）
  birthDate: string;  // 生年月日（YYYY-MM-DD）
  payDate: string;  // 賞与支払年月日（その月の最後の支払日、YYYY-MM-DD）
  grossAmount: number;  // 賞与支給額（合算後）
  standardBonusAmount: number;  // 標準賞与額（合算後、1,000円未満切捨て）
  myNumberOrPensionNumber?: string;  // 個人番号または基礎年金番号（70歳以上のみ、myNumber優先）
  note?: string;  // 備考（70歳以上被用者の場合「1.70歳以上被用者」、同一月内に複数回支給がある場合「3.同一月内の賞与合算（初回支払日: ...）」、複数ある場合は改行で区切る）
}

export interface MonthlyBonusPaymentTemplateInput {
  office: Office;
  rows: MonthlyBonusPdfRow[];  // 集計済みの行データ（全従業員分）
  yearMonth: YearMonthString;  // 対象年月
  commonPayDate?: string;  // 共通支払日（全員同じ場合のみ、YYYY-MM-DD形式）
}

// 令和開始日（2019年5月1日）をローカル時刻で定義（タイムゾーン誤判定を防ぐ）
const REIWA_START = new Date(2019, 4, 1); // 2019-05-01（月は0始まり）

/**
 * 賞与支払年月日を令和表記に変換（YYYY-MM-DD → 令和X年M月D日）
 * 原則として支払日は令和（2019/05/01以降）を想定するが、万一それ以前の場合は西暦表記で返す
 */
function formatPayDateReiwa(dateStr: string): string {
  if (!dateStr) return '';
  
  const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
  if (!y || !m || !d) return dateStr;
  
  const dt = new Date(y, m - 1, d); // ローカル時刻で生成
  if (isNaN(dt.getTime())) return dateStr;
  
  // 原則：支払日は令和想定。万一それ以前なら西暦で返す（壊さない）
  if (dt < REIWA_START) {
    return `${y}年${m}月${d}日`;
  }
  
  const reiwaYear = y - 2018; // 2019年→令和1年
  return `令和${reiwaYear}年${m}月${d}日`;
}

/**
 * 指定日時点での年齢を計算
 * YYYY-MM-DD形式の文字列をローカル時刻で解釈（タイムゾーン誤判定を防ぐ）
 */
function calculateAgeAtDate(birthDate: string, referenceDate: string): number | null {
  if (!birthDate || !referenceDate) {
    return null;
  }
  
  // YYYY-MM-DD形式を分解してローカル時刻で生成（UTC解釈を避ける）
  const [by, bm, bd] = birthDate.split('-').map(n => parseInt(n, 10));
  const [ry, rm, rd] = referenceDate.split('-').map(n => parseInt(n, 10));
  
  if (!by || !bm || !bd || !ry || !rm || !rd) {
    return null;
  }
  
  const birth = new Date(by, bm - 1, bd); // ローカル時刻
  const reference = new Date(ry, rm - 1, rd); // ローカル時刻
  
  if (isNaN(birth.getTime()) || isNaN(reference.getTime())) {
    return null;
  }
  
  let age = reference.getFullYear() - birth.getFullYear();
  const monthDiff = reference.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birth.getDate())) {
    age--;
  }
  return age;
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
 * 同一従業員・同一年月の賞与を合算して1行にまとめる
 */
export function aggregateBonusesByEmployee(
  bonuses: BonusPremium[],
  employees: Employee[],
  yearMonth: YearMonthString
): MonthlyBonusPdfRow[] {
  // 従業員マップを作成（employeeId → Employee）
  const employeeMap = new Map<string, Employee>();
  employees.forEach(emp => employeeMap.set(emp.id, emp));

  // 従業員IDでグループ化
  const bonusMap = new Map<string, BonusPremium[]>();
  bonuses.forEach(bonus => {
    if (!bonusMap.has(bonus.employeeId)) {
      bonusMap.set(bonus.employeeId, []);
    }
    bonusMap.get(bonus.employeeId)!.push(bonus);
  });

  const rows: MonthlyBonusPdfRow[] = [];

  // 各従業員ごとに処理
  for (const [employeeId, employeeBonuses] of bonusMap.entries()) {
    const employee = employeeMap.get(employeeId);
    if (!employee) {
      // 従業員が削除されている場合はスキップ
      console.warn(`従業員が見つかりません（employeeId: ${employeeId}）。賞与データをスキップします。`);
      continue;
    }

    // 支給日でソート（降順：最新が先頭）
    const sortedBonuses = [...employeeBonuses].sort((a, b) => 
      b.payDate.localeCompare(a.payDate)
    );

    // 合算処理
    const totalGrossAmount = sortedBonuses.reduce((sum, b) => sum + b.grossAmount, 0);
    
    // 標準賞与額の合算（1,000円未満切捨て）
    // 注意: 各賞与のstandardBonusAmountを合算するのではなく、
    // 合算後のgrossAmountから標準賞与額を計算する
    const standardBonusAmount = Math.floor(totalGrossAmount / 1000) * 1000;

    // 最後の支払日を取得
    const lastPayDate = sortedBonuses[0].payDate;

    // 70歳以上判定（対象年月末基準）
    const targetYear = parseInt(yearMonth.substring(0, 4));
    const targetMonth = parseInt(yearMonth.substring(5, 7));
    // 対象年月の月末日を基準に年齢を計算
    const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();
    const referenceDate = `${yearMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;
    const age = calculateAgeAtDate(employee.birthDate, referenceDate);
    const isSeventyOrOlder = age !== null && age >= 70;

    // ⑦欄: myNumber優先、なければpensionNumber
    const myNumberOrPensionNumber = isSeventyOrOlder
      ? (employee.myNumber || employee.pensionNumber || undefined)
      : undefined;

    // ⑧備考欄の生成（様式に合わせて複数項目を追加可能）
    const noteParts: string[] = [];
    
    // 1. 70歳以上被用者の場合
    if (isSeventyOrOlder) {
      noteParts.push('1.70歳以上被用者');
    }
    
    // 3. 同一月内に複数回支給がある場合
    const hasMultiplePayments = sortedBonuses.length > 1;
    if (hasMultiplePayments) {
      const firstPayDate = sortedBonuses[sortedBonuses.length - 1].payDate;
      noteParts.push(`3.同一月内の賞与合算（初回支払日: ${formatPayDateReiwa(firstPayDate)}）`);
    }
    
    // notePartsを結合（複数ある場合は改行で区切る）
    const note = noteParts.length > 0 ? noteParts.join('\n') : undefined;

    // 行データを作成
    const row: MonthlyBonusPdfRow = {
      employeeCode: employee.employeeCodeInOffice ?? '',
      name: employee.name,
      kana: employee.kana ?? '',
      birthDate: employee.birthDate,
      payDate: lastPayDate,
      grossAmount: totalGrossAmount,
      standardBonusAmount,
      myNumberOrPensionNumber,
      note
    };

    rows.push(row);
  }

  // 従業員コード順（または氏名順）でソート
  // 整理番号が数値っぽい文字列の場合に備えて、Intl.Collatorのnumeric比較を使用
  const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
  rows.sort((a, b) => {
    if (a.employeeCode && b.employeeCode) {
      return collator.compare(a.employeeCode, b.employeeCode);
    }
    return collator.compare(a.name, b.name);
  });

  return rows;
}

/**
 * 共通支払日を判定（全員の支払日が同じかどうか）
 */
export function detectCommonPayDate(rows: MonthlyBonusPdfRow[]): string | undefined {
  if (rows.length === 0) {
    return undefined;
  }
  
  const firstPayDate = rows[0].payDate;
  const allSame = rows.every(row => row.payDate === firstPayDate);
  
  return allSame ? firstPayDate : undefined;
}

/**
 * 月次PDFテンプレートを生成
 */
export function createMonthlyBonusPaymentDocument(
  input: MonthlyBonusPaymentTemplateInput
): TDocumentDefinitions {
  // PDFレイアウト定数
  const PAGE_WIDTH_PT = 595.28; // A4 portrait width in pt（pdfmake）
  const PAGE_MARGINS: [number, number, number, number] = [40, 50, 55, 50]; // 右を +5（必要なら60でもOK）
  const SAFE_RIGHT_PT = 24;     // 右端の安全余白（11→24くらいに）
  const LINE_ALLOWANCE_PT = 2;  // 罫線幅/丸め誤差の逃げ

  const { office, rows, yearMonth, commonPayDate } = input;

  // 必須項目チェック（8.1の例外処理に対応）
  if (!office.name) {
    throw new Error('事業所名称が設定されていません');
  }

  // 10人ずつに分割
  const chunks = chunkArray(rows, 10);
  
  const content: any[] = [];

  // 各ページ（チャンク）ごとに処理
  chunks.forEach((chunk, pageIndex) => {
    // ページタイトル（1ページ目のみ）
    if (pageIndex === 0) {
      content.push(
        { text: '被保険者賞与支払届', style: 'title', alignment: 'center' },
        { text: '（参考様式）', style: 'subtitle', alignment: 'center' },
        { text: DOCUMENT_DISCLAIMER, style: 'disclaimer', margin: [0, 6, 0, 10] }
      );
    } else {
      // 2ページ目以降は改ページ
      content.push({ text: '', pageBreak: 'before' });
      // 2ページ目以降にもタイトルを表示（オプション）
      content.push(
        { text: '被保険者賞与支払届（続き）', style: 'title', alignment: 'center', margin: [0, 0, 0, 10] }
      );
    }

    // 事業所情報テーブル
    if (pageIndex === 0) {
      // 1ページ目: 詳細情報
      content.push({
        table: {
          widths: [120, '*'],  // pdfmakeの仕様に合わせて%指定を避け、固定幅+可変幅に
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
      });
    } else {
      // 2ページ目以降: 簡易情報（事業所名＋対象年月＋共通支払日）
      // 共通支払日がある場合は2ページ目以降にも表示（続きページだけ開かれても支払日が確認できるように）
      const yearMonthLabel = `${yearMonth.substring(0, 4)}年${parseInt(yearMonth.substring(5, 7))}月`;
      const commonPayDateLabel = commonPayDate ? formatPayDateReiwa(commonPayDate) : '';
      
      content.push({
        table: {
          widths: [120, '*'],  // pdfmakeの仕様に合わせて%指定を避け、固定幅+可変幅に
          body: [
            ['事業所名称', office.name ?? ''],
            ['対象年月', yearMonthLabel],
            ...(commonPayDate ? [['④ 賞与支払年月日（共通）', commonPayDateLabel]] : [])
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 10]
      });
    }

    // 対象年月と共通支払日の表示（1ページ目のみ）
    if (pageIndex === 0) {
      const yearMonthLabel = `${yearMonth.substring(0, 4)}年${parseInt(yearMonth.substring(5, 7))}月`;
      const commonPayDateLabel = commonPayDate ? formatPayDateReiwa(commonPayDate) : '';
      
      content.push({
        table: {
          widths: [120, '*'],  // pdfmakeの仕様に合わせて%指定を避け、固定幅+可変幅に
          body: [
            ['対象年月', yearMonthLabel],
            ...(commonPayDate ? [['④ 賞与支払年月日（共通）', commonPayDateLabel]] : [])
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 10]
      });
    }

    // 被保険者一覧テーブル
    const tableBody: any[] = [
      // ヘッダー行
      [
        { text: '①整理番号', style: 'tableHeader', alignment: 'center' },
        { text: '②氏名', style: 'tableHeader', alignment: 'center' },
        { text: '③生年月日', style: 'tableHeader', alignment: 'center' },
        { text: '④賞与支払年月日', style: 'tableHeader', alignment: 'center' },
        { text: '⑤賞与支給額', style: 'tableHeader', alignment: 'right' },
        { text: '⑥賞与額', style: 'tableHeader', alignment: 'right' },
        { text: '⑦個人番号/基礎年金番号', style: 'tableHeader', alignment: 'center' },
        { text: '⑧備考', style: 'tableHeader', alignment: 'left' }
      ]
    ];

    // データ行
    chunk.forEach(row => {
      tableBody.push([
        { text: row.employeeCode || '', style: 'tableCell', alignment: 'center' },
        { text: row.name || '', style: 'tableCell' },
        { text: formatDate(row.birthDate) || '', style: 'tableCell', alignment: 'center' },  // 生年月日は西暦表記
        { 
          text: commonPayDate ? '' : (formatPayDateReiwa(row.payDate) || ''),  // 支払日は令和表記
          style: 'tableCell', 
          alignment: 'center' 
        },
        { text: formatCurrency(row.grossAmount) || '', style: 'tableCell', alignment: 'right' },
        { text: formatCurrency(row.standardBonusAmount) || '', style: 'tableCell', alignment: 'right' },
        { 
          text: row.myNumberOrPensionNumber || '', 
          style: 'tableCell', 
          alignment: 'center',
          fontSize: 9  // 番号が長いので少し小さく
        },
        { 
          text: row.note || '', 
          style: 'tableCell', 
          fontSize: 9,
          margin: [6, 2, 4, 2],  // 備考列の左パディングを追加（右端の安全マージン確保）
          // noteに改行（\n）が含まれる場合、pdfmakeが自動的に改行として表示する
        }
      ]);
    });

    // A4幅から左右マージンと安全マージンを引いた利用可能幅を計算
    const pageWidth = PAGE_WIDTH_PT;
    const leftMargin = PAGE_MARGINS[0];
    const rightMargin = PAGE_MARGINS[2];
    const availableWidth = pageWidth - leftMargin - rightMargin - SAFE_RIGHT_PT - LINE_ALLOWANCE_PT;
    
    // 固定幅の基準値（pt単位）
    const colsBase = [45, 70, 60, 75, 70, 65, 95];
    const baseSum = colsBase.reduce((a, b) => a + b, 0);
    
    // 備考列の最小幅を確保（残りを可変幅として割り当て）
    const minRemarkWidth = 80; // 備考列の最小幅
    const fixedWidthSum = baseSum + minRemarkWidth;
    
    // 利用可能幅に収まるようにスケール調整
    let scale = 1;
    if (fixedWidthSum > availableWidth) {
      scale = (availableWidth - minRemarkWidth) / baseSum;
    }
    
    // スケール適用後の幅
    const scaledWidths = colsBase.map(w => Math.floor(w * scale));
    const scaledSum = scaledWidths.reduce((a, b) => a + b, 0);
    
    // 備考列は残りの幅を使用（最小幅を確保）
    const remarkWidth = Math.max(minRemarkWidth, availableWidth - scaledSum);
    
    // 最終的な幅配列
    const widths = [...scaledWidths, remarkWidth];
    
    content.push({
      table: {
        headerRows: 1,
        widths: widths,
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
    info: { title: '被保険者賞与支払届（月次まとめ）' },
    pageSize: 'A4',
    pageOrientation: 'portrait',
    defaultStyle: {
      font: 'NotoSansJP',
      fontSize: 10
    },
    content,
    styles: {
      title: { fontSize: 16, bold: true },
      subtitle: { fontSize: 10, color: '#666' },
      disclaimer: { fontSize: 9, color: '#666' },
      tableHeader: { 
        fontSize: 9, 
        bold: true, 
        fillColor: '#f0f0f0',
        margin: [2, 2, 2, 2]
      },
      tableCell: { 
        fontSize: 9,
        margin: [2, 2, 2, 2]
      },
      footer: {
        fontSize: 8,
        color: '#666666'
      }
    },
    pageMargins: PAGE_MARGINS,
    footer: (currentPage: number, pageCount: number) => {
      return {
        text: [
          { text: '※ 上限額について: ', bold: true, fontSize: 8, color: '#666666' },
          { text: '健康保険: 年度（4月〜3月）累計 5,730,000円 / ', fontSize: 8, color: '#666666' },
          { text: '厚生年金: 1か月 1,500,000円', fontSize: 8, color: '#666666' }
        ],
        alignment: 'center',
        margin: [0, 8, 0, 0]
      };
    }
  };
}

