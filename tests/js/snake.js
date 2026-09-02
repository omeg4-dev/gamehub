// The three rules that make Snake a game rather than a moving line.
const {load} = require("./harness");

const game = load(process.argv[2], `
  out = {
    reset, step, turn,
    state: () => ({snake: snake.map(s => ({...s})), dir: {...dir},
                   apple: {...apple}, dead, score}),
    // A fresh board with a body of our choosing. Clearing the death flag matters:
    // every check after the wall one would otherwise run on a dead snake,
    // whose step() does nothing at all.
    put: (body, d, a) => { snake = body; dir = d; queue = []; apple = a;
                           dead = false; score = 0; },
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

// Curled up, one cell short of its own flank: turning right walks the head
// into the fourth segment. The last segment is deliberately not the target
// -- that cell is vacated on the same tick, and following your own tail is
// legal.
game.put([{x: 5, y: 5}, {x: 5, y: 6}, {x: 6, y: 6}, {x: 6, y: 5}, {x: 7, y: 5}],
         {x: 0, y: -1}, {x: 0, y: 0});
game.turn(1, 0);
game.step();
checks.bitingItselfKills = game.state().dead === true;

game.put([{x: 5, y: 5}, {x: 5, y: 6}, {x: 6, y: 6}, {x: 6, y: 5}],
         {x: 0, y: -1}, {x: 0, y: 0});
game.turn(1, 0);
game.step();                            // into the cell the tail just left
checks.followingItsTailIsFine = game.state().dead === false;

game.reset();
const taken = new Set(game.state().snake.map(s => `${s.x},${s.y}`));
checks.applesAvoidTheSnake = Array.from({length: 200}, () => game.free())
  .every(cell => !taken.has(`${cell.x},${cell.y}`));

// The one the sofa complained about: a hard snap backwards, into the way
// it is already going, must be ignored -- not eaten as a 180 into its own
// neck.
game.put([{x: 5, y: 5}, {x: 4, y: 5}, {x: 3, y: 5}], {x: 1, y: 0}, {x: 0, y: 0});
game.turn(-1, 0);
game.step();
checks.aBackwardsFlickCannotKill =
  game.state().dead === false && game.state().dir.x === 1;

// Two flicks inside one tick queue up, and the second is judged against the
// first rather than against the direction still on screen.
game.put([{x: 5, y: 5}, {x: 4, y: 5}, {x: 3, y: 5}], {x: 1, y: 0}, {x: 0, y: 0});
game.turn(0, 1);
game.turn(0, -1);                       // straight back out of the turn
game.step();
game.step();
checks.aQueuedTurnCannotBeUndoneIntoItself = game.state().dead === false;

console.log(JSON.stringify(checks));
