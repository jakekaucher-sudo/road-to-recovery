// Game core: state machine, driving model, collisions, traffic, weather
// effects, delivery stop, scoring, particles. Fixed 60 Hz update.
import { clamp, lerp, sat, hash2, noise1 } from "./util.js";
import { CONFIG } from "../config.js";
import { buildTrack, findSeg, SEG, ROAD_W } from "./track.js";
import { WEATHER, blendWeather } from "./weather.js";
import { DEFS, HAZ, carWidth } from "./sprites.js";
import { CAM } from "./render.js";
import { INPUT, calibrateGyro, tiltNote, rumble } from "./input.js";
import { getCutscene } from "./cutscenes.js";
import { U2M } from "./three/space.js";
import { RESTORE_DUR } from "./screens.js";
import { Radio } from "./radio.js";
const easeIO = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const VAN_W = 0.24;          // van width in road half-widths
const JUMP_G = 13;           // gravity for jumps (m/s^2): a little stronger than real, so jumps stay arcade-snappy
const DT = 1 / 60;
const RADIO_STATES = new Set(["stageIntro", "drive", "restoring", "results"]);   // where stage music (or the radio) plays

export class Game {
  constructor(cfg, art, renderer, audio, mobile) {
    this.cfg = cfg; this.art = art; this.renderer = renderer; this.audio = audio; this.mobile = mobile;
    this.state = "title"; this.stateT = 0; this.clock = 0; this.paused = false;
    this.restoreP = [0, 0, 0, 0, 0]; this.results = []; this.funds = 0; this.fundsShown = 0;
    this.particles = []; this.messages = []; this.autopilot = false; this.gyroNote = ""; this.events = [];
    this.player = { z: 0, x: 0, y: 0, speed: 0 };
    this.camX = 0; this.camShakeY = 0; this.parallax = 0; this.flash = 0; this.bolt = null; this.nextBolt = 3;
    this.yaw = 0; this.roll = 0; this.hitFx = 0; this.shake = 0; this.windNow = 0;
    this.escort = { ready: false, active: false, t: 0, out: -1, k: 0 }; this.escortEarned = false;
    this.radio = new Radio(cfg, audio, !mobile);
    this.loadStage(0);
  }

  // ------------------------------------------------------------- stages
  loadStage(i, keepTime = false) {
    this.stageIndex = i; this.stageCfg = this.cfg.stages[i];
    if (i === this.cfg.stages.length - 1) { const end = getCutscene(this.cfg.cutscenes.ending); if (end && end.music && this.audio.ctx) this.audio.loadClip(end.music.url).catch(e => console.warn(e)); }   // ending music ready before it is needed
    this.track = buildTrack(this.stageCfg, i, this.cfg);
    this.env = WEATHER[this.stageCfg.weather];
    const prev = i > 0 ? WEATHER[this.cfg.stages[i - 1].weather] : WEATHER.dusk;
    this.envFrom = prev; this.envBlend = 0;
    const P = this.player; P.z = 0; P.x = 0.35; P.speed = 0; P.y = 0; this.jumpReset();
    this.camX = P.x * 0.8; this.parallax = 0; this.delivered = false; this.overshot = false; this.autoStop = false;
    // Phones steer by tilt or touch, which is slower than a keyboard, so they get a little more time,
    // and nobody starts a stage with less than a fair floor (a retry after time-up never carries anything over).
    const base = this.stageTime();
    this.time = Math.max((keepTime ? this.time : 0) + base, base * (this.mobile ? this.cfg.difficulty.minStartFactor : 0)); this.boosts = this.cfg.physics.boostsPerStage; this.boostT = 0; this.boostQueued = false;
    this.crashes = 0; this.stopT = 0; this.messages = []; this.particles = []; this.tornado = null;
    this.restoreP[this.stageCfg.business] = 0;
    // the hidden helicopter escort: earned by running out of time, offered once on the retry
    this.stopEscort(); const E = this.escort; E.ready = this.escortEarned; this.escortEarned = false;
    if (E.ready && this.audio.ctx) Object.values(this.cfg.escort.sfx).forEach(u => this.audio.loadClip(u).catch(() => {}));
    for (const s of this.track.segs) s.cars = [];
    this.movers = []; for (const s of this.track.segs) for (const h of s.hazards) if (h.vx) this.movers.push(h);
    this.updateDerived();
    if (this.onStageLoad) this.onStageLoad(this);
  }

  setState(s) {
    this.state = s; this.stateT = 0;
    if (s === "drive") this.radio.show();                                // the station card pops up as the van pulls away
    if (s === "stageIntro") {
      // the fact at the bottom of the screen gets time to be read (by its length) before the countdown;
      // first visits show the stage's own fact, retries a fresh one each time
      const F = this.cfg.facts; this.factIdx = this.retrying ? 5 + (this.factRot = (this.factRot || 0) + 1) % (F.length - 5) : this.stageCfg.fact;
      const words = F[this.factIdx] ? F[this.factIdx].text.split(" ").length : 0; this.readT = words ? clamp(words / 3.2 + 2.2, 5, 11) : 0;
    }
  }
  randomFact() { const F = this.cfg.facts; return F[Math.floor(Math.random() * F.length)]; }
  stageTime() { const D = this.cfg.difficulty; return this.stageCfg.time * (this.mobile ? D.mobileTimeFactor : 1); }
  // Phones: how much of the wind and curve drift is taken off (the hurricane coast gets the most help).
  mobileAssist() { const D = this.cfg.difficulty; return this.mobile ? (D.mobileAssist[this.stageCfg.weather] ?? D.mobileAssist.default) : 0; }
  msg(text, color, life = 1.4, size = 5, y = 0.3) { this.messages = this.messages.filter(m => m.text !== text); this.messages.push({ text, color, life, t: 0, size, y }); }

