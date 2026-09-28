"""
Downloads support card art and P-item icons from the game's asset servers and writes, per file,
a lossless master (out/master/) and the served rendition — a 192 x 108 webp thumbnail
(out/w192/) for a card, a 48 x 48 webp icon with transparency (out/w48/) for an item — named
for the owned image library (docs/adr/0003; items: Milestone 4 of
docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md).

    uv run extract.py                       # every card or item that lacks a master or its served rendition
    uv run extract.py --only 'csprt-3-0016' --force
    uv run extract.py --only 'pitem_2-004'
    uv run extract.py --only-missing        # only files of cards in the data that the deployed site lacks

GkmasObjectManager (GPL-3.0, not a package) is used only for what it does well: fetching and
decrypting the manifest and downloading de-obfuscated bundles. Decoding and resizing are ours
(decode.py, thumbnail.py) because its converter hard-codes a stale Unity version and falls back
to a raw dump without failing. See README.md for how to fetch the pinned checkout.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from decode import DecodeError, decode_texture
from deployed_site import DEFAULT_BASE_URL, served_by
from thumbnail import ICON_PREFIX, ITEM_PATTERN, MASTER_PREFIX, OBJECT_PATTERN, THUMBNAIL_PREFIX, file_name_for, master_rendition, public_prefix_for, public_rendition
from uploads import library_keys, missing_file_names

HERE = Path(__file__).resolve().parent
CARDS = HERE.parent.parent / "data" / "cards.generated.ts"
VENDOR = HERE / "vendor" / "GkmasObjectManager"


def load_manifest():
    if not (VENDOR / "GkmasObjectManager" / "__init__.py").is_file():
        sys.exit(f"GkmasObjectManager checkout not found at {VENDOR}; see scripts/images/README.md § Setup.")
    sys.path.insert(0, str(VENDOR))
    import GkmasObjectManager as gom  # importable only after the path insert above

    return gom.fetch()


def offered(manifest) -> list[str]:
    """Manifest names of every card art and item icon the game offers."""
    return [o.name for pattern in (OBJECT_PATTERN, ITEM_PATTERN) for o in manifest.search(pattern) if file_name_for(o.name)]


def rendition_paths(out: Path, file_name: str) -> tuple[Path, Path]:
    """Where the master and the served rendition of `file_name` live under `out`."""
    return out / MASTER_PREFIX / file_name, out / public_prefix_for(file_name) / file_name


def select(manifest, only: str | None, limit: int | None, out: Path, force: bool, wanted: set[str] | None = None) -> list[str]:
    """Manifest names to process: matching --only, lacking their master or served rendition unless
    --force, and, when `wanted` is given, only those whose library file name is in it."""
    names = offered(manifest)
    if wanted is not None:
        names = [n for n in names if file_name_for(n) in wanted]
    if only:
        names = [n for n in names if re.search(only, n)]
    if not force:
        names = [n for n in names if not all(p.exists() for p in rendition_paths(out, str(file_name_for(n))))]
    return names[:limit] if limit else names


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=HERE / "out", help="working directory (default: scripts/images/out)")
    ap.add_argument("--only", help="regex; process only manifest names it matches")
    ap.add_argument("--limit", type=int, help="process at most this many images")
    ap.add_argument("--force", action="store_true", help="re-convert images whose master and served rendition already exist")
    ap.add_argument("--only-missing", action="store_true", help="process only files of released cards that the deployed site does not serve (what an unattended run needs)")
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL, help="the deployed site asked by --only-missing")
    ap.add_argument("--cards", type=Path, default=CARDS, help="generated card data; --only-missing never fetches art or an icon of a card that is not in it")
    args = ap.parse_args()

    raw_dir = args.out / "raw"
    for prefix in (MASTER_PREFIX, THUMBNAIL_PREFIX, ICON_PREFIX):
        (args.out / prefix.rstrip("/")).mkdir(parents=True, exist_ok=True)

    manifest = load_manifest()
    wanted = None
    if args.only_missing:
        files = [str(file_name_for(n)) for n in offered(manifest)]
        wanted = set(missing_file_names(files, library_keys(args.cards.read_text(encoding="utf-8")), served_by(args.base_url)))
        print(f"{len(wanted)} file(s) of released cards are not served by {args.base_url}")
    names = select(manifest, args.only, args.limit, args.out, args.force, wanted)
    print(f"manifest {manifest.version}: {len(names)} image(s) to process")
    if not names:
        return 0

    # convert_image=False keeps the raw bundle; the library skips files that already exist.
    manifest.download(*[re.escape(n) + "$" for n in names], path=str(raw_dir), categorize=False, convert_image=False)

    failures: list[str] = []
    for name in names:
        try:
            image = decode_texture((raw_dir / name).read_bytes())
            file_name = str(file_name_for(name))
            master_path, public_path = rendition_paths(args.out, file_name)
            master_path.write_bytes(master_rendition(file_name, image))
            public_path.write_bytes(public_rendition(file_name, image))
        except (OSError, DecodeError) as e:
            failures.append(f"{name}: {type(e).__name__}: {e}")

    print(f"converted {len(names) - len(failures)} of {len(names)} into {args.out / MASTER_PREFIX.rstrip('/')}, {args.out / THUMBNAIL_PREFIX.rstrip('/')} and {args.out / ICON_PREFIX.rstrip('/')}")
    for f in failures:
        print("FAILED", f, file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
