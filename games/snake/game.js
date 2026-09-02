// Snake, steered by snapping the phone the way you want to go.
//
// The board ticks; the drawing does not. Everything on screen is drawn at
// a fraction between the last tick and the next one, so a snake moving at
// six cells a second is still a smooth line on a 144 Hz screen -- which is
// the whole difference between a grid demo and something worth another go.
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const COLS = 21, ROWS = 13;
const START_TICK = 190, FAST_TICK = 82, SPEED_UP = 4;

let snake, dir, queue, apple, dead, score, tick, best = 0;
let elapsed = 0, last = 0, shake = 0, eaten = 0;
const sparks = [];
const floats = [];   // the score, leaving the apple behind it
const board = {x: 0, y: 0, cell: 10};

// --- rules --------------------------------------------------------------
const free = () => {
  // Rejection sampling: on a board this size the snake is a rounding error
  // for most of a game, and the alternative is a list rebuild every apple.
  while (true) {
    const cell = {x: Math.floor(Math.random() * COLS),
                  y: Math.floor(Math.random() * ROWS)};
    if (!snake.some(part => part.x === cell.x && part.y === cell.y)) return cell;
  }
};

const reset = () => {
  snake = [{x: 6, y: 6}, {x: 5, y: 6}, {x: 4, y: 6}];
  dir = {x: 1, y: 0};
  queue = [];
  dead = false;
  score = 0;
  eaten = 0;
  tick = START_TICK;
  elapsed = 0;
  apple = free();
  sparks.length = 0;
  floats.length = 0;
};

// A turn into your own neck is a mistake, not a death. The phone is a
// blunt instrument -- a hard snap left while running right would otherwise
// end the game for a movement that meant "left".
const turn = (x, y) => {
  if (dead) return;
  const from = queue.length ? queue[queue.length - 1] : dir;
  if (x === -from.x && y === -from.y) return;
  if (x === from.x && y === from.y) return;
  if (queue.length < 2) {
    queue.push({x, y});
    blip(520, 0.03, "square");
  }
};

const step = () => {
  if (dead) return;
  if (queue.length) dir = queue.shift();
  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
  const hitWall = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
  const hitSelf = snake.slice(0, -1).some(p => p.x === head.x && p.y === head.y);
  if (hitWall || hitSelf) {
    dead = true;
    shake = 1;
    blip(180, 0.5, "sawtooth");
    GameHub.rumble(1, 120);
    GameHub.submitScore(score);
    return;
  }
  snake.unshift(head);
  if (head.x === apple.x && head.y === apple.y) {
    score += 10;
    eaten++;
    tick = Math.max(FAST_TICK, tick - SPEED_UP);
    apple = free();
    burst(head);
    floats.push({x: head.x + .5, y: head.y + .5, life: 1, text: `+10`});
    blip(660 + Math.min(9, eaten) * 40, 0.09);
    GameHub.rumble(1, 18);
  } else {
    snake.pop();
  }
};

// --- juice ---------------------------------------------------------------
const burst = cell => {
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + Math.random();
    const speed = 2 + Math.random() * 4;
    sparks.push({x: cell.x + .5, y: cell.y + .5,
                 vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                 life: 1, hue: 8 + Math.random() * 20});
  }
};

const blip = (hz, seconds = 0.06, shape = "triangle") => {
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Audio) return;                  // no speakers is not a broken game
  const ctxA = blip.ctx ||= new Audio();
  const osc = ctxA.createOscillator();
  const gain = ctxA.createGain();
  osc.type = shape;
  osc.frequency.setValueAtTime(hz, ctxA.currentTime);
  if (shape === "sawtooth") {
    osc.frequency.exponentialRampToValueAtTime(60, ctxA.currentTime + seconds);
  }
  gain.gain.setValueAtTime(0.06, ctxA.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0005, ctxA.currentTime + seconds);
  osc.connect(gain).connect(ctxA.destination);
  osc.start();
  osc.stop(ctxA.currentTime + seconds);
};

// --- drawing -------------------------------------------------------------
const resize = () => {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  board.cell = Math.floor(Math.min(innerWidth * .92 / COLS,
                                   innerHeight * .82 / ROWS));
  board.x = (innerWidth - board.cell * COLS) / 2;
  board.y = (innerHeight - board.cell * ROWS) / 2 + innerHeight * .03;
};
addEventListener("resize", resize);

