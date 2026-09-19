/**
 * Real-data checks over the shipped scenarios and generated data: every
 * category id a profile names exists in the taxonomy (a typo fails the build),
 * every category the cards use is named by every profile (a category the
 * profile omits would score 0 indistinguishably from a deliberate 0, so 0 must
 * be written down), every card scores to a finite number at every 凸, and the
 * engine's assumptions about the game's ids hold.
 */

import { describe, expect, test } from "bun:test";
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
