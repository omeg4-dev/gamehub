# The next two games

*Written 2026-09-02. Plans only — nothing here is built yet.*

## What the shelf already covers

| Game | Players | Controls | What it is |
|---|---|---|---|
| Snake | 1 | d-pad, flick | tight-loop arcade, one life, high score |
| Road Hop | 1 | d-pad, flick | forward-pressure arcade, one life, high score |
| Colour Sort | 1 | pointer | slow puzzle, no clock |
| Balloon Rush | 1–4 | pointer, A, gesture | everyone against the screen |
| Hot Potato | 2–4 | pointer, A | everyone against each other, but only socially — nobody's *hands* fight |

Read that table as a map and the holes are obvious.

1. **Nothing is head-to-head.** Hot Potato is the closest, and it is a game of
   nerve and blame, not of reflex. There is no game in the box where my hand
   beating your hand is the whole point.
2. **The tilt angle is unused as an analogue axis.** The pointer maps aim to a
   screen *position*; a flick is a *rate* event. Nobody holds the phone like a
   bat and gets an axis out of it — which is the one thing a phone does better
   than a gamepad, and the reason the Wii sold.
3. **Nobody drives and aims at the same time.** Every game uses either the
   pointer or the d-pad. The combination — left hand moves, right hand aims —
   is the most-loved control scheme on the console this thing imitates, and
   the phone can do it: tilt aims, thumb drives.
4. **Nothing rewards a trick shot.** Every skill on the shelf is reaction speed
   or planning. Nothing rewards geometry — the shot you saw three seconds ago
   and everyone else did not.

So: one game that is a duel of hands, and one game that is a duel of aim.

---

## Game 1 — **Rebound**

*1–4 players. The Pong descendant. Hold the phone like a bat.*

### The idea

A square arena. Every player owns one edge and defends it with a paddle. A ball
bounces around; if it gets past your edge you lose a heart; at zero hearts your
edge seals up into a wall and the survivors keep going in a smaller, meaner
arena. Last one holding hearts wins.

Player counts change the arena rather than the rules:

- **4 players** — all four edges are paddles. This is the party mode.
- **3 players** — three paddles, the fourth edge is a wall. Asymmetric on
  purpose: the wall is the safe direction and everyone knows it.
- **2 players** — left and right are paddles, top and bottom are walls.
  Straight Pong, which is exactly what people will ask for.
- **1 player** — one paddle at the bottom, three walls, the ball accelerates
  and the paddle shrinks every ten hits. This is the mode that feeds the high
  score board (rallies survived).

### Why it fits

It is the missing head-to-head slot, it is the reason the pointer exists, and
it is legible from a sofa at a glance — a ball, some hearts, four coloured
edges. It also needs **zero new control plumbing**: the server already sends
each player a smoothed 0..1 pointer. A left/right paddle reads `pointer.y`, a
top/bottom paddle reads `pointer.x`. The tilt-as-an-axis feel comes free from
work that is already done and already tested.

### Controls

- **Tilt** — slide the paddle along your edge. Direct position mapping, not
  velocity: where you point is where the paddle is. Recentre (the crosshair
  knob) already exists for when someone's arm drifts.
- **A** — *smash*. The paddle lunges a short distance into the arena for
  ~90 ms. Hitting the ball during a lunge adds a fixed speed bonus and tints
  the ball your colour. ~1.2 s cooldown, drawn as a ring that refills around
  your edge. This is the skill verb: without it Rebound is positioning only,
  and positioning alone gets boring at the third round.
- **B** — nothing. So `controls` is `["pointer", "a"]`, which means **the phone
  goes into the one-button layout** and the whole screen becomes the smash.
  That is the right feel for a game you play with your arm.

### Feel — the things that make it worth playing twice

- Ball speeds up per paddle hit, hard cap, and resets on a concede.
- Reflection angle depends on where along the paddle you hit — centre is
  straight, edges are steep. Everyone works this out in one round without
  being told, and that is the whole game's depth.
- The ball carries the colour of whoever last touched it, so a concede is
  visibly *somebody's* point, not just your failure.
- A quarter-second of slow motion on the killing ball, then the screen shakes
  and the losing edge slams shut.
- Rumble: light (15 ms) when you hit, heavy (120 ms) when you concede. Only
  your phone buzzes — the addressed-rumble routing already handles that.
- Hearts are pips outside each edge in that player's colour. No numbers.

### Rules live in `games/rebound/world.js`

