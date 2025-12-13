# 月次まとめPDF（被保険者賞与支払届）実装指示書

## 1. 概要

### 目的
賞与保険料ページに「月次まとめPDF出力」機能を追加する。既存の「賞与1件＝PDF1枚」機能は維持し、新機能として月次PDFを追加する。

### 実装方針
- **既存機能の維持**: `bonus_payment` タイプの1件PDF出力は変更しない
- **新規追加**: `monthly_bonus_payment` タイプを新規追加
- **テンプレート分離**: 既存 `bonus-payment.ts` は触らず、新規 `monthly-bonus-payment.ts` を作成
- **最小デグレ**: 既存のダイアログやサービスに影響を与えない設計

### 重要な修正ポイント（v3）

本指示書は以下の重要な修正を含んでいます：

1. **createDefinition()の集計処理**: `DocumentGeneratorService`側で集計処理を行い、`TemplateInput`を作成してからテンプレートに渡す
2. **画面表示との一致**: 月次PDFは`filteredRows()`と同じ範囲を使用（画面表示と一致）
3. **⑦欄の表示ロジック**: myNumber優先、なければpensionNumber（両方は表示しない）
4. **日付表記仕様**: 元号表記は「賞与支払年月日」のみ。生年月日は西暦表記のまま（`formatPayDateReiwa()`関数は支払日専用）
5. **型定義の配置**: `monthly-bonus-payment-types.ts`は作成せず、同一ファイル内に型定義を含める
6. **事業所情報の表示**: 2ページ目以降にも簡易情報（事業所名＋対象年月＋共通支払日（該当する場合））を表示
7. **import整理**: 未使用の`calculateAge`のimportを削除、`formatCurrency`も集計ロジック側では不要
8. **安全策**: 支払日が令和以前（2019/05/01より前）の場合も西暦表記で正常に表示されるガード処理を追加
9. **タイムゾーン問題の修正**: `REIWA_START`と`calculateAgeAtDate()`で`new Date(string)`を避け、`new Date(y, m-1, d)`形式でローカル時刻として生成（UTC解釈による誤判定を防止）
10. **switch-caseのブロック**: `createDefinition()`と`buildFileName()`のcase内でconstを使用する場合は必ずブロック{}を付ける
11. **ページ溢れ対策**: 10人で1ページに収まることをテスト観点に追加、必要に応じてfontSize/marginを調整
12. **office.nameチェック**: `createMonthlyBonusPaymentDocument()`の冒頭に必須項目チェックを追加（8.1の例外処理に対応）
13. **⑧備考欄の様式対応**: 70歳以上被用者の場合「1.70歳以上被用者」を自動追加、同一月内複数支給の場合「3.同一月内の賞与合算（初回支払日: ...）」に変更（原本の様式に合わせて「それっぽさ」を向上）
14. **2ページ目以降の共通支払日表示**: 共通支払日がある場合、2ページ目以降の簡易情報テーブルにも表示を追加（続きページだけ開かれても支払日が確認できるように）
15. **pdfmakeのwidths指定**: %指定（`'32%'`など）は非対応の可能性があるため、固定幅（数値）+ 最後を`'*'`（可変幅）にする形式を使用

---

## 2. 修正/追加対象ファイル一覧

### 2.1 新規作成ファイル
1. `src/app/utils/document-templates/monthly-bonus-payment.ts`
   - 月次PDFテンプレート（1枚10人、複数ページ対応）
   - 型定義も同一ファイルに含める（分離しない）

### 2.2 修正ファイル
1. `src/app/services/document-generator.service.ts`
   - `DocumentType` に `'monthly_bonus_payment'` を追加
   - `MonthlyBonusPaymentPayload` 型を追加
   - `createDefinition()` に月次PDF分岐を追加
   - `buildFileName()` に月次PDFファイル名を追加

2. `src/app/pages/premiums/bonus/bonus-premiums.page.ts`
   - 「月次PDF出力」ボタンを追加（268-298行付近のアクションボタンエリア）
   - `openMonthlyPdfDialog()` メソッドを追加

### 2.3 参照のみ（変更なし）
- `src/app/types.ts` - 型定義（`BonusPremium`, `Employee`, `Office`）
- `src/app/services/bonus-premiums.service.ts` - `listByOfficeAndYearMonth()` を使用
- `src/app/utils/document-helpers.ts` - フォーマット関数（`formatDate`, `formatCurrency`）を使用

---

## 3. 型定義・インターフェース

### 3.1 DocumentType の拡張

**ファイル**: `src/app/services/document-generator.service.ts`

```typescript
export type DocumentType =
  | 'qualification_acquisition'
  | 'qualification_loss'
  | 'bonus_payment'
  | 'monthly_bonus_payment';  // ← 追加
```

### 3.2 新しいPayload型

**ファイル**: `src/app/services/document-generator.service.ts`

```typescript
export interface MonthlyBonusPaymentPayload {
  office: Office;
  employees: Employee[];  // 従業員一覧（employeeIdでマッピング用）
  bonuses: BonusPremium[];  // 対象年月の賞与データ一覧
  yearMonth: YearMonthString;  // 対象年月（例: "2025-12"）
}
```

### 3.3 DocumentPayload の拡張

**ファイル**: `src/app/services/document-generator.service.ts`

```typescript
export type DocumentPayload =
  | { type: 'qualification_acquisition'; payload: QualificationAcquisitionPayload }
  | { type: 'qualification_loss'; payload: QualificationLossPayload }
  | { type: 'bonus_payment'; payload: BonusPaymentPayload }
  | { type: 'monthly_bonus_payment'; payload: MonthlyBonusPaymentPayload };  // ← 追加
```

### 3.4 月次PDF用の集計データ型

**ファイル**: `src/app/utils/document-templates/monthly-bonus-payment.ts`

