// Balloon Rush: everyone in the room points at the same screen and races.
//
// The board is kept in 0..1 coordinates, the same units the hub sends the
// pointer in, so nothing in the rules knows the resolution -- which is what
// lets the whole of the scoring be run in node without a browser.
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const ROUND_MS = 90000;
const COLOURS = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c56bff", "#ff9f45"];
const VALUE = {normal: 1, gold: 5, bomb: -3};
const COMBO_MS = 1400;               // pop again inside this and it counts double

let balloons = [];
let sparks = [];
let floats = [];                     // "+5 x3", rising off the pop
let scores = {};                     // player number -> points
let combos = {};                     // player number -> {count, at}
let pointers = {};                   // player number -> where that hand is
let room = [{n: 1, name: "P1", colour: "#3ec7ff"}];
let ends = 0, now = 0, running = true, over = false, spawnAt = 0;
let seed = 1;

// A seeded random, so a failing round can be replayed exactly rather than
// argued about.
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

const reset = (at = 0) => {
  balloons = [];
  sparks = [];
  floats = [];
  scores = {};
  combos = {};
  for (const player of room) scores[player.n] = 0;
  now = at;
  ends = at + ROUND_MS;
  spawnAt = at;
  over = false;
  // A round that opens on an empty sky is a round that opens on a pause.
  for (let i = 0; i < 5; i++) {
    spawn();
    balloons[i].y = 0.35 + i * 0.16;
  }
};

// --- rules ---------------------------------------------------------------
const spawn = () => {
  const roll = random();
  const kind = roll > 0.93 ? "gold" : roll > 0.82 ? "bomb" : "normal";
  balloons.push({
    x: 0.06 + random() * 0.88,
    y: 1.12,
    r: kind === "gold" ? 0.036 : 0.034 + random() * 0.018,
    speed: 0.055 + random() * 0.05 + (kind === "gold" ? 0.05 : 0),
    sway: random() * Math.PI * 2,
    kind,
    colour: COLOURS[Math.floor(random() * COLOURS.length)],
    pop: 0,
  });
};

// The one in front. Two balloons overlapping is common at the top of the
// screen, and popping the one behind would look like a miss.
const under = (x, y) => {
  let best = null;
  for (const balloon of balloons) {
    if (balloon.pop) continue;
    const dx = (balloon.x - x), dy = (balloon.y - y) * 0.62;
    if (dx * dx + dy * dy > balloon.r * balloon.r * 1.6) continue;
    if (!best || balloon.y < best.y) best = balloon;
  }
  return best;
};

const popAt = (player, x, y) => {
  const balloon = under(x, y);
  const combo = combos[player] ||= {count: 0, at: -Infinity};
  if (!balloon) {
    combo.count = 0;                 // a miss is not punished, but it stops the run
    return null;
  }
  balloon.pop = 1;
  const chain = now - combo.at <= COMBO_MS ? combo.count + 1 : 1;
  combo.count = chain;
  combo.at = now;
  const multiplier = balloon.kind === "bomb" ? 1 : Math.min(4, chain);
  const points = VALUE[balloon.kind] * multiplier;
  scores[player] = (scores[player] || 0) + points;
  if (balloon.kind === "bomb") combo.count = 0;
  return {kind: balloon.kind, points, chain: multiplier, balloon};
};

const step = (dt) => {
  now += dt;
  // Balloons come faster as the round goes on, so the last ten seconds are
  // the loud part rather than the same as the first ten.
  const pressure = 1 + (1 - Math.max(0, ends - now) / ROUND_MS) * 1.6;
  while (spawnAt < now) {
    spawn();
    spawnAt += 620 / pressure;
  }
  for (const balloon of balloons) {
    if (balloon.pop) { balloon.pop += dt / 180; continue; }
    balloon.y -= balloon.speed * dt / 1000;
    balloon.sway += dt / 700;
  }
  balloons = balloons.filter(b => b.pop < 2 && b.y > -0.15);
  if (now >= ends) over = true;
};

// --- juice ---------------------------------------------------------------
const burst = (balloon, colour) => {
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2;
    const speed = 0.12 + Math.random() * 0.35;
    sparks.push({x: balloon.x, y: balloon.y, life: 1, colour,
                 vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed});
  }
};

const blip = (hz, seconds = 0.07, shape = "triangle") => {
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Audio) return;
  const audio = blip.ctx ||= new Audio();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = shape;
  osc.frequency.setValueAtTime(hz, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(hz * (shape === "sawtooth" ? .25 : 2.2),
                                             audio.currentTime + seconds);
  gain.gain.setValueAtTime(0.07, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0005, audio.currentTime + seconds);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + seconds);
};

