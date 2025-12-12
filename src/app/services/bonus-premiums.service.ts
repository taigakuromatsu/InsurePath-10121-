import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where
} from '@angular/fire/firestore';
import { firstValueFrom, from, map, Observable } from 'rxjs';

import { BonusPremium, IsoDateString, YearMonthString } from '../types';
import { getFiscalYear } from '../utils/bonus-calculator';

@Injectable({ providedIn: 'root' })
export class BonusPremiumsService {
  private readonly firestore = inject(Firestore);

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
   */
  listByOfficeAndYearMonth(
    officeId: string,
    yearMonth: YearMonthString
  ): Observable<BonusPremium[]> {
    const ref = this.getCollectionRef(officeId);
    const q = query(ref, orderBy('payDate', 'desc'));

    const targetYear = yearMonth.substring(0, 4);
    const targetMonth = yearMonth.substring(5, 7);

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as BonusPremium))
          .filter((b) =>
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
}
