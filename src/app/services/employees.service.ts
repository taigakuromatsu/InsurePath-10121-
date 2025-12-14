import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc
} from '@angular/fire/firestore';
import { from, map, Observable } from 'rxjs';

import { Employee, EmployeePortal } from '../types';

@Injectable({ providedIn: 'root' })
export class EmployeesService {
  private readonly injector = inject(EnvironmentInjector);
  constructor(private readonly firestore: Firestore) {}

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxAsync<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  /**
   * 第一階層の undefined を除去したオブジェクトを返す（null / undefined はそのまま返す）
   */
  private cleanNestedObject<T extends Record<string, any> | null | undefined>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }

    const cleaned: any = {};
    for (const [key, v] of Object.entries(value)) {
      if (v === undefined) {
        continue;
      }
      cleaned[key] = v;
    }
    return cleaned as T;
  }

  private collectionPath(officeId: string) {
    return this.inCtx(() => collection(this.firestore, 'offices', officeId, 'employees'));
  }

  get(officeId: string, employeeId: string): Observable<Employee | null> {
    return this.inCtx(() => {
    const ref = doc(this.collectionPath(officeId), employeeId);
    return from(getDoc(ref)).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }

        return { id: snapshot.id, ...(snapshot.data() as any) } as Employee;
      })
    );
    });
  }

  // ★ここは getDocs に戻す（元の形）
  list(officeId: string): Observable<Employee[]> {
    return this.inCtx(() => {
    const ref = this.collectionPath(officeId);
    return from(getDocs(ref)).pipe(
      map((snapshot) =>
        snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any)
            } as Employee)
        )
      )
    );
    });
  }

  async save(
    officeId: string,
    employee: Partial<Employee> & { id?: string }
  ): Promise<string> {
    return this.inCtxAsync(async () => {
    const employeesRef = this.collectionPath(officeId);
    const ref = employee.id ? doc(employeesRef, employee.id) : doc(employeesRef);
    const now = new Date().toISOString();

    // 必須系＋よく使う基本項目だけをまずセット
    // nullも書き込み対象として扱うため、型をanyに拡張
    const payload: any = {
      id: ref.id,
      officeId,
      name: employee.name ?? '未入力',
      birthDate: employee.birthDate ?? now.substring(0, 10),
      hireDate: employee.hireDate ?? now.substring(0, 10),
      employmentType: employee.employmentType ?? 'regular',
      // monthlyWage は廃止扱い。nullを書き込み→deleteFieldで削除。
      monthlyWage: null,
      isInsured: employee.isInsured ?? true,
      isStudent: employee.isStudent ?? false,
      createdAt: employee.createdAt ?? now,
      updatedAt: now
    };

    // --- ここから下は「値が入っているものだけ追加する」 ---
    // nullも書き込み対象として扱う（空文字でクリアするため）
    if (employee.kana !== undefined) payload.kana = employee.kana;
    if (employee.department !== undefined) payload.department = employee.department;
    if (employee.retireDate !== undefined) payload.retireDate = employee.retireDate;
    if (employee.address !== undefined) payload.address = employee.address;
    if (employee.phone !== undefined) payload.phone = employee.phone;
    if (employee.contactEmail !== undefined) {
      // nullも書き込み対象として扱う（空文字でクリアするため）
      if (employee.contactEmail === null) {
        payload.contactEmail = null;
      } else {
        const normalizedEmail = employee.contactEmail?.trim().toLowerCase();
        // 空文字の場合はnullをセット（Firestoreで値をクリアする）
        payload.contactEmail = normalizedEmail && normalizedEmail.length > 0 ? normalizedEmail : null;
      }
    }
    
    if (employee.contractPeriodNote !== undefined) payload.contractPeriodNote = employee.contractPeriodNote;
    if (employee.updatedByUserId != null) payload.updatedByUserId = employee.updatedByUserId;

    if (employee.employeeCodeInOffice !== undefined) {
      payload.employeeCodeInOffice = employee.employeeCodeInOffice;
    }
    if (employee.sex !== undefined) {
      payload.sex = employee.sex;
    }
    if (employee.postalCode !== undefined) {
      payload.postalCode = employee.postalCode;
    }
    if (employee.addressKana !== undefined) {
      payload.addressKana = employee.addressKana;
    }

    if (employee.weeklyWorkingHours != null) {
      payload.weeklyWorkingHours = Number(employee.weeklyWorkingHours);
    }
    if (employee.weeklyWorkingDays != null) {
      payload.weeklyWorkingDays = Number(employee.weeklyWorkingDays);
    }

    if (employee.healthInsuredSymbol != null) {
      payload.healthInsuredSymbol = employee.healthInsuredSymbol;
    }
    if (employee.healthInsuredNumber != null) {
      payload.healthInsuredNumber = employee.healthInsuredNumber;
    }
    if (employee.pensionNumber != null) {
      payload.pensionNumber = employee.pensionNumber;
    }
    if (employee.myNumber !== undefined) {
      payload.myNumber = employee.myNumber;
    }

    if (employee.healthGrade != null) {
      payload.healthGrade = Number(employee.healthGrade);
    }
    if (employee.healthStandardMonthly != null) {
      payload.healthStandardMonthly = Number(employee.healthStandardMonthly);
    }
    if (employee.healthGradeSource != null) {
      payload.healthGradeSource = employee.healthGradeSource;
    }

    if (employee.pensionGrade != null) {
      payload.pensionGrade = Number(employee.pensionGrade);
    }
    if (employee.pensionStandardMonthly != null) {
      payload.pensionStandardMonthly = Number(employee.pensionStandardMonthly);
    }
    if (employee.pensionGradeSource != null) {
      payload.pensionGradeSource = employee.pensionGradeSource;
    }

    // 健康保険の資格情報
    if (employee.healthQualificationDate !== undefined) {
      payload.healthQualificationDate = employee.healthQualificationDate;
    }
    if (employee.healthLossDate !== undefined) {
      payload.healthLossDate = employee.healthLossDate;
    }
    if (employee.healthQualificationKind !== undefined) {
      payload.healthQualificationKind = employee.healthQualificationKind;
    }
    if (employee.healthLossReasonKind !== undefined) {
      payload.healthLossReasonKind = employee.healthLossReasonKind;
    }

    // 厚生年金の資格情報
    if (employee.pensionQualificationDate !== undefined) {
      payload.pensionQualificationDate = employee.pensionQualificationDate;
    }
    if (employee.pensionLossDate !== undefined) {
      payload.pensionLossDate = employee.pensionLossDate;
    }
    if (employee.pensionQualificationKind !== undefined) {
      payload.pensionQualificationKind = employee.pensionQualificationKind;
    }
    if (employee.pensionLossReasonKind !== undefined) {
      payload.pensionLossReasonKind = employee.pensionLossReasonKind;
    }

    // 就業状態
    if (employee.workingStatus !== undefined) {
      payload.workingStatus = employee.workingStatus;
    }
    if (employee.workingStatusStartDate !== undefined) {
      payload.workingStatusStartDate = employee.workingStatusStartDate;
    }
    if (employee.workingStatusEndDate !== undefined) {
      payload.workingStatusEndDate = employee.workingStatusEndDate;
    }
    if (employee.premiumTreatment !== undefined) {
      payload.premiumTreatment = employee.premiumTreatment;
    }
    if (employee.workingStatusNote !== undefined) {
      payload.workingStatusNote = employee.workingStatusNote;
    }
    if (employee.portal !== undefined) {
      payload.portal =
        employee.portal === null ? null : this.cleanNestedObject(employee.portal);
    }
    if (employee.bankAccount !== undefined) {
      payload.bankAccount =
        employee.bankAccount === null
          ? null
          : this.cleanNestedObject(employee.bankAccount);
    }
    if (employee.payrollSettings !== undefined) {
      if (employee.payrollSettings === null) {
        payload.payrollSettings = null;
      } else {
        payload.payrollSettings = this.cleanNestedObject({
          payType: employee.payrollSettings.payType,
          payCycle: employee.payrollSettings.payCycle,
          insurableMonthlyWage:
            employee.payrollSettings.insurableMonthlyWage ?? null,
          note: employee.payrollSettings.note ?? null
        });
      }
    }

    // null を deleteField() に変換して、空で保存された項目を Firestore から削除
    const processedPayload: any = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value === null) {
        processedPayload[key] = deleteField();
      } else {
        processedPayload[key] = value;
      }
    }

    await setDoc(ref, processedPayload, { merge: true });
    return ref.id;
    });
  }

  delete(officeId: string, employeeId: string): Promise<void> {
    return this.inCtxAsync(async () => {
    const ref = doc(this.collectionPath(officeId), employeeId);
    return deleteDoc(ref);
    });
  }

  async updatePortal(
    officeId: string,
    employeeId: string,
    portal: EmployeePortal,
    updatedByUserId?: string
  ): Promise<void> {
    return this.inCtxAsync(async () => {
    const ref = doc(this.collectionPath(officeId), employeeId);
    const now = new Date().toISOString();

    const payload: any = {
      portal: this.cleanNestedObject(portal),
      updatedAt: now
    };

    if (updatedByUserId) {
      payload.updatedByUserId = updatedByUserId;
    }

    await setDoc(ref, payload, { merge: true });
    });
  }
}

