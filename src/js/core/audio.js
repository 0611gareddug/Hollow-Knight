// Web Audio 기반 효과음 + 절차적 배경음악 (외부 파일 없음)
import { settings } from './settings.js';
import { rand, pick } from './util.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.track = null;
    this.trackName = null;
    this.heartbeat = false;
    this.hbTimer = 0;
    this.lastPlay = {};
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    // 리미터 역할의 컴프레서
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.sfxGain = ctx.createGain();
    this.musicGain = ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);

    // 리버브 (노이즈 임펄스)
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.2, 2.6);
    this.revGain = ctx.createGain();
    this.revGain.gain.value = 0.55;
    this.reverb.connect(this.revGain);
    this.revGain.connect(this.master);

    // 노이즈 버퍼
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.applyVolume();
    this.ready = true;
    this._schedTimer = setInterval(() => this._schedule(), 90);
    if (this.pendingTrack) this.music(this.pendingTrack);
  }

  _impulse(sec, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  applyVolume() {
    if (!this.ctx) return;
    this.sfxGain.gain.value = settings.sfx;
    this.musicGain.gain.value = settings.music * 0.55;
  }

  // ---------- 저수준 빌딩 블록 ----------
  _env(g, t, a, peak, dcy, sus = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dcy);
  }
  osc(type, f0, f1, dur, vol, { delay = 0, rev = 0, attack = 0.005, out } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this._env(g, t, attack, vol, dur);
    o.connect(g);
    g.connect(out || this.sfxGain);
    if (rev) {
      const rg = ctx.createGain();
      rg.gain.value = rev;
      g.connect(rg);
      rg.connect(this.reverb);
    }
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }
  nz(filterType, f0, f1, dur, vol, { delay = 0, q = 1, rev = 0, attack = 0.003, out } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = rand(0.8, 1.2);
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this._env(g, t, attack, vol, dur);
    s.connect(f);
    f.connect(g);
    g.connect(out || this.sfxGain);
    if (rev) {
      const rg = ctx.createGain();
      rg.gain.value = rev;
      g.connect(rg);
      rg.connect(this.reverb);
    }
    s.start(t, Math.random() * 0.5);
    s.stop(t + attack + dur + 0.05);
  }
  bell(f, dur, vol, delay = 0, rev = 0.5) {
    const parts = [1, 2.01, 2.76, 4.07, 5.4];
    parts.forEach((p, i) => this.osc('sine', f * p, f * p, dur / (1 + i * 0.6), vol / (1 + i * 1.3), { delay, rev, attack: 0.002 }));
  }

  // ---------- 효과음 ----------
  play(name, opt = {}) {
    if (!this.ready) return;
    // 같은 소리가 한 프레임에 겹쳐 폭주하지 않도록
    const now = this.ctx.currentTime;
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.025) return;
    this.lastPlay[name] = now;
    const v = opt.vol == null ? 1 : opt.vol;
    const p = rand(0.94, 1.06) * (opt.pitch || 1);
    switch (name) {
      case 'slash':
        this.nz('bandpass', 3800 * p, 900 * p, 0.13, 0.32 * v, { q: 1.4 });
        this.osc('triangle', 2400 * p, 1900 * p, 0.06, 0.035 * v);
        break;
      case 'hit':
        this.osc('sine', 170 * p, 55, 0.14, 0.55 * v);
        this.nz('highpass', 2500, 2500, 0.05, 0.3 * v);
        this.osc('square', 950 * p, 700, 0.05, 0.05 * v);
        break;
      case 'clank':
        this.osc('square', 1250 * p, 1200, 0.09, 0.09 * v, { rev: 0.3 });
        this.osc('square', 1870 * p, 1800, 0.07, 0.06 * v);
        this.nz('highpass', 4000, 4000, 0.06, 0.25 * v);
        break;
      case 'kill':
        this.osc('sine', 220 * p, 40, 0.3, 0.55 * v);
        this.nz('lowpass', 2400, 200, 0.4, 0.4 * v, { rev: 0.3 });
        this.osc('triangle', 600 * p, 1400, 0.08, 0.08 * v);
        break;
      case 'hurt':
        this.osc('sine', 110, 35, 0.6, 0.8 * v, { rev: 0.4 });
        this.nz('lowpass', 1800, 120, 0.5, 0.45 * v);
        for (let i = 0; i < 6; i++) this.nz('bandpass', rand(3000, 7000), rand(2500, 6000), 0.08, 0.16 * v, { delay: 0.05 + i * 0.035, q: 6, rev: 0.4 });
        break;
      case 'jump':
        this.nz('bandpass', 700 * p, 1500 * p, 0.12, 0.12 * v, { q: 0.8 });
        break;
      case 'djump':
        this.nz('bandpass', 1200, 2600, 0.18, 0.14 * v, { q: 0.8 });
        this.osc('sine', 880 * p, 1320 * p, 0.25, 0.05 * v, { rev: 0.5 });
        break;
      case 'walljump':
        this.nz('bandpass', 900, 1800, 0.1, 0.13 * v);
        this.nz('highpass', 3000, 3000, 0.03, 0.1 * v);
        break;
      case 'land':
        this.osc('sine', 120 * p, 50, 0.07, 0.25 * v);
        this.nz('lowpass', 600, 200, 0.06, 0.12 * v);
        break;
      case 'step':
        this.nz('bandpass', 1400 * p, 900, 0.035, 0.05 * v, { q: 2 });
        break;
      case 'dash':
        this.nz('bandpass', 500, 3000, 0.22, 0.26 * v, { q: 1.2 });
        this.osc('sawtooth', 120, 60, 0.15, 0.05 * v);
        break;
      case 'focus':
        return this._focusLoop(v);
      case 'heal':
        [72, 76, 79, 84].forEach((m, i) => this.bell(mtof(m), 1.4, 0.07 * v, i * 0.05, 0.6));
        this.osc('sine', 300, 900, 0.3, 0.12 * v, { rev: 0.5 });
        break;
      case 'amber':
        this.osc('sine', 1568 * p, 1568, 0.08, 0.08 * v);
        this.osc('sine', 2093 * p, 2093, 0.12, 0.07 * v, { delay: 0.05, rev: 0.3 });
        break;
      case 'shard':
      case 'ability':
        [67, 71, 74, 79, 83, 86].forEach((m, i) => this.bell(mtof(m - (name === 'ability' ? 5 : 0)), 2.5, 0.09 * v, i * 0.09, 0.8));
        this.osc('sine', 98, 98, 2.0, 0.2 * v, { rev: 0.6, attack: 0.3 });
        break;
      case 'bench':
        [57, 64, 69, 72, 76].forEach((m, i) => this.bell(mtof(m), 3, 0.06 * v, i * 0.12, 0.8));
        break;
      case 'gate':
        this.osc('sine', 70, 30, 0.8, 0.9 * v, { rev: 0.5 });
        this.nz('lowpass', 900, 80, 0.7, 0.6 * v, { rev: 0.5 });
        break;
      case 'roar':
        this.osc('sawtooth', 90, 55, 1.4, 0.25 * v, { rev: 0.6, attack: 0.08 });
        this.osc('sawtooth', 93, 52, 1.4, 0.2 * v, { attack: 0.1 });
        this.nz('bandpass', 400, 200, 1.3, 0.5 * v, { q: 0.7, rev: 0.6, attack: 0.1 });
        break;
      case 'bossHit':
        this.osc('sine', 130 * p, 40, 0.2, 0.6 * v);
        this.nz('bandpass', 1800, 700, 0.1, 0.35 * v, { q: 1 });
        break;
      case 'bell':
        this.bell(mtof(pick([45, 47, 50])) * p, 3.5, 0.32 * v, 0, 0.9);
        this.osc('sine', 55, 55, 2, 0.3 * v, { rev: 0.5 });
        break;
      case 'boom':
        this.osc('sine', 90, 30, 0.6, 0.7 * v, { rev: 0.4 });
        this.nz('lowpass', 2000, 100, 0.6, 0.55 * v, { rev: 0.4 });
        break;
      case 'shoot':
        this.osc('triangle', 700 * p, 300, 0.15, 0.12 * v);
        this.nz('bandpass', 1500, 600, 0.1, 0.1 * v);
        break;
      case 'teleport':
        this.nz('bandpass', 300, 4000, 0.3, 0.2 * v, { q: 3, rev: 0.4 });
        this.osc('sine', 200, 1200, 0.3, 0.06 * v, { rev: 0.5 });
        break;
      case 'splash':
        this.nz('lowpass', 2500, 300, 0.3, 0.3 * v, { rev: 0.2 });
        this.osc('sine', 500, 150, 0.15, 0.1 * v);
        break;
      case 'swing':
        this.nz('bandpass', 400 * p, 1600 * p, 0.25, 0.3 * v, { q: 0.9 });
        break;
      case 'charge':
        this.osc('sawtooth', 200, 800, 0.8, 0.07 * v, { attack: 0.3, rev: 0.4 });
        this.nz('bandpass', 500, 3000, 0.8, 0.12 * v, { q: 4, attack: 0.4 });
        break;
      case 'flash':
        this.nz('highpass', 3000, 8000, 0.35, 0.35 * v, { rev: 0.6 });
        this.osc('sine', 1800, 300, 0.4, 0.12 * v, { rev: 0.7 });
        break;
      case 'break':
        this.nz('lowpass', 3000, 200, 0.5, 0.6 * v, { rev: 0.3 });
        this.osc('sine', 140, 40, 0.4, 0.5 * v);
        break;
      case 'crack':
        this.nz('highpass', 1500, 1500, 0.08, 0.35 * v);
        this.osc('sine', 160, 60, 0.12, 0.35 * v);
        break;
      case 'hookFire':
        // 사슬이 풀려나가는 금속성 소리
        this.nz('bandpass', 2400, 5200, 0.12, 0.18 * v, { q: 3 });
        for (let i = 0; i < 4; i++) this.osc('square', 1800 + i * 260, 1700 + i * 260, 0.025, 0.025 * v, { delay: i * 0.022 });
        break;
      case 'hookHit':
        this.osc('triangle', 1100 * p, 900, 0.08, 0.12 * v, { rev: 0.3 });
        this.nz('highpass', 3000, 3000, 0.05, 0.25 * v);
        this.osc('sine', 180, 80, 0.12, 0.25 * v);
        break;
      case 'ui':
        this.osc('sine', 880 * (opt.pitch || 1), 880 * (opt.pitch || 1), 0.06, 0.06 * v);
        break;
      case 'uiOk':
        this.osc('sine', 660, 660, 0.08, 0.07 * v);
        this.osc('sine', 990, 990, 0.12, 0.07 * v, { delay: 0.06, rev: 0.3 });
        break;
      case 'beep':
        this.osc('square', 660, 660, 0.12, 0.06 * v);
        break;
      case 'go':
        this.osc('square', 1320, 1320, 0.35, 0.07 * v, { rev: 0.4 });
        break;
      case 'revive':
        [60, 64, 67, 72].forEach((m, i) => this.bell(mtof(m + 12), 1.8, 0.06 * v, i * 0.07, 0.7));
        break;
      case 'cocoon':
        this.osc('sine', 300, 80, 0.8, 0.2 * v, { rev: 0.6 });
        break;
      case 'heart':
        this.osc('sine', 60, 40, 0.14, 0.45 * v);
        this.osc('sine', 55, 38, 0.14, 0.3 * v, { delay: 0.2 });
        break;
      case 'victory':
        [57, 60, 64, 69, 72, 76, 81].forEach((m, i) => this.bell(mtof(m), 4, 0.08 * v, i * 0.14, 0.9));
        break;
    }
  }

  _focusLoop(v) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(220, t);
    o.frequency.linearRampToValueAtTime(660, t + 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * v, t + 0.3);
    const rg = ctx.createGain();
    rg.gain.value = 0.6;
    o.connect(g);
    g.connect(this.sfxGain);
    g.connect(rg);
    rg.connect(this.reverb);
    o.start(t);
    return {
      stop: () => {
        const n = ctx.currentTime;
        g.gain.cancelScheduledValues(n);
        g.gain.setValueAtTime(g.gain.value, n);
        g.gain.exponentialRampToValueAtTime(0.0001, n + 0.08);
        o.stop(n + 0.1);
      },
    };
  }

  // ---------- 배경음악 ----------
  music(name) {
    if (!this.ready) {
      this.pendingTrack = name;
      return;
    }
    if (this.trackName === name) return;
    this.trackName = name;
    if (this.track) {
      const old = this.track;
      const n = this.ctx.currentTime;
      old.gain.gain.cancelScheduledValues(n);
      old.gain.gain.setValueAtTime(old.gain.gain.value, n);
      old.gain.gain.linearRampToValueAtTime(0, n + 1.5);
      old.dead = true;
      setTimeout(() => old.gain.disconnect(), 2000);
    }
    const def = TRACKS[name];
    if (!def) {
      this.track = null;
      return;
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 2);
    gain.connect(this.musicGain);
    const send = this.ctx.createGain();
    send.gain.value = def.rev == null ? 0.7 : def.rev;
    gain.connect(send);
    send.connect(this.reverb);
    this.track = { def, gain, step: 0, next: this.ctx.currentTime + 0.1, dead: false };
  }

  setHeartbeat(on) {
    this.heartbeat = on;
  }

  _schedule() {
    if (!this.ready) return;
    const ctx = this.ctx;
    // 심장 박동 (체력 1칸)
    if (this.heartbeat) {
      if (ctx.currentTime > this.hbTimer) {
        this.play('heart', { vol: 0.8 });
        this.hbTimer = ctx.currentTime + 1.0;
      }
    }
    const tr = this.track;
    if (!tr || tr.dead) return;
    const d = tr.def;
    const stepDur = 60 / d.bpm / 2; // 8분음표
    while (tr.next < ctx.currentTime + 0.35) {
      this._step(tr, tr.step, tr.next, stepDur);
      tr.step++;
      tr.next += stepDur;
    }
  }

  _note(out, type, freq, t, dur, vol, { attack = 0.01, release = 0.3, cutoff = 0, detune = 0 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    let node = o;
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + release + 0.05);
  }

  _step(tr, step, t, sd) {
    const d = tr.def;
    const out = tr.gain;
    const stepsPerBar = 8;
    const bar = Math.floor(step / stepsPerBar);
    const s = step % stepsPerBar;
    const chord = d.chords[bar % d.chords.length];
    const barDur = sd * stepsPerBar;

    if (s === 0) {
      // 패드
      if (d.pad) {
        for (const m of chord) {
          this._note(out, 'sawtooth', mtof(m), t, barDur, d.pad, { attack: barDur * 0.35, release: barDur * 0.5, cutoff: d.padCut || 900, detune: -7 });
          this._note(out, 'sawtooth', mtof(m), t, barDur, d.pad, { attack: barDur * 0.35, release: barDur * 0.5, cutoff: d.padCut || 900, detune: 7 });
        }
      }
      // 베이스
      if (d.bass) this._note(out, 'sine', mtof(chord[0] - 12), t, barDur * 0.95, d.bass, { attack: 0.05, release: 0.4 });
      // 바람 소리 (3장): 띠통과 노이즈가 한 마디 동안 부풀었다 잦아듦
      if (d.wind && this.noise) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 1.4;
        f.frequency.setValueAtTime(380 + Math.random() * 200, t);
        f.frequency.linearRampToValueAtTime(700 + Math.random() * 500, t + barDur * 0.5);
        f.frequency.linearRampToValueAtTime(320, t + barDur * 1.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(d.wind, t + barDur * 0.5);
        g.gain.linearRampToValueAtTime(0.0001, t + barDur * 1.2);
        src.connect(f);
        f.connect(g);
        g.connect(out);
        src.start(t);
        src.stop(t + barDur * 1.25);
      }
    }
    // 종소리 (얼음 결정이 부딪히는 듯한 높은 사인파)
    if (d.chime && Math.random() < d.chime[s]) {
      const m = pick(chord) + 36;
      this._note(out, 'sine', mtof(m), t, 0.05, d.chimeVol || 0.03, { attack: 0.002, release: 1.6 });
      this._note(out, 'sine', mtof(m) * 2.76, t, 0.03, (d.chimeVol || 0.03) * 0.3, { attack: 0.002, release: 0.6 });
    }
    // 아르페지오 (하프 같은 뜯는 소리)
    if (d.arp && Math.random() < d.arpProb[s]) {
      const pool = chord.concat(chord.map((m) => m + 12));
      const m = pick(pool) + (d.arpOct || 12);
      this._note(out, 'triangle', mtof(m), t, sd * 0.4, d.arp, { attack: 0.004, release: d.arpRel || 1.2 });
    }
    // 오스티나토 (보스전 현악)
    if (d.ost) {
      const m = chord[d.ostPat[s] % chord.length] + (d.ostPat[s] >= chord.length ? 12 : 0);
      this._note(out, 'sawtooth', mtof(m), t, sd * 0.45, d.ost, { attack: 0.005, release: 0.08, cutoff: 1800 });
    }
    // 북
    if (d.drum && d.drum[s]) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
      g.gain.setValueAtTime(d.drumVol * d.drum[s], t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.4);
    }
    if (d.hat && d.hat[s]) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(d.hat[s] * 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(t, Math.random() * 0.5);
      src.stop(t + 0.06);
    }
  }
}

