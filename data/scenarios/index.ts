/**
 * Scenarios. `ALL_SCENARIOS` is everything the engine can score and everything the real-data
 * tests cover; `SCENARIOS` is what the page offers, in switcher order, the first being the
 * default (decision D5).
 *
 * 初LEGEND is in the code but not published: its route counts and lesson-split presets are still
 * the agent's guesses (see hajime-legend.ts), and the site never shows a number it cannot stand
 * behind (docs/adr/0005). H.I.F. is taken end to end first (plan decision D38); publish 初LEGEND
 * by adding it to `SCENARIOS` once the user has answered its route sheet (D39).
 */

import type { Scenario } from "../../src/engine/types.ts";
import { HAJIME_LEGEND } from "./hajime-legend.ts";
import { HIF } from "./hif.ts";

export const ALL_SCENARIOS: readonly Scenario[] = [HIF, HAJIME_LEGEND];

export const SCENARIOS: readonly Scenario[] = [HIF];
