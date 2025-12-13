import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

import { BonusPremium, Employee, Office, StandardRewardHistory, YearMonthString } from '../types';
import { pdfVfsJp } from '../utils/pdf-vfs-fonts-jp';
import { createBonusPaymentDocument } from '../utils/document-templates/bonus-payment';
import { createQualificationAcquisitionDocument } from '../utils/document-templates/qualification-acquisition';
import { createQualificationLossDocument } from '../utils/document-templates/qualification-loss';
import { 
  createMonthlyBonusPaymentDocument,
  aggregateBonusesByEmployee,
  detectCommonPayDate,
  MonthlyBonusPaymentTemplateInput
} from '../utils/document-templates/monthly-bonus-payment';

export type DocumentType =
  | 'qualification_acquisition'
  | 'qualification_loss'
  | 'bonus_payment'
  | 'monthly_bonus_payment';

export type DocumentAction = 'open' | 'download' | 'print';

export interface QualificationAcquisitionPayload {
  office: Office;
  employee: Employee;
  standardMonthlyReward?: number | null;
  referenceDate?: string | null;
}

export interface QualificationLossPayload {
  office: Office;
  employee: Employee;
  lossDate?: string | null;
}

export interface BonusPaymentPayload {
  office: Office;
  employee: Employee;
  bonus: BonusPremium;
}

export interface MonthlyBonusPaymentPayload {
  office: Office;
  employees: Employee[];  // 従業員一覧（employeeIdでマッピング用）
  bonuses: BonusPremium[];  // 対象年月の賞与データ一覧
  yearMonth: YearMonthString;  // 対象年月（例: "2025-12"）
}

export type DocumentPayload =
  | { type: 'qualification_acquisition'; payload: QualificationAcquisitionPayload }
  | { type: 'qualification_loss'; payload: QualificationLossPayload }
  | { type: 'bonus_payment'; payload: BonusPaymentPayload }
  | { type: 'monthly_bonus_payment'; payload: MonthlyBonusPaymentPayload };

@Injectable({ providedIn: 'root' })
export class DocumentGeneratorService {
  private initialized = false;

  private ensureFonts(): void {
    if (this.initialized) return;

    // 日本語フォントをvfsとして設定
    (pdfMake as any).vfs = {
      ...pdfVfsJp
    };

    // 日本語フォントをデフォルトフォントとして登録
    (pdfMake as any).fonts = {
      NotoSansJP: {
        normal: 'NotoSansJP-Regular.ttf',
        bold: 'NotoSansJP-Bold.ttf',
        italics: 'NotoSansJP-Regular.ttf',
        bolditalics: 'NotoSansJP-Bold.ttf'
      }
    };

    this.initialized = true;
  }

  generate(document: DocumentPayload, action: DocumentAction, fileName?: string): void {
    this.ensureFonts();
    const definition = this.createDefinition(document);
    const pdf = pdfMake.createPdf(definition);

    const safeFileName = fileName ?? this.buildFileName(document);

    switch (action) {
      case 'download':
        pdf.download(safeFileName);
        break;
      case 'print':
        pdf.print();
        break;
      case 'open':
      default:
        pdf.open();
        break;
    }
  }

  resolveStandardMonthlyReward(
    histories: StandardRewardHistory[] | null | undefined,
    employeeFallback?: number | null
  ): number | null {
    if (histories && histories.length > 0) {
      const sorted = [...histories].sort(
        (a, b) => b.decisionYearMonth.localeCompare(a.decisionYearMonth)
      );
      return sorted[0]?.standardMonthlyReward ?? null;
    }
    if (employeeFallback !== undefined && employeeFallback !== null) {
      return employeeFallback;
    }
    return null;
  }

  private createDefinition(document: DocumentPayload): TDocumentDefinitions {
    switch (document.type) {
      case 'qualification_acquisition':
        return createQualificationAcquisitionDocument(document.payload);
      case 'qualification_loss':
        return createQualificationLossDocument(document.payload);
      case 'bonus_payment':
        return createBonusPaymentDocument(document.payload);
      case 'monthly_bonus_payment': {
        // Payloadから集計処理を行い、TemplateInputを作成
        const payload = document.payload as MonthlyBonusPaymentPayload;
        const rows = aggregateBonusesByEmployee(
          payload.bonuses,
          payload.employees,
          payload.yearMonth
        );
        
        // 集計結果が空の場合はエラー（空PDFを防ぐ）
        if (!rows || rows.length === 0) {
          throw new Error('PDFに出力する賞与データがありません');
        }
        
        const commonPayDate = detectCommonPayDate(rows);
        
        const templateInput: MonthlyBonusPaymentTemplateInput = {
          office: payload.office,
          rows,
          yearMonth: payload.yearMonth,
          commonPayDate
        };
        
        return createMonthlyBonusPaymentDocument(templateInput);
      }
      default:
        throw new Error('未対応の帳票種類です');
    }
  }

  private buildFileName(document: DocumentPayload): string {
    const baseName = (() => {
      switch (document.type) {
        case 'qualification_acquisition':
          return 'qualification-acquisition';
        case 'qualification_loss':
          return 'qualification-loss';
        case 'bonus_payment':
          return 'bonus-payment';
        case 'monthly_bonus_payment': {
          const payload = document.payload as MonthlyBonusPaymentPayload;
          return `bonus-payment-monthly-${payload.yearMonth}`;
        }
        default:
          return 'document';
      }
    })();

    // monthly_bonus_payment の場合は年月が既に含まれているので、従業員名は追加しない
    if (document.type === 'monthly_bonus_payment') {
      return `${baseName}.pdf`;
    }

    const employeeName = 'employee' in document.payload ? document.payload.employee?.name : '';
    const suffix = employeeName ? `-${employeeName}` : '';
    return `${baseName}${suffix}.pdf`;
  }
}
