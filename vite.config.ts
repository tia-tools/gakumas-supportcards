import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Served at the root of gakumas-supportcards.tia.run (docs/adr/0003, plan D7), so no `base`.
export default defineConfig({
  plugins: [preact(), tailwindcss()],
  build: {
    // The card data (data/cards.generated.ts, 1.7 MB source) ships inline in the one
    // chunk by design: it is 58 KB gzipped (plan D28), so the default 500 KB warning
    // would fire on every build for a size that is not a problem. Remove this entry
    // if the data moves out of the bundle.
    chunkSizeWarningLimit: 2000,
  },
});
