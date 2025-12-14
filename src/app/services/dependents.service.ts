import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  collection,
  collectionData,
  deleteDoc,
  deleteField,
  doc,
  Firestore,
  setDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import { Dependent } from '../types';

@Injectable({ providedIn: 'root' })
export class DependentsService {
  private readonly injector = inject(EnvironmentInjector);
  constructor(private readonly firestore: Firestore) {}

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxAsync<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  private collectionPath(officeId: string, employeeId: string) {
    return this.inCtx(() => collection(this.firestore, 'offices', officeId, 'employees', employeeId, 'dependents'));
  }

  list(officeId: string, employeeId: string): Observable<Dependent[]> {
    return this.inCtx(() => {
    const ref = this.collectionPath(officeId, employeeId);
    return collectionData(ref, { idField: 'id' }) as Observable<Dependent[]>;
    });
  }

  async save(
    officeId: string,
    employeeId: string,
    dependent: Partial<Dependent> & { id?: string }
  ): Promise<void> {
    return this.inCtxAsync(async () => {
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

    if (dependent.qualificationAcquiredDate !== undefined) {
      payload.qualificationAcquiredDate = dependent.qualificationAcquiredDate;
    }
    if (dependent.qualificationLossDate !== undefined) {
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

    // null を deleteField() に変換して、空で保存された項目を Firestore から削除
    const processedPayload: Partial<Dependent> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value === null) {
        (processedPayload as any)[key] = deleteField();
      } else {
        (processedPayload as any)[key] = value;
      }
    }

    await setDoc(ref, processedPayload, { merge: true });
    });
  }

  delete(officeId: string, employeeId: string, dependentId: string): Promise<void> {
    return this.inCtxAsync(async () => {
    const ref = doc(this.collectionPath(officeId, employeeId), dependentId);
    return deleteDoc(ref);
    });
  }
}
