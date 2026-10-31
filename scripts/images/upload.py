"""
Uploads the images the deployed image library does not have yet: per file a private lossless
master (bucket prefix master/, never served) and the public rendition — the card thumbnail (w192/),
the P-item icon (w48/) or the skill card icon (w112/).

    uv run upload.py --dry-run              # show what is missing, upload nothing
    uv run upload.py                        # upload the missing ones
    uv run upload.py --assume-empty         # first run, before the Worker is deployed
    uv run upload.py --assume-empty --rendition master   # re-send every master after its rule changed

"Missing" is asked of the deployed site (HEAD /img/<prefix>/<file>), so no bucket credentials are
needed to plan; a skill card icon that the stored sprite sheet index names is known to be stored
and is not asked about (decision K12 of docs/plans/EXECPLAN_SKILLCARD_DATA_AND_ICONS.md). The
master is uploaded before the public rendition, so a served rendition implies a stored master; the upload itself goes through `wrangler r2 object put`, which uses the Wrangler login
locally or CLOUDFLARE_API_TOKEN in CI (plan decision D30). Only 200 and 404 are answers: any
other status stops the run rather than being read as "missing".
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from deployed_site import DEFAULT_BASE_URL, served_by, stored_sheet_index

from r2 import put
from sheet_rules import parse_index, stored_icon_names
from thumbnail import ICON_PREFIX, MASTER_PREFIX, SKILLCARD_PREFIX, THUMBNAIL_PREFIX, public_prefix_for
from uploads import cache_control_for, known_or_served, plan_uploads, publishable, published_keys, select_renditions, upload_order

HERE = Path(__file__).resolve().parent
CARDS = HERE.parent.parent / "data" / "cards.generated.ts"
SKILLCARDS = HERE.parent.parent / "data" / "skillcards.generated.ts"


def nothing_stored(_file_name: str) -> bool:
    """`exists` for --assume-empty: every file counts as missing."""
    return False


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", type=Path, default=HERE / "out", help="extract.py output directory holding master/, w192/, w48/ and w112/")
    ap.add_argument("--bucket", default="tia-assets")
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL)
    ap.add_argument("--cards", type=Path, default=CARDS, help="generated card data; only art and item icons of cards listed there are published")
    ap.add_argument("--skillcards", type=Path, default=SKILLCARDS, help="generated skill card data; only icons of skill cards listed there are published")
    ap.add_argument("--dry-run", action="store_true", help="plan only; upload nothing")
    ap.add_argument("--assume-empty", action="store_true", help="skip the HEAD checks and treat every image as missing")
    ap.add_argument("--rendition", choices=["all", "master", "w192", "w48", "w112"], default="all", help="upload only this rendition of each planned file")
    args = ap.parse_args()

    found = (
        [p.name for p in (args.dir / THUMBNAIL_PREFIX).glob("img_general_csprt-*_full.webp")]
        + [p.name for p in (args.dir / ICON_PREFIX).glob("img_general_pitem_*.webp")]
        + [p.name for p in (args.dir / SKILLCARD_PREFIX).glob("img_general_skillcard_*.webp")]
    )
    keys, held = publishable(found, published_keys(args.cards.read_text(encoding="utf-8"), args.skillcards.read_text(encoding="utf-8")))
    if held:
        print(f"holding back {len(held)} image(s) whose card is not in the data yet: {', '.join(held[:20])}{', …' if len(held) > 20 else ''}")
    if args.assume_empty:
        exists = nothing_stored
    else:
        index_text = stored_sheet_index(args.base_url)
        exists = known_or_served(stored_icon_names(parse_index(index_text) if index_text is not None else None), served_by(args.base_url))
    plan = plan_uploads(keys, exists)
    print(f"{len(plan.present)} already served, {len(plan.missing)} missing")

    steps = {name: select_renditions(upload_order(name, MASTER_PREFIX, public_prefix_for(name)), args.rendition, MASTER_PREFIX, THUMBNAIL_PREFIX, ICON_PREFIX, SKILLCARD_PREFIX) for name in plan.missing}
    absent = [key for keys in steps.values() for key in keys if not (args.dir / key).is_file()]
    if absent:
        sys.exit(f"{len(absent)} file(s) to upload do not exist locally, run extract.py first: {', '.join(absent[:5])}")

    for name, keys in steps.items():
        for key in keys:
            if args.dry_run:
                print("would upload", key)
            else:
                put(args.bucket, key, args.dir / key, "image/webp", cache_control_for(key, MASTER_PREFIX))
                print("uploaded", key)
    return 0


if __name__ == "__main__":
    sys.exit(main())