Canvas-free, so node runs it directly. Unit-square arena, ball as
`{x, y, vx, vy, owner}`, four edges each `{paddle, hearts, alive, smashUntil}`.

Three things will go wrong if they are not designed in from the start:

1. **Tunnelling.** At the speed cap a per-frame position update steps straight
   through a paddle and out the back. The fix is continuous collision: inside
   `step(dt)`, solve time-of-impact against the four edge planes, take the
   earliest, resolve that one bounce, and recurse on the remaining time. Never
   move-then-test.
2. **Axis-parallel drift.** In a four-paddle arena a ball with `vy ≈ 0` never
   reaches the top and bottom players and the round stalls. After every bounce,
   clamp the direction to at least ~18° off both axes.
3. **Corners.** A ball arriving at a corner is inside two edge planes on the
   same frame. Resolving one bounce per step and re-solving falls out of the
   recursion in (1) for free — but only if bounces are resolved one at a time.

### Node checks (`tests/js/rebound.js`)

- a ball at the speed cap crossing a paddle in one step still bounces
- reflection angle tracks the hit offset along the paddle (centre → straight)
- a bounce never leaves the direction within 18° of an axis
- a corner arrival produces two bounces, not one and a leak
- a smash adds speed exactly once and only while the lunge is live
- the cooldown blocks a second smash
- conceding costs exactly one heart, even if the ball is still behind the line
- a dead edge is solid: the ball bounces off it like a wall
- the last player standing ends the round
- the two- and three-player arenas seal the right edges
- solo mode shrinks the paddle every ten hits and never below the floor

### Also to do

- `games/rebound/game.json` — `controls: ["pointer", "a"]`, `players: "many"`,
  `score.order: "high"`.
- `rebound()` in `scripts/thumbnails.py` — the square arena, four coloured
  edges, a ball mid-flight with a trail.
- `"games/rebound/index.html?players=4"` in `tests/test_render.py`.
- `?players=N` preview so the four-edge layout is what gets photographed.

### Rough size

The smallest of the two. The physics is a day's careful work and the rest is
drawing rectangles. Build this one first.

---

## Game 2 — **Tank Yard**

*1–4 players. Top-down. Bullets bounce off walls, including back into you.*

### The idea

A small walled yard seen from above, laid out from a handful of fixed maps.
Each player drives a tank, aims a turret, and fires shells that **ricochet**.
Two live shells at a time, three bounces each, and a shell that comes back kills
the tank that fired it. Last tank alive wins the round; best of five wins the
match.

### Why it fits

This is Wii Play's *Tanks!* — the mode people actually remember — and it is the
only design on the table that uses the pointer and the d-pad **at once**. That
combination is the single biggest unused capability in the room: the left thumb
drives, the whole hand aims. Nothing else on the shelf asks for both hands to
do different jobs, and that is what makes a control scheme feel like hardware
rather than a web page.

It also fills hole 4. Every other game rewards speed. This one rewards seeing
a two-bank shot into someone's flank and taking it while they are reversing.

### Controls

- **d-pad** — drive. Absolute four-way (up is up on the screen), not
  tank-style rotate-and-go. Rotate-and-go is more authentic and much worse on a
  d-pad you cannot feel; absolute is what people expect from a phone.
- **Tilt** — aim the turret. The existing pointer, read as an angle from the
  tank rather than a screen position.
- **A** — fire. Hard limit of two live shells; the limit *is* the balance.
- **B** — drop a mine. Two per round, arms after 1 s, kills anything in the
  blast including its owner.

`controls: ["pointer", "a", "b", "dpad"]` — the full remote, and the first game
in the box that asks for all of it.

### Modes

- **Versus (2–4).** Deathmatch on a random map from the set. Rounds are short —
  thirty seconds is a long round — and the score is rounds won.
- **Solo waves.** Escalating AI tanks, high score = waves cleared. This is what
  makes it a game one person can start on a quiet evening, and it is the reason
  it lands on the same shelf as Snake rather than being a party-only novelty.

### Staging — this is the important part

Tank Yard is roughly twice the work of Rebound, and nearly all of the extra is
the AI. So it ships in two commits:

**v1 — versus only.** Maps, driving, aiming, ricochet, mines, rounds, scoring.
Fully playable with two phones and nothing stubbed out. This is a complete
game and should be committed as one.

**v2 — solo waves and the AI.** Four tank behaviours, introduced one per few
waves so the escalation teaches itself:

