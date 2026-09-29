import { describe, expect, test } from "bun:test";
import { NONE_OPEN, nextOpen, shownCell, type CellEvent, type OpenCells } from "./open-cell.ts";

const run = (events: readonly CellEvent[], from: OpenCells = NONE_OPEN): OpenCells => events.reduce(nextOpen, from);
const all = (): boolean => true;
const shown = (events: readonly CellEvent[]): string | null => shownCell(run(events), all);

describe("shownCell", () => {
  test("a hovered cell wins over a focused one, and the focused one returns when the pointer leaves (the Windows report)", () => {
    const focusedB = [{ type: "focus", key: "b", on: true }] as const;
    expect(shown([...focusedB, { type: "hover", key: "a", on: true }])).toBe("a");
    expect(shown([...focusedB, { type: "hover", key: "a", on: true }, { type: "hover", key: "a", on: false }])).toBe("b");
  });

  test("a pinned cell wins over a focused one and loses to a hovered one", () => {
    expect(shown([{ type: "focus", key: "b", on: true }, { type: "tap", key: "c" }])).toBe("c");
    expect(shown([{ type: "tap", key: "c" }, { type: "hover", key: "a", on: true }])).toBe("a");
  });

  test("a key whose cell left the table is skipped rather than blocking the next one", () => {
    const state = run([{ type: "hover", key: "gone", on: true }, { type: "focus", key: "b", on: true }]);
    expect(shownCell(state, (key) => key !== "gone")).toBe("b");
  });

  test("nothing open shows nothing", () => {
    expect(shownCell(NONE_OPEN, all)).toBeNull();
  });
});

describe("nextOpen", () => {
  test("a late leave or blur from the previous cell does not close the next one", () => {
    expect(shown([{ type: "hover", key: "b", on: true }, { type: "hover", key: "a", on: false }])).toBe("b");
    expect(shown([{ type: "focus", key: "b", on: true }, { type: "focus", key: "a", on: false }])).toBe("b");
  });

  test("a second tap closes a cell that is also focused, a tap on another switches to it", () => {
    const tapped = [{ type: "focus", key: "a", on: true }, { type: "tap", key: "a" }] as const;
    expect(shown([...tapped, { type: "tap", key: "a" }])).toBeNull();
    expect(shown([...tapped, { type: "focus", key: "a", on: false }, { type: "focus", key: "b", on: true }, { type: "tap", key: "b" }])).toBe("b");
  });

  test("a second click closes the cell while the mouse is still over it; leaving and coming back opens it again", () => {
    const clickedTwice = [{ type: "hover", key: "a", on: true }, { type: "focus", key: "a", on: true }, { type: "tap", key: "a" }, { type: "tap", key: "a" }] as const;
    expect(shown(clickedTwice)).toBeNull();
    expect(shown([...clickedTwice, { type: "hover", key: "a", on: false }, { type: "hover", key: "a", on: true }])).toBe("a");
  });

  test("a tap outside every score closes a pinned or focused cell; Escape closes everything", () => {
    expect(shown([{ type: "focus", key: "a", on: true }, { type: "tap", key: "a" }, { type: "outside" }])).toBeNull();
    expect(shown([{ type: "hover", key: "a", on: true }, { type: "tap", key: "b" }, { type: "escape" }])).toBeNull();
  });
});
