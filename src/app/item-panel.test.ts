import { describe, expect, test } from "bun:test";
import type { Card, ItemGrant, ParsedTrigger, RouteProfile } from "../engine/types.ts";
import { deckDrinks, itemCapsOf, itemFires, itemKeys, itemRows } from "./item-panel.ts";

const PROFILE: RouteProfile = {
  id: "p",
  name: "p",
  occasions: { EndLesson: 8, GetProduceCard: 20, StartShop: 3, GetProduceDrink: 16 },
  filters: { EndLesson: { lessonKind: { members: { sp: 8, normal: 0 } } }, GetProduceCard: { effectGroup: { default: 10, members: { parameter_buff: 12 } } } },
  lessonSplits: [
    { vocal: 7, dance: 1, visual: 0 },
    { vocal: 1, dance: 7, visual: 0 },
  ],
  parameterBonusBase: () => 0,
};
const ctx = { scenarioId: "hif", profile: PROFILE };

const DANCE_SP: ParsedTrigger = { occasion: "EndLesson", filters: [{ family: "lessonStat", member: "dance" }, { family: "lessonKind", member: "sp" }] };
const GET_BUFF: ParsedTrigger = { occasion: "GetProduceCard", filters: [{ family: "effectGroup", member: "parameter_buff" }], conditions: [{ kind: "dance", min: 700, max: 0 }] };
const SHOP: ParsedTrigger = { occasion: "StartShop" };

const fluffy: ItemGrant = { itemId: "pitem-fluffy", itemName: "ふわふわでもこもこ", assetId: "img_general_pitem_2-004", drinks: { perFire: 2, trigger: DANCE_SP } };
const costume: ItemGrant = { itemId: "pitem-costume", itemName: "びっくり仮装グッズ", assetId: "img_general_pitem_2-112", cap: 2, drinks: { perFire: 1, trigger: GET_BUFF } };
const towel: ItemGrant = { itemId: "pitem-towel", itemName: "切磋琢磨のタオル", assetId: "img_general_pitem_1-001", cap: 1 };

function card(id: string, items: ItemGrant[], effects: Card["breakpoints"][number]["effects"] = []): Card {
  return { id, name: `card ${id}`, assetId: id, type: "dance", rarity: "sr", plan: "common", breakpoints: [{ minLevel: 1, effects, eventBonusPermil: 0 }], items };
}
const fluffyCard = card("c-fluffy", [fluffy]);
const costumeCard = card("c-costume", [costume], [{ stat: "dance", value: 20, kind: "item", itemId: "pitem-costume", itemName: "びっくり仮装グッズ", cap: 2, trigger: GET_BUFF }]);
const towelCard = card("c-towel", [towel], [{ stat: "vocal", value: 30, kind: "item", itemId: "pitem-towel", itemName: "切磋琢磨のタオル", cap: 1, trigger: SHOP }]);
const plain = card("c-plain", []);

describe("itemFires", () => {
  test("a drink item fires as often as its trigger under the preset that favours it, capped by fireLimit (A9)", () => {
    expect(itemFires(fluffyCard, fluffy, ctx)).toBe(7); // 7 dance SP lessons under the Da7 preset, no cap
    expect(itemFires(costumeCard, costume, ctx)).toBe(2); // 12 parameter_buff cards, cap 2
    expect(itemFires(towelCard, towel, ctx)).toBe(1); // 3 相談, cap 1
  });

  test("the ceiling follows the shared counts the player lowered", () => {
    const fewer = { ...ctx, profile: { ...PROFILE, occasions: { ...PROFILE.occasions, StartShop: 0 } } };
    expect(itemFires(towelCard, towel, fewer)).toBe(0);
  });
});

describe("itemRows", () => {
  test("one row per item of the cards in view, in order, with the cap as an extra minimum (A11) and drinks only when ticked", () => {
    const rows = itemRows([towelCard, fluffyCard, plain], ctx, {});
    expect(rows.map((r) => [r.itemId, r.cardName, r.computed, r.value, r.overridden])).toEqual([
      ["pitem-towel", "card c-towel", 1, 1, false],
      ["pitem-fluffy", "card c-fluffy", 7, 7, false],
    ]);
    expect(rows[0]?.drinks).toBeUndefined();
    expect(rows[1]?.drinks).toEqual({ perFire: 2, inDeck: false, added: 0 });
    const capped = itemRows([fluffyCard], ctx, { "i.pitem-fluffy": 3, "d.pitem-fluffy": 1 });
    expect(capped[0]).toMatchObject({ computed: 7, value: 3, overridden: true, drinks: { perFire: 2, inDeck: true, added: 6 } });
    expect(itemRows([fluffyCard], ctx, { "i.pitem-fluffy": 42 })[0]?.value).toBe(7); // never a raise
  });

  test("a mixed item's one count drives both its stat effect's cap and its drinks", () => {
    const rows = itemRows([costumeCard], ctx, { "i.pitem-costume": 1, "d.pitem-costume": 1 });
    expect(rows[0]).toMatchObject({ value: 1, cap: 2, drinks: { perFire: 1, inDeck: true, added: 1 } });
  });

  test("an item two cards grant is listed once, under the first card in view", () => {
    const twin = card("c-twin", [towel]);
    expect(itemRows([twin, towelCard], ctx, {}).map((r) => r.cardName)).toEqual(["card c-twin"]);
  });
});

describe("deckDrinks", () => {
  test("sums fires × drinks per fire over ticked items of all shipped cards, each item once, whether or not its card is in view", () => {
    const all = [fluffyCard, costumeCard, towelCard, card("c-twin", [fluffy])];
    expect(deckDrinks(all, ctx, {})).toBe(0);
    expect(deckDrinks(all, ctx, { "d.pitem-fluffy": 1 })).toBe(14);
    expect(deckDrinks(all, ctx, { "d.pitem-fluffy": 1, "d.pitem-costume": 1, "i.pitem-fluffy": 2 })).toBe(4 + 2);
    expect(deckDrinks(all, ctx, { "d.pitem-towel": 1 })).toBe(0); // not a drink item: no key, no drinks
  });
});

describe("itemCapsOf / itemKeys", () => {
  test("caps are the i. overrides by item id; keys are a cap per item and a tick per drink item", () => {
    expect(itemCapsOf({ "i.pitem-fluffy": 3, "d.pitem-fluffy": 1, "o.StartShop": 2 })).toEqual({ "pitem-fluffy": 3 });
    expect([...itemKeys([fluffyCard, towelCard, plain])].sort()).toEqual(["d.pitem-fluffy", "i.pitem-fluffy", "i.pitem-towel"]);
  });
});
