/**
 * A hint that opens on hover or keyboard focus, and on a touch screen by a tap
 * (a second tap, a tap outside, or Escape closes it) — decision A26 of
 * docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md. Two shapes: `trigger="button"` wraps
 * the children in a button that only opens the hint (the `i` mark, an item's
 * name); `trigger="wrap"` leaves the children as they are — for an element that
 * is already a control, such as the deck toggle — and shows the hint on hover
 * and focus only, since a tap there does the control's own work; the children
 * are then a function receiving the tooltip's id for their `aria-describedby`.
 * The tooltip is always in the document, visually hidden when closed, so the
 * description is announced whenever the trigger is focused.
 */

import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";

interface ButtonProps {
  hint: ComponentChildren;
  /** What the trigger is, for assistive technology. */
  label: string;
  trigger?: "button";
  class?: string;
  children: ComponentChildren;
}
interface WrapProps {
  hint: ComponentChildren;
  trigger: "wrap";
  class?: string;
  children: (describedBy: string) => ComponentChildren;
}
type Props = ButtonProps | WrapProps;

const OPEN = "absolute left-0 top-full z-20 mt-1 w-max max-w-72 rounded border border-slate-200 bg-white p-2 text-left text-xs font-normal leading-snug text-slate-700 shadow-lg";
const CLOSED = "sr-only";

export function Hint(props: Props) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const open = pinned || hovered;
  // While open, Escape anywhere on the page closes it (focus may be elsewhere: a hover-open hint, or a pinned one left by Tab); while pinned, a tap outside closes it too.
  useEffect(() => {
    if (!open) return undefined;
    const escape = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setPinned(false);
        setHovered(false);
      }
    };
    const outside = (e: Event): void => {
      if (pinned && ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setPinned(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, pinned]);
  const close = (): void => {
    setPinned(false);
    setHovered(false);
  };
  const tooltip = (
    <span role="tooltip" id={id} class={open ? OPEN : CLOSED}>
      {props.hint}
    </span>
  );
  const wrapper = {
    ref,
    class: `relative inline-flex ${props.class ?? ""}`,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onFocusIn: () => setHovered(true),
    onFocusOut: () => setHovered(false),
  };
  if (props.trigger === "wrap") {
    return (
      <span {...wrapper}>
        {props.children(id)}
        {tooltip}
      </span>
    );
  }
  return (
    <span {...wrapper}>
      {/* A tap focuses before it clicks, so `hovered` is already true here: the pin alone decides, and unpinning clears both so the hint closes while still focused (Codex finding, 2026-09-29). */}
      <button type="button" aria-label={props.label} aria-expanded={open} aria-describedby={id} onClick={() => (pinned ? close() : setPinned(true))} class="inline-flex min-w-0 items-center gap-1 text-left">
        {props.children}
      </button>
      {tooltip}
    </span>
  );
}
