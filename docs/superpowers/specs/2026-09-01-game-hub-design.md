# Game Hub — design

*2026-09-01*

A launcher for small casual games, driven by a phone held like a Wii remote. The
phone opens a page on the LAN, its gyroscope becomes a pointer on the screen,
and the hub is a channel grid you point at and click.

This replaces the Tauri sketch in `Ideen coding.md`. The hub, the games and the
controller are all web pages; the only native part is a Python server and the
Brave window it opens.

## 1. Decisions

| Question | Answer |
|---|---|
| Where it appears | Fullscreen on the desk by default; `--tv` puts it on the television and blacks the desk, reusing tv mode's transitions |
| What the pointer moves | A cursor the hub draws itself. The system pointer is never touched — no uinput, no udev rule, and the phone can never wander into the real desktop |
| Tech | HTML5 + canvas in a Brave app window, served by Python |
| Players | One phone, one player |
| Pointing model | Absolute, with a recentre button |
| Phone | Android / Brave |
| Look | Wii-inspired, drawn fresh. No Nintendo assets |
| Saved | High scores, favourites, recently played |
| Without a phone | Mouse and keyboard drive the same events |
| Adding games | Drop-in folders with a `game.json`, discovered at launch |
| Launched by | A desktop entry |
| First cut | Pointer, hub, one purpose-built pointer game. Snake and Color Sort are a second, smaller plan |

Rejected: a thin relay with the pointer maths in browser JS (the piece that
decides whether this feels like a Wii would then be untestable without a phone
in hand), and a WebRTC datachannel (signalling and ICE, to save a millisecond on
a LAN).

## 2. Architecture

Two processes: a Python server, and one Brave window pointed at it.

```
~/Projects/gamehub/
  gamehub/
    config.py      port 8730, paths, tuning constants
    net.py         LAN address from `ip -j route get`, token, QR png
    tls.py         self-signed cert with the LAN IP as a SAN
    pointer.py     fusion, recentring, smoothing — pure, no I/O
    controller.py  the connected phone: pointer state, buttons, gestures
    library.py     discovers games/, validates manifests
    store.py       scores and favourites on disk
    server.py      aiohttp: static files + /ws/phone + /ws/hub
    launcher.py    picks the screen, starts Brave, tears it all down
    __main__.py    `gamehub [--tv]`
  web/hub/         the channel grid
  web/phone/       the controller
  web/shared/      gamehub-api.js, loaded by every game
  games/pointer-demo/
  tests/  traces/
```

Everything needed is already installed: `aiohttp` 3.13.5, `websockets` 16.1.1,
`qrcode`, `openssl`. Brave's binary is `brave-origin`.

### Data flow

The phone opens `https://<lan-ip>:8730/<token>/phone`, reached by scanning a QR
on the screen. A 32-hex `secrets.token_hex(16)` is the first path segment and
anything without it gets 403; the server binds to the LAN address only, never
`0.0.0.0`. This is the tv-mode streaming pattern, and for the same reason.

Orientation frames go up `/ws/phone` at 60 Hz. `Controller` feeds them to
`Pointer`, which emits screen coordinates. The server broadcasts `pointer`,
`button` and `gesture` messages down `/ws/hub`. The hub page draws the cursor
and forwards the same events to the running game.

### The window

```
brave-origin --app=https://127.0.0.1:8730/<token>/hub \
             --class=dev.omega.gamehub \
             --user-data-dir=~/.local/state/gamehub/browser
```

Its own profile directory, so it never disturbs the real Brave session and one
Hyprland window rule can target it exactly. `--tv` sends it to the TV workspace
and blacks the desk; without the flag it is fullscreen on the main monitor.

Games run in an `<iframe>` inside the hub page and talk to it over
`postMessage`. One browser window for everything, and the hub can always take
control back — the Home button still works when a game has wedged its own loop.

## 3. The pointer pipeline

The part that decides whether this feels like a Wii or like a chore.

