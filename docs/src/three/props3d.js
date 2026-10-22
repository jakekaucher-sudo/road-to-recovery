// Low-poly prop geometry, built procedurally and merged per kind with vertex
// colours, so each kind is one instanced draw call. Heights in metres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const C = (hex) => new THREE.Color(hex);
function paint(g, color) {
  g = g.index ? g.toNonIndexed() : g; const c = C(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute("uv"); return g;
}
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s)); g.applyMatrix4(m); return g; };
const box = (w, h, d, col, x = 0, y = 0, z = 0, ry = 0) => at(paint(new THREE.BoxGeometry(w, h, d), col), x, y + h / 2, z, 0, ry);
const cyl = (r0, r1, h, col, x = 0, y = 0, z = 0, seg = 7, rx = 0, rz = 0) => at(paint(new THREE.CylinderGeometry(r0, r1, h, seg), col), x, y + h / 2, z, rx, 0, rz);
const blob = (r, col, x, y, z, sy = 1, detail = 0) => { const g = paint(new THREE.IcosahedronGeometry(r, detail), col); g.scale(1, sy, 1); return at(g, x, y, z); };
const merge = (parts) => mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p));
const gable = (w, h, d, col, y) => { const s = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.3, 0), new THREE.Vector2(0, h), new THREE.Vector2(w / 2 + 0.3, 0)]); const g = new THREE.ExtrudeGeometry(s, { depth: d + 0.4, bevelEnabled: false }); g.translate(0, y, -d / 2 - 0.2); return paint(g, col); };


