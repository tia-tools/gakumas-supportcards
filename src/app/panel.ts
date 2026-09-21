/**
 * The model behind the 「カウントを調整」 panel (docs/adr/0004; decisions C2, C6,
 * C7, C10 and C18 of docs/plans/EXECPLAN_COUNTING_MODEL.md). Pure: the component
 * only renders what `buildPanel` returns, and `applyOverrides` is the one place
 * a player's numbers enter a route profile.
 *
 * Every number a profile states is an input with a key, also used in the URL:
 *   o.<Occasion>                       how often the occasion happens
 *   f.<Occasion>.<family>.<member>     how many of those a filter selects
 *   w.<condition key>                  how many of those meet a condition (absent = all)
 * Inputs form a tree — occasion, its filters, conditions under the filter every
 * trigger using them shares, else under the occasion — and a child can never
 * exceed its parent. Sections are fixed; which inputs are folded away depends on
 * the cards in view.
 */

import { conditionKey, occasionOfConditionKey } from "../engine/count.ts";
import { isFilterFamily, type Card, type ConditionRef, type FilterCounts, type FilterFamily, type FilterRef, type ParsedTrigger, type RouteProfile } from "../engine/types.ts";
import { conditionLabel, memberLabel, occasionLabel } from "./count-labels.ts";

export type Overrides = Readonly<Record<string, number>>;

export interface PanelInput {
  key: string;
  label: string;
  /** The route profile's own number. */
  base: number;
  /** The number in force: the player's override or the base, never above `max`. */
  value: number;
  /** The parent's value; null for an occasion. */
  max: number | null;
  overridden: boolean;
  /** Fixed by the scenario (スケジュール occasions) or derived from a sibling (通常レッスン = レッスン − SPレッスン). */
  readOnly: boolean;
  /** At least one card in view reacts to it. */
  used: boolean;
  /** Set when the route ships this condition below "always met" (C7). */
  note?: string;
  children: PanelInput[];
}

export interface PanelSection {
  id: string;
  title: string;
  inputs: PanelInput[];
}

const SECTIONS: readonly { id: string; title: string; readOnly: boolean; occasions: readonly string[] }[] = [
  { id: "schedule", title: "スケジュール", readOnly: true, occasions: ["ProduceStart", "EndLesson", "EndStepEventSchool", "EndBeforeAuditionRefresh", "EndAudition"] },
  { id: "actions", title: "行動", readOnly: false, occasions: ["StartPresent", "EndStepEventActivity", "StartShop", "StartRefresh", "StartCustomize"] },
  { id: "cards", title: "スキルカード", readOnly: false, occasions: ["GetProduceCard", "DeleteProduceCard", "UpgradeProduceCard", "ChangeProduceCard", "CustomizeProduceCard"] },
  { id: "items", title: "ドリンク・アイテム", readOnly: false, occasions: ["GetProduceDrink", "BuyShopItemProduceDrink", "BuyShopItemProduceCard", "GetProduceItem"] },
];
/** Occasions no fixed section lists (a phase type the game adds) stay reachable here. */
const OTHER_SECTION = { id: "other", title: "その他", readOnly: false };

export const occasionKey = (occasion: string): string => `o.${occasion}`;
export const filterKey = (occasion: string, f: FilterRef): string => `f.${occasion}.${f.family}.${f.member}`;
export const conditionInputKey = (occasion: string, c: ConditionRef): string => `w.${conditionKey(occasion, c)}`;

function countable(t: ParsedTrigger): FilterRef[] {
  return (t.filters ?? []).filter((f) => f.family !== "lessonStat");
}

/** Every distinct trigger on the given cards, at any level. */
export function triggersOf(cards: readonly Card[]): ParsedTrigger[] {
  const seen = new Map<string, ParsedTrigger>();
  for (const c of cards) for (const bp of c.breakpoints) for (const e of bp.effects) if (e.trigger) seen.set(JSON.stringify(e.trigger), e.trigger);
  return [...seen.values()];
}

