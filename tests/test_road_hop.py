from gamehub import config, library

GAME = config.GAMES_DIR / "road-hop"


def game():
    return next(g for g in library.discover(config.GAMES_DIR)[0]
                if g.slug == "road-hop")


def test_it_hides_the_hand_because_it_is_steered_not_pointed():
    assert game().cursor == "none"
    assert set(game().controls) == {"dpad", "a", "b"}


def test_it_has_a_thumbnail_for_the_card():
    assert (GAME / "thumbnail.png").exists()


def test_the_rules_are_kept_away_from_the_canvas():
    """world.js is required straight into node by the rule checks. A single
    document reference in it would end that."""
    # Comments may say the word; code may not.
    rules = "\n".join(line for line in (GAME / "world.js").read_text().splitlines()
                      if not line.lstrip().startswith("//"))
    for browser in ("document", "canvas", "getContext", "requestAnimationFrame",
                    "window."):
        assert browser not in rules, browser


def test_a_flick_of_the_phone_hops():
    text = (GAME / "game.js").read_text()
    assert 'GameHub.on("flick"' in text


def test_it_reports_its_score_and_can_be_left():
    text = (GAME / "game.js").read_text()
    assert "submitScore" in text
    assert "GameHub.exit" in text
