/**
 * How often an effect's trigger happens in one run under a route profile that
 * counts occasions, filters and conditions (docs/adr/0004; decisions C2, C3,
 * C5, C10 of docs/plans/EXECPLAN_COUNTING_MODEL.md). Pure: no DOM, no I/O.
 *
 *   occurrences = min( profile.occasions[occasion],
 *                      each filter's count   (lesson stat: the lesson split; else the member's count or its family default),
 *                      each condition's count where the profile states one (unstated = met every time),
 *                      the effect's own cap )
 * and 0 when the trigger is restricted to another scenario.
 */

import type { ClassifiedEffect, ConditionRef, FilterRef, LessonSplit, ParsedTrigger, RouteProfile, Stat } from "./types.ts";

export interface CountContext {
  scenarioId: string;
  profile: RouteProfile;
  lessons: LessonSplit;
}

function boundOf(c: ConditionRef): string {
  if (c.min > 0 && c.max > 0) return `${c.min}to${c.max}`;
  return c.max > 0 ? `le${c.max}` : `ge${c.min}`;
}

/**
 * The name a profile and a URL override use for a condition: occasion, the
 * game's word, the counted cards if any, and the bound — `EndLesson.produce_card_count.ge20`,
 * `GetProduceCard.produce_card_search_count-effectGroup.review.ge8`, `StartCustomize.dance.le900`.
 * Only letters, digits, `.`, `-` and `_`, so it survives a query string unescaped.
 * The trigger's filters are not part of it (C10).
 */
export function conditionKey(occasion: string, c: ConditionRef): string {
  const subject = (c.subject ?? []).map((f) => `-${f.family}.${f.member}`).join("");
  return `${occasion}.${c.kind}${subject}.${boundOf(c)}`;
}

/** The occasion a condition key belongs to. */
export function occasionOfConditionKey(key: string): string {
  return key.slice(0, key.indexOf("."));
}

function isStat(member: string): member is Stat {
  return member === "vocal" || member === "dance" || member === "visual";
}

/** The profile's number for a filter on an occasion, or undefined when the profile has none. */
function filterCount(profile: RouteProfile, occasion: string, f: FilterRef): number | undefined {
  const family = profile.filters[occasion]?.[f.family];
  return family?.members?.[f.member] ?? family?.default;
}

/**
 * The numbers `occurrences` needs from the profile and does not find, as paths
 * (`occasions.EndLesson`, `filters.GetProduceCard.cardType.mental`). Each would
 * silently count 0, so the data checks require this to be empty for every
 * effect of every shipped card. Conditions never appear: unstated means met.
 */
export function missingNumbers(trigger: ParsedTrigger, profile: RouteProfile): string[] {
  const missing: string[] = [];
  if (profile.occasions[trigger.occasion] === undefined) missing.push(`occasions.${trigger.occasion}`);
  for (const f of trigger.filters ?? []) {
    if (f.family === "lessonStat") {
      if (!isStat(f.member)) missing.push(`lessonStat ${f.member} is not a stat`);
    } else if (filterCount(profile, trigger.occasion, f) === undefined) missing.push(`filters.${trigger.occasion}.${f.family}.${f.member}`);
  }
  return missing;
}

export function occurrences(effect: ClassifiedEffect, ctx: CountContext): number {
  const t = effect.trigger;
  if (!t) return 0;
  if (t.scenario !== undefined && t.scenario !== ctx.scenarioId) return 0;
  let n = ctx.profile.occasions[t.occasion] ?? 0;
  for (const f of t.filters ?? []) {
    if (f.family === "lessonStat") n = Math.min(n, isStat(f.member) ? ctx.lessons[f.member] : 0);
    else n = Math.min(n, filterCount(ctx.profile, t.occasion, f) ?? 0);
  }
  for (const c of t.conditions ?? []) {
    const stated = ctx.profile.conditions?.[conditionKey(t.occasion, c)];
    if (stated !== undefined) n = Math.min(n, stated);
  }
  return effect.cap ? Math.min(effect.cap, n) : n;
}
