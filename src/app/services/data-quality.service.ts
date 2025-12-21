import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, deleteDoc, getDoc, getDocs, setDoc } from '@angular/fire/firestore';
import { combineLatest, firstValueFrom, from, map, of, switchMap, Observable } from 'rxjs';

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

        return combineLatest([
          this.loadHistories(officeId, employees).pipe(
            map((historyMap) => this.buildIssues(employees, historyMap))
          ),
          this.loadAcknowledgedIssues(officeId)
        ]).pipe(
          switchMap(([issues, acknowledgedIds]) => {
            // 現在検出されているissue.idのセットを作成
            const currentIssueIds = new Set<string>(issues.map((issue) => issue.id));

            // staleな確認済みマークを削除（検出されていないが確認済みとして残っているもの）
            const staleIds = Array.from(acknowledgedIds).filter((id) => !currentIssueIds.has(id));

            if (staleIds.length > 0) {
              // stale削除を実行（エラーは握りつぶす）
              const deletePromises = staleIds.map((staleId) =>
                this.inCtxAsync(async () => {
                  try {
                    const ref = doc(this.getAcknowledgedIssuesCollectionRef(officeId), staleId);
                    await deleteDoc(ref);
                  } catch (error) {
                    console.warn(`確認済みマークの削除に失敗しました (issueId: ${staleId}):`, error);
                  }
                })
              );

              // 削除処理を実行しつつ、issuesを返す（削除完了を待たない）
              Promise.all(deletePromises).catch((error) => {
                console.warn('stale確認済みマークの削除中にエラーが発生しました:', error);
              });
            }

            // 確認済みフラグを設定
            return of(
              issues.map((issue) => ({
                ...issue,
                isAcknowledged: acknowledgedIds.has(issue.id)
              }))
            );
          })
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

      // ルール3: 資格取得日より前の適用開始年月の履歴がある
      // 資格取得日より前に適用開始年月の履歴があるのは論理的に不整合
      if (!isGrace) {
        // 健康保険の資格取得日より前の履歴をチェック
        if (emp.healthQualificationDate) {
          const healthQualificationYearMonth = this.toYearMonth(emp.healthQualificationDate);
          const healthHistories = histories.filter((h) => h.insuranceKind === 'health');
          const invalidHealthHistories = healthHistories.filter(
            (h) => h.appliedFromYearMonth < healthQualificationYearMonth
          );
          if (invalidHealthHistories.length > 0) {
            const earliestInvalid = invalidHealthHistories.sort((a, b) =>
              a.appliedFromYearMonth.localeCompare(b.appliedFromYearMonth)
            )[0];
          issues.push(
            this.createIssue(
              emp,
              employeeName,
                'standard_reward_before_qualification',
                `健康保険の資格取得日（${this.formatYearMonth(healthQualificationYearMonth)}）より前の適用開始年月（${this.formatYearMonth(earliestInvalid.appliedFromYearMonth)}）の標準報酬履歴が登録されています。`,
                earliestInvalid.appliedFromYearMonth,
              detectedAt
            )
          );
        }
        }

        // 厚生年金の資格取得日より前の履歴をチェック
        if (emp.pensionQualificationDate) {
          const pensionQualificationYearMonth = this.toYearMonth(emp.pensionQualificationDate);
          const pensionHistories = histories.filter((h) => h.insuranceKind === 'pension');
          const invalidPensionHistories = pensionHistories.filter(
            (h) => h.appliedFromYearMonth < pensionQualificationYearMonth
          );
          if (invalidPensionHistories.length > 0) {
            const earliestInvalid = invalidPensionHistories.sort((a, b) =>
              a.appliedFromYearMonth.localeCompare(b.appliedFromYearMonth)
            )[0];
          issues.push(
            this.createIssue(
              emp,
              employeeName,
                'standard_reward_before_qualification',
                `厚生年金の資格取得日（${this.formatYearMonth(pensionQualificationYearMonth)}）より前の適用開始年月（${this.formatYearMonth(earliestInvalid.appliedFromYearMonth)}）の標準報酬履歴が登録されています。`,
                earliestInvalid.appliedFromYearMonth,
              detectedAt
            )
          );
        }
        }
      }

      // ルール4: 資格喪失日が資格取得日より前になっている
      if (!isGrace) {
        // 健康保険の資格喪失日が資格取得日より前
        if (emp.healthQualificationDate && emp.healthLossDate) {
          const qualificationYm = this.toYearMonth(emp.healthQualificationDate);
          const lossYm = this.toYearMonth(emp.healthLossDate);
          if (lossYm < qualificationYm) {
            issues.push(
              this.createIssue(
                emp,
                employeeName,
                'loss_date_before_qualification',
                `健康保険の資格喪失日（${this.formatDate(emp.healthLossDate)}）が資格取得日（${this.formatDate(emp.healthQualificationDate)}）より前になっています。`,
                undefined,
                detectedAt
              )
            );
          }
        }

        // 厚生年金の資格喪失日が資格取得日より前
        if (emp.pensionQualificationDate && emp.pensionLossDate) {
          const qualificationYm = this.toYearMonth(emp.pensionQualificationDate);
          const lossYm = this.toYearMonth(emp.pensionLossDate);
          if (lossYm < qualificationYm) {
            issues.push(
              this.createIssue(
                emp,
                employeeName,
                'loss_date_before_qualification',
                `厚生年金の資格喪失日（${this.formatDate(emp.pensionLossDate)}）が資格取得日（${this.formatDate(emp.pensionQualificationDate)}）より前になっています。`,
                undefined,
                detectedAt
              )
            );
          }
        }
      }

      // ルール5: 退職日が入社日より前になっている
      if (emp.retireDate && emp.hireDate && !isGrace) {
        if (emp.retireDate < emp.hireDate) {
          issues.push(
            this.createIssue(
              emp,
              employeeName,
              'retire_date_before_hire',
              `退職日（${this.formatDate(emp.retireDate)}）が入社日（${this.formatDate(emp.hireDate)}）より前になっています。`,
              undefined,
              detectedAt
            )
          );
        }
      }

      // ルール6: 資格喪失日より後の標準報酬履歴がある
      if (!isGrace) {
        // 健康保険の資格喪失日より後の履歴をチェック
        if (emp.healthLossDate) {
          const healthLossYearMonth = this.toYearMonth(emp.healthLossDate);
          const healthQualificationYearMonth = emp.healthQualificationDate
            ? this.toYearMonth(emp.healthQualificationDate)
            : null;
          const healthHistories = histories.filter((h) => h.insuranceKind === 'health');
          // 同月得喪の場合は喪失月の履歴を除外（その月は有効なため）
          const isSameMonthAcquisitionLoss =
            healthQualificationYearMonth !== null &&
            healthQualificationYearMonth === healthLossYearMonth;
          const invalidHealthHistories = healthHistories.filter((h) => {
            if (isSameMonthAcquisitionLoss) {
              // 同月得喪の場合：喪失月より後の履歴のみ検出（喪失月は除外）
              return h.appliedFromYearMonth > healthLossYearMonth;
            } else {
              // 通常の場合：喪失月以降の履歴を検出
              return h.appliedFromYearMonth >= healthLossYearMonth;
            }
          });
          if (invalidHealthHistories.length > 0) {
            const latestInvalid = invalidHealthHistories.sort((a, b) =>
              b.appliedFromYearMonth.localeCompare(a.appliedFromYearMonth)
            )[0];
            issues.push(
              this.createIssue(
                emp,
                employeeName,
                'standard_reward_after_loss',
                `健康保険の資格喪失日（${this.formatYearMonth(healthLossYearMonth)}）より後の適用開始年月（${this.formatYearMonth(latestInvalid.appliedFromYearMonth)}）の標準報酬履歴が登録されています。`,
                latestInvalid.appliedFromYearMonth,
                detectedAt
              )
            );
          }
        }

        // 厚生年金の資格喪失日より後の履歴をチェック
        if (emp.pensionLossDate) {
          const pensionLossYearMonth = this.toYearMonth(emp.pensionLossDate);
          const pensionQualificationYearMonth = emp.pensionQualificationDate
            ? this.toYearMonth(emp.pensionQualificationDate)
            : null;
          const pensionHistories = histories.filter((h) => h.insuranceKind === 'pension');
          // 同月得喪の場合は喪失月の履歴を除外（その月は有効なため）
          const isSameMonthAcquisitionLoss =
            pensionQualificationYearMonth !== null &&
            pensionQualificationYearMonth === pensionLossYearMonth;
          const invalidPensionHistories = pensionHistories.filter((h) => {
            if (isSameMonthAcquisitionLoss) {
              // 同月得喪の場合：喪失月より後の履歴のみ検出（喪失月は除外）
              return h.appliedFromYearMonth > pensionLossYearMonth;
            } else {
              // 通常の場合：喪失月以降の履歴を検出
              return h.appliedFromYearMonth >= pensionLossYearMonth;
            }
          });
          if (invalidPensionHistories.length > 0) {
            const latestInvalid = invalidPensionHistories.sort((a, b) =>
              b.appliedFromYearMonth.localeCompare(a.appliedFromYearMonth)
            )[0];
            issues.push(
              this.createIssue(
                emp,
                employeeName,
                'standard_reward_after_loss',
                `厚生年金の資格喪失日（${this.formatYearMonth(pensionLossYearMonth)}）より後の適用開始年月（${this.formatYearMonth(latestInvalid.appliedFromYearMonth)}）の標準報酬履歴が登録されています。`,
                latestInvalid.appliedFromYearMonth,
                detectedAt
              )
            );
          }
        }
      }

      // ルール7: 標準報酬履歴の適用開始年月が未来になっている
      if (!isGrace) {
        const currentYearMonth = this.getCurrentYearMonth();
        const futureHistories = histories.filter(
          (h) => h.appliedFromYearMonth > currentYearMonth
        );
        if (futureHistories.length > 0) {
          // 最も未来の履歴を1件報告
          const latestFuture = futureHistories.sort((a, b) =>
            b.appliedFromYearMonth.localeCompare(a.appliedFromYearMonth)
          )[0];
          const insuranceKindLabel = latestFuture.insuranceKind === 'health' ? '健康保険' : '厚生年金';
          issues.push(
            this.createIssue(
              emp,
              employeeName,
              'standard_reward_future_date',
              `${insuranceKindLabel}の標準報酬履歴の適用開始年月（${this.formatYearMonth(latestFuture.appliedFromYearMonth)}）が未来になっています。`,
              latestFuture.appliedFromYearMonth,
              detectedAt
            )
          );
        }
      }

      // ルール8: 資格取得日が入社日より前になっている
      if (!isGrace && emp.hireDate) {
        // 健康保険の資格取得日が入社日より前
        if (emp.healthQualificationDate && emp.healthQualificationDate < emp.hireDate) {
          issues.push(
            this.createIssue(
              emp,
              employeeName,
              'qualification_before_hire',
              `健康保険の資格取得日（${this.formatDate(emp.healthQualificationDate)}）が入社日（${this.formatDate(emp.hireDate)}）より前になっています。転籍などの例外ケースを除き、確認してください。`,
              undefined,
              detectedAt
            )
          );
        }

        // 厚生年金の資格取得日が入社日より前
        if (emp.pensionQualificationDate && emp.pensionQualificationDate < emp.hireDate) {
          issues.push(
            this.createIssue(
              emp,
              employeeName,
              'qualification_before_hire',
              `厚生年金の資格取得日（${this.formatDate(emp.pensionQualificationDate)}）が入社日（${this.formatDate(emp.hireDate)}）より前になっています。転籍などの例外ケースを除き、確認してください。`,
              undefined,
              detectedAt
            )
          );
        }
      }

      // ルール9: 資格取得日が未来になっている
      if (!isGrace) {
        const today = todayYmd();
        // 健康保険の資格取得日が未来
        if (emp.healthQualificationDate && emp.healthQualificationDate > today) {
          issues.push(
            this.createIssue(
              emp,
              employeeName,
              'qualification_future_date',
              `健康保険の資格取得日（${this.formatDate(emp.healthQualificationDate)}）が未来になっています。`,
              undefined,
              detectedAt
            )
          );
        }

        // 厚生年金の資格取得日が未来
        if (emp.pensionQualificationDate && emp.pensionQualificationDate > today) {
          issues.push(
            this.createIssue(
              emp,
              employeeName,
              'qualification_future_date',
              `厚生年金の資格取得日（${this.formatDate(emp.pensionQualificationDate)}）が未来になっています。`,
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

  /**
   * ISO日付文字列（'YYYY-MM-DD'）を年月文字列（'YYYY-MM'）に変換
   */
  private toYearMonth(dateStr: string): string {
    return dateStr.substring(0, 7);
  }

  /**
   * 年月文字列（'YYYY-MM'）を表示用フォーマット（'YYYY年MM月'）に変換
   */
  private formatYearMonth(yearMonth: string): string {
    const [year, month] = yearMonth.split('-');
    return `${year}年${parseInt(month, 10)}月`;
  }

  /**
   * ISO日付文字列（'YYYY-MM-DD'）を表示用フォーマット（'YYYY年MM月DD日'）に変換
   */
  private formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${year}年${parseInt(month, 10)}月${parseInt(day, 10)}日`;
  }

  /**
   * 現在の年月を取得（'YYYY-MM'形式）
   */
  private getCurrentYearMonth(): string {
    const today = todayYmd();
    return today.substring(0, 7);
  }

  /**
   * 確認済み警告IDのコレクション参照を取得
   */
  private getAcknowledgedIssuesCollectionRef(officeId: string) {
    return this.inCtx(() => collection(this.firestore, 'offices', officeId, 'dataQualityAcknowledgedIssues'));
  }

  /**
   * 確認済み警告IDのセットを取得
   * docId = issueId なので、doc.idを直接使用する
   */
  private loadAcknowledgedIssues(officeId: string): Observable<Set<string>> {
    return this.inCtx(() => {
      const ref = this.getAcknowledgedIssuesCollectionRef(officeId);
      return from(getDocs(ref)).pipe(
        map((snapshot) => {
          const acknowledgedIds = new Set<string>();
          snapshot.docs.forEach((docSnapshot) => {
            // docId = issueId なので、doc.idを直接使用
            acknowledgedIds.add(docSnapshot.id);
          });
          return acknowledgedIds;
        })
      );
    });
  }

  /**
   * 警告を確認済みにする
   */
  async acknowledgeIssue(officeId: string, issueId: string): Promise<void> {
    return this.inCtxAsync(async () => {
      const ref = doc(this.getAcknowledgedIssuesCollectionRef(officeId), issueId);
      await setDoc(ref, {
        issueId,
        acknowledgedAt: new Date().toISOString()
      }, { merge: true });
    });
  }

  /**
   * 警告の確認済みを解除する
   */
  async unacknowledgeIssue(officeId: string, issueId: string): Promise<void> {
    return this.inCtxAsync(async () => {
      const ref = doc(this.getAcknowledgedIssuesCollectionRef(officeId), issueId);
      await deleteDoc(ref);
    });
  }

  private inCtxAsync<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }
}

