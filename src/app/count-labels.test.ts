import { describe, expect, test } from "bun:test";
import { routeCountLabel, routeCountPart } from "./count-labels.ts";

describe("routeCountLabel", () => {
  test("names a route count as the panel shows it: the occasion, its filter, or its condition", () => {
    expect(routeCountLabel({ kind: "occasion", occasion: "BuyShopItemProduceDrink" })).toBe("相談でPドリンク交換");
    expect(routeCountLabel({ kind: "filter", occasion: "UpgradeProduceCard", filter: { family: "cardType", member: "mental" } })).toBe("スキルカード強化（メンタル）");
    expect(routeCountLabel({ kind: "condition", occasion: "EndLesson", condition: { kind: "produce_card_count", min: 20, max: 0 } })).toBe("レッスン終了時の所持スキルカード20枚以上");
  });
});

describe("routeCountPart", () => {
  test("names only the part, since the breakdown line above words the whole trigger", () => {
    expect(routeCountPart({ kind: "occasion", occasion: "StartRefresh" })).toBe("休む選択");
    expect(routeCountPart({ kind: "filter", occasion: "EndLesson", filter: { family: "lessonKind", member: "normal" } })).toBe("通常レッスン");
    expect(routeCountPart({ kind: "condition", occasion: "EndLesson", condition: { kind: "produce_card_count", min: 20, max: 0 } })).toBe("所持スキルカード20枚以上");
  });
});
