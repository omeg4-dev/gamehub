import json

import pytest

from gamehub import config
from gamehub.controller import Controller

TRACES = config.ROOT / "traces"


def replay(name):
    frames = json.loads((TRACES / name).read_text())
    controller = Controller()
    events = []
    for frame in frames:
        events += controller.frame(tuple(frame["q"]), tuple(frame["a"]),
                                   frame["t"])
    return events


def points(name):
    return [(e["x"], e["y"]) for e in replay(name) if e["type"] == "pointer"]


@pytest.mark.skipif(not (TRACES / "still.json").exists(),
                    reason="traces not captured yet")
def test_a_held_hand_does_not_wander():
    """5 px on a 1920-wide screen. Above this a hovered card flickers."""
    held = points("still.json")[60:]
    xs = [p[0] for p in held]
    ys = [p[1] for p in held]
    assert (max(xs) - min(xs)) * 1920 < 5
    assert (max(ys) - min(ys)) * 1080 < 5


@pytest.mark.skipif(not (TRACES / "sweep.json").exists(),
                    reason="traces not captured yet")
def test_a_sweep_reaches_both_edges():
    """If it does not, HALF_ANGLE_X is too wide to be usable from a sofa."""
    xs = [p[0] for p in points("sweep.json")]
    assert min(xs) < 0.05
    assert max(xs) > 0.95


@pytest.mark.skipif(not (TRACES / "flick.json").exists(),
                    reason="traces not captured yet")
def test_a_flick_is_not_left_behind_by_the_filter():
    """The filter must not turn a corner-to-corner flick into a crawl: at
    least one frame has to move a fifth of the screen."""
    xs = [p[0] for p in points("flick.json")]
    steps = [abs(b - a) for a, b in zip(xs, xs[1:])]
    assert max(steps) > 0.2


@pytest.mark.skipif(not (TRACES / "swing.json").exists(),
                    reason="traces not captured yet")
def test_three_swings_are_three_gestures():
    gestures = [e for e in replay("swing.json") if e["type"] == "gesture"]
    assert len(gestures) == 3
