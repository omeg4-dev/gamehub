# A shelf of twenty

*Written 2026-09-02. Plans only — nothing below is built.*

Five games are on the shelf today: Snake, Road Hop, Colour Sort, Balloon Rush,
Hot Potato. This is the plan for twenty. Numbers 1 and 2 are specified in full
in `2026-09-02-next-two-games.md`; the rest are specified here at the depth
needed to start one without thinking about it again.

Everything is drawn in-repo. Where a design descends from something famous, it
takes the mechanic and not the name or the art.

---

## The rule I used to pick them

A hub like this fails in one specific way: twenty games that are all the same
game. So each entry below had to earn a slot on **three** axes at once, and any
game that duplicated another on all three was cut.

**Control** — pointer aim · d-pad · flick · tilt as an axis · tilt as a board ·
swing · stillness · one button · mash · timing press

**Shape** — solo high score · duel · free-for-all · co-op · asymmetric ·
turn-based

**Pace** — twitch · medium · slow enough to hold a drink

The five that exist cover: pointer aim, d-pad, flick; solo high score,
free-for-all; twitch and slow. That is most of the twitch corner and almost
none of the rest. The twenty below are chosen to fill the rest.

---

# Wave 1 — an evening each

Small, complete games. Every one of these is finishable in a sitting, and each
one lands a control or a shape that nothing on the shelf has.

## 1. Rebound
**1–4 · pointer, A · duel · twitch**

Pong grown into a square. Everyone defends one edge; a concede costs a heart;
a dead edge seals into a wall. Full spec in the companion plan.

*Why:* the first head-to-head game, and the first use of tilt as an analogue
axis. Also the first game to use the one-button phone layout.

## 2. Tank Yard
**1–4 · pointer, d-pad, A, B · free-for-all · twitch**

Top-down yard, ricocheting shells, two live at a time, three bounces, and a
shell that comes home kills you. Full spec in the companion plan.

*Why:* the only design that drives and aims at once — the whole remote in both
hands.

## 3. Standoff
**2–4 · A only · duel · twitch**

Everyone waits. The screen is still. Somewhere between two and nine seconds
later it flashes and a sound cracks, and the first thumb down wins the round.
Move early and you are out of that round with a red card and everyone sees it.
Best of five.

*The hook:* it is the shortest game that will ever be on this shelf and it will
be played the most. The tension is entirely in the waiting, and the waiting is
free to build.

*Detail that matters:* report the reaction time in milliseconds, to the
millisecond, and keep a per-player best on the results card. The number is the
reason people go again. Measure it on the **server**, at the socket, not in the
browser — the phone's press is already timestamped there and that is the least
jittery clock in the room.

*Hazards:* a player who mashes continuously must be caught — track "down since
before the signal", not "pressed after it". Round delays must be uniformly
random per round, never a pattern anyone can learn.

*Checks:* a press before the signal is a false start; a press held from before
the signal never wins; two presses in the same frame resolve by socket
timestamp, not arrival order; the delay never repeats twice in a row.

*Size:* half a day. Build it first — it is the cheapest fun in the plan.

## 4. Trails
**2–4 · d-pad, flick · duel · twitch**

Light cycles. Everyone leaves a solid wall behind them, nobody can stop, last
one riding wins. Grid-based, one cell per tick, ticks speed up as the arena
fills.

*Why:* Snake already proved the tick loop, the turn queue and the "a backwards
turn is ignored, never fatal" rule. Trails is that engine with four snakes and
no apples, so it is nearly free — and it is a completely different game to
play, because the danger is other people.

*The hook:* the walls stay. A round starts open and ends as a knife fight in a
corridor. Give each player's wall their own colour and let the arena tell the
story of the round without a word of UI.

*Hazards:* two riders entering the same cell on the same tick must both die,
not whichever the loop happened to move first. Resolve all moves, then all
collisions.

*Checks:* a head-on into the same cell kills both; riding into your own wall
kills; a backwards flick is ignored; the tick interval shortens on schedule; a
round with one rider left ends immediately.

*Size:* half a day on top of Snake.

## 5. Echo
**1–4 · d-pad · free-for-all, elimination · medium**

