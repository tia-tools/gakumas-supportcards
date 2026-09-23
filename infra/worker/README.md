# gakumas-supportcards.tia.run Worker

One Cloudflare Worker serves the whole app: the built page as static assets, the owned image library's thumbnails at `/img/w192/*` from the R2 bucket `tia-assets` (per `docs/adr/0003-owned-image-library-on-r2-served-through-the-app-worker.md`), and the feedback form's `POST /feedback` (§ Feedback). `wrangler.toml` routes only `/img/*` and `/feedback` through the Worker code (`run_worker_first`); every other path is answered by the assets directly.

| Route | Serves |
|---|---|
| `https://gakumas-supportcards.tia.run/` | the page built by `bun run build` (`dist/`) |
| `https://gakumas-supportcards.tia.run/img/w192/img_general_{assetId}_full.webp` | the 192 × 108 card thumbnail from R2, `Cache-Control: public, max-age=31536000, immutable` |
| any other `/img/...` path, including `/img/master/...`, or a thumbnail not in the bucket | 404 with `Cache-Control: no-store` |
| `POST https://gakumas-supportcards.tia.run/feedback` | creates an issue in the private `tia-tools/feedback` repository; JSON `{"ok": true}` or `{"ok": false}` with 400, 405, 413, 429, 502 or 503 |

A miss is deliberately uncacheable: `scripts/images/upload.py` asks this route which images are missing, and a cached 404 would hide an image uploaded a moment later. Only thumbnail keys in the game's naming scheme are ever looked up in the bucket (`imageKey` in `img.ts`). The same bucket holds a lossless full-size master of every card under `master/`; those are private by construction, because no request path maps to that prefix, and `img.test.ts` pins that a master is refused even when it exists.

Hostname policy (tia-tools convention): each app lives on its own single-level subdomain of `tia.run`. Do not add a second level such as `x.gakumas-supportcards.tia.run`; the zone's free Universal SSL certificate covers one wildcard level only.

## One-time account setup

Done once, by a person, in the Cloudflare account that holds `tia.run`:

    bunx wrangler login                        # MUST be the project account, not a personal one
    bunx wrangler r2 bucket create tia-assets

R2 has to be enabled on the account first (dashboard → R2); the free tier of 10 GB is far above this app's size (about 265 MB of masters and 1.3 MB of thumbnails).

## Feedback

The page's folded 「フィードバックを送る」 form (`src/app/FeedbackForm.tsx`) posts `{category, message, view, commit}` to `/feedback` (the contract is `feedback-contract.ts`, shared with the page). `feedback.ts` checks it and creates an issue in `tia-tools/feedback` titled `[バグ|要望|その他] <first line>`, labelled `gakumas-supportcards` plus `bug`, `request` or `other`, whose body is the message as a fenced code block (so an anonymous sender's Markdown, links, images and @mentions show as plain text instead of rendering under the token owner's name) followed by a link to the view it was sent from (the page's query string: scenario, profile, filters, count overrides) and the commit the page was built from. The shape follows the rehearsal-automation Worker's handler, the first tia-tools feedback endpoint.

The endpoint is public (anything in the page is readable by anyone), so it is bounded three ways (first plan, decision D42):

- a 20 000-byte request cap, counted in bytes while the body streams in (so a body without or with a false `Content-Length` is cut off, not buffered whole), and a 4 000-character message cap;
- at most 5 issues per client per UTC day, counted in the KV namespace bound as `FEEDBACK_LIMITS` under `fb/<date>/<hash>`, where the hash is a truncated SHA-256 of client IP, date and the secret `HASH_SALT`. No raw IP is stored, the key changes every day so days cannot be linked, and each key expires after two days. Only a submission GitHub accepted counts. KV is eventually consistent, so a tight burst can get a few more through;
- the GitHub token can only write issues on that one repository, so the worst case of abuse or a leak is issue spam in a private repository. It is this app's own token, never shared with another Worker.

Without either secret the endpoint answers 503 and stores nothing; an unsalted daily hash of an IPv4 address could be reversed by trying every address. A request without `CF-Connecting-IP` (Cloudflare sets it on every request from outside) is refused with 400 rather than counted in one quota shared by all such requests.

One-time setup, by a person with the Cloudflare account that holds `tia.run` (`bunx wrangler login` first) and a GitHub account that can manage `tia-tools`. Run every command from this directory (`infra/worker/`): Wrangler finds the Worker's name in `wrangler.toml` here, and from the repository root it fails with "Required Worker name missing".

1. Create the KV namespace and put the printed `id` into `wrangler.toml` under `[[kv_namespaces]]` (the id is not a secret):

        bunx wrangler kv namespace create gakumas-supportcards-feedback

2. Create a fine-grained personal access token: resource owner `tia-tools`, repository access only `tia-tools/feedback`, repository permission **Issues: Read and write** and nothing else, expiry one year. Store it on the Worker:

        bunx wrangler secret put FEEDBACK_TOKEN

3. Store a random salt (regenerating it later only resets that day's counts):

        openssl rand -hex 32 | bunx wrangler secret put HASH_SALT

The labels `gakumas-supportcards`, `bug`, `request` and `other` must exist in `tia-tools/feedback` (all four do since 2026-09-23). Create a new one by hand before the code sends it; whether the issues-only token could create it on the fly has not been tested, and the design does not rely on it.

A secret does not need a redeploy, and a redeploy keeps the secrets. The deploy token below may need a KV permission for the new binding; this has not been tried yet — if `deploy.yml` fails naming KV, add **Workers KV Storage** at account scope to the token and record which level was enough.

The Vite dev server has no `/feedback`; the form there reports a send failure, which is expected.

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
    curl -s -X POST https://gakumas-supportcards.tia.run/feedback -d '{}'
    # -> {"ok":false} with HTTP 400 (reaches the Worker, creates nothing)

Then send one message from the page's feedback form and check that an issue labelled `gakumas-supportcards` appeared in `tia-tools/feedback`.

## Tests

`bun test` at the repository root runs `img.test.ts` against a fake bucket: naming scheme, the refused master, GET and HEAD, the uncached 404, conditional requests and refused methods; and `feedback.test.ts` against a fake KV store and a fake GitHub: payload validation, the issue's title, labels and body, the daily key, the per-day limit, no quota used by a GitHub failure, refusal without secrets, size caps and methods.
