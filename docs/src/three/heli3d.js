// The SBA escort helicopter: a UH-60 Black Hawk built at load time in the Mobile Recovery
// Vehicle's paint scheme. Real proportions in metres: nose toward -Z (like the van), ground at
// y = 0 under the wheels, origin on the rotor mast.
//  * the fuselage, transmission fairing, engines and exhausts are smooth lofts through
//    measured cross-sections; the tail fin and stabilator are true airfoils
//  * paint is drawn onto two side canvases (one per side, so lettering always reads the right
//    way) and projected across the airframe from the side, so stripes wrap over the top
//  * the SBA mark and "DISASTER RECOVERY" are cut from the van's official rear artwork,
//    never redrawn
//  * windows are curved glass panels that follow the skin
import * as THREE from "three";
import { resolveAsset } from "../assets.js";
import { glowTexture } from "./textures.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const NAVY = "#1C3D73", RED = "#CD2127", WHITE = "#F3F5F7", TRIM = "#4A4E51", FRAME = "#15181c";
const MAST = 5.2;                                   // rotor mast station: metres back from the nose tip
const S0 = -0.3, S1 = 16.3, Y0 = 0, Y1 = 4.6;       // the area the side paint covers (station s, height y)
const REAR_ART = "assets/mrv-van/generated/mrv-van-04-rear-B.png";

// ---- cross-sections: [station, bottom y, top y, half width, squareness (2 round .. 4 boxy), centre x]
const HULL = [
  [0.00, 1.02, 1.26, 0.10, 2.4], [0.30, 0.84, 1.46, 0.44, 2.9], [0.85, 0.69, 1.66, 0.72, 3.3],
  [1.40, 0.61, 1.80, 0.92, 3.5], [1.80, 0.57, 1.86, 1.02, 3.5], [2.10, 0.54, 2.18, 1.09, 3.5],   // nose, then the steep windscreen
  [2.42, 0.52, 2.45, 1.12, 3.6], [2.85, 0.51, 2.52, 1.15, 3.8], [4.00, 0.50, 2.54, 1.18, 3.9],
  [6.60, 0.50, 2.54, 1.18, 3.9], [7.20, 0.57, 2.52, 1.12, 3.6], [7.80, 0.92, 2.46, 0.92, 3.1],   // cabin, then up into the boom
  [8.40, 1.30, 2.38, 0.62, 2.7], [9.20, 1.50, 2.30, 0.42, 2.5], [12.8, 1.56, 2.05, 0.30, 2.4],
  [13.8, 1.58, 2.00, 0.27, 2.4], [14.6, 1.62, 1.98, 0.22, 2.4], [14.95, 1.70, 1.92, 0.10, 2.2],
];
const FAIRING = [                                   // transmission "doghouse" on the roof
  [2.40, 1.85, 2.48, 0.50, 3.0], [3.15, 1.85, 2.86, 0.72, 3.2], [4.10, 1.85, 3.14, 0.80, 3.4],
  [6.70, 1.85, 3.14, 0.80, 3.4], [7.60, 1.85, 2.98, 0.72, 3.2], [8.60, 1.85, 2.62, 0.50, 3.0],
  [9.40, 1.85, 2.34, 0.34, 2.6],
];
const ENG_Y = 2.84, HUB_Y = 3.69;
const engine = (sx) => [[4.35, .24], [4.5, .31], [4.85, .34], [6.9, .34], [7.35, .31], [7.6, .27]].map(([s, r]) => [s, ENG_Y - r, ENG_Y + r, r, 2, sx * 0.98]);
const exhaust = (sx) => [[7.45, 2.64, 3.06, .22, 2.6, sx * 0.98], [8.0, 2.68, 3.10, .22, 2.6, sx * 1.14], [8.5, 2.74, 3.14, .2, 2.6, sx * 1.32]];
// tail fin (pylon): leading / trailing edge at its root and tip, and thickness
const FIN = { y0: 1.75, y1: 3.95, le0: 13.3, te0: 15.0, le1: 14.75, te1: 15.6, t0: 0.30, t1: 0.20 };
const TAIL_ROTOR = { s: 15.05, y: 3.6, x: 0.36, r: 1.68, cant: 20 * Math.PI / 180 };
const STAB = { s0: 14.55, s1: 15.6, y: 1.82, span: 2.2, t: 0.11 };

// ---- smooth monotone interpolation through the stations (no overshoot between them)
function pchip(xs, ys) {
  const n = xs.length, h = [], d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}
function makeLoft(rows, tumble = 0) {
  const xs = rows.map(r => r[0]), f = [1, 2, 3, 4, 5].map(k => pchip(xs, rows.map(r => r[k] ?? 0)));
  const at = (s) => { const y0 = f[0](s), y1 = f[1](s); return { s, y0, y1, cy: (y0 + y1) / 2, hh: (y1 - y0) / 2, hw: f[2](s), n: f[3](s), xc: f[4](s), tumble }; };
  return { at, s0: xs[0], s1: xs[xs.length - 1] };
}
// point on a section at angle th (0 = top, increasing toward +x / the right side)
function secPt(sec, th) {
  const e = 2 / sec.n, sn = Math.sin(th), c = Math.cos(th);
  const sx = Math.sign(sn) * Math.pow(Math.abs(sn), e), sy = Math.sign(c) * Math.pow(Math.abs(c), e);
  const k = sy > 0 ? 1 - sec.tumble * sy * sy : 1;  // sides lean in toward the roof
  return [sec.xc + sec.hw * sx * k, sec.cy + sec.hh * sy];
}
// angle on one side of a section at height y (side: -1 left, +1 right)
function thetaAt(sec, y, side) {
  const c = Math.max(-0.999, Math.min(0.999, (y - sec.cy) / sec.hh)), cos = Math.sign(c) * Math.pow(Math.abs(c), sec.n / 2), th = Math.acos(cos);
  return side > 0 ? th : -th;
}
const U = (s) => (s - S0) / (S1 - S0), V = (y) => (y - Y0) / (Y1 - Y0);

