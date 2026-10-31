# Image extraction: support card art, P-item icons and skill card icons for the owned image library

This directory turns the game's support card art and P-item icons into the image library. It downloads each asset bundle from the game's asset servers, decodes the texture, and writes two renditions under one file name. For a card, `img_general_{assetId}_full.webp`: a lossless full-size master (2048 × 1152) and the 192 × 108 thumbnail the table shows; both have the 16:9 shape the game displays — the game itself stores the texture squashed to 2048 × 1024, which is why a raw decode looks vertically compressed. For a P-item a card grants (listed as `items` in the card data), `img_general_pitem_{r}-{nnn}.webp` (the game's own asset id): a lossless 256 × 256 master with its transparency and the 48 × 48 icon with transparency the 「Pアイテム」 panel section shows; an icon is square and sits on a background, so nothing is reshaped or flattened (Milestone 4 of `docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md`). It then uploads what the deployed site lacks to the Cloudflare R2 bucket `tia-assets`: masters under the prefix `master/`, which is private and never served, thumbnails under `w192/` and icons under `w48/`, which the site serves at `https://gakumas-supportcards.tia.run/img/w192/*` and `/img/w48/*`. A future size would be one more prefix, never a rename. The decision to own the images, and the naming, are recorded in `docs/adr/0003-owned-image-library-on-r2-served-through-the-app-worker.md`.

Nothing downloaded or generated here is committed: `vendor/`, `out/` and `.venv/` are gitignored.

## Setup

Python is managed with `uv`. From this directory:

    uv sync

The manifest and downloads come from GkmasObjectManager (`AllenHeartcore/GkmasObjectManager`, GPL-3.0). It is not a Python package — no `pyproject.toml`, not on PyPI — so it is unpacked from a source tarball pinned to a commit, and its runtime requirements are listed in our `pyproject.toml`:

    ./fetch-vendor.sh

The pinned commit is the one line in `GkmasObjectManager.sha`, which is committed so that a person and the daily data-update workflow fetch the same version. To move to a newer commit, change that file and run the script again. It is used only for fetching and decrypting the manifest and downloading de-obfuscated bundles; it runs on your machine and never ships with the site.

## Extract

    uv run extract.py                          # every card that lacks a master or a thumbnail
    uv run extract.py --only 'csprt-3-0016' --force
    uv run extract.py --limit 5
    uv run extract.py --only-missing           # only released cards whose thumbnail the site lacks

Raw bundles land in `out/raw/` (about 130 MB for all cards), masters in `out/master/` (about 265 MB), thumbnails in `out/w192/` (about 1.3 MB) and item icons in `out/w48/`. A full run takes about two and a half minutes, most of it lossless encoding. A second run processes nothing, because a file that already has both its renditions is skipped. The master is resampled once, from the stored 2:1 to the 16:9 the game shows, and then encoded losslessly, so it looks right wherever it is opened without anyone having to know a rule (plan decision D36). The script exits 1 and names each image it could not decode.

Decoding is ours (`decode.py`), not the library's. The bundles have their Unity version stripped, and the library hard-codes a fallback version the game has moved past: with it, a texture parses to absurd dimensions and the library silently writes the raw bundle instead of an image. `decode.py` tries candidate engine versions in order and accepts the first parse with plausible dimensions. If a future game update breaks decoding again, add the new engine version to the front of `UNITY_VERSIONS` there.

After extracting, `bun run dev` at the repository root shows the real thumbnails in the table and the icons in the panel: the dev server answers `/img/w192/*` from `out/w192/` and `/img/w48/*` from `out/w48/`, and likewise `/img/w112/*` and `/img/sheet112/*`.

## Skill card icons and sprite sheets (for gkms-memomemo)

`tia-tools/gkms-memomemo` draws skill cards with their icons, read from the same bucket (`docs/plans/EXECPLAN_SKILLCARD_DATA_AND_ICONS.md`). A skill card's icon is the bundle `img_general_skillcard_{kind}-{n}_{nnn}.unity3d`, or, for a card drawn differently per P-idol (`perIdol` in the data), one bundle per idol named with `-{idol id}`; each is a 256 × 256 texture with transparent rounded corners. `extract.py` keeps a lossless master of it as stored under `out/master/` and a 112 × 112 webp with transparency under `out/w112/`, named after the bundle (`img_general_skillcard_act-3_029-hski.webp`). Only icons of the cards in `data/skillcards.generated.ts` (released ones that can be a produce memory, at all 13 playable idols where the art varies) are ever uploaded; `skillcards.py` reads that module, whose object is JSON.

    uv run extract.py --only 'skillcard'       # every skill card icon the game offers
    uv run sheets.py --dry-run                 # which sprite sheets are stale; builds them into out/sheet112/
    uv run sheets.py                           # upload the stale sheets, then the index
    uv run sheets.py --rebuild                 # every sheet, after a change of size, quality or layout

The page does not load single icons: on the Workers Free plan every image request counts toward the account's daily allowance, shared by every `tia.run` Worker. It loads sprite sheets instead, one per plan (`sense`, `logic`, `anomaly`) and idol, 39 today: a WebP grid of 112 × 112 cells in 10 columns holding, in the game's order, every card that plan's tab offers (the plan's cards and the free ones), in that idol's variant where the card has one. `sheets.py` makes the cells from the masters, so each icon is compressed only once, and stores each sheet as `sheet112/<plan>-<idol>-<first 8 hex digits of its SHA-256>.webp`, a name that never changes meaning. `sheet112/index.v1.json` names every current sheet and, cell by cell, the icon it holds:

    {"formatVersion":1,"cell":112,"sheets":[
      {"plan":"sense","idol":"hski","file":"sheet112/sense-hski-1a2b3c4d.webp","columns":10,"assets":["img_general_skillcard_…", …]}, …]}

