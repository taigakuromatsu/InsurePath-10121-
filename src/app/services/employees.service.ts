import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  deleteField,
  doc,
  docData,
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
   * Firestore merge用の値に変換（再帰的）
   * - undefined: 除去（変更なし）
   * - null: deleteField()（削除）
   * - オブジェクト: 再帰的に変換
   * - 空オブジェクト: undefined（no-op）
   */
  private toFirestoreMergeValue(value: any): any {
    if (value === undefined) return undefined;
    if (value === null) return deleteField();

    // deleteField()を配列内に入れるのは事故りやすいので配列はそのまま扱う
    if (Array.isArray(value)) return value;

    if (typeof value === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(value)) {
        const mv = this.toFirestoreMergeValue(v);
        if (mv !== undefined) out[k] = mv;
      }
      // 空オブジェクトは「no-op」にしたいのでundefined扱い
      return Object.keys(out).length > 0 ? out : undefined;
    }

      return value;
    }

  /**
   * payloadをFirestore merge用に変換
   * undefinedのキーは除去、nullはdeleteField()に変換
   */
  private buildMergePayload(payload: Record<string, any>): Record<string, any> {
    const out: any = {};
    for (const [k, v] of Object.entries(payload)) {
      const mv = this.toFirestoreMergeValue(v);
      if (mv !== undefined) out[k] = mv;
    }
    return out;
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

  /**
   * 従業員をリアルタイムで監視（watch）
   */
  watch(officeId: string, employeeId: string): Observable<Employee | null> {
    return this.inCtx(() => {
      const ref = doc(this.collectionPath(officeId), employeeId);
      return docData(ref, { idField: 'id' }) as Observable<Employee | null>;
    });
  }

  /**
   * 従業員一覧をリアルタイムで監視（watch）
   * データ変更を自動的に検知します。
   */
  list(officeId: string): Observable<Employee[]> {
    return this.inCtx(() => {
      const ref = this.collectionPath(officeId);
      return collectionData(ref, { idField: 'id' }) as Observable<Employee[]>;
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
    const isUpdate = !!employee.id;

    const payload: any = {
      id: ref.id,
      officeId,
      updatedAt: now
    };

    // create: デフォルト値を使用
    if (!isUpdate) {
      payload.name = employee.name ?? '未入力';
      payload.birthDate = employee.birthDate ?? now.substring(0, 10);
      payload.hireDate = employee.hireDate ?? null;
      payload.employmentType = employee.employmentType ?? null;
      payload.isInsured = employee.isInsured ?? true;
      payload.isStudent = employee.isStudent ?? false;
      payload.createdAt = employee.createdAt ?? now;
    } else {
      // update: 渡された項目だけをpayloadに入れる（デフォルト値なし）
      if (employee.name !== undefined) payload.name = employee.name;
      if (employee.birthDate !== undefined) payload.birthDate = employee.birthDate;
      if (employee.hireDate !== undefined) payload.hireDate = employee.hireDate;
      if (employee.employmentType !== undefined) payload.employmentType = employee.employmentType;
      if (employee.isInsured !== undefined) payload.isInsured = employee.isInsured;
      if (employee.isStudent !== undefined) payload.isStudent = employee.isStudent;
    }

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

    if (employee.weeklyWorkingHours !== undefined) {
      payload.weeklyWorkingHours =
        employee.weeklyWorkingHours === null ? null : Number(employee.weeklyWorkingHours);
    }
    if (employee.weeklyWorkingDays !== undefined) {
      payload.weeklyWorkingDays =
        employee.weeklyWorkingDays === null ? null : Number(employee.weeklyWorkingDays);
    }

    if (employee.healthInsuredSymbol !== undefined) {
      payload.healthInsuredSymbol = employee.healthInsuredSymbol; // nullなら削除へ
    }
    if (employee.healthInsuredNumber !== undefined) {
      payload.healthInsuredNumber = employee.healthInsuredNumber; // nullなら削除へ
    }
    if (employee.pensionNumber !== undefined) {
      payload.pensionNumber = employee.pensionNumber; // nullなら削除へ
    }
    if (employee.myNumber !== undefined) {
      payload.myNumber = employee.myNumber;
    }

    if (employee.healthGrade !== undefined) {
      payload.healthGrade =
        employee.healthGrade === null ? null : Number(employee.healthGrade);
    }
    if (employee.healthStandardMonthly !== undefined) {
      payload.healthStandardMonthly =
        employee.healthStandardMonthly === null ? null : Number(employee.healthStandardMonthly);
    }
    if (employee.healthGradeSource !== undefined) {
      payload.healthGradeSource = employee.healthGradeSource; // nullなら削除へ
    }

    if (employee.pensionGrade !== undefined) {
      payload.pensionGrade =
        employee.pensionGrade === null ? null : Number(employee.pensionGrade);
    }
    if (employee.pensionStandardMonthly !== undefined) {
      payload.pensionStandardMonthly =
        employee.pensionStandardMonthly === null ? null : Number(employee.pensionStandardMonthly);
    }
    if (employee.pensionGradeSource !== undefined) {
      payload.pensionGradeSource = employee.pensionGradeSource; // nullなら削除へ
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
    if (employee.premiumExemptionMonths !== undefined) {
      payload.premiumExemptionMonths = employee.premiumExemptionMonths;
    }
    if (employee.workingStatusNote !== undefined) {
      payload.workingStatusNote = employee.workingStatusNote;
    }
    // portal
    if (employee.portal !== undefined) {
      payload.portal = employee.portal;
    }

    // bankAccount: 指定されたキーだけpayloadに入れる
    if (employee.bankAccount !== undefined) {
      if (employee.bankAccount === null) {
        payload.bankAccount = null;
      } else {
        const ba: any = {};
        if (employee.bankAccount.bankName !== undefined) ba.bankName = employee.bankAccount.bankName;
        if (employee.bankAccount.bankCode !== undefined) ba.bankCode = employee.bankAccount.bankCode;
        if (employee.bankAccount.branchName !== undefined) ba.branchName = employee.bankAccount.branchName;
        if (employee.bankAccount.branchCode !== undefined) ba.branchCode = employee.bankAccount.branchCode;
        if (employee.bankAccount.accountType !== undefined) ba.accountType = employee.bankAccount.accountType;
        if (employee.bankAccount.accountNumber !== undefined) ba.accountNumber = employee.bankAccount.accountNumber;
        if (employee.bankAccount.accountHolderName !== undefined) ba.accountHolderName = employee.bankAccount.accountHolderName;
        if (employee.bankAccount.accountHolderKana !== undefined) ba.accountHolderKana = employee.bankAccount.accountHolderKana;
        if (employee.bankAccount.isMain !== undefined) ba.isMain = employee.bankAccount.isMain;
        payload.bankAccount = ba;
    }
    }

    // payrollSettings: 指定されたキーだけpayloadに入れる（?? nullをやめる）
    if (employee.payrollSettings !== undefined) {
      if (employee.payrollSettings === null) {
        payload.payrollSettings = null;
      } else {
        const ps: any = {};
        if (employee.payrollSettings.payType !== undefined) ps.payType = employee.payrollSettings.payType;
        if (employee.payrollSettings.payCycle !== undefined) ps.payCycle = employee.payrollSettings.payCycle;
        if (employee.payrollSettings.insurableMonthlyWage !== undefined) ps.insurableMonthlyWage = employee.payrollSettings.insurableMonthlyWage;
        if (employee.payrollSettings.note !== undefined) ps.note = employee.payrollSettings.note;
        payload.payrollSettings = ps;
      }
    }

    // Firestore merge用に変換（null => deleteField()、undefined => 除去）
    const mergePayload = this.buildMergePayload(payload);
    await setDoc(ref, mergePayload, { merge: true });
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
      portal,
      updatedAt: now
    };

    if (updatedByUserId !== undefined) {
      payload.updatedByUserId = updatedByUserId;
    }

    // Firestore merge用に変換
    const mergePayload = this.buildMergePayload(payload);
    await setDoc(ref, mergePayload, { merge: true });
    });
  }
}

