// The stage jumps in 3D: the raised drawbridge over a river (stage 1) and the parked car carrier
// with its ramp down (stage 2). The drawbridge's leaves are the road itself (the track tilts them);
// this adds what makes it read as a bridge: girders, railings, piers into the river, the tender's
// house, flashing warning lights and raised gates. The carrier is a complete truck.
import * as THREE from "../../vendor/three/three.module.js";
import { SEG } from "../track.js";
import { U2M, HALFW, worldAt } from "./space.js";
import { carGeometry, CAR_COLORS } from "./props3d.js";
import { glowTexture, textTexture } from "./textures.js";
import { mergeStatic } from "./heli3d.js";

function stripes() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 32; const g = c.getContext("2d");
  g.fillStyle = "#f2c230"; g.fillRect(0, 0, 128, 32); g.fillStyle = "#151515";
  for (let x = -32; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
// a box from point a to point b (centre line), w wide and h tall
function beam(a, b, w, h, mat) {
  const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d.length()), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); return m;
}
const at = (cl, i, xh, dy = 0) => { const p = worldAt(cl, i * SEG, xh); return new THREE.Vector3(p.x, p.y + dy, p.z); };

export function buildJumps(track, cl, look, q) {
  const group = new THREE.Group(), flashers = [];
  const Lit = q.high ? THREE.MeshStandardMaterial : THREE.MeshLambertMaterial, lit = (color, o = {}) => new Lit({ color, ...(q.high ? { roughness: o.r ?? 0.7, metalness: o.m ?? 0.1 } : {}) });
  const steel = lit(0x4f6d84, { r: 0.5, m: 0.6 }), dark = lit(0x22272d, { r: 0.6, m: 0.4 }), concrete = lit(0x9a9a94, { r: 0.95 }), rail = lit(0xd8dde2, { r: 0.4, m: 0.6 });
  const yellow = new Lit({ map: stripes(), ...(q.high ? { roughness: 0.6 } : {}) });
  const glowTex = glowTexture();
  const flasher = (pos, color, phase, size = 1.6) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.position.copy(pos); s.scale.set(size, size, 1); group.add(s);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color })); b.position.copy(pos); group.add(b); flashers.push({ s, b, phase });
  };
  let water = null;
  for (const j of track.jumps || []) {
    if (j.kind === "drawbridge") {
      const deckY = j.deckY * U2M, waterY = deckY - 5.2, edge = 1 + 0.75 / HALFW, railX = 1 + 0.55 / HALFW;
      // the leaves: a deck slab and two box girders under each, a striped lip at the gap end
      for (const [a, b] of [[j.up0 - 1, j.gap0], [j.gap1, j.down1]]) {
        group.add(beam(at(cl, a, 0, -0.32), at(cl, b, 0, -0.32), HALFW * 2 + 1.4, 0.55, steel));
        for (const sx of [-1, 1]) {
          group.add(beam(at(cl, a, sx * edge, -0.95), at(cl, b, sx * edge, -0.95), 0.55, 1.5, steel));
          group.add(beam(at(cl, a, sx * railX, 1.05), at(cl, b, sx * railX, 1.05), 0.09, 0.09, rail));
          group.add(beam(at(cl, a, sx * railX, 0.55), at(cl, b, sx * railX, 0.55), 0.06, 0.06, rail));
          for (let i = a; i <= b; i += 3) group.add(beam(at(cl, i, sx * railX, 0.0), at(cl, i, sx * railX, 1.1), 0.08, 0.08, rail));
        }
        const tip = a === j.up0 - 1 ? b : a;                                       // the raised end at the gap
        group.add(beam(at(cl, tip, -1.02, -0.3), at(cl, tip, 1.02, -0.3), 0.7, 0.62, yellow));
      }
      // piers at the hinge ends, standing in the river
      for (const i of [j.up0, j.down1]) {
        const p = at(cl, i, 0), h = deckY - waterY + 2.5, m = new THREE.Mesh(new THREE.BoxGeometry(HALFW * 2 + 4, h, 5), concrete);
        m.position.set(p.x, deckY - h / 2 - 0.55, p.z); m.rotation.y = -worldAt(cl, i * SEG, 0).h; group.add(m);
      }
      // operator towers at both piers: the silhouette that says "drawbridge" from far off
      for (const i of [j.up0 - 1, j.down1 + 1]) for (const sx of [-1, 1]) {
        const p = at(cl, i, sx * (1 + 2.6 / HALFW)), tw = new THREE.Group(); tw.position.set(p.x, deckY, p.z); tw.rotation.y = -worldAt(cl, i * SEG, 0).h; group.add(tw);
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 13, 2.6), steel); body.position.y = 6.5 - 3; tw.add(body);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 3.4), lit(0xc9c2b0)); cab.position.y = 10.8; tw.add(cab);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(3.45, 1.0, 3.45), new THREE.MeshBasicMaterial({ color: 0xffd58a })); glass.position.y = 11.0; tw.add(glass);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.8, 4), lit(0x8a2a24)); roof.position.y = 13.0; roof.rotation.y = Math.PI / 4; tw.add(roof);
        tw.updateMatrixWorld(true); flasher(new THREE.Vector3(0, 14.2, 0).applyMatrix4(tw.matrixWorld), 0xff2a20, sx > 0 ? 0.5 : 0, 2.4);
      }
      // bridge tender's house on the near pier, with a lit window and a beacon
      { const p = at(cl, j.up0 - 2, 1 + 4.5 / HALFW), h = -worldAt(cl, j.up0 * SEG, 0).h;
        const house = new THREE.Group(); house.position.set(p.x, deckY, p.z); house.rotation.y = h; group.add(house);
        const body = new THREE.Mesh(new THREE.BoxGeometry(4, 3.4, 4), lit(0xc9c2b0)); body.position.y = 1.7; house.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 1.6, 4), lit(0x8a2a24)); roof.position.y = 4.2; roof.rotation.y = Math.PI / 4; house.add(roof);
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), new THREE.MeshBasicMaterial({ color: 0xffd58a })); win.position.set(-2.01, 2.2, 0); win.rotation.y = -Math.PI / 2; house.add(win);
        house.updateMatrixWorld(true); flasher(new THREE.Vector3(0, 5.3, 0).applyMatrix4(house.matrixWorld), 0xff2a20, 0.25, 2.2); }
      // warning lights and raised gate arms at both ends, and a warning sign on the run-in
      for (const [i, dir] of [[j.up0 - 3, 1], [j.down1 + 3, -1]]) for (const sx of [-1, 1]) {
        const base = at(cl, i, sx * (1 + 1.2 / HALFW)), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 8), dark); pole.position.copy(base).add(new THREE.Vector3(0, 1.7, 0)); group.add(pole);
        flasher(base.clone().add(new THREE.Vector3(0, 3.3, 0)), 0xff2a20, sx > 0 ? 0 : 0.5);
        const arm = beam(base.clone().add(new THREE.Vector3(0, 1.2, 0)), at(cl, i + dir * 2, sx * (1 + 1.2 / HALFW), 6.5), 0.18, 0.18, yellow); group.add(arm);
      }
      { const p = at(cl, j.up0 - 60, 1 + 1.6 / HALFW), tex = textTexture([{ text: "DRAWBRIDGE", size: 84, color: "#151515" }, { text: "SPEED UP TO JUMP", size: 70, color: "#151515" }], { bg: "#F2C230", border: "#151515", w: 512, h: 320 });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); sign.position.set(p.x, p.y + 3.2, p.z); sign.rotation.y = -worldAt(cl, (j.up0 - 60) * SEG, 0).h; group.add(sign);
        group.add(beam(new THREE.Vector3(p.x, p.y, p.z), new THREE.Vector3(p.x, p.y + 2.2, p.z), 0.12, 0.12, dark)); }
      // the river (the terrain is cut for it in road3d)
      const c = at(cl, (j.gap0 + j.gap1) / 2, 0), len = (j.span1 - j.span0 + 30) * SEG * U2M;
      water = new THREE.Mesh(new THREE.PlaneGeometry(900, len).rotateX(-Math.PI / 2),
        q.high ? new THREE.MeshStandardMaterial({ color: 0x2c5266, roughness: 0.12, metalness: 0.35 }) : new THREE.MeshPhongMaterial({ color: 0x2c5266, shininess: 80, specular: 0x8fb3c4 }));
      water.position.set(c.x, waterY, c.z); water.rotation.y = -worldAt(cl, ((j.gap0 + j.gap1) / 2) * SEG, 0).h; water.receiveShadow = true; group.add(water);
    }
    if (j.kind === "kicker") {
      // a steel launch ramp: diamond-plate deck on a braced frame, striped edges, amber flashers
      const g = new THREE.Group(), p0 = at(cl, j.i0, j.lane), rampL = j.ramp * SEG * U2M, W = 2.7;
      g.position.copy(p0); g.rotation.y = -worldAt(cl, j.i0 * SEG, j.lane).h; group.add(g);
      const side = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(rampL, 0), new THREE.Vector2(rampL, j.H), new THREE.Vector2(rampL - 0.25, j.H)]);
      const sideGeo = new THREE.ExtrudeGeometry(side, { depth: 0.12, bevelEnabled: false });
      for (const sx of [-1, 1]) { const m = new THREE.Mesh(sideGeo, steel); m.rotation.y = Math.PI / 2; m.position.set(sx * (W / 2) - (sx > 0 ? 0.12 : 0), 0, 0); m.scale.set(1, 1, 1); g.add(m); }
      g.add(beam(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, j.H, -rampL), W, 0.1, lit(0x8a9096, { r: 0.45, m: 0.7 })));
      for (const sx of [-1, 1]) g.add(beam(new THREE.Vector3(sx * (W / 2 - 0.1), 0.06, 0), new THREE.Vector3(sx * (W / 2 - 0.1), j.H + 0.05, -rampL), 0.2, 0.08, yellow));
      g.add(beam(new THREE.Vector3(-W / 2, j.H - 0.15, -rampL + 0.05), new THREE.Vector3(W / 2, j.H - 0.15, -rampL + 0.05), 0.5, 0.3, yellow));
      for (const t of [0.35, 0.7]) for (const sx of [-1, 1]) g.add(beam(new THREE.Vector3(sx * (W / 2 - 0.3), 0, -rampL * t), new THREE.Vector3(sx * (W / 2 - 0.3), j.H * t, -rampL * t), 0.12, 0.12, dark));
      g.updateMatrixWorld(true);
      for (const sx of [-1, 1]) flasher(new THREE.Vector3(sx * W / 2, j.H + 0.35, -rampL).applyMatrix4(g.matrixWorld), 0xffa020, sx > 0 ? 0.5 : 0, 1.6);
      const sp = at(cl, j.i0 - 60, (j.lane >= 0 ? 1 : -1) * (1 + 1.6 / HALFW)), tex = textTexture([{ text: "RAMP AHEAD", size: 84, color: "#151515" }, { text: j.lane > 0.3 ? "RIGHT LANE" : j.lane < -0.3 ? "LEFT LANE" : "CENTER LANE", size: 70, color: "#151515" }], { bg: "#F2C230", border: "#151515", w: 512, h: 320 });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); sign.position.set(sp.x, sp.y + 3.2, sp.z); sign.rotation.y = -worldAt(cl, (j.i0 - 60) * SEG, 0).h; group.add(sign);
      group.add(beam(new THREE.Vector3(sp.x, sp.y, sp.z), new THREE.Vector3(sp.x, sp.y + 2.2, sp.z), 0.12, 0.12, dark));
    }
    if (j.kind === "carrier") {
      // built in its own frame: forward is -z, the rear of the ramp at z = 0, standing on the road
      const truck = new THREE.Group(), p0 = at(cl, j.i0, j.lane), rampL = j.ramp * SEG * U2M, deckL = j.deck * SEG * U2M, cabL = j.cab * SEG * U2M, W = 2.6;
      truck.position.copy(p0); truck.rotation.y = -worldAt(cl, j.i0 * SEG, j.lane).h; group.add(truck);
      const add = (m, x, y, z) => { m.position.set(x, y, z); truck.add(m); return m; };
      const deckMat = lit(0x7a8088, { r: 0.6, m: 0.5 }), frame = lit(0xdfe3e8, { r: 0.45, m: 0.5 }), cabMat = lit(0xf4f6f8, { r: 0.3, m: 0.3 }), tyre = lit(0x101113, { r: 0.9 }), redMat = lit(0xcd2127, { r: 0.4 });
      const marker = new THREE.MeshBasicMaterial({ color: 0xffa21f });
      // rear ramp, upper deck and the kick at its front (the van's path), striped edges
      const ramp = beam(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, j.H - 0.05, -rampL), W, 0.12, deckMat); truck.add(ramp);
      add(new THREE.Mesh(new THREE.BoxGeometry(W, 0.14, deckL - 3), deckMat), 0, j.H - 0.07, -rampL - (deckL - 3) / 2);
      truck.add(beam(new THREE.Vector3(0, j.H - 0.05, -rampL - deckL + 3), new THREE.Vector3(0, j.H + j.kick - 0.05, -rampL - deckL), W, 0.12, deckMat));
      for (const sx of [-1, 1]) {
        truck.add(beam(new THREE.Vector3(sx * (W / 2 - 0.08), 0.02, 0), new THREE.Vector3(sx * (W / 2 - 0.08), j.H + 0.02, -rampL), 0.16, 0.14, yellow));
        add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, deckL), yellow), sx * (W / 2 - 0.08), j.H + 0.03, -rampL - deckL / 2);
        // trailer frame: lower deck rails, uprights between the decks
        add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, rampL + deckL - 1), frame), sx * (W / 2 - 0.15), 1.0, -(rampL + deckL) / 2 - 0.5);
        for (let z = -rampL; z >= -rampL - deckL + 0.5; z -= 3.3) add(new THREE.Mesh(new THREE.BoxGeometry(0.16, j.H - 1.0, 0.16), frame), sx * (W / 2 - 0.12), (j.H + 1.0) / 2, z);
      }
      add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.12, rampL + deckL - 1.5), deckMat), 0, 1.05, -(rampL + deckL) / 2 - 0.4);
      // cars riding on the lower deck
      ["sedan", "hatch", "sedan"].forEach((type, k) => {                          // body colour on the material, details from the vertex colours
        const g = carGeometry(type).clone(), mat = new Lit({ color: CAR_COLORS[(k * 2 + 1) % CAR_COLORS.length], vertexColors: !!g.attributes.color, ...(q.high ? { roughness: 0.4, metalness: 0.3 } : {}) });
        add(new THREE.Mesh(g, mat), 0, 1.12, -rampL - 2.6 - k * 5.2);
      });
      // trailer wheels, cab and its wheels
      const wheel = (x, z, r = 0.52) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.5, 18), tyre); m.rotation.z = Math.PI / 2; add(m, x, r, z); };
      for (const z of [-rampL - 1.2, -rampL - 2.6]) for (const sx of [-1, 1]) wheel(sx * (W / 2 - 0.25), z);
      const cz = -rampL - deckL - cabL / 2;
      add(new THREE.Mesh(new THREE.BoxGeometry(W, 2.0, cabL * 0.45), cabMat), 0, 2.15, cz + cabL * 0.18);                 // sleeper cab
      add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 1.3, cabL * 0.5), cabMat), 0, 1.5, cz - cabL * 0.25);               // hood
      add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.9, 0.08), new THREE.MeshBasicMaterial({ color: 0x0a1624 })), 0, 2.7, cz - cabL * 0.04 - 0.01);   // windshield
      add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.5, cabL), frame), 0, 0.75, cz);
      for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, cabL * 0.9), redMat), sx * (W / 2 + 0.01), 1.75, cz);      // cab stripe
      for (const sx of [-1, 1]) for (let z = -1; z >= -rampL - deckL; z -= 2.4) add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.22), marker), sx * (W / 2 + 0.02), j.H + 0.1, z);   // side markers
      for (const z of [cz - cabL * 0.35, cz + cabL * 0.3]) for (const sx of [-1, 1]) wheel(sx * (W / 2 - 0.2), z, 0.55);
      truck.updateMatrixWorld(true);
      for (const [x, z] of [[-W / 2, 0.05], [W / 2, 0.05], [-W / 2, cz - cabL / 2 - 0.05], [W / 2, cz - cabL / 2 - 0.05]]) flasher(new THREE.Vector3(x, z > -1 ? 1.0 : 1.2, z).applyMatrix4(truck.matrixWorld), 0xffa020, 0, 1.8);
      for (let k = 0; k < 5; k++) flasher(new THREE.Vector3(-W / 2 + 0.2 + k * (W - 0.4) / 4, j.H + 0.9, -rampL - 0.2).applyMatrix4(truck.matrixWorld), 0xffb030, k % 2 ? 0.5 : 0, 1.5);   // light bar over the ramp
      add(new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, 0.1), frame), 0, j.H + 0.8, -rampL - 0.2);
      // a hint on the run-in
      const sp = at(cl, j.i0 - 70, 1 + 1.6 / HALFW), tex = textTexture([{ text: "RAMP IN RIGHT LANE", size: 70, color: "#151515" }, { text: "LINE UP OR GO AROUND", size: 62, color: "#151515" }], { bg: "#F2C230", border: "#151515", w: 512, h: 320 });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); sign.position.set(sp.x, sp.y + 3.2, sp.z); sign.rotation.y = -worldAt(cl, (j.i0 - 70) * SEG, 0).h; group.add(sign);
      group.add(beam(new THREE.Vector3(sp.x, sp.y, sp.z), new THREE.Vector3(sp.x, sp.y + 2.2, sp.z), 0.12, 0.12, dark));
    }
  }
  // everything that does not blink becomes a few draws
  const keep = new Set(flashers.flatMap(f => [f.s, f.b])); if (water) keep.add(water);
  mergeStatic(group, (o) => keep.has(o));
  group.traverse(o => { if (o.isMesh && o !== water) { o.castShadow = !!q.shadows; o.receiveShadow = true; } });
  return { group, update(t) { for (const f of flashers) { const on = ((t * 1.25 + f.phase) % 1) < 0.5; f.s.material.opacity = on ? 1 : 0.08; f.b.visible = on; } } };
}
