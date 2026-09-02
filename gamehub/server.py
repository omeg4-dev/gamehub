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
from .store import Store

log = logging.getLogger("gamehub")

# Typed keys rather than bare strings: aiohttp asks for them, and they are
# the only names shared between build_app and every handler below.
TOKEN = web.AppKey("token", str)
CONTROLLER = web.AppKey("controller", Controller)
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
    app[CONTROLLER] = controller or Controller()
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


async def ws_phone(request):
    socket = web.WebSocketResponse(heartbeat=20)
    await socket.prepare(request)
    controller = request.app[CONTROLLER]
    hub, phones = request.app[HUB], request.app[PHONES]
    phones.sockets.add(socket)
    await socket.send_json({"type": "hello",
                            "sensitivity": request.app[STORE].sensitivity})
    await hub.send({"type": "phone", "connected": True})
    try:
        async for message in socket:
            if message.type is not WSMsgType.TEXT:
                continue
            data = message.json()
            kind = data.get("type")
            if kind == "frame":
                for event in controller.frame(tuple(data["q"]),
                                              tuple(data["a"]), data["t"]):
                    await hub.send(event)
            elif kind == "button":
                await hub.send(controller.button(data["name"], data["down"]))
            elif kind == "recentre":
                controller.recentre()
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
        await hub.send({"type": "phone", "connected": False})
    return socket


async def ws_hub(request):
    socket = web.WebSocketResponse(heartbeat=20)
    await socket.prepare(request)
    hub, phones = request.app[HUB], request.app[PHONES]
    hub.sockets.add(socket)
    # A hub that has just loaded knows nothing. Without this it would show
    # the fullscreen "point your phone at the screen" panel over a menu the
    # phone is already driving -- every time the page reloads.
    await socket.send_json({"type": "phone", "connected": bool(phones.sockets)})
    try:
        async for message in socket:
            if message.type is WSMsgType.TEXT:
                # The hub tells the phone what is running, so the controller
                # can dim the buttons this game ignores.
                await phones.send(message.json())
    finally:
        hub.sockets.discard(socket)
    return socket
