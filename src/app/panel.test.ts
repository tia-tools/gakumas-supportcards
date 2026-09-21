import { describe, expect, test } from "bun:test";
import { CARDS } from "../../data/cards.generated.ts";
import { ALL_SCENARIOS, SCENARIOS } from "../../data/scenarios/index.ts";
import { occurrences } from "../engine/count.ts";
import type { ParsedTrigger, RouteProfile } from "../engine/types.ts";
import { adjustableKeys, applyOverrides, buildPanel, keysUsedBy, triggersOf, type PanelInput, type PanelSection } from "./panel.ts";

const PROFILE: RouteProfile = {
  id: "p",
  name: "p",
  occasions: { EndLesson: 8, GetProduceCard: 20, StartShop: 3, EndAudition: 5 },
  filters: {
    EndLesson: { lessonKind: { members: { sp: 8, normal: 0 } } },
    GetProduceCard: { effectGroup: { default: 10, members: { review: 14 } } },
  },
  lessonSplits: [{ vocal: 7, dance: 1, visual: 0 }],
  parameterBonusBase: () => 0,
};

const SP_DECK20: ParsedTrigger = { occasion: "EndLesson", filters: [{ family: "lessonKind", member: "sp" }], conditions: [{ kind: "produce_card_count", min: 20, max: 0 }] };
const VOCAL_SP: ParsedTrigger = { occasion: "EndLesson", filters: [{ family: "lessonStat", member: "vocal" }, { family: "lessonKind", member: "sp" }] };
const GET_REVIEW_DANCE700: ParsedTrigger = { occasion: "GetProduceCard", filters: [{ family: "effectGroup", member: "review" }], conditions: [{ kind: "dance", min: 700, max: 0 }] };
const GET_BUFF_DANCE700: ParsedTrigger = { occasion: "GetProduceCard", filters: [{ family: "effectGroup", member: "parameter_buff" }], conditions: [{ kind: "dance", min: 700, max: 0 }] };
const SHOP: ParsedTrigger = { occasion: "StartShop" };
const ALL = [SP_DECK20, VOCAL_SP, GET_REVIEW_DANCE700, GET_BUFF_DANCE700, SHOP];

const DECK20 = "w.EndLesson.produce_card_count.ge20";
const SP = "f.EndLesson.lessonKind.sp";

function find(sections: readonly PanelSection[], key: string): PanelInput {
  const walk = (inputs: readonly PanelInput[]): PanelInput | undefined => inputs.map((i) => (i.key === key ? i : walk(i.children))).find((x) => x !== undefined);
  const hit = walk(sections.flatMap((s) => s.inputs));
  if (!hit) throw new Error(`no input ${key}`);
  return hit;
}

