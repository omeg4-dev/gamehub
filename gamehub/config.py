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
BETA = 0.007                      # higher: less lag when moving fast
D_CUTOFF = 1.0

# --- gestures ---------------------------------------------------------
SWING_MS2 = 21.6                  # ~2.2 g, gravity already removed
SWING_REFRACTORY = 0.25           # seconds; one swing is one event

# --- liveness ---------------------------------------------------------
IDLE_TIMEOUT = 1.0                # seconds without a frame = phone gone
FRAME_HZ = 60
