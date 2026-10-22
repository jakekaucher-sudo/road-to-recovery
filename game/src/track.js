// Stage track generation. Every stage is built from a seeded random generator
// so a stage always has the same layout. A track is an array of segments with
// curve and elevation, roadside scenery, on-road hazards, pickups, traffic,
// and the delivery zone in front of the stage's business.
import { lerp, clamp } from "./util.js";

export const SEG = 200, ROAD_W = 2000, LANES = 3;

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
  addRoad(10, 40, 10, 0, 0);                 // start straight
  while (segs.length < L - approach - 60) {
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

  // ---- roadside scenery -----------------------------------------------------
  const theme = THEME[stage.weather] || THEME.dusk;
  for (let i = 8; i < N - 2; i++) {
    const s = segs[i];
    const clear = i > zoneStart - 40 && i < zoneEnd + 20;    // keep the stop (and its restore shot) clear
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
    const i = 90 + Math.floor(R() * (zoneStart - 160));
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
  for (let k = 0; k < 6; k++) {
    const i = 150 + Math.floor((k + 0.5) / 6 * (zoneStart - 300));
    segs[i].pickups.push({ kind: "time", offset: [-0.6, 0, 0.6][Math.floor(R() * 3)], got: false, bonus: 3 });
  }
  // ---- traffic ----------------------------------------------------------------
  const cars = [];
  const types = ["sedan", "pickup", "utility", "boxtruck", "sedan", "hatch"];
  for (let c = 0; c < stage.traffic; c++) {
    const z = (70 + R() * (zoneStart - 200)) * SEG;
    cars.push({ z, offset: [-0.62, 0, 0.62][Math.floor(R() * 3)], lane0: 0, speed: 3200 + R() * 4200, type: types[Math.floor(R() * types.length)], color: Math.floor(R() * 6), seed: (R() * 1e6) | 0, swerve: R() < 0.3 ? 0.4 + R() * 0.5 : 0, hit: 0 });
    cars[cars.length - 1].lane0 = cars[cars.length - 1].offset;
  }
  return { segs, N, cars, finish, length: N * SEG, theme, stage, index };
}

export function findSeg(track, z) { return track.segs[clamp(Math.floor(z / SEG), 0, track.N - 1)]; }
