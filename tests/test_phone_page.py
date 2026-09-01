from gamehub import config

PAGE = config.WEB_DIR / "phone" / "phone.js"
HTML = config.WEB_DIR / "phone" / "index.html"


def source():
    return PAGE.read_text()


def test_every_control_the_spec_promises_is_on_the_page():
    markup = HTML.read_text()
    for control in ("btn-a", "btn-b", "dpad", "btn-home", "btn-pause",
                    "btn-recentre", "sensitivity"):
        assert f'id="{control}"' in markup, control


def test_it_sends_the_four_message_types_the_server_handles():
    text = source()
    for kind in ('"frame"', '"button"', '"recentre"', '"sensitivity"'):
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
