import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  limit,
  orderBy,
  query
} from '@angular/fire/firestore';
import { combineLatest, from, map, of, switchMap, Observable } from 'rxjs';

import {
  DataQualityIssue,
  DataQualityIssueType,
  Employee,
  MonthlyPremium,
  StandardRewardHistory,
  YearMonthString
} from '../types';
import { EmployeesService } from './employees.service';
import { MonthlyPremiumsService } from './monthly-premiums.service';
import { StandardRewardHistoryService } from './standard-reward-history.service';
import { todayYmd, ymdToDateLocal } from '../utils/date-helpers';
import { isCareInsuranceTarget } from '../utils/premium-calculator';

@Injectable({ providedIn: 'root' })
export class DataQualityService {
  private readonly firestore = inject(Firestore);
  private readonly employeesService = inject(EmployeesService);
  private readonly monthlyPremiumsService = inject(MonthlyPremiumsService);
  private readonly standardRewardHistoryService = inject(StandardRewardHistoryService);

  listIssues(officeId: string): Observable<DataQualityIssue[]> {
    return this.employeesService.list(officeId).pipe(
      switchMap((employees) => {
        if (!employees.length) return of([]);

        return this.getTargetYearMonths(officeId).pipe(
          switchMap((targetMonths) =>
            combineLatest([
              this.loadMonthlyPremiums(officeId, targetMonths),
              this.loadHistories(officeId, employees)
            ]).pipe(
              map(([premiums, historyMap]) =>
                this.buildIssues(employees, premiums, historyMap, targetMonths)
              )
            )
          )
        );
      })
    );
  }

  private getTargetYearMonths(officeId: string): Observable<YearMonthString[]> {
    const ref = collection(this.firestore, 'offices', officeId, 'monthlyPremiums');
    const q = query(ref, orderBy('yearMonth', 'desc'), limit(1));
    return from(getDocs(q)).pipe(
      map((snap) => {
        if (snap.empty) return [] as YearMonthString[];
        const latest = (snap.docs[0].data() as any).yearMonth as YearMonthString;
        const prev = this.getPreviousYearMonth(latest);
        return prev ? [latest, prev] : [latest];
      })
    );
  }