// A closed skin through the loft, with rounded end caps. Triangles left of the centre line use
// material 0 (left paint), the rest material 1 (right paint).
function loftGeo(loft, ds, N, caps = [true, true]) {
  const ss = []; for (let s = loft.s0; s < loft.s1 - 1e-6; s += ds) ss.push(s); ss.push(loft.s1);
  const P = [], UV = [], left = [], right = [];
  for (const s of ss) { const sec = loft.at(s); for (let k = 0; k < N; k++) { const [x, y] = secPt(sec, k / N * Math.PI * 2); P.push(x, y, s - MAST); UV.push(U(s), V(y)); } }
  const tri = (a, b, c) => { const cx = P[a * 3] + P[b * 3] + P[c * 3]; (cx < 0 ? left : right).push(a, b, c); };
  for (let i = 0; i < ss.length - 1; i++) for (let k = 0; k < N; k++) {
    const a = i * N + k, b = i * N + (k + 1) % N, c = (i + 1) * N + k, d = (i + 1) * N + (k + 1) % N;
    tri(a, c, b); tri(b, c, d);
  }
  [[0, -1], [ss.length - 1, 1]].forEach(([i, dir], ci) => {
    if (!caps[ci]) return;
    const sec = loft.at(ss[i]), ctr = P.length / 3; P.push(sec.xc, sec.cy, ss[i] - MAST + dir * Math.min(0.06, sec.hw * 0.5)); UV.push(U(ss[i]), V(sec.cy));
    for (let k = 0; k < N; k++) { const a = i * N + k, b = i * N + (k + 1) % N; dir < 0 ? tri(ctr, a, b) : tri(ctr, b, a); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex([...left, ...right]); g.addGroup(0, left.length, 0); g.addGroup(left.length, right.length, 1);
  g.computeVertexNormals(); return g;
}
// A curved panel lying on the skin. corners: 4 [s, q] in order (front-low, rear-low, rear-high,
// front-high); q is a height on one side (mode "side") or an angle around the section ("theta").
function skinPatch(loft, corners, mode, side, off, nu = 10, nv = 8) {
  const P = [], UV = [], I = [];
  const bil = (a, b, k) => (1 - a) * (1 - b) * corners[0][k] + a * (1 - b) * corners[1][k] + a * b * corners[2][k] + (1 - a) * b * corners[3][k];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const a = i / nu, b = j / nv, s = bil(a, b, 0), q = bil(a, b, 1), sec = loft.at(s), th = mode === "side" ? thetaAt(sec, q, side) : q;
    const [x, y] = secPt(sec, th), [xa, ya] = secPt(sec, th - 0.01), [xb, yb] = secPt(sec, th + 0.01);
    let nx = yb - ya, ny = -(xb - xa); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (nx * (x - sec.xc) + ny * (y - sec.cy) < 0) { nx = -nx; ny = -ny; }
    P.push(x + nx * off, y + ny * off, s - MAST); UV.push(side < 0 ? 1 - a : a, b);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; I.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
  g.computeVertexNormals(); return g;
}
// Symmetric airfoil half-thickness at chord fraction c (NACA 00xx form, closed trailing edge).
const naca = (c) => 5 * (0.2969 * Math.sqrt(c) - 0.126 * c - 0.3516 * c * c + 0.2843 * c * c * c - 0.1036 * c * c * c * c);
// A swept airfoil surface between two edges. sec(t) -> { le, te, th, pos(sChord, off) -> [x, y, s] }.
function wingGeo(sec, M, K, uvOf) {
  const P = [], UV = [], CO = [], left = [], right = [], ring = 2 * K;
  for (let j = 0; j <= M; j++) {
    const S = sec(j / M);
    for (let k = 0; k < ring; k++) {
      const up = k < K, c = up ? (1 - Math.cos(Math.PI * (K - k) / K)) / 2 : (1 - Math.cos(Math.PI * (k - K) / K)) / 2;
      const [x, y, s] = S.pos(c, (up ? 1 : -1) * S.th * naca(c));
      P.push(x, y, s - MAST); const uv = uvOf(x, y, s); UV.push(uv[0], uv[1]); CO.push(...(S.color ? S.color(c) : [1, 1, 1]));
    }
  }
  const tri = (a, b, c) => { const cx = P[a * 3] + P[b * 3] + P[c * 3]; (cx < 0 ? left : right).push(a, b, c); };
  for (let j = 0; j < M; j++) for (let k = 0; k < ring; k++) { const a = j * ring + k, b = j * ring + (k + 1) % ring, c = a + ring, d = b + ring; tri(a, b, c); tri(b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(CO, 3));
  g.setIndex([...left, ...right]); g.addGroup(0, left.length, 0); g.addGroup(left.length, right.length, 1);
  g.computeVertexNormals(); return g;
}

// ---- official markings, cut from the van's rear artwork and keyed off their background
function loadImage(path) { return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = resolveAsset(path); }); }
function keyed(img, sx, sy, sw, sh, keepRed) {
  const c = document.createElement("canvas"); c.width = sw; c.height = sh; const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const d = g.getImageData(0, 0, sw, sh), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i], gg = a[i + 1], b = a[i + 2], white = Math.min(r, gg, b), red = r - Math.max(gg, b);
    const kw = Math.max(0, Math.min(1, (white - 140) / 90)), kr = keepRed ? Math.max(0, Math.min(1, (red - 90) / 80)) : 0;
    a[i + 3] = Math.round(255 * Math.max(kw, kr));
    if (kr > kw) { a[i] = 205; a[i + 1] = 33; a[i + 2] = 39; } else { a[i] = a[i + 1] = a[i + 2] = 246; }
  }
  g.putImageData(d, 0, 0); return c;
}
// tight box around the visible pixels of a keyed cut, optionally limited to a row band
function bounds(c, y0 = 0, y1 = c.height) {
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, x1 = -1, t = 1e9, b = -1;
  for (let y = y0; y < y1; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < t) t = y; if (y > b) b = y; }
  return x1 < 0 ? null : { x: x0, y: t, w: x1 - x0 + 1, h: b - t + 1 };
}
function crop(c, r) { const o = document.createElement("canvas"); o.width = r.w; o.height = r.h; o.getContext("2d").drawImage(c, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); return o; }
export async function heliDecals() {
  const art = await loadImage(REAR_ART); if (!art) return {};
  const sbaCut = keyed(art, 270, 478, 372, 360, true), sba = crop(sbaCut, bounds(sbaCut));
  // "DISASTER" and "RECOVERY" set on one line, as a tail-boom title
  const dr = keyed(art, 785, 515, 430, 180, false), rows = [];
  { const d = dr.getContext("2d").getImageData(0, 0, dr.width, dr.height).data;
    for (let y = 0; y < dr.height; y++) { let n = 0; for (let x = 0; x < dr.width; x++) if (d[(y * dr.width + x) * 4 + 3] > 40) n++; rows.push(n > 2); } }
  const bands = []; let st = -1; rows.forEach((on, y) => { if (on && st < 0) st = y; if ((!on || y === rows.length - 1) && st >= 0) { if (y - st > 20) bands.push([st, y]); st = -1; } });
  let title = null;
  if (bands.length >= 2) {
    const w1 = crop(dr, bounds(dr, bands[0][0], bands[0][1] + 1)), w2 = crop(dr, bounds(dr, bands[1][0], bands[1][1] + 1));
    const h = Math.max(w1.height, w2.height), gap = Math.round(h * 0.42); title = document.createElement("canvas"); title.width = w1.width + gap + w2.width; title.height = h;
    const g = title.getContext("2d"); g.drawImage(w1, 0, (h - w1.height) / 2, w1.width, w1.height); g.drawImage(w2, w1.width + gap, (h - w2.height) / 2, w2.width, w2.height);
  }
  return { sba, title };
}

