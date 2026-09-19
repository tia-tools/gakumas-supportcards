/**
 * Golden scores: the engine's output for nine cards chosen to exercise every
 * scoring mechanism, under H.I.F. 差し入れ育成 with the best lesson-split preset.
 * Derived by the engine on 2026-09-19 and hand-checkable from the breakdowns
 * recorded in docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md § Artifacts; a
 * change here must be explained by a data or decision change, never by drift.
 */

import { describe, expect, test } from "bun:test";
import { scoreBest, taxonomyMap } from "../../src/engine/score.ts";
import { CARDS } from "../cards.generated.ts";
import { LEVEL_LIMITS } from "../levelLimits.generated.ts";
import { TAXONOMY } from "../taxonomy.generated.ts";
import { HAJIME_LEGEND } from "./hajime-legend.ts";
import { HIF } from "./hif.ts";

interface Golden {
  id: string;
  name: string;
  covers: string;
  totsu0: number;
  totsu4: number;
}

const GOLDEN: Golden[] = [
  { id: "s_card-3-0016", name: "1人たりとも欠ける事なく", covers: "own-event bonus ×2.0, 相談選択時 ×3, 初期", totsu0: 109, totsu4: 147 },
  { id: "s_card-3-0073", name: "ｖギャルピーーースッｖ", covers: "削除時 ×6, 差し入れ選択時 ×5", totsu0: 190, totsu4: 256 },
  { id: "s_card-3-0107", name: "大切な思い出、またひとつ", covers: "extension row via countsAs ×4, stat-bound SP lesson ×7, パラメータボーナス 8.5% × 1359, item ×2", totsu0: 353.335, totsu4: 462.515 },
  { id: "s_card-2-0003", name: "愛無き暗記は難しい", covers: "unlimited-fire P-item 打倒！墾田永年私財法 26 × 4, 通常レッスン ×0, 授業 ×6", totsu0: 181.5, totsu4: 213 },
  { id: "s_card-2-0055", name: "おやすみのふたり", covers: "Pドリンク獲得時 capped 10 of route 16, SP lesson ×7, bonus 6.4%", totsu0: 161.296, totsu4: 267.976 },
  { id: "s_card-3-0100", name: "私たちも成長していくぞ！", covers: "assist card, three stats, activation caps 2 on 差し入れ and 相談", totsu0: 140, totsu4: 190 },
  { id: "s_card-1-0003", name: "王子様のひと呼吸", covers: "R card, 通常レッスン ×0, おでかけ ×1", totsu0: 37, totsu4: 60 },
  { id: "s_card-1-0000", name: "念入りにストレッチ", covers: "R visual card picks the Vi7 preset, レッスン終了時 ×7, 休む ×0", totsu0: 40, totsu4: 74 },
  { id: "s_card-3-0019", name: "きみは、自慢の生徒です", covers: "no parameter effect at all", totsu0: 0, totsu4: 0 },
];

const profile = HIF.profiles.find((p) => p.id === "sashiire");
if (!profile) throw new Error("H.I.F. profile sashiire missing");
const ctx = { profile, taxonomy: taxonomyMap(TAXONOMY), limits: LEVEL_LIMITS };

describe("golden scores (H.I.F. 差し入れ育成, best preset)", () => {
  for (const g of GOLDEN) {
    test(`${g.name}: 凸0 ${g.totsu0} / 凸4 ${g.totsu4} — ${g.covers}`, () => {
      const card = CARDS.find((c) => c.id === g.id);
      expect(card?.name).toBe(g.name);
      if (!card) return;
      expect(scoreBest(card, 0, ctx).total).toBeCloseTo(g.totsu0, 3);
      expect(scoreBest(card, 4, ctx).total).toBeCloseTo(g.totsu4, 3);
    });
  }

  test("switching the scenario changes the totals without code changes (Milestone 2 acceptance)", () => {
    const card = CARDS.find((c) => c.id === "s_card-3-0073");
    if (!card) throw new Error("card missing");
    const legendProfile = HAJIME_LEGEND.profiles[0];
    if (!legendProfile) throw new Error("初LEGEND profile missing");
    const hifTotal = scoreBest(card, 4, ctx).total;
    const legendTotal = scoreBest(card, 4, { ...ctx, profile: legendProfile }).total;
    expect(hifTotal).toBe(256);
    expect(legendTotal).not.toBe(hifTotal);
  });
});
