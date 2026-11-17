// SOLMAR HEAT — small seeded RNG (mulberry32) plus helpers.
// Everything random in the game flows from one seed so `?seed=` replays the
// same city, traffic and pedestrians every time.

export function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngRange(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function rngInt(rng, lo, hi) {
  // Integer in [lo, hi).
  return lo + Math.floor(rng() * (hi - lo));
}

export function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Fisher-Yates shuffle, in place, driven by the seeded rng.
export function rngShuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// A stable 32-bit hash of a short string, for deriving sub-seeds.
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