// ---- the paint, drawn in metres (station s across, height y up) on each side's canvas
function catmull(pts, n = 16) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
  }
  out.push(pts[pts.length - 1]); return out;
}
// band between two offsets from a path (offsets measured to the right of the direction of travel)
function band(ctx, path, a, b, taper = 0) {
  const n = path.length, nrm = path.map((p, i) => { const q0 = path[Math.max(0, i - 1)], q1 = path[Math.min(n - 1, i + 1)], dx = q1[0] - q0[0], dy = q1[1] - q0[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; });
  const k = (i) => taper ? Math.min(1, i / (n * taper)) : 1;
  ctx.beginPath();
  for (let i = 0; i < n; i++) ctx.lineTo(path[i][0] + nrm[i][0] * a * k(i), path[i][1] + nrm[i][1] * a * k(i));
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(path[i][0] + nrm[i][0] * b * k(i), path[i][1] + nrm[i][1] * b * k(i));
  ctx.closePath(); ctx.fill();
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function rrectPath(ctx, x0, y0, x1, y1, r) {
  ctx.beginPath(); ctx.moveTo(x0 + r, y0); ctx.lineTo(x1 - r, y0); ctx.quadraticCurveTo(x1, y0, x1, y0 + r); ctx.lineTo(x1, y1 - r); ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
  ctx.lineTo(x0 + r, y1); ctx.quadraticCurveTo(x0, y1, x0, y1 - r); ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0); ctx.closePath();
}
// side windows: [front-low, rear-low, rear-high, front-high] as [s, y]
const SIDE_WINDOWS = [
  [[2.66, 1.50], [3.82, 1.50], [3.82, 2.28], [2.72, 2.28]],   // cockpit door
  [[2.00, 1.86], [2.56, 1.86], [2.56, 2.24], [2.18, 2.06]],   // windscreen quarter light
  [[1.00, 0.76], [1.88, 0.64], [1.88, 1.06], [1.00, 1.06]],   // chin window
  [[4.98, 1.88], [6.05, 1.88], [6.05, 2.30], [4.98, 2.30]],   // cabin door
];
const SBA_DOOR = [4.95, 5.95, 0.84];                // cabin-door SBA mark: s from, s to, bottom y
const SBA_FIN = [14.2, 15.0, 2.22];
const TITLE = { s0: 9.1, s1: 12.0, h: 0.27 };        // "DISASTER RECOVERY" along the tail boom

function paintSide(W, H, mirror, hull, decals) {
  const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d");
  const kx = W / (S1 - S0), ky = H / (Y1 - Y0);
  ctx.setTransform(mirror ? -kx : kx, 0, 0, -ky, mirror ? W + S0 * kx : -S0 * kx, H + Y0 * ky);
  const at = (s) => hull.at(Math.max(hull.s0, Math.min(hull.s1, s)));
  const trimTop = (s) => { const q = at(s); return q.y0 + 0.3 * smooth(1.2, 2.2, s) * (1 - smooth(7.0, 8.2, s)); };
  const bandTop = (s) => { const q = at(s); return q.cy + 0.62 * q.hh; }, bandBot = (s) => { const q = at(s); return q.cy - 0.62 * q.hh; };
  const upper = (s) => lerp(at(s).y1 - 0.05, bandTop(s), smooth(7.6, 9.2, s)), lower = (s) => lerp(trimTop(s), bandBot(s), smooth(7.0, 9.2, s));
  ctx.fillStyle = NAVY; ctx.fillRect(S0 - 1, Y0 - 1, S1 - S0 + 2, Y1 - Y0 + 2);
  // grey lower body, as on the van
  ctx.fillStyle = TRIM; ctx.beginPath(); ctx.moveTo(0, -1);
  for (let s = 0; s <= 9; s += 0.05) ctx.lineTo(s, trimTop(s)); ctx.lineTo(9, -1); ctx.closePath(); ctx.fill();
  // red sweep behind the cockpit, edged in white (the van's front swoosh)
  const sw = catmull([[1.85, 1.5], [2.3, 1.32], [3.0, 1.28], [3.55, 1.32], [3.9, 1.5], [4.06, 1.86], [4.14, 2.22], [4.18, 2.6]]);   // ends at the roofline
  ctx.fillStyle = WHITE; band(ctx, sw, 0, 0.13, 0.15); ctx.fillStyle = RED; band(ctx, sw, 0.13, 0.43, 0.15); ctx.fillStyle = WHITE; band(ctx, sw, 0.43, 0.48, 0.15);
  // the big red wave from the aft cabin into a red band down the tail boom
  const front = catmull([[6.5, 0.6], [6.72, 1.55], [6.95, 2.2], [7.12, 2.58]]), END = 14.45;
  ctx.fillStyle = RED; ctx.beginPath();
  front.forEach(p => ctx.lineTo(p[0], p[1]));
  for (let s = 7.12; s <= END; s += 0.05) ctx.lineTo(s, upper(s));
  ctx.lineTo(END + 0.25, at(END).cy);
  for (let s = END; s >= 6.5; s -= 0.05) ctx.lineTo(s, lower(s));
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = WHITE; band(ctx, front, 0, 0.14);
  ctx.strokeStyle = WHITE; ctx.lineWidth = 0.035;
  for (const f of [upper, lower]) { ctx.beginPath(); for (let s = f === upper ? 7.15 : 6.6; s <= END; s += 0.05) ctx.lineTo(s, f(s) + (f === upper ? 0.03 : -0.03)); ctx.stroke(); }
  // panel lines, door seams, rivets, steps, exhaust soot
  ctx.strokeStyle = "rgba(6,12,24,0.55)"; ctx.lineWidth = 0.014;
  rrectPath(ctx, 2.62, 0.98, 3.92, 2.42, 0.12); ctx.stroke();                     // cockpit door
  rrectPath(ctx, 4.7, 0.8, 6.5, 2.42, 0.06); ctx.stroke();                       // sliding cabin door
  ctx.beginPath(); ctx.moveTo(4.7, 2.47); ctx.lineTo(7.3, 2.47); ctx.stroke();   // door track
  for (const s of [1.86, 7.05, 8.7, 11.0, 13.25]) { const q = at(s); ctx.beginPath(); ctx.moveTo(s, q.y0 - 0.1); ctx.lineTo(s, q.y1 + 0.1); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(3.1, 2.82); ctx.lineTo(8.2, 2.82); ctx.stroke();
  for (const s of [4.4, 5.9, 7.45]) { ctx.beginPath(); ctx.moveTo(s, 2.56); ctx.lineTo(s, 3.16); ctx.stroke(); }
  rrectPath(ctx, 0.55, 1.22, 1.25, 1.58, 0.05); ctx.stroke();                     // nose avionics door
  ctx.fillStyle = "rgba(6,12,24,0.45)";
  for (let s = 2.75; s < 6.9; s += 0.11) { ctx.fillRect(s, 0.93, 0.018, 0.018); ctx.fillRect(s, 2.36, 0.018, 0.018); }
  for (const [s, y] of [[3.05, 0.86], [3.35, 1.12], [4.85, 0.86]]) { ctx.fillStyle = "#101418"; ctx.fillRect(s, y, 0.16, 0.06); }
  ctx.fillStyle = "#5a6068"; ctx.fillRect(4.78, 1.45, 0.16, 0.035);                // door handle
  const soot = ctx.createLinearGradient(7.7, 0, 9.4, 0); soot.addColorStop(0, "rgba(10,10,12,0.55)"); soot.addColorStop(1, "rgba(10,10,12,0)");
  ctx.fillStyle = soot; ctx.fillRect(7.7, 2.44, 1.7, 0.55);
  // official markings (drawn unmirrored so they read correctly on both sides)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const X = (s) => mirror ? W - (s - S0) * kx : (s - S0) * kx, Yp = (y) => H - (y - Y0) * ky;
  const place = (img, s0, s1, yb) => { if (!img) return; const w = (s1 - s0) * kx, h = w * img.height / img.width; ctx.drawImage(img, Math.min(X(s0), X(s1)), Yp(yb) - h, w, h); };
  place(decals.sba, ...SBA_DOOR); place(decals.sba, ...SBA_FIN);
  if (decals.title) {
    const sa = TITLE.s0, sb = TITLE.s1, ya = at(sa).cy, yb = at(sb).cy, len = Math.hypot((sb - sa) * kx, (yb - ya) * ky), h = TITLE.h * ky, w = h * decals.title.width / decals.title.height;
    const ang = Math.atan2((mirror ? 1 : -1) * (yb - ya) * ky, (sb - sa) * kx);
    ctx.save(); ctx.translate((X(sa) + X(sb)) / 2, (Yp(ya) + Yp(yb)) / 2); ctx.rotate(ang);
    const k = Math.min(1, len / w); ctx.drawImage(decals.title, -w * k / 2, -h * k / 2, w * k, h * k); ctx.restore();
  }
  return c;
}

// ---- small parts
function rod(a, b, r, mat, seg = 10) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
}
const Z = (s) => s - MAST;
function bladeGeo(R, chord, root, tipSweep, thick) {
  // one main-rotor blade along +x, leading edge toward -z (the rotor turns anticlockwise from above)
  const st = [[0.0, 0.16, 0.16], [root, 0.30, 0.22], [root + 0.35, chord, 0.11], [R - 0.62, chord, 0.1], [R - 0.3, chord * 0.86, 0.09], [R, chord * 0.42, 0.08]];
  const K = 9, ring = 2 * K, P = [], CO = [], I = [];
  st.forEach(([r, c, t]) => {
    const sweep = Math.max(0, r - (R - 0.62)) * Math.tan(tipSweep), tw = -0.12 * r / R;     // swept tip, washout
    const col = r > R - 0.32 ? [0.92, 0.93, 0.95] : r > R - 0.55 ? [0.62, 0.02, 0.03] : [0.022, 0.024, 0.027];
    for (let k = 0; k < ring; k++) {
      const up = k < K, cc = up ? (1 - Math.cos(Math.PI * (K - k) / K)) / 2 : (1 - Math.cos(Math.PI * (k - K) / K)) / 2;
      const zc = -c * 0.25 + cc * c + sweep, y = (up ? 1 : -1) * c * t * naca(cc) * (r < root ? 2.2 : 1);
      const zr = zc * Math.cos(tw) - y * Math.sin(tw), yr = zc * Math.sin(tw) + y * Math.cos(tw);
      P.push(r, yr, zr); CO.push(...col);
    }
  });
  for (let j = 0; j < st.length - 1; j++) for (let k = 0; k < ring; k++) { const a = j * ring + k, b = j * ring + (k + 1) % ring, c = a + ring, d = b + ring; I.push(a, c, b, b, c, d); }
  const tip = P.length / 3, last = (st.length - 1) * ring; let tx = 0, ty = 0, tz = 0; for (let k = 0; k < ring; k++) { tx += P[(last + k) * 3]; ty += P[(last + k) * 3 + 1]; tz += P[(last + k) * 3 + 2]; }
  P.push(tx / ring + 0.03, ty / ring, tz / ring); CO.push(0.92, 0.93, 0.95); for (let k = 0; k < ring; k++) I.push(last + k, tip, last + (k + 1) % ring);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(CO, 3)); g.setIndex(I); g.computeVertexNormals(); return g;
}
function discTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), r = 128;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, "rgba(30,32,36,0)"); gr.addColorStop(0.12, "rgba(30,32,36,0)"); gr.addColorStop(0.16, "rgba(30,32,36,0.55)");
  gr.addColorStop(0.9, "rgba(30,32,36,0.45)"); gr.addColorStop(0.935, "rgba(200,40,45,0.6)"); gr.addColorStop(0.96, "rgba(240,242,245,0.9)"); gr.addColorStop(1, "rgba(240,242,245,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function roundedMask() {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, 128, 128); g.fillStyle = "#fff"; rrectPath(g, 4, 4, 124, 124, 22); g.fill();
  return new THREE.CanvasTexture(c);
}

