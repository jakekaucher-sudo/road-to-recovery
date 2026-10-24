// The 3D game world: builds each stage from the track data and keeps it in
// sync with the game state every frame (van, traffic, hazards, pickups,
// weather, business facade, camera).
import * as THREE from "three";
import { SEG } from "../track.js";
import { U2M, SEGM, HALFW, buildCenterline, worldAt, pitchAt } from "./space.js";
import { LOOKS } from "./look.js";
import { makeSky } from "./sky.js";
import { buildRoad } from "./road3d.js";
import { PROPS, carParts, CAR_COLORS, CAR_DIM, stopBuildingGeo, setPropDetail } from "./props3d.js";
import { buildVan } from "./van3d.js";
import { buildHeli } from "./heli3d.js";
import { buildJumps } from "./jumps3d.js";
import { kindSpec } from "../buildings.js";
import { makeRain, makeParticles, makeFlyingDebris, makeLightning, makeTornado, makeWater } from "./fx3d.js";
import { textTexture, glowTexture, blobTexture } from "./textures.js";
import { drawStorefront } from "../buildings.js";
import { CAM } from "../render.js";
import { loadDetail, roadMaterial, groundMaterial, foliageAtlas, propSurface } from "./realism.js";
import { INPUT } from "../input.js";

const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
const lerp = (a, b, t) => a + (b - a) * t;
function lookBlend(a, b, t) { const o = {}; for (const k in b) { const va = a[k], vb = b[k]; if (typeof vb === "string" && vb[0] === "#") o[k] = tmpC.set(va ?? vb).lerp(tmpC2.set(vb), t).getHexString().replace(/^/, "#"); else if (typeof vb === "number") o[k] = lerp(va ?? vb, vb, t); else o[k] = t < 0.5 ? va : vb; } return o; }

