// INTRO CUTSCENE (16.9 s): neo-noir driving-film opening, told with bold inked
// illustrations (art/intro). Music "Night Drive" by IamDayLight, 1.6–18.5 s;
// the beat kicks in at 2.73 s and every cut lands on a bar (2.79 s per bar).
//   1  0.00–2.73  aerial over the Potomac          "SBA Disaster Recovery presents"
//   2  2.73–5.52  overhead avenue, light trails    "Homeowners. Renters. Businesses. Nonprofits."
//   3  5.52–8.31  the van crosses Memorial Bridge
//   4  8.31–11.10 the Mall, Monument and Capitol   "THE ROAD TO RECOVERY"
//   5  11.10–13.89 hands on the wheel, Capitol ahead
//   6  13.89–16.90 the driver in the SBA jacket over the city
import { registerCutscene } from "./cutscenes.js";
import { clamp, lerp, smooth, easeInOut } from "./util.js";
import { loadImg, kenBurns, title, film, fades, jacketPlate } from "./cine.js";

const DUR = 16.9, CUTS = [2.73, 5.52, 8.31, 11.10, 13.89];
const IMG = {};
const FILES = { aerial: "shot1-aerial", avenue: "shot2-avenue", bridge: "shot-bridge", mall: "shot3-mall", interior: "shot-interior", driver: "shot4-driver" };

function trails(ctx, v, lt, dir) { // animated light trails over the avenue still
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
  if (!img) return;
  const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight, z = lerp(1.0, 1.1, k), sc = Math.max(W / iw, (H * 0.9) / ih) * z;
  const dw = iw * sc, dh = ih * sc, x = clamp(W * 0.5 - lerp(0.5, 0.42, k) * dw, W - dw, 0), y = H * 0.105 - 8 * s - lerp(0, 0.05, k) * dh;
  ctx.drawImage(img, x, y, dw, dh);
}

function render(ctx, t, W, H, game) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  const s = Math.min(W / 1280, H / 720), [C1, C2, C3, C4, C5] = CUTS;
  if (t < C1) {
    kenBurns(ctx, IMG.aerial, W, H, easeInOut(t / C1), [0.45, 0.62, 1.12], [0.55, 0.5, 1.28]);
    title(ctx, W, H, "SBA Disaster Recovery", W * 0.07, H * 0.7, 46 * s, smooth(0.35, 0.9, t) * (1 - smooth(2.3, 2.65, t)));
    title(ctx, W, H, "presents", W * 0.07, H * 0.78, 30 * s, smooth(0.9, 1.4, t) * (1 - smooth(2.3, 2.65, t)));
  } else if (t < C2) {
    const lt = t - C1, v = kenBurns(ctx, IMG.avenue, W, H, lt / (C2 - C1), [0.42, 0.6, 1.15], [0.58, 0.44, 1.35]);
    trails(ctx, v, lt);
    ["Homeowners.", "Renters.", "Businesses.", "Nonprofits."].forEach((wd, i) => { const t0 = C1 + 0.2 + i * 0.698; title(ctx, W, H, wd, W * 0.07, H * (0.28 + i * 0.1), 44 * s, smooth(t0, t0 + 0.15, t) * (1 - smooth(C2 - 0.3, C2, t))); });
  } else if (t < C3) {
    kenBurns(ctx, IMG.bridge, W, H, easeInOut((t - C2) / (C3 - C2)), [0.36, 0.62, 1.25], [0.5, 0.5, 1.08]);
  } else if (t < C4) {
    kenBurns(ctx, IMG.mall, W, H, easeInOut((t - C3) / (C4 - C3)), [0.5, 0.46, 1.0], [0.53, 0.42, 1.12]);
    title(ctx, W, H, "THE ROAD TO RECOVERY", W / 2, H * 0.76, 74 * s, smooth(C3 + 0.3, C3 + 0.9, t) * (1 - smooth(C4 - 0.25, C4, t)), { align: "center", weight: "italic 700" });
  } else if (t < C5) {
    const k = (t - C4) / (C5 - C4);
    kenBurns(ctx, IMG.interior, W, H, easeInOut(k), [0.5, 0.5, 1.08], [0.56, 0.46, 1.2]);
    // gentle road vibration
    ctx.translate(0, 0);
  } else {
    driverShot(ctx, IMG.driverPlate || IMG.driver, W, H, easeInOut((t - C5) / (DUR - C5)), s);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  film(ctx, W, H, t, true, game, DUR);
  fades(ctx, W, H, t, DUR, CUTS);
}

let loading = null;
registerCutscene("intro-dc", {
  duration: DUR, skippable: true, render,
  music: { url: "audio/intro-night-drive.m4a", fadeIn: 0.05, fadeOut: 0.6 },
  preload() {
    if (!loading) loading = Promise.all(Object.entries(FILES).map(([k, f]) => loadImg("../game/art/intro/" + f + ".jpg").then(i => { IMG[k] = i; })))
      .then(() => jacketPlate(IMG.driver, 0.5)).then(p => { if (p) IMG.driverPlate = p; });
    return loading;
  },
});
