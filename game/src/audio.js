// SOLMAR HEAT — synthesised sound. No audio files: every effect is an
// oscillator or filtered noise burst built in WebAudio, and the music is a
// small procedural bass + lead loop. Everything no-ops until the player
// first interacts (browsers block audio before a gesture) and when muted.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  // Call from the first user gesture; also resumes a suspended context.
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') void ctx.resume();
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, type) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  const sfx = {
    shoot() {
      noise(0.09, 0.4, 3200, 'highpass');
      tone(190, 0.09, 'square', 0.22, 55);
    },
    punch() {
      noise(0.08, 0.3, 500);
      tone(120, 0.08, 'sine', 0.25, 60);
    },
    hit() {
      tone(90, 0.12, 'sawtooth', 0.2, 45);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.22);
      setTimeout(() => tone(990, 0.12, 'sine', 0.22), 70);
    },
    cash() {
      tone(880, 0.08, 'triangle', 0.22);
      setTimeout(() => tone(1174, 0.08, 'triangle', 0.22), 80);
      setTimeout(() => tone(1568, 0.16, 'triangle', 0.22), 160);
    },
    crash() {
      noise(0.28, 0.5, 700);
      tone(70, 0.25, 'sawtooth', 0.3, 35);
    },
    door() {
      noise(0.06, 0.2, 900);
      tone(220, 0.06, 'square', 0.12, 160);
    },
    denied() {
      tone(160, 0.14, 'square', 0.18, 110);
    },
    mission() {
      tone(523, 0.12, 'triangle', 0.25);
      setTimeout(() => tone(659, 0.12, 'triangle', 0.25), 110);
      setTimeout(() => tone(784, 0.22, 'triangle', 0.25), 220);
    },
    busted() {
      tone(392, 0.3, 'sawtooth', 0.22, 196);
      setTimeout(() => tone(311, 0.5, 'sawtooth', 0.22, 155), 280);
    },
    wasted() {
      tone(220, 0.5, 'sawtooth', 0.22, 55);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) =>
        setTimeout(() => tone(f, 0.25, 'triangle', 0.25), i * 130),
      );
    },
  };

  // Engine hum follows the player's speed; call every frame.
  function setEngine(speed01) {
    if (!ensure() || muted) {
      if (engineGain) engineGain.gain.value = 0;
      return;
    }
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      engineOsc.connect(f);
      f.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    }
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
    engineGain.gain.setTargetAtTime(speed01 > 0.03 ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
  }

  // Two-tone police siren while wanted; call every frame.
  function setSiren(on) {
    if (!ensure() || muted) {
      if (sirenGain) sirenGain.gain.value = 0;
      return;
    }
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 750;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 220;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
    }
    sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
  }

  // Procedural loop: a driving bass line (A minor) with a sparse lead.
  // 8th notes at 112 BPM, scheduled a bar ahead.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 61.74, 0];
  const LEAD = [220, 0, 261.63, 0, 0, 329.63, 0, 0, 392, 0, 329.63, 0, 261.63, 0, 196, 0];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    const stepDur = 60 / 112 / 2;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const bass = BASS[musicStep % BASS.length];
      const lead = LEAD[musicStep % LEAD.length];
      if (bass) tone(bass, stepDur * 0.9, 'triangle', 0.16);
      if (lead && musicStep % 4 === 0) tone(lead, stepDur * 1.8, 'sine', 0.07);
      musicStep++;
    }, stepDur * 1000);
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
    return muted;
  }

  return { unlock, sfx, setEngine, setSiren, startMusic, setMuted, isMuted: () => muted };
}
