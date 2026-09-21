/**
 * H.I.F. (『Hatsuboshi IDOL FESTIVAL』, produce_group-003: 選抜試験 produce-007, 20 days;
 * 本戦 produce-008, 7 days + ラウンド1/2). Default scenario (decision D5).
 *
 * One run = 選抜試験 + 本戦 (D21). Schedule facts: docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md
 * § Surprises (H.I.F. structure, from wikiwiki HIF/基本情報 2026-09-13 and 学マスwiki H.I.F).
 * Counts: user's route answers of 2026-09-19 through route-profiles.html (D21–D24); the
 * "choices" and "params" comments record the inputs the counts were derived from
 * (revised answer of 2026-09-19: 相談 削除 totals 2/2/5, 元気効果 12, third profile named).
 * パラメータボーナス base is a function of how many lessons train the stat (see
 * `bonusBase`; 7 of 8 → 1359, 1 of 8 → 511, 0 → 370), decisions D24–D26.
 */

import type { LessonSplit, Scenario } from "../../src/engine/types.ts";

const LESSONS = 8;

/**
 * Lesson-split presets (D26): a player picks lessons by deck build — seven of
 * the eight on the main stat and one on a sub stat. The table scores each card
 * under its best preset.
 */
export const LESSON_SPLITS: readonly LessonSplit[] = [
  { vocal: 7, dance: 1, visual: 0 },
  { vocal: 7, dance: 0, visual: 1 },
  { vocal: 1, dance: 7, visual: 0 },
  { vocal: 0, dance: 7, visual: 1 },
  { vocal: 1, dance: 0, visual: 7 },
  { vocal: 0, dance: 1, visual: 7 },
];

/**
 * Parameter a stat gains over the run from sources パラメータボーナス+ multiplies,
 * for a stat trained by `n` of the 8 lessons: all-SP lesson gain 800 × n/8,
 * the sub-parameter share 340 × (8 − n)/16 (each non-selected lesson lands its
 * sub-parameter on one of the two other stats), the 選抜試験 base 200, and the
 * 選抜試験 distributed 500 × n/8 (lesson share as a proxy for score share).
 */
export function bonusBase(n: number): number {
  return Math.round((800 * n) / LESSONS + (340 * (LESSONS - n)) / (2 * LESSONS) + 200 + (500 * n) / LESSONS);
}

