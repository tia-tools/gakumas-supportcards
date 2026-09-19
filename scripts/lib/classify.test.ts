import { describe, expect, test } from "bun:test";
import type { ExtensionRow } from "../../data/taxonomy.extensions.ts";
import { Classifier, lessonStatOf, mergeTaxonomy, redundantExtensions } from "./classify.ts";
import type { RawFilterRow } from "./tables.ts";

const PARAM = ["ProduceEffectType_VocalAddition", "ProduceEffectType_DanceAddition", "ProduceEffectType_VisualAddition"];

const GAME: RawFilterRow[] = [
  { id: "g-shop", title: "相談選択時パラメータ上昇", order: 28, produceEffectTypes: PARAM, produceTriggerIds: ["p_trigger-start_shop"] },
  { id: "g-lesson", title: "レッスン終了時パラメータ上昇", order: 4, produceEffectTypes: PARAM, produceTriggerIds: ["p_trigger-end_lesson-lesson_vocal"] },
  { id: "g-lesson-sp", title: "SPレッスン終了時パラメータ上昇", order: 6, produceEffectTypes: PARAM, produceTriggerIds: ["p_trigger-end_lesson-lesson_vocal_sp"] },
  { id: "g-stamina-sp", title: "SPレッスン終了時体力回復", order: 32, produceEffectTypes: ["ProduceEffectType_StaminaRecoverFix"], produceTriggerIds: ["p_trigger-end_lesson-lesson_sp"] },
  { id: "g-sp-rate", title: "SPレッスン発生率+", order: 3, produceEffectTypes: ["ProduceEffectType_LessonSpChangeRatePermilAddition"], produceTriggerIds: ["p_trigger-produce_start-no_description"] },
];

const EXT: ExtensionRow[] = [
  { id: "ext-lesson-sp", title: "SPレッスン終了時パラメータ上昇", order: 106, produceEffectTypes: PARAM, produceTriggerIds: ["p_trigger-end_lesson-lesson_sp"], countsAs: "g-lesson-sp" },
];

const classifier = new Classifier(mergeTaxonomy(GAME, EXT));

describe("Classifier.classify", () => {
  test("exact trigger match wins", () => {
    const c = classifier.classify("ProduceEffectType_VocalAddition", "p_trigger-start_shop");
    expect(c.kind).toBe("classified");
    if (c.kind === "classified") {
      expect(c.row.id).toBe("g-shop");
      expect(c.stat).toBe("vocal");
      expect(c.match).toBe("exact");
    }
  });

  test("conditional trigger resolves by longest `-`-delimited prefix (D14)", () => {
    const c = classifier.classify("ProduceEffectType_DanceAddition", "p_trigger-end_lesson-lesson_vocal_sp-vocal-0700_0000");
    expect(c.kind).toBe("classified");
    if (c.kind === "classified") {
      expect(c.row.id).toBe("g-lesson-sp");
      expect(c.match).toBe("prefix");
    }
  });

  test("prefix must end at a `-` boundary: a row listing p_trigger-foo does not cover p_trigger-foobar-…", () => {
    const only = new Classifier(mergeTaxonomy([{ id: "g-foo", title: "foo", order: 1, produceEffectTypes: PARAM, produceTriggerIds: ["p_trigger-foo"] }], []));
    const c = only.classify("ProduceEffectType_VocalAddition", "p_trigger-foobar-vocal-0400_0000");
    expect(c.kind).toBe("unclassified");
    if (c.kind === "unclassified") expect(c.reason).toBe("no-row");
  });

  test("extension row classifies a trigger the game lists only for another effect type", () => {
    const c = classifier.classify("ProduceEffectType_VisualAddition", "p_trigger-end_lesson-lesson_sp-dance-0700_0000");
    expect(c.kind).toBe("classified");
    if (c.kind === "classified") {
      expect(c.row.id).toBe("ext-lesson-sp");
      expect(c.row.source).toBe("extension");
    }
  });

  test("a taxonomy row for a non-parameter effect is reported as non-parameter", () => {
    const c = classifier.classify("ProduceEffectType_LessonSpChangeRatePermilAddition", "p_trigger-produce_start-no_description");
    expect(c).toEqual({ kind: "non-parameter", reason: "taxonomy-row-without-stat" });
  });

  test("whitelisted non-parameter type with no row is skipped, not an error", () => {
    const c = classifier.classify("ProduceEffectType_ProducePointAddition", "p_trigger-start_shop");
    expect(c).toEqual({ kind: "non-parameter", reason: "whitelisted-type" });
  });

  test("parameter effect with no row is unclassified", () => {
    const c = classifier.classify("ProduceEffectType_VocalAddition", "p_trigger-buy_shop_item_produce_card");
    expect(c.kind).toBe("unclassified");
    if (c.kind === "unclassified") expect(c.reason).toBe("no-row");
  });

  test("two rows tying on the longest prefix are ambiguous", () => {
    const tie = new Classifier(
      mergeTaxonomy(
        [
          { id: "a", title: "A", order: 1, produceEffectTypes: PARAM, produceTriggerIds: ["p_trigger-x"] },
          { id: "b", title: "B", order: 2, produceEffectTypes: PARAM, produceTriggerIds: ["p_trigger-x"] },
        ],
        [],
      ),
    );
    const c = tie.classify("ProduceEffectType_VocalAddition", "p_trigger-x-vocal-0400_0000");
    expect(c.kind).toBe("unclassified");
    if (c.kind === "unclassified") {
      expect(c.reason).toBe("ambiguous");
      expect(c.candidates.map((r) => r.id)).toEqual(["a", "b"]);
    }
  });
});

