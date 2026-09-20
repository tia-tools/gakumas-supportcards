"""
Uploads the card images the deployed image library does not have yet: per card a private
lossless master (bucket prefix master/, never served) and the public thumbnail (w192/).

    uv run upload.py --dry-run              # show what is missing, upload nothing
    uv run upload.py                        # upload the missing ones
    uv run upload.py --assume-empty         # first run, before the Worker is deployed
    uv run upload.py --assume-empty --rendition master   # re-send every master after its rule changed

"Missing" is asked of the deployed site (HEAD /img/w192/<file>), so no bucket credentials are
needed to plan; the master is uploaded before the thumbnail, so a served thumbnail implies a
stored master; the upload itself goes through `wrangler r2 object put`, which uses the Wrangler login
locally or CLOUDFLARE_API_TOKEN in CI (plan decision D30). Only 200 and 404 are answers: any
other status stops the run rather than being read as "missing".
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

from thumbnail import MASTER_PREFIX, THUMBNAIL_PREFIX
from uploads import card_keys, plan_uploads, publishable, select_renditions, upload_order

HERE = Path(__file__).resolve().parent
CARDS = HERE.parent.parent / "data" / "cards.generated.ts"
CACHE_CONTROL = "public, max-age=31536000, immutable"


def served_by(base_url: str):
    def exists(key: str) -> bool:
        req = urllib.request.Request(f"{base_url.rstrip('/')}/img/{THUMBNAIL_PREFIX}{key}", method="HEAD", headers={"User-Agent": "gakumas-supportcards-upload/0.1"})
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                return res.status == 200
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            raise

    return exists


def put(bucket: str, key: str, path: Path) -> None:
    subprocess.run(
        ["bunx", "wrangler", "r2", "object", "put", f"{bucket}/{key}", "--file", str(path), "--content-type", "image/webp", "--cache-control", CACHE_CONTROL, "--remote"],
        check=True,
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", type=Path, default=HERE / "out", help="extract.py output directory holding master/ and w192/")
    ap.add_argument("--bucket", default="tia-assets")
    ap.add_argument("--base-url", default="https://gakumas-supportcards.tia.run")
    ap.add_argument("--cards", type=Path, default=CARDS, help="generated card data; only art of cards listed there is published")
    ap.add_argument("--dry-run", action="store_true", help="plan only; upload nothing")
    ap.add_argument("--assume-empty", action="store_true", help="skip the HEAD checks and treat every image as missing")
    ap.add_argument("--rendition", choices=["all", "master", "w192"], default="all", help="upload only this rendition of each planned card")
    args = ap.parse_args()

    found = [p.name for p in (args.dir / THUMBNAIL_PREFIX).glob("img_general_csprt-*_full.webp")]
    keys, held = publishable(found, card_keys(args.cards.read_text(encoding="utf-8")))
    if held:
        print(f"holding back {len(held)} image(s) whose card is not in the data yet: {', '.join(held)}")
    exists = (lambda _key: False) if args.assume_empty else served_by(args.base_url)
    plan = plan_uploads(keys, exists)
    print(f"{len(plan.present)} already served, {len(plan.missing)} missing")

    steps = {name: select_renditions(upload_order(name, MASTER_PREFIX, THUMBNAIL_PREFIX), args.rendition, MASTER_PREFIX, THUMBNAIL_PREFIX) for name in plan.missing}
    absent = [key for keys in steps.values() for key in keys if not (args.dir / key).is_file()]
    if absent:
        sys.exit(f"{len(absent)} file(s) to upload do not exist locally, run extract.py first: {', '.join(absent[:5])}")

    for name, keys in steps.items():
        for key in keys:
            if args.dry_run:
                print("would upload", key)
            else:
                put(args.bucket, key, args.dir / key)
                print("uploaded", key)
    return 0


if __name__ == "__main__":
    sys.exit(main())
