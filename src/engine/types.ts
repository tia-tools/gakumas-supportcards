/**
 * Engine types shared by the generated data (`data/*.generated.ts`), the
 * scoring engine (`src/engine/`) and the UI. No DOM, no I/O.
 *
 * Vocabulary (see docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md § Context):
 * a card's skills change value at certain card levels ("breakpoints"); a 凸
 * (limit break, 0–4) sets the card's maximum level. How often an effect fires
 * is counted by occasion, filters and conditions (docs/adr/0004): something that
 * happens in a run, which of its occurrences qualify, and what state of the run
 * must hold at that moment.
 */

export type Stat = "vocal" | "dance" | "visual";
export type CardType = Stat | "assist";
export type Rarity = "r" | "sr" | "ssr";
export type Plan = "common" | "sense" | "logic" | "anomaly";
export type Totsu = 0 | 1 | 2 | 3 | 4;
export type EffectKind = "skill" | "event" | "item";

/**
 * Which occurrences of an occasion qualify (docs/adr/0004; decision C0 of
 * docs/plans/EXECPLAN_COUNTING_MODEL.md): a Vocal lesson, an SP lesson, a
 * mental skill card, an SSR card, a card named 「基本」, a 好印象 card.
 */
export const FILTER_FAMILIES = ["lessonStat", "lessonKind", "cardType", "rarity", "cardName", "effectGroup"] as const;
export type FilterFamily = (typeof FILTER_FAMILIES)[number];
export function isFilterFamily(x: string): x is FilterFamily {
  return FILTER_FAMILIES.some((f) => f === x);
}
export interface FilterRef {
  family: FilterFamily;
  member: string;
}

/**
 * A route profile's numbers for one filter family on one occasion (decision C3
 * of docs/plans/EXECPLAN_COUNTING_MODEL.md): a member's own count, else the
 * family default. A family without a default has no number for a member it does
 * not name, which the data checks report instead of guessing.
 */
export interface FilterCounts {
  default?: number;
  members?: Readonly<Record<string, number>>;
}

/** A state of the run that must hold when the occasion happens: a stat, stamina, or a number of held cards within a range. */
export interface ConditionRef {
  /** The game's own word: `vocal`, `stamina_ratio`, `produce_card_count`, `produce_card_search_count`, … */
  kind: string;
  /** `produce_card_search_count` only: which held cards are counted; absent = all of them. */
  subject?: FilterRef[];
  /** Inclusive bounds as written in the trigger id (`0500` for 50% stamina); 0 = unbounded on that side. */
  min: number;
  max: number;
}

/** A trigger id read as occasion, filters and conditions (decisions C1–C5, C10–C12 of the same plan). */
export interface ParsedTrigger {
  /** `ProduceTrigger.phaseType` without its `ProducePhaseType_` prefix, e.g. `EndLesson`. */
  occasion: string;
  filters?: FilterRef[];
  conditions?: ConditionRef[];
  /** Set when the trigger fires in one scenario only: that scenario's id here, or the game's token for one this site does not ship. */
  scenario?: string;
}

export interface ClassifiedEffect {
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
   * The effect's trigger as occasion, filters and conditions; absent for
   * `kind: "event"`, a card's own サポートイベント reward, which has no trigger.
   */
  trigger?: ParsedTrigger;
  /** True for パラメータボーナス+: `value` is tenths of a percent of the profile's bonus base, not points per occurrence. */
  bonus?: true;
}

/** A card the table must not show because one of its effects cannot be counted (docs/adr/0005). */
export interface HeldCard {
  id: string;
  name: string;
  /** One line per distinct cause, naming the trigger piece or effect type a person has to decide about. */
  reasons: string[];
}

export interface Breakpoint {
  minLevel: number;
  effects: ClassifiedEffect[];
  /** Own-event parameter multiplier at this level in permil, 0 when none (D17). */
  eventBonusPermil: number;
}

/**
 * A P-item one of the card's events grants, listed when the item has a countable
 * stat effect (those effects sit in the breakpoints with `itemId`) or grants
 * P-drinks (Milestone 3 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md, decisions
 * A8–A11). Level-independent: the deck tick assumes the card is at a level where
 * the item is granted (A17).
 */
