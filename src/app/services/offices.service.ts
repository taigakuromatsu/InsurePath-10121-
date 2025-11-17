import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, docSnapshots, setDoc } from '@angular/fire/firestore';
import { map, Observable } from 'rxjs';

import { Office } from '../types';

@Injectable({ providedIn: 'root' })
export class OfficesService {
  private readonly collectionRef = collection(this.firestore, 'offices');

  constructor(private readonly firestore: Firestore) {}

  watchOffice(id: string): Observable<Office | null> {
    const ref = doc(this.collectionRef, id);
    return docSnapshots(ref).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }
        return { id: snapshot.id, ...(snapshot.data() as Office) };
      })
    );
  }

  listOffices(): Observable<Office[]> {
    return collectionData(this.collectionRef, { idField: 'id' }) as Observable<Office[]>;
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
      createdAt: now,
      updatedAt: now
    };
    await setDoc(ref, office);
    return office;
  }

  async saveOffice(office: Office): Promise<void> {
    const ref = doc(this.collectionRef, office.id);
    const now = new Date().toISOString();
    await setDoc(ref, { ...office, updatedAt: now }, { merge: true });
  }
}
