import { describe, it, expect } from 'vitest'
import { makeRng, deriveSeed } from '../rng'

describe('makeRng', () => {
  it('retourne des valeurs dans [0, 1[', () => {
    const rng = makeRng(42)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('produit une séquence identique pour la même seed', () => {
    const a = makeRng(12345)
    const b = makeRng(12345)
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b())
    }
  })

  it('produit des séquences différentes pour des seeds différentes', () => {
    const a = makeRng(1)
    const b = makeRng(2)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('la séquence varie au fil des appels (pas de valeur constante)', () => {
    const rng = makeRng(99)
    const vals = new Set(Array.from({ length: 20 }, () => rng()))
    expect(vals.size).toBeGreaterThan(1)
  })
})

describe('deriveSeed', () => {
  it('est déterministe', () => {
    expect(deriveSeed(100, 5)).toBe(deriveSeed(100, 5))
  })

  it('produit des valeurs différentes pour des ticks différents', () => {
    expect(deriveSeed(100, 0)).not.toBe(deriveSeed(100, 1))
    expect(deriveSeed(100, 1)).not.toBe(deriveSeed(100, 2))
  })

  it('produit des valeurs différentes pour des seeds globales différentes', () => {
    expect(deriveSeed(1, 5)).not.toBe(deriveSeed(2, 5))
  })

  it('retourne un entier 32-bit non signé', () => {
    const s = deriveSeed(999, 42)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThan(2 ** 32)
    expect(Number.isInteger(s)).toBe(true)
  })
})
