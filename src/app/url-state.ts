/**
 * The view state of the table and its encoding in the URL query string (plan
 * decision D9: a filtered, sorted view is shareable). Pure: parsing and
 * serialising take the scenarios and the adjustable count keys as arguments, and
 * only values that differ from the defaults are written.
 *
 * Query parameters:
 *   s=<scenario id>  p=<profile id>  ls=<lesson-split preset index; absent = best preset (D26)>
 *   a=<main>.<sub>.<other>  tenths of the 選抜試験's distributed reward for the main, sub and
 *                     other stat of the split (docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md A4, A5) under
 *                     the selected profile; absent = the profile's default (2.7.1 unless it states one)
 *   a.<profile id>=<main>.<sub>.<other>  the same for another profile of the scenario: a share
 *                     is the player's per profile, kept when they switch away and back
 *   type=vocal,dance  plan=sense,logic  rarity=ssr   (comma-separated; absent = all)
 *   sp=1              (only cards with an SP発生率+ skill; absent = all)
 *   sort=4d           (凸 column 0–4 followed by d or a; default 4d)
 *   o.<Occasion>=<n>  f.<Occasion>.<family>.<member>=<n>  w.<condition key>=<n>
 *                     count overrides (D2), keyed as in src/app/panel.ts. The `c.<category>`
 *                     keys of the former counting model are ignored.
 *   i.<item id>=<n>   a P-item's cap on its fires;  d.<item id>=1  the item is in the deck
 *                     (src/app/item-panel.ts; docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md A9, A11)
 */

import { defaultShareOf, isAuditionShare } from "../engine/share.ts";
import { type AuditionShare, type CardType, type Plan, type Rarity, type RouteProfile, type Scenario, type Totsu } from "../engine/types.ts";

export interface SortSpec {
  totsu: Totsu;
  desc: boolean;
}

export interface ViewState {
  scenarioId: string;
  profileId: string;
  /** Index into the profile's `lessonSplits`; null scores each card under its best preset. */
  split: number | null;
  /** Profile id → the player's audition share in tenths (main, sub, other) under it; a profile not listed uses its default (`shareFor`). */
  shares: Readonly<Record<string, AuditionShare>>;
  types: readonly CardType[];
  plans: readonly Plan[];
  rarities: readonly Rarity[];
  /** Only cards flagged `spRate` (an SP発生率+ skill). */
  sp: boolean;
  sort: SortSpec;
  /** Count key (`o.…`, `f.…`, `w.…`, and the P-item keys `i.…`, `d.…`; see src/app/panel.ts) → the player's number in place of the profile's. */
  overrides: Readonly<Record<string, number>>;
}

export const CARD_TYPES: readonly CardType[] = ["vocal", "dance", "visual", "assist"];
export const PLANS: readonly Plan[] = ["common", "sense", "logic", "anomaly"];
export const RARITIES: readonly Rarity[] = ["r", "sr", "ssr"];
export const TOTSUS: readonly Totsu[] = [0, 1, 2, 3, 4];
export const DEFAULT_SORT: SortSpec = { totsu: 4, desc: true };

/** The count keys a player may override under a profile (`adjustableKeys` of src/app/panel.ts, with the shipped cards bound). */
export type AdjustableKeys = (profile: RouteProfile) => ReadonlySet<string>;

const OVERRIDE_KEY = /^[ofwid]\./;

export function defaultViewState(scenarios: readonly Scenario[]): ViewState {
  const scenario = scenarios[0];
  const profile = scenario?.profiles[0];
  if (!scenario || !profile) throw new Error("no scenario shipped");
  return { scenarioId: scenario.id, profileId: profile.id, split: null, shares: {}, types: [], plans: [], rarities: [], sp: false, sort: DEFAULT_SORT, overrides: {} };
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
  const totsu = TOTSUS.find((t) => t === Number(m[1]));
  return totsu === undefined ? DEFAULT_SORT : { totsu, desc: m[2] === "d" };
}

const sameShare = (a: AuditionShare, b: AuditionShare): boolean => a.every((n, i) => n === b[i]);

