// Synthwave sprite library: dark navy silhouettes with neon edges in the SBA
// palette (light blue, gold, red, white). Every draw call is anchored at the
// sprite's bottom-centre (x, y) with u = screen pixels per road half-width.
import { hash2, rgbStr, mixRgb } from "./util.js";

// Width in road half-widths and height/width aspect; hitW > 0 means solid.
export const DEFS = {
  palm: { w: 0.28, a: 3.0, hit: 0.06 }, palmBent: { w: 0.3, a: 2.6, hit: 0.06 }, lamp: { w: 0.1, a: 6.0, hit: 0.03 },
  tree: { w: 0.42, a: 1.7, hit: 0.08 }, treeBent: { w: 0.42, a: 1.6, hit: 0.08 }, treeBroken: { w: 0.4, a: 1.0, hit: 0.08 }, treeSunk: { w: 0.42, a: 1.5, hit: 0.08 },
  pole: { w: 0.08, a: 7.0, hit: 0.03 }, poleLean: { w: 0.08, a: 7.0, hit: 0.03 },
  house: { w: 1.0, a: 0.8, hit: 0.5 }, houseTarp: { w: 1.0, a: 0.8, hit: 0.5 }, houseFlooded: { w: 1.0, a: 0.8, hit: 0.5 }, houseStilts: { w: 1.0, a: 1.0, hit: 0.5 },
  billboard: { w: 1.1, a: 0.85, hit: 0.1 }, warning: { w: 0.22, a: 2.2, hit: 0.04 }, sandbagWall: { w: 0.5, a: 0.4, hit: 0.25 },
  barn: { w: 1.2, a: 0.8, hit: 0.6 }, silo: { w: 0.45, a: 2.6, hit: 0.22 }, windmill: { w: 0.42, a: 2.6, hit: 0.05 }, fence: { w: 0.8, a: 0.35, hit: 0.0 }, hay: { w: 0.26, a: 0.7, hit: 0.13 },
  dune: { w: 1.3, a: 0.28, hit: 0.0 }, boat: { w: 0.8, a: 0.55, hit: 0.4 }, lighthouse: { w: 0.4, a: 3.4, hit: 0.2 },
  gate: { w: 2.3, a: 0.55, hit: 0 }, stopSign: { w: 0.5, a: 1.6, hit: 0.05 }, business: { w: 2.3, a: 0.72, hit: 0 },
};
export const HAZ = { // on-road hazards: w in half-widths, effect
  cones: { w: 0.3, a: 0.5, fx: "bump" }, debris: { w: 0.34, a: 0.45, fx: "crash" }, branch: { w: 0.55, a: 0.35, fx: "crash" },
  puddle: { w: 0.55, a: 0.06, fx: "water" }, sand: { w: 0.6, a: 0.08, fx: "sand" }, log: { w: 0.45, a: 0.25, fx: "crash" },
  barrel: { w: 0.16, a: 1.0, fx: "crash" }, sandbags: { w: 0.4, a: 0.35, fx: "crash" }, tumble: { w: 0.34, a: 0.6, fx: "crash" },
  hay: { w: 0.28, a: 0.75, fx: "crash" }, poleDown: { w: 0.85, a: 0.18, fx: "crash" }, frond: { w: 0.4, a: 0.2, fx: "bump" },
  waveCrest: { w: 2.0, a: 0.25, fx: "none" },
};

