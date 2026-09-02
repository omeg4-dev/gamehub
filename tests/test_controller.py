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


def sweep(controller, axis, degrees, seconds, start=0.0, frames=None):
    """Turn the phone through an angle at a constant speed.

    Returns everything the controller had to say about it, which is the
    only honest way to ask "was that one flick or four".
    """
    frames = frames or max(1, int(seconds * config.FRAME_HZ))
    events = []
    for i in range(1, frames + 1):
        q = axis(degrees * i / frames)
        events += controller.frame(q, STILL, start + seconds * i / frames)
    return events


def about_x(degrees):
    half = math.radians(degrees) / 2
    return (math.cos(half), math.sin(half), 0.0, 0.0)


def flicks(events):
    return [e for e in events if e["type"] == "flick"]


def test_a_wrist_snap_is_exactly_one_flick():
    """Six frames of hard acceleration must not be six turns."""
    c = Controller()
    c.frame(IDENT, STILL, 0.0)
    assert [e["dir"] for e in flicks(sweep(c, about_z, 30, 0.12, start=0.0))] \
        == ["left"]


def test_a_phone_held_at_a_tilt_never_flicks():
    """The point of measuring speed: holding it over means go straight, not
    turn forever."""
    c = Controller()
    c.frame(IDENT, STILL, 0.0)
    sweep(c, about_z, 30, 0.12)
    assert flicks(hold(c, about_z(30), seconds=2.0)) == []


def test_a_slow_pan_is_aiming_not_flicking():
    c = Controller()
    c.frame(IDENT, STILL, 0.0)
    assert flicks(sweep(c, about_z, 30, 1.5)) == []


def test_flicks_have_the_four_directions():
    c = Controller()
    c.frame(IDENT, STILL, 0.0)
    assert flicks(sweep(c, about_z, -30, 0.12))[0]["dir"] == "right"
    c = Controller()
    c.frame(IDENT, STILL, 0.0)
    # +beta tips the top edge away from you, which is up the screen.
    assert flicks(sweep(c, about_x, 30, 0.12))[0]["dir"] == "up"


def test_two_snaps_with_a_pause_are_two_flicks():
    c = Controller()
    c.frame(IDENT, STILL, 0.0)
    events = sweep(c, about_z, 25, 0.1, start=0.0)
    events += hold(c, about_z(25), seconds=0.4)
    events += [e for e in sweep(c, lambda d: about_z(25 + d), 25, 0.1, start=0.6)]
    assert len(flicks(events)) == 2


def test_the_flick_threshold_can_be_turned_down_for_a_gentler_wrist():
    slow = Controller()
    slow.frame(IDENT, STILL, 0.0)
    assert flicks(sweep(slow, about_z, 20, 0.2)) == []
    slow2 = Controller()
    slow2.set_flick_rate(1.6)
    slow2.frame(IDENT, STILL, 0.0)
    assert len(flicks(sweep(slow2, about_z, 20, 0.2))) == 1
