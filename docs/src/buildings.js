// Reusable building restoration system. One renderer, five business "kinds",
// five damage dressings, and a restoration progress p in [0,1] that drives
// six stages (debris, damage, materials, windows, signage, lights) whose order
// comes from each business's config. The same function draws the roadside
// approach sprite, the checkpoint hero view and the ending montage cards.
import { clamp, lerp, sat, stage, easeOut, easeOutBack, easeInOut, hash2, hexToRgb, rgbStr, mixRgb, shade, text, rrect, glow } from "./util.js";

const GRAY = [120, 118, 112];
const NAVY = [14, 46, 106], GOLD = [236, 196, 68], WHITE = [254, 254, 254], GLASS = [196, 220, 236], RED = [205, 33, 39];

// Native layout per kind (units; the building is ~760 wide, ground at y=0, up is negative).
function kindSpec(kind) {
  switch (kind) {
    case "hardware": return { bw: 720, bh: 540, floors: 2, roof: "parapet", awning: { y: -300, h: 70, w: 740 }, windows: [{ x: -300, y: -270, w: 250, h: 190 }, { x: 60, y: -270, w: 250, h: 190 }], upper: [{ x: -280, y: -500, w: 110, h: 130 }, { x: -60, y: -500, w: 110, h: 130 }, { x: 160, y: -500, w: 110, h: 130 }], door: { x: -40, y: -230, w: 90, h: 230 }, sign: { y: -390, w: 560, h: 76 } };
    case "diner": return { bw: 820, bh: 330, floors: 1, roof: "diner", awning: { y: -236, h: 48, w: 840 }, windows: [{ x: -380, y: -220, w: 200, h: 150 }, { x: -150, y: -220, w: 200, h: 150 }, { x: 160, y: -220, w: 200, h: 150 }], door: { x: 30, y: -220, w: 100, h: 220 }, sign: { y: -300, w: 520, h: 70 }, neon: true };
    case "garage": return { bw: 800, bh: 380, floors: 1, roof: "pitched", awning: null, windows: [{ x: -370, y: -250, w: 160, h: 130 }], door: { x: -190, y: -230, w: 80, h: 230 }, bay: { x: -60, y: -300, w: 400, h: 300 }, sign: { y: -330, w: 520, h: 70 }, pole: { x: -470, h: 560 } };
    case "seafood": return { bw: 700, bh: 400, floors: 1, roof: "pitched", awning: { y: -270, h: 60, w: 720 }, windows: [{ x: -300, y: -250, w: 200, h: 160 }, { x: 110, y: -250, w: 200, h: 160 }], door: { x: -50, y: -240, w: 100, h: 240 }, sign: { y: -340, w: 520, h: 74 }, shutters: true, deck: true };
    // homeowner: two-storey family home with porch and chimney
    case "house": return { bw: 600, bh: 420, floors: 2, roof: "pitched", roofH: 190, awning: null, porch: { y: -220, w: 640, h: 26 }, chimney: true,
      windows: [{ x: -260, y: -200, w: 160, h: 130 }, { x: 100, y: -200, w: 160, h: 130 }], upper: [{ x: -250, y: -380, w: 130, h: 120 }, { x: -65, y: -380, w: 130, h: 120 }, { x: 120, y: -380, w: 130, h: 120 }],
      door: { x: -45, y: -210, w: 90, h: 210 }, sign: { y: -150, w: 220, h: 44, style: "plaque", x: -170 }, shutters: true };
    // renters: three-storey condo block with balconies and entry canopy
    case "condo": return { bw: 720, bh: 620, floors: 3, roof: "parapet", awning: { y: -250, h: 46, w: 300 },
      windows: [{ x: -330, y: -200, w: 170, h: 140 }, { x: 160, y: -200, w: 170, h: 140 }],
      upper: [-330, -130, 70, 230].flatMap((x) => [{ x, y: -400, w: 100, h: 110 }, { x, y: -570, w: 100, h: 110 }]), balconies: true,
      door: { x: -50, y: -230, w: 100, h: 230 }, sign: { y: -296, w: 420, h: 60 } };
    // nonprofit: community church with steeple and rose window
    case "church": return { bw: 560, bh: 360, floors: 1, roof: "pitched", roofH: 210, awning: null, steeple: true,
      windows: [{ x: -240, y: -280, w: 90, h: 190, arch: true }, { x: 150, y: -280, w: 90, h: 190, arch: true }],
      door: { x: -60, y: -230, w: 120, h: 230, arch: true }, sign: { y: -60, w: 300, h: 70, style: "lawn", x: -470 } };
    default: return { bw: 700, bh: 420, floors: 1, roof: "parapet", awning: { y: -290, h: 72, w: 720 }, windows: [{ x: -310, y: -260, w: 230, h: 180 }, { x: 90, y: -260, w: 230, h: 180 }], door: { x: -50, y: -230, w: 100, h: 230 }, sign: { y: -380, w: 540, h: 74 } };
  }
}
// Damage dressing per disaster
function damageSpec(kind) {
  switch (kind) {
    case "wind": return { cracks: 1, broken: 0, boards: 1, awningTorn: 1, roofGap: 0.5, waterLine: 0, mud: 0, signTilt: -0.22, missingLetters: 0.3, debris: ["branch", "shingle", "shingle", "board", "trash"], sand: 0, shuttersOff: 0, siding: 0.2 };
    case "flood": return { cracks: 0.6, broken: 0, boards: 0, awningTorn: 0.4, roofGap: 0, waterLine: 1, mud: 1, signTilt: -0.05, missingLetters: 0.15, debris: ["log", "trash", "barrel", "branch", "mud"], sand: 0, shuttersOff: 0, siding: 0, sandbags: 1, doorWarp: 1 };
    case "tornado": return { cracks: 1, broken: 1, boards: 0, awningTorn: 1, roofGap: 1, waterLine: 0, mud: 0, signTilt: 0, signDown: 1, missingLetters: 0.5, debris: ["board", "board", "branch", "tire", "shingle", "trash"], sand: 0, shuttersOff: 0, siding: 1, bayBent: 1 };
    case "hurricane": return { cracks: 0.6, broken: 0.5, boards: 1, awningTorn: 1, roofGap: 0.8, waterLine: 0.6, mud: 0.5, signTilt: -0.18, missingLetters: 0.4, debris: ["frond", "frond", "board", "trash", "branch", "sand"], sand: 1, shuttersOff: 1, siding: 0.4 };
    default: return { cracks: 1, broken: 1, boards: 0, awningTorn: 1, roofGap: 0, waterLine: 0, mud: 0.2, signTilt: -0.12, missingLetters: 0.35, debris: ["branch", "board", "trash", "brick", "branch"], sand: 0, shuttersOff: 0, siding: 0 };
  }
}

