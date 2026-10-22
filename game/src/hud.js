// In-race interface: timer, distance to the business, speed gauge, boosts,
// roadmap pins, funds delivered (hypothetical), wind and centre messages.
import { clamp, fmtMoney, plate, rrect, text, hexA, wrapLines, fitSize } from "./util.js";
import { pixelText, pixelWidth } from "./pixelfont.js";

const GOLD = "#ECC444", NAVY = "#0E2E6A", WHITE = "#FEFEFE", RED = "#CD2127", NEON = "#5CC8FF", GREEN = "#3C7C54";

export function neonText(ctx, s, x, y, px, color, opts = {}) {
  ctx.save(); ctx.globalAlpha = (opts.alpha ?? 1) * 0.35;
  pixelText(ctx, s, x - px * 0.5, y - px * 0.5, px, opts.glow || color, { align: opts.align });
  pixelText(ctx, s, x + px * 0.5, y + px * 0.5, px, opts.glow || color, { align: opts.align });
  ctx.restore();
  return pixelText(ctx, s, x, y, px, color, { align: opts.align, shadow: opts.shadow ?? "rgba(0,0,0,0.6)", alpha: opts.alpha });
}

export function drawHUD(ctx, g, W, H, cfg) {
  const s = Math.min(W / 1280, H / 720); // UI scale
  const P = g.player, stage = g.stageCfg;
  // ---- top centre: TIME and distance
  const tLeft = Math.max(0, Math.ceil(g.time));
  const low = g.time < 10 && Math.floor(g.clock * 4) % 2 === 0;
  plate(ctx, W / 2 - 120 * s, 10 * s, 240 * s, 96 * s, 10 * s, "rgba(7,26,63,0.82)", low ? RED : GOLD, 2);
  neonText(ctx, "TIME", W / 2, 20 * s, Math.round(2.5 * s), NEON, { align: "center" });
  neonText(ctx, String(tLeft), W / 2, 40 * s, Math.round(7 * s), low ? RED : GOLD, { align: "center" });
  // distance bar
  const prog = clamp(g.progress, 0, 1), bx = W / 2 - 220 * s, by = 116 * s, bw = 440 * s;
  ctx.fillStyle = "rgba(7,26,63,0.75)"; rrect(ctx, bx - 6 * s, by - 6 * s, bw + 12 * s, 30 * s, 6 * s); ctx.fill();
  ctx.fillStyle = "rgba(92,200,255,0.18)"; ctx.fillRect(bx, by + 6 * s, bw, 6 * s);
  ctx.fillStyle = NEON; ctx.fillRect(bx, by + 6 * s, bw * prog, 6 * s);
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(bx + bw, by + 9 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = WHITE; rrect(ctx, bx + bw * prog - 9 * s, by + 3 * s, 18 * s, 12 * s, 3 * s); ctx.fill(); ctx.fillStyle = RED; ctx.fillRect(bx + bw * prog - 6 * s, by + 7 * s, 12 * s, 3 * s);
  pixelText(ctx, g.distMiles.toFixed(1) + " MI TO " + (cfg.businesses[stage.business].signText || cfg.businesses[stage.business].name), W / 2, by + 26 * s, Math.max(1, Math.round(2 * s)), "#DEEAF2", { align: "center", shadow: "rgba(0,0,0,0.6)" });

  // ---- top left: stage + roadmap
  plate(ctx, 12 * s, 10 * s, 330 * s, 96 * s, 10 * s, "rgba(7,26,63,0.82)", GOLD, 2);
  neonText(ctx, `STAGE ${g.stageIndex + 1}`, 28 * s, 22 * s, Math.round(3 * s), GOLD);
  pixelText(ctx, stage.name, 28 * s, 50 * s, Math.max(1, Math.round(2 * s)), WHITE);
  for (let i = 0; i < 5; i++) {
    const px = 40 * s + i * 62 * s, py = 88 * s, done = i < g.stageIndex || (i === g.stageIndex && g.delivered), cur = i === g.stageIndex && !done;
    ctx.fillStyle = "rgba(255,255,255,0.25)"; if (i < 4) ctx.fillRect(px, py - 1 * s, 62 * s, 2 * s);
    ctx.fillStyle = done ? GREEN : cur ? GOLD : "#367AB6"; ctx.beginPath(); ctx.arc(px, py, (cur ? 8 + Math.sin(g.clock * 6) * 1.5 : 7) * s, 0, Math.PI * 2); ctx.fill();
    if (done) { ctx.strokeStyle = WHITE; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(px - 3.5 * s, py); ctx.lineTo(px - 1 * s, py + 3 * s); ctx.lineTo(px + 4 * s, py - 3 * s); ctx.stroke(); }
  }
  // ---- top right: funds delivered (hypothetical)
  plate(ctx, W - 342 * s, 10 * s, 330 * s, 96 * s, 10 * s, "rgba(7,26,63,0.82)", GOLD, 2);
  pixelText(ctx, "FUNDS DELIVERED", W - 28 * s, 22 * s, Math.max(1, Math.round(2 * s)), WHITE, { align: "right" });
  neonText(ctx, fmtMoney(g.fundsShown), W - 28 * s, 42 * s, Math.round(4 * s), GOLD, { align: "right" });
  text(ctx, "hypothetical amounts", W - 28 * s, 96 * s, Math.round(13 * s), "rgba(222,234,242,0.75)", { align: "right", italic: true, weight: 400 });

  // ---- speed gauge (bottom right; raised on phones above the gas pedal)
  const gx = g.mobile ? W - 360 * s : W - 150 * s, gy = H - (g.mobile ? 120 : 96) * s, r = 92 * s;
  const sk = clamp(P.speed / cfg.physics.boostSpeed, 0, 1);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(7,26,63,0.85)"; ctx.lineWidth = 22 * s; ctx.beginPath(); ctx.arc(gx, gy, r, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke();
  const segs = 24;
  for (let i = 0; i < segs; i++) {
    const f = i / segs; if (f > sk) break;
    const a0 = Math.PI * (0.9 + 1.2 * f), a1 = Math.PI * (0.9 + 1.2 * (f + 0.8 / segs));
    ctx.strokeStyle = f > 0.77 ? NEON : f > 0.55 ? GOLD : "#DEEAF2"; ctx.lineWidth = 14 * s; ctx.lineCap = "butt";
    ctx.beginPath(); ctx.arc(gx, gy, r, a0, a1); ctx.stroke();
  }
  neonText(ctx, String(Math.round(g.mph)), gx, gy - 36 * s, Math.round(6 * s), WHITE, { align: "center", glow: NEON });
  pixelText(ctx, "MPH", gx, gy + 10 * s, Math.max(1, Math.round(2 * s)), NEON, { align: "center" });
  // boosts
  for (let i = 0; i < cfg.physics.boostsPerStage; i++) {
    const on = i < g.boosts, bx2 = gx - 50 * s + i * 50 * s, by2 = gy + 40 * s;
    ctx.fillStyle = on ? NEON : "rgba(92,200,255,0.18)";
    ctx.beginPath(); ctx.moveTo(bx2 - 12 * s, by2); ctx.lineTo(bx2, by2 - 10 * s); ctx.lineTo(bx2 + 12 * s, by2); ctx.lineTo(bx2, by2 + 10 * s); ctx.closePath(); ctx.fill();
  }
  pixelText(ctx, g.mobile ? "2X TAP GAS = BOOST" : "X / SHIFT = BOOST", gx, gy + 58 * s, Math.max(1, Math.round(1.6 * s)), "rgba(222,234,242,0.75)", { align: "center" });

  // ---- wind indicator
  if (Math.abs(g.windNow) > 0.12) {
    const wx = g.mobile ? 380 * s : 120 * s, wy = H - (g.mobile ? 110 : 80) * s, dir = Math.sign(g.windNow), k = Math.min(1, Math.abs(g.windNow) / 0.6);
    plate(ctx, wx - 96 * s, wy - 30 * s, 192 * s, 60 * s, 8 * s, "rgba(7,26,63,0.78)", RED, 2);
    pixelText(ctx, "WIND", wx - 80 * s, wy - 18 * s, Math.max(1, Math.round(2 * s)), RED);
    ctx.strokeStyle = `rgba(236,196,68,${0.5 + 0.5 * k})`; ctx.lineWidth = 5 * s; ctx.lineCap = "round"; ctx.beginPath();
    const ax = wx + 20 * s; ctx.moveTo(ax - 40 * s * dir, wy + 6 * s); ctx.lineTo(ax + 40 * s * dir, wy + 6 * s); ctx.lineTo(ax + 26 * s * dir, wy - 6 * s); ctx.moveTo(ax + 40 * s * dir, wy + 6 * s); ctx.lineTo(ax + 26 * s * dir, wy + 18 * s); ctx.stroke();
  }
  // ---- centre messages
  for (const m of g.messages) {
    const a = clamp(Math.min(m.t / 0.15, (m.life - m.t) / 0.3), 0, 1);
    const y = H * (m.y ?? 0.3) - (1 - a) * 12 * s;
    neonText(ctx, m.text, W / 2, y, Math.round((m.size || 5) * s), m.color || GOLD, { align: "center", alpha: a });
  }
}

// Stage-start banner with research fact in the SBA two-zone caption style.
export function drawStageIntro(ctx, g, W, H, cfg, t) {
  const s = Math.min(W / 1280, H / 720), st = g.stageCfg;
  const k = clamp(t / 0.5, 0, 1);
  const label = `STAGE ${g.stageIndex + 1} ▸ ${st.name}`, px = Math.round(6 * s);
  const pw = pixelWidth(label, px) + 80 * s;
  plate(ctx, W / 2 - pw / 2 - (1 - k) * W, H * 0.2, pw, 110 * s, 12 * s, "rgba(7,26,63,0.92)", GOLD, 3);
  neonText(ctx, label, W / 2 - (1 - k) * W, H * 0.2 + 22 * s, px, GOLD, { align: "center" });
  pixelText(ctx, "REACH " + cfg.businesses[st.business].name, W / 2 - (1 - k) * W, H * 0.2 + 76 * s, Math.max(1, Math.round(2.4 * s)), WHITE, { align: "center" });
  const fact = cfg.facts[st.fact];
  if (fact) {
    // on phones the GAS / BRAKE buttons sit in the bottom corners: keep the words between them
    const k = W / Math.max(1, window.innerWidth), side = g.mobile ? 128 * k : 24 * s, maxW = W - side * 2;
    const fs = Math.round(22 * s), ls = wrapLines(ctx, fact.text, fs, maxW, { weight: 500 }).slice(0, 3), ss = fitSize(ctx, "Source: " + fact.source, Math.round(14 * s), maxW, { italic: true, weight: 400 });
    const bh = 22 * s + ls.length * fs * 1.25 + ss * 1.6 + 8 * s; ctx.fillStyle = "rgba(14,46,106,0.95)"; ctx.fillRect(0, H - bh, W, bh); ctx.fillStyle = GOLD; ctx.fillRect(0, H - bh, W, 3 * s);
    ls.forEach((l, i) => text(ctx, l, W / 2, H - bh + 14 * s + fs + i * fs * 1.25, fs, WHITE, { align: "center", weight: 500 }));
    text(ctx, "Source: " + fact.source, W / 2, H - 12 * s - ss * 0.3, ss, "rgba(222,234,242,0.85)", { align: "center", italic: true, weight: 400 });
  }
}
