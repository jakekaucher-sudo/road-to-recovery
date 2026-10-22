// Cutscene registry. The game has five kinds of cutscene slots (see
// config.js -> cutscenes): intro, beforeStage[i], arrival[i], ending.
// A slot set to null uses the built-in placeholder screen. To add your own:
//
//   import { registerCutscene } from "./cutscenes.js";
//   registerCutscene("bakery-arrival", {
//     duration: 8,                 // seconds
//     skippable: true,             // gas / Enter / tap skips after 1 s
//     render(ctx, t, W, H, game) { ... draw frame at time t ... },
//     // optional: video: "cutscenes/bakery.mp4"  (plays a video file instead)
//   });
//
// then set config.cutscenes.arrival[0] = "bakery-arrival".
export const CUTSCENES = {};
export function registerCutscene(id, def) { CUTSCENES[id] = { skippable: true, duration: 5, ...def }; }
export function getCutscene(id) { return id ? CUTSCENES[id] || null : null; }
