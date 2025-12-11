export type HelpTopicId =
  | 'standardMonthlyReward'
  | 'bonusRange'
  | 'shortTimeWorker';

export interface HelpTopic {
  id: HelpTopicId;
  title: string;
  content: string;
  points?: string[];
  notes?: string;
}

export const HELP_TOPICS: Record<HelpTopicId, HelpTopic> = {
  standardMonthlyReward: {
    id: 'standardMonthlyReward',
    title: '標準報酬月額・等級とは？',
    content:
      '標準報酬月額は、健康保険・厚生年金の保険料や給付額を計算するときの"基礎となる金額"です。実際の給与（基本給＋各種手当など）の月額を、あらかじめ決められた区分に当てはめたものが標準報酬月額となります。',
    points: [
      '基本給に各種手当（通勤手当、残業手当など）を加えた月額報酬をもとに、標準報酬月額が決まります',
      '標準報酬月額に応じて、1級から47級までの等級が決まります',
      '等級は毎年4月から6月の報酬を基に「定時決定」され、その年の9月から翌年8月まで適用されます',
      '報酬が大きく変わった場合（昇給・降給など）には「随時改定」が行われ、等級が変更されることがあります',
      'InsurePath上では、この標準報酬月額と等級をマスタや従業員情報に登録して、保険料計算の基礎として使用しています'
    ],
    notes:
      '等級の決定方法や最新のルールについては、必ず協会けんぽ・年金事務所・社労士などの案内を確認してください。'
  },
  bonusRange: {
    id: 'bonusRange',
    title: '賞与として扱うべき範囲',
    content:
      'ここでいう"賞与"は、毎月の給与とは別に臨時・一時的に支給されるお金であり、社会保険上の"標準賞与額"の対象になる支給を指します。',
    points: [
      '一般的に賞与に含まれる例：夏・冬のボーナス、決算賞与、業績連動の一時金など',
      '一般的に賞与に含めない例：通勤手当や残業代など毎月の給与に含まれる手当、退職金、見舞金など',
      'InsurePathでは、この画面に登録した支給額が「標準賞与額」として扱われ、健康保険・厚生年金の賞与保険料計算に使用されます'
    ],
    notes:
      'どの支給を賞与とみなすかは、就業規則や社会保険の運用によって異なる場合があります。迷った場合は、年金事務所や社労士に確認してください。'
  },
  shortTimeWorker: {
    id: 'shortTimeWorker',
    title: '短時間労働者の社会保険適用条件',
    content:
      '短時間労働者（パート・アルバイト等）であっても、一定の条件を満たす場合は社会保険の適用対象になります。これを「適用拡大」といいます。',
    points: [
      '短時間労働者のイメージ：一般社員より所定労働時間が短いパート・アルバイトなどの従業員',
      '社会保険の適用が必要になる代表的な条件（目安として）：週の所定労働時間がおおむね20時間以上であること',
      '月額賃金が一定額以上（例：おおむね8.8万円以上）であること',
      '2か月を超えて雇用が続く見込みがあること',
      '昼間学生ではないこと',
      '事業所の規模など、会社側の条件がある場合があること',
      'InsurePath上では、これらの条件を満たすかどうかの判定は行いません。条件を満たす従業員を「社会保険対象」として登録することで、標準報酬月額や保険料を管理する前提となっています'
    ],
    notes:
      '実際の適用条件や企業規模要件は、法改正等により変わる可能性があります。最終的な判断は、日本年金機構・厚生労働省の公式資料や社労士等の専門家の案内に従ってください。'
  }
};

export function getHelpTopic(id: HelpTopicId): HelpTopic | undefined {
  return HELP_TOPICS[id];
}

export function getHelpTopics(ids: HelpTopicId[]): HelpTopic[] {
  return ids
    .map((id) => HELP_TOPICS[id])
    .filter((topic): topic is HelpTopic => Boolean(topic));
}
