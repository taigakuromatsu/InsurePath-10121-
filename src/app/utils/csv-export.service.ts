import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { BonusPremium, Employee, MonthlyPremium, StandardRewardHistory, YearMonthString } from '../types';
import { CsvImportService } from './csv-import.service';
import { EMPLOYEE_CSV_COLUMNS_V2, getEmployeeCsvHeadersV2 } from './csv-column-definitions';
import { StandardRewardHistoryService } from '../services/standard-reward-history.service';

interface CsvColumn<T> {
  label: string;
  getValue: (row: T) => string | number | null | undefined;
  format?: (value: any) => string;
}

@Injectable({ providedIn: 'root' })
export class CsvExportService {
  private readonly csvImportService = inject(CsvImportService);
  private readonly standardRewardHistoryService = inject(StandardRewardHistoryService);
  /**
   * 従業員一覧をCSV形式でエクスポートする（v2列定義準拠）
   * テンプレートCSVと完全に同じフォーマットで出力する
   */
  async exportEmployees(employees: Employee[], fileName = '従業員一覧'): Promise<void> {
    if (!employees?.length) {
      return;
    }

    // v2列定義を使用
    const columns = EMPLOYEE_CSV_COLUMNS_V2;

    // ヘッダ行（「標準報酬月額」はエクスポートしない）
    const headers = columns
      .filter((col) => col.header !== '標準報酬月額') // deprecated項目はエクスポートしない
      .map((col) => col.header);

    // コメント行を追加（テンプレートと同じ）
    const lines: string[] = [];
    lines.push('# ========================================');
    lines.push('# 従業員インポート用テンプレート（InsurePath v2）');
    lines.push('# ========================================');
    lines.push('');
    lines.push('# 【新規作成と更新の違い】');
    lines.push('# ・新規作成: ID列を空欄にしてください。必須項目（氏名/フリガナ/生年月日/入社日/雇用形態）を入力してください。');
    lines.push('# ・更新: ID列に既存の従業員IDを入力してください。変更したい項目だけを入力します。');
    lines.push('');
    lines.push('# 【セルの入力ルール】');
    lines.push('# ・空欄: 変更しません（更新インポート時のみ有効。新規作成時は必須項目を入力してください）');
    lines.push('# ・値あり: その値に更新します');
    lines.push('# ・__CLEAR__: その項目を削除します（Firestoreからフィールドを削除）');
    lines.push('# ・注意: 必須項目（氏名/フリガナ/生年月日/入社日/雇用形態）は更新時でも__CLEAR__できません');
    lines.push('');
    lines.push('# 【ネストオブジェクトの削除（口座情報・給与情報）】');
    lines.push('# ・口座情報を削除: 口座情報に関連する全列（金融機関名/金融機関コード/支店名/支店コード/口座種別/口座番号/名義/名義カナ/主口座フラグ）のすべてに__CLEAR__を入力');
    lines.push('# ・給与情報を削除: 給与情報に関連する全列（報酬月額/支給形態/支給サイクル/給与メモ）のすべてに__CLEAR__を入力');
    lines.push('# ・注意: 一部の列だけに__CLEAR__を入力した場合、オブジェクト全体は削除されず、該当フィールドのみが削除されます（Firestoreからフィールドを削除）');
    lines.push('');
    lines.push('# 【必須項目】');
    lines.push('# ・基本情報: 氏名 / フリガナ / 生年月日 / 入社日 / 雇用形態');
    lines.push('# ・部分入力時の必須ルール:');
    lines.push('#   - 口座情報: 何か1つでも入力したら、金融機関名/支店名/口座種別/口座番号/名義が必須');
    lines.push('#   - 給与情報: 何か1つでも入力したら（報酬月額だけでも）、支給形態/支給サイクルが必須（新規作成時）');
    lines.push('');
    lines.push('# 【選択肢の入力値】');
    lines.push('# ・雇用形態: regular(正社員) / contract(契約社員) / part(パート) / アルバイト / other(その他)');
    lines.push('# ・性別: male(男) / female(女) / other(その他)');
    lines.push('# ・資格取得区分: new_hire(新規採用) / expansion(適用拡大) / hours_change(所定労働時間変更) / other(その他)');
    lines.push('# ・資格喪失理由: retirement(退職) / death(死亡) / age_75(75歳到達) / disability(障害認定) / social_security_agreement(社会保障協定)');
    lines.push('# ・就業状態: normal(通常勤務) / maternity_leave(産前産後休業) / childcare_leave(育児休業)');
    lines.push('# ・支給形態: monthly(月給) / daily(日給) / hourly(時給) / annual(年俸) / other(その他)');
    lines.push('# ・支給サイクル: monthly(月次) / twice_per_month(月2回) / weekly(週次) / other(その他)');
    lines.push('# ・口座種別: ordinary(普通) / checking(当座) / savings(貯蓄) / other(その他)');
    lines.push('');
    lines.push('# 【データ形式】');
    lines.push('# ・日付: YYYY-MM-DD 形式（例: 2024-04-01）');
    lines.push('# ・年月: YYYY-MM 形式（例: 2025-01）');
    lines.push('# ・数値: 整数または小数（例: 40.0, 1000000）');
    lines.push('#    - 所定労働時間、所定労働日数、報酬月額、等級、標準報酬月額などは数値で入力');
    lines.push('#    - カンマ区切りは使用できません（例: 1,000,000 は無効。1000000 と入力）');
    lines.push('#    - 金融機関コード/支店コード/口座番号は先頭0が落ちやすいため注意（Excelで数値として扱われると先頭0が消えます）');
    lines.push('# ・真偽値: true / false（小文字）');
    lines.push('#    - 学生、社会保険加入、主口座フラグに使用');
    lines.push('# ・保険料免除月: maternity:2025-01,2025-02;childcare:2025-04');
    lines.push('#    - 形式: kind:YYYY-MM,YYYY-MM;kind:YYYY-MM');
    lines.push('#    - kindはmaternity（産前産後）またはchildcare（育児）');
    lines.push('');
    lines.push('# 【標準報酬関連の注意】');
    lines.push('# ・標準報酬は"標準報酬履歴"で管理します。CSVの標準報酬関連列（健康保険等級、健康保険標準報酬月額、健康保険適用開始年月、厚生年金等級、厚生年金標準報酬月額、厚生年金適用開始年月）は参照用で、インポートでは反映されません。');
    lines.push('# ・健康保険等級/健康保険標準報酬月額: 健康保険・介護保険用');
    lines.push('# ・厚生年金等級/厚生年金標準報酬月額: 厚生年金用');
    lines.push('# ・健康保険と厚生年金で等級や標準報酬月額が異なる場合は、それぞれ別に入力してください');
    lines.push('# ・報酬月額: 給与設定の報酬月額（支給形態/支給サイクルとセットで入力）');
    lines.push('');

    // ヘッダ行を追加
    const headerLine = headers.map((h) => this.escapeCsvValue(h)).join(',');
    lines.push(headerLine);

    // 現在有効な標準報酬を履歴から取得（パフォーマンス対策：バッチ並列取得）
    const asOfYearMonth = this.getCurrentYearMonth();
    const standardRewardCache = new Map<
      string,
      { health: StandardRewardHistory | null; pension: StandardRewardHistory | null }
    >();
    
    // バッチサイズ（20〜30件ずつ並列取得）
    const BATCH_SIZE = 25;
    const batches: Employee[][] = [];
    for (let i = 0; i < employees.length; i += BATCH_SIZE) {
      batches.push(employees.slice(i, i + BATCH_SIZE));
    }

    // 各バッチを並列処理
    for (const batch of batches) {
      const promises = batch.map(async (emp) => {
        if (!emp.id || !emp.officeId) {
          return { employeeId: emp.id, health: null, pension: null };
        }

        const cacheKey = `${emp.officeId}_${emp.id}`;
        if (standardRewardCache.has(cacheKey)) {
          return { employeeId: emp.id, ...standardRewardCache.get(cacheKey)! };
        }

        try {
          const [healthList, pensionList] = await Promise.all([
            firstValueFrom(this.standardRewardHistoryService.listByInsuranceKind(emp.officeId, emp.id, 'health')),
            firstValueFrom(this.standardRewardHistoryService.listByInsuranceKind(emp.officeId, emp.id, 'pension'))
          ]);

          const healthEffective = this.pickEffectiveHistory(healthList ?? [], asOfYearMonth);
          const pensionEffective = this.pickEffectiveHistory(pensionList ?? [], asOfYearMonth);

          const result = {
            employeeId: emp.id,
            health: healthEffective,
            pension: pensionEffective
          };

          standardRewardCache.set(cacheKey, { health: healthEffective, pension: pensionEffective });
          return result;
        } catch (error) {
          console.error(`標準報酬履歴の取得に失敗しました (employeeId: ${emp.id}):`, error);
          return { employeeId: emp.id, health: null, pension: null };
        }
      });

      await Promise.all(promises);
    }

    // データ行
    for (const emp of employees) {
      const row: string[] = [];
      const cacheKey = `${emp.officeId}_${emp.id}`;
      const cachedRewards = standardRewardCache.get(cacheKey);

      for (const col of columns) {
        // 「標準報酬月額」はエクスポートしない
        if (col.header === '標準報酬月額') {
          continue;
        }

        // 標準報酬関連の列は履歴から取得
        let raw: string | number | null | undefined;
        if (col.header === '健康保険等級') {
          raw = cachedRewards?.health?.grade ?? '';
        } else if (col.header === '健康保険標準報酬月額') {
          raw = cachedRewards?.health?.standardMonthlyReward ?? '';
        } else if (col.header === '健康保険適用開始年月') {
          raw = cachedRewards?.health?.appliedFromYearMonth ?? '';
        } else if (col.header === '厚生年金等級') {
          raw = cachedRewards?.pension?.grade ?? '';
        } else if (col.header === '厚生年金標準報酬月額') {
          raw = cachedRewards?.pension?.standardMonthlyReward ?? '';
        } else if (col.header === '厚生年金適用開始年月') {
          raw = cachedRewards?.pension?.appliedFromYearMonth ?? '';
        } else {
          raw = col.getter(emp);
        }

        let text = '';

        if (raw !== undefined && raw !== null) {
          if (typeof raw === 'boolean') {
            text = raw ? 'true' : 'false';
          } else if (typeof raw === 'number') {
            text = String(raw);
          } else {
            text = String(raw);
          }
        }

        row.push(this.escapeCsvValue(text));
      }
      lines.push(row.join(','));
    }

    const csvString = lines.join('\r\n') + '\r\n';
    const bom = '﻿';
    const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, this.generateFileName(fileName));
  }

  exportMonthlyPremiums(
    premiums: (MonthlyPremium & { employeeName: string; age?: number; isCareTarget?: boolean; careEmployee?: number; careEmployer?: number })[],
    yearMonth?: string,
    fileName = '月次保険料一覧'
  ): void {
    const columns: CsvColumn<MonthlyPremium & { employeeName: string; age?: number; isCareTarget?: boolean; careEmployee?: number; careEmployer?: number }>[] = [
      { label: '対象年月', getValue: (row) => row.yearMonth },
      { label: '氏名', getValue: (row) => row.employeeName },
      { label: '年齢', getValue: (row) => (row as any).age ?? '' },
      { label: '健康保険・介護保険の標準報酬月額', getValue: (row) => row.healthStandardMonthly },
      {
        label: '健康保険・介護保険の全額',
        getValue: (row) =>
          (row as any).healthCareFull ??
          (row.healthTotal ?? 0) + (row.careTotal ?? 0)
      },
      {
        label: '健康保険・介護保険の従業員負担',
        getValue: (row) =>
          (row as any).healthCareEmployee ??
          (row.healthEmployee ?? 0) + (row.careEmployee ?? 0)
      },
      {
        label: '健康保険・介護保険の会社負担',
        getValue: (row) =>
          (row as any).healthCareEmployer ??
          (row.healthEmployer ?? 0) + (row.careEmployer ?? 0)
      },
      { 
        label: '介護保険の従業員負担', 
        getValue: (row) => {
          const isCareTarget = (row as any).isCareTarget ?? false;
          const careEmployee = (row as any).careEmployee ?? row.careEmployee ?? 0;
          return isCareTarget && careEmployee > 0 ? careEmployee : '';
        }
      },
      { 
        label: '介護保険の会社負担', 
        getValue: (row) => {
          const isCareTarget = (row as any).isCareTarget ?? false;
          const careEmployer = (row as any).careEmployer ?? row.careEmployer ?? 0;
          return isCareTarget && careEmployer > 0 ? careEmployer : '';
        }
      },
      { label: '厚生年金の標準報酬月額', getValue: (row) => row.pensionStandardMonthly },
      { label: '厚生年金の全額', getValue: (row) => (row as any).pensionFull ?? row.pensionTotal ?? 0 },
      { label: '厚生年金の従業員負担', getValue: (row) => (row as any).pensionEmployee ?? row.pensionEmployee ?? 0 },
      { label: '厚生年金の会社負担', getValue: (row) => (row as any).pensionEmployer ?? row.pensionEmployer ?? 0 },
      { label: '合計の全額', getValue: (row) => (row as any).totalFull ?? ((row.totalEmployee ?? 0) + (row.totalEmployer ?? 0)) },
      { label: '合計の従業員負担', getValue: (row) => row.totalEmployee ?? 0 },
      { label: '合計の会社負担', getValue: (row) => row.totalEmployer ?? 0 }
    ];

    // サマリーの計算
    const healthCareFullTotal = premiums.reduce(
      (sum, row) =>
        sum +
        ((row as any).healthCareFull ?? (row.healthTotal ?? 0) + (row.careTotal ?? 0)),
      0
    );
    const healthCareFullRoundedDown = Math.floor(healthCareFullTotal);
    const healthCareEmployeeTotal = premiums.reduce(
      (sum, row) =>
        sum +
        ((row as any).healthCareEmployee ??
          (row.healthEmployee ?? 0) + (row.careEmployee ?? 0)),
      0
    );
    const healthCareEmployerTotal = healthCareFullRoundedDown - healthCareEmployeeTotal;

    const pensionFullTotal = premiums.reduce(
      (sum, row) => sum + ((row as any).pensionFull ?? row.pensionTotal ?? 0),
      0
    );
    const pensionFullRoundedDown = Math.floor(pensionFullTotal);
    const pensionEmployeeTotal = premiums.reduce(
      (sum, row) => sum + ((row as any).pensionEmployee ?? row.pensionEmployee ?? 0),
      0
    );
    const pensionEmployerTotal = pensionFullRoundedDown - pensionEmployeeTotal;

    const totalFullTotal = premiums.reduce(
      (sum, row) => sum + ((row as any).totalFull ?? (row.totalEmployee ?? 0) + (row.totalEmployer ?? 0)),
      0
    );
    const totalFullRoundedDown = Math.floor(totalFullTotal);
    const totalEmployeeTotal = premiums.reduce(
      (sum, row) => sum + (row.totalEmployee ?? 0),
      0
    );
    const totalEmployerTotal = totalFullRoundedDown - totalEmployeeTotal;

    const finalFileName = this.generateFileName(fileName, yearMonth);
    this.exportCsvWithSummary(premiums, columns, finalFileName, {
      healthCareFullTotal,
      healthCareFullRoundedDown,
      healthCareEmployeeTotal,
      healthCareEmployerTotal,
      pensionFullTotal,
      pensionFullRoundedDown,
      pensionEmployeeTotal,
      pensionEmployerTotal,
      totalFullTotal,
      totalFullRoundedDown,
      totalEmployeeTotal,
      totalEmployerTotal
    });
  }

  exportBonusPremiums(
    bonuses: (BonusPremium & { employeeName: string })[],
    fileName = '賞与一覧'
  ): void {
    const columns: CsvColumn<BonusPremium & { employeeName: string }>[] = [
      { label: '支給日', getValue: (row) => row.payDate },
      { label: '従業員ID', getValue: (row) => row.employeeId },
      { label: '氏名', getValue: (row) => row.employeeName },
      { label: '賞与支給額', getValue: (row) => row.grossAmount },
      { label: '標準賞与額（千円未満切捨）', getValue: (row) => row.standardBonusAmount },
      { label: '年度内累計標準賞与額', getValue: (row) => row.healthStandardBonusCumulative ?? '' },
      // 健康保険・介護保険
      { label: '健康保険・介護保険の標準賞与（有効額）', getValue: (row) => row.healthEffectiveAmount ?? '' },
      { label: '健康保険・介護保険の上限超過額', getValue: (row) => row.healthExceededAmount ?? 0 },
      { label: '健康保険・介護保険の従業員負担', getValue: (row) => (row as any).healthCareEmployee ?? row.healthEmployee ?? 0 },
      { label: '健康保険・介護保険の会社負担（参考）', getValue: (row) => (row as any).healthCareEmployer ?? row.healthEmployer ?? 0 },
      { label: '健康保険・介護保険の全額（端数前）', getValue: (row) => (row as any).healthCareFull ?? row.healthTotal ?? 0 },
      // 厚生年金
      { label: '厚生年金の標準賞与（有効額）', getValue: (row) => row.pensionEffectiveAmount ?? '' },
      { label: '厚生年金の上限超過額', getValue: (row) => row.pensionExceededAmount ?? 0 },
      { label: '厚生年金の従業員負担', getValue: (row) => row.pensionEmployee ?? 0 },
      { label: '厚生年金の会社負担（参考）', getValue: (row) => row.pensionEmployer ?? 0 },
      { label: '厚生年金の全額（端数前）', getValue: (row) => (row as any).pensionFull ?? row.pensionTotal ?? 0 },
      // 合計
      { label: '従業員負担合計', getValue: (row) => row.totalEmployee ?? 0 },
      { label: '会社負担合計（参考）', getValue: (row) => row.totalEmployer ?? 0 },
      { label: '全額合計（端数前）', getValue: (row) => (row as any).totalFull ?? 0 },
      // その他
      { label: '年度', getValue: (row) => row.fiscalYear },
      { label: 'メモ', getValue: (row) => row.note ?? '' },
      { label: '作成日時', getValue: (row) => row.createdAt }
    ];

    this.exportCsv(bonuses, columns, this.generateFileName(fileName));
  }

  /**
   * 従業員CSVインポート用のテンプレート（ヘッダのみ）を出力（v2列定義準拠）
   * ヘッダの前にコメント行を追加して、入力ルールを説明する
   */
  exportEmployeesTemplate(): void {
    const headers = getEmployeeCsvHeadersV2().filter((h) => h !== '標準報酬月額'); // deprecated項目は除外
    const lines: string[] = [];

    // コメント行を追加
    lines.push('# ========================================');
    lines.push('# 従業員インポート用テンプレート（InsurePath v2）');
    lines.push('# ========================================');
    lines.push('');
    lines.push('# 【新規作成と更新の違い】');
    lines.push('# ・新規作成: ID列を空欄にしてください。必須項目（氏名/フリガナ/生年月日/入社日/雇用形態）を入力してください。');
    lines.push('# ・更新: ID列に既存の従業員IDを入力してください。変更したい項目だけを入力します。');
    lines.push('');
    lines.push('# 【セルの入力ルール】');
    lines.push('# ・空欄: 変更しません（更新インポート時のみ有効。新規作成時は必須項目を入力してください）');
    lines.push('# ・値あり: その値に更新します');
    lines.push('# ・__CLEAR__: その項目を削除します（Firestoreからフィールドを削除）');
    lines.push('# ・注意: 必須項目（氏名/フリガナ/生年月日/入社日/雇用形態）は更新時でも__CLEAR__できません');
    lines.push('');
    lines.push('# 【ネストオブジェクトの削除（口座情報・給与情報）】');
    lines.push('# ・口座情報を削除: 口座情報に関連する全列（金融機関名/金融機関コード/支店名/支店コード/口座種別/口座番号/名義/名義カナ/主口座フラグ）のすべてに__CLEAR__を入力');
    lines.push('# ・給与情報を削除: 給与情報に関連する全列（報酬月額/支給形態/支給サイクル/給与メモ）のすべてに__CLEAR__を入力');
    lines.push('# ・注意: 一部の列だけに__CLEAR__を入力した場合、オブジェクト全体は削除されず、該当フィールドのみが削除されます（Firestoreからフィールドを削除）');
    lines.push('');
    lines.push('# 【必須項目】');
    lines.push('# ・基本情報: 氏名 / フリガナ / 生年月日 / 入社日 / 雇用形態');
    lines.push('# ・部分入力時の必須ルール:');
    lines.push('#   - 口座情報: 何か1つでも入力したら、金融機関名/支店名/口座種別/口座番号/名義が必須');
    lines.push('#   - 給与情報: 何か1つでも入力したら（報酬月額だけでも）、支給形態/支給サイクルが必須（新規作成時）');
    lines.push('');
    lines.push('# 【選択肢の入力値】');
    lines.push('# ・雇用形態: regular(正社員) / contract(契約社員) / part(パート) / アルバイト / other(その他)');
    lines.push('# ・性別: male(男) / female(女) / other(その他)');
    lines.push('# ・資格取得区分: new_hire(新規採用) / expansion(適用拡大) / hours_change(所定労働時間変更) / other(その他)');
    lines.push('# ・資格喪失理由: retirement(退職) / death(死亡) / age_75(75歳到達) / disability(障害認定) / social_security_agreement(社会保障協定)');
    lines.push('# ・就業状態: normal(通常勤務) / maternity_leave(産前産後休業) / childcare_leave(育児休業)');
    lines.push('# ・支給形態: monthly(月給) / daily(日給) / hourly(時給) / annual(年俸) / other(その他)');
    lines.push('# ・支給サイクル: monthly(月次) / twice_per_month(月2回) / weekly(週次) / other(その他)');
    lines.push('# ・口座種別: ordinary(普通) / checking(当座) / savings(貯蓄) / other(その他)');
    lines.push('');
    lines.push('# 【データ形式】');
    lines.push('# ・日付: YYYY-MM-DD 形式（例: 2024-04-01）');
    lines.push('# ・年月: YYYY-MM 形式（例: 2025-01）');
    lines.push('# ・数値: 整数または小数（例: 40.0, 1000000）');
    lines.push('#    - 所定労働時間、所定労働日数、報酬月額、等級、標準報酬月額などは数値で入力');
    lines.push('#    - カンマ区切りは使用できません（例: 1,000,000 は無効。1000000 と入力）');
    lines.push('#    - 金融機関コード/支店コード/口座番号は先頭0が落ちやすいため注意（Excelで数値として扱われると先頭0が消えます）');
    lines.push('# ・真偽値: true / false（小文字）');
    lines.push('#    - 学生、社会保険加入、主口座フラグに使用');
    lines.push('# ・保険料免除月: maternity:2025-01,2025-02;childcare:2025-04');
    lines.push('#    - 形式: kind:YYYY-MM,YYYY-MM;kind:YYYY-MM');
    lines.push('#    - kindはmaternity（産前産後）またはchildcare（育児）');
    lines.push('');
    lines.push('# 【標準報酬関連の注意】');
    lines.push('# ・標準報酬は"標準報酬履歴"で管理します。CSVの標準報酬関連列（健康保険等級、健康保険標準報酬月額、健康保険適用開始年月、厚生年金等級、厚生年金標準報酬月額、厚生年金適用開始年月）は参照用で、インポートでは反映されません。');
    lines.push('# ・健康保険等級/健康保険標準報酬月額: 健康保険・介護保険用');
    lines.push('# ・厚生年金等級/厚生年金標準報酬月額: 厚生年金用');
    lines.push('# ・健康保険と厚生年金で等級や標準報酬月額が異なる場合は、それぞれ別に入力してください');
    lines.push('# ・報酬月額: 給与設定の報酬月額（支給形態/支給サイクルとセットで入力）');
    lines.push('');

    // ヘッダ行を追加
    const headerLine = headers.map((h) => this.escapeCsvValue(h)).join(',');
    lines.push(headerLine);

    const csvString = lines.join('\r\n') + '\r\n';
    const bom = '﻿';
    const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, 'employees-template.csv');
  }

  private exportCsv<T>(data: T[], columns: CsvColumn<T>[], fileName: string): void {
    if (!data?.length) {
      return;
    }

    const rows: string[][] = [];
    rows.push(columns.map((c) => this.escapeCsvValue(c.label)));

    data.forEach((row) => {
      const values = columns.map((column) => {
        const raw = column.getValue(row);
        const formatted = column.format ? column.format(raw) : raw;
        const text = formatted == null ? '' : String(formatted);
        return this.escapeCsvValue(text);
      });
      rows.push(values);
    });

    const blob = this.createCsvBlob(rows);
    this.downloadBlob(blob, fileName);
  }

  private exportCsvWithSummary<T>(
    data: T[],
    columns: CsvColumn<T>[],
    fileName: string,
    summary: {
      healthCareFullTotal: number;
      healthCareFullRoundedDown: number;
      healthCareEmployeeTotal: number;
      healthCareEmployerTotal: number;
      pensionFullTotal: number;
      pensionFullRoundedDown: number;
      pensionEmployeeTotal: number;
      pensionEmployerTotal: number;
      totalFullTotal: number;
      totalFullRoundedDown: number;
      totalEmployeeTotal: number;
      totalEmployerTotal: number;
    }
  ): void {
    if (!data?.length) {
      return;
    }

    const rows: string[][] = [];
    rows.push(columns.map((c) => this.escapeCsvValue(c.label)));

    data.forEach((row) => {
      const values = columns.map((column) => {
        const raw = column.getValue(row);
        const formatted = column.format ? column.format(raw) : raw;
        const text = formatted == null ? '' : String(formatted);
        return this.escapeCsvValue(text);
      });
      rows.push(values);
    });

    // 空行を追加
    rows.push(columns.map(() => ''));

    // ===== 健康保険・介護保険のサマリー =====
    const healthSectionHeader: string[] = new Array(columns.length).fill('');
    healthSectionHeader[0] = this.escapeCsvValue('【健康保険・介護保険】');
    rows.push(healthSectionHeader);
    
    // 納入告知額（端数処理前）
    const healthNotificationRow1: string[] = new Array(columns.length).fill('');
    healthNotificationRow1[0] = this.escapeCsvValue('納入告知額（端数処理前）');
    healthNotificationRow1[4] = this.escapeCsvValue(String(summary.healthCareFullTotal));
    rows.push(healthNotificationRow1);

    // 納入告知額（端数処理後）
    const healthNotificationRow2: string[] = new Array(columns.length).fill('');
    healthNotificationRow2[0] = this.escapeCsvValue('納入告知額（端数処理後）');
    healthNotificationRow2[4] = this.escapeCsvValue(String(summary.healthCareFullRoundedDown));
    rows.push(healthNotificationRow2);

    // 従業員負担計
    const healthEmployeeRow: string[] = new Array(columns.length).fill('');
    healthEmployeeRow[0] = this.escapeCsvValue('従業員負担計');
    healthEmployeeRow[5] = this.escapeCsvValue(String(summary.healthCareEmployeeTotal));
    rows.push(healthEmployeeRow);

    // 会社負担計
    const healthEmployerRow: string[] = new Array(columns.length).fill('');
    healthEmployerRow[0] = this.escapeCsvValue('会社負担計');
    healthEmployerRow[6] = this.escapeCsvValue(String(summary.healthCareEmployerTotal));
    rows.push(healthEmployerRow);

    // 空行を追加
    rows.push(columns.map(() => ''));

    // ===== 厚生年金のサマリー =====
    const pensionSectionHeader: string[] = new Array(columns.length).fill('');
    pensionSectionHeader[0] = this.escapeCsvValue('【厚生年金】');
    rows.push(pensionSectionHeader);
    
    // 納入告知額（端数処理前）
    const pensionNotificationRow1: string[] = new Array(columns.length).fill('');
    pensionNotificationRow1[0] = this.escapeCsvValue('納入告知額（端数処理前）');
    pensionNotificationRow1[10] = this.escapeCsvValue(String(summary.pensionFullTotal));
    rows.push(pensionNotificationRow1);

    // 納入告知額（端数処理後）
    const pensionNotificationRow2: string[] = new Array(columns.length).fill('');
    pensionNotificationRow2[0] = this.escapeCsvValue('納入告知額（端数処理後）');
    pensionNotificationRow2[10] = this.escapeCsvValue(String(summary.pensionFullRoundedDown));
    rows.push(pensionNotificationRow2);

    // 従業員負担計
    const pensionEmployeeRow: string[] = new Array(columns.length).fill('');
    pensionEmployeeRow[0] = this.escapeCsvValue('従業員負担計');
    pensionEmployeeRow[11] = this.escapeCsvValue(String(summary.pensionEmployeeTotal));
    rows.push(pensionEmployeeRow);

    // 会社負担計
    const pensionEmployerRow: string[] = new Array(columns.length).fill('');
    pensionEmployerRow[0] = this.escapeCsvValue('会社負担計');
    pensionEmployerRow[12] = this.escapeCsvValue(String(summary.pensionEmployerTotal));
    rows.push(pensionEmployerRow);

    // 空行を追加
    rows.push(columns.map(() => ''));

    // ===== 総合計のサマリー =====
    const totalSectionHeader: string[] = new Array(columns.length).fill('');
    totalSectionHeader[0] = this.escapeCsvValue('【総合計】');
    rows.push(totalSectionHeader);
    
    // 納入告知額 合計（端数処理前）
    const totalNotificationRow1: string[] = new Array(columns.length).fill('');
    totalNotificationRow1[0] = this.escapeCsvValue('納入告知額 合計（端数処理前）');
    totalNotificationRow1[13] = this.escapeCsvValue(String(summary.totalFullTotal));
    rows.push(totalNotificationRow1);

    // 納入告知額 合計（端数処理後）
    const totalNotificationRow2: string[] = new Array(columns.length).fill('');
    totalNotificationRow2[0] = this.escapeCsvValue('納入告知額 合計（端数処理後）');
    totalNotificationRow2[13] = this.escapeCsvValue(String(summary.totalFullRoundedDown));
    rows.push(totalNotificationRow2);

    // 従業員負担 総計
    const totalEmployeeRow: string[] = new Array(columns.length).fill('');
    totalEmployeeRow[0] = this.escapeCsvValue('従業員負担 総計');
    totalEmployeeRow[14] = this.escapeCsvValue(String(summary.totalEmployeeTotal));
    rows.push(totalEmployeeRow);

    // 会社負担 総計
    const totalEmployerRow: string[] = new Array(columns.length).fill('');
    totalEmployerRow[0] = this.escapeCsvValue('会社負担 総計');
    totalEmployerRow[15] = this.escapeCsvValue(String(summary.totalEmployerTotal));
    rows.push(totalEmployerRow);

    const blob = this.createCsvBlob(rows);
    this.downloadBlob(blob, fileName);
  }

  private escapeCsvValue(value: string): string {
    const needsEscaping = /[",\n\r]/.test(value);
    const escaped = value.replace(/"/g, '""');
    return needsEscaping ? `"${escaped}"` : value;
  }

  private createCsvBlob(rows: string[][]): Blob {
    const csvString = rows.map((r) => r.join(',')).join('\r\n');
    const bom = '﻿';
    return new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });
  }

  private generateFileName(baseName: string, suffix?: string): string {
    const timestamp = this.formatTimestamp(new Date());
    const suffixPart = suffix ? `_${suffix}` : '';
    return `${baseName}${suffixPart}_${timestamp}.csv`;
  }

  private formatTimestamp(date: Date): string {
    const pad = (num: number) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 現在有効な標準報酬履歴を選択
   */
  private pickEffectiveHistory(
    histories: StandardRewardHistory[],
    asOfYm: YearMonthString
  ): StandardRewardHistory | null {
    if (!histories?.length) return null;

    const pastOrCurrent = histories
      .filter((h) => h.appliedFromYearMonth <= asOfYm)
      .sort((a, b) => b.appliedFromYearMonth.localeCompare(a.appliedFromYearMonth));

    if (pastOrCurrent.length) return pastOrCurrent[0];

    // 未来しかない場合などは一番新しいもの
    return [...histories].sort((a, b) => b.appliedFromYearMonth.localeCompare(a.appliedFromYearMonth))[0];
  }

  /**
   * 現在の年月を取得（JSTでYYYY-MM形式）
   */
  private getCurrentYearMonth(): YearMonthString {
    const now = new Date();
    // JSTに変換（UTC+9時間）
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const year = jstNow.getUTCFullYear();
    const month = String(jstNow.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}` as YearMonthString;
  }
}
