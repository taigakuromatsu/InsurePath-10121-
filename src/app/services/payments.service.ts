import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  deleteDoc,
  limit,
  orderBy,
  query,
  QueryConstraint,
  setDoc,
  updateDoc
} from '@angular/fire/firestore';
import { firstValueFrom, map, Observable, of } from 'rxjs';

import {
  IsoDateString,
  PaymentMethod,
  PaymentStatus,
  SocialInsurancePayment,
  YearMonthString
} from '../types';
import { BonusPremiumsService } from './bonus-premiums.service';
import { MonthlyPremiumsService } from './monthly-premiums.service';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly firestore = inject(Firestore);
  private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
  private readonly bonusPremiumsService = inject(BonusPremiumsService);
  private readonly injector = inject(EnvironmentInjector);

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxAsync<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  private getCollectionRef(officeId: string) {
    return this.inCtx(() => collection(this.firestore, 'offices', officeId, 'payments'));
  }

  async calculatePlannedAmounts(
    officeId: string,
    targetYearMonth: YearMonthString
  ): Promise<{
    plannedHealthCareCompany: number;
    plannedPensionCompany: number;
    plannedTotalCompany: number;
  }> {
    // 月次保険料と賞与保険料のサマリーをそれぞれ取得
    const [monthlySummary, bonusSummary] = await Promise.all([
      this.monthlyPremiumsService.calculateSummary(officeId, targetYearMonth),
      this.bonusPremiumsService.calculateSummary(officeId, targetYearMonth)
    ]);

    // 月次と賞与の会社負担を合算
    const plannedHealthCareCompany = monthlySummary.healthCareEmployer + bonusSummary.healthCareEmployer;
    const plannedPensionCompany = monthlySummary.pensionEmployer + bonusSummary.pensionEmployer;
    const plannedTotalCompany = plannedHealthCareCompany + plannedPensionCompany;

    return {
      plannedHealthCareCompany,
      plannedPensionCompany,
      plannedTotalCompany
    };
  }

  async create(
    officeId: string,
    dto: {
      targetYearMonth: YearMonthString;
      plannedHealthCareCompany?: number;
      plannedPensionCompany?: number;
      plannedTotalCompany?: number;
      actualHealthCareCompany?: number | null;
      actualPensionCompany?: number | null;
      actualTotalCompany?: number | null;
      // 後方互換用（deprecated）
      plannedHealthCompany?: number;
      plannedCareCompany?: number;
      actualHealthCompany?: number | null;
      actualCareCompany?: number | null;
      paymentStatus?: PaymentStatus;
      paymentMethod?: PaymentMethod | null;
      paymentMethodNote?: string | null;
      paymentDate?: IsoDateString | null;
      memo?: string | null;
    },
    createdByUserId: string
  ): Promise<string> {
    return this.inCtxAsync(async () => {
      const collectionRef = this.getCollectionRef(officeId);
      const docId = dto.targetYearMonth;
      const docRef = doc(collectionRef, docId);
    const now = new Date().toISOString().slice(0, 10);

    const allPlannedMissing =
      dto.plannedHealthCareCompany == null &&
      dto.plannedPensionCompany == null &&
      dto.plannedTotalCompany == null;

    const plannedAmounts = allPlannedMissing
      ? await this.calculatePlannedAmounts(officeId, dto.targetYearMonth)
      : {
          plannedHealthCareCompany: dto.plannedHealthCareCompany ?? 
            ((dto.plannedHealthCompany ?? 0) + (dto.plannedCareCompany ?? 0)),
          plannedPensionCompany: dto.plannedPensionCompany ?? 0,
          plannedTotalCompany:
            dto.plannedTotalCompany ??
            ((dto.plannedHealthCareCompany ?? 
              ((dto.plannedHealthCompany ?? 0) + (dto.plannedCareCompany ?? 0))) +
              (dto.plannedPensionCompany ?? 0))
        };

    const payload: SocialInsurancePayment = {
      id: docId,
      officeId,
      targetYearMonth: dto.targetYearMonth,
      ...plannedAmounts,
      actualHealthCareCompany: dto.actualHealthCareCompany ?? 
        ((dto.actualHealthCompany != null && dto.actualCareCompany != null)
          ? (dto.actualHealthCompany + dto.actualCareCompany)
          : null),
      actualPensionCompany: dto.actualPensionCompany ?? null,
      actualTotalCompany: dto.actualTotalCompany ?? null,
      paymentStatus: dto.paymentStatus ?? 'unpaid',
      paymentMethod: dto.paymentMethod ?? null,
      paymentMethodNote: dto.paymentMethodNote ?? null,
      paymentDate: dto.paymentDate ?? null,
      memo: dto.memo ?? null,
      createdAt: now,
      createdByUserId,
      updatedAt: now,
      updatedByUserId: createdByUserId
    };

      await setDoc(docRef, payload);
      return docId;
    });
  }

  listByOffice(officeId: string, limitCount?: number): Observable<SocialInsurancePayment[]> {
    return this.inCtx(() => {
      const collectionRef = this.getCollectionRef(officeId);
      const constraints: QueryConstraint[] = [orderBy('targetYearMonth', 'desc')];

      if (limitCount != null) {
        constraints.push(limit(limitCount));
      }

      const q = query(collectionRef, ...constraints);

      return collectionData(q, { idField: 'id' }) as Observable<SocialInsurancePayment[]>;
    });
  }

  get(officeId: string, targetYearMonth: YearMonthString): Observable<SocialInsurancePayment | undefined> {
    return this.inCtx(() => {
      const collectionRef = this.getCollectionRef(officeId);
      const docRef = doc(collectionRef, targetYearMonth);

      return docData(docRef, { idField: 'id' }).pipe(
        map((data) => {
          // docDataは存在しないドキュメントの場合、undefinedを返す可能性がある
          if (!data || Object.keys(data).length === 0) {
            return undefined;
          }
          return data as SocialInsurancePayment;
        })
      );
    });
  }

  async update(
    officeId: string,
    targetYearMonth: YearMonthString,
    dto: {
      plannedHealthCareCompany?: number;
      plannedPensionCompany?: number;
      plannedTotalCompany?: number;
      actualHealthCareCompany?: number | null;
      actualPensionCompany?: number | null;
      actualTotalCompany?: number | null;
      // 後方互換用（deprecated）
      plannedHealthCompany?: number;
      plannedCareCompany?: number;
      actualHealthCompany?: number | null;
      actualCareCompany?: number | null;
      paymentStatus?: PaymentStatus;
      paymentMethod?: PaymentMethod | null;
      paymentMethodNote?: string | null;
      paymentDate?: IsoDateString | null;
      memo?: string | null;
    },
    updatedByUserId: string
  ): Promise<void> {
    return this.inCtxAsync(async () => {
      const collectionRef = this.getCollectionRef(officeId);
      const docRef = doc(collectionRef, targetYearMonth);
    const now = new Date().toISOString().slice(0, 10);

    const updateData: Partial<SocialInsurancePayment> = {
      updatedAt: now,
      updatedByUserId
    };

    if (dto.plannedHealthCareCompany != null) {
      updateData.plannedHealthCareCompany = dto.plannedHealthCareCompany;
    } else if (dto.plannedHealthCompany != null || dto.plannedCareCompany != null) {
      // 後方互換：旧フィールドから新フィールドに変換
      updateData.plannedHealthCareCompany = (dto.plannedHealthCompany ?? 0) + (dto.plannedCareCompany ?? 0);
    }
    if (dto.plannedPensionCompany != null) updateData.plannedPensionCompany = dto.plannedPensionCompany;
    if (dto.plannedTotalCompany != null) updateData.plannedTotalCompany = dto.plannedTotalCompany;
    if (dto.actualHealthCareCompany !== undefined) {
      updateData.actualHealthCareCompany = dto.actualHealthCareCompany;
    } else if (dto.actualHealthCompany !== undefined || dto.actualCareCompany !== undefined) {
      // 後方互換：旧フィールドから新フィールドに変換
      if (dto.actualHealthCompany != null && dto.actualCareCompany != null) {
        updateData.actualHealthCareCompany = dto.actualHealthCompany + dto.actualCareCompany;
      } else {
        updateData.actualHealthCareCompany = null;
      }
    }
    if (dto.actualPensionCompany !== undefined) updateData.actualPensionCompany = dto.actualPensionCompany;
    if (dto.actualTotalCompany !== undefined) updateData.actualTotalCompany = dto.actualTotalCompany;
    if (dto.paymentStatus != null) updateData.paymentStatus = dto.paymentStatus;
    if (dto.paymentMethod !== undefined) updateData.paymentMethod = dto.paymentMethod;
    if (dto.paymentMethodNote !== undefined) updateData.paymentMethodNote = dto.paymentMethodNote;
    if (dto.paymentDate !== undefined) updateData.paymentDate = dto.paymentDate;
    if (dto.memo !== undefined) updateData.memo = dto.memo;

      await updateDoc(docRef, updateData);
    });
  }

  async delete(officeId: string, targetYearMonth: YearMonthString): Promise<void> {
    return this.inCtxAsync(async () => {
      const collectionRef = this.getCollectionRef(officeId);
      const docRef = doc(collectionRef, targetYearMonth);
      await deleteDoc(docRef);
    });
  }
}
