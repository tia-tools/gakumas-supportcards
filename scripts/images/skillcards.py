"""The skill card data as the image pipeline needs it: which icons the published pool uses. Pure: no I/O.

`data/skillcards.generated.ts` is TypeScript whose object literal is also JSON
(scripts/lib/emit.ts `emitSkillCards`, pinned by data/skillcard-data-file.test.ts), so it is read by
cutting the text from the first `{` after `export const SKILL_CARD_DATA` to the last `}`. Only icons
of cards in that data are ever published, because the manifest carries art of cards not released
yet (docs/plans/EXECPLAN_SKILLCARD_DATA_AND_ICONS.md, decision K4).
"""

from __future__ import annotations

import json
from typing import Any

MARKER = "export const SKILL_CARD_DATA"


def read_skill_card_data(module_text: str) -> dict[str, Any]:
    """The data exported by data/skillcards.generated.ts."""
    start = module_text.index("{", module_text.index(MARKER))
    data = json.loads(module_text[start : module_text.rindex("}") + 1])
    if not isinstance(data, dict) or data.get("formatVersion") != 1:
        raise ValueError("data/skillcards.generated.ts: expected an object with formatVersion 1")
    return data


def idol_ids(data: dict[str, Any]) -> list[str]:
    """The playable idols' ids, in the game's order."""
    return [idol["id"] for idol in data["idols"]]


def icon_stems_of(card: dict[str, Any], idols: list[str]) -> list[str]:
    """The asset names of one card's icons: one per playable idol when its art varies by idol, else one."""
    asset = card["art"]["asset"]
    return [f"{asset}-{idol}" for idol in idols] if card["art"]["perIdol"] else [asset]


def icon_stems(data: dict[str, Any]) -> list[str]:
    """Every icon the pool uses, as asset names without extension, sorted; levels 0 and 1 of a card share theirs."""
    idols = idol_ids(data)
    return sorted({stem for card in data["cards"] for stem in icon_stems_of(card, idols)})


def icon_file_names(data: dict[str, Any]) -> set[str]:
    """The library file names of those icons (`<asset name>.webp`)."""
    return {f"{stem}.webp" for stem in icon_stems(data)}
