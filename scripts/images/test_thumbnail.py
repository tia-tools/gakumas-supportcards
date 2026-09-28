import io

from PIL import Image

from thumbnail import ICON_PREFIX, ICON_SIZE, MASTER_PREFIX, THUMBNAIL_PREFIX, THUMBNAIL_SIZE, display_size, file_name_for, is_item, master_rendition, public_prefix_for, public_rendition, to_icon, to_item_master, to_master, to_thumbnail


def test_file_name_swaps_the_extension_and_keeps_the_game_stem():
    assert file_name_for("img_general_csprt-3-0016_full.unity3d") == "img_general_csprt-3-0016_full.webp"
    assert file_name_for("img_general_csprt-1-0000_full.unity3d") == "img_general_csprt-1-0000_full.webp"
    assert file_name_for("img_general_pitem_2-004.unity3d") == "img_general_pitem_2-004.webp"


def test_file_name_rejects_everything_that_is_not_full_card_art_or_an_item_icon():
    for name in [
        "img_general_csprt-3-0016_full",  # no suffix: the manifest name always carries .unity3d
        "img_general_csprt-3-0016_thumb-square.unity3d",
        "img_general_cidol-hski-3-000_1-full.unity3d",
        "img_general_csprt-3-016_full.unity3d",
        "../img_general_csprt-3-0016_full.unity3d",
        "img_general_pitem_2-04.unity3d",
        "img_general_pitem_2-004_full.unity3d",
        "../img_general_pitem_2-004.unity3d",
        "",
    ]:
        assert file_name_for(name) is None, name


def test_renditions_live_under_distinct_prefixes():
    assert MASTER_PREFIX == "master/" and THUMBNAIL_PREFIX == "w192/" and ICON_PREFIX == "w48/"


def test_an_item_icon_is_told_apart_by_its_stem_and_served_from_w48():
    assert is_item("img_general_pitem_2-004.webp") and not is_item("img_general_csprt-3-0016_full.webp")
    assert public_prefix_for("img_general_pitem_2-004.webp") == "w48/"
    assert public_prefix_for("img_general_csprt-3-0016_full.webp") == "w192/"


def test_icon_is_a_48_by_48_webp_that_keeps_transparency():
    src = Image.new("RGBA", (256, 256), (200, 30, 60, 255))
    src.putpixel((0, 0), (0, 0, 0, 0))
    src.paste((0, 0, 0, 0), (0, 0, 128, 256))  # the left half transparent, as an icon on a background is
    data = to_icon(src)
    out = Image.open(io.BytesIO(data))
    assert out.format == "WEBP"
    assert out.size == ICON_SIZE == (48, 48)
    assert out.mode == "RGBA"
    assert out.getpixel((2, 24))[3] == 0 and out.getpixel((45, 24))[3] == 255
    assert len(data) < 5_000


def test_item_master_keeps_size_and_transparency_and_is_encoded_losslessly():
    src = Image.effect_noise((32, 32), 80).convert("RGBA")
    src.paste((0, 0, 0, 0), (0, 0, 16, 32))
    out = Image.open(io.BytesIO(to_item_master(src)))
    assert out.format == "WEBP"
    assert out.size == (32, 32)  # no reshape: an icon is square, the 16:9 rule is for card art
    assert out.mode == "RGBA"
    assert out.tobytes() == src.tobytes()  # the encoder loses nothing, alpha included


def test_rendition_by_file_kind():
    card = Image.new("RGBA", (64, 32), (1, 2, 3, 255))
    item = Image.new("RGBA", (16, 16), (1, 2, 3, 128))
    assert master_rendition("img_general_csprt-3-0016_full.webp", card) == to_master(card)
    assert public_rendition("img_general_csprt-3-0016_full.webp", card) == to_thumbnail(card)
    assert master_rendition("img_general_pitem_2-004.webp", item) == to_item_master(item)
    assert public_rendition("img_general_pitem_2-004.webp", item) == to_icon(item)


def test_thumbnail_is_an_opaque_192_by_108_webp():
    squashed = Image.new("RGBA", (2048, 1024), (200, 30, 60, 255))
    data = to_thumbnail(squashed)
    out = Image.open(io.BytesIO(data))
    assert out.format == "WEBP"
    assert out.size == THUMBNAIL_SIZE == (192, 108)
    assert out.mode == "RGB"
    assert len(data) < 20_000


def test_display_size_keeps_the_width_and_sets_16_to_9():
    assert display_size((2048, 1024)) == (2048, 1152)
    assert display_size((64, 32)) == (64, 36)


def test_master_has_the_display_shape_and_is_encoded_losslessly():
    src = Image.effect_noise((64, 32), 80).convert("RGB")
    out = Image.open(io.BytesIO(to_master(src)))
    assert out.format == "WEBP"
    assert out.size == (64, 36)  # the game's 16:9, not the stored 2:1
    expected = src.resize((64, 36), Image.LANCZOS)
    assert out.convert("RGB").tobytes() == expected.tobytes()  # the encoder loses nothing


def test_master_keeps_alpha_only_when_it_carries_something():
    opaque = Image.new("RGBA", (8, 4), (10, 20, 30, 255))
    assert Image.open(io.BytesIO(to_master(opaque))).mode == "RGB"
    see_through = Image.new("RGBA", (8, 4), (10, 20, 30, 128))
    assert Image.open(io.BytesIO(to_master(see_through))).mode == "RGBA"