/** The input keys the triggers react to. */
export function keysUsedBy(triggers: readonly ParsedTrigger[]): Set<string> {
  const out = new Set<string>();
  for (const t of triggers) {
    out.add(occasionKey(t.occasion));
    for (const f of countable(t)) out.add(filterKey(t.occasion, f));
    for (const c of t.conditions ?? []) out.add(conditionInputKey(t.occasion, c));
  }
  return out;
}

function filterBase(profile: RouteProfile, occasion: string, f: FilterRef): number {
  const counts = profile.filters[occasion]?.[f.family];
  return counts?.members?.[f.member] ?? counts?.default ?? 0;
}

/**
 * The profile with the player's numbers in it. An SP-lesson override moves 通常レッスン
 * with it (a lesson is one or the other) unless 通常レッスン is overridden itself (C18).
 * Bounds are not enforced here: the engine takes the minimum along the tree anyway.
 */
export function applyOverrides(profile: RouteProfile, overrides: Overrides): RouteProfile {
  if (Object.keys(overrides).length === 0) return profile;
  const occasions: Record<string, number> = { ...profile.occasions };
  const filters: Record<string, Partial<Record<FilterFamily, FilterCounts>>> = {};
  for (const [occasion, families] of Object.entries(profile.filters)) filters[occasion] = { ...families };
  const conditions: Record<string, number> = { ...profile.conditions };
  for (const [key, n] of Object.entries(overrides)) {
    const [kind, occasion, family, ...member] = key.split(".");
    if (kind === "o" && occasion) occasions[occasion] = n;
    else if (kind === "w") conditions[key.slice(2)] = n;
    else if (kind === "f" && occasion && family && isFilterFamily(family) && member.length > 0) {
      const families = (filters[occasion] ??= {});
      families[family] = { ...families[family], members: { ...families[family]?.members, [member.join(".")]: n } };
    }
  }
  for (const [occasion, families] of Object.entries(filters)) {
    const kinds = families.lessonKind?.members;
    if (kinds?.["sp"] === undefined || kinds["normal"] === undefined || `f.${occasion}.lessonKind.normal` in overrides) continue;
    families.lessonKind = { ...families.lessonKind, members: { ...kinds, normal: Math.max(0, (occasions[occasion] ?? 0) - kinds["sp"]) } };
  }
  return { ...profile, occasions, filters, conditions };
}

interface Draft {
  key: string;
  label: string;
  base: number;
  own: number;
  readOnly: boolean;
  note?: string;
  children: Draft[];
}

function finish(d: Draft, max: number | null, overrides: Overrides, used: ReadonlySet<string>): PanelInput {
  const value = max === null ? d.own : Math.min(d.own, max);
  const input: PanelInput = { key: d.key, label: d.label, base: d.base, value, max, overridden: d.key in overrides, readOnly: d.readOnly, used: used.has(d.key), children: d.children.map((c) => finish(c, value, overrides, used)) };
  if (d.note !== undefined) input.note = d.note;
  return input;
}

/**
 * The panel for a profile: `all` are the triggers of every shipped card (they
 * decide which inputs exist), `visible` those of the cards in view (they decide
 * what is folded away).
 */