Four coloured quarters on the screen. The hub plays a sequence — colour, tone,
colour, tone — and everybody repeats it on their d-pad at the same time. Get it
right and the sequence grows by one. Get it wrong and you are out, and the
survivors carry on with a longer sequence.

*The hook:* everyone plays every round simultaneously, so nobody watches
somebody else have a turn. And the tones are a chord that grows — the sequence
is audible as well as visible, which is why the original worked.

*Solo:* one player, the sequence grows forever, high score is the length
reached.

*Hazards:* the input window has to close on the slowest surviving player, not
on a fixed clock, or the game is a typing-speed test.

*Checks:* a correct repeat advances; a wrong press eliminates only that player;
the sequence is extended, never regenerated; the last survivor wins; the solo
run submits the sequence length.

*Size:* a day.

## 6. Odd One Out
**1–4 · pointer, A · free-for-all · medium**

A crowd of near-identical little characters fills the screen. One of them is
different — one wears a hat, or one is blinking, or one is facing the wrong
way. Point at it and press A. First correct hand scores; a wrong hand is locked
out for two seconds. Eight rounds, and the crowd grows and the difference
shrinks each time.

*Why:* the purest possible use of four cursors on one screen, and the cheapest
possible way to make four people lean forward at once.

*The hook:* the *kind* of difference changes round to round, so nobody can
settle into one way of looking. A late round where the difference is "one of
these two hundred faces blinks half a second slower" is genuinely thrilling.

*Hazards:* the difference must be generated, not authored, or there are twelve
rounds of content and then nothing. Build it as a list of difference
*generators* (hue shift, rotation, missing feature, extra feature, phase
offset) each with a difficulty parameter.

*Checks:* every generated board has exactly one odd character; the difficulty
parameter monotonically shrinks the difference; a wrong press locks out and
does not score; the round ends on the first correct press.

*Size:* a day, most of it drawing a face that reads at fifty pixels.

## 7. Skyline
**1–4 · A only · solo high score, or a race · twitch**

A block swings back and forth above your tower. Press A and it drops. The
overhang is sliced off and lost, so the tower narrows with every miss, and it
is over when nothing is left to land on. Blocks speed up as you climb; a
perfect landing forgives a sliver of an earlier miss and makes a satisfying
noise.

*Why:* one button, so the phone is one button — the layout we already built,
finally with the game it was designed for. Solo, it is a pure high score. With
2–4, everyone builds side by side on the same screen and the tallest tower when
the first player dies takes the round.

*Hazards:* the slice-and-narrow rule must be exact or the tower drifts sideways
into nonsense. Track each block as an interval, and the next block's landable
width is the intersection with the one below.

*Checks:* a perfect drop keeps the full width; an overhang narrows by exactly
the overlap error; zero overlap ends the run; the perfect bonus never exceeds
the original width; speed rises per height, not per second.

*Size:* half a day. The best fun-per-line in the plan.

---

# Wave 2 — the meat

Bigger, and this is where the shelf stops looking like a demo.

## 8. Ring Out
**2–4 · pointer, A · free-for-all · twitch**

Four round fighters on a circular platform over nothing. Tilt to walk, A to
dash. Dashing into somebody sends them flying with your momentum plus theirs.
The platform shrinks. Last one on it wins.

*The hook:* momentum, and the fact that a dash that misses leaves you skidding
past the edge yourself. Every good moment in this game is somebody's greed.

*Hazards:* elastic collision between two circles is easy to get subtly wrong
and the whole game is that one function. Write it in `world.js` with
conservation of momentum tested directly. Also: a dash must have recovery
frames, or the game is a mash-fest.

*Checks:* momentum is conserved across a collision; a dash imparts more impulse
than a walk; dash recovery blocks a second dash; leaving the platform
eliminates on the next step, not the same one (so the fall is visible); the
platform never shrinks below the floor radius.

*Size:* a day and a half. Reuses Rebound's collision work.

## 9. Labyrinth
**1–4 · tilt only · solo time attack, or a race · medium**

The whole screen is a wooden board with a maze routed into it and holes drilled
through. Tilt your phone and the board tilts — one ball, one goal, and a hole
is back to the start of the section. Solo is a time attack against the board's
own record; 2–4 is four balls on four copies of the same board, side by side,
first to the goal.