  async startFromTitle() {
    // presses that land while the intro music loads (a double tap, a held Enter) must not start the game again
    if (this.starting) return; this.starting = true;
    try {
      this.audio.start();
      const intro = getCutscene(this.cfg.cutscenes.intro);
      if (intro && intro.music) { try { await this.audio.loadClip(intro.music.url); } catch (e) { console.warn(e); } }
      // (tilt permission is requested by the tap itself, in input.js)
      this.results = []; this.funds = 0; this.fundsShown = 0; this.time = 0; this.restoreP = [0, 0, 0, 0, 0];
      this.loadStage(0);
      this.playCutscene(this.cfg.cutscenes.intro, "briefing");
    } finally { this.starting = false; }
  }
  playCutscene(id, fallbackState) {
    const cs = getCutscene(id);
    if (cs) this.startCutscene(cs, fallbackState);
    else this.setState(fallbackState);
  }
  startCutscene(cs, next) {
    this.cutscene = cs; this.cutsceneNext = next; this.setState("cutscene");
    this.audio.setMusic(false);
    if (cs.music) this.audio.playClip(cs.music.url, cs.music);
    cs.onStart && cs.onStart(this);
  }
  endCutscene() {
    const next = this.cutsceneNext; this.audio.stopClip(0.25);
    if (this.cutscene && this.cutscene.onEnd) this.cutscene.onEnd(this);
    this.cutscene = null;
    if (next === "stageIntroDirect" || next === "stageIntro") { this.lastBeep = -1; this.setState("stageIntro"); this.audio.setMusic(true); }
    else if (next === "results") this.finishRestoration();
    else this.setState(next);
  }

  // ------------------------------------------------------------- update
  update() {
    const I = INPUT;
    this.prevZ = this.player.z; this.prevX = this.player.x; this.prevAirY = this.player.airY;   // for smooth rendering between physics steps
    this.gyroNote = tiltNote();
    if (INPUT.notice) { this.msg(INPUT.notice, "#ECC444", 1.8, 3, 0.42); INPUT.notice = null; }
    const gs = INPUT.gyro.status;
    if (gs !== this.lastGyroStatus) {
      if (this.mobile && INPUT.steerMode === "tilt" && ["denied", "silent", "unsupported", "insecure"].includes(gs)) this.msg("TILT UNAVAILABLE HERE: DRAG TO STEER", "#FFB4B4", 2.6, 3, 0.42);
      if (gs === "ok" && this.lastGyroStatus) this.msg("TILT STEERING ON", "#ECC444", 1.6, 3, 0.42);
      this.lastGyroStatus = gs;
    }
    this.clock += DT; this.stateT += DT;
    if (I.mutePressed) this.audio.toggleMute();
    if (I.pausePressed && ["drive", "stageIntro"].includes(this.state)) { this.paused = !this.paused; if (this.paused) this.pauseFact = this.randomFact(); this.audio.pauseMusic(this.paused); this.escortSound(this.paused ? "pause" : "resume"); }
    this.updateMusic();
    if (this.paused) { if (I.confirmPressed && this.mobile) { this.paused = false; this.audio.pauseMusic(false); } return; }
    if (I.radioStep && RADIO_STATES.has(this.state)) this.radio.step(I.radioStep);
    this.radio.update(DT);
    this.messages.forEach(m => m.t += DT); this.messages = this.messages.filter(m => m.t < m.life);
    this.fundsShown = lerp(this.fundsShown, this.funds, 0.08); if (Math.abs(this.fundsShown - this.funds) < 50) this.fundsShown = this.funds;
    const T = this.stateT;
    switch (this.state) {
      case "title": if (I.confirmPressed && T > 0.4) { this.audio.sfxPlay("select"); this.startFromTitle(); } this.audio.engine(0, false, 0); break;
      case "briefing": this.audio.setMusic(true); if (I.confirmPressed && T > 0.8) { this.audio.sfxPlay("select"); this.beginStage(); } break;
      case "cutscene": {
        const cs = this.cutscene;
        if (T >= cs.duration || (cs.skippable && I.confirmPressed && T > 1)) this.endCutscene();
        break;
      }
      case "stageIntro": {
        if (T < this.readT && T > 1.0 && I.confirmPressed) this.readT = T;          // done reading: start the countdown now
        const T2 = T - this.readT, n = Math.floor(T2);
        if (n !== this.lastBeep && T2 > 1.5 && T2 < 4.6) { this.lastBeep = n; this.audio.sfxPlay(T2 > 4 ? "go" : "beep"); }
        this.physics(T2 > 4.0);
        if (T2 > 4.4) { this.retrying = false; this.setState("drive"); if (this.escort.ready) this.msg(this.escortHint(), "#ECC444", 3.2, 3, 0.5); }
        break;
      }
      case "drive": this.physics(true); break;
      case "restoring": {
        this.audio.engine(0, true, 0);
        this.restoreP[this.stageCfg.business] = easeIO(Math.min(1, Math.max(0, (T - 2.6) / 3.6)));
        if (T > 2.6 && T < 6.4 && Math.random() < 0.6) this.events.push({ type: "restore" });
        if (T > 2.6 && !this.restoreSfx) { this.restoreSfx = true; this.audio.sfxPlay("restore"); }
        if (T >= RESTORE_DUR || (I.confirmPressed && T > 1.2)) this.finishRestoration();
        break;
      }
      case "results": if (I.confirmPressed && T > 0.8) { this.audio.sfxPlay("select"); this.nextStage(); } break;
      case "gameover": if (!this.overFact) this.overFact = this.randomFact(); if (I.confirmPressed && T > 0.8) { this.overFact = null; this.escortEarned = true; this.retrying = true; this.loadStage(this.stageIndex); this.time = this.stageTime() * this.cfg.difficulty.retryFactor; this.setState("stageIntro"); this.audio.setMusic(true); } else if (T > 9.5) this.setState("title"); break;
      case "ending": if (I.confirmPressed && T > 4.5) { this.setState("title"); } break;
    }
    // particles
    for (const p of this.particles) { p.t += DT; p.x += p.vx * DT; p.y += p.vy * DT; p.vy += (p.g || 0) * DT; }
    this.particles = this.particles.filter(p => p.t < p.life);
  }

