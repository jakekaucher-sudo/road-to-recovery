// World renderer: synthwave sky, parallax layers, projected road with neon
// grid, water and delivery zone, then sprites, hazards, pickups and traffic
// drawn far to near with hill clipping.
import { clamp, lerp, hash2, noise1, fbm1, rgbStr, mixRgb } from "./util.js";
import { SEG, ROAD_W } from "./track.js";
import { drawSprite, drawHazard, drawPickup, drawCar, DEFS, HAZ } from "./sprites.js";
import { drawStorefront } from "./buildings.js";

export const CAM = { height: 1000, fov: 100, drawDist: 220 };
CAM.depth = 1 / Math.tan((CAM.fov / 2) * Math.PI / 180);
CAM.playerZ = CAM.height * CAM.depth;

const c = (col, a = 1) => rgbStr(col, a);

export class WorldRenderer {
  constructor(W, H, cfg) {
    this.W = W; this.H = H; this.cfg = cfg; this.horizonFrac = 0.42;
    this.stars = Array.from({ length: 140 }, (_, i) => [hash2(i, 1), hash2(i, 2) * 0.85, 0.5 + hash2(i, 3) * 1.6, hash2(i, 4)]);
    this.scan = this.makeScanlines(); this.vig = this.makeVignette();
  }
  makeScanlines() {
    const cv = document.createElement("canvas"); cv.width = 4; cv.height = 4; const g = cv.getContext("2d");
    g.fillStyle = "rgba(0,0,0,0.16)"; g.fillRect(0, 0, 4, 1);
    return cv;
  }
  makeVignette() {
    const cv = document.createElement("canvas"); cv.width = this.W; cv.height = this.H; const g = cv.getContext("2d");
    const gr = g.createRadialGradient(this.W / 2, this.H * 0.55, this.H * 0.35, this.W / 2, this.H * 0.55, this.H * 0.95);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,4,16,0.55)");
    g.fillStyle = gr; g.fillRect(0, 0, this.W, this.H);
    return cv;
  }

  // ---------------------------------------------------------------- sky
  drawSky(ctx, env, t, par, horizonY, extra = {}) {
    const W = this.W, H = this.H;
    const g = ctx.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, c(env.skyTop)); g.addColorStop(0.55, c(env.skyMid)); g.addColorStop(1, c(env.skyHor));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, horizonY + 2);
    // stars
    if (env.stars > 0.02) {
      ctx.fillStyle = "#fff";
      for (const [sx, sy, sz, ph] of this.stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * (1 + ph * 3) + ph * 20);
        ctx.globalAlpha = env.stars * (0.3 + 0.7 * tw) * (1 - sy * 0.6);
        const x = ((sx * W * 1.3 - par * 0.02) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15;
        ctx.fillRect(x, sy * horizonY, sz, sz);
      }
      ctx.globalAlpha = 1;
    }
    // horizon glow
    const hg = ctx.createLinearGradient(0, horizonY - H * 0.22, 0, horizonY);
    hg.addColorStop(0, c(env.horizonGlow, 0)); hg.addColorStop(1, c(env.horizonGlow, 0.35));
    ctx.fillStyle = hg; ctx.fillRect(0, horizonY - H * 0.22, W, H * 0.22 + 2);
    // striped synthwave sun
    if (env.sun > 0.02) {
      const r = H * 0.21, sx = W * 0.5 - (extra.view || 0) * 0.4, sy = horizonY - r * 0.42;
      ctx.save();
      ctx.globalAlpha = env.sun;
      const glow = ctx.createRadialGradient(sx, sy, r * 0.8, sx, sy, r * 1.9);
      glow.addColorStop(0, c(env.sunTop, 0.35)); glow.addColorStop(1, c(env.sunTop, 0));
      ctx.fillStyle = glow; ctx.fillRect(sx - r * 2, sy - r * 2, r * 4, r * 4);
      ctx.beginPath();
      // stripes cut into the lower half, getting thicker toward the horizon
      ctx.rect(sx - r, sy - r, r * 2, r * 1.05);
      for (let k = 0; k < 7; k++) { const y0 = sy + r * (0.05 + k * 0.14), th = r * (0.025 + k * 0.012); ctx.rect(sx - r, y0 + th, r * 2, r * 0.14 - th); }
      ctx.clip();
      const sg = ctx.createLinearGradient(0, sy - r, 0, sy + r);
      sg.addColorStop(0, c(env.sunTop)); sg.addColorStop(1, c(env.sunBot));
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // clouds: long dark bands with neon-lit undersides
    if (env.clouds > 0.02) {
      const n = Math.round(4 + 10 * env.clouds);
      for (let i = 0; i < n; i++) {
        const y = horizonY * (0.08 + 0.75 * hash2(i, 31)), len = W * (0.35 + 0.5 * hash2(i, 32)), th = 18 + 40 * hash2(i, 33) * env.clouds;
        const sp = 8 + 30 * hash2(i, 34) + env.wind * 160;
        const x = ((hash2(i, 35) * W * 2 - t * sp - par * 0.08) % (W * 2) + W * 2) % (W * 2) - W * 0.5;
        ctx.fillStyle = c(env.cloudColor, 0.85 * env.clouds);
        ctx.beginPath(); ctx.ellipse(x, y, len / 2, th, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c(mixRgb(env.cloudColor, [92, 200, 255], 0.35 + 0.65 * (extra.flash || 0)), 0.35 * env.clouds);
        ctx.beginPath(); ctx.ellipse(x, y + th * 0.6, len * 0.42, th * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (extra.flash > 0) { ctx.fillStyle = `rgba(200,225,255,${extra.flash * 0.45})`; ctx.fillRect(0, 0, W, horizonY); }
  }

  drawMountains(ctx, env, t, par, horizonY, far) {
    const W = this.W;
    const layer = (amp, freq, seed, p, fill, edge, a) => {
      ctx.beginPath(); ctx.moveTo(-10, horizonY + 2);
      const pts = [];
      for (let x = -10; x <= W + 10; x += 24) { const v = fbm1((x + p) * freq, seed, 3); const y = horizonY - Math.max(0, v * 0.5 + 0.45) * amp; pts.push(x, y); ctx.lineTo(x, y); }
      ctx.lineTo(W + 10, horizonY + 2); ctx.closePath(); ctx.fillStyle = c(fill); ctx.fill();
      ctx.beginPath(); for (let i = 0; i < pts.length; i += 2) i ? ctx.lineTo(pts[i], pts[i + 1]) : ctx.moveTo(pts[i], pts[i + 1]);
      ctx.strokeStyle = c(edge, 0.25 * a); ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = c(edge, 0.9 * a); ctx.lineWidth = 2; ctx.stroke();
      // wireframe verticals
      ctx.beginPath(); for (let i = 0; i < pts.length; i += 4) { ctx.moveTo(pts[i], pts[i + 1]); ctx.lineTo(pts[i] + (pts[i] - W / 2) * 0.05, horizonY); }
      ctx.strokeStyle = c(edge, 0.18 * a); ctx.lineWidth = 1; ctx.stroke();
    };
    if (far === "coast") {
      // ocean to the right of the road, beach and palms to the left
      const seaG = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 4);
      seaG.addColorStop(0, c([12, 34, 70])); seaG.addColorStop(1, c([6, 18, 44]));
      ctx.fillStyle = seaG; ctx.fillRect(W * 0.35, horizonY - 30, W * 0.65 + 10, 34);
      ctx.strokeStyle = c([92, 200, 255], 0.5); ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i < 14; i++) { const ph = (t * 0.3 + hash2(i, 61)) % 1, y = horizonY - 28 + ph * 30, x = W * 0.4 + hash2(i, 62) * W * 0.6; ctx.moveTo(x, y); ctx.lineTo(x + 30 + 120 * ph, y); }
      ctx.stroke();
      layer(50, 0.004, 21, par * 0.1, env.mountains, env.mountainEdge, 0.6);
      return;
    }
    const amp = far === "plains" ? 40 : far === "valley" ? 90 : far === "hills" ? 120 : 150;
    layer(amp * 1.25, 0.0022, 3, par * 0.05, mixRgb(env.mountains, env.skyHor, 0.25), env.mountainEdge, 0.55);
    layer(amp * 0.7, 0.0042, 9, par * 0.11, env.mountains, env.mountainEdge, 0.9);
    if (far === "town" || far === "hills") { // distant skyline with lit windows
      ctx.fillStyle = c(env.mountains);
      for (let i = 0; i < 16; i++) { const bw = 26 + 30 * hash2(i, 71), bh = 20 + 70 * hash2(i, 72); const x = ((W * 0.15 + i * 44 - par * 0.16) % (W + 400) + W + 400) % (W + 400) - 200; ctx.fillRect(x, horizonY - bh, bw, bh); ctx.fillStyle = c([236, 196, 68], 0.6); for (let k = 0; k < 4; k++) if (hash2(i, 80 + k) > 0.5) ctx.fillRect(x + 4 + k * 5, horizonY - bh + 6 + (k % 2) * 12, 2, 3); ctx.fillStyle = c(env.mountains); }
    }
  }

  drawTornado(ctx, env, t, x, top, ground, k, s) {
    if (k < 0.02) return;
    const bands = 24, hgt = ground - top;
    ctx.save(); ctx.globalAlpha = k;
    for (let r = 0; r < 3; r++) { ctx.fillStyle = c([16, 18, 22], 0.6 - r * 0.15); ctx.beginPath(); ctx.ellipse(x + Math.cos(t * 0.7 + r) * 10 * s, top - r * 6, (420 - r * 90) * s, (40 + r * 6) * s, 0, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1), y = top + f * hgt;
      const wob = Math.sin(t * 1.5 - f * 5) * 34 * s * f + noise1(t * 0.8 + f * 3, 9) * 18 * s;
      const half = s * (140 * Math.pow(1 - f, 1.35) + 16) * (0.92 + 0.08 * Math.sin(t * 9 + i));
      const lit = 0.5 + 0.5 * Math.sin(t * 6 - i * 0.8);
      ctx.fillStyle = c(mixRgb([30, 32, 34], [70, 66, 56], lit), 0.95);
      ctx.beginPath(); ctx.ellipse(x + wob, y, half, hgt / bands * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c([236, 196, 68], 0.12 + 0.2 * lit); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x + wob, y, half, hgt / bands * 0.8, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    }
    const gx = x + Math.sin(t * 1.5 - 5) * 34 * s;
    for (let i = 0; i < 4; i++) { ctx.fillStyle = c([90, 80, 60], 0.3 - i * 0.06); ctx.beginPath(); ctx.ellipse(gx + Math.sin(t * 2 + i) * 12 * s, ground - 6, (80 + i * 40) * s, (24 + i * 12) * s, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "rgba(20,18,16,0.9)";
    for (let i = 0; i < 26; i++) { const f = hash2(i, 91), an = t * (4 + 3 * hash2(i, 92)) + i, rad = s * (140 * Math.pow(1 - f, 1.35) + 30) * 1.3; if (Math.sin(an) > -0.2) ctx.fillRect(x + (gx - x) * f + Math.cos(an) * rad, top + f * hgt, 3 + 3 * hash2(i, 93), 2 + 2 * hash2(i, 94)); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- road
  project(p, camX, camY, camZ, horizonY) {
    const W = this.W, H = this.H;
    p.camera.x = p.world.x - camX; p.camera.y = p.world.y - camY; p.camera.z = p.world.z - camZ;
    p.screen.scale = CAM.depth / p.camera.z;
    p.screen.x = Math.round(W / 2 + p.screen.scale * p.camera.x * W / 2);
    p.screen.y = Math.round(horizonY - p.screen.scale * p.camera.y * H / 2);
    p.screen.w = Math.round(p.screen.scale * ROAD_W * W / 2);
  }

  drawWorld(ctx, game, t) {
    const W = this.W, H = this.H, env = game.env, track = game.track, P = game.player;
    const horizonY = Math.round(H * this.horizonFrac + game.camShakeY);
    const base = Math.floor(P.z / SEG), basePct = (P.z % SEG) / SEG;
    const baseSeg = track.segs[clamp(base, 0, track.N - 1)];
    const camX = game.camX * ROAD_W, camY = P.y + CAM.height, camZ = P.z;
    // sky and far layers (parallax from accumulated curvature)
    const par = game.parallax;
    this.drawSky(ctx, env, t, par, horizonY, { flash: game.flash, view: game.view });
    if (game.tornado) { const tn = game.tornado; this.drawTornado(ctx, env, t, W / 2 + tn.x * W * 0.5 - (game.view || 0) * 0.5, horizonY - 230 * tn.s, horizonY + 4, tn.k, tn.s); }
    this.drawMountains(ctx, env, t, par, horizonY, track.theme.far);
    // ground plane base
    ctx.fillStyle = c(env.ground); ctx.fillRect(0, horizonY, W, H - horizonY);

    let x = 0, dx = -(baseSeg.curve * basePct), maxy = H;
    const vis = [];
    const fogDen = env.fogDensity;
    for (let n = 0; n < CAM.drawDist; n++) {
      const seg = track.segs[base + n]; if (!seg) break;
      seg.looped = false;
      seg.p1.world.x = x; seg.p2.world.x = x + dx; seg.p1.world.y = seg.y; seg.p2.world.y = (track.segs[base + n + 1] || seg).y;
      this.project(seg.p1, camX, camY, camZ, horizonY); this.project(seg.p2, camX, camY, camZ, horizonY);
      x += dx; dx += seg.curve;
      seg.fog = 1 - Math.exp(-Math.pow(n / CAM.drawDist, 2) * fogDen);
      seg.clip = maxy; seg.n = n;
      if (seg.p1.camera.z <= CAM.depth || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) { seg.visible = false; continue; }
      seg.visible = true;
      this.drawSegment(ctx, seg, env, t, track, game);
      maxy = seg.p1.screen.y; vis.push(seg);
    }
    // far-to-near objects
    for (let n = CAM.drawDist - 1; n > 0; n--) {
      const seg = track.segs[base + n]; if (!seg || !(seg.p1.screen.scale > 0)) continue;
      const sc = seg.p1.screen.scale, u = sc * ROAD_W * W / 2, fog = seg.fog;
      const hasAny = seg.sprites.length || seg.hazards.length || seg.pickups.length || seg.cars.length;
      if (!hasAny) continue;
      ctx.save();
      if (seg.clip < H) { ctx.beginPath(); ctx.rect(0, 0, W, seg.clip); ctx.clip(); }
      for (const sp of seg.sprites) {
        const sx = seg.p1.screen.x + u * sp.offset, sy = seg.p1.screen.y;
        if (sp.kind === "business") this.drawBusiness(ctx, game, sp.idx, sx, sy, u, fog, t);
        else drawSprite(ctx, sp, sx, sy, u, fog, env, t);
      }
      for (const hz of seg.hazards) drawHazard(ctx, hz, seg.p1.screen.x + u * hz.offset, seg.p1.screen.y, u, fog, env, t);
      for (const p of seg.pickups) if (!p.got) drawPickup(ctx, p, seg.p1.screen.x + u * p.offset, seg.p1.screen.y, u, fog, t);
      for (const car of seg.cars) {
        const pct = (car.z % SEG) / SEG; // interpolate within the segment
        const yy = lerp(seg.p1.screen.y, seg.p2.screen.y, pct);
        const xx = lerp(seg.p1.screen.x, seg.p2.screen.x, pct), uu = lerp(u, seg.p2.screen.scale * ROAD_W * W / 2, pct);
        drawCar(ctx, car, xx + uu * car.offset, yy, uu, fog, env, t, car.braking);
      }
      ctx.restore();
    }
    return { horizonY };
  }

  drawSegment(ctx, seg, env, t, track, game) {
    const W = this.W, p1 = seg.p1.screen, p2 = seg.p2.screen, y1 = p1.y, y2 = p2.y, h = y1 - y2;
    const fog = seg.fog, alt = Math.floor(seg.i / 3) % 2 === 0;
    const fg = (col) => c(mixRgb(col, env.fog, fog));
    // ground band
    ctx.fillStyle = fg(env.ground); ctx.fillRect(0, y2, W, h + 1);
    // sea on the right for coastal stages
    if (track.theme.far === "coast") {
      const shore1 = p1.x + p1.w * 1.9, shore2 = p2.x + p2.w * 1.9;
      ctx.fillStyle = fg([8, 26, 58]); ctx.beginPath(); ctx.moveTo(shore1, y1 + 1); ctx.lineTo(shore2, y2); ctx.lineTo(W, y2); ctx.lineTo(W, y1 + 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = fg([60, 54, 64]); ctx.beginPath(); ctx.moveTo(p1.x + p1.w * 1.15, y1 + 1); ctx.lineTo(p2.x + p2.w * 1.15, y2); ctx.lineTo(shore2, y2); ctx.lineTo(shore1, y1 + 1); ctx.closePath(); ctx.fill();
      if (seg.i % 3 === 0 && h > 0.8) { const ph = (t * 1.2 + seg.i * 0.27) % 1; ctx.strokeStyle = `rgba(92,200,255,${(1 - fog) * 0.6 * (1 - ph)})`; ctx.lineWidth = Math.max(1, h * 0.35); ctx.beginPath(); ctx.moveTo(shore1 + ph * p1.w * 1.5, y1); ctx.lineTo(shore1 + ph * p1.w * 1.5 + p1.w * 0.6, y1); ctx.stroke(); }
    }
    // neon grid: cross lines every 4 segments, long lines at fixed offsets
    const ga = env.gridA * (1 - fog);
    if (ga > 0.02) {
      ctx.strokeStyle = c(env.grid, ga); ctx.lineWidth = 1;
      ctx.beginPath();
      if (seg.i % 4 === 0) { ctx.moveTo(0, y1); ctx.lineTo(p1.x - p1.w * 1.2, y1); ctx.moveTo(p1.x + p1.w * 1.2, y1); ctx.lineTo(W, y1); }
      for (let k = 2; k <= 12; k++) { const o = k * 0.6 + 0.3; ctx.moveTo(p1.x - p1.w * o, y1); ctx.lineTo(p2.x - p2.w * o, y2); if (track.theme.far !== "coast" || o < 1.9) { ctx.moveTo(p1.x + p1.w * o, y1); ctx.lineTo(p2.x + p2.w * o, y2); } }
      ctx.stroke();
    }
    // flood water spreads over the fields too
    if (seg.water > 0 && env.water > 0.5) { ctx.fillStyle = `rgba(20,70,120,${0.5 * (1 - fog)})`; ctx.fillRect(0, y2, W, h + 1); }
    // rumble strips (red / white) with neon edge
    const r1 = p1.w / 7, r2 = p2.w / 7;
    ctx.fillStyle = fg(alt ? env.rumbleA : env.rumbleB);
    quad(ctx, p1.x - p1.w - r1, y1, p1.x - p1.w, p2.x - p2.w, y2, p2.x - p2.w - r2);
    quad(ctx, p1.x + p1.w, y1, p1.x + p1.w + r1, p2.x + p2.w + r2, y2, p2.x + p2.w);
    // asphalt
    ctx.fillStyle = fg(alt ? env.road : env.road2);
    quad(ctx, p1.x - p1.w, y1, p1.x + p1.w, p2.x + p2.w, y2, p2.x - p2.w);
    // water on the road: reflective blue with moving glints
    if (seg.water > 0) {
      ctx.fillStyle = `rgba(30,90,150,${0.55 * seg.water * (1 - fog * 0.7)})`;
      quad(ctx, p1.x - p1.w * 1.15, y1, p1.x + p1.w * 1.15, p2.x + p2.w * 1.15, y2, p2.x - p2.w * 1.15);
      if (h > 1 && seg.i % 2 === 0) { const ph = (t * 0.7 + seg.i * 0.17) % 1, gx = p1.x + (ph - 0.5) * p1.w * 2; ctx.fillStyle = `rgba(160,220,255,${0.35 * (1 - fog)})`; ctx.fillRect(gx - p1.w * 0.15, y1 - h * 0.6, p1.w * 0.3, Math.max(1, h * 0.3)); }
    }
    // delivery zone: pulsing gold chevrons in the right lane
    if (seg.zone) {
      const pulse = 0.55 + 0.45 * Math.sin(t * 6 - seg.i * 0.5);
      ctx.fillStyle = `rgba(236,196,68,${(0.18 + 0.25 * pulse) * (1 - fog)})`;
      quad(ctx, p1.x + p1.w * 0.05, y1, p1.x + p1.w * 0.95, p2.x + p2.w * 0.95, y2, p2.x + p2.w * 0.05);
      if (seg.i % 4 === 0) { ctx.strokeStyle = `rgba(255,230,140,${(1 - fog) * pulse})`; ctx.lineWidth = Math.max(1, h * 0.5); ctx.beginPath(); ctx.moveTo(p1.x + p1.w * 0.1, y1); ctx.lineTo(p1.x + p1.w * 0.5, y1 - h * 0.6); ctx.lineTo(p1.x + p1.w * 0.9, y1); ctx.stroke(); }
    }
    // neon edge lines and lane dashes
    if (h > 0.5) {
      const e1 = Math.max(1, p1.w / 60), e2 = Math.max(0.5, p2.w / 60), ea = 1 - fog * 0.8;
      ctx.fillStyle = c(env.edge, ea);
      quad(ctx, p1.x - p1.w - e1, y1, p1.x - p1.w + e1, p2.x - p2.w + e2, y2, p2.x - p2.w - e2);
      quad(ctx, p1.x + p1.w - e1, y1, p1.x + p1.w + e1, p2.x + p2.w + e2, y2, p2.x + p2.w - e2);
      if (alt) {
        ctx.fillStyle = c(env.lane, 0.8 * ea); const l1 = p1.w / 50, l2 = p2.w / 50;
        for (const f of [-1 / 3, 1 / 3]) { const a1 = p1.x + p1.w * f * 2, a2 = p2.x + p2.w * f * 2; quad(ctx, a1 - l1, y1, a1 + l1, a2 + l2, y2, a2 - l2); }
      }
    }
    if (fog > 0.01) { ctx.fillStyle = c(env.fog, fog * 0.85); ctx.fillRect(0, y2, W, h + 1); }
  }

  drawBusiness(ctx, game, idx, x, y, u, fog, t) {
    const biz = this.cfg.businesses[idx], w = DEFS.business.w * u;
    if (w < 4) return;
    drawStorefront(ctx, biz, idx, x, y, w / 760, game.restoreP[idx] || 0, t, { wind: game.env.wind });
    if (fog > 0.01) { ctx.fillStyle = c(game.env.fog, fog * 0.85); ctx.fillRect(x - w * 0.6, y - w * 0.85, w * 1.2, w * 0.86); }
    // destination beacon (roadmap pin motif)
    const py = y - w * 0.95 - Math.sin(t * 3) * w * 0.03, r = Math.max(6, w * 0.06);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(0, 0, 0, py); g.addColorStop(0, "rgba(236,196,68,0)"); g.addColorStop(1, "rgba(236,196,68,0.35)");
    ctx.fillStyle = g; ctx.fillRect(x - r * 0.4, 0, r * 0.8, py); ctx.restore();
    ctx.fillStyle = "#ECC444"; ctx.beginPath(); ctx.moveTo(x, py + r * 1.6); ctx.lineTo(x - r, py); ctx.arc(x, py - r * 0.3, r, Math.PI * 0.85, Math.PI * 0.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, py - r * 0.3, r * 0.4, 0, Math.PI * 2); ctx.fill();
  }

  // ---------------------------------------------------------------- weather overlays
  drawRain(ctx, env, t, speedK) {
    const k = env.rain; if (k < 0.02) return;
    const W = this.W, H = this.H, n = Math.round(60 + 220 * k), slant = env.wind * 0.6 + speedK * 0.15;
    ctx.strokeStyle = c(env.rainColor, 0.28 + 0.2 * k); ctx.lineWidth = 1.3; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const vy = 1100 + 900 * hash2(i, 3), y = ((hash2(i, 2) * H + t * vy) % H + H) % H, x = ((hash2(i, 1) * W * 1.3 - t * vy * slant) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15;
      const L = (14 + 30 * k) * (0.6 + hash2(i, 3)) * (1 + speedK * 0.6);
      ctx.moveTo(x, y); ctx.lineTo(x - slant * L, y + L);
    }
    ctx.stroke();
  }
  drawAirDebris(ctx, env, t) {
    const k = env.debrisAir; if (k < 0.05) return;
    const W = this.W, H = this.H, n = Math.round(6 + 26 * k), sp = 300 + 1400 * env.wind;
    for (let i = 0; i < n; i++) {
      const x = ((hash2(i, 51) * W * 1.6 - t * sp * (0.5 + hash2(i, 53))) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3;
      const y = H * (0.1 + 0.6 * hash2(i, 52)) + Math.sin(t * 3 + i) * 24 * env.wind;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * (3 + 5 * hash2(i, 54)));
      ctx.fillStyle = i % 3 ? "rgba(70,66,60,0.85)" : "rgba(40,80,50,0.85)"; ctx.fillRect(-8 - 10 * hash2(i, 55), -2, 16 + 20 * hash2(i, 55), 4);
      ctx.restore();
    }
  }
  drawLightningBolt(ctx, seed, age, horizonY) {
    const a = clamp(1 - age / 0.25, 0, 1); if (a <= 0) return;
    const W = this.W; let x = W * (0.15 + 0.7 * hash2(seed, 1)), y = 0;
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 0; i < 12 && y < horizonY; i++) { x += (hash2(seed, i + 2) - 0.5) * 80; y += horizonY / 11 * (0.6 + 0.8 * hash2(seed, i + 30)); ctx.lineTo(x, y); }
    ctx.strokeStyle = "rgba(92,200,255,0.5)"; ctx.lineWidth = 10; ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
  }
  drawSpeedLines(ctx, k, t) {
    if (k < 0.02) return;
    const W = this.W, H = this.H, cx = W / 2, cy = H * this.horizonFrac;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = `rgba(92,200,255,${0.35 * k})`; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 28; i++) { const an = hash2(i, 7) * Math.PI * 2, ph = (t * 2.5 + hash2(i, 8)) % 1, r0 = W * (0.25 + 0.5 * ph), r1 = r0 + W * 0.12 * ph; ctx.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0 * 0.6); ctx.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1 * 0.6); }
    ctx.stroke(); ctx.restore();
  }
  drawPost(ctx, env) {
    ctx.drawImage(this.vig, 0, 0);
    ctx.fillStyle = ctx.createPattern(this.scan, "repeat"); ctx.fillRect(0, 0, this.W, this.H);
  }
}

function quad(ctx, x1, y1, x2, x3, y3, x4) {
  // (x1,y1)-(x2,y1) bottom edge, (x3,y3)-(x4,y3) top edge
  ctx.beginPath(); ctx.moveTo(x1, y1 + 1); ctx.lineTo(x2, y1 + 1); ctx.lineTo(x3, y3); ctx.lineTo(x4, y3); ctx.closePath(); ctx.fill();
}
