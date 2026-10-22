---
name: browser-arcade-game
description: Build, polish and publish a 3D arcade-style game that runs smoothly in any web browser on laptops, phones and tablets (Three.js, no build step), with phone controls (on-screen pedals, tilt steering with a drag fallback), cutscenes, licensed music, headless testing, and publishing to GitHub Pages and claude.ai. Use this skill whenever someone wants to make a playable web or mobile game, a branded or promotional mini-game, an arcade racer or driving game, a game "like" a classic arcade title, a game for an agency, campaign or training, or wants to fix, speed up, test on phones, or publish an existing browser game, even if they never say "Three.js" or "skill".
---

# Browser arcade game

This skill captures a workflow that took an SBA Disaster Recovery driving game ("The Road to Recovery") from idea to a smooth 3D game playable on phones, with cutscenes, published to GitHub Pages and claude.ai. Reuse the structure, tools and hard-won fixes instead of rediscovering them.

## When the request arrives

Ask only what changes the build, and only if it isn't stated:
- **The game and its reference.** A classic to be loosely based on (for example Chase H.Q. or OutRun), the goal, and how a round is won or lost.
- **The audience and brand.** Brand colors, logos, and any rules about the brand (for example "never redraw the logo, use the supplied art"). Ask whether the people, places and amounts are real or must be labeled fictional.
- **The devices.** Laptop browser, phones (iPhone and Android), tablets. Default to all three.
- **Controls.** Keyboard keys on desktop. Tilt or drag steering and on-screen pedals on phones.
- **Cutscenes and music.** Whether they want an intro or ending, and where the music comes from. Use licensed tracks only, such as the user's Artlist or similar library. Never imitate a named artist's copyrighted song.

Then build in this order, showing the user progress after each step:
1. Playable core (one stage, controls, camera, HUD) on desktop.
2. Phone controls and layout, tested at real phone sizes.
3. All stages, scenery, hazards, traffic, and the win/lose loop.
4. Cutscenes and music.
5. Smoothness pass, full playthrough test, publish.

## Project layout

Keep everything editorial in one config file so non-programmers can change names, amounts, wording and tuning without touching code.

```
project/
  game/
    index.html          two stacked canvases (#gl for WebGL, #ui for the 2D overlay), phone buttons, importmap
    config.js           ALL names, amounts, labels, stages, tuning, music, cutscene slots
    src/main.js         boot, fixed-timestep loop, screen dispatch, test hooks (window.__game, __step, __render)
    src/game.js         state machine, physics, collisions, scoring
    src/input.js        keyboard, pedals, tilt, drag, steering-mode switch
    src/hud.js, screens.js   2D overlay: HUD, title, pause, results, ending
    src/three/*.js      renderer + quality tiers, world builder, vehicle, road, props, effects, sky
    src/intro.js, outro.js, cine.js, cutscenes.js   cutscene registry and shared cinematic tools
    vendor/three/       Three.js copied in (no CDN at runtime, works offline)
    audio/, art/        trimmed music clips and cutscene stills (originals in */src or audio/source, not published)
    tools/              copy the scripts from this skill's scripts/ folder here
  assets/               brand artwork (logos, vehicle views) used as-is
  docs/                 web build for GitHub Pages (generated)
```

Load Three.js through an importmap pointing at `vendor/three/three.module.js` and `vendor/three/addons/`. No bundler, so anyone can edit a file and reload.

Read `references/architecture.md` before writing the engine. It has the loop, interpolation, culling and vehicle-from-artwork patterns.

## Rules that keep it smooth

These came from real glitches. Each one was a visible problem on a phone:

- **Fixed physics, interpolated drawing.** Run the game at a fixed 60 steps per second, but draw the vehicle, camera and traffic between the last two steps. Without it, 120 Hz phones and laptops show every other frame frozen, which reads as the vehicle "vibrating".
- **Adjust quality before drawing, never after.** Resizing the WebGL canvas wipes it, so an adaptive-resolution change made after rendering shows a black frame. Give the adjuster a ceiling so it can't bounce up and down.
- **Warm shaders when a stage loads** (`renderer.compile(scene, camera)`), so nothing stalls the first time an object appears.
- **Instance the scenery and cull it by track position.** Store instances in track order. Each frame, copy only the stretch between just behind the player and the fog line into the instance buffer. That costs no extra draw calls and cut triangles by 25–40%.
- **Quality tiers:** phones get lower resolution, no shadow maps, no bloom, lighter particles and fewer small props. Laptops get shadows, bloom and reflective wet roads.
- **Bloom needs a NaN guard.** Add a sanitize pass before bloom, or one bad pixel turns the whole frame black.
- **Camera above the vehicle's roof.** For tall vehicles, raise and pull back the chase camera so the road ahead is visible over the roof.

