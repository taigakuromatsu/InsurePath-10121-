import { Injectable } from '@angular/core';
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

import { ProcedureStatus, ProcedureType, SocialInsuranceProcedure } from '../types';

@Injectable({ providedIn: 'root' })
export class ProceduresService {
  constructor(private readonly firestore: Firestore) {}

  private collectionPath(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'procedures');
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
  }

  list(
    officeId: string,
    filters?: {
      status?: ProcedureStatus;
      procedureType?: ProcedureType;
    }
  ): Observable<SocialInsuranceProcedure[]> {
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
  }

  listByDeadline(
    officeId: string,
    filter: 'upcoming' | 'overdue' | 'all'
  ): Observable<SocialInsuranceProcedure[]> {
    const ref = this.collectionPath(officeId);
    const now = new Date().toISOString().substring(0, 10);
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

    let q: Query;

    if (filter === 'upcoming') {
      q = query(
        ref,
        where('deadline', '>=', now),
        where('deadline', '<=', sevenDaysLater),
        where('status', 'in', ['not_started', 'in_progress', 'rejected']),
        orderBy('deadline', 'asc')
      );
    } else if (filter === 'overdue') {
      q = query(
        ref,
        where('deadline', '<', now),
        where('status', 'in', ['not_started', 'in_progress', 'rejected']),
        orderBy('deadline', 'asc')
      );
    } else {
      q = query(ref, orderBy('deadline', 'asc'));
    }

    return collectionData(q, { idField: 'id' }) as Observable<SocialInsuranceProcedure[]>;
  }

  async update(
    officeId: string,
    procedureId: string,
    updates: Partial<SocialInsuranceProcedure>,
    updatedByUserId: string
  ): Promise<void> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, procedureId);
    const now = new Date().toISOString();

    const payload: Partial<SocialInsuranceProcedure> = {
      ...updates,
      updatedAt: now,
      updatedByUserId
    };

    await updateDoc(docRef, payload);
  }

  async delete(officeId: string, procedureId: string): Promise<void> {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref, procedureId);
    await deleteDoc(docRef);
  }
}
