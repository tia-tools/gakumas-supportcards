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

const F = "s_card_p_skill_filter-vocaladdition-p_trigger-";
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
      counts: {
        [`${F}produce_start-initial`]: 1, // 初期パラメータ上昇
        [`${F}end_lesson-lesson_vocal`]: 8, // レッスン終了時パラメータ上昇
        [`${F}end_lesson-lesson_vocal_normal`]: 0, // 通常レッスン終了時パラメータ上昇
        [`${F}end_lesson-lesson_vocal_sp`]: 8, // SPレッスン終了時パラメータ上昇
        [`${F}upgrade_produce_card-0000_0000-p_card_search-deck_all`]: 0, // スキルカード強化時パラメータ上昇
        [`${F}upgrade_produce_card-0000_0000-p_card_search-mental_skill-deck_all`]: 0, // メンタルスキルカード強化時パラメータ上昇
        [`${F}upgrade_produce_card-0000_0000-p_card_search-active_skill-deck_all`]: 0, // アクティブスキルカード強化時パラメータ上昇
        [`${F}delete_produce_card-0000_0000-p_card_search-deck_all`]: 6, // スキルカード削除時パラメータ上昇
        [`${F}delete_produce_card-0000_0000-p_card_search-mental_skill-deck_all`]: 6, // メンタルスキルカード削除時パラメータ上昇
        [`${F}delete_produce_card-0000_0000-p_card_search-active_skill-deck_all`]: 6, // アクティブスキルカード削除時パラメータ上昇
        [`${F}change_produce_card`]: 4, // スキルカードチェンジ時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all`]: 20, // スキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-mental_skill-deck_all`]: 13, // メンタルスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-active_skill-deck_all`]: 7, // アクティブスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_parameter_buff-000`]: 10, // 好調効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_lesson_buff-000`]: 10, // 集中効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_card_play_aggressive-000`]: 10, // やる気効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_review-000`]: 14, // 好印象効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_concentration-000`]: 10, // 強気効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_full_power-000`]: 10, // 全力効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_full_power-000-0008_0000`]: 10, // 全力効果のスキルカードが8枚以上の場合の獲得時 — same count as the unconditional row above (D13, D10)
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_preservation-000`]: 10, // 温存効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_preservation-000-0008_0000`]: 10, // 温存効果のスキルカードが8枚以上の場合の獲得時 — same count as the unconditional row above (D13, D10)
        [`${F}end_step_event_school`]: 6, // 授業・営業終了時パラメータ上昇
        [`${F}end_audition`]: 5, // 試験・オーディション終了時パラメータ上昇
        [`${F}start_present`]: 5, // 活動支給・差し入れ選択時パラメータ上昇
        [`${F}end_step_event_activity`]: 1, // おでかけ終了時パラメータ上昇
        [`${F}start_shop`]: 3, // 相談選択時パラメータ上昇
        [`${F}buy_shop_item_produce_drink`]: 8, // 相談でPドリンク交換後パラメータ上昇
        [`${F}start_refresh`]: 0, // 休む選択時パラメータ上昇
        [`${F}get_produce_drink`]: 16, // Pドリンク獲得時パラメータ上昇
        [`${F}customize_produce_card`]: 2, // スキルカードカスタマイズ時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_block-000`]: 12, // 元気効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-p_card_search-ssr-deck_all-1`]: 10, // スキルカード（SSR）獲得時パラメータ上昇
        [`${F}get_produce_item`]: 3, // Pアイテム獲得時パラメータ上昇
        [`${F}end_lesson-lesson_sp-produce_card_count-0020_0000`]: 8, // SPレッスン終了時所持スキルカードが20枚以上の場合パラメータ上昇
        [`${F}start_customize`]: 0, // 特別指導開始時パラメータ上昇
        [`${F}change_produce_card-p_card_search-deck_all-starter`]: 4, // 名前に「基本」を含むスキルカードチェンジ時パラメータ上昇
        [`${F}end_audition-produce_card_search_count-p_card_search-deck_all-0015_0000`]: 5, // 試験・オーディション終了時所持スキルカードが15枚以上の場合パラメータ上昇
        [`${F}buy_shop_item_produce_card`]: 2, // 相談でスキルカード交換後パラメータ上昇
        "ext-vocaladdition-p_trigger-end_before_audition_refresh": 4, // 試験・オーディション前の休憩後パラメータ上昇
      },
    },
    {
      id: "odekake",
      name: "おでかけ育成",
      // choices: s1=差し入れ s5=おでかけ s8=おでかけ s12=相談 s14=おでかけ s16=おでかけ s19=相談 h3=おでかけ
      // params: rest=0 shopDrinks=3 shopCards=0 shopUpgrades=0 shopDeletes=2 intervalCards=0 intervalChanges=0 intervalUpgrades=0 intervalDrinks=2 randomUpgrades=0 autoDeletes=4 items=3 bonusLessons=800 bonusAudition=700
      lessonSplits: LESSON_SPLITS,
      parameterBonusBase: bonusBase,
      counts: {
        [`${F}produce_start-initial`]: 1, // 初期パラメータ上昇
        [`${F}end_lesson-lesson_vocal`]: 8, // レッスン終了時パラメータ上昇
        [`${F}end_lesson-lesson_vocal_normal`]: 0, // 通常レッスン終了時パラメータ上昇
        [`${F}end_lesson-lesson_vocal_sp`]: 8, // SPレッスン終了時パラメータ上昇
        [`${F}upgrade_produce_card-0000_0000-p_card_search-deck_all`]: 0, // スキルカード強化時パラメータ上昇
        [`${F}upgrade_produce_card-0000_0000-p_card_search-mental_skill-deck_all`]: 0, // メンタルスキルカード強化時パラメータ上昇
        [`${F}upgrade_produce_card-0000_0000-p_card_search-active_skill-deck_all`]: 0, // アクティブスキルカード強化時パラメータ上昇
        [`${F}delete_produce_card-0000_0000-p_card_search-deck_all`]: 6, // スキルカード削除時パラメータ上昇
        [`${F}delete_produce_card-0000_0000-p_card_search-mental_skill-deck_all`]: 6, // メンタルスキルカード削除時パラメータ上昇
        [`${F}delete_produce_card-0000_0000-p_card_search-active_skill-deck_all`]: 6, // アクティブスキルカード削除時パラメータ上昇
        [`${F}change_produce_card`]: 4, // スキルカードチェンジ時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all`]: 20, // スキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-mental_skill-deck_all`]: 13, // メンタルスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-active_skill-deck_all`]: 7, // アクティブスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_parameter_buff-000`]: 10, // 好調効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_lesson_buff-000`]: 10, // 集中効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_card_play_aggressive-000`]: 10, // やる気効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_review-000`]: 14, // 好印象効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_concentration-000`]: 10, // 強気効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_full_power-000`]: 10, // 全力効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_full_power-000-0008_0000`]: 10, // 全力効果のスキルカードが8枚以上の場合の獲得時 — same count as the unconditional row above (D13, D10)
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_preservation-000`]: 10, // 温存効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_preservation-000-0008_0000`]: 10, // 温存効果のスキルカードが8枚以上の場合の獲得時 — same count as the unconditional row above (D13, D10)
        [`${F}end_step_event_school`]: 6, // 授業・営業終了時パラメータ上昇
        [`${F}end_audition`]: 5, // 試験・オーディション終了時パラメータ上昇
        [`${F}start_present`]: 1, // 活動支給・差し入れ選択時パラメータ上昇
        [`${F}end_step_event_activity`]: 5, // おでかけ終了時パラメータ上昇
        [`${F}start_shop`]: 3, // 相談選択時パラメータ上昇
        [`${F}buy_shop_item_produce_drink`]: 3, // 相談でPドリンク交換後パラメータ上昇
        [`${F}start_refresh`]: 0, // 休む選択時パラメータ上昇
        [`${F}get_produce_drink`]: 11, // Pドリンク獲得時パラメータ上昇
        [`${F}customize_produce_card`]: 2, // スキルカードカスタマイズ時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_block-000`]: 12, // 元気効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-p_card_search-ssr-deck_all-1`]: 10, // スキルカード（SSR）獲得時パラメータ上昇
        [`${F}get_produce_item`]: 3, // Pアイテム獲得時パラメータ上昇
        [`${F}end_lesson-lesson_sp-produce_card_count-0020_0000`]: 8, // SPレッスン終了時所持スキルカードが20枚以上の場合パラメータ上昇
        [`${F}start_customize`]: 0, // 特別指導開始時パラメータ上昇
        [`${F}change_produce_card-p_card_search-deck_all-starter`]: 4, // 名前に「基本」を含むスキルカードチェンジ時パラメータ上昇
        [`${F}end_audition-produce_card_search_count-p_card_search-deck_all-0015_0000`]: 5, // 試験・オーディション終了時所持スキルカードが15枚以上の場合パラメータ上昇
        [`${F}buy_shop_item_produce_card`]: 0, // 相談でスキルカード交換後パラメータ上昇
        "ext-vocaladdition-p_trigger-end_before_audition_refresh": 4, // 試験・オーディション前の休憩後パラメータ上昇
      },
    },
    {
      id: "generic-contest",
      name: "汎用コンテ育成",
      // choices: s1=差し入れ s5=おでかけ s8=差し入れ s12=相談 s14=差し入れ s16=相談 s19=相談 h3=差し入れ
      // params: rest=0 shopDrinks=0 shopCards=0 shopUpgrades=0 shopDeletes=5 intervalCards=0 intervalChanges=0 intervalUpgrades=0 intervalDrinks=2 randomUpgrades=0 autoDeletes=4 items=6 bonusLessons=800 bonusAudition=700
      lessonSplits: LESSON_SPLITS,
      parameterBonusBase: bonusBase,
      counts: {
        [`${F}produce_start-initial`]: 1, // 初期パラメータ上昇
        [`${F}end_lesson-lesson_vocal`]: 8, // レッスン終了時パラメータ上昇
        [`${F}end_lesson-lesson_vocal_normal`]: 0, // 通常レッスン終了時パラメータ上昇
        [`${F}end_lesson-lesson_vocal_sp`]: 8, // SPレッスン終了時パラメータ上昇
        [`${F}upgrade_produce_card-0000_0000-p_card_search-deck_all`]: 0, // スキルカード強化時パラメータ上昇
        [`${F}upgrade_produce_card-0000_0000-p_card_search-mental_skill-deck_all`]: 0, // メンタルスキルカード強化時パラメータ上昇
        [`${F}upgrade_produce_card-0000_0000-p_card_search-active_skill-deck_all`]: 0, // アクティブスキルカード強化時パラメータ上昇
        [`${F}delete_produce_card-0000_0000-p_card_search-deck_all`]: 9, // スキルカード削除時パラメータ上昇
        [`${F}delete_produce_card-0000_0000-p_card_search-mental_skill-deck_all`]: 9, // メンタルスキルカード削除時パラメータ上昇
        [`${F}delete_produce_card-0000_0000-p_card_search-active_skill-deck_all`]: 9, // アクティブスキルカード削除時パラメータ上昇
        [`${F}change_produce_card`]: 4, // スキルカードチェンジ時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all`]: 20, // スキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-mental_skill-deck_all`]: 13, // メンタルスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-active_skill-deck_all`]: 7, // アクティブスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_parameter_buff-000`]: 10, // 好調効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_lesson_buff-000`]: 10, // 集中効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_card_play_aggressive-000`]: 10, // やる気効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_review-000`]: 14, // 好印象効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_concentration-000`]: 10, // 強気効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_full_power-000`]: 10, // 全力効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_full_power-000-0008_0000`]: 10, // 全力効果のスキルカードが8枚以上の場合の獲得時 — same count as the unconditional row above (D13, D10)
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_preservation-000`]: 10, // 温存効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_preservation-000-0008_0000`]: 10, // 温存効果のスキルカードが8枚以上の場合の獲得時 — same count as the unconditional row above (D13, D10)
        [`${F}end_step_event_school`]: 6, // 授業・営業終了時パラメータ上昇
        [`${F}end_audition`]: 5, // 試験・オーディション終了時パラメータ上昇
        [`${F}start_present`]: 4, // 活動支給・差し入れ選択時パラメータ上昇
        [`${F}end_step_event_activity`]: 1, // おでかけ終了時パラメータ上昇
        [`${F}start_shop`]: 4, // 相談選択時パラメータ上昇
        [`${F}buy_shop_item_produce_drink`]: 0, // 相談でPドリンク交換後パラメータ上昇
        [`${F}start_refresh`]: 0, // 休む選択時パラメータ上昇
        [`${F}get_produce_drink`]: 7, // Pドリンク獲得時パラメータ上昇
        [`${F}customize_produce_card`]: 2, // スキルカードカスタマイズ時パラメータ上昇
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_block-000`]: 12, // 元気効果のスキルカード獲得時パラメータ上昇
        [`${F}get_produce_card-p_card_search-ssr-deck_all-1`]: 7, // スキルカード（SSR）獲得時パラメータ上昇
        [`${F}get_produce_item`]: 6, // Pアイテム獲得時パラメータ上昇
        [`${F}end_lesson-lesson_sp-produce_card_count-0020_0000`]: 8, // SPレッスン終了時所持スキルカードが20枚以上の場合パラメータ上昇
        [`${F}start_customize`]: 0, // 特別指導開始時パラメータ上昇
        [`${F}change_produce_card-p_card_search-deck_all-starter`]: 4, // 名前に「基本」を含むスキルカードチェンジ時パラメータ上昇
        [`${F}end_audition-produce_card_search_count-p_card_search-deck_all-0015_0000`]: 5, // 試験・オーディション終了時所持スキルカードが15枚以上の場合パラメータ上昇
        [`${F}buy_shop_item_produce_card`]: 0, // 相談でスキルカード交換後パラメータ上昇
        "ext-vocaladdition-p_trigger-end_before_audition_refresh": 4, // 試験・オーディション前の休憩後パラメータ上昇
      },
    },
  ],
};
