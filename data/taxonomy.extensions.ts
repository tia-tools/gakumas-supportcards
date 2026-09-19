/**
 * Hand-maintained taxonomy rows for triggers that the game's own filter table
 * (`SupportCardProduceSkillFilter.yaml`) does not cover — decision D13 in
 * docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md and the 2026-09-17 addendum
 * to docs/adr/0002.
 *
 * Rules:
 * - Same shape as a game row. `produceTriggerIds` match an effect's trigger id
 *   verbatim or as a `-`-delimited prefix of it (D14).
 * - `title` uses the game's own skill/item wording.
 * - `countsAs` names the game row whose route-profile count this row shares;
 *   omit it when the trigger is a genuinely new category the profile must count.
 * - Every entry cites what needs it. `bun run generate` fails when a game row
 *   comes to cover one of these triggers: delete the entry then.
 */

export interface ExtensionRow {
  id: string;
  title: string;
  order: number;
  produceEffectTypes: readonly string[];
  produceTriggerIds: readonly string[];
  countsAs?: string;
}

const PARAM_ADDITIONS = ["ProduceEffectType_VocalAddition", "ProduceEffectType_DanceAddition", "ProduceEffectType_VisualAddition"] as const;

export const TAXONOMY_EXTENSIONS: readonly ExtensionRow[] = [
  {
    // s_card-3-0103 次の曲は～ッあの曲だ！！ (2026-09-16)
    id: "ext-vocaladdition-p_trigger-get_produce_card-produce_card_search_count-exam_review-0008",
    title: "スキルカード獲得時、所持している好印象効果のスキルカードが8枚以上の場合パラメータ上昇",
    order: 101,
    produceEffectTypes: PARAM_ADDITIONS,
    produceTriggerIds: ["p_trigger-get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_review-000-0008_0000"],
    countsAs: "s_card_p_skill_filter-vocaladdition-p_trigger-get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_review-000",
  },
  {
    // s_card-3-0104 インタビューお願いします, s_card-3-0106 食レポ、得意かも！ (2026-09-16)
    id: "ext-vocaladdition-p_trigger-get_produce_card-produce_card_search_count-exam_preservation-0008",
    title: "スキルカード獲得時、所持している温存効果のスキルカードが8枚以上の場合パラメータ上昇",
    order: 102,
    produceEffectTypes: PARAM_ADDITIONS,
    produceTriggerIds: ["p_trigger-get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_preservation-000-0008_0000"],
    countsAs: "s_card_p_skill_filter-vocaladdition-p_trigger-get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_preservation-000",
  },
  {
    // s_card-3-0107 大切な思い出、またひとつ (2026-09-16)
    id: "ext-vocaladdition-p_trigger-get_produce_card-produce_card_search_count-exam_lesson_buff-0008",
    title: "スキルカード獲得時、所持している集中効果のスキルカードが8枚以上の場合パラメータ上昇",
    order: 103,
    produceEffectTypes: PARAM_ADDITIONS,
    produceTriggerIds: ["p_trigger-get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_lesson_buff-000-0008_0000"],
    countsAs: "s_card_p_skill_filter-vocaladdition-p_trigger-get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_lesson_buff-000",
  },
  {
    // s_card-3-0108 風紀が乱れるぞ！ (2026-09-16); the game table has only the Pドリンク variant (order 29)
    id: "ext-vocaladdition-p_trigger-buy_shop_item_produce_card",
    title: "相談でスキルカード交換後パラメータ上昇",
    order: 104,
    produceEffectTypes: PARAM_ADDITIONS,
    produceTriggerIds: ["p_trigger-buy_shop_item_produce_card"],
  },
  {
    // P-items 打倒！墾田永年私財法, 手作りのご褒美, お姉さま大百科 (fire before every audition once the stat is ≥ 400)
    id: "ext-vocaladdition-p_trigger-end_before_audition_refresh",
    title: "試験・オーディション前の休憩後パラメータ上昇",
    order: 105,
    produceEffectTypes: PARAM_ADDITIONS,
    produceTriggerIds: ["p_trigger-end_before_audition_refresh"],
  },
  {
    // P-item ドキドキ目隠し: any-stat SP lesson end; the game table lists `lesson_sp` only under the stamina-recovery row
    id: "ext-vocaladdition-p_trigger-end_lesson-lesson_sp",
    title: "SPレッスン終了時パラメータ上昇",
    order: 106,
    produceEffectTypes: PARAM_ADDITIONS,
    produceTriggerIds: ["p_trigger-end_lesson-lesson_sp"],
    countsAs: "s_card_p_skill_filter-vocaladdition-p_trigger-end_lesson-lesson_vocal_sp",
  },
];
