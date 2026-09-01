"""Turning a phone's orientation into a place on the screen.

The whole trick is in `aim`: reduce the current orientation to a rotation
away from wherever the phone was when you tapped recentre, apply that to
the phone's top edge, and read off where that edge now points. Working
with an axis rather than with Euler angles is what makes the result immune
to rolling your wrist -- spinning about the direction you point cannot
change the point.
"""
import math

from . import config

TOP_EDGE = (0.0, 1.0, 0.0)      # the phone's +Y: the end you aim with


def from_euler(alpha, beta, gamma):
    """The W3C deviceorientation angles as a quaternion (intrinsic Z-X'-Y'')."""
    z, x, y = (math.radians(a) / 2 for a in (alpha, beta, gamma))
    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)
    return (cx * cy * cz - sx * sy * sz,
            sx * cy * cz - cx * sy * sz,
            cx * sy * cz + sx * cy * sz,
            cx * cy * sz + sx * sy * cz)


def conjugate(q):
    w, x, y, z = q
    return (w, -x, -y, -z)


def multiply(a, b):
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return (aw * bw - ax * bx - ay * by - az * bz,
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw)


def rotate(q, v):
    w, x, y, z = q
    vx, vy, vz = v
    tx = 2 * (y * vz - z * vy)
    ty = 2 * (z * vx - x * vz)
    tz = 2 * (x * vy - y * vx)
    return (vx + w * tx + y * tz - z * ty,
            vy + w * ty + z * tx - x * tz,
            vz + w * tz + x * ty - y * tx)


def aim(reference, current):
    """Yaw and pitch, in radians, of the top edge relative to `reference`.

    Positive yaw is to the right of centre, positive pitch is above it.
    """
    relative = multiply(conjugate(reference), current)
    x, y, z = rotate(relative, TOP_EDGE)
    return math.atan2(x, y), math.atan2(z, math.hypot(x, y))
