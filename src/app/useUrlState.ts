/**
 * View state held in the URL query string: read once on load, re-read on
 * back/forward, and rewritten (replaceState) whenever it changes.
 */

import { useCallback, useEffect, useState } from "preact/hooks";
import { SCENARIOS } from "../../data/scenarios/index.ts";
import { TAXONOMY } from "../../data/taxonomy.generated.ts";
import { parseViewState, serializeViewState, type ViewState } from "./url-state.ts";

function readState(): ViewState {
  return parseViewState(new URLSearchParams(window.location.search), SCENARIOS, TAXONOMY);
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
