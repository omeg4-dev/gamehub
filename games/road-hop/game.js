// Road Hop, drawn. Everything that can kill you is in world.js; this file
// turns that into boxes.
//
// The look is one trick repeated: every object is an axonometric cube,
// drawn as a top face and the two sides that face the camera, each a
// shade darker. Rows are drawn far to near, so nearer boxes simply paint
// over the ones behind them and there is no depth buffer to keep.
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const world = World.create();

// A place to start from, for looking at the game further in than the verge
// without playing all the way there. `?warp=40` on the address, nothing
// more -- the rules are untouched, the camera and the chicken just begin
// forty rows along.
const WARP = Number(new URLSearchParams(location.search).get("warp")) || 0;
if (WARP > 0) {
  // Land on grass: dropping the chicken onto a lane of traffic would be a
  // preview of a death, not of a game.
  let start = WARP;
  while (world.row(start).kind !== "grass") start++;
  world.player.row = world.player.fromRow = start;
  world.camera = world.player.row - World.BEHIND;
  world.score = world.player.row;
}
const COLS = World.COLS;
const AHEAD = 15;                  // rows drawn in front of the camera

// The camera, in world units. It leans toward the player horizontally but
// never far: the road should stay where you left it.
let camCol = (COLS - 1) / 2;
let best = 0;
let shake = 0;
let splash = [];
let over = false;
let dieAt = 0;

// --- projection ----------------------------------------------------------
const V = {w: 0, d: 0, s: 0, h: 0, ox: 0, oy: 0};

const resize = () => {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  V.w = Math.min(innerWidth / (COLS + 1.5), innerHeight / 8.6);
  V.d = V.w * .58;                 // a row is shorter than it is wide: pitch
  V.s = V.w * .21;                 // and shifted sideways: yaw
  V.h = V.w * .66;                 // and a block is this tall
  V.ox = innerWidth / 2 - V.s * 5.5;
  V.oy = innerHeight * .90;
};
addEventListener("resize", resize);

const at = (col, row, z) => [
  V.ox + (col - camCol) * V.w + (row - world.camera) * V.s,
  V.oy - (row - world.camera) * V.d - z * V.h,
];

// Three shades of one colour: lit from above, the near side in half light,
// the right side darkest. Two flat greys would read as paper.
const shade = (hex, amount) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = c => Math.round(Math.min(255, Math.max(0, c * amount)));
  return `rgb(${mix(n >> 16 & 255)},${mix(n >> 8 & 255)},${mix(n & 255)})`;
};

const face = (points, fill) => {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
};

// One cube: from (col,row,z0) to (col+w,row+d,z1).
const box = (col, row, w, d, z0, z1, colour, lit = 1) => {
  const a = at(col, row, z1), b = at(col + w, row, z1);
  const c = at(col + w, row + d, z1), e = at(col, row + d, z1);
  const a0 = at(col, row, z0), b0 = at(col + w, row, z0);
  const c0 = at(col + w, row + d, z0);
  face([a, b, c, e], shade(colour, 1.0 * lit));
  face([a, b, b0, a0], shade(colour, .78 * lit));
  face([b, c, c0, b0], shade(colour, .62 * lit));
};

// --- the world -----------------------------------------------------------
const GRASS = ["#7ec850", "#76c047"];
const ROAD = "#4c525c";
const WATER = "#3ea3dd";
const GRAVEL = "#5e646d";
const LOG = "#8a5c33";

