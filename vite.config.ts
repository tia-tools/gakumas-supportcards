import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
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

// Served at the root of gakumas-supportcards.tia.run (docs/adr/0003, plan D7), so no `base`.
export default defineConfig({
  plugins: [preact(), tailwindcss(), localImageLibrary(join(import.meta.dirname, "scripts/images/out"))],
  build: {
    // The card data (data/cards.generated.ts, 1.7 MB source) ships inline in the one
    // chunk by design: it is 58 KB gzipped (plan D28), so the default 500 KB warning
    // would fire on every build for a size that is not a problem. Remove this entry
    // if the data moves out of the bundle.
    chunkSizeWarningLimit: 2000,
  },
});
