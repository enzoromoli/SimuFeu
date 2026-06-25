import { CellState, TerrainType, Cell } from './types'

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

export function makeGrid(radius: number): Map<string, Cell> {
  const cells = new Map<string, Cell>()
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r
      if (Math.abs(s) > radius) continue
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
