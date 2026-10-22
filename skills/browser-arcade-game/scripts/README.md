# Scripts

Copy these into `<project>/game/tools/`. They expect the layout in SKILL.md: the game in `game/` and brand art in `assets/`.

| Script | What it does |
|---|---|
| `serve.py [port]` | Serves the project folder locally, at http://localhost:8790/game/ |
| `serve_https.py [port]` | HTTPS on your Wi-Fi so a phone can test tilt steering. Makes a self-signed cert in `.cert/` (keep it out of git) |
| `capture.py` | Shared headless-Chrome and DevTools helpers used by the others |
| `playtest.py "QUERY" actions.json OUTDIR WxH [DPR]` | Steps the game and saves screenshots (see references/testing.md) |
| `shots.py PATH OUTDIR WxH 'js' name ...` | Screenshots any page after running JavaScript (for dev/ test pages) |
| `build_artifact.py [--web]` | Self-contained build: `docs/` for GitHub Pages (`--web`) or `game/dist/` for a claude.ai Artifact |
| `publish_github.sh ["message"]` | Sign in, create the repo or push, and turn on GitHub Pages. Prints the play link |

`build_artifact.py` copies the van images named in `config.js` and `src/cine.js`. Change that line if your art comes from elsewhere.
