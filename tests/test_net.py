import json
import subprocess

import pytest

from gamehub import net


class FakeRun:
    def __init__(self, payload):
        self.payload = payload
        self.argv = None

    def __call__(self, argv, **kw):
        self.argv = argv
        return subprocess.CompletedProcess(argv, 0, json.dumps(self.payload), "")


def test_address_comes_from_the_routing_table():
    run = FakeRun([{"dst": "192.0.2.30", "prefsrc": "192.0.2.36"}])
    assert net.lan_address(run) == "192.0.2.36"
    assert run.argv[:3] == ["ip", "-j", "route"]


def test_address_is_never_a_wildcard():
    """Binding to 0.0.0.0 would put the controller on every interface this
    machine has, which is the one thing the token cannot protect against."""
    run = FakeRun([{"prefsrc": "0.0.0.0"}])
    with pytest.raises(ValueError):
        net.lan_address(run)


def test_token_is_thirty_two_hex_characters():
    token = net.new_token()
    assert len(token) == 32
    int(token, 16)
    assert token != net.new_token()


def test_phone_url_carries_the_token_as_the_first_segment():
    assert net.phone_url("10.0.0.5", 8730, "ab" * 16) == \
        f"https://10.0.0.5:8730/{'ab' * 16}/phone"


def test_hub_url_stays_on_loopback():
    assert net.hub_url(8730, "ab" * 16) == f"https://127.0.0.1:8730/{'ab' * 16}/hub"


def test_qr_is_a_png():
    assert net.qr_png("https://example.invalid/x").startswith(b"\x89PNG")
