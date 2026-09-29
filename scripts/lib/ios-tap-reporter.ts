/**
 * Runs inside Safari during scripts/ios-tap-check.ts: the runner's Vite server injects it into the page. With
 * `?tapcheck=<run>` in the URL it scrolls the score table to the top of the viewport, then posts a Report
 * (ios-tap.ts) to `/__tapcheck` whenever what it would say changes — so the runner reads the page without a
 * WebDriver session, whose automation overlay would swallow real touches.
 */

import type { Point, Rect, Report } from "./ios-tap.ts";

const run = new URLSearchParams(location.search).get("tapcheck");
let lastDown: Report["lastDown"] = null;
let downs = 0;
let seq = 0;
let sent = "";

const scoreRows = (): HTMLTableRowElement[] => [...document.querySelectorAll<HTMLTableRowElement>("tr:has(> td[data-score-cell])")];

function rectOf(el: Element): Rect {
  const b = el.getBoundingClientRect();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

/** The target an element belongs to; the sheet is checked first, since it sits inside a score cell. */
function describe(el: Element | null): string {
  if (!el) return "none";
  if (el.closest("td[data-score-cell] > div")) return "sheet";
  const tr = el.closest("tr");
  const row = tr instanceof HTMLTableRowElement ? scoreRows().indexOf(tr) : -1;
  const cell = el.closest("td[data-score-cell]");
  if (cell && row >= 0) return `score:${row}:${[...tr?.querySelectorAll("td[data-score-cell]") ?? []].indexOf(cell)}`;
  if (row >= 0 && el.closest("img")) return `thumb:${row}`;
  if (row >= 0 && el.closest("td:first-child .flex-col > span")) return `badge:${row}`;
  if (row >= 0 && el.closest("td:first-child")) return `card:${row}`;
  return el.tagName.toLowerCase();
}

function onScreen(r: Rect): boolean {
  return r.y + r.h > 0 && r.y < innerHeight;
}

function rowTargets(tr: HTMLTableRowElement, row: number, into: Record<string, Rect>): void {
  const card = tr.querySelector("td:first-child");
  if (!card || !onScreen(rectOf(card))) return;
  into[`card:${row}`] = rectOf(card);
  const img = card.querySelector("img");
  if (img) into[`thumb:${row}`] = rectOf(img);
  const badge = card.querySelector(".flex-col > span");
  if (badge) into[`badge:${row}`] = rectOf(badge);
  tr.querySelectorAll("td[data-score-cell] button").forEach((b, col) => (into[`score:${row}:${col}`] = rectOf(b)));
}

function snapshot(): Omit<Report, "seq"> {
  const targets: Record<string, Rect> = {};
  const head = document.querySelector("thead");
  if (head) targets.header = rectOf(head);
  const open: string[] = [];
  scoreRows().forEach((tr, row) => {
    rowTargets(tr, row, targets);
    tr.querySelectorAll("td[data-score-cell]").forEach((td, col) => {
      const sheet = td.querySelector(":scope > div");
      if (!sheet) return;
      open.push(`${row}:${col}`);
      targets.sheet = rectOf(sheet);
    });
  });
  return { run: run ?? "", scrollY: Math.round(scrollY), viewport: { w: innerWidth, h: innerHeight }, open, targets, lastDown };
}

function post(): void {
  const snap = snapshot();
  const body = JSON.stringify(snap);
  if (body === sent) return;
  sent = body;
  seq += 1;
  fetch("/__tapcheck", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snap, seq }) }).catch(() => undefined);
}

function start(): void {
  const table = document.querySelector("td[data-score-cell]")?.closest("table");
  if (!table) {
    setTimeout(start, 200);
    return;
  }
  window.scrollTo(0, table.getBoundingClientRect().top + scrollY);
  document.addEventListener(
    "pointerdown",
    (e) => {
      const at: Point = { x: e.clientX, y: e.clientY };
      downs += 1;
      lastDown = { at, target: describe(e.target instanceof Element ? e.target : null), seq: downs, ended: false };
    },
    true,
  );
  const end = (): void => {
    if (lastDown) lastDown = { ...lastDown, ended: true };
  };
  document.addEventListener("pointerup", end, true);
  document.addEventListener("pointercancel", end, true);
  setInterval(post, 150);
}

if (run) start();
