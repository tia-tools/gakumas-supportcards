/**
 * Table rows: every card scored at 凸0–凸4 under the chosen profile, overrides
 * and lesson split, then filtered and sorted (plan decisions D9, D10, D26).
 * Pure functions over the engine; the components only render what these return.
 */

import { score, scoreBest, type ScoreContext } from "../engine/score.ts";
import type { Card, CardType, Plan, Rarity, RouteProfile, Score, Totsu } from "../engine/types.ts";
import type { SortSpec } from "./url-state.ts";

export type ScoresByTotsu = readonly [Score, Score, Score, Score, Score];

export interface Row {
  card: Card;
  scores: ScoresByTotsu;
  /** The card has no parameter effect at any level (D10: listed last, tagged 「パラメータ効果なし」). */
  noParameterEffect: boolean;
}

export interface RowFilter {
  types: readonly CardType[];
  plans: readonly Plan[];
  rarities: readonly Rarity[];
}

/** The profile with the user's count overrides applied (D2: local adjustments to a curated route). */
export function applyOverrides(profile: RouteProfile, overrides: Readonly<Record<string, number>>): RouteProfile {
  if (Object.keys(overrides).length === 0) return profile;
  return { ...profile, counts: { ...profile.counts, ...overrides } };
}

/** `split` is an index into the profile's presets; null scores each 凸 under the card's best preset (D26). */
export function buildRows(cards: readonly Card[], ctx: Omit<ScoreContext, "lessons">, split: number | null): Row[] {
  const lessons = split === null ? undefined : ctx.profile.lessonSplits[split];
  const scoreAt = (card: Card, totsu: Totsu): Score => (lessons ? score(card, totsu, { ...ctx, lessons }) : scoreBest(card, totsu, ctx));
  return cards.map((card) => ({
    card,
    scores: [scoreAt(card, 0), scoreAt(card, 1), scoreAt(card, 2), scoreAt(card, 3), scoreAt(card, 4)],
    noParameterEffect: card.breakpoints.every((bp) => bp.effects.length === 0),
  }));
}

/** An empty list for a facet means "no restriction". */
export function filterRows(rows: readonly Row[], filter: RowFilter): Row[] {
  return rows.filter(
    (r) => (filter.types.length === 0 || filter.types.includes(r.card.type)) && (filter.plans.length === 0 || filter.plans.includes(r.card.plan)) && (filter.rarities.length === 0 || filter.rarities.includes(r.card.rarity)),
  );
}

/** Sorted by the chosen 凸 column; rows scoring 0 in that column go last in either direction (D10), ties by card id. */
export function sortRows(rows: readonly Row[], sort: SortSpec): Row[] {
  const key = (r: Row): number => r.scores[sort.totsu].total;
  return [...rows].sort((a, b) => {
    const za = key(a) === 0 ? 1 : 0;
    const zb = key(b) === 0 ? 1 : 0;
    if (za !== zb) return za - zb;
    const d = key(a) - key(b);
    if (d !== 0) return sort.desc ? -d : d;
    return a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0;
  });
}

/** One decimal at most, no trailing `.0`: 462.515 → "462.5", 147 → "147". */
export function formatPoints(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
