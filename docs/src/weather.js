// Weather presets for each stage: synthwave night palettes in SBA colors plus
// the gameplay effects (grip, wind, visibility, water) the weather causes.
import { lerp, mixRgb } from "./util.js";

// Colors are [r,g,b]. skyTop/skyMid/skyHor: night gradient; sun: striped
// synthwave sun (gold to red); grid: neon ground grid; edge: road edge neon.
export const WEATHER = {
  dusk: {
    skyTop: [4, 12, 36], skyMid: [14, 46, 106], skyHor: [120, 60, 90], horizonGlow: [236, 196, 68],
    sun: 1.0, sunTop: [236, 196, 68], sunBot: [205, 33, 39], stars: 1.0, clouds: 0.25, cloudColor: [30, 40, 80],
    mountains: [10, 30, 72], mountainEdge: [92, 200, 255], ground: [6, 16, 44], grid: [92, 200, 255], gridA: 0.55,
    road: [22, 26, 44], road2: [26, 30, 50], edge: [236, 196, 68], lane: [222, 234, 242], rumbleA: [205, 33, 39], rumbleB: [222, 234, 242],
    fog: [40, 30, 70], fogDensity: 2.2, rain: 0, rainColor: [160, 210, 255], wind: 0.05, gust: 0, grip: 1.0, lightning: 0, water: 0,
    tornado: 0, coast: 0, palms: 1, light: 1, debrisAir: 0.15,
  },
  storm: {
    skyTop: [3, 8, 24], skyMid: [12, 26, 60], skyHor: [44, 60, 96], horizonGlow: [92, 200, 255],
    sun: 0.0, sunTop: [236, 196, 68], sunBot: [205, 33, 39], stars: 0.0, clouds: 1.0, cloudColor: [24, 34, 64],
    mountains: [8, 22, 52], mountainEdge: [84, 156, 212], ground: [5, 12, 32], grid: [84, 156, 212], gridA: 0.4,
    road: [18, 22, 36], road2: [21, 25, 40], edge: [236, 196, 68], lane: [222, 234, 242], rumbleA: [205, 33, 39], rumbleB: [180, 196, 210],
    fog: [26, 36, 64], fogDensity: 4.2, rain: 0.9, rainColor: [150, 200, 255], wind: 0.35, gust: 0.25, grip: 0.82, lightning: 0.35, water: 0.15,
    tornado: 0, coast: 0, palms: 0, light: 0.85, debrisAir: 0.4,
  },
  flood: {
    skyTop: [4, 14, 30], skyMid: [12, 36, 70], skyHor: [50, 90, 110], horizonGlow: [92, 200, 255],
    sun: 0.0, sunTop: [236, 196, 68], sunBot: [205, 33, 39], stars: 0.2, clouds: 0.85, cloudColor: [22, 38, 66],
    mountains: [8, 26, 52], mountainEdge: [92, 200, 255], ground: [6, 20, 40], grid: [92, 200, 255], gridA: 0.35,
    road: [18, 24, 36], road2: [20, 27, 40], edge: [236, 196, 68], lane: [222, 234, 242], rumbleA: [205, 33, 39], rumbleB: [190, 205, 220],
    fog: [30, 56, 80], fogDensity: 5.0, rain: 0.55, rainColor: [150, 210, 255], wind: 0.15, gust: 0.1, grip: 0.75, lightning: 0.1, water: 1.0,
    tornado: 0, coast: 0, palms: 0, light: 0.9, debrisAir: 0.1,
  },
  tornado: {
    skyTop: [10, 14, 20], skyMid: [36, 46, 52], skyHor: [130, 120, 80], horizonGlow: [236, 196, 68],
    sun: 0.35, sunTop: [236, 196, 68], sunBot: [205, 33, 39], stars: 0.0, clouds: 0.95, cloudColor: [30, 36, 40],
    mountains: [16, 26, 36], mountainEdge: [236, 196, 68], ground: [14, 18, 24], grid: [236, 196, 68], gridA: 0.35,
    road: [24, 26, 32], road2: [28, 30, 36], edge: [92, 200, 255], lane: [222, 234, 242], rumbleA: [205, 33, 39], rumbleB: [222, 234, 242],
    fog: [60, 58, 50], fogDensity: 3.2, rain: 0.15, rainColor: [200, 200, 180], wind: 0.6, gust: 0.9, grip: 0.9, lightning: 0.2, water: 0,
    tornado: 1.0, coast: 0, palms: 0, light: 0.85, debrisAir: 1.0,
  },
  hurricane: {
    skyTop: [2, 6, 18], skyMid: [8, 20, 48], skyHor: [30, 50, 84], horizonGlow: [92, 200, 255],
    sun: 0.0, sunTop: [236, 196, 68], sunBot: [205, 33, 39], stars: 0.0, clouds: 1.0, cloudColor: [16, 24, 48],
    mountains: [6, 16, 40], mountainEdge: [92, 200, 255], ground: [8, 14, 30], grid: [92, 200, 255], gridA: 0.3,
    road: [16, 20, 32], road2: [19, 23, 36], edge: [236, 196, 68], lane: [222, 234, 242], rumbleA: [205, 33, 39], rumbleB: [190, 205, 220],
    fog: [22, 36, 62], fogDensity: 5.2, rain: 1.0, rainColor: [160, 210, 255], wind: 0.9, gust: 0.6, grip: 0.7, lightning: 0.6, water: 0.45,
    tornado: 0, coast: 1.0, palms: 1, light: 0.75, debrisAir: 0.8,
  },
  clear: {
    skyTop: [4, 12, 36], skyMid: [14, 46, 106], skyHor: [150, 70, 90], horizonGlow: [236, 196, 68],
    sun: 1.0, sunTop: [236, 196, 68], sunBot: [205, 33, 39], stars: 1.0, clouds: 0.1, cloudColor: [30, 40, 80],
    mountains: [10, 30, 72], mountainEdge: [92, 200, 255], ground: [6, 16, 44], grid: [92, 200, 255], gridA: 0.6,
    road: [22, 26, 44], road2: [26, 30, 50], edge: [236, 196, 68], lane: [222, 234, 242], rumbleA: [205, 33, 39], rumbleB: [222, 234, 242],
    fog: [40, 30, 70], fogDensity: 2.0, rain: 0, rainColor: [160, 210, 255], wind: 0, gust: 0, grip: 1, lightning: 0, water: 0,
    tornado: 0, coast: 0, palms: 1, light: 1, debrisAir: 0,
  },
};

export function blendWeather(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b;
  const o = {};
  for (const k in a) { const va = a[k], vb = b[k]; o[k] = Array.isArray(va) ? mixRgb(va, vb, t) : typeof va === "number" ? lerp(va, vb, t) : (t < 0.5 ? va : vb); }
  return o;
}
