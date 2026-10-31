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
import re
from typing import Any

from PIL import Image

from skillcards import icon_stems_of, idol_ids
from thumbnail import SKILLCARD_OBJECT_NAME

INDEX_FORMAT_VERSION = 1
PLANS = ("sense", "logic", "anomaly")
CELL = 112
COLUMNS = 10
SHEET_PREFIX = "sheet112/"
INDEX_KEY = f"{SHEET_PREFIX}index.v{INDEX_FORMAT_VERSION}.json"
# Lossy with an exact alpha channel; chosen by measuring all 39 sheets (decision K18).
SHEET_QUALITY = 80
IDOL_ID = re.compile(r"^[a-z0-9]{4}$")


def _sheet_problem(sheet: Any) -> str | None:
    """What is wrong with one index entry, or None. Every name must be one this module could have written."""
    if not isinstance(sheet, dict):
        return "not a mapping"
    plan, idol, file, columns, assets = (sheet.get(k) for k in ("plan", "idol", "file", "columns", "assets"))
    if plan not in PLANS or not isinstance(idol, str) or not IDOL_ID.match(idol):
        return "unknown plan or idol"
    if not isinstance(file, str) or not re.fullmatch(rf"{SHEET_PREFIX}{plan}-{idol}-[0-9a-f]{{8}}\.webp", file):
        return "a file name this pipeline does not write"
    if not isinstance(columns, int) or isinstance(columns, bool) or columns < 1:
        return "columns is not a positive integer"
    if not isinstance(assets, list) or not all(isinstance(a, str) and SKILLCARD_OBJECT_NAME.match(f"{a}.unity3d") for a in assets):
        return "assets is not a list of skill card icon names"
    return None


def parse_index(text: str) -> dict[str, Any]:
    """The stored index, checked entry by entry against what this module writes; raises on anything
    else, so a damaged index is never read as "nothing is stored", nor any name in it as a stored icon."""
    index = json.loads(text)
    if not isinstance(index, dict) or index.get("formatVersion") != INDEX_FORMAT_VERSION or not isinstance(index.get("cell"), int) or not isinstance(index.get("sheets"), list):
        raise ValueError(f"sheet index: expected formatVersion {INDEX_FORMAT_VERSION}, a cell size and a list of sheets")
    seen: set[tuple[str, str]] = set()
    for sheet in index["sheets"]:
        problem = _sheet_problem(sheet)
        if problem is None and (sheet["plan"], sheet["idol"]) in seen:
            problem = "a second sheet for the same plan and idol"
        if problem is not None:
            raise ValueError(f"sheet index: {problem}: {json.dumps(sheet, ensure_ascii=False)[:200]}")
        seen.add((sheet["plan"], sheet["idol"]))
    return index


def stored_icon_names(index: dict[str, Any] | None, desired: list[dict[str, Any]]) -> set[str]:
    """The library file names (`<asset>.webp`) of the icons the stored index vouches for: those of a
    stored sheet whose plan and idol are among the `desired` sheets and whose every icon belongs on
    that same sheet under the current data. Each of them is stored as a single icon too, because a
    sheet goes up only after its icons (decision K12); an entry this data could not have produced
    vouches for nothing (decision K19). A sheet that a new card has made stale still vouches, since
    its icons are all still on it. Empty without an index."""
    if index is None:
        return set()
    allowed = {(d["plan"], d["idol"]): set(d["assets"]) for d in desired}
    trusted = [s for s in index["sheets"] if set(s["assets"]) <= allowed.get((s["plan"], s["idol"]), set())]
    return {f"{asset}.webp" for sheet in trusted for asset in sheet["assets"]}


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
