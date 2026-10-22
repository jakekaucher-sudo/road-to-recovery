// Track space -> world space. The game logic runs in "track space" (distance z
// along the road in track units, lateral x in road half-widths). This module
// turns a track into a real 3D centreline (metres; forward = -Z at heading 0,
// right = +X) and maps any (z, x) to a world position and heading.
import { SEG, ROAD_W } from "../track.js";

export const U2M = 0.0037;                 // metres per track unit (100 mph top speed ~ 44.7 m/s)
export const SEGM = SEG * U2M;             // one segment ~ 0.74 m
export const HALFW = ROAD_W * U2M;         // road half-width ~ 7.4 m (three lanes)
export const CURVE_K = 0.0018;             // heading change (rad) per segment per unit of track curve

export function buildCenterline(track) {
  const N = track.N + 1;
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N), hd = new Float32Array(N);
  let x = 0, z = 0, h = 0;
  for (let i = 0; i < N; i++) {
    const s = track.segs[Math.min(i, track.N - 1)];
    px[i] = x; pz[i] = z; py[i] = s.y * U2M; hd[i] = h;
    x += Math.sin(h) * SEGM; z -= Math.cos(h) * SEGM;
    h += s.curve * CURVE_K;
  }
  return { px, py, pz, hd, N };
}

// World position for track distance zu (units) and lateral offset xh (half-widths).
const out = { x: 0, y: 0, z: 0, h: 0 };
export function worldAt(cl, zu, xh = 0, target = out) {
  const fi = Math.max(0, Math.min(cl.N - 1.001, zu / SEG));
  const i = Math.floor(fi), f = fi - i;
  const h = cl.hd[i] + (cl.hd[i + 1] - cl.hd[i]) * f;
  const cx = cl.px[i] + (cl.px[i + 1] - cl.px[i]) * f, cz = cl.pz[i] + (cl.pz[i + 1] - cl.pz[i]) * f;
  const cy = cl.py[i] + (cl.py[i + 1] - cl.py[i]) * f;
  const rx = Math.cos(h), rz = Math.sin(h);           // right vector
  target.x = cx + rx * xh * HALFW; target.z = cz + rz * xh * HALFW; target.y = cy; target.h = h;
  return target;
}
// Road pitch (rad) at distance zu, for vehicles going over hills.
export function pitchAt(cl, zu) {              // blended between segments so the van never steps
  const fi = Math.max(0, Math.min(cl.N - 3.001, zu / SEG - 0.5)), i = Math.floor(fi), f = fi - i;
  const p0 = Math.atan2(cl.py[i + 1] - cl.py[i], SEGM), p1 = Math.atan2(cl.py[i + 2] - cl.py[i + 1], SEGM);
  return p0 + (p1 - p0) * f;
}
