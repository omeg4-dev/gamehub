// The remote. It reads the phone's orientation, throttles it to the rate
// the server expects, and sends button presses. Everything that decides
// where the cursor goes -- and what counts as a flick -- lives on the
// server, so this file stays a skin over a socket.
const base = location.pathname.replace(/\/phone$/, "");
const socket = new WebSocket(`wss://${location.host}${base}/ws/phone`);

const $ = id => document.getElementById(id);
const dot = $("dot"), running = $("running"), badge = $("badge");
const sensitivity = $("sensitivity"), flick = $("flick"), nameField = $("name");
const meterbar = $("meterbar"), meterline = $("meterline"), calsay = $("calsay");

const MAX_RATE = 8;                 // rad/s the meter is drawn to

const send = message => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};

socket.addEventListener("open", () => {
  dot.classList.add("live");
  const saved = localStorage.getItem("gamehub.name");
  if (saved) { nameField.value = saved; send({type: "name", name: saved}); }
});
socket.addEventListener("close", () => dot.classList.remove("live"));

socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.type === "hello") {
    sensitivity.value = message.sensitivity;
    flick.value = message.flick;
    drawThreshold();
    badge.textContent = `P${message.n}`;
    document.documentElement.style.setProperty("--me", message.colour);
    nameField.placeholder = message.name;
  } else if (message.type === "full") {
    $("full").hidden = false;
    document.querySelector("main").hidden = true;
  } else if (message.type === "running") {
    running.textContent = message.name || "Game Hub";
    setControls(message.controls);
  } else if (message.type === "rumble") {
    // The hit landed on screen; the hand should know without looking.
    if (navigator.vibrate) navigator.vibrate(message.ms || 25);
  } else if (message.type === "peak") {
    showPeak(message.rate);
  }
});

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
  if (!seen) $("no-sensors").hidden = false;
}, 3000);

const started = performance.now();
setInterval(() => {
  if (!seen) return;
  const t = (performance.now() - started) / 1000;
  send({type: "frame", t, q: quaternion, a: accel});
  if (recording) recording.push({t, q: quaternion, a: accel});
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

$("btn-recentre").addEventListener("click", () => {
  if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
  send({type: "recentre"});
});

sensitivity.addEventListener("change",
  () => send({type: "sensitivity", value: Number(sensitivity.value)}));

nameField.addEventListener("change", () => {
  const chosen = nameField.value.trim().slice(0, 12);
  localStorage.setItem("gamehub.name", chosen);
  send({type: "name", name: chosen});
});

const settings = $("settings");
$("btn-gear").addEventListener("click", () => {
  settings.showModal();
  send({type: "calibrate", on: true});          // the meter is live in here
});
$("btn-close").addEventListener("click", () => {
  settings.close();
  send({type: "calibrate", on: false});
});

const setControls = list => {
  const wanted = new Set(list || ["pointer", "a", "b", "dpad"]);
  $("dpad").classList.toggle("dim", !wanted.has("dpad"));
  $("btn-b").classList.toggle("dim", !wanted.has("b"));
};

// --- calibration -------------------------------------------------------
//
// Asking someone to pick a number in radians per second is asking them to
// guess. Asking them to flick five times and watching what their wrist
// actually does is a question they can answer.
let collecting = null;

const drawThreshold = () => {
  meterline.style.left = `${Math.min(100, flick.value / MAX_RATE * 100)}%`;
};

const showPeak = rate => {
  meterbar.style.width = `${Math.min(100, rate / MAX_RATE * 100)}%`;
  if (collecting && rate > 0.6) collecting.push(rate);
};

flick.addEventListener("input", drawThreshold);
flick.addEventListener("change", () => send({type: "flick", value: Number(flick.value)}));

$("btn-cal").addEventListener("click", () => {
  collecting = [];
  calsay.textContent = "Snap it left and right, five times.";
  setTimeout(() => {
    const peaks = collecting.sort((a, b) => b - a).slice(0, 5);
    collecting = null;
    if (peaks.length < 3) {
      calsay.textContent = "Did not see enough movement. Try again.";
      return;
    }
    // Two thirds of the softest of your five real flicks: high enough that
    // aiming does not trip it, low enough that a tired wrist still turns.
    const chosen = Math.max(1.2, peaks[peaks.length - 1] * 0.66);
    flick.value = chosen.toFixed(1);
    drawThreshold();
    send({type: "flick", value: Number(flick.value)});
    calsay.textContent = `Set to ${flick.value}. Your softest flick was ` +
                         `${peaks[peaks.length - 1].toFixed(1)}.`;
    if (navigator.vibrate) navigator.vibrate([15, 60, 15]);
  }, 6000);
});

// A controller whose screen goes to sleep is a controller that stops.
if (navigator.wakeLock) {
  const hold = () => navigator.wakeLock.request("screen").catch(() => {});
  hold();
  document.addEventListener("visibilitychange",
    () => document.visibilityState === "visible" && hold());
}

// --- recording ---------------------------------------------------------
//
// The constants that decide how this feels are guesses until a real hand
// has moved a real phone. Recording lets that hand be replayed in pytest.
let recording = null;
const recordButton = $("btn-record");
recordButton.addEventListener("click", () => {
  if (recording) {
    send({type: "trace", frames: recording});
    recording = null;
    recordButton.textContent = "Record";
  } else {
    recording = [];
    recordButton.textContent = "Stop";
  }
});
