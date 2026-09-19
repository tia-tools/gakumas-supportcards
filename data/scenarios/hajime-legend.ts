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
 * PROVISIONAL (2026-09-19): counts marked "guess" are the agent's estimates. They will be
 * replaced once the user answers a 初LEGEND route sheet like the H.I.F. one.
 */

import type { LessonSplit, Scenario } from "../../src/engine/types.ts";

const F = "s_card_p_skill_filter-vocaladdition-p_trigger-";

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
      counts: {
        [`${F}produce_start-initial`]: 1, // 初期パラメータ上昇
        [`${F}end_lesson-lesson_vocal`]: 5, // レッスン終了時 (5 レジェンドレッスン)
        [`${F}end_lesson-lesson_vocal_normal`]: 0, // 通常レッスン終了時 (D4: every lesson is SP)
        [`${F}end_lesson-lesson_vocal_sp`]: 5, // SPレッスン終了時
        [`${F}end_lesson-lesson_sp-produce_card_count-0020_0000`]: 5, // SPレッスン終了時 20枚以上 (D10)
        [`${F}end_step_event_school`]: 4, // 授業・営業終了時 (weeks 1, 2, 6, 15)
        [`${F}end_audition`]: 2, // 試験・オーディション終了時 (中間, 最終; D20)
        [`${F}end_audition-produce_card_search_count-p_card_search-deck_all-0015_0000`]: 2, // (D10)
        [`${F}start_present`]: 4, // 活動支給・差し入れ選択時 — guess: 活動支給 on all 4 shared slots
        [`${F}end_step_event_activity`]: 0, // おでかけ終了時 — guess: shares slots with 活動支給 (see above)
        [`${F}start_shop`]: 4, // 相談選択時 (weeks 5, 8, 13, 17) — guess: all taken
        [`${F}buy_shop_item_produce_drink`]: 4, // 相談でPドリンク交換後 — guess
        [`${F}start_refresh`]: 0, // 休む選択時 — guess
        [`${F}get_produce_drink`]: 8, // Pドリンク獲得時 — guess (活動支給 4 + 相談 4)
        [`${F}start_customize`]: 1, // 特別指導開始時 — week 9 (week 17 shares with 相談)
        [`${F}customize_produce_card`]: 2, // スキルカードカスタマイズ時 — 2 per 特別指導
        [`${F}get_produce_item`]: 2, // Pアイテム獲得時 — guess (中間試験後 item + 1)
        [`${F}upgrade_produce_card-0000_0000-p_card_search-deck_all`]: 3, // スキルカード強化時 — guess
        [`${F}upgrade_produce_card-0000_0000-p_card_search-mental_skill-deck_all`]: 3, // guess
        [`${F}upgrade_produce_card-0000_0000-p_card_search-active_skill-deck_all`]: 3, // guess
        [`${F}delete_produce_card-0000_0000-p_card_search-deck_all`]: 3, // スキルカード削除時 — guess
        [`${F}delete_produce_card-0000_0000-p_card_search-mental_skill-deck_all`]: 3, // guess
        [`${F}delete_produce_card-0000_0000-p_card_search-active_skill-deck_all`]: 3, // guess
        [`${F}change_produce_card`]: 2, // スキルカードチェンジ時 — guess
        [`${F}change_produce_card-p_card_search-deck_all-starter`]: 2, // guess
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all`]: 12, // スキルカード獲得時 — guess (授業 4 + 活動支給 4 + 相談 4)
        [`${F}get_produce_card-0000_0000-p_card_search-mental_skill-deck_all`]: 8, // guess
        [`${F}get_produce_card-0000_0000-p_card_search-active_skill-deck_all`]: 4, // guess
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_parameter_buff-000`]: 6, // guess
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_lesson_buff-000`]: 6, // guess
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_card_play_aggressive-000`]: 6, // guess
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_review-000`]: 6, // guess
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_concentration-000`]: 6, // guess
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_full_power-000`]: 6, // guess
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_preservation-000`]: 6, // guess
        [`${F}get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_block-000`]: 6, // guess
        [`${F}get_produce_card-p_card_search-ssr-deck_all-1`]: 4, // guess
        "ext-vocaladdition-p_trigger-buy_shop_item_produce_card": 2, // 相談でスキルカード交換後 — guess
        "ext-vocaladdition-p_trigger-end_before_audition_refresh": 2, // 試験前の休憩後 (中間, 最終; 試験前回復 70%)
      },
    },
  ],
};
