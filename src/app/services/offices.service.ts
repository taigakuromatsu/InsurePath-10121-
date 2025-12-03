import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc
} from '@angular/fire/firestore';
import { from, map, Observable } from 'rxjs';

import { Office } from '../types';

@Injectable({ providedIn: 'root' })
export class OfficesService {
  private readonly collectionRef: ReturnType<typeof collection>;

  constructor(private readonly firestore: Firestore) {
    this.collectionRef = collection(this.firestore, 'offices');
  }

  // 事業所を1件取得（現在は1回読み切りにしています）
  watchOffice(id: string): Observable<Office | null> {
    const ref = doc(this.collectionRef, id);
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
  }

  // 事業所一覧を1回取得
  listOffices(): Observable<Office[]> {
    return from(getDocs(this.collectionRef)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as Office)
        )
      )
    );
  }

  async createOffice(partial: Partial<Office>): Promise<Office> {
    const ref = doc(this.collectionRef);
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

    // undefined を含むフィールドを落としてから Firestore に送る
    const payload = Object.fromEntries(
      Object.entries(office).filter(([, value]) => value !== undefined)
    ) as Office;

    await setDoc(ref, payload);
    return office;
  }

  async saveOffice(office: Office): Promise<void> {
    const ref = doc(this.collectionRef, office.id);
    const now = new Date().toISOString();

    const officeWithUpdated: Office = {
      ...office,
      updatedAt: now,
    };

    // ここでも undefined を削除してから送る
    const payload = Object.fromEntries(
      Object.entries(officeWithUpdated).filter(([, value]) => value !== undefined)
    );

    await setDoc(ref, payload, { merge: true });
  }
}
