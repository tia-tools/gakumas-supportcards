import pytest
from PIL import Image

from decode import DecodeError, decode_texture, is_plausible


class Texture:
    def __init__(self, width, height):
        self.m_Width, self.m_Height = width, height
        self.image = Image.new("RGB", (4, 2))


def test_first_plausible_version_wins_and_later_ones_are_not_tried():
    tried = []

    def load(raw, version):
        tried.append(version)
        return Texture(1024, 935712) if version == "old" else Texture(2048, 1024)

    img = decode_texture(b"x", versions=("old", "new", "never"), load=load)
    assert img.size == (4, 2)
    assert tried == ["old", "new"]


def test_a_version_that_raises_is_skipped():
    def load(raw, version):
        if version == "bad":
            raise TypeError("expected str")
        return Texture(2048, 1024)

    assert decode_texture(b"x", versions=("bad", "good"), load=load).size == (4, 2)


def test_failure_names_every_attempt():
    def load(raw, version):
        if version == "a":
            raise LookupError("encrypted")
        return Texture(0, 10)

    with pytest.raises(DecodeError) as e:
        decode_texture(b"x", versions=("a", "b"), load=load)
    assert "a: LookupError: encrypted" in str(e.value)
    assert "b: implausible size 0x10" in str(e.value)


def test_plausibility_bounds():
    assert is_plausible(2048, 1024)
    assert not is_plausible(1024, 935712)
    assert not is_plausible(0, 1024)
    assert is_plausible(8192, 8192)
    assert not is_plausible(8193, 1)
