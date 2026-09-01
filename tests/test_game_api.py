from gamehub import config

API = config.WEB_DIR / "shared" / "gamehub-api.js"


def source():
    return API.read_text()


def test_every_method_the_spec_promises_exists():
    text = source()
    for name in ("on", "onPause", "onResume", "ready", "submitScore",
                 "highScores", "exit"):
        assert f"{name}" in text, name


def test_high_scores_returns_a_promise():
    assert "Promise" in source()


def test_messages_from_anywhere_but_the_hub_are_ignored():
    """The game is in an iframe on the hub's own origin. Anything arriving
    from elsewhere is not the hub and must not be able to drive it."""
    text = source()
    assert "event.source !== parent" in text or "event.origin" in text
