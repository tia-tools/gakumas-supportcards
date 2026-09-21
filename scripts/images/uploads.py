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


def upload_order(file_name: str, master_prefix: str, thumbnail_prefix: str) -> list[str]:
    """Bucket keys to write for one card, in order. The private master goes first and the public
    thumbnail last, because "missing" is asked of the public thumbnail: a thumbnail that is served
    then always implies a master that is stored, even when a run dies between the two."""
    return [f"{master_prefix}{file_name}", f"{thumbnail_prefix}{file_name}"]


def select_renditions(keys: list[str], rendition: str, master_prefix: str, thumbnail_prefix: str) -> list[str]:
    """Keeps the order and drops the keys of the rendition that was not asked for. `rendition` is
    "all", "master" or "w192"; re-sending only masters is what a change of the master rule needs."""
    prefix = {"all": "", "master": master_prefix, "w192": thumbnail_prefix}[rendition]
    return [k for k in keys if k.startswith(prefix)]


IMMUTABLE = "public, max-age=31536000, immutable"
REVALIDATE = "private, no-cache"


def cache_control_for(key: str, master_prefix: str) -> str:
    """The Cache-Control stored with an object. R2 returns the stored header on every download,
    dashboard downloads included, so it must match how the object is allowed to change. A master
    is overwritten whenever its rule changes and must always be revalidated: with the immutable
    header a browser that had opened a master once kept showing the old bytes after a re-upload
    (2026-09-21, plan decision D37). A thumbnail never changes under its name."""
    return REVALIDATE if key.startswith(master_prefix) else IMMUTABLE
