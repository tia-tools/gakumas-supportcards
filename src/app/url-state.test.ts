import { describe, expect, test } from "bun:test";
import { SCENARIOS } from "../../data/scenarios/index.ts";
import { TAXONOMY } from "../../data/taxonomy.generated.ts";
import type { Scenario, TaxonomyRow } from "../engine/types.ts";
import { categoryKeyMap, defaultViewState, parseViewState, serializeViewState, shortCategoryKey, type ViewState } from "./url-state.ts";

const G = "s_card_p_skill_filter-vocaladdition-p_trigger-";
const taxonomy: TaxonomyRow[] = [
  { id: `${G}start_shop`, title: "相談選択時", order: 28, source: "game" },
  { id: "ext-vocaladdition-p_trigger-end_before_audition_refresh", title: "試験前の休憩後", order: 101, source: "extension" },
];
const profile = (id: string) => ({ id, name: id, counts: {}, lessonSplits: [{ vocal: 1, dance: 0, visual: 0 }, { vocal: 0, dance: 1, visual: 0 }], parameterBonusBase: () => 0 });
const scenarios: Scenario[] = [
  { id: "a", name: "A", parameterCap: 0, profiles: [profile("a1"), profile("a2")] },
  { id: "b", name: "B", parameterCap: 0, profiles: [profile("b1")] },
];

const parse = (q: string) => parseViewState(new URLSearchParams(q), scenarios, taxonomy);
const serialize = (s: ViewState) => serializeViewState(s, scenarios).toString();

describe("shortCategoryKey", () => {
  test("strips the game prefix and marks extension rows", () => {
    expect(shortCategoryKey(`${G}start_shop`)).toBe("start_shop");
    expect(shortCategoryKey("ext-vocaladdition-p_trigger-end_before_audition_refresh")).toBe("ext-end_before_audition_refresh");
    expect(shortCategoryKey("event")).toBe("event");
  });

  test("is unique over the real taxonomy", () => {
    expect(categoryKeyMap(TAXONOMY).size).toBe(TAXONOMY.length);
  });

  test("categoryKeyMap throws on a collision", () => {
    const rows: TaxonomyRow[] = [
      { id: `${G}x`, title: "", order: 1, source: "game" },
      { id: "x", title: "", order: 2, source: "game" },
    ];
    expect(() => categoryKeyMap(rows)).toThrow('short category key "x" is shared');
  });
});

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

  test("overrides are keyed by short id and must be non-negative integers", () => {
    const s = parse("c.start_shop=7&c.ext-end_before_audition_refresh=0&c.unknown=3&c.start_shop2=-1");
    expect(s.overrides).toEqual({ [`${G}start_shop`]: 7, "ext-vocaladdition-p_trigger-end_before_audition_refresh": 0 });
  });

  test("real scenarios: a link naming the unpublished 初LEGEND falls back to H.I.F.", () => {
    const s = parseViewState(new URLSearchParams("s=hajime-legend&p=standard"), SCENARIOS, TAXONOMY);
    expect(s.scenarioId).toBe("hif");
    expect(s.profileId).toBe("sashiire");
  });

  test("real scenarios: default is the first shipped scenario and profile", () => {
    const s = parseViewState(new URLSearchParams(""), SCENARIOS, TAXONOMY);
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
      overrides: { [`${G}start_shop`]: 5 },
    };
    const q = serialize(state);
    expect(q).toBe("s=b&p=b1&ls=1&type=dance%2Cassist&plan=logic&rarity=sr%2Cssr&sort=2a&c.start_shop=5");
    expect(parse(q)).toEqual(state);
  });

  test("a non-default profile of the default scenario is written", () => {
    expect(serialize({ ...defaultViewState(scenarios), profileId: "a2" })).toBe("p=a2");
  });
});
