"""Naming and image rules for the owned image library (docs/adr/0003). Pure: no I/O."""

from __future__ import annotations

import io
import re

from PIL import Image

# The manifest names card art `img_general_csprt-{rarity}-{nnnn}_full.unity3d`; the library
# keeps the game's stem and swaps the extension (ADR 0003: `img_general_{assetId}_full.webp`).
OBJECT_NAME = re.compile(r"^(img_general_csprt-\d-\d{4}_full)\.unity3d$")
OBJECT_PATTERN = r"img_general_csprt-\d-\d{4}_full\.unity3d$"

# One file name, one bucket prefix per rendition. `master/` is the lossless original and is
# never served; `w192/` is the public thumbnail. A future size is a new prefix, never a rename.
MASTER_PREFIX = "master/"
THUMBNAIL_PREFIX = "w192/"

# Card textures are stored squashed at 2:1 (2048 x 1024) and the game shows them at 16:9. Every
# rendition we keep has the display shape, so no file needs a rule to look right. 192 x 108 is
# exactly twice the table's 96 x 56 cell, so the thumbnail is sharp on high-density screens.
DISPLAY_ASPECT = (16, 9)
THUMBNAIL_SIZE = (192, 108)
WEBP_QUALITY = 80


def file_name_for(object_name: str) -> str | None:
    """`img_general_csprt-3-0016_full.unity3d` -> `img_general_csprt-3-0016_full.webp`; None for anything else."""
    m = OBJECT_NAME.match(object_name)
    return f"{m.group(1)}.webp" if m else None


def display_size(size: tuple[int, int]) -> tuple[int, int]:
    """The size at which a decoded texture has the game's display shape: width kept, height set
    to 16:9 (2048 x 1024 -> 2048 x 1152)."""
    width = size[0]
    return width, round(width * DISPLAY_ASPECT[1] / DISPLAY_ASPECT[0])


def to_master(image: Image.Image) -> bytes:
    """The card art at full width in its display shape, as lossless webp (2048 x 1152 today). The
    one resample to 16:9 is deliberate (plan decision D36): a master that looked squashed until a
    rule was applied would be misused by whoever opens it next. Alpha survives only if it carries anything."""
    opaque = image.mode != "RGBA" or image.getchannel("A").getextrema()[0] == 255
    shaped = (image.convert("RGB") if opaque else image).resize(display_size(image.size), Image.LANCZOS)
    out = io.BytesIO()
    shaped.save(out, format="WEBP", lossless=True, method=4)
    return out.getvalue()


def to_thumbnail(image: Image.Image) -> bytes:
    """The card art as a 192 x 108 opaque webp."""
    thumb = image.convert("RGB").resize(THUMBNAIL_SIZE, Image.LANCZOS)
    out = io.BytesIO()
    thumb.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)
    return out.getvalue()
