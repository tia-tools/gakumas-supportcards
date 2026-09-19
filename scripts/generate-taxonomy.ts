/**
 * Generates data/taxonomy.generated.ts: the game's filter rows followed by our
 * extension rows (data/taxonomy.extensions.ts), each reduced to what the
 * engine and UI need (id, title, order, source, countsAs).
 *
 * Usage: bun scripts/generate-taxonomy.ts
 *
 * Exits 1 when an extension row has become redundant or when a `countsAs`
 * points at a row that does not exist.
 */

import { TAXONOMY_EXTENSIONS } from "../data/taxonomy.extensions.ts";
import type { TaxonomyRow } from "../src/engine/types.ts";
import { byCodeUnit } from "./lib/build-cards.ts";
import { redundantExtensions } from "./lib/classify.ts";
import { emitTaxonomy } from "./lib/emit.ts";
import { loadTables } from "./lib/tables.ts";

const OUT_PATH = "data/taxonomy.generated.ts";

async function main(): Promise<void> {
  const tables = await loadTables();

  const redundant = redundantExtensions(tables.filterRows, TAXONOMY_EXTENSIONS);
  if (redundant.length > 0) {
    console.error("Extension rows now covered by the game's filter table — delete them from data/taxonomy.extensions.ts:");
    for (const r of redundant) console.error(`  ${r.extensionId} (${r.triggerId}) is covered by ${r.gameRowId} (${r.gameTriggerId})`);
    process.exit(1);
  }

  const gameIds = new Set(tables.filterRows.map((r) => r.id));
  const rows: TaxonomyRow[] = [
    ...tables.filterRows.map((r): TaxonomyRow => ({ id: r.id, title: r.title, order: r.order, source: "game" })),
    ...TAXONOMY_EXTENSIONS.map((r): TaxonomyRow => (r.countsAs ? { id: r.id, title: r.title, order: r.order, source: "extension", countsAs: r.countsAs } : { id: r.id, title: r.title, order: r.order, source: "extension" })),
  ].sort((a, b) => a.order - b.order || byCodeUnit(a.id, b.id));

  const badCountsAs = rows.filter((r) => r.countsAs && !gameIds.has(r.countsAs));
  if (badCountsAs.length > 0) {
    for (const r of badCountsAs) console.error(`${r.id}: countsAs ${r.countsAs} is not a game row`);
    process.exit(1);
  }

  await Bun.write(OUT_PATH, emitTaxonomy(rows));
  console.log(`Wrote ${OUT_PATH}: ${tables.filterRows.length} game rows + ${TAXONOMY_EXTENSIONS.length} extension rows`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
