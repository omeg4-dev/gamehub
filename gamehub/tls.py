"""A self-signed certificate, because the phone's gyroscope depends on it.

Chromium fires deviceorientation only in a secure context. On a LAN address
that means HTTPS, and on a LAN address there is nobody to issue a real
certificate, so we issue our own. It names the address as a SAN, which is
what browsers actually check; a certificate for the wrong address is
refused outright rather than warned about.
"""
import os
import re
import subprocess

from . import config


def cert_addresses(cert_path):
    text = subprocess.run(["openssl", "x509", "-in", str(cert_path),
                           "-noout", "-text"],
                          capture_output=True, text=True, check=True).stdout
    return set(re.findall(r"IP Address:([0-9a-fA-F.:]+)", text))


def ensure_cert(address, directory=config.STATE_DIR):
    directory.mkdir(parents=True, exist_ok=True)
    directory.chmod(0o700)
    cert = directory / "cert.pem"
    key = directory / "key.pem"
    if cert.exists() and key.exists() and address in cert_addresses(cert):
        return cert, key
    # The umask, not the chmod after it, is what matters: openssl creates the
    # key itself, and between its creation and a later chmod it would be
    # readable by anyone on this machine.
    old = os.umask(0o077)
    try:
        subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", str(key), "-out", str(cert),
            "-days", "3650", "-subj", f"/CN={address}",
            "-addext", f"subjectAltName=IP:{address},IP:127.0.0.1",
        ], capture_output=True, check=True)
    finally:
        os.umask(old)
    key.chmod(0o600)
    cert.chmod(0o644)
    return cert, key
