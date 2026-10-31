import { describe, expect, test } from "bun:test";
import { buildIdols, buildSkillCardData, stepLabel } from "./build-skillcards.ts";
import type { RawCardCustomize, RawProduceCard, RawProduceSkill, SkillCardTables } from "./tables.ts";

const NOW = 1_800_000_000_000;
const HIF = "produce_group-003";

function card(id: string, upgradeCount: number, over: Partial<RawProduceCard> = {}): RawProduceCard {
  return {
    id,
    upgradeCount,
    name: `${id}${"+".repeat(upgradeCount)}`,
    assetId: `img_general_skillcard_${id.slice(10)}`,
    isCharacterAsset: false,
    rarity: "ProduceCardRarity_R",
    planType: "ProducePlanType_Plan1",
    category: "ProduceCardCategory_ActiveSkill",
    searchTag: "",
    originSupportCardId: "",
    produceCardCustomizeIds: [],
    maxCustomizeCount: 0,
    viewStartTime: "0",
    order: `2${id.slice(-3)}000`,
    ...over,
  };
}

function step(id: string, customizeCount: number, description: string, grow: string, overwrite = "ProduceCardGrowEffectType_Unknown"): RawCardCustomize {
  return { id, customizeCount, description, overwriteProduceCardGrowEffectType: overwrite, produceCardGrowEffectIds: [grow] };
}

function skill(id: string, effect: string): RawProduceSkill {
  return { id, level: 1, activationCount: 1, produceEffectId1: effect, produceTriggerId1: "p_trigger-start_audition-for_hif_memory", produceEffectId2: "", produceTriggerId2: "", produceEffectId3: "", produceTriggerId3: "" };
}

const hifEffect = (cardId: string): string => `p_effect-exam_status_enchant-enchant-p_ef-hif_memory-${cardId}-enc02`;

/**
 * Two plan cards with a +, a free card, 表現の基本 and every kind of card the pool leaves out,
 * two customization kinds (one labelled by its rows, one by its grow effect), two guide
 * categories, three characters (one not playable) and three memory abilities (one H.I.F.
 * ability of a pool card, one of a card not released yet, one of another scenario).
 */
function fixture(): { tables: SkillCardTables; skills: RawProduceSkill[] } {
  const withKinds = { produceCardCustomizeIds: ["k-desc", "k-generic"], maxCustomizeCount: 2 };
  const tables: SkillCardTables = {
    cards: [
      card("p_card-01-act-1_002", 0, { order: "21010020000002" }),
      card("p_card-01-act-1_002", 1, { order: "21010020000002", ...withKinds }),
      card("p_card-01-act-1_002", 2, { order: "21010020000002", ...withKinds }),
      card("p_card-02-men-2_001", 0, { order: "21010020000001", rarity: "ProduceCardRarity_Sr", planType: "ProducePlanType_Plan2", category: "ProduceCardCategory_MentalSkill", isCharacterAsset: true }),
      card("p_card-02-men-2_001", 1, { order: "21010020000001", rarity: "ProduceCardRarity_Sr", planType: "ProducePlanType_Plan2", category: "ProduceCardCategory_MentalSkill", isCharacterAsset: true }),
      card("p_card-00-act-0_001", 0, { planType: "ProducePlanType_Common", rarity: "ProduceCardRarity_N", viewStartTime: String(NOW) }),
      card("p_card-00-men-0_003", 0, { searchTag: "starter", planType: "ProducePlanType_Common", rarity: "ProduceCardRarity_N" }),
      card("p_card-00-men-0_003", 1, { searchTag: "starter", planType: "ProducePlanType_Common", rarity: "ProduceCardRarity_N" }),
      card("p_card-00-act-0_002", 0, { searchTag: "starter", planType: "ProducePlanType_Common" }),
      card("p_card-01-ido-3_001", 0, { searchTag: "idol-unique" }),
      card("p_card-01-sup-3_001", 0, { originSupportCardId: "s_card-3-0001" }),
      card("p_card-00-acc-0_002", 0, { category: "ProduceCardCategory_Trouble", planType: "ProducePlanType_Common" }),
      card("p_card-01-act-100_003", 0, { rarity: "ProduceCardRarity_Legend" }),
      card("p_card-01-act-3_900", 0, { viewStartTime: String(NOW + 1) }),
    ],
    customizes: [
      step("k-desc", 2, "レッスン中1回\\nの制限削除", "g-lesson"),
      step("k-desc", 1, "好調追加", "g-effect", "ProduceCardGrowEffectType_ParameterBuffTurnAdd"),
      step("k-generic", 1, "", "g-lesson"),
    ],
    growEffects: [
      { id: "g-lesson", effectType: "ProduceCardGrowEffectType_LessonAdd" },
      { id: "g-effect", effectType: "ProduceCardGrowEffectType_EffectAdd" },
      { id: "g-count", effectType: "ProduceCardGrowEffectType_LessonCountAdd" },
    ],
    growEffectDescriptions: [
      { type: "ProduceCardGrowEffectType_LessonAdd", produceCardCustomizeDescription: "パラメータ+" },
      { type: "ProduceCardGrowEffectType_EffectAdd", produceCardCustomizeDescription: "効果追加" },
      { type: "ProduceCardGrowEffectType_ParameterBuffTurnAdd", produceCardCustomizeDescription: "好調+" },
      { type: "ProduceCardGrowEffectType_LessonCountAdd", produceCardCustomizeDescription: "パラメータ\\n上昇回数+" },
    ],
    memoryAbilities: [
      { id: "memory_ability-hif-b", skillId: "sk-hif-b", produceGroupIds: [HIF] },
      { id: "memory_ability-hif-a", skillId: "sk-hif-a", produceGroupIds: [HIF] },
      { id: "memory_ability-hif-future", skillId: "sk-hif-future", produceGroupIds: [HIF] },
      { id: "memory_ability-nia", skillId: "sk-nia", produceGroupIds: ["produce_group-002"] },
    ],
    guideCategories: [
      { label: "好調を増加するスキルカード", produceCardIds: ["p_card-01-act-1_002"] },
      { label: "その他のスキルカード", produceCardIds: ["p_card-02-men-2_001", "p_card-01-act-1_002"] },
      { label: "好調を増加するスキルカード", produceCardIds: ["p_card-01-act-1_002"] },
    ],
    characters: [
      { id: "ttmr", lastName: "月村", firstName: "手毬", isPlayable: true, order: 20 },
      { id: "nasr", lastName: "根緒", firstName: "亜紗里", isPlayable: false, order: 9999 },
      { id: "hski", lastName: "花海", firstName: "咲季", isPlayable: true, order: 10 },
    ],
  };
  const skills = [
    skill("sk-hif-a", hifEffect("p_card-01-act-1_002")),
    skill("sk-hif-b", hifEffect("p_card-02-men-2_001")),
    skill("sk-hif-future", hifEffect("p_card-01-act-3_900")),
    skill("sk-nia", "p_effect-something-else"),
  ];
  return { tables, skills };
}

