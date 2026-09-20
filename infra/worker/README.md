# gakumas-supportcards.tia.run Worker

One Cloudflare Worker serves the whole app: the built page as static assets, and the owned image library at `/img/*` from the R2 bucket `tia-assets` (per `docs/adr/0003-owned-image-library-on-r2-served-through-the-app-worker.md`). `wrangler.toml` routes only `/img/*` through the Worker code (`run_worker_first`); every other path is answered by the assets directly.

| Route | Serves |
|---|---|
| `https://gakumas-supportcards.tia.run/` | the page built by `bun run build` (`dist/`) |
| `https://gakumas-supportcards.tia.run/img/img_general_{assetId}_full.webp` | the card thumbnail from R2, `Cache-Control: public, max-age=31536000, immutable` |
| any other `/img/...` path, or an image not in the bucket | 404 with `Cache-Control: no-store` |

A miss is deliberately uncacheable: `scripts/images/upload.py` asks this route which images are missing, and a cached 404 would hide an image uploaded a moment later. Only filenames in the game's naming scheme are ever looked up in the bucket (`imageKey` in `img.ts`).

Hostname policy (tia-tools convention): each app lives on its own single-level subdomain of `tia.run`. Do not add a second level such as `x.gakumas-supportcards.tia.run`; the zone's free Universal SSL certificate covers one wildcard level only.

## One-time account setup

Done once, by a person, in the Cloudflare account that holds `tia.run`:

    bunx wrangler login                        # MUST be the project account, not a personal one
    bunx wrangler r2 bucket create tia-assets

R2 has to be enabled on the account first (dashboard → R2); the free tier is far above this app's size (about 1.3 MB of images).

## Deploy

From the repository root, then this directory:

    bun run build
    cd infra/worker
    bunx wrangler deploy

The `custom_domain` route makes Cloudflare attach the Worker to `gakumas-supportcards.tia.run` and manage the DNS record. Check a configuration change without deploying or logging in:

    bunx wrangler deploy --dry-run --outdir /tmp/wrangler-out

Then upload the images (see `scripts/images/README.md` § Upload; use `--assume-empty` the first time).

## Verify

    curl -sI https://gakumas-supportcards.tia.run/ | head -3
    # -> HTTP/2 200, content-type: text/html
    curl -sI https://gakumas-supportcards.tia.run/img/img_general_csprt-3-0016_full.webp
    # -> HTTP/2 200, content-type: image/webp, cache-control: public, max-age=31536000, immutable
    curl -sI https://gakumas-supportcards.tia.run/img/nope.webp
    # -> HTTP/2 404, cache-control: no-store

## Tests

`bun test` at the repository root runs `img.test.ts` against a fake bucket: naming scheme, GET and HEAD, the uncached 404, conditional requests and refused methods.
