// Procedural synthwave soundtrack, engine and effects with the Web Audio API.
// No audio files. Starts on the first user gesture (browser autoplay rules).
const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
// A minor: Am - F - C - G, one chord per bar
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];

export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.intensity = 0.4; this.step = 0; this.nextTime = 0; this.bpm = 104; this.playing = false; }
  start() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = 0.33; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.6; this.sfx.connect(this.master);
    // feedback delay for the arp
    this.delay = ctx.createDelay(1); this.delay.delayTime.value = 60 / this.bpm * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.32; const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 2400;
    this.delay.connect(dlp); dlp.connect(fb); fb.connect(this.delay); dlp.connect(this.music);
    // noise buffer
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    // engine
    this.eng = ctx.createGain(); this.eng.gain.value = 0; this.eng.connect(this.sfx);
    this.engF = ctx.createBiquadFilter(); this.engF.type = "lowpass"; this.engF.frequency.value = 600; this.engF.connect(this.eng);
    this.o1 = ctx.createOscillator(); this.o1.type = "sawtooth"; this.o2 = ctx.createOscillator(); this.o2.type = "square";
    const g2 = ctx.createGain(); g2.gain.value = 0.4; this.o1.connect(this.engF); this.o2.connect(g2); g2.connect(this.engF);
    this.o1.start(); this.o2.start();
    this.nextTime = ctx.currentTime + 0.1;
  }
  // Recorded music clips (cutscenes): decoded once, played with fades.
  async loadClip(url) {
    this.clips = this.clips || {};
    if (this.clips[url]) return this.clips[url];
    const buf = await (await fetch(url)).arrayBuffer();
    this.clips[url] = await this.ctx.decodeAudioData(buf);
    return this.clips[url];
  }
  async playClip(url, o = {}) {
    if (!this.ctx) return;
    this.stopClip(0.05);
    try {
      const buf = await this.loadClip(url), t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = buf; src.connect(g); g.connect(this.master);
      const dur = buf.duration;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + (o.fadeIn || 0.05));
      g.gain.setValueAtTime(0.9, t + Math.max(0.1, dur - (o.fadeOut || 0.5))); g.gain.linearRampToValueAtTime(0, t + dur);
      src.start(t); this.clip = { src, g };
    } catch (e) { console.warn("music clip failed", e); }
  }
  stopClip(fade = 0.3) {
    if (!this.clip || !this.ctx) return; const { src, g } = this.clip, t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade); src.stop(t + fade + 0.05); this.clip = null;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05); }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }
  setMusic(on) { /* procedural loop retired; licensed tracks via playMusic() */ }
  playMusic(url, volume = 0.55) {
    if (!this.ctx || this.musicUrl === url) return;
    this.musicUrl = url;
    if (!this.mel) {
      this.mel = document.createElement("audio"); this.mel.loop = true; this.mel.preload = "auto"; this.mel.setAttribute("playsinline", "");
      this.mgain = this.ctx.createGain(); this.mgain.gain.value = 0; this.ctx.createMediaElementSource(this.mel).connect(this.mgain); this.mgain.connect(this.master);
    }
    const t = this.ctx.currentTime, g = this.mgain.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.35);
    clearTimeout(this._mt);
    this._mt = setTimeout(() => {
      if (!url) { this.mel.pause(); return; }
      this.mel.src = url; this.mel.currentTime = 0;
      const p = this.mel.play(); if (p && p.catch) p.catch(() => {});
      const t2 = this.ctx.currentTime; g.cancelScheduledValues(t2); g.setValueAtTime(0, t2); g.linearRampToValueAtTime(volume, t2 + 0.8);
    }, url ? 380 : 360);
  }
  pauseMusic(p) { if (this.mel) { if (p) this.mel.pause(); else if (this.musicUrl) this.mel.play().catch(() => {}); } }
  engine(speedK, on, boost) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, f = 38 + speedK * 95 + boost * 30;
    this.o1.frequency.setTargetAtTime(f, t, 0.05); this.o2.frequency.setTargetAtTime(f * 0.5 + 1.5, t, 0.05);
    this.engF.frequency.setTargetAtTime(400 + speedK * 1400 + boost * 800, t, 0.05);
    this.eng.gain.setTargetAtTime(on ? 0.07 + speedK * 0.06 : 0, t, 0.08);
  }
  // ---- music scheduler (call every frame) ---------------------------------
  update() {
    if (!this.ctx || !this.playing) return;
    const spb = 60 / this.bpm / 4; // seconds per 16th
    while (this.nextTime < this.ctx.currentTime + 0.12) { this.playStep(this.step, this.nextTime); this.step = (this.step + 1) % 64; this.nextTime += spb; }
  }
  playStep(s, t) {
    const bar = Math.floor(s / 16), chord = CHORDS[bar % 4], i = this.intensity;
    if (s % 2 === 0) this.tone("sawtooth", NOTE(chord[0] - 24 + (s % 4 === 2 ? 12 : 0)), t, 0.12, 0.22, 300 + 500 * i, this.music);      // bass
    const arp = [chord[0], chord[1], chord[2], chord[1] + 12][s % 4] + 12;
    this.tone("square", NOTE(arp), t, 0.09, 0.05 + 0.03 * i, 1600 + 1600 * i, this.music, true);                                          // arp
    if (s % 16 === 0) chord.forEach(n => this.tone("sawtooth", NOTE(n), t, 60 / this.bpm * 4 * 0.95, 0.035, 900, this.music, false, 0.4)); // pad
    if (s % 4 === 0) this.kick(t);
    if (s % 8 === 4) this.snare(t);
    if (s % 2 === 1 || i > 0.6) this.hat(t, s % 2 ? 0.05 : 0.025);
  }
  tone(type, freq, t, dur, vol, cutoff, dest, toDelay, attack = 0.005) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = type; o.frequency.value = freq; f.type = "lowpass"; f.frequency.value = cutoff;
    if (type === "sawtooth" && attack > 0.1) { const o2 = c.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = freq * 1.006; o2.connect(f); o2.start(t); o2.stop(t + dur + 0.3); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(f); f.connect(g); g.connect(dest); if (toDelay) g.connect(this.delay);
    o.start(t); o.stop(t + dur + 0.35);
  }
  kick(t) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.3); }
  noiseHit(t, dur, vol, type, freq, dest) { const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(dest || this.music); s.start(t); s.stop(t + dur + 0.05); }
  snare(t) { this.noiseHit(t, 0.28, 0.22, "bandpass", 1800); this.tone("triangle", 190, t, 0.12, 0.12, 2000, this.music); }
  hat(t, v) { this.noiseHit(t, 0.04, v, "highpass", 7000); }
  // ---- effects ----------------------------------------------------------------
  sfxPlay(name) {
    if (!this.ctx) return; const t = this.ctx.currentTime, S = this.sfx;
    switch (name) {
      case "crash": this.noiseHit(t, 0.45, 0.6, "lowpass", 900, S); this.tone("square", 70, t, 0.3, 0.25, 400, S); break;
      case "bump": this.noiseHit(t, 0.15, 0.3, "lowpass", 600, S); break;
      case "splash": this.noiseHit(t, 0.5, 0.35, "bandpass", 1200, S); break;
      case "pickup": [76, 81, 88].forEach((n, k) => this.tone("square", NOTE(n), t + k * 0.06, 0.12, 0.12, 4000, S)); break;
      case "boost": { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.6); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.connect(g); g.connect(S); o.start(t); o.stop(t + 0.75); this.noiseHit(t, 0.8, 0.2, "highpass", 2000, S); break; }
      case "beep": this.tone("square", 880, t, 0.12, 0.15, 3000, S); break;
      case "go": this.tone("square", 1320, t, 0.4, 0.18, 4000, S); break;
      case "deliver": [69, 73, 76, 81, 85, 88].forEach((n, k) => this.tone("square", NOTE(n), t + k * 0.07, 0.25, 0.1, 4500, S, true)); break;
      case "restore": [81, 85, 88, 93].forEach((n, k) => this.tone("sawtooth", NOTE(n), t + k * 0.12, 0.6, 0.06, 3000, S, true, 0.05)); break;
      case "timeup": [64, 60, 57, 52].forEach((n, k) => this.tone("square", NOTE(n), t + k * 0.18, 0.3, 0.14, 2000, S)); break;
      case "select": this.tone("square", 660, t, 0.08, 0.12, 3000, S); break;
    }
  }
}
