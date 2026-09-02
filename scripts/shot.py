"""Photograph the hub in a real browser.

The look is the feature here, and no assertion about a stylesheet can tell
you whether a menu looks like the Wii's. This starts the real server on
loopback, opens a headless Chromium at it and writes a PNG.

    python scripts/shot.py out.png
    python scripts/shot.py snake.png --page games/snake/index.html

A phone socket is opened first and held: without one the hub covers itself
with the fullscreen "point your phone at the screen" panel, and the picture
would be of the QR code.
"""
import argparse
import asyncio
import pathlib
import ssl
import sys

import aiohttp
from aiohttp import web

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from gamehub import config, server, tls                       # noqa: E402
from gamehub.controller import Controller                     # noqa: E402
from gamehub.store import Store                               # noqa: E402

TOKEN = "ab" * 16
PORT = 8791
SHOT = config.STATE_DIR / "shot"


async def main(out, page, games_dir, web_dir):
    cert, key = tls.ensure_cert("127.0.0.1", SHOT)
    app = server.build_app(TOKEN, controller=Controller(),
                           store=Store(SHOT / "data"),
                           games_dir=games_dir, web_dir=web_dir,
                           phone_url=f"https://127.0.0.1:{PORT}/{TOKEN}/phone")
    runner = web.AppRunner(app)
    await runner.setup()
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert, key)
    await web.TCPSite(runner, "127.0.0.1", PORT, ssl_context=context).start()

    # A fresh profile every time: a lock left behind by a killed run makes
    # Chromium abort with nothing on stdout, which reads like a hang.
    profile = SHOT / "profile"
    if profile.exists():
        for path in sorted(profile.rglob("*"), reverse=True):
            path.rmdir() if path.is_dir() else path.unlink()

    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(
                f"https://127.0.0.1:{PORT}/{TOKEN}/ws/phone", ssl=False):
            browser = await asyncio.create_subprocess_exec(
                "chromium", "--headless", "--disable-gpu", "--no-sandbox",
                "--ignore-certificate-errors", "--hide-scrollbars",
                "--no-first-run", "--no-default-browser-check",
                f"--user-data-dir={profile}",
                "--window-size=1600,900", f"--screenshot={out}",
                # Console messages come back on stderr, and a page that
                # threw while parsing draws a blank picture that looks like
                # a design decision. Better to fail loudly.
                "--enable-logging=stderr", "--v=0",
                f"https://127.0.0.1:{PORT}/{TOKEN}/{page}",
                stderr=asyncio.subprocess.PIPE)
            try:
                _, noise = await asyncio.wait_for(browser.communicate(), 60)
            except asyncio.TimeoutError:
                browser.kill()
                sys.exit("the browser never finished")
    await runner.cleanup()

    bad = [line for line in noise.decode(errors="replace").splitlines()
           if "Uncaught" in line or ":ERROR:CONSOLE" in line]
    for line in bad:
        print(line, file=sys.stderr)
    if bad:
        sys.exit(f"{page} logged {len(bad)} console error(s)")
    print(out)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out", nargs="?", default="hub.png")
    parser.add_argument("--page", default="hub",
                        help="what to open, relative to the token: the hub, "
                             "or games/<slug>/index.html")
    parser.add_argument("--games", type=pathlib.Path)
    parser.add_argument("--web", type=pathlib.Path)
    args = parser.parse_args()
    asyncio.run(main(args.out, args.page, args.games, args.web))
