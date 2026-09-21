import { describe, expect, test } from "bun:test";
import type { Card, LevelLimits, Scenario } from "../../src/engine/types.ts";
import { heldForMissingNumbers, mergeHeld } from "./profile-gate.ts";
import { buildSnapshot, emitSnapshot, parseSnapshot, unexplainedMoves, type Snapshot } from "./score-snapshot.ts";

const LIMITS: LevelLimits = { r: [20, 25, 30, 35, 40], sr: [30, 35, 40, 45, 50], ssr: [40, 45, 50, 55, 60] };
const scenario = (shop: number): Scenario => ({
  id: "s",
  name: "S",
  parameterCap: 0,
  profiles: [{ id: "p", name: "p", occasions: { StartShop: shop }, filters: { GetProduceCard: { effectGroup: { default: 2 } } }, lessonSplits: [{ vocal: 1, dance: 0, visual: 0 }], parameterBonusBase: () => 0 }],
});
const card = (id: string, value: number, occasion = "StartShop"): Card => ({
  id,
  name: id,
  assetId: id,
  type: "vocal",
  rarity: "r",
  plan: "common",
  breakpoints: [{ minLevel: 1, effects: [{ stat: "vocal", value, kind: "skill", trigger: { occasion } }], eventBonusPermil: 0 }],
});
const hash = (text: string): string => `h${text.length}:${text}`;
const snap = (cards: Card[], shop = 3, held: string[] = []): Snapshot => buildSnapshot(cards, held.map((id) => ({ id, name: id, reasons: [] })), [scenario(shop)], LIMITS, hash);

describe("buildSnapshot", () => {
  test("one entry per card that is not held, sorted by id, five scores per profile", () => {
    const s = snap([card("b", 10), card("a", 1), card("c", 5)], 3, ["c"]);
    expect(Object.keys(s)).toEqual(["a", "b"]);
    expect(s["b"]?.scores).toEqual({ "s/p": [30, 30, 30, 30, 30] });
  });

  test("survives its own file format", () => {
    const s = snap([card("a", 1), card("b", 10)]);
    expect(parseSnapshot(emitSnapshot(s))).toEqual(s);
    expect(emitSnapshot(s).split("\n")).toHaveLength(5); // braces, one line per card, trailing newline
  });

  test("a malformed file is rejected instead of reading as nothing moved", () => {
    expect(() => parseSnapshot("[]")).toThrow("expected an object");
    expect(() => parseSnapshot('{"a":{"name":"a","data":"x","scores":{"s/p":[1,2]}}}')).toThrow("malformed scores for a s/p");
    expect(() => parseSnapshot('{"a":{"name":"a","scores":{}}}')).toThrow("malformed entry a");
  });
});

describe("unexplainedMoves", () => {
  test("identical snapshots have none", () => {
    expect(unexplainedMoves(snap([card("a", 1)]), snap([card("a", 1)]))).toEqual([]);
  });

  test("a card whose data changed may move; new, removed and newly held cards are free", () => {
    const base = snap([card("a", 1), card("gone", 2), card("held-later", 3)]);
    const current = snap([card("a", 7), card("new", 9), card("held-later", 3)], 3, ["held-later"]);
    expect(unexplainedMoves(base, current)).toEqual([]);
  });

  test("a route profile number changed by hand moves every card that uses it, and each is reported", () => {
    const moves = unexplainedMoves(snap([card("a", 1), card("b", 10), card("other", 5, "StartRefresh")]), snap([card("a", 1), card("b", 10), card("other", 5, "StartRefresh")], 4));
    expect(moves.map((m) => [m.id, m.profile, m.before?.[0], m.after?.[0]])).toEqual([
      ["a", "s/p", 3, 4],
      ["b", "s/p", 30, 40],
    ]);
  });

  test("a profile that appears or disappears is a move too", () => {
    const base = snap([card("a", 1)]);
    const entry = base["a"];
    if (!entry) throw new Error("fixture");
    const current: Snapshot = { a: { ...entry, scores: { ...entry.scores, "s/q": [0, 0, 0, 0, 0] } } };
    expect(unexplainedMoves(base, current).map((m) => [m.profile, m.before, m.after])).toEqual([["s/q", undefined, [0, 0, 0, 0, 0]]]);
  });
});

describe("heldForMissingNumbers / mergeHeld", () => {
  test("a card is held when a shipped profile has no number for its occasion or filter, naming the path and the profiles", () => {
    const fine = card("fine", 1);
    const newPhase = card("new-phase", 1, "StartBrandNewPhase");
    const newMember: Card = { ...card("new-member", 1), breakpoints: [{ minLevel: 1, effects: [{ stat: "vocal", value: 1, kind: "skill", trigger: { occasion: "StartShop", filters: [{ family: "cardType", member: "trouble" }] } }], eventBonusPermil: 0 }] };
    const byDefault: Card = { ...card("by-default", 1), breakpoints: [{ minLevel: 1, effects: [{ stat: "vocal", value: 1, kind: "skill", trigger: { occasion: "GetProduceCard", filters: [{ family: "effectGroup", member: "a_new_plan" }] } }], eventBonusPermil: 0 }] };
    const withGet = scenario(3);
    const profile = withGet.profiles[0];
    if (!profile) throw new Error("fixture");
    const scenarios: Scenario[] = [{ ...withGet, profiles: [{ ...profile, occasions: { ...profile.occasions, GetProduceCard: 5 } }] }];
    expect(heldForMissingNumbers([fine, newPhase, newMember, byDefault], scenarios)).toEqual([
      { id: "new-phase", name: "new-phase", reasons: ["new-phase: no route profile number for occasions.StartBrandNewPhase (s/p)"] },
      { id: "new-member", name: "new-member", reasons: ["new-member: no route profile number for filters.StartShop.cardType.trouble (s/p)"] },
    ]);
  });

  test("mergeHeld keeps one entry per card with the reasons of both lists", () => {
    expect(
      mergeHeld(
        [{ id: "b", name: "B", reasons: ["piece"] }],
        [
          { id: "a", name: "A", reasons: ["number"] },
          { id: "b", name: "B", reasons: ["number", "piece"] },
        ],
      ),
    ).toEqual([
      { id: "a", name: "A", reasons: ["number"] },
      { id: "b", name: "B", reasons: ["number", "piece"] },
    ]);
  });
});
