"""
Builds the skill card sprite sheets gkms-memomemo draws its icons from, one per plan and playable
idol, uploads those that are stale and then the index naming them, `sheet112/index.v1.json`
(docs/plans/EXECPLAN_SKILLCARD_DATA_AND_ICONS.md, decisions K10-K14; rules in sheet_rules.py).

    uv run sheets.py --dry-run              # which sheets are stale; builds them into out/sheet112/, uploads nothing
    uv run sheets.py                        # build and upload the stale sheets, then the index
    uv run sheets.py --rebuild              # every sheet, after a change of the size, quality or layout

A sheet is stale when the stored index (read from the deployed site) has no entry for its plan and
idol, or one with other icons or another layout. Cells are made from the lossless masters in
out/master/, so run extract.py first; a missing master stops the run before anything is uploaded,
since a sheet without that icon would be published as if it were complete. Every icon of a sheet
must already be stored as a single icon (upload.py) before the sheet goes up, and the index goes up
last, so the index never names a sheet that is not stored, and every icon it names is stored too.
Sheets the index stops naming stay in the bucket.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

from PIL import Image

from deployed_site import DEFAULT_BASE_URL, served_by, stored_sheet_index
from r2 import put
from sheet_rules import INDEX_KEY, SHEET_QUALITY, compose, desired_sheets, encode, index_text, is_stale, parse_index, sheet_file, stored_entry, stored_icon_names
from skillcards import read_skill_card_data
from thumbnail import MASTER_PREFIX, skillcard_cell
from uploads import IMMUTABLE, known_or_served

HERE = Path(__file__).resolve().parent
SKILLCARDS = HERE.parent.parent / "data" / "skillcards.generated.ts"
INDEX_CACHE_CONTROL = "no-cache"


def build(desired: dict[str, Any], out: Path, quality: int) -> tuple[dict[str, Any], Path]:
    """Composes one sheet from the local masters, writes it under out/ by its content name, and
    returns its index entry and the local file."""
    cells = [skillcard_cell(Image.open(out / MASTER_PREFIX / f"{asset}.webp")) for asset in desired["assets"]]
    sheet_bytes = encode(compose(cells, desired["columns"]), quality)
    entry = {**desired, "file": sheet_file(desired["plan"], desired["idol"], sheet_bytes)}
    path = out / entry["file"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(sheet_bytes)
    print(f"built {entry['file']}: {len(cells)} icons, {len(sheet_bytes):,} bytes")
    return entry, path


def missing_masters(stale: list[dict[str, Any]], out: Path) -> list[str]:
    return sorted({asset for d in stale for asset in d["assets"] if not (out / MASTER_PREFIX / f"{asset}.webp").is_file()})


def upload_all(args: argparse.Namespace, built: list[tuple[dict[str, Any], Path]], index_path: Path, stored: dict[str, Any] | None) -> None:
    """Each sheet, once every icon it holds is stored as a single icon; then the index."""
    exists = known_or_served(stored_icon_names(stored), served_by(args.base_url))
    unstored = sorted({asset for entry, _ in built for asset in entry["assets"] if not exists(f"{asset}.webp")})
    if unstored:
        sys.exit(f"{len(unstored)} icon(s) of these sheets are not stored as single icons yet; run upload.py first: {', '.join(unstored[:5])}")
    for entry, path in built:
        put(args.bucket, entry["file"], path, "image/webp", IMMUTABLE)
        print("uploaded", entry["file"])
    put(args.bucket, INDEX_KEY, index_path, "application/json", INDEX_CACHE_CONTROL)
    print("uploaded", INDEX_KEY)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", type=Path, default=HERE / "out", help="extract.py output directory; sheets are written under its sheet112/")
    ap.add_argument("--bucket", default="tia-assets")
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL, help="the deployed site whose stored index is compared")
    ap.add_argument("--skillcards", type=Path, default=SKILLCARDS, help="generated skill card data: the sheets hold the icons of its cards")
    ap.add_argument("--dry-run", action="store_true", help="build the stale sheets and the index locally; upload nothing")
    ap.add_argument("--rebuild", action="store_true", help="treat every sheet as stale")
    ap.add_argument("--quality", type=int, default=SHEET_QUALITY, help="WebP quality of the sheets")
    args = ap.parse_args()

    desired = desired_sheets(read_skill_card_data(args.skillcards.read_text(encoding="utf-8")))
    stored_text = stored_sheet_index(args.base_url)
    stored = parse_index(stored_text) if stored_text is not None else None
    stale = desired if args.rebuild else [d for d in desired if is_stale(d, stored)]
    print(f"{len(desired) - len(stale)} sheet(s) current, {len(stale)} stale")
    if not stale:
        return 0
    absent = missing_masters(stale, args.dir)
    if absent:
        sys.exit(f"{len(absent)} icon master(s) these sheets need are not in {args.dir / MASTER_PREFIX}; run extract.py first: {', '.join(absent[:5])}")

    built = [build(d, args.dir, args.quality) for d in stale]
    by_key = {(e["plan"], e["idol"]): e for e, _ in built}
    entries = [by_key.get((d["plan"], d["idol"])) or stored_entry(stored, d["plan"], d["idol"]) for d in desired]
    index_path = args.dir / INDEX_KEY
    index_path.write_text(index_text([e for e in entries if e is not None]), encoding="utf-8")
    if args.dry_run:
        print(f"would upload {len(built)} sheet(s), then {INDEX_KEY} ({index_path})")
        return 0
    upload_all(args, built, index_path, stored)
    return 0


if __name__ == "__main__":
    sys.exit(main())
