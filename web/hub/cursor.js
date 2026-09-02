// The hand. Drawn by the hub rather than by the compositor, because the
// system pointer is not ours to move and because a Wii cursor leans into
// the direction it is travelling, which no system cursor does.
//
// One closed path, not a fist plus a finger plus a thumb: three filled
// shapes with the same outline show their seams where they overlap.
const Cursor = (() => {
  const canvas = document.getElementById("cursor");
  const ctx = canvas.getContext("2d");
  // A hand held out at a screen is never vertical, so neither is this one:
  // REST is the tilt it returns to, and lean is added on top while moving.
  const REST = -0.13;
  let x = 0.5, y = 0.5, lean = 0, alive = true, last = 0.5;

  const resize = () => {
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  addEventListener("resize", resize);
  resize();

  const hand = () => {
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

  const draw = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const px = x * innerWidth, py = y * innerHeight;
    const size = Math.min(innerWidth, innerHeight) / 620;
    ctx.save();
    ctx.globalAlpha = alive ? 1 : 0.3;
    ctx.translate(px, py);
    ctx.rotate(REST + lean);
    ctx.scale(size, size);

    ctx.shadowColor = "rgba(20,55,80,.5)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#ffffff";
    hand();
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#2f4d61";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    hand();
    ctx.stroke();

    // A soft blue sheen down the left of the glove, the way the Wii's hand
    // is lit from the screen it is pointing at.
    const sheen = ctx.createLinearGradient(-18, -39, 16, 26);
    sheen.addColorStop(0, "rgba(120,195,235,.55)");
    sheen.addColorStop(.55, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    hand();
    ctx.fill();

    // The player number, which is how you know whose hand it is.
    ctx.beginPath();
    ctx.arc(21, 30, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#2f4d61";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 12px 'Hub Round', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1", 21, 31);

    ctx.restore();
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  Input.on("pointer", p => {
    lean = Math.max(-0.35, Math.min(0.35, (p.x - last) * 8));
    last = p.x;
    x = p.x; y = p.y;
  });
  Input.on("phone", p => { alive = p.connected; });

  return {at: () => [x * innerWidth, y * innerHeight]};
})();