/** The audition share in force under `profile`: the player's, else the profile's default. */
export function shareFor(state: Pick<ViewState, "shares">, profile: RouteProfile): AuditionShare {
  return state.shares[profile.id] ?? defaultShareOf(profile);
}

/** `shares` with the player's share under `profile` set to `share`, or dropped when `share` is null or the profile's default. */
export function withShare(shares: ViewState["shares"], profile: RouteProfile, share: AuditionShare | null): Record<string, AuditionShare> {
  const out = Object.fromEntries(Object.entries(shares).filter(([id]) => id !== profile.id));
  return share === null || sameShare(share, defaultShareOf(profile)) ? out : { ...out, [profile.id]: share };
}

/** Exactly three plain integers 0–10 joined by dots: no sign, exponent, whitespace or empty part (`Number("")` is 0). */
const SHARE_TEXT = /^(?:10|\d)\.(?:10|\d)\.(?:10|\d)$/;

/** `3.6.1` → [3, 6, 1]; anything that is not three tenths summing to 10 → null. */
function parseShare(raw: string | null): AuditionShare | null {
  if (raw === null || !SHARE_TEXT.test(raw)) return null;
  const parts = raw.split(".").map(Number);
  return isAuditionShare(parts) ? parts : null;
}

/** `a=` for the selected profile, `a.<id>=` for the scenario's others; a profile's default and anything malformed are left out. */
function parseShares(params: URLSearchParams, scenario: Scenario, selected: RouteProfile): Record<string, AuditionShare> {
  let out: Record<string, AuditionShare> = {};
  for (const p of scenario.profiles) out = withShare(out, p, parseShare(params.get(p.id === selected.id ? "a" : `a.${p.id}`)));
  return out;
}

function parseOverrides(params: URLSearchParams, adjustable: ReadonlySet<string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, raw] of params) {
    const n = Number(raw);
    if (!OVERRIDE_KEY.test(name) || !adjustable.has(name) || raw === "" || !Number.isInteger(n) || n < 0) continue;
    if (name.startsWith("d.") && n !== 1) continue; // a deck tick is 1 or absent
    out[name] = n;
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
    shares: parseShares(params, scenario, profile),
    types: parseList(params.get("type"), CARD_TYPES),
    plans: parseList(params.get("plan"), PLANS),
    rarities: parseList(params.get("rarity"), RARITIES),
    sp: params.get("sp") === "1",
    sort: parseSort(params.get("sort")),
    overrides: parseOverrides(params, adjustable(profile)),
  };
}

/** Each of the scenario's profiles whose share is the player's: the selected one as `a=`, the others as `a.<id>=`. */
function writeShares(out: URLSearchParams, state: ViewState, scenarios: readonly Scenario[]): void {
  const scenario = scenarios.find((s) => s.id === state.scenarioId);
  for (const p of scenario?.profiles ?? []) {
    const share = state.shares[p.id];
    if (share !== undefined && !sameShare(share, defaultShareOf(p))) out.set(p.id === state.profileId ? "a" : `a.${p.id}`, share.join("."));
  }
}

/** Only values that differ from `defaultViewState` are written, so the default view has an empty query string. */
export function serializeViewState(state: ViewState, scenarios: readonly Scenario[]): URLSearchParams {
  const base = defaultViewState(scenarios);
  const out = new URLSearchParams();
  if (state.scenarioId !== base.scenarioId) out.set("s", state.scenarioId);
  if (state.profileId !== base.profileId || state.scenarioId !== base.scenarioId) out.set("p", state.profileId);
  if (state.split !== null) out.set("ls", String(state.split));
  writeShares(out, state, scenarios);
  if (state.types.length > 0) out.set("type", state.types.join(","));
  if (state.plans.length > 0) out.set("plan", state.plans.join(","));
  if (state.rarities.length > 0) out.set("rarity", state.rarities.join(","));
  if (state.sp) out.set("sp", "1");
  if (state.sort.totsu !== DEFAULT_SORT.totsu || state.sort.desc !== DEFAULT_SORT.desc) out.set("sort", `${state.sort.totsu}${state.sort.desc ? "d" : "a"}`);
  for (const [key, n] of Object.entries(state.overrides)) out.set(key, String(n));
  return out;
}
