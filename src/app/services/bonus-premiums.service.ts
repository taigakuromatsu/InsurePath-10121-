import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where
} from '@angular/fire/firestore';
import { firstValueFrom, from, map, Observable } from 'rxjs';

import { BonusPremium, Employee, IsoDateString, Office, YearMonthString } from '../types';
import { calculateBonusPremium, getFiscalYear } from '../utils/bonus-calculator';
import { MastersService } from './masters.service';

@Injectable({ providedIn: 'root' })
export class BonusPremiumsService {
  private readonly firestore = inject(Firestore);
  private readonly mastersService = inject(MastersService);

  private getCollectionRef(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'bonusPremiums');
  }

  private buildDocId(employeeId: string, payDate: IsoDateString): string {
    return `${employeeId}_${payDate}`;
  }

  /**
   * 事業所（＋任意で従業員）ごとの賞与支給履歴一覧
   */
  listByOfficeAndEmployee(
    officeId: string,
    employeeId?: string
  ): Observable<BonusPremium[]> {
    const ref = this.getCollectionRef(officeId);
    let q = query(ref, orderBy('payDate', 'desc'));

    if (employeeId) {
      q = query(q, where('employeeId', '==', employeeId));
    }

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as BonusPremium)
        )
      )
    );
  }

  /**
   * 事業所・対象年月ごとの賞与支給履歴一覧
   * リアルタイムリスナーを使用して、データ変更を自動的に検知します。
   */
  listByOfficeAndYearMonth(
    officeId: string,
    yearMonth: YearMonthString
  ): Observable<BonusPremium[]> {
    const ref = this.getCollectionRef(officeId);
    const q = query(ref, orderBy('payDate', 'desc'));

    const targetYear = yearMonth.substring(0, 4);
    const targetMonth = yearMonth.substring(5, 7);

    return collectionData(q, { idField: 'id' }).pipe(
      map((bonuses) =>
        (bonuses as BonusPremium[]).filter(
          (b) =>
            b.payDate.substring(0, 4) === targetYear && b.payDate.substring(5, 7) === targetMonth
          )
      )
    );
  }

  /**
   * 賞与支給履歴の保存（新規 or 更新）
   */
  async saveBonusPremium(
    officeId: string,
    bonus: Partial<BonusPremium> & { employeeId: string; payDate: IsoDateString },
    previousId?: string
  ): Promise<void> {
    const collectionRef = this.getCollectionRef(officeId);
    const docId = this.buildDocId(bonus.employeeId, bonus.payDate);
    const ref = doc(collectionRef, docId);
    const now = new Date().toISOString();

    const payload: BonusPremium = {
      id: docId,
      officeId,
      employeeId: bonus.employeeId,
      payDate: bonus.payDate,
      grossAmount: Number(bonus.grossAmount ?? 0),
      standardBonusAmount: Number(bonus.standardBonusAmount ?? 0),
      fiscalYear: bonus.fiscalYear ?? String(getFiscalYear(bonus.payDate)),
      // 上限関連（必須）
      healthEffectiveAmount: Number(bonus.healthEffectiveAmount ?? 0),
      healthExceededAmount: Number(bonus.healthExceededAmount ?? 0),
      healthStandardBonusCumulative: Number(bonus.healthStandardBonusCumulative ?? 0),
      pensionEffectiveAmount: Number(bonus.pensionEffectiveAmount ?? 0),
      pensionExceededAmount: Number(bonus.pensionExceededAmount ?? 0),
      // 新規追加フィールド（UI表示用の補助値）
      healthCareFull: bonus.healthCareFull != null ? Number(bonus.healthCareFull) : undefined,
      healthCareEmployee: bonus.healthCareEmployee != null ? Number(bonus.healthCareEmployee) : undefined,
      healthCareEmployer: bonus.healthCareEmployer != null ? Number(bonus.healthCareEmployer) : undefined,
      pensionFull: bonus.pensionFull != null ? Number(bonus.pensionFull) : undefined,
      totalFull: bonus.totalFull != null ? Number(bonus.totalFull) : undefined,
      // 既存フィールドを新ロジックの結果で上書き（月次と同じ意味）
      healthTotal: Number(bonus.healthTotal ?? 0),
      healthEmployee: Number(bonus.healthEmployee ?? 0),
      healthEmployer: Number(bonus.healthEmployer ?? 0),
      pensionTotal: Number(bonus.pensionTotal ?? 0),
      pensionEmployee: Number(bonus.pensionEmployee ?? 0),
      pensionEmployer: Number(bonus.pensionEmployer ?? 0),
      totalEmployee: Number(bonus.totalEmployee ?? 0),
      totalEmployer: Number(bonus.totalEmployer ?? 0),
      // オプション情報
      note: bonus.note ?? undefined,
      createdAt: bonus.createdAt ?? now,
      createdByUserId: bonus.createdByUserId
    };

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    ) as BonusPremium;

    await setDoc(ref, cleanPayload, { merge: true });

      // ★ 支給日 or 従業員ID変更で docId が変わった場合、旧ドキュメントを削除
    if (previousId && previousId !== docId) {
      const oldRef = doc(collectionRef, previousId);
      await deleteDoc(oldRef);
    }

  }

  /**
   * 賞与支給履歴の削除
   */
  async deleteBonusPremium(officeId: string, id: string): Promise<void> {
    const ref = doc(this.getCollectionRef(officeId), id);
    return deleteDoc(ref);
  }

  /**
   * 支給日が属する「7月1日〜翌年6月30日」の期間の開始日と終了日を取得
   * この関数は年4回制限チェック専用であり、他の機能には影響しない
   *
   * @param payDate 支給日
   * @returns 期間の開始日（7月1日）と終了日（翌年6月30日）をISO形式で返す
   */
  private getBonusLimitPeriod(payDate: IsoDateString): { startDate: IsoDateString; endDate: IsoDateString } {
    const date = new Date(payDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12

    let startYear: number;
    let endYear: number;

    if (month >= 7) {
      // 7月1日以降は、その年の7月1日〜翌年6月30日
      startYear = year;
      endYear = year + 1;
    } else {
      // 7月1日より前は、前年の7月1日〜その年の6月30日
      startYear = year - 1;
      endYear = year;
    }

    const startDate = `${startYear}-07-01` as IsoDateString;
    const endDate = `${endYear}-06-30` as IsoDateString;

    return { startDate, endDate };
  }

  /**
   * 指定期間内（7月1日〜翌年6月30日）の賞与支給回数を取得
   * この関数は年4回制限チェック専用であり、他の機能には影響しない
   *
   * @param officeId 事業所ID
   * @param employeeId 従業員ID
   * @param payDate 支給日（この日が属する期間を判定）
   * @param excludePayDate 編集時に自分自身を除外するための支給日（オプション）
   * @returns 期間内の賞与支給回数
   */
  async getBonusCountInPeriod(
    officeId: string,
    employeeId: string,
    payDate: IsoDateString,
    excludePayDate?: IsoDateString
  ): Promise<number> {
    const { startDate, endDate } = this.getBonusLimitPeriod(payDate);

    const ref = this.getCollectionRef(officeId);
    const q = query(
      ref,
      where('employeeId', '==', employeeId),
      orderBy('payDate', 'asc')
    );

    const snapshot = await getDocs(q);
    const bonuses = snapshot.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) } as BonusPremium))
      .filter((b) => {
        // 編集時に自分自身を除外
        if (excludePayDate && b.payDate === excludePayDate) {
          return false;
        }
        // 期間内かどうかを判定
        return b.payDate >= startDate && b.payDate <= endDate;
      });

    return bonuses.length;
  }

  /**
   * 健康保険の年度内累計標準賞与額（有効額）を取得する
   * 編集時には excludePayDate で現在編集中の支給日を除外できる
   */
  async getHealthStandardBonusCumulative(
    officeId: string,
    employeeId: string,
    fiscalYear: string,
    excludePayDate?: IsoDateString
  ): Promise<number> {
    const ref = this.getCollectionRef(officeId);
    const q = query(
      ref,
      where('employeeId', '==', employeeId),
      where('fiscalYear', '==', fiscalYear)
    );

    const snapshot = await firstValueFrom(from(getDocs(q)));
    const bonuses = snapshot.docs
      .map((d) => d.data() as BonusPremium)
      .filter((b) => !excludePayDate || b.payDate !== excludePayDate);

    return bonuses.reduce(
      (sum, b) => sum + (b.healthEffectiveAmount ?? b.standardBonusAmount),
      0
    );
  }

  /**
   * 同一従業員・同一年月の厚生年金用標準賞与額（pensionEffectiveAmount）の累計を取得する
   *
   * @param officeId 事業所ID
   * @param employeeId 従業員ID
   * @param yearMonth "YYYY-MM" 形式の年月
   * @param excludePayDate 編集時に「今回編集対象のレコード」を除外するための支給日
   */
  async getPensionStandardBonusMonthlyCumulative(
    officeId: string,
    employeeId: string,
    yearMonth: YearMonthString,
    excludePayDate?: IsoDateString
  ): Promise<number> {
    const ref = this.getCollectionRef(officeId);
    const targetYear = yearMonth.substring(0, 4);
    const targetMonth = yearMonth.substring(5, 7);

    const q = query(ref, where('employeeId', '==', employeeId));

    const snapshot = await firstValueFrom(from(getDocs(q)));
    const bonuses = snapshot.docs
      .map((d) => d.data() as BonusPremium)
      .filter((b) => {
        // 年月でフィルタ
        const bYear = b.payDate.substring(0, 4);
        const bMonth = b.payDate.substring(5, 7);
        if (bYear !== targetYear || bMonth !== targetMonth) {
          return false;
        }
        // 編集対象を除外
        if (excludePayDate && b.payDate === excludePayDate) {
          return false;
        }
        return true;
      });

    return bonuses.reduce((sum, b) => sum + (b.pensionEffectiveAmount ?? 0), 0);
  }

  /**
   * 従業員 × 年月 単位で賞与保険料を一括再計算する
   *
   * - 健康保険：年度内累計（他月分＋同月内の前レコード）を積み上げながら上限を判定
   * - 厚生年金：同一月内の累計（前レコード分）を積み上げながら上限を判定
   *
   * @param office 対象事業所
   * @param employee 対象従業員
   * @param yearMonth "YYYY-MM" 形式の対象年月
   */
  async recalculateForEmployeeMonth(
    office: Office,
    employee: Employee,
    yearMonth: YearMonthString
  ): Promise<void> {
    const officeId = office.id;
    const ref = this.getCollectionRef(officeId);

    // 対象年月から年度を算出（全レコード同一年度になる想定）
    const fiscalYear = String(getFiscalYear((`${yearMonth}-01`) as IsoDateString));

    // 対象従業員 × 対象年度の賞与レコードを取得（支給日昇順）
    const q = query(
      ref,
      where('employeeId', '==', employee.id),
      where('fiscalYear', '==', fiscalYear),
      orderBy('payDate', 'asc')
    );

    const snapshot = await getDocs(q);
    const allBonuses = snapshot.docs.map(
      (d) =>
        ({
          id: d.id,
          ...(d.data() as any)
        } as BonusPremium)
    );

    if (allBonuses.length === 0) {
      return;
    }

    const inMonth = allBonuses.filter((b) => b.payDate.substring(0, 7) === yearMonth);
    if (inMonth.length === 0) {
      return;
    }

    const otherMonths = allBonuses.filter((b) => b.payDate.substring(0, 7) !== yearMonth);

    // 健保の「他月分」累計（有効額ベース）
    let healthBase = otherMonths.reduce((sum, b) => {
      const effective = b.healthEffectiveAmount ?? b.standardBonusAmount ?? 0;
      return sum + effective;
    }, 0);

    // 対象年月の料率を取得（設定されていない場合は何もしない）
    const rates = await this.mastersService.getRatesForYearMonth(office, yearMonth);
    if (rates.healthRate == null || rates.pensionRate == null) {
      // 片方でも未設定なら再計算は行わない（現在の値を維持）
      return;
    }

    // 同一月内のレコードを「支給日→id」の順で安定ソート
    inMonth.sort((a, b) => {
      const d = a.payDate.localeCompare(b.payDate);
      if (d !== 0) return d;
      return (a.id ?? '').localeCompare(b.id ?? '');
    });

    let healthCumulative = healthBase; // 健保：年度内累計（この月より前＋同月内の前レコード）
    let pensionMonthlyCumulative = 0; // 厚年：同月内累計（前レコードの有効標準賞与額）

    for (const bonus of inMonth) {
      const result = calculateBonusPremium(
        officeId,
        employee,
        Number(bonus.grossAmount ?? 0),
        bonus.payDate as IsoDateString,
        healthCumulative,
        pensionMonthlyCumulative,
        rates.healthRate ?? 0,
        rates.careRate,
        rates.pensionRate ?? 0
      );

      // 何らかの理由で計算対象外になった場合はスキップ
      if (!result) {
        continue;
      }

      // 次レコード用に累計を更新
      healthCumulative = result.healthStandardBonusCumulative;
      pensionMonthlyCumulative += result.pensionEffectiveAmount;

      // 計算結果で上書きしたいフィールドだけを merge する
      const updated: Partial<BonusPremium> = {
        fiscalYear: result.fiscalYear,
        grossAmount: result.grossAmount,
        standardBonusAmount: result.standardBonusAmount,
        healthStandardBonusCumulative: result.healthStandardBonusCumulative,
        healthEffectiveAmount: result.healthEffectiveAmount,
        healthExceededAmount: result.healthExceededAmount,
        pensionEffectiveAmount: result.pensionEffectiveAmount,
        pensionExceededAmount: result.pensionExceededAmount,
        // UI 補助フィールド
        healthCareFull: result.healthCareFull,
        healthCareEmployee: result.healthCareEmployee,
        healthCareEmployer: result.healthCareEmployer,
        pensionFull: result.pensionFull,
        totalFull: result.totalFull,
        // 月次と同じ意味のフィールド群
        healthTotal: result.healthTotal,
        healthEmployee: result.healthEmployee,
        healthEmployer: result.healthEmployer,
        pensionTotal: result.pensionTotal,
        pensionEmployee: result.pensionEmployee,
        pensionEmployer: result.pensionEmployer,
        totalEmployee: result.totalEmployee,
        totalEmployer: result.totalEmployer
      };

      const docRef = doc(ref, bonus.id);
      await setDoc(docRef, updated, { merge: true });
    }
  }

  /**
   * 従業員 × 年度 単位で賞与保険料を一括再計算する
   *
   * - 健康保険：年度内累計をレコード順に積み上げながら上限判定
   * - 厚生年金：月単位で累計をリセットし、同月内の累計を使って上限判定
   *
   * @param office 対象事業所
   * @param employee 対象従業員
   * @param fiscalYear "YYYY" 形式の対象年度
   */
  async recalculateForEmployeeFiscalYear(
    office: Office,
    employee: Employee,
    fiscalYear: string
  ): Promise<void> {
    const officeId = office.id;
    const ref = this.getCollectionRef(officeId);

    // 対象従業員 × 対象年度 の賞与を支給日昇順で取得
    const q = query(
      ref,
      where('employeeId', '==', employee.id),
      where('fiscalYear', '==', fiscalYear),
      orderBy('payDate', 'asc')
    );

    const snapshot = await getDocs(q);
    const bonuses = snapshot.docs.map(
      (d) =>
        ({
          id: d.id,
          ...(d.data() as any)
        } as BonusPremium)
    );

    if (bonuses.length === 0) {
      // 対象年度に賞与がなければ何もしない
      return;
    }

    // 月ごとの料率をキャッシュ
    const rateCache = new Map<
      YearMonthString,
      Awaited<ReturnType<MastersService['getRatesForYearMonth']>>
    >();

    let healthCumulative = 0; // 健保：年度内累計
    let currentYearMonth: YearMonthString | null = null;
    let pensionMonthlyCumulative = 0; // 厚年：月内累計

    for (const bonus of bonuses) {
      const ym = bonus.payDate.substring(0, 7) as YearMonthString;

      // 月が変わったら厚年の月内累計をリセット
      if (currentYearMonth !== ym) {
        currentYearMonth = ym;
        pensionMonthlyCumulative = 0;
      }

      // 対象年月の料率をキャッシュ経由で取得
      let rates = rateCache.get(ym);
      if (!rates) {
        rates = await this.mastersService.getRatesForYearMonth(office, ym);
        rateCache.set(ym, rates);
      }

      // どちらか未設定ならこのレコードはスキップ（既存値を維持）
      if (rates.healthRate == null || rates.pensionRate == null) {
        continue;
      }

      const result = calculateBonusPremium(
        officeId,
        employee,
        Number(bonus.grossAmount ?? 0),
        bonus.payDate as IsoDateString,
        healthCumulative,
        pensionMonthlyCumulative,
        rates.healthRate ?? 0,
        rates.careRate,
        rates.pensionRate ?? 0
      );

      if (!result) {
        continue;
      }

      // 次レコード用に累計を更新
      healthCumulative = result.healthStandardBonusCumulative;
      pensionMonthlyCumulative += result.pensionEffectiveAmount;

      const updated: Partial<BonusPremium> = {
        fiscalYear: result.fiscalYear,
        grossAmount: result.grossAmount,
        standardBonusAmount: result.standardBonusAmount,
        healthStandardBonusCumulative: result.healthStandardBonusCumulative,
        healthEffectiveAmount: result.healthEffectiveAmount,
        healthExceededAmount: result.healthExceededAmount,
        pensionEffectiveAmount: result.pensionEffectiveAmount,
        pensionExceededAmount: result.pensionExceededAmount,
        // UI 補助フィールド
        healthCareFull: result.healthCareFull,
        healthCareEmployee: result.healthCareEmployee,
        healthCareEmployer: result.healthCareEmployer,
        pensionFull: result.pensionFull,
        totalFull: result.totalFull,
        // 月次と同じ意味のフィールド群
        healthTotal: result.healthTotal,
        healthEmployee: result.healthEmployee,
        healthEmployer: result.healthEmployer,
        pensionTotal: result.pensionTotal,
        pensionEmployee: result.pensionEmployee,
        pensionEmployer: result.pensionEmployer,
        totalEmployee: result.totalEmployee,
        totalEmployer: result.totalEmployer
      };

      await setDoc(doc(ref, bonus.id), updated, { merge: true });
    }
  }
}
