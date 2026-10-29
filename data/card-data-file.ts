/**
 * The card data this site publishes for other projects to read at runtime, served at
 * https://gakumas-supportcards.tia.run/data/cards.v1.json (docs/adr/0010). `bun run build` writes
 * it into dist/ from the generated modules (vite.config.ts), so every deploy publishes the data it
 * deploys. The file is a contract with tia-tools/gmks-hif-final-stats, which copies `Card`,
 * `ClassifiedEffect`, `ParsedTrigger`, `ItemGrant`, `LevelLimits` and `HeldCard` from
 * src/engine/types.ts: a change to the shape of the file or of any type it carries bumps
 * `CARD_DATA_FORMAT_VERSION`, and with it the file name, so a new format can be published beside
 * the old one.
 */

import type { Card, HeldCard, LevelLimits } from "../src/engine/types.ts";

export const CARD_DATA_FORMAT_VERSION = 1;

/** Where the file sits under dist/, hence its path on the site. */
export const CARD_DATA_PATH = `data/cards.v${CARD_DATA_FORMAT_VERSION}.json`;

export interface CardDataFile {
  formatVersion: typeof CARD_DATA_FORMAT_VERSION;
  levelLimits: LevelLimits;
  /** Every card as generated, held cards included. */
  cards: readonly Card[];
  /**
   * The cards the score table hides (docs/adr/0005), each with the reasons one of its effects
   * cannot be counted. An unreadable effect is left out of the card; one that is readable but
   * lacks a number in some route profile stays in it.
   */
  held: readonly HeldCard[];
}

/** The file's text: deterministic, since it depends only on the generated data (no timestamps). */
export function cardDataJson(cards: readonly Card[], held: readonly HeldCard[], levelLimits: LevelLimits): string {
  const file: CardDataFile = { formatVersion: CARD_DATA_FORMAT_VERSION, levelLimits, cards, held };
  return JSON.stringify(file);
}
