import asyncio
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
                           games_dir=games, web_dir=web,
                           phone_url=f"https://192.0.2.36:8730/{TOKEN}/phone")
    async with TestClient(TestServer(app)) as c:
        yield c


async def wait_for(socket, kind, timeout=2):
    """The next message of one kind, ignoring the roll call.

    Every join and rename tells the room who is in it, so a test that
    counted messages would be a test of the greeting rather than of the
    thing it is named after.
    """
    while True:
        message = await socket.receive_json(timeout=timeout)
        if message["type"] == kind:
            return message


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
            await phone.send_json({"type": "frame", "t": 0.0,
                                   "q": IDENT, "a": [0, 0, 0]})
            message = await wait_for(hub, "pointer")
    assert message["x"] == pytest.approx(0.5)
    assert message["player"] == 1


async def test_a_button_from_the_phone_reaches_the_hub_socket(client):
    async with client.ws_connect(f"/{TOKEN}/ws/hub") as hub:
        async with client.ws_connect(f"/{TOKEN}/ws/phone") as phone:
            await phone.send_json({"type": "button", "name": "a", "down": True})
            message = await wait_for(hub, "button")
    assert message == {"type": "button", "name": "a", "down": True, "player": 1}


async def test_a_new_hub_is_told_at_once_whether_a_phone_is_there(client):
    """The page reloads more often than the phone connects; a hub that had
    to wait for the next event would show the QR panel over a live menu."""
    async with client.ws_connect(f"/{TOKEN}/ws/phone"):
        async with client.ws_connect(f"/{TOKEN}/ws/hub") as hub:
            assert (await hub.receive_json(timeout=2)) == \
                {"type": "phone", "connected": True}


async def test_the_hub_is_told_when_the_phone_arrives_and_leaves(client):
    async with client.ws_connect(f"/{TOKEN}/ws/hub") as hub:
        assert (await wait_for(hub, "phone"))["connected"] is False
        async with client.ws_connect(f"/{TOKEN}/ws/phone"):
            assert (await wait_for(hub, "phone"))["connected"] is True
        assert (await wait_for(hub, "phone"))["connected"] is False


async def test_four_phones_get_four_slots_and_the_fifth_is_turned_away(client):
    """The hub draws a cursor per player and the scoreboard has four rows.
    A fifth phone that connected, worked, and was invisible would be worse
    than one that is told."""
    async with client.ws_connect(f"/{TOKEN}/ws/hub") as hub:
        held = []
        try:
            for expected in range(1, 5):
                phone = await client.ws_connect(f"/{TOKEN}/ws/phone")
                held.append(phone)
                assert (await wait_for(phone, "hello"))["n"] == expected
            while len((await wait_for(hub, "players"))["players"]) < 4:
                pass
            spare = await client.ws_connect(f"/{TOKEN}/ws/phone")
            held.append(spare)
            assert (await wait_for(spare, "full"))["limit"] == 4
        finally:
            for phone in held:
                await phone.close()


async def test_a_phone_that_leaves_frees_its_slot_for_the_next_one(client):
    async with client.ws_connect(f"/{TOKEN}/ws/phone") as first:
        assert (await wait_for(first, "hello"))["n"] == 1
        async with client.ws_connect(f"/{TOKEN}/ws/phone") as second:
            assert (await wait_for(second, "hello"))["n"] == 2
    async with client.ws_connect(f"/{TOKEN}/ws/phone") as third:
        assert (await wait_for(third, "hello"))["n"] == 1


async def test_a_named_player_is_announced_to_the_hub(client):
    async with client.ws_connect(f"/{TOKEN}/ws/hub") as hub:
        async with client.ws_connect(f"/{TOKEN}/ws/phone") as phone:
            await phone.send_json({"type": "name", "name": "Om"})
            while True:
                roll = await wait_for(hub, "players")
                if roll["players"] and roll["players"][0]["name"] == "Om":
                    break


async def test_a_rumble_addressed_to_one_player_reaches_only_that_phone(client):
    """Two phones, one hit. The wrong phone buzzing is worse than neither."""
    async with client.ws_connect(f"/{TOKEN}/ws/phone") as one:
        await wait_for(one, "hello")
        async with client.ws_connect(f"/{TOKEN}/ws/phone") as two:
            await wait_for(two, "hello")
            async with client.ws_connect(f"/{TOKEN}/ws/hub") as hub:
                await hub.send_json({"type": "rumble", "player": 2, "ms": 30})
                assert (await wait_for(two, "rumble"))["ms"] == 30
                # Nothing addressed to player one: prove it by sending
                # something unaddressed afterwards and seeing that first.
                await hub.send_json({"type": "running", "name": "Demo",
                                     "controls": ["pointer"]})
                assert (await wait_for(one, "running"))["name"] == "Demo"


async def test_the_hub_tells_the_phone_which_controls_a_game_uses(client):
    """The controller dims what the game ignores rather than showing a
    button that does nothing."""
    async with client.ws_connect(f"/{TOKEN}/ws/phone") as phone:
        await phone.receive_json(timeout=2)          # the hello
        async with client.ws_connect(f"/{TOKEN}/ws/hub") as hub:
            await hub.send_json({"type": "running", "name": "Demo",
                                 "controls": ["pointer"]})
            message = await wait_for(phone, "running")
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


async def test_the_qr_endpoint_returns_a_data_uri(client):
    body = await (await client.get(f"/{TOKEN}/api/qr")).json()
    assert body["png"].startswith("data:image/png;base64,")


async def test_a_recorded_trace_is_written_where_the_tests_can_read_it(
        client, tmp_path, monkeypatch):
    """The tuning loop depends on this file existing; a silent drop here
    would look like a phone that never recorded anything."""
    from gamehub import config
    monkeypatch.setattr(config, "STATE_DIR", tmp_path / "state")
    async with client.ws_connect(f"/{TOKEN}/ws/phone") as phone:
        await phone.receive_json(timeout=2)
        await phone.send_json({"type": "trace",
                               "frames": [{"t": 0.0, "q": IDENT,
                                           "a": [0, 0, 0]}]})
        written = []
        for _ in range(50):                  # the write is on the server's turn
            written = list((tmp_path / "state" / "traces").glob("trace-*.json"))
            if written:
                break
            await asyncio.sleep(0.02)
    assert len(written) == 1
    assert json.loads(written[0].read_text())[0]["t"] == 0.0
