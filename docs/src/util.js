// Small deterministic helpers. No state, no randomness: everything that looks
// random is a hash of integers so a frame at time t always renders the same.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sat = (v) => clamp(v, 0, 1);
export const smooth = (e0, e1, x) => { const t = sat((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
export const stage = (p, a, b) => sat((p - a) / (b - a));
export const easeOut = (t) => 1 - Math.pow(1 - sat(t), 3);
export const easeIn = (t) => Math.pow(sat(t), 3);
export const easeInOut = (t) => { t = sat(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOutBack = (t) => { t = sat(t); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const easeOutElastic = (t) => { t = sat(t); if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1; };
export const easeOutBounce = (t) => { t = sat(t); const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; };

// Integer hash -> [0,1)
export function hash(n) {
  n = Math.imul(n | 0, 0x27d4eb2d) ^ (n >>> 15);
  n = Math.imul(n ^ (n >>> 7), 0x165667b1);
  n ^= n >>> 13;
  return (n >>> 0) / 4294967296;
}
export const hash2 = (a, b) => hash(a * 73856093 ^ b * 19349663);
export const hash3 = (a, b, c) => hash(a * 73856093 ^ b * 19349663 ^ c * 83492791);
// Smooth 1-D value noise in [-1,1]
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash2(i, seed) * 2 - 1, hash2(i + 1, seed) * 2 - 1, u);
}
export function fbm1(x, seed = 0, oct = 3) {
  let v = 0, a = 1, s = 0, f = 1;
  for (let o = 0; o < oct; o++) { v += a * noise1(x * f, seed + o * 17); s += a; a *= 0.5; f *= 2.1; }
  return v / s;
}
export const tri = (t) => 1 - Math.abs((t % 2) - 1); // 0..1..0 triangle wave, period 2

// Colors as [r,g,b]
export function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgbStr(c, a = 1) { return a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
export function mixRgb(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
export function shade(c, k) { return [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)]; }
export function mixHex(h1, h2, t) { return rgbStr(mixRgb(hexToRgb(h1), hexToRgb(h2), t)); }
export function hexA(h, a) { return rgbStr(hexToRgb(h), a); }

export function fmtMoney(n, symbol = "$") {
  n = Math.round(n);
  return symbol + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Polygon helper
export function poly(ctx, pts, fill, stroke, lw) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
export function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
// Arcade plate: rectangle with clipped corners
export function plate(ctx, x, y, w, h, c, fill, stroke, lw) {
  ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}
export function glow(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgbStr(color, a)); g.addColorStop(1, rgbStr(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
export const FONT = '"Source Sans 3","Source Sans Pro","Helvetica Neue",Helvetica,Arial,sans-serif';
// Split `s` into lines no wider than maxW at the given font size (canvas text).
export function wrapLines(ctx, s, size, maxW, opts = {}) {
  ctx.font = `${opts.italic ? "italic " : ""}${opts.weight || 600} ${size}px ${FONT}`;
  const words = String(s).split(" "), lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
// Largest font size <= size at which `s` fits in maxW on one line.
export function fitSize(ctx, s, size, maxW, opts = {}) {
  ctx.font = `${opts.italic ? "italic " : ""}${opts.weight || 600} ${size}px ${FONT}`;
  const w = ctx.measureText(s).width; return w > maxW ? Math.max(8, Math.floor(size * maxW / w)) : size;
}
export function text(ctx, s, x, y, size, color, opts = {}) {
  ctx.font = `${opts.italic ? "italic " : ""}${opts.weight || 600} ${size}px ${FONT}`;
  ctx.textAlign = opts.align || "left"; ctx.textBaseline = opts.baseline || "alphabetic";
  if (opts.shadow) { ctx.fillStyle = opts.shadow; ctx.fillText(s, x + size * 0.06, y + size * 0.06); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
