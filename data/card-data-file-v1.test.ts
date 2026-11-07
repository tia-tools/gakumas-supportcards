/**
 * The card data in format 1 (data/card-data-file-v1.ts): it must carry no filter family that
 * tia-tools/gkms-hif-final-stats does not know, since that project rejects the whole file on one,
 * and whatever is left out for that reason must make its card held with the reason, as format 1
 * already did for an effect it could not count.
 */

import { describe, expect, test } from "bun:test";
import type { Card, ClassifiedEffect, FilterRef, HeldCard, ParsedTrigger } from "../src/engine/types.ts";
import { builtAsset } from "./built-asset.ts";
import { CARD_DATA_V1_PATH, cardDataV1Json, FORMAT_1_FILTER_FAMILIES, format1 } from "./card-data-file-v1.ts";
import { CARDS } from "./cards.generated.ts";
import { HELD } from "./held.generated.ts";
import { LEVEL_LIMITS } from "./levelLimits.generated.ts";

const PLAN: ParsedTrigger = { occasion: "GetProduceCard", filters: [{ family: "plan", member: "logic" }], conditions: [{ kind: "vocal", min: 900, max: 0 }] };
const PLAN_IN_SUBJECT: ParsedTrigger = { occasion: "GetProduceCard", conditions: [{ kind: "produce_card_search_count", min: 8, max: 0, subject: [{ family: "plan", member: "sense" }] }] };
const SP: ParsedTrigger = { occasion: "EndLesson", filters: [{ family: "lessonKind", member: "sp" }] };

const kept: ClassifiedEffect = { stat: "vocal", value: 9, kind: "skill", trigger: SP };
const planItem: ClassifiedEffect = { stat: "vocal", value: 25, kind: "item", cap: 2, itemId: "pitem-a", itemName: "A", trigger: PLAN };
const planSkill: ClassifiedEffect = { stat: "vocal", value: 5, kind: "skill", trigger: PLAN_IN_SUBJECT };
const countedItem: ClassifiedEffect = { stat: "vocal", value: 10, kind: "item", itemId: "pitem-b", itemName: "B", trigger: SP };

function card(id: string, effects: ClassifiedEffect[], items?: Card["items"]): Card {
  const out: Card = { id, name: `card ${id}`, assetId: `asset-${id}`, type: "vocal", rarity: "ssr", plan: "logic", breakpoints: [{ minLevel: 1, effects, eventBonusPermil: 0 }] };
  if (items) out.items = items;
  return out;
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`missing ${what}`);
  return value;
}

function familiesIn(cards: readonly Card[]): Set<string> {
  const triggers = cards.flatMap((c) => [...c.breakpoints.flatMap((bp) => bp.effects.map((e) => e.trigger)), ...(c.items ?? []).map((i) => i.drinks?.trigger)]);
  const filters: FilterRef[] = triggers.flatMap((t) => [...(t?.filters ?? []), ...(t?.conditions ?? []).flatMap((c) => c.subject ?? [])]);
  return new Set(filters.map((f) => f.family));
}

describe("card data in format 1", () => {
  test("knows exactly the six filter families gkms-hif-final-stats checks against", () => {
    expect(FORMAT_1_FILTER_FAMILIES).toEqual(["lessonStat", "lessonKind", "cardType", "rarity", "cardName", "effectGroup"]);
  });

  test("an effect with a newer family is left out and its card held; the rest of the card stays", () => {
    const { cards, held } = format1([card("x", [kept, planItem, planSkill])], []);
    expect(must(cards[0], "card x").breakpoints[0]?.effects).toEqual([kept]);
    expect(held).toEqual([
      {
        id: "x",
        name: "card x",
        reasons: [
          "item pitem-a A: filter plan.logic is not in format 1 of this file; cards.v2.json carries it",
          "skill on GetProduceCard: filter plan.sense is not in format 1 of this file; cards.v2.json carries it",
        ],
      },
    ]);
  });

  test("P-drinks on a newer family are dropped; the grant stays only while one of its stat effects does", () => {
    const drinks = { perFire: 2, trigger: PLAN };
    const items = [
      { itemId: "pitem-b", itemName: "B", assetId: "b", drinks },
      { itemId: "pitem-c", itemName: "C", assetId: "c", cap: 1, drinks },
    ];
    const { cards, held } = format1([card("y", [countedItem], items)], []);
    expect(must(cards[0], "card y").items).toEqual([{ itemId: "pitem-b", itemName: "B", assetId: "b" }]);
    expect(held.map((h) => h.reasons.length)).toEqual([2]);
    expect(must(format1([card("z", [kept], [{ itemId: "pitem-c", itemName: "C", assetId: "c", drinks }])], []).cards[0], "card z").items).toBeUndefined();
  });

  test("a card already held gets the new reason added; a card with nothing newer is passed through untouched", () => {
    const already: HeldCard = { id: "x", name: "card x", reasons: ["an older reason"] };
    const plain = card("w", [kept]);
    const { cards, held } = format1([plain, card("x", [planItem])], [already]);
    expect(cards[0]).toBe(plain);
    expect(held.map((h) => [h.id, h.reasons.length])).toEqual([["x", 2]]);
    expect(already.reasons).toEqual(["an older reason"]);
  });

  test("the generated data in format 1 carries only format 1 families, and holds what it had to cut", () => {
    const parsed: unknown = JSON.parse(cardDataV1Json(CARDS, HELD, LEVEL_LIMITS));
    const { cards, held } = format1(CARDS, HELD);
    expect(parsed).toStrictEqual({ formatVersion: 1, levelLimits: LEVEL_LIMITS, cards, held });
    for (const family of familiesIn(cards)) expect(FORMAT_1_FILTER_FAMILIES).toContain(family);
    const cut = new Set(held.map((h) => h.id));
    expect(cards.filter((c, i) => c !== CARDS[i]).every((c) => cut.has(c.id))).toBe(true);
  });

  test("the build writes exactly this text at data/cards.v1.json", async () => {
    expect(CARD_DATA_V1_PATH).toBe("data/cards.v1.json");
    expect(await builtAsset(CARD_DATA_V1_PATH)).toBe(cardDataV1Json(CARDS, HELD, LEVEL_LIMITS));
  }, 30_000);
});
