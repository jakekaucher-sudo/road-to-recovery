# Phones and tablets

## Detecting a phone

`(pointer: coarse)` and touch support. `?mobile=1` and `?mobile=0` force it for testing. Add body class `mobile`. Landscape is the default. In portrait, show a "rotate your phone" screen with a **Play in portrait** button, because some app viewers never rotate.

## Controls

- **Pedals:** HTML circles in the bottom corners (BRAKE left, GAS right), about 92 CSS px, with `env(safe-area-inset-*)`. Hold to apply. Double-tap GAS to boost.
- **Pause and re-center:** small buttons in the top bar. Show re-center only in tilt mode, and also on the pause screen.
- **Tap anywhere** on the canvas confirms in menus.

## Tilt steering that actually turns on

iOS Safari only grants `DeviceOrientationEvent.requestPermission()` when it is called synchronously inside a user-activation event (`touchend`, `click`). Calling it from the game loop or after `await` fails silently.

```js
export function requestTilt() {
  const G = INPUT.gyro, DOE = window.DeviceOrientationEvent;
  if (G.active || G.status === "asking" || G.status === "denied") return;
  if (!DOE) { G.status = "unsupported"; return; }
  if (!window.isSecureContext) { G.status = "insecure"; return; }      // tilt needs https
  if (typeof DOE.requestPermission === "function") {                   // iPhone / iPad
    G.status = "asking";
    let p; try { p = DOE.requestPermission(); } catch (e) { G.status = ""; return; }
    Promise.resolve(p).then(r => { if (r === "granted") { G.status = "waiting"; listen(); } else G.status = "denied"; })
      .catch(() => { G.status = ""; });                                  // not a gesture: retry on the next tap
  } else { G.status = "waiting"; listen(); }                          // Android
}
// call it from: canvas touchend, GAS touchend, and the steering switch's click
function listen() {
  window.addEventListener("deviceorientation", onOrientation);
  setTimeout(() => { if (!INPUT.gyro.active && INPUT.gyro.status !== "denied") INPUT.gyro.status = "silent"; }, 1500);
}
```

Steering angle: take the component of world "up" (from beta and gamma) along the screen's right axis for the current `screen.orientation.angle`. That works whether the phone is turned like a wheel or tipped. Then apply a deadzone of about 2° and full lock at about 24°.

Re-center automatically on the first reading, at each stage's countdown, and with the re-center button.

## The steering switch

- Show a **STEER: TILT / DRAG** button on the title and pause screens, and save the choice in `localStorage` (wrapped in try/catch).
- In TILT mode, ignore drags once tilt is live. Before it is live, or when it is unavailable, drag still works.
- In DRAG mode, ignore the sensor.
- When tilt turns out to be unavailable (`denied`, `insecure`, `unsupported`, `silent`), show a one-line in-game message ("TILT UNAVAILABLE HERE: DRAG TO STEER") and a fuller note on the title and pause screens explaining why and what to do.

Drag steering: steer = `(touchX - startX) / (innerWidth * 0.18)`, clamped to ±1. Release recenters.

## Where tilt cannot work

- Plain `http://` on a phone.
- Inside the claude.ai Artifact viewer. Artifacts get no motion capability, so drag is the only option there.
- Some in-app browsers.

GitHub Pages (https) and `serve_https.py` on the same Wi-Fi both work.

## Text and layout on small screens

- Use real phone sizes in tests: 844x390 at pixel ratio 3, 667x375 at 2, 915x412 at 2.6, 1180x820 at 2.
- Size boxes from measured text, never fixed widths. Pixel-font sizes round to whole numbers and jump.
- Keep captions between the pedals: available width = `W - 2 * 128 * (W / innerWidth)`. Wrap to two or three lines, and fit the source line.
- HTML buttons and canvas text must not overlap the HUD panels at any size. Check the narrowest phone.
