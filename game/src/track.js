// Stage track generation. Every stage is built from a seeded random generator
// so a stage always has the same layout. A track is an array of segments with
// curve and elevation, roadside scenery, on-road hazards, pickups, traffic,
// and the delivery zone in front of the stage's business.
import { lerp, clamp } from "./util.js";

export const SEG = 200, ROAD_W = 2000, LANES = 3;
const M = 1 / 0.0037;                 // track units per metre (see three/space.js U2M)

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

// Which hazards, scenery and traffic each weather brings.
const THEME = {
  dusk:      { hazards: ["cones", "debris", "branch"],                 side: ["palm", "lamp", "house", "houseTarp", "pole", "billboard", "tree"], far: "town" },
  storm:     { hazards: ["branch", "debris", "puddle", "cones"],       side: ["tree", "treeBent", "pole", "poleLean", "houseTarp", "lamp", "billboard"], far: "hills" },
  flood:     { hazards: ["flood", "log", "barrel", "flood", "sandbags"], side: ["treeSunk", "houseFlooded", "pole", "sandbagWall", "warning", "lamp"], far: "valley" },
  tornado:   { hazards: ["tumble", "hay", "debris", "poleDown", "tumble"], side: ["barn", "silo", "windmill", "fence", "poleLean", "treeBroken", "hay"], far: "plains" },
  hurricane: { hazards: ["sand", "wave", "debris", "frond", "wave"],   side: ["palmBent", "dune", "houseStilts", "lamp", "palmBent", "houseStilts"], sea: ["palmBent", "dune", "boat", "palmBent"], far: "coast" },
};

