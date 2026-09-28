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
    items: [{ id: "pitem-x", name: "テストアイテム", assetId: "img_general_pitem_9-999", fireLimit: 2, produceTriggerId: "", skills: [{ produceTriggerId: "p_trigger-start_shop-vocal-0400_0000", produceItemEffectId: "ie-x" }] }],
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
/** The fixture row, or a thrown error naming what was missing, so a test fails where the gap is. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} is missing from the fixture`);
  return value;
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

  test("a granted P-item with a stat effect is listed on the card with its cap and asset; a card granting none has no list (A9)", () => {
    expect(card?.items).toEqual([{ itemId: "pitem-x", itemName: "テストアイテム", assetId: "img_general_pitem_9-999", cap: 2 }]);
    expect(rCard).not.toHaveProperty("items");
  });

  test("report: nothing held, the occasions in use, card-upgrade skipped", () => {
    expect(report.held).toEqual([]);
    expect([...report.occasionsUsed].sort()).toEqual(["ProduceStart", "StartShop"]);
    expect(report.skippedByType.get("ProduceEffectType_ProduceCardUpgrade")).toBe(2);
  });
});

describe("buildCards: what holds a card, and what stops the run", () => {
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
    must(t.items[0]?.skills[0], "the item's skill").produceTriggerId = "p_trigger-start_shop-mystery";
    const r = buildCards(t);
    expect(r.report.held.map((h) => h.id)).toEqual(["s_card-3-9999"]);
    expect(r.report.held[0]?.reasons[0]).toContain("item pitem-x テストアイテム: trigger p_trigger-start_shop-mystery has a piece of unknown kind: mystery");
    expect(r.cards.find((c) => c.id === "s_card-3-9999")?.breakpoints[0]?.effects.some((e) => e.kind === "item")).toBe(false);
  });

  test("an event effect of an unaudited type holds the card", () => {
    const t = fixture();
    t.effects.push(effect("e-new", "ProduceEffectType_BrandNewThing", 1));
    must(t.eventDetails[1], "event #2").produceEffectIds = ["e-new"];
    expect(buildCards(t).report.held[0]?.reasons[0]).toContain("s_card-3-9999 event #2: event effect type ProduceEffectType_BrandNewThing");
  });

  test("unknown enum values throw naming the card", () => {
    const t = fixture();
    must(t.cards[0], "the SSR card").planType = "ProducePlanType_Plan9";
    expect(() => buildCards(t)).toThrow('s_card-3-9999: unknown planType "ProducePlanType_Plan9"');
  });

  test("dangling ids throw", () => {
    const t = fixture();
    must(t.eventDetails[1], "event #2").produceEffectIds = ["e-missing"];
    expect(() => buildCards(t)).toThrow("missing ProduceEffect e-missing");
  });

  test("an item effect of an unknown type throws instead of scoring 0", () => {
    const t = fixture();
    must(t.itemEffects[0], "the item effect").effectType = "ProduceItemEffectType_Bogus";
    expect(() => buildCards(t)).toThrow('item pitem-x テストアイテム: unknown ProduceItemEffect type "ProduceItemEffectType_Bogus"');
  });

  test("an event reward of a resource type the engine does not know throws instead of being dropped", () => {
    const t = fixture();
    must(t.effects.find((e) => e.id === "e-grant-item"), "e-grant-item").produceRewards = [{ resourceType: "ProduceResourceType_ProduceDrink", resourceId: "pdrink-x" }];
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

  test("an SP発生率+ skill from level 1 marks the card spRate and stays out of its effects; a card without one has no flag", () => {
    const t = fixture();
    t.effects.push(effect("e-sp", "ProduceEffectType_LessonVocalSpChangeRatePermilAddition", 105));
    t.skills.push(skill("sk-sp", 1, "e-sp", "p_trigger-produce_start-no_description", 1));
    t.skillLevels.push({ supportCardId: "s_card-3-9999", produceSkillId: "sk-sp", produceSkillLevel: 1, supportCardLevel: 1 });
    const { cards } = buildCards(t);
    const flagged = cards.find((c) => c.id === "s_card-3-9999");
    expect(flagged?.spRate).toBe(true);
    expect(flagged?.breakpoints.flatMap((b) => b.effects).some((e) => e.value === 105)).toBe(false);
    expect(cards.find((c) => c.id === "s_card-2-9999")).not.toHaveProperty("spRate");
  });

  test("an SP発生率+ skill that appears only above level 1 stops the run: the badge would be wrong at 凸0 (decision A15)", () => {
    const t = fixture();
    t.effects.push(effect("e-sp", "ProduceEffectType_LessonSpChangeRatePermilAddition", 105));
    t.skills.push(skill("sk-sp", 1, "e-sp", "p_trigger-produce_start-no_description", 1));
    t.skillLevels.push({ supportCardId: "s_card-3-9999", produceSkillId: "sk-sp", produceSkillLevel: 1, supportCardLevel: 20 });
    expect(() => buildCards(t)).toThrow("s_card-3-9999: SP発生率+ appears at level 20 but not at level 1");
  });
});

describe("buildCards: granted P-items that count (Milestone 3 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md)", () => {
  /** The fixture with a second item `pitem-d` granted by event #2, whose one skill is `effectType` with id `effectId` on 相談選択時. */
  function withRewardItem(effectId: string, effectType: string, rewards: { resourceType: string; resourceId: string }[] = []): Tables {
    const t = fixture();
    t.effects.push({ ...effect(effectId, effectType, 0), produceRewards: rewards });
    t.itemEffects.push({ id: "ie-d", effectType: "ProduceItemEffectType_ProduceEffect", produceEffectId: effectId });
    t.items.push({ id: "pitem-d", name: "ドリンク係", assetId: "img_general_pitem_9-998", fireLimit: 0, produceTriggerId: "p_trigger-start_shop", skills: [{ produceTriggerId: "", produceItemEffectId: "ie-d" }] });
    t.effects.push({ ...effect("e-grant-d", "ProduceEffectType_ProduceReward", 1), produceRewards: [{ resourceType: "ProduceResourceType_ProduceItem", resourceId: "pitem-d" }] });
    must(t.eventDetails[1], "event #2").produceEffectIds = ["e-event-vo20", "e-grant-d"];
    return t;
  }
  const itemsOf = (t: Tables) => buildCards(t).cards.find((c) => c.id === "s_card-3-9999")?.items;

  test("a drink-set item is listed with drinks per fire from its id and its trigger; the set is still counted as skipped (A9, A16)", () => {
    const t = withRewardItem("p_effect-produce_reward_set-p_rd-drink_set-all-random-02_02", "ProduceEffectType_ProduceRewardSet");
    const r = buildCards(t);
    expect(itemsOf(t)).toEqual([
      { itemId: "pitem-d", itemName: "ドリンク係", assetId: "img_general_pitem_9-998", drinks: { perFire: 2, trigger: { occasion: "StartShop" } } },
      { itemId: "pitem-x", itemName: "テストアイテム", assetId: "img_general_pitem_9-999", cap: 2 },
    ]);
    expect(r.report.held).toEqual([]);
    expect(r.report.skippedByType.get("ProduceEffectType_ProduceRewardSet")).toBe(1); // an item is read once and cached, whatever levels grant it
  });

  test("a direct drink reward reads its quantity from the effect id", () => {
    const t = withRewardItem("p_effect-produce_reward-0001_0001-produce_drink-pdrink_00-3-001", "ProduceEffectType_ProduceReward", [{ resourceType: "ProduceResourceType_ProduceDrink", resourceId: "pdrink_00-3-001" }]);
    expect(itemsOf(t)?.[0]?.drinks).toEqual({ perFire: 1, trigger: { occasion: "StartShop" } });
  });

  test("a skill-card set or card reward is ignored (A10): no drinks, and no grant when the item has no stat effect either", () => {
    expect(itemsOf(withRewardItem("p_effect-produce_reward_set-p_rd-card_set-r-upgrade_0-random-01_01", "ProduceEffectType_ProduceRewardSet"))).toHaveLength(1);
    expect(itemsOf(withRewardItem("p_effect-produce_reward-0001_0001-produce_card-p_card-03-men-1_039-0", "ProduceEffectType_ProduceReward", [{ resourceType: "ProduceResourceType_ProduceCard", resourceId: "p_card-03-men-1_039" }]))).toHaveLength(1);
  });

  test("a reward set naming neither drink nor card, a ranged quantity, or a quantity-less drink id stops the run (A16)", () => {
    expect(() => buildCards(withRewardItem("p_effect-produce_reward_set-p_rd-mystery-01_01", "ProduceEffectType_ProduceRewardSet"))).toThrow("item pitem-d ドリンク係: reward set p_effect-produce_reward_set-p_rd-mystery-01_01 names neither drink nor card");
    expect(() => buildCards(withRewardItem("p_effect-produce_reward_set-p_rd-drink_set-all-random-01_03", "ProduceEffectType_ProduceRewardSet"))).toThrow("names a range 1..3");
    expect(() => buildCards(withRewardItem("p_effect-produce_reward_set-p_rd-drink_set-all-random", "ProduceEffectType_ProduceRewardSet"))).toThrow("no quantity in reward id");
  });

  test("a drink item on a trigger of unknown kind holds the card and grants no drinks", () => {
    const t = withRewardItem("p_effect-produce_reward_set-p_rd-drink_set-all-random-01_01", "ProduceEffectType_ProduceRewardSet");
    t.triggers.push({ id: "p_trigger-start_shop-mystery", phaseType: "ProducePhaseType_StartShop" });
    must(t.items[1], "pitem-d").produceTriggerId = "p_trigger-start_shop-mystery";
    const r = buildCards(t);
    expect(r.report.held.map((h) => h.id)).toEqual(["s_card-3-9999"]);
    expect(r.cards.find((c) => c.id === "s_card-3-9999")?.items?.some((i) => i.itemId === "pitem-d")).toBe(false);
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
