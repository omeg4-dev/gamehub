// Colour Sort. Point at a tube, press A to lift, press A on another to
// pour. Three minutes, and every puzzle solved is a point.
//
// The puzzles are dealt backwards from a solved board rather than shuffled
// into one: a shuffled deal is usually solvable, and "usually" is no good
// when there is a clock running and no way out of a dead board.
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const resize = () => {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
};
addEventListener("resize", resize);
resize();

const DEPTH = 4;
const SPARE = 2;
const ROUND_MS = 180000;
const COLOURS = ["#ff5f57", "#ffc93c", "#5ec26a", "#4d96ff",
                 "#c56bff", "#ff8f4d", "#37c8c3", "#8d6bff"];

let tubes = [];        // tubes[i] is a stack, index 0 at the bottom
let held = null;       // the tube currently lifted, if any
let undo = [];
let solved = 0;
let level = 0;
let best;
let running = true;
let over = false;
let ends = performance.now() + ROUND_MS;
let pointer = {x: 0.5, y: 0.5};
let boxes = [];        // where each tube was last drawn
let flights = [];      // units in the air between two tubes
let pops = [];         // little celebrations, drawn and forgotten
let hover = null;      // the tube under the hand, for the lift-on-hover
const lifts = new Map();  // tube -> how far it is currently raised, 0..1
const clock = () => performance.now();

// Not `top`: a global const of that name collides with window.top and
// the whole script fails to parse.
const topOf = tube => tube[tube.length - 1];
const runLength = tube => {
  let n = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === topOf(tube); i--) n++;
  return n;
};
const done = () => tubes.every(t => t.length === 0 ||
                                    (t.length === DEPTH && runLength(t) === DEPTH));

const deal = () => {
  flights = [];
  const colours = Math.min(COLOURS.length, 4 + Math.floor(level / 2));
  const count = colours + SPARE;
  do {
    tubes = [];
    for (let i = 0; i < colours; i++) tubes.push(Array(DEPTH).fill(i));
    for (let i = colours; i < count; i++) tubes.push([]);
    for (let n = 0; n < colours * 40; n++) unpour();
  } while (done());
  held = null;
  undo = [];
};

// One backwards move: undo a pour that could legally have happened. Taking
// j units off B and putting them on a tube that is empty or a different
// colour is exactly the inverse of pouring j units of that colour onto B.
const unpour = () => {
  const from = tubes.filter(t => t.length).sort(() => Math.random() - 0.5);
  for (const b of from) {
    const colour = topOf(b);
    const j = 1 + ((Math.random() * runLength(b)) | 0);
    const into = tubes.filter(a => a !== b && a.length + j <= DEPTH &&
                                   (a.length === 0 || topOf(a) !== colour));
    if (!into.length) continue;
    const a = into[(Math.random() * into.length) | 0];
    for (let n = 0; n < j; n++) a.push(b.pop());
    return;
  }
};

const legal = (from, to) => {
  if (from === to || !from.length || to.length === DEPTH) return false;
  return to.length === 0 || topOf(to) === topOf(from);
};

const pour = (from, to) => {
  const colour = topOf(from);
  let moved = 0;
  while (from.length && topOf(from) === colour && to.length < DEPTH) {
    to.push(from.pop());
    moved++;
  }
  undo.push({from, to, moved});
  // The board changes at once; the picture catches up. Each unit is given
  // its own arc, a beat apart, which is what makes a four-unit pour read as
  // a pour rather than as a jump cut.
  for (let n = 0; n < moved; n++) {
    flights.push({src: from, dst: to, colour, index: to.length - moved + n,
                  start: clock() + n * 70, dur: 260});
    note(430 + n * 90, .09);
  }
  return moved;
};

// --- noise and confetti -------------------------------------------------
const note = (hz, seconds = 0.08, shape = "triangle") => {
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Audio) return;                  // no speakers is not a broken game
  const audio = note.ctx ||= new Audio();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = shape;
  osc.frequency.setValueAtTime(hz, audio.currentTime);
  gain.gain.setValueAtTime(0.06, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0005, audio.currentTime + seconds);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + seconds);
};

const cheer = (x, y, colour) => {
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2;
    const speed = 90 + Math.random() * 260;
    pops.push({x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 120,
               life: 1, colour, spin: Math.random() * Math.PI});
  }
};

