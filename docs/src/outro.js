// ENDING CUTSCENE (16.9 s, same length as the intro), shown before the final
// score. Music: the outro of "Night Drive" by IamDayLight (166.3–183.2 s).
//   1  0.00–2.79  sunrise over a recovering main street   "Five stops. Five recoveries."
//   2  2.79–8.37  montage: the five restored stops from the game, one per beat
//   3  8.37–11.16 a baker turns the sign to OPEN           "Back in business."
//   4  11.16–16.9 the driver at sunrise over the coast town, closing line
import { registerCutscene } from "./cutscenes.js";
import { clamp, lerp, smooth, easeInOut, easeOut, fmtMoney } from "./util.js";
import { loadImg, kenBurns, title, film, fades, jacketPlate } from "./cine.js";
import { drawStorefront } from "./buildings.js";
import { pixelText } from "./pixelfont.js";
import { driverShot } from "./intro.js";

const DUR = 16.9, CUTS = [2.79, 8.37, 11.16], MONTAGE = [2.79, 8.37];
const IMG = {};

function montageBackdrop(ctx, W, H, s) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#5f86c4"); g.addColorStop(0.55, "#f2b788"); g.addColorStop(0.56, "#7da35c"); g.addColorStop(1, "#5c7f44");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(W * 0.78, H * 0.5, 0, W * 0.78, H * 0.5, H * 0.5); sun.addColorStop(0, "rgba(255,236,190,0.9)"); sun.addColorStop(1, "rgba(255,236,190,0)"); ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#8e9094"; ctx.fillRect(0, H * 0.73, W, H * 0.06);
}
function montagePanel(ctx, W, H, t, game, idx, k, s, slide) {
  const biz = game.cfg.businesses[idx];
  ctx.save(); ctx.translate(slide, 0);
  drawStorefront(ctx, biz, idx, W * 0.4, H * 0.75, (H / 720) * 0.62 * (1 + 0.05 * k), 1, t, { wind: 0.05 });
  ctx.restore();
  const a = Math.min(1, k * 5), tx = W * 0.94 + slide * 0.5;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(14,46,106,0.88)"; ctx.fillRect(tx - 430 * s, H * 0.19, 440 * s, 136 * s);
  ctx.fillStyle = "#ECC444"; ctx.fillRect(tx - 430 * s, H * 0.19, 6 * s, 136 * s);
  ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.round(27 * s)}px "Helvetica Neue",Helvetica,Arial,sans-serif`; ctx.textAlign = "right"; ctx.textBaseline = "top";
  ctx.fillText(biz.name, tx - 14 * s, H * 0.19 + 14 * s, 400 * s);
  pixelText(ctx, biz.type + "  \u2713 RESTORED", tx - 14 * s, H * 0.19 + 58 * s, Math.max(1, Math.round(3 * s)), "#7fd39a", { align: "right" });
  pixelText(ctx, fmtMoney(biz.amount) + "*", tx - 14 * s, H * 0.19 + 88 * s, Math.max(1, Math.round(4 * s)), "#ECC444", { align: "right" });
  ctx.restore();
  ctx.lineWidth = 10 * s; ctx.strokeStyle = "#0a0a0a"; ctx.strokeRect(W * 0.03, H * 0.12, W * 0.94, H * 0.76);
}

function render(ctx, t, W, H, game) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  const s = Math.min(W / 1280, H / 720), [C1, C2, C3] = CUTS;
  if (t < C1) {
    kenBurns(ctx, IMG.dawn, W, H, easeInOut(t / C1), [0.5, 0.55, 1.15], [0.45, 0.5, 1.02]);
    title(ctx, W, H, "Five stops.", W * 0.07, H * 0.7, 46 * s, smooth(0.4, 0.8, t) * (1 - smooth(2.4, 2.75, t)), { color: "236,160,60" });
    title(ctx, W, H, "Five recoveries.", W * 0.07, H * 0.79, 46 * s, smooth(1.2, 1.6, t) * (1 - smooth(2.4, 2.75, t)), { color: "236,160,60" });
  } else if (t < C2) {
    const n = game.cfg.businesses.length, seg = (C2 - C1) / n, i = Math.min(n - 1, Math.floor((t - C1) / seg)), k = ((t - C1) - i * seg) / seg;
    montageBackdrop(ctx, W, H, s);
    const slide = (1 - easeOut(Math.min(1, k * 4))) * W * 0.3;
    montagePanel(ctx, W, H, t, game, i, k, s, slide);
    if (k < 0.08) { ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - k / 0.08)})`; ctx.fillRect(0, 0, W, H); }
    pixelText(ctx, "* hypothetical amounts", W * 0.92, H * 0.83, Math.max(1, Math.round(2 * s)), "rgba(14,46,106,0.8)", { align: "right" });
  } else if (t < C3) {
    kenBurns(ctx, IMG.open, W, H, easeInOut((t - C2) / (C3 - C2)), [0.58, 0.45, 1.05], [0.66, 0.42, 1.22]);
    title(ctx, W, H, "Back in business.", W * 0.07, H * 0.76, 48 * s, smooth(C2 + 0.4, C2 + 0.9, t) * (1 - smooth(C3 - 0.3, C3, t)), { color: "236,160,60" });
  } else {
    const k = easeInOut((t - C3) / (DUR - C3));
    driverShot(ctx, IMG.driverPlate || IMG.driver, W, H, k, s);
    const a = smooth(C3 + 1.0, C3 + 1.8, t) * (1 - smooth(DUR - 0.8, DUR - 0.3, t));
    title(ctx, W, H, "Helping you Recover, One Step at a Time.", W * 0.95, H * 0.66, 34 * s, a, { align: "right", color: "236,160,60" });
    title(ctx, W, H, "SBA Disaster Recovery  •  SBA.gov/disaster", W * 0.95, H * 0.73, 22 * s, smooth(C3 + 2.0, C3 + 2.6, t) * (1 - smooth(DUR - 0.8, DUR - 0.3, t)), { align: "right", color: "92,160,230", weight: "600" });
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  film(ctx, W, H, t, true, game, DUR);
  fades(ctx, W, H, t, DUR, CUTS);
}

let loading = null;
registerCutscene("ending-dawn", {
  duration: DUR, skippable: true, render,
  music: { url: "audio/outro-night-drive.mp4", fadeIn: 0.4, fadeOut: 1.2 },
  preload() {
    if (!loading) loading = Promise.all([["dawn", "end-dawn"], ["open", "end-open"], ["driver", "end-driver"]].map(([k, f]) => loadImg("art/ending/" + f + ".jpg").then(i => { IMG[k] = i; })))
      .then(() => jacketPlate(IMG.driver, 0.45)).then(p => { if (p) IMG.driverPlate = p; });
    return loading;
  },
});
