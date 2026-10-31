/**
 * The published skill card data (data/skillcard-data-file.ts; docs/adr/0010, addendum
 * 2026-10-31): what gkms-memomemo parses back must equal what the generator wrote, at the path
 * and format version it fetches, and the real build must write exactly that text there. The
 * generated module must also stay readable as JSON, which is how scripts/images reads it.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emitSkillCards } from "../scripts/lib/emit.ts";
import { builtAsset } from "./built-asset.ts";
import { SKILLCARD_DATA_PATH, skillCardDataJson, type SkillCardDataFile } from "./skillcard-data-file.ts";
import { SKILL_CARD_DATA } from "./skillcards.generated.ts";

/**
 * What scripts/images/skillcards.py does with the module's text: parse what lies between the
 * first `{` after `export const SKILL_CARD_DATA` and the last `}`.
 */
function jsonCut(moduleText: string): unknown {
  const start = moduleText.indexOf("{", moduleText.indexOf("export const SKILL_CARD_DATA"));
  return JSON.parse(moduleText.slice(start, moduleText.lastIndexOf("}") + 1));
}

const SMALL: SkillCardDataFile = {
  formatVersion: 1,
  idols: [{ id: "hski", name: "花海咲季" }],
  cards: [
    {
      id: "p_card-01-act-1_001",
      upgrade: 1,
      name: "ファンサ+",
      plan: "sense",
      rarity: "R",
      type: "active",
      order: "21010020000001",
      guideLabels: [],
      art: { asset: "img_general_skillcard_act-1_001", perIdol: false },
      customization: { limit: 1, kinds: [{ id: "k", steps: [{ step: 1, label: "パラメータ\n上昇回数+" }] }] },
    },
  ],
  hifAbilities: [],
};

describe("published skill card data", () => {
  test("round-trips the generated data", () => {
    expect(JSON.parse(skillCardDataJson(SKILL_CARD_DATA))).toStrictEqual(SKILL_CARD_DATA);
  });

  test("is served at the path gkms-memomemo fetches, which names format version 1", () => {
    expect(SKILLCARD_DATA_PATH).toBe("data/skillcards.v1.json");
    expect(SKILL_CARD_DATA.formatVersion).toBe(1);
  });

  test("the build writes exactly this text at that path, from the generated data", async () => {
    expect(await builtAsset(SKILLCARD_DATA_PATH)).toBe(skillCardDataJson(SKILL_CARD_DATA));
  }, 30_000);
});

describe("the generated module", () => {
  test("is readable as JSON, empty lists and line breaks in labels included", () => {
    expect(jsonCut(emitSkillCards(SMALL))).toStrictEqual(SMALL);
    expect(jsonCut(emitSkillCards({ ...SMALL, cards: [] }))).toStrictEqual({ ...SMALL, cards: [] });
  });

  test("as committed, reads as JSON to exactly the data it exports", () => {
    expect(jsonCut(readFileSync(join(import.meta.dirname, "skillcards.generated.ts"), "utf8"))).toStrictEqual(SKILL_CARD_DATA);
  });

  test("holds each card once per upgrade level, in the game's order, base before +", () => {
    const keys = SKILL_CARD_DATA.cards.map((c) => `${c.order}:${c.upgrade}:${c.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([...keys].sort());
  });

  test("names only pool cards as the cards of H.I.F. abilities", () => {
    const pool = new Set(SKILL_CARD_DATA.cards.map((c) => c.id));
    expect(SKILL_CARD_DATA.hifAbilities.filter((a) => !pool.has(a.card))).toEqual([]);
  });
});