// --- drawing -------------------------------------------------------------
const resize = () => {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
};
addEventListener("resize", resize);

const unit = () => Math.min(innerWidth, innerHeight);

const drawBalloon = balloon => {
  const x = balloon.x * innerWidth + Math.sin(balloon.sway) * unit() * .012;
  const y = balloon.y * innerHeight;
  const r = balloon.r * unit();
  const grown = balloon.pop ? 1 + balloon.pop * .8 : 1;
  const fade = balloon.pop ? Math.max(0, 1 - balloon.pop) : 1;

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(x, y);
  ctx.scale(grown, grown);

  // String first, so the knot sits on top of it.
  ctx.beginPath();
  ctx.moveTo(0, r * 1.24);
  ctx.quadraticCurveTo(r * .5, r * 1.9, 0, r * 2.6);
  ctx.strokeStyle = "rgba(90,120,140,.45)";
  ctx.lineWidth = Math.max(1, r * .05);
  ctx.stroke();

  const colour = balloon.kind === "gold" ? "#ffc42e"
               : balloon.kind === "bomb" ? "#42505c" : balloon.colour;
  // Flat colour first, then shade only at the rim. A radial gradient that
  // runs all the way to black turns every balloon the same grey.
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 1.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
  const shade = ctx.createRadialGradient(-r * .3, -r * .4, r * .1, 0, 0, r * 1.2);
  shade.addColorStop(0, "rgba(255,255,255,.55)");
  shade.addColorStop(.42, "rgba(255,255,255,0)");
  shade.addColorStop(.86, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,.22)");
  ctx.fillStyle = shade;
  ctx.fill();
  // The window: one hard highlight, the way a real one catches a lamp.
  ctx.beginPath();
  ctx.ellipse(-r * .38, -r * .5, r * .2, r * .3, -.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.fill();
  // The knot.
  ctx.beginPath();
  ctx.moveTo(-r * .13, r * 1.14);
  ctx.lineTo(r * .13, r * 1.14);
  ctx.lineTo(0, r * 1.34);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();

  if (balloon.kind === "gold") {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = `900 ${r * .9}px "Hub Round", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("5", 0, r * .04);
  }
  if (balloon.kind === "bomb") {
    ctx.strokeStyle = "#ff7a5c";
    ctx.lineWidth = r * .13;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.15);
    ctx.quadraticCurveTo(r * .5, -r * 1.6, r * .22, -r * 1.95);
    ctx.stroke();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(r * .22, -r * 2.05, r * .14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawFloats = dt => {
  ctx.textAlign = "center";
  for (let i = floats.length - 1; i >= 0; i--) {
    const float = floats[i];
    float.life -= dt / 1000;
    if (float.life <= 0) { floats.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, float.life * 1.8);
    ctx.fillStyle = float.colour;
    const size = unit() * .045 * (1 + (1 - float.life) * .25);
    ctx.font = `900 ${size}px "Hub Round", system-ui, sans-serif`;
    ctx.fillText(float.text, float.x * innerWidth,
                 float.y * innerHeight - (1 - float.life) * unit() * .12);
  }
  ctx.globalAlpha = 1;
};

const drawSparks = dt => {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const spark = sparks[i];
    spark.x += spark.vx * dt / 1000;
    spark.y += spark.vy * dt / 1000;
    spark.vy += dt / 1000 * .6;
    spark.life -= dt / 480;
    if (spark.life <= 0) { sparks.splice(i, 1); continue; }
    ctx.globalAlpha = spark.life;
    ctx.fillStyle = spark.colour;
    ctx.beginPath();
    ctx.arc(spark.x * innerWidth, spark.y * innerHeight,
            unit() * .006 * spark.life + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const plate = (x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawScores = () => {
  const size = unit() * .034;
  const pad = size * .6;
  ctx.textBaseline = "middle";
  let x = pad;
  for (const player of room) {
    const width = size * 5.6;
    ctx.save();
    ctx.shadowColor = "rgba(60,100,125,.25)";
    ctx.shadowBlur = size * .5;
    ctx.fillStyle = "rgba(255,255,255,.92)";
    plate(x, pad, width, size * 2, size * .6);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = player.colour;
    ctx.beginPath();
    ctx.arc(x + size * .9, pad + size, size * .45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3d5866";
    ctx.textAlign = "left";
    ctx.font = `800 ${size * .62}px "Hub Round", system-ui, sans-serif`;
    ctx.fillText(player.name, x + size * 1.55, pad + size * .68);
    ctx.font = `900 ${size * .95}px "Hub Round", system-ui, sans-serif`;
    ctx.fillText(String(scores[player.n] ?? 0), x + size * 1.55, pad + size * 1.42);
    x += width + pad * .7;
  }

  const left = Math.max(0, ends - now);
  ctx.textAlign = "center";
  ctx.fillStyle = left < 10000 ? "#e8604c" : "#8ba3b0";
  ctx.font = `900 ${size * 1.5}px "Hub Round", system-ui, sans-serif`;
  ctx.fillText(`${Math.ceil(left / 1000)}`, innerWidth / 2, pad + size);
};

const drawOver = () => {
  const size = unit() * .05;
  const ranked = room.slice().sort((a, b) => (scores[b.n] ?? 0) - (scores[a.n] ?? 0));
  const w = size * 9, h = size * (2.4 + ranked.length * 1.1);
  const x = innerWidth / 2 - w / 2, y = innerHeight / 2 - h / 2;
  ctx.save();
  ctx.shadowColor = "rgba(50,90,115,.35)";
  ctx.shadowBlur = size;
  ctx.fillStyle = "rgba(255,255,255,.95)";
  plate(x, y, w, h, size * .6);
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = "#3d5866";
  ctx.font = `900 ${size * .8}px "Hub Round", system-ui, sans-serif`;
  ctx.fillText(ranked.length > 1 ? `${ranked[0].name} wins` : "Time", 
               innerWidth / 2, y + size);
  ctx.textAlign = "left";
  ranked.forEach((player, i) => {
    const row = y + size * (1.9 + i * 1.1);
    ctx.fillStyle = player.colour;
    ctx.beginPath();
    ctx.arc(x + size * .9, row, size * .22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3d5866";
    ctx.font = `800 ${size * .5}px "Hub Round", system-ui, sans-serif`;
    ctx.fillText(player.name, x + size * 1.4, row);
    ctx.textAlign = "right";
    ctx.fillText(String(scores[player.n] ?? 0), x + w - size * .8, row);
    ctx.textAlign = "left";
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "#7d93a1";
  ctx.font = `700 ${size * .4}px "Hub Round", system-ui, sans-serif`;
  ctx.fillText("Press A for another round", innerWidth / 2, y + h - size * .5);
};

let last = 0;
const frame = time => {
  const dt = Math.min(120, time - last || 16);
  last = time;
  if (running && !over) step(dt);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const balloon of balloons) drawBalloon(balloon);
  drawSparks(dt);
  drawFloats(dt);
  drawScores();
  if (over) drawOver();
  requestAnimationFrame(frame);
};

// --- the room ------------------------------------------------------------
GameHub.on("players", message => {
  if (!message.players.length) return;
  room = message.players;
  for (const player of room) scores[player.n] ??= 0;
});

GameHub.on("pointer", event => {
  pointers[event.player || 1] = {x: event.x, y: event.y};
});

GameHub.on("button", event => {
  if (!event.down) return;
  const player = event.player || 1;
  if (event.name === "b") return GameHub.exit();
  if (event.name !== "a") return;
  if (over) {
    room = GameHub.players();
    reset(now);
    return;
  }
  const where = pointers[player];
  if (!where) return;
  const hit = popAt(player, where.x, where.y);
  if (!hit) { blip(220, .05, "square"); return; }
  const colour = hit.kind === "gold" ? "#ffc42e"
               : hit.kind === "bomb" ? "#42505c" : hit.balloon.colour;
  burst(hit.balloon, colour);
  floats.push({x: hit.balloon.x, y: hit.balloon.y, life: 1, colour,
               text: hit.chain > 1 ? `${hit.points > 0 ? "+" : ""}${hit.points} x${hit.chain}`
                                   : `${hit.points > 0 ? "+" : ""}${hit.points}`});
  if (hit.kind === "bomb") {
    blip(150, .3, "sawtooth");
    GameHub.rumble(player, 140);
  } else {
    blip(520 + hit.chain * 110, .09);
    GameHub.rumble(player, 15 + hit.chain * 6);
  }
});

GameHub.onPause(() => { running = false; });
GameHub.onResume(() => { running = true; });

// The hub keeps one score per game; in a party the number worth keeping is
// whatever the best hand in the room managed.
const finish = () => GameHub.submitScore(
  Math.max(0, ...Object.values(scores)));

const watchForEnd = () => {
  if (over && !watchForEnd.done) { watchForEnd.done = true; finish(); }
  if (!over) watchForEnd.done = false;
  setTimeout(watchForEnd, 500);
};

resize();
room = GameHub.players();
reset(0);
GameHub.ready();
requestAnimationFrame(frame);
watchForEnd();
