// Every level this game will ever deal, checked for the two things that
// would ruin a round: a board that starts already finished, and a board
// that cannot be finished at all.
const {load} = require("./harness");

const game = load(process.argv[2], `
  out = {
    deal: n => { level = n; deal(); return tubes.map(t => t.slice()); },
    solvedAlready: () => done(),
  };
`);

const key = state => state.map(t => t.join(",")).sort().join("|");
const finished = (state, depth) =>
  state.every(t => t.length === 0 ||
                   (t.length === depth && t.every(c => c === t[0])));

// Depth-first with the two prunings that make this finish in a blink:
// never pour a tube that is already one clean colour into an empty tube,
// and try the moves that empty a tube or complete one first.
function nextStates(state, depth) {
  const out = [];
  for (let i = 0; i < state.length; i++) {
    const from = state[i];
    if (!from.length) continue;
    const colour = from[from.length - 1];
    let run = 0;
    while (run < from.length && from[from.length - 1 - run] === colour) run++;
    if (run === from.length && (from.length === depth || run === depth)) continue;
    for (let j = 0; j < state.length; j++) {
      const to = state[j];
      if (i === j || to.length === depth) continue;
      if (to.length && to[to.length - 1] !== colour) continue;
      if (!to.length && run === from.length) continue;     // pure shuffling
      const next = state.map(t => t.slice());
      while (next[i].length && next[i][next[i].length - 1] === colour &&
             next[j].length < depth) {
        next[j].push(next[i].pop());
      }
      out.push(next);
    }
  }
  return out;
}

function attempt(start, depth, budget, jitter) {
  const seen = new Set([key(start)]);
  const stack = [start];
  while (stack.length && seen.size < budget) {
    const state = stack.pop();
    if (finished(state, depth)) return true;
    const moves = [];
    for (let i = 0; i < state.length; i++) {
      const from = state[i];
      if (!from.length) continue;
      const colour = from[from.length - 1];
      let run = 0;
      while (run < from.length && from[from.length - 1 - run] === colour) run++;
      if (run === from.length && (from.length === depth || run === depth)) continue;
      for (let j = 0; j < state.length; j++) {
        const to = state[j];
        if (i === j || to.length === depth) continue;
        if (to.length && to[to.length - 1] !== colour) continue;
        if (!to.length && run === from.length) continue;   // pure shuffling
        const poured = Math.min(run, depth - to.length);
        moves.push({i, j, score: (poured === from.length ? 2 : 0) +
                                 (to.length + poured === depth ? 2 : 0)
                                 + jitter * Math.random()});
      }
    }
    moves.sort((a, b) => a.score - b.score);
    for (const move of moves) {
      const next = state.map(t => t.slice());
      const colour = next[move.i][next[move.i].length - 1];
      while (next[move.i].length &&
             next[move.i][next[move.i].length - 1] === colour &&
             next[move.j].length < depth) {
        next[move.j].push(next[move.i].pop());
      }
      const id = key(next);
      if (!seen.has(id)) { seen.add(id); stack.push(next); }
    }
  }
  return false;
}

// How far from sorted a board is: every colour that is spread over more
// than one tube costs one move at the very least. Ten tubes of four is far
// too big a space to walk exhaustively, so the search follows this rather
// than the order the moves happened to be generated in.
function scatter(state) {
  const tubes = new Map();
  state.forEach((tube, i) => {
    for (const colour of new Set(tube)) {
      tubes.set(colour, (tubes.get(colour) || 0) + 1);
    }
  });
  let cost = 0;
  for (const count of tubes.values()) cost += count - 1;
  return cost;
}

// Best-first: always expand whichever board is closest to sorted. Greedy
// depth-first walks into corners on the eight-colour deals and then spends
// its whole budget in one, which is what made this check flake.
function best(start, depth, budget = 200000) {
  const seen = new Set([key(start)]);
  let open = [{state: start, cost: scatter(start)}];
  while (open.length && seen.size < budget) {
    open.sort((a, b) => b.cost - a.cost);
    const {state} = open.pop();
    if (finished(state, depth)) return true;
    for (const next of nextStates(state, depth)) {
      const id = key(next);
      if (seen.has(id)) continue;
      seen.add(id);
      open.push({state: next, cost: scatter(next)});
    }
  }
  return false;
}

function solvable(start, depth) {
  return attempt(start, depth, 120000, 1.5) || best(start, depth);
}

const results = [];
for (let level = 0; level < 10; level++) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = game.deal(level);
    results.push({level, empty: game.solvedAlready(),
                  solvable: solvable(before, 4)});
  }
}
console.log(JSON.stringify(results));
