import argparse
import sys

from .launcher import run

parser = argparse.ArgumentParser(prog="gamehub")
parser.add_argument("--tv", action="store_true",
                    help="put the hub on the television (not yet wired up)")
args = parser.parse_args()
if args.tv:
    # The flag is in the spec and will drive tv mode's transitions, but that
    # crosses into ~/.config/hypr and belongs to the second plan. Saying so
    # beats silently opening on the wrong screen.
    sys.exit("--tv is not implemented yet; see the second plan")
run()