// ---------- houses: a small kit (eaves, framed windows, porch, chimney, garage)
// so every house reads as a real building, in several colour variants.
let DETAIL = 1;                                               // 0 = phone tier: fewer small parts
export function setPropDetail(level) { DETAIL = level; }
const quad = (w, h, col, x, y, z, rz = 0) => at(paint(new THREE.PlaneGeometry(w, h), col), x, y, z, 0, 0, rz);
function windowGeo(w, h, trim, glass, opts = {}) {
  const parts = [box(w + 0.22, h + 0.22, 0.08, trim, 0, -h / 2 - 0.11, 0), quad(w, h, glass, 0, 0, 0.045)];
  if (opts.mullion && DETAIL) parts.push(quad(0.07, h, trim, 0, 0, 0.05), quad(w, 0.07, trim, 0, 0, 0.05));
  if (opts.sill !== false) parts.push(box(w + 0.42, 0.08, 0.2, trim, 0, -h / 2 - 0.19, 0.06));
  if (opts.shutter) for (const sx of [-1, 1]) parts.push(quad(0.36, h + 0.1, opts.shutter, sx * (w / 2 + 0.33), 0, 0.045));
  if (opts.boarded) parts.push(quad(w + 0.1, 0.3, "#a7845a", 0, 0, 0.06, 0.35), quad(w + 0.1, 0.3, "#9b7a50", 0, 0, 0.065, -0.3));
  return merge(parts);                                       // origin at the window centre, facing +z
}
const placeW = (g, x, y, z, ry = 0) => at(g, x, y, z, 0, ry);
function houseKit(o) {
  const w = o.w || 8, d = o.d || 7, h = o.h || 3.0, st = o.stories || 1, F = o.F ?? 0.5, H = h * st, top = F + H;
  const trim = o.trim || "#f3f1ea", glass = o.glass || "#2f4456", roofC = o.roof, wall = o.wall;
  const parts = [box(w + 0.2, F, d + 0.2, o.found || "#8b857a"), box(w, H, d, wall, 0, F, 0)];
  if (DETAIL) for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(0.16, H, 0.16, trim, sx * w / 2, F, sz * d / 2));
  for (let k = 1; k < st; k++) parts.push(box(w + 0.06, 0.14, d + 0.06, trim, 0, F + h * k - 0.07, 0));
  // roof: two slabs with overhang, gable prism, ridge cap
  const ov = 0.55, half = w / 2 + ov, rh = o.rh || w * 0.3, len = Math.hypot(half, rh), a = Math.atan2(rh, half), T = 0.2, lift = T / 2 / Math.cos(a);
  for (const sx of [-1, 1]) parts.push(at(paint(new THREE.BoxGeometry(len, T, d + ov * 2), roofC), sx * half / 2, top + rh / 2 - ov * rh / half + lift, 0, 0, 0, -sx * a));
  const gs = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rh * (w / 2) / half)]);
  parts.push(paint(new THREE.ExtrudeGeometry(gs, { depth: d, bevelEnabled: false }).translate(0, top, -d / 2), wall));
  parts.push(box(0.34, 0.14, d + ov * 2, o.ridge || roofC, 0, top + rh - ov * rh / half + T * 0.6, 0));
  for (const sz of [-1, 1]) parts.push(quad(0.9, 0.55, trim, 0, top + rh * 0.38, sz * (d / 2 + 0.02)).rotateY(sz < 0 ? Math.PI : 0));      // gable vents
  // front (+z): door + porch on the ground floor, windows elsewhere
  const fz = d / 2 + 0.01, ww = o.winW || 1.3, wh = o.winH || 1.35, sh = o.shutter;
  const doorX = o.doorX ?? 0;
  for (let k = 0; k < st; k++) {
    const y = F + h * k + h * 0.55;
    const xs = k === 0 ? [-w * 0.3, w * 0.3] : [-w * 0.3, 0, w * 0.3];
    for (const x of xs) if (Math.abs(x - doorX) > 1.2) parts.push(placeW(windowGeo(ww, wh, trim, glass, { mullion: true, shutter: sh, boarded: o.boarded && k === 0 }), x, y, fz));
    // sides
    if (DETAIL || k === 0) for (const sx of [-1, 1]) for (const z of [-d * 0.22, d * 0.22]) parts.push(placeW(windowGeo(ww * 0.85, wh, trim, glass, { sill: k === 0 }), sx * (w / 2 + 0.01), y, z, sx * Math.PI / 2));
  }
  parts.push(box(1.3, 2.35, 0.1, trim, doorX, F, fz), box(1.0, 2.15, 0.12, o.door || "#5a4434", doorX, F, fz + 0.02), box(0.1, 0.1, 0.06, "#d9c27a", doorX + 0.35, F + 1.05, fz + 0.1));
  if (o.porch !== false) {
    const pw = o.porchW || Math.min(w * 0.6, 5), pd = 1.9, pz = d / 2 + pd / 2;
    parts.push(box(pw, F, pd, o.deck || "#9a8f80", doorX, 0, pz), box(1.5, F * 0.5, 0.55, o.deck || "#9a8f80", doorX, 0, d / 2 + pd + 0.27));
    for (const sx of [-1, 1]) parts.push(cyl(0.08, 0.08, h * 0.82, trim, doorX + sx * (pw / 2 - 0.15), F, d / 2 + pd - 0.15, 6));
    parts.push(at(paint(new THREE.BoxGeometry(pw + 0.4, 0.14, pd + 0.5), roofC), doorX, F + h * 0.84 + 0.12, d / 2 + pd / 2 + 0.1, 0.16, 0, 0));
    if (o.rail && DETAIL) for (const sx of [-1, 1]) parts.push(box(pw / 2 - 0.9, 0.08, 0.06, trim, doorX + sx * (pw / 4 + 0.45), F + 0.8, d / 2 + pd - 0.15), box(0.06, 0.8, 0.06, trim, doorX + sx * (pw / 2 - 0.15), F, d / 2 + pd - 0.15));
  }
  if (o.chimney !== false) { const cx = w * 0.28, cz = -d * 0.18, ch = rh * 0.6 + 1.6; parts.push(box(0.8, ch, 0.8, o.brick || "#8e4a3c", cx, top + rh * (1 - cx / half) - rh * 0.55, cz), box(0.95, 0.14, 0.95, "#5e5a56", cx, top + rh * (1 - cx / half) - rh * 0.55 + ch, cz)); }
  if (o.garage) {
    const gw = 4.2, gd = d * 0.8, gh = h * 0.95, gx = -(w / 2 + gw / 2);
    parts.push(box(gw, F, gd + 0.1, o.found || "#8b857a", gx, 0, (d - gd) / 2), box(gw, gh, gd, wall, gx, F, (d - gd) / 2));
    parts.push(at(paint(new THREE.BoxGeometry(gw + 0.6, 0.2, gd + 0.8), roofC), gx - 0.1, F + gh + 0.45, (d - gd) / 2, 0, 0, 0.18));
    parts.push(at(paint(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-gw / 2, 0), new THREE.Vector2(gw / 2, 0), new THREE.Vector2(gw / 2, 0.75)]), { depth: gd, bevelEnabled: false }), wall), gx, F + gh, (d - gd) / 2 - gd / 2));
    parts.push(box(3.1, 2.35, 0.08, "#e9e7e1", gx, F * 0.2, d / 2 + 0.02));
    for (let i = 1; i < 4; i++) parts.push(box(3.1, 0.05, 0.04, "#b8b6b0", gx, F * 0.2 + i * 0.59, d / 2 + 0.07));
    parts.push(box(3.3, 0.12, 0.12, trim, gx, F * 0.2 + 2.35, d / 2 + 0.05));
  }
  if (o.tarp) { const xc = half * 0.48; parts.push(at(paint(new THREE.BoxGeometry(len * 0.55, 0.05, d * 0.6), "#2f6fc0"), xc, top + rh * (1 - xc / half) - ov * rh / half + T / Math.cos(a) + 0.03, -d * 0.05, 0, 0, -a)); }
  if (o.waterline) parts.push(box(w + 0.05, 0.22, d + 0.05, "#6e5d44", 0, o.waterline, 0), box(w + 0.03, o.waterline - F, d + 0.03, o.stain || "#8a7a62", 0, F, 0));
  if (o.stilts) {
    const sp = o.stilts, legs = [];
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) legs.push(box(0.3, sp, 0.3, "#7a6a54", sx * (w / 2 - 0.3), 0, sz * (d / 2 - 0.3)));
    for (const sx of [-1, 1]) legs.push(box(0.3, sp, 0.3, "#7a6a54", sx * (w / 2 - 0.3), 0, d / 2 + 2.0));
    const deck = [box(w + 0.6, 0.2, 2.6, "#9b8466", 0, sp - 0.2, d / 2 + 1.1)];
    for (const sx of [-1, 1]) deck.push(box(0.08, 1.0, 2.5, trim, sx * (w / 2 + 0.25), sp, d / 2 + 1.15));
    deck.push(box(w + 0.6, 0.08, 0.08, trim, 0, sp + 0.95, d / 2 + 2.35));
    for (let i = 0; i < 9; i++) deck.push(box(0.06, 0.95, 0.06, trim, -w / 2 - 0.25 + (w + 0.5) * i / 8, sp, d / 2 + 2.35));
    for (let i = 0; i < 6; i++) deck.push(box(1.1, 0.12, 0.35, "#9b8466", w / 2 + 1.0, sp - 0.4 - i * (sp - 0.4) / 6, d / 2 + 1.6 - i * 0.4 - 0.6 * 0));
    const house = merge(parts).translate(0, sp, 0);
    return merge([house, ...legs, ...deck]);
  }
  return merge(parts);
}
const HOUSES = [
  { wall: "#e6dccb", roof: "#5d4f4a", shutter: "#3f5a74", door: "#7a2c2a" },
  { wall: "#a9bfd0", roof: "#3e4450", stories: 2, w: 7.6, d: 6.6, door: "#1c3e75", rail: true },
  { wall: "#bcc5a1", roof: "#6a4a3e", garage: true, shutter: "#4c5a3c", porchW: 3.2, doorX: 1.2 },
  { wall: "#c98a6e", roof: "#3a3a40", stories: 2, w: 8.2, shutter: "#f3f1ea", trim: "#efe8da", door: "#2f3a2c", chimney: false },
];
const BEACH = [
  { wall: "#e99f8a", roof: "#efe9de", trim: "#ffffff" },
  { wall: "#7fc4bf", roof: "#f2ede2", trim: "#ffffff", door: "#1c3e75" },
  { wall: "#efd47e", roof: "#cf7f5a", trim: "#ffffff" },
  { wall: "#b9a8d3", roof: "#efe9de", trim: "#ffffff", door: "#3b2f5a" },
];

