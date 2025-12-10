import { Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  orderBy,
  query,
  setDoc
} from '@angular/fire/firestore';
import { firstValueFrom, Observable } from 'rxjs';

import { StandardRewardHistory } from '../types';
import { CurrentUserService } from './current-user.service';

@Injectable({ providedIn: 'root' })
export class StandardRewardHistoryService {
  constructor(
    private readonly firestore: Firestore,
    private readonly currentUserService: CurrentUserService
  ) {}

  private collectionPath(officeId: string, employeeId: string) {
    return collection(
      this.firestore,
      'offices',
      officeId,
      'employees',
      employeeId,
      'standardRewardHistories'
    );
  }

  list(officeId: string, employeeId: string): Observable<StandardRewardHistory[]> {
    const ref = query(
      this.collectionPath(officeId, employeeId),
      orderBy('decisionYearMonth', 'desc')
    );
    return collectionData(ref, { idField: 'id' }) as Observable<StandardRewardHistory[]>;
  }

  async save(
    officeId: string,
    employeeId: string,
    history: Partial<StandardRewardHistory> & { id?: string }
  ): Promise<void> {
    const historiesRef = this.collectionPath(officeId, employeeId);
    const ref = history.id ? doc(historiesRef, history.id) : doc(historiesRef);
    const now = new Date().toISOString();
    const currentUser = await firstValueFrom(this.currentUserService.profile$);

    const payload: Partial<StandardRewardHistory> = {
      id: ref.id,
      employeeId,
      insuranceKind: history.insuranceKind ?? 'health',
      decisionYearMonth: history.decisionYearMonth ?? '',
      appliedFromYearMonth: history.appliedFromYearMonth ?? '',
      standardMonthlyReward: history.standardMonthlyReward ?? 0,
      grade: history.grade ?? undefined,
      decisionKind: history.decisionKind ?? 'other',
      note: history.note ?? undefined,
      updatedAt: now,
      updatedByUserId: currentUser?.id
    };

    if (!history.id) {
      payload.createdAt = now;
      payload.createdByUserId = currentUser?.id;
    } else if (history.createdAt) {
      payload.createdAt = history.createdAt;
      payload.createdByUserId = history.createdByUserId;
    }

    await setDoc(ref, payload, { merge: true });
  }

  delete(officeId: string, employeeId: string, historyId: string): Promise<void> {
    const ref = doc(this.collectionPath(officeId, employeeId), historyId);
    return deleteDoc(ref);
  }
}
