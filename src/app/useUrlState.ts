/**
 * View state held in the URL query string: read once on load, re-read on
 * back/forward, and rewritten (replaceState) whenever it changes.
 */

import { useCallback, useEffect, useState } from "preact/hooks";
import { SCENARIOS } from "../../data/scenarios/index.ts";
import { CARDS } from "../../data/cards.generated.ts";
import { adjustableKeys, triggersOf } from "./panel.ts";
import { parseViewState, serializeViewState, type ViewState } from "./url-state.ts";

/** Every distinct trigger on the shipped cards: decides which count inputs exist. */
export const ALL_TRIGGERS = triggersOf(CARDS);

function readState(): ViewState {
  return parseViewState(new URLSearchParams(window.location.search), SCENARIOS, (profile) => adjustableKeys(profile, ALL_TRIGGERS));
}

export type UpdateViewState = (patch: Partial<ViewState>) => void;

export function useUrlState(): [ViewState, UpdateViewState] {
  const [state, setState] = useState<ViewState>(readState);

  useEffect(() => {
    const onPop = (): void => setState(readState());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const query = serializeViewState(state, SCENARIOS).toString();
    const search = query ? `?${query}` : "";
    if (window.location.search !== search) window.history.replaceState(null, "", `${window.location.pathname}${search}`);
  }, [state]);

  const update = useCallback<UpdateViewState>((patch) => setState((prev) => ({ ...prev, ...patch })), []);
  return [state, update];
}
