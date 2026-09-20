import io

from PIL import Image

from thumbnail import THUMBNAIL_SIZE, key_for, to_thumbnail


def test_key_for_swaps_the_extension_and_keeps_the_game_stem():
    assert key_for("img_general_csprt-3-0016_full.unity3d") == "img_general_csprt-3-0016_full.webp"
    assert key_for("img_general_csprt-1-0000_full.unity3d") == "img_general_csprt-1-0000_full.webp"


def test_key_for_rejects_everything_that_is_not_full_card_art():
    for name in [
        "img_general_csprt-3-0016_full",  # no suffix: the manifest name always carries .unity3d
        "img_general_csprt-3-0016_thumb-square.unity3d",
        "img_general_cidol-hski-3-000_1-full.unity3d",
        "img_general_csprt-3-016_full.unity3d",
        "../img_general_csprt-3-0016_full.unity3d",
        "",
    ]:
        assert key_for(name) is None, name


def test_thumbnail_is_an_opaque_192_by_108_webp():
    squashed = Image.new("RGBA", (2048, 1024), (200, 30, 60, 255))
    data = to_thumbnail(squashed)
    out = Image.open(io.BytesIO(data))
    assert out.format == "WEBP"
    assert out.size == THUMBNAIL_SIZE == (192, 108)
    assert out.mode == "RGB"
    assert len(data) < 20_000
