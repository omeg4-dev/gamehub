// One stream of events, whatever produced them. The phone is the point of
// the project, but the mouse and keyboard feed the identical events -- so
// every screen here can be built and checked without a phone in hand, and
// so the desk is still usable when the phone is charging.
const Input = (() => {
  const listeners = {pointer: [], button: [], gesture: [], flick: [],
                     phone: [], players: [], hello: []};
  const on = (kind, fn) => listeners[kind].push(fn);
  const emit = message => (listeners[message.type] || []).forEach(fn => fn(message));

  const base = location.pathname.replace(/\/hub$/, "");
  let socket = null;

  const reconnect = () => {
    socket = new WebSocket(`wss://${location.host}${base}/ws/hub`);
    socket.addEventListener("message", e => emit(JSON.parse(e.data)));
    socket.addEventListener("close", () => setTimeout(reconnect, 1000));
  };
  reconnect();

  const tell = message => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  // The desk counts as player one, so a mouse can drive everything a phone
  // can -- including the multiplayer games, one seat of them.
  addEventListener("mousemove", e => emit({
    type: "pointer", player: 1,
    x: e.clientX / innerWidth, y: e.clientY / innerHeight,
  }));
  addEventListener("mousedown",
    () => emit({type: "button", player: 1, name: "a", down: true}));
  addEventListener("mouseup",
    () => emit({type: "button", player: 1, name: "a", down: false}));

  const KEYS = {
    " ": "a", Enter: "a", Backspace: "b", Escape: "home",
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  };
  const key = (event, down) => {
    const name = KEYS[event.key];
    if (!name) return;
    event.preventDefault();
    emit({type: "button", player: 1, name, down});
  };
  addEventListener("keydown", e => !e.repeat && key(e, true));
  addEventListener("keyup", e => key(e, false));

  return {on, tell};
})();
