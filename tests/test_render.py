"""Does every page actually draw?

A game whose script throws while parsing paints nothing, and nothing looks
exactly like a deliberately empty screen. scripts/shot.py opens each page
in a headless browser and fails on any console error; these run it.

Slow by the standards of the rest of the suite -- a browser start each --
so they are marked, and skipped where there is no chromium.
"""
import shutil
import subprocess

import pytest

from gamehub import config

PAGES = ["hub", "games/pointer-demo/index.html", "games/snake/index.html",
         "games/colour-sort/index.html"]

pytestmark = pytest.mark.skipif(shutil.which("chromium") is None,
                                reason="chromium is not installed")


@pytest.mark.slow
@pytest.mark.parametrize("page", PAGES)
def test_the_page_draws_without_a_console_error(page, tmp_path):
    done = subprocess.run(
        ["python", str(config.ROOT / "scripts" / "shot.py"),
         str(tmp_path / "page.png"), "--page", page],
        capture_output=True, text=True, timeout=180)
    assert done.returncode == 0, done.stderr or done.stdout
    assert (tmp_path / "page.png").stat().st_size > 1000
