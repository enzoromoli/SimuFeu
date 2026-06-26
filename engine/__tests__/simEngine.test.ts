import { describe, it, expect } from 'vitest'
import { computeIgnitionProb, step, placeInitialFire, paintTerrain } from '../simEngine'
import { CellState, TerrainType, Cell, SimState } from '../types'
import { TERRAIN_CONFIG } from '../terrainConfig'
import { makeGrid } from '../hexUtils'

function makeCell(overrides: Partial<Cell> & { id: string }): Cell {
  return {
    q: 0, r: 0, s: 0,
    terrain: TerrainType.GRASSLAND,
    state: CellState.INTACT,
    fireTick: null,
    ignitionPressure: 0,
    ...overrides,
  }
}

function makeState(radius = 3): SimState {
  return { cells: makeGrid(radius), tick: 0, phase: 'setup' }
}

// ─── computeIgnitionProb ─────────────────────────────────────────────────────

describe('computeIgnitionProb', () => {
  it('retourne 0 pour une cellule non-INTACT', () => {
    const cell = makeCell({ id: '0,0,0', state: CellState.ON_FIRE })
    const neighbor = makeCell({ id: '1,0,-1', state: CellState.ON_FIRE })
    expect(computeIgnitionProb(cell, [neighbor])).toBe(0)
  })

  it('retourne 0 pour un terrain non-inflammable (WATER)', () => {
    const cell = makeCell({ id: '0,0,0', terrain: TerrainType.WATER })
    const neighbor = makeCell({ id: '1,0,-1', state: CellState.ON_FIRE })
    expect(computeIgnitionProb(cell, [neighbor])).toBe(0)
  })

  it('retourne 0 pour un terrain non-inflammable (ROCK)', () => {
    const cell = makeCell({ id: '0,0,0', terrain: TerrainType.ROCK })
    const neighbor = makeCell({ id: '1,0,-1', state: CellState.ON_FIRE })
    expect(computeIgnitionProb(cell, [neighbor])).toBe(0)
  })

  it('retourne 0 sans voisin en feu', () => {
    const cell = makeCell({ id: '0,0,0' })
    const neighbor = makeCell({ id: '1,0,-1' }) // INTACT
    expect(computeIgnitionProb(cell, [neighbor])).toBe(0)
  })

  it('retourne une valeur positive pour un terrain inflammable avec voisin en feu', () => {
    const cell = makeCell({ id: '0,0,0', terrain: TerrainType.FOREST })
    const neighbor = makeCell({ id: '1,0,-1', state: CellState.ON_FIRE })
    expect(computeIgnitionProb(cell, [neighbor])).toBeGreaterThan(0)
  })

  it('retourne toujours une valeur entre 0 et 1 (clamping)', () => {
    const cell = makeCell({ id: '0,0,0', terrain: TerrainType.SCRUB, ignitionPressure: 9999 })
    const neighbors = Array.from({ length: 6 }, (_, i) =>
      makeCell({ id: `${i},1,-1`, state: CellState.ON_FIRE })
    )
    const prob = computeIgnitionProb(cell, neighbors)
    expect(prob).toBeGreaterThanOrEqual(0)
    expect(prob).toBeLessThanOrEqual(1)
  })

  it('une ignitionPressure plus élevée augmente la probabilité', () => {
    const neighbor = makeCell({ id: '1,0,-1', state: CellState.ON_FIRE })
    const low  = makeCell({ id: '0,0,0', ignitionPressure: 0 })
    const high = makeCell({ id: '0,0,0', ignitionPressure: 10 })
    expect(computeIgnitionProb(high, [neighbor])).toBeGreaterThan(computeIgnitionProb(low, [neighbor]))
  })

  it('plus de voisins en feu augmente la probabilité', () => {
    const cell = makeCell({ id: '0,0,0' })
    const one   = [makeCell({ id: '1,0,-1', state: CellState.ON_FIRE })]
    const three = [
      makeCell({ id: '1,0,-1',  state: CellState.ON_FIRE }),
      makeCell({ id: '0,1,-1',  state: CellState.ON_FIRE }),
      makeCell({ id: '-1,1,0',  state: CellState.ON_FIRE }),
    ]
    expect(computeIgnitionProb(cell, three)).toBeGreaterThan(computeIgnitionProb(cell, one))
  })

  it('SCRUB a une probabilité supérieure à FARMLAND dans les mêmes conditions', () => {
    const neighbor = makeCell({ id: '1,0,-1', state: CellState.ON_FIRE })
    const scrub    = makeCell({ id: '0,0,0', terrain: TerrainType.SCRUB })
    const farmland = makeCell({ id: '0,0,0', terrain: TerrainType.FARMLAND })
    expect(computeIgnitionProb(scrub, [neighbor])).toBeGreaterThan(computeIgnitionProb(farmland, [neighbor]))
  })
})

// ─── step ────────────────────────────────────────────────────────────────────

