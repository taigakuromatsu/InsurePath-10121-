import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  orderBy,
  query,
  QueryConstraint,
  setDoc,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import { DependentReview, DependentReviewResult } from '../types';

@Injectable({ providedIn: 'root' })
export class DependentReviewsService {
  private readonly injector = inject(EnvironmentInjector);
  constructor(private readonly firestore: Firestore) {}

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxAsync<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  private collectionPath(officeId: string) {
    return this.inCtx(() => collection(this.firestore, 'offices', officeId, 'dependentReviews'));
  }

  async create(
    officeId: string,
    review: {
      employeeId: string;
      dependentId: string;
      reviewDate: string; // YYYY-MM-DD形式
      result: DependentReviewResult;
      reviewedBy?: string;
      note?: string;
      sessionId?: string;
    },
    createdByUserId: string
  ): Promise<void> {
    return this.inCtxAsync(async () => {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref);
    const now = new Date().toISOString();

    const payload: DependentReview = {
      id: docRef.id,
      officeId,
      employeeId: review.employeeId,
      dependentId: review.dependentId,
      reviewDate: review.reviewDate,
      result: review.result,
      createdAt: now,
      updatedAt: now,
      createdByUserId,
      updatedByUserId: createdByUserId
    };

    if (review.reviewedBy != null) {
      payload.reviewedBy = review.reviewedBy;
    }
    if (review.note != null) {
      payload.note = review.note;
    }
    if (review.sessionId != null) {
      payload.sessionId = review.sessionId;
    }

    await setDoc(docRef, payload);
    });
  }

  list(
    officeId: string,
    filters?: {
      result?: DependentReviewResult;
      employeeId?: string;
      dependentId?: string;
      sessionId?: string;
    }
  ): Observable<DependentReview[]> {
    return this.inCtx(() => {
    const ref = this.collectionPath(officeId);
    const constraints: QueryConstraint[] = [];

    if (filters?.result) {
      constraints.push(where('result', '==', filters.result));
    }
    if (filters?.employeeId) {
      constraints.push(where('employeeId', '==', filters.employeeId));
    }
    if (filters?.dependentId) {
      constraints.push(where('dependentId', '==', filters.dependentId));
    }
    if (filters?.sessionId) {
      constraints.push(where('sessionId', '==', filters.sessionId));
    }

    constraints.push(orderBy('reviewDate', 'desc'));

    const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref, orderBy('reviewDate', 'desc'));

    return collectionData(q, { idField: 'id' }) as Observable<DependentReview[]>;
    });
  }

  async update(
    officeId: string,
    reviewId: string,
    updates: Partial<DependentReview>,
    updatedByUserId: string
  ): Promise<void> {
    return this.inCtxAsync(async () => {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, reviewId);
    const now = new Date().toISOString();

    const payload: Partial<DependentReview> = {
      ...updates,
      updatedAt: now,
      updatedByUserId
    };

    await updateDoc(docRef, payload);
    });
  }

  async delete(officeId: string, reviewId: string): Promise<void> {
    return this.inCtxAsync(async () => {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, reviewId);
    await deleteDoc(docRef);
    });
  }
}
