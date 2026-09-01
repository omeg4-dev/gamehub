#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p ~/.local/share/applications
python - <<PY > ~/.local/share/applications/gamehub.desktop
import sys; sys.path.insert(0, "$here")
from gamehub.launcher import desktop_entry
print(desktop_entry(), end="")
PY
update-desktop-database ~/.local/share/applications 2>/dev/null || true
echo "installed ~/.local/share/applications/gamehub.desktop"
echo
echo "Open port 8730 for the phone:"
echo "  sudo ufw allow proto tcp from 192.0.2.0/24 to any port 8730 comment 'gamehub'"
