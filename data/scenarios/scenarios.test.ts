/**
 * Real-data checks over the shipped scenarios and generated data: every
 * category id a profile names exists in the taxonomy (a typo fails the build),
 * every card scores to a finite number at every 凸, and the engine's
 * assumptions about the game's ids hold.
 */

import { describe, expect, test } from "bun:test";
import { PARAMETER_BONUS_CATEGORY_ID, scoreBest, taxonomyMap } from "../../src/engine/score.ts";
import type { Totsu } from "../../src/engine/types.ts";
import { CARDS } from "../cards.generated.ts";
import { LEVEL_LIMITS } from "../levelLimits.generated.ts";
import { TAXONOMY } from "../taxonomy.generated.ts";
import { SCENARIOS } from "./index.ts";

const taxonomy = taxonomyMap(TAXONOMY);
const TOTSU: Totsu[] = [0, 1, 2, 3, 4];

describe("shipped scenarios", () => {
  test("the パラメータボーナス+ row id the engine relies on exists in the taxonomy", () => {
    expect(taxonomy.get(PARAMETER_BONUS_CATEGORY_ID)?.title).toBe("パラメータボーナス+");
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
