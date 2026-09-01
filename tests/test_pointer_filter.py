import math

import pytest

from gamehub import config, pointer

IDENT = (1.0, 0.0, 0.0, 0.0)


def about_z(degrees):
    half = math.radians(degrees) / 2
    return (math.cos(half), 0.0, 0.0, math.sin(half))


def test_a_still_signal_settles_on_its_value():
    f = pointer.OneEuro(config.MIN_CUTOFF, config.BETA)
    for i in range(200):
        out = f(0.5, i / 60)
    assert out == pytest.approx(0.5, abs=1e-3)


def test_noise_at_rest_is_smoothed_far_below_its_input():
    """The whole reason for a filter: a hand shakes, and a card under the
    cursor must not flicker between hover and not."""
    f = pointer.OneEuro(config.MIN_CUTOFF, config.BETA)
    noise = [0.5 + (0.01 if i % 2 else -0.01) for i in range(200)]
    out = [f(v, i / 60) for i, v in enumerate(noise)]
    swing = max(out[100:]) - min(out[100:])
    assert swing < 0.004


def test_a_fast_sweep_is_not_left_behind():
    """A one-euro filter loosens as speed rises; a fixed average would lag
    a flick by a visible fraction of a second."""
    f = pointer.OneEuro(config.MIN_CUTOFF, config.BETA)
    out = 0.0
    for i in range(60):
        out = f(i / 60, i / 60)
    assert out > 0.9


def test_recentring_puts_the_cursor_in_the_middle():
    aimer = pointer.Aimer()
    grip = about_z(37)
    aimer.recentre(grip)
    assert aimer.update(grip, 0.0) == pytest.approx((0.5, 0.5), abs=1e-6)


def test_the_edge_of_the_screen_is_the_half_angle():
    aimer = pointer.Aimer()
    aimer.recentre(IDENT)
    aimer.settle(about_z(-math.degrees(config.HALF_ANGLE_X)), seconds=2.0)
    x, y = aimer.last
    assert x == pytest.approx(1.0, abs=0.01)
    assert y == pytest.approx(0.5, abs=0.01)


def test_the_cursor_parks_at_the_edge_instead_of_vanishing():
    aimer = pointer.Aimer()
    aimer.recentre(IDENT)
    aimer.settle(about_z(-80), seconds=2.0)
    assert aimer.last[0] == pytest.approx(1 + config.OVERSHOOT, abs=1e-6)


def test_sensitivity_moves_the_edge_closer():
    """The slider on the phone: turning it up means less wrist for the
    same distance."""
    aimer = pointer.Aimer()
    aimer.sensitivity = 2.0
    aimer.recentre(IDENT)
    half = math.degrees(config.HALF_ANGLE_X) / 2
    aimer.settle(about_z(-half), seconds=2.0)
    assert aimer.last[0] == pytest.approx(1.0, abs=0.01)
