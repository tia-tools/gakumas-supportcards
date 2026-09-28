/**
 * The 「選抜試験のスコア配分」 slider's rules (decisions A4, A5 of
 * docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md): three tenths — main, sub, other —
 * summing to 10, moved by two thumbs (the main/sub boundary sits at `main`, the
 * sub/other boundary at `main + sub`) or by +/− on one role, and labelled by
 * role or, when a preset is fixed, by the stat that holds the role. Pure;
 * ShareSlider.tsx renders it.
 */

import { roleOf } from "../engine/share.ts";
import type { AuditionShare, LessonSplit, Stat } from "../engine/types.ts";
import { STAT_SHORT } from "./labels.ts";

export type Role = 0 | 1 | 2;
const ROLES: readonly Role[] = [0, 1, 2];
const STATS: readonly Stat[] = ["vocal", "dance", "visual"];

/** Moves a thumb to tenth `to`; thumbs may meet but not cross, so no segment goes below 0. */
export function moveThumb(share: AuditionShare, thumb: 0 | 1, to: number): AuditionShare {
  const t = Math.max(0, Math.min(10, Math.round(to)));
  const [main, sub] = share;
  if (thumb === 0) {
    const b = Math.min(t, main + sub);
    return [b, main + sub - b, 10 - main - sub];
  }
  const b = Math.max(t, main);
  return [main, b - main, 10 - b];
}

/** +1 or −1 on a role, taken from or given to the next role (to the right, else to the left); unchanged when nothing can move. */
export function step(share: AuditionShare, role: Role, delta: 1 | -1): AuditionShare {
  const out: [number, number, number] = [share[0], share[1], share[2]];
  const neighbours: readonly Role[] = role === 0 ? [1, 2] : role === 1 ? [2, 0] : [1, 0];
  const partner = delta === 1 ? neighbours.find((r) => out[r] > 0) : neighbours[0];
  if (partner === undefined || (delta === -1 && out[role] === 0)) return share;
  out[role] += delta;
  out[partner] -= delta;
  return out;
}

export interface RoleLabel {
  text: string;
  /** Tailwind classes for the segment and its number. */
  bar: string;
  ink: string;
}

const ROLE_LABELS: readonly RoleLabel[] = [
  { text: "メイン", bar: "bg-slate-700", ink: "text-slate-800" },
  { text: "サブ", bar: "bg-slate-400", ink: "text-slate-600" },
  { text: "その他", bar: "bg-slate-200", ink: "text-slate-500" },
];
const STAT_LABELS: Readonly<Record<Stat, RoleLabel>> = {
  vocal: { text: STAT_SHORT.vocal, bar: "bg-rose-500", ink: "text-rose-600" },
  dance: { text: STAT_SHORT.dance, bar: "bg-sky-500", ink: "text-sky-600" },
  visual: { text: STAT_SHORT.visual, bar: "bg-amber-400", ink: "text-amber-600" },
};

/** Role names when each card is scored under its own best preset; the stats holding the roles when a preset is fixed. */
export function roleLabels(split: LessonSplit | null): readonly [RoleLabel, RoleLabel, RoleLabel] {
  if (split === null) return [ROLE_LABELS[0] ?? STAT_LABELS.vocal, ROLE_LABELS[1] ?? STAT_LABELS.dance, ROLE_LABELS[2] ?? STAT_LABELS.visual];
  const of = (role: Role): RoleLabel => STAT_LABELS[STATS.find((s) => roleOf(split, s) === role) ?? "visual"];
  return [of(ROLES[0] ?? 0), of(ROLES[1] ?? 1), of(ROLES[2] ?? 2)];
}
