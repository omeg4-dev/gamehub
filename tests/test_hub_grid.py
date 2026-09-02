from gamehub import config

HUB_JS = config.WEB_DIR / "hub" / "hub.js"
HUB_CSS = config.WEB_DIR / "hub" / "hub.css"
HUB_HTML = config.WEB_DIR / "hub" / "index.html"


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


# --- the Wii Menu look -------------------------------------------------
# The look is checked in a browser (scripts/shot.py photographs it); these
# only hold the pieces that a later edit could quietly drop.

def test_a_page_is_always_twelve_plates():
    """Empty slots are the menu. A grid that reflows around however many
    folders happen to be there is not a place you learn your way around."""
    text = source()
    assert "PER_PAGE = 12" in text and '"slot"' in text


def test_pages_turn_when_there_are_more_than_twelve():
    assert "pager" in source() and 'what === "page"' in source()
    assert 'data-act="page:-1"' in HUB_HTML.read_text()


def test_the_rounded_font_is_bundled_not_borrowed():
    """A menu that falls back to the system sans stops looking like a
    console, and a kiosk with no network cannot fetch one."""
    assert (config.WEB_DIR / "fonts" / "nunito.ttf").exists()
    assert "@font-face" in HUB_CSS.read_text()


def test_the_shelf_carries_the_clock_and_the_two_knobs():
    html = HUB_HTML.read_text()
    assert 'id="clock"' in html and 'id="date"' in html
    assert html.count('class="knob') == 2


def test_a_game_can_ask_for_the_hand_to_be_put_away():
    """Snake steers with the d-pad; a cursor floating over it is noise."""
    assert 'cursor === "none"' in source()


def hub_js():
    return (config.WEB_DIR / "hub" / "hub.js").read_text()


def test_only_player_one_drives_the_menu():
    """Four hands fighting over which channel opens is not a feature."""
    text = hub_js()
    assert '(event.player || 1) !== 1' in text
    assert 'if (player !== 1) return;' in text


def test_the_roster_is_drawn_from_the_server_not_guessed():
    text = hub_js()
    assert 'Input.on("players"' in text
    assert 'player.colour' in text


def test_every_player_gets_their_own_hand():
    cursor = (config.WEB_DIR / "hub" / "cursor.js").read_text()
    assert "hands" in cursor
    assert "p.player || 1" in cursor


def test_a_rumble_from_a_game_is_addressed_to_a_player():
    text = hub_js()
    assert '"rumble"' in text and "message.player" in text