```typescript
export interface MonthlyBonusPdfRow {
  employeeCode: string;  // 被保険者整理番号
  name: string;  // 氏名
  kana: string;  // 氏名（カナ）
  birthDate: string;  // 生年月日（YYYY-MM-DD）
  payDate: string;  // 賞与支払年月日（その月の最後の支払日、YYYY-MM-DD）
  grossAmount: number;  // 賞与支給額（合算後）
  standardBonusAmount: number;  // 標準賞与額（合算後、1,000円未満切捨て）
  myNumberOrPensionNumber?: string;  // 個人番号または基礎年金番号（70歳以上のみ、myNumber優先）
  note?: string;  // 備考（70歳以上被用者の場合「1.70歳以上被用者」、同一月内に複数回支給がある場合「3.同一月内の賞与合算（初回支払日: ...）」、複数ある場合は改行で区切る）
}

export interface MonthlyBonusPaymentTemplateInput {
  office: Office;
  rows: MonthlyBonusPdfRow[];  // 集計済みの行データ（全従業員分）
  yearMonth: YearMonthString;  // 対象年月
  commonPayDate?: string;  // 共通支払日（全員同じ場合のみ、YYYY-MM-DD形式）
}
```

---

## 4. 集計ロジック（実装コード）

### 4.1 従業員ごとの賞与合算処理

**ファイル**: `src/app/utils/document-templates/monthly-bonus-payment.ts`

```typescript
import { BonusPremium, Employee, Office, YearMonthString } from '../../types';
// formatCurrency はテンプレート側で使用するため、ここではimport不要

/**
 * 賞与支払年月日を令和表記に変換（YYYY-MM-DD → 令和X年M月D日）
 * 原則として支払日は令和（2019/05/01以降）を想定するが、万一それ以前の場合は西暦表記で返す
 */
// 令和開始日（2019年5月1日）をローカル時刻で定義（タイムゾーン誤判定を防ぐ）
const REIWA_START = new Date(2019, 4, 1); // 2019-05-01（月は0始まり）

function formatPayDateReiwa(dateStr: string): string {
  if (!dateStr) return '';
  
  const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
  if (!y || !m || !d) return dateStr;
  
  const dt = new Date(y, m - 1, d); // ローカル時刻で生成
  if (isNaN(dt.getTime())) return dateStr;
  
  // 原則：支払日は令和想定。万一それ以前なら西暦で返す（壊さない）
  if (dt < REIWA_START) {
    return `${y}年${m}月${d}日`;
  }
  
  const reiwaYear = y - 2018; // 2019年→令和1年
  return `令和${reiwaYear}年${m}月${d}日`;
}

/**
 * 同一従業員・同一年月の賞与を合算して1行にまとめる
 */
export function aggregateBonusesByEmployee(
  bonuses: BonusPremium[],
  employees: Employee[],
  yearMonth: YearMonthString
): MonthlyBonusPdfRow[] {
  // 従業員マップを作成（employeeId → Employee）
  const employeeMap = new Map<string, Employee>();
  employees.forEach(emp => employeeMap.set(emp.id, emp));

  // 従業員IDでグループ化
  const bonusMap = new Map<string, BonusPremium[]>();
  bonuses.forEach(bonus => {
    if (!bonusMap.has(bonus.employeeId)) {
      bonusMap.set(bonus.employeeId, []);
    }
    bonusMap.get(bonus.employeeId)!.push(bonus);
  });

  const rows: MonthlyBonusPdfRow[] = [];

  // 各従業員ごとに処理
  for (const [employeeId, employeeBonuses] of bonusMap.entries()) {
    const employee = employeeMap.get(employeeId);
    if (!employee) {
      // 従業員が削除されている場合はスキップ
      continue;
    }

    // 支給日でソート（降順：最新が先頭）
    const sortedBonuses = [...employeeBonuses].sort((a, b) => 
      b.payDate.localeCompare(a.payDate)
    );

    // 合算処理
    const totalGrossAmount = sortedBonuses.reduce((sum, b) => sum + b.grossAmount, 0);
    
    // 標準賞与額の合算（1,000円未満切捨て）
    // 注意: 各賞与のstandardBonusAmountを合算するのではなく、
    // 合算後のgrossAmountから標準賞与額を計算する
    const standardBonusAmount = Math.floor(totalGrossAmount / 1000) * 1000;

    // 最後の支払日を取得
    const lastPayDate = sortedBonuses[0].payDate;

    // 70歳以上判定（対象年月末基準）
    const targetYear = parseInt(yearMonth.substring(0, 4));
    const targetMonth = parseInt(yearMonth.substring(5, 7));
    // 対象年月の月末日を基準に年齢を計算
    const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();
    const referenceDate = `${yearMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;
    const age = calculateAgeAtDate(employee.birthDate, referenceDate);
    const isSeventyOrOlder = age !== null && age >= 70;

    // ⑦欄: myNumber優先、なければpensionNumber
    const myNumberOrPensionNumber = isSeventyOrOlder
      ? (employee.myNumber || employee.pensionNumber || undefined)
      : undefined;

    // ⑧備考欄の生成（様式に合わせて複数項目を追加可能）
    const noteParts: string[] = [];
    
    // 1. 70歳以上被用者の場合
    if (isSeventyOrOlder) {
      noteParts.push('1.70歳以上被用者');
    }
    
    // 3. 同一月内に複数回支給がある場合
    const hasMultiplePayments = sortedBonuses.length > 1;
    if (hasMultiplePayments) {
      const firstPayDate = sortedBonuses[sortedBonuses.length - 1].payDate;
      noteParts.push(`3.同一月内の賞与合算（初回支払日: ${formatPayDateReiwa(firstPayDate)}）`);
    }
    
    // notePartsを結合（複数ある場合は改行で区切る）
    const note = noteParts.length > 0 ? noteParts.join('\n') : undefined;

    // 行データを作成
    const row: MonthlyBonusPdfRow = {
      employeeCode: employee.employeeCodeInOffice ?? '',
      name: employee.name,
      kana: employee.kana ?? '',
      birthDate: employee.birthDate,
      payDate: lastPayDate,
      grossAmount: totalGrossAmount,
      standardBonusAmount,
      myNumberOrPensionNumber,
      note
    };

    rows.push(row);
  }

  // 従業員コード順（または氏名順）でソート
  rows.sort((a, b) => {
    if (a.employeeCode && b.employeeCode) {
      return a.employeeCode.localeCompare(b.employeeCode);
    }
    return a.name.localeCompare(b.name);
  });

  return rows;
}

