import math

import pytest

from gamehub import pointer

IDENT = (1.0, 0.0, 0.0, 0.0)


def about(axis, degrees):
    """A quaternion for `degrees` about a device axis, right-hand rule."""
    half = math.radians(degrees) / 2
    s = math.sin(half)
    return (math.cos(half), *(component * s for component in axis))


X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def test_rotating_the_top_edge_by_nothing_leaves_it_pointing_forward():
    assert pointer.rotate(IDENT, Y) == pytest.approx((0, 1, 0), abs=1e-9)


def test_a_quarter_turn_about_z_swings_the_top_edge_to_the_left():
    # Right-hand rule about +Z (out of the screen) takes +Y towards -X.
    assert pointer.rotate(about(Z, 90), Y) == pytest.approx((-1, 0, 0), abs=1e-9)


def test_turning_right_gives_positive_yaw():
    """Turning right is a negative rotation about +Z, and must move the
    cursor right. Getting this sign wrong is the classic mirrored pointer."""
    yaw, pitch = pointer.aim(IDENT, about(Z, -20))
    assert math.degrees(yaw) == pytest.approx(20, abs=1e-6)
    assert pitch == pytest.approx(0, abs=1e-9)


def test_tilting_up_gives_positive_pitch():
    yaw, pitch = pointer.aim(IDENT, about(X, 15))
    assert math.degrees(pitch) == pytest.approx(15, abs=1e-6)
    assert yaw == pytest.approx(0, abs=1e-9)


def test_recentring_makes_any_grip_the_middle():
    """Whatever you were holding when you tapped recentre is dead centre —
    this is what lets the phone be held like a remote, flat, or tilted."""
    grip = about(X, 55)
    assert pointer.aim(grip, grip) == pytest.approx((0, 0), abs=1e-9)


def test_rolling_the_wrist_does_not_move_the_cursor():
    """Spinning about the direction you are pointing cannot move the point
    you are pointing at. Extracting an axis gets this for free; Euler
    angles would not."""
    rolled = pointer.multiply(about(Z, -20), about(Y, 40))
    yaw, pitch = pointer.aim(IDENT, rolled)
    assert math.degrees(yaw) == pytest.approx(20, abs=1e-6)
    assert pitch == pytest.approx(0, abs=1e-9)


def test_euler_conversion_matches_a_known_orientation():
    """The W3C ordering is intrinsic Z-X'-Y''. alpha alone is a rotation
    about +Z."""
    assert pointer.from_euler(90, 0, 0) == pytest.approx(about(Z, 90), abs=1e-9)
    assert pointer.from_euler(0, 90, 0) == pytest.approx(about(X, 90), abs=1e-9)
    assert pointer.from_euler(0, 0, 90) == pytest.approx(about(Y, 90), abs=1e-9)
