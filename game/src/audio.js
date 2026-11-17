// Synthesised sound: every effect and the music loop are built from raw
// WebAudio oscillators, so the game ships no audio files and makes no
// network request. Created lazily on the first user gesture (browsers
// require one before audio starts).
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  // Chill sunset bassline: A minor pentatonic, one note per beat.
  const bassNotes = [110, 0, 130.81, 0, 98, 0, 110, 0, 146.83, 0, 130.81, 0, 98, 87.31, 0, 0];
  const leadNotes = [440, 0, 523.25, 0, 659.25, 0, 523.25, 0, 587.33, 0, 0, 659.25, 0, 523.25, 440, 0];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol || 0.2;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f);
      f.connect(g);
    } else {
      src.connect(g);
    }
    g.connect(master);
    src.start(t0);
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    musicTimer = setInterval(() => {
      if (muted) return;
      const b = bassNotes[musicStep % bassNotes.length];
      const l = leadNotes[musicStep % leadNotes.length];
      if (b) tone(b, 0.42, 'triangle', 0.16);
      if (l && musicStep % 2 === 0) tone(l, 0.2, 'sine', 0.05);
      musicStep++;
    }, 300);
  }

  return {
    // Call on the first user gesture (start button / key press).
    unlock() {
      if (ensure()) {
        if (ctx.state === 'suspended') ctx.resume();
        startMusic();
      }
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(880, 0.09, 'square', 0.12, 220);
      noise(0.06, 0.08, 3000);
    },
    punch() {
      noise(0.08, 0.18, 900);
      tone(160, 0.08, 'sine', 0.2, 70);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.14);
      setTimeout(() => tone(990, 0.12, 'sine', 0.14), 70);
    },
    cash() {
      tone(523, 0.1, 'sine', 0.14);
      setTimeout(() => tone(659, 0.1, 'sine', 0.14), 80);
      setTimeout(() => tone(784, 0.16, 'sine', 0.14), 160);
    },
    crash() {
      noise(0.25, 0.3, 700);
      tone(90, 0.25, 'sawtooth', 0.18, 40);
    },
    siren() {
      tone(700, 0.35, 'sine', 0.07, 950);
      setTimeout(() => tone(950, 0.35, 'sine', 0.07, 700), 350);
    },
    door() {
      tone(300, 0.07, 'square', 0.1, 180);
    },
    engine() {
      tone(70, 0.12, 'sawtooth', 0.05, 110);
    },
    mission() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'sine', 0.14), i * 90));
    },
    fail() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'sawtooth', 0.1), i * 130));
    },
    busted() {
      [440, 415, 392, 370].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.12), i * 150));
    },
  };
}
