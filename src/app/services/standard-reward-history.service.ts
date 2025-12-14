import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  limit,
  orderBy,
  query,
  setDoc,
  where
} from '@angular/fire/firestore';
import { firstValueFrom, Observable } from 'rxjs';

import { Employee, InsuranceKind, StandardRewardHistory } from '../types';
import { CurrentUserService } from './current-user.service';
import { EmployeesService } from './employees.service';

@Injectable({ providedIn: 'root' })
export class StandardRewardHistoryService {
  private readonly injector = inject(EnvironmentInjector);
  constructor(
    private readonly firestore: Firestore,
    private readonly currentUserService: CurrentUserService,
    private readonly employeesService: EmployeesService
  ) {}

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxAsync<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  private collectionPath(officeId: string, employeeId: string) {
    return this.inCtx(() => collection(
      this.firestore,
      'offices',
      officeId,
      'employees',
      employeeId,
      'standardRewardHistories'
    ));
  }

  list(officeId: string, employeeId: string): Observable<StandardRewardHistory[]> {
    return this.inCtx(() => {
      const ref = query(
        this.collectionPath(officeId, employeeId),
        orderBy('decisionYearMonth', 'desc')
      );
      return collectionData(ref, { idField: 'id' }) as Observable<StandardRewardHistory[]>;
    });
  }

  /**
   * 保険種別でフィルタして履歴を取得
   */
  listByInsuranceKind(
    officeId: string,
    employeeId: string,
    insuranceKind: InsuranceKind
  ): Observable<StandardRewardHistory[]> {
    return this.inCtx(() => {
      const ref = query(
        this.collectionPath(officeId, employeeId),
        where('insuranceKind', '==', insuranceKind),
        orderBy('decisionYearMonth', 'desc')
      );
      return collectionData(ref, { idField: 'id' }) as Observable<StandardRewardHistory[]>;
    });
  }

  /**
   * 指定保険種別の最新履歴を取得
   */
  async getLatestByInsuranceKind(
    officeId: string,
    employeeId: string,
    insuranceKind: InsuranceKind
  ): Promise<StandardRewardHistory | null> {
    return this.inCtxAsync(async () => {
      const ref = query(
        this.collectionPath(officeId, employeeId),
        where('insuranceKind', '==', insuranceKind),
        orderBy('appliedFromYearMonth', 'desc'),
        limit(1)
      );
      const snapshot = await firstValueFrom(collectionData(ref, { idField: 'id' }));
      return snapshot.length > 0 ? (snapshot[0] as StandardRewardHistory) : null;
    });
  }

  async save(
    officeId: string,
    employeeId: string,
    history: Partial<StandardRewardHistory> & { id?: string }
  ): Promise<void> {
    return this.inCtxAsync(async () => {
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
      decisionKind: history.decisionKind ?? 'other',
      updatedAt: now,
      updatedByUserId: currentUser?.id
    };

    // gradeが設定されている場合のみ追加（undefinedはFirestoreに保存できない）
    if (history.grade != null) {
      payload.grade = history.grade;
    }

    // noteが設定されている場合のみ追加（undefinedはFirestoreに保存できない）
    if (history.note != null && history.note.trim() !== '') {
      payload.note = history.note.trim();
    }

    if (!history.id) {
      payload.createdAt = now;
      payload.createdByUserId = currentUser?.id;
    } else if (history.createdAt) {
      payload.createdAt = history.createdAt;
      payload.createdByUserId = history.createdByUserId;
    }

      await setDoc(ref, payload, { merge: true });

      // 保存後にEmployeeを同期
      const insuranceKind = payload.insuranceKind ?? 'health';
      await this.syncEmployeeFromHistory(officeId, employeeId, insuranceKind);
    });
  }

  /**
   * 履歴からEmployeeの標準報酬を同期
   * 履歴が0件の場合は、Employee側の該当フィールドをnullに戻す
   */
  private async syncEmployeeFromHistory(
    officeId: string,
    employeeId: string,
    insuranceKind: InsuranceKind
  ): Promise<void> {
    const latestHistory = await this.getLatestByInsuranceKind(officeId, employeeId, insuranceKind);

    const employee = await firstValueFrom(this.employeesService.get(officeId, employeeId));
    if (!employee) {
      return;
    }

    const updatePayload: Partial<Employee> = {};

    if (insuranceKind === 'health') {
      if (latestHistory) {
        updatePayload.healthStandardMonthly = latestHistory.standardMonthlyReward;
        if (latestHistory.grade != null) {
          updatePayload.healthGrade = latestHistory.grade;
        }
      } else {
        // 履歴が0件の場合はnullに戻す
        updatePayload.healthStandardMonthly = null;
        updatePayload.healthGrade = null;
      }
    } else if (insuranceKind === 'pension') {
      if (latestHistory) {
        updatePayload.pensionStandardMonthly = latestHistory.standardMonthlyReward;
        if (latestHistory.grade != null) {
          updatePayload.pensionGrade = latestHistory.grade;
        }
      } else {
        // 履歴が0件の場合はnullに戻す
        updatePayload.pensionStandardMonthly = null;
        updatePayload.pensionGrade = null;
      }
    }

    await this.employeesService.save(officeId, { ...employee, ...updatePayload });
  }

  /**
   * 履歴を削除し、必要に応じてEmployeeを同期
   * @param insuranceKind 削除する履歴の保険種別（指定された場合のみ同期を実行）
   */
  async delete(
    officeId: string,
    employeeId: string,
    historyId: string,
    insuranceKind?: InsuranceKind
  ): Promise<void> {
    return this.inCtxAsync(async () => {
      const ref = doc(this.collectionPath(officeId, employeeId), historyId);
      await deleteDoc(ref);

      // 保険種別が分かる場合は削除後に同期
      if (insuranceKind) {
        await this.syncEmployeeFromHistory(officeId, employeeId, insuranceKind);
      }
    });
  }
}
