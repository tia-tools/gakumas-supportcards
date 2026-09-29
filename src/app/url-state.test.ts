import { describe, expect, test } from "bun:test";
import { SCENARIOS } from "../../data/scenarios/index.ts";
import type { RouteProfile, Scenario } from "../engine/types.ts";
import { defaultViewState, parseViewState, serializeViewState, shareFor, withShare, type ViewState } from "./url-state.ts";

/** Stands in for `adjustableKeys` of ./panel.ts: profile a2 has one input fewer. */
const adjustable = (p: { id: string }): ReadonlySet<string> => new Set(p.id === "a2" ? ["o.StartShop"] : ["o.StartShop", "f.GetProduceCard.effectGroup.review", "w.EndLesson.produce_card_count.ge20", "i.pitem-a", "d.pitem-a"]);
const profile = (id: string): RouteProfile => ({ id, name: id, occasions: {}, filters: {}, lessonSplits: [{ vocal: 1, dance: 0, visual: 0 }, { vocal: 0, dance: 1, visual: 0 }], parameterBonusBase: () => 0 });
const scenarios: Scenario[] = [
  { id: "a", name: "A", parameterCap: 0, profiles: [profile("a1"), { ...profile("a2"), auditionShare: [1, 9, 0] }] },
  { id: "b", name: "B", parameterCap: 0, profiles: [profile("b1")] },
];

const parse = (q: string) => parseViewState(new URLSearchParams(q), scenarios, adjustable);
const serialize = (s: ViewState) => serializeViewState(s, scenarios).toString();

