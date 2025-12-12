import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where
} from '@angular/fire/firestore';
import { firstValueFrom, from, map, Observable } from 'rxjs';

import { Employee, IsoDateString, MonthlyPremium, YearMonthString } from '../types';
import {
  calculateMonthlyPremiumForEmployee,
  MonthlyPremiumCalculationResult,
  PremiumRateContext
} from '../utils/premium-calculator';
import { OfficesService } from './offices.service';
import { MastersService } from './masters.service';

export interface SaveForMonthOptions {
  officeId: string;
  yearMonth: YearMonthString;
  calcDate: IsoDateString;
  employees: Employee[];
  calculatedByUserId: string;
}

@Injectable({ providedIn: 'root' })
export class MonthlyPremiumsService {
  constructor(
    private readonly firestore: Firestore,
    private readonly officesService: OfficesService,
    private readonly mastersService: MastersService
  ) {}

  private getCollectionRef(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'monthlyPremiums');
  }

  private buildDocId(employeeId: string, yearMonth: YearMonthString): string {
    return `${employeeId}_${yearMonth}`;
  }

  /**
   * 計算結果を MonthlyPremium ドキュメントに変換する
   *
   * @param employee - 従業員情報（等級ソース等を取得するため）
   * @param result - 計算結果
   * @param calcDate - 計算実行日時
   * @param calculatedByUserId - 計算実行ユーザーID
   * @returns MonthlyPremium オブジェクト
   */
  private fromCalculationResult(
    employee: Employee,
    result: MonthlyPremiumCalculationResult,
    calcDate: IsoDateString,
    calculatedByUserId: string
  ): MonthlyPremium {
    const docId = this.buildDocId(result.employeeId, result.yearMonth);
  
    // まず必須フィールドだけ詰める
    const base: MonthlyPremium = {
      id: docId,
      officeId: result.officeId,
      employeeId: result.employeeId,
      yearMonth: result.yearMonth,
  
      // 等級・標準報酬のスナップショット
      healthGrade: result.healthGrade,
      healthStandardMonthly: result.healthStandardMonthly,
  
      pensionGrade: result.pensionGrade,
      pensionStandardMonthly: result.pensionStandardMonthly,
  
      // 新フィールド（行レベル参考値）
      healthCareFull: result.amounts.healthCareFull,
      healthCareEmployee: result.amounts.healthCareEmployee,
      healthCareEmployer: result.amounts.healthCareEmployer,
      pensionFull: result.amounts.pensionFull,
      totalFull: result.amounts.totalFull,
      totalEmployee: result.amounts.totalEmployee,
      totalEmployer: result.amounts.totalEmployer,

      // 金額（必須分）
      healthTotal: result.amounts.healthTotal,
      healthEmployee: result.amounts.healthEmployee,
      healthEmployer: result.amounts.healthEmployer,
  
      pensionTotal: result.amounts.pensionTotal,
      pensionEmployee: result.amounts.pensionEmployee,
      pensionEmployer: result.amounts.pensionEmployer,
  
      // メタ情報
      calculatedAt: calcDate,
      calculatedByUserId
    };
  
    // ===== オプションフィールドを条件付きで追加 =====
  
    // 等級ソース：Employee側に入っているときだけセット
    if (employee.healthGradeSource != null) {
      (base as any).healthGradeSource = employee.healthGradeSource;
    }
    if (employee.pensionGradeSource != null) {
      (base as any).pensionGradeSource = employee.pensionGradeSource;
    }
  
    // 介護保険（分離しないが後方互換で残す）
      (base as any).careTotal = result.amounts.careTotal;
      (base as any).careEmployee = result.amounts.careEmployee;
      (base as any).careEmployer = result.amounts.careEmployer;
  
    return base;
  }
  

  /**
   * 指定年月の月次保険料を一括計算・保存する
   *
   * @param options - 計算・保存オプション
   * @returns 保存した MonthlyPremium の配列
   */
  async saveForMonth(options: SaveForMonthOptions): Promise<MonthlyPremium[]> {
    const { officeId, yearMonth, calcDate, employees, calculatedByUserId } = options;

    const office = await firstValueFrom(this.officesService.watchOffice(officeId));
    if (!office) {
      throw new Error(`事業所が見つかりません: ${officeId}`);
    }

    const { healthRate, careRate, pensionRate } = await this.mastersService.getRatesForYearMonth(
      office,
      yearMonth
    );

    if (healthRate == null || pensionRate == null) {
      throw new Error('healthRate / pensionRate がマスタに設定されていません');
    }

    const rateContext: PremiumRateContext = {
      yearMonth,
      calcDate,
      healthRate,
      careRate,
      pensionRate
    };

    // 計算結果を格納する配列
    const premiumsToSave: MonthlyPremium[] = [];

    // 各従業員について計算
    for (const employee of employees) {
      // 計算実行
      const result = calculateMonthlyPremiumForEmployee(employee, rateContext);

      // null の場合はスキップ（未加入・標準報酬未設定など）
      if (!result) {
        continue;
      }

      // MonthlyPremium に変換
      const monthlyPremium = this.fromCalculationResult(employee, result, calcDate, calculatedByUserId);

      premiumsToSave.push(monthlyPremium);
    }

    // Firestore に保存（Promise.all で並列実行）
    const collectionRef = this.getCollectionRef(officeId);
    await Promise.all(
      premiumsToSave.map((premium) => {
        const docRef = doc(collectionRef, premium.id);
        return setDoc(docRef, premium, { merge: true });
      })
    );

    return premiumsToSave;
  }

  /**
   * 指定事業所・指定年月の月次保険料一覧を取得する
   *
   * @param officeId - 事業所ID
   * @param yearMonth - 対象年月（YYYY-MM形式）
   * @returns MonthlyPremium の配列（Observable）
   */
  listByOfficeAndYearMonth(officeId: string, yearMonth: YearMonthString): Observable<MonthlyPremium[]> {
    const collectionRef = this.getCollectionRef(officeId);
    const q = query(collectionRef, where('yearMonth', '==', yearMonth));

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as MonthlyPremium)
        )
      )
    );
  }

  /**
   * 指定事業所・従業員の直近12ヶ月分の月次保険料を取得する
   */
  listByOfficeAndEmployee(
    officeId: string,
    employeeId: string
  ): Observable<MonthlyPremium[]> {
    const collectionRef = this.getCollectionRef(officeId);
    const q = query(
      collectionRef,
      where('employeeId', '==', employeeId),
      orderBy('yearMonth', 'desc'),
      limit(12)
    );

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as MonthlyPremium)
        )
      )
    );
  }
}
