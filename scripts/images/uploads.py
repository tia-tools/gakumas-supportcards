"""Which thumbnails need uploading. Pure: existence checks and uploads are passed in."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Iterable

ASSET_ID = re.compile(r'"assetId":"(csprt-\d-\d{4})"')


@dataclass(frozen=True)
class UploadPlan:
    missing: tuple[str, ...]
    present: tuple[str, ...]


def plan_uploads(keys: Iterable[str], exists: Callable[[str], bool]) -> UploadPlan:
    """Keys sorted; `exists(key)` says whether the deployed library already serves it."""
    missing: list[str] = []
    present: list[str] = []
    for key in sorted(set(keys)):
        (present if exists(key) else missing).append(key)
    return UploadPlan(tuple(missing), tuple(present))


def card_keys(cards_source: str) -> set[str]:
    """Library keys of the cards in `data/cards.generated.ts`. Only these are published: the game's
    manifest carries art for cards that are not released yet, and those must not go out early."""
    return {f"img_general_{asset_id}_full.webp" for asset_id in ASSET_ID.findall(cards_source)}


def publishable(keys: Iterable[str], allowed: set[str]) -> tuple[list[str], list[str]]:
    """(keys to consider, keys held back because no card in the data uses them), both sorted."""
    ks = sorted(set(keys))
    return [k for k in ks if k in allowed], [k for k in ks if k not in allowed]
