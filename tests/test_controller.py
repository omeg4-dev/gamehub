import math

from gamehub import config
from gamehub.controller import Controller

IDENT = (1.0, 0.0, 0.0, 0.0)
STILL = (0.0, 0.0, 0.0)


def about_z(degrees):
    half = math.radians(degrees) / 2
    return (math.cos(half), 0.0, 0.0, math.sin(half))


def hold(controller, q, seconds=1.0):
    events = []
    for i in range(int(seconds * config.FRAME_HZ)):
        events += controller.frame(q, STILL, (i + 1) / config.FRAME_HZ)
    return events


def test_a_frame_produces_a_pointer_event():
    c = Controller()
    events = c.frame(IDENT, STILL, 0.0)
    assert events == [{"type": "pointer", "x": 0.5, "y": 0.5}]


def test_a_button_press_and_release_are_separate_events():
    c = Controller()
    assert c.button("a", True) == {"type": "button", "name": "a", "down": True}
    assert c.button("a", False) == {"type": "button", "name": "a", "down": False}


def test_a_swing_fires_once():
    """A swing is a hundred milliseconds of hard acceleration. Without a
    refractory window it would fire on every frame of it."""
    c = Controller()
    events = []
    for i in range(12):
        events += c.frame(IDENT, (0.0, 30.0, 0.0), i / config.FRAME_HZ)
    gestures = [e for e in events if e["type"] == "gesture"]
    assert len(gestures) == 1
    assert gestures[0]["dir"] == "forward"


def test_a_second_swing_after_the_refractory_window_fires_again():
    c = Controller()
    c.frame(IDENT, (0.0, 30.0, 0.0), 0.0)
    events = c.frame(IDENT, (0.0, 30.0, 0.0), config.SWING_REFRACTORY + 0.01)
    assert [e["type"] for e in events].count("gesture") == 1


def test_a_gentle_wave_is_not_a_swing():
    c = Controller()
    events = c.frame(IDENT, (0.0, 3.0, 0.0), 0.0)
    assert all(e["type"] != "gesture" for e in events)


def test_swing_direction_is_named_from_the_biggest_axis():
    c = Controller()
    events = c.frame(IDENT, (-30.0, 0.0, 0.0), 0.0)
    assert [e for e in events if e["type"] == "gesture"][0]["dir"] == "left"


def test_the_phone_is_dead_after_a_second_of_silence():
    c = Controller()
    c.frame(IDENT, STILL, 10.0)
    assert c.alive(10.5)
    assert not c.alive(10.0 + config.IDLE_TIMEOUT + 0.01)


def test_the_first_frame_is_the_middle_of_the_screen():
    """You get a cursor by picking the phone up, not by pressing a button
    first — whatever you happen to be holding when it connects is centre."""
    c = Controller()
    hold(c, about_z(-30))
    assert c.state()["x"] == 0.5


def test_recentring_uses_the_orientation_of_the_last_frame():
    c = Controller()
    hold(c, IDENT)
    hold(c, about_z(-30))
    assert c.state()["x"] > 0.6
    c.recentre()
    hold(c, about_z(-30))
    assert c.state()["x"] == 0.5


def test_sensitivity_is_remembered_and_reported():
    c = Controller()
    c.set_sensitivity(1.5)
    assert c.state()["sensitivity"] == 1.5
