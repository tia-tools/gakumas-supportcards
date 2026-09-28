/**
 * Real-data checks over the shipped scenarios and generated data: every
 * occasion and filter the cards' triggers need has a number in every profile
 * (one the profile omits would count 0 indistinguishably from a deliberate 0, so
 * 0 must be written down), no filter or condition count exceeds its occasion,
 * and every card scores to a finite number at every 凸.
 */

import { describe, expect, test } from "bun:test";
import { conditionKey, missingNumbers, occasionOfConditionKey } from "../../src/engine/count.ts";
import { scoreBest, type ScoreContext } from "../../src/engine/score.ts";
import { DEFAULT_AUDITION_SHARE, type Card, type RouteProfile, type Totsu } from "../../src/engine/types.ts";
import { CARDS } from "../cards.generated.ts";
import { HELD } from "../held.generated.ts";
import { LEVEL_LIMITS } from "../levelLimits.generated.ts";
import { deckDrinks, deckKey } from "../../src/app/item-panel.ts";
import { applyOverrides } from "../../src/app/panel.ts";
import { bonusBase as hifBonusBase } from "./hif.ts";
import { ALL_SCENARIOS, SCENARIOS } from "./index.ts";

const TOTSU: Totsu[] = [0, 1, 2, 3, 4];

/** Some effect of the card, at some level, carries the condition `key` (an `<occasion>.<condition>` key). */
function carriesCondition(card: Card, key: string): boolean {
  return card.breakpoints.some((b) => b.effects.some((e) => e.trigger?.conditions?.some((x) => conditionKey(e.trigger?.occasion ?? "", x) === key)));
}

/** Every occasion or filter path the cards' triggers need that the profile has no number for. */
function numbersMissing(cards: readonly Card[], p: RouteProfile): string[] {
  return [...new Set(cards.flatMap((c) => c.breakpoints.flatMap((b) => b.effects.flatMap((e) => (e.trigger ? missingNumbers(e.trigger, p) : [])))))];
}

