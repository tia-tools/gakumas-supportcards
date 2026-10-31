"""sheets.run end to end over a temporary out/ directory, with the deployed site and the bucket faked."""

import argparse
import io

import pytest
from PIL import Image

from sheet_rules import INDEX_KEY, desired_sheets, parse_index
from sheets import run
from test_sheet_rules import DATA
from test_skillcards import module_text


@pytest.fixture
def setup(tmp_path):
    """The small DATA of test_sheet_rules as a generated module, and a master for each icon its sheets hold."""
    skillcards = tmp_path / "skillcards.generated.ts"
    skillcards.write_text(module_text(DATA), encoding="utf-8")
    out = tmp_path / "out"
    (out / "master").mkdir(parents=True)
    (out / "sheet112").mkdir()
    for asset in {a for d in desired_sheets(DATA) for a in d["assets"]}:
        buf = io.BytesIO()
        Image.new("RGBA", (256, 256), (200, 100, 50, 255)).save(buf, format="WEBP", lossless=True)
        (out / "master" / f"{asset}.webp").write_bytes(buf.getvalue())
    return argparse.Namespace(dir=out, skillcards=skillcards, dry_run=False, rebuild=False, quality=50)


class Bucket:
    """Records every put, in order."""

    def __init__(self):
        self.puts = []

    def __call__(self, key, path, content_type, cache_control):
        self.puts.append((key, content_type, cache_control))


def served_all(asked):
    def served(name):
        asked.append(name)
        return True

    return served


def test_without_a_stored_index_every_sheet_goes_up_and_then_the_index_last(setup):
    bucket = Bucket()
    assert run(setup, None, served_all([]), bucket) == 0
    keys = [k for k, _, _ in bucket.puts]
    assert len(keys) == len(desired_sheets(DATA)) + 1 and keys[-1] == INDEX_KEY
    assert all(k.startswith("sheet112/") and k.endswith(".webp") for k in keys[:-1])
    assert bucket.puts[0][1:] == ("image/webp", "public, max-age=31536000, immutable")
    assert bucket.puts[-1][1:] == ("application/json", "no-cache")
    index = parse_index((setup.dir / INDEX_KEY).read_text(encoding="utf-8"))
    assert [s["file"] for s in index["sheets"]] == keys[:-1]


def test_a_second_run_against_the_index_it_wrote_finds_every_sheet_current_and_asks_nothing(setup):
    run(setup, None, served_all([]), Bucket())
    stored = (setup.dir / INDEX_KEY).read_text(encoding="utf-8")
    bucket, asked = Bucket(), []
    assert run(setup, stored, served_all(asked), bucket) == 0
    assert bucket.puts == [] and asked == []


def test_an_icon_not_stored_yet_stops_the_run_before_the_first_put(setup):
    bucket = Bucket()
    with pytest.raises(SystemExit, match="not stored as single icons yet"):
        run(setup, None, lambda name: name != "img_general_skillcard_act-0_001.webp", bucket)
    assert bucket.puts == []


def test_a_missing_master_stops_the_run_before_the_first_put(setup):
    (setup.dir / "master" / "img_general_skillcard_act-1_001.webp").unlink()
    bucket = Bucket()
    with pytest.raises(SystemExit, match="run extract.py first"):
        run(setup, None, served_all([]), bucket)
    assert bucket.puts == []


def test_a_dry_run_builds_the_sheets_and_the_index_locally_and_puts_nothing(setup):
    bucket = Bucket()
    setup.dry_run = True
    assert run(setup, None, served_all([]), bucket) == 0
    assert bucket.puts == []
    assert len(parse_index((setup.dir / INDEX_KEY).read_text(encoding="utf-8"))["sheets"]) == len(desired_sheets(DATA))


def test_a_damaged_index_stops_a_normal_run_and_a_rebuild_replaces_it_trusting_nothing_stored(setup):
    with pytest.raises(ValueError):
        run(setup, '{"formatVersion":1,"cell":112,"sheets":[{"plan":"sense"}]}', served_all([]), Bucket())
    run(setup, None, served_all([]), Bucket())
    stored = (setup.dir / INDEX_KEY).read_text(encoding="utf-8")
    setup.rebuild = True
    bucket, asked = Bucket(), []
    assert run(setup, stored, served_all(asked), bucket) == 0
    assert bucket.puts[-1][0] == INDEX_KEY and len(bucket.puts) == len(desired_sheets(DATA)) + 1
    assert set(asked) == {f"{a}.webp" for d in desired_sheets(DATA) for a in d["assets"]}  # the stored index vouched for nothing
