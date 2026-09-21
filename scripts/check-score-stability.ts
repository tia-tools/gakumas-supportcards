/**
 * Fails when a card's published score moved although the card's own data did
 * not — the check that replaces a person reading the diff of a weekly data
 * update (docs/plans/EXECPLAN_COUNTING_MODEL.md, Milestone 4).
 *
 * Usage: bun scripts/check-score-stability.ts [--base <git ref> | --base-file <path>]
 *
 * The current scores are computed here, from the working tree's generated cards,
 * held list, level limits and scenarios, and compared with a base snapshot:
 * data/scores.generated.json as committed at <git ref> (default HEAD), or a file.
 * Exits 1 listing every unexplained move, and also when the working tree's own
 * data/scores.generated.json is not what the working tree scores to (someone
 * edited a route profile or the engine without running `bun run generate`).
 * A deliberate change of a route profile or of the engine moves scores by
 * design: review the listed moves, then commit the regenerated snapshot.
 */

import { existsSync, readFileSync } from "node:fs";
import { CARDS } from "../data/cards.generated.ts";
import { HELD } from "../data/held.generated.ts";
import { LEVEL_LIMITS } from "../data/levelLimits.generated.ts";
import { ALL_SCENARIOS } from "../data/scenarios/index.ts";
import { SCORES_PATH, sha } from "./generate-cards.ts";
import { buildSnapshot, emitSnapshot, parseSnapshot, unexplainedMoves } from "./lib/score-snapshot.ts";

function argOf(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i < 0 ? undefined : process.argv[i + 1];
}

async function baseText(): Promise<{ text: string; from: string }> {
  const file = argOf("--base-file");
  if (file !== undefined) return { text: readFileSync(file, "utf8"), from: file };
  const ref = argOf("--base") ?? "HEAD";
  const proc = Bun.spawn(["git", "show", `${ref}:${SCORES_PATH}`], { stdout: "pipe", stderr: "pipe" });
  const [text, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`git show ${ref}:${SCORES_PATH} failed: ${err.trim()}`);
  return { text, from: `${ref}:${SCORES_PATH}` };
}

async function main(): Promise<void> {
  const current = buildSnapshot(CARDS, HELD, ALL_SCENARIOS, LEVEL_LIMITS, sha);
  let failed = false;

  if (!existsSync(SCORES_PATH) || readFileSync(SCORES_PATH, "utf8") !== emitSnapshot(current)) {
    console.error(`${SCORES_PATH} is not what the working tree scores to; run \`bun run generate\`.`);
    failed = true;
  }

  const { text, from } = await baseText();
  const base = parseSnapshot(text);
  const moves = unexplainedMoves(base, current);
  const changed = Object.keys(base).filter((id) => current[id] && current[id].data !== base[id]?.data).length;
  const added = Object.keys(current).filter((id) => !base[id]).length;
  const gone = Object.keys(base).filter((id) => !current[id]).length;
  console.log(`Compared with ${from}: ${Object.keys(current).length} cards now, ${added} new, ${gone} gone or held, ${changed} with changed data, ${moves.length} unexplained score moves.`);
  for (const m of moves) console.error(`  MOVED ${m.id} ${m.name} [${m.profile}]: ${JSON.stringify(m.before)} -> ${JSON.stringify(m.after)} with unchanged card data`);
  if (moves.length > 0) {
    console.error("A score moved without its card's data moving: the engine, the trigger parser or a route profile changed. If that was intended, review the moves above and commit the regenerated snapshot; a data update must never do this.");
    failed = true;
  }
  if (failed) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