export function buildTrack(stage, index, cfg) {
  const R = rng(1000 + index * 7919);
  const segs = [];
  const add = (curve, y) => {
    const i = segs.length;
    segs.push({ i, curve, y, sprites: [], hazards: [], pickups: [], cars: [], water: 0, zone: false, p1: { world: { x: 0, y: 0, z: i * SEG }, camera: {}, screen: {} }, p2: { world: { x: 0, y: 0, z: (i + 1) * SEG }, camera: {}, screen: {} } });
  };
  const lastY = () => segs.length ? segs[segs.length - 1].y : 0;
  const addRoad = (enter, hold, leave, curve, height) => {
    const y0 = lastY(), y1 = y0 + height * SEG, n = enter + hold + leave;
    for (let k = 0; k < enter; k++) add(easeIn(0, curve, k / enter), easeInOut(y0, y1, k / n));
    for (let k = 0; k < hold; k++) add(curve, easeInOut(y0, y1, (enter + k) / n));
    for (let k = 0; k < leave; k++) add(easeInOut(curve, 0, k / leave), easeInOut(y0, y1, (enter + hold + k) / n));
  };
  const L = stage.length;
  const approach = 260;                       // straight run-in to the business
  // ---- jumps, three a stage: a raised drawbridge over a river, a parked car carrier with its ramp down,
  // steel kicker ramps in one lane, and washed-out levee crests across the whole road
  const jumps = [], plan = (JUMPS[index] || []).slice();
  const insertJump = (kind) => {
    const y0 = lastY();
    if (kind === "drawbridge") {
      // both bascule leaves are raised: up the near leaf, over the gap, down the far leaf
      const run = 80, leaf = 26, gap = 18, H = 4.2 * M, j = { kind, deckY: y0, H, leaf, gap };
      for (let k = 0; k < run; k++) add(0, y0);
      j.up0 = segs.length; for (let k = 1; k <= leaf; k++) { add(0, y0 + H * k / leaf); segs[segs.length - 1].bridge = { part: "up", k }; }
      j.gap0 = segs.length; for (let k = 0; k < gap; k++) { add(0, y0); segs[segs.length - 1].bridge = { part: "gap", k }; }
      j.gap1 = segs.length; for (let k = 0; k < leaf; k++) { add(0, y0 + H * (1 - k / leaf)); segs[segs.length - 1].bridge = { part: "down", k }; }
      j.down1 = segs.length; for (let k = 0; k < 70; k++) add(0, y0);
      j.span0 = j.up0 - 6; j.span1 = j.down1 + 6; j.angle = Math.atan2(4.2, leaf * SEG / M);
      jumps.push(j);
    } else if (kind === "crest") {
      // the road climbs a levee and the far side has washed out: a sheer drop back to the old road level
      const run = 70, leaf = 30, H = 3.2 * M, j = { kind, deckY: y0, H, leaf };
      for (let k = 0; k < run; k++) add(0, y0);
      j.up0 = segs.length; for (let k = 1; k <= leaf; k++) { add(0, y0 + H * Math.pow(k / leaf, 1.25)); segs[segs.length - 1].bridge = { part: "up", k }; }
      j.gap0 = segs.length; for (let k = 0; k < 70; k++) { add(0, y0); if (k < 4) segs[segs.length - 1].bridge = { part: "drop", k }; }
      j.down1 = j.gap0 + 4; j.span0 = j.up0 - 6; j.span1 = j.gap0 + 40; j.angle = Math.atan2(3.2 * 1.25, leaf * SEG / M);
      jumps.push(j);
    } else if (kind === "kicker") {
      // a steel ramp in one lane: line up with it and the van leaves the top at speed
      const run = 50, lane = [-0.62, 0, 0.62][Math.floor(R() * 3)], j = { kind, lane, H: 1.8, kick: 0, ramp: 11, deck: 0, cab: 0 };
      for (let k = 0; k < run; k++) add(0, y0);
      j.i0 = segs.length; j.lip = j.i0 + j.ramp; j.end = j.lip + 4;   // (a little past the lip, so the launch check still sees the van)
      for (let k = 0; k < j.ramp + 90; k++) add(0, y0);
      j.span0 = j.i0 - 40; j.span1 = j.end + 60;
      jumps.push(j);
    } else {
      // car carrier parked in the right lane: rear ramp, empty upper deck, a kick at the front over the cab
      const run = 60, j = { kind, lane: 0.62, H: 3.4, kick: 0.45, ramp: 9, deck: 20, cab: 9 };
      for (let k = 0; k < run; k++) add(0, y0);
      j.i0 = segs.length; j.lip = j.i0 + j.ramp + j.deck; j.end = j.lip + j.cab;
      for (let k = 0; k < j.ramp + j.deck + j.cab + 90; k++) add(0, y0);
      j.span0 = j.i0 - 40; j.span1 = j.end + 30;
      jumps.push(j);
    }
  };
  addRoad(10, 40, 10, 0, 0);                 // start straight
  while (segs.length < L - approach - 60) {
    if (plan.length && segs.length > L * plan[0][1]) { insertJump(plan.shift()[0]); continue; }
    const r = R();
    const len = 25 + Math.floor(R() * 45);
    const dir = R() < 0.5 ? -1 : 1;
    const curve = r < 0.2 ? 0 : dir * (1.5 + R() * 4.5) * stage.curves;
    const maxY = 2600;                                   // keep the road within ~10 m of its start height
    let hill = (R() - 0.5) * 60 * stage.hills; const yNow = lastY();
    if (yNow + hill * SEG > maxY) hill = -Math.abs(hill); if (yNow + hill * SEG < -maxY) hill = Math.abs(hill);
    if (r > 0.85) { addRoad(10, 20, 10, -curve * 0.6, hill); addRoad(10, 20, 10, curve * 0.6, -hill); } // S-bend
    else addRoad(len * 0.4 | 0, len, len * 0.4 | 0, curve, hill);
  }
  addRoad(70, 0, 70, 0, -lastY() / SEG);       // flatten out gently
  while (segs.length < L) add(0, lastY());
  const N = segs.length;

  // ---- delivery zone and business ------------------------------------------
  const zoneStart = N - 190, zoneEnd = N - 150, bizSeg = N - 146;
  for (let i = zoneStart; i < zoneEnd; i++) segs[i].zone = true;
  segs[bizSeg].sprites.push({ kind: "business", offset: 2.15, idx: stage.business });
  segs[zoneStart - 1].sprites.push({ kind: "gate", offset: 0 });
  [1500, 1000, 500].forEach((ft, k) => { const i = zoneStart - 30 - k * 28; segs[i].sprites.push({ kind: "stopSign", offset: 1.45, label: ft + " FT" }); });
  const finish = { zoneStart, zoneEnd, bizSeg, N };
  const nearJump = (i, pad = 0) => jumps.some(j => i >= j.span0 - pad && i <= j.span1 + pad);

  // ---- roadside scenery -----------------------------------------------------
  const theme = THEME[stage.weather] || THEME.dusk;
  for (let i = 8; i < N - 2; i++) {
    const s = segs[i];
    const clear = i > zoneStart - 40 && i < zoneEnd + 20;    // keep the stop (and its restore shot) clear
    if (jumps.some(j => j.kind === "drawbridge" && i >= j.span0 - 8 && i <= j.span1 + 8)) continue;   // the river: no lamps or trees in the water
    if (i % 22 === 0) { s.sprites.push({ kind: "lamp", offset: -1.3 }); if (!clear) s.sprites.push({ kind: "lamp", offset: 1.3 }); }
    if (clear) continue;
    for (const side of [-1, 1]) {
      if (theme.sea && side > 0) { // beach side of the coast road: keep the view of the sea open
        if (R() < 0.08) { const kind = theme.sea[Math.floor(R() * theme.sea.length)]; s.sprites.push({ kind, offset: 1.45 + R() * 0.7, seed: (R() * 1e6) | 0 }); }
        if (i % 900 === 450) s.sprites.push({ kind: "lighthouse", offset: 9, seed: i });
        continue;
      }
      if (R() < 0.17) {
        const kind = theme.side[Math.floor(R() * theme.side.length)];
        const big = ["house", "houseTarp", "houseFlooded", "houseStilts", "barn", "silo", "billboard", "boat", "dune", "lighthouse"].includes(kind);
        if (big && side > 0 && i > zoneStart - 150 && i < zoneEnd + 60) continue;   // the restore camera looks back along this stretch
        s.sprites.push({ kind, offset: side * (1.35 + (big ? 1.0 : 0.25) + R() * (big ? 1.4 : 1.0)), seed: (R() * 1e6) | 0 });
      }
    }
  }
  // ---- hazards on the road ---------------------------------------------------
  const nHaz = stage.hazards;
  for (let h = 0; h < nHaz; h++) {
    let i = 90 + Math.floor(R() * (zoneStart - 160));
    while (nearJump(i, 30)) i = 90 + Math.floor(R() * (zoneStart - 160));    // keep the jumps clear
    const kind = theme.hazards[Math.floor(R() * theme.hazards.length)];
    const lane = [-0.6, 0, 0.6][Math.floor(R() * 3)];
    const hz = { kind, offset: lane, seed: (R() * 1e6) | 0, hit: false, vx: 0 };
    if (kind === "flood" || kind === "wave") {          // water across the whole road
      const len = 10 + Math.floor(R() * 14);
      for (let k = 0; k < len; k++) if (segs[i + k]) segs[i + k].water = kind === "wave" ? 0.8 : 1;
      if (kind === "wave") segs[i].hazards.push({ kind: "waveCrest", offset: 0, seed: hz.seed, len });
      continue;
    }
    if (kind === "puddle" || kind === "sand") { for (let k = 0; k < 6; k++) segs[i + k] && segs[i + k].hazards.push({ ...hz, kind, offset: lane, k }); continue; }
    if (kind === "tumble" || kind === "log" || kind === "barrel") hz.vx = (R() < 0.5 ? -1 : 1) * (0.25 + R() * 0.35); // drifts across lanes
    if (kind === "poleDown") hz.offset = R() < 0.5 ? -0.45 : 0.45;
    segs[i].hazards.push(hz);
  }
  // ---- time pickups ---------------------------------------------------------
  const nPick = Math.round(N / 480);
  for (let k = 0; k < nPick; k++) {
    let i = 150 + Math.floor((k + 0.5) / nPick * (zoneStart - 300));
    while (nearJump(i, 20)) i += 10;
    segs[i].pickups.push({ kind: "time", offset: [-0.6, 0, 0.6][Math.floor(R() * 3)], got: false, bonus: 3 });
  }
  // ---- traffic ----------------------------------------------------------------
  const cars = [];
  const types = ["sedan", "pickup", "utility", "boxtruck", "sedan", "hatch"];
  for (let c = 0; c < stage.traffic; c++) {
    let z = (70 + R() * (zoneStart - 200)) * SEG;
    while (nearJump(Math.floor(z / SEG), 20)) z += 40 * SEG;
    cars.push({ z, offset: [-0.62, 0, 0.62][Math.floor(R() * 3)], lane0: 0, speed: 3200 + R() * 4200, type: types[Math.floor(R() * types.length)], color: Math.floor(R() * 6), seed: (R() * 1e6) | 0, swerve: R() < 0.3 ? 0.4 + R() * 0.5 : 0, hit: 0 });
    cars[cars.length - 1].lane0 = cars[cars.length - 1].offset;
  }
  return { segs, N, cars, finish, length: N * SEG, theme, stage, index, jumps };
}

// Where each stage's jumps go (fraction of the stage length).
const JUMPS = [
  [["kicker", 0.2], ["drawbridge", 0.44], ["kicker", 0.7]],
  [["crest", 0.22], ["carrier", 0.46], ["kicker", 0.72]],
  [["crest", 0.2], ["kicker", 0.45], ["crest", 0.7]],
  [["kicker", 0.2], ["crest", 0.45], ["carrier", 0.7]],
  [["crest", 0.2], ["drawbridge", 0.46], ["kicker", 0.72]],
];
export function findSeg(track, z) { return track.segs[clamp(Math.floor(z / SEG), 0, track.N - 1)]; }
