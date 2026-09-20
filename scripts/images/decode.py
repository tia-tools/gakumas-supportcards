"""
Decodes a support card asset bundle into an image.

The bundles have their Unity version stripped, so UnityPy parses them with a fallback version,
and the right one depends on which engine the game used when the bundle was built. A wrong
version does not fail: it yields a Texture2D with absurd dimensions and no stream path. So each
candidate is tried in order and the first parse that looks like a real texture wins (see
docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md, Surprises, 2026-09-20).
"""

from __future__ import annotations

from typing import Any, Callable, Sequence

from PIL import Image

# Newest engine first: current bundles need the Unity 6 layout, older ones the 2022 layout.
UNITY_VERSIONS: tuple[str, ...] = ("6000.0.23f1", "2022.3.21f1")
MAX_DIMENSION = 8192


class DecodeError(Exception):
    """No candidate Unity version produced a plausible texture."""


def is_plausible(width: int, height: int) -> bool:
    return 0 < width <= MAX_DIMENSION and 0 < height <= MAX_DIMENSION


def _load_with_unitypy(raw: bytes, version: str) -> Any:
    import UnityPy

    UnityPy.config.FALLBACK_UNITY_VERSION = version
    env = UnityPy.load(raw)
    textures = [obj.read() for obj in env.container.values()]
    if not textures:
        raise ValueError("bundle contains no objects")
    return max(textures, key=lambda t: t.m_Width * t.m_Height if is_plausible(t.m_Width, t.m_Height) else 0)


def decode_texture(
    raw: bytes,
    versions: Sequence[str] = UNITY_VERSIONS,
    load: Callable[[bytes, str], Any] = _load_with_unitypy,
) -> Image.Image:
    """The bundle's card art. `load(raw, version)` returns an object with m_Width, m_Height and image."""
    attempts: list[str] = []
    for version in versions:
        try:
            texture = load(raw, version)
            if not is_plausible(texture.m_Width, texture.m_Height):
                attempts.append(f"{version}: implausible size {texture.m_Width}x{texture.m_Height}")
                continue
            return texture.image
        except Exception as e:  # a wrong layout can raise anything from UnityPy's parser
            attempts.append(f"{version}: {type(e).__name__}: {e}")
    raise DecodeError("; ".join(attempts))