describe('step', () => {
  it('incrémente le tick de 1', () => {
    expect(step(makeState(), () => 0).tick).toBe(1)
  })

  it('conserve la phase', () => {
    expect(step({ ...makeState(), phase: 'running' }, () => 0).phase).toBe('running')
  })

  it('une cellule ON_FIRE devient BURNED après burnDuration ticks', () => {
    const grid = makeGrid(2)
    const center = grid.get('0,0,0')!
    grid.set('0,0,0', { ...center, state: CellState.ON_FIRE, fireTick: 0, terrain: TerrainType.GRASSLAND })
    let state: SimState = { cells: grid, tick: 0, phase: 'running' }

    // La condition est : tick >= fireTick + burnDuration
    // Avec burnDuration=2 et fireTick=0, la cellule reste en feu pour tick=0 et tick=1
    const burnDuration = TERRAIN_CONFIG[TerrainType.GRASSLAND].burnDuration
    for (let i = 0; i < burnDuration; i++) {
      state = step(state, () => 1) // rng=1 bloque l'ignition des voisins
      expect(state.cells.get('0,0,0')!.state).toBe(CellState.ON_FIRE)
    }

    // Au tick burnDuration (tick=2), la condition 2>=0+2 est vraie → BURNED
    state = step(state, () => 1)
    expect(state.cells.get('0,0,0')!.state).toBe(CellState.BURNED)
  })

  it('les cellules BURNED restent BURNED', () => {
    const grid = makeGrid(1)
    grid.set('0,0,0', { ...grid.get('0,0,0')!, state: CellState.BURNED })
    const result = step({ cells: grid, tick: 0, phase: 'running' }, () => 0)
    expect(result.cells.get('0,0,0')!.state).toBe(CellState.BURNED)
  })

  it('une cellule INTACT sans voisin en feu remet ignitionPressure à 0', () => {
    const grid = makeGrid(1)
    grid.set('0,0,0', { ...grid.get('0,0,0')!, ignitionPressure: 5 })
    const result = step({ cells: grid, tick: 0, phase: 'running' }, () => 0)
    expect(result.cells.get('0,0,0')!.ignitionPressure).toBe(0)
  })

  it('une cellule non-enflammée avec voisin en feu incrémente ignitionPressure', () => {
    let state = placeInitialFire('0,0,0', makeState(2))
    state = step(state, () => 1) // rng=1 bloque toute ignition
    const pressure = state.cells.get('1,0,-1')!.ignitionPressure
    expect(pressure).toBeGreaterThan(0)
  })
})

// ─── placeInitialFire ────────────────────────────────────────────────────────

describe('placeInitialFire', () => {
  it('allume une cellule INTACT', () => {
    const result = placeInitialFire('0,0,0', makeState())
    expect(result.cells.get('0,0,0')!.state).toBe(CellState.ON_FIRE)
  })

  it('enregistre le fireTick au tick courant', () => {
    const state: SimState = { ...makeState(), tick: 7 }
    const result = placeInitialFire('0,0,0', state)
    expect(result.cells.get('0,0,0')!.fireTick).toBe(7)
  })

  it('ne fait rien sur un identifiant inexistant', () => {
    const state = makeState()
    expect(placeInitialFire('99,99,-198', state)).toBe(state)
  })

  it('ne fait rien sur un terrain non-inflammable (WATER)', () => {
    const grid = makeGrid(1)
    grid.set('0,0,0', { ...grid.get('0,0,0')!, terrain: TerrainType.WATER })
    const state: SimState = { cells: grid, tick: 0, phase: 'setup' }
    expect(placeInitialFire('0,0,0', state).cells.get('0,0,0')!.state).toBe(CellState.INTACT)
  })

  it('ne modifie pas les autres cellules', () => {
    const state = makeState(1)
    const before = Array.from(state.cells.entries()).filter(([id]) => id !== '0,0,0')
    const after  = Array.from(placeInitialFire('0,0,0', state).cells.entries()).filter(([id]) => id !== '0,0,0')
    expect(after).toEqual(before)
  })
})

// ─── paintTerrain ────────────────────────────────────────────────────────────

describe('paintTerrain', () => {
  it('change le terrain de la cellule', () => {
    const result = paintTerrain('0,0,0', TerrainType.FOREST, makeState())
    expect(result.cells.get('0,0,0')!.terrain).toBe(TerrainType.FOREST)
  })

  it('remet l\'état de la cellule à INTACT', () => {
    const grid = makeGrid(1)
    grid.set('0,0,0', { ...grid.get('0,0,0')!, state: CellState.BURNED })
    const state: SimState = { cells: grid, tick: 0, phase: 'setup' }
    expect(paintTerrain('0,0,0', TerrainType.WATER, state).cells.get('0,0,0')!.state).toBe(CellState.INTACT)
  })

  it('remet fireTick à null et ignitionPressure à 0', () => {
    const grid = makeGrid(1)
    grid.set('0,0,0', { ...grid.get('0,0,0')!, fireTick: 3, ignitionPressure: 5 })
    const result = paintTerrain('0,0,0', TerrainType.SCRUB, { cells: grid, tick: 0, phase: 'setup' })
    expect(result.cells.get('0,0,0')!.fireTick).toBeNull()
    expect(result.cells.get('0,0,0')!.ignitionPressure).toBe(0)
  })

  it('ne fait rien sur un identifiant inexistant', () => {
    const state = makeState()
    expect(paintTerrain('99,99,-198', TerrainType.FOREST, state)).toBe(state)
  })
})
