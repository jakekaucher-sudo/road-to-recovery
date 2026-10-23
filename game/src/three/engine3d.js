// WebGL renderer with quality tiers for laptops and phones, adaptive
// resolution (drops pixel ratio, then anti-aliasing, then bloom, then shadows
// if frames are slow), and bloom post-processing with 4x MSAA on capable machines.
import { viewSize } from "../orient.js";
import * as THREE from "three";
import { setTextureQuality } from "./textures.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

// Guards bloom against NaN/inf pixels (one bad pixel would otherwise blacken the frame).
const Sanitize = { uniforms: { tDiffuse: { value: null } }, vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = clamp(c, 0.0, 32.0); }" };

export function detectQuality(mobile) {
  const q = new URLSearchParams(location.search).get("q");
  const dpr = window.devicePixelRatio || 1;
  const lowEnd = mobile || q === "low";
  if (q === "high" || !lowEnd) return { high: true, mobile, dpr, shadows: true, shadowMap: 2048, bloom: true, texScale: 2, rain: 2600, particles: 900, debris: 70, far: 900 };
  return { high: false, mobile, dpr, shadows: false, shadowMap: 0, bloom: false, texScale: 1, rain: 900, particles: 360, debris: 36, far: 600 };
}

// Resolution / anti-aliasing levels, sharpest first. Desktops draw the scene into a multisampled
// target (bloom needs one), phones use the canvas's own anti-aliasing. Measured on an Apple M4 in
// Chrome: 2x resolution with 2x MSAA holds 60 fps on a 13" screen but not on a 16" one (1.75x with
// no MSAA does), so the start level is picked by pixel count, and the engine steps down from there
// when it sees dropped frames. It never steps up: trying a sharper level costs visible stutter.
function ladder(q) {
  const d = q.dpr;
  if (!q.bloom) return [1.5, 1.35, 1.2, 1.05, 0.9, 0.75, 0.6].map(p => ({ pr: Math.min(d, p), msaa: 0 }));   // phones (was a fixed 1.275)
  const L = d >= 1.5 ? [[2, 2], [1.75, 2], [1.75, 0], [1.5, 0], [1.25, 0], [1, 0], [0.85, 0], [0.7, 0]]
                     : [[1, 4], [1, 2], [1, 0], [0.85, 0], [0.7, 0]];
  return L.map(([p, m]) => ({ pr: Math.min(p, d < 1.5 ? d : p), msaa: m }));
}
const BUDGET = 8.5e6;      // drawn pixels per frame (MSAA samples weighted) a desktop starts at

export class Engine {
  constructor(canvas, quality) {
    this.q = quality; this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !quality.bloom, powerPreference: "high-performance", stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = quality.shadows; r.shadowMap.type = THREE.PCFSoftShadowMap;
    setTextureQuality(Math.min(16, r.capabilities.getMaxAnisotropy()), quality.texScale || 1);   // sharp road at low angles
    this.composer = null; this.cam = null; this.scene = null; this.hist = []; this.cool = 2500; this.ft = 16;
    const { w, h } = viewSize(); this.levels = ladder(quality);
    const fit = this.levels.findIndex(L => w * h * this.cost(L) <= BUDGET); this.level = !quality.bloom ? 0 : fit < 0 ? this.levels.length - 1 : fit;
    this.pr = this.levels[this.level].pr; quality.msaa = this.levels[this.level].msaa; r.setPixelRatio(this.pr);
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }
  resize() {
    const { w, h } = viewSize(); this.w = w; this.h = h;
    this.renderer.setSize(w, h, true);
    if (this.composer) { this.composer.setSize(w, h); }
    if (this.cam) { this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  }
  setView(scene, cam) {
    if (this.scene === scene && this.cam === cam) return;
    this.scene = scene; this.cam = cam; cam.aspect = this.w / this.h; cam.updateProjectionMatrix();
    if (!this.q.bloom) return;
    if (this.composer) { this.scenePass.scene = scene; this.scenePass.camera = cam; return; }   // one chain, reused by every view
    // the scene is drawn into a multisampled target, so edges stay smooth with bloom on
    const rt = new THREE.WebGLRenderTarget(this.w * this.pr, this.h * this.pr, { type: THREE.HalfFloatType, samples: this.q.msaa || 0 });
    this.composer = new EffectComposer(this.renderer, rt); this.composer.setPixelRatio(this.pr); this.composer.setSize(this.w, this.h);
    this.composer.addPass(this.scenePass = new RenderPass(scene, cam));
    this.composer.addPass(new ShaderPass(Sanitize));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.w / 2, this.h / 2), 0.32, 0.45, 0.86); this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }
  cost(L) { return L.pr * L.pr * (1 + 0.25 * L.msaa); }               // relative pixel work of a level
  setMsaa(n) {
    if (this.q.msaa === n) return; this.q.msaa = n; if (!this.composer) return;
    for (const t of [this.composer.renderTarget1, this.composer.renderTarget2]) { t.samples = n; t.dispose(); }
  }
  setLevel(i) {
    this.level = i; const L = this.levels[i]; this.setMsaa(L.msaa);
    if (L.pr !== this.pr) { this.pr = L.pr; this.renderer.setPixelRatio(this.pr); if (this.composer) this.composer.setPixelRatio(this.pr); this.resize(); }
    this.settle(1500);                                                    // let the new level settle before judging it
  }
  settle(ms = 2500) { this.hist = []; this.cool = ms; }                  // a stage just loaded: its first hitches don't count
  render(dtMs) {
    if (!this.scene) return;
    this.adapt(dtMs);                      // before drawing: a resize clears the canvas, so never after
    if (this.composer && this.q.bloom) this.composer.render(); else this.renderer.render(this.scene, this.cam);
  }
  // Compile every shader a scene needs up front, so nothing stalls the first time it appears on screen.
  warm(scene, cam) { try { this.renderer.compile(scene, cam); } catch (e) { console.warn(e); } }
  // Frames come at 60 fps (main.js caps faster screens). A frame over 22 ms is a dropped one; more
  // than 4 dropped in 2 seconds steps quality down a level (then bloom, then shadows). A hidden tab
  // is throttled by the browser, so it says nothing about the GPU.
  adapt(dtMs) {
    if (!(dtMs > 0) || document.hidden) return;
    this.ft = this.ft * 0.95 + Math.min(60, dtMs) * 0.05;
    if (this.cool > 0) { this.cool -= dtMs; return; }
    const H = this.hist; H.push(dtMs > 22 ? 1 : 0); if (H.length > 120) H.shift();
    let drops = 0; for (const x of H) drops += x;
    if (drops > 4) {
      if (this.level < this.levels.length - 1) this.setLevel(this.level + 1);
      else if (this.q.bloom) { this.q.bloom = false; this.hist = []; this.cool = 1500; }
      else if (this.q.shadows) { this.q.shadows = false; this.renderer.shadowMap.enabled = false; this.hist = []; this.cool = 1500; }
    }
  }
}
