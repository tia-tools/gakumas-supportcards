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
 *   i.<item id>  d.<item id>           a P-item's cap on fires, and its tick into the deck (src/app/item-panel.ts)
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

/** The three tables of a profile a player's numbers can change, copied so the profile itself stays as shipped. */
interface ProfileDraft {
  occasions: Record<string, number>;
  filters: Record<string, Partial<Record<FilterFamily, FilterCounts>>>;
  conditions: Record<string, number>;
}

/** Writes one override into the draft by its key's kind: `o.`, `w.` or `f.`; an unknown key changes nothing. */
function setOverride(draft: ProfileDraft, key: string, n: number): void {
  const [kind, occasion, family, ...member] = key.split(".");
  if (kind === "o" && occasion) draft.occasions[occasion] = n;
  else if (kind === "w") draft.conditions[key.slice(2)] = n;
  else if (kind === "f" && occasion && family && isFilterFamily(family) && member.length > 0) {
    const families = (draft.filters[occasion] ??= {});
    families[family] = { ...families[family], members: { ...families[family]?.members, [member.join(".")]: n } };
  }
}

/** 通常レッスン follows an SP-lesson override (a lesson is one or the other) unless overridden itself (C18). */
function deriveNormalLessons(draft: ProfileDraft, overrides: Overrides): void {
  for (const [occasion, families] of Object.entries(draft.filters)) {
    const kinds = families.lessonKind?.members;
    if (kinds?.["sp"] === undefined || kinds["normal"] === undefined || `f.${occasion}.lessonKind.normal` in overrides) continue;
    families.lessonKind = { ...families.lessonKind, members: { ...kinds, normal: Math.max(0, (draft.occasions[occasion] ?? 0) - kinds["sp"]) } };
  }
}

/** The occasion the deck's P-item drinks add to (decision A8 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md). */
export const DRINK_OCCASION = "GetProduceDrink";
/** The read-only child of Pドリンク獲得 that shows what ticked P-items add. */
export const DECK_DRINKS_KEY = `x.${DRINK_OCCASION}.items`;

/**
 * The profile with the player's numbers in it. An SP-lesson override moves 通常レッスン
 * with it (a lesson is one or the other) unless 通常レッスン is overridden itself (C18).
 * `deckDrinks` (the drinks ticked P-items add, src/app/item-panel.ts) are added to
 * Pドリンク獲得 after the overrides. Bounds are not enforced here: the engine takes
 * the minimum along the tree anyway.
 */
