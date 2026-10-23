// Input: keyboard (desktop), on-screen gas/brake + gyro tilt steering (phones
// and tablets), with a touch-drag fallback when no gyroscope is available.
// Produces a normalized state each frame: steer -1..1, gas 0..1, brake 0..1,
// boost (edge), pause (edge), confirm (edge).
import { VIEW, gameAngle, dragDX } from "./orient.js";
export const INPUT = {
  steer: 0, gas: 0, brake: 0, boostPressed: false, pausePressed: false, confirmPressed: false, mutePressed: false, escortPressed: false,
  mobile: false, gyro: { invert: new URLSearchParams(location.search).get("invertTilt") === "1", available: false, active: false, angle: 0, neutral: 0, sensitivity: 24, deadzone: 2 },
  touchSteer: 0, lastGasTap: 0, keys: new Set(), any: false, calibrateRequest: false,
  steerMode: "tilt", notice: null,          // phones: "tilt" (motion sensor) or "drag" (slide a finger)
  pad: { connected: false, name: "", steer: 0, gas: 0, brake: 0, prev: [] },   // game controller (Xbox layout)
};
// Remember the player's steering choice on this device.
try { const m = localStorage.getItem("rtr-steer"); if (m === "tilt" || m === "drag") INPUT.steerMode = m; } catch (e) {}

const isTouch = () => ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
export function detectMobile() {
  const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const forced = new URLSearchParams(location.search).get("mobile");
  if (forced === "1") return true; if (forced === "0") return false;
  return isTouch() && coarse;
}

const STEER_LEFT = ["ArrowLeft", "KeyA"], STEER_RIGHT = ["ArrowRight", "KeyD"];
const GAS = ["ArrowUp", "KeyW"], BRAKE = ["ArrowDown", "Space", "KeyC", "KeyS"];
const BOOST = ["KeyX", "ShiftLeft", "ShiftRight"], PAUSE = ["KeyP", "Escape"];

export function initInput(canvas, ui) {
  INPUT.mobile = detectMobile();
  document.body.classList.toggle("mobile", INPUT.mobile);
  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    INPUT.keys.add(e.code); INPUT.any = true;
    if (BOOST.includes(e.code)) INPUT.boostPressed = true;
    if (PAUSE.includes(e.code)) INPUT.pausePressed = true;
    if (e.code === "Enter" || e.code === "Space" || GAS.includes(e.code)) INPUT.confirmPressed = true;
    if (e.code === "KeyM") INPUT.mutePressed = true;
    if (e.code === "Digit1" || e.code === "Numpad1") INPUT.escortPressed = true;   // helicopter escort (when earned)
  });
  window.addEventListener("keyup", (e) => INPUT.keys.delete(e.code));
  window.addEventListener("blur", () => INPUT.keys.clear());

  // ---- touch pedals ---------------------------------------------------------
  const bindHold = (el, prop, onDown) => {
    if (!el) return;
    const down = (e) => { e.preventDefault(); INPUT[prop] = 1; el.classList.add("held"); INPUT.any = true; onDown && onDown(); };
    const up = (e) => { e.preventDefault(); INPUT[prop] = 0; el.classList.remove("held"); };
    el.addEventListener("touchstart", down, { passive: false }); el.addEventListener("touchend", up, { passive: false }); el.addEventListener("touchcancel", up, { passive: false });
    el.addEventListener("mousedown", down); el.addEventListener("mouseup", up); el.addEventListener("mouseleave", up);
  };
  bindHold(ui.gas, "touchGas", () => {
    const now = performance.now();
    if (now - INPUT.lastGasTap < 300) INPUT.boostPressed = true; // double-tap gas = boost
    INPUT.lastGasTap = now; INPUT.confirmPressed = true;
  });
  bindHold(ui.brake, "touchBrake");
  ui.pause && ui.pause.addEventListener("click", (e) => { e.preventDefault(); INPUT.pausePressed = true; });
  ui.recal && ui.recal.addEventListener("click", (e) => { e.preventDefault(); INPUT.calibrateRequest = true; });
  if (ui.heli) { const call = (e) => { e.preventDefault(); e.stopPropagation(); INPUT.escortPressed = true; }; ui.heli.addEventListener("touchstart", call, { passive: false }); ui.heli.addEventListener("click", call); }

  // tap anywhere on the canvas = confirm (menus)
  canvas.addEventListener("touchstart", (e) => { INPUT.confirmPressed = true; INPUT.any = true; dragStart(e); }, { passive: true });
  canvas.addEventListener("touchmove", dragMove, { passive: true });
  // iPhone only lets a page ask for the motion sensor from inside a tap (touchend/click),
  // so every tap tries once until tilt is granted.
  canvas.addEventListener("touchend", () => { INPUT.touchSteer = 0; dragId = null; if (INPUT.steerMode === "tilt") requestTilt(); }, { passive: true });
  canvas.addEventListener("mousedown", () => { INPUT.confirmPressed = true; });
  if (ui.gas) ui.gas.addEventListener("touchend", () => { if (INPUT.steerMode === "tilt") requestTilt(); }, { passive: true });
  if (ui.steer) {
    const paint = () => { ui.steer.textContent = INPUT.steerMode === "tilt" ? "STEER: TILT" : "STEER: DRAG"; document.body.classList.toggle("tiltmode", INPUT.steerMode === "tilt"); };
    paint();
    ui.steer.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      setSteerMode(INPUT.steerMode === "tilt" ? "drag" : "tilt"); paint();
    });
  }
}

