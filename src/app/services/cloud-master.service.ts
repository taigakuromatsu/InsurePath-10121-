// src/app/services/cloud-master.service.ts
import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
    year: number,
    prefCode: string
  ): Observable<CloudHealthRateTable | null> {
    const id = `${year}_${prefCode}`;
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
    year?: number
  ): Observable<CloudHealthRateTable[]> {
    const ref = this.getHealthCollectionRef();
    const q = year
      ? query(ref, where('year', '==', year), orderBy('kyokaiPrefCode', 'asc'))
      : query(ref, orderBy('year', 'desc'), orderBy('kyokaiPrefCode', 'asc'));

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
    const id =
      table.id ?? `${table.year}_${table.kyokaiPrefCode}`;

    const payload: Partial<CloudHealthRateTable> = {
      ...table,
      id,
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
    year: number,
    prefCode: string
  ): Promise<void> {
    const id = `${year}_${prefCode}`;
    const ref = doc(this.firestore, 'cloudHealthRateTables', id);
    await deleteDoc(ref);
  }

  // ========== Care Rate Table ==========

  getCloudCareRateTable(
    year: number
  ): Observable<CloudCareRateTable | null> {
    const id = `${year}`;
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
    const q = query(ref, orderBy('year', 'desc'));

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
    const id = table.id ?? `${table.year}`;

    const payload: Partial<CloudCareRateTable> = {
      ...table,
      id,
      updatedAt: now,
      updatedByUserId: user.id,
      createdAt: table.createdAt ?? now
    };

    const cleaned = this.removeUndefinedDeep(payload);
    const ref = doc(this.firestore, 'cloudCareRateTables', id);
    await setDoc(ref, cleaned, { merge: true });
  }

  async deleteCloudCareRateTable(year: number): Promise<void> {
    const id = `${year}`;
    const ref = doc(this.firestore, 'cloudCareRateTables', id);
    await deleteDoc(ref);
  }

  // ========== Pension Rate Table ==========

  getCloudPensionRateTable(
    year: number
  ): Observable<CloudPensionRateTable | null> {
    const id = `${year}`;
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
    const q = query(ref, orderBy('year', 'desc'));

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
    const id = table.id ?? `${table.year}`;

    const payload: Partial<CloudPensionRateTable> = {
      ...table,
      id,
      updatedAt: now,
      updatedByUserId: user.id,
      createdAt: table.createdAt ?? now
    };

    const cleaned = this.removeUndefinedDeep(payload);
    const ref = doc(this.firestore, 'cloudPensionRateTables', id);
    await setDoc(ref, cleaned, { merge: true });
  }

  async deleteCloudPensionRateTable(year: number): Promise<void> {
    const id = `${year}`;
    const ref = doc(this.firestore, 'cloudPensionRateTables', id);
    await deleteDoc(ref);
  }

  // ========== Preset Methods (for Office Masters) ==========

  async getHealthRatePresetFromCloud(
    year: number,
    prefCode: string
  ): Promise<Partial<HealthRateTable> | null> {
    try {
      const cloudTable = await firstValueFrom(
        this.getCloudHealthRateTable(year, prefCode)
      );
      if (!cloudTable) {
        return null;
      }

      return {
        year: cloudTable.year,
        planType: cloudTable.planType,
        kyokaiPrefCode: cloudTable.kyokaiPrefCode,
        kyokaiPrefName: cloudTable.kyokaiPrefName,
        healthRate: cloudTable.healthRate,
        bands: cloudTable.bands
      };
    } catch (error) {
      console.error('クラウドマスタからの健康保険料率取得に失敗しました', error);
      return null;
    }
  }

  async getCareRatePresetFromCloud(
    year: number
  ): Promise<Partial<CareRateTable> | null> {
    try {
      const cloudTable = await firstValueFrom(
        this.getCloudCareRateTable(year)
      );
      if (!cloudTable) {
        return null;
      }

      return {
        year: cloudTable.year,
        careRate: cloudTable.careRate
      };
    } catch (error) {
      console.error('クラウドマスタからの介護保険料率取得に失敗しました', error);
      return null;
    }
  }

  async getPensionRatePresetFromCloud(
    year: number
  ): Promise<Partial<PensionRateTable> | null> {
    try {
      const cloudTable = await firstValueFrom(
        this.getCloudPensionRateTable(year)
      );
      if (!cloudTable) {
        return null;
      }

      return {
        year: cloudTable.year,
        pensionRate: cloudTable.pensionRate,
        bands: cloudTable.bands
      };
    } catch (error) {
      console.error('クラウドマスタからの厚生年金保険料率取得に失敗しました', error);
      return null;
    }
  }
}