// 곡 정의: chords는 MIDI 노트 배열 (한 마디 = 8분음표 8개)
const TRACKS = {
  title: {
    bpm: 54, pad: 0.022, padCut: 700, bass: 0.06, arp: 0.05, arpRel: 2,
    arpProb: [0.7, 0, 0.3, 0, 0.5, 0, 0.25, 0.1],
    chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],
  },
  zone1: {
    bpm: 58, pad: 0.02, padCut: 650, bass: 0.055, arp: 0.045, arpRel: 1.8,
    arpProb: [0.6, 0.05, 0.35, 0.05, 0.45, 0.05, 0.3, 0.15],
    chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52], [50, 53, 57], [48, 52, 55], [46, 50, 53], [45, 49, 52]],
  },
  zone2: {
    bpm: 50, pad: 0.022, padCut: 550, bass: 0.05, arp: 0.05, arpRel: 2.4, arpOct: 24,
    arpProb: [0.5, 0.1, 0.2, 0.25, 0.4, 0.1, 0.2, 0.2],
    chords: [[52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]],
    rev: 0.95,
  },
  zone3: {
    bpm: 46, pad: 0.024, padCut: 500, bass: 0.065, arp: 0.04, arpRel: 2.5,
    arpProb: [0.55, 0, 0.15, 0, 0.35, 0, 0.15, 0.1],
    chords: [[49, 52, 56], [50, 54, 57], [47, 50, 54], [49, 52, 55]],
  },
  zone5: {
    bpm: 72, pad: 0.018, padCut: 600, bass: 0.07, arp: 0.04, arpRel: 1.0,
    arpProb: [0.7, 0.1, 0.4, 0.1, 0.6, 0.1, 0.4, 0.2],
    drum: [0.5, 0, 0, 0.3, 0.5, 0, 0.3, 0], drumVol: 0.35, hat: [0, 0.4, 0, 0.4, 0, 0.4, 0, 0.6],
    chords: [[45, 48, 52], [41, 45, 48], [43, 47, 50], [40, 44, 47]],
    rev: 0.6,
  },
  zone6: {
    bpm: 60, pad: 0.02, padCut: 1400, bass: 0.04, arp: 0.05, arpRel: 2.2, arpOct: 24,
    arpProb: [0.8, 0.2, 0.5, 0.2, 0.7, 0.2, 0.5, 0.3],
    chords: [[53, 57, 60, 64], [55, 59, 62, 66], [52, 55, 59, 62], [50, 54, 57, 60]],
    rev: 0.95,
  },
  zone7: {
    bpm: 44, pad: 0.026, padCut: 450, bass: 0.08, arp: 0.035, arpRel: 2.8,
    arpProb: [0.45, 0, 0.1, 0, 0.3, 0, 0.1, 0.1],
    drum: [0.6, 0, 0, 0, 0, 0, 0, 0], drumVol: 0.4,
    chords: [[40, 41, 47], [40, 43, 46], [38, 41, 45], [40, 41, 44]],
  },
  // 3장: 얼어붙은 변경 – 느린 단조, 높은 종소리, 바람
  zone8: {
    bpm: 52, pad: 0.018, padCut: 900, bass: 0.05, arp: 0.035, arpRel: 2.4, arpOct: 24, wind: 0.05,
    arpProb: [0.5, 0, 0.2, 0.1, 0.4, 0, 0.2, 0.1],
    chime: [0.3, 0, 0.1, 0, 0.2, 0, 0.15, 0], chimeVol: 0.028,
    chords: [[50, 53, 57, 60], [46, 50, 53, 57], [48, 51, 55, 58], [45, 48, 52, 55]],
    rev: 0.9,
  },
  zone9: {
    bpm: 48, pad: 0.022, padCut: 700, bass: 0.045, arp: 0.045, arpRel: 3, arpOct: 24,
    arpProb: [0.6, 0.1, 0.3, 0.2, 0.5, 0.1, 0.3, 0.2],
    chime: [0.2, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1], chimeVol: 0.022,
    chords: [[52, 55, 59, 62], [48, 52, 55, 59], [50, 53, 57, 60], [47, 50, 54, 57]],
    rev: 1,
  },
  zone10: {
    bpm: 64, pad: 0.02, padCut: 600, bass: 0.075, arp: 0.03, arpRel: 1.4, wind: 0.09,
    arpProb: [0.5, 0, 0.3, 0, 0.5, 0, 0.3, 0.2],
    drum: [0.5, 0, 0, 0, 0.3, 0, 0, 0], drumVol: 0.35,
    chords: [[45, 48, 52], [46, 50, 53], [43, 46, 50], [44, 47, 51]],
    rev: 0.8,
  },
  // 등불 마을 – 따뜻한 장조
  village: {
    bpm: 66, pad: 0.016, padCut: 1200, bass: 0.045, arp: 0.05, arpRel: 1.6,
    arpProb: [0.9, 0.2, 0.6, 0.2, 0.8, 0.2, 0.6, 0.4],
    chime: [0.15, 0, 0, 0, 0.1, 0, 0, 0], chimeVol: 0.02,
    chords: [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 58]],
    rev: 0.7,
  },
  boss: {
    bpm: 150, pad: 0.012, padCut: 900, bass: 0.08, ost: 0.03,
    ostPat: [0, 1, 2, 1, 0, 1, 3, 1],
    drum: [1, 0, 0, 0.6, 1, 0, 0.6, 0], drumVol: 0.5, hat: [0, 1, 0, 1, 0, 1, 0, 1],
    chords: [[45, 48, 52], [45, 48, 52], [41, 45, 48], [40, 44, 47]],
    rev: 0.35,
  },
  final: {
    bpm: 160, pad: 0.014, padCut: 1100, bass: 0.09, ost: 0.032, arp: 0.03, arpRel: 0.6,
    arpProb: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
    ostPat: [0, 2, 1, 2, 0, 3, 1, 3],
    drum: [1, 0, 0.5, 0, 1, 0.4, 0.6, 0.3], drumVol: 0.55, hat: [1, 0.5, 1, 0.5, 1, 0.5, 1, 1],
    chords: [[49, 52, 56], [50, 53, 57], [47, 50, 54], [48, 52, 56]],
    rev: 0.4,
  },
  scarlet: {
    bpm: 168, pad: 0.01, bass: 0.07, ost: 0.03, arp: 0.035, arpRel: 0.4,
    arpProb: [0.8, 0.2, 0.6, 0.2, 0.8, 0.2, 0.6, 0.4],
    ostPat: [0, 1, 2, 3, 2, 1, 0, 3],
    drum: [1, 0, 0, 1, 0, 0, 1, 0], drumVol: 0.45, hat: [1, 0, 1, 1, 1, 0, 1, 1],
    chords: [[48, 51, 55], [44, 48, 51], [46, 50, 53], [43, 47, 50]],
    rev: 0.4,
  },
  race: {
    bpm: 132, pad: 0.012, bass: 0.07, arp: 0.04, arpRel: 0.5,
    arpProb: [1, 0.2, 0.7, 0.2, 1, 0.2, 0.7, 0.5],
    drum: [1, 0, 0, 0, 1, 0, 0, 0.5], drumVol: 0.4, hat: [0, 1, 0, 1, 0, 1, 0, 1],
    chords: [[50, 53, 57], [53, 57, 60], [48, 52, 55], [46, 50, 53]],
    rev: 0.4,
  },
  ending: {
    bpm: 48, pad: 0.024, padCut: 900, bass: 0.05, arp: 0.055, arpRel: 2.6,
    arpProb: [0.8, 0, 0.4, 0, 0.6, 0, 0.4, 0.2],
    chords: [[50, 54, 57], [47, 50, 54], [43, 47, 50], [45, 49, 52]],
  },
};

export const audio = new Audio();
