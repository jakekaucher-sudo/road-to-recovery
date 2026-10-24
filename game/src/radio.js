// Car radio, the way open-world driving games do it: D-pad left / right or keys 4 / 5 step through
// the stations (phones: tap the radio button under the stage panel), static plays while the dial
// moves, and the station card fades once you settle. Each station is one looping file on its own
// clock, so coming back to a station finds it further along, as if it kept broadcasting. PULSE plays
// each stage's own song. A station's file only downloads when you tune to it.
import { rrect } from "./util.js";
export const SETTLE = 0.45;     // seconds on a station before it tunes in
export const SHOW = 2.6;        // seconds the card stays up after the last change

export class Radio {
  constructor(cfg, audio, enabled) {
    this.audio = audio; this.stations = (cfg.radio && cfg.radio.stations) || [];
    this.enabled = enabled && this.stations.length > 1;
    this.i = 0; this.t = 99; this.shown = 99; this.fresh = false;
    try { const j = this.stations.findIndex(s => s.id === localStorage.getItem("rtr.radio")); if (j >= 0) this.i = j; } catch (e) { }
    this.offset = this.stations.map(() => Math.random() * 3600);      // every station is somewhere in its loop when the game starts
    this.dropT = 8; this.dropN = Math.floor(Math.random() * 6); this.dj = null;   // a station's DJ drops (Olivia on Pulse)
  }
  get station() { return this.stations[this.i]; }
  step(dir) {
    if (!this.enabled) return;
    const n = this.stations.length; this.i = (this.i + dir + n) % n; this.t = 0; this.shown = 0; this.fresh = true; this.byTap = true;
    if (this.dj) { this.dj.stop(); this.dj = null; } this.dropT = 7;   // tuning away cuts the DJ off; tuning in hears her soon
    this.audio.radioStatic();
    try { localStorage.setItem("rtr.radio", this.station.id); } catch (e) { }
  }
  show() { if (this.enabled) { this.shown = 0; this.byTap = false; } }   // the card pops up when a drive starts
  update(dt, playing) {
    this.t += dt; this.shown += dt;
    // a DJ cuts in over the song every minute or so, while the van is on the road
    const drops = this.enabled && this.station.drops;
    if (!drops || !playing || this.t < SETTLE + 1) return;
    if (this.dj && this.audio.ctx && this.audio.ctx.currentTime > this.dj.end) this.dj = null;
    if (this.dj || (this.dropT -= dt) > 0) return;
    this.dropT = 55 + Math.random() * 25; const url = drops[this.dropN++ % drops.length];
    this.audio.voice(url).then(h => { if (h && this.station.drops === drops) this.dj = h; else if (h) h.stop(); });
  }
  silence() { if (this.dj) { this.dj.stop(); this.dj = null; } }
  // What should play over the stage songs: { url, seek } (seek: where to start, given the file's
  // length), or null while the dial is still moving. `stageUrl` is the stage's own song.
  pick(stageUrl) {
    if (!this.enabled) return { url: stageUrl, seek: null };
    if (this.t < SETTLE) return null;
    const st = this.station, clock = performance.now() / 1000 + this.offset[this.i];
    const live = (d) => clock % d;
    if (st.url === null) {                                              // PULSE: from the top when a stage starts, mid-song when tuned in
      const seek = this.fresh ? live : null; return { url: stageUrl, seek };
    }
    return { url: st.url || null, seek: live };
  }
}

