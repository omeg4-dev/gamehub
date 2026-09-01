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

    # --- what the hub asks ------------------------------------------------
    def alive(self, now):
        return (self.last_frame is not None
                and now - self.last_frame <= config.IDLE_TIMEOUT)

    def state(self):
        x, y = self.aimer.last
        return {"x": x, "y": y, "sensitivity": self.aimer.sensitivity}

    # --- internals --------------------------------------------------------
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
