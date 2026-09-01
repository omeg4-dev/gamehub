"""What is in games/, and what is wrong with the rest of it.

A game is a folder you copied in, which means sooner or later one of them
will be half-copied. Nothing here raises: a bad folder becomes a Problem
the hub can show on a panel, and the other eleven games still open.
"""
import json
from dataclasses import dataclass, field

DEFAULT_CONTROLS = ["pointer", "a", "b"]


@dataclass
class Game:
    slug: str
    name: str
    entry: str
    description: str = ""
    icon: str = "icon.png"
    thumbnail: str = "thumbnail.png"
    controls: list = field(default_factory=lambda: list(DEFAULT_CONTROLS))
    score_order: str = "high"
    cursor: str = "hub"

    def as_json(self):
        return {"slug": self.slug, "name": self.name, "entry": self.entry,
                "description": self.description, "icon": self.icon,
                "thumbnail": self.thumbnail, "controls": self.controls,
                "scoreOrder": self.score_order, "cursor": self.cursor}


@dataclass
class Problem:
    slug: str
    reason: str


def _load(folder):
    manifest = folder / "game.json"
    if not manifest.exists():
        raise ValueError("no game.json in this folder")
    data = json.loads(manifest.read_text())
    if not data.get("name"):
        raise ValueError('game.json has no "name"')
    entry = data.get("entry", "index.html")
    if not (folder / entry).exists():
        raise ValueError(f"entry {entry} does not exist")
    return Game(slug=folder.name, name=data["name"], entry=entry,
                description=data.get("description", ""),
                icon=data.get("icon", "icon.png"),
                thumbnail=data.get("thumbnail", "thumbnail.png"),
                controls=data.get("controls", list(DEFAULT_CONTROLS)),
                score_order=data.get("score", {}).get("order", "high"),
                cursor=data.get("cursor", "hub"))


def discover(directory):
    games, problems = [], []
    if not directory.exists():
        return games, problems
    for folder in sorted(p for p in directory.iterdir() if p.is_dir()):
        try:
            games.append(_load(folder))
        except Exception as exc:            # noqa: BLE001 — shown, not raised
            problems.append(Problem(folder.name, str(exc)))
    games.sort(key=lambda g: g.name.lower())
    return games, problems
