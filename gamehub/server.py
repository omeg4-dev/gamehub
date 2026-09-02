"""One origin for everything: the hub, the controller, the games, the API.

Same-origin is not tidiness here — the games run in an iframe and talk to
the hub by postMessage, and keeping them on this origin is what lets that
be checked rather than trusted.

Every path starts with the session token. The server is on the LAN, so the
token is the whole of the door; a middleware refuses anything else before a
handler ever sees it.
"""
import base64
import json
import logging
import time

from aiohttp import WSMsgType, web

from . import config, library, net
from .controller import Controller
from .players import Players
from .store import Store

log = logging.getLogger("gamehub")

# Typed keys rather than bare strings: aiohttp asks for them, and they are
# the only names shared between build_app and every handler below.
TOKEN = web.AppKey("token", str)
CONTROLLER = web.AppKey("controller", Controller)
PLAYERS = web.AppKey("players", Players)
STORE = web.AppKey("store", Store)
GAMES_DIR = web.AppKey("games_dir", object)
WEB_DIR = web.AppKey("web_dir", object)
HUB = web.AppKey("hub", object)
PHONES = web.AppKey("phones", object)
PHONE_URL = web.AppKey("phone_url", str)


class Listeners:
    """A set of sockets that all get told the same thing.

    In practice one hub page and one phone, but a socket that died between
    two frames must not take the broadcast down with it.
    """

    def __init__(self):
        self.sockets = set()

    async def send(self, message):
        for socket in list(self.sockets):
            try:
                await socket.send_json(message)
            except Exception:                        # noqa: BLE001
                self.sockets.discard(socket)


def build_app(token, *, controller=None, store=None, games_dir=None,
              web_dir=None, phone_url=""):
    app = web.Application()
    app[TOKEN] = token
    app[PLAYERS] = Players(first=controller)
    # Player one is the whole room until a second phone turns up, so the
    # single-controller name still means something.
    app[CONTROLLER] = app[PLAYERS].one
    app[STORE] = store or Store()
    app[GAMES_DIR] = games_dir or config.GAMES_DIR
    app[WEB_DIR] = web_dir or config.WEB_DIR
    app[HUB] = Listeners()
    app[PHONES] = Listeners()
    app[PHONE_URL] = phone_url

    @web.middleware
    async def gate(request, handler):
        if request.match_info.get("token") != app[TOKEN]:
            raise web.HTTPForbidden(text="bad token")
        return await handler(request)

    app.middlewares.append(gate)
    app.add_routes([
        web.get("/{token}/hub", page("hub")),
        web.get("/{token}/phone", page("phone")),
        web.get("/{token}/static/{path:.*}", static),
        web.get("/{token}/games/{slug}/{path:.*}", game_file),
        web.get("/{token}/api/games", api_games),
        web.get("/{token}/api/qr", api_qr),
        web.get("/{token}/api/scores/{slug}", api_scores),
        web.post("/{token}/api/scores/{slug}", api_submit),
        web.post("/{token}/api/favourite/{slug}", api_favourite),
        web.get("/{token}/ws/phone", ws_phone),
        web.get("/{token}/ws/hub", ws_hub),
    ])
    return app


def page(which):
    async def handler(request):
        return web.FileResponse(request.app[WEB_DIR] / which / "index.html")
    return handler


def _safe(root, relative):
    """Refuse anything that climbs out of the directory it was given."""
    root = root.resolve()
    target = (root / relative).resolve()
    if root not in target.parents and target != root:
        raise web.HTTPForbidden(text="outside the served directory")
    if not target.is_file():
        raise web.HTTPNotFound()
    return target


async def static(request):
    return web.FileResponse(
        _safe(request.app[WEB_DIR], request.match_info["path"]))


async def game_file(request):
    root = request.app[GAMES_DIR] / request.match_info["slug"]
    return web.FileResponse(_safe(root, request.match_info["path"]))


async def api_games(request):
    games, problems = library.discover(request.app[GAMES_DIR])
    store = request.app[STORE]
    return web.json_response({
        "games": [g.as_json() for g in games],
        "problems": [{"slug": p.slug, "reason": p.reason} for p in problems],
        "favourites": store.favourites(),
        "recent": store.recent(),
        "sensitivity": store.sensitivity,
    })


def _order(request, slug):
    games, _ = library.discover(request.app[GAMES_DIR])
    for game in games:
        if game.slug == slug:
            return game.score_order
    return "high"


async def api_scores(request):
    slug = request.match_info["slug"]
    return web.json_response({"scores": request.app[STORE].scores(slug)})


