# Testing without a phone in hand

Copy `scripts/capture.py`, `playtest.py`, `shots.py` and `serve.py` into `game/tools/`. They start a local server, launch headless Chrome with SwiftShader (`--enable-unsafe-swiftshader --use-angle=swiftshader`), and talk to it over the DevTools protocol.

## playtest.py

```bash
python3 game/tools/playtest.py "mobile=1&mute=1" actions.json OUTDIR 844x390 3
```

Arguments: the query string, the actions file, the output folder, the size, and an optional pixel ratio. Actions run in order:

```json
[{"step": 300, "inputs": {"gas": 1}},          // 300 physics steps with these inputs, then one render
 {"shot": "drive"},                             // screenshot -> OUTDIR/drive.jpg
 {"js": "__game.state"},                        // evaluate and print
 {"wait": 0.5},
 {"cdp": "Input.dispatchTouchEvent", "params": {"type": "touchStart", "touchPoints": [{"x": 420, "y": 300}]}}]
```

## Recipes

**Every screen at a size.** Go title, then set state `briefing`, then `loadStage(0)` + `beginStage()`, then drive, pause (`__game.paused = true`), `deliver(1, false)`, `finishRestoration()`, `setState('gameover')` and `setState('ending')`, with a shot after each. Repeat at 844x390@3, 667x375@2, 1180x820@2 and desktop 1280x720@1. Put the shots on one contact sheet (an HTML grid screenshotted with headless Chrome) and look for overflowing text, overlaps and blank frames.

**Steering logic.**
1. Dispatch `touchStart` and `touchEnd`, which should request tilt.
2. Dispatch `new DeviceOrientationEvent('deviceorientation', {beta, gamma})` at 0 to calibrate.
3. Dispatch ±15° and check that `__input.steer` is about ±0.54.
4. Drag in tilt mode and check that it is ignored.
5. Click `#steerBtn` and check that the mode is drag, it is saved, tilt is ignored and drag steers.

**Full playthrough.** Load `?stage=1&autopilot=1`, then loop `{"step": 900, "inputs": {"confirmPressed": true}}` about 40 times, logging state, stage and funds. Every stage must be reached and no `__error` set.

**Jitter.** Simulate 120 Hz in page JS: a physics step on even frames, `renderAlpha` 0 or 0.5, and `world.update(g, 1/120)`. Project the vehicle with `v.position.clone().project(cam)` and report the RMS second difference.

**Triangles.** Traverse the stage group and sum the triangles of visible meshes (× count for instanced meshes). Report per kind.

**One object in isolation.** Make a `dev/` page that renders one model (the vehicle, every variant of a prop) from several angles, and use `shots.py PATH OUTDIR WxH 'js' name ...`. Add `addEventListener('error', ...)` that sets `window.__error`, or a failing module just times out.

## Gotchas

- The desktop app's browser pane may be hidden, which throttles `requestAnimationFrame` and leaves screenshots stale. Trust headless captures.
- In zsh, `set -- $var` does not split words. Call each configuration explicitly.
- Headless rendering is CPU-only, so time logic, not frames. Real frame rate needs a real device.
- Say plainly what was not tested on a physical phone.
