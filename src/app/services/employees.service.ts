import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc
} from '@angular/fire/firestore';
import { from, map, Observable } from 'rxjs';

import { Employee } from '../types';

@Injectable({ providedIn: 'root' })
export class EmployeesService {
  constructor(private readonly firestore: Firestore) {}

  private collectionPath(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'employees');
  }

  // ★ここは getDocs に戻す（元の形）
  list(officeId: string): Observable<Employee[]> {
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
  }

  async save(
    officeId: string,
    employee: Partial<Employee> & { id?: string }
  ): Promise<void> {
    const employeesRef = this.collectionPath(officeId);
    const ref = employee.id ? doc(employeesRef, employee.id) : doc(employeesRef);
    const now = new Date().toISOString();

    // 必須系＋よく使う基本項目だけをまずセット
    const payload: Employee = {
      id: ref.id,
      officeId,
      name: employee.name ?? '未入力',
      birthDate: employee.birthDate ?? now.substring(0, 10),
      hireDate: employee.hireDate ?? now.substring(0, 10),
      employmentType: employee.employmentType ?? 'regular',
      monthlyWage: Number(employee.monthlyWage ?? 0),
      isInsured: employee.isInsured ?? true,
      isStudent: employee.isStudent ?? false,
      createdAt: employee.createdAt ?? now,
      updatedAt: now
    };

    // --- ここから下は「値が入っているものだけ追加する」 ---
    if (employee.kana != null) payload.kana = employee.kana;
    if (employee.department != null) payload.department = employee.department;
    if (employee.retireDate != null) payload.retireDate = employee.retireDate;
    if (employee.address != null) payload.address = employee.address;
    if (employee.phone != null) payload.phone = employee.phone;
    if (employee.contactEmail != null) payload.contactEmail = employee.contactEmail;
    if (employee.contractPeriodNote != null) payload.contractPeriodNote = employee.contractPeriodNote;
    if (employee.updatedByUserId != null) payload.updatedByUserId = employee.updatedByUserId;

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
    if (employee.healthQualificationDate != null) {
      payload.healthQualificationDate = employee.healthQualificationDate;
    }
    if (employee.healthLossDate != null) {
      payload.healthLossDate = employee.healthLossDate;
    }
    if (employee.healthQualificationKind != null) {
      payload.healthQualificationKind = employee.healthQualificationKind;
    }
    if (employee.healthLossReasonKind != null) {
      payload.healthLossReasonKind = employee.healthLossReasonKind;
    }

    // 厚生年金の資格情報
    if (employee.pensionQualificationDate != null) {
      payload.pensionQualificationDate = employee.pensionQualificationDate;
    }
    if (employee.pensionLossDate != null) {
      payload.pensionLossDate = employee.pensionLossDate;
    }
    if (employee.pensionQualificationKind != null) {
      payload.pensionQualificationKind = employee.pensionQualificationKind;
    }
    if (employee.pensionLossReasonKind != null) {
      payload.pensionLossReasonKind = employee.pensionLossReasonKind;
    }

    // 就業状態
    if (employee.workingStatus != null) {
      payload.workingStatus = employee.workingStatus;
    }
    if (employee.workingStatusStartDate != null) {
      payload.workingStatusStartDate = employee.workingStatusStartDate;
    }
    if (employee.workingStatusEndDate != null) {
      payload.workingStatusEndDate = employee.workingStatusEndDate;
    }
    if (employee.premiumTreatment != null) {
      payload.premiumTreatment = employee.premiumTreatment;
    }
    if (employee.workingStatusNote != null) {
      payload.workingStatusNote = employee.workingStatusNote;
    }

    await setDoc(ref, payload, { merge: true });
  }

  delete(officeId: string, employeeId: string): Promise<void> {
    const ref = doc(this.collectionPath(officeId), employeeId);
    return deleteDoc(ref);
  }
}

