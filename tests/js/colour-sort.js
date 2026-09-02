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
function solvable(start, depth, budget = 400000) {
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
                                 (to.length + poured === depth ? 2 : 0)});
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

const results = [];
for (let level = 0; level < 10; level++) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = game.deal(level);
    results.push({level, empty: game.solvedAlready(),
                  solvable: solvable(before, 4)});
  }
}
console.log(JSON.stringify(results));
