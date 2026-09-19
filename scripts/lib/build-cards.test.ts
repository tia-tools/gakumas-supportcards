import { describe, expect, test } from "bun:test";
import { EVENT_CATEGORY_ID } from "../../src/engine/types.ts";
import { buildCards, buildLevelLimits } from "./build-cards.ts";
import { Classifier, mergeTaxonomy } from "./classify.ts";
import type { RawFilterRow, Tables } from "./tables.ts";

const PARAM = ["ProduceEffectType_VocalAddition", "ProduceEffectType_DanceAddition", "ProduceEffectType_VisualAddition"];
const GAME: RawFilterRow[] = [
  { id: "g-initial", title: "初期パラメータ上昇", order: 1, produceEffectTypes: PARAM, produceTriggerIds: ["p_trigger-produce_start-initial"] },
  { id: "g-shop", title: "相談選択時パラメータ上昇", order: 28, produceEffectTypes: PARAM, produceTriggerIds: ["p_trigger-start_shop"] },
  { id: "g-bonus", title: "パラメータボーナス+", order: 2, produceEffectTypes: ["ProduceEffectType_VocalGrowthRateAddition"], produceTriggerIds: ["p_trigger-produce_start-no_description"] },
];

/**
 * One SSR card with: an initial-parameter skill upgrading at levels 1 and 20,
 * a parameter-bonus skill from level 1, an own-event bonus skill from level 1
 * (50%) upgrading at level 20 (75%), event 1 granting an item (fireLimit 2,
 * Vo+30 on 相談選択時 with a stat condition), event 2 at level 20 giving Vo+20,
 * event 3 at level 40 giving a card upgrade (scores 0).
 */
function fixture(): Tables {
  return {
    cards: [
      { id: "s_card-3-9999", name: "テスト", type: "SupportCardType_Vocal", rarity: "SupportCardRarity_Ssr", planType: "ProducePlanType_Plan1", assetId: "csprt-3-9999", supportCardLevelLimitId: "lim-3" },
      { id: "s_card-1-9999", name: "テストR", type: "SupportCardType_Assist", rarity: "SupportCardRarity_R", planType: "ProducePlanType_Common", assetId: "csprt-1-9999", supportCardLevelLimitId: "lim-1" },
      { id: "s_card-2-9999", name: "テストSR", type: "SupportCardType_Dance", rarity: "SupportCardRarity_Sr", planType: "ProducePlanType_Plan2", assetId: "csprt-2-9999", supportCardLevelLimitId: "lim-2" },
    ],
    skillLevels: [
      { supportCardId: "s_card-3-9999", produceSkillId: "sk-initial", produceSkillLevel: 1, supportCardLevel: 1 },
      { supportCardId: "s_card-3-9999", produceSkillId: "sk-initial", produceSkillLevel: 2, supportCardLevel: 20 },
      { supportCardId: "s_card-3-9999", produceSkillId: "sk-bonus", produceSkillLevel: 1, supportCardLevel: 1 },
      { supportCardId: "s_card-3-9999", produceSkillId: "sk-event-bonus", produceSkillLevel: 1, supportCardLevel: 1 },
      { supportCardId: "s_card-3-9999", produceSkillId: "sk-event-bonus", produceSkillLevel: 2, supportCardLevel: 20 },
    ],
    skills: [
      skill("sk-initial", 1, "e-initial-10", "p_trigger-produce_start-initial", 1),
      skill("sk-initial", 2, "e-initial-20", "p_trigger-produce_start-initial", 1),
      skill("sk-bonus", 1, "e-bonus-85", "p_trigger-produce_start-no_description", 1),
      skill("sk-event-bonus", 1, "e-evbonus-500", "p_trigger-produce_start-no_description", 1),
      skill("sk-event-bonus", 2, "e-evbonus-750", "p_trigger-produce_start-no_description", 1),
    ],
    effects: [
      effect("e-initial-10", "ProduceEffectType_VocalAddition", 10),
      effect("e-initial-20", "ProduceEffectType_VocalAddition", 20),
      effect("e-bonus-85", "ProduceEffectType_VocalGrowthRateAddition", 85),
      effect("e-evbonus-500", "ProduceEffectType_SupportCardEventParameterAdditionValueUp", 500),
      effect("e-evbonus-750", "ProduceEffectType_SupportCardEventParameterAdditionValueUp", 750),
      { ...effect("e-grant-item", "ProduceEffectType_ProduceReward", 1), produceRewards: [{ resourceType: "ProduceResourceType_ProduceItem", resourceId: "pitem-x" }] },
      effect("e-event-vo20", "ProduceEffectType_VocalAddition", 20),
      effect("e-card-upgrade", "ProduceEffectType_ProduceCardUpgrade", 1),
      effect("e-item-vo30", "ProduceEffectType_VocalAddition", 30),
    ],
    triggers: [
      { id: "p_trigger-produce_start-initial", phaseType: "ProducePhaseType_ProduceStart" },
      { id: "p_trigger-produce_start-no_description", phaseType: "ProducePhaseType_ProduceStart" },
      { id: "p_trigger-start_shop", phaseType: "ProducePhaseType_StartShop" },
      { id: "p_trigger-start_shop-vocal-0400_0000", phaseType: "ProducePhaseType_StartShop" },
    ],
    filterRows: GAME,
    levelLimits: [
      ...[40, 45, 50, 55, 60].map((lv, i) => ({ id: "lim-3", rank: rank(i), levelLimit: lv })),
      ...[20, 25, 30, 35, 40].map((lv, i) => ({ id: "lim-1", rank: rank(i), levelLimit: lv })),
      ...[30, 35, 40, 45, 50].map((lv, i) => ({ id: "lim-2", rank: rank(i), levelLimit: lv })),
    ],
    eventCards: [
      { supportCardId: "s_card-3-9999", number: 1, supportCardLevel: 1, produceStepEventDetailId: "ev-1" },
      { supportCardId: "s_card-3-9999", number: 2, supportCardLevel: 20, produceStepEventDetailId: "ev-2" },
      { supportCardId: "s_card-3-9999", number: 3, supportCardLevel: 40, produceStepEventDetailId: "ev-3" },
      { supportCardId: "s_card-1-9999", number: 1, supportCardLevel: 1, produceStepEventDetailId: "ev-r1" },
    ],
    eventDetails: [
      { id: "ev-1", produceEffectIds: ["e-grant-item"] },
      { id: "ev-2", produceEffectIds: ["e-event-vo20"] },
      { id: "ev-3", produceEffectIds: ["e-card-upgrade"] },
      { id: "ev-r1", produceEffectIds: ["e-card-upgrade"] },
    ],
    items: [{ id: "pitem-x", name: "テストアイテム", fireLimit: 2, produceTriggerId: "", skills: [{ produceTriggerId: "p_trigger-start_shop-vocal-0400_0000", produceItemEffectId: "ie-x" }] }],
    itemEffects: [{ id: "ie-x", effectType: "ProduceItemEffectType_ProduceEffect", produceEffectId: "e-item-vo30" }],
  };
}