// Stage windows: equal slices in the configured order, overlapping.
export function stageProgress(p, order) {
  const n = order.length, spacing = 0.92 / (n + 0.5), width = spacing * 1.7;
  const q = { debris: 1, damage: 1, materials: 1, windows: 1, signage: 1, lights: 1 };
  order.forEach((name, i) => { const a = 0.04 + i * spacing; q[name] = easeInOut(stage(p, a, Math.min(1, a + width))); });
  if (p <= 0) for (const k in q) q[k] = 0;
  return q;
}

const colOf = (hex) => hexToRgb(hex);
function dull(c, k = 0.55) { return mixRgb(c, GRAY, k); }

function sparkle(ctx, x, y, r, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#FFE98A";
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
  ctx.restore();
}
function popLines(ctx, x, y, r, a, color = "#0E2E6A") {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3 + 0.3; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r * 0.6, y + Math.sin(an) * r * 0.6); ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); ctx.stroke(); }
  ctx.restore();
}
function cracks(ctx, x, y, w, h, seed, a) {
  if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = "rgba(30,34,44,0.85)"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
  const cx = x + w * (0.3 + 0.4 * hash2(seed, 1)), cy = y + h * (0.3 + 0.4 * hash2(seed, 2));
  for (let i = 0; i < 6; i++) {
    let px = cx, py = cy; ctx.beginPath(); ctx.moveTo(px, py);
    const an = i * Math.PI / 3 + hash2(seed, i + 3) * 0.6;
    for (let k = 0; k < 4; k++) { px += Math.cos(an + (hash2(seed, k * 7 + i) - 0.5) * 0.8) * w * 0.12; py += Math.sin(an + (hash2(seed, k * 5 + i) - 0.5) * 0.8) * h * 0.12; px = clamp(px, x, x + w); py = clamp(py, y, y + h); ctx.lineTo(px, py); }
    ctx.stroke();
  }
  ctx.restore();
}
function plywood(ctx, x, y, w, h, a, lift) {
  if (a <= 0.01) return;
  const n = Math.max(2, Math.round(h / 55));
  for (let i = 0; i < n; i++) {
    const f = sat(lift * 1.3 - i * 0.25); // each board flies off in turn
    if (f >= 1) continue;
    ctx.save(); ctx.globalAlpha = a * (1 - f);
    ctx.translate(x + w / 2, y + (i + 0.5) * h / n); ctx.rotate(f * 0.9 * (i % 2 ? 1 : -1)); ctx.translate(f * 220 * (i % 2 ? 1 : -1), -f * 160 + f * f * 400);
    ctx.fillStyle = "#B08A58"; ctx.fillRect(-w / 2 - 10, -h / n / 2 + 2, w + 20, h / n - 4);
    ctx.fillStyle = "rgba(60,40,20,0.5)"; ctx.fillRect(-w / 2 - 10, -h / n / 2 + 2, w + 20, 4);
    ctx.restore();
  }
}
function drawGlass(ctx, x, y, w, h, q, env, seed, D, brokenK) {
  // frame
  ctx.fillStyle = rgbStr(mixRgb(GLASS, [120, 130, 140], 1 - q.windows)); ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, rgbStr(mixRgb([230, 240, 248], [90, 100, 110], 1 - q.windows))); g.addColorStop(1, rgbStr(mixRgb([170, 206, 232], [70, 80, 90], 1 - q.windows)));
  ctx.fillStyle = g; ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
  // interior warm glow
  if (q.lights > 0) { const gg = ctx.createRadialGradient(x + w / 2, y + h * 0.6, 10, x + w / 2, y + h * 0.6, w * 0.7); gg.addColorStop(0, `rgba(255,214,130,${0.75 * q.lights})`); gg.addColorStop(1, "rgba(255,214,130,0)"); ctx.fillStyle = gg; ctx.fillRect(x + 6, y + 6, w - 12, h - 12); }
  // gleam strokes (restored)
  if (q.windows > 0.5) { ctx.save(); ctx.globalAlpha = (q.windows - 0.5) * 2 * 0.8; ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x + w * 0.62, y + 14); ctx.lineTo(x + w * 0.3, y + h - 14); ctx.moveTo(x + w * 0.78, y + 14); ctx.lineTo(x + w * 0.6, y + h * 0.5); ctx.stroke(); ctx.restore(); }
  // mullions
  ctx.fillStyle = "rgba(20,30,50,0.55)"; ctx.fillRect(x + w / 2 - 3, y, 6, h); ctx.fillRect(x, y + h * 0.5 - 3, w, 6);
  // broken hole with shards flying back in
  if (brokenK > 0) {
    const k = 1 - q.windows;
    if (k > 0.01) {
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = "#1c2230"; ctx.beginPath();
      const cx = x + w * 0.55, cy = y + h * 0.45, r = Math.min(w, h) * 0.3 * brokenK;
      for (let i = 0; i < 9; i++) { const an = i / 9 * Math.PI * 2, rr = r * (0.6 + 0.6 * hash2(seed, i)); ctx.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.8); }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  cracks(ctx, x + 8, y + 8, w - 16, h - 16, seed, D.cracks * (1 - q.damage));
  // flood mud on the lower pane
  if (D.mud > 0) { ctx.fillStyle = `rgba(96,78,52,${0.7 * D.mud * (1 - q.damage)})`; ctx.fillRect(x + 6, y + h * 0.55, w - 12, h * 0.45 - 6); }
  plywood(ctx, x, y, w, h, D.boards, q.damage);
}