describe("lessonStatOf", () => {
  test("stat-bound lesson-end triggers, with and without SP/normal/condition suffixes", () => {
    expect(lessonStatOf("p_trigger-end_lesson-lesson_vocal")).toBe("vocal");
    expect(lessonStatOf("p_trigger-end_lesson-lesson_dance_sp")).toBe("dance");
    expect(lessonStatOf("p_trigger-end_lesson-lesson_visual_normal")).toBe("visual");
    expect(lessonStatOf("p_trigger-end_lesson-lesson_vocal-stamina_ratio-0500_0000")).toBe("vocal");
    expect(lessonStatOf("p_trigger-end_lesson-lesson_visual_sp-visual-0700_0000")).toBe("visual");
  });

  test("any-stat lesson triggers and non-lesson triggers have no lesson stat", () => {
    expect(lessonStatOf("p_trigger-end_lesson-lesson_sp")).toBeNull();
    expect(lessonStatOf("p_trigger-end_lesson-lesson_sp-produce_card_count-0020_0000")).toBeNull();
    expect(lessonStatOf("p_trigger-end_lesson_before_present-lesson_dance_sp")).toBeNull();
    expect(lessonStatOf("p_trigger-start_shop")).toBeNull();
  });
});

describe("redundantExtensions", () => {
  test("no game row overlaps the extension list above", () => {
    expect(redundantExtensions(GAME, EXT)).toEqual([]);
  });

  test("an extension is redundant once a game row with a shared effect type lists its trigger", () => {
    const caughtUp: RawFilterRow[] = [...GAME, { id: "g-new", title: "SPレッスン終了時パラメータ上昇", order: 6, produceEffectTypes: PARAM, produceTriggerIds: ["p_trigger-end_lesson-lesson_sp"] }];
    const r = redundantExtensions(caughtUp, EXT);
    expect(r).toEqual([{ extensionId: "ext-lesson-sp", triggerId: "p_trigger-end_lesson-lesson_sp", gameRowId: "g-new", gameTriggerId: "p_trigger-end_lesson-lesson_sp" }]);
  });

  test("a game row listing a longer, conditional form of the extension's trigger is a different category, not coverage", () => {
    const conditional: RawFilterRow[] = [...GAME, { id: "g-20cards", title: "SPレッスン終了時所持スキルカードが20枚以上の場合パラメータ上昇", order: 36, produceEffectTypes: PARAM, produceTriggerIds: ["p_trigger-end_lesson-lesson_sp-produce_card_count-0020_0000"] }];
    expect(redundantExtensions(conditional, EXT)).toEqual([]);
  });

  test("a game row whose trigger is a prefix of the extension's trigger covers it", () => {
    const ext: ExtensionRow[] = [{ id: "ext-cond", title: "x", order: 107, produceEffectTypes: PARAM, produceTriggerIds: ["p_trigger-start_shop-vocal-0400_0000"] }];
    expect(redundantExtensions(GAME, ext).map((r) => r.gameRowId)).toEqual(["g-shop"]);
  });

  test("a game row with a different effect type does not count", () => {
    expect(redundantExtensions(GAME, EXT)).toEqual([]);
  });
});
