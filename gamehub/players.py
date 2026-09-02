"""Who is holding a phone, and which slot each of them is in.

Slots are kept rather than handed out fresh, so a phone whose wifi blinked
comes back as the same player with the same name and the same colour. That
matters more than it sounds: the alternative is that walking behind the
sofa demotes you to player three.
"""
from . import config
from .controller import Controller


class Player:
    def __init__(self, number, controller):
        self.number = number
        self.controller = controller
        self.name = f"P{number}"
        self.socket = None

    @property
    def colour(self):
        return config.PLAYER_COLOURS[(self.number - 1) % len(config.PLAYER_COLOURS)]

    def as_json(self):
        return {"n": self.number, "name": self.name, "colour": self.colour}


class Players:
    """Every slot the room has, occupied or not."""

    def __init__(self, limit=None, first=None):
        limit = config.MAX_PLAYERS if limit is None else limit
        self.slots = [Player(i + 1, first if i == 0 and first else Controller())
                      for i in range(limit)]

    # --- the room ---------------------------------------------------------
    def join(self, socket):
        """The lowest free slot, or None when the room is full."""
        for player in self.slots:
            if player.socket is None:
                player.socket = socket
                # A phone that has just been picked up is pointing at the
                # television, not at wherever the last one was left.
                player.controller.pending_recentre = True
                return player
        return None

    def leave(self, socket):
        for player in self.slots:
            if player.socket is socket:
                player.socket = None
                return player
        return None

    def by_socket(self, socket):
        for player in self.slots:
            if player.socket is socket:
                return player
        return None

    def by_number(self, number):
        for player in self.slots:
            if player.number == number:
                return player
        return None

    def here(self):
        return [p for p in self.slots if p.socket is not None]

    def as_json(self):
        return [p.as_json() for p in self.here()]

    @property
    def one(self):
        """Player one's controller, which is the whole of a one-phone room."""
        return self.slots[0].controller
