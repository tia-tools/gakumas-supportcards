import { describe, expect, test } from "bun:test";
import { buildCards, buildLevelLimits } from "./build-cards.ts";
import type { Tables } from "./tables.ts";

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

describe("buildCards", () => {
  const { cards, report } = buildCards(fixture());
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
      { stat: "vocal", value: 30, kind: "item", itemId: "pitem-x", itemName: "テストアイテム", cap: 2, trigger: { occasion: "StartShop", conditions: [{ kind: "vocal", min: 400, max: 0 }] } },
      { stat: "vocal", value: 85, kind: "skill", cap: 1, trigger: { occasion: "ProduceStart" }, bonus: true },
      { stat: "vocal", value: 10, kind: "skill", cap: 1, trigger: { occasion: "ProduceStart" } },
    ]);
  });

  test("level 20: upgraded skill value, event 2 reward, event bonus 75%", () => {
    const bp = card?.breakpoints[1];
    expect(bp?.eventBonusPermil).toBe(750);
    expect(bp?.effects).toContainEqual({ stat: "vocal", value: 20, kind: "skill", cap: 1, trigger: { occasion: "ProduceStart" } });
    expect(bp?.effects).toContainEqual({ stat: "vocal", value: 20, kind: "event" });
    expect(bp?.effects.filter((e) => e.kind === "item")).toHaveLength(1);
  });

  test("a card with no parameter effect keeps one empty breakpoint (D10)", () => {
    expect(rCard?.breakpoints).toEqual([{ minLevel: 1, effects: [], eventBonusPermil: 0 }]);
  });

  test("report: nothing held, the occasions in use, card-upgrade skipped", () => {
    expect(report.held).toEqual([]);
    expect([...report.occasionsUsed].sort()).toEqual(["ProduceStart", "StartShop"]);
    expect(report.skippedByType.get("ProduceEffectType_ProduceCardUpgrade")).toBe(2);
  });

  /** Adds a Dance +5 skill on `triggerId` to the SSR fixture card. */
  function withSkill(triggerId: string, phase: string, effectType = "ProduceEffectType_DanceAddition"): Tables {
    const t = fixture();
    t.effects.push(effect("e-extra", effectType, 5));
    t.triggers.push({ id: triggerId, phaseType: `ProducePhaseType_${phase}` });
    t.skills.push(skill("sk-extra", 1, "e-extra", triggerId, 0));
    t.skillLevels.push({ supportCardId: "s_card-3-9999", produceSkillId: "sk-extra", produceSkillLevel: 1, supportCardLevel: 1 });
    return t;
  }

  test("a trigger piece of unknown kind holds that card only, once, and leaves the effect out instead of throwing", () => {
    const r = buildCards(withSkill("p_trigger-start_shop-mystery", "StartShop"));
    expect(r.report.held).toEqual([{ id: "s_card-3-9999", name: "テスト", reasons: ["s_card-3-9999 sk-extra: trigger p_trigger-start_shop-mystery has a piece of unknown kind: mystery"] }]);
    const held = r.cards.find((c) => c.id === "s_card-3-9999");
    expect(held?.breakpoints.flatMap((b) => b.effects).some((e) => e.stat === "dance")).toBe(false);
    expect(held?.breakpoints[0]?.effects).toHaveLength(3);
  });

  test("a never-seen threshold piece is a condition, counted without anyone deciding (C4)", () => {
    const r = buildCards(withSkill("p_trigger-start_shop-produce_point-1000_0000", "StartShop"));
    expect(r.report.held).toEqual([]);
    expect(r.cards.find((c) => c.id === "s_card-3-9999")?.breakpoints[0]?.effects).toContainEqual({
      stat: "dance",
      value: 5,
      kind: "skill",
      trigger: { occasion: "StartShop", conditions: [{ kind: "produce_point", min: 1000, max: 0 }] },
    });
  });

  test("an effect type that is neither a stat nor audited holds the card", () => {
    const r = buildCards(withSkill("p_trigger-start_shop", "StartShop", "ProduceEffectType_BrandNewThing")).report;
    expect(r.held.map((h) => h.id)).toEqual(["s_card-3-9999"]);
    expect(r.held[0]?.reasons[0]).toContain("ProduceEffectType_BrandNewThing is neither a stat nor audited");
  });

  test("a stat-named effect type that is neither 上昇 nor パラメータボーナス is not assumed to be points per occurrence", () => {
    const r = buildCards(withSkill("p_trigger-start_shop", "StartShop", "ProduceEffectType_DanceLimitAddition"));
    expect(r.report.held.map((h) => h.id)).toEqual(["s_card-3-9999"]);
    expect(r.cards.find((c) => c.id === "s_card-3-9999")?.breakpoints[0]?.effects.some((e) => e.stat === "dance")).toBe(false);
  });

  test("an uncountable effect on a granted P-item holds the card that grants it", () => {
    const t = fixture();
    t.triggers.push({ id: "p_trigger-start_shop-mystery", phaseType: "ProducePhaseType_StartShop" });
    t.items[0]!.skills[0]!.produceTriggerId = "p_trigger-start_shop-mystery";
    const r = buildCards(t);
    expect(r.report.held.map((h) => h.id)).toEqual(["s_card-3-9999"]);
    expect(r.report.held[0]?.reasons[0]).toContain("item pitem-x テストアイテム: trigger p_trigger-start_shop-mystery has a piece of unknown kind: mystery");
    expect(r.cards.find((c) => c.id === "s_card-3-9999")?.breakpoints[0]?.effects.some((e) => e.kind === "item")).toBe(false);
  });

  test("an event effect of an unaudited type holds the card", () => {
    const t = fixture();
    t.effects.push(effect("e-new", "ProduceEffectType_BrandNewThing", 1));
    t.eventDetails[1]!.produceEffectIds = ["e-new"];
    expect(buildCards(t).report.held[0]?.reasons[0]).toContain("s_card-3-9999 event #2: event effect type ProduceEffectType_BrandNewThing");
  });

  test("unknown enum values throw naming the card", () => {
    const t = fixture();
    t.cards[0]!.planType = "ProducePlanType_Plan9";
    expect(() => buildCards(t)).toThrow('s_card-3-9999: unknown planType "ProducePlanType_Plan9"');
  });

  test("dangling ids throw", () => {
    const t = fixture();
    t.eventDetails[1]!.produceEffectIds = ["e-missing"];
    expect(() => buildCards(t)).toThrow("missing ProduceEffect e-missing");
  });

  test("an item effect of an unknown type throws instead of scoring 0", () => {
    const t = fixture();
    t.itemEffects[0]!.effectType = "ProduceItemEffectType_Bogus";
    expect(() => buildCards(t)).toThrow('item pitem-x テストアイテム: unknown ProduceItemEffect type "ProduceItemEffectType_Bogus"');
  });

  test("an event reward of a resource type the engine does not know throws instead of being dropped", () => {
    const t = fixture();
    t.effects.find((e) => e.id === "e-grant-item")!.produceRewards = [{ resourceType: "ProduceResourceType_ProduceDrink", resourceId: "pdrink-x" }];
    expect(() => buildCards(t)).toThrow('s_card-3-9999 event #1: unsupported reward "ProduceResourceType_ProduceDrink" (pdrink-x)');
  });

  test("a skill (not an event) granting a P-item throws instead of being skipped as a reward", () => {
    const t = fixture();
    t.skills.push(skill("sk-grant", 1, "e-grant-item", "p_trigger-produce_start-no_description", 1));
    t.skillLevels.push({ supportCardId: "s_card-3-9999", produceSkillId: "sk-grant", produceSkillLevel: 1, supportCardLevel: 1 });
    expect(() => buildCards(t)).toThrow("s_card-3-9999 sk-grant: a skill granting a P-item (pitem-x) is not supported");
  });

  test("an audited non-parameter effect type is skipped and counted, not held", () => {
    const t = fixture();
    t.effects.push(effect("e-sp", "ProduceEffectType_LessonSpChangeRatePermilAddition", 100));
    t.skills.push(skill("sk-sp", 1, "e-sp", "p_trigger-produce_start-no_description", 1));
    t.skillLevels.push({ supportCardId: "s_card-3-9999", produceSkillId: "sk-sp", produceSkillLevel: 1, supportCardLevel: 1 });
    const r = buildCards(t).report;
    expect(r.held).toEqual([]);
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