  beginStage() {
    const cs = getCutscene(this.cfg.cutscenes.beforeStage[this.stageIndex]);
    if (cs && this.state !== "cutscene") { this.startCutscene(cs, "stageIntroDirect"); return; }
    this.lastBeep = -1; this.setState("stageIntro"); this.audio.setMusic(true); this.audio.intensity = 0.3 + this.stageIndex * 0.15;
    if (INPUT.steerMode === "tilt" && INPUT.gyro.active) setTimeout(calibrateGyro, 1200);   // re-center while the countdown runs
  }
  nextStage() {
    if (this.stageIndex >= this.cfg.stages.length - 1) { this.playCutscene(this.cfg.cutscenes.ending, "ending"); return; }
    this.loadStage(this.stageIndex + 1, true);
    this.beginStage();
  }
  finishRestoration() {
    const idx = this.stageCfg.business; this.restoreP[idx] = 1;
    if (!this.lastResult) this.lastResult = { timeLeft: this.time, precision: 1, overshot: false, crashes: 0, stars: 3, counted: false };
    if (!this.lastResult.counted) { this.funds += this.cfg.businesses[idx].amount; this.lastResult.counted = true; }
    this.results[this.stageIndex] = this.lastResult;
    this.resultFact = this.randomFact(); this.setState("results");
  }

  updateDerived() {
    const P = this.player, tr = this.track, f = tr.finish;
    const vanZ = P.z + CAM.playerZ;
    this.progress = clamp(vanZ / (f.zoneStart * SEG), 0, 1);
    this.distMiles = Math.max(0, (f.zoneStart * SEG - vanZ) / 160000);
    this.mph = P.speed / this.cfg.physics.maxSpeed * this.cfg.physics.topMph;
  }

