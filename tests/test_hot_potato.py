from gamehub import config, library

GAME = config.GAMES_DIR / "hot-potato"


def game():
    return next(g for g in library.discover(config.GAMES_DIR)[0]
                if g.slug == "hot-potato")


def test_it_loads_as_a_game_the_whole_room_can_play():
    assert game().players == "many"


def test_it_has_a_thumbnail_for_the_card():
    assert (GAME / "thumbnail.png").exists()


def test_the_fuse_is_felt_rather_than_shown():
    """The whole game is that only the holder knows how close it is. A
    countdown on screen would give it away to everyone."""
    text = (GAME / "game.js").read_text()
    assert "GameHub.rumble(holder" in text
    # Nothing draws the fuse as a number.
    assert "fillText(String(fuse" not in text
    assert "fuse.toFixed" not in text


def test_it_reports_its_score_and_can_be_left():
    text = (GAME / "game.js").read_text()
    assert "submitScore" in text
    assert "GameHub.exit" in text
