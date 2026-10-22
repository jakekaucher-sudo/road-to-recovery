// Loads the real van artwork (never modified on disk), removes the white page
// background by flood fill from the image border, trims to the van, and
// measures light positions so effects line up with the art.
import { CONFIG } from "../config.js";

export const ART = { errors: [] };

function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("could not load " + url));
    img.src = url;
  });
}

async function loadAny(url) {
  if (!url.endsWith(".svg")) { const img = await loadImage(url); return { img, w: img.naturalWidth, h: img.naturalHeight }; }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  const txt = await r.text();
  const m = txt.match(/<svg[^>]*>/); if (!m) throw new Error("not an SVG: " + url);
  const wa = /\swidth="([\d.]+)"/.exec(m[0]), ha = /\sheight="([\d.]+)"/.exec(m[0]);
  const img = await loadImage(URL.createObjectURL(new Blob([txt], { type: "image/svg+xml" })));
  return { img, w: wa ? +wa[1] : img.naturalWidth || 2000, h: ha ? +ha[1] : img.naturalHeight || 1339 };
}

function keyOut(canvas, tol = 16) {
  const W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d", { willReadFrequently: true });
  const id = ctx.getImageData(0, 0, W, H), d = id.data;
  const bg = (k) => { const i = k * 4; return d[i] >= 255 - tol && d[i + 1] >= 255 - tol && d[i + 2] >= 255 - tol; };
  const seen = new Uint8Array(W * H), st = [];
  const push = (k) => { if (!seen[k] && bg(k)) { seen[k] = 1; st.push(k); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (st.length) { const k = st.pop(), x = k % W; if (x > 0) push(k - 1); if (x < W - 1) push(k + 1); if (k >= W) push(k - W); if (k < W * (H - 1)) push(k + W); }
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let k = 0; k < W * H; k++) {
    if (seen[k]) { d[k * 4 + 3] = 0; continue; }
    const x = k % W, y = (k / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  // soften the rim: light anti-aliased edge pixels become partly transparent
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const k = y * W + x; if (seen[k]) continue;
    if (seen[k - 1] || seen[k + 1] || seen[k - W] || seen[k + W]) {
      const i = k * 4, lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      if (lum > 140) { d[i + 3] = Math.round(255 * Math.max(0, (255 - lum) / 115)); d[i] = d[i + 1] = 30; d[i + 2] = 40; }
    }
  }
  ctx.putImageData(id, 0, 0);
  return { x0, y0, x1, y1 };
}

// Rasterize + key + trim to a sprite no wider than maxW.
const CONFIG_URL = new URL("../config.js", import.meta.url);
export const resolveAsset = (p) => new URL(p, CONFIG_URL).href;
async function makeSprite(url, maxW) {
  url = resolveAsset(url);
  const { img, w, h } = await loadAny(url);
  const s0 = Math.min(1, 900 / w);
  const c0 = document.createElement("canvas"); c0.width = Math.round(w * s0); c0.height = Math.round(h * s0);
  c0.getContext("2d").drawImage(img, 0, 0, c0.width, c0.height);
  const bb = keyOut(c0);
  if (bb.x1 < 0) throw new Error("no artwork found in " + url);
  const sx = bb.x0 / s0, sy = bb.y0 / s0, sw = (bb.x1 - bb.x0 + 1) / s0, sh = (bb.y1 - bb.y0 + 1) / s0;
  const scale = Math.min(1.6, maxW / sw);
  const c = document.createElement("canvas"); c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
  c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  keyOut(c);
  return { canvas: c, w: c.width, h: c.height, url };
}

// Find red light clusters in the left and right fifths of a rear sprite.
function findTaillights(sp) {
  const { canvas: c, w: W, h: H } = sp;
  const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const acc = [[0, 0, 0], [0, 0, 0]];
  let top = [0, 0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (d[i + 3] < 200 || d[i] < 180 || d[i + 1] > 80 || d[i + 2] > 80) continue;
    if (x < W * 0.2 && y > H * 0.3 && y < H * 0.75) { acc[0][0] += x; acc[0][1] += y; acc[0][2]++; }
    else if (x > W * 0.8 && y > H * 0.3 && y < H * 0.75) { acc[1][0] += x; acc[1][1] += y; acc[1][2]++; }
    else if (y < H * 0.2 && x > W * 0.35 && x < W * 0.65) { top[0] += x; top[1] += y; top[2]++; }
  }
  const pt = (a, fb) => a[2] > 20 ? [a[0] / a[2] / W, a[1] / a[2] / H] : fb;
  return { left: pt(acc[0], [0.11, 0.55]), right: pt(acc[1], [0.89, 0.55]), top: pt(top, [0.5, 0.12]) };
}

export async function loadArt(progress, mobile) {
  const v = CONFIG.van;
  const jobs = [
    ["rear", v.rear, mobile ? 520 : 760],
    ["driver", v.driverSide, mobile ? 700 : 1000],
    ["passenger", v.passengerSide, mobile ? 700 : 1000],
    ["hero", v.hero, mobile ? 900 : 1200],
    ["front", v.front, mobile ? 600 : 900],
  ];
  for (const [name, url, maxW] of jobs) {
    try { progress && progress(name); ART[name] = await makeSprite(url, maxW); }
    catch (e) { ART.errors.push(`${name}: ${e.message}`); console.error(e); }
  }
  if (ART.rear) ART.rear.lights = findTaillights(ART.rear);
  // optional: precompute a dark "night" version of the side panels for yaw shading
  for (const k of ["driver", "passenger"]) if (ART[k]) {
    const s = ART[k], c = document.createElement("canvas"); c.width = s.w; c.height = s.h;
    const g = c.getContext("2d"); g.drawImage(s.canvas, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(4,12,36,0.45)"; g.fillRect(0, 0, s.w, s.h);
    s.shaded = c;
  }
  ART.ok = !!ART.rear;
  return ART;
}
