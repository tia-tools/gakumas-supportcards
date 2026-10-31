import json

import pytest

from sheet_rules import parse_index, stored_icon_names

INDEX = {
    "formatVersion": 1,
    "cell": 112,
    "sheets": [
        {"plan": "sense", "idol": "hski", "file": "sheet112/sense-hski-1a2b3c4d.webp", "columns": 10, "assets": ["img_general_skillcard_act-1_001", "img_general_skillcard_act-2_009-hski"]},
        {"plan": "sense", "idol": "ttmr", "file": "sheet112/sense-ttmr-00000000.webp", "columns": 10, "assets": ["img_general_skillcard_act-1_001", "img_general_skillcard_act-2_009-ttmr"]},
    ],
}


def test_the_icons_of_every_stored_sheet_count_as_stored():
    assert stored_icon_names(parse_index(json.dumps(INDEX))) == {
        "img_general_skillcard_act-1_001.webp",
        "img_general_skillcard_act-2_009-hski.webp",
        "img_general_skillcard_act-2_009-ttmr.webp",
    }
    assert stored_icon_names(None) == set()


@pytest.mark.parametrize(
    "broken",
    [
        {**INDEX, "formatVersion": 2},
        {**INDEX, "sheets": "none"},
        {**INDEX, "sheets": [{"plan": "sense", "idol": "hski", "file": "x.webp"}]},
        [],
    ],
)
def test_a_damaged_index_stops_rather_than_reading_as_nothing_stored(broken):
    with pytest.raises(ValueError):
        parse_index(json.dumps(broken))


def _card(card_id, upgrade, plan, asset, per_idol):
    return {"id": card_id, "upgrade": upgrade, "plan": plan, "art": {"asset": asset, "perIdol": per_idol}}


DATA = {
    "formatVersion": 1,
    "idols": [{"id": "hski", "name": "花海咲季"}, {"id": "ttmr", "name": "月村手毬"}],
    "cards": [
        _card("p_card-00-act-0_001", 0, "free", "img_general_skillcard_act-0_001", False),
        _card("p_card-01-act-1_001", 0, "sense", "img_general_skillcard_act-1_001", False),
        _card("p_card-01-act-1_001", 1, "sense", "img_general_skillcard_act-1_001", False),
        _card("p_card-02-act-2_009", 0, "logic", "img_general_skillcard_act-2_009", True),
        _card("p_card-01-act-2_010", 0, "sense", "img_general_skillcard_act-2_010", True),
    ],
    "hifAbilities": [],
}


def test_one_sheet_per_plan_and_idol_holding_that_plans_cards_and_the_free_ones_once_each_in_order():
    from sheet_rules import COLUMNS, desired_sheets

    sheets = desired_sheets(DATA)
    assert [(s["plan"], s["idol"]) for s in sheets] == [(p, i) for p in ("sense", "logic", "anomaly") for i in ("hski", "ttmr")]
    assert all(s["columns"] == COLUMNS for s in sheets)
    assert sheets[0]["assets"] == ["img_general_skillcard_act-0_001", "img_general_skillcard_act-1_001", "img_general_skillcard_act-2_010-hski"]
    assert sheets[1]["assets"] == ["img_general_skillcard_act-0_001", "img_general_skillcard_act-1_001", "img_general_skillcard_act-2_010-ttmr"]
    assert sheets[3]["assets"] == ["img_general_skillcard_act-0_001", "img_general_skillcard_act-2_009-ttmr"]
    assert sheets[4]["assets"] == ["img_general_skillcard_act-0_001"]


def test_a_sheet_is_stale_only_when_its_entry_is_missing_or_holds_other_icons_or_layout():
    from sheet_rules import CELL, desired_sheets, is_stale

    d = desired_sheets(DATA)[0]
    stored = {"formatVersion": 1, "cell": CELL, "sheets": [{**d, "file": "sheet112/sense-hski-00000000.webp"}]}
    assert not is_stale(d, stored)
    assert is_stale(d, None)
    assert is_stale(desired_sheets(DATA)[1], stored)  # no entry for ttmr
    assert is_stale({**d, "assets": d["assets"][:-1]}, stored)
    assert is_stale({**d, "assets": list(reversed(d["assets"]))}, stored)
    assert is_stale({**d, "columns": 12}, stored)
    assert is_stale(d, {**stored, "cell": 96})


def test_a_sheet_is_named_by_its_plan_idol_and_the_first_8_hex_digits_of_its_sha256():
    import hashlib

    from sheet_rules import sheet_file

    name = sheet_file("sense", "hski", b"bytes")
    assert name == f"sheet112/sense-hski-{hashlib.sha256(b'bytes').hexdigest()[:8]}.webp"
    assert sheet_file("sense", "hski", b"other") != name


def test_cells_fill_rows_of_the_given_columns_on_a_transparent_canvas():
    from PIL import Image

    from sheet_rules import CELL, cell_origin, compose

    assert [cell_origin(i, 10) for i in (0, 9, 10, 23)] == [(0, 0), (9 * CELL, 0), (0, CELL), (3 * CELL, 2 * CELL)]
    colours = [(255, 0, 0, 255), (0, 255, 0, 255), (0, 0, 255, 255)]
    sheet = compose([Image.new("RGBA", (CELL, CELL), c) for c in colours], 2)
    assert sheet.size == (2 * CELL, 2 * CELL)
    assert [sheet.getpixel(cell_origin(i, 2)) for i in range(3)] == colours
    assert sheet.getpixel((CELL + 1, CELL + 1))[3] == 0  # the unused fourth cell stays clear


def test_the_encoded_sheet_is_webp_keeping_transparency_exactly():
    import io

    from PIL import Image

    from sheet_rules import CELL, compose, encode

    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cell.paste((200, 100, 50, 255), (8, 8, CELL - 8, CELL - 8))
    decoded = Image.open(io.BytesIO(encode(compose([cell], 10))))
    assert decoded.format == "WEBP" and decoded.mode == "RGBA" and decoded.size == (10 * CELL, CELL)
    assert decoded.getpixel((0, 0))[3] == 0 and decoded.getpixel((56, 56))[3] == 255 and decoded.getpixel((CELL + 5, 5))[3] == 0


def test_the_index_text_reads_back_as_the_entries_it_names():
    from sheet_rules import desired_sheets, index_text

    entries = [{**d, "file": f"sheet112/{d['plan']}-{d['idol']}-0000000{i}.webp"} for i, d in enumerate(desired_sheets(DATA))]
    index = parse_index(index_text(entries))
    assert index["cell"] == 112 and index["sheets"] == entries


@pytest.mark.parametrize(
    "field, value",
    [
        ("plan", "free"),
        ("idol", "HSKI"),
        ("file", "sheet112/sense-ttmr-1a2b3c4d.webp"),
        ("file", "sheet112/sense-hski-1a2b3c4.webp"),
        ("file", "master/img_general_skillcard_act-1_001.webp"),
        ("columns", 0),
        ("columns", True),
        ("assets", ["img_general_csprt-3-0016_full"]),
        ("assets", ["../img_general_skillcard_act-1_001"]),
    ],
)
def test_an_entry_naming_anything_this_pipeline_does_not_write_stops_the_run(field, value):
    sheet = {**INDEX["sheets"][0], field: value}
    with pytest.raises(ValueError):
        parse_index(json.dumps({**INDEX, "sheets": [sheet]}))


def test_two_entries_for_one_plan_and_idol_stop_the_run():
    with pytest.raises(ValueError, match="second sheet"):
        parse_index(json.dumps({**INDEX, "sheets": [INDEX["sheets"][0], INDEX["sheets"][0]]}))
