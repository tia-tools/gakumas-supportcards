# Image extraction: support card thumbnails for the owned image library

This directory turns the game's support card art into the thumbnails the table shows. It downloads each card's asset bundle from the game's asset servers, decodes the texture, writes a 192 × 108 webp named `img_general_{assetId}_full.webp`, and uploads the ones the deployed site does not serve yet to the Cloudflare R2 bucket behind `https://gakumas-supportcards.tia.run/img/*`. The decision to own the images, and the naming, are recorded in `docs/adr/0003-owned-image-library-on-r2-served-through-the-app-worker.md`.

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

    uv run extract.py                          # everything not yet in out/webp
    uv run extract.py --only 'csprt-3-0016' --force
    uv run extract.py --limit 5

Raw bundles land in `out/raw/` (about 130 MB for all cards) and thumbnails in `out/webp/` (about 1.3 MB). A second run processes nothing, because existing thumbnails are skipped. The script exits 1 and names each image it could not decode.

Decoding is ours (`decode.py`), not the library's. The bundles have their Unity version stripped, and the library hard-codes a fallback version the game has moved past: with it, a texture parses to absurd dimensions and the library silently writes the raw bundle instead of an image. `decode.py` tries candidate engine versions in order and accepts the first parse with plausible dimensions. If a future game update breaks decoding again, add the new engine version to the front of `UNITY_VERSIONS` there.

After extracting, `bun run dev` at the repository root shows the real thumbnails in the table: the dev server answers `/img/*` from `out/webp/`.

## Upload

    uv run upload.py --dry-run                 # what is missing; uploads nothing
    uv run upload.py                           # upload the missing ones
    uv run upload.py --assume-empty            # first run, before the Worker is deployed

"Missing" is asked of the deployed site with a `HEAD /img/<key>` per image, so planning needs no credentials. Only 200 and 404 count as answers; any other status stops the run. Uploading calls `bunx wrangler r2 object put`, which uses your Wrangler login (`bunx wrangler login`, with the Cloudflare account that holds `tia.run`) or the `CLOUDFLARE_API_TOKEN` environment variable in CI. Before the first deployment the site does not exist yet, so use `--assume-empty` once.

Only art for cards present in `data/cards.generated.ts` is uploaded. The game's manifest carries art for cards that are not released yet, and publishing those early would leak them; the script prints which images it held back. They go out on the first upload after the weekly data update adds their cards.

## Tests

    uv run pytest

The tests are hermetic: naming, thumbnail format, the version-fallback rule with a fake loader, and upload planning. No test touches the network or needs the vendored checkout.