describe("buildPanel", () => {
  const panel = buildPanel(PROFILE, {}, ALL, ALL);

  test("four fixed sections in order, each occasion in its section, schedule occasions read-only", () => {
    expect(panel.map((s) => s.title)).toEqual(["スケジュール", "行動", "スキルカード", "ドリンク・アイテム"]);
    expect(panel[0]?.inputs.map((i) => i.key)).toEqual(["o.EndLesson", "o.EndAudition"]);
    expect(panel[1]?.inputs.map((i) => i.key)).toEqual(["o.StartShop"]);
    expect(find(panel, "o.EndLesson").readOnly).toBe(true);
    expect(find(panel, "o.StartShop").readOnly).toBe(false);
    expect(find(panel, SP).readOnly).toBe(false);
  });

  test("an occasion no section lists stays reachable in その他", () => {
    const p = buildPanel({ ...PROFILE, occasions: { ...PROFILE.occasions, StartNewThing: 2 } }, {}, ALL, ALL);
    expect(p.at(-1)).toMatchObject({ title: "その他", inputs: [{ key: "o.StartNewThing", label: "StartNewThing", value: 2 }] });
  });

  test("a condition sits under the filter every trigger using it shares, bounded by it; the lesson stat is never an input", () => {
    const sp = find(panel, SP);
    expect(sp).toMatchObject({ label: "SPレッスン", value: 8, max: 8 });
    expect(sp.children.map((c) => c.key)).toEqual([DECK20]);
    expect(sp.children[0]).toMatchObject({ label: "所持スキルカード20枚以上", base: 8, value: 8, max: 8, overridden: false });
    expect(panel.flatMap((s) => s.inputs).some((i) => i.key.includes("lessonStat") || i.children.some((c) => c.key.includes("lessonStat")))).toBe(false);
  });

  test("a condition used under different filters sits under the occasion, once (C10)", () => {
    const get = find(panel, "o.GetProduceCard");
    expect(get.children.map((c) => c.key)).toEqual(["f.GetProduceCard.effectGroup.review", "f.GetProduceCard.effectGroup.parameter_buff", "w.GetProduceCard.dance.ge700"]);
    expect(find(panel, "w.GetProduceCard.dance.ge700")).toMatchObject({ label: "ダンス700以上", value: 20, max: 20 });
  });

  test("a member without a count of its own shows the family default", () => {
    expect(find(panel, "f.GetProduceCard.effectGroup.parameter_buff")).toMatchObject({ label: "好調", base: 10, value: 10 });
    expect(find(panel, "f.GetProduceCard.effectGroup.review")).toMatchObject({ label: "好印象", base: 14 });
  });

  test("lowering a parent pulls its children down with it: SP lessons 5 → 20枚以上 at most 5", () => {
    const p = buildPanel(PROFILE, { [SP]: 5 }, ALL, ALL);
    expect(find(p, SP)).toMatchObject({ value: 5, base: 8, overridden: true });
    expect(find(p, DECK20)).toMatchObject({ value: 5, max: 5, overridden: false });
    expect(find(buildPanel(PROFILE, { [SP]: 5, [DECK20]: 7 }, ALL, ALL), DECK20).value).toBe(5);
  });

  test("通常レッスン is what SP lessons leave, shown read-only (C18)", () => {
    expect(find(panel, "f.EndLesson.lessonKind.normal")).toMatchObject({ value: 0, readOnly: true });
    expect(find(buildPanel(PROFILE, { [SP]: 5 }, ALL, ALL), "f.EndLesson.lessonKind.normal")).toMatchObject({ value: 3, base: 0, readOnly: true });
  });

  test("an input is used only when a card in view reacts to it", () => {
    const p = buildPanel(PROFILE, {}, ALL, [GET_REVIEW_DANCE700]);
    expect(find(p, "o.GetProduceCard").used).toBe(true);
    expect(find(p, "f.GetProduceCard.effectGroup.review").used).toBe(true);
    expect(find(p, "f.GetProduceCard.effectGroup.parameter_buff").used).toBe(false);
    expect(find(p, "o.EndLesson").used).toBe(false);
    expect(find(p, "o.EndAudition").used).toBe(false); // named by the profile, used by no card at all
  });

  test("a condition the route ships below the maximum says so (C7)", () => {
    const shipped = { ...PROFILE, conditions: { "EndLesson.produce_card_count.ge20": 3 } };
    const input = find(buildPanel(shipped, {}, ALL, ALL), DECK20);
    expect(input).toMatchObject({ base: 3, value: 3, overridden: false });
    expect(input.note).toContain("3回");
    expect(find(panel, DECK20).note).toBeUndefined();
  });
});

