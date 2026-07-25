// Make a run deterministic by replacing Math.random with a seeded PRNG
// (mulberry32). The engine uses Math.random for schedule generation and dice
// rolls; seeding it identically at record and replay time makes every prompt —
// and therefore every cassette lookup — reproduce exactly. Returns a restore fn.
export function installSeededRandom(seed: number): () => void {
  const original = Math.random;
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    Math.random = original;
  };
}
