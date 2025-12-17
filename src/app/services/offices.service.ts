import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  setDoc
} from '@angular/fire/firestore';
import { from, map, Observable } from 'rxjs';

import { Office } from '../types';

@Injectable({ providedIn: 'root' })
export class OfficesService {
  private readonly injector = inject(EnvironmentInjector);

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxAsync<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  private getCollectionRef() {
    return this.inCtx(() => collection(this.firestore, 'offices'));
  }

  constructor(private readonly firestore: Firestore) {}

  // 事業所を1件取得（現在は1回読み切りにしています）
  watchOffice(id: string): Observable<Office | null> {
    return this.inCtx(() => {
      const ref = doc(this.getCollectionRef(), id);
    return from(getDoc(ref)).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }
        return {
          id: snapshot.id,
          ...(snapshot.data() as any)
        } as Office;
      })
    );
    });
  }

  /**
   * 事業所一覧をリアルタイムで監視（watch）
   * データ変更を自動的に検知します。
   */
  listOffices(): Observable<Office[]> {
    return this.inCtx(() => {
      return collectionData(this.getCollectionRef(), { idField: 'id' }) as Observable<Office[]>;
    });
  }

  async createOffice(partial: Partial<Office>): Promise<Office> {
    return this.inCtxAsync(async () => {
      const ref = doc(this.getCollectionRef());
    const now = new Date().toISOString();

    const office: Office = {
      id: ref.id,
      name: partial.name ?? '新規事業所',
      address: partial.address,
      healthPlanType: partial.healthPlanType ?? 'kyokai',
      kyokaiPrefCode: partial.kyokaiPrefCode,
      kyokaiPrefName: partial.kyokaiPrefName,
      unionCode: partial.unionCode,
      unionName: partial.unionName,
      officeSymbol: partial.officeSymbol,
      officeNumber: partial.officeNumber,
      officeCityCode: partial.officeCityCode,
      officePostalCode: partial.officePostalCode,
      officePhone: partial.officePhone,
      officeOwnerName: partial.officeOwnerName,
      createdAt: now,
      updatedAt: now,
    };

    // undefined を含むフィールドを落としてから Firestore に送る（nullは残す）
    const payload = Object.fromEntries(
      Object.entries(office).filter(([, value]) => value !== undefined)
    ) as Office;

    await setDoc(ref, payload);
    return office;
    });
  }

  async saveOffice(office: Office): Promise<void> {
    return this.inCtxAsync(async () => {
      const ref = doc(this.getCollectionRef(), office.id);
    const now = new Date().toISOString();

    const officeWithUpdated: Office = {
      ...office,
      updatedAt: now,
    };

    // undefined を削除してから送る（nullは残す）
    const payload = Object.fromEntries(
      Object.entries(officeWithUpdated).filter(([, value]) => value !== undefined)
    );

    await setDoc(ref, payload, { merge: true });
    });
  }
}
