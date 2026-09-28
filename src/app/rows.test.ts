import { describe, expect, test } from "bun:test";
import type { Card, ParsedTrigger, RouteProfile } from "../engine/types.ts";
import { buildRows, filterRows, formatPoints, sortRows, withoutHeld } from "./rows.ts";

const SHOP: ParsedTrigger = { occasion: "StartShop" };
const VISUAL_LESSON: ParsedTrigger = { occasion: "EndLesson", filters: [{ family: "lessonStat", member: "visual" }] };
const profile: RouteProfile = {
  id: "p",
  name: "p",
  occasions: { StartShop: 3, EndLesson: 4 },
  filters: {},
  lessonSplits: [
    { vocal: 3, dance: 1, visual: 0 },
    { vocal: 0, dance: 1, visual: 3 },
  ],
  parameterBonusBase: () => 0,
};
const limits = { r: [20, 25, 30, 35, 40], sr: [30, 35, 40, 45, 50], ssr: [40, 45, 50, 55, 60] } as const;
const ctx = { scenarioId: "s", profile, limits };

function card(id: string, effects: Card["breakpoints"][number]["effects"], type: Card["type"] = "vocal", rarity: Card["rarity"] = "ssr", plan: Card["plan"] = "common"): Card {
  return { id, name: id, assetId: id, type, rarity, plan, breakpoints: [{ minLevel: 1, effects, eventBonusPermil: 0 }] };
}

/** The value, or a thrown error naming what was missing, so a test fails where the gap is. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} is missing`);
  return value;
}

const shopVo = card("s-shop", [{ stat: "vocal", value: 10, kind: "skill", trigger: SHOP }]);
const lessonVi = card("s-lesson", [{ stat: "visual", value: 10, kind: "skill", trigger: VISUAL_LESSON }], "visual", "r", "sense");
const empty = card("s-empty", [], "assist", "sr", "logic");

describe("buildRows", () => {
  test("scores every 凸 and tags cards without any effect", () => {
    const rows = buildRows([shopVo, empty], ctx, null);
    const shop = must(rows[0], "the shop card's row");
    const none = must(rows[1], "the empty card's row");
    expect(shop.scores.map((s) => s.total)).toEqual([30, 30, 30, 30, 30]);
    expect(shop.noParameterEffect).toBe(false);
    expect(must(none.scores[4], "凸4").total).toBe(0);
    expect(none.noParameterEffect).toBe(true);
  });

  test("null split takes the best preset per card; a fixed split applies to every card", () => {
    const best = must(buildRows([lessonVi], ctx, null)[0], "the row under the best split");
    expect(must(best.scores[4], "凸4").total).toBe(30); // Vi3 preset: min(4 lessons, 3 visual lessons)
    expect(must(best.scores[4], "凸4").lessons).toEqual({ vocal: 0, dance: 1, visual: 3 });
    const fixed = must(buildRows([lessonVi], ctx, 0)[0], "the row under the fixed split");
    expect(must(fixed.scores[4], "凸4").total).toBe(0); // Vo3 preset: no visual lessons
  });
});

describe("withoutHeld", () => {
  test("drops exactly the held cards and keeps the order of the rest", () => {
    expect(withoutHeld([shopVo, lessonVi, empty], [{ id: "s-lesson", name: "s-lesson", reasons: ["a piece of unknown kind"] }]).map((c) => c.id)).toEqual(["s-shop", "s-empty"]);
    expect(withoutHeld([shopVo, lessonVi], [])).toEqual([shopVo, lessonVi]);
  });
});

describe("filterRows", () => {
  const rows = buildRows([shopVo, lessonVi, empty], ctx, null);
  const none = { types: [], plans: [], rarities: [], sp: false };
  test("empty facets keep everything; facets combine with AND", () => {
    expect(filterRows(rows, none)).toHaveLength(3);
    expect(filterRows(rows, { ...none, types: ["visual", "assist"] }).map((r) => r.card.id)).toEqual(["s-lesson", "s-empty"]);
    expect(filterRows(rows, { ...none, types: ["visual", "assist"], plans: ["logic"] }).map((r) => r.card.id)).toEqual(["s-empty"]);
    expect(filterRows(rows, { ...none, rarities: ["ssr"] }).map((r) => r.card.id)).toEqual(["s-shop"]);
  });

  test("sp keeps only cards flagged spRate, combined with the other facets", () => {
    const spCard: Card = { ...lessonVi, id: "s-sp", spRate: true };
    const withSp = buildRows([shopVo, spCard, empty], ctx, null);
    expect(filterRows(withSp, { ...none, sp: true }).map((r) => r.card.id)).toEqual(["s-sp"]);
    expect(filterRows(withSp, { ...none, sp: true, types: ["vocal"] })).toHaveLength(0);
    expect(filterRows(withSp, none)).toHaveLength(3);
  });
});

describe("sortRows", () => {
  const low = card("s-low", [{ stat: "vocal", value: 1, kind: "skill", trigger: SHOP }]);
  const rows = buildRows([empty, low, shopVo], ctx, null);
  test("descending puts the highest first and zero rows last", () => {
    expect(sortRows(rows, { totsu: 4, desc: true }).map((r) => r.card.id)).toEqual(["s-shop", "s-low", "s-empty"]);
  });
  test("ascending keeps zero rows last", () => {
    expect(sortRows(rows, { totsu: 4, desc: false }).map((r) => r.card.id)).toEqual(["s-low", "s-shop", "s-empty"]);
  });
  test("ties break by card id and the input is not mutated", () => {
    const twin = card("s-aaa", [{ stat: "vocal", value: 10, kind: "skill", trigger: SHOP }]);
    const input = buildRows([shopVo, twin], ctx, null);
    const sorted = sortRows(input, { totsu: 0, desc: true });
    expect(sorted.map((r) => r.card.id)).toEqual(["s-aaa", "s-shop"]);
    expect(input.map((r) => r.card.id)).toEqual(["s-shop", "s-aaa"]);
  });
});

describe("formatPoints", () => {
  test("one decimal at most, integers bare", () => {
    expect(formatPoints(147)).toBe("147");
    expect(formatPoints(462.515)).toBe("462.5");
    expect(formatPoints(267.976)).toBe("268");
    expect(formatPoints(0)).toBe("0");
  });
});
