/**
 * The audition-score share (docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md, Milestone 2,
 * decisions A3–A5): the 選抜試験's distributed parameter rewards are shared by the
 * main, sub and remaining stat of a lesson split, as tenths summing to 10. A stat's
 * role follows the split — most lessons = main, next = sub, last = other; a tie
 * goes to the split's named `sub`, then in the order vocal, dance, visual. The
 * share a player starts from is the route profile's. Pure, no I/O.
 */

import { DEFAULT_AUDITION_SHARE, type AuditionShare, type LessonSplit, type RouteProfile, type Stat } from "./types.ts";

const ORDER: readonly Stat[] = ["vocal", "dance", "visual"];

/** 0 = main, 1 = sub, 2 = other. */
export function roleOf(split: LessonSplit, stat: Stat): 0 | 1 | 2 {
  const named = (s: Stat): number => (s === split.sub ? 0 : 1);
  const ranked = [...ORDER].sort((a, b) => split[b] - split[a] || named(a) - named(b) || ORDER.indexOf(a) - ORDER.indexOf(b));
  const i = ranked.indexOf(stat);
  if (i === 0) return 0;
  if (i === 1) return 1;
  return 2;
}

/** The stat's fraction (0–1) of the distributed rewards under `share`. */
export function shareOf(split: LessonSplit, stat: Stat, share: AuditionShare): number {
  return share[roleOf(split, stat)] / 10;
}

/** The share a player starts from under `profile`. */
export function defaultShareOf(profile: Pick<RouteProfile, "auditionShare">): AuditionShare {
  return profile.auditionShare ?? DEFAULT_AUDITION_SHARE;
}

/** Three integers from 0 to 10 that sum to 10. */
export function isAuditionShare(list: readonly number[]): list is AuditionShare {
  return list.length === 3 && list.every((n) => Number.isInteger(n) && n >= 0 && n <= 10) && list.reduce((a, b) => a + b, 0) === 10;
}
