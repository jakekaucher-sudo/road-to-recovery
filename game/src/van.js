// The player's van, drawn from the real artwork. The rear view is the main
// sprite; when the van turns, a perspective-correct strip of the real side
// view (driver or passenger) is drawn beside it so the van reads as a solid
// 3D vehicle. Lights, reflections, boost glow and shadows are layered on top.
import { clamp, lerp, hash2 } from "./util.js";

function glowAt(ctx, x, y, r, rgb, a) {
  if (a <= 0.01 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// Draw `img` onto the van's side plane, receding from the rear-face edge
// (xNear, top yNT, bottom yNB) toward a vanishing point (vpX, vpY), covering
// fraction k of the way there. Slices are perspective-correct.
function panel(ctx, img, sw, sh, xNear, yNT, yNB, vpX, vpY, k, srcNearRight) {
  const span = Math.abs(vpX - xNear) * k; if (span < 1) return;
  const a = k / (1 - k), n = Math.min(56, Math.max(3, Math.ceil(span / 3)));
  for (let i = 0; i < n; i++) {
    const s0 = i / n, s1 = (i + 1) / n;
    const u0 = s0 / (1 + a - a * s0), u1 = s1 / (1 + a - a * s1);   // screen -> texture (perspective)
    const f0 = s0 * k, f1 = s1 * k, fm = (f0 + f1) / 2;
    const xa = lerp(xNear, vpX, f0), xb = lerp(xNear, vpX, f1);
    const top = lerp(yNT, vpY, fm), bot = lerp(yNB, vpY, fm);
    const sx = srcNearRight ? sw * (1 - u1) : sw * u0, sW = Math.max(1, sw * (u1 - u0));
    ctx.drawImage(img, sx, 0, sW, sh, Math.min(xa, xb) - 0.6, top, Math.abs(xb - xa) + 1.2, bot - top);
  }
}

export function drawVan(ctx, art, x, y, wPx, o) {
  const rear = art.rear; if (!rear) return;
  const hPx = wPx * rear.h / rear.w;
  const yaw = clamp(o.yaw || 0, -1, 1), ay = Math.abs(yaw);
  const faceW = wPx * (1 - ay * 0.08);
  const bx = x - yaw * wPx * 0.12, by = y + (o.bounce || 0);
  const horizon = o.horizonY ?? (y - hPx * 1.1);
  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath(); ctx.ellipse(x, y + 2, wPx * 0.62, wPx * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  // headlight spill on the road ahead, visible either side of the van
  if (o.headlights > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const gy = by - hPx * 0.42, g = ctx.createRadialGradient(bx + yaw * wPx * 0.3, gy, 0, bx + yaw * wPx * 0.3, gy, wPx * 1.15);
    g.addColorStop(0, `rgba(255,232,180,${0.2 * o.headlights})`); g.addColorStop(1, "rgba(255,232,180,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(bx + yaw * wPx * 0.3, gy, wPx * 1.15, hPx * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // wet-road reflection
  if (o.wet > 0.2) {
    ctx.save(); ctx.globalAlpha = 0.16 * Math.min(1, o.wet); ctx.translate(bx, y); ctx.scale(1, -0.35);
    ctx.drawImage(rear.canvas, -faceW / 2, 0, faceW, hPx); ctx.restore();
  }
  ctx.save();
  ctx.translate(bx, by); ctx.rotate(o.roll || 0); ctx.translate(-bx, -by);
  // side panel: the real side view receding toward a vanishing point on the horizon
  if (ay > 0.03) {
    const side = yaw < 0 ? art.driver : art.passenger;
    if (side) {
      const img = side.shaded || side.canvas, dir = Math.sign(yaw);
      // anchor at the body edge (the rear art's mirrors stick out ~8% each side)
      const nearX = bx + dir * faceW * 0.41, vpX = nearX + dir * wPx * (0.1 + 0.6 * ay), k = 0.4;
      panel(ctx, img, side.w, side.h, nearX, by - hPx * 0.97, by - hPx * 0.02, vpX, horizon, k, dir < 0);
    }
  }
  ctx.drawImage(rear.canvas, bx - faceW / 2, by - hPx, faceW, hPx);
  // lights: taillights always on at night, brighter when braking; brake light up top
  const L = rear.lights, brake = clamp(o.brake || 0, 0, 1), base = o.night ? 0.35 : 0.1;
  ctx.globalCompositeOperation = "lighter";
  for (const p of [L.left, L.right]) {
    const lx = bx - faceW / 2 + p[0] * faceW, ly = by - hPx + p[1] * hPx;
    glowAt(ctx, lx, ly, wPx * (0.08 + 0.1 * brake), "255,40,40", base + 0.6 * brake);
    glowAt(ctx, lx, ly, wPx * 0.025, "255,190,180", 0.3 + 0.6 * brake);
  }
  if (brake > 0.05) glowAt(ctx, bx - faceW / 2 + L.top[0] * faceW, by - hPx + L.top[1] * hPx, wPx * 0.12, "255,40,40", 0.6 * brake);
  // boost: neon blue exhaust glow and streaks
  if (o.boost > 0) {
    const ex = bx, ey = by - hPx * 0.05;
    glowAt(ctx, ex, ey, wPx * 0.45, "92,200,255", 0.45 * o.boost);
    ctx.strokeStyle = `rgba(92,200,255,${0.6 * o.boost})`; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const sx = ex + (hash2(i, 3) - 0.5) * wPx * 0.8, ph = ((o.t || 0) * 4 + hash2(i, 4)) % 1; ctx.moveTo(sx, ey + ph * 40); ctx.lineTo(sx, ey + ph * 40 + 30 + 40 * hash2(i, 5)); }
    ctx.stroke();
  }
  if (o.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * o.hit})`; ctx.fillRect(bx - faceW / 2, by - hPx, faceW, hPx); }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// Side view used in the restoration scene and menus (faces left, wheels static).
export function drawVanSide(ctx, art, which, x, y, wPx, o = {}) {
  const sp = art[which] || art.driver; if (!sp) return null;
  const h = wPx * sp.h / sp.w, x0 = x - wPx / 2, y0 = y - h + (o.bounce || 0);
  ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.beginPath(); ctx.ellipse(x, y + 2, wPx * 0.5, wPx * 0.025, 0, 0, Math.PI * 2); ctx.fill();
  if (o.reflect) { ctx.save(); ctx.globalAlpha = 0.18; ctx.translate(x0, y); ctx.scale(1, -0.35); ctx.drawImage(sp.canvas, 0, 0, wPx, h); ctx.restore(); }
  ctx.drawImage(sp.canvas, x0, y0, wPx, h);
  return { x0, y0, w: wPx, h, logoX: x0 + wPx * 0.44, logoY: y0 + h * 0.38 };
}
