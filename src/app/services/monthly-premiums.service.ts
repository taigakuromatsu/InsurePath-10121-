import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDocs, query, setDoc, where } from '@angular/fire/firestore';
import { from, map, Observable } from 'rxjs';

import { Employee, IsoDateString, MonthlyPremium, YearMonthString } from '../types';
import {
  calculateMonthlyPremiumForEmployee,
  MonthlyPremiumCalculationResult,
  PremiumRateContext
} from '../utils/premium-calculator';

export interface SaveForMonthOptions {
  officeId: string;
  yearMonth: YearMonthString;
  calcDate: IsoDateString;
  healthRate: number;
  careRate?: number;
  pensionRate: number;
  employees: Employee[];
  calculatedByUserId: string;
}

@Injectable({ providedIn: 'root' })
export class MonthlyPremiumsService {
  constructor(private readonly firestore: Firestore) {}

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

    return {
      id: docId,
      officeId: result.officeId,
      employeeId: result.employeeId,
      yearMonth: result.yearMonth,

      // 等級・標準報酬のスナップショット
      healthGrade: result.healthGrade,
      healthStandardMonthly: result.healthStandardMonthly,
      healthGradeSource: employee.healthGradeSource,

      pensionGrade: result.pensionGrade,
      pensionStandardMonthly: result.pensionStandardMonthly,
      pensionGradeSource: employee.pensionGradeSource,

      // 金額
      healthTotal: result.amounts.healthTotal,
      healthEmployee: result.amounts.healthEmployee,
      healthEmployer: result.amounts.healthEmployer,

      // 介護保険（0 の場合は undefined でも可、ただし 0 を明示的に保存する方が分かりやすい）
      careTotal: result.amounts.careTotal > 0 ? result.amounts.careTotal : undefined,
      careEmployee: result.amounts.careTotal > 0 ? result.amounts.careEmployee : undefined,
      careEmployer: result.amounts.careTotal > 0 ? result.amounts.careEmployer : undefined,

      pensionTotal: result.amounts.pensionTotal,
      pensionEmployee: result.amounts.pensionEmployee,
      pensionEmployer: result.amounts.pensionEmployer,

      totalEmployee: result.amounts.totalEmployee,
      totalEmployer: result.amounts.totalEmployer,

      // メタ情報
      calculatedAt: calcDate,
      calculatedByUserId
    };
  }

  /**
   * 指定年月の月次保険料を一括計算・保存する
   *
   * @param options - 計算・保存オプション
   * @returns 保存した MonthlyPremium の配列
   */
  async saveForMonth(options: SaveForMonthOptions): Promise<MonthlyPremium[]> {
    const { officeId, yearMonth, calcDate, healthRate, careRate, pensionRate, employees, calculatedByUserId } = options;

    // PremiumRateContext を組み立て
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
}
