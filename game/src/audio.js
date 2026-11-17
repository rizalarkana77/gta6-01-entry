// SOLMAR HEAT — synthesised sound. One job: every effect and the music loop,
// built from raw WebAudio oscillators. No audio files, no network.
export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    musicTimer: null,
    musicStep: 0,
    enabled: typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext),
  };

  function ensureCtx() {
    if (!audio.enabled) return null;
    if (!audio.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      try {
        audio.ctx = new AC();
      } catch {
        return null;
      }
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    return audio.ctx;
  }

  // One short oscillator blip: the atom every effect is made of.
  function blip(freqStart, freqEnd, duration, type, gain) {
    const ctx = ensureCtx();
    if (!ctx || audio.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // Short filtered noise burst, for crashes and gunshots.
  function noise(duration, gain, cutoff) {
    const ctx = ensureCtx();
    if (!ctx || audio.muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t);
  }

  const SFX = {
    shoot() {
      noise(0.14, 0.5, 2600);
      blip(220, 55, 0.12, 'square', 0.22);
    },
    punch() {
      noise(0.08, 0.35, 900);
      blip(140, 70, 0.09, 'sine', 0.3);
    },
    pickup() {
      blip(660, 660, 0.07, 'sine', 0.25);
      setTimeout(() => blip(990, 990, 0.1, 'sine', 0.25), 70);
    },
    cash() {
      blip(880, 880, 0.08, 'triangle', 0.28);
      setTimeout(() => blip(1174, 1174, 0.08, 'triangle', 0.28), 80);
      setTimeout(() => blip(1568, 1568, 0.14, 'triangle', 0.28), 160);
    },
    crash() {
      noise(0.25, 0.5, 700);
      blip(90, 40, 0.2, 'sawtooth', 0.3);
    },
    door() {
      blip(300, 180, 0.08, 'square', 0.15);
    },
    siren() {
      blip(720, 1080, 0.4, 'sine', 0.12);
    },
    busted() {
      blip(440, 110, 0.7, 'sawtooth', 0.25);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, f, 0.22, 'triangle', 0.3), i * 130));
    },
    click() {
      blip(1200, 900, 0.04, 'square', 0.12);
    },
  };

  audio.play = function play(name) {
    if (audio.muted) return;
    const fn = SFX[name];
    if (fn) fn();
  };

  // Procedural music: a warm bass line with a sparse lead, in A minor.
  // Scheduled step by step so it loops forever without a file.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  const LEAD = [220, 0, 261.63, 0, 329.63, 0, 293.66, 0, 220, 0, 246.94, 0, 196, 0, 246.94, 329.63];
  audio.startMusic = function startMusic() {
    if (audio.musicTimer || !audio.enabled) return;
    audio.musicTimer = setInterval(() => {
      if (audio.muted) return;
      const ctx = ensureCtx();
      if (!ctx) return;
      const step = audio.musicStep++;
      const bass = BASS[step % BASS.length];
      const lead = LEAD[step % LEAD.length];
      const t = ctx.currentTime;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.11, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = bass;
      o.connect(bg).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.45);
      if (lead > 0) {
        const lg = ctx.createGain();
        lg.gain.setValueAtTime(0.05, t);
        lg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        const lo = ctx.createOscillator();
        lo.type = 'sine';
        lo.frequency.value = lead;
        lo.connect(lg).connect(ctx.destination);
        lo.start(t);
        lo.stop(t + 0.42);
      }
    }, 240);
  };

  audio.stopMusic = function stopMusic() {
    if (audio.musicTimer) {
      clearInterval(audio.musicTimer);
      audio.musicTimer = null;
    }
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    return audio.muted;
  };

  return audio;
}
