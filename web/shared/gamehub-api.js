// Everything a game is allowed to know about the hub. Drop this in with a
// script tag and the pointer arrives already smoothed, in 0..1 coordinates
// -- the game never learns the screen resolution, and never learns that a
// phone exists.
window.GameHub = (() => {
  const listeners = {pointer: [], button: [], gesture: [], pause: [], resume: []};
  const pending = new Map();
  let nextId = 0;

  addEventListener("message", event => {
    if (event.source !== parent) return;
    const message = event.data;
    if (!message || !message.gamehub) return;
    if (message.gamehub === "highScores" && pending.has(message.id)) {
      pending.get(message.id)(message.scores);
      pending.delete(message.id);
      return;
    }
    (listeners[message.gamehub] || []).forEach(fn => fn(message));
  });

  const tell = message => parent.postMessage({gamehub: message.gamehub, ...message}, "*");

  return {
    on: (kind, fn) => (listeners[kind] ||= []).push(fn),
    onPause: fn => listeners.pause.push(fn),
    onResume: fn => listeners.resume.push(fn),
    ready: () => tell({gamehub: "ready"}),
    submitScore: score => tell({gamehub: "submitScore", score}),
    highScores: () => new Promise(resolve => {
      const id = nextId++;
      pending.set(id, resolve);
      tell({gamehub: "highScores", id});
    }),
    exit: () => tell({gamehub: "exit"}),
  };
})();
