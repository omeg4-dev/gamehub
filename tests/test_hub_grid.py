from gamehub import config

HUB_JS = config.WEB_DIR / "hub" / "hub.js"


def source():
    return HUB_JS.read_text()


def test_it_asks_the_server_for_the_game_list():
    assert "api/games" in source()


def test_favourites_then_recent_then_the_rest():
    text = source()
    assert "favourites" in text and "recent" in text


def test_hovering_is_decided_by_what_is_under_the_cursor():
    assert "elementFromPoint" in source()


def test_a_press_opens_the_hovered_card():
    text = source()
    assert '"a"' in text and "opening" in text


def test_home_leaves_the_game():
    assert '"home"' in source()


def test_the_phone_is_told_what_is_running():
    """The controller dims the buttons a game ignores, which it can only do
    if the hub says what started."""
    assert '"running"' in source()


def test_the_connect_screen_shrinks_once_the_phone_is_there():
    assert "badge" in source()


def test_broken_game_folders_are_shown_not_swallowed():
    assert "problems" in source()
