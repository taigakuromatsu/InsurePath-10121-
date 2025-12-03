import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

import { BonusPremium, Employee, Office, StandardRewardHistory } from '../types';
import { pdfVfsJp } from '../utils/pdf-vfs-fonts-jp';
import { createBonusPaymentDocument } from '../utils/document-templates/bonus-payment';
import { createQualificationAcquisitionDocument } from '../utils/document-templates/qualification-acquisition';
import { createQualificationLossDocument } from '../utils/document-templates/qualification-loss';

export type DocumentType =
  | 'qualification_acquisition'
  | 'qualification_loss'
  | 'bonus_payment';

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

export type DocumentPayload =
  | { type: 'qualification_acquisition'; payload: QualificationAcquisitionPayload }
  | { type: 'qualification_loss'; payload: QualificationLossPayload }
  | { type: 'bonus_payment'; payload: BonusPaymentPayload };

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
        default:
          return 'document';
      }
    })();

    const employeeName = 'employee' in document.payload ? document.payload.employee?.name : '';
    const suffix = employeeName ? `-${employeeName}` : '';
    return `${baseName}${suffix}.pdf`;
  }
}
