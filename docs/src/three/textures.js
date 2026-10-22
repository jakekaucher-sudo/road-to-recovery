// Procedural textures (canvas-generated, no image files): asphalt with lane
// markings, curbs, ground detail, soft blob shadow, glow sprite, chevrons.
import * as THREE from "three";

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = opts.aniso || 8;
  return t;
}
const rnd = (() => { let s = 1234567; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

export function asphaltTexture() {
  return canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = "#4a4d52"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { const v = 60 + rnd() * 50; g.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + rnd() * 0.3})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    // tyre wear in each lane
    for (const lane of [1 / 6, 3 / 6, 5 / 6]) for (const o of [-0.07, 0.07]) { g.fillStyle = "rgba(20,22,26,0.18)"; g.fillRect((lane + o) * w - 18, 0, 36, h); }
    // patches and cracks
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(30,32,36,${0.15 + rnd() * 0.2})`; g.fillRect(rnd() * w, rnd() * h, 30 + rnd() * 90, 20 + rnd() * 60); }
    g.strokeStyle = "rgba(25,25,28,0.5)"; g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) { g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 40; y += rnd() * 30; g.lineTo(x, y); } g.stroke(); }
    // edge lines (solid white) and lane dashes
    g.fillStyle = "#e9e6dc"; g.fillRect(10, 0, 12, h); g.fillRect(w - 22, 0, 12, h);
    g.fillStyle = "#e9e6dc"; for (const f of [1 / 3, 2 / 3]) for (let y = 0; y < h; y += 512) g.fillRect(f * w - 6, y + 40, 12, 300);
  });
}
export function curbTexture() {
  return canvasTex(64, 256, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "#e8e8e4" : "#c3282e"; g.fillRect(0, i * h / 4, w, h / 4); } g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, 0, 6, h); });
}
export function groundTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 90 + rnd() * 90; g.fillStyle = `rgba(${v},${v},${v},0.35)`; const s = 1 + rnd() * 3; g.fillRect(rnd() * w, rnd() * h, s, s * (1 + rnd() * 3)); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${100 + rnd() * 60},${100 + rnd() * 60},${100 + rnd() * 60},0.18)`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 20 + rnd() * 60, 10 + rnd() * 40, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  });
}
export function blobTexture() {
  return canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(0,0,0,0.75)"); gr.addColorStop(0.6, "rgba(0,0,0,0.4)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { clamp: true });
}
export function glowTexture() {
  return canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { clamp: true });
}
export function chevronTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = "rgba(236,196,68,0.35)"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,226,120,0.95)"; g.lineWidth = 26; g.lineJoin = "miter";
    g.beginPath(); g.moveTo(40, 190); g.lineTo(128, 90); g.lineTo(216, 190); g.stroke();
    g.fillStyle = "rgba(255,240,180,0.9)"; g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h);
  });
}
export function textTexture(lines, opts = {}) {
  const w = opts.w || 1024, h = opts.h || 256;
  return canvasTex(w, h, (g) => {
    g.fillStyle = opts.bg || "#0E2E6A"; g.fillRect(0, 0, w, h);
    if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 14; g.strokeRect(10, 10, w - 20, h - 20); }
    g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((l, i) => {
      let size = l.size || 90; const font = (sz) => `${l.weight || 800} ${sz}px Helvetica, Arial, sans-serif`;
      g.font = font(size); const mw = w * 0.84, tw = g.measureText(l.text).width; if (tw > mw) { size = Math.floor(size * mw / tw); g.font = font(size); }
      g.fillStyle = l.color || "#fff"; g.fillText(l.text, w / 2, h * (lines.length === 1 ? 0.5 : 0.32 + i * 0.4));
    });
  }, { clamp: true });
}
