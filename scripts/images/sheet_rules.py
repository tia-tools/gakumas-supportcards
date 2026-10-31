"""Rules for the skill card sprite sheets and their index, `sheet112/index.v1.json`. Pure: no I/O.

A sprite sheet is one WebP holding many 112 x 112 icons in a grid of a fixed number of columns, one
sheet per plan and playable idol, read by gkms-memomemo, whose page draws an icon as the sheet
positioned at that icon's cell (docs/plans/EXECPLAN_SKILLCARD_DATA_AND_ICONS.md, decisions K10-K14).
The index names every current sheet and, cell by cell, the icon it holds:

    {"formatVersion": 1, "cell": 112, "sheets": [
      {"plan": "sense", "idol": "hski", "file": "sheet112/sense-hski-1a2b3c4d.webp", "columns": 10,
       "assets": ["img_general_skillcard_act-1_001", ...]}, ...]}
"""

from __future__ import annotations

import hashlib
import io
import json
from typing import Any

from PIL import Image

from skillcards import icon_stems_of, idol_ids

INDEX_FORMAT_VERSION = 1


def parse_index(text: str) -> dict[str, Any]:
    """The stored index, checked for the shape this module writes; raises on anything else, so a
    damaged index is never read as "nothing is stored"."""
    index = json.loads(text)
    if not isinstance(index, dict) or index.get("formatVersion") != INDEX_FORMAT_VERSION or not isinstance(index.get("sheets"), list):
        raise ValueError(f"sheet index: expected formatVersion {INDEX_FORMAT_VERSION} with a list of sheets")
    for sheet in index["sheets"]:
        if not isinstance(sheet, dict) or not all(isinstance(sheet.get(k), str) for k in ("plan", "idol", "file")) or not isinstance(sheet.get("assets"), list):
            raise ValueError(f"sheet index: malformed sheet entry {json.dumps(sheet)[:200]}")
    return index


def stored_icon_names(index: dict[str, Any] | None) -> set[str]:
    """The library file names of every icon a stored sheet holds (`<asset>.webp`); empty without an index.
    Each of them is stored as a single icon too (decision K12)."""
    if index is None:
        return set()
    return {f"{asset}.webp" for sheet in index["sheets"] for asset in sheet["assets"]}


PLANS = ("sense", "logic", "anomaly")
CELL = 112
COLUMNS = 10
SHEET_PREFIX = "sheet112/"
INDEX_KEY = f"{SHEET_PREFIX}index.v{INDEX_FORMAT_VERSION}.json"
# Lossy with an exact alpha channel; chosen in Milestone 4 by measuring all 39 sheets (decision K10).
SHEET_QUALITY = 80


def desired_sheets(data: dict[str, Any]) -> list[dict[str, Any]]:
    """The sheets the skill card data calls for, without file names: per plan and playable idol, the
    icons of that plan's cards and of the free ones, in the cards' order (the data's), each card once."""
    idols = idol_ids(data)
    cards: list[dict[str, Any]] = []
    for card in data["cards"]:
        if all(c["id"] != card["id"] for c in cards):
            cards.append(card)
    return [
        {"plan": plan, "idol": idol, "columns": COLUMNS, "assets": [stem for c in cards if c["plan"] in (plan, "free") for stem in icon_stems_of(c, [idol])]}
        for plan in PLANS
        for idol in idols
    ]


def stored_entry(index: dict[str, Any] | None, plan: str, idol: str) -> dict[str, Any] | None:
    if index is None:
        return None
    return next((s for s in index["sheets"] if s["plan"] == plan and s["idol"] == idol), None)


def is_stale(desired: dict[str, Any], index: dict[str, Any] | None) -> bool:
    """True when the stored index has no sheet for this plan and idol, or one laid out differently or
    holding other icons (decision K11). The bytes are never compared, so a different WebP encoder
    on another machine does not rebuild a sheet whose icons did not change."""
    stored = stored_entry(index, desired["plan"], desired["idol"])
    if stored is None or index is None or index.get("cell") != CELL:
        return True
    return stored.get("columns") != desired["columns"] or stored["assets"] != desired["assets"]


def sheet_file(plan: str, idol: str, sheet_bytes: bytes) -> str:
    """`sheet112/<plan>-<idol>-<first 8 hex digits of the sheet's SHA-256>.webp`: a name never changes meaning."""
    return f"{SHEET_PREFIX}{plan}-{idol}-{hashlib.sha256(sheet_bytes).hexdigest()[:8]}.webp"


def cell_origin(i: int, columns: int) -> tuple[int, int]:
    """The top-left pixel of cell `i`, filled row by row."""
    return (i % columns) * CELL, (i // columns) * CELL


def compose(cells: list[Image.Image], columns: int) -> Image.Image:
    """The sheet: each 112 x 112 cell at its place on a transparent canvas of `columns` columns."""
    rows = max(1, -(-len(cells) // columns))
    sheet = Image.new("RGBA", (columns * CELL, rows * CELL), (0, 0, 0, 0))
    for i, cell in enumerate(cells):
        if cell.size != (CELL, CELL):
            raise ValueError(f"cell {i} is {cell.size}, not {CELL} x {CELL}")
        sheet.paste(cell.convert("RGBA"), cell_origin(i, columns))
    return sheet


def encode(sheet: Image.Image, quality: int = SHEET_QUALITY) -> bytes:
    """The sheet as lossy WebP whose transparency is kept exactly (alpha is encoded losslessly)."""
    out = io.BytesIO()
    sheet.save(out, format="WEBP", quality=quality, alpha_quality=100, method=6)
    return out.getvalue()


def index_text(entries: list[dict[str, Any]]) -> str:
    """The index naming `entries` (each with plan, idol, file, columns and assets), one sheet per line."""
    keys = ("plan", "idol", "file", "columns", "assets")
    lines = ",\n".join("  " + json.dumps({k: e[k] for k in keys}, ensure_ascii=False, separators=(",", ":")) for e in entries)
    return f'{{"formatVersion":{INDEX_FORMAT_VERSION},"cell":{CELL},"sheets":[\n{lines}\n]}}\n'
