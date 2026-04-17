#!/usr/bin/env bash
# Run the Blender logo render headlessly.
#
# Usage:  ./render.sh                 # renders logo.png next to this script
#         BLENDER_BIN=/path/to/blender ./render.sh   # override Blender binary
#
# Looks for Blender in this order:
#   1. $BLENDER_BIN (if set)
#   2. /Applications/Blender.app/Contents/MacOS/Blender (macOS app bundle)
#   3. `blender` on PATH (Linux / Windows-WSL / manual install)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${BLENDER_BIN:-}" ]]; then
  BLENDER="$BLENDER_BIN"
elif [[ -x "/Applications/Blender.app/Contents/MacOS/Blender" ]]; then
  BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"
elif command -v blender >/dev/null 2>&1; then
  BLENDER="blender"
else
  echo "Error: Blender not found." >&2
  echo "Install Blender or set BLENDER_BIN to the path of the executable." >&2
  exit 1
fi

exec "$BLENDER" -b -P "$SCRIPT_DIR/blender_logo.py" -- "$@"
