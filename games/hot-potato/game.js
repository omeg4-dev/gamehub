// Hot Potato. One lit bomb, four pods, and a fuse only the person holding
// it can feel: the phone in your hand buzzes faster the closer it gets,
// and nobody else in the room knows how close that is.
//
// The whole model is in 0..1 coordinates -- the same units the hub sends
// the pointer in -- so every rule below runs in node without a canvas.
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const HOLD_MS = 1200;        // you must hold it this long before passing it on
const FLIGHT_MS = 420;       // and it is nobody's while it is in the air
const FUSE_MIN = 9000, FUSE_MAX = 24000;
const REACH = 0.115;         // how near a pod you have to point to throw at it
const SQUASH = 0.5625;       // 9/16: makes a circle on screen a circle in here

// Where the pods stand, by how many are playing. Two face each other; four
// take the corners, which is also where four people sit.
const SEATS = {
  1: [[0.5, 0.52]],
  2: [[0.24, 0.52], [0.76, 0.52]],
  3: [[0.5, 0.27], [0.25, 0.73], [0.75, 0.73]],
  4: [[0.26, 0.30], [0.74, 0.30], [0.26, 0.74], [0.74, 0.74]],
};

let room = [];               // [{n, name, colour}] -- everyone with a phone
let alive = [];              // player numbers still in the round
let pods = new Map();        // player number -> {x, y, phase, out, puff}
let holder = null;
let fuse = 0;                // ms left on the bomb, ticking only while held
let held = 0;                // ms since this pair of hands caught it
let flight = null;           // {from, to, start}
let winner = null;
let now = 0;
let shake = 0, flash = 0;
let bits = [];               // sparks, smoke and confetti
let buzzAt = 0;              // when the holder's phone was last told to buzz

// A preview seat count, for looking at the layout without four phones in
// the room. `?players=4` on the address, nothing more.
const PREVIEW = Number(new URLSearchParams(location.search).get("players")) || 0;

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// --- the round ----------------------------------------------------------
const seat = () => {
  const seats = SEATS[Math.min(4, Math.max(1, room.length))] || SEATS[4];
  pods = new Map();
  room.forEach((player, i) => {
    const [x, y] = seats[i % seats.length];
    pods.set(player.n, {x, y, phase: i * 1.7, out: false, puff: 0});
  });
};

const start = () => {
  alive = room.map(p => p.n);
  seat();
  winner = null;
  flight = null;
  bits = [];
  holder = alive.length ? alive[Math.floor(Math.random() * alive.length)] : null;
  fuse = rand(FUSE_MIN, FUSE_MAX);
  held = 0;
};

const who = n => room.find(p => p.n === n);

// Anything a throw could be wrong about, in one place, so the button
// handler and the tests are asking the same question.
const canThrow = (from, to) =>
  !winner && holder !== null && from === holder && !flight
  && held >= HOLD_MS && to !== from && alive.includes(to);

const throwTo = (from, to) => {
  if (!canThrow(from, to)) return false;
  flight = {from, to, start: now};
  whoosh();
  return true;
};

const boom = () => {
  const loser = holder;
  alive = alive.filter(n => n !== loser);
  const pod = pods.get(loser);
  if (pod) { pod.out = true; pod.puff = 1; }
  bang(pod);
  GameHub.rumble(loser, 200);
  holder = null;
  if (alive.length <= 1) {
    winner = alive[0] ?? null;
    if (winner !== null) { cheer(); cheerBits(); }
    // The hub keeps one number per game; the one worth keeping here is how
    // many people you outlasted.
    GameHub.submitScore(Math.max(0, room.length - 1));
    return;
  }
  holder = alive[Math.floor(Math.random() * alive.length)];
  fuse = rand(FUSE_MIN, FUSE_MAX);
  held = 0;
};

const tick = dt => {
  now += dt;
  for (const pod of pods.values()) if (pod.puff > 0) pod.puff -= dt / 700;
  if (winner !== null || holder === null) return;
  if (flight) {
    // The fuse stops in the air, or throwing it would be a way of dodging.
    if (now - flight.start >= FLIGHT_MS) {
      holder = flight.to;
      held = 0;
      flight = null;
      thud();
      GameHub.rumble(holder, 40);
    }
    return;
  }
  held += dt;
  fuse -= dt;
  if (fuse <= 0) boom();
};

// --- the room -----------------------------------------------------------
const join = list => {
  room = list;
  const known = new Set(room.map(p => p.n));
  if (winner !== null || holder === null || !known.has(holder)
      || alive.some(n => !known.has(n))) {
    start();
  } else {
    seat();
    alive = alive.filter(n => known.has(n));
  }
};

GameHub.on("players", message => {
  if (!PREVIEW && message.players.length) join(message.players);
});

