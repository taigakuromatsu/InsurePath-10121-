import { Injectable } from '@angular/core';
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
  constructor(private readonly firestore: Firestore) {}

  private collectionPath(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'dependentReviewSessions');
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
  }

  list(officeId: string): Observable<DependentReviewSession[]> {
    const ref = this.collectionPath(officeId);
    const q = query(ref, orderBy('checkedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<DependentReviewSession[]>;
  }

  async get(officeId: string, sessionId: string): Promise<DependentReviewSession | null> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, sessionId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as DependentReviewSession;
  }

  async update(
    officeId: string,
    sessionId: string,
    updates: Partial<DependentReviewSession>,
    updatedByUserId: string
  ): Promise<void> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, sessionId);
    const now = new Date().toISOString();

    const payload: Partial<DependentReviewSession> = {
      ...updates,
      updatedAt: now,
      updatedByUserId
    };

    await updateDoc(docRef, payload);
  }

  async delete(officeId: string, sessionId: string): Promise<void> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, sessionId);
    await deleteDoc(docRef);
  }
}
