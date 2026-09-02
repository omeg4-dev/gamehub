// What a throw is allowed to be, which is the whole of the argument when
// four people are shouting at the television.
const {load} = require("./harness");

const game = load(process.argv[2], `
  out = {
    start, tick, throwTo, canThrow,
    // A room of n players, seated and holding a fresh bomb.
    room: (n) => {
      room = Array.from({length: n}, (_, i) =>
        ({n: i + 1, name: "P" + (i + 1), colour: "#3ec7ff"}));
      start();
    },
    // Put the bomb in a known hand with a known fuse, which no amount of
    // waiting for a random one would ever do reliably.
    set: (n, ms, heldFor) => { holder = n; fuse = ms; held = heldFor;
                               flight = null; },
    state: () => ({holder, alive: alive.slice(), fuse, winner,
                   flying: flight !== null, held}),
  };
`);

const checks = {};

game.room(4);
game.set(1, 8000, 0);
checks.aFreshCatchCannotBeThrownOn = game.throwTo(1, 2) === false;

game.set(1, 8000, 2000);
checks.aHeldBombCanBeThrown = game.throwTo(1, 2) === true;

game.room(4);
game.set(1, 8000, 5000);
checks.onlyTheHolderMayThrow = game.throwTo(2, 3) === false;

game.room(4);
game.set(1, 8000, 5000);
checks.youCannotThrowItToYourself = game.throwTo(1, 1) === false;

// In the air it belongs to nobody, and the fuse waits.
game.room(4);
game.set(1, 8000, 5000);
game.throwTo(1, 2);
game.tick(200);
checks.theFuseStopsInTheAir = game.state().fuse === 8000
  && game.state().flying === true;
checks.aSecondThrowInFlightIsRefused = game.throwTo(1, 3) === false;

game.tick(400);
checks.itLandsInTheOtherHand = game.state().holder === 2
  && game.state().flying === false && game.state().held === 0;

// It goes off on whoever is holding it, not on whoever threw it.
game.room(4);
game.set(1, 8000, 5000);
game.throwTo(1, 2);
game.tick(500);
game.set(2, 100, 5000);
game.tick(200);
checks.itExplodesOnTheHolder = !game.state().alive.includes(2)
  && game.state().alive.includes(1);
checks.theBombGoesToSomeoneStillAlive =
  game.state().alive.includes(game.state().holder);
checks.aBangBringsAFreshFuse = game.state().fuse > 1000;

game.room(4);
game.set(1, 1, 5000); game.tick(50);
game.set(game.state().holder, 1, 5000); game.tick(50);
game.set(game.state().holder, 1, 5000); game.tick(50);
checks.theLastOneStandingWins = game.state().winner !== null
  && game.state().alive.length === 1;

game.room(4);
game.set(1, 8000, 5000);
game.tick(50);
game.set(2, 100, 5000);
game.tick(200);                          // player two is out
// Put it back in player one's hands so the only thing wrong with this
// throw is who it is aimed at.
game.set(1, 8000, 5000);
checks.youCannotThrowItToSomebodyWhoIsOut = game.canThrow(1, 2) === false
  && game.canThrow(1, 3) === true;

console.log(JSON.stringify(checks));
