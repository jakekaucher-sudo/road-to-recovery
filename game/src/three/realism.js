// The high-quality look on desktops: photo detail on the road and verges, wet asphalt that mirrors the
// world (sky, street lamps, buildings, the van) through puddles and a rain-slick sheen, rain ripples in
// the puddles, and a film-style colour grade over the finished frame. Phones and slow GPUs keep the
// plain materials (each piece checks `quality.high`, and the mirror switches off when the engine has
// had to lower the resolution).
import * as THREE from "three";

const TEX = new URL("../../art/tex/", import.meta.url).href;
const GRASS_MEAN = "vec3(0.078, 0.120, 0.016)", ASPHALT_MEAN = "0.088";   // average colour of each photo, in linear light (the shader works in linear)

let DETAIL = null;
// Loads the photo detail maps once; resolves to null if they can't load (the plain look stays).
export function loadDetail(renderer) {
  if (DETAIL) return DETAIL;
  const L = new THREE.TextureLoader(), aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const get = (f, srgb) => L.loadAsync(TEX + f).then(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t; });
  DETAIL = Promise.all([get("asphalt.jpg", true), get("asphalt-normal.jpg"), get("asphalt-rough.jpg"), get("grass.jpg", true), get("grass-normal.jpg")])
    .then(([a, an, ar, g, gn]) => ({ asphalt: a, asphaltN: an, asphaltR: ar, grass: g, grassN: gn }))
    .catch(e => { console.warn("detail textures", e); return null; });
  return DETAIL;
}

// shared GLSL: value noise, and the world position passed from the vertex shader
const NOISE = /* glsl */`
float rh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(rh(i), rh(i + vec2(1, 0)), u.x), mix(rh(i + vec2(0, 1)), rh(i + vec2(1, 1)), u.x), u.y); }
float rfbm(vec2 p) { return rn(p) * 0.55 + rn(p * 2.1 + 7.3) * 0.3 + rn(p * 4.3 + 1.7) * 0.15; }`;
function worldPos(sh) {
  sh.vertexShader = "varying vec3 vRW;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n  vRW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
}
// perturb the (view space) normal with a world-space detail normal map lying flat on the ground
const DETAIL_NORMAL = (map, scale, k) => /* glsl */`{
  vec3 dn = texture2D(${map}, vRW.xz * ${scale}).xyz * 2.0 - 1.0;
  normal = normalize(normal + (viewMatrix * vec4(dn.x, 0.0, -dn.y, 0.0)).xyz * ${k});
}`;

// The road: lane markings stay in the drawn texture; the photo adds aggregate, cracks and normals in
// world space; wetness darkens it and drops roughness, puddles become mirrors.
export function roadMaterial(mat, D, refl) {
  const U = mat.userData.u = {
    uDet: { value: D.asphalt }, uDetN: { value: D.asphaltN }, uDetR: { value: D.asphaltR },
    uWet: { value: 0 }, uRain: { value: 0 }, uTime: { value: 0 },
    uRefl: { value: refl ? refl.texture : null }, uReflMat: { value: refl ? refl.matrix : new THREE.Matrix4() }, uReflOn: { value: 0 },
  };
  mat.roughness = 1; mat.metalness = 0;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U); worldPos(sh);
    sh.fragmentShader = `varying vec3 vRW; uniform sampler2D uDet, uDetN, uDetR, uRefl; uniform float uWet, uRain, uTime, uReflOn; uniform mat4 uReflMat;\n${NOISE}\n` + sh.fragmentShader
      .replace("#include <map_fragment>", `#include <map_fragment>
        vec3 det = texture2D(uDet, vRW.xz * 0.22).rgb;
        diffuseColor.rgb *= mix(vec3(1.0), det / ${ASPHALT_MEAN}, 0.85);
        float pud = smoothstep(0.58, 0.7, rfbm(vRW.xz * 0.09 + 3.1)) * smoothstep(0.15, 0.6, uWet);   // standing water
        float wet = clamp(uWet * 0.85 + pud, 0.0, 1.0);
        diffuseColor.rgb *= mix(1.0, 0.55, wet);`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = texture2D(uDetR, vRW.xz * 0.22).r * 0.95;
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.32, wet);
        roughnessFactor = mix(roughnessFactor, 0.035, pud);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        ${DETAIL_NORMAL("uDetN", "0.22", "0.55 * (1.0 - pud)")}
        // rain rings in the puddles
        if (uRain > 0.01) { vec2 q = vRW.xz * 2.2; vec2 c = floor(q); float ph = fract(uTime * 0.9 + rh(c) * 7.0);
          float d = length(fract(q) - 0.5 - (vec2(rh(c + 1.3), rh(c + 2.7)) - 0.5) * 0.4), ring = sin((d - ph * 0.45) * 60.0) * smoothstep(0.45, 0.0, abs(d - ph * 0.45) * 6.0) * (1.0 - ph);
          normal = normalize(normal + (viewMatrix * vec4(ring * 0.25 * uRain * pud, 0.0, ring * 0.25 * uRain * pud, 0.0)).xyz); }`)
      .replace("#include <opaque_fragment>", `
        // mirror: the world reflected in the road plane, blurrier where the surface is rougher
        if (uReflOn > 0.5) {
          vec4 rc = uReflMat * vec4(vRW, 1.0); vec2 ruv = rc.xy / rc.w + normal.xz * 0.025;
          float bl = roughnessFactor * 0.012;
          vec3 rf = (texture2D(uRefl, ruv).rgb * 2.0 + texture2D(uRefl, ruv + vec2(bl, 0.0)).rgb + texture2D(uRefl, ruv - vec2(bl, 0.0)).rgb + texture2D(uRefl, ruv + vec2(0.0, bl * 2.0)).rgb) / 5.0;
          float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
          float k = clamp(F * (1.0 - roughnessFactor) * 1.15, 0.0, 0.85) * max(wet, 0.2);
          outgoingLight = mix(outgoingLight, rf, k);
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => "road-wet";
  return U;
}

