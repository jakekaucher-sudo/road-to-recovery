// Non-driving screens. Each takes (ctx, game, W, H, t) and draws a full frame
// or an overlay. The restoration screen is the built-in "arrival" placeholder
// that a custom cutscene can replace later.
import { clamp, lerp, sat, stage, smooth, easeOut, easeOutBack, easeInOut, fmtMoney, plate, rrect, text, hash2, wrapLines, fitSize } from "./util.js";
import { INPUT } from "./input.js";
import { pixelText, pixelWidth } from "./pixelfont.js";
import { neonText } from "./hud.js";
import { WEATHER, blendWeather } from "./weather.js";
import { drawStorefront } from "./buildings.js";
import { drawVanSide } from "./van.js";

const GOLD = "#ECC444", NAVY = "#0E2E6A", WHITE = "#FEFEFE", NEON = "#5CC8FF", RED = "#CD2127", GREEN = "#3C7C54", LB = "#DEEAF2";

// Neon perspective grid floor used by the menus and scenes.
export function gridFloor(ctx, W, H, horizonY, t, speed, color = "92,200,255", ground = "#050E2A") {
  ctx.fillStyle = ground; ctx.fillRect(0, horizonY, W, H - horizonY);
  ctx.strokeStyle = `rgba(${color},0.55)`; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let i = -18; i <= 18; i++) { ctx.moveTo(W / 2 + i * 12, horizonY); ctx.lineTo(W / 2 + i * W * 0.16, H); }
  const off = (t * speed) % 1;
  for (let k = 0; k < 18; k++) { const z = k + 1 - off; const y = horizonY + (H - horizonY) * (1.2 / (z + 0.2)) * 0.18; if (y > H) continue; ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  const g = ctx.createLinearGradient(0, horizonY, 0, horizonY + 60); g.addColorStop(0, `rgba(${color},0.35)`); g.addColorStop(1, `rgba(${color},0)`); ctx.fillStyle = g; ctx.fillRect(0, horizonY, W, 60);
}

// ---------------------------------------------------------------- title
export function drawTitle(ctx, game, W, H, t) {
  const s = Math.min(W / 1280, H / 720);
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.45); g.addColorStop(0, "rgba(4,12,36,0.75)"); g.addColorStop(1, "rgba(4,12,36,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.45);
  neonText(ctx, game.cfg.presentedBy, W / 2, 46 * s, Math.round(3 * s), GOLD, { align: "center" });
  neonText(ctx, "THE ROAD TO", W / 2, 84 * s, Math.round(7 * s), LB, { align: "center", glow: NEON });
  neonText(ctx, "RECOVERY", W / 2, 150 * s, Math.round(13 * s), GOLD, { align: "center", glow: RED });
  if (Math.floor(t * 2) % 2 === 0) neonText(ctx, INPUT.pad.connected ? "PRESS A TO START" : game.mobile ? "TAP TO START" : "PRESS ENTER TO START", W / 2, H * 0.88, Math.round(4 * s), WHITE, { align: "center", glow: NEON });
  // controls card
  const lines = (INPUT.pad.connected
    ? ["LEFT STICK  STEER", "RT  GAS", "LT  BRAKE", "X OR RB  BOOST", "D-PAD < >  RADIO", "MENU  PAUSE"]
    : game.mobile
    ? [INPUT.steerMode === "tilt" ? "TILT PHONE  STEER" : "DRAG SCREEN  STEER", "HOLD GAS  RIGHT PEDAL", "HOLD BRAKE  LEFT PEDAL", "TAP GAS TWICE  BOOST", "TAP THE RADIO  STATION"]
    : ["← →  STEER", "↑  GAS", "↓ SPACE C  BRAKE", "X SHIFT  BOOST", "4 5  RADIO", "P  PAUSE   M  MUSIC"]).map(l => l.replace("←", "<").replace("→", ">").replace("↑", "^").replace("↓", "V"));
  // the card is sized from its text, so the words always sit inside it
  const px = Math.max(1, Math.round(2 * s)), lh = Math.max(22 * s, 10 * px), pad = 16 * s;
  const cw = Math.max(...lines.map(l => pixelWidth(l, px))) + pad * 2, ch = (lines.length - 1) * lh + 7 * px + pad * 2, cx = 24 * s, cy = H - ch - 24 * s;
  plate(ctx, cx, cy, cw, ch, 10 * s, "rgba(7,26,63,0.85)", GOLD, 2);
  lines.forEach((l, i) => pixelText(ctx, l, cx + pad, cy + pad + i * lh, px, i % 2 ? LB : WHITE));
  const disc = "Homes, businesses, nonprofits and amounts in this game are fictional / hypothetical.", dMax = W - cx - cw - 48 * s;
  text(ctx, disc, W - 24 * s, H - 20 * s, fitSize(ctx, disc, Math.round(13 * s), dMax, { italic: true, weight: 400 }), "rgba(222,234,242,0.7)", { align: "right", italic: true, weight: 400 });
  if (game.gyroNote) {
    const fs = Math.round(16 * s), ls = wrapLines(ctx, game.gyroNote, fs, W * 0.7), bw = W * 0.74, bh2 = ls.length * fs * 1.3 + 20 * s, by = H * 0.53 - fs;
    plate(ctx, W / 2 - bw / 2, by, bw, bh2, 8 * s, "rgba(40,10,20,0.85)", "#FFB4B4", 1);
    ls.forEach((l, i) => text(ctx, l, W / 2, by + 10 * s + fs + i * fs * 1.3, fs, "#FFD2D2", { align: "center", weight: 600 }));
  }
}

