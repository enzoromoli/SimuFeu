import { SimState, CellState } from './types'
import { step } from './simEngine'
import { makeRng, deriveSeed } from './rng'

// Chaque snapshot est une copie profonde indépendante.
// Cell est un objet plat (pas de propriétés imbriquées) : un niveau de spread suffit.
function deepCopyState(s: SimState): SimState {
  return { ...s, cells: new Map([...s.cells].map(([k, c]) => [k, { ...c }])) }
}

export interface HistoryManager {
  readonly tickMax: number
  readonly globalSeed: number
  getState(t: number): SimState
  advance(): SimState
  applyAndInvalidate(t: number, modifier: (s: SimState) => SimState): SimState
  isComplete(): boolean
}

export function createHistoryManager(initialState: SimState, globalSeed: number): HistoryManager {
  const history: SimState[] = [deepCopyState(initialState)]

  function assertInBounds(t: number): void {
    if (t < 0 || t > history.length - 1) {
      throw new RangeError(`Tick ${t} hors limites [0, ${history.length - 1}]`)
    }
  }

  return {
    get tickMax() { return history.length - 1 },
    get globalSeed() { return globalSeed },

    getState(t: number): SimState {
      assertInBounds(t)
      return history[t]
    },

    advance(): SimState {
      if (this.isComplete()) return history[history.length - 1]
      const nextTick = history.length
      const rng = makeRng(deriveSeed(globalSeed, nextTick))
      // step() est pure et retourne un état neuf — pas besoin de deep copy supplémentaire
      history.push(step(history[nextTick - 1], rng))
      return history[history.length - 1]
    },

    applyAndInvalidate(t: number, modifier: (s: SimState) => SimState): SimState {
      assertInBounds(t)
      history.splice(t + 1)
      // Deep copy avant modification : garantit l'isolation vis-à-vis des ticks précédents
      history[t] = modifier(deepCopyState(history[t]))
      return history[t]
    },

    isComplete(): boolean {
      const last = history[history.length - 1]
      return ![...last.cells.values()].some(c => c.state === CellState.ON_FIRE)
    },
  }
}