  // ------------------------------------------------------------- physics
  physics(controls) {
    const C = this.cfg.physics, P = this.player, tr = this.track, I = INPUT;
    let steer = controls ? I.steer : 0, gas = controls ? I.gas : 0, brake = controls ? I.brake : 0;
    if (this.autopilot && controls) ({ steer, gas, brake } = this.autoDrive());
    if (this.autoStop) { gas = 0; brake = 1; steer = 0; }
    // weather blends in over the first stretch of the stage
    this.envBlend = clamp(this.progress / 0.12, 0, 1);
    const env = this.env = blendWeather(this.envFrom, WEATHER[this.stageCfg.weather], this.envBlend);
    const vanZ = P.z + CAM.playerZ, seg = findSeg(tr, vanZ);
    // boost
    // nitrous: works at any speed; a press during a running boost is kept and fires when it ends
    if (controls && I.boostPressed) { if (this.boosts > 0) this.boostQueued = true; else this.msg("NO BOOSTS LEFT", "#FFB4B4", 0.9, 4, 0.36); }
    if (controls && this.boostQueued && this.boostT <= 0 && this.boosts > 0) { this.boostQueued = false; this.boosts--; this.boostT = C.boostTime; this.audio.sfxPlay("boost"); this.msg("NITROUS!", "#5CC8FF", 0.9, 6, 0.36); rumble(0.35, 260); }
    this.boostT = Math.max(0, this.boostT - DT);
    const boosting = this.boostT > 0 ? 1 : 0;
    // helicopter escort: its downwash holds the weather off (calm 0..1)
    if (controls && I.escortPressed && this.escort.ready && this.state === "drive" && !this.delivered) this.startEscort();
    this.updateEscort(); const calm = this.escort.k;
    const surfaceWater = seg.water, sand = seg.hazards.some(h => h.kind === "sand" && Math.abs(P.x - h.offset) < 0.4);
    let maxSp = boosting ? C.boostSpeed : C.maxSpeed;
    if (surfaceWater > 0) maxSp *= 0.68; if (sand) maxSp *= 0.6;
    const speedK = P.speed / C.maxSpeed;
    // longitudinal
    const air = P.air;                                   // in the air: no grip, so no gas, brake, curve push or wind
    if (air) P.speed -= C.coast * 0.25 * DT;
    else if (gas > 0) P.speed += C.accel * (boosting ? 2.2 : 1) * gas * DT * (1 - 0.45 * clamp(P.speed / maxSp, 0, 1));
    else P.speed -= C.coast * DT;
    if (brake > 0 && !air) P.speed -= C.brake * brake * DT;
    if (P.speed > maxSp) P.speed = Math.max(maxSp, P.speed - C.brake * 0.6 * DT);
    const off = Math.abs(P.x) > 1.05;
    if (off && P.speed > C.offRoadLimit) P.speed -= C.offRoadDecel * DT;
    P.speed = clamp(P.speed, 0, C.boostSpeed);
    // lateral: steering, centrifugal force, wind
    const grip = lerp(env.grip * (surfaceWater > 0 ? 0.7 : 1), 1, calm * 0.8);
    const steerRate = C.steer * (0.3 + 0.7 * Math.min(1, speedK * 1.4)) * (0.7 + 0.3 * grip);
    P.x += steer * steerRate * DT * (P.speed > 50 ? 1 : 0) * (air ? 0.3 : 1);
    const assist = this.mobileAssist();
    if (!air) P.x -= speedK * speedK * seg.curve * C.centrifugal * (1 + (1 - grip) * 0.9) * DT * 1.6 * (1 - assist * 0.6);
    if (Math.abs(steer) < 0.15 && Math.abs(P.x) > 0.82 && Math.abs(P.x) < 1.3) P.x -= Math.sign(P.x) * C.roadKeep * DT * Math.min(1, speedK * 2);   // drifting off the edge: ease back on
    const gustA = env.gust * (noise1(this.clock * 0.6, 4) * 0.8 + (noise1(this.clock * 2.5, 5) > 0.55 ? 0.6 : 0));
    let wind = 0;
    if (this.stageCfg.weather === "hurricane") wind = -env.wind * 0.18 - Math.max(0, gustA) * 0.35;      // sea wind from the right
    else if (this.stageCfg.weather === "tornado") wind = gustA * 0.45 * (this.tornado ? Math.sign(this.tornado.x - 0) || 1 : 1);
    else wind = gustA * 0.15;
    this.windNow = wind * (controls ? 1 : 0) * (1 - assist) * (1 - calm) * (air ? 0 : 1);
    P.x += this.windNow * DT * Math.min(1, speedK * 1.5 + 0.2);
    P.x = clamp(P.x, -2.4, 2.4);
    // advance
    const dz = P.speed * DT; P.z += dz;
    const pseg = findSeg(tr, P.z + CAM.playerZ), nseg = tr.segs[Math.min(tr.N - 1, pseg.i + 1)], pct = ((P.z + CAM.playerZ) % SEG) / SEG;
    P.y = lerp(pseg.y, nseg.y, pct);
    this.updateJumps(controls);
    this.parallax += pseg.curve * (dz / SEG) * 30;
    // bounded "view direction" from the bends just ahead (for sun / tornado placement)
    let ahead = 0; for (let n = 0; n < 40; n++) ahead += tr.segs[Math.min(tr.N - 1, pseg.i + n)].curve;
    this.view = lerp(this.view || 0, ahead * 3, 0.05);
    // camera follows the van laterally with a little lag
    this.camX = lerp(this.camX, P.x * 0.82, 0.12);
    // visual yaw/roll
    const yawT = clamp(steer * 0.6 * Math.min(1, speedK * 2.5) + (1 - grip) * Math.sin(this.clock * 7) * 0.12 * speedK, -1, 1);
    this.yaw = lerp(this.yaw, yawT, 0.14); this.roll = lerp(this.roll, -this.yaw * 0.035 - seg.curve * 0.004 * speedK, 0.1);
    this.hitFx = Math.max(0, this.hitFx - DT * 3); this.shake = Math.max(0, this.shake - DT * 2.5);
    const roadRumble = (off ? 3 : 0.4) * speedK + env.gust * Math.abs(gustA) * 2;
    this.camShakeY = (Math.sin(this.clock * 50) * roadRumble + (Math.random() - 0.5) * this.shake * 14);
    // collisions
    if ((controls || this.state === "stageIntro") && !(P.air && P.airY > 1)) this.collide(pseg, nseg, off);
    // traffic
    this.updateTraffic();
    // effects: spray, dust, lightning, tornado
    this.effects(env, surfaceWater, off, speedK, boosting);
    // timer
    if (this.state === "drive" && !this.delivered) {
      this.time -= DT;
      if (this.time <= 0) { this.time = 0; this.timeUp(); }
    }
    this.checkDelivery();
    this.updateDerived();
    this.audio.engine(Math.min(1.3, speedK), true, boosting);
  }

