import { describe, expect, test } from "bun:test";
import { PARAMETER_BONUS_CATEGORY_ID, levelFor, resolveAtLevel, routeCount, score, scoreAtLevel, scoreBest, taxonomyMap, type ScoreContext } from "./score.ts";
import { EVENT_CATEGORY_ID, type Card, type LevelLimits, type RouteProfile, type TaxonomyRow } from "./types.ts";

const SHOP = "s_card_p_skill_filter-vocaladdition-p_trigger-start_shop";
const SP_LESSON = "s_card_p_skill_filter-vocaladdition-p_trigger-end_lesson-lesson_vocal_sp";
const EXT_SP = "ext-vocaladdition-p_trigger-end_lesson-lesson_sp";
const UNNAMED = "s_card_p_skill_filter-vocaladdition-p_trigger-start_refresh";

const TAXONOMY: TaxonomyRow[] = [
  { id: SHOP, title: "相談選択時パラメータ上昇", order: 28, source: "game" },
  { id: SP_LESSON, title: "SPレッスン終了時パラメータ上昇", order: 6, source: "game" },
  { id: PARAMETER_BONUS_CATEGORY_ID, title: "パラメータボーナス+", order: 2, source: "game" },
  { id: UNNAMED, title: "休む選択時パラメータ上昇", order: 30, source: "game" },
  { id: EXT_SP, title: "SPレッスン終了時パラメータ上昇", order: 106, source: "extension", countsAs: SP_LESSON },
];
const LIMITS: LevelLimits = { r: [20, 25, 30, 35, 40], sr: [30, 35, 40, 45, 50], ssr: [40, 45, 50, 55, 60] };
const PROFILE: RouteProfile = {
  id: "p",
  name: "test",
  counts: { [SHOP]: 5, [SP_LESSON]: 9 },
  lessonSplits: [
    { vocal: 7, dance: 1, visual: 0 },
    { vocal: 0, dance: 1, visual: 7 },
  ],
  parameterBonusBase: (n) => 500 * n, // 4 lessons → 2000, 2 → 1000, 1 → 500
};
const ctx: ScoreContext = { profile: PROFILE, taxonomy: taxonomyMap(TAXONOMY), limits: LIMITS, lessons: { vocal: 4, dance: 3, visual: 2 } };

function card(breakpoints: Card["breakpoints"], rarity: Card["rarity"] = "ssr"): Card {
  return { id: "c", name: "c", assetId: "a", type: "vocal", rarity, plan: "common", breakpoints };
}

describe("levelFor / resolveAtLevel", () => {
  test("levelFor reads the rarity's limit table", () => {
    expect(levelFor(LIMITS, "ssr", 0)).toBe(40);
    expect(levelFor(LIMITS, "r", 4)).toBe(40);
    expect(levelFor(LIMITS, "sr", 2)).toBe(40);
  });

  test("resolveAtLevel picks the last breakpoint at or below the level", () => {
    const c = card([
      { minLevel: 1, effects: [], eventBonusPermil: 500 },
      { minLevel: 20, effects: [], eventBonusPermil: 750 },
      { minLevel: 40, effects: [], eventBonusPermil: 1000 },
    ]);
    expect(resolveAtLevel(c, 1).eventBonusPermil).toBe(500);
    expect(resolveAtLevel(c, 39).eventBonusPermil).toBe(750);
    expect(resolveAtLevel(c, 60).eventBonusPermil).toBe(1000);
  });

  test("a level below every breakpoint resolves to nothing", () => {
    const c = card([{ minLevel: 5, effects: [{ categoryId: SHOP, stat: "vocal", value: 9, kind: "skill" }], eventBonusPermil: 0 }]);
    expect(resolveAtLevel(c, 1)).toEqual({ minLevel: 1, effects: [], eventBonusPermil: 0 });
  });
});

describe("routeCount", () => {
  test("direct count, countsAs fallback, unnamed category → 0", () => {
    expect(routeCount(PROFILE, ctx.taxonomy, SHOP)).toBe(5);
    expect(routeCount(PROFILE, ctx.taxonomy, EXT_SP)).toBe(9);
    expect(routeCount(PROFILE, ctx.taxonomy, UNNAMED)).toBe(0);
    expect(routeCount(PROFILE, ctx.taxonomy, "no-such-row")).toBe(0);
  });
});

