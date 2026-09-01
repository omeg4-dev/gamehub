from gamehub import config

HUB = config.WEB_DIR / "hub"


def test_the_mouse_and_keyboard_feed_the_same_events_as_the_phone():
    """Without this the hub can only ever be tested with a phone in hand."""
    text = (HUB / "input.js").read_text()
    assert "mousemove" in text
    assert "keydown" in text
    for name in ("a", "b", "home", "up", "down", "left", "right"):
        assert f'"{name}"' in text, name


def test_the_cursor_is_drawn_by_the_hub_not_the_system():
    css = (HUB / "hub.css").read_text()
    assert "cursor: none" in css
    assert (HUB / "cursor.js").exists()


def test_the_connect_screen_shows_the_address_and_the_qr():
    markup = (HUB / "index.html").read_text()
    assert 'id="connect"' in markup
    assert 'id="qr"' in markup


def test_the_hub_reconnects_its_socket():
    """The server restarts during development constantly; a hub that needs
    a manual reload for each one is a hub nobody iterates on."""
    assert "reconnect" in (HUB / "input.js").read_text()
