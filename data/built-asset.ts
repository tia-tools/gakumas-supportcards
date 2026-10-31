/**
 * For tests of the files the build publishes (data/card-data-file.test.ts,
 * data/skillcard-data-file.test.ts): the text `bun run build` (vite.config.ts) writes at `path`
 * under dist/, built in memory with the real configuration; null when it writes no such file.
 */

import { join } from "node:path";
import { build } from "vite";

const ROOT = join(import.meta.dirname, "..");

export async function builtAsset(path: string): Promise<string | null> {
  const result = await build({ root: ROOT, configFile: join(ROOT, "vite.config.ts"), logLevel: "silent", build: { write: false } });
  for (const out of Array.isArray(result) ? result : [result]) {
    if (!("output" in out)) continue;
    const file = out.output.find((f) => f.fileName === path);
    if (file?.type === "asset") return typeof file.source === "string" ? file.source : new TextDecoder().decode(file.source);
  }
  return null;
}
