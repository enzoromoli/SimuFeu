import { describe, it, expect } from 'vitest'
import { boundsToGrid, cellToLatLng, latLngToCell } from './geoGrid'
import { makeGrid } from '../../engine/hexUtils'
import { Bounds } from './types'

// Zone test (~ sud de la France, petite emprise).
const BOUNDS: Bounds = { south: 43.5, west: 3.8, north: 43.6, east: 3.95 }

describe('boundsToGrid', () => {
  it('produit une boîte englobante non dégénérée', () => {
    const geo = boundsToGrid(BOUNDS, 12)
    expect(geo.radius).toBe(12)
    expect(geo.maxX).toBeGreaterThan(geo.minX)
    expect(geo.maxY).toBeGreaterThan(geo.minY)
  })
})

describe('round-trip cellToLatLng ↔ latLngToCell', () => {
  it('chaque cellule revient sur elle-même', () => {
    const geo = boundsToGrid(BOUNDS, 6)
    for (const cell of makeGrid(6).values()) {
      const { lat, lng } = cellToLatLng(geo, cell.q, cell.r)
      const back = latLngToCell(geo, lat, lng)
      expect(back.id).toBe(cell.id)
    }
  })

  it('les centres restent dans la bbox géographique', () => {
    const geo = boundsToGrid(BOUNDS, 8)
    for (const cell of makeGrid(8).values()) {
      const { lat, lng } = cellToLatLng(geo, cell.q, cell.r)
      expect(lat).toBeGreaterThanOrEqual(BOUNDS.south - 1e-9)
      expect(lat).toBeLessThanOrEqual(BOUNDS.north + 1e-9)
      expect(lng).toBeGreaterThanOrEqual(BOUNDS.west - 1e-9)
      expect(lng).toBeLessThanOrEqual(BOUNDS.east + 1e-9)
    }
  })
})

describe('positionnement', () => {
  it('la cellule centrale (0,0,0) tombe au centre de la zone', () => {
    const geo = boundsToGrid(BOUNDS, 12)
    const { lat, lng } = cellToLatLng(geo, 0, 0)
    expect(lat).toBeCloseTo((BOUNDS.north + BOUNDS.south) / 2, 5)
    expect(lng).toBeCloseTo((BOUNDS.east + BOUNDS.west) / 2, 5)
  })

  it('le centre géographique retombe sur la cellule centrale', () => {
    const geo = boundsToGrid(BOUNDS, 12)
    const cell = latLngToCell(geo, (BOUNDS.north + BOUNDS.south) / 2, (BOUNDS.east + BOUNDS.west) / 2)
    expect(cell.id).toBe('0,0,0')
  })
})