// --- input -------------------------------------------------------------
const under = () => {
  for (const box of boxes) {
    if (pointer.x * innerWidth >= box.x && pointer.x * innerWidth <= box.x + box.w &&
        pointer.y * innerHeight >= box.y - box.h * .18 &&
        pointer.y * innerHeight <= box.y + box.h) return box.tube;
  }
  return null;
};

// One puzzle, one hand: a second phone in the room is welcome to watch.
GameHub.on("pointer", p => { if ((p.player || 1) === 1) pointer = p; });

GameHub.on("button", event => {
  if (!event.down || !running || over || (event.player || 1) !== 1) return;
  if (event.name === "b") {
    const last = undo.pop();
    if (last) {
      for (let n = 0; n < last.moved; n++) last.from.push(last.to.pop());
      // Whatever was still in the air belonged to the move being undone.
      flights = flights.filter(f => f.dst !== last.to);
      note(320, .1);
    }
    held = null;
    return;
  }
  if (event.name !== "a") return;
  const tube = under();
  if (!tube) { held = null; return; }
  if (!held) {
    if (tube.length) { held = tube; note(660, .06); }
    return;
  }
  if (legal(held, tube)) {
    pour(held, tube);
    held = null;
    const box = boxes.find(b => b.tube === tube);
    if (tube.length === DEPTH && runLength(tube) === DEPTH && box) {
      cheer(box.x + box.w / 2, box.y + box.h / 2, COLOURS[topOf(tube)]);
      note(880, .18);
    }
    if (done()) {
      solved++;
      level++;
      note(1046, .3);
      for (const b of boxes) cheer(b.x + b.w / 2, b.y + b.h / 2, "#ffc93c");
      deal();
    }
  } else {
    held = tube.length ? tube : null;
    note(200, .09, "square");
  }
});

// The clock stops with the game: the phone dropping off Wi-Fi should not
// cost you the round.
let pausedAt = 0;
GameHub.onPause(() => { running = false; pausedAt = performance.now(); });
GameHub.onResume(() => {
  if (!running) ends += performance.now() - pausedAt;
  running = true;
});

// --- drawing -----------------------------------------------------------
const glass = (x, y, w, h) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, [w * .18, w * .18, w * .42, w * .42]);
};

