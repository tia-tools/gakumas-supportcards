/**
 * The skill card data this site publishes for tia-tools/gkms-memomemo, served at
 * https://gakumas-supportcards.tia.run/data/skillcards.v1.json (docs/adr/0010, addendum
 * 2026-10-31). `bun run build` writes it into dist/ from data/skillcards.generated.ts
 * (vite.config.ts), which `bun run generate` writes from the upstream tables
 * (scripts/lib/build-skillcards.ts).
 *
 * The file is a contract: gkms-memomemo copies the types below verbatim, so this module imports
 * nothing. A change to the shape of the file or of any type here bumps
 * `SKILLCARD_DATA_FORMAT_VERSION`, and with it the file name, so a new format can be published
 * beside the old one. Plan: docs/plans/EXECPLAN_SKILLCARD_DATA_AND_ICONS.md.
 */

export const SKILLCARD_DATA_FORMAT_VERSION = 1;

/** Where the file sits under dist/, hence its path on the site. */
export const SKILLCARD_DATA_PATH = `data/skillcards.v${SKILLCARD_DATA_FORMAT_VERSION}.json`;

/** センス, ロジック, アノマリー, or a card of no plan (ProducePlanType_Plan1, Plan2, Plan3, Common). */
export type SkillCardPlan = "sense" | "logic" | "anomaly" | "free";
/** Legend is listed although the pool excludes Legend cards today. */
export type SkillCardRarity = "N" | "R" | "SR" | "SSR" | "Legend";
/** アクティブ or メンタル. */
export type SkillCardType = "active" | "mental";

/** A playable P-idol: the game's character id (`hski`) and full name (花海咲季). */
export interface Idol {
  id: string;
  name: string;
}

/**
 * One step of a customization kind: its `customizeCount` and its Japanese label, the step's own
 * description when the game gives one (好調追加), else the generic label of its grow effect
 * (好調+). A label may contain a line break where the game breaks it (パラメータ⏎上昇回数+).
 */
export interface CustomizationStep {
  step: number;
  label: string;
}

/** One customization kind of a card: a ProduceCardCustomize id and its steps, in step order. */
export interface CustomizationKind {
  id: string;
  steps: readonly CustomizationStep[];
}

/**
 * One skill card at one upgrade level: a ProduceCard id at upgradeCount 0 (base) or 1 (+).
 * The pool is every released card that can be a produce memory (gkms-memomemo decisions D8,
 * D37, D38): P-idol unique, support-card event, starter (except level 0 of 表現の基本), trouble
 * and Legend cards are left out.
 */
export interface SkillCard {
  id: string;
  upgrade: number;
  /** As the game writes it at that level (成就+). */
  name: string;
  plan: SkillCardPlan;
  rarity: SkillCardRarity;
  type: SkillCardType;
  /** The game's sort key: sorting these strings gives the game's order. */
  order: string;
  /** Labels of the game's guide categories that list this card, in the order the categories are listed. */
  guideLabels: readonly string[];
  /**
   * The icon: `asset` is the game's asset id (img_general_skillcard_act-3_029). When `perIdol`,
   * each playable idol has a variant named `<asset>-<idol id>`; otherwise the one image is `<asset>`.
   */
  art: { asset: string; perIdol: boolean };
  /** `limit` is the card's maxCustomizeCount; a base card has `{ limit: 0, kinds: [] }`. */
  customization: { limit: number; kinds: readonly CustomizationKind[] };
}

/** An H.I.F. memory ability (a MemoryAbility id) and the ProduceCard id of the card it belongs to. */
export interface HifAbility {
  id: string;
  card: string;
}

export interface SkillCardDataFile {
  formatVersion: typeof SKILLCARD_DATA_FORMAT_VERSION;
  /** In the game's order (Character.order). */
  idols: readonly Idol[];
  /** In the game's order (by `order`, then id), base before + for each card. */
  cards: readonly SkillCard[];
  /** By id. */
  hifAbilities: readonly HifAbility[];
}

/** The file's text: deterministic, since it depends only on the generated data (no timestamps). */
export function skillCardDataJson(data: SkillCardDataFile): string {
  return JSON.stringify(data);
}
