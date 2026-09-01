// The hand. Drawn by the hub rather than by the compositor, because the
// system pointer is not ours to move and because a Wii cursor leans into
// the direction it is travelling, which no system cursor does.
const Cursor = (() => {
  const canvas = document.getElementById("cursor");
  const ctx = canvas.getContext("2d");
  let x = 0.5, y = 0.5, lean = 0, alive = true, last = 0.5;

  const resize = () => {
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  addEventListener("resize", resize);
  resize();

  const draw = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const px = x * innerWidth, py = y * innerHeight;
    ctx.save();
    ctx.globalAlpha = alive ? 1 : 0.25;
    ctx.translate(px, py);
    ctx.rotate(lean);
    ctx.shadowColor = "rgba(20,60,90,.45)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#2c86bd";
    ctx.lineWidth = 3;
    ctx.beginPath();                       // a pointing hand, roughly
    ctx.moveTo(0, -26);
    ctx.quadraticCurveTo(8, -26, 8, -10);
    ctx.lineTo(8, 2);
    ctx.quadraticCurveTo(20, 0, 20, 10);
    ctx.quadraticCurveTo(20, 30, 2, 30);
    ctx.quadraticCurveTo(-12, 30, -12, 12);
    ctx.lineTo(-12, -2);
    ctx.quadraticCurveTo(-8, -6, -8, -10);
    ctx.lineTo(-8, -18);
    ctx.quadraticCurveTo(-8, -26, 0, -26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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