  collide(seg, nseg, off) {
    const P = this.player, C = this.cfg.physics;
    for (const s of [seg, nseg]) {
      // roadside objects (only reachable off-road)
      if (off) for (const sp of s.sprites) {
        const d = DEFS[sp.kind]; if (!d || !d.hit) continue;
        if (Math.abs(P.x - sp.offset) < (VAN_W + d.hit) / 2 + 0.02) { this.crash(0.25, Math.sign(P.x) * -0.25); break; }
      }
      for (const hz of s.hazards) {
        if (hz.hit) continue; const d = HAZ[hz.kind]; if (!d || d.fx === "none") continue;
        if (Math.abs(P.x - hz.offset) < (VAN_W + d.w) / 2 * 0.85) {
          if (d.fx === "crash") { hz.hit = true; this.crash(C.crashSlow, (P.x - hz.offset) > 0 ? 0.12 : -0.12); this.msg("DEBRIS!", "#CD2127", 0.8, 5, 0.36); }
          else if (d.fx === "bump") { hz.hit = true; P.speed *= 0.8; this.shake = 0.5; this.audio.sfxPlay("bump"); }
          else if (d.fx === "water" && !hz.hit) { hz.hit = true; P.speed *= 0.9; this.splash(1.2); }
        }
      }
      for (const p of s.pickups) {
        if (!p.got && Math.abs(P.x - p.offset) < (VAN_W + 0.2) / 2) { p.got = true; this.time += p.bonus; this.audio.sfxPlay("pickup"); this.msg("+" + p.bonus + " SEC", "#ECC444", 1.0, 6, 0.36); this.events.push({ type: "pickup" }); }
      }
    }
    // traffic
    for (const car of this.track.cars) {
      const dzc = car.z - (P.z + CAM.playerZ);
      if (dzc > -60 && dzc < 260 && P.speed > car.speed && Math.abs(P.x - car.offset) < (VAN_W + carWidth(car)) / 2 * 0.9) {
        P.speed = car.speed * 0.55; car.z += 400; car.hit = 1; this.crash(1, (P.x - car.offset) > 0 ? 0.18 : -0.18, true);
        this.msg("WATCH THE TRAFFIC!", "#CD2127", 1.0, 4, 0.36);
      }
    }
  }
  updateMusic() {
    const M = this.cfg.music; if (!M || !this.audio.ctx) return;
    let url = null, seek = null;
    if (["title", "briefing", "ending"].includes(this.state)) url = M.menu;
    else if (RADIO_STATES.has(this.state)) {                            // the stage's song, or the desktop radio station (null while tuning)
      const p = this.radio.pick(M.stages[this.stageIndex % M.stages.length]); if (p) { url = p.url; seek = p.seek; }
    }
    if (url !== this.audio.musicUrl) { this.audio.playMusic(url, M.volume, seek); if (url) this.radio.fresh = false; }
  }
  crash(mult, push, already) {
    rumble(Math.min(1, 0.35 + mult * 0.5), 140 + mult * 160);
    const P = this.player;
    if (!already) P.speed *= mult;
    P.x += push; this.crashes++; this.hitFx = 1; this.shake = 1.2;
    this.audio.sfxPlay("crash");
    this.events.push({ type: "sparks" });
  }
  burst(x, y, rgb, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 420; this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, g: 900, t: 0, life: 0.4 + Math.random() * 0.4, rgb, size: 2 + Math.random() * 3 }); } }
  splash(k) { this.events.push({ type: "splash" }); this.audio.sfxPlay("splash"); }

  effects(env, water, off, speedK, boosting) {
    if (water > 0 && !this.inWater && speedK > 0.15) this.splash(0.8);
    this.inWater = water > 0;
    for (const h of this.movers) { if (h.hit) continue; h.offset += h.vx * DT * 0.6; if (Math.abs(h.offset) > 1.05) { h.vx = -h.vx; h.offset = Math.sign(h.offset) * 1.05; } }
    // lightning schedule
    this.flash = Math.max(0, this.flash - DT * 3.5);
    if (env.lightning * (1 - this.escort.k) > 0.05) {
      this.nextBolt -= DT;
      if (this.nextBolt <= 0) { this.flash = 1; this.bolt = { seed: (Math.random() * 1e6) | 0, t: 0 }; this.nextBolt = 1.5 + Math.random() * 6 / env.lightning; setTimeout(() => this.audio.ctx && this.audio.noiseHit(this.audio.ctx.currentTime, 1.4, 0.35, "lowpass", 220, this.audio.sfx), 300); }
    }
    if (this.bolt) { this.bolt.t += DT; if (this.bolt.t > 0.3) this.bolt = null; }
    // tornado: off to the left early, crossing toward the road and growing
    if (this.stageCfg.weather === "tornado") {
      const p = this.progress;
      this.tornado = { k: env.tornado * clamp((p - 0.04) / 0.1, 0, 1) * (1 - 0.85 * this.escort.k), x: lerp(-0.75, 0.55, clamp((p - 0.1) / 0.8, 0, 1)), s: lerp(0.55, 1.3, clamp(p / 0.85, 0, 1)) };
      if (p > 0.1 && !this.tornadoWarned) { this.tornadoWarned = true; this.msg("TORNADO WARNING", "#CD2127", 2.2, 6, 0.42); }
    } else this.tornado = null;
    if (this.stageCfg.weather === "hurricane" && this.progress > 0.08 && !this.hurrWarned) { this.hurrWarned = true; this.msg("HURRICANE WINDS FROM THE SEA", "#CD2127", 2.2, 4, 0.42); }
  }

  updateTraffic() {
    const P = this.player, tr = this.track, vanZ = P.z + CAM.playerZ, limit = (tr.finish.zoneStart - 20) * SEG, front = this.escortFront();
    for (const s of tr.segs) if (s.cars.length) s.cars.length = 0;
    for (const car of tr.cars) {
      car.z += car.speed * DT;
      car.offset = car.lane0 + Math.sin(this.clock * 0.5 + car.seed) * 0.28 * car.swerve;
      car.braking = car.swerve > 0 && Math.sin(this.clock * 0.5 + car.seed) > 0.85;
      // the escort's downwash pushes cars out to the shoulder, away from the van's path
      if (front > 0 && car.z > vanZ - 30 / U2M && car.z < front) car.blow = Math.min(1, (car.blow || 0) + DT * 1.3);
      if (car.blow) { const side = car.lane0 > 0.1 ? 1 : car.lane0 < -0.1 ? -1 : (hash2(car.seed, 9) > 0.5 ? 1 : -1), k = car.blow * car.blow * (3 - 2 * car.blow); car.offset = lerp(car.offset, side * 1.8, k); car.braking = car.blow < 1; }
      // recycle cars that fall far behind or reach the stop, keeping traffic ahead
      if (car.z < vanZ - 3000 || car.z > limit) {
        const nz = vanZ + (150 + hash2(car.seed, Math.floor(this.clock)) * 70) * SEG;
        if (car.parked) { car.parked = false; car.speed = car.speed0; }
        if (nz < limit - 4000) { car.z = nz; car.blow = 0; car.lane0 = [-0.62, 0, 0.62][Math.floor(hash2(car.seed, Math.floor(this.clock) + 5) * 3)]; }
        else car.z = -1e9;
      }
      for (const j of tr.jumps) {
        // the bridge is up: traffic pulls onto the shoulder and waits at the gate
        if (j.kind === "drawbridge" && !car.parked && car.z > (j.up0 - 40) * SEG && car.z < j.span1 * SEG) { car.parked = true; car.parkK = 0; car.speed0 = car.speed; car.parkSide = car.lane0 >= 0 ? 1 : -1; }
        // a car in the carrier's lane changes lanes well before reaching it
        if (j.kind === "carrier" && car.lane0 > 0.3 && car.z > (j.i0 - 120) * SEG && car.z < (j.end + 4) * SEG) car.laneGoal = 0;
      }
      if (car.laneGoal !== undefined) { car.lane0 += (car.laneGoal - car.lane0) * Math.min(1, DT * 1.4); if (Math.abs(car.laneGoal - car.lane0) < 0.01) { car.lane0 = car.laneGoal; car.laneGoal = undefined; } }
      if (car.parked) { car.speed = Math.max(0, car.speed - 4000 * DT); car.parkK = Math.min(1, car.parkK + DT * 0.7); const k = car.parkK * car.parkK * (3 - 2 * car.parkK); car.offset = lerp(car.offset, car.parkSide * 1.3, k); car.braking = true; }
      if (car.z > 0) { const s = findSeg(tr, car.z); s.cars.push(car); }
    }
  }

  checkDelivery() {
    if (this.delivered || this.state !== "drive") return;
    const P = this.player, f = this.track.finish, vanZ = P.z + CAM.playerZ;
    const z0 = f.zoneStart * SEG, z1 = f.zoneEnd * SEG;
    if (vanZ > z0 - 40 * SEG && vanZ < z0 && !this.zoneHint) { this.zoneHint = true; this.msg("BRAKE! STOP IN THE GOLD ZONE", "#ECC444", 2.0, 4, 0.42); }
    const inZone = vanZ >= z0 && vanZ <= z1;
    if (inZone && this.mph < this.cfg.physics.stopMph && P.x > -0.35 && P.x < 1.1) {
      this.stopT += DT;
      if (this.stopT > 0.25) this.deliver(1 - Math.abs((vanZ - (z0 + z1) / 2) / ((z1 - z0) / 2)), false);
    } else this.stopT = 0;
    if (vanZ > z1 && !this.autoStop) { this.autoStop = true; this.overshot = true; this.msg("OVERSHOT! BACKING UP", "#CD2127", 1.6, 5, 0.36); }
    if (this.autoStop && P.speed < 60) this.deliver(0, true);
  }
  deliver(precision, overshot) {
    this.stopEscort(); this.delivered = true; this.zoneHint = false; this.tornadoWarned = false; this.hurrWarned = false;
    const st = this.stageCfg, tl = this.time;
    let stars = tl > st.time * 0.35 ? 3 : tl > st.time * 0.15 ? 2 : 1;
    if (overshot || precision < 0.25) stars = Math.max(1, stars - 1);
    if (this.crashes > 6) stars = Math.max(1, stars - 1);
    this.lastResult = { timeLeft: tl, precision: Math.max(0, precision), overshot, crashes: this.crashes, stars, counted: false };
    this.audio.sfxPlay("deliver"); this.restoreSfx = false; this.autoStop = false;
    this.player.speed = 0;
    const cs = getCutscene(this.cfg.cutscenes.arrival[this.stageIndex]);
    if (cs) this.startCutscene(cs, "results");
    else this.setState("restoring");
  }
  timeUp() { this.stopEscort(); this.audio.sfxPlay("timeup"); this.audio.setMusic(false); this.setState("gameover"); }

  // ------------------------------------------------------------- jumps: drawbridge (stage 1), car carrier (stage 2)
  jumpReset() { const P = this.player; Object.assign(P, { air: false, airY: 0, vy: 0, hAbs: 0, onRamp: null, airT: 0, assisted: false, lastPart: null, pitch: 0, jump: null }); this.jumpsDone = new Set(); this.carrierHit = 0; }
  launch(h, vy, j) { const P = this.player; Object.assign(P, { air: true, hAbs: h, lipY: h, vy, airT: 0, assisted: false, jump: j, onRamp: null }); this.events.push({ type: "launch" }); }
  updateJumps(controls) {
    const P = this.player, tr = this.track, J = tr.jumps; if (!J || !J.length) return;
    const vz = P.z + CAM.playerZ, v = P.speed * U2M, roadY = P.y * U2M, s = findSeg(tr, vz);
    if (P.air) {
      P.vy -= JUMP_G * DT; P.hAbs += P.vy * DT; P.airT += DT;
      const inGap = s.bridge && s.bridge.part === "gap";
      if (inGap && P.hAbs < P.lipY - 0.25) { P.hAbs = P.lipY - 0.25; P.vy = Math.max(P.vy, 0.5); P.assisted = true; }   // never into the river: the far leaf catches the van
      if (!inGap && P.hAbs <= roadY) this.land(-P.vy);
      else { P.airY = P.hAbs - roadY; P.pitch = clamp(Math.atan2(P.vy, Math.max(8, v)) * 0.7, -0.35, 0.3); }
      P.lastPart = s.bridge ? s.bridge.part : null;
      return;
    }
    P.airY = 0; P.pitch = 0;
    for (const j of J) {
      if (j.kind !== "carrier") continue;
      const z0 = j.i0 * SEG, zEnd = j.end * SEG;
      if (vz < z0 - SEG || vz > zEnd) { if (P.onRamp === j) P.onRamp = null; continue; }
      const dx = P.x - j.lane, d = (vz - z0) * U2M, rampL = j.ramp * SEG * U2M, deckL = j.deck * SEG * U2M, kickL = 3;
      if (P.onRamp !== j && d < 1.5 && d > -1 && Math.abs(dx) < 0.2) P.onRamp = j;          // lined up with the ramp: drive on
      if (P.onRamp === j) {
        P.x = j.lane + clamp(dx, -0.08, 0.08);
        if (d >= rampL + deckL) { this.launch(roadY + j.H + j.kick, v * Math.sin(Math.atan2(j.kick, kickL)) + 2.2, j); P.airY = j.H + j.kick; return; }
        const onKick = clamp((d - (rampL + deckL - kickL)) / kickL, 0, 1);
        P.airY = d < rampL ? j.H * Math.max(0, d) / rampL : j.H + j.kick * onKick;
        P.pitch = d < rampL ? Math.atan2(j.H, rampL) : onKick > 0 ? Math.atan2(j.kick, kickL) : 0;
      } else if (Math.abs(dx) < 0.3 && d > 0 && this.clock > this.carrierHit) {                // clipped its side
        this.carrierHit = this.clock + 1; this.crash(this.cfg.physics.crashSlow, dx > 0 ? 0.2 : -0.2); this.msg("LINE UP WITH THE RAMP!", "#CD2127", 1.2, 4, 0.36);
      }
    }
    // the drawbridge: leaving the near leaf launches the van over the gap
    if (s.bridge && s.bridge.part === "gap" && P.lastPart === "up") {
      const j = J.find(q => q.kind === "drawbridge");
      this.launch((j.deckY + j.H) * U2M, v * Math.sin(j.angle) * 1.05, j);
      P.airY = P.hAbs - roadY;                                             // already up at the lip on this frame (no one-frame drop to the deck)
    }
    P.lastPart = s.bridge ? s.bridge.part : null;
  }
  land(impact) {
    const P = this.player, j = P.jump; P.air = false; P.airY = 0; P.vy = 0; P.pitch = 0;
    rumble(Math.min(1, 0.3 + impact / 20), 220); this.events.push({ type: "land", impact });
    // too slow to clear the gap (the far leaf caught the van): that is the rough landing
    if (P.assisted) { P.speed *= 0.6; this.shake = 1.1; this.hitFx = 0.6; this.audio.sfxPlay("crash"); this.msg("ROUGH LANDING!", "#FFB4B4", 1.2, 5, 0.36); return; }
    // a long nitrous jump comes down hard: a bigger jolt and a little speed, never a penalty for going fast
    const hard = impact > 19; this.shake = hard ? 0.9 : 0.5; if (hard) P.speed *= 0.9; this.audio.sfxPlay("bump");
    if (P.airT > 0.5 && !this.jumpsDone.has(j)) { this.jumpsDone.add(j); this.time += 2; this.audio.sfxPlay("pickup"); this.msg("BIG AIR! +2 SEC", "#ECC444", 1.5, 6, 0.36); }
    else this.msg("NICE JUMP!", "#ECC444", 1.0, 5, 0.36);
  }

  // ------------------------------------------------------------- helicopter escort
  escortHint() { return INPUT.pad.connected ? "HELICOPTER ESCORT READY: PRESS B" : this.mobile ? "HELICOPTER ESCORT READY: TAP THE HELICOPTER" : "HELICOPTER ESCORT READY: PRESS 1"; }
  startEscort() {
    const E = this.escort; E.ready = false; E.active = true; E.t = 0; E.out = -1; E.loop = null; E.loopOn = false;
    this.messages = this.messages.filter(m => !m.text.startsWith("HELICOPTER ESCORT READY"));
    rumble(0.45, 500); this.escortSound("start");
  }
  updateEscort() {
    const E = this.escort, D = this.cfg.escort.duration;
    if (E.active) {
      E.t += DT;
      if (E.t > 3.3 && !E.loopOn) this.escortSound("loop");
      if (E.t >= D) { E.active = false; E.out = 0; this.escortSound("end"); }
      // debris ahead is blown off the road as the downwash sweeps forward
      const vanZ = this.player.z + CAM.playerZ, front = this.escortFront(), tr = this.track;
      for (let i = Math.max(0, Math.floor(vanZ / SEG)); i < Math.min(tr.N, front / SEG); i++)
        for (const hz of tr.segs[i].hazards) { const d = HAZ[hz.kind]; if (!hz.hit && d && (d.fx === "crash" || d.fx === "bump")) { hz.hit = true; hz.blown = true; } }
    } else if (E.out >= 0) { E.out += DT; if (E.out > 4) E.out = -1; }
    E.k = E.active ? sat(E.t / 1.6) * (1 - sat((E.t - (D - 1.2)) / 1.2)) : 0;
  }
  // how far ahead (track units) the downwash has reached; -1 when there is no escort
  escortFront() { const E = this.escort; return E.active && E.t > 0.6 ? this.player.z + CAM.playerZ + this.cfg.escort.reach / U2M * sat((E.t - 0.6) / 1.4) : -1; }
  escortSound(what) {
    const A = this.audio, S = this.cfg.escort.sfx, E = this.escort; if (!A.ctx) return;
    if (what === "start") { A.sample(S.radio, { gain: 0.9 }); A.sample(S.pass, { gain: 1.0, delay: 0.15 }); }
    else if (what === "loop" || (what === "resume" && E.active && E.loopOn)) { E.loopOn = true; A.sample(S.loop, { loop: true, gain: 0.55, fadeIn: what === "loop" ? 1.2 : 0.3 }).then(h => { if (E.active && !this.paused) E.loop = h; else if (h) h.stop(0.2); }); }
    else if ((what === "end" || what === "pause" || what === "stop") && E.loop) { E.loop.stop(what === "end" ? 3 : 0.2); E.loop = null; }
  }
  stopEscort() { const E = this.escort; if (!E) return; this.escortSound("stop"); E.active = false; E.ready = false; E.out = -1; E.k = 0; E.loopOn = false; }

  // ------------------------------------------------------------- autopilot (testing / attract)
  autoDrive() {
    const P = this.player, tr = this.track, vanZ = P.z + CAM.playerZ, f = tr.finish, C = this.cfg.physics;
    let target = 0.0;
    // look ahead for hazards and cars in our lane
    const lanes = [-0.62, 0, 0.62]; let best = 0, bestScore = -1e9;
    for (const L of lanes) {
      let score = -Math.abs(L - P.x) * 0.6;
      for (let n = 1; n < 40; n++) {
        const s = tr.segs[Math.floor(vanZ / SEG) + n]; if (!s) break;
        for (const h of s.hazards) if (!h.hit && HAZ[h.kind] && HAZ[h.kind].fx !== "none" && HAZ[h.kind].fx !== "water" && Math.abs(L - h.offset) < 0.5) score -= 10 / n;
        for (const c of s.cars) if (Math.abs(L - c.offset) < 0.45) score -= 12 / n;
        for (const j of tr.jumps) if (j.kind === "carrier" && s.i >= j.i0 - 10 && s.i <= j.end && Math.abs(L - j.lane) < 0.45) score -= 20 / n;
        for (const p of s.pickups) if (!p.got && Math.abs(L - p.offset) < 0.2) score += 2 / n;
      }
      if (score > bestScore) { bestScore = score; best = L; }
    }
    target = best;
    const zoneMid = (f.zoneStart + f.zoneEnd) / 2 * SEG;
    const toZone = zoneMid - vanZ;
    if (toZone < 90 * SEG) target = 0.5;
    const seg = findSeg(tr, vanZ);
    let steer = clamp((target - P.x) * 3 + seg.curve * 0.12 * P.speed / C.maxSpeed, -1, 1);
    steer -= this.windNow * 1.4;
    let gas = 1, brake = 0;
    const stopDist = P.speed * P.speed / (2 * C.brake) + 600;
    if (toZone < stopDist) { gas = 0; brake = 1; }
    if (toZone < 0 && toZone > -2000) { gas = 0; brake = 1; }
    if (this.boosts > 0 && Math.abs(seg.curve) < 0.5 && toZone > 60 * SEG && P.speed > C.maxSpeed * 0.8 && Math.random() < 0.01) INPUT.boostPressed = true;
    return { steer: clamp(steer, -1, 1), gas, brake };
  }
}
