/**
 * H.I.F. (『Hatsuboshi IDOL FESTIVAL』, produce_group-003: 選抜試験 produce-007, 20 days;
 * 本戦 produce-008, 7 days + ラウンド1/2). Default scenario (decision D5).
 *
 * One run = 選抜試験 + 本戦 (D21). Schedule facts: docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md
 * § Surprises (H.I.F. structure, from wikiwiki HIF/基本情報 2026-09-13 and 学マスwiki H.I.F).
 * Counts: user's route answers of 2026-09-19 through route-profiles.html (D21–D24); the
 * "choices" and "params" comments record the inputs the counts were derived from
 * (revised answer of 2026-09-19: 相談 削除 totals 2/2/5, 元気効果 12, third profile named).
 * パラメータボーナス base is a function of how many lessons train the stat and of
 * the stat's share of the 選抜試験's distributed rewards (see `bonusBase`; under the
 * default share 2:7:1, 7 of 8 lessons → 1021, 1 of 8 → 799, 0 → 420), decisions
 * D24–D26 and A3 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md.
 * 極振りコンテ育成 (user, 2026-09-29): all eight lessons on one stat, the 選抜試験's
 * score sent mostly to one of the two others (default share 1:9:0), and otherwise
 * the counts of 汎用コンテ育成; under 1:9:0 the bases are 1050 for the trained stat,
 * 820 for the sub and 370 for the other.
 * Both コンテ育成 profiles ship 所持スキルカード20枚以上 at a lesson's end as met 0 times
 * (user, 2026-10-05): the first condition a shipped profile lowers (decision C7 of
 * docs/plans/EXECPLAN_COUNTING_MODEL.md).
 */

import type { LessonSplit, RouteProfile, Scenario } from "../../src/engine/types.ts";

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
 * 極振り presets: all eight lessons on one stat, and since the two untrained stats
 * tie, each preset names the one the 選抜試験's sub share goes to (`sub`), so a card
 * of either untrained stat can be scored as the sub.
 */
export const EXTREME_LESSON_SPLITS: readonly LessonSplit[] = [
  { vocal: 8, dance: 0, visual: 0, sub: "dance" },
  { vocal: 8, dance: 0, visual: 0, sub: "visual" },
  { vocal: 0, dance: 8, visual: 0, sub: "vocal" },
  { vocal: 0, dance: 8, visual: 0, sub: "visual" },
  { vocal: 0, dance: 0, visual: 8, sub: "vocal" },
  { vocal: 0, dance: 0, visual: 8, sub: "dance" },
];

/**
 * Parameter a stat gains over the run from the sources パラメータボーナス+ multiplies,
 * for a stat trained by `n` of the 8 lessons that takes `share` (0–1) of the
 * 選抜試験's distributed rewards:
 *   800 × n/8         SP公開レッスン gains to the selected stat (60+80+80+100+100+120 in 選抜試験, 120+140 in 本戦)
 *   340 × (8 − n)/16  the sub-parameter each other lesson gives a non-selected stat, half to each of the two
 *   200               選抜試験 base rewards every stat gets (20 + 80 + 100 on days 7, 13, 20)
 *   500 × share       選抜試験 distributed rewards (80 + 200 + 220), shared by exam score — the player's
 *                     audition share (default 2:7:1 for main / sub / other; decision A3), which replaced
 *                     the lesson share n/8 that stood in for it until 2026-09-28
 * 本戦 rounds give no parameter and 授業 gains are not multiplied by the bonus, so neither appears.
 */
export function bonusBase(n: number, share: number): number {
  return Math.round((800 * n) / LESSONS + (340 * (LESSONS - n)) / (2 * LESSONS) + 200 + 500 * share);
}

const GENERIC_CONTEST: RouteProfile = {
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
  // A contest deck is kept thin by deletion, so it never holds 20 skill cards at a lesson's end (user, 2026-10-05; decision C7 of docs/plans/EXECPLAN_COUNTING_MODEL.md).
  conditions: { "EndLesson.produce_card_count.ge20": 0 },
};

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
    GENERIC_CONTEST,
    { ...GENERIC_CONTEST, id: "extreme-contest", name: "極振りコンテ育成", lessonSplits: EXTREME_LESSON_SPLITS, auditionShare: [1, 9, 0] },
  ],
};
