// The channel grid, and the one screen everything returns to.
//
// Hover is decided by asking the document what is under the cursor rather
// than by keeping a rectangle for every card: the cards animate, and a
// cached rectangle would be wrong for exactly the tenth of a second the
// cursor is over a card that is still growing.
const base = location.pathname.replace(/\/hub$/, "");
const grid = document.getElementById("grid");
const stage = document.getElementById("stage");
const connect = document.getElementById("connect");
const problems = document.getElementById("problems");

let games = [];
let current = null;
let hot = null;

const load = async () => {
  const body = await (await fetch(`${base}/api/games`)).json();
  const stars = new Set(body.favourites);
  const recent = body.recent;
  const rank = g => (stars.has(g.slug) ? 0 : 1) * 1000 +
                    (recent.indexOf(g.slug) < 0 ? 500 : recent.indexOf(g.slug));
  games = body.games.sort((a, b) => rank(a) - rank(b));
  grid.innerHTML = "";
  for (const game of games) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.slug = game.slug;
    card.innerHTML =
      `<img src="${base}/games/${game.slug}/${game.thumbnail}" alt="" ` +
      `onerror="this.remove()">` +
      `<span class="name">${game.name}</span>` +
      (stars.has(game.slug) ? '<span class="star">&#9733;</span>' : "");
    grid.append(card);
  }
  if (body.problems.length) {
    problems.hidden = false;
    problems.innerHTML = "<b>Games that would not load</b>" +
      body.problems.map(p => `<div>${p.slug}: ${p.reason}</div>`).join("");
  }
};

// --- pointing at cards -------------------------------------------------
Input.on("pointer", () => {
  if (current) return;
  const [px, py] = Cursor.at();
  const card = document.elementFromPoint(px, py)?.closest(".card");
  if (card === hot) return;
  hot?.classList.remove("hot");
  hot = card;
  if (hot) {
    hot.classList.add("hot");
    chime();
  }
});

// --- opening and leaving -----------------------------------------------
const open = game => {
  current = game;
  const card = grid.querySelector(`[data-slug="${game.slug}"]`);
  card?.classList.add("opening");
  Input.tell({type: "running", name: game.name, controls: game.controls});
  setTimeout(() => {
    stage.src = `${base}/games/${game.slug}/${game.entry}`;
    stage.hidden = false;
    grid.hidden = true;
  }, 450);
};

const home = () => {
  if (!current) return;
  stage.hidden = true;
  stage.src = "about:blank";
  grid.hidden = false;
  grid.querySelector(".opening")?.classList.remove("opening");
  current = null;
  hot = null;
  Input.tell({type: "running", name: "", controls: ["pointer", "a", "b", "dpad"]});
  load();
};

Input.on("button", event => {
  if (!event.down) {
    if (current) stage.contentWindow?.postMessage({gamehub: "button", ...event}, "*");
    return;
  }
  if (event.name === "home") return home();
  if (current) {
    stage.contentWindow?.postMessage({gamehub: "button", ...event}, "*");
  } else if (event.name === "a" && hot) {
    open(games.find(g => g.slug === hot.dataset.slug));
  }
});

Input.on("gesture", event =>
  stage.contentWindow?.postMessage({gamehub: "gesture", ...event}, "*"));
Input.on("pointer", event =>
  current && stage.contentWindow?.postMessage({gamehub: "pointer", ...event}, "*"));

// --- the game talking back ---------------------------------------------
addEventListener("message", async event => {
  const message = event.data;
  if (!message || !message.gamehub || !current) return;
  if (message.gamehub === "exit") home();
  if (message.gamehub === "submitScore") {
    await fetch(`${base}/api/scores/${current.slug}`,
                {method: "POST", headers: {"Content-Type": "application/json"},
                 body: JSON.stringify({score: message.score})});
  }
  if (message.gamehub === "highScores") {
    const body = await (await fetch(`${base}/api/scores/${current.slug}`)).json();
    stage.contentWindow.postMessage(
      {gamehub: "highScores", id: message.id, scores: body.scores}, "*");
  }
});

// --- the phone ---------------------------------------------------------
Input.on("phone", event => {
  connect.classList.toggle("badge", event.connected);
  if (!event.connected && current) {
    stage.contentWindow?.postMessage({gamehub: "pause"}, "*");
  }
});

fetch(`${base}/api/qr`).then(r => r.json()).then(body => {
  document.getElementById("qr").src = body.png;
  document.getElementById("address").textContent = body.url;
}).catch(() => {});

// --- furniture ---------------------------------------------------------
const chime = () => {
  const ctx = chime.ctx ||= new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
};

setInterval(() => {
  const now = new Date();
  document.getElementById("clock").textContent =
    now.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
  document.getElementById("date").textContent =
    now.toLocaleDateString([], {weekday: "short", day: "numeric", month: "short"});
}, 1000);

load();
