import { describe, it, expect, vi } from 'vitest'
import { step, placeInitialFire, paintTerrain } from '../simEngine'
import { CellState, TerrainType, SimState } from '../types'
import { TERRAIN_CONFIG } from '../terrainConfig'
import { makeGrid } from '../hexUtils'

function makeState(radius = 3): SimState {
  return { cells: makeGrid(radius), tick: 0, phase: 'setup' }
}

describe('Scénarios fonctionnels', () => {

  it('cycle complet : une cellule suit la séquence INTACT → ON_FIRE → BURNED', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1) // bloque la propagation

    let state = placeInitialFire('0,0,0', makeState(1))
    expect(state.cells.get('0,0,0')!.state).toBe(CellState.ON_FIRE)

    const burnDuration = TERRAIN_CONFIG[TerrainType.GRASSLAND].burnDuration
    for (let i = 0; i < burnDuration + 1; i++) state = step(state)

    expect(state.cells.get('0,0,0')!.state).toBe(CellState.BURNED)
    vi.restoreAllMocks()
  })

  it('sans ignition, le feu ne se propage pas', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)

    let state = placeInitialFire('0,0,0', makeState())
    for (let i = 0; i < 5; i++) state = step(state)

    const affected = Array.from(state.cells.values())
      .filter(c => c.state === CellState.ON_FIRE || c.state === CellState.BURNED)
    expect(affected.every(c => c.id === '0,0,0')).toBe(true)

    vi.restoreAllMocks()
  })

  it('avec ignition garantie, le feu se propage aux 6 voisins en un tick', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    let state = placeInitialFire('0,0,0', makeState())
    state = step(state)

    const onFire = Array.from(state.cells.values()).filter(c => c.state === CellState.ON_FIRE)
    // centre + 6 voisins adjacents
    expect(onFire.length).toBe(7)

    vi.restoreAllMocks()
  })

  it("l'eau ne prend jamais feu même entourée de 6 voisins en flammes", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    let state = makeState()
    state = paintTerrain('0,0,0', TerrainType.WATER, state)

    const neighbors = ['1,0,-1', '0,1,-1', '-1,1,0', '-1,0,1', '0,-1,1', '1,-1,0']
    for (const id of neighbors) state = placeInitialFire(id, state)

    state = step(state)
    expect(state.cells.get('0,0,0')!.state).toBe(CellState.INTACT)

    vi.restoreAllMocks()
  })

  it('ignitionPressure se remet à 0 quand le feu voisin s\'éteint', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)

    let state = placeInitialFire('0,0,0', makeState(1))
    const burnDuration = TERRAIN_CONFIG[TerrainType.GRASSLAND].burnDuration

    // burnDuration+1 ticks pour que la cellule devienne BURNED,
    // +2 ticks supplémentaires pour que les voisins voient la disparition du feu et reset
    for (let i = 0; i < burnDuration + 3; i++) state = step(state)

    expect(state.cells.get('0,0,0')!.state).toBe(CellState.BURNED)
    expect(state.cells.get('1,0,-1')!.ignitionPressure).toBe(0)

    vi.restoreAllMocks()
  })

  it('le feu se propage plus loin sur SCRUB que sur FARMLAND en même durée', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    // Simulation sur terrain Maquis
    let scrubState = makeState(5)
    for (const cell of scrubState.cells.values()) {
      scrubState.cells.set(cell.id, { ...cell, terrain: TerrainType.SCRUB })
    }
    scrubState = placeInitialFire('0,0,0', scrubState)

    // Simulation sur terrain Agricole
    let farmState = makeState(5)
    for (const cell of farmState.cells.values()) {
      farmState.cells.set(cell.id, { ...cell, terrain: TerrainType.FARMLAND })
    }
    farmState = placeInitialFire('0,0,0', farmState)

    for (let i = 0; i < 4; i++) {
      scrubState = step(scrubState)
      farmState  = step(farmState)
    }

    const countFire = (s: SimState) =>
      Array.from(s.cells.values()).filter(c => c.state !== CellState.INTACT).length

    expect(countFire(scrubState)).toBeGreaterThanOrEqual(countFire(farmState))

    vi.restoreAllMocks()
  })

  it('un incendie sur une zone isolée (rayon 1) se consume entièrement', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1) // aucune propagation

    let state = placeInitialFire('0,0,0', makeState(1))
    const burnDuration = TERRAIN_CONFIG[TerrainType.GRASSLAND].burnDuration
    for (let i = 0; i < burnDuration + 2; i++) state = step(state)

    const stillBurning = Array.from(state.cells.values()).filter(c => c.state === CellState.ON_FIRE)
    expect(stillBurning).toHaveLength(0)

    vi.restoreAllMocks()
  })

  it('une simulation complète de 20 ticks ne lève pas d\'erreur', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    let state = placeInitialFire('0,0,0', makeState(3))
    expect(() => {
      for (let i = 0; i < 20; i++) state = step(state)
    }).not.toThrow()

    vi.restoreAllMocks()
  })
})
