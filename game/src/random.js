// SOLMAR HEAT — a small seeded random number generator.
// mulberry32: tiny, fast, and fully deterministic for a given seed, which is
// what the ?seed= URL parameter and the reproducible screenshots need.

export class RNG {
  constructor(seed) {
    // Normalise any input into a 32-bit unsigned state.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  // Next float in [0, 1).
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Integer in [min, max] inclusive.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // True with probability p (0..1).
  chance(p) {
    return this.next() < p;
  }

  // One random element of an array.
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  // In-place Fisher-Yates shuffle, returns the same array.
  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }
}
