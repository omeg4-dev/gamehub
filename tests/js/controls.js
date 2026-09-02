// Which buttons a game's control list asks the phone to draw, and when
// that collapses to a single full-screen A.
const {touchControls, isSolo} = require(process.argv[2]);

const results = {};
const check = (name, value) => { results[name] = value; };

check("pointerAndAIsSolo", isSolo(["pointer", "a", "gesture"]));
check("aAloneIsSolo", isSolo(["a"]));
check("aAndBIsNot", isSolo(["pointer", "a", "b"]));
check("dpadIsNot", isSolo(["dpad", "a", "b"]));
check("bAloneIsNot", isSolo(["b"]));
check("nothingIsNot", isSolo([]));
check("theDefaultIsNot", isSolo(undefined));
check("gesturesCostNoScreen", touchControls(["pointer", "a", "gesture"]).join(","));
check("orderIsStable", touchControls(["b", "a", "dpad"]).join(","));

process.stdout.write(JSON.stringify(results));