async def api_submit(request):
    slug = request.match_info["slug"]
    body = await request.json()
    rows = request.app[STORE].submit(slug, body["score"],
                                       order=_order(request, slug))
    return web.json_response({"scores": rows})


async def api_favourite(request):
    slug = request.match_info["slug"]
    body = await request.json()
    on = request.app[STORE].favourite(slug, bool(body.get("on")))
    return web.json_response({"favourite": on})


async def api_qr(request):
    """The picture the phone scans, as a data URI so the page needs no
    second request and no file on disk."""
    url = request.app[PHONE_URL]
    png = base64.b64encode(net.qr_png(url)).decode()
    return web.json_response({"url": url, "png": f"data:image/png;base64,{png}"})


async def _roll_call(app):
    """Tell everybody who is in the room.

    Both ways round: the hub draws a cursor per player, and each phone
    shows its own number, so neither can be left holding a stale list.
    """
    who = {"type": "players", "players": app[PLAYERS].as_json()}
    await app[HUB].send(who)
    await app[HUB].send({"type": "phone", "connected": bool(app[PLAYERS].here())})
    await app[PHONES].send(who)


async def ws_phone(request):
    socket = web.WebSocketResponse(heartbeat=20)
    await socket.prepare(request)
    hub, phones = request.app[HUB], request.app[PHONES]
    players = request.app[PLAYERS]
    player = players.join(socket)
    if player is None:
        # Four is the cap the hub is drawn for. Saying so beats a fifth
        # phone that connects, works, and is invisible.
        await socket.send_json({"type": "full", "limit": len(players.slots)})
        await socket.close()
        return socket
    controller = player.controller
    phones.sockets.add(socket)
    calibrating = False
    frames = 0
    await socket.send_json({"type": "hello",
                            "sensitivity": request.app[STORE].sensitivity,
                            "flick": controller.flick_rate,
                            **player.as_json()})
    await _roll_call(request.app)
    try:
        async for message in socket:
            if message.type is not WSMsgType.TEXT:
                continue
            data = message.json()
            kind = data.get("type")
            if kind == "frame":
                for event in controller.frame(tuple(data["q"]),
                                              tuple(data["a"]), data["t"]):
                    await hub.send({**event, "player": player.number})
                frames += 1
                if calibrating and frames % 6 == 0:
                    await socket.send_json({"type": "peak",
                                            "rate": controller.take_peak()})
            elif kind == "button":
                await hub.send({**controller.button(data["name"], data["down"]),
                                "player": player.number})
            elif kind == "recentre":
                controller.recentre()
            elif kind == "name":
                player.name = str(data.get("name", ""))[:12] or f"P{player.number}"
                await _roll_call(request.app)
            elif kind == "calibrate":
                calibrating = bool(data.get("on"))
                controller.take_peak()
            elif kind == "flick":
                controller.set_flick_rate(data["value"])
            elif kind == "trace":
                # A recorded hand, kept so the tuning constants can be
                # argued with in pytest rather than on the sofa.
                path = config.STATE_DIR / "traces"
                path.mkdir(parents=True, exist_ok=True)
                name = path / f"trace-{int(time.time())}.json"
                name.write_text(json.dumps(data["frames"]))
                log.info("wrote %s (%d frames)", name, len(data["frames"]))
            elif kind == "sensitivity":
                controller.set_sensitivity(data["value"])
                request.app[STORE].sensitivity = data["value"]
    finally:
        phones.sockets.discard(socket)
        players.leave(socket)
        await _roll_call(request.app)
    return socket


async def ws_hub(request):
    socket = web.WebSocketResponse(heartbeat=20)
    await socket.prepare(request)
    hub, phones = request.app[HUB], request.app[PHONES]
    players = request.app[PLAYERS]
    hub.sockets.add(socket)
    # A hub that has just loaded knows nothing. Without this it would show
    # the fullscreen "point your phone at the screen" panel over a menu the
    # phone is already driving -- every time the page reloads.
    await socket.send_json({"type": "phone",
                            "connected": bool(players.here())})
    await socket.send_json({"type": "players", "players": players.as_json()})
    try:
        async for message in socket:
            if message.type is WSMsgType.TEXT:
                # The hub tells the phone what is running, so the controller
                # can dim the buttons this game ignores. A message addressed
                # to one player -- a rumble for whoever just got hit -- goes
                # to that phone alone.
                body = message.json()
                target = players.by_number(body.get("player") or 0)
                if target is not None and target.socket is not None:
                    try:
                        await target.socket.send_json(body)
                    except Exception:               # noqa: BLE001
                        pass
                else:
                    await phones.send(body)
    finally:
        hub.sockets.discard(socket)
    return socket
