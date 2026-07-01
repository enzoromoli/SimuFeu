import { describe, it, expect } from 'vitest'
import { loadTerrains, placeInitialFire } from '../simEngine'
import { createHistoryManager } from '../historyManager'
import { makeGrid } from '../gridUtils'
import { CellState, TerrainType, SimState } from '../types'

function makeState(radius = 2): SimState {
  return { cells: makeGrid(radius, radius), tick: 0, phase: 'setup' }
}

// Les 6 voisins du centre (anneau intérieur).
const INNER_RING = ['1,0,-1', '0,1,-1', '-1,1,0', '-1,0,1', '0,-1,1', '1,-1,0']

describe('loadTerrains', () => {
  it('remplit les terrains demandés et remet les cellules à INTACT', () => {
    const state = loadTerrains(
      [{ id: '0,0,0', terrain: TerrainType.FOREST }, { id: '1,0,-1', terrain: TerrainType.WATER }],
      makeState(),
    )
    expect(state.cells.get('0,0,0')!.terrain).toBe(TerrainType.FOREST)
    expect(state.cells.get('1,0,-1')!.terrain).toBe(TerrainType.WATER)
    expect(state.cells.get('0,0,0')!.state).toBe(CellState.INTACT)
  })

  it('ignore les ids inconnus sans planter', () => {
    expect(() =>
      loadTerrains([{ id: '99,99,-198', terrain: TerrainType.FOREST }], makeState()),
    ).not.toThrow()
  })

  it('ne mute pas l’état source (fonction pure)', () => {
    const before = makeState()
    loadTerrains([{ id: '0,0,0', terrain: TerrainType.FOREST }], before)
    expect(before.cells.get('0,0,0')!.terrain).toBe(TerrainType.GRASSLAND)
  })
})

describe('Scénario worker : loadTerrain → ignite → navigate', () => {
  it('le feu se propage puis s’arrête ; un anneau d’eau bloque la propagation', () => {
    const hm = createHistoryManager(makeState(2), 0xc0ffee)

    // Anneau d'eau autour du centre + foyer central — comme le ferait le worker.
    hm.applyAndInvalidate(0, s => loadTerrains(INNER_RING.map(id => ({ id, terrain: TerrainType.WATER })), s))
    hm.applyAndInvalidate(0, s => placeInitialFire('0,0,0', s))

    // Avancer (génération lazy) jusqu'à extinction.
    let guard = 0
    while (!hm.isComplete() && guard++ < 100) hm.advance()

    expect(hm.isComplete()).toBe(true)

    const last = hm.getState(hm.tickMax)
    // L'eau ne brûle jamais.
    for (const id of INNER_RING) {
      expect(last.cells.get(id)!.state).toBe(CellState.INTACT)
    }
    // Le foyer central a fini par brûler.
    expect(last.cells.get('0,0,0')!.state).toBe(CellState.BURNED)
  })

  it('reculer (lecture d’un tick passé) ne recalcule pas l’historique', () => {
    const hm = createHistoryManager(makeState(2), 0xc0ffee)
    hm.applyAndInvalidate(0, s => placeInitialFire('0,0,0', s))
    hm.advance(); hm.advance(); hm.advance()

    const tickMaxBefore = hm.tickMax
    hm.getState(0)
    hm.getState(1)
    expect(hm.tickMax).toBe(tickMaxBefore)
  })
})
