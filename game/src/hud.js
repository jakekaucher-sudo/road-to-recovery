// In-race interface: timer, distance to the business, speed gauge, boosts,
// roadmap pins, funds delivered (hypothetical), wind and centre messages.
import { VIEW } from "./orient.js";
import { INPUT } from "./input.js";
import { clamp, fmtMoney, plate, rrect, text, hexA, wrapLines, fitSize } from "./util.js";
import { pixelText, pixelWidth } from "./pixelfont.js";
import { stationLogo, SETTLE, SHOW } from "./radio.js";

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
  pixelText(ctx, g.mobile ? "2X TAP GAS = BOOST" : INPUT.pad.connected ? "X / RB = BOOST" : "X / SHIFT = BOOST", gx, gy + 58 * s, Math.max(1, Math.round(1.6 * s)), "rgba(222,234,242,0.75)", { align: "center" });

  // ---- wind indicator
  if (Math.abs(g.windNow) > 0.12) {
    const wx = g.mobile ? 380 * s : 120 * s, wy = H - (g.mobile ? 110 : 80) * s, dir = Math.sign(g.windNow), k = Math.min(1, Math.abs(g.windNow) / 0.6);
    plate(ctx, wx - 96 * s, wy - 30 * s, 192 * s, 60 * s, 8 * s, "rgba(7,26,63,0.78)", RED, 2);
    pixelText(ctx, "WIND", wx - 80 * s, wy - 18 * s, Math.max(1, Math.round(2 * s)), RED);
    ctx.strokeStyle = `rgba(236,196,68,${0.5 + 0.5 * k})`; ctx.lineWidth = 5 * s; ctx.lineCap = "round"; ctx.beginPath();
    const ax = wx + 20 * s; ctx.moveTo(ax - 40 * s * dir, wy + 6 * s); ctx.lineTo(ax + 40 * s * dir, wy + 6 * s); ctx.lineTo(ax + 26 * s * dir, wy - 6 * s); ctx.moveTo(ax + 40 * s * dir, wy + 6 * s); ctx.lineTo(ax + 26 * s * dir, wy + 18 * s); ctx.stroke();
  }
  drawEscort(ctx, g, W, H, cfg, s);
  drawRadio(ctx, g, s, W);
  // ---- centre messages
  for (const m of g.messages) {
    const a = clamp(Math.min(m.t / 0.15, (m.life - m.t) / 0.3), 0, 1);
    const y = H * (m.y ?? 0.3) - (1 - a) * 12 * s;
    neonText(ctx, m.text, W / 2, y, Math.round((m.size || 5) * s), m.color || GOLD, { align: "center", alpha: a });
  }
}

// ---- radio: the station card while tuning, under the stage panel; it fades once the dial settles
function drawRadio(ctx, g, s, W) {
  const R = g.radio; if (!R || !R.enabled || R.shown > SHOW) return;
  const a = clamp(Math.min(R.shown / 0.12, (SHOW - R.shown) / 0.6), 0, 1), st = R.station, list = R.stations;
  if (g.mobile) { if (g.radioBtn) drawRadioPhone(ctx, g, R, st, a, s, W); return; }
  const x = 12 * s, y = 118 * s, w = 330 * s, h = 164 * s;
  ctx.save(); ctx.globalAlpha = a;
  plate(ctx, x, y, w, h, 10 * s, "rgba(7,26,63,0.9)", st.color, 2);
  // the dial: every station's logo in a row, the one you are on lit up and underlined
  const cell = (w - 24 * s) / list.length, big = cell * 0.86;
  list.forEach((o, i) => {
    const on = i === R.i, sz = on ? big : big * 0.74, cx = x + 12 * s + cell * (i + 0.5);
    ctx.globalAlpha = a * (on ? 1 : 0.42); ctx.drawImage(stationLogo(o), cx - sz / 2, y + 10 * s + (big - sz) / 2, sz, sz);
    if (on) { ctx.fillStyle = st.color; ctx.fillRect(cx - sz * 0.36, y + 14 * s + big, sz * 0.72, 3 * s); }
  });
  ctx.globalAlpha = a;
  const L = 64 * s, ly = y + 26 * s + big, tx = x + 26 * s + L, room = x + w - 14 * s - tx;
  ctx.drawImage(stationLogo(st), x + 14 * s, ly, L, L);
  let px = Math.max(1, Math.round(3 * s)); while (px > 1 && pixelWidth(st.name, px) > room) px--;
  neonText(ctx, st.name, tx, ly + 4 * s, px, st.color);
  const sub = [st.freq, st.genre].filter(Boolean).join("   ");
  if (sub) pixelText(ctx, sub, tx, ly + 34 * s, Math.max(1, Math.round(1.8 * s)), WHITE);
  if (st.note) { const fs = Math.round(13 * s); wrapLines(ctx, st.note, fs, room, { italic: true, weight: 400 }).slice(0, 2).forEach((l, i) => text(ctx, l, tx, ly + 64 * s + i * fs * 1.25, fs, "rgba(222,234,242,0.85)", { italic: true, weight: 400 })); }
  // how to tune (blinks "TUNING" while the dial is between stations)
  const tuning = R.t < SETTLE + 0.3, hint = tuning ? "TUNING..." : INPUT.pad.connected ? "D-PAD LEFT / RIGHT TO TUNE" : "PRESS 4 / 5 TO TUNE";
  if (!tuning || Math.floor(R.t * 8) % 2 === 0) pixelText(ctx, hint, x + w / 2, y + h - 18 * s, Math.max(1, Math.round(1.6 * s)), tuning ? NEON : "rgba(222,234,242,0.7)", { align: "center" });
  ctx.restore();
}