const NEON = { blue: "92,200,255", gold: "236,196,68", red: "205,33,39", white: "222,234,242" };
function neon(ctx, color, lw, a = 1) { // stroke current path with a soft neon glow
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(${color},${0.22 * a})`; ctx.lineWidth = lw * 3.2; ctx.stroke();
  ctx.strokeStyle = `rgba(${color},${0.9 * a})`; ctx.lineWidth = lw; ctx.stroke();
}
function fogged(c, fog, env) { return rgbStr(mixRgb(c, env.fog, fog)); }
const SIL = [8, 18, 44];

export function drawSprite(ctx, sp, x, y, u, fog, env, t) {
  const def = DEFS[sp.kind] || DEFS.tree, w = def.w * u, h = w * def.a;
  if (w < 1.5) return;
  const lw = Math.max(1, w * 0.035), a = 1 - fog * 0.85;
  const sil = fogged(SIL, fog * 0.6, env), wind = env.wind + Math.sin(t * 2 + (sp.seed || 0)) * 0.1 * env.gust;
  ctx.save();
  switch (sp.kind) {
    case "palm": case "palmBent": {
      const bend = sp.kind === "palmBent" ? 0.55 + 0.45 * wind : 0.12 + 0.2 * wind;
      const tx = x + bend * w * 0.9, ty = y - h * 0.86;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + bend * w * 0.15, y - h * 0.5, tx, ty);
      ctx.strokeStyle = sil; ctx.lineWidth = Math.max(1.5, w * 0.1); ctx.stroke(); neon(ctx, NEON.blue, lw * 0.6, a * 0.7);
      for (let i = 0; i < 7; i++) {
        const an = -Math.PI * 0.95 + i * (Math.PI * 0.9 / 6) + bend * 0.9 + Math.sin(t * (2 + 6 * wind) + i) * 0.08 * wind;
        const L = w * (0.55 + 0.12 * (i % 2)) * (1 + 0.3 * bend);
        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(an) * L * 0.6, ty + Math.sin(an) * L * 0.6, tx + Math.cos(an) * L + bend * L * 0.5, ty + Math.sin(an) * L * 0.5 + L * 0.35);
        ctx.strokeStyle = sil; ctx.lineWidth = Math.max(1, w * 0.07); ctx.stroke(); neon(ctx, NEON.blue, lw * 0.5, a * 0.8);
      }
      break;
    }
    case "lamp": {
      const side = sp.offset < 0 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.lineTo(x + side * w * 2.2, y - h * 0.97);
      ctx.strokeStyle = sil; ctx.lineWidth = Math.max(1, w * 0.18); ctx.stroke(); neon(ctx, NEON.white, lw * 0.4, a * 0.5);
      const lx = x + side * w * 2.2, ly = y - h * 0.95;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, w * 3.2); g.addColorStop(0, `rgba(${NEON.gold},${0.65 * a})`); g.addColorStop(1, `rgba(${NEON.gold},0)`);
      ctx.fillStyle = g; ctx.fillRect(lx - w * 3.2, ly - w * 3.2, w * 6.4, w * 6.4);
      ctx.fillStyle = `rgba(255,240,190,${a})`; ctx.fillRect(lx - w * 0.5, ly, w, Math.max(1, w * 0.25));
      break;
    }
    case "tree": case "treeBent": case "treeSunk": case "treeBroken": {
      const bend = sp.kind === "treeBent" ? 0.5 + 0.5 * wind : 0.15 * wind;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + bend * w * 0.2, y - h * 0.4, x + bend * w * 0.5, y - h * (sp.kind === "treeBroken" ? 0.5 : 0.6));
      ctx.strokeStyle = sil; ctx.lineWidth = Math.max(1.5, w * 0.12); ctx.stroke();
      if (sp.kind === "treeBroken") { ctx.beginPath(); ctx.moveTo(x + bend * w * 0.5, y - h * 0.5); ctx.lineTo(x + w * 0.7, y - h * 0.05); ctx.stroke(); neon(ctx, NEON.gold, lw * 0.5, a * 0.6); break; }
      const cx = x + bend * w * 0.7, cy = y - h * 0.68;
      ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.5 * (1 + 0.3 * bend), h * 0.32, bend * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = sil; ctx.fill(); neon(ctx, NEON.blue, lw * 0.6, a * 0.7);
      if (sp.kind === "treeSunk") { ctx.fillStyle = `rgba(30,70,110,${0.7 * a})`; ctx.fillRect(x - w * 0.6, y - h * 0.18, w * 1.2, h * 0.18); }
      break;
    }
    case "pole": case "poleLean": {
      const lean = sp.kind === "poleLean" ? 0.12 : 0;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + lean * h, y - h); ctx.moveTo(x + lean * h - w * 1.5, y - h * 0.92 + lean * w); ctx.lineTo(x + lean * h + w * 1.5, y - h * 0.92 - lean * w);
      ctx.strokeStyle = sil; ctx.lineWidth = Math.max(1, w * 0.4); ctx.stroke(); neon(ctx, NEON.white, lw * 0.35, a * 0.35);
      break;
    }
    case "house": case "houseTarp": case "houseFlooded": case "houseStilts": {
      let by = y; if (sp.kind === "houseStilts") { ctx.fillStyle = sil; for (let i = 0; i < 4; i++) ctx.fillRect(x - w * 0.42 + i * w * 0.28, y - h * 0.25, Math.max(1, w * 0.03), h * 0.25); by = y - h * 0.24; }
      const bh = h * 0.52;
      ctx.beginPath(); ctx.rect(x - w / 2, by - bh, w, bh); ctx.moveTo(x - w * 0.58, by - bh); ctx.lineTo(x, by - bh - h * 0.38); ctx.lineTo(x + w * 0.58, by - bh);
      ctx.fillStyle = sil; ctx.fill(); neon(ctx, NEON.blue, lw * 0.6, a * 0.75);
      const lit = hash2(sp.seed || 1, 3) > 0.35;
      for (let i = 0; i < 2; i++) { ctx.fillStyle = lit && i === 0 ? `rgba(${NEON.gold},${0.85 * a})` : `rgba(30,50,90,${a})`; ctx.fillRect(x - w * 0.36 + i * w * 0.52, by - bh * 0.72, w * 0.2, bh * 0.3); }
      if (sp.kind === "houseTarp") { ctx.beginPath(); ctx.moveTo(x - w * 0.05, by - bh - h * 0.36); ctx.lineTo(x + w * 0.5, by - bh); ctx.lineTo(x + w * 0.1, by - bh); ctx.closePath(); ctx.fillStyle = `rgba(54,122,182,${a})`; ctx.fill(); }
      if (sp.kind === "houseFlooded") { ctx.fillStyle = `rgba(30,80,120,${0.75 * a})`; ctx.fillRect(x - w * 0.7, y - bh * 0.35, w * 1.4, bh * 0.35); ctx.beginPath(); ctx.moveTo(x - w * 0.7, y - bh * 0.35); ctx.lineTo(x + w * 0.7, y - bh * 0.35); neon(ctx, NEON.blue, lw * 0.5, a * 0.8); }
      break;
    }
    case "billboard": {
      ctx.fillStyle = sil; ctx.fillRect(x - w * 0.3, y - h * 0.45, Math.max(1, w * 0.04), h * 0.45); ctx.fillRect(x + w * 0.26, y - h * 0.45, Math.max(1, w * 0.04), h * 0.45);
      ctx.beginPath(); ctx.rect(x - w / 2, y - h, w, h * 0.58); ctx.fillStyle = fogged([14, 46, 106], fog * 0.5, env); ctx.fill(); neon(ctx, NEON.gold, lw * 0.6, a);
      if (w > 60) {
        const msgs = ["SBA DISASTER RECOVERY", "RECOVERY CENTER AHEAD", "HELPING YOU RECOVER", "BUSINESSES ▪ RENTERS", "SBA.GOV/DISASTER"];
        const m = msgs[(sp.seed || 0) % msgs.length];
        ctx.fillStyle = `rgba(254,254,254,${a})`; ctx.font = `800 ${Math.round(h * 0.13)}px Helvetica, Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(m, x, y - h * 0.71, w * 0.9);
      }
      break;
    }
    case "warning": {
      const s = w * 0.5; ctx.fillStyle = sil; ctx.fillRect(x - s * 0.08, y - h * 0.55, Math.max(1, s * 0.16), h * 0.55);
      ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + s, y - h + s); ctx.lineTo(x, y - h + 2 * s); ctx.lineTo(x - s, y - h + s); ctx.closePath();
      ctx.fillStyle = `rgba(236,196,68,${a})`; ctx.fill(); neon(ctx, NEON.gold, lw * 0.5, a);
      break;
    }
    case "sandbagWall": case "hay": {
      ctx.fillStyle = fogged(sp.kind === "hay" ? [120, 100, 50] : [110, 100, 76], fog, env);
      if (sp.kind === "hay") { ctx.beginPath(); ctx.ellipse(x, y - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); neon(ctx, NEON.gold, lw * 0.4, a * 0.6); }
      else for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) { ctx.beginPath(); ctx.ellipse(x - w * 0.38 + i * w * 0.25 + r * w * 0.12, y - h * (0.18 + r * 0.3), w * 0.14, h * 0.17, 0, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case "barn": {
      ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h * 0.55); ctx.lineTo(x - w * 0.28, y - h * 0.9); ctx.lineTo(x, y - h); ctx.lineTo(x + w * 0.28, y - h * 0.9); ctx.lineTo(x + w / 2, y - h * 0.55); ctx.lineTo(x + w / 2, y); ctx.closePath();
      ctx.fillStyle = fogged([60, 16, 22], fog, env); ctx.fill(); neon(ctx, NEON.red, lw * 0.6, a);
      ctx.beginPath(); ctx.moveTo(x - w * 0.12, y); ctx.lineTo(x - w * 0.12, y - h * 0.4); ctx.lineTo(x + w * 0.12, y - h * 0.4); ctx.lineTo(x + w * 0.12, y); neon(ctx, NEON.white, lw * 0.4, a * 0.7);
      break;
    }
    case "silo": case "lighthouse": {
      const lh = sp.kind === "lighthouse";
      ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w * (lh ? 0.3 : 0.5), y - h * 0.85); ctx.lineTo(x + w * (lh ? 0.3 : 0.5), y - h * 0.85); ctx.lineTo(x + w / 2, y); ctx.closePath();
      ctx.fillStyle = sil; ctx.fill(); neon(ctx, lh ? NEON.red : NEON.blue, lw * 0.6, a);
      if (lh) {
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - w * 0.45, y - h * 0.22 * i); ctx.lineTo(x + w * 0.45, y - h * 0.22 * i); neon(ctx, NEON.red, lw * 0.4, a * 0.7); }
        const bx = x, by = y - h * 0.92, ang = t * 1.6;
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(ang) * w * 6, by - w * 0.4); ctx.lineTo(bx + Math.cos(ang) * w * 6, by + w * 0.4); ctx.closePath();
        ctx.fillStyle = `rgba(${NEON.gold},${0.25 * a * Math.abs(Math.cos(ang))})`; ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = `rgba(255,240,190,${a})`; ctx.beginPath(); ctx.arc(bx, by, w * 0.18, 0, Math.PI * 2); ctx.fill();
      } else { ctx.beginPath(); ctx.ellipse(x, y - h * 0.85, w / 2, w * 0.25, 0, Math.PI, 0); ctx.fillStyle = sil; ctx.fill(); neon(ctx, NEON.blue, lw * 0.6, a); }
      break;
    }
    case "windmill": {
      ctx.beginPath(); ctx.moveTo(x - w * 0.3, y); ctx.lineTo(x, y - h * 0.82); ctx.lineTo(x + w * 0.3, y);
      ctx.strokeStyle = sil; ctx.lineWidth = Math.max(1, w * 0.06); ctx.stroke(); neon(ctx, NEON.blue, lw * 0.4, a * 0.6);
      const rot = t * (2 + 9 * wind) + (sp.seed || 0);
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const an = rot + i * Math.PI / 4; ctx.moveTo(x, y - h * 0.82); ctx.lineTo(x + Math.cos(an) * w * 0.5, y - h * 0.82 + Math.sin(an) * w * 0.5); }
      neon(ctx, NEON.gold, lw * 0.4, a * 0.8);
      break;
    }
    case "fence": { ctx.beginPath(); for (let i = 0; i < 5; i++) { const fx = x - w / 2 + i * w / 4, l = i === 2 ? 0.3 : 0; ctx.moveTo(fx, y); ctx.lineTo(fx + l * h, y - h); } ctx.moveTo(x - w / 2, y - h * 0.7); ctx.lineTo(x + w * 0.2, y - h * 0.75); neon(ctx, NEON.gold, lw * 0.4, a * 0.6); break; }
    case "dune": { ctx.beginPath(); ctx.ellipse(x, y, w / 2, h, 0, Math.PI, 0); ctx.fillStyle = fogged([70, 62, 60], fog, env); ctx.fill(); neon(ctx, NEON.gold, lw * 0.4, a * 0.5); break; }
    case "boat": {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3);
      ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.45); ctx.lineTo(w * 0.45, -h * 0.45); ctx.lineTo(w * 0.5, -h * 0.75); ctx.lineTo(-w * 0.45, -h * 0.75); ctx.closePath();
      ctx.fillStyle = sil; ctx.fill(); neon(ctx, NEON.white, lw * 0.5, a); ctx.beginPath(); ctx.moveTo(0, -h * 0.75); ctx.lineTo(0, -h * 1.6); neon(ctx, NEON.white, lw * 0.4, a * 0.7); ctx.restore();
      break;
    }
    case "gate": { // the neon RECOVERY STOP gantry across the road
      const pw = w * 0.04, top = y - h;
      ctx.fillStyle = sil; ctx.fillRect(x - w / 2, top, pw, h); ctx.fillRect(x + w / 2 - pw, top, pw, h);
      ctx.beginPath(); ctx.rect(x - w / 2, top, w, h * 0.22); ctx.fillStyle = fogged([14, 46, 106], fog * 0.4, env); ctx.fill(); neon(ctx, NEON.gold, lw * 0.8, a);
      if (w > 80) { ctx.fillStyle = `rgba(236,196,68,${a})`; ctx.font = `900 ${Math.round(h * 0.15)}px Helvetica, Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("▼  RECOVERY STOP  ▼", x, top + h * 0.11, w * 0.9); }
      break;
    }
    case "stopSign": {
      ctx.fillStyle = sil; ctx.fillRect(x - w * 0.04, y - h * 0.55, Math.max(1, w * 0.08), h * 0.55);
      ctx.beginPath(); ctx.rect(x - w / 2, y - h, w, h * 0.48); ctx.fillStyle = fogged([14, 46, 106], fog * 0.4, env); ctx.fill(); neon(ctx, NEON.gold, lw * 0.6, a);
      if (w > 34) { ctx.fillStyle = `rgba(254,254,254,${a})`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `800 ${Math.round(h * 0.12)}px Helvetica, Arial`; ctx.fillText("STOP", x, y - h * 0.86, w * 0.9); ctx.fillStyle = `rgba(236,196,68,${a})`; ctx.fillText(sp.label, x, y - h * 0.66, w * 0.9); }
      break;
    }
  }
  ctx.restore();
}

export function drawHazard(ctx, hz, x, y, u, fog, env, t) {
  const def = HAZ[hz.kind] || HAZ.debris, w = def.w * u, h = w * def.a;
  if (w < 1.5) return;
  const lw = Math.max(1, w * 0.03), a = 1 - fog * 0.8;
  ctx.save();
  switch (hz.kind) {
    case "cones": for (let i = 0; i < 3; i++) { const cx = x - w * 0.35 + i * w * 0.35; ctx.beginPath(); ctx.moveTo(cx - w * 0.1, y); ctx.lineTo(cx, y - h); ctx.lineTo(cx + w * 0.1, y); ctx.closePath(); ctx.fillStyle = `rgba(240,120,40,${a})`; ctx.fill(); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(cx - w * 0.05, y - h * 0.55, w * 0.1, h * 0.12); } break;
    case "debris": case "frond": {
      for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(x + (hash2(hz.seed, i) - 0.5) * w * 0.8, y - h * 0.3 * hash2(hz.seed, i + 5)); ctx.rotate((hash2(hz.seed, i + 9) - 0.5) * 1.4); ctx.fillStyle = hz.kind === "frond" ? `rgba(60,110,70,${a})` : `rgba(${110 + 40 * (i % 2)},${90 + 20 * (i % 2)},70,${a})`; ctx.fillRect(-w * 0.25, -Math.max(1, h * 0.12), w * 0.5, Math.max(2, h * 0.24)); ctx.restore(); }
      ctx.beginPath(); ctx.moveTo(x - w * 0.45, y); ctx.lineTo(x + w * 0.45, y); ctx.strokeStyle = `rgba(${NEON.gold},${0.5 * a})`; ctx.lineWidth = lw; ctx.stroke();
      break;
    }
    case "branch": case "log": case "poleDown": {
      ctx.beginPath(); ctx.moveTo(x - w / 2, y - h * 0.4); ctx.lineTo(x + w / 2, y - h * 0.6);
      ctx.strokeStyle = hz.kind === "poleDown" ? `rgba(60,56,60,${a})` : `rgba(96,70,46,${a})`; ctx.lineWidth = Math.max(2, h * 0.55); ctx.stroke();
      if (hz.kind === "branch") { ctx.beginPath(); ctx.ellipse(x + w * 0.4, y - h * 0.8, w * 0.22, h * 0.7, 0.3, 0, Math.PI * 2); ctx.fillStyle = `rgba(30,60,44,${a})`; ctx.fill(); }
      if (hz.kind === "poleDown") { ctx.beginPath(); ctx.moveTo(x + w / 2, y - h * 0.6); ctx.quadraticCurveTo(x + w * 0.8, y - h * 3, x + w * 1.2, y - h * 0.2); ctx.strokeStyle = `rgba(${NEON.gold},${0.8 * a})`; ctx.lineWidth = lw; ctx.stroke(); }
      break;
    }
    case "barrel": { ctx.fillStyle = `rgba(54,122,182,${a})`; ctx.fillRect(x - w / 2, y - h, w, h); ctx.fillStyle = `rgba(14,46,106,${a})`; ctx.fillRect(x - w / 2, y - h * 0.68, w, h * 0.1); ctx.fillRect(x - w / 2, y - h * 0.35, w, h * 0.1); break; }
    case "sandbags": { for (let r = 0; r < 2; r++) for (let i = 0; i < 3 - r; i++) { ctx.beginPath(); ctx.ellipse(x - w * 0.3 + i * w * 0.3 + r * w * 0.15, y - h * (0.25 + r * 0.45), w * 0.17, h * 0.26, 0, 0, Math.PI * 2); ctx.fillStyle = `rgba(150,136,100,${a})`; ctx.fill(); } break; }
    case "tumble": case "hay": {
      const rot = t * 6 + hz.seed;
      ctx.translate(x, y - h / 2); ctx.rotate(rot);
      if (hz.kind === "hay") { ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fillStyle = `rgba(150,124,60,${a})`; ctx.fill(); ctx.strokeStyle = `rgba(${NEON.gold},${0.7 * a})`; ctx.lineWidth = lw; ctx.stroke(); }
      else { ctx.fillStyle = `rgba(120,124,130,${a})`; ctx.fillRect(-w / 2, -h / 4, w, h / 2); ctx.strokeStyle = `rgba(${NEON.white},${0.6 * a})`; ctx.lineWidth = lw; ctx.strokeRect(-w / 2, -h / 4, w, h / 2); }
      break;
    }
    case "puddle": case "sand": {
      ctx.beginPath(); ctx.ellipse(x, y, w / 2, Math.max(1, w * 0.06), 0, 0, Math.PI * 2);
      ctx.fillStyle = hz.kind === "sand" ? `rgba(150,130,96,${0.75 * a})` : `rgba(40,100,150,${0.6 * a})`; ctx.fill();
      if (hz.kind === "puddle") { ctx.strokeStyle = `rgba(${NEON.blue},${0.5 * a})`; ctx.lineWidth = lw; ctx.stroke(); }
      break;
    }
    case "waveCrest": { // surf breaking over the road edge from the sea side
      const ph = (t * 0.9 + hz.seed * 0.001) % 1, k = Math.sin(ph * Math.PI);
      ctx.beginPath(); ctx.moveTo(x + w * 0.5, y); ctx.quadraticCurveTo(x + w * 0.2, y - h * 3 * k, x - w * (0.1 + 0.4 * k), y);
      ctx.fillStyle = `rgba(200,230,250,${0.55 * k * a})`; ctx.fill(); ctx.strokeStyle = `rgba(${NEON.blue},${0.8 * k * a})`; ctx.lineWidth = lw * 1.5; ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

export function drawPickup(ctx, p, x, y, u, fog, t) {
  const w = 0.2 * u; if (w < 2) return;
  const bob = Math.sin(t * 5 + p.offset * 3) * w * 0.12, cy = y - w * 0.9 + bob, a = 1 - fog * 0.6;
  ctx.save();
  const g = ctx.createRadialGradient(x, cy, 0, x, cy, w * 1.4); g.addColorStop(0, `rgba(${NEON.gold},${0.55 * a})`); g.addColorStop(1, `rgba(${NEON.gold},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - w * 1.4, cy - w * 1.4, w * 2.8, w * 2.8);
  ctx.beginPath(); ctx.arc(x, cy, w * 0.45, 0, Math.PI * 2); ctx.fillStyle = `rgba(14,46,106,${a})`; ctx.fill();
  ctx.strokeStyle = `rgba(${NEON.gold},${a})`; ctx.lineWidth = Math.max(1, w * 0.08); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x, cy - w * 0.3); ctx.moveTo(x, cy); ctx.lineTo(x + w * 0.22, cy); ctx.stroke();
  if (w > 18) { ctx.fillStyle = `rgba(254,254,254,${a})`; ctx.font = `800 ${Math.round(w * 0.32)}px Helvetica, Arial`; ctx.textAlign = "center"; ctx.fillText("+" + p.bonus + "s", x, cy - w * 0.62); }
  ctx.restore();
}

