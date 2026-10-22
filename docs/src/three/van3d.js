// A true 3D model of the SBA Mobile Recovery Vehicle, built at load time from
// the real artwork (nothing is redrawn or invented):
//  * the body is the exact driver-side silhouette extruded across the van's width
//  * driver-side art is mapped on the left side, passenger-side art on the right
//  * the front view art is projected onto every forward-facing surface
//    (windshield, hood, grille, headlights) and the rear art onto the rear doors
//  * roof and other edges take their colour from the art next to them
//  * real 3D wheels (spinning, front ones steer) sit in the art's wheel arches
import * as THREE from "three";
import { glowTexture, blobTexture } from "./textures.js";

function alphaMap(sp) {
  const c = sp.canvas, g = c.getContext("2d", { willReadFrequently: true });
  return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
}
function opaqueRange(am, row) {
  let a = -1, b = -1; const y = Math.round(row * (am.h - 1));
  for (let x = 0; x < am.w; x++) if (am.d[(y * am.w + x) * 4 + 3] > 128) { if (a < 0) a = x; b = x; }
  return [a, b];
}
function findWheels(am) {
  const { w: W, h: H, d } = am, y0 = Math.floor(H * 0.55), col = new Float32Array(W);
  const dark = (i) => d[i + 3] > 200 && d[i] < 45 && d[i + 1] < 45 && d[i + 2] < 55;
  for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) if (dark((y * W + x) * 4)) col[x]++;
  const thr = (H - y0) * 0.12, runs = []; let s = -1;
  for (let x = 0; x <= W; x++) { const on = x < W && col[x] > thr; if (on && s < 0) s = x; if (!on && s >= 0) { if (x - s > W * 0.04 && x - s < W * 0.16) runs.push([s, x]); s = -1; } }
  runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  return runs.slice(0, 2).sort((a, b) => a[0] - b[0]).map(([a, b]) => ({ cx: (a + b) / 2, r: (b - a) / 2 }));
}
function texFrom(sp, opts = {}) {
  const t = new THREE.CanvasTexture(sp.canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (opts.flipX) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
  return t;
}

export function buildVan(art, quality) {
  const drv = alphaMap(art.driver), L = 6.0;
  // ---- silhouette from the driver-side art (front of the van is on the left)
  let x0 = drv.w, x1 = -1;
  const top = new Int32Array(drv.w).fill(-1), bot = new Int32Array(drv.w).fill(-1);
  for (let x = 0; x < drv.w; x++) for (let y = 0; y < drv.h; y++) if (drv.d[(y * drv.w + x) * 4 + 3] > 128) { if (top[x] < 0) top[x] = y; bot[x] = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  const k = L / (x1 - x0), H = drv.h * k;                     // metres per art pixel; sprite bottom = ground
  const wheels = findWheels(drv);
  // wheel centre heights from the dark tyre rows
  wheels.forEach(wh => { let sy = 0, n = 0; for (let y = Math.floor(drv.h * 0.55); y < drv.h; y++) for (let x = Math.floor(wh.cx - wh.r * 0.2); x < wh.cx + wh.r * 0.2; x++) { const i = (y * drv.w + x) * 4; if (drv.d[i + 3] > 200 && drv.d[i] < 45 && drv.d[i + 1] < 45) { sy += y; n++; } } wh.cy = n ? sy / n : drv.h * 0.85; });
  const rockerPx = wheels.length ? wheels.reduce((a, w) => a + w.cy, 0) / wheels.length + (wheels[0].r * 0.1) : drv.h * 0.82;
  const toS = (px) => (px - x0) * k, toY = (py) => (drv.h - py) * k;
  const poly = [];                                             // (s, y) clockwise: top front->rear, bottom rear->front
  const step = Math.max(2, Math.round((x1 - x0) / 130));
  const topS = [];
  for (let x = x0; x <= x1; x += step) if (top[x] >= 0) topS.push([x, top[x]]);
  // smooth the roof line (removes trace jaggies, keeps real contours)
  const sm = topS.map((p, i) => { let a = 0, n = 0; for (let k = -2; k <= 2; k++) { const q = topS[Math.max(0, Math.min(topS.length - 1, i + k))]; a += q[1]; n++; } return [p[0], i < 2 || i > topS.length - 3 ? p[1] : a / n]; });
  for (const [x, y] of sm) poly.push([toS(x), toY(y)]);
  if (poly[poly.length - 1][0] < L - 1e-3) poly.push([L, toY(top[x1])]);
  const botY = (x) => toY(Math.min(bot[x], rockerPx));
  poly.push([L, botY(x1)]);
  for (let x = x1 - step * 2; x > x0; x -= step * 4) poly.push([toS(x), botY(x)]);
  poly.push([0, botY(x0)]);
  // ---- width from the rear art: body edges measured at bumper height
  const rr = alphaMap(art.rear), [rL, rR] = opaqueRange(rr, 0.72);
  const W = (rR - rL) / rr.h * H;                               // rear art height == van height
  const fr = art.front ? alphaMap(art.front) : null, [fL, fR] = fr ? opaqueRange(fr, 0.8) : [0, 1];

  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const high = quality.high;
  const Paint = high ? THREE.MeshStandardMaterial : THREE.MeshPhongMaterial;
  const paint = (map) => high ? new Paint({ map, roughness: 0.32, metalness: 0.15, side: THREE.DoubleSide }) : new Paint({ map, shininess: 70, specular: 0x333333, side: THREE.DoubleSide });

  // ---- smooth rounded body: one surface around the silhouette with rounded
  // edges (radius R), a crowned roof and slight tumblehome, plus two side caps.
  const R = 0.15, CROWN = 0.07, M = 4, K = 6;
  const nP = poly.length;
  const vn = poly.map((p, j) => { // outward vertex normal in (s, y)
    const a0 = poly[(j - 1 + nP) % nP], a1 = poly[(j + 1) % nP];
    const e0 = [p[0] - a0[0], p[1] - a0[1]], e1 = [a1[0] - p[0], a1[1] - p[1]];
    const n0 = [-e0[1], e0[0]], n1 = [-e1[1], e1[0]], l0 = Math.hypot(...n0) || 1, l1 = Math.hypot(...n1) || 1;
    const n = [n0[0] / l0 + n1[0] / l1, n0[1] / l0 + n1[1] / l1], l = Math.hypot(...n) || 1; return [n[0] / l, n[1] / l];
  });
  const taper = (y) => 1 - 0.07 * Math.max(0, Math.min(1, (y - 0.5 * H) / (0.5 * H)));   // narrower toward the roof
  const ps = art.passenger ? alphaMap(art.passenger) : null;
  let p0 = 0, p1 = 1, kp = k, Hp = H;
  if (ps) { p0 = ps.w; p1 = -1; for (let x = 0; x < ps.w; x++) for (let y = Math.floor(ps.h * 0.2); y < ps.h * 0.6; y += 3) if (ps.d[(y * ps.w + x) * 4 + 3] > 128) { if (x < p0) p0 = x; if (x > p1) p1 = x; } kp = L / (p1 - p0); Hp = ps.h * kp; }
  const uvDrv = (s_, y) => [(x0 + s_ / k) / drv.w, y / H], uvPas = ps ? (s_, y) => [(p1 - s_ / kp) / ps.w, y / Hp] : uvDrv;
  const uvFront = (x, y) => fr ? [(fL + (1 - (x + W / 2) / W) * (fR - fL)) / fr.w, y / H] : [0, 0];
  const uvRear = (x, y) => [(rL + ((x + W / 2) / W) * (rR - rL)) / rr.w, y / H];
  const sampleCol = (s_, y, ns, ny) => { const px = Math.round(x0 + (s_ - ns * 0.05) / k), py = Math.round(drv.h - (y - ny * 0.05) / k);
    const i = (Math.max(0, Math.min(drv.h - 1, py)) * drv.w + Math.max(0, Math.min(drv.w - 1, px))) * 4;
    const c = drv.d[i + 3] > 100 ? [drv.d[i] / 255, drv.d[i + 1] / 255, drv.d[i + 2] / 255] : [0.11, 0.24, 0.45]; return c.map(v => Math.pow(v, 2.2)); };
  const P = [], N = [], U0 = [], U1 = [], U2 = [], U3 = [], CO = [];
  const push = (x, s_, y, nx, ns, ny, ref) => {
    const tp = taper(y); P.push(x * tp, y, s_ - L / 2); const nl = Math.hypot(nx, ns, ny) || 1; N.push(nx / nl, ny / nl, ns / nl);
    U0.push(...uvDrv(ref[0], ref[1])); U1.push(...uvPas(ref[0], ref[1])); U2.push(...uvFront(x, y)); U3.push(...uvRear(x, y));
    CO.push(...(ny < -0.5 ? [0.004, 0.004, 0.005] : sampleCol(ref[0], ref[1], ns, ny)));
  };
  const hw = W / 2 - R;
  for (let j = 0; j < nP; j++) {
    const [s_, y] = poly[j], [ns, ny] = vn[j], si = s_ - ns * R, yi = y - ny * R;
    for (let i = 0; i <= M; i++) { const th = i / M * Math.PI / 2, c = Math.cos(th), sn = Math.sin(th); push(-(hw + R * c), si + ns * R * sn, yi + ny * R * sn, -c, ns * sn, ny * sn, [si + ns * R * sn, yi + ny * R * sn]); }
    for (let i = 1; i < K; i++) { const x = -hw + 2 * hw * i / K, cr = CROWN * (1 - Math.pow(x / hw, 2)) * Math.max(0, ny); push(x, s_ + ns * cr, y + ny * cr, 0, ns, ny, [s_, y]); }
    for (let i = M; i >= 0; i--) { const th = i / M * Math.PI / 2, c = Math.cos(th), sn = Math.sin(th); push(hw + R * c, si + ns * R * sn, yi + ny * R * sn, c, ns * sn, ny * sn, [si + ns * R * sn, yi + ny * R * sn]); }
  }
  const RING = (M + 1) * 2 + (K - 1);
  const groups = [[], [], [], [], []];                          // driver, passenger, front, rear, colour
  for (let j = 0; j < nP; j++) {
    const jn = (j + 1) % nP;
    for (let i = 0; i < RING - 1; i++) {
      const a = j * RING + i, b2 = a + 1, c = jn * RING + i, d = c + 1;
      const nx = N[a * 3] + N[b2 * 3] + N[c * 3] + N[d * 3], ny = N[a * 3 + 1] + N[b2 * 3 + 1] + N[c * 3 + 1] + N[d * 3 + 1], nz = N[a * 3 + 2] + N[b2 * 3 + 2] + N[c * 3 + 2] + N[d * 3 + 2], l = Math.hypot(nx, ny, nz) || 1;
      const g = Math.abs(nx / l) > 0.55 ? (nx < 0 ? 0 : 1) : (ny / l < -0.5 ? 4 : nz / l < -0.3 ? 2 : nz / l > 0.3 ? 3 : 4);
      groups[g].push(a, c, b2, b2, c, d);
    }
  }
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); bodyGeo.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  bodyGeo.setAttribute("uv", new THREE.Float32BufferAttribute(U0, 2)); bodyGeo.setAttribute("uv1", new THREE.Float32BufferAttribute(U1, 2));
  bodyGeo.setAttribute("uv2", new THREE.Float32BufferAttribute(U2, 2)); bodyGeo.setAttribute("uv3", new THREE.Float32BufferAttribute(U3, 2));
  bodyGeo.setAttribute("color", new THREE.Float32BufferAttribute(CO, 3));
  const idx = []; groups.forEach((g, gi) => { bodyGeo.addGroup(idx.length, g.length, gi); idx.push(...g); }); bodyGeo.setIndex(idx);
  const tex = (sp, ch) => { const t = texFrom(sp); t.channel = ch; return t; };
  const driverTex = texFrom(art.driver);
  const restMat = high ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.15, side: THREE.DoubleSide }) : new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, side: THREE.DoubleSide });
  const mats = [paint(tex(art.driver, 0)), paint(tex(art.passenger || art.driver, 1)), paint(fr ? tex(art.front, 2) : null), paint(tex(art.rear, 3)), restMat];
  body.add(new THREE.Mesh(bodyGeo, mats));
  // side caps: the inset silhouette, flat sides carrying the full livery
  const inset = poly.map(([s_, y], j) => [s_ - vn[j][0] * R, y - vn[j][1] * R]);
  const capGeo = (sideX, uvOf) => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(inset.map(([s_, y]) => new THREE.Vector2(s_, y))), 1), pos = g.attributes.position, uv = g.attributes.uv, nrm = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) { const s_ = pos.getX(i), y = pos.getY(i); pos.setXYZ(i, sideX * taper(y), y, s_ - L / 2); const t = uvOf(s_, y); uv.setXY(i, t[0], t[1]); nrm.setXYZ(i, Math.sign(sideX), 0, 0); }
    if (sideX > 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }   // face outward on the right side too
    return g;
  };
  body.add(new THREE.Mesh(capGeo(-W / 2, uvDrv), paint(driverTex)));
  body.add(new THREE.Mesh(capGeo(W / 2, uvPas), paint(texFrom(art.passenger || art.driver))));
  // underbody (so you never see through the van between the wheels)
  const under = new THREE.Mesh(new THREE.BoxGeometry(W * 0.72, 0.18, L * 0.8), new THREE.MeshLambertMaterial({ color: 0x0c0d10 }));
  under.position.set(0, toY(rockerPx) - 0.04, 0); body.add(under);
  // mirrors
  const mirMat = high ? new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.4 }) : new THREE.MeshPhongMaterial({ color: 0x15171b, shininess: 40 });
  const mirGeo = new THREE.SphereGeometry(1, 12, 8), armGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6);
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(mirGeo, mirMat); m.scale.set(0.06, 0.17, 0.12); m.position.set(sx * (W / 2 + 0.2), H * 0.6, -L / 2 + L * 0.21); body.add(m);
    const arm = new THREE.Mesh(armGeo, mirMat); arm.rotation.z = Math.PI / 2; arm.position.set(sx * (W / 2 + 0.08), H * 0.58, -L / 2 + L * 0.21); body.add(arm);
  }

  // ---- wheels (real geometry, the art's hub cut out and spun)
  const wheelObjs = [];
  const tyreMat = new THREE.MeshLambertMaterial({ color: 0x0c0d10 });
  const hubTex = (() => {
    const w0 = wheels[0]; if (!w0) return null;
    const r = Math.round(w0.r * 0.66), c = document.createElement("canvas"); c.width = c.height = r * 2; const g = c.getContext("2d");
    g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.clip(); g.drawImage(art.driver.canvas, w0.cx - r, w0.cy - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const hubMat = hubTex ? new THREE.MeshLambertMaterial({ map: hubTex }) : new THREE.MeshLambertMaterial({ color: 0xc9cbd0 });
  (wheels.length === 2 ? wheels : [{ cx: x0 + (x1 - x0) * 0.2, cy: drv.h * 0.85, r: (x1 - x0) * 0.06 }, { cx: x0 + (x1 - x0) * 0.78, cy: drv.h * 0.85, r: (x1 - x0) * 0.06 }]).forEach((wh, idx) => {
    const r = wh.r * k * 0.98, s = toS(wh.cx), y = toY(wh.cy);
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * (W / 2 - 0.1), y, s - L / 2); body.add(pivot);
      const spin = new THREE.Group(); pivot.add(spin);
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.27, 22), tyreMat); tyre.rotation.z = Math.PI / 2; spin.add(tyre);
      const hub = new THREE.Mesh(new THREE.CircleGeometry(r * 0.66, 22), hubMat); hub.position.x = sx * 0.14; hub.rotation.y = sx * Math.PI / 2; spin.add(hub);
      wheelObjs.push({ pivot, spin, front: idx === 0, r });
    }
  });

  // ---- lights: glow sprites at the art's lamp positions
  const glowTex = glowTexture();
  const mkGlow = (color, size) => { const m = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.0 }); const sp = new THREE.Sprite(m); sp.scale.set(size, size, 1); body.add(sp); return sp; };
  const RL = art.rear.lights || { left: [0.11, 0.55], right: [0.89, 0.55], top: [0.5, 0.1] };
  const toRear = (p) => new THREE.Vector3(((p[0] * rr.w - rL) / (rR - rL) - 0.5) * W, (1 - p[1]) * H, L / 2 + 0.05);
  const tail = [mkGlow(0xff2a2a, 0.55), mkGlow(0xff2a2a, 0.55)]; tail[0].position.copy(toRear(RL.left)); tail[1].position.copy(toRear(RL.right));
  const brakeTop = mkGlow(0xff2020, 0.7); brakeTop.position.copy(toRear(RL.top));
  const heads = [mkGlow(0xfff2d0, 0.8), mkGlow(0xfff2d0, 0.8)]; heads[0].position.set(-W * 0.36, H * 0.42, -L / 2 - 0.05); heads[1].position.set(W * 0.36, H * 0.42, -L / 2 - 0.05);
  // headlight beam pools on the road (cheap fake lighting)
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 14), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffe6b0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.06, -L / 2 - 7); root.add(pool);
  // soft contact shadow
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, L * 1.25), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.9 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.04; root.add(blob);

  body.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return {
    root, body, wheels: wheelObjs, dims: { L, W, H },
    update(st) { // st: { speed m/s, dt, steer -1..1, brake 0..1, night 0..1, roll, pitch, bounce }
      for (const w of wheelObjs) { w.spin.rotation.x -= st.speed * st.dt / w.r; if (w.front) w.pivot.rotation.y = -st.steer * 0.42; }
      body.rotation.z = st.roll || 0; body.rotation.x = st.pitch || 0; body.position.y = st.bounce || 0;
      const tailA = 0.25 + 0.55 * st.night + 0.9 * st.brake;
      tail.forEach(t => { t.material.opacity = Math.min(1, tailA) * 0.8; t.scale.setScalar(0.5 + 0.45 * st.brake); });
      brakeTop.material.opacity = st.brake * 0.9;
      heads.forEach(h => h.material.opacity = 0.08 + 0.7 * st.night);
      pool.material.opacity = 0.32 * st.night;
    },
  };
}