export function setSteerMode(m) {
  INPUT.steerMode = m; INPUT.touchSteer = 0; dragId = null;
  try { localStorage.setItem("rtr-steer", m); } catch (e) {}
  if (m === "tilt") { requestTilt(); setTimeout(calibrateGyro, 600); }
  INPUT.notice = m === "tilt" ? "STEERING: TILT THE PHONE" : "STEERING: DRAG LEFT / RIGHT";
}

// Drag steering: used in DRAG mode, or in TILT mode when the motion sensor is unavailable.
let dragId = null, dragX0 = 0;
const tiltLive = () => INPUT.steerMode === "tilt" && INPUT.gyro.active;
let dragY0 = 0;
function dragStart(e) { if (tiltLive()) return; const t = e.changedTouches[0]; dragId = t.identifier; dragX0 = t.clientX; dragY0 = t.clientY; }
function dragMove(e) {
  if (tiltLive() || dragId === null) return;
  for (const t of e.changedTouches) if (t.identifier === dragId) INPUT.touchSteer = Math.max(-1, Math.min(1, dragDX(t, dragX0, dragY0) / (VIEW.w * 0.18)));
}

// ---- gyroscope ---------------------------------------------------------------
// Steering angle = component of world "up" along the screen's right axis, which
// works both for turning the phone like a wheel and for tilting it flat.
const screenAngle = gameAngle;   // the angle the game is drawn at (stays put while orient.js holds landscape)
function onOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  const first = !INPUT.gyro.active;
  INPUT.gyro.available = true; INPUT.gyro.active = true; INPUT.gyro.status = "ok";
  const b = e.beta * Math.PI / 180, g = e.gamma * Math.PI / 180;
  const ux = -Math.cos(b) * Math.sin(g), uy = Math.sin(b);           // world-up in device x/y
  const a = ((screenAngle() % 360) + 360) % 360;
  // screen-right axis in device coordinates for each screen rotation
  const right = a === 90 ? [0, -1] : a === 180 ? [-1, 0] : a === 270 ? [0, 1] : [1, 0];
  const comp = ux * right[0] + uy * right[1];
  INPUT.gyro.angle = -Math.asin(Math.max(-1, Math.min(1, comp))) * 180 / Math.PI * (INPUT.gyro.invert ? -1 : 1);
  if (first) setTimeout(calibrateGyro, 300);                 // first reading: treat the current hold as straight
}
// Ask for the motion sensor. Must run synchronously inside a tap handler on iPhone.
// gyro.status: "" (not asked) | "asking" | "ok" | "denied" | "insecure" | "unsupported" | "silent"
let listening = false;
function listen() {
  if (!listening) { window.addEventListener("deviceorientation", onOrientation); listening = true; }
  // no readings within 1.5 s: this browser or app does not pass motion data to the page
  setTimeout(() => { if (!INPUT.gyro.active && INPUT.gyro.status !== "denied") INPUT.gyro.status = "silent"; }, 1500);
}
export function requestTilt() {
  const G = INPUT.gyro;
  if (G.active || G.status === "asking" || G.status === "denied") return;
  const DOE = window.DeviceOrientationEvent;
  if (!DOE) { G.status = "unsupported"; return; }
  if (!window.isSecureContext) { G.status = "insecure"; return; }
  if (typeof DOE.requestPermission === "function") {
    G.status = "asking";
    let p; try { p = DOE.requestPermission(); } catch (e) { G.status = ""; return; }
    Promise.resolve(p).then(r => { if (r === "granted") { G.status = "waiting"; listen(); } else G.status = "denied"; })
      .catch(() => { G.status = ""; });                       // not counted as a tap: try again on the next one
  } else { G.status = "waiting"; listen(); }
}
// A short line for the menus explaining why tilt is not in use (or "" when it is fine).
export function tiltNote() {
  if (!INPUT.mobile || INPUT.steerMode !== "tilt" || INPUT.gyro.active) return "";
  switch (INPUT.gyro.status) {
    case "denied": return "Motion access was not allowed, so drag left/right to steer. To use tilt, reload the page and tap Allow.";
    case "insecure": return "Tilt steering needs a secure (https) page. Drag left/right to steer for now.";
    case "unsupported": case "silent": return "This browser or app does not share the motion sensor. Drag left/right to steer, or open the game in Safari or Chrome.";
    default: return "";
  }
}
export function calibrateGyro() { INPUT.gyro.neutral = INPUT.gyro.angle; }