export const PROPS = {
  tree: () => merge([cyl(0.18, 0.28, 3.2, "#5b4330"), blob(2.0, "#4f7a3a", 0, 4.4, 0, 1.1), blob(1.5, "#5f8c44", 0.8, 5.4, 0.3), blob(1.3, "#466e33", -0.7, 5.1, -0.4)]),
  treeBent: () => merge([cyl(0.18, 0.28, 3.0, "#5b4330", 0, 0, 0, 7, 0, -0.25), blob(1.9, "#4a7236", 0.9, 4.0, 0, 1.0), blob(1.3, "#57803f", 1.7, 4.6, 0.2)]),
  treeBroken: () => merge([cyl(0.22, 0.3, 1.8, "#5b4330"), cyl(0.16, 0.22, 3.4, "#5b4330", 1.6, 0.25, 0, 7, 0, -1.35), blob(1.6, "#4c6a34", 3.4, 0.9, 0.2, 0.6)]),
  treeSunk: () => merge([cyl(0.18, 0.28, 3.2, "#4a3a2c"), blob(1.9, "#45663a", 0, 4.2, 0, 1.05), blob(1.3, "#4f7240", 0.7, 5.1, 0.2)]),
  palm: () => { const parts = []; let x = 0, y = 0; for (let i = 0; i < 6; i++) { parts.push(cyl(0.2 - i * 0.015, 0.24 - i * 0.015, 1.25, i % 2 ? "#8c6b45" : "#7a5c3a", x, y, 0, 6, 0, -0.06 * i)); x += Math.sin(0.06 * i) * 1.25; y += 1.22; }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const f = paint(new THREE.ConeGeometry(0.35, 3.0, 3), k % 2 ? "#3f7a3a" : "#4f8c42"); f.scale(1, 1, 0.25); at(f, x + Math.cos(a) * 1.2, y - 0.25, Math.sin(a) * 1.2, Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); parts.push(f); }
    parts.push(blob(0.45, "#6b5a32", x, y, 0)); return merge(parts); },
  palmBent: () => { const g = PROPS.palm(); g.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0.32, 0, 0, 0)); return g; },
  lamp: () => merge([cyl(0.09, 0.12, 7.5, "#7d8086"), box(1.6, 0.12, 0.14, "#7d8086", -0.75, 7.35, 0), box(0.5, 0.16, 0.3, "#3e4146", -1.45, 7.25, 0)]),
  pole: () => merge([cyl(0.14, 0.18, 9, "#6b5440"), box(2.4, 0.16, 0.16, "#5a4634", 0, 8.2, 0), box(1.6, 0.14, 0.14, "#5a4634", 0, 7.4, 0)]),
  poleLean: () => { const g = PROPS.pole(); g.rotateZ(0.2); return g; },
  // houses return several colour variants (one instanced draw each)
  house: () => HOUSES.map(v => houseKit(v)),
  houseTarp: () => HOUSES.map((v, i) => houseKit({ ...v, tarp: true, boarded: i % 2 === 0 })),
  houseFlooded: () => HOUSES.map(v => houseKit({ ...v, wall: "#" + new THREE.Color(v.wall).lerp(C("#8a826e"), 0.35).getHexString(), waterline: 1.35, stain: "#8f826a", porch: v.garage ? false : undefined })),
  houseStilts: () => BEACH.map((v, i) => houseKit({ ...v, stilts: 2.6, porch: false, chimney: false, boarded: i % 2 === 1, w: 7.4, d: 6.4, h: 2.9, rh: 1.9 })),
  barn: () => { const s = new THREE.Shape([new THREE.Vector2(-5.3, 0), new THREE.Vector2(-4.2, 2.4), new THREE.Vector2(0, 3.6), new THREE.Vector2(4.2, 2.4), new THREE.Vector2(5.3, 0)]); const r = new THREE.ExtrudeGeometry(s, { depth: 12.4, bevelEnabled: false }); r.translate(0, 5, -6.2);
    return merge([box(10, 5, 12, "#9c3a30"), paint(r, "#5a4a44"), box(2.6, 3.4, 0.1, "#e8e2d6", 0, 0, 6.02), box(2.2, 3.0, 0.12, "#7a2c24", 0, 0.1, 6.04)]); },
  silo: () => merge([cyl(2.2, 2.2, 13, "#c9ccd2", 0, 0, 0, 12), blob(2.25, "#9ea3aa", 0, 13, 0, 0.6, 1)]),
  windmill: () => { const parts = []; for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(cyl(0.06, 0.06, 11.5, "#8a8f96", x * 0.9, 0, z * 0.9, 4, z * 0.07, -x * 0.07)); parts.push(box(1.0, 0.8, 1.2, "#6b6f76", 0, 11.2, 0));
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; parts.push(at(paint(new THREE.BoxGeometry(0.28, 2.4, 0.04), "#c9ccd2"), Math.cos(a) * 1.3, 11.6 + Math.sin(a) * 1.3, 0.75, 0, 0, a - Math.PI / 2)); }
    parts.push(box(0.12, 0.12, 2.6, "#6b6f76", 0, 11.5, -1.2)); return merge(parts); },
  fence: () => { const parts = []; for (let i = 0; i < 5; i++) parts.push(box(0.12, 1.3, 0.12, "#8a7656", -4 + i * 2, 0, 0)); parts.push(box(8.2, 0.12, 0.06, "#9a8666", 0, 0.9, 0), box(8.2, 0.12, 0.06, "#9a8666", 0, 0.45, 0)); return merge(parts); },
  hay: () => at(paint(new THREE.CylinderGeometry(0.85, 0.85, 1.2, 12), "#c9a855"), 0, 0.85, 0, 0, 0, Math.PI / 2),
  dune: () => { const g = blob(4.5, "#cdb98a", 0, 0, 0, 0.32, 1); return g; },
  boat: () => { const hull = paint(new THREE.CylinderGeometry(1.2, 0.6, 7, 6, 1, false, 0, Math.PI), "#e8e8e4"); hull.rotateX(Math.PI / 2); hull.rotateZ(Math.PI); hull.translate(0, 1.2, 0); return merge([hull, box(2.2, 1.3, 2.4, "#d8dce2", 0, 1.2, -0.5), box(2.4, 0.2, 7, "#2f4a7a", 0, 0.8, 0)]).rotateZ(0.25); },
  lighthouse: () => { const parts = []; for (let i = 0; i < 6; i++) parts.push(cyl(2.0 - i * 0.18, 2.1 - i * 0.18, 3, i % 2 ? "#c3282e" : "#f2f0ea", 0, i * 3, 0, 12)); parts.push(cyl(1.0, 1.0, 1.6, "#2b3440", 0, 18, 0, 10), at(paint(new THREE.ConeGeometry(1.3, 1.4, 10), "#c3282e"), 0, 20.3, 0)); return merge(parts); },
  sandbagWall: () => { const parts = []; for (let r = 0; r < 3; r++) for (let i = 0; i < 5 - r; i++) parts.push(blob(0.45, r % 2 ? "#b8a47c" : "#c7b38a", -1.6 + i * 0.8 + r * 0.4, 0.3 + r * 0.42, 0, 0.5)); return merge(parts); },
  warning: () => merge([cyl(0.05, 0.05, 2.4, "#8a8f96"), at(paint(new THREE.BoxGeometry(1.0, 1.0, 0.05), "#e8c23a"), 0, 2.7, 0, 0, 0, Math.PI / 4)]),
  // ---------- hazards on the road
  cones: () => { const parts = []; for (let i = 0; i < 3; i++) { parts.push(cyl(0.04, 0.24, 0.75, "#f07a28", -1.1 + i * 1.1, 0, 0, 8)); parts.push(cyl(0.1, 0.16, 0.12, "#f4f4f2", -1.1 + i * 1.1, 0.38, 0, 8)); } return merge(parts); },
  debris: () => { const parts = []; for (let i = 0; i < 7; i++) parts.push(at(paint(new THREE.BoxGeometry(1.6 + (i % 3) * 0.6, 0.12, 0.22), i % 2 ? "#8c6a46" : "#6e6a64"), (i % 3 - 1) * 0.8, 0.15 + i * 0.05, (i % 2 - 0.5) * 0.9, 0.2 * i, i * 0.9, 0.15 * (i % 3))); parts.push(blob(0.7, "#7a7066", 0.2, 0.2, 0, 0.4)); return merge(parts); },
  branch: () => merge([cyl(0.18, 0.24, 5, "#5b4330", 0, 0.2, 0, 7, 0, Math.PI / 2 - 0.05), blob(1.3, "#466e33", 2.2, 0.9, 0.2, 0.7), blob(1.0, "#56803f", 1.4, 1.1, -0.4, 0.7)]),
  log: () => at(paint(new THREE.CylinderGeometry(0.3, 0.32, 3.6, 8), "#6e5436"), 0, 0.3, 0, 0, 0, Math.PI / 2),
  barrel: () => merge([cyl(0.32, 0.32, 0.95, "#2f6fb0", 0, 0, 0, 10), cyl(0.33, 0.33, 0.08, "#1d4a7a", 0, 0.3, 0, 10), cyl(0.33, 0.33, 0.08, "#1d4a7a", 0, 0.65, 0, 10)]),
  sandbags: () => PROPS.sandbagWall(),
  tumble: () => merge([at(paint(new THREE.BoxGeometry(1.8, 0.05, 1.1), "#9aa0a8"), 0, 0.8, 0, 0.4, 0.3, 0.2), at(paint(new THREE.BoxGeometry(1.2, 0.06, 0.6), "#8b6a46"), 0.3, 1.0, 0.2, -0.3, 0.8, 0.5)]),
  poleDown: () => merge([cyl(0.16, 0.2, 9, "#6b5440", 0, 0.2, 0, 7, 0, Math.PI / 2), box(2.0, 0.14, 0.14, "#5a4634", 4.2, 0, 0.7)]),
  frond: () => { const f = paint(new THREE.ConeGeometry(0.4, 2.6, 3), "#4f8c42"); f.scale(1, 1, 0.25); return at(f, 0, 0.15, 0, 0, 0, Math.PI / 2); },
  puddle: () => null, sand: () => null, flood: () => null, wave: () => null, waveCrest: () => null,
  // ---------- pickups and traffic
  clock: () => merge([at(paint(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 20), "#ecc444"), 0, 0, 0, Math.PI / 2), at(paint(new THREE.CylinderGeometry(0.44, 0.44, 0.16, 20), "#fffbe8"), 0, 0, 0, Math.PI / 2), box(0.06, 0.32, 0.02, "#0e2e6a", 0, -0.02, 0.1), box(0.24, 0.06, 0.02, "#0e2e6a", 0.1, -0.03, 0.1)]),
};

