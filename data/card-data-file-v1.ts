/**
 * The card data in format 1, still published at /data/cards.v1.json beside the current format
 * (data/card-data-file.ts) while tia-tools/gkms-hif-final-stats reads it (docs/adr/0010, addendum
 * 2026-11-08; the user's answer to job #78). That project checks every filter family against the
 * six format 1 knew and rejects the whole file on any other, so an effect or a P-drink grant whose
 * trigger uses a newer family (`plan`, issue #77) is left out of its card here, and the card is
 * listed as held with the reason — exactly how format 1 already carried an effect it could not
 * count. Delete this module, its test and its line in vite.config.ts once that project reads the
 * current format.
 */

import type { Card, ClassifiedEffect, FilterRef, HeldCard, ItemGrant, LevelLimits, ParsedTrigger } from "../src/engine/types.ts";

export const CARD_DATA_V1_PATH = "data/cards.v1.json";

/** The filter families format 1 knew, frozen: `FILTER_FAMILIES` in src/engine/types.ts moves on. */
export const FORMAT_1_FILTER_FAMILIES: readonly string[] = ["lessonStat", "lessonKind", "cardType", "rarity", "cardName", "effectGroup"];

/** The filters along a trigger that format 1 cannot carry, as `family.member`. */
function newerFilters(t: ParsedTrigger | undefined): string[] {
  if (!t) return [];
  const all: FilterRef[] = [...(t.filters ?? []), ...(t.conditions ?? []).flatMap((c) => c.subject ?? [])];
  return all.filter((f) => !FORMAT_1_FILTER_FAMILIES.includes(f.family)).map((f) => `${f.family}.${f.member}`);
}

function reason(what: string, filters: readonly string[]): string {
  return `${what}: filter ${filters.join(", ")} is not in format 1 of this file; cards.v2.json carries it`;
}

function effectLabel(e: ClassifiedEffect): string {
  return e.itemId === undefined ? `skill on ${e.trigger?.occasion ?? "no trigger"}` : `item ${e.itemId} ${e.itemName ?? ""}`.trimEnd();
}

/** The card in format 1, with the reasons for whatever had to be left out of it. */
function downgradeCard(card: Card): { card: Card; reasons: string[] } {
  const reasons = new Set<string>();
  const breakpoints = card.breakpoints.map((bp) => ({
    ...bp,
    effects: bp.effects.filter((e) => {
      const newer = newerFilters(e.trigger);
      if (newer.length > 0) reasons.add(reason(effectLabel(e), newer));
      return newer.length === 0;
    }),
  }));
  const counted = new Set(breakpoints.flatMap((bp) => bp.effects.flatMap((e) => (e.itemId === undefined ? [] : [e.itemId]))));
  const items = (card.items ?? []).flatMap((grant): ItemGrant[] => {
    const newer = newerFilters(grant.drinks?.trigger);
    if (newer.length === 0) return [grant];
    reasons.add(reason(`item ${grant.itemId} ${grant.itemName} P-drinks`, newer));
    const { drinks: _dropped, ...rest } = grant;
    return counted.has(grant.itemId) ? [rest] : [];
  });
  if (reasons.size === 0) return { card, reasons: [] };
  const out: Card = { ...card, breakpoints };
  if (items.length > 0) out.items = items;
  else delete out.items;
  return { card: out, reasons: [...reasons] };
}

/** The cards and held list as format 1 can carry them: held entries keep their order, newly held cards follow in card order. */
export function format1(cards: readonly Card[], held: readonly HeldCard[]): { cards: Card[]; held: HeldCard[] } {
  const heldOut = held.map((h) => ({ ...h, reasons: [...h.reasons] }));
  const cardsOut = cards.map((c) => {
    const { card, reasons } = downgradeCard(c);
    if (reasons.length === 0) return card;
    const entry = heldOut.find((h) => h.id === c.id);
    if (entry) entry.reasons.push(...reasons);
    else heldOut.push({ id: c.id, name: c.name, reasons });
    return card;
  });
  return { cards: cardsOut, held: heldOut };
}

/** The format 1 file's text: deterministic, like the current format's. */
export function cardDataV1Json(cards: readonly Card[], held: readonly HeldCard[], levelLimits: LevelLimits): string {
  const downgraded = format1(cards, held);
  return JSON.stringify({ formatVersion: 1, levelLimits, cards: downgraded.cards, held: downgraded.held });
}
