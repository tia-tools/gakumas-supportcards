import { execFileSync } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { CARD_DATA_PATH, cardDataJson } from "./data/card-data-file.ts";
import { CARDS } from "./data/cards.generated.ts";
import { HELD } from "./data/held.generated.ts";
import { LEVEL_LIMITS } from "./data/levelLimits.generated.ts";
import { SKILLCARD_DATA_PATH, skillCardDataJson } from "./data/skillcard-data-file.ts";
import { SKILL_CARD_DATA } from "./data/skillcards.generated.ts";
import { imageKey } from "./infra/worker/img.ts";

/**
 * Dev server only: answers `/img/*` from the locally extracted thumbnails
 * (scripts/images/out/w192, gitignored) so the table shows real card art before and without a
 * deployment. In production the same paths are served from R2 by the Worker (docs/adr/0003);
 * both use the Worker's own `imageKey` rule for what counts as a library image, so the dev
 * server cannot serve a master either.
 */
function localImageLibrary(dir: string): Plugin {
  return {
    name: "local-image-library",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const key = imageKey((req.url ?? "").split("?")[0] ?? "");
        const file = key === null ? null : join(dir, key);
        if (file === null || !existsSync(file)) return next();
        res.setHeader("Content-Type", "image/webp");
        createReadStream(file).pipe(res);
      });
    },
  };
}

/**
 * Build only: writes the published card data, dist/data/cards.v1.json, from the same generated
 * modules the page bundles (data/card-data-file.ts, docs/adr/0010).
 */
function cardDataFile(): Plugin {
  return {
    name: "card-data-file",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: CARD_DATA_PATH, source: cardDataJson(CARDS, HELD, LEVEL_LIMITS) });
    },
  };
}

/**
 * Build only: writes the skill card data gkms-memomemo reads, dist/data/skillcards.v1.json, from
 * data/skillcards.generated.ts (data/skillcard-data-file.ts; docs/adr/0010, addendum 2026-10-31).
 * The page never imports that module, so it adds nothing to the bundle.
 */
function skillCardDataFile(): Plugin {
  return {
    name: "skillcard-data-file",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: SKILLCARD_DATA_PATH, source: skillCardDataJson(SKILL_CARD_DATA) });
    },
  };
}

/**
 * The commit the page is built from, attached to feedback so a report names the exact build
 * (src/app/feedback.ts). Read from git rather than GITHUB_SHA, which under deploy.yml's
 * `workflow_call` is the caller's commit, not the checked-out `main`.
 */
function buildCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

// Served at the root of gakumas-supportcards.tia.run (docs/adr/0003, plan D7), so no `base`.
export default defineConfig({
  define: { __BUILD_COMMIT__: JSON.stringify(buildCommit()) },
  plugins: [preact(), tailwindcss(), localImageLibrary(join(import.meta.dirname, "scripts/images/out")), cardDataFile(), skillCardDataFile()],
  build: {
    // The card data (data/cards.generated.ts, 1.7 MB source) ships inline in the one
    // chunk by design: it is 58 KB gzipped (plan D28), so the default 500 KB warning
    // would fire on every build for a size that is not a problem. Remove this entry
    // if the data moves out of the bundle.
    chunkSizeWarningLimit: 2000,
  },
});
