# Cutscenes

## Registry

```js
registerCutscene("intro-dc", {
  duration: 16.9, skippable: true,
  music: { url: "audio/intro-night-drive.m4a", fadeIn: 0.05, fadeOut: 0.6 },
  preload() { /* load stills; build derived plates (e.g. jacket print) once */ },
  render(ctx, t, W, H, game) { /* draw the frame for time t */ },
});
```

Config slots: `cutscenes: { intro, beforeStage: [...], arrival: [...], ending }`. An empty slot falls back to the built-in screen.

Preload a cutscene's music clip before it plays. Start the intro clip on the start tap, and the ending clip while the last stage loads.

## Look

- Illustrated 16:9 stills from the user's image tools: 2K, one per shot. Describe the style in words, such as "bold comic-book realism, thick ink outlines, cel shading". Don't name a game or artist. Request no text or logos from the model.
- Pan and zoom each still slowly (`kenBurns(ctx, img, W, H, k, [cx, cy, zoom], [cx, cy, zoom])`).
- Add letterbox, grain, vignette, a skip hint, and fades on the cuts.
- Cut on bar lines. Find the beat drop with an RMS envelope (convert to WAV with `afconvert`, then analyze in Python). Trim with `avconvert --preset PresetAppleM4A --start S --duration D`.

## Brand prints in a scene (for example, a logo on a staff jacket)

- Crop the mark from the official artwork and key out its background. Never redraw it.
- Detect the garment in the still by color (royal blue: `b > 95 && b > r + 45 && b > g + 20`).
- Measure the collar row (the first row wider than 15% of the 90th-percentile row width) and the hem (stop where the body narrows again, so trousers don't count). The chest width is the median span between 45% and 75% of the way down.
- Size the print at `0.83 × chest width` and put its top at `collar + 0.089 × chest width`. Calibrate those two numbers on the first approved shot, then reuse them for every other shot, so the print matches across scenes.
- Shade the print by the garment's luminance and bow it slightly with the back's curve.

## Ending before the score

Run the ending montage of every stop, with name, type and hypothetical amount, then the closing line and site. Then show the score screen.