const ground = (row, n) => {
  const wide = COLS + 6;
  const left = -3;
  if (row.kind === "grass") {
    box(left, n, wide, 1, 0, .3, GRASS[row.shade ? 0 : 1]);
  } else if (row.kind === "road") {
    box(left, n, wide, 1, 0, .18, ROAD);
    // Lane markings, painted on the top face at the far edge, and only
    // where another lane continues -- the same rule the real ones follow.
    const next = world.row(n + 1);
    if (next.kind === "road") {
      for (let c = left; c < left + wide; c += 2) {
        face([at(c + .3, n + .96, .181), at(c + 1.3, n + .96, .181),
              at(c + 1.3, n + .99, .181), at(c + .3, n + .99, .181)],
             "rgba(238,232,200,.75)");
      }
    }
  } else if (row.kind === "water") {
    box(left, n, wide, 1, 0, .1, WATER);
    // Two pale bands drifting across, which is all the movement still
    // water needs to stop looking like a painted floor.
    const drift = (world.time / 900) % 2;
    for (const offset of [drift - 1, drift - 2]) {
      face([at(left, n + .3 + offset * .25, .101),
            at(left + wide, n + .3 + offset * .25, .101),
            at(left + wide, n + .36 + offset * .25, .101),
            at(left, n + .36 + offset * .25, .101)],
           "rgba(255,255,255,.16)");
    }
  } else if (row.kind === "track") {
    box(left, n, wide, 1, 0, .16, GRAVEL);
    // Sleepers first, then the rails on top of them, which is the order
    // they were laid in.
    for (let c = left; c < left + wide; c += .8) {
      box(c, n + .22, .42, .56, .16, .21, "#4a3a2c");
    }
    for (const y of [.28, .64]) {
      box(left, n + y, wide, .09, .21, .32, "#c3cad2");
    }
  }
};

const tree = (col, n, tall) => {
  box(col + .32, n + .32, .36, .36, .3, .3 + .5, "#7a5230");
  for (let i = 0; i < tall; i++) {
    const inset = .06 * i;
    box(col + .06 + inset, n + .06 + inset, .88 - inset * 2, .88 - inset * 2,
        .8 + i * .62, 1.42 + i * .62, i % 2 ? "#2f8b4c" : "#35a057");
  }
};

const rock = (col, n) => {
  box(col + .16, n + .18, .68, .64, .3, .78, "#a8b0b8");
  box(col + .3, n + .3, .4, .38, .78, .95, "#b8c0c8");
};

const car = (vehicle, n) => {
  const {x, len, colour, truck} = vehicle;
  if (truck) {
    box(x + .05, n + .16, 1, .68, .18, .78, "#3c4a56");        // the cab
    box(x + 1.05, n + .12, len - 1.1, .76, .18, 1.05, "#eef1f4");
  } else {
    box(x + .05, n + .14, len - .1, .72, .18, .62, colour);
    box(x + .45, n + .2, len - .95, .6, .62, .92, shade(colour, .88));
    // A windscreen, which is the difference between a car and a brick.
    face([at(x + .5, n + .21, .91), at(x + len - .55, n + .21, .91),
          at(x + len - .55, n + .78, .91), at(x + .5, n + .78, .91)],
         "rgba(200,235,255,.55)");
  }
  for (const wheelX of [x + .25, x + len - .45]) {
    box(wheelX, n + .06, .3, .1, .04, .24, "#2a2f36");
    box(wheelX, n + .84, .3, .1, .04, .24, "#2a2f36");
  }
};

const train = (engine, n) => {
  box(engine.x, n + .06, engine.len, .88, .18, 1.15, "#5b6470");
  box(engine.x, n + .06, .5, .88, .18, 1.3, "#c94f3d");
  for (let i = 1; i < engine.len - 1; i += 1.6) {
    face([at(engine.x + i, n + .07, 1.16), at(engine.x + i + 1, n + .07, 1.16),
          at(engine.x + i + 1, n + .87, 1.16), at(engine.x + i, n + .87, 1.16)],
         "rgba(255,255,255,.10)");
  }
};

const crossing = (row, n) => {
  const on = row.phase !== "idle" && Math.floor(world.time / 260) % 2 === 0;
  for (const col of [-1.4, COLS + .4]) {
    box(col, n + .34, .22, .22, .16, 1.1, "#59606a");
    box(col - .08, n + .26, .38, .38, 1.1, 1.42,
        on ? "#ff4433" : "#7a3d38");
  }
};

const lilyOrLog = (log, row, n) => {
  if (row.pads) {
    box(log.x + .08, n + .12, .84, .76, .1, .18, "#4fae5c");
    return;
  }
  box(log.x, n + .14, log.len, .72, .1, .52, LOG);
  for (let i = 1; i < log.len; i++) {
    face([at(log.x + i, n + .14, .521), at(log.x + i + .06, n + .14, .521),
          at(log.x + i + .06, n + .86, .521), at(log.x + i, n + .86, .521)],
         "rgba(0,0,0,.16)");
  }
  box(log.x + .02, n + .2, .1, .6, .16, .46, "#6d4526");
};

