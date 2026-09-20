/**
 * gakumas-supportcards.tia.run: the static site plus the image library.
 *
 * wrangler.toml sends only `/img/*` through this Worker (`run_worker_first`); every other
 * path is answered by the static assets directly and never reaches this code.
 */

import { serveImage, type ImageBucket } from "./img.ts";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  IMAGES: ImageBucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith("/img/")) return serveImage(request, env.IMAGES);
    return env.ASSETS.fetch(request);
  },
};
