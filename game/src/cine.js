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
  return { x, y, s: cover, iw, ih };
}
// Cutscene titles: heavy type with a dark outline under the neon glow, so they read on any frame.
export function title(ctx, W, H, text, x, y, size, a, opts = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = opts.align || "left"; ctx.textBaseline = "middle";
  const weight = (opts.weight || "italic 800").replace(/\b[1-7]00\b/, "800");
  ctx.font = `${weight} ${size}px "Helvetica Neue",Helvetica,Arial,sans-serif`;
  const col = opts.color || "236,72,96";
  ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2, size * 0.12); ctx.strokeStyle = "rgba(4,8,20,0.85)"; ctx.strokeText(text, x, y);
  ctx.shadowColor = `rgba(${col},0.95)`; ctx.shadowBlur = size * 0.4; ctx.fillStyle = `rgba(${col},1)`; ctx.fillText(text, x, y);
  ctx.shadowBlur = 0; ctx.fillStyle = opts.fill || "rgba(255,240,244,1)"; ctx.fillText(text, x, y);
  ctx.restore();
}

// ---------------------------------------------------------------- Disaster Recovery beacon
// A searchlight in the night sky carrying the "DISASTER RECOVERY" lettering, cut from the
// van's official rear artwork (not redrawn) and shown as a dark silhouette in the light,
// the way a classic hero signal works.
let emblem = null;
export async function beaconEmblem() {
  if (emblem) return emblem;
  const art = await loadImg("../assets/mrv-van/generated/mrv-van-04-rear-B.png"); if (!art) return null;
  const sx = 780, sy = 512, sw = 440, sh = 185;            // the lettering on the red door panel
  const c = document.createElement("canvas"); c.width = sw; c.height = sh; const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(art, sx, sy, sw, sh, 0, 0, sw, sh);
  const d = g.getImageData(0, 0, sw, sh), a = d.data; let x0 = sw, x1 = 0, y0 = sh, y1 = 0;
  for (let i = 0; i < a.length; i += 4) { const lo = Math.min(a[i], a[i + 1], a[i + 2]), k = clamp((lo - 150) / 70, 0, 1);
    a[i] = 10; a[i + 1] = 26; a[i + 2] = 60; a[i + 3] = Math.round(255 * k);
    if (k > 0.5) { const p = i / 4, x = p % sw, y = (p / sw) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  g.putImageData(d, 0, 0);
  const t = document.createElement("canvas"); t.width = x1 - x0 + 1; t.height = y1 - y0 + 1; t.getContext("2d").drawImage(c, -x0, -y0);
  emblem = t; return emblem;
}
// v: {x, y, s, iw, ih} image-to-screen transform; b: {u, v, r, ou, ov} in image fractions
// (r = disk radius as a fraction of image width; ou/ov = where the beam starts); a = 0..1 strength.
export function drawBeacon(ctx, v, b, a, t, minY = 0) {
  if (!v || a <= 0) return;
  const P = (u, w) => [v.x + u * v.iw * v.s, v.y + w * v.ih * v.s];
  const [cx, cy0] = P(b.u, b.v), [ox, oy] = P(b.ou, b.ov), R = b.r * v.iw * v.s, ry = R * 0.62;
  const cy = Math.max(cy0, minY + ry * 1.12);                 // keep the whole light below the letterbox on any screen shape
  const fl = a * (0.93 + 0.07 * Math.sin(t * 23) * Math.sin(t * 7.3));
  const ang = Math.atan2(cy - oy, cx - ox), nx = -Math.sin(ang), ny = Math.cos(ang), w0 = R * 0.12;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const gb = ctx.createLinearGradient(ox, oy, cx, cy); gb.addColorStop(0, `rgba(255,236,190,${0.55 * fl})`); gb.addColorStop(1, `rgba(255,236,190,${0.12 * fl})`);
  ctx.fillStyle = gb; ctx.beginPath(); ctx.moveTo(ox + nx * w0, oy + ny * w0); ctx.lineTo(cx + nx * R * 0.9, cy + ny * ry * 0.9); ctx.lineTo(cx - nx * R * 0.9, cy - ny * ry * 0.9); ctx.lineTo(ox - nx * w0, oy - ny * w0); ctx.closePath(); ctx.fill();
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.9); halo.addColorStop(0, `rgba(255,230,170,${0.35 * fl})`); halo.addColorStop(1, "rgba(255,230,170,0)");
  ctx.fillStyle = halo; ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.9, ry * 1.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save();
  const gd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R); gd.addColorStop(0, `rgba(255,250,228,${0.95 * fl})`); gd.addColorStop(0.75, `rgba(255,238,184,${0.85 * fl})`); gd.addColorStop(1, `rgba(255,214,130,${0.35 * fl})`);
  ctx.fillStyle = gd; ctx.beginPath(); ctx.ellipse(cx, cy, R, ry, 0, 0, Math.PI * 2); ctx.fill();
  if (emblem) { const ew = R * 1.62, eh = ew * emblem.height / emblem.width * 0.8; ctx.globalAlpha = 0.97 * fl; ctx.drawImage(emblem, cx - ew / 2, cy - eh / 2, ew, eh); }   // lettering squashed a little to sit in the tilted disk
  ctx.restore();
}

