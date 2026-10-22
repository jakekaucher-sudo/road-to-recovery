// INTRO CUTSCENE (28.1 s): an HQ prologue, then the neo-noir driving-film opening, told
// with bold inked illustrations (art/intro). Audio is audio/intro-hq.m4a, built by
// tools/make_intro_audio.py: a muffled music bed, call/button/siren/impact effects, then
// "Night Drive" by IamDayLight (1.6-18.5 s) from 11.16 s, so every later cut still lands
// on a bar (2.79 s per bar).
//   HQ prologue
//   a  0.00- 3.20  Randle Logan at his desk, SBA Disaster Recovery HQ, Washington, D.C.
//   b  3.20- 8.40  video call: Chris Stallings on screen (speech bubbles)
//   c  8.40-11.16  the red MRV button under the desk ("CLICK!")
//   the road (the original intro, shifted by 11.16 s; the Disaster Recovery beacon is in the sky)
//   1  aerial over the Potomac, the beacon ignites      "SBA Disaster Recovery presents"
//   2  overhead avenue, light trails                     "Homeowners. Renters. Businesses. Nonprofits."
//   3  the van crosses Memorial Bridge
//   4  the Mall, Monument and Capitol                    "THE ROAD TO RECOVERY"
//   5  hands on the wheel, Capitol ahead
//   6  the driver in the SBA jacket over the city, the beacon overhead
import { registerCutscene } from "./cutscenes.js";
import { clamp, lerp, smooth, easeInOut } from "./util.js";
import { loadImg, kenBurns, title, film, fades, jacketPlate, beaconEmblem, drawBeacon, speechBubble, burst } from "./cine.js";

const P = 11.16, PA = 3.2, PB = 8.4, PRESS = 9.4;               // prologue cuts and the button press
const ROAD = [2.73, 5.52, 8.31, 11.10, 13.89].map(c => c + P);   // the original intro's cuts
const DUR = P + 16.9, CUTS = [PA, PB, P, ...ROAD];
const IMG = {};
const FILES = { desk: "shot0a-desk", call: "shot0b-call", button: "shot0c-button", aerial: "shot1-aerial", avenue: "shot2-avenue", bridge: "shot-bridge", mall: "shot3-mall", interior: "shot-interior", driver: "shot4-driver" };
// beacon placement per still: disk centre (u, v), radius r (fraction of image width), beam start (ou, ov)
const BEACON = {
  aerial:   { u: 0.77, v: 0.215, r: 0.080, ou: 0.80, ov: 0.43 },
  bridge:   { u: 0.28, v: 0.165, r: 0.072, ou: 0.15, ov: 0.31 },
  mall:     { u: 0.74, v: 0.17, r: 0.060, ou: 0.86, ov: 0.42 },
  interior: { u: 0.53, v: 0.22, r: 0.048, ou: 0.58, ov: 0.34 },
  driver:   { u: 0.73, v: 0.25, r: 0.078, ou: 0.84, ov: 0.62 },
};
const CALL_MOUTH = [0.278, 0.484];                               // Chris's mouth on the monitor, in the call still

function trails(ctx, v, lt) { // animated light trails over the avenue still
  if (!v) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    const lane = i % 2, ph = ((lt * (0.55 + (i % 5) * 0.08) + i * 0.137) % 1), off = (i % 6) * 0.012 - 0.03;
    const fx = lane ? ph : 1 - ph, ix = (0.05 + fx * 0.95) * 1920, iy = (0.98 - fx * 0.98) * 1071 + (lane ? 40 : -10) + off * 1071;
    const x = v.x + ix * v.s, y = v.y + iy * v.s, len = 70 * v.s * (1 + (i % 3));
    ctx.strokeStyle = lane ? "rgba(255,70,60,0.55)" : "rgba(255,245,225,0.6)"; ctx.lineWidth = 4 * v.s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (lane ? -1 : 1) * len, y + (lane ? 1 : -1) * len * 0.56); ctx.stroke();
  }
  ctx.restore();
}
export function driverShot(ctx, img, W, H, k, s) { // keeps the head clear of the letterbox
  if (!img) return null;
  const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight, z = lerp(1.0, 1.1, k), sc = Math.max(W / iw, (H * 0.9) / ih) * z;
  const dw = iw * sc, dh = ih * sc, x = clamp(W * 0.5 - lerp(0.5, 0.42, k) * dw, W - dw, 0), y = H * 0.105 - 8 * s - lerp(0, 0.05, k) * dh;
  ctx.drawImage(img, x, y, dw, dh);
  return { x, y, s: sc, iw, ih };
}

