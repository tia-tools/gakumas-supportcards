"""
Downloads support card art from the game's asset servers and writes, per card, a lossless
full-size master (out/master/) and a 192 x 108 webp thumbnail (out/w192/), named for the owned
image library (docs/adr/0003).

    uv run extract.py                       # every card that lacks a master or a thumbnail
    uv run extract.py --only 'csprt-3-0016' --force

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
from thumbnail import MASTER_PREFIX, OBJECT_PATTERN, THUMBNAIL_PREFIX, file_name_for, to_master, to_thumbnail

HERE = Path(__file__).resolve().parent
VENDOR = HERE / "vendor" / "GkmasObjectManager"


def load_manifest():
    if not (VENDOR / "GkmasObjectManager" / "__init__.py").is_file():
        sys.exit(f"GkmasObjectManager checkout not found at {VENDOR}; see scripts/images/README.md § Setup.")
    sys.path.insert(0, str(VENDOR))
    import GkmasObjectManager as gom  # importable only after the path insert above

    return gom.fetch()


def select(manifest, only: str | None, limit: int | None, out_dirs: list[Path], force: bool) -> list[str]:
    """Manifest names of card art to process: matching --only, lacking any rendition unless --force."""
    names = [o.name for o in manifest.search(OBJECT_PATTERN) if file_name_for(o.name)]
    if only:
        names = [n for n in names if re.search(only, n)]
    if not force:
        names = [n for n in names if not all((d / str(file_name_for(n))).exists() for d in out_dirs)]
    return names[:limit] if limit else names


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=HERE / "out", help="working directory (default: scripts/images/out)")
    ap.add_argument("--only", help="regex; process only manifest names it matches")
    ap.add_argument("--limit", type=int, help="process at most this many images")
    ap.add_argument("--force", action="store_true", help="re-convert images whose master and thumbnail already exist")
    args = ap.parse_args()

    raw_dir = args.out / "raw"
    master_dir, thumb_dir = args.out / MASTER_PREFIX.rstrip("/"), args.out / THUMBNAIL_PREFIX.rstrip("/")
    for d in (master_dir, thumb_dir):
        d.mkdir(parents=True, exist_ok=True)

    manifest = load_manifest()
    names = select(manifest, args.only, args.limit, [master_dir, thumb_dir], args.force)
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
            (master_dir / file_name).write_bytes(to_master(image))
            (thumb_dir / file_name).write_bytes(to_thumbnail(image))
        except (OSError, DecodeError) as e:
            failures.append(f"{name}: {type(e).__name__}: {e}")

    print(f"converted {len(names) - len(failures)} of {len(names)} into {master_dir} and {thumb_dir}")
    for f in failures:
        print("FAILED", f, file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
