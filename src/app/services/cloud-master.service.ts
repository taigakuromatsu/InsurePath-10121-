// src/app/services/cloud-master.service.ts
import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where
} from '@angular/fire/firestore';
import { firstValueFrom, from, map, Observable } from 'rxjs';

import {
  CareRateTable,
  CloudCareRateTable,
  CloudHealthRateTable,
  CloudPensionRateTable,
  HealthRateTable,
  PensionRateTable
} from '../types';
import { CurrentUserService } from './current-user.service';

@Injectable({ providedIn: 'root' })
export class CloudMasterService {
  constructor(
    private readonly firestore: Firestore,
    private readonly currentUserService: CurrentUserService
  ) {}

  private removeUndefinedDeep<T>(value: T): T {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.removeUndefinedDeep(v)) as unknown as T;
    }

    const result: any = {};
    for (const [key, v] of Object.entries(value as any)) {
      if (v === undefined) {
        continue;
      }
      result[key] = this.removeUndefinedDeep(v);
    }
    return result;
  }

  private getHealthCollectionRef() {
    return collection(this.firestore, 'cloudHealthRateTables');
  }

  private getCareCollectionRef() {
    return collection(this.firestore, 'cloudCareRateTables');
  }

  private getPensionCollectionRef() {
    return collection(this.firestore, 'cloudPensionRateTables');
  }

  // ========== Health Rate Table ==========

  getCloudHealthRateTable(
    effectiveYear: number,
    effectiveMonth: number,
    prefCode: string
  ): Observable<CloudHealthRateTable | null> {
    const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;
    const id = `${effectiveYearMonth}_${prefCode}`;
    const ref = doc(this.firestore, 'cloudHealthRateTables', id);

    return from(getDoc(ref)).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }
        return {
          id: snapshot.id,
          ...(snapshot.data() as any)
        } as CloudHealthRateTable;
      })
    );
  }

  listCloudHealthRateTables(
    effectiveYear?: number
  ): Observable<CloudHealthRateTable[]> {
    const ref = this.getHealthCollectionRef();
    const q = effectiveYear
      ? query(
          ref,
          where('effectiveYear', '==', effectiveYear),
          orderBy('effectiveYearMonth', 'desc'),
          orderBy('kyokaiPrefCode', 'asc')
        )
      : query(ref, orderBy('effectiveYearMonth', 'desc'), orderBy('kyokaiPrefCode', 'asc'));

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as CloudHealthRateTable)
        )
      )
    );
  }

  async saveCloudHealthRateTable(
    table: Partial<CloudHealthRateTable> & { id?: string }
  ): Promise<void> {
    const user = await firstValueFrom(this.currentUserService.profile$);
    if (!user?.id) {
      throw new Error('ユーザー情報を取得できませんでした');
    }

    const now = new Date().toISOString();

    // まずローカル変数に「実際に使う年・月」を決定する（デフォルト値を適用）
    const effectiveYear = Number(table.effectiveYear ?? new Date().getFullYear());
    const effectiveMonth = Number(table.effectiveMonth ?? 3); // デフォルトは3月

    // effectiveYearMonthを計算（既に計算済みの場合はそれを使用、なければ計算）
    const effectiveYearMonth =
      table.effectiveYearMonth ?? effectiveYear * 100 + effectiveMonth;

    // kyokaiPrefCodeが必須であることを確認（Cloudマスタは協会けんぽ専用）
    if (!table.kyokaiPrefCode) {
      throw new Error('kyokaiPrefCodeが設定されていません');
    }

    const id = table.id ?? `${effectiveYearMonth}_${table.kyokaiPrefCode}`;

    const payload: Partial<CloudHealthRateTable> = {
      ...table,
      id,
      effectiveYear,
      effectiveMonth,
      effectiveYearMonth, // 必ず計算して含める
      planType: 'kyokai', // クラウドマスタは協会けんぽのみを管理するため強制設定
      updatedAt: now,
      updatedByUserId: user.id,
      createdAt: table.createdAt ?? now
    };

    const cleaned = this.removeUndefinedDeep(payload);
    const ref = doc(this.firestore, 'cloudHealthRateTables', id);
    await setDoc(ref, cleaned, { merge: true });
  }

  async deleteCloudHealthRateTable(
    effectiveYear: number,
    effectiveMonth: number,
    prefCode: string
  ): Promise<void> {
    const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;
    const id = `${effectiveYearMonth}_${prefCode}`;
    const ref = doc(this.firestore, 'cloudHealthRateTables', id);
    await deleteDoc(ref);
  }

  // ========== Care Rate Table ==========

  getCloudCareRateTable(
    effectiveYear: number,
    effectiveMonth: number
  ): Observable<CloudCareRateTable | null> {
    const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;
    const id = `${effectiveYearMonth}`;
    const ref = doc(this.firestore, 'cloudCareRateTables', id);

    return from(getDoc(ref)).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }
        return {
          id: snapshot.id,
          ...(snapshot.data() as any)
        } as CloudCareRateTable;
      })
    );
  }

  listCloudCareRateTables(): Observable<CloudCareRateTable[]> {
    const ref = this.getCareCollectionRef();
    const q = query(ref, orderBy('effectiveYearMonth', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as CloudCareRateTable)
        )
      )
    );
  }

  async saveCloudCareRateTable(
    table: Partial<CloudCareRateTable> & { id?: string }
  ): Promise<void> {
    const user = await firstValueFrom(this.currentUserService.profile$);
    if (!user?.id) {
      throw new Error('ユーザー情報を取得できませんでした');
    }

    const now = new Date().toISOString();

    // まずローカル変数に「実際に使う年・月」を決定する（デフォルト値を適用）
    const effectiveYear = Number(table.effectiveYear ?? new Date().getFullYear());
    const effectiveMonth = Number(table.effectiveMonth ?? 3); // デフォルトは3月

    // effectiveYearMonthを計算（既に計算済みの場合はそれを使用、なければ計算）
    const effectiveYearMonth =
      table.effectiveYearMonth ?? effectiveYear * 100 + effectiveMonth;

    const id = table.id ?? `${effectiveYearMonth}`;

    const payload: Partial<CloudCareRateTable> = {
      ...table,
      id,
      effectiveYear,
      effectiveMonth,
      effectiveYearMonth, // 必ず計算して含める
      updatedAt: now,
      updatedByUserId: user.id,
      createdAt: table.createdAt ?? now
    };

    const cleaned = this.removeUndefinedDeep(payload);
    const ref = doc(this.firestore, 'cloudCareRateTables', id);
    await setDoc(ref, cleaned, { merge: true });
  }

  async deleteCloudCareRateTable(
    effectiveYear: number,
    effectiveMonth: number
  ): Promise<void> {
    const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;
    const id = `${effectiveYearMonth}`;
    const ref = doc(this.firestore, 'cloudCareRateTables', id);
    await deleteDoc(ref);
  }

  // ========== Pension Rate Table ==========

  getCloudPensionRateTable(
    effectiveYear: number,
    effectiveMonth: number
  ): Observable<CloudPensionRateTable | null> {
    const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;
    const id = `${effectiveYearMonth}`;
    const ref = doc(this.firestore, 'cloudPensionRateTables', id);

    return from(getDoc(ref)).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }
        return {
          id: snapshot.id,
          ...(snapshot.data() as any)
        } as CloudPensionRateTable;
      })
    );
  }

  listCloudPensionRateTables(): Observable<CloudPensionRateTable[]> {
    const ref = this.getPensionCollectionRef();
    const q = query(ref, orderBy('effectiveYearMonth', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as CloudPensionRateTable)
        )
      )
    );
  }

  async saveCloudPensionRateTable(
    table: Partial<CloudPensionRateTable> & { id?: string }
  ): Promise<void> {
    const user = await firstValueFrom(this.currentUserService.profile$);
    if (!user?.id) {
      throw new Error('ユーザー情報を取得できませんでした');
    }

    const now = new Date().toISOString();

    // まずローカル変数に「実際に使う年・月」を決定する（デフォルト値を適用）
    const effectiveYear = Number(table.effectiveYear ?? new Date().getFullYear());
    const effectiveMonth = Number(table.effectiveMonth ?? 3); // デフォルトは3月

    // effectiveYearMonthを計算（既に計算済みの場合はそれを使用、なければ計算）
    const effectiveYearMonth =
      table.effectiveYearMonth ?? effectiveYear * 100 + effectiveMonth;

    const id = table.id ?? `${effectiveYearMonth}`;

    const payload: Partial<CloudPensionRateTable> = {
      ...table,
      id,
      effectiveYear,
      effectiveMonth,
      effectiveYearMonth, // 必ず計算して含める
      updatedAt: now,
      updatedByUserId: user.id,
      createdAt: table.createdAt ?? now
    };

    const cleaned = this.removeUndefinedDeep(payload);
    const ref = doc(this.firestore, 'cloudPensionRateTables', id);
    await setDoc(ref, cleaned, { merge: true });
  }

  async deleteCloudPensionRateTable(
    effectiveYear: number,
    effectiveMonth: number
  ): Promise<void> {
    const effectiveYearMonth = effectiveYear * 100 + effectiveMonth;
    const id = `${effectiveYearMonth}`;
    const ref = doc(this.firestore, 'cloudPensionRateTables', id);
    await deleteDoc(ref);
  }

  // ========== Preset Methods (for Office Masters) ==========

  /**
   * 対象年月に有効な最新の健康保険マスタを取得する
   */
  async getHealthRatePresetFromCloud(
    targetYear: number | string,
    targetMonth: number | string,
    prefCode: string
  ): Promise<Partial<HealthRateTable> | null> {
    try {
      // フォームから来た値がstringでも安全に処理するため、明示的に数値化
      const y = Number(targetYear);
      const m = Number(targetMonth);
      const targetYearMonth = y * 100 + m;
      const ref = this.getHealthCollectionRef();
      const q = query(
        ref,
        where('planType', '==', 'kyokai'),
        where('kyokaiPrefCode', '==', prefCode),
        where('effectiveYearMonth', '<=', targetYearMonth),
        orderBy('effectiveYearMonth', 'desc'),
        limit(1)
      );

      const snapshot = await firstValueFrom(from(getDocs(q)));
      if (snapshot.empty) {
        return null;
      }

      const data = snapshot.docs[0].data() as CloudHealthRateTable;
      return {
        effectiveYear: data.effectiveYear,
        effectiveMonth: data.effectiveMonth,
        effectiveYearMonth: data.effectiveYearMonth,
        planType: data.planType,
        kyokaiPrefCode: data.kyokaiPrefCode,
        kyokaiPrefName: data.kyokaiPrefName,
        healthRate: data.healthRate,
        bands: data.bands
      };
    } catch (error) {
      console.error('クラウドマスタからの健康保険料率取得に失敗しました', error);
      return null;
    }
  }

  /**
   * 対象年月に有効な最新の介護保険マスタを取得する
   */
  async getCareRatePresetFromCloud(
    targetYear: number | string,
    targetMonth: number | string
  ): Promise<Partial<CareRateTable> | null> {
    try {
      // フォームから来た値がstringでも安全に処理するため、明示的に数値化
      const y = Number(targetYear);
      const m = Number(targetMonth);
      const targetYearMonth = y * 100 + m;
      const ref = this.getCareCollectionRef();
      const q = query(
        ref,
        where('effectiveYearMonth', '<=', targetYearMonth),
        orderBy('effectiveYearMonth', 'desc'),
        limit(1)
      );

      const snapshot = await firstValueFrom(from(getDocs(q)));
      if (snapshot.empty) {
        return null;
      }

      const data = snapshot.docs[0].data() as CloudCareRateTable;
      return {
        effectiveYear: data.effectiveYear,
        effectiveMonth: data.effectiveMonth,
        effectiveYearMonth: data.effectiveYearMonth,
        careRate: data.careRate
      };
    } catch (error) {
      console.error('クラウドマスタからの介護保険料率取得に失敗しました', error);
      return null;
    }
  }

  /**
   * 対象年月に有効な最新の厚生年金マスタを取得する
   */
  async getPensionRatePresetFromCloud(
    targetYear: number | string,
    targetMonth: number | string
  ): Promise<Partial<PensionRateTable> | null> {
    try {
      // フォームから来た値がstringでも安全に処理するため、明示的に数値化
      const y = Number(targetYear);
      const m = Number(targetMonth);
      const targetYearMonth = y * 100 + m;
      const ref = this.getPensionCollectionRef();
      const q = query(
        ref,
        where('effectiveYearMonth', '<=', targetYearMonth),
        orderBy('effectiveYearMonth', 'desc'),
        limit(1)
      );

      const snapshot = await firstValueFrom(from(getDocs(q)));
      if (snapshot.empty) {
        return null;
      }

      const data = snapshot.docs[0].data() as CloudPensionRateTable;
      return {
        effectiveYear: data.effectiveYear,
        effectiveMonth: data.effectiveMonth,
        effectiveYearMonth: data.effectiveYearMonth,
        pensionRate: data.pensionRate,
        bands: data.bands
      };
    } catch (error) {
      console.error('クラウドマスタからの厚生年金保険料率取得に失敗しました', error);
      return null;
    }
  }
}

