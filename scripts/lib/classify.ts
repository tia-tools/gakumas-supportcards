/**
 * Effect classification against the taxonomy (ADR 0002 + addendum; plan
 * decisions D13, D14). Pure: no I/O, no game-table access beyond what is
 * passed in.
 *
 * A (effect type, trigger id) pair classifies to the single taxonomy row that
 * lists the effect type and lists the trigger id verbatim; failing that, to the
 * row (listing the effect type) whose listed trigger id is the longest
 * `-`-delimited prefix of the trigger id. Two rows tying on the longest prefix
 * is an error, as is a pair that matches nothing and is not a known
 * non-parameter effect type.
 */

import type { Stat } from "../../src/engine/types.ts";
import type { ExtensionRow } from "../../data/taxonomy.extensions.ts";
import type { RawFilterRow } from "./tables.ts";

export interface TaxonomySource {
  id: string;
  title: string;
  order: number;
  produceEffectTypes: readonly string[];
  produceTriggerIds: readonly string[];
  source: "game" | "extension";
  countsAs?: string;
}

/**
 * Audited effect types that carry no parameter value (or are handled outside
 * the taxonomy, like the own-event bonus). A pair with one of these types is
 * skipped whether or not a taxonomy row lists it; any other type that is not
 * a Vocal/Dance/Visual effect fails classification, so a new parameter-bearing
 * type the game adds cannot vanish silently (ADR 0002 "fails loudly").
 */
