"""Every number that might want tuning, in one place.

The pointer constants in particular are guesses until they have been in a
hand; keeping them here means tuning is an edit, not a hunt.
"""
import math
import os
from pathlib import Path

PORT = 8730
TV_IP = "192.0.2.30"          # only used to ask the routing table which
                                  # of our addresses faces the living room

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"
GAMES_DIR = ROOT / "games"

DATA_DIR = Path(os.path.expanduser("~/.local/share/gamehub"))
STATE_DIR = Path(os.path.expanduser("~/.local/state/gamehub"))

# --- pointing ---------------------------------------------------------
ASPECT = 16 / 9
# Turn this far from centre and the cursor is at the edge. The vertical
# angle is the horizontal one divided by the aspect, so a degree of wrist
# covers the same fraction of picture in both directions.
HALF_ANGLE_X = math.radians(22.0)
HALF_ANGLE_Y = HALF_ANGLE_X / ASPECT
OVERSHOOT = 0.02                  # cursor parks just past the edge, not off it

# --- one-euro filter --------------------------------------------------
MIN_CUTOFF = 1.0                  # lower: steadier at rest, laggier moving
# The published one-euro betas are around 0.007, but they are quoted for a
# signal measured in pixels. Ours is 0..1 across the whole screen, so the
# same number is a thousand times too small to loosen anything and a sweep
# lags by a sixth of a second. Scaled to this signal's units.
BETA = 1.5                        # higher: less lag when moving fast
D_CUTOFF = 1.0

# --- gestures ---------------------------------------------------------
SWING_MS2 = 21.6                  # ~2.2 g, gravity already removed
SWING_REFRACTORY = 0.25           # seconds; one swing is one event

# --- flicks -----------------------------------------------------------
# A flick is a *rate*, not an angle. Holding the phone tilted must do
# nothing at all, or a game you steer with it becomes a game you fight
# with: you would have to hold the phone level to go straight.
FLICK_RATE = 3.4                  # rad/s of aim movement that counts (~195 deg/s)
FLICK_REARM = 1.4                 # must slow below this before the next one
FLICK_REFRACTORY = 0.12           # seconds; one wrist snap is one event

# --- players ----------------------------------------------------------
MAX_PLAYERS = 4
# Player one is silver, like the remote that came in the box. The rest are
# told apart by colour alone, so these have to survive a photograph of a
# television across a room.
PLAYER_COLOURS = ["#3ec7ff", "#ff6f5e", "#5fd36a", "#ffc746"]

# --- liveness ---------------------------------------------------------
IDLE_TIMEOUT = 1.0                # seconds without a frame = phone gone
FRAME_HZ = 60
