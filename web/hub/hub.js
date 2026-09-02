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
const flash = document.getElementById("flash");
const pagers = [...document.querySelectorAll(".pager")];

// Twelve plates to a page, filled up with empty ones. The empty slots are
// not padding: a menu that reflows every time a folder is dropped in stops
// being a place you know your way around.
const PER_PAGE = 12;

let games = [];
let current = null;
let hot = null;
let page = 0;

const load = async () => {
  const body = await (await fetch(`${base}/api/games`)).json();
  const stars = new Set(body.favourites);
  const recent = body.recent;
  const rank = g => (stars.has(g.slug) ? 0 : 1) * 1000 +
                    (recent.indexOf(g.slug) < 0 ? 500 : recent.indexOf(g.slug));
  games = body.games.sort((a, b) => rank(a) - rank(b));
  page = Math.min(page, Math.max(0, Math.ceil(games.length / PER_PAGE) - 1));
  render(stars);
  showProblems(body.problems);
};

const render = stars => {
  grid.replaceChildren();
  const start = page * PER_PAGE;
  for (let i = 0; i < PER_PAGE; i++) {
    const game = games[start + i];
    if (!game) {
      const empty = document.createElement("div");
      empty.className = "slot";
      grid.append(empty);
      continue;
    }
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.slug = game.slug;
    card.dataset.act = `open:${game.slug}`;
    // Built as nodes, not as a string: a game.json is a drop-in file from
    // wherever the folder came from, and its name is not markup.
    const art = document.createElement("img");
    art.src = `${base}/games/${game.slug}/${game.thumbnail}`;
    art.alt = "";
    art.addEventListener("error", () => art.remove());
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = game.name;
    card.append(art, name);
    if (stars.has(game.slug)) {
      const star = document.createElement("span");
      star.className = "star";
      star.textContent = "★";
      card.append(star);
    }
    grid.append(card);
  }
  const pages = Math.max(1, Math.ceil(games.length / PER_PAGE));
  pagers[0].disabled = page === 0;
  pagers[1].disabled = page >= pages - 1;
  hot = null;
};

const turn = by => {
  const pages = Math.max(1, Math.ceil(games.length / PER_PAGE));
  const next = Math.min(pages - 1, Math.max(0, page + by));
  if (next === page) return;
  page = next;
  load();
  chime(660);
};

const showProblems = trouble => {
  if (!trouble.length) return;
  problems.hidden = false;
  problems.replaceChildren();
  const heading = document.createElement("b");
  heading.textContent = "Games that would not load";
  problems.append(heading);
  for (const one of trouble) {
    const line = document.createElement("div");
    line.textContent = `${one.slug}: ${one.reason}`;
    problems.append(line);
  }
};

// --- pointing ----------------------------------------------------------
Input.on("pointer", () => {
  if (current) return;
  const [px, py] = Cursor.at();
  const target = document.elementFromPoint(px, py)?.closest("[data-act]");
  const pick = target && !target.disabled ? target : null;
  if (pick === hot) return;
  hot?.classList.remove("hot");
  hot = pick;
  if (hot) {
    hot.classList.add("hot");
    chime(880);
  }
});

// --- opening and leaving -----------------------------------------------
const open = game => {
  current = game;
  const card = grid.querySelector(`[data-slug="${game.slug}"]`);
  card?.classList.add("opening");
  flash.classList.add("on");
  Input.tell({type: "running", name: game.name, controls: game.controls});
  setTimeout(() => {
    stage.src = `${base}/games/${game.slug}/${game.entry}`;
    stage.hidden = false;
    grid.hidden = true;
    flash.classList.remove("on");
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

// Everything pointable says what it is in data-act, so the A button has one
// job here rather than one per widget.
const press = act => {
  if (!act) return;
  const [what, arg] = act.split(":");
  if (what === "open") open(games.find(g => g.slug === arg));
  if (what === "page") turn(Number(arg));
  if (what === "home") home();
  if (what === "qr") connect.classList.toggle("badge");
};

Input.on("button", event => {
  if (!event.down) {
    if (current) stage.contentWindow?.postMessage({gamehub: "button", ...event}, "*");
    return;
  }
  if (event.name === "home") return home();
  if (current) {
    stage.contentWindow?.postMessage({gamehub: "button", ...event}, "*");
    return;
  }
  if (event.name === "a") press(hot?.dataset.act);
  if (event.name === "left") turn(-1);
  if (event.name === "right") turn(1);
});

Input.on("gesture", event =>
  stage.contentWindow?.postMessage({gamehub: "gesture", ...event}, "*"));
Input.on("pointer", event =>
  current && stage.contentWindow?.postMessage({gamehub: "pointer", ...event}, "*"));

// --- the game talking back ---------------------------------------------
addEventListener("message", async event => {
  // Only the running game may speak here. It is in our own iframe on our
  // own origin; anything else claiming to be it is not.
  if (event.origin !== location.origin || event.source !== stage.contentWindow) {
    return;
  }
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
// The tick when the pointer crosses a plate. Short, soft, and the reason
// the menu feels like hardware rather than a web page.
const chime = (hz = 880) => {
  const ctx = chime.ctx ||= new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
};

const tick = () => {
  const now = new Date();
  document.getElementById("clock").textContent =
    now.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
  document.getElementById("date").textContent =
    now.toLocaleDateString([], {weekday: "short", day: "numeric", month: "short"});
};
setInterval(tick, 1000);
tick();

load();
