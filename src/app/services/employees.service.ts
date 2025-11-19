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

  async save(officeId: string, employee: Partial<Employee> & { id?: string }): Promise<void> {
    const employeesRef = this.collectionPath(officeId);
    const ref = employee.id ? doc(employeesRef, employee.id) : doc(employeesRef);
    const now = new Date().toISOString();

    const payload: Employee = {
      id: ref.id,
      officeId,
      name: employee.name ?? '未入力',
      kana: employee.kana,
      birthDate: employee.birthDate ?? now.substring(0, 10),
      department: employee.department,
      hireDate: employee.hireDate ?? now.substring(0, 10),
      retireDate: employee.retireDate,
      employmentType: employee.employmentType ?? 'regular',
      address: employee.address,
      phone: employee.phone,
      contactEmail: employee.contactEmail,
      weeklyWorkingHours:
        employee.weeklyWorkingHours != null ? Number(employee.weeklyWorkingHours) : undefined,
      weeklyWorkingDays:
        employee.weeklyWorkingDays != null ? Number(employee.weeklyWorkingDays) : undefined,
      contractPeriodNote: employee.contractPeriodNote,
      isStudent: employee.isStudent ?? false,
      monthlyWage: Number(employee.monthlyWage ?? 0),
      isInsured: employee.isInsured ?? true,
      healthInsuredSymbol: employee.healthInsuredSymbol,
      healthInsuredNumber: employee.healthInsuredNumber,
      pensionNumber: employee.pensionNumber,
      healthGrade: employee.healthGrade != null ? Number(employee.healthGrade) : undefined,
      healthStandardMonthly: employee.healthStandardMonthly,
      healthGradeSource: employee.healthGradeSource,
      pensionGrade: employee.pensionGrade != null ? Number(employee.pensionGrade) : undefined,
      pensionStandardMonthly: employee.pensionStandardMonthly,
      pensionGradeSource: employee.pensionGradeSource,
      createdAt: employee.createdAt ?? now,
      updatedAt: now,
      updatedByUserId: employee.updatedByUserId
    };

    await setDoc(ref, payload, { merge: true });
  }

  delete(officeId: string, employeeId: string): Promise<void> {
    const ref = doc(this.collectionPath(officeId), employeeId);
    return deleteDoc(ref);
  }
}
