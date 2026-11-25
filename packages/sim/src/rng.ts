/**
 * Seeded random numbers for the simulation (sfc32). All state lives in four
 * 32-bit words so it can be hashed and replayed exactly on any machine.
 */
export class Rng {
  readonly s = new Uint32Array(4);

  constructor(seed: number) {
    // splitmix32 expands one seed into four state words.
    let z = seed >>> 0;
    for (let i = 0; i < 4; i++) {
      z = (z + 0x9e3779b9) >>> 0;
      let t = z ^ (z >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t ^= t >>> 15;
      t = Math.imul(t, 0x735a2d97);
      t ^= t >>> 15;
      this.s[i] = t >>> 0;
    }
    this.s[3] |= 1;
    for (let i = 0; i < 12; i++) this.u32();
  }

  u32(): number {
    const s = this.s;
    const t = (((s[0] + s[1]) >>> 0) + s[3]) >>> 0;
    s[3] = (s[3] + 1) >>> 0;
    s[0] = s[1] ^ (s[1] >>> 9);
    s[1] = (s[2] + (s[2] << 3)) >>> 0;
    s[2] = ((s[2] << 21) | (s[2] >>> 11)) >>> 0;
    s[2] = (s[2] + t) >>> 0;
    return t;
  }

  /** Uniform in [0, 1). */
  float(): number {
    return this.u32() / 4294967296;
  }

  /** Uniform in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.float();
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.float() * n);
  }
}
