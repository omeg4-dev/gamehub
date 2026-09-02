// What the phone should put under a thumb.
//
// `pointer` and `gesture` are things you do with the whole handset -- they
// cost no screen. What is left is what has to be drawn: the d-pad, A, B.
// When that comes to A alone, there is nothing to aim at, so the button
// should be the screen: you cannot miss a target with no edges.
const TOUCHABLE = ["dpad", "a", "b"];

const touchControls = list => {
  const wanted = new Set(list || ["pointer", "a", "b", "dpad"]);
  return TOUCHABLE.filter(name => wanted.has(name));
};

const isSolo = list => {
  const touch = touchControls(list);
  return touch.length === 1 && touch[0] === "a";
};

if (typeof module !== "undefined") module.exports = {touchControls, isSolo};
