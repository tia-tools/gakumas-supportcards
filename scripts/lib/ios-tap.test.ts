import { describe, expect, test } from "bun:test";
import { calibrate, isReport, judge, plausibleOffset, screenPoint, settled, usableRows, type Report } from "./ios-tap.ts";

function report(over: Partial<Report> = {}): Report {
  return { run: "r", seq: 1, scrollY: 0, viewport: { w: 402, h: 800 }, open: [], targets: {}, lastDown: null, ...over };
}

describe("where a target is on the screen", () => {
  test("the offset is where the touch was aimed minus where the page received it", () => {
    expect(calibrate({ x: 60, y: 300 }, { x: 60, y: 238 })).toEqual({ x: 0, y: 62 });
  });

  test("a web view shifted sideways or far down is not believed", () => {
    expect(plausibleOffset({ x: 0, y: 62 })).toBe(true);
    expect(plausibleOffset({ x: 0, y: 0 })).toBe(true);
    expect(plausibleOffset({ x: 30, y: 62 })).toBe(false);
    expect(plausibleOffset({ x: 0, y: -72 })).toBe(false);
    expect(plausibleOffset({ x: 0, y: 300 })).toBe(false);
  });

  test("a target is touched at its centre, or a given distance below its top, moved by the offset and rounded", () => {
    const rect = { x: 180, y: 120, w: 34, h: 15 };
    expect(screenPoint(rect, { x: 0, y: 62 })).toEqual({ x: 197, y: 190 });
    expect(screenPoint(rect, { x: 0, y: 62 }, 4)).toEqual({ x: 197, y: 186 });
  });
});

describe("settled", () => {
  test("waits for the page to go quiet and for the quiet period after the action", () => {
    expect(settled(1000, 1500, 2000, 700)).toBe(false);
    expect(settled(1000, 1500, 2200, 700)).toBe(true);
    expect(settled(1900, 0, 2200, 700)).toBe(false);
  });
});

describe("usableRows", () => {
  test("keeps card rows fully between the header and the top of the tallest sheet (40% down), in table order", () => {
    const targets = {
      "card:3": { x: 0, y: 130, w: 150, h: 70 },
      "card:2": { x: 0, y: 60, w: 150, h: 70 },
      "card:1": { x: 0, y: 20, w: 150, h: 70 },
      "card:4": { x: 0, y: 250, w: 150, h: 70 },
      "card:5": { x: 0, y: 260, w: 150, h: 70 },
      "score:2:0": { x: 180, y: 80, w: 34, h: 15 },
    };
    expect(usableRows(report({ targets }), 40)).toEqual([2, 3, 4]);
  });
});

describe("judge", () => {
  const down = (target: string, seq: number): Report["lastDown"] => ({ at: { x: 0, y: 0 }, target, seq, ended: true });

  test("passes when a new touch landed on the target and exactly the expected breakdown is open", () => {
    expect(judge(report({ open: ["2:0"], lastDown: down("score:2:0", 3) }), "score:2:0", ["2:0"], 2)).toEqual({ ok: true, problems: [] });
  });

  test("tells a missed touch from a wrong result", () => {
    expect(judge(report({ open: [], lastDown: down("card:2", 3) }), "score:2:0", ["2:0"], 2).problems).toEqual(["the touch landed on card:2, not score:2:0", "open is [], expected [2:0]"]);
    expect(judge(report({ open: ["2:0"], lastDown: down("score:2:0", 2) }), "score:2:0", ["2:0"], 2).problems).toEqual(["no touch reached the page (aimed at score:2:0)"]);
  });

  test("two breakdowns open fails even when one is the expected one", () => {
    expect(judge(report({ open: ["1:4", "2:4"], lastDown: down("score:1:4", 3) }), "score:1:4", ["1:4"], 2).ok).toBe(false);
  });
});

describe("isReport", () => {
  test("accepts a report and rejects what is not one", () => {
    expect(isReport(report())).toBe(true);
    expect(isReport({ run: "r" })).toBe(false);
    expect(isReport(null)).toBe(false);
  });
});