describe("parseViewState", () => {
  test("empty query is the default state", () => {
    expect(parse("")).toEqual(defaultViewState(scenarios));
  });

  test("unknown scenario, profile, split, sort and facet values fall back", () => {
    const s = parse("s=zzz&p=nope&ls=9&sort=7x&type=vocal,bogus&rarity=ur&sp=yes");
    expect(s.scenarioId).toBe("a");
    expect(s.profileId).toBe("a1");
    expect(s.split).toBeNull();
    expect(s.sort).toEqual({ totsu: 4, desc: true });
    expect(s.types).toEqual(["vocal"]);
    expect(s.rarities).toEqual([]);
    expect(s.sp).toBe(false);
  });

  test("a=<main>.<sub>.<other> is the selected profile's audition share in tenths; the profile's default and anything malformed are left out (A5)", () => {
    expect(parse("a=3.6.1").shares).toEqual({ a1: [3, 6, 1] });
    expect(parse("a=10.0.0").shares).toEqual({ a1: [10, 0, 0] });
    for (const raw of ["a=2.7.1", "a=5.5", "a=4.4.3", "a=2.5.6.5.1", "a=x.y.z", ""]) expect(parse(raw).shares, raw).toEqual({});
  });

  test("the default a= is measured against is the selected profile's own", () => {
    expect(parse("p=a2&a=1.9.0").shares).toEqual({});
    expect(parse("p=a2&a=2.7.1").shares).toEqual({ a2: [2, 7, 1] });
  });

  test("a.<profile id>= is another profile's share; the selected profile reads only a=, and an unknown profile is ignored", () => {
    expect(parse("a.a2=3.6.1").shares).toEqual({ a2: [3, 6, 1] });
    expect(parse("a.a2=1.9.0").shares).toEqual({});
    expect(parse("a.a1=3.6.1").shares).toEqual({});
    expect(parse("a.b1=3.6.1&a.zz=3.6.1").shares).toEqual({});
  });

  test("the share's text is exactly three plain integers: no empty part, sign, exponent or whitespace, even where Number() would read a valid share", () => {
    for (const raw of ["a=..10", "a=+3.6.1", "a=1e1.0.0", "a=%203.6.1", "a=3.6.1%20", "a=03.6.1", "a=3.6.1."]) expect(parse(raw).shares, raw).toEqual({});
  });

  test("sp=1 narrows to SP発生率+ cards; anything else is off", () => {
    expect(parse("sp=1").sp).toBe(true);
    expect(parse("sp=0").sp).toBe(false);
    expect(parse("").sp).toBe(false);
  });

  test("a profile of another scenario is not accepted for the chosen scenario", () => {
    expect(parse("s=b&p=a2").profileId).toBe("b1");
  });

  test("overrides are keyed like the panel's inputs and must be non-negative integers", () => {
    const s = parse("o.StartShop=7&f.GetProduceCard.effectGroup.review=0&w.EndLesson.produce_card_count.ge20=3");
    expect(s.overrides).toEqual({ "o.StartShop": 7, "f.GetProduceCard.effectGroup.review": 0, "w.EndLesson.produce_card_count.ge20": 3 });
    expect(parse("o.StartShop=-1&o.StartShop=1.5&f.GetProduceCard.effectGroup.review=").overrides).toEqual({});
  });

  test("a P-item cap is any non-negative integer; a deck tick is 1 or nothing (A9, A11)", () => {
    expect(parse("i.pitem-a=2&d.pitem-a=1").overrides).toEqual({ "i.pitem-a": 2, "d.pitem-a": 1 });
    expect(parse("i.pitem-a=0").overrides).toEqual({ "i.pitem-a": 0 });
    expect(parse("d.pitem-a=2&d.pitem-a=0&i.pitem-b=1").overrides).toEqual({});
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
      shares: { b1: [3, 6, 1] },
      types: ["dance", "assist"],
      plans: ["logic"],
      rarities: ["sr", "ssr"],
      sp: true,
      sort: { totsu: 2, desc: false },
      overrides: { "o.StartShop": 5, "w.EndLesson.produce_card_count.ge20": 3 },
    };
    const q = serialize(state);
    expect(q).toBe("s=b&p=b1&ls=1&a=3.6.1&type=dance%2Cassist&plan=logic&rarity=sr%2Cssr&sp=1&sort=2a&o.StartShop=5&w.EndLesson.produce_card_count.ge20=3");
    expect(parse(q)).toEqual(state);
  });

  test("the default share, set explicitly, is not written", () => {
    expect(serialize({ ...defaultViewState(scenarios), shares: { a1: [2, 7, 1], a2: [1, 9, 0] } })).toBe("");
  });

  test("each profile keeps its own share: the selected one as a=, the others as a.<id>=", () => {
    const state: ViewState = { ...defaultViewState(scenarios), profileId: "a2", shares: { a1: [3, 6, 1], a2: [2, 7, 1] } };
    const q = serialize(state);
    expect(q).toBe("p=a2&a.a1=3.6.1&a=2.7.1");
    expect(parse(q)).toEqual(state);
    const switched: ViewState = { ...state, profileId: "a1" };
    expect(serialize(switched)).toBe("a=3.6.1&a.a2=2.7.1");
    expect(parse(serialize(switched))).toEqual(switched);
  });

  test("a non-default profile of the default scenario is written", () => {
    expect(serialize({ ...defaultViewState(scenarios), profileId: "a2" })).toBe("p=a2");
  });
});

describe("shareFor / withShare", () => {
  const [a1, a2] = scenarios[0]?.profiles ?? [];
  if (!a1 || !a2) throw new Error("fixture");

  test("the player's share under a profile, else the profile's default", () => {
    expect(shareFor({ shares: {} }, a1)).toEqual([2, 7, 1]);
    expect(shareFor({ shares: {} }, a2)).toEqual([1, 9, 0]);
    expect(shareFor({ shares: { a1: [3, 6, 1] } }, a2)).toEqual([1, 9, 0]);
  });

  test("setting one profile's share leaves the others; its default or null drops it", () => {
    expect(withShare({ a1: [3, 6, 1] }, a2, [2, 7, 1])).toEqual({ a1: [3, 6, 1], a2: [2, 7, 1] });
    expect(withShare({ a1: [3, 6, 1], a2: [2, 7, 1] }, a2, [1, 9, 0])).toEqual({ a1: [3, 6, 1] });
    expect(withShare({ a1: [3, 6, 1] }, a1, null)).toEqual({});
  });
});
