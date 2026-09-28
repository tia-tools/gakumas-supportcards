/**
 * The published scores as a committed snapshot, and the comparison that stands
 * in for a person reading the daily diff (docs/plans/EXECPLAN_COUNTING_MODEL.md,
 * Milestone 4; docs/adr/0006): between two snapshots, a card whose own generated
 * data did not change must score exactly the same under every route profile at
 * every 凸. A move without a data change means the engine, the parser's reading
 * of an unchanged id, or a route profile changed — none of which an unattended
 * data update may do.
 *
 * What is pinned are the parts a data update can move, not a folded total
 * (decisions A7 and A19 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md): the flat
 * points (skills, events, items) per profile and per lesson-split preset, and
 * the パラメータボーナス+ permil per 凸. Flat points do not depend on the bonus base
 * or on the audition share, and recording them under every preset rather than
 * under the preset that wins by total keeps the file independent of the base
 * even when a base change would flip the winner. The base is a modelling
 * parameter with a player input, applied when a score is read, so a change of
 * it leaves this file untouched. Pure: no I/O; the hash function is passed in.
 */

import { levelFor, resolveAtLevel, score } from "../../src/engine/score.ts";
import { DEFAULT_AUDITION_SHARE, type Card, type HeldCard, type LessonSplit, type LevelLimits, type Scenario, type Totsu } from "../../src/engine/types.ts";
import { byCodeUnit } from "./build-cards.ts";

const TOTSU: readonly Totsu[] = [0, 1, 2, 3, 4];

/** Flat points at 凸0–凸4 under one lesson-split preset, keyed `Vo/Da/Vi` lessons, e.g. `7/1/0`. */
export type FlatByPreset = Record<string, number[]>;

export interface SnapshotEntry {
  name: string;
  /** Hash of the card's generated record: equal hashes mean the card's own data did not change. */
  data: string;
  /** `<scenario id>/<profile id>` → preset → flat points (skills, events and items; the bonus left out) at 凸0–凸4, rounded to 3 decimals. */
  flat: Record<string, FlatByPreset>;
  /** パラメータボーナス+ in force at 凸0–凸4, in tenths of a percent, summed over the card's bonus effects; card data and level limits only, no route. */
  bonus: number[];
}
export type Snapshot = Record<string, SnapshotEntry>;

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
export const presetKey = (l: LessonSplit): string => `${l.vocal}/${l.dance}/${l.visual}`;

/** Held cards are left out: their scores are not published, so they have nothing to keep stable. */
export function buildSnapshot(cards: readonly Card[], held: readonly HeldCard[], scenarios: readonly Scenario[], limits: LevelLimits, hash: (text: string) => string): Snapshot {
  const heldIds = new Set(held.map((h) => h.id));
  const out: Snapshot = {};
  for (const card of [...cards].sort((a, b) => byCodeUnit(a.id, b.id))) {
    if (heldIds.has(card.id)) continue;
    const flat: Record<string, FlatByPreset> = {};
    for (const s of scenarios) {
      for (const p of s.profiles) {
        const byPreset: FlatByPreset = {};
        for (const lessons of p.lessonSplits) {
          byPreset[presetKey(lessons)] = TOTSU.map((t) => {
            const lines = score(card, t, { scenarioId: s.id, profile: p, limits, lessons, share: DEFAULT_AUDITION_SHARE }).lines;
            return round3(lines.filter((l) => l.kind !== "bonus").reduce((sum, l) => sum + l.points, 0));
          });
        }
        flat[`${s.id}/${p.id}`] = byPreset;
      }
    }
    const bonus = TOTSU.map((t) => resolveAtLevel(card, levelFor(limits, card.rarity, t)).effects.filter((e) => e.bonus).reduce((sum, e) => sum + e.value, 0));
    out[card.id] = { name: card.name, data: hash(JSON.stringify(card)), flat, bonus };
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
  /** `<scenario id>/<profile id> <preset>` for flat points, or `bonus` for the permil. */
  profile: string;
  before: number[] | undefined;
  after: number[] | undefined;
}

/** Every `<profile> <preset>` key on either side, sorted. */
function flatKeys(before: SnapshotEntry, after: SnapshotEntry): string[] {
  const keys = new Set<string>();
  for (const e of [before, after]) for (const [profile, byPreset] of Object.entries(e.flat)) for (const preset of Object.keys(byPreset)) keys.add(`${profile} ${preset}`);
  return [...keys].sort(byCodeUnit);
}

function flatAt(e: SnapshotEntry, key: string): number[] | undefined {
  const at = key.indexOf(" ");
  return e.flat[key.slice(0, at)]?.[key.slice(at + 1)];
}

/**
 * Score changes that no change of the card's own data explains. Cards present on
 * one side only (new, removed, or held on one side) and cards whose data hash
 * differs are free to move. A profile or preset present on one side only counts
 * as a move: adding or removing a route is not a data update either.
 */
export function unexplainedMoves(base: Snapshot, current: Snapshot): Moved[] {
  const out: Moved[] = [];
  for (const [id, before] of Object.entries(base)) {
    const after = current[id];
    if (!after || after.data !== before.data) continue;
    for (const key of flatKeys(before, after)) {
      const b = flatAt(before, key);
      const a = flatAt(after, key);
      if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ id, name: after.name, profile: key, before: b, after: a });
    }
    if (JSON.stringify(after.bonus) !== JSON.stringify(before.bonus)) out.push({ id, name: after.name, profile: "bonus", before: before.bonus, after: after.bonus });
  }
  return out;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isFiveNumbers(list: unknown): list is number[] {
  return Array.isArray(list) && list.length === TOTSU.length && list.every((n): n is number => typeof n === "number" && Number.isFinite(n));
}

function parseFlat(id: string, raw: Record<string, unknown>): Record<string, FlatByPreset> {
  const flat: Record<string, FlatByPreset> = {};
  for (const [profile, byPreset] of Object.entries(raw)) {
    if (!isRecord(byPreset)) throw new Error(`score snapshot: malformed flat points for ${id} ${profile}`);
    const presets: FlatByPreset = {};
    for (const [preset, list] of Object.entries(byPreset)) {
      if (!isFiveNumbers(list)) throw new Error(`score snapshot: malformed flat points for ${id} ${profile} ${preset}`);
      presets[preset] = list;
    }
    flat[profile] = presets;
  }
  return flat;
}

/** Parses a snapshot file, rejecting anything that is not one (a truncated or hand-edited file must not read as "nothing moved"). */
export function parseSnapshot(text: string): Snapshot {
  const raw: unknown = JSON.parse(text);
  if (!isRecord(raw)) throw new Error("score snapshot: expected an object keyed by card id");
  const out: Snapshot = {};
  for (const [id, e] of Object.entries(raw)) {
    if (isRecord(e) && "scores" in e) throw new Error(`score snapshot: old format (folded totals) at ${id}; regenerate with bun run generate (docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md, Milestone 2)`);
    if (!isRecord(e) || typeof e["name"] !== "string" || typeof e["data"] !== "string" || !isRecord(e["flat"]) || !isFiveNumbers(e["bonus"])) throw new Error(`score snapshot: malformed entry ${id}`);
    out[id] = { name: e["name"], data: e["data"], flat: parseFlat(id, e["flat"]), bonus: e["bonus"] };
  }
  return out;
}
