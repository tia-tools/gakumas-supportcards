/**
 * The migration to occasions, filters and conditions changes no published
 * number (decision C8 of docs/plans/EXECPLAN_COUNTING_MODEL.md): every shipped
 * card under every shipped route profile at every 凸 scores the same under the
 * old category counts and under the restated profile, line by line. This file
 * is deleted together with the old counting model.
 */

import { describe, expect, test } from "bun:test";
import { scoreBest, taxonomyMap } from "../../src/engine/score.ts";
import type { Score, Totsu } from "../../src/engine/types.ts";
import { CARDS } from "../cards.generated.ts";
import { LEVEL_LIMITS } from "../levelLimits.generated.ts";
import { TAXONOMY } from "../taxonomy.generated.ts";
import { SCENARIOS } from "./index.ts";

const TOTSU: readonly Totsu[] = [0, 1, 2, 3, 4];
const taxonomy = taxonomyMap(TAXONOMY);

/** What the page shows of a score: totals, the chosen lesson split, and each line's kind, count and points. */
function published(s: Score): unknown {
  return { total: s.total, byStat: s.byStat, parts: s.parts, lessons: s.lessons, lines: s.lines.map((l) => [l.kind, l.stat, l.value, l.count, l.points]) };
}

describe("old and new counting models agree on every published score", () => {
  let rows = 0;
  for (const scenario of SCENARIOS) {
    for (const profile of scenario.profiles) {
      test(`${scenario.id}/${profile.id}: ${CARDS.length} cards × 凸0–4`, () => {
        const differing: string[] = [];
        for (const card of CARDS) {
          for (const totsu of TOTSU) {
            const before = scoreBest(card, totsu, { profile, taxonomy, limits: LEVEL_LIMITS });
            const after = scoreBest(card, totsu, { profile, taxonomy, limits: LEVEL_LIMITS, scenarioId: scenario.id });
            if (JSON.stringify(published(before)) !== JSON.stringify(published(after))) differing.push(`${card.id} ${card.name} 凸${totsu}: ${before.total} -> ${after.total}`);
          }
          rows++;
        }
        expect(differing).toEqual([]);
      });
    }
  }

  test("covers 204 cards × 4 route profiles = 816 rows of five scores", () => {
    expect(rows).toBe(CARDS.length * SCENARIOS.reduce((n, s) => n + s.profiles.length, 0));
    expect(rows).toBeGreaterThanOrEqual(816);
  });
});