*Why:* the most literal thing a phone's gyroscope can do, and nothing on the
shelf does it. It is also the only game here where you can hand the phone to
somebody who has never played anything and they understand it in one second.

*The hook:* the board itself tilts, visibly — the whole rendered plank rotates
a few degrees under the ball. That one piece of feedback is what sells it.

*Hazards:* rolling-ball-on-a-tilted-plane needs friction and a speed cap or the
ball becomes uncontrollable in the second room. Use the *raw* aim, not the
smoothed pointer — the smoothing that makes a cursor calm makes a ball sluggish
(`Aimer.raw` already exists for exactly this).

*Checks:* zero tilt gives zero acceleration; the ball never tunnels a wall at
cap speed; a hole within its radius resets to the last checkpoint; the goal
stops the clock once; the multiplayer boards are identical seeds.

*Size:* a day and a half, plus however long is spent drawing boards. Six boards
is a game; twelve is a good game.

## 10. Waterworks
**1–4 · pointer, A · free-for-all · medium**

A grid of pipe tiles. Tap one to rotate it. Water starts at the inlet and
creeps forward on a timer that does not care whether you are ready. Get it to
the outlet before the water reaches a dead end. Everyone plays the same board
at the same time on their own quarter of the screen; the first to connect wins
the round and the others get to see how far they had got.

*Why:* the slow shelf has exactly one game on it (Colour Sort) and slow games
are what people actually play at half past eleven. This one has a clock, so it
is slow but not sleepy.

*The hook:* the water is visible the whole time. You can see your mistake
arriving.

*Hazards:* the board must be generated with a guaranteed solution, and — the
lesson from Colour Sort's `unpour` — the generator must build backwards from a
solved state, not forwards with a solvability check bolted on. Lay a path from
inlet to outlet, tile it, then rotate every tile randomly.

*Checks:* every generated board has a connected solution; rotating four times
returns a tile to its start; water advances one tile per interval and stops at
an unconnected face; a completed circuit ends the round; four players get
identical boards.

*Size:* a day and a half.

## 11. Mini Golf
**1–4 · pointer, A · turn-based · slow**

Nine holes drawn from above. Point to aim, hold A to charge the power bar,
release to hit. Ramps, water, sand that eats your speed, and a windmill on one
hole because there is always a windmill. Lowest total after nine wins.

*Why:* the first turn-based game, and the first game that lasts twenty minutes
rather than ninety seconds. A hub with nothing long on it is a hub people leave
after one drink.

*The hook:* watching somebody else's ball. Turn-based is only good when the
waiting is fun, and a rolling ball with three bank shots left in it is fun to
watch. Show the other players' phones a "your turn next" state so nobody has to
be told.

*Hazards:* ball-on-ramp is where this design either sings or dies; keep ramps
as constant-acceleration regions rather than real 3D, and it stays testable.
Also: a ball that never fully stops blocks the turn — apply a hard rest
threshold.

*Checks:* the power bar is linear and clamps; a bank off a wall preserves
speed minus a fixed loss; sand halves speed per second; water returns the ball
to its last rest with a stroke penalty; a ball below the rest threshold stops
the turn; the hole only accepts the ball below a capture speed.

*Size:* two days, and course design is most of it.

## 12. Bowling
**1–4 · swing, A · turn-based · slow**

Step up, hold A, swing the phone, let go. Ten frames, the real scoring — a
strike is worth what the next two balls are worth, and the tenth frame gets its
extra ball.

*Why:* this is the game the whole console was sold on, and it is the only
design here that uses the phone as a *thing you move* rather than a thing you
point. It needs new server work (below), and it is worth it.

*The hook:* the release. Everything else is set dressing.

*New server work — the swing detector.* Like the flick, this belongs in
`gamehub/controller.py`, not in a game: integrate the accelerometer while A is
held, take the peak forward speed and the lateral rate at the moment of
release, and send one `swing` event with `{speed, spin}`. That is the whole
interface. It is testable against a recorded trace, which is exactly why the
trace recorder exists.