const pointers = new Map();
GameHub.on("pointer", event => {
  pointers.set(event.player || 1, {x: event.x, y: event.y});
});

// The pod being pointed at, if the hand is near enough to mean it.
const podUnder = (x, y) => {
  let best = null, closest = REACH * REACH;
  for (const [n, pod] of pods) {
    if (pod.out) continue;
    const dx = pod.x - x, dy = (pod.y - y) * SQUASH;
    const distance = dx * dx + dy * dy;
    if (distance < closest) { closest = distance; best = n; }
  }
  return best;
};

GameHub.on("button", event => {
  if (!event.down) return;
  const player = event.player || 1;
  if (event.name === "b") return GameHub.exit();
  if (event.name !== "a") return;
  if (winner !== null) { start(); return; }
  const where = pointers.get(player);
  if (!where) return;
  const target = podUnder(where.x, where.y);
  if (target === null) return;
  if (!throwTo(player, target)) miss();
});

GameHub.onPause(() => { paused = true; });
GameHub.onResume(() => { paused = false; });
let paused = false;

// --- noise --------------------------------------------------------------
const audio = () => {
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Audio) return null;
  return audio.ctx ||= new Audio();
};

const tone = (hz, seconds, shape = "triangle", to = hz, volume = .06) => {
  const out = audio();
  if (!out) return;
  const osc = out.createOscillator();
  const gain = out.createGain();
  osc.type = shape;
  osc.frequency.setValueAtTime(hz, out.currentTime);
  if (to !== hz) osc.frequency.exponentialRampToValueAtTime(to, out.currentTime + seconds);
  gain.gain.setValueAtTime(volume, out.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0005, out.currentTime + seconds);
  osc.connect(gain).connect(out.destination);
  osc.start();
  osc.stop(out.currentTime + seconds);
};

const whoosh = () => tone(900, .18, "sine", 260);
const thud = () => tone(200, .12, "triangle", 120, .09);
const miss = () => tone(150, .08, "square", 120, .04);
const cheer = () => [523, 659, 784, 1046].forEach(
  (hz, i) => setTimeout(() => tone(hz, .3, "triangle", hz, .07), i * 110));

const bang = pod => {
  shake = 1;
  flash = 1;
  const out = audio();
  if (out) {
    // A bang is noise, not a note: a second of white noise through a
    // falling gain, which is as close as an oscillator will ever get.
    const length = Math.floor(out.sampleRate * .45);
    const buffer = out.createBuffer(1, length, out.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
    }
    const source = out.createBufferSource();
    const gain = out.createGain();
    source.buffer = buffer;
    gain.gain.value = .25;
    source.connect(gain).connect(out.destination);
    source.start();
  }
  if (!pod) return;
  for (let i = 0; i < 46; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(.06, .55);
    bits.push({x: pod.x, y: pod.y, vx: Math.cos(angle) * speed,
               vy: Math.sin(angle) * speed, life: 1, size: rand(.4, 1.4),
               colour: i % 3 ? "#ffb03a" : "#5b6b78", kind: "spark"});
  }
};

const cheerBits = () => {
  for (let i = 0; i < 70; i++) {
    bits.push({x: Math.random(), y: -0.05 - Math.random() * .4,
               vx: rand(-.06, .06), vy: rand(.12, .3), life: 1.6,
               size: rand(.6, 1.5), spin: Math.random() * 6,
               colour: ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c56bff"][i % 5],
               kind: "confetti"});
  }
};

// --- drawing ------------------------------------------------------------
const resize = () => {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
};
addEventListener("resize", resize);

const unit = () => Math.min(innerWidth, innerHeight);
const px = pod => [pod.x * innerWidth + Math.sin(now / 2600 + pod.phase) * unit() * .012,
                   pod.y * innerHeight + Math.cos(now / 2100 + pod.phase) * unit() * .010];

