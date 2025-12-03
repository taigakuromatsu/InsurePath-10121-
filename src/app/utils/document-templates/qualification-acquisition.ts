import { TDocumentDefinitions } from 'pdfmake/interfaces';

import { Employee, Office } from '../../types';
import {
  DOCUMENT_DISCLAIMER,
  formatCurrency,
  formatDateWithFallback,
  formatQualificationKind,
  formatSexLabel
} from '../document-helpers';

export interface QualificationAcquisitionTemplateInput {
  office: Office;
  employee: Employee;
  standardMonthlyReward?: number | null;
  referenceDate?: string | null;
}

export function createQualificationAcquisitionDocument(
  input: QualificationAcquisitionTemplateInput
): TDocumentDefinitions {
  const qualificationDate =
    input.referenceDate || input.employee.healthQualificationDate || input.employee.hireDate;

  return {
    info: {
      title: '資格取得届（参考様式）'
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 11
    },
    content: [
      { text: '健康保険・厚生年金保険 資格取得届', style: 'title', alignment: 'center' },
      { text: '（参考様式）', style: 'subtitle', alignment: 'center' },
      { text: DOCUMENT_DISCLAIMER, style: 'disclaimer', margin: [0, 8, 0, 12] },
      {
        table: {
          widths: ['32%', '*'],
          body: [
            ['事業所名', input.office.name],
            ['事業所記号', input.office.officeSymbol ?? ''],
            ['事業所番号', input.office.officeNumber ?? ''],
            ['事業所所在地', input.office.address ?? ''],
            ['事業所郵便番号', input.office.officePostalCode ?? ''],
            ['事業主氏名', input.office.officeOwnerName ?? '']
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
            ['生年月日', formatDateWithFallback(input.employee.birthDate, '')],
            ['住所', input.employee.address ?? ''],
            ['郵便番号', input.employee.postalCode ?? '']
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12]
      },
      { text: '資格情報', style: 'section' },
      {
        table: {
          widths: ['32%', '*'],
          body: [
            ['資格取得日', formatDateWithFallback(qualificationDate, '')],
            ['資格取得区分（健保）', formatQualificationKind(input.employee.healthQualificationKind)],
            ['資格取得区分（厚年）', formatQualificationKind(input.employee.pensionQualificationKind)],
            ['標準報酬月額', formatCurrency(input.standardMonthlyReward) || ''],
            ['健康保険等級', input.employee.healthGrade?.toString() ?? ''],
            ['厚生年金等級', input.employee.pensionGrade?.toString() ?? ''],
            ['被保険者記号・番号',
              [input.employee.healthInsuredSymbol, input.employee.healthInsuredNumber]
                .filter(Boolean)
                .join(' ')],
            ['厚生年金番号', input.employee.pensionNumber ?? '']
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
