"""Which thumbnails need uploading. Pure: existence checks and uploads are passed in."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Iterable

ASSET_ID = re.compile(r'"assetId":"(csprt-\d-\d{4})"')
# A card's granted P-items carry the icon's asset id, which already starts with `img_general_`
# (Milestone 4 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md).
ITEM_ASSET_ID = re.compile(r'"assetId":"(img_general_pitem_\d-\d{3})"')


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


def item_keys(cards_source: str) -> set[str]:
    """Library keys of the P-item icons the cards in `data/cards.generated.ts` grant; the same rule
    as for card art — an icon goes out only with a released card that lists the item."""
    return {f"{asset_id}.webp" for asset_id in ITEM_ASSET_ID.findall(cards_source)}


def library_keys(cards_source: str) -> set[str]:
    """Every file the library may publish for the cards in the data: their art and their items' icons."""
    return card_keys(cards_source) | item_keys(cards_source)


def publishable(keys: Iterable[str], allowed: set[str]) -> tuple[list[str], list[str]]:
    """(keys to consider, keys held back because no card in the data uses them), both sorted."""
    ks = sorted(set(keys))
    return [k for k in ks if k in allowed], [k for k in ks if k not in allowed]


def upload_order(file_name: str, master_prefix: str, public_prefix: str) -> list[str]:
    """Bucket keys to write for one file, in order. The private master goes first and the public
    rendition (the card thumbnail or the item icon) last, because "missing" is asked of the public
    rendition: one that is served then always implies a master that is stored, even when a run
    dies between the two."""
    return [f"{master_prefix}{file_name}", f"{public_prefix}{file_name}"]


def select_renditions(keys: list[str], rendition: str, master_prefix: str, thumbnail_prefix: str, icon_prefix: str) -> list[str]:
    """Keeps the order and drops the keys of the renditions that were not asked for. `rendition`
    is "all", "master", "w192" or "w48"; re-sending only masters is what a change of the master
    rule needs."""
    prefix = {"all": "", "master": master_prefix, "w192": thumbnail_prefix, "w48": icon_prefix}[rendition]
    return [k for k in keys if k.startswith(prefix)]


IMMUTABLE = "public, max-age=31536000, immutable"
REVALIDATE = "private, no-cache"


def cache_control_for(key: str, master_prefix: str) -> str:
    """The Cache-Control stored with an object. R2 returns the stored header on every download,
    dashboard downloads included, so it must match how the object is allowed to change. A master
    is overwritten whenever its rule changes and must always be revalidated: with the immutable
    header a browser that had opened a master once kept showing the old bytes after a re-upload
    (2026-09-21, plan decision D37). A thumbnail or icon never changes under its name."""
    return REVALIDATE if key.startswith(master_prefix) else IMMUTABLE


def missing_file_names(file_names: Iterable[str], allowed: set[str], exists: Callable[[str], bool]) -> list[str]:
    """Of the card art and item icons the game offers, what the site should have and does not:
    files of cards in the data (D32) whose public rendition is not served. This is what an
    unattended run downloads, so it never fetches unreleased art and never refetches what is
    already published."""
    keep, _held_back = publishable(file_names, allowed)
    return list(plan_uploads(keep, exists).missing)
