// The remote. It reads the phone's orientation, throttles it to the rate
// the server expects, and sends button presses. It holds no state worth
// having -- everything that decides where the cursor goes lives on the
// server, so this file can stay this short.
const base = location.pathname.replace(/\/phone$/, "");
const socket = new WebSocket(`wss://${location.host}${base}/ws/phone`);
const dot = document.getElementById("dot");
const running = document.getElementById("running");
const sensitivity = document.getElementById("sensitivity");

socket.addEventListener("open", () => dot.classList.add("live"));
socket.addEventListener("close", () => dot.classList.remove("live"));
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.type === "hello") {
    sensitivity.value = message.sensitivity;
  } else if (message.type === "running") {
    running.textContent = message.name || "Game Hub";
    setControls(message.controls);
  }
});

const send = message => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};

// --- orientation ------------------------------------------------------
let quaternion = [1, 0, 0, 0];
let accel = [0, 0, 0];
let seen = 0;

const toQuaternion = (alpha, beta, gamma) => {
  const z = (alpha || 0) * Math.PI / 360;
  const x = (beta || 0) * Math.PI / 360;
  const y = (gamma || 0) * Math.PI / 360;
  const [cx, sx] = [Math.cos(x), Math.sin(x)];
  const [cy, sy] = [Math.cos(y), Math.sin(y)];
  const [cz, sz] = [Math.cos(z), Math.sin(z)];
  return [cx * cy * cz - sx * sy * sz,
          sx * cy * cz - cx * sy * sz,
          cx * sy * cz + sx * cy * sz,
          cx * cy * sz + sx * sy * cz];
};

addEventListener("deviceorientation", event => {
  seen++;
  quaternion = toQuaternion(event.alpha, event.beta, event.gamma);
});
addEventListener("devicemotion", event => {
  const a = event.acceleration;
  if (a) accel = [a.x || 0, a.y || 0, a.z || 0];
});

// Chromium fires nothing at all on an insecure origin -- no error, no
// event. Saying so beats looking like a dead server.
setTimeout(() => {
  if (!seen) document.getElementById("no-sensors").hidden = false;
}, 3000);

const started = performance.now();
setInterval(() => {
  if (!seen) return;
  send({type: "frame", t: (performance.now() - started) / 1000,
        q: quaternion, a: accel});
}, 1000 / 60);

// --- buttons ----------------------------------------------------------
const press = (name, down) => {
  if (down && navigator.vibrate) navigator.vibrate(8);
  send({type: "button", name, down});
};

for (const button of document.querySelectorAll("[data-name]")) {
  const name = button.dataset.name;
  button.addEventListener("pointerdown", e => { e.preventDefault(); press(name, true); });
  button.addEventListener("pointerup", e => { e.preventDefault(); press(name, false); });
  button.addEventListener("pointercancel", () => press(name, false));
}

document.getElementById("btn-recentre").addEventListener("click", () => {
  if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
  send({type: "recentre"});
});

sensitivity.addEventListener("change",
  () => send({type: "sensitivity", value: Number(sensitivity.value)}));

const settings = document.getElementById("settings");
document.getElementById("btn-gear").addEventListener("click", () => settings.showModal());
document.getElementById("btn-close").addEventListener("click", () => settings.close());

const setControls = list => {
  const wanted = new Set(list || ["pointer", "a", "b", "dpad"]);
  document.getElementById("dpad").classList.toggle("dim", !wanted.has("dpad"));
  document.getElementById("btn-b").classList.toggle("dim", !wanted.has("b"));
};

// A controller whose screen goes to sleep is a controller that stops.
if (navigator.wakeLock) {
  const hold = () => navigator.wakeLock.request("screen").catch(() => {});
  hold();
  document.addEventListener("visibilitychange",
    () => document.visibilityState === "visible" && hold());
}
