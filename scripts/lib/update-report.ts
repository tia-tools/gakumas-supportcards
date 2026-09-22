/**
 * What an unattended data update says about itself: the text of its pull request and of the
 * issue that asks a person about held cards (first plan, Milestone 5; docs/adr/0005).
 * Pure: two score snapshots and the held list in, markdown out.
 */

import type { HeldCard } from "../../src/engine/types.ts";
import type { Snapshot } from "./score-snapshot.ts";

export interface CardRef {
  id: string;
  name: string;
}

export interface UpdateDiff {
  added: CardRef[];
  removed: CardRef[];
  /** Cards present in both snapshots whose own generated data changed (a rebalance, a new level breakpoint). */
  changed: CardRef[];
}

const byId = (a: CardRef, b: CardRef): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function diffSnapshots(base: Snapshot, current: Snapshot): UpdateDiff {
  const ref = (s: Snapshot, id: string): CardRef => ({ id, name: s[id]?.name ?? id });
  const added = Object.keys(current).filter((id) => !(id in base)).map((id) => ref(current, id));
  const removed = Object.keys(base).filter((id) => !(id in current)).map((id) => ref(base, id));
  const changed = Object.keys(current).filter((id) => id in base && base[id]?.data !== current[id]?.data).map((id) => ref(current, id));
  return { added: added.sort(byId), removed: removed.sort(byId), changed: changed.sort(byId) };
}

export function isEmpty(diff: UpdateDiff): boolean {
  return diff.added.length + diff.removed.length + diff.changed.length === 0;
}

export function updateTitle(diff: UpdateDiff, held: readonly HeldCard[], date: string): string {
  const parts = [`${diff.added.length} new`, `${diff.changed.length} changed`];
  if (diff.removed.length > 0) parts.push(`${diff.removed.length} removed`);
  if (held.length > 0) parts.push(`${held.length} held`);
  return `chore: data update ${date} — ${parts.join(", ")}`;
}

/** 凸0 and 凸4 under the first published profile, so a reader sees at a glance what a new card is worth. */
function scoreNote(current: Snapshot, id: string): string {
  const scores = Object.entries(current[id]?.scores ?? {})[0];
  if (!scores) return "";
  const [profile, values] = scores;
  return ` — ${profile} 凸0 ${values[0] ?? "?"} / 凸4 ${values[4] ?? "?"}`;
}

function section(heading: string, cards: readonly CardRef[], note: (c: CardRef) => string = () => ""): string[] {
  if (cards.length === 0) return [];
  return [`### ${heading} (${cards.length})`, "", ...cards.map((c) => `- \`${c.id}\` ${c.name}${note(c)}`), ""];
}

export function renderPullRequest(diff: UpdateDiff, held: readonly HeldCard[], current: Snapshot, runUrl?: string): string {
  const lines = [
    "Unattended data update from `vertesan/gakumasu-diff`.",
    "",
    "Before this pull request was opened, the same run regenerated the data and passed the unit tests, the type check and the score-stability check (`docs/adr/0006`): no card whose own data is unchanged moved in score. It merges and deploys by itself (first plan, decision D34).",
    "",
    ...section("New cards", diff.added, (c) => scoreNote(current, c.id)),
    ...section("Cards whose data changed", diff.changed, (c) => scoreNote(current, c.id)),
    ...section("Cards removed upstream", diff.removed),
  ];
  if (held.length > 0) {
    lines.push(`### Held cards (${held.length})`, "", "These are hidden from the table until a person decides how to count them (`docs/adr/0005`); an issue labelled `held-cards` lists the reasons.", "", ...held.map((h) => `- \`${h.id}\` ${h.name}`), "");
  }
  if (runUrl) lines.push(`Run: ${runUrl}`, "");
  return lines.join("\n");
}

export function renderHeldIssue(held: readonly HeldCard[], runUrl?: string): string {
  const lines = [
    "The weekly data update found cards it cannot score. They are hidden from the table — the site never shows a number it cannot stand behind (`docs/adr/0005`) — and every other card published normally.",
    "",
    "Each reason names the trigger piece, effect type or missing route-profile number a person has to decide about. Resolve it on a branch (a parser rule, a profile number), run `bun run generate`, and the card returns; this issue closes by itself on the first update that holds nothing.",
    "",
    ...held.flatMap((h) => [`### \`${h.id}\` ${h.name}`, "", ...h.reasons.map((r) => `- ${r}`), ""]),
  ];
  if (runUrl) lines.push(`Run: ${runUrl}`, "");
  return lines.join("\n");
}
