/**
 * The published scores as a committed snapshot, and the comparison that stands
 * in for a person reading the weekly diff (docs/plans/EXECPLAN_COUNTING_MODEL.md,
 * Milestone 4): between two snapshots, a card whose own generated data did not
 * change must score exactly the same under every route profile at every 凸. A
 * move without a data change means the engine, the parser's reading of an
 * unchanged id, or a route profile changed — none of which an unattended data
 * update may do. Pure: no I/O; the hash function is passed in.
 */

import { scoreBest } from "../../src/engine/score.ts";
import type { Card, HeldCard, LevelLimits, Scenario, Totsu } from "../../src/engine/types.ts";
import { byCodeUnit } from "./build-cards.ts";

const TOTSU: readonly Totsu[] = [0, 1, 2, 3, 4];

export interface SnapshotEntry {
  name: string;
  /** Hash of the card's generated record: equal hashes mean the card's own data did not change. */
  data: string;
  /** `<scenario id>/<profile id>` → 点数 at 凸0–凸4 under the best lesson split, rounded to 3 decimals. */
  scores: Record<string, number[]>;
}
export type Snapshot = Record<string, SnapshotEntry>;

/** Held cards are left out: their scores are not published, so they have nothing to keep stable. */
export function buildSnapshot(cards: readonly Card[], held: readonly HeldCard[], scenarios: readonly Scenario[], limits: LevelLimits, hash: (text: string) => string): Snapshot {
  const heldIds = new Set(held.map((h) => h.id));
  const out: Snapshot = {};
  for (const card of [...cards].sort((a, b) => byCodeUnit(a.id, b.id))) {
    if (heldIds.has(card.id)) continue;
    const scores: Record<string, number[]> = {};
    for (const s of scenarios) {
      for (const p of s.profiles) scores[`${s.id}/${p.id}`] = TOTSU.map((t) => Math.round(scoreBest(card, t, { scenarioId: s.id, profile: p, limits }).total * 1000) / 1000);
    }
    out[card.id] = { name: card.name, data: hash(JSON.stringify(card)), scores };
  }
  return out;
}

/** One card per line, so a data update's diff of this file reads as a list of the cards whose scores moved. */
export function emitSnapshot(snapshot: Snapshot): string {
  const lines = Object.entries(snapshot).map(([id, e]) => `  ${JSON.stringify(id)}: ${JSON.stringify(e)}`);
  return `{\n${lines.join(",\n")}\n}\n`;
}

export interface Moved {
  id: string;
  name: string;
  profile: string;
  before: number[] | undefined;
  after: number[] | undefined;
}

/**
 * Score changes that no change of the card's own data explains. Cards present on
 * one side only (new, removed, or held on one side) and cards whose data hash
 * differs are free to move. A profile present on one side only counts as a move:
 * adding or removing a route is not a data update either.
 */
export function unexplainedMoves(base: Snapshot, current: Snapshot): Moved[] {
  const out: Moved[] = [];
  for (const [id, before] of Object.entries(base)) {
    const after = current[id];
    if (!after || after.data !== before.data) continue;
    for (const profile of [...new Set([...Object.keys(before.scores), ...Object.keys(after.scores)])].sort(byCodeUnit)) {
      const b = before.scores[profile];
      const a = after.scores[profile];
      if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ id, name: after.name, profile, before: b, after: a });
    }
  }
  return out;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Parses a snapshot file, rejecting anything that is not one (a truncated or hand-edited file must not read as "nothing moved"). */
export function parseSnapshot(text: string): Snapshot {
  const raw: unknown = JSON.parse(text);
  if (!isRecord(raw)) throw new Error("score snapshot: expected an object keyed by card id");
  const out: Snapshot = {};
  for (const [id, e] of Object.entries(raw)) {
    if (!isRecord(e) || typeof e["name"] !== "string" || typeof e["data"] !== "string" || !isRecord(e["scores"])) throw new Error(`score snapshot: malformed entry ${id}`);
    const scores: Record<string, number[]> = {};
    for (const [profile, list] of Object.entries(e["scores"])) {
      if (!Array.isArray(list) || list.length !== TOTSU.length || !list.every((n): n is number => typeof n === "number" && Number.isFinite(n))) throw new Error(`score snapshot: malformed scores for ${id} ${profile}`);
      scores[profile] = list;
    }
    out[id] = { name: e["name"], data: e["data"], scores };
  }
  return out;
}
