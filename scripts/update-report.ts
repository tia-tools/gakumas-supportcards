/**
 * Writes the texts an unattended data update needs and tells the workflow what it found.
 *
 * Usage: bun scripts/update-report.ts [--base <git ref>] [--date YYYY-MM-DD] --pr-body <file> --issue-body <file>
 *
 * Compares data/scores.generated.json in the working tree with the one committed at <git ref>
 * (default HEAD), and reads the held list from data/held.generated.ts. Prints `title=…`,
 * `held=<n>` and `empty=<true|false>` lines, and appends them to $GITHUB_OUTPUT when that is
 * set, which is how the workflow steps read them.
 */

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { HELD } from "../data/held.generated.ts";
import { SCORES_PATH } from "./generate-cards.ts";
import { parseSnapshot } from "./lib/score-snapshot.ts";
import { diffSnapshots, isEmpty, renderHeldIssue, renderPullRequest, updateTitle } from "./lib/update-report.ts";

function argOf(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i < 0 ? undefined : process.argv[i + 1];
}

async function committed(ref: string): Promise<string> {
  const proc = Bun.spawn(["git", "show", `${ref}:${SCORES_PATH}`], { stdout: "pipe", stderr: "pipe" });
  const [text, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`git show ${ref}:${SCORES_PATH} failed: ${err.trim()}`);
  return text;
}

async function main(): Promise<void> {
  const prBody = argOf("--pr-body");
  const issueBody = argOf("--issue-body");
  if (!prBody || !issueBody) throw new Error("--pr-body <file> and --issue-body <file> are required");
  const date = argOf("--date") ?? new Date().toISOString().slice(0, 10);
  const runUrl = process.env.RUN_URL;

  const base = parseSnapshot(await committed(argOf("--base") ?? "HEAD"));
  const current = parseSnapshot(readFileSync(SCORES_PATH, "utf8"));
  const diff = diffSnapshots(base, current);

  writeFileSync(prBody, renderPullRequest(diff, HELD, current, runUrl));
  writeFileSync(issueBody, renderHeldIssue(HELD, runUrl));

  const outputs = [`title=${updateTitle(diff, HELD, date)}`, `held=${HELD.length}`, `empty=${isEmpty(diff)}`];
  for (const line of outputs) console.log(line);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${outputs.join("\n")}\n`);
}

await main();