export function buildPanel(profile: RouteProfile, overrides: Overrides, all: readonly ParsedTrigger[], visible: readonly ParsedTrigger[]): PanelSection[] {
  const applied = applyOverrides(profile, overrides);
  const used = keysUsedBy(visible);

  // Which filters and conditions exist per occasion: those the cards use plus those the profile names.
  const filtersByOccasion = new Map<string, Map<string, FilterRef>>();
  const addFilter = (occasion: string, f: FilterRef): void => void (filtersByOccasion.get(occasion) ?? filtersByOccasion.set(occasion, new Map()).get(occasion))?.set(filterKey(occasion, f), f);
  for (const [occasion, families] of Object.entries(profile.filters)) {
    for (const [family, counts] of Object.entries(families)) {
      if (isFilterFamily(family)) for (const member of Object.keys(counts.members ?? {})) addFilter(occasion, { family, member });
    }
  }
  /** condition input key → the condition and the filter keys of each trigger using it. */
  const conditions = new Map<string, { occasion: string; c: ConditionRef; parents: Set<string> }>();
  for (const t of all) {
    for (const f of countable(t)) addFilter(t.occasion, f);
    const fs = countable(t);
    const parent = fs.length === 1 && fs[0] ? filterKey(t.occasion, fs[0]) : occasionKey(t.occasion);
    for (const c of t.conditions ?? []) {
      const key = conditionInputKey(t.occasion, c);
      (conditions.get(key) ?? conditions.set(key, { occasion: t.occasion, c, parents: new Set() }).get(key))?.parents.add(parent);
    }
  }

  const conditionDraft = (key: string, c: ConditionRef, parentOwn: number): Draft => {
    const shipped = profile.conditions?.[key.slice(2)];
    const d: Draft = { key, label: conditionLabel(c), base: shipped ?? parentOwn, own: applied.conditions?.[key.slice(2)] ?? parentOwn, readOnly: false, children: [] };
    if (shipped !== undefined) d.note = `このルートの既定は${shipped}回（条件を常に満たす場合は${parentOwn}回）`;
    return d;
  };

  const occasionDraft = (occasion: string, readOnly: boolean): Draft => {
    const own = applied.occasions[occasion] ?? 0;
    const root: Draft = { key: occasionKey(occasion), label: occasionLabel(occasion), base: profile.occasions[occasion] ?? 0, own, readOnly, children: [] };
    for (const [key, f] of filtersByOccasion.get(occasion) ?? []) {
      const derived = f.family === "lessonKind" && f.member === "normal" && applied.filters[occasion]?.lessonKind?.members?.["sp"] !== undefined;
      root.children.push({ key, label: memberLabel(f.family, f.member), base: filterBase(profile, occasion, f), own: filterBase(applied, occasion, f), readOnly: derived, children: [] });
    }
    for (const [key, { occasion: o, c, parents }] of conditions) {
      if (o !== occasion) continue;
      const [only] = parents;
      const parent = parents.size === 1 ? root.children.find((ch) => ch.key === only) : undefined;
      (parent ?? root).children.push(conditionDraft(key, c, Math.min(own, parent?.own ?? own)));
    }
    return root;
  };

  const known = new Set(SECTIONS.flatMap((s) => s.occasions));
  const named = new Set([...Object.keys(profile.occasions), ...all.map((t) => t.occasion), ...[...conditions.values()].map((c) => c.occasion), ...Object.keys(profile.conditions ?? {}).map(occasionOfConditionKey)]);
  const sections = SECTIONS.map((s) => ({ id: s.id, title: s.title, inputs: s.occasions.filter((o) => named.has(o)).map((o) => finish(occasionDraft(o, s.readOnly), null, overrides, used)) }));
  const others = [...named].filter((o) => !known.has(o)).sort();
  if (others.length > 0) sections.push({ id: OTHER_SECTION.id, title: OTHER_SECTION.title, inputs: others.map((o) => finish(occasionDraft(o, OTHER_SECTION.readOnly), null, overrides, used)) });
  return sections;
}

function flatten(inputs: readonly PanelInput[]): PanelInput[] {
  return inputs.flatMap((i) => [i, ...flatten(i.children)]);
}

/** Keys a player may override under this profile; anything else in a URL is ignored. */
export function adjustableKeys(profile: RouteProfile, all: readonly ParsedTrigger[]): Set<string> {
  return new Set(flatten(buildPanel(profile, {}, all, []).flatMap((s) => s.inputs)).filter((i) => !i.readOnly).map((i) => i.key));
}