export const HIF: Scenario = {
  id: "hif",
  name: "H.I.F.",
  parameterCap: 3000,
  profiles: [
    {
      id: "sashiire",
      name: "差し入れ育成",
      // choices: s1=差し入れ s5=おでかけ s8=差し入れ s12=相談 s14=差し入れ s16=差し入れ s19=相談 h3=差し入れ
      // params: rest=0 shopDrinks=8 shopCards=2 shopUpgrades=0 shopDeletes=2 intervalCards=0 intervalChanges=0 intervalUpgrades=0 intervalDrinks=2 randomUpgrades=0 autoDeletes=4 items=3 bonusLessons=800 bonusAudition=700
      lessonSplits: LESSON_SPLITS,
      parameterBonusBase: bonusBase,
      occasions: {
        ProduceStart: 1, // プロデュース開始
        EndLesson: 8, // レッスン終了
        EndStepEventSchool: 6, // 授業・営業終了
        EndAudition: 5, // 試験・オーディション終了
        EndBeforeAuditionRefresh: 4, // 試験・オーディション開始 (試験前の休憩後)
        StartPresent: 5, // 活動支給・差し入れ選択
        EndStepEventActivity: 1, // おでかけ終了
        StartShop: 3, // 相談選択
        StartRefresh: 0, // 休む選択
        StartCustomize: 0, // 特別指導開始
        GetProduceCard: 20, // スキルカード獲得
        DeleteProduceCard: 6, // スキルカード削除
        UpgradeProduceCard: 0, // スキルカード強化
        ChangeProduceCard: 4, // スキルカードチェンジ
        CustomizeProduceCard: 2, // スキルカードカスタマイズ
        BuyShopItemProduceCard: 2, // 相談でスキルカード交換
        GetProduceDrink: 16, // Pドリンク獲得
        BuyShopItemProduceDrink: 8, // 相談でPドリンク交換
        GetProduceItem: 3, // Pアイテム獲得
      },
      filters: {
        EndLesson: { lessonKind: { members: { sp: 8, normal: 0 } } }, // every lesson is an SP lesson (docs/adr/0001)
        UpgradeProduceCard: { cardType: { members: { mental: 0, active: 0 } }, effectGroup: { default: 0 } }, // effectGroup: carried over as every upgrade (C13)
        DeleteProduceCard: { cardType: { members: { mental: 6, active: 6 } } },
        ChangeProduceCard: { cardName: { members: { starter: 4 } } }, // 名前に「基本」を含む
        GetProduceCard: {
          cardType: { members: { mental: 13, active: 7 } },
          effectGroup: { default: 10, members: { review: 14, block: 12 } },
          rarity: { members: { ssr: 10 } },
        },
      },
    },
    {
      id: "odekake",
      name: "おでかけ育成",
      // choices: s1=差し入れ s5=おでかけ s8=おでかけ s12=相談 s14=おでかけ s16=おでかけ s19=相談 h3=おでかけ
      // params: rest=0 shopDrinks=3 shopCards=0 shopUpgrades=0 shopDeletes=2 intervalCards=0 intervalChanges=0 intervalUpgrades=0 intervalDrinks=2 randomUpgrades=0 autoDeletes=4 items=3 bonusLessons=800 bonusAudition=700
      lessonSplits: LESSON_SPLITS,
      parameterBonusBase: bonusBase,
      occasions: {
        ProduceStart: 1, // プロデュース開始
        EndLesson: 8, // レッスン終了
        EndStepEventSchool: 6, // 授業・営業終了
        EndAudition: 5, // 試験・オーディション終了
        EndBeforeAuditionRefresh: 4, // 試験・オーディション開始 (試験前の休憩後)
        StartPresent: 1, // 活動支給・差し入れ選択
        EndStepEventActivity: 5, // おでかけ終了
        StartShop: 3, // 相談選択
        StartRefresh: 0, // 休む選択
        StartCustomize: 0, // 特別指導開始
        GetProduceCard: 20, // スキルカード獲得
        DeleteProduceCard: 6, // スキルカード削除
        UpgradeProduceCard: 0, // スキルカード強化
        ChangeProduceCard: 4, // スキルカードチェンジ
        CustomizeProduceCard: 2, // スキルカードカスタマイズ
        BuyShopItemProduceCard: 0, // 相談でスキルカード交換
        GetProduceDrink: 11, // Pドリンク獲得
        BuyShopItemProduceDrink: 3, // 相談でPドリンク交換
        GetProduceItem: 3, // Pアイテム獲得
      },
      filters: {
        EndLesson: { lessonKind: { members: { sp: 8, normal: 0 } } }, // every lesson is an SP lesson (docs/adr/0001)
        UpgradeProduceCard: { cardType: { members: { mental: 0, active: 0 } }, effectGroup: { default: 0 } }, // effectGroup: carried over as every upgrade (C13)
        DeleteProduceCard: { cardType: { members: { mental: 6, active: 6 } } },
        ChangeProduceCard: { cardName: { members: { starter: 4 } } }, // 名前に「基本」を含む
        GetProduceCard: {
          cardType: { members: { mental: 13, active: 7 } },
          effectGroup: { default: 10, members: { review: 14, block: 12 } },
          rarity: { members: { ssr: 10 } },
        },
      },
    },
    {
      id: "generic-contest",
      name: "汎用コンテ育成",
      // choices: s1=差し入れ s5=おでかけ s8=差し入れ s12=相談 s14=差し入れ s16=相談 s19=相談 h3=差し入れ
      // params: rest=0 shopDrinks=0 shopCards=0 shopUpgrades=0 shopDeletes=5 intervalCards=0 intervalChanges=0 intervalUpgrades=0 intervalDrinks=2 randomUpgrades=0 autoDeletes=4 items=6 bonusLessons=800 bonusAudition=700
      lessonSplits: LESSON_SPLITS,
      parameterBonusBase: bonusBase,
      occasions: {
        ProduceStart: 1, // プロデュース開始
        EndLesson: 8, // レッスン終了
        EndStepEventSchool: 6, // 授業・営業終了
        EndAudition: 5, // 試験・オーディション終了
        EndBeforeAuditionRefresh: 4, // 試験・オーディション開始 (試験前の休憩後)
        StartPresent: 4, // 活動支給・差し入れ選択
        EndStepEventActivity: 1, // おでかけ終了
        StartShop: 4, // 相談選択
        StartRefresh: 0, // 休む選択
        StartCustomize: 0, // 特別指導開始
        GetProduceCard: 20, // スキルカード獲得
        DeleteProduceCard: 9, // スキルカード削除
        UpgradeProduceCard: 0, // スキルカード強化
        ChangeProduceCard: 4, // スキルカードチェンジ
        CustomizeProduceCard: 2, // スキルカードカスタマイズ
        BuyShopItemProduceCard: 0, // 相談でスキルカード交換
        GetProduceDrink: 7, // Pドリンク獲得
        BuyShopItemProduceDrink: 0, // 相談でPドリンク交換
        GetProduceItem: 6, // Pアイテム獲得
      },
      filters: {
        EndLesson: { lessonKind: { members: { sp: 8, normal: 0 } } }, // every lesson is an SP lesson (docs/adr/0001)
        UpgradeProduceCard: { cardType: { members: { mental: 0, active: 0 } }, effectGroup: { default: 0 } }, // effectGroup: carried over as every upgrade (C13)
        DeleteProduceCard: { cardType: { members: { mental: 9, active: 9 } } },
        ChangeProduceCard: { cardName: { members: { starter: 4 } } }, // 名前に「基本」を含む
        GetProduceCard: {
          cardType: { members: { mental: 13, active: 7 } },
          effectGroup: { default: 10, members: { review: 14, block: 12 } },
          rarity: { members: { ssr: 7 } },
        },
      },
    },
  ],
};
