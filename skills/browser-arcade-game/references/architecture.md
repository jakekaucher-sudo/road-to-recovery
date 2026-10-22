# Architecture patterns

## Contents
1. Two canvases
2. The loop: fixed physics, interpolated drawing
3. Track space vs world space
4. Config-driven content
5. A vehicle built from the brand artwork
6. Scenery: instanced, varied, culled
7. Weather "looks" per stage
8. Test hooks

## 1. Two canvases

`#gl` (WebGL, Three.js) underneath and `#ui` (2D canvas) on top for the HUD, menus and cutscenes. Phone buttons (pedals, pause, re-center, steering switch) are HTML elements above both, shown by body classes (`mobile`, `racing`, `paused`, `ontitle`, `tiltmode`).

Size the UI canvas as `innerWidth * min(devicePixelRatio, mobile ? 1.5 : 2)`. Compute a layout scale `s = min(W / 1280, H / 720)` and multiply every size by it.

## 2. The loop

```js
let last = 0, acc = 0;
function frame(now) {
  const dtMs = Math.min(100, now - (last || now)); last = now; acc += dtMs / 1000;
  let steps = 0;
  while (acc >= 1 / 60 && steps < 6) { pollInput(); game.update(); clearEdges(); acc -= 1 / 60; steps++; }
  if (steps === 6) acc = 0;
  game.renderAlpha = Math.min(1, acc * 60);      // how far we are between two physics steps
  render(dtMs);
  requestAnimationFrame(frame);
}
```

At the start of `game.update()`, store `prevZ`/`prevX` (and anything else drawn). The renderer draws `prev + (cur - prev) * renderAlpha`. Treat a big jump (stage reset, teleport) as no interpolation. Derive visual lean or yaw from the per-physics-step change, `(x - prevX) * 60`, not from per-frame differences: those are zero on frames with no physics step. Blend per-segment slopes for pitch so hills never step.

Measured on a simulated 120 Hz screen:

| Measure | Before | After |
|---|---|---|
| Vertical jitter | 4.0 px | 0.7 px |
| Yaw wobble | 6.2 mrad | 0.2 mrad |

## 3. Track space vs world space

Keep the game logic in a simple track model, like a classic pseudo-3D racer: segments along z, lateral x in road half-widths, curve and hill per segment. Map it to 3D world space in one module (`space.js`) with a precomputed centerline (`px`, `py`, `pz` and heading per segment) and `worldAt(cl, z, x, target)`, which returns position and heading.

Give the player's vehicle its own target object. A shared return object gets overwritten by later calls, which once made the van vanish.

## 4. Config-driven content

`config.js` holds stops and businesses (name, type, kind, damage, amount, wording, palette, restore order), stages (weather, time, length, traffic, hazards, hills), facts with sources, physics tuning, music per stage, cutscene slots, and asset paths. Resolve asset paths relative to `config.js` (`new URL(p, CONFIG_URL)`) so pages in other folders (`dev/`, builds) still load them.

## 5. A vehicle built from the brand artwork

When the client supplies side, front and rear views of a branded vehicle, build the 3D model from them at load time instead of hand-modeling and repainting it:
- Trace the side view's alpha into a silhouette: top and bottom per column, smoothed with a small moving average, with the bottom clamped at the rocker line above the wheels.
- Sweep a rounded cross-section around the silhouette: quarter-circle edges of radius 0.12–0.15 m, a slight roof crown, and a little tumblehome (narrower toward the roof). That turns a box into believable contours.
- Use one shared-vertex geometry with material groups by face normal: left side, right side, front, rear, and vertex-colored rims. Use `texture.channel` 0–3 so each group reads its own UV set (uv, uv1, uv2, uv3).
- Add flat side caps carrying the full livery. Flip the winding on the right-hand cap, or the double-sided shader flips its normal and that side looks washed out.
- Detect the wheels from dark columns in the art, then add real cylinders that spin, with steering on the front pair. Add glow sprites for lights and a blob shadow.

## 6. Scenery

- Build low-poly props procedurally with vertex colors, merged per kind, so each kind is one instanced draw.
- Return several color variants per kind (an array of geometries). The instancer splits instances round-robin, one instanced mesh per variant.
- Houses: a kit with foundation, walls, corner trim, roof slabs with overhang and a ridge cap, a gable prism, framed windows (frame box, glass plane, cross mullions, sill, shutters), door, porch with posts and roof, chimney, and an optional garage, tarp, waterline or stilts.
- Phones get fewer small parts. Set a module-level detail flag before building.
- Cull by track position (see smoothness.md).
- Keep big props out of any camera's hero shot of the destination building.

## 7. Looks per stage

One object per weather type: sky colors, fog near and far, sun and hemisphere intensity, ground colors, wetness (lowers road roughness, but not below about 0.4, or the low sun's glint blooms into a white blob), rain, wind, clouds. Blend between the previous and current look during the stage intro.

## 8. Test hooks

Expose `window.__game`, `__input`, `__world`, `__engine`, `__step(n, inputs)` (n physics steps, then one render) and `__render()`. Set `window.__ready = true` when booted and `window.__error` on any error. Query params: `?autopilot=1`, `?stage=N`, `?mobile=1`, `?mute=1`, `?q=low|high`, `?state=...`.
