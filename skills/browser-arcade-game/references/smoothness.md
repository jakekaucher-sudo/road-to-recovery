# Smoothness on laptops and phones

## Quality tiers

```js
export function detectQuality(mobile) {
  // phones: lower resolution, no shadow maps, no bloom, lighter rain/particles, shorter draw distance
  return mobile
    ? { high: false, mobile: true, pixelRatio: 0.85, shadows: false, bloom: false, rain: 900, particles: 360, debris: 36, far: 600 }
    : { high: true, mobile: false, pixelRatio: Math.min(devicePixelRatio, 1.75), shadows: true, bloom: true, rain: 2600, particles: 900, debris: 70, far: 900 };
}
```

`?q=low` and `?q=high` force a tier.

## Adaptive resolution: before drawing, with a ceiling

```js
render(dtMs) {
  this.adapt(dtMs);               // a resize clears the canvas: never do it after drawing
  if (this.composer && this.q.bloom) this.composer.render(); else this.renderer.render(this.scene, this.cam);
}
adapt(dtMs) {
  this.ft = this.ft * 0.95 + Math.min(100, dtMs) * 0.05;
  if (this.ft > 21) { this.slow += dtMs; this.fast = 0; } else if (this.ft < 14) { this.fast += dtMs; this.slow = 0; } else this.slow = this.fast = 0;
  if (this.slow > 1500) { this.slow = 0;
    if (this.pr > 0.65) { this.ceiling = this.pr - 0.05; this.pr = Math.max(0.6, this.pr - 0.15); /* setPixelRatio + resize */ }
    else if (this.q.bloom) this.q.bloom = false; else if (this.q.shadows) { this.q.shadows = false; this.renderer.shadowMap.enabled = false; }
  } else if (this.fast > 4000 && this.pr < Math.min(this.q.pixelRatio, this.ceiling ?? 9) - 0.01) { /* raise by 0.1, capped at ceiling */ }
}
```

Without the ceiling, the resolution climbs back up, gets slow again and drops, which shows as periodic blur and flicker.

## Warm shaders

After building a stage, and once at boot for the title scene, call `renderer.compile(scene, camera)` inside try/catch.

## Distance culling for instanced scenery (no extra draw calls)

```js
// at build: list sorted by segment index i
st.scen.push({ im, segs: Int32Array.from(list, e => e.i), full: im.instanceMatrix.array.slice(), a: -1, b: -1 });
im.frustumCulled = false;
// every frame
const vs = playerSeg, fog = Math.min(q.far, Math.max(look.fogFar, prevLook.fogFar));
const lo = vs - 45, hi = vs + (fog * 1.3 + 60) / SEGM;
for (const S of st.scen) {
  const a = lowerBound(S.segs, lo), b = lowerBound(S.segs, hi);
  if (a === S.a && b === S.b) continue;
  S.a = a; S.b = b; S.im.count = b - a;
  if (b > a) { S.im.instanceMatrix.array.set(S.full.subarray(a * 16, b * 16), 0);
    S.im.instanceMatrix.clearUpdateRanges(); S.im.instanceMatrix.addUpdateRange(0, (b - a) * 16); S.im.instanceMatrix.needsUpdate = true; }
}
```

Measured on the reference game:

| Stage | Before | After |
|---|---|---|
| Stage 1 | about 414k triangles | about 262k triangles |
| Stage 5 | about 419k triangles | about 240k triangles |

## Bloom NaN guard

Insert a ShaderPass before UnrealBloomPass that writes `0` for `isnan` or `isinf` and clamps at 32. One bad pixel otherwise blacks out the whole frame. This happened during a building restoration effect.

## Sky and fog

Make the sky dome follow the camera (radius well inside the far plane) and write `gl_Position.z = gl_Position.w * 0.9999`. Otherwise the far plane clips it and the sky goes black.

## Effects budget

- Rain: one line-segment shader with GPU animation, using the same seed for both ends of each line.
- Particles: a pooled `Points` buffer.
- Hazards that get hit: tumble sideways and away, never toward the camera.
- Water: `onBeforeCompile` waves.

## Measure, don't guess

- Triangles per stage: walk the stage group, summing index count / 3 × instance count.
- Per-frame logic cost: time 900 iterations of `game.update(); world.update(game, 1/60)`. On the reference game it was well under 1 ms, so the GPU was the only real cost.
- Jitter: simulate a 120 Hz loop (a physics step every other frame, renderAlpha 0 then 0.5), project the vehicle to the screen, and take the RMS second difference of screen x and y.