A sheet is stale when the stored index (asked of the deployed site) has no entry for its plan and idol, or one with other icons or another layout; only stale sheets are rebuilt, under their new name. The bytes are never compared, so a different WebP encoder on another machine does not rebuild anything. The order of uploads is what lets planning skip most requests: a single icon (master first) before any sheet holding it, the sheets before the index. An icon the stored index names is therefore stored as a single icon too, so `upload.py` and `extract.py --only-missing` send a `HEAD` only for icons the index does not name, and `sheets.py` refuses to upload a sheet whose icons are not stored yet. The index is stored and served with `Cache-Control: no-cache`; sheets and icons are immutable. A stored index is checked entry by entry before it is trusted, and one that fails the check stops every script; `uv run sheets.py --rebuild` then replaces it, trusting nothing stored (it asks the site about every icon, about 1,700 requests). A missing master stops `sheets.py` before it uploads anything, since a sheet without that icon would be published as if complete. Sheets the index no longer names stay in the bucket.

## Upload

    uv run upload.py --dry-run                 # what is missing; uploads nothing
    uv run upload.py                           # upload the missing ones
    uv run upload.py --assume-empty            # first run, before the Worker is deployed
    uv run upload.py --assume-empty --rendition master   # re-send every master after its rule changed

"Missing" is asked of the deployed site with a `HEAD /img/w192/<file>` per card, `HEAD /img/w48/<file>` per item icon and `HEAD /img/w112/<file>` per skill card icon that the stored sprite sheet index does not name (§ Skill card icons and sprite sheets), so planning needs no credentials. For each missing file the master is uploaded first and the served rendition second. Masters cannot be checked from outside because they are private, so this order is what guarantees that a served thumbnail or icon always has a stored master, even if a run dies halfway; rerunning simply completes the file. `--rendition w48` re-sends item icons, `w112` skill card icons and `w192` thumbnails, each together with its master — a public rendition never goes out without its master, because a file the site lacks would otherwise end up public with no master stored and masters cannot be checked from outside; only `--rendition master` sends one rendition alone. Only 200 and 404 count as answers; any other status stops the run. Uploading calls `bunx wrangler r2 object put` (in `r2.py`, shared by `upload.py` and `sheets.py`), trying a failed put twice more after 5 and 20 seconds, since the R2 API sometimes fails a single put with a transient server error (issue #70); it uses your Wrangler login (`bunx wrangler login`, with the Cloudflare account that holds `tia.run`) or the `CLOUDFLARE_API_TOKEN` environment variable in CI. Before the first deployment the site does not exist yet, so use `--assume-empty` once.

The Cache-Control given at upload is stored with the object and comes back on every download, dashboard downloads included. Thumbnails are stored as `public, max-age=31536000, immutable`, because a thumbnail never changes under its name. Masters are stored as `private, no-cache`, because a master is overwritten whenever its rule changes: with an immutable header, a browser that had opened a master once keeps showing the old bytes after a re-upload, which makes a correct bucket look stale. To check what the bucket really holds, bypass the browser: `bunx wrangler r2 object get tia-assets/master/<file> --file /tmp/check.webp --remote` and compare `md5 -q` with the local file.

Only art for cards present in `data/cards.generated.ts` is uploaded. The game's manifest carries art for cards that are not released yet, and publishing those early would leak them; the script prints which images it held back. They go out on the first upload after the daily data update adds their cards.

## In the daily data-update workflow

`.github/workflows/update-data.yml` runs `./fetch-vendor.sh`, `uv sync --frozen`, `uv run extract.py --only-missing`, `uv run upload.py` and `uv run sheets.py` after the data gates have passed. `--only-missing` asks the deployed site which released cards have no thumbnail or icon and downloads only those bundles, so a runner that starts with nothing fetches a few hundred kilobytes instead of 130 MB, and never fetches art of a card that is not in the data. It also downloads every icon of each stale sprite sheet, because the runner builds the sheet from their masters: a new plan card makes that plan's 13 sheets stale (about 900 small bundles), a new free card all 39 (about 1,700). These steps are best effort: if the game's servers refuse the runner or a new engine version breaks decoding, the data still publishes and the card shows its name until someone runs the commands locally.

## Tests

    uv run pytest

The tests are hermetic: naming, thumbnail format, a master that has the display shape and is encoded losslessly, the version-fallback rule with a fake loader, upload planning and the master-first order. When checking that a test bites by breaking a rule and restoring it, run pytest with `PYTHONDONTWRITEBYTECODE=1`: an edit that keeps the file the same size within one second leaves stale bytecode that Python still trusts, and the restored code then appears to fail. No test touches the network or needs the vendored checkout.
