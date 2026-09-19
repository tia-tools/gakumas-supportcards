/**
 * Shipped scenarios (decision D5). Order = order in the scenario switcher; the
 * first entry is the default.
 */

import type { Scenario } from "../../src/engine/types.ts";
import { HAJIME_LEGEND } from "./hajime-legend.ts";
import { HIF } from "./hif.ts";

export const SCENARIOS: readonly Scenario[] = [HIF, HAJIME_LEGEND];