*Hazards:* pin physics between pins is what makes bowling feel real, and full
rigid-body is out of scope. Ten circles with elastic collisions on a plane is
enough and is testable — reuse Ring Out's collision function.

*Checks:* the swing detector turns a recorded forward swing into a sensible
speed and near-zero spin, and a hooked swing into a spin; a strike scores the
next two balls; a spare scores the next one; the tenth frame allows a third
ball only when earned; the total of a perfect game is 300.

*Size:* two days, one of which is the swing detector — which Fishing and Golf
can then borrow.

## 13. Brickfall
**1–4 · pointer, A · solo high score, or co-op · twitch**

A wall of bricks, a ball, and a paddle you steer by tilt. Bricks drop
power-ups: a wider paddle, a slower ball, three balls at once, and one that is
a trap. Clear the wall and the next one is meaner.

*Why:* Rebound's physics with a completely different shape of tension — Rebound
is a fight, this is a run. It is also the natural 2–4 **co-op**: two to four
paddles across the bottom, one shared ball, shared lives. Co-op with a shared
ball is where friendships are tested.

*Hazards:* the classic bug — a ball hitting the corner of a brick where two
faces meet reflects on both axes and goes back where it came from. Decide the
face by comparing the penetration depth on each axis and reflect one axis only.

*Checks:* a brick struck from below reverses y only; a corner strike reflects
exactly one axis; the multi-ball power-up spawns balls that share the same
speed; losing every ball costs one life; the last brick ends the level.

*Size:* a day.

---

# Wave 3 — the ambitious end

Each of these is worth two of the ones above, and each buys something the shelf
cannot get any other way.

## 14. Quickfire
**1–4 · everything · free-for-all, elimination · twitch**

Five seconds. One instruction on the screen — *DODGE*, *MASH*, *POINT AT THE
RED ONE*, *DON'T MOVE*, *FLICK LEFT* — and then it is over and the next one
starts, faster. Miss three and you are out.

*Why:* it is a container, not a game, and that is the point. Every control in
the room gets used inside two minutes, every micro-game is thirty lines, and
the roster can grow forever without another launcher entry. It is also the
single best thing to hand a room of people who have never seen the hub.

*Structure:* a micro-game is an object with `{ prompt, controls, start(state),
step(dt), passed() }` and a fixed 5-second (later 4, later 3) budget. The
gauntlet shell owns the clock, the speed ramp, the lives and the scoring. Write
the shell and three micro-games first; the other twenty are an afternoon each
after that.

*Hazards:* the shell must never let a micro-game's bug hang the gauntlet — a
micro-game that throws is a passed round and a logged error, not a dead
console. And every micro-game must be *readable in under a second*, which means
the prompt is three words and the screen has one thing on it.

*Checks:* the shell advances on the timeout even if `passed()` never returns
true; a throwing micro-game does not stop the gauntlet; the speed ramp reaches
its floor and stops; three misses eliminates; every registered micro-game
declares controls the phone can actually offer.

*Size:* two days for the shell and a first handful, then open-ended forever.

## 15. Circuit
**1–4 · pointer, A, B · free-for-all · twitch**

A whole racetrack seen from above at once — no split screen, no camera
following anybody. Four little cars, three laps, tilt to steer like a wheel,
A to accelerate, B to brake and slide. Off the tarmac you crawl.

*Why:* steering is a distinct feel from aiming and nothing has it. And "the
whole track on one screen" is the design decision that makes a four-player
racer possible on one television without any of the complexity that usually
comes with one.

*The hook:* the slide. Give the car real understeer and a handbrake that steps
the back out, and people will race the same track twenty times.

*Hazards:* the whole track on one screen means the cars are small, so they must
be read by colour and a trailing ribbon rather than by shape. Lap counting via
sequential checkpoints, never a single finish line, or a car that wobbles over
the line counts four laps.

*Checks:* checkpoints must be taken in order for a lap to count; a reversed car
does not gain laps; off-track applies the speed multiplier; a collision between
two cars conserves momentum; the finishing order is stable when two cars cross
on the same frame.

*Size:* two days.

## 16. Crane
**2–4 · pointer · co-op · medium**

One wide plank hanging from two to four cables. Each player holds one cable and
can raise or lower it. On the plank is a stack of crates. Carry it from one side
of the site to the other without the stack sliding off.