**On the phone.** `deviceorientation` gives `alpha/beta/gamma`; the page turns
them into a quaternion and sends `{t, q:[w,x,y,z], a:[ax,ay,az]}` as JSON,
throttled to 60 Hz — about 5 KB/s, small enough that debuggable JSON beats a
binary packing. `devicemotion` supplies `a` for gestures.

**On the server**, `pointer.py`, in order:

1. **Recentre.** Tapping recentre stores the current quaternion as `q₀`. Every
   later frame is reduced to `r = q₀⁻¹ ⊗ q`, the rotation away from wherever you
   were pointing when you tapped. This is what makes grip irrelevant: hold the
   phone like a Wiimote, flat like a TV remote, or at whatever angle is
   comfortable, and recentring calls that the middle of the screen.
2. **Pointing axis.** Rotate the phone's top edge (`+Y`) by `r`. Yaw is
   `atan2(-v.x, v.y)`, pitch is `atan2(v.z, hypot(v.x, v.y))`. Extracting an
   axis rather than Euler angles is roll-free for nothing: spinning the phone
   about the direction it points does not move the axis, so the cursor does not
   tilt when your wrist does.
3. **Map to the screen.** `x = 0.5 + yaw / (2·HALF_ANGLE)`, likewise pitch, with
   `HALF_ANGLE` about 22° — turn 22° right and you are at the right edge. This
   is the one number that must be tuned by feel, so it is a config constant and
   the phone carries a sensitivity slider.
4. **Smooth with a one-euro filter**, not a fixed average. It barely lags a fast
   flick and still kills the shake when you hold on a menu card — the trade an
   EMA cannot make.
5. **Clamp** with a small overshoot margin, so the cursor parks against an edge
   instead of vanishing.

**Drift** is real; the gyro's yaw wanders over minutes. The recentre button
handles it and nothing cleverer — auto-recentring guesses wrong exactly when you
are aiming carefully.

**Gestures** come off the acceleration: magnitude past ~2.2 g, direction from
the peak in the recentred frame, then a 250 ms refractory window so one swing is
one event rather than nine.

**Disconnection.** No frame for a second and the phone is gone: the cursor
fades, a reconnect QR drops over whatever is running, and the game gets
`onPause()`.

**Fallback.** The hub page treats a real `mousemove` as another pointer source
and maps keys to A / B / d-pad / Home, bypassing Python entirely. Every screen
can therefore be built, tested and screenshotted without the phone.

### Tuning constants (`config.py`)

| Name | Start | Meaning |
|---|---|---|
| `HALF_ANGLE` | 22° | degrees from centre to screen edge |
| `MIN_CUTOFF` | 1.0 | one-euro filter, jitter at rest |
| `BETA` | 0.007 | one-euro filter, lag when moving |
| `SWING_G` | 2.2 | gesture threshold |
| `SWING_REFRACTORY` | 0.25 s | one swing, one event |
| `IDLE_TIMEOUT` | 1.0 s | phone considered gone |
| `FRAME_HZ` | 60 | phone send rate |

## 4. The phone controller

Portrait, one-handed, no scrolling or zooming (`touch-action: none`), screen
kept awake with `navigator.wakeLock`, `navigator.vibrate` on every press and
gesture. Dark, so it does not light the room.

Laid out like the remote it imitates, top to bottom: a status dot and the
running game's name; a round d-pad; a large round **A** in the middle; a
full-width **B** bar under it where the thumb rests; then small **Home** and
**Pause**. A **⌖ recentre** sits in the top right, deliberately far from A so it
is never hit by accident. A gear opens a sheet with the sensitivity slider and a
record-trace toggle.

Buttons send `{type:"button", name:"a", down:true}` on press and release; the
pointer stream is continuous and separate.

A game declares what it uses in its manifest, and the controller dims the
controls that game ignores — a pointer-only game shows a greyed d-pad rather
than a lying one.

## 5. The hub

A grid of rounded cards on a soft gradient, twelve to a page, with a clock and
date along the bottom and page arrows when there are more. Hovering lifts a
card, plays a short chime and floats its title beside the cursor. The cursor is
an SVG hand with a slight lean in the direction it is travelling.

