import { TDocumentDefinitions } from 'pdfmake/interfaces';

import { Employee, Office } from '../../types';
import {
  DOCUMENT_DISCLAIMER,
  formatDateWithFallback,
  formatLossReason,
  formatSexLabel
} from '../document-helpers';

export interface QualificationLossTemplateInput {
  office: Office;
  employee: Employee;
  lossDate?: string | null;
}

export function createQualificationLossDocument(
  input: QualificationLossTemplateInput
): TDocumentDefinitions {
  const lossDate = input.lossDate || input.employee.healthLossDate || input.employee.retireDate;

  return {
    info: { title: '資格喪失届（参考様式）' },
    defaultStyle: {
      font: 'NotoSansJP',
      fontSize: 11
    },
    content: [
      { text: '健康保険・厚生年金保険 資格喪失届', style: 'title', alignment: 'center' },
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
            ['氏名（カナ）', input.employee.kana ?? ''],
            ['性別', formatSexLabel(input.employee.sex)],
            ['生年月日', formatDateWithFallback(input.employee.birthDate, '')]
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12]
      },
      { text: '喪失情報', style: 'section' },
      {
        table: {
          widths: ['32%', '*'],
          body: [
            ['資格喪失日', formatDateWithFallback(lossDate, '')],
            ['資格喪失理由（健保）', formatLossReason(input.employee.healthLossReasonKind)],
            ['資格喪失理由（厚年）', formatLossReason(input.employee.pensionLossReasonKind)],
            ['退職日', formatDateWithFallback(input.employee.retireDate, '')]
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
