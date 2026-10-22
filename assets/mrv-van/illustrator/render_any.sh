#!/bin/bash
# Render any SVG at its own viewBox size via a wrapper HTML.  Usage: render_any.sh in.svg out.png
set -e
in="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; out="$2"; [[ "$out" = /* ]] || out="$PWD/$out"
vb=$(grep -o 'viewBox="[^"]*"' "$in" | head -1 | sed 's/viewBox="//;s/"//')
W=$(echo $vb | awk '{printf "%d", $3}'); H=$(echo $vb | awk '{printf "%d", $4}')
html="${in%.svg}.html"
printf '<!doctype html><html><body style="margin:0;background:#fff"><img src="file://%s" style="display:block;width:%dpx;height:%dpx"></body></html>' "$in" "$W" "$H" > "$html"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=$W,$H --screenshot="$out" "file://$html" >/dev/null 2>&1
rm -f "$html"; echo "$out ${W}x${H}"