  private loadMonthlyPremiums(
    officeId: string,
    months: YearMonthString[]
  ): Observable<MonthlyPremium[]> {
    if (!months.length) return of([]);
    return combineLatest(
      months.map((m) => this.monthlyPremiumsService.listByOfficeAndYearMonth(officeId, m))
    ).pipe(map((lists) => lists.flat()));
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
    premiums: MonthlyPremium[],
    historiesMap: Map<string, StandardRewardHistory[]>,
    targetMonths: YearMonthString[]
  ): DataQualityIssue[] {
    const detectedAt = todayYmd();
    const issues: DataQualityIssue[] = [];

    const premiumsByEmployee = this.groupPremiumsByEmployee(premiums);

    employees.forEach((emp) => {
      const empPremiums = premiumsByEmployee.get(emp.id) ?? [];
      const histories = (historiesMap.get(emp.id) ?? []).slice().sort((a, b) =>
        this.compareYearMonth(a.appliedFromYearMonth, b.appliedFromYearMonth)
      );
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

      // ルール2: 資格期間内なのに月次保険料レコードが存在しない
      targetMonths.forEach((ym) => {
        if (emp.isInsured && this.isQualifiedInMonth(emp, ym)) {
          const exists = empPremiums.some((p) => p.yearMonth === ym);
          if (!exists) {
            issues.push(
              this.createIssue(
                emp,
                employeeName,
                'missing_premium_record',
                `対象年月（${ym}）は資格期間内かつ加入中ですが、月額保険料レコードが見つかりません。`,
                ym,
                detectedAt
              )
            );
          }
        }
      });

      // ルール3: 資格喪失日（＋退職日）と保険料計上の矛盾
      const lossBoundary = this.getLossOrRetireYearMonth(emp);
      if (lossBoundary) {
        empPremiums.forEach((p) => {
          if (this.compareYearMonth(p.yearMonth, lossBoundary) > 0) {
            issues.push(
              this.createIssue(
                emp,
                employeeName,
                'loss_retire_premium_mismatch',
                '資格喪失日（または退職日）以降の年月にも保険料が計上されています。',
                p.yearMonth,
                detectedAt
              )
            );
          }
        });
      }

      // ルール4: 標準報酬決定・改定履歴の期間矛盾
      for (let i = 0; i < histories.length - 1; i++) {
        const current = histories[i];
        const next = histories[i + 1];
        // appliedFromYearMonth が厳密な昇順か（重複・逆順があればNG）
        if (this.compareYearMonth(next.appliedFromYearMonth, current.appliedFromYearMonth) <= 0) {
          issues.push(
            this.createIssue(
              emp,
              employeeName,
              'standard_reward_overlap',
              '標準報酬決定・改定履歴の適用期間が重複している可能性があります。',
              undefined,
              detectedAt
            )
          );
          break;
        }
      }

      // ルール5: 介護保険料の年齢不整合（介護対象判定は共通ロジックに統一）
      empPremiums.forEach((p) => {
        const isCareTarget = isCareInsuranceTarget(emp.birthDate, p.yearMonth);
        const careVal = p.careTotal ?? 0;
        if (isCareTarget && careVal <= 0) {
          issues.push(
            this.createIssue(
              emp,
              employeeName,
              'care_premium_mismatch',
              '介護保険の対象年齢と介護保険料の有無が一致していません。',
              p.yearMonth,
              detectedAt
            )
          );
        }
        if (!isCareTarget && careVal > 0) {
          issues.push(
            this.createIssue(
              emp,
              employeeName,
              'care_premium_mismatch',
              '介護保険の対象外年齢で介護保険料が計上されています。',
              p.yearMonth,
              detectedAt
            )
          );
        }
      });

      // ルール6: 月次保険料レコードの標準報酬スナップショット欠落
      empPremiums.forEach((p) => {
        const missing =
          p.healthGrade == null ||
          p.pensionGrade == null ||
          p.healthStandardMonthly == null ||
          p.pensionStandardMonthly == null ||
          p.healthGrade <= 0 ||
          p.pensionGrade <= 0 ||
          p.healthStandardMonthly <= 0 ||
          p.pensionStandardMonthly <= 0;
        if (missing) {
          issues.push(
            this.createIssue(
              emp,
              employeeName,
              'premium_snapshot_missing',
              '月次保険料レコードに標準報酬の等級・金額が記録されていません。',
              p.yearMonth,
              detectedAt
            )
          );
        }
      });
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

  private groupPremiumsByEmployee(premiums: MonthlyPremium[]): Map<string, MonthlyPremium[]> {
    const mapResult = new Map<string, MonthlyPremium[]>();
    premiums.forEach((p) => {
      if (!mapResult.has(p.employeeId)) {
        mapResult.set(p.employeeId, []);
      }
      mapResult.get(p.employeeId)!.push(p);
    });
    // ソート（yearMonth昇順）
    mapResult.forEach((list, key) => {
      list.sort((a, b) => this.compareYearMonth(a.yearMonth, b.yearMonth));
      mapResult.set(key, list);
    });
    return mapResult;
  }

  private isQualifiedInMonth(employee: Employee, yearMonth: YearMonthString): boolean {
    const target = this.yearMonthToDate(yearMonth);
    const starts = [employee.healthQualificationDate, employee.pensionQualificationDate].filter(
      Boolean
    ) as string[];
    if (!starts.length) return false; // 資格取得日が無い場合は判定不可（ルール1で拾う）
    const startDate = this.toEarliestDate(starts);

    const ends = [employee.healthLossDate, employee.pensionLossDate, employee.retireDate].filter(
      Boolean
    ) as string[];
    const endDate = ends.length ? this.toEarliestDate(ends) : null;

    if (startDate && target < startDate) return false;
    if (endDate && target >= endDate) return false;
    return true;
  }

  private getLossOrRetireYearMonth(employee: Employee): YearMonthString | null {
    const candidates = [employee.healthLossDate, employee.pensionLossDate, employee.retireDate]
      .filter(Boolean)
      .map((d) => (d as string).substring(0, 7) as YearMonthString);
    if (!candidates.length) return null;
    return candidates.sort()[0];
  }

  private getPreviousYearMonth(ym: YearMonthString): YearMonthString | null {
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return null;
    if (m === 1) return `${y - 1}-12` as YearMonthString;
    const mm = String(m - 1).padStart(2, '0');
    return `${y}-${mm}` as YearMonthString;
  }

  private compareYearMonth(a: YearMonthString, b: YearMonthString): number {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  private yearMonthToDate(ym: YearMonthString): Date {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, 1);
  }

  private toEarliestDate(dates: string[]): Date {
    const parsed = dates.map((d) => ymdToDateLocal(d));
    parsed.sort((a, b) => a.getTime() - b.getTime());
    return parsed[0];
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