// ---------------------------------------------------------------- comic speech bubble
// Wrapped, heavy uppercase lettering on a white bubble with an ink outline; the tail
// points at (tx, ty). `k` (0..1) is the pop-in, `chars` limits the typed-out letters.
export function speechBubble(ctx, cx, cy, maxW, text, tx, ty, s, k, chars = 1e9) {
  if (k <= 0) return;
  const fs = Math.round(30 * s), lh = fs * 1.18, font = `900 ${fs}px "Helvetica Neue",Helvetica,Arial,sans-serif`;
  ctx.save(); ctx.font = font;
  const words = text.toUpperCase().split(" "), lines = []; let cur = "";
  for (const w of words) { const tt = cur ? cur + " " + w : w; if (ctx.measureText(tt).width > maxW - 40 * s && cur) { lines.push(cur); cur = w; } else cur = tt; }
  if (cur) lines.push(cur);
  const bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 48 * s, bh = lines.length * lh + 34 * s;
  const sc = 0.6 + 0.4 * k; ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy); ctx.globalAlpha = Math.min(1, k * 1.5);
  const x = cx - bw / 2, y = cy - bh / 2, r = Math.min(bh / 2, 26 * s);
  const path = () => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + bw, y, x + bw, y + bh, r); ctx.arcTo(x + bw, y + bh, x, y + bh, r); ctx.arcTo(x, y + bh, x, y, r); ctx.arcTo(x, y, x + bw, y, r); ctx.closePath(); };
  // tail (drawn first so the bubble's outline covers its base)
  const bx = clamp(tx, x + r, x + bw - r), by = ty > cy ? y + bh - 2 : y + 2, half = 16 * s;
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#0a0a12"; ctx.lineWidth = 4 * s; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(bx - half, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + half, by); ctx.closePath(); ctx.fill(); ctx.stroke();
  path(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.fillRect(bx - half + 3 * s, by - 6 * s, half * 2 - 6 * s, 10 * s);
  ctx.fillStyle = "#0a0a12"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = font;
  let left = chars; lines.forEach((l, i) => { if (left <= 0) return; ctx.fillText(l.slice(0, left), cx - (ctx.measureText(l).width - ctx.measureText(l.slice(0, left)).width) / 2, y + 17 * s + lh * (i + 0.5)); left -= l.length + 1; });
  ctx.restore();
}
// Comic sound-effect burst ("CLICK!") centred at (x, y).
export function burst(ctx, x, y, size, text, k) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12); const sc = 0.5 + 0.5 * Math.min(1, k * 2.2); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, k * 3);
  ctx.beginPath(); for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, rr = (i % 2 ? 0.62 : 1) * size; ctx.lineTo(Math.cos(a) * rr * 1.35, Math.sin(a) * rr); } ctx.closePath();
  ctx.fillStyle = "#ffd23a"; ctx.fill(); ctx.lineWidth = size * 0.06; ctx.strokeStyle = "#0a0a12"; ctx.stroke();
  ctx.font = `900 italic ${Math.round(size * 0.62)}px "Helvetica Neue",Helvetica,Arial,sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = size * 0.08; ctx.strokeStyle = "#0a0a12"; ctx.strokeText(text, 0, size * 0.04); ctx.fillStyle = "#e3262d"; ctx.fillText(text, 0, size * 0.04);
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
  if (game && t > 1.2 && t < dur - 0.6) { const s = Math.min(W / 1280, H / 720); ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = `800 ${Math.round(15 * s)}px Helvetica, Arial`; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(game.mobile ? "TAP TO SKIP" : "ENTER TO SKIP", W - 20 * s, H - bar / 2); }
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
  const logo = await loadImg("../assets/mrv-van/generated/mrv-van-04-rear-B.png"); if (!logo) return null;
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
