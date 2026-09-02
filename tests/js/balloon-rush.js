// What a press is worth, which is the whole of the game's argument with
// four people shouting at it.
const {load} = require("./harness");

const game = load(process.argv[2], `
  out = {
    reset, step, popAt,
    // Also parks the spawner: a check about one balloon should not have to
    // reason about the four the clock would have added.
    put: (list) => { balloons = list; spawnAt = 1e9; },
    state: () => ({balloons, scores: {...scores}}),
  };
`);

const balloon = (kind, x, y, speed = 0) =>
  ({x, y, r: 0.05, kind, colour: "#ff6b6b", speed, sway: 0, pop: 0});

const checks = {};

game.reset(0);
game.put([balloon("normal", 0.5, 0.5)]);
checks.aPopIsWorthOne = game.popAt(1, 0.5, 0.5).points === 1;

game.reset(0);
game.put([balloon("gold", 0.5, 0.5)]);
checks.goldIsWorthFive = game.popAt(1, 0.5, 0.5).points === 5;

game.reset(0);
game.put([balloon("bomb", 0.5, 0.5)]);
checks.aBombCostsThree = game.state().scores && game.popAt(1, 0.5, 0.5).points === -3;

game.reset(0);
game.put([balloon("normal", 0.1, 0.1)]);
checks.aMissScoresNothing = game.popAt(1, 0.9, 0.9) === null
  && (game.state().scores[1] || 0) === 0;

// Two balloons on top of each other: the higher one is in front.
game.reset(0);
game.put([balloon("normal", 0.5, 0.52), balloon("gold", 0.5, 0.5)]);
checks.theFrontBalloonPops = game.popAt(1, 0.5, 0.51).kind === "gold";

game.reset(0);
game.put([balloon("normal", 0.5, 0.02, 0.2)]);
game.step(1500);
checks.escapedBalloonsAreForgotten = game.state().balloons.length === 0;

// A run: pop, pop again quickly, and the second is worth double.
game.reset(0);
game.put([balloon("normal", 0.3, 0.5), balloon("normal", 0.7, 0.5)]);
game.popAt(1, 0.3, 0.5);
game.step(200);
checks.aQuickSecondPopIsDoubled = game.popAt(1, 0.7, 0.5).points === 2;

game.reset(0);
game.put([balloon("normal", 0.3, 0.5), balloon("normal", 0.7, 0.5)]);
game.popAt(1, 0.3, 0.5);
game.step(4000);
checks.aSlowSecondPopIsNotDoubled = game.popAt(1, 0.7, 0.5).points === 1;

// Two players, one board: a run belongs to the hand that made it.
game.reset(0);
game.put([balloon("normal", 0.2, 0.5), balloon("normal", 0.4, 0.5),
          balloon("normal", 0.6, 0.5)]);
game.popAt(1, 0.2, 0.5);
game.step(100);
game.popAt(2, 0.4, 0.5);
checks.combosAreNotShared = game.popAt(1, 0.6, 0.5).points === 2
  && game.state().scores[2] === 1;

console.log(JSON.stringify(checks));
