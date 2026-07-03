import { CellState, TerrainType, Cell } from './types'

// 6 directions hexagonales, coordonnées cubiques (q+r+s=0).
const AXIAL_DIRS: [number, number, number][] = [
  [1, 0, -1], [1, -1, 0], [0, -1, 1],
  [-1, 0, 1], [-1, 1, 0], [0, 1, -1],
]

export function cellId(q: number, r: number, s: number): string {
  return `${q},${r},${s}`
}

export function getNeighbors(cell: Cell, cells: Map<string, Cell>): Cell[] {
  const neighbors: Cell[] = []
  for (const [dq, dr, ds] of AXIAL_DIRS) {
    const neighbor = cells.get(cellId(cell.q + dq, cell.r + dr, cell.s + ds))
    if (neighbor) neighbors.push(neighbor)
  }
  return neighbors
}

// pointy-top layout
export function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  return {
    x: size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
    y: size * (3 / 2) * r,
  }
}

/**
 * Cap compas (0–359°, 0 = Nord, 90 = Est, sens horaire) d'un déplacement hexagonal axial
 * (dq, dr). Espace pixel pointy-top : +y vers le bas = Sud, donc Nord = −y.
 */
export function hexDirectionDeg(dq: number, dr: number): number {
  const { x, y } = hexToPixel(dq, dr, 1)
  return ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360
}

function cubeRound(q: number, r: number, s: number): { q: number; r: number; s: number } {
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s)
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s)
  if      (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds)            rr = -rq - rs
  else                         rs = -rq - rr
  // +0 normalise -0 → 0 (Math.round peut produire -0 sur de très petits négatifs)
  return { q: rq + 0, r: rr + 0, s: rs + 0 }
}

export function pixelToHex(px: number, py: number, size: number): { q: number; r: number; s: number } {
  const q = ((Math.sqrt(3) / 3) * px - (1 / 3) * py) / size
  const r = ((2 / 3) * py) / size
  return cubeRound(q, r, -q - r)
}

// Coordonnées "offset-row" (col, row) <-> axiales (q, r, s). row = r ; chaque
// ligne impaire décale col d'une demi-largeur d'hexagone (voir makeGrid).
export function offsetToAxial(col: number, row: number): { q: number; r: number; s: number } {
  const q = col - Math.floor(row / 2)
  const r = row
  // +0 normalise -0 → 0 (peut survenir quand q et r sont tous deux nuls)
  return { q, r, s: -q - r + 0 }
}

export function axialToOffset(q: number, r: number): { col: number; row: number } {
  return { col: q + Math.floor(r / 2), row: r }
}

// Grille d'hexagones pointy-top disposés en (2*radiusX+1) colonnes par
// (2*radiusY+1) lignes, en coordonnées offset-row converties en axiales.
// Le décalage d'une ligne sur deux compense le cisaillement des axes cubiques :
// l'ensemble des cellules forme un vrai rectangle en pixels (contrairement à
// une grille cubique de rayon fixe, qui laisse des coins manquants). La forme
// de chaque cellule reste hexagonale ; seule la *zone couverte* est rectangulaire.
// Voir docs/decisions.md.
export function makeGrid(radiusX: number, radiusY: number): Map<string, Cell> {
  const cells = new Map<string, Cell>()
  for (let row = -radiusY; row <= radiusY; row++) {
    for (let col = -radiusX; col <= radiusX; col++) {
      const { q, r, s } = offsetToAxial(col, row)
      const id = cellId(q, r, s)
      cells.set(id, {
        id, q, r, s,
        terrain:          TerrainType.GRASSLAND,
        state:            CellState.INTACT,
        fireTick:         null,
        ignitionPressure: 0,
      })
    }
  }
  return cells
}
