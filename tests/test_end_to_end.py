import pytest

from gamehub import config
from tests.fake_phone import replay
from tests.test_server import client, TOKEN          # noqa: F401

TRACE = config.ROOT / "traces" / "sweep.json"


@pytest.mark.skipif(not TRACE.exists(), reason="traces not captured yet")
async def test_a_captured_sweep_moves_the_cursor_across_the_hub(client):
    """The whole path, with nothing plugged in: a real recording of a real
    hand comes out of the hub socket as a cursor crossing the screen."""
    seen = []
    async with client.ws_connect(f"/{TOKEN}/ws/hub") as hub:
        await replay(client, TOKEN, TRACE, limit=400)
        while True:
            try:
                message = await hub.receive_json(timeout=0.5)
            except Exception:
                break
            if message["type"] == "pointer":
                seen.append(message["x"])
    assert len(seen) > 100
    assert max(seen) - min(seen) > 0.5