const roundRect = (x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// A table for them to sit around. Four circles on an empty screen read as
// four separate things; one faint ring through them reads as a group.
const drawTable = () => {
  if (pods.size < 2) return;
  let x = 0, y = 0;
  for (const pod of pods.values()) { x += pod.x; y += pod.y; }
  x /= pods.size; y /= pods.size;
  let rx = 0, ry = 0;
  for (const pod of pods.values()) {
    rx = Math.max(rx, Math.abs(pod.x - x));
    ry = Math.max(ry, Math.abs(pod.y - y));
  }
  ctx.save();
  ctx.translate(x * innerWidth, y * innerHeight);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0,
                                            Math.max(rx * innerWidth, ry * innerHeight));
  gradient.addColorStop(0, "rgba(120,170,200,.10)");
  gradient.addColorStop(1, "rgba(120,170,200,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * innerWidth * 1.25, ry * innerHeight * 1.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.setLineDash([unit() * .012, unit() * .022]);
  ctx.lineWidth = Math.max(1, unit() * .004);
  ctx.strokeStyle = "rgba(125,160,180,.35)";
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(rx * innerWidth, unit() * .1),
              Math.max(ry * innerHeight, unit() * .1), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
};

const drawPod = (n, pod) => {
  const [x, y] = px(pod);
  const r = unit() * .105;
  const player = who(n) || {name: `P${n}`, colour: "#3ec7ff"};
  const mine = holder === n && !flight;
  // The ring pulses with the fuse, but only for the person holding it --
  // to everyone else it is a steady light, which is the point.
  const urgency = mine ? 1 - Math.max(0, fuse) / FUSE_MAX : 0;
  const beat = mine ? 1 + Math.sin(now / (180 - urgency * 120)) * .035 * (0.4 + urgency) : 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(beat, beat);
  ctx.globalAlpha = pod.out ? .35 : 1;

  ctx.shadowColor = "rgba(60,100,125,.28)";
  ctx.shadowBlur = r * .5;
  ctx.shadowOffsetY = r * .12;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.lineWidth = r * .13;
  ctx.strokeStyle = pod.out ? "#c2ced6" : player.colour;
  ctx.beginPath();
  ctx.arc(0, 0, r * .93, 0, Math.PI * 2);
  ctx.stroke();

  // The face: two eyes and a mouth that knows whether it is holding a bomb.
  ctx.fillStyle = pod.out ? "#aebbc4" : "#3d5866";
  const eye = side => {
    ctx.beginPath();
    if (pod.out) {
      ctx.lineWidth = r * .07;
      ctx.strokeStyle = "#aebbc4";
      ctx.moveTo(side * r * .34 - r * .1, -r * .28);
      ctx.lineTo(side * r * .34 + r * .1, -r * .08);
      ctx.moveTo(side * r * .34 + r * .1, -r * .28);
      ctx.lineTo(side * r * .34 - r * .1, -r * .08);
      ctx.stroke();
    } else {
      ctx.ellipse(side * r * .3, -r * .18, r * .08, r * (mine ? .14 : .11),
                  0, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  eye(-1); eye(1);
  ctx.beginPath();
  if (mine) {
    ctx.arc(0, r * .26, r * .17, 0, Math.PI * 2);      // an open mouth
    ctx.fill();
  } else if (!pod.out) {
    ctx.lineWidth = r * .07;
    ctx.strokeStyle = "#3d5866";
    ctx.arc(0, r * .12, r * .2, .25 * Math.PI, .75 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();

  ctx.globalAlpha = pod.out ? .45 : 1;
  ctx.textAlign = "center";
  ctx.fillStyle = pod.out ? "#a3b3bd" : "#3d5866";
  ctx.font = `800 ${r * .3}px "Hub Round", system-ui, sans-serif`;
  ctx.fillText(player.name, x, y + r * 1.42);
  ctx.globalAlpha = 1;
};

const drawBomb = () => {
  if (holder === null && !flight) return;
  let x, y, lift = 0;
  if (flight) {
    const from = pods.get(flight.from), to = pods.get(flight.to);
    if (!from || !to) return;
    const t = Math.min(1, (now - flight.start) / FLIGHT_MS);
    const [x0, y0] = px(from), [x1, y1] = px(to);
    x = x0 + (x1 - x0) * t;
    y = y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * unit() * .22;
  } else {
    const pod = pods.get(holder);
    if (!pod) return;
    [x, y] = px(pod);
    lift = unit() * .205;
    y -= lift;
  }
  const r = unit() * .045;
  const urgency = 1 - Math.max(0, fuse) / FUSE_MAX;
  const wobble = flight ? (now - flight.start) / 60 : Math.sin(now / 140) * .12 * urgency;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(wobble);
  ctx.shadowColor = "rgba(255,140,50,.55)";
  ctx.shadowBlur = r * (1 + urgency * 2.4);
  ctx.fillStyle = "#3a4650";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.beginPath();
  ctx.ellipse(-r * .34, -r * .38, r * .2, r * .13, -.6, 0, Math.PI * 2);
  ctx.fill();
  // The fuse, and the spark on the end of it.
  ctx.strokeStyle = "#c98b5a";
  ctx.lineWidth = r * .16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * .7, -r * 1.5, r * .35, -r * 1.95);
  ctx.stroke();
  const spark = r * (.16 + Math.random() * .12);
  ctx.fillStyle = "#ffd166";
  ctx.shadowColor = "#ff9f45";
  ctx.shadowBlur = r * 1.2;
  ctx.beginPath();
  ctx.arc(r * .35, -r * 2.05, spark, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Embers falling off the fuse, more of them the closer it gets.
  if (Math.random() < .3 + urgency * .5) {
    bits.push({x: (x + r * .35) / innerWidth, y: (y - r * 2) / innerHeight,
               vx: rand(-.03, .03), vy: rand(.02, .09), life: .6,
               size: rand(.3, .7), colour: "#ffb03a", kind: "spark"});
  }
};

const drawBits = dt => {
  for (let i = bits.length - 1; i >= 0; i--) {
    const bit = bits[i];
    bit.x += bit.vx * dt / 1000;
    bit.y += bit.vy * dt / 1000;
    bit.vy += dt / 1000 * (bit.kind === "confetti" ? .35 : .9);
    bit.life -= dt / (bit.kind === "confetti" ? 2600 : 700);
    if (bit.life <= 0) { bits.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = Math.min(1, bit.life);
    ctx.translate(bit.x * innerWidth, bit.y * innerHeight);
    ctx.fillStyle = bit.colour;
    if (bit.kind === "confetti") {
      ctx.rotate((bit.spin || 0) + bit.life * 5);
      const size = unit() * .013 * bit.size;
      ctx.fillRect(-size / 2, -size / 4, size, size / 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, unit() * .006 * bit.size * (0.4 + bit.life), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
};

const banner = (line, under) => {
  const size = unit() * .05;
  const w = Math.max(ctx.measureText(line).width, size * 8) + size * 2;
  const h = size * (under ? 3.1 : 2);
  const x = innerWidth / 2 - w / 2, y = innerHeight / 2 - h / 2;
  ctx.save();
  ctx.shadowColor = "rgba(50,90,115,.3)";
  ctx.shadowBlur = size;
  ctx.fillStyle = "rgba(255,255,255,.95)";
  roundRect(x, y, w, h, size * .6);
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = "#3d5866";
  ctx.font = `900 ${size * .8}px "Hub Round", system-ui, sans-serif`;
  ctx.fillText(line, innerWidth / 2, y + size * 1.15);
  if (under) {
    ctx.fillStyle = "#7d93a1";
    ctx.font = `700 ${size * .42}px "Hub Round", system-ui, sans-serif`;
    ctx.fillText(under, innerWidth / 2, y + size * 2.2);
  }
};

const drawHud = () => {
  const size = unit() * .032;
  ctx.textAlign = "center";
  ctx.fillStyle = "#8ba3b0";
  ctx.font = `800 ${size}px "Hub Round", system-ui, sans-serif`;
  if (winner !== null) return;
  if (room.length < 2) return;
  const name = holder !== null && !flight ? (who(holder) || {}).name : null;
  ctx.fillText(name ? `${name} has it` : "…", innerWidth / 2, unit() * .075);
  ctx.fillStyle = "#a9bcc6";
  ctx.font = `700 ${size * .62}px "Hub Round", system-ui, sans-serif`;
  ctx.fillText("Point at someone and press A", innerWidth / 2, unit() * .115);
};

let last = 0;
const frame = time => {
  const dt = Math.min(120, time - last || 16);
  last = time;
  if (!paused) tick(dt);
  buzz(dt);

  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.save();
  if (shake > 0) {
    shake = Math.max(0, shake - dt / 420);
    const amount = shake * unit() * .02;
    ctx.translate(rand(-amount, amount), rand(-amount, amount));
  }
  drawTable();
  for (const [n, pod] of pods) drawPod(n, pod);
  drawBomb();
  drawBits(dt);
  ctx.restore();

  if (flash > 0) {
    flash = Math.max(0, flash - dt / 260);
    ctx.fillStyle = `rgba(255,244,214,${flash * .85})`;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
  }

  drawHud();
  if (room.length < 2) {
    banner("Waiting for a second phone",
           "Everyone scans the same code from the menu");
  } else if (winner !== null) {
    banner(`${(who(winner) || {}).name} wins`, "Press A for another round");
  }
  requestAnimationFrame(frame);
};

// The fuse is felt, not seen: the phone in the holder's hand pulses, and
// the gap between pulses closes as the bomb gets closer to going off.
const buzz = () => {
  if (winner !== null || holder === null || flight || paused) return;
  const urgency = 1 - Math.max(0, Math.min(1, fuse / FUSE_MAX));
  const gap = 900 - urgency * 740;
  if (now - buzzAt < gap) return;
  buzzAt = now;
  GameHub.rumble(holder, Math.round(14 + urgency * 46));
};

resize();
room = PREVIEW
  ? Array.from({length: PREVIEW}, (_, i) => ({
      n: i + 1, name: ["Om", "Kim", "Lex", "Rio"][i] || `P${i + 1}`,
      colour: ["#3ec7ff", "#ff6f5e", "#5fd36a", "#ffc746"][i]}))
  : GameHub.players();
start();
GameHub.ready();
requestAnimationFrame(frame);
