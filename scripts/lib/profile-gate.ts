/**
 * The second reason a card is held (docs/adr/0005): every piece of its triggers
 * parsed, but a shipped route profile has no number for an occasion or filter
 * one of them needs — a phase type no profile counts yet, or a never-seen member
 * of a family without a default (decisions C4 and C17 of
 * docs/plans/EXECPLAN_COUNTING_MODEL.md). Scored anyway, that effect would
 * silently count 0. Pure: no I/O.
 */

import { missingNumbers } from "../../src/engine/count.ts";
import type { Card, HeldCard, Scenario } from "../../src/engine/types.ts";
import { byCodeUnit } from "./build-cards.ts";

/** Cards with a trigger some shipped profile cannot count, each with one reason per missing number naming the profiles that lack it. */
export function heldForMissingNumbers(cards: readonly Card[], scenarios: readonly Scenario[]): HeldCard[] {
  const out: HeldCard[] = [];
  for (const card of cards) {
    /** missing path → profiles lacking it */
    const lacking = new Map<string, Set<string>>();
    for (const bp of card.breakpoints) {
      for (const e of bp.effects) {
        if (!e.trigger) continue;
        for (const s of scenarios) {
          for (const p of s.profiles) {
            for (const path of missingNumbers(e.trigger, p)) (lacking.get(path) ?? lacking.set(path, new Set()).get(path))?.add(`${s.id}/${p.id}`);
          }
        }
      }
    }
    if (lacking.size === 0) continue;
    const reasons = [...lacking].map(([path, profiles]) => `${card.id}: no route profile number for ${path} (${[...profiles].sort(byCodeUnit).join(", ")})`).sort(byCodeUnit);
    out.push({ id: card.id, name: card.name, reasons });
  }
  return out;
}

/** One entry per card with the reasons of both lists, sorted by card id. */
export function mergeHeld(a: readonly HeldCard[], b: readonly HeldCard[]): HeldCard[] {
  const byId = new Map<string, HeldCard>();
  for (const h of [...a, ...b]) {
    const cur = byId.get(h.id);
    byId.set(h.id, cur ? { ...cur, reasons: [...new Set([...cur.reasons, ...h.reasons])].sort(byCodeUnit) } : { ...h, reasons: [...h.reasons] });
  }
  return [...byId.values()].sort((x, y) => byCodeUnit(x.id, y.id));
}
