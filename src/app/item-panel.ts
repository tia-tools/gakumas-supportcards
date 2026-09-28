/**
 * The 「Pアイテム」 section of the 「カウントを調整」 panel (decisions A8–A11 of
 * docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md): one row per P-item of a card in view,
 * with a cap on its fires (URL `i.<itemId>=<n>`, an extra minimum the engine
 * applies to that item's effects), and for a drink-granting item a tick
 * (`d.<itemId>=1`) that adds fires × drinks per fire to the run's Pドリンク獲得
 * count for every card. A row's ceiling is the item's fires under the lesson
 * split in force — the selected 「レッスン配分」, or under 「カードごとに最適」 the
 * preset that favours the item (maximum performance) — capped by the item's own
 * `fireLimit` (decisions A9, A25). Pure; ItemPanel.tsx (its own panel
 * below 「カウントを調整」, A24) renders the rows, App.tsx feeds `deckDrinks` into
 * `applyOverrides` and `itemCapsOf` into the scoring context.
 */

import { occurrences } from "../engine/count.ts";
import type { Card, CardType, ClassifiedEffect, ItemGrant, LessonSplit, ParsedTrigger, RouteProfile } from "../engine/types.ts";
import type { Overrides } from "./panel.ts";

export const itemCapKey = (itemId: string): string => `i.${itemId}`;
export const deckKey = (itemId: string): string => `d.${itemId}`;
/** The keys this panel owns among the overrides; the counts panel owns the rest, and each panel's 既定に戻す clears only its own (A24). */
export const isItemKey = (key: string): boolean => key.startsWith("i.") || key.startsWith("d.");

/** The scenario, the profile as the player overrode it (without the deck's drinks, which these rows produce), and the lesson split in force: the selected preset, or null under 「カードごとに最適」. */
export interface ItemContext {
  scenarioId: string;
  profile: RouteProfile;
  lessons: LessonSplit | null;
}

export interface ItemRow {
  itemId: string;
  itemName: string;
  assetId: string;
  cardName: string;
  /** The granting card's art and type, for the popover that names the card (A26). */
  cardAssetId: string;
  cardType: CardType;
  /** The trigger the fires are counted on, for wording the row: the drink trigger, else the first stat effect's. */
  trigger: ParsedTrigger | undefined;
  /** `fireLimit`, when the item has one. */
  cap: number | undefined;
  /** Fires under maximum performance, the most frequent of the item's triggers: the input's ceiling. */
  computed: number;
  /** min(the player's cap, computed). */
  value: number;
  /** The cap is below the computed count, so it changes something; a cap at or above it stays in the URL (it bites again when counts rise) but is not flagged. */
  overridden: boolean;
  /** `fires`: the drink trigger's own fires under the cap — an item whose stat effect fires more often does not pour more drinks (Codex finding, 2026-09-28). */
  drinks?: { perFire: number; inDeck: boolean; fires: number; added: number };
}

/** Fires of `trigger` under the split in force — the selected one, else the preset that favours it — capped by `cap` (A25). */
function maxFires(trigger: ParsedTrigger, cap: number | undefined, ctx: ItemContext): number {
  const effect: ClassifiedEffect = { stat: "vocal", value: 0, kind: "item", trigger };
  if (cap !== undefined) effect.cap = cap;
  const splits = ctx.lessons === null ? ctx.profile.lessonSplits : [ctx.lessons];
  return splits.reduce((best, lessons) => Math.max(best, occurrences(effect, { scenarioId: ctx.scenarioId, profile: ctx.profile, lessons })), 0);
}

/** The distinct triggers the item fires on for this card: its drink trigger first, then its stat effects' at any level. */
function triggersOf(card: Card, grant: ItemGrant): ParsedTrigger[] {
  const seen = new Map<string, ParsedTrigger>();
  if (grant.drinks) seen.set(JSON.stringify(grant.drinks.trigger), grant.drinks.trigger);
  for (const bp of card.breakpoints) for (const e of bp.effects) if (e.itemId === grant.itemId && e.trigger) seen.set(JSON.stringify(e.trigger), e.trigger);
  return [...seen.values()];
}

/** The item's fires under the split in force (A9, A25): the most frequent of its triggers — a Da-SP-lesson item fires 0 times under a split with no Da lessons. */
export function itemFires(card: Card, grant: ItemGrant, ctx: ItemContext): number {
  return triggersOf(card, grant).reduce((best, t) => Math.max(best, maxFires(t, grant.cap, ctx)), 0);
}

function rowOf(card: Card, grant: ItemGrant, ctx: ItemContext, overrides: Overrides): ItemRow {
  const computed = itemFires(card, grant, ctx);
  const override = overrides[itemCapKey(grant.itemId)];
  const value = override === undefined ? computed : Math.min(override, computed);
  const row: ItemRow = { itemId: grant.itemId, itemName: grant.itemName, assetId: grant.assetId, cardName: card.name, cardAssetId: card.assetId, cardType: card.type, trigger: triggersOf(card, grant)[0], cap: grant.cap, computed, value, overridden: override !== undefined && override < computed };
  if (grant.drinks) {
    const inDeck = overrides[deckKey(grant.itemId)] === 1;
    const fires = Math.min(override ?? Number.POSITIVE_INFINITY, maxFires(grant.drinks.trigger, grant.cap, ctx));
    row.drinks = { perFire: grant.drinks.perFire, inDeck, fires, added: inDeck ? fires * grant.drinks.perFire : 0 };
  }
  return row;
}

/** One row per distinct item of the cards in view, in the cards' order; an item two cards grant is listed once, under the first. */
export function itemRows(cardsInView: readonly Card[], ctx: ItemContext, overrides: Overrides): ItemRow[] {
  const rows = new Map<string, ItemRow>();
  for (const card of cardsInView) for (const grant of card.items ?? []) if (!rows.has(grant.itemId)) rows.set(grant.itemId, rowOf(card, grant, ctx, overrides));
  return [...rows.values()];
}

/** Drinks the ticked items of all shipped cards add to Pドリンク獲得: Σ fires × drinks per fire (A8, A9). A ticked item stays in the deck when its card is out of view. */
export function deckDrinks(allCards: readonly Card[], ctx: ItemContext, overrides: Overrides): number {
  let total = 0;
  const counted = new Set<string>();
  for (const card of allCards) {
    for (const grant of card.items ?? []) {
      if (!grant.drinks || counted.has(grant.itemId) || overrides[deckKey(grant.itemId)] !== 1) continue;
      counted.add(grant.itemId);
      total += rowOf(card, grant, ctx, overrides).drinks?.added ?? 0;
    }
  }
  return total;
}

/** The `i.` overrides as the engine's item caps. */
export function itemCapsOf(overrides: Overrides): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, n] of Object.entries(overrides)) if (key.startsWith("i.")) out[key.slice(2)] = n;
  return out;
}

/** Every key the item section can write for the shipped cards: a cap per item, a tick per drink item. */
export function itemKeys(allCards: readonly Card[]): Set<string> {
  const out = new Set<string>();
  for (const card of allCards) {
    for (const grant of card.items ?? []) {
      out.add(itemCapKey(grant.itemId));
      if (grant.drinks) out.add(deckKey(grant.itemId));
    }
  }
  return out;
}
