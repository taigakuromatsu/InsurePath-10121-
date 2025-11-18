import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { from, map, Observable } from 'rxjs';

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
    const ref = collection(this.firestore, 'offices', officeId, 'healthRateTables');
    return from(getDocs(ref)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as HealthRateTable)
        )
      )
    );
  }

  listCareRateTables(officeId: string): Observable<CareRateTable[]> {
    const ref = collection(this.firestore, 'offices', officeId, 'careRateTables');
    return from(getDocs(ref)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as CareRateTable)
        )
      )
    );
  }

  listPensionRateTables(officeId: string): Observable<PensionRateTable[]> {
    const ref = collection(this.firestore, 'offices', officeId, 'pensionRateTables');
    return from(getDocs(ref)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as PensionRateTable)
        )
      )
    );
  }

  listMonthlyPremiums(officeId: string): Observable<MonthlyPremium[]> {
    const ref = collection(this.firestore, 'offices', officeId, 'monthlyPremiums');
    return from(getDocs(ref)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as MonthlyPremium)
        )
      )
    );
  }

  listBonusPremiums(officeId: string): Observable<BonusPremium[]> {
    const ref = collection(this.firestore, 'offices', officeId, 'bonusPremiums');
    return from(getDocs(ref)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as BonusPremium)
        )
      )
    );
  }

  listChangeRequests(officeId: string): Observable<ChangeRequest[]> {
    const ref = collection(this.firestore, 'offices', officeId, 'changeRequests');
    return from(getDocs(ref)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as ChangeRequest)
        )
      )
    );
  }

  listImportJobs(officeId: string): Observable<ImportJob[]> {
    const ref = collection(this.firestore, 'offices', officeId, 'importJobs');
    return from(getDocs(ref)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as ImportJob)
        )
      )
    );
  }
}
