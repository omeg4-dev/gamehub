from gamehub import config

PAGE = config.WEB_DIR / "phone" / "phone.js"
HTML = config.WEB_DIR / "phone" / "index.html"


def source():
    return PAGE.read_text()


def test_every_control_the_spec_promises_is_on_the_page():
    markup = HTML.read_text()
    for control in ("btn-a", "btn-b", "dpad", "btn-recentre", "sensitivity",
                    "name", "flick", "btn-cal"):
        assert f'id="{control}"' in markup, control
    for named in ("home", "pause", "a", "b", "up", "down", "left", "right"):
        assert f'data-name="{named}"' in markup, named


def test_it_sends_the_four_message_types_the_server_handles():
    text = source()
    for kind in ('"frame"', '"button"', '"recentre"', '"sensitivity"',
                 '"name"', '"flick"', '"calibrate"'):
        assert kind in text, kind


def test_frames_are_throttled_to_the_configured_rate():
    assert f"1000 / {config.FRAME_HZ}" in source()


def test_it_asks_for_a_wake_lock():
    """A phone that sleeps mid-game is a controller that stops."""
    assert "wakeLock" in source()


def test_it_says_so_when_the_sensors_never_fire():
    """Silent failure here looks identical to a broken server, and cost an
    evening on the tv-mode remote for the same reason."""
    assert "no-sensors" in source()


def test_nothing_scrolls_or_zooms():
    assert "touch-action" in (config.WEB_DIR / "phone" / "phone.css").read_text()


def test_it_wears_the_colour_the_server_gave_this_player():
    """Four phones that all look like player one is four phones nobody can
    tell apart across a sofa."""
    assert "--me" in source()
    assert "--me" in (config.WEB_DIR / "phone" / "phone.css").read_text()


def test_a_rumble_addressed_here_reaches_the_motor():
    assert '"rumble"' in source() and "navigator.vibrate" in source()


def test_a_fifth_phone_is_told_the_room_is_full():
    assert '"full"' in source()