function signText(ctx, name, cx, y, w, h, color, missingK, returnK, seed) {
  const size = Math.min(h * 0.62, (w * 0.92) / Math.max(6, name.length) * 1.75);
  ctx.font = `800 ${Math.round(size)}px "Source Sans 3","Helvetica Neue",Helvetica,Arial,sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const total = ctx.measureText(name).width;
  let x = cx - total / 2;
  for (let i = 0; i < name.length; i++) {
    const ch = name[i], cw = ctx.measureText(ch).width;
    const gone = hash2(seed, i) < missingK;
    let a = 1, dy = 0, rot = 0;
    if (gone) { const r = sat(returnK * 1.4 - hash2(seed, i + 40) * 0.4); a = r; dy = (1 - easeOutBack(r)) * -40; rot = (1 - r) * 0.4; }
    if (a > 0.01) { ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + cw / 2, y + dy); ctx.rotate(rot); ctx.fillStyle = color; ctx.fillText(ch, 0, 0); ctx.restore(); }
    x += cw;
  }
}

function debrisPiece(ctx, kind, x, y, s, seed, a, lift) {
  if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha = a;
  ctx.translate(x, y - lift * 160); ctx.rotate(lift * 1.2 * (seed % 2 ? 1 : -1)); ctx.scale(1 - lift * 0.6, 1 - lift * 0.6);
  switch (kind) {
    case "branch": ctx.strokeStyle = "#5a4630"; ctx.lineWidth = 7 * s; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-60 * s, 0); ctx.lineTo(50 * s, -22 * s); ctx.moveTo(-10 * s, -10 * s); ctx.lineTo(10 * s, -42 * s); ctx.stroke(); ctx.fillStyle = "#4b7a46"; ctx.beginPath(); ctx.ellipse(18 * s, -46 * s, 22 * s, 12 * s, 0.3, 0, Math.PI * 2); ctx.fill(); break;
    case "board": ctx.fillStyle = "#9c7a4a"; ctx.save(); ctx.rotate(-0.18 + hash2(seed, 3) * 0.3); ctx.fillRect(-70 * s, -10 * s, 140 * s, 16 * s); ctx.restore(); break;
    case "shingle": ctx.fillStyle = "#5c5a60"; ctx.save(); ctx.rotate(0.3 * hash2(seed, 4)); ctx.fillRect(-26 * s, -10 * s, 52 * s, 20 * s); ctx.restore(); break;
    case "brick": ctx.fillStyle = "#a24e3c"; ctx.fillRect(-22 * s, -12 * s, 44 * s, 20 * s); ctx.fillRect(-10 * s, -30 * s, 44 * s, 18 * s); break;
    case "tire": ctx.fillStyle = "#24262b"; ctx.beginPath(); ctx.ellipse(0, -24 * s, 36 * s, 26 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#6c7280"; ctx.beginPath(); ctx.ellipse(0, -24 * s, 14 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill(); break;
    case "log": ctx.fillStyle = "#6e5436"; ctx.beginPath(); ctx.ellipse(0, -16 * s, 80 * s, 16 * s, 0.05, 0, Math.PI * 2); ctx.fill(); break;
    case "barrel": ctx.fillStyle = "#2f66a8"; ctx.save(); ctx.rotate(1.2); ctx.fillRect(-20 * s, -36 * s, 40 * s, 72 * s); ctx.restore(); break;
    case "trash": ctx.fillStyle = "#8d9299"; ctx.save(); ctx.rotate(1.0); ctx.fillRect(-18 * s, -40 * s, 36 * s, 60 * s); ctx.restore(); ctx.fillStyle = "#c9ced4"; ctx.beginPath(); ctx.arc(30 * s, -8 * s, 10 * s, 0, Math.PI * 2); ctx.fill(); break;
    case "frond": ctx.strokeStyle = "#4e7a3c"; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.moveTo(-60 * s, 0); ctx.quadraticCurveTo(0, -40 * s, 60 * s, -6 * s); for (let i = 0; i < 6; i++) { ctx.moveTo(-40 * s + i * 18 * s, -8 * s - i * 4 * s); ctx.lineTo(-30 * s + i * 18 * s, -36 * s + i * 2 * s); } ctx.stroke(); break;
    case "mud": ctx.fillStyle = "#6b5236"; ctx.beginPath(); ctx.ellipse(0, -4 * s, 90 * s, 14 * s, 0, 0, Math.PI * 2); ctx.fill(); break;
    case "sand": ctx.fillStyle = "#d8c49a"; ctx.beginPath(); ctx.ellipse(0, -6 * s, 100 * s, 18 * s, 0, 0, Math.PI * 2); ctx.fill(); break;
  }
  ctx.restore();
}

// Main renderer. Returns anchor points in screen space.
export function drawStorefront(ctx, biz, idx, cx, baseY, S, p, t, env = {}) {
  const K = kindSpec(biz.kind), D = damageSpec(biz.damage), P = biz.palette;
  const q = stageProgress(p, biz.restoreOrder || ["debris", "damage", "materials", "windows", "signage", "lights"]);
  const facade = colOf(P.facade), trim = colOf(P.trim), awA = colOf(P.awningA), awB = colOf(P.awningB), signC = colOf(P.sign);
  const wind = env.wind || 0, seed = idx * 97 + 11;
  const detail = S > 0.25; // the roadside approach sprite skips fine detail
  const bw = K.bw, bh = K.bh, x0 = -bw / 2;
  ctx.save(); ctx.translate(cx, baseY); ctx.scale(S, S);
  ctx.lineJoin = "round";

  // ---- ground: sidewalk, grime / mud / sand that fades with debris stage
  ctx.fillStyle = "#9a9ca0"; ctx.fillRect(x0 - 120, -4, bw + 240, 22);
  ctx.fillStyle = "#7f8186"; ctx.fillRect(x0 - 120, 16, bw + 240, 8);
  if (D.mud > 0 || D.sand > 0) { ctx.fillStyle = D.sand ? `rgba(216,196,150,${0.9 * (1 - q.debris)})` : `rgba(96,76,50,${0.8 * (1 - q.debris)})`; ctx.beginPath(); ctx.ellipse(0, 4, bw * 0.62, 18, 0, 0, Math.PI * 2); ctx.fill(); }
  // deck (seafood)
  if (K.deck) { ctx.fillStyle = "#8a6a46"; ctx.fillRect(x0 - 40, -14, bw + 80, 14); ctx.fillStyle = "rgba(0,0,0,0.2)"; for (let i = 0; i < 12; i++) ctx.fillRect(x0 - 40 + i * (bw + 80) / 12, -14, 2, 14); }

  // ---- body: damaged paint, then restored paint rising with the recovery wave
  const waveY = -bh * 1.3 * q.materials;             // local y of the wave front (negative = up)
  const dullFacade = dull(facade, 0.5), dullTrim = dull(trim, 0.5);
  function body(fac, tr, damaged) {
    ctx.fillStyle = rgbStr(fac); ctx.fillRect(x0, -bh, bw, bh);
    // brick / siding texture
    if (detail) { ctx.fillStyle = "rgba(0,0,0,0.07)"; for (let yy = -bh + 24; yy < -40; yy += 28) ctx.fillRect(x0, yy, bw, 3); }
    if (damaged) {
      if (D.siding > 0) { ctx.fillStyle = "rgba(40,36,34,0.85)"; for (let i = 0; i < 4; i++) { if (hash2(seed, i + 60) > D.siding) continue; const px = x0 + bw * (0.05 + 0.8 * hash2(seed, i + 70)), pw = 60 + 90 * hash2(seed, i + 80); ctx.fillRect(px, -bh + 20 + i * 42, pw, 26); } }
      if (D.waterLine > 0) { ctx.fillStyle = `rgba(70,56,40,${0.55 * D.waterLine})`; ctx.fillRect(x0, -bh * 0.36, bw, bh * 0.36); ctx.fillStyle = `rgba(40,34,30,${0.7 * D.waterLine})`; ctx.fillRect(x0, -bh * 0.36 - 6, bw, 8); }
      if (D.mud > 0) { ctx.fillStyle = `rgba(96,76,50,${0.5 * D.mud})`; ctx.fillRect(x0, -bh * 0.2, bw, bh * 0.2); }
      // grime streaks
      ctx.fillStyle = "rgba(0,0,0,0.12)"; for (let i = 0; i < 7; i++) { const sx = x0 + bw * hash2(seed, i + 90); ctx.fillRect(sx, -bh + 10, 10 + 20 * hash2(seed, i + 95), bh * 0.5 * hash2(seed, i + 99)); }
    }
    // trim / corner pilasters and base
    ctx.fillStyle = rgbStr(tr); ctx.fillRect(x0, -bh, 26, bh); ctx.fillRect(x0 + bw - 26, -bh, 26, bh); ctx.fillRect(x0, -34, bw, 34);
  }
  body(dullFacade, dullTrim, true);
  if (q.materials > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x0 - 200, waveY, bw + 400, -waveY + 60); ctx.clip(); body(facade, trim, false); ctx.restore(); }

  // ---- roof
  const roofDull = dull([80, 70, 68], 0.4), roofC = mixRgb(trim, [60, 56, 60], 0.5);
  const roofRestored = q.materials > 0.5 ? 1 : 0;
  if (K.roof === "parapet") {
    ctx.fillStyle = rgbStr(q.materials > 0.9 ? trim : dullTrim); ctx.fillRect(x0 - 14, -bh - 26, bw + 28, 26);
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x0 - 14, -bh - 4, bw + 28, 6);
  } else if (K.roof === "diner") {
    ctx.fillStyle = rgbStr(q.materials > 0.9 ? [200, 206, 214] : dull([200, 206, 214])); rrect(ctx, x0 - 20, -bh - 40, bw + 40, 46, 22); ctx.fill();
    if (K.neon) { ctx.save(); ctx.globalAlpha = q.lights; ctx.strokeStyle = "#ff6a7a"; ctx.lineWidth = 6; ctx.shadowColor = "#ff3d55"; ctx.shadowBlur = 18; ctx.beginPath(); ctx.moveTo(x0 - 4, -bh - 18); ctx.lineTo(x0 + bw + 4, -bh - 18); ctx.stroke(); ctx.restore(); }
  } else if (K.roof === "pitched") {
    const ry = -bh, rh = K.roofH || 120;
    ctx.fillStyle = rgbStr(q.materials > 0.8 ? roofC : roofDull);
    ctx.beginPath(); ctx.moveTo(x0 - 30, ry); ctx.lineTo(0, ry - rh); ctx.lineTo(x0 + bw + 30, ry); ctx.closePath(); ctx.fill();
    if (detail) { ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 3; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x0 - 30 + (bw + 60) * i / 10, ry - rh * i / 5); ctx.lineTo(x0 + bw + 30 - (bw + 60) * i / 10, ry - rh * i / 5); ctx.stroke(); } }
  }
  // roof gap with rafters, patched by panels flying in during materials
  if (D.roofGap > 0) {
    const gx = x0 + bw * 0.52, gw = bw * 0.36 * D.roofGap, gy = K.roof === "pitched" ? -bh - (K.roofH || 120) * 0.58 : -bh - 26, gh = K.roof === "pitched" ? (K.roofH || 120) * 0.58 : 26;
    const fix = sat(q.materials * 1.25 - 0.2);
    ctx.fillStyle = "#2b2420"; ctx.fillRect(gx, gy, gw, gh + 4);
    ctx.strokeStyle = "#7a5a3a"; ctx.lineWidth = 5; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(gx + gw * (i + 0.5) / 5, gy); ctx.lineTo(gx + gw * (i + 0.5) / 5, gy + gh); ctx.stroke(); }
    const panels = 4;
    for (let i = 0; i < panels; i++) {
      const f = sat(fix * 1.6 - i * 0.2); if (f <= 0) continue;
      const e = easeOutBack(f), px = gx + gw * i / panels, dy = (1 - e) * -260, rot = (1 - e) * 0.5;
      ctx.save(); ctx.translate(px + gw / panels / 2, gy + gh / 2 + dy); ctx.rotate(rot);
      ctx.fillStyle = rgbStr(K.roof === "pitched" ? roofC : trim); ctx.fillRect(-gw / panels / 2 - 1, -gh / 2, gw / panels + 2, gh);
      ctx.restore();
      if (f > 0 && f < 1) sparkle(ctx, px + gw / panels / 2, gy - 20, 16, 1 - f);
    }
  }

  // ---- chimney (house)
  if (K.chimney) {
    const cx = x0 + bw * 0.72, cTop = -bh - (K.roofH || 120) * 0.75, broken = D.roofGap > 0 ? (1 - q.materials) : 0;
    ctx.fillStyle = rgbStr(mixRgb(dull([150, 70, 56], 0.4), [150, 70, 56], q.materials)); ctx.fillRect(cx, cTop - 60 + broken * 40, 56, 90 - broken * 40);
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(cx - 4, cTop - 64 + broken * 40, 64, 10);
  }
  // ---- steeple (church): tower, bell opening, spire knocked askew when damaged
  if (K.steeple) {
    const rh = K.roofH || 120, tw = 140, tTop = -bh - rh - 170, bent = (D.roofGap > 0 ? 1 : 0.5) * (1 - easeOutBack(q.materials));
    const towerC = mixRgb(dull(facade, 0.5), facade, q.materials);
    ctx.fillStyle = rgbStr(towerC); ctx.fillRect(-tw / 2, tTop, tw, -tTop - bh + 40);
    ctx.fillStyle = rgbStr(trim); ctx.fillRect(-tw / 2 - 8, tTop - 10, tw + 16, 14);
    // bell opening
    ctx.fillStyle = "#1c2230"; ctx.beginPath(); ctx.moveTo(-34, tTop + 110); ctx.lineTo(-34, tTop + 56); ctx.arc(0, tTop + 56, 34, Math.PI, 0); ctx.lineTo(34, tTop + 110); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgbStr(mixRgb([120, 110, 80], GOLD, q.lights)); ctx.beginPath(); ctx.arc(0, tTop + 78, 16, Math.PI, 0); ctx.lineTo(18, tTop + 96); ctx.lineTo(-18, tTop + 96); ctx.closePath(); ctx.fill();
    // rose window
    const ry2 = -bh + 70;
    ctx.fillStyle = rgbStr(mixRgb([70, 80, 96], [120, 170, 220], q.windows)); ctx.beginPath(); ctx.arc(0, -bh - rh * 0.35, 46, 0, Math.PI * 2); ctx.fill();
    if (q.lights > 0) { ctx.fillStyle = `rgba(255,214,130,${0.7 * q.lights})`; ctx.beginPath(); ctx.arc(0, -bh - rh * 0.35, 46, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = rgbStr(trim); ctx.lineWidth = 5; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; ctx.moveTo(Math.cos(a) * 46, -bh - rh * 0.35 + Math.sin(a) * 46); ctx.lineTo(-Math.cos(a) * 46, -bh - rh * 0.35 - Math.sin(a) * 46); } ctx.stroke();
    cracks(ctx, -40, -bh - rh * 0.35 - 40, 80, 80, seed + 77, D.cracks * (1 - q.windows));
    // spire (pivots at its base when knocked over)
    ctx.save(); ctx.translate(0, tTop - 10); ctx.rotate(bent * 0.55);
    ctx.fillStyle = rgbStr(mixRgb(dull(roofC, 0.4), roofC, q.materials)); ctx.beginPath(); ctx.moveTo(-tw / 2 + 6, 0); ctx.lineTo(0, -200); ctx.lineTo(tw / 2 - 6, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgbStr(mixRgb([120, 110, 80], GOLD, q.signage)); ctx.beginPath(); ctx.arc(0, -206, 10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // ---- porch (house): roof on posts, sagging when damaged
  if (K.porch) {
    const Pc = K.porch, sag = D.awningTorn * (1 - easeOutBack(q.materials)) * 0.12;
    ctx.save(); ctx.translate(-Pc.w / 2, Pc.y); ctx.rotate(sag);
    ctx.fillStyle = rgbStr(mixRgb(dull(trim, 0.5), trim, q.materials)); ctx.fillRect(0, 0, Pc.w, Pc.h);
    ctx.restore();
    ctx.fillStyle = rgbStr(mixRgb(dull([235, 230, 220], 0.5), [235, 230, 220], q.materials));
    for (const px of [-Pc.w / 2 + 10, -110, 90, Pc.w / 2 - 30]) ctx.fillRect(px, Pc.y + Pc.h, 20, -Pc.y - Pc.h - 20);
    ctx.fillRect(-Pc.w / 2, -24, Pc.w, 10); // porch rail
  }
  // ---- awning: torn remnant drops away (damage), new one unfurls (materials)
  if (K.awning) {
    const A = K.awning, ax = -A.w / 2, ay = A.y, stripes = 10;
    const tornK = D.awningTorn * (1 - q.damage);
    if (tornK > 0.01) {
      ctx.save(); ctx.globalAlpha = tornK; ctx.translate(0, (1 - tornK) * 80);
      ctx.fillStyle = rgbStr(dull(awA, 0.5));
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + A.w, ay);
      for (let i = 0; i <= 12; i++) { const fx = ax + A.w - i * A.w / 12; const flap = Math.sin(t * 7 + i) * 8 * (0.3 + wind); ctx.lineTo(fx, ay + A.h * (0.4 + 0.8 * hash2(seed, i + 120)) + flap); }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    const unfurl = sat(q.materials * 1.5 - 0.35);
    if (unfurl > 0) {
      ctx.save(); ctx.translate(0, ay); ctx.scale(1, unfurl); ctx.translate(0, -ay);
      for (let i = 0; i < stripes; i++) { ctx.fillStyle = rgbStr(i % 2 ? awB : awA); ctx.beginPath(); ctx.moveTo(ax + i * A.w / stripes, ay); ctx.lineTo(ax + (i + 1) * A.w / stripes, ay); ctx.lineTo(ax + (i + 1) * A.w / stripes + 10, ay + A.h); ctx.lineTo(ax + i * A.w / stripes + 10, ay + A.h); ctx.closePath(); ctx.fill(); }
      // scalloped edge
      ctx.fillStyle = rgbStr(awA); for (let i = 0; i < stripes; i++) { ctx.beginPath(); ctx.arc(ax + (i + 0.5) * A.w / stripes + 10, ay + A.h, A.w / stripes / 2, 0, Math.PI); ctx.fill(); }
      ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(ax, ay, A.w, 6);
      ctx.restore();
    }
  }

  // ---- windows (display), upper windows, door, garage bay
  K.windows.forEach((win) => { if (win.arch) { ctx.fillStyle = rgbStr(mixRgb([90, 100, 110], GLASS, q.windows)); ctx.beginPath(); ctx.arc(win.x + win.w / 2, win.y, win.w / 2, Math.PI, 0); ctx.fill(); if (q.lights > 0) { ctx.fillStyle = `rgba(255,214,130,${0.7 * q.lights})`; ctx.fill(); } } });
  K.windows.forEach((win, i) => drawGlass(ctx, win.x, win.y, win.w, win.h, q, env, seed + i * 7, D, D.broken * (i === 0 ? 1 : 0.4)));
  if (K.balconies) K.upper && K.upper.forEach((win, i) => {
    const bent = D.awningTorn * (1 - q.materials) * (i % 3 === 0 ? 1 : 0.3);
    ctx.save(); ctx.translate(win.x - 20, win.y + win.h + 4); ctx.rotate(bent * 0.15);
    ctx.fillStyle = rgbStr(mixRgb(dull(trim, 0.5), trim, q.materials)); ctx.fillRect(0, 0, win.w + 40, 10);
    ctx.strokeStyle = rgbStr(mixRgb(dull([230, 230, 235], 0.5), [230, 230, 235], q.materials)); ctx.lineWidth = 3; ctx.beginPath();
    for (let k = 0; k <= 6; k++) { ctx.moveTo(k * (win.w + 40) / 6, 0); ctx.lineTo(k * (win.w + 40) / 6, -34); } ctx.moveTo(0, -34); ctx.lineTo(win.w + 40, -34); ctx.stroke();
    ctx.restore();
  });
  if (K.upper) K.upper.forEach((win, i) => { const qq = { ...q, lights: q.lights * (i % 2 ? 1 : 0.6) }; drawGlass(ctx, win.x, win.y, win.w, win.h, qq, env, seed + 50 + i * 3, { ...D, boards: D.boards * (i === 1 ? 1 : 0), broken: 0 }, 0); });
  // shutters (seafood): hanging when damaged, reattached at materials
  if (K.shutters) K.windows.forEach((win, i) => {
    const fix = easeOutBack(sat(q.materials * 1.4 - 0.3 - i * 0.15));
    for (const side of [-1, 1]) {
      const sx = side < 0 ? win.x - 30 : win.x + win.w + 2, hang = D.shuttersOff * (1 - fix) * (side < 0 ? 0.6 : 0.15);
      ctx.save(); ctx.translate(sx + 14, win.y); ctx.rotate(hang); ctx.fillStyle = rgbStr(mixRgb(trim, [60, 90, 120], 0.5)); ctx.fillRect(-14, 0, 28, win.h); ctx.fillStyle = "rgba(0,0,0,0.2)"; for (let k = 1; k < 8; k++) ctx.fillRect(-14, win.h * k / 8, 28, 3); ctx.restore();
    }
  });
  // door (warped when flooded / tornado), with a sign that flips to OPEN
  {
    const d = K.door, warp = (D.doorWarp || 0) * (1 - q.damage) * 0.12 + (D.broken ? (1 - q.damage) * 0.05 : 0);
    ctx.save(); ctx.translate(d.x, d.y + d.h); ctx.rotate(-warp);
    ctx.fillStyle = rgbStr(mixRgb(dull(trim, 0.6), trim, q.materials)); ctx.fillRect(0, -d.h, d.w, d.h);
    ctx.fillStyle = rgbStr(mixRgb([90, 100, 110], GLASS, q.windows)); ctx.fillRect(10, -d.h + 12, d.w - 20, d.h * 0.5);
    if (q.lights > 0) { ctx.fillStyle = `rgba(255,214,130,${0.5 * q.lights})`; ctx.fillRect(10, -d.h + 12, d.w - 20, d.h * 0.5); }
    ctx.fillStyle = "#c9ced4"; ctx.fillRect(d.w - 22, -d.h * 0.45, 8, 20);
    if (!biz.type || biz.type === "BUSINESS") {
    // CLOSED / OPEN sign
    const open = q.lights;
    ctx.fillStyle = open > 0.5 ? "#CD2127" : "#5c6066"; rrect(ctx, 14, -d.h * 0.42, d.w - 28, 26, 4); ctx.fill();
    if (detail) { ctx.fillStyle = "#fff"; ctx.font = "700 16px Helvetica, Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(open > 0.5 ? "OPEN" : "CLOSED", d.w / 2, -d.h * 0.42 + 13); }
    }
    ctx.restore();
    if (D.sandbags) { const k = 1 - q.debris; if (k > 0.01) { ctx.save(); ctx.globalAlpha = k; for (let r = 0; r < 2; r++) for (let i = 0; i < 4 - r; i++) { ctx.fillStyle = r ? "#b0a078" : "#bfae84"; ctx.beginPath(); ctx.ellipse(d.x - 20 + i * 40 + r * 20, -14 - r * 24, 24, 13, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } }
  }
  // garage bay door: bent panels straighten with materials
  if (K.bay) {
    const b = K.bay, panels = 6, bent = (D.bayBent || 0) * (1 - q.materials);
    for (let i = 0; i < panels; i++) {
      const py = b.y + b.h * i / panels, off = bent * (i % 2 ? 14 : -10) * (i < 3 ? 1 : 0.3), missing = bent > 0.5 && i === 1;
      ctx.fillStyle = missing ? "#1e222c" : rgbStr(mixRgb(dull([200, 204, 210], 0.5), [200, 204, 210], q.materials));
      ctx.fillRect(b.x + off, py, b.w, b.h / panels - 3);
      ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(b.x + off, py + b.h / panels - 6, b.w, 3);
    }
    if (q.lights > 0) { ctx.fillStyle = `rgba(255,214,130,${0.25 * q.lights})`; ctx.fillRect(b.x, b.y, b.w, b.h); }
  }

  // ---- sign board: tilted / down when damaged, straightens with signage stage, letters return
  {
    const s = K.sign, sw = s.w, sh = s.h;
    let rot = D.signTilt * (1 - q.signage), dy = 0, dx = 0;
    if (D.signDown) { const k = 1 - easeOutBack(q.signage); rot = 1.25 * k; dy = (s.y * -1 - 80) * k; dx = (bw * 0.42) * k; }
    if (s.style === "lawn") { // posts in the yard
      ctx.fillStyle = "#6a6e74"; ctx.fillRect((s.x || 0) - sw * 0.35, s.y, 10, -s.y); ctx.fillRect((s.x || 0) + sw * 0.35 - 10, s.y, 10, -s.y);
    }
    ctx.save(); ctx.translate((s.x || 0) + dx + (D.signTilt ? sw * 0.5 * (1 - q.signage) * 0.25 : 0), s.y + dy); ctx.rotate(rot);
    const boardC = mixRgb(dull(signC, 0.55), signC, q.signage), textC = mixRgb(signC, WHITE, 0.9);
    const onNavy = signC[0] + signC[1] + signC[2] < 400;
    ctx.fillStyle = rgbStr(boardC); rrect(ctx, -sw / 2, -sh / 2, sw, sh, 8); ctx.fill();
    ctx.strokeStyle = rgbStr(onNavy ? GOLD : NAVY); ctx.lineWidth = 4; rrect(ctx, -sw / 2 + 6, -sh / 2 + 6, sw - 12, sh - 12, 6); ctx.stroke();
    if (detail) signText(ctx, biz.signText || biz.name, 0, 2, sw - 30, sh, rgbStr(onNavy ? WHITE : NAVY), D.missingLetters, q.signage, seed + 300);
    // marquee bulbs
    if (q.lights > 0 && detail && !s.style) { ctx.fillStyle = `rgba(255,236,160,${q.lights})`; const n = Math.round(sw / 36); for (let i = 0; i <= n; i++) { const bx = -sw / 2 + i * sw / n, on = Math.sin(t * 6 + i) > -0.3 ? 1 : 0.5; ctx.globalAlpha = q.lights * on; ctx.beginPath(); ctx.arc(bx, -sh / 2 - 6, 5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(bx, sh / 2 + 6, 5, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
    ctx.restore();
  }
  // pole sign (garage)
  if (K.pole) {
    const lean = 0.35 * (1 - q.signage);
    ctx.save(); ctx.translate(K.pole.x, 0); ctx.rotate(lean);
    ctx.fillStyle = "#6a6e74"; ctx.fillRect(-8, -K.pole.h, 16, K.pole.h);
    ctx.fillStyle = rgbStr(mixRgb(dull(GOLD, 0.6), GOLD, q.signage)); rrect(ctx, -80, -K.pole.h - 70, 160, 80, 10); ctx.fill();
    if (detail) { ctx.fillStyle = rgbStr(NAVY); ctx.font = "800 38px Helvetica, Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("AUTO", 0, -K.pole.h - 30); }
    ctx.restore();
  }

  // ---- debris in front (removed one by one during the debris stage)
  D.debris.forEach((kind, i) => {
    const lift = sat(q.debris * 1.5 - i * 0.11);
    const dx = x0 + 40 + (bw - 80) * hash2(seed, 200 + i), dy = 6 + 10 * hash2(seed, 230 + i);
    debrisPiece(ctx, kind, dx, dy, 1, seed + i, 1 - lift, lift);
    if (lift > 0 && lift < 1) { sparkle(ctx, dx, dy - 60 - lift * 100, 14 + 10 * lift, 1 - lift); popLines(ctx, dx, dy - 40 - lift * 120, 30, (1 - lift) * 0.7, "#ECC444"); }
  });

  // ---- thriving touches: planters, lamp, string lights (lights stage)
  if (q.lights > 0.05) {
    const k = easeOutBack(q.lights);
    ctx.save(); ctx.globalAlpha = sat(q.lights * 2);
    for (const px of [x0 + 60, x0 + bw - 60]) {
      ctx.save(); ctx.translate(px, 0); ctx.scale(k, k);
      ctx.fillStyle = "#8a5a3a"; ctx.fillRect(-34, -40, 68, 40);
      ctx.fillStyle = "#4b8a46"; ctx.beginPath(); ctx.ellipse(0, -52, 42, 24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e8505a"; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-28 + i * 14, -58 - (i % 2) * 10, 6, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    // string lights across the front
    if (detail) { ctx.strokeStyle = "rgba(60,60,70,0.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 - 10, K.sign.y + 70); ctx.quadraticCurveTo(0, K.sign.y + 110, x0 + bw + 10, K.sign.y + 70); ctx.stroke(); for (let i = 1; i < 12; i++) { const f = i / 12, lx = x0 - 10 + (bw + 20) * f, ly = K.sign.y + 70 + 40 * 4 * f * (1 - f) * 0.5 + 6; ctx.fillStyle = `rgba(255,230,150,${0.6 + 0.4 * Math.sin(t * 5 + i)})`; ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
  }

  // ---- the recovery wave front itself (gold band with sparkles)
  if (q.materials > 0 && q.materials < 1) {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const g = ctx.createLinearGradient(0, waveY - 60, 0, waveY + 30);
    g.addColorStop(0, "rgba(236,196,68,0)"); g.addColorStop(0.7, "rgba(255,230,140,0.85)"); g.addColorStop(1, "rgba(236,196,68,0)");
    ctx.fillStyle = g; ctx.fillRect(x0 - 60, waveY - 60, bw + 120, 90);
    ctx.restore();
    for (let i = 0; i < 14; i++) { const sx = x0 - 40 + (bw + 80) * hash2(seed, 400 + i), ph = (t * 2 + hash2(seed, 420 + i)) % 1; sparkle(ctx, sx, waveY - 20 - ph * 60, 8 + 8 * (1 - ph), (1 - ph) * 0.9); }
  }
  ctx.restore();
  const top = -bh - (K.steeple ? (K.roofH || 120) + 380 : K.roof === "pitched" ? (K.roofH || 120) : 40);
  return { signX: cx, signY: baseY + K.sign.y * S, top: baseY + top * S, left: cx + x0 * S, right: cx + (x0 + bw) * S, width: bw * S, height: -top * S, doorX: cx + (K.door.x + K.door.w / 2) * S };
}

export { kindSpec };
