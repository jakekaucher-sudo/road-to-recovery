// Builds the stage's road, curbs, shoulders and terrain as chunked meshes
// (so off-screen chunks are culled), plus water patches on the road and the
// glowing delivery zone. Terrain shape reacts to the stage: rolling hills,
// flooded fields, or a beach dropping into the sea on the right.
import * as THREE from "three";
import { SEGM, HALFW } from "./space.js";
import { asphaltTexture, curbTexture, groundTexture, chevronTexture } from "./textures.js";

const CHUNK = 160;
let TEX = null;
function tex() { if (!TEX) TEX = { asphalt: asphaltTexture(), curb: curbTexture(), ground: groundTexture(), chevron: chevronTexture() }; return TEX; }
function n2(x, y) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = n2(ix, iy), b = n2(ix + 1, iy), c = n2(ix, iy + 1), d = n2(ix + 1, iy + 1); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; }

// Lateral profile: distances from the centre line (m) for terrain columns.
const COLS = [HALFW + 3, HALFW + 7, HALFW + 14, HALFW + 26, HALFW + 46, HALFW + 80, HALFW + 140, HALFW + 240];

export function buildRoad(track, cl, look, quality) {
  const T = tex(), group = new THREE.Group();
  const lit = quality.high ? THREE.MeshStandardMaterial : THREE.MeshLambertMaterial;
  const roadMat = new lit({ map: T.asphalt, ...(quality.high ? { roughness: 0.9 - 0.48 * look.wet, metalness: 0.0 } : {}) });
  const curbMat = new THREE.MeshLambertMaterial({ map: T.curb });
  const groundMat = quality.high ? new THREE.MeshStandardMaterial({ map: T.ground, vertexColors: true, roughness: 0.95, metalness: 0 }) : new THREE.MeshLambertMaterial({ map: T.ground, vertexColors: true });
  const roadMeshes = [];
  const coast = !!look.coast, flood = !!look.flood;
  const gA = new THREE.Color(look.groundA), gB = new THREE.Color(look.groundB), sh = new THREE.Color(look.shoulder), sand = new THREE.Color("#c9b688"), mud = new THREE.Color("#6e6448");
  const N = cl.N - 1;
  let dist = 0;
  const distAt = new Float32Array(cl.N); for (let i = 1; i < cl.N; i++) { dist += SEGM; distAt[i] = dist; }
  // sea level for the coast: below the lowest point of the road
  let minY = Infinity; for (let i = 0; i < cl.N; i++) minY = Math.min(minY, cl.py[i]);
  const seaY = minY - 1.6;
  track.seaY = seaY; track.floodY = null;

  // the drawbridge's river: terrain drops to a riverbed across the bridge, and the road has a gap
  const segs = track.segs, bridge = (track.jumps || []).find(j => j.kind === "drawbridge");
  const riverK = (i) => !bridge ? 0 : Math.max(0, Math.min(1, Math.min(i - (bridge.span0 - 8), (bridge.span1 + 8) - i) / 8));
  const bedY = (i) => bridge.deckY * 0.0037 - 7.2 - cl.py[i];      // relative to the road at row i
  const inGap = (i) => segs[i] && segs[i].bridge && segs[i].bridge.part === "gap" && segs[i + 1] && segs[i + 1].bridge && segs[i + 1].bridge.part === "gap";
  for (let c0 = 0; c0 < N; c0 += CHUNK) {
    const c1 = Math.min(N, c0 + CHUNK), rows = c1 - c0 + 1;
    // ---- road + curbs + shoulders: columns at fixed offsets
    const lat = [-(HALFW + 3), -(HALFW + 0.9), -HALFW, HALFW, HALFW + 0.9, HALFW + 3];
    const rp = [], ru = [], rIdx = [], cp = [], cu = [], cIdx = [], gp = [], gc = [], gu = [], gIdx = [];
    const pushStrip = (pos, uv, idx, cols, getP, getUV, skip) => {
      const base = pos.length / 3;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const p = getP(c0 + r, k); pos.push(p[0], p[1], p[2]); const t = getUV(c0 + r, k); uv.push(t[0], t[1]); }
      for (let r = 0; r < rows - 1; r++) { if (skip && skip(c0 + r)) continue; for (let k = 0; k < cols - 1; k++) { const a = base + r * cols + k, b = a + 1, c = a + cols, d = c + 1; idx.push(a, c, b, b, c, d); } }
    };
    const P = (i, off, dy) => { const h = cl.hd[i], rx = Math.cos(h), rz = Math.sin(h); return [cl.px[i] + rx * off, cl.py[i] + dy, cl.pz[i] + rz * off]; };
    // asphalt
    pushStrip(rp, ru, rIdx, 2, (i, k) => P(i, k ? HALFW : -HALFW, 0.0), (i, k) => [k, distAt[i] / 9], inGap);
    // curbs (left and right)
    for (const side of [-1, 1]) pushStrip(cp, cu, cIdx, 2, (i, k) => P(i, side * (HALFW + k * 0.9), 0.05 - k * 0.03), (i, k) => [k, distAt[i] / 3.2], inGap);
    // shoulders + terrain (with vertex colours)
    for (const side of [-1, 1]) {
      const base = gp.length / 3, offs = [HALFW + 0.9, HALFW + 3, ...COLS], cols = offs.length;
      for (let r = 0; r < rows; r++) {
        const i = c0 + r;
        for (let k = 0; k < cols; k++) {
          const d = offs[k], far = Math.max(0, (d - HALFW - 8) / 60);
          let y = k === 0 ? -0.03 : k === 1 ? -0.12 : -0.25 + (vnoise(distAt[i] * 0.012 + side * 31, d * 0.02) - 0.35) * Math.min(1.4, far) * 9 + Math.pow(far, 1.6) * 6 * vnoise(distAt[i] * 0.004 + side * 7, 3.3);
          let col = k <= 1 ? sh.clone() : gA.clone().lerp(gB, vnoise(distAt[i] * 0.03 + side * 11, d * 0.05));
          if (coast && side > 0 && k >= 2) { const fall = (d - HALFW - 3) * 0.12; y = Math.max(seaY - cl.py[i] - 2.5, -0.3 - fall); col = sand.clone().lerp(gB, 0.1); }
          if (flood && k >= 3) { y = Math.min(y, -0.85 + vnoise(distAt[i] * 0.02, d * 0.03 + side) * 0.5); col = mud.clone().lerp(gA, 0.3); }
          const rk = riverK(i); if (rk > 0) { y = y + (bedY(i) - y) * rk; col = col.lerp(mud, rk * 0.7); }   // river banks and bed
          const p = P(i, side * d, y); gp.push(p[0], p[1], p[2]); gc.push(col.r, col.g, col.b); gu.push(p[0] / 7, p[2] / 7);
        }
      }
      for (let r = 0; r < rows - 1; r++) for (let k = 0; k < cols - 1; k++) {
        const a = base + r * cols + k, b = a + 1, c = a + cols, d = c + 1;
        if (side > 0) gIdx.push(a, c, b, b, c, d); else gIdx.push(a, b, c, b, d, c);
      }
    }
    const mk = (pos, uv, idx, mat, colors) => {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      if (colors) g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      // the strips are built in both lateral directions: turn every triangle to face up, so normals
      // and front faces agree (the lighting reads them from above)
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
        const ux = pos[b] - pos[a], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vz = pos[c + 2] - pos[a + 2];
        if (uz * vx - ux * vz < 0) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; }
      }
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; group.add(m); return m;
    };
    roadMeshes.push(mk(rp, ru, rIdx, roadMat)); mk(cp, cu, cIdx, curbMat); mk(gp, gu, gIdx, groundMat, gc);
  }
  // fix winding of the left strips: we rely on double-sided ground for safety
  groundMat.side = THREE.DoubleSide; roadMat.side = THREE.DoubleSide; curbMat.side = THREE.DoubleSide;

  // ---- water patches over the road (floods, storm surge)
  const wp = [], wIdx = [];
  for (let i = 0; i < N; i++) {
    const w = track.segs[i].water; if (!w) continue;
    const base = wp.length / 3, ext = HALFW * (1.25 + 0.2 * w);
    for (const ii of [i, i + 1]) { const a = P2(cl, ii, -ext, 0.06), b = P2(cl, ii, ext, 0.06); wp.push(...a, ...b); }
    wIdx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  let water = null;
  if (wp.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(wp, 3)); g.setIndex(wIdx); g.computeVertexNormals();
    const mat = quality.high ? new THREE.MeshStandardMaterial({ color: "#34505b", roughness: 0.2, metalness: 0, envMapIntensity: 0.7, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
                             : new THREE.MeshPhongMaterial({ color: "#3d5a66", shininess: 90, specular: "#9fb7c2", transparent: true, opacity: 0.82, side: THREE.DoubleSide });
    water = new THREE.Mesh(g, mat); group.add(water);
  }
  // ---- delivery zone decal
  const f = track.finish, zp = [], zu = [], zIdx = [];
  for (let i = f.zoneStart; i <= f.zoneEnd; i++) {
    const a = P2(cl, i, HALFW * 0.06, 0.035), b = P2(cl, i, HALFW * 0.94, 0.035); zp.push(...a, ...b); const v = (i - f.zoneStart) / 6; zu.push(0, v, 1, v);
  }
  for (let r = 0; r < f.zoneEnd - f.zoneStart; r++) { const a = r * 2; zIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const zg = new THREE.BufferGeometry(); zg.setAttribute("position", new THREE.Float32BufferAttribute(zp, 3)); zg.setAttribute("uv", new THREE.Float32BufferAttribute(zu, 2)); zg.setIndex(zIdx);
  const zoneTex = T.chevron.clone(); zoneTex.needsUpdate = true;
  const zone = new THREE.Mesh(zg, new THREE.MeshBasicMaterial({ map: zoneTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
  zone.renderOrder = 2; group.add(zone);
  return { group, water, zone, zoneTex, seaY, roadMat, groundMat, roadMeshes, dispose() { group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } };
}
function P2(cl, i, off, dy) { const h = cl.hd[i], rx = Math.cos(h), rz = Math.sin(h); return [cl.px[i] + rx * off, cl.py[i] + dy, cl.pz[i] + rz * off]; }