// Called once per frame before the game update.
export function pollInput() {
  const k = INPUT.keys, has = (list) => list.some(c => k.has(c));
  let steer = (has(STEER_RIGHT) ? 1 : 0) - (has(STEER_LEFT) ? 1 : 0);
  if (INPUT.mobile) {
    if (tiltLive()) {
      const G = INPUT.gyro; let a = G.angle - G.neutral;
      a = Math.abs(a) < G.deadzone ? 0 : a - Math.sign(a) * G.deadzone;
      steer = Math.max(-1, Math.min(1, a / G.sensitivity));
    } else if (INPUT.touchSteer) steer = INPUT.touchSteer;
  }
  pollPad();
  if (INPUT.pad.steer) steer = INPUT.pad.steer;                // a controller stick overrides when moved
  INPUT.steer = steer;
  INPUT.gas = Math.max(has(GAS) ? 1 : 0, INPUT.touchGas || 0, INPUT.pad.gas);
  INPUT.brake = Math.max(has(BRAKE) ? 1 : 0, INPUT.touchBrake || 0, INPUT.pad.brake);
  if (INPUT.calibrateRequest) { calibrateGyro(); INPUT.calibrateRequest = false; }
}
// ---- game controller (Xbox, or any controller the browser maps to the standard layout) ----
// Left stick (or D-pad): steer.  RT (or D-pad up): gas.  LT (or D-pad down): brake.  X (or RB): boost.  A: start / confirm.
// B: helicopter escort (only after a time-up).
// Menu (Start): pause.  View (Back): music on/off.
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
window.addEventListener("gamepadconnected", (e) => { INPUT.pad.connected = true; INPUT.pad.name = e.gamepad.id; INPUT.notice = "CONTROLLER CONNECTED"; });
window.addEventListener("gamepaddisconnected", () => { const any = [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(Boolean); INPUT.pad.connected = any; if (!any) INPUT.notice = "CONTROLLER DISCONNECTED"; });
function pollPad() {
  const P = INPUT.pad; P.steer = P.gas = P.brake = 0;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = [...pads].find(p => p && p.connected); if (!gp) return;
  P.connected = true;
  const btn = (i) => gp.buttons[i] ? (gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0)) : 0;
  const pressed = (i) => btn(i) > 0.5, edge = (i) => pressed(i) && !P.prev[i];
  // stick with a dead zone and a gentle curve for fine steering
  let sx = gp.axes[0] || 0; const dz = 0.15;
  sx = Math.abs(sx) < dz ? 0 : Math.sign(sx) * Math.pow((Math.abs(sx) - dz) / (1 - dz), 1.4);
  P.steer = Math.max(-1, Math.min(1, sx + (pressed(PAD.RIGHT) ? 1 : 0) - (pressed(PAD.LEFT) ? 1 : 0)));
  P.gas = Math.max(btn(PAD.RT), pressed(PAD.UP) ? 1 : 0); P.brake = Math.max(btn(PAD.LT), pressed(PAD.DOWN) ? 1 : 0);
  if (edge(PAD.A)) INPUT.confirmPressed = true;
  if (edge(PAD.X) || edge(PAD.RB)) INPUT.boostPressed = true;
  if (edge(PAD.MENU)) INPUT.pausePressed = true;
  if (edge(PAD.B)) INPUT.escortPressed = true;
  if (edge(PAD.VIEW)) INPUT.mutePressed = true;
  if (edge(PAD.A) || edge(PAD.RT) || P.steer) INPUT.any = true;
  P.prev = gp.buttons.map(b => b && (b.pressed || b.value > 0.5));
}
// Short rumble on a crash, where the controller supports it.
export function rumble(strength = 0.6, ms = 180) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) { const a = gp && gp.vibrationActuator; if (a && a.playEffect) a.playEffect("dual-rumble", { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch(() => {}); }
}

export function clearEdges() { INPUT.boostPressed = INPUT.pausePressed = INPUT.confirmPressed = INPUT.mutePressed = INPUT.escortPressed = false; }
