// Weather and effects: GPU rain, particle pool (spray, sparks, dust, glints),
// wind-blown debris, lightning bolts, the tornado funnel, the ocean and flood
// water planes. Everything is sized for phones first.
import * as THREE from "three";
import { glowTexture } from "./textures.js";

// ---------------------------------------------------------------- rain
export function makeRain(count) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(count * 2 * 3), seed = new Float32Array(count * 2 * 4);
  for (let i = 0; i < count; i++) { const a = Math.random(), b = Math.random(), c = Math.random(); for (let e = 0; e < 2; e++) { const j = i * 2 + e; seed[j * 4] = a; seed[j * 4 + 1] = b; seed[j * 4 + 2] = c; seed[j * 4 + 3] = e; } }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(0, 0) }, uAmt: { value: 0 }, uColor: { value: new THREE.Color(0xb8c8d8) } },
    vertexShader: `attribute vec4 aSeed; uniform float uTime, uAmt; uniform vec3 uCam; uniform vec2 uWind; varying float vA;
      void main(){ vec3 box = vec3(60.0, 34.0, 60.0); float sp = 22.0 + aSeed.z * 10.0;
        vec3 p = vec3(aSeed.x * box.x, aSeed.y * box.y, aSeed.z * box.z);
        p.y -= uTime * sp; p.x += uTime * uWind.x * sp; p.z += uTime * uWind.y * sp;
        p = mod(p - uCam + box * 0.5, box) - box * 0.5 + uCam;
        vec3 dir = normalize(vec3(-uWind.x, 1.0, -uWind.y)); p += dir * aSeed.w * (0.7 + aSeed.z * 0.6);
        vA = step(aSeed.x, uAmt) * (0.25 + 0.35 * aSeed.z);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ if (vA <= 0.0) discard; gl_FragColor = vec4(uColor, vA); }`,
    transparent: true, depthWrite: false,
  });
  const lines = new THREE.LineSegments(g, mat); lines.frustumCulled = false;
  return { mesh: lines, update(t, cam, amt, wind) { mat.uniforms.uTime.value = t; mat.uniforms.uCam.value.copy(cam); mat.uniforms.uAmt.value = amt; mat.uniforms.uWind.value.set(wind.x, wind.y); lines.visible = amt > 0.01; } };
}