export interface ItemGrant {
  itemId: string;
  itemName: string;
  /** The game's icon asset, e.g. `img_general_pitem_2-004` (Milestone 4 serves it). */
  assetId: string;
  /** `ProduceItem.fireLimit`; absent = unlimited. */
  cap?: number;
  /** Set when a fire grants P-drinks: how many, and on which trigger; the drinks raise the run's Pドリンク獲得 count for every card when the item is in the deck. */
  drinks?: { perFire: number; trigger: ParsedTrigger };
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
  /** P-items the card grants that count for something, sorted by item id; absent when none. */
  items?: readonly ItemGrant[];
  /**
   * The card has an SP発生率+ skill from level 1. It scores 0 (docs/adr/0001) and is
   * not among the effects; the page marks the card and can filter by it
   * (docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md, Milestone 1).
   */
  spRate?: true;
}

/** Card level at 凸0..凸4, per rarity. */
export type LevelLimits = Record<Rarity, readonly [number, number, number, number, number]>;

/** How many of a run's lessons train each stat; the three sum to the run's lesson count. */
export type LessonSplit = Readonly<Record<Stat, number>>;

/**
 * How the 選抜試験's distributed parameter rewards are shared by the main, sub and
 * remaining stat of a lesson split, in tenths summing to 10 — a player input, in
 * role terms so it applies under whichever preset scores a card (decisions A3–A5
 * of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md). `src/engine/share.ts` maps a stat
 * to its role.
 */
export type AuditionShare = readonly [number, number, number];
export const DEFAULT_AUDITION_SHARE: AuditionShare = [2, 7, 1];

/**
 * One way of playing a scenario (decision D2): how often each occasion happens
 * in a run and how many of those each filter and condition selects, which lesson
 * splits a player may choose, and how much parameter パラメータボーナス+ multiplies
 * for a stat trained by a given number of lessons (decisions D4, D25, D26).
 */
export interface RouteProfile {
  id: string;
  name: string;
  /** Occasion (the game's phase type, e.g. `EndLesson`) → times it happens in a run. Unlisted = 0. */
  occasions: Readonly<Record<string, number>>;
  /**
   * Occasion → filter family → how many of the occasion's occurrences the filter selects.
   * `lessonStat` never appears here: the lesson split carries it.
   */
  filters: Readonly<Record<string, Readonly<Partial<Record<FilterFamily, FilterCounts>>>>>;
  /**
   * Condition key (`conditionKey` in src/engine/count.ts) → how many of the occasion's
   * occurrences meet the condition. A condition not named here is met every time
   * (docs/adr/0001 addendum), which is what every shipped profile starts with.
   */
  conditions?: Readonly<Record<string, number>>;
  /**
   * Lesson-split presets the player chooses by deck build (D26). A lesson-end
   * effect bound to a stat fires at most `split[stat]` times; the table uses
   * the preset that scores the card best unless the user fixes one.
   */
  lessonSplits: readonly LessonSplit[];
  /**
   * Parameter a stat gains over one run from the sources パラメータボーナス+
   * multiplies (lessons, and audition rewards where the scenario applies the
   * bonus), given how many of the run's lessons train that stat and the stat's
   * fraction (0–1) of the exam's distributed rewards (`shareOf` in
   * src/engine/share.ts). A bonus effect converts as value / 1000 × this
   * (decision D4; the share: decision A3 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md).
   * A scenario whose formula has no exam term ignores the second argument.
   */
  parameterBonusBase(lessonsOfStat: number, auditionShare: number): number;
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
  stat: Stat;
  /** The effect's raw value: flat points, or tenths of a percent for `kind: "bonus"`. */
  value: number;
  /** Occurrences per run (skills, items), the bonus factor ×1000 (events), or the lesson gain (bonus). */
  count: number;
  points: number;
  itemName?: string;
  /** The effect's trigger, from which the page words the line; absent for events. */
  trigger?: ParsedTrigger;
}

export interface Score {
  total: number;
  byStat: Record<Stat, number>;
  parts: ScoreParts;
  lines: BreakdownLine[];
  /** The lesson split the score was computed under. */
  lessons: LessonSplit;
  /** The audition share the bonus lines were computed under. */
  share: AuditionShare;
}
