import { describe, it, expect } from 'vitest'
import { cellId, getNeighbors, hexToPixel, pixelToHex, makeGrid, offsetToAxial, axialToOffset } from '../gridUtils'
import { CellState, TerrainType } from '../types'

describe('cellId', () => {
  it('formate les coordonnées cubiques en chaîne q,r,s', () => {
    expect(cellId(0, 0, 0)).toBe('0,0,0')
    expect(cellId(1, -1, 0)).toBe('1,-1,0')
    expect(cellId(-3, 2, 1)).toBe('-3,2,1')
  })
})

describe('offsetToAxial / axialToOffset', () => {
  it('la cellule (0,0) correspond à (0,0,0)', () => {
    expect(offsetToAxial(0, 0)).toEqual({ q: 0, r: 0, s: 0 })
  })

  it('axialToOffset est l\'inverse de offsetToAxial', () => {
    const cases: [number, number][] = [[0, 0], [1, 0], [-1, 1], [2, -1], [0, 2], [-3, -2]]
    for (const [col, row] of cases) {
      const { q, r } = offsetToAxial(col, row)
      expect(axialToOffset(q, r)).toEqual({ col, row })
    }
  })
})

describe('makeGrid', () => {
  it('crée une grille de (2*radiusX+1) x (2*radiusY+1) hexagones', () => {
    expect(makeGrid(1, 1).size).toBe(9)
    expect(makeGrid(2, 2).size).toBe(25)
    expect(makeGrid(3, 2).size).toBe(35)
  })

  it('la cellule centrale existe en 0,0,0', () => {
    expect(makeGrid(2, 2).has('0,0,0')).toBe(true)
  })

  it('toutes les cellules démarrent en état INTACT', () => {
    for (const cell of makeGrid(2, 2).values()) {
      expect(cell.state).toBe(CellState.INTACT)
    }
  })

  it('toutes les cellules ont le terrain GRASSLAND par défaut', () => {
    for (const cell of makeGrid(2, 2).values()) {
      expect(cell.terrain).toBe(TerrainType.GRASSLAND)
    }
  })

  it('fireTick est null et ignitionPressure vaut 0 à l\'initialisation', () => {
    for (const cell of makeGrid(1, 1).values()) {
      expect(cell.fireTick).toBeNull()
      expect(cell.ignitionPressure).toBe(0)
    }
  })

  it('respecte la contrainte cubique q+r+s=0 pour toutes les cellules', () => {
    for (const cell of makeGrid(3, 3).values()) {
      expect(cell.q + cell.r + cell.s).toBe(0)
    }
  })
})

describe('getNeighbors', () => {
  it('une cellule intérieure a 6 voisins', () => {
    const grid = makeGrid(3, 3)
    const center = grid.get('0,0,0')!
    expect(getNeighbors(center, grid)).toHaveLength(6)
  })

  it('une cellule de bord a moins de 6 voisins', () => {
    const grid = makeGrid(1, 1)
    const corner = grid.get('1,0,-1')!
    expect(getNeighbors(corner, grid).length).toBeLessThan(6)
  })

  it('tous les voisins sont à distance 1 (norme cubique)', () => {
    const grid = makeGrid(3, 3)
    const center = grid.get('0,0,0')!
    for (const n of getNeighbors(center, grid)) {
      const dist = Math.max(Math.abs(n.q - center.q), Math.abs(n.r - center.r), Math.abs(n.s - center.s))
      expect(dist).toBe(1)
    }
  })

  it('la relation de voisinage est symétrique', () => {
    const grid = makeGrid(3, 3)
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
    const cases: [number, number][] = [[0, 0], [1, 0], [-1, 1], [2, -1], [0, 2]]
    for (const [q, r] of cases) {
      const { x, y } = hexToPixel(q, r, size)
      const result = pixelToHex(x, y, size)
      expect(result.q).toBe(q)
      expect(result.r).toBe(r)
      expect(result.s).toBe(-q - r + 0)
    }
  })
})
