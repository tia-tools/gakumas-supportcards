/**
 * Generates data/cards.generated.ts and data/levelLimits.generated.ts from
 * the upstream tables.
 *
 * Usage: bun scripts/generate-cards.ts [--allow-fewer]
 *
 * Exits 1 (writing nothing) when any (effect type, trigger) pair is
 * unclassified, when an extension row has become redundant, when an enum value
 * is unknown, or when the card count would drop below the committed file's
 * (pass --allow-fewer to accept a genuine removal).
 */

import { existsSync } from "node:fs";
import { TAXONOMY_EXTENSIONS } from "../data/taxonomy.extensions.ts";
import { Classifier, mergeTaxonomy, redundantExtensions } from "./lib/classify.ts";
import { buildCards, buildLevelLimits } from "./lib/build-cards.ts";
import { emitCards, emitLevelLimits } from "./lib/emit.ts";
import { loadTables } from "./lib/tables.ts";

const CARDS_PATH = "data/cards.generated.ts";
const LIMITS_PATH = "data/levelLimits.generated.ts";

async function committedCardCount(): Promise<number | null> {
  if (!existsSync(CARDS_PATH)) return null;
  const mod: unknown = await import(`../${CARDS_PATH}`);
  if (typeof mod === "object" && mod !== null && "CARDS" in mod && Array.isArray(mod.CARDS)) return mod.CARDS.length;
  throw new Error(`${CARDS_PATH} exists but exports no CARDS array`);
}

async function main(): Promise<void> {
  const allowFewer = process.argv.includes("--allow-fewer");
  const tables = await loadTables();

  const redundant = redundantExtensions(tables.filterRows, TAXONOMY_EXTENSIONS);
  if (redundant.length > 0) {
    console.error("Extension rows now covered by the game's filter table — delete them from data/taxonomy.extensions.ts:");
    for (const r of redundant) console.error(`  ${r.extensionId} (${r.triggerId}) is covered by ${r.gameRowId} (${r.gameTriggerId})`);
    process.exit(1);
  }

  const classifier = new Classifier(mergeTaxonomy(tables.filterRows, TAXONOMY_EXTENSIONS));
  const { cards, report } = buildCards(tables, classifier);
  const levelLimits = buildLevelLimits(tables);

  if (report.unclassified.length > 0) {
    console.error(`Unclassified (effect type, trigger) pairs: ${report.unclassified.length}`);
    for (const u of report.unclassified) {
      console.error(`  ${u.effectType} @ ${u.triggerId}: ${u.reason}${u.candidateRowIds.length ? ` between ${u.candidateRowIds.join(", ")}` : ""} (e.g. ${u.example})`);
    }
    console.error("Add a row to data/taxonomy.extensions.ts, or the type to NON_PARAMETER_EFFECT_TYPES if it carries no parameter.");
    process.exit(1);
  }

  const before = await committedCardCount();
  if (before !== null && cards.length < before && !allowFewer) {
    console.error(`Card count would drop from ${before} to ${cards.length}; rerun with --allow-fewer if this is a real removal upstream.`);
    process.exit(1);
  }

  await Bun.write(CARDS_PATH, emitCards(cards));
  await Bun.write(LIMITS_PATH, emitLevelLimits(levelLimits));

  const withEffects = cards.filter((c) => c.breakpoints.some((b) => b.effects.length > 0)).length;
  console.log(`Wrote ${CARDS_PATH}: ${cards.length} cards (${withEffects} with parameter effects${before === null ? "" : `, previously ${before}`})`);
  console.log(`Wrote ${LIMITS_PATH}: ${JSON.stringify(levelLimits)}`);
  console.log(`Matches: exact ${report.matches.exact}, prefix ${report.matches.prefix}; categories used ${report.categoriesUsed.size}`);
  const skipped = [...report.skippedByType].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t.replace("ProduceEffectType_", "")}×${n}`);
  console.log(`Skipped non-parameter effects: ${skipped.join(", ")}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
