/**
 * The メイン / サブ badges beside レッスン配分, rendered in a simulated DOM (happy-dom) with
 * the shipped H.I.F. profiles: shown for a fixed preset, named by the preset's `sub` when
 * the untrained stats tie, and absent under 「カードごとに最適」. Colours are checked in a browser.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { render } from "preact";
import { act } from "preact/test-utils";
import { HIF } from "../../data/scenarios/hif.ts";
import type { RouteProfile } from "../engine/types.ts";
import { Controls } from "./Controls.tsx";
import { DEFAULT_SORT, type ViewState } from "./url-state.ts";

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`${what} is missing`);
  return value;
}

let root: HTMLElement;

beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());

beforeEach(() => {
  root = document.body.appendChild(document.createElement("div"));
});
afterEach(() => act(() => render(null, root)));

const profileOf = (id: string): RouteProfile => must(HIF.profiles.find((p) => p.id === id), `profile ${id}`);

async function badgesUnder(profile: RouteProfile, split: number | null): Promise<string[]> {
  const state: ViewState = { scenarioId: HIF.id, profileId: profile.id, split, shares: {}, types: [], plans: [], rarities: [], sp: false, sort: DEFAULT_SORT, overrides: {} };
  await act(() => render(<Controls scenarios={[HIF]} scenario={HIF} profile={profile} state={state} update={() => undefined} />, root));
  return [...root.querySelectorAll("span")].map((s) => s.textContent ?? "").filter((t) => /^(メイン|サブ) (Vo|Da|Vi)$/.test(t));
}

test("a fixed preset shows its main and sub stat beside レッスン配分", async () => {
  expect(await badgesUnder(profileOf("sashiire"), 0)).toEqual(["メイン Vo", "サブ Da"]);
  expect(await badgesUnder(profileOf("sashiire"), 3)).toEqual(["メイン Da", "サブ Vi"]);
});

test("a 極振り preset shows the sub it names, though the untrained stats tie", async () => {
  expect(await badgesUnder(profileOf("extreme-contest"), 0)).toEqual(["メイン Vo", "サブ Da"]);
  expect(await badgesUnder(profileOf("extreme-contest"), 1)).toEqual(["メイン Vo", "サブ Vi"]);
});

test("「カードごとに最適」 shows no badges: each card has its own main and sub", async () => {
  expect(await badgesUnder(profileOf("sashiire"), null)).toEqual([]);
});