// ---------------------------------------------------------------- particles
export function makeParticles(max) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max);
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: glowTexture() }, uScale: { value: 400 } },
    vertexShader: `attribute float aSize; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * 300.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uTex; varying vec3 vC; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC, t.a); }`,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  const P = []; for (let i = 0; i < max; i++) P.push({ life: 0, t: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, r: 1, gr: 1, b: 1, s: 0.3, drag: 0 });
  let next = 0;
  return {
    mesh: pts,
    emit(x, y, z, vx, vy, vz, life, color, s, grav = 9.8, drag = 0) { const p = P[next]; next = (next + 1) % max; Object.assign(p, { x, y, z, vx, vy, vz, life, t: 0, g: grav, s, drag }); p.r = color[0]; p.gr = color[1]; p.b = color[2]; },
    update(dt) {
      for (let i = 0; i < max; i++) {
        const p = P[i]; if (p.t >= p.life) { size[i] = 0; continue; }
        p.t += dt; p.vy -= p.g * dt; const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vz *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const a = 1 - p.t / p.life; pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        col[i * 3] = p.r * a; col[i * 3 + 1] = p.gr * a; col[i * 3 + 2] = p.b * a; size[i] = p.s * (0.6 + 0.4 * a);
      }
      g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.aSize.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- flying debris (instanced)
export function makeFlyingDebris(count) {
  const geo = new THREE.BoxGeometry(0.9, 0.06, 0.5), mat = new THREE.MeshLambertMaterial({ color: 0x8a7a62 });
  const im = new THREE.InstancedMesh(geo, mat, count); im.frustumCulled = false;
  const cols = [0x8a7a62, 0x6b6f76, 0x4f7a3a, 0x9c3a30, 0xc9ccd2]; const c = new THREE.Color();
  for (let i = 0; i < count; i++) { im.setColorAt(i, c.set(cols[i % cols.length])); }
  const S = Array.from({ length: count }, (_, i) => ({ ph: Math.random() * 100, h: 0.5 + Math.random() * 9, sp: 0.6 + Math.random() * 0.8, side: Math.random() * 2 - 1, rs: 2 + Math.random() * 6 }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0);
  return { mesh: im, update(t, cam, fwd, right, amt, windSide) {
    im.visible = amt > 0.02;
    for (let i = 0; i < count; i++) {
      const s = S[i], k = ((t * 0.35 * s.sp + s.ph) % 1);
      const lat = (-windSide) * (k * 2 - 1) * 40;
      v.set(cam.x + fwd.x * (38 + s.side * 24) + right.x * lat, cam.y - 2 + s.h + Math.sin(t * 2 + s.ph) * 1.5, cam.z + fwd.z * (38 + s.side * 24) + right.z * lat);
      e.set(t * s.rs, t * s.rs * 0.7, s.ph); q.setFromEuler(e);
      m.compose(v, q, i / count < amt ? one : zero); im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
  } };
}

// ---------------------------------------------------------------- lightning bolt
export function makeLightning() {
  const g = new THREE.BufferGeometry(); const pos = new Float32Array(30 * 3); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0, fog: false });
  const line = new THREE.Line(g, mat); line.frustumCulled = false;
  return { mesh: line, strike(cam, fwd, right) {
      let x = cam.x + fwd.x * (180 + Math.random() * 200) + right.x * (Math.random() - 0.5) * 300, z = cam.z + fwd.z * (180 + Math.random() * 200) + right.z * (Math.random() - 0.5) * 300, y = 220;
      for (let i = 0; i < 30; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; x += (Math.random() - 0.5) * 18; z += (Math.random() - 0.5) * 18; y -= 7.5 + Math.random() * 2; }
      g.attributes.position.needsUpdate = true; mat.opacity = 1;
    }, update(dt) { mat.opacity = Math.max(0, mat.opacity - dt * 4); line.visible = mat.opacity > 0.01; } };
}

// ---------------------------------------------------------------- tornado
export function makeTornado() {
  const pts = []; for (let i = 0; i <= 24; i++) { const f = i / 24; pts.push(new THREE.Vector2(10 + 70 * Math.pow(f, 1.8), f * 230)); }
  const geo = new THREE.LatheGeometry(pts, 28);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x4a4638) }, uLight: { value: new THREE.Color(0xb9a66a) }, uFogColor: { value: new THREE.Color() }, uFog: { value: 0 } },
    vertexShader: `uniform float uTime; varying float vH; varying vec2 vUv; varying float vSide;
      void main(){ vec3 p = position; float h = p.y / 230.0; vH = h; vUv = uv;
        float a = atan(p.z, p.x) + uTime * (2.2 - h) ; float r = length(p.xz) * (1.0 + 0.08 * sin(h * 18.0 - uTime * 6.0));
        p.x = cos(a) * r + sin(h * 3.0 + uTime * 0.7) * 22.0 * (1.0 - h) ; p.z = sin(a) * r; vSide = cos(a);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uColor, uLight, uFogColor; uniform float uTime, uFog; varying float vH; varying vec2 vUv; varying float vSide;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){ float n = hash(floor(vec2(vUv.x * 40.0 + uTime * 6.0, vUv.y * 60.0)));
        float streak = 0.6 + 0.4 * sin(vUv.x * 60.0 + vH * 30.0 - uTime * 10.0);
        vec3 c = mix(uColor * 0.7, uColor * 1.3, streak * (0.7 + 0.3 * n)); c = mix(c, uLight * 0.8, max(vSide, 0.0) * 0.25);
        float a = (0.55 + 0.35 * streak) * smoothstep(0.0, 0.06, vH) * (1.0 - smoothstep(0.85, 1.0, vH) * 0.6);
        c = mix(c, uFogColor, uFog); gl_FragColor = vec4(c, a); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const funnel = new THREE.Mesh(geo, mat); funnel.frustumCulled = false;
  const group = new THREE.Group(); group.add(funnel);
  const cloud = new THREE.Mesh(new THREE.CylinderGeometry(260, 200, 30, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x2e352c, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  cloud.position.y = 238; group.add(cloud);
  const dust = new THREE.Mesh(new THREE.SphereGeometry(28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7a6a4c, transparent: true, opacity: 0.55, depthWrite: false }));
  dust.scale.y = 0.45; group.add(dust);
  return { group, update(t, fogColor, fogAmt, k) { mat.uniforms.uTime.value = t; mat.uniforms.uFogColor.value.copy(fogColor); mat.uniforms.uFog.value = fogAmt; group.visible = k > 0.02; dust.rotation.y = t * 0.8; dust.scale.set(1 + 0.08 * Math.sin(t * 3), 0.45, 1 + 0.08 * Math.cos(t * 3)); } };
}

// ---------------------------------------------------------------- ocean / flood water
export function makeWater(kind, high, size = 1400, seg = 90) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
  const Mat = high ? THREE.MeshStandardMaterial : THREE.MeshPhongMaterial;
  const mat = new Mat(kind === "ocean"
    ? (high ? { color: 0x3a6a7e, roughness: 0.2, metalness: 0.05 } : { color: 0x3a6a7e, shininess: 80, specular: 0x9ab4c4 })
    : (high ? { color: 0x8a9a96, roughness: 0.22, metalness: 0.0 } : { color: 0x7d8c88, shininess: 90, specular: 0xb8c4c0 }));
  const uniforms = { uTime: { value: 0 }, uAmp: { value: kind === "ocean" ? 1.4 : 0.06 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime; sh.uniforms.uAmp = uniforms.uAmp;
    sh.vertexShader = "uniform float uTime; uniform float uAmp;\n" + sh.vertexShader
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
        vec4 wpN = modelMatrix * vec4(position, 1.0);
        float dx = cos(wpN.x * 0.05 + uTime * 1.3) * 0.05 + cos((wpN.x + wpN.z) * 0.11 + uTime * 2.1) * 0.11 * 0.4;
        float dz = cos(wpN.z * 0.07 - uTime * 1.1) * 0.07 + cos((wpN.x + wpN.z) * 0.11 + uTime * 2.1) * 0.11 * 0.4;
        objectNormal = normalize(vec3(-dx * uAmp, 1.0, -dz * uAmp));`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(position, 1.0);
        transformed.y += uAmp * (sin(wp.x * 0.05 + uTime * 1.3) + sin(wp.z * 0.07 - uTime * 1.1) + 0.4 * sin((wp.x + wp.z) * 0.11 + uTime * 2.1));`);
  };
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true;
  return { mesh, uniforms, update(t, cam, y) { uniforms.uTime.value = t; mesh.position.set(Math.round(cam.x / 20) * 20, y, Math.round(cam.z / 20) * 20); } };
}
