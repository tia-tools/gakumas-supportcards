import { describe, expect, test } from "bun:test";
import { conditionKey, missingNumbers, occasionOfConditionKey, occurrences, type CountContext } from "./count.ts";
import type { ClassifiedEffect, ParsedTrigger, RouteProfile } from "./types.ts";

const PROFILE: RouteProfile = {
  id: "p",
  name: "p",
  occasions: { EndLesson: 8, GetProduceCard: 20, StartShop: 3 },
  filters: {
    EndLesson: { lessonKind: { members: { sp: 6, normal: 2 } } },
    GetProduceCard: { cardType: { members: { mental: 13, active: 7 } }, effectGroup: { default: 10, members: { review: 14 } } },
  },
  lessonSplits: [{ vocal: 7, dance: 1, visual: 0 }],
  parameterBonusBase: () => 0,
};
const ctx: CountContext = { scenarioId: "hif", profile: PROFILE, lessons: { vocal: 7, dance: 1, visual: 0 } };

function effect(trigger: ParsedTrigger, cap?: number): ClassifiedEffect {
  const e: ClassifiedEffect = { stat: "vocal", value: 10, kind: "skill", trigger };
  if (cap !== undefined) e.cap = cap;
  return e;
}

const DECK_20 = { kind: "produce_card_count", min: 20, max: 0 };

describe("occurrences", () => {
  test("an occasion alone counts as the profile says, and one the profile does not name counts 0", () => {
    expect(occurrences(effect({ occasion: "StartShop" }), ctx)).toBe(3);
    expect(occurrences(effect({ occasion: "StartRefresh" }), ctx)).toBe(0);
  });

  test("a filter narrows the occasion: its own count, else the family default", () => {
    expect(occurrences(effect({ occasion: "GetProduceCard", filters: [{ family: "cardType", member: "mental" }] }), ctx)).toBe(13);
    expect(occurrences(effect({ occasion: "GetProduceCard", filters: [{ family: "effectGroup", member: "review" }] }), ctx)).toBe(14);
    expect(occurrences(effect({ occasion: "GetProduceCard", filters: [{ family: "effectGroup", member: "a_new_plan" }] }), ctx)).toBe(10);
  });

  test("a filter can never exceed its occasion", () => {
    const few = { ...ctx, profile: { ...PROFILE, occasions: { ...PROFILE.occasions, GetProduceCard: 5 } } };
    expect(occurrences(effect({ occasion: "GetProduceCard", filters: [{ family: "effectGroup", member: "review" }] }), few)).toBe(5);
  });

  test("a member of a family without a default, or a family the profile lacks, counts 0", () => {
    expect(occurrences(effect({ occasion: "GetProduceCard", filters: [{ family: "cardType", member: "trouble" }] }), ctx)).toBe(0);
    expect(occurrences(effect({ occasion: "GetProduceCard", filters: [{ family: "rarity", member: "ssr" }] }), ctx)).toBe(0);
  });

  test("the lesson-stat filter is the lesson split, combined with the lesson kind", () => {
    expect(occurrences(effect({ occasion: "EndLesson", filters: [{ family: "lessonStat", member: "vocal" }] }), ctx)).toBe(7);
    expect(occurrences(effect({ occasion: "EndLesson", filters: [{ family: "lessonStat", member: "dance" }, { family: "lessonKind", member: "sp" }] }), ctx)).toBe(1);
    expect(occurrences(effect({ occasion: "EndLesson", filters: [{ family: "lessonStat", member: "vocal" }, { family: "lessonKind", member: "sp" }] }), ctx)).toBe(6);
  });

  test("a condition the profile does not state is met every time (docs/adr/0001)", () => {
    expect(occurrences(effect({ occasion: "EndLesson", filters: [{ family: "lessonKind", member: "sp" }], conditions: [DECK_20] }), ctx)).toBe(6);
  });

  test("a stated condition is a bounded count, and the effect's cap is reached as long as enough occasions qualify (C2)", () => {
    const trigger: ParsedTrigger = { occasion: "EndLesson", filters: [{ family: "lessonKind", member: "sp" }], conditions: [DECK_20] };
    const stated = (n: number): CountContext => ({ ...ctx, profile: { ...PROFILE, conditions: { "EndLesson.produce_card_count.ge20": n } } });
    expect(occurrences(effect(trigger, 4), stated(8))).toBe(4);
    expect(occurrences(effect(trigger, 4), stated(4))).toBe(4);
    expect(occurrences(effect(trigger, 4), stated(3))).toBe(3);
    expect(occurrences(effect(trigger), stated(8))).toBe(6); // never more than the SP lessons
  });

  test("a trigger restricted to another scenario counts 0; to this scenario, normally (C5)", () => {
    expect(occurrences(effect({ occasion: "StartShop", scenario: "hajime-legend" }), ctx)).toBe(0);
    expect(occurrences(effect({ occasion: "StartShop", scenario: "hif" }), ctx)).toBe(3);
  });

  test("the cap applies last; an effect without a trigger counts 0", () => {
    expect(occurrences(effect({ occasion: "GetProduceCard" }, 2), ctx)).toBe(2);
    expect(occurrences({ stat: "vocal", value: 10, kind: "event" }, ctx)).toBe(0);
  });
});

describe("conditionKey", () => {
  test("occasion, the game's word, counted cards and bound — without the trigger's filters (C10)", () => {
    expect(conditionKey("EndLesson", DECK_20)).toBe("EndLesson.produce_card_count.ge20");
    expect(conditionKey("StartCustomize", { kind: "dance", min: 0, max: 900 })).toBe("StartCustomize.dance.le900");
    expect(conditionKey("StartShop", { kind: "stamina_ratio", min: 300, max: 800 })).toBe("StartShop.stamina_ratio.300to800");
    const held = conditionKey("GetProduceCard", { kind: "produce_card_search_count", subject: [{ family: "effectGroup", member: "review" }], min: 8, max: 0 });
    expect(held).toBe("GetProduceCard.produce_card_search_count-effectGroup.review.ge8");
    expect(occasionOfConditionKey(held)).toBe("GetProduceCard");
    expect(encodeURIComponent(held)).toBe(held); // survives a query string unescaped
  });
});

describe("missingNumbers", () => {
  test("nothing is missing when the profile names the occasion and each filter, by member or by family default", () => {
    expect(missingNumbers({ occasion: "GetProduceCard", filters: [{ family: "effectGroup", member: "a_new_plan" }], conditions: [DECK_20] }, PROFILE)).toEqual([]);
    expect(missingNumbers({ occasion: "EndLesson", filters: [{ family: "lessonStat", member: "visual" }] }, PROFILE)).toEqual([]);
  });

  test("names every number that would silently count 0", () => {
    expect(missingNumbers({ occasion: "StartRefresh" }, PROFILE)).toEqual(["occasions.StartRefresh"]);
    expect(missingNumbers({ occasion: "GetProduceCard", filters: [{ family: "cardType", member: "trouble" }, { family: "rarity", member: "ssr" }] }, PROFILE)).toEqual([
      "filters.GetProduceCard.cardType.trouble",
      "filters.GetProduceCard.rarity.ssr",
    ]);
  });
});