*Why:* the shelf has no co-op at all, and shared-object co-op is the funniest
kind — nobody can be blamed and everybody is to blame.

*The hook:* nobody can do anything alone. Raising your cable tips the plank
towards everybody else. The game is one long negotiation conducted entirely
through the object.

*Hazards:* it must be possible, and playtesting will be the only way to find
the tuning. Build a "ghost" mode that drives all cables with a simple
controller so the level can be proven solvable in a test before a human sees
it.

*Checks:* the plank angle follows cable lengths; a crate slides once the angle
passes the friction threshold; a fallen crate is lost, not respawned; the ghost
controller completes every shipped level; the level ends when the plank reaches
the far mark with at least one crate.

*Size:* two days, most of it tuning.

## 17. The Chase
**2–4 · pointer or d-pad, A · asymmetric · twitch**

One player is It. The others are not. A dark maze, and everyone can only see a
cone of it — but It moves faster, and the runners can see each other's lights
through walls. Runners must reach three exits before the clock; It has to stop
them. Roles rotate every round.

*Why:* the only asymmetric design here, and asymmetry is a whole category of
fun the shelf is missing. It also produces the best sound in the room — three
people going quiet at the same time.

*The hook:* the light cones on one shared screen. Everyone can see everyone's
cone, so hiding is not about information, it is about geometry. That keeps it
readable on a single television, which the "each player sees only their own
view" version could never be.

*Hazards:* darkness on a big TV in a lit room is muddy. Use a strong, flat
vignette with hard-edged cones rather than a soft gradient, and keep the walls
faintly visible always.

*Checks:* It's speed advantage is exact; a runner inside It's cone and within
reach is caught; a caught runner stops moving and stays visible; three exits
ends the round for the runners; the role rotation visits every player once
before repeating.

*Size:* two days.

## 18. Sky Siege
**1–4 · d-pad, A · co-op · twitch**

Everyone flies one small ship along the bottom of the screen and shoots upward
at waves that come down in formation. Shared lives, shared score, and every
tenth wave is something enormous with a weak point that takes two people
shooting at once.

*Why:* the second co-op, and the one that a single person can also start alone
on a Tuesday. It is the most familiar shape on the shelf, which is a feature —
every room has somebody who wants to play the game they already know.

*The hook:* the two-player weak point. A boss that literally cannot be beaten
alone is the moment a co-op game becomes a co-op game.

*Hazards:* four ships firing means a lot of sprites; keep bullets as a flat
pooled array and never allocate mid-wave. And friendly ships must not block
each other's shots — that reads as a bug every single time.

*Checks:* a pooled bullet is reused rather than allocated; a wave ends when the
formation is empty; the boss weak point requires two concurrent hits; a shared
life is lost once per frame regardless of how many ships were hit; the solo
scaling reduces the formation size.

*Size:* two days.

## 19. Fishing
**1–4 · pointer, swing, flick · turn-based or timed · slow**

Cast with a swing, sink the line, watch the shapes below. When one takes it,
the phone buzzes and you have a fifth of a second to flick upward and set the
hook. Then reel — hold A, but let go when it fights you or the line breaks.
Ninety seconds, biggest total weight wins.

*Why:* it is the calmest thing on the shelf and it is built almost entirely out
of rumble. A game where the important information arrives through your hand and
not through your eyes is a genuinely different experience in a room full of
screens, and this hardware can do it.

*The hook:* the bite. Everything before it is quiet on purpose.

*Hazards:* the reeling tension mechanic has to be legible without a bar on
screen — the buzz pattern *is* the bar. Fast irregular pulses mean the line is
about to go.

*Checks:* the hook window is exactly its configured length after the bite; a
flick outside the window loses the fish; reeling above the tension threshold
for longer than the grace breaks the line; a fish's weight is drawn from its
species table; the timer stops the round mid-fight and the fish is lost.

*Size:* two days, less if Bowling's swing detector already exists.

## 20. The twentieth slot — deliberately empty
**Keep it for the game the room asks for.**

Nineteen designs is already more than will get built this year, and the last
slot is worth more as a space than as another entry. The best game on this
shelf a year from now will be the one somebody demands after an evening of
playing the others, and it will not be on any list written today.

