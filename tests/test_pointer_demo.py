from gamehub import config, library

DEMO = config.GAMES_DIR / "pointer-demo"


def test_the_demo_loads_as_a_game():
    games, problems = library.discover(config.GAMES_DIR)
    assert problems == []
    assert "pointer-demo" in [g.slug for g in games]


def test_it_declares_the_controls_it_uses():
    game = next(g for g in library.discover(config.GAMES_DIR)[0]
                if g.slug == "pointer-demo")
    assert set(game.controls) == {"pointer", "a", "gesture"}


def test_it_has_a_thumbnail_for_the_card():
    assert (DEMO / "thumbnail.png").exists()


def test_it_reports_its_score_and_can_be_left():
    text = (DEMO / "game.js").read_text()
    assert "submitScore" in text
    assert "GameHub.exit" in text