const at = (cell, dx = 0, dy = 0) => [
  board.x + (cell.x + .5 + dx) * board.cell,
  board.y + (cell.y + .5 + dy) * board.cell,
];

const roundRect = (x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawBoard = () => {
  const w = board.cell * COLS, h = board.cell * ROWS;
  ctx.save();
  ctx.shadowColor = "rgba(60,100,125,.28)";
  ctx.shadowBlur = board.cell * .8;
  ctx.shadowOffsetY = board.cell * .25;
  ctx.fillStyle = "#ffffff";
  roundRect(board.x, board.y, w, h, board.cell * .5);
  ctx.fill();
  ctx.restore();

  // A checker so faint it reads as texture, not as a grid to count.
  ctx.save();
  roundRect(board.x, board.y, w, h, board.cell * .5);
  ctx.clip();
  ctx.fillStyle = "rgba(105,150,175,.055)";
  for (let y = 0; y < ROWS; y++) {
    for (let x = (y % 2); x < COLS; x += 2) {
      ctx.fillRect(board.x + x * board.cell, board.y + y * board.cell,
                   board.cell, board.cell);
    }
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = board.cell * .12;
  roundRect(board.x, board.y, w, h, board.cell * .5);
  ctx.stroke();
};

const drawApple = time => {
  const pulse = 1 + Math.sin(time / 260) * .07;
  const [x, y] = at(apple);
  const r = board.cell * .34 * pulse;
  ctx.save();
  ctx.shadowColor = "rgba(220,70,60,.45)";
  ctx.shadowBlur = board.cell * .6;
  const skin = ctx.createRadialGradient(x - r * .35, y - r * .45, r * .1, x, y, r);
  skin.addColorStop(0, "#ff8e7d");
  skin.addColorStop(.55, "#f2503f");
  skin.addColorStop(1, "#c92f28");
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#5aa84a";
  ctx.beginPath();
  ctx.ellipse(x + r * .45, y - r * .95, r * .42, r * .2, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.beginPath();
  ctx.ellipse(x - r * .32, y - r * .38, r * .22, r * .13, -0.7, 0, Math.PI * 2);
  ctx.fill();
};

// The body is one stroked path through the cell centres, with the head and
// the tail placed between cells by `progress`. Round joins do the corners
// for free -- drawing a square per cell is what makes most browser snakes
// look like a spreadsheet.
const bodyPath = progress => {
  const points = [];
  const head = snake[0];
  points.push(at(head, dir.x * progress, dir.y * progress));
  for (let i = 0; i < snake.length - 1; i++) points.push(at(snake[i]));
  const last2 = snake[snake.length - 1], before = snake[snake.length - 2];
  if (before) {
    points.push(at(last2, (before.x - last2.x) * progress,
                          (before.y - last2.y) * progress));
  }
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  return points;
};

const drawSnake = (progress, time) => {
  const width = board.cell * .78;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.save();
  ctx.shadowColor = "rgba(40,110,70,.35)";
  ctx.shadowBlur = board.cell * .5;
  ctx.shadowOffsetY = board.cell * .18;
  ctx.strokeStyle = "#2f9e5e";
  ctx.lineWidth = width;
  bodyPath(progress);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,.42)";
  ctx.lineWidth = width * .34;
  const points = bodyPath(progress);
  ctx.stroke();

  // The head: a rounded cap with a face on it, turned the way it is going.
  const [hx, hy] = points[0];
  const angle = Math.atan2(dir.y, dir.x);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(angle);
  ctx.fillStyle = "#278f52";
  ctx.beginPath();
  ctx.arc(0, 0, width * .58, 0, Math.PI * 2);
  ctx.fill();
  const eye = (side) => {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(width * .10, side * width * .24, width * .19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d3b2b";
    const look = dead ? 0 : Math.sin(time / 400) * width * .04;
    ctx.beginPath();
    ctx.arc(width * .17 + look, side * width * .24, width * .09, 0, Math.PI * 2);
    ctx.fill();
  };
  eye(-1); eye(1);
  ctx.restore();
};

const drawSparks = dt => {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const spark = sparks[i];
    spark.x += spark.vx * dt / 1000;
    spark.y += spark.vy * dt / 1000;
    spark.vy += dt / 1000 * 6;
    spark.life -= dt / 520;
    if (spark.life <= 0) { sparks.splice(i, 1); continue; }
    const [x, y] = at(spark, -.5, -.5);
    ctx.globalAlpha = Math.max(0, spark.life);
    ctx.fillStyle = `hsl(${spark.hue} 85% 55%)`;
    ctx.beginPath();
    ctx.arc(x, y, board.cell * .09 * spark.life + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const drawFloats = dt => {
  ctx.textAlign = "center";
  for (let i = floats.length - 1; i >= 0; i--) {
    const float = floats[i];
    float.life -= dt / 900;
    if (float.life <= 0) { floats.splice(i, 1); continue; }
    const [x, y] = at(float, -.5, -.5);
    ctx.globalAlpha = Math.min(1, float.life * 1.6);
    ctx.fillStyle = "#2f9e5e";
    ctx.font = `900 ${board.cell * (.5 + (1 - float.life) * .12)}px "Hub Round", system-ui, sans-serif`;
    ctx.fillText(float.text, x, y - (1 - float.life) * board.cell * 1.6);
  }
  ctx.globalAlpha = 1;
};

const drawScore = () => {
  ctx.textAlign = "center";
  ctx.fillStyle = "#8ba3b0";
  ctx.font = `800 ${board.cell * .5}px "Hub Round", system-ui, sans-serif`;
  ctx.fillText(best ? `BEST ${best}` : "", innerWidth / 2, board.y - board.cell * .95);
  ctx.fillStyle = "#3d5866";
  ctx.font = `900 ${board.cell * .95}px "Hub Round", system-ui, sans-serif`;
  ctx.fillText(String(score), innerWidth / 2, board.y - board.cell * .2);

  if (dead) {
    ctx.save();
    ctx.globalAlpha = .9;
    ctx.fillStyle = "#ffffff";
    const w = board.cell * 11, h = board.cell * 3.4;
    roundRect(innerWidth / 2 - w / 2, innerHeight / 2 - h / 2, w, h, board.cell * .7);
    ctx.shadowColor = "rgba(50,90,115,.35)";
    ctx.shadowBlur = board.cell;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#3d5866";
    ctx.font = `900 ${board.cell}px "Hub Round", system-ui, sans-serif`;
    ctx.fillText(`${score} points`, innerWidth / 2, innerHeight / 2 - board.cell * .1);
    ctx.fillStyle = "#7d93a1";
    ctx.font = `700 ${board.cell * .55}px "Hub Round", system-ui, sans-serif`;
    ctx.fillText("Press A to go again", innerWidth / 2,
                 innerHeight / 2 + board.cell * .95);
  }
};

const frame = time => {
  const dt = Math.min(100, time - last || 16);
  last = time;
  if (!dead) {
    elapsed += dt;
    // The guard matters: without it a tab that was backgrounded comes back
    // and runs a hundred ticks into a wall.
    while (elapsed >= tick && !dead) { elapsed -= tick; step(); }
  }
  const progress = dead ? 1 : Math.min(1, elapsed / tick);

  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.save();
  if (shake > 0) {
    shake = Math.max(0, shake - dt / 320);
    const amount = shake * board.cell * .35;
    ctx.translate((Math.random() - .5) * amount, (Math.random() - .5) * amount);
  }
  drawBoard();
  drawApple(time);
  drawSnake(progress, time);
  drawSparks(dt);
  drawFloats(dt);
  ctx.restore();
  drawScore();
  requestAnimationFrame(frame);
};

// --- steering ------------------------------------------------------------
const WAY = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]};

// A flick is a wrist snap, measured on the server as a rate rather than an
// angle: hold the phone tilted and the snake keeps going straight.
GameHub.on("flick", event => {
  if ((event.player || 1) !== 1) return;
  const way = WAY[event.dir];
  if (way) turn(way[0], way[1]);
});

GameHub.on("button", event => {
  // One snake, one hand. A second phone in the room is a spectator here.
  if (!event.down || (event.player || 1) !== 1) return;
  const way = WAY[event.name];
  if (way) return turn(way[0], way[1]);
  if (event.name === "a" && dead) { reset(); refreshBest(); }
  if (event.name === "b") GameHub.exit();
});

const refreshBest = () => GameHub.highScores().then(rows => {
  best = rows && rows.length ? rows[0].score : 0;
});

resize();
reset();
refreshBest();
GameHub.ready();
requestAnimationFrame(frame);
