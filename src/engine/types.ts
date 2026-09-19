/**
 * Engine types shared by the generated data (`data/*.generated.ts`), the
 * scoring engine (`src/engine/`) and the UI. No DOM, no I/O.
 *
 * Vocabulary (see docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md § Context):
 * a card's skills change value at certain card levels ("breakpoints"); a 凸
 * (limit break, 0–4) sets the card's maximum level; a category is a row of
 * the effect taxonomy (the game's filter table plus our extension rows).
 */

export type Stat = "vocal" | "dance" | "visual";
export type CardType = Stat | "assist";
export type Rarity = "r" | "sr" | "ssr";
export type Plan = "common" | "sense" | "logic" | "anomaly";
export type Totsu = 0 | 1 | 2 | 3 | 4;
export type EffectKind = "skill" | "event" | "item";

/** Pseudo category id used by event parameter rewards, which have no trigger. */
export const EVENT_CATEGORY_ID = "event";

export interface ClassifiedEffect {
  /** Taxonomy row id (game row, `ext-` extension row, or EVENT_CATEGORY_ID). */
  categoryId: string;
  stat: Stat;
  /** Flat points, or tenths of a percent for パラメータボーナス+ (85 = 8.5%). */
  value: number;
  kind: EffectKind;
  /**
   * Per-run cap on occurrences: `ProduceSkill.activationCount` for skills,
   * `ProduceItem.fireLimit` for items. Absent or 0 = unlimited (D15, D16).
   */
  cap?: number;
  /** Items only: the granting P-item, for the breakdown label. */
  itemId?: string;
  itemName?: string;
}

export interface Breakpoint {
  minLevel: number;
  effects: ClassifiedEffect[];
  /** Own-event parameter multiplier at this level in permil, 0 when none (D17). */
  eventBonusPermil: number;
}

export interface Card {
  id: string;
  name: string;
  assetId: string;
  type: CardType;
  rarity: Rarity;
  plan: Plan;
  /** Sorted by minLevel ascending; the first entry is the card at level 1. */
  breakpoints: Breakpoint[];
}

export interface TaxonomyRow {
  id: string;
  /** Category label as shown in game. */
  title: string;
  /** Game display order; extension rows use 100+. */
  order: number;
  source: "game" | "extension";
  /** Extension rows only: the game row whose route count this row shares. */
  countsAs?: string;
}

/** Card level at 凸0..凸4, per rarity. */
export type LevelLimits = Record<Rarity, readonly [number, number, number, number, number]>;
