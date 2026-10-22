#!/bin/bash
# Render an SVG (2000x1339) to PNG with headless Chrome.  Usage: ./render.sh in.svg out.png
set -e
in="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
out="$2"; [[ "$out" = /* ]] || out="$PWD/$out"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=2000,1339 --screenshot="$out" "file://$in" >/dev/null 2>&1
echo "$out"
