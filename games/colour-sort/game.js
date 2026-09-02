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

GameHub.on("pointer", p => { pointer = p; });

GameHub.on("button", event => {
  if (!event.down || !running || over) return;
  if (event.name === "b") {
    const last = undo.pop();
    if (last) {
      for (let n = 0; n < last.moved; n++) last.from.push(last.to.pop());
    }
    held = null;
    return;
  }
  if (event.name !== "a") return;
  const tube = under();
  if (!tube) { held = null; return; }
  if (!held) { if (tube.length) held = tube; return; }
  if (legal(held, tube)) {
    pour(held, tube);
    held = null;
    if (done()) {
      solved++;
      level++;
      deal();
    }
  } else {
    held = tube.length ? tube : null;
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

const draw = () => {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
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
    const y = topY + row * gapY;
    boxes.push({tube, x, y, w, h});

    const lifted = tube === held;
    const unit = h / DEPTH;

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
      const raised = lifted && n === tube.length - 1 ? unit * .35 : 0;
      ctx.fillStyle = COLOURS[colour];
      ctx.fillRect(x + w * .06, y + h - (n + 1) * unit - raised,
                   w * .88, unit + 1);
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