// ---- station logos: drawn once per station into a small canvas, then scaled
const LOGOS = {};
export function stationLogo(st) {
  if (LOGOS[st.id]) return LOGOS[st.id];
  const S = 128, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
  const badge = (top, bot) => {
    const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, top); g.addColorStop(1, bot);
    x.fillStyle = g; rrect(x, 4, 4, S - 8, S - 8, 26); x.fill();
    x.lineWidth = 5; x.strokeStyle = "rgba(255,255,255,0.85)"; x.stroke();
  };
  const sun = (cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
  x.lineCap = "round"; x.lineJoin = "round";
  switch (st.id) {
    case "pulse":                                                        // a neon heartbeat line
      badge("#0E2E6A", "#040C24");
      x.strokeStyle = "#5CC8FF"; x.lineWidth = 9; x.shadowColor = "#5CC8FF"; x.shadowBlur = 14;
      x.beginPath(); x.moveTo(16, 70); x.lineTo(42, 70); x.lineTo(52, 40); x.lineTo(66, 96); x.lineTo(78, 56); x.lineTo(86, 70); x.lineTo(112, 70); x.stroke();
      break;
    case "bigsky":                                                       // sun over the plains
      badge("#3E86D6", "#F2B54A"); sun(84, 52, 18, "#FFE9A0");
      x.fillStyle = "#3B2A1E"; x.beginPath(); x.moveTo(8, 100); x.lineTo(40, 66); x.lineTo(60, 84); x.lineTo(80, 60); x.lineTo(120, 100); x.lineTo(120, 124); x.lineTo(8, 124); x.fill();
      x.fillStyle = "#6B4A2E"; x.fillRect(8, 98, 112, 22);
      break;
    case "storm":                                                        // a lightning bolt
      badge("#3A2E4E", "#0C0A14");
      x.fillStyle = "#FFFFFF"; x.shadowColor = "#CD2127"; x.shadowBlur = 18;
      x.beginPath(); x.moveTo(74, 14); x.lineTo(36, 70); x.lineTo(60, 70); x.lineTo(48, 114); x.lineTo(94, 52); x.lineTo(68, 52); x.lineTo(84, 14); x.closePath(); x.fill();
      break;
    case "heat": {                                                       // a flame
      badge("#2A0E06", "#0A0402");
      const g = x.createLinearGradient(0, 20, 0, 112); g.addColorStop(0, "#FFE36B"); g.addColorStop(0.55, "#FF7A1A"); g.addColorStop(1, "#D3261B");
      x.fillStyle = g; x.shadowColor = "#FF7A1A"; x.shadowBlur = 16;
      x.beginPath(); x.moveTo(64, 16); x.bezierCurveTo(96, 46, 104, 68, 98, 86); x.bezierCurveTo(92, 106, 76, 114, 64, 114); x.bezierCurveTo(44, 114, 30, 100, 30, 82);
      x.bezierCurveTo(30, 64, 44, 56, 46, 40); x.bezierCurveTo(56, 52, 58, 60, 56, 70); x.bezierCurveTo(66, 58, 70, 40, 64, 16); x.fill();
      break;
    }
    case "isla":                                                         // a palm at sunset
      badge("#FF7E6B", "#1B8F8A"); sun(64, 80, 26, "#FFD86B");
      x.fillStyle = "#0B2B33"; x.fillRect(4, 92, 120, 28);
      x.strokeStyle = "#0B2B33"; x.lineWidth = 7; x.beginPath(); x.moveTo(52, 108); x.quadraticCurveTo(46, 70, 66, 36); x.stroke();
      x.lineWidth = 6; [[-34, 10], [-26, -14], [30, -10], [34, 14], [4, -24]].forEach(([dx, dy]) => { x.beginPath(); x.moveTo(66, 36); x.quadraticCurveTo(66 + dx * 0.5, 36 + dy - 10, 66 + dx, 36 + dy + 8); x.stroke(); });
      break;
    case "sunny":                                                        // a bright sun with rays
      badge("#FF5FA2", "#B5267A");
      x.strokeStyle = "#FFE24A"; x.lineWidth = 8;
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; x.beginPath(); x.moveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34); x.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); x.stroke(); }
      sun(64, 64, 25, "#FFE24A");
      break;
    case "talk":                                                         // a studio microphone
      badge("#0E2E6A", "#071A3F");
      x.strokeStyle = "#ECC444"; x.lineWidth = 6; x.beginPath(); x.arc(64, 56, 28, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
      x.beginPath(); x.moveTo(64, 84); x.lineTo(64, 102); x.moveTo(46, 104); x.lineTo(82, 104); x.stroke();
      x.fillStyle = "#FEFEFE"; rrect(x, 50, 20, 28, 52, 14); x.fill();
      x.strokeStyle = "rgba(14,46,106,0.5)"; x.lineWidth = 3; for (let ly = 32; ly < 64; ly += 8) { x.beginPath(); x.moveTo(54, ly); x.lineTo(74, ly); x.stroke(); }
      break;
    default:                                                             // radio off: a power symbol
      badge("#3B4456", "#1A1F2A");
      x.strokeStyle = "#C9D2E0"; x.lineWidth = 9; x.beginPath(); x.arc(64, 66, 30, -0.32 * Math.PI, 1.32 * Math.PI); x.stroke();
      x.beginPath(); x.moveTo(64, 26); x.lineTo(64, 62); x.stroke();
  }
  return (LOGOS[st.id] = c);
}
