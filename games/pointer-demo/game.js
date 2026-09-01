// A test of the pointer that happens to be a game. Sixty seconds, balloons
// rising, and the only skill involved is aiming -- which is exactly the
// thing that needs proving.
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const resize = () => {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
};
addEventListener("resize", resize);
resize();

const COLOURS = ["#ff6b6b", "#ffd93d", "#6bcB77", "#4d96ff", "#c56bff"];
let balloons = [];
let score = 0;
let pointer = {x: 0.5, y: 0.5};
let ends = performance.now() + 60000;
let running = true;

const spawn = () => balloons.push({
  x: Math.random(), y: 1.1,
  r: 0.03 + Math.random() * 0.03,
  speed: 0.05 + Math.random() * 0.08,
  drift: (Math.random() - 0.5) * 0.04,
  colour: COLOURS[(Math.random() * COLOURS.length) | 0],
});

GameHub.on("pointer", p => { pointer = p; });
GameHub.on("button", event => {
  if (!event.down || event.name !== "a" || !running) return;
  pop(1);
});
GameHub.on("gesture", () => {
  // A swing clears everything near the cursor: the bonus that makes the
  // accelerometer path visible while playing.
  if (running) pop(3, 2.5);
});
GameHub.onPause(() => { running = false; });
GameHub.onResume(() => { running = true; });

function pop(worth, reach = 1) {
  const before = balloons.length;
  balloons = balloons.filter(b => {
    const dx = b.x - pointer.x;
    const dy = (b.y - pointer.y) * (innerHeight / innerWidth);
    return Math.hypot(dx, dy) > b.r * reach;
  });
  score += (before - balloons.length) * worth;
}

let last = performance.now();
const frame = now => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (running) {
    if (Math.random() < dt * 2.5) spawn();
    balloons.forEach(b => { b.y -= b.speed * dt; b.x += b.drift * dt; });
    balloons = balloons.filter(b => b.y > -0.15);
  }

  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const b of balloons) {
    ctx.beginPath();
    ctx.ellipse(b.x * innerWidth, b.y * innerHeight,
                b.r * innerWidth, b.r * innerWidth * 1.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = b.colour;
    ctx.fill();
  }
  ctx.fillStyle = "#20303c";
  ctx.font = "600 4vmin system-ui";
  const left = Math.max(0, (ends - now) / 1000);
  ctx.fillText(`${score}`, 24, 56);
  ctx.fillText(`${left.toFixed(0)}s`, innerWidth - 120, 56);

  if (left <= 0 && running) {
    running = false;
    GameHub.submitScore(score);
    GameHub.highScores().then(rows => {
      ctx.fillText(`best ${rows[0]?.score ?? score}`, 24, 110);
      setTimeout(() => GameHub.exit(), 4000);
    });
  }
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
GameHub.ready();
