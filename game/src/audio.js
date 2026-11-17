// SOLMAR HEAT — synthesised sound. Every effect is built from raw
// oscillators and filtered noise through WebAudio, so the game ships no audio
// files at all. All methods are safe no-ops until the audio context exists
// (it is created on the first user gesture, as browsers require), which also
// keeps headless Node runs silent instead of crashing.

const MUSIC_BASS = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 55, 0, 73.42, 65.41, 49, 49];
const MUSIC_LEAD = [220, 0, 261.63, 329.63, 0, 392, 329.63, 0, 220, 0, 261.63, 0, 329.63, 392, 440, 0];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._musicTimer = null;
    this._musicStep = 0;
    this._engine = null;
    this._siren = null;
  }

  // Call from a user gesture (click / keypress). Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = typeof AudioContext !== 'undefined' ? AudioContext : null;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  _tone(freq, dur, type, vol, slideTo, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol, lowpass = 1200) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  // Named effects. The world pushes event names; the main loop calls play().
  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'shoot':
        this._noise(0.09, 0.5, 3200);
        this._tone(190, 0.08, 'square', 0.22, 60);
        break;
      case 'punch':
        this._noise(0.08, 0.35, 700);
        break;
      case 'pickup':
        this._tone(660, 0.09, 'sine', 0.2);
        this._tone(990, 0.12, 'sine', 0.2, null, 0.08);
        break;
      case 'cash':
        this._tone(880, 0.1, 'triangle', 0.22);
        this._tone(1174, 0.1, 'triangle', 0.22, null, 0.09);
        this._tone(1568, 0.16, 'triangle', 0.22, null, 0.18);
        break;
      case 'crash':
        this._noise(0.28, 0.55, 900);
        this._tone(70, 0.22, 'sawtooth', 0.25, 38);
        break;
      case 'door':
        this._tone(140, 0.07, 'square', 0.16, 90);
        this._noise(0.05, 0.15, 1500);
        break;
      case 'siren':
        this._tone(750, 0.16, 'sine', 0.1, 950);
        break;
      case 'explosion':
        this._noise(0.7, 0.7, 500);
        this._tone(55, 0.6, 'sawtooth', 0.3, 28);
        break;
      case 'busted':
        this._tone(392, 0.22, 'square', 0.18);
        this._tone(311, 0.35, 'square', 0.18, null, 0.2);
        break;
      case 'mission':
        this._tone(523, 0.12, 'triangle', 0.22);
        this._tone(659, 0.12, 'triangle', 0.22, null, 0.11);
        this._tone(784, 0.22, 'triangle', 0.22, null, 0.22);
        break;
      default:
        break;
    }
  }

  // A slow two-tone siren that follows the player while wanted.
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this._siren) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 750;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      lfo.start();
      this._siren = { osc, lfo, gain };
    } else if (!on && this._siren) {
      try {
        this._siren.osc.stop();
        this._siren.lfo.stop();
      } catch {
        // Already stopped.
      }
      this._siren = null;
    }
  }

  // Engine hum whose pitch follows the player's speed.
  setEngine(speed, maxSpeed) {
    if (!this.ctx) return;
    if (speed < 5) {
      if (this._engine) {
        try {
          this._engine.osc.stop();
        } catch {
          // Already stopped.
        }
        this._engine = null;
      }
      return;
    }
    if (!this._engine) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.04;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start();
      this._engine = { osc, gain };
    }
    this._engine.osc.frequency.value = 55 + (speed / maxSpeed) * 165;
    this._engine.gain.gain.value = 0.03 + (speed / maxSpeed) * 0.035;
  }

  // A lazy 16-step bass + lead loop, scheduled a step at a time.
  startMusic() {
    if (!this.ctx || this._musicTimer) return;
    this._musicStep = 0;
    this._musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const step = this._musicStep % 16;
      const bass = MUSIC_BASS[step];
      if (bass) this._tone(bass, 0.2, 'triangle', 0.16);
      const lead = MUSIC_LEAD[step];
      if (lead && this._musicStep % 32 >= 16) this._tone(lead, 0.18, 'square', 0.045);
      this._musicStep++;
    }, 210);
  }

  stopMusic() {
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
    this.setSiren(false);
    this.setEngine(0, 1);
  }
}
