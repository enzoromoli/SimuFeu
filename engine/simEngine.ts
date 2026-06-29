import { CellState, TerrainType, Cell, SimState, Weather } from './types'
import { TERRAIN_CONFIG, PRESSURE_COEFF, NEIGHBOR_FIRE_WEIGHT } from './terrainConfig'
import { getNeighbors } from './hexUtils'
import { weatherIgnitionFactor, effectiveBurnDuration } from './weather'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function computeIgnitionProb(cell: Cell, neighbors: Cell[], weather: Weather): number {
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
    * (1 + cell.ignitionPressure * PRESSURE_COEFF)
    * weatherIgnitionFactor(weather),
    0, 1
  )
}

export function step(state: SimState, rng: () => number): SimState {
  const { cells, tick, weather } = state
  const newCells = new Map<string, Cell>()

  for (const [id, cell] of cells) {
    const cfg = TERRAIN_CONFIG[cell.terrain]

    if (cell.state === CellState.ON_FIRE) {
      const burnDuration = effectiveBurnDuration(cfg.burnDuration, weather)
      const burned = cell.fireTick !== null && tick >= cell.fireTick + burnDuration
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

    if (rng() < computeIgnitionProb(cell, neighbors, weather)) {
      newCells.set(id, { ...cell, state: CellState.ON_FIRE, fireTick: tick, ignitionPressure: 0 })
    } else {
      newCells.set(id, { ...cell, ignitionPressure: cell.ignitionPressure + 1 })
    }
  }

  return { cells: newCells, tick: tick + 1, phase: state.phase, weather }
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

// Remplissage en masse du terrain (ex. import depuis la carte). Les ids inconnus sont
// ignorés. Chaque cellule touchée est remise à INTACT (cohérent avec paintTerrain).
export function loadTerrains(
  patches: { id: string; terrain: TerrainType }[],
  state: SimState,
): SimState {
  const newCells = new Map(state.cells)
  for (const { id, terrain } of patches) {
    const cell = newCells.get(id)
    if (!cell) continue
    newCells.set(id, { ...cell, terrain, state: CellState.INTACT, fireTick: null, ignitionPressure: 0 })
  }
  return { ...state, cells: newCells }
}