`references/smoothness.md` has the code for each.

## Phone controls

Read `references/mobile.md` before touching input. The two things that broke in practice:

- **iPhone motion permission must be requested synchronously inside a tap handler** (`touchend` or `click`). Asking from the game loop, or after any `await`, is silently refused, and the game falls back to drag with no explanation.
- **Give players a STEER: TILT / DRAG switch** on the title and pause screens, remember it in localStorage, ignore drags in tilt mode, and fall back to drag (with a one-line message) when tilt is unavailable. That covers denied permission, a non-HTTPS page, or an app that doesn't pass motion data, such as the claude.ai viewer.

Tilt needs HTTPS. Use `scripts/serve_https.py` for phones on the same Wi-Fi, or GitHub Pages.

## Text that fits on every screen

The 2D overlay is drawn at up to 1.5× the screen size on phones. Pixel-font sizes get rounded to whole numbers, so a fixed-size box overflows when the rounding jumps up. That happened to the title's controls box on iPhones held sideways. So:
- Size every box from its measured text (`pixelWidth`, `measureText`), never from a fixed width.
- Wrap long captions and keep them clear of the on-screen pedals on phones.
- Stack text by measured line heights so labels, numbers and stars never overlap.
- Fit sign textures to about 84% of the board's width so letters never touch the border.

## Brand and honesty

- Use supplied logos and vehicle art as images. Don't redraw or re-create a brand mark. Crop it from the official art when you need it elsewhere, such as a jacket print in a cutscene.
- Label invented people, places and amounts on screen as fictional or hypothetical. Cite sources for any real facts shown in captions.
- Music: licensed tracks only, trimmed with macOS `avconvert` (`--start`, `--duration`). Start in-game tracks near the beat drop rather than on a spoken intro.

## Cutscenes

Use a registry: `registerCutscene(id, { duration, skippable, render(ctx, t, W, H, game), music, preload })`, with slots in config (`intro`, `beforeStage[]`, `arrival[]`, `ending`). Cut on the music's bar lines. Illustrated stills with slow pan and zoom, letterbox, grain and titles look good and stay small. Generate stills with the user's image tools, and add brand prints in code from the official art. `references/cutscenes.md` covers timing, jacket and logo placement, and music cuts.

## Testing (do this, don't ask the user to check)

The tools in `scripts/` drive headless Chrome over the DevTools protocol:
- `playtest.py "QUERY" actions.json OUTDIR WxH [DPR]` steps the game and takes screenshots. Use real phone sizes and pixel ratios (844x390 at 3, 667x375 at 2, 1180x820 at 2) with `mobile=1`.
- Actions can dispatch touches (`Input.dispatchTouchEvent`) and fake motion (`new DeviceOrientationEvent(...)`) to test steering logic end to end.
- Capture every screen (title, briefing, stage intro, drive, pause, restore, results, game over, ending) and inspect them on one contact sheet.
- Run a full `?autopilot=1` playthrough of every stage after each round of changes.
- Measure frame jitter with a simulated 120 Hz loop, and triangle counts per stage, before claiming "smooth".

The in-app browser pane may be hidden and throttled, so use headless captures as the source of truth. `references/testing.md` has the recipes.

## Publishing

Read `references/publishing.md`. In short:
- `scripts/build_artifact.py --web` writes a self-contained `docs/` folder for GitHub Pages. `scripts/publish_github.sh` signs in, creates the repo, pushes, turns on Pages and prints the link. Signing in needs the user, once.
- `scripts/build_artifact.py` without flags writes a claude.ai Artifact build. It is body-only HTML, and `.m4a` is renamed to `.mp4` because Artifacts don't serve `.m4a`. Publish it with the Artifact tool. Tilt never works inside the claude.ai viewer, so say so.
- Never publish private keys (`.cert/`), raw licensed music sources, or supplied reference photos. Check `.gitignore` before the first commit.

## Hand-off

End with the playable links, what was verified (sizes, playthrough, jitter numbers), and what was not, such as no physical-device test. Also tell the user how to edit it: change `config.js`, run the build, run the publish script.
