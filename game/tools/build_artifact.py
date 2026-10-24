#!/usr/bin/env python3
"""Package the game into one self-contained folder. Paths that climb out of game/ are
rewritten, and only the files the game loads are copied (no source music, no original PNGs).
  python3 game/tools/build_artifact.py            -> game/dist/  (claude.ai Artifact: page body only)
  python3 game/tools/build_artifact.py --web      -> docs/       (GitHub Pages or any web host: full page)"""
import os, re, shutil, sys
GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(GAME)
WEB = "--web" in sys.argv
DIST = os.path.join(ROOT, "docs") if WEB else os.path.join(GAME, "dist")
shutil.rmtree(DIST, ignore_errors=True)

def copy(src, dst, edit=None):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if edit:
        open(dst, "w").write(edit(open(src).read()))
    else:
        shutil.copy2(src, dst)

# Artifacts serve .mp4 but not .m4a (same MP4/AAC audio), so music is renamed on the way in.
up = lambda s: s.replace('"../assets/', '"assets/').replace('"../game/art/', '"art/').replace('.m4a"', '.mp4"')
copy(os.path.join(GAME, "config.js"), os.path.join(DIST, "config.js"), up)
for d in ("src", "vendor"):
    for base, _, files in os.walk(os.path.join(GAME, d)):
        for f in files:
            s = os.path.join(base, f); r = os.path.relpath(s, GAME)
            copy(s, os.path.join(DIST, r), up if f.endswith(".js") and d == "src" else None)
for d in ("art/intro", "art/ending", "art/sam", "art/tex"):
    for f in os.listdir(os.path.join(GAME, d)):
        if f.endswith((".jpg", ".png")): copy(os.path.join(GAME, d, f), os.path.join(DIST, d, f))
for base, _, files in os.walk(os.path.join(GAME, "audio")):
    if "source" in base: continue
    for f in files:
        if f.endswith(".m4a") and "my-dark-side" not in f:      # the old intro track is unused
            s = os.path.join(base, f); copy(s, os.path.join(DIST, os.path.relpath(s, GAME))[:-4] + ".mp4")
# van artwork named in config.js
for rel in re.findall(r'"\.\./(assets/[^"]+)"', open(os.path.join(GAME, "config.js")).read() + open(os.path.join(GAME, "src/cine.js")).read()):
    copy(os.path.join(ROOT, rel), os.path.join(DIST, rel))
html = open(os.path.join(GAME, "index.html")).read()
if WEB:
    # a normal web page; .nojekyll stops GitHub Pages from processing the files
    open(os.path.join(DIST, "index.html"), "w").write(html)
    open(os.path.join(DIST, ".nojekyll"), "w").write("")
else:
    # the page: body content only (the Artifact host adds the document skeleton)
    title = re.search(r"<title>.*?</title>", html).group(0)
    style = re.search(r"<style>.*?</style>", html, re.S).group(0)
    body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
    open(os.path.join(DIST, "index.html"), "w").write(title + "\n" + style + "\n" + body.strip() + "\n")
n = sum(len(f) for _, _, f in os.walk(DIST)); size = sum(os.path.getsize(os.path.join(b, f)) for b, _, fs in os.walk(DIST) for f in fs)
print(f"{DIST}: {n} files, {size / 1e6:.1f} MB")
