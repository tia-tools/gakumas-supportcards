import { describe, expect, test } from "bun:test";
import { SCENARIOS } from "../../data/scenarios/index.ts";
import type { Scenario } from "../engine/types.ts";
import { defaultViewState, parseViewState, serializeViewState, type ViewState } from "./url-state.ts";

/** Stands in for `adjustableKeys` of ./panel.ts: profile a2 has one input fewer. */
const adjustable = (p: { id: string }): ReadonlySet<string> => new Set(p.id === "a2" ? ["o.StartShop"] : ["o.StartShop", "f.GetProduceCard.effectGroup.review", "w.EndLesson.produce_card_count.ge20"]);
const profile = (id: string) => ({ id, name: id, occasions: {}, filters: {}, lessonSplits: [{ vocal: 1, dance: 0, visual: 0 }, { vocal: 0, dance: 1, visual: 0 }], parameterBonusBase: () => 0 });
const scenarios: Scenario[] = [
  { id: "a", name: "A", parameterCap: 0, profiles: [profile("a1"), profile("a2")] },
  { id: "b", name: "B", parameterCap: 0, profiles: [profile("b1")] },
];

const parse = (q: string) => parseViewState(new URLSearchParams(q), scenarios, adjustable);
const serialize = (s: ViewState) => serializeViewState(s, scenarios).toString();

describe("parseViewState", () => {
  test("empty query is the default state", () => {
    expect(parse("")).toEqual(defaultViewState(scenarios));
  });

  test("unknown scenario, profile, split, sort and facet values fall back", () => {
    const s = parse("s=zzz&p=nope&ls=9&sort=7x&type=vocal,bogus&rarity=ur");
    expect(s.scenarioId).toBe("a");
    expect(s.profileId).toBe("a1");
    expect(s.split).toBeNull();
    expect(s.sort).toEqual({ totsu: 4, desc: true });
    expect(s.types).toEqual(["vocal"]);
    expect(s.rarities).toEqual([]);
  });

  test("a profile of another scenario is not accepted for the chosen scenario", () => {
    expect(parse("s=b&p=a2").profileId).toBe("b1");
  });

  test("overrides are keyed like the panel's inputs and must be non-negative integers", () => {
    const s = parse("o.StartShop=7&f.GetProduceCard.effectGroup.review=0&w.EndLesson.produce_card_count.ge20=3");
    expect(s.overrides).toEqual({ "o.StartShop": 7, "f.GetProduceCard.effectGroup.review": 0, "w.EndLesson.produce_card_count.ge20": 3 });
    expect(parse("o.StartShop=-1&o.StartShop=1.5&f.GetProduceCard.effectGroup.review=").overrides).toEqual({});
  });

  test("a key the chosen profile does not let the player adjust is ignored, as are the c. keys of the former model", () => {
    expect(parse("o.EndLesson=3&o.Bogus=1&c.start_shop=7&sort=2a").overrides).toEqual({});
    expect(parse("p=a2&o.StartShop=2&f.GetProduceCard.effectGroup.review=5").overrides).toEqual({ "o.StartShop": 2 });
  });

  test("real scenarios: a link naming the unpublished 初LEGEND falls back to H.I.F.", () => {
    const s = parseViewState(new URLSearchParams("s=hajime-legend&p=standard"), SCENARIOS, adjustable);
    expect(s.scenarioId).toBe("hif");
    expect(s.profileId).toBe("sashiire");
  });

  test("real scenarios: default is the first shipped scenario and profile", () => {
    const s = parseViewState(new URLSearchParams(""), SCENARIOS, adjustable);
    expect(s.scenarioId).toBe("hif");
    expect(s.profileId).toBe("sashiire");
  });
});

describe("serializeViewState", () => {
  test("default state serialises to an empty query", () => {
    expect(serialize(defaultViewState(scenarios))).toBe("");
  });

  test("round-trips every field", () => {
    const state: ViewState = {
      scenarioId: "b",
      profileId: "b1",
      split: 1,
      types: ["dance", "assist"],
      plans: ["logic"],
      rarities: ["sr", "ssr"],
      sort: { totsu: 2, desc: false },
      overrides: { "o.StartShop": 5, "w.EndLesson.produce_card_count.ge20": 3 },
    };
    const q = serialize(state);
    expect(q).toBe("s=b&p=b1&ls=1&type=dance%2Cassist&plan=logic&rarity=sr%2Cssr&sort=2a&o.StartShop=5&w.EndLesson.produce_card_count.ge20=3");
    expect(parse(q)).toEqual(state);
  });

  test("a non-default profile of the default scenario is written", () => {
    expect(serialize({ ...defaultViewState(scenarios), profileId: "a2" })).toBe("p=a2");
  });
});
