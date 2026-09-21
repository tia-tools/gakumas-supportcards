/**
 * Real-data checks over the shipped scenarios and generated data: every
 * occasion and filter the cards' triggers need has a number in every profile
 * (one the profile omits would count 0 indistinguishably from a deliberate 0, so
 * 0 must be written down), no filter or condition count exceeds its occasion,
 * and every card scores to a finite number at every 凸.
 */

import { describe, expect, test } from "bun:test";
import { conditionKey, missingNumbers, occasionOfConditionKey } from "../../src/engine/count.ts";
import { scoreBest } from "../../src/engine/score.ts";
import type { Totsu } from "../../src/engine/types.ts";
import { CARDS } from "../cards.generated.ts";
import { HELD } from "../held.generated.ts";
import { LEVEL_LIMITS } from "../levelLimits.generated.ts";
import { ALL_SCENARIOS, SCENARIOS } from "./index.ts";

const TOTSU: Totsu[] = [0, 1, 2, 3, 4];

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

  test("lowering one condition moves only the cards whose effects carry it (decision C2 of docs/plans/EXECPLAN_COUNTING_MODEL.md)", () => {
    const [s] = SCENARIOS;
    const [p] = s?.profiles ?? [];
    if (!s || !p) throw new Error("no default scenario profile");
    const key = "EndLesson.produce_card_count.ge20";
    const carries = (c: (typeof CARDS)[number]): boolean => c.breakpoints.some((b) => b.effects.some((e) => e.trigger?.conditions?.some((x) => conditionKey(e.trigger?.occasion ?? "", x) === key)));
    const ctx = { profile: p, limits: LEVEL_LIMITS, scenarioId: s.id };
    const lowered = { ...ctx, profile: { ...p, conditions: { ...p.conditions, [key]: 0 } } };
    const moved = CARDS.filter((c) => scoreBest(c, 4, ctx).total !== scoreBest(c, 4, lowered).total);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.filter((c) => !carries(c)).map((c) => c.name)).toEqual([]);
    expect(CARDS.filter((c) => carries(c) && !moved.includes(c)).map((c) => c.name)).toEqual([]);
  });

  for (const s of ALL_SCENARIOS) {
    for (const p of s.profiles) {
      test(`${s.id}/${p.id}: every occasion and filter the published cards' triggers need has a number; a missing one would silently count 0, so the generator holds such a card`, () => {
        const held = new Set(HELD.map((h) => h.id));
        const missing = new Set(CARDS.filter((c) => !held.has(c.id)).flatMap((c) => c.breakpoints.flatMap((b) => b.effects.flatMap((e) => (e.trigger ? missingNumbers(e.trigger, p) : [])))));
        expect([...missing]).toEqual([]);
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
          const b = p.parameterBonusBase(n);
          expect(b).toBeGreaterThan(prev);
          prev = b;
        }
      });

      test(`${s.id}/${p.id}: every card scores to a finite, non-negative total at every 凸, non-decreasing in 凸`, () => {
        const ctx = { profile: p, limits: LEVEL_LIMITS, scenarioId: s.id };
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
