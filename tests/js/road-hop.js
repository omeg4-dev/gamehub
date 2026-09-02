// The rules of Road Hop. world.js has no canvas in it, so it is simply
// required here -- no browser to pretend at.
const World = require(process.argv[2]);

const checks = {};
const fresh = seed => World.create({random: World.lcg(seed)});
const settle = (world, ms, step = 16) => {
  for (let t = 0; t < ms; t += step) world.tick(step);
};

// A hop takes a moment; these checks care about where it ended up.
const hop = (world, dcol, drow) => {
  world.hop(dcol, drow);
  settle(world, World.HOP_MS + 20);
};

let w = fresh(1);
w.rows.set(1, {kind: "grass", n: 1, trees: new Set([8]), shade: false});
w.player.col = 8; w.player.row = 0;
checks.treesBlockAHop = w.hop(0, 1) === false && w.player.row === 0;

w = fresh(2);
w.player.col = 0;
checks.theEdgeIsAWall = w.hop(-1, 0) === false;

// A car arriving in your column, while you stand still on the road.
w = fresh(3);
w.rows.set(1, {kind: "road", n: 1, dir: 1, speed: 4, cars: [{x: 2, len: 2}]});
w.player.col = 8; w.player.row = 0;
hop(w, 0, 1);
checks.aQuietRoadIsSafe = w.alive === true;
settle(w, 1600);
checks.aCarKills = w.alive === false && w.cause === "car";

// Water is only crossable on something.
w = fresh(4);
w.rows.set(1, {kind: "water", n: 1, dir: 1, speed: 0, logs: [{x: 0, len: 1}]});
w.player.col = 8; w.player.row = 0;
hop(w, 0, 1);
checks.waterWithoutALogDrowns = w.alive === false && w.cause === "water";

w = fresh(5);
w.rows.set(1, {kind: "water", n: 1, dir: 1, speed: 2, logs: [{x: 7.5, len: 3}]});
w.player.col = 8; w.player.row = 0;
hop(w, 0, 1);
const before = w.player.col;
settle(w, 500);
checks.aLogCarriesYou = w.alive === true && w.player.col > before + .5;

// And a log is a thing that is leaving.
w = fresh(6);
w.rows.set(1, {kind: "water", n: 1, dir: 1, speed: 3, logs: [{x: 7.5, len: 3}]});
w.player.col = 8; w.player.row = 0;
hop(w, 0, 1);
settle(w, 6000);
checks.sweptOffTheEdgeDrowns = w.alive === false && w.cause === "swept";

// The score is how far you got, not where you are.
w = fresh(7);
for (let n = 1; n <= 3; n++) w.rows.set(n, {kind: "grass", n, trees: new Set()});
w.rows.set(0, {kind: "grass", n: 0, trees: new Set()});
hop(w, 0, 1); hop(w, 0, 1); hop(w, 0, -1);
checks.theScoreIsTheFurthestRow = w.score === 2 && w.player.row === 1;

// Stand still long enough and the camera leaves without you.
w = fresh(8);
w.player.row = 0;
w.camera = 0.5;
settle(w, 1200);
checks.theEagleTakesYouIfYouFallBehind =
  w.alive === false && w.cause === "eagle";

// Two things about generation that a round would be ruined by.
w = fresh(9);
let allWaterCrossable = true, noWalls = true, trainsWarn = true;
for (let n = 0; n < 600; n++) {
  const here = w.row(n);
  if (here.kind === "water" && !here.logs.length) allWaterCrossable = false;
  if (here.kind === "grass" && here.trees.size > World.COLS - 5) noWalls = false;
  if (here.kind === "track" && here.phase !== "idle") trainsWarn = false;
}
checks.everyWaterRowHasSomethingToStandOn = allWaterCrossable;
checks.noGrassRowIsAWall = noWalls;
checks.aTrackStartsQuiet = trainsWarn;

// A train announces itself before it arrives.
w = fresh(10);
const rails = {kind: "track", n: 1, phase: "idle", timer: 100, train: null, dir: 1};
w.rows.set(1, rails);
w.player.col = 8; w.player.row = 0;
hop(w, 0, 1);
settle(w, 200);
const sawWarning = (() => {
  for (let t = 0; t < 4000; t += 16) {
    w.tick(16);
    if (rails.phase === "train") return true;      // warned on the way here
    if (!w.alive) return false;                    // hit with no warning
  }
  return false;
})();
checks.theTrainWarnsBeforeItArrives = sawWarning && rails.phase === "train";

// The input queue: a second press during a hop is not thrown away.
w = fresh(11);
for (let n = 1; n <= 3; n++) w.rows.set(n, {kind: "grass", n, trees: new Set()});
w.hop(0, 1);
w.tick(40);
checks.aSecondPressIsQueuedNotLost = w.hop(0, 1) === false;
settle(w, World.HOP_MS * 3);
checks.theQueuedHopHappens = w.player.row === 2;

console.log(JSON.stringify(checks));