export const NON_PARAMETER_EFFECT_TYPES: ReadonlySet<string> = new Set([
  // Listed by the game's filter table under non-parameter categories (SP発生率+, スタミナ, Pポイント, 相談割引); score 0 per ADR 0001.
  "ProduceEffectType_LessonSpChangeRatePermilAddition",
  "ProduceEffectType_LessonVocalSpChangeRatePermilAddition",
  "ProduceEffectType_LessonDanceSpChangeRatePermilAddition",
  "ProduceEffectType_LessonVisualSpChangeRatePermilAddition",
  "ProduceEffectType_LessonPresentProducePointUp",
  "ProduceEffectType_MaxStaminaAddition",
  "ProduceEffectType_ProducePointAdditionDisableTrigger",
  "ProduceEffectType_ShopProduceDrinkPriceDiscountMultiple",
  "ProduceEffectType_StaminaRecoverFix",
  // Not listed by any row.
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

/** Own-card event parameter multiplier, permil (500 = +50%). Handled as a modifier, not a category (D17). */
export const EVENT_BONUS_EFFECT_TYPE = "ProduceEffectType_SupportCardEventParameterAdditionValueUp";

export const PARAM_ADDITION_TYPES: ReadonlySet<string> = new Set([
  "ProduceEffectType_VocalAddition",
  "ProduceEffectType_DanceAddition",
  "ProduceEffectType_VisualAddition",
]);

/**
 * The lesson stat a lesson-end trigger is bound to (`p_trigger-end_lesson-lesson_vocal…`),
 * or null for any-stat lesson triggers (`…-lesson_sp…`) and non-lesson triggers.
 */
export function lessonStatOf(triggerId: string): Stat | null {
  const m = /^p_trigger-end_lesson-lesson_(vocal|dance|visual)(?:[_-]|$)/.exec(triggerId);
  if (!m) return null;
  return m[1] === "vocal" ? "vocal" : m[1] === "dance" ? "dance" : "visual";
}

export function statOf(effectType: string): Stat | null {
  if (effectType.startsWith("ProduceEffectType_Vocal")) return "vocal";
  if (effectType.startsWith("ProduceEffectType_Dance")) return "dance";
  if (effectType.startsWith("ProduceEffectType_Visual")) return "visual";
  return null;
}

export type Classification =
  | { kind: "classified"; row: TaxonomySource; stat: Stat; match: "exact" | "prefix" }
  | { kind: "non-parameter"; reason: "taxonomy-row-without-stat" | "whitelisted-type" }
  | { kind: "unclassified"; reason: "no-row" | "ambiguous" | "unknown-effect-type"; candidates: readonly TaxonomySource[] };

function coversAsPrefix(listed: string, triggerId: string): boolean {
  return triggerId.startsWith(`${listed}-`);
}

export function mergeTaxonomy(gameRows: readonly RawFilterRow[], extensions: readonly ExtensionRow[]): TaxonomySource[] {
  return [
    ...gameRows.map((r): TaxonomySource => ({ ...r, source: "game" })),
    ...extensions.map((r): TaxonomySource => ({ ...r, source: "extension" })),
  ];
}

export class Classifier {
  readonly rows: readonly TaxonomySource[];

  constructor(rows: readonly TaxonomySource[]) {
    this.rows = rows;
  }

  classify(effectType: string, triggerId: string): Classification {
    const byType = this.rows.filter((r) => r.produceEffectTypes.includes(effectType));
    const exact = byType.filter((r) => r.produceTriggerIds.includes(triggerId));
    if (exact.length > 1) return { kind: "unclassified", reason: "ambiguous", candidates: exact };
    const hit = exact[0] ? { row: exact[0], match: "exact" as const } : this.longestPrefix(byType, triggerId);
    if (!hit) {
      if (NON_PARAMETER_EFFECT_TYPES.has(effectType)) return { kind: "non-parameter", reason: "whitelisted-type" };
      return { kind: "unclassified", reason: "no-row", candidates: [] };
    }
    if ("candidates" in hit) return hit;
    const stat = statOf(effectType);
    if (stat) return { kind: "classified", row: hit.row, stat, match: hit.match };
    if (NON_PARAMETER_EFFECT_TYPES.has(effectType)) return { kind: "non-parameter", reason: "taxonomy-row-without-stat" };
    return { kind: "unclassified", reason: "unknown-effect-type", candidates: [hit.row] };
  }

  private longestPrefix(
    rows: readonly TaxonomySource[],
    triggerId: string,
  ): { row: TaxonomySource; match: "prefix" } | { kind: "unclassified"; reason: "ambiguous"; candidates: TaxonomySource[] } | null {
    let bestLen = -1;
    let best: TaxonomySource[] = [];
    for (const r of rows) {
      for (const t of r.produceTriggerIds) {
        if (!coversAsPrefix(t, triggerId)) continue;
        if (t.length > bestLen) {
          bestLen = t.length;
          best = [r];
        } else if (t.length === bestLen && !best.includes(r)) {
          best.push(r);
        }
      }
    }
    const [first] = best;
    if (!first) return null;
    if (best.length > 1) return { kind: "unclassified", reason: "ambiguous", candidates: best };
    return { row: first, match: "prefix" };
  }
}

export interface RedundantExtension {
  extensionId: string;
  triggerId: string;
  gameRowId: string;
  /** The game row's trigger id that now covers the extension's trigger. */
  gameTriggerId: string;
}

/**
 * Extension rows the game table has caught up with: a game row sharing an
 * effect type lists a trigger id equal to, or a `-`-delimited prefix of, the
 * extension's trigger id — i.e. the game row would now win classification for
 * that trigger. The generators leave such a row out (`liveExtensions`) and warn,
 * so that a data update never stops on it; delete the entry when you see the warning. A game row listing a *longer*
 * id (a conditional variant such as `…-lesson_sp-produce_card_count-0020_0000`)
 * is a different category and does not count.
 */
export function redundantExtensions(gameRows: readonly RawFilterRow[], extensions: readonly ExtensionRow[]): RedundantExtension[] {
  const out: RedundantExtension[] = [];
  for (const ext of extensions) {
    for (const g of gameRows) {
      if (!g.produceEffectTypes.some((t) => ext.produceEffectTypes.includes(t))) continue;
      for (const e of ext.produceTriggerIds) {
        for (const t of g.produceTriggerIds) {
          if (t === e || coversAsPrefix(t, e)) {
            out.push({ extensionId: ext.id, triggerId: e, gameRowId: g.id, gameTriggerId: t });
          }
        }
      }
    }
  }
  return out;
}

/** The extension rows still needed: those the game table has not caught up with (the game row wins, so an update never stops on this). */
export function liveExtensions(gameRows: readonly RawFilterRow[], extensions: readonly ExtensionRow[]): ExtensionRow[] {
  const redundant = new Set(redundantExtensions(gameRows, extensions).map((r) => r.extensionId));
  return extensions.filter((e) => !redundant.has(e.id));
}
