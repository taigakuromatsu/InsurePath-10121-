import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import {
  BonusPremium,
  CareRateTable,
  ChangeRequest,
  HealthRateTable,
  ImportJob,
  MonthlyPremium,
  PensionRateTable
} from '../types';

@Injectable({ providedIn: 'root' })
export class OfficeCollectionsService {
  constructor(private readonly firestore: Firestore) {}

  listHealthRateTables(officeId: string): Observable<HealthRateTable[]> {
    return collectionData(collection(this.firestore, 'offices', officeId, 'healthRateTables'), {
      idField: 'id'
    }) as Observable<HealthRateTable[]>;
  }

  listCareRateTables(officeId: string): Observable<CareRateTable[]> {
    return collectionData(collection(this.firestore, 'offices', officeId, 'careRateTables'), {
      idField: 'id'
    }) as Observable<CareRateTable[]>;
  }

  listPensionRateTables(officeId: string): Observable<PensionRateTable[]> {
    return collectionData(collection(this.firestore, 'offices', officeId, 'pensionRateTables'), {
      idField: 'id'
    }) as Observable<PensionRateTable[]>;
  }

  listMonthlyPremiums(officeId: string): Observable<MonthlyPremium[]> {
    return collectionData(collection(this.firestore, 'offices', officeId, 'monthlyPremiums'), {
      idField: 'id'
    }) as Observable<MonthlyPremium[]>;
  }

  listBonusPremiums(officeId: string): Observable<BonusPremium[]> {
    return collectionData(collection(this.firestore, 'offices', officeId, 'bonusPremiums'), {
      idField: 'id'
    }) as Observable<BonusPremium[]>;
  }

  listChangeRequests(officeId: string): Observable<ChangeRequest[]> {
    return collectionData(collection(this.firestore, 'offices', officeId, 'changeRequests'), {
      idField: 'id'
    }) as Observable<ChangeRequest[]>;
  }

  listImportJobs(officeId: string): Observable<ImportJob[]> {
    return collectionData(collection(this.firestore, 'offices', officeId, 'importJobs'), {
      idField: 'id'
    }) as Observable<ImportJob[]>;
  }
}
