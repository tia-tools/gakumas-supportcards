import { describe, expect, test } from "bun:test";
import { taxonomyMap } from "../engine/score.ts";
import type { Card, RouteProfile, TaxonomyRow } from "../engine/types.ts";
import { applyOverrides, buildRows, filterRows, formatPoints, sortRows } from "./rows.ts";

const SHOP = "s_card_p_skill_filter-vocaladdition-p_trigger-start_shop";
const LESSON = "s_card_p_skill_filter-vocaladdition-p_trigger-end_lesson-lesson_vocal";
const taxonomy: TaxonomyRow[] = [
  { id: SHOP, title: "相談選択時", order: 28, source: "game" },
  { id: LESSON, title: "レッスン終了時", order: 4, source: "game" },
];
const profile: RouteProfile = {
  id: "p",
  name: "p",
  counts: { [SHOP]: 3, [LESSON]: 4 },
  lessonSplits: [
    { vocal: 3, dance: 1, visual: 0 },
    { vocal: 0, dance: 1, visual: 3 },
  ],
  parameterBonusBase: () => 0,
};
const limits = { r: [20, 25, 30, 35, 40], sr: [30, 35, 40, 45, 50], ssr: [40, 45, 50, 55, 60] } as const;
const ctx = { profile, taxonomy: taxonomyMap(taxonomy), limits };

function card(id: string, effects: Card["breakpoints"][number]["effects"], type: Card["type"] = "vocal", rarity: Card["rarity"] = "ssr", plan: Card["plan"] = "common"): Card {
  return { id, name: id, assetId: id, type, rarity, plan, breakpoints: [{ minLevel: 1, effects, eventBonusPermil: 0 }] };
}

const shopVo = card("s-shop", [{ categoryId: SHOP, stat: "vocal", value: 10, kind: "skill" }]);
const lessonVi = card("s-lesson", [{ categoryId: LESSON, stat: "visual", value: 10, kind: "skill", triggerStat: "visual" }], "visual", "r", "sense");
const empty = card("s-empty", [], "assist", "sr", "logic");

describe("buildRows", () => {
  test("scores every 凸 and tags cards without any effect", () => {
    const rows = buildRows([shopVo, empty], ctx, null);
    expect(rows[0]!.scores.map((s) => s.total)).toEqual([30, 30, 30, 30, 30]);
    expect(rows[0]!.noParameterEffect).toBe(false);
    expect(rows[1]!.scores[4]!.total).toBe(0);
    expect(rows[1]!.noParameterEffect).toBe(true);
  });

  test("null split takes the best preset per card; a fixed split applies to every card", () => {
    const best = buildRows([lessonVi], ctx, null)[0]!;
    expect(best.scores[4]!.total).toBe(30); // Vi3 preset: min(route 4, 3 visual lessons)
    expect(best.scores[4]!.lessons).toEqual({ vocal: 0, dance: 1, visual: 3 });
    const fixed = buildRows([lessonVi], ctx, 0)[0]!;
    expect(fixed.scores[4]!.total).toBe(0); // Vo3 preset: no visual lessons
  });
});

describe("applyOverrides", () => {
  test("overrides replace counts and leave the rest, returning the same profile when empty", () => {
    expect(applyOverrides(profile, {})).toBe(profile);
    const p = applyOverrides(profile, { [SHOP]: 5 });
    expect(p.counts).toEqual({ [SHOP]: 5, [LESSON]: 4 });
    expect(buildRows([shopVo], { ...ctx, profile: p }, null)[0]!.scores[4]!.total).toBe(50);
  });
});

describe("filterRows", () => {
  const rows = buildRows([shopVo, lessonVi, empty], ctx, null);
  test("empty facets keep everything; facets combine with AND", () => {
    expect(filterRows(rows, { types: [], plans: [], rarities: [] })).toHaveLength(3);
    expect(filterRows(rows, { types: ["visual", "assist"], plans: [], rarities: [] }).map((r) => r.card.id)).toEqual(["s-lesson", "s-empty"]);
    expect(filterRows(rows, { types: ["visual", "assist"], plans: ["logic"], rarities: [] }).map((r) => r.card.id)).toEqual(["s-empty"]);
    expect(filterRows(rows, { types: [], plans: [], rarities: ["ssr"] }).map((r) => r.card.id)).toEqual(["s-shop"]);
  });
});

describe("sortRows", () => {
  const low = card("s-low", [{ categoryId: SHOP, stat: "vocal", value: 1, kind: "skill" }]);
  const rows = buildRows([empty, low, shopVo], ctx, null);
  test("descending puts the highest first and zero rows last", () => {
    expect(sortRows(rows, { totsu: 4, desc: true }).map((r) => r.card.id)).toEqual(["s-shop", "s-low", "s-empty"]);
  });
  test("ascending keeps zero rows last", () => {
    expect(sortRows(rows, { totsu: 4, desc: false }).map((r) => r.card.id)).toEqual(["s-low", "s-shop", "s-empty"]);
  });
  test("ties break by card id and the input is not mutated", () => {
    const twin = card("s-aaa", [{ categoryId: SHOP, stat: "vocal", value: 10, kind: "skill" }]);
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
