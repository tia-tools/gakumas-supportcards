# gakumas-supportcards.tia.run Worker

One Cloudflare Worker serves the whole app: the built page as static assets, and the owned image library's thumbnails at `/img/w192/*` from the R2 bucket `tia-assets` (per `docs/adr/0003-owned-image-library-on-r2-served-through-the-app-worker.md`). `wrangler.toml` routes only `/img/*` through the Worker code (`run_worker_first`); every other path is answered by the assets directly.

| Route | Serves |
|---|---|
| `https://gakumas-supportcards.tia.run/` | the page built by `bun run build` (`dist/`) |
| `https://gakumas-supportcards.tia.run/img/w192/img_general_{assetId}_full.webp` | the 192 × 108 card thumbnail from R2, `Cache-Control: public, max-age=31536000, immutable` |
| any other `/img/...` path, including `/img/master/...`, or a thumbnail not in the bucket | 404 with `Cache-Control: no-store` |

A miss is deliberately uncacheable: `scripts/images/upload.py` asks this route which images are missing, and a cached 404 would hide an image uploaded a moment later. Only thumbnail keys in the game's naming scheme are ever looked up in the bucket (`imageKey` in `img.ts`). The same bucket holds a lossless full-size master of every card under `master/`; those are private by construction, because no request path maps to that prefix, and `img.test.ts` pins that a master is refused even when it exists.

Hostname policy (tia-tools convention): each app lives on its own single-level subdomain of `tia.run`. Do not add a second level such as `x.gakumas-supportcards.tia.run`; the zone's free Universal SSL certificate covers one wildcard level only.

## One-time account setup

Done once, by a person, in the Cloudflare account that holds `tia.run`:

    bunx wrangler login                        # MUST be the project account, not a personal one
    bunx wrangler r2 bucket create tia-assets

R2 has to be enabled on the account first (dashboard → R2); the free tier of 10 GB is far above this app's size (about 265 MB of masters and 1.3 MB of thumbnails).

## Deploy

Deployment is automatic: every push to `main` that touches the page, the data or this directory runs `.github/workflows/deploy.yml`, which tests, builds and deploys, and the weekly data update calls the same workflow. It needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The token is an **account-owned** API token (dashboard → Manage Account → Account API Tokens, on the account that holds `tia.run`; it needs Super Administrator to create), not a user token, so it survives any person leaving and can carry the granular Workers roles Cloudflare introduced on 2026-09-15. Its permissions, the least the two workflows use:

| Scope | Permission | Used by |
|---|---|---|
| Workers, only the Worker `gakumas-supportcards` | **Editor** (the new role; the old "Workers Scripts Edit" is its account-wide legacy equivalent) | `wrangler deploy`: script and static assets |
| Zone, only `tia.run` | **Workers Routes: Edit** | the custom domain route in `wrangler.toml` |
| Account | **Workers R2 Storage: Edit** | `upload.py` writing images (R2 has no per-bucket role yet) |

No client IP filter (GitHub's runner addresses change constantly) and an expiry of one year. Editor cannot delete the Worker or touch any other Worker; a leaked token can redeploy this site and write to R2, nothing else. If a deploy fails with a permissions error, the message names the missing permission; "Account Settings: Read" is the one older Wrangler versions asked for and is harmless to add. `main` is production; unfinished work belongs on `develop`.

By hand, for a first deployment or an emergency, from the repository root and then this directory:

    bun run build
    cd infra/worker
    bunx wrangler deploy

The `custom_domain` route makes Cloudflare attach the Worker to `gakumas-supportcards.tia.run` and manage the DNS record. Check a configuration change without deploying or logging in:

    bunx wrangler deploy --dry-run --outdir /tmp/wrangler-out

Then upload the images (see `scripts/images/README.md` § Upload; use `--assume-empty` the first time).

## Verify

    curl -sI https://gakumas-supportcards.tia.run/ | head -3
    # -> HTTP/2 200, content-type: text/html
    curl -sI https://gakumas-supportcards.tia.run/img/w192/img_general_csprt-3-0016_full.webp
    # -> HTTP/2 200, content-type: image/webp, cache-control: public, max-age=31536000, immutable
    curl -sI https://gakumas-supportcards.tia.run/img/master/img_general_csprt-3-0016_full.webp
    # -> HTTP/2 404, cache-control: no-store   (the master exists in the bucket and must still be refused)
    curl -sI https://gakumas-supportcards.tia.run/img/nope.webp
    # -> HTTP/2 404, cache-control: no-store

## Tests

`bun test` at the repository root runs `img.test.ts` against a fake bucket: naming scheme, the refused master, GET and HEAD, the uncached 404, conditional requests and refused methods.