// --- the chicken ---------------------------------------------------------
const chicken = () => {
  const p = world.player;
  const t = Math.min(1, p.hop);
  const col = p.fromCol + (p.col - p.fromCol) * t;
  const row = p.fromRow + (p.row - p.fromRow) * t;
  const air = Math.sin(Math.PI * t) * .55;
  // Squashed at the start and end of a hop, stretched in the middle: the
  // whole reason a hop reads as effort rather than as teleporting.
  const squash = 1 - Math.sin(Math.PI * t) * .12 + (t < .12 || t > .92 ? .1 : 0);
  const flat = world.cause === "car" || world.cause === "train" ? .16 : 1;
  const sink = world.cause === "water" || world.cause === "swept"
             ? Math.min(1, (performance.now() - dieAt) / 700) : 0;
  const z = air - sink * .6;
  const tall = flat * squash;

  // The shadow, which is what tells you where you are going to land.
  ctx.save();
  ctx.globalAlpha = .18 * (1 - air) + .06;
  face([at(col + .18, row + .2, .31), at(col + .82, row + .2, .31),
        at(col + .82, row + .8, .31), at(col + .18, row + .8, .31)], "#12303f");
  ctx.restore();
  if (sink >= 1) return;

  const w = .78 / squash;
  const left = col + (1 - w) / 2, near = row + .2;
  box(left, near, w, .62, z + .04 * tall, z + .58 * tall, "#f7f7f4");    // body
  box(left + .09, near + .46, w - .18, .34, z + .56 * tall, z + 1.04 * tall,
      "#ffffff");                                                        // head
  box(left + .24, near + .78, w - .48, .18, z + .72 * tall, z + .88 * tall,
      "#f4a63c");                                                        // beak
  box(left + .2, near + .52, w - .4, .22, z + 1.04 * tall, z + 1.2 * tall,
      "#e2574c");                                                        // comb
  for (const side of [left + .13, left + w - .26]) {
    face([at(side, near + .79, z + .96 * tall), at(side + .13, near + .79, z + .96 * tall),
          at(side + .13, near + .79, z + .84 * tall), at(side, near + .79, z + .84 * tall)],
         "#2b2b2b");                                                     // eyes
  }
  if (t >= 1 && flat === 1) {
    for (const side of [left + .1, left + w - .22]) {
      box(side, near + .3, .12, .12, z, z + .06, "#f4a63c");             // feet
    }
  }
};

