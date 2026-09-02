// The hands. Drawn by the hub rather than by the compositor, because the
// system pointer is not ours to move, because a Wii cursor leans into the
// direction it is travelling, and because there can be four of them.
//
// One closed path, not a fist plus a finger plus a thumb: three filled
// shapes with the same outline show their seams where they overlap.
const Cursor = (() => {
  const canvas = document.getElementById("cursor");
  const ctx = canvas.getContext("2d");
  // A hand held out at a screen is never vertical, so neither is this one:
  // REST is the tilt it returns to, and lean is added on top while moving.
  const REST = -0.13;
  const DEFAULT = ["#3ec7ff", "#ff6f5e", "#5fd36a", "#ffc746"];

  const hands = new Map();          // player number -> where its hand is
  let alive = false;
  let hidden = false;

  const handFor = n => {
    if (!hands.has(n)) {
      hands.set(n, {x: 0.5, y: 0.5, at: [0.5, 0.5], lean: 0, last: 0.5,
                    colour: DEFAULT[(n - 1) % DEFAULT.length], here: true,
                    squash: 0});
    }
    return hands.get(n);
  };

  const resize = () => {
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  addEventListener("resize", resize);
  resize();

  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-7, -14);
    ctx.lineTo(-7, -30);                       // the index finger, extended
    ctx.quadraticCurveTo(-7, -39, 0, -39);
    ctx.quadraticCurveTo(7, -39, 7, -30);
    ctx.lineTo(7, -11);
    ctx.quadraticCurveTo(16, -11, 16, -2);     // knuckles
    ctx.lineTo(16, 13);
    ctx.quadraticCurveTo(16, 26, 2, 26);
    ctx.lineTo(-5, 26);
    ctx.quadraticCurveTo(-18, 26, -18, 12);
    ctx.lineTo(-18, 1);
    ctx.quadraticCurveTo(-27, -3, -23, -11);   // the thumb, out to the side
    ctx.quadraticCurveTo(-18, -18, -12, -11);
    ctx.quadraticCurveTo(-7, -8, -7, -14);
    ctx.closePath();
  };

  const one = (hand, number) => {
    // The hand closes a little as the button goes down and springs back
    // when it comes up.
    const size = Math.min(innerWidth, innerHeight) / 620 * (1 - hand.squash * .14);
    ctx.save();
    ctx.globalAlpha = hand.here && alive ? 1 : 0.28;
    ctx.translate(hand.at[0] * innerWidth, hand.at[1] * innerHeight);
    ctx.rotate(REST + hand.lean);
    ctx.scale(size, size);

    // The glove throws its own colour onto the plate underneath it, which
    // is how four hands stay four hands in a photograph of a television.
    ctx.shadowColor = hand.colour;
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = "#ffffff";
    shape();
    ctx.fill();

    ctx.shadowColor = "rgba(20,55,80,.45)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    shape();
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#2f4d61";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    shape();
    ctx.stroke();

    // A sheen down the left of the glove, in this player's colour, the way
    // the Wii's hand is lit by the screen it is pointing at.
    const sheen = ctx.createLinearGradient(-18, -39, 16, 26);
    sheen.addColorStop(0, hand.colour);
    sheen.addColorStop(.5, "rgba(255,255,255,0)");
    ctx.globalAlpha *= .5;
    ctx.fillStyle = sheen;
    shape();
    ctx.fill();
    ctx.globalAlpha /= .5;

    ctx.beginPath();
    ctx.arc(21, 30, 9.5, 0, Math.PI * 2);
    ctx.fillStyle = hand.colour;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#20404f";
    ctx.font = "800 12px 'Hub Round', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(number), 21, 31);

    ctx.restore();
  };

  const draw = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (!hidden) {
      // Drawn back to front so player one's hand is the one on top.
      for (const n of [...hands.keys()].sort((a, b) => b - a)) {
        const hand = hands.get(n);
        // A last sixth of the distance every frame. The server already
        // smooths the aim; this only takes the stairs out of a 60 Hz
        // stream arriving on a 144 Hz screen.
        hand.at[0] += (hand.x - hand.at[0]) * .35;
        hand.at[1] += (hand.y - hand.at[1]) * .35;
        hand.lean += (Math.max(-0.35, Math.min(0.35, (hand.x - hand.last) * 8))
                      - hand.lean) * .2;
        hand.last = hand.x;
        hand.squash += ((hand.down ? 1 : 0) - hand.squash) * .3;
        one(hand, n);
      }
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  Input.on("pointer", p => {
    const hand = handFor(p.player || 1);
    hand.x = p.x;
    hand.y = p.y;
  });

  Input.on("players", message => {
    const here = new Set();
    for (const player of message.players) {
      here.add(player.n);
      const hand = handFor(player.n);
      hand.colour = player.colour;
      hand.here = true;
    }
    for (const [n, hand] of hands) hand.here = here.has(n);
    // A hand nobody is holding any more should not be left on the screen.
    for (const n of [...hands.keys()]) if (!here.has(n) && n !== 1) hands.delete(n);
  });

  Input.on("button", event => {
    if (event.name !== "a") return;
    handFor(event.player || 1).down = event.down;
  });

  Input.on("phone", p => { alive = p.connected; });

  return {
    at: (n = 1) => {
      const hand = handFor(n);
      return [hand.at[0] * innerWidth, hand.at[1] * innerHeight];
    },
    hide: on => { hidden = on; },
  };
})();
