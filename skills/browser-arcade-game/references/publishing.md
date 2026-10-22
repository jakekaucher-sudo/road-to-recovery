# Publishing

## Before the first commit

`.gitignore` must exclude:
- `.claude/`, `CLAUDE.md`, research and prompt notes, unrelated side projects
- raw licensed music (`audio/source/`) and full-size originals (`art/*/src/`)
- `game/tools/.cert/`: the self-signed certificate and **private key** made by `serve_https.py`
- supplied reference photos the game doesn't use
- build output for the Artifact (`game/dist/`), test screenshots (`game/out/`), and downloaded tools (`.tools/`)

Run `git ls-files | grep -i "pem\|key\|cert\|source"` before pushing. If anything slipped into an unpushed commit, recreate the repo or rewrite that commit. Never push it.

## GitHub Pages (works for anyone, any device, with tilt)

1. Run `python3 game/tools/build_artifact.py --web`. It writes `docs/`: a full `index.html`, `.nojekyll`, and only the files the game loads. Paths that climb out of `game/` (`../assets/`) are rewritten.
2. Run `bash game/tools/publish_github.sh "message"`. It:
   - downloads the official GitHub CLI (a release at least two weeks old, checksum verified) if `gh` is missing
   - runs `gh auth login --web`, where the user approves in the browser (the one step you can't do for them)
   - commits, creates the public repo on first run (or attaches to an existing one), pushes, and turns on Pages from `main` + `/docs`
   - prints `https://<login>.github.io/<repo>/`
3. Free GitHub Pages needs a public repo. Tell the user the game and its source will be public. Check the music license before sharing widely.
4. When the session can't show an interactive terminal prompt, launch the script in the user's Terminal panel so they can complete sign-in, and tell them where it is.

## claude.ai Artifact (private, opens in the Claude app)

1. `python3 game/tools/build_artifact.py` writes `game/dist/`, with:
   - `index.html` as body content only (title, style, markup, importmap, module script), because the Artifact host adds the document skeleton
   - music renamed `.m4a` to `.mp4`, because Artifacts serve `.mp4` but refuse `.m4a`. It is the same audio, and references are rewritten.
2. Publish with the Artifact tool: `file_path` set to `game/dist/index.html`, `root` set to `game/dist`, and `files` listing every other file. Republishing to the same path keeps the URL.
3. Limits:
   - no motion sensor (drag steering only)
   - private to the owner until shared from the page's Share menu
   - scripts only from the allowed CDNs, which is why Three.js is vendored as files

## Updating after feedback

Edit (usually `config.js`). Then rebuild both targets, republish the Artifact to the same path, and run `publish_github.sh "what changed"`.

## Stores and portals (after approval)

- **Steam:** wrap the web build in Electron, or Tauri for a smaller download. Add Steamworks for achievements if wanted. Pay the Steam Direct fee, prepare store assets, and get licensing confirmation for every music track for that distribution.
- **Government or partner sites:** usually want a self-contained static folder, which is the `docs/` build. Expect accessibility (Section 508) and records review, plus their own hosting rules. Ask for their requirements before packaging.
