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
  /**
   * Lesson-end triggers are per lesson stat in the game data (`lesson_vocal`,
   * `lesson_dance`, `lesson_visual`): the effect fires only after lessons of
   * that stat, so its count is capped by the route's lessons of that stat.
   * Absent for triggers that fire on any lesson (`lesson_sp`) and for
   * non-lesson triggers.
   */
  triggerStat?: Stat;
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

/** How many of a run's lessons train each stat; the three sum to the run's lesson count. */
export type LessonSplit = Readonly<Record<Stat, number>>;

/**
 * One way of playing a scenario (decision D2): how many times each taxonomy
 * category's trigger occurs in a run, which lesson splits a player may choose,
 * and how much parameter パラメータボーナス+ multiplies for a stat trained by a
 * given number of lessons (decisions D4, D25, D26).
 */
export interface RouteProfile {
  id: string;
  name: string;
  /** Category id → occurrences per run. Extension rows fall back to their `countsAs` row. Unlisted = 0. */
  counts: Readonly<Record<string, number>>;
  /**
   * Lesson-split presets the player chooses by deck build (D26). A lesson-end
   * effect bound to a stat fires at most `split[stat]` times; the table uses
   * the preset that scores the card best unless the user fixes one.
   */
  lessonSplits: readonly LessonSplit[];
  /**
   * Parameter a stat gains over one run from the sources パラメータボーナス+
   * multiplies (lessons, and audition rewards where the scenario applies the
   * bonus), given how many of the run's lessons train that stat. A bonus
   * effect converts as value / 1000 × this (decision D4).
   */
  parameterBonusBase(lessonsOfStat: number): number;
}

export interface Scenario {
  id: string;
  name: string;
  /**
   * The scenario's final parameter cap (D19), shown as scenario metadata. The
   * engine does not apply it: a 点数 is a card's marginal gain and the run's
   * base parameters are unknown, so clamping here would be wrong.
   */
  parameterCap: number;
  profiles: readonly RouteProfile[];
}

export interface ScoreParts {
  skills: number;
  events: number;
  items: number;
}

/** One line of the breakdown shown when hovering a number. */
export interface BreakdownLine {
  kind: EffectKind | "bonus";
  categoryId: string;
  title: string;
  stat: Stat;
  /** The effect's raw value: flat points, or tenths of a percent for `kind: "bonus"`. */
  value: number;
  /** Occurrences per run (skills, items), the bonus factor ×1000 (events), or the lesson gain (bonus). */
  count: number;
  points: number;
  itemName?: string;
}

export interface Score {
  total: number;
  byStat: Record<Stat, number>;
  parts: ScoreParts;
  lines: BreakdownLine[];
  /** The lesson split the score was computed under. */
  lessons: LessonSplit;
}
