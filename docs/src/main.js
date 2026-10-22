// Boot, render loop and screen dispatch for the 3D game.
// Two canvases: WebGL for the 3D world (#gl) and a 2D overlay (#ui) for the
// HUD, menus and cutscenes. Test hooks: ?autopilot=1 ?stage=N ?mobile=1
// ?mute=1 ?q=low|high, window.__game / __step(n) / __render().
import { CONFIG } from "../config.js";
import { loadArt, ART } from "./assets.js";
import { WorldRenderer } from "./render.js";
import { Game } from "./game.js";
import { Audio } from "./audio.js";
import { INPUT, initInput, pollInput, clearEdges, detectMobile } from "./input.js";
import { drawHUD, drawStageIntro, neonText } from "./hud.js";
import { drawTitle, drawBriefing, drawRestoration, drawResults, drawGameOver, drawPause, drawEnding, RESTORE_DUR } from "./screens.js";
import { clamp } from "./util.js";
import { Engine, detectQuality } from "./three/engine3d.js";
import { World3D } from "./three/world3d.js";
import { makeTitleScene } from "./three/title3d.js";
import "./intro.js";
import "./outro.js";

const params = new URLSearchParams(location.search);
const mobile = detectMobile();
const quality = detectQuality(mobile);
const gl = document.getElementById("gl"), ui = document.getElementById("ui");
const ctx = ui.getContext("2d");
const status = document.getElementById("status");
window.__ready = false; window.__error = null;
let W = 1280, H = 720, uiScale = 1;
function fitUI() {
  uiScale = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  W = Math.round(window.innerWidth * uiScale); H = Math.round(window.innerHeight * uiScale);
  ui.width = W; ui.height = H; document.body.classList.toggle("portrait", mobile && window.innerHeight > window.innerWidth);
  if (game) game.renderer = new WorldRenderer(W, H, CONFIG);
}
window.addEventListener("resize", fitUI); window.addEventListener("orientationchange", () => setTimeout(fitUI, 250));

let game = null, engine = null, world = null, title = null;
const ctrl = { gas: document.getElementById("gas"), brake: document.getElementById("brake"), pause: document.getElementById("pauseBtn"), recal: document.getElementById("recal"), steer: document.getElementById("steerBtn") };

const WORLD_STATES = new Set(["stageIntro", "drive", "gameover", "restoring", "results"]);
function render(dtMs = 16) {
  const g = game; if (!g) return;
  const s = g.state, T = g.stateT;
  // ---- 3D
  if (s === "title") { engine.setView(title.scene, title.cam); title.update(g.clock); engine.render(dtMs); }
  else if (WORLD_STATES.has(s)) { engine.setView(world.scene, world.cam); world.update(g, g.paused ? 0 : dtMs / 1000); engine.render(dtMs); }
  // ---- 2D overlay
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  if (s === "title") drawTitle(ctx, g, W, H, g.clock);
  else if (s === "briefing") drawBriefing(ctx, g, W, H, T);
  else if (s === "cutscene" && g.cutscene) g.cutscene.render(ctx, T, W, H, g);
  else if (s === "stageIntro" || s === "drive" || s === "gameover") {
    if (s !== "gameover") drawHUD(ctx, g, W, H, CONFIG);
    if (s === "stageIntro") {
      if (T < 3.6) drawStageIntro(ctx, g, W, H, CONFIG, T);
      if (T > 1.5 && T < 4.4) { const n = T > 4.0 ? "GO!" : String(Math.max(1, 3 - Math.floor(T - 1.5))); neonText(ctx, n, W / 2, H * 0.36, Math.round(16 * Math.min(W / 1280, H / 720)), n === "GO!" ? "#ECC444" : "#FEFEFE", { align: "center", glow: "#CD2127" }); }
    }
    if (s === "gameover") drawGameOver(ctx, g, W, H, T);
    if (g.paused) drawPause(ctx, g, W, H);
  } else if (s === "restoring") drawRestoration(ctx, g, W, H, T);
  else if (s === "results") { drawRestoration(ctx, g, W, H, RESTORE_DUR); drawResults(ctx, g, W, H, T); }
  else if (s === "ending") drawEnding(ctx, g, W, H, T);
  document.body.classList.toggle("racing", ["stageIntro", "drive"].includes(s) && !g.paused);
  document.body.classList.toggle("paused", ["stageIntro", "drive"].includes(s) && !!g.paused);
  document.body.classList.toggle("ontitle", s === "title");
  document.body.classList.toggle("show3d", s === "title" || WORLD_STATES.has(s));
}

let last = 0, acc = 0;
function frame(now) {
  const dtMs = Math.min(100, now - (last || now)); last = now; acc += dtMs / 1000;
  let steps = 0;
  while (acc >= 1 / 60 && steps < 6) { pollInput(); game.update(); clearEdges(); acc -= 1 / 60; steps++; }
  if (steps === 6) acc = 0;
  game.audio.update();
  game.renderAlpha = Math.min(1, acc * 60);              // how far we are between two physics steps
  render(dtMs);
  requestAnimationFrame(frame);
}

async function boot() {
  try {
    fitUI();
    initInput(ui, ctrl);
    await loadArt((n) => { status.textContent = "Loading " + n + "…"; }, mobile);
    if (!ART.ok) throw new Error("The van artwork did not load:\n" + ART.errors.join("\n") + "\nServe the project folder over HTTP (python3 game/tools/serve.py) so ../assets/ resolves.");
    status.textContent = "Building the world…";
    engine = new Engine(gl, quality);
    world = new World3D(engine, CONFIG, ART, quality);
    title = makeTitleScene(ART, quality);
    const audio = new Audio();
    if (params.get("mute") === "1") audio.setMuted(true);
    game = new Game(CONFIG, ART, new WorldRenderer(W, H, CONFIG), audio, mobile);
    game.onStageLoad = (g) => { world.loadStage(g); engine.warm(world.scene, world.cam); };
    world.loadStage(game); engine.warm(world.scene, world.cam); engine.warm(title.scene, title.cam);
    game.autopilot = params.get("autopilot") === "1";
    if (params.has("stage")) { game.loadStage(clamp(+params.get("stage") - 1, 0, 4)); game.time = game.stageCfg.time; game.beginStage(); }
    if (params.has("state")) game.setState(params.get("state"));
    window.__game = game; window.__input = INPUT; window.__world = world; window.__engine = engine;
    import("./cutscenes.js").then(m => Object.values(m.CUTSCENES).forEach(c => c.preload && c.preload()));
    window.__step = (n = 1, inputs) => { for (let i = 0; i < n; i++) { if (inputs) Object.assign(INPUT, inputs); else pollInput(); game.update(); clearEdges(); if (WORLD_STATES.has(game.state) && i < n - 1 && i % 4 === 0) world.update(game, 4 / 60); } game.renderAlpha = 1; render(16); return game.state; };
    window.__render = () => render(16);
    status.style.display = "none";
    window.__ready = true;
    if (ART.errors.length) console.warn(ART.errors);
    requestAnimationFrame(frame);
  } catch (e) {
    window.__error = String(e.stack || e); status.innerHTML = "<b>Could not start.</b><pre>" + (e.message || e) + "</pre>"; console.error(e);
  }
}
window.addEventListener("error", (e) => { window.__error = String(e.error && e.error.stack || e.message); });
boot();
