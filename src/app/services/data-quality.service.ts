import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { combineLatest, map, of, switchMap, Observable } from 'rxjs';

import {
  DataQualityIssue,
  DataQualityIssueType,
  Employee,
  StandardRewardHistory
} from '../types';
import { EmployeesService } from './employees.service';
import { StandardRewardHistoryService } from './standard-reward-history.service';
import { todayYmd, ymdToDateLocal } from '../utils/date-helpers';

@Injectable({ providedIn: 'root' })
export class DataQualityService {
  private readonly firestore = inject(Firestore);
  private readonly employeesService = inject(EmployeesService);
  private readonly standardRewardHistoryService = inject(StandardRewardHistoryService);
  private readonly injector = inject(EnvironmentInjector);

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  listIssues(officeId: string): Observable<DataQualityIssue[]> {
    return this.employeesService.list(officeId).pipe(
      switchMap((employees) => {
        if (!employees.length) return of([]);

        return this.loadHistories(officeId, employees).pipe(
          map((historyMap) => this.buildIssues(employees, historyMap))
        );
      })
    );
  }


  private loadHistories(
    officeId: string,
    employees: Employee[]
  ): Observable<Map<string, StandardRewardHistory[]>> {
    if (!employees.length) return of(new Map());

    return combineLatest(
      employees.map((emp) =>
        this.standardRewardHistoryService.list(officeId, emp.id).pipe(
          map((histories) => ({
            employeeId: emp.id,
            histories
          }))
        )
      )
    ).pipe(
      map((entries) => {
        const mapResult = new Map<string, StandardRewardHistory[]>();
        entries.forEach(({ employeeId, histories }) => {
          mapResult.set(employeeId, histories);
        });
        return mapResult;
      })
    );
  }

  private buildIssues(
    employees: Employee[],
    historiesMap: Map<string, StandardRewardHistory[]>
  ): DataQualityIssue[] {
    const detectedAt = todayYmd();
    const issues: DataQualityIssue[] = [];

    employees.forEach((emp) => {
      const histories = historiesMap.get(emp.id) ?? [];
      const employeeName = emp.name;
      const hireDate = emp.hireDate;
      const isGrace = this.isWithinHireGrace(hireDate);

      // ルール1: 被保険者フラグと資格情報・標準報酬履歴の不整合
      const hasQualification =
        !!emp.healthQualificationDate || !!emp.pensionQualificationDate;
      const hasHistory = histories.length > 0;
      if (!isGrace) {
        if (emp.isInsured && (!hasQualification || !hasHistory)) {
          issues.push(
            this.createIssue(
              emp,
              employeeName,
              'insured_qualification_inconsistent',
              '社会保険加入フラグは ON ですが、資格取得日または標準報酬履歴が登録されていません。',
              undefined,
              detectedAt
            )
          );
        }
        if (!emp.isInsured && hasQualification) {
          issues.push(
            this.createIssue(
              emp,
              employeeName,
              'insured_qualification_inconsistent',
              '資格取得日が入力されていますが、加入フラグが OFF です。',
              undefined,
              detectedAt
            )
          );
        }
      }

      // ルール2: 退職日があるのに資格喪失日が未設定
      // 退職日を入力している場合、資格取得日があるなら資格喪失日も設定すべき
      if (emp.retireDate && !isGrace) {
        if (emp.healthQualificationDate && !emp.healthLossDate) {
            issues.push(
              this.createIssue(
                emp,
                employeeName,
              'loss_retire_premium_mismatch',
              '退職日が入力されていますが、健康保険の資格喪失日が設定されていません。',
              undefined,
                detectedAt
              )
            );
          }
        if (emp.pensionQualificationDate && !emp.pensionLossDate) {
            issues.push(
              this.createIssue(
                emp,
                employeeName,
                'loss_retire_premium_mismatch',
              '退職日が入力されていますが、厚生年金の資格喪失日が設定されていません。',
              undefined,
              detectedAt
            )
          );
        }
      }


    });

    return issues;
  }

  private createIssue(
    employee: Employee,
    employeeName: string,
    issueType: DataQualityIssueType,
    description: string,
    targetPeriod: string | undefined,
    detectedAt: string
  ): DataQualityIssue {
    const idBase = `${employee.id}-${issueType}-${targetPeriod ?? 'na'}`;
    return {
      id: idBase,
      employeeId: employee.id,
      employeeName,
      issueType,
      description,
      targetPeriod,
      detectedAt,
      severity: 'warning'
    };
  }
  private isWithinHireGrace(hireDate?: string): boolean {
    if (!hireDate) return false;
    const hire = ymdToDateLocal(hireDate);
    const today = ymdToDateLocal(todayYmd());
    const diff = today.getTime() - hire.getTime();
    const oneMonthMs = 31 * 24 * 60 * 60 * 1000;
    return diff >= 0 && diff <= oneMonthMs;
  }
}

