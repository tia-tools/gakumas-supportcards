/**
 * The table's breakdown wiring in a simulated DOM (happy-dom): which events reach open-cell.ts and what shows.
 * The rule itself is tested in open-cell.test.ts; this covers what those tests cannot see — hover counted for a
 * mouse only, the document listeners for a tap outside and Escape, one breakdown rendered, a vanished cell skipped.
 * No layout: happy-dom does not lay out, so widths and the sheet's position are checked in a browser.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { render } from "preact";
import { act } from "preact/test-utils";
import { DEFAULT_AUDITION_SHARE, type Card, type RouteProfile } from "../engine/types.ts";
import { buildRows, type Row } from "./rows.ts";
import { ScoreTable } from "./ScoreTable.tsx";

const profile: RouteProfile = { id: "p", name: "p", occasions: { StartShop: 3 }, filters: {}, lessonSplits: [{ vocal: 3, dance: 1, visual: 0 }], parameterBonusBase: () => 0 };
const limits = { r: [20, 25, 30, 35, 40], sr: [30, 35, 40, 45, 50], ssr: [40, 45, 50, 55, 60] } as const;

function card(id: string, value: number): Card {
  return { id, name: id, assetId: id, type: "vocal", rarity: "ssr", plan: "common", breakpoints: [{ minLevel: 1, effects: [{ kind: "skill", stat: "vocal", value, trigger: { occasion: "StartShop" } }], eventBonusPermil: 0 }] };
}

const ROWS: readonly Row[] = buildRows([card("a", 10), card("b", 20), card("c", 30)], { scenarioId: "s", profile, limits, share: DEFAULT_AUDITION_SHARE }, 0);

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`${what} is missing`);
  return value;
}

let root: HTMLElement;

async function show(rows: readonly Row[]): Promise<void> {
  await act(() => render(<ScoreTable rows={rows} sort={{ totsu: 4, desc: true }} onSort={() => undefined} />, root));
}

/** Row `r`'s 凸0 cell. */
function cell(r: number): HTMLElement {
  return must(root.querySelectorAll<HTMLElement>("td[data-score-cell]")[r * 5], `row ${r}'s cell`);
}
const button = (r: number): HTMLButtonElement => must(cell(r).querySelector("button"), `row ${r}'s button`);

/** The rows whose breakdown is on screen, by index. */
function open(): number[] {
  const cells = [...root.querySelectorAll("td[data-score-cell]")];
  return cells.flatMap((td, i) => (td.querySelector(":scope > div") ? [Math.floor(i / 5)] : []));
}

async function pointer(target: EventTarget, type: string, pointerType: string): Promise<void> {
  await act(() => {
    // pointerenter/leave do not bubble; down, up and cancel do.
    target.dispatchEvent(new PointerEvent(type, { bubbles: !type.endsWith("enter") && !type.endsWith("leave"), pointerType }));
  });
}
const tap = (r: number): Promise<void> => act(() => button(r).click());
const focus = (r: number): Promise<void> => act(() => button(r).focus());
const key = (k: string): Promise<void> =>
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
  });

beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());

beforeEach(() => {
  root = document.body.appendChild(document.createElement("div"));
});
afterEach(() => act(() => render(null, root)));

describe("which breakdown shows", () => {
  test("a mouse over a cell opens its breakdown and leaving closes it; a touch pointer entering opens nothing", async () => {
    await show(ROWS);
    await pointer(cell(0), "pointerenter", "touch");
    expect(open()).toEqual([]);
    await pointer(cell(0), "pointerenter", "mouse");
    expect(open()).toEqual([0]);
    expect(button(0).getAttribute("aria-expanded")).toBe("true");
    await pointer(cell(0), "pointerleave", "mouse");
    expect(open()).toEqual([]);
  });

  test("with one cell focused, hovering another shows only the hovered one, and the focused one returns on leave (the Windows report)", async () => {
    await show(ROWS);
    await focus(1);
    expect(open()).toEqual([1]);
    await pointer(cell(0), "pointerenter", "mouse");
    expect(open()).toEqual([0]);
    await pointer(cell(0), "pointerleave", "mouse");
    expect(open()).toEqual([1]);
  });

  test("a hovered cell that leaves the table without a leave event does not block the focused one", async () => {
    await show(ROWS);
    await focus(2);
    await pointer(cell(0), "pointerenter", "mouse");
    expect(open()).toEqual([0]);
    await show(ROWS.slice(1));
    expect(open()).toEqual([1]);
  });
});

describe("what closes it", () => {
  test("a tap pins a breakdown; a tap inside it keeps it, a tap outside every score closes it", async () => {
    await show(ROWS);
    await tap(2);
    expect(open()).toEqual([2]);
    const sheet = must(cell(2).querySelector(":scope > div"), "the sheet");
    await pointer(sheet, "pointerdown", "touch");
    await pointer(sheet, "pointerup", "touch");
    expect(open()).toEqual([2]);
    await pointer(document.body, "pointerdown", "touch");
    await pointer(document.body, "pointerup", "touch");
    expect(open()).toEqual([]);
  });

  test("a touch outside that becomes a scroll (pointercancel, no pointerup) keeps it open", async () => {
    await show(ROWS);
    await tap(2);
    const cardCell = must(root.querySelector("td:first-child"), "a card cell");
    await pointer(cardCell, "pointerdown", "touch");
    await pointer(cardCell, "pointercancel", "touch");
    expect(open()).toEqual([2]);
  });

  test("Escape closes a focused, pinned breakdown", async () => {
    await show(ROWS);
    await focus(0);
    await tap(0);
    await key("Escape");
    expect(open()).toEqual([]);
    expect(button(0).getAttribute("aria-expanded")).toBe("false");
  });
});
