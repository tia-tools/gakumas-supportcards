/**
 * A hint that opens on hover or keyboard focus, and on a touch screen by a tap
 * (a second tap, a tap outside, or Escape closes it) — decision A26 of
 * docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md. Two shapes: `trigger="button"` wraps
 * the children in a button that only opens the hint (the `i` mark, an item's
 * name); `trigger="wrap"` leaves the children as they are — for an element that
 * is already a control, such as the deck toggle — and shows the hint on hover
 * and focus only, since a tap there does the control's own work.
 */

import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";

interface Props {
  hint: ComponentChildren;
  /** What the trigger is, for assistive technology. */
  label: string;
  trigger?: "button" | "wrap";
  class?: string;
  children: ComponentChildren;
}

const POPOVER = "absolute left-0 top-full z-20 mt-1 w-max max-w-72 rounded border border-slate-200 bg-white p-2 text-left text-xs font-normal leading-snug text-slate-700 shadow-lg";

export function Hint({ hint, label, trigger = "button", class: cls, children }: Props) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!pinned) return undefined;
    const outside = (e: Event): void => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setPinned(false);
    };
    const escape = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setPinned(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [pinned]);
  const open = pinned || hovered;
  const popover = open ? (
    <span role="tooltip" id={id} class={POPOVER}>
      {hint}
    </span>
  ) : null;
  const wrapperClass = `relative inline-flex ${cls ?? ""}`;
  if (trigger === "wrap") {
    return (
      <span ref={ref} class={wrapperClass} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusIn={() => setHovered(true)} onFocusOut={() => setHovered(false)}>
        {children}
        {popover}
      </span>
    );
  }
  return (
    <span ref={ref} class={wrapperClass} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button type="button" aria-label={label} aria-expanded={open} aria-describedby={open ? id : undefined} onClick={() => setPinned((p) => !p)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} class="inline-flex min-w-0 items-center gap-1 text-left">
        {children}
      </button>
      {popover}
    </span>
  );
}
