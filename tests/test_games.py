"""The games that ship in the box.

Their rules live in JavaScript, so the checks run them in node with a
stubbed browser around them (tests/js/). If node is not here the game logic
goes unchecked and the tests say so rather than passing quietly.
"""
import json
import shutil
import subprocess

import pytest

from gamehub import config, library

JS = config.ROOT / "tests" / "js"
node = pytest.mark.skipif(shutil.which("node") is None,
                          reason="node is not installed")


def run(script, game):
    out = subprocess.run(["node", str(JS / script),
                          str(config.GAMES_DIR / game / "game.js")],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def test_every_folder_in_games_loads():
    games, problems = library.discover(config.GAMES_DIR)
    assert problems == []
    assert {g.slug for g in games} >= {"pointer-demo", "snake", "colour-sort"}


@pytest.mark.parametrize("slug", ["pointer-demo", "snake", "colour-sort"])
def test_each_game_has_the_art_the_grid_asks_for(slug):
    """A missing thumbnail is a blank plate on the menu, which looks like a
    broken game rather than a game without a picture."""
    games, _ = library.discover(config.GAMES_DIR)
    game = next(g for g in games if g.slug == slug)
    assert (config.GAMES_DIR / slug / game.thumbnail).exists()


@node
def test_snake_obeys_its_three_rules():
    assert run("snake.js", "snake") == {
        "refusesToTurnBack": True,
        "wallKills": True,
        "applesGrow": True,
        "bitingItselfKills": True,
        "applesAvoidTheSnake": True,
    }


@node
def test_every_colour_sort_board_can_actually_be_finished():
    """Dealt backwards from a solved board, so this is really a check on
    that reasoning: a timed puzzle you cannot solve is a broken round."""
    boards = run("colour-sort.js", "colour-sort")
    assert len(boards) == 30
    assert [b for b in boards if not b["solvable"]] == []
    assert [b for b in boards if b["empty"]] == []
