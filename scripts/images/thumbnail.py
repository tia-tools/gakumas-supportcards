"""Naming and image rules for the owned image library (docs/adr/0003). Pure: no I/O."""

from __future__ import annotations

import io
import re

from PIL import Image

# The manifest names card art `img_general_csprt-{rarity}-{nnnn}_full.unity3d`; the library
# keeps the game's stem and swaps the extension (ADR 0003: `img_general_{assetId}_full.webp`).
OBJECT_NAME = re.compile(r"^(img_general_csprt-\d-\d{4}_full)\.unity3d$")
OBJECT_PATTERN = r"img_general_csprt-\d-\d{4}_full\.unity3d$"

# P-item icons are `img_general_pitem_{r}-{nnn}.unity3d` (no `_full`), a 256 x 256 RGBA texture
# with real transparency; the library keeps the stem too (`img_general_pitem_2-004.webp`).
# Milestone 4 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md, finding F7.
ITEM_OBJECT_NAME = re.compile(r"^(img_general_pitem_\d-\d{3})\.unity3d$")
ITEM_PATTERN = r"img_general_pitem_\d-\d{3}\.unity3d$"
ITEM_STEM = "img_general_pitem_"

# Skill card icons are `img_general_skillcard_{kind}-{n}_{nnn}.unity3d`, with `-{idol id}` for the
# variant drawn for one P-idol: a 256 x 256 RGBA texture with transparent rounded corners. The
# library keeps the stem (`img_general_skillcard_act-3_029-hski.webp`); gkms-memomemo reads them
# (docs/plans/EXECPLAN_SKILLCARD_DATA_AND_ICONS.md, decision K9).
SKILLCARD_OBJECT_NAME = re.compile(r"^(img_general_skillcard_(?:act|men|ido)-\d+_\d{3}(?:-[a-z0-9]{4})?)\.unity3d$")
SKILLCARD_PATTERN = r"img_general_skillcard_(?:act|men|ido)-\d+_\d{3}(?:-[a-z0-9]{4})?\.unity3d$"
SKILLCARD_STEM = "img_general_skillcard_"

# One file name, one bucket prefix per rendition. `master/` is the lossless original and is
# never served; `w192/` is the public card thumbnail, `w48/` the public item icon and `w112/` the
# public skill card icon. A future size is a new prefix, never a rename.
MASTER_PREFIX = "master/"
THUMBNAIL_PREFIX = "w192/"
ICON_PREFIX = "w48/"
SKILLCARD_PREFIX = "w112/"

# Card textures are stored squashed at 2:1 (2048 x 1024) and the game shows them at 16:9. Every
# rendition we keep has the display shape, so no file needs a rule to look right. 192 x 108 is
# exactly twice the table's 96 x 56 cell, so the thumbnail is sharp on high-density screens.
DISPLAY_ASPECT = (16, 9)
THUMBNAIL_SIZE = (192, 108)
# Item icons are square and sit on the panel's background, so the icon keeps its transparency;
# 48 x 48 is twice the row's height.
ICON_SIZE = (48, 48)
# A skill card icon is shown at 56 px in gkms-memomemo, so 112 is twice that; the textures are 256 wide.
SKILLCARD_ICON_SIZE = (112, 112)
WEBP_QUALITY = 80


def file_name_for(object_name: str) -> str | None:
    """`img_general_csprt-3-0016_full.unity3d` -> `img_general_csprt-3-0016_full.webp`,
    `img_general_pitem_2-004.unity3d` -> `img_general_pitem_2-004.webp` and
    `img_general_skillcard_act-3_029-hski.unity3d` -> `img_general_skillcard_act-3_029-hski.webp`;
    None for anything else."""
    m = OBJECT_NAME.match(object_name) or ITEM_OBJECT_NAME.match(object_name) or SKILLCARD_OBJECT_NAME.match(object_name)
    return f"{m.group(1)}.webp" if m else None


def is_item(file_name: str) -> bool:
    """True for a P-item icon's library file name, False for card art."""
    return file_name.startswith(ITEM_STEM)


def is_skillcard(file_name: str) -> bool:
    """True for a skill card icon's library file name."""
    return file_name.startswith(SKILLCARD_STEM)


def public_prefix_for(file_name: str) -> str:
    """The bucket prefix the site serves this file from: `w48/` for an item icon, `w112/` for a skill
    card icon, `w192/` for card art."""
    if is_skillcard(file_name):
        return SKILLCARD_PREFIX
    return ICON_PREFIX if is_item(file_name) else THUMBNAIL_PREFIX


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


def to_item_master(image: Image.Image) -> bytes:
    """An icon as stored (a P-item's or a skill card's, 256 x 256 today), lossless, transparency
    kept: an icon is square and shown on a background, so unlike card art nothing is reshaped or
    flattened."""
    out = io.BytesIO()
    image.convert("RGBA").save(out, format="WEBP", lossless=True, method=4)
    return out.getvalue()


def to_icon(image: Image.Image) -> bytes:
    """The item icon as a 48 x 48 webp with transparency."""
    icon = image.convert("RGBA").resize(ICON_SIZE, Image.LANCZOS)
    out = io.BytesIO()
    icon.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)
    return out.getvalue()


def skillcard_cell(image: Image.Image) -> Image.Image:
    """A skill card icon at 112 x 112 with its transparency: the `w112/` rendition before encoding,
    and the cell of a sprite sheet (decision K10), so both show the same pixels."""
    return image.convert("RGBA").resize(SKILLCARD_ICON_SIZE, Image.LANCZOS)


def to_skillcard_icon(image: Image.Image) -> bytes:
    """The skill card icon as a 112 x 112 webp with transparency."""
    out = io.BytesIO()
    skillcard_cell(image).save(out, format="WEBP", quality=WEBP_QUALITY, method=6)
    return out.getvalue()


def master_rendition(file_name: str, image: Image.Image) -> bytes:
    """The private lossless rendition for this file: the reshaped card master, or an icon's master
    for a P-item or a skill card."""
    return to_item_master(image) if is_item(file_name) or is_skillcard(file_name) else to_master(image)


def public_rendition(file_name: str, image: Image.Image) -> bytes:
    """The served rendition for this file: the card thumbnail, the item icon or the skill card icon."""
    if is_skillcard(file_name):
        return to_skillcard_icon(image)
    return to_icon(image) if is_item(file_name) else to_thumbnail(image)
