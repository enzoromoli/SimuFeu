import { describe, it, expect } from 'vitest'
import { OSM_TAGS, TERRAIN_TYPES, TerrainType } from './types'

describe('OSM_TAGS', () => {
  it('définit au moins un tag pour chaque TerrainType', () => {
    for (const t of TERRAIN_TYPES) {
      expect(OSM_TAGS[t].length).toBeGreaterThan(0)
    }
  })

  it('couvre exactement les 9 types de terrain', () => {
    expect(TERRAIN_TYPES).toHaveLength(9)
    expect(Object.keys(OSM_TAGS).map(Number).sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ])
  })

  it('chaque tag est au format clé=valeur (valeur non vide, wildcard * permis)', () => {
    for (const t of TERRAIN_TYPES) {
      for (const tag of OSM_TAGS[t]) {
        expect(tag).toMatch(/^[a-z_]+=[A-Za-z0-9_*]+$/)
      }
    }
  })

  it('conserve les valeurs numériques de l\'engine (WATER=0 … INDUSTRIAL=8)', () => {
    expect(TerrainType.WATER).toBe(0)
    expect(TerrainType.INDUSTRIAL).toBe(8)
  })
})
