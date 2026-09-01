from gamehub.store import Store

TOP = 10


def test_high_scores_come_back_biggest_first(tmp_path):
    store = Store(tmp_path)
    for value in (30, 10, 20):
        store.submit("demo", value)
    assert [row["score"] for row in store.scores("demo")] == [30, 20, 10]


def test_a_low_is_better_game_sorts_the_other_way(tmp_path):
    store = Store(tmp_path)
    for value in (30, 10, 20):
        store.submit("golf", value, order="low")
    assert [row["score"] for row in store.scores("golf")] == [10, 20, 30]


def test_only_the_top_ten_are_kept(tmp_path):
    store = Store(tmp_path)
    for value in range(50):
        store.submit("demo", value)
    assert len(store.scores("demo")) == TOP
    assert store.scores("demo")[0]["score"] == 49


def test_every_score_is_stamped_with_when(tmp_path):
    store = Store(tmp_path)
    store.submit("demo", 1)
    assert store.scores("demo")[0]["when"] > 0


def test_scores_survive_a_restart(tmp_path):
    Store(tmp_path).submit("demo", 42)
    assert Store(tmp_path).scores("demo")[0]["score"] == 42


def test_favourites_toggle(tmp_path):
    store = Store(tmp_path)
    assert store.favourite("demo", True) is True
    assert store.favourites() == ["demo"]
    store.favourite("demo", False)
    assert store.favourites() == []


def test_recently_played_is_newest_first_and_has_no_duplicates(tmp_path):
    store = Store(tmp_path)
    for slug in ("a", "b", "a"):
        store.played(slug)
    assert store.recent()[:2] == ["a", "b"]


def test_sensitivity_is_remembered(tmp_path):
    store = Store(tmp_path)
    store.sensitivity = 1.4
    assert Store(tmp_path).sensitivity == 1.4


def test_a_truncated_file_does_not_stop_the_hub_opening(tmp_path):
    """A crash mid-write must cost the high scores, not the evening."""
    (tmp_path / "scores.json").write_text('{"demo": [{"scor')
    assert Store(tmp_path).scores("demo") == []


def test_writes_are_atomic(tmp_path):
    """Written to a neighbour and renamed, so the real file is either the
    old one or the new one and never half of either."""
    store = Store(tmp_path)
    store.submit("demo", 1)
    assert list(p.name for p in tmp_path.iterdir()) == ["scores.json"]