function build(edit: (f: { tables: SkillCardTables; skills: RawProduceSkill[] }) => void = () => undefined): ReturnType<typeof buildSkillCardData> {
  const f = fixture();
  edit(f);
  return buildSkillCardData(f.tables, f.skills, NOW);
}

describe("the pool", () => {
  test("holds released cards at levels 0 and 1, and level 0 of 表現の基本 among starters", () => {
    expect(build().cards.map((c) => `${c.id}:${c.upgrade}`)).toEqual([
      "p_card-00-act-0_001:0",
      "p_card-00-men-0_003:0",
      "p_card-02-men-2_001:0",
      "p_card-02-men-2_001:1",
      "p_card-01-act-1_002:0",
      "p_card-01-act-1_002:1",
    ]);
  });

  test("lists cards in the game's order, base before +", () => {
    const orders = build().cards.map((c) => `${c.order}:${c.upgrade}`);
    expect(orders).toEqual([...orders].sort());
  });

  test("maps plan, rarity, type and art, and keeps the game's name and order", () => {
    const sr = build().cards.find((c) => c.id === "p_card-02-men-2_001" && c.upgrade === 1);
    expect(sr).toEqual({
      id: "p_card-02-men-2_001",
      upgrade: 1,
      name: "p_card-02-men-2_001+",
      plan: "logic",
      rarity: "SR",
      type: "mental",
      order: "21010020000001",
      guideLabels: ["その他のスキルカード"],
      art: { asset: "img_general_skillcard_men-2_001", perIdol: true },
      customization: { limit: 0, kinds: [] },
    });
    expect(build().cards.find((c) => c.id === "p_card-00-act-0_001")?.plan).toBe("free");
  });

  test("gives each card its guide labels in the order the categories are listed, without repeats", () => {
    expect(build().cards.find((c) => c.id === "p_card-01-act-1_002")?.guideLabels).toEqual(["好調を増加するスキルカード", "その他のスキルカード"]);
  });

  test("gives a + card its customization kinds, steps in order, each labelled", () => {
    const plus = build().cards.find((c) => c.id === "p_card-01-act-1_002" && c.upgrade === 1);
    expect(plus?.customization).toEqual({
      limit: 2,
      kinds: [
        { id: "k-desc", steps: [{ step: 1, label: "好調追加" }, { step: 2, label: "レッスン中1回\nの制限削除" }] },
        { id: "k-generic", steps: [{ step: 1, label: "パラメータ+" }] },
      ],
    });
  });
});