describe("applyOverrides", () => {
  test("returns the same profile when nothing is overridden", () => {
    expect(applyOverrides(PROFILE, {})).toBe(PROFILE);
  });

  test("an occasion, a named member, a member that used the default, and a condition", () => {
    const p = applyOverrides(PROFILE, { "o.StartShop": 1, "f.GetProduceCard.effectGroup.review": 9, "f.GetProduceCard.effectGroup.parameter_buff": 4, [DECK20]: 3 });
    expect(p.occasions["StartShop"]).toBe(1);
    expect(p.filters["GetProduceCard"]?.effectGroup).toEqual({ default: 10, members: { review: 9, parameter_buff: 4 } });
    expect(p.conditions).toEqual({ "EndLesson.produce_card_count.ge20": 3 });
    expect(PROFILE.filters["GetProduceCard"]?.effectGroup?.members).toEqual({ review: 14 }); // the shipped profile is untouched
  });

  test("what the panel shows is what the engine counts", () => {
    const overrides = { [SP]: 5, [DECK20]: 2 };
    const ctx = { scenarioId: "s", profile: applyOverrides(PROFILE, overrides), lessons: { vocal: 7, dance: 1, visual: 0 } };
    const effect = (trigger: ParsedTrigger) => ({ stat: "vocal" as const, value: 1, kind: "skill" as const, trigger });
    expect(occurrences(effect(SP_DECK20), ctx)).toBe(find(buildPanel(PROFILE, overrides, ALL, ALL), DECK20).value);
    expect(occurrences(effect(VOCAL_SP), ctx)).toBe(5);
    expect(occurrences(effect({ occasion: "EndLesson", filters: [{ family: "lessonKind", member: "normal" }] }), ctx)).toBe(3);
  });

  test("an explicit 通常レッスン override wins over the derived value", () => {
    expect(applyOverrides(PROFILE, { [SP]: 5, "f.EndLesson.lessonKind.normal": 1 }).filters["EndLesson"]?.lessonKind?.members).toEqual({ sp: 5, normal: 1 });
  });
});

describe("keys", () => {
  test("keysUsedBy names the occasion, countable filters and conditions of each trigger", () => {
    expect([...keysUsedBy([SP_DECK20, VOCAL_SP])].sort()).toEqual([SP, "o.EndLesson", DECK20].sort());
  });

  test("adjustableKeys leaves out read-only inputs", () => {
    const keys = adjustableKeys(PROFILE, ALL);
    expect(keys.has("o.StartShop") && keys.has(SP) && keys.has(DECK20)).toBe(true);
    expect(keys.has("o.EndLesson") || keys.has("f.EndLesson.lessonKind.normal")).toBe(false);
  });
});

describe("shipped data", () => {
  const all = triggersOf(CARDS);
  const hif = SCENARIOS[0]?.profiles[0];
  if (!hif) throw new Error("no default profile");

  test("every input has a Japanese label, and every key is URL-safe", () => {
    const flat = (inputs: readonly PanelInput[]): PanelInput[] => inputs.flatMap((i) => [i, ...flat(i.children)]);
    for (const s of ALL_SCENARIOS) {
      for (const p of s.profiles) {
        for (const input of flat(buildPanel(p, {}, all, all).flatMap((x) => x.inputs))) {
          expect(/[a-z_]/.test(input.label), `${input.key} is labelled with the game's raw word "${input.label}"`).toBe(false);
          expect(encodeURIComponent(input.key)).toBe(input.key);
        }
      }
    }
  });

  test("filtered to ロジック, only 好印象, やる気 and 元気 stay in view among the effect groups (C6)", () => {
    const logic = triggersOf(CARDS.filter((c) => c.plan === "logic"));
    const groups = find(buildPanel(hif, {}, all, logic), "o.GetProduceCard").children.filter((c) => c.key.includes(".effectGroup."));
    expect(groups.filter((g) => g.used).map((g) => g.label).sort()).toEqual(["やる気", "元気", "好印象"].sort());
    expect(groups.length).toBeGreaterThan(3);
  });

  test("no shipped profile has an occasion outside the four sections", () => {
    for (const s of ALL_SCENARIOS) for (const p of s.profiles) expect(buildPanel(p, {}, all, all).map((x) => x.id)).not.toContain("other");
  });
});
