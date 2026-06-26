// mulberry32 — PRNG 32 bits, pur JS, sans effet de bord
export function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return function rng() {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

// Dérive une seed déterministe par tick à partir de la seed globale.
// Permet de régénérer n'importe quel tick indépendamment des autres.
export function deriveSeed(globalSeed: number, tick: number): number {
  return (globalSeed * 1664525 + 1013904223 + tick * 22695477) >>> 0
}