describe("score", () => {
  test("a card with no parameter effect scores 0 with empty parts and lines (SP発生率-only, Pポイント-only cards)", () => {
    const s = score(card([{ minLevel: 1, effects: [], eventBonusPermil: 500 }]), 4, ctx);
    expect(s).toEqual({ total: 0, byStat: { vocal: 0, dance: 0, visual: 0 }, parts: { skills: 0, events: 0, items: 0 }, lines: [], lessons: ctx.lessons });
  });

  test("flat skill: value × route count, capped by activationCount (D15)", () => {
    const c = card([
      {
        minLevel: 1,
        effects: [
          { categoryId: SHOP, stat: "vocal", value: 10, kind: "skill" },
          { categoryId: SHOP, stat: "dance", value: 10, kind: "skill", cap: 2 },
        ],
        eventBonusPermil: 0,
      },
    ]);
    const s = score(c, 0, ctx);
    expect(s.byStat).toEqual({ vocal: 50, dance: 20, visual: 0 });
    expect(s.parts).toEqual({ skills: 70, events: 0, items: 0 });
    expect(s.lines.map((l) => [l.kind, l.count, l.points])).toEqual([
      ["skill", 5, 50],
      ["skill", 2, 20],
    ]);
  });

  test("a lesson-end effect bound to a stat fires at most the route's lessons of that stat", () => {
    const c = card([
      {
        minLevel: 1,
        effects: [
          { categoryId: SP_LESSON, stat: "vocal", value: 10, kind: "skill", triggerStat: "vocal" }, // 9 SP lessons, but only 4 train vocal
          { categoryId: SP_LESSON, stat: "vocal", value: 10, kind: "skill", triggerStat: "visual", cap: 1 }, // 2 visual lessons, own cap 1
          { categoryId: SP_LESSON, stat: "vocal", value: 10, kind: "skill" }, // any-stat trigger: all 9
          { categoryId: SP_LESSON, stat: "dance", value: 20, kind: "item", triggerStat: "dance", cap: 5 }, // items too: min(5, 3)
        ],
        eventBonusPermil: 0,
      },
    ]);
    expect(score(c, 0, ctx).lines.map((l) => l.count)).toEqual([4, 1, 9, 3]);
  });

  test("extension category falls back to its countsAs row's count", () => {
    const c = card([{ minLevel: 1, effects: [{ categoryId: EXT_SP, stat: "visual", value: 20, kind: "skill", cap: 3 }], eventBonusPermil: 0 }]);
    expect(score(c, 0, ctx).total).toBe(60);
  });

  test("a category the profile does not name scores 0 but keeps its line", () => {
    const c = card([{ minLevel: 1, effects: [{ categoryId: UNNAMED, stat: "vocal", value: 22, kind: "skill" }], eventBonusPermil: 0 }]);
    const s = score(c, 0, ctx);
    expect(s.total).toBe(0);
    expect(s.lines[0]).toMatchObject({ title: "休む選択時パラメータ上昇", count: 0, points: 0 });
  });

  test("パラメータボーナス+: tenths of a percent × the profile's bonus base for the stat's lesson count (D4, D26)", () => {
    const c = card([{ minLevel: 1, effects: [{ categoryId: PARAMETER_BONUS_CATEGORY_ID, stat: "vocal", value: 85, kind: "skill", cap: 1 }], eventBonusPermil: 0 }]);
    const s = score(c, 0, ctx);
    expect(s.total).toBe(170);
    expect(s.lines[0]).toMatchObject({ kind: "bonus", value: 85, count: 2000, points: 170 });
  });

  test("event reward × (1 + own-event bonus) at the resolved level (D17)", () => {
    const c = card([
      { minLevel: 1, effects: [{ categoryId: EVENT_CATEGORY_ID, stat: "vocal", value: 20, kind: "event" }], eventBonusPermil: 500 },
      { minLevel: 60, effects: [{ categoryId: EVENT_CATEGORY_ID, stat: "vocal", value: 20, kind: "event" }], eventBonusPermil: 1000 },
    ]);
    expect(score(c, 0, ctx)).toMatchObject({ total: 30, parts: { skills: 0, events: 30, items: 0 } });
    expect(score(c, 4, ctx)).toMatchObject({ total: 40, parts: { events: 40 } });
    expect(score(c, 4, ctx).lines[0]).toMatchObject({ kind: "event", title: "サポートイベント", count: 2000, points: 40 });
  });

  test("item: value × min(fireLimit, route count), labelled with the item name (D16)", () => {
    const c = card([
      {
        minLevel: 1,
        effects: [
          { categoryId: SHOP, stat: "vocal", value: 30, kind: "item", cap: 1, itemId: "pitem-a", itemName: "切磋琢磨のタオル" },
          { categoryId: SP_LESSON, stat: "dance", value: 20, kind: "item", itemId: "pitem-b", itemName: "unlimited" },
        ],
        eventBonusPermil: 0,
      },
    ]);
    const s = score(c, 0, ctx);
    expect(s.parts).toEqual({ skills: 0, events: 0, items: 30 + 180 });
    expect(s.lines[0]).toMatchObject({ kind: "item", itemName: "切磋琢磨のタオル", count: 1, points: 30 });
    expect(s.lines[1]).toMatchObject({ count: 9, points: 180 });
  });

  test("total equals the sum of byStat and the sum of parts", () => {
    const c = card([
      {
        minLevel: 1,
        effects: [
          { categoryId: SHOP, stat: "vocal", value: 10, kind: "skill" },
          { categoryId: PARAMETER_BONUS_CATEGORY_ID, stat: "dance", value: 50, kind: "skill", cap: 1 },
          { categoryId: EVENT_CATEGORY_ID, stat: "visual", value: 20, kind: "event" },
          { categoryId: SHOP, stat: "visual", value: 30, kind: "item", cap: 2 },
        ],
        eventBonusPermil: 500,
      },
    ]);
    const s = score(c, 0, ctx);
    // 10 × 5 shop + 5% × (500 × 3 dance lessons) + 20 × 1.5 event + 30 × min(2, 5) item
    expect(s.total).toBe(50 + 75 + 30 + 60);
    expect(s.byStat.vocal + s.byStat.dance + s.byStat.visual).toBe(s.total);
    expect(s.parts.skills + s.parts.events + s.parts.items).toBe(s.total);
  });

  test("changing the profile changes the totals without touching the card", () => {
    const c = card([{ minLevel: 1, effects: [{ categoryId: SHOP, stat: "vocal", value: 10, kind: "skill" }], eventBonusPermil: 0 }]);
    const other: RouteProfile = { ...PROFILE, id: "q", counts: { [SHOP]: 2 } };
    expect(score(c, 0, ctx).total).toBe(50);
    expect(score(c, 0, { ...ctx, profile: other }).total).toBe(20);
  });

  test("scoreBest picks the preset split that scores the card highest and reports it (D26)", () => {
    const c = card([
      {
        minLevel: 1,
        effects: [
          { categoryId: SP_LESSON, stat: "visual", value: 10, kind: "skill", triggerStat: "visual" }, // 7 visual lessons under the second preset
          { categoryId: PARAMETER_BONUS_CATEGORY_ID, stat: "visual", value: 100, kind: "skill", cap: 1 }, // 10% × 500 × 7 = 350 under it
        ],
        eventBonusPermil: 0,
      },
    ]);
    const s = scoreBest(c, 0, ctx);
    expect(s.lessons).toEqual({ vocal: 0, dance: 1, visual: 7 });
    expect(s.total).toBe(70 + 350);
    expect(score(c, 0, { ...ctx, lessons: { vocal: 7, dance: 1, visual: 0 } }).total).toBe(0);
  });

  test("scoreAtLevel and score agree at the 凸 level", () => {
    const c = card([{ minLevel: 45, effects: [{ categoryId: SHOP, stat: "vocal", value: 10, kind: "skill" }], eventBonusPermil: 0 }]);
    expect(score(c, 0, ctx).total).toBe(0);
    expect(score(c, 1, ctx).total).toBe(scoreAtLevel(c, 45, ctx).total);
  });
});
