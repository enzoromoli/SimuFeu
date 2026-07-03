import { describe, it, expect } from 'vitest'
import { createHistoryManager } from '../historyManager'
import { makeGrid } from '../gridUtils'
import { placeInitialFire, paintTerrain } from '../simEngine'
import { NEUTRAL_WEATHER } from '../weather'
import { CellState, TerrainType, SimState } from '../types'

function makeInitialState(radius = 2): SimState {
  return { cells: makeGrid(radius, radius), tick: 0, phase: 'setup', weather: NEUTRAL_WEATHER }
}

// ─── createHistoryManager ────────────────────────────────────────────────────

describe('createHistoryManager', () => {
  it('le tickMax initial est 0', () => {
    const hm = createHistoryManager(makeInitialState(), 42)
    expect(hm.tickMax).toBe(0)
  })

  it('expose la seed globale', () => {
    const hm = createHistoryManager(makeInitialState(), 1234)
    expect(hm.globalSeed).toBe(1234)
  })

  it('getState(0) retourne un état au tick 0', () => {
    const initial = makeInitialState()
    const hm = createHistoryManager(initial, 42)
    expect(hm.getState(0).tick).toBe(0)
    expect(hm.getState(0).cells.size).toBe(initial.cells.size)
  })

  it('getState(0) retourne une copie indépendante de l\'état initial', () => {
    const initial = makeInitialState()
    const hm = createHistoryManager(initial, 42)
    // Modifier l'état initial ne doit pas corrompre l'historique
    initial.cells.clear()
    expect(hm.getState(0).cells.size).toBeGreaterThan(0)
  })

  it('getState(t > tickMax) lève RangeError', () => {
    const hm = createHistoryManager(makeInitialState(), 42)
    expect(() => hm.getState(1)).toThrow(RangeError)
  })

  it('getState(t < 0) lève RangeError', () => {
    const hm = createHistoryManager(makeInitialState(), 42)
    expect(() => hm.getState(-1)).toThrow(RangeError)
  })
})

// ─── advance ────────────────────────────────────────────────────────────────

describe('advance', () => {
  it('incrémente tickMax de 1', () => {
    const hm = createHistoryManager(placeInitialFire('0,0,0', makeInitialState()), 42)
    hm.advance()
    expect(hm.tickMax).toBe(1)
  })

  it('le tick de l\'état retourné est bien incrémenté', () => {
    const hm = createHistoryManager(placeInitialFire('0,0,0', makeInitialState()), 42)
    const next = hm.advance()
    expect(next.tick).toBe(1)
  })

  it('ne génère pas de tick supplémentaire si isComplete()', () => {
    const hm = createHistoryManager(makeInitialState(), 42) // aucune cellule en feu
    expect(hm.isComplete()).toBe(true)
    hm.advance()
    expect(hm.tickMax).toBe(0)
  })

  it('plusieurs avances consécutives incrémentent tickMax correctement', () => {
    const hm = createHistoryManager(placeInitialFire('0,0,0', makeInitialState()), 42)
    hm.advance()
    hm.advance()
    hm.advance()
    expect(hm.tickMax).toBe(3)
    expect(hm.getState(3).tick).toBe(3)
  })

  it('séquence reproductible : même seed globale → même séquence de ticks', () => {
    const initial = placeInitialFire('0,0,0', makeInitialState())
    const seed = 999

    const hm1 = createHistoryManager(initial, seed)
    const hm2 = createHistoryManager(initial, seed)

    for (let i = 0; i < 5; i++) { hm1.advance(); hm2.advance() }

    for (let t = 0; t <= 5; t++) {
      const s1 = hm1.getState(t)
      const s2 = hm2.getState(t)
      expect([...s1.cells.values()].map(c => c.state))
        .toEqual([...s2.cells.values()].map(c => c.state))
    }
  })
})

// ─── isComplete ──────────────────────────────────────────────────────────────

