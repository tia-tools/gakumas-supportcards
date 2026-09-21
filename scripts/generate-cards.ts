/**
 * Generates data/cards.generated.ts, data/held.generated.ts,
 * data/levelLimits.generated.ts and data/scores.generated.json from the
 * upstream tables and the shipped scenarios.
 *
 * Usage: bun scripts/generate-cards.ts [--allow-fewer]
 *
 * A card with an effect that cannot be counted (see scripts/lib/build-cards.ts),
 * or whose trigger needs a number some shipped route profile lacks (see
 * scripts/lib/profile-gate.ts), is listed in data/held.generated.ts with the
 * reason and the run still succeeds (docs/adr/0005). data/scores.generated.json
 * records what the page publishes for every other card; compare it with the
 * committed one through scripts/check-score-stability.ts. Exits 1 (writing nothing) when the upstream dump
 * itself looks broken: a schema error, an unknown enum value, a dangling id, or
 * a card count below the committed file's (pass --allow-fewer to accept a
 * genuine removal).
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { SCENARIOS } from "../data/scenarios/index.ts";
import { buildCards, buildLevelLimits } from "./lib/build-cards.ts";
import { emitCards, emitHeld, emitLevelLimits } from "./lib/emit.ts";
import { heldForMissingNumbers, mergeHeld } from "./lib/profile-gate.ts";
import { buildSnapshot, emitSnapshot } from "./lib/score-snapshot.ts";
import { loadTables } from "./lib/tables.ts";

const CARDS_PATH = "data/cards.generated.ts";
const HELD_PATH = "data/held.generated.ts";
const LIMITS_PATH = "data/levelLimits.generated.ts";
export const SCORES_PATH = "data/scores.generated.json";

export function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

async function committedCardCount(): Promise<number | null> {
  if (!existsSync(CARDS_PATH)) return null;
  const mod: unknown = await import(`../${CARDS_PATH}`);
  if (typeof mod === "object" && mod !== null && "CARDS" in mod && Array.isArray(mod.CARDS)) return mod.CARDS.length;
  throw new Error(`${CARDS_PATH} exists but exports no CARDS array`);
}

async function main(): Promise<void> {
  const allowFewer = process.argv.includes("--allow-fewer");
  const tables = await loadTables();

  const { cards, report } = buildCards(tables);
  const levelLimits = buildLevelLimits(tables);
  const held = mergeHeld(report.held, heldForMissingNumbers(cards, SCENARIOS));

  const before = await committedCardCount();
  if (before !== null && cards.length < before && !allowFewer) {
    console.error(`Card count would drop from ${before} to ${cards.length}; rerun with --allow-fewer if this is a real removal upstream.`);
    process.exit(1);
  }

  await Bun.write(CARDS_PATH, emitCards(cards));
  await Bun.write(HELD_PATH, emitHeld(held));
  await Bun.write(LIMITS_PATH, emitLevelLimits(levelLimits));
  await Bun.write(SCORES_PATH, emitSnapshot(buildSnapshot(cards, held, SCENARIOS, levelLimits, sha)));

  const withEffects = cards.filter((c) => c.breakpoints.some((b) => b.effects.length > 0)).length;
  console.log(`Wrote ${CARDS_PATH}: ${cards.length} cards (${withEffects} with parameter effects${before === null ? "" : `, previously ${before}`})`);
  console.log(`Wrote ${HELD_PATH}: ${held.length} held cards`);
  for (const h of held) for (const reason of h.reasons) console.log(`  HELD ${h.id} ${h.name} — ${reason}`);
  console.log(`Wrote ${LIMITS_PATH}: ${JSON.stringify(levelLimits)}`);
  console.log(`Wrote ${SCORES_PATH}: ${cards.length - held.length} cards × ${SCENARIOS.reduce((n, sc) => n + sc.profiles.length, 0)} route profiles`);
  console.log(`Occasions used: ${[...report.occasionsUsed].sort().join(", ")}`);
  const skipped = [...report.skippedByType].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t.replace("ProduceEffectType_", "")}×${n}`);
  console.log(`Skipped non-parameter effects: ${skipped.join(", ")}`);
}

if (import.meta.main) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
