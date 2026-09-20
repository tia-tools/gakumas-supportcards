"""Naming and thumbnail rules for the owned image library (docs/adr/0003). Pure: no I/O."""

from __future__ import annotations

import io
import re

from PIL import Image

# The manifest names card art `img_general_csprt-{rarity}-{nnnn}_full.unity3d`; the library key
# keeps the game's stem and swaps the extension (ADR 0003: `img_general_{assetId}_full.webp`).
OBJECT_NAME = re.compile(r"^(img_general_csprt-\d-\d{4}_full)\.unity3d$")
OBJECT_PATTERN = r"img_general_csprt-\d-\d{4}_full\.unity3d$"

# Card textures are stored squashed at 2:1 and are meant to be shown at 16:9. 192 x 108 is
# exactly twice the table's 96 x 56 cell, so the thumbnail is sharp on high-density screens.
THUMBNAIL_SIZE = (192, 108)
WEBP_QUALITY = 80


def key_for(object_name: str) -> str | None:
    """`img_general_csprt-3-0016_full.unity3d` -> `img_general_csprt-3-0016_full.webp`; None for anything else."""
    m = OBJECT_NAME.match(object_name)
    return f"{m.group(1)}.webp" if m else None


def to_thumbnail(image: Image.Image) -> bytes:
    """The card art as a 192 x 108 opaque webp."""
    thumb = image.convert("RGB").resize(THUMBNAIL_SIZE, Image.LANCZOS)
    out = io.BytesIO()
    thumb.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)
    return out.getvalue()
