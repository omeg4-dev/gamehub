from gamehub import config, library

GAME = config.GAMES_DIR / "balloon-rush"


def test_it_loads_as_a_game():
    games, problems = library.discover(config.GAMES_DIR)
    assert problems == []
    assert "balloon-rush" in [g.slug for g in games]


def test_it_declares_the_controls_it_uses():
    game = next(g for g in library.discover(config.GAMES_DIR)[0]
                if g.slug == "balloon-rush")
    assert set(game.controls) == {"pointer", "a", "gesture"}
    assert game.players == "many"


def test_it_has_a_thumbnail_for_the_card():
    assert (GAME / "thumbnail.png").exists()


def test_it_reports_its_score_and_can_be_left():
    text = (GAME / "game.js").read_text()
    assert "submitScore" in text
    assert "GameHub.exit" in text


def test_it_keeps_a_score_per_player_rather_than_one_for_the_room():
    """Four people sharing one number is not a race."""
    text = (GAME / "game.js").read_text()
    assert "scores[player]" in text
    assert "GameHub.players()" in text
