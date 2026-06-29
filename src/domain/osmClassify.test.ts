import { describe, it, expect } from 'vitest'
import { classify, distribution } from './osmClassify'
import { TerrainType, type Feature } from './types'

function feat(tags: Record<string, string>): Feature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { tags },
  }
}

describe('classify', () => {
  it('mappe un tag exact connu vers son TerrainType', () => {
    expect(classify(feat({ natural: 'water' }))).toBe(TerrainType.WATER)
    expect(classify(feat({ landuse: 'forest' }))).toBe(TerrainType.FOREST)
    expect(classify(feat({ natural: 'scrub' }))).toBe(TerrainType.SCRUB)
  })

  it('gère le wildcard waterway=* (n\'importe quelle valeur)', () => {
    expect(classify(feat({ waterway: 'river' }))).toBe(TerrainType.WATER)
    expect(classify(feat({ waterway: 'stream' }))).toBe(TerrainType.WATER)
  })

  it('renvoie null pour une feature sans tag reconnu (ignorée)', () => {
    expect(classify(feat({ highway: 'residential' }))).toBeNull()
    expect(classify(feat({}))).toBeNull()
  })

  it('priorise le match exact sur le wildcard', () => {
    // natural=water (exact) doit gagner même si d'autres tags existent
    expect(classify(feat({ waterway: 'river', natural: 'water' }))).toBe(TerrainType.WATER)
  })

  it('lit aussi des tags à plat dans properties (fallback)', () => {
    const flat: Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { landuse: 'residential' },
    }
    expect(classify(flat)).toBe(TerrainType.RESIDENTIAL)
  })
})

describe('distribution', () => {
  it('compte par TerrainType et ignore les non classées', () => {
    const features = [
      feat({ natural: 'water' }),
      feat({ waterway: 'canal' }),
      feat({ landuse: 'forest' }),
      feat({ highway: 'path' }), // ignorée
    ]
    const dist = distribution(features)
    expect(dist[TerrainType.WATER]).toBe(2)
    expect(dist[TerrainType.FOREST]).toBe(1)
    expect(dist[TerrainType.ROCK]).toBe(0)
  })

  it('renvoie tous les types initialisés à 0 sur une liste vide', () => {
    const dist = distribution([])
    expect(Object.values(dist).every((n) => n === 0)).toBe(true)
    expect(Object.keys(dist)).toHaveLength(9)
  })
})