describe("customization labels", () => {
  const { tables } = fixture();
  const sources = {
    growTypeById: new Map(tables.growEffects.map((g) => [g.id, g.effectType])),
    labelByGrowType: new Map(tables.growEffectDescriptions.map((d) => [d.type, d.produceCardCustomizeDescription])),
  };

  test("fall back to the grow effect's generic label, the game's \\n becoming a line break", () => {
    expect(stepLabel(step("k", 1, "", "g-count"), sources)).toBe("パラメータ\n上昇回数+");
  });

  test("stop when an overwrite type would label a step without description differently", () => {
    expect(() => stepLabel(step("k-x", 1, "", "g-effect", "ProduceCardGrowEffectType_ParameterBuffTurnAdd"), sources)).toThrow(/k-x step 1: no description, and its overwrite type/);
    expect(stepLabel(step("k-y", 1, "", "g-lesson", "ProduceCardGrowEffectType_LessonAdd"), sources)).toBe("パラメータ+");
  });

  test("stop when neither the step nor its grow effect gives a label, or the grow effect is missing", () => {
    expect(() => stepLabel(step("k-z", 1, "", "g-none"), sources)).toThrow(/k-z step 1: missing ProduceCardGrowEffect g-none/);
    const unlabelled = { ...sources, labelByGrowType: new Map<string, string>() };
    expect(() => stepLabel(step("k-z", 1, "", "g-lesson"), unlabelled)).toThrow(/k-z step 1: no description and no label/);
  });
});

describe("idols", () => {
  test("are the playable characters in the game's order, with their full names", () => {
    expect(build().idols).toEqual([
      { id: "hski", name: "花海咲季" },
      { id: "ttmr", name: "月村手毬" },
    ]);
  });

  test("stop when two playable idols share an order", () => {
    const { tables } = fixture();
    expect(() => buildIdols(tables.characters.map((c) => ({ ...c, order: 10 })))).toThrow(/share order 10/);
  });
});

describe("H.I.F. abilities", () => {
  test("name the card in their skill's effect id, by ability id, leaving out a card not released yet", () => {
    expect(build().hifAbilities).toEqual([
      { id: "memory_ability-hif-a", card: "p_card-01-act-1_002" },
      { id: "memory_ability-hif-b", card: "p_card-02-men-2_001" },
    ]);
  });

  test("stop, naming the ability, when its effect id has another form or its skill is missing", () => {
    expect(() => build((f) => f.skills.splice(0, 1, skill("sk-hif-a", "p_effect-other")))).toThrow(/memory_ability-hif-a: its skill sk-hif-a/);
    expect(() => build((f) => f.skills.splice(0, 1))).toThrow(/memory_ability-hif-a: missing ProduceSkill/);
  });

  test("stop, naming the ability, when the card does not exist or is released outside the pool", () => {
    expect(() => build((f) => f.skills.splice(0, 1, skill("sk-hif-a", hifEffect("p_card-09-act-9_999"))))).toThrow(/memory_ability-hif-a: names p_card-09-act-9_999, which is not a ProduceCard/);
    expect(() => build((f) => f.skills.splice(0, 1, skill("sk-hif-a", hifEffect("p_card-01-ido-3_001"))))).toThrow(/memory_ability-hif-a: names p_card-01-ido-3_001 .*released but not in the pool/);
  });
});

describe("a dump that looks broken stops the run", () => {
  test("an unknown rarity, plan or category on a card the pool would hold, naming the row", () => {
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-act-1_050", 0, { rarity: "ProduceCardRarity_Ur" })))).toThrow(/p_card-01-act-1_050 level 0: unknown rarity "ProduceCardRarity_Ur"/);
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-act-1_050", 0, { planType: "ProducePlanType_Plan4" })))).toThrow(/unknown plan/);
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-act-1_050", 0, { category: "ProduceCardCategory_X" })))).toThrow(/unknown category/);
  });

  test("but not an unknown value on a card the pool leaves out anyway", () => {
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-ido-3_050", 0, { searchTag: "idol-unique", rarity: "ProduceCardRarity_Ur" })))).not.toThrow();
  });

  test("a customization kind that resolves to nothing", () => {
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-act-1_050", 1, { produceCardCustomizeIds: ["k-gone"] })))).toThrow(/p_card-01-act-1_050 level 1: missing ProduceCardCustomize k-gone/);
  });

  test("a release time that is neither \"0\" nor epoch milliseconds", () => {
    expect(() => build((f) => f.tables.cards.push(card("p_card-01-act-1_050", 0, { viewStartTime: "2026-10-31" })))).toThrow(/viewStartTime "2026-10-31"/);
  });
});