// Traffic: body parts are white (tinted per instance), glass/tyres coloured.
export function carGeometry(type) {
  const W = "#ffffff", G = "#1b2430", T = "#121316", parts = [];
  const wheels = (z0, z1, w) => { for (const z of [z0, z1]) for (const x of [-w / 2, w / 2]) parts.push(at(paint(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), T), x, 0.34, z, 0, 0, Math.PI / 2)); };
  if (type === "boxtruck") { parts.push(box(2.3, 2.6, 5.0, W, 0, 0.7, 1.2), box(2.2, 1.6, 2.0, "#e2e5ea", 0, 0.55, -2.4), box(2.0, 0.8, 0.05, G, 0, 1.25, -3.42)); wheels(-2.4, 2.6, 2.2); }
  else if (type === "pickup" || type === "utility") { parts.push(box(2.0, 0.85, 5.2, W, 0, 0.45, 0), box(1.9, 0.8, 1.9, W, 0, 1.3, -0.6), box(1.8, 0.62, 0.05, G, 0, 1.38, -1.57), box(1.8, 0.62, 0.05, G, 0, 1.38, 0.37)); if (type === "utility") parts.push(box(1.9, 0.6, 2.0, "#e6e8ec", 0, 1.3, 1.5)); wheels(-1.6, 1.6, 1.95); }
  else { const hatch = type === "hatch"; parts.push(box(1.85, 0.7, hatch ? 4.0 : 4.6, W, 0, 0.42, 0), box(1.7, 0.62, hatch ? 2.2 : 2.3, W, 0, 1.1, hatch ? 0.35 : 0.1), box(1.6, 0.5, 0.05, G, 0, 1.15, hatch ? 1.47 : 1.27), box(1.6, 0.5, 0.05, G, 0, 1.15, hatch ? -0.77 : -1.07)); wheels(hatch ? -1.3 : -1.5, hatch ? 1.3 : 1.5, 1.8); }
  return merge(parts);
}
export const CAR_COLORS = ["#4a4f5a", "#8a2a30", "#2f5f73", "#b9bdc4", "#e9eaee", "#23272e", "#6f6a52", "#2b3f6a"];
export const CAR_DIM = { sedan: [1.85, 4.6], hatch: [1.85, 4.0], pickup: [2.0, 5.2], utility: [2.0, 5.2], boxtruck: [2.3, 6.4] };

