// Géoréférencement de la grille hexagonale du moteur.
//
// Le moteur (engine/) est volontairement agnostique géographiquement : ses cellules
// vivent dans un plan hexagonal abstrait (q,r,s → pixels via hexToPixel). Ce module
// projette ce plan sur les coordonnées lat/lon d'une zone dessinée, et inversement.
// Mapping linéaire (courbure terrestre négligée — adapté aux petites zones).
import { Bounds } from './types'
import { makeGrid, hexToPixel, pixelToHex, cellId } from '../../engine/hexUtils'

export interface GridGeo {
  bounds: Bounds
  radius: number
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

/** Construit la transformation grille ↔ géo pour une zone et un rayon donnés. */
export function boundsToGrid(bounds: Bounds, radius = 12): GridGeo {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const cell of makeGrid(radius).values()) {
    const { x, y } = hexToPixel(cell.q, cell.r, 1)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { bounds, radius, minX, maxX, minY, maxY }
}

/** Point pixel (plan hexagonal, size=1) → lat/lon. */
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

/** Cellule de la grille contenant le point (lat/lon). */
export function latLngToCell(geo: GridGeo, lat: number, lng: number): GridCell {
  const { north, south, east, west } = geo.bounds
  const nx = (lng - west) / (east - west)
  const ny = (north - lat) / (north - south)
  const px = geo.minX + nx * (geo.maxX - geo.minX)
  const py = geo.minY + ny * (geo.maxY - geo.minY)
  const { q, r, s } = pixelToHex(px, py, 1)
  return { q, r, s, id: cellId(q, r, s) }
}