describe("shipped scenarios", () => {
  test("only H.I.F. is published; 初LEGEND stays in the code and under test but off the page (D39)", () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(["hif"]);
    expect(ALL_SCENARIOS.map((s) => s.id)).toEqual(["hif", "hajime-legend"]);
    for (const s of SCENARIOS) expect(ALL_SCENARIOS).toContain(s);
  });

  test("scenario and profile ids are unique and non-empty", () => {
    const ids = ALL_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ALL_SCENARIOS) {
      expect(s.profiles.length).toBeGreaterThan(0);
      const pids = s.profiles.map((p) => p.id);
      expect(new Set(pids).size).toBe(pids.length);
    }
  });

  test("H.I.F. bonus base: 800·n/8 + 340·(8−n)/16 + 200 + 500·share — 1021 / 799 / 420 for main / sub / other under 2:7:1 (decision A3 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md)", () => {
    expect(hifBonusBase(7, 0.2)).toBe(1021);
    expect(hifBonusBase(1, 0.7)).toBe(799);
    expect(hifBonusBase(0, 0.1)).toBe(420);
    expect(hifBonusBase(7, 1)).toBe(1421); // the whole distributed 500 to the main stat
    expect(hifBonusBase(7, 7 / 8)).toBe(1359); // the former lesson-share proxy, for the record
  });

  test("P-items (Milestone 3 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md): ふわふわでもこもこ in the deck adds 14 drinks and 70 points to おい、来てやったぞ！ and none to its own card; capping びっくり仮装グッズ at 1 costs はっぴぃはろうぃ～～ん！ 20", () => {
    const [s] = SCENARIOS;
    const [p] = s?.profiles ?? [];
    if (!s || !p) throw new Error("no default scenario profile");
    const byName = (name: string): Card => {
      const c = CARDS.find((x) => x.name === name);
      if (!c) throw new Error(`${name} is not in the generated data`);
      return c;
    };
    const fluffy = byName("ふわふわでワクワク");
    const fluffyItem = fluffy.items?.find((i) => i.drinks);
    if (!fluffyItem) throw new Error("ふわふわでワクワク grants no drink item");
    const drinks = deckDrinks(CARDS, { scenarioId: s.id, profile: p }, { [deckKey(fluffyItem.itemId)]: 1 });
    expect(drinks).toBe(14); // 7 dance SP lessons × 2 drinks
    const base = { scenarioId: s.id, profile: p, limits: LEVEL_LIMITS, share: DEFAULT_AUDITION_SHARE };
    const withDeck = { ...base, profile: applyOverrides(p, {}, drinks) };
    const total = (card: Card, ctx: Omit<ScoreContext, "lessons">): number => scoreBest(card, 4, ctx).total;
    expect(total(byName("おい、来てやったぞ！"), withDeck) - total(byName("おい、来てやったぞ！"), base)).toBe(70);
    expect(total(fluffy, withDeck) - total(fluffy, base)).toBe(0);
    const halloween = byName("はっぴぃはろうぃ～～ん！");
    const costume = halloween.items?.find((i) => i.itemName === "びっくり仮装グッズ");
    if (!costume) throw new Error("はっぴぃはろうぃ～～ん！ grants no びっくり仮装グッズ");
    expect(total(halloween, base) - total(halloween, { ...base, itemCaps: { [costume.itemId]: 1 } })).toBe(20);
  });

  test("lowering one condition moves only the cards whose effects carry it (decision C2 of docs/plans/EXECPLAN_COUNTING_MODEL.md)", () => {
    const [s] = SCENARIOS;
    const [p] = s?.profiles ?? [];
    if (!s || !p) throw new Error("no default scenario profile");
    const key = "EndLesson.produce_card_count.ge20";
    const ctx = { profile: p, limits: LEVEL_LIMITS, scenarioId: s.id, share: DEFAULT_AUDITION_SHARE };
    const lowered = { ...ctx, profile: { ...p, conditions: { ...p.conditions, [key]: 0 } } };
    const moved = CARDS.filter((c) => scoreBest(c, 4, ctx).total !== scoreBest(c, 4, lowered).total);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.filter((c) => !carriesCondition(c, key)).map((c) => c.name)).toEqual([]);
    expect(CARDS.filter((c) => carriesCondition(c, key) && !moved.includes(c)).map((c) => c.name)).toEqual([]);
  });

  for (const s of ALL_SCENARIOS) {
    for (const p of s.profiles) {
      test(`${s.id}/${p.id}: every occasion and filter the published cards' triggers need has a number; a missing one would silently count 0, so the generator holds such a card`, () => {
        const held = new Set(HELD.map((h) => h.id));
        expect(numbersMissing(CARDS.filter((c) => !held.has(c.id)), p)).toEqual([]);
      });

      test(`${s.id}/${p.id}: occasion, filter and condition counts are non-negative integers, and no filter or condition exceeds its occasion`, () => {
        const whole = (n: number): boolean => Number.isInteger(n) && n >= 0;
        for (const n of Object.values(p.occasions)) expect(whole(n)).toBe(true);
        for (const [occasion, families] of Object.entries(p.filters)) {
          const parent = p.occasions[occasion];
          expect(parent, `filters.${occasion} has no occasion count`).toBeDefined();
          for (const [family, counts] of Object.entries(families)) {
            expect(family).not.toBe("lessonStat"); // the lesson split carries it
            for (const n of [...(counts.default === undefined ? [] : [counts.default]), ...Object.values(counts.members ?? {})]) {
              expect(whole(n) && n <= (parent ?? 0), `filters.${occasion}.${family}: ${n} of ${parent}`).toBe(true);
            }
          }
        }
        for (const [key, n] of Object.entries(p.conditions ?? {})) {
          const parent = p.occasions[occasionOfConditionKey(key)];
          expect(whole(n) && parent !== undefined && n <= parent, `conditions["${key}"]: ${n} of ${parent}`).toBe(true);
        }
      });

      test(`${s.id}/${p.id}: lesson splits are non-negative integers that all sum to the same lesson count, and the bonus base grows with lessons`, () => {
        expect(p.lessonSplits.length).toBeGreaterThan(0);
        const totals = new Set(p.lessonSplits.map((l) => l.vocal + l.dance + l.visual));
        expect(totals.size).toBe(1);
        for (const l of p.lessonSplits) for (const n of Object.values(l)) expect(Number.isInteger(n) && n >= 0).toBe(true);
        const [total] = totals;
        let prev = -1;
        for (let n = 0; n <= (total ?? 0); n++) {
          const b = p.parameterBonusBase(n, 0.2);
          expect(b).toBeGreaterThan(prev);
          prev = b;
        }
      });

      test(`${s.id}/${p.id}: every card scores to a finite, non-negative total at every 凸, non-decreasing in 凸`, () => {
        const ctx = { profile: p, limits: LEVEL_LIMITS, scenarioId: s.id, share: DEFAULT_AUDITION_SHARE };
        for (const card of CARDS) {
          let prev = -1;
          for (const t of TOTSU) {
            const sc = scoreBest(card, t, ctx);
            expect(Number.isFinite(sc.total)).toBe(true);
            expect(sc.total).toBeGreaterThanOrEqual(prev);
            prev = sc.total;
          }
        }
      });
    }
  }
});
