import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  orderBy,
  query,
  Query,
  QueryConstraint,
  setDoc,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { PENDING_PROCEDURE_STATUSES, ProcedureStatus, ProcedureType, SocialInsuranceProcedure } from '../types';
import { addDays, getNextWeekMonday, getSundayOfWeek, getThisWeekMonday, todayYmd } from '../utils/date-helpers';

@Injectable({ providedIn: 'root' })
export class ProceduresService {
  private readonly injector = inject(EnvironmentInjector);
  constructor(private readonly firestore: Firestore) {}

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxAsync<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  private collectionPath(officeId: string) {
    return this.inCtx(() => collection(this.firestore, 'offices', officeId, 'procedures'));
  }

  async create(
    officeId: string,
    procedure: {
      procedureType: ProcedureType;
      employeeId: string;
      dependentId?: string;
      incidentDate: string;
      deadline: string;
      status: ProcedureStatus;
      submittedAt?: string;
      assignedPersonName?: string;
      note?: string;
    },
    createdByUserId: string
  ): Promise<void> {
    return this.inCtxAsync(async () => {
      const ref = this.collectionPath(officeId);
      const docRef = doc(ref);
    const now = new Date().toISOString();

    const payload: SocialInsuranceProcedure = {
      id: docRef.id,
      officeId,
      procedureType: procedure.procedureType,
      employeeId: procedure.employeeId,
      incidentDate: procedure.incidentDate,
      deadline: procedure.deadline,
      status: procedure.status,
      createdAt: now,
      updatedAt: now,
      createdByUserId,
      updatedByUserId: createdByUserId
    };

    if (procedure.dependentId != null) {
      payload.dependentId = procedure.dependentId;
    }
    if (procedure.submittedAt != null) {
      payload.submittedAt = procedure.submittedAt;
    }
    if (procedure.assignedPersonName != null) {
      payload.assignedPersonName = procedure.assignedPersonName;
    }
    if (procedure.note != null) {
      payload.note = procedure.note;
    }

      await setDoc(docRef, payload);
    });
  }

  list(
    officeId: string,
    filters?: {
      status?: ProcedureStatus;
      procedureType?: ProcedureType;
    }
  ): Observable<SocialInsuranceProcedure[]> {
    return this.inCtx(() => {
      const ref = this.collectionPath(officeId);
      const constraints: QueryConstraint[] = [];

      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }
      if (filters?.procedureType) {
        constraints.push(where('procedureType', '==', filters.procedureType));
      }

      constraints.push(orderBy('deadline', 'asc'));

      const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref, orderBy('deadline', 'asc'));

      return collectionData(q, { idField: 'id' }) as Observable<SocialInsuranceProcedure[]>;
    });
  }

  listByDeadline(
    officeId: string,
    filter: 'upcoming' | 'overdue' | 'all'
  ): Observable<SocialInsuranceProcedure[]> {
    return this.inCtx(() => {
      const ref = this.collectionPath(officeId);
      const now = todayYmd();
      const sevenDaysLater = addDays(now, 7);

      let q: Query;

      if (filter === 'upcoming') {
        q = query(
          ref,
          where('deadline', '>=', now),
          where('deadline', '<=', sevenDaysLater),
          where('status', 'in', PENDING_PROCEDURE_STATUSES),
          orderBy('deadline', 'asc')
        );
      } else if (filter === 'overdue') {
        q = query(
          ref,
          where('deadline', '<', now),
          where('status', 'in', PENDING_PROCEDURE_STATUSES),
          orderBy('deadline', 'asc')
        );
      } else {
        q = query(ref, orderBy('deadline', 'asc'));
      }

      return collectionData(q, { idField: 'id' }) as Observable<SocialInsuranceProcedure[]>;
    });
  }

  listThisWeekDeadlines(officeId: string): Observable<SocialInsuranceProcedure[]> {
    return this.inCtx(() => {
      const ref = this.collectionPath(officeId);
      const thisWeekMonday = getThisWeekMonday();
      const thisWeekSunday = getSundayOfWeek(thisWeekMonday);

      const q = query(
        ref,
        where('deadline', '>=', thisWeekMonday),
        where('deadline', '<=', thisWeekSunday),
        where('status', 'in', PENDING_PROCEDURE_STATUSES),
        orderBy('deadline', 'asc')
      );

      return collectionData(q, { idField: 'id' }) as Observable<SocialInsuranceProcedure[]>;
    });
  }

  listNextWeekDeadlines(officeId: string): Observable<SocialInsuranceProcedure[]> {
    return this.inCtx(() => {
      const ref = this.collectionPath(officeId);
      const nextWeekMonday = getNextWeekMonday();
      const nextWeekSunday = getSundayOfWeek(nextWeekMonday);

      const q = query(
        ref,
        where('deadline', '>=', nextWeekMonday),
        where('deadline', '<=', nextWeekSunday),
        where('status', 'in', PENDING_PROCEDURE_STATUSES),
        orderBy('deadline', 'asc')
      );

      return collectionData(q, { idField: 'id' }) as Observable<SocialInsuranceProcedure[]>;
    });
  }

  countThisWeekDeadlines(officeId: string): Observable<number> {
    return this.listThisWeekDeadlines(officeId).pipe(map((procedures) => procedures.length));
  }

  countOverdueDeadlines(officeId: string): Observable<number> {
    return this.listByDeadline(officeId, 'overdue').pipe(map((procedures) => procedures.length));
  }

  async update(
    officeId: string,
    procedureId: string,
    updates: Partial<SocialInsuranceProcedure>,
    updatedByUserId: string
  ): Promise<void> {
    return this.inCtxAsync(async () => {
      const ref = this.collectionPath(officeId);
      const docRef = doc(ref, procedureId);
      const now = new Date().toISOString();

      const payload: Partial<SocialInsuranceProcedure> = {
        ...updates,
        updatedAt: now,
        updatedByUserId
      };

      await updateDoc(docRef, payload);
    });
  }

  async delete(officeId: string, procedureId: string): Promise<void> {
    return this.inCtxAsync(async () => {
      const ref = this.collectionPath(officeId);
      const docRef = doc(ref, procedureId);
      await deleteDoc(docRef);
    });
  }
}
