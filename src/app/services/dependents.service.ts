import { Injectable } from '@angular/core';
import { collection, collectionData, deleteDoc, doc, Firestore, setDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import { Dependent } from '../types';

@Injectable({ providedIn: 'root' })
export class DependentsService {
  constructor(private readonly firestore: Firestore) {}

  private collectionPath(officeId: string, employeeId: string) {
    return collection(this.firestore, 'offices', officeId, 'employees', employeeId, 'dependents');
  }

  list(officeId: string, employeeId: string): Observable<Dependent[]> {
    const ref = this.collectionPath(officeId, employeeId);
    return collectionData(ref, { idField: 'id' }) as Observable<Dependent[]>;
  }

  async save(
    officeId: string,
    employeeId: string,
    dependent: Partial<Dependent> & { id?: string }
  ): Promise<void> {
    const dependentsRef = this.collectionPath(officeId, employeeId);
    const ref = dependent.id ? doc(dependentsRef, dependent.id) : doc(dependentsRef);
    const now = new Date().toISOString();

    const payload: Partial<Dependent> = {
      id: ref.id,
      name: dependent.name ?? '',
      relationship: dependent.relationship,
      dateOfBirth: dependent.dateOfBirth,
      updatedAt: now
    };

    if (!dependent.id) {
      payload.createdAt = now;
    } else if (dependent.createdAt) {
      payload.createdAt = dependent.createdAt;
    }

    if (dependent.qualificationAcquiredDate != null) {
      payload.qualificationAcquiredDate = dependent.qualificationAcquiredDate;
    }
    if (dependent.qualificationLossDate != null) {
      payload.qualificationLossDate = dependent.qualificationLossDate;
    }

    // nullも書き込み対象として扱う（空文字でクリアするため）
    if (dependent.kana !== undefined) {
      payload.kana = dependent.kana;
    }
    if (dependent.sex !== undefined) {
      payload.sex = dependent.sex;
    }
    if (dependent.postalCode !== undefined) {
      payload.postalCode = dependent.postalCode;
    }
    if (dependent.address !== undefined) {
      payload.address = dependent.address;
    }
    if (dependent.cohabitationFlag !== undefined) {
      payload.cohabitationFlag = dependent.cohabitationFlag;
    }
    if (dependent.myNumber !== undefined) {
      payload.myNumber = dependent.myNumber;
    }

    await setDoc(ref, payload, { merge: true });
  }

  delete(officeId: string, employeeId: string, dependentId: string): Promise<void> {
    const ref = doc(this.collectionPath(officeId, employeeId), dependentId);
    return deleteDoc(ref);
  }
}
