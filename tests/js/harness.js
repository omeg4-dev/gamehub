// Loads a game's game.js in node with just enough browser around it to
// reach the parts worth testing. The epilogue is appended here rather than
// living in the game: production code should not carry test hooks.
const fs = require("fs");
const vm = require("vm");

const noop = new Proxy(() => noop, {get: () => noop});

function load(path, epilogue) {
  const canvas = {width: 0, height: 0, getContext: () => noop,
                  addEventListener: () => {}};
  const sandbox = {
    innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1,
    // Games read the query string for a preview seat count; in node there
    // is no address bar and the answer is always "no preview".
    location: {search: ""}, URLSearchParams,
    document: {getElementById: () => canvas},
    addEventListener: () => {},
    requestAnimationFrame: () => 0,
    setTimeout: () => 0,
    performance: {now: () => 0},
    Math, JSON, console,
    GameHub: {on: () => {}, onPause: () => {}, onResume: () => {},
              ready: () => {}, submitScore: () => {}, exit: () => {},
              rumble: () => {}, players: () => [{n: 1, name: "P1",
                                                 colour: "#3ec7ff"}],
              highScores: () => Promise.resolve([])},
    out: null,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path, "utf8") + "\n" + epilogue, sandbox);
  return sandbox.out;
}

module.exports = {load};
