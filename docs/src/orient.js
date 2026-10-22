// Keeps phones in landscape once the game has started, until the player is back on the title screen.
//  * Android and other browsers that allow it: a real lock (fullscreen + screen.orientation.lock),
//    requested from the start tap.
//  * iPhone (Safari can't lock orientation): a virtual lock. If the phone flips to portrait mid-game
//    (for example from turning it too far while steering), the whole game is rotated back so it stays
//    exactly as it was relative to the phone. Steering, buttons and the view all follow.
// Add ?nolock=1 to the address to turn both off.
const off = new URLSearchParams(location.search).get("nolock") === "1";
export const VIEW = { w: window.innerWidth, h: window.innerHeight, rot: 0 };   // rot: CSS rotation of the game (0, 90, -90)
let playing = false, lastLandscape = 0, hard = false, app = null;

const osAngle = () => {
  const a = screen.orientation && typeof screen.orientation.angle === "number" ? screen.orientation.angle : (typeof window.orientation === "number" ? window.orientation : 0);
  return ((a % 360) + 360) % 360;
};
// Work out the game's logical size and rotation for the current screen; applies it to #app.
export function viewSize() {
  const iw = window.innerWidth, ih = window.innerHeight, portrait = ih > iw;
  if (!portrait) { const a = osAngle(); if (a === 90 || a === 270) lastLandscape = a; }
  const rot = !off && playing && portrait && lastLandscape ? (lastLandscape === 90 ? 90 : -90) : 0;
  VIEW.rot = rot; VIEW.w = rot ? ih : iw; VIEW.h = rot ? iw : ih;
  app = app || document.getElementById("app");
  if (app) {
    if (rot) { app.style.width = VIEW.w + "px"; app.style.height = VIEW.h + "px"; app.style.transform = rot === 90 ? `translateX(${iw}px) rotate(90deg)` : `translateY(${ih}px) rotate(-90deg)`; }
    else { app.style.width = app.style.height = app.style.transform = ""; }
  }
  document.body.classList.toggle("vlock", !!rot);
  return VIEW;
}
// Called every frame: the lock applies only after the game has started on a phone.
export function setPlaying(on) {
  if (on === playing) return;
  const was = VIEW.rot; playing = on; viewSize();
  if (VIEW.rot !== was) window.dispatchEvent(new Event("resize"));       // resize everything only if the view actually turned
}
// The screen angle the game is drawn at (used to turn the motion sensor into steering).
export function gameAngle() { return VIEW.rot ? lastLandscape : osAngle(); }
// A drag across the game in its own left-right direction, whatever way the page is rotated.
export function dragDX(t, x0, y0) { return VIEW.rot === 90 ? t.clientY - y0 : VIEW.rot === -90 ? -(t.clientY - y0) : t.clientX - x0; }

// Real lock where the browser allows it. Must be called from inside a tap.
export function tryHardLock() {
  if (off || hard) return;
  const el = document.documentElement, lock = () => screen.orientation && screen.orientation.lock ? screen.orientation.lock("landscape").then(() => { hard = true; }) : Promise.reject();
  const entered = !document.fullscreenElement && !!el.requestFullscreen;
  const fs = entered ? el.requestFullscreen({ navigationUI: "hide" }) : Promise.resolve();
  Promise.resolve(fs).then(lock).catch(() => {                   // iPhone, iPad and in-app viewers refuse: the virtual lock covers them
    if (entered && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  });
}
// Leaving fullscreen (Android back gesture) drops the real lock; allow it again from the next start tap.
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) hard = false; });
export function releaseHardLock() {
  if (!hard) return; hard = false;
  try { screen.orientation.unlock(); } catch (e) {}
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}
