import { Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  doc,
  Firestore,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { map, Observable } from 'rxjs';

import {
  ChangeRequest,
  ChangeRequestKind,
  ChangeRequestStatus,
  DependentRequestPayload
} from '../types';

@Injectable({ providedIn: 'root' })
export class ChangeRequestsService {
  constructor(private readonly firestore: Firestore) {}

  private collectionPath(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'changeRequests');
  }

  async create(
    officeId: string,
    request: {
      employeeId: string;
      requestedByUserId: string;
      kind: ChangeRequestKind;
      field?: 'address' | 'phone' | 'email';
      currentValue?: string;
      requestedValue?: string;
      targetDependentId?: string;
      payload?: DependentRequestPayload;
    }
  ): Promise<void> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref);
    const now = new Date().toISOString();

    const payload: ChangeRequest = {
      id: docRef.id,
      officeId,
      employeeId: request.employeeId,
      requestedByUserId: request.requestedByUserId,
      kind: request.kind ?? 'profile',
      field: request.field,
      currentValue: request.currentValue,
      requestedValue: request.requestedValue,
      targetDependentId: request.targetDependentId,
      payload: request.payload,
      status: 'pending',
      requestedAt: now
    };

    await setDoc(docRef, payload);
  }

  list(officeId: string, status?: ChangeRequestStatus): Observable<ChangeRequest[]> {
    const ref = this.collectionPath(officeId);
    const q = status
      ? query(ref, where('status', '==', status), orderBy('requestedAt', 'desc'))
      : query(ref, orderBy('requestedAt', 'desc'));

    return (collectionData(q, { idField: 'id' }) as Observable<ChangeRequest[]>)
      .pipe(map((requests) => requests.map((req) => this.normalizeRequest(req))));
  }

  listForUser(
    officeId: string,
    userId: string,
    status?: ChangeRequestStatus
  ): Observable<ChangeRequest[]> {
    const ref = this.collectionPath(officeId);
    const q = status
      ? query(
          ref,
          where('requestedByUserId', '==', userId),
          where('status', '==', status),
          orderBy('requestedAt', 'desc')
        )
      : query(
          ref,
          where('requestedByUserId', '==', userId),
          orderBy('requestedAt', 'desc')
        );

    return (collectionData(q, { idField: 'id' }) as Observable<ChangeRequest[]>)
      .pipe(map((requests) => requests.map((req) => this.normalizeRequest(req))));
  }

  async approve(officeId: string, requestId: string, decidedByUserId: string): Promise<void> {
    const docRef = doc(this.collectionPath(officeId), requestId);
    const now = new Date().toISOString();

    await updateDoc(docRef, {
      status: 'approved',
      decidedAt: now,
      decidedByUserId
    });
  }

  async reject(
    officeId: string,
    requestId: string,
    decidedByUserId: string,
    rejectReason: string
  ): Promise<void> {
    const docRef = doc(this.collectionPath(officeId), requestId);
    const now = new Date().toISOString();

    await updateDoc(docRef, {
      status: 'rejected',
      decidedAt: now,
      decidedByUserId,
      rejectReason
    });
  }

  async cancel(officeId: string, requestId: string): Promise<void> {
    const docRef = doc(this.collectionPath(officeId), requestId);

    await updateDoc(docRef, {
      status: 'canceled'
    });
  }

  private normalizeRequest(data: ChangeRequest): ChangeRequest {
    return {
      ...data,
      kind: data.kind ?? 'profile'
    };
  }
}