1. *Brown* — stationary, fires straight lines only, slow reload.
2. *Grey* — patrols, still fires straight, faster reload.
3. *Green* — solves one-bounce shots. This is the wave where people start
   respecting walls.
4. *Black* — moves fast, lays mines, solves two-bounce shots, and will not fire
   a shot whose path returns to itself.

The one-bounce solver is the interesting piece and it is pure geometry: mirror
the target across each wall plane, aim at the mirror, check the segment is
clear. It is exactly the kind of thing that is a joy to unit-test and a misery
to debug on screen, so it gets tests before it gets a renderer.

### Rules live in `games/tank-yard/world.js`

Canvas-free. Arena as a grid of solid/empty cells plus a wall list, tanks as
`{x, y, facing, aim, shells, mines, alive}`, shells as
`{x, y, vx, vy, bounces, owner, age}`.

Known hazards to design in:

1. **Shell tunnelling** through thin walls at speed — same continuous-collision
   approach as Rebound. Write it once in a way both games can borrow.
2. **Self-kill grace.** A shell must not kill its owner in the first ~200 ms or
   firing point-blank at a wall is instant suicide and feels broken rather than
   funny. After the grace it *should* — that is the joke.
3. **Corner wedging.** A tank driving diagonally into a corner sticks. Resolve
   the two axes separately so a blocked axis still slides along the other.
4. **Spawn safety.** Never spawn a tank where a live shell can reach it in
   under a second.

### Node checks (`tests/js/tank-yard.js`)

- a shell reflects off a vertical wall (x flips, y does not) and a horizontal
  one, and off an inside corner
- a shell dies on its fourth bounce, not its third
- a shell at max speed does not pass through a one-cell wall
- a shell cannot kill its owner inside the grace window, and can after it
- a third shot is refused while two are live, and allowed after one expires
- a mine does not arm before 1 s and kills its owner after it
- a tank driving into a corner slides instead of sticking
- the one-bounce solver finds the shot on a map where one exists, and reports
  none where it does not
- the black tank refuses a shot whose path returns to its own hull
- a round ends when one tank is left, and the match at three round wins

### Also to do

- `games/tank-yard/game.json` — full control set, `players: "many"`,
  `score.order: "high"`.
- `tank_yard()` in `scripts/thumbnails.py` — two tanks, a wall, a shell mid-
  ricochet with its dotted path drawn in.
- `"games/tank-yard/index.html?map=2&players=4"` in `tests/test_render.py`.
- `?map=N&players=N` preview so a photographed frame has tanks on it.

---

## What was considered and left out

- **Territory paint** — four cursors scribbling over a canvas, most area wins.
  Free to build on the existing pointer, but the score is hard to read at a
  glance from a sofa, and a game whose state you cannot judge without counting
  is a game people stop caring about halfway through.
- **A rhythm game** — the fun is entirely in the music, and the music would
  have to be synthesised here. High risk of a technically correct game nobody
  wants to play twice.
- **A quiz** — needs a content pipeline, not a game engine. Wrong shape for
  this repo.
- **Sumo push-off** — genuinely good, but its control feel (tilt to steer, A to
  dash) is close enough to Rebound's that shipping both makes the shelf feel
  repetitive. Keep it in the drawer as a Rebound replacement if Rebound turns
  out flat.
- **A co-op defusal game** — one player reads a manual on their phone while the
  others act. Charming, but it puts the game on the phone screens and the TV
  becomes decoration, which is backwards for this box.

## Order

**Rebound first.** It is smaller, it fills the sharper hole, it needs no new
control plumbing, and its continuous-collision step is the piece Tank Yard will
borrow. Then **Tank Yard v1**, then **v2**.

## The checklist every new game goes through

- `games/<slug>/game.json` — name, description, `controls`, `players`,
  `score.order`
- `games/<slug>/index.html` — canvas, the Nunito face, `gamehub-api.js`,
  `world.js`, `game.js`
- `games/<slug>/world.js` — rules only, no canvas, no `window`
- `games/<slug>/game.js` — renderer, WebAudio guarded with
  `globalThis.AudioContext || globalThis.webkitAudioContext`
- `tests/js/<slug>.js` + a `@node` test in `tests/test_games.py`
- `tests/test_<slug>.py` for the manifest
- a preview query parameter, and an entry in `tests/test_render.py` using it
- a drawing function in `scripts/thumbnails.py`, and the regenerated
  `thumbnail.png`
- check `isSolo(controls)` — if the game asks only for A, the phone becomes one
  button and the layout should be looked at on a real handset
