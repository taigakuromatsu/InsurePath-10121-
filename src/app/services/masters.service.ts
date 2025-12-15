import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  limit,
  orderBy,
  query,
  setDoc,
  where
} from '@angular/fire/firestore';
import { firstValueFrom, from, map, Observable, of } from 'rxjs';

import {
  CareRateTable,
  HealthRateTable,
  Office,
  PensionRateTable,
  YearMonthString
} from '../types';

@Injectable({ providedIn: 'root' })
export class MastersService {
  private readonly injector = inject(EnvironmentInjector);
  constructor(private readonly firestore: Firestore) {}

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxP<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  private getHealthCollectionRef(officeId: string) {
    return this.inCtx(() => collection(this.firestore, 'offices', officeId, 'healthRateTables'));
  }

  private getCareCollectionRef(officeId: string) {
    return this.inCtx(() => collection(this.firestore, 'offices', officeId, 'careRateTables'));
  }

  private getPensionCollectionRef(officeId: string) {
    return this.inCtx(() => collection(this.firestore, 'offices', officeId, 'pensionRateTables'));
  }

  /**
   * 対象年月に有効な健康保険マスタ（等級表付き）を1件取得する
   */
  getHealthRateTableForYearMonth(
    office: Office,
    yearMonth: YearMonthString
  ): Observable<HealthRateTable | null> {
    return this.inCtx(() => {
    const targetYear = parseInt(yearMonth.substring(0, 4), 10);
    const targetMonth = parseInt(yearMonth.substring(5, 7), 10);
    const targetYearMonth = targetYear * 100 + targetMonth;
    const officeId = office.id;

    const healthRef = this.getHealthCollectionRef(officeId);
    let healthQuery;

    if (office.healthPlanType === 'kyokai' && office.kyokaiPrefCode) {
        healthQuery = this.inCtx(() => query(
        healthRef,
        where('planType', '==', 'kyokai'),
        where('kyokaiPrefCode', '==', office.kyokaiPrefCode),
        where('effectiveYearMonth', '<=', targetYearMonth),
        orderBy('effectiveYearMonth', 'desc'),
        limit(1)
        ));
    } else if (office.healthPlanType === 'kumiai') {
        healthQuery = this.inCtx(() => query(
        healthRef,
        where('planType', '==', 'kumiai'),
        where('effectiveYearMonth', '<=', targetYearMonth),
        orderBy('effectiveYearMonth', 'desc'),
        limit(1)
        ));
    } else {
      return of(null);
    }

      return from(this.inCtxP(() => getDocs(healthQuery))).pipe(
      map((snapshot) => {
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...(snapshot.docs[0].data() as any) } as HealthRateTable;
      })
    );
    });
  }

  /**
   * 対象年月に有効な厚生年金マスタ（等級表付き）を1件取得する
   */
  getPensionRateTableForYearMonth(
    office: Office,
    yearMonth: YearMonthString
  ): Observable<PensionRateTable | null> {
    return this.inCtx(() => {
    const targetYear = parseInt(yearMonth.substring(0, 4), 10);
    const targetMonth = parseInt(yearMonth.substring(5, 7), 10);
    const targetYearMonth = targetYear * 100 + targetMonth;
    const officeId = office.id;

    const pensionRef = this.getPensionCollectionRef(officeId);
      const pensionQuery = this.inCtx(() => query(
      pensionRef,
      where('effectiveYearMonth', '<=', targetYearMonth),
      orderBy('effectiveYearMonth', 'desc'),
      limit(1)
      ));

      return from(this.inCtxP(() => getDocs(pensionQuery))).pipe(
      map((snapshot) => {
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...(snapshot.docs[0].data() as any) } as PensionRateTable;
      })
    );
    });
  }

  listHealthRateTables(officeId: string): Observable<HealthRateTable[]> {
    return this.inCtx(() => {
    const ref = this.getHealthCollectionRef(officeId);
      const q = this.inCtx(() => query(ref, orderBy('effectiveYearMonth', 'desc')));

      return collectionData(q, { idField: 'id' }) as Observable<HealthRateTable[]>;
    });
  }

  getHealthRateTable(officeId: string, id: string): Observable<HealthRateTable | null> {
    return this.inCtx(() => {
      const ref = this.inCtx(() => doc(this.getHealthCollectionRef(officeId), id));
      return from(this.inCtxP(() => getDoc(ref))).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }
        return {
          id: snapshot.id,
          ...(snapshot.data() as any)
        } as HealthRateTable;
      })
    );
    });
  }

  async saveHealthRateTable(
    officeId: string,
    table: Partial<HealthRateTable> & { id?: string }
  ): Promise<void> {
    const collectionRef = this.getHealthCollectionRef(officeId);
    const ref = this.inCtx(() => table.id ? doc(collectionRef, table.id) : doc(collectionRef));
    const now = new Date().toISOString();

    // まずローカル変数に「実際に使う年・月」を決定する（デフォルト値を適用）
    const effectiveYear = Number(table.effectiveYear ?? new Date().getFullYear());
    const effectiveMonth = Number(table.effectiveMonth ?? 3); // デフォルトは3月

    // effectiveYearMonthを計算（既に計算済みの場合はそれを使用、なければ計算）
    const effectiveYearMonth =
      table.effectiveYearMonth ?? effectiveYear * 100 + effectiveMonth;

    const payload: HealthRateTable = {
      id: ref.id,
      officeId,
      effectiveYear,
      effectiveMonth,
      effectiveYearMonth,
      planType: table.planType ?? 'kyokai',
      healthRate: Number(table.healthRate ?? 0),
      bands: table.bands ?? [],
      createdAt: table.createdAt ?? now,
      updatedAt: now
    };

    if (table.kyokaiPrefCode != null) payload.kyokaiPrefCode = table.kyokaiPrefCode;
    if (table.kyokaiPrefName != null) payload.kyokaiPrefName = table.kyokaiPrefName;
    if (table.unionName != null) payload.unionName = table.unionName;
    if (table.unionCode != null) payload.unionCode = table.unionCode;

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    ) as HealthRateTable;

    await this.inCtxP(() => setDoc(ref, cleanPayload, { merge: true }));
  }

  /**
   * 健康保険マスタの重複チェック
   * 同じeffectiveYearMonth + planType + (kyokaiPrefCode or unionCode)のマスタが存在するか確認
   */
  async checkHealthRateTableDuplicate(
    officeId: string,
    effectiveYearMonth: number,
    planType: 'kyokai' | 'kumiai',
    kyokaiPrefCode?: string,
    unionCode?: string,
    excludeId?: string
  ): Promise<HealthRateTable | null> {
    const ref = this.getHealthCollectionRef(officeId);
    let q;

    if (planType === 'kyokai' && kyokaiPrefCode) {
      q = this.inCtx(() => query(
        ref,
        where('effectiveYearMonth', '==', effectiveYearMonth),
        where('planType', '==', 'kyokai'),
        where('kyokaiPrefCode', '==', kyokaiPrefCode)
      ));
    } else if (planType === 'kumiai') {
      const baseQuery = this.inCtx(() => query(
        ref,
        where('effectiveYearMonth', '==', effectiveYearMonth),
        where('planType', '==', 'kumiai')
      ));
      q = unionCode
        ? this.inCtx(() => query(baseQuery, where('unionCode', '==', unionCode)))
        : baseQuery;
    } else {
      return null;
    }

    const snapshot = await firstValueFrom(from(this.inCtxP(() => getDocs(q))));
    const existing = snapshot.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) } as HealthRateTable))
      .find((t) => !excludeId || t.id !== excludeId);

    return existing || null;
  }

  /**
   * 介護保険マスタの重複チェック
   */
  async checkCareRateTableDuplicate(
    officeId: string,
    effectiveYearMonth: number,
    excludeId?: string
  ): Promise<CareRateTable | null> {
    const ref = this.getCareCollectionRef(officeId);
    const q = this.inCtx(() => query(ref, where('effectiveYearMonth', '==', effectiveYearMonth)));

    const snapshot = await firstValueFrom(from(this.inCtxP(() => getDocs(q))));
    const existing = snapshot.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) } as CareRateTable))
      .find((t) => !excludeId || t.id !== excludeId);

    return existing || null;
  }

  /**
   * 厚生年金マスタの重複チェック
   */
  async checkPensionRateTableDuplicate(
    officeId: string,
    effectiveYearMonth: number,
    excludeId?: string
  ): Promise<PensionRateTable | null> {
    const ref = this.getPensionCollectionRef(officeId);
    const q = this.inCtx(() => query(ref, where('effectiveYearMonth', '==', effectiveYearMonth)));

    const snapshot = await firstValueFrom(from(this.inCtxP(() => getDocs(q))));
    const existing = snapshot.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) } as PensionRateTable))
      .find((t) => !excludeId || t.id !== excludeId);

    return existing || null;
  }

  /**
   * 健康保険マスタをすべて削除する（プラン変更時などに使用）
   */
  async deleteAllHealthRateTables(officeId: string): Promise<void> {
    const ref = this.getHealthCollectionRef(officeId);
    const snapshot = await firstValueFrom(from(this.inCtxP(() => getDocs(ref))));

    if (snapshot.empty) return;

    const batch = this.inCtx(() => writeBatch(this.firestore));
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await this.inCtxP(() => batch.commit());
  }

  async deleteHealthRateTable(officeId: string, id: string): Promise<void> {
    const ref = this.inCtx(() => doc(this.getHealthCollectionRef(officeId), id));
    return this.inCtxP(() => deleteDoc(ref));
  }

  listCareRateTables(officeId: string): Observable<CareRateTable[]> {
    return this.inCtx(() => {
    const ref = this.getCareCollectionRef(officeId);
      const q = this.inCtx(() => query(ref, orderBy('effectiveYearMonth', 'desc')));

      return collectionData(q, { idField: 'id' }) as Observable<CareRateTable[]>;
    });
  }

  getCareRateTable(officeId: string, id: string): Observable<CareRateTable | null> {
    return this.inCtx(() => {
      const ref = this.inCtx(() => doc(this.getCareCollectionRef(officeId), id));
      return from(this.inCtxP(() => getDoc(ref))).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }
        return {
          id: snapshot.id,
          ...(snapshot.data() as any)
        } as CareRateTable;
      })
    );
    });
  }

  async saveCareRateTable(
    officeId: string,
    table: Partial<CareRateTable> & { id?: string }
  ): Promise<void> {
    const collectionRef = this.getCareCollectionRef(officeId);
    const ref = this.inCtx(() => table.id ? doc(collectionRef, table.id) : doc(collectionRef));
    const now = new Date().toISOString();

    // まずローカル変数に「実際に使う年・月」を決定する（デフォルト値を適用）
    const effectiveYear = Number(table.effectiveYear ?? new Date().getFullYear());
    const effectiveMonth = Number(table.effectiveMonth ?? 3); // デフォルトは3月

    // effectiveYearMonthを計算（既に計算済みの場合はそれを使用、なければ計算）
    const effectiveYearMonth =
      table.effectiveYearMonth ?? effectiveYear * 100 + effectiveMonth;

    const payload: CareRateTable = {
      id: ref.id,
      officeId,
      effectiveYear,
      effectiveMonth,
      effectiveYearMonth,
      careRate: Number(table.careRate ?? 0),
      createdAt: table.createdAt ?? now,
      updatedAt: now
    };

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    ) as CareRateTable;

    await this.inCtxP(() => setDoc(ref, cleanPayload, { merge: true }));
  }

  async deleteCareRateTable(officeId: string, id: string): Promise<void> {
    const ref = this.inCtx(() => doc(this.getCareCollectionRef(officeId), id));
    return this.inCtxP(() => deleteDoc(ref));
  }

  listPensionRateTables(officeId: string): Observable<PensionRateTable[]> {
    return this.inCtx(() => {
    const ref = this.getPensionCollectionRef(officeId);
      const q = this.inCtx(() => query(ref, orderBy('effectiveYearMonth', 'desc')));

      return collectionData(q, { idField: 'id' }) as Observable<PensionRateTable[]>;
    });
  }

  getPensionRateTable(officeId: string, id: string): Observable<PensionRateTable | null> {
    return this.inCtx(() => {
      const ref = this.inCtx(() => doc(this.getPensionCollectionRef(officeId), id));
      return from(this.inCtxP(() => getDoc(ref))).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }
        return {
          id: snapshot.id,
          ...(snapshot.data() as any)
        } as PensionRateTable;
      })
    );
    });
  }

  async savePensionRateTable(
    officeId: string,
    table: Partial<PensionRateTable> & { id?: string }
  ): Promise<void> {
    const collectionRef = this.getPensionCollectionRef(officeId);
    const ref = this.inCtx(() => table.id ? doc(collectionRef, table.id) : doc(collectionRef));
    const now = new Date().toISOString();

    // まずローカル変数に「実際に使う年・月」を決定する（デフォルト値を適用）
    const effectiveYear = Number(table.effectiveYear ?? new Date().getFullYear());
    const effectiveMonth = Number(table.effectiveMonth ?? 3); // デフォルトは3月

    // effectiveYearMonthを計算（既に計算済みの場合はそれを使用、なければ計算）
    const effectiveYearMonth =
      table.effectiveYearMonth ?? effectiveYear * 100 + effectiveMonth;

    const payload: PensionRateTable = {
      id: ref.id,
      officeId,
      effectiveYear,
      effectiveMonth,
      effectiveYearMonth,
      pensionRate: Number(table.pensionRate ?? 0),
      bands: table.bands ?? [],
      createdAt: table.createdAt ?? now,
      updatedAt: now
    };

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    ) as PensionRateTable;

    await this.inCtxP(() => setDoc(ref, cleanPayload, { merge: true }));
  }

  async deletePensionRateTable(officeId: string, id: string): Promise<void> {
    const ref = this.inCtx(() => doc(this.getPensionCollectionRef(officeId), id));
    return this.inCtxP(() => deleteDoc(ref));
  }

  /**
   * 対象年月に有効な最新の保険料率を取得する
   * ⚠️ 重要: 既存のシグネチャ（引数・戻り値の型）を壊さないように注意すること。
   * 既存の呼び出し側（monthly-premiums.service.ts、simulator.page.ts、bonus-form-dialog.component.tsなど）は変更不要になるように実装する。
   */
  async getRatesForYearMonth(
    office: Office,
    yearMonth: YearMonthString
  ): Promise<{
    healthRate?: number;
    careRate?: number;
    pensionRate?: number;
  }> {
    const targetYear = parseInt(yearMonth.substring(0, 4), 10);
    const targetMonth = parseInt(yearMonth.substring(5, 7), 10);
    const targetYearMonth = targetYear * 100 + targetMonth;
    const officeId = office.id;

    const results: {
      healthRate?: number;
      careRate?: number;
      pensionRate?: number;
    } = {};

    // 健康保険マスタの取得
    if (office.healthPlanType === 'kyokai' && office.kyokaiPrefCode) {
      const healthRef = this.getHealthCollectionRef(officeId);
      const healthQuery = this.inCtx(() => query(
        healthRef,
        where('planType', '==', 'kyokai'),
        where('kyokaiPrefCode', '==', office.kyokaiPrefCode),
        where('effectiveYearMonth', '<=', targetYearMonth),
        orderBy('effectiveYearMonth', 'desc'),
        limit(1)
      ));
      const healthSnapshot = await firstValueFrom(from(this.inCtxP(() => getDocs(healthQuery))));
      if (!healthSnapshot.empty) {
        results.healthRate = healthSnapshot.docs[0].data()['healthRate'] as number;
      }
    } else if (office.healthPlanType === 'kumiai') {
      const healthRef = this.getHealthCollectionRef(officeId);
      const healthQuery = this.inCtx(() => query(
        healthRef,
        where('planType', '==', 'kumiai'),
        where('effectiveYearMonth', '<=', targetYearMonth),
        orderBy('effectiveYearMonth', 'desc'),
        limit(1)
      ));
      const healthSnapshot = await firstValueFrom(from(this.inCtxP(() => getDocs(healthQuery))));
      if (!healthSnapshot.empty) {
        results.healthRate = healthSnapshot.docs[0].data()['healthRate'] as number;
      }
    }

    // 介護保険マスタの取得
    const careRef = this.getCareCollectionRef(officeId);
    const careQuery = this.inCtx(() => query(
      careRef,
      where('effectiveYearMonth', '<=', targetYearMonth),
      orderBy('effectiveYearMonth', 'desc'),
      limit(1)
    ));
    const careSnapshot = await firstValueFrom(from(this.inCtxP(() => getDocs(careQuery))));
    if (!careSnapshot.empty) {
      results.careRate = careSnapshot.docs[0].data()['careRate'] as number;
    }

    // 厚生年金マスタの取得
    const pensionRef = this.getPensionCollectionRef(officeId);
    const pensionQuery = this.inCtx(() => query(
      pensionRef,
      where('effectiveYearMonth', '<=', targetYearMonth),
      orderBy('effectiveYearMonth', 'desc'),
      limit(1)
    ));
    const pensionSnapshot = await firstValueFrom(from(this.inCtxP(() => getDocs(pensionQuery))));
    if (!pensionSnapshot.empty) {
      results.pensionRate = pensionSnapshot.docs[0].data()['pensionRate'] as number;
    }

    return results;
  }
}
