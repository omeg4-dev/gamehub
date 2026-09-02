<div align="center">

# 🎮 Game Hub

**The TV is the screen. Everyone's phone is the remote.**

No app store, no pairing, no install — scan the QR code and your phone is a Wii remote.

<img src="docs/demo.gif" width="720" alt="Two phones driving the hub, then playing Balloon Rush">

</div>

---

### ✨ What it is

A living-room console made of a television, a laptop, and whatever phones are in the room.
Point a phone camera at the QR code on screen, accept the certificate once, and you have a
cursor, a d-pad, A and B, and a motor that buzzes when something on screen hits you.

Up to **four at once** — own colour, own name, own cursor. Put your phone down, pick it back
up, and you get your slot back.

### 🕹️ In the box

| | | |
|---|---|---|
| 🐍 **Snake** | 1 player | Steer with a wrist flick. A flick is a *rate*, so holding the phone tilted does nothing. |
| 🐔 **Road Hop** | 1 player | Lanes, a river, a level crossing, and an eagle if you fall behind. |
| 🧪 **Colour Sort** | 1 player | Boards are dealt by undoing legal pours from solved, so every one is solvable. |
| 🎈 **Balloon Rush** | 1–4 | Everyone pops at once. Combos, gold, and a bomb that costs you three. |
| 💣 **Hot Potato** | 2–4 | The bomb buzzes in *your* hand and only you know how close it is. |

Twenty more are designed in [`docs/plans/`](docs/plans/).

### 🧠 How it works

The phone streams orientation as quaternions, sixty times a second, over a token-gated HTTPS
socket. **Everything else happens in Python** — sensor fusion, recentring, the map from an
angle to a point on screen, the flick detector. So the entire feel of the pointer is testable
with pytest, and a game never learns that a phone exists.

```
phone (quaternions) ──wss──▶ server (fusion · aim · flicks) ──postMessage──▶ game
```

A game is a folder with a `game.json` and an `index.html`. It gets a pointer in 0..1
coordinates, buttons, flicks, and one call to buzz a specific player's phone. That's the whole
contract.

### 📱 The remote adapts

Controls a game ignores are **removed** from the phone, not greyed out. When what's left is A
alone, the button stops being a circle and becomes the whole screen — nothing to miss.

Flick sensitivity isn't a guess either: tap ⚙️ → Calibrate, snap your wrist five times, and the
threshold is set from what your hand actually does.

### 🚀 Run it

```sh
python -m gamehub     # open the URL it prints, on the TV
./install.sh          # adds a desktop entry
```

Python 3.11+, `aiohttp`, `cryptography`, `pillow`, `qrcode`. The server makes its own
certificate for the LAN address facing the television — phones won't hand out motion sensors
without HTTPS, which is the single most annoying fact about this project.

Nothing is written outside `~/.local/share/gamehub/` and `~/.local/state/gamehub/`.

### ✅ Tests

```sh
python -m pytest      # 150 passed
```

Game rules run headless in node against a canvas-free `world.js`. Every page is opened in
headless Chromium and the check **fails on any console error** — a game whose script throws
paints nothing, and nothing looks exactly like a deliberately empty screen.

---

<div align="center">
<sub>MIT · every pixel of artwork drawn in-repo, in code</sub>
</div>