// The recovery stop's 3D body behind its painted facade. K = the storefront spec
// (buildings.js), sizes in facade pixels; mp = metres per pixel; base = height of
// the facade's ground line. Front face sits at z = 0, body extends to -D.
export function stopBuildingGeo(K, palette, mp, base) {
  const bw = K.bw * mp, bh = K.bh * mp + base, D = 10, parts = [];
  const fac = palette.facade, trimHex = palette.trim, trimLight = "#f1efe8";
  const roofC = "#" + C(trimHex).lerp(C("#3c383c"), 0.5).getHexString();
  parts.push(box(bw, bh, D, fac, 0, 0, -D / 2 - 0.05), box(bw + 0.2, 0.5, D + 0.1, "#85807a", 0, 0, -D / 2 - 0.05));
  for (const sx of [-1, 1]) parts.push(box(0.2, bh, 0.2, trimLight, sx * bw / 2, 0, -D - 0.05));
  // side windows per floor
  const floors = K.floors || 1, fh = (bh - base) / floors;
  for (let f = 0; f < floors; f++) {
    const y = base + fh * f + fh * 0.58;
    for (const sx of [-1, 1]) for (const z of [-2.4, -5.2, -8.0]) parts.push(placeW(windowGeo(1.4, Math.min(1.7, fh * 0.48), K.roof === "pitched" ? trimLight : trimHex, "#33475a", { sill: true }), sx * (bw / 2 + 0.01), y, z, sx * Math.PI / 2));
  }
  if (K.roof === "pitched") {
    const rh = (K.roofH || 120) * mp, ov = 30 * mp, half = bw / 2 + ov, len = Math.hypot(half, rh), a = Math.atan2(rh, half), T = 0.24, lift = T / 2 / Math.cos(a);
    for (const sx of [-1, 1]) parts.push(at(paint(new THREE.BoxGeometry(len, T, D + 0.55), roofC), sx * half / 2, bh + rh / 2 - ov * rh / half + lift, -D / 2 + 0.2, 0, 0, -sx * a));
    const gs = new THREE.Shape([new THREE.Vector2(-bw / 2, 0), new THREE.Vector2(bw / 2, 0), new THREE.Vector2(0, rh * (bw / 2) / half)]);
    parts.push(paint(new THREE.ExtrudeGeometry(gs, { depth: D, bevelEnabled: false }).translate(0, bh, -D - 0.05), fac));
    parts.push(box(0.4, 0.16, D + 0.55, roofC, 0, bh + rh - ov * rh / half + T * 0.6, -D / 2 + 0.2));
    if (K.chimney) { const cx = (-K.bw / 2 + K.bw * 0.72 + 28) * mp, ch = 2.9; parts.push(box(0.95, ch, 0.95, "#8e4a3c", cx, bh + rh * (1 - Math.abs(cx) / half) - 1.2, -0.75)); }
    if (K.steeple) { const tw = 2.45, tTop = base + (K.bh + (K.roofH || 120) + 170) * mp; parts.push(box(tw, tTop - bh - 0.15, 2.6, fac, 0, bh, -1.45), box(tw + 0.25, 0.22, 2.85, trimLight, 0, tTop - 0.4, -1.45)); }
  } else {
    const cap = K.roof === "diner" ? "#c6ccd4" : trimHex, ph = K.roof === "diner" ? 0.8 : 26 * mp;
    parts.push(box(bw, 0.18, D, "#55575c", 0, bh, -D / 2 - 0.05));
    for (const sx of [-1, 1]) parts.push(box(0.3, ph, D + 0.1, cap, sx * (bw / 2 + 0.1), bh, -D / 2 - 0.05));
    parts.push(box(bw + 0.5, ph, 0.3, cap, 0, bh, -D - 0.1));
    parts.push(box(1.8, 1.0, 1.4, "#a9adb3", -bw * 0.22, bh + 0.18, -D * 0.55), box(1.4, 0.9, 1.2, "#9ea2a8", bw * 0.18, bh + 0.18, -D * 0.72), cyl(0.25, 0.25, 0.9, "#8d9198", bw * 0.3, bh + 0.18, -D * 0.35, 8));
    if (K.balconies) for (const sx of [-1, 1]) for (let f = 1; f < floors; f++) { const y = base + fh * f + 0.05; parts.push(box(0.9, 0.15, 3.0, "#d9dbdf", sx * (bw / 2 + 0.45), y, -5.2), box(0.06, 0.9, 3.0, "#4a4f58", sx * (bw / 2 + 0.88), y + 0.15, -5.2)); }
  }
  return merge(parts);
}
