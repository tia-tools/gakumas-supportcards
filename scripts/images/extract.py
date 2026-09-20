"""
Downloads support card art from the game's asset servers and writes 192 x 108 webp thumbnails
named for the owned image library (docs/adr/0003).

    uv run extract.py                       # everything not yet in out/webp
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
from thumbnail import OBJECT_PATTERN, key_for, to_thumbnail

HERE = Path(__file__).resolve().parent
VENDOR = HERE / "vendor" / "GkmasObjectManager"


def load_manifest():
    if not (VENDOR / "GkmasObjectManager" / "__init__.py").is_file():
        sys.exit(f"GkmasObjectManager checkout not found at {VENDOR}; see scripts/images/README.md § Setup.")
    sys.path.insert(0, str(VENDOR))
    import GkmasObjectManager as gom  # importable only after the path insert above

    return gom.fetch()


def select(manifest, only: str | None, limit: int | None, webp_dir: Path, force: bool) -> list[str]:
    """Manifest names of card art to process: matching --only, not yet converted unless --force."""
    names = [o.name for o in manifest.search(OBJECT_PATTERN) if key_for(o.name)]
    if only:
        names = [n for n in names if re.search(only, n)]
    if not force:
        names = [n for n in names if not (webp_dir / str(key_for(n))).exists()]
    return names[:limit] if limit else names


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=HERE / "out", help="working directory (default: scripts/images/out)")
    ap.add_argument("--only", help="regex; process only manifest names it matches")
    ap.add_argument("--limit", type=int, help="process at most this many images")
    ap.add_argument("--force", action="store_true", help="re-convert images that already exist in out/webp")
    args = ap.parse_args()

    raw_dir, webp_dir = args.out / "raw", args.out / "webp"
    webp_dir.mkdir(parents=True, exist_ok=True)

    manifest = load_manifest()
    names = select(manifest, args.only, args.limit, webp_dir, args.force)
    print(f"manifest {manifest.version}: {len(names)} image(s) to process")
    if not names:
        return 0

    # convert_image=False keeps the raw bundle; the library skips files that already exist.
    manifest.download(*[re.escape(n) + "$" for n in names], path=str(raw_dir), categorize=False, convert_image=False)

    failures: list[str] = []
    for name in names:
        try:
            raw = (raw_dir / name).read_bytes()
            (webp_dir / str(key_for(name))).write_bytes(to_thumbnail(decode_texture(raw)))
        except (OSError, DecodeError) as e:
            failures.append(f"{name}: {type(e).__name__}: {e}")

    print(f"converted {len(names) - len(failures)} of {len(names)} into {webp_dir}")
    for f in failures:
        print("FAILED", f, file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
