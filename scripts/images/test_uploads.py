from uploads import card_keys, plan_uploads, publishable


def test_only_missing_keys_are_planned_sorted_and_deduplicated():
    served = {"b.webp"}
    plan = plan_uploads(["c.webp", "a.webp", "b.webp", "a.webp"], exists=lambda k: k in served)
    assert plan.missing == ("a.webp", "c.webp")
    assert plan.present == ("b.webp",)


def test_each_key_is_checked_exactly_once():
    calls = []

    def exists(key):
        calls.append(key)
        return False

    plan_uploads(["x.webp", "x.webp", "y.webp"], exists)
    assert calls == ["x.webp", "y.webp"]


def test_nothing_to_do():
    plan = plan_uploads([], exists=lambda k: True)
    assert plan.missing == () and plan.present == ()


def test_card_keys_come_from_the_generated_card_data():
    src = '{"id":"s_card-3-0016","assetId":"csprt-3-0016","type":"vocal"},{"id":"x","assetId":"csprt-1-0000"}'
    assert card_keys(src) == {"img_general_csprt-3-0016_full.webp", "img_general_csprt-1-0000_full.webp"}
    assert card_keys("no cards here") == set()


def test_art_without_a_card_is_held_back():
    allowed = {"img_general_csprt-3-0016_full.webp"}
    keep, held = publishable(["img_general_csprt-3-0109_full.webp", "img_general_csprt-3-0016_full.webp"], allowed)
    assert keep == ["img_general_csprt-3-0016_full.webp"]
    assert held == ["img_general_csprt-3-0109_full.webp"]