// One draw per material: every mesh under `group` that does not move on its own is baked into a
// merged mesh (multi-material skins are split by side first). Keeps the escort cheap on phones.
function mergeStatic(group, skip = () => false) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), buckets = new Map(), done = [];
  group.traverse(o => {
    if (!o.isMesh || skip(o)) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), multi = Array.isArray(o.material);
    const parts = multi ? o.geometry.groups.map(gr => [gr, o.material[gr.materialIndex]]) : [[null, o.material]];
    for (const [gr, m] of parts) {
      const g = o.geometry.clone(); if (gr) g.setIndex(Array.from(o.geometry.index.array.slice(gr.start, gr.start + gr.count))); g.clearGroups();
      if (!m.vertexColors) g.deleteAttribute("color");
      g.applyMatrix4(rel); if (!buckets.has(m)) buckets.set(m, []); buckets.get(m).push(g);
    }
    done.push(o);
  });
  for (const o of done) { o.parent.remove(o); o.geometry.dispose(); }
  for (const [m, geos] of buckets) { const g = mergeGeometries(geos, false); geos.forEach(x => x.dispose()); if (g) { const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; group.add(mesh); } else console.warn("helicopter: could not merge", m.type); }
}

export async function buildHeli(quality = {}) {
  const high = !!quality.high, decals = await heliDecals();
  const hull = makeLoft(HULL, 0.09), fairing = makeLoft(FAIRING);
  // paint
  const PW = high ? 3072 : 1536, PH = Math.round(PW * (Y1 - Y0) / (S1 - S0));
  const tex = (mirror) => { const t = new THREE.CanvasTexture(paintSide(PW, PH, mirror, hull, decals)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (mirror) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; } return t; };
  const Std = THREE.MeshStandardMaterial, Pho = THREE.MeshPhongMaterial;
  const paintMat = (map) => high ? new Std({ map, roughness: 0.34, metalness: 0.22 }) : new Pho({ map, shininess: 70, specular: 0x3a3a3a });
  const paints = [paintMat(tex(false)), paintMat(tex(true))];
  const mat = (color, rough = 0.6, metal = 0.3, extra = {}) => high ? new Std({ color, roughness: rough, metalness: metal, ...extra }) : new Pho({ color, shininess: Math.round((1 - rough) * 90), specular: 0x2a2a2a, ...extra });
  const trim = mat(0x2b2f33, 0.55, 0.45), black = mat(0x08090b, 0.8, 0.1), metal = mat(0x9aa0a7, 0.3, 0.85), rubber = mat(0x0d0e10, 0.9, 0);
  const navyPaint = high ? new Std({ vertexColors: true, roughness: 0.34, metalness: 0.22 }) : new Pho({ vertexColors: true, shininess: 70, specular: 0x3a3a3a });
  const mask = roundedMask();
  const glass = high ? new Std({ color: 0x1b2b3d, roughness: 0.03, metalness: 0.82, envMapIntensity: 1.8, alphaMap: mask, alphaTest: 0.5, side: THREE.DoubleSide })
                     : new Pho({ color: 0x1e3046, shininess: 140, specular: 0xb4c8e0, alphaMap: mask, alphaTest: 0.5, side: THREE.DoubleSide });
  const gasket = high ? new Std({ color: 0x0c0e11, roughness: 0.7, metalness: 0.1, alphaMap: mask, alphaTest: 0.5, side: THREE.DoubleSide })
                      : new Pho({ color: 0x0c0e11, shininess: 10, alphaMap: mask, alphaTest: 0.5, side: THREE.DoubleSide });

  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const add = (m, parent = body) => { parent.add(m); return m; };
  // ---- airframe
  add(new THREE.Mesh(loftGeo(hull, high ? 0.08 : 0.16, high ? 72 : 40), paints));
  add(new THREE.Mesh(loftGeo(fairing, 0.12, high ? 48 : 28), paints));
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(loftGeo(makeLoft(engine(sx)), 0.1, 28, [false, true]), paints));
    const ex = add(new THREE.Mesh(loftGeo(makeLoft(exhaust(sx)), 0.1, 20, [false, false]), trim));
    const hole = add(new THREE.Mesh(new THREE.CircleGeometry(0.19, 20), black)); hole.position.set(sx * 1.32, 2.94, Z(8.5) + 0.01); hole.lookAt(sx * 1.32 + sx * 0.6, 2.99, Z(8.5) + 1.4);
    const intake = add(new THREE.Mesh(new THREE.CircleGeometry(0.235, 24), black)); intake.position.set(sx * 0.98, ENG_Y, Z(4.35) - 0.005); intake.rotation.y = Math.PI;
    const spin = add(new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.2, 16), metal)); spin.position.set(sx * 0.98, ENG_Y, Z(4.35) + 0.02); spin.rotation.x = -Math.PI / 2;
    ex.castShadow = true;
  }
  // tail fin with its airfoil, painted from the same side canvases
  const finSec = (t) => {
    const y = lerp(FIN.y0, FIN.y1, t), le = lerp(FIN.le0, FIN.le1, t), te = lerp(FIN.te0, FIN.te1, t);
    return { th: lerp(FIN.t0, FIN.t1, t), pos: (c, off) => [off, y, le + (te - le) * c] };
  };
  const uvSide = (x, y, s) => [U(s), V(y)];
  add(new THREE.Mesh(wingGeo(finSec, 10, 14, uvSide), paints));
  const finTip = add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x0d2350, 0.34, 0.22)));
  finTip.scale.set(FIN.t1 * 0.48, 0.12, (FIN.te1 - FIN.le1) * 0.5); finTip.position.set(0, FIN.y1, Z((FIN.le1 + FIN.te1) / 2));
  // stabilator: navy, white tips with a red band
  const stabSec = (t) => {
    const x = lerp(-STAB.span, STAB.span, t), tip = Math.abs(x) / STAB.span, ch = (STAB.s1 - STAB.s0) * (1 - 0.18 * tip), s0 = STAB.s0 + 0.12 * tip;
    const col = tip > 0.9 ? [0.9, 0.91, 0.93] : tip > 0.84 ? [0.62, 0.03, 0.04] : [0.011, 0.045, 0.17];
    return { th: STAB.t * (1 - 0.3 * tip), color: () => col, pos: (c, off) => [x, STAB.y + off, s0 + ch * c] };
  };
  add(new THREE.Mesh(wingGeo(stabSec, 24, 12, uvSide), navyPaint));
  // ---- glass
  // each pane sits on a slightly larger dark rubber gasket
  const grow = (c, ds, dq) => [[c[0][0] - ds, c[0][1] - dq], [c[1][0] + ds, c[1][1] - dq], [c[2][0] + ds, c[2][1] + dq], [c[3][0] - ds, c[3][1] + dq]];
  const pane = (c, mode, side, nu, nv) => { add(new THREE.Mesh(skinPatch(hull, grow(c, 0.04, mode === "side" ? 0.04 : 0.035), mode, side, 0.007, nu, nv), gasket)); add(new THREE.Mesh(skinPatch(hull, c, mode, side, 0.014, nu, nv), glass)); };
  for (const side of [-1, 1]) {
    for (const w of SIDE_WINDOWS) pane(w, "side", side, 10, 8);
    // windscreen panes either side of a body-coloured centre post, and the roof windows
    const a = side > 0 ? [0.06, 0.9] : [-0.9, -0.06], lo = side > 0 ? 0 : 1, hi = 1 - lo;
    pane([[1.84, a[lo]], [2.52, a[lo]], [2.52, a[hi]], [1.84, a[hi]]], "theta", side, 12, 10);
    const r = side > 0 ? [0.12, 0.45] : [-0.45, -0.12];
    pane([[2.64, r[lo]], [3.15, r[lo]], [3.15, r[hi]], [2.64, r[hi]]], "theta", side, 6, 4);
  }
  // ---- belly SBA mark (seen from the chase camera below and behind)
  if (decals.sba) {
    const t = new THREE.CanvasTexture(decals.sba); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const w = 1.6, h = w * decals.sba.height / decals.sba.width;
    const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), high ? new Std({ map: t, transparent: true, alphaTest: 0.35, roughness: 0.4, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 }) : new Pho({ map: t, transparent: true, alphaTest: 0.35, polygonOffset: true, polygonOffsetFactor: -2 })));
    m.rotation.x = Math.PI / 2; m.position.set(0, 0.494, Z(5.15));
  }
  // ---- landing gear
  for (const sx of [-1, 1]) {
    const ax = [sx * 1.38, 0.36, Z(3.65)];
    const tyre = add(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.2, 24), rubber)); tyre.rotation.z = Math.PI / 2; tyre.position.set(...ax);
    const hub = add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.21, 16), metal)); hub.rotation.z = Math.PI / 2; hub.position.set(...ax);
    add(rod([sx * 0.92, 0.58, Z(2.9)], [sx * 1.27, 0.38, Z(3.62)], 0.075, trim));          // drag beam
    add(rod([sx * 1.08, 1.3, Z(3.9)], [sx * 1.22, 0.82, Z(3.72)], 0.11, trim));           // shock strut
    add(rod([sx * 1.22, 0.86, Z(3.72)], [sx * 1.28, 0.42, Z(3.66)], 0.065, metal));
    add(rod([sx * 1.12, 0.36, Z(3.65)], [sx * 1.3, 0.36, Z(3.65)], 0.06, trim));
  }
  const tw = [0, 0.21, Z(13.95)];
  add(rod([0, 1.6, Z(13.35)], [0, 0.62, Z(13.78)], 0.085, trim)); add(rod([0, 0.66, Z(13.76)], [0, 0.36, Z(13.9)], 0.055, metal));   // shock strut
  add(rod([0, 1.58, Z(12.9)], [0, 0.4, Z(13.85)], 0.06, trim));                                                                         // trailing arm
  for (const sx of [-1, 1]) add(rod([sx * 0.085, 0.42, Z(13.86)], [sx * 0.085, 0.21, Z(13.95)], 0.028, metal));
  const tt = add(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.12, 18), rubber)); tt.rotation.z = Math.PI / 2; tt.position.set(...tw);
  // ---- small details: wire cutters, pitot tubes, searchlight, antennas, rescue hoist
  const plate = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const upCut = add(plate(0.025, 0.42, 0.1, trim)); upCut.position.set(0, 2.66, Z(2.56)); upCut.rotation.x = -0.45;
  const loCut = add(plate(0.025, 0.36, 0.1, trim)); loCut.position.set(0, 0.52, Z(1.2)); loCut.rotation.x = 0.5;
  add(rod([0, 1.88, Z(1.82)], [0, 2.47, Z(2.46)], 0.02, trim));
  for (const sx of [-1, 1]) { add(rod([sx * 0.34, 2.56, Z(2.72)], [sx * 0.34, 2.62, Z(2.15)], 0.014, metal, 6)); add(rod([sx * 0.34, 2.48, Z(2.72)], [sx * 0.34, 2.6, Z(2.7)], 0.025, trim, 6)); }
  const light = add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), trim)); light.position.set(0, 0.62, Z(1.75));
  const lens = add(new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), new THREE.MeshBasicMaterial({ color: 0xfff6dc }))); lens.position.set(0, 0.5, Z(1.75)); lens.rotation.x = Math.PI / 2;
  const ant1 = add(plate(0.02, 0.24, 0.2, trim)); ant1.position.set(0, 2.29, Z(10.4)); ant1.rotation.x = 0.35;
  const ant2 = add(plate(0.02, 0.2, 0.18, trim)); ant2.position.set(0, 0.42, Z(6.9)); ant2.rotation.x = -0.35;
  add(rod([0.95, 2.57, Z(4.95)], [1.58, 2.69, Z(4.95)], 0.05, trim));                       // hoist arm (right side, over the door)
  const winch = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 16), trim)); winch.rotation.x = Math.PI / 2; winch.position.set(1.6, 2.63, Z(4.95));
  add(rod([1.6, 2.51, Z(4.95)], [1.6, 2.25, Z(4.95)], 0.012, black, 6));
  // ---- main rotor: mast, swashplate, hub, bifilar vibration absorber, four blades
  const rotor = add(new THREE.Group(), root); rotor.position.set(0, 0, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.6, 18), trim)).position.set(0, HUB_Y - 0.3, 0);
  const swash = add(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.07, 24), metal)); swash.position.set(0, HUB_Y - 0.33, 0);
  const hub = new THREE.Group(); hub.position.y = HUB_Y; rotor.add(hub);
  hub.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.22, 24), trim));
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.32, 12), metal); post.position.y = 0.26; hub.add(post);
  const blades = [], bladeMat = high ? new Std({ vertexColors: true, roughness: 0.55, metalness: 0.15, transparent: true }) : new Pho({ vertexColors: true, shininess: 30, transparent: true });
  const bGeo = bladeGeo(8.18, 0.53, 0.95, 20 * Math.PI / 180, 0.1);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.y = i * Math.PI / 2; hub.add(arm);
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.2), trim); yoke.position.x = 0.62; arm.add(yoke);
    const brg = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), black); brg.position.x = 0.55; arm.add(brg);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.42, 14), metal); cuff.rotation.z = Math.PI / 2; cuff.position.x = 0.98; arm.add(cuff);
    const damper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 10), metal); damper.rotation.z = Math.PI / 2; damper.position.set(0.7, -0.02, 0.2); arm.add(damper);
    const link = rod([0.62, -0.1, -0.16], [0.42, -0.34, -0.16], 0.025, metal, 6); arm.add(link);
    const pivot = new THREE.Group(); pivot.position.x = 0.0; arm.add(pivot);
    const blade = new THREE.Mesh(bGeo, bladeMat); blade.rotation.x = 0.08; pivot.add(blade); blades.push(pivot);
    const fa = new THREE.Group(); fa.rotation.y = Math.PI / 4 + i * Math.PI / 2; fa.position.y = 0.38; hub.add(fa);
    const farm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.08), metal); farm.position.x = 0.25; fa.add(farm);
    const wt = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), trim); wt.position.x = 0.52; fa.add(wt);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(8.25, 72), new THREE.MeshBasicMaterial({ map: discTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = HUB_Y + 0.05; disc.visible = false; root.add(disc);
  // ---- tail rotor on the right of the fin, canted 20 degrees
  const tr = new THREE.Group(); tr.position.set(TAIL_ROTOR.x, TAIL_ROTOR.y, Z(TAIL_ROTOR.s)); tr.rotation.z = TAIL_ROTOR.cant; root.add(tr);
  const gb = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.32, 16), trim); gb.rotation.z = Math.PI / 2; gb.position.x = -0.14; tr.add(gb);
  const trSpin = new THREE.Group(); tr.add(trSpin);
  const trHub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 14), metal); trHub.rotation.z = Math.PI / 2; trHub.position.x = 0.06; trSpin.add(trHub);
  const tbGeo = bladeGeo(TAIL_ROTOR.r, 0.25, 0.18, 0, 0.11);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(tbGeo, bladeMat); b.rotation.order = "YXZ"; b.rotation.set(0, Math.PI / 2, i * Math.PI / 2 + 0.3); b.position.x = 0.1; trSpin.add(b); }
  const trDisc = new THREE.Mesh(new THREE.CircleGeometry(TAIL_ROTOR.r, 48), new THREE.MeshBasicMaterial({ map: discTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  trDisc.rotation.y = Math.PI / 2; trDisc.position.x = 0.1; trDisc.visible = false; tr.add(trDisc);
  // ---- lights
  const glowTex = glowTexture();
  const glow = (color, size, pos) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 })); s.scale.set(size, size, 1); s.position.set(...pos); root.add(s); return s; };
  const bulbMats = {}, bulb = (color, pos) => { const m = add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bulbMats[color] || (bulbMats[color] = new THREE.MeshBasicMaterial({ color })))); m.position.set(...pos); return m; };
  bulb(0xff2a2a, [-STAB.span - 0.02, STAB.y, Z(14.9)]); glow(0xff3030, 0.7, [-STAB.span - 0.05, STAB.y, Z(14.9)]);
  bulb(0x2aff6a, [STAB.span + 0.02, STAB.y, Z(14.9)]); glow(0x30ff70, 0.7, [STAB.span + 0.05, STAB.y, Z(14.9)]);
  bulb(0xffffff, [0, FIN.y1 - 0.15, Z(FIN.te1) + 0.02]);
  const beacons = [[0, 3.04, Z(7.55)], [0, 0.44, Z(6.3)]].map(p => { bulb(0xff1a1a, p); return glow(0xff2020, 0.75, p); });
  const searchGlow = glow(0xfff2d0, 0.9, [0, 0.47, Z(1.75)]);

  mergeStatic(body); mergeStatic(hub, o => o.material === bladeMat); mergeStatic(trSpin);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  disc.castShadow = trDisc.castShadow = false;
  let t = 0;
  return {
    root, body, rotor, blades, decals,
    // st: { dt, spin 0..1 (rotor speed), night 0..1 }
    update(st) {
      const dt = st.dt || 0, spin = st.spin ?? 1; t += dt;
      hub.rotation.y += 24 * spin * dt; trSpin.rotation.x += 110 * spin * dt;
      blades.forEach(b => { b.rotation.z = lerp(-0.035, 0.05, spin); });                 // droop at rest, cone up in flight
      bladeMat.opacity = 1 - 0.72 * smooth(0.35, 0.9, spin);
      disc.visible = trDisc.visible = spin > 0.3; disc.material.opacity = 0.2 * smooth(0.3, 0.9, spin); trDisc.material.opacity = 0.16 * smooth(0.3, 0.9, spin);
      const on = (t % 1.1) < 0.12; beacons.forEach((b, i) => { b.material.opacity = (i ? (t + 0.55) % 1.1 < 0.12 : on) ? 1 : 0.08; });
      searchGlow.material.opacity = 0.35 + 0.55 * (st.night || 0);
    },
  };
}