// ---------------------------------------------------------------- briefing (intro placeholder)
export function drawBriefing(ctx, game, W, H, t) {
  const s = Math.min(W / 1280, H / 720), R = game.renderer, hy = H * 0.5;
  R.drawSky(ctx, WEATHER.dusk, t, t * 4, hy, {}); gridFloor(ctx, W, H, hy, t, 0.4);
  ctx.fillStyle = "rgba(4,12,36,0.55)"; ctx.fillRect(0, 0, W, H);
  neonText(ctx, "MISSION BRIEFING", W / 2, 60 * s, Math.round(5 * s), GOLD, { align: "center" });
  const lines = [
    "A STRING OF DISASTERS HAS HIT FIVE TOWNS.",
    "DRIVE THE SBA MOBILE RECOVERY VEHICLE TO EACH",
    "DAMAGED HOME, BUSINESS AND NONPROFIT IN TIME.",
    "STOP IN THE GOLD RECOVERY ZONE TO DELIVER HELP.",
  ];
  lines.forEach((l, i) => { const a = smooth(0.3 + i * 0.5, 0.6 + i * 0.5, t); if (a > 0) pixelText(ctx, l, W / 2, 150 * s + i * 40 * s, Math.max(1, Math.round(3 * s)), i === 3 ? GOLD : WHITE, { align: "center", alpha: a }); });
  // five pins
  game.cfg.businesses.forEach((b, i) => {
    const a = smooth(2.2 + i * 0.25, 2.5 + i * 0.25, t); if (a <= 0) return;
    const x = W / 2 + (i - 2) * 220 * s, y = H * 0.66;
    ctx.globalAlpha = a; ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(x, y + 26 * s); ctx.lineTo(x - 16 * s, y); ctx.arc(x, y - 5 * s, 16 * s, Math.PI * 0.85, Math.PI * 0.15); ctx.closePath(); ctx.fill(); ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(x, y - 5 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
    pixelText(ctx, String(i + 1), x, y + 36 * s, Math.max(1, Math.round(3 * s)), WHITE, { align: "center" });
    const fs = Math.round(14 * s), names = wrapLines(ctx, b.name, fs, 200 * s, { weight: 700 }), extra = (names.length - 1) * 17 * s;
    names.forEach((l, j) => text(ctx, l, x, y + 82 * s + j * 17 * s, fitSize(ctx, l, fs, 205 * s, { weight: 700 }), LB, { align: "center", weight: 700 }));
    const sub = b.type.charAt(0) + b.type.slice(1).toLowerCase() + "  \u2022  " + game.cfg.stages[i].name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    text(ctx, sub, x, y + 102 * s + extra, fitSize(ctx, sub, Math.round(13 * s), 205 * s, { weight: 500 }), NEON, { align: "center", weight: 500 });
    ctx.globalAlpha = 1;
  });
  if (t > 1 && Math.floor(t * 2) % 2 === 0) pixelText(ctx, INPUT.pad.connected ? "PRESS A" : game.mobile ? "TAP TO GO" : "PRESS ENTER", W / 2, H - 40 * s, Math.max(1, Math.round(3 * s)), NEON, { align: "center" });
}

// ---------------------------------------------------------------- restoration (arrival placeholder)
export const RESTORE_DUR = 8.5;
export function drawRestoration(ctx, game, W, H, t) {
  const s = Math.min(W / 1280, H / 720), idx = game.stageCfg.business, biz = game.cfg.businesses[idx];
  const p = game.restoreP[idx] || 0;
  // letterbox for the cinematic camera
  const bar = H * 0.07; ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0, 0, W, bar * Math.min(1, t * 3)); ctx.fillRect(0, H - bar * Math.min(1, t * 3), W, bar * Math.min(1, t * 3));
  // contribution card
  const cin = easeOutBack(stage(t, 1.0, 1.5)), cout = smooth(6.2, 6.6, t);
  if (cin > 0 && cout < 1) {
    const foot = "Illustrating an SBA " + (biz.loan || "disaster loan").toLowerCase() + "  •  " + game.cfg.labels.hypothetical, ffs = Math.round(13 * s);
    const cw = 640 * s, feet = fitSize(ctx, foot, ffs, cw - 48 * s, { italic: true, weight: 400 }) < ffs ? foot.split("  •  ") : [foot];
    const chh = (200 + (feet.length - 1) * 17) * s, cx = W / 2 - cw / 2, cy = H * 0.09 - (1 - cin) * 60 * s;
    ctx.save(); ctx.globalAlpha = cin * (1 - cout);
    plate(ctx, cx, cy, cw, chh, 12 * s, "rgba(7,26,63,0.94)", GOLD, 3);
    neonText(ctx, "RECOVERY FUNDS DELIVERED", W / 2, cy + 18 * s, Math.round(3 * s), GOLD, { align: "center" });
    const who = biz.name + "  •  " + biz.town;
    text(ctx, who, W / 2, cy + 68 * s, fitSize(ctx, who, Math.round(22 * s), cw - 48 * s, { weight: 700 }), WHITE, { align: "center", weight: 700 });
    const k = easeInOut(stage(t, 1.4, 2.8));
    neonText(ctx, fmtMoney(biz.amount * k), W / 2, cy + 84 * s, Math.round(7 * s), WHITE, { align: "center", glow: GOLD });
    ctx.fillStyle = "rgba(255,255,255,0.12)"; rrect(ctx, cx + 30 * s, cy + 150 * s, cw - 60 * s, 14 * s, 5 * s); ctx.fill();
    ctx.fillStyle = GOLD; if (k > 0) { rrect(ctx, cx + 30 * s, cy + 150 * s, Math.max(10 * s, (cw - 60 * s) * k), 14 * s, 5 * s); ctx.fill(); }
    feet.forEach((l, j) => text(ctx, l, W / 2, cy + chh - 12 * s - (feet.length - 1 - j) * 17 * s, fitSize(ctx, l, ffs, cw - 48 * s, { italic: true, weight: 400 }), "rgba(222,234,242,0.85)", { align: "center", italic: true, weight: 400 }));
    ctx.restore();
  }
  if (p > 0 && p < 1) neonText(ctx, "RESTORING " + Math.round(p * 100) + "%", W / 2, H - H * 0.07 - 34 * s, Math.round(3 * s), GOLD, { align: "center" });
  // completion stamp
  if (t > 6.4) {
    const k = easeOutBack(stage(t, 6.4, 6.9));
    ctx.save(); ctx.translate(W / 2, H * 0.24); ctx.scale(k, k); ctx.rotate(-0.05);
    plate(ctx, -300 * s, -55 * s, 600 * s, 110 * s, 12 * s, "rgba(60,124,84,0.95)", WHITE, 3);
    neonText(ctx, biz.restoredTitle || "RESTORED", 0, -32 * s, Math.round(5 * s), WHITE, { align: "center", glow: GREEN });
    pixelText(ctx, biz.name, 0, 18 * s, fitPx(biz.name, Math.max(1, Math.round(2.5 * s)), 560 * s), "#DFF5E3", { align: "center" });
    ctx.restore();
  }
  if (t > 1.2) pixelText(ctx, INPUT.pad.connected ? "A TO SKIP" : game.mobile ? "TAP TO SKIP" : "ENTER TO SKIP", W - 20 * s, H - H * 0.035 - 8 * s, Math.max(1, Math.round(2 * s)), "rgba(222,234,242,0.6)", { align: "right" });
}

