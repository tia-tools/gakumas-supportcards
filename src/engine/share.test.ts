import { describe, expect, test } from "bun:test";
import { defaultShareOf, isAuditionShare, roleOf, shareOf } from "./share.ts";
import { DEFAULT_AUDITION_SHARE } from "./types.ts";

describe("roleOf", () => {
  test("most lessons is main, next is sub, last is other", () => {
    const split = { vocal: 1, dance: 7, visual: 0 };
    expect(roleOf(split, "dance")).toBe(0);
    expect(roleOf(split, "vocal")).toBe(1);
    expect(roleOf(split, "visual")).toBe(2);
  });

  test("ties break in the order vocal, dance, visual", () => {
    expect(roleOf({ vocal: 4, dance: 4, visual: 0 }, "vocal")).toBe(0);
    expect(roleOf({ vocal: 4, dance: 4, visual: 0 }, "dance")).toBe(1);
    expect(roleOf({ vocal: 0, dance: 0, visual: 0 }, "visual")).toBe(2);
  });

  test("a named sub wins a tie, so 8/0/0 can send the audition to either untrained stat", () => {
    expect(roleOf({ vocal: 8, dance: 0, visual: 0, sub: "visual" }, "visual")).toBe(1);
    expect(roleOf({ vocal: 8, dance: 0, visual: 0, sub: "visual" }, "dance")).toBe(2);
    expect(roleOf({ vocal: 0, dance: 0, visual: 8, sub: "dance" }, "dance")).toBe(1);
    expect(roleOf({ vocal: 0, dance: 0, visual: 8, sub: "dance" }, "vocal")).toBe(2);
  });

  test("a named sub does not outrank a stat with more lessons", () => {
    expect(roleOf({ vocal: 7, dance: 1, visual: 0, sub: "visual" }, "dance")).toBe(1);
  });
});

describe("defaultShareOf", () => {
  test("a profile's own share, else 2:7:1", () => {
    expect(defaultShareOf({ auditionShare: [1, 9, 0] })).toEqual([1, 9, 0]);
    expect(defaultShareOf({})).toEqual(DEFAULT_AUDITION_SHARE);
  });
});

describe("shareOf", () => {
  test("the default 2:7:1 gives the main stat 0.2, the sub 0.7, the other 0.1", () => {
    const split = { vocal: 7, dance: 0, visual: 1 };
    expect(shareOf(split, "vocal", DEFAULT_AUDITION_SHARE)).toBe(0.2);
    expect(shareOf(split, "visual", DEFAULT_AUDITION_SHARE)).toBe(0.7);
    expect(shareOf(split, "dance", DEFAULT_AUDITION_SHARE)).toBe(0.1);
  });

  test("a share the player set is read by role, not by stat", () => {
    expect(shareOf({ vocal: 7, dance: 1, visual: 0 }, "vocal", [10, 0, 0])).toBe(1);
    expect(shareOf({ vocal: 0, dance: 1, visual: 7 }, "visual", [10, 0, 0])).toBe(1);
    expect(shareOf({ vocal: 0, dance: 1, visual: 7 }, "vocal", [10, 0, 0])).toBe(0);
  });
});

describe("isAuditionShare", () => {
  test("accepts three integers 0–10 summing to 10 and nothing else", () => {
    expect(isAuditionShare([2, 7, 1])).toBe(true);
    expect(isAuditionShare([10, 0, 0])).toBe(true);
    expect(isAuditionShare([2, 7])).toBe(false);
    expect(isAuditionShare([2, 7, 2])).toBe(false);
    expect(isAuditionShare([2.5, 6.5, 1])).toBe(false);
    expect(isAuditionShare([-1, 11, 0])).toBe(false);
  });
});