function render(ctx, t, W, H, game) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  const s = Math.min(W / 1280, H / 720), [C1, C2, C3, C4, C5] = ROAD;
  const lit = smooth(P + 0.1, P + 1.1, t);                      // the beacon switches on over the aerial
  let shake = 0;
  if (t < PA) {
    // a: Randle at his desk late at night
    kenBurns(ctx, IMG.desk, W, H, easeInOut(t / PA), [0.6, 0.5, 1.02], [0.64, 0.47, 1.12]);
    title(ctx, W, H, "SBA Disaster Recovery Headquarters", W * 0.06, H * 0.74, 36 * s, smooth(0.5, 1.0, t) * (1 - smooth(PA - 0.35, PA, t)), { color: "236,196,68" });
    title(ctx, W, H, "Washington, D.C.   •   11:47 PM", W * 0.06, H * 0.81, 26 * s, smooth(0.9, 1.4, t) * (1 - smooth(PA - 0.35, PA, t)), { color: "92,160,230" });
  } else if (t < PB) {
    // b: the video call. Chris's words appear in comic speech bubbles.
    const v = kenBurns(ctx, IMG.call, W, H, easeInOut((t - PA) / (PB - PA)), [0.45, 0.5, 1.02], [0.4, 0.5, 1.1]);
    if (v) {
      const tx = v.x + CALL_MOUTH[0] * v.iw * v.s + 40 * s, ty = v.y + CALL_MOUTH[1] * v.ih * v.s - 20 * s;
      const b1 = smooth(3.55, 3.75, t) * (1 - smooth(6.05, 6.2, t)), b2 = smooth(6.2, 6.4, t);
      speechBubble(ctx, W * 0.52, H * 0.27, W * 0.36, "There's a major situation. We have survivors in need of help.", tx, ty, s, b1, Math.floor((t - 3.6) * 40));
      speechBubble(ctx, W * 0.52, H * 0.25, W * 0.34, "Deploy the Mobile Recovery Team!", tx, ty, s, b2, Math.floor((t - 6.25) * 34));
    }
  } else if (t < P) {
    // c: the red MRV button under the desk
    const k = (t - PB) / (P - PB), hit = t - PRESS;
    shake = hit > 0 ? Math.max(0, 1 - hit / 0.6) * 9 * s : 0;
    ctx.save(); ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    const v = kenBurns(ctx, IMG.button, W, H, easeInOut(Math.min(1, k * 1.15)), [0.5, 0.5, 1.02], [0.62, 0.45, 1.28]);
    ctx.restore();
    if (hit > 0) {
      const red = Math.max(0, 1 - hit / 0.35) * 0.55 + (0.5 + 0.5 * Math.sin(hit * 12)) * 0.18;
      ctx.fillStyle = `rgba(230,30,40,${red})`; ctx.fillRect(0, 0, W, H);
      if (v) burst(ctx, v.x + 0.5 * v.iw * v.s, v.y + 0.22 * v.ih * v.s, 70 * s, "CLICK!", smooth(PRESS, PRESS + 0.12, t) * (1 - smooth(PRESS + 0.9, PRESS + 1.2, t)));
    }
  } else if (t < C1) {
    const v = kenBurns(ctx, IMG.aerial, W, H, easeInOut((t - P) / (C1 - P)), [0.5, 0.4, 1.1], [0.55, 0.47, 1.22]);
    drawBeacon(ctx, v, BEACON.aerial, lit, t, H * 0.105);
    if (t < P + 0.35) { ctx.fillStyle = `rgba(255,240,210,${0.6 * (1 - (t - P) / 0.35)})`; ctx.fillRect(0, 0, W, H); }   // the switch-on flash
    title(ctx, W, H, "SBA Disaster Recovery", W * 0.07, H * 0.7, 46 * s, smooth(P + 0.35, P + 0.9, t) * (1 - smooth(C1 - 0.4, C1 - 0.05, t)));
    title(ctx, W, H, "presents", W * 0.07, H * 0.78, 30 * s, smooth(P + 0.9, P + 1.4, t) * (1 - smooth(C1 - 0.4, C1 - 0.05, t)));
  } else if (t < C2) {
    const lt = t - C1, v = kenBurns(ctx, IMG.avenue, W, H, lt / (C2 - C1), [0.42, 0.6, 1.15], [0.58, 0.44, 1.35]);
    trails(ctx, v, lt);
    ["Homeowners.", "Renters.", "Businesses.", "Nonprofits."].forEach((wd, i) => { const t0 = C1 + 0.2 + i * 0.698; title(ctx, W, H, wd, W * 0.07, H * (0.28 + i * 0.1), 44 * s, smooth(t0, t0 + 0.15, t) * (1 - smooth(C2 - 0.3, C2, t))); });
  } else if (t < C3) {
    const v = kenBurns(ctx, IMG.bridge, W, H, easeInOut((t - C2) / (C3 - C2)), [0.36, 0.42, 1.2], [0.48, 0.46, 1.08]);
    drawBeacon(ctx, v, BEACON.bridge, 1, t, H * 0.105);
  } else if (t < C4) {
    const v = kenBurns(ctx, IMG.mall, W, H, easeInOut((t - C3) / (C4 - C3)), [0.5, 0.46, 1.0], [0.53, 0.42, 1.12]);
    drawBeacon(ctx, v, BEACON.mall, 1, t, H * 0.105);
    title(ctx, W, H, "THE ROAD TO RECOVERY", W / 2, H * 0.76, 74 * s, smooth(C3 + 0.3, C3 + 0.9, t) * (1 - smooth(C4 - 0.25, C4, t)), { align: "center", weight: "italic 900" });
  } else if (t < C5) {
    const v = kenBurns(ctx, IMG.interior, W, H, easeInOut((t - C4) / (C5 - C4)), [0.5, 0.5, 1.08], [0.56, 0.46, 1.2]);
    drawBeacon(ctx, v, BEACON.interior, 0.9, t, H * 0.105);
  } else {
    const v = driverShot(ctx, IMG.driverPlate || IMG.driver, W, H, easeInOut((t - C5) / (DUR - C5)), s);
    drawBeacon(ctx, v, BEACON.driver, 1, t, H * 0.105);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  film(ctx, W, H, t, true, game, DUR);
  fades(ctx, W, H, t, DUR, CUTS);
}

let loading = null;
registerCutscene("intro-dc", {
  duration: DUR, skippable: true, render,
  music: { url: "audio/intro-hq.m4a", fadeIn: 0.05, fadeOut: 0.6 },
  preload() {
    if (!loading) loading = Promise.all([...Object.entries(FILES).map(([k, f]) => loadImg("../game/art/intro/" + f + ".jpg").then(i => { IMG[k] = i; })), beaconEmblem()])
      .then(() => jacketPlate(IMG.driver, 0.5)).then(p => { if (p) IMG.driverPlate = p; });
    return loading;
  },
});
