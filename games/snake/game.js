// Snake, steered two ways. The d-pad is the honest one; pointing is the
// one that makes sense with a remote in your hand -- the head turns
// towards wherever you are pointing, which is how you would explain the
// game to somebody rather than how a keyboard would.
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const COLS = 21, ROWS = 13;
const START_TICK = 170, FAST_TICK = 80;   // milliseconds per step

let snake, dir, queued, apple, score, best, dead, running, elapsed, tick;
let pointer = {x: 0.5, y: 0.5};
let board = {x: 0, y: 0, cell: 10};

const resize = () => {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  // One cell size for both axes, so the board stays square-celled and
  // centred whatever shape the screen is.
  const cell = Math.floor(Math.min((innerWidth - 80) / COLS,
                                   (innerHeight - 180) / ROWS));
  board = {cell,
           x: (innerWidth - cell * COLS) / 2,
           y: (innerHeight - cell * ROWS) / 2 + 24};
};
addEventListener("resize", resize);
resize();

const free = () => {
  const taken = new Set(snake.map(s => `${s.x},${s.y}`));
  const open = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!taken.has(`${x},${y}`)) open.push({x, y});
    }
  }
  return open[(Math.random() * open.length) | 0];
};

const reset = () => {
  snake = [{x: 8, y: 6}, {x: 7, y: 6}, {x: 6, y: 6}];
  dir = {x: 1, y: 0};
  queued = null;
  score = 0;
  dead = false;
  elapsed = 0;
  tick = START_TICK;
  apple = free();
};

const turn = (x, y) => {
  // A snake cannot turn back into its own neck, and the queue is what
  // stops two quick presses in one step from doing it either.
  const from = queued || dir;
  if (from.x === -x && from.y === -y) return;
  queued = {x, y};
};

const step = () => {
  if (queued) { dir = queued; queued = null; }
  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
  if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS ||
      snake.some(s => s.x === head.x && s.y === head.y)) {
    dead = true;
    GameHub.submitScore(score);
    GameHub.highScores().then(rows => { best = rows[0]?.score ?? score; });
    return;
  }
  snake.unshift(head);
  if (head.x === apple.x && head.y === apple.y) {
    score += 10;
    tick = Math.max(FAST_TICK, tick - 4);
    apple = free();
  } else {
    snake.pop();
  }
};

// --- input -------------------------------------------------------------
const DPAD = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]};

GameHub.on("pointer", p => {
  pointer = p;
  if (dead || !running) return;
  // Where the head is on the screen, in the same 0..1 the pointer speaks.
  const hx = (board.x + (snake[0].x + 0.5) * board.cell) / innerWidth;
  const hy = (board.y + (snake[0].y + 0.5) * board.cell) / innerHeight;
  const dx = (p.x - hx) * innerWidth;
  const dy = (p.y - hy) * innerHeight;
  if (Math.abs(dx) < board.cell && Math.abs(dy) < board.cell) return;
  if (Math.abs(dx) > Math.abs(dy)) turn(Math.sign(dx), 0);
  else turn(0, Math.sign(dy));
});

GameHub.on("button", event => {
  if (!event.down) return;
  if (DPAD[event.name]) return turn(...DPAD[event.name]);
  if (event.name === "a" && dead) reset();
});

GameHub.onPause(() => { running = false; });
GameHub.onResume(() => { running = true; });

// --- drawing -----------------------------------------------------------
const plate = (x, y, w, h, r, fill, edge) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke(); }
};

const draw = () => {
  const {x: bx, y: by, cell} = board;
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  ctx.save();
  ctx.shadowColor = "rgba(70,105,130,.28)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  plate(bx - 10, by - 10, cell * COLS + 20, cell * ROWS + 20, 16,
        "#eef4f8", "#ffffff");
  ctx.restore();

  ctx.strokeStyle = "rgba(150,180,200,.22)";
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(bx + x * cell, by);
    ctx.lineTo(bx + x * cell, by + ROWS * cell);
    ctx.stroke();
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(bx, by + y * cell);
    ctx.lineTo(bx + COLS * cell, by + y * cell);
    ctx.stroke();
  }

  // The apple, with the leaf that says which end is up.
  const ax = bx + (apple.x + 0.5) * cell, ay = by + (apple.y + 0.5) * cell;
  ctx.beginPath();
  ctx.arc(ax, ay + cell * .05, cell * .34, 0, Math.PI * 2);
  ctx.fillStyle = "#ff5f57";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(ax + cell * .16, ay - cell * .3, cell * .16, cell * .07,
              -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "#5ec26a";
  ctx.fill();

  snake.forEach((s, i) => {
    const t = i / Math.max(1, snake.length - 1);
    const pad = cell * (i === 0 ? .04 : .08);
    // Green, and lighter towards the tail, so the head is the part your
    // eye lands on from across the room.
    plate(bx + s.x * cell + pad, by + s.y * cell + pad,
          cell - pad * 2, cell - pad * 2, cell * .3,
          i === 0 ? "#2f9e5e"
                  : `rgb(${72 + t * 50}, ${196 + t * 20}, ${122 + t * 40})`,
          "rgba(255,255,255,.85)");
  });

  // Eyes, so the head reads as a head at a glance from the sofa.
  const head = snake[0];
  const hx = bx + (head.x + .5) * cell, hy = by + (head.y + .5) * cell;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(hx + dir.y * side * cell * .2 + dir.x * cell * .16,
            hy + dir.x * side * cell * .2 + dir.y * cell * .16,
            cell * .09, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  ctx.fillStyle = "#3d5566";
  ctx.font = `800 ${Math.round(innerHeight * .045)}px "Hub Round", system-ui`;
  ctx.textAlign = "left";
  ctx.fillText(`${score}`, bx - 4, by - 34);
  if (best !== undefined) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#7d93a1";
    ctx.fillText(`best ${best}`, bx + COLS * cell + 4, by - 34);
  }

  if (dead) {
    ctx.save();
    ctx.fillStyle = "rgba(240,246,250,.86)";
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = "#3d5566";
    ctx.textAlign = "center";
    ctx.font = `900 ${Math.round(innerHeight * .09)}px "Hub Round", system-ui`;
    ctx.fillText(`${score}`, innerWidth / 2, innerHeight / 2);
    ctx.font = `700 ${Math.round(innerHeight * .035)}px "Hub Round", system-ui`;
    ctx.fillStyle = "#7d93a1";
    ctx.fillText("A to play again", innerWidth / 2, innerHeight / 2 + innerHeight * .07);
    ctx.restore();
  }
};

// --- the loop ----------------------------------------------------------
let last = performance.now();
const frame = now => {
  const dt = now - last;
  last = now;
  if (running && !dead) {
    elapsed += dt;
    while (elapsed >= tick && !dead) { elapsed -= tick; step(); }
  }
  draw();
  requestAnimationFrame(frame);
};

reset();
running = true;
requestAnimationFrame(frame);
GameHub.ready();