If it has to be filled from the drawer, the two best candidates are **Sumo on
ice** (Ring Out with no friction — same code, a different game) and
**Billiards** (Mini Golf's aim-and-power with real cushion geometry).

---

## What the twenty share — build these once

Planning twenty at once earns exactly one thing: seeing what is common before
writing it four times.

**`web/shared/collide.js`** — swept circle-against-segment and
circle-against-circle collision, returning a time of impact. Needed by Rebound,
Tank Yard, Ring Out, Labyrinth, Brickfall, Bowling, Circuit. Write it with
Rebound, test it hard there, and six games get their hardest problem for free.
Never move-then-test; always solve the time of impact and resolve one contact
at a time.

**`web/shared/round.js`** — the countdown, the elimination bookkeeping, the
"P3 WINS" card, best-of-N, and the rematch prompt. Needed by Standoff, Trails,
Echo, Odd One Out, Ring Out, Tank Yard, Rebound, The Chase, Quickfire. Every
party game currently reinvents its own scoreboard; this is the single biggest
saving in the plan.

**`web/shared/turns.js`** — whose go it is, what the other phones are told
while they wait, and the "next up" prompt. Needed by Mini Golf, Bowling,
Fishing.

**`web/shared/grid.js`** — maze generation and grid walking. Needed by Trails,
The Chase, Labyrinth, Tank Yard's maps.

**Server: the swing detector** (`gamehub/controller.py`, alongside the flick) —
integrate acceleration while A is held, emit `{speed, spin}` on release. Needed
by Bowling, Fishing, and optionally Golf. This is the one genuinely new input
capability in the plan, and like the flick it must be tuned against a recorded
trace rather than against a guess.

**Server: a stillness metric** — how much the phone is moving, as one number.
Cheap, and it unlocks *DON'T MOVE* in Quickfire and a proper "musical statues"
micro-game.

**`scripts/thumbnails.py`** — twenty more drawing functions. Budget an hour
each and do not skip them; the shelf is the first thing anybody sees and a
missing thumbnail makes the whole room look unfinished.

---

## Order of work

1. **Standoff, Skyline, Trails** — three small complete games, roughly two days
   for all three, and the shelf goes from five to eight.
2. **Rebound** — with `collide.js` extracted properly, because everything
   after it depends on that being right.
3. **`round.js`** — after four party games exist and the shape of the
   scoreboard is known from real use rather than from a guess.
4. **Echo, Odd One Out, Brickfall, Waterworks** — the rest of the cheap tier.
5. **Tank Yard v1, Ring Out, Labyrinth** — the meat.
6. **The swing detector**, then **Bowling**, then **Fishing**.
7. **Mini Golf** and **Circuit** — the two long games, once there is a reason
   to stay in the room for twenty minutes.
8. **Quickfire's shell** — last of the framework work, first of the endless
   work.
9. **Crane, The Chase, Sky Siege, Tank Yard v2** — the ambitious end, in
   whatever order the room is asking for by then.

---

## Rejected, and why — so they are not re-proposed

- **Territory paint** — free to build, but the score cannot be read at a glance
  from a sofa, and a game whose state needs counting loses the room halfway
  through.
- **A rhythm game** — the fun is the music, the music would have to be
  synthesised here, and the likely outcome is a technically correct game nobody
  plays twice. The timing *press* survives as a Quickfire micro-game.
- **A quiz** — needs a content pipeline, not a game engine.
- **Pictionary or anything drawn on the phone** — puts the game on the phone
  screens and turns the television into decoration, which is backwards for this
  box.
- **A co-op bomb defusal** — same problem: one player reads a manual instead of
  watching the screen.
- **Boxing or fencing by swing** — reading a punch from a phone's accelerometer
  fairly, for two players at once, at sixty hertz over a socket, is a research
  project. The swing detector is the safe half of this idea and Bowling is
  where it goes.
- **A platformer or a tower defence** — both are content pipelines wearing a
  game's clothes. Twenty hand-built levels is not a weekend.
- **Tetromino stacking** — the good version is somebody else's game and the
  distinct version is not better than Skyline, which costs a tenth as much.
