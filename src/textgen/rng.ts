// Seeded pseudo-random numbers (mulberry32), so generated lessons are reproducible in tests.

export type Rng = () => number;

/** Returns a function giving numbers in [0, 1), the same sequence for the same seed. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max]. */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pick from an empty list');
  return item;
}

/** Like pick, but favours the start of the list (the most frequent words). */
export function pickSkewed<T>(rng: Rng, items: readonly T[]): T {
  const r = rng();
  const item = items[Math.floor(items.length * r * r)];
  if (item === undefined) throw new Error('pick from an empty list');
  return item;
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}
