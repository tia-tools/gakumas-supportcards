/**
 * Real-data checks over the shipped scenarios and generated data: every
 * category id a profile names exists in the taxonomy (a typo fails the build),
 * every category the cards use is named by every profile (a category the
 * profile omits would score 0 indistinguishably from a deliberate 0, so 0 must
 * be written down), every card scores to a finite number at every 凸, and the
 * engine's assumptions about the game's ids hold.
 */

import { describe, expect, test } from "bun:test";
import { conditionKey, missingNumbers } from "../../src/engine/count.ts";
import { PARAMETER_BONUS_CATEGORY_ID, scoreBest, taxonomyMap } from "../../src/engine/score.ts";
import { EVENT_CATEGORY_ID, type Totsu } from "../../src/engine/types.ts";
import { CARDS } from "../cards.generated.ts";
import { LEVEL_LIMITS } from "../levelLimits.generated.ts";
import { TAXONOMY } from "../taxonomy.generated.ts";
import { SCENARIOS } from "./index.ts";

const taxonomy = taxonomyMap(TAXONOMY);
const TOTSU: Totsu[] = [0, 1, 2, 3, 4];

/** Category ids that at least one card effect carries, minus the event pseudo-category. */
const CATEGORIES_USED_BY_CARDS: readonly string[] = [...new Set(CARDS.flatMap((c) => c.breakpoints.flatMap((b) => b.effects.map((e) => e.categoryId))))].filter((id) => id !== EVENT_CATEGORY_ID);

describe("shipped scenarios", () => {
  test("the パラメータボーナス+ row id the engine relies on exists in the taxonomy", () => {
    expect(taxonomy.get(PARAMETER_BONUS_CATEGORY_ID)?.title).toBe("パラメータボーナス+");
  });

  test("every category id the generated cards use exists in the generated taxonomy", () => {
    expect(CATEGORIES_USED_BY_CARDS.length).toBeGreaterThan(0);
    for (const id of CATEGORIES_USED_BY_CARDS) expect(taxonomy.has(id)).toBe(true);
  });

  test("scenario and profile ids are unique and non-empty", () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SCENARIOS) {
      expect(s.profiles.length).toBeGreaterThan(0);
      const pids = s.profiles.map((p) => p.id);
      expect(new Set(pids).size).toBe(pids.length);
    }
  });

  test("lowering one condition moves only the cards whose effects carry it (decision C2 of docs/plans/EXECPLAN_COUNTING_MODEL.md)", () => {
    const [s] = SCENARIOS;
    const [p] = s?.profiles ?? [];
    if (!s || !p) throw new Error("no default scenario profile");
    const key = "EndLesson/produce_card_count>=20";
    const carries = (c: (typeof CARDS)[number]): boolean => c.breakpoints.some((b) => b.effects.some((e) => e.trigger?.conditions?.some((x) => conditionKey(e.trigger?.occasion ?? "", x) === key)));
    const ctx = { profile: p, taxonomy, limits: LEVEL_LIMITS, scenarioId: s.id };
    const lowered = { ...ctx, profile: { ...p, conditions: { ...p.conditions, [key]: 0 } } };
    const moved = CARDS.filter((c) => scoreBest(c, 4, ctx).total !== scoreBest(c, 4, lowered).total);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.filter((c) => !carries(c)).map((c) => c.name)).toEqual([]);
    expect(CARDS.filter((c) => carries(c) && !moved.includes(c)).map((c) => c.name)).toEqual([]);
  });

  for (const s of SCENARIOS) {
    for (const p of s.profiles) {
      test(`${s.id}/${p.id}: every counted category exists in the taxonomy and counts are non-negative integers`, () => {
        for (const [id, n] of Object.entries(p.counts)) {
          expect(taxonomy.has(id)).toBe(true);
          expect(Number.isInteger(n) && n >= 0).toBe(true);
        }
      });

      test(`${s.id}/${p.id}: every category the cards use is named in counts (directly or through countsAs); an omitted category would silently score 0`, () => {
        for (const id of CATEGORIES_USED_BY_CARDS) {
          if (id === PARAMETER_BONUS_CATEGORY_ID) continue; // scored from the lesson split, not from a count
          const key = id in p.counts ? id : taxonomy.get(id)?.countsAs;
          expect(key !== undefined && key in p.counts, `${id} is not named in ${s.id}/${p.id}; write 0 if it never occurs`).toBe(true);
        }
      });

      test(`${s.id}/${p.id}: every occasion and filter the cards' triggers need has a number; a missing one would silently count 0`, () => {
        const missing = new Set(CARDS.flatMap((c) => c.breakpoints.flatMap((b) => b.effects.flatMap((e) => (e.trigger ? missingNumbers(e.trigger, p) : [])))));
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
          const parent = p.occasions[key.slice(0, key.indexOf("/"))];
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
        const ctx = { profile: p, taxonomy, limits: LEVEL_LIMITS };
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