export function applyOverrides(profile: RouteProfile, overrides: Overrides, deckDrinks = 0): RouteProfile {
  if (Object.keys(overrides).length === 0 && deckDrinks === 0) return profile;
  const draft: ProfileDraft = { occasions: { ...profile.occasions }, filters: {}, conditions: { ...profile.conditions } };
  for (const [occasion, families] of Object.entries(profile.filters)) draft.filters[occasion] = { ...families };
  for (const [key, n] of Object.entries(overrides)) setOverride(draft, key, n);
  deriveNormalLessons(draft, overrides);
  if (deckDrinks > 0) draft.occasions[DRINK_OCCASION] = (draft.occasions[DRINK_OCCASION] ?? 0) + deckDrinks;
  return { ...profile, ...draft };
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

/** A condition input: the condition, its occasion, and the filter or occasion key each trigger using it sits under. */
interface ConditionUse {
  occasion: string;
  c: ConditionRef;
  parents: Set<string>;
}

/** What the drafts of one panel are built from: the profile as shipped and as overridden, and which inputs exist. */
interface PanelContext {
  profile: RouteProfile;
  applied: RouteProfile;
  /** occasion → filter input key → the filter */
  filters: Map<string, Map<string, FilterRef>>;
  /** condition input key → its use */
  conditions: Map<string, ConditionUse>;
  /** Drinks ticked P-items add to Pドリンク獲得 (src/app/item-panel.ts). */
  deckDrinks: number;
}

/** The filters that exist per occasion: those the profile names, then those the cards use. */
function filtersOf(profile: RouteProfile, all: readonly ParsedTrigger[]): Map<string, Map<string, FilterRef>> {
  const out = new Map<string, Map<string, FilterRef>>();
  const add = (occasion: string, f: FilterRef): void => void (out.get(occasion) ?? out.set(occasion, new Map()).get(occasion))?.set(filterKey(occasion, f), f);
  for (const [occasion, families] of Object.entries(profile.filters)) {
    for (const [family, counts] of Object.entries(families)) {
      if (isFilterFamily(family)) for (const member of Object.keys(counts.members ?? {})) add(occasion, { family, member });
    }
  }
  for (const t of all) for (const f of countable(t)) add(t.occasion, f);
  return out;
}

/** The conditions the cards use, each with the key of the filter (or occasion) every trigger carrying it sits under. */
function conditionsOf(all: readonly ParsedTrigger[]): Map<string, ConditionUse> {
  const out = new Map<string, ConditionUse>();
  for (const t of all) {
    const fs = countable(t);
    const parent = fs.length === 1 && fs[0] ? filterKey(t.occasion, fs[0]) : occasionKey(t.occasion);
    for (const c of t.conditions ?? []) {
      const key = conditionInputKey(t.occasion, c);
      (out.get(key) ?? out.set(key, { occasion: t.occasion, c, parents: new Set() }).get(key))?.parents.add(parent);
    }
  }
  return out;
}

function filterDraft(ctx: PanelContext, occasion: string, key: string, f: FilterRef): Draft {
  const derived = f.family === "lessonKind" && f.member === "normal" && ctx.applied.filters[occasion]?.lessonKind?.members?.["sp"] !== undefined;
  return { key, label: memberLabel(f.family, f.member), base: filterBase(ctx.profile, occasion, f), own: filterBase(ctx.applied, occasion, f), readOnly: derived, children: [] };
}

function conditionDraft(ctx: PanelContext, key: string, c: ConditionRef, parentOwn: number): Draft {
  const shipped = ctx.profile.conditions?.[key.slice(2)];
  const d: Draft = { key, label: conditionLabel(c), base: shipped ?? parentOwn, own: ctx.applied.conditions?.[key.slice(2)] ?? parentOwn, readOnly: false, children: [] };
  if (shipped !== undefined) d.note = `このルートの既定は${shipped}回（条件を常に満たす場合は${parentOwn}回）`;
  return d;
}

/** Each of the occasion's conditions goes under the filter every trigger using it shares, else under the occasion. */
function placeConditions(ctx: PanelContext, root: Draft, occasion: string): void {
  for (const [key, { occasion: o, c, parents }] of ctx.conditions) {
    if (o !== occasion) continue;
    const [only] = parents;
    const parent = parents.size === 1 ? root.children.find((ch) => ch.key === only) : undefined;
    (parent ?? root).children.push(conditionDraft(ctx, key, c, Math.min(root.own, parent?.own ?? root.own)));
  }
}

function occasionDraft(ctx: PanelContext, occasion: string, readOnly: boolean): Draft {
  const own = ctx.applied.occasions[occasion] ?? 0;
  const root: Draft = { key: occasionKey(occasion), label: occasionLabel(occasion), base: ctx.profile.occasions[occasion] ?? 0, own, readOnly, children: [] };
  for (const [key, f] of ctx.filters.get(occasion) ?? []) root.children.push(filterDraft(ctx, occasion, key, f));
  placeConditions(ctx, root, occasion);
  if (occasion === DRINK_OCCASION && ctx.deckDrinks > 0) root.children.push({ key: DECK_DRINKS_KEY, label: "Pアイテムによる追加", base: ctx.deckDrinks, own: ctx.deckDrinks, readOnly: true, note: "「Pアイテム」で「デッキに入れる」にしたアイテムが配るドリンク", children: [] });
  return root;
}

/**
 * The panel for a profile: `all` are the triggers of every shipped card (they
 * decide which inputs exist), `visible` those of the cards in view (they decide
 * what is folded away); `deckDrinks` are the drinks ticked P-items add to
 * Pドリンク獲得, shown as a read-only child of it.
 */
export function buildPanel(profile: RouteProfile, overrides: Overrides, all: readonly ParsedTrigger[], visible: readonly ParsedTrigger[], deckDrinks = 0): PanelSection[] {
  const ctx: PanelContext = { profile, applied: applyOverrides(profile, overrides, deckDrinks), filters: filtersOf(profile, all), conditions: conditionsOf(all), deckDrinks };
  const used = keysUsedBy(visible);
  if (deckDrinks > 0) used.add(DECK_DRINKS_KEY);
  const known = new Set(SECTIONS.flatMap((s) => s.occasions));
  const named = new Set([...Object.keys(profile.occasions), ...all.map((t) => t.occasion), ...[...ctx.conditions.values()].map((c) => c.occasion), ...Object.keys(profile.conditions ?? {}).map(occasionOfConditionKey)]);
  const sections = SECTIONS.map((s) => ({ id: s.id, title: s.title, inputs: s.occasions.filter((o) => named.has(o)).map((o) => finish(occasionDraft(ctx, o, s.readOnly), null, overrides, used)) }));
  const others = [...named].filter((o) => !known.has(o)).sort();
  if (others.length > 0) sections.push({ id: OTHER_SECTION.id, title: OTHER_SECTION.title, inputs: others.map((o) => finish(occasionDraft(ctx, o, OTHER_SECTION.readOnly), null, overrides, used)) });
  return sections;
}

function flatten(inputs: readonly PanelInput[]): PanelInput[] {
  return inputs.flatMap((i) => [i, ...flatten(i.children)]);
}

/** Keys a player may override under this profile; anything else in a URL is ignored. */
export function adjustableKeys(profile: RouteProfile, all: readonly ParsedTrigger[]): Set<string> {
  return new Set(flatten(buildPanel(profile, {}, all, []).flatMap((s) => s.inputs)).filter((i) => !i.readOnly).map((i) => i.key));
}
