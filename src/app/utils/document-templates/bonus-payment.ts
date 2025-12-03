import { TDocumentDefinitions } from 'pdfmake/interfaces';

import { BonusPremium, Employee, Office } from '../../types';
import { DOCUMENT_DISCLAIMER, formatCurrency, formatDateWithFallback } from '../document-helpers';

export interface BonusPaymentTemplateInput {
  office: Office;
  employee: Employee;
  bonus: BonusPremium;
}

export function createBonusPaymentDocument(
  input: BonusPaymentTemplateInput
): TDocumentDefinitions {
  return {
    info: { title: '賞与支払届（参考様式）' },
    defaultStyle: {
      font: 'NotoSansJP',
      fontSize: 11
    },
    content: [
      { text: '賞与支払届', style: 'title', alignment: 'center' },
      { text: '（参考様式）', style: 'subtitle', alignment: 'center' },
      { text: DOCUMENT_DISCLAIMER, style: 'disclaimer', margin: [0, 8, 0, 12] },
      {
        table: {
          widths: ['32%', '*'],
          body: [
            ['事業所名', input.office.name],
            ['事業所記号', input.office.officeSymbol ?? ''],
            ['事業所番号', input.office.officeNumber ?? '']
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12]
      },
      { text: '被保険者情報', style: 'section' },
      {
        table: {
          widths: ['32%', '*'],
          body: [
            ['被保険者整理番号', input.employee.employeeCodeInOffice ?? ''],
            ['氏名', input.employee.name],
            ['氏名（カナ）', input.employee.kana ?? '']
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12]
      },
      { text: '賞与情報', style: 'section' },
      {
        table: {
          widths: ['32%', '*'],
          body: [
            ['賞与支給日', formatDateWithFallback(input.bonus.payDate, '')],
            ['賞与支給額', formatCurrency(input.bonus.grossAmount)],
            ['標準賞与額', formatCurrency(input.bonus.standardBonusAmount)],
            ['健康保険料', formatCurrency(input.bonus.healthTotal)],
            ['厚生年金保険料', formatCurrency(input.bonus.pensionTotal)],
            ['年度', input.bonus.fiscalYear]
          ]
        },
        layout: 'lightHorizontalLines'
      }
    ],
    styles: {
      title: { fontSize: 16, bold: true },
      subtitle: { fontSize: 11, color: '#666' },
      disclaimer: { fontSize: 10, color: '#666' },
      section: { fontSize: 13, bold: true, margin: [0, 12, 0, 6] }
    }
  };
}
