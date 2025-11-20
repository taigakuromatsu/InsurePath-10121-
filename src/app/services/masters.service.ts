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
  HealthRateTable,
  Office,
  PensionRateTable,
  YearMonthString
} from '../types';

@Injectable({ providedIn: 'root' })
export class MastersService {
  constructor(private readonly firestore: Firestore) {}

  private getHealthCollectionRef(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'healthRateTables');
  }

  private getCareCollectionRef(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'careRateTables');
  }

  private getPensionCollectionRef(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'pensionRateTables');
  }

  listHealthRateTables(officeId: string): Observable<HealthRateTable[]> {
    const ref = this.getHealthCollectionRef(officeId);
    const q = query(ref, orderBy('year', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as HealthRateTable)
        )
      )
    );
  }

  getHealthRateTable(officeId: string, id: string): Observable<HealthRateTable | null> {
    const ref = doc(this.getHealthCollectionRef(officeId), id);
    return from(getDoc(ref)).pipe(
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
  }

  async saveHealthRateTable(
    officeId: string,
    table: Partial<HealthRateTable> & { id?: string }
  ): Promise<void> {
    const collectionRef = this.getHealthCollectionRef(officeId);
    const ref = table.id ? doc(collectionRef, table.id) : doc(collectionRef);
    const now = new Date().toISOString();

    const payload: HealthRateTable = {
      id: ref.id,
      officeId,
      year: Number(table.year ?? new Date().getFullYear()),
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

    await setDoc(ref, cleanPayload, { merge: true });
  }

  async deleteHealthRateTable(officeId: string, id: string): Promise<void> {
    const ref = doc(this.getHealthCollectionRef(officeId), id);
    return deleteDoc(ref);
  }

  listCareRateTables(officeId: string): Observable<CareRateTable[]> {
    const ref = this.getCareCollectionRef(officeId);
    const q = query(ref, orderBy('year', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as CareRateTable)
        )
      )
    );
  }

  getCareRateTable(officeId: string, id: string): Observable<CareRateTable | null> {
    const ref = doc(this.getCareCollectionRef(officeId), id);
    return from(getDoc(ref)).pipe(
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
  }

  async saveCareRateTable(
    officeId: string,
    table: Partial<CareRateTable> & { id?: string }
  ): Promise<void> {
    const collectionRef = this.getCareCollectionRef(officeId);
    const ref = table.id ? doc(collectionRef, table.id) : doc(collectionRef);
    const now = new Date().toISOString();

    const payload: CareRateTable = {
      id: ref.id,
      officeId,
      year: Number(table.year ?? new Date().getFullYear()),
      careRate: Number(table.careRate ?? 0),
      createdAt: table.createdAt ?? now,
      updatedAt: now
    };

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    ) as CareRateTable;

    await setDoc(ref, cleanPayload, { merge: true });
  }

  async deleteCareRateTable(officeId: string, id: string): Promise<void> {
    const ref = doc(this.getCareCollectionRef(officeId), id);
    return deleteDoc(ref);
  }

  listPensionRateTables(officeId: string): Observable<PensionRateTable[]> {
    const ref = this.getPensionCollectionRef(officeId);
    const q = query(ref, orderBy('year', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as PensionRateTable)
        )
      )
    );
  }

  getPensionRateTable(officeId: string, id: string): Observable<PensionRateTable | null> {
    const ref = doc(this.getPensionCollectionRef(officeId), id);
    return from(getDoc(ref)).pipe(
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
  }

  async savePensionRateTable(
    officeId: string,
    table: Partial<PensionRateTable> & { id?: string }
  ): Promise<void> {
    const collectionRef = this.getPensionCollectionRef(officeId);
    const ref = table.id ? doc(collectionRef, table.id) : doc(collectionRef);
    const now = new Date().toISOString();

    const payload: PensionRateTable = {
      id: ref.id,
      officeId,
      year: Number(table.year ?? new Date().getFullYear()),
      pensionRate: Number(table.pensionRate ?? 0),
      bands: table.bands ?? [],
      createdAt: table.createdAt ?? now,
      updatedAt: now
    };

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    ) as PensionRateTable;

    await setDoc(ref, cleanPayload, { merge: true });
  }

  async deletePensionRateTable(officeId: string, id: string): Promise<void> {
    const ref = doc(this.getPensionCollectionRef(officeId), id);
    return deleteDoc(ref);
  }

  async getRatesForYearMonth(
    office: Office,
    yearMonth: YearMonthString
  ): Promise<{
    healthRate?: number;
    careRate?: number;
    pensionRate?: number;
  }> {
    const year = parseInt(yearMonth.substring(0, 4), 10);
    const officeId = office.id;

    const results: {
      healthRate?: number;
      careRate?: number;
      pensionRate?: number;
    } = {};

    if (office.healthPlanType === 'kyokai' && office.kyokaiPrefCode) {
      const healthRef = this.getHealthCollectionRef(officeId);
      const healthQuery = query(
        healthRef,
        where('year', '==', year),
        where('planType', '==', 'kyokai'),
        where('kyokaiPrefCode', '==', office.kyokaiPrefCode)
      );
      const healthSnapshot = await firstValueFrom(from(getDocs(healthQuery)));
      if (!healthSnapshot.empty) {
        results.healthRate = healthSnapshot.docs[0].data()['healthRate'] as number;
      }
    } else if (office.healthPlanType === 'kumiai') {
      const healthRef = this.getHealthCollectionRef(officeId);
      const healthQuery = query(
        healthRef,
        where('year', '==', year),
        where('planType', '==', 'kumiai')
      );
      const healthSnapshot = await firstValueFrom(from(getDocs(healthQuery)));
      if (!healthSnapshot.empty) {
        results.healthRate = healthSnapshot.docs[0].data()['healthRate'] as number;
      }
    }

    const careRef = this.getCareCollectionRef(officeId);
    const careQuery = query(careRef, where('year', '==', year));
    const careSnapshot = await firstValueFrom(from(getDocs(careQuery)));
    if (!careSnapshot.empty) {
      results.careRate = careSnapshot.docs[0].data()['careRate'] as number;
    }

    const pensionRef = this.getPensionCollectionRef(officeId);
    const pensionQuery = query(pensionRef, where('year', '==', year));
    const pensionSnapshot = await firstValueFrom(from(getDocs(pensionQuery)));
    if (!pensionSnapshot.empty) {
      results.pensionRate = pensionSnapshot.docs[0].data()['pensionRate'] as number;
    }

    return results;
  }
}
