/**
 * The audit of the game's `ProduceEffectType` values: which carry a Vocal, Dance
 * or Visual gain the site scores, and which are known to carry none. A type in
 * neither list is not guessed at: the card builder holds the card
 * (docs/adr/0005). Pure data, no I/O.
 */

import type { Stat } from "../../src/engine/types.ts";

/**
 * Audited effect types that carry no parameter value (or are handled elsewhere,
 * like the own-event bonus). Any other type that is not listed below as a
 * parameter type holds its card, so a new parameter-bearing type the game adds
 * cannot vanish silently.
 */
export const NON_PARAMETER_EFFECT_TYPES: ReadonlySet<string> = new Set([
  // SP発生率+, スタミナ, Pポイント, 相談割引; score 0 per ADR 0001.
  "ProduceEffectType_LessonSpChangeRatePermilAddition",
  "ProduceEffectType_LessonVocalSpChangeRatePermilAddition",
  "ProduceEffectType_LessonDanceSpChangeRatePermilAddition",
  "ProduceEffectType_LessonVisualSpChangeRatePermilAddition",
  "ProduceEffectType_LessonPresentProducePointUp",
  "ProduceEffectType_MaxStaminaAddition",
  "ProduceEffectType_ProducePointAdditionDisableTrigger",
  "ProduceEffectType_ShopProduceDrinkPriceDiscountMultiple",
  "ProduceEffectType_StaminaRecoverFix",
  "ProduceEffectType_SupportCardProduceCardUpgradeProbabilityUp", // スキルカード強化確率 (every card)
  "ProduceEffectType_SupportCardEventProducePointAdditionValueUp", // own-event P-point bonus
  "ProduceEffectType_SupportCardEventStaminaRecoverUp", // own-event stamina bonus
  "ProduceEffectType_ProducePointAddition",
  "ProduceEffectType_ProduceReward", // item / card / drink grant (events handle the item case themselves)
  "ProduceEffectType_ProduceRewardSet",
  "ProduceEffectType_ProduceCardUpgrade",
  "ProduceEffectType_ProduceCardChange",
  "ProduceEffectType_ProduceCardDelete",
  "ProduceEffectType_ProduceCardDuplicate",
  "ProduceEffectType_ShopPriceDiscountMultiple",
  "ProduceEffectType_CustomizeProduceCardProducePointDownMultiple",
]);

/** Own-card event parameter multiplier, permil (500 = +50%). Handled as a modifier of the card's events (D17). */
export const EVENT_BONUS_EFFECT_TYPE = "ProduceEffectType_SupportCardEventParameterAdditionValueUp";

/** Flat points per occurrence. */
export const PARAM_ADDITION_TYPES: ReadonlySet<string> = new Set([
  "ProduceEffectType_VocalAddition",
  "ProduceEffectType_DanceAddition",
  "ProduceEffectType_VisualAddition",
]);

/** パラメータボーナス+: the value is tenths of a percent of the stat's gain over the run, not points per occurrence. */
export const PARAM_BONUS_TYPES: ReadonlySet<string> = new Set([
  "ProduceEffectType_VocalGrowthRateAddition",
  "ProduceEffectType_DanceGrowthRateAddition",
  "ProduceEffectType_VisualGrowthRateAddition",
]);

/** The stat of a parameter type (flat or bonus); null for every other type, however it is named. */
export function parameterStatOf(effectType: string): Stat | null {
  if (!PARAM_ADDITION_TYPES.has(effectType) && !PARAM_BONUS_TYPES.has(effectType)) return null;
  if (effectType.startsWith("ProduceEffectType_Vocal")) return "vocal";
  if (effectType.startsWith("ProduceEffectType_Dance")) return "dance";
  return "visual";
}
