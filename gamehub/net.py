"""Where the phone reaches us, and the picture of that address.

The address is read out of the routing table rather than guessed, because
the alternative to knowing which of our addresses faces the phone is
binding to all of them.
"""
import io
import json
import secrets
import subprocess

import qrcode

from . import config


def lan_address(runner=subprocess.run, target=config.TV_IP):
    done = runner(["ip", "-j", "route", "get", target],
                  capture_output=True, text=True, check=True)
    address = json.loads(done.stdout)[0]["prefsrc"]
    if address in ("0.0.0.0", "::"):
        raise ValueError(f"refusing to serve on {address}")
    return address


def new_token():
    return secrets.token_hex(16)


def phone_url(host, port, token):
    return f"https://{host}:{port}/{token}/phone"


def hub_url(port, token):
    """The hub is opened by a browser on this machine, so it uses loopback
    and never leaves it."""
    return f"https://127.0.0.1:{port}/{token}/hub"


def qr_png(url, size=8):
    image = qrcode.make(url, box_size=size, border=2)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