// The eagle: it only ever appears once, and it is the last thing you see.
const eagle = () => {
  if (world.eagle <= 0 && world.cause !== "eagle") return;
  const t = world.cause === "eagle"
    ? Math.min(1, (performance.now() - dieAt) / 900) : 0;
  const p = world.player;
  const [x, y] = at(p.col + .5, p.row + .5, 1.2 + t * 4);
  const size = V.w * (1.5 - t * .4);
  ctx.save();
  ctx.globalAlpha = Math.max(world.eagle, t ? 1 : 0);
  ctx.translate(x, y - V.h * (1 - Math.min(1, world.eagle)) * 6);
  ctx.fillStyle = "#4a3f37";
  const flap = Math.sin(performance.now() / 90) * .3;
  ctx.beginPath();
  ctx.moveTo(-size, -size * (.1 + flap));
  ctx.quadraticCurveTo(-size * .3, size * .18, 0, 0);
  ctx.quadraticCurveTo(size * .3, size * .18, size, -size * (.1 + flap));
  ctx.quadraticCurveTo(size * .3, size * .42, 0, size * .3);
  ctx.quadraticCurveTo(-size * .3, size * .42, -size, -size * (.1 + flap));
  ctx.fill();
  ctx.fillStyle = "#efe6d8";
  ctx.beginPath();
  ctx.arc(0, -size * .12, size * .17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4a63c";
  ctx.beginPath();
  ctx.moveTo(0, -size * .06);
  ctx.lineTo(size * .16, size * .02);
  ctx.lineTo(0, size * .08);
  ctx.fill();
  ctx.restore();
};

// --- the picture ---------------------------------------------------------
const drawSplash = dt => {
  for (let i = splash.length - 1; i >= 0; i--) {
    const drop = splash[i];
    drop.x += drop.vx * dt / 1000;
    drop.z += drop.vz * dt / 1000;
    drop.vz -= dt / 1000 * 5;
    drop.life -= dt / 700;
    if (drop.life <= 0) { splash.splice(i, 1); continue; }
    const [x, y] = at(drop.x, drop.row, Math.max(0, drop.z));
    ctx.globalAlpha = Math.max(0, drop.life);
    ctx.fillStyle = drop.colour;
    ctx.fillRect(x, y, V.w * .1, V.w * .1);
  }
  ctx.globalAlpha = 1;
};

const hud = () => {
  const size = Math.min(innerWidth, innerHeight) * .075;
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * .16;
  ctx.strokeStyle = "rgba(30,60,45,.35)";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${size}px "Hub Round", system-ui, sans-serif`;
  ctx.strokeText(String(world.score), size * .4, size * 1.1);
  ctx.fillText(String(world.score), size * .4, size * 1.1);
  if (best) {
    ctx.font = `800 ${size * .34}px "Hub Round", system-ui, sans-serif`;
    ctx.lineWidth = size * .08;
    ctx.strokeText(`BEST ${best}`, size * .45, size * 1.55);
    ctx.fillText(`BEST ${best}`, size * .45, size * 1.55);
  }
};

const CAUSE = {car: "Squashed", train: "The 4:15", water: "Splash",
               swept: "Carried off", eagle: "The eagle got you"};

const panel = () => {
  const size = Math.min(innerWidth, innerHeight) * .055;
  const w = size * 9, h = size * 4.4;
  const x = innerWidth / 2 - w / 2, y = innerHeight / 2 - h / 2;
  ctx.save();
  ctx.shadowColor = "rgba(20,50,40,.35)";
  ctx.shadowBlur = size;
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, size * .6);
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = "#7d93a1";
  ctx.font = `800 ${size * .45}px "Hub Round", system-ui, sans-serif`;
  ctx.fillText(CAUSE[world.cause] || "Gone", innerWidth / 2, y + size * .95);
  ctx.fillStyle = "#3d5866";
  ctx.font = `900 ${size * 1.5}px "Hub Round", system-ui, sans-serif`;
  ctx.fillText(String(world.score), innerWidth / 2, y + size * 2.5);
  ctx.fillStyle = "#7d93a1";
  ctx.font = `700 ${size * .4}px "Hub Round", system-ui, sans-serif`;
  ctx.fillText(world.score >= best && world.score > 0
               ? "A new best. Press A to go again"
               : `Best ${best} — press A to go again`,
               innerWidth / 2, y + size * 3.6);
};

let last = 0;
const frame = time => {
  const dt = Math.min(80, time - last || 16);
  last = time;
  const wasAlive = world.alive;
  if (!over) world.tick(dt);
  if (wasAlive && !world.alive) died();

  camCol += ((COLS - 1) / 2 + (world.player.col - (COLS - 1) / 2) * .35 - camCol) * .08;

  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.save();
  if (shake > 0) {
    shake = Math.max(0, shake - dt / 400);
    ctx.translate((Math.random() - .5) * shake * V.w * .4,
                  (Math.random() - .5) * shake * V.w * .3);
  }

  const far = Math.ceil(world.camera) + AHEAD;
  const near = Math.floor(world.camera) - 4;
  const standing = world.player.fromRow + (world.player.row - world.player.fromRow)
                   * Math.min(1, world.player.hop);
  for (let n = far; n >= near; n--) {
    const row = world.row(n);
    ground(row, n);
    if (row.kind === "grass") {
      for (const col of row.trees) {
        if ((col * 7 + n * 13) % 9 === 0) rock(col, n);
        else tree(col, n, 1 + ((col + n) % 3 === 0 ? 1 : 0));
      }
    } else if (row.kind === "road") {
      for (const vehicle of [...row.cars].sort((a, b) => a.x - b.x)) car(vehicle, n);
    } else if (row.kind === "water") {
      for (const log of row.logs) lilyOrLog(log, row, n);
    } else if (row.kind === "track") {
      crossing(row, n);
      if (row.train) train(row.train, n);
    }
    if (Math.floor(standing) === n) chicken();
  }
  drawSplash(dt);
  eagle();
  ctx.restore();

  // Haze along the top edge, so the road runs out of sight instead of
  // stopping at the top of the screen.
  const haze = ctx.createLinearGradient(0, 0, 0, innerHeight * .16);
  haze.addColorStop(0, "rgba(196,229,247,.55)");
  haze.addColorStop(1, "rgba(196,229,247,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, innerWidth, innerHeight * .16);

  hud();
  if (!world.alive && performance.now() - dieAt > 700) panel();
  requestAnimationFrame(frame);
};

// --- what it sounds like -------------------------------------------------
const tone = (hz, seconds, shape = "square", to = hz, volume = .05) => {
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Audio) return;
  const out = tone.ctx ||= new Audio();
  const osc = out.createOscillator();
  const gain = out.createGain();
  osc.type = shape;
  osc.frequency.setValueAtTime(hz, out.currentTime);
  if (to !== hz) osc.frequency.exponentialRampToValueAtTime(to, out.currentTime + seconds);
  gain.gain.setValueAtTime(volume, out.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0005, out.currentTime + seconds);
  osc.connect(gain).connect(out.destination);
  osc.start();
  osc.stop(out.currentTime + seconds);
};

const noise = (seconds, volume) => {
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Audio) return;
  const out = tone.ctx ||= new Audio();
  const length = Math.floor(out.sampleRate * seconds);
  const buffer = out.createBuffer(1, length, out.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  }
  const source = out.createBufferSource();
  const gain = out.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain).connect(out.destination);
  source.start();
};

const died = () => {
  dieAt = performance.now();
  best = Math.max(best, world.score);
  GameHub.submitScore(world.score);
  GameHub.rumble(1, 160);
  if (world.cause === "water" || world.cause === "swept") {
    tone(700, .4, "sine", 180, .06);
    for (let i = 0; i < 26; i++) {
      splash.push({x: world.player.col + .5, row: world.player.row + .5,
                   z: .3, vx: (Math.random() - .5) * 2.2,
                   vz: 1 + Math.random() * 2.4, life: 1, colour: "#bfe6ff"});
    }
  } else if (world.cause === "eagle") {
    tone(1200, .5, "sawtooth", 380, .05);
  } else {
    shake = 1;
    noise(.35, .22);
    tone(120, .3, "sawtooth", 60, .07);
  }
};

// --- steering ------------------------------------------------------------
const WAY = {up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0]};

const go = (dcol, drow) => {
  if (!world.alive) return;
  if (world.hop(dcol, drow)) {
    tone(520 + Math.random() * 40, .06, "square", 760, .035);
  }
};

const again = () => {
  const fresh = World.create();
  for (const key of Object.keys(fresh)) {
    if (typeof fresh[key] !== "function") world[key] = fresh[key];
  }
  // The functions close over the fresh world's own state, so they have to
  // come across too -- otherwise the old rows keep being consulted.
  for (const key of Object.keys(fresh)) {
    if (typeof fresh[key] === "function") world[key] = fresh[key];
  }
  splash = [];
  shake = 0;
  dieAt = 0;
};

GameHub.on("button", event => {
  if (!event.down || (event.player || 1) !== 1) return;
  if (event.name === "b") return GameHub.exit();
  if (!world.alive) {
    if (event.name === "a" && performance.now() - dieAt > 700) again();
    return;
  }
  if (event.name === "a") return go(0, 1);
  const way = WAY[event.name];
  if (way) go(way[0], way[1]);
});

// A flick of the phone hops the way you flicked it, which is the closest
// this gets to the thumb on a glass screen.
GameHub.on("flick", event => {
  if ((event.player || 1) !== 1) return;
  const way = WAY[event.dir];
  if (way) go(way[0], way[1]);
});

GameHub.highScores().then(rows => { best = rows && rows.length ? rows[0].score : 0; });

resize();
GameHub.ready();
requestAnimationFrame(frame);
