import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
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
  private readonly injector = inject(EnvironmentInjector);
  constructor(private readonly firestore: Firestore) {}

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  listHealthRateTables(officeId: string): Observable<HealthRateTable[]> {
    return this.inCtx(() => {
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
    });
  }

  listCareRateTables(officeId: string): Observable<CareRateTable[]> {
    return this.inCtx(() => {
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
    });
  }

  listPensionRateTables(officeId: string): Observable<PensionRateTable[]> {
    return this.inCtx(() => {
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
    });
  }

  listMonthlyPremiums(officeId: string): Observable<MonthlyPremium[]> {
    return this.inCtx(() => {
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
    });
  }

  listBonusPremiums(officeId: string): Observable<BonusPremium[]> {
    return this.inCtx(() => {
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
    });
  }

  listChangeRequests(officeId: string): Observable<ChangeRequest[]> {
    return this.inCtx(() => {
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
    });
  }

  listImportJobs(officeId: string): Observable<ImportJob[]> {
    return this.inCtx(() => {
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
    });
  }
}
