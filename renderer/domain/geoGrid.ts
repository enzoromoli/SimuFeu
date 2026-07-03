// Géoréférencement de la grille hexagonale du moteur.
//
// Le moteur (engine/) est volontairement agnostique géographiquement : ses cellules
// vivent dans un plan axial (q,r,s) abstrait → pixels via hexToPixel. Ce module projette
// ce plan sur les coordonnées lat/lon d'une zone dessinée, et inversement.
// Mapping linéaire (courbure terrestre négligée — adapté aux petites zones).
import { Bounds } from './types'
import { makeGrid, hexToPixel, pixelToHex, offsetToAxial, axialToOffset, cellId } from '../../engine/gridUtils'

export interface GridGeo {
  bounds: Bounds
  radiusX: number
  radiusY: number
  // Boîte englobante (en pixels, size=1) des centres de cellules.
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface GridCell {
  q: number
  r: number
  s: number
  id: string
}

/** Construit la transformation grille ↔ géo pour une zone et une résolution donnée. */
export function boundsToGrid(bounds: Bounds, radiusX = 12, radiusY = 12): GridGeo {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const cell of makeGrid(radiusX, radiusY).values()) {
    const { x, y } = hexToPixel(cell.q, cell.r, 1)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { bounds, radiusX, radiusY, minX, maxX, minY, maxY }
}

/** Point pixel (plan grille, size=1) → lat/lon. */
export function pixelToLatLng(geo: GridGeo, x: number, y: number): { lat: number; lng: number } {
  const nx = (x - geo.minX) / (geo.maxX - geo.minX)
  const ny = (y - geo.minY) / (geo.maxY - geo.minY)
  const { north, south, east, west } = geo.bounds
  return {
    lng: west + nx * (east - west),
    // y croît vers le bas → ny=0 correspond au nord.
    lat: north - ny * (north - south),
  }
}

/** Centre géographique (lat/lon) de la cellule (q, r). */
export function cellToLatLng(geo: GridGeo, q: number, r: number): { lat: number; lng: number } {
  const { x, y } = hexToPixel(q, r, 1)
  return pixelToLatLng(geo, x, y)
}

/** Cellule hexagonale la plus proche du point (lat/lon), bornée au rectangle de la grille. */
export function latLngToCell(geo: GridGeo, lat: number, lng: number): GridCell {
  const { north, south, east, west } = geo.bounds
  const nx = (lng - west) / (east - west)
  const ny = (north - lat) / (north - south)
  const px = geo.minX + nx * (geo.maxX - geo.minX)
  const py = geo.minY + ny * (geo.maxY - geo.minY)
  const { q, r } = pixelToHex(px, py, 1)
  const { col, row } = axialToOffset(q, r)
  const clampedCol = Math.max(-geo.radiusX, Math.min(geo.radiusX, col))
  const clampedRow = Math.max(-geo.radiusY, Math.min(geo.radiusY, row))
  const axial = offsetToAxial(clampedCol, clampedRow)
  return { ...axial, id: cellId(axial.q, axial.r, axial.s) }
}
