"""Bring the whole thing up, and take it down again.

The browser gets a profile of its own so a crashed session here can never
touch the real one, and a window class of its own so exactly one Hyprland
rule finds it.
"""
import asyncio
import logging
import ssl
import subprocess

from aiohttp import web

from . import config, net, server, tls
from .controller import Controller
from .store import Store

log = logging.getLogger("gamehub")

APP_ID = "dev.omega.gamehub"
BROWSER = "brave-origin"


def browser_argv(url, profile):
    return [BROWSER, f"--app={url}", f"--class={APP_ID}",
            f"--user-data-dir={profile}",
            # Our certificate, our loopback address, written seconds ago.
            "--ignore-certificate-errors",
            "--no-first-run", "--no-default-browser-check"]


def desktop_entry():
    return ("[Desktop Entry]\n"
            "Type=Application\n"
            "Name=Game Hub\n"
            "Comment=Point your phone at the screen\n"
            "Exec=python -m gamehub\n"
            "Path=%s\n"
            "Icon=applications-games\n"
            "Categories=Game;\n" % config.ROOT)


async def serve():
    address = net.lan_address()
    token = net.new_token()
    cert, key = tls.ensure_cert(address)
    phone = net.phone_url(address, config.PORT, token)

    app = server.build_app(token, controller=Controller(), store=Store(),
                           phone_url=phone)
    runner = web.AppRunner(app)
    await runner.setup()

    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert, key)
    # Two sockets, both named: the LAN one for the phone, loopback for the
    # browser. Never a wildcard.
    for host in (address, "127.0.0.1"):
        await web.TCPSite(runner, host, config.PORT, ssl_context=context).start()

    log.info("phone: %s", phone)
    profile = config.STATE_DIR / "browser"
    profile.mkdir(parents=True, exist_ok=True)
    browser = subprocess.Popen(
        browser_argv(net.hub_url(config.PORT, token), profile))
    try:
        await asyncio.get_running_loop().run_in_executor(None, browser.wait)
    finally:
        browser.terminate()
        await runner.cleanup()


def run():
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(serve())
