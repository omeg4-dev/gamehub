// The rules of Road Hop, with nothing on the screen.
//
// Everything that can kill you lives in this file and none of it touches a
// canvas, so the whole of it runs in node: a car arriving in your column,
// a log carrying you off the edge, the eagle that takes you when you fall
// behind. game.js draws what this describes and sends it hops.
const World = (() => {
  const COLS = 17;
  const HOP_MS = 130;            // how long a hop is in the air
  const SAFE_ROWS = 3;           // the verge you start on, never generated
  const BEHIND = 4;              // rows of road kept visible behind you
  const TRAIN_SPEED = 30;        // columns a second, which is not survivable
  const WARN_MS = 1500;          // headlights and a bell before it arrives
  const LOOP_LO = -7, LOOP_HI = COLS + 5;   // where traffic wraps around

  // A small deterministic generator, so a board that killed you unfairly
  // can be dealt again in a test rather than described from memory.
  const lcg = seed => () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  const wrap = x => {
    const span = LOOP_HI - LOOP_LO;
    return ((x - LOOP_LO) % span + span) % span + LOOP_LO;
  };

  const pick = (random, list) => list[Math.floor(random() * list.length) % list.length];
  const between = (random, lo, hi) => lo + random() * (hi - lo);
  const whole = (random, lo, hi) => Math.floor(between(random, lo, hi + 1));

  const CAR_COLOURS = ["#e2574c", "#f0a83c", "#5fb3e8", "#8a63d2",
                       "#4bbf72", "#f2f2f2", "#3c4a56"];

  function create(options = {}) {
    const random = options.random || lcg(Math.floor(Math.random() * 2 ** 30));
    const rows = new Map();
    const plan = [];

    const world = {
      COLS, HOP_MS, BEHIND, random, rows,
      player: {col: (COLS - 1) >> 1, row: 0, fromCol: (COLS - 1) >> 1,
               fromRow: 0, hop: 1},
      alive: true,
      cause: null,
      score: 0,
      camera: -BEHIND,
      time: 0,
      queued: null,
      eagle: 0,                  // 0..1, how far the eagle has come for you
    };

    // --- what a row is ---------------------------------------------------
    const grass = (n, bare) => {
      const trees = new Set();
      if (!bare) {
        // A row that can be walked round: the original never seals one off,
        // and neither does this -- at least five ways through, always.
        const wanted = whole(random, 1, Math.min(7, COLS - 5));
        while (trees.size < wanted) trees.add(whole(random, 0, COLS - 1));
      }
      return {kind: "grass", n, trees, shade: n % 2 === 0};
    };

    const road = (n, hard) => {
      const dir = random() < .5 ? 1 : -1;
      const speed = between(random, 2.4, 4.0) + hard * 1.6;
      const cars = [];
      let x = between(random, LOOP_LO, LOOP_HI);
      while (x < LOOP_HI) {
        const truck = random() < .22;
        cars.push({x: wrap(x), len: truck ? 3 : 2, truck,
                   colour: pick(random, CAR_COLOURS)});
        x += (truck ? 3 : 2) + between(random, 3.2, 7.5) - hard;
      }
      return {kind: "road", n, dir, speed, cars};
    };

    const water = (n, hard) => {
      const dir = random() < .5 ? 1 : -1;
      const pads = random() < .18;
      const speed = pads ? 0 : between(random, 1.3, 2.4) + hard * .9;
      const logs = [];
      let x = between(random, LOOP_LO, LOOP_HI);
      while (x < LOOP_HI) {
        const len = pads ? 1 : whole(random, 2, 4);
        logs.push({x: wrap(x), len});
        x += len + between(random, 1.6, 3.4);
      }
      // Water you cannot cross is not a hazard, it is a wall.
      if (!logs.length) logs.push({x: 2, len: 3});
      return {kind: "water", n, dir, speed, logs, pads};
    };

    const track = n => ({kind: "track", n, phase: "idle",
                         timer: between(random, 2.5, 6), train: null,
                         dir: random() < .5 ? 1 : -1});

    // Sections, the way the original lays them out: a group of lanes of one
    // kind, and a bare verge after anything that moves, so there is always
    // somewhere to stand and think.
    const plot = n => {
      const hard = Math.min(1, world.score / 320);
      const roll = random();
      const kind = roll < .45 ? "road" : roll < .72 ? "water"
                 : roll < .88 ? "track" : "grass";
      const many = kind === "road" ? whole(random, 1, 4)
                 : kind === "water" ? whole(random, 1, 3)
                 : kind === "track" ? whole(random, 1, 2)
                 : whole(random, 1, 2);
      for (let i = 0; i < many; i++) plan.push(kind);
      if (kind !== "grass") plan.push("verge");
      return plan;
    };

    const make = n => {
      // The verge you start on, and the ground behind it: the camera opens
      // five rows back, and an empty screen down there would look like the
      // world had not finished loading.
      if (n <= SAFE_ROWS) return grass(n, true);
      if (!plan.length) plot(n);
      const kind = plan.shift();
      const hard = Math.min(1, world.score / 320);
      if (kind === "road") return road(n, hard);
      if (kind === "water") return water(n, hard);
      if (kind === "track") return track(n);
      return grass(n, kind === "verge");
    };

    const row = n => {
      if (!rows.has(n)) rows.set(n, make(n));
      return rows.get(n);
    };
    // Rows behind the start line exist so the camera has something to show,
    // but nothing is ever generated onto them.
    world.row = row;

    // --- what is where ---------------------------------------------------
    // Traffic wraps around a loop wider than the screen, so the gaps
    // between cars stay exactly as they were dealt however long you watch.
    const spans = (list, dir) => list.map(item => {
      const start = item.x;
      return {start, end: start + item.len, item};
    });

    const overlapping = (list, col, dir) => {
      for (const {start, end, item} of spans(list, dir)) {
        if (col + .78 > start && col + .22 < end) return item;
        // The loop is a circle: something straddling the seam covers both
        // ends of the road at once.
        const shifted = start - (LOOP_HI - LOOP_LO);
        if (col + .78 > shifted && col + .22 < shifted + item.len) return item;
      }
      return null;
    };
    world.overlapping = overlapping;

    const blocked = (n, col) => {
      const here = row(n);
      return here.kind === "grass" && here.trees.has(col);
    };
    world.blocked = blocked;

    // --- moving ----------------------------------------------------------
    const die = cause => {
      if (!world.alive) return;
      world.alive = false;
      world.cause = cause;
    };
    world.die = die;

    const land = () => {
      const p = world.player;
      const here = row(p.row);
      if (here.kind === "water") {
        const log = overlapping(here.logs, p.col, here.dir);
        if (!log) return die("water");
      }
      if (here.kind === "road" && overlapping(here.cars, p.col, here.dir)) {
        return die("car");
      }
      if (here.kind === "track" && here.train
          && overlapping([here.train], p.col, here.dir)) {
        return die("train");
      }
      world.score = Math.max(world.score, p.row);
    };

    const hop = (dcol, drow) => {
      const p = world.player;
      if (!world.alive) return false;
      if (p.hop < 1) { world.queued = [dcol, drow]; return false; }
      const col = Math.round(p.col) + dcol;
      const to = p.row + drow;
      if (col < 0 || col >= COLS) return false;
      if (to < 0) return false;
      if (blocked(to, col)) return false;
      p.fromCol = p.col;
      p.fromRow = p.row;
      p.col = col;
      p.row = to;
      p.hop = 0;
      return true;
    };
    world.hop = hop;

    // --- time ------------------------------------------------------------
    const drive = (list, dir, speed, dt) => {
      for (const item of list) item.x = wrap(item.x + dir * speed * dt / 1000);
    };

    const tick = dt => {
      world.time += dt;
      const p = world.player;

      // Only the rows anybody can see are worth moving.
      const from = Math.floor(world.camera) - 2;
      const to = Math.ceil(world.camera) + 16;
      for (let n = from; n <= to; n++) {
        const here = row(Math.max(0, n));
        if (here.kind === "road") drive(here.cars, here.dir, here.speed, dt);
        if (here.kind === "water" && here.speed) {
          drive(here.logs, here.dir, here.speed, dt);
        }
        if (here.kind === "track") tickTrack(here, dt);
      }

      if (p.hop < 1) {
        p.hop = Math.min(1, p.hop + dt / HOP_MS);
        if (p.hop >= 1) {
          land();
          if (world.queued && world.alive) {
            const [dcol, drow] = world.queued;
            world.queued = null;
            hop(dcol, drow);
          }
        }
      } else if (world.alive) {
        const here = row(p.row);
        // Standing on a log is standing on something that is leaving.
        if (here.kind === "water" && here.speed) {
          const log = overlapping(here.logs, p.col, here.dir);
          if (log) {
            p.col += here.dir * here.speed * dt / 1000;
            if (p.col < -.4 || p.col > COLS - .6) die("swept");
          } else {
            die("water");
          }
        }
        if (here.kind === "road" && overlapping(here.cars, p.col, here.dir)) {
          die("car");
        }
        if (here.kind === "track" && here.train
            && overlapping([here.train], p.col, here.dir)) {
          die("train");
        }
      }

      if (!world.alive) return;

      // The camera creeps forward whatever you do, and gets less patient
      // the further you have gone. Falling off the back of it is the eagle.
      const creep = (0.55 + Math.min(1.4, world.score * 0.004)) * dt / 1000;
      world.camera = Math.max(world.camera + creep, p.row - BEHIND);
      if (p.row < world.camera) {
        world.eagle = Math.min(1, world.eagle + dt / 700);
        if (world.eagle >= 1) die("eagle");
      } else {
        world.eagle = Math.max(0, world.eagle - dt / 500);
      }
    };
    world.tick = tick;

    // A train is a promise before it is a train: the crossing lights up,
    // and a second and a half later there is no crossing it.
    const tickTrack = (here, dt) => {
      here.timer -= dt;
      if (here.phase === "idle" && here.timer <= 0) {
        here.phase = "warn";
        here.timer = WARN_MS;
      } else if (here.phase === "warn" && here.timer <= 0) {
        here.phase = "train";
        here.train = {x: here.dir > 0 ? LOOP_LO - 8 : LOOP_HI + 8, len: 8};
        here.timer = 0;
      } else if (here.phase === "train") {
        here.train.x += here.dir * TRAIN_SPEED * dt / 1000;
        const gone = here.dir > 0 ? here.train.x > LOOP_HI + 2
                                  : here.train.x + here.train.len < LOOP_LO - 2;
        if (gone) {
          here.phase = "idle";
          here.train = null;
          here.timer = between(random, 3, 7);
        }
      }
    };

    return world;
  }

  return {create, lcg, COLS, HOP_MS, BEHIND, LOOP_LO, LOOP_HI};
})();

if (typeof module !== "undefined") module.exports = World;
