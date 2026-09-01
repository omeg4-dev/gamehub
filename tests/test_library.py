import json

from gamehub import library

GOOD = {"name": "Pointer Demo", "entry": "index.html",
        "description": "Pop the balloons", "controls": ["pointer", "a"],
        "score": {"order": "high"}}


def make(tmp_path, slug, manifest, entry=True):
    folder = tmp_path / slug
    folder.mkdir()
    if manifest is not None:
        (folder / "game.json").write_text(json.dumps(manifest))
    if entry:
        (folder / "index.html").write_text("<h1>hi</h1>")
    return folder


def test_a_good_folder_becomes_a_game(tmp_path):
    make(tmp_path, "demo", GOOD)
    games, problems = library.discover(tmp_path)
    assert problems == []
    assert [g.slug for g in games] == ["demo"]
    assert games[0].name == "Pointer Demo"
    assert games[0].controls == ["pointer", "a"]


def test_games_come_back_in_a_stable_order(tmp_path):
    make(tmp_path, "zeta", dict(GOOD, name="Zeta"))
    make(tmp_path, "alpha", dict(GOOD, name="Alpha"))
    games, _ = library.discover(tmp_path)
    assert [g.name for g in games] == ["Alpha", "Zeta"]


def test_a_missing_manifest_is_reported_not_raised(tmp_path):
    """A half-copied folder must not take the hub down with it — the grid
    still opens, and says what is wrong."""
    make(tmp_path, "broken", None)
    games, problems = library.discover(tmp_path)
    assert games == []
    assert problems[0].slug == "broken"
    assert "game.json" in problems[0].reason


def test_unreadable_json_is_reported(tmp_path):
    folder = tmp_path / "bad"
    folder.mkdir()
    (folder / "game.json").write_text("{oh no")
    games, problems = library.discover(tmp_path)
    assert games == []
    assert problems[0].reason


def test_a_missing_name_is_reported(tmp_path):
    make(tmp_path, "nameless", {"entry": "index.html"})
    games, problems = library.discover(tmp_path)
    assert games == []
    assert "name" in problems[0].reason


def test_a_missing_entry_file_is_reported(tmp_path):
    make(tmp_path, "hollow", GOOD, entry=False)
    games, problems = library.discover(tmp_path)
    assert games == []
    assert "index.html" in problems[0].reason


def test_defaults_fill_in_for_the_optional_fields(tmp_path):
    make(tmp_path, "sparse", {"name": "Sparse", "entry": "index.html"})
    games, problems = library.discover(tmp_path)
    assert problems == []
    assert games[0].controls == ["pointer", "a", "b"]
    assert games[0].score_order == "high"
    assert games[0].description == ""


def test_a_missing_directory_is_empty_not_an_error(tmp_path):
    assert library.discover(tmp_path / "nope") == ([], [])
