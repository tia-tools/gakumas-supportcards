/**
 * 初LEGEND (produce-006 レジェンド in produce_group-001 定期公演『初』): 18 weeks.
 *
 * Schedule (wikiwiki 初LEGEND page 2026-03-26; confirmed by the user 2026-09-17, D18):
 *   week 1 授業 · 2 授業 · 3 おでかけ/活動支給 · 4 レジェンドレッスン · 5 おでかけ/相談/活動支給
 *   6 授業 · 7 レジェンドレッスン · 8 相談 · 9 特別指導 · 10 中間試験 · 11 おでかけ/活動支給
 *   12 レジェンドレッスン · 13 おでかけ/相談/活動支給 · 14 レジェンドレッスン · 15 授業
 *   16 レジェンドレッスン · 17 相談/特別指導 · 18 最終試験
 * The five レジェンドレッスン are the scenario's only lessons (perfect clear, selected stat:
 * 140, 180, 260, 370, 570). 授業 give 選択パラ+100/+100/+150/+200 (not lesson triggers).
 * Cap 3000 (D19). Both auditions count for 「試験・オーディション終了時」 (D20).
 *
 * PROVISIONAL (2026-09-19): apart from the schedule facts above (lessons, 授業, auditions and the
 * start of the run), every occasion and filter count below is the agent's estimate. They will be
 * replaced once the user answers a 初LEGEND route sheet like the H.I.F. one.
 */

import type { LessonSplit, Scenario } from "../../src/engine/types.ts";

/** Per-lesson selected / non-selected gains at perfect clear (weeks 4, 7, 12, 14, 16). */
const SELECTED = [140, 180, 260, 370, 570];
const NON_SELECTED = [55, 60, 70, 90, 115];

/**
 * Lesson-split presets (D26), assumed by analogy with H.I.F.'s 7/1/0 family:
 * four of the five lessons on the main stat, one on a sub stat. Guess until the
 * user confirms through a 初LEGEND route sheet.
 */
export const LESSON_SPLITS: readonly LessonSplit[] = [
  { vocal: 4, dance: 1, visual: 0 },
  { vocal: 4, dance: 0, visual: 1 },
  { vocal: 1, dance: 4, visual: 0 },
  { vocal: 0, dance: 4, visual: 1 },
  { vocal: 1, dance: 0, visual: 4 },
  { vocal: 0, dance: 1, visual: 4 },
];

/**
 * Parameter a stat gains from lessons when `n` of the five select it: the
 * selected gain of the n largest lessons (guess: the main stat takes the late,
 * big lessons) plus the non-selected gain of the others. 中間試験 rewards are not
 * included (guess). 5 → 1520, 4 → 1435, 1 → 845, 0 → 390.
 */
export function bonusBase(n: number): number {
  const sel = SELECTED.slice(SELECTED.length - n).reduce((a, b) => a + b, 0);
  const non = NON_SELECTED.slice(0, NON_SELECTED.length - n).reduce((a, b) => a + b, 0);
  return sel + non;
}

export const HAJIME_LEGEND: Scenario = {
  id: "hajime-legend",
  name: "初LEGEND",
  parameterCap: 3000,
  profiles: [
    {
      id: "standard",
      name: "標準",
      lessonSplits: LESSON_SPLITS,
      parameterBonusBase: bonusBase,
      occasions: {
        ProduceStart: 1, // プロデュース開始
        EndLesson: 5, // レッスン終了
        EndStepEventSchool: 4, // 授業・営業終了
        EndAudition: 2, // 試験・オーディション終了
        EndBeforeAuditionRefresh: 2, // 試験・オーディション開始 (試験前の休憩後)
        StartPresent: 4, // 活動支給・差し入れ選択
        EndStepEventActivity: 0, // おでかけ終了
        StartShop: 4, // 相談選択
        StartRefresh: 0, // 休む選択
        StartCustomize: 1, // 特別指導開始
        GetProduceCard: 12, // スキルカード獲得
        DeleteProduceCard: 3, // スキルカード削除
        UpgradeProduceCard: 3, // スキルカード強化
        ChangeProduceCard: 2, // スキルカードチェンジ
        CustomizeProduceCard: 2, // スキルカードカスタマイズ
        BuyShopItemProduceCard: 2, // 相談でスキルカード交換
        GetProduceDrink: 8, // Pドリンク獲得
        BuyShopItemProduceDrink: 4, // 相談でPドリンク交換
        GetProduceItem: 2, // Pアイテム獲得
      },
      filters: {
        EndLesson: { lessonKind: { members: { sp: 5, normal: 0 } } }, // every lesson is an SP lesson (docs/adr/0001)
        UpgradeProduceCard: { cardType: { members: { mental: 3, active: 3 } }, effectGroup: { default: 3 } }, // effectGroup: carried over as every upgrade (C13)
        DeleteProduceCard: { cardType: { members: { mental: 3, active: 3 } } },
        ChangeProduceCard: { cardName: { members: { starter: 2 } } }, // 名前に「基本」を含む
        GetProduceCard: {
          cardType: { members: { mental: 8, active: 4 } },
          effectGroup: { default: 6 },
          rarity: { members: { ssr: 4 } },
        },
      },
    },
  ],
};
