/**
 * Which 点数 cell's breakdown is open. Three ways open one — a mouse over the
 * cell, a tap or click on it (pinned), keyboard focus — and at most one
 * breakdown shows, in that order of preference: a focused cell's used to stay
 * up while another was hovered, and the later row's covered the one asked for.
 * Hover counts for a mouse only; a touch screen opens by tap and closes by a
 * second tap, a tap outside every score, or Escape, since it sends no leave
 * event when the finger lifts elsewhere. Pure; ScoreTable.tsx wires the events.
 */

export interface OpenCells {
  hovered: string | null;
  pinned: string | null;
  focused: string | null;
}

export type CellEvent = { type: "hover" | "focus"; key: string; on: boolean } | { type: "tap"; key: string } | { type: "outside" } | { type: "escape" };

export const NONE_OPEN: OpenCells = { hovered: null, pinned: null, focused: null };

/** An "off" only clears the cell it comes from: a leave or blur can arrive after the next cell's enter or focus. */
const release = (current: string | null, key: string, on: boolean): string | null => (on ? key : current === key ? null : current);

const forget = (current: string | null, key: string): string | null => (current === key ? null : current);

export function nextOpen(state: OpenCells, event: CellEvent): OpenCells {
  switch (event.type) {
    case "hover":
      return { ...state, hovered: release(state.hovered, event.key, event.on) };
    case "focus":
      return { ...state, focused: release(state.focused, event.key, event.on) };
    case "tap":
      // A second tap or click closes it even though the cell keeps focus and the mouse may still be over it (until it leaves).
      return state.pinned === event.key ? { hovered: forget(state.hovered, event.key), pinned: null, focused: forget(state.focused, event.key) } : { ...state, pinned: event.key };
    case "outside":
      return { ...state, pinned: null, focused: null };
    case "escape":
      return NONE_OPEN;
  }
}

/** The cell to show: hovered, else pinned, else focused — skipping a key whose cell is no longer in the table (filtered away while open). */
export function shownCell(state: OpenCells, live: (key: string) => boolean): string | null {
  for (const key of [state.hovered, state.pinned, state.focused]) if (key !== null && live(key)) return key;
  return null;
}