/**
 * 指定日時点での年齢を計算
 * YYYY-MM-DD形式の文字列をローカル時刻で解釈（タイムゾーン誤判定を防ぐ）
 */
function calculateAgeAtDate(birthDate: string, referenceDate: string): number | null {
  if (!birthDate || !referenceDate) {
    return null;
  }
  
  // YYYY-MM-DD形式を分解してローカル時刻で生成（UTC解釈を避ける）
  const [by, bm, bd] = birthDate.split('-').map(n => parseInt(n, 10));
  const [ry, rm, rd] = referenceDate.split('-').map(n => parseInt(n, 10));
  
  if (!by || !bm || !bd || !ry || !rm || !rd) {
    return null;
  }
  
  const birth = new Date(by, bm - 1, bd); // ローカル時刻
  const reference = new Date(ry, rm - 1, rd); // ローカル時刻
  
  if (isNaN(birth.getTime()) || isNaN(reference.getTime())) {
    return null;
  }
  
  let age = reference.getFullYear() - birth.getFullYear();
  const monthDiff = reference.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * 共通支払日を判定（全員の支払日が同じかどうか）
 */
export function detectCommonPayDate(rows: MonthlyBonusPdfRow[]): string | undefined {
  if (rows.length === 0) {
    return undefined;
  }
  
  const firstPayDate = rows[0].payDate;
  const allSame = rows.every(row => row.payDate === firstPayDate);
  
  return allSame ? firstPayDate : undefined;
}
```

### 4.2 10件ずつに分割してページ化

**ファイル**: `src/app/utils/document-templates/monthly-bonus-payment.ts`

```typescript
/**
 * 配列を指定サイズのチャンクに分割
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
```

---

## 5. PDFテンプレート実装（pdfmake定義）

### 5.1 テンプレート関数の実装

**ファイル**: `src/app/utils/document-templates/monthly-bonus-payment.ts`

```typescript
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { DOCUMENT_DISCLAIMER, formatCurrency, formatDate } from '../document-helpers';
// 型定義と集計関数（aggregateBonusesByEmployee, detectCommonPayDate, formatPayDateReiwa）は同一ファイル内で定義されているため、import不要

export function createMonthlyBonusPaymentDocument(
  input: MonthlyBonusPaymentTemplateInput
): TDocumentDefinitions {
  const { office, rows, yearMonth, commonPayDate } = input;

  // 必須項目チェック（8.1の例外処理に対応）
  if (!office.name) {
    throw new Error('事業所名称が設定されていません');
  }

  // 10人ずつに分割
  const chunks = chunkArray(rows, 10);
  
  const content: any[] = [];

  // 各ページ（チャンク）ごとに処理
  chunks.forEach((chunk, pageIndex) => {
    // ページタイトル（1ページ目のみ）
    if (pageIndex === 0) {
      content.push(
        { text: '被保険者賞与支払届', style: 'title', alignment: 'center' },
        { text: '（参考様式）', style: 'subtitle', alignment: 'center' },
        { text: DOCUMENT_DISCLAIMER, style: 'disclaimer', margin: [0, 8, 0, 12] }
      );
    } else {
      // 2ページ目以降は改ページ
      content.push({ text: '', pageBreak: 'before' });
      // 2ページ目以降にもタイトルを表示（オプション）
      content.push(
        { text: '被保険者賞与支払届（続き）', style: 'title', alignment: 'center', margin: [0, 0, 0, 12] }
      );
    }

    // 事業所情報テーブル
    if (pageIndex === 0) {
      // 1ページ目: 詳細情報
      content.push({
        table: {
          widths: [120, '*'],  // pdfmakeの仕様に合わせて%指定を避け、固定幅+可変幅に
          body: [
            ['事業所名称', office.name ?? ''],
            ['事業所整理記号', office.officeSymbol ?? ''],
            ['事業所番号', office.officeNumber ?? ''],
            ['郵便番号', office.officePostalCode ?? ''],
            ['事業所所在地', office.address ?? ''],
            ['事業主氏名', office.officeOwnerName ?? ''],
            ['電話番号', office.officePhone ?? '']
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12]
      });
    } else {
      // 2ページ目以降: 簡易情報（事業所名＋対象年月＋共通支払日）
      // 共通支払日がある場合は2ページ目以降にも表示（続きページだけ開かれても支払日が確認できるように）
      const yearMonthLabel = `${yearMonth.substring(0, 4)}年${parseInt(yearMonth.substring(5, 7))}月`;
      const commonPayDateLabel = commonPayDate ? formatPayDateReiwa(commonPayDate) : '';
      
      content.push({
        table: {
          widths: [120, '*'],  // pdfmakeの仕様に合わせて%指定を避け、固定幅+可変幅に
          body: [
            ['事業所名称', office.name ?? ''],
            ['対象年月', yearMonthLabel],
            ...(commonPayDate ? [['④ 賞与支払年月日（共通）', commonPayDateLabel]] : [])
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12]
      });
    }

    // 対象年月と共通支払日の表示（1ページ目のみ）
    if (pageIndex === 0) {
      const yearMonthLabel = `${yearMonth.substring(0, 4)}年${parseInt(yearMonth.substring(5, 7))}月`;
      const commonPayDateLabel = commonPayDate ? formatPayDateReiwa(commonPayDate) : '';
      
      content.push({
        table: {
          widths: [120, '*'],  // pdfmakeの仕様に合わせて%指定を避け、固定幅+可変幅に
          body: [
            ['対象年月', yearMonthLabel],
            ...(commonPayDate ? [['④ 賞与支払年月日（共通）', commonPayDateLabel]] : [])
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12]
      });
    }

    // 被保険者一覧テーブル
    const tableBody: any[] = [
      // ヘッダー行
      [
        { text: '①整理番号', style: 'tableHeader', alignment: 'center' },
        { text: '②氏名', style: 'tableHeader', alignment: 'center' },
        { text: '③生年月日', style: 'tableHeader', alignment: 'center' },
        { text: '④賞与支払年月日', style: 'tableHeader', alignment: 'center' },
        { text: '⑤賞与支給額', style: 'tableHeader', alignment: 'right' },
        { text: '⑥賞与額', style: 'tableHeader', alignment: 'right' },
        { text: '⑦個人番号/基礎年金番号', style: 'tableHeader', alignment: 'center' },
        { text: '⑧備考', style: 'tableHeader', alignment: 'left' }
      ]
    ];

    // データ行
    chunk.forEach(row => {
      tableBody.push([
        { text: row.employeeCode || '', style: 'tableCell', alignment: 'center' },
        { text: row.name || '', style: 'tableCell' },
        { text: formatDate(row.birthDate) || '', style: 'tableCell', alignment: 'center' },  // 生年月日は西暦表記
        { 
          text: commonPayDate ? '' : (formatPayDateReiwa(row.payDate) || ''),  // 支払日は令和表記
          style: 'tableCell', 
          alignment: 'center' 
        },
        { text: formatCurrency(row.grossAmount) || '', style: 'tableCell', alignment: 'right' },
        { text: formatCurrency(row.standardBonusAmount) || '', style: 'tableCell', alignment: 'right' },
        { 
          text: row.myNumberOrPensionNumber || '', 
          style: 'tableCell', 
          alignment: 'center',
          fontSize: 9  // 番号が長いので少し小さく
        },
        { 
          text: row.note || '', 
          style: 'tableCell', 
          fontSize: 9,
          // noteに改行（\n）が含まれる場合、pdfmakeが自動的に改行として表示する
        }
      ]);
    });

    content.push({
      table: {
        headerRows: 1,
        // pdfmakeの仕様に合わせて%指定を避け、固定幅+最後を可変幅に
        // 実際の見え方に合わせて微調整可能
        widths: [45, 70, 60, 75, 70, 65, 95, '*'],
        body: tableBody
      },
      layout: {
        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
        vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1 : 0.5,
        hLineColor: () => '#000000',
        vLineColor: () => '#000000',
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 4,
        paddingBottom: () => 4
      },
      margin: [0, 0, 0, 12]
    });

    // フッター（上限注記）- 各ページの最後に表示
    content.push({
      text: [
        { text: '※ 上限額について:\n', bold: true },
        { text: '・健康保険: 年度（4月〜3月）累計 5,730,000円\n' },
        { text: '・厚生年金: 1か月 1,500,000円' }
      ],
      style: 'footer',
      margin: [0, 12, 0, 0],
      fontSize: 9,
      color: '#666666'
    });
  });

  return {
    info: { title: '被保険者賞与支払届（月次まとめ）' },
    defaultStyle: {
      font: 'NotoSansJP',
      fontSize: 10
    },
    content,
    styles: {
      title: { fontSize: 16, bold: true },
      subtitle: { fontSize: 11, color: '#666' },
      disclaimer: { fontSize: 10, color: '#666' },
      tableHeader: { 
        fontSize: 10, 
        bold: true, 
        fillColor: '#f0f0f0',
        margin: [2, 2, 2, 2]
      },
      tableCell: { 
        fontSize: 10,
        margin: [2, 2, 2, 2]
      },
      footer: {
        fontSize: 9,
        color: '#666666'
      }
    },
    pageMargins: [40, 60, 40, 60]
  };
}
```

---

## 6. UI導線の実装

### 6.1 ボタンの追加場所

**ファイル**: `src/app/pages/premiums/bonus/bonus-premiums.page.ts`

**追加位置**: 268-298行のアクションボタンエリア（CSVエクスポートボタンの後）

```typescript
// テンプレート部分（268-298行付近）
<div class="flex-row gap-2 flex-wrap">
  <button
    mat-stroked-button
    color="primary"
    (click)="exportToCsv()"
    [disabled]="!(filteredRows().length > 0)"
    *ngIf="canExport$ | async"
  >
    <mat-icon>download</mat-icon>
    CSVエクスポート
  </button>
  
  <!-- ★ 追加: 月次PDF出力ボタン -->
  <button
    mat-stroked-button
    color="primary"
    (click)="openMonthlyPdfDialog()"
    [disabled]="!(filteredRows().length > 0) || !(officeId$ | async)"
    *ngIf="canExport$ | async"
  >
    <mat-icon>picture_as_pdf</mat-icon>
    月次PDF出力
  </button>
  
  <!-- 既存のボタン... -->
</div>
```

### 6.2 メソッドの実装

**ファイル**: `src/app/pages/premiums/bonus/bonus-premiums.page.ts`

```typescript
// インポートに追加
import { DocumentGeneratorService, MonthlyBonusPaymentPayload } from '../../../services/document-generator.service';
import { aggregateBonusesByEmployee } from '../../../utils/document-templates/monthly-bonus-payment';

// コンストラクタまたはinjectに追加
private readonly documentGenerator = inject(DocumentGeneratorService);

// メソッド追加（openDocumentDialogの後あたり、1469行付近）
/**
 * 月次PDF出力ダイアログを開く
 * 
 * 注意: filteredRows()を使用して画面表示と同じ範囲の賞与データを取得する。
 * BonusPremiumViewRowはBonusPremiumをextendsしているため、row.idはBonusPremium.idと一致している前提。
 */
async openMonthlyPdfDialog(): Promise<void> {
  const office = await firstValueFrom(this.office$);
  if (!office) {
    this.snackBar.open('事業所が設定されていません', '閉じる', { duration: 3000 });
    return;
  }

  const yearMonth = this.selectedYearMonth();
  
  // 画面表示と同じフィルタ条件を適用（filteredRowsと同じ範囲）
  const filteredRows = this.filteredRows();
  if (!filteredRows || filteredRows.length === 0) {
    this.snackBar.open('対象年月に賞与データがありません', '閉じる', { duration: 3000 });
    return;
  }

  // filteredRowsからBonusPremiumデータを取得
  // 注意: BonusPremiumViewRowはBonusPremiumをextendsしているため、
  // row.idはBonusPremium.idと一致している前提で処理する
  const bonusIds = new Set(filteredRows.map(row => row.id));
  const allBonuses = await firstValueFrom(
    this.bonusPremiumsService.listByOfficeAndYearMonth(office.id, yearMonth)
  );
  const bonuses = allBonuses.filter(b => bonusIds.has(b.id));
  
  // 安全策: フィルタ後のbonusesが0件の場合はエラー
  if (bonuses.length === 0) {
    this.snackBar.open('対象年月に賞与データがありません', '閉じる', { duration: 3000 });
    return;
  }

  const employees = await firstValueFrom(this.employees$);
  if (!employees || employees.length === 0) {
    this.snackBar.open('従業員データが取得できませんでした', '閉じる', { duration: 3000 });
    return;
  }

  try {
    const payload: MonthlyBonusPaymentPayload = {
      office,
      employees: employees as Employee[],
      bonuses,
      yearMonth
    };

    // 集計処理を事前に実行して、結果が空でないことを確認（空PDFを防ぐ）
    const rows = aggregateBonusesByEmployee(
      bonuses,
      employees as Employee[],
      yearMonth
    );
    
    if (!rows || rows.length === 0) {
      this.snackBar.open('PDFに出力する賞与データがありません', '閉じる', { duration: 3000 });
      return;
    }

    // PDF生成（直接ダウンロード）
    this.documentGenerator.generate(
      { type: 'monthly_bonus_payment', payload },
      'download',
      `bonus-payment-monthly-${yearMonth}.pdf`
    );

    this.snackBar.open('月次PDFを生成しました', '閉じる', { duration: 3000 });
  } catch (error) {
    console.error('月次PDF生成に失敗しました', error);
    this.snackBar.open('月次PDF生成に失敗しました', '閉じる', { duration: 3000 });
  }
}
```

---

## 7. DocumentGeneratorService の拡張

### 7.1 createDefinition() の拡張

**ファイル**: `src/app/services/document-generator.service.ts`

```typescript
// インポートに追加
import { 
  createMonthlyBonusPaymentDocument,
  aggregateBonusesByEmployee,
  detectCommonPayDate,
  MonthlyBonusPaymentTemplateInput
} from '../utils/document-templates/monthly-bonus-payment';

// createDefinition() メソッドに追加（104-115行）
private createDefinition(document: DocumentPayload): TDocumentDefinitions {
  switch (document.type) {
    case 'qualification_acquisition':
      return createQualificationAcquisitionDocument(document.payload);
    case 'qualification_loss':
      return createQualificationLossDocument(document.payload);
    case 'bonus_payment':
      return createBonusPaymentDocument(document.payload);
    case 'monthly_bonus_payment': {  // ← 追加（ブロック{}を付ける）
      // Payloadから集計処理を行い、TemplateInputを作成
      const payload = document.payload as MonthlyBonusPaymentPayload;
      const rows = aggregateBonusesByEmployee(
        payload.bonuses,
        payload.employees,
        payload.yearMonth
      );
      
      // 集計結果が空の場合はエラー（空PDFを防ぐ）
      if (!rows || rows.length === 0) {
        throw new Error('PDFに出力する賞与データがありません');
      }
      
      const commonPayDate = detectCommonPayDate(rows);
      
      const templateInput: MonthlyBonusPaymentTemplateInput = {
        office: payload.office,
        rows,
        yearMonth: payload.yearMonth,
        commonPayDate
      };
      
      return createMonthlyBonusPaymentDocument(templateInput);
    }
    default:
      throw new Error('未対応の帳票種類です');
  }
}
```

### 7.2 buildFileName() の拡張

**ファイル**: `src/app/services/document-generator.service.ts`

```typescript
private buildFileName(document: DocumentPayload): string {
  const baseName = (() => {
    switch (document.type) {
      case 'qualification_acquisition':
        return 'qualification-acquisition';
      case 'qualification_loss':
        return 'qualification-loss';
      case 'bonus_payment':
        return 'bonus-payment';
      case 'monthly_bonus_payment': {  // ← 追加（ブロック{}を付ける）
        const payload = document.payload as MonthlyBonusPaymentPayload;
        return `bonus-payment-monthly-${payload.yearMonth}`;
      }
      default:
        return 'document';
    }
  })();

  // monthly_bonus_payment の場合は年月が既に含まれているので、従業員名は追加しない
  if (document.type === 'monthly_bonus_payment') {
    return `${baseName}.pdf`;
  }

  const employeeName = 'employee' in document.payload ? document.payload.employee?.name : '';
  const suffix = employeeName ? `-${employeeName}` : '';
  return `${baseName}${suffix}.pdf`;
}
```

---

## 8. 例外・不足データ時の扱い

### 8.1 Office項目の不足

**チェック箇所**: `monthly-bonus-payment.ts` のテンプレート生成時

**対応**:
- 不足項目は空文字列 `''` で表示
- 必須項目（`office.name`）が無い場合はエラーを投げる

```typescript
if (!office.name) {
  throw new Error('事業所名称が設定されていません。事業所設定画面で事業所名称を設定してください。');
}
```

### 8.2 従業員が削除されている場合

**チェック箇所**: 
- `bonus-premiums.page.ts` の `openMonthlyPdfDialog()`（事前フィルタリング）
- `aggregateBonusesByEmployee()` 関数内（念のためのガード）

**対応**:
- **事前フィルタリング**: `openMonthlyPdfDialog()`では`filteredRows()`を使用しており、削除された従業員の賞与データは既に除外されている（`bonus-premiums.page.ts`の1200-1207行目のフィルタリング処理により）
- **念のためのガード**: `aggregateBonusesByEmployee()`内でも`employeeMap.get(employeeId)`が`undefined`の場合はスキップ（二重チェック）
- 該当する賞与データはPDFに含めない（ログに警告を出力することを推奨）

```typescript
// bonus-premiums.page.ts の openMonthlyPdfDialog() 内
// filteredRows()を使用することで、削除された従業員の賞与データは既に除外されている

// aggregateBonusesByEmployee() 関数内（念のためのガード）
const employee = employeeMap.get(employeeId);
if (!employee) {
  console.warn(`従業員が見つかりません（employeeId: ${employeeId}）。賞与データをスキップします。`);
  continue;
}
```

**注意**: `filteredRows()`を使っているため、通常は`aggregateBonusesByEmployee()`に削除された従業員のデータは渡されない。ただし、タイミングの問題（従業員削除とPDF生成が同時に発生した場合など）に備えて、`aggregateBonusesByEmployee()`内でもガードを実装する。

### 8.3 pensionNumber / myNumber の不足

**チェック箇所**: `aggregateBonusesByEmployee()` 関数内の70歳以上判定後

**対応**:
- 70歳以上でも `pensionNumber` や `myNumber` が無い場合は空欄で表示
- PDFの⑦欄は空欄になる（エラーにはしない）
- myNumber優先、なければpensionNumberを使用

```typescript
const myNumberOrPensionNumber = isSeventyOrOlder
  ? (employee.myNumber || employee.pensionNumber || undefined)
  : undefined;
```

### 8.4 対象年月に賞与データが0件の場合

**チェック箇所**: `bonus-premiums.page.ts` の `openMonthlyPdfDialog()`

**対応**:
- スナックバーで「対象年月に賞与データがありません」と表示
- PDF生成は実行しない

### 8.5 従業員データが取得できない場合

**チェック箇所**: `bonus-premiums.page.ts` の `openMonthlyPdfDialog()`

**対応**:
- スナックバーで「従業員データが取得できませんでした」と表示
- PDF生成は実行しない

### 8.6 集計結果が空の場合（削除された従業員のみのデータなど）

**チェック箇所**: 
- `bonus-premiums.page.ts` の `openMonthlyPdfDialog()`（事前チェック）
- `document-generator.service.ts` の `createDefinition()`（念のためのガード）

**対応**:
- `aggregateBonusesByEmployee()`の結果が空配列の場合、空PDFを防ぐためエラーを投げる
- `openMonthlyPdfDialog()`では事前にチェックしてスナックバーで「PDFに出力する賞与データがありません」と表示
- `createDefinition()`内でも念のためチェックしてエラーを投げる

```typescript
// bonus-premiums.page.ts の openMonthlyPdfDialog() 内
const rows = aggregateBonusesByEmployee(bonuses, employees, yearMonth);
if (!rows || rows.length === 0) {
  this.snackBar.open('PDFに出力する賞与データがありません', '閉じる', { duration: 3000 });
  return;
}

// document-generator.service.ts の createDefinition() 内
const rows = aggregateBonusesByEmployee(...);
if (!rows || rows.length === 0) {
  throw new Error('PDFに出力する賞与データがありません');
}
```

**理由**: 削除された従業員の賞与データのみが残っている場合、`filteredRows()`で除外されるため`bonuses`が空になる。また、タイミングの問題で`aggregateBonusesByEmployee()`の結果が空になる可能性もあるため、空PDFを防ぐためにチェックが必要。

---

## 9. 簡易テスト観点

### 9.1 基本機能テスト

1. **月次PDF出力ボタンの表示**
   - [ ] 対象年月に賞与データがある場合、ボタンが有効になる
   - [ ] 対象年月に賞与データがない場合、ボタンが無効になる
   - [ ] admin/hr ロールのみボタンが表示される

2. **PDF生成の基本動作**
   - [ ] ボタンクリックでPDFがダウンロードされる
   - [ ] ファイル名が `bonus-payment-monthly-YYYY-MM.pdf` 形式になっている
   - [ ] PDFが正常に開ける

### 9.2 データ集計テスト

3. **同一月内の複数支給の合算**
   - [ ] 同一従業員が同月に2回以上賞与を受け取った場合、1行に合算される
   - [ ] 合算後の `grossAmount` が正しい
   - [ ] 合算後の `standardBonusAmount` が1,000円未満切捨てされている
   - [ ] 備考欄に「3.同一月内の賞与合算（初回支払日: 令和X年M月D日）」が記載される（様式に合わせた形式、令和表記）
   - [ ] 支払日が最後の支払日になっている

4. **支払日の共通判定**
   - [ ] 全員の支払日が同じ場合、「共通」欄に支払日が表示される（令和表記）
   - [ ] 各行の④欄が空欄になる
   - [ ] 支払日が混在する場合、「共通」欄が空欄になる
   - [ ] 各行の④欄に個別の支払日が表示される（令和表記）

4-2. **日付表記の確認**
   - [ ] ③生年月日が西暦表記（YYYY年M月D日）で表示される
   - [ ] ④賞与支払年月日（共通・個別）が令和表記（令和X年M月D日）で表示される
   - [ ] 備考欄の初回支払日が令和表記で表示される
   - [ ] 万一2019年5月1日より前の支払日がある場合、西暦表記で表示される（安全策）

### 9.3 70歳以上判定テスト

5. **個人番号/基礎年金番号の表示と備考欄**
   - [ ] 70歳以上の従業員の⑦欄に個人番号または基礎年金番号が表示される
   - [ ] myNumberがある場合はmyNumberが優先表示される
   - [ ] myNumberが無くpensionNumberがある場合はpensionNumberが表示される
   - [ ] 70歳未満の従業員の⑦欄が空欄になる
   - [ ] 70歳以上でも `myNumber` や `pensionNumber` が無い場合は空欄になる
   - [ ] **70歳以上の従業員の⑧備考欄に「1.70歳以上被用者」が自動で記載される**（様式に合わせた形式）
   - [ ] 70歳以上かつ同一月内に複数回支給がある場合、備考欄に「1.70歳以上被用者」と「3.同一月内の賞与合算（初回支払日: ...）」の両方が改行で区切って記載される

### 9.4 ページ分割テスト

6. **10人/枚のページ分割**
   - [ ] 10人以下の場合、1ページのみ生成される
   - [ ] 11人以上の場合、2ページ目が生成される
   - [ ] 21人以上の場合、3ページ目が生成される
   - [ ] 各ページにヘッダーとフッターが表示される
   - [ ] **重要**: 10人で1ページに収まること（ページ溢れしない）。必要に応じてfontSizeやmarginを調整
   - [ ] **共通支払日がある場合、2ページ目以降の簡易情報テーブルにも「④ 賞与支払年月日（共通）」が表示される**（続きページだけ開かれても支払日が確認できるように）

### 9.5 上限注記テスト

7. **フッターの上限注記**
   - [ ] 各ページのフッターに「健康保険: 年度累計 5,730,000円」が表示される
   - [ ] 各ページのフッターに「厚生年金: 1か月 1,500,000円」が表示される

### 9.6 既存機能の回帰テスト

8. **既存1件PDF出力の動作確認**
   - [ ] 既存の「帳票出力」ボタンが正常に動作する
   - [ ] 既存の1件PDFが正常に生成される
   - [ ] 既存のPDFテンプレートが変更されていない

### 9.7 エラーハンドリングテスト

9. **例外ケースの動作確認**
   - [ ] 事業所名称が未設定の場合、エラーメッセージが表示される
   - [ ] **削除された従業員の賞与データがPDFに含まれないこと**（`filteredRows()`で除外される）
   - [ ] **削除された従業員の賞与データのみが残っている場合、空PDFを防ぐためエラーメッセージが表示される**（「PDFに出力する賞与データがありません」）
   - [ ] 対象年月に賞与データが0件の場合、エラーメッセージが表示される
   - [ ] `filteredRows()`が空の場合、エラーメッセージが表示される
   - [ ] `row.id`と`BonusPremium.id`が一致しない場合、フィルタ後のbonusesが0件になりエラーメッセージが表示される
   - [ ] `aggregateBonusesByEmployee()`の結果が空の場合、`createDefinition()`内でエラーが投げられる

---

## 10. 実装チェックリスト

### 10.1 ファイル作成
- [ ] `src/app/utils/document-templates/monthly-bonus-payment.ts` を作成（型定義も同一ファイルに含める）

### 10.2 ファイル修正
- [ ] `src/app/services/document-generator.service.ts` を修正
  - [ ] `DocumentType` に `'monthly_bonus_payment'` を追加
  - [ ] `MonthlyBonusPaymentPayload` 型を追加
  - [ ] `DocumentPayload` に月次PDFを追加
  - [ ] `createDefinition()` に分岐を追加（集計処理を含む、**ブロック{}を付ける**）
  - [ ] `buildFileName()` に月次PDFファイル名を追加（**ブロック{}を付ける**）
  - [ ] 必要なインポート文を追加（`aggregateBonusesByEmployee`, `detectCommonPayDate`, `MonthlyBonusPaymentTemplateInput`）

- [ ] `src/app/pages/premiums/bonus/bonus-premiums.page.ts` を修正
  - [ ] 「月次PDF出力」ボタンを追加
  - [ ] `openMonthlyPdfDialog()` メソッドを追加（`filteredRows()`と同じ範囲を使用、`row.id`と`BonusPremium.id`の一致を前提）
  - [ ] 必要なインポート文を追加（`DocumentGeneratorService`, `MonthlyBonusPaymentPayload`）

### 10.3 実装確認
- [ ] 集計ロジックが正しく動作する
- [ ] PDFテンプレートが正しく生成される
- [ ] ページ分割が正しく動作する
- [ ] 10人で1ページに収まること（ページ溢れしない）
- [ ] switch-case内のブロック{}が正しく付いている
- [ ] **⑧備考欄に「1.70歳以上被用者」が正しく表示される**（70歳以上の従業員の場合）
- [ ] **⑧備考欄に「3.同一月内の賞与合算（初回支払日: ...）」が正しく表示される**（同一月内複数支給の場合）
- [ ] **⑧備考欄で複数項目が改行で区切って表示される**（70歳以上かつ同一月内複数支給の場合）
- [ ] **共通支払日がある場合、2ページ目以降の簡易情報テーブルにも「④ 賞与支払年月日（共通）」が表示される**
- [ ] **pdfmakeのwidths指定が%指定ではなく、固定幅（数値）+ 最後を'*'（可変幅）の形式になっている**
- [ ] 未使用importの警告が出ていない
- [ ] 既存機能が壊れていない

### 10.4 テスト
- [ ] 上記のテスト観点をすべて確認
- [ ] ブラウザのコンソールにエラーが出ていない
- [ ] PDFが正常に開ける

---

## 11. 補足・注意事項

### 11.1 Officeフィールドの確認結果

**確認済み**: すべての必要なフィールドが `Office` 型に存在します。

- ✅ `officeSymbol` → 事業所整理記号
- ✅ `officeNumber` → 事業所番号
- ✅ `officePostalCode` → 郵便番号
- ✅ `address` → 事業所所在地
- ✅ `name` → 事業所名称
- ✅ `officeOwnerName` → 事業主氏名
- ✅ `officePhone` → 電話番号

**不足項目**: なし

### 11.2 年齢計算の基準日について

**現状実装**: 対象年月の月末日を基準に年齢を計算

```typescript
const targetYear = parseInt(yearMonth.substring(0, 4));
const targetMonth = parseInt(yearMonth.substring(5, 7));
const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();
const referenceDate = `${yearMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;
```

**理由**: 被保険者賞与支払届は「その月の賞与支払い」を報告するため、月末時点での年齢が適切。

### 11.3 標準賞与額の計算方法

**仕様**: 合算後の `grossAmount` から1,000円未満を切り捨て

```typescript
const standardBonusAmount = Math.floor(totalGrossAmount / 1000) * 1000;
```

**注意**: 各賞与の `standardBonusAmount` を合算するのではなく、合算後の `grossAmount` から再計算する。

### 11.4 テーブルレイアウトについて

**選択理由**: 
- 様式に近い表形式レイアウトを採用
- pdfmakeの `table` 機能を使用して実装
- 1枚10人の制約を守りつつ、複数ページに対応

**代替案**: 
- より様式に近づける場合は、座標指定での描画も可能だが、実装コストが高い
- 現状の表形式で十分実用的

### 11.5 パフォーマンス考慮

**現状**: 
- `listByOfficeAndYearMonth()` で全データを取得してからクライアント側でフィルタ
- 月次PDF生成時は `filteredRows()` と同じ範囲を使用（画面表示と一致）

**将来の改善案**:
- Firestoreクエリに `where` 条件を追加してパフォーマンス改善
- ただし、今回の実装では既存の方法を流用（最小変更）

### 11.6 日付表記について

**仕様**: 元号表記にするのは「賞与支払年月日」のみ

**前提**: 本機能は「今後提出する賞与支払届」用途を想定するため、賞与支払年月日は原則として**令和（2019/05/01以降）**の日付となる想定。

**実装**: `formatPayDateReiwa()` 関数を `monthly-bonus-payment.ts` 内に実装
- 2019年5月1日以降: 令和X年M月D日
- 2019年5月1日より前: 西暦YYYY年M月D日（安全策としてガード）
- **重要**: `REIWA_START`は`new Date(2019, 4, 1)`形式で定義（`new Date('2019-05-01')`はUTC解釈で誤判定の可能性があるため）
- **重要**: `calculateAgeAtDate()`も同様に`new Date(y, m-1, d)`形式でローカル時刻として生成

**適用箇所**:
- ✅ ④賞与支払年月日（共通・個別）→ 令和表記
- ✅ 備考欄「初回支払日」→ 令和表記
- ❌ ③生年月日 → 西暦表記のまま（`formatDate()`を使用）

**理由**: 生年月日は昭和・平成があり得るが、本機能の目的は「今後提出する賞与支払届」の支払日の可読性向上であり、元号化対象を支払日に限定するため。

### 11.7 ⑦欄の表示ロジック

**仕様**: 個人番号（又は基礎年金番号）

**実装**: myNumber優先、なければpensionNumber
- 70歳以上かつmyNumberがある → myNumberを表示
- 70歳以上かつmyNumberが無いがpensionNumberがある → pensionNumberを表示
- 70歳未満、または両方無い → 空欄

### 11.7-2 ⑧備考欄の表示ロジック

**仕様**: 様式に合わせた備考項目を自動で記載

**実装**: `noteParts`配列を使用して複数項目を管理
- **1. 70歳以上被用者**: 70歳以上の従業員の場合、自動で「1.70歳以上被用者」を追加
- **3. 同一月内の賞与合算**: 同一月内に複数回支給がある場合、「3.同一月内の賞与合算（初回支払日: 令和X年M月D日）」を追加
- **複数項目**: 両方に該当する場合は改行（`\n`）で区切って結合

**例**:
- 70歳以上のみ: `"1.70歳以上被用者"`
- 同一月内複数支給のみ: `"3.同一月内の賞与合算（初回支払日: 令和6年12月15日）"`
- 両方該当: `"1.70歳以上被用者\n3.同一月内の賞与合算（初回支払日: 令和6年12月15日）"`

**理由**: 原本の様式に合わせることで、提出用帳票としての「それっぽさ」が向上する。

### 11.8 事業所情報の表示

**1ページ目**: 詳細情報（事業所名称、整理記号、番号、郵便番号、所在地、事業主氏名、電話番号）+ 対象年月 + 共通支払日（該当する場合）

**2ページ目以降**: 簡易情報（事業所名称、対象年月、共通支払日（該当する場合））

**理由**: 
- PDFを単独で見たとき、2ページ目だけ開かれても最低限の情報が分かるようにする
- **重要**: 共通支払日がある場合、2ページ目以降にも表示することで、続きページだけ開かれても支払日が確認できるようにする（各行の④欄は空欄のため）

**注意**: pdfmakeの仕様上、`widths`に`'32%'`のような%指定は非対応の可能性があるため、固定幅（数値）+ 最後を`'*'`（可変幅）にする形式を使用する。

### 11.9 filteredRows()の扱いについて

**前提**: `BonusPremiumViewRow`は`BonusPremium`をextendsしているため、`row.id`は`BonusPremium.id`と一致している。

**実装方針**:
- `filteredRows()`から`row.id`を抽出して、`listByOfficeAndYearMonth()`の結果をフィルタ
- これにより、画面表示と同じ範囲の賞与データのみがPDFに含まれる

**注意**: 万一`row.id`と`BonusPremium.id`が一致しない場合は、フィルタ後の`bonuses`が0件になるため、エラーメッセージを表示してPDF生成を中断する。

### 11.10 ページ溢れ対策

**問題**: 1ページ目は「タイトル＋免責＋事業所7項目＋対象年月テーブル＋本表＋フッター」のため、フォントや余白次第で10行が次ページに押し出される可能性がある。

**対策**:
- テスト時に10人で1ページに収まることを確認
- 必要に応じて`fontSize`や`margin`を調整
- テーブルの`fontSize`を10pt、`pageMargins`を`[40, 60, 40, 60]`に設定（デフォルト）

### 11.11 未使用importの整理

**注意**: 
- `aggregateBonusesByEmployee()`関数内では`formatCurrency`を使用しない（テンプレート側で使用）
- 未使用importの警告が出る場合は削除する

---

## 12. 実装順序の推奨

1. **型定義の追加**（`document-generator.service.ts`）
   - `DocumentType` の拡張
   - `MonthlyBonusPaymentPayload` の追加
   - `DocumentPayload` の拡張

2. **集計ロジックの実装**（`monthly-bonus-payment.ts`）
   - 型定義（`MonthlyBonusPdfRow`, `MonthlyBonusPaymentTemplateInput`）
   - `aggregateBonusesByEmployee()` 関数
   - `detectCommonPayDate()` 関数
   - `calculateAgeAtDate()` 関数
   - `formatPayDateReiwa()` 関数（支払日専用の令和表記関数）

3. **PDFテンプレートの実装**（`monthly-bonus-payment.ts`）
   - `createMonthlyBonusPaymentDocument()` 関数
   - ページ分割ロジック
   - テーブル構造の定義

4. **サービス層の拡張**（`document-generator.service.ts`）
   - `createDefinition()` に分岐追加（集計処理を含む、**ブロック{}を付ける**）
   - `buildFileName()` にファイル名追加（**ブロック{}を付ける**）
   - 必要なインポートを追加（`aggregateBonusesByEmployee`, `detectCommonPayDate`, `MonthlyBonusPaymentTemplateInput`）

5. **UI導線の追加**（`bonus-premiums.page.ts`）
   - ボタンの追加
   - `openMonthlyPdfDialog()` メソッドの実装（`filteredRows()`と同じ範囲を使用）

6. **テスト**
   - 上記のテスト観点を確認

---

以上で実装指示書は完了です。この指示書に従って実装を進めてください。

