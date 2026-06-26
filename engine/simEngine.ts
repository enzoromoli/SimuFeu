import { CellState, TerrainType, Cell, SimState } from './types'
import { TERRAIN_CONFIG, PRESSURE_COEFF, NEIGHBOR_FIRE_WEIGHT } from './terrainConfig'
import { getNeighbors } from './hexUtils'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function computeIgnitionProb(cell: Cell, neighbors: Cell[]): number {
  if (cell.state !== CellState.INTACT) return 0
  const cfg = TERRAIN_CONFIG[cell.terrain]
  if (cfg.flammability === 0) return 0

  const fireCount = neighbors.filter(n => n.state === CellState.ON_FIRE).length
  if (fireCount === 0) return 0

  // TODO: wind — ajouter ici un multiplicateur directionnel selon le vecteur vent + direction du voisin
  // TODO: ember — ajouter ici une probabilité d'ignition longue portée depuis des cellules distantes

  return clamp(
    cfg.flammability
    * (fireCount * (NEIGHBOR_FIRE_WEIGHT + cfg.spreadBonus))
    * (1 + cell.ignitionPressure * PRESSURE_COEFF),
    0, 1
  )
}

export function step(state: SimState, rng: () => number): SimState {
  const { cells, tick } = state
  const newCells = new Map<string, Cell>()

  for (const [id, cell] of cells) {
    const cfg = TERRAIN_CONFIG[cell.terrain]

    if (cell.state === CellState.ON_FIRE) {
      const burned = cell.fireTick !== null && tick >= cell.fireTick + cfg.burnDuration
      newCells.set(id, { ...cell, state: burned ? CellState.BURNED : CellState.ON_FIRE })
      continue
    }

    if (cell.state === CellState.BURNED) {
      newCells.set(id, { ...cell })
      continue
    }

    // INTACT
    const neighbors = getNeighbors(cell, cells)
    const hasFireNeighbor = neighbors.some(n => n.state === CellState.ON_FIRE)

    if (!hasFireNeighbor) {
      // TODO: ember — vérifier ici une ignition par braise depuis des cellules non-adjacentes
      newCells.set(id, { ...cell, ignitionPressure: 0 })
      continue
    }

    if (rng() < computeIgnitionProb(cell, neighbors)) {
      newCells.set(id, { ...cell, state: CellState.ON_FIRE, fireTick: tick, ignitionPressure: 0 })
    } else {
      newCells.set(id, { ...cell, ignitionPressure: cell.ignitionPressure + 1 })
    }
  }

  return { cells: newCells, tick: tick + 1, phase: state.phase }
}

export function placeInitialFire(id: string, state: SimState): SimState {
  const cell = state.cells.get(id)
  if (!cell || TERRAIN_CONFIG[cell.terrain].flammability === 0) return state
  const newCells = new Map(state.cells)
  newCells.set(id, { ...cell, state: CellState.ON_FIRE, fireTick: state.tick, ignitionPressure: 0 })
  return { ...state, cells: newCells }
}

export function paintTerrain(id: string, terrain: TerrainType, state: SimState): SimState {
  const cell = state.cells.get(id)
  if (!cell) return state
  const newCells = new Map(state.cells)
  newCells.set(id, { ...cell, terrain, state: CellState.INTACT, fireTick: null, ignitionPressure: 0 })
  return { ...state, cells: newCells }
}
