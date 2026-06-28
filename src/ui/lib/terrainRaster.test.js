import { describe, it, expect } from 'vitest'
import { TerrainType } from '../../../engine/types'
import { colorToTerrain, TERRAIN_PALETTE_HEX, PALETTE_TERRAIN } from './terrainRaster.js'

const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

describe('palette terrain', () => {
  it('PALETTE_TERRAIN est aligné par index sur TERRAIN_PALETTE_HEX', () => {
    expect(PALETTE_TERRAIN).toHaveLength(TERRAIN_PALETTE_HEX.length)
  })

  it('chaque entrée est un TerrainType valide (0–8)', () => {
    const valid = new Set(Object.values(TerrainType).filter((v) => typeof v === 'number'))
    for (const t of PALETTE_TERRAIN) expect(valid.has(t)).toBe(true)
  })
})

describe('colorToTerrain', () => {
  it('mappe les couleurs de palette exactes vers le bon type', () => {
    expect(colorToTerrain(...rgb('#245218'))).toBe(TerrainType.FOREST)
    expect(colorToTerrain(...rgb('#3d6bbf'))).toBe(TerrainType.WATER)
    expect(colorToTerrain(...rgb('#88c040'))).toBe(TerrainType.GRASSLAND)
    expect(colorToTerrain(...rgb('#c8a840'))).toBe(TerrainType.FARMLAND)
    expect(colorToTerrain(...rgb('#508820'))).toBe(TerrainType.SCRUB)
    expect(colorToTerrain(...rgb('#a09080'))).toBe(TerrainType.ROCK)
  })

  it('le fond non classé tombe sur GRASSLAND', () => {
    expect(colorToTerrain(...rgb('#e8e4d8'))).toBe(TerrainType.GRASSLAND)
  })

  it('une couleur légèrement décalée snappe vers le type le plus proche', () => {
    // #245218 (forêt) + bruit léger
    expect(colorToTerrain(0x26, 0x54, 0x1a)).toBe(TerrainType.FOREST)
  })
})
