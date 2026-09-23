/**
 * gakumas-supportcards.tia.run: the static site, the image library and the feedback endpoint.
 *
 * wrangler.toml sends only `/img/*` and `/feedback` through this Worker (`run_worker_first`);
 * every other path is answered by the static assets directly and never reaches this code.
 */

import { createGitHubIssue, handleFeedback, type CountStore } from "./feedback.ts";
import { serveImage, type ImageBucket } from "./img.ts";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  IMAGES: ImageBucket;
  FEEDBACK_LIMITS: CountStore;
  /** Wrangler secrets; see README.md § Feedback. */
  FEEDBACK_TOKEN?: string;
  HASH_SALT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/img/")) return serveImage(request, env.IMAGES);
    if (pathname === "/feedback") {
      return handleFeedback(request, {
        store: env.FEEDBACK_LIMITS,
        salt: env.HASH_SALT,
        token: env.FEEDBACK_TOKEN,
        createIssue: createGitHubIssue,
        now: () => new Date(),
      });
    }
    return env.ASSETS.fetch(request);
  },
};
