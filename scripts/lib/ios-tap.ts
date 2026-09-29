/**
 * The rules of the iOS tap check (scripts/ios-tap-check.ts): what the page reports, how a reported element
 * becomes a point on the simulator's screen, when the page has settled, and whether a step did what it should.
 * Pure; the runner does the I/O (Vite, idb, simctl) and the reporter (ios-tap-reporter.ts) runs in Safari.
 *
 * Targets are named `score:<row>:<col>` (a 点数 button, col 0 = 凸0), `card:<row>` (the card cell),
 * `thumb:<row>`, `badge:<row>` (the rarity badge) and `sheet` (the open breakdown); rows are table indices,
 * so a key survives scrolling. An open breakdown is named `<row>:<col>`.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}

/** What the page sends whenever it changes (at most every ~150 ms). */
export interface Report {
  run: string;
  seq: number;
  scrollY: number;
  viewport: { w: number; h: number };
  /** Open breakdowns, `<row>:<col>`; the fix under test says at most one. */
  open: string[];
  /** The on-screen targets, in CSS pixels relative to the viewport. */
  targets: Record<string, Rect>;
  /** The last pointerdown the page received: where (CSS pixels), on which target, and whether that touch has ended (pointerup, or pointercancel when a swipe became a scroll). */
  lastDown: { at: Point; target: string; seq: number; ended: boolean } | null;
}

export function isReport(value: unknown): value is Report {
  if (typeof value !== "object" || value === null) return false;
  const r: Record<string, unknown> = { ...value };
  return typeof r.run === "string" && typeof r.seq === "number" && Array.isArray(r.open) && typeof r.targets === "object" && r.targets !== null;
}

/** Screen points minus CSS pixels: where the web view sits on the screen (Safari at zoom 1, one CSS pixel per point). */
export function calibrate(tapped: Point, received: Point): Point {
  return { x: tapped.x - received.x, y: tapped.y - received.y };
}

/** A believable web-view origin: inside the screen's top band, not a tap that landed somewhere unexpected. */
export function plausibleOffset(offset: Point): boolean {
  return Math.abs(offset.x) <= 2 && offset.y >= 0 && offset.y <= 140;
}

/** The screen point to tap for a target: its centre, or `dy` points below its top edge when given. */
export function screenPoint(rect: Rect, offset: Point, dy?: number): Point {
  const y = dy === undefined ? rect.y + rect.h / 2 : rect.y + dy;
  return { x: Math.round(rect.x + rect.w / 2 + offset.x), y: Math.round(y + offset.y) };
}

/** Settled: no report for `quietMs`, and at least that long since the action (a report can lag the touch). */
export function settled(lastReportAt: number, actionAt: number, now: number, quietMs: number): boolean {
  return now - lastReportAt >= quietMs && now - actionAt >= quietMs;
}

/** The sheet may reach this share of the viewport's height (`max-h-[60vh]` in src/app/ScoreTable.tsx). */
const SHEET_MAX_SHARE = 0.6;

/** The table rows fully on screen in the band a tap can use: below the sticky header, above the tallest sheet. */
export function usableRows(report: Report, headerBottom: number): number[] {
  const rows: number[] = [];
  for (const [key, rect] of Object.entries(report.targets)) {
    const m = /^card:(\d+)$/.exec(key);
    if (m && rect.y >= headerBottom && rect.y + rect.h <= report.viewport.h * (1 - SHEET_MAX_SHARE)) rows.push(Number(m[1]));
  }
  return rows.sort((a, b) => a - b);
}

export interface Verdict {
  ok: boolean;
  problems: string[];
}

/** Did the touch land on the intended target, and is exactly the expected breakdown open? */
export function judge(report: Report, intended: string, expectOpen: readonly string[], sinceSeq: number): Verdict {
  const problems: string[] = [];
  const down = report.lastDown;
  if (!down || down.seq <= sinceSeq) problems.push(`no touch reached the page (aimed at ${intended})`);
  else if (down.target !== intended) problems.push(`the touch landed on ${down.target}, not ${intended}`);
  const open = [...report.open].sort();
  const want = [...expectOpen].sort();
  if (open.join(",") !== want.join(",")) problems.push(`open is [${open.join(", ")}], expected [${want.join(", ")}]`);
  return { ok: problems.length === 0, problems };
}
