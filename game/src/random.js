// Seeded RNG (mulberry32). Deterministic: the same seed always deals the
// same city, traffic and pedestrians, so screenshots and replays agree.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an element from an array with the seeded RNG.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Integer in [min, max] with the seeded RNG.
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Float in [min, max) with the seeded RNG.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}
