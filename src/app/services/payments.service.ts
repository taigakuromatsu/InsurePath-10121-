import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
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

  private getCollectionRef(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'payments');
  }

  async calculatePlannedAmounts(
    officeId: string,
    targetYearMonth: YearMonthString
  ): Promise<{
    plannedHealthCompany: number;
    plannedCareCompany: number;
    plannedPensionCompany: number;
    plannedTotalCompany: number;
  }> {
    const monthlyPremiums = await firstValueFrom(
      this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, targetYearMonth)
    );

    const monthlyHealth = monthlyPremiums.reduce((sum, p) => sum + (p.healthEmployer ?? 0), 0);
    const monthlyCare = monthlyPremiums.reduce((sum, p) => sum + (p.careEmployer ?? 0), 0);
    const monthlyPension = monthlyPremiums.reduce((sum, p) => sum + (p.pensionEmployer ?? 0), 0);

    const bonusPremiums = await firstValueFrom(
      this.bonusPremiumsService.listByOfficeAndYearMonth(officeId, targetYearMonth)
    );

    const bonusHealth = bonusPremiums.reduce((sum, b) => sum + (b.healthEmployer ?? 0), 0);
    const bonusPension = bonusPremiums.reduce((sum, b) => sum + (b.pensionEmployer ?? 0), 0);

    const plannedHealthCompany = monthlyHealth + bonusHealth;
    const plannedCareCompany = monthlyCare;
    const plannedPensionCompany = monthlyPension + bonusPension;
    const plannedTotalCompany = plannedHealthCompany + plannedCareCompany + plannedPensionCompany;

    return {
      plannedHealthCompany,
      plannedCareCompany,
      plannedPensionCompany,
      plannedTotalCompany
    };
  }

  async create(
    officeId: string,
    dto: {
      targetYearMonth: YearMonthString;
      plannedHealthCompany?: number;
      plannedCareCompany?: number;
      plannedPensionCompany?: number;
      plannedTotalCompany?: number;
      actualHealthCompany?: number | null;
      actualCareCompany?: number | null;
      actualPensionCompany?: number | null;
      actualTotalCompany?: number | null;
      paymentStatus?: PaymentStatus;
      paymentMethod?: PaymentMethod | null;
      paymentMethodNote?: string | null;
      paymentDate?: IsoDateString | null;
      memo?: string | null;
    },
    createdByUserId: string
  ): Promise<string> {
    const collectionRef = this.getCollectionRef(officeId);
    const docId = dto.targetYearMonth;
    const docRef = doc(collectionRef, docId);
    const now = new Date().toISOString().slice(0, 10);

    const allPlannedMissing =
      dto.plannedHealthCompany == null &&
      dto.plannedCareCompany == null &&
      dto.plannedPensionCompany == null &&
      dto.plannedTotalCompany == null;

    const plannedAmounts = allPlannedMissing
      ? await this.calculatePlannedAmounts(officeId, dto.targetYearMonth)
      : {
          plannedHealthCompany: dto.plannedHealthCompany ?? 0,
          plannedCareCompany: dto.plannedCareCompany ?? 0,
          plannedPensionCompany: dto.plannedPensionCompany ?? 0,
          plannedTotalCompany:
            dto.plannedTotalCompany ??
            ((dto.plannedHealthCompany ?? 0) +
              (dto.plannedCareCompany ?? 0) +
              (dto.plannedPensionCompany ?? 0))
        };

    const payload: SocialInsurancePayment = {
      id: docId,
      officeId,
      targetYearMonth: dto.targetYearMonth,
      ...plannedAmounts,
      actualHealthCompany: dto.actualHealthCompany ?? null,
      actualCareCompany: dto.actualCareCompany ?? null,
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
  }

  listByOffice(officeId: string, limitCount?: number): Observable<SocialInsurancePayment[]> {
    const collectionRef = this.getCollectionRef(officeId);
    const constraints: QueryConstraint[] = [orderBy('targetYearMonth', 'desc')];

    if (limitCount != null) {
      constraints.push(limit(limitCount));
    }

    const q = query(collectionRef, ...constraints);

    return collectionData(q, { idField: 'id' }) as Observable<SocialInsurancePayment[]>;
  }

  get(officeId: string, targetYearMonth: YearMonthString): Observable<SocialInsurancePayment | undefined> {
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
  }

  async update(
    officeId: string,
    targetYearMonth: YearMonthString,
    dto: {
      plannedHealthCompany?: number;
      plannedCareCompany?: number;
      plannedPensionCompany?: number;
      plannedTotalCompany?: number;
      actualHealthCompany?: number | null;
      actualCareCompany?: number | null;
      actualPensionCompany?: number | null;
      actualTotalCompany?: number | null;
      paymentStatus?: PaymentStatus;
      paymentMethod?: PaymentMethod | null;
      paymentMethodNote?: string | null;
      paymentDate?: IsoDateString | null;
      memo?: string | null;
    },
    updatedByUserId: string
  ): Promise<void> {
    const collectionRef = this.getCollectionRef(officeId);
    const docRef = doc(collectionRef, targetYearMonth);
    const now = new Date().toISOString().slice(0, 10);

    const updateData: Partial<SocialInsurancePayment> = {
      updatedAt: now,
      updatedByUserId
    };

    if (dto.plannedHealthCompany != null) updateData.plannedHealthCompany = dto.plannedHealthCompany;
    if (dto.plannedCareCompany != null) updateData.plannedCareCompany = dto.plannedCareCompany;
    if (dto.plannedPensionCompany != null) updateData.plannedPensionCompany = dto.plannedPensionCompany;
    if (dto.plannedTotalCompany != null) updateData.plannedTotalCompany = dto.plannedTotalCompany;
    if (dto.actualHealthCompany !== undefined) updateData.actualHealthCompany = dto.actualHealthCompany;
    if (dto.actualCareCompany !== undefined) updateData.actualCareCompany = dto.actualCareCompany;
    if (dto.actualPensionCompany !== undefined) updateData.actualPensionCompany = dto.actualPensionCompany;
    if (dto.actualTotalCompany !== undefined) updateData.actualTotalCompany = dto.actualTotalCompany;
    if (dto.paymentStatus != null) updateData.paymentStatus = dto.paymentStatus;
    if (dto.paymentMethod !== undefined) updateData.paymentMethod = dto.paymentMethod;
    if (dto.paymentMethodNote !== undefined) updateData.paymentMethodNote = dto.paymentMethodNote;
    if (dto.paymentDate !== undefined) updateData.paymentDate = dto.paymentDate;
    if (dto.memo !== undefined) updateData.memo = dto.memo;

    await updateDoc(docRef, updateData);
  }
}
