import { describe, it, expect } from 'vitest'
import { CellState, TerrainType } from '../types'

describe('CellState', () => {
  it('a les bonnes valeurs string', () => {
    expect(CellState.INTACT).toBe('INTACT')
    expect(CellState.ON_FIRE).toBe('ON_FIRE')
    expect(CellState.BURNED).toBe('BURNED')
  })
})

describe('TerrainType', () => {
  it('a les bonnes valeurs entières', () => {
    expect(TerrainType.WATER).toBe(0)
    expect(TerrainType.ROCK).toBe(1)
    expect(TerrainType.WETLAND).toBe(2)
    expect(TerrainType.GRASSLAND).toBe(3)
    expect(TerrainType.FARMLAND).toBe(4)
    expect(TerrainType.SCRUB).toBe(5)
    expect(TerrainType.FOREST).toBe(6)
    expect(TerrainType.RESIDENTIAL).toBe(7)
    expect(TerrainType.INDUSTRIAL).toBe(8)
  })

  it('a 9 types distincts', () => {
    const values = Object.values(TerrainType).filter(v => typeof v === 'number')
    expect(values).toHaveLength(9)
    expect(new Set(values).size).toBe(9)
  })
})