// Ground and verges: grass photo detail on green ground, its texture only (not its colour) on mud and sand.
export function groundMaterial(mat, D) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uG = { value: D.grass }; sh.uniforms.uGN = { value: D.grassN }; worldPos(sh);
    sh.fragmentShader = "varying vec3 vRW; uniform sampler2D uG, uGN;\n" + sh.fragmentShader
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 g = texture2D(uG, vRW.xz * 0.16).rgb * 0.6 + texture2D(uG, vRW.xz * 0.043 + 0.37).rgb * 0.4;   // two scales: no visible tiling
        float green = clamp((diffuseColor.g - diffuseColor.r) * 5.0 + 0.3, 0.0, 1.0);
        float lum = dot(g, vec3(0.299, 0.587, 0.114)) / dot(${GRASS_MEAN}, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb *= mix(vec3(lum), g / ${GRASS_MEAN}, green * 0.7);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        ${DETAIL_NORMAL("uGN", "0.16", "0.7")}`);
  };
  mat.customProgramCacheKey = () => "ground-detail";
}

// Planar mirror for the road (the method of three.js's Reflector, with an oblique near plane so nothing
// below the road shows up in it). Rendered at half resolution.
export class RoadMirror {
  constructor() {
    this.rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, samples: 0 });
    this.texture = this.rt.texture; this.matrix = new THREE.Matrix4();
    this.cam = new THREE.PerspectiveCamera(); this.cam.matrixAutoUpdate = true;
    this._p = new THREE.Plane(); this._n = new THREE.Vector3(); this._v = new THREE.Vector3(); this._t = new THREE.Vector3(); this._q = new THREE.Vector4(); this._c = new THREE.Vector4();
    this._r = new THREE.Matrix4(); this._la = new THREE.Vector3(); this._pos = new THREE.Vector3(); this._cp = new THREE.Vector3();
  }
  setSize(w, h) { const W = Math.max(256, Math.round(w / 2)), H = Math.max(144, Math.round(h / 2)); if (this.rt.width !== W || this.rt.height !== H) this.rt.setSize(W, H); }
  // point: a point on the road under the van; hide: meshes to leave out (the road itself)
  render(renderer, scene, camera, point, hide) {
    const n = this._n.set(0, 1, 0), cp = this._cp.setFromMatrixPosition(camera.matrixWorld);
    const view = this._v.subVectors(point, cp); if (view.dot(n) > 0) return false;      // camera below the road: nothing to see
    view.reflect(n).negate().add(point);
    this._r.extractRotation(camera.matrixWorld); this._la.set(0, 0, -1).applyMatrix4(this._r).add(cp);
    const tgt = this._t.subVectors(point, this._la).reflect(n).negate().add(point);
    const vc = this.cam; vc.position.copy(view); vc.up.set(0, 1, 0).applyMatrix4(this._r).reflect(n); vc.lookAt(tgt);
    vc.far = camera.far; vc.updateMatrixWorld(); vc.projectionMatrix.copy(camera.projectionMatrix);
    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
    // oblique near plane on the road plane
    this._p.setFromNormalAndCoplanarPoint(n, point).applyMatrix4(vc.matrixWorldInverse);
    const c = this._c.set(this._p.normal.x, this._p.normal.y, this._p.normal.z, this._p.constant), P = vc.projectionMatrix.elements, q = this._q;
    q.x = (Math.sign(c.x) + P[8]) / P[0]; q.y = (Math.sign(c.y) + P[9]) / P[5]; q.z = -1; q.w = (1 + P[10]) / P[14];
    c.multiplyScalar(2 / c.dot(q)); P[2] = c.x; P[6] = c.y; P[10] = c.z + 1 - 0.003; P[14] = c.w;
    const was = hide.map(m => m.visible); hide.forEach(m => m.visible = false);
    const rtOld = renderer.getRenderTarget(), sm = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(scene, vc); renderer.setRenderTarget(rtOld);
    renderer.shadowMap.autoUpdate = sm; hide.forEach((m, i) => m.visible = was[i]);
    return true;
  }
}

// Film-style grade on the finished (display) image: gentle S-curve, a touch more colour, cool shadows and
// warm highlights, a soft vignette, faint lens fringing at the edges and fine moving grain.
export const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uWarm: { value: 0.5 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform float uTime, uWarm; varying vec2 vUv;
float gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 d = vUv - 0.5; float r2 = dot(d, d);
  vec3 c = vec3(texture2D(tDiffuse, vUv - d * 0.0035 * r2 * 4.0).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d * 0.0035 * r2 * 4.0).b);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);                                 // contrast
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.1);                                                    // saturation
  c += mix(vec3(-0.012, 0.0, 0.018), vec3(0.03, 0.012, -0.02) * uWarm, smoothstep(0.15, 0.85, l));   // split tone
  c *= 1.0 - smoothstep(0.18, 0.75, r2 * 1.6) * 0.32;                         // vignette
  c += (gh(vUv * 1024.0 + fract(uTime) * 61.0) - 0.5) * 0.022;                // grain
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
};

// Foliage atlas: drawn leaves (with gaps, so the clusters have ragged edges) over most of the texture,
// and an opaque white corner that every non-leaf part samples, so it keeps its vertex colour.
export function foliageAtlas() {
  const S = 512, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d");
  g.clearRect(0, 0, S, S); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 120, S);                   // u < 0.23: an opaque strip (wide, so it survives the small mip levels)
  let s = 99; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const x0 = 136, y0 = 4, W = S - x0 - 4, H = S - 8, cx = x0 + W / 2, cy = y0 + H / 2;
  for (let i = 0; i < 2600; i++) {
    const a = R() * Math.PI * 2, r = Math.pow(R(), 0.65) * W * 0.48, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * (H / W);
    const L = 32 + R() * 30, hue = 80 + R() * 40, sz = 5 + R() * 8;
    g.save(); g.translate(x, y); g.rotate(R() * Math.PI * 2);
    g.fillStyle = `hsl(${hue},${30 + R() * 30}%,${L}%)`; g.beginPath(); g.ellipse(0, 0, sz, sz * 0.45, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = `hsla(${hue},40%,${L + 18}%,0.6)`; g.beginPath(); g.ellipse(-sz * 0.2, -sz * 0.1, sz * 0.5, sz * 0.18, 0, 0, Math.PI * 2); g.fill();   // a highlight
    g.restore();
  }
  g.strokeStyle = "rgba(70,52,34,0.8)"; g.lineWidth = 2;
  for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * W * 0.35 * R(), cy + Math.sin(a) * H * 0.35 * R()); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  return t;
}

// Surface detail on the props (houses, barns, poles): lap siding on light walls, rows of shingles on roofs,
// weathering, darkening where a building meets the ground, and glossy glass that reflects the sky
// (window panes are the dark blue-grey vertex colour). No textures or UVs needed: all in world space.
const PROP_VERT = (sh, instanced) => {
  sh.vertexShader = "varying vec3 vRW; varying vec3 vWN; varying float vH;\n" + sh.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>
    mat4 mm = modelMatrix${instanced ? " * instanceMatrix" : ""};
    vRW = (mm * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(mm) * objectNormal); vH = transformed.y;`);
};
export function propSurface(mat, instanced = true) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    PROP_VERT(sh, instanced);
    sh.fragmentShader = `varying vec3 vRW; varying vec3 vWN; varying float vH;\n${NOISE}\n` + sh.fragmentShader
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 wn = normalize(vWN); float lumC = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float glass = (lumC < 0.22 && diffuseColor.b > diffuseColor.r * 1.12) ? 1.0 : 0.0;
        diffuseColor.rgb *= 0.86 + rfbm(vRW.xz * 0.7 + vRW.y * 0.5) * 0.26;                     // weathering
        if (abs(wn.y) < 0.4 && lumC > 0.28 && glass < 0.5) diffuseColor.rgb *= 0.84 + 0.16 * smoothstep(0.0, 0.8, fract(vRW.y * 4.6));   // lap siding
        if (wn.y > 0.4 && wn.y < 0.97) {                                                         // shingles
          float row = vRW.y * 4.2, rf = fract(row), along = (abs(wn.x) > abs(wn.z) ? vRW.z : vRW.x) * 3.2 + floor(row) * 0.5;
          diffuseColor.rgb *= (0.78 + 0.22 * smoothstep(0.0, 0.35, rf)) * (0.9 + rh(vec2(floor(along), floor(row))) * 0.2) * (0.93 + 0.07 * step(0.07, fract(along)));
        }
        diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(0.0, 1.3, vH));                            // contact shade at the base`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.05, glass);`)
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.6, glass);`);
  };
  mat.customProgramCacheKey = () => "prop-surface-" + instanced;
}
