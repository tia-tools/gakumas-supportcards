import { describe, expect, test } from "bun:test";
import type { ParsedTrigger } from "../../src/engine/types.ts";
import { parseTrigger } from "./parse-trigger.ts";

const P = "ProducePhaseType_";

function parsed(id: string, phase: string): ParsedTrigger {
  const r = parseTrigger(id, `${P}${phase}`);
  if (r.kind !== "parsed") throw new Error(`${id}: unknown piece ${r.piece}`);
  return r.trigger;
}

function unknownPiece(id: string, phase: string): string {
  const r = parseTrigger(id, `${P}${phase}`);
  if (r.kind !== "unknown-piece") throw new Error(`${id}: parsed as ${JSON.stringify(r.trigger)}`);
  return r.piece;
}

describe("occasion", () => {
  test("is the phase type, and a bare head has neither filters nor conditions", () => {
    expect(parsed("p_trigger-start_shop", "StartShop")).toEqual({ occasion: "StartShop" });
    expect(parsed("p_trigger-end_before_audition_refresh-vocal-0400_0000", "EndBeforeAuditionRefresh").occasion).toBe("EndBeforeAuditionRefresh");
  });

  test("an id that does not begin with its phase is of unknown kind", () => {
    expect(unknownPiece("p_trigger-none-stamina_ratio-0000_0800", "Unknown")).toContain("p_trigger-unknown");
  });
});

describe("pieces with nothing to count", () => {
  test("initial, no_description and the unbounded range", () => {
    expect(parsed("p_trigger-produce_start-initial", "ProduceStart")).toEqual({ occasion: "ProduceStart" });
    expect(parsed("p_trigger-produce_start-no_description", "ProduceStart")).toEqual({ occasion: "ProduceStart" });
    expect(parsed("p_trigger-get_produce_card-0000_0000-p_card_search-deck_all", "GetProduceCard")).toEqual({ occasion: "GetProduceCard" });
  });

  test("a bounded range that belongs to no name is of unknown kind", () => {
    expect(unknownPiece("p_trigger-get_produce_card-0003_0000-p_card_search-deck_all", "GetProduceCard")).toBe("0003_0000");
  });
});

describe("filters", () => {
  test("lesson stat and lesson kind", () => {
    expect(parsed("p_trigger-end_lesson-lesson_vocal", "EndLesson").filters).toEqual([{ family: "lessonStat", member: "vocal" }]);
    expect(parsed("p_trigger-end_lesson-lesson_dance_sp", "EndLesson").filters).toEqual([
      { family: "lessonStat", member: "dance" },
      { family: "lessonKind", member: "sp" },
    ]);
    expect(parsed("p_trigger-end_lesson-lesson_visual_normal", "EndLesson").filters?.[1]).toEqual({ family: "lessonKind", member: "normal" });
    expect(parsed("p_trigger-end_lesson-lesson_sp", "EndLesson").filters).toEqual([{ family: "lessonKind", member: "sp" }]);
  });

  test("card type, rarity and name inside a card search", () => {
    expect(parsed("p_trigger-delete_produce_card-0000_0000-p_card_search-mental_skill-deck_all", "DeleteProduceCard").filters).toEqual([{ family: "cardType", member: "mental" }]);
    expect(parsed("p_trigger-upgrade_produce_card-0000_0000-p_card_search-active_skill-deck_all", "UpgradeProduceCard").filters).toEqual([{ family: "cardType", member: "active" }]);
    expect(parsed("p_trigger-get_produce_card-p_card_search-ssr-deck_all-1", "GetProduceCard").filters).toEqual([{ family: "rarity", member: "ssr" }]);
    expect(parsed("p_trigger-change_produce_card-p_card_search-deck_all-starter", "ChangeProduceCard").filters).toEqual([{ family: "cardName", member: "starter" }]);
  });

  test("effect group", () => {
    expect(parsed("p_trigger-get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_review-000", "GetProduceCard").filters).toEqual([{ family: "effectGroup", member: "review" }]);
  });
});

