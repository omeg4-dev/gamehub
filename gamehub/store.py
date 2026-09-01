"""The only thing about the hub that outlives a session.

Two small JSON files, written by rename so a crash cannot truncate them,
and read defensively so a truncated one from before this rule costs the
scores rather than the launch.
"""
import json
import os
import time

from . import config

TOP = 10
RECENT = 12


def _read(path, fallback):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return fallback


def _write(path, data):
    temporary = path.with_suffix(path.suffix + ".new")
    temporary.write_text(json.dumps(data, indent=1))
    os.replace(temporary, path)


class Store:
    def __init__(self, directory=config.DATA_DIR):
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)
        self._scores_path = directory / "scores.json"
        self._state_path = directory / "state.json"
        self._scores = _read(self._scores_path, {})
        self._state = _read(self._state_path, {})

    # --- scores -----------------------------------------------------------
    def submit(self, slug, score, order="high"):
        rows = self._scores.setdefault(slug, [])
        rows.append({"score": score, "when": time.time()})
        rows.sort(key=lambda row: row["score"], reverse=(order == "high"))
        del rows[TOP:]
        _write(self._scores_path, self._scores)
        return rows

    def scores(self, slug):
        return self._scores.get(slug, [])

    # --- favourites and history ------------------------------------------
    def favourite(self, slug, on):
        stars = set(self._state.get("favourites", []))
        stars.add(slug) if on else stars.discard(slug)
        self._state["favourites"] = sorted(stars)
        _write(self._state_path, self._state)
        return slug in stars

    def favourites(self):
        return list(self._state.get("favourites", []))

    def played(self, slug):
        history = [s for s in self._state.get("recent", []) if s != slug]
        self._state["recent"] = [slug, *history][:RECENT]
        _write(self._state_path, self._state)

    def recent(self):
        return list(self._state.get("recent", []))

    # --- the one setting --------------------------------------------------
    @property
    def sensitivity(self):
        return self._state.get("sensitivity", 1.0)

    @sensitivity.setter
    def sensitivity(self, value):
        self._state["sensitivity"] = float(value)
        _write(self._state_path, self._state)