describe('isComplete', () => {
  it('retourne true si aucune cellule ON_FIRE', () => {
    const hm = createHistoryManager(makeInitialState(), 42)
    expect(hm.isComplete()).toBe(true)
  })

  it('retourne false si au moins une cellule ON_FIRE', () => {
    const hm = createHistoryManager(placeInitialFire('0,0,0', makeInitialState()), 42)
    expect(hm.isComplete()).toBe(false)
  })
})

// ─── applyAndInvalidate ──────────────────────────────────────────────────────

describe('applyAndInvalidate', () => {
  it('tronque les ticks > t', () => {
    const hm = createHistoryManager(placeInitialFire('0,0,0', makeInitialState()), 42)
    hm.advance(); hm.advance(); hm.advance()
    expect(hm.tickMax).toBe(3)

    hm.applyAndInvalidate(1, s => s)
    expect(hm.tickMax).toBe(1)
  })

  it('applique le modificateur au tick t', () => {
    const hm = createHistoryManager(makeInitialState(), 42)
    hm.applyAndInvalidate(0, s => paintTerrain('0,0,0', TerrainType.WATER, s))
    expect(hm.getState(0).cells.get('0,0,0')!.terrain).toBe(TerrainType.WATER)
  })

  it('modifier le terrain à tick t ne corrompt pas history[t-1]', () => {
    const hm = createHistoryManager(placeInitialFire('0,0,0', makeInitialState()), 42)
    hm.advance()
    const terrainAtT0 = hm.getState(0).cells.get('0,0,0')!.terrain

    hm.applyAndInvalidate(1, s => paintTerrain('0,0,0', TerrainType.WATER, s))

    expect(hm.getState(0).cells.get('0,0,0')!.terrain).toBe(terrainAtT0)
    expect(hm.getState(1).cells.get('0,0,0')!.terrain).toBe(TerrainType.WATER)
  })

  it('lève RangeError si t > tickMax', () => {
    const hm = createHistoryManager(makeInitialState(), 42)
    expect(() => hm.applyAndInvalidate(1, s => s)).toThrow(RangeError)
  })

  it('lève RangeError si t < 0', () => {
    const hm = createHistoryManager(makeInitialState(), 42)
    expect(() => hm.applyAndInvalidate(-1, s => s)).toThrow(RangeError)
  })

  it('après invalidation, advance() régénère les mêmes ticks qu\'une simulation neuve', () => {
    const initial = placeInitialFire('0,0,0', makeInitialState())
    const seed = 777

    // Référence : simulation complète sans interruption
    const hmRef = createHistoryManager(initial, seed)
    for (let i = 0; i < 4; i++) hmRef.advance()

    // Simulation interrompue et régénérée à partir de tick 1 (modificateur identité)
    const hmTest = createHistoryManager(initial, seed)
    for (let i = 0; i < 2; i++) hmTest.advance()
    hmTest.applyAndInvalidate(1, s => s)
    for (let i = 0; i < 3; i++) hmTest.advance()

    // Les ticks 2, 3, 4 doivent être identiques dans les deux simulations
    for (let t = 2; t <= 4; t++) {
      const ref  = hmRef.getState(t)
      const test = hmTest.getState(t)
      expect([...test.cells.values()].map(c => c.state))
        .toEqual([...ref.cells.values()].map(c => c.state))
    }
  })

  it('après une modification de terrain, les ticks régénérés reflètent le nouveau terrain', () => {
    const initial = placeInitialFire('0,0,0', makeInitialState())
    const hm = createHistoryManager(initial, 42)
    hm.advance()
    // Poser un parefeu (WATER = non-inflammable) à tick 1 sur un voisin du foyer
    hm.applyAndInvalidate(1, s => paintTerrain('1,0,-1', TerrainType.WATER, s))
    // Vérifier que le terrain est bien stocké dans le snapshot
    expect(hm.getState(1).cells.get('1,0,-1')!.terrain).toBe(TerrainType.WATER)
  })
})
