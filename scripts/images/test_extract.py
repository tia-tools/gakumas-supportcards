from pathlib import Path

from extract import rendition_paths


def test_a_served_file_gets_its_master_and_its_rendition():
    out = Path("out")
    assert rendition_paths(out, "img_general_pitem_2-004.webp") == [out / "master/img_general_pitem_2-004.webp", out / "w48/img_general_pitem_2-004.webp"]


def test_an_sd_face_gets_only_its_master():
    out = Path("out")
    assert rendition_paths(out, "img_sd_hski_face-00.webp") == [out / "master/img_sd_hski_face-00.webp"]
