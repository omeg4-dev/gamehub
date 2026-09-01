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


def _alpha(cutoff, dt):
    tau = 1 / (2 * math.pi * cutoff)
    return 1 / (1 + tau / dt)


class OneEuro:
    """Smoothing that loosens when you move.

    A fixed average has one setting and both jobs are wrong at it: steady
    enough to hold a hover means lagging a flick, and quick enough to
    follow a flick means the cursor buzzes at rest. This one raises its
    cutoff with the observed speed, so it does both.
    """

    def __init__(self, min_cutoff=config.MIN_CUTOFF, beta=config.BETA,
                 d_cutoff=config.D_CUTOFF):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff
        self._value = None
        self._speed = 0.0
        self._t = None

    def __call__(self, value, t):
        if self._value is None or self._t is None or t <= self._t:
            self._value, self._t = value, t
            return value
        dt = t - self._t
        speed = (value - self._value) / dt
        self._speed += _alpha(self.d_cutoff, dt) * (speed - self._speed)
        cutoff = self.min_cutoff + self.beta * abs(self._speed)
        self._value += _alpha(cutoff, dt) * (value - self._value)
        self._t = t
        return self._value


class Aimer:
    """Orientation in, a place on the screen out.

    Coordinates are 0..1 with the origin top-left, so nothing here needs to
    know the resolution -- only the shape, which is baked into the two half
    angles.
    """

    def __init__(self, half_x=config.HALF_ANGLE_X, half_y=config.HALF_ANGLE_Y):
        self.half_x = half_x
        self.half_y = half_y
        self.sensitivity = 1.0
        self.reference = (1.0, 0.0, 0.0, 0.0)
        self.last = (0.5, 0.5)
        self._fx = OneEuro()
        self._fy = OneEuro()

    def recentre(self, q):
        """Call this the middle of the screen."""
        self.reference = q
        self._fx = OneEuro()
        self._fy = OneEuro()
        self.last = (0.5, 0.5)

    def update(self, q, t):
        yaw, pitch = aim(self.reference, q)
        x = 0.5 + self.sensitivity * yaw / (2 * self.half_x)
        y = 0.5 - self.sensitivity * pitch / (2 * self.half_y)
        limit = 1 + config.OVERSHOOT
        x = min(max(self._fx(x, t), -config.OVERSHOOT), limit)
        y = min(max(self._fy(y, t), -config.OVERSHOOT), limit)
        self.last = (x, y)
        return self.last

    def settle(self, q, seconds=1.0, hz=config.FRAME_HZ):
        """Hold an orientation still and let the filter catch up.

        Only the tests use this; it is the honest way to assert on a
        filtered value without asserting on the filter's transient.
        """
        start = self._fx._t or 0.0
        for i in range(int(seconds * hz)):
            self.update(q, start + (i + 1) / hz)
        return self.last
