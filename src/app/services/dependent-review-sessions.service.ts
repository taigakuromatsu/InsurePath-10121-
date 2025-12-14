import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  orderBy,
  query,
  setDoc,
  updateDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import { DependentReviewSession } from '../types';

@Injectable({ providedIn: 'root' })
export class DependentReviewSessionsService {
  private readonly injector = inject(EnvironmentInjector);
  constructor(private readonly firestore: Firestore) {}

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxAsync<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  private collectionPath(officeId: string) {
    return this.inCtx(() => collection(this.firestore, 'offices', officeId, 'dependentReviewSessions'));
  }

  async create(
    officeId: string,
    session: {
      referenceDate: string;
      checkedAt: string;
      checkedBy?: string;
      note?: string;
    },
    createdByUserId: string
  ): Promise<string> {
    return this.inCtxAsync(async () => {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref);
    const now = new Date().toISOString();

    const payload: DependentReviewSession = {
      id: docRef.id,
      officeId,
      referenceDate: session.referenceDate,
      checkedAt: session.checkedAt,
      createdAt: now,
      updatedAt: now,
      createdByUserId,
      updatedByUserId: createdByUserId
    };

    if (session.checkedBy != null) {
      payload.checkedBy = session.checkedBy;
    }
    if (session.note != null) {
      payload.note = session.note;
    }

    await setDoc(docRef, payload);
    return docRef.id;
    });
  }

  list(officeId: string): Observable<DependentReviewSession[]> {
    return this.inCtx(() => {
    const ref = this.collectionPath(officeId);
    const q = query(ref, orderBy('checkedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<DependentReviewSession[]>;
    });
  }

  async get(officeId: string, sessionId: string): Promise<DependentReviewSession | null> {
    return this.inCtxAsync(async () => {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, sessionId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as DependentReviewSession;
    });
  }

  async update(
    officeId: string,
    sessionId: string,
    updates: Partial<DependentReviewSession>,
    updatedByUserId: string
  ): Promise<void> {
    return this.inCtxAsync(async () => {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, sessionId);
    const now = new Date().toISOString();

    const payload: Partial<DependentReviewSession> = {
      ...updates,
      updatedAt: now,
      updatedByUserId
    };

    await updateDoc(docRef, payload);
    });
  }

  async delete(officeId: string, sessionId: string): Promise<void> {
    return this.inCtxAsync(async () => {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, sessionId);
    await deleteDoc(docRef);
    });
  }
}
