import math

from gamehub import config


def test_vertical_angle_follows_the_screen_shape():
    """One angle for both axes squashes the vertical on a 16:9 screen: the
    same wrist movement would cover more picture sideways than up."""
    assert config.ASPECT == 16 / 9
    assert math.isclose(config.HALF_ANGLE_Y,
                        config.HALF_ANGLE_X / config.ASPECT)


def test_paths_stay_under_the_user_directories():
    assert str(config.DATA_DIR).endswith(".local/share/gamehub")
    assert str(config.STATE_DIR).endswith(".local/state/gamehub")
