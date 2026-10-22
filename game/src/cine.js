// Shared cutscene tools: image loading, slow camera moves over stills, neon
// titles, film grain/letterbox, and the SBA jacket print compositor.
import { clamp, lerp } from "./util.js";
import { resolveAsset } from "./assets.js";
import { INPUT } from "./input.js";

export function loadImg(path) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = resolveAsset(path); }); }

// Draw `img` covering the frame, moving from [cx, cy, zoom] to [cx, cy, zoom].
// `topSlack` lets the still sit up to that many pixels lower than the screen top; the gap is
// hidden behind the cinematic letterbox, which buys sky room for things near the image's top edge.
export function kenBurns(ctx, img, W, H, k, from, to, topSlack = 0) {
  if (!img) { ctx.fillStyle = "#040c24"; ctx.fillRect(0, 0, W, H); return null; }
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const cx = lerp(from[0], to[0], k), cy = lerp(from[1], to[1], k), z = lerp(from[2], to[2], k);
  const cover = Math.max(W / iw, H / ih) * z, dw = iw * cover, dh = ih * cover;
  const x = clamp(W / 2 - cx * dw, W - dw, 0), y = clamp(H / 2 - cy * dh, H - dh, topSlack);
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
// The searchlight and the lit cloud oval are painted into the stills (art/intro, see README).
// Here the "DISASTER RECOVERY" lettering, cut from the official logo file (not redrawn), is laid
// into that oval as the stencil's shadow: dark navy, multiplied into the lit cloud so the cloud
// texture shows through, foreshortened with the oval and softly focused like a real projection.
let emblem = null;
export async function beaconEmblem() {
  if (emblem) return emblem;
  const art = await loadImg("../assets/brand/disaster-recovery-logo.png"); if (!art) return null;
  const sx = 222, sy = 155, sw = 292, sh = 112;              // just the big white "DISASTER RECOVERY"
  const c = document.createElement("canvas"); c.width = sw; c.height = sh; const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(art, sx, sy, sw, sh, 0, 0, sw, sh);
  const d = g.getImageData(0, 0, sw, sh), a = d.data; let x0 = sw, x1 = 0, y0 = sh, y1 = 0;
  for (let i = 0; i < a.length; i += 4) { const k = clamp((Math.min(a[i], a[i + 1], a[i + 2]) - 150) / 80, 0, 1);
    a[i] = 18; a[i + 1] = 30; a[i + 2] = 64; a[i + 3] = Math.round(255 * k);
    if (k > 0.5) { const p = i / 4, x = p % sw, y = (p / sw) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  g.putImageData(d, 0, 0);
  // trim, then soften slightly (half-size and back) so the edges look projected, not printed
  const tw = x1 - x0 + 1, th = y1 - y0 + 1, half = document.createElement("canvas"); half.width = Math.ceil(tw * 0.55); half.height = Math.ceil(th * 0.55);
  half.getContext("2d").drawImage(c, x0, y0, tw, th, 0, 0, half.width, half.height);
  const t = document.createElement("canvas"); t.width = tw * 2; t.height = th * 2; const tg = t.getContext("2d"); tg.imageSmoothingQuality = "high"; tg.drawImage(half, 0, 0, t.width, t.height);
  emblem = t; return emblem;
}
// Soft, tileable cloud texture (value-noise fbm), gray 0.55..1 for multiplying over light.
let clouds = null, lay = null;
function cloudTexture() {
  if (clouds) return clouds;
  const W = 512, H = 128, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"), img = g.createImageData(W, H);
  const rnd = (x, y, o) => { const n = Math.sin(x * 127.1 + y * 311.7 + o * 74.7) * 43758.5453; return n - Math.floor(n); };
  const noise = (x, y, o, period) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const r = (a, b) => rnd(((a % period) + period) % period, b, o);
    return (r(xi, yi) * (1 - sx) + r(xi + 1, yi) * sx) * (1 - sy) + (r(xi, yi + 1) * (1 - sx) + r(xi + 1, yi + 1) * sx) * sy; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0, amp = 0.55, f = 1 / 64, norm = 0;
    for (let o = 0; o < 5; o++) { v += amp * noise(x * f, y * f * 1.6, o, Math.round(W * f)); norm += amp; amp *= 0.5; f *= 2; }
    v = v / norm; const k = Math.min(1, Math.max(0, (v - 0.32) * 1.9));            // patchy wisps
    const g8 = Math.round(255 * (0.68 + 0.32 * (1 - k))), i = (y * W + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = g8; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); clouds = c; return c;
}
// v: {x, y, s, iw, ih} from kenBurns/driverShot. E: the painted oval, fitted by dev/beacon-fit.html
// (u, v centre; a semi-axis as a fraction of image width; b of height; ang tilt) plus the beam's
// source (su, sv). k = 0..1 strength. Draws drifting cloud through the light, then the lettering
// as a see-through stencil shadow, leaning and narrowing toward the lamp like a real projection.
export function projectLogo(ctx, v, E, k, t) {
  if (!v || !E || k <= 0) return;
  const P = (u, w) => [v.x + u * v.iw * v.s, v.y + w * v.ih * v.s];
  const [cx, cy] = P(E.u, E.v), [sx, sy] = P(E.su ?? E.u, E.sv ?? E.v + 0.4), A = E.a * v.iw * v.s, B = E.b * v.ih * v.s;
  const tex = cloudTexture(), drift = (t * 18) % 256;
  ctx.save(); ctx.globalCompositeOperation = "multiply";
  // 1) haze and dust in the beam: a cloud streak stretched along the light, strongest near the clouds
  const bx = cx - sx, by = cy - sy, blen = Math.hypot(bx, by), bang = Math.atan2(by, bx), nx = -by / blen, ny = bx / blen;
  ctx.save(); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(cx + nx * A * 0.95, cy + ny * A * 0.95); ctx.lineTo(cx - nx * A * 0.95, cy - ny * A * 0.95); ctx.closePath(); ctx.clip();
  ctx.translate(sx, sy); ctx.rotate(bang); ctx.globalAlpha = 0.3 * k;
  ctx.drawImage(tex, drift, 0, 256, 128, 0, -A, blen * 1.05, A * 2);
  ctx.restore();
  // 2) clouds drifting through the lit oval, feathered toward its edge
  ctx.translate(cx, cy); ctx.rotate(E.ang || 0);
  for (const [f, al] of [[1.06, 0.2], [0.88, 0.25], [0.65, 0.25]]) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, A * f, B * f, 0, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = al * k; ctx.drawImage(tex, drift * 1.3, 0, 256, 128, -A * 1.1, -B * 1.15, A * 2.2, B * 2.3); ctx.restore();
  }
  // 3) the lettering: natural proportions, fitted inside the oval, see-through so the cloud shows
  if (emblem) {
    const asp = emblem.width / emblem.height; let tw = A * 2 * 0.74, th = tw / asp * 0.94;
    if (th > B * 2 * 0.62) { th = B * 2 * 0.62; tw = th * asp / 0.94; }
    // lean toward the lamp (shear) and narrow on the side nearest it (keystone), drawn in strips
    const lx = Math.cos(-(E.ang || 0)) * (sx - cx) - Math.sin(-(E.ang || 0)) * (sy - cy), ly = Math.sin(-(E.ang || 0)) * (sx - cx) + Math.cos(-(E.ang || 0)) * (sy - cy);
    const shear = Math.max(-0.3, Math.min(0.3, (lx / Math.max(1, Math.abs(ly))) * 0.3)), taper = 0.12, N = 18, ew = emblem.width, eh = emblem.height;
    // compose the keystoned lettering once at full strength, then lay it in at partial opacity
    const pw = Math.ceil(tw * (1 + taper) + Math.abs(shear) * th + 4), ph = Math.ceil(th + 2);
    if (!lay || lay.width < pw || lay.height < ph) { lay = document.createElement("canvas"); lay.width = Math.max(pw, 64); lay.height = Math.max(ph, 32); }
    const lg = lay.getContext("2d"); lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, lay.width, lay.height); lg.imageSmoothingQuality = "high";
    for (let i = 0; i < N; i++) {
      const y0 = th * i / N, yc = y0 + th / (2 * N) - th / 2, wk = 1 + taper * (0.5 - (i + 0.5) / N) * Math.sign(ly || 1);
      lg.drawImage(emblem, 0, eh * i / N, ew, eh / N + 1, pw / 2 - tw * wk / 2 + shear * yc, y0, tw * wk, th / N + 1);
    }
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, A * 0.97, B * 0.97, 0, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = k * (0.62 + 0.04 * Math.sin(t * 17) * Math.sin(t * 5.3));
    ctx.drawImage(lay, 0, 0, pw, ph, -pw / 2, -th / 2, pw, ph);
    ctx.restore();
  }
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
  if (game && t > 1.2 && t < dur - 0.6) { const s = Math.min(W / 1280, H / 720); ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = `800 ${Math.round(15 * s)}px Helvetica, Arial`; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(INPUT.pad.connected ? "A TO SKIP" : game.mobile ? "TAP TO SKIP" : "ENTER TO SKIP", W - 20 * s, H - bar / 2); }
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
