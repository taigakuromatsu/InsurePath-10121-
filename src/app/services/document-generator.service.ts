import { Injectable, inject } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { firstValueFrom } from 'rxjs';

import { BonusPremium, Employee, InsuranceKind, Office, StandardRewardHistory, YearMonthString } from '../types';
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
import { buildQualificationAcquisitionBatchDefinition, QualificationAcquisitionPdfRow } from '../utils/document-templates/qualification-acquisition-batch';
import { buildQualificationLossBatchDefinition, QualificationLossPdfRow } from '../utils/document-templates/qualification-loss-batch';
import { DependentsService } from './dependents.service';
import { StandardRewardHistoryService } from './standard-reward-history.service';
import { formatCurrency, formatJapaneseEraDate, formatQualificationKind, formatLossReason, formatSexLabel } from '../utils/document-helpers';

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
  standardMonthlyReward?: number | null;
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
  private readonly dependentsService = inject(DependentsService);
  private readonly standardRewardHistoryService = inject(StandardRewardHistoryService);
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

  /**
   * 標準報酬月額を解決する（保険種別対応）
   * 
   * 解決順位:
   * 1. 指定保険種別の StandardRewardHistory（対象年月以前の最新）
   * 2. Employee の healthStandardMonthly / pensionStandardMonthly
   * 3. employeeFallback（後方互換性のため）
   * 
   * @param histories 標準報酬履歴のリスト
   * @param employeeFallback 従業員の標準報酬（後方互換性のため）
   * @param insuranceKind 保険種別（オプショナル、指定されない場合は全履歴から最新を取得）
   * @param targetYearMonth 対象年月（オプショナル、指定されない場合は最新履歴を使用）
   * @param employee 従業員オブジェクト（保険種別に応じた標準報酬を取得するため）
   */
  resolveStandardMonthlyReward(
    histories: StandardRewardHistory[] | null | undefined,
    employeeFallback?: number | null,
    insuranceKind?: InsuranceKind,
    targetYearMonth?: YearMonthString,
    employee?: Employee
  ): number | null {
    // 1. 指定保険種別の履歴から解決
    if (histories && histories.length > 0) {
      let filteredHistories = histories;
      
      // 保険種別でフィルタ
      if (insuranceKind) {
        filteredHistories = histories.filter((h) => h.insuranceKind === insuranceKind);
      }
      
      if (filteredHistories.length > 0) {
        if (targetYearMonth) {
          // 対象年月以前の最新履歴を探す
          const targetYearMonthNum = this.yearMonthToNumber(targetYearMonth);
          if (targetYearMonthNum == null) {
            // 無効な年月形式の場合はスキップ
          } else {
            const applicableHistory = filteredHistories
              .filter((h) => {
                const appliedNum = this.yearMonthToNumber(h.appliedFromYearMonth);
                return appliedNum != null && appliedNum <= targetYearMonthNum;
              })
              .sort((a, b) => {
                const aNum = this.yearMonthToNumber(a.appliedFromYearMonth) ?? 0;
                const bNum = this.yearMonthToNumber(b.appliedFromYearMonth) ?? 0;
                return bNum - aNum;
              })[0];
            
            if (applicableHistory) {
              return applicableHistory.standardMonthlyReward;
            }
          }
        } else {
          // 対象年月が指定されていない場合は最新履歴を使用
          const sorted = [...filteredHistories].sort(
            (a, b) => b.appliedFromYearMonth.localeCompare(a.appliedFromYearMonth)
          );
          return sorted[0]?.standardMonthlyReward ?? null;
        }
      }
    }

    // 2. Employee の標準報酬から解決
    if (employee && insuranceKind) {
      if (insuranceKind === 'health' && employee.healthStandardMonthly != null) {
        return employee.healthStandardMonthly;
      }
      if (insuranceKind === 'pension' && employee.pensionStandardMonthly != null) {
        return employee.pensionStandardMonthly;
      }
    }

    // 3. employeeFallback（後方互換性）
    if (employeeFallback !== undefined && employeeFallback !== null) {
      return employeeFallback;
    }

    return null;
  }

  /**
   * 年月文字列（YYYY-MM）を数値に変換（比較用）
   * 無効な形式の場合はnullを返す
   */
  private yearMonthToNumber(yearMonth: string): number | null {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return null;
    }
    const [year, month] = yearMonth.split('-').map(Number);
    return year * 100 + month;
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

  /**
   * 資格取得届・資格喪失届のバッチ生成
   * @param office 事業所
   * @param employees 対象従業員リスト
   * @param type 資格取得届または資格喪失届
   * @param action PDFアクション
   */
  async generateQualificationBatch(
    office: Office,
    employees: Employee[],
    type: 'qualification_acquisition' | 'qualification_loss',
    action: DocumentAction
  ): Promise<void> {
    this.ensureFonts();

    if (type === 'qualification_acquisition') {
      const rows = await this.buildQualificationAcquisitionRows(office, employees);
      const definition = buildQualificationAcquisitionBatchDefinition(office, rows);
      const pdf = pdfMake.createPdf(definition);
      const fileName = `資格取得届_n${employees.length}.pdf`;

      switch (action) {
        case 'download':
          pdf.download(fileName);
          break;
        case 'print':
          pdf.print();
          break;
        case 'open':
        default:
          pdf.open();
          break;
      }
    } else {
      const rows = await this.buildQualificationLossRows(office, employees);
      const definition = buildQualificationLossBatchDefinition(office, rows);
      const pdf = pdfMake.createPdf(definition);
      const fileName = `資格喪失届_n${employees.length}.pdf`;

      switch (action) {
        case 'download':
          pdf.download(fileName);
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
  }

  /**
   * 資格取得届のPDF行データを構築
   */
  private async buildQualificationAcquisitionRows(
    office: Office,
    employees: Employee[]
  ): Promise<QualificationAcquisitionPdfRow[]> {
    const rows: QualificationAcquisitionPdfRow[] = [];

    // 扶養家族の有無を並列取得
    const dependentsMap = new Map<string, boolean>();
    await Promise.all(
      employees.map(async (emp) => {
        try {
          const hasDeps = await this.dependentsService.hasAny(office.id, emp.id);
          dependentsMap.set(emp.id, hasDeps);
        } catch (error) {
          console.error(`扶養家族の取得に失敗しました (employeeId: ${emp.id}):`, error);
          dependentsMap.set(emp.id, false);
        }
      })
    );

    // 標準報酬履歴を取得（各従業員ごと）
    const historiesMap = new Map<string, StandardRewardHistory[]>();
    await Promise.all(
      employees.map(async (emp) => {
        try {
          const histories = await firstValueFrom(this.standardRewardHistoryService.list(office.id, emp.id));
          historiesMap.set(emp.id, histories || []);
        } catch (error) {
          console.error(`標準報酬履歴の取得に失敗しました (employeeId: ${emp.id}):`, error);
          historiesMap.set(emp.id, []);
        }
      })
    );

    for (const employee of employees) {
      // (1) 被保険者整理番号: 被保険者番号が入力されている場合のみ記載（空なら空欄）
      const insuredNumber = employee.healthInsuredSymbol && employee.healthInsuredNumber
        ? `${employee.healthInsuredSymbol} ${employee.healthInsuredNumber}`
        : '';

      // (2) 氏名（フリガナ）
      const name = employee.name || '';
      const kana = employee.kana || '';

      // (3) 生年月日（元号）・(4) 種別
      const birthDate = employee.birthDate ? formatJapaneseEraDate(employee.birthDate) : '';
      const sex = formatSexLabel(employee.sex);

      // (5) 取得区分（健保・厚年（健康・新規採用、厚年・適用拡大）形式）
      const healthKind = formatQualificationKind(employee.healthQualificationKind);
      const pensionKind = formatQualificationKind(employee.pensionQualificationKind);
      const kindParts: string[] = [];
      if (healthKind) {
        kindParts.push(`健康・${healthKind}`);
      }
      if (pensionKind) {
        kindParts.push(`厚年・${pensionKind}`);
      }
      const qualificationKind = kindParts.length > 0
        ? `健保・厚年（${kindParts.join('、')}）`
        : '健保・厚年';

      // (6) 個人番号（なければ基礎年金番号）
      const myNumberOrPensionNumber = employee.myNumber || employee.pensionNumber || '';

      // (7) 取得年月日（健保/厚年 両方記載・和暦）
      const healthQualificationDate = employee.healthQualificationDate
        ? formatJapaneseEraDate(employee.healthQualificationDate)
        : '';
      const pensionQualificationDate = employee.pensionQualificationDate
        ? formatJapaneseEraDate(employee.pensionQualificationDate)
        : '';

      // (8) 扶養者: 「有」or「無」
      const hasDependents = dependentsMap.get(employee.id) ? '有' : '無';

      // (9) 報酬月額: 通貨（数値）として表示
      // payrollSettings?.insurableMonthlyWage を使用（標準報酬月額ではない）
      const monthlyWage = employee.payrollSettings?.insurableMonthlyWage !== undefined && employee.payrollSettings?.insurableMonthlyWage !== null
        ? formatCurrency(employee.payrollSettings.insurableMonthlyWage)
        : '';

      // (10) 備考: 70歳以上被用者の場合のみ記載
      // 判定基準日は「資格取得日」とする（過去の届出作成時の正確性のため）
      const referenceDateForAge = employee.healthQualificationDate || employee.pensionQualificationDate || null;
      let note = '';
      if (employee.birthDate && referenceDateForAge) {
        const age = this.calculateAge(employee.birthDate, referenceDateForAge);
        if (age !== null && age >= 70) {
          note = '70歳以上被用者';
        }
      }

      // (11) 住所: 〒+住所、住所カナがあれば追加
      const addressParts: string[] = [];
      if (employee.postalCode || employee.address) {
        const postalPart = employee.postalCode ? `〒${employee.postalCode}` : '';
        const addrPart = employee.address || '';
        addressParts.push([postalPart, addrPart].filter(Boolean).join(' '));
      }
      if (employee.addressKana) {
        addressParts.push(employee.addressKana);
      }
      const address = addressParts.join('\n');

      rows.push({
        insuredNumber,
        name,
        kana,
        birthDate,
        sex,
        qualificationKind,
        myNumberOrPensionNumber,
        healthQualificationDate,
        pensionQualificationDate,
        hasDependents,
        monthlyWage,
        note,
        address
      });
    }

    return rows;
  }

  /**
   * 資格喪失届のPDF行データを構築
   */
  private async buildQualificationLossRows(
    office: Office,
    employees: Employee[]
  ): Promise<QualificationLossPdfRow[]> {
    const rows: QualificationLossPdfRow[] = [];

    for (const employee of employees) {
      // (1) 被保険者整理番号: 被保険者番号が入力されている場合のみ記載（空なら空欄）
      const insuredNumber = employee.healthInsuredSymbol && employee.healthInsuredNumber
        ? `${employee.healthInsuredSymbol} ${employee.healthInsuredNumber}`
        : '';

      // (2) 氏名（フリガナ）
      const name = employee.name || '';
      const kana = employee.kana || '';

      // (3) 生年月日（元号）・(4) 種別
      const birthDate = employee.birthDate ? formatJapaneseEraDate(employee.birthDate) : '';
      const sex = formatSexLabel(employee.sex);

      // (5) 個人番号（基礎年金番号）
      const myNumberOrPensionNumber = employee.myNumber || employee.pensionNumber || '';

      // (6) 喪失年月日（健保/厚年 両方記載・和暦）
      const healthLossDate = employee.healthLossDate
        ? formatJapaneseEraDate(employee.healthLossDate)
        : '';
      const pensionLossDate = employee.pensionLossDate
        ? formatJapaneseEraDate(employee.pensionLossDate)
        : '';

      // (7) 喪失原因（健保/厚年 それぞれの喪失理由区分から読み取って記載）
      const healthLossReason = formatLossReason(employee.healthLossReasonKind);
      const pensionLossReason = formatLossReason(employee.pensionLossReasonKind);
      const retireDate = employee.retireDate ? formatJapaneseEraDate(employee.retireDate) : '';

      rows.push({
        insuredNumber,
        name,
        kana,
        birthDate,
        sex,
        myNumberOrPensionNumber,
        healthLossDate,
        pensionLossDate,
        healthLossReason,
        pensionLossReason,
        retireDate
      });
    }

    return rows;
  }

  /**
   * 年齢を計算（YYYY-MM-DD形式の日付文字列から）
   */
  private calculateAge(birthDate: string, referenceDate: string): number | null {
    if (!birthDate || !referenceDate) {
      return null;
    }

    const [by, bm, bd] = birthDate.split('-').map(n => parseInt(n, 10));
    const [ry, rm, rd] = referenceDate.split('-').map(n => parseInt(n, 10));

    if (!by || !bm || !bd || !ry || !rm || !rd) {
      return null;
    }

    const birth = new Date(by, bm - 1, bd);
    const reference = new Date(ry, rm - 1, rd);

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
}