// The units in the air, on an arc from the lip of one tube to its place in
// the other. Straight lines look like a teleport; the arc is the pour.
const drawFlights = () => {
  const at = clock();
  flights = flights.filter(f => at < f.start + f.dur);
  for (const flight of flights) {
    const from = boxes.find(b => b.tube === flight.src);
    const to = boxes.find(b => b.tube === flight.dst);
    if (!from || !to) continue;
    const t = Math.max(0, (at - flight.start) / flight.dur);
    const ease = t * t * (3 - 2 * t);
    const unit = to.h / DEPTH;
    const x0 = from.x + from.w / 2, y0 = from.y + from.h * .1;
    const x1 = to.x + to.w / 2;
    const y1 = to.y + to.h - (flight.index + 0.5) * unit;
    const x = x0 + (x1 - x0) * ease;
    const y = y0 + (y1 - y0) * ease - Math.sin(Math.PI * ease) * to.h * .22;
    ctx.fillStyle = flight.colour;
    ctx.beginPath();
    ctx.ellipse(x, y, to.w * .30, unit * .42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawPops = dt => {
  for (let i = pops.length - 1; i >= 0; i--) {
    const bit = pops[i];
    bit.x += bit.vx * dt / 1000;
    bit.y += bit.vy * dt / 1000;
    bit.vy += dt * 1.6;
    bit.life -= dt / 900;
    if (bit.life <= 0) { pops.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = Math.max(0, bit.life);
    ctx.translate(bit.x, bit.y);
    ctx.rotate(bit.spin + bit.life * 6);
    ctx.fillStyle = bit.colour;
    const size = Math.min(innerWidth, innerHeight) * .012;
    ctx.fillRect(-size / 2, -size / 4, size, size / 2);
    ctx.restore();
  }
};

let lastFrame = 0;

const draw = () => {
  const dt = Math.min(80, clock() - lastFrame || 16);
  lastFrame = clock();
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  hover = under();
  // Tubes are 1:3.6 and stand in one row up to six, two beyond that. The
  // width has to satisfy both budgets at once -- sizing off the height
  // alone is what pushed the eight-colour boards off the sides.
  const rows = tubes.length > 6 ? 2 : 1;
  const perRow = Math.ceil(tubes.length / rows);
  const step = 1.45;                       // tube width plus the gap beside it
  const w = Math.min(innerWidth * .88 / (perRow * step),
                     innerHeight * (rows === 1 ? .62 : .35) / 3.6);
  const h = w * 3.6;
  const spacing = w * step;
  const gapY = h * 1.25;
  const topY = (innerHeight - (rows * h + (rows - 1) * (gapY - h))) / 2
               + innerHeight * .04;
  boxes = [];

  tubes.forEach((tube, i) => {
    const row = Math.floor(i / perRow);
    const inRow = i % perRow;
    const count = Math.min(perRow, tubes.length - row * perRow);
    const x = (innerWidth - (count * spacing - (spacing - w))) / 2
              + inRow * spacing;
    let y = topY + row * gapY;
    boxes.push({tube, x, y, w, h});

    const unit = h / DEPTH;
    // Lifting is animated rather than switched: the tube you are pointing
    // at rises a little, the one you have picked up rises a lot, and both
    // settle back down. This is most of what makes the board feel handled.
    const wanted = tube === held ? 1 : tube === hover ? .28 : 0;
    const lift = (lifts.get(tube) ?? 0) + (wanted - (lifts.get(tube) ?? 0)) * .22;
    lifts.set(tube, lift);
    const lifted = tube === held;
    const rise = lift * unit * .55;
    y -= rise;
    boxes[boxes.length - 1].y = y;

    ctx.save();
    ctx.shadowColor = "rgba(70,105,130,.25)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    glass(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.fill();
    ctx.restore();

    ctx.save();
    glass(x, y, w, h);
    ctx.clip();
    tube.forEach((colour, n) => {
      // A unit still in the air is not in the glass yet.
      if (flights.some(f => f.dst === tube && f.index === n)) return;
      ctx.fillStyle = COLOURS[colour];
      ctx.fillRect(x + w * .06, y + h - (n + 1) * unit, w * .88, unit + 1);
      // A meniscus on the top unit: one pale line, and the paint reads as
      // liquid instead of as a stack of rectangles.
      if (n === tube.length - 1) {
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.fillRect(x + w * .06, y + h - (n + 1) * unit, w * .88, unit * .12);
      }
    });
    // The gloss down the left of the glass.
    const sheen = ctx.createLinearGradient(x, y, x + w, y);
    sheen.addColorStop(0, "rgba(255,255,255,.55)");
    sheen.addColorStop(.35, "rgba(255,255,255,.05)");
    sheen.addColorStop(1, "rgba(255,255,255,.28)");
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    glass(x, y, w, h);
    ctx.lineWidth = Math.max(2, w * .05);
    ctx.strokeStyle = lifted ? "#35c6ff" : "rgba(160,185,200,.75)";
    ctx.stroke();
    if (lifted) {
      ctx.save();
      ctx.shadowColor = "rgba(53,198,255,.9)";
      ctx.shadowBlur = 22;
      glass(x, y, w, h);
      ctx.stroke();
      ctx.restore();
    }
  });

  drawFlights();
  drawPops(dt);

  const left = Math.max(0, (ends - performance.now()) / 1000);
  ctx.fillStyle = "#3d5566";
  ctx.font = `800 ${Math.round(innerHeight * .045)}px "Hub Round", system-ui`;
  ctx.textAlign = "left";
  ctx.fillText(`${solved}`, innerWidth * .04, innerHeight * .09);
  ctx.textAlign = "right";
  ctx.fillStyle = left < 15 ? "#e0553f" : "#7d93a1";
  ctx.fillText(`${left.toFixed(0)}s`, innerWidth * .96, innerHeight * .09);

  if (over) {
    ctx.fillStyle = "rgba(240,246,250,.88)";
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = "#3d5566";
    ctx.textAlign = "center";
    ctx.font = `900 ${Math.round(innerHeight * .09)}px "Hub Round", system-ui`;
    ctx.fillText(`${solved}`, innerWidth / 2, innerHeight / 2);
    ctx.font = `700 ${Math.round(innerHeight * .035)}px "Hub Round", system-ui`;
    ctx.fillStyle = "#7d93a1";
    ctx.fillText(best === undefined ? "solved" : `best ${best}`,
                 innerWidth / 2, innerHeight / 2 + innerHeight * .07);
  }
};

const frame = () => {
  if (running && !over && performance.now() >= ends) {
    over = true;
    GameHub.submitScore(solved);
    GameHub.highScores().then(rows => { best = rows[0]?.score ?? solved; });
    setTimeout(() => GameHub.exit(), 5000);
  }
  draw();
  requestAnimationFrame(frame);
};

deal();
requestAnimationFrame(frame);
GameHub.ready();
