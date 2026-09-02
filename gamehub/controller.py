"""One phone, and everything it is currently doing.

Frames arrive sixty times a second; this decides what is worth telling the
hub about. It holds no sockets and no asyncio, so the whole of it can be
driven from a test with a list of numbers.
"""
from . import config
from .pointer import Aimer

AXES = (("right", "left"), ("forward", "back"), ("up", "down"))


class Controller:
    def __init__(self, aimer=None):
        self.aimer = aimer or Aimer()
        self.last_frame = None
        self.last_q = (1.0, 0.0, 0.0, 0.0)
        self.last_gesture = None
        self.pending_recentre = True
        self.flick_rate = config.FLICK_RATE
        self.peak = 0.0
        self._aim_before = None
        self._armed = True
        self._last_flick = None

    # --- what the phone sends --------------------------------------------
    def frame(self, q, accel, t):
        self.last_frame = t
        self.last_q = q
        if self.pending_recentre:
            # The first frame after connecting is the middle of the screen:
            # nobody should have to press anything to get a cursor.
            self.aimer.recentre(q)
            self.pending_recentre = False
        x, y = self.aimer.update(q, t)
        events = [{"type": "pointer", "x": x, "y": y}]
        flick = self._flick(t)
        if flick is not None:
            events.append(flick)
        swing = self._swing(accel, t)
        if swing is not None:
            events.append(swing)
        return events

    def button(self, name, down):
        return {"type": "button", "name": name, "down": bool(down)}

    def recentre(self):
        """Point at the middle of the screen, tap, and this is the middle."""
        self.aimer.recentre(self.last_q)

    def set_sensitivity(self, value):
        self.aimer.sensitivity = float(value)

    def set_flick_rate(self, value):
        self.flick_rate = float(value)

    def take_peak(self):
        """The fastest flick since this was last asked, and reset.

        The calibration screen needs a number to show; anything slower is
        noise by the time the next question is asked.
        """
        peak, self.peak = self.peak, 0.0
        return peak

    # --- what the hub asks ------------------------------------------------
    def alive(self, now):
        return (self.last_frame is not None
                and now - self.last_frame <= config.IDLE_TIMEOUT)

    def state(self):
        x, y = self.aimer.last
        return {"x": x, "y": y, "sensitivity": self.aimer.sensitivity}

    # --- internals --------------------------------------------------------
    def _flick(self, t):
        """A wrist snap, as a direction.

        The test is on how fast the aim is moving, not on where it has got
        to, so a phone held at a steady tilt produces nothing at all -- and
        after one flick the wrist has to slow down again before another can
        fire, which is what stops a single snap arriving as four.
        """
        yaw, pitch = self.aimer.raw
        before, self._aim_before = self._aim_before, (yaw, pitch, t)
        if before is None:
            return None
        was_yaw, was_pitch, was_t = before
        dt = t - was_t
        # A gap in the frames is not a fast movement, it is a missing one.
        if not 0 < dt <= 0.25:
            return None
        rate_x = (yaw - was_yaw) / dt
        rate_y = (pitch - was_pitch) / dt
        rate = max(abs(rate_x), abs(rate_y))
        self.peak = max(self.peak, rate)
        if rate < self.flick_rate:
            if rate < config.FLICK_REARM:
                self._armed = True
            return None
        if not self._armed:
            return None
        if (self._last_flick is not None
                and t - self._last_flick < config.FLICK_REFRACTORY):
            return None
        self._armed = False
        self._last_flick = t
        if abs(rate_x) >= abs(rate_y):
            where = "right" if rate_x > 0 else "left"
        else:
            where = "up" if rate_y > 0 else "down"
        return {"type": "flick", "dir": where, "rate": rate}

    def _swing(self, accel, t):
        """A swing is a peak, not a period.

        Hard acceleration lasts a tenth of a second, which is six frames;
        without the refractory window a single throw would arrive as six
        gestures and a bowling ball would be released six times.
        """
        magnitude = sum(component ** 2 for component in accel) ** 0.5
        if magnitude < config.SWING_MS2:
            return None
        if (self.last_gesture is not None
                and t - self.last_gesture < config.SWING_REFRACTORY):
            return None
        self.last_gesture = t
        index = max(range(3), key=lambda i: abs(accel[i]))
        positive, negative = AXES[index]
        return {"type": "gesture",
                "dir": positive if accel[index] > 0 else negative,
                "strength": magnitude / config.SWING_MS2}