// Phones: a small card beside the radio button (which already shows the station's logo): name,
// frequency and genre, the host or "dramatized" note, and how to tune when it pops up on its own.
// Sized in the button's units so it stays readable on any phone, and kept left of the distance bar.
function drawRadioPhone(ctx, g, R, st, a, s, W) {
  const B = g.radioBtn, u = B.u, x = B.x + B.w + 8 * u, y = B.y, pad = 9 * u;
  const room = Math.min(250 * u, W / 2 - 226 * s - 6 * u - x), inner = room - pad * 2;
  let npx = Math.max(2, Math.round(2 * u)); while (npx > 1 && pixelWidth(st.name, npx) > inner) npx--;
  const spx = Math.max(2, Math.round(1.35 * u)), fs = Math.round(11 * u);
  const one = [st.freq, st.genre].filter(Boolean).join("   "), subs = pixelWidth(one, spx) <= inner ? [one] : [st.freq, st.genre];   // small phones: two lines
  const sub = subs.filter(Boolean);
  const tuning = R.t < SETTLE + 0.3, hint = tuning ? "TUNING..." : R.byTap ? "" : "TAP TO TUNE";
  let w = Math.max(pixelWidth(st.name, npx), ...sub.map(l => pixelWidth(l, spx)), hint ? pixelWidth(hint, spx) : 0);
  const notes = st.note ? wrapLines(ctx, st.note, fs, inner, { italic: true, weight: 400 }) : [];
  notes.forEach(l => { ctx.font = `italic 400 ${fs}px Helvetica, Arial, sans-serif`; w = Math.max(w, ctx.measureText(l).width); });
  w = Math.min(room, w + pad * 2);
  const h = pad * 2 + 7 * npx + sub.length * (5 * u + 7 * spx) + notes.length * fs * 1.25 + (notes.length ? 3 * u : 0) + (hint ? 6 * u + 7 * spx : 0);
  ctx.save(); ctx.globalAlpha = a;
  plate(ctx, x, y, w, Math.max(h, B.h), 7 * u, "rgba(7,26,63,0.9)", st.color, 2);
  let ty = y + pad;
  neonText(ctx, st.name, x + pad, ty, npx, st.color); ty += 7 * npx;
  sub.forEach(l => { ty += 5 * u; pixelText(ctx, l, x + pad, ty, spx, WHITE); ty += 7 * spx; });
  if (notes.length) ty += 3 * u;
  notes.forEach(l => { ty += fs * 1.25; text(ctx, l, x + pad, ty - fs * 0.25, fs, "rgba(222,234,242,0.85)", { italic: true, weight: 400 }); });
  if (hint && (!tuning || Math.floor(R.t * 8) % 2 === 0)) { ty += 6 * u; pixelText(ctx, hint, x + pad, ty, spx, tuning ? NEON : "rgba(222,234,242,0.75)"); }
  ctx.restore();
}

