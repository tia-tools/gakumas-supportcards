# Image extraction: support card art for the owned image library

This directory turns the game's support card art into the image library. It downloads each card's asset bundle from the game's asset servers, decodes the texture, and writes two renditions under one file name, `img_general_{assetId}_full.webp`: a lossless full-size master (2048 × 1152) and the 192 × 108 thumbnail the table shows. Both have the 16:9 shape the game displays; the game itself stores the texture squashed to 2048 × 1024, which is why a raw decode looks vertically compressed. It then uploads what the deployed site lacks to the Cloudflare R2 bucket `tia-assets`: masters under the prefix `master/`, which is private and never served, and thumbnails under `w192/`, which the site serves at `https://gakumas-supportcards.tia.run/img/w192/*`. A future size would be one more prefix, never a rename. The decision to own the images, and the naming, are recorded in `docs/adr/0003-owned-image-library-on-r2-served-through-the-app-worker.md`.

Nothing downloaded or generated here is committed: `vendor/`, `out/` and `.venv/` are gitignored.

## Setup

Python is managed with `uv`. From this directory:

    uv sync

The manifest and downloads come from GkmasObjectManager (`AllenHeartcore/GkmasObjectManager`, GPL-3.0). It is not a Python package — no `pyproject.toml`, not on PyPI — so it is unpacked from a source tarball pinned to a commit, and its runtime requirements are listed in our `pyproject.toml`:

    SHA=2d378780786f561a3c94e1cc171e275bfac0d38d
    mkdir -p vendor/GkmasObjectManager
    curl -sL "https://codeload.github.com/AllenHeartcore/GkmasObjectManager/tar.gz/$SHA" \
      | tar -xz -C vendor/GkmasObjectManager --strip-components=1
    echo "$SHA" > vendor/GkmasObjectManager.sha

To move to a newer commit, change `SHA`, delete `vendor/GkmasObjectManager` and repeat. It is used only for fetching and decrypting the manifest and downloading de-obfuscated bundles; it runs on your machine and never ships with the site.

## Extract

    uv run extract.py                          # every card that lacks a master or a thumbnail
    uv run extract.py --only 'csprt-3-0016' --force
    uv run extract.py --limit 5

Raw bundles land in `out/raw/` (about 130 MB for all cards), masters in `out/master/` (about 265 MB) and thumbnails in `out/w192/` (about 1.3 MB). A full run takes about two and a half minutes, most of it lossless encoding. A second run processes nothing, because a card that already has both renditions is skipped. The master is resampled once, from the stored 2:1 to the 16:9 the game shows, and then encoded losslessly, so it looks right wherever it is opened without anyone having to know a rule (plan decision D36). The script exits 1 and names each image it could not decode.

Decoding is ours (`decode.py`), not the library's. The bundles have their Unity version stripped, and the library hard-codes a fallback version the game has moved past: with it, a texture parses to absurd dimensions and the library silently writes the raw bundle instead of an image. `decode.py` tries candidate engine versions in order and accepts the first parse with plausible dimensions. If a future game update breaks decoding again, add the new engine version to the front of `UNITY_VERSIONS` there.

After extracting, `bun run dev` at the repository root shows the real thumbnails in the table: the dev server answers `/img/w192/*` from `out/w192/`.

## Upload

    uv run upload.py --dry-run                 # what is missing; uploads nothing
    uv run upload.py                           # upload the missing ones
    uv run upload.py --assume-empty            # first run, before the Worker is deployed
    uv run upload.py --assume-empty --rendition master   # re-send every master after its rule changed

"Missing" is asked of the deployed site with a `HEAD /img/w192/<file>` per card, so planning needs no credentials. For each missing card the master is uploaded first and the thumbnail second. Masters cannot be checked from outside because they are private, so this order is what guarantees that a served thumbnail always has a stored master, even if a run dies halfway; rerunning simply completes the card. Only 200 and 404 count as answers; any other status stops the run. Uploading calls `bunx wrangler r2 object put`, which uses your Wrangler login (`bunx wrangler login`, with the Cloudflare account that holds `tia.run`) or the `CLOUDFLARE_API_TOKEN` environment variable in CI. Before the first deployment the site does not exist yet, so use `--assume-empty` once.

The Cache-Control given at upload is stored with the object and comes back on every download, dashboard downloads included. Thumbnails are stored as `public, max-age=31536000, immutable`, because a thumbnail never changes under its name. Masters are stored as `private, no-cache`, because a master is overwritten whenever its rule changes: with an immutable header, a browser that had opened a master once keeps showing the old bytes after a re-upload, which makes a correct bucket look stale. To check what the bucket really holds, bypass the browser: `bunx wrangler r2 object get tia-assets/master/<file> --file /tmp/check.webp --remote` and compare `md5 -q` with the local file.

Only art for cards present in `data/cards.generated.ts` is uploaded. The game's manifest carries art for cards that are not released yet, and publishing those early would leak them; the script prints which images it held back. They go out on the first upload after the weekly data update adds their cards.

## Tests

    uv run pytest

The tests are hermetic: naming, thumbnail format, a master that has the display shape and is encoded losslessly, the version-fallback rule with a fake loader, upload planning and the master-first order. When checking that a test bites by breaking a rule and restoring it, run pytest with `PYTHONDONTWRITEBYTECODE=1`: an edit that keeps the file the same size within one second leaves stale bytecode that Python still trusts, and the restored code then appears to fail. No test touches the network or needs the vendored checkout.