// Wind sway for vegetation (vertex shader, scaled by height).
function swayMaterial(uni, high) {
  const m = high ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }) : new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uni.uTime; sh.uniforms.uWind = uni.uWind;
    sh.vertexShader = "uniform float uTime; uniform float uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      float hgt = max(position.y, 0.0); vec4 ip = instanceMatrix[3];
      float sw = (0.25 + uWind * 1.6) * sin(uTime * (1.4 + uWind * 2.5) + ip.x * 0.31 + ip.z * 0.17) * 0.04 * hgt + uWind * 0.06 * hgt;
      transformed.x += sw * (hgt / 6.0);`);
  };
  return m;
}

export class World3D {
  constructor(engine, cfg, art, quality) {
    this.e = engine; this.cfg = cfg; this.q = quality;
    const s = this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(62, 1, 0.3, quality.far);
    this.sky = makeSky(); s.add(this.sky.mesh);
    s.fog = new THREE.Fog(0xcccccc, 60, 600);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2); s.add(this.sun); s.add(this.sun.target);
    if (quality.shadows) { this.sun.castShadow = true; const sc = this.sun.shadow; const S = quality.high ? 42 : 14; sc.mapSize.set(quality.high ? 4096 : quality.shadowMap || 1024, quality.high ? 4096 : quality.shadowMap || 1024); sc.camera.left = -S; sc.camera.right = S; sc.camera.top = S; sc.camera.bottom = -S; sc.camera.near = 1; sc.camera.far = 160; sc.bias = -0.0008; sc.normalBias = 0.03; }
    this.uni = { uTime: { value: 0 }, uWind: { value: 0 } };
    this.sway = swayMaterial(this.uni, quality.high); this.solid = quality.high ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 }) : new THREE.MeshLambertMaterial({ vertexColors: true });
    // desktops: photo detail on road and verges, leafy crowns, surface detail on the props
    if (quality.high) {
      loadDetail(engine.renderer);
      // leafy crowns: drawn leaves cut out of the atlas, both sides of each card lit
      Object.assign(this.sway, { map: foliageAtlas(), alphaTest: 0.42, side: THREE.DoubleSide });
      propSurface(this.solid);
    }
    this.van = buildVan(art, quality); s.add(this.van.root);
    if (quality.high) { this.headSpot = new THREE.SpotLight(0xfff0d0, 0, 60, 0.5, 0.6, 1.2); this.van.root.add(this.headSpot); this.headSpot.position.set(0, 1.0, -2.8); this.headSpot.target.position.set(0, 0, -25); this.van.root.add(this.headSpot.target); }
    this.rain = makeRain(quality.rain); s.add(this.rain.mesh);
    this.parts = makeParticles(quality.particles); s.add(this.parts.mesh);
    this.flying = makeFlyingDebris(quality.debris); s.add(this.flying.mesh);
    this.bolt = makeLightning(); s.add(this.bolt.mesh);
    this.tornado = makeTornado(); s.add(this.tornado.group); this.tornado.group.visible = false;
    this.ocean = makeWater("ocean", quality.high, 1600, quality.high ? 110 : 60); s.add(this.ocean.mesh); this.ocean.mesh.visible = false;
    this.flood = makeWater("flood", quality.high, 900, 30); s.add(this.flood.mesh); this.flood.mesh.visible = false;
    this.stage = null; this.camState = { pos: new THREE.Vector3(), look: new THREE.Vector3(), heading: 0, init: false };
    this.v3 = new THREE.Vector3(); this.m4 = new THREE.Matrix4(); this.q4 = new THREE.Quaternion(); this.eul = new THREE.Euler(); this.one = new THREE.Vector3(1, 1, 1); this.zero = new THREE.Vector3(0, 0, 0);
    this.lastX = 0; this.yawVis = 0;
    // the SBA escort helicopter (hidden bonus): built in the background, shown only during an escort
    this.heli = null;
    buildHeli(quality).then(h => {
      this.heli = h; h.root.visible = false; s.add(h.root);
      const sh = this.heliShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.35 }));
      sh.scale.set(12, 1, 15); sh.visible = false; s.add(sh);
    }).catch(e => console.warn("helicopter", e));
  }
  // shaders for the helicopter are compiled with the stage, so its first appearance never stutters
  heliWarm(on) { if (this.heli) this.heli.root.visible = on; }

  // ------------------------------------------------------------------ stage build
  loadStage(game) {
    if (this.stage) this.freeStage(this.stage);
    const track = game.track, cl = buildCenterline(track), stageCfg = game.stageCfg;
    const look = LOOKS[stageCfg.weather] || LOOKS.dusk, prevLook = game.stageIndex > 0 ? LOOKS[this.cfg.stages[game.stageIndex - 1].weather] : LOOKS.dusk;
    const group = new THREE.Group(); this.scene.add(group);
    const road = buildRoad(track, cl, look, this.q); group.add(road.group);
    const st = this.stage = { track, cl, look, prevLook, group, road, inst: {}, hz: [], pk: null, cars: {}, biz: null, scen: [] };
    if (this.q.high) loadDetail(this.e.renderer).then(D => { if (!D || this.stage !== st) return; st.roadU = roadMaterial(road.roadMat, D); groundMaterial(road.groundMat, D); road.roadMat.needsUpdate = road.groundMat.needsUpdate = true;
      this.e.warm(this.scene, this.cam); this.e.settle(2500); });   // compile the new shaders now, and don't count that stall against the GPU
    // ---- scenery instancing
    const byKind = {};
    for (const s of track.segs) for (const sp of s.sprites) { if (["business", "gate", "stopSign", "billboard"].includes(sp.kind)) continue; (byKind[sp.kind] = byKind[sp.kind] || []).push({ i: s.i, sp }); }
    const swayKinds = new Set(["tree", "treeBent", "treeSunk", "palm", "palmBent"]);
    setPropDetail(this.q.high ? 1 : 0);
    for (const kind in byKind) {
      const build = PROPS[kind]; if (!build) continue; const built = build(); if (!built) continue;
      const geos = Array.isArray(built) ? built : [built], all = byKind[kind];
      geos.forEach((geo, v) => {                                 // colour variants: one instanced draw each
        const list = all.filter((_, n) => n % geos.length === v); if (!list.length) { geo.dispose(); return; }
        const im = new THREE.InstancedMesh(geo, swayKinds.has(kind) ? this.sway : this.solid, list.length);
        list.forEach(({ i, sp }, n) => {
          const p = worldAt(cl, i * SEG, sp.offset), side = Math.sign(sp.offset) || 1;
          const faceRoad = Math.atan2(-side * Math.cos(p.h), -side * Math.sin(p.h));
          const big = /house|barn|boat|lighthouse/.test(kind);
          const ry = big ? faceRoad + (Math.random() - 0.5) * 0.3 : Math.random() * Math.PI * 2;
          const sc = (kind === "lamp" || kind === "pole" || kind === "poleLean") ? 1 : big ? 0.92 + Math.random() * 0.16 : 0.85 + Math.random() * 0.35;
          const yaw = kind === "lamp" ? Math.atan2(side * Math.cos(p.h), side * Math.sin(p.h)) : ry;
          this.m4.compose(this.v3.set(p.x, p.y - (kind === "treeSunk" || kind === "houseFlooded" ? 0.8 : 0.05), p.z), this.q4.setFromEuler(this.eul.set(0, yaw, 0)), this.v3.clone().set(sc, sc, sc));
          im.setMatrixAt(n, this.m4);
        });
        im.castShadow = !!this.q.high && !/flood|sandbag|dune|fence/i.test(kind); im.receiveShadow = !!this.q.high; im.frustumCulled = false;   /* trees, houses and poles throw real shadows on desktops */ group.add(im); st.inst[kind + v] = im;
        // instances are in track order: keep a copy so only the stretch near the van is drawn
        st.scen.push({ im, segs: Int32Array.from(list, e => e.i), full: im.instanceMatrix.array.slice(), a: -1, b: -1 });
      });
    }
    // lamp heads glow (lit at dusk / storms)
    const lamps = byKind.lamp || [];
    if (lamps.length) {
      const g = new THREE.SphereGeometry(0.28, 8, 6), im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), lamps.length);
      lamps.forEach(({ i, sp }, n) => { const side = Math.sign(sp.offset); const p = worldAt(cl, i * SEG, sp.offset - side * 1.45 / HALFW); this.m4.makeTranslation(p.x, p.y + 7.2, p.z); im.setMatrixAt(n, this.m4); });
      group.add(im); st.lampHeads = im;
      const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 });
      st.lampGlows = []; lamps.forEach(({ i, sp }, n) => { if (n % 2) return; const side = Math.sign(sp.offset); const p = worldAt(cl, i * SEG, sp.offset - side * 1.45 / HALFW); const spr = new THREE.Sprite(glowMat); spr.position.set(p.x, p.y + 7.1, p.z); spr.scale.set(4, 4, 1); group.add(spr); st.lampGlows.push(spr); });
      st.glowMat = glowMat;
    }
    // billboards, stop signs, gate (individual meshes, shared textures)
    const msgs = ["SBA DISASTER RECOVERY", "RECOVERY CENTER AHEAD", "HELPING YOU RECOVER", "SBA.GOV/DISASTER", "BUSINESSES ▪ HOMEOWNERS ▪ RENTERS"];
    const bbTex = msgs.map(m => textTexture([{ text: m, size: 82, color: "#ffffff" }], { bg: "#0E2E6A", border: "#ECC444" }));
    const postMat = new THREE.MeshLambertMaterial({ color: 0x7d8086 });
    for (const s of track.segs) for (const sp of s.sprites) {
      if (sp.kind === "billboard") {
        const p = worldAt(cl, s.i * SEG, sp.offset), side = Math.sign(sp.offset), face = Math.atan2(-side * Math.cos(p.h), -side * Math.sin(p.h)) + side * 0.5;
        const bb = new THREE.Group(); bb.position.set(p.x, p.y, p.z); bb.rotation.y = face;
        const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.3), new THREE.MeshBasicMaterial({ map: bbTex[(sp.seed || 0) % bbTex.length], side: THREE.DoubleSide })); board.position.y = 5.2; bb.add(board);
        for (const x of [-3, 3]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.2, 0.3), postMat); post.position.set(x, 2.1, -0.1); bb.add(post); }
        group.add(bb);
      } else if (sp.kind === "stopSign") {
        const p = worldAt(cl, s.i * SEG, sp.offset), tex = textTexture([{ text: "RECOVERY STOP", size: 70, color: "#ffffff" }, { text: sp.label, size: 96, color: "#ECC444" }], { bg: "#0E2E6A", border: "#ECC444", w: 512, h: 320 });
        const sg = new THREE.Group(); sg.position.set(p.x, p.y, p.z); sg.rotation.y = -p.h;
        const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); board.position.y = 3.2; sg.add(board);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), postMat); post.position.y = 1.3; sg.add(post); group.add(sg);
      } else if (sp.kind === "gate") {
        const p = worldAt(cl, s.i * SEG, 0), g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = -p.h;
        const pil = new THREE.MeshLambertMaterial({ color: 0x0e2e6a });
        for (const x of [-(HALFW + 1.2), HALFW + 1.2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7.5, 0.8), pil); m.position.set(x, 3.75, 0); g.add(m); }
        const tex = textTexture([{ text: "▼  RECOVERY STOP  ▼", size: 92, color: "#ECC444" }], { bg: "#0E2E6A", border: "#ECC444", w: 1024, h: 160 });
        const beam = new THREE.Mesh(new THREE.BoxGeometry(2 * HALFW + 3.2, 1.6, 0.5), [pil, pil, pil, pil, new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex })]); beam.position.y = 6.8; g.add(beam);
        group.add(g);
      }
    }
    // ---- hazards (instanced per kind; each keeps its own matrix for hit animation)
    const hzKinds = {};
    for (const s of track.segs) for (const hz of s.hazards) { hz.seg = s.i; (hzKinds[hz.kind] = hzKinds[hz.kind] || []).push(hz); }
    st.hzMeshes = {};
    for (const kind in hzKinds) {
      const list = hzKinds[kind];
      if (kind === "puddle" || kind === "sand") {
        const im = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), kind === "sand" ? new THREE.MeshLambertMaterial({ color: 0xbfa978 }) : (this.q.high ? new THREE.MeshStandardMaterial({ color: 0x2e3a40, roughness: 0.25, metalness: 0, envMapIntensity: 0.6 }) : new THREE.MeshPhongMaterial({ color: 0x40525c, shininess: 90 })), list.length);
        list.forEach((hz, n) => { const p = worldAt(cl, hz.seg * SEG, hz.offset); this.m4.compose(this.v3.set(p.x, p.y + 0.03, p.z), this.q4.setFromEuler(this.eul.set(0, -p.h, 0)), this.v3.clone().set(2.4, 1, 1.6)); im.setMatrixAt(n, this.m4); });
        group.add(im); continue;
      }
      if (kind === "waveCrest") { st.waves = list.map(hz => ({ hz })); continue; }
      const build = PROPS[kind]; if (!build) continue; const geo = build(); if (!geo) continue;
      const im = new THREE.InstancedMesh(geo, this.solid, list.length); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(im);
      list.forEach((hz, n) => { hz._im = im; hz._n = n; hz._rot = (Math.random() - 0.5) * 0.6; hz.hitT = 0; st.hz.push(hz);
        const p = worldAt(cl, hz.seg * SEG, hz.offset); this.m4.compose(this.v3.set(p.x, p.y, p.z), this.q4.setFromEuler(this.eul.set(0, -p.h + hz._rot, 0)), this.one); im.setMatrixAt(n, this.m4); });
      st.hzMeshes[kind] = im;
    }
    if (st.waves && st.waves.length) {
      const geo = new THREE.PlaneGeometry(2 * HALFW + 8, 3, 12, 4); geo.rotateX(-Math.PI / 2.4);
      const mat = new THREE.MeshLambertMaterial({ color: 0xdfeef6, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      st.waves.forEach(w => { const m = new THREE.Mesh(geo, mat); group.add(m); w.mesh = m; });
    }
    // ---- pickups
    const pk = []; for (const s of track.segs) for (const p of s.pickups) { p.seg = s.i; pk.push(p); }
    if (pk.length) { const im = new THREE.InstancedMesh(PROPS.clock(), new THREE.MeshBasicMaterial({ vertexColors: true }), pk.length); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(im); st.pk = { im, list: pk };
      const glow = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xecc444, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); st.pkGlow = pk.map(() => { const s = new THREE.Sprite(glow); s.scale.set(2.6, 2.6, 1); group.add(s); return s; }); }
    // ---- traffic
    const types = {}; track.cars.forEach(c => (types[c.type] = types[c.type] || []).push(c));
    for (const type in types) {
      const list = types[type], parts = carParts(type), im = new THREE.InstancedMesh(parts.body, this.q.high ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }) : new THREE.MeshLambertMaterial({ vertexColors: true }), list.length);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.castShadow = this.q.shadows; im.frustumCulled = false;
      list.forEach((c, n) => im.setColorAt(n, tmpC.set(type === "utility" || type === "boxtruck" ? "#eef0f3" : CAR_COLORS[c.color % CAR_COLORS.length])));
      const tl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.16, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2a24 }), list.length * 2); tl.instanceMatrix.setUsage(THREE.DynamicDrawUsage); tl.frustumCulled = false;
      const blob = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }), list.length); blob.frustumCulled = false;
      // glass, tyres, rims and lamps keep their own colours (the paint above takes each car's colour)
      const imD = new THREE.InstancedMesh(parts.detail, this.q.high ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.35 }) : new THREE.MeshLambertMaterial({ vertexColors: true }), list.length);
      imD.instanceMatrix.setUsage(THREE.DynamicDrawUsage); imD.frustumCulled = false; imD.castShadow = im.castShadow;
      group.add(im, imD, tl, blob); st.cars[type] = { list, im, imD, tl, blob, dim: CAR_DIM[type] };
      if (type === "utility") { const bc = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xffa020 }), list.length); bc.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bc.frustumCulled = false; group.add(bc); st.cars[type].beacon = bc; }
    }
    // ---- jumps: the drawbridge (stage 1) and the car carrier (stage 2)
    if (track.jumps && track.jumps.length) { st.jumps = buildJumps(track, cl, look, this.q); group.add(st.jumps.group); }
    // ---- the stop's building with a live restoring facade
    this.buildBusiness(game, st);
    // ---- look & environment
    this.applyLook(look, 1);
    this.ocean.mesh.visible = !!look.coast; this.flood.mesh.visible = !!look.flood;
    this.tornado.group.visible = false;
    this.camState.init = false;
    if (this.q.high) this.updateEnv();
    return st;
  }

  // Free everything the last stage built (models, materials, textures) so memory stays flat however many
  // stages are played; materials kept on the world itself are shared by every stage and stay.
  freeStage(st) {
    this.scene.remove(st.group);
    const shared = new Set(Object.values(this).filter(v => v && v.isMaterial)), seen = new Set();
    const free = (x) => { if (x && !seen.has(x)) { seen.add(x); x.dispose(); } };
    st.group.traverse(o => {
      if (o.geometry) free(o.geometry);
      if (o.isInstancedMesh) o.dispose();
      for (const m of [].concat(o.material || [])) {
        if (shared.has(m)) continue;
        for (const k in m) if (m[k] && m[k].isTexture) free(m[k]);
        free(m);
      }
    });
    this.stage = null;
  }
  buildBusiness(game, st) {
    const idx = game.stageCfg.business, biz = this.cfg.businesses[idx], f = st.track.finish;
    const c = document.createElement("canvas"); c.width = c.height = this.q.high ? 1024 : 640;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mpp = 19 / c.width;                                   // facade plane is 19 m wide
    const g = new THREE.Group();
    const p = worldAt(st.cl, (f.zoneEnd + 6) * SEG, 0), rx = Math.cos(p.h), rz = Math.sin(p.h), fx = Math.sin(p.h), fz = -Math.cos(p.h);
    const lat = HALFW + 15;
    g.position.set(p.x + rx * lat, p.y - 0.05, p.z + rz * lat);
    const face = Math.atan2(-rx, -rz) - 0.5;                     // facing the road, turned toward the approach
    g.rotation.y = face;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(19, 19), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    plane.position.set(0, 9.5 - 19 * (1 - 1000 / 1024) * 0 , 0.02); g.add(plane);
    // body behind the facade: a real building matched to the storefront kind
    const K = kindSpec(biz.kind), mp = 0.98 * 19 / 1024, base = 19 * 24 / 1024;
    const bh = K.bh * mp + base + (K.roof === "pitched" ? (K.roofH || 120) * mp : 0) + (K.steeple ? 4 : 0);
    const bodyM = new THREE.Mesh(stopBuildingGeo(K, biz.palette, mp, base), this.q.high ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }) : new THREE.MeshLambertMaterial({ vertexColors: true }));
    bodyM.castShadow = !!this.q.shadows; bodyM.receiveShadow = !!this.q.shadows; g.add(bodyM);
    // sidewalk / lot in front
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(26, 14).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8e9094 })); lot.position.set(0, 0.04, 6); g.add(lot);
    // beacon (roadmap pin) above the building
    const pin = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 16).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xecc444 })); pin.position.set(0, Math.max(bh, 12) + 6, 0); g.add(pin);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 40, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xecc444, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.set(0, Math.max(bh, 12) + 26, 0); g.add(beam);
    st.group.add(g);
    st.biz = { g, tex, canvas: c, ctx: c.getContext("2d"), idx, biz, lastP: -1, pin, beam, facePos: new THREE.Vector3(), normal: new THREE.Vector3(Math.sin(face), 0, Math.cos(face)), height: bh };
    this.drawFacade(0, 0);
  }
  drawFacade(p, t) {
    const B = this.stage.biz, ctx = B.ctx, c = B.canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
    const k = c.width / 1024; ctx.scale(k, k);
    drawStorefront(ctx, B.biz, B.idx, 512, 1000, 0.98, p, t, { wind: this.stage.look.wind });
    B.tex.needsUpdate = true; B.lastP = p;
  }

  applyLook(L, k) {
    const s = this.sky.uniforms;
    s.top.value.set(L.skyTop); s.horizon.value.set(L.skyHorizon); s.fogColor.value.set(L.fog); s.sunColor.value.set(L.sunColor);
    s.cloudColor.value.set(L.cloudColor); s.cloudDark.value.set(L.cloudDark); s.sunAmt.value = L.sunAmt; s.clouds.value = L.clouds;
    const el = L.sunElev, az = L.sunAz; s.sunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    this.scene.fog.color.set(L.fog); this.scene.fog.near = L.fogNear; this.scene.fog.far = Math.min(L.fogFar, this.q.far);
    this.hemi.color.set(L.hemiSky); this.hemi.groundColor.set(L.hemiGround); this.hemi.intensity = L.hemiIntensity;
    this.sun.color.set(L.sunColor); this.sun.intensity = L.sunIntensity;
    this.e.renderer.toneMappingExposure = L.exposure; if (this.e.grade) this.e.grade.uniforms.uWarm.value = L.sunAmt;
    this.curLook = L;
  }
  updateEnv() {
    if (!this._pmrem) this._pmrem = new THREE.PMREMGenerator(this.e.renderer);
    const sc = new THREE.Scene(); const sky = makeSky(); Object.keys(this.sky.uniforms).forEach(k => { const v = this.sky.uniforms[k].value; sky.uniforms[k].value = v && v.clone ? v.clone() : v; }); sc.add(sky.mesh);
    if (this._envRT) this._envRT.dispose();                     // the whole render target, not just its texture
    this._envRT = this._pmrem.fromScene(sc, 0, 1, 1200); this._env = this._envRT.texture; this.scene.environment = this._env;
    sky.mesh.geometry.dispose(); sky.mesh.material.dispose();      // the temporary sky was only needed for that one render
  }

  // ------------------------------------------------------------------ per frame
  // Draw only scenery between just behind the van and the fog wall (no extra draw calls).
  cullScenery(game) {
    const st = this.stage, vs = (game.player.z + CAM.playerZ) / SEG;
    const fog = Math.min(this.q.far, Math.max(st.look.fogFar, st.prevLook.fogFar));
    const lo = vs - 45, hi = vs + (fog * 1.3 + 60) / SEGM;
    const first = (arr, x) => { let a = 0, b = arr.length; while (a < b) { const m = (a + b) >> 1; if (arr[m] < x) a = m + 1; else b = m; } return a; };
    for (const S of st.scen) {
      const a = first(S.segs, lo), b = first(S.segs, hi);
      if (a === S.a && b === S.b) continue;
      S.a = a; S.b = b; S.im.count = b - a;
      if (b > a) { S.im.instanceMatrix.array.set(S.full.subarray(a * 16, b * 16), 0); S.im.instanceMatrix.clearUpdateRanges(); S.im.instanceMatrix.addUpdateRange(0, (b - a) * 16); S.im.instanceMatrix.needsUpdate = true; }
    }
  }
  update(game, dt) {
    const st = this.stage; if (!st) return;
    this.cullScenery(game);
    const t = game.clock, P = game.player, cl = st.cl, L0 = st.prevLook, L1 = st.look;
    const L = game.envBlend < 1 ? lookBlend(L0, L1, game.envBlend) : L1;
    if (game.envBlend < 1 || this.curLook !== L1) this.applyLook(L, 1);
    this.uni.uTime.value = t; this.uni.uWind.value = L.wind + Math.abs(game.windNow) * 0.8;
    const s = this.sky.uniforms; s.time.value = t; s.flash.value = game.flash * 0.6; s.windDir.value = game.stageCfg.weather === "hurricane" ? -2 : 1 + L.wind;
    this.hemi.intensity = L.hemiIntensity + game.flash * 1.5;
    // ---- van
    // Physics runs at a fixed 60 Hz; screens may refresh faster (120 Hz laptops and phones), so draw
    // the van and camera between the last two physics states instead of holding a frame.
    const ra = game.renderAlpha ?? 1, jump = game.prevZ === undefined || Math.abs(P.z - game.prevZ) > 6 * SEG;
    const iz = jump ? P.z : game.prevZ + (P.z - game.prevZ) * ra, ix = jump ? P.x : game.prevX + (P.x - game.prevX) * ra;
    const vz = iz + CAM.playerZ, pos = worldAt(cl, vz, ix, this.vanPos || (this.vanPos = {})), speedMs = P.speed * U2M;
    const latVel = jump ? 0 : (P.x - game.prevX) * 60 * HALFW;   // per physics step, not per screen frame
    const yawT = speedMs > 1 ? Math.atan2(latVel, speedMs) * 0.9 : 0;
    this.yawVis = lerp(this.yawVis, Math.max(-0.5, Math.min(0.5, yawT)), 1 - Math.exp(-dt * 9.75));
    const airI = jump ? (P.airY || 0) : (game.prevAirY ?? P.airY ?? 0) + ((P.airY || 0) - (game.prevAirY ?? P.airY ?? 0)) * ra;   // height above the road on a jump
    this.airI = airI;
    const V = this.van.root; V.position.set(pos.x, pos.y + airI, pos.z); V.rotation.set(0, -pos.h - this.yawVis, 0, "YXZ");
    const night = Math.max(0, Math.min(1, 1.25 - L.sunIntensity * 0.45 - L.hemiIntensity * 0.25 + L.rain * 0.3));
    const nos = game.boostT > 0 ? Math.min(1, game.boostT / 0.25, (this.cfg.physics.boostTime - game.boostT) / 0.12 + 0.3) : 0;
    this.nos = nos;
    const Bd = game.body || { p: 0, r: 0, h: 0 };
    this.van.update({ speed: speedMs, dt, steer: (game.steerS || 0) * (game.state === "drive" ? 1 : 0), brake: (INPUT.brake && game.state === "drive") || game.autoStop ? 1 : 0, night, air: airI, boost: nos, boostPop: Math.max(0, 1 - (this.cfg.physics.boostTime - game.boostT) / 0.3),
      roll: Bd.r + game.roll * 0.3, pitch: Bd.p + game.hitFx * 0.03, bounce: Bd.h + (Math.abs(P.x) > 1.05 ? Math.sin(t * 31) * 0.02 : 0) });
    V.rotation.x = pitchAt(cl, vz) + (P.pitch || 0);
    if (this.headSpot) this.headSpot.intensity = night * 40;
    // ---- shadows follow the van
    if (this.q.shadows) { const sd = this.sky.uniforms.sunDir.value, ah = this.q.high ? 18 : 0, cx = pos.x + Math.sin(pos.h) * ah, cz = pos.z - Math.cos(pos.h) * ah;   // the shadow box sits ahead of the van, where the eye is
      this.sun.position.set(cx + sd.x * 80, pos.y + Math.max(0.3, sd.y) * 80, cz + sd.z * 80); this.sun.target.position.set(cx, pos.y, cz); }
    // ---- traffic
    for (const type in st.cars) {
      const C = st.cars[type]; let n = 0;
      C.list.forEach((car, idx) => {
        const visible = car.z > vz - 60 / U2M && car.z < vz + this.q.far * 0.9 / U2M;
        if (!visible) { this.m4.compose(this.zero, this.q4.identity(), this.zero); C.im.setMatrixAt(idx, this.m4); C.imD.setMatrixAt(idx, this.m4); C.tl.setMatrixAt(idx * 2, this.m4); C.tl.setMatrixAt(idx * 2 + 1, this.m4); C.blob.setMatrixAt(idx, this.m4); if (C.beacon) C.beacon.setMatrixAt(idx, this.m4); return; }
        const zI = car.z - (car.speed || 0) * (1 - ra) / 60;   // smoothed like the van
        const p = worldAt(cl, zI, car.offset), yaw = -p.h - Math.cos(t * 0.5 + car.seed) * 0.08 * car.swerve;
        this.q4.setFromEuler(this.eul.set(pitchAt(cl, zI), yaw, 0, "YXZ"));
        this.m4.compose(this.v3.set(p.x, p.y, p.z), this.q4, this.one); C.im.setMatrixAt(idx, this.m4); C.imD.setMatrixAt(idx, this.m4);
        const back = C.dim[1] / 2 + 0.02, w = C.dim[0] / 2 - 0.25, sx = Math.sin(yaw), cz = Math.cos(yaw);
        const bright = car.braking ? 1.6 : 1;
        for (const k of [0, 1]) { const ox = (k ? w : -w); this.m4.compose(this.v3.set(p.x + cz * ox + sx * back, p.y + 0.85, p.z - sx * ox + cz * back), this.q4, this.v3.clone().set(bright, bright, 1)); C.tl.setMatrixAt(idx * 2 + k, this.m4); }
        this.m4.compose(this.v3.set(p.x, p.y + 0.03, p.z), this.q4, this.v3.clone().set(C.dim[0] * 1.5, 1, C.dim[1] * 1.2)); C.blob.setMatrixAt(idx, this.m4);
        if (C.beacon) { const on = Math.sin(t * 12 + car.seed) > 0 ? 1 : 0.01; this.m4.compose(this.v3.set(p.x, p.y + 2.15, p.z), this.q4, this.v3.clone().set(on, on, on)); C.beacon.setMatrixAt(idx, this.m4); }
      });
      C.im.instanceMatrix.needsUpdate = C.imD.instanceMatrix.needsUpdate = C.tl.instanceMatrix.needsUpdate = C.blob.instanceMatrix.needsUpdate = true; if (C.beacon) C.beacon.instanceMatrix.needsUpdate = true;
    }
    // ---- hazards: drift, tumble, fly away when hit
    for (const hz of st.hz) {
      if (!hz._im) continue;
      const near = Math.abs(hz.seg * SEG - vz) < 400 / U2M;
      if (!near && !hz.dirty) continue;
      const p = worldAt(cl, hz.seg * SEG, hz.offset);
      let y = p.y, rx = 0, rz = 0, ry = -p.h + hz._rot, sc = 1;
      if (hz.kind === "tumble" || hz.kind === "hay") { rz = t * 4 * (hz.vx || 1); }
      let px = p.x, pz = p.z;
      if (hz.hit) { hz.hitT = (hz.hitT || 0) + dt; const k = hz.hitT, side = hz.offset >= game.player.x ? 1 : -1, fwdK = 14 * k;
        px += Math.cos(p.h) * side * 9 * k + Math.sin(p.h) * fwdK; pz += Math.sin(p.h) * side * 9 * k - Math.cos(p.h) * fwdK; y += 1.6 * k - 5 * k * k; rx = k * 6; ry += k * 4; sc = Math.max(0, 1 - k * 1.4); hz.dirty = sc > 0; }
      this.m4.compose(this.v3.set(px, y, pz), this.q4.setFromEuler(this.eul.set(rx, ry, rz)), this.v3.clone().set(sc, sc, sc)); hz._im.setMatrixAt(hz._n, this.m4); hz._im.instanceMatrix.needsUpdate = true; hz.dirty = hz.dirty || near;
    }
    if (st.waves) st.waves.forEach(w => { const p = worldAt(cl, w.hz.seg * SEG, 0); const ph = (t * 0.45 + w.hz.seed * 0.001) % 1, k = Math.sin(ph * Math.PI); w.mesh.position.set(p.x + Math.cos(p.h) * (HALFW + 6 - ph * (2 * HALFW + 10)), p.y + 0.3 + k * 1.2, p.z + Math.sin(p.h) * (HALFW + 6 - ph * (2 * HALFW + 10))); w.mesh.rotation.y = -p.h + Math.PI / 2; w.mesh.material.opacity = 0.75 * k; });
    // ---- pickups
    if (st.pk) st.pk.list.forEach((p, n) => { const w = worldAt(cl, p.seg * SEG, p.offset), show = !p.got; this.m4.compose(this.v3.set(w.x, w.y + 1.4 + Math.sin(t * 3 + n) * 0.15, w.z), this.q4.setFromEuler(this.eul.set(0, t * 2.5 + n, 0)), show ? this.one : this.zero); st.pk.im.setMatrixAt(n, this.m4); st.pkGlow[n].position.set(w.x, w.y + 1.4, w.z); st.pkGlow[n].visible = show; });
    if (st.pk) st.pk.im.instanceMatrix.needsUpdate = true;
    // ---- lamps at dusk/storms
    if (st.glowMat) st.glowMat.opacity = 0.15 + 0.7 * night;
    // ---- business facade (redraw while restoring)
    if (st.jumps) st.jumps.update(t);
    if (st.biz) {
      const p = game.restoreP[st.biz.idx] || 0;
      if (Math.abs(p - st.biz.lastP) > 0.004 || (game.state === "restoring" && (this.q.high || Math.floor(t * 30) % 2 === 0))) this.drawFacade(p, t);
      st.biz.pin.rotation.y = t * 1.5; st.biz.pin.position.y = Math.max(st.biz.height, 12) + 6 + Math.sin(t * 2) * 0.4;
      const done = p >= 1; st.biz.pin.material.color.set(done ? 0x3c7c54 : 0xecc444); st.biz.beam.material.color.set(done ? 0x3c7c54 : 0xecc444);
    }
    st.road.zoneTex.offset.y = -t * 0.8;
    // ---- weather fx
    this.updateCamera(game, pos, dt);
    this.sky.mesh.position.copy(this.cam.position);
    const cam = this.cam.position, fwd = this.v3.set(Math.sin(pos.h), 0, -Math.cos(pos.h)).clone(), right = new THREE.Vector3(Math.cos(pos.h), 0, Math.sin(pos.h));
    const wet = L.wet > 0.5 || game.inWater;
    const windSide = game.stageCfg.weather === "hurricane" ? -1 : Math.sign(game.windNow || 1);
    const calm = 1 - game.escort.k;                                  // the escort's downwash holds the weather off
    this.rain.update(t, cam, L.rain * calm, { x: (L.rainSlant + game.windNow * 0.8) * right.x * 0.6 - fwd.x * Math.min(0.6, speedMs / 60), y: (L.rainSlant + game.windNow * 0.8) * right.z * 0.6 - fwd.z * Math.min(0.6, speedMs / 60) });
    this.flying.update(t, cam, fwd, right, L.dust * calm * (game.stageCfg.weather === "tornado" || game.stageCfg.weather === "hurricane" ? 1 : 0.3), windSide);
    this.updateHeli(game, cl, vz, dt, t, night, wet);
    this.bolt.update(dt); if (game.bolt && game.bolt.t < dt * 1.5) this.bolt.strike(cam, fwd, right);
    // tornado placed ahead in the world, crossing the road as the stage progresses
    if (game.tornado && game.tornado.k > 0.02) {
      const tn = game.tornado, ahead = lerp(300, 110, Math.min(1, game.progress * 1.1)) / U2M;
      const tp = worldAt(cl, Math.min(vz + ahead, (st.track.N - 2) * SEG), tn.x * 18);
      this.tornado.group.position.set(tp.x, tp.y - 2, tp.z); this.tornado.group.scale.setScalar(0.7 + tn.s * 0.4);
      this.tornado.update(t, this.scene.fog.color, 0.25, tn.k);
    } else this.tornado.group.visible = false;
    if (this.ocean.mesh.visible) this.ocean.update(t, cam, st.road.seaY);
    if (this.flood.mesh.visible) this.flood.update(t, cam, pos.y - 0.32);
    // particles: wheel spray, dust, sparks from game events
    const pr = this.parts, airI0 = this.airI || 0;
    if (speedMs > 6 && (wet || Math.abs(P.x) > 1.05)) {
      const n = game.inWater ? 5 : 1;
      for (let i = 0; i < n; i++) {
        const side = Math.random() < 0.5 ? -1 : 1, bx = pos.x + right.x * side * 1.0 - fwd.x * 2.8, bz = pos.z + right.z * side * 1.0 - fwd.z * 2.8;
        const col = Math.abs(P.x) > 1.05 && !wet ? [0.55, 0.48, 0.38] : [0.75, 0.82, 0.9];
        pr.emit(bx, pos.y + 0.3, bz, right.x * side * (1 + Math.random() * 2) - fwd.x * 3, 1.5 + Math.random() * (game.inWater ? 4 : 2), right.z * side * (1 + Math.random() * 2) - fwd.z * 3, 0.5 + Math.random() * 0.4, col.map(c => c * 0.45), game.inWater ? 0.4 : 0.18, 9.8, 1.5);
      }
    }
    // nitrous sparks streaming out of the exhausts
    if (this.nos > 0.05) for (let i = 0; i < (this.q.high ? 3 : 1); i++) { const sx = Math.random() < 0.5 ? -1 : 1, bx = pos.x - fwd.x * 3.1 + right.x * sx * 0.55, bz = pos.z - fwd.z * 3.1 + right.z * sx * 0.55;
      pr.emit(bx, pos.y + airI0 + 0.45, bz, -fwd.x * (6 + Math.random() * 6) + (Math.random() - 0.5) * 1.5, Math.random() * 0.8, -fwd.z * (6 + Math.random() * 6) + (Math.random() - 0.5) * 1.5, 0.22 + Math.random() * 0.2, [0.35, 0.6, 1.0], 0.35, 0, 0.5); }
    for (const ev of game.events) {
      if (ev.type === "sparks" || ev.type === "pickup") { const col = ev.type === "pickup" ? [0.95, 0.8, 0.3] : [1, 0.85, 0.5]; for (let i = 0; i < 28; i++) pr.emit(pos.x + fwd.x * 3, pos.y + 1, pos.z + fwd.z * 3, (Math.random() - 0.5) * 12, Math.random() * 7, (Math.random() - 0.5) * 12, 0.6 + Math.random() * 0.4, col, 0.35); }
      if (ev.type === "land") { const k = Math.min(40, 10 + (ev.impact || 0) * 2.5); for (let i = 0; i < k; i++) { const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 6; pr.emit(pos.x + Math.cos(a) * 1.4, pos.y + 0.2, pos.z + Math.sin(a) * 2.4, Math.cos(a) * v, 0.6 + Math.random() * 2, Math.sin(a) * v, 0.5 + Math.random() * 0.4, wet ? [0.3, 0.33, 0.37] : [0.34, 0.3, 0.25], 0.8, 6, 1.5); } }
      if (ev.type === "splash") for (let i = 0; i < 40; i++) { const side = Math.random() < 0.5 ? -1 : 1; pr.emit(pos.x + right.x * side * 1.2, pos.y + 0.2, pos.z + right.z * side * 1.2, right.x * side * (2 + Math.random() * 5), 3 + Math.random() * 5, right.z * side * (2 + Math.random() * 5), 0.8, [0.8, 0.88, 0.95], 1.0); }
      if (ev.type === "restore" && st.biz) { const b = st.biz.g.position; for (let i = 0; i < 6; i++) pr.emit(b.x + (Math.random() - 0.5) * 14, b.y + Math.random() * st.biz.height, b.z + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, 1.2, [1, 0.85, 0.35], 0.6, -0.5); }
    }
    game.events.length = 0;
    pr.update(dt);
    // wet road: how wet, and rain rings in the puddles
    if (st.roadU) { const U = st.roadU; U.uWet.value = Math.max(L.wet, game.inWater ? 1 : 0); U.uRain.value = L.rain * calm; U.uTime.value = t; }
  }

  // The escort: swoops in from high behind the camera, over the van, to a lead position ahead,
  // follows the road for the escort's length, then climbs away to the right.
  updateHeli(game, cl, vz, dt, t, night, wet) {
    const H = this.heli, E = game.escort, C = this.cfg.escort; if (!H) return;
    const on = E.active || E.out >= 0; H.root.visible = this.heliShadow.visible = on; if (!on) return;
    const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const arrive = ease((E.active ? E.t : C.duration) / 2.4), leave = E.active ? 0 : ease(E.out / 3.4);
    const ahead = lerp(-30, C.ahead + Math.sin(t * 0.45) * 2.5, arrive) + leave * leave * 170;
    const side = -0.16 + Math.sin(t * 0.6) * 0.08 + leave * 2.4, end = (cl.N - 3) * SEG;
    const p = worldAt(cl, Math.min(vz + ahead / U2M, end), side, this.hp || (this.hp = {}));
    // height: once it is leading, hold it at the same place on screen (just under the HUD) whatever
    // the road does over hills, within 6-24 m of the road; the arrival swoops down from 22 m
    const cam = this.cam; cam.updateMatrixWorld(); const inv = cam.matrixWorldInverse, v0 = (this.hv0 || (this.hv0 = new THREE.Vector3())).set(p.x, 0, p.z).applyMatrix4(inv), v1 = (this.hv1 || (this.hv1 = new THREE.Vector3())).set(p.x, 1, p.z).applyMatrix4(inv);
    const T = 0.24 * Math.tan(cam.fov * Math.PI / 360), den = (v1.y - v0.y) + T * (v1.z - v0.z);
    const framed = Math.max(p.y + 6, Math.min(p.y + 24, (Math.abs(den) > 1e-6 ? (-T * v0.z - v0.y) / den : p.y + C.altitude) - 1.6)) + Math.sin(t * 1.3) * 0.35;
    const y = lerp(p.y + lerp(22, C.altitude, arrive), framed, arrive * arrive) + leave * leave * 45;
    const turn = worldAt(cl, Math.min(vz + (ahead + 25) / U2M, end), side, this.hp2 || (this.hp2 = {})).h - p.h;
    const pitch = -0.07 - 0.2 * Math.sin(Math.PI * arrive) + 0.2 * leave, roll = Math.max(-0.35, Math.min(0.35, -turn * 6)) - leave * 0.5;
    const crab = 0.3 * arrive * (1 - leave);                          // flies a little crabwise, so its side and tail rotor show
    H.root.position.set(p.x, y, p.z); H.root.rotation.set(pitch, -p.h + crab, roll, "YXZ");
    H.update({ dt, spin: 1, night });
    this.heliShadow.position.set(p.x, p.y + 0.06, p.z); this.heliShadow.rotation.y = -p.h; this.heliShadow.material.opacity = 0.35 * arrive * (1 - leave) * Math.max(0, 1 - (y - p.y - 10) / 30);
    // rotor downwash: a ring of spray or dust thrown out across the road under it
    const pr = this.parts, n = Math.round((this.q.high ? 4 : 2) * arrive * (1 - leave));
    const col = wet ? [0.2, 0.22, 0.25] : [0.22, 0.2, 0.16];
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4, v = 8 + Math.random() * 7;
      pr.emit(p.x + Math.cos(a) * r, p.y + 0.2, p.z + Math.sin(a) * r, Math.cos(a) * v, 0.3 + Math.random() * 0.9, Math.sin(a) * v, 0.6 + Math.random() * 0.5, col, 0.6, -0.2, 2.2); }
  }

  updateCamera(game, pos, dt) {
    const C = this.camState, cam = this.cam, st = this.stage;
    if (game.state === "restoring" || game.state === "results") {
      const B = st.biz, T = game.state === "results" ? 9 : game.stateT, k = Math.min(1, T / 8);
      const n = B.normal, bp = B.g.position, tx = -n.z, tz = n.x;          // tangent along the facade
      const dist = lerp(19, 15, k), slide = lerp(-7, 5, k);
      const target = this.v3.set(bp.x + n.x * dist + tx * slide, bp.y + lerp(4.2, 3.4, k), bp.z + n.z * dist + tz * slide).clone();
      if (game.stateT < 0.05 && game.state === "restoring") C.pos.copy(target); else C.pos.lerp(target, 0.08);
      cam.position.copy(C.pos);
      C.look.lerp(this.v3.set(bp.x + n.x * 2, bp.y + Math.min(9, B.height * 0.55), bp.z + n.z * 2), game.stateT < 0.05 ? 1 : 0.1); cam.lookAt(C.look);
      cam.fov = lerp(cam.fov, 54, 0.08); cam.updateProjectionMatrix(); return;
    }
    const P = game.player, speedK = P.speed / this.cfg.physics.maxSpeed;
    const dh = ((pos.h + this.yawVis * 0.45 - C.heading + Math.PI) % (2 * Math.PI)) - Math.PI;
    C.heading = C.init ? C.heading + dh * Math.min(1, dt * 5) : pos.h;
    // On a jump the camera rises with the van (so a long nitrous jump never leaves it a speck at the top
    // of the screen) and pulls back a little, so the drop below shows how high it is.
    const air = this.airI || 0;
    const back = 8.2 + speedK * 0.9 + (game.boostT > 0 ? 0.8 : 0) + Math.min(3, air * 0.35), up = 5.1 - speedK * 0.2;
    const fx = Math.sin(C.heading), fz = -Math.cos(C.heading);
    // never below the road under the camera (steep hills, the levee drops): at least 2 m above it
    const under = worldAt(st.cl, Math.max(0, game.player.z + CAM.playerZ - back / U2M), 0, this.camRoad || (this.camRoad = {})).y;
    const ty = Math.max(pos.y + up + air * 0.92, under + 2.0);
    if (!C.init) { C.pos.y = ty; C.init = true; }
    C.pos.x = pos.x - fx * back; C.pos.z = pos.z - fz * back; C.pos.y += (ty - C.pos.y) * Math.min(1, dt * 6); C.pos.y = Math.max(C.pos.y, under + 1.6);   // the easing never lags it into the road
    const sh = game.shake * 0.25 + (Math.abs(P.x) > 1.05 ? 0.06 : 0) * speedK + game.flash * 0.05;
    cam.position.set(C.pos.x + (Math.random() - 0.5) * sh, C.pos.y + (Math.random() - 0.5) * sh, C.pos.z + (Math.random() - 0.5) * sh);
    cam.lookAt(pos.x + fx * 24, pos.y + 0.7 + air * 0.85, pos.z + fz * 24);
    cam.rotateZ(-this.yawVis * 0.08);
    const fov = 60 + speedK * 6 + (game.boostT > 0 ? 8 : 0); cam.fov = lerp(cam.fov, fov, 0.08); cam.updateProjectionMatrix();
  }
}
