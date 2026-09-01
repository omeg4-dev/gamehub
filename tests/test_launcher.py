from gamehub import launcher


def test_the_browser_gets_its_own_profile_and_class():
    """Its own profile so it cannot disturb the real Brave session, and its
    own class so one Hyprland rule can find it and nothing else."""
    argv = launcher.browser_argv("https://127.0.0.1:8730/x/hub", "/tmp/p")
    assert argv[0] == "brave-origin"
    assert "--app=https://127.0.0.1:8730/x/hub" in argv
    assert "--class=dev.omega.gamehub" in argv
    assert "--user-data-dir=/tmp/p" in argv


def test_our_own_certificate_is_accepted_without_a_click():
    """The hub is opened by us, on loopback, against a certificate we just
    wrote. Clicking through a warning on our own machine every launch would
    be theatre."""
    argv = launcher.browser_argv("https://127.0.0.1:8730/x/hub", "/tmp/p")
    assert "--ignore-certificate-errors" in argv


def test_the_desktop_entry_launches_the_module():
    text = launcher.desktop_entry()
    assert "Exec=" in text and "gamehub" in text
    assert "Name=Game Hub" in text
