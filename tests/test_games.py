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


def run(script, game, source="game.js"):
    out = subprocess.run(["node", str(JS / script),
                          str(config.GAMES_DIR / game / source)],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def test_every_folder_in_games_loads():
    games, problems = library.discover(config.GAMES_DIR)
    assert problems == []
    assert {g.slug for g in games} >= {"balloon-rush", "snake", "colour-sort", "hot-potato", "road-hop"}


@pytest.mark.parametrize("slug", ["balloon-rush", "snake", "colour-sort", "hot-potato", "road-hop"])
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
        "followingItsTailIsFine": True,
        "applesAvoidTheSnake": True,
        "aBackwardsFlickCannotKill": True,
        "aQueuedTurnCannotBeUndoneIntoItself": True,
    }


@node
def test_balloon_rush_scores_a_press_the_way_the_room_expects():
    assert run("balloon-rush.js", "balloon-rush") == {
        "aPopIsWorthOne": True,
        "goldIsWorthFive": True,
        "aBombCostsThree": True,
        "aMissScoresNothing": True,
        "theFrontBalloonPops": True,
        "escapedBalloonsAreForgotten": True,
        "aQuickSecondPopIsDoubled": True,
        "aSlowSecondPopIsNotDoubled": True,
        "combosAreNotShared": True,
    }


@node
def test_hot_potato_only_allows_throws_that_make_sense():
    assert run("hot-potato.js", "hot-potato") == {
        "aFreshCatchCannotBeThrownOn": True,
        "aHeldBombCanBeThrown": True,
        "onlyTheHolderMayThrow": True,
        "youCannotThrowItToYourself": True,
        "theFuseStopsInTheAir": True,
        "aSecondThrowInFlightIsRefused": True,
        "itLandsInTheOtherHand": True,
        "itExplodesOnTheHolder": True,
        "theBombGoesToSomeoneStillAlive": True,
        "aBangBringsAFreshFuse": True,
        "theLastOneStandingWins": True,
        "youCannotThrowItToSomebodyWhoIsOut": True,
    }


@node
def test_road_hop_kills_you_for_the_right_reasons():
    """Its rules live in world.js with no canvas anywhere near them, which
    is what lets a car, a log and the eagle all be checked here."""
    assert run("road-hop.js", "road-hop", "world.js") == {
        "treesBlockAHop": True,
        "theEdgeIsAWall": True,
        "aQuietRoadIsSafe": True,
        "aCarKills": True,
        "waterWithoutALogDrowns": True,
        "aLogCarriesYou": True,
        "sweptOffTheEdgeDrowns": True,
        "theScoreIsTheFurthestRow": True,
        "theEagleTakesYouIfYouFallBehind": True,
        "everyWaterRowHasSomethingToStandOn": True,
        "noGrassRowIsAWall": True,
        "aTrackStartsQuiet": True,
        "theTrainWarnsBeforeItArrives": True,
        "aSecondPressIsQueuedNotLost": True,
        "theQueuedHopHappens": True,
    }


@node
def test_every_colour_sort_board_can_actually_be_finished():
    """Dealt backwards from a solved board, so this is really a check on
    that reasoning: a timed puzzle you cannot solve is a broken round."""
    boards = run("colour-sort.js", "colour-sort")
    assert len(boards) == 30
    assert [b for b in boards if not b["solvable"]] == []
    assert [b for b in boards if b["empty"]] == []