**A** on a card zooms it to fill the screen, then loads the game in the iframe.
**Home** inside a game asks "Return to the hub?" and reverses the zoom.
Favourites are a star in a card's corner; the grid orders favourites first, then
recently played, then the rest.

While no phone is connected the hub is the connect screen — QR, LAN address, and
a line saying the mouse works too. Once connected the QR shrinks into a corner
badge, and returns full-size if the phone drops.

### The plugin contract

```json
{
  "name": "Color Sort",
  "icon": "icon.png",
  "thumbnail": "thumbnail.png",
  "entry": "index.html",
  "description": "Sort coloured liquids into matching containers",
  "controls": ["pointer", "a", "b"],
  "score": { "order": "high" }
}
```

Discovered at launch by scanning `games/`. A malformed manifest never crashes
the hub: the folder is skipped and listed on a Problems panel with the reason,
the same way a bad link is shown in tv mode's queue.

`web/shared/gamehub-api.js`, loaded by every game:

```js
GameHub.on('pointer',  ({x, y}) => {})        // 0..1, already smoothed
GameHub.on('button',   ({name, down}) => {})
GameHub.on('gesture',  ({dir, strength}) => {})
GameHub.onPause(fn)
GameHub.onResume(fn)
GameHub.ready()                                // loaded; hub ends the zoom
GameHub.submitScore(n)
GameHub.highScores()                           // -> Promise<[{score, when}]>
GameHub.exit()                                 // back to the grid
```

The hub draws the cursor over the iframe, so games need not; a game that wants
its own crosshair sets `"cursor": "own"`.

## 6. Storage

`~/.local/share/gamehub/scores.json` and `state.json` (favourites, last played,
sensitivity), written to a temporary file and renamed, so a crash mid-write
cannot leave a truncated file. No accounts, no network, nothing that leaves the
machine.

## 7. Testing

Unit, under pytest, all without a phone or a display:

- `pointer.py` against recorded traces in `traces/`, captured by the phone's own
  record mode: a still trace must drift under 5 px over 60 s, recentre
  must land at exactly 0.5/0.5, a slow sweep must be monotonic, one swing must
  produce exactly one gesture.
- `controller.py` — button press/release, the disconnect timeout, gesture
  refractory.
- `net.py` — the token gate answers 403, the address comes from the routing
  table, never `0.0.0.0`.
- `tls.py` — the certificate carries the current LAN IP as a SAN and is
  regenerated when the address changes.
- `library.py` — good manifests load, each way of being malformed is reported
  rather than raised.
- `store.py` — atomic write, score ordering, corrupt file recovered.

End to end, still headless: a fake phone that opens `/ws/phone`, replays a
trace, and asserts the right events arrive on `/ws/hub` — the shape of
`tests/live_stream_smoke.py`.

In the browser: the hub's mouse fallback drives a scripted run — grid renders,
card opens, game boots, score is submitted and read back — and `grim` takes the
screenshots for review.

## 8. Risks

1. **Secure context.** Chromium only fires `devicemotion` and
   `deviceorientation` on a secure origin, so a plain `http://192.168.x.x` page
   gets silently zero sensor events. Everything here depends on beating this.
   The first task in the plan is a spike: self-signed HTTPS with the LAN IP as a
   SAN (one "proceed anyway" tap, then permanent, and works for any phone) versus
   Brave's `unsafely-treat-insecure-origin-as-secure` flag (no cert, but must be
   set on every device). Nothing else is built until a real phone has been seen
   emitting sensor frames.
2. **Feel.** `HALF_ANGLE` and the filter constants are guesses until they are in
   your hands. Mitigated by the sensitivity slider and by the traces, which turn
   "floaty" into a number to tune against.
3. **`--class` under Wayland.** Chromium's ozone backend may not apply it; the
   window rule falls back to matching on title.
4. **iframe isolation.** `postMessage` handlers check the origin, and games are
   served from the same origin so no game can reach outside the hub.

## 9. Not in the first cut

Snake, Color Sort, the Crossy Road port, multiple phones, a fifth card in the
`Super+T` tv overlay, and any keybind — all deliberately later. The first cut
proves the pointer and the grid with one purpose-built game.
