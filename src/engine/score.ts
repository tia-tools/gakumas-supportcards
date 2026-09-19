/**
 * Scoring engine (ADR 0001; plan decisions D1, D4, D10–D17, D25, D26). Pure
 * functions, no DOM, no I/O: every dependency (taxonomy, level limits, route
 * profile, lesson split) is passed in.
 *
 * A card's 点数 at 凸k under a lesson split is the sum over the effects active
 * at level `levelFor(rarity, k)` of:
 *   skill, flat        value × min(cap, routeCount(category), split[triggerStat])
 *   skill, bonus (%)   value / 1000 × profile.parameterBonusBase(split[stat])
 *   event              value × (1 + eventBonusPermil / 1000)
 *   item               value × min(fireLimit, routeCount(category), split[triggerStat])
 * where a missing cap means unlimited, the split cap applies only to lesson-end
 * triggers bound to one stat, and a category the profile does not name counts
 * 0 (extension rows fall back to their `countsAs` game row). `scoreBest` takes
 * the profile's preset split that gives the card the highest total.
 */

import { EVENT_CATEGORY_ID, type BreakdownLine, type Breakpoint, type Card, type ClassifiedEffect, type LessonSplit, type LevelLimits, type Rarity, type RouteProfile, type Score, type Stat, type TaxonomyRow, type Totsu } from "./types.ts";

/** The game's パラメータボーナス+ row; its values are tenths of a percent. */
export const PARAMETER_BONUS_CATEGORY_ID = "s_card_p_skill_filter-vocalgrowthrateaddition-p_trigger-produce_start-no_description";
export const EVENT_CATEGORY_TITLE = "サポートイベント";

export interface ScoreContext {
  profile: RouteProfile;
  taxonomy: ReadonlyMap<string, TaxonomyRow>;
  limits: LevelLimits;
  lessons: LessonSplit;
}

export function levelFor(limits: LevelLimits, rarity: Rarity, totsu: Totsu): number {
  return limits[rarity][totsu];
}

/** The card's breakpoint in force at `level` (the last one with minLevel <= level). */
export function resolveAtLevel(card: Card, level: number): Breakpoint {
  let found: Breakpoint | undefined;
  for (const bp of card.breakpoints) {
    if (bp.minLevel > level) break;
    found = bp;
  }
  return found ?? { minLevel: level, effects: [], eventBonusPermil: 0 };
}

/** Occurrences per run of a category under the profile, honouring `countsAs`. */
export function routeCount(profile: RouteProfile, taxonomy: ReadonlyMap<string, TaxonomyRow>, categoryId: string): number {
  const direct = profile.counts[categoryId];
  if (direct !== undefined) return direct;
  const alias = taxonomy.get(categoryId)?.countsAs;
  return alias === undefined ? 0 : (profile.counts[alias] ?? 0);
}

/** Occurrences per run: the category's route count, capped by the split's lessons of the trigger's stat and by the effect's own cap. */
function occurrences(effect: ClassifiedEffect, ctx: ScoreContext): number {
  let n = routeCount(ctx.profile, ctx.taxonomy, effect.categoryId);
  if (effect.triggerStat) n = Math.min(n, ctx.lessons[effect.triggerStat]);
  return effect.cap ? Math.min(effect.cap, n) : n;
}

function titleOf(taxonomy: ReadonlyMap<string, TaxonomyRow>, categoryId: string): string {
  if (categoryId === EVENT_CATEGORY_ID) return EVENT_CATEGORY_TITLE;
  return taxonomy.get(categoryId)?.title ?? categoryId;
}

function lineFor(effect: ClassifiedEffect, bp: Breakpoint, ctx: ScoreContext): BreakdownLine {
  const title = titleOf(ctx.taxonomy, effect.categoryId);
  const base = { categoryId: effect.categoryId, title, stat: effect.stat, value: effect.value };
  if (effect.kind === "event") {
    const factor = 1000 + bp.eventBonusPermil;
    return { ...base, kind: "event", count: factor, points: (effect.value * factor) / 1000 };
  }
  if (effect.kind === "item") {
    const n = occurrences(effect, ctx);
    const line: BreakdownLine = { ...base, kind: "item", count: n, points: effect.value * n };
    if (effect.itemName !== undefined) line.itemName = effect.itemName;
    return line;
  }
  if (effect.categoryId === PARAMETER_BONUS_CATEGORY_ID) {
    const gain = ctx.profile.parameterBonusBase(ctx.lessons[effect.stat]);
    return { ...base, kind: "bonus", count: gain, points: (effect.value * gain) / 1000 };
  }
  const n = occurrences(effect, ctx);
  return { ...base, kind: "skill", count: n, points: effect.value * n };
}

export function scoreAtLevel(card: Card, level: number, ctx: ScoreContext): Score {
  const bp = resolveAtLevel(card, level);
  const lines = bp.effects.map((e) => lineFor(e, bp, ctx));
  const byStat: Record<Stat, number> = { vocal: 0, dance: 0, visual: 0 };
  const parts = { skills: 0, events: 0, items: 0 };
  for (const l of lines) {
    byStat[l.stat] += l.points;
    if (l.kind === "event") parts.events += l.points;
    else if (l.kind === "item") parts.items += l.points;
    else parts.skills += l.points;
  }
  return { total: byStat.vocal + byStat.dance + byStat.visual, byStat, parts, lines, lessons: ctx.lessons };
}

export function score(card: Card, totsu: Totsu, ctx: ScoreContext): Score {
  return scoreAtLevel(card, levelFor(ctx.limits, card.rarity, totsu), ctx);
}

/** The score under whichever of the profile's lesson-split presets gives the card the highest total (first preset wins ties). */
export function scoreBest(card: Card, totsu: Totsu, ctx: Omit<ScoreContext, "lessons">): Score {
  let best: Score | undefined;
  for (const lessons of ctx.profile.lessonSplits) {
    const s = score(card, totsu, { ...ctx, lessons });
    if (!best || s.total > best.total) best = s;
  }
  if (!best) throw new Error(`profile ${ctx.profile.id} has no lesson splits`);
  return best;
}

export function taxonomyMap(rows: readonly TaxonomyRow[]): ReadonlyMap<string, TaxonomyRow> {
  return new Map(rows.map((r) => [r.id, r]));
}