function rank(i: number): string {
  return i === 0 ? "SupportCardLevelLimitRank_Unknown" : `SupportCardLevelLimitRank__${i}`;
}
function skill(id: string, level: number, effectId: string, triggerId: string, activationCount: number) {
  return { id, level, activationCount, produceEffectId1: effectId, produceTriggerId1: triggerId, produceEffectId2: "", produceTriggerId2: "", produceEffectId3: "", produceTriggerId3: "" };
}
function effect(id: string, produceEffectType: string, value: number) {
  return { id, produceEffectType, effectValueMin: value, effectValueMax: value, produceRewards: [] };
}

const classifier = new Classifier(mergeTaxonomy(GAME, []));

describe("buildCards", () => {
  const { cards, report } = buildCards(fixture(), classifier);
  const card = cards.find((c) => c.id === "s_card-3-9999");
  const rCard = cards.find((c) => c.id === "s_card-1-9999");

  test("maps identity enums and sorts cards by id", () => {
    expect(cards.map((c) => c.id)).toEqual(["s_card-1-9999", "s_card-2-9999", "s_card-3-9999"]);
    expect(card).toMatchObject({ name: "テスト", type: "vocal", rarity: "ssr", plan: "sense", assetId: "csprt-3-9999" });
    expect(rCard).toMatchObject({ type: "assist", rarity: "r", plan: "common" });
  });

  test("breakpoints appear at every level where skills or events change, deduplicated", () => {
    expect(card?.breakpoints.map((b) => b.minLevel)).toEqual([1, 20]);
    // level 40 only adds a card-upgrade event, which changes nothing scoreable
  });

  test("level 1: skills, parameter bonus in tenths of a percent, item from event 1 with its cap, event bonus 50%", () => {
    const bp = card?.breakpoints[0];
    expect(bp?.eventBonusPermil).toBe(500);
    expect(bp?.effects).toEqual([
      { categoryId: "g-shop", stat: "vocal", value: 30, kind: "item", itemId: "pitem-x", itemName: "テストアイテム", cap: 2 },
      { categoryId: "g-bonus", stat: "vocal", value: 85, kind: "skill", cap: 1 },
      { categoryId: "g-initial", stat: "vocal", value: 10, kind: "skill", cap: 1 },
    ]);
  });

  test("level 20: upgraded skill value, event 2 reward, event bonus 75%", () => {
    const bp = card?.breakpoints[1];
    expect(bp?.eventBonusPermil).toBe(750);
    expect(bp?.effects).toContainEqual({ categoryId: "g-initial", stat: "vocal", value: 20, kind: "skill", cap: 1 });
    expect(bp?.effects).toContainEqual({ categoryId: EVENT_CATEGORY_ID, stat: "vocal", value: 20, kind: "event" });
    expect(bp?.effects.filter((e) => e.kind === "item")).toHaveLength(1);
  });

  test("a card with no parameter effect keeps one empty breakpoint (D10)", () => {
    expect(rCard?.breakpoints).toEqual([{ minLevel: 1, effects: [], eventBonusPermil: 0 }]);
  });

  test("report: nothing unclassified, the item trigger resolved by prefix, card-upgrade skipped", () => {
    expect(report.unclassified).toEqual([]);
    expect(report.matches.prefix).toBeGreaterThan(0);
    expect(report.skippedByType.get("ProduceEffectType_ProduceCardUpgrade")).toBe(2);
  });

  test("unclassified pairs are reported once with an example, not thrown", () => {
    const t = fixture();
    t.effects.push(effect("e-orphan", "ProduceEffectType_DanceAddition", 5));
    t.triggers.push({ id: "p_trigger-orphan", phaseType: "ProducePhaseType_Unknown" });
    t.skills.push(skill("sk-orphan", 1, "e-orphan", "p_trigger-orphan", 0));
    t.skillLevels.push({ supportCardId: "s_card-3-9999", produceSkillId: "sk-orphan", produceSkillLevel: 1, supportCardLevel: 1 });
    const r = buildCards(t, classifier).report;
    expect(r.unclassified).toEqual([{ effectType: "ProduceEffectType_DanceAddition", triggerId: "p_trigger-orphan", reason: "no-row", candidateRowIds: [], example: "s_card-3-9999 sk-orphan" }]);
  });

  test("unknown enum values throw naming the card", () => {
    const t = fixture();
    t.cards[0]!.planType = "ProducePlanType_Plan9";
    expect(() => buildCards(t, classifier)).toThrow('s_card-3-9999: unknown planType "ProducePlanType_Plan9"');
  });

  test("dangling ids throw", () => {
    const t = fixture();
    t.eventDetails[1]!.produceEffectIds = ["e-missing"];
    expect(() => buildCards(t, classifier)).toThrow("missing ProduceEffect e-missing");
  });

  test("an item effect of an unknown type throws instead of scoring 0", () => {
    const t = fixture();
    t.itemEffects[0]!.effectType = "ProduceItemEffectType_Bogus";
    expect(() => buildCards(t, classifier)).toThrow('item pitem-x テストアイテム: unknown ProduceItemEffect type "ProduceItemEffectType_Bogus"');
  });

  test("an event reward of a resource type the engine does not know throws instead of being dropped", () => {
    const t = fixture();
    t.effects.find((e) => e.id === "e-grant-item")!.produceRewards = [{ resourceType: "ProduceResourceType_ProduceDrink", resourceId: "pdrink-x" }];
    expect(() => buildCards(t, classifier)).toThrow('s_card-3-9999 event #1: unsupported reward "ProduceResourceType_ProduceDrink" (pdrink-x)');
  });

  test("a skill (not an event) granting a P-item throws instead of being skipped as a reward", () => {
    const t = fixture();
    t.skills.push(skill("sk-grant", 1, "e-grant-item", "p_trigger-produce_start-no_description", 1));
    t.skillLevels.push({ supportCardId: "s_card-3-9999", produceSkillId: "sk-grant", produceSkillLevel: 1, supportCardLevel: 1 });
    expect(() => buildCards(t, classifier)).toThrow("s_card-3-9999 sk-grant: a skill granting a P-item (pitem-x) is not supported");
  });

  test("a taxonomy row for a non-parameter effect type is counted in the skipped report", () => {
    const t = fixture();
    const rows = [...GAME, { id: "g-sp", title: "SPレッスン発生率+", order: 3, produceEffectTypes: ["ProduceEffectType_LessonSpChangeRatePermilAddition"], produceTriggerIds: ["p_trigger-produce_start-no_description"] }];
    t.effects.push(effect("e-sp", "ProduceEffectType_LessonSpChangeRatePermilAddition", 100));
    t.skills.push(skill("sk-sp", 1, "e-sp", "p_trigger-produce_start-no_description", 1));
    t.skillLevels.push({ supportCardId: "s_card-3-9999", produceSkillId: "sk-sp", produceSkillLevel: 1, supportCardLevel: 1 });
    const r = buildCards(t, new Classifier(mergeTaxonomy(rows, []))).report;
    expect(r.unclassified).toEqual([]);
    expect(r.skippedByType.get("ProduceEffectType_LessonSpChangeRatePermilAddition")).toBe(3); // once per breakpoint level (1, 20, 40) the skill is active at
  });
});

describe("buildLevelLimits", () => {
  test("maps each rarity to its five levels", () => {
    expect(buildLevelLimits(fixture())).toEqual({ r: [20, 25, 30, 35, 40], sr: [30, 35, 40, 45, 50], ssr: [40, 45, 50, 55, 60] });
  });

  test("a rarity split across two limit tables throws", () => {
    const t = fixture();
    t.cards.push({ id: "s_card-1-9998", name: "テストR2", type: "SupportCardType_Vocal", rarity: "SupportCardRarity_R", planType: "ProducePlanType_Common", assetId: "csprt-1-9998", supportCardLevelLimitId: "lim-3" });
    expect(() => buildLevelLimits(t)).toThrow("rarity r uses two level-limit tables: lim-1 and lim-3 (s_card-1-9998)");
  });
});