describe("conditions", () => {
  test("a range is minimum_maximum with 0000 unbounded", () => {
    expect(parsed("p_trigger-end_lesson-lesson_sp-produce_card_count-0020_0000", "EndLesson")).toEqual({
      occasion: "EndLesson",
      filters: [{ family: "lessonKind", member: "sp" }],
      conditions: [{ kind: "produce_card_count", min: 20, max: 0 }],
    });
    expect(parsed("p_trigger-start_customize-dance-0000_0900", "StartCustomize").conditions).toEqual([{ kind: "dance", min: 0, max: 900 }]);
    expect(parsed("p_trigger-end_lesson-lesson_vocal-stamina_ratio-0500_0000", "EndLesson").conditions).toEqual([{ kind: "stamina_ratio", min: 500, max: 0 }]);
  });

  test("a filter and a condition on the same trigger stay apart", () => {
    expect(parsed("p_trigger-upgrade_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_preservation-000-dance-0700_0000", "UpgradeProduceCard")).toEqual({
      occasion: "UpgradeProduceCard",
      filters: [{ family: "effectGroup", member: "preservation" }],
      conditions: [{ kind: "dance", min: 700, max: 0 }],
    });
  });

  test("produce_card_search_count counts held cards: its search is the condition's subject, not a filter on the occasion (C11)", () => {
    expect(parsed("p_trigger-get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_review-000-0008_0000", "GetProduceCard")).toEqual({
      occasion: "GetProduceCard",
      conditions: [{ kind: "produce_card_search_count", subject: [{ family: "effectGroup", member: "review" }], min: 8, max: 0 }],
    });
    expect(parsed("p_trigger-end_audition-produce_card_search_count-p_card_search-deck_all-0015_0000", "EndAudition")).toEqual({
      occasion: "EndAudition",
      conditions: [{ kind: "produce_card_search_count", min: 15, max: 0 }],
    });
  });

  test("a produce_card_search_count that never closes is of unknown kind", () => {
    expect(unknownPiece("p_trigger-end_audition-produce_card_search_count-p_card_search-deck_all", "EndAudition")).toContain("without a closing range");
  });
});

describe("scenario restriction (C5)", () => {
  test("a known token maps to this site's scenario id", () => {
    expect(parsed("p_trigger-get_produce_card-produce_card_count-0017_0000-for_hajime_legend_ssr", "GetProduceCard")).toEqual({
      occasion: "GetProduceCard",
      conditions: [{ kind: "produce_card_count", min: 17, max: 0 }],
      scenario: "hajime-legend",
    });
    expect(parsed("p_trigger-start_audition-for_hif_memory", "StartAudition").scenario).toBe("hif");
  });

  test("an unknown token is never assumed to mean 0", () => {
    expect(unknownPiece("p_trigger-end_audition-for_new_scenario", "EndAudition")).toBe("for_new_scenario");
  });
});

describe("pieces never seen before: shape decides (C4, C12)", () => {
  test("a new name before a range is a condition", () => {
    expect(parsed("p_trigger-start_shop-produce_point-1000_0000", "StartShop").conditions).toEqual([{ kind: "produce_point", min: 1000, max: 0 }]);
  });

  test("a new effect group or lesson kind is a new member of its family", () => {
    expect(parsed("p_trigger-get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_new_plan_buff-000", "GetProduceCard").filters).toEqual([{ family: "effectGroup", member: "new_plan_buff" }]);
    expect(parsed("p_trigger-end_lesson-lesson_vocal_hard", "EndLesson").filters?.[1]).toEqual({ family: "lessonKind", member: "hard" });
    expect(parsed("p_trigger-end_lesson-lesson_hard", "EndLesson").filters).toEqual([{ family: "lessonKind", member: "hard" }]);
  });

  test("a new word inside a card search has no family by position and is of unknown kind", () => {
    expect(unknownPiece("p_trigger-get_produce_card-0000_0000-p_card_search-trouble-deck_all", "GetProduceCard")).toBe("trouble");
  });

  test("anything else is of unknown kind", () => {
    expect(unknownPiece("p_trigger-end_step_event_business-produce_point", "EndStepEventBusiness")).toBe("produce_point");
    expect(unknownPiece("p_trigger-end_lesson_before_present-lesson", "EndLessonBeforePresent")).toBe("lesson");
    expect(unknownPiece("p_trigger-get_produce_card-0000_0000-p_card_search-deck_all-effect_group-hidden-exam_review-000", "GetProduceCard")).toContain("effect_group-hidden");
  });
});
