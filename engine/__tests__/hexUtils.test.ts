import { describe, it, expect } from 'vitest'
import { cellId, getNeighbors, hexToPixel, pixelToHex, makeGrid } from '../hexUtils'
import { CellState, TerrainType } from '../types'

describe('cellId', () => {
  it('formate les coordonnées en chaîne q,r,s', () => {
    expect(cellId(0, 0, 0)).toBe('0,0,0')
    expect(cellId(1, -1, 0)).toBe('1,-1,0')
    expect(cellId(-3, 2, 1)).toBe('-3,2,1')
  })
})

describe('makeGrid', () => {
  it('crée 7 cellules pour rayon 1', () => {
    expect(makeGrid(1).size).toBe(7)
  })

  it('crée 19 cellules pour rayon 2', () => {
    expect(makeGrid(2).size).toBe(19)
  })

  it('crée 37 cellules pour rayon 3', () => {
    expect(makeGrid(3).size).toBe(37)
  })

  it('la cellule centrale existe en 0,0,0', () => {
    expect(makeGrid(2).has('0,0,0')).toBe(true)
  })

  it('toutes les cellules démarrent en état INTACT', () => {
    for (const cell of makeGrid(2).values()) {
      expect(cell.state).toBe(CellState.INTACT)
    }
  })

  it('toutes les cellules ont le terrain GRASSLAND par défaut', () => {
    for (const cell of makeGrid(2).values()) {
      expect(cell.terrain).toBe(TerrainType.GRASSLAND)
    }
  })

  it('fireTick est null et ignitionPressure vaut 0 à l\'initialisation', () => {
    for (const cell of makeGrid(1).values()) {
      expect(cell.fireTick).toBeNull()
      expect(cell.ignitionPressure).toBe(0)
    }
  })

  it('la contrainte cubique q+r+s=0 est respectée pour toutes les cellules', () => {
    for (const cell of makeGrid(3).values()) {
      expect(cell.q + cell.r + cell.s).toBe(0)
    }
  })
})

describe('getNeighbors', () => {
  it('une cellule intérieure a 6 voisins', () => {
    const grid = makeGrid(3)
    const center = grid.get('0,0,0')!
    expect(getNeighbors(center, grid)).toHaveLength(6)
  })

  it('une cellule de bord a moins de 6 voisins', () => {
    const grid = makeGrid(1)
    const corner = grid.get('1,0,-1')!
    expect(getNeighbors(corner, grid).length).toBeLessThan(6)
  })

  it('tous les voisins sont à distance 1 (coordonnées cubiques)', () => {
    const grid = makeGrid(3)
    const center = grid.get('0,0,0')!
    for (const n of getNeighbors(center, grid)) {
      const dist = Math.max(
        Math.abs(n.q - center.q),
        Math.abs(n.r - center.r),
        Math.abs(n.s - center.s),
      )
      expect(dist).toBe(1)
    }
  })

  it('la relation de voisinage est symétrique', () => {
    const grid = makeGrid(3)
    const center = grid.get('0,0,0')!
    const neighbors = getNeighbors(center, grid)
    for (const n of neighbors) {
      const backNeighbors = getNeighbors(n, grid)
      expect(backNeighbors.some(b => b.id === center.id)).toBe(true)
    }
  })
})

describe('hexToPixel / pixelToHex', () => {
  it('la cellule centrale se projette à l\'origine', () => {
    expect(hexToPixel(0, 0, 20)).toEqual({ x: 0, y: 0 })
  })

  it('pixelToHex est l\'inverse de hexToPixel', () => {
    const size = 20
    const cases: [number, number, number][] = [
      [0, 0, 0], [1, 0, -1], [-1, 1, 0], [2, -1, -1], [0, 2, -2],
    ]
    for (const [q, r, s] of cases) {
      const { x, y } = hexToPixel(q, r, size)
      const result = pixelToHex(x, y, size)
      expect(result.q).toBe(q)
      expect(result.r).toBe(r)
      expect(result.s).toBe(s)
    }
  })
})