// Traffic, seen from behind, with glowing taillights.
const CAR_COLORS = [[60, 64, 76], [96, 30, 36], [40, 80, 96], [168, 172, 180], [230, 232, 236], [24, 28, 36]];
const CAR_DEF = { sedan: { w: 0.36, a: 0.62 }, hatch: { w: 0.34, a: 0.7 }, pickup: { w: 0.4, a: 0.68 }, utility: { w: 0.42, a: 0.95 }, boxtruck: { w: 0.46, a: 1.25 } };
export function carWidth(car) { return (CAR_DEF[car.type] || CAR_DEF.sedan).w; }
export function drawCar(ctx, car, x, y, u, fog, env, t, braking) {
  const def = CAR_DEF[car.type] || CAR_DEF.sedan, w = def.w * u, h = w * def.a;
  if (w < 2) return;
  const a = 1 - fog * 0.7;
  const col = car.type === "utility" ? [232, 234, 236] : car.type === "boxtruck" ? [210, 214, 220] : CAR_COLORS[car.color % CAR_COLORS.length];
  const body = fogged(col, fog * 0.7 + 0.15, env), dark = fogged([10, 12, 20], fog * 0.6, env);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, y, w * 0.55, w * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = dark; ctx.fillRect(x - w * 0.44, y - h * 0.18, w * 0.16, h * 0.18); ctx.fillRect(x + w * 0.28, y - h * 0.18, w * 0.16, h * 0.18);
  if (car.type === "boxtruck") {
    ctx.fillStyle = body; ctx.fillRect(x - w / 2, y - h, w, h * 0.88);
    ctx.strokeStyle = `rgba(0,0,0,0.25)`; ctx.lineWidth = Math.max(1, w * 0.01); for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2, y - h + h * 0.22 * i); ctx.lineTo(x + w / 2, y - h + h * 0.22 * i); ctx.stroke(); }
  } else if (car.type === "pickup" || car.type === "utility") {
    ctx.fillStyle = body; ctx.fillRect(x - w / 2, y - h * 0.62, w, h * 0.5);
    ctx.beginPath(); ctx.moveTo(x - w * 0.36, y - h * 0.62); ctx.lineTo(x - w * 0.3, y - h); ctx.lineTo(x + w * 0.3, y - h); ctx.lineTo(x + w * 0.36, y - h * 0.62); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fogged([20, 40, 70], fog, env); ctx.fillRect(x - w * 0.26, y - h * 0.93, w * 0.52, h * 0.24);
    if (car.type === "utility") { const on = Math.sin(t * 12 + car.seed) > 0; ctx.fillStyle = on ? "rgba(255,170,40,1)" : "rgba(120,80,20,1)"; ctx.fillRect(x - w * 0.22, y - h * 1.06, w * 0.44, h * 0.07); if (on) { ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(x, y - h, 0, x, y - h, w * 0.8); g.addColorStop(0, `rgba(255,170,40,${0.5 * a})`); g.addColorStop(1, "rgba(255,170,40,0)"); ctx.fillStyle = g; ctx.fillRect(x - w, y - h * 1.8, w * 2, h * 1.6); ctx.globalCompositeOperation = "source-over"; } }
  } else {
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(x - w / 2, y - h * 0.12); ctx.lineTo(x - w / 2, y - h * 0.55); ctx.lineTo(x - w * 0.34, y - h * (car.type === "hatch" ? 1 : 0.95)); ctx.lineTo(x + w * 0.34, y - h * (car.type === "hatch" ? 1 : 0.95)); ctx.lineTo(x + w / 2, y - h * 0.55); ctx.lineTo(x + w / 2, y - h * 0.12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fogged([20, 40, 70], fog, env); ctx.beginPath(); ctx.moveTo(x - w * 0.36, y - h * 0.6); ctx.lineTo(x - w * 0.28, y - h * 0.88); ctx.lineTo(x + w * 0.28, y - h * 0.88); ctx.lineTo(x + w * 0.36, y - h * 0.6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(${NEON.blue},${0.5 * a})`; ctx.lineWidth = Math.max(1, w * 0.012); ctx.beginPath(); ctx.moveTo(x - w * 0.2, y - h * 0.84); ctx.lineTo(x + w * 0.05, y - h * 0.64); ctx.stroke();
  }
  // bumper, plate, taillights
  ctx.fillStyle = dark; ctx.fillRect(x - w / 2, y - h * 0.16, w, h * 0.06);
  ctx.fillStyle = `rgba(236,232,210,${a})`; ctx.fillRect(x - w * 0.09, y - h * 0.3, w * 0.18, h * 0.08);
  const ty = y - h * (car.type === "boxtruck" ? 0.24 : 0.42), tw = w * 0.16, th = Math.max(2, h * 0.09);
  ctx.fillStyle = braking ? "rgba(255,60,60,1)" : "rgba(205,33,39,1)"; ctx.fillRect(x - w * 0.47, ty, tw, th); ctx.fillRect(x + w * 0.47 - tw, ty, tw, th);
  ctx.globalCompositeOperation = "lighter";
  for (const lx of [x - w * 0.47 + tw / 2, x + w * 0.47 - tw / 2]) { const r = w * (braking ? 0.55 : 0.32); const g = ctx.createRadialGradient(lx, ty + th / 2, 0, lx, ty + th / 2, r); g.addColorStop(0, `rgba(255,50,50,${(braking ? 0.75 : 0.45) * a})`); g.addColorStop(1, "rgba(255,50,50,0)"); ctx.fillStyle = g; ctx.fillRect(lx - r, ty - r, r * 2, r * 2); }
  ctx.restore();
}
