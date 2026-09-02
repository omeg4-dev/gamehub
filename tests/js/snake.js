// The three rules that make Snake a game rather than a moving line.
const {load} = require("./harness");

const game = load(process.argv[2], `
  out = {
    reset, step, turn,
    state: () => ({snake: snake.map(s => ({...s})), dir: {...dir},
                   apple: {...apple}, dead, score}),
    put: (body, d, a) => { snake = body; dir = d; queued = null; apple = a; },
    free: () => free(),
  };
`);

const checks = {};

game.reset();
game.turn(-1, 0);                       // straight back into its own neck
game.step();
checks.refusesToTurnBack = game.state().dir.x === 1;

game.put([{x: 19, y: 6}, {x: 18, y: 6}], {x: 1, y: 0}, {x: 0, y: 0});
game.step();                            // 20 is the last column
game.step();                            // 21 is the wall
checks.wallKills = game.state().dead === true;

game.put([{x: 5, y: 5}, {x: 4, y: 5}, {x: 3, y: 5}], {x: 1, y: 0},
         {x: 6, y: 5});
game.step();
checks.applesGrow = game.state().snake.length === 4 && game.state().score === 10;

game.put([{x: 5, y: 5}, {x: 5, y: 6}, {x: 4, y: 6}, {x: 4, y: 5}],
         {x: 0, y: -1}, {x: 0, y: 0});
game.turn(1, 0);
game.step();                            // right, then down into itself
game.turn(0, 1);
game.step();
checks.bitingItselfKills = game.state().dead === true;

game.reset();
const taken = new Set(game.state().snake.map(s => `${s.x},${s.y}`));
checks.applesAvoidTheSnake = Array.from({length: 200}, () => game.free())
  .every(cell => !taken.has(`${cell.x},${cell.y}`));

console.log(JSON.stringify(checks));
