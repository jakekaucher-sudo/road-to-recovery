// WebGL renderer with quality tiers for laptops and phones, adaptive
// resolution (drops pixel ratio, then bloom, then shadows if frames are slow),
// and optional bloom post-processing on capable machines.
import * as THREE from "three";
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
  if (q === "high" || !lowEnd) return { high: true, mobile, pixelRatio: Math.min(dpr, 1.75), shadows: true, bloom: true, rain: 2600, particles: 900, debris: 70, far: 900 };
  return { high: false, mobile, pixelRatio: Math.min(dpr, 1.5) * 0.85, shadows: false, bloom: false, rain: 900, particles: 360, debris: 36, far: 600 };
}

export class Engine {
  constructor(canvas, quality) {
    this.q = quality; this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !quality.bloom, powerPreference: "high-performance", stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = quality.shadows; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pr = quality.pixelRatio; r.setPixelRatio(this.pr);
    this.slow = 0; this.fast = 0; this.ft = 16; this.composer = null; this.cam = null; this.scene = null;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight; this.w = w; this.h = h;
    this.renderer.setSize(w, h, true);
    if (this.composer) { this.composer.setSize(w, h); }
    if (this.cam) { this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  }
  setView(scene, cam) {
    if (this.scene === scene && this.cam === cam) return;
    this.scene = scene; this.cam = cam; cam.aspect = this.w / this.h; cam.updateProjectionMatrix();
    if (this.q.bloom) {
      this.composer = new EffectComposer(this.renderer); this.composer.setPixelRatio(this.pr); this.composer.setSize(this.w, this.h);
      this.composer.addPass(new RenderPass(scene, cam));
      this.composer.addPass(new ShaderPass(Sanitize));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(this.w / 2, this.h / 2), 0.32, 0.45, 0.86); this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
  }
  render(dtMs) {
    if (!this.scene) return;
    this.adapt(dtMs);                      // before drawing: a resize clears the canvas, so never after
    if (this.composer && this.q.bloom) this.composer.render(); else this.renderer.render(this.scene, this.cam);
  }
  // Compile every shader a scene needs up front, so nothing stalls the first time it appears on screen.
  warm(scene, cam) { try { this.renderer.compile(scene, cam); } catch (e) { console.warn(e); } }
  adapt(dtMs) {
    if (!(dtMs > 0)) return;
    this.ft = this.ft * 0.95 + Math.min(100, dtMs) * 0.05;
    if (this.ft > 21) { this.slow += dtMs; this.fast = 0; } else if (this.ft < 14) { this.fast += dtMs; this.slow = 0; } else { this.slow = this.fast = 0; }
    if (this.slow > 1500) {
      this.slow = 0;
      if (this.pr > 0.65) { this.ceiling = this.pr - 0.05; this.pr = Math.max(0.6, this.pr - 0.15); this.renderer.setPixelRatio(this.pr); if (this.composer) this.composer.setPixelRatio(this.pr); this.resize(); }
      else if (this.q.bloom) { this.q.bloom = false; }
      else if (this.q.shadows) { this.q.shadows = false; this.renderer.shadowMap.enabled = false; }
    } else if (this.fast > 4000 && this.pr < Math.min(this.q.pixelRatio, this.ceiling ?? 9) - 0.01) { this.fast = 0; this.pr = Math.min(this.q.pixelRatio, this.ceiling ?? 9, this.pr + 0.1); this.renderer.setPixelRatio(this.pr); if (this.composer) this.composer.setPixelRatio(this.pr); this.resize(); }
  }
}