// ---------------------------------------------------------------- stage results
export function drawResults(ctx, game, W, H, t) {
  const s = Math.min(W / 1280, H / 720), r = game.lastResult, biz = game.cfg.businesses[game.stageCfg.business];
  ctx.fillStyle = "rgba(4,12,36,0.78)"; ctx.fillRect(0, 0, W, H);
  const cw = 700 * s, ch = 430 * s, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2, k = easeOutBack(stage(t, 0, 0.4));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  plate(ctx, cx, cy, cw, ch, 14 * s, "rgba(7,26,63,0.96)", GOLD, 3);
  neonText(ctx, `STAGE ${game.stageIndex + 1} CLEAR`, W / 2, cy + 26 * s, Math.round(6 * s), GOLD, { align: "center" });
  const line = biz.restoredLine || biz.name;
  text(ctx, line, W / 2, cy + 104 * s, fitSize(ctx, line, Math.round(22 * s), cw - 60 * s, { weight: 700 }), WHITE, { align: "center", weight: 700 });
  const rows = [["FUNDS DELIVERED", fmtMoney(biz.amount) + "*"], ["TIME LEFT", r.timeLeft.toFixed(1) + " S"], ["STOP ACCURACY", r.overshot ? "OVERSHOT" : Math.round(r.precision * 100) + "%"], ["CRASHES", String(r.crashes)]];
  rows.forEach(([a, b], i) => { const y = cy + 140 * s + i * 40 * s; pixelText(ctx, a, cx + 60 * s, y, Math.max(1, Math.round(3 * s)), LB); pixelText(ctx, b, cx + cw - 60 * s, y, Math.max(1, Math.round(3 * s)), i === 0 ? GOLD : WHITE, { align: "right" }); });
  for (let i = 0; i < 3; i++) { const on = i < r.stars, sx = W / 2 + (i - 1) * 70 * s, sy = cy + 330 * s, sk = easeOutBack(stage(t, 0.5 + i * 0.2, 0.8 + i * 0.2)); if (sk <= 0) continue; star(ctx, sx, sy, 26 * s * sk, on ? GOLD : "rgba(222,234,242,0.2)"); }
  text(ctx, "* " + game.cfg.labels.hypothetical, W / 2, cy + ch - 18 * s, Math.round(13 * s), "rgba(222,234,242,0.7)", { align: "center", italic: true, weight: 400 });
  ctx.restore();
  if (t > 1 && Math.floor(t * 2) % 2 === 0) neonText(ctx, game.stageIndex < 4 ? (game.mobile ? "TAP FOR NEXT STAGE" : "ENTER FOR NEXT STAGE") : (game.mobile ? "TAP TO FINISH" : "ENTER TO FINISH"), W / 2, cy + ch + 30 * s, Math.round(3 * s), NEON, { align: "center" });
  drawFact(ctx, game.resultFact, W, 24 * s, s, Math.min(W * 0.8, 900 * s), clamp((t - 0.6) / 0.4, 0, 1));
}
// "DID YOU KNOW?" with an SBA fact, wrapped to two lines, centred at y.
export function drawFact(ctx, fact, W, y, s, maxW = W * 0.8, alpha = 1) {
  if (!fact) return;
  const fs = Math.round(19 * s), ls = wrapLines(ctx, fact.text, fs, maxW, { weight: 600 }).slice(0, 2);
  ctx.save(); ctx.globalAlpha = alpha;
  pixelText(ctx, "DID YOU KNOW?", W / 2, y, Math.max(1, Math.round(2 * s)), "#ECC444", { align: "center", shadow: "rgba(0,0,0,0.6)" });
  ls.forEach((l, i) => text(ctx, l, W / 2, y + 36 * s + i * fs * 1.25, fs, "#FEFEFE", { align: "center", weight: 600, shadow: "rgba(0,0,0,0.6)" }));
  text(ctx, "Source: " + fact.source, W / 2, y + 36 * s + ls.length * fs * 1.25 + 2 * s, Math.round(13 * s), "rgba(222,234,242,0.75)", { align: "center", italic: true, weight: 400 });
  ctx.restore();
}
// Largest whole pixel size <= px at which pixel text fits in maxW.
function fitPx(str, px, maxW) { while (px > 1 && pixelWidth(str, px) > maxW) px--; return px; }
function star(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

export function drawGameOver(ctx, game, W, H, t) {
  const s = Math.min(W / 1280, H / 720); ctx.fillStyle = "rgba(4,12,36,0.7)"; ctx.fillRect(0, 0, W, H);
  neonText(ctx, "TIME UP", W / 2, H * 0.28, Math.round(12 * s), RED, { align: "center", glow: RED });
  const left = Math.max(0, Math.ceil(9 - t));
  neonText(ctx, "CONTINUE?  " + left, W / 2, H * 0.5, Math.round(6 * s), GOLD, { align: "center" });
  pixelText(ctx, game.mobile ? "TAP TO RETRY THIS STAGE" : "PRESS ENTER TO RETRY THIS STAGE", W / 2, H * 0.62, Math.max(1, Math.round(3 * s)), WHITE, { align: "center" });
  drawFact(ctx, game.overFact, W, H * 0.79, s, Math.min(W * 0.8, 900 * s), clamp((t - 0.8) / 0.4, 0, 1));
  // the hidden bonus reveals itself only here
  if (t > 0.6 && Math.floor(t * 2) % 3 !== 0) pixelText(ctx, "AN SBA HELICOPTER ESCORT IS STANDING BY FOR YOUR RETRY", W / 2, H * 0.72, fitPx("AN SBA HELICOPTER ESCORT IS STANDING BY FOR YOUR RETRY", Math.max(1, Math.round(2.4 * s)), W - 40 * s), "#ECC444", { align: "center" });
}
export function drawPause(ctx, game, W, H) {
  const s = Math.min(W / 1280, H / 720); ctx.fillStyle = "rgba(4,12,36,0.7)"; ctx.fillRect(0, 0, W, H);
  neonText(ctx, "PAUSED", W / 2, H * 0.3, Math.round(10 * s), GOLD, { align: "center" });
  pixelText(ctx, INPUT.pad.connected ? "MENU BUTTON TO RESUME   VIEW MUSIC " + (game.audio.muted ? "OFF" : "ON") : game.mobile ? "TAP TO RESUME" : "P TO RESUME   M MUSIC " + (game.audio.muted ? "OFF" : "ON") + "   4 / 5 RADIO", W / 2, H * 0.52, Math.max(1, Math.round(3 * s)), WHITE, { align: "center" });
  if (game.mobile) {
    const msg = INPUT.steerMode === "tilt"
      ? (INPUT.gyro.active ? "Hold the phone the way you like to drive, then tap ◎ at the top to re-center steering." : (game.gyroNote || "Tap the screen once to turn on tilt steering."))
      : "Drag left and right anywhere on the screen to steer.";
    const fs = Math.round(18 * s), ls = wrapLines(ctx, msg, fs, W * 0.8);
    ls.forEach((l, i) => text(ctx, l, W / 2, H * 0.62 + i * fs * 1.35, fs, LB, { align: "center", weight: 600 }));
  }
  drawFact(ctx, game.pauseFact, W, H * (game.mobile ? 0.855 : 0.68), s, Math.min(W * 0.75, 860 * s));   // phones: below the STEER button
  // controller check: what the game is reading from the pad right now
  if (INPUT.pad.connected) {
    const P = INPUT.pad, line = `CONTROLLER: STICK ${P.steer.toFixed(2)}   RT GAS ${(P.rt || 0).toFixed(2)}   LT BRAKE ${(P.lt || 0).toFixed(2)}   X/RB BOOST   B ESCORT   D-PAD RADIO`;
    pixelText(ctx, line, W / 2, H - 34 * s, fitPx(line, Math.max(1, Math.round(1.8 * s)), W - 40 * s), "rgba(222,234,242,0.8)", { align: "center" });
  }
}

// ---------------------------------------------------------------- ending
export function drawEnding(ctx, game, W, H, t) {
  const s = Math.min(W / 1280, H / 720), R = game.renderer, hy = H * 0.62, cfg = game.cfg;
  R.drawSky(ctx, WEATHER.clear, t, t * 6, hy, {}); R.drawMountains(ctx, WEATHER.clear, t, t * 10, hy, "town"); gridFloor(ctx, W, H, hy, t, 0.5);
  ctx.fillStyle = "rgba(4,12,36,0.45)"; ctx.fillRect(0, 0, W, H);
  neonText(ctx, "MISSION COMPLETE", W / 2, 24 * s, Math.round(3 * s), GOLD, { align: "center" });
  neonText(ctx, "FIVE STOPS. FIVE RECOVERIES.", W / 2, 56 * s, Math.round(6 * s), WHITE, { align: "center", glow: NEON });
  const n = cfg.businesses.length, cw = 226 * s, gap = 14 * s, x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, cy = 130 * s;
  let total = 0, stars = 0;
  cfg.businesses.forEach((biz, i) => {
    const k = easeOutBack(stage(t, 0.4 + i * 0.3, 0.9 + i * 0.3)); total += biz.amount; stars += (game.results[i] || { stars: 0 }).stars;
    if (k <= 0) return;
    const x = x0 + i * (cw + gap), y = cy + (1 - k) * 50 * s;
    ctx.save(); ctx.globalAlpha = clamp(k, 0, 1);
    plate(ctx, x, y, cw, 290 * s, 8 * s, "rgba(7,26,63,0.92)", GOLD, 2);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 6 * s, y + 6 * s, cw - 12 * s, 168 * s); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + 170 * s); g.addColorStop(0, "#0E2E6A"); g.addColorStop(1, "#6E3A5E"); ctx.fillStyle = g; ctx.fillRect(x, y, cw, 175 * s);
    ctx.fillStyle = "#050E2A"; ctx.fillRect(x, y + 146 * s, cw, 30 * s);
    drawStorefront(ctx, biz, i, x + cw / 2, y + 150 * s, 0.18 * s, 1, t, {});
    ctx.restore();
    // stacked from measured heights so nothing overlaps at any screen size
    const ns = Math.round(14 * s), names = fitSize(ctx, biz.name, ns, cw - 16 * s, { weight: 800 }) < ns ? wrapLines(ctx, biz.name, ns, cw - 16 * s, { weight: 800 }) : [biz.name];
    names.forEach((l, j) => text(ctx, l, x + cw / 2, y + 192 * s + j * 16 * s, fitSize(ctx, l, ns, cw - 16 * s, { weight: 800 }), WHITE, { align: "center", weight: 800 }));
    const mpx = Math.max(1, Math.round(3 * s)), tpx = Math.max(1, Math.round(2 * s)), my = y + 200 * s + (names.length - 1) * 16 * s, ty = my + 7 * mpx + 7 * s;
    pixelText(ctx, fmtMoney(biz.amount), x + cw / 2, my, mpx, GOLD, { align: "center" });
    pixelText(ctx, biz.type, x + cw / 2, ty, tpx, NEON, { align: "center" });
    const st = (game.results[i] || { stars: 0 }).stars, sy = Math.min(Math.max(ty + 7 * tpx + 15 * s, y + 262 * s), y + 276 * s);
    for (let j = 0; j < 3; j++) star(ctx, x + cw / 2 + (j - 1) * 30 * s, sy, 11 * s, j < st ? GOLD : "rgba(222,234,242,0.2)");
    ctx.restore();
  });
  const tk = smooth(2.2, 2.6, t);
  if (tk > 0) {
    ctx.save(); ctx.globalAlpha = tk;
    pixelText(ctx, "TOTAL RECOVERY FUNDS DELIVERED", W / 2, 440 * s, Math.max(1, Math.round(3 * s)), WHITE, { align: "center" });
    neonText(ctx, fmtMoney(total * easeOut(stage(t, 2.2, 3.4))), W / 2, 468 * s, Math.round(8 * s), GOLD, { align: "center", glow: RED });
    pixelText(ctx, "RATING " + stars + " / 15 ★", W / 2, 540 * s, Math.max(1, Math.round(3 * s)), NEON, { align: "center" });
    text(ctx, cfg.labels.fictional, W / 2, 580 * s, fitSize(ctx, cfg.labels.fictional, Math.round(14 * s), W - 40 * s, { italic: true, weight: 400 }), "rgba(222,234,242,0.8)", { align: "center", italic: true, weight: 400 });
    ctx.restore();
  }
  const ck = smooth(3.4, 4.0, t);
  if (ck > 0) {
    ctx.save(); ctx.globalAlpha = ck;
    text(ctx, cfg.labels.closing, W / 2, 630 * s, Math.round(32 * s), WHITE, { align: "center", italic: true, weight: 300 });
    const tag = "SBA Disaster Recovery  •  " + cfg.labels.audiences + "  •  " + cfg.labels.learnMore;
    text(ctx, tag, W / 2, 664 * s, fitSize(ctx, tag, Math.round(15 * s), W - 40 * s, { weight: 500 }), LB, { align: "center", weight: 500 });
    ctx.restore();
  }
  if (t > 4.5 && Math.floor(t * 2) % 2 === 0) pixelText(ctx, game.mobile ? "TAP TO PLAY AGAIN" : "PRESS ENTER TO PLAY AGAIN", W / 2, H - 26 * s, Math.max(1, Math.round(2.5 * s)), NEON, { align: "center" });
}
