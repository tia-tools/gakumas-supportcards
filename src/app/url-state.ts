/**
 * The view state of the table and its encoding in the URL query string (plan
 * decision D9: a filtered, sorted view is shareable). Pure: parsing and
 * serialising take the scenarios and the adjustable count keys as arguments, and
 * only values that differ from the defaults are written.
 *
 * Query parameters:
 *   s=<scenario id>  p=<profile id>  ls=<lesson-split preset index; absent = best preset (D26)>
 *   type=vocal,dance  plan=sense,logic  rarity=ssr   (comma-separated; absent = all)
 *   sort=4d           (凸 column 0–4 followed by d or a; default 4d)
 *   o.<Occasion>=<n>  f.<Occasion>.<family>.<member>=<n>  w.<condition key>=<n>
 *                     count overrides (D2), keyed as in src/app/panel.ts. The `c.<category>`
 *                     keys of the former counting model are ignored.
 */

import type { CardType, Plan, Rarity, RouteProfile, Scenario, Totsu } from "../engine/types.ts";

export interface SortSpec {
  totsu: Totsu;
  desc: boolean;
}

export interface ViewState {
  scenarioId: string;
  profileId: string;
  /** Index into the profile's `lessonSplits`; null scores each card under its best preset. */
  split: number | null;
  types: readonly CardType[];
  plans: readonly Plan[];
  rarities: readonly Rarity[];
  sort: SortSpec;
  /** Count key (`o.…`, `f.…`, `w.…`; see src/app/panel.ts) → the player's number in place of the profile's. */
  overrides: Readonly<Record<string, number>>;
}

export const CARD_TYPES: readonly CardType[] = ["vocal", "dance", "visual", "assist"];
export const PLANS: readonly Plan[] = ["common", "sense", "logic", "anomaly"];
export const RARITIES: readonly Rarity[] = ["r", "sr", "ssr"];
export const TOTSUS: readonly Totsu[] = [0, 1, 2, 3, 4];
export const DEFAULT_SORT: SortSpec = { totsu: 4, desc: true };

/** The count keys a player may override under a profile (`adjustableKeys` of src/app/panel.ts, with the shipped cards bound). */
export type AdjustableKeys = (profile: RouteProfile) => ReadonlySet<string>;

const OVERRIDE_KEY = /^[ofw]\./;

export function defaultViewState(scenarios: readonly Scenario[]): ViewState {
  const scenario = scenarios[0];
  const profile = scenario?.profiles[0];
  if (!scenario || !profile) throw new Error("no scenario shipped");
  return { scenarioId: scenario.id, profileId: profile.id, split: null, types: [], plans: [], rarities: [], sort: DEFAULT_SORT, overrides: {} };
}

/** The scenario and profile the state names, falling back to the defaults when an id is unknown. */
export function resolveSelection(state: ViewState, scenarios: readonly Scenario[]): { scenario: Scenario; profile: Scenario["profiles"][number] } {
  const scenario = scenarios.find((s) => s.id === state.scenarioId) ?? scenarios[0];
  if (!scenario) throw new Error("no scenario shipped");
  const profile = scenario.profiles.find((p) => p.id === state.profileId) ?? scenario.profiles[0];
  if (!profile) throw new Error(`scenario ${scenario.id} has no profiles`);
  return { scenario, profile };
}

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return [];
  const wanted = new Set(raw.split(","));
  return allowed.filter((v) => wanted.has(v));
}

function parseSort(raw: string | null): SortSpec {
  const m = raw ? /^([0-4])([ad])$/.exec(raw) : null;
  if (!m) return DEFAULT_SORT;
  return { totsu: Number(m[1]) as Totsu, desc: m[2] === "d" };
}

function parseOverrides(params: URLSearchParams, adjustable: ReadonlySet<string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, raw] of params) {
    const n = Number(raw);
    if (OVERRIDE_KEY.test(name) && adjustable.has(name) && raw !== "" && Number.isInteger(n) && n >= 0) out[name] = n;
  }
  return out;
}

/** Tolerant: an unknown or malformed value falls back to its default rather than failing. */
export function parseViewState(params: URLSearchParams, scenarios: readonly Scenario[], adjustable: AdjustableKeys): ViewState {
  const base = defaultViewState(scenarios);
  const partial: ViewState = { ...base, scenarioId: params.get("s") ?? base.scenarioId, profileId: params.get("p") ?? base.profileId };
  const { scenario, profile } = resolveSelection(partial, scenarios);
  const ls = params.get("ls");
  const splitIndex = ls === null ? NaN : Number(ls);
  const split = Number.isInteger(splitIndex) && splitIndex >= 0 && splitIndex < profile.lessonSplits.length ? splitIndex : null;
  return {
    scenarioId: scenario.id,
    profileId: profile.id,
    split,
    types: parseList(params.get("type"), CARD_TYPES),
    plans: parseList(params.get("plan"), PLANS),
    rarities: parseList(params.get("rarity"), RARITIES),
    sort: parseSort(params.get("sort")),
    overrides: parseOverrides(params, adjustable(profile)),
  };
}

/** Only values that differ from `defaultViewState` are written, so the default view has an empty query string. */
export function serializeViewState(state: ViewState, scenarios: readonly Scenario[]): URLSearchParams {
  const base = defaultViewState(scenarios);
  const out = new URLSearchParams();
  if (state.scenarioId !== base.scenarioId) out.set("s", state.scenarioId);
  if (state.profileId !== base.profileId || state.scenarioId !== base.scenarioId) out.set("p", state.profileId);
  if (state.split !== null) out.set("ls", String(state.split));
  if (state.types.length > 0) out.set("type", state.types.join(","));
  if (state.plans.length > 0) out.set("plan", state.plans.join(","));
  if (state.rarities.length > 0) out.set("rarity", state.rarities.join(","));
  if (state.sort.totsu !== DEFAULT_SORT.totsu || state.sort.desc !== DEFAULT_SORT.desc) out.set("sort", `${state.sort.totsu}${state.sort.desc ? "d" : "a"}`);
  for (const [key, n] of Object.entries(state.overrides)) out.set(key, String(n));
  return out;
}
