// Shared cutscene tools: image loading, slow camera moves over stills, neon
// titles, film grain/letterbox, and the SBA jacket print compositor.
import { clamp, lerp } from "./util.js";
import { resolveAsset } from "./assets.js";

export function loadImg(path) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = resolveAsset(path); }); }

// Draw `img` covering the frame, moving from [cx, cy, zoom] to [cx, cy, zoom].
export function kenBurns(ctx, img, W, H, k, from, to) {
  if (!img) { ctx.fillStyle = "#040c24"; ctx.fillRect(0, 0, W, H); return null; }
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const cx = lerp(from[0], to[0], k), cy = lerp(from[1], to[1], k), z = lerp(from[2], to[2], k);
  const cover = Math.max(W / iw, H / ih) * z, dw = iw * cover, dh = ih * cover;
  const x = clamp(W / 2 - cx * dw, W - dw, 0), y = clamp(H / 2 - cy * dh, H - dh, 0);
  ctx.drawImage(img, x, y, dw, dh);
  return { x, y, s: cover };
}
export function title(ctx, W, H, text, x, y, size, a, opts = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = opts.align || "left"; ctx.textBaseline = "middle";
  ctx.font = `${opts.weight || "italic 300"} ${size}px "Helvetica Neue",Helvetica,Arial,sans-serif`;
  const col = opts.color || "236,72,96";
  ctx.shadowColor = `rgba(${col},0.95)`; ctx.shadowBlur = size * 0.45; ctx.fillStyle = `rgba(${col},1)`; ctx.fillText(text, x, y);
  ctx.shadowBlur = 0; ctx.fillStyle = opts.fill || "rgba(255,236,240,0.95)"; ctx.fillText(text, x, y);
  ctx.restore();
}
let grain = null;
export function film(ctx, W, H, t, bars = true, game = null, dur = 0) {
  if (!grain) { grain = document.createElement("canvas"); grain.width = grain.height = 256; const g = grain.getContext("2d"), d = g.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 18; } g.putImageData(d, 0, 0); }
  ctx.save(); ctx.globalCompositeOperation = "overlay"; const ox = (t * 977) % 256, oy = (t * 613) % 256;
  ctx.fillStyle = ctx.createPattern(grain, "repeat"); ctx.translate(-ox, -oy); ctx.fillRect(ox, oy, W, H); ctx.restore();
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.5)"); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const bar = H * 0.105;
  if (bars) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar); }
  if (game && t > 1.2 && t < dur - 0.6) { const s = Math.min(W / 1280, H / 720); ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = `600 ${Math.round(14 * s)}px Helvetica, Arial`; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(game.mobile ? "TAP TO SKIP" : "ENTER TO SKIP", W - 20 * s, H - bar / 2); }
  return bar;
}
export function fades(ctx, W, H, t, dur, cuts) {
  const cutFlash = cuts.reduce((m, c) => Math.max(m, 1 - Math.abs(t - c) / 0.07), 0);
  const f = Math.max(1 - Math.min(1, t / 0.7), Math.min(1, Math.max(0, (t - (dur - 0.6)) / 0.6)), cutFlash * 0.55);
  if (f > 0) { ctx.fillStyle = `rgba(0,0,0,${f})`; ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- SBA jacket print
// Finds the royal-blue jacket in the left part of the image, measures its back
// (shoulder line to hem, left to right edge, spine centre), and prints the SBA
// lockup (cropped from the van's rear art, not redrawn) plus "OFFICE OF
// DISASTER RECOVERY" centred on it, shaded by the fabric's own folds.
let logoCut = null;
async function logoCanvas() {
  if (logoCut) return logoCut;
  const logo = await loadImg("assets/mrv-van/generated/mrv-van-04-rear-B.png"); if (!logo) return null;
  const lc = document.createElement("canvas"); lc.width = 372; lc.height = 360; const lg = lc.getContext("2d", { willReadFrequently: true });
  lg.drawImage(logo, 270, 478, 372, 360, 0, 0, 372, 360);
  const d = lg.getImageData(0, 0, 372, 360), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const r = a[i], g = a[i + 1], b = a[i + 2], white = Math.min(r, g, b), red = r - Math.max(g, b);
    const keep = Math.max(white > 140 ? (white - 140) / 90 : 0, red > 90 ? (red - 90) / 80 : 0); a[i + 3] = Math.round(255 * clamp(keep, 0, 1));
    if (red > 90) { a[i] = 225; a[i + 1] = 40; a[i + 2] = 48; } else { a[i] = a[i + 1] = a[i + 2] = 250; } }
  lg.putImageData(d, 0, 0); logoCut = lc; return lc;
}
export async function jacketPlate(img, searchRight = 0.5) {
  if (!img) return null;
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const sw = Math.floor(W * searchRight), data = g.getImageData(0, 0, sw, H).data;
  const isJacket = (i) => { const r = data[i], gg = data[i + 1], b = data[i + 2]; return b > 95 && b > r + 45 && b > gg + 20; };
  const rows = []; let maxW = 0;
  for (let y = 0; y < H; y += 2) { let a = -1, b = -1, n = 0; for (let x = 0; x < sw; x += 2) if (isJacket((y * sw + x) * 4)) { if (a < 0) a = x; b = x; n++; } const w = n * 2; rows.push({ y, a, b, w }); if (w > maxW) maxW = w; }
  // Measure the jacket the same way in every painting: collar line, hem, and chest width
  // (arms included). The print is sized and placed from those, using proportions taken
  // from the intro's approved shot, so the intro and ending prints match.
  const spans = rows.filter(r => r.a >= 0).map(r => ({ y: r.y, a: r.a, b: r.b, s: r.b - r.a }));
  if (spans.length < 10) return c;
  const sorted = spans.map(r => r.s).sort((p, q) => p - q), maxS = sorted[Math.floor(sorted.length * 0.9)];   // ignores stray wide rows
  const collar = spans.find(r => r.s >= maxS * 0.15);
  let hemRow = null, inBody = false;                           // hem: where the jacket body ends, before trousers or ground
  for (const r of spans) { if (!collar || r.y < collar.y) continue; if (r.s >= maxS * 0.6) { inBody = true; hemRow = r; } else if (inBody && r.s < maxS * 0.5) break; }
  if (!collar || !hemRow || hemRow.y - collar.y < 40) return c;
  const top = collar.y, bot = hemRow.y;
  const chest = spans.filter(r => r.y > top + (bot - top) * 0.45 && r.y < top + (bot - top) * 0.75).sort((p, q) => p.s - q.s);
  const mid = chest[Math.floor(chest.length / 2)], chestW = mid.s;
  const cx = chest.map(r => (r.a + r.b) / 2).sort((p, q) => p - q)[Math.floor(chest.length / 2)];
  const PRINT_W = 0.83, PRINT_TOP = 0.089;
  const pw = Math.round(chestW * PRINT_W), ph = Math.round(pw * 0.95), px = Math.round(cx - pw / 2), py = Math.round(top + chestW * PRINT_TOP);
  const p = document.createElement("canvas"); p.width = pw; p.height = ph; const pg = p.getContext("2d", { willReadFrequently: true });
  const lc = await logoCanvas(), u = pw / 360;
  if (lc) pg.drawImage(lc, pw / 2 - 92 * u, 4 * u, 184 * u, 178 * u);
  pg.fillStyle = "#fafafa"; pg.textAlign = "center"; pg.textBaseline = "alphabetic";
  pg.font = `700 ${Math.round(22 * u)}px "Helvetica Neue",Helvetica,Arial,sans-serif`; pg.fillText("OFFICE OF", pw / 2, 218 * u);
  pg.font = `900 ${Math.round(40 * u)}px "Helvetica Neue",Helvetica,Arial,sans-serif`; pg.fillText("DISASTER", pw / 2, 260 * u); pg.fillText("RECOVERY", pw / 2, 300 * u);
  const under = g.getImageData(px, py, pw, ph).data, pd = pg.getImageData(0, 0, pw, ph), pa = pd.data;
  let sum = 0, n = 0; for (let i = 0; i < under.length; i += 4) { if (under[i + 2] > under[i] + 40) { sum += under[i] * 0.3 + under[i + 1] * 0.59 + under[i + 2] * 0.11; n++; } }
  const avg = n ? sum / n : 80;
  for (let i = 0; i < pa.length; i += 4) { if (!pa[i + 3]) continue; const l = under[i] * 0.3 + under[i + 1] * 0.59 + under[i + 2] * 0.11, k = clamp(l / avg, 0.5, 1.12);
    pa[i] = Math.min(255, pa[i] * k * 0.96 + under[i] * 0.04); pa[i + 1] = Math.min(255, pa[i + 1] * k * 0.96 + under[i + 1] * 0.04); pa[i + 2] = Math.min(255, pa[i + 2] * k * 0.96 + under[i + 2] * 0.06); pa[i + 3] = Math.round(pa[i + 3] * 0.93); }
  pg.putImageData(pd, 0, 0);
  for (let x = 0; x < pw; x += 2) { const dy = Math.pow((x - pw / 2) / (pw / 2), 2) * 5 * u; g.drawImage(p, x, 0, 2, ph, px + x, py + dy, 2, ph); }
  c.jacket = { cx, top, bot, px, py, pw, ph };
  return c;
}
