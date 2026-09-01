import json

import pytest
from aiohttp.test_utils import TestClient, TestServer

from gamehub import server
from gamehub.controller import Controller
from gamehub.store import Store

TOKEN = "ab" * 16
IDENT = [1.0, 0.0, 0.0, 0.0]


# `loop` is aiohttp's own fixture: its pytest plugin refuses an async fixture
# that does not depend on it. There is no pytest-asyncio on this machine.
@pytest.fixture
async def client(tmp_path, loop):
    web = tmp_path / "web"
    (web / "hub").mkdir(parents=True)
    (web / "phone").mkdir(parents=True)
    (web / "hub" / "index.html").write_text("<h1>hub</h1>")
    (web / "phone" / "index.html").write_text("<h1>phone</h1>")
    games = tmp_path / "games"
    games.mkdir()
    demo = games / "demo"
    demo.mkdir()
    (demo / "game.json").write_text(json.dumps(
        {"name": "Demo", "entry": "index.html"}))
    (demo / "index.html").write_text("<h1>demo</h1>")
    app = server.build_app(TOKEN, controller=Controller(),
                           store=Store(tmp_path / "data"),
                           games_dir=games, web_dir=web)
    async with TestClient(TestServer(app)) as c:
        yield c


async def test_the_hub_page_is_served_behind_the_token(client):
    response = await client.get(f"/{TOKEN}/hub")
    assert response.status == 200
    assert "hub" in await response.text()


async def test_a_wrong_token_is_forbidden(client):
    """The address is on the LAN; the token is the whole of the door."""
    assert (await client.get(f"/{'cd' * 16}/hub")).status == 403
    assert (await client.get("/hub")).status == 403


async def test_the_game_list_is_json(client):
    body = await (await client.get(f"/{TOKEN}/api/games")).json()
    assert [g["name"] for g in body["games"]] == ["Demo"]
    assert body["problems"] == []


async def test_a_score_can_be_submitted_and_read_back(client):
    await client.post(f"/{TOKEN}/api/scores/demo", json={"score": 7})
    body = await (await client.get(f"/{TOKEN}/api/scores/demo")).json()
    assert body["scores"][0]["score"] == 7


async def test_a_frame_from_the_phone_reaches_the_hub_socket(client):
    """The one path that matters: sensors in one socket, a cursor out of
    the other."""
    async with client.ws_connect(f"/{TOKEN}/ws/hub") as hub:
        async with client.ws_connect(f"/{TOKEN}/ws/phone") as phone:
            await hub.receive_json(timeout=2)        # the phone arriving
            await phone.send_json({"type": "frame", "t": 0.0,
                                   "q": IDENT, "a": [0, 0, 0]})
            message = await hub.receive_json(timeout=2)
    assert message["type"] == "pointer"
    assert message["x"] == pytest.approx(0.5)


async def test_a_button_from_the_phone_reaches_the_hub_socket(client):
    async with client.ws_connect(f"/{TOKEN}/ws/hub") as hub:
        async with client.ws_connect(f"/{TOKEN}/ws/phone") as phone:
            await hub.receive_json(timeout=2)        # the phone arriving
            await phone.send_json({"type": "button", "name": "a", "down": True})
            message = await hub.receive_json(timeout=2)
    assert message == {"type": "button", "name": "a", "down": True}


async def test_the_hub_is_told_when_the_phone_arrives_and_leaves(client):
    async with client.ws_connect(f"/{TOKEN}/ws/hub") as hub:
        async with client.ws_connect(f"/{TOKEN}/ws/phone"):
            assert (await hub.receive_json(timeout=2)) == \
                {"type": "phone", "connected": True}
        assert (await hub.receive_json(timeout=2)) == \
            {"type": "phone", "connected": False}


async def test_the_hub_tells_the_phone_which_controls_a_game_uses(client):
    """The controller dims what the game ignores rather than showing a
    button that does nothing."""
    async with client.ws_connect(f"/{TOKEN}/ws/phone") as phone:
        await phone.receive_json(timeout=2)          # the hello
        async with client.ws_connect(f"/{TOKEN}/ws/hub") as hub:
            await hub.send_json({"type": "running", "name": "Demo",
                                 "controls": ["pointer"]})
            message = await phone.receive_json(timeout=2)
    assert message == {"type": "running", "name": "Demo",
                       "controls": ["pointer"]}


async def test_a_websocket_without_the_token_is_refused(client):
    with pytest.raises(Exception):
        async with client.ws_connect(f"/{'cd' * 16}/ws/phone"):
            pass


async def test_a_game_cannot_serve_a_file_above_its_own_folder(client):
    """A game folder is a drop-in from anywhere; the path is not trusted."""
    response = await client.get(f"/{TOKEN}/games/demo/../../pytest.ini")
    assert response.status in (403, 404)
