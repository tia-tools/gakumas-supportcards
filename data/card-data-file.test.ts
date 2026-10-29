/**
 * The published card data (data/card-data-file.ts, docs/adr/0010): what another project parses
 * back must equal what the generator wrote, field for field, held cards and their reasons
 * included, at the path and format version that project fetches.
 */

import { describe, expect, test } from "bun:test";
import type { Card, HeldCard } from "../src/engine/types.ts";
import { CARD_DATA_PATH, cardDataJson } from "./card-data-file.ts";
import { CARDS } from "./cards.generated.ts";
import { HELD } from "./held.generated.ts";
import { LEVEL_LIMITS } from "./levelLimits.generated.ts";

const HELD_CARD: Card = {
  id: "s_card-x",
  name: "保留カード",
  assetId: "csprt-x",
  type: "vocal",
  rarity: "ssr",
  plan: "sense",
  breakpoints: [{ minLevel: 1, effects: [{ stat: "vocal", value: 5, kind: "skill", trigger: { occasion: "EndLesson", filters: [{ family: "lessonKind", member: "sp" }] } }], eventBonusPermil: 0 }],
};
const HELD_ENTRY: HeldCard = { id: "s_card-x", name: "保留カード", reasons: ["s_card-x: trigger p_trigger-x has a piece of unknown kind: x"] };

describe("published card data", () => {
  test("round-trips the generated data: every card, the held list and the level limits", () => {
    expect(JSON.parse(cardDataJson(CARDS, HELD, LEVEL_LIMITS))).toStrictEqual({ formatVersion: 1, levelLimits: LEVEL_LIMITS, cards: CARDS, held: HELD });
  });

  test("a held card stays among the cards, and its reasons sit in the held list", () => {
    const parsed: unknown = JSON.parse(cardDataJson([HELD_CARD], [HELD_ENTRY], LEVEL_LIMITS));
    expect(parsed).toStrictEqual({ formatVersion: 1, levelLimits: LEVEL_LIMITS, cards: [HELD_CARD], held: [HELD_ENTRY] });
  });

  test("is served at the path the other project fetches, which names format version 1", () => {
    expect(CARD_DATA_PATH).toBe("data/cards.v1.json");
  });
});
