/**
 * Golden scores: the engine's output for ten cards chosen to exercise every
 * scoring mechanism, under H.I.F. 差し入れ育成 with the best lesson-split preset.
 * Derived by the engine on 2026-09-19 (こんにゃくなきもだめし: 2026-09-21) and
 * hand-checkable from the breakdowns recorded in
 * docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md § Artifacts; a change here must
 * be explained by a decision or a route-profile change, never by drift.
 *
 * The cards are frozen copies (golden.snapshot.ts), not the live generated data:
 * goldens pin the engine, so a game rebalance must not fail them (decision C8 of
 * docs/plans/EXECPLAN_COUNTING_MODEL.md). The totals are the ones the former
 * category-count model published: the migration to occasions, filters and
 * conditions was proven to change no score over all 204 cards × 4 profiles × 凸0–4
 * before that model was deleted (same plan, Milestone 2).
 */

import { describe, expect, test } from "bun:test";
import { scoreBest } from "../../src/engine/score.ts";
import type { RouteProfile } from "../../src/engine/types.ts";
import { LEVEL_LIMITS } from "../levelLimits.generated.ts";
import { GOLDEN_CARDS } from "./golden.snapshot.ts";
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
  { id: "s_card-3-0107", name: "大切な思い出、またひとつ", covers: "held-cards condition (集中8枚以上) capped ×4, stat-bound SP lesson ×7, パラメータボーナス 8.5% × 1359, item ×2", totsu0: 353.335, totsu4: 462.515 },
  { id: "s_card-2-0003", name: "愛無き暗記は難しい", covers: "unlimited-fire P-item 打倒！墾田永年私財法 26 × 4, 通常レッスン ×0, 授業 ×6", totsu0: 181.5, totsu4: 213 },
  { id: "s_card-2-0055", name: "おやすみのふたり", covers: "Pドリンク獲得時 capped 10 of route 16, SP lesson ×7, bonus 6.4%", totsu0: 161.296, totsu4: 267.976 },
  { id: "s_card-3-0100", name: "私たちも成長していくぞ！", covers: "assist card, three stats, activation caps 2 on 差し入れ and 相談", totsu0: 140, totsu4: 190 },
  { id: "s_card-1-0003", name: "王子様のひと呼吸", covers: "R card, 通常レッスン ×0, おでかけ ×1", totsu0: 37, totsu4: 60 },
  { id: "s_card-1-0000", name: "念入りにストレッチ", covers: "R visual card picks the Vi7 preset, レッスン終了時 ×7, 休む ×0", totsu0: 40, totsu4: 74 },
  { id: "s_card-3-0019", name: "きみは、自慢の生徒です", covers: "no parameter effect at all", totsu0: 0, totsu4: 0 },
  { id: "s_card-2-0078", name: "こんにゃくなきもだめし", covers: "condition 所持スキルカード20枚以上 on SP lessons, capped ×4 of 8", totsu0: 180.5, totsu4: 270 },
];

const DECK_20 = "EndLesson.produce_card_count.ge20";

const sashiire = HIF.profiles.find((p) => p.id === "sashiire");
if (!sashiire) throw new Error("H.I.F. profile sashiire missing");
const base = { limits: LEVEL_LIMITS };
const ctx = { ...base, profile: sashiire, scenarioId: HIF.id };

function card(id: string) {
  const c = GOLDEN_CARDS.find((x) => x.id === id);
  if (!c) throw new Error(`${id} is not in golden.snapshot.ts`);
  return c;
}

describe("golden scores (H.I.F. 差し入れ育成, best preset)", () => {
  for (const g of GOLDEN) {
    test(`${g.name}: 凸0 ${g.totsu0} / 凸4 ${g.totsu4} — ${g.covers}`, () => {
      expect(card(g.id).name).toBe(g.name);
      expect(scoreBest(card(g.id), 0, ctx).total).toBeCloseTo(g.totsu0, 3);
      expect(scoreBest(card(g.id), 4, ctx).total).toBeCloseTo(g.totsu4, 3);
    });
  }

  test("switching the scenario changes the totals without code changes", () => {
    const legendProfile = HAJIME_LEGEND.profiles[0];
    if (!legendProfile) throw new Error("初LEGEND profile missing");
    const hifTotal = scoreBest(card("s_card-3-0073"), 4, ctx).total;
    const legendTotal = scoreBest(card("s_card-3-0073"), 4, { ...base, profile: legendProfile, scenarioId: HAJIME_LEGEND.id }).total;
    expect(hifTotal).toBe(256);
    expect(legendTotal).not.toBe(hifTotal);
  });

  test("a condition is a bounded count against the effect's cap: 20枚以上 for 8 or 4 of the SP lessons changes nothing, for 3 removes one firing of +15 (C2)", () => {
    const withDeck20 = (n: number): RouteProfile => ({ ...sashiire, conditions: { [DECK_20]: n } });
    const at = (n: number): number => scoreBest(card("s_card-2-0078"), 4, { ...ctx, profile: withDeck20(n) }).total;
    expect(at(8)).toBe(270);
    expect(at(4)).toBe(270);
    expect(at(3)).toBe(255);
    for (const g of GOLDEN.filter((x) => x.id !== "s_card-2-0078")) {
      expect(scoreBest(card(g.id), 4, { ...ctx, profile: withDeck20(3) }).total).toBeCloseTo(g.totsu4, 3);
    }
  });
});
