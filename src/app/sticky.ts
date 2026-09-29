/**
 * The controls section sticks to the top of the window while the page scrolls, so the
 * filters, route and splits stay in reach on a long table. Its height changes as it wraps,
 * so it is measured and published as `--controls-h` on the document root (0px until then,
 * src/index.css): the table header sticks below it, and a scroll target clears it.
 */

import { useLayoutEffect, useRef } from "preact/hooks";

/** Keeps a scrolled-to element (a folded panel's summary, the feedback form) out from under the sticky controls. */
export const CLEAR_CONTROLS = "scroll-mt-[calc(var(--controls-h)+0.5rem)]";

/** A ref for the sticky controls; its height is kept in `--controls-h` while mounted. */
export function useControlsHeight() {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    const publish = (): void => root.setProperty("--controls-h", `${el.getBoundingClientRect().height}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.removeProperty("--controls-h");
    };
  }, []);
  return ref;
}
