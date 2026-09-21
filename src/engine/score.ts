/**
 * Scoring engine (ADR 0001, ADR 0004; plan decisions D1, D4, D10–D17, D25, D26).
 * Pure functions, no DOM, no I/O: every dependency (level limits, scenario,
 * route profile, lesson split) is passed in.
 *
 * A card's 点数 at 凸k under a lesson split is the sum over the effects active
 * at level `levelFor(rarity, k)` of:
 *   skill or item, flat   value × occurrences(effect)            (src/engine/count.ts)
 *   bonus (%)             value / 1000 × profile.parameterBonusBase(split[stat])
 *   event                 value × (1 + eventBonusPermil / 1000)
 * where `occurrences` counts the effect's occasion narrowed by its filters and
 * stated conditions and capped by the effect's own per-run cap. `scoreBest`
 * takes the profile's preset split that gives the card the highest total.
 */

import { occurrences } from "./count.ts";
import type { BreakdownLine, Breakpoint, Card, ClassifiedEffect, LessonSplit, LevelLimits, Rarity, RouteProfile, Score, Stat, Totsu } from "./types.ts";

export interface ScoreContext {
  /** The scenario being scored: a trigger restricted to another scenario counts 0. */
  scenarioId: string;
  profile: RouteProfile;
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

function lineFor(effect: ClassifiedEffect, bp: Breakpoint, ctx: ScoreContext): BreakdownLine {
  const base = { stat: effect.stat, value: effect.value };
  if (effect.kind === "event") {
    const factor = 1000 + bp.eventBonusPermil;
    return { ...base, kind: "event", count: factor, points: (effect.value * factor) / 1000 };
  }
  const line: BreakdownLine = { ...base, kind: effect.kind, count: 0, points: 0 };
  if (effect.trigger) line.trigger = effect.trigger;
  if (effect.itemName !== undefined) line.itemName = effect.itemName;
  if (effect.bonus) {
    const gain = ctx.profile.parameterBonusBase(ctx.lessons[effect.stat]);
    return { ...line, kind: "bonus", count: gain, points: (effect.value * gain) / 1000 };
  }
  const n = occurrences(effect, ctx);
  return { ...line, count: n, points: effect.value * n };
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
