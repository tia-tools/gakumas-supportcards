import { describe, expect, test } from "bun:test";
import { splitLabel } from "./labels.ts";

describe("splitLabel", () => {
  test("a preset reads as its lessons, and names the audition's sub stat when it states one", () => {
    expect(splitLabel({ vocal: 7, dance: 1, visual: 0 })).toBe("Vo7 / Da1 / Vi0");
    expect(splitLabel({ vocal: 8, dance: 0, visual: 0, sub: "visual" })).toBe("Vo8 / Da0 / Vi0（試験サブ Vi）");
  });
});
