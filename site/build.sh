#!/usr/bin/env bash
# Put the demo viewer into site/demo/, so the start page's "See a demo run" link works.
# The demo is one made-up run. No real assignment is in it.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
rm -rf "$HERE/demo"
python3 "$HERE/../skill/assigent/ui/build_static.py" "$HERE/demo"
echo "The site is ready in $HERE (open index.html, or serve the folder)."