// ---- helicopter escort: ready badge, Sam's radio call, escort countdown
const HELI_ICON = typeof Path2D !== "undefined" ? new Path2D("M3 3h58v3H3zM30 6h4v6h-4zM12 15c0-3 4-4 9-4h13c7 0 12 3 14 8l1 3H21c-5 0-9-3-9-7zM48 17l13-5v4l-12 5zM20 25h3v5h-3zM38 25h3v5h-3zM13 30h33v2.5H13z") : null;
export function heliIcon(ctx, x, y, w, color) { if (!HELI_ICON) return; ctx.save(); ctx.translate(x, y); ctx.scale(w / 64, w / 64); ctx.fillStyle = color; ctx.fill(HELI_ICON); ctx.restore(); }
let samImg = null;
function sam(cfg) { if (!samImg) { samImg = new Image(); samImg.src = cfg.escort.pilot.portrait; } return samImg.complete && samImg.naturalWidth ? samImg : null; }
const easeBack = (x) => { const c = 1.6; x = clamp(x, 0, 1); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
function drawEscort(ctx, g, W, H, cfg, s) {
  const E = g.escort, C = cfg.escort; if (!E) return;
  if (E.ready) sam(cfg);                                                // have the portrait ready before it is needed
  // ready badge (keyboard and controller; phones get the pulsing helicopter button)
  if (E.ready && !g.mobile) {
    const x = 24 * s, y = H - 214 * s, w = 300 * s, h = 70 * s, pulse = 0.5 + 0.5 * Math.sin(g.clock * 6);
    plate(ctx, x, y, w, h, 10 * s, "rgba(7,26,63,0.86)", `rgba(236,196,68,${0.55 + 0.45 * pulse})`, 2 + pulse * 1.5);
    heliIcon(ctx, x + 14 * s, y + 18 * s, 58 * s, GOLD);
    neonText(ctx, "ESCORT READY", x + 86 * s, y + 14 * s, Math.max(1, Math.round(2.6 * s)), GOLD);
    pixelText(ctx, INPUT.pad.connected ? "PRESS B" : "PRESS 1", x + 86 * s, y + 44 * s, Math.max(1, Math.round(2 * s)), WHITE);
  }
  if (!E.active && E.out < 0) return;
  const D = C.duration, t = E.active ? E.t : D;
  // escort countdown
  if (E.active) {
    const bw = 300 * s, bx = W / 2 - bw / 2, by = H - 62 * s, left = Math.max(0, D - t);   // bottom centre, clear of the view ahead
    ctx.fillStyle = "rgba(7,26,63,0.8)"; rrect(ctx, bx - 8 * s, by - 6 * s, bw + 16 * s, 40 * s, 8 * s); ctx.fill();
    heliIcon(ctx, bx, by - 1 * s, 30 * s, GOLD);
    pixelText(ctx, "SBA AIR ESCORT", bx + 38 * s, by, Math.max(1, Math.round(2 * s)), GOLD);
    pixelText(ctx, Math.ceil(left) + " S", bx + bw, by, Math.max(1, Math.round(2 * s)), WHITE, { align: "right" });
    ctx.fillStyle = "rgba(236,196,68,0.2)"; ctx.fillRect(bx, by + 21 * s, bw, 5 * s); ctx.fillStyle = GOLD; ctx.fillRect(bx, by + 21 * s, bw * left / D, 5 * s);
  }
  // Sam on the radio (top right, away from where the helicopter flies): his call as he arrives,
  // his sign-off as he peels away
  const leaving = !E.active, ct = leaving ? E.out : t, show = leaving ? 3.8 : 5.4, line = leaving ? C.pilot.lineOut || "" : C.pilot.line;
  if (ct > show || !line) return;
  const w = 560 * s, h = 150 * s, kin = easeBack(ct / 0.42), kout = clamp((ct - (show - 0.45)) / 0.4, 0, 1);
  const x = W - 12 * s - w + (1 - kin) * (w + 40 * s) + kout * kout * (w + 40 * s), y = 152 * s;   // under the distance bar
  plate(ctx, x, y, w, h, 12 * s, "rgba(7,26,63,0.95)", GOLD, 3);
  const ps = h - 24 * s, px = x + 12 * s, py = y + 12 * s;
  ctx.save(); rrect(ctx, px, py, ps, ps, 10 * s); ctx.clip();
  const bg = ctx.createLinearGradient(0, py, 0, py + ps); bg.addColorStop(0, "#1d4a8f"); bg.addColorStop(1, "#071634"); ctx.fillStyle = bg; ctx.fillRect(px, py, ps, ps);
  const img = sam(cfg); if (img) ctx.drawImage(img, px - ps * 0.04, py + ps * 0.02, ps * 1.08, ps * 1.08 * img.naturalHeight / img.naturalWidth);
  ctx.fillStyle = "rgba(4,12,36,0.16)"; for (let ly = py + ((g.clock * 40) % 4) * s; ly < py + ps; ly += 4 * s) ctx.fillRect(px, ly, ps, 1.5 * s);   // radio-video scanlines
  ctx.restore();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2 * s; rrect(ctx, px, py, ps, ps, 10 * s); ctx.stroke();
  if (Math.floor(g.clock * 2.5) % 2 === 0) { ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(px + 14 * s, py + 14 * s, 5 * s, 0, Math.PI * 2); ctx.fill(); }
  pixelText(ctx, "LIVE", px + 24 * s, py + 9 * s, Math.max(1, Math.round(1.6 * s)), WHITE, { shadow: "rgba(0,0,0,0.7)" });
  const tx = px + ps + 18 * s, nameW = pixelWidth(C.pilot.name, Math.round(3.4 * s));
  neonText(ctx, C.pilot.name, tx, y + 16 * s, Math.max(1, Math.round(3.4 * s)), GOLD);
  pixelText(ctx, C.pilot.role, tx + nameW + 14 * s, y + 24 * s, Math.max(1, Math.round(1.8 * s)), NEON);
  // the line types out, as if it is coming over the radio
  const fs = Math.round(22 * s), maxW = x + w - 18 * s - tx, lines = wrapLines(ctx, line, fs, maxW, { weight: 700 });
  let chars = Math.floor(clamp((ct - 0.35) / 1.5, 0, 1) * line.length);
  lines.forEach((l, i) => { if (chars <= 0) return; const part = l.slice(0, chars); chars -= l.length + 1; text(ctx, part, tx, y + 72 * s + i * fs * 1.28, fs, WHITE, { weight: 700, shadow: "rgba(0,0,0,0.5)" }); });
}

// Stage-start banner with research fact in the SBA two-zone caption style.
export function drawStageIntro(ctx, g, W, H, cfg, t) {
  const s = Math.min(W / 1280, H / 720), st = g.stageCfg;
  const k = clamp(t / 0.5, 0, 1);
  const label = `STAGE ${g.stageIndex + 1} ▸ ${st.name}`, px = Math.round(6 * s), reach = "REACH " + cfg.businesses[st.business].name;
  let rpx = Math.max(1, Math.round(2.4 * s)); while (rpx > 1 && pixelWidth(reach, rpx) > W - 120 * s) rpx--;
  const pw = Math.max(pixelWidth(label, px), pixelWidth(reach, rpx)) + 80 * s;
  plate(ctx, W / 2 - pw / 2 - (1 - k) * W, H * 0.2, pw, 110 * s, 12 * s, "rgba(7,26,63,0.92)", GOLD, 3);
  neonText(ctx, label, W / 2 - (1 - k) * W, H * 0.2 + 22 * s, px, GOLD, { align: "center" });
  pixelText(ctx, reach, W / 2 - (1 - k) * W, H * 0.2 + 76 * s, rpx, WHITE, { align: "center" });
  const fact = cfg.facts[g.factIdx ?? st.fact];
  if (fact) {
    // on phones the GAS / BRAKE buttons sit in the bottom corners: keep the words between them
    const k = W / Math.max(1, VIEW.w), side = g.mobile ? 128 * k : 24 * s, maxW = W - side * 2;
    const fs = Math.round(22 * s), ls = wrapLines(ctx, fact.text, fs, maxW, { weight: 500 }).slice(0, 3), ss = fitSize(ctx, "Source: " + fact.source, Math.round(14 * s), maxW, { italic: true, weight: 400 });
    const bh = 22 * s + ls.length * fs * 1.25 + ss * 1.6 + 8 * s; ctx.fillStyle = "rgba(14,46,106,0.95)"; ctx.fillRect(0, H - bh, W, bh); ctx.fillStyle = GOLD; ctx.fillRect(0, H - bh, W, 3 * s);
    ls.forEach((l, i) => text(ctx, l, W / 2, H - bh + 14 * s + fs + i * fs * 1.25, fs, WHITE, { align: "center", weight: 500 }));
    text(ctx, "Source: " + fact.source, W / 2, H - 12 * s - ss * 0.3, ss, "rgba(222,234,242,0.85)", { align: "center", italic: true, weight: 400 });
    // reading time: a bar that runs down, and how to skip it
    if (g.readT && t < g.readT) {
      const left = 1 - t / g.readT, bw = W * 0.5;
      ctx.fillStyle = "rgba(236,196,68,0.25)"; ctx.fillRect(W / 2 - bw / 2, H - bh - 10 * s, bw, 4 * s); ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - bw / 2, H - bh - 10 * s, bw * left, 4 * s);
      if (t > 1.0 && Math.floor(t * 2) % 2 === 0) pixelText(ctx, INPUT.pad.connected ? "READY? PRESS A" : g.mobile ? "READY? TAP" : "READY? PRESS ENTER", W / 2, H - bh - 34 * s, Math.max(1, Math.round(2 * s)), NEON, { align: "center", shadow: "rgba(0,0,0,0.6)" });
    }
  }
}
